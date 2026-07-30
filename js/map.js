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
    for(let y=Math.max(0,gy-2); y<=Math.min(this.h-1,gy+2); y++){
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
  const sizes = { S:[44,44], M:[58,58], L:[74,74] };
  const [w,h] = Array.isArray(opts.size) ? opts.size : (sizes[opts.size]||sizes.M);
  const rng = mulberry32(opts.seed>>>0);
  const map = new WorldMap(w,h);
  const theme = opts.theme || 'gruen';
  const res = opts.resources ?? 1;      // 0.6 knapp, 1 normal, 1.5 üppig
  const nPl = opts.playersN || 1;

  // Wertrauschen (fbm)
  const gs = 8, gw = Math.ceil(w/gs)+2, gh = Math.ceil(h/gs)+2;
  const mkGrid = ()=> Float32Array.from({length:gw*gh}, ()=> rng());
  const grids = [mkGrid(), mkGrid(), mkGrid()];
  const sample = (g, x, y)=>{
    const fx=x/gs, fy=y/gs, x0=fx|0, y0=fy|0, tx=fx-x0, ty=fy-y0;
    const sx=tx*tx*(3-2*tx), sy=ty*ty*(3-2*ty);
    const v=(xx,yy)=> g[clamp(yy,0,gh-1)*gw + clamp(xx,0,gw-1)];
    return (v(x0,y0)*(1-sx)+v(x0+1,y0)*sx)*(1-sy) + (v(x0,y0+1)*(1-sx)+v(x0+1,y0+1)*sx)*sy;
  };
  const fbm = (x,y)=> sample(grids[0],x,y)*0.55 + sample(grids[1],x*2.1+7,y*2.1+3)*0.3 + sample(grids[2],x*4.3+13,y*4.3+11)*0.15;

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
  const MNT = theme==='gebirge'?0.58: 0.66;
  for(let i=0;i<w*h;i++){
    const e=map.hgt[i];
    if(e < SEA){ map.terr[i]=TER.WATER; map.hgt[i]=SEA*0.9; }
    else if(e > MNT){ map.terr[i] = (theme==='winter'&&e>MNT+0.12)?TER.SNOW : TER.MOUNT; }
    else {
      map.terr[i]=TER.GRASS;
      const m = sample(grids[2], map.X(i)*1.9+53, map.Y(i)*1.9+29);
      if(theme==='wueste' && m>0.35) map.terr[i]=TER.DESERT;
      if(theme==='gruen' && m>0.87) map.terr[i]=TER.SWAMP;
      if(theme==='sumpf' && m>0.52) map.terr[i]=TER.SWAMP;
      if(theme==='winter' && m>0.45) map.terr[i]=TER.SNOW;
      if(theme==='vulkan'){ if(m>0.84) map.terr[i]=TER.LAVA; else if(m>0.6) map.terr[i]=TER.DESERT; }
    }
    // Höhe normalisieren für Darstellung
    map.hgt[i] = (map.hgt[i]-SEA) * 2.2;
  }

  // Bäume
  const treeP = { gruen:0.34, winter:0.18, wueste:0.08, vulkan:0.10, sumpf:0.22, inseln:0.30, gebirge:0.22 }[theme] ?? 0.3;
  for(let i=0;i<w*h;i++){
    if(map.terr[i]!==TER.GRASS && !(map.terr[i]===TER.SNOW&&theme==='winter')) continue;
    const f = sample(grids[1], map.X(i)*2.6+71, map.Y(i)*2.6+43);
    if(f>1-treeP*res && rng()<0.85){ map.obj[i]=OBJ.TREE; }
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
    if(r<0.30*res){ map.oreT[i]=1; map.oreA[i]=6+((rng()*8)|0); }        // Kohle
    else if(r<0.52*res){ map.oreT[i]=2; map.oreA[i]=5+((rng()*7)|0); }   // Eisen
    else if(r<0.62*res){ map.oreT[i]=3; map.oreA[i]=4+((rng()*5)|0); }   // Gold
    else if(r<0.74*res){ map.oreT[i]=4; map.oreA[i]=6+((rng()*8)|0); }   // Granit
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
      if(map.obj[n]!==OBJ.TREE || d>0) map.obj[n]=OBJ.NONE;
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
  let trees=ring.filter(i=>map.obj[i]===OBJ.TREE).length;
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
