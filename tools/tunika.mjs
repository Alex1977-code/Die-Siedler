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
  // T18 nachgezogen: der Kontrast-Bake dunkelt die Kluft (Luma 20-80) -
  // das alte Rezept (Ziel-Luma 66, kein hell) ergab einen SCHWARZEN Klotz.
  // Ziel eine Stufe heller + hell 0.35 hebt die Schatten, l1 85 laesst
  // die helleren Lederteile braun (Binnenzeichnung).
  smith:   { sets:['walk','idle'], ziel:[80,86,92],            // anthrazit
             fenster:{h0:26,h1:95, s0:0.15,s1:1, l0:8,l1:85}, hell:0.35 },
  // Mueller: bewusst dunkler als der weisse Baecker - "hellgrau", nicht weiss
  miller:  { sets:['walk','idle'], ziel:[168,172,178],        // hellgrau
             fenster:{h0:20,h1:70, s0:0,s1:0.36, l0:110,l1:255} },

  // --- ASTERIX-RUNDE (T5, Nutzerwunsch: Farbstil an den Asterix-Figuren
  // orientiert - hell, klar, comichaft statt Erdton-Einheitsbrei). Die
  // haeufigsten Figuren zuerst; VERMESSEN liegen ihre Tuniken alle im
  // Fenster 20-50 Grad (Olive/Braun), mittel bis dunkel. Alle vier tragen
  // kopfSchutz: die oberste Kopfzone bleibt unangetastet, denn dort sitzt
  // das Braunfenster, aus dem die Laufzeit-Haarmaske (render.haarMaske)
  // die Haare erkennt - eine umgefaerbte Tunika-Runde ohne diesen Schutz
  // wuerde die Haarfarben von v218 zerstoeren.
  // Die Ziele halten Abstand zu den vier Spielerfarben (Blau, Rostrot,
  // Gelbocker, Violett) und den vier alten Kennfarben.
  // hell 0.3 -> 0.5 (T18): der Kontrast-Bake dunkelt die Tunika-Basis,
  // mit 0.3 las sich das Zinnober auf Spielzoom wieder als Braun.
  carrier: { sets:['walk','idle','trag','flee'], ziel:[201,108,46],  // Zinnober-Orange (haeufigste Figur)
             fenster:{h0:18,h1:52, s0:0.15,s1:1, l0:22,l1:165}, hell:0.5, kopfSchutz:true },
  farm:    { sets:['walk','idle','atk'], ziel:[58,132,120],         // Petrol - NICHT gruen: der Bauer steht auf gruener Wiese, Wiesengruen war Tarnfarbe (Sichtpruefung)
             fenster:{h0:18,h1:52, s0:0.15,s1:1, l0:22,l1:165}, hell:0.25, kopfSchutz:true },
  worker:  { sets:['walk','idle'], ziel:[190,172,138],               // helles Leinen
             fenster:{h0:18,h1:52, s0:0.15,s1:1, l0:22,l1:165}, hell:0.35, kopfSchutz:true },
  miner:   { sets:['walk','idle','atk'], ziel:[104,116,134],         // Schieferblau
             fenster:{h0:18,h1:52, s0:0.15,s1:1, l0:22,l1:165}, hell:0.2, kopfSchutz:true },

  // --- ASTERIX-RUNDE 2 (T18, "mehr asterix-stil auch bei den farben"):
  // Kennfarben fuer die restlichen haeufigen Berufe. Abstand geprueft zu
  // den 4 Spielerfarben (#4a6d9c blau, #a84a38 rostrot, #c2a24e ocker,
  // #7d5a8a violett) und den bestehenden Kennfarben. Alle Blaetter dieser
  // Berufe sind frisch gebacken (Kontrast schon drin) - die Fenster sind
  // an den NEUEN Blaettern vermessen. kopfSchutz wie gehabt (Haarmaske).
  // builder: leuchtendes Cyan-Blaugruen - die Baustellen-Figur schlechthin,
  // klar getrennt von Petrol (Bauer, gruener) und Taubenblau (Fischer, grauer)
  // Fenster ENG vermessen (T18): Tunika h~30/s~0.7/Luma 55-170; Guertel
  // (s 0.9) und dunkle Hose (Luma<55) bleiben braun als Binnenzeichnung.
  builder: { sets:['walk','idle','atk'], ziel:[66,148,170],
             fenster:{h0:25,h1:48, s0:0.4,s1:0.78, l0:55,l1:170}, hell:0.3, kopfSchutz:true },
  // woodcutter: Bordeaux - das Holzfaeller-Archetyp-Rot, dunkler und
  // truber als die Spielerfarbe Rostrot (#a84a38, deutlich orangener)
  woodcutter:{ sets:['walk','idle','atk'], ziel:[128,42,46],
             fenster:{h0:25,h1:48, s0:0.4,s1:0.78, l0:55,l1:170}, hell:0.25, kopfSchutz:true },
  // butcher/brewer: Umfaerbung GEPRUEFT und verworfen (T18): der
  // Saettigungspass schiebt die Creme-Schuerze/-Hemden genau in den
  // Haut-Schutzbereich (r>150, r-b>60, g 0.42-0.78r) - ein Fenster ohne
  // diesen Schutz wuerde Haende mitfaerben. Identitaet kommt stattdessen
  // aus Silhouette (DICK_KOPF/KUGEL), Bart und tealfarbenem Hemd (Metzger).
  // geo: Lavendel-Grau - hell und grau genug, um nicht mit der satten
  // Spielerfarbe Violett zu verwechseln (Ring vs. Kleidung)
  // geo-Mantel vermessen: h 20-30, s 0.7-0.9, Luma 20-80 (dunkler und
  // gesaettigter als die Bauarbeiter-Tunika) - eigenes Fenster, kraeftig
  // aufgehellt, sonst bliebe der Lavendel im Dunkel unsichtbar.
  geo:     { sets:['walk','idle','atk'], ziel:[150,136,166],
             fenster:{h0:22,h1:45, s0:0.5,s1:1, l0:30,l1:120}, hell:0.45, kopfSchutz:true },
  // quarry: Steingrau - warm-grau, dunkler als Muellers Hellgrau
  quarry:  { sets:['walk','idle','atk'], ziel:[138,134,126],
             fenster:{h0:25,h1:48, s0:0.4,s1:0.78, l0:55,l1:170}, hell:0.25, kopfSchutz:true },
  // scout: BEWUSST ohne Kennfarbe (T18) - Zipfelmuetze, Feder und
  // Rueckenpack tragen die Identitaet, sein Olivgruen ist schon markant.
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

