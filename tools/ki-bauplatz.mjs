// Warum hat die KI keinen Bauplatz? Schluesselt alle eigenen Knoten nach
// Ablehnungsgrund auf - und "Untergrund ungeeignet" nach der WAHREN Ursache.
//
// Befund vom 12.08. (Stufe 2, 30 Spielminuten, beide Seiten spielend):
//   Saat 41: 628 eigene Knoten, 0 bebaubar - davon 376 WASSER, 40 Gebirge
//   Saat 58: 271 eigene Knoten, 0 bebaubar - davon 184 WASSER
//   Saat 23: 1478 eigene Knoten, 174 bebaubar - 491 Wasser, 174 Gebirge
// Die festsitzenden Karten sind also zu 60 bis 68 Prozent See. Baeume waren
// mit 50 bzw. 29 Knoten nur ein Nebenposten.
// Warum hat die KI keinen Bauplatz? Alle eigenen Knoten nach Ablehnungsgrund
// aufschluesseln - und "Untergrund ungeeignet" nach der WAHREN Ursache.
import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const out=[];
for(const saat of ['41','58','23']){
  await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
  await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
  await p.fill('#f-seed',saat); await p.click('#f-start');
  await p.waitForTimeout(2200);
  out.push(await p.evaluate(async (saat)=>{
    const g=window.__ui.game, m=g.map;
    g.players[1].aiLevel=2; g.players[0].ai=true; g.players[0].aiLevel=2;
    for(let t=0;t<18000;t++) g.step();
    const gruende={}, boden={};
    let eigen=0, ok=0;
    for(let i=0;i<m.terr.length;i++){
      if(m.owner[i]!==1) continue;
      eigen++;
      const r=g.canBuild(1,'guardhouse',i);
      if(r.ok){ ok++; continue; }
      gruende[r.r]=(gruende[r.r]||0)+1;
      if(r.r==='Untergrund ungeeignet'){
        const t2=m.terr[i];
        const k = t2===0?'Wasser' : t2===3?'Gebirge' : t2===4?'Schnee'
                : t2===5?'Sumpf' : t2===6?'Lava' : (m.steil&&m.steil[i])?'zu steil' : 'sonst';
        boden[k]=(boden[k]||0)+1;
      }
    }
    // Wie viele Knoten haetten Baeume drauf?
    let baumAufEigen=0, baumBlockt=0;
    for(let i=0;i<m.terr.length;i++){
      if(m.owner[i]!==1) continue;
      const o=m.obj[i]&127;
      if(o===1||o===2||o===3){ baumAufEigen++;
        const r=g.canBuild(1,'guardhouse',i); if(!r.ok) baumBlockt++; }
    }
    return {saat, eigen, ok, gruende, boden, baumAufEigen, baumBlockt};
  }, saat));
}
console.log(JSON.stringify(out));
await b.close();
