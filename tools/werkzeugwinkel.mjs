// WERKZEUGWINKEL: den Sitz eines prozeduralen Faust-Werkzeugs abtasten.
//
// toolAttach haengt das Werkzeug an einen Knochen und dreht es um drei
// Achsen. Welche Drehung "richtig" ist, haengt daran, wie die Faust im
// Grundclip des Modells steht - das ist je Modell anders und laesst sich
// nicht ausrechnen. Also abtasten: mehrere Winkel, jeder am Kontakt und
// zwei Nachbarspalten, nebeneinander.
//
//   node tools/werkzeugwinkel.mjs <modell> <kind> <scale> "rx,ry,rz;rx,ry,rz;..."
import { chromium } from 'playwright';
import fs from 'fs';
import { POSEN, atkPose } from './posen.js';
const [modell, kind, scale, liste]=process.argv.slice(2);
const WINKEL=liste.split(';').map(s=>s.split(',').map(Number));
const CHROME=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const br=await chromium.launch({executablePath:CHROME,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await br.newPage({viewport:{width:500,height:520}});
page.on('pageerror',e=>console.log('PAGEERR',e.message));
await page.goto(`http://localhost:8901/tools/bake-sprites.html?m=${modell}&x=${Math.random()}`,{timeout:30000});
await page.waitForFunction('window.__ready===true || window.__err',{timeout:90000});
const clips=await page.evaluate('window.info()');
const walk=clips.find(c=>c.duration>=2.2&&c.duration<=2.7)||clips.find(c=>c.duration>=1.7&&c.duration<=2.1)||clips[0];
const idle=clips.find(c=>c.duration>=4.5)||walk;
await page.evaluate((n)=>window.setFrame(n),walk.name);
const P=POSEN[modell]||{};
if(P.entfernen&&P.entfernen.length){ await page.evaluate((i)=>window.splitIslands(i),P.entfernen); await page.evaluate('window.toolDiscard()'); }
if(P.koerper) await page.evaluate((k)=>window.koerper(k),P.koerper);
const atkT = idle===walk ? walk.duration*0.27 : 0;
const SP=[0,2,4,6];
const ziel='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/ww-'+modell;
fs.mkdirSync(ziel,{recursive:true});
for(let i=0;i<WINKEL.length;i++){
  await page.evaluate('window.toolClear()');
  await page.evaluate(([k,r,s])=>window.toolAttach(k,'R_Hand',[0,0.02,0],r,s),[kind,WINKEL[i],+scale]);
  await page.evaluate(()=>window.toolVis(true));
  for(const k of SP){
    const png=await page.evaluate(([c,t,y,p])=>window.bake(c,t,y,240,null,null,p),[idle.name,atkT,91,atkPose(P.atk,k)]);
    fs.writeFileSync(`${ziel}/${i}_${k}.png`, Buffer.from(png.split(',')[1],'base64'));
  }
}
fs.writeFileSync(ziel+'/labels.json', JSON.stringify({W:WINKEL.map(w=>w.join(',')), SP}));
console.log('Proben in', ziel, WINKEL.map((w,i)=>i+'=['+w.join(',')+']').join('  '));
await br.close();
