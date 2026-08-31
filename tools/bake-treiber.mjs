// Sprite-Blätter aus den Tripo-GLBs backen - Nachfolger der agentS-Skripte,
// jetzt mit Posen aus tools/posen.js statt hart verdrahtet.
//
//   node tools/bake-treiber.mjs <modell> [sets] [--preview]
//     modell   z.B. hunter, forester   (tools/models/<modell>.glb muss lokal liegen)
//     sets     Komma-Liste aus walk,idle,atk   (Standard: atk)
//     --preview  statt Blättern einen grossen Filmstreifen (r/f/b) schreiben
//
// Blattformat: 88px-Zellen, 5 Zeilen (r,fr,f,br,b), walk/idle 12 Spalten,
// atk 8 Spalten (Kontakt auf Spalte 4). Der Bildausschnitt wird VOR den
// Mesh-Eingriffen über den Geh-Clip vermessen (setFrame) - dadurch behalten
// neue Blätter exakt den Massstab der alten, und UNIT_FIT in render.js
// bleibt gültig.
//
// Die Richtungs-Yaws je Zeile sind NICHT dokumentiert, sie werden je Modell
// aus der Drift des Geh-Clips hergeleitet (in welche Bildschirmrichtung
// wandert die Figur bei yaw 0/90) - dieselbe Kalibrierung wie beim
// Bauarbeiter-Hammer (agentS).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { POSEN, atkPose, keyPose, FLUCHT } from './posen.js';

const HIER=path.dirname(fileURLToPath(import.meta.url));
const ASSETS=path.join(HIER,'..','assets');
const URL_BASIS=process.env.BAKE_URL||'http://localhost:8901';
const CHROME=process.env.CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CELL=88;
// 'trag' = Geh-Zyklus mit konstanter Zusatzpose (Traeger haelt die Last
// vor der Brust, die Beine laufen aus dem Clip weiter)
// cheer/die/hit (T17, Soldaten): handgesetzte Schluesselbild-Posen wie atk.
// Die Soldaten-GLBs geben nichts anderes her - ausser dem Geh-Clip existiert
// nur der bekannte kaputte 1,29-s-Clip (Streifenprobe: Figur zerknautscht,
// Spalten ab ~70 % leer). die/hit sind EINMALCLIPS: die Posen enden auf der
// letzten Spalte (kein Wrap), render.js faehrt sie ueber prog 0..1 ab.
// flee (T18): Geh-Zyklus mit Flucht-Pose (vornuebergebeugt, Arme
// angewinkelt) - ersetzt die alten bake-clips.js-Blaetter, damit auch
// carrier/worker nach Koerperbau-Aenderungen komplett neu backbar sind.
const SPALTEN={ walk:12, idle:12, atk:8, trag:12, cheer:12, die:10, hit:8, flee:12 };
const EINMAL={ die:true, hit:true };
const POSENSETS=['cheer','die','hit'];

const modell=process.argv[2];
const sets=(process.argv[3]&&!process.argv[3].startsWith('--')? process.argv[3] : 'atk').split(',');
const preview=process.argv.includes('--preview');
if(!modell || !POSEN[modell] && sets.includes('atk')){
  if(!modell){ console.error('Aufruf: node tools/bake-treiber.mjs <modell> [walk,idle,atk] [--preview]'); process.exit(1); }
}
const P=POSEN[modell]||{};

const browser=await chromium.launch({executablePath:CHROME,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:500,height:520}});
page.on('pageerror',e=>console.log('PAGEERR',e.message));
const t0=Date.now();
await page.goto(`${URL_BASIS}/tools/bake-sprites.html?m=${modell}&x=${Math.random()}`,{timeout:30000});
await page.waitForFunction('window.__ready===true || window.__err',{timeout:90000});
const err=await page.evaluate('window.__err||null');
if(err) throw new Error('LOAD '+err.slice(0,150));

const clips=await page.evaluate('window.info()');
const inR=(a,b)=>clips.find(c=>c.duration>=a&&c.duration<=b);
const walk=inR(2.2,2.7)||inR(1.7,2.1)||clips[0];
const idle=inR(4.5,99)||walk;
console.log('Clips:', clips.map(c=>`${c.name}(${c.duration.toFixed(2)}s)`).join(' '), '-> Gehen:', walk.name, 'Warten:', idle.name);

