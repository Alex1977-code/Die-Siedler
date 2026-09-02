// Neuland – Asset-Studio: prozedurale HD-Sprites im Painterly-Realism-Stil.
// Erzeugt alle Spiel-Assets als Canvas (Licht von links oben, 3/4-Ansicht,
// sichtbare Materialtextur, Verwitterung, Moos). Eigenständige Designs.

// ---------------- Zufall & Rauschen ----------------
function mulberry(seed){
  let a=seed>>>0;
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function noiseGen(seed){
  const r=mulberry(seed);
  const g=Float32Array.from({length:64*64},()=>r());
  const v=(x,y)=>g[((y&63)*64+(x&63))];
  const sm=(t)=>t*t*(3-2*t);
  return (x,y)=>{
    const x0=Math.floor(x),y0=Math.floor(y);
    const fx=sm(x-x0),fy=sm(y-y0);
    return (v(x0,y0)*(1-fx)+v(x0+1,y0)*fx)*(1-fy)
         + (v(x0,y0+1)*(1-fx)+v(x0+1,y0+1)*fx)*fy;
  };
}
function hex2(h){ const n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function css(c,a=1){ return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }
function mixc(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function shade(c,f){ return [Math.min(255,c[0]*f),Math.min(255,c[1]*f),Math.min(255,c[2]*f)]; }
function mk(w,h){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const g=cv.getContext('2d'); g.lineJoin='round'; g.lineCap='round'; return [cv,g]; }

// Licht: Sonne von links oben; rechte Seitenflächen kühler & dunkler
const SIDE_TINT=(c)=>mixc(shade(c,0.68),[60,70,100],0.12);
const D=26, DY=0.55;              // Pseudo-3D-Tiefe im Asset-Maßstab

// ---------------- Materialien (in geclippten Regionen malen) ----------------
function clipRun(g, pathFn, fn){
  g.save(); g.beginPath(); pathFn(); g.clip(); fn(); g.restore();
}
// Stroh: Basisverlauf + hunderte Halm-Strokes + Fransen + Moos
function matStraw(g, bb, seed, slope=0.55){
  const r=mulberry(seed), n=noiseGen(seed+1);
  const top=hex2('#e0be7c'), bot=hex2('#93713e');
  const gr=g.createLinearGradient(0,bb.y,0,bb.y+bb.h);
  gr.addColorStop(0,css(top)); gr.addColorStop(1,css(bot));
  g.fillStyle=gr; g.fillRect(bb.x,bb.y,bb.w,bb.h);
  // Wolkige Ungleichmäßigkeit
  for(let k=0;k<40;k++){
    const x=bb.x+r()*bb.w, y=bb.y+r()*bb.h;
    g.fillStyle=css(mixc(top,bot,r()), 0.08+r()*0.08);
    g.beginPath(); g.ellipse(x,y,20+r()*40,10+r()*20,r(),0,7); g.fill();
  }
  // Halme entlang der Falllinie
  const pal=['#f2d896','#d8b872','#b8934e','#8f6f3c','#6d5530'];
  for(let k=0;k<520;k++){
    const x=bb.x+r()*bb.w, y=bb.y+r()*bb.h;
    const len=14+r()*26, dx=(r()-0.5)*6;
    g.strokeStyle=css(hex2(pal[(r()*pal.length)|0]), 0.10+r()*0.14);
    g.lineWidth=0.8+r()*1.3;
    g.beginPath(); g.moveTo(x,y);
    g.quadraticCurveTo(x+dx*0.5, y+len*slope*0.6, x+dx, y+len*slope+len*0.45);
    g.stroke();
  }
  // Lichtkante oben links
  const rim=g.createLinearGradient(bb.x,bb.y,bb.x,bb.y+bb.h*0.5);
  rim.addColorStop(0,'rgba(255,240,200,0.35)'); rim.addColorStop(1,'rgba(255,240,200,0)');
  g.fillStyle=rim; g.fillRect(bb.x,bb.y,bb.w,bb.h*0.5);
}
// Schindeln: Reihen einzelner Platten mit Versatz, Schattenfugen, Flechten
function matShingle(g, bb, seed, col='#7d8896'){
  const r=mulberry(seed);
  const base=hex2(col);
  g.fillStyle=css(shade(base,0.55)); g.fillRect(bb.x,bb.y,bb.w,bb.h);
  const sh=17, sw=26;
  let row=0;
  for(let y=bb.y; y<bb.y+bb.h+sh; y+=sh*0.72, row++){
    const off=(row%2)*sw*0.5;
    for(let x=bb.x-sw+off; x<bb.x+bb.w+sw; x+=sw){
      const f=0.82+r()*0.4;
      const c=shade(base,f);
      const jx=(r()-0.5)*3, jy=(r()-0.5)*2;
      g.fillStyle=css(c);
      g.beginPath();
      g.moveTo(x+jx, y+jy);
      g.lineTo(x+sw-2+jx, y+jy);
      g.lineTo(x+sw-2+jx, y+sh*0.8+jy);
      g.quadraticCurveTo(x+sw/2+jx, y+sh+jy, x+jx, y+sh*0.8+jy);
      g.closePath(); g.fill();
      g.strokeStyle='rgba(20,25,30,0.35)'; g.lineWidth=1; g.stroke();
      g.strokeStyle='rgba(255,255,255,0.18)'; g.lineWidth=1;
      g.beginPath(); g.moveTo(x+jx+2,y+jy+1.5); g.lineTo(x+sw-4+jx,y+jy+1.5); g.stroke();
      if(r()<0.06){ // Flechten
        g.fillStyle='rgba(150,170,110,0.5)';
        g.beginPath(); g.ellipse(x+sw/2+jx, y+sh*0.4+jy, 4+r()*4, 3, r(), 0, 7); g.fill();
      }
    }
  }
}
// Naturstein: unregelmäßige Quader mit Fugen, Kantenlicht, Rissen
function matStone(g, bb, seed, warm=0){
  const r=mulberry(seed);
  const mortar=hex2('#6d675c');
  g.fillStyle=css(mortar); g.fillRect(bb.x,bb.y,bb.w,bb.h);
  const rows=Math.ceil(bb.h/22);
  for(let ry=0; ry<rows; ry++){
    let x=bb.x+((ry%2)? -14:0);
    const y=bb.y+ry*22;
    while(x<bb.x+bb.w){
      const w=26+r()*30, h=20;
      const base=mixc(hex2('#aaa398'), hex2('#c2b49a'), warm*r());
      const c=shade(base, 0.8+r()*0.42);
      const j=()=> (r()-0.5)*3;
      g.fillStyle=css(c);
      g.beginPath();
      g.moveTo(x+2+j(), y+2+j());
      g.lineTo(x+w-2+j(), y+2+j());
      g.lineTo(x+w-2+j(), y+h-1+j());
      g.lineTo(x+2+j(), y+h-1+j());
      g.closePath(); g.fill();
      // Kantenlicht oben/links, Schatten unten/rechts
      g.strokeStyle='rgba(255,250,235,0.3)'; g.lineWidth=1.4;
      g.beginPath(); g.moveTo(x+3,y+h-3); g.lineTo(x+3,y+3); g.lineTo(x+w-4,y+3); g.stroke();
      g.strokeStyle='rgba(25,22,18,0.35)'; g.lineWidth=1.4;
      g.beginPath(); g.moveTo(x+w-3,y+4); g.lineTo(x+w-3,y+h-2); g.lineTo(x+4,y+h-2); g.stroke();
      if(r()<0.12){ // Riss
        g.strokeStyle='rgba(40,36,30,0.4)'; g.lineWidth=1;
        g.beginPath(); g.moveTo(x+w*0.3,y+3); g.lineTo(x+w*0.5,y+h*0.6); g.lineTo(x+w*0.4,y+h-2); g.stroke();
      }
      x+=w;
    }
  }
  // Patina unten
  const pat=g.createLinearGradient(0,bb.y+bb.h*0.55,0,bb.y+bb.h);
  pat.addColorStop(0,'rgba(70,80,55,0)'); pat.addColorStop(1,'rgba(70,80,55,0.28)');
  g.fillStyle=pat; g.fillRect(bb.x,bb.y,bb.w,bb.h);
}
// Verputz: warmes Weiß, Flecken, feine Risse, Ausbrüche am Sockel
function matPlaster(g, bb, seed){
  const r=mulberry(seed);
  const gr=g.createLinearGradient(0,bb.y,0,bb.y+bb.h);
  gr.addColorStop(0,'#f4ecda'); gr.addColorStop(1,'#d9cbab');
  g.fillStyle=gr; g.fillRect(bb.x,bb.y,bb.w,bb.h);
  for(let k=0;k<26;k++){
    g.fillStyle=`rgba(150,130,95,${0.04+r()*0.06})`;
    g.beginPath(); g.ellipse(bb.x+r()*bb.w, bb.y+r()*bb.h, 14+r()*26, 8+r()*16, r(), 0, 7); g.fill();
  }
  for(let k=0;k<4;k++){ // feine Risse
    let x=bb.x+r()*bb.w, y=bb.y+r()*bb.h*0.5;
    g.strokeStyle='rgba(110,95,70,0.35)'; g.lineWidth=1;
    g.beginPath(); g.moveTo(x,y);
    for(let s=0;s<4;s++){ x+=(r()-0.5)*16; y+=8+r()*14; g.lineTo(x,y); }
    g.stroke();
  }
}
// Holz (Bohlen/Balken) mit Maserung
function matWood(g, bb, seed, base='#9c774a', horizontal=true){
  const r=mulberry(seed);
  const b=hex2(base);
  const step=horizontal? 20:24;
  for(let p=0; p< (horizontal? bb.h/step : bb.w/step)+1; p++){
    const c=shade(b, 0.8+r()*0.4);
    if(horizontal){
      const y=bb.y+p*step;
      g.fillStyle=css(c); g.fillRect(bb.x,y,bb.w,step);
      g.strokeStyle='rgba(40,28,16,0.45)'; g.lineWidth=1.4;
      g.beginPath(); g.moveTo(bb.x,y); g.lineTo(bb.x+bb.w,y); g.stroke();
      for(let k=0;k<5;k++){ // Maserung
        const gy=y+3+r()*(step-6);
        g.strokeStyle=`rgba(60,42,24,${0.12+r()*0.12})`; g.lineWidth=0.9;
        g.beginPath(); g.moveTo(bb.x,gy);
        g.bezierCurveTo(bb.x+bb.w*0.3,gy+(r()-0.5)*5, bb.x+bb.w*0.6,gy+(r()-0.5)*5, bb.x+bb.w,gy);
        g.stroke();
      }
      if(r()<0.5){ // Astloch
        g.fillStyle='rgba(60,42,24,0.5)';
        g.beginPath(); g.ellipse(bb.x+r()*bb.w, y+step*0.5, 2.6, 1.8, 0, 0, 7); g.fill();
      }
    } else {
      const x=bb.x+p*step;
      g.fillStyle=css(c); g.fillRect(x,bb.y,step,bb.h);
      g.strokeStyle='rgba(40,28,16,0.45)'; g.lineWidth=1.4;
      g.beginPath(); g.moveTo(x,bb.y); g.lineTo(x,bb.y+bb.h); g.stroke();
    }
  }
}
// Fachwerk-Gefache + Balken auf Putzgrund
function matTimber(g, bb, seed){
  matPlaster(g, bb, seed);
  const r=mulberry(seed+9);
  const beam=(x1,y1,x2,y2,w)=>{
    g.strokeStyle='#5d4526'; g.lineWidth=w;
    g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
    g.strokeStyle='rgba(255,230,190,0.25)'; g.lineWidth=w*0.3;
    g.beginPath(); g.moveTo(x1-w*0.25,y1); g.lineTo(x2-w*0.25,y2); g.stroke();
  };
  beam(bb.x+2,bb.y+3,bb.x+bb.w-2,bb.y+3,7);
  beam(bb.x+2,bb.y+bb.h-3,bb.x+bb.w-2,bb.y+bb.h-3,7);
  const nSeg=Math.max(2,Math.round(bb.w/90));
  for(let s=0;s<=nSeg;s++){
    const x=bb.x+3+(bb.w-6)*s/nSeg+(r()-0.5)*4;
    beam(x,bb.y+3,x+(r()-0.5)*6,bb.y+bb.h-3,6.4);
    if(s<nSeg && r()<0.8){
      const x2=bb.x+3+(bb.w-6)*(s+1)/nSeg;
      if(r()<0.5) beam(x+2,bb.y+bb.h-4,x2-2,bb.y+4,5);
      else beam(x+2,bb.y+4,x2-2,bb.y+bb.h-4,5);
    }
  }
}
// Moos auf Dachflächen
function addMoss(g, bb, seed, amount=1){
  const r=mulberry(seed+77);
  for(let k=0;k<10*amount;k++){
    const x=bb.x+r()*bb.w, y=bb.y+bb.h*(0.35+r()*0.6);
    const c=['rgba(96,124,60,','rgba(122,148,78,','rgba(78,102,50,'][(r()*3)|0];
    g.fillStyle=c+(0.25+r()*0.3)+')';
    g.beginPath(); g.ellipse(x,y,6+r()*16,4+r()*8,r()*3,0,7); g.fill();
    for(let s=0;s<6;s++){
      g.fillStyle=c+'0.5)';
      g.beginPath(); g.arc(x+(r()-0.5)*24, y+(r()-0.5)*12, 1.2+r()*1.4, 0, 7); g.fill();
    }
  }
}

// ---------------- Bauteile ----------------
function aoBase(g, x,y,w){ // weiche Bodenverdunkelung (kein Schlagschatten – macht das Spiel)
  const gr=g.createLinearGradient(0,y-16,0,y+4);
  gr.addColorStop(0,'rgba(30,24,16,0)'); gr.addColorStop(1,'rgba(30,24,16,0.28)');
  g.fillStyle=gr; g.fillRect(x,y-16,w,20);
}
function wall3d(g, x,y,w,h, mat, seed){
  // rechte Seitenfläche
  const sideC=SIDE_TINT(hex2('#cdbb97'));
  g.fillStyle=css(sideC);
  g.beginPath();
  g.moveTo(x+w,y); g.lineTo(x+w+D,y-D*DY);
  g.lineTo(x+w+D,y+h-D*DY); g.lineTo(x+w,y+h);
  g.closePath(); g.fill();
  clipRun(g, ()=>{ g.moveTo(x+w,y); g.lineTo(x+w+D,y-D*DY); g.lineTo(x+w+D,y+h-D*DY); g.lineTo(x+w,y+h); g.closePath(); }, ()=>{
    const r=mulberry(seed+5);
    for(let k=0;k<40;k++){
      g.fillStyle=`rgba(30,34,54,${0.04+r()*0.08})`;
      g.beginPath(); g.ellipse(x+w+r()*D, y+r()*h, 6, 10+r()*10, 0, 0, 7); g.fill();
    }
  });
  g.strokeStyle='rgba(40,30,18,0.6)'; g.lineWidth=2;
  g.strokeRect(x+w,y-D*DY+0.5,0.001,0.001); // noop – Kanten unten gemeinsam
  // Frontfläche mit Material
  clipRun(g, ()=>{ g.rect(x,y,w,h); }, ()=>mat(g,{x,y,w,h},seed));
  g.strokeStyle='rgba(40,30,18,0.65)'; g.lineWidth=2.4;
  g.strokeRect(x,y,w,h);
  g.beginPath();
  g.moveTo(x+w,y); g.lineTo(x+w+D,y-D*DY); g.lineTo(x+w+D,y+h-D*DY); g.lineTo(x+w,y+h);
  g.stroke();
  // Rim-Licht links
  g.strokeStyle='rgba(255,240,210,0.4)'; g.lineWidth=2;
  g.beginPath(); g.moveTo(x+1.5,y+h-2); g.lineTo(x+1.5,y+2); g.stroke();
  aoBase(g,x-6,y+h,w+D+12);
}
function roof3d(g, x,y,w, rh, over, mat, seed, wonk=0){
  const ax=x+w/2+wonk;
  // rechte Dachfläche (verschattet)
  g.fillStyle='rgba(52,54,66,1)';
  g.beginPath();
  g.moveTo(ax,y-rh); g.lineTo(ax+D,y-rh-D*DY);
  g.lineTo(x+w+over+D,y-D*DY); g.lineTo(x+w+over,y);
  g.closePath(); g.fill();
  clipRun(g, ()=>{ g.moveTo(ax,y-rh); g.lineTo(ax+D,y-rh-D*DY); g.lineTo(x+w+over+D,y-D*DY); g.lineTo(x+w+over,y); g.closePath(); }, ()=>{
    mat(g,{x:ax-10,y:y-rh-D*DY,w:(x+w+over+D)-ax+10,h:rh+D},seed+31);
    g.fillStyle='rgba(20,26,44,0.45)';
    g.fillRect(ax-10,y-rh-D*DY,(x+w+over+D)-ax+20,rh+D+20);
  });
  // Frontgiebel-Fläche
  const front=()=>{
    g.moveTo(x-over,y+1);
    g.quadraticCurveTo(x+w*0.16,y-rh*0.6, ax-4,y-rh+2);
    g.quadraticCurveTo(ax,y-rh-2, ax+4,y-rh+2);
    g.quadraticCurveTo(x+w*0.84,y-rh*0.6, x+w+over,y+1);
    g.quadraticCurveTo(x+w/2,y+6, x-over,y+1);
    g.closePath();
  };
  clipRun(g, front, ()=>mat(g,{x:x-over,y:y-rh-4,w:w+over*2,h:rh+12},seed));
  g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.6;
  g.beginPath(); front(); g.stroke();
  // Firstlicht
  g.strokeStyle='rgba(255,240,205,0.5)'; g.lineWidth=2.2;
  g.beginPath(); g.moveTo(x-over+6,y-2); g.quadraticCurveTo(x+w*0.18,y-rh*0.58, ax-3,y-rh+3); g.stroke();
  // Traufschatten auf darunterliegende Wand
  const sh=g.createLinearGradient(0,y+1,0,y+18);
  sh.addColorStop(0,'rgba(25,18,10,0.35)'); sh.addColorStop(1,'rgba(25,18,10,0)');
  g.fillStyle=sh; g.fillRect(x-over,y+1,w+over*2,18);
}
function windowRom(g, x,y,w,h, lit=true){
  g.strokeStyle='#c8bda6'; g.lineWidth=5;
  g.beginPath();
  g.moveTo(x-1,y+h); g.lineTo(x-1,y+w/2);
  g.arc(x+w/2,y+w/2,w/2+1,Math.PI,0);
  g.lineTo(x+w+1,y+h); g.stroke();
  const gr=g.createLinearGradient(0,y,0,y+h);
  if(lit){ gr.addColorStop(0,'#ffdf9a'); gr.addColorStop(1,'#c78f3f'); }
  else { gr.addColorStop(0,'#4a4438'); gr.addColorStop(1,'#2c281f'); }
  g.fillStyle=gr;
  g.beginPath();
  g.moveTo(x,y+h); g.lineTo(x,y+w/2);
  g.arc(x+w/2,y+w/2,w/2,Math.PI,0);
  g.lineTo(x+w,y+h); g.closePath(); g.fill();
  g.strokeStyle='#6d5738'; g.lineWidth=2; g.stroke();
  g.beginPath(); g.moveTo(x+w/2,y); g.lineTo(x+w/2,y+h); g.stroke();
  if(lit){
    g.fillStyle='rgba(255,215,140,0.18)';
    g.beginPath(); g.arc(x+w/2,y+h/2,w*1.3,0,7); g.fill();
  }
}
function doorRom(g, x,y,w,h){
  g.strokeStyle='#c8bda6'; g.lineWidth=6;
  g.beginPath();
  g.moveTo(x-2,y+h); g.lineTo(x-2,y+w*0.45);
  g.arc(x+w/2,y+w*0.45,w/2+2,Math.PI,0);
  g.lineTo(x+w+2,y+h); g.stroke();
  clipRun(g, ()=>{
    g.moveTo(x,y+h); g.lineTo(x,y+w*0.45);
    g.arc(x+w/2,y+w*0.45,w/2,Math.PI,0);
    g.lineTo(x+w,y+h); g.closePath();
  }, ()=> matWood(g,{x,y:y-2,w,h:h+4},(x*7+y)|0,'#6d4c2a',false));
  g.strokeStyle='rgba(30,20,10,0.7)'; g.lineWidth=2;
  g.beginPath();
  g.moveTo(x,y+h); g.lineTo(x,y+w*0.45);
  g.arc(x+w/2,y+w*0.45,w/2,Math.PI,0);
  g.lineTo(x+w,y+h); g.stroke();
  // Beschläge
  g.strokeStyle='rgba(50,50,55,0.8)'; g.lineWidth=2.4;
  g.beginPath(); g.moveTo(x+3,y+h*0.4); g.lineTo(x+w-3,y+h*0.4); g.stroke();
  g.fillStyle='#d8b872'; g.beginPath(); g.arc(x+w*0.75,y+h*0.58,2.6,0,7); g.fill();
}
function towerRound3d(g, cx, baseY, rad, h, capH, seed, cap='cone'){
  // Zylinder mit Steinringen
  clipRun(g, ()=>{
    g.moveTo(cx-rad,baseY);
    g.lineTo(cx-rad,baseY-h);
    g.quadraticCurveTo(cx,baseY-h-rad*0.3,cx+rad,baseY-h);
    g.lineTo(cx+rad,baseY);
    g.quadraticCurveTo(cx,baseY+rad*0.3,cx-rad,baseY);
    g.closePath();
  }, ()=>{
    matStone(g,{x:cx-rad,y:baseY-h-rad,w:rad*2,h:h+rad*2},seed);
    // Zylinderschattierung
    const gr=g.createLinearGradient(cx-rad,0,cx+rad,0);
    gr.addColorStop(0,'rgba(255,245,225,0.28)');
    gr.addColorStop(0.45,'rgba(255,255,255,0)');
    gr.addColorStop(1,'rgba(20,24,44,0.42)');
    g.fillStyle=gr; g.fillRect(cx-rad,baseY-h-rad,rad*2,h+rad*2);
  });
  g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.6;
  g.beginPath();
  g.moveTo(cx-rad,baseY); g.lineTo(cx-rad,baseY-h);
  g.quadraticCurveTo(cx,baseY-h-rad*0.3,cx+rad,baseY-h);
  g.lineTo(cx+rad,baseY);
  g.stroke();
  // Schießscharte
  g.fillStyle='#20262e'; g.fillRect(cx-3,baseY-h+26,6,18);
  g.strokeStyle='#c8bda6'; g.lineWidth=2; g.strokeRect(cx-3,baseY-h+26,6,18);
  if(cap==='cone'){
    const grc=g.createLinearGradient(cx-rad,0,cx+rad,0);
    grc.addColorStop(0,'#7d93ad'); grc.addColorStop(0.5,'#5d7391'); grc.addColorStop(1,'#3c4c66');
    g.fillStyle=grc;
    g.beginPath();
    g.moveTo(cx-rad-7,baseY-h);
    g.quadraticCurveTo(cx-rad*0.45,baseY-h-capH*0.55, cx,baseY-h-capH);
    g.quadraticCurveTo(cx+rad*0.45,baseY-h-capH*0.55, cx+rad+7,baseY-h);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(30,26,20,0.7)'; g.lineWidth=2.4; g.stroke();
    // Schieferlinien
    clipRun(g, ()=>{
      g.moveTo(cx-rad-7,baseY-h);
      g.quadraticCurveTo(cx-rad*0.45,baseY-h-capH*0.55, cx,baseY-h-capH);
      g.quadraticCurveTo(cx+rad*0.45,baseY-h-capH*0.55, cx+rad+7,baseY-h);
      g.closePath();
    }, ()=>{
      g.strokeStyle='rgba(20,24,34,0.3)'; g.lineWidth=1.4;
      for(let k=1;k<5;k++){
        const t=k/5;
        g.beginPath();
        g.moveTo(cx-(rad+7)*(1-t),baseY-h-capH*t*0.92);
        g.quadraticCurveTo(cx,baseY-h-capH*t*0.92+6, cx+(rad+7)*(1-t),baseY-h-capH*t*0.92);
        g.stroke();
      }
    });
    g.fillStyle='#d8b872'; g.beginPath(); g.arc(cx,baseY-h-capH-4,4,0,7); g.fill();
  } else { // Zinnen
    for(let k=-2;k<=2;k++){
      const zx=cx+k*rad*0.45;
      g.fillStyle='#b5aea1'; g.fillRect(zx-6,baseY-h-16,12,17);
      g.strokeStyle='rgba(40,30,18,0.6)'; g.lineWidth=1.8; g.strokeRect(zx-6,baseY-h-16,12,17);
      g.fillStyle='rgba(255,248,230,0.3)'; g.fillRect(zx-6,baseY-h-16,3,17);
    }
  }
}
function pennant(g, x,y,len=44){
  g.strokeStyle='#4a3822'; g.lineWidth=4;
  g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+len); g.stroke();
  g.fillStyle='#d8b872'; g.beginPath(); g.arc(x,y-2,3,0,7); g.fill();
  const grf=g.createLinearGradient(x,y,x+34,y);
  grf.addColorStop(0,'#5d7391'); grf.addColorStop(1,'#42536b');
  g.fillStyle=grf;
  g.beginPath();
  g.moveTo(x,y+2);
  g.quadraticCurveTo(x+18,y-1, x+34,y+5);
  g.lineTo(x+22,y+10);
  g.lineTo(x+34,y+16);
  g.quadraticCurveTo(x+16,y+18, x,y+16);
  g.closePath(); g.fill();
  g.strokeStyle='rgba(25,20,12,0.55)'; g.lineWidth=1.6; g.stroke();
}

// ---------------- Gebäude-Kompositionen ----------------
const BLD_DRAW = {
  woodcutter(g,W,H){ // Blockhütte, Stroh, Hackklotz & Holzstapel
    roof3d(g, W*0.2,H*0.5,W*0.55,H*0.26,18,(gg,bb,s)=>matStraw(gg,bb,s),11,3);
    wall3d(g, W*0.2,H*0.5,W*0.55,H*0.34,(gg,bb,s)=>matWood(gg,bb,s,'#a37c4c',true),12);
    windowRom(g,W*0.28,H*0.58,26,34); doorRom(g,W*0.52,H*0.62,34,74);
    // Holzstapel
    const r=mulberry(7);
    for(let k=0;k<8;k++){
      const lx=W*0.04+(k%3)*24, ly=H*0.84-Math.floor(k/3)*18;
      g.fillStyle='#8a5f33'; g.beginPath(); g.ellipse(lx+26,ly,26,9.5,0,0,7); g.fill();
      g.strokeStyle='rgba(40,25,12,0.5)'; g.lineWidth=1.6; g.stroke();
      g.fillStyle='#d8b070'; g.beginPath(); g.ellipse(lx+3,ly,5.5,8.5,0,0,7); g.fill();
      g.strokeStyle='rgba(120,80,40,0.6)'; g.lineWidth=1;
      g.beginPath(); g.arc(lx+3,ly,4-r()*2,0,7); g.stroke();
    }
    // Hackklotz mit Axt
    g.fillStyle='#7a5731'; g.fillRect(W*0.86,H*0.78,30,26);
    g.strokeStyle='rgba(40,25,12,0.6)'; g.lineWidth=2; g.strokeRect(W*0.86,H*0.78,30,26);
    g.strokeStyle='#8a6b43'; g.lineWidth=4;
    g.beginPath(); g.moveTo(W*0.9,H*0.78); g.lineTo(W*0.95,H*0.66); g.stroke();
    g.fillStyle='#b8bec6';
    g.beginPath(); g.moveTo(W*0.93,H*0.65); g.quadraticCurveTo(W*1.0,H*0.66,W*0.97,H*0.72); g.closePath(); g.fill();
    pennant(g,W*0.22,H*0.32,40);
  },
  forester(g,W,H){
    roof3d(g, W*0.22,H*0.52,W*0.5,H*0.24,16,(gg,bb,s)=>matStraw(gg,bb,s),21,-2);
    wall3d(g, W*0.22,H*0.52,W*0.5,H*0.32,(gg,bb,s)=>matWood(gg,bb,s,'#9c774a',true),22);
    windowRom(g,W*0.3,H*0.6,24,32); doorRom(g,W*0.5,H*0.63,32,70);
    // Setzling-Beet
    g.fillStyle='#6d5537'; g.fillRect(W*0.06,H*0.82,110,22);
    g.strokeStyle='rgba(40,25,12,0.6)'; g.lineWidth=2; g.strokeRect(W*0.06,H*0.82,110,22);
    for(let k=0;k<4;k++){
      const sx=W*0.09+k*26;
      g.strokeStyle='#5d8a3c'; g.lineWidth=2.6;
      g.beginPath(); g.moveTo(sx,H*0.82); g.lineTo(sx,H*0.76); g.stroke();
      g.fillStyle='#6da84a'; g.beginPath(); g.arc(sx,H*0.75,7,0,7); g.fill();
      g.fillStyle='#8fc468'; g.beginPath(); g.arc(sx-2,H*0.74,3.4,0,7); g.fill();
    }
    pennant(g,W*0.24,H*0.36,38);
  },
  quarry(g,W,H){
    roof3d(g, W*0.22,H*0.52,W*0.52,H*0.24,16,(gg,bb,s)=>matStraw(gg,bb,s),31,2);
    wall3d(g, W*0.22,H*0.52,W*0.52,H*0.32,(gg,bb,s)=>matStone(gg,bb,s,0.3),32);
    windowRom(g,W*0.3,H*0.6,24,30); doorRom(g,W*0.5,H*0.63,32,70);
    // Steinblöcke + Spitzhacke
    matStone(g,{x:W*0.04,y:H*0.76,w:80,h:44},33,0.1);
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.2; g.strokeRect(W*0.04,H*0.76,80,44);
    g.strokeStyle='#8a6b43'; g.lineWidth=4;
    g.beginPath(); g.moveTo(W*0.84,H*0.84); g.lineTo(W*0.94,H*0.66); g.stroke();
    g.strokeStyle='#aab2ba'; g.lineWidth=5;
    g.beginPath(); g.moveTo(W*0.88,H*0.63); g.quadraticCurveTo(W*0.96,H*0.62,W*1.0,H*0.68); g.stroke();
    pennant(g,W*0.24,H*0.36,38);
  },
  fisher(g,W,H){
    // Stelzen + Steg
    g.strokeStyle='#5d4526'; g.lineWidth=8;
    for(const fx of [0.3,0.5,0.7]){
      g.beginPath(); g.moveTo(W*fx,H*0.94); g.lineTo(W*fx,H*0.78); g.stroke();
    }
    matWood(g,{x:W*0.2,y:H*0.76,w:W*0.62,h:14},41,'#8f6a3f',true);
    g.strokeStyle='rgba(40,25,12,0.6)'; g.lineWidth=2; g.strokeRect(W*0.2,H*0.76,W*0.62,14);
    roof3d(g, W*0.26,H*0.46,W*0.44,H*0.22,16,(gg,bb,s)=>matStraw(gg,bb,s),42,-2);
    wall3d(g, W*0.26,H*0.46,W*0.44,H*0.3,(gg,bb,s)=>matWood(gg,bb,s,'#9c774a',true),43);
    windowRom(g,W*0.33,H*0.53,22,28); doorRom(g,W*0.5,H*0.55,30,64);
    // Netz + Trockenfische
    g.strokeStyle='rgba(200,205,190,0.6)'; g.lineWidth=1.2;
    for(let k=0;k<4;k++){
      g.beginPath(); g.moveTo(W*0.06+k*10,H*0.5); g.lineTo(W*0.12+k*10,H*0.74); g.stroke();
      g.beginPath(); g.moveTo(W*0.04,H*0.54+k*12); g.lineTo(W*0.2,H*0.56+k*12); g.stroke();
    }
    g.strokeStyle='#5d4526'; g.lineWidth=3;
    g.beginPath(); g.moveTo(W*0.78,H*0.76); g.lineTo(W*0.78,H*0.42); g.stroke();
    g.beginPath(); g.moveTo(W*0.76,H*0.44); g.quadraticCurveTo(W*0.9,H*0.48,W*0.99,H*0.43); g.stroke();
    for(const fx of [0.85,0.94]){
      const grf=g.createLinearGradient(0,H*0.47,0,H*0.55);
      grf.addColorStop(0,'#9cc0d4'); grf.addColorStop(1,'#5d8aa4');
      g.fillStyle=grf;
      g.beginPath(); g.ellipse(W*fx,H*0.51,11,4.6,1.25,0,7); g.fill();
      g.strokeStyle='rgba(30,50,60,0.5)'; g.lineWidth=1.2; g.stroke();
      g.beginPath(); g.moveTo(W*fx-2,H*0.55); g.lineTo(W*fx-5,H*0.585); g.lineTo(W*fx+2,H*0.58); g.closePath(); g.fill();
    }
    pennant(g,W*0.28,H*0.32,36);
  },
  hunter(g,W,H){
    roof3d(g, W*0.24,H*0.5,W*0.5,H*0.24,16,(gg,bb,s)=>matStraw(gg,bb,s),51,2);
    wall3d(g, W*0.24,H*0.5,W*0.5,H*0.33,(gg,bb,s)=>matWood(gg,bb,s,'#8f6a3f',true),52);
    windowRom(g,W*0.31,H*0.58,24,30); doorRom(g,W*0.51,H*0.6,32,72);
    // Geweih überm Türsturz
    g.strokeStyle='#6d5537'; g.lineWidth=4;
    g.beginPath();
    g.moveTo(W*0.56,H*0.56); g.lineTo(W*0.52,H*0.48); g.lineTo(W*0.5,H*0.44);
    g.moveTo(W*0.52,H*0.48); g.lineTo(W*0.49,H*0.47);
    g.moveTo(W*0.56,H*0.56); g.lineTo(W*0.61,H*0.48); g.lineTo(W*0.64,H*0.44);
    g.moveTo(W*0.61,H*0.48); g.lineTo(W*0.645,H*0.47);
    g.stroke();
    // Zielscheibe
    for(const [rr,c] of [[16,'#e8ddc4'],[11,'#a84a38'],[6,'#e8ddc4'],[2.6,'#3a3430']]){
      g.fillStyle=c; g.beginPath(); g.arc(W*0.1,H*0.66,rr,0,7); g.fill();
    }
    g.strokeStyle='rgba(40,30,18,0.6)'; g.lineWidth=2;
    g.beginPath(); g.arc(W*0.1,H*0.66,16,0,7); g.stroke();
    pennant(g,W*0.26,H*0.34,38);
  },
  well(g,W,H){
    // Steinring
    clipRun(g,()=>{ g.rect(W*0.3,H*0.62,W*0.4,H*0.24); },()=>matStone(g,{x:W*0.3,y:H*0.62,w:W*0.4,h:H*0.24},61,0.2));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.6; g.strokeRect(W*0.3,H*0.62,W*0.4,H*0.24);
    g.fillStyle='#16262e';
    g.beginPath(); g.ellipse(W*0.5,H*0.64,W*0.16,10,0,0,7); g.fill();
    g.fillStyle='rgba(120,180,200,0.25)';
    g.beginPath(); g.ellipse(W*0.5,H*0.645,W*0.12,6,0,0,7); g.fill();
    // Pfosten + Dach + Winde
    g.strokeStyle='#5d4526'; g.lineWidth=9;
    g.beginPath(); g.moveTo(W*0.31,H*0.62); g.lineTo(W*0.31,H*0.34); g.moveTo(W*0.69,H*0.62); g.lineTo(W*0.69,H*0.34); g.stroke();
    roof3d(g, W*0.28,H*0.34,W*0.44,H*0.14,10,(gg,bb,s)=>matShingle(gg,bb,s,'#7d8896'),62,0);
    g.strokeStyle='#6d5537'; g.lineWidth=6;
    g.beginPath(); g.moveTo(W*0.31,H*0.5); g.lineTo(W*0.69,H*0.5); g.stroke();
    g.strokeStyle='rgba(60,50,40,0.9)'; g.lineWidth=2;
    g.beginPath(); g.moveTo(W*0.5,H*0.5); g.lineTo(W*0.5,H*0.6); g.stroke();
    matWood(g,{x:W*0.45,y:H*0.58,w:34,h:18},63,'#7a5731',true);
    g.strokeStyle='rgba(40,25,12,0.7)'; g.lineWidth=2; g.strokeRect(W*0.45,H*0.58,34,18);
  },
  farm(g,W,H){
    // Langhaus mit tiefem Strohdach + Scheune + Zaun
    roof3d(g, W*0.08,H*0.56,W*0.46,H*0.3,18,(gg,bb,s)=>matStraw(gg,bb,s),71,4);
    wall3d(g, W*0.08,H*0.56,W*0.46,H*0.28,(gg,bb,s)=>matTimber(gg,bb,s),72);
    windowRom(g,W*0.15,H*0.62,26,32); doorRom(g,W*0.33,H*0.63,34,70);
    roof3d(g, W*0.6,H*0.62,W*0.3,H*0.18,12,(gg,bb,s)=>matStraw(gg,bb,s),73,-3);
    wall3d(g, W*0.6,H*0.62,W*0.3,H*0.22,(gg,bb,s)=>matWood(gg,bb,s,'#8f6a3f',true),74);
    // Scheunentor
    clipRun(g,()=>{ g.rect(W*0.66,H*0.68,W*0.16,H*0.16); },()=>matWood(g,{x:W*0.66,y:H*0.68,w:W*0.16,h:H*0.16},75,'#6d4c2a',false));
    g.strokeStyle='rgba(30,20,10,0.7)'; g.lineWidth=2.4; g.strokeRect(W*0.66,H*0.68,W*0.16,H*0.16);
    g.beginPath(); g.moveTo(W*0.66,H*0.68); g.lineTo(W*0.82,H*0.84); g.moveTo(W*0.82,H*0.68); g.lineTo(W*0.66,H*0.84); g.stroke();
    // Zaun
    g.strokeStyle='#9c8258'; g.lineWidth=5;
    g.beginPath(); g.moveTo(W*0.04,H*0.93); g.lineTo(W*0.96,H*0.93); g.stroke();
    for(let k=0;k<9;k++){
      const zx=W*0.06+k*W*0.11;
      g.beginPath(); g.moveTo(zx,H*0.89); g.lineTo(zx,H*0.97); g.stroke();
    }
    // Vogelscheuche
    g.strokeStyle='#6d5537'; g.lineWidth=5;
    g.beginPath(); g.moveTo(W*0.94,H*0.88); g.lineTo(W*0.94,H*0.6); g.stroke();
    g.lineWidth=4;
    g.beginPath(); g.moveTo(W*0.88,H*0.67); g.lineTo(W*1.0,H*0.67); g.stroke();
    g.fillStyle='#c2a24e';
    g.beginPath(); g.moveTo(W*0.9,H*0.67); g.lineTo(W*0.98,H*0.67); g.lineTo(W*0.965,H*0.8); g.lineTo(W*0.915,H*0.8); g.closePath(); g.fill();
    g.fillStyle='#e0cf9c'; g.beginPath(); g.arc(W*0.94,H*0.62,9,0,7); g.fill();
    g.fillStyle='#7a5b35'; g.beginPath(); g.ellipse(W*0.94,H*0.585,13,4,0,0,7); g.fill();
    g.beginPath(); g.arc(W*0.94,H*0.578,6.6,Math.PI,0); g.fill();
    pennant(g,W*0.1,H*0.4,40);
  },
  pigfarm(g,W,H){
    BLD_DRAW.farm(g,W,H);
    // Matschkuhle mit Schwein statt Scheunen-Ecke
    g.fillStyle='rgba(110,84,54,0.75)';
    g.beginPath(); g.ellipse(W*0.5,H*0.9,58,16,0,0,7); g.fill();
    g.fillStyle='rgba(78,58,36,0.5)';
    g.beginPath(); g.ellipse(W*0.5,H*0.9,40,10,0,0,7); g.fill();
    const grp=g.createLinearGradient(0,H*0.82,0,H*0.92);
    grp.addColorStop(0,'#e8b2a8'); grp.addColorStop(1,'#c78e84');
    g.fillStyle=grp;
    g.beginPath(); g.ellipse(W*0.5,H*0.87,26,17,0,0,7); g.fill();
    g.strokeStyle='rgba(120,70,60,0.5)'; g.lineWidth=1.6; g.stroke();
    g.fillStyle='#d89a90'; g.beginPath(); g.arc(W*0.545,H*0.855,9,0,7); g.fill();
    g.fillStyle='#b3716a'; g.beginPath(); g.ellipse(W*0.552,H*0.855,4,5,0,0,7); g.fill();
    g.fillStyle='#3a3028';
    g.beginPath(); g.arc(W*0.53,H*0.845,1.6,0,7); g.fill();
    g.strokeStyle='#d89a90'; g.lineWidth=2.6;
    g.beginPath(); g.moveTo(W*0.475,H*0.85); g.quadraticCurveTo(W*0.462,H*0.83,W*0.472,H*0.82); g.stroke();
  },
  sawmill(g,W,H){
    roof3d(g, W*0.16,H*0.5,W*0.56,H*0.26,18,(gg,bb,s)=>matShingle(gg,bb,s,'#8f6a3f'),81,3);
    wall3d(g, W*0.16,H*0.5,W*0.56,H*0.34,(gg,bb,s)=>matTimber(gg,bb,s),82);
    windowRom(g,W*0.24,H*0.58,26,32); doorRom(g,W*0.46,H*0.6,34,76);
    // Sägeblatt-Zunftzeichen
    g.fillStyle='#c8ced4'; g.beginPath(); g.arc(W*0.64,H*0.58,15,0,7); g.fill();
    g.strokeStyle='rgba(40,40,45,0.7)'; g.lineWidth=2; g.stroke();
    for(let k=0;k<10;k++){
      const a=k/10*6.28;
      g.fillStyle='#a8aeb4';
      g.beginPath();
      g.moveTo(W*0.64+Math.cos(a)*15,H*0.58+Math.sin(a)*15);
      g.lineTo(W*0.64+Math.cos(a+0.2)*19,H*0.58+Math.sin(a+0.2)*19);
      g.lineTo(W*0.64+Math.cos(a+0.35)*15,H*0.58+Math.sin(a+0.35)*15);
      g.closePath(); g.fill();
    }
    g.fillStyle='#5d5d64'; g.beginPath(); g.arc(W*0.64,H*0.58,4,0,7); g.fill();
    // Stämme-Rampe
    g.strokeStyle='#8a6238'; g.lineWidth=8;
    g.beginPath(); g.moveTo(W*0.8,H*0.9); g.lineTo(W*0.98,H*0.6); g.stroke();
    for(const [lx,ly] of [[0.86,0.76],[0.9,0.7]]){
      g.fillStyle='#8a5f33';
      g.beginPath(); g.ellipse(W*lx,H*ly,24,8,-0.5,0,7); g.fill();
      g.strokeStyle='rgba(40,25,12,0.55)'; g.lineWidth=1.6; g.stroke();
    }
    // Sägemehl
    g.fillStyle='rgba(220,190,130,0.6)';
    g.beginPath(); g.ellipse(W*0.1,H*0.88,30,10,0,0,7); g.fill();
    pennant(g,W*0.18,H*0.32,40);
  },
  mill(g,W,H){
    // Steinsockel + Turm + Galerie + Segelflügel
    clipRun(g,()=>{ g.rect(W*0.32,H*0.76,W*0.36,H*0.14); },()=>matStone(g,{x:W*0.32,y:H*0.76,w:W*0.36,h:H*0.14},91,0.2));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.6; g.strokeRect(W*0.32,H*0.76,W*0.36,H*0.14);
    clipRun(g,()=>{
      g.moveTo(W*0.35,H*0.76); g.lineTo(W*0.41,H*0.3);
      g.lineTo(W*0.59,H*0.3); g.lineTo(W*0.65,H*0.76); g.closePath();
    },()=>{
      matPlaster(g,{x:W*0.3,y:H*0.28,w:W*0.4,h:H*0.5},92);
      const gr=g.createLinearGradient(W*0.35,0,W*0.65,0);
      gr.addColorStop(0,'rgba(255,245,225,0.3)'); gr.addColorStop(0.5,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(20,24,44,0.35)');
      g.fillStyle=gr; g.fillRect(W*0.3,H*0.28,W*0.4,H*0.5);
    });
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.6;
    g.beginPath();
    g.moveTo(W*0.35,H*0.76); g.lineTo(W*0.41,H*0.3);
    g.lineTo(W*0.59,H*0.3); g.lineTo(W*0.65,H*0.76);
    g.stroke();
    // Galerie
    g.strokeStyle='#6d5537'; g.lineWidth=5;
    g.beginPath(); g.moveTo(W*0.3,H*0.62); g.lineTo(W*0.7,H*0.62); g.stroke();
    for(let k=0;k<6;k++){
      g.lineWidth=3;
      g.beginPath(); g.moveTo(W*(0.32+k*0.072),H*0.62); g.lineTo(W*(0.34+k*0.065),H*0.7); g.stroke();
    }
    windowRom(g,W*0.46,H*0.44,24,30); doorRom(g,W*0.44,H*0.66,30,52);
    // Kappe
    const grc=g.createLinearGradient(W*0.38,0,W*0.62,0);
    grc.addColorStop(0,'#7d93ad'); grc.addColorStop(1,'#42536b');
    g.fillStyle=grc;
    g.beginPath();
    g.moveTo(W*0.38,H*0.3); g.quadraticCurveTo(W*0.5,H*0.18,W*0.62,H*0.3);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(30,26,20,0.7)'; g.lineWidth=2.4; g.stroke();
    // Flügel mit Gitter + Segel
    g.save();
    g.translate(W*0.5,H*0.27);
    for(let k=0;k<4;k++){
      g.rotate(Math.PI/2);
      g.strokeStyle='#4a3822'; g.lineWidth=5;
      g.beginPath(); g.moveTo(0,0); g.lineTo(W*0.3,W*0.06); g.stroke();
      g.fillStyle='rgba(238,230,208,0.92)';
      g.beginPath();
      g.moveTo(W*0.05,W*0.005); g.lineTo(W*0.29,W*0.045);
      g.lineTo(W*0.28,W*0.1); g.lineTo(W*0.05,W*0.055);
      g.closePath(); g.fill();
      g.strokeStyle='rgba(90,70,45,0.6)'; g.lineWidth=1.6; g.stroke();
      for(let s=1;s<4;s++){
        g.beginPath(); g.moveTo(W*(0.05+s*0.06),W*0.01); g.lineTo(W*(0.05+s*0.06),W*0.085); g.stroke();
      }
    }
    g.restore();
    g.fillStyle='#3a3028'; g.beginPath(); g.arc(W*0.5,H*0.27,7,0,7); g.fill();
  },
  bakery(g,W,H){
    roof3d(g, W*0.16,H*0.5,W*0.52,H*0.26,16,(gg,bb,s)=>matShingle(gg,bb,s,'#a84a38'),101,-3);
    wall3d(g, W*0.16,H*0.5,W*0.52,H*0.34,(gg,bb,s)=>matPlaster(gg,bb,s),102);
    windowRom(g,W*0.24,H*0.58,26,32); doorRom(g,W*0.44,H*0.6,34,76);
    // Kuppel-Backofen mit Glut
    clipRun(g,()=>{ g.arc(W*0.85,H*0.82,34,Math.PI,0); g.closePath(); },
      ()=>matStone(g,{x:W*0.78-34,y:H*0.82-34,w:68,h:36},103,0.5));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.4;
    g.beginPath(); g.arc(W*0.85,H*0.82,34,Math.PI,0); g.stroke();
    g.fillStyle='#1d140c'; g.beginPath(); g.arc(W*0.85,H*0.82,15,Math.PI,0); g.fill();
    const glow=g.createRadialGradient(W*0.85,H*0.82,2,W*0.85,H*0.82,15);
    glow.addColorStop(0,'rgba(255,160,60,0.95)'); glow.addColorStop(1,'rgba(255,120,40,0)');
    g.fillStyle=glow; g.beginPath(); g.arc(W*0.85,H*0.82,15,Math.PI,0); g.fill();
    // Brezel-Ring-Zeichen
    g.strokeStyle='#c78f3f'; g.lineWidth=6;
    g.beginPath(); g.arc(W*0.6,H*0.57,12,0.5,6); g.stroke();
    pennant(g,W*0.18,H*0.32,40);
  },
  brewery(g,W,H){
    roof3d(g, W*0.16,H*0.5,W*0.54,H*0.26,16,(gg,bb,s)=>matShingle(gg,bb,s,'#8f6a3f'),111,2);
    wall3d(g, W*0.16,H*0.5,W*0.54,H*0.34,(gg,bb,s)=>matTimber(gg,bb,s),112);
    windowRom(g,W*0.24,H*0.58,26,32); doorRom(g,W*0.46,H*0.6,34,76);
    // großes Fass
    clipRun(g,()=>{ g.ellipse(W*0.84,H*0.76,24,32,0,0,7); },()=>{
      matWood(g,{x:W*0.84-24,y:H*0.76-32,w:48,h:64},113,'#8a5f33',false);
    });
    g.strokeStyle='rgba(40,25,12,0.7)'; g.lineWidth=2.4;
    g.beginPath(); g.ellipse(W*0.84,H*0.76,24,32,0,0,7); g.stroke();
    g.strokeStyle='#c2a24e'; g.lineWidth=4;
    for(const fy of [-12,10]){
      g.beginPath(); g.moveTo(W*0.84-23,H*0.76+fy); g.lineTo(W*0.84+23,H*0.76+fy); g.stroke();
    }
    pennant(g,W*0.18,H*0.32,40);
  },
  butcher(g,W,H){
    roof3d(g, W*0.16,H*0.5,W*0.54,H*0.26,16,(gg,bb,s)=>matShingle(gg,bb,s,'#8a4a52'),121,-2);
    wall3d(g, W*0.16,H*0.5,W*0.54,H*0.34,(gg,bb,s)=>matPlaster(gg,bb,s),122);
    windowRom(g,W*0.24,H*0.58,26,32); doorRom(g,W*0.46,H*0.6,34,76);
    // Wurstkette unter der Traufe
    g.strokeStyle='rgba(60,45,30,0.8)'; g.lineWidth=2;
    g.beginPath(); g.moveTo(W*0.22,H*0.55); g.quadraticCurveTo(W*0.42,H*0.62,W*0.62,H*0.55); g.stroke();
    for(let k=0;k<5;k++){
      const t=0.26+k*0.08;
      const grw=g.createLinearGradient(0,H*0.56,0,H*0.63);
      grw.addColorStop(0,'#b35a48'); grw.addColorStop(1,'#8a3c30');
      g.fillStyle=grw;
      g.beginPath(); g.ellipse(W*t,H*0.585,5.5,10,0.2,0,7); g.fill();
      g.strokeStyle='rgba(60,25,18,0.5)'; g.lineWidth=1.2; g.stroke();
    }
    pennant(g,W*0.18,H*0.32,40);
  },
  smelter(g,W,H){
    roof3d(g, W*0.14,H*0.5,W*0.5,H*0.24,16,(gg,bb,s)=>matShingle(gg,bb,s,'#707a88'),131,2);
    wall3d(g, W*0.14,H*0.5,W*0.5,H*0.34,(gg,bb,s)=>matStone(gg,bb,s,0.3),132);
    windowRom(g,W*0.22,H*0.58,26,32); doorRom(g,W*0.4,H*0.6,34,76);
    // Schmelzofen-Kamin mit Glut
    clipRun(g,()=>{ g.rect(W*0.72,H*0.36,44,H*0.48); },()=>matStone(g,{x:W*0.72,y:H*0.36,w:44,h:H*0.48},133,0.1));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.6; g.strokeRect(W*0.72,H*0.36,44,H*0.48);
    g.fillStyle='#3c3c42'; g.fillRect(W*0.7,H*0.32,52,14);
    g.fillStyle='#1d140c'; g.fillRect(W*0.755,H*0.72,26,H*0.12);
    const glow=g.createRadialGradient(W*0.785,H*0.8,2,W*0.785,H*0.8,20);
    glow.addColorStop(0,'rgba(255,150,50,0.95)'); glow.addColorStop(1,'rgba(255,110,30,0)');
    g.fillStyle=glow; g.fillRect(W*0.72,H*0.68,52,H*0.18);
    pennant(g,W*0.16,H*0.32,40);
  },
  mint(g,W,H){
    BLD_DRAW.smelter(g,W,H);
    // Münz-Zunftzeichen statt purer Glut
    const grc=g.createRadialGradient(W*0.56,H*0.57,2,W*0.56,H*0.57,14);
    grc.addColorStop(0,'#f2d896'); grc.addColorStop(1,'#c2933f');
    g.fillStyle=grc; g.beginPath(); g.arc(W*0.56,H*0.57,13,0,7); g.fill();
    g.strokeStyle='#8a6224'; g.lineWidth=2.4; g.stroke();
    g.strokeStyle='rgba(138,98,36,0.8)'; g.lineWidth=2;
    g.beginPath(); g.arc(W*0.56,H*0.57,7.5,0,7); g.stroke();
  },
  armory(g,W,H){
    roof3d(g, W*0.14,H*0.5,W*0.52,H*0.24,16,(gg,bb,s)=>matShingle(gg,bb,s,'#5f6a78'),141,-2);
    wall3d(g, W*0.14,H*0.5,W*0.52,H*0.34,(gg,bb,s)=>matStone(gg,bb,s,0.2),142);
    windowRom(g,W*0.22,H*0.58,26,32); doorRom(g,W*0.42,H*0.6,34,76);
    // Amboss auf Block + Funken
    g.fillStyle='#6d5537'; g.fillRect(W*0.8,H*0.76,38,26);
    g.strokeStyle='rgba(40,25,12,0.7)'; g.lineWidth=2; g.strokeRect(W*0.8,H*0.76,38,26);
    const gra=g.createLinearGradient(0,H*0.68,0,H*0.77);
    gra.addColorStop(0,'#8a929c'); gra.addColorStop(1,'#4c525c');
    g.fillStyle=gra;
    g.beginPath();
    g.moveTo(W*0.79,H*0.7); g.lineTo(W*0.93,H*0.7);
    g.quadraticCurveTo(W*0.97,H*0.71,W*0.96,H*0.735);
    g.lineTo(W*0.9,H*0.74); g.lineTo(W*0.9,H*0.76); g.lineTo(W*0.82,H*0.76); g.lineTo(W*0.82,H*0.74);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(25,28,34,0.7)'; g.lineWidth=1.6; g.stroke();
    g.fillStyle='rgba(255,200,90,0.9)';
    for(const [sx,sy] of [[0.86,0.66],[0.9,0.645],[0.88,0.68]]){
      g.beginPath(); g.arc(W*sx,H*sy,1.6,0,7); g.fill();
    }
    pennant(g,W*0.16,H*0.32,40);
  },
  storehouse(g,W,H){
    // Stein-EG + Fachwerk-OG + Kranbalken
    roof3d(g, W*0.12,H*0.42,W*0.6,H*0.24,18,(gg,bb,s)=>matShingle(gg,bb,s,'#8f6a3f'),151,3);
    wall3d(g, W*0.12,H*0.42,W*0.6,H*0.2,(gg,bb,s)=>matTimber(gg,bb,s),152);
    wall3d(g, W*0.12,H*0.62,W*0.6,H*0.24,(gg,bb,s)=>matStone(gg,bb,s,0.25),153);
    windowRom(g,W*0.2,H*0.46,24,28); windowRom(g,W*0.56,H*0.46,24,28);
    doorRom(g,W*0.38,H*0.68,38,84);
    // Kranbalken + Seil + Kiste
    g.strokeStyle='#5d4526'; g.lineWidth=7;
    g.beginPath(); g.moveTo(W*0.42,H*0.24); g.lineTo(W*0.58,H*0.24); g.stroke();
    g.strokeStyle='rgba(90,70,45,0.9)'; g.lineWidth=2;
    g.beginPath(); g.moveTo(W*0.58,H*0.24); g.lineTo(W*0.58,H*0.4); g.stroke();
    clipRun(g,()=>{ g.rect(W*0.545,H*0.4,36,32); },()=>matWood(g,{x:W*0.545,y:H*0.4,w:36,h:32},154,'#a37c4c',true));
    g.strokeStyle='rgba(40,25,12,0.7)'; g.lineWidth=2; g.strokeRect(W*0.545,H*0.4,36,32);
    // Kisten + Fässer + Katze
    for(const [kx,ky,ks] of [[0.06,0.78,42],[0.15,0.82,34]]){
      clipRun(g,()=>{ g.rect(W*kx,H*ky,ks,ks); },()=>matWood(g,{x:W*kx,y:H*ky,w:ks,h:ks},155+kx*10,'#a37c4c',true));
      g.strokeStyle='rgba(40,25,12,0.7)'; g.lineWidth=2.2; g.strokeRect(W*kx,H*ky,ks,ks);
      g.beginPath(); g.moveTo(W*kx,H*ky); g.lineTo(W*kx+ks,H*ky+ks); g.moveTo(W*kx+ks,H*ky); g.lineTo(W*kx,H*ky+ks); g.stroke();
    }
    g.fillStyle='#26221f';
    g.beginPath(); g.ellipse(W*0.095,H*0.745,13,9,0,0,7); g.fill();
    g.beginPath(); g.arc(W*0.125,H*0.725,8,0,7); g.fill();
    g.beginPath();
    g.moveTo(W*0.118,H*0.705); g.lineTo(W*0.122,H*0.69) ; g.lineTo(W*0.128,H*0.703);
    g.moveTo(W*0.13,H*0.702); g.lineTo(W*0.137,H*0.688); g.lineTo(W*0.14,H*0.702);
    g.fill();
    g.strokeStyle='#26221f'; g.lineWidth=3;
    g.beginPath(); g.moveTo(W*0.065,H*0.75); g.quadraticCurveTo(W*0.045,H*0.72,W*0.055,H*0.7); g.stroke();
    g.fillStyle='#7fd08a';
    g.beginPath(); g.arc(W*0.121,H*0.723,1.3,0,7); g.arc(W*0.131,H*0.723,1.3,0,7); g.fill();
    pennant(g,W*0.14,H*0.24,44);
  },
  chapel(g,W,H){
    // Steinschiff + Apsis + Glockengiebel + Rosette
    roof3d(g, W*0.24,H*0.44,W*0.4,H*0.3,12,(gg,bb,s)=>matShingle(gg,bb,s,'#7d8896'),161,0);
    wall3d(g, W*0.24,H*0.44,W*0.4,H*0.42,(gg,bb,s)=>matStone(gg,bb,s,0.35),162);
    // Apsis
    clipRun(g,()=>{
      g.moveTo(W*0.64,H*0.52); g.quadraticCurveTo(W*0.82,H*0.66,W*0.64,H*0.86); g.closePath();
    },()=>matStone(g,{x:W*0.6,y:H*0.5,w:W*0.24,h:H*0.4},163,0.35));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.4;
    g.beginPath(); g.moveTo(W*0.64,H*0.52); g.quadraticCurveTo(W*0.82,H*0.66,W*0.64,H*0.86); g.stroke();
    g.fillStyle='#5d7391';
    g.beginPath(); g.moveTo(W*0.62,H*0.52); g.quadraticCurveTo(W*0.86,H*0.5,W*0.78,H*0.62);
    g.quadraticCurveTo(W*0.72,H*0.54,W*0.62,H*0.55); g.closePath(); g.fill();
    // Glockengiebel
    clipRun(g,()=>{ g.rect(W*0.4,H*0.16,W*0.12,H*0.2); },()=>matStone(g,{x:W*0.4,y:H*0.16,w:W*0.12,h:H*0.2},164,0.35));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.4; g.strokeRect(W*0.4,H*0.16,W*0.12,H*0.2);
    g.fillStyle='#7d93ad';
    g.beginPath(); g.moveTo(W*0.385,H*0.16); g.lineTo(W*0.46,H*0.09); g.lineTo(W*0.535,H*0.16); g.closePath(); g.fill();
    g.strokeStyle='rgba(30,26,20,0.7)'; g.lineWidth=2; g.stroke();
    g.fillStyle='#20262e'; g.beginPath(); g.arc(W*0.46,H*0.26,13,0,7); g.fill();
    const grb=g.createLinearGradient(0,H*0.22,0,H*0.3);
    grb.addColorStop(0,'#e8c96a'); grb.addColorStop(1,'#a8832e');
    g.fillStyle=grb;
    g.beginPath();
    g.moveTo(W*0.445,H*0.245); g.quadraticCurveTo(W*0.46,H*0.215,W*0.475,H*0.245);
    g.lineTo(W*0.48,H*0.285); g.lineTo(W*0.44,H*0.285); g.closePath(); g.fill();
    g.fillStyle='#6d5314'; g.beginPath(); g.arc(W*0.46,H*0.292,2.4,0,7); g.fill();
    // Rosette
    g.fillStyle='#ffdf9a'; g.beginPath(); g.arc(W*0.44,H*0.53,13,0,7); g.fill();
    g.strokeStyle='#6d5738'; g.lineWidth=2.6; g.stroke();
    for(let k=0;k<6;k++){
      const a=k/6*6.28;
      g.beginPath(); g.moveTo(W*0.44,H*0.53); g.lineTo(W*0.44+Math.cos(a)*13,H*0.53+Math.sin(a)*13); g.stroke();
    }
    doorRom(g,W*0.395,H*0.7,34,66);
  },
  tithebarn(g,W,H){
    // mächtiges Strohdach über niedriger Fachwerkwand, Kornsäcke
    roof3d(g, W*0.1,H*0.56,W*0.66,H*0.4,20,(gg,bb,s)=>matStraw(gg,bb,s),171,5);
    wall3d(g, W*0.1,H*0.56,W*0.66,H*0.26,(gg,bb,s)=>matTimber(gg,bb,s),172);
    clipRun(g,()=>{ g.rect(W*0.32,H*0.62,W*0.22,H*0.2); },()=>matWood(g,{x:W*0.32,y:H*0.62,w:W*0.22,h:H*0.2},173,'#6d4c2a',false));
    g.strokeStyle='rgba(30,20,10,0.7)'; g.lineWidth=2.6; g.strokeRect(W*0.32,H*0.62,W*0.22,H*0.2);
    g.beginPath(); g.moveTo(W*0.32,H*0.62); g.lineTo(W*0.54,H*0.82); g.moveTo(W*0.54,H*0.62); g.lineTo(W*0.32,H*0.82); g.stroke();
    for(const [sx,sy] of [[0.12,0.86],[0.2,0.88],[0.82,0.87]]){
      const grs=g.createLinearGradient(0,H*(sy-0.06),0,H*(sy+0.04));
      grs.addColorStop(0,'#dcc088'); grs.addColorStop(1,'#a8905c');
      g.fillStyle=grs;
      g.beginPath(); g.ellipse(W*sx,H*sy,15,20,0,0,7); g.fill();
      g.strokeStyle='rgba(90,66,32,0.6)'; g.lineWidth=1.8; g.stroke();
      g.strokeStyle='#6d4c2a'; g.lineWidth=2.4;
      g.beginPath(); g.moveTo(W*sx-7,H*(sy-0.045)); g.lineTo(W*sx+7,H*(sy-0.045)); g.stroke();
    }
    pennant(g,W*0.12,H*0.4,42);
  },
  barracks(g,W,H){
    // Palisadenring aus angespitzten Stämmen + Strohhütte
    roof3d(g, W*0.3,H*0.42,W*0.4,H*0.2,14,(gg,bb,s)=>matStraw(gg,bb,s),181,2);
    wall3d(g, W*0.3,H*0.42,W*0.4,H*0.22,(gg,bb,s)=>matWood(gg,bb,s,'#9c774a',true),182);
    const r=mulberry(183);
    for(let k=0;k<11;k++){
      const px=W*0.08+k*W*0.084;
      const ph=H*0.3+r()*14;
      const grl=g.createLinearGradient(px,0,px+W*0.06,0);
      grl.addColorStop(0,'#b3855a'); grl.addColorStop(1,'#6d4c2a');
      g.fillStyle=grl;
      g.beginPath();
      g.moveTo(px,H*0.9); g.lineTo(px,H*0.9-ph);
      g.lineTo(px+W*0.03,H*0.9-ph-16); g.lineTo(px+W*0.06,H*0.9-ph);
      g.lineTo(px+W*0.06,H*0.9);
      g.closePath(); g.fill();
      g.strokeStyle='rgba(40,25,12,0.6)'; g.lineWidth=2; g.stroke();
      g.strokeStyle='rgba(255,230,190,0.25)'; g.lineWidth=2;
      g.beginPath(); g.moveTo(px+3,H*0.9-4); g.lineTo(px+3,H*0.9-ph+3); g.stroke();
    }
    g.fillStyle='#241a10'; g.fillRect(W*0.42,H*0.66,W*0.16,H*0.24);
    g.strokeStyle='rgba(40,25,12,0.7)'; g.lineWidth=2.4; g.strokeRect(W*0.42,H*0.66,W*0.16,H*0.24);
    pennant(g,W*0.5,H*0.2,46);
  },
  guardhouse(g,W,H){
    // steinernes Turmhaus mit Zinnen
    clipRun(g,()=>{ g.rect(W*0.28,H*0.3,W*0.44,H*0.58); },()=>matStone(g,{x:W*0.28,y:H*0.3,w:W*0.44,h:H*0.58},191,0.15));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.8; g.strokeRect(W*0.28,H*0.3,W*0.44,H*0.58);
    const grs=g.createLinearGradient(W*0.28,0,W*0.72,0);
    grs.addColorStop(0,'rgba(255,245,225,0.22)'); grs.addColorStop(0.5,'rgba(0,0,0,0)'); grs.addColorStop(1,'rgba(20,24,44,0.3)');
    g.fillStyle=grs; g.fillRect(W*0.28,H*0.3,W*0.44,H*0.58);
    for(let k=0;k<4;k++){
      const zx=W*0.29+k*W*0.115;
      g.fillStyle='#b5aea1'; g.fillRect(zx,H*0.22,W*0.075,H*0.09);
      g.strokeStyle='rgba(40,30,18,0.6)'; g.lineWidth=2; g.strokeRect(zx,H*0.22,W*0.075,H*0.09);
    }
    g.fillStyle='rgba(25,18,10,0.3)'; g.fillRect(W*0.28,H*0.3,W*0.44,8);
    windowRom(g,W*0.36,H*0.4,24,30);
    g.fillStyle='#20262e'; g.fillRect(W*0.6,H*0.42,7,20);
    doorRom(g,W*0.42,H*0.72,36,80);
    // Wappenschild
    shield(g,W*0.62,H*0.62,1.4);
    pennant(g,W*0.5,H*0.14,44);
  },
  watchtower(g,W,H){
    towerRound3d(g, W*0.5, H*0.9, W*0.17, H*0.56, 0, 201, 'zinnen');
    // hölzerner Wehrgang (Hurde)
    clipRun(g,()=>{ g.rect(W*0.24,H*0.26,W*0.52,H*0.12); },()=>matWood(g,{x:W*0.24,y:H*0.26,w:W*0.52,h:H*0.12},202,'#8a6238',false));
    g.strokeStyle='rgba(40,25,12,0.7)'; g.lineWidth=2.6; g.strokeRect(W*0.24,H*0.26,W*0.52,H*0.12);
    g.strokeStyle='#5d4526'; g.lineWidth=5;
    g.beginPath();
    g.moveTo(W*0.28,H*0.38); g.lineTo(W*0.36,H*0.46);
    g.moveTo(W*0.72,H*0.38); g.lineTo(W*0.64,H*0.46);
    g.stroke();
    const grh=g.createLinearGradient(W*0.2,0,W*0.8,0);
    grh.addColorStop(0,'#7d93ad'); grh.addColorStop(1,'#42536b');
    g.fillStyle=grh;
    g.beginPath(); g.moveTo(W*0.21,H*0.26); g.lineTo(W*0.5,H*0.14); g.lineTo(W*0.79,H*0.26); g.closePath(); g.fill();
    g.strokeStyle='rgba(30,26,20,0.7)'; g.lineWidth=2.4; g.stroke();
    windowRom(g,W*0.45,H*0.29,22,26,true);
    shield(g,W*0.5,H*0.56,1.4);
    doorRom(g,W*0.43,H*0.76,34,66);
    pennant(g,W*0.5,H*0.06,44);
  },
  fortress(g,W,H){ BLD_DRAW.hq(g,W,H); },
  hq(g,W,H){
    // Bergfried mit Pyramidendach + Biforium
    clipRun(g,()=>{ g.rect(W*0.36,H*0.2,W*0.28,H*0.4); },()=>matStone(g,{x:W*0.36,y:H*0.2,w:W*0.28,h:H*0.4},211,0.15));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.6; g.strokeRect(W*0.36,H*0.2,W*0.28,H*0.4);
    const grk=g.createLinearGradient(W*0.36,0,W*0.64,0);
    grk.addColorStop(0,'rgba(255,245,225,0.2)'); grk.addColorStop(1,'rgba(20,24,44,0.3)');
    g.fillStyle=grk; g.fillRect(W*0.36,H*0.2,W*0.28,H*0.4);
    // Kragsteine + Pyramidendach
    g.fillStyle='#8f897b';
    for(let k=0;k<6;k++) g.fillRect(W*0.365+k*W*0.045,H*0.2,W*0.024,6);
    const grd=g.createLinearGradient(W*0.34,0,W*0.66,0);
    grd.addColorStop(0,'#8a8378'); grd.addColorStop(1,'#4c463c');
    g.fillStyle=grd;
    g.beginPath(); g.moveTo(W*0.34,H*0.2); g.lineTo(W*0.5,H*0.08); g.lineTo(W*0.66,H*0.2); g.closePath(); g.fill();
    g.strokeStyle='rgba(30,26,20,0.7)'; g.lineWidth=2.4; g.stroke();
    g.fillStyle='rgba(255,245,220,0.22)';
    g.beginPath(); g.moveTo(W*0.34,H*0.2); g.lineTo(W*0.5,H*0.08); g.lineTo(W*0.5,H*0.2); g.closePath(); g.fill();
    windowRom(g,W*0.42,H*0.28,20,28); windowRom(g,W*0.52,H*0.28,20,28);
    // Ringmauer mit Wehrgang
    clipRun(g,()=>{ g.rect(W*0.14,H*0.5,W*0.72,H*0.36); },()=>matStone(g,{x:W*0.14,y:H*0.5,w:W*0.72,h:H*0.36},212,0.2));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.8; g.strokeRect(W*0.14,H*0.5,W*0.72,H*0.36);
    for(let k=0;k<8;k++){
      const zx=W*0.155+k*W*0.088;
      g.fillStyle='#b5aea1'; g.fillRect(zx,H*0.44,W*0.05,H*0.062);
      g.strokeStyle='rgba(40,30,18,0.6)'; g.lineWidth=1.8; g.strokeRect(zx,H*0.44,W*0.05,H*0.062);
      g.fillStyle='rgba(255,248,230,0.3)'; g.fillRect(zx,H*0.44,4,H*0.062);
    }
    g.fillStyle='rgba(25,18,10,0.3)'; g.fillRect(W*0.14,H*0.5,W*0.72,7);
    // Verwitterung an der Mauer
    const r=mulberry(213);
    g.strokeStyle='rgba(60,55,45,0.25)'; g.lineWidth=3;
    for(const fx of [0.2,0.33,0.6,0.78]){
      g.beginPath(); g.moveTo(W*fx,H*0.52); g.lineTo(W*fx+2,H*(0.6+r()*0.14)); g.stroke();
    }
    // Ecktürme + Torhaus-Türmchen
    towerRound3d(g, W*0.14, H*0.9, W*0.068, H*0.42, H*0.13, 214, 'cone');
    towerRound3d(g, W*0.86, H*0.9, W*0.068, H*0.42, H*0.13, 215, 'cone');
    towerRound3d(g, W*0.365, H*0.9, W*0.042, H*0.28, H*0.08, 216, 'cone');
    towerRound3d(g, W*0.635, H*0.9, W*0.042, H*0.28, H*0.08, 217, 'cone');
    // Torbogen mit Fallgitter
    doorRom(g,W*0.44,H*0.64,W*0.12,H*0.24);
    g.strokeStyle='rgba(30,32,40,0.85)'; g.lineWidth=3;
    for(let k=0;k<4;k++){
      g.beginPath(); g.moveTo(W*(0.455+k*0.03),H*0.66); g.lineTo(W*(0.455+k*0.03),H*0.86); g.stroke();
    }
    g.beginPath(); g.moveTo(W*0.445,H*0.73); g.lineTo(W*0.555,H*0.73);
    g.moveTo(W*0.445,H*0.8); g.lineTo(W*0.555,H*0.8); g.stroke();
    shield(g,W*0.5,H*0.585,1.7);
    pennant(g,W*0.5,H*0.02,48);
  },
  catapult(g,W,H){
    // Plattform + Räder + Rahmen + Wurfarm + Steine
    clipRun(g,()=>{ g.rect(W*0.14,H*0.7,W*0.72,H*0.1); },()=>matWood(g,{x:W*0.14,y:H*0.7,w:W*0.72,h:H*0.1},221,'#8a6238',true));
    g.strokeStyle='rgba(40,25,12,0.7)'; g.lineWidth=2.6; g.strokeRect(W*0.14,H*0.7,W*0.72,H*0.1);
    for(const wx of [0.24,0.76]){
      g.fillStyle='#5d4526';
      g.beginPath(); g.arc(W*wx,H*0.84,26,0,7); g.fill();
      g.strokeStyle='rgba(30,20,10,0.7)'; g.lineWidth=3; g.stroke();
      g.strokeStyle='#3a2c18'; g.lineWidth=4;
      for(let k=0;k<3;k++){
        const a=k*Math.PI/3;
        g.beginPath();
        g.moveTo(W*wx-Math.cos(a)*22,H*0.84-Math.sin(a)*22);
        g.lineTo(W*wx+Math.cos(a)*22,H*0.84+Math.sin(a)*22);
        g.stroke();
      }
      g.fillStyle='#8a929c'; g.beginPath(); g.arc(W*wx,H*0.84,5,0,7); g.fill();
    }
    g.strokeStyle='#6d4c2a'; g.lineWidth=12;
    g.beginPath(); g.moveTo(W*0.3,H*0.72); g.lineTo(W*0.5,H*0.46); g.lineTo(W*0.7,H*0.72); g.stroke();
    g.strokeStyle='rgba(255,230,190,0.25)'; g.lineWidth=3;
    g.beginPath(); g.moveTo(W*0.3,H*0.71); g.lineTo(W*0.5,H*0.455); g.stroke();
    // Seilwinde
    g.strokeStyle='rgba(200,180,140,0.9)'; g.lineWidth=3;
    for(let k=0;k<5;k++){
      g.beginPath(); g.moveTo(W*0.47+k*3,H*0.6); g.lineTo(W*0.47+k*3,H*0.7); g.stroke();
    }
    // Wurfarm mit Schleuder
    g.strokeStyle='#5d4526'; g.lineWidth=11;
    g.beginPath(); g.moveTo(W*0.34,H*0.7); g.lineTo(W*0.68,H*0.28); g.stroke();
    g.fillStyle='#4c525c';
    g.beginPath(); g.arc(W*0.7,H*0.26,12,0,7); g.fill();
    g.strokeStyle='rgba(25,28,34,0.7)'; g.lineWidth=2; g.stroke();
    matStone(g,{x:W*0.06,y:H*0.6,w:64,h:36},222,0.1);
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.2; g.strokeRect(W*0.06,H*0.6,64,36);
    pennant(g,W*0.84,H*0.36,40);
  },
  baustelle(g,W,H){
    // Gerüst + Fundament + Material
    clipRun(g,()=>{ g.rect(W*0.26,H*0.62,W*0.5,H*0.22); },()=>matStone(g,{x:W*0.26,y:H*0.62,w:W*0.5,h:H*0.22},231,0.2));
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.6; g.strokeRect(W*0.26,H*0.62,W*0.5,H*0.22);
    g.strokeStyle='#9c7a4c'; g.lineWidth=6;
    for(const sx of [0.2,0.5,0.8]){
      g.beginPath(); g.moveTo(W*sx,H*0.88); g.lineTo(W*sx,H*0.34); g.stroke();
    }
    g.beginPath(); g.moveTo(W*0.14,H*0.38); g.lineTo(W*0.86,H*0.38); g.stroke();
    g.beginPath(); g.moveTo(W*0.14,H*0.6); g.lineTo(W*0.86,H*0.6); g.stroke();
    g.lineWidth=4;
    g.beginPath(); g.moveTo(W*0.2,H*0.6); g.lineTo(W*0.5,H*0.38); g.moveTo(W*0.5,H*0.6); g.lineTo(W*0.8,H*0.38); g.stroke();
    for(let k=0;k<4;k++){
      const ly=H*0.84-k*10;
      g.fillStyle=k%2?'#c9a05a':'#b3854a';
      g.fillRect(W*0.05,ly,70,9);
      g.strokeStyle='rgba(60,40,20,0.6)'; g.lineWidth=1.4; g.strokeRect(W*0.05,ly,70,9);
    }
    matStone(g,{x:W*0.82,y:H*0.72,w:60,h:34},232,0.1);
    g.strokeStyle='rgba(40,30,18,0.7)'; g.lineWidth=2.2; g.strokeRect(W*0.82,H*0.72,60,34);
  },
};
// Bergwerke: Stollenportal mit typspezifischer Erz-Lore
function mineDraw(oreCol){
  return (g,W,H)=>{
    // Felshang
    clipRun(g,()=>{
      g.moveTo(W*0.06,H*0.9); g.lineTo(W*0.5,H*0.2); g.lineTo(W*0.94,H*0.9); g.closePath();
    },()=>{
      matStone(g,{x:W*0.02,y:H*0.16,w:W*0.96,h:H*0.78},241,0);
      const gr=g.createLinearGradient(W*0.1,0,W*0.9,0);
      gr.addColorStop(0,'rgba(255,245,225,0.25)'); gr.addColorStop(0.5,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(20,24,44,0.4)');
      g.fillStyle=gr; g.fillRect(0,0,W,H);
    });
    g.strokeStyle='rgba(40,30,18,0.75)'; g.lineWidth=2.8;
    g.beginPath(); g.moveTo(W*0.06,H*0.9); g.lineTo(W*0.5,H*0.2); g.lineTo(W*0.94,H*0.9); g.stroke();
    // Stollenmund mit Balkenrahmen
    g.fillStyle='#120d08';
    g.beginPath();
    g.moveTo(W*0.36,H*0.9); g.lineTo(W*0.36,H*0.6);
    g.quadraticCurveTo(W*0.5,H*0.47,W*0.64,H*0.6); g.lineTo(W*0.64,H*0.9);
    g.closePath(); g.fill();
    g.strokeStyle='#7a5a34'; g.lineWidth=10;
    g.beginPath();
    g.moveTo(W*0.34,H*0.9); g.lineTo(W*0.34,H*0.58);
    g.moveTo(W*0.66,H*0.9); g.lineTo(W*0.66,H*0.58);
    g.moveTo(W*0.3,H*0.58); g.lineTo(W*0.7,H*0.58);
    g.stroke();
    // Laterne
    g.fillStyle='rgba(255,205,110,0.95)'; g.beginPath(); g.arc(W*0.5,H*0.64,5,0,7); g.fill();
    const glow=g.createRadialGradient(W*0.5,H*0.64,2,W*0.5,H*0.64,18);
    glow.addColorStop(0,'rgba(255,200,100,0.45)'); glow.addColorStop(1,'rgba(255,200,100,0)');
    g.fillStyle=glow; g.beginPath(); g.arc(W*0.5,H*0.64,18,0,7); g.fill();
    // Lore mit Erz
    clipRun(g,()=>{ g.rect(W*0.7,H*0.76,60,32); },()=>matWood(g,{x:W*0.7,y:H*0.76,w:60,h:32},242,'#6d4c2a',true));
    g.strokeStyle='rgba(30,20,10,0.7)'; g.lineWidth=2.4; g.strokeRect(W*0.7,H*0.76,60,32);
    const r=mulberry(243);
    for(let k=0;k<7;k++){
      g.fillStyle=oreCol;
      g.beginPath(); g.arc(W*0.7+10+r()*40,H*0.76+2-r()*6,4+r()*4,0,7); g.fill();
      g.strokeStyle='rgba(0,0,0,0.4)'; g.lineWidth=1; g.stroke();
    }
    g.fillStyle='#2e2e34';
    g.beginPath(); g.arc(W*0.73,H*0.9,6,0,7); g.arc(W*0.79,H*0.9,6,0,7); g.fill();
    // Gleis
    g.strokeStyle='rgba(70,60,50,0.8)'; g.lineWidth=3;
    g.beginPath(); g.moveTo(W*0.64,H*0.93); g.lineTo(W*0.95,H*0.93); g.stroke();
    pennant(g,W*0.5,H*0.12,42);
  };
}
BLD_DRAW.coalmine=mineDraw('#33322f');
BLD_DRAW.ironmine=mineDraw('#a06246');
BLD_DRAW.goldmine=mineDraw('#e0b23a');
BLD_DRAW.granitemine=mineDraw('#9a958c');

function shield(g,x,y,s){
  g.save(); g.translate(x,y); g.scale(s,s);
  const gr=g.createLinearGradient(-6,-7,6,8);
  gr.addColorStop(0,'#6d84a0'); gr.addColorStop(1,'#3c4c66');
  g.fillStyle=gr;
  g.beginPath();
  g.moveTo(-6.5,-7); g.lineTo(6.5,-7);
  g.lineTo(6.5,0); g.quadraticCurveTo(5.8,5.4,0,8.2);
  g.quadraticCurveTo(-5.8,5.4,-6.5,0);
  g.closePath(); g.fill();
  g.strokeStyle='rgba(30,22,14,0.75)'; g.lineWidth=1.4; g.stroke();
  g.strokeStyle='rgba(240,244,250,0.9)'; g.lineWidth=2.2;
  g.beginPath(); g.moveTo(-4.5,-0.5); g.lineTo(0,-4); g.lineTo(4.5,-0.5); g.stroke();
  g.restore();
}

// ---------------- Bäume ----------------
function treeLeaf(autumn){
  return (g,W,H)=>{
    const r=mulberry(autumn?301:302);
    // Stamm mit Rinde
    clipRun(g,()=>{
      g.moveTo(W*0.46,H*0.98);
      g.quadraticCurveTo(W*0.48,H*0.8,W*0.47,H*0.62);
      g.lineTo(W*0.53,H*0.62);
      g.quadraticCurveTo(W*0.52,H*0.8,W*0.55,H*0.98);
      g.closePath();
    },()=>{
      const gr=g.createLinearGradient(W*0.45,0,W*0.56,0);
      gr.addColorStop(0,'#8a6a45'); gr.addColorStop(0.5,'#6d4f30'); gr.addColorStop(1,'#4a3520');
      g.fillStyle=gr; g.fillRect(W*0.4,H*0.55,W*0.2,H*0.5);
      g.strokeStyle='rgba(35,24,14,0.4)'; g.lineWidth=1.4;
      for(let k=0;k<9;k++){
        const bx=W*0.45+r()*W*0.1;
        g.beginPath(); g.moveTo(bx,H*0.6);
        g.quadraticCurveTo(bx+(r()-0.5)*8,H*0.78,bx+(r()-0.5)*6,H*0.98);
        g.stroke();
      }
    });
    // Äste
    g.strokeStyle='#5d4328'; g.lineWidth=8;
    g.beginPath();
    g.moveTo(W*0.49,H*0.63); g.quadraticCurveTo(W*0.36,H*0.52,W*0.28,H*0.44);
    g.moveTo(W*0.52,H*0.63); g.quadraticCurveTo(W*0.64,H*0.5,W*0.72,H*0.42);
    g.stroke();
    // Krone: Lappen mit Blattbüschel-Textur
    const lobes=[[0.5,0.3,0.2],[0.32,0.38,0.15],[0.68,0.37,0.15],[0.42,0.2,0.13],[0.6,0.21,0.13],[0.5,0.42,0.17],[0.24,0.46,0.1],[0.76,0.45,0.1]];
    const dark = autumn? '#8a5424':'#3c6e30';
    const mid  = autumn? '#b3783a':'#55924a';
    const lite = autumn? '#dca85c':'#7fb968';
    const spark= autumn? '#f2cf8c':'#b8e09a';
    g.fillStyle=dark;
    for(const [lx,ly,lr] of lobes){
      g.beginPath(); g.arc(W*lx,H*ly,W*lr*1.06,0,7); g.fill();
    }
    for(const [lx,ly,lr] of lobes){
      const cx=W*lx, cy=H*ly, rad=W*lr;
      for(let k=0;k<70;k++){
        const a=r()*6.28, d=Math.sqrt(r())*rad;
        const px=cx+Math.cos(a)*d, py=cy+Math.sin(a)*d*0.92;
        // Sonnenseite (oben links) heller
        const lightT=Math.max(0,Math.min(1,0.5-((px-cx)/rad)*0.35-((py-cy)/rad)*0.4));
        const c= lightT>0.62? lite : lightT>0.3? mid : dark;
        g.fillStyle=c;
        g.globalAlpha=0.5+r()*0.5;
        g.beginPath(); g.ellipse(px,py,4+r()*7,3+r()*5,r()*3,0,7); g.fill();
      }
      g.globalAlpha=1;
    }
    // Funkel-Highlights oben links
    g.fillStyle=spark;
    for(let k=0;k<26;k++){
      const lb=lobes[(r()*lobes.length)|0];
      const px=W*lb[0]-W*lb[2]*(0.2+r()*0.5), py=H*lb[1]-H*lb[2]*(0.3+r()*0.5);
      g.globalAlpha=0.35+r()*0.4;
      g.beginPath(); g.arc(px,py,2+r()*3.4,0,7); g.fill();
    }
    g.globalAlpha=1;
  };
}
function treeConifer(g,W,H){
  const r=mulberry(303);
  const gr=g.createLinearGradient(W*0.47,0,W*0.55,0);
  gr.addColorStop(0,'#7a5a38'); gr.addColorStop(1,'#4a3520');
  g.fillStyle=gr;
  g.beginPath();
  g.moveTo(W*0.46,H*0.98); g.lineTo(W*0.48,H*0.2); g.lineTo(W*0.52,H*0.2); g.lineTo(W*0.55,H*0.98);
  g.closePath(); g.fill();
  const layers=7;
  for(let L=0;L<layers;L++){
    const t=L/(layers-1);
    const y=H*(0.86-t*0.68);
    const wR=W*(0.34-t*0.24)+6;
    // Silhouette
    g.fillStyle='#274a28';
    g.beginPath();
    g.moveTo(W*0.5,y-H*0.16);
    g.quadraticCurveTo(W*0.5+wR*0.72,y-H*0.05, W*0.5+wR,y+4);
    g.quadraticCurveTo(W*0.5,y+14, W*0.5-wR,y+4);
    g.quadraticCurveTo(W*0.5-wR*0.72,y-H*0.05, W*0.5,y-H*0.16);
    g.closePath(); g.fill();
    // Nadel-Strokes
    for(let k=0;k<70;k++){
      const side=r()<0.5?-1:1;
      const px=W*0.5+side*r()*wR*0.94, py=y-H*0.1+r()*H*0.12;
      const lightT=side<0? 0.6+r()*0.4 : r()*0.5;
      const c= lightT>0.75? '#6da84a' : lightT>0.4? '#47793a':'#2e5426';
      g.strokeStyle=c;
      g.globalAlpha=0.5+r()*0.5;
      g.lineWidth=1.6+r()*1.4;
      g.beginPath();
      g.moveTo(px,py);
      g.lineTo(px+side*(5+r()*9), py+4+r()*7);
      g.stroke();
    }
    g.globalAlpha=1;
  }
  // Spitzenlicht
  g.fillStyle='rgba(150,200,120,0.5)';
  g.beginPath(); g.arc(W*0.485,H*0.17,5,0,7); g.fill();
}

// ---------------- Icons ----------------
const ICON_DRAW={
  board(g,S){
    for(let k=0;k<4;k++){
      const y=S*0.62-k*S*0.115;
      clipRun(g,()=>{ g.rect(S*0.12,y,S*0.76,S*0.11); },()=>matWood(g,{x:S*0.12,y,w:S*0.76,h:S*0.11},401+k,k%2?'#b3854a':'#9c7440',true));
      g.strokeStyle='rgba(50,32,16,0.7)'; g.lineWidth=2; g.strokeRect(S*0.12,y,S*0.76,S*0.11);
      g.fillStyle='rgba(255,235,200,0.4)'; g.fillRect(S*0.12,y,S*0.76,3);
    }
    g.strokeStyle='rgba(120,90,60,0.9)'; g.lineWidth=4;
    g.beginPath(); g.moveTo(S*0.3,S*0.28); g.lineTo(S*0.3,S*0.74); g.moveTo(S*0.7,S*0.28); g.lineTo(S*0.7,S*0.74); g.stroke();
  },
  stone(g,S){
    const r=mulberry(411);
    for(const [x,y,rad] of [[0.36,0.62,0.24],[0.64,0.66,0.2],[0.5,0.42,0.17]]){
      const gr=g.createLinearGradient(S*(x-rad),S*(y-rad),S*(x+rad),S*(y+rad));
      gr.addColorStop(0,'#c8c2b4'); gr.addColorStop(1,'#736d60');
      g.fillStyle=gr;
      g.beginPath();
      g.moveTo(S*(x-rad),S*y);
      g.lineTo(S*(x-rad*0.5),S*(y-rad*0.9));
      g.lineTo(S*(x+rad*0.55),S*(y-rad*0.8));
      g.lineTo(S*(x+rad),S*y);
      g.lineTo(S*(x+rad*0.4),S*(y+rad*0.6));
      g.lineTo(S*(x-rad*0.5),S*(y+rad*0.55));
      g.closePath(); g.fill();
      g.strokeStyle='rgba(40,36,30,0.6)'; g.lineWidth=2; g.stroke();
      g.strokeStyle='rgba(255,255,245,0.5)'; g.lineWidth=2;
      g.beginPath(); g.moveTo(S*(x-rad*0.45),S*(y-rad*0.82)); g.lineTo(S*(x+rad*0.5),S*(y-rad*0.72)); g.stroke();
    }
  },
  bread(g,S){
    const gr=g.createRadialGradient(S*0.42,S*0.42,S*0.05,S*0.5,S*0.55,S*0.42);
    gr.addColorStop(0,'#e8b46a'); gr.addColorStop(0.7,'#b3752e'); gr.addColorStop(1,'#8a5420');
    g.fillStyle=gr;
    g.beginPath(); g.ellipse(S*0.5,S*0.56,S*0.36,S*0.26,0,0,7); g.fill();
    g.strokeStyle='rgba(90,50,18,0.6)'; g.lineWidth=2; g.stroke();
    g.strokeStyle='rgba(250,225,180,0.85)'; g.lineWidth=4;
    for(let k=0;k<3;k++){
      g.beginPath();
      g.moveTo(S*(0.3+k*0.14),S*0.42);
      g.quadraticCurveTo(S*(0.36+k*0.14),S*0.52,S*(0.32+k*0.14),S*0.66);
      g.stroke();
    }
    g.fillStyle='rgba(255,240,210,0.35)';
    g.beginPath(); g.ellipse(S*0.4,S*0.44,S*0.14,S*0.07,-0.4,0,7); g.fill();
  },
  fish(g,S){
    const gr=g.createLinearGradient(0,S*0.35,0,S*0.7);
    gr.addColorStop(0,'#9cc2d6'); gr.addColorStop(1,'#4c7d99');
    g.fillStyle=gr;
    g.beginPath(); g.ellipse(S*0.45,S*0.52,S*0.3,S*0.16,0,0,7); g.fill();
    g.beginPath();
    g.moveTo(S*0.72,S*0.52); g.lineTo(S*0.9,S*0.38); g.lineTo(S*0.88,S*0.52); g.lineTo(S*0.9,S*0.66);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(30,55,70,0.6)'; g.lineWidth=2;
    g.beginPath(); g.ellipse(S*0.45,S*0.52,S*0.3,S*0.16,0,0,7); g.stroke();
    for(let k=0;k<4;k++){
      g.beginPath(); g.arc(S*(0.35+k*0.09),S*0.52,S*0.06,-0.8,0.8); g.stroke();
    }
    g.fillStyle='#1d2c36'; g.beginPath(); g.arc(S*0.28,S*0.48,S*0.03,0,7); g.fill();
    g.fillStyle='rgba(255,255,255,0.5)';
    g.beginPath(); g.ellipse(S*0.4,S*0.44,S*0.14,S*0.04,-0.15,0,7); g.fill();
  },
  coal(g,S){
    const r=mulberry(441);
    for(let k=0;k<6;k++){
      const x=S*(0.28+r()*0.44), y=S*(0.4+r()*0.3), rad=S*(0.1+r()*0.12);
      const gr=g.createLinearGradient(x-rad,y-rad,x+rad,y+rad);
      gr.addColorStop(0,'#4c4c50'); gr.addColorStop(1,'#17171a');
      g.fillStyle=gr;
      g.beginPath();
      g.moveTo(x-rad,y); g.lineTo(x-rad*0.3,y-rad); g.lineTo(x+rad*0.7,y-rad*0.7);
      g.lineTo(x+rad,y+rad*0.3); g.lineTo(x,y+rad);
      g.closePath(); g.fill();
      g.strokeStyle='rgba(150,160,180,0.4)'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(x-rad*0.3,y-rad); g.lineTo(x+rad*0.6,y-rad*0.65); g.stroke();
    }
  },
  iron(g,S){
    // Barren
    for(const [x,y] of [[0.3,0.56],[0.56,0.6],[0.42,0.4]]){
      const gr=g.createLinearGradient(S*x,S*y,S*(x+0.28),S*(y+0.16));
      gr.addColorStop(0,'#d0d6dc'); gr.addColorStop(0.5,'#9aa2ac'); gr.addColorStop(1,'#5d6570');
      g.fillStyle=gr;
      g.beginPath();
      g.moveTo(S*x,S*(y+0.1)); g.lineTo(S*(x+0.06),S*y); g.lineTo(S*(x+0.3),S*y);
      g.lineTo(S*(x+0.24),S*(y+0.1)); g.closePath(); g.fill();
      g.fillStyle='rgba(0,0,0,0.25)';
      g.fillRect(S*x,S*(y+0.1),S*0.24,S*0.05);
      g.strokeStyle='rgba(40,45,55,0.7)'; g.lineWidth=2;
      g.strokeRect(S*x,S*(y+0.1),S*0.24,S*0.05);
      g.beginPath();
      g.moveTo(S*x,S*(y+0.1)); g.lineTo(S*(x+0.06),S*y); g.lineTo(S*(x+0.3),S*y);
      g.lineTo(S*(x+0.24),S*(y+0.1)); g.closePath(); g.stroke();
    }
  },
  coin(g,S){
    const gr=g.createRadialGradient(S*0.42,S*0.42,S*0.04,S*0.5,S*0.5,S*0.36);
    gr.addColorStop(0,'#f8e2a0'); gr.addColorStop(0.65,'#dcb254'); gr.addColorStop(1,'#a87e28');
    g.fillStyle=gr;
    g.beginPath(); g.arc(S*0.5,S*0.5,S*0.34,0,7); g.fill();
    g.strokeStyle='#7a5a18'; g.lineWidth=3; g.stroke();
    g.strokeStyle='rgba(122,90,24,0.75)'; g.lineWidth=2.4;
    g.beginPath(); g.arc(S*0.5,S*0.5,S*0.26,0,7); g.stroke();
    // geprägter Turm
    g.fillStyle='rgba(122,90,24,0.8)';
    g.fillRect(S*0.45,S*0.4,S*0.1,S*0.2);
    g.fillRect(S*0.42,S*0.37,S*0.05,S*0.05);
    g.fillRect(S*0.475,S*0.37,S*0.05,S*0.05);
    g.fillRect(S*0.53,S*0.37,S*0.05,S*0.05);
    g.fillStyle='rgba(255,245,215,0.6)';
    g.beginPath(); g.ellipse(S*0.4,S*0.38,S*0.1,S*0.05,-0.6,0,7); g.fill();
  },
  soldier(g,S){
    // gekreuzte Schwerter
    for(const flip of [1,-1]){
      g.save();
      g.translate(S*0.5,S*0.5); g.rotate(flip*0.62);
      const gr=g.createLinearGradient(-S*0.02,0,S*0.02,0);
      gr.addColorStop(0,'#e8ecf2'); gr.addColorStop(0.5,'#aab2bc'); gr.addColorStop(1,'#6d7580');
      g.fillStyle=gr;
      g.beginPath();
      g.moveTo(-S*0.022,S*0.16); g.lineTo(-S*0.022,-S*0.3);
      g.lineTo(0,-S*0.38); g.lineTo(S*0.022,-S*0.3); g.lineTo(S*0.022,S*0.16);
      g.closePath(); g.fill();
      g.strokeStyle='rgba(50,55,65,0.6)'; g.lineWidth=1.6; g.stroke();
      g.strokeStyle='rgba(255,255,255,0.5)'; g.lineWidth=1.4;
      g.beginPath(); g.moveTo(-S*0.008,S*0.14); g.lineTo(-S*0.008,-S*0.3); g.stroke();
      g.fillStyle='#8a6224';
      g.fillRect(-S*0.09,S*0.16,S*0.18,S*0.035);
      clipRun(g,()=>{ g.rect(-S*0.03,S*0.195,S*0.06,S*0.14); },()=>{
        g.fillStyle='#6d4c2a'; g.fillRect(-S*0.03,S*0.195,S*0.06,S*0.14);
        g.strokeStyle='rgba(30,20,10,0.5)'; g.lineWidth=1.4;
        for(let k=0;k<5;k++){
          g.beginPath(); g.moveTo(-S*0.03,S*(0.2+k*0.028)); g.lineTo(S*0.03,S*(0.215+k*0.028)); g.stroke();
        }
      });
      g.fillStyle='#8a6224'; g.beginPath(); g.arc(0,S*0.35,S*0.026,0,7); g.fill();
      g.restore();
    }
  },
};

// ---------------- Export ----------------
export const BLD_KEYS=Object.keys(BLD_DRAW);
export function genAll(){
  const out=new Map();
  for(const key of BLD_KEYS){
    const [cv,g]=mk(560,520);
    BLD_DRAW[key](g,560,520);
    out.set(key==='baustelle'?'bld_baustelle':'bld_'+key, cv);
  }
  for(const [name,fn] of [['tree_leaf',treeLeaf(false)],['tree_autumn',treeLeaf(true)],['tree_conifer',treeConifer]]){
    const [cv,g]=mk(440,560);
    fn(g,440,560);
    out.set(name,cv);
  }
  for(const key of Object.keys(ICON_DRAW)){
    const [cv,g]=mk(128,128);
    ICON_DRAW[key](g,128);
    out.set('icon_'+key,cv);
  }
  return out;
}
// Zuschneiden auf Inhalt (mit Rand)
export function trim(cv, pad=6){
  const g=cv.getContext('2d');
  const d=g.getImageData(0,0,cv.width,cv.height).data;
  let x0=cv.width,y0=cv.height,x1=0,y1=0;
  for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
    if(d[(y*cv.width+x)*4+3]>8){
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
  }
  if(x1<=x0||y1<=y0) return cv;
  x0=Math.max(0,x0-pad); y0=Math.max(0,y0-pad);
  x1=Math.min(cv.width-1,x1+pad); y1=Math.min(cv.height-1,y1+pad);
  const [out,og]=mk(x1-x0+1,y1-y0+1);
  og.drawImage(cv,x0,y0,out.width,out.height,0,0,out.width,out.height);
  return out;
}
