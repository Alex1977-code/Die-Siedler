// Helmbusch der Soldaten vergroessern (Figurenplan Stufe 1, Kritik R2:
// "2-3 px - als Farbtupfer erkennbar, als Form nicht"). Die Soldaten-GLBs
// tragen nur zwei Roh-Clips; ein Neu-Backen aller sechs Blattsaetze wuerde
// die (verlorene) Posen-Pipeline von hit/die/cheer neu erfinden. Statt-
// dessen NACHBEARBEITUNG der fertigen Blaetter: der Busch ist exakt die
// BLAUE Faerbezone (dieselbe Erkennung wie unitMask in render.js) im
// obersten Teil der Figur - er wird je Zelle ausgeschnitten und um den
// Fusspunkt verankert auf das 2,1-fache vergroessert wieder aufgelegt.
//
//   node tools/helmbusch.mjs preview   - Vorher/Nachher-Montage (Schirm)
//   node tools/helmbusch.mjs apply     - Blaetter in assets/ ueberschreiben
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const HIER=path.dirname(fileURLToPath(import.meta.url));
const ASSETS=path.join(HIER,'..','assets');
const CELL=88, ROWS=5;
const COLS={ walk:12, idle:12, atk:8, cheer:12, hit:8, die:10 };
const TYPEN=['sword','spear','bow'];
const FX=1.9, FY=1.5;   // Breite staerker als Hoehe: Turm-Optik vermeiden

const blau=(r,g,b,a)=> a>50 && b>r*1.22 && b>g*1.1 && (b-Math.min(r,g))>24;

function bearbeiteZelle(png, cx0, cy0){
  const W=png.width, d=png.data;
  // Figur-Hoehenbereich der Zelle bestimmen
  let fy0=CELL, fy1=-1;
  for(let y=0;y<CELL;y++) for(let x=0;x<CELL;x++){
    const p=((cy0+y)*W+(cx0+x))*4;
    if(d[p+3]>50){ if(y<fy0)fy0=y; if(y>fy1)fy1=y; }
  }
  if(fy1<0) return false;
  const figH=fy1-fy0+1;
  // Figurbreite/-mitte fuer den Mittigkeits-Filter (blaue SCHULTERN
  // duerfen nicht mitwachsen)
  let fx0=CELL, fx1=-1;
  for(let y=0;y<CELL;y++) for(let x=0;x<CELL;x++){
    const p=((cy0+y)*W+(cx0+x))*4;
    if(d[p+3]>50){ if(x<fx0)fx0=x; if(x>fx1)fx1=x; }
  }
  const figCx=(fx0+fx1)/2, figW=fx1-fx0+1;
  // Busch = blaue Pixel im obersten Fuenftel der Figur, nahe der Mitte
  const grenze=fy0+Math.max(4, figH*0.20);
  let bx0=CELL, bx1=-1, by0=CELL, by1=-1, n=0;
  for(let y=fy0;y<grenze;y++) for(let x=0;x<CELL;x++){
    if(Math.abs(x-figCx)>figW*0.30) continue;
    const p=((cy0+y)*W+(cx0+x))*4;
    if(!blau(d[p],d[p+1],d[p+2],d[p+3])) continue;
    if(x<bx0)bx0=x; if(x>bx1)bx1=x;
    if(y<by0)by0=y; if(y>by1)by1=y;
    n++;
  }
  if(n<4) return false;
  const bw=bx1-bx0+1, bh=by1-by0+1;
  // Busch-Ausschnitt kopieren (nur die blauen Pixel, 1 px Saum)
  const S=2;
  const kw=bw+2*S, kh=bh+2*S;
  const kopie=new Uint8ClampedArray(kw*kh*4);
  for(let y=0;y<kh;y++) for(let x=0;x<kw;x++){
    const sx=bx0-S+x, sy=by0-S+y;
    if(sx<0||sy<0||sx>=CELL||sy>=CELL) continue;
    const p=((cy0+sy)*W+(cx0+sx))*4;
    if(!blau(d[p],d[p+1],d[p+2],d[p+3])) continue;
    const q=(y*kw+x)*4;
    kopie[q]=d[p]; kopie[q+1]=d[p+1]; kopie[q+2]=d[p+2]; kopie[q+3]=d[p+3];
  }
  // vergroessert zuruecklegen: Anker = Fussmitte des Buschs (waechst nach
  // oben und zur Seite, nicht ins Gesicht); naechster-Nachbar reicht bei
  // Low-Poly-Flaechenfarben und haelt die Kanten knackig
  const zw=Math.round(kw*FX), zh=Math.round(kh*FY);
  const ax=(bx0+bx1)/2, ay=by1+S;             // Fussmitte (mit Saum)
  const zx0=Math.round(ax-zw/2), zy0=Math.round(ay-zh);   // Basis bleibt
  for(let y=0;y<zh;y++) for(let x=0;x<zw;x++){
    const sx=Math.min(kw-1,Math.max(0,Math.round(x/FX)));
    const sy=Math.min(kh-1,Math.max(0,Math.round(y/FY)));
    const q=(sy*kw+sx)*4;
    if(kopie[q+3]<50) continue;
    const tx=zx0+x, ty=zy0+y;
    if(tx<0||ty<0||tx>=CELL||ty>=CELL) continue;      // Zellgrenze haelt
    const p=((cy0+ty)*W+(cx0+tx))*4;
    d[p]=kopie[q]; d[p+1]=kopie[q+1]; d[p+2]=kopie[q+2]; d[p+3]=255;
  }
  return true;
}

const modus=process.argv[2]||'preview';
let zellen=0, blaetter=0;
for(const typ of TYPEN){
  for(const set in COLS){
    const f=path.join(ASSETS,`unit_${typ}_${set}.png`);
    if(!fs.existsSync(f)) continue;
    const png=PNG.sync.read(fs.readFileSync(f));
    let getroffen=0;
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS[set];c++){
      if(bearbeiteZelle(png, c*CELL, r*CELL)) getroffen++;
    }
    zellen+=getroffen; blaetter++;
    if(modus==='apply'){
      fs.writeFileSync(f, PNG.sync.write(png));
      console.log(`unit_${typ}_${set}: ${getroffen} Zellen`);
    } else {
      const ziel=`/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/busch_${typ}_${set}.png`;
      fs.writeFileSync(ziel, PNG.sync.write(png));
      console.log(`Vorschau unit_${typ}_${set}: ${getroffen} Zellen -> ${ziel}`);
    }
  }
}
console.log(`${modus}: ${blaetter} Blaetter, ${zellen} Zellen bearbeitet`);