// 1. Bildausschnitt VOR Mesh-Eingriffen festlegen (Massstab der alten Blätter)
await page.evaluate((n)=>window.setFrame(n),walk.name);
// 2. eingebaute Werkzeuge: entweder UMHAENGEN oder abtrennen und verwerfen.
// Umhaengen ist das bessere von beidem, wo es geht: das gemalte Werkzeug
// des Modells ist feiner als jedes prozedurale Primitiv - es haengt nur am
// falschen Knochen. Verworfen wird nur noch, was sich nicht retten laesst
// (Angelzeug des Fischers: drei getrennte Teile quer ueber Hand-, Bein-
// und Kopfknochen; Bogen des Jaegers; Waffen der Soldaten).
async function werkzeugSetzen(set){
  const u=P.umhaengen; if(!u) return;
  // je Satz ein eigener Haltewinkel: im Gehen wird geschultert, beim
  // Arbeiten zum Boden gedreht. umhaengen() rechnet jedes Mal von der
  // gemerkten Ausgangslage los.
  const rot=(u.rotSet && u.rotSet[set]) || u.rot || [0,0,0];
  const r=await page.evaluate(([ids,b,o])=>window.umhaengen(ids,b,o),
    [u.ids, u.bone||'R_Hand', {greifer:u.greifer||0, rot, scale:u.scale||1}]);
  if(!String(r).startsWith('ok')) throw new Error('umhaengen '+r);
}
// Erst UMHAENGEN, dann entfernen - in dieser Reihenfolge. umhaengen()
// arbeitet ueber die Insel-Zusammenhaenge des unveraenderten Netzes;
// splitIslands schneidet Dreiecke heraus und verschiebt damit die
// Inselnummern. Beides zusammen ist erlaubt: das Werkzeug wandert in die
// Faust, Streuteile daneben fliegen raus.
if(P.umhaengen){
  await werkzeugSetzen('atk');
  console.log('Mesh: Werkzeug umgehaengt,', P.umhaengen.ids.length, 'Inseln');
}
if(P.entfernen && P.entfernen.length){
  await page.evaluate((ids)=>window.splitIslands(ids),P.entfernen);
  await page.evaluate('window.toolDiscard()');
  console.log('Mesh:', P.entfernen.length, 'Inseln entfernt');
}
// 2b. Koerperbau (Asterix-Silhouetten): Knochen-Skalierung je Beruf.
// NACH setFrame - der Bildausschnitt bleibt der der schlanken Grundfigur,
// damit alle Berufe denselben Massstab behalten (UNIT_FIT).
if(P.koerper){
  const r=await page.evaluate((k)=>window.koerper(k),P.koerper);
  if(r!=='ok') throw new Error('koerper '+r);
  console.log('Koerper:', Object.keys(P.koerper).join(' '));
}
// 3. Richtungs-Yaws über die Drift des Geh-Clips
const drift=async(yaw)=>{
  const cs=[];
  for(let k=0;k<8;k++)
    cs.push(await page.evaluate(([c,t,y])=>window.center(c,t,y),[walk.name,walk.duration*k/8,yaw]));
  const fit=(v)=>{const n=v.length,mx=(n-1)/2,my=v.reduce((a,b)=>a+b,0)/n;
    let nu=0,de=0;for(let k2=0;k2<n;k2++){nu+=(k2-mx)*(v[k2]-my);de+=(k2-mx)*(k2-mx);}return de?nu/de:0;};
  return {vx:fit(cs.map(c=>c.x)), vz:fit(cs.map(c=>c.z))};
};
const d0=await drift(0), d90=await drift(90);
if(Math.hypot(d0.vx,d0.vz)<1e-4) throw new Error('KEINE DRIFT - Geh-Clip untauglich für Yaw-Kalibrierung');
const a0=Math.atan2(d0.vz,d0.vx)*180/Math.PI, a90=Math.atan2(d90.vz,d90.vx)*180/Math.PI;
let dd=a90-a0; while(dd>180)dd-=360; while(dd<-180)dd+=360;
const sg=dd>=0?1:-1;
const yawFor=(t)=>{ let y=(t-a0)/sg; y=((y%360)+360)%360; return Math.round(y); };
const DIRS={ r:yawFor(0), fr:yawFor(45), f:yawFor(90), br:yawFor(-45), b:yawFor(-90) };
console.log('DIRS', JSON.stringify(DIRS));

