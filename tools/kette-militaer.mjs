// PASST DIE KETTE BIS ZUM MILITAER?
//
// Ein Soldat kostet zwei Dinge: eine WAFFE (Waffenschmiede: Eisen + Kohle,
// dahinter Eisenhuette, Eisen- und Kohlebergwerk) und BIER (Brauerei:
// Getreide + Wasser, dahinter Bauernhof und Brunnen). Faellt eines der
// beiden aus, entsteht kein Rekrut - egal wie voll das andere Lager ist.
//
// Gemessen wird deshalb die GANZE Kette, und zwar OHNE die Materialhilfe
// der KI (bonusMul 0). Die Hilfe legt Bretter, Werkzeug, Bier und Waffen
// direkt ins Lager; mit ihr misst man nicht die Wirtschaft, sondern das
// Geschenk. Ohne sie steht da, was eine Siedlung wirklich schafft - und
// das ist die Lage, in der auch ein Mensch spielt.
//
//   node tools/kette-militaer.mjs [minuten] [saaten]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const MIN=+(process.argv[2]||60);
const SAATEN=(process.argv[3]||'42,7,99,11').split(',').map(Number);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const alle=[];
for(const saat of SAATEN){
  const page=await br.newPage({viewport:{width:900,height:600}});
  await starteSpiel(page,{saat, groesse:'M', gegner:'1'});
  const r=await page.evaluate(([MIN])=>{
    const g=window.__ui.game;
    const p=g.players[0];
    p.ai=true; p.aiLevel=2;
    // Materialhilfe abschalten: gemessen werden soll die Wirtschaft
    const G=g.constructor, alt=G.diffMods;
    G.diffMods=function(d){ const r=alt.call(this,d); return {...r, bonusMul:0}; };

    const erzeugt={};
    const origAus=g.wareAustragen.bind(g);
    g.wareAustragen=(b)=>{ if(b.player===0){ const gut=g.prodGood(b); if(gut) erzeugt[gut]=(erzeugt[gut]||0)+1; } return origAus(b); };
    let rekruten=0; g.onRecruit=()=>rekruten++;

    // Wartezeiten der beiden Militaerbetriebe: woran haengt es wirklich?
    const wartet={waffenEisen:0, waffenKohle:0, waffenBeides:0, waffenSatt:0,
                  bierGetreide:0, bierWasser:0, bierBeides:0,
                  huetteErz:0, huetteKohle:0, huetteBeides:0};
    const WAFFEN=['sword','shield','spear','bow'];
    const ersteWaffe={}, marken=[];
    let ersterRekrut=null, erstesEisen=null, erstesBier=null;

    for(let t=0;t<MIN*600;t++){
      g.step();
      // je Takt nachsehen, worauf die Schluesselbetriebe warten
      for(const b of g.buildings.values()){
        if(b.player!==0 || b.state!=='done' || b.paused) continue;
        if(b.type==='armory'){
          const e=(b.stock.iron||0)>0, k=(b.stock.coal||0)>0;
          if(e&&k) wartet.waffenSatt++;
          else if(!e&&!k) wartet.waffenBeides++;
          else if(!e) wartet.waffenEisen++;
          else wartet.waffenKohle++;
        } else if(b.type==='brewery'){
          const gr=(b.stock.grain||0)>0, w=(b.stock.water||0)>0;
          if(!gr&&!w) wartet.bierBeides++;
          else if(!gr) wartet.bierGetreide++;
          else if(!w) wartet.bierWasser++;
        } else if(b.type==='smelter'){
          const e=(b.stock.ironore||0)>0, k=(b.stock.coal||0)>0;
          if(!e&&!k) wartet.huetteBeides++;
          else if(!e) wartet.huetteErz++;
          else if(!k) wartet.huetteKohle++;
        }
      }
      if(erstesEisen===null && (erzeugt.iron||0)>0) erstesEisen=t;
      if(erstesBier===null && (erzeugt.beer||0)>0) erstesBier=t;
      for(const w of WAFFEN) if(ersteWaffe[w]===undefined && (erzeugt[w]||0)>0) ersteWaffe[w]=t;
      if(ersterRekrut===null && rekruten>0) ersterRekrut=t;
      if(t%3000===2999){                      // alle 5 Spielminuten eine Marke
        const inv=g.invTotal(0);
        marken.push({min:Math.round((t+1)/600),
          waffen:WAFFEN.reduce((a,w)=>a+(erzeugt[w]||0),0),
          bier:erzeugt.beer||0, eisen:erzeugt.iron||0, brot:erzeugt.bread||0,
          rekruten, soldaten:g.soldierCount(0),
          lagerBier:inv.beer||0, lagerWaffen:WAFFEN.reduce((a,w)=>a+(inv[w]||0),0)});
      }
    }
    const zaehl=(typ)=>[...g.buildings.values()].filter(b=>b.player===0&&b.type===typ&&b.state==='done').length;
    return {erzeugt, rekruten, soldaten:g.soldierCount(0),
      siedler:g.settlerStats(0).total, marken, wartet,
      ersterRekrut, erstesEisen, erstesBier, ersteWaffe,
      bauten:{hof:zaehl('farm'), muehle:zaehl('mill'), baecker:zaehl('bakery'),
        brunnen:zaehl('well'), brauerei:zaehl('brewery'), huette:zaehl('smelter'),
        waffen:zaehl('armory'), werkzeug:zaehl('toolsmith'),
        kohle:zaehl('coalmine'), eisen:zaehl('ironmine'),
        holz:zaehl('woodcutter'), saege:zaehl('sawmill'), stein:zaehl('quarry')},
      fertig:[...g.buildings.values()].filter(b=>b.player===0&&b.state==='done').length};
  }, [MIN]);
  alle.push({saat, ...r});
  const e=r.erzeugt;
  const waffen=(e.sword||0)+(e.shield||0)+(e.spear||0)+(e.bow||0);
  const tm=(t)=> t===null||t===undefined? '-' : `${Math.floor(t/600)}:${String(Math.floor((t%600)/10)).padStart(2,'0')}`;
  console.log(`\nSaat ${saat} - ${MIN} Spielminuten, OHNE Materialhilfe`);
  console.log(`  Bauten: Hof ${r.bauten.hof} Muehle ${r.bauten.muehle} Baecker ${r.bauten.baecker}`
    + ` Brunnen ${r.bauten.brunnen} Brauerei ${r.bauten.brauerei}`
    + ` | Kohle ${r.bauten.kohle} Eisen ${r.bauten.eisen} Huette ${r.bauten.huette}`
    + ` Waffen ${r.bauten.waffen} Werkzeug ${r.bauten.werkzeug} | fertig gesamt ${r.fertig}`);
  console.log(`  erzeugt: Kohle ${e.coal||0} Erz ${e.ironore||0} Eisen ${e.iron||0}`
    + ` | Getreide ${e.grain||0} Wasser ${e.water||0} Bier ${e.beer||0} Brot ${e.bread||0}`
    + ` | WAFFEN ${waffen}`);
  console.log(`  erstes Eisen ${tm(r.erstesEisen)}  erstes Bier ${tm(r.erstesBier)}`
    + `  erste Waffe ${tm(Math.min(...Object.values(r.ersteWaffe).concat([Infinity]))===Infinity?null:Math.min(...Object.values(r.ersteWaffe)))}`
    + `  erster Rekrut ${tm(r.ersterRekrut)}`);
  console.log(`  Rekruten ${r.rekruten}  Soldaten ${r.soldaten}  Siedler ${r.siedler}`);
  const w=r.wartet;
  const wg=w.waffenEisen+w.waffenKohle+w.waffenBeides+w.waffenSatt;
  if(wg) console.log(`  Waffenschmiede wartete: ohne Eisen ${(w.waffenEisen/wg*100).toFixed(0)}%`
    + ` ohne Kohle ${(w.waffenKohle/wg*100).toFixed(0)}% ohne beides ${(w.waffenBeides/wg*100).toFixed(0)}%`
    + ` versorgt ${(w.waffenSatt/wg*100).toFixed(0)}%`);
  const hg=w.huetteErz+w.huetteKohle+w.huetteBeides;
  if(hg) console.log(`  Eisenhuette ohne Nachschub: Erz fehlt ${(w.huetteErz/hg*100).toFixed(0)}%`
    + ` Kohle fehlt ${(w.huetteKohle/hg*100).toFixed(0)}% beides ${(w.huetteBeides/hg*100).toFixed(0)}%`);
  const bg=w.bierGetreide+w.bierWasser+w.bierBeides;
  if(bg) console.log(`  Brauerei ohne Nachschub: Getreide fehlt ${(w.bierGetreide/bg*100).toFixed(0)}%`
    + ` Wasser fehlt ${(w.bierWasser/bg*100).toFixed(0)}% beides ${(w.bierBeides/bg*100).toFixed(0)}%`);
  console.log('  Verlauf (Minute: Waffen/Bier/Rekruten/Soldaten): '
    + r.marken.map(x=>`${x.min}: ${x.waffen}/${x.bier}/${x.rekruten}/${x.soldaten}`).join('  '));
  await page.close();
}
// Gesamtbild
const n=alle.length;
const s=(f)=>alle.reduce((a,x)=>a+f(x),0);
const waffenS=s(x=>(x.erzeugt.sword||0)+(x.erzeugt.shield||0)+(x.erzeugt.spear||0)+(x.erzeugt.bow||0));
console.log(`\n=== ${n} Saaten, je ${MIN} Spielminuten, ohne Materialhilfe ===`);
console.log(`Summen: Kohle ${s(x=>x.erzeugt.coal||0)} Erz ${s(x=>x.erzeugt.ironore||0)}`
  + ` Eisen ${s(x=>x.erzeugt.iron||0)} Bier ${s(x=>x.erzeugt.beer||0)} Waffen ${waffenS}`
  + ` Rekruten ${s(x=>x.rekruten)}`);
console.log(`Schnitt je Partie: Waffen ${(waffenS/n).toFixed(1)} Bier ${(s(x=>x.erzeugt.beer||0)/n).toFixed(1)}`
  + ` Rekruten ${(s(x=>x.rekruten)/n).toFixed(1)} Soldaten ${(s(x=>x.soldaten)/n).toFixed(1)}`
  + ` Siedler ${(s(x=>x.siedler)/n).toFixed(0)}`);
console.log(`Saaten mit eigenem Eisen: ${alle.filter(x=>(x.erzeugt.iron||0)>0).length}/${n}`
  + `  mit eigener Waffe: ${alle.filter(x=>((x.erzeugt.sword||0)+(x.erzeugt.shield||0)+(x.erzeugt.spear||0)+(x.erzeugt.bow||0))>0).length}/${n}`
  + `  mit Bier: ${alle.filter(x=>(x.erzeugt.beer||0)>0).length}/${n}`);
await br.close();
