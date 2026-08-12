// Warum friert die Siedlung ein? Ab Minute 25 kommt kaum ein Gebaeude
// dazu, aber sechs bis sieben Baustellen stehen dauerhaft herum. Dieses
// Werkzeug schaut sie sich am Ende einzeln an: wie alt sind sie, was
// fehlt ihnen, und haengen sie am Netz?
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const MIN=+(process.argv[2]||45);
const SAATEN=process.argv.slice(3).length? process.argv.slice(3)
  : ['701','702','703','704','705','706'];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const alle=[];
for(const saat of SAATEN){
  const t0=await starteSpiel(p,{saat});
  if(t0!==0) throw new Error('Startet nicht bei Takt 0');
  alle.push(await p.evaluate(async ({MIN})=>{
    const g=window.__ui.game;
    const { BLD } = await import('/js/core.js');
    g.players[0].ai=true; g.players[0].aiLevel=2; g.players[1].aiLevel=2;
    for(let t=0;t<MIN*600;t++) g.step();
    const hq=g.buildings.get(g.players[0].hq);
    const hqC=hq? g.compOf(hq.door) : undefined;
    const iv=g.invTotal(0);
    const offen=[];
    for(const x of g.buildings.values()){
      if(x.player!==0 || x.state!=='build') continue;
      const k=BLD[x.type].cost;
      const needB=k.board||0, needS=k.stone||0;
      const da=Math.min(needB,x.stock.board||0)+Math.min(needS,x.stock.stone||0);
      offen.push({ typ:x.type, fehltBretter:Math.max(0,needB-(x.stock.board||0)),
        fehltSteine:Math.max(0,needS-(x.stock.stone||0)),
        gelaufen:Math.round((x.progress||0)/(80+30*(needB+needS))*100),
        geebnet:!!x.leveled, bauer:x.builderId!=null,
        amNetz: x.door>=0 && g.compOf(x.door)===hqC,
        wartetMat:x.matWaitT||0 });
    }
    // Was hindert die KI am Weiterbauen?
    let frei=0; const m=g.map;
    for(let i=0;i<m.owner.length;i++) if(m.owner[i]===0 && g.canBuild(0,'guardhouse',i).ok) frei++;
    return {saat:0, offen, lagerBretter:iv.board||0, lagerSteine:iv.stone||0,
            freiePlaetze:frei, saege:[...g.buildings.values()].filter(x=>x.player===0&&x.type==='sawmill'&&x.state==='done').length,
            holzfaeller:[...g.buildings.values()].filter(x=>x.player===0&&x.type==='woodcutter'&&x.state==='done').length,
            staemme:iv.trunk||0};
  }, {MIN}));
}
const alleOffen=alle.flatMap(x=>x.offen);
const zaehl=(f)=>alleOffen.filter(f).length;
console.log('DAUER '+JSON.stringify({
  saaten:alle.length, offeneBaustellen:alleOffen.length,
  ohneMaterial: zaehl(x=>x.fehltBretter+x.fehltSteine>0),
  nichtAmNetz: zaehl(x=>!x.amNetz),
  ohneBauarbeiter: zaehl(x=>!x.bauer),
  nichtGeebnet: zaehl(x=>!x.geebnet),
  fortschritt0: zaehl(x=>x.gelaufen===0),
  lagerBretter: alle.reduce((a,x)=>a+x.lagerBretter,0),
  lagerSteine: alle.reduce((a,x)=>a+x.lagerSteine,0),
  staemme: alle.reduce((a,x)=>a+x.staemme,0),
  freiePlaetze: alle.reduce((a,x)=>a+x.freiePlaetze,0),
  saegewerke: alle.reduce((a,x)=>a+x.saege,0),
  holzfaeller: alle.reduce((a,x)=>a+x.holzfaeller,0),
  beispiele: alleOffen.slice(0,10)}));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
