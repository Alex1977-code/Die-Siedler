// Neuland – Weltkarte: Hex-Punktgitter mit Höhen, Terrain, Objekten und Rohstoffen.
import { TER, OBJ, mulberry32, clamp, BAUM_REIF } from './core.js';

export const TILE = 52;      // horizontaler Knotenabstand (Weltpixel)
export const ROWH = 44;      // Zeilenhöhe
export const HSCALE = 26;    // Höhen-Versatz in Pixel

export class WorldMap {
  constructor(w, h){
    this.w = w; this.h = h;
    const n = w*h;
    this.terr = new Uint8Array(n);
    this.hgt  = new Float32Array(n);
    this.obj  = new Uint8Array(n);      // OBJ-Code
    this.amt  = new Uint8Array(n);      // Menge (Steinhaufen, Feldreife-Timer)
    this.oreT = new Uint8Array(n);      // 0 none,1 coal,2 iron,3 gold,4 granite
    this.oreA = new Uint8Array(n);
    this.fish = new Uint8Array(n);
    this.owner= new Int8Array(n).fill(-1);
    this.bld  = new Int32Array(n).fill(-1);
    this.flag = new Uint8Array(n);
    this.explored = new Uint8Array(n);  // Sicht des menschlichen Spielers
  }
  idx(x,y){ return y*this.w + x; }
  X(i){ return i % this.w; }
  Y(i){ return (i / this.w)|0; }
  inb(x,y){ return x>=0 && y>=0 && x<this.w && y<this.h; }
  // 6 Nachbarn im versetzten Gitter
  nbs(i){
    const x=this.X(i), y=this.Y(i), p=y&1, out=[];
    const c=[[x-1,y],[x+1,y],[x-1+p,y-1],[x+p,y-1],[x-1+p,y+1],[x+p,y+1]];
    for(const [nx,ny] of c) if(this.inb(nx,ny)) out.push(this.idx(nx,ny));
    return out;
  }
  worldPos(i){
    const x=this.X(i), y=this.Y(i);
    return [ (x + (y&1)*0.5)*TILE, y*ROWH - this.hgt[i]*HSCALE ];
  }
  nearestNode(wx, wy){
    // grobe Schätzung + lokale Suche (Höhenversatz berücksichtigen)
    const gy = clamp(Math.round(wy/ROWH), 0, this.h-1);
    let best=-1, bd=1e18;
    // Suchfenster großzügig: durch das Höhenrelief kann ein Knoten mehrere
    // Zeilen weit nach oben versetzt sein
    for(let y=Math.max(0,gy-4); y<=Math.min(this.h-1,gy+4); y++){
      const gx = clamp(Math.round(wx/TILE - (y&1)*0.5), 0, this.w-1);
      for(let x=Math.max(0,gx-2); x<=Math.min(this.w-1,gx+2); x++){
        const i=this.idx(x,y); const [px,py]=this.worldPos(i);
        const d=(px-wx)*(px-wx)+(py-wy)*(py-wy);
        if(d<bd){ bd=d; best=i; }
      }
    }
    return best;
  }
  isWater(i){ return this.terr[i]===TER.WATER; }
  isLand(i){ const t=this.terr[i]; return t!==TER.WATER && t!==TER.LAVA; }
  // Neigung eines Knotens nach Auftrag 2.5: max |Höhendifferenz| über die
  // 6 Nachbarn. WASSER und LAVA zählen nicht mit – der Wasserspiegel liegt
  // fest bei -0,10, ein Uferknoten bekäme sonst allein durch die Küste eine
  // Steilheit angerechnet, die mit Bebaubarkeit nichts zu tun hat.
  slopeMax(i){
    let mx=0;
    for(const b of this.nbs(i)){
      const t=this.terr[b];
      if(t===TER.WATER || t===TER.LAVA) continue;
      const d=Math.abs(this.hgt[i]-this.hgt[b]);
      if(d>mx) mx=d;
    }
    return mx;
  }
  // Knoten, auf dem gebaut werden darf (Terrain-seitig)
  // Auftrag 2.5 fordert zusätzlich zur Geländeart eine NEIGUNGSGRENZE
  // ("buildable: slope <= 2"). Die Zahl 2 stammt aus der Höhenskala der
  // Vorlage und lässt sich nicht wörtlich übernehmen; maßgeblich ist der
  // Sinn: auf einer Wand steht kein Haus. Die Grenze liegt deshalb bei
  // STEIL_MAX (s. computePasses) = 1,80 Höheneinheiten je Knotenschritt,
  // also rund 52 Grad. GEMESSEN über 20 Karten fallen dadurch 1,5 % der
  // bisher bebaubaren Knoten weg – es sind genau die Grasknoten unmittelbar
  // am Wandfuß, auf denen ein Gebäude halb im Fels steckte.
  // this.steil gibt es erst nach computePasses (Ende der Erzeugung bzw.
  // nach dem Laden); vorher greift nur die Geländeart, damit die
  // Startplatzsuche in genWorld unverändert arbeitet.
  terrOkBuild(i){
    const t=this.terr[i];
    if(t!==TER.GRASS && t!==TER.DESERT && t!==TER.SNOW) return false;
    return !(this.steil && this.steil[i]);
  }
  // Bergwerke brauchen eine SCHULTER, keine Wand (Nutzerurteil v95: "die
  // minen kann man anscheinend auch auf steilwände stellen"). Die
  // Gesamtneigung taugt als Kriterium nicht: sie ist an der Schulter am
  // Wandfuß genauso hoch wie in der Wand selbst - GEMESSEN liegen auf
  // Seed 3 alle 18 Minenplätze bei einem Frontabfall unter 1,0, aber 11
  // über der Steilheitsgrenze 1,80. Ein Schacht am Fuß einer aufsteigenden
  // Wand sieht gut aus, einer mitten in der Wand nicht.
  // Unterschieden wird deshalb über die ZAHL der weit entfernten Nachbarn
  // (s. schachtOk in computePasses): an der Schulter liegen nur die
  // bergseitigen weit weg, in der Wandfläche auch die talseitigen.
  terrOkMine(i){
    if(this.terr[i]!==TER.MOUNT) return false;
    return !(this.schachtOk && !this.schachtOk[i]);
  }
  terrOkRoad(i){ const t=this.terr[i]; return t===TER.GRASS||t===TER.DESERT||t===TER.SNOW||t===TER.MOUNT||t===TER.SWAMP; }
  // Pässe: Sattelstellen, an denen ein Gebirgszug durchquerbar ist. Sie
  // ergeben sich eindeutig aus Gelände und Höhe und werden deshalb nach dem
  // Erzeugen UND nach dem Laden neu berechnet – kein zusätzliches Speicherfeld.
  computePasses(){
    const n=this.w*this.h;
    this.pass=new Uint8Array(n);
    // Abgeleitete Neigungsmaske (Auftrag 2.5: "Masken einmal vorberechnen").
    // Sie hängt nur an Höhe und Geländeart, ändert sich im Spiel also nie –
    // deshalb steht sie NICHT im Spielstand, sondern wird hier miterzeugt.
    // computePasses läuft am Ende der Erzeugung UND nach dem Laden; damit
    // hat jeder Spielstand die Maske, auch ein alter.
    const STEIL_MAX=1.80;
    this.steil=new Uint8Array(n);
    for(let i=0;i<n;i++) if(this.slopeMax(i)>STEIL_MAX) this.steil[i]=1;
    // SCHACHTMASKE für Bergwerke (s. terrOkMine). Zwei Bedingungen, beide
    // an der Höhe abgeleitet, also kein zusätzliches Speicherfeld:
    //   höchstens 2 Landnachbarn weiter als STEIL_MAX weg - mehr heißt
    //     Wandfläche statt Schulter
    //   vor dem Eingang (untere Knotenreihe, dort liegt die Türfahne und
    //     läuft der Träger) darf der Boden höchstens SCHACHT_VORN abfallen,
    //     sonst hängt das Bild über der Kante
    // GEMESSEN über 5 Karten: die Regel nimmt 11-12 % der kartenweiten
    // Minenplätze weg (1284->1139 auf Seed 3) und trifft dabei genau die
    // 6 Plätze, die dort mit 3-4 weiten Nachbarn in einer Wand steckten.
    const SCHACHT_VORN=1.80;
    this.schachtOk=new Uint8Array(n);
    for(let i=0;i<n;i++){
      if(this.terr[i]!==TER.MOUNT) continue;
      let weit=0, vorn=0;
      for(const q of this.nbs(i)){
        const t=this.terr[q];
        if(t===TER.WATER || t===TER.LAVA) continue;
        const d=this.hgt[i]-this.hgt[q];
        if(Math.abs(d)>STEIL_MAX) weit++;
        if(this.Y(q)>this.Y(i) && d>vorn) vorn=d;
      }
      if(weit<=2 && vorn<=SCHACHT_VORN) this.schachtOk[i]=1;
    }
    const rocky=(q)=> this.terr[q]===TER.MOUNT||this.terr[q]===TER.SNOW;
    const score=new Float32Array(n);
    for(let i=0;i<n;i++){
      if(this.terr[i]!==TER.MOUNT) continue;
      const x=this.X(i), y=this.Y(i), p=y&1;
      // am Kartenrand fällt das Gelände ohnehin ab – dort ist kein echter Pass
      if(x<4||y<4||x>this.w-5||y>this.h-5) continue;
      // Nachbarn als gegenüberliegende Paare: West/Ost, NW/SO, NO/SW
      const at=(nx,ny)=> this.inb(nx,ny)? this.idx(nx,ny) : -1;
      const PAIRS=[[at(x-1,y), at(x+1,y)],
                   [at(x-1+p,y-1), at(x+p,y+1)],
                   [at(x+p,y-1), at(x-1+p,y+1)]];
      for(let k=0;k<3;k++){
        const [a2,b2]=PAIRS[k];
        if(a2<0||b2<0) continue;
        // Durchgang: BEIDE Seiten offen und tiefer als der Sattel
        if(rocky(a2)||rocky(b2)) continue;
        if(this.hgt[a2]>this.hgt[i]-0.25 || this.hgt[b2]>this.hgt[i]-0.25) continue;
        // Schultern: die vier übrigen Nachbarn müssen Fels sein und
        // deutlich aufragen – sonst ist es kein Sattel, sondern eine Lücke
        let sh=0, lift=0;
        for(let j=0;j<3;j++){
          if(j===k) continue;
          for(const q of PAIRS[j]){
            if(q<0 || !rocky(q)) continue;
            const d=this.hgt[q]-this.hgt[i];
            if(d>0.6){ sh++; lift+=d; }
          }
        }
        if(sh>=2) score[i]=Math.max(score[i], lift);
      }
    }
    // nur die markantesten Sattel behalten und weiträumig ausdünnen
    const cand=[];
    for(let i=0;i<n;i++) if(score[i]>0) cand.push(i);
    cand.sort((a2,b2)=>score[b2]-score[a2]);
    const blocked=new Uint8Array(n);
    let kept=0;
    const MAXP=Math.max(2, Math.round(n/900));      // ~1 Pass je 900 Knoten
    for(const i of cand){
      if(blocked[i] || kept>=MAXP) continue;
      this.pass[i]=1; kept++;
      // Sperrradius 4, damit Pässe eines Zuges nicht aneinanderkleben
      let ring=[i]; blocked[i]=1;
      for(let d=0; d<4; d++){
        const nx=[];
        for(const q of ring) for(const r of this.nbs(q))
          if(!blocked[r]){ blocked[r]=1; nx.push(r); }
        ring=nx;
      }
    }
  }
  bfsDist(a,b,maxD){
    if(a===b) return 0;
    const seen=new Map([[a,0]]); let q=[a];
    for(let d=1; d<=maxD; d++){
      const nq=[];
      for(const i of q) for(const n of this.nbs(i)){
        if(seen.has(n)) continue;
        seen.set(n,d);
        if(n===b) return d;
        nq.push(n);
      }
      q=nq; if(!q.length) break;
    }
    return Infinity;
  }
}

