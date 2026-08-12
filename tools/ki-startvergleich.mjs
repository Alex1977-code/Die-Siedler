// Was bringt das groessere, landgepruefte Startgebiet im Spiel?
//
// Misst nach 30 Spielminuten je Saat: Gebaeude, Gebiet und freie Bauplaetze
// beider Seiten. Der Vergleich alt/neu laeuft ueber git stash - einmal mit
// dem alten map.js/core.js, einmal mit dem neuen.
//
//   node tools/ki-startvergleich.mjs [stufe] [ticks] [saaten...]
import { chromium } from 'playwright';
const LVL  = +(process.argv[2] || 2);
const TICKS= +(process.argv[3] || 18000);
const SAATEN = process.argv.slice(4).length ? process.argv.slice(4)
  : ['11','23','7','41','58','3','97','64','12','80'];

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
    for(let t=0;t<TICKS;t++) g.step();
    const land=[0,0], frei=[0,0];
    for(let i=0;i<m.owner.length;i++){
      const o=m.owner[i]; if(o!==0&&o!==1) continue;
      land[o]++;
      if(g.canBuild(o,'guardhouse',i).ok) frei[o]++;
    }
    const bau=[0,0], sol=[0,0], roh=[0,0], wege=[0,0];
    for(const x of g.buildings.values()){
      if(x.player>1) continue; bau[x.player]++;
      if(x.state==='build') roh[x.player]++;
      if(x.soldiers) sol[x.player]+=x.soldiers.length;
    }
    for(const r of g.roads.values()) if(r.player===0||r.player===1) wege[r.player]++;
    return {saat, bauKI:bau[1], fertigKI:bau[1]-roh[1], baustellenKI:roh[1],
            landKI:land[1], freiKI:frei[1], solKI:sol[1], wegeKI:wege[1],
            bauDu:bau[0], fertigDu:bau[0]-roh[0], landDu:land[0], freiDu:frei[0]};
  }, {LVL,TICKS,saat}));
}
const st=(k)=>{ const v=erg.map(x=>x[k]).sort((a,b2)=>a-b2);
  return {min:v[0], median:v[Math.floor(v.length/2)],
          mittel:Math.round(v.reduce((a,b2)=>a+b2,0)/v.length), max:v[v.length-1]}; };
console.log(JSON.stringify({stufe:LVL, saaten:SAATEN.length,
  bauKI:st('bauKI'), landKI:st('landKI'), freiKI:st('freiKI'), solKI:st('solKI'),
  bauDu:st('bauDu'), freiDu:st('freiDu'),
  festgefahren:erg.filter(x=>x.freiKI===0).map(x=>x.saat),
  einzeln:erg}));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
