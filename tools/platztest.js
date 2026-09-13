import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://localhost:8901/',{waitUntil:'networkidle'});
await p.click('#bt-free');
await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','0');
await p.fill('#f-seed','777'); await p.click('#f-start');
await p.waitForTimeout(1800);
console.log(JSON.stringify(await p.evaluate(()=>{
  const ui=window.__ui,g=ui.game,m=g.map;
  m.explored.fill(1); m.owner.fill(0);
  const out={};
  // 1) Fischer: an Land fern vom Wasser -> ablehnen; am Ufer -> erlauben
  let fern=-1, nah=-1;
  const maske=g.fischNah();
  for(let i=0;i<m.terr.length;i++){
    if(m.terr[i]!==1 || m.bld[i]>=0 || m.obj[i]!==0) continue;
    if(fern<0 && !maske[i] && g.canBuild(0,'woodcutter',i).ok) fern=i;
    if(nah<0 && maske[i] && m.nbs(i).some(n=>m.terr[n]===0||m.terr[n]===6)===false){
      // Uferzone reicht - direkter Wasserkontakt egal
      if(g.canBuild(0,'fisher',i).ok) nah=i;
    }
    if(fern>=0 && nah>=0) break;
  }
  out.fischerFern = fern>=0 ? g.canBuild(0,'fisher',fern) : 'kein Testplatz';
  out.fischerNah = nah>=0 ? 'erlaubt' : 'kein Uferplatz erlaubt?!';
  // 2) Tuer-Einschluss: kuenstlich eine Wasser-Tasche bauen
  //    Haus-Knoten frei, aber alle Nachbarn der Tuer unter Wasser setzen
  let ok2='kein Kandidat';
  for(let i=0;i<m.terr.length;i++){
    if(!g.canBuild(0,'woodcutter',i).ok) continue;
    const my=m.Y(i), mx=m.X(i);
    const lower=m.nbs(i).filter(n=>m.Y(n)>my).sort((a,b2)=>Math.abs(m.X(a)-mx)-Math.abs(m.X(b2)-mx));
    if(!lower.length) continue;
    const tuer=lower[0];
    const alt=[];
    for(const q of m.nbs(tuer)) if(q!==i){ alt.push([q,m.terr[q]]); m.terr[q]=0; }   // Wasser
    const verdikt=g.canBuild(0,'woodcutter',i);
    for(const [q,t] of alt) m.terr[q]=t;
    ok2 = verdikt.ok ? 'FEHLER: eingeschlossene Tuer erlaubt' : 'abgelehnt: '+verdikt.r;
    break;
  }
  out.tuerEinschluss=ok2;
  return out;
})));
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await b.close();
