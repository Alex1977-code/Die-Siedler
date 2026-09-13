// ANIM-PROBE: Saegeblatt und Muehlenfluegel auf der neuen Lieferung ansehen.
//
// Beide Animationen haengen an im Sprite VERMESSENEN Anteilen (Radmitte,
// Radius, Nabe). Ob die Messung stimmt, entscheidet kein Zahlenwert,
// sondern das Bild: dreht sich das Rad um seine eigene Mitte, und sitzt
// das Fluegelkreuz auf der Kappe statt daneben? Darum vier Zeitpunkte je
// Bau - im Standbild sieht jede Fehlmessung gleich aus wie eine richtige.
//
//   node tools/anim-probe.mjs [port]
import { chromium } from 'playwright';
const PORT=+(process.argv[2]||8901);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const page=await br.newPage({viewport:{width:900,height:640}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/`, {waitUntil:'load'});
await page.evaluate(()=>{
  const ui=window.__ui;
  if(!ui || ui.__messRiegel) return;
  ui.__messRiegel=true;
  Object.defineProperty(ui,'paused',{configurable:true,get(){return true;},set(){}});
});
await page.click('#bt-free');
await page.selectOption('#f-size','M');
await page.selectOption('#f-ais','0');
await page.fill('#f-seed','11');
await page.click('#f-start',{noWaitAfter:true});
for(let k=0;k<40;k++){ await page.waitForTimeout(400);
  if(await page.evaluate(()=>!!(window.__ui&&window.__ui.game))) break; }

const info=await page.evaluate(()=>{
  const ui=window.__ui, g=ui.game;
  const hq=g.buildings.get(g.players[0].hq);
  const setze=(typ)=>{
    for(let r=2;r<=30;r++) for(const n of g.nodesInRange(hq.node,r)){
      if(!g.canBuild(0,typ,n).ok) continue;
      const rr=g.placeBuilding(0,typ,n); if(!rr.ok) continue;
      const b=rr.b;
      b.state='done'; b.leveled=true; b.bauerDa=true; b.progress=1e9; b.stock={};
      if(b.worker){ b.worker.present=true; b.worker.state='in'; b.worker.timer=0; }
      b.prodT=50; b.paused=false;
      g.changedNodes.push(b.node);
      return b;
    }
    return null;
  };
  const sw=setze('sawmill'), ml=setze('mill');
  const bild=(k)=>{ const a=ui.renderer.asset(k); return a? a.naturalWidth+'x'+a.naturalHeight : 'fehlt'; };
  return {sawmill:sw?sw.node:-1, mill:ml?ml.node:-1,
          bld_sawmill:bild('bld_sawmill'), bld_mill:bild('bld_mill'), obj_millsails:bild('obj_millsails')};
});
console.log(JSON.stringify(info));

for(const [name,knoten] of [['saege',info.sawmill],['muehle',info.mill]]){
  if(knoten<0){ console.log(name,'kein Bauplatz'); continue; }
  await page.evaluate(n=>{
    const ui=window.__ui, [x,y]=ui.game.map.worldPos(n);
    ui.cam.x=x; ui.cam.y=y-20; ui.cam.z=3.2;
  }, knoten);
  for(let f=0;f<4;f++){
    await page.evaluate(()=>{
      const ui=window.__ui;
      for(let k=0;k<70;k++){ ui.game.step(); ui.game.buildings.forEach(b=>{ if(b.prodT<=0) b.prodT=50; }); }
    });
    await page.waitForTimeout(700);
    await page.screenshot({path:`/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/anim_${name}_${f}.png`});
  }
}
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,4));
await br.close();
