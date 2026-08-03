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
  const sizes = { S:[62,62], M:[84,84], L:[110,110] };
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
  // Fläche. Mehrere Oktaven übereinander ergeben ein verästeltes Kammnetz –
  // daraus entstehen schmale Gebirgszüge statt breiter Hochebenen.
  const ridgeAt = (x,y)=>
      (1-Math.abs(sample(grids[2],x*1.35+91,y*1.35+53)*2-1))*0.58
    + (1-Math.abs(sample(grids[1],x*2.9+17, y*2.9+29 )*2-1))*0.28
    + (1-Math.abs(sample(grids[3],x*5.7+61, y*5.7+11 )*2-1))*0.14;
  // sanft ansteigendes Vorland um jeden Kamm
  const foothill = (x,y)=> sample(grids[0], x*1.1+37, y*1.1+83);

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
  // Anteil der Landfläche, der Fels werden soll. Die Schwelle auf dem
  // Gratrauschen wird daraus BERECHNET statt geraten – sonst kippt eine
  // Karte je nach Startwert zwischen "kein Fels" und "alles Fels".
  const ROCK_SHARE = { gebirge:0.42, winter:0.20, vulkan:0.26, wueste:0.13,
                       sumpf:0.11, inseln:0.13, gruen:0.17 }[theme] ?? 0.17;
  const raw = Float32Array.from(map.hgt);
  // Kammstärke je Knoten: 0 = flaches Land, 1 = Gipfelgrat
  const spine = new Float32Array(w*h);
  const rawSpine = new Float32Array(w*h);
  const landVals=[];
  for(let i=0;i<w*h;i++){
    const X=map.X(i), Y=map.Y(i);
    const r=ridgeAt(X,Y);
    // Gebirge wächst nur dort, wo das Land ohnehin schon höher liegt –
    // sonst stünde ein Grat mitten in der Küstenebene
    const land=Math.max(0, Math.min(1, (raw[i]-SEA)/0.34));
    const lift=0.55+0.45*foothill(X,Y);
    const v=r*lift*(0.45+0.55*land);
    rawSpine[i]=v;
    if(raw[i]>=SEA) landVals.push(v);
  }
  landVals.sort((a,b)=>a-b);
  const T  = landVals.length? landVals[Math.floor(landVals.length*(1-ROCK_SHARE))] : 1;
  const HI = landVals.length? landVals[landVals.length-1] : 1;
  const span = Math.max(1e-4, HI-T);
  for(let i=0;i<w*h;i++) spine[i]=Math.max(0,(rawSpine[i]-T)/span);
  for(let i=0;i<w*h;i++){
    const e=raw[i];
    const sp=spine[i];
    if(e < SEA){ map.terr[i]=TER.WATER; }
    else if(sp > 0){
      // der Kamm selbst ist Fels, in der Höhe vereist
      map.terr[i] = (sp>0.66 && (theme==='winter'||theme==='gebirge')) ? TER.SNOW : TER.MOUNT;
    }
    else {
      map.terr[i]=TER.GRASS;
      const m = sample(grids[2], map.X(i)*1.9+53, map.Y(i)*1.9+29);
      if(theme==='wueste' && m>0.35) map.terr[i]=TER.DESERT;
      if(theme==='gruen' && m>0.87) map.terr[i]=TER.SWAMP;
      if(theme==='sumpf' && m>0.52) map.terr[i]=TER.SWAMP;
      if(theme==='winter' && m>0.45) map.terr[i]=TER.SNOW;
      if(theme==='vulkan'){ if(m>0.84) map.terr[i]=TER.LAVA; else if(m>0.6) map.terr[i]=TER.DESERT; }
    }
    // Darstellungshöhe: Ebene sanft gewellt, der Grat türmt sich schmal auf.
    // Die Kammstärke geht mit einer Potenz ein -> die Flanken fallen steil ab,
    // der Gipfel bleibt eine Linie und keine Platte.
    let hv;
    if(map.terr[i]===TER.WATER) hv=-0.10;                 // Wasserspiegel unter Land
    else {
      const X=map.X(i), Y=map.Y(i);
      hv=(e-SEA)*AMP + detail(X,Y)*2.1;                  // gewellte Ebene
      if(sp>0){
        // Deutlich flacher als zuvor: ein Knoten darf höchstens rund vier
        // Bildzeilen nach oben rutschen, sonst schiebt sich der Berg über
        // die Reihen dahinter und Wasser landet optisch auf dem Gipfel.
        hv += Math.pow(sp,0.72)*4.4                       // Kammhöhe
            + Math.pow(sp,2.2)*2.0;                       // Gipfel überhöht
      }
    }
    // Fels wird nur GANZ leicht terrassiert. Starke Rasterung ließ den Berg
    // wie ein Amphitheater aussehen; ein Grat lebt von der durchgehenden
    // Flanke, die Absätze setzt der Renderer als Klippen obendrauf.
    // Fels rastet auf GANZE Höhenstufen ein – so wie in Siedler 2. Erst
    // dadurch entstehen die klar getrennten Facettenbänder, aus denen das
    // Gebirge gelesen wird; Zwischenhöhen verwischen sie.
    const rocky = map.terr[i]===TER.MOUNT || map.terr[i]===TER.SNOW || map.terr[i]===TER.LAVA;
    const step = rocky? 0.55 : 0.42;
    const q    = rocky? 1.00 : 0.14;
    map.hgt[i] = hv*(1-q) + Math.round(hv/step)*step*q;
  }

  // ---- Wälder ----
  // Nicht "Rauschen über Schwelle = Baum" (das ergibt geschlossene Blöcke),
  // sondern Bestände mit weichem Rand, Lichtungen im Inneren und Jungwuchs
  // am Saum. Ein Nachlauf lichtet zu dichte Stellen aus, damit Siedler
  // überall durchkommen und der Wald atmet.
  const treeP = { gruen:0.34, winter:0.18, wueste:0.08, vulkan:0.10, sumpf:0.22, inseln:0.30, gebirge:0.22 }[theme] ?? 0.3;
  const woodOk = (i)=> map.terr[i]===TER.GRASS || (map.terr[i]===TER.SNOW&&theme==='winter');
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
  // Steinhaufen
  for(let i=0;i<w*h;i++){
    if(!map.terrOkBuild(i) || map.obj[i]) continue;
    if(rng() < 0.012*res){ map.obj[i]=OBJ.STONE; map.amt[i]=4+((rng()*5)|0); }
  }
  // Erz in Bergen
  for(let i=0;i<w*h;i++){
    if(map.terr[i]!==TER.MOUNT) continue;
    const r=rng();
    if(r<0.30*res){ map.oreT[i]=1; map.oreA[i]=26+((rng()*30)|0); }      // Kohle
    else if(r<0.52*res){ map.oreT[i]=2; map.oreA[i]=22+((rng()*26)|0); } // Eisen
    else if(r<0.62*res){ map.oreT[i]=3; map.oreA[i]=16+((rng()*18)|0); } // Gold
    else if(r<0.74*res){ map.oreT[i]=4; map.oreA[i]=28+((rng()*32)|0); } // Granit
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
  return { map, starts, gate };
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
  // in Ring 3..6: mind. 6 Bäume und 2 Steinhaufen
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
  const free=ring.filter(i=> map.terrOkBuild(i)&&!map.obj[i]&&map.bld[i]<0);
  while(trees<7 && free.length){ const i=free.splice((rng()*free.length)|0,1)[0]; map.obj[i]=OBJ.TREE; trees++; }
  while(stones<2 && free.length){ const i=free.splice((rng()*free.length)|0,1)[0]; map.obj[i]=OBJ.STONE; map.amt[i]=6; stones++; }
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
