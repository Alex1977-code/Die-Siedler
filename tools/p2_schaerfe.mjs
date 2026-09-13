// Vergleicht die Backaufloesung S=1 gegen S=2 bei DPR 2 / Zoom 1:
// wie viel Schaerfe kostet S=1 wirklich? (Kantenenergie + Bilder)
import { chromium } from 'playwright';
const AUS='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await browser.newContext({viewport:{width:419,height:811},hasTouch:true,deviceScaleFactor:2});
const page=await ctx.newPage();
await page.goto('http://localhost:8901/',{waitUntil:'networkidle'});
await page.click('#bt-free');
await page.selectOption('#f-size','M'); await page.selectOption('#f-ais','0');
await page.fill('#f-seed','11'); await page.click('#f-start');
await page.waitForTimeout(2500);

async function lauf(S){
  const kante=await page.evaluate(async (S)=>{
    const ui=window.__ui, r=ui.renderer;
    ui.game.map.explored.fill(1);
    // Skala festnageln: draw() rechnet sie sonst jedes Bild neu aus
    try{ delete r._chunkScale; }catch(e){}
    let v=S; Object.defineProperty(r,'_chunkScale',{configurable:true,get:()=>v,set:()=>{}});
    for(const k of ['chunks','_chunks','chunkCache']) if(r[k]&&r[k].clear) r[k].clear();
    const hq=[...ui.game.buildings.values()].find(b=>b.type==='hq');
    const [x,y]=ui.game.map.worldPos(hq.node);
    ui.cam.x=x; ui.cam.y=y; ui.cam.z=1;
    for(let i=0;i<60;i++) await new Promise(r2=>requestAnimationFrame(r2));
    // Kantenenergie: mittlerer |Gradient| ueber einen Geländeausschnitt
    const cv=r.cv, g=cv.getContext('2d');
    const w=Math.min(600,cv.width), h=Math.min(600,cv.height);
    const ox=Math.floor((cv.width-w)/2), oy=Math.floor((cv.height-h)/2);
    const d=g.getImageData(ox,oy,w,h).data;
    let sum=0,n=0;
    for(let y2=1;y2<h-1;y2++) for(let x2=1;x2<w-1;x2++){
      const i=(y2*w+x2)*4;
      const l=(a)=>d[a]*0.3+d[a+1]*0.59+d[a+2]*0.11;
      const gx=l(i+4)-l(i-4), gy=l(i+w*4)-l(i-w*4);
      sum+=Math.abs(gx)+Math.abs(gy); n++;
    }
    return { kante:+(sum/n).toFixed(3), chunks:(r.chunks&&r.chunks.size)||0 };
  }, S);
  await page.screenshot({path:`${AUS}/skala${S}.png`});
  return kante;
}
const a=await lauf(1);
const b=await lauf(2);
console.log(JSON.stringify({skala1:a,skala2:b,verhaeltnis:+(a.kante/b.kante).toFixed(3)}));
await browser.close();
