// ASTERIX-FARBPASS für BESTANDS-Blätter (T14, einmalig ausgeführt für v234).
//
// Die Tripo-Texturen sind gedeckt-trist ("die farben sind trist und nicht
// wie im asterix stil", Spielerbefund). Dieser Pass hebt Saettigung x1,45
// und Helligkeit x1,05 - kalibriert am Vergleichsstreifen (x1,25 zu lasch,
// x1,7 Neon). DIESELBEN Faktoren stecken seit v234 im Bake selbst
// (tools/bake-sprites.html, Ende von window.bake) - neu gebackene
// Blaetter sind also bereits gesaettigt und duerfen NICHT noch einmal
// durch diesen Pass laufen. Er existiert nur, um Blaetter aus der Zeit
// VOR v234 nachzuziehen (damals: alle assets/unit_*.png).
//
//   node tools/farbpass.mjs assets/unit_*.png
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HIER=path.dirname(fileURLToPath(import.meta.url));
const { PNG } = await import(path.join(HIER,'..','node_modules','pngjs','lib','png.js'));

const SAT=1.45, HELL=1.05;
const dateien=process.argv.slice(2);
if(!dateien.length){ console.error('Aufruf: node tools/farbpass.mjs <png...>'); process.exit(1); }
for(const datei of dateien){
  const png=PNG.sync.read(fs.readFileSync(datei));
  const d=png.data;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]===0) continue;
    let r=d[i]/255, g=d[i+1]/255, b=d[i+2]/255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    let h=0, s=0, l=(mx+mn)/2;
    if(mx!==mn){ const df=mx-mn; s=l>0.5? df/(2-mx-mn):df/(mx+mn);
      h= mx===r? (g-b)/df+(g<b?6:0) : mx===g? (b-r)/df+2 : (r-g)/df+4; h/=6; }
    s=Math.min(1, s*SAT); l=Math.min(1, l*HELL);
    const f=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6; return p; };
    if(s===0){ d[i]=d[i+1]=d[i+2]=l*255; }
    else { const q=l<0.5? l*(1+s): l+s-l*s, p=2*l-q;
      d[i]=f(p,q,h+1/3)*255; d[i+1]=f(p,q,h)*255; d[i+2]=f(p,q,h-1/3)*255; }
  }
  fs.writeFileSync(datei, PNG.sync.write(png));
  console.log('gesaettigt', datei);
}
