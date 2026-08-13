// Berufs-Tunika-Farben (Figurenplan Stufe 2, Kritik R2: "alle Berufe tragen
// dieselben Erdtoene - auf Spielzoom nicht unterscheidbar"). Je BERUF eine
// feste Kennfarbe, KEINE Zufallsfarben: Foerster moosgruen, Fischer tauben-
// blau, Schmied anthrazit, Mueller hellgrau (Baecker bleibt weiss). Die
// Kennfarben halten Abstand zu den vier Spielerfarben, damit der Fussring
// eindeutig bleibt.
//
// Die Tripo-Modelle haben nur EIN Material mit UV-Atlas-Textur - es gibt
// keine Kleidungs-Maske zum Mitbacken. Stattdessen werden die fertigen
// Blaetter direkt umgefaerbt: die Tunika jedes Berufs liegt in einem eigenen
// Farbton-Fenster (Olive 40-45 Grad, Grauoliv 60, Creme niedrig gesaettigt),
// die Haut ist deutlich davon getrennt (sattes Orange um 25 Grad). Pixel im
// Fenster werden helligkeits-erhaltend auf die Zielfarbe gelegt: die
// Schattierung des Backens bleibt, nur der Ton wechselt.
//
//   node tools/tunika.mjs preview   - Vorher/Nachher-Streifen (Schirm)
//   node tools/tunika.mjs apply     - Blaetter in assets/ ueberschreiben
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HIER=path.dirname(fileURLToPath(import.meta.url));
const ASSETS=path.join(HIER,'..','assets');
const SCRATCH='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad';

// Fenster in HSV (Grad, 0..1, 0..255-Luma); ziel = Kennfarbe des Berufs.
// Haut liegt bei ~25 Grad mit hoher Saettigung - alle Fenster beginnen
// erst ab 35 Grad oder verlangen niedrige Saettigung, dadurch bleiben
// Gesicht und Haende unberuehrt.
const BERUFE={
  forester:{ sets:['walk','idle','atk'], ziel:[95,122,58],    // moosgruen
             fenster:{h0:35,h1:90, s0:0.28,s1:1, l0:20,l1:200} },
  // Fischer: die Tunika ist im Backen stark abgeschattet - reine Ton-
  // Erhaltung ergaebe "dunkle Figur mit blauer Kapuze". hell zieht die
  // Helligkeit ein Stueck zur Zielfarbe, damit das Taubenblau auf
  // Spielzoom traegt; 60 % der Schattierung bleiben erhalten.
  // Fenster nach dem Dick-Bake (v180) geweitet: die frische Backware
  // streut den Tunika-Ton breiter - das enge Fenster ergab Tarnflecken.
  fisher:  { sets:['walk','idle','atk'], ziel:[113,134,156],  // taubenblau
             fenster:{h0:32,h1:100, s0:0.12,s1:0.85, l0:20,l1:205}, hell:0.4 },
  // Schmied: die DUNKLE Kluft wird anthrazit (Ton ab 26, aber nur bis
  // Luma 95) - hellere Lederteile (Schurz, Riemen, Handschuhe) bleiben
  // braun und geben die Binnenzeichnung. Das breite v177-Fenster (bis
  // Luma 120) faerbte den staemmigen Neu-Bake zum schwarzen Klotz, das
  // enge (ab Ton 40) liess ihn ganz braun.
  smith:   { sets:['walk','idle'], ziel:[63,67,71],           // anthrazit
             fenster:{h0:26,h1:95, s0:0.15,s1:1, l0:8,l1:95} },
  // Mueller: bewusst dunkler als der weisse Baecker - "hellgrau", nicht weiss
  miller:  { sets:['walk','idle'], ziel:[168,172,178],        // hellgrau
             fenster:{h0:20,h1:70, s0:0,s1:0.36, l0:110,l1:255} },
};

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
  return [h, mx? d/mx : 0, mx];
}

function faerbe(png, cfg){
  const d=png.data, F=cfg.fenster, T=cfg.ziel, LT=Math.max(24,luma(T[0],T[1],T[2]));
  let n=0;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<40) continue;
    const r=d[i], g=d[i+1], b=d[i+2];
    // Haut-Schutz unabhaengig vom Fenster: sattes helles Orange
    if(r>150 && (r-b)>60 && g>r*0.42 && g<r*0.78) continue;
    const [h,s]=hsv(r,g,b), l=luma(r,g,b);
    if(h<F.h0||h>F.h1||s<F.s0||s>F.s1||l<F.l0||l>F.l1) continue;
    const f=(cfg.hell? l+(LT-l)*cfg.hell : l)/LT;
    d[i]  =Math.min(255,Math.round(T[0]*f));
    d[i+1]=Math.min(255,Math.round(T[1]*f));
    d[i+2]=Math.min(255,Math.round(T[2]*f));
    n++;
  }
  return n;
}

const modus=process.argv[2]||'preview';
for(const beruf in BERUFE){
  const cfg=BERUFE[beruf];
  for(const set of cfg.sets){
    const f=path.join(ASSETS,`unit_${beruf}_${set}.png`);
    if(!fs.existsSync(f)){ console.log(`unit_${beruf}_${set}: FEHLT`); continue; }
    const png=PNG.sync.read(fs.readFileSync(f));
    const n=faerbe(png,cfg);
    if(modus==='apply'){
      fs.writeFileSync(f, PNG.sync.write(png));
      console.log(`unit_${beruf}_${set}: ${n} Pixel`);
    } else {
      const ziel=path.join(SCRATCH,`tunika_${beruf}_${set}.png`);
      fs.writeFileSync(ziel, PNG.sync.write(png));
      console.log(`Vorschau unit_${beruf}_${set}: ${n} Pixel -> ${ziel}`);
    }
  }
}
