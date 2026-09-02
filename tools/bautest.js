import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await browser.newContext({viewport:{width:419,height:811},hasTouch:true,deviceScaleFactor:1});
const page=await ctx.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
await page.goto('http://localhost:8901/',{waitUntil:'networkidle'});
await page.click('#bt-free');
await page.selectOption('#f-size','M'); await page.selectOption('#f-ais','0');
await page.fill('#f-seed','11'); await page.click('#f-start');
await page.waitForTimeout(1800);
console.log(JSON.stringify(await page.evaluate(async ()=>{
  const ui=window.__ui,g=ui.game,m=g.map;
  m.explored.fill(1);
  const hq=[...g.buildings.values()].find(b=>b.type==='hq');
  const frei=g.nodesInRange(hq.node,4).filter(n=>g.canBuild(0,'barracks',n).ok);
  // Der zweite Platz muss WEIT genug weg liegen: Haken und Kreuz schweben
  // unter dem durchsichtigen Haus, und der Nachbarknoten fiel bisher mit 15
  // Weltpixeln genau in den Kreuz-Radius (15,4) - der Tipp brach dann ab,
  // statt die Vorschau zu versetzen.
  const nd=frei[0];
  const [nx,ny]=m.worldPos(nd);
  const nd2=frei.slice(1).find(n=>{ const [a,b]=m.worldPos(n); return Math.hypot(a-nx,b-ny)>70; });
  const [x,y]=m.worldPos(nd); ui.cam.x=x; ui.cam.y=y-40; ui.cam.z=1.7;
  const out={};
  const bild=()=>ui.renderer.draw(ui.cam, {...ui.state, placeType:ui.state.mode==='place'?ui.state.placeType:null}, 16);

  // 1) Auswahl -> kein Dialog, Knopf da
  ui.state.mode='place'; ui.state.placeType='barracks'; ui.state.placeAt=nd;
  await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
  out.dialogOffen=!!document.querySelector('.sheet.open');
  out.knopfDa=!!ui.renderer._placeBtn;

  // 2) Kreuz antippen -> abgebrochen
  const bt=ui.renderer._placeBtn;
  ui.onTap(bt.no[0], bt.no[1]);
  out.nachKreuz=ui.state.mode;

  // 3) Anderer Platz per Tipp -> Vorschau wandert, kein Dialog
  ui.state.mode='place'; ui.state.placeType='barracks'; ui.state.placeAt=nd;
  const [x2,y2]=m.worldPos(nd2);
  ui.onTap(x2,y2);
  out.platzGewechselt = (ui.state.placeAt===nd2);
  out.dialogNachWechsel=!!document.querySelector('.sheet.open');

  // 4) Ungueltiger Platz -> nur Kreuz
  ui.state.placeAt=nd2;
  await new Promise(r=>requestAnimationFrame(r)); await new Promise(r=>requestAnimationFrame(r));
  out.knopfPaar = ui.renderer._placeBtn && ui.renderer._placeBtn.ok ? 'Haken+Kreuz' : 'nur Kreuz';

  // 5) Haken -> gebaut
  const vor=g.buildings.size;
  const b2=ui.renderer._placeBtn;
  ui.onTap(b2.ok[0], b2.ok[1]);
  out.gebaut = g.buildings.size===vor+1;
  out.modusDanach = ui.state.mode;
  return out;
})));
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
