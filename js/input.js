// Neuland – Eingabe: Touch (Pan/Pinch/Tap/Langdruck) + Maus/Mausrad.
import { clamp } from './core.js';

export function setupInput(canvas, api){
  // api: {cam, onTap(wx,wy), onLong(wx,wy), bounds()->{w,h}}
  const cam=api.cam;
  const ptrs=new Map();
  let panStart=null, pinchStart=null, moved=false, longTimer=null;
  let vx=0, vy=0, lastMove=0;

  const toWorld=(sx,sy)=>{
    const r=canvas.getBoundingClientRect();
    const x=sx-r.left, y=sy-r.top;
    return [ cam.x+(x-r.width/2)/cam.z, cam.y+(y-r.height/2)/cam.z ];
  };
  api.toWorld=toWorld;

  const clampCam=()=>{
    const b=api.bounds();
    cam.x=clamp(cam.x, -100, b.w+100);
    cam.y=clamp(cam.y, -100, b.h+100);
    cam.z=clamp(cam.z, 0.4, 4.2);
  };

  canvas.addEventListener('pointerdown',(e)=>{
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY});
    moved=false; vx=vy=0;
    if(ptrs.size===1){
      panStart={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y};
      const [wx,wy]=toWorld(e.clientX,e.clientY);
      longTimer=setTimeout(()=>{ longTimer=null; if(!moved){ api.onLong(wx,wy); ptrs.clear(); panStart=null; } },520);
    } else if(ptrs.size===2){
      clearTimeout(longTimer); longTimer=null;
      const [a,b]=[...ptrs.values()];
      pinchStart={ d:Math.hypot(a.x-b.x,a.y-b.y), z:cam.z,
        mx:(a.x+b.x)/2, my:(a.y+b.y)/2, cx:cam.x, cy:cam.y };
      panStart=null;
    }
  });
  canvas.addEventListener('pointermove',(e)=>{
    const p=ptrs.get(e.pointerId);
    if(!p) return;
    p.x=e.clientX; p.y=e.clientY;
    if(Math.hypot(p.x-p.sx,p.y-p.sy)>10){ moved=true; if(longTimer){ clearTimeout(longTimer); longTimer=null; } }
    if(ptrs.size===1 && panStart){
      const dx=(e.clientX-panStart.x)/cam.z, dy=(e.clientY-panStart.y)/cam.z;
      const nx=panStart.cx-dx, ny=panStart.cy-dy;
      const now=performance.now();
      if(now-lastMove>1){ vx=(nx-cam.x)/(now-lastMove+1)*16; vy=(ny-cam.y)/(now-lastMove+1)*16; lastMove=now; }
      cam.x=nx; cam.y=ny;
      clampCam();
    } else if(ptrs.size===2 && pinchStart){
      const [a,b]=[...ptrs.values()];
      const d=Math.hypot(a.x-b.x,a.y-b.y);
      const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
      const r=canvas.getBoundingClientRect();
      const oldZ=cam.z;
      cam.z=clamp(pinchStart.z*(d/Math.max(20,pinchStart.d)), 0.4, 4.2);
      // um Pinch-Zentrum zoomen + Pan mit zwei Fingern
      const wx=pinchStart.cx+((pinchStart.mx-r.left)-r.width/2)/pinchStart.z;
      const wy=pinchStart.cy+((pinchStart.my-r.top)-r.height/2)/pinchStart.z;
      cam.x=wx-((mx-r.left)-r.width/2)/cam.z;
      cam.y=wy-((my-r.top)-r.height/2)/cam.z;
      clampCam();
    }
  });
  const up=(e)=>{
    const p=ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if(longTimer){ clearTimeout(longTimer); longTimer=null; }
    if(ptrs.size<2) pinchStart=null;
    if(ptrs.size===0){
      if(p && !moved){
        const [wx,wy]=toWorld(e.clientX,e.clientY);
        api.onTap(wx,wy);
        vx=vy=0;
      }
      panStart=null;
    } else if(ptrs.size===1){
      const [a]=[...ptrs.values()];
      panStart={x:a.x,y:a.y,cx:cam.x,cy:cam.y};
    }
  };
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',(e)=>{
    e.preventDefault();
    const r=canvas.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    const wx=cam.x+(mx-r.width/2)/cam.z, wy=cam.y+(my-r.height/2)/cam.z;
    cam.z=clamp(cam.z*(e.deltaY<0?1.15:0.87), 0.4, 4.2);
    cam.x=wx-(mx-r.width/2)/cam.z;
    cam.y=wy-(my-r.height/2)/cam.z;
    clampCam();
  },{passive:false});

  // Trägheit
  const inertia=()=>{
    if(ptrs.size===0 && (Math.abs(vx)>0.3||Math.abs(vy)>0.3)){
      cam.x+=vx*0.016*3; cam.y+=vy*0.016*3;
      vx*=0.92; vy*=0.92;
      clampCam();
    }
    requestAnimationFrame(inertia);
  };
  inertia();
}
