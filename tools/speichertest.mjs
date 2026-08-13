// Speichern und Laden pruefen (Blinder Fleck 1 aus Kritikrunde 4: es war NIE geprueft
// worden - die eine Zeile, die es behauptete, testete ein window.SAVE, das
// es gar nicht gibt, und meldete deshalb immer gruen.
// Hier richtig: ueber den Modulpfad speichern, Seite neu laden, laden,
// Kennzahlen vergleichen, danach weiterspielen (ein geladener Stand muss
// auch WEITERLAUFEN, nicht nur richtig aussehen).
import { chromium } from 'playwright';
import { starteSpiel } from '/home/user/Die-Siedler/tools/messhelfer.mjs';
const SAAT=+(process.argv[2]||11);
const MIN=+(process.argv[3]||20);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:600}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:SAAT, groesse:'M', gegner:'1'});

const kennzahlen=`(()=>{
  const g=window.__ui.game, m=g.map;
  const inv=g.invTotal(0);
  const zaehl=(f)=>[...g.buildings.values()].filter(f).length;
  let felder=0, baeume=0, wege=0;
  for(let i=0;i<m.obj.length;i++){ const o=m.obj[i]&127;
    if(o>=5&&o<=7) felder++; else if(o>=1&&o<=3) baeume++; }
  for(const r of g.roads.values()) wege++;
  return {t:g.t,
    fertig:zaehl(b=>b.player===0&&b.state==='done'),
    bau:zaehl(b=>b.player===0&&b.state==='build'),
    siedler:g.settlerStats(0).total, soldaten:g.soldierCount(0),
    einheiten:g.units.length, wege, felder, baeume, tiere:g.animals.length,
    warenSumme:Object.values(inv).reduce((a,b)=>a+b,0),
    brot:inv.bread||0, bretter:inv.board||0, getreide:inv.grain||0,
    gebiet:(()=>{ let n=0; for(let i=0;i<m.owner.length;i++) if(m.owner[i]===1) n++; return n; })(),
    fahnenWaren:[...g.flagItems.values()].reduce((a,x)=>a+x.length,0),
  };
})()`;

// 20 Spielminuten vorspulen, dann speichern
const vorher=await page.evaluate(`(async()=>{
  const g=window.__ui.game;
  g.players[0].ai=true; g.players[0].aiLevel=2;
  for(let t=0;t<${MIN}*600;t++) g.step();
  const S=await import('./js/save.js');
  window.__S=S;
  const k=${kennzahlen};
  let ok=false, fehler=null;
  try{ ok=S.saveSlot('1', g, 'Pruefstand'); }catch(e){ fehler=String(e).slice(0,160); }
  return {k, ok, fehler, slots:S.listSlots().filter(s=>s.meta).map(s=>s.slot)};
})()`);
console.log('vor dem Speichern :', JSON.stringify(vorher.k));
console.log('gespeichert:', vorher.ok, vorher.fehler||'', ' belegte Plaetze:', JSON.stringify(vorher.slots));
if(!vorher.ok){ console.log('ABBRUCH: Speichern schlug fehl'); await br.close(); process.exit(1); }

// Seite komplett neu laden (wie nach dem Wegwischen der App), dann laden
await page.reload({waitUntil:'load'});
await page.evaluate(()=>{
  const ui=window.__ui;
  if(ui && !ui.__messRiegel){ ui.__messRiegel=true;
    Object.defineProperty(ui,'paused',{configurable:true,get(){return true;},set(){}}); }
});
const nachher=await page.evaluate(`(async()=>{
  const S=await import('./js/save.js');
  const d=S.loadSlot('1');
  if(!d) return {fehler:'kein Spielstand im Platz 1'};
  let geladen=false, fehler=null;
  try{
    const ui=window.__ui;
    if(ui.resumeFromData){ ui.resumeFromData(d.data); geladen=true; }
    
    else if(window.Game && window.Game.load){ ui.game=window.Game.load(d.data); geladen=true; }
  }catch(e){ fehler=String(e).slice(0,200); }
  if(!geladen) return {fehler:fehler||'kein Ladeweg in der Bedienung gefunden',
    wege:Object.getOwnPropertyNames(Object.getPrototypeOf(window.__ui)).filter(n=>/lad|load/i.test(n))};
  const k=${kennzahlen};
  return {k};
})()`);
console.log('nach dem Laden    :', JSON.stringify(nachher.k||nachher));
if(!nachher.k){ console.log('ABBRUCH: Laden schlug fehl'); await br.close(); process.exit(1); }

const a=vorher.k, b=nachher.k;
const abw=[];
for(const s in a) if(a[s]!==b[s]) abw.push(`${s}: ${a[s]} -> ${b[s]}`);
console.log(abw.length? 'ABWEICHUNGEN: '+abw.join(', ') : 'identisch in allen '+Object.keys(a).length+' Kennzahlen');

// laeuft der geladene Stand auch WEITER?
const weiter=await page.evaluate(`(()=>{
  const g=window.__ui.game;
  g.players[0].ai=true; g.players[0].aiLevel=2;
  const vor=${kennzahlen};
  for(let t=0;t<5*600;t++) g.step();
  const nach=${kennzahlen};
  return {vorT:vor.t, nachT:nach.t, fertigVor:vor.fertig, fertigNach:nach.fertig,
    siedlerVor:vor.siedler, siedlerNach:nach.siedler, felderVor:vor.felder, felderNach:nach.felder};
})()`);
console.log('5 Minuten weitergespielt:', JSON.stringify(weiter));
console.log('Seitenfehler:', fehler.length? fehler.slice(0,3):'keine');
await br.close();

// Sonderpruefung: ueberlebt die Felduhr (v190) einen Ladevorgang? Sie steht
// als Menge im Spiel, nicht im Spielstand - nach dem Laden muss sie sich aus
// der Karte neu aufbauen, sonst reift kein Korn mehr.
