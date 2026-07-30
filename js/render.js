// Neuland – Renderer: komplett prozedural gezeichnete 2D-Grafik (Canvas).
import { TER, OBJ, BLD, PLAYER_COLORS, PLAYER_COLORS_DARK, RANKS } from './core.js';
import { TILE, ROWH, HSCALE } from './map.js';

const TER_COL = {
  gruen:  { [TER.WATER]:'#2b6f9e', [TER.GRASS]:'#5d9c46', [TER.DESERT]:'#c9b26a', [TER.MOUNT]:'#8a8378', [TER.SNOW]:'#e8ecf2', [TER.SWAMP]:'#4e7350', [TER.LAVA]:'#8a2d12' },
  winter: { [TER.WATER]:'#39627e', [TER.GRASS]:'#7fa06b', [TER.DESERT]:'#c9b26a', [TER.MOUNT]:'#7d7f88', [TER.SNOW]:'#e9edf4', [TER.SWAMP]:'#5d7361', [TER.LAVA]:'#8a2d12' },
  wueste: { [TER.WATER]:'#2f7ba0', [TER.GRASS]:'#8fa04f', [TER.DESERT]:'#d9bf72', [TER.MOUNT]:'#9c8a70', [TER.SNOW]:'#efe9da', [TER.SWAMP]:'#6d7c4e', [TER.LAVA]:'#8a2d12' },
  vulkan: { [TER.WATER]:'#2b5d80', [TER.GRASS]:'#6a8748', [TER.DESERT]:'#a08055', [TER.MOUNT]:'#6f6259', [TER.SNOW]:'#e8ecf2', [TER.SWAMP]:'#55663f', [TER.LAVA]:'#c2410c' },
  sumpf:  { [TER.WATER]:'#33636b', [TER.GRASS]:'#5c8a4a', [TER.DESERT]:'#b3a468', [TER.MOUNT]:'#7d7a6e', [TER.SNOW]:'#e8ecf2', [TER.SWAMP]:'#46694a', [TER.LAVA]:'#8a2d12' },
};
TER_COL.inseln=TER_COL.gruen; TER_COL.gebirge=TER_COL.winter;

const CHUNK = 12; // Knoten pro Chunk-Kante

function shade(hex, f){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.max(0,Math.min(255,r*f)); g=Math.max(0,Math.min(255,g*f)); b=Math.max(0,Math.min(255,b*f));
  return `rgb(${r|0},${g|0},${b|0})`;
}

