// Neuland – Renderer: komplett prozedural gezeichnete 2D-Grafik (Canvas), poliert.
import { TER, OBJ, BLD, PLAYER_COLORS, PLAYER_COLORS_DARK, RANKS } from './core.js';
import { TILE, ROWH, HSCALE } from './map.js';

const TER_COL = {
  gruen:  { [TER.WATER]:'#2a6d9c', [TER.GRASS]:'#5f9e47', [TER.DESERT]:'#cdb56e', [TER.MOUNT]:'#8b8276', [TER.SNOW]:'#e9edf3', [TER.SWAMP]:'#4d7050', [TER.LAVA]:'#7d2810' },
  winter: { [TER.WATER]:'#3a627f', [TER.GRASS]:'#84a26e', [TER.DESERT]:'#c9b26a', [TER.MOUNT]:'#7e808a', [TER.SNOW]:'#eaeef5', [TER.SWAMP]:'#5d7361', [TER.LAVA]:'#7d2810' },
  wueste: { [TER.WATER]:'#2f7ba0', [TER.GRASS]:'#93a452', [TER.DESERT]:'#dcc278', [TER.MOUNT]:'#9e8b6f', [TER.SNOW]:'#efe9da', [TER.SWAMP]:'#6d7c4e', [TER.LAVA]:'#7d2810' },
  vulkan: { [TER.WATER]:'#2b5d80', [TER.GRASS]:'#6d8a4a', [TER.DESERT]:'#a3835a', [TER.MOUNT]:'#6e6158', [TER.SNOW]:'#e9edf3', [TER.SWAMP]:'#55663f', [TER.LAVA]:'#c2410c' },
  sumpf:  { [TER.WATER]:'#33646c', [TER.GRASS]:'#5e8c4c', [TER.DESERT]:'#b5a66a', [TER.MOUNT]:'#7d7a6e', [TER.SNOW]:'#e9edf3', [TER.SWAMP]:'#456849', [TER.LAVA]:'#7d2810' },
};
TER_COL.inseln=TER_COL.gruen; TER_COL.gebirge=TER_COL.winter;

// Küstenfarben je Thema: [Strand, Flachwasser]
const COAST_COL = {
  gruen:['#d9c68e','#3e88ae'], winter:['#b9c1c7','#4a7a94'], wueste:['#e2cd8d','#3f8cb0'],
  vulkan:['#8f7d5c','#356e8e'], sumpf:['#8f865e','#3d6f74'],
};
COAST_COL.inseln=COAST_COL.gruen; COAST_COL.gebirge=COAST_COL.winter;

const CHUNK = 12; // Knoten pro Chunk-Kante
const OUT='rgba(43,29,15,0.55)';   // Standard-Kontur

function shade(hex, f){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.max(0,Math.min(255,r*f)); g=Math.max(0,Math.min(255,g*f)); b=Math.max(0,Math.min(255,b*f));
  return `rgb(${r|0},${g|0},${b|0})`;
}
function hash01(n){
  n=Math.imul(n^(n>>>15), 2246822519);
  n=Math.imul(n^(n>>>13), 3266489917);
  return ((n^(n>>>16))>>>0)/4294967296;
}
function mix(hexA, hexB, t){
  const a=parseInt(hexA.slice(1),16), b=parseInt(hexB.slice(1),16);
  const r=((a>>16)&255)+((((b>>16)&255)-((a>>16)&255))*t);
  const g=((a>>8)&255)+((((b>>8)&255)-((a>>8)&255))*t);
  const c=(a&255)+(((b&255)-(a&255))*t);
  return `rgb(${r|0},${g|0},${c|0})`;
}
function shadeRgb(rgb, f){
  const m=rgb.match(/(\d+),(\d+),(\d+)/);
  const cl=(v)=>Math.max(0,Math.min(255,v*f))|0;
  return `rgb(${cl(+m[1])},${cl(+m[2])},${cl(+m[3])})`;
}

export class Renderer {
  constructor(canvas){
    this.cv=canvas; this.ctx=canvas.getContext('2d');
    this.chunks=new Map();
    this.chunkVer=new Map();
    this.sprites=new Map();
    this.time=0;
  }
  setGame(game){
    this.game=game;
    this.theme=game.setup.theme||'gruen';
    this.chunks.clear(); this.chunkVer.clear();
    this.sprites.clear();
    this.lastTerritoryVer=-1;
    this.borderEdges=[];
  }
  resize(w,h,dpr){
    this.cv.width=w*dpr; this.cv.height=h*dpr;
    this.dpr=dpr; this.vw=w; this.vh=h;
    // Vignette vorbereiten
    const v=document.createElement('canvas'); v.width=w; v.height=h;
    const g=v.getContext('2d');
    const rad=g.createRadialGradient(w/2,h/2, Math.min(w,h)*0.38, w/2,h/2, Math.hypot(w,h)*0.62);
    rad.addColorStop(0,'rgba(8,12,20,0)');
    rad.addColorStop(1,'rgba(8,12,20,0.34)');
    g.fillStyle=rad; g.fillRect(0,0,w,h);
    this.vignette=v;
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
    const ts=[m.terr[a],m.terr[b],m.terr[c]];
    let t;
    if(ts[0]===ts[1]||ts[0]===ts[2]) t=ts[0]; else if(ts[1]===ts[2]) t=ts[1]; else t=ts[0];
    const coast=COAST_COL[this.theme]||COAST_COL.gruen;
    const hasWater=ts.includes(TER.WATER), hasLand=ts.some(x=>x!==TER.WATER);
    // Küste als weiche Mischung (Anteil = Zahl der "fremden" Ecken)
    let col;
    if(t===TER.WATER){
      const landN=ts.filter(x=>x!==TER.WATER).length;
      col = landN? mix(cols[TER.WATER], coast[1], 0.3+0.25*landN) : mix(cols[TER.WATER], cols[TER.WATER], 0);
    } else if(hasWater && (t===TER.GRASS||t===TER.DESERT||t===TER.SNOW)){
      const waterN=ts.filter(x=>x===TER.WATER).length;
      col = mix(cols[t]||'#777', coast[0], 0.3+0.28*waterN);
    } else {
      col = mix(cols[t]||'#777', cols[t]||'#777', 0);
    }
    // deterministische Farbvariation (Mikrotextur)
    const jit = t===TER.MOUNT ? 0.88+hash01(a)*0.24 : 0.95+hash01(a)*0.10;
    // Licht aus Höhendifferenz (Licht von Nordwest)
    let l=1 + ((m.hgt[a]-m.hgt[c])*0.62 + (m.hgt[a]-m.hgt[b])*0.34);
    if(t===TER.WATER) l=1+ (l-1)*0.25;
    col=shadeRgb(col, Math.max(0.55,Math.min(1.45,l*jit)));
    g.fillStyle=col;
    g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.lineTo(cx2,cy2); g.closePath();
    g.fill();
    // Lava-Glut
    if(t===TER.LAVA){
      g.fillStyle=`rgba(255,${140+((hash01(a)*70)|0)},40,0.35)`;
      g.beginPath(); g.arc((ax+bx+cx2)/3,(ay+by+cy2)/3, 6+hash01(b)*6, 0, 7); g.fill();
    }
  }