// Kopfzone je 88er-Zelle markieren (oberste 24 Prozent der deckenden
// Figur) - dieselbe Ortsregel wie render.haarMaske. Die Asterix-Runde
// muss sie schuetzen, sonst faerbt das Tunika-Fenster (20-50 Grad) die
// braunen Haare mit um und die Laufzeit-Haarmaske findet nichts mehr.
function kopfZone(png){
  const CELL=88, W=png.width, H=png.height, d=png.data;
  const schutz=new Uint8Array(W*H);
  const cols=Math.max(1,Math.floor(W/CELL)), rows=Math.max(1,Math.floor(H/CELL));
  for(let cy=0;cy<rows;cy++) for(let cx=0;cx<cols;cx++){
    const x0=cx*CELL, y0=cy*CELL;
    let top=CELL, bot=-1;
    for(let y=0;y<CELL && y0+y<H;y++){
      for(let x=0;x<CELL && x0+x<W;x++){
        if(d[((y0+y)*W+x0+x)*4+3]>120){ if(y<top)top=y; if(y>bot)bot=y; break; }
      }
    }
    if(bot<0) continue;
    const kopf=top+Math.max(3, Math.round((bot-top)*0.24));
    for(let y=top;y<=kopf && y0+y<H;y++)
      for(let x=0;x<CELL && x0+x<W;x++) schutz[(y0+y)*W+x0+x]=1;
  }
  return schutz;
}

function faerbe(png, cfg){
  const d=png.data, F=cfg.fenster, T=cfg.ziel, LT=Math.max(24,luma(T[0],T[1],T[2]));
  const schutz=cfg.kopfSchutz? kopfZone(png) : null;
  let n=0;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<40) continue;
    if(schutz && schutz[i>>2]) continue;
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
// Optional: nur bestimmte Berufe bearbeiten (Komma-Liste als drittes
// Argument). Die v122-Berufe sind auf den Blaettern schon umgefaerbt -
// wer nur die Asterix-Runde anwenden will, laesst sie damit unangetastet.
const nur=(process.argv[3]||'').split(',').filter(Boolean);
for(const beruf in BERUFE){
  if(nur.length && !nur.includes(beruf)) continue;
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
