// WARUM BAUT DIE KI KEIN KOHLEBERGWERK?
//
// Beobachtung aus der v194-Gegenprobe: ueber drei Saaten und 35 Minuten
// entstanden 1-2 Eisenbergwerke, aber KEIN einziges Kohlebergwerk - und
// damit auch nie Eisen, weil der Eisenhuette die Kohle fehlt.
//
// Gemessen wird an der Entscheidung selbst: liegt ueberhaupt Kohle im
// Gebiet? Steht 'coalmine' auf der Wunschliste? Und wenn ja, woran
// scheitert der Bau - Material, Bauplatz oder Baustellendeckel?
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const MIN=+(process.argv[2]||35);
const SAATEN=(process.argv[3]||'42,7,99').split(',').map(Number);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(const saat of SAATEN){
  const page=await br.newPage({viewport:{width:900,height:600}});
  await starteSpiel(page,{saat, groesse:'M', gegner:'1'});
  const r=await page.evaluate((MIN)=>{
    const g=window.__ui.game, m=g.map;
    const p=g.players[0];
    p.ai=true; p.aiLevel=2;
    const spur={wunschKohle:0, wunschEisen:0, erzDaKohle:0, erzDaEisen:0,
      versuchKohle:0, kohleGebaut:0, ablehnKohle:{}};
    // Mitschreiben, was placeBuilding zu einem Kohlebergwerk sagt
    const orig=g.placeBuilding.bind(g);
    g.placeBuilding=(pl,typ,node)=>{
      const res=orig(pl,typ,node);
      if(pl===0 && typ==='coalmine'){
        spur.versuchKohle++;
        if(res.ok) spur.kohleGebaut++;
        else spur.ablehnKohle[res.reason||'?']=(spur.ablehnKohle[res.reason||'?']||0)+1;
      }
      return res;
    };
    // jede erzeugte Ware mitzaehlen
    const erzeugt={};
    const origAus=g.wareAustragen.bind(g);
    g.wareAustragen=(b)=>{ if(b.player===0){ const gut=g.prodGood(b); if(gut) erzeugt[gut]=(erzeugt[gut]||0)+1; } return origAus(b); };
    for(let t=0;t<MIN*600;t++){
      g.step();
      if(t%600===0){
        if(g.aiErzBekannt(p,'coalmine')) spur.erzDaKohle++;
        if(g.aiErzBekannt(p,'ironmine')) spur.erzDaEisen++;
      }
    }
    // Wie viel Kohle liegt ueberhaupt in Reichweite, und wem gehoert sie?
    let kohleGesamt=0, kohleEigen=0, kohleNiemand=0;
    let eisenGesamt=0, eisenEigen=0;
    for(let i=0;i<m.oreT.length;i++){
      if(m.oreT[i]===1 && m.oreA[i]>0){
        kohleGesamt++;
        if(m.owner[i]===0) kohleEigen++;
        else if(m.owner[i]<0) kohleNiemand++;
      }
      if(m.oreT[i]===2 && m.oreA[i]>0){
        eisenGesamt++;
        if(m.owner[i]===0) eisenEigen++;
      }
    }
    // Bauplatzprobe: gibt es auf dem eigenen Kohlevorkommen einen Platz?
    let plaetze=0, ersterGrund=null;
    for(let i=0;i<m.oreT.length && plaetze<3;i++){
      if(m.oreT[i]!==1 || m.oreA[i]<=0 || m.owner[i]!==0) continue;
      for(const n of [i,...m.nbs(i)]){
        const c=g.canBuild(0,'coalmine',n);
        if(c.ok){ plaetze++; break; }
        if(!ersterGrund) ersterGrund=c.reason||'?';
      }
    }
    const b0=[...g.buildings.values()].filter(b=>b.player===0);
    const inv=g.invTotal(0);
    // Zustand JEDER Mine: fertig? besetzt? Werkzeug? Erz im Foerderring?
    const minenBild=b0.filter(b=>b.type==='coalmine'||b.type==='ironmine').map(b=>{
      let ring=0;
      for(const q of [b.node,...m.nbs(b.node)]) if(m.oreT[q]===(b.type==='coalmine'?1:2)) ring+=m.oreA[q];
      return {typ:b.type==='coalmine'?'Kohle':'Eisen', zustand:b.state,
        fortschritt:Math.round((b.progress||0)),
        besetzt:!!(b.worker&&b.worker.present), werkzeug:b.toolGood||null,
        planiert:!!b.leveled, bauerDa:!!b.bauerDa, erschoepft:!!b.depleted,
        erzImRing:ring, out:b.out||0,
        essen:['fish','bread','meat'].reduce((a,f)=>a+(b.stock[f]||0),0),
        angeschlossen:g.compOf(b.door)!==undefined};
    });
    return {spur, kohleGesamt, kohleEigen, kohleNiemand, eisenGesamt, eisenEigen,
      plaetze, ersterGrund, minenBild, erzeugt,
      huettenBild: b0.filter(b=>b.type==='smelter').map(b=>({zustand:b.state,
        besetzt:!!(b.worker&&b.worker.present), erz:b.stock.ironore||0, kohle:b.stock.coal||0,
        kommtErz:b.incoming.ironore||0, kommtKohle:b.incoming.coal||0, out:b.out||0,
        weg:g.compOf(b.door)!==undefined})),
      kohleminen:b0.filter(b=>b.type==='coalmine').length,
      eisenminen:b0.filter(b=>b.type==='ironmine').length,
      huetten:b0.filter(b=>b.type==='smelter').length,
      baustellen:b0.filter(b=>b.state==='build').length,
      fertig:b0.filter(b=>b.state==='done').length,
      lagerKohle:inv.coal||0, lagerErz:inv.ironore||0, lagerBrett:inv.board||0, lagerStein:inv.stone||0};
  }, MIN);
  console.log(`Saat ${saat}:`);
  console.log(`  Kohle auf der Karte ${r.kohleGesamt}, davon im eigenen Gebiet ${r.kohleEigen} (herrenlos ${r.kohleNiemand})`);
  console.log(`  Eisen auf der Karte ${r.eisenGesamt}, davon eigen ${r.eisenEigen}`);
  console.log(`  Vorkommen bekannt (Stichproben je Minute): Kohle ${r.spur.erzDaKohle}/${Math.ceil(35)} Eisen ${r.spur.erzDaEisen}/35`);
  console.log(`  Bauversuche Kohlebergwerk: ${r.spur.versuchKohle} (gebaut ${r.spur.kohleGebaut}) Ablehnungen ${JSON.stringify(r.spur.ablehnKohle)}`);
  console.log(`  Bauplaetze auf eigenem Kohlevorkommen: ${r.plaetze}${r.ersterGrund?` (erster Ablehnungsgrund: ${r.ersterGrund})`:''}`);
  for(const b of r.minenBild) console.log(`     ${b.typ}: ${b.zustand} Fortschritt ${b.fortschritt}`
    + ` besetzt ${b.besetzt} Werkzeug ${b.werkzeug} planiert ${b.planiert} Bauer ${b.bauerDa}`
    + ` erschoepft ${b.erschoepft} ErzImRing ${b.erzImRing} out ${b.out} Essen ${b.essen} Weg ${b.angeschlossen}`);
  console.log(`  erzeugt: Kohle ${r.erzeugt.coal||0} Eisenerz ${r.erzeugt.ironore||0} Eisen ${r.erzeugt.iron||0} Bretter ${r.erzeugt.board||0}`);
  for(const h of r.huettenBild) console.log(`     Eisenhuette: ${h.zustand} besetzt ${h.besetzt}`
    + ` Erz ${h.erz}(+${h.kommtErz}) Kohle ${h.kohle}(+${h.kommtKohle}) out ${h.out} Weg ${h.weg}`);
  console.log(`  Ende: Kohleminen ${r.kohleminen} Eisenminen ${r.eisenminen} Huetten ${r.huetten}`
    + ` | Bauten ${r.fertig} Baustellen ${r.baustellen} | Lager Brett ${r.lagerBrett} Stein ${r.lagerStein} Kohle ${r.lagerKohle} Erz ${r.lagerErz}`);
  await page.close();
}
await br.close();