// Werkzeug(e) für ein Set anbringen (oder abräumen). Ein Eintrag darf
// seit T18 auch eine LISTE sein (Werkzeug + Zubehoer wie Schnurrbart,
// Feder, Guertel - Asterix-Accessoires gelten je Beruf fuer ALLE Sets).
async function ruesten(set){
  await page.evaluate('window.toolClear()');
  const w=P.werkzeug && P.werkzeug[set];
  for(const t of (w? (Array.isArray(w)?w:[w]) : [])){
    const r=await page.evaluate(([k,b,p,ro,s])=>window.toolAttach(k,b,p,ro,s),[t.kind,t.bone,t.pos,t.rot,t.scale]);
    if(r!=='ok') throw new Error('toolAttach '+r);
  }
  await page.evaluate(()=>window.toolVis(true));
}
// (clip,t,pose) je Spalte eines Sets
function spaltenPlan(set){
  const n=SPALTEN[set];
  // Modelle OHNE echten Warte-Clip (idle===walk) bekommen als Grundpose
  // den DURCHSCHWUNG des Geh-Zyklus (~27%): beide Fuesse unterm Koerper,
  // Ruecken gerade. Frame 0 des Geh-Clips ist mitten im Schritt - die
  // additive Arbeitspose sass sonst auf einer schiefen Grundhaltung
  // (T13: der Geologe kippte am Kontakt fast kopfueber).
  const atkT = idle===walk ? walk.duration*0.27 : 0;
  // walkFenster [a,b] (posen.js): nur diesen Anteil des Geh-Clips ueber
  // die 12 Spalten legen. Noetig, wenn der Clip MEHR als einen
  // Schrittzyklus enthaelt (woodcutter/geo: zwei Zyklen in 1,88 s -
  // per Fusshoehen-Periodik vermessen, T15). Ohne Fensterung zeigten
  // 12 Spalten zwei Zyklen = nur 6 echte Phasen, doppelt so hastig.
  const F=P.walkFenster||[0,1];
  const wT=(k,n2)=>walk.duration*(F[0]+(F[1]-F[0])*k/n2);
  const plan=[];
  for(let k=0;k<n;k++){
    if(set==='atk') plan.push({clip:idle.name, t:atkT, pose:atkPose(P.atk,k)});
    else if(POSENSETS.includes(set)){
      if(!P[set]) throw new Error(`kein Posensatz '${set}' fuer ${modell} in posen.js`);
      plan.push({clip:idle.name, t:atkT, pose:keyPose(P[set], k, n, !EINMAL[set])});
    }
    else if(set==='trag') plan.push({clip:walk.name, t:wT(k,n), pose:P.trag});
    else if(set==='flee') plan.push({clip:walk.name, t:wT(k,n), pose:keyPose(P.flee||FLUCHT, k, n, true)});
    else if(set==='walk') plan.push({clip:walk.name, t:wT(k,n), pose:null});
    else plan.push({clip:idle.name, t:idle.duration*k/n, pose:null});
  }
  return plan;
}
// Versatz je Spalte: lineare Drift heraus, natürliches Wiegen bleibt.
// zentrierKnochen (posen.js): statt der geskinnten Bounding-Box zentriert
// ein KNOCHEN (i.d.R. Hip). Noetig beim Holzfaeller: zwei Streu-Vertices
// haengen am statischen neutral_bone und bleiben bei der Root-Motion des
// Geh-Clips zurueck - sie verankern die Box, die Zentrierkurve bekommt
// einen Knick (Figur rutscht in der Zelle, Loop springt). Die Vertices
// stecken auch nach 'entfernen' noch im Positions-Attribut, darum hilft
// nur eine Box-freie Zentrierung. Der Knochen ist von Streu-Vertices
// unabhaengig; die Spalten bleiben untereinander konsistent.
// nurMittel (cheer/die/hit): KONSTANTER Versatz je Zeile (Spalten-Mittel)
// statt Drift-Gerade. Die Basis steht still, alle Bewegung kommt aus der
// Pose - eine Ausgleichsgerade wuerde z.B. das Vornueberkippen beim
// Sterben teilweise "zurueckschieben" (die Figur ruschte durch die Zelle).
async function versatz(plan, yaw, nurMittel=false){
  const cs=[];
  for(const s of plan)
    cs.push(await page.evaluate(([c,t,y,p,kn])=>{
      const mitte=window.center(c,t,y,p);
      if(kn){ const b=window.bonePos(kn); return {x:b.x, z:b.z}; }
      return mitte;
    },[s.clip,s.t,yaw,s.pose,P.zentrierKnochen||null]));
  const n=cs.length, mx=(n-1)/2;
  const fit=(v)=>{ const my=v.reduce((a,b)=>a+b,0)/n;
    if(nurMittel) return {my, sl:0};
    let nu=0,de=0; for(let k=0;k<n;k++){ nu+=(k-mx)*(v[k]-my); de+=(k-mx)*(k-mx); }
    return {my, sl: de? nu/de : 0}; };
  const fx=fit(cs.map(c=>c.x)), fz=fit(cs.map(c=>c.z));
  return plan.map((_,k)=>({ ox: fx.my+fx.sl*(k-mx), oz: fz.my+fz.sl*(k-mx) }));
}

