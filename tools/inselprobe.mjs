// INSELPROBE: welche Mesh-Insel eines GLB ist das eingebaute Werkzeug?
//
// Die Tripo-Modelle bringen ihr Werkzeug als Teil des EINEN SkinnedMesh
// mit. Es ist meist schlecht geskinnt (an Hand UND Fuss, oder nur an der
// Oberarmkette) und zerreisst oder schwebt bei jeder Pose - beim
// Bauarbeiter haengt es frei neben der Figur in der Luft. Der Ausweg ist
// immer derselbe: Insel raus (posen.js 'entfernen'), prozedurales
// Werkzeug in die Faust (posen.js 'werkzeug').
//
// Dieses Werkzeug listet die Inseln mit Groesse, Ausdehnung und den
// staerksten Knochen und rendert jede EINZELN als Miniatur, damit man
// sieht statt raet.
//
//   node tools/inselprobe.mjs <modell> [anzahl]
import { chromium } from 'playwright';
import fs from 'fs';
const modell=process.argv[2], N=+(process.argv[3]||14);
const CHROME=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const br=await chromium.launch({executablePath:CHROME,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await br.newPage({viewport:{width:500,height:520}});
page.on('pageerror',e=>console.log('PAGEERR',e.message));
await page.goto(`http://localhost:8901/tools/bake-sprites.html?m=${modell}&x=${Math.random()}`,{timeout:30000});
await page.waitForFunction('window.__ready===true || window.__err',{timeout:90000});
const clips=await page.evaluate('window.info()');
const walk=clips.find(c=>c.duration>=2.2&&c.duration<=2.7)||clips.find(c=>c.duration>=1.7&&c.duration<=2.1)||clips[0];
await page.evaluate((n)=>window.setFrame(n),walk.name);
const ins=await page.evaluate('window.islands()');
console.log(modell, '-', ins.length, 'Inseln');
const zeig=ins.slice(0,N);
for(const s of zeig){
  const d=[0,1,2].map(k=>(s.max[k]-s.min[k]).toFixed(2)).join('x');
  console.log('  id=%s verts=%d tris=%d  %s  %s', String(s.id).padEnd(6), s.verts, s.tris, d.padEnd(16), s.bones.slice(0,3).join(' '));
}
// jede Insel einzeln rendern
const bilder=[];
for(const s of zeig){
  await page.evaluate((id)=>window.isolate([id]),s.id);
  const png=await page.evaluate(([c,t,y])=>window.bake(c,t,y,200),[walk.name,0,90]);
  bilder.push({id:s.id, png});
}
await page.evaluate(()=>window.isolate(null));
const ziel='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/inseln-'+modell;
fs.mkdirSync(ziel,{recursive:true});
for(const b of bilder)
  fs.writeFileSync(`${ziel}/${b.id}.png`, Buffer.from(b.png.split(',')[1],'base64'));
console.log('Miniaturen in', ziel);
await br.close();
