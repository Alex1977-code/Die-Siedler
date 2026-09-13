// PRUEFSTAND fuer die Produktionsketten.
//
// Die Zahl in BLD (prod.time / time) ist NICHT der Ausstoss: dazwischen
// liegen der Weg des Austragens zur Tuerfahne, das Suchen des naechsten
// Baums/Felsens/Feldes, Essensboni und die Bedarfsbremse. Gemessen wird
// deshalb am laufenden Spiel: ein Betrieb, Eingaenge im Ueberfluss, Ausgang
// wird sofort abgeholt - und dann gezaehlt, was in zehn Spielminuten
// wirklich herauskommt.
//
//   node tools/pruefstand.mjs                 # alle Betriebe
//   node tools/pruefstand.mjs sawmill mill    # nur diese
//   node tools/pruefstand.mjs --minuten 20 --saat 11
//
// Ausgabe: je Betrieb Stueck je Spielminute, dazu die Sollzahl aus BLD
// (600/time) und der Wirkungsgrad. Am Ende die Verhaeltnisrechnung:
// wie viele Lieferanten ein Abnehmer braucht.
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';

const args=process.argv.slice(2);
const zahl=(name,vor)=>{ const i=args.indexOf('--'+name); return i>=0? +args[i+1] : vor; };
const MIN=zahl('minuten',10), SAAT=zahl('saat',11);
const NUR=args.filter(a=>!a.startsWith('--') && !/^\d+$/.test(a));

const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:600}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:SAAT, groesse:'M', gegner:'0'});