  // ---------- Sprite-Werkzeuge ----------
  sprite(key, w, h, draw){
    let s=this.sprites.get(key);
    if(s) return s;
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    const g=cv.getContext('2d');
    g.lineJoin='round'; g.lineCap='round';
    draw(g, w, h);
    this.sprites.set(key,cv);
    return cv;
  }
  shadow(g,x,y,rx,ry,a=0.26){
    g.fillStyle=`rgba(12,18,10,${a})`;
    g.beginPath(); g.ellipse(x,y,rx,ry,0,0,7); g.fill();
  }

  // ================= Gebäude-Sprites =================
  bldSprite(type, player, state){
    const key=`b_${type}_${player}_${state}`;
    const def=BLD[type];
    const big=def.size==='L'||type==='hq', med=def.size==='M';
    const W=big?96:med?80:64, H=big?92:med?78:64;
    return this.sprite(key, W, H, (g)=>{
      const pc=PLAYER_COLORS[player]||'#888', pcd=PLAYER_COLORS_DARK[player]||'#555';
      g.translate(0.5,0.5);
      // ---- gemeinsame Zeichen-Helfer ----
      const wallGrad=(x,y,w,h,light='#ecdfc2',dark='#c8b58c')=>{
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,light); gr.addColorStop(1,dark);
        g.fillStyle=gr; g.fillRect(x,y,w,h);
        g.strokeStyle=OUT; g.lineWidth=1.6; g.strokeRect(x,y,w,h);
      };
      const stoneGrad=(x,y,w,h)=>{
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,'#c2bdb2'); gr.addColorStop(1,'#948e82');
        g.fillStyle=gr; g.fillRect(x,y,w,h);
        g.strokeStyle=OUT; g.lineWidth=1.6; g.strokeRect(x,y,w,h);
        // Fugen
        g.strokeStyle='rgba(60,50,40,0.18)'; g.lineWidth=1;
        for(let yy=y+5;yy<y+h-2;yy+=6){ g.beginPath(); g.moveTo(x+1,yy); g.lineTo(x+w-1,yy); g.stroke(); }
      };
      const timber=(x,y,w,h)=>{
        g.strokeStyle='rgba(122,91,53,0.7)'; g.lineWidth=2.4;
        g.strokeRect(x+1,y+1,w-2,h-2);
        g.beginPath();
        g.moveTo(x+w*0.33,y); g.lineTo(x+w*0.33,y+h);
        g.moveTo(x+w*0.66,y); g.lineTo(x+w*0.66,y+h);
        g.stroke();
        g.lineWidth=1.8;
        g.beginPath(); g.moveTo(x,y+h); g.lineTo(x+w*0.33,y); g.moveTo(x+w*0.66,y+h); g.lineTo(x+w,y); g.stroke();
      };
      const roofGable=(x,y,w,rh,color,over=5)=>{
        const gr=g.createLinearGradient(0,y-rh,0,y);
        gr.addColorStop(0,shade(color,1.25)); gr.addColorStop(1,shade(color,0.82));
        g.fillStyle=gr;
        g.beginPath(); g.moveTo(x-over,y); g.lineTo(x+w/2,y-rh); g.lineTo(x+w+over,y); g.closePath(); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.8; g.stroke();
        g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=1.4;
        g.beginPath(); g.moveTo(x-over+2,y-1.5); g.lineTo(x+w/2,y-rh+1.5); g.stroke();
      };
      const window_=(x,y,w=7,h=9,lit=true)=>{
        g.fillStyle=lit?'#f4c96a':'#3c3327';
        g.fillRect(x,y,w,h);
        g.strokeStyle='#5d452a'; g.lineWidth=1.4; g.strokeRect(x,y,w,h);
        g.beginPath(); g.moveTo(x,y+h/2); g.lineTo(x+w,y+h/2); g.stroke();
        if(lit){ g.fillStyle='rgba(255,220,140,0.25)'; g.fillRect(x-1.5,y-1.5,w+3,h+3); }
      };
      const door=(x,y,w=9,h=13)=>{
        g.fillStyle='#3a2417';
        g.beginPath();
        g.moveTo(x,y+h); g.lineTo(x,y+w*0.4); g.quadraticCurveTo(x+w/2,y-3,x+w,y+w*0.4); g.lineTo(x+w,y+h);
        g.closePath(); g.fill();
        g.strokeStyle='#5d452a'; g.lineWidth=1.5; g.stroke();
      };
      const banner=(x,y,len=16)=>{
        g.strokeStyle='#4a3520'; g.lineWidth=2.2;
        g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+len); g.stroke();
        g.fillStyle='#4a3520'; g.beginPath(); g.arc(x,y-1,1.6,0,7); g.fill();
        g.fillStyle=pc;
        g.beginPath(); g.moveTo(x,y); g.lineTo(x+11,y+3.5); g.lineTo(x,y+7); g.closePath(); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1; g.stroke();
      };
      const logPile=(x,y,n=3)=>{
        for(let k=0;k<n;k++){
          const lx=x+(k%2)*3, ly=y-Math.floor(k/2)*5;
          g.fillStyle='#8a5f33'; g.beginPath(); g.ellipse(lx,ly,7.5,3.6,0,0,7); g.fill();
          g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke();
          g.fillStyle='#c9a05a'; g.beginPath(); g.ellipse(lx-4.6,ly,2.4,3.2,0,0,7); g.fill();
        }
      };
      const crate=(x,y,s=8)=>{
        g.fillStyle='#a97e46'; g.fillRect(x,y,s,s);
        g.strokeStyle=OUT; g.lineWidth=1.3; g.strokeRect(x,y,s,s);
        g.strokeStyle='rgba(70,48,24,0.6)'; g.lineWidth=1;
        g.beginPath(); g.moveTo(x,y); g.lineTo(x+s,y+s); g.moveTo(x+s,y); g.lineTo(x,y+s); g.stroke();
      };
      const barrel=(x,y)=>{
        g.fillStyle='#8a5f33';
        g.beginPath(); g.ellipse(x,y,5.5,7,0,0,7); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
        g.strokeStyle='#c9a05a'; g.lineWidth=1.6;
        g.beginPath(); g.moveTo(x-5.2,y-2.4); g.lineTo(x+5.2,y-2.4); g.moveTo(x-5.2,y+2.4); g.lineTo(x+5.2,y+2.4); g.stroke();
      };
      const chimney=(x,y,h=14)=>{
        g.fillStyle='#6f6a63'; g.fillRect(x,y-h,7,h);
        g.strokeStyle=OUT; g.lineWidth=1.4; g.strokeRect(x,y-h,7,h);
        g.fillStyle='#4a4640'; g.fillRect(x-1.5,y-h-3,10,4);
      };

      // ================= Baustelle =================
      if(state==='build'){
        g.strokeStyle='#8a6b43'; g.lineWidth=3;
        stoneGrad(W*0.24,H*0.62,W*0.52,H*0.24);
        g.strokeStyle='#9a7a4c'; g.lineWidth=2.6;
        for(const sx of [W*0.2,W*0.5,W*0.8]){
          g.beginPath(); g.moveTo(sx,H*0.9); g.lineTo(sx,H*0.36); g.stroke();
        }
        g.beginPath(); g.moveTo(W*0.14,H*0.4); g.lineTo(W*0.86,H*0.4); g.stroke();
        g.beginPath(); g.moveTo(W*0.2,H*0.66); g.lineTo(W*0.8,H*0.42); g.stroke();
        logPile(W*0.22,H*0.86,3);
        g.fillStyle='#9a958c';
        g.beginPath(); g.arc(W*0.74,H*0.86,4.5,0,7); g.arc(W*0.82,H*0.88,3.6,0,7); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke();
        return;
      }

