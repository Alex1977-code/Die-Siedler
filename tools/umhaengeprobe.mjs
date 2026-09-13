// UMHAENGEPROBE: das gemalte Werkzeug in die Faust setzen und abtasten.
//
// umhaengen() legt das Griffende auf die Bindeposition der Faust und dreht
// das Werkzeug um diesen Punkt. Welche Drehung richtig ist, haengt an der
// Bindepose des Modells - also abtasten, nicht rechnen.
//
//   node tools/umhaengeprobe.mjs <modell> <greifer 0|1> "rx,ry,rz;..."
import { chromium } from 'playwright';
import fs from 'fs';
import { POSEN, atkPose } from './posen.js';
const [modell, greifer, liste]=process.argv.slice(2);
const WINKEL=liste.split(';').map(s=>s.split(',').map(Number));
const CHROME=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const br=await chromium.launch({executablePath:CHROME,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const P=POSEN[modell]||{};
const ziel='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/uh-'+modell;
fs.mkdirSync(ziel,{recursive:true});
const SP=[0,2,4,6];
for(let i=0;i<WINKEL.length;i++){
  const page=await br.newPage({viewport:{width:500,height:520}});
  page.on('pageerror',e=>console.log('PAGEERR',e.message));
  await page.goto(`http://localhost:8901/tools/bake-sprites.html?m=${modell}&x=${Math.random()}`,{timeout:30000});
  await page.waitForFunction('window.__ready===true || window.__err',{timeout:90000});
  const clips=await page.evaluate('window.info()');
  const walk=clips.find(c=>c.duration>=2.2&&c.duration<=2.7)||clips.find(c=>c.duration>=1.7&&c.duration<=2.1)||clips[0];
  const idle=clips.find(c=>c.duration>=4.5)||walk;
  await page.evaluate((n)=>window.setFrame(n),walk.name);
  const r=await page.evaluate(([ids,b,o])=>window.umhaengen(ids,b,o),
    [P.entfernen, 'R_Hand', {greifer:+greifer, rot:WINKEL[i]}]);
  if(i===0) console.log('umhaengen:', r);
  if(P.koerper) await page.evaluate((k)=>window.koerper(k),P.koerper);
  const atkT = idle===walk ? walk.duration*0.27 : 0;
  for(const k of SP){
    const png=await page.evaluate(([c,t,y,p])=>window.bake(c,t,y,240,null,null,p),[idle.name,atkT,91,atkPose(P.atk,k)]);
    fs.writeFileSync(`${ziel}/${i}_${k}.png`, Buffer.from(png.split(',')[1],'base64'));
  }
  await page.close();
}
fs.writeFileSync(ziel+'/labels.json', JSON.stringify({W:WINKEL.map(w=>w.join(',')), SP}));
console.log('Proben in', ziel);
await br.close();