async function backeBlatt(set){
  await werkzeugSetzen(set);
  const plan=spaltenPlan(set);
  const n=plan.length;
  await ruesten(set);
  await page.evaluate(([cols,c])=>{
    window.__sheet=new OffscreenCanvas(cols*c,5*c);
    window.__sg=window.__sheet.getContext('2d');
  },[n,CELL]);
  let row=0;
  for(const dk of ['r','fr','f','br','b']){
    const yaw=DIRS[dk];
    const off=await versatz(plan,yaw,POSENSETS.includes(set));
    for(let k=0;k<n;k++){
      await page.evaluate(async ([s,y,o,c,col,row2])=>{
        const url=window.bake(s.clip,s.t,y,c,o.ox,o.oz,s.pose);
        const img=await createImageBitmap(await (await fetch(url)).blob());
        window.__sg.drawImage(img,col*c,row2*c);
      },[plan[k],yaw,off[k],CELL,k,row]);
    }
    row++;
  }
  const url=await page.evaluate(async ()=>{
    const b=await window.__sheet.convertToBlob({type:'image/png'});
    return await new Promise(res=>{const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(b);});
  });
  const ziel=path.join(ASSETS,`unit_${modell}_${set}.png`);
  fs.writeFileSync(ziel, Buffer.from(url.split(',')[1],'base64'));
  console.log('gebacken', ziel);
}

async function backeVorschau(){
  const cellP=160, rowsP=['r','f','b'];
  const set=sets[0];
  const plan=spaltenPlan(set);
  await ruesten(set);
  await page.evaluate(([cols,c,nr])=>{
    window.__mont=new OffscreenCanvas(cols*c,nr*c);
    window.__mg=window.__mont.getContext('2d');
    window.__mg.fillStyle='#4a4f57'; window.__mg.fillRect(0,0,cols*c,nr*c);
  },[plan.length,cellP,rowsP.length]);
  let row=0;
  for(const dk of rowsP){
    const yaw=DIRS[dk];
    const off=await versatz(plan,yaw,POSENSETS.includes(set));
    for(let k=0;k<plan.length;k++){
      await page.evaluate(async ([s,y,o,c,col,row2,lbl])=>{
        const url=window.bake(s.clip,s.t,y,c,o.ox,o.oz,s.pose);
        const img=await createImageBitmap(await (await fetch(url)).blob());
        window.__mg.drawImage(img,col*c,row2*c);
        window.__mg.fillStyle='#ffd27d'; window.__mg.font='13px sans-serif';
        window.__mg.fillText(lbl,col*c+4,row2*c+15);
      },[plan[k],yaw,off[k],cellP,k,row,`${dk}${k}`]);
    }
    row++;
  }
  const url=await page.evaluate(async ()=>{
    const b=await window.__mont.convertToBlob({type:'image/png'});
    return await new Promise(res=>{const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(b);});
  });
  const ziel=`prev-${modell}-${set}.png`;
  fs.writeFileSync(ziel, Buffer.from(url.split(',')[1],'base64'));
  console.log('Vorschau', ziel);
}

if(preview) await backeVorschau();
else for(const s of sets) await backeBlatt(s);
console.log(((Date.now()-t0)/1000).toFixed(0)+'s');
await browser.close();
