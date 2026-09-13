// BARTPROBE: wo sitzt der Bart wirklich?
//
// Beim Bauarbeiter schwebt er frei neben dem Gesicht (Belegbild
// builder_zoom.png) - in der Frontsicht liegt er auf den Wangen, in der
// Seitensicht steht er in der Luft. Ein starres Kind des Kopfknochens
// kann das nur, wenn der Versatz in die falsche Richtung zeigt. Statt zu
// raten wird der Versatz abgetastet: mehrere Werte, jeder in allen fuenf
// Richtungen, nebeneinander.
//
//   node tools/bartprobe.mjs <modell>
import { chromium } from 'playwright';
import fs from 'fs';
import { POSEN, atkPose } from './posen.js';
const modell=process.argv[2]||'builder';
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
if(P.koerper) await page.evaluate((k)=>window.koerper(k),P.koerper);
const atkT = idle===walk ? walk.duration*0.27 : 0;
const pose=P.atk? atkPose(P.atk,3) : null;
// Kandidaten: Versatz in Kopf-lokalem z (Gesicht) und y (Hoehe), Kippung
const KAND=[
  {pos:[0,-0.12,-0.23], rot:45, s:2.2, lab:'Standard'},
  {pos:[0,-0.12,-0.10], rot:45, s:2.2, lab:'z-0.10'},
  {pos:[0,-0.10,-0.02], rot:45, s:2.2, lab:'z-0.02'},
  {pos:[0,-0.14, 0.06], rot:45, s:2.2, lab:'z+0.06'},
  {pos:[0,-0.14, 0.06], rot:20, s:2.2, lab:'z+0.06 rx20'},
  {pos:[0,-0.18, 0.02], rot:0,  s:2.2, lab:'z+0.02 rx0'},
];
const RICHT=[['r',91],['fr',46],['f',1],['b',181]];
const zeilen=[];
for(const k of KAND){
  await page.evaluate('window.toolClear()');
  await page.evaluate(([p,r,s])=>window.toolAttach('bart','Head',p,[r,0,0],s),[k.pos,k.rot,k.s]);
  await page.evaluate(()=>window.toolVis(true));
  const reihe=[];
  for(const [,yaw] of RICHT)
    reihe.push(await page.evaluate(([c,t,y,p])=>window.bake(c,t,y,220,null,null,p),[idle.name,atkT,yaw,pose]));
  zeilen.push({lab:k.lab, reihe});
}
const ziel='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/bart-'+modell;
fs.mkdirSync(ziel,{recursive:true});
zeilen.forEach((z,i)=>z.reihe.forEach((png,j)=>
  fs.writeFileSync(`${ziel}/${i}_${RICHT[j][0]}.png`, Buffer.from(png.split(',')[1],'base64'))));
fs.writeFileSync(ziel+'/labels.json', JSON.stringify({KAND:KAND.map(k=>k.lab), RICHT:RICHT.map(r=>r[0])}));
console.log('Proben in', ziel, KAND.map((k,i)=>i+'='+k.lab).join('  '));
await br.close();
