// KD4: Meldungs- und Ziel-HUD-Test.
//  1. Bergwerk-Vorwarnung (R7/v143, vom Kritiker nie gesehen): "geht zur
//     Neige" muss VOR "Vorkommen erschoepft" kommen.
//  2. Ziel-Chip: dauerhaft sichtbar, zeigt das offene Ziel.
//  3. Bier-Warnung traegt eine Handlungsanleitung (Brauerei).
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';

const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const t0=await starteSpiel(page, {saat:42, groesse:'S', gegner:'1'});
if(t0!==0) throw new Error('Start nicht bei Takt 0');
const out=await page.evaluate(()=>{
  const ui=window.__ui, g=ui.game, m=g.map;
  const r={};
  // ---- 1. Bergwerk-Vorwarnung ----
  // Kohlemine mitten ins Gebirge setzen, Vorkommen kuenstlich auf 7 Stueck
  let spot=-1;
  for(let i=0;i<m.terr.length;i++){
    if(m.terrOkMine(i) && m.bld[i]<0){ spot=i; break; }
  }
  r.spot=spot;
  if(spot>=0){
    m.owner[spot]=0; for(const q of m.nbs(spot)) m.owner[q]=0;
    m.oreT[spot]=1; m.oreA[spot]=7;
    for(const q of m.nbs(spot)){ m.oreT[q]=0; m.oreA[q]=0; }
    const b=g.spawnBuilding(0,'coalmine',spot,true);
    const mine=b && b.b? b.b : b;                    // je nach Rueckgabeform
    if(mine){
      if(mine.worker) mine.worker.present=true;
      mine.stock=mine.stock||{}; mine.stock.fish=30;
      // produzieren lassen: Ausgang regelmaessig leeren, damit b.out<4 bleibt
      for(let k=0;k<12000 && !g.msgs.some(x=>/erschöpft/.test(x.txt));k++){
        g.step();
        if(k%50===0){ mine.out=0; mine.stock.fish=30; }
      }
      const neige=g.msgs.findIndex(x=>/zur Neige/.test(x.txt));
      const leer=g.msgs.findIndex(x=>/erschöpft/.test(x.txt));
      r.neigeIdx=neige; r.leerIdx=leer;
      r.neigeVorLeer = neige>=0 && leer>=0 && neige<leer;
      r.oreRest=g.oreLeft(mine);
    } else r.mineFehlt=true;
  }
  // ---- 3. Bier-Warnung mit Handlungsanleitung ----
  const hq=g.buildings.get(g.players[0].hq);
  hq.inv.beer=0; hq.inv.sword=5; hq.inv.shield=5;
  g.players[0]._bierMsgT=-9999;
  for(let k=0;k<200;k++) g.step();
  const bier=g.msgs.filter(x=>/Bier/.test(x.txt)).map(x=>x.txt);
  r.bierMeldung=bier[bier.length-1]||null;
  r.bierMitTipp=!!r.bierMeldung && /Brauerei/.test(r.bierMeldung);
  return r;
});
// ---- 2. Ziel-Chip sichtbar? (freies Spiel mit Gegner hat "Besiege alle Gegner")
await page.evaluate(()=>{ window.__ui.updateHud(); });
const chip=await page.evaluate(()=>{
  const c=document.getElementById('obj-chip');
  return { da: !!c && !c.classList.contains('hidden'), text: c? c.textContent:'' };
});
out.chip=chip;
console.log(JSON.stringify(out,null,1));
const ok= out.neigeVorLeer===true && out.bierMitTipp===true && chip.da && /🎯/.test(chip.text);
console.log(ok? 'KD4-MELDUNGEN OK':'KD4-MELDUNGEN FEHLER');
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
process.exit(ok&&!errors.length?0:1);