const erg=await page.evaluate(async ([MIN, NUR])=>{
  const ui=window.__ui, g=ui.game, m=g.map;
  const core=await import('./js/core.js');
  const {BLD, TOOL_OF, FOODS, TER, OBJ}=core;
  const hq=g.buildings.get(g.players[0].hq);

  // --- Hilfen -------------------------------------------------------------
  // Ein Bauplatz fuer diesen Typ, moeglichst nah am HQ. Fuer Bergwerke im
  // Gebirge, fuer Fischer am Wasser - canBuild entscheidet, wir probieren.
  const platzFuer=(typ)=>{
    const def=BLD[typ];
    // Bergwerke gehoeren auf ein VORKOMMEN - ein Platz ohne Erz misst nichts.
    if(def.mine){
      const ziel={coal:1,ironore:2,gold:3,stone:4}[def.mine];
      let best=-1, bv=0;
      for(let i=0;i<m.oreT.length;i++){
        if(m.oreT[i]!==ziel) continue;
        let v=0; for(const q of [i,...m.nbs(i)]) if(m.oreT[q]===ziel) v+=m.oreA[q];
        if(v<=bv) continue;
        // Bauplatz in der Naehe des Vorkommens suchen
        for(const n of [i,...m.nbs(i)]) if(g.canBuild(0,typ,n).ok){ best=n; bv=v; break; }
      }
      if(best>=0) return best;
    }
    for(let r=2;r<=30;r++){
      for(const n of g.nodesInRange(hq.node, r)){
        if(g.canBuild(0,typ,n).ok) return n;
      }
    }
    return -1;
  };
  // Ein fertiger Betrieb mit Fachkraft und Werkzeug, ohne Wartezeit
  const stelleHin=(typ)=>{
    const n=platzFuer(typ);
    if(n<0) return null;
    const r=g.placeBuilding(0,typ,n);
    if(!r.ok) return null;
    const b=r.b;
    b.state='done'; b.leveled=true; b.bauerDa=true; b.progress=1e9; b.stock={};
    if(b.worker){ b.worker.present=true; b.worker.state='in'; b.worker.timer=0; }
    if(TOOL_OF[typ]) b.toolGood=TOOL_OF[typ];
    // Schmieden waehlen ihre Ausgabe nach Bedarf; im Pruefstand ist das Lager
    // leer, dann waehlt die Werkzeugschmiede GAR NICHTS und ruht. Also feste
    // Ausgabe vorgeben (die Zeit je Stueck ist fuer alle Ausgaben gleich).
    if(typ==='toolsmith'){ b.makeGood='hammer'; b.chosenTool='hammer'; }
    if(typ==='armory'){ b.makeGood='sword'; b.chosenTool='sword'; }
    g.changedNodes.push(b.node);
    return b;
  };

  const messe=(typ, minuten, essen)=>{
    const def=BLD[typ];
    const b=stelleHin(typ);
    if(!b) return {typ, fehler:'kein Bauplatz gefunden'};
    let stueck=0, wartetEingang=0, ruht=0, takte=0;
    const ausgaben={};
    const vorher={};
    for(let t=0;t<minuten*600;t++){
      // Eingaenge auffuellen: der Betrieb soll NIE auf Nachschub warten
      if(def.prod) for(const k in def.prod.inputs) b.stock[k]=4;
      // Essen (nur wenn gewuenscht - Werkzeugschmiede und Bergwerke)
      if(essen) for(const f of FOODS) b.stock[f]=Math.max(b.stock[f]||0, 2);
      else if(def.mine) for(const f of FOODS) b.stock[f]=2;   // Bergleute MUESSEN essen
      // Bergwerke: Vorkommen nicht ausgehen lassen, sonst misst man die
      // Erschoepfung statt der Foerderleistung
      if(def.mine){
        // Der Foerderring wird VOLL besetzt: gemessen werden soll die
        // Foerderleistung, nicht die Fundwahrscheinlichkeit. (Wie lange ein
        // echtes Vorkommen traegt, misst man getrennt ueber oreLeft.)
        const ziel={coal:1,ironore:2,gold:3,stone:4}[def.mine];
        for(const q of [b.node,...m.nbs(b.node)]){ m.oreT[q]=ziel; m.oreA[q]=40; }
        b.depleted=false;
      }
      // Holzfaeller/Steinmetz/Fischer: Umgebung auffuellen (sonst misst man
      // die Erschoepfung). Baeume und Brocken neu setzen, Fisch nachfuellen.
      if(def.gather==='tree' || def.gather==='stone' || def.gather==='fish'){
        if(t%50===0) for(const q of g.nodesInRange(b.node, def.range||8)){
          if(def.gather==='fish'){ if(m.terr[q]===TER.WATER) m.fish[q]=8; continue; }
          if(m.terr[q]!==TER.GRASS || m.bld[q]>=0 || m.flag[q] || g.roadAt(q)) continue;
          const o=m.obj[q]&127;
          if(o!==OBJ.NONE) continue;
          if(def.gather==='tree'){ m.obj[q]=OBJ.TREE; m.amt[q]=0; }
          else { m.obj[q]=OBJ.STONE; m.amt[q]=6; }
          g.changedNodes.push(q);
        }
      }
      g.step();
      takte++;
      // Ausgang sofort abholen (ein Traeger waere immer sofort da)
      if(b.out>0){
        const gut=g.prodGood(b)||def.out||'?';
        ausgaben[gut]=(ausgaben[gut]||0)+b.out;
        stueck+=b.out; b.out=0;
      }
      if(b.satPause) ruht++;
      if(def.prod){
        let fehlt=false;
        for(const k in def.prod.inputs) if((b.stock[k]||0)<def.prod.inputs[k]) fehlt=true;
        if(fehlt) wartetEingang++;
      }
    }
    const jeMin=stueck/minuten;
    const soll=def.prod? 600/def.prod.time : (def.time? 600/def.time : null);
    g.demolish(b.id);
    return {typ, name:def.name, jeMin:+jeMin.toFixed(2), soll: soll? +soll.toFixed(2):null,
      wirkungsgrad: soll? +(jeMin/soll).toFixed(2):null,
      ausgaben, ruhteTakte:ruht, wartetEingangTakte:wartetEingang,
      taktBLD: def.prod? def.prod.time : def.time||null,
      eingaenge: def.prod? def.prod.inputs : null, kosten:def.cost};
  };

  // --- Foerster getrennt: er erzeugt keine Ware, sondern Setzlinge ---------
  const messeFoerster=(minuten)=>{
    const b=stelleHin('forester');
    if(!b) return {typ:'forester', fehler:'kein Bauplatz'};
    // Umgebung kahl raeumen, damit er pflanzen kann
    for(const q of g.nodesInRange(b.node, 8)){
      if(m.terr[q]===TER.GRASS && (m.obj[q]&127)!==OBJ.NONE && m.bld[q]<0 && !m.flag[q]){
        m.obj[q]=OBJ.NONE; g.changedNodes.push(q);
      }
    }
    let gepflanzt=0;
    const gesehen=new Set();
    for(let t=0;t<minuten*600;t++){
      g.step();
      for(const q of g.nodesInRange(b.node, 9)){
        const o=m.obj[q]&127;
        if((o===OBJ.SAPLING||o===OBJ.TREE2||o===OBJ.TREE) && !gesehen.has(q)){ gesehen.add(q); gepflanzt++; }
      }
    }
    g.demolish(b.id);
    return {typ:'forester', name:'Förster', jeMin:+(gepflanzt/minuten).toFixed(2),
      soll:+(600/60).toFixed(2), hinweis:'Setzlinge je Spielminute (kein Warenausstoss)'};
  };

  const liste = NUR.length? NUR : ['woodcutter','sawmill','quarry','fisher','hunter','well',
    'farm','mill','bakery','pigfarm','butcher','brewery','coalmine','ironmine','goldmine',
    'granitemine','smelter','mint','armory','toolsmith'];
  const out=[];
  for(const typ of liste){
    if(typ==='forester'){ out.push(messeFoerster(MIN)); continue; }
    if(!BLD[typ]){ out.push({typ, fehler:'unbekannter Typ'}); continue; }
    out.push(messe(typ, MIN, BLD[typ].foodBoost===true));
  }
  // Werkzeugschmiede zweimal: mit und ohne Essen (foodBoost)
  if(!NUR.length || NUR.includes('toolsmith')){
    const ohne=messe('toolsmith', MIN, false);
    ohne.name='Werkzeugschmiede (ohne Essen)';
    out.push(ohne);
  }
  // Eselzucht laeuft nur auf Anforderung einer stark befahrenen Strasse
  if(!NUR.length) out.push({typ:'donkeyfarm', name:'Eselzucht', taktBLD:200, soll:3,
    jeMin:null, hinweis:'nur auf Anforderung (spawnDonkey) - im Pruefstand nicht messbar',
    eingaenge:BLD.donkeyfarm.prod.inputs});
  if(!NUR.length) out.push(messeFoerster(MIN));
  return out;
}, [MIN, NUR]);

console.log(`PRUEFSTAND  Saat ${SAAT}, je Betrieb ${MIN} Spielminuten, Eingaenge im Ueberfluss\n`);
console.log('Betrieb              | Takt  | Soll/min | Ist/min | Wirkungsgrad | Ausgaben');
console.log('-'.repeat(92));
for(const r of erg){
  if(r.fehler){ console.log(`${(r.name||r.typ).padEnd(20)} | ${r.fehler}`); continue; }
  console.log(`${(r.name||r.typ).padEnd(20)} | ${String(r.taktBLD??'-').padStart(5)} `+
    `| ${String(r.soll??'-').padStart(8)} | ${String(r.jeMin).padStart(7)} | ${String(r.wirkungsgrad??'-').padStart(12)} `+
    `| ${JSON.stringify(r.ausgaben||{})}${r.hinweis? '  '+r.hinweis:''}`);
}
console.log('\nRohdaten:');
console.log(JSON.stringify(erg,null,1));
console.log('\nSeitenfehler:', fehler.length? fehler.slice(0,3):'keine');
await br.close();
