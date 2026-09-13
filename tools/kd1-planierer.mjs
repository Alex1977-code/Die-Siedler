// KD1: Wo genau haengen die KI-Planierer auf dem Hinweg? Positions-Sampling.
// Aufruf: node tools/kd1-planierer.mjs [saat] [minuten]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';

const SAAT=Number(process.argv[2]||3001), MIN=Number(process.argv[3]||35);
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const t0=await starteSpiel(page, {saat:SAAT, groesse:'M', gegner:'1'});
if(t0!==0) throw new Error('Start nicht bei Takt 0');

const d=await page.evaluate((MIN)=>{
  const g=window.__ui.game, m=g.map;
  const ki=g.players.find(p=>p.ai);
  const spur={};                    // unitId -> Samples
  for(let i=0;i<MIN*600;i++){
    g.step();
    if(g.t%100!==0) continue;
    for(const u of g.units){
      if(u.dead || u.player!==ki.id || u.type!=='leveler') continue;
      const b=g.buildings.get(u.bld);
      (spur[u.id]=spur[u.id]||[]).push({
        t:g.t, x:+u.x.toFixed(0), y:+u.y.toFixed(0), st:u.state,
        wpi:u.wpi||0, wpn:u.wp? u.wp.length:0, stall:u.stallT||0,
        det:!!u._det, ziel:b? b.node:-1 });
    }
  }
  // Zusammenfassen: je Planierer Start, Ende, Bewegungssumme in toSite
  const aus=[];
  for(const [id,s] of Object.entries(spur)){
    const toSite=s.filter(x=>x.st==='toSite');
    if(toSite.length<3) { aus.push({id, kurz:true, n:s.length}); continue; }
    let weg=0;
    for(let k=1;k<toSite.length;k++) weg+=Math.hypot(toSite[k].x-toSite[k-1].x, toSite[k].y-toSite[k-1].y);
    const a=toSite[0], z=toSite[toSite.length-1];
    aus.push({ id, dauer:toSite.length*10, weg:+weg.toFixed(0),
      von:[a.x,a.y], nach:[z.x,z.y], wpi:`${a.wpi}->${z.wpi}/${z.wpn}`,
      detAnteil:+(toSite.filter(x=>x.det).length/toSite.length).toFixed(2),
      letzte5: toSite.slice(-5).map(x=>`${x.x},${x.y}(wp${x.wpi})`) });
  }
  return aus;
}, MIN);
for(const x of d){
  if(x.kurz){ console.log(`#${x.id} kurz (${x.n} Samples)`); continue; }
  console.log(`#${x.id} toSite ${x.dauer}s, Strecke ${x.weg}px, wp ${x.wpi}, det ${x.detAnteil}`);
  console.log(`   ${x.von} -> ${x.nach}   Ende: ${x.letzte5.join(' ')}`);
}
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
