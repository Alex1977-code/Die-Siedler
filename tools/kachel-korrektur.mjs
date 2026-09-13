// Farbkorrektur fuer gelieferte Kacheln (G-Block der Grafikkritik).
//
// Rechnet je Pixel:   c' = L + (c - L) * k      (Entsaettigen um k, HELLIGKEIT
// bleibt exakt erhalten - die eingemalte Zeichnung geht also nicht verloren)
// danach optional:    c' += versatz[kanal]      (Farbstich gerade ruecken)
// und optional:       c' = (c'-128)*kontrast+128 + hebung
//
// Aufruf:  node tools/kachel-korrektur.mjs <datei> k=0.58 b=+12 ...
// Ohne Schreibrecht-Argument wird NUR gemessen (--schreiben setzt um).
//
// Der Umweg ueber den Browser ist Absicht: er ist der einzige PNG-Coder, den
// dieses Projekt ohnehin schon mitbringt (Playwright/Chromium).
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'fs';
import { basename } from 'path';

const args=process.argv.slice(2);
const datei=args[0];
if(!datei){ console.error('Aufruf: node tools/kachel-korrektur.mjs assets/ter_grass.png k=0.58 b=12 [--schreiben]'); process.exit(1); }
const P={k:1, r:0, g:0, b:0, kontrast:1, hebung:0, deckel:0, deckelK:0.35, waerme:0, waermeBis:90};
let schreiben=false;
for(const a of args.slice(1)){
  if(a==='--schreiben'){ schreiben=true; continue; }
  const m=a.match(/^([a-z]+)=(-?[\d.]+)$/); if(m) P[m[1]]=parseFloat(m[2]);
}
const roh=readFileSync(datei);
const b64='data:image/png;base64,'+roh.toString('base64');

const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await (await browser.newContext()).newPage();
await page.goto('about:blank');
const erg=await page.evaluate(async ({src,P})=>{
  const im=await new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src=src; });
  const cv=document.createElement('canvas'); cv.width=im.naturalWidth; cv.height=im.naturalHeight;
  const g=cv.getContext('2d'); g.drawImage(im,0,0);
  const id=g.getImageData(0,0,cv.width,cv.height), d=id.data;
  const kenn=()=>{ let sR=0,sG=0,sB=0,n=0,sS=0,sL=0,sL2=0;
    for(let i=0;i<d.length;i+=4){ if(d[i+3]<128) continue;
      const r=d[i],gg=d[i+1],bb=d[i+2];
      const mx=Math.max(r,gg,bb), mn=Math.min(r,gg,bb);
      sS+= mx? (mx-mn)/mx : 0;
      const l=0.299*r+0.587*gg+0.114*bb;
      sR+=r;sG+=gg;sB+=bb;sL+=l;sL2+=l*l;n++; }
    return { mittel:[Math.round(sR/n),Math.round(sG/n),Math.round(sB/n)],
             saettigung:+(sS/n).toFixed(3),
             std:+Math.sqrt(Math.max(0,sL2/n-(sL/n)**2)).toFixed(2) }; };
  const vorher=kenn();
  const kl=(v)=> v<0?0 : v>255?255 : v;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]===0) continue;
    const r=d[i],gg=d[i+1],bb=d[i+2];
    const L=0.299*r+0.587*gg+0.114*bb;
    let R=L+(r-L)*P.k + P.r, G=L+(gg-L)*P.k + P.g, B=L+(bb-L)*P.k + P.b;
    if(P.kontrast!==1 || P.hebung){
      R=(R-128)*P.kontrast+128+P.hebung;
      G=(G-128)*P.kontrast+128+P.hebung;
      B=(B-128)*P.kontrast+128+P.hebung;
    }
    // deckel: Lichter weich zusammenschieben. Reines Weiss ist in einem
    // gemalten Bild immer das hellste Ding auf dem Schirm und liest sich
    // deshalb wie ein Bedienelement, nicht wie ein Gegenstand.
    if(P.deckel){
      const w=(v)=> v<=P.deckel? v : P.deckel+(v-P.deckel)*P.deckelK;
      R=w(R); G=w(G); B=w(B);
    }
    // waerme: die DUNKLEN Bildteile ins Warme ruecken. Das Spiel ist von
    // einer warmen, tiefstehenden Sonne beleuchtet; Figuren mit neutral
    // grauem Eigenschatten wirken darin wie hineinkopiert.
    if(P.waerme){
      const Ln=0.299*R+0.587*G+0.114*B;
      if(Ln<P.waermeBis){
        const f=(1-Ln/P.waermeBis)*P.waerme;
        R+=f; G+=f*0.25; B-=f;
      }
    }
    d[i]=kl(Math.round(R)); d[i+1]=kl(Math.round(G)); d[i+2]=kl(Math.round(B));
  }
  g.putImageData(id,0,0);
  const nachher=kenn();
  return { vorher, nachher, png:cv.toDataURL('image/png') };
}, {src:b64, P});
await browser.close();

console.log(basename(datei), JSON.stringify({vorher:erg.vorher, nachher:erg.nachher, parameter:P}));
if(schreiben){
  writeFileSync(datei, Buffer.from(erg.png.split(',')[1], 'base64'));
  console.log('geschrieben:', datei);
} else {
  console.log('(nur gemessen - mit --schreiben umsetzen)');
}
