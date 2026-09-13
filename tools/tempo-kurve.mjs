// Wie schnell waechst eine Siedlung heute?
//
// Grundlage fuer die Frage "wie schnell SOLL sie wachsen". Ohne so eine
// Zielvorstellung ist jede Beschleunigung willkuerlich - deshalb misst
// dieses Werkzeug erst einmal den Ist-Zustand, alle fuenf Spielminuten,
// gemittelt ueber viele Saaten.
//
// Gemessen wird der Spieler 0, gespielt von der KI auf Stufe 2. Das ist
// ein Ersatzmass fuer einen Menschen - eine KI baut anders, aber sie baut
// stetig, und die Kurvenform (wann flacht es ab?) ist aussagekraeftig.
//
//   node tools/tempo-kurve.mjs [minuten] [saaten...]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const MIN=+(process.argv[2]||45);
const SAATEN=process.argv.slice(3).length? process.argv.slice(3)
  : Array.from({length:12},(_,k)=>String(701+k));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const laeufe=[];
for(const saat of SAATEN){
  const t0=await starteSpiel(p,{saat});
  if(t0!==0) throw new Error('Messung startet nicht bei Takt 0 (t='+t0+')');
  laeufe.push(await p.evaluate(async ({MIN})=>{
    const g=window.__ui.game, m=g.map;
    g.players[0].ai=true; g.players[0].aiLevel=2; g.players[1].aiLevel=2;
    const punkte=[];
    for(let k=1;k<=MIN/5;k++){
      for(let t=0;t<3000;t++) g.step();          // fuenf Spielminuten
      let fertig=0, roh=0, sol=0, land=0;
      for(const x of g.buildings.values()){
        if(x.player!==0) continue;
        if(x.state==='build') roh++; else fertig++;
        if(x.soldiers) sol+=x.soldiers.length;
      }
      for(let i=0;i<m.owner.length;i++) if(m.owner[i]===0) land++;
      const st=g.settlerStats(0);
      punkte.push({min:k*5, fertig, roh, sol, land, siedler:st.total});
    }
    return punkte;
  }, {MIN}));
}
const n=laeufe.length, stufen=laeufe[0].length;
const zeilen=[];
for(let i=0;i<stufen;i++){
  const e=laeufe.map(l=>l[i]);
  const mw=(k)=>Math.round(e.reduce((s,x)=>s+x[k],0)/n);
  const med=(k)=>{ const v=e.map(x=>x[k]).sort((a,b2)=>a-b2); return v[Math.floor(v.length/2)]; };
  zeilen.push({min:e[0].min, fertig:mw('fertig'), fertigMedian:med('fertig'),
               roh:mw('roh'), sol:mw('sol'), land:mw('land'), siedler:mw('siedler')});
}
// Zuwachs je Fuenf-Minuten-Fenster: zeigt, wann es abflacht
for(let i=zeilen.length-1;i>0;i--) zeilen[i].zuwachs=zeilen[i].fertig-zeilen[i-1].fertig;
zeilen[0].zuwachs=zeilen[0].fertig;
console.log('KURVE '+JSON.stringify({saaten:n, minuten:MIN, verlauf:zeilen}));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
