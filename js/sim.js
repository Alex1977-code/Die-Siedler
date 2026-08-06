// Neuland – Spielsimulation: Wirtschaft, Logistik, Militär, KI.
import { TER, OBJ, BLD, GOODS, GOOD_LIST, FOODS, STYPES, STYPE_LIST, START_GOODS, PROF_OF, TOOL_OF, TOOLS, SAT_PAUSE, SAT_RESUME, MinHeap, clamp } from './core.js';
import { WorldMap, genWorld } from './map.js';
import { mulberry32 } from './core.js';

export const TICK_MS = 100;           // 10 Sim-Ticks pro Sekunde (bei 1x)
const FLAG_CAP = 8;
const CARRY_SPEED = 0.2;              // Knoten pro Tick
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
    }));
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
  // Schwierigkeitsgrad: Startwaren des Spielers, KI-Stärke, Angriffstakt, KI-Materialhilfe
  static diffMods(diff){
    switch(diff){
      case 'leicht': return { startMul:1.35, aiLvl:-1, atkMul:1.6, bonusMul:0.5 };
      case 'schwer': return { startMul:0.8,  aiLvl:+1, atkMul:0.75, bonusMul:1.3 };
      default:       return { startMul:1,    aiLvl:0,  atkMul:1,    bonusMul:1 };
    }
  }

  // ---------- Nachrichten ----------
  msg(txt, type='info', node=-1, player=0){
    if(player!==0) return; // nur menschlicher Spieler (id 0) bekommt Meldungen
    this.msgs.push({ t:this.t, txt, type, node });
    if(this.msgs.length>120) this.msgs.shift();
  }
  // Entdoppelte Warnung: je Gebäude+Grund höchstens einmal pro Minute, je
  // Grund zusätzlich eine kurze Sammel-Sperre über alle Gebäude. Vorher
  // stapelte sich dieselbe Warnung (19x "keine Schaufel" in einem Lauf des
  // Kritikberichts), weil jede Baustelle einzeln und sofort meldete.
  warn(b, reason, txt){
    if(b.player!==0) return;
    b._warnT=b._warnT||{};
    if(b._warnT[reason]!==undefined && this.t-b._warnT[reason]<600) return;   // 60 s je Gebäude
    this._warnG=this._warnG||{};
    if(this._warnG[reason]!==undefined && this.t-this._warnG[reason]<300) return; // 30 s je Grund
    b._warnT[reason]=this.t; this._warnG[reason]=this.t;
    this.msg(txt, 'warn', b.node);
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
    const door = this.pickDoor(node);
    b.door = door;
    if(door>=0 && !this.map.flag[door]) this.addFlag(door);
    this.changedNodes.push(node);
    if(instant && def.mil) this.recalcTerritory();
    if(instant && type==='hq'){ b.soldiers=[]; }
    return b;
  }
  pickDoor(node){
    // Der Eingang liegt IMMER unten: nur die untere Nachbarreihe kommt infrage,
    // bevorzugt der Knoten am nächsten zur Gebäudemitte.
    const m=this.map;
    const nbs=m.nbs(node);
    const my=m.Y(node), mx=m.X(node);
    const lower=nbs.filter(n=>m.Y(n)>my)
      .sort((a,b)=>Math.abs(m.X(a)-mx)-Math.abs(m.X(b)-mx));
    for(const n of lower){
      if(m.flag[n]) return n;                                    // vorhandene Fahne nutzen
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
    if(m.obj[node]!==OBJ.NONE) return {ok:false, r:'Platz blockiert'};
    if(this.roadAt(node)) return {ok:false, r:'Hier verläuft eine Straße'};
    if(def.size==='MINE'){ if(!m.terrOkMine(node)) return {ok:false, r:'Bergwerke nur im Gebirge'}; }
    else {
      if(!m.terrOkBuild(node)) return {ok:false, r:'Untergrund ungeeignet'};
    }
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
      for(const n of lower){
        if(m.flag[n] || (m.terrOkRoad(n) && m.bld[n]<0 && this.roadObjOk(n) && !this.roadAt(n))){ tuer=n; break; }
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
         (m.terrOkRoad(q) && m.bld[q]<0 && this.roadObjOk(q) && !this.unterHaus(q))));
      if(!ausgang) return {ok:false, r:'Eingang wäre eingeschlossen'};
    }
    // Fischer: ohne erreichbares Ufer in Gehweite faengt dort nie jemand
    // etwas - solche Plaetze werden gar nicht erst angeboten. Die Antwort
    // kommt aus einer einmal je Karte berechneten Erreichbarkeitsmaske
    // (Wasser aendert sich im Spielverlauf nicht).
    if(def.gather==='fish' && !this.fischNah()[node])
      return {ok:false, r:'Kein Fischgrund in Gehweite'};
    {
      // Eingang liegt unten: dort muss eine Türfahne möglich sein
      const my=m.Y(node);
      const doorOk=m.nbs(node).some(n=> m.Y(n)>my &&
        (m.flag[n] || (m.terrOkRoad(n) && m.bld[n]<0 && this.roadObjOk(n) && !this.roadAt(n))));
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
    const door=this.pickDoor(node);
    if(door<0) return {ok:false, r:'Kein Platz für die Fahne'};
    return {ok:true};
  }
  placeBuilding(player, type, node){
    const c=this.canBuild(player,type,node); if(!c.ok) return c;
    const b=this.spawnBuilding(player,type,node);
    // Bau-Anforderungen laufen über die Logistik (Bretter/Steine)
    return {ok:true, b};
  }
  demolish(id){
    const b=this.buildings.get(id); if(!b) return;
    this.burnBuilding(b, false);
  }
  burnBuilding(b, byWar=true){
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
    // Kriegsschaden brennt sichtbar nieder und hinterlässt eine Ruine
    if(byWar){
      this.fx.push({type:'burn', node:b.node, t0:this.t, big:BLD[b.type].size==='L'});
      if(this.map.obj[b.node]===OBJ.NONE){
        this.map.obj[b.node]=OBJ.RUIN;
        this.ruins.push({node:b.node, t0:this.t});
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
      if(!used){ this.map.flag[b.door]=0; this.flagItems.delete(b.door); this.routeVer++; this.changedNodes.push(b.door); }
    }
    // Träger/Einheiten dieses Gebäudes entfernen – Bauarbeiter und Planierer
    // bleiben und kehren mit ihrem Werkzeug heim (eigene Heim-Logik)
    this.units = this.units.filter(u=> u.bld!==b.id || u.type==='builder' || u.type==='leveler');
    for(const bt of this.battles) if(bt.bldId===b.id) bt.doneFlag=true;
    if(BLD[b.type].mil || b.type==='hq') this.recalcTerritory();
    if(b.type==='hq') this.checkPlayerDefeat(b.player);
    if(byWar && b.player===0) this.msg(`${BLD[b.type].name} wurde zerstört!`, 'warn', b.node);
  }
  checkPlayerDefeat(pl){
    const p=this.players[pl];
    if(p.defeated) return;
    const hasHQ=[...this.buildings.values()].some(b=>b.player===pl && b.type==='hq');
    if(hasHQ) return;
    p.defeated=true;
    for(const b of [...this.buildings.values()]) if(b.player===pl) this.burnBuilding(b,false);
    this.roadsCleanupForPlayer(pl);
    this.msg(`${p.name} ist besiegt!`, 'war');
    this.recalcTerritory();
    const alive=this.players.filter(q=>!q.defeated);
    if(alive.length===1 && !this.over && !this.objectives.length){
      this.over=true; this.winner=alive[0].id;
    }
  }
  roadsCleanupForPlayer(pl){
    for(const [id,r] of [...this.roads]) if(r.player===pl) this.removeRoad(id);
    for(let i=0;i<this.map.flag.length;i++)
      if(this.map.flag[i] && this.map.owner[i]===pl){ this.map.flag[i]=0; this.flagItems.delete(i); this.changedNodes.push(i); }
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
    this.map.flag[i]=0; this.flagItems.delete(i); this.routeVer++; this.changedNodes.push(i);
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
    if(r.carrier.item) this.dropItem(r.carrier.item);
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
      if(def.prod.outs) return null;
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
    if(b.satPause){ if(tot<=SAT_RESUME) b.satPause=false; }
    else if(tot>=SAT_PAUSE) b.satPause=true;
    return b.satPause;
  }
  // verbleibendes Vorkommen im Umkreis eines Bergwerks
  oreLeft(b){
    const def=BLD[b.type];
    if(!def.mine) return null;
    const m=this.map;
    const targetT={coal:1, ironore:2, gold:3, stone:4}[def.mine];
    let sum=0;
    const seen=new Set();
    for(const n of [b.node, ...m.nbs(b.node)])
      for(const nn of [n, ...m.nbs(n)]){
        if(seen.has(nn)) continue; seen.add(nn);
        if(m.oreT[nn]===targetT) sum+=m.oreA[nn];
      }
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
    const m=this.map; const n=m.w*m.h;
    const best=new Float32Array(n).fill(1e9);
    m.owner.fill(-1);
    for(const b of this.buildings.values()){
      const def=BLD[b.type];
      const milR = (b.type==='hq') ? def.mil.radius : (def.mil && b.state==='done' ? def.mil.radius : 0);
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
        if(m.owner[i]<0){ m.flag[i]=0; this.flagItems.delete(i); this.changedNodes.push(i); }
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
    const near=this.nodesInRange(flagNode,8).some(n=>this.map.terr[n]===TER.MOUNT && !this.signs.has(n));
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
        if(m.terr[n]!==TER.MOUNT || this.signs.has(n) || m.bld[n]>=0) continue;
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
          this.msg(`Geologe: ${name} gefunden!`, 'ok', u.target);
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
    let avail=0;
    for(const {mb} of this.atkSources(pl,b)) avail += Math.max(0, mb.soldiers.length-1);
    return avail;
  }
  attack(pl, bldId, count){
    const target=this.buildings.get(bldId);
    if(!target) return false;
    const sources=this.atkSources(pl, target);
    sources.sort((a,b)=>a.d-b.d);
    const group=[];
    for(const {mb} of sources){
      while(group.length<count && mb.soldiers.length>1){
        mb.soldiers.sort((a,b)=>STYPES[b].str-STYPES[a].str);
        group.push(mb.soldiers.shift()); // stärkste zuerst
      }
      if(group.length>=count) break;
    }
    if(!group.length) return false;
    const [sx,sy]=this.map.worldPos(sources[0].mb.node);
    this.units.push({ id:NEXT_ID++, type:'attack', player:pl, x:sx, y:sy,
      target: target.node, targetB: bldId, soldiers: group, state:'walk' });
    if(target.player===0) this.msg('Wir werden angegriffen!', 'war', target.node);
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
    this.tickRuins();
    if(this.t%2===0) this.tickAnimals();
    if(this.t%10===0) this.tickGrowth();
    if(this.t%10===3) this.tickAI();
    if(this.t%20===7) this.checkObjectives();
  }

  // ---------- Wachstum (Bäume, Felder) ----------
  tickGrowth(){
    const m=this.map;
    // sparsam: pro Aufruf ~200 Zufallsknoten prüfen
    for(let k=0;k<200;k++){
      const i=(this.rng()*m.terr.length)|0;
      const o=m.obj[i];
      if(o===OBJ.SAPLING && this.rng()<0.2){ m.obj[i]=OBJ.TREE2; this.changedNodes.push(i); }
      else if(o===OBJ.TREE2 && this.rng()<0.15){ m.obj[i]=OBJ.TREE; this.changedNodes.push(i); }
      else if(o===OBJ.FIELD0 && this.rng()<0.25){ m.obj[i]=OBJ.FIELD1; this.changedNodes.push(i); }
      else if(o===OBJ.FIELD1 && this.rng()<0.2){ m.obj[i]=OBJ.FIELD2; this.changedNodes.push(i); }
      else if(m.terr[i]===TER.WATER){
        // Fischgründe erholen sich sehr langsam; leere Gewässer werden von
        // benachbarten Beständen wiederbesiedelt
        if(m.fish[i]>0 && m.fish[i]<8 && this.rng()<0.05) m.fish[i]++;
        else if(m.fish[i]===0 && this.rng()<0.02 && m.nbs(i).some(n=>m.fish[n]>=3)) m.fish[i]=1;
      }
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
          let have=0; for(const f of FOODS) have+=(b.stock[f]||0)+(b.incoming[f]||0);
          if(have<2){ reqs.push({b, good:'@food', prio:1}); if(have<1) reqs.push({b, good:'@food', prio:1}); }
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
  findSource(pl, good, destFlag, comp){
    // Quellen: Produktionsausstoß (b.out) oder Lager (inv)
    let best=null, bd=1e9;
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
      if(items && items.length>=FLAG_CAP) continue;
      const d=this.flagDist(f, destFlag);
      if(d<bd){ bd=d; best=b; }
    }
    return best;
  }
  dispatch(){
    const reqs=this.requestsOf();
    reqs.sort((a,b)=>a.prio-b.prio);
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
      if((this.flagItems.get(b.door)?.length||0)>=4) continue;
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
      if(items.length>=FLAG_CAP) continue;
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
          let bestIt=null, bestPr=99;
          for(let k=0;k<items.length;k++){
            const it=items[k];
            const dest=this.buildings.get(it.destB);
            if(!dest){ items.splice(k,1); k--; continue; }
            if(dest.door===f){
              // Ziel direkt an dieser Fahne -> einliefern
              items.splice(k,1); this.deliver(dest, it.good); k--; continue;
            }
            if(it.reserved) continue;
            if(this.nextRoad(f, dest.door)!==r.id) continue;
            const pr = dest.state==='build' ? 0 : (dest.inv ? 2 : 1);
            if(pr<bestPr){ bestPr=pr; bestIt=it; if(pr===0) break; }
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
            this.deliver(dest, c.item.good);
          } else {
            const items=this.flagItems.get(f)||[];
            if(items.length>=FLAG_CAP+4){ this.dropItem(c.item); }
            else { items.push(c.item); this.flagItems.set(f,items); }
          }
          c.item=null; c.state='idle';
        }
      }
    }
  }

  // ---------- Bau ----------
  tickConstruction(){
    for(const b of this.buildings.values()){
      if(b.state!=='build') continue;
      const def=BLD[b.type];
      const needB=def.cost.board||0, needS=def.cost.stone||0;
      // Material komplett + Bauarbeiter (freie Figur mit Hammer) vor Ort
      const builderThere=b.builderId!=null
        && this.units.some(u=>u.id===b.builderId && u.type==='builder' && u.state==='work');
      const haveAll=(b.stock.board||0)>=needB && (b.stock.stone||0)>=needS && builderThere;
      if(!haveAll) continue;
      b.progress += 1;
      const total = 80 + 30*((def.cost.board||0)+(def.cost.stone||0));
      if(b.progress>=total){
        b.state='done'; b.stock={};
        this.changedNodes.push(b.node);
        if(def.mil){ this.recalcTerritory(); }
        // Einzugswanderung: die Fachkraft läuft sichtbar vom Hauptquartier her
        // (mit Werkzeug, sofern der Beruf eines braucht – sonst wartet das Gebäude)
        if(b.worker) this.trySettle(b);
        if(b.player===0) this.msg(`${def.name} fertiggestellt.`, 'ok', b.node);
        this.onBuilt && this.onBuilt(b);
      }
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
        if(this.units.some(u=>u.type==='austrag' && u.bld===b.id)) continue;
        b.worker.state='in';   // Wächter: Figur fehlt (z.B. Altbestand) -> Betrieb weiter
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
        // Waffenschmiede: feste Waffenwahl des Spielers
        if(b.type==='armory' && b.prodT===0 && b.makeGood) b.chosenTool=b.makeGood;
        // mit zugeteiltem Essen arbeitet ein Betrieb deutlich schneller
        const fed=(def.foodBoost||b.foodPrio) && FOODS.some(f=>(b.stock[f]||0)>0);
        b.prodT += fed? 2 : 1;
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
        b.prodT++;
        if(b.prodT>=def.time){
          b.prodT=0;
          // Essen verbrauchen
          let fed=false;
          for(const f of FOODS) if((b.stock[f]||0)>0){ b.stock[f]--; fed=true; break; }
          if(!fed) continue;
          // Erz in Umgebung suchen
          const targetT = {coal:1, ironore:2, gold:3, stone:4}[def.mine];
          let found=false;
          const around=[b.node, ...m.nbs(b.node)];
          for(const n of around){
            for(const nn of [n, ...m.nbs(n)]){
              if(m.oreT[nn]===targetT && m.oreA[nn]>0){ m.oreA[nn]--; found=true; break; }
            }
            if(found) break;
          }
          if(found) this.wareAustragen(b);   // Bergmann bringt das Erz sichtbar zur Fahne
          else {
            if(!b.depleted){ b.depleted=true; if(b.player===0) this.msg(`${def.name}: Vorkommen erschöpft!`, 'warn', b.node); }
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
          } else if(def.gather==='tree'||def.gather==='stone'||def.gather==='fish'||def.gather==='hunt'){
            // Stille Erschöpfung sichtbar machen (Kritikbericht F4: der
            // Steinmetz verstummte einfach, das Bauwesen starb unbemerkt).
            // Erst nach 60 s ohne jede Beute gilt die Umgebung als erschöpft
            // – kurze Lücken (reservierte Bäume, gejagtes Wild) zählen nicht.
            // EINE Meldung je Gebäude; findet sich später wieder etwas,
            // löst sich der Zustand und darf erneut gemeldet werden.
            b.noJobT=(b.noJobT||0)+1;
            if(b.noJobT>=600 && !b.exhausted){
              b.exhausted=true;
              if(b.player===0) this.msg(`${def.name}: nichts mehr in Reichweite – Umgebung erschöpft!`, 'warn', b.node);
            }
          }
        }
      }
    }
  }
  findGatherJob(b){
    const m=this.map, def=BLD[b.type];
    const R=def.range;
    // ausdrücklich nur erreichbare Knoten – siehe nodesWalkable
    const nodes=this.nodesWalkable(b.node, R);
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
  static ACKER_MAX=7;        // Punkte je Fläche (Mitte + Ring)
  static ACKER_N=3;          // höchstens drei Flächen je Hof
  ackerZiel(b, nodes){
    const m=this.map;
    const frei=(i)=> m.obj[i]===OBJ.NONE && m.terr[i]===TER.GRASS && m.bld[i]<0
      && !m.flag[i] && m.owner[i]===b.player && !this.roadAt(i);
    if(!b.aecker) b.aecker=[];
    // Flächen aufräumen: was nicht mehr bestellbar ist, fällt heraus
    b.aecker=b.aecker.filter(a=>a.length);
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
      const rMass=(n)=>{
        const [px,py]=m.worldPos(n);
        const dx=px-ax0, dy=py-ay0;
        // Koordinaten in den gezeichneten Feldachsen (2:1-Iso)
        const pp=(dx/52+dy/26)/2, qq=(dy/26-dx/52)/2;
        return Math.max(Math.abs(pp), Math.abs(qq));
      };
      let best, bm=1e9;
      for(const i of a) for(const n of m.nbs(i)){
        if(!frei(n) || a.includes(n) || fremd.has(n) || !nodes.includes(n)) continue;
        const mv=rMass(n);
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
    const start=nodes.find(i=> frei(i) && !belegt.has(i) && !nahBelegt(i));
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
  nodesWalkable(center, R){
    const m=this.map, out=[], seen=new Set([center]);
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
            if(b.soldiers && b.soldiers.length>0){ b.soldiers.pop(); if(b.player===0) this.msg('Katapultbeschuss auf unser Gebäude!', 'war', b.node); }
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
    const wet=(px,py)=>{ const n=m.nearestNode(px,py); return n>=0 && (m.terr[n]===TER.WATER||m.terr[n]===TER.LAVA); };
    if(wet(u.x+nx*sp*1.6, u.y+ny*sp*1.6)){
      let found=false;
      const s=u._wS||1;
      for(const a2 of [0.7*s,1.4*s,2.1*s,-0.7*s,-1.4*s,-2.1*s]){
        const ca=Math.cos(a2), sa=Math.sin(a2);
        const rx=nx*ca-ny*sa, ry=nx*sa+ny*ca;
        if(!wet(u.x+rx*sp*1.6, u.y+ry*sp*1.6)){
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
  // Kürzester Fußweg über LAND-Knoten (BFS, begrenzt) - der Notausstieg,
  // wenn die gierige Luftlinie in moveToward nicht weiterkommt. Liefert
  // Weltpunkte oder null (Ziel unerreichbar/zu weit).
  landDetour(u, tx, ty){
    const m=this.map;
    const from=m.nearestNode(u.x,u.y), to=m.nearestNode(tx,ty);
    if(from<0 || to<0 || from===to) return null;
    const fest=(n)=> m.terr[n]!==TER.WATER && m.terr[n]!==TER.LAVA;
    if(!fest(to)) return null;
    const prev=new Map([[from,-1]]);
    const q=[from];
    let end=-1;
    for(let qi=0; qi<q.length && qi<700; qi++){
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
        if(b.type==='armory' && b.makeGood) b.chosenTool=b.makeGood;
        // Zykluszeit-Kompensation: der Austragsweg zählt als bereits
        // geleistete Arbeitszeit des nächsten Zyklus (Rate bleibt stabil)
        const dauer=this.t-(u._t0||this.t);
        const zeit=def.prod? def.prod.time : def.time;
        const fed=def.prod && (def.foodBoost||b.foodPrio) && FOODS.some(f=>(b.stock[f]||0)>0);
        if(zeit) b.prodT=Math.max(b.prodT||0, Math.min(zeit-1, dauer*(fed?2:1)));
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
          if(done(16)){ if(m.obj[u.target]===OBJ.NONE){ m.obj[u.target]=OBJ.SAPLING; this.changedNodes.push(u.target);} u.state='back'; }
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
          if(done(20)){ if(m.obj[u.target]===OBJ.NONE){ m.obj[u.target]=OBJ.FIELD0; this.changedNodes.push(u.target);} u.state='back'; }
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
      if(b.soldiers.length<cap) b.soldiers.push(u.stype);
      else this.players[u.player].recruits[u.stype]++;
    }
  }
  returnSoldiers(pl, list){
    const r=this.players[pl].recruits;
    for(const t of list) r[t]=(r[t]||0)+1;
  }
  tickAttack(u){
    const m=this.map;
    const target=this.buildings.get(u.targetB);
    if(!target){ // Ziel weg -> Gruppe kehrt heim (löst sich auf, Soldaten zurück in Reserve)
      u.dead=true; this.returnSoldiers(u.player, u.soldiers); return;
    }
    const [tx,ty]=m.worldPos(target.node);
    if(u.state==='walk'){
      if(this.moveToward(u,tx,ty,WALK_SPEED*0.9)){
        // Baustellen werden niedergerissen, nicht erobert
        if(target.state==='build'){
          if(target.player===0) this.msg(`${BLD[target.type].name}-Baustelle vom Feind zerstört!`, 'war', target.node);
          if(u.player===0) this.msg('Feindliche Baustelle zerstört!', 'ok', target.node);
          this.burnBuilding(target);
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
      if(byPl===0) this.msg('Feindliches Hauptquartier gefallen!', 'ok');
      this.checkPlayerDefeat(oldPl);
      return;
    }
    b.player=byPl;
    b.coins=0; b.incoming={};
    const cap=BLD[b.type].mil.cap;
    b.soldiers=attackers.slice(0,cap);
    this.returnSoldiers(byPl, attackers.slice(cap));
    if(byPl===0) this.msg(`${BLD[b.type].name} erobert!`, 'ok', b.node);
    if(oldPl===0) this.msg(`${BLD[b.type].name} an den Feind verloren!`, 'war', b.node);
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
        while(this.recruitTotal(p.id)<10 && (hq.inv.beer||0)>0 && guard-->0){
          // ausgewogen rekrutieren: den Typ mit der kleinsten Reserve zuerst
          const canDo=STYPE_LIST.filter(t=>{
            for(const w in STYPES[t].weapons) if((hq.inv[w]||0)<STYPES[t].weapons[w]) return false;
            return true;
          });
          if(!canDo.length) break;
          canDo.sort((a,b)=>(p.recruits[a]||0)-(p.recruits[b]||0));
          const t=canDo[0];
          hq.inv.beer--;
          for(const w in STYPES[t].weapons) hq.inv[w]-=STYPES[t].weapons[w];
          p.recruits[t]=(p.recruits[t]||0)+1;
          this.onRecruit && p.id===0 && this.onRecruit();
        }
      }
      // Besatzung auffüllen (gemischte Trupps: stärkste Reserve zuerst)
      if(this.recruitTotal(p.id)>0){
        const milB=[...this.buildings.values()].filter(b=>b.player===p.id && b.soldiers && b.state==='done' && b.type!=='hq');
        milB.sort((a,b)=> (a.soldiers.length/BLD[a.type].mil.cap) - (b.soldiers.length/BLD[b.type].mil.cap));
        for(const b of milB){
          if(this.recruitTotal(p.id)<=0) break;
          const cap=Math.min(BLD[b.type].mil.cap, b.garrison??BLD[b.type].mil.cap);
          const enroute=this.units.filter(u=>u.type==='soldierMove'&&u.targetB===b.id).length;
          if(b.soldiers.length+enroute<cap){
            const t=this.takeRecruit(p.id);
            if(!t) break;
            const src=hq||b;
            // der Rekrut marschiert aus der Tür seines Quartiers ab
            this.units.push({id:NEXT_ID++, type:'soldierMove', player:p.id, ...this.tuerAustritt(src), targetB:b.id, stype:t});
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
    if(b.player===0) this.msg('Ein Esel verstärkt eine Straße.', 'ok', b.node);
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
    if(!path){ if(sy.player===0) this.msg('Werft: kein Seeweg zwischen den Häfen gefunden.', 'warn', sy.node); return; }
    const r={ id:NEXT_ID++, player:sy.player, path, isSea:true,
      carrier:{ pos:0, state:'idle', item:null, job:null } };
    this.roads.set(r.id, r);
    this.routeVer++;
    if(sy.player===0) this.msg('Ein Schiff nimmt den Seeweg zwischen zwei Häfen auf!', 'ok', sy.node);
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
  // Welches Werkzeug fehlt am dringendsten? (null = alles ausreichend vorhanden)
  toolsmithChoose(pl){
    const need={ hammer:2, shovel:2, pick:2 };            // Grundreserve; Rest 1
    for(const t of TOOLS) need[t]=need[t]||1;
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
    for(const t of TOOLS){
      const short=need[t]-(inv[t]||0);
      if(short>bs){ bs=short; best=t; }
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
      if(!src){
        // Warnung nur bei echtem Mangel (nichts im Lager, nichts unterwegs);
        // solange der Mangel anhält, erinnert warn() einmal pro Minute daran
        // statt wie früher nur ein einziges Mal (leicht zu übersehen).
        if(this.toolTrulyMissing(b.player, tool))
          this.warn(b, 'tool:'+tool, `${BLD[b.type].name}: wartet auf Werkzeug (${GOODS[tool].name})!`);
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
      if(!b.leveled){
        if(b.levelerId!=null && this.units.some(u=>u.id===b.levelerId)) continue;
        b.levelerId=null;
        const hq=this.buildings.get(this.players[b.player].hq);
        if(!hq) continue;
        const src=this.findToolStore(b.player,'shovel');
        if(!src){
          // nur bei ECHTEM Mangel warnen (keine Schaufel im Lager UND keine
          // unterwegs) und entdoppelt – siehe warn()/toolTrulyMissing()
          if(this.toolTrulyMissing(b.player,'shovel'))
            this.warn(b,'shovel','Baustelle wartet: keine Schaufel für den Planierer!');
          continue;
        }
        this.takeTool(src,'shovel');
        const u={ id:NEXT_ID++, type:'leveler', player:b.player, ...this.tuerAustritt(hq),
          bld:b.id, state:'toSite', pt:0,
          wp:this.flagWaypoints(hq.door, b.door)||undefined, wpi:0 };
        this.units.push(u);
        b.levelerId=u.id;
        continue;
      }
      // Phase 2: Bauarbeiter mit Hammer
      if(b.builderId!=null && this.units.some(u=>u.id===b.builderId)) continue;
      b.builderId=null;
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
  tickLeveler(u){
    const m=this.map;
    const b=this.buildings.get(u.bld);
    if(u.state!=='home' && (!b || b.state!=='build' || b.leveled)) u.state='home';
    if(u.state==='toSite'){
      if(!this.routeStep(u,WALK_SPEED)) return;      // erst der Straße folgen
      const [tx,ty]=m.worldPos(b.node);
      // Geduldsfaden: erreicht er den Punkt vor dem Haus trotz Nähe lange
      // nicht (Hindernis-Ausweichen lenkt ab), fängt er dort an, wo er steht.
      // Das Ebnen hängt nicht am exakten Punkt - ewiges Herumtippeln fiele
      // dagegen sofort auf.
      const nah=Math.hypot(tx-8-u.x, ty+13-u.y)<80;
      if(nah) u.stallT=(u.stallT||0)+1;
      if(this.moveToward(u,tx-8,ty+13,WALK_SPEED) || (nah && u.stallT>60)){
        u.state='work'; b.levelT=0; u.stallT=0;
      }
    } else if(u.state==='work'){
      // Vier Stellen VOR dem Bauplatz (nie durch das Gebäude). An jeder wird
      // eine Weile GEGRABEN, erst dann geht es zur nächsten. Vorher lief der
      // Planierer den Bogen pausenlos ab - das sah aus, als tanzte er um
      // seine Schaufel, und die Grab-Animation kam nie zum Zug.
      const [bx,by]=m.worldPos(b.node);
      const spots=[[bx-15,by+11],[bx-5,by+15],[bx+6,by+15],[bx+15,by+11]];
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
      if(b.levelT>=70){ b.leveled=true; u.atSpot=false; u.state='home'; }
    } else if(u.state==='home'){
      const hq=this.buildings.get(this.players[u.player].hq);
      if(!hq){ u.dead=true; return; }
      if(!u._homeWp){
        u._homeWp=true;
        u.wp=(b && this.map.flag[b.door] ? this.flagWaypoints(b.door, hq.door) : null)||[];
        u.wpi=0;
      }
      if(!this.routeStep(u,WALK_SPEED)) return;
      const [tx,ty]=this.tuerPos(hq);                    // heim durch die HQ-Tür
      if(this.moveToward(u,tx,ty,WALK_SPEED)){
        u.dead=true;
        if(hq.inv) hq.inv.shovel=(hq.inv.shovel||0)+1;   // Schaufel zurück ins Lager
      }
    }
  }
  tickBuilder(u){
    const m=this.map;
    const b=this.buildings.get(u.bld);
    // Baustelle weg oder fertig -> heim ins Hauptquartier (Hammer zurück)
    if(u.state!=='home' && (!b || b.state!=='build')) u.state='home';
    if(u.state==='toSite'){
      if(!this.routeStep(u,WALK_SPEED)) return;      // erst der Straße folgen
      const [tx,ty]=m.worldPos(b.node);
      if(this.moveToward(u,tx+10,ty+13,WALK_SPEED)){ u.state='work'; u.pt=0; }
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
        // nur hämmern, wenn Material da ist (sonst wartet er sichtbar)
        const def=BLD[b.type];
        if((b.stock.board||0)>=(def.cost.board||0) && (b.stock.stone||0)>=(def.cost.stone||0)){
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
      if(!this.routeStep(u,WALK_SPEED)) return;
      const [tx,ty]=this.tuerPos(hq);                    // heim durch die HQ-Tür
      if(this.moveToward(u,tx,ty,WALK_SPEED)){
        u.dead=true;
        if(hq.inv) hq.inv.hammer=(hq.inv.hammer||0)+1;   // Werkzeug zurück ins Lager
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
      if(o.done) this.msg(`Ziel erreicht: ${o.desc}`, 'ok');
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
  aiCount(p, type, includeBuild=true){
    let n=0;
    for(const b of this.buildings.values())
      if(b.player===p.id && b.type===type && (includeBuild || b.state==='done')) n++;
    return n;
  }
  aiStep(p){
    const m=this.map;
    const hq=this.buildings.get(p.hq);
    if(!hq) return;
    const inv=this.invTotal(p.id);
    const lvl=p.aiLevel;
    // KI-Bonus: leichte Materialhilfe je Level (hält das Spiel spannend, KI "mogelt" milde)
    const dm=Game.diffMods(this.difficulty);
    if(this.t-(p.aiState.lastBonus||0)>=600/dm.bonusMul && hq.inv){
      p.aiState.lastBonus=this.t;
      hq.inv.board=(hq.inv.board||0)+2*lvl;
      hq.inv.stone=(hq.inv.stone||0)+1*lvl;
      hq.inv.hammer=(hq.inv.hammer||0)+3;   // Bauarbeiter-Hämmer
      // Werkzeuge für die KI-Wirtschaft (Axt, Säge, Sense, Angel, Schaufel, Spitzhacke, Beil)
      for(const t of ['axe','saw','scythe','rod','shovel','cleaver']) hq.inv[t]=(hq.inv[t]||0)+1;
      hq.inv.pick=(hq.inv.pick||0)+2;
      if(lvl>=2){ hq.inv.beer=(hq.inv.beer||0)+1; hq.inv.sword=(hq.inv.sword||0)+1; hq.inv.shield=(hq.inv.shield||0)+1; }
    }
    const want=[];
    const c=(t)=>this.aiCount(p,t);
    // Bauplan (Reihenfolge = Priorität)
    if(c('woodcutter')<2) want.push('woodcutter');
    if(c('sawmill')<1) want.push('sawmill');
    if(c('quarry')<1+((lvl>1)?1:0)) want.push('quarry');
    if(c('forester')<1) want.push('forester');
    // Militär-Ausbau ruht während der Nachbau-Bremse (siehe burnBuilding):
    // frisch zerstörte Posten werden nicht im Sekundentakt ersetzt.
    if(c('barracks')+c('guardhouse')+c('watchtower')+c('fortress') < 2 + Math.floor(this.t/3000)*lvl
       && this.t>=(p.aiState.milCd||0)) want.push('@mil');
    if(c('fisher')<1) want.push('fisher');
    if(c('well')<1) want.push('well');
    if(c('farm')<1) want.push('farm');
    if(c('mill')<1) want.push('mill');
    if(c('bakery')<1) want.push('bakery');
    if(c('coalmine')<1) want.push('coalmine');
    if(c('ironmine')<1) want.push('ironmine');
    if(c('smelter')<1) want.push('smelter');
    if(c('toolsmith')<1) want.push('toolsmith');
    if(c('armory')<1) want.push('armory');
    if(c('brewery')<1) want.push('brewery');
    if(lvl>=2 && c('goldmine')<1) want.push('goldmine');
    if(lvl>=2 && c('mint')<1) want.push('mint');
    if(c('woodcutter')<3) want.push('woodcutter');
    if(c('hunter')<1) want.push('hunter');

    const boards=inv.board||0, stones=inv.stone||0;
    for(const w of want){
      const type = w==='@mil' ? (stones>=5&&lvl>=2 ? 'guardhouse' : 'barracks') : w;
      const def=BLD[type];
      if(boards<(def.cost.board||0) || stones<(def.cost.stone||0)) continue;
      const spot=this.aiFindSpot(p, type);
      if(spot<0) continue;
      const r=this.placeBuilding(p.id, type, spot);
      if(r.ok){
        this.aiConnect(p, r.b);
        break; // ein Gebäude pro Zug
      }
    }
    // Angreifen?
    if(this.t-p.aiState.lastAttack > 1200*dm.atkMul/lvl){
      const myS=this.soldierCount(p.id);
      let best=null, bs=1e9;
      for(const b of this.buildings.values()){
        if(b.player===p.id || b.player<0) continue;
        if(this.players[b.player]?.defeated) continue;
        if(!(BLD[b.type].mil||b.type==='hq')) continue;
        const avail=this.attackable(p.id, b.id);
        if(avail<2) continue;
        const defN=(b.soldiers?.length||0)+(b.type==='hq'?this.recruitTotal(b.player):0);
        if(avail >= defN*1.3+1){
          const d=Math.hypot(m.X(b.node)-m.X(hq.node), m.Y(b.node)-m.Y(hq.node));
          if(d<bs){ bs=d; best={b, n:Math.min(avail, defN+3)}; }
        }
      }
      if(best){
        p.aiState.lastAttack=this.t;
        this.attack(p.id, best.b.id, best.n);
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
    for(let k=0;k<sampleN;k++){
      const i=own[(this.rng()*own.length)|0];
      if(!this.canBuild(p.id,type,i).ok) continue;
      let s=this.rng()*2;
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
        s+=nearNodes.filter(n=>m.oreT[n]===targetT&&m.oreA[n]>0).length*4;
        s+=[i,...m.nbs(i)].filter(n=>m.oreT[n]===targetT&&m.oreA[n]>0).length*8;
        if(s<4) continue;
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
        s+= -ed*0.25;
      } else {
        // Nähe zum HQ bevorzugen
        const d=Math.hypot(m.X(hq.node)-m.X(i), m.Y(hq.node)-m.Y(i));
        s+= -d*0.3;
      }
      if(s>bs){ bs=s; best=i; }
    }
    return best;
  }
  aiConnect(p, b){
    // Straße von b.door zur nächsten eigenen Fahne mit Netz
    const m=this.map;
    const flags=[];
    for(const bb of this.buildings.values()) if(bb.player===p.id && bb.id!==b.id) flags.push(bb.door);
    for(const r of this.roads.values()) if(r.player===p.id){ flags.push(r.path[0], r.path[r.path.length-1]); }
    let best=null, bd=1e9;
    for(const f of new Set(flags)){
      if(f===b.door) continue;
      const d=Math.hypot(m.X(f)-m.X(b.door), m.Y(f)-m.Y(b.door));
      if(d<bd){ bd=d; best=f; }
    }
    if(best==null) return;
    const path=this.roadPath(p.id, b.door, best);
    if(path) this.createRoad(p.id, path.reverse());
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
    g.territoryVer=1; g.routeVer=1; g._routeCache=new Map(); g._compVer=0; g._comp=new Map();
    g.players=data.players;
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
      if(b.paused===undefined) b.paused=false;
      if(b.makeGood===undefined) b.makeGood=null;
      if(b.foodPrio===undefined) b.foodPrio=false;
      if(b.garrison===undefined && BLD[b.type] && BLD[b.type].mil) b.garrison=BLD[b.type].mil.cap;
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
