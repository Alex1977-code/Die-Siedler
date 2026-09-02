// Gegenprobe zur Kohle-Aenderung: kostet der Vorrang des Engpass-Bergwerks
// die KI Militaer? Der Direkt-Nachschub gibt weiterhin nur EIN Bauteil je
// Zug, aber es kann jetzt an ein Bergwerk statt an einen Posten gehen.
//
//   node militaer.mjs [minuten] [saaten] [port]
import { chromium } from 'playwright';
const MIN=+(process.argv[2]||35);
const SAATEN=(process.argv[3]||'42,7,99,11,2024,777').split(',').map(Number);
const PORT=+(process.argv[4]||8901);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const summe={land:0, bauten:0, soldaten:0, posten:0, siedler:0, eisen:0, kohle:0, waffen:0};
for(const saat of SAATEN){
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
  await page.selectOption('#f-ais','1');
  await page.fill('#f-seed', String(saat));
  await page.click('#f-start');
  await page.waitForFunction(()=>window.__ui && window.__ui.game, null, {timeout:15000});
  const r=await page.evaluate((MIN)=>{
    const g=window.__ui.game, m=g.map;
    g.players[0].ai=true; g.players[0].aiLevel=2;
    const erzeugt={};
    const orig=g.wareAustragen.bind(g);
    g.wareAustragen=(b)=>{ if(b.player===0){ const gut=g.prodGood(b); if(gut) erzeugt[gut]=(erzeugt[gut]||0)+1; } return orig(b); };
    for(let t=0;t<MIN*600;t++) g.step();
    let land=0; for(let i=0;i<m.owner.length;i++) if(m.owner[i]===0) land++;
    const b0=[...g.buildings.values()].filter(b=>b.player===0);
    // Militaerposten: fertige Gebaeude mit Besatzungsliste
    const posten=b0.filter(b=>b.state==='done' && b.soldiers).length;
    const baustellen=b0.filter(b=>b.state==='build').length;
    const milBau=b0.filter(b=>b.state==='build' && b.soldiers).length;
    return {land, bauten:b0.filter(b=>b.state==='done').length,
      soldaten:g.soldierCount(0), posten, baustellen, milBau,
      siedler:g.settlerStats(0).total,
      eisen:erzeugt.iron||0, kohle:erzeugt.coal||0, erz:erzeugt.ironore||0,
      waffen:(erzeugt.sword||0)+(erzeugt.shield||0)+(erzeugt.spear||0)+(erzeugt.bow||0)};
  }, MIN);
  console.log(`Saat ${saat}: Land ${r.land} Bauten ${r.bauten} Posten ${r.posten}`
    + ` (Bau ${r.milBau}/${r.baustellen}) Soldaten ${r.soldaten} Siedler ${r.siedler}`
    + ` | Kohle ${r.kohle} Erz ${r.erz} Eisen ${r.eisen} Waffen ${r.waffen}`);
  summe.land+=r.land; summe.bauten+=r.bauten; summe.soldaten+=r.soldaten;
  summe.posten+=r.posten; summe.siedler+=r.siedler; summe.eisen+=r.eisen;
  summe.kohle+=r.kohle; summe.waffen+=r.waffen;
  await page.close();
}
const n=SAATEN.length;
console.log(`\nSCHNITT ueber ${n} Saaten: Land ${(summe.land/n).toFixed(0)} Bauten ${(summe.bauten/n).toFixed(1)}`
  + ` Posten ${(summe.posten/n).toFixed(1)} Soldaten ${(summe.soldaten/n).toFixed(1)}`
  + ` Siedler ${(summe.siedler/n).toFixed(0)}`);
console.log(`SUMMEN: Kohle ${summe.kohle} Eisen ${summe.eisen} Waffen ${summe.waffen}`);
await br.close();
