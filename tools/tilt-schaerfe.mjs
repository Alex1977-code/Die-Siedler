// Schaerfeverteilung ueber die Bildhoehe: wie stark und wie breit macht der
// Tilt-Shift (Weichzeichner am Bildrand) das Bild oben/unten unscharf?
// Misst zeilenweise Kantenenergie mit Effekt AN vs AUS bei Handy-Hochformat.
import { chromium } from 'playwright';
const AUS='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});
const page=await ctx.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:8901/',{waitUntil:'networkidle'});
await page.click('#bt-free');
await page.selectOption('#f-size','M'); await page.selectOption('#f-ais','0');
await page.fill('#f-seed','11'); await page.click('#f-start');
await page.waitForTimeout(2500);

// Kamera auf die HQ-Umgebung, Karte aufgedeckt, Spiel pausiert (stabile Bilder)
await page.evaluate(()=>{
  const ui=window.__ui, g=ui.game;
  g.map.explored.fill(1); ui.paused=true;
  const hq=[...g.buildings.values()].find(b=>b.type==='hq');
  const [x,y]=g.map.worldPos(hq.node);
  ui.cam.x=x; ui.cam.y=y-140; // Massiv/Umland Richtung oberer Bildrand
});

async function profil(tiltAus, zoom){
  return await page.evaluate(async ({tiltAus, zoom})=>{
    const ui=window.__ui, r=ui.renderer;
    r.tiltAus=tiltAus; ui.cam.z=zoom;
    for(let i=0;i<25;i++) await new Promise(r2=>requestAnimationFrame(r2));
    const cv=r.cv, g=cv.getContext('2d');
    const W=cv.width, H=cv.height;
    const d=g.getImageData(0,0,W,H).data;
    const B=40;                       // 40 Hoehenbaender
    const bh=Math.floor(H/B);
    const werte=[];
    for(let b=0;b<B;b++){
      let sum=0,n=0;
      const y0=b*bh+1, y1=Math.min((b+1)*bh, H-1);
      for(let y=y0;y<y1;y+=2) for(let x=4;x<W-4;x+=2){
        const i=(y*W+x)*4;
        const l=(a)=>d[a]*0.3+d[a+1]*0.59+d[a+2]*0.11;
        sum+=Math.abs(l(i+8)-l(i-8))+Math.abs(l(i+W*4)-l(i-W*4)); n++;
      }
      werte.push(+(sum/n).toFixed(2));
    }
    return werte;
  }, {tiltAus, zoom});
}

for(const zoom of [1.0, 2.0]){
  const an =await profil(false, zoom);
  await page.screenshot({path:`${AUS}/tilt_an_z${zoom}.png`});
  const aus=await profil(true, zoom);
  await page.screenshot({path:`${AUS}/tilt_aus_z${zoom}.png`});
  console.log(`\n== Zoom ${zoom} == Band | Kantenenergie AN / AUS | Anteil erhalten`);
  an.forEach((v,i)=>{
    const q=aus[i]>0? v/aus[i] : 1;
    const pos=((i+0.5)/an.length*100).toFixed(0);
    console.log(`${String(pos).padStart(3)}% ${String(v).padStart(7)} ${String(aus[i]).padStart(7)}  ${(q*100).toFixed(0)}%${q<0.85?'  <== unscharf':''}`);
  });
}
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
