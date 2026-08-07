// Neuland – Weltkarte: Hex-Punktgitter mit Höhen, Terrain, Objekten und Rohstoffen.
import { TER, OBJ, mulberry32, clamp } from './core.js';

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
  // Knoten, auf dem gebaut werden darf (Terrain-seitig)
  terrOkBuild(i){ const t=this.terr[i]; return t===TER.GRASS || t===TER.DESERT || t===TER.SNOW; }
  terrOkMine(i){ return this.terr[i]===TER.MOUNT; }
  terrOkRoad(i){ const t=this.terr[i]; return t===TER.GRASS||t===TER.DESERT||t===TER.SNOW||t===TER.MOUNT||t===TER.SWAMP; }
  // Pässe: Sattelstellen, an denen ein Gebirgszug durchquerbar ist. Sie
  // ergeben sich eindeutig aus Gelände und Höhe und werden deshalb nach dem
  // Erzeugen UND nach dem Laden neu berechnet – kein zusätzliches Speicherfeld.
  computePasses(){
    const n=this.w*this.h;
    this.pass=new Uint8Array(n);
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
  const sample = (g, x, y)=>{
    const fx=x/gs, fy=y/gs, x0=fx|0, y0=fy|0, tx=fx-x0, ty=fy-y0;
    const sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
    const v=(xx,yy)=> g[clamp(yy,0,gh-1)*gw + clamp(xx,0,gw-1)];
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
  const ridgeAt = (x,y)=>
      (1-Math.abs(sample(grids[2],x*1.35+91,y*1.35+53)*2-1))*0.58
    + (1-Math.abs(sample(grids[1],x*2.9+17, y*2.9+29 )*2-1))*0.28
    + (1-Math.abs(sample(grids[3],x*5.7+61, y*5.7+11 )*2-1))*0.14;

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
      M.gipfel.push({ x:cx+u*cs-v*sn, y:cy+u*sn+v*cs,
                      hoch:(k===0?1.0:0.48+rng()*0.34), br:R*(0.13+rng()*0.10) });
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
    const Rl=M.R*(1 + M.a2*Math.sin(2*th+M.p1) + M.a3*Math.sin(3*th+M.p2)
                    + M.a5*Math.sin(5*th+M.p3));
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
      // Fels rastet auf GANZE Höhenstufen ein – so wie in Siedler 2. Erst
      // dadurch entstehen die klar getrennten Facettenbänder, aus denen das
      // Gebirge gelesen wird; Zwischenhöhen verwischen sie.
      const rocky = map.terr[i]===TER.MOUNT || map.terr[i]===TER.SNOW || map.terr[i]===TER.LAVA;
      const step = rocky? 0.55 : 0.42;
      const q    = rocky? 1.00 : 0.14;
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
  for(let i=0;i<w*h;i++){
    if(!woodOk(i) || map.obj[i]) continue;
    const X=map.X(i), Y=map.Y(i);
    const f = sample(grids[1], X*2.6+71, Y*2.6+43);
    const t0 = 1-treeP*res;                   // Saum des Bestands
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
  for(let i=0;i<w*h;i++){
    if(!map.terrOkBuild(i) || map.obj[i]) continue;
    if(rng() < 0.016*res){ map.obj[i]=OBJ.STONE; map.amt[i]=8+((rng()*8)|0); }
  }
  // Erz in Bergen. Granit ist breiter gestreut und ergiebiger als die
  // anderen Erze: das Steinbergwerk ist die verlässliche Dauerquelle des
  // Mittelspiels, wenn die Oberflächen-Brocken abgetragen sind – eine Mine
  // soll eine lange Partie tragen (Kritikbericht Stein-Spirale).
  const erzSetzen = (i)=>{
    const r=rng();
    if(r<0.30*res){ map.oreT[i]=1; map.oreA[i]=26+((rng()*30)|0); }      // Kohle
    else if(r<0.52*res){ map.oreT[i]=2; map.oreA[i]=22+((rng()*26)|0); } // Eisen
    else if(r<0.62*res){ map.oreT[i]=3; map.oreA[i]=16+((rng()*18)|0); } // Gold
    else if(r<0.80*res){ map.oreT[i]=4; map.oreA[i]=60+((rng()*60)|0); } // Granit
  };
  for(let i=0;i<w*h;i++) if(map.terr[i]===TER.MOUNT) erzSetzen(i);
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
  const starts=[];
  for(let p=0;p<nPl;p++){
    let best=-1,bs=-1;
    for(let t=0;t<260;t++){
      const c=cand[(rng()*cand.length)|0]; if(c===undefined) break;
      let score = rng()*4;
      for(const s of starts){
        const dx=map.X(c)-map.X(s), dy=map.Y(c)-map.Y(s);
        score += Math.sqrt(dx*dx+dy*dy);
      }
      if(starts.length===0) score += Math.min(map.X(c), map.Y(c), w-map.X(c), h-map.Y(c))*0.15;
      if(score>bs){ bs=score; best=c; }
    }
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
    let bx=-1, by=-1, bs=-1;
    for(let t=0;t<200;t++){
      const th=rng()*6.2832, rr=10+rng()*3.5;
      const cx=sx+Math.cos(th)*rr, cy=sy+Math.sin(th)*rr;
      if(cx<7||cy<7||cx>w-8||cy>(h-8)*ROWQ) continue;
      let ok=true;
      for(const M of massive) if(Math.hypot(cx-M.cx,cy-M.cy) < 0.85*(5.4+M.R)){ ok=false; break; }
      if(!ok) continue;
      let land=0, prob=0;
      for(let a=0;a<9;a++){
        const X=Math.round(cx+Math.cos(a*1.4)*3.6), Y=Math.round((cy+Math.sin(a*1.4)*3.6)/ROWQ);
        if(X<0||Y<0||X>=w||Y>=h) continue;
        prob++; if(raw[map.idx(X,Y)]>=SEA) land++;
      }
      if(prob<7 || land<prob*0.85) continue;
      const sc=rng();
      if(sc>bs){ bs=sc; bx=cx; by=cy; }
    }
    if(bx<0) continue;
    const kasten=stempeln(macheMassiv(bx, by, 4.6+rng()*1.4, 'kuppe'));
    gelaendeSchreiben(kasten.x0,kasten.x1,kasten.y0,kasten.y1);
    // was jetzt Fels ist, trägt keine Bäume/Brocken mehr und bekommt Erz
    for(let Y=kasten.y0;Y<=kasten.y1;Y++) for(let X=kasten.x0;X<=kasten.x1;X++){
      const i=map.idx(X,Y);
      if(map.terr[i]!==TER.MOUNT && map.terr[i]!==TER.SNOW) continue;
      map.obj[i]=OBJ.NONE; map.amt[i]=0;
      if(map.terr[i]===TER.MOUNT && !map.oreT[i]) erzSetzen(i);
    }
  }
  // Jetzt steht das Gelände endgültig: Kessel-Durchlässe prüfen und notfalls
  // freiräumen (siehe kesselDurchlassSichern).
  kesselDurchlassSichern();
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
  while(stones<3 && free.length){ const i=free.splice((rng()*free.length)|0,1)[0]; map.obj[i]=OBJ.STONE; map.amt[i]=10; stones++; }
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
