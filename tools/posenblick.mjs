// POSENBLICK: eine Arbeitsbewegung ansehen, ohne Blaetter zu schreiben.
//
// Der Backtreiber kann --preview, schreibt aber drei Richtungen
// uebereinander und legt die Datei ins Wurzelverzeichnis. Beim Nachziehen
// einer Pose will man EINE Richtung, gross, und schnell hintereinander.
//
//   node tools/posenblick.mjs <modell> [richtung r|fr|f|b] [set atk]
import { chromium } from 'playwright';
import fs from 'fs';
import { POSEN, atkPose, keyPose } from './posen.js';
const modell=process.argv[2];
const richt=process.argv[3]||'r';
const set=process.argv[4]||'atk';
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
if(P.entfernen && P.entfernen.length){
  await page.evaluate((ids)=>window.splitIslands(ids),P.entfernen);
  await page.evaluate('window.toolDiscard()');
}
if(P.koerper) await page.evaluate((k)=>window.koerper(k),P.koerper);
await page.evaluate('window.toolClear()');
const w=P.werkzeug && P.werkzeug[set];
for(const t of (w? (Array.isArray(w)?w:[w]) : []))
  await page.evaluate(([k,b,p,r,s])=>window.toolAttach(k,b,p,r,s),[t.kind,t.bone,t.pos,t.rot,t.scale]);
await page.evaluate(()=>window.toolVis(true));
const YAW={r:91,fr:46,f:1,br:136,b:181}[richt];
const atkT = idle===walk ? walk.duration*0.27 : 0;
const N=8, bilder=[];
for(let k=0;k<N;k++){
  const pose = set==='atk' ? atkPose(P.atk,k) : keyPose(P[set],k,N,true);
  bilder.push(await page.evaluate(([c,t,y,p])=>window.bake(c,t,y,260,null,null,p),[idle.name,atkT,YAW,pose]));
}
const ziel='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/';
fs.mkdirSync(ziel,{recursive:true});
bilder.forEach((png,k)=>fs.writeFileSync(`${ziel}pb_${modell}_${k}.png`, Buffer.from(png.split(',')[1],'base64')));
console.log('pb_'+modell+'_0..7.png geschrieben ('+richt+', '+set+')');
await br.close();
