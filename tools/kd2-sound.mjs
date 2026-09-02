// KD2-Sound: Verdrahtungstest. Prueft (headless, ohne Ohren):
//  - Regler existieren, steuern Sound.vols und die WebAudio-Gains
//  - Reglerwerte ueberleben einen Neustart (SAVE.setOptions)
//  - sfx mit Pan, march, ambienceMix und die Spielschleifen-Treiber
//    laufen ohne Fehler; Ambience-Gains reagieren auf die Umgebung
import { chromium } from 'playwright';
const browser=await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--autoplay-policy=no-user-gesture-required'],
});
const page=await browser.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:8901/',{waitUntil:'networkidle'});
const out={};

// 1) Optionen: Regler da? Musik-Pegel auf 30 ziehen
await page.click('#bt-options');
out.reglerDa=await page.evaluate(()=>['o-vol','o-vol-music','o-vol-sfx'].every(id=>!!document.getElementById(id)));
await page.evaluate(()=>{
  const s=document.getElementById('o-vol-music');
  s.value='30';
  s.dispatchEvent(new Event('input'));
  s.dispatchEvent(new Event('change'));
});
out.volsNachRegler=await page.evaluate(()=>({...window.__sound.vols}));

// 2) Neustart: Wert ueberlebt?
await page.reload({waitUntil:'networkidle'});
await page.click('#bt-options');
out.reglerNachNeustart=await page.evaluate(()=>document.getElementById('o-vol-music').value);
out.volsNachNeustart=await page.evaluate(()=>({...window.__sound.vols}));

// 3) Spiel starten, Sound entsperren, Treiber laufen lassen
await page.click('#scr-options [data-back]');
await page.click('#bt-free');
await page.selectOption('#f-size','S'); await page.selectOption('#f-ais','1');
await page.fill('#f-seed','7'); await page.click('#f-start');
await page.waitForTimeout(1500);
out.spiel=await page.evaluate(async ()=>{
  const S=window.__sound, ui=window.__ui, g=ui.game;
  S.unlock();
  if(!S.ctx) return {keinAudio:true};
  const r={};
  r.gainMusik=+S.musicGain.gain.value.toFixed(3);           // 0.34*0.3 erwartet
  S.setVol('sfx', 0.5);
  r.gainSfx=+S.sfxGain.gain.value.toFixed(3);               // 0.8*0.5 erwartet
  S.setVol('sfx', 1);
  // Pan + march + Ambience direkt anstossen
  S.sfx('hammer', 0.8, -0.7);
  S.sfx('march', 0.9, 0.6);
  S.ambienceMix({wasser:0.5, wald:0.4, fels:0.2});
  r.ambDa=!!S._amb;
  // Treiber der Spielschleife von Hand
  ui.klangKulisse();
  ui.marschTrommel();
  // Fuer die Zielpruefung den Schleifen-Treiber stilllegen (er wuerde alle
  // 2 s die ECHTE Kameraumgebung mischen und das Testziel ueberschreiben -
  // dass er das tut, ist der Beweis, dass er laeuft)
  const echt=ui.screen; ui.screen='messpause';
  S.ambienceMix({wasser:1, wald:0, fels:0});
  await new Promise(res=>setTimeout(res, 2500));
  r.wasserGainAn=+S._amb.wasser.gain.value.toFixed(4);
  S.ambienceMix({wasser:0, wald:0, fels:0});
  await new Promise(res=>setTimeout(res, 3000));
  r.wasserGainAus=+S._amb.wasser.gain.value.toFixed(4);
  ui.screen=echt;
  r.panApi=!!S.ctx.createStereoPanner;
  return r;
});
console.log(JSON.stringify(out,null,1));
const ok = out.reglerDa && out.volsNachRegler.music===0.3
  && out.reglerNachNeustart==='30' && out.volsNachNeustart.music===0.3
  && (out.spiel.keinAudio || (out.spiel.gainMusik===0.102 && out.spiel.gainSfx===0.4
      && out.spiel.ambDa && out.spiel.wasserGainAn>0.02 && out.spiel.wasserGainAus<0.01));
console.log(ok? 'KD2-SOUND OK' : 'KD2-SOUND FEHLER');
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
process.exit(ok&&!errors.length? 0:1);
