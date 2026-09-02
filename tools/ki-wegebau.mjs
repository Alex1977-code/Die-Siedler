// Wie gut baut die KI Strassen?
//
// Nach v145 ist der haeufigste Ablehnungsgrund fuer einen KI-Bauplatz nicht
// mehr der Untergrund, sondern "Kein Weg von dort zum Wegenetz". Dieses
// Werkzeug zaehlt mit, was der Wegebau der KI tatsaechlich tut:
//   - wie oft aiConnect gerufen wird und wie oft er scheitert
//   - wie oft der Pionierweg anspringt und ob er einen Weg findet
//   - wie viele Baustellen mangels Anschluss abgerissen werden
//   - wie gross Netz und Reichweite am Ende sind
//   - warum abgelehnte Knoten abgelehnt werden, und zwar fuer die
//     Tuerfahne einzeln aufgeschluesselt
//
//   node tools/ki-wegebau.mjs [stufe] [ticks] [saaten...]
import { chromium } from 'playwright';
const LVL  = +(process.argv[2] || 2);
const TICKS= +(process.argv[3] || 12000);
const SAATEN = process.argv.slice(4).length ? process.argv.slice(4)
  : ['11','23','7','41','58','3'];

const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const erg=[];
for(const saat of SAATEN){
  await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
  await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
  await p.fill('#f-seed',saat); await p.click('#f-start');
  await p.waitForTimeout(2200);
  erg.push(await p.evaluate(async ({LVL,TICKS,saat})=>{
    const g=window.__ui.game, m=g.map;
    g.players[1].aiLevel=LVL; g.players[0].ai=true; g.players[0].aiLevel=LVL;
    const z={connect:0, connectFail:0, pionier:0, pionierFail:0,
             strassen:0, abriss:0, gebaut:0};
    const aC=g.aiConnect.bind(g);
    g.aiConnect=function(pl,bb){ if(pl.id===1) z.connect++;
      const r=aC(pl,bb); if(pl.id===1 && !r) z.connectFail++; return r; };
    const aP=g.aiPionierweg.bind(g);
    g.aiPionierweg=function(pl){ const vorher=g.roads.size;
      const r=aP(pl);
      if(pl.id===1){ z.pionier++; if(!r) z.pionierFail++; }
      return r; };
    const cR=g.createRoad.bind(g);
    g.createRoad=function(pl,pathN,...a){ if(pl===1) z.strassen++; return cR(pl,pathN,...a); };
    const bB=g.burnBuilding.bind(g);
    g.burnBuilding=function(bb,...a){ if(bb.player===1 && bb.state==='build') z.abriss++; return bB(bb,...a); };
    const pB=g.placeBuilding.bind(g);
    g.placeBuilding=function(pl,ty,nd){ const r=pB(pl,ty,nd); if(pl===1 && r.ok) z.gebaut++; return r; };

    for(let t=0;t<TICKS;t++) g.step();

    // Endstand des Netzes
    const ne=g.netzErreichbar(1);
    let eigen=0, ok=0;
    const gruende={};
    // Fuer die Ablehnung "Kein Weg von dort zum Wegenetz": woran haengt es?
    let tuerImNetz=0, tuerNachbarBelegt=0;
    for(let i=0;i<m.owner.length;i++){
      if(m.owner[i]!==1) continue;
      eigen++;
      const r=g.canBuild(1,'guardhouse',i);
      if(r.ok){ ok++; continue; }
      gruende[r.r]=(gruende[r.r]||0)+1;
      if(r.r==='Kein Weg von dort zum Wegenetz'){
        // Tuerknoten noch einmal bestimmen (gleiche Regel wie canBuild)
        const my=m.Y(i), mx=m.X(i);
        const lower=m.nbs(i).filter(n=>m.Y(n)>my)
          .sort((a2,b2)=>Math.abs(m.X(a2)-mx)-Math.abs(m.X(b2)-mx));
        let tuer=-1;
        for(const n of lower)
          if(m.flag[n] || (m.owner[n]===1 && m.terrOkRoad(n) && m.bld[n]<0
             && g.roadObjOk(n) && !g.roadAt(n))){ tuer=n; break; }
        if(tuer<0) continue;
        if(ne.netz.has(tuer)) tuerImNetz++;
        // Nachbarn der Tuer: wie viele sind ueberhaupt eigenes Land?
        const nb=m.nbs(tuer);
        if(nb.every(q=> m.owner[q]!==1 || !m.terrOkRoad(q))) tuerNachbarBelegt++;
      }
    }
    let strassenKnoten=0, wege=0;
    for(const r of g.roads.values()) if(r.player===1){ wege++; strassenKnoten+=r.path.length; }
    let bau=0, baustellen=0;
    for(const x of g.buildings.values()) if(x.player===1){ bau++; if(x.state==='build') baustellen++; }
    return {saat, ...z, wege, strassenKnoten, netz:ne.netz.size, reichweite:ne.R.size,
            eigen, frei:ok, bau, baustellen,
            keinWeg:gruende['Kein Weg von dort zum Wegenetz']||0,
            keinAnschluss:gruende['Kein Anschluss ans Wegenetz möglich']||0,
            tuerImNetz, tuerNachbarBelegt, gruende};
  }, {LVL,TICKS,saat}));
}
const st=(k)=>{ const v=erg.map(x=>x[k]).sort((a,b2)=>a-b2);
  return {min:v[0], median:v[Math.floor(v.length/2)],
          mittel:Math.round(v.reduce((a,b2)=>a+b2,0)/v.length), max:v[v.length-1]}; };
const felder=['connect','connectFail','pionier','pionierFail','strassen','abriss',
              'gebaut','wege','strassenKnoten','netz','reichweite','frei','keinWeg','bau'];
const aus={}; for(const f of felder) aus[f]=st(f);
console.log(JSON.stringify({stufe:LVL, ticks:TICKS, saaten:SAATEN.length, aus, einzeln:erg}));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
