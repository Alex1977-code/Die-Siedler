// R8: Wie verhaelt sich die Bauzeit zur Materialwartezeit?
//
// tickConstruction verlangt das VOLLSTAENDIGE Material, bevor ueberhaupt
// ein Fortschritt zaehlt (haveAll). Eine Baustelle steht also bei null
// Prozent, bis der letzte Stein liegt, und ist danach schnell fertig.
// Gemessen wird je Gebaeude, wie viele Takte es
//   - auf Material gewartet hat (Material unvollstaendig)
//   - auf den Bauarbeiter gewartet hat (Material da, niemand da)
//   - tatsaechlich gebaut wurde (progress steigt)
//
//   node tools/r8-bauzeit.mjs [ticks] [saaten...]
import { chromium } from 'playwright';
const TICKS=+(process.argv[2]||9000);
const SAATEN=process.argv.slice(3).length? process.argv.slice(3)
  : ['11','23','7','41','58','3'];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:900,height:700}})).newPage();
const fehler=[]; p.on('pageerror',e=>fehler.push(e.message));
const alle=[];
for(const saat of SAATEN){
  await p.goto('http://127.0.0.1:8901/',{waitUntil:'load'});
  await p.click('#bt-free'); await p.selectOption('#f-size','M'); await p.selectOption('#f-ais','1');
  await p.fill('#f-seed',saat); await p.click('#f-start');
  await p.waitForTimeout(2200);
  alle.push(await p.evaluate(async ({TICKS,saat})=>{
    const g=window.__ui.game;
    g.players[0].ai=true; g.players[0].aiLevel=2; g.players[1].aiLevel=2;
    // je Baustelle mitschreiben
    const buch=new Map();   // id -> {typ, spieler, warteMat, warteBauer, bau, fertigT, startT}
    for(let t=0;t<TICKS;t++){
      g.step();
      for(const x of g.buildings.values()){
        if(x.state!=='build'){
          const e=buch.get(x.id);
          if(e && e.fertigT===null) e.fertigT=t;
          continue;
        }
        let e=buch.get(x.id);
        if(!e){ e={typ:x.type, spieler:x.player, warteMat:0, warteBauer:0, bau:0,
                   startT:t, fertigT:null, letzterProg:0}; buch.set(x.id,e); }
        const prog=x.progress||0;
        if(prog>e.letzterProg){ e.bau++; e.letzterProg=prog; }
        else if((x.matWaitT||0)>0) e.warteMat++;
        else e.warteBauer++;
      }
    }
    const raus=[];
    for(const [id,e] of buch){
      const lebt=g.buildings.get(id);
      raus.push({typ:e.typ, spieler:e.spieler, warteMat:e.warteMat,
                 warteBauer:e.warteBauer, bau:e.bau,
                 fertig: !!(lebt && lebt.state!=='build')});
    }
    return {saat, bauten:raus};
  }, {TICKS,saat}));
}
// Auswertung nur ueber FERTIGE Gebaeude - unfertige verzerren nach oben
const f=[]; for(const s of alle) for(const x of s.bauten) if(x.fertig) f.push(x);
const su=(k)=>f.reduce((a,x)=>a+x[k],0);
const gesamt=su('warteMat')+su('warteBauer')+su('bau');
const proTyp={};
for(const x of f){
  const t=proTyp[x.typ] || (proTyp[x.typ]={n:0, warteMat:0, warteBauer:0, bau:0});
  t.n++; t.warteMat+=x.warteMat; t.warteBauer+=x.warteBauer; t.bau+=x.bau;
}
const zeilen=Object.entries(proTyp).map(([typ,t])=>({
  typ, n:t.n,
  warteMatSchnitt:Math.round(t.warteMat/t.n),
  warteBauerSchnitt:Math.round(t.warteBauer/t.n),
  bauSchnitt:Math.round(t.bau/t.n),
  anteilBau:+(t.bau/(t.warteMat+t.warteBauer+t.bau)*100).toFixed(1)
})).sort((a,b2)=>b2.n-a.n);
console.log(JSON.stringify({
  fertigeGebaeude:f.length, saaten:SAATEN.length, ticks:TICKS,
  takteGesamt:gesamt,
  anteilWarteMaterial:+(su('warteMat')/gesamt*100).toFixed(1),
  anteilWarteBauarbeiter:+(su('warteBauer')/gesamt*100).toFixed(1),
  anteilEchterBau:+(su('bau')/gesamt*100).toFixed(1),
  jeTyp:zeilen}, null, 1));
console.log('FEHLER('+fehler.length+')', fehler.slice(0,2).join(' | '));
await b.close();
