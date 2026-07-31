// Neuland – Renderer: komplett prozedural gezeichnete 2D-Grafik (Canvas), poliert.
import { TER, OBJ, BLD, PLAYER_COLORS, PLAYER_COLORS_DARK, RANKS } from './core.js';
import { TILE, ROWH, HSCALE } from './map.js';

// Stilguide-Palette: erdige Töne, Moosgrün, Strohgelb, gedecktes Blau (keine Übersättigung)
const TER_COL = {
  gruen:  { [TER.WATER]:'#4a83a6', [TER.GRASS]:'#7ba55e', [TER.DESERT]:'#d1ba82', [TER.MOUNT]:'#a1988a', [TER.SNOW]:'#eceff3', [TER.SWAMP]:'#5d8560', [TER.LAVA]:'#8d3a1e' },
  winter: { [TER.WATER]:'#547e99', [TER.GRASS]:'#94ac88', [TER.DESERT]:'#cdba86', [TER.MOUNT]:'#949aa4', [TER.SNOW]:'#eceff5', [TER.SWAMP]:'#6d8573', [TER.LAVA]:'#8d3a1e' },
  wueste: { [TER.WATER]:'#4f8dab', [TER.GRASS]:'#a3aa6c', [TER.DESERT]:'#dcc78f', [TER.MOUNT]:'#b09e82', [TER.SNOW]:'#efe9dc', [TER.SWAMP]:'#7d8c60', [TER.LAVA]:'#8d3a1e' },
  vulkan: { [TER.WATER]:'#477693', [TER.GRASS]:'#7e9660', [TER.DESERT]:'#b0946e', [TER.MOUNT]:'#84766c', [TER.SNOW]:'#eceff3', [TER.SWAMP]:'#677852', [TER.LAVA]:'#c65a24' },
  sumpf:  { [TER.WATER]:'#4d7b82', [TER.GRASS]:'#729660', [TER.DESERT]:'#bfae7f', [TER.MOUNT]:'#918e82', [TER.SNOW]:'#eceff3', [TER.SWAMP]:'#5a7a5e', [TER.LAVA]:'#8d3a1e' },
};
TER_COL.inseln=TER_COL.gruen; TER_COL.gebirge=TER_COL.winter;

// Küstenfarben je Thema: [Strand, Flachwasser]
const COAST_COL = {
  gruen:['#d8c896','#6b9cb8'], winter:['#c2c8cd','#6f92a6'], wueste:['#e4d19c','#6ba0bc'],
  vulkan:['#9f8c6a','#578299'], sumpf:['#998f6a','#5a8a90'],
};
COAST_COL.inseln=COAST_COL.gruen; COAST_COL.gebirge=COAST_COL.winter;

