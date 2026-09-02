// FAHNENLAST: kostet es Strassenkapazitaet, wenn Betriebe schon ab EINER
// Ware abliefern statt ab zwei?
//
// Die Drossel in tickProduction ist damit begruendet, die Strassen fuer
// Wichtiges freizuhalten. Das laesst sich pruefen: eine volle KI-Partie
// laufen lassen und zaehlen, was auf den Fahnen liegt, wie viele Waren
// insgesamt entstehen und wie viele Betriebe stehen.
//
//   node tools/fahnenlast.mjs [takte]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const TAKTE=+(process.argv[2]||40000);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:640}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:23, groesse:'M', gegner:'1'});
const erg=await page.evaluate((TAKTE)=>{
  const g=window.__ui.game;
  let last=0, proben=0, maxLast=0, ueber8=0;
  for(let t=0;t<TAKTE;t++){
    g.step();
    if(t%100===0){
      let n=0, m8=0;
      for(const it of g.flagItems.values()){ n+=it.length; if(it.length>=8) m8++; }
      last+=n; proben++; if(n>maxLast) maxLast=n; ueber8+=m8;
    }
  }
  const zaehl=(pl)=>{
    let bauten=0, waren=0;
    for(const b of g.buildings.values()){
      if(b.player!==pl) continue;
      if(b.state==='done') bauten++;
      if(b.inv) for(const k in b.inv) waren+=b.inv[k];
    }
    return {bauten, waren};
  };
  return { fahnenlastMittel:+(last/proben).toFixed(1), fahnenlastMax:maxLast,
           volleFahnen:+(ueber8/proben).toFixed(2),
           strassen:g.roads.size, spieler0:zaehl(0), spieler1:zaehl(1) };
}, TAKTE);
console.log(JSON.stringify(erg));
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,3));
await br.close();
