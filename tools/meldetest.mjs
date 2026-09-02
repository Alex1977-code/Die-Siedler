// Prueft die Meldungssteuerung (v197):
//   1. jede Meldung traegt eine Sparte
//   2. abgeschaltete Sparte -> keine Einblendung, aber im Meldungsbuch
//   3. Missionsziele lassen sich nicht abschalten
//   4. der Sprung aus dem Buch GLEITET statt zu springen
//   5. die Einstellung ueberlebt einen Neustart der Seite
import { chromium } from 'playwright';
import { starteSpiel, SERVER } from './messhelfer.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:390,height:844}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:11, groesse:'M', gegner:'1'});

const erg=await page.evaluate(async ()=>{
  const ui=window.__ui, g=ui.game;
  const core=await import('./js/core.js');
  const {MELDE_KATS, MELDE_IMMER}=core;
  const raus={};

  // Meldungen aller Sparten erzeugen
  g.msgs.length=0; ui.state.msgSeen=0;
  g.msg('Wachhaus fertiggestellt.','ok', 100, 0, 'bau');
  g.msg('Geologe: Kohle gefunden!','ok', 200, 0, 'erz');
  g.msg('Wir werden angegriffen!','war', 300, 0, 'kampf');
  g.msg('Ein Esel verstärkt eine Straße.','ok', 400, 0, 'wirtschaft');
  g.msg('Es fehlt ein Hammer.','warn', 500, 0, 'warnung');
  g.msg('Ziel erreicht: Besiege alle Gegner','ok', -1, 0, 'ziel');
  g.msg('Ohne Angabe','info', 600);          // Sparte wird abgeleitet
  raus.sparten=g.msgs.map(m=>m.kat);
  raus.alleHabenSparte=g.msgs.every(m=>!!m.kat);

  // 2. Sparten abschalten
  ui.opts.meldungen={bau:false, erz:false, kampf:true, wirtschaft:true, warnung:false};
  raus.gezeigt=g.msgs.filter(m=>ui.meldungAn(m)).map(m=>m.kat);
  raus.zielImmer=ui.meldungAn(g.msgs.find(m=>m.kat===MELDE_IMMER));

  // Einblendungen zaehlen
  let toasts=0;
  const origToast=ui.toast.bind(ui);
  ui.toast=(...a)=>{ toasts++; return origToast(...a); };
  ui.state.msgSeen=0;
  ui.pollMsgs();
  raus.toasts=toasts;                        // nur die eingeschalteten
  ui.toast=origToast;

  // 3. Buch zeigt ALLE
  ui.openMsgLog();
  raus.buchZeilen=document.querySelectorAll('#msglog .ml-zeile').length;
  raus.buchAus=document.querySelectorAll('#msglog .ml-zeile.aus').length;

  // 4. Gleiten statt springen
  ui._camZug=null;
  const vor={x:ui.cam.x, y:ui.cam.y};
  ui.jumpTo(3000);
  const zug=ui._camZug;
  raus.gleitet = !!zug && (zug.nachX!==zug.vonX || zug.nachY!==zug.vonY);
  raus.sofortVersetzt = (ui.cam.x!==vor.x || ui.cam.y!==vor.y);   // soll false sein
  // einen Schritt weiterdrehen: die Kamera muss sich bewegen
  ui.kameraZiehen(performance.now()+80);
  raus.nachSchritt = (ui.cam.x!==vor.x || ui.cam.y!==vor.y);
  ui.kameraZiehen(performance.now()+9999);
  raus.amZiel = Math.abs(ui.cam.x-zug.nachX)<0.01 && Math.abs(ui.cam.y-zug.nachY)<0.01;
  document.querySelector('#ml-x').click();

  // 5. Optionen speichern
  const SAVE=await import('./js/save.js');
  SAVE.setOptions(ui.opts);
  raus.gespeichert=SAVE.getOptions().meldungen;
  raus.katListe=MELDE_KATS.map(k=>k.key);
  return raus;
});

console.log(JSON.stringify(erg,null,1));

// Neustart der Seite: bleibt die Einstellung?
await page.goto(SERVER, {waitUntil:'load'});
const nachNeustart=await page.evaluate(()=>window.__ui.opts.meldungen);
console.log('nach Neustart:', JSON.stringify(nachNeustart));

const ok = erg.alleHabenSparte
  && erg.sparten.join()==='bau,erz,kampf,wirtschaft,warnung,ziel,wirtschaft'
  && erg.gezeigt.join()==='kampf,wirtschaft,ziel,wirtschaft'
  && erg.zielImmer===true
  && erg.toasts===4                 // kampf, wirtschaft, ziel + abgeleitete
  && erg.buchZeilen===7 && erg.buchAus===3
  && erg.gleitet && !erg.sofortVersetzt && erg.nachSchritt && erg.amZiel
  && nachNeustart && nachNeustart.bau===false && nachNeustart.kampf===true
  && !fehler.length;
console.log('\nSeitenfehler:', fehler.length? fehler.slice(0,3):'keine');
console.log(ok? 'MELDETEST OK' : 'MELDETEST FEHLGESCHLAGEN');
await br.close();
process.exit(ok?0:1);
