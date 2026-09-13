// FISCHPROBE: bleibt der erste Fisch an der Fahne liegen?
//
// Nutzerbefund: "fischer fischt fisch legt an fahne aber erster fisch
// bleibt liegen und wird nicht transportiert". Also einen Fischer ans
// Wasser stellen, per Strasse ans Lager haengen und JEDEN Takt
// mitschreiben, was an seiner Tuerfahne liegt - mit Ziel, Quelle und
// Reservierung. Ein Stueck, das nie abgeholt wird, faellt dann sofort auf.
//
//   node tools/fischprobe2.mjs [port]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:640}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:11, groesse:'M', gegner:'0'});
const erg=await page.evaluate(()=>{
  const g=window.__ui.game, m=g.map;
  const hq=g.buildings.get(g.players[0].hq);
  hq.inv=hq.inv||{}; hq.inv.board=80; hq.inv.stone=80;
  // Fischer suchen: Bauplatz am Wasser, moeglichst nah am HQ
  let fb=null;
  for(let r=2;r<=34 && !fb;r++)
    for(const n of g.nodesInRange(hq.node,r)){
      if(!g.canBuild(0,'fisher',n).ok) continue;
      const rr=g.placeBuilding(0,'fisher',n);
      if(rr.ok){ fb=rr.b; break; }
    }
  if(!fb) return {fehler:'kein Fischerplatz'};
  // Strasse von der Burgfahne zur Fischerfahne (Knotenweg suchen)
  const weg=g.flagPath? null : null;
  // einfache Suche: Breitensuche ueber Knoten, Fahnen alle zwei Schritte
  const bfs=(von,nach)=>{
    const vor=new Map([[von,-1]]); const q=[von];
    while(q.length){ const k=q.shift(); if(k===nach) break;
      for(const nb of m.nbs(k)){ if(vor.has(nb)) continue;
        if(!m.terrOkBuild(nb) && nb!==nach) continue;
        vor.set(nb,k); q.push(nb); } }
    if(!vor.has(nach)) return null;
    const p=[]; let k=nach; while(k!==-1){ p.unshift(k); k=vor.get(k); }
    return p;
  };
  const p=bfs(hq.door, fb.door);
  if(!p) return {fehler:'kein Weg'};
  let gebaut=0;
  for(let i=0;i+2<p.length;i+=2) if(g.buildRoad(0,[p[i],p[i+1],p[i+2]])) gebaut++;
  // fertig bauen und besetzen
  fb.state='done'; fb.leveled=true; fb.bauerDa=true; fb.progress=1e9; fb.stock={};
  if(fb.worker){ fb.worker.present=true; fb.worker.state='in'; fb.worker.timer=0; }
  g.changedNodes.push(fb.node);

  const verlauf=[]; let ersteId=null, ersteSeit=-1;
  for(let t=0;t<9000;t++){
    g.step();
    const items=g.flagItems.get(fb.door)||[];
    if(items.length){
      const it=items[0];
      if(it!==ersteId){ ersteId=it; ersteSeit=t; }
    } else { ersteId=null; ersteSeit=-1; }
    if(t%500===0) verlauf.push({t, anFahne:items.length,
      erste: items[0]? {good:items[0].good, destB:items[0].destB, srcB:items[0].srcB,
                        reserved:!!items[0].reserved, liegtSeit:t-ersteSeit} : null,
      lagerFisch:(hq.inv.fish||0)});
  }
  const items=g.flagItems.get(fb.door)||[];
  return {gebaut, strassen:g.roads.size, fisherDoor:fb.door,
    lagerFisch:hq.inv.fish||0, restAnFahne:items.length,
    rest: items.slice(0,4).map(i=>({good:i.good,destB:i.destB,srcB:i.srcB,reserved:!!i.reserved})),
    verlauf};
});
console.log(JSON.stringify(erg,null,1).slice(0,2600));
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,3));
await br.close();