export class Renderer {
  constructor(canvas){
    this.cv=canvas; this.ctx=canvas.getContext('2d');
    this.chunks=new Map();       // key -> {cv, ver}
    this.chunkVer=new Map();     // key -> dirty counter
    this.terVer=0;
    this.sprites=new Map();
    this.time=0;
  }
  setGame(game){
    this.game=game;
    this.theme=game.setup.theme||'gruen';
    this.chunks.clear(); this.chunkVer.clear();
    this.lastTerritoryVer=-1;
    this.borderEdges=[];
  }
  resize(w,h,dpr){
    this.cv.width=w*dpr; this.cv.height=h*dpr;
    this.dpr=dpr; this.vw=w; this.vh=h;
  }
  // ---------- Chunks (Terrain) ----------
  chunkKey(cx,cy){ return cx+cy*1000; }
  markDirtyNode(i){
    const m=this.game.map;
    const x=m.X(i), y=m.Y(i);
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const cx=Math.floor((x+dx)/CHUNK), cy=Math.floor((y+dy)/CHUNK);
      this.chunkVer.set(this.chunkKey(cx,cy), (this.chunkVer.get(this.chunkKey(cx,cy))||0)+1);
    }
  }
  getChunk(cx,cy){
    const key=this.chunkKey(cx,cy);
    const ver=this.chunkVer.get(key)||0;
    let c=this.chunks.get(key);
    if(c && c.ver===ver) return c;
    const m=this.game.map;
    const pad=TILE*1.5;
    const w=CHUNK*TILE+pad*2, h=CHUNK*ROWH+pad*2+HSCALE*3;
    if(!c){ c={cv:document.createElement('canvas')}; c.cv.width=w; c.cv.height=h; this.chunks.set(key,c); }
    c.ver=ver;
    c.ox=cx*CHUNK*TILE-pad; c.oy=cy*CHUNK*ROWH-pad-HSCALE*1.5;
    const g=c.cv.getContext('2d');
    g.clearRect(0,0,w,h);
    g.save(); g.translate(-c.ox,-c.oy);
    const cols=TER_COL[this.theme]||TER_COL.gruen;
    const x0=cx*CHUNK-1, y0=cy*CHUNK-1, x1=x0+CHUNK+2, y1=y0+CHUNK+2;
    for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++){
      for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
        const i=m.idx(x,y);
        const p=y&1;
        const iE = x+1<m.w ? m.idx(x+1,y) : i;
        const iSW = m.inb(x-1+p,y+1)? m.idx(x-1+p,y+1) : i;
        const iSE = m.inb(x+p,y+1)? m.idx(x+p,y+1) : i;
        this.tri(g, m, cols, i, iE, iSE);
        this.tri(g, m, cols, i, iSE, iSW);
      }
    }
    g.restore();
    return c;
  }
  tri(g, m, cols, a,b,c){
    const [ax,ay]=m.worldPos(a), [bx,by]=m.worldPos(b), [cx2,cy2]=m.worldPos(c);
    // dominantes Terrain: Mehrheit, Wasser gewinnt
    const ts=[m.terr[a],m.terr[b],m.terr[c]];
    let t;
    if(ts[0]===ts[1]||ts[0]===ts[2]) t=ts[0]; else if(ts[1]===ts[2]) t=ts[1]; else t=ts[0];
    let col=cols[t]||'#777';
    // Licht aus Höhendifferenz (Licht von Nordwest)
    const l=1 + ( (m.hgt[a]-m.hgt[c])*0.55 + (m.hgt[a]-m.hgt[b])*0.3 );
    col=shade(col, Math.max(0.62,Math.min(1.38,l)));
    g.fillStyle=col;
    g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.lineTo(cx2,cy2); g.closePath();
    g.fill();
    // Wasser leicht dunkler Rand
    if(t===TER.WATER){ g.fillStyle='rgba(255,255,255,0.03)'; g.fill(); }
  }

  // ---------- Sprites ----------
  sprite(key, w, h, draw){
    let s=this.sprites.get(key);
    if(s) return s;
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    draw(cv.getContext('2d'), w, h);
    this.sprites.set(key,cv);
    return cv;
  }
  bldSprite(type, player, state){
    const key=`b_${type}_${player}_${state}`;
    const def=BLD[type];
    const big=def.size==='L'||type==='hq', med=def.size==='M';
    const W=big?92:med?76:62, H=big?86:med?72:60;
    return this.sprite(key, W, H, (g)=>{
      const pc=PLAYER_COLORS[player]||'#888', pcd=PLAYER_COLORS_DARK[player]||'#555';
      const base=W/2;
      g.translate(0.5,0.5);
      if(state==='build'){
        // Baustelle: Gerüst
        g.strokeStyle='#8a6b43'; g.lineWidth=3;
        g.strokeRect(W*0.2, H*0.4, W*0.6, H*0.5);
        g.beginPath();
        g.moveTo(W*0.2,H*0.9); g.lineTo(W*0.8,H*0.4); g.moveTo(W*0.8,H*0.9); g.lineTo(W*0.2,H*0.4);
        g.stroke();
        g.fillStyle='#b0853f';
        g.fillRect(W*0.3,H*0.82,W*0.4,H*0.08);
        return;
      }
      const wall='#d8c9a8', wallD='#b2a482';
      const roofC = def.mil? pcd : (def.mine? '#6b625a' : pc);
      const drawHouse=(x,y,w2,h2,roofH)=>{
        g.fillStyle=wall; g.fillRect(x,y,w2,h2);
        g.fillStyle=wallD; g.fillRect(x,y+h2-4,w2,4);
        g.strokeStyle='rgba(60,40,20,0.5)'; g.lineWidth=1.5; g.strokeRect(x,y,w2,h2);
        g.fillStyle=roofC;
        g.beginPath(); g.moveTo(x-4,y); g.lineTo(x+w2/2,y-roofH); g.lineTo(x+w2+4,y); g.closePath(); g.fill();
        g.strokeStyle='rgba(0,0,0,0.35)'; g.stroke();
      };
      switch(def.size){
        case 'MINE': {
          // Stolleneingang mit Balken
          g.fillStyle='#5d564e'; g.beginPath();
          g.moveTo(W*0.1,H*0.9); g.lineTo(W*0.5,H*0.28); g.lineTo(W*0.9,H*0.9); g.closePath(); g.fill();
          g.fillStyle='#2a241f'; g.fillRect(W*0.36,H*0.55,W*0.28,H*0.35);
          g.strokeStyle='#8a6b43'; g.lineWidth=4;
          g.strokeRect(W*0.36,H*0.55,W*0.28,H*0.35);
          g.fillStyle=pc; g.fillRect(W*0.44,H*0.2,4,16);
          g.fillRect(W*0.48,H*0.2,10,7);
          break;
        }
        case 'L': {
          if(type==='hq' || type==='fortress'){
            // Burg mit Türmen
            g.fillStyle='#a9a49b';
            g.fillRect(W*0.16,H*0.42,W*0.68,H*0.46);
            g.fillStyle='#8f8a80';
            g.fillRect(W*0.16,H*0.42,W*0.68,6);
            for(const tx of [W*0.12, W*0.76]){
              g.fillStyle='#b5b0a6'; g.fillRect(tx,H*0.3,W*0.14,H*0.6);
              g.fillStyle=pcd;
              g.beginPath(); g.moveTo(tx-3,H*0.3); g.lineTo(tx+W*0.07,H*0.12); g.lineTo(tx+W*0.14+3,H*0.3); g.closePath(); g.fill();
            }
            // Zinnen
            g.fillStyle='#b5b0a6';
            for(let k=0;k<5;k++) g.fillRect(W*0.2+k*W*0.12, H*0.36, W*0.07, 8);
            g.fillStyle='#3a2d20'; g.fillRect(W*0.42,H*0.62,W*0.16,H*0.26);
            g.fillStyle=pc; g.fillRect(W*0.485,H*0.05,3,20); g.fillRect(W*0.515,H*0.05,14,8);
          } else if(type==='farm'||type==='pigfarm'){
            drawHouse(W*0.12,H*0.5,W*0.5,H*0.36,H*0.22);
            drawHouse(W*0.55,H*0.6,W*0.34,H*0.26,H*0.16);
            g.fillStyle='#7a5b35'; g.fillRect(W*0.14,H*0.86,W*0.72,4);
          } else {
            drawHouse(W*0.15,H*0.45,W*0.7,H*0.42,H*0.26);
          }
          break;
        }
        case 'M': {
          if(type==='mill'){
            g.fillStyle='#cbbd9d'; g.beginPath();
            g.moveTo(W*0.36,H*0.9); g.lineTo(W*0.42,H*0.34); g.lineTo(W*0.58,H*0.34); g.lineTo(W*0.64,H*0.9); g.closePath(); g.fill();
            g.fillStyle=pc; g.beginPath(); g.arc(W*0.5,H*0.32,7,0,7); g.fill();
            g.strokeStyle='#6b5636'; g.lineWidth=4;
            for(let k=0;k<4;k++){
              const a=k*Math.PI/2+0.4;
              g.beginPath(); g.moveTo(W*0.5,H*0.32); g.lineTo(W*0.5+Math.cos(a)*W*0.3, H*0.32+Math.sin(a)*W*0.3); g.stroke();
            }
          } else if(type==='watchtower'){
            g.fillStyle='#b5b0a6'; g.fillRect(W*0.32,H*0.25,W*0.36,H*0.63);
            g.fillStyle='#8f8a80'; g.fillRect(W*0.28,H*0.25,W*0.44,8);
            for(let k=0;k<3;k++) g.fillRect(W*0.3+k*W*0.15, H*0.16, W*0.09, 8);
            g.fillStyle='#3a2d20'; g.fillRect(W*0.44,H*0.66,W*0.12,H*0.22);
            g.fillStyle=pc; g.fillRect(W*0.48,H*0.02,3,14); g.fillRect(W*0.51,H*0.02,12,6);
          } else if(type==='catapult'){
            g.fillStyle='#7a5b35';
            g.fillRect(W*0.2,H*0.7,W*0.6,H*0.1);
            g.strokeStyle='#5d452a'; g.lineWidth=5;
            g.beginPath(); g.moveTo(W*0.3,H*0.75); g.lineTo(W*0.62,H*0.3); g.stroke();
            g.fillStyle='#4a4a4a'; g.beginPath(); g.arc(W*0.64,H*0.28,6,0,7); g.fill();
            g.fillStyle='#5d452a';
            g.beginPath(); g.arc(W*0.3,H*0.8,7,0,7); g.arc(W*0.7,H*0.8,7,0,7); g.fill();
            g.fillStyle=pc; g.fillRect(W*0.18,H*0.4,10,6);
          } else if(type==='smelter'||type==='mint'||type==='armory'){
            drawHouse(W*0.16,H*0.48,W*0.56,H*0.4,H*0.22);
            g.fillStyle='#6f6a63'; g.fillRect(W*0.68,H*0.28,10,H*0.4);
            g.fillStyle='#4a4640'; g.fillRect(W*0.66,H*0.24,14,6);
          } else {
            drawHouse(W*0.16,H*0.48,W*0.68,H*0.4,H*0.24);
          }
          break;
        }
        default: { // S
          if(type==='barracks'||type==='guardhouse'){
            g.fillStyle='#b5b0a6'; g.fillRect(W*0.22,H*0.42,W*0.56,H*0.46);
            g.fillStyle='#8f8a80'; g.fillRect(W*0.22,H*0.42,W*0.56,6);
            for(let k=0;k<3;k++) g.fillRect(W*0.24+k*W*0.19,H*0.34,W*0.1,8);
            g.fillStyle='#3a2d20'; g.fillRect(W*0.42,H*0.62,W*0.16,H*0.26);
            g.fillStyle=pc; g.fillRect(W*0.47,H*0.12,3,14); g.fillRect(W*0.5,H*0.12,11,6);
          } else if(type==='well'){
            g.fillStyle='#98938a'; g.fillRect(W*0.3,H*0.55,W*0.4,H*0.3);
            g.fillStyle='#243a4d'; g.fillRect(W*0.36,H*0.6,W*0.28,H*0.16);
            g.strokeStyle='#7a5b35'; g.lineWidth=4;
            g.beginPath(); g.moveTo(W*0.3,H*0.55); g.lineTo(W*0.3,H*0.3); g.moveTo(W*0.7,H*0.55); g.lineTo(W*0.7,H*0.3); g.stroke();
            g.fillStyle=pcd; g.beginPath(); g.moveTo(W*0.24,H*0.32); g.lineTo(W*0.5,H*0.16); g.lineTo(W*0.76,H*0.32); g.closePath(); g.fill();
          } else {
            drawHouse(W*0.2,H*0.5,W*0.6,H*0.38,H*0.2);
          }
        }
      }
      // Tür
      if(def.size!=='MINE' && !['hq','fortress','watchtower','barracks','guardhouse','well','mill','catapult'].includes(type)){
        g.fillStyle='#3a2d20';
        g.fillRect(W*0.44,H*0.7,W*0.13,H*0.18);
      }
    });
  }
  treeSprite(stage, theme){
    return this.sprite(`t_${stage}_${theme}`, 44, 56, (g,W,H)=>{
      const winter=theme==='winter';
      const trunk='#6b4a2c';
      const leaf= winter? '#3d6647' : stage===1? '#79b25a' : '#3f7d35';
      const s= stage===1? 0.45 : stage===2? 0.72 : 1;
      g.translate(W/2, H);
      g.fillStyle=trunk;
      g.fillRect(-3*s, -18*s, 6*s, 18*s);
      g.fillStyle=leaf;
      g.beginPath(); g.moveTo(0,-56*s); g.lineTo(15*s,-26*s); g.lineTo(-15*s,-26*s); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0,-46*s); g.lineTo(19*s,-14*s); g.lineTo(-19*s,-14*s); g.closePath(); g.fill();
      if(winter){ g.fillStyle='rgba(240,245,250,0.85)';
        g.beginPath(); g.moveTo(0,-56*s); g.lineTo(9*s,-38*s); g.lineTo(-9*s,-38*s); g.closePath(); g.fill(); }
    });
  }
  // ---------- Hauptzeichnung ----------
  draw(cam, ui, dtMs){
    const g=this.ctx, game=this.game, m=game.map;
    this.time+=dtMs;
    g.setTransform(this.dpr,0,0,this.dpr,0,0);
    g.fillStyle = (TER_COL[this.theme]||TER_COL.gruen)[TER.WATER];
    g.fillRect(0,0,this.vw,this.vh);
    // Kamera
    g.translate(this.vw/2, this.vh/2);
    g.scale(cam.z, cam.z);
    g.translate(-cam.x, -cam.y);
    // geänderte Knoten -> Chunks invalidieren
    if(game.changedNodes.length){
      for(const i of game.changedNodes) this.markDirtyNode(i);
      game.changedNodes.length=0;
    }
    // sichtbarer Bereich
    const halfW=this.vw/2/cam.z, halfH=this.vh/2/cam.z;
    const wx0=cam.x-halfW-TILE*2, wx1=cam.x+halfW+TILE*2;
    const wy0=cam.y-halfH-ROWH*2, wy1=cam.y+halfH+ROWH*3;
    const cx0=Math.floor(wx0/(CHUNK*TILE)), cx1=Math.floor(wx1/(CHUNK*TILE));
    const cy0=Math.floor(wy0/(CHUNK*ROWH)), cy1=Math.floor(wy1/(CHUNK*ROWH));
    for(let cy=Math.max(0,cy0); cy<=Math.min(Math.ceil(m.h/CHUNK)-1,cy1); cy++)
      for(let cx=Math.max(0,cx0); cx<=Math.min(Math.ceil(m.w/CHUNK)-1,cx1); cx++){
        const c=this.getChunk(cx,cy);
        g.drawImage(c.cv, c.ox, c.oy);
      }
    // Territorium-Grenzen
    if(this.lastTerritoryVer!==game.territoryVer){ this.computeBorders(); this.lastTerritoryVer=game.territoryVer; }
    g.lineWidth=2.5;
    for(const e of this.borderEdges){
      if(e.x2<wx0||e.x1>wx1||e.y2<wy0-60||e.y1>wy1+60) continue;
      g.strokeStyle=PLAYER_COLORS[e.pl]+'cc';
      g.beginPath(); g.moveTo(e.x1,e.y1); g.lineTo(e.x2,e.y2); g.stroke();
    }
    // Straßen
    g.lineCap='round';
    for(const r of game.roads.values()){
      g.strokeStyle='#9a8563';
      g.lineWidth=7;
      g.beginPath();
      r.path.forEach((n,ix)=>{ const [x,y]=m.worldPos(n); if(ix===0) g.moveTo(x,y); else g.lineTo(x,y); });
      g.stroke();
      g.strokeStyle='#c9b28a'; g.lineWidth=3.5; g.stroke();
    }
    // Straßen-Vorschau
    if(ui.roadPreview && ui.roadPreview.length>1){
      g.strokeStyle='rgba(255,255,160,0.9)'; g.lineWidth=4; g.setLineDash([8,7]);
      g.beginPath();
      ui.roadPreview.forEach((n,ix)=>{ const [x,y]=m.worldPos(n); if(ix===0) g.moveTo(x,y); else g.lineTo(x,y); });
      g.stroke(); g.setLineDash([]);
    }
    // Objekte + Gebäude + Fahnen (nach y sortiert zeichnen)
    const items=[];
    const x0=Math.max(0,Math.floor(wx0/TILE)-1), x1=Math.min(m.w-1,Math.ceil(wx1/TILE)+1);
    const y0=Math.max(0,Math.floor(wy0/ROWH)-1), y1=Math.min(m.h-1,Math.ceil(wy1/ROWH)+2);
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=m.idx(x,y);
      const o=m.obj[i]&127;
      if(o!==OBJ.NONE) items.push({kind:'obj', i, o, y:m.worldPos(i)[1]});
      if(m.bld[i]>=0){ const b=game.buildings.get(m.bld[i]); if(b) items.push({kind:'bld', b, y:m.worldPos(i)[1]}); }
      if(m.flag[i]) items.push({kind:'flag', i, y:m.worldPos(i)[1]+2});
    }
    // Einheiten & Träger
    for(const r of game.roads.values()){
      const c=r.carrier;
      const pos=this.roadPos(r, c.pos);
      items.push({kind:'carrier', r, x:pos[0], y:pos[1], carrying:!!c.item, good:c.item?.good});
    }
    for(const u of game.units) items.push({kind:'unit', u, y:u.y});
    items.sort((a,b)=>a.y-b.y);
    for(const it of items){
      if(it.kind==='obj') this.drawObj(g, m, it.i, it.o);
      else if(it.kind==='bld') this.drawBld(g, m, it.b, ui);
      else if(it.kind==='flag') this.drawFlag(g, m, game, it.i);
      else if(it.kind==='carrier') this.drawFigure(g, it.x, it.y, game.roads.get(it.r.id)?.player??0, it.carrying? it.good:null, 'carrier');
      else if(it.kind==='unit') this.drawUnit(g, it.u);
    }
    // Auswahl-Marker
    if(ui.sel>=0){
      const [x,y]=m.worldPos(ui.sel);
      g.strokeStyle='rgba(255,255,255,0.95)';
      g.lineWidth=2.5;
      const r=14+Math.sin(this.time/180)*2;
      g.beginPath(); g.arc(x,y,r,0,7); g.stroke();
    }
    // Baubarkeits-Punkte im Baumodus
    if(ui.showBuildDots){
      const pl=0;
      g.fillStyle='rgba(255,255,255,0.5)';
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const i=m.idx(x,y);
        if(m.owner[i]!==pl) continue;
        if(m.bld[i]>=0||m.flag[i]||(m.obj[i]&127)!==OBJ.NONE) continue;
        if(!m.terrOkBuild(i)&&!m.terrOkMine(i)) continue;
        const [px,py]=m.worldPos(i);
        g.beginPath(); g.arc(px,py, m.terrOkMine(i)?2.4:3.2, 0,7); g.fill();
      }
    }
    // Nebel (unerforscht)
    g.fillStyle='rgba(10,14,22,0.85)';
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=m.idx(x,y);
      if(m.explored[i]) continue;
      const [px,py]=m.worldPos(i);
      g.beginPath(); g.arc(px,py,TILE*0.62,0,7); g.fill();
    }
  }
  roadPos(r, pos){
    const m=this.game.map;
    const i0=Math.floor(pos), f=pos-i0;
    const a=r.path[Math.min(i0,r.path.length-1)], b=r.path[Math.min(i0+1,r.path.length-1)];
    const [ax,ay]=m.worldPos(a), [bx,by]=m.worldPos(b);
    return [ax+(bx-ax)*f, ay+(by-ay)*f];
  }
  drawObj(g, m, i, o){
    const [x,y]=m.worldPos(i);
    switch(o){
      case OBJ.SAPLING: case OBJ.TREE2: case OBJ.TREE: {
        const st=o===OBJ.SAPLING?1:o===OBJ.TREE2?2:3;
        const s=this.treeSprite(st,this.theme);
        g.drawImage(s, x-22, y-52);
        break;
      }
      case OBJ.STONE: {
        g.fillStyle='#8f8a80';
        g.beginPath(); g.arc(x-6,y-4,8,0,7); g.arc(x+5,y-2,10,0,7); g.arc(x,y-12,6,0,7); g.fill();
        g.fillStyle='#a9a49b';
        g.beginPath(); g.arc(x+4,y-6,5,0,7); g.fill();
        break;
      }
      case OBJ.FIELD0: case OBJ.FIELD1: case OBJ.FIELD2: {
        const hgt=o===OBJ.FIELD0?3:o===OBJ.FIELD1?7:11;
        g.strokeStyle=o===OBJ.FIELD2?'#d9b74a':'#8fae52';
        g.lineWidth=2;
        for(let k=-2;k<=2;k++){
          g.beginPath(); g.moveTo(x+k*7, y+3); g.lineTo(x+k*7, y+3-hgt); g.stroke();
        }
        break;
      }
      case OBJ.GATE: {
        g.fillStyle='#7d7466';
        g.fillRect(x-16,y-34,8,34); g.fillRect(x+8,y-34,8,34);
        g.fillRect(x-20,y-40,40,8);
        g.fillStyle='rgba(140,220,255,0.5)';
        g.fillRect(x-8,y-32,16,30);
        break;
      }
    }
  }
  drawBld(g, m, b, ui){
    const [x,y]=m.worldPos(b.node);
    const s=this.bldSprite(b.type, b.player, b.state==='build'?'build':'done');
    g.drawImage(s, x-s.width/2, y-s.height+10);
    if(b.state==='build'){
      // Fortschritt
      const def=BLD[b.type];
      const total=80+30*((def.cost.board||0)+(def.cost.stone||0));
      g.fillStyle='rgba(0,0,0,0.4)'; g.fillRect(x-16,y+6,32,5);
      g.fillStyle='#ffd54a'; g.fillRect(x-16,y+6,32*Math.min(1,b.progress/total),5);
    }
    if(b.soldiers && b.state==='done'){
      // Soldaten-Anzeige
      const n=b.soldiers.length;
      for(let k=0;k<n;k++){
        g.fillStyle=PLAYER_COLORS[b.player];
        g.beginPath(); g.arc(x-14+k*6, y-  (BLD[b.type].size==='L'?54:40), 2.6, 0, 7); g.fill();
      }
    }
    // Rauch bei Produktion
    if(b.state==='done' && (BLD[b.type].prod||BLD[b.type].mine) && (b.prodT>0)){
      const ph=(this.time/700 + b.id)%1;
      g.fillStyle=`rgba(200,200,200,${0.5*(1-ph)})`;
      g.beginPath(); g.arc(x+10, y-40-ph*22, 3+ph*5, 0, 7); g.fill();
    }
  }
  drawFlag(g, m, game, i){
    const [x,y]=m.worldPos(i);
    const pl=m.owner[i];
    g.strokeStyle='#5d452a'; g.lineWidth=2.5;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-18); g.stroke();
    g.fillStyle=pl>=0?PLAYER_COLORS[pl]:'#999';
    const wob=Math.sin(this.time/300+i)*1.5;
    g.beginPath(); g.moveTo(x,y-18); g.lineTo(x+11,y-15+wob); g.lineTo(x,y-11); g.closePath(); g.fill();
    // wartende Waren
    const items=game.flagItems.get(i);
    if(items && items.length){
      for(let k=0;k<Math.min(items.length,8);k++){
        g.fillStyle=goodColor(items[k].good);
        g.fillRect(x-8+(k%4)*5, y+2+Math.floor(k/4)*5, 4,4);
      }
    }
  }
  drawUnit(g,u){
    if(u.type==='boulder'){
      g.fillStyle='#555';
      g.beginPath(); g.arc(u.x,u.y,5,0,7); g.fill();
      return;
    }
    if(u.type==='attack'){
      // Gruppe
      u.soldiers.forEach((r,k)=>{
        this.drawFigure(g, u.x+(k%3)*8-8, u.y+Math.floor(k/3)*6, u.player, null, 'soldier', r);
      });
      return;
    }
    if(u.type==='soldierMove'){ this.drawFigure(g,u.x,u.y,u.player,null,'soldier',u.rank); return; }
    this.drawFigure(g, u.x, u.y, u.player, u.carry||null, 'worker');
  }
  drawFigure(g, x, y, pl, good, kind, rank=0){
    const col=PLAYER_COLORS[pl]||'#888';
    const step=Math.sin((this.time/90)+x*0.3)*2;
    g.strokeStyle='#2a2a2a'; g.lineWidth=2;
    g.beginPath(); g.moveTo(x-2,y); g.lineTo(x-2+step*0.4,y+6); g.moveTo(x+2,y); g.lineTo(x+2-step*0.4,y+6); g.stroke();
    g.fillStyle= kind==='soldier' ? '#7d8896' : '#4a4038';
    g.fillRect(x-3.5,y-8,7,9);
    g.fillStyle=col; g.fillRect(x-3.5,y-8,7,3);
    g.fillStyle='#e8c39e';
    g.beginPath(); g.arc(x,y-11,3.4,0,7); g.fill();
    if(kind==='soldier'){
      g.fillStyle='#aab4c0'; g.fillRect(x-4.6,y-14,9.2,2.4);
      if(rank>0){ g.fillStyle='#ffd54a'; for(let k=0;k<rank;k++) g.fillRect(x-4+k*2.4, y-16.4, 1.8,1.8); }
      g.strokeStyle='#666'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(x+5,y-12); g.lineTo(x+5,y-2); g.stroke();
    }
    if(good){
      g.fillStyle=goodColor(good);
      g.fillRect(x-3,y-19,6,5);
    }
  }
  computeBorders(){
    const m=this.game.map;
    this.borderEdges=[];
    for(let i=0;i<m.owner.length;i++){
      const o=m.owner[i];
      if(o<0) continue;
      const [x,y]=m.worldPos(i);
      for(const n of m.nbs(i)){
        if(m.owner[n]===o) continue;
        const [nx,ny]=m.worldPos(n);
        // Mittelsenkrechte kurz
        const mx=(x+nx)/2, my=(y+ny)/2;
        const dx=nx-x, dy=ny-y;
        const L=Math.hypot(dx,dy)||1;
        const px=-dy/L, py=dx/L;
        this.borderEdges.push({pl:o, x1:mx-px*12, y1:my-py*12, x2:mx+px*12, y2:my+py*12});
      }
    }
  }
  // ---------- Minimap ----------
  drawMinimap(cv, cam){
    const m=this.game.map, g=cv.getContext('2d');
    const w=cv.width, h=cv.height;
    const sx=w/m.w, sy=h/m.h;
    const cols=TER_COL[this.theme]||TER_COL.gruen;
    g.fillStyle='#0a0e16'; g.fillRect(0,0,w,h);
    for(let y=0;y<m.h;y++) for(let x=0;x<m.w;x++){
      const i=m.idx(x,y);
      if(!m.explored[i]) continue;
      let c=cols[m.terr[i]];
      if(m.owner[i]>=0) c=PLAYER_COLORS[m.owner[i]];
      else if((m.obj[i]&127)===OBJ.TREE) c=shade(cols[TER.GRASS],0.7);
      g.fillStyle=c;
      g.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));
    }
    // Kamera-Rechteck
    g.strokeStyle='#fff'; g.lineWidth=1;
    const vx=(cam.x/TILE)*sx, vy=(cam.y/ROWH)*sy;
    const vw=(this.vw/cam.z/TILE)*sx, vh=(this.vh/cam.z/ROWH)*sy;
    g.strokeRect(vx-vw/2, vy-vh/2, vw, vh);
  }
}

export function goodColor(good){
  return {
    trunk:'#8a5a2c', board:'#c9a05a', stone:'#9a958c', fish:'#6fa7c7', meat:'#c26a5a',
    grain:'#d9b74a', flour:'#efe6d2', bread:'#b8813f', water:'#5a8fc7', pig:'#d99a9a',
    coal:'#3a3a3a', ironore:'#8a6a5a', iron:'#b0b4ba', gold:'#e0b23a', coin:'#ffd54a',
    sword:'#c0c8d2', shield:'#7d8896', beer:'#c78f3f',
  }[good]||'#fff';
}
