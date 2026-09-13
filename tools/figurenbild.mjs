// FIGURENBILD: Figuren im Spiel, mit und ohne Weltpalette, gleiche Stelle.
//
// palAus schaltet die Tonung ab (derselbe Schalter, den palBld() fuer die
// Gebaeude nutzt) - so entstehen zwei Bilder derselben Szene, die sich nur
// in der Palette unterscheiden.
//
//   node tools/figurenbild.mjs [port]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const page=await br.newPage({viewport:{width:900,height:640}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:11, groesse:'M', gegner:'0'});
const wo=await page.evaluate(()=>{
  const g=window.__ui.game, m=g.map;
  const hq=g.buildings.get(g.players[0].hq);
  hq.inv=hq.inv||{}; hq.inv.board=90; hq.inv.stone=90;
  const bfs=(von,nach)=>{ const vor=new Map([[von,-1]]); const q=[von];
    while(q.length){ const k=q.shift(); if(k===nach) break;
      for(const nb of m.nbs(k)){ if(vor.has(nb)) continue;
        if(!m.terrOkBuild(nb) && nb!==nach) continue; vor.set(nb,k); q.push(nb); } }
    if(!vor.has(nach)) return null;
    const p=[]; let k=nach; while(k!==-1){ p.unshift(k); k=vor.get(k); } return p; };
  for(const typ of ['woodcutter','quarry','fisher','forester']){
    let b=null;
    for(let r=3;r<=30 && !b;r++) for(const n of g.nodesInRange(hq.node,r)){
      if(!g.canBuild(0,typ,n).ok) continue;
      const rr=g.placeBuilding(0,typ,n); if(rr.ok){ b=rr.b; break; } }
    if(!b) continue;
    const p=bfs(hq.door,b.door);
    if(p) for(let i=0;i+2<p.length;i+=2) g.buildRoad(0,[p[i],p[i+1],p[i+2]]);
    b.state='done'; b.leveled=true; b.bauerDa=true; b.progress=1e9; b.stock={};
    if(b.worker){ b.worker.present=true; b.worker.state='in'; b.worker.timer=0; }
    g.changedNodes.push(b.node);
  }
  for(let t=0;t<2500;t++) g.step();
  const [x,y]=m.worldPos(hq.node);
  window.__ui.cam.x=x; window.__ui.cam.y=y+40; window.__ui.cam.z=2.2;
  return {figuren:g.units.length, strassen:g.roads.size};
});
console.log(JSON.stringify(wo));
const Z='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/';
for(const [name,aus] of [['mit',false],['ohne',true]]){
  await page.evaluate((a)=>{ const r=window.__ui.renderer; r.palAus=a; r._palF&&r._palF.clear(); r._palB&&r._palB.clear(); }, aus);
  await page.waitForTimeout(1800);
  await page.screenshot({path:Z+'fig_'+name+'.png'});
}
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,3));
await br.close();
