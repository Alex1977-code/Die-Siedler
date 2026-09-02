// FAHNENDURCHLAUF: wie oft steht eine Figur IM Fahnenmast?
//
// Nutzerbefund: "die figuren laufen immernoch durch die fahnen hindurch".
// Der Sperrkreis aus v301 kennt nur Baum, Jungbaum und Stein - Fahnen
// nicht. Bevor man ihn erweitert, muss man wissen, WER durchlaeuft: die
// Strassentraeger sitzen bauartbedingt AUF den Fahnenknoten (ihre Route
// laeuft von Fahne zu Fahne), die Arbeiter laufen querfeldein darueber.
// Beide zaehlen hier getrennt.
//
// Der Mast steht nicht auf dem Knoten, sondern auf flagVisualPos - bei
// Tuerfahnen am Eingang. Gemessen wird gegen diesen Ort.
//
//   node tools/fahnendurchlauf.mjs [takte] [radius]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const TAKTE=+(process.argv[2]||12000), R=+(process.argv[3]||7);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:640}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:11, groesse:'M', gegner:'0'});
const erg=await page.evaluate(([TAKTE,R])=>{
  const g=window.__ui.game, m=g.map, R2=window.__ui.renderer;
  const hq=g.buildings.get(g.players[0].hq);
  hq.inv=hq.inv||{}; hq.inv.board=90; hq.inv.stone=90;
  const bfs=(von,nach)=>{ const vor=new Map([[von,-1]]); const q=[von];
    while(q.length){ const k=q.shift(); if(k===nach) break;
      for(const nb of m.nbs(k)){ if(vor.has(nb)) continue;
        if(!m.terrOkBuild(nb) && nb!==nach) continue; vor.set(nb,k); q.push(nb); } }
    if(!vor.has(nach)) return null;
    const p=[]; let k=nach; while(k!==-1){ p.unshift(k); k=vor.get(k); } return p; };
  for(const typ of ['woodcutter','quarry','fisher','forester','hunter']){
    let b=null;
    for(let r=3;r<=30 && !b;r++) for(const n of g.nodesInRange(hq.node,r)){
      if(!g.canBuild(0,typ,n).ok) continue;
      const rr=g.placeBuilding(0,typ,n); if(rr.ok){ b=rr.b; break; } }
    if(!b) continue;
    const p=bfs(hq.door,b.door);
    if(p) for(let i=0;i+2<p.length;i+=2) g.buildRoad(0,[p[i],p[i+1],p[i+2]]);
    b.state='done'; b.leveled=true; b.bauerDa=true; b.progress=1e9; b.stock={};
    if(b.worker){ b.worker.present=true; b.worker.state='in'; b.worker.timer=0; }
    g.changedNodes.push(b.node);
  }
  // Fahnenorte einmal einsammeln (so, wie der Zeichner sie setzt), mit
  // Knotennummer - die braucht der Ausschluss unten.
  const fahnen=[];
  for(let i=0;i<m.flag.length;i++) if(m.flag[i]){ const p=R2.flagVisualPos(i); fahnen.push({i,x:p[0],y:p[1]}); }
  // MESSKREIS UNTER DEM SPERRKREIS. Der Sperrkreis setzt die Figur auf
  // GENAU seinen Radius; misst man mit demselben Wert, zaehlt jede korrekt
  // geschobene Figur als Verstoss (derselbe Fehler wie bei den Baeumen in
  // v301: 59 % gemeldet, tatsaechlich 0). Also eine Spur darunter messen.
  const MESS=R-1;
  // Ausgenommen wie im Sperrkreis: die eigene Tuerfahne und das Ziel.
  // Ausgenommen wie im Sperrkreis: das Ziel und ALLE Tuerfahnen (deren
  // Mast steht neben seinem Knoten, ein Knotenkreis kann ihn nicht
  // freihalten - siehe freiHalten in sim.js).
  const tuerFahnen=new Set();
  for(const b of g.buildings.values()) if(b.door>=0) tuerFahnen.add(b.door);
  const eigen=(u,fi)=>{
    if(u.target===fi) return true;
    if(tuerFahnen.has(fi)) return true;
    return false;
  };
  const arten={}, faelle=[];
  let schritteA=0, treffA=0, schritteT=0, treffT=0, nahestA=1e9, nahestT=1e9;
  // Der Sperrkreis um Baum und Stein wurde beim Umbau mit angefasst - also
  // mitmessen. Messkreis 10 unter Sperrkreis 12, wie in v301.
  let treffB=0, nahestB=1e9;
  for(let t=0;t<TAKTE;t++){
    g.step();
    for(const u of g.units){
      if(u.dead) continue;
      schritteA++;
      let best=1e9;
      for(const f of fahnen){
        if(eigen(u,f.i)) continue;
        const d=Math.hypot(u.x-f.x, u.y-f.y); if(d<best) best=d; }
      if(best<nahestA) nahestA=best;
    }
    for(const r of g.roads.values()){
      const c=r.carrier; if(!c) continue;
      if(c.state!=='carry' && c.state!=='toPick') continue;   // nur waehrend der Fahrt
      schritteT++;
      const [x,y]=R2.roadPos(r,c.pos);
      let best=1e9;
      for(const f of fahnen){ const d=Math.hypot(x-f.x, y-f.y); if(d<best) best=d; }
      if(best<MESS) treffT++;
      if(best<nahestT) nahestT=best;
    }
  }
  return { fahnen:fahnen.length, radius:R,
    arbeiter:{schritte:schritteA, imMast:treffA, anteil:+(100*treffA/Math.max(1,schritteA)).toFixed(2), nahest:+nahestA.toFixed(2)},
    arten,
    baumstein:{imKreis:treffB, nahest:+nahestB.toFixed(2)},
    traeger: {schritte:schritteT, imMast:treffT, anteil:+(100*treffT/Math.max(1,schritteT)).toFixed(2), nahest:+nahestT.toFixed(2)} };
}, [TAKTE,R]);
console.log(JSON.stringify(erg,null,1));
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,3));
await br.close();
