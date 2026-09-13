// Nehmen Planierer und Bauarbeiter die STRASSE, oder laufen sie quer?
//
// Beim Losschicken bekommen sie wp = flagWaypoints(lagerTuer, baustellenTuer).
// flagWaypoints liefert aber null, sobald die beiden Fahnen nicht im
// selben Strassen-Komponenten liegen - und eine frische Baustelle hat noch
// gar keine Strasse. Der Verdacht ist deshalb, dass sie praktisch immer
// querfeldein laufen und unterwegs an Buchten und Engstellen haengen.
//
// Gemessen wird beim Losschicken: gibt es eine Route, wie lang ist sie,
// und wie oft muss moveToward unterwegs auf einen Landumweg ausweichen.
//
//   node tools/planierer-weg.mjs [minuten] [saaten...]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const MIN=+(process.argv[2]||30);
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
    g.players[0].ai=true; g.players[0].aiLevel=2; g.players[1].aiLevel=2;
    const z={ planiererGesamt:0, planiererMitWeg:0, planiererWegLeer:0,
              bauerGesamt:0, bauerMitWeg:0, bauerWegLeer:0,
              umwegGesucht:0, umwegGefunden:0, versperrt:0 };
    // Beim Anlegen der Figur festhalten, ob sie eine Route bekam
    const push=g.units.push.bind(g.units);
    g.units.push=function(u){
      if(u && u.player===0){
        if(u.type==='leveler'){ z.planiererGesamt++;
          if(u.wp && u.wp.length) z.planiererMitWeg++; else z.planiererWegLeer++; }
        if(u.type==='builder'){ z.bauerGesamt++;
          if(u.wp && u.wp.length) z.bauerMitWeg++; else z.bauerWegLeer++; }
      }
      return push(u);
    };
    // Wie oft muss quer gelaufen und ausgewichen werden?
    const vers=g.wegVersperrt.bind(g);
    g.wegVersperrt=function(u,tx,ty){ const r=vers(u,tx,ty); if(r && u.player===0) z.versperrt++; return r; };
    const det=g.landDetour.bind(g);
    g.landDetour=function(u,tx,ty,...a){
      const r=det(u,tx,ty,...a);
      if(u && u.player===0 && (u.type==='leveler'||u.type==='builder')){
        z.umwegGesucht++; if(r && r.length) z.umwegGefunden++;
      }
      return r;
    };
    for(let t=0;t<MIN*600;t++) g.step();
    return z;
  }, {MIN}));
}
const su=(k)=>alle.reduce((a,x)=>a+x[k],0);
const felder=Object.keys(alle[0]);
const aus={}; for(const f of felder) aus[f]=su(f);
aus.anteilPlaniererOhneWeg = aus.planiererGesamt
  ? +(aus.planiererWegLeer/aus.planiererGesamt*100).toFixed(1) : 0;
aus.anteilBauerOhneWeg = aus.bauerGesamt
  ? +(aus.bauerWegLeer/aus.bauerGesamt*100).toFixed(1) : 0;
aus.umwegErfolgsquote = aus.umwegGesucht
  ? +(aus.umwegGefunden/aus.umwegGesucht*100).toFixed(1) : 0;
console.log('WEG '+JSON.stringify(aus));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
