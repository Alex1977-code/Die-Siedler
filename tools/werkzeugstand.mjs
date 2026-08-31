// WERKZEUGSTAND: welches Modell bringt sein Werkzeug selbst mit - und taugt es?
//
// Bevor man ein GLB nachbearbeitet, muss man wissen, was drin ist. Fuer
// jeden Beruf mit Arbeitsbewegung zwei Bilder am Kontakt: einmal NUR das
// Mesh (prozedurale Zugaben aus), einmal so, wie es heute gebacken wird.
// Daran sieht man in einem Blick, ob das Modell ein Werkzeug hat, ob es
// in der Hand sitzt - und ob daneben noch ein zweites liegt.
//
//   node tools/werkzeugstand.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import { POSEN, atkPose } from './posen.js';
const CHROME=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BERUFE=['leveler','builder','woodcutter','forester','fisher','farm','geo','miner','quarry','hunter'];
const br=await chromium.launch({executablePath:CHROME,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const ziel='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/ws/';
fs.mkdirSync(ziel,{recursive:true});
for(const m of BERUFE){
  const page=await br.newPage({viewport:{width:500,height:520}});
  page.on('pageerror',e=>console.log('PAGEERR',m,e.message));
  await page.goto(`http://localhost:8901/tools/bake-sprites.html?m=${m}&x=${Math.random()}`,{timeout:30000});
  await page.waitForFunction('window.__ready===true || window.__err',{timeout:90000});
  const clips=await page.evaluate('window.info()');
  const walk=clips.find(c=>c.duration>=2.2&&c.duration<=2.7)||clips.find(c=>c.duration>=1.7&&c.duration<=2.1)||clips[0];
  const idle=clips.find(c=>c.duration>=4.5)||walk;
  await page.evaluate((n)=>window.setFrame(n),walk.name);
  const P=POSEN[m]||{};
  if(P.koerper) await page.evaluate((k)=>window.koerper(k),P.koerper);
  const atkT = idle===walk ? walk.duration*0.27 : 0;
  const pose=P.atk? atkPose(P.atk,4) : null;
  // 1) ROH: Mesh vollstaendig, keine prozeduralen Zugaben
  let png=await page.evaluate(([c,t,y,p])=>window.bake(c,t,y,240,null,null,p),[idle.name,atkT,91,pose]);
  fs.writeFileSync(ziel+m+'_roh.png', Buffer.from(png.split(',')[1],'base64'));
  // 2) HEUTE: mit 'entfernen' und den prozeduralen Werkzeugen
  if(P.entfernen&&P.entfernen.length){
    await page.evaluate((i)=>window.splitIslands(i),P.entfernen);
    await page.evaluate('window.toolDiscard()');
  }
  const w=P.werkzeug && P.werkzeug.atk;
  for(const t of (w? (Array.isArray(w)?w:[w]) : []))
    await page.evaluate(([k,b,p2,r,s])=>window.toolAttach(k,b,p2,r,s),[t.kind,t.bone,t.pos,t.rot,t.scale]);
  await page.evaluate(()=>window.toolVis(true));
  png=await page.evaluate(([c,t,y,p])=>window.bake(c,t,y,240,null,null,p),[idle.name,atkT,91,pose]);
  fs.writeFileSync(ziel+m+'_heute.png', Buffer.from(png.split(',')[1],'base64'));
  console.log(m, P.entfernen? P.entfernen.length+' Inseln entfernt' : 'nichts entfernt',
              w? '+ '+(Array.isArray(w)?w:[w]).map(t=>t.kind).join(',') : 'kein Zusatz');
  await page.close();
}
await br.close();
