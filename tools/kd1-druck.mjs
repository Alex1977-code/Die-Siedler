// KD1 Gegnerdruck: greift die KI einen PASSIVEN Spieler an?
// Misst je Saat ueber 60 Spielminuten: Abstand der KI-Front zum Spieler-HQ,
// Angriffe (echte attack()-Aufrufe), Kontaktfaehigkeit, Militaerlage.
// Aufruf: node tools/kd1-druck.mjs [saat1 saat2 ...]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';

const SAATEN=process.argv.slice(2).length? process.argv.slice(2).map(Number) : [3001,3002,3003];
const MIN=60;                                   // Spielminuten je Saat
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));

for(const saat of SAATEN){
  const t0=await starteSpiel(page, {saat, groesse:'M', gegner:'1'});
  if(t0!==0) throw new Error('Spiel startete nicht bei Takt 0: '+t0);
  await page.evaluate(()=>{
    const g=window.__ui.game;
    window.__atk=[];
    const orig=g.attack.bind(g);
    g.attack=(pl,bid,n)=>{ if(pl!==0) window.__atk.push({t:g.t, pl, bid, n}); return orig(pl,bid,n); };
  });
  const verlauf=[];
  for(let min=0; min<MIN; min+=5){
    const z=await page.evaluate(()=>{
      const g=window.__ui.game, m=g.map;
      for(let i=0;i<3000;i++) g.step();          // 5 Spielminuten
      const ki=g.players.find(p=>p.ai);
      const hq0=g.buildings.get(g.players[0].hq);
      // Staerkster Beleg fuer Druck: das passive Spieler-HQ ist gefallen
      if(!hq0 || hq0.player!==0 || g.players[0].defeated)
        return { gefallen:true, t:g.t, atk:window.__atk.length };
      // Front: naechster fertiger KI-Militaerposten zum Spieler-HQ, dazu
      // die Reichweitenfrage (milRadius(src)+milRadius(ziel)+2 >= d?)
      let front=1e9, inReich=false;
      for(const b of g.buildings.values()){
        if(b.player!==ki.id || !b.soldiers || b.state!=='done') continue;
        const d=Math.hypot(m.X(b.node)-m.X(hq0.node), m.Y(b.node)-m.Y(hq0.node));
        if(d<front) front=d;
        if(d<=g.milRadius(b)+g.milRadius(hq0)+2) inReich=true;
      }
      let mil=0, sold=g.aiStaerke(ki), land=0;
      for(const b of g.buildings.values())
        if(b.player===ki.id && b.soldiers && b.type!=='hq' && b.state==='done') mil++;
      for(let i=0;i<m.owner.length;i++) if(m.owner[i]===ki.id) land++;
      return { t:g.t, front:front===1e9?null:+front.toFixed(1), inReich, mil,
               sold, land, kontakt:g.aiContact(ki), atk:window.__atk.length };
    });
    verlauf.push(z);
    if(z.gefallen) break;
  }
  const atk=await page.evaluate(()=>window.__atk);
  const msgs=await page.evaluate(()=> window.__ui.game.msgs
    .filter(x=>/Vorposten|angegriffen/.test(x.txt))
    .map(x=>`min${(x.t/600).toFixed(0)}:${x.txt}`));
  console.log(`\n== Saat ${saat} ==  min | Front->HQ | inReichw | Posten | Soldaten | Land | Angriffe`);
  verlauf.forEach((z,i)=>console.log(z.gefallen
    ? `${String((i+1)*5).padStart(4)} | SPIELER-HQ GEFALLEN (Takt ${z.t}, Angriffe bis dahin: ${z.atk})`
    : `${String((i+1)*5).padStart(4)} | ${String(z.front).padStart(9)} | ${z.inReich?'JA ':'nein'}     | ${String(z.mil).padStart(6)} | ${String(z.sold).padStart(8)} | ${String(z.land).padStart(4)} | ${z.atk}`));
  console.log('Angriffe gesamt:', atk.length, atk.slice(0,8).map(a=>`min${(a.t/600).toFixed(0)}:n${a.n}`).join(' '));
  console.log('Kriegsmeldungen:', msgs.length? msgs.join(' | ') : 'KEINE');
}
console.log('\nERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
