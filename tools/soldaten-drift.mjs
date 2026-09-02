// Wo gehen der KI die Soldaten verloren?
//
// Ueber v148 bis v150 fiel die Zahl stationierter Soldaten in jedem Lauf
// leicht. Rekrutiert wird aus Bier und Waffen (nicht aus freien Siedlern),
// stationiert wird in Militaergebaeuden - der Verlust kann also an drei
// Stellen sitzen: zu wenige Posten, zu wenig Nachschub, oder Posten, die
// leer bleiben. Dieses Werkzeug zeigt alle drei zugleich.
//
//   node tools/soldaten-drift.mjs [ticks] [saaten...]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const TICKS=+(process.argv[2]||9000);
const SAATEN=process.argv.slice(3).length? process.argv.slice(3)
  : ['501','502','503','504','505','506','507','508','509','510','511','512'];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const alle=[];
for(const saat of SAATEN){
  const t0=await starteSpiel(p,{saat});
  if(t0!==0) throw new Error('Messung startet nicht bei Takt 0 (t='+t0+')');
  alle.push(await p.evaluate(async ({TICKS})=>{
    const g=window.__ui.game;
    g.players[0].ai=true; g.players[0].aiLevel=2; g.players[1].aiLevel=2;
    for(let t=0;t<TICKS;t++) g.step();
    let mil=0, milFertig=0, sol=0, plaetze=0, wirtschaft=0, brauerei=0;
    for(const x of g.buildings.values()){
      if(x.player!==1) continue;
      const def=x.type;
      if(x.soldiers){
        mil++;
        if(x.state!=='build'){ milFertig++; sol+=x.soldiers.length;
          plaetze+=(x.garrison??x.soldiers.length); }
      } else if(x.state!=='build' && def!=='hq') wirtschaft++;
      if(def==='brewery') brauerei++;
    }
    const iv=g.invTotal(1);
    return { mil, milFertig, sol, plaetze, wirtschaft, brauerei,
             reserve:g.recruitTotal(1),
             bier:iv.beer||0, schwert:iv.sword||0, schild:iv.shield||0,
             getreide:iv.grain||0, wasser:iv.water||0 };
  }, {TICKS}));
}
const su=(k)=>alle.reduce((a,x)=>a+x[k],0);
const felder=['mil','milFertig','sol','plaetze','wirtschaft','brauerei','reserve',
              'bier','schwert','schild','getreide','wasser'];
const aus={}; for(const f of felder) aus[f]=su(f);
aus.besetzungsgrad = aus.plaetze? +(aus.sol/aus.plaetze*100).toFixed(1) : 0;
console.log('DRIFT '+JSON.stringify({saaten:SAATEN.length, ticks:TICKS, ...aus,
  jeSaat:alle.map(x=>[x.sol,x.milFertig,x.reserve,x.bier])}));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
