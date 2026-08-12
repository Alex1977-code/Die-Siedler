// KD5: Groessenvorschau, Schilder-Verfall, freie Spielziele.
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';

const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));

// ---- 1+2: Groessenvorschau + Schilder-Verfall im laufenden Spiel
const t0=await starteSpiel(page, {saat:42, groesse:'S', gegner:'0'});
if(t0!==0) throw new Error('Start nicht bei Takt 0');
const a=await page.evaluate(async ()=>{
  const ui=window.__ui, g=ui.game, m=g.map, r=ui.renderer;
  const out={};
  // Groessenvorschau: ueber eigene Knoten sammeln
  const feld={L:0,M:0,S:0,null:0};
  for(let i=0;i<m.owner.length;i++){
    if(m.owner[i]!==0 || m.bld[i]>=0 || m.flag[i] || (m.obj[i]&127)!==0) continue;
    if(!m.terrOkBuild(i)) continue;
    const s=r.bauGroesseAt(i);
    feld[s===null?'null':s]++;
  }
  out.groessen=feld;
  // Punktemodus einmal rendern (Fehlerfang)
  ui.state.showBuildDots=true;
  for(let k=0;k<12;k++) await new Promise(res=>requestAnimationFrame(res));
  ui.state.showBuildDots=false;
  // Schilder-Verfall: ein ∅- und ein Erz-Schild setzen, 4 Spielminuten laufen
  let berg=-1;
  for(let i=0;i<m.terr.length;i++) if(m.terr[i]===3){ berg=i; break; }
  g.signs.set(berg, 0); g.signs.set(berg+1, 2);
  for(let k=0;k<2400;k++) g.step();
  out.leerWeg=!g.signs.has(berg);
  out.erzBleibt=g.signs.has(berg+1);
  return out;
});

// ---- 3: freies Spielziel "Grossmacht" waehlbar
await page.goto('http://localhost:8901/',{waitUntil:'networkidle'});
await page.click('#bt-free');
await page.selectOption('#f-size','S'); await page.selectOption('#f-ais','1');
await page.selectOption('#f-ziel','land');
await page.fill('#f-seed','7'); await page.click('#f-start');
await page.waitForTimeout(1800);
const b=await page.evaluate(()=>{
  const g=window.__ui.game;
  window.__ui.updateHud();
  const chip=document.getElementById('obj-chip');
  return { ziel:g.objectives[0]?.type, count:g.objectives[0]?.count,
           chip: chip && !chip.classList.contains('hidden') ? chip.textContent : null };
});
const out={...a, frei:b};
console.log(JSON.stringify(out,null,1));
const ok= a.groessen.L>0 && a.groessen.M>0 && a.leerWeg===true && a.erzBleibt===true
  && b.ziel==='territory' && b.count===1500 && !!b.chip && /1500/.test(b.chip);
console.log(ok? 'KD5 OK':'KD5 FEHLER');
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
process.exit(ok&&!errors.length?0:1);
