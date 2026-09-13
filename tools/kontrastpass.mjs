// KONTRAST-PASS fuer BESTANDS-Blaetter (T18, Spielerbefund "die figuren
// brauchen mehr kontrast das ist alles zu braun").
//
// Hebt den Kontrast als Luma-Spreizung um den Mittelton (HSL-L um 0,5),
// Faktor 1,2 - kalibriert am Vergleichsstreifen (kontrastkalib.mjs:
// 1,1 kaum sichtbar, 1,35 saeuft in den Schatten ab und blueht auf
// Helm/Haut weiss aus). KEINE Saettigungsaenderung - die steckt seit
// v234 in farbpass.mjs bzw. im Bake.
//
// DERSELBE Faktor und derselbe Haarmasken-Schutz stecken seit T18 im
// Bake selbst (tools/bake-sprites.html, Ende von window.bake): neu
// gebackene Blaetter haben den Kontrast schon drin und duerfen NICHT
// noch einmal durch diesen Pass. Er existiert nur, um Blaetter aus der
// Zeit VOR T18 einmalig nachzuziehen.
//
// Haarmasken-Schutz: render.haarMaske nimmt Kopfzonen-Pixel mit
// HSL-L < 0,30 im Braunfenster (Ton 15-48, gesaettigt) als Haar.
// Braune Kopfbedeckungen (Strohhut des Bauern) liegen knapp darueber -
// die Spreizung wuerde L 0,30-0,33 unter die Schwelle druecken
// (T5-Vorfall "schwarzer Strohhut"). Pixel, die VOR der Spreizung
// ueber der Schwelle lagen, klemmen im Braunfenster auf minimal 0,305.
//
//   node tools/kontrastpass.mjs assets/unit_*.png
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HIER=path.dirname(fileURLToPath(import.meta.url));
const { PNG } = await import(path.join(HIER,'..','node_modules','pngjs','lib','png.js'));

const KONTRAST=1.2;
const dateien=process.argv.slice(2);
if(!dateien.length){ console.error('Aufruf: node tools/kontrastpass.mjs <png...>'); process.exit(1); }
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
    const lVor=l;
    l=Math.min(1, Math.max(0, 0.5+(l-0.5)*KONTRAST));
    if(lVor>=0.30 && l<0.305){
      const grad=h*360;
      if(grad>=15 && grad<=48 && s>=0.15) l=0.305;
    }
    const f=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6; return p; };
    if(s===0){ d[i]=d[i+1]=d[i+2]=l*255; }
    else { const q=l<0.5? l*(1+s): l+s-l*s, p=2*l-q;
      d[i]=f(p,q,h+1/3)*255; d[i+1]=f(p,q,h)*255; d[i+2]=f(p,q,h-1/3)*255; }
  }
  fs.writeFileSync(datei, PNG.sync.write(png));
  console.log('kontrastiert', datei);
}
