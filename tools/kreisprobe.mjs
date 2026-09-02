// KREISPROBE: den Sperrkreis direkt befragen.
//
// freiHalten() haelt vier Faelle auseinander, und die Feldmessung
// (tools/fahnendurchlauf.mjs) trifft nicht jeden davon zuverlaessig - in
// einem Durchgang kam gar keine Figur an einem Baum vorbei. Diese Probe
// setzt eine Figur von Hand neben jedes Hindernis, ruft freiHalten und
// misst nach. Erwartet:
//
//   Baum, Stein               12,00  (SPERRKREIS)
//   freistehende Wegfahne      7,00  (FAHNENKREIS)
//   Fahne als laufender Wegpunkt   unveraendert - sonst kommt die Figur
//                                  nie an; flagWaypoints fuehrt UEBER die
//                                  Fahnen
//   Tuerfahne                      unveraendert - dort geht man ins Haus,
//                                  und ihr Mast steht ohnehin neben dem
//                                  Knoten (bis 4,4 px), ein Knotenkreis
//                                  koennte ihn gar nicht freihalten
//
//   node tools/kreisprobe.mjs [port]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:640}});
await starteSpiel(page,{saat:11,groesse:'M',gegner:'0'});
console.log(JSON.stringify(await page.evaluate(()=>{
  const g=window.__ui.game,m=g.map;
  const hq=g.buildings.get(g.players[0].hq);
  // eine Strasse fuer eine freistehende Wegfahne
  let wegFahne=-1;
  for(const nb of m.nbs(hq.door)) for(const nb2 of m.nbs(nb)){
    if(nb2===hq.door) continue;
    if(g.buildRoad(0,[hq.door,nb,nb2])){ wegFahne=nb2; break; } }
  const suche=(pruef)=>{ for(const i of g.nodesInRange(hq.node,24)) if(pruef(i)) return i; return -1; };
  const baum=suche(i=>(m.obj[i]&127)===3);
  const stein=suche(i=>(m.obj[i]&127)===4);
  const probe=(knoten, wp)=>{
    if(knoten<0) return null;
    const [x,y]=m.worldPos(knoten);
    const u={id:-1, x:x+0.4, y:y-0.3, target:-1};
    if(wp) u.wp=[[x,y]], u.wpi=0;
    g.freiHalten(u);
    return +Math.hypot(u.x-x,u.y-y).toFixed(2);
  };
  return { baum:{knoten:baum, abstandNach:probe(baum)},
           stein:{knoten:stein, abstandNach:probe(stein)},
           wegfahne:{knoten:wegFahne, abstandNach:probe(wegFahne)},
           wegfahneAlsWegpunkt:{abstandNach:probe(wegFahne,true)},
           tuerfahne:{knoten:hq.door, abstandNach:probe(hq.door)} };
}),null,1));
await br.close();
