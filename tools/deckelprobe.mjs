// DECKELPROBE: zaehlt der Fahnendeckel eigene oder alle Waren?
//
// Gefragt ist nicht die Ausbringung eines Betriebs (die haengt an zu vielen
// Dingen), sondern die ENTSCHEIDUNG: gilt ein Lager noch als Quelle, wenn
// auf seiner Tuerfahne fremde Ladung liegt? Das laesst sich exakt pruefen,
// indem man findSource() direkt befragt.
//
//   node deckel.mjs [port]
import { chromium } from 'playwright';
const PORT=+(process.argv[2]||8901);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:600}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
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
await page.waitForFunction(()=>window.__ui && window.__ui.game, null, {timeout:15000});

const erg=await page.evaluate(async ()=>{
  const g=window.__ui.game;
  const hq=g.buildings.get(g.players[0].hq);
  hq.inv=hq.inv||{}; hq.inv.board=20;
  // compOf kennt nur Fahnen im Wegenetz - ohne Strasse gibt es kein Netz.
  // Also einen kurzen Weg von der HQ-Fahne weg bauen.
  let ziel=-1;
  for(const nb of g.map.nbs(hq.door)){
    for(const nb2 of g.map.nbs(nb)){
      if(nb2===hq.door) continue;
      if(g.buildRoad(0,[hq.door, nb, nb2])){ ziel=nb2; break; }
    }
    if(ziel>=0) break;
  }
  const comp=g.compOf(hq.door);
  const diag={door:hq.door, ziel, comp:comp===undefined?'undefined':comp, invBoard:hq.inv.board};
  const out=[];
  // Fremde Ladung: weder Quelle noch Ziel ist das HQ
  const fremdling={good:'stone', destB:-99, srcB:-98};
  for(const n of [0,4,7,8,10,12,14]){
    const items=[];
    for(let k=0;k<n;k++) items.push({...fremdling});
    g.flagItems.set(hq.door, items);
    const q=g.findSource(0,'board', ziel, comp);
    out.push({fremd:n, gefunden: q? (q.id===hq.id? 'HQ':'anderes') : 'NICHTS'});
  }
  // Gegenprobe: EIGENE Ladung muss weiterhin deckeln
  const eigen=[];
  for(const n of [0,4,7,8,10]){
    const items=[];
    for(let k=0;k<n;k++) items.push({good:'stone', destB:-99, srcB:hq.id});
    g.flagItems.set(hq.door, items);
    const q=g.findSource(0,'board', ziel, comp);
    eigen.push({eigen:n, gefunden: q? (q.id===hq.id? 'HQ':'anderes') : 'NICHTS'});
  }
  return {fremd:out, eigen, diag};
});

console.log('DECKELPROBE  findSource() sucht Bretter, einziges Lager ist das HQ\n');
console.log('FREMDE Ladung auf der HQ-Fahne (Durchgangsverkehr):');
for(const r of erg.fremd) console.log(`   ${String(r.fremd).padStart(2)} Posten -> Quelle: ${r.gefunden}`);
console.log('\nEIGENE Ladung auf der HQ-Fahne (das HQ hat sie hingestellt):');
for(const r of erg.eigen) console.log(`   ${String(r.eigen).padStart(2)} Posten -> Quelle: ${r.gefunden}`);
console.log('\nDiagnose:', JSON.stringify(erg.diag));
console.log('\nSeitenfehler:', fehler.length? fehler.slice(0,3):'keine');
await br.close();