// ---------------- Kartengenerator ----------------
// theme: gruen | winter | wueste | vulkan | sumpf | inseln | gebirge
export function genWorld(opts){
  // Kartengroessen. Vorher war selbst "Gross" nach wenigen Gebaeuden
  // ausgereizt - eine Siedlung braucht Luft zum Wachsen und Platz fuer
  // Nachbarn, Gebirge und Kueste.
  const sizes = { S:[96,96], M:[128,128], L:[160,160] };
  const [w,h] = Array.isArray(opts.size) ? opts.size : (sizes[opts.size]||sizes.M);
  const rng = mulberry32(opts.seed>>>0);
  const map = new WorldMap(w,h);
  const theme = opts.theme || 'gruen';
  const res = opts.resources ?? 1;      // 0.6 knapp, 1 normal, 1.5 üppig
  const nPl = opts.playersN || 1;

  // Wertrauschen (fbm)
  const gs = 8, gw = Math.ceil(w/gs)+2, gh = Math.ceil(h/gs)+2;
  const mkGrid = ()=> Float32Array.from({length:gw*gh}, ()=> rng());
  const grids = [mkGrid(), mkGrid(), mkGrid(), mkGrid()];
  // Das Gitter wird UMLAUFEND gelesen, nicht geklemmt. Vorher stand hier
  // clamp() - und weil die Aufrufer die Frequenz ueber den Faktor vor x
  // machen (Wald X*2.6+71, Lichtung X*7.3, Feinrelief x*9.1), lag der
  // Lesepunkt schon ab X=13 hinter der letzten Gitterspalte. Auf einer
  // 96er Karte waren damit 87 Prozent der Breite und ebenso viel der Hoehe
  // geklemmt: ueber gut drei Viertel der Flaeche lieferte das Waldrauschen
  // EINEN einzigen Wert. Ob eine Karte Urwald oder Steppe wurde, entschied
  // eine einzige Zufallszahl - gemessen 57 Baeume bei Saat 11071 gegen
  // 1703 bei Saat 11, gleiche Groesse, gleiches Thema.
  // Umlaufend wiederholt sich das Rauschen stattdessen mit gw*gs/Frequenz
  // Knoten (Wald rund 43, Lichtungen rund 15) - das ist genau die
  // Bestandsgroesse, die hier gemeint ist, und die Grossform der
  // Landschaft (Frequenz 1, Periode 112 > 96) wiederholt sich gar nicht.
  const wrp = (v,n)=>{ const r=v%n; return r<0? r+n : r; };
  const sample = (g, x, y)=>{
    const fx=x/gs, fy=y/gs, x0=Math.floor(fx), y0=Math.floor(fy), tx=fx-x0, ty=fy-y0;
    const sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
    const v=(xx,yy)=> g[wrp(yy,gh)*gw + wrp(xx,gw)];
    return (v(x0,y0)*(1-sx)+v(x0+1,y0)*sx)*(1-sy) + (v(x0,y0+1)*(1-sx)+v(x0+1,y0+1)*sx)*sy;
  };
  // Großform der Landschaft: entscheidet über Wasser/Land/Gebirge
  const fbm = (x,y)=> sample(grids[0],x,y)*0.55 + sample(grids[1],x*2.1+7,y*2.1+3)*0.3 + sample(grids[2],x*4.3+13,y*4.3+11)*0.15;
  // Feinrelief: NUR für die Darstellungshöhe – erzeugt die Hügeligkeit,
  // ohne die Geländeverteilung (und damit das Spielgefühl) zu verändern
  const detail = (x,y)=> sample(grids[3],x*9.1+29,y*9.1+19)*0.62
                       + sample(grids[2],x*4.6+61,y*4.6+37)*0.38 - 0.5;
  // Gratrauschen: 1-|2n-1| hat sein Maximum auf einer LINIE, nicht auf einer
  // Fläche. Als QUELLE des Gebirges taugt es deshalb nicht – jede Schwelle
  // darauf liefert zwangsläufig schmale, gewundene Rippen (am alten Stand
  // gemessen: Median-Dicke 3 Knoten, Achsverhältnis 2,4-3,0 – das gemeldete
  // "Bandwurmgebirge"). Es bleibt erhalten, moduliert jetzt aber nur noch die
  // OBERFLÄCHE eines Massivs: Grate, Rinnen und Sporne auf einem Körper, der
  // anderswo entsteht (siehe Abschnitt Gebirgsmassive).
  //
  // Auftrag 2.4: RIDGED MULTIFRACTAL statt einer glatten Summe von drei
  // Gratoktaven, dazu DOMAIN WARPING gegen parallele Rücken.
  //  – Multifractal heißt: jede Oktave wird mit dem SIGNAL der vorigen
  //    gewichtet. Wo die grobe Oktave schon einen Grat hat, darf die feine
  //    weiterzeichnen; in den Mulden wird sie unterdrückt. Erst dadurch
  //    VERZWEIGEN sich die Rücken, statt sich gleichmäßig zu überlagern.
  //  – sig*sig schärft den Grat: ohne die Quadratur liegt das Maximum von
  //    1-|2n-1| auf einem breiten Rücken, mit ihr auf einer Kante.
  //  – Domain Warping verschiebt die Abtaststelle mit einem langsamen
  //    Rauschfeld. Ohne es laufen die Grate eines Ridged-Multifractal
  //    auffällig parallel in eine Richtung (das Rauschgitter schlägt durch);
  //    mit ihm mäandern sie und bilden Sporne.
  const WARP = 2.4;                        // Verschiebung in Knoten
  const RIDGE_SEED = [[91,53],[17,29],[61,11],[131,197],[7,113]];
  const ridgeAt = (x,y)=>{
    const wx = x + (sample(grids[0], x*0.55+211, y*0.55+83 )-0.5)*WARP;
    const wy = y + (sample(grids[1], x*0.55+37,  y*0.55+167)-0.5)*WARP;
    let sum=0, freq=1.35, amp=0.58, weight=1;
    for(let o=0;o<5;o++){
      const S=RIDGE_SEED[o];
      let sig = 1-Math.abs(sample(grids[o%4], wx*freq+S[0], wy*freq+S[1])*2-1);
      sig *= sig;
      sig *= weight;
      sum += sig*amp;
      weight = clamp(sig*2.2, 0, 1);
      freq *= 2.07; amp *= 0.55;
    }
    // Normierung, an 4 Karten (Seeds 3/7/12/21, je 128x128 Knoten) GEMESSEN
    // statt geschätzt: die rohe Summe hat im Mittel 0,351 (p50 0,09-0,68,
    // p99 0,90), die alte Fassung lag bei 0,581. Faktor 1,55 legt den
    // Mittelwert auf 0,544 – das Höhenprofil der Massive bleibt damit so
    // kalibriert wie bisher, nur die VERTEILUNG ist eine andere: statt eines
    // breiten Mittelfelds jetzt viel ruhige Flanke mit einzelnen scharfen
    // Graten. Die obersten rund 4 % laufen in den Deckel bei 1 – das kappt
    // genau die spitzesten Gratkronen und stützt damit die Vorgabe
    // "gedrungene, gerundete Massive statt alpiner Nadeln".
    return clamp(sum*1.55, 0, 1);
  };

  // Inselmaske: Rand fällt ab
  const edge = (x,y)=>{
    const dx=Math.min(x, w-1-x)/(w*0.5), dy=Math.min(y, h-1-y)/(h*0.5);
    const d=Math.min(dx,dy);
    return clamp(d*2.4, 0, 1);
  };
  const islandF = theme==='inseln' ? 1.6 : 1.0;

  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=map.idx(x,y);
    let e = fbm(x,y) * Math.pow(edge(x,y), islandF*0.7);
    if(theme==='inseln') e *= 0.75 + 0.5*sample(grids[1], x*1.3+31, y*1.3+17);
    if(theme==='gebirge') e = e*0.8 + 0.35*Math.pow(sample(grids[2],x*1.7,y*1.7),2)+0.08;
    map.hgt[i]=e;
  }

  const SEA = theme==='inseln'?0.34: theme==='gebirge'?0.24: 0.30;
  const AMP = 4.2;                       // Reliefüberhöhung (Höhe -> Bildversatz)
  const raw = Float32Array.from(map.hgt);

  // ---------------- Gebirgsmassive ----------------
  // Ein Massiv ist ein KÖRPER: Mittelpunkt, welliger Umriss, Höhenprofil vom
  // Fuß zum Gipfel. Vorher entstand Fels aus einer Schwelle auf dem
  // Gratrauschen – das ergab zwangsläufig 2-4 Knoten schmale Bänder quer über
  // die Karte. Jetzt werden einzelne Körper gesetzt; berühren sie sich am
  // Rand, wächst daraus ein Gebirgsstock mit Ausläufern statt eines
  // Rippennetzes.
  //
  // Formen:  'kuppe' – geschlossener Stock mit ein bis drei Gipfeln
  //          'ring'  – Kessel: Bergkranz um ein Tal, mit Pass-Durchlass
  //
  // RINGMASSIV GEZIELT ANFORDERN (für Kampagnenkarten):
  //     genWorld({ ..., ringMassiv:true })  -> das erste Massiv wird Kessel
  //     genWorld({ ..., ringMassiv:3 })     -> die ersten drei werden Kessel
  //   Ohne Angabe entscheidet RING_P; zusammen mit der Obergrenze RING_MAX
  //   (s.u.) ergibt das gemessen über 40 Karten jede 5,0. Massivsetzung.
  //   genWorld liefert die gesetzten Körper als `massive` zurück
  //   ([{cx,cy,R,form}]) – daran findet ein Kampagnenskript den Kessel wieder.
  const ROWQ = ROWH/TILE;                // Zeilenabstand im Spaltenmaß
  const RING_P = 0.26;

  // Ein Massiv beschreiben. Alle Zufallszahlen stammen aus dem Karten-Seed.
  const macheMassiv = (cx, cy, R, form)=>{
    const M = { cx, cy, R, form,
      p1:rng()*6.2832, p2:rng()*6.2832, p3:rng()*6.2832,
      // drei Harmonische verbeulen den Umriss: rundlich-unregelmäßig,
      // aber ohne Einschnürung, die den Körper in ein Band zerlegen würde
      a2:0.13+rng()*0.12, a3:0.08+rng()*0.09, a5:0.04+rng()*0.06,
      dreh:rng()*3.1416,
      // Streckung gedeckelt: ein Massiv darf länglich sein, nie ein Band
      streck:1.00+rng()*0.26,
      // ASYMMETRIE (Auftrag 1.2: "Flanken asymmetrisch – eine steile
      // Abbruchseite, eine flach auslaufende Geröllseite. Nie beidseitig
      // gleich steil."). abbruch ist der Weltwinkel der Steilseite; auf ihr
      // ist der Körper KURZ (der Fuß liegt nah am Kern, das Profil steht
      // steil), auf der Gegenseite läuft er weit aus. Umgesetzt als
      // richtungsabhängige Skalierung des Fußradius in massivWert.
      abbruch:rng()*6.2832,
      asym:0.20+rng()*0.14,
      gipfel:[], paesse:[] };
    // Gipfelpunkte: beim Stock im Kern, beim Kessel auf dem Kranz. Ein
    // Hauptgipfel, dazu ein bis zwei Nebengipfel – kein gleichmäßiges Plateau.
    const nG = form==='ring' ? 2+((rng()*3)|0) : 1+((rng()*3)|0);
    for(let k=0;k<nG;k++){
      const th = rng()*6.2832;
      const rr = form==='ring' ? 0.58+rng()*0.18 : 0.04+rng()*0.28;
      // lokale Polarkoordinate in Weltkoordinaten zurückrechnen
      const u=Math.cos(th)*rr*R*M.streck, v=Math.sin(th)*rr*R/M.streck;
      const cs=Math.cos(M.dreh), sn=Math.sin(M.dreh);
      // Gipfelbreite (Nutzervorgabe "Silhouetten runder und gedrungener,
      // keine spitzen alpinen Nadeln"): 0,13-0,23 R ergab bei R=12 Knoten
      // eine Gauss-Halbwertsbreite von nur 1,9 Knoten – auf dem Bildschirm
      // eine Nadel. Jetzt 0,22-0,34 R, also 3,3 Knoten: eine gerundete
      // Kuppe, die den Grat trägt statt ihn zu durchstoßen.
      M.gipfel.push({ x:cx+u*cs-v*sn, y:cy+u*sn+v*cs,
                      hoch:(k===0?1.0:0.48+rng()*0.34), br:R*(0.22+rng()*0.12) });
    }
    // Kessel: ein bis zwei Pässe schneiden den Kranz auf, damit das Tal
    // begehbar UND bebaubar bleibt (sonst ist die Fläche für den Spieler
    // wertlos). Der Pass ist ein SCHLITZ konstanter Breite in Knoten, kein
    // Winkelfenster: ein Winkelfenster kneift am Talrand auf einen halben
    // Knoten zu (dort ist der Radius klein) und reißt außen unnötig weit auf –
    // der Kranz sähe dann wie ein Hufeisen aus.
    if(form==='ring'){
      const nP = 1+(rng()<0.22?1:0);
      for(let k=0;k<nP;k++) M.paesse.push({ th:rng()*6.2832, breite:1.2+rng()*0.5 });
    }
    return M;
  };

  // Massivstärke an einem Weltpunkt: 1 im Kern, 0 am Fuß, negativ außerhalb.
  const massivWert = (M, px, py)=>{
    const dx=px-M.cx, dy=py-M.cy;
    const cs=Math.cos(M.dreh), sn=Math.sin(M.dreh);
    const u=(dx*cs+dy*sn)/M.streck, v=(-dx*sn+dy*cs)*M.streck;
    const r=Math.hypot(u,v);
    if(r>M.R*1.45) return -9;              // Fernfeld-Kennwert, s.u. in stempeln
    const th=Math.atan2(v,u);
    let Rl=M.R*(1 + M.a2*Math.sin(2*th+M.p1) + M.a3*Math.sin(3*th+M.p2)
                    + M.a5*Math.sin(5*th+M.p3));
    // Asymmetrie: auf der Abbruchseite schrumpft der Fußradius, auf der
    // Gegenseite wächst er. Bei asym=0,27 (Mittelwert) unterscheiden sich
    // die beiden Flankenlängen um Faktor 1,74. GEMESSEN über 20 Karten als
    // Verhältnis der mittleren Neigung im steilsten zum flachsten von acht
    // Sektoren je Massiv: vorher Median 1,84 – nachher 2,20.
    const dth9=Math.cos(th-M.abbruch);
    Rl *= 1 - M.asym*dth9;
    const t=r/Math.max(0.5,Rl);
    if(M.form!=='ring') return 1-t;
    // Kranzprofil: breiter Kamm mit flachem Scheitel, nach innen wie außen auf
    // 0. Der INNENrand rechnet mit dem unverbeulten Radius – sonst zieht eine
    // Delle des Umrisses das Tal zu und der Kessel hat keinen Boden mehr.
    // Der Außenrand folgt dem verbeulten Umriss und bleibt unregelmäßig.
    const tIn=r/M.R;
    let s=Math.min(1, (tIn-0.30)/0.27, (1.02-t)/0.27);
    // Pässe: ein Schlitz konstanter Breite vom Tal nach außen. Im Kern ganz
    // offen (der Abzug übersteigt jede mögliche Kranzhöhe, das Umrissrauschen
    // kann ihn nicht zuwachsen lassen), daneben ein Saum von einem Knoten.
    for(const p of M.paesse){
      const dth=th-p.th;
      const entlang=r*Math.cos(dth), quer=Math.abs(r*Math.sin(dth));
      if(entlang<=0) continue;                       // nur in Pass-Richtung
      if(quer<p.breite) s-=2.0;
      else if(quer<p.breite+1.0) s-=2.0*(1-(quer-p.breite)/1.0);
    }
    return s;
  };

  const mv     = new Float32Array(w*h);   // Massivstärke 0..1 (0 = Ebene)
  const mtop   = new Float32Array(w*h);   // Gipfelaufsatz
  const kessel = new Uint8Array(w*h);     // Talboden eines Ringmassivs
  const fuss   = new Uint8Array(w*h);     // Vorland ringsum (Bergfuß)
  const massive = [];

  // Ein Massiv in die Felder stempeln; liefert den betroffenen Kasten zurück.
  const stempeln = (M)=>{
    const y0=Math.max(0, Math.floor((M.cy-M.R*1.5)/ROWQ));
    const y1=Math.min(h-1, Math.ceil((M.cy+M.R*1.5)/ROWQ));
    const x0=Math.max(0, Math.floor(M.cx-M.R*1.5));
    const x1=Math.min(w-1, Math.ceil(M.cx+M.R*1.5));
    for(let Y=y0;Y<=y1;Y++) for(let X=x0;X<=x1;X++){
      const i=map.idx(X,Y), px=X+(Y&1)*0.5, py=Y*ROWQ;
      let s=massivWert(M,px,py);
      // NUR das Fernfeld überspringen. Nicht nach s abschneiden: im Pass-
      // Schlitz ist s stark negativ, und genau dort müssen Vorland- und
      // Talmarke gesetzt werden – sonst bliebe der Durchlass im Winter
      // Schnee und der Zeichner läse ihn als Massivfläche.
      if(s<=-8) continue;
      // ausgefranster Saum: das Rauschen verbeult nur den äußersten Rand,
      // der Körper selbst bleibt geschlossen
      s += (sample(grids[3], X*2.7+M.cx*3.1, Y*2.7+M.cy*2.3)-0.5)*0.34;
      if(s<=0){
        fuss[i]=1;                       // Vorland: reicht bis rund 1,4 R
        // Talsystem eines Kessels merken: der Talboden UND der Pass-Einschnitt.
        // Beides wird zu Wiese (siehe gelaendeSchreiben) – ein Pass aus
        // Schnee, rundum von Fels umschlossen, läse der Zeichner sonst als
        // Massivfläche und der Durchlass wäre optisch zugemauert.
        if(M.form==='ring'){
          const rr=Math.hypot(px-M.cx,py-M.cy);
          if(rr < M.R*0.42) kessel[i]=1;
          else if(rr < M.R*1.15){
            const th=Math.atan2(py-M.cy, px-M.cx);
            for(const p of M.paesse){
              const dth=th-p.th;
              if(rr*Math.cos(dth)>0 && Math.abs(rr*Math.sin(dth)) < p.breite+1.0){ kessel[i]=1; break; }
            }
          }
        }
        continue;
      }
      if(s>1) s=1;
      if(s>mv[i]) mv[i]=s;
      let g0=0;
      for(const G of M.gipfel){
        const d=Math.hypot(px-G.x, py-G.y)/G.br;
        if(d<2.6) g0+=G.hoch*Math.exp(-d*d);
      }
      if(g0>mtop[i]) mtop[i]=g0;
    }
    massive.push(M);
    return {x0,x1,y0,y1};
  };

  // Schwelle und Rampe der Plateau-Quantisierung (s.u. in gelaendeSchreiben).
  // PLAT_H liegt über der welligen Ebene (die erreicht mit AMP=4,2 selten
  // mehr als 2,0) und knapp über dem Bergfuß. GEMESSEN über 20 Karten liegen
  // 39,3 % der Felsknoten oberhalb PLAT_H+PLAT_BAND, tragen also die volle
  // Plateaustufe (vorher, ohne diesen Umbau: 31,3 %).
  // v96 - Nutzerurteil "wenig plateau". GEMESSEN am GEZEICHNETEN Relief
  // (Massivmaske MOUNT+SNOW, Innenflaeche ab Randreihe 3): flach waren dort
  // nur 0,21-0,33 der Knoten, die groesste zusammenhaengende Hochflaeche
  // umfasste 41-92 Knoten. Das ist keine Frage der Darstellung, das steht so
  // im Hoehenmodell. Schwelle runter und Stufe hoeher: mehr vom Berg faellt
  // in den Plateaubereich, und die Stufen dort werden groeber, also die
  // Flaechen dazwischen breiter.
  const PLAT_H=2.0, PLAT_BAND=1.6;
  // Gelände und Darstellungshöhe aus Grundrelief + Massivfeld schreiben.
  // Als Funktion, weil der Hausberg (s.u.) einen Ausschnitt nachträglich
  // neu schreiben muss.
  const gelaendeSchreiben = (x0,x1,y0,y1)=>{
    for(let Y=y0;Y<=y1;Y++) for(let X=x0;X<=x1;X++){
      const i=map.idx(X,Y);
      const e=raw[i], sp=mv[i];
      if(e < SEA){ map.terr[i]=TER.WATER; }
      else if(sp > 0){
        // Kern vereist, Flanke blanker Fels
        map.terr[i] = (sp>0.62 && (theme==='winter'||theme==='gebirge')) ? TER.SNOW : TER.MOUNT;
      }
      else {
        map.terr[i]=TER.GRASS;
        const m2 = sample(grids[2], X*1.9+53, Y*1.9+29);
        if(theme==='wueste' && m2>0.35) map.terr[i]=TER.DESERT;
        if(theme==='gruen' && m2>0.87) map.terr[i]=TER.SWAMP;
        if(theme==='sumpf' && m2>0.52) map.terr[i]=TER.SWAMP;
        // Im Winter bleibt der BERGFUSS schneefrei (aperes Vorland). Das gibt
        // dem Massiv den grünen Saum, den es sonst nur in milden Themen hat –
        // und es verhindert, dass eine ringsum von Fels eingeschlossene
        // Schneeebene vom Zeichner als Massivfläche gelesen wird (massifSnow):
        // sie bekäme Felstextur, und ein Pass durch sie hindurch wäre optisch
        // zugemauert.
        if(theme==='winter' && m2>0.45 && !fuss[i]) map.terr[i]=TER.SNOW;
        if(theme==='vulkan'){ if(m2>0.84) map.terr[i]=TER.LAVA; else if(m2>0.6) map.terr[i]=TER.DESERT; }
        // Talboden eines Kessels ist WIESE. Ein Sumpf- oder Lavatal wäre
        // unbebaubar (und genau das Bauen ist der Reiz des Bergkessels); ein
        // reines Schneetal würde der Zeichner obendrein als Massivfläche
        // lesen, weil es rundum von Fels umschlossen ist – der Kessel bekäme
        // dann Felstextur statt Talboden.
        if(kessel[i]) map.terr[i]=TER.GRASS;
      }
      let hv;
      if(map.terr[i]===TER.WATER) hv=-0.10;                // Wasserspiegel unter Land
      else {
        // Ebene sanft gewellt; im Massiv tritt das Feinrelief zurück, damit
        // das Profil des Körpers die Form bestimmt und nicht das Rauschen
        hv=(e-SEA)*AMP + detail(X,Y)*2.1*(1-0.55*sp);
        if(sp>0){
          // Profil vom Fuß zum Gipfel: der Exponent unter 1 zieht den Fuß
          // breit auseinander (dort greift das Moosband des Zeichners), die
          // Gipfelaufsätze setzen einzelne Spitzen statt eines Plateaus.
          // Das Gratrauschen moduliert nur die Flanke – Grate und Rinnen auf
          // dem Körper, keine eigenständige Form mehr.
          hv += Math.pow(sp,0.70)*4.5*(0.80+0.38*ridgeAt(X,Y))
              + Math.pow(sp,1.8)*1.1
              + mtop[i]*1.9;
        }
      }
      // Fels rastet auf GANZE Höhenstufen ein – so verlangt es die Vorlage
      // aus dem Auftrag. Erst dadurch entstehen die klar getrennten
      // Facettenbänder, aus denen das Gebirge gelesen wird; Zwischenhöhen
      // verwischen sie.
      const rocky = map.terr[i]===TER.MOUNT || map.terr[i]===TER.SNOW || map.terr[i]===TER.LAVA;
      let step = rocky? 0.55 : 0.42;
      const q  = rocky? 1.00 : 0.14;
      // PLATEAUBILDUNG (Auftrag 2.4: "Quantisierung der Höhe auf Vielfache
      // von N Stufen oberhalb einer Schwelle"). Unterhalb PLAT_H bleibt die
      // feine 0,55er-Rasterung – dort braucht die Flanke ihre Zeichnung.
      // Darüber wächst die Stufe auf das Dreifache; aus dem gleichmäßigen
      // Treppenhang werden dadurch breite, WAAGERECHTE Hochflächen mit
      // wenigen hohen Absätzen dazwischen. Genau die sind der Minenstandort
      // aus 1.2 ("ohne Plateau ist der Berg spielerisch tot").
      // Die Rampe über PLAT_BAND verhindert einen sichtbaren Ring an der
      // Schwelle: der Übergang von feiner zu grober Stufe ist stetig.
      if(rocky && hv>PLAT_H){
        const pf=Math.min(1,(hv-PLAT_H)/PLAT_BAND);
        // v98: Faktor 2 -> 3,2 -> 4,6. Die Zahl ist NICHT geraten, sondern
        // aus einer Messreihe: sechs Kombinationen aus Schwelle und Faktor,
        // je drei Karten, gemessen am Flachanteil der Innenfläche und an der
        // grössten zusammenhängenden Hochfläche.
        //   2,0 / 3,2 (v96):  0,326 Mittel, grösste 61 Knoten
        //   1,4 / 3,2:        0,311             53
        //   2,0 / 4,6:        0,453             90   <- gewählt
        //   1,4 / 4,6:        0,371             90
        //   1,4 / 6,0:        0,440            105   aber 0,385/0,538/0,397,
        //                                      also stark kartenabhängig
        //   0,9 / 4,6:        0,399             90
        // 2,0/4,6 ist der beste Wert UND der gleichmässigste über die
        // Karten. Ein per-Massiv geschnittener Etagenpass wurde vorher
        // versucht und wieder verworfen: in allen drei Fassungen fiel der
        // Flachanteil, weil jede Nachbearbeitung die exakt gleichen Höhen,
        // die diese Quantisierung erzeugt, wieder auseinanderzieht.
        step *= 1+4.6*pf;
      }
      map.hgt[i] = hv*(1-q) + Math.round(hv/step)*step*q;
    }
  };

  // Anzahl und Größe der Massive je Thema. Wenige große Körper: ein Massiv
  // soll typisch 10-24 Knoten Durchmesser haben, nicht 2-4 Knoten Breite.
  const MPAR = { gebirge:{d:0.58, r:[10.0,15.5]}, winter:{d:0.34, r:[6.5,11.0]},
                 vulkan:{d:0.36, r:[6.5,11.0]},  wueste:{d:0.26, r:[5.5,9.5]},
                 sumpf:{d:0.22, r:[5.0,8.5]},    inseln:{d:0.26, r:[5.0,8.5]},
                 gruen:{d:0.36, r:[6.0,10.5]} }[theme] ?? {d:0.36, r:[6.0,10.5]};
  const ZIEL = Math.max(2, Math.round(MPAR.d*w*h/1000));
  // Kessel bleiben die Ausnahme: höchstens rund jedes vierte Massiv, sonst
  // prägen sie die Karte statt sie zu würzen.
  const RING_MAX = Math.max(1, Math.round(ZIEL/4));
  let ringSoll = opts.ringMassiv===true ? 1 : (opts.ringMassiv|0);
  let ringeGesetzt = 0;
  for(let k=0;k<ZIEL;k++){
    const ring = ringSoll>0 ? true : (ringeGesetzt<RING_MAX && rng()<RING_P);
    let R = MPAR.r[0] + rng()*(MPAR.r[1]-MPAR.r[0]);
    if(ring) R = Math.max(R, MPAR.r[1])*1.12;   // ein Kessel braucht Umfang
    let bx=-1, by=-1, bs=-1;
    for(let t=0;t<220;t++){
      const cx = R*0.75 + rng()*Math.max(1, w-1-R*1.5);
      const cy = R*0.75 + rng()*Math.max(1, (h-1)*ROWQ-R*1.5);
      // Mindestabstand: Massive dürfen sich am Saum berühren, aber nicht
      // ineinander sacken – sonst entsteht wieder ein zusammenhängender Teppich
      let frei=true;
      for(const M of massive) if(Math.hypot(cx-M.cx,cy-M.cy) < 0.92*(R+M.R)){ frei=false; break; }
      if(!frei) continue;
      // Untergrund: der Körper muss überwiegend auf Land stehen. Beim Kessel
      // zusätzlich das TAL prüfen – ein Ring um eine Bucht ergäbe ein
      // abgeriegeltes Wasserloch statt einer nutzbaren Talwiese.
      let land=0, prob=0, hs=0, innenNass=false;
      for(let a=0;a<13;a++){
        const rr = a===0?0 : R*(a<7?0.5:0.9), th=a*1.35;
        const X=Math.round(cx+Math.cos(th)*rr), Y=Math.round((cy+Math.sin(th)*rr)/ROWQ);
        if(X<0||Y<0||X>=w||Y>=h) continue;
        prob++; const q2=map.idx(X,Y);
        if(raw[q2]>=SEA){ land++; hs+=raw[q2]; }
        else if(rr<R*0.55) innenNass=true;
      }
      if(prob<8 || land<prob*(ring?0.92:0.74)) continue;
      if(ring && innenNass) continue;
      const sc = hs/land + rng()*0.03;          // höher gelegenes Land bevorzugt
      if(sc>bs){ bs=sc; bx=cx; by=cy; }
    }
    if(bx<0) continue;
    stempeln(macheMassiv(bx, by, R, ring?'ring':'kuppe'));
    if(ring) ringeGesetzt++;
    if(ringSoll>0) ringSoll--;
  }
  gelaendeSchreiben(0,w-1,0,h-1);
  // Kessel-Durchlass sicherstellen. Das Umrissrauschen kann einen Pass
  // zuwachsen lassen; dann wäre das Tal nur über den Fels erreichbar und für
  // den Spieler praktisch wertlos. Ist das Tal vom offenen Land abgeschnitten,
  // wird der Durchlass entlang des vorgesehenen Winkels sauber freigeräumt.
  // "offen" = gehört zu KEINEM Massiv und ist begehbar. Über das Massivfeld
  // statt über die Geländeart, weil im Winter auch die Ebene TER.SNOW trägt –
  // die ist offenes Land, kein Berg.
  const offenerKnoten = (i)=> mv[i]<=0 && map.terrOkRoad(i);
  // Ein Ausgang zählt nur auf Grund, den der Zeichner auch als offenes Land
  // malt. Schnee scheidet aus: im Winter trägt die Ebene TER.SNOW, und eine
  // von Fels umschlossene Schneefläche liest der Zeichner (massifSnow) als
  // Massivfläche – der Pass käme dann optisch im Berg heraus.
  const ausgangsKnoten = (i)=> offenerKnoten(i) && map.terr[i]!==TER.SNOW;
  // Einen brauchbaren Knoten auf dem Talboden finden. Über die kessel-Marke
  // statt über einen festen Kasten: bei einem Lava- oder Wüstenthema kann die
  // Mitte des Kastens unbegehbar sein, der Talboden daneben aber offen.
  const talKnoten = (M, taugt)=>{
    const y0=Math.max(0,Math.floor((M.cy-M.R*0.5)/ROWQ)), y1=Math.min(h-1,Math.ceil((M.cy+M.R*0.5)/ROWQ));
    const x0=Math.max(0,Math.floor(M.cx-M.R*0.5)), x1=Math.min(w-1,Math.ceil(M.cx+M.R*0.5));
    for(let Y=y0;Y<=y1;Y++) for(let X=x0;X<=x1;X++){
      const i=map.idx(X,Y);
      if(kessel[i] && taugt(i)) return i;
    }
    return -1;
  };
  // Führt offenes (felsfreies) Land vom Talboden über den Kranz hinaus?
  const talHatAusgang = (M)=>{
    const offen=offenerKnoten;
    const start=talKnoten(M, offen);
    if(start<0) return false;
    const seen=new Set([start]); let q=[start];
    while(q.length){
      const nx=[];
      for(const i of q) for(const b of map.nbs(i)){
        if(seen.has(b) || !offen(b)) continue;
        // Ausgang zählt nur, wenn er WEIT draußen liegt und dort auch breit
        // ist: ein einzelner offener Knoten zwischen Felsen ist kein Pass.
        // Im Winter läge er als vom Fels umschlossene Schneezelle vor – der
        // Zeichner malt so etwas als Massivfläche, nicht als Durchgang.
        if(ausgangsKnoten(b)
           && Math.hypot(map.X(b)+(map.Y(b)&1)*0.5-M.cx, map.Y(b)*ROWQ-M.cy) > M.R*1.35
           && map.nbs(b).filter(offen).length >= 4) return true;
        seen.add(b); nx.push(b);
      }
      q=nx;
    }
    return false;
  };
  // Läuft ganz am Ende der Erzeugung (nach Bergsee, Startplätzen und
  // Hausberg): nur dann steht das endgültige Gelände fest. Früher aufgerufen
  // konnte ein später gesetzter Hausberg den frisch geräumten Pass wieder
  // zumauern.
  const kesselDurchlassSichern = ()=>{
  for(const M of massive){
    if(M.form!=='ring' || talHatAusgang(M)) continue;
    const y0=Math.max(0, Math.floor((M.cy-M.R*1.4)/ROWQ)), y1=Math.min(h-1, Math.ceil((M.cy+M.R*1.4)/ROWQ));
    const x0=Math.max(0, Math.floor(M.cx-M.R*1.4)), x1=Math.min(w-1, Math.ceil(M.cx+M.R*1.4));
    // Durchlass freiräumen: Keil um den Pass-Winkel, ohne Umrissrauschen
    for(let Y=y0;Y<=y1;Y++) for(let X=x0;X<=x1;X++){
      const px=X+(Y&1)*0.5, py=Y*ROWQ;
      const dx=px-M.cx, dy=py-M.cy, r=Math.hypot(dx,dy);
      if(r>M.R*1.35) continue;
      const th=Math.atan2(dy,dx);
      for(const p of M.paesse){
        const dth=th-p.th;
        if(r*Math.cos(dth)>0 && Math.abs(r*Math.sin(dth)) < p.breite+0.6){
          const i=map.idx(X,Y); mv[i]=0; mtop[i]=0; kessel[i]=1;
        }
      }
    }
    gelaendeSchreiben(x0,x1,y0,y1);
    if(talHatAusgang(M)) continue;
    // Immer noch dicht (z.B. weil gleich das nächste Massiv anschließt, oder
    // weil der Pass in die See zeigt): kürzesten Weg vom Tal ins offene Land
    // suchen und ihn freiräumen. Über Wasser geht der Weg nicht. Damit kann
    // ein Kessel nie vollständig abgeriegelt bleiben.
    const quelle=talKnoten(M, (i)=>map.terrOkRoad(i));
    if(quelle<0) continue;
    const vor=new Map([[quelle,-1]]); let welle=[quelle], ziel=-1;
    while(welle.length && ziel<0){
      const nx=[];
      for(const i of welle) for(const b of map.nbs(i)){
        if(vor.has(b) || !map.terrOkRoad(b)) continue;
        if(Math.hypot(map.X(b)+(map.Y(b)&1)*0.5-M.cx, map.Y(b)*ROWQ-M.cy) > M.R*3.0) continue;
        vor.set(b,i);
        if(ausgangsKnoten(b) && map.nbs(b).filter(offenerKnoten).length>=4
           && Math.hypot(map.X(b)+(map.Y(b)&1)*0.5-M.cx, map.Y(b)*ROWQ-M.cy) > M.R*1.35){ ziel=b; break; }
        nx.push(b);
      }
      welle=nx;
    }
    if(ziel<0) continue;
    let bx2=map.w, bx3=-1, by2=map.h, by3=-1;
    for(let k=ziel; k>=0; k=vor.get(k)){
      for(const q2 of [k, ...map.nbs(k)]){
        mv[q2]=0; mtop[q2]=0; kessel[q2]=1;
        const X=map.X(q2), Y=map.Y(q2);
        if(X<bx2) bx2=X; if(X>bx3) bx3=X;
        if(Y<by2) by2=Y; if(Y>by3) by3=Y;
      }
    }
    if(bx3>=0) gelaendeSchreiben(bx2,bx3,by2,by3);
  }
  // Was durch das Räumen kein Fels mehr ist, trägt auch kein Erz und keinen
  // Felsbewuchs mehr.
  for(let i=0;i<w*h;i++) if(mv[i]<=0 && map.oreT[i]){ map.oreT[i]=0; map.oreA[i]=0; }
  };
  // Bergsee im Kessel: das Tal eines großen Ringmassivs bekommt gelegentlich
  // ein kleines Gewässer. Der begehbare Talboden ringsum bleibt erhalten.
  for(const M of massive){
    if(M.form!=='ring' || M.R<11 || rng()>=0.45) continue;
    for(let Y=Math.max(0,Math.floor((M.cy-M.R*0.4)/ROWQ)); Y<=Math.min(h-1,Math.ceil((M.cy+M.R*0.4)/ROWQ)); Y++)
      for(let X=Math.max(0,Math.floor(M.cx-M.R*0.4)); X<=Math.min(w-1,Math.ceil(M.cx+M.R*0.4)); X++){
        const i=map.idx(X,Y);
        if(!kessel[i]) continue;
        if(Math.hypot(X+(Y&1)*0.5-M.cx, Y*ROWQ-M.cy) > M.R*0.22) continue;
        map.terr[i]=TER.WATER; map.hgt[i]=-0.10;
      }
  }

  // ---- Wälder ----
  // Nicht "Rauschen über Schwelle = Baum" (das ergibt geschlossene Blöcke),
  // sondern Bestände mit weichem Rand, Lichtungen im Inneren und Jungwuchs
  // am Saum. Ein Nachlauf lichtet zu dichte Stellen aus, damit Siedler
  // überall durchkommen und der Wald atmet.
  // Etwas dichterer Baumbestand als früher: ein Holzfäller rodete einen
  // kompletten Startwald in unter 9 Spielminuten (Kritikbericht) – die
  // Bestände geben jetzt mehr her, das Nachpflanzen erledigt der Förster.
  const treeP = { gruen:0.40, winter:0.24, wueste:0.11, vulkan:0.13, sumpf:0.27, inseln:0.35, gebirge:0.27 }[theme] ?? 0.36;
  // Gebirgskritik G4: KEIN Baum auf Knoten mit Fels-Nachbar – der gemalte
  // Bergfuss (Geroellband, Wandkanten) uebergreift die Logik leicht, Baeume
  // direkt an der Grenze standen mitten auf dem gemalten Fels. Baeume sind
  // Sim-Objekte (Holzfaeller!), darum gilt die Regel nur fuer NEUE Karten.
  const woodOk = (i)=> (map.terr[i]===TER.GRASS || (map.terr[i]===TER.SNOW&&theme==='winter'))
    && !map.nbs(i).some(q=> map.terr[q]===TER.MOUNT);
  const smooth = (a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
  const MAXDENS = 0.60;                       // dichtester Kern: gut 3 von 5 Knoten
  const waldF = (i)=> sample(grids[1], map.X(i)*2.6+71, map.Y(i)*2.6+43);
  // Die Schwelle wird als ANTEIL der Wiese bestimmt, nicht als fester
  // Rauschwert. Vorher stand hier t0 = 1-treeP: das setzt voraus, dass das
  // Rauschen die ganze Spanne 0..1 gleichmaessig ausfuellt. Bilinear
  // geglaettete Gleichverteilung tut das aber nicht - sie draengt sich um
  // 0,5. Fuer die Wueste (treeP 0,11, Schwelle 0,89) lag die Schwelle so
  // weit im Randbereich, dass praktisch nichts mehr darueber kam. Ueber das
  // Quantil heisst treeP jetzt schlicht: SO GROSS ist der bewaldete Anteil
  // der waldfaehigen Flaeche - unabhaengig davon, wie das Rauschen liegt.
  let t0 = 1-treeP*res;
  {
    const kand=[];
    for(let i=0;i<w*h;i++) if(woodOk(i) && !map.obj[i]) kand.push(waldF(i));
    if(kand.length>32){
      kand.sort((a,b2)=>a-b2);
      const anteil=Math.max(0.02, Math.min(0.92, treeP*res));
      t0 = kand[Math.min(kand.length-1, Math.floor((1-anteil)*kand.length))];
    }
  }
  for(let i=0;i<w*h;i++){
    if(!woodOk(i) || map.obj[i]) continue;
    const X=map.X(i), Y=map.Y(i);
    const f = sample(grids[1], X*2.6+71, Y*2.6+43);
    let p = smooth(t0-0.10, t0+0.13, f) * MAXDENS;
    if(p<=0.001) continue;
    // Lichtungen: feineres Rauschen frisst Löcher in geschlossene Bestände
    const gl = sample(grids[3], X*7.3+17, Y*7.3+53);
    if(gl>0.62) p *= 1-smooth(0.62,0.86,gl)*0.85;
    if(rng()>=p) continue;
    // Randbereich des Bestands: junger Wuchs statt ausgewachsener Stämme
    const edge = 1-smooth(t0-0.06, t0+0.10, f);
    const r=rng();
    map.obj[i] = r < edge*0.42 ? OBJ.SAPLING : r < edge*0.78 ? OBJ.TREE2 : OBJ.TREE;
    // Startalter streuen (R11): Setzlinge und Jungbaeume reifen ueber ihr
    // Alter in map.amt. Alle mit Alter null zu starten hiesse, dass der
    // ganze Startwald im Gleichschritt eine Stufe weiterspringt.
    if(map.obj[i]!==OBJ.TREE) map.amt[i]=(rng()*BAUM_REIF)|0;
  }
  // Auslichten: kein Knoten behält mehr als 4 bewaldete Nachbarn
  for(let i=0;i<w*h;i++){
    const o=map.obj[i]&127;
    if(o!==OBJ.TREE && o!==OBJ.TREE2 && o!==OBJ.SAPLING) continue;
    const nb=map.nbs(i);
    let n=0;
    for(const k of nb){ const ok=map.obj[k]&127; if(ok===OBJ.TREE||ok===OBJ.TREE2||ok===OBJ.SAPLING) n++; }
    if(n>=5 && rng()<0.72) map.obj[i]=OBJ.NONE;
    else if(n>=4 && rng()<0.3) map.obj[i]=OBJ.NONE;
  }
  // Steinhaufen: mehr Brocken und je Brocken deutlich mehr Abbauladungen.
  // Vorher (0,012 / 4–8 Ladungen) verstummte der Steinmetz nach ~7 Spiel-
  // minuten und die Stein-Spirale fror ganze Partien ein (Kritikbericht F3).
  // Nutzerbefund v165 ("zu wenig Steinbloecke gefunden"), nachgemessen ueber
  // vier Saaten: der MEDIAN-Steinbruchplatz am Start erreichte nur 30-53
  // Ladungen (der beste 66-95), und abseits des Startrings lagen 11-15
  // Haufen je 1000 Bauknoten - der zweite Steinbruch fand kaum noch etwas.
  // Dichte 0,016 -> 0,021 und 8-15 -> 10-18 Ladungen je Haufen; die
  // Granitmine bleibt die Dauerquelle des Mittelspiels.
  for(let i=0;i<w*h;i++){
    if(!map.terrOkBuild(i) || map.obj[i]) continue;
    if(rng() < 0.021*res){ map.obj[i]=OBJ.STONE; map.amt[i]=10+((rng()*9)|0); }
  }
  // Erz in Bergen. Granit ist breiter gestreut und ergiebiger als die
  // anderen Erze: das Steinbergwerk ist die verlässliche Dauerquelle des
  // Mittelspiels, wenn die Oberflächen-Brocken abgetragen sind – eine Mine
  // soll eine lange Partie tragen (Kritikbericht Stein-Spirale).
  // ---- Felsformationen im Gebirge (OBJ.ROCK) ----
  // Nutzerwunsch: "viele verschiedene steinobjekte kieshaufen steinhaufen
  // klippen ... mit kollisionskontrolle im spiel". Bis hierher waren die
  // Felsobjekte reine Zeichnung im Renderer – man konnte mitten durch sie
  // hindurchlaufen und eine Mine hineinsetzen. Jetzt stehen sie als echte
  // Objekte auf der Karte: kein Bauplatz, keine Strasse, kein Durchgang.
  // Drei Regeln halten das Gebirge trotzdem begehbar:
  //   1) Paesse und deren Nachbarschaft bleiben frei – der Durchgang durch
  //      das Massiv darf nie zuwachsen.
  //   2) Kein Fels neben einem schon gesetzten Fels: so entstehen einzelne
  //      Formationen statt geschlossener Riegel.
  //   3) Nur im INNEREN des Massivs; die aeusserste Felsreihe bleibt frei,
  //      damit Bergwerke am Fuss und der Geroellsaum Platz behalten.
  {
    const istBerg=(q)=>map.terr[q]===TER.MOUNT;
    // Gebirgskritik K2 ("Objekte liegen auf den Bergen auf"): KEINE
    // Formation in der Steilwand. GEMESSEN (4 Karten M) ist die Verteilung
    // der slopeMax unter den bisherigen Felsknoten zweigipflig: ~50 % auf
    // ebenen Plateaus (um 0,5) und 37-60 % auf Terrassenwaenden (3,0+).
    // Ein aufrecht gemaltes Felsobjekt auf einer 3er-Wand steht sichtbar
    // "aufgeklebt" (spiel-58-gebirge-mine). Schwelle 2,6 nimmt genau den
    // Wand-Gipfel heraus; die Dichte steigt 0,17 -> 0,22, damit die
    // Gesamtzahl der Formationen etwa gleich bleibt (sie draengen sich
    // jetzt auf den Plateaus, wo Geroell auch liegen bliebe).
    const dichte=0.22;
    for(let i=0;i<w*h;i++){
      if(!istBerg(i) || map.obj[i]) continue;
      if(map.pass && map.pass[i]) continue;
      if(map.slopeMax(i)>2.6) continue;                  // keine Steilwand
      const nb=map.nbs(i);
      if(nb.some(q=>map.pass && map.pass[q])) continue;
      if(nb.some(q=>!istBerg(q))) continue;              // Randreihe frei
      if(nb.some(q=>(map.obj[q]&127)===OBJ.ROCK)) continue;
      if(rng()>=dichte) continue;
      map.obj[i]=OBJ.ROCK;
    }
    // Sicherung: kein Massivknoten darf komplett eingemauert werden – sonst
    // waere ein Erzvorkommen dahinter fuer immer unerreichbar.
    for(let i=0;i<w*h;i++){
      if(!istBerg(i) || (map.obj[i]&127)===OBJ.ROCK) continue;
      const nb=map.nbs(i);
      const zu=nb.filter(q=>(map.obj[q]&127)===OBJ.ROCK
                         || map.terr[q]===TER.WATER || map.terr[q]===TER.LAVA).length;
      if(zu>=nb.length-1){
        for(const q of nb) if((map.obj[q]&127)===OBJ.ROCK){ map.obj[q]=OBJ.NONE; break; }
      }
    }
  }
  // Fische in Küstennähe
  for(let i=0;i<w*h;i++){
    if(map.terr[i]!==TER.WATER) continue;
    const coastal = map.nbs(i).some(n=> map.terr[n]!==TER.WATER);
    if(coastal && rng()<0.6) map.fish[i]=4+((rng()*8)|0);
  }

  // Startplätze: flache, freie Grasflächen, weit voneinander entfernt, auf derselben Landmasse
  const comp = landComponents(map);
  let bestComp=-1, bestSize=0;
  for(const [c,size] of comp.sizes) if(size>bestSize){ bestSize=size; bestComp=c; }
  const cand=[];
  for(let y=3;y<h-3;y++) for(let x=3;x<w-3;x++){
    const i=map.idx(x,y);
    if(comp.id[i]!==bestComp) continue;
    if(map.terr[i]!==TER.GRASS && map.terr[i]!==TER.DESERT && map.terr[i]!==TER.SNOW) continue;
    let free=0; for(const n of map.nbs(i)) if(map.terrOkBuild(n)) free++;
    if(free>=5) cand.push(i);
  }
  // BEBAUBARES LAND IM STARTGEBIET. Der Kandidatenfilter oben prueft nur den
  // Knoten selbst und seine sechs Nachbarn - wie viel davon im spaeteren
  // Gebiet liegt, sah er nie an. Nachgemessen auf zwei Karten hatte eine
  // Siedlung nach 30 Spielminuten NULL bebaubare Knoten: von 628 bzw. 271
  // eigenen Knoten waren 376 bzw. 184 schlicht Wasser. Das Startgebiet ist
  // der Radius des Hauptquartiers - auf einer seereichen Karte bleiben davon
  // rund 84 Landknoten, und die sind nach elf Gebaeuden aufgebraucht.
  // Jetzt zaehlt der Generator das Land im HQ-Radius und verlangt ein
  // Mindestmass. Der Radius steht in core.js (BLD.hq.mil.radius); hier steht
  // er als Zahl, damit map.js keine Abhaengigkeit auf die Gebaeudetabelle
  // bekommt - beide Werte gehoeren zusammen.
  const HQ_R=11, LAND_MIN=150;
  // Gezaehlt wird mit DERSELBEN Entfernung, die das Spiel fuer die Grenze
  // benutzt: Schritte von Nachbar zu Nachbar (sim.js gebietNeu). Ein Kreis in
  // Gitterkoordinaten waere eine andere Form - die Zeilen stehen nur 0,846
  // Spaltenbreiten auseinander, ein Gitterkreis ist also zu hoch und zu
  // schmal. Statt zu suchen (BFS je Kandidat waere teuer) rechnet die
  // Entfernung direkt: das versetzte Gitter laesst sich in Achsenkoordinaten
  // umschreiben, dort ist die Entfernung eine Formel.
  const aq=(x,y)=> x - ((y-(y&1))>>1);            // Spalte in Achsenkoordinaten
  const hexDist=(x1,y1,x2,y2)=>{
    const dq=aq(x1,y1)-aq(x2,y2), dr=y1-y2;
    return (Math.abs(dq)+Math.abs(dq+dr)+Math.abs(dr))>>1;
  };
  // Gemerkt, weil die Kandidaten zufaellig gezogen werden und die drei
  // Anlaeufe unten dieselben Knoten wiedersehen.
  const landMemo=new Map();
  const landImUmkreis=(i)=>{
    const memo=landMemo.get(i); if(memo!==undefined) return memo;
    const cx=map.X(i), cy=map.Y(i);
    let n=0;
    for(let y2=Math.max(0,cy-HQ_R); y2<=Math.min(h-1,cy+HQ_R); y2++)
      for(let x2=Math.max(0,cx-HQ_R-1); x2<=Math.min(w-1,cx+HQ_R+1); x2++){
        if(hexDist(x2,y2,cx,cy)>HQ_R) continue;
        if(map.terrOkBuild(map.idx(x2,y2))) n++;
      }
    landMemo.set(i,n);
    return n;
  };
  // Zwei Bedingungen muessen zusammen gelten, und sie ziehen gegeneinander:
  // genug Bauland UND genug Abstand. Wird das Land nur in die Punktzahl
  // gerechnet, sucht der Generator die groesste Wiese und setzt bei vier
  // Spielern zwei Startplaetze neun Knoten nebeneinander (gemessen). Deshalb
  // sind beide harte Bedingungen, und die Punktzahl entscheidet nur noch
  // unter den Tauglichen. ABST_MIN=2*HQ_R+6: die Gebiete beruehren sich bei
  // 2*HQ_R, sechs Knoten Niemandsland bleiben dazwischen.
  const ABST_MIN=2*HQ_R+6;
  const starts=[];
  for(let p=0;p<nPl;p++){
    let best=-1, bestLand=-1, bestLandC=-1;
    // Drei Anlaeufe, von streng nach nachgiebig. Auf einer kleinen Karte mit
    // vier Spielern oder auf einer Inselkarte ist das Strenge nicht immer
    // erfuellbar - dann wird gelockert statt aufzugeben.
    for(const [landF, abstF] of [[1,1],[0.75,0.62],[0.5,0.35]]){
      const lMin=LAND_MIN*landF, aMin=ABST_MIN*abstF;
      let bs=-1;
      for(let t=0;t<260;t++){
        const c=cand[(rng()*cand.length)|0]; if(c===undefined) break;
        const land=landImUmkreis(c);
        if(land>bestLand){ bestLand=land; bestLandC=c; }
        if(land<lMin) continue;                   // zu wenig Bauland
        let score = rng()*4 + land*0.15, nah=false;
        for(const s of starts){
          const d=hexDist(map.X(c),map.Y(c),map.X(s),map.Y(s));
          if(d<aMin){ nah=true; break; }          // zu dicht am Nachbarn
          score += d;
        }
        if(nah) continue;
        if(starts.length===0) score += Math.min(map.X(c), map.Y(c), w-map.X(c), h-map.Y(c))*0.15;
        if(score>bs){ bs=score; best=c; }
      }
      if(best>=0) break;
    }
    // Auch der nachgiebigste Anlauf leer (sehr seereiche Karte): dann gewinnt
    // der Platz mit dem meisten Land - besser als ein zufaelliger.
    if(best<0 && bestLandC>=0) best=bestLandC;
    if(best<0) best = cand[(rng()*cand.length)|0] ?? map.idx(w>>1,h>>1);
    // Umgebung säubern
    clearArea(map, best, 3);
    starts.push(best);
  }
  // Hausberg: Minen brauchen Gebirgsknoten in Laufweite. Seit die Karte nur
  // noch wenige große Massive trägt (statt eines flächendeckenden Rippen-
  // netzes) kann ein Startplatz weit von jedem Fels liegen – dann ließe sich
  // nie eine Mine bauen. Fehlt Fels im Umkreis, wird ein kleiner eigener
  // Stock gesetzt.
  for(const s of starts){
    const seen=new Set([s]); let ring=[s];
    for(let d=0; d<14; d++){
      const nx=[];
      for(const i of ring) for(const b of map.nbs(i)) if(!seen.has(b)){ seen.add(b); nx.push(b); }
      ring=nx;
    }
    let nah=0; for(const i of seen) if(map.terr[i]===TER.MOUNT) nah++;
    if(nah>=18) continue;
    const sx=map.X(s)+(map.Y(s)&1)*0.5, sy=map.Y(s)*ROWQ;
    let bx=-1, by=-1, bs=-1, radius=4.6+rng()*1.4;
    // Zwei Anläufe: erst der Wunschplatz (freistehend, ganz auf Land, 10-13
    // Knoten entfernt), dann ein genügsamer Anlauf (näher/weiter, kleiner,
    // etwas Küste erlaubt). An einer Steilküste oder zwischen zwei Massiven
    // fand der strenge Anlauf sonst nichts und der Spieler blieb ohne Mine.
    for(let anlauf=0; anlauf<2 && bx<0; anlauf++){
      const rMin = anlauf? 7.5 : 10, rSpan = anlauf? 9.0 : 3.5;
      const frei = anlauf? 0.62 : 0.85, abst = anlauf? 0.62 : 0.85;
      if(anlauf) radius = 3.9+rng()*1.1;
      for(let t=0;t<260;t++){
        const th=rng()*6.2832, rr=rMin+rng()*rSpan;
        const cx=sx+Math.cos(th)*rr, cy=sy+Math.sin(th)*rr;
        if(cx<6||cy<6||cx>w-7||cy>(h-7)*ROWQ) continue;
        let ok=true;
        for(const M of massive) if(Math.hypot(cx-M.cx,cy-M.cy) < abst*(radius+0.8+M.R)){ ok=false; break; }
        if(!ok) continue;
        let land=0, prob=0;
        for(let a=0;a<9;a++){
          const X=Math.round(cx+Math.cos(a*1.4)*radius*0.78), Y=Math.round((cy+Math.sin(a*1.4)*radius*0.78)/ROWQ);
          if(X<0||Y<0||X>=w||Y>=h) continue;
          prob++; if(raw[map.idx(X,Y)]>=SEA) land++;
        }
        if(prob<7 || land<prob*frei) continue;
        const sc=rng();
        if(sc>bs){ bs=sc; bx=cx; by=cy; }
      }
    }
    if(bx<0) continue;
    const kasten=stempeln(macheMassiv(bx, by, radius, 'kuppe'));
    gelaendeSchreiben(kasten.x0,kasten.x1,kasten.y0,kasten.y1);
    // was jetzt Fels ist, trägt keine Bäume/Brocken mehr und bekommt Erz
    for(let Y=kasten.y0;Y<=kasten.y1;Y++) for(let X=kasten.x0;X<=kasten.x1;X++){
      const i=map.idx(X,Y);
      if(map.terr[i]!==TER.MOUNT && map.terr[i]!==TER.SNOW) continue;
      map.obj[i]=OBJ.NONE; map.amt[i]=0;
    }
  }
  // Jetzt steht das Gelände endgültig: Kessel-Durchlässe prüfen und notfalls
  // freiräumen (siehe kesselDurchlassSichern).
  kesselDurchlassSichern();
  // ---------------- Thermische Erosion (Auftrag 2.4) ----------------
  // "20-40 Iterationen thermische Erosion (Talus ~35°) -> Geröllfuß entsteht
  //  automatisch, Steilwände bleiben."
  //
  // Der Talus ist der Böschungswinkel, oberhalb dessen loses Material
  // abrutscht. In WELTMASSEN: ein Knotenschritt sind TILE=52 px waagerecht,
  // eine Höheneinheit HSCALE=26 px senkrecht. 35° entspräche also einer
  // Höhendifferenz von tan(35°)*52/26 = 1,40 je Knoten.
  // MIT 1,40 PASSIERT HIER FAST NICHTS: die Flanken der Massive sind mit im
  // Mittel 0,58 Höheneinheiten je Knoten (R=12, Gipfelhöhe ~7) längst
  // flacher als 1,40. Was darüber liegt, sind die Terrassen- und
  // Plateaukanten – und die wollen wir GERADE BEHALTEN ("Steilwände
  // bleiben"). Ein 35°-Talus würde also genau das Falsche abtragen.
  // Der Auftrag nennt als ZWECK den weichen Fuß (1.2: kein harter Schnitt
  // Fels->Gras). Der Talus ist deshalb auf diesen Zweck kalibriert statt auf
  // die Gradzahl: TALUS=0,50 (rund 14°) transportiert Material von der
  // Flanke in den Fußbereich; die Hochlagen schützt die Höhenklausel unten.
  //
  // GEMESSEN über 20 Karten (Seeds 1-20, je 128x128, gruen/gebirge im
  // Wechsel), Höhensprung vom Felsrandknoten auf seinen tiefsten
  // Nicht-Fels-Nachbarn:
  //            vorher    nachher
  //   Median    0,52       0,50
  //   p90       1,54       0,53
  //   > 1,40   12,4 %      5,3 %      (= "harte Kante", Abnahmekriterium 4)
  // Der Median bleibt also gleich – abgetragen wird gezielt der OBERE
  // Schwanz der Verteilung, und das ist genau die Abbruchkante.
  {
    const n=w*h;
    const TALUS=0.50, RATE=0.34, ITER=40;
    // nur Massiv und sein Vorland: die Ebene soll unangetastet bleiben
    const aktiv=new Uint8Array(n);
    for(let i=0;i<n;i++) if((mv[i]>0 || fuss[i]) && map.terr[i]!==TER.WATER) aktiv[i]=1;
    const delta=new Float32Array(n);
    for(let it=0; it<ITER; it++){
      delta.fill(0);
      for(let i=0;i<n;i++){
        if(!aktiv[i]) continue;
        // HOCHLAGEN-SCHUTZ: oberhalb der Plateauschwelle bleiben die
        // Steilwände stehen ("Steilwände bleiben"). Ohne diese Klausel
        // frisst die Erosion in 28 Durchläufen genau die Absätze weg, die
        // die Plateau-Quantisierung erst erzeugt hat.
        if(map.hgt[i]>PLAT_H+PLAT_BAND) continue;
        const nb=map.nbs(i);
        let sum=0, dmax=0;
        for(const b of nb){
          if(!aktiv[b]) continue;
          const d=map.hgt[i]-map.hgt[b];
          if(d>TALUS){ sum+=d-TALUS; if(d>dmax) dmax=d; }
        }
        if(sum<=0) continue;
        // bewegte Menge: höchstens die halbe größte Übersteilung, damit der
        // Knoten nicht unter seinen tiefsten Nachbarn durchsackt
        const move=Math.min((dmax-TALUS)*0.5, sum)*RATE;
        for(const b of nb){
          if(!aktiv[b]) continue;
          const d=map.hgt[i]-map.hgt[b];
          if(d>TALUS) delta[b]+=move*(d-TALUS)/sum;
        }
        delta[i]-=move;
      }
      for(let i=0;i<n;i++) if(delta[i]) map.hgt[i]+=delta[i];
    }
  }
  // SPLITTERMASSIVE AUFRÄUMEN. Ein Gebirgsfetzen, dessen Knoten ALLE an
  // Nicht-Gebirge grenzen, hat keine Innenfläche - er besteht nur aus Fuss.
  // Gezeichnet bekommt er trotzdem alles, was ein Massiv bekommt: Randstufe,
  // Flanke, Schuttband, Klippentextur. Im Bild sind das die Felszungen, die
  // in die Wiese greifen, ohne je ein Berg zu werden.
  // Sie werden zu WIESE zurückgenommen; ihre Höhe wird auf das Umland
  // gezogen, damit keine Stufe stehen bleibt. Die Steine, die dort lagen,
  // bleiben als Felsbrocken (OBJ.ROCK setzt der Streupass später) - der
  // Ort bleibt also steinig, er ist nur kein Gebirge mehr.
  // MASS: das räumt wenig auf (auf drei Karten 0, 0 und 23 Knoten). Die
  // Fetzen, die ich zuerst dafür gehalten hatte, waren SUMPF - meine
  // Messmaske hatte TER.SNOW mit 5 statt 4 angesetzt und damit Sumpf als
  // Gebirge gezählt. Der Pass bleibt trotzdem: er kostet nichts und die
  // Fälle, die er trifft, sind echte.
  {
    const nAll=map.w*map.h;
    const istBerg=(i)=>map.terr[i]===TER.MOUNT || map.terr[i]===TER.SNOW;
    const gesehen=new Uint8Array(nAll);
    for(let i=0;i<nAll;i++){
      if(gesehen[i] || !istBerg(i)) continue;
      const st=[i]; gesehen[i]=1; const koerper=[];
      while(st.length){
        const c=st.pop(); koerper.push(c);
        for(const q of map.nbs(c)) if(!gesehen[q] && istBerg(q)){ gesehen[q]=1; st.push(q); }
      }
      if(koerper.length>44) continue;                 // richtiger Körper
      const kern=koerper.filter(q=>!map.nbs(q).some(r=>!istBerg(r)));
      if(kern.length*4>=koerper.length) continue;     // hat genug Innenfläche
      for(const q of koerper){
        let s=0, n2=0;
        for(const r of map.nbs(q)){
          if(istBerg(r)) continue;
          if(map.terr[r]===TER.WATER || map.terr[r]===TER.LAVA) continue;
          s+=map.hgt[r]; n2++;
        }
        map.terr[q]=TER.GRASS;
        if(n2) map.hgt[q]=map.hgt[q]*0.25+(s/n2)*0.75;
      }
    }
  }

  // ---- Erz in LAGERSTÄTTEN statt flächendeckend ----
  // Nutzerurteil v98: "bergwerke fördern aktuell immer ohne geologen
  // erkundung ob dort etwas ist. kann man ja per zufall treffen auch ohne
  // geologe aber nicht grundsätzlich eine förderung".
  // Das traf zu, und zwar aus zwei Gründen zugleich:
  //   jeder einzelne Gebirgsknoten bekam mit 80 % Wahrscheinlichkeit ein
  //   Vorkommen - das Gebirge war praktisch flächendeckend vererzt
  //   das Bergwerk suchte über ZWEI Nachbarringe, also 19 Knoten
  // Zusammen lag die Trefferwahrscheinlichkeit für Kohle bei 99,9 %, für
  // Eisen bei 99,1 %, für Granit bei 97,7 % und selbst für Gold noch bei
  // 86,5 %. Der Geologe war damit reine Zierde.
  // Jetzt liegt Erz in zusammenhängenden Lagerstätten: wenige Nester je
  // Massiv, jedes aus einer Sorte. Wer blind baut, kann eines treffen -
  // aber eben nur manchmal. Der Suchradius des Bergwerks schrumpft dazu auf
  // EINEN Ring (s. sim.js), sonst verwischt er die Nester wieder.
  const erzSorte = ()=>{
    const r=rng();
    return r<0.34? 1 : r<0.60? 2 : r<0.72? 3 : 4;   // Kohle/Eisen/Gold/Granit
  };
  const erzMenge = (t)=> t===1? 26+((rng()*30)|0)
                       : t===2? 22+((rng()*26)|0)
                       : t===3? 16+((rng()*18)|0)
                       :        60+((rng()*60)|0);
  {
    const istBerg=(q)=>map.terr[q]===TER.MOUNT;
    const gesehen=new Uint8Array(w*h);
    for(let i=0;i<w*h;i++){
      if(gesehen[i] || !istBerg(i)) continue;
      const st=[i]; gesehen[i]=1; const koerper=[];
      while(st.length){
        const c=st.pop(); koerper.push(c);
        for(const q of map.nbs(c)) if(!gesehen[q] && istBerg(q)){ gesehen[q]=1; st.push(q); }
      }
      // Ein Nest je rund 26 Knoten Massivfläche, mindestens eines.
      const nester=Math.max(1, Math.round(koerper.length/26*res));
      for(let k=0;k<nester;k++){
        const start=koerper[(rng()*koerper.length)|0];
        if(map.oreT[start]) continue;                 // schon vererzt
        const t=erzSorte();
        const soll=4+((rng()*10)|0);
        const q2=[start]; const drin=new Set([start]);
        map.oreT[start]=t; map.oreA[start]=erzMenge(t);
        for(let qi=0; qi<q2.length && drin.size<soll; qi++){
          for(const nb of map.nbs(q2[qi])){
            if(drin.size>=soll) break;
            if(drin.has(nb) || !istBerg(nb) || map.oreT[nb]) continue;
            if(rng()<0.28) continue;                  // ausgefranster Rand
            drin.add(nb); q2.push(nb);
            map.oreT[nb]=t; map.oreA[nb]=erzMenge(t);
          }
        }
      }
    }
  }

  // STARTGARANTIE ERZ (v216, Nutzerbefund aus dem Spieltest): ohne
  // Eisenerz und Kohle in Reichweite ist die Partie von Beginn an
  // verloren - kein Eisen, keine Waffen, keine Soldaten, kein Landgewinn.
  // Und seit die Muenze den Rekruten macht (v215), gilt dasselbe fuer
  // Gold. VERMESSEN (30 Saaten, 60 Startlagen, Breitensuche ueber Land):
  //   Kohle  Median 13 Knoten, 4/60 weiter als 25
  //   Eisen  Median 14 Knoten, 10/60 weiter als 25
  //   Gold   Median 21 Knoten, 22/60 weiter als 25, Ausreisser bis 61
  // Unerreichbar ist nie etwas - es ist eine Entfernungsfrage. Deshalb:
  // liegt die naechste Lagerstaette einer Sorte weiter als LIMIT Knoten
  // vom Start, wird in den naechstgelegenen unvererzten Gebirgsknoten ein
  // Nest gepflanzt - gleiches Wuchsmuster und gleiche Mengen wie die
  // natuerlichen Nester, der Geologe muss es weiterhin finden.
  {
    const LIMIT=22;
    const istBerg=(q)=>map.terr[q]===TER.MOUNT;
    const menge=(t)=> t===1? 26+((rng()*30)|0)
                    : t===2? 22+((rng()*26)|0)
                    :        16+((rng()*18)|0);
    for(const s of starts){
      // Distanzfeld ueber Land - Wasser sperrt, ein Nest jenseits des Sees
      // ist keine Hilfe
      const d=new Int32Array(w*h).fill(-1);
      const q=[s]; d[s]=0;
      for(let qi=0; qi<q.length; qi++){
        const cur=q[qi];
        for(const nb of map.nbs(cur)){
          if(d[nb]>=0 || map.terr[nb]===TER.WATER) continue;
          d[nb]=d[cur]+1; q.push(nb);
        }
      }
      for(const sorte of [1,2,3]){          // Kohle, Eisen, Gold
        let nah=1e9;
        for(let i=0;i<w*h;i++)
          if(map.oreT[i]===sorte && map.oreA[i]>0 && d[i]>=0 && d[i]<nah) nah=d[i];
        if(nah<=LIMIT) continue;
        // naechstgelegenen unvererzten Gebirgsknoten nehmen - im Limit,
        // wenn moeglich; sonst den naechsten ueberhaupt (besser ein fernes
        // Nest als gar keines)
        let ziel=-1, zd=1e9;
        for(let i=0;i<w*h;i++){
          if(!istBerg(i) || map.oreT[i] || d[i]<0) continue;
          if(d[i]<zd){ zd=d[i]; ziel=i; }
        }
        if(ziel<0) continue;                // kein Gebirge erreichbar
        const soll=5+((rng()*6)|0);
        const q2=[ziel]; const drin=new Set([ziel]);
        map.oreT[ziel]=sorte; map.oreA[ziel]=menge(sorte);
        for(let qi=0; qi<q2.length && drin.size<soll; qi++){
          for(const nb of map.nbs(q2[qi])){
            if(drin.size>=soll) break;
            if(drin.has(nb) || !istBerg(nb) || map.oreT[nb]) continue;
            drin.add(nb); q2.push(nb);
            map.oreT[nb]=sorte; map.oreA[nb]=menge(sorte);
          }
        }
      }
    }
  }

  // Garantierte Ressourcen nahe Start: Bäume + Steine
  for(const s of starts) ensureStartResources(map, s, rng);

  // Spezialknoten (Tor) für Missionen
  let gate=null;
  if(opts.gate){
    let best=-1,bs=-1;
    for(const c of cand){
      let d=1e9; for(const s of starts){ const dx=map.X(c)-map.X(s),dy=map.Y(c)-map.Y(s); d=Math.min(d,Math.sqrt(dx*dx+dy*dy)); }
      if(d>bs){ bs=d; best=c; }
    }
    if(best>=0){ gate=best; clearArea(map,best,1); map.obj[best]=OBJ.GATE; }
  }
  map.computePasses();
  // massive: Beschreibung der gesetzten Bergkörper ({cx,cy,R,form}) – für
  // Kampagnenskripte und Messungen. Wird NICHT gespeichert; ein geladener
  // Spielstand hat die Liste nicht (die Karte selbst steckt im Spielstand).
  return { map, starts, gate,
           massive: massive.map(M=>({ cx:M.cx, cy:M.cy, R:M.R, form:M.form })) };
}

