// Neuland – Spielsimulation: Wirtschaft, Logistik, Militär, KI.
import { TER, OBJ, BLD, GOODS, GOOD_LIST, FOODS, STYPES, STYPE_LIST, START_GOODS, PROF_OF, TOOL_OF, TOOLS, SAT_PAUSE, SAT_RESUME, SAT_OF, ESSEN_TEMPO, RANG_STD, rangListe, meldeKat, AI_MIL, BAUM_REIF, HQ_SCHUTZ, ATK_MARCH, MUSTER_DIST, MUSTER_WAIT, MinHeap, clamp } from './core.js';
import { WorldMap, genWorld } from './map.js';
import { mulberry32 } from './core.js';

export const TICK_MS = 100;           // 10 Sim-Ticks pro Sekunde (bei 1x)
const FLAG_CAP = 8;
// Wie lange ein Knoten fuer ein Gebaeude gesperrt bleibt, nachdem sich dort
// eine Figur festgelaufen hat. Rund fuenf Spielminuten - lang genug, damit der
// Kreislauf "immer wieder derselbe tote Knoten" bricht, kurz genug, dass ein
// nur zeitweise verstellter Platz (Figur im Weg, Baustelle daneben) wieder
// zurueck ins Spiel kommt.
const TABU_DAUER = 3000;
// Wie stark der Verkehrswert einer Strasse alle 300 Ticks abklingt.
const VERKEHR_ZERFALL = 0.985;
const CARRY_SPEED = 0.2;              // Knoten pro Tick
// Wie lange darf eine Figur an EINEM Weg haengen, bevor sie aufgibt und
// das Beste aus ihrer Lage macht? 1800 Takte sind drei Spielminuten -
// lang genug, dass kein normaler Weg daran scheitert, kurz genug, dass
// ein Haenger die Siedlung nicht fuer den Rest der Partie blockiert.
const WEG_GEDULD = 1800;
const WALK_SPEED = 0.12;

let NEXT_ID = 1;

export class Game {
  constructor(setup){
    // setup: {seed,size,theme,resources,players:[{name,ai,aiLevel}],level}
    this.setup = setup;
    this.rng = mulberry32((setup.seed ^ 0x9e37) >>> 0);
    const gen = genWorld({ seed: setup.seed, size: setup.size, theme: setup.theme,
      resources: setup.resources, playersN: setup.players.length, gate: !!setup.gate });
    this.map = gen.map;
    this.gate = gen.gate;
    this.t = 0;
    this.over = false; this.winner = -1;
    this.msgs = [];
    this.changedNodes = [];
    // Knoten, deren HÖHE sich im Spiel geändert hat (Planierer). Anders als
    // changedNodes muss der Renderer die hier wirklich neu backen: an der
    // Höhe hängen Massivdreiecke, Anhebung, Flanke, Grenzen und Firn.
    // Der Renderer leert die Liste, wenn er sie abgearbeitet hat.
    this.hoehenNeu = [];
    this.territoryVer = 1;
    this.routeVer = 1; this._routeCache = new Map(); this._compVer = 0; this._comp = new Map();
    this.buildings = new Map();       // id -> bld
    this.roads = new Map();           // id -> road
    this.flagItems = new Map();       // nodeIdx -> [{good,destB,reserved}]
    this.units = [];                  // sichtbare Figuren
    this.battles = [];                // laufende Kämpfe
    this.fx = [];                     // kosmetische Effekte (Pfeile, Feuer, Staub) – nicht gespeichert
    this.ruins = [];                  // niedergebrannte Plätze: [{node, t0}] – zerfallen nach einer Weile
    this.signs = new Map();           // nodeIdx -> Erztyp (0=nichts,1=Kohle,2=Eisen,3=Gold,4=Granit)
    this.animals = [];                // Wild (Reh/Hase/Wildschwein) – Beute des Jägers
    this.difficulty = setup.difficulty || 'normal';
    const dm = Game.diffMods(this.difficulty);
    this.players = setup.players.map((p,i)=>({
      id:i, name:p.name, ai:!!p.ai,
      aiLevel: p.ai ? clamp((p.aiLevel||1)+dm.aiLvl, 1, 3) : (p.aiLevel||1),
      defeated:false,
      recruits: {sword:2, spear:1, bow:1},   // Reserve im HQ, je Truppentyp
      aiState:{phase:0, lastAttack:0, wait:0},
      // Transport-Rangfolge je Ware (v196). Der Mensch darf sie im
      // Transportbildschirm umsortieren; die KI faehrt die Voreinstellung.
      rang: rangListe(i===0 ? setup.rang : null),
    }));
    this.rangIx = this.players.map(p=>Game.rangIndex(p.rang));
    this.level = setup.level || null;
    this.objectives = (setup.objectives||[]).map(o=>({...o, done:false, prog:0}));
    // Startaufstellung
    gen.starts.forEach((node,i)=>{
      if(i>=this.players.length) return;
      const hq = this.spawnBuilding(i,'hq',node,true);
      hq.inv = {...START_GOODS};
      const mul = (setup.startBoost||1) * (i===0 ? dm.startMul : 1);
      if(mul!==1) for(const k in hq.inv) hq.inv[k] = Math.ceil(hq.inv[k]*mul);
      this.players[i].hq = hq.id;
    });
    this.recalcTerritory();
    this.exploreAll(0);
    this.spawnAnimals();
  }
  // Aus der Rangliste eine Nachschlagetabelle Ware -> Platz machen. Sie wird
  // in dispatch() und bei jeder Traegerwahl gelesen, also einmal gebaut statt
  // jedes Mal indexOf() ueber 28 Waren laufen zu lassen.
  static rangIndex(liste){
    const ix={};
    (liste||RANG_STD).forEach((k,i)=>{ ix[k]=i; });
    return ix;
  }
  // Platz einer Ware in der Rangfolge dieses Spielers (kleiner = wichtiger).
  // Unbekanntes landet hinten.
  rangVon(pl, good){
    const ix=this.rangIx && this.rangIx[pl];
    if(!ix) return 99;
    const r=ix[good];
    return r===undefined? 99 : r;
  }
  // Neue Rangfolge uebernehmen (Transportbildschirm).
  setzeRang(pl, liste){
    const p=this.players[pl];
    if(!p) return;
    p.rang=rangListe(liste);
    if(!this.rangIx) this.rangIx=this.players.map(q=>Game.rangIndex(q.rang));
    this.rangIx[pl]=Game.rangIndex(p.rang);
  }
  // Schwierigkeitsgrad: Startwaren des Spielers, KI-Stärke, Angriffstakt, KI-Materialhilfe
  static diffMods(diff){
    switch(diff){
      case 'leicht': return { startMul:1.35, aiLvl:-1, atkMul:1.6, bonusMul:0.5 };
      case 'schwer': return { startMul:0.8,  aiLvl:+1, atkMul:0.75, bonusMul:1.3 };
      default:       return { startMul:1,    aiLvl:0,  atkMul:1,    bonusMul:1 };
    }
  }

  // ---------- Nachrichten ----------
  // `kat` ist die Meldungssparte (siehe MELDE_KATS in core.js). Der Spieler
  // schaltet Sparten in den Optionen ab; abgeschaltet heisst nur, dass die
  // Meldung nicht mehr eingeblendet wird - hier laeuft sie weiter auf, damit
  // sie im Meldungsbuch auffindbar bleibt.
  msg(txt, type='info', node=-1, player=0, kat=null){
    if(player!==0) return; // nur menschlicher Spieler (id 0) bekommt Meldungen
    // Wortgleiche Meldung im SELBEN Tick nur einmal: beim HQ-Fall brennt die
    // Kaskade (recalcTerritory -> burnBuilding -> recalcTerritory ...) mehrere
    // gleichnamige Gebäude im selben Takt nieder – "Eisenbergwerk wurde
    // zerstört!" stand dreifach im Bild (Kritikbericht F6).
    for(let k=this.msgs.length-1; k>=0; k--){
      const p=this.msgs[k];
      if(p.t!==this.t) break;
      if(p.txt===txt) return;
    }
    this.msgs.push({ t:this.t, txt, type, node, kat:meldeKat(kat, type) });
    if(this.msgs.length>120) this.msgs.shift();
  }
  // Entdoppelte Warnung: je Gebäude+Grund höchstens einmal pro Minute, je
  // Grund zusätzlich eine kurze Sammel-Sperre über alle Gebäude. Vorher
  // stapelte sich dieselbe Warnung (19x "keine Schaufel" in einem Lauf des
  // Kritikberichts), weil jede Baustelle einzeln und sofort meldete.
  // `cd`: Sperrzeit je Gebäude in Ticks (Standard 60 s). Dauerzustände wie
  // die Sammler-Erschöpfung nutzen eine LANGE Sperre – den Zustand zeigt das
  // Warnschild im Bild, der Toast soll nicht endlos wiederkehren (F5: 17
  // gleiche Erschöpfungs-Toasts in 50 min).
  // R7: Die Sperre war fest bei einer Minute je Gebaeude und Grund. Bei einem
  // Mangel, den der Spieler gerade NICHT beheben kann, wurde daraus eine
  // Dauerbeschwerde: gemessen ueber drei Partien zu 45 Spielminuten kam
  // allein "Jaeger: wartet auf Werkzeug (Bogen)!" 104 Mal - mit Abstand die
  // haeufigste Meldung des Spiels, dreimal so oft wie alle Kriegsmeldungen
  // zusammen. Die Sperre waechst deshalb jetzt: erste Erinnerung nach einer
  // Minute, dann 2, 4, 8 Minuten, gedeckelt bei acht. Die ersten Hinweise
  // bleiben, das Nagen hoert auf. Loest sich der Mangel, faengt die Zaehlung
  // beim naechsten Mal wieder von vorn an (siehe warnGeloest).
  warn(b, reason, txt, cd=600){
    if(b.player!==0) return;
    b._warnT=b._warnT||{}; b._warnN=b._warnN||{};
    const stufe=Math.min(3, b._warnN[reason]||0);
    if(b._warnT[reason]!==undefined && this.t-b._warnT[reason]<cd*(1<<stufe)) return;
    this._warnG=this._warnG||{};
    if(this._warnG[reason]!==undefined && this.t-this._warnG[reason]<300) return; // 30 s je Grund
    b._warnT[reason]=this.t; this._warnG[reason]=this.t;
    b._warnN[reason]=(b._warnN[reason]||0)+1;
    this.msg(txt, 'warn', b.node, 0, 'warnung');
  }
  // Mangel behoben: die Eskalation dieses Grundes zuruecksetzen, damit der
  // naechste echte Engpass wieder zuegig gemeldet wird.
  warnGeloest(b, reason){
    if(b._warnN && b._warnN[reason]!==undefined){ b._warnN[reason]=0; b._warnT[reason]=undefined; }
  }
  // Fehlt ein Werkzeug WIRKLICH? Nicht warnen, solange eines nur unterwegs
  // ist: Planierer/Bauarbeiter bringen ihres zurück, Fachkräfte retten ihres
  // bei Flucht. Vorher kam "keine Schaufel!" schon bei Spielstart, wenn alle
  // Schaufeln kurzzeitig parallel auf Baustellen belegt waren (Fehlalarm aus
  // dem Kritikbericht, F6).
  toolTrulyMissing(pl, tool){
    if(this.findToolStore(pl, tool)) return false;
    if(tool==='shovel' && this.units.some(u=>u.player===pl && u.type==='leveler')) return false;
    if(tool==='hammer' && this.units.some(u=>u.player===pl && u.type==='builder')) return false;
    if(this.units.some(u=>u.player===pl && u.tool===tool)) return false;
    return true;
  }

  // ---------- Gebäude ----------
  spawnBuilding(player, type, node, instant=false){
    this.bldVer=(this.bldVer||0)+1;      // Bauschatten neu berechnen lassen
    const def = BLD[type];
    const b = {
      id: NEXT_ID++, type, player, node,
      state: instant?'done':'build',           // build -> done -> burn
      progress: 0,
      stock: {},                                // Baumaterial / Produktionsinput
      out: 0,                                   // fertige Ware wartet auf Abtransport (Anzahl)
      incoming: {},                             // unterwegs
      inv: def.store? {} : undefined,           // Lagerbestand
      soldiers: def.mil? [] : undefined,        // Truppentypen stationierter Soldaten ('sword'|'spear'|'bow')
      coins: 0,
      leveled: instant,                          // Planierer muss den Platz erst ebnen
      worker: def.gather||def.mine||def.prod||def.cata ? { present: instant, state:'in', timer:0, target:-1, x:0,y:0 } : null,
      prodT: 0, foodT: 0, burnT: 0,
      paused:false, foodPrio:false, makeGood:null,
      garrison: def.mil? def.mil.cap : 0,
    };
    this.map.bld[node] = b.id;
    this.buildings.set(b.id, b);
    // Der Bauplatz wird geräumt. Große Häuser überdecken die Nachbarknoten
    // optisch – ein Baum dort sähe aus, als stünde das Haus in der Krone.
    {
      const r = (def.size==='L'||type==='hq') ? 2 : (def.size==='M'?1:0);
      if(r>0) for(const n of this.nodesInRange(node, r)){
        if(n===node) continue;
        if(Game.isTree(this.map.obj[n])){ this.map.obj[n]=OBJ.NONE; this.changedNodes.push(n); }
      }
      if(this.map.obj[node]!==OBJ.NONE){ this.map.obj[node]=OBJ.NONE; this.changedNodes.push(node); }
    }
    // Tür-Fahne: freier Nachbar (bevorzugt unten)
    const door = this.pickDoor(node, player);
    b.door = door;
    if(door>=0 && !this.map.flag[door]) this.addFlag(door);
    this.changedNodes.push(node);
    // Sofortbau (HQ/Test-Aufbauten) gilt als besetzt und wirkt sofort auf die Grenze
    if(instant && def.mil){ b.besetztWar=true; this.recalcTerritory(); }
    if(instant && type==='hq'){ b.soldiers=[]; }
    return b;
  }
  pickDoor(node, player=-1){
    // Der Eingang liegt IMMER unten: nur die untere Nachbarreihe kommt infrage,
    // bevorzugt der Knoten am nächsten zur Gebäudemitte.
    const m=this.map;
    const nbs=m.nbs(node);
    const my=m.Y(node), mx=m.X(node);
    const lower=nbs.filter(n=>m.Y(n)>my)
      .sort((a,b)=>Math.abs(m.X(a)-mx)-Math.abs(m.X(b)-mx));
    for(const n of lower){
      if(m.flag[n]) return n;                                    // vorhandene Fahne nutzen
      // bevorzugt im eigenen Gebiet: eine Tür jenseits der Grenze wäre unanschließbar
      if(player>=0 && m.owner[n]!==player) continue;
      if(m.terrOkRoad(n) && m.bld[n]<0 && this.roadObjOk(n) && !this.roadAt(n)) return n;
    }
    // 2. Wahl ohne Besitzprüfung (HQ-Start: Gebiet ist noch nicht berechnet)
    for(const n of lower){
      if(m.terrOkRoad(n) && m.bld[n]<0 && this.roadObjOk(n) && !this.roadAt(n)) return n;
    }
    // Notfall (sollte durch canBuild nicht vorkommen): restliche Nachbarn
    for(const n of nbs){
      if(m.flag[n]) return n;
      if(m.terrOkRoad(n) && m.bld[n]<0 && this.roadObjOk(n)) return n;
    }
    return nbs[0] ?? -1;
  }
  canBuild(player, type, node){
    const m=this.map, def=BLD[type];
    if(!def) return {ok:false, r:'?'};
    if(m.owner[node]!==player) return {ok:false, r:'Außerhalb deines Gebiets'};
    if(m.bld[node]>=0 || m.flag[node]) return {ok:false, r:'Platz belegt'};
    // BAEUME BLOCKIEREN NICHT MEHR. Nachgemessen auf zwei Karten, auf denen
    // die KI nach 30 Spielminuten NULL bebaubare Knoten hatte: von 628 bzw.
    // 271 eigenen Knoten waren 376 bzw. 184 schlicht Wasser - und obendrein
    // fielen 50 bzw. 29 Knoten nur deshalb weg, weil ein Baum daraufstand.
    // Das Vorbild faellt den Baum einfach; der Bauplatz wird geraeumt. Stein,
    // Fels, Ruinen und Felder blockieren weiterhin: Stein und Fels sind
    // Rohstoff beziehungsweise Hindernis, Ruinen zerfallen von selbst, und
    // ein Feld gehoert zu einem Bauernhof, der es noch braucht.
    if(m.obj[node]!==OBJ.NONE && !Game.isTree(m.obj[node]&127))
      return {ok:false, r:'Platz blockiert'};
    if(this.roadAt(node)) return {ok:false, r:'Hier verläuft eine Straße'};
    if(def.size==='MINE'){
      if(!m.terrOkMine(node)) return {ok:false, r:'Bergwerke nur im Gebirge'};
      // KOLLISION MIT FELSFORMATIONEN (Nutzerwunsch v98: "kollisionskontrolle
      // vom bergwerk mit objekten und prüfung ob platz"). Bisher wurde nur
      // der BAUKNOTEN selbst geprüft; eine Felsnadel einen Knoten weiter
      // steht aber mitten im Bild.
      // NUR die sechs direkten Nachbarn, und das ist gemessen: über das
      // ganze Bauschattenband (rund zwölf Knoten) fielen bei 17 % Felsdichte
      // fast neun von zehn Plätzen weg - auf Seed 7 blieb im Startgebiet
      // KEIN EINZIGER übrig. Geometrisch ist das Band auch zu weit: das
      // Minenbild ist etwa 85 Bildpunkte breit, der Knotenabstand 52 - was
      // zwei Knoten entfernt steht, überlappt nicht mehr.
      for(const n of m.nbs(node))
        if((m.obj[n]&127)===OBJ.ROCK) return {ok:false, r:'Felsen im Weg'};
    }
    else {
      if(!m.terrOkBuild(node)) return {ok:false, r:'Untergrund ungeeignet'};
    }
    // Netzbewusstsein: nur Plätze anbieten, deren Landstück ans Wegenetz des
    // Spielers anschließbar ist (HQ-Landstück oder per Seeweg angebundene
    // Landstücke). Verhindert tote Baustellen auf Sandbänken hinter Wasser –
    // auch die KI wählt so keine unanschließbaren Plätze mehr (F1).
    if(!this.netLandOk(player, node)) return {ok:false, r:'Kein Anschluss ans Wegenetz möglich'};
    if(def.coastal && !m.nbs(node).some(n=>m.terr[n]===TER.WATER))
      return {ok:false, r:'Nur direkt am Wasser'};
    // Die Tuerfahne braucht einen Platz UND einen Ausgang. Ohne diese
    // Pruefung liessen sich Haeuser bauen, deren Tuer von Wasser und
    // Nachbargebaeuden eingeschlossen ist - der Verbinden-Knopf lehnt dann
    // korrekt ab, aber das Haus haengt fuer immer ohne Strasse in der Luft.
    {
      const my=m.Y(node), mx=m.X(node);
      const lower=m.nbs(node).filter(n=>m.Y(n)>my)
        .sort((a,b2)=>Math.abs(m.X(a)-mx)-Math.abs(m.X(b2)-mx));
      let tuer=-1;
      // Tür und Ausgang müssen im EIGENEN Gebiet liegen: Straßen führen nie
      // durch fremdes/niemandes Land – eine Tür jenseits der Grenze wäre für
      // immer unanschließbar. Genau so entstanden die KI-Baustellen-Inseln
      // an der Front (F5) und die toten Grenz-Baustellen des Spielers (F8).
      for(const n of lower){
        if(m.flag[n] || (m.owner[n]===player && m.terrOkRoad(n) && m.bld[n]<0 && this.roadObjOk(n) && !this.roadAt(n))){ tuer=n; break; }
      }
      if(tuer<0) return {ok:false, r:'Kein Platz für die Türfahne'};
      // Ausgang: von der Fahne muss ein Weg wegfuehren koennen - eine
      // bestehende Fahne/Strasse daneben zaehlt, sonst ein begehbarer Knoten.
      // WICHTIG: der Bauschatten zaehlt mit (unterHaus) - ein optisch unter
      // dem Nachbargebaeude liegender Knoten ist fuer die Wegsuche gesperrt,
      // eine Tuer, deren einziger Ausgang dort liegt, waere eine Sackgasse
      // und die Baustelle verrottete unanschliessbar (Spielekritiker-Fund).
      if(!m.flag[tuer] && this.unterHaus(tuer))
        return {ok:false, r:'Eingang läge unter dem Nachbargebäude'};
      const ausgang=m.nbs(tuer).some(q=> q!==node &&
        (m.flag[q] || this.roadAt(q) ||
         (m.owner[q]===player && m.terrOkRoad(q) && m.bld[q]<0 && this.roadObjOk(q) && !this.unterHaus(q))));
      if(!ausgang) return {ok:false, r:'Eingang wäre eingeschlossen'};
      // Und jetzt die entscheidende Frage, die bisher NIEMAND gestellt hat:
      // kommt von dieser Tuer ueberhaupt je eine Strasse ans Wegenetz? Der
      // eigene Bauschatten zaehlt dabei mit - das neue Haus verstellt sich
      // sonst selbst den Ausgang.
      const ne=this.netzErreichbar(player);
      if(ne.netz.size && !ne.netz.has(tuer)){
        const eig=new Set(this.schattenBand(type, node));
        const geht=m.nbs(tuer).some(q=> !eig.has(q) && (ne.netz.has(q) || ne.R.has(q)));
        if(!geht) return {ok:false, r:'Kein Weg von dort zum Wegenetz'};
      }
    }
    // Fischer: ohne erreichbares Ufer in Gehweite faengt dort nie jemand
    // etwas - solche Plaetze werden gar nicht erst angeboten. Die Antwort
    // kommt aus einer einmal je Karte berechneten Erreichbarkeitsmaske
    // (Wasser aendert sich im Spielverlauf nicht).
    if(def.gather==='fish' && !this.fischNah()[node])
      return {ok:false, r:'Kein Fischgrund in Gehweite'};
    // Steinmetz: ohne einen einzigen Felsbrocken in Reichweite klopft dort
    // nie jemand - solche Plaetze werden gar nicht erst angeboten
    // (Nutzerbefund v165: "zu wenig Steinbloecke gefunden" - tote
    // Steinbrueche nach dem ersten Ausbau). Anders als beim Fisch aendert
    // sich der Steinbestand im Spielverlauf, deshalb kein festes Karten-
    // Cache, sondern eine kurze Merkzeit je Knoten (60 s) - der
    // Bauplatz-Vorschaumodus fragt sonst jeden Kandidaten jedes Bild ab.
    if(def.gather==='stone'){
      this._steinOk=this._steinOk||new Map();
      const e=this._steinOk.get(node);
      let da;
      if(e && this.t-e.t<600) da=e.ok;
      else {
        const un=(o)=>o&127;
        da=this.nodesInRange(node, def.range||10)
          .some(q=> un(m.obj[q])===OBJ.STONE && m.amt[q]>0);
        if(this._steinOk.size>4000) this._steinOk.clear();
        this._steinOk.set(node, {t:this.t, ok:da});
      }
      if(!da) return {ok:false, r:'Keine Felsbrocken in Reichweite'};
    }
    {
      // Eingang liegt unten: dort muss eine Türfahne möglich sein
      const my=m.Y(node);
      const doorOk=m.nbs(node).some(n=> m.Y(n)>my &&
        (m.flag[n] || (m.owner[n]===player && m.terrOkRoad(n) && m.bld[n]<0 && this.roadObjOk(n) && !this.roadAt(n))));
      if(!doorOk) return {ok:false, r:'Kein Platz für den Eingang (unterhalb)'};
    }
    if(def.size!=='MINE'){
      if(def.size!=='S'){
        let free=0;
        for(const n of m.nbs(node)) if(m.bld[n]<0 && m.terr[n]!==TER.WATER && m.terr[n]!==TER.LAVA && m.terr[n]!==TER.MOUNT) free++;
        if(free < (def.size==='L'?5:4)) return {ok:false, r:'Zu wenig Platz (größeres Gebäude)'};
      }
      // Betriebe mit Freiflächenbedarf: Bauernhof braucht Äcker, die
      // Schweinezucht ihre Koppel. Ohne freies Umland arbeiten sie nie.
      if(def.space){
        let open=0, need= def.space===2? 9 : 5;
        for(const n of this.nodesInRange(node, def.space+1)){
          if(n===node) continue;
          if(m.bld[n]>=0 || m.flag[n]) continue;
          if(!m.terrOkBuild(n)) continue;
          const o=m.obj[n]&127;
          if(o!==OBJ.NONE && o!==OBJ.FIELD0 && o!==OBJ.FIELD1 && o!==OBJ.FIELD2) continue;
          open++;
        }
        if(open<need) return {ok:false, r:`Zu wenig Freifläche ringsum (${open}/${need} Felder)`};
      }
    }
    // Abstand zu bestehenden Gebäuden: große Bauten (Burg, Festung, Hof)
    // brauchen einen Knoten mehr Luft, sonst schiebt sich der Nachbar
    // optisch unter ihr Dach.
    {
      const bigSelf = def.size==='L' || type==='hq';
      for(const n of this.nodesInRange(node, 2)){
        if(n===node) continue;
        const id=m.bld[n];
        if(id<0) continue;
        const ob=this.buildings.get(id);
        if(!ob) continue;
        const od=BLD[ob.type];
        const bigOther = od && (od.size==='L' || ob.type==='hq');
        const need = (bigSelf||bigOther) ? 2 : 1;
        const d=m.bfsDist(node, n, 3);
        if(d<need) return {ok:false, r:'Zu dicht am Nachbargebäude'};
      }
    }
    // Bildüberdeckung in BEIDE Richtungen: der Abstand oben misst nur
    // Knoten-Distanz zum Gebäudemittelpunkt - die Burg ragt aber im Bild
    // weiter (Sägewerk ließ sich halb unter ihr Dach setzen). Deshalb
    // zusätzlich gegen die gezeichneten Bauschatten prüfen.
    if(this.unterHaus(node)) return {ok:false, r:'Läge unter dem Nachbargebäude'};
    for(const n of this.schattenBand(type, node)){
      if(m.bld[n]>=0 || m.flag[n]) return {ok:false, r:'Würde das Nachbargebäude überdecken'};
      if(this.roadAt(n)) return {ok:false, r:'Würde die Straße überdecken'};
    }
    const door=this.pickDoor(node, player);
    if(door<0) return {ok:false, r:'Kein Platz für die Fahne'};
    return {ok:true};
  }
  placeBuilding(player, type, node){
    const c=this.canBuild(player,type,node); if(!c.ok) return c;
    // Steht ein Baum auf dem Bauplatz, faellt er mit dem ersten Spatenstich -
    // sonst waechst das Haus mitten durch die Krone.
    if(this.map.obj[node]!==OBJ.NONE && Game.isTree(this.map.obj[node]&127)){
      this.map.obj[node]=OBJ.NONE; this.changedNodes.push(node);
    }
    const b=this.spawnBuilding(player,type,node);
    // Bau-Anforderungen laufen über die Logistik (Bretter/Steine)
    return {ok:true, b};
  }
  demolish(id){
    const b=this.buildings.get(id); if(!b) return;
    // Abriss erstattet Baumaterial (Kritikbericht: so lässt sich der
    // Holzfäller/Steinmetz dem wandernden Vorkommen hinterherziehen, ohne
    // die Wirtschaft zu verlieren):
    //  - Baustelle: das bereits angelieferte Material komplett
    //  - fertiges Gebäude: die halben Baukosten, aufgerundet
    // Kriegszerstörung läuft über burnBuilding(b, true) und erstattet nichts.
    const def=BLD[b.type];
    const erst={};
    if(b.type!=='hq'){
      if(b.state==='build'){
        for(const g of ['board','stone']) if((b.stock[g]|0)>0) erst[g]=b.stock[g]|0;
      } else if(b.state==='done'){
        for(const g of ['board','stone']) if(def.cost[g]) erst[g]=Math.ceil(def.cost[g]/2);
      }
    }
    const door=b.door, pl=b.player;
    this.burnBuilding(b, false);
    this.erstatteWaren(pl, door, erst);
  }
  // Erstattete Waren an der Türfahne des Abrisses ablegen – Träger holen sie
  // wie jede andere Ware ab. Ist die Fahne weg (kein Weg nutzte sie) oder
  // hängt sie an keinem Lager, trägt die Abrisskolonne das Material direkt
  // ins nächste Lager (sonst verrottete die Erstattung an einer toten Fahne).
  erstatteWaren(pl, door, waren){
    let menge=0; for(const g in waren) menge+=waren[g];
    if(!menge) return;
    const stores=this.storesOf(pl);
    if(!stores.length) return;                    // kein Lager mehr (besiegt)
    let store=null;
    if(door>=0 && this.map.flag[door]){
      const comp=this.compOf(door);
      if(comp!==undefined){
        let bd=1e9;
        for(const s of stores){
          if(this.compOf(s.door)!==comp) continue;
          const d=this.flagDist(s.door, door);
          if(d<bd){ bd=d; store=s; }
        }
      }
    }
    if(store){
      const items=this.flagItems.get(door)||[];
      for(const g in waren) for(let k=0;k<waren[g];k++){
        items.push({good:g, destB:store.id, srcB:-1});
        store.incoming[g]=(store.incoming[g]||0)+1;
      }
      this.flagItems.set(door, items);
    } else {
      // nächstgelegenes Lager (Luftlinie) direkt beliefern
      const m=this.map;
      let s0=stores[0], bd=1e9;
      for(const s of stores){
        const d=door>=0? Math.hypot(m.X(s.node)-m.X(door), m.Y(s.node)-m.Y(door)) : 0;
        if(d<bd){ bd=d; s0=s; }
      }
      for(const g in waren) s0.inv[g]=(s0.inv[g]||0)+waren[g];
    }
  }
  burnBuilding(b, byWar=true, stumm=false){
    if(!this.buildings.has(b.id)) return;
    this.bldVer=(this.bldVer||0)+1;
    this.map.bld[b.node] = -1;
    this.buildings.delete(b.id);
    this.changedNodes.push(b.node);
    // eingezogene Fachkraft flieht sichtbar zurück ins Hauptquartier (rettet
    // ihr Werkzeug) – sie tritt dabei durch die TÜR aus, nicht durch die Wand
    if(b.worker && b.worker.present && b.type!=='hq'){
      this.units.push({ id:NEXT_ID++, type:'flee', player:b.player, ...this.tuerAustritt(b),
        wtype:PROF_OF[b.type]||'worker', tool:b.toolGood||null });
    }
    // Fachkraft noch auf dem Anmarsch? -> umkehren statt verschwinden (Werkzeug!)
    for(const u of this.units)
      if(u.type==='settle' && u.bld===b.id){ u.type='flee'; u.bld=undefined; }
    // Seewege dieses Hafens/dieser Werft kappen
    if(b.type==='harbor'){
      for(const [rid,r] of [...this.roads])
        if(r.isSea && (r.path[0]===b.door || r.path[r.path.length-1]===b.door)) this.removeRoad(rid);
    }
    // Groessenklasse fuer die Brand- und Ruinenbilder (Lieferung E):
    // S/M/L nach Bauklasse, Militaerbauten als 'turm', Bergwerke als 'mine'
    // (dort stuerzt der Stollen ein statt ein Dachstuhl zu brennen).
    const dfB=BLD[b.type];
    const kl = dfB.size==='MINE' ? 'mine'
             : dfB.mil          ? 'turm'
             : dfB.size==='L' || b.type==='hq' ? 'l'
             : dfB.size==='M'   ? 'm' : 's';
    // ABRISS brennt jetzt auch sichtbar nieder (Nutzerwunsch: "wenn das
    // Gebaeude abgerissen ODER angegriffen wird, dass es niederbrennt").
    // Aber nur der Kriegsschaden hinterlaesst eine Ruine, die den Platz
    // blockiert - beim Abriss will der Spieler sofort neu bauen koennen,
    // eine Sperre waere hier eine Spielaenderung und keine Grafik.
    // 'typ' geht mit, damit der Renderer zuerst ein Brandblatt DIESES
    // Gebaeudes sucht (fx_burn_<typ>_1..3) und erst danach das der Klasse.
    this.fx.push({type:'burn', node:b.node, t0:this.t, typ:b.type,
                  big:dfB.size==='L', kl, kurz:!byWar});
    if(byWar){
      if(this.map.obj[b.node]===OBJ.NONE){
        this.map.obj[b.node]=OBJ.RUIN;
        this.ruins.push({node:b.node, t0:this.t, kl});
      }
      // Nachbau-Bremse der KI: Wer einen Militärposten (auch eine Baustelle)
      // im Kampf verliert, baut nicht sofort und endlos nach. Ohne die Pause
      // setzte die KI zerstörte Baracken im Minutentakt neu – der Angreifer
      // zerstörte Baustellen am laufenden Band und eroberte nie (Whack-a-mole
      // aus dem Kritikbericht). Die Wartezeit steigt mit jedem weiteren
      // Verlust in kurzer Folge; ruhige Zeiten lassen die Zählung verjähren.
      if(BLD[b.type].mil){
        const p=this.players[b.player];
        if(p && p.ai){
          const st=p.aiState;
          if(this.t-(st.milLossT||0)>3000) st.milLoss=0;      // >5 min Ruhe: verziehen
          st.milLoss=(st.milLoss||0)+1; st.milLossT=this.t;
          st.milCd=this.t + 450 + 450*Math.min(4, st.milLoss-1);  // 45 s .. 225 s
        }
      }
      this.onBurn && this.onBurn(b);
    }
    // verwaiste Türfahne aufräumen (wenn keine Straße und kein anderes Gebäude sie nutzt)
    if(b.door>=0 && this.map.flag[b.door]){
      const used=[...this.buildings.values()].some(o=>o.door===b.door)
        || [...this.roads.values()].some(r=>r.path[0]===b.door||r.path[r.path.length-1]===b.door);
      if(!used){ this.map.flag[b.door]=0; this.leereFahne(b.door); this.routeVer++; this.changedNodes.push(b.door); }
    }
    // Träger/Einheiten dieses Gebäudes entfernen – Bauarbeiter und Planierer
    // bleiben und kehren mit ihrem Werkzeug heim (eigene Heim-Logik)
    this.units = this.units.filter(u=> u.bld!==b.id || u.type==='builder' || u.type==='leveler');
    for(const bt of this.battles) if(bt.bldId===b.id) bt.doneFlag=true;
    if(BLD[b.type].mil || b.type==='hq') this.recalcTerritory();
    if(b.type==='hq') this.checkPlayerDefeat(b.player);
    // stumm: der Aufrufer hat bereits eine SPEZIFISCHERE Meldung abgesetzt
    // (Kritik R2 S1: "Baustelle vom Feind zerstoert!" und "wurde zerstoert!"
    // kamen stets im selben Atemzug - EIN Ereignis, zwei Meldungen)
    if(byWar && !stumm && b.player===0) this.msg(`${BLD[b.type].name} wurde zerstört!`, 'warn', b.node, 0, 'kampf');
  }
  checkPlayerDefeat(pl){
    const p=this.players[pl];
    if(p.defeated) return;
    const hasHQ=[...this.buildings.values()].some(b=>b.player===pl && b.type==='hq');
    if(hasHQ) return;
    p.defeated=true;
    for(const b of [...this.buildings.values()]) if(b.player===pl) this.burnBuilding(b,false);
    this.roadsCleanupForPlayer(pl);
    // korrekte Anrede: der menschliche Spieler heißt im freien Spiel "Du" –
    // die Namens-Schablone machte daraus "Du ist besiegt!" (Kritikbericht F6)
    this.msg(p.name==='Du' ? 'Du bist besiegt!' : `${p.name} ist besiegt!`, 'war', -1, 0, 'ziel');
    this.recalcTerritory();
    const alive=this.players.filter(q=>!q.defeated);
    if(alive.length===1 && !this.over && !this.objectives.length){
      this.over=true; this.winner=alive[0].id;
    }
  }
  roadsCleanupForPlayer(pl){
    for(const [id,r] of [...this.roads]) if(r.player===pl) this.removeRoad(id);
    for(let i=0;i<this.map.flag.length;i++)
      if(this.map.flag[i] && this.map.owner[i]===pl){ this.map.flag[i]=0; this.leereFahne(i); this.changedNodes.push(i); }
  }

  // ---------- Fahnen & Straßen ----------
  // Wege dürfen durch den Wald geschlagen werden: Bäume auf der Trasse
  // werden gefällt, statt die Verbindung zu blockieren.
  static isTree(o){ const t=o&127; return t===OBJ.TREE||t===OBJ.TREE2||t===OBJ.SAPLING; }
  roadObjOk(i){ const o=this.map.obj[i]; return (o&127)===OBJ.NONE || Game.isTree(o); }
  clearForRoad(i){
    if(Game.isTree(this.map.obj[i])){
      this.map.obj[i]=OBJ.NONE;
      this.changedNodes.push(i);
    }
  }
  canPlaceFlag(i, player){
    const m=this.map;
    if(m.owner[i]!==player) return false;
    if(m.flag[i] || m.bld[i]>=0 || !this.roadObjOk(i)) return false;
    if(!m.terrOkRoad(i)) return false;
    for(const n of m.nbs(i)) if(m.flag[n]) return false; // Mindestabstand wie im Klassiker
    return true;
  }
  addFlag(i){
    this.clearForRoad(i);
    this.map.flag[i]=1;
    if(!this.flagItems.has(i)) this.flagItems.set(i,[]);
    // Eine Fahne TEILT immer den Weg, auf dem sie steht. Das gehörte früher
    // nur zu placeFlag – wer die Fahne über buildRoad (Wegende mitten auf
    // einem fremden Weg), createRoad oder als Gebäudetür bekam, ließ den
    // alten Weg ungeteilt weiterlaufen: zwei Wege lagen übereinander, und
    // der alte führte mitten durch eine Fahne. Deshalb sitzt die Teilung
    // jetzt an der einen Stelle, durch die JEDE neue Fahne muss.
    this.splitRoadsAt(i);
    this.routeVer++; this.changedNodes.push(i);
  }
  splitRoadsAt(i){
    // kein break: sollte (durch alte Spielstände) mehr als ein Weg hier
    // durchlaufen, werden alle geteilt – die Invariante zählt
    for(const [id,r] of [...this.roads]){
      const k=r.path.indexOf(i);
      if(k>0 && k<r.path.length-1){
        const p1=r.path.slice(0,k+1), p2=r.path.slice(k);
        this.removeRoad(id, true);
        this.createRoad(r.player, p1); this.createRoad(r.player, p2);
      }
    }
  }
  placeFlag(i, player){
    if(!this.canPlaceFlag(i,player)) return false;
    this.addFlag(i);           // teilt einen darunterliegenden Weg gleich mit
    return true;
  }
  removeFlag(i){
    if(!this.map.flag[i]) return;
    // Gebäude-Türfahnen nicht löschen
    for(const b of this.buildings.values()) if(b.door===i) return;
    for(const [id,r] of [...this.roads]) if(r.path[0]===i || r.path[r.path.length-1]===i) this.removeRoad(id);
    this.map.flag[i]=0; this.leereFahne(i); this.routeVer++; this.changedNodes.push(i);
  }
  roadAt(node){
    for(const r of this.roads.values()) if(r.path.includes(node)) return r;
    return null;
  }
  // Ein Haus belegt im Gitter nur EINEN Punkt, gezeichnet ist es aber viel
  // größer. Eine Straße knapp daneben verschwand deshalb optisch unter dem
  // Gebäude – bei der Burg besonders auffällig. Hier wird geprüft, ob ein
  // Punkt unter dem gezeichneten Bild liegt. Der Zeichner meldet die
  // tatsächlichen Bildmaße über bldFoot; ohne ihn (Tests) greift die
  // Notmaße-Tabelle.
  // HILFE FUER DIE KI: Schwellen, unter die ihr Lager nicht fallen soll.
  // Das ist KEIN Zufluss, sondern ein Boden (siehe aiStep): nachgelegt wird
  // nur die Luecke. Wer selbst produziert, bleibt darueber und bekommt
  // nichts - die Hilfe erledigt sich damit von allein, sobald die eigene
  // Werkzeugkette laeuft.
  // Gestaffelt nach Stufe: die leichte KI soll nicht verhungern, die
  // schwere soll moeglichst auf eigenen Beinen stehen. Werkzeuge sind
  // hoeher angesetzt als Baustoff, weil die Messung zeigt, dass genau sie
  // die Kruecke sind - Holz und Stein holt sich die KI selbst.
  static AI_HILFE = {
    1: { board:10, stone:8,  hammer:4, shovel:3, pick:3, werkzeug:2, beer:3, waffe:3 },
    2: { board:8,  stone:7,  hammer:3, shovel:2, pick:2, werkzeug:1, beer:2, waffe:2 },
    3: { board:6,  stone:5,  hammer:2, shovel:2, pick:2, werkzeug:1, beer:2, waffe:2 },
  };
  static FOOT={ hq:[200,190], L:[126,112], M:[100,84], S:[84,66], MINE:[86,64] };
  // Die verdeckten Punkte werden EINMAL je Bauzustand gesammelt. Die
  // Wegsuche fragt sie tausendfach ab; jedesmal alle Häuser durchzugehen
  // hat die Bildrate spürbar gekostet.
  bauSchatten(){
    if(this._schatten && this._schatten.ver===this.bldVer) return this._schatten.set;
    const m=this.map, set=new Set();
    for(const b of this.buildings.values()){
      const def=BLD[b.type];
      if(!def) continue;
      const f=(this.bldFoot && this.bldFoot[b.type])
           || Game.FOOT[b.type==='hq'?'hq':(def.size||'M')] || Game.FOOT.M;
      const [bx,by]=m.worldPos(b.node);
      // Reichweite: halbe Bildbreite bzw. Bildhöhe in Gitterschritten
      const R=Math.max(2, Math.ceil(Math.max(f[0]*0.40/52, f[1]*0.78/44))+1);
      for(const n of this.nodesInRange(b.node, R)){
        if(n===b.node || n===b.door) continue;
        const [nx,ny]=m.worldPos(n);
        // Das Bild steht mit dem Fuß knapp unter dem Gitterpunkt und ragt
        // nach oben. Etwas knapper gefasst als gezeichnet: lieber eine
        // Straße zu wenig sperren als eine zu viel.
        if(Math.abs(nx-bx) < f[0]*0.40 && ny < by+14 && ny > by-f[1]*0.78) set.add(n);
      }
    }
    this._schatten={ver:this.bldVer, set};
    return set;
  }
  unterHaus(n){ return this.bauSchatten().has(n); }
  // Von welchen Knoten aus kommt ueberhaupt noch eine Strasse ans Wegenetz?
  //
  // netLandOk hat bisher nur den LAND-Zusammenhang geprueft - Fahnen,
  // Strassen und Bauschatten blieben aussen vor. Gemessen: nach vier
  // regulaeren Gebaeuden waren 54 Bauplaetze laut canBuild legal und davon
  // KEIN EINZIGER anschliessbar. Der Spieler baut sich zu, die KI setzt
  // Baustellen, die sie 3000 Ticks spaeter wieder abreisst.
  //
  // Statt je Bauplatz einen A*-Lauf zu starten (canBuild wird beim Anzeigen
  // der Baupunkte hundertfach gerufen) wird EINMAL je Netz- und Bauzustand
  // geflutet: von den Netzfahnen aus ueber alle Knoten, die als
  // Strassen-Zwischenstueck taugen. Fahnen sind dabei Endpunkte, keine
  // Durchgaenge - genau wie in roadPath.
  netzErreichbar(player){
    const key=player+'|'+this.routeVer+'|'+(this.bldVer||0)+'|'+(this.gebietVer||0);
    if(this._netzE && this._netzE.key===key) return this._netzE;
    const m=this.map;
    const netz=new Set();
    const stores=this.storesOf(player);
    const comps=new Set();
    for(const s of stores){
      if(s.door>=0) netz.add(s.door);
      const c=this.compOf(s.door);
      if(c!==undefined) comps.add(c);
    }
    for(const r of this.roads.values()){
      if(r.player!==player) continue;
      for(const f of [r.path[0], r.path[r.path.length-1]])
        if(comps.has(this.compOf(f))) netz.add(f);
    }
    // ABZWEIG VON DER EIGENEN STRASSE. Eine Fahne darf mitten auf einer
    // Strasse stehen - canPlaceFlag verbietet es nicht, und addFlag teilt
    // den Weg dort. Genau so verbindet der Knopf des Spielers (autoConnect:
    // "das kann mitten auf einer Strasse liegen"). Diese Reichweite hier
    // kannte den Abzweig nicht, und weil ein Strassen-Innenknoten unten in
    // frei() gesperrt ist, galt jedes Stueck Land HINTER einer eigenen
    // Strasse als unerreichbar. Die Siedlung mauerte sich mit ihrem eigenen
    // Wegenetz ein: nachgemessen konnten 146 von 147 abgelehnten
    // Bauplaetzen ("Kein Weg von dort zum Wegenetz") sehr wohl einen
    // Strassenknoten erreichen, auf dem eine Fahne erlaubt gewesen waere.
    // Seewege zaehlen nicht - auf dem Wasser steht keine Fahne.
    for(const r of this.roads.values()){
      if(r.player!==player || r.isSea) continue;
      if(!comps.has(this.compOf(r.path[0]))) continue;
      for(let k=1;k<r.path.length-1;k++)
        if(this.canPlaceFlag(r.path[k], player)) netz.add(r.path[k]);
    }
    const onRoad=new Set();
    for(const r of this.roads.values())
      r.path.forEach((n,ix)=>{ if(ix>0&&ix<r.path.length-1) onRoad.add(n); });
    const frei=(n)=> !m.flag[n] && m.owner[n]===player && m.terrOkRoad(n) && m.bld[n]<0
                     && this.roadObjOk(n) && !this.unterHaus(n) && !onRoad.has(n);
    const R=new Set(), q=[];
    for(const f of netz)
      for(const n of m.nbs(f)) if(frei(n) && !R.has(n)){ R.add(n); q.push(n); }
    for(let i=0;i<q.length;i++)
      for(const n of m.nbs(q[i])) if(frei(n) && !R.has(n)){ R.add(n); q.push(n); }
    this._netzE={key, netz, R};
    return this._netzE;
  }
  // Bauschatten-Vorschau für einen BAUKANDIDATEN: dieselbe Bildmaß-Formel
  // wie bauSchatten(), nur für ein einzelnes, noch ungebautes Gebäude.
  schattenBand(type, node){
    const m=this.map, def=BLD[type]||{};
    const f=(this.bldFoot && this.bldFoot[type])
         || Game.FOOT[type==='hq'?'hq':(def.size||'M')] || Game.FOOT.M;
    const [bx,by]=m.worldPos(node);
    const R=Math.max(2, Math.ceil(Math.max(f[0]*0.40/52, f[1]*0.78/44))+1);
    const out=[];
    for(const n of this.nodesInRange(node, R)){
      if(n===node) continue;
      const [nx,ny]=m.worldPos(n);
      if(Math.abs(nx-bx) < f[0]*0.40 && ny < by+14 && ny > by-f[1]*0.78) out.push(n);
    }
    return out;
  }
  // A*-Straßenpfad von Fahne zu Ziel (nur eigenes Gebiet, passierbar, keine
  // Gebäude, kein Kreuzen anderer Straßen außer an Fahnen). `avoid`: Knoten
  // des GERADE ENTSTEHENDEN Weges (Wegpunkt-Tippen in der Bedienung) – die
  // sind noch keine Straße, dürfen aber genauso wenig überlaufen werden,
  // sonst überlappt der fertige Weg sich selbst.
  roadPath(player, from, to, avoid=null){
    const m=this.map;
    if(from===to) return null;
    if(avoid && avoid.has(to)) return null;
    const onRoad=new Set();
    for(const r of this.roads.values()) r.path.forEach((n,ix)=>{ if(ix>0&&ix<r.path.length-1) onRoad.add(n); });
    // ALLE Straßenpunkte (auch Fahnen) - fürs Verteuern von Parallelwegen
    const roadN=new Set();
    for(const r of this.roads.values()) if(!r.isSea) for(const n of r.path) roadN.add(n);
    const okNode=(n)=> m.owner[n]===player && m.terrOkRoad(n) && m.bld[n]<0 &&
      this.roadObjOk(n) && !this.unterHaus(n) && (!onRoad.has(n) || n===to) &&
      !(avoid && avoid.has(n));
    if(!okNode(to) && !m.flag[to]) return null;
    const h=(n)=>{ const dx=m.X(n)-m.X(to), dy=m.Y(n)-m.Y(to); return Math.sqrt(dx*dx+dy*dy); };
    // Wegebau wie in echt: der billigste Weg ist der ebene durch freies Land.
    // Steigungen, Sumpf, Fels und dichter Baumbestand kosten extra – dadurch
    // schmiegt sich die Straße an das Gelände, statt schnurgerade
    // durchzuschneiden.
    const stepCost=(a,b2)=>{
      let c=1;
      c += Math.min(2.4, Math.abs(m.hgt[a]-m.hgt[b2])*1.5);      // Steigung
      const t=m.terr[b2];
      if(t===TER.SWAMP) c+=1.4;
      if(t===TER.MOUNT) c+= (m.pass && m.pass[b2]) ? 0.1 : 1.0;   // durch den Pass ist es leicht
      if(Game.isTree(m.obj[b2])) c+=0.9;                          // Baum muss fallen
      // an Objekten vorbei ist enger -> leicht meiden, damit der Weg nicht
      // an Felsen und Stämmen entlangschrammt
      let tight=0;
      for(const q of m.nbs(b2)) if((m.obj[q]&127)!==OBJ.NONE || m.bld[q]>=0) tight++;
      c += tight*0.16;
      // NEBEN einer bestehenden Straße herlaufen ist teuer: sonst entstehen
      // Parallelwege eine Reihe daneben, und die Träger laufen doppelte Wege.
      let par=0;
      for(const q of m.nbs(b2)) if(roadN.has(q)) par++;
      c += Math.min(1.1, par*0.55);
      return c;
    };
    const open=new MinHeap(); open.push(h(from), from);
    const g=new Map([[from,0]]), par=new Map();
    let found=false;
    while(open.size){
      const [,cur]=open.pop();
      if(cur===to){ found=true; break; }
      for(const n of m.nbs(cur)){
        if(n!==to && n!==from){
          if(m.flag[n]) continue;         // fremde Fahnen nicht durchqueren
          if(!okNode(n)) continue;
        } else if(n===to){
          if(!okNode(n) && !m.flag[n]) continue;
        }
        const ng=g.get(cur)+stepCost(cur,n);
        if(ng < (g.get(n)??1e9)){ g.set(n,ng); par.set(n,cur); open.push(ng+h(n), n); }
      }
      if(g.size>2600) break;
    }
    if(!found) return null;
    const path=[to]; let c=to;
    while(c!==from){ c=par.get(c); path.push(c); }
    path.reverse();
    if(path.length<2 || path.length>40) return null;
    return path;
  }
  createRoad(player, path){
    const id=NEXT_ID++;
    for(const n of path) this.clearForRoad(n);      // Schneise durch den Wald
    this.roads.set(id, { id, player, path,
      carrier:{ pos:0, state:'idle', item:null, dir:1 } });
    if(!this.map.flag[path[0]]) this.addFlag(path[0]);
    if(!this.map.flag[path[path.length-1]]) this.addFlag(path[path.length-1]);
    this.routeVer++;
    return id;
  }
  buildRoad(player, path){
    // path: Knotenliste, Start ist Fahne; Ende: Fahne oder Fahne wird gesetzt
    if(!path || path.length<2) return false;
    // Torwächter gegen Überlappungen: die Bedienung setzt Wege stückweise
    // zusammen – hier wird das ERGEBNIS geprüft, damit kein kaputtes Stück
    // je zur Straße wird. Ein Weg darf sich nicht selbst besuchen, und sein
    // Inneres darf weder Fahnen tragen noch auf fremden Wegen liegen
    // (dort müsste er an einer Fahne ENDEN, nicht weiterlaufen).
    if(new Set(path).size!==path.length) return false;
    for(let k=1;k<path.length-1;k++){
      const n=path[k];
      if(this.map.flag[n] || this.roadAt(n)) return false;
    }
    const end=path[path.length-1];
    if(!this.map.flag[end]){
      if(!this.canPlaceFlag(end,player)) return false;
      this.addFlag(end);       // teilt einen Weg unter dem Endpunkt gleich mit
    }
    this.createRoad(player, path);
    return true;
  }
  removeRoad(id, silent=false){
    const r=this.roads.get(id); if(!r) return;
    // Die getragene Ware wurde bisher ersatzlos vernichtet. Das passiert bei
    // JEDER neuen Fahne auf einem bestehenden Weg (addFlag -> splitRoadsAt ->
    // removeRoad), also bei ganz normalem Umbauen. Jetzt wird sie auf einer
    // Endfahne des Weges abgelegt, sofern von dort noch eine Route zum
    // Besteller fuehrt; erst wenn das scheitert, wird abgebucht.
    if(r.carrier.item){
      const enden=[r.path[r.path.length-1], r.path[0]];
      // Die Strasse ist beim Ablegen schon nicht mehr befahrbar - erst
      // loeschen, dann umlagern, sonst rechnet nextRoad noch mit ihr.
      this.roads.delete(id); this.routeVer++;
      this.umlagernOderAbbuchen(r.carrier.item, enden);
      r.carrier.item=null;
    }
    // Der Traeger hatte seine Ware vielleicht erst RESERVIERT und noch nicht
    // aufgenommen (Zustand toPick/pickup). Ohne diese Zeile bleibt das
    // Reserviert-Bit fuer immer stehen: jeder andere Traeger ueberspringt die
    // Ware (siehe tickCarriers), incoming beim Ziel bleibt erhoeht, und
    // requestsOf bestellt deshalb nie nach. Genau so entstand die Baustelle,
    // die bei vollem Lager ewig auf ihr letztes Brett wartet.
    if(r.carrier.job && r.carrier.job.item) r.carrier.job.item.reserved=false;
    this.roads.delete(id);
    this.routeVer++;
    if(!silent){
      // verwaiste Fahnen ohne Straße und ohne Gebäude bleiben stehen (Spieler kann sie entfernen)
    }
  }
  dropItem(item){ // Ware geht verloren -> incoming beim Ziel korrigieren
    const b=this.buildings.get(item.destB);
    if(b && b.incoming[item.good]) b.incoming[item.good]--;
  }
  // Eine Ware woanders unterbringen, statt sie zu vernichten. Zielfahne taugt
  // nur, wenn von ihr aus ueberhaupt eine Route zum Besteller fuehrt - sonst
  // laege die Ware fuer immer tot herum UND incoming bliebe erhoeht, es wuerde
  // also auch nie nachbestellt. Klappt es nicht, wird sauber abgebucht.
  umlagernOderAbbuchen(item, fahnen){
    const dest=this.buildings.get(item.destB);
    if(dest){
      for(const f of fahnen){
        if(f===undefined || f<0 || !this.map.flag[f]) continue;
        if(f!==dest.door && this.nextRoad(f, dest.door)===null) continue;
        const items=this.flagItems.get(f)||[];
        if(items.length>=FLAG_CAP+4) continue;
        item.reserved=false;
        items.push(item); this.flagItems.set(f, items);
        return true;
      }
    }
    this.dropItem(item);
    return false;
  }
  // Baumaterial-Bestellungen aufloesen, sobald das Haus FERTIG ist.
  // Nutzer-Report v191 ("die Wirtschaft waechst nicht"), Ursache gemessen:
  // Waren, die noch zu einer inzwischen fertigen Baustelle unterwegs waren,
  // blieben als Auftrag bestehen und lagen auf der QUELLfahne. Die Quelle war
  // in jeder gemessenen Partie das Hauptquartier - und findSource ueberspringt
  // eine Fahne mit FLAG_CAP (8) Waren. Acht solcher Ladenhueter genuegten
  // damit, um das HQ als Quelle FUER ALLES stillzulegen: gemessen auf Saat
  // 2024 lagen nach 35 Minuten 7x Stein fuer ein laengst fertiges Wachhaus
  // auf der HQ-Fahne, waehrend sieben Baustellen (darunter beide Eisenminen)
  // mit leerem Lager dastanden - kein Brett, kein Stein, kein Bauarbeiter,
  // Fortschritt 0 seit 25 Minuten. Das Spiel fror lautlos ein.
  bestellungenAufloesen(b){
    for(const [f,items] of this.flagItems){
      for(let k=items.length-1;k>=0;k--){
        const it=items[k];
        if(it.destB!==b.id) continue;
        if(it.good!=='board' && it.good!=='stone') continue;
        if(it.reserved) continue;              // ein Traeger hat sie schon
        items.splice(k,1);
        if(b.incoming[it.good]) b.incoming[it.good]--;
        // woanders unterbringen: das naechste Lager nimmt sie auf
        const lager=this.findStore(b.player, f);
        if(lager){ it.destB=lager.id; lager.incoming[it.good]=(lager.incoming[it.good]||0)+1; }
        this.umlagernOderAbbuchen(it, [f, ...this.map.nbs(f).filter(q=>this.map.flag[q])]);
      }
    }
  }
  // naechstes eigenes Lagergebaeude von einer Fahne aus (HQ oder Lagerhaus)
  findStore(pl, vonFahne){
    let best=null, bd=1e9;
    for(const s of this.buildings.values()){
      if(s.player!==pl || !s.inv || s.state!=='done') continue;
      const d=this.flagDist(s.door, vonFahne);
      if(d<bd){ bd=d; best=s; }
    }
    return best;
  }
  // Alle Waren einer Fahne aufloesen, BEVOR die Fahne verschwindet. Vorher
  // stand an vier Stellen ein blankes flagItems.delete(): die Waren waren weg,
  // incoming beim Besteller blieb aber stehen, und requestsOf bestellte
  // deshalb nie nach - das Gebaeude wartete bis Spielende auf Nachschub.
  leereFahne(i){
    const items=this.flagItems.get(i);
    if(items && items.length){
      const nachbarn=this.map.nbs(i).filter(q=>this.map.flag[q]);
      for(const it of items) this.umlagernOderAbbuchen(it, nachbarn);
    }
    this.flagItems.delete(i);
  }
  // Verkehr klingt ab. Vorher wurde r.traffic nur HOCHGEZAEHLT: nach 32
  // Ladungen erreichte (traffic-6)/26 dauerhaft 1, jede Strasse war also
  // nach wenigen Minuten fuer immer voll gepflastert, und ein stillgelegter
  // Weg verwitterte nie. Die gewollte Abstufung war ein Ratschenmechanismus.
  //
  // Jetzt ein gleitender Wert. Der Faktor ist AUSGEMESSEN, nicht geraten -
  // je 40 Spielminuten Betrieb und 40 Minuten Stillstand, Spitzen- und
  // Mittelwert der Pflasterung ueber alle Wege:
  //
  //   Zerfall  Halbwert   nach 40 min Betrieb   nach 40 min still
  //   1,000    nie        1,00 / 0,81           1,00   <- die alte Ratsche
  //   0,940     5,6 min   0,03 / 0,00           0,00   <- loescht auch aktive
  //   0,970    11,4 min   0,46 / 0,15           0,00
  //   0,985    22,9 min   1,00 / 0,49           0,19   <- gewaehlt
  //   0,993    49,3 min   1,00 / 0,71           1,00   <- verwittert nicht
  //
  // 0,985 haelt befahrene Wege im Betrieb voll gepflastert (Spitze 1,00),
  // laesst ruhige zurueckfallen (Mittel 0,49 statt 0,81) und laesst eine
  // aufgegebene Siedlung ueber eine Dreiviertelstunde verwittern.
  verkehrAbklingen(){
    for(const r of this.roads.values()){
      const t=r.traffic||0;
      if(t>0.01) r.traffic=t*VERKEHR_ZERFALL; else if(t) r.traffic=0;
    }
  }
  // Sicherheitsnetz gegen haengende Reservierungen. Reserviert wird eine Ware
  // nur zwischen "Traeger nimmt Auftrag an" und "Traeger hebt sie auf" - es
  // darf also keine reservierte Ware geben, zu der kein lebender Traegerauftrag
  // gehoert. Bleibt doch eine liegen, ist sie fuer alle anderen unsichtbar und
  // die Baustelle wartet ewig. Der Durchlauf raeumt das auf und repariert
  // damit auch Spielstaende, die den Fehler schon eingefroren haben.
  // Dasselbe Netz fuer die Karte: ein Baum/Steinhaufen traegt das
  // Reserviert-Bit (128), solange eine Figur zu ihm unterwegs ist. Stirbt die
  // Figur anders als ueber den Waechter - das Gebaeude brennt ab, das Gebiet
  // geht verloren - bleibt das Bit stehen und der Baum ist fuer JEDEN
  // Holzfaeller unsichtbar. Der Wald sieht dann voll aus und niemand faellt.
  entsperreVerwaisteZiele(){
    const m=this.map;
    let ziele=null;
    for(let i=0;i<m.obj.length;i++){
      if(!(m.obj[i]&128)) continue;
      if(ziele===null){
        ziele=new Set();
        for(const u of this.units)
          if(!u.dead && u.target>=0 && (u.type==='worker'||u.type==='geologe')) ziele.add(u.target);
      }
      if(!ziele.has(i)) m.obj[i]&=127;
    }
  }
  entsperreVerwaisteWaren(){
    let lebend=null;
    for(const it of this.flagItems.values()){
      for(const x of it){
        if(!x.reserved) continue;
        if(lebend===null){
          lebend=new Set();
          for(const r of this.roads.values())
            if(r.carrier && r.carrier.job && r.carrier.job.item) lebend.add(r.carrier.job.item);
        }
        if(!lebend.has(x)) x.reserved=false;
      }
    }
  }

  // ---------- Routen (Fahnengraph) ----------
  flagGraph(){
    if(this._fgVer===this.routeVer) return this._fg;
    const g=new Map();
    for(const r of this.roads.values()){
      const a=r.path[0], b=r.path[r.path.length-1];
      if(!g.has(a)) g.set(a,[]);
      if(!g.has(b)) g.set(b,[]);
      g.get(a).push({to:b, road:r.id, len:r.path.length});
      g.get(b).push({to:a, road:r.id, len:r.path.length});
    }
    this._fg=g; this._fgVer=this.routeVer; this._routeCache.clear();
    return g;
  }
  compOf(flag){
    if(this._compVer!==this.routeVer){
      this._comp=new Map(); this._compVer=this.routeVer;
      const g=this.flagGraph(); let c=0;
      for(const start of g.keys()){
        if(this._comp.has(start)) continue;
        const q=[start]; this._comp.set(start,c);
        while(q.length){ const cur=q.pop(); for(const e of g.get(cur)||[]) if(!this._comp.has(e.to)){ this._comp.set(e.to,c); q.push(e.to);} }
        c++;
      }
    }
    return this._comp.get(flag);
  }
  // nächste Straße von Fahne src Richtung Fahne dst (Dijkstra, gecacht)
  nextRoad(src, dst){
    if(src===dst) return null;
    const key=src+'>'+dst;
    if(this._routeCache.has(key)) return this._routeCache.get(key);
    const gph=this.flagGraph();
    const distm=new Map([[src,0]]), first=new Map(), open=new MinHeap();
    open.push(0,src);
    let res=null;
    while(open.size){
      const [d,cur]=open.pop();
      if(d>(distm.get(cur)??1e9)) continue;
      if(cur===dst){ res=first.get(cur)??null; break; }
      for(const e of gph.get(cur)||[]){
        const nd=d+e.len;
        if(nd < (distm.get(e.to)??1e9)){
          distm.set(e.to,nd);
          first.set(e.to, cur===src? e.road : first.get(cur));
          open.push(nd,e.to);
        }
      }
    }
    this._routeCache.set(key,res);
    return res;
  }
  flagDist(a,b){
    if(a===b) return 0;
    const gph=this.flagGraph();
    const distm=new Map([[a,0]]), open=new MinHeap(); open.push(0,a);
    while(open.size){
      const [d,cur]=open.pop();
      if(cur===b) return d;
      if(d>(distm.get(cur)??1e9)) continue;
      for(const e of gph.get(cur)||[]){
        const nd=d+e.len;
        if(nd<(distm.get(e.to)??1e9)){ distm.set(e.to,nd); open.push(nd,e.to); }
      }
    }
    return Infinity;
  }

  // ---------- Lager / Inventar ----------
  storesOf(pl){ return [...this.buildings.values()].filter(b=>b.player===pl && b.inv && b.state==='done'); }
  invTotal(pl){
    const t={};
    for(const b of this.buildings.values()){
      if(b.player!==pl) continue;
      if(b.inv) for(const k in b.inv) t[k]=(t[k]||0)+b.inv[k];
      if(b.out && b.state==='done'){ const g=this.prodGood(b); if(g) t[g]=(t[g]||0)+b.out; }
    }
    return t;
  }
  // Gesamtbestand je Spieler, kurz gecacht: die Bedarfsbremse fragt ihn für
  // jeden Erzeuger in jedem Takt ab – frisch gerechnet wäre das O(Gebäude²).
  invCached(pl){
    this._invC=this._invC||{}; this._invCt=this._invCt||{};
    if(this._invCt[pl]!==undefined && this.t-this._invCt[pl]<25) return this._invC[pl];
    this._invC[pl]=this.invTotal(pl); this._invCt[pl]=this.t;
    return this._invC[pl];
  }
  // Welches Gut bremst diesen Betrieb? Nur reine Erzeuger mit FESTEM Ausstoß:
  // Brunnen, Sägewerk, Steinmetz, Holzfäller, Bergwerke, Bäckerei, Brauerei ...
  // Schmieden (mehrere Ausstöße) wählen schon selbst nach Bedarf, Esel/Schiff
  // entstehen ohnehin nur auf Anforderung, der Förster erzeugt keine Ware.
  brakeGood(b){
    const def=BLD[b.type];
    if(def.prod){
      // R6: Betriebe mit MEHREREN moeglichen Ausgaben (Werkzeug- und
      // Waffenschmiede) fielen bisher komplett aus der Bedarfsbremse - sie
      // gab null zurueck. Genau deshalb lagen nach 20 Spielminuten 60
      // Haemmer, 37 Spitzhacken und 45 Schwerter im Lager. Jetzt bremst die
      // aktuell gewaehlte Ausgabe wie bei jedem anderen Betrieb auch.
      if(def.prod.outs) return b.chosenTool || null;
      const g=def.prod.out;
      return (g && g[0]!=='@') ? g : null;
    }
    if(def.mine) return def.mine;
    if(def.gather && def.out) return def.out;
    return null;
  }
  // Sanfte Bedarfsbremse (Kritikbericht F7: Wasser 256, Bretter 195 auf
  // Halde): lagert vom eigenen Gut sehr viel ungenutzt, ruht der Betrieb und
  // läuft bei Unterschreitung von selbst wieder an. Sichtbar im Gebäudemenü
  // ("Lager voll – ruht"), KEIN hartes Abschalten der Kette.
  satHold(b){
    const g=this.brakeGood(b);
    if(!g) return false;
    const tot=this.invCached(b.player)[g]||0;
    const stopp=SAT_OF[g]!==undefined? SAT_OF[g] : SAT_PAUSE;
    const start=SAT_OF[g]!==undefined? Math.round(SAT_OF[g]*0.75) : SAT_RESUME;
    if(b.satPause){ if(tot<=start) b.satPause=false; }
    else if(tot>=stopp) b.satPause=true;
    return b.satPause;
  }
  // verbleibendes Vorkommen im Umkreis eines Bergwerks
  oreLeft(b){
    const def=BLD[b.type];
    if(!def.mine) return null;
    const m=this.map;
    const targetT={coal:1, ironore:2, gold:3, stone:4}[def.mine];
    // derselbe Ring wie beim Fördern - die Anzeige darf nichts versprechen,
    // was das Bergwerk nicht erreicht
    let sum=0;
    for(const nn of [b.node, ...m.nbs(b.node)])
      if(m.oreT[nn]===targetT) sum+=m.oreA[nn];
    return sum;
  }
  prodGood(b){
    const def=BLD[b.type];
    if(def.out) return def.out;
    if(def.prod) return def.prod.outs ? def.prod.outs[(b.altOut||0)%def.prod.outs.length] : def.prod.out;
    if(def.mine) return def.mine;
    return null;
  }
  // Bevölkerungsübersicht: freie Siedler, Spezialisten und Soldaten je Typ
  settlerStats(pl){
    const st={ free:0, carrier:0, geo:0, scout:0, builder:0, worker:0,
      sword:0, spear:0, bow:0, total:0 };
    for(const r of this.roads.values()) if(r.player===pl) st.carrier++;
    for(const u of this.units){
      if(u.player!==pl) continue;
      if(u.type==='geo') st.geo++;
      else if(u.type==='scout') st.scout++;
      else if(u.type==='builder'||u.type==='leveler') st.builder++;
      else if(u.type==='worker'||u.type==='settle'||u.type==='flee') st.worker++;
      else if(u.type==='soldierMove') st[u.stype]=(st[u.stype]||0)+1;
      else if(u.type==='attack') for(const t of u.soldiers) st[t]=(st[t]||0)+1;
    }
    // eingezogene Fachkräfte in den Gebäuden
    for(const b of this.buildings.values()){
      if(b.player!==pl) continue;
      if(b.worker && b.worker.present) st.worker++;
      if(b.soldiers) for(const t of b.soldiers) st[t]=(st[t]||0)+1;
    }
    const r=this.players[pl].recruits||{};
    for(const t of STYPE_LIST) st[t]=(st[t]||0)+(r[t]||0);
    st.free=st.carrier+st.worker+st.builder;
    st.total=st.free+st.geo+st.scout+st.sword+st.spear+st.bow;
    return st;
  }
  recruitTotal(pl){
    const r=this.players[pl].recruits;
    return (r.sword|0)+(r.spear|0)+(r.bow|0);
  }
  // stärksten verfügbaren Typ aus der HQ-Reserve nehmen (für Miliz/Verteilung)
  takeRecruit(pl){
    const r=this.players[pl].recruits;
    for(const t of STYPE_LIST) if(r[t]>0){ r[t]--; return t; }
    return null;
  }
  soldierCount(pl){
    let n=0;
    for(const b of this.buildings.values()) if(b.player===pl && b.soldiers) n+=b.soldiers.length;
    for(const u of this.units) if(u.player===pl && u.type==='attack') n+=u.soldiers.length;
    return n + this.recruitTotal(pl);
  }

  // ---------- Territorium ----------
  recalcTerritory(){
    // Gebietsstand mitzaehlen: netzErreichbar() haengt an m.owner, sein
    // Zwischenspeicher kannte aber nur Wege- und Bauzustand. Nach einer
    // Grenzverschiebung blieb die Maske deshalb stehen - und weil ohne neue
    // Bauplaetze weder Weg noch Gebaeude dazukommen, taute sie nie wieder auf.
    this.gebietVer=(this.gebietVer||0)+1;
    const m=this.map; const n=m.w*m.h;
    const best=new Float32Array(n).fill(1e9);
    m.owner.fill(-1);
    for(const b of this.buildings.values()){
      const def=BLD[b.type];
      // Ein Militärgebäude verschiebt die Grenze erst, wenn mindestens einmal
      // ein Soldat eingezogen ist (besetztWar). Das Merkmal bleibt gesetzt,
      // auch wenn im Kampf kurz alle Verteidiger fallen – sonst flackerte die
      // Grenze mitten im Gefecht. Das Hauptquartier zählt immer.
      // Sicherheitsnetz: wer JETZT Besatzung hat, war offensichtlich besetzt
      // (fängt auch Pfade ab, die Soldaten direkt einsetzen, z.B. Tests).
      if(def.mil && b.state==='done' && !b.besetztWar && b.soldiers && b.soldiers.length) b.besetztWar=true;
      const milR = (b.type==='hq') ? def.mil.radius
        : (def.mil && b.state==='done' && b.besetztWar ? def.mil.radius : 0);
      if(!milR) continue;
      // BFS bis Radius
      const seen=new Map([[b.node,0]]); let q=[b.node];
      if(0<best[b.node]){ best[b.node]=0; m.owner[b.node]=b.player; }
      for(let d=1; d<=milR; d++){
        const nq=[];
        for(const i of q) for(const nb of m.nbs(i)){
          if(seen.has(nb)) continue; seen.set(nb,d); nq.push(nb);
          if(d<best[nb]){ best[nb]=d; m.owner[nb]=b.player; }
        }
        q=nq;
      }
    }
    // Straßen/Fahnen/Gebäude, die außerhalb geraten -> abreißen
    for(const [id,r] of [...this.roads]){
      if(r.path.some(i=>m.owner[i]!==r.player)) this.removeRoad(id);
    }
    for(let i=0;i<n;i++){
      if(m.flag[i]){
        let keep = m.owner[i]>=0;
        if(keep){
          // Fahne muss dem Gebietseigner gehören: prüfe über angrenzende Gebäude oder Straßen? Fahnen sind neutral markiert; einfach: fremdes Gebiet -> weg
          const bId=m.bld[i];
          keep = true;
        }
        if(m.owner[i]<0){ m.flag[i]=0; this.leereFahne(i); this.changedNodes.push(i); }
      }
    }
    for(const b of [...this.buildings.values()]){
      if(b.type!=='hq' && m.owner[b.node]!==b.player && !BLD[b.type].mil){
        this.burnBuilding(b);
      }
    }
    this.territoryVer++;
    this.exploreAll(0);
  }
  exploreAll(pl){
    const m=this.map;
    for(let i=0;i<m.owner.length;i++) if(m.owner[i]===pl) this.exploreAround(i,4);
  }
  exploreAround(i, r){
    const m=this.map;
    const x0=m.X(i), y0=m.Y(i);
    for(let y=Math.max(0,y0-r); y<=Math.min(m.h-1,y0+r); y++)
      for(let x=Math.max(0,x0-r); x<=Math.min(m.w-1,x0+r); x++){
        const dx=x-x0, dy=y-y0;
        if(dx*dx+dy*dy<=r*r+2) m.explored[m.idx(x,y)]=1;
      }
  }

  // ---------- Geologe ----------
  // eine Ware aus einem Lager des Spielers entnehmen (für Werkzeuge)
  takeGood(pl, good){
    for(const b of this.buildings.values()){
      if(b.player!==pl || !b.inv || b.state!=='done') continue;
      if((b.inv[good]||0)>0){ b.inv[good]--; return true; }
    }
    return false;
  }
  callGeologist(pl, flagNode){
    if(!this.map.flag[flagNode]) return 'noflag';
    const near=this.nodesInRange(flagNode,8).some(n=>this.map.terr[n]===TER.MOUNT
      && (this.map.obj[n]&127)!==OBJ.ROCK && !this.signs.has(n));
    if(!near) return 'nomount';
    if(!this.takeGood(pl,'pick')) return 'nopick';   // Geologe braucht eine Spitzhacke
    const hq=this.buildings.get(this.players[pl].hq);
    this.units.push({ id:NEXT_ID++, type:'geo', player:pl,
      ...this.tuerAustritt(hq||{node:flagNode}),     // aus der HQ-Tür treten
      flag:flagNode, probes:7, state:'toFlag', target:-1, actT:0 });
    return true;
  }
  tickGeo(u){
    const m=this.map;
    if(u.state==='toFlag'){
      const [tx,ty]=m.worldPos(u.flag);
      if(this.moveToward(u,tx,ty,WALK_SPEED)) u.state='seek';
    } else if(u.state==='seek'){
      let best=-1;
      for(const n of this.nodesInRange(u.flag,8)){
        // nicht in eine Felsformation hinein: der Geologe kaeme nicht hin
        // und sein Schild staende mitten im Block
        if(m.terr[n]!==TER.MOUNT || this.signs.has(n) || m.bld[n]>=0) continue;
        if((m.obj[n]&127)===OBJ.ROCK) continue;
        best=n; break;
      }
      if(best<0 || u.probes<=0){ u.state='home'; return; }
      u.target=best; u.state='walk';
    } else if(u.state==='walk'){
      const [tx,ty]=m.worldPos(u.target);
      if(this.moveToward(u,tx,ty,WALK_SPEED)){ u.state='probe'; u.actT=0; }
    } else if(u.state==='probe'){
      u.actT++;
      if(u.actT%11===1 && u.player===0) this.onGeoProbe && this.onGeoProbe(u);
      if(u.actT>=44){
        const ore=m.oreT[u.target]||0;
        this.signs.set(u.target, ore);
        u.probes--;
        if(ore) this.onGeoFind && this.onGeoFind(u);   // Jubelruf des Geologen
        if(u.player===0 && ore){
          const name=['','Kohle','Eisenerz','Golderz','Granit'][ore];
          // Kritik R2 S3: je Fund eine Meldung ergab 5 gleiche Meldungen
          // in 90 s auf demselben Feld. Je Erzart hoechstens alle 600
          // Takte - weitere Funde derselben Art sind dasselbe Feld.
          this._geoMsgT=this._geoMsgT||{};
          if(this.t-(this._geoMsgT[ore]??-1e9)>600){
            this._geoMsgT[ore]=this.t;
            this.msg(`Geologe: ${name} gefunden!`, 'ok', u.target, 0, 'erz');
          }
        }
        u.state='seek';
      }
    } else if(u.state==='home'){
      const hq=this.buildings.get(this.players[u.player].hq);
      const [tx,ty]=hq? this.tuerPos(hq):[u.x,u.y];  // heim durch die HQ-Tür
      if(this.moveToward(u,tx,ty,WALK_SPEED)){
        u.dead=true;
        // Wie der Planierer seine Schaufel bringt der Geologe seine
        // Spitzhacke zurück ins Lager. Vorher VERBRAUCHTE jeder Einsatz die
        // Hacke – zusammen mit dem Kreislauf Eisenbergwerk braucht Hacke ->
        // Werkzeugschmiede braucht Eisen -> Eisen braucht Eisenbergwerk
        // konnte das die Partie unheilbar festfahren (Spitzhacken-
        // Todesspirale aus dem Kritikbericht, Seed 42/run3).
        if(hq && hq.inv) hq.inv.pick=(hq.inv.pick||0)+1;
      }
    }
  }

  // ---------- Angriff ----------
  // Einflussradius eines Gebäudes für die Angriffs-Reichweite (HQ zählt wie
  // ein Militärgebäude, alles andere ohne mil-Eintrag wie eine Baracke).
  milRadius(b){
    const def=BLD[b.type];
    return def && def.mil ? def.mil.radius : 8;
  }
  // Angriffsquellen: eigene fertige Militärgebäude, deren Einfluss bis zum
  // Ziel reicht. Die Reichweite rechnet den Einflussradius des ZIELS mit:
  // zwei Grenzposten stehen bis zu (r_eigen + r_fremd) auseinander, wenn
  // ihre Gebiete sich berühren. Mit der alten festen Marschzugabe (+5) war
  // ein FERTIGER feindlicher Posten deshalb praktisch nie erreichbar – nur
  // grenznahe Baustellen. Ergebnis war das Militär-Patt aus dem
  // Kritikbericht (25 zerstörte Baustellen, 0 Eroberungen, kein Spielende).
  // Jetzt gilt wie im Vorbild Siedler 2: Posten direkt hinter der Grenze
  // sind angreifbar, jede Eroberung verschiebt die Grenze und bringt den
  // nächsten Posten in Reichweite – bis am Schluss das Hauptquartier fällt.
  atkSources(pl, target){
    const out=[];
    const tR=this.milRadius(target);
    for(const mb of this.buildings.values()){
      if(mb.player!==pl || !mb.soldiers || mb.state!=='done') continue;
      const reach=this.milRadius(mb)+tR+2;   // +2: kurzer Marsch über die Grenze
      const d=Math.hypot(this.map.X(mb.node)-this.map.X(target.node), this.map.Y(mb.node)-this.map.Y(target.node));
      if(d<=reach) out.push({mb, d});
    }
    return out;
  }
  attackable(pl, bldId){
    const b=this.buildings.get(bldId);
    if(!b || b.player===pl) return 0;
    if(!(BLD[b.type].mil || b.type==='hq')) return 0;
    // Kein Angriff ins Schwarze: der menschliche Spieler bekommt nur ERKUNDETE
    // Feindgebäude als Ziel angeboten – das Angriffs-Sheet schwebte sonst vor
    // unaufgeklärtem Dunkel (Kritikbericht F8). Der Nebel wird nur für
    // Spieler 0 geführt, die KI bleibt unberührt.
    if(pl===0 && !this.map.explored[b.node]) return 0;
    let avail=0;
    for(const {mb} of this.atkSources(pl,b)) avail += Math.max(0, mb.soldiers.length-1);
    return avail;
  }
  // Sammel-Angriff: Der Befehl zieht Soldaten aus MEHREREN Quartieren in
  // Reichweite zusammen (jedes behält einen Mann Restbesatzung). Jedes
  // beteiligte Quartier schickt sein Kontingent als eigene Marschgruppe zu
  // einem Sammelpunkt kurz vor dem Ziel; dort warten alle aufeinander und
  // schlagen GEMEINSAM zu. Vorher erschien die ganze Truppe am nächsten
  // Quartier – praktisch stellte immer nur ein Posten die Angreifer, und
  // Angriffe blieben 2-Mann-Tröpfeln (Kritikbericht, Top-4).
  attack(pl, bldId, count){
    const target=this.buildings.get(bldId);
    if(!target || target.player===pl) return false;
    const m=this.map;
    const [tx,ty]=m.worldPos(target.node);
    const sources=this.atkSources(pl, target);
    sources.sort((a,b)=>a.d-b.d);
    const parts=[]; let total=0;
    for(const {mb} of sources){
      if(total>=count) break;
      if(mb.soldiers.length<=1) continue;
      // Quartiere ohne Landweg zum Ziel stellen keine Angreifer: ihre
      // Soldaten tanzten sonst ewig am Wasserarm auf der Stelle.
      const [bx,by]=this.tuerPos(mb);
      if(!this.landDetour({x:bx,y:by}, tx, ty, 8000)) continue;
      const grp=[];
      while(total<count && mb.soldiers.length>1){
        mb.soldiers.sort((a,b)=>STYPES[b].str-STYPES[a].str);
        grp.push(mb.soldiers.shift()); total++;   // stärkste zuerst
      }
      if(grp.length) parts.push({mb, grp});
    }
    if(!total) return false;
    // Sammelpunkt: per Land-BFS VOM ZIEL aus ein paar Knoten in Richtung der
    // anmarschierenden Quartiere. So liegt er garantiert landverbunden zum
    // Ziel und nie auf einer abgeschnittenen Sandbank jenseits eines
    // Wasserarms (dort wartete die Truppe sonst vergeblich).
    let cx=0, cy=0;
    for(const pt of parts){ const [x,y]=m.worldPos(pt.mb.node); cx+=x; cy+=y; }
    cx/=parts.length; cy/=parts.length;
    const dd=Math.hypot(cx-tx,cy-ty)||1;
    const dirx=(cx-tx)/dd, diry=(cy-ty)/dd;
    let rx=tx+dirx*MUSTER_DIST, ry=ty+diry*MUSTER_DIST;   // Rückfall: Luftlinie
    {
      const fest=(n)=> m.terr[n]!==TER.WATER && m.terr[n]!==TER.LAVA;
      const seen=new Set([target.node]);
      let q=[target.node], bestN=-1, bestS=-1e9;
      for(let ring=1; ring<=3 && q.length; ring++){
        const nq=[];
        for(const i of q) for(const n of m.nbs(i)){
          if(seen.has(n) || !fest(n)) continue;
          seen.add(n); nq.push(n);
          if(ring>=2){                       // äußere Ringe: bester Kandidat
            const [px,py]=m.worldPos(n);     // Richtung Anmarsch
            const s=(px-tx)*dirx+(py-ty)*diry + ring*8;
            if(s>bestS){ bestS=s; bestN=n; }
          }
        }
        q=nq;
      }
      if(bestN>=0) [rx,ry]=m.worldPos(bestN);
    }
    const gid=NEXT_ID++;
    for(const pt of parts){
      const u={ id:NEXT_ID++, type:'attack', player:pl, ...this.tuerAustritt(pt.mb),
        target: target.node, targetB: bldId, soldiers: pt.grp,
        state: parts.length>1 ? 'muster' : 'walk', grp:gid, rx, ry, musterT:this.t };
      // Marschroute über Land-Knoten vorausberechnen: die gierige Luftlinie
      // blieb an Buchten und Ufersäumen hängen (Tanz auf der Stelle, die
      // Truppe erreichte den Sammelpunkt nie) – Soldaten marschieren
      // geordnet über das Knotennetz.
      const [gx,gy]= u.state==='muster' ? [rx,ry] : [tx,ty];
      const det=this.landDetour(u, gx, gy, 8000);
      if(det && det.length){ u._det=det; u._detTx=gx; u._detTy=gy; }
      this.units.push(u);
    }
    // Spähwissen durch den Angriffsbefehl: ein kleiner Sichtkreis ums Ziel
    // lüftet den Nebel – das Kampfgeschehen spielt nicht mehr im Schwarzen (F8)
    if(pl===0) this.exploreAround(target.node, 4);
    if(target.player===0){
      // Kritik R2 S1: im offenen Schlagabtausch kam die Meldung im
      // Minutentakt. 45-s-Fenster; was darin untergeht, zaehlt der
      // naechste Durchlass als Sammelzusatz mit.
      const still9=this.t-(this._atkMsgT??-1e9);
      if(still9>450){
        const extra9=this._atkStumm||0;
        this.msg(extra9>0? `Wir werden angegriffen! (dazu ${extra9} weitere Angriffe)`
                         : 'Wir werden angegriffen!', 'war', target.node, 0, 'kampf');
        this._atkMsgT=this.t; this._atkStumm=0;
      } else this._atkStumm=(this._atkStumm||0)+1;
    }
    return true;
  }

  // ================= Haupt-Update =================
  update(ms, speed){
    if(this.over) return;
    this._acc=(this._acc||0)+ms*speed;
    let steps=0;
    while(this._acc>=TICK_MS && steps<30){
      this._acc-=TICK_MS; steps++;
      this.step();
    }
    // Kommt das Gerät nicht hinterher (Obergrenze erreicht), verfällt der
    // Rückstand – sonst schaukelte er sich bei hohem Tempo auf und die
    // Simulation fräße jeden Frame komplett auf (Eingabe/Ton blockiert).
    if(steps>=30 && this._acc>TICK_MS) this._acc=TICK_MS;
  }
  // Überblendungsanteil zwischen zwei Sim-Takten (0..1) für den Zeichner
  lerpA(){ return Math.max(0, Math.min(1, (this._acc||0)/TICK_MS)); }
  step(){
    this.t++;
    // Merken, wo jede Figur zu Beginn des Takts stand: der Zeichner blendet
    // zwischen altem und neuem Stand über. Ohne das springen alle Figuren im
    // Zehntelsekunden-Takt - bei gemächlichem Spieltempo besonders sichtbar.
    for(const u of this.units){ u._px=u.x; u._py=u.y; }
    for(const r of this.roads.values()) if(r.carrier) r.carrier._pp=r.carrier.pos;
    const m=this.map;
    if(this.t%20===0) this.dispatch();
    this.tickConstruction();
    this.tickProduction();
    this.tickCarriers();
    this.tickUnits();
    this.tickBattles();
    this.tickMilitary();
    if(this.t%25===11) this.tickBuilderSpawn();
    if(this.t%300===137) this.entsperreVerwaisteWaren();
    if(this.t%300===211) this.entsperreVerwaisteZiele();
    if(this.t%300===57) this.verkehrAbklingen();
    if(this.t%100===61) this.checkMatWait();
    this.tickRuins();
    if(this.t%2===0) this.tickAnimals();
    if(this.t%10===0) this.tickGrowth();
    if(this.t%Game.FELD_TAKT===0) this.felderReifen();
    if(this.t%10===3) this.tickAI();
    if(this.t%20===7) this.checkObjectives();
    if(this.t%300===23) this.statistikTakt();
    if(this.t%300===41) this.notzimmerei();
    if(this.t%300===83) this.notschmiede();
    if(this.t%300===167) this.wegeTeilen();
    if(this.t%300===97) this.schilderVerfall();
  }

  // ---------- Schilder-Verfall (KD5/G8) ----------
  // "Kein Vorkommen"-Schilder (∅) verfallen nach 3 Spielminuten: nach einer
  // halben Stunde standen sonst >10 davon dicht gestreut auf jedem Berg -
  // visuelles Rauschen ohne Informationswert (Kritikbericht). Schilder MIT
  // Vorkommen bleiben stehen, die Information ist dauerhaft nuetzlich.
  // Die Alterstabelle ist bewusst fluechtig (nicht im Spielstand): nach dem
  // Laden zaehlen alte ∅-Schilder einfach ab dem Ladezeitpunkt neu.
  schilderVerfall(){
    if(!this.signs || !this.signs.size) return;
    this._signT=this._signT||new Map();
    for(const [q,ore] of this.signs){
      if(ore){ this._signT.delete(q); continue; }
      const seit=this._signT.get(q);
      if(seit===undefined) this._signT.set(q, this.t);
      else if(this.t-seit>1800) this.signs.delete(q);
    }
    for(const q of [...this._signT.keys()]) if(!this.signs.has(q)) this._signT.delete(q);
  }

  // ---------- Notzimmerei (R1) ----------
  // Zweite Haelfte der Rueckfallebene fuer Holz. Der Wildwuchs sorgt dafuer,
  // dass wieder Baeume da sind - aber um einen Holzfaeller (2 Bretter) und
  // ein Saegewerk (2 Bretter, 2 Steine) zu bauen, braucht man BRETTER. Wer
  // bei null steht, kaeme nie wieder heraus: jedes einzelne der 34 baubaren
  // Haeuser kostet Bretter.
  // Steht ein Spieler wirklich bei null, schnitzen die Siedler im
  // Hauptquartier per Hand ein Brett - eins alle 900 Takte, also gut anderthalb
  // Minuten bei einfachem Tempo. Die sechs Bretter fuer Holzfaeller, Foerster
  // und Saegewerk dauern damit rund neun Minuten: ein empfindlicher
  // Rueckschlag, aber kein Spielende. Ein vorhandener Stamm wird dabei
  // aufgebraucht; ohne Stamm geht es langsam auch ohne.
  notzimmerei(){
    for(let p=0;p<this.players.length;p++){
      const pl=this.players[p];
      if(pl.defeated) continue;
      const hq=this.buildings.get(pl.hq);
      if(!hq || hq.state!=='done' || !hq.inv) continue;
      // Bis zu acht Bretter - genau so viel, wie Holzfaeller (2), Foerster (2),
      // Saegewerk (2) und Steinbruch (2) zusammen kosten. Wer ein fertiges
      // Saegewerk hat, schnitzt nicht: dann laeuft die Wirtschaft wieder.
      // Erste Fassung stoppte schon bei EINEM Brett - der Spieler blieb damit
      // fuer immer bei eins stehen, und das billigste Haus kostet zwei.
      const inv=this.invTotal(p);
      const saege=[...this.buildings.values()].some(x=>
        x.player===p && x.type==='sawmill' && x.state==='done');
      if(saege || (inv.board||0)>=8){ pl._notzT=0; pl._notzMsg=false; continue; }
      pl._notzT=(pl._notzT||0)+300;
      if(pl._notzT<600) continue;
      pl._notzT=0;
      if((hq.inv.trunk||0)>0) hq.inv.trunk--;
      hq.inv.board=(hq.inv.board||0)+1;
      if(p===0 && !pl._notzMsg){
        pl._notzMsg=true;
        this.msg('Keine Bretter mehr! Im Hauptquartier werden Notbretter geschnitzt – '
                +'bau schnell Holzfäller, Förster und Sägewerk.', 'warn', hq.node, 0, 'wirtschaft');
      }
    }
  }

  // WEGTEILUNG (v203): lange Strassen bekommen eine Fahne in der Mitte.
  //
  // Zwischen je zwei Fahnen laeuft GENAU EIN Traeger. Eine Strasse ueber
  // zwoelf Knoten hat also denselben einen Traeger wie eine ueber drei - sie
  // ist nur viermal so lang. Genau das ist in Die Siedler II die
  // Standardantwort auf einen Warenstau: mehr Fahnen setzen, dann stehen
  // mehr Traeger auf der Strecke. Die KI hat das nie getan; ihre Wege ins
  // Gebirge waren die laengsten der Karte, und dort blieben Erz und Kohle
  // liegen.
  //
  // Geteilt wird nur bei KI-Spielern. Beim Menschen waere eine Fahne, die
  // von selbst in seiner Strasse auftaucht, eine Ueberraschung - er hat den
  // Knopf dafuer selbst.
  static WEG_TEILUNG=7;      // ab dieser Knotenzahl wird geteilt
  wegeTeilen(){
    for(const pl of this.players){
      if(pl.defeated || !pl.ai) continue;
      for(const r of [...this.roads.values()]){
        if(r.player!==pl.id || r.isSea) continue;
        if(r.path.length < Game.WEG_TEILUNG) continue;
        // Mitte nehmen: beide Haelften werden dadurch etwa gleich lang
        const mitte=r.path[Math.floor(r.path.length/2)];
        if(mitte==null || this.map.flag[mitte]) continue;
        if(this.map.bld[mitte]>=0) continue;
        this.addFlag(mitte);   // teilt die Strasse an dieser Stelle
        return;                // eine Teilung je Aufruf genuegt
      }
    }
  }

  // NOTSCHMIEDE: das Gegenstueck zur Notzimmerei, fuer Werkzeug.
  //
  // GEMESSENER SPIELSTOPPER. Der Foerster bindet dauerhaft eine SCHAUFEL
  // (TOOL_OF), die Startkiste enthaelt genau zwei. Stehen zwei Foerster,
  // ist keine Schaufel mehr im Land - und ohne Schaufel planiert kein
  // Planierer mehr einen Bauplatz. Ohne planierten Platz wird nichts mehr
  // fertig, also auch keine Werkzeugschmiede, die neue Schaufeln macht.
  // Das ist kein Engpass, das ist eine Sackgasse ohne Ausgang.
  //
  // Gemessen (Saat 42, Stufe 2, ohne KI-Materialhilfe): ab Spielminute 10
  // steht die Siedlung fuer immer. Bei Minute 40 lagen 60 Bretter, 73
  // Steine und 61 Staemme im Lager, sechs Baustellen hatten Material UND
  // Bauarbeiter - und alle sechs standen bei Fortschritt 0, weil keine
  // einzige planiert war. Zwei Schaufeln steckten in zwei Foerstern, die
  // sechs Haemmer in sechs Bauarbeitern, die auf unplanierten Plaetzen
  // warteten. In 60 Minuten entstand kein Getreide, kein Erz, kein Bier
  // und keine Waffe. Nur die KI kam davon, weil ihre Materialhilfe
  // Schaufeln nachlegt - ein Mensch bekommt diese Hilfe nicht.
  //
  // Gegenmittel wie bei den Notbrettern: fehlt ein GRUNDWERKZEUG restlos
  // und gibt es keine Werkzeugschmiede, die es machen koennte, fertigt das
  // Hauptquartier von Hand eines an - langsam genug, dass es ein
  // schmerzhafter Rueckschlag bleibt, aber die Partie geht weiter.
  // Abgedeckt sind die Werkzeuge, an denen die GRUNDVERSORGUNG haengt:
  // Schaufel (planieren), Hammer (bauen), Spitzhacke (Stein und Erz), Axt
  // (Holz), Saege (Bretter), Sense (Getreide). Geht eines davon restlos aus,
  // steht die ganze Kette. Angel, Beil und Bogen fehlen bewusst - Fischer,
  // Schlachter und Jaeger sind Wahlberufe, kein Nadeloehr.
  // Der erste Messlauf deckte nur Schaufel, Hammer und Spitzhacke ab; danach
  // meldete der Holzfaeller zehnmal "wartet auf Werkzeug (Axt)" - derselbe
  // Riegel eine Tuer weiter.
  static NOTWERKZEUG=['shovel','hammer','pick','axe','saw','scythe'];
  notschmiede(){
    for(let p=0;p<this.players.length;p++){
      const pl=this.players[p];
      if(pl.defeated) continue;
      const hq=this.buildings.get(pl.hq);
      if(!hq || hq.state!=='done' || !hq.inv) continue;
      const inv=this.invTotal(p);
      // Eine Werkzeugschmiede macht die Nothilfe nur ueberfluessig, wenn sie
      // auch ARBEITEN kann - und dafuer braucht sie Eisen.
      //
      // ZWEITE SACKGASSE, gemessen auf Saat 7 (60 Spielminuten, ohne
      // Materialhilfe): drei fertige Eisenbergwerke, angeschlossen, nicht
      // erschoepft, mit 156, 241 und 44 Einheiten Erz im Foerderring - und
      // alle drei UNBESETZT UND OHNE SPITZHACKE. Die Spitzhacke braucht
      // jedes Bergwerk und zusaetzlich der Steinmetz; die Startkiste hat
      // vier. Drei Steinmetze und vier Kohlebergwerke hatten sie
      // aufgebraucht.
      //
      // Die Notschmiede haette Spitzhacken gemacht - aber sie schaltet sich
      // ab, sobald eine Werkzeugschmiede EXISTIERT. Auf Saat 7 stand eine,
      // die ohne Eisen nichts schmieden konnte, und Eisen gab es nicht, weil
      // dem Eisenbergwerk die Spitzhacke fehlte. Dieselbe Falle wie bei der
      // Schaufel in v200, nur eine Tuer weiter: ich hatte sie damals nur
      // fuer den Fall "gar keine Werkzeugschmiede" geschlossen.
      const schmiede=[...this.buildings.values()].some(x=>
        x.player===p && x.type==='toolsmith' && x.state==='done'
        && ((inv.iron||0)>0 || (x.stock.iron||0)>0 || (x.incoming.iron||0)>0));
      if(schmiede){ pl._notwT=0; pl._notwMsg=false; continue; }
      // Was fehlt restlos? toolTrulyMissing zaehlt auch Werkzeug mit, das
      // gerade unterwegs ist - sonst schmiedet das HQ, waehrend ein
      // Planierer mit der Schaufel nur noch heimlaeuft.
      const fehlt=Game.NOTWERKZEUG.find(t=>
        (inv[t]||0)===0 && this.toolTrulyMissing(p, t));
      if(!fehlt){ pl._notwT=0; pl._notwMsg=false; continue; }
      pl._notwT=(pl._notwT||0)+300;
      if(pl._notwT<1800) continue;        // rund drei Spielminuten je Stueck
      pl._notwT=0;
      hq.inv[fehlt]=(hq.inv[fehlt]||0)+1;
      if(p===0){
        const N={shovel:['Keine Schaufel','eine neue'], hammer:['Kein Hammer','einer'],
                 pick:['Keine Spitzhacke','eine neue'], axe:['Keine Axt','eine neue'],
                 saw:['Keine Säge','eine neue'], scythe:['Keine Sense','eine neue']}[fehlt];
        this.msg(`${N[0]} mehr im Land! Im Hauptquartier wird von Hand ${N[1]} `
          +`gefertigt – bau eine Werkzeugschmiede.`, 'warn', hq.node, 0, 'warnung');
      }
    }
  }

  // ---------- Statistik (H3) ----------
  // Ohne Zahlenwerk sieht man nie, ob die Siedlung waechst oder nur
  // beschaeftigt ist - und schon gar nicht, wie man gegen die Gegner steht.
  // Alle 300 Takte (30 Sekunden Spielzeit bei 1x) wird je Spieler ein
  // Datensatz abgelegt. 240 Stueck decken zwei Stunden ab; danach faellt der
  // aelteste heraus. Der Aufwand ist ein Durchlauf ueber owner (rund 9000
  // Knoten) und je Spieler ein invTotal - alle 30 Sekunden vernachlaessigbar.
  statistikTakt(){
    const np=this.players.length;
    if(!this.stats || this.stats.spieler.length!==np)
      this.stats={ t:[], spieler:Array.from({length:np},()=>(
        {land:[], bauten:[], siedler:[], soldaten:[], waren:[]})) };
    const s=this.stats;
    const land=new Array(np).fill(0);
    for(let i=0;i<this.map.owner.length;i++){ const o=this.map.owner[i]; if(o>=0) land[o]++; }
    const bauten=new Array(np).fill(0), soldaten=new Array(np).fill(0),
          siedler=new Array(np).fill(0);
    for(const b of this.buildings.values()){
      if(b.player<0 || b.player>=np) continue;
      if(b.state==='done'||b.state==='build') bauten[b.player]++;
      if(b.soldiers) soldaten[b.player]+=b.soldiers.length;
    }
    for(const u of this.units){
      if(u.dead || u.player<0 || u.player>=np) continue;
      siedler[u.player]++;
      if(u.type==='attack' && u.soldiers) soldaten[u.player]+=u.soldiers.length;
      else if(u.type==='soldierMove') soldaten[u.player]++;
    }
    for(let p=0;p<np;p++){
      const r=this.players[p].recruits||{};
      soldaten[p]+=(r.sword||0)+(r.spear||0)+(r.bow||0);
    }
    s.t.push(this.t);
    for(let p=0;p<np;p++){
      const inv=this.invTotal(p);
      let w=0; for(const k in inv) w+=inv[k];
      const sp=s.spieler[p];
      sp.land.push(land[p]); sp.bauten.push(bauten[p]);
      sp.siedler.push(siedler[p]); sp.soldaten.push(soldaten[p]); sp.waren.push(w);
    }
    if(s.t.length>240){
      s.t.shift();
      for(const sp of s.spieler){ sp.land.shift(); sp.bauten.shift();
        sp.siedler.shift(); sp.soldaten.shift(); sp.waren.shift(); }
    }
  }

  // ---------- Wachstum (Bäume, Felder) ----------
  tickGrowth(){
    const m=this.map;
    // Stichprobe wächst mit der Karte mit: fest 200 Knoten je Aufruf hieß,
    // dass Bäume/Felder/Fische auf Karte L fast dreimal so langsam
    // nachwuchsen wie auf Karte S (jeder Knoten kam seltener an die Reihe).
    // Auf Karte S bleibt es bei ~200 – die Taktkosten ändern sich kaum.
    const K=Math.max(200, Math.round(m.terr.length/46));
    for(let k=0;k<K;k++){
      const i=(this.rng()*m.terr.length)|0;
      const o=m.obj[i];
      // Bäume reifen zügig: mit den alten Raten brauchte ein Setzling ~9
      // Spielminuten bis zum fällbaren Baum – der Förster konnte die
      // Abholzung nie ausgleichen (Kritikbericht, Spielspaß-Bremse 1).
      // R1: WILDWUCHS AM WALDRAND. Nachgemessen war Holz ein einziger Strang
      // ohne jede Rueckfallebene: alle 34 baubaren Haeuser kosten Bretter,
      // Bretter kommen nur aus dem Saegewerk, Staemme nur vom Holzfaeller,
      // Baeume nur vom Foerster. Reisst der Strang irgendwo, ist das Spiel
      // vorbei - und zwar lautlos. Ein Waldrand breitet sich jetzt von selbst
      // aus: ein freier Wiesenknoten mit mindestens ZWEI Baumnachbarn wird
      // mit kleiner Wahrscheinlichkeit zum Setzling. Das ist deutlich
      // langsamer als ein Foerster (der setzt zwei Setzlinge je Gang) und
      // nimmt ihm die Aufgabe nicht ab - es sorgt nur dafuer, dass der Wald
      // nicht endgueltig verschwindet, solange irgendwo noch Baeume stehen.
      // Bedingungen wie beim Foerster, damit kein Setzling auf Weg, Fahne
      // oder Bauplatz waechst.
      if(o===OBJ.NONE && m.terr[i]===TER.GRASS && m.bld[i]<0 && !m.flag[i]
         && !this.roadAt(i) && this.rng()<0.012){
        let nb=0; for(const q of m.nbs(i)) if(Game.isTree(m.obj[q])) nb++;
        if(nb>=2){ m.obj[i]=OBJ.SAPLING; m.amt[i]=0; this.changedNodes.push(i); }
      }
      // Felder reifen NICHT mehr hier - sie haben seit v190 eine eigene Uhr
      // (felderReifen). Erklaerung dort.
      else if(m.terr[i]===TER.WATER){
        // Fischgründe erholen sich spürbar: ein Fischer an gutem Grund fängt
        // dauerhaft (wenn auch langsamer) weiter, statt nach ~10 Minuten für
        // immer zu verstummen. Leere Ufergewässer werden von Nachbarbeständen
        // wiederbesiedelt – und notfalls (alles leer) ganz langsam von selbst,
        // damit ein Grund nie ENDGÜLTIG tot ist.
        if(m.fish[i]>0 && m.fish[i]<8 && this.rng()<0.22) m.fish[i]++;
        else if(m.fish[i]===0 && m.nbs(i).some(n=>m.terr[n]!==TER.WATER)){
          const p=m.nbs(i).some(n=>m.fish[n]>=2) ? 0.10 : 0.03;
          if(this.rng()<p) m.fish[i]=1;
        }
      }
    }
    this.baeumeReifen(K);
  }

  // R11: SETZLINGE REIFEN NACH ALTER, NICHT NACH MUENZWURF.
  // Vorher entschied bei jeder Stichprobe ein Wurf, ob der Setzling eine
  // Stufe weiterkommt (35 bzw. 30 Prozent). Ein solcher Vorgang hat kein
  // Gedaechtnis: der Mittelwert stimmte zwar, aber die Spannweite war
  // sinnlos gross. Nachgemessen an 300 Setzlingen je Kartengroesse brauchte
  // der schnellste 0,2 Spielminuten bis zum faellbaren Baum, der langsamste
  // ueber 10 - und 25 von 300 standen nach zehn Minuten immer noch als
  // Setzling da, direkt neben Nachbarn, die laengst ausgewachsen waren. Fuer
  // den Spieler sieht das nicht nach Wachstum aus, sondern nach Willkuer.
  // Jetzt zaehlt jeder Baum sein Alter in m.amt mit (dort ungenutzt - das
  // Feld traegt sonst nur den Vorrat eines Felsbrockens) und wechselt die
  // Stufe bei einem festen Alter. Der Mittelwert bleibt, die Ausreisser
  // verschwinden.
  // Eigene Stichprobe, VIERFACH so dicht wie die allgemeine: nur so ist das
  // Alter fein genug aufgeloest. Die Feld- und Fischraten oben bleiben davon
  // unberuehrt - haetten wir dort einfach K erhoeht, waeren Getreide und
  // Fisch gleich mit viermal so schnell nachgewachsen.
  // ---------- Felder reifen nach eigener Uhr ----------
  // Nutzer-Report v190 ("die Farm erzeugt zu wenig Getreide"): das Korn wuchs
  // ueber dieselbe Zufallsstichprobe wie Baeume und Fischgruende - je Stichprobe
  // 25 % bzw. 20 % Aufstieg. Wie oft ein Feld drankommt, haengt damit an der
  // KARTENGROESSE (die Stichprobe verteilt sich auf alle Knoten). Gemessen auf
  // Karte M: 3377 Takte, also 5,6 Spielminuten je Feld. Drei Hoefe mit 24
  // Ackerpunkten lieferten so rund 2 Getreide je Minute - eine einzige Muehle
  // verbraucht 6,7. Folge: Getreidelager dauerhaft 0, Muehlen und Brauerei
  // hungerten, kein Bier, keine Rekruten, und ab Minute 21 wuchs gar nichts
  // mehr (41 Gebaeude, 130 Siedler, Stillstand bis Messende).
  // Jetzt zaehlt jeder Ackerknoten seine eigenen Schritte: gleiche Reifezeit
  // auf jeder Kartengroesse, und sie steht als Zahl da, statt sich aus drei
  // Wahrscheinlichkeiten zu ergeben.
  static FELD_TAKT=20;      // Takte zwischen zwei Wachstumsschritten
  static FELD_STUFE=22;     // Schritte je Stufe -> 2*22*20 = 880 Takte = 88 s
  felderReifen(){
    const m=this.map;
    if(!this.felder) this.felderSammeln();
    for(const i of this.felder){
      const o=m.obj[i]&127;
      if(o!==OBJ.FIELD0 && o!==OBJ.FIELD1){
        if(o!==OBJ.FIELD2) this.felder.delete(i);   // abgeerntet oder ueberbaut
        continue;
      }
      const alt=(m.amt[i]||0)+1;
      if(alt<Game.FELD_STUFE){ m.amt[i]=alt; continue; }
      m.amt[i]=0;
      m.obj[i]=(m.obj[i]&128) | (o===OBJ.FIELD0? OBJ.FIELD1 : OBJ.FIELD2);
      this.changedNodes.push(i);
    }
  }
  // Ackerknoten aus der Karte einsammeln - fuer Spielstaende, die noch ohne
  // die Feldliste gespeichert wurden
  felderSammeln(){
    const m=this.map;
    this.felder=new Set();
    for(let i=0;i<m.obj.length;i++){
      const o=m.obj[i]&127;
      if(o===OBJ.FIELD0||o===OBJ.FIELD1||o===OBJ.FIELD2) this.felder.add(i);
    }
  }
  baeumeReifen(K){
    const m=this.map;
    const REIF=BAUM_REIF;             // Stichproben je Wachstumsstufe
    const KB=K*4;
    for(let k=0;k<KB;k++){
      const i=(this.rng()*m.terr.length)|0;
      const o=m.obj[i]&127;
      if(o!==OBJ.SAPLING && o!==OBJ.TREE2) continue;
      const alt=(m.amt[i]||0)+1;
      if(alt<REIF){ m.amt[i]=alt; continue; }
      m.amt[i]=0;
      m.obj[i]=(m.obj[i]&128) | (o===OBJ.SAPLING? OBJ.TREE2 : OBJ.TREE);
      this.changedNodes.push(i);
    }
  }

  // ---------- Wild: Rehe, Hasen und Wildschweine streifen durch die Wälder ----------
  spawnAnimals(){
    const m=this.map, un=(o)=>o&127;
    const forest=[];
    for(let i=0;i<m.terr.length;i++) if(un(m.obj[i])===OBJ.TREE) forest.push(i);
    const target=clamp(Math.round(forest.length/9), 8, 46);
    let guard=target*30;
    while(this.animals.length<target && guard-->0){
      const node=forest[(this.rng()*forest.length)|0];
      // auf einem freien Nachbarknoten neben dem Baum absetzen
      const spot=[node,...m.nbs(node)].find(n=> m.bld[n]<0 && un(m.obj[n])!==OBJ.STONE
        && m.terr[n]!==TER.WATER && m.terr[n]!==TER.LAVA && m.terr[n]!==TER.MOUNT);
      if(spot===undefined) continue;
      const r=this.rng();
      const kind = r<0.45? 'deer' : r<0.8? 'hare' : 'boar';
      const [x,y]=m.worldPos(spot);
      this.animals.push({ id:NEXT_ID++, kind, home:node, node:spot, x, y, tx:x, ty:y,
        state:'graze', wait:(20+this.rng()*60)|0 });
    }
  }
  tickAnimals(){
    const m=this.map, un=(o)=>o&127;
    const SPD={deer:2.4, hare:3.2, boar:1.8};
    for(const a of this.animals){
      if(a.state==='walk'){
        const dx=a.tx-a.x, dy=a.ty-a.y, d=Math.hypot(dx,dy), sp=SPD[a.kind];
        if(d<=sp){ a.x=a.tx; a.y=a.ty; a.state='graze'; a.wait=(25+this.rng()*90)|0; a.node=m.nearestNode(a.x,a.y); }
        else { a.x+=dx/d*sp; a.y+=dy/d*sp; }
      } else if(--a.wait<=0){
        // Heimatbaum weg (abgeholzt)? -> neuen Wald in der Nähe suchen
        if(un(m.obj[a.home])!==OBJ.TREE){
          const near=this.nodesInRange(a.node,5).find(n=>un(m.obj[n])===OBJ.TREE);
          if(near!==undefined) a.home=near;
        }
        const [hx,hy]=m.worldPos(a.home);
        for(let k=0;k<6;k++){
          const nx=hx+(this.rng()-0.5)*170, ny=hy+(this.rng()-0.5)*130;
          const n=m.nearestNode(nx,ny);
          if(n>=0 && m.bld[n]<0 && un(m.obj[n])!==OBJ.STONE
             && m.terr[n]!==TER.WATER && m.terr[n]!==TER.LAVA && m.terr[n]!==TER.MOUNT){
            a.tx=nx; a.ty=ny; a.state='walk';
            break;
          }
        }
        a.wait=30;
      }
    }
    // verwaiste Jagd-Markierungen lösen (z.B. Jägerhütte zerstört)
    if(this.t%20===8){
      for(const a of this.animals){
        if(a.hunted && !this.units.some(u=>u.animalId===a.id)) a.hunted=false;
      }
    }
    // langsame Vermehrung in unbesiedelten Wäldern (Kartengröße begrenzt den Bestand)
    if(this.t%600===0 && this.animals.length){
      const cap=clamp(Math.round(m.terr.length/240), 10, 60);
      if(this.animals.length<cap){
        const a=this.animals[(this.rng()*this.animals.length)|0];
        const trees=this.nodesInRange(a.node,3).filter(n=>un(m.obj[n])===OBJ.TREE).length;
        if(trees>=3 && m.owner[a.node]<0 && this.rng()<0.5){
          this.animals.push({ id:NEXT_ID++, kind:a.kind, home:a.home, node:a.node,
            x:a.x+8, y:a.y+4, tx:a.x, ty:a.y, state:'graze', wait:(30+this.rng()*80)|0 });
        }
      }
    }
  }
  animalById(id){ return this.animals.find(a=>a.id===id); }

  // ---------- Logistik: Anfragen & Zuteilung ----------
  requestsOf(){
    const reqs=[]; // {b, good, prio}
    for(const b of this.buildings.values()){
      if(b.player<0) continue;
      const def=BLD[b.type];
      if(b.state==='build'){
        for(const g of ['board','stone']){
          const need=(def.cost[g]||0) - (b.stock[g]||0) - (b.incoming[g]||0);
          for(let k=0;k<need;k++) reqs.push({b, good:g, prio:0});
        }
      } else if(b.state==='done'){
        if(def.prod){
          for(const g in def.prod.inputs){
            const want=2*(def.prod.inputs[g]);
            const need=want-(b.stock[g]||0)-(b.incoming[g]||0);
            for(let k=0;k<need;k++) reqs.push({b, good:g, prio:1});
          }
        }
        if(def.foodBoost || b.foodPrio){
          let have=0; for(const f of FOODS) have+=(b.stock[f]||0)+(b.incoming[f]||0);
          if(have<2) reqs.push({b, good:'@food', prio:2});
        }
        if(def.mine){
          // Seit v194 ist Essen im Bergwerk kein Muss mehr, sondern Tempo.
          // Deshalb steht es auch in der Warteschlange nicht mehr vor dem
          // Baumaterial (Stufe 1), sondern gleichauf mit dem Essen der
          // uebrigen Betriebe (Stufe 2) - und nur noch einmal statt zweimal.
          let have=0; for(const f of FOODS) have+=(b.stock[f]||0)+(b.incoming[f]||0);
          if(have<2) reqs.push({b, good:'@food', prio:2});
        }
        if(def.cata){
          const need=2-(b.stock.stone||0)-(b.incoming.stone||0);
          for(let k=0;k<need;k++) reqs.push({b, good:'stone', prio:2});
        }
        if(def.mil && b.soldiers){
          // Münzen als Sold: bis zu 2 im Gebäude stärken die Verteidiger
          if(b.coins + (b.incoming.coin||0) < 2 && b.soldiers.length)
            reqs.push({b, good:'coin', prio:3});
        }
        if(b.type==='hq'){
          // Rekrutierungsgüter zieht das HQ aus eigenem Lager (kein Transport nötig)
        }
      }
    }
    return reqs;
  }
  // DER DECKEL ZAEHLT NUR EIGENE WAREN (v196).
  //
  // Auf einer Tuerfahne liegen dreierlei Posten: was das Haus selbst
  // hinausgestellt hat, was fuer das Haus angeliefert wurde - und
  // DURCHGANGSVERKEHR, der hier nur zwischengelegt wurde, weil die Fahne
  // auf einer fremden Route liegt. Bisher zaehlte der Deckel alles drei.
  // Gemessen war das der schwerste Bremsklotz der ganzen Logistik: ein
  // Saegewerk an einer stark befahrenen Fahne lieferte 0,45 statt 6,6
  // Bretter je Spielminute - nicht weil es voll war, sondern weil fremde
  // Ladung seinen eigenen Ausgang blockierte. Ein Haus soll aber nur an
  // dem gemessen werden, was ihm gehoert.
  //
  // Der Durchgangsverkehr bleibt nicht ungedeckelt: er faellt unter die
  // harte Obergrenze FLAG_CAP+4, ab der ein Traeger seine Ladung abwirft.
  eigeneAnFahne(b){
    const items=this.flagItems.get(b.door);
    if(!items || !items.length) return 0;
    let n=0;
    for(const it of items) if(it.srcB===b.id || it.destB===b.id) n++;
    return n;
  }
  findSource(pl, good, destFlag, comp){
    // Quellen: Produktionsausstoß (b.out) oder Lager (inv)
    let best=null, bd=1e9;
    let ersatz=null, ed=1e9;      // Lager mit voller Fahne, nur als Rückfall
    for(const b of this.buildings.values()){
      if(b.player!==pl || b.state!=='done') continue;
      let has=false, isStore=false;
      if(good==='@food'){
        if(b.inv && FOODS.some(f=>b.inv[f]>0)){ has=true; isStore=true; }
        else if(b.out>0 && FOODS.includes(this.prodGood(b))) has=true;
      } else {
        if(b.inv && (b.inv[good]||0)>0){ has=true; isStore=true; }
        else if(b.out>0 && this.prodGood(b)===good) has=true;
      }
      if(!has) continue;
      const f=b.door;
      if(this.compOf(f)===undefined || this.compOf(f)!==comp) continue;
      const items=this.flagItems.get(f);
      const eigene=this.eigeneAnFahne(b);
      // voll ist nur, wer mit EIGENER Ladung voll ist - oder wessen Fahne
      // insgesamt ueberlaeuft (dann wuerde der Traeger ohnehin abwerfen)
      if(eigene>=FLAG_CAP || (items && items.length>=FLAG_CAP+4)){
        // Eine volle Fahne bremst - aber sie darf die einzige Quelle der
        // Siedlung nicht STILLLEGEN. Gemessen (Saat 2024, 35 min): das HQ
        // ist in der Regel das einzige Lager; stand auf seiner Fahne die
        // Hoechstzahl, fand kein einziges Gebaeude mehr Nachschub - sieben
        // Baustellen standen mit leerem Lager, waehrend im HQ 8 Bretter und
        // 36 Steine lagen. Ein LAGER bleibt deshalb Ersatzquelle, bis die
        // Fahne wirklich ueberlaeuft (der Traeger wirft erst ab CAP+4 ab).
        if(isStore && eigene<FLAG_CAP+2){
          const d2=this.flagDist(f, destFlag);
          if(d2<ed){ ed=d2; ersatz=b; }
        }
        continue;
      }
      const d=this.flagDist(f, destFlag);
      if(d<bd){ bd=d; best=b; }
    }
    return best || ersatz;
  }
  dispatch(){
    const reqs=this.requestsOf();
    // Erst der Anlass (Baustelle vor Eingang vor Essen vor Sold), dann die
    // Rangfolge des Spielers. Bei @food entscheidet der Rang des besten
    // Nahrungsmittels - welches es am Ende wird, klaert erst die Quelle.
    const rang=(rq)=> rq.good==='@food'
      ? Math.min(...FOODS.map(f=>this.rangVon(rq.b.player, f)))
      : this.rangVon(rq.b.player, rq.good);
    reqs.sort((a,b)=> (a.prio-b.prio) || (rang(a)-rang(b)));
    // faires Budget je Spieler, damit KI-Baustellen den Menschen nicht verdrängen
    const budgets=this.players.map(()=>10);
    for(const rq of reqs){
      if(budgets[rq.b.player]<=0) continue;
      const destFlag=rq.b.door;
      const comp=this.compOf(destFlag);
      if(comp===undefined) continue;
      const src=this.findSource(rq.b.player, rq.good, destFlag, comp);
      if(!src) continue;
      let good=rq.good;
      if(good==='@food'){
        if(src.inv) good=FOODS.find(f=>src.inv[f]>0);
        else good=this.prodGood(src);
        if(!good) continue;
      }
      // abbuchen
      if(src.inv && (src.inv[good]||0)>0) src.inv[good]--;
      else if(src.out>0) src.out--;
      else continue;
      const items=this.flagItems.get(src.door) || [];
      items.push({good, destB:rq.b.id, srcB:src.id});
      this.flagItems.set(src.door, items);
      if(good==='coin') rq.b.incoming.coin=(rq.b.incoming.coin||0)+1;
      else rq.b.incoming[good]=(rq.b.incoming[good]||0)+1;
      budgets[rq.b.player]--;
    }
    // Überschuss der Produzenten ins Lager schicken (gedrosselt: erst ab 2 wartenden Waren,
    // und nur wenn die eigene Fahne nicht schon halb voll ist -> Straßen bleiben frei für Wichtiges)
    for(const b of this.buildings.values()){
      if(budgets[b.player]<=0) continue;
      if(b.state!=='done' || (b.out|0)<2 || b.inv) continue;
      // nur die EIGENE Ladung zaehlt (v196) - fremder Durchgangsverkehr auf
      // der Tuerfahne hat einem Saegewerk gemessen 0,45 statt 6,6 Bretter
      // je Spielminute eingebracht, weil dieser Riegel dauerhaft zu war
      if(this.eigeneAnFahne(b)>=4) continue;
      const g=this.prodGood(b); if(!g) continue;
      const comp=this.compOf(b.door); if(comp===undefined) continue;
      // gibt es offene Konsumenten? wenn nein -> Lager
      let store=null, bd=1e9;
      for(const s of this.buildings.values()){
        if(s.player!==b.player || !s.inv || s.state!=='done') continue;
        if(this.compOf(s.door)!==comp) continue;
        const d=this.flagDist(s.door,b.door);
        if(d<bd){ bd=d; store=s; }
      }
      if(!store) continue;
      const items=this.flagItems.get(b.door)||[];
      if(this.eigeneAnFahne(b)>=FLAG_CAP || items.length>=FLAG_CAP+4) continue;
      b.out--;
      items.push({good:g, destB:store.id, srcB:b.id});
      this.flagItems.set(b.door, items);
      store.incoming[g]=(store.incoming[g]||0)+1;
      budgets[b.player]--;
    }
  }
  deliver(b, good){
    if(b.incoming[good]) b.incoming[good]--;
    const def=BLD[b.type];
    if(good==='coin' && def.mil){ b.coins++; return; }
    if(b.state==='build'){ b.stock[good]=(b.stock[good]||0)+1; return; }
    if(b.inv){ b.inv[good]=(b.inv[good]||0)+1; return; }
    b.stock[good]=(b.stock[good]||0)+1;
  }

  // ---------- Träger ----------
  tickCarriers(){
    for(const r of this.roads.values()){
      const c=r.carrier;
      const lastIx=r.path.length-1;
      if(c.state==='idle'){
        // gibt es an einem Ende etwas für diese Straße? (Baustellen zuerst, Lagerware zuletzt)
        const pick=(endIx)=>{
          const f=r.path[endIx];
          const items=this.flagItems.get(f);
          if(!items || !items.length) return false;
          // ERST SEHEN, OB DIE WARE ANKOMMT - DANN AUFNEHMEN (v211).
          //
          // Der Traeger hat sich bisher blind verpflichtet: er nahm die Ware
          // auf, lief ans andere Ende und stellte dort fest, dass die Fahne
          // voll ist. Seit v201 wirft er sie nicht mehr weg, sondern wartet -
          // und blockiert damit seine ganze Strasse, auch fuer die
          // Gegenrichtung. Das ergibt einen Ringschluss: Fahne A wird nur
          // leer, wenn ihre Waren nach B koennen, B nur, wenn sie nach C
          // koennen, und C wartet auf A.
          //
          // GEMESSEN (Saat 11, 60 Spielminuten, ohne Materialhilfe): die
          // Zahl der Waren auf Fahnen waechst monoton von 22 auf 420 und
          // faellt nie; 28 von 42 Fahnen liegen bei genau zwoelf Stueck, der
          // Abwurfgrenze; 42 Traeger halten eine Ware und kommen sie nicht
          // los. In der ganzen Partie wurde KEIN EINZIGES Stueck Eisenerz
          // irgendwo zugestellt, obwohl sieben Bergwerke besetzt waren und
          // foerderten. Auch die Eisenhuette bekam in 28 Minuten kein Brett:
          // ein Lager mit voller Fahne faellt in findSource als Quelle aus,
          // also verhungern die Baustellen mitten im vollen Lager.
          //
          // Siedler 2 loest das an genau dieser Stelle: dort nimmt der
          // Traeger gar nicht erst auf, wenn die Zielfahne voll ist. Die Ware
          // bleibt liegen, der Traeger bleibt frei - und kann die
          // Gegenrichtung bedienen, die vielleicht Platz hat.
          //
          // Geprueft wird gegen FLAG_CAP (8), nicht gegen die Abwurfgrenze
          // (12): die vier Plaetze Luft nehmen die Waren auf, die schon
          // unterwegs sind. Waren fuer das Haus AN dieser Fahne sind
          // ausgenommen - die gehen durch die Tuer, nicht auf den Stapel.
          const zielF = r.path[endIx===0 ? lastIx : 0];
          const zielItems = this.flagItems.get(zielF);
          const zielVoll = !!zielItems && zielItems.length>=FLAG_CAP;
          let bestIt=null, bestPr=99, bestRang=1e9;
          for(let k=0;k<items.length;k++){
            const it=items[k];
            const dest=this.buildings.get(it.destB);
            if(!dest){ items.splice(k,1); k--; continue; }
            if(dest.door===f){
              // Ziel direkt an dieser Fahne. Spielerwunsch R3 (#125): die
              // Ware wird nicht mehr lautlos eingebucht - sie bleibt an der
              // Fahne LIEGEN, und der Bewohner kommt heraus und holt sie
              // durch die Tuer herein (tickProduction stoesst den Gang an).
              if(this.holtSelbst(dest)){
                if(!it.wartet){ it.wartet=true; it.wartT=this.t; }
                // Rueckfall: holt niemand (Fachkraft draussen, haengt,
                // pausiert), wird nach 600 Takten doch direkt eingebucht -
                // kein Betrieb verhungert an der eigenen Tuer
                else if(this.t-(it.wartT||0)>600){
                  items.splice(k,1); this.deliver(dest, it.good); k--;
                }
                continue;
              }
              items.splice(k,1); this.deliver(dest, it.good); k--; continue;
            }
            if(it.reserved) continue;
            if(this.nextRoad(f, dest.door)!==r.id) continue;
            // Zielfahne voll? Dann liegen lassen (v211, siehe oben) - es sei
            // denn, das Ziel steht selbst an dieser Fahne.
            if(zielVoll && dest.door!==zielF) continue;
            const pr = dest.state==='build' ? 0 : (dest.inv ? 2 : 1);
            // Bei gleichem Anlass entscheidet die Rangfolge des Spielers,
            // welche Ware der Traeger zuerst aufnimmt (v196). Vorher gewann
            // schlicht, was zufaellig weiter vorne in der Liste lag.
            const rg = this.rangVon(dest.player, it.good);
            if(pr<bestPr || (pr===bestPr && rg<bestRang)){
              bestPr=pr; bestRang=rg; bestIt=it;
            }
          }
          if(bestIt){
            bestIt.reserved=true;
            c.job={endIx, item:bestIt};
            c.state = (Math.abs(c.pos-endIx)<0.01)?'pickup':'toPick';
            c.targetIx=endIx;
            return true;
          }
          return false;
        };
        if(!pick(0)) pick(lastIx);
        // leichte Heimkehr zur Mitte
        if(c.state==='idle'){
          const mid=lastIx/2;
          if(Math.abs(c.pos-mid)>0.05) c.pos += Math.sign(mid-c.pos)*CARRY_SPEED*0.4;
        }
      }
      // Esel beschleunigen die Straße, Schiffe sind gemächlicher
      const spd=CARRY_SPEED*(r.hasDonkey?1.5:1)*(r.isSea?0.85:1);
      if(c.state==='toPick'){
        c.pos += Math.sign(c.targetIx-c.pos)*spd;
        if(Math.abs(c.pos-c.targetIx)<spd){ c.pos=c.targetIx; c.state='pickup'; }
      }
      if(c.state==='pickup'){
        const f=r.path[c.job.endIx];
        const items=this.flagItems.get(f)||[];
        const ix=items.indexOf(c.job.item);
        if(ix<0){ c.state='idle'; c.job=null; continue; }
        items.splice(ix,1);
        c.item=c.job.item; c.item.reserved=false;
        c.targetIx = c.job.endIx===0 ? lastIx : 0;
        c.state='carry'; c.job=null;
        r.traffic=(r.traffic||0)+1;      // Verkehr zählen (Eselzucht-Ziel)
      }
      if(c.state==='carry'){
        c.pos += Math.sign(c.targetIx-c.pos)*spd;
        if(Math.abs(c.pos-c.targetIx)<spd){
          c.pos=c.targetIx;
          const f=r.path[c.targetIx];
          const dest=this.buildings.get(c.item.destB);
          if(!dest){ c.item=null; c.state='idle'; continue; }
          if(dest.door===f){
            // Uebergabe an der Tuer (#125): ablegen statt einbuchen, der
            // Bewohner holt die Ware herein. Hoechstens vier wartende
            // Waren je Fahne - dahinter wird direkt eingebucht, damit die
            // Fahne fuer den Durchgangsverkehr frei bleibt.
            const items=this.flagItems.get(f)||[];
            if(this.holtSelbst(dest) && items.filter(x=>x.wartet).length<4){
              c.item.wartet=true; c.item.wartT=this.t;
              items.push(c.item); this.flagItems.set(f,items);
            } else this.deliver(dest, c.item.good);
            c.item=null; c.state='idle'; c.stau=0;
          } else {
            const items=this.flagItems.get(f)||[];
            if(items.length<FLAG_CAP+4){
              items.push(c.item); this.flagItems.set(f,items);
              c.item=null; c.state='idle'; c.stau=0;
            } else {
              // WAREN VERSCHWINDEN NICHT MEHR (v201).
              //
              // Bisher warf der Traeger seine Ladung weg, sobald die
              // Zielfahne ueberlief. Gemessen (Saat 11, 45 Spielminuten,
              // ohne KI-Materialhilfe) traf das 277 Waren in einer einzigen
              // Partie - und es traf vor allem Erz und Kohle, deren Weg vom
              // Gebirge zum Lager am laengsten ist. Das Lager stand deshalb
              // die ganze Partie bei null Erz, obwohl vier Bergwerke
              // foerderten; die Eisenhuette wurde nie auch nur gewuenscht,
              // und ohne Eisen entstand in vier Saaten und 240 Spielminuten
              // keine einzige eigene Waffe.
              //
              // Jetzt haelt der Traeger die Ware und wartet, bis an der
              // Fahne wieder Platz ist. Wird es nach einer Spielminute
              // nicht frei, dreht er um und bringt sie ans andere Ende
              // seiner Strasse zurueck. Das kann sichtbar hin und her
              // gehen - genau so soll ein Stau aussehen -, aber verloren
              // geht nichts mehr.
              c.stau=(c.stau||0)+1;
              if(c.stau>600){ c.targetIx = c.targetIx===0? lastIx : 0; c.stau=0; }
            }
          }
        }
      }
    }
  }

  // ---------- Bau ----------
  // Wie weit traegt das bisher gelieferte Material? Der Sockel (80 Takte
  // Grube und Geruest) braucht keines, jedes Brett und jeder Stein gibt 30
  // weitere Takte frei. Steht hier als eigener Helfer, weil zwei Stellen
  // dieselbe Antwort brauchen: der Baufortschritt und die Frage, ob der
  // Bauarbeiter sichtbar haemmern soll.
  bauGrenze(b){
    const def=BLD[b.type];
    const needB=def.cost.board||0, needS=def.cost.stone||0;
    const da=Math.min(needB, b.stock.board||0)+Math.min(needS, b.stock.stone||0);
    return { grenze:80+30*da, total:80+30*(needB+needS), da, noetig:needB+needS };
  }
  tickConstruction(){
    for(const b of this.buildings.values()){
      if(b.state!=='build') continue;
      const def=BLD[b.type];
      const needB=def.cost.board||0, needS=def.cost.stone||0;
      // Material komplett + Bauarbeiter (freie Figur mit Hammer) vor Ort
      const builderThere=b.builderId!=null
        && this.units.some(u=>u.id===b.builderId && u.type==='builder' && u.state==='work');
      // Materialwartezeit zählen: Baustellen, die minutenlang auf Bretter/
      // Steine warten, standen vorher völlig stumm (Kritikbericht F4 – zehn
      // Baustellen >100 Spielminuten ohne eine einzige Meldung). Der Zähler
      // steuert die Sammelmeldung (checkMatWait) und das Warnschild im Bild.
      // R8: DER BAUARBEITER ARBEITET MIT DEM, WAS DA IST.
      // Vorher verlangte diese Stelle das VOLLSTAENDIGE Material, bevor auch
      // nur ein Takt Fortschritt zaehlte. Die Baustelle stand deshalb die
      // ganze Lieferzeit auf null Prozent und war danach in Sekunden fertig.
      // Nachgemessen ueber sechs Saaten war das echte Bauen nur 11 bis 24
      // Prozent der Zeit, die eine Baustelle als Baustelle verbrachte - eine
      // Muehle wartete im Schnitt 1022 Takte auf Material und wurde 199
      // Takte gebaut. Die Bauzeit in der Gebaeudetabelle beschrieb also
      // kaum etwas von dem, was der Spieler sieht.
      // Jetzt traegt jede gelieferte Einheit ihren Anteil: der Sockel (80
      // Takte Grube und Geruest) braucht kein Material, jedes Brett und
      // jeder Stein gibt 30 weitere Takte frei. Die Gesamtzeit bleibt
      // unveraendert, aber sie faellt jetzt IN die Lieferzeit statt danach -
      // und weil der Renderer die Baustufen aus progress/total nimmt,
      // waechst die Baustelle mit jeder Lieferung sichtbar.
      const { grenze, total, da, noetig } = this.bauGrenze(b);
      // Warten zaehlt erst, wenn das fehlende Material den Bau WIRKLICH
      // aufhaelt - sonst meldete das Warnschild eine Baustelle als wartend,
      // an der gerade gehaemmert wird.
      if(da<noetig && b.progress>=grenze) b.matWaitT=(b.matWaitT||0)+1;
      else b.matWaitT=0;
      // Geebnet muss der Platz sein, bevor der erste Nagel sitzt. Der
      // Bauarbeiter laeuft zwar schon waehrend des Ebnens los (siehe
      // tickBuilderSpawn), warten muss er hier.
      if(!b.leveled || !builderThere || b.progress>=grenze) continue;
      b.progress += 1;
      if(b.progress>=total){
        b.state='done'; b.stock={};
        this.bestellungenAufloesen(b);
        this.changedNodes.push(b.node);
        if(def.mil){ this.recalcTerritory(); }
        // Einzugswanderung: die Fachkraft läuft sichtbar vom Hauptquartier her
        // (mit Werkzeug, sofern der Beruf eines braucht – sonst wartet das Gebäude)
        if(b.worker) this.trySettle(b);
        // Kritik R3 S1: Fertigmeldungen waren 42 % des Meldungsstroms
        // ("Wachhaus fertiggestellt." 15x in 30 min). Dasselbe Buendel-
        // fenster wie bei den Angriffsmeldungen (R2 S1): die erste Meldung
        // kommt sofort, weitere im 60-s-Fenster zaehlen still mit, und der
        // naechste Durchlass traegt sie als Sammelzusatz nach. MILITAER-
        // Bauten melden immer sofort - sie erweitern das Gebiet, das will
        // man wissen; sie setzen das Fenster aber genauso neu.
        if(b.player===0){
          const still8=this.t-(this._bauMsgT??-1e9);
          if(def.mil || still8>600){
            const extra8=this._bauStumm||0;
            this.msg(extra8>0? `${def.name} fertiggestellt (dazu ${extra8} weitere Gebäude).`
                             : `${def.name} fertiggestellt.`, 'ok', b.node, 0, 'bau');
            this._bauMsgT=this.t; this._bauStumm=0;
          } else this._bauStumm=(this._bauStumm||0)+1;
        }
        // KD1: rueckt ein FREMDER Posten in Grenznaehe, bekommt der Spieler
        // eine Vorwarnung - "Wir werden angegriffen!" kam bisher aus dem
        // Nichts, ohne dass sich der Druckaufbau je angekuendigt haette.
        else if(def.mil) this.vorpostenWarnung(b);
        this.onBuilt && this.onBuilt(b);
      }
    }
  }
  // Gesammelte Materialwarnung: Baustellen, die länger als ~2 Spielminuten
  // auf Bretter/Steine warten, melden sich EINMAL gebündelt ("N Baustellen
  // warten auf Baumaterial") statt gar nicht (F4) oder einzeln im Minutentakt.
  // Gemeldet wird beim Eintritt in den Zustand; erst wenn wieder KEINE
  // Baustelle mehr wartet, darf eine neue Sammelmeldung kommen.
  // Gemeldet wird nach URSACHE, nicht als Sammelposten. Vorher hiess es
  // immer "warten auf Baumaterial", auch wenn 35 Bretter im Lager lagen und
  // in Wahrheit der Weg fehlte - der Spieler suchte den Fehler an der
  // falschen Stelle. Und die Sperre _matWarned wurde erst zurueckgesetzt,
  // wenn KEINE Baustelle mehr wartete: blieb eine haengen, war der Kanal fuer
  // den Rest der Partie tot (gemessen: eine Meldung bei Tick 1861, danach
  // 38.000 Ticks Stille). Jetzt meldet sich jede Ursache alle 3000 Ticks
  // erneut, solange sie anhaelt.
  checkMatWait(){
    const gruppen={ohneWeg:[], lagerLeer:[], nachschub:[]};
    for(const b of this.buildings.values()){
      if(b.player!==0 || b.state!=='build') continue;
      if((b.matWaitT||0)<1200) continue;
      const def=BLD[b.type];
      const fehltB=Math.max(0,(def.cost.board||0)-(b.stock.board||0));
      const fehltS=Math.max(0,(def.cost.stone||0)-(b.stock.stone||0));
      const lager=this.invTotal(0);
      if(b.door<0 || this.compOf(b.door)===undefined) gruppen.ohneWeg.push(b);
      else if((fehltB>0 && (lager.board||0)===0) || (fehltS>0 && (lager.stone||0)===0))
        gruppen.lagerLeer.push(b);
      else gruppen.nachschub.push(b);
    }
    if(!this._matWarn) this._matWarn={};
    const texte={
      ohneWeg:   (n)=> n===1 ? 'Eine Baustelle hat keinen Weg zum Lager – verbinde sie mit einer Straße!'
                             : `${n} Baustellen haben keinen Weg zum Lager – verbinde sie mit Straßen!`,
      lagerLeer: (n)=> n===1 ? 'Eine Baustelle wartet: das Lager ist leer.'
                             : `${n} Baustellen warten: das Lager ist leer.`,
      nachschub: (n)=> n===1 ? 'Eine Baustelle wartet auf Nachschub – der Transport stockt.'
                             : `${n} Baustellen warten auf Nachschub – der Transport stockt.`,
    };
    for(const k in gruppen){
      const liste=gruppen[k];
      if(!liste.length){ this._matWarn[k]=0; continue; }
      if(this.t-(this._matWarn[k]||-9999) < 3000) continue;
      this._matWarn[k]=this.t;
      this.warn(liste[0], 'material', texte[k](liste.length), 3000);
    }
  }

  // ---------- Produktion & Arbeiter ----------
  tickProduction(){
    const m=this.map;
    for(const b of this.buildings.values()){
      if(b.state!=='done' || b.player<0) continue;
      const def=BLD[b.type];
      if(b.paused) continue;                       // vom Spieler stillgelegt
      // ohne eingezogene Fachkraft ruht der Betrieb
      if(b.worker && !b.worker.present) continue;
      // Warenaustrag läuft: die Fachkraft trägt gerade sichtbar eine fertige
      // Ware zur Türfahne – solange ruht die Arbeit im Haus (der Weg wird
      // beim Wiedereintritt als Taktkredit in die Zykluszeit eingerechnet).
      if(b.worker && b.worker.state==='austrag'){
        if(this.units.some(u=>(u.type==='austrag'||u.type==='einhol') && u.bld===b.id)) continue;
        b.worker.state='in';   // Wächter: Figur fehlt (z.B. Altbestand) -> Betrieb weiter
      }
      // Warenannahme an der Tuer (#125, Spielerwunsch): liegt eine an
      // DIESES Haus adressierte Ware wartend an der Tuerfahne, tritt die
      // Fachkraft heraus, holt sie und traegt sie hinein - eine je Gang.
      // Nur wenn sie gerade im Haus ist; sonst greift der Zeit-Rueckfall
      // in tickCarriers.
      if(b.worker && b.worker.present && b.worker.state==='in'
         && b.door!=null && b.door>=0){
        const wl9=this.flagItems.get(b.door);
        if(wl9 && wl9.some(it=>it.wartet && it.destB===b.id)){
          this.units.push({ id:NEXT_ID++, type:'einhol', player:b.player, bld:b.id,
            ...this.tuerAustritt(b), wtype:PROF_OF[b.type]||'worker',
            state:'zurFahne', _t0:this.t });
          b.worker.state='austrag';
          continue;
        }
      }
      // Bedarfsbremse: bei Überfluss des eigenen Guts ruhen (siehe satHold)
      if(this.satHold(b)){ b.prodT=0; continue; }
      if(def.prod){
        if(b.out>=4) continue;
        // Sonderausstoß: Esel/Schiff nur produzieren, wenn gebraucht
        const special=def.prod.out==='@donkey'||def.prod.out==='@ship';
        if(def.prod.out==='@donkey' && !this.donkeyTargetRoad(b.player)) { b.prodT=0; continue; }
        if(def.prod.out==='@ship' && !this.shipNeeded(b.player)) { b.prodT=0; continue; }
        // Brunnen ohne Inputs
        let ok=true;
        for(const g in def.prod.inputs) if((b.stock[g]||0)<def.prod.inputs[g]) ok=false;
        if(!ok){ b.prodT=0; continue; }
        // Werkzeugschmiede: schmiedet bedarfsgesteuert – ist alles ausreichend
        // vorhanden, ruht sie (spart Eisen)
        if(b.type==='toolsmith' && b.prodT===0){
          // Hat der Spieler ein Werkzeug fest eingestellt, wird nur das
          // geschmiedet; sonst entscheidet der Bedarf.
          b.chosenTool = b.makeGood || this.toolsmithChoose(b.player);
          if(!b.chosenTool) continue;
        }
        // Waffenschmiede: feste Waffenwahl des Spielers - oder nach Bedarf.
        // Nutzer-Report v186: im Bedarf-Modus blieb chosenTool leer, damit
        // gab brakeGood null zurueck und die Bedarfsbremse griff NIE - die
        // Schmiede rotierte endlos durch alle vier Waffen, solange Eisen und
        // Kohle kamen. Bei voller Reserve nahm der Waffenberg im HQ deshalb
        // nur zu und nie ab (die Werkzeugschmiede hatte denselben Fehler,
        // R6 hat ihn dort behoben - hier fehlte das Gegenstueck).
        if(b.type==='armory' && b.prodT===0){
          b.chosenTool = b.makeGood || this.armoryChoose(b.player);
          if(!b.chosenTool) continue;
        }
        // ESSEN IST NIE PFLICHT, ESSEN IST TEMPO (Entscheidung v194).
        // Vorher verdoppelte eine Mahlzeit den Takt; zusammen mit dem
        // Bergbau, der ohne Essen GAR NICHTS foerderte, hing die halbe
        // Wirtschaft an der Getreidekette: der gemessene Erzverbund aus
        // sieben Bergwerken verlangte 45,5 Mahlzeiten je Minute, also rund
        // 31 Bauernhoefe. Jetzt gilt ueberall dieselbe einfache Regel -
        // ohne Essen laeuft der Betrieb, mit Essen um die Haelfte schneller.
        const fed=(def.foodBoost||b.foodPrio) && FOODS.some(f=>(b.stock[f]||0)>0);
        b.prodT += fed? ESSEN_TEMPO : 1;
        if(b.prodT>=def.prod.time){
          b.prodT=0;
          for(const g in def.prod.inputs) b.stock[g]-=def.prod.inputs[g];
          if(fed){ const f=FOODS.find(k=>(b.stock[k]||0)>0); if(f) b.stock[f]--; }
          if(def.prod.outs){
            const ix=b.chosenTool? def.prod.outs.indexOf(b.chosenTool) : -1;
            b.altOut = ix>=0? ix : ((b.altOut||0)+1)%def.prod.outs.length;
          }
          if(def.prod.out==='@donkey') this.spawnDonkey(b);
          else if(def.prod.out==='@ship') this.launchShip(b);
          else this.wareAustragen(b);   // sichtbar zur Türfahne tragen
        }
      }
      if(def.mine){
        if(b.out>=4) continue;
        // Bergleute arbeiten auch mit leerem Bauch - Essen macht sie nur
        // schneller (v194). Die alte Regel "keine Mahlzeit, keine Foerderung"
        // machte aus jedem Erz eine Mahlzeit und koppelte damit den ganzen
        // Bergbau an den Bauernhof: gemessen brauchte ein Verbund aus vier
        // Kohle-, zwei Eisen- und einem Goldbergwerk 45,5 Essen je Minute,
        // das sind rund sieben Baeckereien und 31 Hoefe. Diese Kette hat nie
        // jemand gebaut - also lief auch die Erzkette nie.
        const satt=FOODS.some(f=>(b.stock[f]||0)>0);
        b.prodT += satt? ESSEN_TEMPO : 1;
        if(b.prodT>=def.time){
          b.prodT=0;
          // Essen verbrauchen, wenn welches da ist (sonst wird eben langsamer
          // gefoerdert)
          if(satt) for(const f of FOODS) if((b.stock[f]||0)>0){ b.stock[f]--; break; }
          // Erz in Umgebung suchen
          // EIN Ring statt zwei (v99). Über zwei Ringe erreichte das
          // Bergwerk 19 Knoten; zusammen mit dem flächendeckenden Erz lag
          // die Trefferwahrscheinlichkeit bei 97-99 %, und der Geologe war
          // überflüssig. Erz liegt jetzt in Nestern (s. map.js), und das
          // Bergwerk muss auf oder neben einem davon stehen.
          const targetT = {coal:1, ironore:2, gold:3, stone:4}[def.mine];
          let found=false;
          for(const nn of [b.node, ...m.nbs(b.node)]){
            if(m.oreT[nn]===targetT && m.oreA[nn]>0){ m.oreA[nn]--; found=true; break; }
          }
          if(found){
            this.wareAustragen(b);   // Bergmann bringt das Erz sichtbar zur Fahne
            // R7: VORWARNUNG. Bisher erfuhr der Spieler von der Erschoepfung
            // erst, wenn sie da war - und dann stand das Bergwerk. Ein Rest
            // von fuenf Einheiten ist frueh genug, um einen Geologen
            // loszuschicken und ein neues Bergwerk zu setzen.
            if(!b._neigeMsg && b.player===0 && this.oreLeft(b)<=5){
              b._neigeMsg=true;
              this.msg(`${def.name}: das Vorkommen geht zur Neige.`, 'warn', b.node, 0, 'erz');
            }
          }
          else {
            if(!b.depleted){
              b.depleted=true;
              if(b.player===0) this.msg(`${def.name}: Vorkommen erschöpft!`, 'warn', b.node, 0, 'erz');
              // Erz waechst nie nach (oreA wird nur bei der Kartenerzeugung
              // gesetzt) - ein erschoepftes Bergwerk ist endgueltig tot.
              // Die Spitzhacke darin waere sonst fuer immer gebunden; sie
              // kehrt ins Lager zurueck (gleiches Prinzip wie beim
              // erschoepften Steinbruch, s. Sammler-Erschoepfung unten).
              if(b.toolGood){
                const hqW=this.buildings.get(this.players[b.player].hq);
                if(hqW && hqW.inv){
                  hqW.inv[b.toolGood]=(hqW.inv[b.toolGood]||0)+1;
                  if(b.player===0)
                    this.msg(`${def.name}: die Spitzhacke kehrt ins Lager zurück.`, 'info', b.node, 0, 'erz');
                }
                b.toolGood=null;
              }
            }
          }
        }
      }
      if(def.cata){
        b.prodT++;
        if(b.prodT>=def.cata.time && (b.stock.stone||0)>0){
          // Ziel suchen
          let target=null, bd=1e9;
          for(const e of this.buildings.values()){
            if(e.player===b.player || e.player<0) continue;
            if(!(BLD[e.type].mil || e.type==='hq')) continue;
            const d=Math.hypot(m.X(e.node)-m.X(b.node), m.Y(e.node)-m.Y(b.node));
            if(d<=def.cata.radius && d<bd){ bd=d; target=e; }
          }
          if(target){
            b.prodT=0; b.stock.stone--;
            const [sx,sy]=m.worldPos(b.node), [tx,ty]=m.worldPos(target.node);
            this.units.push({id:NEXT_ID++, type:'boulder', player:b.player, x:sx, y:sy-30, sx, sy:sy-30, tx, ty, targetB:target.id, prog:0});
          }
        }
      }
      if(def.gather && b.worker && b.worker.present && b.worker.state==='in'){
        b.worker.timer++;
        // Erschöpfte Umgebung: nur noch alle 2,5 s neu suchen statt jeden Takt
        if(b.worker.timer >= def.time*0.4 && b.out<4 && (!b.exhausted || this.t%25===0)){
          const job=this.findGatherJob(b);
          if(job!==null){
            b.worker.timer=0;
            b.noJobT=0; b.exhausted=false;         // Umgebung gibt wieder etwas her
            const u={ id:NEXT_ID++, type:'worker', wtype:b.type, player:b.player, bld:b.id,
              ...this.tuerAustritt(b), target:job.node, jobKind:job.kind, animalId:job.animalId, state:'go', actT:0 };
            this.units.push(u);
            b.worker.state='out';
            if(job.reserve) m.obj[job.node]|=128; // reserviert-Bit
          } else if(def.gather==='tree'||def.gather==='stone'||def.gather==='fish'
                    ||def.gather==='hunt'||def.gather==='plant'){
            // Stille Erschöpfung sichtbar machen (Kritikbericht F4: der
            // Steinmetz verstummte einfach, das Bauwesen starb unbemerkt).
            // Erst nach 60 s ohne jede Beute gilt die Umgebung als erschöpft
            // – kurze Lücken (reservierte Bäume, gejagtes Wild) zählen nicht.
            // EINE Meldung je Gebäude; findet sich später wieder etwas,
            // löst sich der Zustand und darf erneut gemeldet werden.
            b.noJobT=(b.noJobT||0)+1;
            if(b.noJobT>=600 && !b.exhausted){
              b.exhausted=true;
              // Dauerzustand: das Warnschild am Gebäude zeigt ihn an, der
              // Toast kommt über warn() mit LANGER Sperre – vorher wiederholte
              // sich dieselbe Meldung endlos, sobald ein nachgewachsener Baum
              // die Erschöpfung kurz löste und sie gleich wieder eintrat
              // (Kritikbericht F5: 17 gleiche Toasts in 50 Minuten).
              // Der Foerster ist der Sonderfall: ihm geht nichts AUS, ihm
              // fehlt der PLATZ. Bisher fiel er ganz aus der Meldung heraus
              // und stand stumm da, als liefe alles.
              this.warn(b, 'exhausted', def.gather==='plant'
                ? `${def.name}: keine freie Fläche zum Pflanzen in Reichweite!`
                : `${def.name}: nichts mehr in Reichweite – Umgebung erschöpft!`, 6000);
              // Spitzhacken-Todesspirale (Nutzerbefund v166: "Spiel direkt
              // tot"): der Steinmetz eines erschoepften Bruchs sass fuer
              // immer auf seiner Spitzhacke - zusammen mit dem Geologen und
              // den Bergwerken (alle brauchen 'pick') waren die Starthacken
              // schnell gebunden, und neue gibt es nur ueber Eisen, das ohne
              // Geologe nie gefunden wird. STEINE wachsen nicht nach, die
              // Erschoepfung eines Steinbruchs ist endgueltig - die Hacke
              // kehrt deshalb ins Lager zurueck. Baeume/Fisch/Wild koennen
              // sich erholen, deren Werkzeug bleibt im Haus.
              if(def.gather==='stone' && b.toolGood){
                const hqW=this.buildings.get(this.players[b.player].hq);
                if(hqW && hqW.inv){
                  hqW.inv[b.toolGood]=(hqW.inv[b.toolGood]||0)+1;
                  if(b.player===0)
                    this.msg(`${def.name}: die Spitzhacke kehrt ins Lager zurück.`, 'info', b.node, 0, 'erz');
                }
                b.toolGood=null;
              }
            }
          }
        }
      }
    }
  }
  findGatherJob(b){
    const m=this.map, def=BLD[b.type];
    const R=def.range;
    // ausdrücklich nur erreichbare Knoten – siehe nodesWalkable.
    // Knoten, an denen sich schon einmal eine Figur festgelaufen hat, fallen
    // heraus (b.tabu, gefüllt vom Wächter in tickWorker). Ohne das wählt die
    // Zielsuche denselben toten Knoten sofort wieder: sie nimmt immer den
    // ERSTEN Treffer, und der ändert sich ja nicht.
    // Wurzel B: "erreichbar" wurde an drei Stellen verschieden beantwortet.
    // nodesWalkable schliesst nur Wasser und Lava aus, die BEWEGUNG prueft
    // zusaetzlich Fels und den Schatten fremder Hausbilder (gehbar). Ein Ziel
    // konnte damit gueltig sein, ohne je betretbar zu sein - genau der Fall
    // des Foersters, dessen Pflanzplatz unter dem Bild der Burg lag.
    // Jetzt gilt fuer die Zielsuche dasselbe Mass wie fuers Laufen.
    const roh=this.nodesWalkable(b.node, R);
    // Die Sperre laeuft nach TABU_DAUER ab - sie soll den Kreislauf
    // "immer wieder derselbe tote Knoten" brechen, nicht ein Fleckchen
    // Wald dauerhaft aus der Karte nehmen.
    const tb=(b.tabu && typeof b.tabu==='object' && !(b.tabu instanceof Set)) ? b.tabu : null;
    const nodes=roh.filter(i=> this.gehbar(i, b.id)
                               && !(tb && tb[i]!==undefined && this.t-tb[i] < TABU_DAUER));
    const un=(o)=>o&127;
    switch(def.gather){
      case 'tree': {
        const t=nodes.find(i=> un(m.obj[i])===OBJ.TREE && !(m.obj[i]&128));
        return t!==undefined? {node:t, kind:'chop', reserve:true} : null;
      }
      case 'plant': {
        const t=nodes.find(i=> m.obj[i]===OBJ.NONE && m.terr[i]===TER.GRASS && m.bld[i]<0 && !m.flag[i]
          && m.owner[i]===b.player && !this.roadAt(i));
        return t!==undefined? {node:t, kind:'plant', reserve:false} : null;
      }
      case 'stone': {
        const t=nodes.find(i=> un(m.obj[i])===OBJ.STONE && m.amt[i]>0 && !(m.obj[i]&128));
        return t!==undefined? {node:t, kind:'pick', reserve:true} : null;
      }
      case 'fish': {
        // Landknoten neben Wasser mit Fisch
        for(const i of nodes){
          if(m.terr[i]===TER.WATER) continue;
          const wn=m.nbs(i).find(n=> m.terr[n]===TER.WATER && m.fish[n]>0);
          if(wn!==undefined) return {node:i, kind:'fish', data:wn, reserve:false};
        }
        return null;
      }
      case 'hunt': {
        // echtes Wild in Reichweite suchen (nächstes, noch nicht bejagtes Tier)
        const [bx,by]=m.worldPos(b.node);
        const maxD=R*40;
        // dasselbe wie beim Holzfäller: nur Wild, zu dem der Jäger auch
        // hinkommt – jenseits eines Sees wartet er sonst ewig
        const erreichbar=new Set(nodes);
        let best=null, bd=1e9;
        for(const a of this.animals){
          if(a.hunted) continue;
          if(!erreichbar.has(a.node)) continue;
          const d=Math.hypot(a.x-bx, a.y-by);
          if(d<maxD && d<bd){ bd=d; best=a; }
        }
        if(best){ best.hunted=true; return {node:best.node, kind:'hunt', animalId:best.id, reserve:false}; }
        return null;
      }
      case 'farm': {
        const ripe=nodes.find(i=> m.obj[i]===OBJ.FIELD2);
        if(ripe!==undefined) return {node:ripe, kind:'harvest', reserve:false};
        if(b.out<2){
          const ziel=this.ackerZiel(b, nodes);
          if(ziel!==undefined) return {node:ziel, kind:'sow', reserve:false};
        }
        return null;
      }
    }
    return null;
  }
  // Getreide wächst nicht in Beeten kreuz und quer, sondern auf einem Acker.
  // Ein Bauernhof legt deshalb bis zu drei zusammenhängende Flächen an: der
  // erste Halm bestimmt die Mitte, danach wird immer an eine schon bestellte
  // Stelle ANGEBAUT. Ist eine Fläche ausgewachsen, beginnt die nächste.
  static ACKER_MAX=5;        // Punkte je Fläche (Mitte + Teilring; 7 ergab Riesenfelder)
  static ACKER_N=3;          // höchstens drei Flächen je Hof
  ackerZiel(b, nodes){
    const m=this.map;
    // Bauschatten zählt mit: ein Feld unter dem gemalten Nachbargebäude
    // sah aus, als wüchse das Korn im Haus
    const frei=(i)=> m.obj[i]===OBJ.NONE && m.terr[i]===TER.GRASS && m.bld[i]<0
      && !m.flag[i] && m.owner[i]===b.player && !this.roadAt(i) && !this.unterHaus(i);
    if(!b.aecker) b.aecker=[];
    // Flächen aufräumen: was nicht mehr bestellbar ist, fällt heraus
    b.aecker=b.aecker.filter(a=>a.length);
    // FREMDE Felder (anderer Hof, auch KI) auf Abstand halten: klebten zwei
    // Höfe ihre Äcker aneinander, verschmolzen sie im Bild zu einem
    // Riesenfeld über beide Betriebe
    const eigene=new Set(b.aecker.flat());
    const istFeldObj=(q)=>{ const o=m.obj[q]&127; return o===OBJ.FIELD0||o===OBJ.FIELD1||o===OBJ.FIELD2; };
    const fremdFeldNah=(i)=> m.nbs(i).some(q=> istFeldObj(q) && !eigene.has(q));
    // 1) Brachliegende Stelle INNERHALB einer Fläche zuerst wieder bestellen –
    //    so bleibt der Acker ein Acker und wandert nicht über die Wiese
    for(const a of b.aecker){
      const nach=a.find(i=>frei(i));
      if(nach!==undefined) return nach;
    }
    // 2) Eine noch nicht ausgewachsene Fläche erweitern: nur direkt daneben,
    //    niemals auf eine andere Fläche zu - und in RAUTENFORM. Die Felder
    //    werden als schräge Vierecke in der Bauperspektive gezeichnet;
    //    gewählt wird deshalb der Nachbar, der die Fläche in dieser Raute
    //    am kompaktesten hält, sonst ragen einzelne Zellen aus dem
    //    gezeichneten Feld heraus bzw. blähen es auf.
    for(const a of b.aecker){
      if(a.length>=Game.ACKER_MAX) continue;
      const fremd=new Set();
      for(const o of b.aecker){ if(o===a) continue; for(const i of o){ fremd.add(i); for(const q of m.nbs(i)) fremd.add(q); } }
      const [ax0,ay0]=m.worldPos(a[0]);
      // Bewertet wird die GEZEICHNETE Bounding-Raute nach dem Anbau (gleiche
      // Achsenrechnung wie der Renderer): reine Punktabstände ließen Reihen
      // entlang x zu, deren Zeichenraute zum Riesenfeld aufblähte
      const masse=(liste)=>{
        let su=0.36, sv=0.36;
        for(const i2 of liste){
          const [px,py]=m.worldPos(i2);
          const dx=px-ax0, dy=py-ay0;
          const pp=(dx/52+dy/26)/2, qq=(dy/26-dx/52)/2;
          su=Math.max(su, Math.abs(pp)+0.36); sv=Math.max(sv, Math.abs(qq)+0.36);
        }
        return [su,sv];
      };
      let best, bm=1e9;
      for(const i of a) for(const n of m.nbs(i)){
        if(!frei(n) || a.includes(n) || fremd.has(n) || !nodes.includes(n) || fremdFeldNah(n)) continue;
        const [su,sv]=masse([...a, n]);
        // Deckel: was die Raute über ~2,5 Kacheln Kantenlänge triebe,
        // wird nicht angebaut - lieber ein kleinerer, sauberer Acker
        if(su>1.25 || sv>1.25) continue;
        const mv=su*sv;
        if(mv<bm){ bm=mv; best=n; }
      }
      if(best!==undefined){ a.push(best); return best; }
    }
    // 3) Alle Flächen ausgewachsen? Dann eine neue anfangen – mit Abstand,
    //    sonst wachsen zwei Äcker zu einem Klumpen zusammen
    if(b.aecker.length>=Game.ACKER_N) return undefined;
    const belegt=new Set(b.aecker.flat());
    // Abstand von ZWEI Reihen zum naechsten Acker: die Felder werden als
    // eckige Flaechen gezeichnet, die etwas ueber ihre Zellen hinausreichen -
    // mit nur einer Reihe Abstand kleben sie im Bild aneinander
    const nahBelegt=(i)=> m.nbs(i).some(n=> belegt.has(n) || m.nbs(n).some(q=>belegt.has(q)));
    const fremd2=(i)=> fremdFeldNah(i) || m.nbs(i).some(q=>fremdFeldNah(q));
    const start=nodes.find(i=> frei(i) && !belegt.has(i) && !nahBelegt(i) && !fremd2(i));
    if(start===undefined) return undefined;
    b.aecker.push([start]);
    return start;
  }
  nodesInRange(center, R){
    const m=this.map, out=[], seen=new Set([center]);
    let q=[center];
    for(let d=0; d<R; d++){
      const nq=[];
      for(const i of q) for(const n of m.nbs(i)){
        if(seen.has(n)) continue; seen.add(n); out.push(n); nq.push(n);
      }
      q=nq;
    }
    // nach Distanz sortiert ist es schon (BFS)
    return out;
  }
  // Wie nodesInRange, aber nur was der Arbeiter zu FUSS erreicht: über
  // Wasser und Lava geht es nicht weiter. Ohne diese Prüfung schickt der
  // Holzfäller seinen Mann zu einem Baum auf der anderen Seite des Sees –
  // Luftlinie stimmt, ankommen tut er nie, und das Haus steht still.
  // Maske: von welchen Landknoten aus ist ein Ufer in Gehweite des Fischers
  // erreichbar? Einmal je Karte per Breitensuche von allen Uferknoten aus -
  // canBuild fragt sie fuer jeden Punktevorschlag ab, da muss es O(1) sein.
  fischNah(){
    if(this._fischNah) return this._fischNah;
    const m=this.map, R=BLD.fisher.range;
    const maske=new Uint8Array(m.terr.length);
    let front=[];
    for(let i=0;i<m.terr.length;i++){
      if(m.terr[i]===TER.WATER || m.terr[i]===TER.LAVA) continue;
      if(m.nbs(i).some(n=>m.terr[n]===TER.WATER)){ maske[i]=1; front.push(i); }
    }
    for(let d=1; d<=R && front.length; d++){
      const nf=[];
      for(const i of front) for(const n of m.nbs(i)){
        if(maske[n] || m.terr[n]===TER.WATER || m.terr[n]===TER.LAVA) continue;
        maske[n]=1; nf.push(n);
      }
      front=nf;
    }
    this._fischNah=maske;
    return maske;
  }
  // Ist der Knoten ans Wegenetz des Spielers ANSCHLIESSBAR? Straßen laufen
  // nur durch EIGENES Gebiet und nie über Wasser/Lava. Das eigene Gebiet wird
  // deshalb in zusammenhängende begehbare Stücke zerlegt; anschließbar sind
  // das Stück mit dem Hauptquartier und jedes Stück, in dem eine Fahne des
  // HQ-Straßennetzes steht (Seewege über Häfen verbinden getrennte Stücke!).
  // Ohne diese Prüfung bot die Bauplatz-Anzeige nach einer Grenzerweiterung
  // ÜBER Wasser grüne Punkte auf Sandbänken an, deren Türfahne nie eine
  // Straße erreichen kann – fünf tote Baustellen verrotteten bis Spielende
  // (Kritikbericht F1, M/Seed 11, Knoten 7357-7360). Die Maske wird je
  // Spieler EINMAL je Gebiets-/Netzänderung berechnet und dann in O(1)
  // abgefragt – KEIN A* pro Punkt pro Frame.
  netLandOk(player, node){
    const m=this.map;
    this._netLand=this._netLand||new Map();
    let e=this._netLand.get(player);
    if(!e || e.terrVer!==this.territoryVer || e.routeVer!==this.routeVer){
      const comp=new Int32Array(m.terr.length).fill(-1);
      const frei=(i)=> m.owner[i]===player && m.terr[i]!==TER.WATER && m.terr[i]!==TER.LAVA;
      let c=0;
      for(let i=0;i<m.terr.length;i++){
        if(comp[i]>=0 || !frei(i)) continue;
        comp[i]=c;
        const q=[i];
        while(q.length){
          const cur=q.pop();
          for(const n of m.nbs(cur)) if(comp[n]<0 && frei(n)){ comp[n]=c; q.push(n); }
        }
        c++;
      }
      const set=new Set();
      const hq=this.buildings.get(this.players[player]?.hq);
      if(hq && comp[hq.node]>=0) set.add(comp[hq.node]);
      if(hq && hq.door>=0){
        const hqC=this.compOf(hq.door);
        if(hqC!==undefined)
          for(const f of this.flagGraph().keys())
            if(this.compOf(f)===hqC && comp[f]>=0) set.add(comp[f]);
      }
      e={terrVer:this.territoryVer, routeVer:this.routeVer, comp, set};
      this._netLand.set(player, e);
    }
    return e.comp[node]>=0 && e.set.has(e.comp[node]);
  }
  nodesWalkable(center, R){
    // Der eigene Standort zählt mit: der Jäger erlegt auch Wild direkt vor
    // der Tür, der Fischer nutzt ein Ufer, auf dem seine Hütte selbst steht.
    // (Objekt-Jobs wie Baum/Fels sind auf dem Gebäudeknoten ohnehin nie.)
    const m=this.map, out=[center], seen=new Set([center]);
    const fest=(n)=> m.terr[n]!==TER.WATER && m.terr[n]!==TER.LAVA;
    let q=[center];
    for(let d=0; d<R; d++){
      const nq=[];
      for(const i of q) for(const n of m.nbs(i)){
        if(seen.has(n)) continue;
        seen.add(n); out.push(n);
        if(fest(n)) nq.push(n);       // nur über Land geht es weiter
      }
      q=nq;
    }
    return out;
  }

  // ---------- Einheiten ----------
  tickUnits(){
    const m=this.map;
    for(const u of this.units){
      if(u.type==='worker') this.tickWorker(u);
      else if(u.type==='austrag') this.tickAustrag(u);
      else if(u.type==='einhol') this.tickEinhol(u);
      else if(u.type==='attack') this.tickAttack(u);
      else if(u.type==='geo') this.tickGeo(u);
      else if(u.type==='builder') this.tickBuilder(u);
      else if(u.type==='leveler') this.tickLeveler(u);
      else if(u.type==='settle') this.tickSettle(u);
      else if(u.type==='flee') this.tickFlee(u);
      else if(u.type==='scout') this.tickScout(u);
      else if(u.type==='donkey') this.tickDonkey(u);
      else if(u.type==='soldierMove') this.tickSoldierMove(u);
      else if(u.type==='boulder'){
        u.prog+=0.02;
        const t2=Math.min(1,u.prog);
        u.x=u.sx+(u.tx-u.sx)*t2;
        u.y=u.sy+(u.ty-u.sy)*t2 - Math.sin(t2*Math.PI)*46;
        if(u.prog>=1){
          u.dead=true;
          this.fx.push({type:'impact', x:u.tx, y:u.ty, t0:this.t});
          const b=this.buildings.get(u.targetB);
          if(b){
            if(b.soldiers && b.soldiers.length>0){ b.soldiers.pop(); if(b.player===0) this.msg('Katapultbeschuss auf unser Gebäude!', 'war', b.node, 0, 'kampf'); }
            else if(b.type!=='hq'){ this.burnBuilding(b); }
            else { b.hqHits=(b.hqHits||0)+1; if(b.hqHits>6) this.burnBuilding(b); }
          }
          this.onBoulder && this.onBoulder(u);
        }
      }
    }
    this.units=this.units.filter(u=>!u.dead);
    if(this.t%10===0) for(const u of this.units) if(u.player===0){ const n=m.nearestNode(u.x,u.y); if(n>=0) this.exploreAround(n,3); }
  }
  moveToward(u, tx, ty, speed){
    const dx=tx-u.x, dy=ty-u.y;
    const d=Math.hypot(dx,dy);
    const sp=speed*40; // px pro Tick (0.12 -> ~0.9 Knoten/s)
    if(d<=sp){ u.x=tx; u.y=ty; u._det=null; return true; }
    // Läuft gerade ein Umweg über das Knotennetz? Dann Wegpunkt für Wegpunkt
    // abarbeiten (die Knoten sind Land - kein weiteres Ausweichen nötig).
    if(u._det){
      if(Math.hypot(u._detTx-tx, u._detTy-ty)>12) u._det=null; // Ziel gewechselt
      else {
        const [wx,wy]=u._det[0];
        const dxw=wx-u.x, dyw=wy-u.y, dw=Math.hypot(dxw,dyw);
        if(dw<=sp){ u.x=wx; u.y=wy; u._det.shift(); if(!u._det.length) u._det=null; }
        else { u.x+=dxw/dw*sp; u.y+=dyw/dw*sp; }
        return false;
      }
    }
    // Fortschritts-Wächter: kommt die Figur ihrem Ziel ~2 s lang nicht
    // näher (Bucht, Engstelle, Fahnengewirr), wird EINMAL ein echter
    // Landweg über die Knoten gesucht statt weiter lokal auszuweichen.
    // Ohne diesen Ausstieg blieb z.B. der Planierer am Ufer einer Bucht
    // hängen und "tanzte" dort endlos.
    if(u._mtx===undefined || Math.hypot(u._mtx-tx, u._mty-ty)>12){
      u._mtx=tx; u._mty=ty; u._btD=d; u._stl=0;
      // SOFORT prüfen, ob die Luftlinie durch Fels, Wasser oder ein
      // Hausbild führt, und dann gleich einen Knotenweg nehmen. Vorher
      // rannte die Figur zwei Sekunden gegen das Hindernis, bevor der
      // Fortschritts-Wächter griff - genau das sah aus, als liefe sie
      // "durch alles durch". Gedrosselt, damit ein bewegliches Ziel
      // (verfolgter Gegner) die Prüfung nicht jeden Takt auslöst.
      if(this.t-(u._blkT??-99)>=10){
        u._blkT=this.t;
        if(this.wegVersperrt(u, tx, ty)){
          const det=this.landDetour(u, tx, ty);
          if(det && det.length){ u._det=det; u._detTx=tx; u._detTy=ty; return false; }
        }
      }
    } else if(d<u._btD-1.5){ u._btD=d; u._stl=0; }
    else if((u._stl=(u._stl||0)+1)>18){
      u._stl=0;
      const det=this.landDetour(u, tx, ty);
      if(det && det.length){ u._det=det; u._detTx=tx; u._detTy=ty; return false; }
    }
    let nx=dx/d, ny=dy/d;
    // Fahnen sind feste Hindernisse: liegt eine dicht voraus, wird sie
    // seitlich umgangen statt durchlaufen.
    // WICHTIG: Die Ausweichseite muss je Fahne FEST bleiben und der Schub
    // darf den Vortrieb nie übertönen. Vorher wechselte die Seite mit jedem
    // Takt (Vorzeichen des Kreuzprodukts kippte hin und her) - die Figur
    // geriet in einen stabilen Pendelkreis um die Fahne und erreichte ihr
    // Ziel NIE. Genau das war der "Tanz" des Planierers um den Bauplatz.
    const m=this.map;
    const an=m.nearestNode(u.x+nx*15, u.y+ny*15);
    if(an>=0 && m.flag[an]){
      const [fx,fy]=m.worldPos(an);
      const tdist=Math.hypot(tx-fx, ty-fy);
      if(tdist>16){                                  // nicht ausweichen, wenn die Fahne das Ziel ist
        const ax=fx-u.x, ay=fy-u.y;
        const ad=Math.hypot(ax,ay);
        if(ad>0.01 && ad<19){
          const fwd=(ax*nx+ay*ny)/ad;                // liegt die Fahne wirklich VORAUS?
          if(fwd>0.2){
            // Seite einmal wählen und für diese Fahne beibehalten
            let side=(ax*ny-ay*nx)>0 ? -1 : 1;
            if(u._avF===an && u._avS!==undefined) side=u._avS;
            u._avF=an; u._avS=side;
            const ox=-ny*side, oy=nx*side;
            // gedeckelt und mit dem Voraus-Anteil gewichtet: seitlich heißt
            // schwächer schieben, damit die Figur an der Fahne VORBEIkommt
            const k=Math.min(0.8, 1.15*(1-ad/19))*fwd;
            nx+=ox*k; ny+=oy*k;
            const nl=Math.hypot(nx,ny)||1;
            nx/=nl; ny/=nl;
          }
        }
      }
    }
    // Wasser ist kein Untergrund: liegt der nächste Schritt im See, wird am
    // Ufer entlang ausgewichen statt hindurchzulaufen.
    // Die Drehrichtung wird GEMERKT (u._wS): vorher wurde jeden Takt neu
    // entschieden - an einer Bucht sprang die Figur zwischen "geradeaus"
    // und "scharf zurückdrehen" hin und her und kam nie ums Wasser herum
    // (zweite Ursache des Planierer-Tanzes). Mit fester Seite folgt sie dem
    // Ufer stetig in eine Richtung, bis der direkte Weg wieder frei ist.
    // Es ist NICHT mehr nur Wasser: Felsformationen und die Standflaeche
    // eines Hausbildes sperren genauso (Nutzerurteil v95: "der planierer
    // rennt ... durch alles durch"). Steht die Figur selbst auf einem
    // gesperrten Knoten, wird nicht ausgewichen - sie muss erst heraus,
    // sonst friert sie in einem Felsfeld ein.
    const sperr=(px,py)=>{ const n=m.nearestNode(px,py); return n>=0 && !this.gehbar(n,u.bld); };
    const hier=m.nearestNode(u.x,u.y);
    const frei= hier<0 || this.gehbar(hier,u.bld);
    if(frei && sperr(u.x+nx*sp*1.6, u.y+ny*sp*1.6)){
      let found=false;
      const s=u._wS||1;
      for(const a2 of [0.7*s,1.4*s,2.1*s,-0.7*s,-1.4*s,-2.1*s]){
        const ca=Math.cos(a2), sa=Math.sin(a2);
        const rx=nx*ca-ny*sa, ry=nx*sa+ny*ca;
        if(!sperr(u.x+rx*sp*1.6, u.y+ry*sp*1.6)){
          nx=rx; ny=ry; found=true;
          u._wS = a2>0? s : -s;                   // erfolgreiche Seite beibehalten
          break;
        }
      }
      if(!found) return false;                    // eingekeilt: diesen Tick warten
    }
    u.x+=nx*sp; u.y+=ny*sp;
    return false;
  }
  // Darf eine FREI laufende Figur diesen Knoten betreten? Drei Gründe
  // sprechen dagegen, und alle drei müssen überall gleich gelten - sonst
  // weicht die Figur lokal aus, während die Wegsuche mitten durchgeht:
  //   Wasser/Lava  ist kein Untergrund
  //   Felsformation ist ein Hindernis (Nutzerwunsch "Kollisionskontrolle")
  //   Standfläche eines Hausbildes: dort verschwände die Figur hinter der
  //   Wand. Das EIGENE Gebäude (u.bld) ist ausgenommen - Planierer und
  //   Bauarbeiter arbeiten genau dort, und jede Fachkraft tritt dort heraus.
  gehbar(n, bld){
    const m=this.map, t=m.terr[n];
    if(t===TER.WATER || t===TER.LAVA) return false;
    if((m.obj[n]&127)===OBJ.ROCK) return false;
    if(this.unterHaus(n)){
      // STRASSEN durch den Hausschatten sind BEGEHBAR. Das Wegenetz fuehrt
      // voellig legal unter Hausbildern hindurch (Torstummel an jeder Tuer,
      // Bestandswege unter spaeter gebauten Haeusern), und Traeger laufen
      // dort seit jeher. Fuer FREI laufende Figuren war derselbe Knoten
      // gesperrt - wessen Route (flagWaypoints!) ueber so einen Knoten
      // fuehrte, der keilte davor ein und kam erst mit der Geduld-Notbremse
      // (WEG_GEDULD*2 = 6 min) frei. Gemessen (Saat 3001, Stufe 2, KD1):
      // JEDER spaetere KI-Militaerposten wartete uniform ~375 s auf seinen
      // Planierer; alle Haenger vibrierten vor demselben Strassenknoten im
      // Schatten eines Nachbarhauses (road:true, gehbar:false). Das war
      // auch das vom Nutzer beobachtete "Haengenbleiben an einer Stelle".
      if(this.strassenKnoten().has(n)) return true;
      const b=(bld!=null)? this.buildings.get(bld) : null;
      if(!b || !this.imBild(b,n)) return false;
    }
    return true;
  }
  // Alle Knoten, die auf einer LANDstrasse liegen, als Menge - gehbar()
  // fragt das im heissesten Pfad ab (Kollisions-Sonden je Figur und Takt),
  // und roadAt() scannt dafuer zu teuer alle Strassen linear. Der Cache
  // haengt am routeVer, der bei jeder Strassen-/Fahnenaenderung steigt.
  strassenKnoten(){
    if(this._strKn && this._strKnVer===this.routeVer) return this._strKn;
    const s=new Set();
    for(const r of this.roads.values()){ if(!r.isSea) for(const n of r.path) s.add(n); }
    this._strKn=s; this._strKnVer=this.routeVer;
    return s;
  }
  // Liegt n unter dem Bild GENAU dieses Gebäudes? Dieselbe Formel wie in
  // bauSchatten(), nur ohne Mengenaufbau - die Prüfung läuft pro Takt.
  imBild(b, n){
    const m=this.map, def=BLD[b.type]||{};
    const f=(this.bldFoot && this.bldFoot[b.type])
         || Game.FOOT[b.type==='hq'?'hq':(def.size||'M')] || Game.FOOT.M;
    const [bx,by]=m.worldPos(b.node), [nx,ny]=m.worldPos(n);
    return Math.abs(nx-bx) < f[0]*0.40 && ny < by+14 && ny > by-f[1]*0.78;
  }
  // Führt die Luftlinie zum Ziel durch einen gesperrten Knoten? Wird nur
  // beim Zielwechsel gefragt (und gedrosselt), nicht in jedem Takt.
  wegVersperrt(u, tx, ty){
    const m=this.map;
    const d=Math.hypot(tx-u.x, ty-u.y);
    if(d<14) return false;
    const k=Math.min(24, Math.max(1, Math.round(d/22)));
    for(let s=1;s<=k;s++){
      const f=s/(k+1);
      const q=m.nearestNode(u.x+(tx-u.x)*f, u.y+(ty-u.y)*f);
      if(q>=0 && !this.gehbar(q,u.bld)) return true;
    }
    return false;
  }
  // Kürzester Fußweg über LAND-Knoten (BFS, begrenzt) - der Notausstieg,
  // wenn die gierige Luftlinie in moveToward nicht weiterkommt. Liefert
  // Weltpunkte oder null (Ziel unerreichbar/zu weit).
  landDetour(u, tx, ty, cap=700){
    const m=this.map;
    const from=m.nearestNode(u.x,u.y);
    let to=m.nearestNode(tx,ty);
    if(from<0 || to<0 || from===to) return null;
    // Dieselbe Regel wie beim lokalen Ausweichen (gehbar). Der Startknoten
    // zaehlt immer als begehbar - sonst haengt eine Figur fest, die aus
    // irgendeinem Grund auf einem Fels oder unter einem Haus steht.
    const fest=(n)=> n===from || this.gehbar(n, u.bld);
    if(!fest(to)){
      // ZIEL GESPERRT IST KEIN GRUND AUFZUGEBEN. Vorher hiess ein
      // unbegehbarer Zielknoten: gar keine Suche, null zurueck, und die
      // Figur rannte weiter lokal gegen ihr Hindernis. Nachgemessen war
      // das der Normalfall: von 15135 Umwegsuchen scheiterten 14667
      // (96,9 %) genau hier, und zwar praktisch immer aus demselben Grund
      // - der Zielknoten lag unter dem Bild eines FREMDEN Gebaeudes
      // (2071 von 2072 untersuchten Faellen). Bauplaetze liegen nun einmal
      // dicht bei bestehenden Haeusern.
      // WO das passiert: NICHT auf der langen Strecke. Planierer und
      // Bauarbeiter folgen sehr wohl der Strasse (gemessen bekommen 92,3
      // bzw. 99,5 Prozent beim Losschicken eine Route). Querfeldein laeuft
      // nur das letzte Stueck ab der Endfahne - im Schnitt 51 Pixel, also
      // etwa ein Knoten. Genau dieses letzte Stueck zielt aber auf den
      // Bauknoten, und der liegt zwischen den Bildern der Nachbarhaeuser.
      // Hinkommen genuegt: der naechstgelegene begehbare Nachbar des Ziels
      // tut es. Von dort ist der Rest Sache des lokalen Ausweichens.
      let ersatz=-1, bd=1e18;
      for(const n of m.nbs(to)){
        if(!fest(n)) continue;
        const [nx,ny]=m.worldPos(n);
        const dd=(nx-tx)*(nx-tx)+(ny-ty)*(ny-ty);
        if(dd<bd){ bd=dd; ersatz=n; }
      }
      if(ersatz<0 || ersatz===from) return null;
      to=ersatz;
    }
    const prev=new Map([[from,-1]]);
    const q=[from];
    let end=-1;
    for(let qi=0; qi<q.length && qi<cap; qi++){
      const cur=q[qi];
      if(cur===to){ end=cur; break; }
      for(const nb of m.nbs(cur)){
        if(prev.has(nb) || !fest(nb)) continue;
        prev.set(nb,cur); q.push(nb);
      }
    }
    if(end<0) return null;
    const nodes=[]; let c=end;
    while(c!==-1){ nodes.push(c); c=prev.get(c); }
    nodes.reverse();
    return nodes.slice(1).map(n=>m.worldPos(n));   // Startknoten weglassen
  }
  // ---------- Tür-Wege ----------
  // Türschwelle eines Gebäudes: der Punkt am Hauseingang, ein Stück vom
  // Hausknoten in Richtung Türfahne verschoben. ALLE Figuren betreten und
  // verlassen Gebäude über diesen Punkt – niemals mitten im Gebäude oder
  // seitlich durch die Wand.
  tuerPos(b){
    const m=this.map;
    const [bx,by]=m.worldPos(b.node);
    if(b.door==null || b.door<0 || !m.flag[b.door]) return [bx,by+10];
    const [fx,fy]=m.worldPos(b.door);
    return [bx+(fx-bx)*0.35, by+(fy-by)*0.35];
  }
  // Holt dieses Gebaeude ankommende Waren selbst von der Tuerfahne herein?
  // (Spielerwunsch R3 #125.) Lager (inv) und Militaer buchen weiter sofort
  // ein; ein Betrieb holt nur mit eingezogener Fachkraft und Tuerfahne.
  holtSelbst(b){
    return b.state==='done' && !!b.worker && !b.inv
        && b.door!=null && b.door>=0;
  }
  // TAKTKREDIT fuer jeden Gang der Fachkraft vor die Tuer.
  //
  // Solange die Fachkraft draussen ist, ruht die Arbeit im Haus
  // (tickProduction springt ueber den Betrieb). Diese Zeit ist reine
  // Wegzeit und darf die Ausbringung nicht druecken - sie wird deshalb dem
  // naechsten Zyklus gutgeschrieben. Frueher galt das nur fuer den Austrag;
  // der Einholgang aus v184 kostete Takte, ohne welche zurueckzugeben, und
  // hat Muehle und Baeckerei gemessen 12 bis 21 Prozent Ausstoss gekostet
  // (Muehle 6,6 -> 5,28, Baeckerei 6,6 -> 4,46 Stueck je Spielminute).
  //
  // Aufaddiert, nicht ueberschrieben: eine Baeckerei holt Mehl UND Wasser,
  // das sind zwei Gaenge je Zyklus. Gedeckelt auf zeit-1, damit ein Gang
  // niemals allein einen Zyklus fertigstellt.
  taktKredit(b, dauer){
    if(!(dauer>0)) return;
    const def=BLD[b.type];
    const zeit=def.prod? def.prod.time : def.time;
    if(!zeit) return;
    // dasselbe Tempo wie in tickProduction (v194: Essen ist Tempo)
    const satt=FOODS.some(f=>(b.stock[f]||0)>0);
    const schnell=satt && (def.mine || def.foodBoost || b.foodPrio);
    b.prodT=Math.min(zeit-1, (b.prodT||0) + dauer*(schnell?ESSEN_TEMPO:1));
  }
  // Der Bewohner holt eine wartende Ware von der Tuerfahne herein: Tuer ->
  // Fahne -> aufnehmen -> Tuer -> einbuchen. Spiegelbild des Austrags;
  // derselbe Waechter (nach 300 Takten wird von Hand eingebucht).
  tickEinhol(u){
    const b=this.buildings.get(u.bld);
    if(!b || b.state!=='done'){ u.dead=true; return; }
    const m=this.map;
    if(this.t-(u._t0||this.t)>300){
      if(u.carry){ this.deliver(b, u.carry); u.carry=null; }
      u.dead=true;
      if(b.worker && b.worker.state==='austrag') b.worker.state='in';
      this.taktKredit(b, this.t-(u._t0||this.t));
      return;
    }
    if(u.state==='zurFahne'){
      const [fx,fy]=m.worldPos(b.door);
      if(this.moveToward(u,fx,fy,WALK_SPEED)){
        const items=this.flagItems.get(b.door)||[];
        const ix=items.findIndex(it=>it.wartet && it.destB===b.id);
        if(ix>=0){ u.carry=items[ix].good; items.splice(ix,1); }
        u.state='zurTuer';
      }
    } else if(u.state==='zurTuer'){
      const [tx,ty]=this.tuerPos(b);
      if(this.moveToward(u,tx,ty,WALK_SPEED)){
        if(u.carry){ this.deliver(b, u.carry); u.carry=null; }
        u.dead=true;
        if(b.worker && b.worker.state==='austrag') b.worker.state='in';
        // Wegzeit zurueckgeben (siehe taktKredit) - der Holgang darf die
        // Ausbringung nicht druecken.
        this.taktKredit(b, this.t-(u._t0||this.t));
      }
    }
  }
  // Startfelder für eine Figur, die aus einem Gebäude tritt: Position an der
  // Türschwelle, Blick Richtung Türfahne (nicht rückwärts durch die Wand).
  tuerAustritt(b){
    const [sx,sy]=this.tuerPos(b);
    const o={x:sx, y:sy};
    if(b.door!=null && b.door>=0){
      const [fx,fy]=this.map.worldPos(b.door);
      const d=Math.hypot(fx-sx,fy-sy)||1;
      o._dx=(fx-sx)/d; o._dy=(fy-sy)/d;
    }
    return o;
  }

  // ---------- Warenaustrag: fertige Ware sichtbar zur Türfahne tragen ----------
  // Die Fachkraft eines Innenberufs (Bäcker, Schmied, Müller, Bergmann ...)
  // tritt mit der fertigen Ware aus der Tür, trägt sie zur Fahne, legt sie
  // dort ab (erst DANN ist sie für Träger abholbar) und verschwindet wieder
  // durch die Tür. Der Weg wird beim Wiedereintritt als Taktkredit in die
  // Zykluszeit eingerechnet – die Produktionsrate bleibt dadurch stabil.
  wareAustragen(b){
    const g=this.prodGood(b);
    if(!g || b.door==null || b.door<0){        // Notfall (keine Türfahne): wie früher direkt bereitstellen
      b.out=Math.min(6,(b.out||0)+1); this.onProduce && this.onProduce(b); return;
    }
    this.units.push({ id:NEXT_ID++, type:'austrag', player:b.player, bld:b.id,
      ...this.tuerAustritt(b), wtype:PROF_OF[b.type]||'worker', carry:g,
      state:'zurFahne', _t0:this.t });
    if(b.worker) b.worker.state='austrag';
  }
  tickAustrag(u){
    const b=this.buildings.get(u.bld);
    if(!b || b.state!=='done'){ u.dead=true; return; }
    const m=this.map;
    // Waechter: bleibt die Austragsfigur haengen (Tuerfahne unerreichbar, Weg
    // durch einen Neubau verstellt), stand der ganze Betrieb bisher bis
    // Spielende still - gemessen 15.000 Ticks bei einem KI-Saegewerk. Der
    // Waechter in tickProduction greift dort nicht: er prueft nur, ob die
    // Figur FEHLT, nicht ob sie feststeckt. Der Austrag dauert normal wenige
    // Dutzend Ticks; nach 300 wird er von Hand abgeschlossen.
    if(this.t-(u._t0||this.t) > 300){
      if(u.carry){                       // Ware war noch nicht abgelegt
        b.out=Math.min(6,(b.out||0)+1);
        this.onProduce && this.onProduce(b);
        u.carry=null;
      }
      u.dead=true;
      if(b.worker && b.worker.state==='austrag') b.worker.state='in';
      return;
    }
    if(u.state==='zurFahne'){
      const [fx,fy]=m.worldPos(b.door);
      if(this.moveToward(u,fx,fy,WALK_SPEED)){
        // Ware an der Fahne abgelegt – JETZT ist sie für Träger abholbar
        b.out=Math.min(6,(b.out||0)+1);
        this.onProduce && this.onProduce(b);
        u.carry=null; u.state='zurTuer';
      }
    } else if(u.state==='zurTuer'){
      const [tx,ty]=this.tuerPos(b);
      if(this.moveToward(u,tx,ty,WALK_SPEED)){
        u.dead=true;
        if(b.worker && b.worker.state==='austrag') b.worker.state='in';
        const def=BLD[b.type];
        // Schmieden wählen ihren nächsten Ausstoß am ZYKLUSBEGINN – der liegt
        // jetzt beim Wiedereintritt (b.prodT startet gleich mit Kredit > 0,
        // die alte prodT===0-Wahl käme sonst nie mehr zum Zug).
        if(b.type==='toolsmith'){
          b.chosenTool = b.makeGood || this.toolsmithChoose(b.player);
          if(!b.chosenTool){ b.prodT=0; return; }   // kein Bedarf -> ruhen wie bisher
        }
        if(b.type==='armory'){
          b.chosenTool = b.makeGood || this.armoryChoose(b.player);
          if(!b.chosenTool){ b.prodT=0; return; }   // alle Waffen gesättigt -> ruhen
        }
        // Zykluszeit-Kompensation: der Austragsweg zählt als bereits
        // geleistete Arbeitszeit des nächsten Zyklus (Rate bleibt stabil)
        this.taktKredit(b, this.t-(u._t0||this.t));
      }
    }
  }

  tickWorker(u){
    const m=this.map;
    const b=this.buildings.get(u.bld);
    if(!b){ u.dead=true; return; }
    const [tx,ty]=m.worldPos(u.target);
    if(u.state==='go'){
      if(u.jobKind==='hunt'){
        // dem lebenden Tier nachpirschen, auf Schussweite herangehen
        const a=this.animalById(u.animalId);
        if(!a){ u.state='back'; return; }
        const d=Math.hypot(a.x-u.x, a.y-u.y);
        if(d<=55){ u.state='act'; u.actT=0; }
        else this.moveToward(u, a.x, a.y, WALK_SPEED);
      }
      else if(this.moveToward(u,tx,ty,WALK_SPEED)) { u.state='act'; u.actT=0; }
      // WÄCHTER gegen versandete Aufträge.
      //
      // Gemessen im Testlauf: ein Förster hing 18.622 Ticks (rund 69 Minuten)
      // im Zustand 'go', weil sein Pflanzziel UNTER dem gezeichneten Bild der
      // Burg lag - als Ziel gültig, aber nicht betretbar und ohne Landweg.
      // moveToward liefert dann für immer false, und weil die Zielsuche stets
      // den ERSTEN Treffer nimmt, wählte er nach jedem Neuanlauf denselben
      // toten Knoten. Das Gebäude zeigte dabei durchgehend "In Betrieb".
      //
      // Deshalb: kommt eine Figur ihrem Ziel lange nicht näher, wird der
      // Auftrag abgebrochen, die Reservierung gelöst und der Knoten FÜR DIESES
      // GEBÄUDE gesperrt - sonst liefe sie sofort wieder hinein.
      u.goT=(u.goT||0)+1;
      const dz=Math.hypot(tx-u.x, ty-u.y);
      if(u.goBest===undefined || dz<u.goBest-2){ u.goBest=dz; u.goT=0; }
      if(u.goT>600){
        if(u.target>=0 && (m.obj[u.target]&128)) m.obj[u.target]&=127;   // Reservierung lösen
        // Sperrliste als EINFACHES Objekt Knoten -> Tick, nicht als Set:
        //  - ein Set wird von JSON.stringify zu {} - nach Speichern und Laden
        //    flog hier "b.tabu.has is not a function", das Spiel war hin.
        //  - der Zeitstempel laesst die Sperre ABLAUFEN. Vorher galt sie
        //    ewig: ein Knoten, der einmal blockiert war (Figur im Weg,
        //    Baustelle daneben), blieb es fuer die Lebensdauer des Gebaeudes,
        //    auch wenn dort laengst wieder ein Baum stand.
        if(!b.tabu || typeof b.tabu!=='object' || b.tabu instanceof Set) b.tabu={};
        b.tabu[u.target]=this.t;
        const ks=Object.keys(b.tabu);
        if(ks.length>24){
          let aeltest=ks[0];
          for(const k of ks) if(b.tabu[k]<b.tabu[aeltest]) aeltest=k;
          delete b.tabu[aeltest];
        }
        // Die Fachkraft ist ein DATENSATZ am Gebäude, nicht diese Figur -
        // sie wird zurück ins Haus gesetzt, damit der Betrieb weiterläuft.
        if(b.worker) b.worker.state='in';
        u.dead=true;
        return;
      }
    } else if(u.state==='act'){
      u.actT++;
      const done=(need)=>u.actT>=need;
      const un=(o)=>o&127;
      switch(u.jobKind){
        case 'chop':
          if(done(28)){
            if(un(m.obj[u.target])===OBJ.TREE){ m.obj[u.target]=OBJ.NONE; this.changedNodes.push(u.target); u.carry='trunk'; }
            u.state='back';
          }
          break;
        case 'plant':
          // Der Förster setzt je Gang ZWEI Setzlinge (Kritikbericht: einer
          // je Gang glich nicht einmal einen einzigen Holzfäller aus).
          if(u.actT===16){
            if(m.obj[u.target]===OBJ.NONE){ m.obj[u.target]=OBJ.SAPLING; m.amt[u.target]=0; this.changedNodes.push(u.target); }
            const zweit=m.nbs(u.target).find(n=> m.obj[n]===OBJ.NONE && m.terr[n]===TER.GRASS
              && m.bld[n]<0 && !m.flag[n] && m.owner[n]===b.player && !this.roadAt(n));
            if(zweit!==undefined) u.zweit=zweit; else u.state='back';
          } else if(done(30)){
            if(u.zweit!==undefined && m.obj[u.zweit]===OBJ.NONE){ m.obj[u.zweit]=OBJ.SAPLING; m.amt[u.zweit]=0; this.changedNodes.push(u.zweit); }
            u.state='back';
          }
          break;
        case 'pick':
          if(done(30)){
            if(un(m.obj[u.target])===OBJ.STONE && m.amt[u.target]>0){
              m.amt[u.target]--; u.carry='stone';
              if(m.amt[u.target]<=0){ m.obj[u.target]=OBJ.NONE; this.changedNodes.push(u.target); }
              else m.obj[u.target]=OBJ.STONE; // Reservierung lösen
            }
            u.state='back';
          }
          break;
        case 'fish':
          if(done(36)){ const wn=u.jobKindData??null; // gespeichert unten
            const w=m.nbs(u.target).find(n=>m.terr[n]===TER.WATER&&m.fish[n]>0);
            if(w!==undefined){
              m.fish[w]--; u.carry='fish';
              const [wx,wy]=m.worldPos(w);
              this.fx.push({type:'splash', x:wx, y:wy, t0:this.t});   // Platscher beim Fang
            }
            u.state='back'; }
          break;
        case 'hunt':
          if(done(24)){
            const a=this.animalById(u.animalId);
            if(a && Math.hypot(a.x-u.x,a.y-u.y)<=80){
              // Pfeilschuss aufs Wild – Treffer bringt Fleisch
              this.fx.push({type:'arrow', x0:u.x, y0:u.y-10, x1:a.x, y1:a.y-3, t0:this.t, hit:true});
              this.animals=this.animals.filter(q=>q.id!==a.id);
              u.carry='meat';
              this.onVolley && u.player===0 && this.onVolley(u.x, u.y);
            } else if(a) a.hunted=false;   // entwischt -> wieder freigeben
            u.state='back';
          }
          break;
        case 'sow':
          if(done(20)){
            if(m.obj[u.target]===OBJ.NONE){
              m.obj[u.target]=OBJ.FIELD0;
              m.amt[u.target]=0;                    // Felduhr beginnt bei Null
              if(!this.felder) this.felderSammeln();
              this.felder.add(u.target);
              this.changedNodes.push(u.target);
            }
            u.state='back';
          }
          break;
        case 'harvest':
          if(done(24)){ if(m.obj[u.target]===OBJ.FIELD2){ m.obj[u.target]=OBJ.NONE; this.changedNodes.push(u.target); u.carry='grain'; } u.state='back'; }
          break;
      }
      if(u.state==='back' && (u.jobKind==='chop'||u.jobKind==='pick')) m.obj[u.target]&=127;
      // rhythmisches Arbeitsgeräusch (Hacken, Klopfen, ...) solange gearbeitet wird
      if(u.state==='act' && u.actT%11===1 && b.player===0) this.onWorkerAct && this.onWorkerAct(u);
    } else if(u.state==='back'){
      // mit Beute geht es erst zur Türfahne: dort wird die Ware abgelegt
      // (erst DANN ist sie für Träger abholbar), danach zurück durch die Tür
      if(u.carry && b.door!=null && b.door>=0){
        const [fx,fy]=m.worldPos(b.door);
        if(this.moveToward(u,fx,fy,WALK_SPEED)){
          b.out=Math.min(6,(b.out||0)+1);
          u.carry=null; u._abT=this.t; u.state='heim';
        }
      } else {
        const [hx,hy]=this.tuerPos(b);
        if(this.moveToward(u,hx,hy,WALK_SPEED)){
          if(u.carry){ b.out=Math.min(6,(b.out||0)+1); }   // Notfall: Gebäude ohne Türfahne
          u.dead=true;
          if(b.worker){ b.worker.state='in'; b.worker.timer=0; }
        }
      }
    } else if(u.state==='heim'){
      // von der Fahne zurück zur Tür, dort verschwindet die Figur im Haus
      const [hx,hy]=this.tuerPos(b);
      if(this.moveToward(u,hx,hy,WALK_SPEED)){
        u.dead=true;
        if(b.worker){
          b.worker.state='in';
          // Fahnenweg in die Zykluszeit einrechnen: der Rückweg von der
          // Fahne zählt als bereits gewartete Suchzeit (Rate bleibt stabil)
          b.worker.timer=Math.min((BLD[b.type].time*0.4)|0, this.t-(u._abT||this.t));
        }
      }
    }
  }
  tickSoldierMove(u){
    const m=this.map;
    const b=this.buildings.get(u.targetB);
    if(!b || b.state!=='done' || !b.soldiers){ // Gebäude weg -> zurück ins HQ (Reserve)
      u.dead=true; this.players[u.player].recruits[u.stype]++; return;
    }
    const [tx,ty]=this.tuerPos(b);       // Einzug in den Posten durch die Tür
    if(this.moveToward(u,tx,ty,WALK_SPEED)){
      u.dead=true;
      const cap=BLD[b.type].mil.cap;
      if(b.soldiers.length<cap){
        b.soldiers.push(u.stype);
        // Erster Einzug: ab jetzt zählt der Posten zur Grenzberechnung
        if(!b.besetztWar && BLD[b.type].mil){ b.besetztWar=true; this.recalcTerritory(); }
      }
      else this.players[u.player].recruits[u.stype]++;
    }
  }
  returnSoldiers(pl, list){
    const r=this.players[pl].recruits;
    for(const t of list) r[t]=(r[t]||0)+1;
  }
  tickAttack(u){
    if(u.dead) return;                 // im selben Takt bereits verschmolzen
    const m=this.map;
    const target=this.buildings.get(u.targetB);
    // Ziel weg oder inzwischen in eigener Hand -> Gruppe kehrt heim
    // (löst sich auf, Soldaten zurück in die Reserve)
    if(!target || target.player===u.player){
      u.dead=true; this.returnSoldiers(u.player, u.soldiers); return;
    }
    const [tx,ty]=m.worldPos(target.node);
    if(u.state==='muster'){
      // Zum Sammelpunkt marschieren und dort auf die anderen Kontingente
      // desselben Angriffsbefehls warten (kleine Toleranz: "am Sammelpunkt"
      // heißt dicht dabei, nicht zentimetergenau darauf).
      if(!u.mArr && (this.moveToward(u, u.rx, u.ry, WALK_SPEED*ATK_MARCH)
                     || Math.hypot(u.x-u.rx, u.y-u.ry)<14)) u.mArr=true;
      const grp=this.units.filter(x=>x.type==='attack' && !x.dead && x.grp===u.grp);
      if(grp.every(x=>x.mArr) || this.t-(u.musterT||0)>MUSTER_WAIT){
        // Eingetroffene Kontingente verschmelzen zu EINER Angriffsgruppe und
        // schlagen gemeinsam zu; hängende Nachzügler (Engstelle, Umweg)
        // rücken nach dem Wartelimit einzeln nach, statt den Angriff ewig
        // aufzuhalten.
        const here=grp.filter(x=>x.mArr);
        const lead=here[0]||u;
        for(const x of here) if(x!==lead){ lead.soldiers.push(...x.soldiers); x.soldiers=[]; x.dead=true; }
        for(const x of grp) if(!x.dead && x.state!=='walk'){
          x.state='walk';
          const det=this.landDetour(x, tx, ty, 8000);   // Route für den Sturm
          if(det && det.length){ x._det=det; x._detTx=tx; x._detTy=ty; }
        }
      }
      return;
    }
    if(u.state==='walk'){
      // eigener Marsch-Faktor: Angriffsgruppen sind zügiger unterwegs als
      // Fachkräfte (der "stundenlange Anmarsch" aus dem Kritikbericht)
      if(this.moveToward(u,tx,ty,WALK_SPEED*ATK_MARCH)){
        // Baustellen werden niedergerissen, nicht erobert
        if(target.state==='build'){
          if(target.player===0) this.msg(`${BLD[target.type].name}-Baustelle vom Feind zerstört!`, 'war', target.node, 0, 'kampf');
          if(u.player===0) this.msg('Feindliche Baustelle zerstört!', 'ok', target.node, 0, 'kampf');
          this.burnBuilding(target, true, true);
          this.returnSoldiers(u.player, u.soldiers);
          u.dead=true;
          return;
        }
        u.state='fight';
        this.battles.push({ bldId:target.id, attPlayer:u.player, roundT:0, unitId:u.id });
        this.onBattleStart && this.onBattleStart(target);
      }
    }
    // 'fight' übernimmt tickBattles
  }
  // Überlegenheits-Dreieck: Schwert > Speer > Bogen > Schwert
  matchup(a,d){
    return (a==='sword'&&d==='spear')||(a==='spear'&&d==='bow')||(a==='bow'&&d==='sword') ? 0.08 : 0;
  }
  strongest(list){
    let best=null;
    for(const t of list) if(!best || STYPES[t].str>STYPES[best].str) best=t;
    return best;
  }
  // Pfeilsalve: jeder Bogenschütze trifft mit 18% einen zufälligen Gegner
  volley(archersN, killFn, from, to){
    let kills=0;
    for(let k=0;k<archersN;k++){
      const hit=this.rng()<0.18;
      this.fx.push({type:'arrow', x0:from[0]+(this.rng()*18-9), y0:from[1]-14,
        x1:to[0]+(this.rng()*16-8), y1:to[1]-6, t0:this.t, hit});
      if(hit && killFn()) kills++;
    }
    if(archersN>0) this.onVolley && this.onVolley(from[0],from[1]);
    return kills;
  }
  tickBattles(){
    for(const bt of this.battles){
      if(bt.doneFlag) continue;
      const u=this.units.find(x=>x.id===bt.unitId && x.type==='attack');
      if(!u){ bt.doneFlag=true; continue; }
      const b=this.buildings.get(bt.bldId);
      if(!b){ bt.doneFlag=true; u.dead=true; this.returnSoldiers(bt.attPlayer, u.soldiers); continue; }
      // Ziel inzwischen von der eigenen Seite erobert (zweite Gruppe traf
      // später ein): nicht gegen die eigene Besatzung kämpfen, sondern heim.
      if(b.player===bt.attPlayer){ bt.doneFlag=true; u.dead=true; this.returnSoldiers(bt.attPlayer, u.soldiers); continue; }
      bt.roundT++;
      if(bt.roundT<10) continue;
      bt.roundT=0;
      const pl=this.players[b.player];
      const militia=()=> b.type==='hq' ? this.recruitTotal(b.player) : 0;
      const defList=()=> (b.soldiers && b.soldiers.length) ? b.soldiers : null;
      // --- Fernkampfphase: Bogenschützen beider Seiten schießen ---
      const bPos=this.map.worldPos(b.node), uPos=[u.x,u.y];
      const atkBows=u.soldiers.filter(t=>t==='bow').length;
      this.volley(atkBows, ()=>{
        const dl=defList();
        const t2=dl&&dl.length? dl[0] : 'sword';
        if(dl){ dl.splice((this.rng()*dl.length)|0,1); }
        else if(militia()>0){ this.takeRecruit(b.player); }
        else return false;
        this.fx.push({type:'fallen', x:bPos[0]+(this.rng()*16-8), y:bPos[1]+11,
                      stype:t2, player:b.player, t0:this.t});
        return true;
      }, uPos, bPos);
      const defBows=(defList()||[]).filter(t=>t==='bow').length;
      this.volley(defBows, ()=>{
        if(!u.soldiers.length) return false;
        const ix=(this.rng()*u.soldiers.length)|0, t2=u.soldiers[ix];
        u.soldiers.splice(ix,1);
        this.fx.push({type:'fallen', x:u.x+(this.rng()*16-8), y:u.y+(this.rng()*8-4),
                      stype:t2, player:u.player, t0:this.t});
        u.hitT=this.t;
        return true;
      }, bPos, uPos);
      // --- Sieg/Niederlage nach der Salve? ---
      if(!u.soldiers.length){ bt.doneFlag=true; u.dead=true; continue; }
      if(!defList() && militia()<=0){
        // Jubel der Sieger vor dem eroberten Gebäude
        for(let k=0;k<Math.min(3,u.soldiers.length);k++)
          this.fx.push({type:'cheer', x:bPos[0]-10+k*10, y:bPos[1]+13, stype:u.soldiers[k],
                        player:bt.attPlayer, t0:this.t});
        this.captureBuilding(b, bt.attPlayer, u.soldiers);
        bt.doneFlag=true; u.dead=true;
        continue;
      }
      // --- Nahkampf: stärkster Angreifer gegen stärksten Verteidiger ---
      const atkT=this.strongest(u.soldiers);
      let defT, defMilitia=false;
      const dl=defList();
      if(dl) defT=this.strongest(dl);
      else {
        defT=STYPE_LIST.find(t=>pl.recruits[t]>0);
        defMilitia=true;
      }
      let p=0.5 + (STYPES[atkT].str-STYPES[defT].str)*0.09
            + this.matchup(atkT,defT) - this.matchup(defT,atkT)
            - 0.06*Math.min(b.coins||0,2);   // Sold: Münzen stärken die Verteidiger
      // Heimvorteil am Hauptquartier: die Miliz verteidigt ihre Mauern
      // verbissen. Ohne den Malus konnte eine glückliche 2-Mann-Sondierung
      // eine volle Miliz niederkämpfen und das HQ schleifen – das Spielende
      // gehört einem entschiedenen Sturm, nicht einem Würfelglücks-Trupp.
      if(b.type==='hq') p-=0.12;
      this.onClash && this.onClash(b);
      if(this.rng()<clamp(p,0.12,0.88)){
        if(defMilitia) pl.recruits[defT]--;
        else dl.splice(dl.indexOf(defT),1);
        // Gefallener Verteidiger vor dem Tor, Angreifer treffen
        this.fx.push({type:'fallen', x:bPos[0]+(this.rng()*16-8), y:bPos[1]+11+(this.rng()*6-3),
                      stype:defT, player:b.player, t0:this.t});
        b.hitT=this.t;
      } else {
        u.soldiers.splice(u.soldiers.indexOf(atkT),1);
        this.fx.push({type:'fallen', x:u.x+(this.rng()*16-8), y:u.y+(this.rng()*8-4),
                      stype:atkT, player:u.player, t0:this.t});
        u.hitT=this.t;
      }
    }
    this.battles=this.battles.filter(bt=>!bt.doneFlag);
  }
  captureBuilding(b, byPl, attackers){
    const oldPl=b.player;
    if(b.type==='hq'){
      // HQ wird niedergebrannt
      this.burnBuilding(b);
      this.returnSoldiers(byPl, attackers);
      if(byPl===0) this.msg('Feindliches Hauptquartier gefallen!', 'ok', -1, 0, 'ziel');
      this.checkPlayerDefeat(oldPl);
      return;
    }
    b.player=byPl;
    // Merkmal fuer das Missionsziel 'capture' (R9). Es bleibt am Gebaeude
    // haengen, auch wenn es spaeter wieder verloren geht - erobert war es.
    if(byPl===0) b.erobert=true;
    b.coins=0; b.incoming={};
    const cap=BLD[b.type].mil.cap;
    b.soldiers=attackers.slice(0,cap);
    b.besetztWar=true;               // Eroberer übernehmen mit Besatzung
    this.returnSoldiers(byPl, attackers.slice(cap));
    if(byPl===0) this.msg(`${BLD[b.type].name} erobert!`, 'ok', b.node, 0, 'kampf');
    if(oldPl===0) this.msg(`${BLD[b.type].name} an den Feind verloren!`, 'war', b.node, 0, 'kampf');
    this.recalcTerritory();
    this.onCapture && this.onCapture(b);
  }

  // ---------- Militärverwaltung ----------
  tickMilitary(){
    if(this.t%25!==0) return;
    for(const p of this.players){
      if(p.defeated) continue;
      // Rekrutierung im HQ: Bier + Waffe(n) -> Soldat des jeweiligen Typs
      // Schwertkämpfer: Schwert+Schild | Speerkämpfer: Speer | Bogenschütze: Bogen
      const hq=this.buildings.get(p.hq);
      if(hq && hq.inv){
        let guard=30;
        // Kritik R3 S2: die Rekrutierung frass jeden Bogen sofort weg -
        // der wartende Jaeger ging trotz Bogen-Nachschub leer aus (22 min
        // Stillstand im Messlauf). Existiert ein Jaeger, der sein Werkzeug
        // noch nicht hat, bleibt EIN Bogen im Hauptquartier fuer ihn liegen.
        // Kritik R4 S1: das Tabu galt nur fuer FERTIGE Jaegerhaeuser. Bier
        // liegt aber ab Takt 0 im Lager, und ein Jaegerhaus braucht Minuten
        // bis zur Fertigstellung - bis dahin hatte die Rekrutierung die drei
        // Startboegen laengst verbraucht. Gemessen wartete der Jaeger danach
        // 30 Spielminuten (Meldung 6x bzw. 15x je Saat), weil Nachschub nur
        // aus der Waffenschmiede kommt und die Eisen braucht. Ein Bogen wird
        // deshalb schon reserviert, sobald das Haus IM BAU ist.
        let bogenTabu=0;
        for(const b9 of this.buildings.values())
          if(b9.player===p.id && TOOL_OF[b9.type]==='bow' && !b9.toolGood
             && (b9.state==='done' || b9.state==='build')){ bogenTabu=1; break; }
        while(this.recruitTotal(p.id)<10 && (hq.inv.beer||0)>0 && guard-->0){
          // ausgewogen rekrutieren: den Typ mit der kleinsten Reserve zuerst
          const canDo=STYPE_LIST.filter(t=>{
            for(const w in STYPES[t].weapons)
              if((hq.inv[w]||0)-(w==='bow'? bogenTabu:0)<STYPES[t].weapons[w]) return false;
            return true;
          });
          if(!canDo.length) break;
          canDo.sort((a,b)=>(p.recruits[a]||0)-(p.recruits[b]||0));
          const t=canDo[0];
          hq.inv.beer--;
          for(const w in STYPES[t].weapons) hq.inv[w]-=STYPES[t].weapons[w];
          p.recruits[t]=(p.recruits[t]||0)+1;
          p._rekrutT=this.t;      // fuer den Bier-Tipp: die Kette LAEUFT
          this.onRecruit && p.id===0 && this.onRecruit();
        }
        // R3: Das Bier ist ein hartes Tor - ohne Bier kein Rekrut, egal wie
        // viele Waffen im Lager liegen. Gemessen ueber fuenf Saaten und 20
        // Spielminuten haengt die Rekrutierung zu 12,2 % der Militaertakte
        // am Bier und zu 0,0 % an den Waffen; die Waffen sind also NIE die
        // Bremse. Das Tor selbst bleibt (so macht es das Vorbild auch), aber
        // es war unsichtbar: Waffen im Lager, Reserve nicht voll, und nichts
        // sagte einem, woran es liegt. Jetzt sagt es einer - hoechstens alle
        // 3000 Takte, damit es keine Dauerbeschwerde wird.
        // Kritik R2 S2: der Tipp kam 7x in 35 Minuten, obwohl zwei
        // Brauereien liefen - das Bier wird oft im selben Takt verbraucht,
        // in dem es ankommt (Lagerstand 0 heisst NICHT Kette kaputt).
        // Solange in den letzten 5 Minuten ein Rekrut entstand, schweigt
        // der Tipp: die Kette arbeitet sichtbar.
        if(p.id===0 && this.recruitTotal(p.id)<10 && !(hq.inv.beer>0)
           && this.t-(p._rekrutT||-1e9)>3000){
          const waffeDa=((hq.inv.sword||0)>0&&(hq.inv.shield||0)>0)
                        ||(hq.inv.spear||0)>0||(hq.inv.bow||0)>0;
          if(waffeDa && this.t-(p._bierMsgT||-9999)>3000){
            p._bierMsgT=this.t;
            // KD4: mit Handlungsanleitung statt blosser Feststellung - je
            // nachdem, welches Glied der Bierkette wirklich fehlt.
            let tipp='baue eine Brauerei';
            for(const b2 of this.buildings.values()){
              if(b2.player!==0 || b2.type!=='brewery') continue;
              tipp = b2.state==='build'
                ? 'die Brauerei ist noch im Bau'
                : 'die Brauerei braucht Getreide (Bauernhof) und Wasser (Brunnen)';
              break;
            }
            this.msg(`Waffen liegen bereit, aber es fehlt das Bier – ${tipp}, sonst gibt es keine Rekruten.`,
                     'warn', hq.node, 0, 'wirtschaft');
          }
        }
      }
      // Besatzung auffüllen (gemischte Trupps: stärkste Reserve zuerst)
      if(this.recruitTotal(p.id)>0){
        const milB=[...this.buildings.values()].filter(b=>b.player===p.id && b.soldiers && b.state==='done' && b.type!=='hq');
        if(p.ai){
          // KI: erst LEERE Posten (Grenze wächst erst mit dem Einzug), dann
          // die dem Feind nächsten voll auffüllen. Gleichverteilung ließ an
          // der Front nie genug Überschuss für einen Angriff zusammenkommen
          // (KI-Passivität auf mittleren/großen Karten, Kritikbericht F5).
          const eHqs=this.players.filter(q=>q.id!==p.id && !q.defeated)
            .map(q=>this.buildings.get(q.hq)).filter(Boolean);
          const dE=new Map();
          const dEnemy=(b)=>{
            let d=dE.get(b.id);
            if(d===undefined){
              d=1e9;
              for(const eh of eHqs)
                d=Math.min(d, Math.hypot(this.map.X(eh.node)-this.map.X(b.node), this.map.Y(eh.node)-this.map.Y(b.node)));
              dE.set(b.id,d);
            }
            return d;
          };
          // Erst Posten, die NIE besetzt waren (erst der Einzug verschiebt
          // die Grenze), danach strikt die dem Feind nächsten – auch halb
          // geleerte Frontposten. Vorher rangierte jeder leere Hinterland-
          // Neubau vor der ausgedünnten Front: die kam nie wieder auf
          // Angriffsstärke und die KI fand trotz Dutzender Posten nie ein
          // Angriffsfenster (Kalter-Krieg-Symptom, F3).
          milB.sort((a,b)=> (a.besetztWar?1:0)-(b.besetztWar?1:0) || dEnemy(a)-dEnemy(b));
        } else {
          milB.sort((a,b)=> (a.soldiers.length/BLD[a.type].mil.cap) - (b.soldiers.length/BLD[b.type].mil.cap));
        }
        for(const b of milB){
          if(this.recruitTotal(p.id)<=0) break;
          const cap=Math.min(BLD[b.type].mil.cap, b.garrison??BLD[b.type].mil.cap);
          const enroute=this.units.filter(u=>u.type==='soldierMove'&&u.targetB===b.id).length;
          if(b.soldiers.length+enroute<cap){
            const t=this.takeRecruit(p.id);
            if(!t) break;
            const src=hq||b;
            // der Rekrut marschiert aus der Tür seines Quartiers ab – mit
            // vorausberechneter Landroute: die gierige Luftlinie blieb an
            // Buchten hängen, ferne Frontposten wurden NIE aufgefüllt (und
            // der hängende Marsch blockierte als "unterwegs" den Nachschub)
            const u={id:NEXT_ID++, type:'soldierMove', player:p.id, ...this.tuerAustritt(src), targetB:b.id, stype:t};
            const [tx2,ty2]=this.tuerPos(b);
            const det=this.landDetour(u, tx2, ty2, 30000);
            if(det && det.length){ u._det=det; u._detTx=tx2; u._detTy=ty2; }
            this.units.push(u);
          }
        }
      }
    }
  }

  // ---------- Einzug & Flucht der Fachkräfte ----------
  tickSettle(u){
    const b=this.buildings.get(u.bld);
    if(!b || b.state!=='done' || !b.worker){
      // Ziel weg -> Fachkraft kehrt um und bringt ihr Werkzeug zurück
      u.type='flee'; u.bld=undefined;
      return;
    }
    if(!this.routeStep(u,WALK_SPEED)) return;        // erst der Straße folgen
    const [tx,ty]=this.tuerPos(b);                   // Einzug IMMER durch die Tür
    if(this.moveToward(u,tx,ty,WALK_SPEED)){
      u.dead=true;
      b.worker.present=true;
    }
  }
  tickFlee(u){
    const hq=this.buildings.get(this.players[u.player].hq);
    if(!hq){ u.dead=true; return; }
    const [tx,ty]=this.tuerPos(hq);                  // ins HQ geht es durch die Tür
    if(this.moveToward(u,tx,ty,WALK_SPEED*1.15)){
      u.dead=true;
      if(u.tool && hq.inv) hq.inv[u.tool]=(hq.inv[u.tool]||0)+1;   // Werkzeug gerettet
    }
  }

  // ---------- Späher: erkundet den Nebel rund um eine Fahne ----------
  callScout(pl, flagNode){
    if(!this.map.flag[flagNode]) return false;
    const hq=this.buildings.get(this.players[pl].hq);
    this.units.push({ id:NEXT_ID++, type:'scout', player:pl,
      ...this.tuerAustritt(hq||{node:flagNode}),     // aus der HQ-Tür treten
      flag:flagNode, legs:9, state:'toFlag', target:-1 });
    return true;
  }
  tickScout(u){
    const m=this.map;
    if(u.state==='toFlag'){
      const [tx,ty]=m.worldPos(u.flag);
      if(this.moveToward(u,tx,ty,WALK_SPEED*1.1)) u.state='seek';
    } else if(u.state==='seek'){
      if(u.legs<=0){ u.state='home'; return; }
      // Ziel wählen: bevorzugt unerkundete Knoten in der Umgebung
      const base=m.nearestNode(u.x,u.y);
      let best=-1, bs=-1;
      for(let k=0;k<14;k++){
        const cand=this.nodesInRange(base, 7)[(this.rng()*this.nodesInRange(base,7).length)|0];
        if(cand==null) continue;
        if(m.terr[cand]===TER.WATER||m.terr[cand]===TER.LAVA) continue;
        let s=this.rng();
        if(!m.explored[cand]) s+=2;
        if(s>bs){ bs=s; best=cand; }
      }
      if(best<0){ u.state='home'; return; }
      u.target=best; u.legs--; u.state='walk';
    } else if(u.state==='walk'){
      const [tx,ty]=m.worldPos(u.target);
      if(this.moveToward(u,tx,ty,WALK_SPEED*1.1)) u.state='seek';
    } else if(u.state==='home'){
      const hq=this.buildings.get(this.players[u.player].hq);
      const [tx,ty]=hq? this.tuerPos(hq):[u.x,u.y];  // heim durch die HQ-Tür
      if(this.moveToward(u,tx,ty,WALK_SPEED*1.1)) u.dead=true;
    }
  }

  // ---------- Esel: verstärken die meistbefahrene Straße ----------
  donkeyTargetRoad(pl){
    let best=null, bt=5;   // erst ab spürbarem Verkehr
    for(const r of this.roads.values()){
      if(r.player!==pl || r.isSea || r.hasDonkey || r.donkeyEnroute) continue;
      if((r.traffic||0)>bt){ bt=r.traffic; best=r; }
    }
    return best;
  }
  spawnDonkey(b){
    const r=this.donkeyTargetRoad(b.player);
    if(!r) return;
    // der Esel verlässt den Stall durch die Tür
    const u={ id:NEXT_ID++, type:'donkey', player:b.player, ...this.tuerAustritt(b), road:r.id };
    r.donkeyEnroute=u.id;
    this.units.push(u);
    if(b.player===0) this.msg('Ein Esel verstärkt eine Straße.', 'ok', b.node, 0, 'wirtschaft');
  }
  tickDonkey(u){
    const r=this.roads.get(u.road);
    if(!r){ u.dead=true; return; }
    const mid=r.path[(r.path.length/2)|0];
    const [tx,ty]=this.map.worldPos(mid);
    if(this.moveToward(u,tx,ty,WALK_SPEED)){
      u.dead=true;
      r.donkeyEnroute=null;
      r.hasDonkey=true;
    }
  }

  // ---------- Seefahrt: Werft baut Schiffe, Schiffe verbinden Häfen ----------
  harborsOf(pl){
    return [...this.buildings.values()].filter(b=>b.player===pl && b.type==='harbor' && b.state==='done');
  }
  seaLinked(a,b){
    for(const r of this.roads.values())
      if(r.isSea && ((r.path[0]===a.door&&r.path[r.path.length-1]===b.door)
        ||(r.path[0]===b.door&&r.path[r.path.length-1]===a.door))) return true;
    return false;
  }
  shipNeeded(pl){
    const hs=this.harborsOf(pl);
    for(let i=0;i<hs.length;i++) for(let j=i+1;j<hs.length;j++)
      if(!this.seaLinked(hs[i],hs[j])) return true;
    return false;
  }
  // Wasserweg zwischen zwei Häfen (BFS über Wasserknoten; Start/Ziel ist
  // das Wasser rund um Hafengebäude UND Türfahne)
  seaPath(harborA, harborB){
    const m=this.map;
    const doorA=harborA.door, doorB=harborB.door;
    const waterAround=(b)=>{
      const s=new Set();
      for(const base of [b.node, b.door])
        for(const n of m.nbs(base)) if(m.terr[n]===TER.WATER) s.add(n);
      return s;
    };
    const prev=new Map();
    const q=[];
    for(const n of waterAround(harborA)){ prev.set(n,-1); q.push(n); }
    const goal=waterAround(harborB);
    let end=-1;
    for(let qi=0; qi<q.length && qi<4000; qi++){
      const n=q[qi];
      if(goal.has(n)){ end=n; break; }
      for(const nn of m.nbs(n)){
        if(m.terr[nn]!==TER.WATER || prev.has(nn)) continue;
        prev.set(nn,n); q.push(nn);
      }
    }
    if(end<0) return null;
    const path=[end];
    let cur=end;
    while(prev.get(cur)!==-1){ cur=prev.get(cur); path.unshift(cur); }
    return [doorA, ...path, doorB];
  }
  launchShip(sy){
    const hs=this.harborsOf(sy.player);
    let best=null, bd=1e9;
    for(let i=0;i<hs.length;i++) for(let j=i+1;j<hs.length;j++){
      if(this.seaLinked(hs[i],hs[j])) continue;
      const d=Math.hypot(this.map.X(hs[i].node)-this.map.X(hs[j].node),
        this.map.Y(hs[i].node)-this.map.Y(hs[j].node));
      if(d<bd){ bd=d; best=[hs[i],hs[j]]; }
    }
    if(!best) return;
    const path=this.seaPath(best[0], best[1]);
    if(!path){ if(sy.player===0) this.msg('Werft: kein Seeweg zwischen den Häfen gefunden.', 'warn', sy.node, 0, 'wirtschaft'); return; }
    const r={ id:NEXT_ID++, player:sy.player, path, isSea:true,
      carrier:{ pos:0, state:'idle', item:null, job:null } };
    this.roads.set(r.id, r);
    this.routeVer++;
    if(sy.player===0) this.msg('Ein Schiff nimmt den Seeweg zwischen zwei Häfen auf!', 'ok', sy.node, 0, 'wirtschaft');
    this.onShip && this.onShip(sy);
  }

  // ---------- Fußweg entlang des Straßennetzes (Bauarbeiter, Planierer, Einzug) ----------
  // Liefert Weltpunkte entlang der Straßen von Fahne zu Fahne – oder null,
  // wenn die Ziele nicht verbunden sind (dann Luftlinie wie bisher).
  flagWaypoints(fromFlag, toFlag){
    if(fromFlag==null || toFlag==null || fromFlag<0 || toFlag<0) return null;
    if(fromFlag===toFlag) return [];
    if(this.compOf(fromFlag)===undefined || this.compOf(fromFlag)!==this.compOf(toFlag)) return null;
    const wp=[]; let f=fromFlag; let guard=80;
    while(f!==toFlag && guard-->0){
      const rid=this.nextRoad(f, toFlag);
      if(rid==null) return null;
      const r=this.roads.get(rid);
      if(!r || r.isSea) return null;
      let pathNodes=r.path;
      if(pathNodes[0]!==f) pathNodes=[...pathNodes].reverse();
      if(pathNodes[0]!==f) return null;
      for(let k=1;k<pathNodes.length;k++) wp.push(this.map.worldPos(pathNodes[k]));
      f=r.path[0]===f? r.path[r.path.length-1] : r.path[0];
    }
    return f===toFlag? wp : null;
  }
  // Route abarbeiten; true, wenn alle Wegpunkte erreicht sind
  routeStep(u, speed){
    if(u.wp && (u.wpi||0)<u.wp.length){
      const [tx,ty]=u.wp[u.wpi||0];
      if(this.moveToward(u,tx,ty,speed)) u.wpi=(u.wpi||0)+1;
      return (u.wpi||0)>=u.wp.length;
    }
    return true;
  }

  // ---------- Werkzeuge: aus Lagern oder direkt vom Ausstoß der Werkzeugschmiede ----------
  findToolStore(pl, good){
    for(const b of this.buildings.values()){
      if(b.player!==pl || b.state!=='done') continue;
      if(b.inv && (b.inv[good]||0)>0) return b;
      if(b.out>0 && this.prodGood(b)===good) return b;
    }
    return null;
  }
  takeTool(store, good){
    if(store.inv && (store.inv[good]||0)>0) store.inv[good]--;
    else if(store.out>0) store.out--;
  }
  // Warum kommt kein Werkzeug? Fuer die Wartemeldung (Kritik R3 S2): der
  // blosse Dauerton "wartet auf Werkzeug" nannte nie den behebbaren Grund -
  // im Messlauf stand der Jaeger 22 Minuten, weil die Werkzeugschmiede kein
  // Eisen hatte, und die Meldung liess einen raten.
  werkzeugUrsache(pl){
    let schmiede=null;
    for(const b of this.buildings.values())
      if(b.player===pl && b.type==='toolsmith' && b.state==='done'){ schmiede=b; break; }
    if(!schmiede) return ' Es gibt keine Werkzeugschmiede.';
    const imHaus=(schmiede.stock && (schmiede.stock.iron||0))||0;
    if(imHaus<=0 && (this.invTotal(pl).iron||0)<=0)
      return ' Der Werkzeugschmiede fehlt Eisen.';
    return '';
  }
  // Welches Werkzeug fehlt am dringendsten? (null = alles ausreichend vorhanden)
  toolsmithChoose(pl){
    const need={ hammer:2, shovel:2, pick:2 };            // Grundreserve; Rest 1
    for(const t of TOOLS) need[t]=need[t]||1;
    // Kritik R2 S4: der Jagdbogen kam NUR aus der Waffenschmiede, und dort
    // frisst die Rekrutierung jeden Bogen sofort weg - der Jaeger stand im
    // Messlauf 25 Minuten still ("wartet auf Werkzeug (Bogen)!" im
    // Dauerton). Wartet ein Jaeger, darf die Werkzeugschmiede einen Bogen
    // fertigen; ohne wartenden Jaeger bleibt der Bedarf 0, kein Eisen
    // wandert in Bogen-Vorraete (Militaerbögen bleiben Sache der
    // Waffenschmiede).
    need.bow=0;
    for(const b of this.buildings.values()){
      if(b.player!==pl) continue;
      if(b.state==='build') need[b.leveled?'hammer':'shovel']+=1;
      else if(b.state==='done' && b.worker && !b.worker.present && !b.toolGood){
        const t=TOOL_OF[b.type];
        if(t && need[t]!==undefined) need[t]+=2;          // wartendes Gebäude drängt
      }
    }
    const inv=this.invTotal(pl);
    let best=null, bs=0;
    for(const t of (need.bow>0? [...TOOLS,'bow'] : TOOLS)){
      // R6: Deckel je Werkzeug. Der Bedarf waechst mit jeder Baustelle
      // (+1 Hammer je Stelle, +2 je wartendem Haus) und kannte nach oben
      // keine Grenze - gemessen lagen deshalb 138 Haemmer und 89
      // Spitzhacken im Lager, obwohl nie mehr als ein Dutzend gebraucht
      // wurde. Ueber der Saettigungsschwelle wird das Werkzeug nicht mehr
      // gewaehlt; die Schmiede sucht sich ein anderes oder ruht.
      const deckel=SAT_OF[t]!==undefined? SAT_OF[t] : SAT_PAUSE;
      if((inv[t]||0)>=deckel) continue;
      const short=need[t]-(inv[t]||0);
      if(short>bs){ bs=short; best=t; }
    }
    return best;
  }
  // Welche Waffe fehlt am dringendsten? (null = alle Vorräte gesättigt).
  // Gegenstück zu toolsmithChoose: die knappste Waffe zuerst, Waffen über
  // ihrer Sättigungsschwelle (SAT_OF) werden nicht mehr gewählt. So bleibt
  // die Rekrutierung versorgt (Schwert+Schild gleichen sich von selbst aus),
  // ohne dass Eisen und Kohle in einen endlosen Waffenberg wandern.
  armoryChoose(pl){
    const inv=this.invTotal(pl);
    let best=null, bn=1e9;
    for(const w of ['sword','shield','spear','bow']){
      const deckel=SAT_OF[w]!==undefined? SAT_OF[w] : SAT_PAUSE;
      const n=inv[w]||0;
      if(n>=deckel) continue;
      if(n<bn){ bn=n; best=w; }
    }
    return best;
  }
  // Einzug der Fachkraft anstoßen: ggf. Werkzeug aus einem Lager mitnehmen.
  // Liefert false, wenn das nötige Werkzeug fehlt (Gebäude wartet dann sichtbar).
  trySettle(b){
    if(!b.worker || b.worker.present) return true;
    if(b.settlerId!=null && this.units.some(u=>u.id===b.settlerId)) return true;
    b.settlerId=null;
    const hq=this.buildings.get(this.players[b.player].hq);
    if(!hq){ b.worker.present=true; return true; }
    const tool=TOOL_OF[b.type];
    if(tool && !b.toolGood){
      const src=this.findToolStore(b.player, tool);
      if(src) this.warnGeloest(b, 'tool:'+tool);
      if(!src){
        // Warnung nur bei echtem Mangel (nichts im Lager, nichts unterwegs);
        // solange der Mangel anhält, erinnert warn() einmal pro Minute daran
        // statt wie früher nur ein einziges Mal (leicht zu übersehen).
        if(this.toolTrulyMissing(b.player, tool))
          this.warn(b, 'tool:'+tool,
            `${BLD[b.type].name}: wartet auf Werkzeug (${GOODS[tool].name})!${this.werkzeugUrsache(b.player)}`);
        b.needTool=tool;
        return false;
      }
      this.takeTool(src, tool);
      b.toolGood=tool;                       // Werkzeug gehört jetzt zum Gebäude
      b.needTool=null;
    }
    // der neue Siedler tritt aus der HQ-Tür
    const u={ id:NEXT_ID++, type:'settle', player:b.player,
      ...this.tuerAustritt(hq), bld:b.id, wtype:PROF_OF[b.type]||'worker', tool:b.toolGood||null,
      wp:this.flagWaypoints(hq.door, b.door)||undefined, wpi:0 };
    this.units.push(u);
    b.settlerId=u.id;
    return true;
  }
  tickBuilderSpawn(){
    for(const b of this.buildings.values()){
      // fertige Gebäude, die noch auf Werkzeug für ihre Fachkraft warten
      if(b.state==='done' && b.worker && !b.worker.present){ this.trySettle(b); continue; }
      if(b.state!=='build') continue;
      // Phase 1: Planierer (freie Figur + Schaufel) ebnet den Bauplatz
      // Kein "continue" mehr ans Ende: der Bauarbeiter unten wird JETZT
      // SCHON losgeschickt und laeuft, waehrend der Planierer graebt.
      // Vorher liefen beide Wege nacheinander - und das ist teuer, denn das
      // Graben selbst dauert nur 70 Takte, der Weg vom Lager zur Baustelle
      // ein Vielfaches. Nachgemessen ging die Lebenszeit einer Baustelle zu
      // 38,1 Prozent fuer die Planierer-Phase und noch einmal zu 15,9
      // Prozent fuer den Hinweg des Bauarbeiters drauf - zweimal dieselbe
      // Strecke hintereinander. Gebaut wurde in 9,2 Prozent der Zeit.
      // Gehaemmert wird trotzdem erst nach dem Ebnen (siehe
      // tickConstruction), die Reihenfolge im Bild bleibt also: erst
      // Planierer, dann Bauarbeiter, dann Baustellenbild.
      if(!b.leveled && !(b.levelerId!=null && this.units.some(u=>u.id===b.levelerId))){
        b.levelerId=null;
        // WER NICHTS ZU EBNEN HAT, MUSS AUCH NICHT LOS. Vorher lief immer
        // ein Planierer hinaus, grub feste 70 Takte und ging heim - auch
        // wenn planiere() danach keinen einzigen Knoten anfasste. Und wer
        // wenig zu tun hat, graebt jetzt kurz statt voll.
        // Ehrlich zur Groessenordnung: gemessen ueber 280 Baustellen ist
        // der Platz nur in 0,7 Prozent der Faelle schon eben, der Median
        // des noetigen Hubs liegt bei 0,524 von 0,85. Der Sprung nach Hause
        // bleibt also die Ausnahme; die kuerzere Grabzeit trifft dagegen
        // fast jede Baustelle (im Mittel rund zwei Drittel der alten Zeit).
        const bedarf=this.planierBedarf(b);
        if(bedarf<Game.PLAN_EGAL){ b.leveled=true; b.grabZeit=0; continue; }
        // Grabzeit im Verhaeltnis zur Arbeit, mit Untergrenze - unter ~2
        // Sekunden liest sich das Graben nicht mehr als Arbeit, sondern als
        // Zucken.
        b.grabZeit=Math.max(20, Math.round(70*bedarf/Game.PLAN_MAX));
        const hq=this.buildings.get(this.players[b.player].hq);
        const src=hq && this.findToolStore(b.player,'shovel');
        if(hq && !src && this.toolTrulyMissing(b.player,'shovel')){
          // nur bei ECHTEM Mangel warnen (keine Schaufel im Lager UND keine
          // unterwegs) und entdoppelt – siehe warn()/toolTrulyMissing()
          this.warn(b,'shovel','Baustelle wartet: keine Schaufel für den Planierer!');
        }
        if(hq && src){
          this.takeTool(src,'shovel');
          // Er tritt aus DEM Lager, aus dem die Schaufel kommt. Vorher nahm
          // er sie aus src, lief aber immer vom Hauptquartier los - lag die
          // Schaufel in einem Lagerhaus nahe der Baustelle, wanderte sie
          // unsichtbar quer ueber die Karte und der Planierer nahm trotzdem
          // den langen Weg. Der Bauarbeiter unten macht es seit jeher richtig.
          const u={ id:NEXT_ID++, type:'leveler', player:b.player, ...this.tuerAustritt(src),
            bld:b.id, state:'toSite', pt:0,
            wp:this.flagWaypoints(src.door, b.door)||undefined, wpi:0 };
          this.units.push(u);
          b.levelerId=u.id;
        }
      }
      // Phase 2: Bauarbeiter mit Hammer
      if(b.builderId!=null && this.units.some(u=>u.id===b.builderId)) continue;
      b.builderId=null;
      // Der Hammer wird erst gebunden, wenn wenigstens EIN Stueck Baumaterial
      // an der Baustelle liegt. Vorher zog jede frisch planierte Baustelle
      // sofort einen Hammer aus dem Lager, auch wenn nie ein Brett kam:
      // gemessen fraßen 10 leere Baustellen alle 10 Hämmer des Startbestands,
      // danach ließ sich gar nichts mehr bauen. Zurueck kommt der Hammer erst
      // bei Fertigstellung oder Abriss.
      {
        const d0=BLD[b.type];
        const braucht=(d0.cost.board||0)+(d0.cost.stone||0);
        if(braucht>0 && ((b.stock.board||0)+(b.stock.stone||0))===0) continue;
      }
      const src=this.findToolStore(b.player,'hammer');
      if(!src){
        if(this.toolTrulyMissing(b.player,'hammer'))
          this.warn(b,'hammer','Baustelle wartet: kein Hammer für den Bauarbeiter!');
        continue;                              // kein Hammer -> kein Bauarbeiter
      }
      this.takeTool(src,'hammer');
      const u={ id:NEXT_ID++, type:'builder', player:b.player, ...this.tuerAustritt(src),
        bld:b.id, state:'toSite', pt:0, swing:0,
        wp:this.flagWaypoints(src.door, b.door)||undefined, wpi:0 };
      this.units.push(u);
      b.builderId=u.id;
    }
  }
  // Der Planierer EBNET jetzt wirklich (Nutzerwunsch v98: "die planierer
  // sollen das gelände anpassen so dass dort ein bergwerk gebaut werden
  // kann"). Bis hierher war b.leveled nur ein Haken - das Gelände blieb, wie
  // es war, und ein Haus am Hang stand danach genauso schief wie vorher.
  // Geebnet wird der Bauknoten mit seinen sechs Nachbarn auf eine gemeinsame
  // Höhe, aber GEDECKELT: höchstens PLAN_MAX je Knoten. Ein Planierer trägt
  // eine Schaufel, keinen Bagger, und ein unbegrenztes Einebnen würde
  // Strassen, Grenzen und Nachbargebäude mitreissen.
  // Ausgenommen bleiben Wasser/Lava (kein Untergrund) und Knoten, auf denen
  // ein ANDERES Gebäude steht - das würde sonst mitwandern.
  // Wie viel Hoehe muesste hier bewegt werden? Gibt den GROESSTEN Hub an
  // einem der sieben Knoten zurueck (Bauknoten plus Nachbarn), gedeckelt wie
  // in planiere(). Steht als eigene Rechnung da, weil zwei Fragen daran
  // haengen: ob der Planierer ueberhaupt losmuss, und wie lange er graebt.
  // Der Schwellwert PLAN_EGAL ist derselbe, mit dem planiere() unten einen
  // Knoten in Ruhe laesst - so koennen die beiden nicht auseinanderlaufen.
  static PLAN_MAX=0.85;
  static PLAN_EGAL=0.03;
  // KD1: ab diesem Takt (Minute 20) schaltet eine KI ab Stufe NORMAL ohne
  // Feindkontakt in den Vorstoss-Modus - Militaerposten ruecken dann gezielt
  // auf das naechste Feind-HQ zu statt gestreut zu wachsen.
  static VORSTOSS_AB=12000;
  planierBedarf(b){
    const m=this.map;
    const nb=m.nbs(b.node);
    const fest=(q)=> m.terr[q]!==TER.WATER && m.terr[q]!==TER.LAVA
                  && !(m.bld[q]>=0 && m.bld[q]!==b.id);
    let s=m.hgt[b.node], n=1;
    for(const q of nb) if(fest(q)){ s+=m.hgt[q]; n++; }
    const ziel=m.hgt[b.node]*0.55+(s/n)*0.45;
    let groesst=0;
    for(const q of [b.node,...nb]){
      if(!fest(q)) continue;
      const d=Math.max(-Game.PLAN_MAX, Math.min(Game.PLAN_MAX, ziel-m.hgt[q]));
      if(Math.abs(d)>groesst) groesst=Math.abs(d);
    }
    return groesst;
  }
  planiere(b){
    const m=this.map;
    const PLAN_MAX=Game.PLAN_MAX;
    const nb=m.nbs(b.node);
    const fest=(q)=> m.terr[q]!==TER.WATER && m.terr[q]!==TER.LAVA
                  && !(m.bld[q]>=0 && m.bld[q]!==b.id);
    let s=m.hgt[b.node], n=1;
    for(const q of nb) if(fest(q)){ s+=m.hgt[q]; n++; }
    // Zielhöhe zwischen Bauknoten und Umgebung: der Platz sinkt/steigt
    // etwas, die Umgebung kommt ihm entgegen
    const ziel=m.hgt[b.node]*0.55+(s/n)*0.45;
    let dirty=false;
    const setz=(q)=>{
      if(!fest(q)) return;
      const d=Math.max(-PLAN_MAX, Math.min(PLAN_MAX, ziel-m.hgt[q]));
      if(Math.abs(d)<Game.PLAN_EGAL) return;
      m.hgt[q]+=d; dirty=true;
      this.hoehenNeu.push(q);
    };
    setz(b.node);
    for(const q of nb) setz(q);
    if(dirty) m.computePasses();     // steil/schachtOk/pass hängen an der Höhe
  }
  // Grabstellen des Planierers. Sie liegen auf ECHTEN Nachbarknoten des
  // Bauplatzes, ein Stück zum Haus hin gerückt - nur so stimmt die HÖHE.
  // Vorher waren es feste Pixelversätze der Hausposition; am Hang stand der
  // Planierer damit in der Luft oder im Fels (Nutzerurteil v95: "der
  // planierer rennt ohne höhenbezug zur baustelle"). Bevorzugt werden die
  // Knoten der unteren Reihen: dort ist vor dem Haus, nicht dahinter.
  levelSpots(b){
    const m=this.map;
    const [bx,by]=m.worldPos(b.node);
    const nb=m.nbs(b.node).filter(n=>this.gehbar(n, b.id));
    const vorn=nb.filter(n=>m.Y(n)>m.Y(b.node));
    const wahl=(vorn.length>=2? vorn : (nb.length? nb : [])).slice(0,4);
    if(!wahl.length) return [[bx-5,by+13]];
    return wahl.map(n=>{
      const [nx,ny]=m.worldPos(n);
      return [nx+(bx-nx)*0.35, ny+(by-ny)*0.35];
    });
  }
  tickLeveler(u){
    const m=this.map;
    const b=this.buildings.get(u.bld);
    if(u.state!=='home' && (!b || b.state!=='build' || b.leveled)) u.state='home';
    if(u.state==='toSite'){
      // Die Uhr laeuft AB HIER, nicht erst nach routeStep: wer schon beim
      // Folgen der Strasse haengenbleibt, kam sonst nie bis zum
      // Geduldsfaden weiter unten. Nach dem ersten Anlauf blieben so noch
      // neun von elf Planierern im Hinweg stecken.
      u.stallT=(u.stallT||0)+1;
      if(u.stallT>WEG_GEDULD*2){ u.state='work'; b.levelT=0; u.stallT=0; }
      else if(!this.routeStep(u,WALK_SPEED)) return;  // erst der Straße folgen
      // Ziel ist die ERSTE Grabstelle, nicht der Hausknoten: der liegt am
      // Hang bis zu 40 px über dem begehbaren Grund davor.
      const [tx,ty]=this.levelSpots(b)[0];
      // Geduldsfaden: erreicht er den Punkt vor dem Haus trotz Nähe lange
      // nicht (Hindernis-Ausweichen lenkt ab), fängt er dort an, wo er steht.
      // Das Ebnen hängt nicht am exakten Punkt - ewiges Herumtippeln fiele
      // dagegen sofort auf.
      // GEDULDSFADEN OHNE NAEHE-BEDINGUNG. Vorher lief die Uhr erst, wenn
      // der Planierer schon unter 80 px am Ziel war. Wer nie in diese
      // Naehe kam, lief unbegrenzt weiter - und weil sein Bauplatz erst
      // nach dem Ebnen gebaut werden darf, stand die Baustelle fuer immer.
      // Nachgemessen nach 45 Spielminuten: 42 lebende Planierer, davon 20
      // seit ueber 15 Spielminuten auf dem Hinweg, KEIN EINZIGER am
      // Graben - bei 126 bis 154 px Restentfernung und stallT=0, die Uhr
      // hatte also nie zu ticken begonnen. Das ist die Ursache dafuer,
      // dass die Siedlung ab Minute 25 nicht mehr waechst.
      // Jetzt zaehlt die Zeit im Hinweg IMMER. Wer nicht ankommt, faengt
      // an, wo er steht - geebnet wird ohnehin der Bauknoten, nicht die
      // Stelle, auf der die Figur zufaellig steht.
      const nah=Math.hypot(tx-u.x, ty-u.y)<80;
      if(this.moveToward(u,tx,ty,WALK_SPEED) || (nah && u.stallT>60) || u.stallT>WEG_GEDULD){
        u.state='work'; b.levelT=0; u.stallT=0;
      }
    } else if(u.state==='work'){
      // Stellen VOR dem Bauplatz (nie durch das Gebäude). An jeder wird
      // eine Weile GEGRABEN, erst dann geht es zur nächsten. Vorher lief der
      // Planierer den Bogen pausenlos ab - das sah aus, als tanzte er um
      // seine Schaufel, und die Grab-Animation kam nie zum Zug.
      const spots=this.levelSpots(b);
      const [tx,ty]=spots[u.pt%spots.length];
      if(!u.atSpot){
        // auch hier: lieber an Ort und Stelle graben als endlos tänzeln
        u.stallT=(u.stallT||0)+1;
        if(this.moveToward(u,tx,ty,WALK_SPEED*0.5) || u.stallT>30){ u.atSpot=true; u.stallT=0; }
        return;
      }
      b.levelT=(b.levelT||0)+1;
      if(b.levelT%22===3) this.onLevel && this.onLevel(u);
      if(b.levelT%24===23){ u.pt++; u.atSpot=false; }    // weiter zur nächsten Stelle
      if(b.levelT>=(b.grabZeit||70)){ b.leveled=true; this.planiere(b); u.atSpot=false; u.state='home'; }
    } else if(u.state==='home'){
      const hq=this.buildings.get(this.players[u.player].hq);
      if(!hq){ u.dead=true; return; }
      if(!u._homeWp){
        u._homeWp=true;
        u.wp=(b && this.map.flag[b.door] ? this.flagWaypoints(b.door, hq.door) : null)||[];
        u.wpi=0;
      }
      // Auch der Heimweg braucht eine Uhr: gemessen hingen 22 von 42
      // Planierern auf dem Rueckweg fest und hielten ihr Werkzeug
      // fuer immer. Wer nicht heimfindet, gibt es trotzdem ab - sonst
      // versickert das Werkzeug still aus der Wirtschaft.
      u.heimT=(u.heimT||0)+1;
      if(!this.routeStep(u,WALK_SPEED) && u.heimT<WEG_GEDULD) return;
      const [tx,ty]=this.tuerPos(hq);                    // heim durch die HQ-Tür
      if(this.moveToward(u,tx,ty,WALK_SPEED) || u.heimT>WEG_GEDULD){
        u.dead=true;
        if(hq.inv) hq.inv.shovel=(hq.inv.shovel||0)+1;   // Schaufel zurück ins Lager
      }
    }
  }
  tickBuilder(u){
    const m=this.map;
    const b=this.buildings.get(u.bld);
    // Baustelle weg oder fertig -> heim ins Hauptquartier.
    // DER HAMMER GEHT SOFORT ZURUECK, nicht erst nach dem Heimweg. Vorher
    // blieb er die ganze Rueckreise gebunden - bei einer Siedlung, die
    // staendig baut, hing damit ein guter Teil des Werkzeugbestands
    // dauerhaft an Figuren, die nur noch nach Hause laufen. Der Mann
    // laeuft weiter heim (er gehoert ins Bild), aber ohne Werkzeug.
    if(u.state!=='home' && (!b || b.state!=='build')){
      u.state='home';
      if(!u.werkzeugAb){
        const lager=this.buildings.get(this.players[u.player].hq);
        if(lager && lager.inv) lager.inv.hammer=(lager.inv.hammer||0)+1;
        u.werkzeugAb=true;
      }
    }
    if(u.state==='toSite'){
      // GEDULDSFADEN WIE BEIM PLANIERER. Hier stand bisher gar keiner: ein
      // Bauarbeiter, der seine Baustelle nicht erreicht, lief unbegrenzt
      // weiter, und weil ohne ihn kein Takt Fortschritt zaehlt, stand das
      // Haus fuer immer bei null Prozent. Genau so sahen die
      // Dauerbaustellen aus: 33 von 36 bei null, mit Material, Platz und
      // zugeteiltem Bauarbeiter.
      u.stallT=(u.stallT||0)+1;
      if(u.stallT>WEG_GEDULD*2){ u.state='work'; u.pt=0; b.bauerDa=true; u.stallT=0; }
      else if(!this.routeStep(u,WALK_SPEED)) return;  // erst der Straße folgen
      const [tx,ty]=m.worldPos(b.node);
      // erst mit der Ankunft des Bauarbeiters erscheint das Baustellenbild
      if(this.moveToward(u,tx+10,ty+13,WALK_SPEED) || u.stallT>WEG_GEDULD){
        u.state='work'; u.pt=0; b.bauerDa=true; u.stallT=0;
      }
    } else if(u.state==='work'){
      // Am Gerüst wird STEHEND gehämmert. Erst nach einer Weile wechselt der
      // Bauarbeiter die Seite – vorher tänzelte er ununterbrochen ums Haus.
      const [bx,by]=m.worldPos(b.node);
      const spots=[[bx-16,by+12],[bx-5,by+16],[bx+6,by+16],[bx+16,by+12]];
      const [tx,ty]=spots[u.pt%spots.length];
      if(u.hammerT>0){
        u.hammerT--;                                  // steht und schlägt zu
        u.atSpot=true;
      } else if(this.moveToward(u,tx,ty,WALK_SPEED*0.55) || (u.stallT=(u.stallT||0)+1)>30){
        // angekommen - oder nach 3 s Tänzeln um ein Hindernis: dann wird
        // eben HIER gehämmert (Geduldsfaden wie beim Planierer)
        u.pt++;
        u.hammerT=60+((this.rng()*40)|0);              // ~6-10 s am selben Platz
        u.atSpot=true;
        u.stallT=0;
      } else u.atSpot=false;
      u.swing++;
      if(u.atSpot && u.swing%16===0){
        // Sichtbar geschlagen wird genau dann, wenn der Bau auch WIRKLICH
        // vorankommt. Vorher stand hier die alte Bedingung "Material
        // vollstaendig" - seit der Bau mit Teillieferungen weitergeht (R8),
        // haette der Bauarbeiter stumm dagestanden, waehrend die Baustelle
        // hinter ihm waechst.
        if(b.leveled && (b.progress||0) < this.bauGrenze(b).grenze){
          this.onHammer && this.onHammer(u);
          // Staub wirbelt bei jedem Schlag auf
          this.fx.push({type:'dust', x:u.x+(this.rng()*10-5), y:u.y+3, t0:this.t});
        }
      }
    } else if(u.state==='home'){
      const hq=this.buildings.get(this.players[u.player].hq);
      if(!hq){ u.dead=true; return; }
      if(!u._homeWp){
        u._homeWp=true;
        u.wp=(b && this.map.flag[b.door] ? this.flagWaypoints(b.door, hq.door) : null)||[];
        u.wpi=0;
      }
      // Auch der Heimweg braucht eine Uhr: gemessen hingen 22 von 42
      // Planierern auf dem Rueckweg fest und hielten ihr Werkzeug
      // fuer immer. Wer nicht heimfindet, gibt es trotzdem ab - sonst
      // versickert das Werkzeug still aus der Wirtschaft.
      u.heimT=(u.heimT||0)+1;
      if(!this.routeStep(u,WALK_SPEED) && u.heimT<WEG_GEDULD) return;
      const [tx,ty]=this.tuerPos(hq);                    // heim durch die HQ-Tür
      if(this.moveToward(u,tx,ty,WALK_SPEED) || u.heimT>WEG_GEDULD){
        u.dead=true;
        // Nur noch, wenn der Hammer nicht schon bei der Fertigstellung
        // zurueckging (z.B. Baustelle abgerissen, Figur unterwegs).
        if(hq.inv && !u.werkzeugAb) hq.inv.hammer=(hq.inv.hammer||0)+1;
      }
    }
  }

  // ---------- Ruinen zerfallen nach einer Weile, alte Effekte aufräumen ----------
  tickRuins(){
    if(this.t%50!==0) return;
    if(this.fx.length) this.fx=this.fx.filter(f=>this.t-f.t0<300);
    if(!this.ruins.length) return;
    this.ruins=this.ruins.filter(r=>{
      if(this.t-r.t0<1500) return true;
      if(this.map.obj[r.node]===OBJ.RUIN){ this.map.obj[r.node]=OBJ.NONE; this.changedNodes.push(r.node); }
      return false;
    });
  }

  // ---------- Missionsziele ----------
  checkObjectives(){
    if(this.over || !this.objectives.length) return;
    let all=true;
    for(const o of this.objectives){
      if(o.done){ continue; }
      switch(o.type){
        case 'build': {
          const n=[...this.buildings.values()].filter(b=>b.player===0&&b.type===o.bld&&b.state==='done').length;
          o.prog=n; o.done=n>=o.count; break;
        }
        case 'good': {
          const t=this.invTotal(0);
          o.prog=t[o.good]||0; o.done=o.prog>=o.count; break;
        }
        case 'soldiers': {
          o.prog=this.soldierCount(0); o.done=o.prog>=o.count; break;
        }
        case 'destroyEnemies': {
          const alive=this.players.filter(p=>p.id!==0&&!p.defeated).length;
          o.prog=this.players.length-1-alive; o.done=alive===0; break;
        }
        // R9: Acht der zehn Missionen endeten mit "besiege alle Gegner" -
        // die Geschichten sind verschieden, das Ziel war immer dasselbe.
        // Die drei Typen hier geben den Missionen ein eigenes Ende, ohne
        // dass eine davon unloesbar werden kann.
        case 'capture': {
          // Feindliche Militaergebaeude EROBERN statt niederbrennen.
          let n=0;
          for(const b of this.buildings.values()) if(b.player===0 && b.erobert) n++;
          o.prog=n;
          // Sicherheitsnetz: wer den Gegner lieber ganz ausloescht, statt zu
          // erobern, darf nicht in einer unloesbaren Mission stecken
          // bleiben - ohne lebende Feinde gibt es nichts mehr zu erobern.
          const lebt=this.players.some(p=>p.id!==0 && !p.defeated);
          o.done = n>=o.count || !lebt;
          break;
        }
        case 'defeatPlayer': {
          // Einen BESTIMMTEN Clan schlagen, nicht alle. o.wer ist der Name
          // aus der Missionstabelle.
          const ziel=this.players.find(p=>p.id!==0 && p.name===o.wer);
          o.done = !ziel || ziel.defeated;
          o.prog = o.done?1:0;
          break;
        }
        case 'survive': {
          // Sich o.count Spielminuten halten. 600 Takte = eine Spielminute.
          o.prog=Math.floor(this.t/600);
          o.done=o.prog>=o.count;
          break;
        }
        case 'occupy': {
          o.done = this.gate!=null && this.map.owner[this.gate]===0;
          o.prog=o.done?1:0; break;
        }
        case 'territory': {
          let n=0; const m=this.map;
          for(let i=0;i<m.owner.length;i++) if(m.owner[i]===0) n++;
          o.prog=n; o.done=n>=o.count; break;
        }
      }
      if(o.done) this.msg(`Ziel erreicht: ${o.desc}`, 'ok', -1, 0, 'ziel');
      if(!o.done) all=false;
    }
    if(all){ this.over=true; this.winner=0; }
    if(this.players[0].defeated){ this.over=true; this.winner=-2; }
  }

  // ================= KI =================
  tickAI(){
    const slot=Math.floor(this.t/10);        // wird 1x pro Sekunde aufgerufen
    for(const p of this.players){
      if(!p.ai || p.defeated) continue;
      if((slot+p.id)%3!==0) continue;        // jede KI ~alle 3s, gestaffelt
      this.aiStep(p);
    }
  }
  // Alle Gebaeude eines Spielers (fuer Planschwellen)
  aiBautenGesamt(p){
    let n=0; for(const b of this.buildings.values()) if(b.player===p.id) n++;
    return n;
  }
  // R4: Kennt die KI ueberhaupt ein Vorkommen, auf das sich dieses Bergwerk
  // stellen liesse? Gezaehlt wird nur im EIGENEN Gebiet - dort, wo ein
  // Bergwerk auch stehen koennte. Kurz gemerkt, der Scan laeuft ueber die
  // ganze Karte.
  aiErzBekannt(p, minetype){
    const ziel={coalmine:1, ironmine:2, goldmine:3, granitemine:4}[minetype];
    if(!ziel) return false;
    p._erzC=p._erzC||{}; p._erzT=p._erzT||{};
    if(this.t-(p._erzT[minetype]||-9999)<600) return !!p._erzC[minetype];
    const m=this.map;
    let da=false;
    for(let i=0;i<m.oreT.length && !da;i++)
      if(m.owner[i]===p.id && m.oreT[i]===ziel && m.oreA[i]>0) da=true;
    p._erzC[minetype]=da; p._erzT[minetype]=this.t;
    return da;
  }
  // DIE KI LEGT KONKURRENTEN VORUEBERGEHEND STILL (v206).
  //
  // Bisher war die einzige Antwort auf einen Engpass: MEHR BAUEN. Bei
  // Getreide ging das nach hinten los - der Schluessel aus v204 hob die
  // Bauernhoefe von drei auf fuenf bis sieben, und weil ein Hof gross ist,
  // drei Bretter und drei Steine kostet und Platz frisst, verdraengte er
  // genau die Betriebe, die das Getreide abnehmen sollten. Gemessen ueber
  // vier Saaten fiel das Bier von 74 auf 9, auf zwei Saaten stand am Ende
  // gar keine Brauerei mehr.
  //
  // Der billigere Weg ist, den Verbrauch umzulenken statt die Erzeugung
  // aufzublasen: fehlt Bier, ruhen die anderen Getreideabnehmer, bis wieder
  // welches da ist. Das kostet kein Brett und keinen Bauplatz, wirkt sofort
  // und ist rueckgaengig - genau das, was ein Mensch im Gebaeudemenue mit
  // dem Stilllegen-Knopf macht.
  //
  // Gestillgelegt wird nur, was die KI selbst stillgelegt hat (_kiPause) -
  // ein vom Spieler pausiertes Haus bleibt pausiert.
  aiEngpassSteuern(p){
    const inv=this.invCached(p.id);
    const g0=(k)=>inv[k]||0;
    const waffen=g0('sword')+g0('shield')+g0('spear')+g0('bow');
    const essen=g0('fish')+g0('bread')+g0('meat');
    // Ohne Bier kein Rekrut - egal wie viele Waffen im Lager liegen. Das ist
    // der teuerste Stillstand, den die Siedlung haben kann.
    const bierNot = waffen>0 && g0('beer')<3 && g0('grain')<8;
    for(const b of this.buildings.values()){
      if(b.player!==p.id || b.state!=='done') continue;
      let ruhen=false;
      if(bierNot){
        // Schweine- und Eselzucht sind Nebenketten - die duerfen immer warten.
        if(b.type==='pigfarm' || b.type==='donkeyfarm') ruhen=true;
        // Die Muehle nur, wenn die Siedlung satt ist: Brot ist Nahrung, und
        // eine hungernde Siedlung baut gar nichts mehr.
        else if(b.type==='mill' && essen>=10) ruhen=true;
      }
      if(ruhen && !b.paused){ b.paused=true; b._kiPause=true; }
      else if(!ruhen && b.paused && b._kiPause){ b.paused=false; b._kiPause=false; }
    }
  }

  // DIE KI STELLT IHRE TRANSPORT-RANGFOLGE NACH (v204).
  //
  // Der Mensch sortiert seine Rangfolge im Transportbildschirm selbst; die
  // KI fuhr bisher stur die Voreinstellung. Dort stehen Kohle und Eisenerz
  // auf Platz 11 und 12 - hinter der ganzen Nahrungskette. Gemessen (vier
  // Saaten, je 60 Spielminuten, ohne Materialhilfe) standen fertige
  // Eisenhuetten deshalb zu 100 Prozent OHNE BEIDES da, obwohl 84 Kohle und
  // 94 Erz gefoerdert worden und im Lager waren: die Auftragsvergabe hat je
  // Runde nur ein begrenztes Kontingent, und die Nahrung raeumte es ab.
  //
  // Jetzt zaehlt die KI alle zwei Spielminuten zusammen, was ihren Gebaeuden
  // JETZT fehlt - fehlende Eingaenge fertiger Betriebe, fehlendes
  // Baumaterial offener Baustellen, fehlendes Essen in Bergwerken - und
  // sortiert danach um. Waren mit gleichem Bedarf behalten ihre bisherige
  // Reihenfolge (die Sortierung ist stabil), es entsteht also kein Flattern.
  aiRangAnpassen(p){
    const bedarf={};
    const plus=(g,n)=>{ if(n>0) bedarf[g]=(bedarf[g]||0)+n; };
    for(const b of this.buildings.values()){
      if(b.player!==p.id) continue;
      const def=BLD[b.type];
      if(b.state==='build'){
        plus('board', (def.cost.board||0)-(b.stock.board||0)-(b.incoming.board||0));
        plus('stone', (def.cost.stone||0)-(b.stock.stone||0)-(b.incoming.stone||0));
        continue;
      }
      if(b.state!=='done' || b.inv) continue;
      if(def.prod) for(const g in def.prod.inputs)
        plus(g, def.prod.inputs[g]-(b.stock[g]||0)-(b.incoming[g]||0));
      // Bergwerke und Betriebe mit Essensbonus wollen Nahrung; welche,
      // entscheidet die Quelle - der Bedarf zaehlt auf alle drei.
      if((def.mine || def.foodBoost || b.foodPrio)
         && !FOODS.some(f=>(b.stock[f]||0)>0))
        for(const f of FOODS) plus(f, 1);
    }
    const alt=this.players[p.id].rang || RANG_STD;
    const neu=[...alt].sort((x,y)=>(bedarf[y]||0)-(bedarf[x]||0));
    this.setzeRang(p.id, neu);
  }

  // WELCHE HAELFTE FEHLT DER EISENHUETTE? (v197)
  //
  // Eine Huette braucht Erz UND Kohle zu gleichen Teilen. Gemessen ueber 35
  // Spielminuten (Stufe 2, mittlere Karte) erzeugte die KI:
  //   Saat 42:  66 Eisenerz,   0 Kohle  ->  0 Eisen
  //   Saat 99: 390 Eisenerz,  88 Kohle  -> 24 Eisen
  // Beide Huetten standen am Ende mit Erz im Haus und leerem Kohlefach, im
  // Lager 56-61 Erz gegen 0 Kohle. Die Ursache lag nicht am Vorkommen (auf
  // beiden Saaten lag Kohle im eigenen Gebiet, ein Bauplatz war da), sondern
  // an der Reihenfolge: Bergwerke stehen am Ende der Wunschliste, das
  // Kohlebergwerk noch hinter dem Eisenbergwerk. Bei knappen Brettern kam es
  // nie an die Reihe.
  //
  // Gezaehlt werden nur FERTIGE Bergwerke - eine Baustelle foerdert nichts.
  //
  // WIRKUNG, ueber sechs Saaten und je 35 Spielminuten gegen v196 gemessen
  // (Kohle-vor-Eisen-Reihenfolge und Nachschub fuers Engpass-Bergwerk
  // zusammen):
  //   Kohle  448 -> 691     Eisen 24 -> 66     Waffen 19 -> 37
  //   Land  1606 -> 1505    Bauten 35,3 -> 33,0
  //   Posten 11,7 -> 11,2   Soldaten 38,3 -> 34,2   Siedler 123 -> 112
  // Die Erzkette gewinnt also deutlich, die Siedlung verliert rund sechs bis
  // elf Prozent. Der Verlust ist NICHT belegt: bei sechs Saaten schwanken
  // einzelne Partien um mehr als die Haelfte in beide Richtungen (Saat 11
  // legte von 1163 auf 1919 Land zu, Saat 7 fiel von 1775 auf 950), und jede
  // Aenderung an der Baureihenfolge verschiebt den Zufallsstrom - dieselbe
  // Saat spielt danach eine voellig andere Partie. Wer den Verlust wirklich
  // beziffern will, braucht deutlich mehr Saaten.
  aiEngpassMine(p){
    if(this.aiCount(p,'smelter')<1) return null;
    const kohle=this.aiCount(p,'coalmine',false);
    const eisen=this.aiCount(p,'ironmine',false);
    if(kohle<eisen && this.aiErzBekannt(p,'coalmine')) return 'coalmine';
    if(eisen<kohle && this.aiErzBekannt(p,'ironmine')) return 'ironmine';
    // Gleichstand (meist beide bei null): ohne Kohle ist Erz wertlos, denn
    // Erz laesst sich lagern, die Huette ohne Kohle aber nicht betreiben.
    if(kohle===0 && this.aiErzBekannt(p,'coalmine')) return 'coalmine';
    return null;
  }
  // R4: Geologen losschicken. Ohne Erkundung kennt die KI nur, was zufaellig
  // im eigenen Gebiet liegt - Bergwerke entstanden entsprechend selten. Ab
  // Stufe 2 schickt sie regelmaessig einen Geologen an eine Fahne nahe am
  // Gebirge; er verbraucht eine Spitzhacke, gibt dem Werkzeugschmied also
  // nebenbei seine Daseinsberechtigung zurueck.
  aiGeologe(p, lvl){
    if(lvl<2) return false;
    if(this.t-(p.aiState.geoT||-9999)<1500) return false;
    p.aiState.geoT=this.t;
    if((this.invCached(p.id).pick||0)<1) return false;
    const m=this.map;
    // Fahne mit moeglichst viel unerkundetem Fels in der Naehe
    let best=-1, bs=0;
    for(const b of this.buildings.values()){
      if(b.player!==p.id || b.door==null || b.door<0) continue;
      let s2=0;
      for(const q of this.nodesInRange(b.door, 6))
        if(m.terr[q]===TER.MOUNT && !this.signs.has(q)) s2++;
      if(s2>bs){ bs=s2; best=b.door; }
    }
    if(best<0 || bs<3) return false;
    this.callGeologist(p.id, best);
    return true;
  }
  // Gesamtstaerke eines Spielers: Besatzungen, marschierende Trupps und
  // die Reserve im Hauptquartier.
  aiStaerke(p){
    let n=0;
    for(const b of this.buildings.values())
      if(b.player===p.id && b.soldiers) n+=b.soldiers.length;
    for(const u of this.units){
      if(u.dead || u.player!==p.id) continue;
      if(u.type==='attack' && u.soldiers) n+=u.soldiers.length;
      else if(u.type==='soldierMove') n++;
    }
    return n+this.recruitTotal(p.id);
  }
  // Militaerbedarf: feindliche Posten dicht an der eigenen Grenze (Druck)
  // plus ein Aufschlag, wenn im eigenen Gebiet kaum noch Bauplaetze frei
  // sind - dann ist ein neuer Posten das einzige Mittel, an Land zu kommen.
  // Kurz gemerkt; der Scan laeuft ueber alle Gebaeude.
  aiMilBedarf(p){
    if(this.t-(p._milBedT||-9999)<900) return p._milBedC||0;
    p._milBedT=this.t;
    const m=this.map;
    const eigen=[];
    for(const b of this.buildings.values())
      if(b.player===p.id && (b.soldiers||b.type==='hq')) eigen.push(b.node);
    let druck=0;
    for(const b of this.buildings.values()){
      if(b.player===p.id || b.player<0) continue;
      if(!(BLD[b.type].mil||b.type==='hq')) continue;
      for(const nd of eigen)
        if(Math.hypot(m.X(b.node)-m.X(nd), m.Y(b.node)-m.Y(nd))<14){ druck++; break; }
    }
    let frei=0;
    for(let i=0;i<m.owner.length && frei<4;i++)
      if(m.owner[i]===p.id && this.canBuild(p.id,'guardhouse',i).ok) frei++;
    p._milBedC=druck + (frei<3? 2 : 0);
    return p._milBedC;
  }
  // EIN TOTER BETRIEB IST KEIN BETRIEB (v212).
  //
  // Endgueltig tot ist nur, wo der Rohstoff NICHT nachwaechst: das Bergwerk
  // (oreA wird einmal bei der Kartenerzeugung gesetzt) und der Steinbruch
  // (Steine wachsen nicht nach). Baeume, Fisch und Wild erholen sich - ein
  // Holzfaeller oder Fischer mit b.exhausted ist nur gerade arbeitslos und
  // zaehlt weiter voll mit.
  // Beim Steinbruch reicht das exhausted-Flag als Todesurteil NICHT: es wird
  // schon nach 600 Takten ohne Auftrag gesetzt, und ein Auftrag kann auch
  // nur voruebergehend fehlen, weil ein Nachbar-Steinbruch den Brocken
  // gerade reserviert hat (Bit 128 in m.obj). Abgerissen wird deshalb erst,
  // wenn in Reichweite wirklich kein Fels mehr steht.
  totBetrieb(b){
    if(b.depleted) return true;                     // Bergwerk: Erz waechst nie nach
    const def=BLD[b.type];
    if(!b.exhausted || !def || def.gather!=='stone') return false;
    const un=(o)=>o&127;
    for(const n of this.nodesInRange(b.node, def.range||10))
      if(un(this.map.obj[n])===OBJ.STONE) return false;
    return true;
  }
  // GEMESSEN (Saat 99, Foerderring in Minute 11,9 geleert, 90 Spielminuten):
  // das erschoepfte Eisenbergwerk stand bis zum Schluss da, aiCount meldete
  // unveraendert 2 - genau das Soll -, und die KI baute in 77 Spielminuten
  // KEIN einziges Ersatzbergwerk, obwohl nur noch eines foerderte. Die Leiche
  // erfuellte das Ziel. Der Bergmann blieb dabei bis Minute 90 im toten Haus
  // gebunden ("besetzt: ja").
  //
  // Auf Saat 7 wurde trotzdem Ersatz gebaut - dort starb das Bergwerk in
  // Minute 8, als die Siedlung noch UNTER dem Soll lag. Die Sperre greift
  // also erst, sobald das Soll nominell erreicht ist; dann aber dauerhaft.
  aiCount(p, type, includeBuild=true){
    let n=0;
    for(const b of this.buildings.values())
      if(b.player===p.id && b.type===type && (includeBuild || b.state==='done')
         && !this.totBetrieb(b)) n++;
    return n;
  }
  aiStep(p){
    const m=this.map;
    const hq=this.buildings.get(p.hq);
    if(!hq) return;
    // TOTE BETRIEBE ABREISSEN (v212). Bisher gab es dafuer keinen Weg:
    // demolish() wurde einzig aus der Oberflaeche gerufen, die KI riss nie
    // etwas ab. Ein erschoepftes Bergwerk band deshalb bis Spielende einen
    // Bauplatz UND seine Fachkraft. Der Abriss erstattet die halben Baukosten
    // und macht beides wieder frei; die Spitzhacke ist zu diesem Zeitpunkt
    // laengst ins Lager zurueckgekehrt (v166).
    // Eines je Zug genuegt - die KI ist ohnehin alle drei Sekunden dran.
    for(const b of this.buildings.values()){
      if(b.player!==p.id || b.state!=='done' || !this.totBetrieb(b)) continue;
      this.demolish(b.id);
      break;
    }
    const inv=this.invTotal(p.id);
    const lvl=p.aiLevel;
    // KI-Bonus: leichte Materialhilfe je Level (hält das Spiel spannend, KI "mogelt" milde)
    const dm=Game.diffMods(this.difficulty);
    if(this.t-(p.aiState.lastBonus||0)>=600/dm.bonusMul && hq.inv){
      p.aiState.lastBonus=this.t;
      // BEDARFSDECKEL STATT DAUERTROPF.
      // Vorher legte diese Stelle bei JEDEM Takt feste Mengen ins Lager,
      // unabhaengig davon, ob die KI sie brauchte oder laengst selbst
      // herstellte. Nachgemessen (zwoelf Saaten, 30 Spielminuten, Stufe 2)
      // war das keine milde Nachhilfe, sondern der Boden, auf dem die KI
      // stand - und zwar an EINER Stelle:
      //             voll   ohne   nurBaustoff  nurMilitaer  nurWerkzeug
      //   Gebaeude   360    139       140          143          301
      //   Soldaten   344     77        82           98          101
      // Mit blossen Werkzeugen erreicht sie 301 von 360 Gebaeuden, mit
      // blossen Brettern und Steinen nur 140 - und hortet dabei 1329
      // Bretter, die sie mangels Hammer und Schaufel nicht verbauen kann.
      // Holz und Stein holt sie sich also selbst; was sie nicht kann, ist
      // ihre Leute ausruesten.
      // Deshalb ist die Hilfe jetzt ein BODEN, kein Zufluss: nachgelegt
      // wird nur, was unter die Schwelle gefallen ist. Laeuft die eigene
      // Werkzeugschmiede, bleibt der Bestand von selbst darueber und es
      // kommt gar nichts mehr - die Hilfe verschwindet, ohne dass sie
      // abgeschaltet werden muesste. Bricht die Kette weg, faengt sie
      // wieder auf.
      const HB=Game.AI_HILFE[lvl]||Game.AI_HILFE[2];
      const auf=(gut,bis)=>{ if((hq.inv[gut]||0)<bis) hq.inv[gut]=bis; };
      auf('board', HB.board); auf('stone', HB.stone);
      auf('hammer', HB.hammer); auf('shovel', HB.shovel); auf('pick', HB.pick);
      for(const t of ['axe','saw','scythe','rod','cleaver']) auf(t, HB.werkzeug);
      // Bier und Waffen: ohne sie friert das Gebiet nach den vier
      // Start-Rekruten ein, weil ein Posten erst MIT Besatzung die Grenze
      // verschiebt. Auch hier nur bis zur Schwelle.
      auf('beer', HB.beer); auf('sword', HB.waffe); auf('shield', HB.waffe);
      if(lvl>=2) auf('spear', HB.waffe);
    }
    // Front-Nachschub: je Zug trägt die KI EIN fehlendes Bauteil aus dem
    // HQ-Lager direkt zu einer angeschlossenen Militär-Baustelle. Die
    // ehrliche Trägerkette über 40+ Knoten machte Frontposten zu
    // Minuten-Brachen und hebelte die ganze Druck-Dosierung (milGrow) aus.
    // Das milde Mogeln der KI ist etabliert (Materialbonus oben) – hier
    // wird es nur zielgenau statt pauschal.
    // v197: Der Nachschub half bisher AUSSCHLIESSLICH Militaerbaustellen.
    // Ein Bergwerk bekam nie ein Brett - und genau daran ist die Erzkette
    // gestorben: auf Saat 42 stand der Bauplatz des Kohlebergwerks nach 35
    // Spielminuten noch bei Fortschritt 0, obwohl sein Foerderring 92
    // Einheiten Kohle hielt und beide Eisenhuetten mit leerem Kohlefach
    // dastanden. Jetzt bekommt auch das FEHLENDE Bergwerk der Eisenhuette
    // ein Teil je Zug - und zwar vor den Militaerbaustellen, weil ohne
    // Kohle die ganze Waffenkette stillsteht. Die Menge bleibt gleich: ein
    // Bauteil je Zug, nicht mehr.
    if(hq.inv){
      const hqC2=this.compOf(hq.door);
      const eng=this.aiEngpassMine(p);
      const bau=[];
      for(const b of this.buildings.values()){
        if(b.player!==p.id || b.state!=='build') continue;
        const istEng = !!eng && b.type===eng;
        if(!istEng && !BLD[b.type].mil) continue;
        if(b.door==null || b.door<0 || this.compOf(b.door)!==hqC2) continue;
        bau.push({b, istEng});
      }
      bau.sort((x,y)=>(y.istEng?1:0)-(x.istEng?1:0));   // Engpass zuerst
      for(const {b} of bau){
        const def2=BLD[b.type];
        const nB=(def2.cost.board||0)-(b.stock.board||0), nS=(def2.cost.stone||0)-(b.stock.stone||0);
        if(nB>0 && (hq.inv.board||0)>0){ hq.inv.board--; b.stock.board=(b.stock.board||0)+1; break; }
        if(nS>0 && (hq.inv.stone||0)>0){ hq.inv.stone--; b.stock.stone=(b.stock.stone||0)+1; break; }
      }
    }
    this.aiGeologe(p, lvl);
    // Rangfolge alle zwei Spielminuten an den tatsaechlichen Bedarf nachziehen
    if(this.t-(p.aiState.rangT||-9999)>=1200){
      p.aiState.rangT=this.t;
      this.aiRangAnpassen(p);
    }
    // Engpass-Steuerung haeufiger: Stilllegen wirkt sofort und kostet nichts
    if(this.t-(p.aiState.engpassT||-9999)>=600){
      p.aiState.engpassT=this.t;
      this.aiEngpassSteuern(p);
    }
    // ================= BAUPLAN DER KI (R4) =================
    // Vorher war das eine feste Einkaufsliste: ein Bauernhof, eine Muehle,
    // eine Baeckerei, egal ob Getreide liegen blieb oder Mehl fehlte. Jetzt
    // entscheidet der BEDARF, und die PLANUNGSTIEFE haengt am
    // Schwierigkeitsgrad: Stufe 1 baut die Grundversorgung, Stufe 2 die
    // Verarbeitungsketten, Stufe 3 zusaetzlich Gold, Muenze und Vorratsbau.
    // Jede Zeile beantwortet zwei Fragen: WIRD DAS GEBRAUCHT, und HABEN WIR
    // WOVON. So entstehen keine fuenf ungenutzten Muehlen mehr - und
    // umgekehrt ein zweiter Holzfaeller, wenn die Staemme knapp werden.
    const want=[];
    const c=(t)=>this.aiCount(p,t);
    const lagB=this.invCached(p.id);
    const g0=(k)=>lagB[k]||0;
    const tief = lvl>=3? 3 : lvl>=2? 2 : 1;
    const essen = g0('fish')+g0('bread')+g0('meat');
    // --- Stufe A: Holz, Stein, Nahrung. Ohne die geht gar nichts.
    if(c('woodcutter')<1) want.push('woodcutter');
    if(c('sawmill')<1) want.push('sawmill');
    if(c('forester')<1) want.push('forester');
    if(c('quarry')<1) want.push('quarry');
    if(essen<8 && c('fisher')+c('hunter')<1) want.push('fisher');
    if(essen<8 && c('fisher')+c('hunter')<1) want.push('hunter');
    // --- Nachschub nach Bedarf: knappe Ware -> noch ein Betrieb dafuer
    if(g0('trunk')<8  && c('woodcutter')<2+tief) want.push('woodcutter');
    if(g0('board')<14 && c('sawmill')<1+tief && c('woodcutter')>c('sawmill')) want.push('sawmill');
    if(g0('trunk')<12 && c('forester')<1+Math.floor(tief/2)) want.push('forester');
    if(g0('stone')<14 && c('quarry')<1+tief) want.push('quarry');
    if(essen<12 && c('fisher')<1+tief) want.push('fisher');
    if(essen<12 && c('hunter')<1+Math.floor(tief/2)) want.push('hunter');
    // Bis hierher steht die MATERIALBASIS: Holz, Bretter, Stein, Nahrung.
    // Vor sie darf sich nichts draengen - ohne Bretter wird auch das
    // dringendste Bergwerk nicht fertig. Der Engpass der Eisenhuette wird
    // deshalb genau HIER eingereiht (siehe unten), nicht ganz vorn.
    const nachGrund = want.length;
    // --- Militaerposten. Deckel je Stufe (AI_MIL): LEICHT waechst gemuetlich
    // und deckelt frueh; ab NORMAL greift der Deckel erst MIT Feindkontakt,
    // sonst fror die KI im Niemandsland ein (Kalter-Krieg-Patt, F3).
    const AM=AI_MIL[lvl]||AI_MIL[2];
    const milN=c('barracks')+c('guardhouse')+c('watchtower')+c('fortress');
    // Posten nach BEDARF, nicht nur nach Uhr: Feinddruck an der eigenen
    // Grenze und Platznot im eigenen Gebiet erlauben zusaetzliche Posten.
    // Der Bedarf kann nur DRAUFLEGEN - so bleibt das gemessene Wachstum aus
    // v140 erhalten, reagiert aber auf die Lage.
    const kontakt=this.aiContact(p);
    let milAllowed=Math.min(AM.milMax, AM.milBase + Math.floor(this.t/AM.milGrow)
                            + Math.min(AM.milNeed||0, this.aiMilBedarf(p)));
    // KD1: Die Ohne-Kontakt-Verlaengerung endete hart bei milMax*2. Gemessen
    // (Saat 3001, Stufe 2, passiver Spieler): bei 24 Posten fror ALLES ein -
    // Front bei Abstand 39 (noetig <=21), Land unveraendert ab Minute 50,
    // null Angriffe in 60 Minuten. Solange ein Landweg zum Feind existiert,
    // darf die Kette deshalb weiterwachsen (Notbremse milMax*3); nur wo kein
    // Landweg hinfuehrt (Inselstart), bleibt die alte Wand - dort bringt
    // jeder weitere Posten nichts.
    if(lvl>=2 && milN>=milAllowed
       && milN < AM.milBase + Math.floor(this.t/AM.milGrow)
       && !kontakt)
      milAllowed=Math.min(milN+1, this.aiFeindErreichbar(p)? AM.milMax*3 : AM.milMax*2);
    // MILITAER WAECHST NUR MIT DER WIRTSCHAFT (v202).
    //
    // Gemessen (Saat 11, 45 Spielminuten, ohne Materialhilfe) baute die KI
    // 30 Wachhaeuser - gegen 1 Waffenschmiede, 3 Kohlebergwerke, 1
    // Eisenbergwerk und 0 Eisenhuetten. Die Posten stehen frueh in der
    // Wunschliste und sind billig; sie haben die Bretter aufgebraucht, bevor
    // die Industrie an die Reihe kam. Dreissig Posten bei einer einzigen
    // Waffenschmiede ergeben in keiner Lesart Sinn: besetzen kann sie die
    // KI ohnehin nicht, denn dafuer braucht sie Waffen und Bier.
    //
    // Neue Regel: ein Sockel ist immer erlaubt - ohne Posten verschiebt sich
    // keine Grenze, und eine eingemauerte KI war schon einmal das Problem
    // (KD1). Darueber hinaus kommt je ZWEI fertigen Wirtschaftsgebaeuden ein
    // Posten dazu. Wer Land will, muss also auch bauen.
    //
    // Der erste Versuch erlaubte einen Posten je Wirtschaftsgebaeude - und
    // traf damit exakt die 30, die vorher schon gebaut wurden: die Regel war
    // wirkungslos. Ein Posten je zwei Gebaeuden deckelt dieselbe Partie bei
    // 17 statt 30 und gibt der Industrie dreizehn Haeuser Baumaterial frei.
    {
      const wirtschaft=[...this.buildings.values()].filter(b=>
        b.player===p.id && b.state==='done' && b.type!=='hq' && !BLD[b.type].mil).length;
      let deckel=4 + Math.floor(wirtschaft/2);
      // PLATZNOT (v206): Findet die KI fuer ein Wirtschaftsgebaeude keinen
      // Platz mehr und hat sie Soldaten, dann ist ein Posten das einzige
      // Mittel, an Bauland zu kommen - dann darf der Wirtschaftsdeckel
      // kurzzeitig ueberschritten werden. Der Merker verfaellt nach zwei
      // Spielminuten, sonst waere die Bremse dauerhaft ausgehebelt.
      if(this.t-(p.aiState.platzNot||-9999)<1200 && this.recruitTotal(p.id)>0)
        deckel+=2;
      milAllowed=Math.min(milAllowed, deckel);
    }
    if(milN<milAllowed && this.t>=(p.aiState.milCd||0)) want.push('@mil');
    // --- Stufe B (ab Normal): Verarbeitungsketten, jede nur mit Zulauf
    // ZIELAUSBAU STATT DECKEL (v209).
    //
    // Bisher stand hinter jedem Betrieb eine feste Obergrenze, und der
    // Bedarf wurde aus den VORHANDENEN Abnehmern gerechnet. Das war die
    // eigentliche Sperre: ohne Muehle kein Getreidebedarf, ohne
    // Getreidebedarf kein Hof - obwohl die Kette von vornherein feststeht.
    // Ein Soldat braucht eine Waffe UND Bier; Bier braucht Getreide und
    // Wasser. Man muss nicht auf die Muehle warten, um zu wissen, dass
    // Hoefe und Brunnen gebraucht werden.
    //
    // Jetzt wird die ganze Kette aus EINEM Ziel abgeleitet: wie viele
    // Waffenschmieden und Brauereien die Siedlung am Ende betreiben soll.
    // Diese eine Zahl haengt am Schwierigkeitsgrad - sonst gibt es keine
    // Deckel mehr. Alles andere folgt aus den gemessenen Raten
    // (Pruefstand Saat 11, je zehn Spielminuten):
    //   Bauernhof 3,1 Getreide/min   Brunnen   7,4 Wasser/min
    //   Muehle    6,6 Mehl           Baeckerei 6,6 Brot
    //   Brauerei  5,4 Bier           Eisenhuette 5,9 Eisen
    //   Waffensch. 5,9 Waffen        Bergwerk  6,6 (mit Essen 9,0)
    //
    // Essen ist dabei ausdruecklich austauschbar: ob Brot, Fisch oder
    // Fleisch die Bergwerke und Schmieden schneller macht, ist gleich -
    // deshalb zaehlt die Nahrungsbilanz und nicht die einzelne Sorte.
    const ziel = tief;              // 1 = Leicht, 2 = Normal, 3 = Schwer
    const soll = {
      armory:  ziel,
      brewery: ziel,
      smelter: Math.ceil(ziel*5.9/5.9),
      ironmine:Math.ceil(ziel*5.9/6.6),
      coalmine:Math.ceil(ziel*(5.9+5.9)/6.6),
      bakery:  ziel,
      mill:    ziel,
      // Getreide: Brauerei 5,4 + Muehle 6,6 je Einheit des Ziels
      farm:    Math.ceil(ziel*(5.4+6.6)/3.1),
      // Wasser: nur die Brauerei ist Pflicht, Zuchten kommen obendrauf
      well:    Math.ceil((ziel*5.4 + c('pigfarm')*4.2 + c('donkeyfarm')*3.0)/7.4),
    };
    // Gebaut wird in der Reihenfolge der Kette von unten nach oben: erst
    // die Rohstoffe, dann die Verarbeitung. Fehlt etwas weiter unten, steht
    // es weiter vorn in der Wunschliste.
    if(tief>=2){
      for(const typ of ['well','farm','mill','bakery','brewery'])
        if(c(typ)<soll[typ]) want.push(typ);
      if(c('armory')<soll.armory) want.push('armory');
    }
    // --- WERKZEUGKETTE: auf ALLEN Stufen, und von der Werkzeugnot gezogen.
    // Sie stand bisher komplett hinter tief>=2 - eine Stufe-1-KI konnte
    // also nie eine Werkzeugschmiede bauen und haing fuer immer am
    // Geschenk. Und ab Stufe 2 war der Schmied an iron>=2 gebunden, also
    // an Huette, Erzmine, Kohlemine und einen Geologen, der das Vorkommen
    // erst finden musste. Die Kette wurde damit nie aus dem BEDARF heraus
    // gebaut, sondern nur, wenn ihr Material zufaellig schon dalag.
    // Jetzt zieht der Mangel am ENDPRODUKT die ganze Kette: fehlen
    // Werkzeuge, will die KI Schmied, Huette und Minen - in dieser
    // Reihenfolge, jedes Glied sobald sein Vorprodukt reicht.
    {
      const werkzeugNot = (g0('hammer')+g0('shovel')+g0('pick')+g0('axe')+g0('saw')) < 8;
      const willKette = werkzeugNot || tief>=2;
      if(willKette){
        if(g0('iron')>=2 && c('toolsmith')<1) want.push('toolsmith');
        // DIE HUETTE FOLGT DEM BERGWERK, NICHT DEM LAGER (v202).
        //
        // Bisher wurde sie erst ab drei Eisenerz IM LAGER gewuenscht. Damit
        // musste die Kette zufaellig schon laufen, bevor ihr Herzstueck
        // gebaut wurde - und weil frisches Erz sofort weiterwandert oder
        // (bis v201) unterwegs verloren ging, stand das Lager praktisch nie
        // bei drei. Gemessen ueber vier Saaten und je 60 Spielminuten wurde
        // deshalb NIE eine Eisenhuette auch nur gesetzt, in 240 Minuten kein
        // Gramm Eisen erschmolzen und keine einzige eigene Waffe geschmiedet.
        // Es war eine Henne-Ei-Sperre: ohne Huette kein Eisen, ohne Eisen im
        // Lager keine Huette.
        //
        // Jetzt zaehlt die FOERDERUNG: wer ein Eisenbergwerk hat, will eine
        // Huette - Erz im Lager taugt weiter als Ausloeser, ist aber nicht
        // mehr die einzige Tuer.
        // Auch die Erzkette folgt jetzt dem Ziel statt dem Lagerbestand:
        // die Waffenschmiede braucht Eisen, das Eisen braucht Huette, Erz
        // und Kohle - das steht von Anfang an fest.
        if(c('smelter')<soll.smelter) want.push('smelter');
        // Bergwerke nur auf BEKANNTEM Vorkommen (Geologe, siehe unten).
        // v197: die knappere Haelfte der Eisenhuette zuerst. Vorher stand
        // das Eisenbergwerk immer vorn, und weil die KI je Zug nur EIN Haus
        // anfaengt, bekam die Kohle bei knappen Brettern nie ihre Chance -
        // gemessen 390 Eisenerz gegen 88 Kohle auf Saat 99.
        const willEisen = c('ironmine')<soll.ironmine && this.aiErzBekannt(p,'ironmine');
        const willKohle = c('coalmine')<soll.coalmine && this.aiErzBekannt(p,'coalmine');
        // Entscheidend ist die FOERDERKAPAZITAET, nicht der Lagerstand: ein
        // Lagerstand sagt nur, was gerade verbraucht wird. Nach dem Lager zu
        // sortieren kippte die Kette ins Gegenteil - gemessen auf Saat 7:
        // 114 Kohle, aber null Eisenerz und kein einziges Eisenbergwerk,
        // weil Kohle bei Gleichstand immer wieder zuerst drankam. Verglichen
        // werden deshalb die FERTIGEN Bergwerke; bei Gleichstand faengt die
        // Kohle an, weil sich Erz lagern laesst, eine Huette ohne Kohle aber
        // gar nicht arbeitet.
        if(this.aiCount(p,'coalmine',false) <= this.aiCount(p,'ironmine',false)){
          if(willKohle) want.push('coalmine');
          if(willEisen) want.push('ironmine');
        } else {
          if(willEisen) want.push('ironmine');
          if(willKohle) want.push('coalmine');
        }
      }
    }
    // MEHRERE LAGERHAEUSER (v201). Bisher baute die KI hoechstens EINES, und
    // das erst auf Schwer - in der Praxis lief damit die ganze Siedlung ueber
    // die eine Fahne des Hauptquartiers. Gemessen (Saat 11, 45 Spielminuten)
    // war das der Grund, warum Erz und Kohle nie ankamen: alle Routen endeten
    // an derselben Fahne, sie lief ueber, und der Traeger warf seine Ladung
    // weg. Ein Lagerhaus je zwoelf Gebaeude verteilt die Last auf mehrere
    // Ziele - und weil dispatch() immer das NAECHSTE Lager waehlt, werden die
    // Wege damit auch kuerzer. Ab Normal, nicht erst auf Schwer.
    // Zwei Ausloeser: die Siedlungsgroesse - und der STAU. Stapeln sich auf
    // den eigenen Fahnen Waren, ist ein weiteres Lager das wirksamste
    // Gegenmittel (in Die Siedler II ist genau das der Rat bei Warenstau:
    // Lagerhaus in die Naehe bauen oder mehr Fahnen setzen; das zweite macht
    // wegeTeilen). Der Bau selbst haengt weiter an Material und freiem
    // Bauarbeiter - das prueft die Bauschleife weiter unten fuer alle
    // Wuensche gleichermassen.
    if(tief>=2){
      let gestapelt=0;
      for(const [f,items] of this.flagItems){
        if(this.map.owner[f]===p.id) gestapelt+=items.length;
      }
      const soll=Math.max(Math.floor(this.aiBautenGesamt(p)/12),
                          gestapelt>=24? c('storehouse')+1 : 0);
      if(c('storehouse')<soll) want.push('storehouse');
    }
    // --- Stufe C (nur Schwer): Gold, Muenze
    if(tief>=3){
      if(c('goldmine')<1 && this.aiErzBekannt(p,'goldmine')) want.push('goldmine');
      if(g0('gold')>=2 && c('mint')<1) want.push('mint');
    }
    // ENGPASS DER EISENHUETTE VOR MILITAER UND VERARBEITUNG (v197).
    // Bergwerke stehen am Ende der Wunschliste; Militaerposten, Muehlen und
    // Baeckereien haben die Bretter vorher aufgebraucht. Fehlt einer
    // bestehenden Huette dauerhaft eine Haelfte, ist dieses Bergwerk aber
    // das Wichtigste, was die Siedlung bauen kann - ohne es steht die ganze
    // Waffen- und Werkzeugkette.
    //
    // ABER NICHT VOR DIE MATERIALBASIS. Eine erste Fassung setzte das
    // Bergwerk an Position 0, also vor Holzfaeller, Saegewerk und Steinmetz.
    // Das ist als Regel falsch - ohne Bretter wird auch das dringendste
    // Bergwerk nicht fertig -, und es steht deshalb jetzt hinter der
    // Grundversorgung (nachGrund).
    //
    // EHRLICH GEMESSEN: dieser Umbau allein hat fast nichts bewirkt. Ueber
    // sechs Saaten waren fuenf Ergebnisse Zeichen fuer Zeichen identisch,
    // nur Saat 99 legte von 58 auf 62 Eisen zu. Der Grund: auf vier der
    // sechs Saaten entsteht ueberhaupt keine Eisenhuette, und ohne Huette
    // meldet aiEngpassMine gar keinen Engpass - die Regel greift dort also
    // nie. Die Einordnung bleibt trotzdem, weil sie als Schutz richtig ist,
    // nicht weil sie in dieser Stichprobe etwas gerettet haette.
    //
    // Nur wenn noch KEINE Baustelle dieses Typs offen ist: sonst entstuende
    // ein Karussell aus Bauplaetzen, statt dass der angefangene fertig wird
    // (dafuer sorgt der Nachschub oben).
    {
      const eng=this.aiEngpassMine(p);
      if(eng){
        const offen=c(eng)-this.aiCount(p,eng,false);
        if(offen===0 && c(eng)<1+tief) want.splice(nachGrund, 0, eng);
      }
    }
    // KEIN PLATZ UND KEIN SOLDAT (v206): dann bringt neues Land nichts, denn
    // ein Posten liesse sich gar nicht besetzen. Was der Siedlung fehlt, ist
    // dann das, was Rekruten macht - eine Waffe oder das Bier dazu. Der beim
    // gescheiterten Bauversuch gesetzte Merker zieht das entsprechende Haus
    // nach vorn; gebaut wird es nach denselben Regeln wie alles andere
    // (Material frei, Bauarbeiter frei, Bauplatz vorhanden).
    if(p.aiState.rekrutMangel){
      const wunsch = p.aiState.rekrutMangel==='bier'? 'brewery' : 'armory';
      if(c(wunsch)<2+Math.floor(tief/2)) want.splice(nachGrund, 0, wunsch);
      p.aiState.rekrutMangel=null;
    }

    // Abgehängte Gebäude regelmäßig wieder ans HQ-Netz anschließen: eine
    // Baustelle ohne Anschluss bekommt nie Material und stünde für immer.
    // Ein Versuch je Takt genügt – mit wachsendem Gebiet öffnen sich Wege.
    if(this.t-(p.aiState.lastReconnect||0)>150){
      p.aiState.lastReconnect=this.t;
      const hqC=this.compOf(hq.door);
      for(const b of [...this.buildings.values()]){
        if(b.player!==p.id || b.door==null || b.door<0 || b.type==='hq') continue;
        if(this.compOf(b.door)===hqC){ b._aiDiscT=undefined; continue; }
        if(this.aiConnect(p,b)){ b._aiDiscT=undefined; break; }
        // Anschluss scheitert dauerhaft (Wasser-Tasche, Gebirgsriegel):
        // solche Baustellen nach ~5 Minuten AUFGEBEN statt ewig Material zu
        // fressen und den Militär-Deckel zu verstopfen. Ohne die Aufgabe
        // fror die komplette KI ein (beobachtet: tote Baustellen zählten
        // gegen den Posten-Deckel, Expansion und Angriffe standen still).
        if(b._aiDiscT===undefined) b._aiDiscT=this.t;
        else if(b.state==='build' && this.t-b._aiDiscT>3000) this.burnBuilding(b,false);
      }
      // Kritik R4 S2, zweite Haelfte: eine ANGESCHLOSSENE Baustelle, an der
      // seit zehn Spielminuten kein einziges Brett und kein Stein liegt und
      // die auch nichts unterwegs hat, ist keine Baustelle mehr, sondern ein
      // besetzter Bauplatz. Sie wird geraeumt (das Material bekommt sie
      // ohnehin nicht) - der Platz und der Baustellen-Deckel werden frei,
      // und die KI faengt spaeter neu an, wenn das Lager es traegt.
      for(const b of [...this.buildings.values()]){
        if(b.player!==p.id || b.state!=='build') continue;
        const leer=((b.stock.board||0)+(b.stock.stone||0)
                   +(b.incoming.board||0)+(b.incoming.stone||0))===0;
        if(!leer || b.bauerDa){ b._leerT=undefined; continue; }
        if(b._leerT===undefined) b._leerT=this.t;
        else if(this.t-b._leerT>6000) this.burnBuilding(b,false);
      }
    }
    // WIE VIELE BAUSTELLEN GLEICHZEITIG? Bisher gar keine Grenze - die KI
    // fing an, sobald Bretter und Steine fuer das naechste Haus reichten.
    // Solange ihr Gebiet eng war, fiel das nicht auf. Seit der Abzweig
    // (v146) ihr deutlich mehr erreichbare Plaetze verschafft, faengt sie
    // mehr an, als ihr Material traegt: das Material verteilt sich duenn
    // ueber viele Rohbauten, und fertig wird kaum etwas. Auf einer Saat
    // standen 25 Baustellen und nur 20 fertige Haeuser.
    // Gemessen ueber zwoelf Saaten, Stufe 2, 15 Spielminuten, Summen:
    //   Grenze   fertig  Baustellen  Soldaten  Gebiet
    //   keine       289         176       156   10253
    //   3           175          36       169   10884
    //   5           236          60       204   12872
    //   8           296          91       211   12651
    //   12          304         119       205   12549
    //   16          280         157       168   10891
    // Zwischen 8 und 12 schwanken die fertigen Bauten (296/274/304) - das
    // ist Rauschen, kein Optimum. Robust ist nur, dass ohne Grenze und ab
    // 16 die Siedlung deutlich abfaellt, waehrend zwischen 5 und 12 rund
    // ein Drittel mehr Soldaten und ein Viertel mehr Gebiet herauskommen.
    // Deshalb 8 als Mitte, mit der Siedlung wachsend: eine junge Siedlung
    // mit fuenf Haeusern soll nicht acht Baustellen offen haben.
    let bauSatt=false;
    {
      const AMb=AI_MIL[lvl]||AI_MIL[2];
      let fertig=0, roh=0;
      for(const b of this.buildings.values()){
        if(b.player!==p.id) continue;
        if(b.state==='build') roh++; else fertig++;
      }
      // Nur die BAUSCHLEIFE wird uebersprungen. Rekrutieren, Anschluss und
      // Angriff laufen weiter - eine Siedlung, die gerade genug Baustellen
      // hat, hoert nicht auf, Krieg zu fuehren.
      bauSatt = roh >= Math.max(3, Math.min(AMb.bauMax||8, 2+((fertig/3)|0)));
      // Kritik R4 S2: Die Stueckzahl allein reicht nicht. Gemessen hielt die
      // KI acht Baustellen offen, waehrend im Lager 4-8 Bretter lagen -
      // sechs bis sieben davon standen ueber 30 Spielminuten OHNE ein
      // einziges Brett da, und die Siedlung wuchs nicht mehr (fertig 32 ->
      // 32 zwischen Minute 30 und 40). Deshalb zaehlt jetzt auch, was die
      // offenen Rohbauten noch KOSTEN: liegt im Lager nicht einmal die
      // Haelfte davon, wird nichts Neues angefangen. Das Material sammelt
      // sich dann auf den vorhandenen Baustellen, statt sich auf immer mehr
      // zu verteilen.
    }
    // ERST BAUEN, WENN MATERIAL UND BAUARBEITER WIRKLICH FREI SIND (v203).
    //
    // Bisher genuegte es, dass genug Bretter und Steine IM LAGER lagen -
    // ohne Ruecksicht darauf, dass die offenen Baustellen davon schon das
    // meiste bestellt hatten. Gemessen (Saat 99, 45 Spielminuten): acht
    // Baustellen offen, acht Bretter und 19 Steine im Lager, und drei
    // Bergwerke standen planiert und ohne Bauarbeiter bei Fortschritt 0 -
    // mit 145, 123 und 36 Einheiten Erz im Foerderring. Das Material war
    // auf acht Rohbauten verteilt, statt einen fertigzustellen.
    //
    // Jetzt zaehlt, was NACH Abzug der offenen Bestellungen uebrig ist, und
    // ob ueberhaupt noch ein Hammer fuer den naechsten Bauarbeiter da ist.
    // Ohne freien Hammer bekommt die neue Baustelle sowieso keinen - sie
    // wuerde nur einen Bauplatz und einen Baustellen-Slot blockieren.
    let offenBrett=0, offenStein=0;
    for(const b of this.buildings.values()){
      if(b.player!==p.id || b.state!=='build') continue;
      const d2=BLD[b.type];
      offenBrett+=Math.max(0,(d2.cost.board||0)-(b.stock.board||0)-(b.incoming.board||0));
      offenStein+=Math.max(0,(d2.cost.stone||0)-(b.stock.stone||0)-(b.incoming.stone||0));
    }
    const boards=Math.max(0,(inv.board||0)-offenBrett);
    const stones=Math.max(0,(inv.stone||0)-offenStein);
    const hammerFrei=!!this.findToolStore(p.id,'hammer');
    for(const w of (bauSatt || !hammerFrei)? [] : want){
      // Ab NORMAL baut die KI grundsätzlich Wachhäuser (und wartet notfalls
      // auf den Stein): Baracken (Radius 8, Besatzung 2) können nach der
      // Reichweitenregel (r_eigen+r_ziel+2) ein Feind-HQ oft gar nicht
      // erreichen und haben nie 2 abkömmliche Angreifer – eine reine
      // Baracken-Front kann also NIEMALS angreifen (beobachtete Ursache des
      // ausbleibenden Drucks trotz 24 Posten).
      const type = w==='@mil' ? (lvl>=2 ? 'guardhouse' : 'barracks') : w;
      const def=BLD[type];
      if(boards<(def.cost.board||0) || stones<(def.cost.stone||0)) continue;
      // KD1 VORSTOSS: Ohne Feindkontakt zaehlt bei einem Militaerposten nur
      // eines - naeher an den Gegner. aiFindSpot streut 340 Zufallsknoten
      // und wiegt die Richtung nur weich (edW); gemessen rueckte die Front
      // damit 0,5-1,5 Knoten je Minute vor und kam auf einer von drei
      // Saaten in 60 Minuten NIE in Angriffsreichweite. Ab Minute 20 wird
      // deshalb gezielt der eigene Knoten bebaut, der dem Feind-HQ am
      // naechsten liegt (aiVorstossSpot); findet der nichts, greift die
      // alte Streuwahl.
      const vorstoss = !!def.mil && lvl>=2 && !kontakt && this.t>=Game.VORSTOSS_AB;
      let spot=-1;
      if(vorstoss){
        spot=this.aiVorstossSpot(p, type);
        // Kein Platz an der Front? Dann fehlt dort fast immer der
        // Weganschluss - erst das Netz RICHTUNG FEIND verlaengern, statt
        // den Posten-Slot mit einem Streuposten zu verbrennen. (Auf den
        // Messsaaten fand die Front-Suche immer einen Platz - dieser Zweig
        // ist die Absicherung fuer verbaute Fronten, nicht der Normalfall;
        // die gemessene Bremse war die Planierer-Warteschlange, siehe
        // tickBuilderSpawn.) Solange der Fehlversuch gemerkt ist (-2) oder
        // der Pionierweg gerade gebaut wurde, diesen Zug NICHT streuen -
        // gestreut wird erst, wenn Front-Suche UND Pionierweg nichts hergeben.
        if(spot===-2) continue;
        if(spot<0 && this.aiPionierweg(p, true)) continue;
      }
      if(spot<0) spot=this.aiFindSpot(p, type);
      // R4/R10: Kein Platz? Dann liegt es fast immer daran, dass das eigene
      // Wegenetz nicht bis ans freie Land reicht - ein Pionierweg loest das.
      // Im Vorstoss-Modus zielt der Pionierweg RICHTUNG FEIND statt einfach
      // ans entfernteste eigene Land.
      if(spot<0){
        this.aiPionierweg(p, vorstoss);
        // KEIN PLATZ MEHR (v206). Ein Pionierweg hilft nur, wenn ueberhaupt
        // freies eigenes Land da ist. Ist das Gebiet dicht, gibt es genau
        // zwei ehrliche Auswege, und welcher gilt, entscheidet die Besatzung:
        //   Soldaten da  -> ein Militaerposten schiebt die Grenze und schafft
        //                   neues Bauland (der Posten selbst braucht Platz,
        //                   deshalb wird er wie jeder Bau geprueft).
        //   keine da     -> Land bringt nichts, weil kein Posten besetzt
        //                   werden kann. Dann fehlt der Siedlung das, was
        //                   Rekruten macht: Waffen oder Bier. Das wird
        //                   vorgemerkt und beim naechsten Zug nach den
        //                   bekannten Regeln gebaut.
        if(!def.mil){
          const frei=this.recruitTotal(p.id);
          if(frei>0){
            p.aiState.platzNot=this.t;      // milAllowed liest das (aiMilBedarf)
          } else {
            const g1=(k)=>(inv[k]||0);
            const waffen=g1('sword')+g1('shield')+g1('spear')+g1('bow');
            // Was fehlt zuerst? Ohne Waffe nuetzt Bier nichts und umgekehrt.
            p.aiState.rekrutMangel = waffen<2? 'waffe' : (g1('beer')<2? 'bier' : null);
          }
        }
        continue;
      }
      // Wasser-Taschen-Wächter: Plätze ohne Landweg zum Hauptquartier bekommen
      // nie einen Straßenanschluss – die Baustelle stünde ewig, fräße Material
      // und verstopfte den Militär-Deckel (kompletter KI-Stillstand beobachtet:
      // 8 tote Baustellen, Expansion und Angriffe eingefroren).
      const [sx2,sy2]=m.worldPos(spot), [hx2,hy2]=m.worldPos(hq.node);
      if(!this.landDetour({x:sx2,y:sy2}, hx2, hy2, 30000)) continue;
      const r=this.placeBuilding(p.id, type, spot);
      if(r.ok){
        // Wurzel B, Stufe 1: Der Landweg-Wächter oben prüft nur, ob überhaupt
        // Land hinführt - NICHT, ob eine Straße möglich ist. Straßen dürfen
        // keine fremde Fahne kreuzen und keinen Hausschatten queren, deshalb
        // scheitert aiConnect auch auf zusammenhängendem Land regelmäßig.
        // Gemessen (Spielekritiker, 111 Minuten mit einer KI): fünf Gebäude,
        // null Militärbauten, null Angriffe - die KI setzte Baustellen, die
        // nie ans Netz kamen, warf sie nach 3000 Ticks weg und begann von
        // vorn, während ihr Lager auf 135 Bretter anwuchs.
        // NACHGEMESSEN (12.08., Stufe 2, 30 Spielminuten): von zehn
        // begonnenen Militaerbauten wurden NEUN in derselben Sekunde wieder
        // abgerissen, weil aiConnect beim ersten Versuch scheiterte - genau
        // einer wurde fertig. Damit kam die KI nie in Angriffsreichweite
        // (ihre fertigen Posten standen 47 bis 61 Knoten vom naechsten Ziel
        // entfernt, noetig waeren rund 20).
        // Der Sofortabriss war zu hart: canBuild hat vorher geprueft, dass
        // eine Strasse ans Netz kommen KANN; dass roadPath im ersten Anlauf
        // keinen Weg findet, heisst nur, dass es gerade eng ist. Die
        // Baustelle bleibt deshalb stehen und wird vom Reconnect-Durchlauf
        // (alle 150 Takte) weiter versucht. Hoffnungslose Faelle raeumt
        // derselbe Durchlauf nach 3000 Takten ohnehin ab - dieser Schutz
        // bleibt unveraendert.
        if(!this.aiConnect(p, r.b)) r.b._aiDiscT=this.t;
        break; // ein Gebäude pro Zug
      }
    }
    // Angreifen? Mit Anlauf-Schonfrist: auf kleinen Karten fiel die KI
    // sonst unmittelbar nach Grenzkontakt über den Spieler her (Frustspitze
    // aus dem Kritikbericht), während der Takt danach unverändert bleibt.
    // Dosierung je Stufe (AI_MIL, Kritikbericht F2/F3):
    //  - LEICHT: kleine Gruppen, nur Grenzposten (HQ samt Umfeld tabu),
    //    nach einem verlorenen eigenen Posten lange Pause. Ein passiver
    //    Spieler verliert höchstens Grenzposten, nie das Hauptquartier.
    //  - NORMAL: aufs HQ erst, wenn der Verteidiger kaum Militär hat oder
    //    die KI klar dominiert – und dann in eigenem, langsamem Takt mit
    //    wachsenden Wellen (Drohung -> Scharmützel -> Entscheidung).
    //  - SCHWER: heutiges aggressives Verhalten ohne Rücksicht.
    const iv=1200*dm.atkMul/lvl;
    // SOLDATEN-VORLAUF: erst sammeln, dann losziehen. Ohne diese Schwelle
    // griff die KI an, sobald irgendwo zwei Mann abkoemmlich waren - ein
    // Dauertroepfeln statt eines spuerbaren Feldzugs. Die Schwelle steigt
    // mit der Stufe (5 / 12 / 20 Soldaten), und ein Teil davon bleibt immer
    // zu Hause (heimwehr).
    const staerke=this.aiStaerke(p);
    const bleibt=Math.round((AM.vorlauf||0)*(AM.heimwehr||0));
    if(this.t>3000 && this.t-p.aiState.lastAttack > iv
       && staerke >= (AM.vorlauf||0)
       && this.t >= (p.aiState.milLossT||0)+AM.lossPause){
      // Geduld am Ende? Wartet die KI ein Mehrfaches ihres Takts, greift sie
      // auch ohne klare Übermacht an – sonst saß sie vor einem vollen
      // HQ/Turm ewig still (Belagerungs-Langeweile, Kritikbericht F5).
      const drang=(this.t-p.aiState.lastAttack)/iv > 3;
      // Gebietsgrößen für die Dominanz-Frage (2x Gebiet = "klar überlegen"),
      // einmal je Abwägung gezählt
      let terrN=null;
      const terrOf=(id)=>{
        if(!terrN){ terrN=new Array(this.players.length).fill(0);
          for(let i=0;i<m.owner.length;i++){ const o=m.owner[i]; if(o>=0&&o<terrN.length) terrN[o]++; } }
        return terrN[id]||0;
      };
      const milDone=(id)=>{
        let n2=0;
        for(const bb of this.buildings.values())
          if(bb.player===id && bb.soldiers && bb.state==='done' && bb.type!=='hq') n2++;
        return n2;
      };
      let best=null, bs=1e9;
      for(const b of this.buildings.values()){
        if(b.player===p.id || b.player<0) continue;
        if(this.players[b.player]?.defeated) continue;
        if(!(BLD[b.type].mil||b.type==='hq')) continue;
        const avail=this.attackable(p.id, b.id);
        if(avail<2) continue;
        const defN=(b.soldiers?.length||0)+(b.type==='hq'?this.recruitTotal(b.player):0);
        // HQ-Schutzzone: das Hauptquartier selbst und Posten dicht daneben
        const eHq=this.buildings.get(this.players[b.player].hq);
        const inHqZone = b.type==='hq' ||
          (eHq && Math.hypot(m.X(eHq.node)-m.X(b.node), m.Y(eHq.node)-m.Y(b.node))<=HQ_SCHUTZ);
        const dom = terrOf(p.id) >= 2*Math.max(50, terrOf(b.player));
        let n, hqWave=false;
        if(inHqZone && AM.hqTabu) continue;             // LEICHT: niemals aufs HQ
        if(inHqZone && AM.hqIv){
          // NORMAL: HQ-Angriffe nur bei klarer Lage, in eigenem langsamem
          // Takt, und die Wellen wachsen von Sondierung zu Sturm an.
          // KD1: +1 Mann je Welle alle 20 Minuten war keine Eskalation -
          // gemessen kamen bei Kontakt ab Minute 30 genau zwei Wellen zu
          // 2 und 3 Mann in einer ganzen Stunde, die "Entscheidung" laege
          // rechnerisch bei Minute 100+. Jetzt verdoppelt sich die Welle
          // (2/4/6...), und wer klar dominiert, wartet nur den halben Takt.
          if(!dom && milDone(b.player)>=2) continue;
          if(this.t < (p.aiState.hqAtkT||0)+(dom? AM.hqIv/2 : AM.hqIv)) continue;
          n=Math.min(avail, 2+2*(p.aiState.hqWaves||0));
          hqWave=true;
        } else {
          // Dominanz macht offensiver: wer doppelt so groß ist, wartet nicht
          // auf 130% Übermacht (Kalter-Krieg-Patt aus dem Kritikbericht, F3)
          const offensiv = drang || (lvl>=2 && dom);
          const need = offensiv ? Math.max(2, Math.ceil(defN*0.8)) : defN*1.3+1;
          if(avail < need) continue;
          n=Math.min(avail, offensiv? avail : defN+3);
        }
        n=Math.min(n, AM.grpMax, Math.max(2, staerke-bleibt));
        const d=Math.hypot(m.X(b.node)-m.X(hq.node), m.Y(b.node)-m.Y(hq.node));
        if(d<bs){ bs=d; best={b, n, hqWave}; }
      }
      if(best){
        p.aiState.lastAttack=this.t;
        if(best.hqWave){ p.aiState.hqAtkT=this.t; p.aiState.hqWaves=(p.aiState.hqWaves||0)+1; }
        this.attack(p.id, best.b.id, best.n);
      }
    }
  }
  // Feindkontakt: Kann diese KI irgendein feindliches Militärgebäude/HQ
  // TATSÄCHLICH angreifen (mindestens 2 abkömmliche Soldaten in Reichweite,
  // gleiche Regel wie atkSources/attackable)? Bloße geometrische Nähe genügt
  // nicht: eine einzelne Grenz-Baracke (Besatzung 2, einer muss bleiben)
  // fror sonst Expansion UND Angriff gleichzeitig ein – der Deckel griff,
  // aber ein Angriff kam nie zustande.
  aiContact(p){
    const m=this.map;
    for(const b of this.buildings.values()){
      if(b.player===p.id || b.player<0) continue;
      if(this.players[b.player]?.defeated) continue;
      if(!(BLD[b.type].mil || b.type==='hq')) continue;
      const tR=this.milRadius(b);
      let avail=0;
      for(const mb of this.buildings.values()){
        if(mb.player!==p.id || !mb.soldiers || mb.state!=='done') continue;
        const d=Math.hypot(m.X(mb.node)-m.X(b.node), m.Y(mb.node)-m.Y(b.node));
        if(d<=this.milRadius(mb)+tR+2) avail+=Math.max(0, mb.soldiers.length-1);
        if(avail>=2) return true;
      }
    }
    return false;
  }
  // KD1: naechstes lebendes Feind-HQ (Knoten) zur eigenen Basis, -1 wenn keins.
  aiFeindHq(p){
    const m=this.map;
    const hq=this.buildings.get(p.hq); if(!hq) return -1;
    const hx=m.X(hq.node), hy=m.Y(hq.node);
    let best=-1, bd=1e18;
    for(const q of this.players){
      if(q.id===p.id || q.defeated) continue;
      const eh=this.buildings.get(q.hq); if(!eh) continue;
      const d=Math.hypot(m.X(eh.node)-hx, m.Y(eh.node)-hy);
      if(d<bd){ bd=d; best=eh.node; }
    }
    return best;
  }
  // KD1: fuehrt ueberhaupt ein Landweg von der eigenen Basis zu einem
  // Feind-HQ? Nur dann lohnt es, die Postenkette ueber den Normal-Deckel
  // hinaus zu verlaengern - auf einem Inselstart brächte jeder weitere
  // Posten nichts und die alte Wand bleibt. Alle 5 Minuten neu geprueft.
  aiFeindErreichbar(p){
    if(this.t < (p._feindErrT??-1e9)+3000) return p._feindErr||false;
    p._feindErrT=this.t; p._feindErr=false;
    const m=this.map;
    const hq=this.buildings.get(p.hq); if(!hq) return false;
    const fz=this.aiFeindHq(p);
    if(fz>=0){
      const [hx,hy]=m.worldPos(hq.node), [ex,ey]=m.worldPos(fz);
      if(this.landDetour({x:hx,y:hy}, ex, ey, 60000)) p._feindErr=true;
    }
    return p._feindErr;
  }
  // KD1 VORSTOSS: der eigene Knoten, der dem naechsten Feind-HQ am naechsten
  // liegt und bebaubar ist. Anders als aiFindSpot (340 Zufallsknoten, weiche
  // Richtungsgewichtung) wird hier AUFSTEIGEND nach Feindabstand geprueft -
  // jeder Posten rueckt so weit vor, wie Netz und Bauregeln erlauben.
  // Die Ruinen-Sperre und die Korridor-Bremse aus aiFindSpot gelten auch
  // hier; Fehlversuche werden 30 Sekunden gemerkt (canBuild ist teuer).
  // Rueckgabe: Knoten, -1 = frisch gesucht und nichts gefunden,
  // -2 = Fehlversuch noch gemerkt (Front in Arbeit, nicht streuen).
  aiVorstossSpot(p, type){
    if(this.t < (p._vorCd||0)) return -2;
    const m=this.map;
    const fz=this.aiFeindHq(p);
    if(fz<0) return -1;
    const ex=m.X(fz), ey=m.Y(fz);
    const own=[];
    for(let i=0;i<m.owner.length;i++)
      if(m.owner[i]===p.id) own.push([Math.hypot(m.X(i)-ex, m.Y(i)-ey), i]);
    own.sort((a,b)=>a[0]-b[0]);
    const ne=this.netzErreichbar(p.id);
    let gepr=0;
    for(const [,i] of own){
      if(gepr>=90) break;
      if(this.ruins.some(r=>{
        const dx=m.X(r.node)-m.X(i), dy=m.Y(r.node)-m.Y(i);
        return dx*dx+dy*dy<25;
      })) continue;
      gepr++;
      if(!this.canBuild(p.id,type,i).ok) continue;
      if(ne.R.size<40){
        let frisst=0;
        for(const q of this.schattenBand(type, i)) if(ne.R.has(q)) frisst++;
        if(frisst) continue;         // letzte Korridore nicht selbst zubauen
      }
      return i;
    }
    p._vorCd=this.t+300;
    return -1;
  }
  // KD1: Vorwarnung an den Spieler, wenn ein fremder Militaerposten in
  // Grenznaehe fertig wird - Naehe heisst: sein Einfluss plus 6 Knoten
  // Puffer beruehrt eine eigene Anlage (bei Militaer/HQ zaehlt deren
  // Einfluss mit, das entspricht etwa der Angriffs-Reichweitenregel).
  // Hoechstens eine Meldung alle 3 Minuten, sonst wird die Front zum Spam.
  vorpostenWarnung(b){
    if(this.t < (this._vorwarnT||0)+1800) return;
    const m=this.map;
    for(const e of this.buildings.values()){
      if(e.player!==0) continue;
      const zR=(BLD[e.type].mil||e.type==='hq') ? this.milRadius(e) : 0;
      const d=Math.hypot(m.X(e.node)-m.X(b.node), m.Y(e.node)-m.Y(b.node));
      if(d<=this.milRadius(b)+zR+6){
        this._vorwarnT=this.t;
        this.msg('Feindlicher Vorposten an unserer Grenze!', 'war', b.node, 0, 'kampf');
        return;
      }
    }
  }
  aiFindSpot(p, type){
    const m=this.map; const def=BLD[type];
    const hq=this.buildings.get(p.hq); if(!hq) return -1;
    let best=-1, bs=-1e9;
    // Kandidaten: eigene Knoten abtasten
    const own=[];
    for(let i=0;i<m.owner.length;i+=1) if(m.owner[i]===p.id) own.push(i);
    const sampleN=Math.min(own.length, 340);
    // Wie viel Bewegungsfreiheit hat das eigene Wegenetz noch? Danach richtet
    // sich, wie stark ein Bauplatz bestraft wird, der Korridore zubaut.
    const ne=this.netzErreichbar(p.id);
    for(let k=0;k<sampleN;k++){
      const i=own[(this.rng()*own.length)|0];
      if(!this.canBuild(p.id,type,i).ok) continue;
      let s=this.rng()*2;
      // NICHT SELBST ZUBAUEN: das Bild eines Hauses sperrt die Knoten unter
      // sich fuer jede Strasse. Wer seine letzten Korridore verbaut, kann
      // danach gar nichts mehr anschliessen - genau so blieb die KI auf engen
      // Startgebieten stehen. Je knapper der Rest, desto teurer der Verlust.
      // Diese Bremse frueher greifen zu lassen (Gewicht 0,25/0,6 schon ab 400
      // freien Korridorknoten) wurde nachgemessen und war deutlich
      // SCHLECHTER: die KI mied dann fast jeden Platz. Stufe 2 nach 45
      // Spielminuten 303 Knoten und 14 Gebaeude statt 936 und 23. Bleibt
      // also bei 120.
      if(ne.R.size<120){
        let frisst=0;
        for(const q of this.schattenBand(type, i)) if(ne.R.has(q)) frisst++;
        if(frisst) s -= frisst * (ne.R.size<40 ? 3.0 : 1.2);
      }
      const nearNodes=this.nodesInRange(i, def.range||5);
      const un=(o)=>o&127;
      if(def.gather==='tree') s+=nearNodes.filter(n=>un(m.obj[n])===OBJ.TREE).length*1.2;
      else if(def.gather==='stone') s+=nearNodes.filter(n=>un(m.obj[n])===OBJ.STONE).length*3;
      else if(def.gather==='fish') s+=nearNodes.filter(n=>m.terr[n]===TER.WATER&&m.fish[n]>0).length*1.4;
      else if(def.gather==='hunt'){
        const [wx,wy]=m.worldPos(i);
        s+=this.animals.filter(a=>Math.hypot(a.x-wx,a.y-wy)<(def.range||9)*40).length*2.5;
      }
      else if(def.gather==='farm'||type==='pigfarm') s+=nearNodes.filter(n=>m.obj[n]===OBJ.NONE&&m.terr[n]===TER.GRASS).length*0.35;
      else if(def.mine){
        const targetT={coalmine:1,ironmine:2,goldmine:3,granitemine:4}[type];
        // Kritik R3 S3 (Minen-Karussell): gezaehlt wurden KNOTEN in
        // Reichweite 5 - ein einzelner Erzknoten drei Felder weiter
        // reichte zum Bauen, obwohl der FOERDERRING (Knoten + Nachbarn)
        // fast leer war. Das Bergwerk lebte dann drei Minuten: Bau,
        // Erschoepfung, Neubau im Takt. Jetzt zaehlt der ERZVORRAT im
        // Ring; unter 36 Einheiten (rund 5 Foerderminuten) wird dort
        // nicht gebaut, und mehr Vorrat schlaegt mehr Punkte.
        let vorrat=0;
        for(const n of [i,...m.nbs(i)])
          if(m.oreT[n]===targetT) vorrat+=m.oreA[n];
        if(vorrat<36) continue;
        s+=vorrat*0.25
          +nearNodes.filter(n=>m.oreT[n]===targetT&&m.oreA[n]>0).length*1.5;
      }
      else if(def.mil){
        // Kein Neubau auf frisch umkämpftem Boden: solange in der Nähe noch
        // eine Ruine schwelt (~2,5 min), meidet die KI die Stelle – sonst
        // entsteht die zerstörte Baracke einen Knoten daneben sofort neu und
        // der Angreifer kommt nie über die Baustellen-Front hinaus.
        if(this.ruins.some(r=>{
          const dx=m.X(r.node)-m.X(i), dy=m.Y(r.node)-m.Y(i);
          return dx*dx+dy*dy<25;
        })) continue;
        // Richtung Feind/Grenze
        let border=0;
        for(const n of nearNodes) if(m.owner[n]!==p.id) border++;
        s+=border*0.5;
        let ed=1e9;
        for(const q of this.players){
          if(q.id===p.id||q.defeated) continue;
          const eh=this.buildings.get(q.hq);
          if(eh) ed=Math.min(ed, Math.hypot(m.X(eh.node)-m.X(i), m.Y(eh.node)-m.Y(i)));
        }
        s+= -ed*((AI_MIL[p.aiLevel]||AI_MIL[2]).edW);
      } else {
        // Nähe zum HQ bevorzugen
        const d=Math.hypot(m.X(hq.node)-m.X(i), m.Y(hq.node)-m.Y(i));
        s+= -d*0.3;
      }
      if(s>bs){ bs=s; best=i; }
    }
    return best;
  }
  // ---------- Pionierweg (R4/R10) ----------
  // Die KI baute sich in ihrem Startgebiet fest. Gemessen nach 45
  // Spielminuten auf Stufe 2: 271 eigene Knoten, davon EIN bebaubarer Platz -
  // bei 212 Brettern, 207 Steinen, 45 Schwertern und 87 Bier im Lager. Sie
  // hatte alles, nur keinen Platz. Auf Stufe 1 stand sie ab Minute 5
  // vollstaendig still (Land 298, 13 Gebaeude, 1 Soldat, ueber 40 Minuten
  // unveraendert).
  // Der Grund ist ein Kreis: aiFindSpot sucht nur in EIGENEN Knoten, und
  // canBuild verlangt seit K4 einen echten Weganschluss. Wo das Netz nicht
  // hinreicht, ist nichts baubar - und ohne Militaerbau waechst das Gebiet
  // nicht, also reicht das Netz nie weiter.
  // Der Pionierweg bricht den Kreis: eine Strasse vom Netz zum ENTFERNTESTEN
  // eigenen Knoten, den das Netz noch nicht erreicht. Danach findet
  // aiFindSpot dort im naechsten Zug Plaetze. Hoechstens alle 600 Takte
  // einer, damit die KI nicht die Karte mit Strassen zupflastert.
  aiPionierweg(p, richtungFeind=false){
    // Im Vorstoss-Modus halber Takt: der Weg zur Front ist dort das einzige
    // Mittel, ueberhaupt wieder bauen zu koennen.
    if(this.t-(p._pionierT||-9999) < (richtungFeind? 300 : 600)) return false;
    const m=this.map;
    const hq=this.buildings.get(p.hq); if(!hq) return false;
    const ne=this.netzErreichbar(p.id);
    if(!ne.R || !ne.R.size) return false;
    // Ziel ist der entfernteste eigene Knoten, den das Wegenetz noch NICHT
    // erreicht (ne.R = was es ueberhaupt noch erreichen kann). Ob dorthin
    // wirklich eine Strasse fuehrt, entscheidet roadPath weiter unten - der
    // rechnet den echten Pfad, waehrend R nur die Reichweite abschaetzt.
    // Auf R selbst zu zielen wurde nachgemessen und war SCHLECHTER: die
    // Pionierwege frassen dann den letzten freien Korridor auf, statt neues
    // Land zu erschliessen (Stufe 1: 14 Gebaeude -> 11, Korridor 6 -> 0).
    // KD1: im Vorstoss-Modus (richtungFeind) zielt der Weg stattdessen auf
    // den eigenen Knoten, der dem naechsten FEIND-HQ am naechsten liegt -
    // "irgendwo weit weg" erschliesst sonst regelmaessig die falsche Seite
    // der Karte, waehrend die Front zum Spieler unerschlossen bleibt.
    const hx=m.X(hq.node), hy=m.Y(hq.node);
    let zx=hx, zy=hy;
    if(richtungFeind){
      const fz=this.aiFeindHq(p);
      if(fz>=0){ zx=m.X(fz); zy=m.Y(fz); }else richtungFeind=false;
    }
    let ziel=-1, bd=richtungFeind? 1e18 : -1;
    for(let i=0;i<m.owner.length;i++){
      if(m.owner[i]!==p.id || ne.R.has(i)) continue;
      if(!m.terrOkRoad(i) || m.bld[i]>=0 || this.roadAt(i) || !this.roadObjOk(i)) continue;
      const d=Math.hypot(m.X(i)-zx, m.Y(i)-zy);
      if(richtungFeind ? d<bd : d>bd){ bd=d; ziel=i; }
    }
    if(ziel<0) return false;
    const cands=[];
    for(const bb of this.buildings.values()) if(bb.player===p.id && bb.door>=0) cands.push(bb.door);
    for(const r of this.roads.values()) if(r.player===p.id){ cands.push(r.path[0]); cands.push(r.path[r.path.length-1]); }
    cands.sort((a,b2)=> Math.hypot(m.X(a)-m.X(ziel),m.Y(a)-m.Y(ziel))
                       -Math.hypot(m.X(b2)-m.X(ziel),m.Y(b2)-m.Y(ziel)));
    for(const f of cands.slice(0,10)){
      if(f===ziel) continue;
      const path=this.roadPath(p.id, ziel, f);
      if(path){ this.createRoad(p.id, path.reverse()); p._pionierT=this.t; return true; }
    }
    p._pionierT=this.t;                 // auch ein Fehlversuch kostet Wartezeit
    return false;
  }
  aiConnect(p, b){
    // Straße von b.door ins eigene Netz. Wichtig: bevorzugt eine Fahne im
    // NETZ DES HAUPTQUARTIERS und mehrere Kandidaten der Reihe nach –
    // vorher wurde nur die luftlinien-nächste Fahne probiert. Schlug deren
    // Pfad fehl (oder hing sie selbst ohne Netz in der Luft), zerfiel das
    // KI-Straßennetz in Inseln: Material erreichte die Baustellen nie,
    // nichts wurde fertig, das Gebiet fror ein (KI-Passivität, F5).
    const m=this.map;
    const hq=this.buildings.get(p.hq);
    const hqComp=hq ? this.compOf(hq.door) : undefined;
    // ANSCHLUSS MITTEN AUF DER STRASSE. Bisher waren nur bestehende FAHNEN
    // Ziel. Der Spieler darf laengst auch mitten auf einen eigenen Weg
    // anschliessen - autoConnect setzt dort eine Fahne, die den Weg teilt.
    // Ohne diese Moeglichkeit war jede eigene Strasse fuer die KI eine
    // Mauer: gemessen liessen sich 19 von 22 gescheiterten Anschluessen
    // ueber einen solchen Abzweig sehr wohl herstellen.
    const cands=new Map();          // Knoten -> ist dort schon eine Fahne?
    for(const bb of this.buildings.values())
      if(bb.player===p.id && bb.id!==b.id && bb.door>=0) cands.set(bb.door, true);
    for(const r of this.roads.values()){
      if(r.player!==p.id) continue;
      cands.set(r.path[0], true); cands.set(r.path[r.path.length-1], true);
      if(r.isSea) continue;         // auf dem Wasser steht keine Fahne
      for(let k=1;k<r.path.length-1;k++)
        if(!cands.has(r.path[k]) && this.canPlaceFlag(r.path[k], p.id))
          cands.set(r.path[k], false);
    }
    cands.delete(b.door);
    const list=[...cands].map(([f,istFahne])=>({ f, istFahne,
      d:Math.hypot(m.X(f)-m.X(b.door), m.Y(f)-m.Y(b.door)),
      im: hq && (f===hq.door || (hqComp!==undefined && this.compOf(f)===hqComp)) ? 0 : 1 }));
    // Eine vorhandene Fahne gewinnt bei Gleichstand: ein Abzweig kostet eine
    // zusaetzliche Fahne und zerschneidet einen laufenden Weg.
    list.sort((a,b2)=> a.im-b2.im || (a.d+(a.istFahne?0:0.5))-(b2.d+(b2.istFahne?0:0.5)));
    for(const c of list.slice(0,16)){
      const path=this.roadPath(p.id, b.door, c.f);
      if(!path) continue;
      // Umgedreht faengt der Weg beim Anschlusspunkt an. Steht dort noch
      // keine Fahne, setzt createRoad sie selbst (addFlag am Wegende) und
      // addFlag teilt den alten Weg an dieser Stelle - genau der Ablauf,
      // den auch buildRoad fuer den Spieler nimmt.
      this.createRoad(p.id, path.reverse());
      return true;
    }
    return false;
  }

  // ================= Speichern / Laden =================
  serialize(){
    const m=this.map;
    const enc=(arr)=>btoa(String.fromCharCode(...new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)));
    return {
      v:2, setup:this.setup, t:this.t, nextId:NEXT_ID,
      map:{ w:m.w, h:m.h,
        terr:enc(m.terr), hgt:Array.from(m.hgt, v=>Math.round(v*100)/100), obj:enc(m.obj), amt:enc(m.amt),
        oreT:enc(m.oreT), oreA:enc(m.oreA), fish:enc(m.fish), owner:Array.from(m.owner),
        flag:enc(m.flag), explored:enc(m.explored) },
      gate:this.gate,
      players:this.players.map(p=>({...p})),
      buildings:[...this.buildings.values()],
      roads:[...this.roads.values()],
      flagItems:[...this.flagItems.entries()],
      units:this.units, battles:this.battles, ruins:this.ruins,
      signs:[...this.signs.entries()],
      animals:this.animals,
      objectives:this.objectives, over:this.over, winner:this.winner,
      msgs:this.msgs.slice(-40),
      stats:this.stats||null,          // H3: Verlaufskurven ueberdauern das Speichern
    };
  }
  static deserialize(data){
    const g=Object.create(Game.prototype);
    g.setup=data.setup;
    g.rng=mulberry32(((data.setup.seed^data.t)*2654435761)>>>0);
    const dec=(str,T)=>{ const bin=atob(str); const a=new T(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a; };
    const md=data.map;
    const m=new WorldMap(md.w, md.h);
    m.terr=dec(md.terr,Uint8Array); m.hgt=Float32Array.from(md.hgt); m.obj=dec(md.obj,Uint8Array);
    m.amt=dec(md.amt,Uint8Array); m.oreT=dec(md.oreT,Uint8Array); m.oreA=dec(md.oreA,Uint8Array);
    m.fish=dec(md.fish,Uint8Array); m.owner=Int8Array.from(md.owner);
    m.flag=dec(md.flag,Uint8Array); m.explored=dec(md.explored,Uint8Array);
    m.bld=new Int32Array(md.w*md.h).fill(-1);
    m.computePasses();                       // aus Gelände+Höhe ableitbar
    g.map=m; g.gate=data.gate; g.t=data.t;
    g.over=data.over; g.winner=data.winner;
    g.msgs=data.msgs||[]; g.changedNodes=[];
    // ABSTURZ NACH DEM LADEN: hoehenNeu legt nur der Konstruktor an, nicht
    // deserialize. Sobald in einem geladenen Spiel der erste Planierer
    // arbeitete, warf planiere() "Cannot read properties of undefined
    // (reading 'push')" - also beim ersten Neubau nach jedem Laden.
    g.hoehenNeu=[];
    g.territoryVer=1; g.routeVer=1; g._routeCache=new Map(); g._compVer=0; g._comp=new Map();
    g.players=data.players;
    // Transport-Rangfolge (v196): alte Spielstaende kennen sie nicht und
    // bekommen die Voreinstellung. rangListe() fuellt ausserdem Waren nach,
    // die in einem alten Stand noch nicht vorkamen.
    for(const p of g.players) p.rang=rangListe(p.rang);
    g.rangIx=g.players.map(p=>Game.rangIndex(p.rang));
    g.buildings=new Map();
    for(const b of data.buildings){ g.buildings.set(b.id,b); m.bld[b.node]=b.id; }
    g.roads=new Map();
    for(const r of data.roads) g.roads.set(r.id,r);
    g.flagItems=new Map(data.flagItems);
    g.units=data.units||[]; g.battles=data.battles||[];
    g.fx=[]; g.ruins=data.ruins||[];
    g.signs=new Map(data.signs||[]);
    g.difficulty=data.setup.difficulty||'normal';
    g.animals=data.animals||[];
    g.stats=data.stats||null;          // H3: alte Spielstaende fangen bei Null an
    // Alt-Spielstände (v2, Rang-System): Ränge -> Truppentypen, Rekrutenzahl -> Reserve-Objekt
    for(const p of g.players){
      if(typeof p.recruits==='number') p.recruits={sword:p.recruits, spear:0, bow:0};
    }
    const conv=(t)=> typeof t==='string' ? t : 'sword';
    for(const b of g.buildings.values()) if(b.soldiers) b.soldiers=b.soldiers.map(conv);
    for(const u of g.units){
      if(u.type==='attack') u.soldiers=u.soldiers.map(conv);
      if(u.type==='soldierMove' && !u.stype) u.stype='sword';
    }
    // Alt-Spielstände ohne Werkzeug-Wirtschaft: Startwerkzeuge nachlegen
    for(const p of g.players){
      const hq=g.buildings.get(p.hq);
      if(hq && hq.inv && hq.inv.hammer===undefined){ hq.inv.hammer=10; hq.inv.pick=2; }
      if(hq && hq.inv && hq.inv.axe===undefined){
        Object.assign(hq.inv, {axe:3, saw:2, scythe:2, rod:2, cleaver:1, shovel:3});
        hq.inv.pick=(hq.inv.pick||0)+1; hq.inv.bow=(hq.inv.bow||0)+1;
      }
    }
    // Alt-Spielstände: fertige Gebäude gelten als besetzt, Baustellen als planiert;
    // besetzte Gebäude mit Werkzeugberuf gelten als ausgerüstet
    for(const b of g.buildings.values()){
      if(b.leveled===undefined) b.leveled=true;
      // Alt-Baustellen mit Fortschritt zeigen ihr Bild sofort weiter
      if(b.bauerDa===undefined) b.bauerDa= b.state!=='build' || (b.progress||0)>0;
      if(b.paused===undefined) b.paused=false;
      if(b.makeGood===undefined) b.makeGood=null;
      if(b.foodPrio===undefined) b.foodPrio=false;
      if(b.garrison===undefined && BLD[b.type] && BLD[b.type].mil) b.garrison=BLD[b.type].mil.cap;
      // Alt-Spielstände vor der Besetzt-Regel: fertige Militärgebäude zählen
      // weiter zur Grenze (kein überraschender Gebietsverlust beim Laden)
      if(b.besetztWar===undefined && BLD[b.type] && BLD[b.type].mil && b.state==='done') b.besetztWar=true;
      if(b.state==='done' && b.worker && b.worker.present===undefined) b.worker.present=true;
      if(b.state==='done' && b.worker && b.worker.present && b.toolGood===undefined && TOOL_OF[b.type])
        b.toolGood=TOOL_OF[b.type];
    }
    // Reservierungen & halboffene Trägeraufträge nach dem Laden zurücksetzen
    for(const items of g.flagItems.values()) for(const it of items) it.reserved=false;
    for(const r of g.roads.values()){
      const c=r.carrier;
      if(c.state==='toPick'||c.state==='pickup'){ c.state='idle'; c.job=null; }
    }
    g.objectives=data.objectives||[]; g.level=data.setup.level||null;
    NEXT_ID=Math.max(NEXT_ID, data.nextId||1);
    // Alt-Spielstände ohne Wild: Bestand neu ansiedeln (Jagd bleibt möglich)
    if(!g.animals.length) g.spawnAnimals();
    return g;
  }
}
