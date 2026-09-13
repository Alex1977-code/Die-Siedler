// R8 Teil 2: Warum wartet eine Baustelle auf den Bauarbeiter?
//
// Nach der Materialaenderung (v148) sind 74,6 Prozent der Baustellenzeit
// Warten auf den Bauarbeiter. Der Ablauf kennt mehrere Gruende, und sie
// verlangen ganz verschiedene Gegenmittel:
//   planierer  Phase 1 laeuft noch (Planierer ebnet erst)
//   hammerTor  noch KEIN Material da - der Hammer wird bewusst erst
//              gebunden, wenn ein Stueck Baumaterial liegt (sonst fressen
//              leere Baustellen alle Haemmer, siehe K5)
//   keinHammer Material liegt, aber kein Hammer im Lager frei
//   unterwegs  Bauarbeiter laeuft noch zur Baustelle
//   daNichtBau Bauarbeiter ist da, baut aber trotzdem nicht
//
//   node tools/r8b-bauarbeiter.mjs [ticks] [saaten...]
import { chromium } from 'playwright';
const TICKS=+(process.argv[2]||9000);
const SAATEN=process.argv.slice(3).length? process.argv.slice(3)
  : ['11','23','7','41','58','3'];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const alle=[];
for(const saat of SAATEN){
  await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
  await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
  await p.fill('#f-seed',saat); await p.click('#f-start');
  await p.waitForTimeout(2200);
  alle.push(await p.evaluate(async ({TICKS,saat})=>{
    const g=window.__ui.game;
    const { BLD } = await import('/js/core.js');
    g.players[0].ai=true; g.players[0].aiLevel=2; g.players[1].aiLevel=2;
    const z={planierer:0, hammerTor:0, keinHammer:0, unterwegs:0, daNichtBau:0,
             material:0, gebaut:0};
    // Haemmer und Bauarbeiter im Zeitverlauf
    let haemmerSumme=0, bauerSumme=0, proben=0;
    for(let t=0;t<TICKS;t++){
      g.step();
      for(const x of g.buildings.values()){
        if(x.state!=='build') continue;
        const kosten=BLD[x.type].cost;
        const needB=kosten.board||0, needS=kosten.stone||0;
        const noetig=needB+needS;
        const da=Math.min(needB,x.stock.board||0)+Math.min(needS,x.stock.stone||0);
        const grenze=80+30*da;
        const u=x.builderId!=null? g.units.find(v=>v.id===x.builderId) : null;
        const baut = !!(u && u.type==='builder' && u.state==='work') && (x.progress||0)<grenze;
        if(baut){ z.gebaut++; continue; }
        if((x.progress||0)>=grenze){ z.material++; continue; }   // Material bremst
        if(!x.leveled && x.levelerId!=null){ z.planierer++; continue; }
        if(x.builderId==null){
          if(noetig>0 && ((x.stock.board||0)+(x.stock.stone||0))===0){ z.hammerTor++; continue; }
          z.keinHammer++; continue;
        }
        if(u && u.state==='toSite'){ z.unterwegs++; continue; }
        z.daNichtBau++;
      }
      if(t%100===0){
        proben++;
        let h=0; for(const x of g.buildings.values()) if(x.inv) h+=(x.inv.hammer||0);
        haemmerSumme+=h;
        bauerSumme+=g.units.filter(v=>v.type==='builder').length;
      }
    }
    const summe=z.planierer+z.hammerTor+z.keinHammer+z.unterwegs+z.daNichtBau+z.material+z.gebaut;
    const pct=(v)=>+(v/summe*100).toFixed(1);
    return {saat, ...z, summe,
      anteile:{planierer:pct(z.planierer), hammerTor:pct(z.hammerTor),
               keinHammer:pct(z.keinHammer), unterwegs:pct(z.unterwegs),
               daNichtBau:pct(z.daNichtBau), material:pct(z.material), gebaut:pct(z.gebaut)},
      haemmerImLager:+(haemmerSumme/proben).toFixed(1),
      bauarbeiterUnterwegs:+(bauerSumme/proben).toFixed(1)};
  }, {TICKS,saat}));
}
const felder=['planierer','hammerTor','keinHammer','unterwegs','daNichtBau','material','gebaut'];
const su={}; for(const f of felder) su[f]=alle.reduce((a,x)=>a+x[f],0);
const g2=Object.values(su).reduce((a,b2)=>a+b2,0);
const ant={}; for(const f of felder) ant[f]=+(su[f]/g2*100).toFixed(1);
console.log(JSON.stringify({saaten:SAATEN.length, ticks:TICKS, anteileGesamt:ant,
  haemmerImLagerSchnitt:+(alle.reduce((a,x)=>a+x.haemmerImLager,0)/alle.length).toFixed(1),
  bauarbeiterSchnitt:+(alle.reduce((a,x)=>a+x.bauarbeiterUnterwegs,0)/alle.length).toFixed(1),
  einzeln:alle.map(x=>({saat:x.saat, ...x.anteile, haemmer:x.haemmerImLager, bauer:x.bauarbeiterUnterwegs}))
}, null, 1));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
