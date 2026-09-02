// G7: "tree_conifer rote Stange" - der Nadelbaum ist ein kleiner Wipfel auf
// einem langen, roten Mast. Nachgemessen gegen die anderen Baeume des Spiels:
//
//   Baum          Kronenanteil   Breite/Hoehe   Stamm R-B
//   tree_conifer      0,393          0,24          101
//   tree_spruce       0,910          0,50           31
//   tree_birch        0,777          0,54           31
//   tree_oak          0,807          1,10           40
//
// Der Nadelbaum ist auf ALLEN DREI Achsen der Ausreisser: die Krone deckt
// nur 39 % statt 78-91 %, das Bild ist halb so breit wie bei den anderen,
// und der Stamm ist doppelt so rot. Das Werkzeug baut das vorhandene Bild
// deshalb neu zusammen, statt eine neue Zeichnung zu verlangen:
//   - Krone (die gemalten Zweige) wird auf 80 % der Hoehe hochskaliert;
//     dadurch waechst auch die Breite mit und der Baum bekommt die
//     Silhouette eines Nadelbaums statt die einer Stange
//   - Stamm wird auf den Rest gestaucht und leicht ueberlappt eingesetzt
//   - Stammfarbe wird auf das Mass der anderen Baeume entsaettigt (R-B ~35)
//
// Aufruf: node tools/nadelbaum-neu.mjs [--schreiben]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const schreiben=process.argv.includes('--schreiben');
const QUELLE='assets/tree_conifer.png';
const ZIEL_W=150, ZIEL_H=300, KRONE_ANTEIL=0.80, STAMM_BREITE=34, ZIEL_RminusB=35;

const src='data:image/png;base64,'+readFileSync(QUELLE).toString('base64');
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await (await browser.newContext()).newPage();
await page.goto('about:blank');
const erg=await page.evaluate(async ({src,ZIEL_W,ZIEL_H,KRONE_ANTEIL,STAMM_BREITE,ZIEL_RminusB})=>{
  const im=await new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.src=src;});
  const W=im.naturalWidth, H=im.naturalHeight;
  const a=document.createElement('canvas'); a.width=W; a.height=H;
  const ag=a.getContext('2d'); ag.drawImage(im,0,0);
  const id=ag.getImageData(0,0,W,H), d=id.data;
  // 1) Kronengrenze: letzte Zeile mit gruenen Pixeln
  let kroneUnten=0;
  for(let y=0;y<H;y++){ let gr=0;
    for(let x=0;x<W;x++){ const i=(y*W+x)*4; if(d[i+3]<128) continue;
      if(d[i+1]>d[i]+8 && d[i+1]>d[i+2]+8) gr++; }
    if(gr>2) kroneUnten=y; }
  // 2) Stamm entsaettigen: nur die HOLZ-Pixel (rotdominant), Helligkeit bleibt
  let sR=0,sB=0,n=0;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=(y*W+x)*4; if(d[i+3]<128) continue;
    if(d[i]>d[i+1]+8){ sR+=d[i]; sB+=d[i+2]; n++; } }
  const istRB=n? sR/n-sB/n : 0;
  const k= istRB>0? Math.max(0, Math.min(1, ZIEL_RminusB/istRB)) : 1;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const i=(y*W+x)*4; if(d[i+3]<128) continue;
    if(d[i]<=d[i+1]+8) continue;                       // gruen bleibt gruen
    const L=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
    d[i]  =Math.round(L+(d[i]  -L)*k);
    d[i+1]=Math.round(L+(d[i+1]-L)*k);
    d[i+2]=Math.round(L+(d[i+2]-L)*k);
  }
  ag.putImageData(id,0,0);
  // 3) Neu zusammensetzen
  const z=document.createElement('canvas'); z.width=ZIEL_W; z.height=ZIEL_H;
  const zg=z.getContext('2d');
  zg.imageSmoothingEnabled=true; zg.imageSmoothingQuality='high';
  const kH=Math.round(ZIEL_H*KRONE_ANTEIL);
  const sH=ZIEL_H-kH;
  // Stamm zuerst (liegt hinten), leicht in die Krone hineinragend
  const sQuelleY=kroneUnten+1, sQuelleH=H-sQuelleY;
  zg.drawImage(a, 0, sQuelleY, W, sQuelleH,
               Math.round((ZIEL_W-STAMM_BREITE)/2), kH-6, STAMM_BREITE, sH+6);
  // Krone darueber, auf volle Zielbreite
  const kQuelleH=kroneUnten+1;
  zg.drawImage(a, 0, 0, W, kQuelleH, 0, 0, ZIEL_W, kH);
  // Kennzahlen des Ergebnisses
  const zd=zg.getImageData(0,0,ZIEL_W,ZIEL_H).data;
  let kU=0;
  for(let y=0;y<ZIEL_H;y++){ let gr=0;
    for(let x=0;x<ZIEL_W;x++){ const i=(y*ZIEL_W+x)*4; if(zd[i+3]<128) continue;
      if(zd[i+1]>zd[i]+8 && zd[i+1]>zd[i+2]+8) gr++; }
    if(gr>2) kU=y; }
  let r2=0,b2=0,m2=0;
  for(let y=0;y<ZIEL_H;y++) for(let x=0;x<ZIEL_W;x++){
    const i=(y*ZIEL_W+x)*4; if(zd[i+3]<128) continue;
    if(zd[i]>zd[i+1]+8){ r2+=zd[i]; b2+=zd[i+2]; m2++; } }
  return { alt:{kroneUnten, kroneAnteil:+((kroneUnten+1)/H).toFixed(3), px:W+'x'+H, stammRminusB:Math.round(istRB)},
           neu:{kroneAnteil:+((kU+1)/ZIEL_H).toFixed(3), px:ZIEL_W+'x'+ZIEL_H,
                breiteZuHoehe:+(ZIEL_W/ZIEL_H).toFixed(2),
                stammRminusB: m2? Math.round(r2/m2-b2/m2) : null},
           png:z.toDataURL('image/png') };
}, {src,ZIEL_W,ZIEL_H,KRONE_ANTEIL,STAMM_BREITE,ZIEL_RminusB});
await browser.close();
console.log(JSON.stringify({alt:erg.alt, neu:erg.neu}));
if(schreiben){ writeFileSync(QUELLE, Buffer.from(erg.png.split(',')[1],'base64'));
  console.log('geschrieben:', QUELLE); }
else console.log('(nur gerechnet - mit --schreiben umsetzen)');