function clearArea(map, center, r){
  const seen=new Set([center]); let q=[center];
  map.obj[center]=OBJ.NONE;
  for(let d=0; d<r; d++){
    const nq=[];
    for(const i of q) for(const n of map.nbs(i)){
      if(seen.has(n)) continue; seen.add(n); nq.push(n);
      if(map.terr[n]===TER.WATER) map.terr[n]=TER.GRASS;
      if(map.terr[n]===TER.MOUNT||map.terr[n]===TER.LAVA||map.terr[n]===TER.SWAMP) map.terr[n]=TER.GRASS;
      map.obj[n]=OBJ.NONE;      // auch Ring 1 räumen: sonst steht die Burg im Baum
    }
    q=nq;
  }
}

function ensureStartResources(map, s, rng){
  // in Ring 3..6: mind. 12 Bäume und 3 Steinhaufen – die alten Minima
  // (7 Bäume / 2 Haufen à 6 Ladungen) waren nach wenigen Spielminuten
  // abgeerntet und die Partie hing am Tropf (Kritikbericht).
  const ring=[]; const seen=new Set([s]); let q=[s];
  for(let d=0; d<7; d++){
    const nq=[];
    for(const i of q) for(const n of map.nbs(i)){
      if(seen.has(n)) continue; seen.add(n);
      if(d>=3) ring.push(n);
      nq.push(n);
    }
    q=nq;
  }
  let trees=ring.filter(i=>{const o=map.obj[i]&127; return o===OBJ.TREE||o===OBJ.TREE2||o===OBJ.SAPLING;}).length;
  let stones=ring.filter(i=>map.obj[i]===OBJ.STONE).length;
  // G4: auch Garantie-Baeume/-Steine nicht an die Felskante setzen
  const free=ring.filter(i=> map.terrOkBuild(i)&&!map.obj[i]&&map.bld[i]<0
    && !map.nbs(i).some(q=> map.terr[q]===TER.MOUNT));
  while(trees<12 && free.length){ const i=free.splice((rng()*free.length)|0,1)[0]; map.obj[i]=OBJ.TREE; trees++; }
  // Start-Garantie 3 -> 5 Haufen: jedes Haus kostet Stein, und drei Haufen
  // (~36 Ladungen) waren nach dem ersten Ausbau aufgebraucht (Nutzerbefund)
  while(stones<5 && free.length){ const i=free.splice((rng()*free.length)|0,1)[0]; map.obj[i]=OBJ.STONE; map.amt[i]=12; stones++; }
}

function landComponents(map){
  const id = new Int32Array(map.w*map.h).fill(-1);
  const sizes = new Map(); let c=0;
  for(let i=0;i<id.length;i++){
    if(id[i]>=0 || !map.isLand(i)) continue;
    let size=0; let q=[i]; id[i]=c;
    while(q.length){
      const cur=q.pop(); size++;
      for(const n of map.nbs(cur)) if(id[n]<0 && map.isLand(n)){ id[n]=c; q.push(n); }
    }
    sizes.set(c,size); c++;
  }
  return { id, sizes };
}
