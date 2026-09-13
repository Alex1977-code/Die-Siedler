// Wie viel traegt die Materialhilfe der KI heute noch?
//
// Die KI bekommt alle 600 Takte Bretter, Steine, Werkzeuge, Bier und
// Waffen ins Hauptquartier geschenkt. Der alte Befund (Gebiet 611 -> 306
// ohne Hilfe) stammt aus der Zeit vor v145 bis v152 - seitdem ist die KI
// eine andere. Gemessen wird deshalb neu, und zwar getrennt nach dem, was
// die Hilfe liefert:
//   voll     wie ausgeliefert
//   ohne     gar keine Hilfe
//   nurBau   nur Bretter und Steine
//   nurMil   nur Bier und Waffen
//   nurWerk  nur Werkzeuge
// So laesst sich sagen, WELCHER Teil die Kruecke ist - nicht nur, dass es
// eine gibt.
//
//   node tools/materialhilfe.mjs [was] [minuten] [saaten...]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const WAS=process.argv[2]||'voll';
const MIN=+(process.argv[3]||30);
const SAATEN=process.argv.slice(4).length? process.argv.slice(4)
  : Array.from({length:12},(_,k)=>String(801+k));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const alle=[];
for(const saat of SAATEN){
  const t0=await starteSpiel(p,{saat});
  if(t0!==0) throw new Error('Startet nicht bei Takt 0');
  alle.push(await p.evaluate(async ({WAS,MIN})=>{
    const g=window.__ui.game, m=g.map;
    g.players[1].aiLevel=2; g.players[0].ai=true; g.players[0].aiLevel=2;
    // Die Hilfe sitzt mitten in aiStep. Statt den Code zu aendern, wird
    // hier nach JEDEM Zug zurueckgebucht, was nicht gelten soll.
    const BAU=['board','stone'], MIL=['beer','sword','shield','spear'],
          WERK=['hammer','axe','saw','scythe','rod','shovel','cleaver','pick'];
    const weg=[]
      .concat(WAS==='ohne'||WAS==='nurMil'||WAS==='nurWerk'? BAU:[])
      .concat(WAS==='ohne'||WAS==='nurBau'||WAS==='nurWerk'? MIL:[])
      .concat(WAS==='ohne'||WAS==='nurBau'||WAS==='nurMil'? WERK:[]);
    if(weg.length){
      const alt=g.aiStep.bind(g);
      g.aiStep=function(pl){
        const hq=g.buildings.get(pl.hq);
        const vor=hq&&hq.inv? Object.fromEntries(weg.map(k=>[k,hq.inv[k]||0])) : null;
        const r=alt(pl);
        if(pl.id!==0 && vor && hq.inv){
          // nur die GESCHENKTE Menge zurueckbuchen, nicht die erarbeitete:
          // die Hilfe ist der einzige Weg, auf dem im selben Zug etwas
          // dazukommen kann, ohne dass ein Traeger liefert.
          for(const k of weg) if((hq.inv[k]||0)>vor[k]) hq.inv[k]=vor[k];
        }
        return r;
      };
    }
    for(let t=0;t<MIN*600;t++) g.step();
    let land=0, fertig=0, roh=0, sol=0, mil=0;
    for(let i=0;i<m.owner.length;i++) if(m.owner[i]===1) land++;
    for(const x of g.buildings.values()){
      if(x.player!==1) continue;
      if(x.state==='build') roh++; else fertig++;
      if(x.soldiers){ mil++; sol+=x.soldiers.length; }
    }
    const iv=g.invTotal(1);
    return {land, fertig, roh, sol, mil,
            bretter:iv.board||0, steine:iv.stone||0, bier:iv.beer||0};
  }, {WAS,MIN}));
}
const su=(k)=>alle.reduce((a,x)=>a+x[k],0);
const o={was:WAS, saaten:alle.length};
for(const k of ['land','fertig','roh','sol','mil','bretter','steine','bier']) o[k]=su(k);
o.jeSaat=alle.map(x=>[x.fertig,x.sol,x.land]);
console.log('HILFE '+JSON.stringify(o));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
