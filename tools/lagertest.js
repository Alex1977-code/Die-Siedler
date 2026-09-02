import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:419,height:811},hasTouch:true});
const errors=[]; p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://localhost:8901/',{waitUntil:'networkidle'});
await p.click('#bt-free');
await p.selectOption('#f-size','S'); await p.fill('#f-seed','3'); await p.click('#f-start');
await p.waitForTimeout(1500);
await p.evaluate(()=>window.__ui.openStockSheet());
await p.waitForTimeout(300);
console.log(JSON.stringify(await p.evaluate(()=>{
  const ui=window.__ui;
  const nullen=[...document.querySelectorAll('.stock-it.zero')];
  const deck=nullen.map(e=>getComputedStyle(e).opacity);
  // eine Ware mit Bestand 0 anheften
  const leer=nullen.find(e=>!e.classList.contains('pinned'));
  const ware=leer && leer.dataset.good;
  if(leer) leer.click();
  return { nullWaren:nullen.length, deckkraft:[...new Set(deck)],
    angeheftet: ware ? (ui.opts.hudGoods||[]).includes(ware) : 'keine Nullware' , ware };
})));
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await b.close();
