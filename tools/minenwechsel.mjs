// MINENWECHSEL: aendert sich das Bergwerk, wenn das Vorkommen versiegt?
//
// Versiegt ein Vorkommen, tauscht der Zeichner bld_<typ> gegen
// bld_<typ>_leer. Gemessen waren die erschoepften Bilder groesser als die
// arbeitenden (260 bis 263 Zeilen Inhalt gegen 238 bis 239) und sassen
// eine Zeile hoeher - das Bergwerk wuchs beim Versiegen. Hier wird beides
// im laufenden Spiel abgelesen: erst arbeitend, dann exhausted gesetzt.
//
//   node tools/minenwechsel.mjs
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const page=await br.newPage({viewport:{width:700,height:560}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
// Saat waehlbar: Gold und Granit liegen nicht auf jeder Karte in
// Reichweite des Hauptquartiers.
await starteSpiel(page,{saat:+(process.argv[2]||11), groesse:'L', gegner:'0', thema:'gebirge'});
const erg=await page.evaluate(async ()=>{
  const R=window.__ui.renderer, g=window.__ui.game;
  const hq=g.buildings.get(g.players[0].hq);
  hq.inv=hq.inv||{}; hq.inv.board=200; hq.inv.stone=200;
  const rahmen=(key)=>{
    const img=R.asset(key); if(!img||!img.naturalWidth) return null;
    const w=img.naturalWidth,h=img.naturalHeight;
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    const t=cv.getContext('2d',{willReadFrequently:true}); t.drawImage(img,0,0);
    const d=t.getImageData(0,0,w,h).data;
    let x0=w,y0=h,x1=-1,y1=-1;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]<=8) continue;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    return x1<0?null:{fh:(y1-y0+1)/h, unten:(h-1-y1)/h, mitte:((x0+x1+1)/2-w/2)/w};
  };
  const aus=[];
  for(const typ of ['coalmine','ironmine','goldmine','granitemine']){
    let b=null;
    for(let r=3;r<=40 && !b;r++) for(const n of g.nodesInRange(hq.node,r)){
      if(!g.canBuild(0,typ,n).ok) continue;
      const rr=g.placeBuilding(0,typ,n); if(rr.ok){ b=rr.b; break; } }
    if(!b){ aus.push({typ, fehler:'kein Bauplatz'}); continue; }
    b.state='done'; b.leveled=true; b.bauerDa=true; b.progress=1e9;
    // Die Kamera MUSS auf das Bergwerk: R.draw zeichnet nur, was im Bild
    // liegt, und _bauMasse bleibt sonst leer (Saat 7 lief genau darauf auf).
    const lies=()=>{
      const [bx,by]=g.map.worldPos(b.node);
      window.__ui.cam.x=bx; window.__ui.cam.y=by; window.__ui.cam.z=1.4;
      R._bauMasse && R._bauMasse.delete(b.id);
      R.draw(window.__ui.cam, window.__ui, 16, 16);
      const v=R._bauMasse && R._bauMasse.get(b.id);
      if(!v) return null;
      const [ww,hh,key,dx0,x]=v; const ra=rahmen(key);
      return ra? {blatt:key, hoehe:+(hh*ra.fh).toFixed(1),
                  luft:+(hh*ra.unten).toFixed(1),
                  mitte:+(((dx0+ww/2)-x)+ra.mitte*ww).toFixed(1)} : null;
    };
    b.exhausted=false; const a=lies();
    b.exhausted=true;  const l=lies();
    aus.push({typ, arbeitend:a, erschoepft:l,
      unterschied: a&&l? {hoehe:+(l.hoehe-a.hoehe).toFixed(1),
                          stand:+(l.luft-a.luft).toFixed(1),
                          seite:+(l.mitte-a.mitte).toFixed(1)} : null});
    g.removeBuilding && g.removeBuilding(b.id);
  }
  return aus;
});
for(const z of erg){
  if(z.fehler){ console.log(z.typ.padEnd(14), z.fehler); continue; }
  const u=z.unterschied;
  if(!u){ console.log(z.typ.padEnd(14),'nicht gezeichnet'); continue; }
  const ok=Math.abs(u.hoehe)<1 && Math.abs(u.stand)<1 && Math.abs(u.seite)<1;
  console.log(`${z.typ.padEnd(14)} arbeitend ${String(z.arbeitend.hoehe).padEnd(6)} `
    + `erschoepft ${String(z.erschoepft.hoehe).padEnd(6)} `
    + `Unterschied Hoehe ${String(u.hoehe).padEnd(6)} Stand ${String(u.stand).padEnd(6)} `
    + `Seite ${String(u.seite).padEnd(6)} ${ok?'':'ABWEICHUNG'}`);
}
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,3));
await br.close();
