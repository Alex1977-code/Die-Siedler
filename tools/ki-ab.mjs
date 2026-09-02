// KI-A/B ueber viele Saaten. Beide Schalter werden IM LAUF gesetzt, die
// Quelldateien bleiben unangetastet:
//   A = wie ausgeliefert   B = ohne Soldaten-Vorlauf
//   C = ohne Materialhilfe D = ohne beides
// Aufruf: node tools/ki-ab.mjs [stufe] [ticks]
//
// Ergebnis vom 12.08. (Stufe 2, 10 Saaten, 30 Spielminuten, beide Seiten
// spielen):
//   A  Land 611  Gebaeude 21  Soldaten 10  Angriffe 0,0  Haemmer 90
//   B  Land 703  Gebaeude 25  Soldaten 13  Angriffe 0,0  Haemmer 88
//   C  Land 306  Gebaeude 13  Soldaten  1  Angriffe 0,0  Haemmer  5
//   D  Land 306  Gebaeude 13  Soldaten  1  Angriffe 0,0  Haemmer  5
// Zwei Befunde: die Materialhilfe traegt die halbe KI, und die KI greift
// UEBERHAUPT NIE an - der Soldaten-Vorlauf laesst sich deshalb gar nicht
// bewerten.
// A/B ueber viele Saaten: bringt der Soldaten-Vorlauf etwas, und was
// steuert die KI-Materialhilfe bei?
//   A = wie ausgeliefert            B = ohne Vorlauf
//   C = ohne Materialhilfe          D = ohne beides
// Beide Schalter werden IM LAUF gesetzt, die Dateien bleiben unangetastet.
import { chromium } from 'playwright';
const SAATEN=['11','23','7','41','58','3','97','64','12','80'];
const LVL=+(process.argv[2]||2);
const TICKS=+(process.argv[3]||18000);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const erg={A:[],B:[],C:[],D:[]};
for(const saat of SAATEN){
  for(const cfg of ['A','B','C','D']){
    await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
    await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
    await p.fill('#f-seed',saat); await p.click('#f-start');
    await p.waitForTimeout(2200);
    erg[cfg].push(await p.evaluate(async ({cfg,LVL,TICKS})=>{
      const g=window.__ui.game, m=g.map;
      g.players[1].aiLevel=LVL;
      g.players[0].ai=true; g.players[0].aiLevel=LVL;   // Gegenspieler, sonst gibt es nie Kontakt
      let hilfe=0;
      if(cfg==='B'||cfg==='D'){                      // Vorlauf ausschalten
        g.aiStaerke=function(){ return 9999; };
      }
      if(cfg==='C'||cfg==='D'){                      // Materialhilfe ausschalten
        const G=g.constructor, alt=G.diffMods;
        G.diffMods=function(d){ const r=alt.call(this,d); return {...r, bonusMul:0}; };
      } else {
        // zaehlen, wie oft sie zuschlaegt
        const hq=g.buildings.get(g.players[1].hq);
        let letzt=hq? (hq.inv.hammer||0) : 0;
        g._zaehl=()=>{ const h=g.buildings.get(g.players[1].hq);
          if(h && (h.inv.hammer||0)>letzt){ hilfe++; letzt=h.inv.hammer||0; } };
      }
      let angriffe=0;
      const eA=g.attack.bind(g);
      g.attack=function(pl,id,n){ if(pl===1) angriffe++; return eA(pl,id,n); };
      for(let t=0;t<TICKS;t++){ g.step(); if(g._zaehl && t%300===0) g._zaehl(); }
      let land=0; for(let i=0;i<m.owner.length;i++) if(m.owner[i]===1) land++;
      let bau=0, sol=0, mil=0;
      for(const x of g.buildings.values()){ if(x.player!==1) continue; bau++;
        if(x.soldiers){ mil++; sol+=x.soldiers.length; } }
      const iv=g.invTotal(1);
      return {land, bau, sol, mil, angriffe, hilfe,
              hammer:iv.hammer||0, board:iv.board||0, sword:iv.sword||0};
    }, {cfg,LVL,TICKS}));
  }
}
const stat=(a,k)=>{ const v=a.map(x=>x[k]).sort((x,y)=>x-y);
  const mw=v.reduce((s,x)=>s+x,0)/v.length;
  return {mittel:Math.round(mw), median:v[Math.floor(v.length/2)], min:v[0], max:v[v.length-1]}; };
const aus={};
for(const c of ['A','B','C','D'])
  aus[c]={land:stat(erg[c],'land'), bau:stat(erg[c],'bau'), sol:stat(erg[c],'sol'),
          angriffe:stat(erg[c],'angriffe'), hammer:stat(erg[c],'hammer'),
          board:stat(erg[c],'board')};
console.log(JSON.stringify({stufe:LVL, n:SAATEN.length, aus}));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
