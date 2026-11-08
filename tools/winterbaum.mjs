// Kritik R4 G1: tree_winter.png traegt in den Astgabeln und am Stammfuss
// fast schwarze Flecken - 499 von 2255 deckenden Pixeln (22 %) liegen in
// allen drei Kanaelen unter RGB 35, und KEINER von ihnen grenzt an etwas
// Helleres als 158. Es ist also kein Kernschatten eines hellen Schnee-
// klumpens, sondern eine beim Freistellen zu Schwarz gequetschte Flaeche.
// Auf der weissen Winterflaeche liest sich der Baum dadurch als verkohlt.
//
// Korrektur ohne Neuzeichnen: der SCHWARZPUNKT wird angehoben und kuehl
// gestimmt. Mitten und Lichter bleiben, wo sie sind - die Rindenzeichnung
// ueberlebt, nur das Loch darunter verschwindet. Aufruf:
//   node tools/winterbaum.mjs [--pruefen]
import fs from 'fs';
import { PNG } from 'pngjs';

const DATEI='assets/tree_winter.png';
const SICHERUNG='tools/tree_winter_roh.png';
const BODEN=62;        // neuer Schwarzpunkt (vorher gemessen: 8)
const KUEHL=[-6,0,12]; // Blaustich im Schatten: Aussenschatten sind Himmelslicht

const nurPruefen=process.argv.includes('--pruefen');
const src=PNG.sync.read(fs.readFileSync(nurPruefen? DATEI : (fs.existsSync(SICHERUNG)? SICHERUNG : DATEI)));
if(!nurPruefen && !fs.existsSync(SICHERUNG)) fs.copyFileSync(DATEI, SICHERUNG);

let dunkel=0, opak=0, min=255;
for(let i=0;i<src.data.length;i+=4){
  if(src.data[i+3]<200) continue;
  opak++;
  const l=Math.max(src.data[i],src.data[i+1],src.data[i+2]);
  if(l<min) min=l;
  if(src.data[i]<35&&src.data[i+1]<35&&src.data[i+2]<35) dunkel++;
}
console.log(`${DATEI}: ${src.width}x${src.height}, deckend ${opak}, unter RGB35 ${dunkel} (${(dunkel/opak*100).toFixed(1)} %), dunkelster Wert ${min}`);
if(nurPruefen) process.exit(0);

// Lineare Streckung NUR nach unten: alter Bereich [min..255] -> [BODEN..255].
// Damit bleibt Weiss Weiss, und der Abstand zwischen zwei dunklen Toenen
// schrumpft nur so weit, wie es sein muss.
const f=(255-BODEN)/(255-min);
for(let i=0;i<src.data.length;i+=4){
  if(src.data[i+3]<8) continue;
  const l=(src.data[i]+src.data[i+1]+src.data[i+2])/3;
  const t=Math.max(0, Math.min(1, (90-l)/90));      // nur die Schattenzone
  for(let k=0;k<3;k++){
    const alt=src.data[i+k];
    const neu=BODEN+(alt-min)*f + KUEHL[k]*t;
    src.data[i+k]=Math.max(0, Math.min(255, Math.round(alt+(neu-alt)*t)));
  }
}
fs.writeFileSync(DATEI, PNG.sync.write(src));
let dunkel2=0, min2=255;
for(let i=0;i<src.data.length;i+=4){
  if(src.data[i+3]<200) continue;
  const l=Math.max(src.data[i],src.data[i+1],src.data[i+2]);
  if(l<min2) min2=l;
  if(src.data[i]<35&&src.data[i+1]<35&&src.data[i+2]<35) dunkel2++;
}
console.log(`nachher: unter RGB35 ${dunkel2}, dunkelster Wert ${min2} (Sicherung: ${SICHERUNG})`);
