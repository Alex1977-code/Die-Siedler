import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
await page.goto('http://localhost:8901/',{waitUntil:'networkidle'});
await page.click('#bt-free');
await page.selectOption('#f-size','M'); await page.selectOption('#f-ais','0');
await page.fill('#f-seed','11'); await page.click('#f-start');
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const ui=window.__ui,g=ui.game,m=g.map;
  m.explored.fill(1);
  const hq=[...g.buildings.values()].find(b=>b.type==='hq');
  let farm=null;
  for(const nd of g.nodesInRange(hq.node,7)) if(g.canBuild(0,'farm',nd).ok){ farm=g.spawnBuilding(0,'farm',nd,true); break; }
  if(!farm) return {fehler:'kein Platz fuer den Bauernhof'};
  // 30 mal saeen lassen und schauen, wo die Felder landen
  const nodes=g.nodesWalkable(farm.node, 6);
  const gesaet=[];
  for(let k=0;k<30;k++){
    const z=g.ackerZiel(farm, nodes);
    if(z===undefined) break;
    m.obj[z]=5;                       // OBJ.FIELD0
    gesaet.push(z);
  }
  // Zusammenhang pruefen: wieviele getrennte Gruppen, wie gross
  const feld=new Set(gesaet);
  const gesehen=new Set(); const grp=[];
  for(const n of feld){
    if(gesehen.has(n)) continue;
    const st=[n]; gesehen.add(n); let c=0;
    while(st.length){ const x=st.pop(); c++;
      for(const q of m.nbs(x)) if(feld.has(q)&&!gesehen.has(q)){ gesehen.add(q); st.push(q); } }
    grp.push(c);
  }
  // Reifegrade mischen, damit das Bild alle Stufen zeigt
  gesaet.forEach((n,ix)=> m.obj[n]= ix%3===0?5 : ix%3===1?6 : 7);
  const [x,y]=m.worldPos(farm.node); ui.cam.x=x; ui.cam.y=y+10; ui.cam.z=2.2;
  ui.renderer.chunks.clear();
  return {gesaet:gesaet.length, flaechen:grp.sort((a,b)=>b-a), aecker:farm.aecker.map(a=>a.length)};
})));
await page.waitForTimeout(1200);
await page.screenshot({path:'acker.png'});
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