const CHUNK = 12; // Knoten pro Chunk-Kante
const OUT='rgba(88,58,34,0.5)';    // Standard-Kontur (warm, weich)

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
function hex2arr(hex){
  const n=parseInt(hex.slice(1),16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function mixArr(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
// abgerundetes Rechteck (mit Fallback)
function rr(g,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  g.beginPath();
  g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r);
  g.closePath();
}

export class Renderer {
  constructor(canvas){
    this.cv=canvas; this.ctx=canvas.getContext('2d');
    this.chunks=new Map();
    this.chunkVer=new Map();
    this.sprites=new Map();
    this.time=0;
    this.loadAssets();
  }
  setGame(game){
    this.game=game;
    this.theme=game.setup.theme||'gruen';
    this.chunks.clear(); this.chunkVer.clear();
    this.sprites.clear();
    this.lastTerritoryVer=-1;
    this.borderEdges=[];
    this._fogCount=-1; this._fogT=-1e9;
    this.fogDark=null; this.fogMist=null;
    this.initSheep();
  }
  // ---------- Schafe: kleine Wander-Deko auf den Wiesen ----------
  initSheep(){
    const m=this.game.map;
    this.sheep=[];
    let tries=0;
    while(this.sheep.length<9 && tries<600){
      tries++;
      const i=(hash01(tries*7919+m.w)*m.terr.length)|0;
      if(m.terr[i]!==1 /*GRASS*/ || m.obj[i]!==0 || m.bld[i]>=0) continue;
      const [x,y]=m.worldPos(i);
      this.sheep.push({ home:i, x, y, tx:x, ty:y, state:'graze', t:1000+hash01(tries)*3000, phase:hash01(tries*13)*6.28 });
    }
  }
  updateSheep(dt){
    if(!this.sheep) return;
    const m=this.game.map;
    for(const s of this.sheep){
      s.t-=dt;
      if(s.state==='walk'){
        const dx=s.tx-s.x, dy=s.ty-s.y;
        const d=Math.hypot(dx,dy);
        const sp=dt*0.011;
        if(d<sp||d<0.5){ s.x=s.tx; s.y=s.ty; s.state='graze'; s.t=1800+Math.random()*4200; }
        else { s.x+=dx/d*sp; s.y+=dy/d*sp; }
      } else if(s.t<=0){
        // neues Ziel in Heimatnähe suchen (nur freie Wiese)
        const [hx,hy]=m.worldPos(s.home);
        for(let k=0;k<6;k++){
          const nx=hx+(Math.random()-0.5)*140, ny=hy+(Math.random()-0.5)*110;
          const n=m.nearestNode(nx,ny);
          if(n>=0 && m.terr[n]===1 && m.bld[n]<0 && (m.obj[n]&127)===0){
            s.tx=nx; s.ty=ny; s.state='walk';
            break;
          }
        }
        s.t=2000;
        // seltenes Blöken, wenn nahe der Kamera
        if(this.onAmbient && Math.random()<0.3 && m.explored[s.home]){
          const cam=this._lastCam;
          if(cam){
            const d=Math.hypot(s.x-cam.x,s.y-cam.y)*cam.z;
            if(d<600) this.onAmbient('sheep', Math.max(0.15,1-d/600));
          }
        }
      }
    }
  }
  drawSheep(g, s){
    const m=this.game.map;
    const n=m.nearestNode(s.x,s.y);
    if(n<0 || !m.explored[n]) return;
    const walk=s.state==='walk';
    const bob=walk? Math.abs(Math.sin(this.time/130+s.phase))*1.4 : 0;
    const x=s.x, y=s.y-bob;
    this.shadow(g,s.x+2,s.y+4,7,2.6,0.22);
    // Beine
    g.strokeStyle='#5a5248'; g.lineWidth=1.8;
    const st=walk? Math.sin(this.time/130+s.phase)*1.6 : 0;
    g.beginPath();
    g.moveTo(x-3.5,y+1); g.lineTo(x-3.5+st,y+4.6);
    g.moveTo(x+3.5,y+1); g.lineTo(x+3.5-st,y+4.6);
    g.stroke();
    // flauschiger Körper
    g.fillStyle='#f4f1e8';
    g.beginPath();
    g.arc(x-3,y-2.4,4.4,0,7); g.arc(x+2.6,y-2.6,4.6,0,7); g.arc(x,y-4.6,4.2,0,7);
    g.fill();
    g.strokeStyle='rgba(120,110,95,0.4)'; g.lineWidth=1;
    g.beginPath(); g.arc(x,y-3,6.6,0,7); g.stroke();
    // Kopf (grast: unten, sonst vorn)
    const graze=s.state==='graze' && (this.time/1000+s.phase)%4<2.6;
    const hx2=x+6.4, hy2=graze? y+2.4 : y-3.4;
    g.fillStyle='#4a4038';
    g.beginPath(); g.ellipse(hx2,hy2,2.8,3.4,graze?0.9:0.3,0,7); g.fill();
    // Öhrchen
    g.beginPath(); g.ellipse(hx2-1.6,hy2-2,1.6,0.9,0.6,0,7); g.fill();
    g.fillStyle='#f4f1e8';
    g.beginPath(); g.arc(hx2-1,hy2-2.6,1.7,0,7); g.fill();
    // Schwänzchen
    g.fillStyle='#f4f1e8';
    g.beginPath(); g.arc(x-7,y-3.4,1.7,0,7); g.fill();
  }
  drawBirds(g, cw, chh, wx0, wx1, wy0, wy1){
    for(let f=0; f<3; f++){
      const spd=24+f*8;
      const bx=((this.time/1000*spd + f*2381)%(cw+500))-250;
      const by=((f*761)%(chh*0.8))+90 + Math.sin(this.time/1900+f*2.4)*46;
      if(bx+80<wx0||bx-80>wx1||by+40<wy0||by-40>wy1) continue;
      g.strokeStyle='rgba(40,44,52,0.75)';
      g.lineWidth=1.6;
      for(let k=0;k<4;k++){
        const ox=bx-k*15-(k%2)*7, oy=by+(k%2)*9+k*2.4;
        const flap=Math.sin(this.time/130+f*3+k*1.3)*2.8;
        g.beginPath();
        g.moveTo(ox-5,oy-flap*0.4);
        g.quadraticCurveTo(ox-2,oy-3-flap, ox,oy);
        g.quadraticCurveTo(ox+2,oy-3-flap, ox+5,oy-flap*0.4);
        g.stroke();
      }
    }
  }
  // ---------- Nebel: weiche Dunstschichten statt harter Kreise ----------
  rebuildFog(){
    const m=this.game.map;
    let count=0;
    for(let i=0;i<m.explored.length;i++) if(!m.explored[i]) count++;
    if(count===this._fogCount && this.fogDark) return;
    this._fogCount=count;
    const S=8;
    const w=m.w*S, h=m.h*S;
    const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h;
    const tg=tmp.getContext('2d');
    tg.fillStyle='#000';
    // Rand außerhalb der Karte gehört ebenfalls zum Unbekannten
    tg.fillRect(0,0,w,S); tg.fillRect(0,h-S,w,S); tg.fillRect(0,0,S,h); tg.fillRect(w-S,0,S,h);
    // Knoten als überlappende Kreise -> keine Raster-/Sechseckkanten im Dunst
    tg.beginPath();
    for(let y=0;y<m.h;y++){
      const off=(y&1)*S*0.5;
      for(let x=0;x<m.w;x++){
        if(m.explored[m.idx(x,y)]) continue;
        const cx=x*S+off+S*0.5, cy=y*S+S*0.5;
        tg.moveTo(cx+S*0.95,cy);
        tg.arc(cx,cy,S*0.95,0,7);
      }
    }
    tg.fill();
    const mk=(blur,tint)=>{
      const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      const g2=cv.getContext('2d');
      if('filter' in g2) g2.filter=`blur(${blur}px)`;
      g2.drawImage(tmp,0,0);
      g2.filter='none';
      g2.globalCompositeOperation='source-in';
      g2.fillStyle=tint; g2.fillRect(0,0,w,h);
      return cv;
    };
    this.fogDark=mk(6,'#0e1520');
    this.fogMist=mk(15,'#9fb2c2');
  }
  resize(w,h,dpr){
    this.cv.width=w*dpr; this.cv.height=h*dpr;
    this.dpr=dpr; this.vw=w; this.vh=h;
    // Vignette vorbereiten
    const v=document.createElement('canvas'); v.width=w; v.height=h;
    const g=v.getContext('2d');
    const rad=g.createRadialGradient(w/2,h/2, Math.min(w,h)*0.42, w/2,h/2, Math.hypot(w,h)*0.62);
    rad.addColorStop(0,'rgba(8,12,20,0)');
    rad.addColorStop(1,'rgba(8,12,20,0.22)');
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
    const cols=TER_COL[this.theme]||TER_COL.gruen;
    const ncache=new Map();
    // 1) Dreiecksnetz auf Zwischenfläche zeichnen (mit breitem Überstand für nahtlose Chunks)
    if(!this._tmpChunk || this._tmpChunk.width!==w || this._tmpChunk.height!==h){
      this._tmpChunk=document.createElement('canvas');
      this._tmpChunk.width=w; this._tmpChunk.height=h;
    }
    const tg=this._tmpChunk.getContext('2d');
    tg.clearRect(0,0,w,h);
    tg.save(); tg.translate(-c.ox,-c.oy);
    const x0=cx*CHUNK-3, y0=cy*CHUNK-3, x1=x0+CHUNK+6, y1=y0+CHUNK+6;
    for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++){
      for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
        const i=m.idx(x,y);
        const p=y&1;
        const iE = x+1<m.w ? m.idx(x+1,y) : i;
        const iSW = m.inb(x-1+p,y+1)? m.idx(x-1+p,y+1) : i;
        const iSE = m.inb(x+p,y+1)? m.idx(x+p,y+1) : i;
        this.tri(tg, m, cols, ncache, i, iE, iSE);
        this.tri(tg, m, cols, ncache, i, iSE, iSW);
      }
    }
    tg.restore();
    // 2) weichgezeichnet übernehmen -> Facetten verschwinden vollständig
    if('filter' in g){ g.filter='blur(4px)'; }
    g.drawImage(this._tmpChunk,0,0);
    g.filter='none';
    // 3) Textur-Tupfer (Gras, Fels, Sand ...) scharf obendrauf
    g.save(); g.translate(-c.ox,-c.oy);
    for(let y=Math.max(0,y0+2); y<Math.min(m.h-1,y1-2); y++){
      for(let x=Math.max(0,x0+2); x<Math.min(m.w-1,x1-2); x++){
        const i=m.idx(x,y);
        this.terrainBrush(g, m, i);
      }
    }
    g.restore();
    return c;
  }
  terrainBrush(g, m, i){
    const t=m.terr[i];
    const h=hash01(i*17+9);
    const [px,py]=m.worldPos(i);
    const o1=(hash01(i*23+2)-0.5)*30, o2=(hash01(i*41+4)-0.5)*24;
    if(t===TER.GRASS){
      // weiche Farbtupfer (Wiesen-Sprenkelung)
      if(h>0.82){
        g.fillStyle=h>0.91?'rgba(190,230,140,0.1)':'rgba(40,95,40,0.09)';
        g.beginPath(); g.ellipse(px+o1,py+o2,15,9,h*3,0,7); g.fill();
      }
      // dichte Grasbüschel in mehreren Tönen -> liest sich als echte Wiese
      const tones=['rgba(50,105,45,0.4)','rgba(88,150,70,0.38)','rgba(175,220,135,0.34)'];
      for(let c2=0;c2<3;c2++){
        const hh=hash01(i*53+c2*7);
        if(hh>0.8) continue;
        const bx0=px+(hash01(i*61+c2)-0.5)*40;
        const by0=py+(hash01(i*67+c2)-0.5)*30;
        g.strokeStyle=tones[c2];
        g.lineWidth=1.4;
        for(let k=0;k<4;k++){
          const bx=bx0+k*3.4-5, lean=(hash01(i*3+k+c2)-0.5)*3;
          g.beginPath();
          g.moveTo(bx,by0);
          g.quadraticCurveTo(bx+lean,by0-3.2, bx+lean*1.8,by0-5.8);
          g.stroke();
        }
      }
    } else if(t===TER.MOUNT){
      const hg=m.hgt[i];
      if(h<0.34){
        // Felsgrat: gezackter dunkler Zug mit Lichtkante darüber
        const zx=px+o1, zy=py+o2;
        const seg=[[-11,2],[-4,-3],[2,1],[8,-2],[13,2]];
        g.strokeStyle='rgba(48,42,35,0.5)'; g.lineWidth=2;
        g.beginPath();
        seg.forEach(([dx,dy],k)=>{ if(k===0) g.moveTo(zx+dx,zy+dy); else g.lineTo(zx+dx,zy+dy); });
        g.stroke();
        g.strokeStyle='rgba(255,255,255,0.32)'; g.lineWidth=1.2;
        g.beginPath();
        seg.forEach(([dx,dy],k)=>{ if(k===0) g.moveTo(zx+dx-1,zy+dy-2); else g.lineTo(zx+dx-1,zy+dy-2); });
        g.stroke();
      } else if(h<0.58){
        // Geröllfeld
        g.fillStyle='rgba(60,54,46,0.35)';
        for(let k=0;k<6;k++){
          g.beginPath();
          g.arc(px+o1+hash01(i*7+k)*26-13, py+o2+hash01(i*11+k)*18-9, 1+hash01(i*13+k)*1.6, 0, 7);
          g.fill();
        }
        g.fillStyle='rgba(255,255,255,0.14)';
        for(let k=0;k<3;k++){
          g.beginPath();
          g.arc(px+o1+hash01(i*17+k)*22-11, py+o2+hash01(i*19+k)*15-8, 1.1, 0, 7);
          g.fill();
        }
      } else if(h<0.68 && hg>1.0){
        // Schneefleck in Gipfelnähe
        g.fillStyle='rgba(240,246,252,0.5)';
        g.beginPath(); g.ellipse(px+o1,py+o2,8,3.4,h*3,0,7); g.fill();
      }
    } else if(t===TER.DESERT && h<0.4){
      g.fillStyle='rgba(160,130,80,0.3)';
      for(let k=0;k<5;k++){
        g.beginPath();
        g.arc(px+o1+hash01(i*7+k)*20-10, py+o2+hash01(i*11+k)*14-7, 1.1, 0, 7);
        g.fill();
      }
    } else if(t===TER.SWAMP && h<0.45){
      g.fillStyle='rgba(40,70,45,0.3)';
      g.beginPath(); g.ellipse(px+o1,py+o2,7,3.4,0.4,0,7); g.fill();
      g.strokeStyle='rgba(120,160,90,0.4)'; g.lineWidth=1.3;
      g.beginPath(); g.moveTo(px+o1+3,py+o2); g.lineTo(px+o1+4,py+o2-6); g.stroke();
    } else if(t===TER.SNOW && h<0.3){
      g.fillStyle='rgba(255,255,255,0.5)';
      g.beginPath(); g.arc(px+o1,py+o2,1.3,0,7); g.arc(px+o1+7,py+o2+4,1,0,7); g.fill();
    } else if(t===TER.LAVA && h<0.5){
      g.strokeStyle='rgba(255,190,80,0.5)'; g.lineWidth=1.6;
      g.beginPath();
      g.moveTo(px+o1-6,py+o2); g.lineTo(px+o1,py+o2+3); g.lineTo(px+o1+6,py+o2+1);
      g.stroke();
    }
  }
  // weiche Farbe pro KNOTEN (Küstenmischung + sanfte, örtlich korrelierte Variation)
  nodeColor(m, cols, coast, ncache, i){
    let v=ncache.get(i);
    if(v) return v;
    const t=m.terr[i];
    const nbs=m.nbs(i);
    let col;
    if(t===TER.WATER){
      // kontinuierlicher Küsten-/Tiefenverlauf über zwei Nachbarringe (keine Sprünge)
      const landN=nbs.filter(n=>m.terr[n]!==TER.WATER).length;
      const seen=new Set([i]); let landC=0;
      for(const n of nbs){
        for(const q of m.nbs(n)){
          if(seen.has(q)) continue; seen.add(q);
          if(m.terr[q]!==TER.WATER) landC++;
        }
      }
      const base=hex2arr(cols[TER.WATER]);
      const depth=Math.min(1,(landN*3+landC)/9);          // 1 = ufernah
      const shore=Math.min(1,(landN*2.2+landC*0.55)/8);   // Flachwasser-Anteil
      col=mixArr(base.map(v=>v*0.87), base, depth);
      col=mixArr(col, hex2arr(coast[1]), shore*0.6);
    } else if(t===TER.GRASS||t===TER.DESERT||t===TER.SNOW){
      const waterN=nbs.filter(n=>m.terr[n]===TER.WATER).length;
      col = waterN? mixArr(hex2arr(cols[t]), hex2arr(coast[0]), Math.min(1,waterN/4)*0.8) : hex2arr(cols[t]);
    } else if(t===TER.MOUNT){
      // Höhenzonen: Geröllfuß -> Fels -> Gipfellicht/Schnee; Grasübergang am Bergfuß
      const rock=hex2arr(cols[t]);
      const scree=mixArr(rock, hex2arr(cols[TER.GRASS]||'#6bb254'), 0.42);
      const hg=m.hgt[i];
      col = hg<0.8 ? mixArr(scree, rock, Math.max(0,Math.min(1,(hg-0.4)/0.4))) : rock.slice();
      const peak=Math.max(0,Math.min(0.8,(hg-0.98)*1.35));
      if(peak>0) col=mixArr(col,[229,234,241],peak);
      const grassN=nbs.filter(n=>m.terr[n]===TER.GRASS||n===i&&false).length;
      if(grassN) col=mixArr(col, hex2arr(cols[TER.GRASS]), Math.min(1,grassN/4)*0.45);
    } else {
      col = hex2arr(cols[t]||'#888888');
    }
    // großflächiges, weich interpoliertes Wertrauschen (nicht auf Wasser)
    if(t!==TER.WATER){
      const gx0=m.X(i)/7, gy0=m.Y(i)/7;
      const x0=Math.floor(gx0), y0=Math.floor(gy0);
      const fx=gx0-x0, fy=gy0-y0;
      const sm=(u)=>u*u*(3-2*u);
      const vv=(xx,yy)=>hash01(((xx*73856093)^(yy*19349663))|0);
      const s=(vv(x0,y0)*(1-sm(fx))+vv(x0+1,y0)*sm(fx))*(1-sm(fy))
            + (vv(x0,y0+1)*(1-sm(fx))+vv(x0+1,y0+1)*sm(fx))*sm(fy);
      const f = t===TER.MOUNT? 0.93+s*0.14 : 0.958+s*0.084;
      col=[col[0]*f, col[1]*f, col[2]*f];
    }
    // Relieflicht pro KNOTEN (nicht pro Dreieck!) -> nach dem Weichzeichnen keinerlei Facetten
    if(t!==TER.WATER){
      let gx=0, gy=0;
      for(const n of nbs){
        const ddx=(m.X(n)+((m.Y(n)&1)*0.5))-(m.X(i)+((m.Y(i)&1)*0.5));
        const ddy=m.Y(n)-m.Y(i);
        const dh=m.hgt[n]-m.hgt[i];
        gx+=dh*ddx; gy+=dh*ddy;
      }
      const k = t===TER.MOUNT? 0.30 : 0.11;
      let l=1-(gx*0.7+gy)*k;
      l=Math.max(t===TER.MOUNT?0.72:0.86, Math.min(t===TER.MOUNT?1.32:1.14, l));
      col=[col[0]*l, col[1]*l, col[2]*l];
    }
    ncache.set(i,col);
    return col;
  }
  tri(g, m, cols, ncache, a,b,c){
    const [ax,ay]=m.worldPos(a), [bx,by]=m.worldPos(b), [cx2,cy2]=m.worldPos(c);
    const coast=COAST_COL[this.theme]||COAST_COL.gruen;
    const ca=this.nodeColor(m,cols,coast,ncache,a);
    const cb=this.nodeColor(m,cols,coast,ncache,b);
    const cc=this.nodeColor(m,cols,coast,ncache,c);
    // reine Eckfarben-Mittelung, Licht steckt bereits in den Knotenfarben
    const r=(ca[0]+cb[0]+cc[0])/3, gr=(ca[1]+cb[1]+cc[1])/3, bl=(ca[2]+cb[2]+cc[2])/3;
    g.fillStyle=`rgb(${r|0},${gr|0},${bl|0})`;
    g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.lineTo(cx2,cy2); g.closePath();
    g.fill();
    g.strokeStyle=g.fillStyle; g.lineWidth=1; g.stroke();
    // Lava-Glut
    if(m.terr[a]===TER.LAVA){
      g.fillStyle=`rgba(255,${150+((hash01(a)*60)|0)},50,0.3)`;
      g.beginPath(); g.arc((ax+bx+cx2)/3,(ay+by+cy2)/3, 6+hash01(b)*6, 0, 7); g.fill();
    }
  }

  // ---------- Sprite-Werkzeuge (2x Supersampling für scharfe Nahansicht) ----------
  sprite(key, w, h, draw){
    let s=this.sprites.get(key);
    if(s) return s;
    const SS=2;
    const cv=document.createElement('canvas'); cv.width=w*SS; cv.height=h*SS;
    const g=cv.getContext('2d');
    g.lineJoin='round'; g.lineCap='round';
    g.scale(SS,SS);
    draw(g, w, h);
    s={cv, w, h};
    this.sprites.set(key,s);
    return s;
  }
  // ---------- Asset-Überschreibungen (Stilguide §14): PNGs aus assets/ ersetzen Prozedural-Sprites ----------
  loadAssets(){
    if(this.assets) return;
    this.assets=new Map();
    fetch('assets/manifest.json')
      .then(r=> r.ok? r.json() : null)
      .then(list=>{
        if(!Array.isArray(list)) return;
        for(const name of list){
          const img=new Image();
          img.src='assets/'+name;
          this.assets.set(name.replace(/\.png$/i,''), img);
        }
      })
      .catch(()=>{});
  }
  asset(key){
    const img=this.assets && this.assets.get(key);
    return (img && img.complete && img.naturalWidth>0) ? img : null;
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
      // ---- Pseudo-3D: rechte Seitenflächen mit Tiefe D ----
      const D=8, DY=0.55;
      const sideQuad=(x1,y1,x2,y2,col)=>{
        const path=()=>{
          g.beginPath();
          g.moveTo(x1,y1); g.lineTo(x1+D,y1-D*DY);
          g.lineTo(x2+D,y2-D*DY); g.lineTo(x2,y2);
          g.closePath();
        };
        path(); g.fillStyle=col; g.fill();
        // Seitenfläche dunkelt nach rechts ab -> plastischer
        const gr=g.createLinearGradient(x1,0,x1+D,0);
        gr.addColorStop(0,'rgba(0,0,0,0.02)'); gr.addColorStop(1,'rgba(0,0,0,0.22)');
        path(); g.fillStyle=gr; g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.1; g.stroke();
      };
      const wallGrad=(x,y,w,h,light='#f2e6c9',dark='#d5c39a')=>{
        sideQuad(x+w,y+2,x+w,y+h,'#b39a70');
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,light); gr.addColorStop(1,dark);
        g.fillStyle=gr; rr(g,x,y,w,h,2.5); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        // Verwitterungsschlieren (Patina)
        g.strokeStyle='rgba(96,74,48,0.12)'; g.lineWidth=2;
        const sd=(w*7+h*3)|0;
        for(let k=0;k<2;k++){
          const wx2=x+w*(0.18+hash01(sd+k*5)*0.64);
          g.beginPath(); g.moveTo(wx2,y+2); g.lineTo(wx2+1,y+h*0.5+hash01(sd+k)*h*0.3); g.stroke();
        }
      };
      const stoneGrad=(x,y,w,h)=>{
        sideQuad(x+w,y+2,x+w,y+h,'#87816f'+'');
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,'#d2cdc1'); gr.addColorStop(1,'#a19b8e');
        g.fillStyle=gr; rr(g,x,y,w,h,2.5); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        // romanisches Quadermauerwerk: Lagen mit versetzten Stoßfugen
        g.strokeStyle='rgba(80,70,58,0.22)'; g.lineWidth=1;
        let row=0;
        for(let yy=y+5;yy<y+h-3;yy+=5.5,row++){
          g.beginPath(); g.moveTo(x+2,yy); g.lineTo(x+w-2,yy); g.stroke();
          for(let xx=x+5+(row%2?5:0); xx<x+w-3; xx+=10){
            g.beginPath(); g.moveTo(xx,yy); g.lineTo(xx,Math.min(yy+5.5,y+h-2)); g.stroke();
          }
        }
        // helle Eckquader
        g.fillStyle='rgba(255,255,255,0.14)';
        for(let yy=y+3; yy<y+h-5; yy+=11){ g.fillRect(x+1,yy,4.5,5); g.fillRect(x+w-5.5,yy+5.5,4.5,5); }
      };
      // Blockhaus aus liegenden Stämmen (Waldarbeiter-Hütten)
      const logWall=(x,y,w,h)=>{
        sideQuad(x+w,y+2,x+w,y+h,'#7d5a34');
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,'#c99e66'); gr.addColorStop(1,'#a37c4c');
        g.fillStyle=gr; rr(g,x,y,w,h,3); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        g.strokeStyle='rgba(90,60,30,0.4)'; g.lineWidth=1.1;
        for(let yy=y+4.5;yy<y+h-2;yy+=4.5){
          g.beginPath(); g.moveTo(x+1.5,yy); g.lineTo(x+w-1.5,yy); g.stroke();
        }
        // Stirnseiten der Stämme
        g.fillStyle='#d9b37d';
        for(let yy=y+2.2;yy<y+h-2;yy+=4.5){
          g.beginPath(); g.arc(x+1.6,yy+2.2,1.5,0,7); g.fill();
        }
      };
      // heller Verputz mit Bruchstein-Sockel (Stadthandwerker)
      const plaster=(x,y,w,h)=>{
        sideQuad(x+w,y+2,x+w,y+h,'#c2b193');
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,'#f4ecd9'); gr.addColorStop(1,'#ddd0b3');
        g.fillStyle=gr; rr(g,x,y,w,h,2.5); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        // Bruchstein-Sockel
        g.fillStyle='#a89f8d'; g.fillRect(x+1,y+h-6,w-2,5);
        g.strokeStyle='rgba(80,70,58,0.3)'; g.lineWidth=0.9;
        for(let xx=x+4;xx<x+w-3;xx+=6.5){
          g.beginPath(); g.arc(xx,y+h-3.4,2.4,Math.PI,0); g.stroke();
        }
      };
      const timber=(x,y,w,h)=>{
        g.strokeStyle='rgba(140,105,62,0.55)'; g.lineWidth=2.2;
        g.beginPath();
        g.moveTo(x+w*0.33,y+2); g.lineTo(x+w*0.33,y+h-2);
        g.moveTo(x+w*0.66,y+2); g.lineTo(x+w*0.66,y+h-2);
        g.stroke();
        g.lineWidth=1.6;
        g.beginPath(); g.moveTo(x+2,y+h-2); g.lineTo(x+w*0.33,y+2); g.moveTo(x+w*0.66,y+h-2); g.lineTo(x+w-2,y+2); g.stroke();
      };
      // rechte Dachfläche (Pseudo-3D)
      const roofSide=(x,y,w,rh,over,col)=>{
        g.fillStyle=col;
        g.beginPath();
        g.moveTo(x+w/2,y-rh);
        g.lineTo(x+w/2+D,y-rh-D*DY);
        g.lineTo(x+w+over+D,y+1-D*DY);
        g.lineTo(x+w+over,y+1);
        g.closePath(); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.1; g.stroke();
      };
      const gableFront=(x,y,w,rh,over)=>{
        // leichte handwerkliche Asymmetrie: Firstpunkt und Überstände variieren
        const wk=(hash01(((w*31+rh*17)|0)+1)-0.5)*4;
        const oL=over+wk*0.8, oR=over-wk*0.5, ax=x+w/2+wk;
        g.beginPath();
        g.moveTo(x-oL,y+1);
        g.quadraticCurveTo(x+w*0.16,y-rh*0.62, ax-3,y-rh+1.5);
        g.quadraticCurveTo(ax,y-rh-1.5, ax+3,y-rh+1.5);
        g.quadraticCurveTo(x+w*0.84,y-rh*0.62, x+w+oR,y+1);
        g.quadraticCurveTo(x+w/2,y+4, x-oL,y+1);
        g.closePath();
      };
      // Moosflecken auf Dachflächen (Verwitterung, deterministisch je Form)
      const roofMoss=(x,y,w,rh)=>{
        const seed=(w*13+rh*7)|0;
        g.fillStyle='rgba(104,132,66,0.45)';
        for(let k=0;k<3;k++){
          if(hash01(seed+k*3)>0.75) continue;
          const mx=x+w*(0.2+hash01(seed+k)*0.6);
          const my=y-rh*(0.15+hash01(seed+k*7)*0.35);
          g.beginPath(); g.ellipse(mx,my,3.4+hash01(seed+k*11)*3,2+hash01(seed+k*13)*1.5,hash01(seed+k)*3,0,7); g.fill();
        }
        g.fillStyle='rgba(140,166,90,0.35)';
        g.beginPath(); g.ellipse(x+w*(0.3+hash01(seed+29)*0.4), y-rh*0.28, 2.2, 1.4, 0.5, 0, 7); g.fill();
      };
      const roofGable=(x,y,w,rh,color,over=6)=>{
        const base=mixArr(hex2arr(color),[255,255,255],0.16);
        const cl=(f)=>`rgb(${base.map(v=>Math.max(0,Math.min(255,v*f))|0).join(',')})`;
        roofSide(x,y,w,rh,over,cl(0.6));
        const gr=g.createLinearGradient(0,y-rh,0,y);
        gr.addColorStop(0,cl(1.16)); gr.addColorStop(1,cl(0.85));
        g.fillStyle=gr;
        gableFront(x,y,w,rh,over);
        g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.5; g.stroke();
        // Schindelreihen
        g.strokeStyle='rgba(40,26,14,0.16)'; g.lineWidth=1.1;
        for(const fr of [0.34,0.58,0.8]){
          const yy=y-rh*(1-fr);
          const spread=(w/2+over)*fr;
          g.beginPath();
          g.moveTo(x+w/2-spread, yy+rh*fr*0.28);
          g.quadraticCurveTo(x+w/2, yy+3, x+w/2+spread, yy+rh*fr*0.28);
          g.stroke();
        }
        g.strokeStyle='rgba(255,255,255,0.4)'; g.lineWidth=1.4;
        g.beginPath(); g.moveTo(x-over+3,y-1); g.quadraticCurveTo(x+w*0.17,y-rh*0.6, x+w/2-2,y-rh+2.4); g.stroke();
        roofMoss(x,y,w,rh);
        // Dachschatten fällt auf die Wand (verstärkt die Tiefe)
        const shE=g.createLinearGradient(0,y+1,0,y+9);
        shE.addColorStop(0,'rgba(30,20,10,0.24)'); shE.addColorStop(1,'rgba(30,20,10,0)');
        g.fillStyle=shE; g.fillRect(x+1,y+1,w-2,8);
      };
      // Strohdach – Alltagsbauten des 12./13. Jahrhunderts
      const thatch=(x,y,w,rh,over=7)=>{
        roofSide(x,y,w,rh,over,'#8f7440');
        const gr=g.createLinearGradient(0,y-rh,0,y);
        gr.addColorStop(0,'#e3c586'); gr.addColorStop(1,'#b3925c');
        g.fillStyle=gr;
        gableFront(x,y,w,rh,over);
        g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.5; g.stroke();
        // Kammlinien des Strohs
        g.strokeStyle='rgba(110,80,40,0.3)'; g.lineWidth=1.2;
        for(const fr of [0.3,0.5,0.7,0.88]){
          const yy=y-rh*(1-fr);
          const spread=(w/2+over)*fr*0.94;
          g.beginPath();
          g.moveTo(x+w/2-spread, yy+rh*fr*0.26);
          g.quadraticCurveTo(x+w/2, yy+2.5, x+w/2+spread, yy+rh*fr*0.26);
          g.stroke();
        }
        // ausgefranste Traufkante
        g.fillStyle='#b3925c';
        for(let xx=x-over+3; xx<x+w+over-2; xx+=5.5){
          g.beginPath(); g.arc(xx, y+1.6, 2.6, 0, Math.PI); g.fill();
        }
        // Firstkappe
        g.strokeStyle='#8f7440'; g.lineWidth=3;
        g.beginPath(); g.moveTo(x+w/2-5,y-rh+2.6); g.quadraticCurveTo(x+w/2,y-rh-1, x+w/2+5,y-rh+2.6); g.stroke();
        roofMoss(x,y,w,rh);
        // Dachschatten auf der Wand
        const shE2=g.createLinearGradient(0,y+2,0,y+10);
        shE2.addColorStop(0,'rgba(30,20,10,0.24)'); shE2.addColorStop(1,'rgba(30,20,10,0)');
        g.fillStyle=shE2; g.fillRect(x+1,y+2,w-2,8);
      };
      // Rundturm mit Zylinderschattierung (Kegel- oder Zinnenabschluss)
      const towerRound=(cx,by,r,h,capH,cap='cone')=>{
        const gr=g.createLinearGradient(cx-r,0,cx+r,0);
        gr.addColorStop(0,'#dad5c9'); gr.addColorStop(0.55,'#b5afa2'); gr.addColorStop(1,'#7b7669');
        g.fillStyle=gr;
        g.beginPath();
        g.moveTo(cx-r,by); g.lineTo(cx-r,by-h);
        g.quadraticCurveTo(cx,by-h-r*0.3,cx+r,by-h);
        g.lineTo(cx+r,by); g.quadraticCurveTo(cx,by+r*0.3,cx-r,by);
        g.closePath(); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        g.strokeStyle='rgba(80,70,58,0.2)'; g.lineWidth=1;
        for(let yy=by-6; yy>by-h+4; yy-=6){
          g.beginPath(); g.moveTo(cx-r+1.5,yy); g.quadraticCurveTo(cx,yy+2.4,cx+r-1.5,yy); g.stroke();
        }
        g.fillStyle='#2c3644'; g.fillRect(cx-1.4,by-h+9,2.8,7); // Schießscharte
        if(cap==='cone'){
          const cg=g.createLinearGradient(cx-r,0,cx+r,0);
          cg.addColorStop(0,mix(pcd,'#ffffff',0.28)); cg.addColorStop(1,pcd);
          g.fillStyle=cg;
          g.beginPath();
          g.moveTo(cx-r-2.5,by-h);
          g.quadraticCurveTo(cx-r*0.5,by-h-capH*0.55, cx,by-h-capH);
          g.quadraticCurveTo(cx+r*0.5,by-h-capH*0.55, cx+r+2.5,by-h);
          g.closePath(); g.fill();
          g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
          g.fillStyle='#e8c990'; g.beginPath(); g.arc(cx,by-h-capH-1.5,1.6,0,7); g.fill();
        } else {
          g.fillStyle='#c6c1b4';
          for(let k=-2;k<=2;k++){
            g.fillRect(cx+k*r*0.45-2.2, by-h-6, 4.4, 6.5);
            g.strokeStyle=OUT; g.lineWidth=1; g.strokeRect(cx+k*r*0.45-2.2, by-h-6, 4.4, 6.5);
          }
        }
      };
      // romanisches Rundbogenfenster
      const window_=(x,y,w=7,h=9,lit=true)=>{
        g.strokeStyle='#c2b8a4'; g.lineWidth=2.2;   // Steinlaibung
        g.beginPath();
        g.moveTo(x-0.5,y+h); g.lineTo(x-0.5,y+w/2);
        g.arc(x+w/2,y+w/2,w/2+0.5,Math.PI,0);
        g.lineTo(x+w+0.5,y+h);
        g.stroke();
        g.fillStyle=lit?'#ffd98a':'#4a4033';
        g.beginPath();
        g.moveTo(x,y+h); g.lineTo(x,y+w/2);
        g.arc(x+w/2,y+w/2,w/2,Math.PI,0);
        g.lineTo(x+w,y+h);
        g.closePath(); g.fill();
        g.strokeStyle='#8a6b43'; g.lineWidth=1.2; g.stroke();
        if(lit){ g.fillStyle='rgba(255,220,140,0.28)'; g.beginPath(); g.arc(x+w/2,y+h/2,w*0.95,0,7); g.fill(); }
      };
      // Rundbogentür mit Steingewände
      const door=(x,y,w=9,h=13)=>{
        g.strokeStyle='#c2b8a4'; g.lineWidth=2.6;
        g.beginPath();
        g.moveTo(x-1,y+h); g.lineTo(x-1,y+w*0.45);
        g.arc(x+w/2,y+w*0.45,w/2+1,Math.PI,0);
        g.lineTo(x+w+1,y+h);
        g.stroke();
        g.fillStyle='#5d4028';
        g.beginPath();
        g.moveTo(x,y+h); g.lineTo(x,y+w*0.45);
        g.arc(x+w/2,y+w*0.45,w/2,Math.PI,0);
        g.lineTo(x+w,y+h);
        g.closePath(); g.fill();
        g.strokeStyle='#8a6b43'; g.lineWidth=1.3; g.stroke();
        // Brettfugen + Beschlag
        g.strokeStyle='rgba(40,26,14,0.4)'; g.lineWidth=0.9;
        g.beginPath(); g.moveTo(x+w*0.35,y+2); g.lineTo(x+w*0.35,y+h-1); g.moveTo(x+w*0.65,y+1); g.lineTo(x+w*0.65,y+h-1); g.stroke();
        g.fillStyle='#e8c990'; g.beginPath(); g.arc(x+w*0.76,y+h*0.55,1,0,7); g.fill();
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
      // heraldisches Wappenschild in Spielerfarbe
      const heraldShield=(x,y,s2=1)=>{
        g.save(); g.translate(x,y); g.scale(s2,s2);
        g.fillStyle=pc;
        g.beginPath();
        g.moveTo(-5.5,-6); g.lineTo(5.5,-6);
        g.lineTo(5.5,0); g.quadraticCurveTo(5,4.6, 0,7);
        g.quadraticCurveTo(-5,4.6, -5.5,0);
        g.closePath(); g.fill();
        g.strokeStyle='rgba(40,26,14,0.7)'; g.lineWidth=1.3; g.stroke();
        // Sparren (Chevron)
        g.strokeStyle='rgba(255,255,255,0.85)'; g.lineWidth=2;
        g.beginPath(); g.moveTo(-4,-0.5); g.lineTo(0,-3.6); g.lineTo(4,-0.5); g.stroke();
        g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=1;
        g.beginPath(); g.moveTo(-4.5,-5); g.lineTo(4.5,-5); g.stroke();
        g.restore();
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
            // Hochmittelalterliche Burg: Ringmauer mit Wehrgang, Bergfried, Rundtürme, Torbogen
            // Bergfried (hinten, quaderförmig mit Pyramidendach und Doppelbogenfenster)
            stoneGrad(W*0.35,H*0.18,W*0.3,H*0.42);
            g.fillStyle='#6d6759';
            g.beginPath(); // Pyramidendach
            g.moveTo(W*0.33,H*0.18); g.lineTo(W*0.5,H*0.06); g.lineTo(W*0.67,H*0.18);
            g.closePath(); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
            g.fillStyle='rgba(255,255,255,0.18)';
            g.beginPath(); g.moveTo(W*0.33,H*0.18); g.lineTo(W*0.5,H*0.06); g.lineTo(W*0.5,H*0.18); g.closePath(); g.fill();
            // Biforium (romanisches Doppelfenster)
            window_(W*0.42,H*0.26,5.5,8,true); window_(W*0.53,H*0.26,5.5,8,true);
            g.fillStyle='#c2b8a4'; g.fillRect(W*0.485,H*0.26,2.4,8);
            // Kragstein-Reihe (Maschikuli) unter dem Bergfried-Abschluss
            g.fillStyle='#8f897b';
            for(let k=0;k<6;k++) g.fillRect(W*0.36+k*W*0.048,H*0.2,W*0.024,3.4);
            // Ringmauer mit Wehrgang
            stoneGrad(W*0.14,H*0.5,W*0.72,H*0.38);
            g.fillStyle='#c6c1b4';
            for(let k=0;k<7;k++){
              g.fillRect(W*0.155+k*W*0.1,H*0.455,W*0.06,7);
              g.strokeStyle=OUT; g.lineWidth=0.9; g.strokeRect(W*0.155+k*W*0.1,H*0.455,W*0.06,7);
            }
            // Wehrgang-Schatten + Verwitterungsspuren
            g.fillStyle='rgba(40,30,20,0.18)'; g.fillRect(W*0.15,H*0.5,W*0.7,4);
            g.strokeStyle='rgba(60,55,45,0.16)'; g.lineWidth=1.6;
            for(const fx2 of [0.2,0.31,0.62,0.79]){
              g.beginPath(); g.moveTo(W*fx2,H*0.52); g.lineTo(W*fx2,H*(0.62+(fx2*7%1)*0.1)); g.stroke();
            }
            // Rundtürme mit Kegeldach
            towerRound(W*0.14,H*0.9,W*0.075,H*0.5,H*0.16,'cone');
            towerRound(W*0.86,H*0.9,W*0.075,H*0.5,H*0.16,'cone');
            // Torhaus: zwei kleine Flankentürmchen
            towerRound(W*0.375,H*0.9,W*0.045,H*0.32,H*0.09,'cone');
            towerRound(W*0.625,H*0.9,W*0.045,H*0.32,H*0.09,'cone');
            // Torbogen mit Fallgitter
            door(W*0.44,H*0.66,W*0.12,H*0.22);
            g.strokeStyle='#4a4033'; g.lineWidth=1.2;
            for(let k=0;k<3;k++){ g.beginPath(); g.moveTo(W*(0.455+k*0.032),H*0.66); g.lineTo(W*(0.455+k*0.032),H*0.8); g.stroke(); }
            g.beginPath(); g.moveTo(W*0.445,H*0.72); g.lineTo(W*0.555,H*0.72); g.stroke();
            heraldShield(W*0.5,H*0.58,1.2);
            banner(W*0.5,H*0.02,14);
            break;
          }
          if(type==='farm'||type==='pigfarm'){
            // Langhaus mit tiefem Strohdach + Scheune + Zaun
            wallGrad(W*0.08,H*0.56,W*0.42,H*0.28,'#e0d0aa','#c2ab7d');
            timber(W*0.08,H*0.56,W*0.42,H*0.28);
            thatch(W*0.08,H*0.56,W*0.42,H*0.3);
            window_(W*0.16,H*0.62,6.5,8); door(W*0.32,H*0.7,9,14);
            // Scheune
            wallGrad(W*0.56,H*0.6,W*0.32,H*0.26,'#d8b98a','#b08d5c');
            thatch(W*0.56,H*0.6,W*0.32,H*0.16,4);
            g.fillStyle='#5d452a'; g.fillRect(W*0.66,H*0.68,W*0.14,H*0.18);
            g.strokeStyle='#3a2d20'; g.lineWidth=1.4;
            g.strokeRect(W*0.66,H*0.68,W*0.14,H*0.18);
            g.beginPath(); g.moveTo(W*0.66,H*0.68); g.lineTo(W*0.8,H*0.86); g.moveTo(W*0.8,H*0.68); g.lineTo(W*0.66,H*0.86); g.stroke();
            // Zaun
            g.strokeStyle='#8a6b43'; g.lineWidth=2;
            g.beginPath(); g.moveTo(W*0.05,H*0.93); g.lineTo(W*0.95,H*0.93); g.stroke();
            for(let k=0;k<8;k++){ g.beginPath(); g.moveTo(W*0.08+k*W*0.12,H*0.89); g.lineTo(W*0.08+k*W*0.12,H*0.97); g.stroke(); }
            if(type==='pigfarm'){
              // Schweinchen in der Matschkuhle
              g.fillStyle='rgba(120,90,60,0.5)';
              g.beginPath(); g.ellipse(W*0.5,H*0.91,10,3.6,0,0,7); g.fill();
              g.fillStyle='#e3a2a2';
              g.beginPath(); g.ellipse(W*0.5,H*0.89,6,4,0,0,7); g.fill();
              g.fillStyle='#d98f8f'; g.beginPath(); g.arc(W*0.565,H*0.885,2.2,0,7); g.fill();
              g.fillStyle='#b5716e'; g.beginPath(); g.ellipse(W*0.575,H*0.885,1,1.3,0,0,7); g.fill();
              g.strokeStyle='#d98f8f'; g.lineWidth=1.2;   // Ringelschwanz
              g.beginPath(); g.moveTo(W*0.44,H*0.88); g.quadraticCurveTo(W*0.42,H*0.86,W*0.435,H*0.85); g.stroke();
            } else {
              // Vogelscheuche im Hof (kleiner Spaß)
              g.strokeStyle='#6d4f2e'; g.lineWidth=2;
              g.beginPath(); g.moveTo(W*0.93,H*0.86); g.lineTo(W*0.93,H*0.62); g.stroke();
              g.lineWidth=1.6;
              g.beginPath(); g.moveTo(W*0.875,H*0.68); g.lineTo(W*0.985,H*0.68); g.stroke();
              g.fillStyle='#c9a05a';   // ärmeliges Hemd
              g.beginPath(); g.moveTo(W*0.9,H*0.68); g.lineTo(W*0.96,H*0.68); g.lineTo(W*0.945,H*0.8); g.lineTo(W*0.915,H*0.8); g.closePath(); g.fill();
              g.fillStyle='#e8d9a8';   // Strohkopf
              g.beginPath(); g.arc(W*0.93,H*0.63,3.2,0,7); g.fill();
              g.fillStyle='#8a6b43';   // Schlapphut
              g.beginPath(); g.ellipse(W*0.93,H*0.605,4.4,1.4,0,0,7); g.fill();
              g.beginPath(); g.arc(W*0.93,H*0.6,2.2,Math.PI,0); g.fill();
              // frecher Vogel sitzt trotzdem drauf
              g.fillStyle='#3a3e46';
              g.beginPath(); g.ellipse(W*0.975,H*0.665,2,1.5,0,0,7); g.fill();
              g.beginPath(); g.arc(W*0.988,H*0.655,1.1,0,7); g.fill();
              g.fillStyle='#e8b93c';
              g.beginPath(); g.moveTo(W*0.995,H*0.655); g.lineTo(W*1.003,H*0.657); g.lineTo(W*0.995,H*0.661); g.fill();
            }
            break;
          }
          // Lagerhaus: steinernes Erdgeschoss, Fachwerk-Obergeschoss, Kranbalken am Giebel
          stoneGrad(W*0.12,H*0.66,W*0.76,H*0.2);
          wallGrad(W*0.12,H*0.44,W*0.76,H*0.24);
          timber(W*0.12,H*0.44,W*0.76,H*0.24);
          roofGable(W*0.12,H*0.44,W*0.76,H*0.28,pc);
          window_(W*0.2,H*0.5,6.5,8); window_(W*0.68,H*0.5,6.5,8);
          door(W*0.44,H*0.68,11,15);
          // Kranbalken mit Seil und Kiste (mittelalterlicher Lastenaufzug)
          g.strokeStyle='#6d4f2e'; g.lineWidth=2.6;
          g.beginPath(); g.moveTo(W*0.5,H*0.2); g.lineTo(W*0.62,H*0.2); g.stroke();
          g.strokeStyle='rgba(90,70,45,0.9)'; g.lineWidth=1.1;
          g.beginPath(); g.moveTo(W*0.62,H*0.2); g.lineTo(W*0.62,H*0.34); g.stroke();
          crate(W*0.585,H*0.34,7);
          crate(W*0.16,H*0.78,9); crate(W*0.26,H*0.8,7); barrel(W*0.86,H*0.8);
          // Lagerkatze auf der Kiste (kleiner Spaß)
          g.fillStyle='#2e2a26';
          g.beginPath(); g.ellipse(W*0.185,H*0.755,3.4,2.6,0,0,7); g.fill();          // Körper
          g.beginPath(); g.arc(W*0.215,H*0.735,2.2,0,7); g.fill();                     // Kopf
          g.beginPath();                                                                // Ohren
          g.moveTo(W*0.205,H*0.72); g.lineTo(W*0.21,H*0.7); g.lineTo(W*0.216,H*0.718);
          g.moveTo(W*0.222,H*0.717); g.lineTo(W*0.228,H*0.7); g.lineTo(W*0.231,H*0.72);
          g.fill();
          g.strokeStyle='#2e2a26'; g.lineWidth=1.4;                                     // Schwanz
          g.beginPath(); g.moveTo(W*0.155,H*0.76); g.quadraticCurveTo(W*0.135,H*0.74,W*0.145,H*0.72); g.stroke();
          g.fillStyle='#7fd08a';                                                        // Augen
          g.beginPath(); g.arc(W*0.211,H*0.733,0.5,0,7); g.arc(W*0.221,H*0.733,0.5,0,7); g.fill();
          banner(W*0.5,H*0.08,13);
          break;
        }
        case 'M': {
          if(type==='mill'){
            // Turmwindmühle mit Galerie auf Steinsockel
            stoneGrad(W*0.31,H*0.76,W*0.38,H*0.14);
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
            // Rundturm mit hölzernem Wehrgang (Hurde) oben
            towerRound(W*0.5,H*0.9,W*0.17,H*0.62,0,'zinnen');
            // Hurde: auskragender Holzkasten
            g.fillStyle='#8a6842';
            rr(g,W*0.26,H*0.24,W*0.48,H*0.12,2); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
            g.strokeStyle='rgba(60,40,20,0.4)'; g.lineWidth=1;
            for(let k=1;k<6;k++){ g.beginPath(); g.moveTo(W*0.26+k*W*0.08,H*0.245); g.lineTo(W*0.26+k*W*0.08,H*0.355); g.stroke(); }
            // Stützstreben
            g.strokeStyle='#6d4f2e'; g.lineWidth=2;
            g.beginPath();
            g.moveTo(W*0.3,H*0.36); g.lineTo(W*0.37,H*0.44);
            g.moveTo(W*0.7,H*0.36); g.lineTo(W*0.63,H*0.44);
            g.stroke();
            // Pultdach der Hurde
            g.fillStyle=pcd;
            g.beginPath();
            g.moveTo(W*0.23,H*0.24); g.lineTo(W*0.5,H*0.15); g.lineTo(W*0.77,H*0.24);
            g.closePath(); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
            window_(W*0.45,H*0.28,7,8,true);
            heraldShield(W*0.5,H*0.6,1);
            door(W*0.43,H*0.74,10,14);
            banner(W*0.5,H*0.04,13);
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
          if(type==='tithebarn'){
            // Zehntscheune: mächtiges Strohdach, niedrige Wände, großes Tor, Säcke
            wallGrad(W*0.1,H*0.6,W*0.72,H*0.26,'#dcc79a','#bda275');
            timber(W*0.1,H*0.6,W*0.72,H*0.26);
            thatch(W*0.1,H*0.6,W*0.72,H*0.4,7);
            g.fillStyle='#5d4028'; rr(g,W*0.34,H*0.66,W*0.24,H*0.2,2); g.fill();
            g.strokeStyle='#8a6b43'; g.lineWidth=1.4; g.stroke();
            g.beginPath(); g.moveTo(W*0.34,H*0.66); g.lineTo(W*0.58,H*0.86);
            g.moveTo(W*0.58,H*0.66); g.lineTo(W*0.34,H*0.86); g.stroke();
            // Kornsäcke
            for(const [sx2,sy2] of [[0.16,0.82],[0.24,0.84],[0.72,0.83]]){
              g.fillStyle='#d9bb84';
              g.beginPath(); g.ellipse(W*sx2,H*sy2,4.4,5.4,0,0,7); g.fill();
              g.strokeStyle=OUT; g.lineWidth=1; g.stroke();
              g.strokeStyle='#8a6b43'; g.lineWidth=1.2;
              g.beginPath(); g.moveTo(W*sx2-2,H*sy2-5); g.lineTo(W*sx2+2,H*sy2-5); g.stroke();
            }
            banner(W*0.18,H*0.42,10);
            break;
          }
          // mittlere Häuser: Wandstil + Dachfarbe je Handwerk (mehr Vielfalt)
          const ROOFC={ sawmill:'#8f6a3f', bakery:'#c05a3a', butcher:'#a34a52',
            brewery:'#8f6a3f', smelter:'#707a88', mint:'#606b7d', armory:'#5f6a78' };
          const mRoof=ROOFC[type]||roofC;
          if(type==='smelter'||type==='mint'||type==='armory'){
            stoneGrad(W*0.14,H*0.46,W*0.6,H*0.4);
          } else if(type==='bakery'||type==='butcher'){
            plaster(W*0.14,H*0.46,W*0.6,H*0.4);
          } else {
            wallGrad(W*0.14,H*0.46,W*0.6,H*0.4);
            timber(W*0.14,H*0.46,W*0.6,H*0.4);
          }
          roofGable(W*0.14,H*0.46,W*0.6,H*0.26,mRoof);
          window_(W*0.2,H*0.56); door(W*0.36,H*0.68,10,15);
          banner(W*0.2,H*0.28,10);
          if(type==='smelter'||type==='mint'||type==='armory'||type==='bakery'){
            chimney(W*0.72,H*0.44,16);
            if(type==='smelter'){
              g.fillStyle='rgba(255,120,40,0.8)'; g.fillRect(W*0.2,H*0.79,8,6);
              g.fillStyle='rgba(255,160,60,0.3)'; g.fillRect(W*0.18,H*0.76,12,10);
            }
          }
          if(type==='bakery'){
            // Kuppel-Backofen neben dem Haus
            g.fillStyle='#b5a48c';
            g.beginPath(); g.arc(W*0.85,H*0.82,8.6,Math.PI,0); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
            g.fillStyle='#2c2018';
            g.beginPath(); g.arc(W*0.85,H*0.82,4,Math.PI,0); g.fill();
            g.fillStyle='rgba(255,150,60,0.7)';
            g.beginPath(); g.arc(W*0.85,H*0.82,2.4,Math.PI,0); g.fill();
          }
          if(type==='butcher'){
            // Wurstkette unter der Traufe (kleiner Spaß)
            g.strokeStyle='rgba(70,50,35,0.8)'; g.lineWidth=1;
            g.beginPath(); g.moveTo(W*0.4,H*0.5); g.quadraticCurveTo(W*0.55,H*0.56,W*0.7,H*0.5); g.stroke();
            g.fillStyle='#a34a3f';
            for(const fx4 of [0.45,0.52,0.59,0.66]){
              g.beginPath(); g.ellipse(W*fx4,H*0.535,2.1,3.4,0.25,0,7); g.fill();
              g.strokeStyle='rgba(60,25,18,0.5)'; g.lineWidth=0.7; g.stroke();
            }
          }
          if(type==='sawmill'){
            // Stämme-Rampe an der Seite
            g.strokeStyle='#8a6238'; g.lineWidth=3.2;
            g.beginPath(); g.moveTo(W*0.78,H*0.86); g.lineTo(W*0.95,H*0.6); g.stroke();
            g.fillStyle='#8a5f33';
            g.beginPath(); g.ellipse(W*0.88,H*0.71,7,3,-1,0,7); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1; g.stroke();
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
          if(type==='barracks'){
            // Holzpalisade mit Hütte – früher Militärposten
            // Hütte hinten
            wallGrad(W*0.3,H*0.4,W*0.4,H*0.24,'#d9c39a','#b39a70');
            thatch(W*0.3,H*0.4,W*0.4,H*0.18,4);
            // Palisadenring: angespitzte Stämme
            for(let k=0;k<9;k++){
              const px2=W*0.12+k*W*0.095;
              const hh=H*0.26+((k*37)%3)*2;
              const gr2=g.createLinearGradient(px2,0,px2+W*0.075,0);
              gr2.addColorStop(0,'#a8845a'); gr2.addColorStop(1,'#7a5b35');
              g.fillStyle=gr2;
              g.beginPath();
              g.moveTo(px2,H*0.88); g.lineTo(px2,H*0.88-hh);
              g.lineTo(px2+W*0.038,H*0.88-hh-6); g.lineTo(px2+W*0.075,H*0.88-hh);
              g.lineTo(px2+W*0.075,H*0.88);
              g.closePath(); g.fill();
              g.strokeStyle=OUT; g.lineWidth=1.1; g.stroke();
            }
            // Toröffnung
            g.fillStyle='#2e2318'; g.fillRect(W*0.44,H*0.66,W*0.13,H*0.22);
            heraldShield(W*0.5,H*0.58,0.9);
            banner(W*0.5,H*0.12,13);
            break;
          }
          if(type==='guardhouse'){
            // steinernes Turmhaus, zwei Geschosse, Zinnenkranz
            stoneGrad(W*0.26,H*0.3,W*0.48,H*0.58);
            g.fillStyle='#c6c1b4';
            for(let k=0;k<4;k++){
              g.fillRect(W*0.27+k*W*0.12,H*0.22,W*0.07,8);
              g.strokeStyle=OUT; g.lineWidth=0.9; g.strokeRect(W*0.27+k*W*0.12,H*0.22,W*0.07,8);
            }
            g.fillStyle='rgba(40,30,20,0.18)'; g.fillRect(W*0.27,H*0.3,W*0.46,3.4);
            window_(W*0.34,H*0.4,6.5,8,true);
            g.fillStyle='#22303e'; g.fillRect(W*0.58,H*0.42,3,7); // Scharte
            door(W*0.42,H*0.72,11,15);
            heraldShield(W*0.63,H*0.62,0.9);
            banner(W*0.5,H*0.08,13);
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
          if(type==='chapel'){
            // kleine romanische Kapelle mit Apsis und Glockengiebel
            stoneGrad(W*0.24,H*0.46,W*0.44,H*0.4);
            // Apsis (halbrund, rechts)
            g.fillStyle='#b5afa2';
            g.beginPath();
            g.moveTo(W*0.68,H*0.52); g.quadraticCurveTo(W*0.84,H*0.66,W*0.68,H*0.86);
            g.closePath(); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
            g.fillStyle='#8f897b';
            g.beginPath();
            g.moveTo(W*0.66,H*0.52); g.quadraticCurveTo(W*0.86,H*0.5,W*0.8,H*0.6);
            g.quadraticCurveTo(W*0.74,H*0.54,W*0.66,H*0.55);
            g.closePath(); g.fill();
            // steiles Satteldach
            roofGable(W*0.24,H*0.46,W*0.44,H*0.3,'#7d8896',4);
            // Glockengiebel mit Glöckchen
            stoneGrad(W*0.4,H*0.08,W*0.12,H*0.14);
            g.fillStyle='#2c2620';
            g.beginPath(); g.arc(W*0.46,H*0.14,3.4,0,7); g.fill();
            g.fillStyle='#e8c258';
            g.beginPath();
            g.moveTo(W*0.44,H*0.115); g.quadraticCurveTo(W*0.46,H*0.09,W*0.48,H*0.115);
            g.lineTo(W*0.485,H*0.155); g.lineTo(W*0.435,H*0.155);
            g.closePath(); g.fill();
            // Rundfenster (Rosette)
            g.fillStyle='#ffd98a'; g.beginPath(); g.arc(W*0.46,H*0.36,3.6,0,7); g.fill();
            g.strokeStyle='#8a6b43'; g.lineWidth=1.2; g.stroke();
            g.beginPath(); g.moveTo(W*0.46-3.6,H*0.36); g.lineTo(W*0.46+3.6,H*0.36);
            g.moveTo(W*0.46,H*0.36-3.6); g.lineTo(W*0.46,H*0.36+3.6); g.stroke();
            door(W*0.41,H*0.7,9,14);
            break;
          }
          if(type==='fisher'){
            // Fischerhütte auf Stelzen mit Trockenleine
            g.strokeStyle='#6d4f2e'; g.lineWidth=2.6;   // Stelzen
            g.beginPath();
            g.moveTo(W*0.24,H*0.86); g.lineTo(W*0.24,H*0.74);
            g.moveTo(W*0.44,H*0.87); g.lineTo(W*0.44,H*0.74);
            g.moveTo(W*0.64,H*0.86); g.lineTo(W*0.64,H*0.74);
            g.stroke();
            logWall(W*0.18,H*0.46,W*0.52,H*0.3);
            thatch(W*0.18,H*0.46,W*0.52,H*0.24,5);
            window_(W*0.28,H*0.53,6,7.5); door(W*0.48,H*0.6,8,13);
            // Steg-Brettchen
            g.fillStyle='#8a6b43'; g.fillRect(W*0.16,H*0.75,W*0.56,3.4);
            g.strokeStyle=OUT; g.lineWidth=1; g.strokeRect(W*0.16,H*0.75,W*0.56,3.4);
            // Trockenleine mit Fischen (kleiner Spaß)
            g.strokeStyle='#5d452a'; g.lineWidth=1.6;
            g.beginPath(); g.moveTo(W*0.72,H*0.84); g.lineTo(W*0.72,H*0.5); g.stroke();
            g.strokeStyle='rgba(70,60,45,0.8)'; g.lineWidth=1;
            g.beginPath(); g.moveTo(W*0.7,H*0.52); g.quadraticCurveTo(W*0.86,H*0.56,W*0.98,H*0.5); g.stroke();
            g.fillStyle='#7db3cf';
            for(const fx3 of [0.78,0.88]){
              g.beginPath(); g.ellipse(W*fx3,H*0.585,3.6,1.7,1.35,0,7); g.fill();
              g.beginPath(); g.moveTo(W*fx3-1,H*0.62); g.lineTo(W*fx3-2.6,H*0.655); g.lineTo(W*fx3+0.8,H*0.645); g.closePath(); g.fill();
            }
            banner(W*0.24,H*0.28,9);
            break;
          }
          // kleine Häuser: Wandstil je nach Beruf
          if(type==='woodcutter'||type==='forester'||type==='hunter'){
            logWall(W*0.18,H*0.54,W*0.6,H*0.32);          // Blockhütte der Waldleute
          } else if(type==='quarry'){
            stoneGrad(W*0.18,H*0.54,W*0.6,H*0.32);        // Steinhütte des Steinmetz
          } else {
            wallGrad(W*0.18,H*0.54,W*0.6,H*0.32);
            timber(W*0.18,H*0.54,W*0.6,H*0.32);
          }
          thatch(W*0.18,H*0.54,W*0.6,H*0.26,5);
          window_(W*0.26,H*0.6,6.5,8); door(W*0.52,H*0.7,9,13);
          banner(W*0.24,H*0.34,9);   // kleiner Besitz-Wimpel am Giebel
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
    return this.sprite(`t_${stage}_${theme}_${species}`, 56, 74, (g,W,H)=>{
      const winter=theme==='winter';
      const s= stage===1? 0.45 : stage===2? 0.72 : 1;
      g.translate(W/2, H-2);
      if(species===0){
        // Nadelbaum: schlanker Stamm, 5 hängende Astlagen mit unruhiger Kante
        g.fillStyle='#7d5a38';
        g.beginPath();
        g.moveTo(-2.6*s,0); g.lineTo(-1.4*s,-16*s); g.lineTo(1.4*s,-16*s); g.lineTo(2.6*s,0);
        g.closePath(); g.fill();
        const leaf= winter? '#548061' : '#3f8040';
        const leafD= winter? '#42664f' : '#2f6532';
        const leafL= winter? '#78a184' : '#5ba455';
        const layer=(y,w2,h2)=>{
          // dunkle Unterlage
          for(const [c,sh] of [[leafD,0],[leaf,-1.6]]){
            g.fillStyle=c;
            g.beginPath();
            g.moveTo(0,(y-h2+sh)*s);
            // rechte Seite mit "Zacken" (hängende Astspitzen)
            g.quadraticCurveTo(w2*0.55*s,(y-h2*0.5+sh)*s, w2*0.72*s,(y-2+sh)*s);
            g.quadraticCurveTo(w2*0.8*s,(y+1.5+sh)*s, w2*s,(y+sh)*s);
            g.quadraticCurveTo(w2*0.5*s,(y+3+sh)*s, 0,(y+3+sh)*s);
            g.quadraticCurveTo(-w2*0.5*s,(y+3+sh)*s, -w2*s,(y+sh)*s);
            g.quadraticCurveTo(-w2*0.8*s,(y+1.5+sh)*s, -w2*0.72*s,(y-2+sh)*s);
            g.quadraticCurveTo(-w2*0.55*s,(y-h2*0.5+sh)*s, 0,(y-h2+sh)*s);
            g.closePath(); g.fill();
          }
        };
        layer(-8, 19, 14);
        layer(-18, 16, 13);
        layer(-28, 13, 12);
        layer(-38, 10, 11);
        layer(-47, 6.6, 10);
        // Lichtkante links
        g.strokeStyle='rgba(200,235,180,0.4)'; g.lineWidth=1.4;
        g.beginPath();
        g.moveTo(-1*s,-56*s); g.quadraticCurveTo(-9*s,-40*s,-13*s,-30*s);
        g.stroke();
        g.fillStyle=leafL;
        g.beginPath(); g.arc(-4*s,-44*s,2.6*s,0,7); g.arc(-7*s,-33*s,2.2*s,0,7); g.arc(-10*s,-22*s,2.4*s,0,7); g.fill();
        if(winter){
          g.fillStyle='rgba(244,248,252,0.95)';
          g.beginPath(); g.ellipse(0,-53*s,4*s,2.4*s,0,0,7); g.fill();
          g.beginPath(); g.ellipse(-6*s,-30*s,7*s,2.4*s,0.25,0,7); g.fill();
          g.beginPath(); g.ellipse(7*s,-19*s,8*s,2.6*s,-0.2,0,7); g.fill();
        }
      } else {
        // Laubbaum (species 1 = grün, 2 = Herbst in Amber/Rost)
        const autumn=species===2;
        g.fillStyle='#7d5a38';
        g.beginPath();
        g.moveTo(-3.4*s,0);
        g.quadraticCurveTo(-2*s,-10*s,-2.6*s,-20*s);   // Stamm
        g.lineTo(-0.6*s,-22*s);
        g.lineTo(0.8*s,-20*s);
        g.quadraticCurveTo(2*s,-10*s,3.4*s,0);
        g.closePath(); g.fill();
        g.strokeStyle='#7d5a38'; g.lineWidth=2.2*s;    // Astgabeln
        g.beginPath();
        g.moveTo(-1*s,-19*s); g.quadraticCurveTo(-7*s,-24*s,-10*s,-28*s);
        g.moveTo(0.4*s,-19*s); g.quadraticCurveTo(6*s,-25*s,9*s,-29*s);
        g.stroke();
        // Kronen-Lappen (unregelmäßig, wie echte Baumkrone)
        const lobes=[
          [0,-42,13],[ -11,-36,10],[11,-35,10],[ -6,-47,9],[7,-46,9],[0,-30,11],[-14,-28,7.5],[14,-27,7.5],
        ];
        const leaf= winter? '#7fa072' : autumn? '#c08a42' : '#5c9c4c';
        const leafD= winter? '#617f58' : autumn? '#96622c' : '#47793a';
        const leafL= winter? '#a2bd92' : autumn? '#dcab60' : '#7fb968';
        // dunkle Silhouette
        g.fillStyle=leafD;
        g.beginPath();
        for(const [lx,ly,lr] of lobes){ g.moveTo((lx+lr+1.5)*s,ly*s); g.arc(lx*s,ly*s,(lr+1.5)*s,0,7); }
        g.fill();
        // Hauptton
        g.fillStyle=leaf;
        g.beginPath();
        for(const [lx,ly,lr] of lobes){ g.moveTo((lx+lr-0.6)*s,(ly-1)*s); g.arc((lx-0.8)*s,(ly-1.2)*s,(lr-0.6)*s,0,7); }
        g.fill();
        // Formschatten unten rechts
        g.fillStyle=autumn?'rgba(90,50,15,0.3)':'rgba(30,70,25,0.3)';
        g.beginPath();
        g.arc(8*s,-28*s,9*s,0,7); g.arc(3*s,-33*s,8*s,0,7);
        g.fill();
        // Blattbüschel-Highlights oben links (kleine Kreisgruppen)
        g.fillStyle=leafL;
        for(const [hx,hy,hr] of [[-8,-48,3.4],[-4,-51,2.8],[-13,-40,3],[-16,-33,2.6],[-2,-44,2.4],[4,-50,2.6],[-9,-31,2.2]]){
          g.beginPath(); g.arc(hx*s,hy*s,hr*s,0,7); g.fill();
        }
        g.fillStyle=autumn?'rgba(245,215,150,0.6)':'rgba(225,245,195,0.6)';
        for(const [hx,hy,hr] of [[-9,-49,1.6],[-14,-41,1.4],[-3,-52,1.3]]){
          g.beginPath(); g.arc(hx*s,hy*s,hr*s,0,7); g.fill();
        }
        // vereinzelte Blatt-Tupfer an der Kronenkante
        g.fillStyle=leaf;
        for(const [hx,hy] of [[-17,-24],[17,-23],[0,-55],[12,-44],[-13,-49]]){
          g.beginPath(); g.arc(hx*s,hy*s,1.8*s,0,7); g.fill();
        }
      }
    });
  }
  // kleine Wiesen-Deko: Blümchen, Grasbüschel, Kiesel (rein dekorativ)
  drawDoodad(g, m, i){
    const t=m.terr[i];
    if(t!==TER.GRASS && t!==TER.DESERT) return;
    const h=hash01(i*13+5);
    if(h>0.24) return;
    const [x,y]=m.worldPos(i);
    const h2=hash01(i*29+11);
    const ox=(h2-0.5)*22, oy=(hash01(i*31+7)-0.5)*16;
    if(t===TER.DESERT){
      if(h<0.1){ // Steinchen
        g.fillStyle='rgba(150,135,105,0.7)';
        g.beginPath(); g.arc(x+ox,y+oy,2.2,0,7); g.arc(x+ox+4,y+oy+1.6,1.6,0,7); g.fill();
      } else { // trockenes Büschel
        g.strokeStyle='rgba(150,140,90,0.8)'; g.lineWidth=1.4;
        for(let k=-1;k<=1;k++){ g.beginPath(); g.moveTo(x+ox+k*2,y+oy); g.quadraticCurveTo(x+ox+k*3,y+oy-4,x+ox+k*4.5,y+oy-6); g.stroke(); }
      }
      return;
    }
    if(h<0.075){ // Blümchen
      const cols=['#ffffff','#ffd9e8','#ffe08a','#cfe0ff'];
      const c=cols[(hash01(i*7+3)*cols.length)|0];
      g.strokeStyle='rgba(60,110,55,0.8)'; g.lineWidth=1.2;
      g.beginPath(); g.moveTo(x+ox,y+oy); g.lineTo(x+ox,y+oy-4.6); g.stroke();
      g.fillStyle=c;
      for(let k=0;k<5;k++){
        const a=k/5*6.28;
        g.beginPath(); g.arc(x+ox+Math.cos(a)*2.1, y+oy-4.6+Math.sin(a)*2.1, 1.4, 0, 7); g.fill();
      }
      g.fillStyle='#f2c94c'; g.beginPath(); g.arc(x+ox,y+oy-4.6,1.2,0,7); g.fill();
    } else if(h<0.105){ // Pilz
      g.fillStyle='#efe6d2';
      g.fillRect(x+ox-1.1,y+oy-3.6,2.2,3.6);
      g.fillStyle='#c05a3a';
      g.beginPath(); g.arc(x+ox,y+oy-3.6,3,Math.PI,0); g.fill();
      g.strokeStyle='rgba(80,40,25,0.5)'; g.lineWidth=0.8; g.stroke();
      g.fillStyle='rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(x+ox-1.2,y+oy-4.6,0.6,0,7); g.arc(x+ox+1,y+oy-5,0.5,0,7); g.fill();
    } else if(h<0.14){ // Beerenstrauch
      g.fillStyle='#3f7d3a';
      g.beginPath(); g.arc(x+ox,y+oy-2.5,4,0,7); g.arc(x+ox+3.4,y+oy-1.5,3,0,7); g.arc(x+ox-3.4,y+oy-1.5,3,0,7); g.fill();
      g.fillStyle='#68a552';
      g.beginPath(); g.arc(x+ox-1,y+oy-3.6,2.6,0,7); g.fill();
      g.fillStyle='#d0453a';
      g.beginPath(); g.arc(x+ox-2,y+oy-2,0.9,0,7); g.arc(x+ox+1.6,y+oy-3.2,0.9,0,7); g.arc(x+ox+3,y+oy-0.8,0.9,0,7); g.fill();
    } else if(h<0.2){ // Grasbüschel
      g.strokeStyle='rgba(62,118,52,0.75)'; g.lineWidth=1.6;
      for(let k=-1;k<=1;k++){
        g.beginPath(); g.moveTo(x+ox+k*2.2,y+oy);
        g.quadraticCurveTo(x+ox+k*3,y+oy-4.4, x+ox+k*4.6,y+oy-6.6);
        g.stroke();
      }
    } else { // Kiesel
      g.fillStyle='rgba(140,140,130,0.55)';
      g.beginPath(); g.arc(x+ox,y+oy,2,0,7); g.arc(x+ox+3.6,y+oy+1.2,1.4,0,7); g.fill();
    }
  }

  // ================= Hauptzeichnung =================
  draw(cam, ui, dtMs){
    const g=this.ctx, game=this.game, m=game.map;
    this.time+=dtMs;
    this._lastCam=cam;
    g.setTransform(this.dpr,0,0,this.dpr,0,0);
    // Hintergrund: Tiefwasser mit leichtem Verlauf
    const cols=TER_COL[this.theme]||TER_COL.gruen;
    const bg=g.createLinearGradient(0,0,0,this.vh);
    bg.addColorStop(0, shade(cols[TER.WATER],0.95));
    bg.addColorStop(1, shade(cols[TER.WATER],0.85));
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
    // sanfter Uferschaum entlang der Küste (animiert)
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=m.idx(x,y);
      if(m.terr[i]!==TER.WATER || !m.explored[i]) continue;
      const hsh=hash01(i*5+1);
      const foamA=0.16+0.14*Math.sin(this.time/800+hsh*6.28);
      if(foamA<=0.05) continue;
      for(const n of m.nbs(i)){
        if(m.terr[n]===TER.WATER) continue;
        const [px,py]=m.worldPos(i), [lx,ly]=m.worldPos(n);
        const mx=(px+lx)/2, my=(py+ly)/2;
        const dx=lx-px, dy=ly-py;
        const L=Math.hypot(dx,dy)||1;
        const tx=-dy/L, ty=dx/L;
        g.strokeStyle=`rgba(240,250,255,${foamA})`;
        g.lineWidth=2.2;
        g.beginPath();
        g.moveTo(mx-tx*12,my-ty*12);
        g.quadraticCurveTo(mx-dx*0.12, my-dy*0.12, mx+tx*12, my+ty*12);
        g.stroke();
      }
    }
    // Wiesen-Deko (nur bei näherem Zoom sichtbar sinnvoll)
    if(cam.z>=0.7){
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const i=m.idx(x,y);
        if(!m.explored[i] || m.bld[i]>=0 || m.flag[i] || (m.obj[i]&127)!==OBJ.NONE) continue;
        this.drawDoodad(g, m, i);
      }
    }
    // Territorium-Grenzen
    if(this.lastTerritoryVer!==game.territoryVer){ this.computeBorders(); this.lastTerritoryVer=game.territoryVer; }
    for(const e of this.borderEdges){
      if(e.x2<wx0||e.x1>wx1||e.y2<wy0-60||e.y1>wy1+60) continue;
      g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=3.6;
      g.beginPath(); g.moveTo(e.x1,e.y1); g.lineTo(e.x2,e.y2); g.stroke();
      g.strokeStyle=PLAYER_COLORS[e.pl]+'cc'; g.lineWidth=2;
      g.beginPath(); g.moveTo(e.x1,e.y1); g.lineTo(e.x2,e.y2); g.stroke();
    }
    // Straßen: sanft geschwungen und gepflastert
    for(const r of game.roads.values()){
      const pts=this.roadPts(r);
      const trace=()=>{
        g.beginPath();
        g.moveTo(pts[0][0],pts[0][1]);
        for(let k=1;k<pts.length-1;k++){
          const mx=(pts[k][0]+pts[k+1][0])/2, my=(pts[k][1]+pts[k+1][1])/2;
          g.quadraticCurveTo(pts[k][0],pts[k][1],mx,my);
        }
        g.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);
      };
      trace(); g.strokeStyle='rgba(92,78,60,0.6)'; g.lineWidth=9.5; g.stroke();   // Bordkante
      trace(); g.strokeStyle='#b3a68c'; g.lineWidth=7; g.stroke();                // Pflasterbett
      // Pflastersteine entlang des Weges (zwei Farbtöne, versetzt)
      if(cam.z>0.55){
        const dark=new Path2D(), light=new Path2D();
        let acc=0, idx=0;
        for(let k=0;k<pts.length-1;k++){
          const dx=pts[k+1][0]-pts[k][0], dy=pts[k+1][1]-pts[k][1];
          const L=Math.hypot(dx,dy)||1;
          const ux=dx/L, uy=dy/L, vx=-uy, vy=ux;
          for(let d2=acc; d2<L; d2+=5.6, idx++){
            const cx3=pts[k][0]+ux*d2, cy3=pts[k][1]+uy*d2;
            const side=(idx%2? 1:-1)*1.75;
            const p=(idx%3===0)? dark:light;
            p.moveTo(cx3+vx*side+1.55, cy3+vy*side);
            p.arc(cx3+vx*side, cy3+vy*side, 1.55, 0, 7);
            p.moveTo(cx3-vx*side*0.4+1.3, cy3-vy*side*0.4);
            p.arc(cx3-vx*side*0.4, cy3-vy*side*0.4, 1.3, 0, 7);
          }
          acc=(acc-L)%5.6; if(acc<0) acc+=5.6;
        }
        g.fillStyle='rgba(122,106,86,0.55)'; g.fill(dark);
        g.fillStyle='rgba(199,186,164,0.6)'; g.fill(light);
      }
      // ausgetretene Wegmitte
      trace(); g.strokeStyle='rgba(94,80,62,0.22)'; g.lineWidth=2.6; g.stroke();
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
      if(game.signs && game.signs.has(i) && m.bld[i]<0) items.push({kind:'sign', i, ore:game.signs.get(i), y:m.worldPos(i)[1]+1});
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
      else if(it.kind==='sign') this.drawSign(g, m, it.i, it.ore);
      else if(it.kind==='flag') this.drawFlag(g, m, game, it.i);
      else if(it.kind==='carrier') this.drawFigure(g, it.x, it.y, it.pl, it.carrying? it.good:null, 'carrier');
      else if(it.kind==='unit') this.drawUnit(g, it.u);
    }
    // Wolkenschatten ziehen über das Land
    const cw=m.w*TILE, chh=m.h*ROWH;
    for(let k=0;k<4;k++){
      const spd=7+k*2.6;
      let cx2=((this.time/1000*spd + k*1637) % (cw+700)) - 350;
      const cy2=((k*911)%chh) + Math.sin(this.time/8000+k*2.1)*90;
      if(cx2+320<wx0||cx2-320>wx1||cy2+220<wy0||cy2-220>wy1) continue;
      const rad=g.createRadialGradient(cx2,cy2,20,cx2,cy2,230+k*40);
      rad.addColorStop(0,'rgba(25,35,25,0.11)');
      rad.addColorStop(0.7,'rgba(25,35,25,0.07)');
      rad.addColorStop(1,'rgba(25,35,25,0)');
      g.fillStyle=rad;
      g.save();
      g.translate(cx2,cy2); g.scale(1.5,0.85);
      g.beginPath(); g.arc(0,0,230+k*40,0,7);
      g.arc(150,60,150,0,7);
      g.fill();
      g.restore();
    }
    // ziehende Nebelschwaden (Morgennebel, sehr dezent)
    for(let k=0;k<3;k++){
      const mx=((this.time/1000*(3.5+k*1.2) + k*2311) % (cw+900)) - 450;
      const my=((k*1481)%chh) + Math.sin(this.time/7000+k*1.9)*70;
      if(mx+400<wx0||mx-400>wx1||my+200<wy0||my-200>wy1) continue;
      const rad=g.createRadialGradient(mx,my,30,mx,my,300);
      rad.addColorStop(0,'rgba(238,242,246,0.055)');
      rad.addColorStop(0.6,'rgba(238,242,246,0.03)');
      rad.addColorStop(1,'rgba(238,242,246,0)');
      g.fillStyle=rad;
      g.save(); g.translate(mx,my); g.scale(1.8,0.7);
      g.beginPath(); g.arc(0,0,300,0,7); g.fill();
      g.restore();
    }
    // Vogelschwärme
    this.drawBirds(g, cw, chh, wx0, wx1, wy0, wy1);
    // Schafe (bewegte Deko)
    this.updateSheep(dtMs);
    for(const sh of this.sheep) this.drawSheep(g, sh);
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
    // Nebel des Unbekannten: Dunstsaum + dunkler Kern, leicht treibend
    if(this.time-this._fogT>600){ this._fogT=this.time; this.rebuildFog(); }
    if(this.fogDark){
      const fx=-TILE*0.5, fy=-ROWH*0.5;
      const fw=m.w*TILE, fh=m.h*ROWH;
      const drift=Math.sin(this.time/2600)*7;
      const drift2=Math.cos(this.time/3400)*5;
      g.globalAlpha=0.4; g.drawImage(this.fogMist, fx+drift, fy+drift2*0.5, fw, fh);
      g.globalAlpha=0.45; g.drawImage(this.fogMist, fx-drift2, fy-drift*0.4, fw, fh);
      g.globalAlpha=0.96; g.drawImage(this.fogDark, fx, fy, fw, fh);
      g.globalAlpha=1;
    }
    g.restore();
    // goldene Stunde: warmes Streiflicht von Nordwest, kühle Schatten im Südosten
    const sun=g.createLinearGradient(0,0,this.vw,this.vh);
    sun.addColorStop(0,'rgba(255,206,140,0.12)');
    sun.addColorStop(0.55,'rgba(255,206,140,0.02)');
    sun.addColorStop(1,'rgba(38,52,92,0.1)');
    g.fillStyle=sun;
    g.fillRect(0,0,this.vw,this.vh);
    // warmer Gesamtfarbton (painterly, keine Sterilität)
    g.globalCompositeOperation='soft-light';
    g.fillStyle='rgba(255,190,120,0.16)';
    g.fillRect(0,0,this.vw,this.vh);
    g.globalCompositeOperation='source-over';
    // Tilt-Shift: weiche Unschärfebänder oben/unten -> Diorama-Gefühl
    if('filter' in g){
      const dpr=this.dpr, band=Math.round(this.vh*0.14);
      g.save();
      g.filter='blur(2.4px)';
      g.drawImage(this.cv, 0,0,this.cv.width,band*dpr, 0,0,this.vw,band);
      g.drawImage(this.cv, 0,this.cv.height-band*dpr,this.cv.width,band*dpr, 0,this.vh-band,this.vw,band);
      g.filter='blur(1.2px)';
      const b2=Math.round(band*0.55);
      g.drawImage(this.cv, 0,band*dpr,this.cv.width,b2*dpr, 0,band,this.vw,b2);
      g.drawImage(this.cv, 0,this.cv.height-(band+b2)*dpr,this.cv.width,b2*dpr, 0,this.vh-band-b2,this.vw,b2);
      g.restore();
    }
    // Vignette (Bildschirmraum)
    if(this.vignette) g.drawImage(this.vignette,0,0);
  }
  // Straßenpunkte mit dezentem Versatz (Enden/Fahnen bleiben exakt)
  roadPts(r){
    const m=this.game.map;
    return r.path.map((n,ix)=>{
      const [x,y]=m.worldPos(n);
      if(ix===0 || ix===r.path.length-1 || m.flag[n]) return [x,y];
      return [x+(hash01(n*3+1)-0.5)*6, y+(hash01(n*5+2)-0.5)*5];
    });
  }
  roadPos(r, pos){
    const pts=this.roadPts(r);
    const i0=Math.max(0,Math.min(pts.length-1,Math.floor(pos))), f=pos-Math.floor(pos);
    const a=pts[i0], b=pts[Math.min(i0+1,pts.length-1)];
    return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f];
  }
  drawObj(g, m, i, o){
    const [x,y]=m.worldPos(i);
    switch(o){
      case OBJ.SAPLING: case OBJ.TREE2: case OBJ.TREE: {
        const st=o===OBJ.SAPLING?1:o===OBJ.TREE2?2:3;
        const hsh=hash01(i);
        // Nadel / Laub grün / Laub herbstlich (Amber & Rost, nur außerhalb des Winters)
        const species=hsh<0.5?0: (hsh<0.86||this.theme==='winter')?1:2;
        const sc=0.85+hash01(i*7+1)*0.3;
        // Asset-Überschreibung (Stilguide §14): tree_conifer/tree_leaf/tree_autumn.png
        const ovT=this.asset(species===0?'tree_conifer':species===2?'tree_autumn':'tree_leaf');
        const grow=st===3?1:st===2?0.72:0.45;
        const s=ovT?null:this.treeSprite(st,this.theme,species);
        const h=74*sc*(ovT?grow:1);
        const w=ovT? h*(ovT.naturalWidth/ovT.naturalHeight) : 56*sc;
        this.shadow(g,x+8*sc,y+2, 16*sc*(st/3), 4.2*sc, 0.2);
        // Wind: Krone schwingt (Scherung, Fußpunkt bleibt fest)
        const sway=Math.sin(this.time/1150 + i*0.73)*0.05 + Math.sin(this.time/451 + i*1.7)*0.013;
        g.save();
        g.translate(x, y+4);
        g.transform(1,0,sway,1,0,0);
        if(ovT) g.drawImage(ovT, -w/2, -h, w, h);
        else g.drawImage(s.cv, -w/2, -h, w, h);
        g.restore();
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
    // festgetretener Boden unter dem Gebäude (verankert es in der Welt)
    g.fillStyle='rgba(128,104,70,0.2)';
    g.beginPath(); g.ellipse(x,y+2, big?36:def.size==='M'?29:23, big?11:9, 0, 0, 7); g.fill();
    // goldene Stunde: lange, weiche Schatten nach Südost
    this.shadow(g,x+11,y+5, big?40:def.size==='M'?32:25, big?9:7, 0.24);
    // Asset-Überschreibung (Stilguide §14): bld_<typ>.png bzw. bld_<typ>_build.png
    const ov=this.asset(b.state==='build' ? 'bld_'+b.type+'_build' : 'bld_'+b.type)
      || (b.state==='build' ? this.asset('bld_baustelle') : null);
    if(ov){
      const hh=big?96:def.size==='M'?80:64;
      const ww=hh*(ov.naturalWidth/ov.naturalHeight);
      g.drawImage(ov, x-ww/2, y-hh+10, ww, hh);
    } else {
      g.drawImage(s.cv, x-s.w/2, y-s.h+10, s.w, s.h);
    }
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
    // "Zzz" über Arbeitern ohne Aufgabe (schläft ein – und zeigt: hier fehlt Nachschub)
    if(b.state==='done' && b.worker && b.worker.present && b.worker.state==='in'
       && b.worker.timer > (BLD[b.type].time||100)*3){
      const ph=(this.time/900+b.id)%1;
      g.font='bold 10px Georgia,serif';
      g.fillStyle=`rgba(240,245,255,${0.75-ph*0.4})`;
      g.fillText('z', x+14, y-38-ph*8);
      g.font='bold 13px Georgia,serif';
      g.fillText('Z', x+19, y-44-ph*10);
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
    // wehender Ritter-Wimpel mit Schwalbenschwanz
    const col=pl>=0?PLAYER_COLORS[pl]:'#999';
    const w1=Math.sin(this.time/260+i)*1.8, w2=Math.sin(this.time/260+i+1.4)*2.6;
    g.fillStyle=col;
    g.beginPath();
    g.moveTo(x,y-19);
    g.quadraticCurveTo(x+7,y-20+w1, x+14,y-17.6+w2);   // Oberkante
    g.lineTo(x+9.5,y-15.6+w2*0.8);                      // Kerbe innen
    g.lineTo(x+14,y-13+w2*0.7);                         // untere Spitze
    g.quadraticCurveTo(x+7,y-14.4+w1, x,y-12);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(30,20,10,0.5)'; g.lineWidth=1.1; g.stroke();
    g.fillStyle='rgba(255,255,255,0.25)';
    g.beginPath();
    g.moveTo(x,y-19); g.quadraticCurveTo(x+7,y-20+w1, x+14,y-17.6+w2);
    g.lineTo(x+13,y-16.6+w2); g.quadraticCurveTo(x+6.5,y-18.6+w1,x,y-17.4);
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
    if(u.type==='geo'){ this.drawFigure(g,u.x,u.y,u.player,null,'worker',0,'geo'); return; }
    this.drawFigure(g, u.x, u.y, u.player, u.carry||null, 'worker', 0, u.wtype);
  }
  // Erzschild des Geologen (Holzpfahl mit Symbolscheibe)
  drawSign(g, m, i, ore){
    const [x,y]=m.worldPos(i);
    this.shadow(g,x+1,y+1.4,4,1.6,0.25);
    g.strokeStyle='#5d452a'; g.lineWidth=2.2;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-12); g.stroke();
    g.fillStyle='#c9a05a';
    g.beginPath(); g.arc(x,y-14.5,5,0,7); g.fill();
    g.strokeStyle='rgba(60,40,20,0.6)'; g.lineWidth=1.2; g.stroke();
    const oc=['#a8a29a','#31312e','#b3705a','#e8c258','#84807a'][ore]||'#a8a29a';
    if(ore===0){
      g.strokeStyle='#8a8478'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(x-2.4,y-14.5); g.lineTo(x+2.4,y-14.5); g.stroke();
    } else {
      g.fillStyle=oc;
      g.beginPath(); g.arc(x,y-14.5,2.8,0,7); g.fill();
      g.fillStyle='rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(x-0.9,y-15.3,1,0,7); g.fill();
    }
  }
  drawFigure(g, x, y, pl, good, kind, rank=0, wtype=null){
    // Asset-Überschreibung (Stilguide §14): unit_<beruf>.png / unit_carrier.png / unit_soldier.png
    const ovU=this.asset(kind==='soldier'?'unit_soldier': kind==='carrier'?'unit_carrier':'unit_'+(wtype||'worker'));
    if(ovU){
      this.shadow(g,x,y+7.4,5.8,2.3,0.26);
      const hh=34, ww=hh*(ovU.naturalWidth/ovU.naturalHeight);
      g.drawImage(ovU, x-ww/2, y+7-hh, ww, hh);
      if(good){
        g.fillStyle=goodColor(good);
        g.fillRect(x-3.4,y-24,6.8,5.4);
        g.strokeStyle='rgba(20,15,10,0.5)'; g.lineWidth=0.9; g.strokeRect(x-3.4,y-24,6.8,5.4);
      }
      return;
    }
    const col=PLAYER_COLORS[pl]||'#888';
    // Berufs-Ausstattung: Kleidung, Kopfbedeckung, Werkzeug
    const PRO={
      geo:       {tunic:'#7d5a6b', hat:'band',    hatC:'#5a4050', tool:'pick'},
      woodcutter:{tunic:'#8a6242', hat:'cap',     hatC:'#6d4f2e', tool:'axe'},
      forester:  {tunic:'#4e7d48', hat:'cap',     hatC:'#3d6338', tool:'sapling'},
      quarry:    {tunic:'#7d7a72', hat:'band',    hatC:'#5d5a52', tool:'pick'},
      fisher:    {tunic:'#4e6d8a', hat:'straw',   hatC:'#d9bb7d', tool:'rod'},
      hunter:    {tunic:'#5d6b42', hat:'feather', hatC:'#4a5636', tool:'bow'},
      farm:      {tunic:'#a3814e', hat:'straw',   hatC:'#d9bb7d', tool:'scythe'},
    };
    const pro=kind==='worker' ? (PRO[wtype]||null) : null;
    const tunic= kind==='soldier' ? '#8a95a0' : pro? pro.tunic : '#6d5a44';
    const step=Math.sin((this.time/85)+x*0.31);
    const bob=Math.abs(step)*1.1;
    this.shadow(g,x,y+7.4,5.8,2.3,0.26);
    // Figuren etwas größer und dadurch feiner lesbar
    g.save();
    g.translate(x,y); g.scale(1.16,1.24); g.translate(-x,-y);   // leicht gestreckt = natürlicher
    y-=bob;
    // Beine mit Schuhen
    g.strokeStyle='#4a3b2c'; g.lineWidth=2.2;
    g.beginPath(); g.moveTo(x-2,y); g.lineTo(x-2+step*1.8,y+6); g.moveTo(x+2,y); g.lineTo(x+2-step*1.8,y+6); g.stroke();
    g.fillStyle='#3a2e22';
    g.beginPath(); g.ellipse(x-2+step*1.8,y+6.4,1.6,1,0,0,7); g.ellipse(x+2-step*1.8,y+6.4,1.6,1,0,0,7); g.fill();
    // hinterer Arm (schwingt gegenläufig)
    g.strokeStyle=shade(tunic,0.8); g.lineWidth=2;
    g.beginPath();
    if(good){ g.moveTo(x-3.2,y-6.5); g.quadraticCurveTo(x-4.6,y-11,x-2.6,y-14.5); }
    else { g.moveTo(x-3.2,y-6.5); g.lineTo(x-3.2-step*2,y-1.5); }
    g.stroke();
    // Körper: Kittel mit Saum
    g.fillStyle=tunic;
    g.beginPath();
    g.moveTo(x-4.2,y+1.4);
    g.quadraticCurveTo(x-4.4,y-7.5, x,y-8.6);
    g.quadraticCurveTo(x+4.4,y-7.5, x+4.2,y+1.4);
    g.quadraticCurveTo(x,y+3, x-4.2,y+1.4);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(60,40,25,0.45)'; g.lineWidth=1; g.stroke();
    g.strokeStyle='rgba(255,255,255,0.25)'; g.lineWidth=1;      // Lichtkante links
    g.beginPath(); g.moveTo(x-3.4,y); g.quadraticCurveTo(x-3.8,y-6,x-1.4,y-8); g.stroke();
    // Gürtel mit Schnalle
    g.fillStyle='#4a3826'; g.fillRect(x-4,y-3.2,8,1.8);
    g.fillStyle='#c9a05a'; g.fillRect(x-0.9,y-3.4,1.8,2.2);
    // Schärpe in Spielerfarbe
    g.fillStyle=col;
    g.fillRect(x-3.8,y-7.8,7.6,2.6);
    // vorderer Arm
    g.strokeStyle=tunic; g.lineWidth=2.1;
    g.beginPath();
    if(good){ g.moveTo(x+3.2,y-6.5); g.quadraticCurveTo(x+4.6,y-11,x+2.6,y-14.5); }
    else { g.moveTo(x+3.2,y-6.5); g.lineTo(x+3.2+step*2,y-1.5); }
    g.stroke();
    g.fillStyle='#f2cfa0';   // Hand
    g.beginPath(); g.arc(good? x+2.6 : x+3.2+step*2, good? y-14.5 : y-1.3, 1.2, 0, 7); g.fill();
    // Kopf: natürliche Proportion (Stilguide: leicht stilisiert, kein Chibi)
    g.fillStyle='#e0b98c';
    g.beginPath(); g.ellipse(x,y-11.9,3.1,3.4,0,0,7); g.fill();
    g.strokeStyle='rgba(60,40,25,0.3)'; g.lineWidth=0.8; g.stroke();
    // dezentes Gesicht
    g.fillStyle='#3a3028';
    g.beginPath(); g.arc(x-1.1,y-12,0.4,0,7); g.arc(x+1.1,y-12,0.4,0,7); g.fill();
    g.strokeStyle='rgba(120,80,55,0.4)'; g.lineWidth=0.7;
    g.beginPath(); g.moveTo(x-0.8,y-10.6); g.lineTo(x+0.8,y-10.6); g.stroke();
    // Berufswerkzeug + Kopfbedeckung
    if(pro){
      switch(pro.tool){
        case 'axe':
          g.strokeStyle='#8a6b43'; g.lineWidth=1.6;
          g.beginPath(); g.moveTo(x+4.6,y-2); g.lineTo(x+7.4,y-13); g.stroke();
          g.fillStyle='#b5bcc4';
          g.beginPath(); g.moveTo(x+6.4,y-13.6); g.quadraticCurveTo(x+10.4,y-12.4,x+8.4,y-9.6);
          g.lineTo(x+6.8,y-11.4); g.closePath(); g.fill();
          break;
        case 'pick':
          g.strokeStyle='#8a6b43'; g.lineWidth=1.6;
          g.beginPath(); g.moveTo(x+4.6,y-2); g.lineTo(x+7,y-13); g.stroke();
          g.strokeStyle='#b5bcc4'; g.lineWidth=1.8;
          g.beginPath(); g.moveTo(x+3.6,y-12.4); g.quadraticCurveTo(x+7,y-16,x+10.4,y-12.4); g.stroke();
          break;
        case 'rod':
          g.strokeStyle='#8a6b43'; g.lineWidth=1.3;
          g.beginPath(); g.moveTo(x+4.4,y-1); g.lineTo(x+9.4,y-16); g.stroke();
          g.strokeStyle='rgba(220,230,240,0.7)'; g.lineWidth=0.8;
          g.beginPath(); g.moveTo(x+9.4,y-16); g.quadraticCurveTo(x+10.4,y-11,x+9.6,y-7); g.stroke();
          break;
        case 'bow':
          g.strokeStyle='#6d4f2e'; g.lineWidth=1.6;
          g.beginPath(); g.arc(x+6.4,y-7.5,5.4,-1.2,1.2); g.stroke();
          g.strokeStyle='rgba(230,230,230,0.8)'; g.lineWidth=0.7;
          g.beginPath(); g.moveTo(x+8.4,y-12.4); g.lineTo(x+8.4,y-2.6); g.stroke();
          break;
        case 'scythe':
          g.strokeStyle='#8a6b43'; g.lineWidth=1.6;
          g.beginPath(); g.moveTo(x+4.6,y-1); g.lineTo(x+7.2,y-14); g.stroke();
          g.strokeStyle='#b5bcc4'; g.lineWidth=1.7;
          g.beginPath(); g.moveTo(x+7.2,y-14); g.quadraticCurveTo(x+12,y-13.4,x+13,y-9.6); g.stroke();
          break;
        case 'sapling':
          g.strokeStyle='#6b4a2c'; g.lineWidth=1.4;
          g.beginPath(); g.moveTo(x+5.4,y-1); g.lineTo(x+5.4,y-6.4); g.stroke();
          g.fillStyle='#5ba455';
          g.beginPath(); g.arc(x+5.4,y-8,2.6,0,7); g.fill();
          break;
      }
      if(pro.hat==='straw'){
        g.fillStyle=pro.hatC;
        g.beginPath(); g.ellipse(x,y-13.4,6,1.9,0,0,7); g.fill();
        g.strokeStyle='rgba(120,90,45,0.6)'; g.lineWidth=0.8; g.stroke();
        g.beginPath(); g.arc(x,y-13.8,3,Math.PI,0); g.fill();
      } else if(pro.hat==='cap'){
        g.fillStyle=pro.hatC;
        g.beginPath(); g.arc(x,y-12.6,4.1,Math.PI*0.95,Math.PI*2.05); g.fill();
        g.fillRect(x-4.4,y-13,5.4,1.6);
      } else if(pro.hat==='band'){
        g.fillStyle=pro.hatC; g.fillRect(x-4,y-14.2,8,1.8);
      } else if(pro.hat==='feather'){
        g.fillStyle=pro.hatC;
        g.beginPath(); g.arc(x,y-12.8,4,Math.PI,0); g.fill();
        g.strokeStyle='#d0453a'; g.lineWidth=1.3;
        g.beginPath(); g.moveTo(x+2.6,y-15); g.quadraticCurveTo(x+4.6,y-18.4,x+6,y-19); g.stroke();
      }
    }
    if(kind==='soldier'){
      // Helm + Speer + Schild
      g.fillStyle='#c2ccd6';
      g.beginPath(); g.arc(x,y-12.4,4.3,Math.PI,0); g.fill();
      rr(g,x-4.4,y-12.6,8.8,1.8,1); g.fill();
      g.strokeStyle='rgba(60,40,25,0.35)'; g.lineWidth=0.8;
      g.beginPath(); g.arc(x,y-12.4,4.3,Math.PI,0); g.stroke();
      if(rank>0){
        g.fillStyle=['#c9d2da','#8ad695','#6ab0e8','#eab35c','#e86a6a'][Math.min(rank,4)];
        g.beginPath(); g.arc(x,y-17.2,2,0,7); g.fill();
      }
      g.strokeStyle='#8a6b43'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(x+5.8,y-16.5); g.lineTo(x+5.8,y+2); g.stroke();
      g.fillStyle='#d5d5d5';
      g.beginPath(); g.moveTo(x+5.8,y-19.5); g.lineTo(x+7.4,y-16); g.lineTo(x+4.2,y-16); g.closePath(); g.fill();
      g.fillStyle=col;
      g.beginPath(); g.ellipse(x-5.8,y-4,2.8,3.8,0,0,7); g.fill();
      g.strokeStyle='rgba(255,255,255,0.4)'; g.lineWidth=1;
      g.beginPath(); g.ellipse(x-5.8,y-4,1.5,2.2,0,0,7); g.stroke();
    } else if(!pro){
      // runde Zipfelmütze in Spielerfarbe (Träger)
      g.fillStyle=mix(col,'#ffffff',0.12);
      g.beginPath();
      g.moveTo(x-4.1,y-12.2);
      g.quadraticCurveTo(x-1,y-17.6, x+2.4,y-16.4);
      g.quadraticCurveTo(x+4.6,y-15.6, x+4.1,y-12.2);
      g.quadraticCurveTo(x,y-14, x-4.1,y-12.2);
      g.closePath(); g.fill();
      g.fillStyle='#fff'; g.beginPath(); g.arc(x+2.6,y-16.6,1.2,0,7); g.fill();
    }
    if(good){
      g.fillStyle=goodColor(good);
      g.fillRect(x-3.4,y-20,6.8,5.4);
      g.fillStyle='rgba(255,255,255,0.3)'; g.fillRect(x-3.4,y-20,6.8,1.6);
      g.strokeStyle='rgba(20,15,10,0.5)'; g.lineWidth=0.9; g.strokeRect(x-3.4,y-20,6.8,5.4);
    }
    g.restore();
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
