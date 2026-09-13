// Lebenslauf begonnener MILITAERBAUTEN der KI: begonnen, sofort abgerissen,
// nach 3000 Takten aufgegeben, fertig geworden. Vier Saaten, 30 Spielminuten.
//
// Der Befund, der v142 ausgeloest hat (Stufe 2, beide Seiten spielend):
//   vorher   Saat 23: 10 begonnen, 9 sofort abgerissen, 1 fertig
//   nachher  Saat 23: 12 begonnen, 0 abgerissen,       11 fertig
// Lebenslauf begonnener MILITAERBAUTEN der KI: begonnen, sofort abgerissen
// (Anschluss fehlgeschlagen), nach 3000 Takten aufgegeben, fertig geworden.
import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const out=[];
for(const saat of ['23','11','41','58']){
  await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
  await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
  await p.fill('#f-seed',saat); await p.click('#f-start');
  await p.waitForTimeout(2200);
  out.push(await p.evaluate(async ()=>{
    const g=window.__ui.game;
    g.players[1].aiLevel=2; g.players[0].ai=true; g.players[0].aiLevel=2;
    const MIL=new Set(['barracks','guardhouse','watchtower','fortress']);
    let begonnen=0, abgerissen=0, aufgegeben=0, fertig=0, verbrannt=0;
    const ePlace=g.placeBuilding.bind(g);
    g.placeBuilding=function(pl,t,n){ const r=ePlace(pl,t,n);
      if(pl===1 && r.ok && MIL.has(t)) { begonnen++; r.b._mess=1; } return r; };
    const eDem=g.demolish.bind(g);
    g.demolish=function(id){ const bb=g.buildings.get(id);
      if(bb && bb.player===1 && MIL.has(bb.type) && bb._mess) abgerissen++;
      return eDem(id); };
    const eBurn=g.burnBuilding.bind(g);
    g.burnBuilding=function(bb,krieg){ if(bb && bb.player===1 && MIL.has(bb.type) && bb._mess){
        if(bb.state==='build') aufgegeben++; else verbrannt++; }
      return eBurn(bb,krieg); };
    const gesehen=new Set();
    for(let t=0;t<18000;t++){
      g.step();
      if(t%50===0) for(const bb of g.buildings.values())
        if(bb.player===1 && MIL.has(bb.type) && bb.state==='done' && bb._mess && !gesehen.has(bb.id)){
          gesehen.add(bb.id); fertig++; }
    }
    const offen=[...g.buildings.values()].filter(x=>x.player===1&&MIL.has(x.type)&&x.state==='build').length;
    return {begonnen, abgerissen, aufgegeben, verbrannt, fertig, nochBaustelle:offen};
  }));
}
console.log(JSON.stringify(out));
await b.close();
