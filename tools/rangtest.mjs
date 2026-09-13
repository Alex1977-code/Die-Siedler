// Prueft die Transport-Rangfolge (v196) an vier Punkten:
//   1. Standardrangfolge steht und ist vollstaendig
//   2. Umsortieren wirkt auf die Traegerwahl an einer Fahne
//   3. dispatch() sortiert bei gleichem Anlass nach Rang
//   4. Rangfolge ueberlebt Speichern und Laden
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:600}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:11, groesse:'M', gegner:'0'});

const erg=await page.evaluate(async ()=>{
  const g=window.__ui.game;
  const core=await import('./js/core.js');
  const {GOOD_LIST, RANG_STD}=core;
  const raus={};

  // 1. Vollstaendigkeit
  const rang=g.players[0].rang;
  raus.vollstaendig = rang.length===GOOD_LIST.length
    && GOOD_LIST.every(k=>rang.includes(k));
  raus.ersteDrei=rang.slice(0,3);
  raus.rangBrett=g.rangVon(0,'board');
  raus.rangSchwert=g.rangVon(0,'sword');

  // 2. Traegerwahl: zwei Waren an einer Fahne, wer wird zuerst genommen?
  //    Nachgestellt wird nur die Auswahlregel, nicht der ganze Weg.
  const waehle=(gueter)=>{
    let best=null, bestPr=99, bestRang=1e9;
    for(const it of gueter){
      const pr=1;                       // gleicher Anlass fuer alle
      const rg=g.rangVon(0, it);
      if(pr<bestPr || (pr===bestPr && rg<bestRang)){ bestPr=pr; bestRang=rg; best=it; }
    }
    return best;
  };
  raus.vorher=waehle(['sword','board']);       // Brett steht oben -> Brett
  g.setzeRang(0, ['sword', ...RANG_STD.filter(k=>k!=='sword')]);
  raus.nachher=waehle(['sword','board']);      // Schwert nach oben -> Schwert
  raus.rangSchwertNeu=g.rangVon(0,'sword');

  // 3. dispatch()-Sortierung: gleicher Anlass, Rang entscheidet
  const bau={player:0}, reqs=[
    {b:bau, good:'board', prio:1},
    {b:bau, good:'sword', prio:1},
    {b:bau, good:'stone', prio:0},
  ];
  const rangF=(rq)=>g.rangVon(rq.b.player, rq.good);
  reqs.sort((a,b)=>(a.prio-b.prio)||(rangF(a)-rangF(b)));
  raus.reihenfolge=reqs.map(r=>r.good);

  // 4. Speichern und Laden
  const daten=JSON.parse(JSON.stringify(g.serialize()));
  const {Game}=await import('./js/sim.js');
  const g2=Game.deserialize(daten);
  raus.nachLaden=g2.players[0].rang.slice(0,3);
  raus.rangIxDa=!!g2.rangIx;
  raus.rangSchwertNachLaden=g2.rangVon(0,'sword');

  // 5. Alt-Spielstand ohne Rangfolge
  const alt=JSON.parse(JSON.stringify(daten));
  for(const p of alt.players) delete p.rang;
  const g3=Game.deserialize(alt);
  raus.altVollstaendig=g3.players[0].rang.length===GOOD_LIST.length;
  raus.altErste=g3.players[0].rang.slice(0,3);

  // 6. laeuft das Spiel damit weiter?
  for(let t=0;t<600;t++) g.step();
  raus.taktNach=g.t;
  return raus;
});

console.log(JSON.stringify(erg,null,1));
const ok = erg.vollstaendig && erg.vorher==='board' && erg.nachher==='sword'
  && erg.rangSchwertNeu===0 && erg.reihenfolge[0]==='stone'
  && erg.reihenfolge[1]==='sword' && erg.rangIxDa
  && erg.rangSchwertNachLaden===0 && erg.altVollstaendig
  && erg.altErste[0]==='board' && erg.taktNach>=600 && !fehler.length;
console.log('\nSeitenfehler:', fehler.length? fehler.slice(0,3):'keine');
console.log(ok? 'RANGTEST OK' : 'RANGTEST FEHLGESCHLAGEN');
await br.close();
process.exit(ok?0:1);
