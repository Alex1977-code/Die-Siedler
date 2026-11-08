// Silberne Ruestung fuer die Soldaten (Spielerwunsch, Figurenplan-Nachtrag:
// "Helmbusch und Umhang sind vorhanden - dazu silberne Ruestung wie die
// Roemer bei Asterix"). Die Soldaten tragen Lederkuerass und Lederhelm in
// denselben Brauntoenen wie Haut und Waffenholz - eine reine Farbton-Wahl
// wie bei tools/tunika.mjs griffe daneben. Darum ZONEN wie beim Helmbusch:
// nur der HELM (oberes Kopfband, mittig unter dem blauen Busch) und der
// KUERASS (mittiges Rumpfband) werden versilbert; Arme, Haende, Beine,
// Schild und Waffenschaefte liegen ausserhalb der Baender und bleiben
// Leder/Holz/Haut.
//
//   node tools/ruestung.mjs preview   - Blaetter in den Scratch-Ordner
//   node tools/ruestung.mjs apply     - Blaetter in assets/ ueberschreiben
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HIER=path.dirname(fileURLToPath(import.meta.url));
const ASSETS=path.join(HIER,'..','assets');
const SCRATCH='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad';
const CELL=88, ROWS=5;
const COLS={ walk:12, idle:12, atk:8, cheer:12, hit:8, die:10 };
const TYPEN=['sword','spear','bow'];
const SILBER=[188,194,204];               // kuehles Stahlgrau
const HELL=0.30;                          // Luma-Anhebung: Leder ist dunkler als Stahl

const blau=(r,g,b,a)=> a>50 && b>r*1.22 && b>g*1.1 && (b-Math.min(r,g))>24;
const luma=(r,g,b)=> 0.299*r+0.587*g+0.114*b;
function hsv(r,g,b){
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn;
  let h=0;
  if(d>0){
    if(mx===r) h=60*(((g-b)/d)%6);
    else if(mx===g) h=60*((b-r)/d+2);
    else h=60*((r-g)/d+4);
  }
  if(h<0) h+=360;
  return [h, mx? d/mx : 0];
}

function bearbeiteZelle(png, cx0, cy0){
  const W=png.width, d=png.data;
  let fy0=CELL, fy1=-1, fx0=CELL, fx1=-1;
  for(let y=0;y<CELL;y++) for(let x=0;x<CELL;x++){
    const p=((cy0+y)*W+(cx0+x))*4;
    if(d[p+3]>50){
      if(y<fy0)fy0=y; if(y>fy1)fy1=y;
      if(x<fx0)fx0=x; if(x>fx1)fx1=x;
    }
  }
  if(fy1<0) return 0;
  const figH=fy1-fy0+1, figCx=(fx0+fx1)/2, figW=fx1-fx0+1;
  // Anker statt nackter Bbox-Bruchteile: die Bbox schwankt mit der Waffe
  // (der erhobene Bogen streckt sie nach oben, die Zonen rutschten ins
  // Gesicht bzw. am Bogenschuetzen vorbei). Stabil sind der BUSCH (der Helm
  // sitzt direkt darunter) und die FUESSE. Dazwischen bleibt das Gesicht
  // als ausgesparte Zone stehen.
  // Helmoberkante: erste Zeile von oben, in der im Mittelband MEHRERE
  // nicht-blaue Figurpixel liegen. Der Busch darueber ist blau, die duenne
  // Speer-/Bogenspitze (2-3 px) faellt unter die Mindestbreite, und der
  // blaue Umhang kann den Anker nicht nach unten ziehen.
  let kopf=-1;
  for(let y=fy0;y<fy1 && kopf<0;y++){
    let n9=0;
    for(let x=0;x<CELL;x++){
      if(Math.abs(x-figCx)>figW*0.26) continue;
      const p=((cy0+y)*W+(cx0+x))*4;
      if(d[p+3]>50 && !blau(d[p],d[p+1],d[p+2],d[p+3])) n9++;
    }
    if(n9>=4) kopf=y;
  }
  if(kopf<0) kopf=fy0+figH*0.14;
  const bodyH=fy1-kopf+1;
  if(bodyH<10) return 0;
  const zonen=[
    { y0:kopf,              y1:kopf+bodyH*0.15, bx:0.26 },  // Helm (unterm Busch)
    { y0:kopf+bodyH*0.28,   y1:kopf+bodyH*0.55, bx:0.30 },  // Kuerass
  ];
  const LT=Math.max(24,luma(...SILBER));
  let n=0;
  for(const z of zonen){
    for(let y=Math.max(fy0,Math.floor(z.y0)); y<Math.min(fy1,z.y1); y++){
      for(let x=0;x<CELL;x++){
        if(Math.abs(x-figCx)>figW*z.bx) continue;
        const p=((cy0+y)*W+(cx0+x))*4;
        const r=d[p], g=d[p+1], b=d[p+2], a=d[p+3];
        if(a<40 || blau(r,g,b,a)) continue;
        // helle SATTE Orangetoene sind Haut (Gesicht zwischen Helm und
        // Kuerass, Haende am Rumpfrand) - Leder ist stumpfer oder dunkler
        const l=luma(r,g,b), [h,s]=hsv(r,g,b);
        if(h<12||h>50||s<0.22||s>0.85||l<26||l>200) continue;
        if(s>=0.55 && l>140) continue;                 // beleuchtete Haut
        const f=(l+(LT-l)*HELL)/LT;
        d[p]  =Math.min(255,Math.round(SILBER[0]*f));
        d[p+1]=Math.min(255,Math.round(SILBER[1]*f));
        d[p+2]=Math.min(255,Math.round(SILBER[2]*f));
        n++;
      }
    }
  }
  return n;
}

const modus=process.argv[2]||'preview';
let px=0;
for(const typ of TYPEN){
  for(const set in COLS){
    const f=path.join(ASSETS,`unit_${typ}_${set}.png`);
    if(!fs.existsSync(f)) continue;
    const png=PNG.sync.read(fs.readFileSync(f));
    let n=0;
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS[set];c++)
      n+=bearbeiteZelle(png, c*CELL, r*CELL);
    px+=n;
    const ziel= modus==='apply'? f : path.join(SCRATCH,`silber_${typ}_${set}.png`);
    fs.writeFileSync(ziel, PNG.sync.write(png));
    console.log(`unit_${typ}_${set}: ${n} Pixel`);
  }
}
console.log(`${modus}: ${px} Pixel versilbert`);
