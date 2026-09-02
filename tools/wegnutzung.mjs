// Nutzen Planierer und Bauarbeiter die Strasse - und steht je ein
// Bauarbeiter an einer Baustelle OHNE Weganbindung?
//
// Zwei Fragen in einer Messung:
//  1. Wie oft bekommt eine losgeschickte Figur ueberhaupt Wegpunkte?
//     flagWaypoints liefert null, sobald Start- und Zielfahne nicht im
//     selben Strassen-Komponenten liegen - und eine frische Baustelle hat
//     noch keine Strasse. Erwartung: fast nie.
//  2. Gibt es Baustellen mit Bauarbeiter, aber ohne Verbindung zu einem
//     Lager? Dort kaeme nie Material nach, der Mann stuende umsonst.
//
//   node tools/wegnutzung.mjs [minuten] [saaten...]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const MIN=+(process.argv[2]||30);
const SAATEN=process.argv.slice(3).length? process.argv.slice(3)
  : ['701','702','703','704','705','706'];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const alle=[];
for(const saat of SAATEN){
  const t0=await starteSpiel(p,{saat});
  if(t0!==0) throw new Error('Startet nicht bei Takt 0');
  alle.push(await p.evaluate(async ({MIN})=>{
    const g=window.__ui.game;
    g.players[0].ai=true; g.players[0].aiLevel=2; g.players[1].aiLevel=2;
    // flagWaypoints-Aufrufe mitzaehlen: wie oft gibt es eine Route?
    const z={rufe:0, mitRoute:0, ohneRoute:0};
    const fw=g.flagWaypoints.bind(g);
    g.flagWaypoints=function(a,b2){
      const r=fw(a,b2);
      z.rufe++; if(r && r.length) z.mitRoute++; else z.ohneRoute++;
      return r;
    };
    for(let t=0;t<MIN*600;t++) g.step();
    // Baustellen mit Bauarbeiter, aber ohne Anbindung ans Lagernetz
    const hq=g.buildings.get(g.players[0].hq);
    const hqC=hq? g.compOf(hq.door) : undefined;
    let mitBauerOhneWeg=0, mitBauer=0, baustellen=0;
    for(const x of g.buildings.values()){
      if(x.player!==0 || x.state!=='build') continue;
      baustellen++;
      const bauerDa=x.builderId!=null && g.units.some(u=>u.id===x.builderId);
      if(!bauerDa) continue;
      mitBauer++;
      if(x.door<0 || g.compOf(x.door)!==hqC) mitBauerOhneWeg++;
    }
    return {...z, baustellen, mitBauer, mitBauerOhneWeg};
  }, {MIN}));
}
const su=(k)=>alle.reduce((a,x)=>a+x[k],0);
const o={}; for(const k of Object.keys(alle[0])) o[k]=su(k);
o.anteilMitRoute=o.rufe? +(o.mitRoute/o.rufe*100).toFixed(1):0;
console.log('WEGNUTZUNG '+JSON.stringify(o));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
