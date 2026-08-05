import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:419,height:811},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
await page.goto('http://localhost:8901/',{waitUntil:'networkidle'});
await page.click('#bt-free');
await page.selectOption('#f-size','S'); await page.selectOption('#f-ais','0');
await page.fill('#f-seed','11'); await page.click('#f-start');
await page.waitForTimeout(2200);
console.log(JSON.stringify(await page.evaluate(async ()=>{
  const ui=window.__ui,g=ui.game,m=g.map;
  m.explored.fill(1);
  const hq=[...g.buildings.values()].find(b=>b.type==='hq');
  const out={};
  // 1) Gebaeude bauen -> Wegebau-Modus mit Schwebeknoepfen, kein Sheet
  const nd=g.nodesInRange(hq.node,5).find(n=>g.canBuild(0,'woodcutter',n).ok);
  ui.state.mode='place'; ui.state.placeType='woodcutter'; ui.state.placeAt=nd;
  ui.confirmPlace();
  await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
  out.modus=ui.state.mode;
  out.sheetOffen=!!document.querySelector('.sheet.open');
  out.knoepfe=!!ui.renderer._roadBtn;
  // 2) Haken -> automatisch verbunden
  const bt=ui.renderer._roadBtn;
  if(bt){ ui.onTap(bt.ok[0], bt.ok[1]); }
  out.wege=g.roads.size;
  out.modusDanach=ui.state.mode;
  // 3) einsame Fahne (Geologe) DARF kein Ziel sein
  const fern=g.nodesInRange(hq.node,7).find(n=>g.canPlaceFlag(n,0) && !g.roadAt(n));
  g.placeFlag(fern,0);
  const b2n=g.nodesInRange(hq.node,5).filter(n=>g.canBuild(0,'quarry',n).ok)[0];
  ui.state.mode='place'; ui.state.placeType='quarry'; ui.state.placeAt=b2n;
  ui.confirmPlace();
  await new Promise(r=>requestAnimationFrame(r));
  const bt2=ui.renderer._roadBtn;
  if(bt2) ui.onTap(bt2.ok[0], bt2.ok[1]);
  // an welche Ziele wurde verbunden? einsame Fahne darf in keinem Weg auftauchen
  let anEinsam=false;
  for(const r of g.roads.values()) if(r.path.includes(fern)) anEinsam=true;
  out.einsameFahneVerbunden=anEinsam;
  out.wegeGesamt=g.roads.size;
  return out;
})));
await page.screenshot({path:'roadfloat.png'});
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
