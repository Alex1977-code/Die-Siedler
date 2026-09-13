// KD1-Diagnose: WO versickert der Vorstoss? Protokolliert je KI-Militaerbau
// Platzierung (Feindabstand), Anschluss, Fertigstellung und Abrisse.
// Aufruf: node tools/kd1-diagnose.mjs [saat] [minuten]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';

const SAAT=Number(process.argv[2]||3001), MIN=Number(process.argv[3]||60);
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const t0=await starteSpiel(page, {saat:SAAT, groesse:'M', gegner:'1'});
if(t0!==0) throw new Error('Start nicht bei Takt 0');

await page.evaluate(()=>{
  const g=window.__ui.game, m=g.map;
  const ki=g.players.find(p=>p.ai);
  const hq0=g.buildings.get(g.players[0].hq);
  const dist=(n)=>+Math.hypot(m.X(n)-m.X(hq0.node), m.Y(n)-m.Y(hq0.node)).toFixed(1);
  const MIL=['barracks','guardhouse','watchtower','fortress'];
  window.__diag={ platz:[], brand:[], fertig:[], vor:[], ki:ki.id, dist, MIL };
  const oP=g.placeBuilding.bind(g);
  g.placeBuilding=(pl,type,node)=>{
    const r=oP(pl,type,node);
    if(r.ok && pl===ki.id && MIL.includes(type)) window.__diag.platz.push({t:g.t, id:r.b.id, d:dist(node)});
    return r;
  };
  const oB=g.burnBuilding.bind(g);
  g.burnBuilding=(b,loot)=>{
    if(b.player===ki.id && MIL.includes(b.type)) window.__diag.brand.push({t:g.t, id:b.id, d:dist(b.node), st:b.state});
    return oB(b,loot);
  };
  const oV=g.aiVorstossSpot.bind(g);
  g.aiVorstossSpot=(p,type)=>{
    const s=oV(p,type);
    window.__diag.vor.push(s>=0? dist(s) : s);
    return s;
  };
  const oOB=g.onBuilt;
  g.onBuilt=(b)=>{
    if(b.player===ki.id && b.soldiers){
      const p0=window.__diag.platz.find(x=>x.id===b.id);
      window.__diag.fertig.push({t:g.t, id:b.id, d:dist(b.node), dauer:p0? g.t-p0.t : null});
    }
    if(oOB) oOB(b);
  };
});

for(let min=0; min<MIN; min+=5){
  await page.evaluate(()=>{
    const g=window.__ui.game, D=window.__diag;
    // Lebenslauf: alle 50 Takte den Zustand jeder Militaer-Baustelle abtasten
    D.leben=D.leben||{};
    for(let i=0;i<3000;i++){
      g.step();
      if(g.t%50!==0) continue;
      for(const b of g.buildings.values()){
        if(b.player!==D.ki || !D.MIL.includes(b.type)) continue;
        const L=D.leben[b.id]=D.leben[b.id]||{};
        if(b.state==='build'){
          if(L.leveled===undefined && b.leveled) L.leveled=g.t;
          if(L.prog===undefined && b.progress>0) L.prog=g.t;
          if(L.mat===undefined && (b.stock.board||0)+(b.stock.stone||0)>0) L.mat=g.t;
        } else if(b.state==='done' && L.done===undefined) L.done=g.t;
      }
    }
  });
}
const d=await page.evaluate(()=>{
  const g=window.__ui.game, D=window.__diag;
  // offene Baustellen am Ende: angeschlossen?
  const hq=g.buildings.get(g.players.find(p=>p.ai).hq);
  const hqC=g.compOf(hq.door);
  const offen=[...g.buildings.values()]
    .filter(b=>b.player===D.ki && b.soldiers && b.state==='build')
    .map(b=>({d:D.dist(b.node), verbunden:g.compOf(b.door)===hqC, alter:g.t-(D.platz.find(x=>x.id===b.id)?.t??g.t)}));
  return {platz:D.platz, brand:D.brand, fertig:D.fertig, vor:D.vor, offen, leben:D.leben};
});
{
  // Lebenslauf-Zerlegung: platziert -> geebnet -> Material -> Baubeginn -> fertig
  const zeilen=[];
  for(const x of d.platz){
    const L=d.leben[x.id]; if(!L||!L.done) continue;
    const s=(a,b)=> (a===undefined||b===undefined)? '?' : ((a-b)/10).toFixed(0);
    zeilen.push(`  d=${String(x.d).padStart(5)} eben:${s(L.leveled,x.t)}s mat:${s(L.mat,x.t)}s hammer:${s(L.prog,x.t)}s fertig:${s(L.done,x.t)}s`);
  }
  console.log(`\nLebenslaeufe (${zeilen.length}), Zeiten ab Platzierung:`);
  zeilen.forEach(z=>console.log(z));
}
console.log(`== Saat ${SAAT}, ${MIN} min ==`);
console.log(`\nPlatzierungen (${d.platz.length}): min:distanz`);
console.log(d.platz.map(x=>`${(x.t/600).toFixed(0)}:${x.d}`).join(' '));
console.log(`\nFertig (${d.fertig.length}): min:distanz(dauer in s)`);
console.log(d.fertig.map(x=>`${(x.t/600).toFixed(0)}:${x.d}(${x.dauer!=null?(x.dauer/10).toFixed(0):'?'})`).join(' '));
console.log(`\nAbrisse (${d.brand.length}): min:distanz[zustand]`);
console.log(d.brand.map(x=>`${(x.t/600).toFixed(0)}:${x.d}[${x.st}]`).join(' ') || '-');
const vorNum=d.vor.filter(x=>typeof x==='number'&&x>=0);
const vorMiss=d.vor.filter(x=>x===-1).length, vorCd=d.vor.filter(x=>x===-2).length;
console.log(`\nVorstoss-Suchen: ${d.vor.length} (gefunden ${vorNum.length}, frisch-leer ${vorMiss}, im-cooldown ${vorCd})`);
console.log('gefundene Distanzen:', vorNum.slice(0,40).join(' '));
console.log(`\nOffene Militaer-Baustellen am Ende (${d.offen.length}):`);
d.offen.forEach(o=>console.log(`  dist ${o.d} verbunden=${o.verbunden} alter=${(o.alter/600).toFixed(1)}min`));
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
