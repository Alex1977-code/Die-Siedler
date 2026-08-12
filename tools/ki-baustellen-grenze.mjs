// Wie viele gleichzeitige Baustellen vertraegt die KI?
//
// Die Erreichbarkeits-Korrektur (v146) hat der KI mehr Bauplaetze
// verschafft, aber weniger FERTIGE Gebaeude - sie faengt mehr an, als ihr
// Material traegt. Hier wird die Obergrenze im Lauf gesetzt (placeBuilding
// wird abgefangen), damit mehrere Werte in einem Durchgang vergleichbar
// sind, ohne die Dateien anzufassen.
//
//   node kappe.mjs <kappe|0> [ticks] [saaten...]      0 = keine Grenze
import { chromium } from 'playwright';
const KAPPE=+(process.argv[2]||0);
const TICKS=+(process.argv[3]||9000);
const SAATEN=process.argv.slice(4).length? process.argv.slice(4)
  : ['11','23','7','41','58','3','97','64','12','80','5','33'];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const erg=[];
for(const saat of SAATEN){
  await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
  await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
  await p.fill('#f-seed',saat); await p.click('#f-start');
  await p.waitForTimeout(2200);
  erg.push(await p.evaluate(async ({TICKS,saat,KAPPE})=>{
    const g=window.__ui.game, m=g.map;
    g.players[1].aiLevel=2; g.players[0].ai=true; g.players[0].aiLevel=2;
    if(KAPPE>0){
      const pB=g.placeBuilding.bind(g);
      g.placeBuilding=function(pl,ty,nd){
        if(pl===1){
          let roh=0;
          for(const x of g.buildings.values())
            if(x.player===1 && x.state==='build') roh++;
          if(roh>=KAPPE) return {ok:false, r:'Kappe'};
        }
        return pB(pl,ty,nd);
      };
    }
    for(let t=0;t<TICKS;t++) g.step();
    let fertig=0, roh=0, sol=0, frei=0, land=0, mil=0;
    for(const x of g.buildings.values()){
      if(x.player!==1) continue;
      if(x.state==='build') roh++; else fertig++;
      if(x.soldiers){ mil++; sol+=x.soldiers.length; }
    }
    for(let i=0;i<m.owner.length;i++){
      if(m.owner[i]!==1) continue; land++;
      if(g.canBuild(1,'guardhouse',i).ok) frei++;
    }
    return {saat, fertig, roh, sol, mil, frei, land};
  }, {TICKS,saat,KAPPE}));
}
const st=(k)=>{ const v=erg.map(x=>x[k]).sort((a,b2)=>a-b2);
  return {min:v[0], median:v[Math.floor(v.length/2)],
          summe:v.reduce((a,b2)=>a+b2,0), max:v[v.length-1]}; };
console.log('KAPPE'+KAPPE+' '+JSON.stringify({kappe:KAPPE,
  fertig:st('fertig'), roh:st('roh'), sol:st('sol'), mil:st('mil'),
  frei:st('frei'), land:st('land'),
  einzeln:erg.map(e=>[e.saat,e.fertig,e.roh])}));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
