// R9: Die drei neuen Missionsziele muessen ausloesen - und keines darf die
// Mission unloesbar machen.
//   capture      : N feindliche Militaergebaeude erobern
//   defeatPlayer : einen BESTIMMTEN Clan schlagen
//   survive      : sich N Spielminuten halten
// Geprueft wird auch das Sicherheitsnetz: wer den Gegner ganz ausloescht,
// statt zu erobern, muss die Mission trotzdem gewinnen koennen.
import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));

const starteFreiesSpiel=async()=>{
  await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
  await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
  await p.fill('#f-seed','11'); await p.click('#f-start');
  await p.waitForTimeout(2000);
};

const raus={};

// --- capture: erobern zaehlt, und ein verlorenes Gebaeude zaehlt weiter ---
await starteFreiesSpiel();
raus.capture=await p.evaluate(()=>{
  const g=window.__ui.game;
  g.objectives=[{type:'capture', count:2, desc:'test'}];
  g.checkObjectives();
  const vorher=g.objectives[0].done;
  // Der Gegner hat nach zwei Sekunden Spielzeit noch keine Posten - also
  // zwei direkt setzen (spawnBuilding umgeht die Bauzeit) und erobern.
  const m=g.map;
  const hq=g.buildings.get(g.players[1].hq);
  const gesetzt=[];
  for(let i=0;i<m.owner.length && gesetzt.length<2;i++){
    if(m.owner[i]!==1 || m.bld[i]>=0 || !m.terrOkBuild(i)) continue;
    if(Math.hypot(m.X(i)-m.X(hq.node), m.Y(i)-m.Y(hq.node))>6) continue;
    const b2=g.spawnBuilding(1,'guardhouse',i);
    if(b2){ b2.state='done'; b2.soldiers=['sword']; b2.besetztWar=true; gesetzt.push(b2); }
  }
  let erobert=0;
  for(const x of gesetzt){ g.captureBuilding(x, 0, ['sword']); erobert++; }
  g.checkObjectives();
  const nachher=g.objectives[0].done;
  return {vorher, erobert, prog:g.objectives[0].prog, nachher, ueber:g.over, sieger:g.winner};
});

// --- capture-Sicherheitsnetz: Gegner ausgeloescht, nichts erobert ---
await starteFreiesSpiel();
raus.captureNotausgang=await p.evaluate(()=>{
  const g=window.__ui.game;
  g.objectives=[{type:'capture', count:5, desc:'test'}];
  // alle Feinde besiegen, ohne ein einziges Gebaeude zu erobern
  for(const pl of g.players) if(pl.id!==0){
    for(const x of [...g.buildings.values()]) if(x.player===pl.id) g.burnBuilding(x,false);
    g.checkPlayerDefeat(pl.id);
  }
  g.checkObjectives();
  return {done:g.objectives[0].done, prog:g.objectives[0].prog, ueber:g.over, sieger:g.winner};
});

// --- defeatPlayer: nur der genannte Clan zaehlt ---
await starteFreiesSpiel();
raus.defeatPlayer=await p.evaluate(()=>{
  const g=window.__ui.game;
  g.players[1].name='Aschehand';
  g.objectives=[{type:'defeatPlayer', wer:'Aschehand', desc:'test'}];
  g.checkObjectives();
  const vorher=g.objectives[0].done;
  g.players[1].defeated=true;
  g.checkObjectives();
  return {vorher, nachher:g.objectives[0].done, ueber:g.over, sieger:g.winner};
});

// --- defeatPlayer auf einen Clan, den es in dieser Runde gar nicht gibt ---
await starteFreiesSpiel();
raus.defeatPlayerFehlt=await p.evaluate(()=>{
  const g=window.__ui.game;
  g.objectives=[{type:'defeatPlayer', wer:'GibtEsNicht', desc:'test'}];
  g.checkObjectives();
  return {done:g.objectives[0].done};
});

// --- survive: zaehlt Spielminuten ---
await starteFreiesSpiel();
raus.survive=await p.evaluate(()=>{
  const g=window.__ui.game;
  g.objectives=[{type:'survive', count:2, desc:'test'}];
  g.checkObjectives();
  const vorher={done:g.objectives[0].done, prog:g.objectives[0].prog};
  g.t=2*600;                       // zwei Spielminuten
  g.checkObjectives();
  return {vorher, nachher:{done:g.objectives[0].done, prog:g.objectives[0].prog}};
});

// --- die Kampagne bleibt vollstaendig und loesbar ---
raus.kampagne=await p.evaluate(async ()=>{
  const m=await import('/js/levels.js');
  const erlaubt=new Set(['build','good','soldiers','destroyEnemies','occupy',
                         'territory','capture','defeatPlayer','survive']);
  const schlecht=[];
  let mitZerstoeren=0;
  for(const l of m.CAMPAIGN){
    if(!l.objectives.length) schlecht.push(l.id+': keine Ziele');
    if(l.objectives.some(o=>o.type==='destroyEnemies')) mitZerstoeren++;
    for(const o of l.objectives){
      if(!erlaubt.has(o.type)) schlecht.push(l.id+': unbekanntes Ziel '+o.type);
      if(!o.desc) schlecht.push(l.id+': Ziel ohne Beschreibung');
      if((o.type==='capture'||o.type==='survive') && !(o.count>0))
        schlecht.push(l.id+': '+o.type+' ohne count');
      if(o.type==='defeatPlayer'){
        if(!o.wer) schlecht.push(l.id+': defeatPlayer ohne wer');
        else if(!l.ais.some(a=>a.name===o.wer))
          schlecht.push(l.id+': defeatPlayer nennt "'+o.wer+'", der nicht mitspielt');
      }
      // ein Kampfziel ohne Gegner waere unloesbar
      if((o.type==='capture'||o.type==='destroyEnemies'||o.type==='defeatPlayer')
         && !(l.ais&&l.ais.length)) schlecht.push(l.id+': Kampfziel ohne Gegner');
    }
  }
  return {missionen:m.CAMPAIGN.length, mitZerstoeren, schlecht};
});

console.log(JSON.stringify(raus, null, 1));
const ok =
  raus.capture.vorher===false && raus.capture.nachher===true && raus.capture.prog===2 &&
  raus.captureNotausgang.done===true &&
  raus.defeatPlayer.vorher===false && raus.defeatPlayer.nachher===true &&
  raus.defeatPlayerFehlt.done===true &&
  raus.survive.vorher.done===false && raus.survive.nachher.done===true &&
  raus.kampagne.schlecht.length===0;
console.log(ok? 'ZIELTEST OK' : 'ZIELTEST FEHLGESCHLAGEN');
console.log('ERRORS('+fehler.length+')', fehler.slice(0,3).join(' | '));
await b.close();
process.exit(ok && !fehler.length ? 0 : 1);
