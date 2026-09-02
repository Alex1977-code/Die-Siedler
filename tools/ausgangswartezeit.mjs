// AUSGANGSWARTEZEIT: wie lange liegt eine fertige Ware sichtbar herum,
// bevor sie abgeholt wird?
//
// Nutzerbefund: "fischer fischt fisch legt an fahne aber erster fisch
// bleibt liegen und wird nicht transportiert". Seit v296 zeichnet
// flagGoods() den AUSGANG des Hauses (b.out) an der Tuerfahne mit - was
// vorher unsichtbar im Datensatz wartete, liegt jetzt sichtbar da. Und
// tickProduction verschickt Ueberschuss erst ab ZWEI wartenden Waren.
// Also wartet jedes erste Stueck einen ganzen Produktionstakt.
//
// Gemessen wird je Betrieb: wie viele Takte b.out ueber null steht, und
// wie lange am Stueck. Dazu Durchsatz und Fahnenlast, damit man sieht,
// was eine Lockerung der Drossel kostet.
//
//   node tools/ausgangswartezeit.mjs [takte]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const TAKTE=+(process.argv[2]||20000);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:640}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:11, groesse:'M', gegner:'0'});
const erg=await page.evaluate((TAKTE)=>{
  const g=window.__ui.game, m=g.map;
  const hq=g.buildings.get(g.players[0].hq);
  hq.inv=hq.inv||{}; hq.inv.board=90; hq.inv.stone=90;
  const bfs=(von,nach)=>{
    const vor=new Map([[von,-1]]); const q=[von];
    while(q.length){ const k=q.shift(); if(k===nach) break;
      for(const nb of m.nbs(k)){ if(vor.has(nb)) continue;
        if(!m.terrOkBuild(nb) && nb!==nach) continue; vor.set(nb,k); q.push(nb); } }
    if(!vor.has(nach)) return null;
    const p=[]; let k=nach; while(k!==-1){ p.unshift(k); k=vor.get(k); } return p;
  };
  const betriebe=[];
  for(const typ of ['fisher','woodcutter','quarry','hunter']){
    let b=null;
    for(let r=2;r<=34 && !b;r++) for(const n of g.nodesInRange(hq.node,r)){
      if(!g.canBuild(0,typ,n).ok) continue;
      const rr=g.placeBuilding(0,typ,n); if(rr.ok){ b=rr.b; break; } }
    if(!b) continue;
    const p=bfs(hq.door,b.door);
    if(p) for(let i=0;i+2<p.length;i+=2) g.buildRoad(0,[p[i],p[i+1],p[i+2]]);
    b.state='done'; b.leveled=true; b.bauerDa=true; b.progress=1e9; b.stock={};
    if(b.worker){ b.worker.present=true; b.worker.state='in'; b.worker.timer=0; }
    g.changedNodes.push(b.node);
    betriebe.push(b);
  }
  const st=betriebe.map(b=>({typ:b.type, wartetakte:0, laeufe:[], lauf:0, max:0}));
  let fahnenlast=0, proben=0;
  const vorher={...hq.inv};
  for(let t=0;t<TAKTE;t++){
    g.step();
    betriebe.forEach((b,i)=>{
      if((b.out|0)>0){ st[i].wartetakte++; st[i].lauf++; }
      else if(st[i].lauf){ st[i].laeufe.push(st[i].lauf); st[i].max=Math.max(st[i].max,st[i].lauf); st[i].lauf=0; }
    });
    if(t%50===0){ let n=0; for(const it of g.flagItems.values()) n+=it.length; fahnenlast+=n; proben++; }
  }
  const aus={};
  for(const k in hq.inv) if((hq.inv[k]||0)-(vorher[k]||0)>0) aus[k]=(hq.inv[k]||0)-(vorher[k]||0);
  return { betriebe: st.map(s=>({typ:s.typ,
      anteilWartend:+(100*s.wartetakte/TAKTE).toFixed(1),
      mittlereLiegezeit: s.laeufe.length? +(s.laeufe.reduce((a,b)=>a+b,0)/s.laeufe.length).toFixed(0) : 0,
      laengsteLiegezeit: s.max, abgaben: s.laeufe.length })),
    lager: aus, fahnenlast:+(fahnenlast/proben).toFixed(2), strassen:g.roads.size };
}, TAKTE);
console.log(JSON.stringify(erg,null,1));
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,3));
await br.close();
