// WERKZEUGINSELN: die eingebauten Werkzeuge eines Tripo-Modells finden.
//
// Sie sind ueber hunderte winziger Inseln verstreut, einzeln ansehen
// bringt nichts. Sie fallen aber RAEUMLICH auf: die Figur ist ein
// zusammenhaengender Klumpen um die Hueftachse, das Werkzeug haengt
// daneben oder davor in der Luft. Gemessen wird am GESKINNTEN Ort in der
// Arbeitspose - genau dem, den man im Bild sieht.
//
// Verfahren: Koerperachse aus dem Skelett (Hip..Head), dann je Insel der
// waagerechte Abstand ihres Schwerpunkts zu dieser Achse. Der Koerper
// bleibt innerhalb einer Schwelle, das Werkzeug liegt darueber. Die
// Schwelle wird nicht geraten, sondern aus der Verteilung selbst
// genommen: sortiert man die Abstaende, liegt zwischen Koerper und
// Werkzeug eine sichtbare Luecke.
//
//   node tools/werkzeuginseln.mjs <modell> [--pose atk] [--schwelle 0.22]
import { chromium } from 'playwright';
import fs from 'fs';
import { POSEN, atkPose } from './posen.js';
const modell=process.argv[2];
const schwelleArg=process.argv.includes('--schwelle')? +process.argv[process.argv.indexOf('--schwelle')+1] : null;
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
// GENAU DIE REIHENFOLGE DES BACKTREIBERS. Der Koerperbau (Asterix-
// Silhouetten) skaliert Knochen - und eine Knochenskalierung verschiebt
// alles, was ueber diese Knochen geskinnt ist. Das eingebaute Werkzeug
// haengt an einer Mischung aus Hand-, Unterarm- und Rumpfknochen; unter
// der Skalierung wandert es aus der Faust heraus und steht frei in der
// Luft (Bauarbeiter, Belegbild builder_zoom.png). Ohne diesen Schritt
// misst die Probe eine Lage, die es im Blatt gar nicht gibt.
if(P.koerper) await page.evaluate((k)=>window.koerper(k),P.koerper);
// Arbeitspose am Kontakt (Spalte 4) - dort steht das Werkzeug am weitesten
// vom Koerper weg, wenn es falsch haengt.
const pose=P.atk? atkPose(P.atk,3) : null;
const atkT = idle===walk ? walk.duration*0.27 : 0;
await page.evaluate(([c,t,y,p])=>window.center(c,t,y,p),[idle.name,atkT,90,pose]);
const orte=await page.evaluate('window.inselOrte()');
const bindInseln=await page.evaluate('window.islands()');
// MASSSTAB: wie weit sitzt eine Insel von IHREM EIGENEN Hauptknochen weg?
//
// Der erste Versuch mass den Abstand zur Koerperachse - der scheitert am
// ausgestreckten Arm: beim Holzfaeller lagen Unterarm und Hand genauso
// weit draussen wie die Axt, und die Auswahl nahm 21 % des Modells mit
// (Belegbild wz_wc_vgl.png: "nur" zeigt den halben Arm).
//
// Ein Koerperteil sitzt IMMER dicht an dem Knochen, der es traegt - dafuer
// ist es geskinnt. Ein eingebautes Werkzeug ist an irgendeinen Knochen
// GEHAENGT und ragt von ihm weg: Stiel und Blatt liegen 0,2 bis 0,4
// entfernt, waehrend Handgeometrie unter 0,1 bleibt. Das trennt sauber,
// egal wie weit der Arm gerade ausgestreckt ist.
const domBone=new Map();
for(const b of bindInseln){
  const t=(b.bones[0]||'').split(':')[0];
  if(t) domBone.set(b.id, t);
}
const bonePos=new Map();
for(const n of new Set(domBone.values())){
  const p2=await page.evaluate((x)=>{ try{ return window.bonePos(x); }catch(_){ return null; } }, n);
  if(p2) bonePos.set(n, p2);
}
const gesamt=orte.reduce((a,o)=>a+o.verts,0);
const mit=orte.map(o=>{
  const bn=domBone.get(o.id), bp=bn? bonePos.get(bn) : null;
  const d = bp? Math.hypot(o.c[0]-bp.x, o.c[1]-bp.y, o.c[2]-bp.z) : 0;
  return {...o, bone:bn||'?', d};
}).sort((a,b)=>b.d-a.d);
let luecke=0, wo=1;
for(let k=1;k<Math.min(mit.length,400);k++){
  const g=mit[k-1].d-mit[k].d;
  if(g>luecke){ luecke=g; wo=k; }
}
const schwelle = schwelleArg!=null? schwelleArg : (mit[wo-1].d+mit[wo].d)/2;
const weg=mit.filter(o=>o.d>schwelle);
console.log(`${modell}: ${orte.length} Inseln, ${gesamt} Vertices`);
console.log(`groesste Luecke bei Rang ${wo}: ${mit[wo-1].d.toFixed(3)} -> ${mit[wo].d.toFixed(3)} (Schwelle ${schwelle.toFixed(3)})`);
console.log('Die 20 Inseln mit dem groessten Abstand zu ihrem Hauptknochen:');
for(const o of mit.slice(0,20))
  console.log(`   id=${String(o.id).padEnd(6)} verts=${String(o.verts).padEnd(4)} d=${o.d.toFixed(3)}  ${o.bone}`);
const wv=weg.reduce((a,o)=>a+o.verts,0);
console.log(`\nUeber der Schwelle: ${weg.length} Inseln, ${wv} Vertices (${(100*wv/gesamt).toFixed(1)} % des Modells)`);
console.log('entfernen:[' + weg.map(o=>o.id).join(',') + ']');
const ids=weg.map(o=>o.id);

// BELEG: einmal nur die Kandidaten, einmal alles ohne sie. Eine Liste von
// Insel-Nummern ist nicht nachpruefbar - zwei Bilder sind es.
const ziel='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/';
const schuss=async(datei, isoIds)=>{
  await page.evaluate((i)=>window.isolate(i), isoIds);
  const png=await page.evaluate(([c,t,y,p])=>window.bake(c,t,y,300,null,null,p),[idle.name,atkT,90,pose]);
  fs.writeFileSync(ziel+datei, Buffer.from(png.split(',')[1],'base64'));
};
await schuss(`wz-${modell}-nur.png`, ids);
const alleIds=orte.map(o=>o.id).filter(i=>!ids.includes(i));
await schuss(`wz-${modell}-ohne.png`, alleIds);
await page.evaluate(()=>window.isolate(null));
await schuss(`wz-${modell}-voll.png`, null);
console.log('Belegbilder: wz-'+modell+'-{nur,ohne,voll}.png');
await br.close();
