// Warum greift die KI nie an? Misst den Abstand ihrer FERTIGEN Posten zum
// naechsten feindlichen Ziel und fragt attackable() fuer jedes Ziel ab.
//
// Ergebnis vom 12.08. (Stufe 2, drei Saaten, 30 Spielminuten, beide Seiten
// spielend):
//   Saat 23   1 fertiger Posten,  3 Soldaten, Reserve 10, naechstes Ziel 47 Knoten
//   Saat 11   4 fertige Posten,  12 Soldaten, Reserve 10, naechstes Ziel 61 Knoten
//   Saat 41   0 fertige Posten,   0 Soldaten, Reserve 10, kein Ziel in Sicht
// In ALLEN Faellen: attackable() = 0 fuer jedes Ziel.
// Die Reichweite betraegt r_eigen + r_ziel + 2, bei Wachhaeusern also rund
// 20 Knoten. Die Posten stehen zwei- bis dreimal zu weit weg.
// Sind die Posten der KI ueberhaupt in Reichweite eines Ziels?
import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const out=[];
for(const saat of ['23','11','41']){
  await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
  await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
  await p.fill('#f-seed',saat); await p.click('#f-start');
  await p.waitForTimeout(2200);
  out.push(await p.evaluate(async ()=>{
    const g=window.__ui.game, m=g.map, BLD=window.__BLD||null;
    g.players[1].aiLevel=2; g.players[0].ai=true; g.players[0].aiLevel=2;
    for(let t=0;t<18000;t++) g.step();
    const eig=[...g.buildings.values()].filter(x=>x.player===1&&x.soldiers&&x.state==='done'&&x.type!=='hq');
    const feind=[...g.buildings.values()].filter(x=>x.player===0&&(x.soldiers||x.type==='hq')&&x.state==='done');
    let minD=1e9, paare=0, avail0=0, availMax=0;
    for(const a of eig) for(const f of feind){
      const d=Math.hypot(m.X(a.node)-m.X(f.node), m.Y(a.node)-m.Y(f.node));
      if(d<minD) minD=d;
    }
    for(const f of feind){ const av=g.attackable(1,f.id); paare++; if(av<2) avail0++; if(av>availMax) availMax=av; }
    let sol=0; for(const a of eig) sol+=a.soldiers.length;
    return { posten:eig.length, soldaten:sol, reserve:g.recruitTotal(1),
             feindZiele:feind.length, minAbstandKnoten:+minD.toFixed(1),
             zieleOhneGenugMann:avail0, maxAbkoemmlich:availMax };
  }));
}
console.log(JSON.stringify(out));
await b.close();
