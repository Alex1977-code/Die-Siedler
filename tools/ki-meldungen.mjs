// R7: Was PASSIERT in einem langen Spiel? Alle Meldungen ueber 45
// Spielminuten nach Art zaehlen, drei Saaten.
//
// Befund vom 12.08.: 38 Meldungsarten - "Erschoepfung als einziges Ereignis"
// stimmt so nicht. Aber 343 Meldungen insgesamt, davon allein 104 Mal
// "Jaeger: wartet auf Werkzeug (Bogen)!". Nach der Eskalationsbremse (v143):
// 144 Meldungen, dieselbe Artenvielfalt.
// R7: Was PASSIERT in einem langen Spiel ueberhaupt? Alle Meldungen des
// Spielers ueber 45 Spielminuten nach Art zaehlen.
import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const alle={};
for(const saat of ['11','23','41']){
  await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
  await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
  await p.fill('#f-seed',saat); await p.click('#f-start');
  await p.waitForTimeout(2200);
  const r=await p.evaluate(async ()=>{
    const g=window.__ui.game;
    g.players[0].ai=true; g.players[0].aiLevel=2; g.players[1].aiLevel=2;
    const gesehen=[];
    const eMsg=g.msg.bind(g);
    g.msg=function(txt,typ,node){ gesehen.push({t:g.t, txt, typ}); return eMsg(txt,typ,node); };
    for(let t=0;t<27000;t++) g.step();
    // nach Textmuster gruppieren (Zahlen und Namen raus)
    const grp={};
    for(const x of gesehen){
      const k=x.txt.replace(/[0-9]+/g,'#').slice(0,46);
      grp[k]=(grp[k]||0)+1;
    }
    return {n:gesehen.length, grp, ersteMin:gesehen.length? Math.round(gesehen[0].t/600) : null};
  });
  for(const k in r.grp) alle[k]=(alle[k]||0)+r.grp[k];
}
const list=Object.entries(alle).sort((a,b2)=>b2[1]-a[1]);
console.log(JSON.stringify({artenGesamt:list.length, meldungen:list}));
await b.close();
