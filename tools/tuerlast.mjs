// Der Pruefstand schiebt die Eingaenge DIREKT ins Lager des Betriebs - der
// Einholgang an der Tuerfahne kommt darin gar nicht vor. Genau der kostet
// aber Zeit: die Fachkraft tritt heraus, laeuft zur Fahne, nimmt die Ware
// auf und traegt sie herein, und solange ruht die Arbeit im Haus.
//
// Hier wird deshalb der echte Weg gemessen: die Ware wird als WARTENDER
// Posten an die Tuerfahne gelegt, so wie ein Traeger sie ablegt. Gezaehlt
// wird der Ausstoss je Spielminute.
//
//   node tuerlast.mjs [minuten] [port]
import { chromium } from 'playwright';
const MIN=+(process.argv[2]||10);
const PORT=+(process.argv[3]||8901);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:600}});
await page.goto(`http://127.0.0.1:${PORT}/`, {waitUntil:'load'});
await page.evaluate(()=>{
  const ui=window.__ui;
  if(!ui || ui.__messRiegel) return;
  ui.__messRiegel=true;
  Object.defineProperty(ui,'paused',{configurable:true,get(){return true;},set(){}});
});
await page.click('#bt-free');
await page.selectOption('#f-size','M');
await page.selectOption('#f-ais','0');
await page.fill('#f-seed','11');
await page.click('#f-start');
await page.waitForFunction(()=>window.__ui && window.__ui.game && window.__ui.game.map, null, {timeout:15000});

const erg=await page.evaluate(async ([MIN])=>{
  const g=window.__ui.game, m=g.map;
  const core=await import('./js/core.js');
  const {BLD, TOOL_OF}=core;
  const hq=g.buildings.get(g.players[0].hq);

  const hinstellen=(typ)=>{
    let n=-1;
    for(let r=2;r<=30 && n<0;r++) for(const q of g.nodesInRange(hq.node,r)) if(g.canBuild(0,typ,q).ok){ n=q; break; }
    if(n<0) return null;
    const res=g.placeBuilding(0,typ,n);
    if(!res.ok) return null;
    const b=res.b;
    b.state='done'; b.leveled=true; b.bauerDa=true; b.progress=1e9; b.stock={};
    if(b.worker){ b.worker.present=true; b.worker.state='in'; b.worker.timer=0; }
    if(TOOL_OF[typ]) b.toolGood=TOOL_OF[typ];
    return b;
  };

  const messe=(typ, minuten)=>{
    const def=BLD[typ];
    const b=hinstellen(typ);
    if(!b) return {typ, fehler:'kein Bauplatz'};
    if(b.door==null || b.door<0) { g.demolish(b.id); return {typ, fehler:'keine Tuerfahne'}; }
    let stueck=0, gaenge=0;
    for(let t=0;t<minuten*600;t++){
      // Nachschub wie von einem Traeger an der Tuerfahne abgelegt
      const items=g.flagItems.get(b.door)||[];
      for(const k in def.prod.inputs){
        const da=(b.stock[k]||0) + items.filter(x=>x.good===k && x.destB===b.id).length;
        if(da<2){
          items.push({good:k, destB:b.id, srcB:-1, wartet:true, wartT:g.t});
          b.incoming[k]=(b.incoming[k]||0)+1;
        }
      }
      g.flagItems.set(b.door, items);
      const vorher=g.units.filter(u=>u.type==='einhol' && u.bld===b.id).length;
      g.step();
      const nachher=g.units.filter(u=>u.type==='einhol' && u.bld===b.id).length;
      if(nachher>vorher) gaenge+=nachher-vorher;
      if(b.out>0){ stueck+=b.out; b.out=0; }
    }
    g.demolish(b.id);
    return {typ, name:def.name, jeMin:+(stueck/minuten).toFixed(2),
      soll:+(600/def.prod.time).toFixed(2), einholGaenge:gaenge};
  };

  return ['mill','bakery','brewery','smelter','armory','butcher'].map(t=>messe(t,MIN));
}, [MIN]);

console.log(`TUERLAST  Saat 11, ${MIN} Spielminuten, Nachschub liegt an der TUERFAHNE\n`);
console.log('Betrieb          | Soll/min | Ist/min | Wirkungsgrad | Einholgaenge');
console.log('-'.repeat(70));
for(const r of erg){
  if(r.fehler){ console.log(`${r.typ.padEnd(16)} | ${r.fehler}`); continue; }
  console.log(`${r.name.padEnd(16)} | ${String(r.soll).padStart(8)} | ${String(r.jeMin).padStart(7)} `
    + `| ${String((r.jeMin/r.soll).toFixed(2)).padStart(12)} | ${r.einholGaenge}`);
}
await br.close();