      const roofC = def.mil? '#7a8592' : (def.mine? '#6b625a' : pc);

      switch(def.size){
        case 'MINE': {
          // Stollenportal im Fels
          const gr=g.createLinearGradient(0,H*0.25,0,H*0.9);
          gr.addColorStop(0,'#6f675d'); gr.addColorStop(1,'#4e463d');
          g.fillStyle=gr;
          g.beginPath(); g.moveTo(W*0.08,H*0.9); g.lineTo(W*0.5,H*0.22); g.lineTo(W*0.92,H*0.9); g.closePath(); g.fill();
          g.strokeStyle=OUT; g.lineWidth=1.8; g.stroke();
          g.fillStyle='rgba(255,255,255,0.12)';
          g.beginPath(); g.moveTo(W*0.5,H*0.22); g.lineTo(W*0.3,H*0.9); g.lineTo(W*0.08,H*0.9); g.closePath(); g.fill();
          // Stollenmund + Balkenrahmen
          g.fillStyle='#1c1712';
          g.beginPath(); g.moveTo(W*0.34,H*0.9); g.lineTo(W*0.34,H*0.6); g.quadraticCurveTo(W*0.5,H*0.46,W*0.66,H*0.6); g.lineTo(W*0.66,H*0.9); g.closePath(); g.fill();
          g.strokeStyle='#8a6b43'; g.lineWidth=4;
          g.beginPath(); g.moveTo(W*0.32,H*0.9); g.lineTo(W*0.32,H*0.58); g.moveTo(W*0.68,H*0.9); g.lineTo(W*0.68,H*0.58); g.moveTo(W*0.28,H*0.58); g.lineTo(W*0.72,H*0.58); g.stroke();
          // Laterne
          g.fillStyle='rgba(255,200,110,0.85)'; g.beginPath(); g.arc(W*0.5,H*0.64,2.6,0,7); g.fill();
          g.fillStyle='rgba(255,200,110,0.2)'; g.beginPath(); g.arc(W*0.5,H*0.64,6,0,7); g.fill();
          // Lore
          g.fillStyle='#5d452a'; g.fillRect(W*0.72,H*0.8,13,7);
          g.strokeStyle=OUT; g.lineWidth=1.2; g.strokeRect(W*0.72,H*0.8,13,7);
          g.fillStyle='#2e2e2e';
          g.beginPath(); g.arc(W*0.75,H*0.9,2.4,0,7); g.arc(W*0.82,H*0.9,2.4,0,7); g.fill();
          banner(W*0.5,H*0.1,12);
          break;
        }
        case 'L': {
          if(type==='hq' || type==='fortress'){
            // Burg: Bergfried + Mauer + Ecktürme
            stoneGrad(W*0.15,H*0.44,W*0.7,H*0.44);
            // Zinnen der Mauer
            g.fillStyle='#b9b4aa';
            for(let k=0;k<6;k++) g.fillRect(W*0.17+k*W*0.115,H*0.4,W*0.07,7);
            // Bergfried
            stoneGrad(W*0.36,H*0.2,W*0.28,H*0.4);
            g.fillStyle='#b9b4aa';
            for(let k=0;k<3;k++) g.fillRect(W*0.37+k*W*0.09,H*0.15,W*0.06,7);
            window_(W*0.45,H*0.28,7,9,true);
            // Ecktürme mit Kegeldach
            for(const tx of [W*0.1, W*0.78]){
              stoneGrad(tx,H*0.34,W*0.13,H*0.54);
              g.fillStyle=pcd;
              g.beginPath(); g.moveTo(tx-3,H*0.35); g.lineTo(tx+W*0.065,H*0.14); g.lineTo(tx+W*0.13+3,H*0.35); g.closePath(); g.fill();
              g.strokeStyle=OUT; g.lineWidth=1.5; g.stroke();
              window_(tx+W*0.035,H*0.48,6,7,true);
            }
            // Tor
            door(W*0.44,H*0.68,W*0.12,H*0.2);
            g.strokeStyle='#7a6a52'; g.lineWidth=1.4;
            g.beginPath(); g.moveTo(W*0.44,H*0.74); g.lineTo(W*0.56,H*0.74); g.stroke();
            banner(W*0.5,H*0.04,16);
            break;
          }
          if(type==='farm'||type==='pigfarm'){
            // Haupthaus + Scheune + Zaun
            wallGrad(W*0.08,H*0.5,W*0.42,H*0.34);
            timber(W*0.08,H*0.5,W*0.42,H*0.34);
            roofGable(W*0.08,H*0.5,W*0.42,H*0.24,pc);
            window_(W*0.16,H*0.58); door(W*0.32,H*0.68,9,15);
            // Scheune
            wallGrad(W*0.56,H*0.58,W*0.34,H*0.28,'#d8b98a','#b08d5c');
            roofGable(W*0.56,H*0.58,W*0.34,H*0.18,'#8a6b43');
            g.fillStyle='#5d452a'; g.fillRect(W*0.66,H*0.68,W*0.14,H*0.18);
            g.strokeStyle='#3a2d20'; g.lineWidth=1.4;
            g.strokeRect(W*0.66,H*0.68,W*0.14,H*0.18);
            g.beginPath(); g.moveTo(W*0.66,H*0.68); g.lineTo(W*0.8,H*0.86); g.moveTo(W*0.8,H*0.68); g.lineTo(W*0.66,H*0.86); g.stroke();
            // Zaun
            g.strokeStyle='#8a6b43'; g.lineWidth=2;
            g.beginPath(); g.moveTo(W*0.05,H*0.93); g.lineTo(W*0.95,H*0.93); g.stroke();
            for(let k=0;k<8;k++){ g.beginPath(); g.moveTo(W*0.08+k*W*0.12,H*0.89); g.lineTo(W*0.08+k*W*0.12,H*0.97); g.stroke(); }
            if(type==='pigfarm'){
              g.fillStyle='#e3a2a2';
              g.beginPath(); g.ellipse(W*0.5,H*0.9,6,4,0,0,7); g.fill();
              g.fillStyle='#d98f8f'; g.beginPath(); g.arc(W*0.56,H*0.89,2,0,7); g.fill();
            }
            break;
          }
          // generisches großes Gebäude (Lagerhaus)
          wallGrad(W*0.12,H*0.44,W*0.76,H*0.42);
          timber(W*0.12,H*0.44,W*0.76,H*0.42);
          roofGable(W*0.12,H*0.44,W*0.76,H*0.28,pc);
          window_(W*0.2,H*0.54); window_(W*0.66,H*0.54);
          door(W*0.44,H*0.66,11,17);
          crate(W*0.16,H*0.76,9); crate(W*0.26,H*0.79,7); barrel(W*0.82,H*0.8);
          banner(W*0.5,H*0.1,13);
          break;
        }
        case 'M': {
          if(type==='mill'){
            // Turmwindmühle mit Galerie
            g.fillStyle='#d5c5a2';
            g.beginPath(); g.moveTo(W*0.34,H*0.9); g.lineTo(W*0.41,H*0.3); g.lineTo(W*0.59,H*0.3); g.lineTo(W*0.66,H*0.9); g.closePath(); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.8; g.stroke();
            g.fillStyle='rgba(255,255,255,0.25)';
            g.beginPath(); g.moveTo(W*0.41,H*0.3); g.lineTo(W*0.45,H*0.9); g.lineTo(W*0.34,H*0.9); g.closePath(); g.fill();
            // Galerie
            g.strokeStyle='#8a6b43'; g.lineWidth=2;
            g.beginPath(); g.moveTo(W*0.3,H*0.66); g.lineTo(W*0.7,H*0.66); g.stroke();
            for(let k=0;k<5;k++){ g.beginPath(); g.moveTo(W*0.32+k*W*0.09,H*0.66); g.lineTo(W*0.34+k*W*0.08,H*0.74); g.stroke(); }
            // Kappe
            g.fillStyle=pcd;
            g.beginPath(); g.moveTo(W*0.38,H*0.3); g.quadraticCurveTo(W*0.5,H*0.16,W*0.62,H*0.3); g.closePath(); g.fill();
            g.strokeStyle=OUT; g.stroke();
            window_(W*0.46,H*0.48,7,9); door(W*0.45,H*0.76,9,14);
            // Flügel mit Gitterwerk
            g.strokeStyle='#5d452a'; g.lineWidth=2.6;
            for(let k=0;k<4;k++){
              const a=k*Math.PI/2+0.5;
              const ex=W*0.5+Math.cos(a)*W*0.34, ey=H*0.26+Math.sin(a)*W*0.34;
              g.beginPath(); g.moveTo(W*0.5,H*0.26); g.lineTo(ex,ey); g.stroke();
              // Segelfläche
              g.save();
              g.translate(W*0.5,H*0.26); g.rotate(a);
              g.fillStyle='rgba(238,228,200,0.9)';
              g.fillRect(4,-5.2,W*0.3,6);
              g.strokeStyle='#8a6b43'; g.lineWidth=1;
              g.strokeRect(4,-5.2,W*0.3,6);
              for(let s2=0;s2<3;s2++){ g.beginPath(); g.moveTo(6+s2*8,-5.2); g.lineTo(6+s2*8,0.8); g.stroke(); }
              g.restore();
            }
            g.fillStyle='#4a3520'; g.beginPath(); g.arc(W*0.5,H*0.26,3.4,0,7); g.fill();
            break;
          }
          if(type==='watchtower'){
            stoneGrad(W*0.3,H*0.24,W*0.4,H*0.64);
            // Kragsteine + Zinnen
            g.fillStyle='#9a958c'; g.fillRect(W*0.25,H*0.24,W*0.5,7);
            g.strokeStyle=OUT; g.lineWidth=1.4; g.strokeRect(W*0.25,H*0.24,W*0.5,7);
            g.fillStyle='#b9b4aa';
            for(let k=0;k<4;k++) g.fillRect(W*0.26+k*W*0.125,H*0.15,W*0.075,8);
            window_(W*0.44,H*0.36,7,8,true);
            g.fillStyle='#22303e';
            g.fillRect(W*0.42,H*0.52,W*0.16,4); // Schießscharte
            door(W*0.43,H*0.72,10,15);
            banner(W*0.5,H*0.02,14);
            break;
          }
          if(type==='catapult'){
            // Plattform
            g.fillStyle='#7a5b35'; g.fillRect(W*0.14,H*0.72,W*0.72,H*0.1);
            g.strokeStyle=OUT; g.lineWidth=1.6; g.strokeRect(W*0.14,H*0.72,W*0.72,H*0.1);
            // Räder
            for(const wx of [W*0.24,W*0.76]){
              g.fillStyle='#5d452a'; g.beginPath(); g.arc(wx,H*0.85,7,0,7); g.fill();
              g.strokeStyle=OUT; g.lineWidth=1.6; g.stroke();
              g.strokeStyle='#3a2d20'; g.lineWidth=1.4;
              g.beginPath(); g.moveTo(wx-6,H*0.85); g.lineTo(wx+6,H*0.85); g.moveTo(wx,H*0.85-6); g.lineTo(wx,H*0.85+6); g.stroke();
            }
            // Rahmen + Wurfarm
            g.strokeStyle='#6d4f2e'; g.lineWidth=4.4;
            g.beginPath(); g.moveTo(W*0.3,H*0.74); g.lineTo(W*0.5,H*0.5); g.lineTo(W*0.7,H*0.74); g.stroke();
            g.strokeStyle='#5d452a'; g.lineWidth=5;
            g.beginPath(); g.moveTo(W*0.34,H*0.72); g.lineTo(W*0.66,H*0.28); g.stroke();
            g.fillStyle='#4a4a4a'; g.beginPath(); g.arc(W*0.68,H*0.26,5.4,0,7); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
            // Steinstapel
            g.fillStyle='#9a958c';
            g.beginPath(); g.arc(W*0.16,H*0.66,4,0,7); g.arc(W*0.22,H*0.68,3.4,0,7); g.fill();
            banner(W*0.86,H*0.4,12);
            break;
          }
          // generisches mittleres Haus
          wallGrad(W*0.14,H*0.46,W*0.6,H*0.4);
          timber(W*0.14,H*0.46,W*0.6,H*0.4);
          roofGable(W*0.14,H*0.46,W*0.6,H*0.26,roofC);
          window_(W*0.2,H*0.56); door(W*0.36,H*0.68,10,15);
          if(type==='smelter'||type==='mint'||type==='armory'||type==='bakery'){
            chimney(W*0.72,H*0.44,16);
            if(type==='smelter'){
              g.fillStyle='rgba(255,120,40,0.8)'; g.fillRect(W*0.2,H*0.79,8,6);
              g.fillStyle='rgba(255,160,60,0.3)'; g.fillRect(W*0.18,H*0.76,12,10);
            }
          }
          // Zunftzeichen
          const sign=(draw)=>{ g.save(); g.translate(W*0.62,H*0.56); draw(); g.restore(); };
          if(type==='sawmill'){ logPile(W*0.84,H*0.84,3);
            sign(()=>{ g.fillStyle='#c9c9c9'; g.beginPath(); g.arc(0,0,5,0,7); g.fill();
              g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke();
              g.fillStyle='#8a8a8a'; g.beginPath(); g.arc(0,0,1.8,0,7); g.fill(); }); }
          if(type==='bakery') sign(()=>{ g.strokeStyle='#e8b93c'; g.lineWidth=2.6;
            g.beginPath(); g.arc(0,0,4.4,0.6,5.8); g.stroke(); });
          if(type==='brewery'){ barrel(W*0.82,H*0.8); sign(()=>{ g.fillStyle='#c78f3f';
            g.beginPath(); g.arc(0,0,4.4,0,7); g.fill(); g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke(); }); }
          if(type==='butcher') sign(()=>{ g.fillStyle='#c26a5a';
            g.beginPath(); g.ellipse(0,0,4.6,3.4,0.5,0,7); g.fill(); g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke(); });
          if(type==='mint') sign(()=>{ g.fillStyle='#ffd54a'; g.beginPath(); g.arc(0,0,4.6,0,7); g.fill();
            g.strokeStyle='#a8802a'; g.lineWidth=1.4; g.stroke();
            g.strokeStyle='#a8802a'; g.beginPath(); g.arc(0,0,2.4,0,7); g.stroke(); });
          if(type==='armory') sign(()=>{ g.fillStyle='#4a4a52';
            g.fillRect(-5,-1,10,3.6); g.fillRect(-2,-4,4,4);
            g.strokeStyle=OUT; g.lineWidth=1; g.strokeRect(-5,-1,10,3.6); });
          if(type==='smelter') sign(()=>{ g.fillStyle='#ff8c46';
            g.beginPath(); g.moveTo(0,-4.5); g.quadraticCurveTo(4.4,0,0,4.8); g.quadraticCurveTo(-4.4,0,0,-4.5); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1; g.stroke(); });
          break;
        }
        default: { // S
          if(type==='barracks'||type==='guardhouse'){
            stoneGrad(W*0.2,H*0.42,W*0.6,H*0.46);
            g.fillStyle='#b9b4aa';
            for(let k=0;k<4;k++) g.fillRect(W*0.21+k*W*0.15,H*0.34,W*0.09,8);
            g.fillStyle='#22303e'; g.fillRect(W*0.28,H*0.52,W*0.1,4); g.fillRect(W*0.6,H*0.52,W*0.1,4);
            door(W*0.42,H*0.68,11,15);
            banner(W*0.5,H*0.1,14);
            if(type==='guardhouse'){ window_(W*0.28,H*0.6,7,8,true); }
            break;
          }
          if(type==='well'){
            // Steinring mit Textur
            stoneGrad(W*0.28,H*0.6,W*0.44,H*0.22);
            g.fillStyle='#1d3245';
            g.beginPath(); g.ellipse(W*0.5,H*0.62,W*0.17,4,0,0,7); g.fill();
            // Pfosten + Dach + Winde
            g.strokeStyle='#7a5b35'; g.lineWidth=3.4;
            g.beginPath(); g.moveTo(W*0.28,H*0.6); g.lineTo(W*0.28,H*0.3); g.moveTo(W*0.72,H*0.6); g.lineTo(W*0.72,H*0.3); g.stroke();
            roofGable(W*0.24,H*0.3,W*0.52,H*0.16,pcd,3);
            g.strokeStyle='#5d452a'; g.lineWidth=2.4;
            g.beginPath(); g.moveTo(W*0.28,H*0.44); g.lineTo(W*0.72,H*0.44); g.stroke();
            g.strokeStyle='#3a2d20'; g.lineWidth=1.4;
            g.beginPath(); g.moveTo(W*0.5,H*0.44); g.lineTo(W*0.5,H*0.58); g.stroke();
            g.fillStyle='#8a5f33'; g.fillRect(W*0.46,H*0.56,W*0.08,5);
            g.strokeStyle=OUT; g.lineWidth=1; g.strokeRect(W*0.46,H*0.56,W*0.08,5);
            break;
          }
          // generisches kleines Haus
          wallGrad(W*0.18,H*0.5,W*0.62,H*0.36);
          timber(W*0.18,H*0.5,W*0.62,H*0.36);
          roofGable(W*0.18,H*0.5,W*0.62,H*0.24,roofC);
          window_(W*0.26,H*0.58,7,8); door(W*0.52,H*0.68,9,14);
          if(type==='woodcutter'){ logPile(W*0.14,H*0.86,3);
            // Axt im Block
            g.fillStyle='#6d4f2e'; g.fillRect(W*0.82,H*0.8,7,7);
            g.strokeStyle='#9a9a9a'; g.lineWidth=2.4;
            g.beginPath(); g.moveTo(W*0.85,H*0.8); g.lineTo(W*0.9,H*0.7); g.stroke(); }
          if(type==='forester'){
            g.fillStyle='#3f7d35';
            g.beginPath(); g.moveTo(W*0.88,H*0.86); g.lineTo(W*0.94,H*0.72); g.lineTo(W*0.99,H*0.86); g.closePath(); g.fill();
            g.fillStyle='#6b4a2c'; g.fillRect(W*0.925,H*0.86,2.4,4); }
          if(type==='quarry'){
            g.fillStyle='#9a958c';
            g.beginPath(); g.arc(W*0.12,H*0.84,4.6,0,7); g.arc(W*0.2,H*0.87,3.6,0,7); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke(); }
          if(type==='fisher'){
            g.strokeStyle='#5d452a'; g.lineWidth=2;
            g.beginPath(); g.moveTo(W*0.88,H*0.86); g.lineTo(W*0.97,H*0.6); g.stroke();
            g.strokeStyle='#a9c7d9'; g.lineWidth=1.2;
            g.beginPath(); g.moveTo(W*0.97,H*0.6); g.lineTo(W*0.94,H*0.76); g.stroke();
            g.fillStyle='#6fa7c7';
            g.beginPath(); g.ellipse(W*0.93,H*0.78,3.4,1.8,0.4,0,7); g.fill(); }
          if(type==='hunter'){
            g.strokeStyle='#6d4f2e'; g.lineWidth=2;
            g.beginPath(); g.moveTo(W*0.9,H*0.84); g.lineTo(W*0.86,H*0.72); g.moveTo(W*0.9,H*0.84); g.lineTo(W*0.95,H*0.72); g.stroke();
            g.beginPath(); g.moveTo(W*0.86,H*0.72); g.lineTo(W*0.83,H*0.66); g.moveTo(W*0.95,H*0.72); g.lineTo(W*0.98,H*0.66); g.stroke(); }
        }
      }
    });
  }

  // ================= Bäume & Objekte =================
  treeSprite(stage, theme, species){
    return this.sprite(`t_${stage}_${theme}_${species}`, 48, 62, (g,W,H)=>{
      const winter=theme==='winter';
      const s= stage===1? 0.45 : stage===2? 0.72 : 1;
      g.translate(W/2, H-2);
      // Stamm
      g.fillStyle='#6b4a2c';
      g.beginPath();
      g.moveTo(-3.4*s,0); g.quadraticCurveTo(-1.6*s,-10*s,-1.8*s,-18*s);
      g.lineTo(1.8*s,-18*s); g.quadraticCurveTo(1.6*s,-10*s,3.4*s,0);
      g.closePath(); g.fill();
      g.strokeStyle='rgba(40,25,12,0.5)'; g.lineWidth=1; g.stroke();
      if(species===0){
        // Nadelbaum: 3 Lagen mit dunkler Unterkante
        const leaf= winter? '#487052' : '#3f7d35';
        const leafD= winter? '#3a5c44' : '#2f6128';
        const layer=(y,w2,h2)=>{
          g.fillStyle=leafD;
          g.beginPath(); g.moveTo(0,y-h2); g.lineTo(w2,y+2); g.lineTo(-w2,y+2); g.closePath(); g.fill();
          g.fillStyle=leaf;
          g.beginPath(); g.moveTo(0,y-h2); g.lineTo(w2-1.6,y); g.lineTo(-(w2-1.6),y); g.closePath(); g.fill();
          g.strokeStyle='rgba(25,45,20,0.45)'; g.lineWidth=1; g.stroke();
        };
        layer(-14*s, 17*s, 16*s);
        layer(-26*s, 13.5*s, 15*s);
        layer(-37*s, 10*s, 14*s);
        if(winter){
          g.fillStyle='rgba(240,246,252,0.9)';
          g.beginPath(); g.moveTo(0,-51*s); g.lineTo(6.5*s,-38*s); g.lineTo(-6.5*s,-38*s); g.closePath(); g.fill();
          g.beginPath(); g.ellipse(0,-26*s,10*s,3*s,0,0,7); g.fill();
        }
        // Lichtkante
        g.strokeStyle='rgba(255,255,255,0.25)'; g.lineWidth=1.2;
        g.beginPath(); g.moveTo(0,-51*s); g.lineTo(-8*s,-30*s); g.stroke();
      } else {
        // Laubbaum: Krone aus Kreisen
        const leaf= winter? '#7d9a6d' : '#4e8a3d';
        const leafD= winter? '#5d7852' : '#3a6b2e';
        const leafL= winter? '#9ab48c' : '#68a552';
        g.fillStyle=leafD;
        g.beginPath();
        g.arc(-8*s,-26*s,10*s,0,7); g.arc(8*s,-26*s,10*s,0,7); g.arc(0,-36*s,11*s,0,7);
        g.fill();
        g.fillStyle=leaf;
        g.beginPath();
        g.arc(-7*s,-28*s,8.6*s,0,7); g.arc(7.5*s,-27*s,8.4*s,0,7); g.arc(0,-37*s,9.6*s,0,7);
        g.fill();
        g.fillStyle=leafL;
        g.beginPath(); g.arc(-3*s,-40*s,5*s,0,7); g.arc(-10*s,-30*s,4*s,0,7); g.fill();
        g.strokeStyle='rgba(25,45,20,0.35)'; g.lineWidth=1.2;
        g.beginPath(); g.arc(0,-31*s,14.4*s,0,7); g.stroke();
      }
    });
  }

  // ================= Hauptzeichnung =================
  draw(cam, ui, dtMs){
    const g=this.ctx, game=this.game, m=game.map;
    this.time+=dtMs;
    g.setTransform(this.dpr,0,0,this.dpr,0,0);
    // Hintergrund: Tiefwasser mit leichtem Verlauf
    const cols=TER_COL[this.theme]||TER_COL.gruen;
    const bg=g.createLinearGradient(0,0,0,this.vh);
    bg.addColorStop(0, shade(cols[TER.WATER],1.12));
    bg.addColorStop(1, shade(cols[TER.WATER],0.8));
    g.fillStyle=bg;
    g.fillRect(0,0,this.vw,this.vh);
    // Kamera
    g.save();
    g.translate(this.vw/2, this.vh/2);
    g.scale(cam.z, cam.z);
    g.translate(-cam.x, -cam.y);
    g.lineJoin='round'; g.lineCap='round';
    if(game.changedNodes.length){
      for(const i of game.changedNodes) this.markDirtyNode(i);
      game.changedNodes.length=0;
    }
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
    const x0=Math.max(0,Math.floor(wx0/TILE)-1), x1=Math.min(m.w-1,Math.ceil(wx1/TILE)+1);
    const y0=Math.max(0,Math.floor(wy0/ROWH)-1), y1=Math.min(m.h-1,Math.ceil(wy1/ROWH)+2);
    // Wasser-Glitzern (animiert, deterministisch pro Knoten)
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=m.idx(x,y);
      if(m.terr[i]!==TER.WATER || !m.explored[i]) continue;
      const hsh=hash01(i);
      if(hsh>0.3) continue;
      const [px,py]=m.worldPos(i);
      const ph=this.time/900 + hsh*6.28;
      const a=0.10+0.12*Math.sin(ph);
      if(a<=0.02) continue;
      g.strokeStyle=`rgba(230,245,255,${a})`;
      g.lineWidth=1.6;
      const ox=Math.sin(ph*0.7)*6;
      g.beginPath(); g.moveTo(px-7+ox,py); g.lineTo(px+2+ox,py); g.stroke();
      g.beginPath(); g.moveTo(px+6-ox,py+6); g.lineTo(px+12-ox,py+6); g.stroke();
    }
    // Territorium-Grenzen
    if(this.lastTerritoryVer!==game.territoryVer){ this.computeBorders(); this.lastTerritoryVer=game.territoryVer; }
    for(const e of this.borderEdges){
      if(e.x2<wx0||e.x1>wx1||e.y2<wy0-60||e.y1>wy1+60) continue;
      g.strokeStyle='rgba(20,26,18,0.35)'; g.lineWidth=4;
      g.beginPath(); g.moveTo(e.x1,e.y1); g.lineTo(e.x2,e.y2); g.stroke();
      g.strokeStyle=PLAYER_COLORS[e.pl]; g.lineWidth=2.2;
      g.beginPath(); g.moveTo(e.x1,e.y1); g.lineTo(e.x2,e.y2); g.stroke();
    }
    // Straßen (3 Lagen: Kontur, Belag, Mittelnaht)
    for(const r of game.roads.values()){
      const trace=()=>{ g.beginPath(); r.path.forEach((n,ix)=>{ const [x,y]=m.worldPos(n); if(ix===0) g.moveTo(x,y); else g.lineTo(x,y); }); };
      trace(); g.strokeStyle='rgba(90,72,48,0.85)'; g.lineWidth=8.5; g.stroke();
      trace(); g.strokeStyle='#c4ac83'; g.lineWidth=5.4; g.stroke();
      trace(); g.strokeStyle='rgba(238,222,190,0.5)'; g.lineWidth=1.4; g.setLineDash([5,9]); g.stroke(); g.setLineDash([]);
    }
    // Straßen-Vorschau
    if(ui.roadPreview && ui.roadPreview.length>1){
      g.strokeStyle='rgba(255,244,170,0.95)'; g.lineWidth=4; g.setLineDash([8,7]);
      g.lineDashOffset=-this.time/60;
      g.beginPath();
      ui.roadPreview.forEach((n,ix)=>{ const [x,y]=m.worldPos(n); if(ix===0) g.moveTo(x,y); else g.lineTo(x,y); });
      g.stroke(); g.setLineDash([]); g.lineDashOffset=0;
    }
    // Objekte + Gebäude + Fahnen + Einheiten sammeln, nach y sortieren
    const items=[];
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=m.idx(x,y);
      const o=m.obj[i]&127;
      if(o!==OBJ.NONE) items.push({kind:'obj', i, o, y:m.worldPos(i)[1]});
      if(m.bld[i]>=0){ const b=game.buildings.get(m.bld[i]); if(b) items.push({kind:'bld', b, y:m.worldPos(i)[1]}); }
      if(m.flag[i]) items.push({kind:'flag', i, y:m.worldPos(i)[1]+2});
    }
    for(const r of game.roads.values()){
      const c=r.carrier;
      const pos=this.roadPos(r, c.pos);
      items.push({kind:'carrier', pl:r.player, x:pos[0], y:pos[1], carrying:!!c.item, good:c.item?.good});
    }
    for(const u of game.units) items.push({kind:'unit', u, y:u.y});
    items.sort((a,b)=>a.y-b.y);
    for(const it of items){
      if(it.kind==='obj') this.drawObj(g, m, it.i, it.o);
      else if(it.kind==='bld') this.drawBld(g, m, it.b);
      else if(it.kind==='flag') this.drawFlag(g, m, game, it.i);
      else if(it.kind==='carrier') this.drawFigure(g, it.x, it.y, it.pl, it.carrying? it.good:null, 'carrier');
      else if(it.kind==='unit') this.drawUnit(g, it.u);
    }
    // Auswahl-Marker
    if(ui.sel>=0){
      const [x,y]=m.worldPos(ui.sel);
      const r=15+Math.sin(this.time/180)*2;
      g.strokeStyle='rgba(20,26,18,0.5)'; g.lineWidth=4;
      g.beginPath(); g.arc(x,y,r,0,7); g.stroke();
      g.strokeStyle='rgba(255,255,255,0.95)'; g.lineWidth=2;
      g.beginPath(); g.arc(x,y,r,0,7); g.stroke();
      g.save();
      g.translate(x,y); g.rotate(this.time/600);
      g.strokeStyle='rgba(255,244,170,0.9)'; g.lineWidth=2.4;
      for(let k=0;k<4;k++){ g.rotate(Math.PI/2); g.beginPath(); g.arc(0,0,r+5,-0.28,0.28); g.stroke(); }
      g.restore();
    }
    // Baubarkeits-Punkte im Baumodus
    if(ui.showBuildDots){
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const i=m.idx(x,y);
        if(m.owner[i]!==0) continue;
        if(m.bld[i]>=0||m.flag[i]||(m.obj[i]&127)!==OBJ.NONE) continue;
        if(!m.terrOkBuild(i)&&!m.terrOkMine(i)) continue;
        const [px,py]=m.worldPos(i);
        const mine=m.terrOkMine(i);
        g.fillStyle='rgba(20,26,18,0.4)';
        g.beginPath(); g.arc(px,py+1,(mine?2.6:3.4),0,7); g.fill();
        g.fillStyle=mine?'rgba(255,190,90,0.85)':'rgba(255,255,255,0.85)';
        g.beginPath(); g.arc(px,py,(mine?2.2:3),0,7); g.fill();
      }
    }
    // Nebel (unerforscht) – ein Pfad, stark überlappende Kreise = weicher Rand ohne Wabenmuster
    g.fillStyle='rgba(9,13,20,0.9)';
    g.beginPath();
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=m.idx(x,y);
      if(m.explored[i]) continue;
      const [px,py]=m.worldPos(i);
      g.moveTo(px+TILE*0.85,py);
      g.arc(px,py,TILE*0.85,0,7);
    }
    g.fill();
    g.restore();
    // Vignette (Bildschirmraum)
    if(this.vignette) g.drawImage(this.vignette,0,0);
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
        const hsh=hash01(i);
        const species=hsh<0.55?0:1;
        const sc=0.85+hash01(i*7+1)*0.3;
        const s=this.treeSprite(st,this.theme,species);
        const w=48*sc, h=62*sc;
        this.shadow(g,x,y+2, 12*sc*(st/3), 4*sc, 0.22);
        g.drawImage(s, x-w/2, y-h+4, w, h);
        break;
      }
      case OBJ.STONE: {
        this.shadow(g,x,y+2,14,4.6,0.22);
        const rock=(rx,ry,rr,c)=>{
          g.fillStyle=c;
          g.beginPath();
          g.moveTo(rx-rr,ry);
          g.lineTo(rx-rr*0.5,ry-rr*0.9);
          g.lineTo(rx+rr*0.55,ry-rr*0.85);
          g.lineTo(rx+rr,ry);
          g.lineTo(rx+rr*0.5,ry+rr*0.5);
          g.lineTo(rx-rr*0.5,ry+rr*0.5);
          g.closePath(); g.fill();
          g.strokeStyle='rgba(50,46,40,0.5)'; g.lineWidth=1.2; g.stroke();
        };
        rock(x-6,y-3,8,'#8b867c');
        rock(x+5,y-1,9.5,'#9a958b');
        rock(x-1,y-10,6,'#a5a096');
        g.fillStyle='rgba(255,255,255,0.25)';
        g.beginPath(); g.moveTo(x+1,y-8); g.lineTo(x+6,y-9); g.lineTo(x+9,y-4); g.closePath(); g.fill();
        break;
      }
      case OBJ.FIELD0: case OBJ.FIELD1: case OBJ.FIELD2: {
        // Ackerfläche
        g.fillStyle='rgba(122,95,61,0.55)';
        g.beginPath(); g.ellipse(x,y,19,10,0,0,7); g.fill();
        g.strokeStyle='rgba(90,66,40,0.35)'; g.lineWidth=1; g.stroke();
        const hgt=o===OBJ.FIELD0?3.5:o===OBJ.FIELD1?7:11;
        const ripe=o===OBJ.FIELD2;
        g.strokeStyle=ripe?'#dfbc4f':'#8fbe58';
        g.lineWidth=1.8;
        for(let k=-2;k<=2;k++){
          for(const dy of [-3.4,2.6]){
            g.beginPath(); g.moveTo(x+k*6.4, y+dy+3); g.lineTo(x+k*6.4, y+dy+3-hgt); g.stroke();
            if(ripe){ g.fillStyle='#e8ce6a'; g.beginPath(); g.arc(x+k*6.4,y+dy+3-hgt,1.7,0,7); g.fill(); }
          }
        }
        break;
      }
      case OBJ.GATE: {
        this.shadow(g,x,y+3,22,6,0.3);
        const pil=(px)=>{
          const gr=g.createLinearGradient(px-5,0,px+5,0);
          gr.addColorStop(0,'#9a958c'); gr.addColorStop(0.5,'#c2bdb2'); gr.addColorStop(1,'#7d786e');
          g.fillStyle=gr; g.fillRect(px-5,y-40,10,40);
          g.strokeStyle=OUT; g.lineWidth=1.5; g.strokeRect(px-5,y-40,10,40);
        };
        pil(x-14); pil(x+14);
        g.fillStyle='#b5b0a6'; g.fillRect(x-22,y-47,44,9);
        g.strokeStyle=OUT; g.lineWidth=1.5; g.strokeRect(x-22,y-47,44,9);
        // Portal-Schimmer
        const pulse=0.4+0.2*Math.sin(this.time/400);
        const gr=g.createLinearGradient(0,y-38,0,y);
        gr.addColorStop(0,`rgba(140,220,255,${pulse})`);
        gr.addColorStop(1,'rgba(140,220,255,0.05)');
        g.fillStyle=gr; g.fillRect(x-9,y-38,18,38);
        g.fillStyle=`rgba(200,240,255,${pulse*0.5})`;
        g.beginPath(); g.ellipse(x,y-19,5,14,0,0,7); g.fill();
        break;
      }
    }
  }
  drawBld(g, m, b){
    const [x,y]=m.worldPos(b.node);
    const s=this.bldSprite(b.type, b.player, b.state==='build'?'build':'done');
    const def=BLD[b.type];
    const big=def.size==='L'||b.type==='hq';
    this.shadow(g,x,y+4, big?34:def.size==='M'?27:21, big?9:7, 0.28);
    g.drawImage(s, x-s.width/2, y-s.height+10);
    if(b.state==='build'){
      const total=80+30*((def.cost.board||0)+(def.cost.stone||0));
      g.fillStyle='rgba(15,20,12,0.55)'; g.fillRect(x-17,y+7,34,6);
      g.fillStyle='#ffd54a'; g.fillRect(x-16,y+8,32*Math.min(1,b.progress/total),4);
      g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=1; g.strokeRect(x-17,y+7,34,6);
    }
    if(b.soldiers && b.state==='done'){
      const n=b.soldiers.length;
      const yy=y-(big?58:def.size==='M'?46:40);
      for(let k=0;k<n;k++){
        g.fillStyle='rgba(15,20,12,0.5)';
        g.beginPath(); g.arc(x-15+k*6.4, yy+1, 3, 0, 7); g.fill();
        g.fillStyle=PLAYER_COLORS[b.player];
        g.beginPath(); g.arc(x-15+k*6.4, yy, 2.6, 0, 7); g.fill();
      }
    }
    // Rauch bei aktiver Produktion
    if(b.state==='done' && (BLD[b.type].prod||BLD[b.type].mine) && (b.prodT>0)){
      for(const off of [0,0.45]){
        const ph=(this.time/800 + b.id*0.7 + off)%1;
        const sway=Math.sin((this.time/600+b.id+off*4))*4;
        g.fillStyle=`rgba(215,215,218,${0.42*(1-ph)})`;
        g.beginPath(); g.arc(x+12+sway*ph, y-44-ph*26, 2.6+ph*5.4, 0, 7); g.fill();
      }
    }
  }
  drawFlag(g, m, game, i){
    const [x,y]=m.worldPos(i);
    const pl=m.owner[i];
    this.shadow(g,x+1,y+1.6,5,2,0.3);
    // Mast
    g.strokeStyle='#3d2c18'; g.lineWidth=2.8;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-19); g.stroke();
    g.strokeStyle='#7a5b35'; g.lineWidth=1.2;
    g.beginPath(); g.moveTo(x-0.6,y-1); g.lineTo(x-0.6,y-18); g.stroke();
    g.fillStyle='#c9a05a'; g.beginPath(); g.arc(x,y-19.6,1.7,0,7); g.fill();
    // wehendes Tuch
    const col=pl>=0?PLAYER_COLORS[pl]:'#999';
    const w1=Math.sin(this.time/260+i)*1.8, w2=Math.sin(this.time/260+i+1.4)*2.4;
    g.fillStyle=col;
    g.beginPath();
    g.moveTo(x,y-19);
    g.quadraticCurveTo(x+6,y-20+w1, x+12,y-17+w2);
    g.lineTo(x+12,y-12.6+w2);
    g.quadraticCurveTo(x+6,y-14.6+w1, x,y-12);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(30,20,10,0.45)'; g.lineWidth=1; g.stroke();
    g.fillStyle='rgba(255,255,255,0.22)';
    g.beginPath();
    g.moveTo(x,y-19); g.quadraticCurveTo(x+6,y-20+w1, x+12,y-17+w2);
    g.lineTo(x+12,y-16+w2); g.quadraticCurveTo(x+6,y-18.6+w1,x,y-17.4);
    g.closePath(); g.fill();
    // wartende Waren als Kistenstapel
    const items=game.flagItems.get(i);
    if(items && items.length){
      for(let k=0;k<Math.min(items.length,8);k++){
        const bx=x-9+(k%4)*5.4, by=y+2+Math.floor(k/4)*5;
        g.fillStyle=goodColor(items[k].good);
        g.fillRect(bx,by,4.4,4.4);
        g.fillStyle='rgba(255,255,255,0.3)'; g.fillRect(bx,by,4.4,1.4);
        g.strokeStyle='rgba(30,20,10,0.5)'; g.lineWidth=0.8; g.strokeRect(bx,by,4.4,4.4);
      }
    }
  }
  drawUnit(g,u){
    if(u.type==='boulder'){
      this.shadow(g,u.x,(u.sy??u.y)+40,6,2.4,0.25);
      g.fillStyle='#57534c';
      g.beginPath(); g.arc(u.x,u.y,5,0,7); g.fill();
      g.fillStyle='rgba(255,255,255,0.25)';
      g.beginPath(); g.arc(u.x-1.6,u.y-1.6,2,0,7); g.fill();
      return;
    }
    if(u.type==='attack'){
      u.soldiers.forEach((r,k)=>{
        this.drawFigure(g, u.x+(k%3)*9-9, u.y+Math.floor(k/3)*6.4, u.player, null, 'soldier', r);
      });
      return;
    }
    if(u.type==='soldierMove'){ this.drawFigure(g,u.x,u.y,u.player,null,'soldier',u.rank); return; }
    this.drawFigure(g, u.x, u.y, u.player, u.carry||null, 'worker');
  }
  drawFigure(g, x, y, pl, good, kind, rank=0){
    const col=PLAYER_COLORS[pl]||'#888';
    const step=Math.sin((this.time/85)+x*0.31);
    const bob=Math.abs(step)*1.1;
    this.shadow(g,x,y+6.6,5,2,0.3);
    y-=bob;
    // Beine
    g.strokeStyle='#2c2620'; g.lineWidth=2.2;
    g.beginPath(); g.moveTo(x-2,y); g.lineTo(x-2+step*1.8,y+6); g.moveTo(x+2,y); g.lineTo(x+2-step*1.8,y+6); g.stroke();
    // Körper
    g.fillStyle= kind==='soldier' ? '#79848f' : '#544738';
    g.beginPath();
    g.moveTo(x-3.8,y+1); g.lineTo(x-3.2,y-8); g.lineTo(x+3.2,y-8); g.lineTo(x+3.8,y+1);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(20,15,10,0.5)'; g.lineWidth=1; g.stroke();
    // Schärpe in Spielerfarbe
    g.fillStyle=col;
    g.fillRect(x-3.4,y-8,6.8,2.8);
    // Kopf
    g.fillStyle='#eac393';
    g.beginPath(); g.arc(x,y-11,3.5,0,7); g.fill();
    g.strokeStyle='rgba(20,15,10,0.35)'; g.lineWidth=0.8; g.stroke();
    if(kind==='soldier'){
      // Helm + Speer + Schild
      g.fillStyle='#b8c2cc';
      g.beginPath(); g.arc(x,y-11.8,3.7,Math.PI,0); g.fill();
      g.fillRect(x-3.7,y-11.8,7.4,1.6);
      g.strokeStyle='rgba(20,15,10,0.4)'; g.lineWidth=0.8;
      g.beginPath(); g.arc(x,y-11.8,3.7,Math.PI,0); g.stroke();
      if(rank>0){
        g.fillStyle=['#c9d2da','#7fd08a','#5aa4e0','#e0a44a','#e05a5a'][Math.min(rank,4)];
        g.beginPath(); g.arc(x,y-16,1.9,0,7); g.fill();
      }
      g.strokeStyle='#6d4f2e'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(x+5.4,y-16); g.lineTo(x+5.4,y+2); g.stroke();
      g.fillStyle='#c9c9c9';
      g.beginPath(); g.moveTo(x+5.4,y-19); g.lineTo(x+7,y-15.6); g.lineTo(x+3.8,y-15.6); g.closePath(); g.fill();
      g.fillStyle=col;
      g.beginPath(); g.ellipse(x-5.4,y-4,2.6,3.6,0,0,7); g.fill();
      g.strokeStyle='rgba(20,15,10,0.5)'; g.lineWidth=1; g.stroke();
    } else {
      // Mütze
      g.fillStyle=shade(col,0.85);
      g.beginPath(); g.arc(x,y-12,3.4,Math.PI*1.05,Math.PI*1.95); g.fill();
    }
    if(good){
      g.fillStyle=goodColor(good);
      g.fillRect(x-3.4,y-20,6.8,5.4);
      g.fillStyle='rgba(255,255,255,0.3)'; g.fillRect(x-3.4,y-20,6.8,1.6);
      g.strokeStyle='rgba(20,15,10,0.5)'; g.lineWidth=0.9; g.strokeRect(x-3.4,y-20,6.8,5.4);
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
      else if((m.obj[i]&127)===OBJ.TREE) c=shade(cols[TER.GRASS],0.72);
      g.fillStyle=c;
      g.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));
    }
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
