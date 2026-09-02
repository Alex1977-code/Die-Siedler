// R11: Wie lange braucht ein Setzling bis zum faellbaren Baum?
//
// Der Holzfaeller nimmt NUR ausgewachsene Baeume (OBJ.TREE), Setzling und
// Jungbaum zaehlen nicht. Die Reifezeit bestimmt also unmittelbar, ob ein
// Foerster die Abholzung ausgleichen kann.
// Das Wachstum laeuft ueber eine Stichprobe: je Takt werden K Knoten der
// ganzen Karte gezogen (K = max(200, Knoten/46)), ein gezogener Setzling
// wird mit 35 Prozent zum Jungbaum, ein Jungbaum mit 30 Prozent zum Baum.
// Gemessen wird die tatsaechliche Zeit, nicht die gerechnete.
//
//   node tools/r11-setzling.mjs [groesse] [anzahl]
import { chromium } from 'playwright';
const GROESSE=process.argv[2]||'M';
const N=+(process.argv[3]||300);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
await p.click('#bt-free'); await p.selectOption('#f-size',GROESSE); await p.selectOption('#f-ais','1');
await p.fill('#f-seed','11'); await p.click('#f-start');
await p.waitForTimeout(2200);
const erg=await p.evaluate(async ({N})=>{
  const g=window.__ui.game, m=g.map;
  const OBJ_NONE=0, OBJ_SAPLING=1, OBJ_TREE2=2, OBJ_TREE=3;
  // Wachstum nicht durch Holzfaeller stoeren: die KI anhalten
  g.tickAI=function(){};
  // N freie Wiesenknoten mit Setzlingen bepflanzen
  const beob=[];
  for(let i=0;i<m.obj.length && beob.length<N;i++){
    if(m.obj[i]!==OBJ_NONE || m.terr[i]!==1) continue;   // 1 = GRASS
    if(m.bld[i]>=0 || m.flag[i] || g.roadAt(i)) continue;
    m.obj[i]=OBJ_SAPLING;
    beob.push({i, jung:null, baum:null});
  }
  const t0=g.t;
  for(let t=0;t<6000;t++){
    g.step();
    for(const e of beob){
      const o=m.obj[e.i]&127;
      if(e.jung===null && o>=OBJ_TREE2) e.jung=g.t-t0;
      if(e.baum===null && o===OBJ_TREE){ e.baum=g.t-t0; }
    }
    if(beob.every(e=>e.baum!==null)) break;
  }
  const fertig=beob.filter(e=>e.baum!==null).map(e=>e.baum).sort((a,b2)=>a-b2);
  const jung=beob.filter(e=>e.jung!==null).map(e=>e.jung).sort((a,b2)=>a-b2);
  const md=(v)=>v.length? v[Math.floor(v.length/2)] : null;
  return {
    gepflanzt:beob.length, ausgewachsen:fertig.length,
    knoten:m.obj.length,
    zuJungbaum:{median:md(jung), min:jung[0], max:jung[jung.length-1]},
    zuBaum:{median:md(fertig), min:fertig[0], max:fertig[fertig.length-1]},
  };
}, {N});
const min=(t)=> t===null? null : +(t/600).toFixed(2);
console.log(JSON.stringify({groesse:GROESSE, ...erg,
  spielminutenBisJungbaum: min(erg.zuJungbaum.median),
  spielminutenBisBaum:     min(erg.zuBaum.median),
  spielminutenBaumMax:     min(erg.zuBaum.max)}, null, 1));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
