// Neuland – Spielsimulation: Wirtschaft, Logistik, Militär, KI.
import { TER, OBJ, BLD, GOODS, GOOD_LIST, FOODS, RANKS, START_GOODS, MinHeap, clamp } from './core.js';
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
    this.signs = new Map();           // nodeIdx -> Erztyp (0=nichts,1=Kohle,2=Eisen,3=Gold,4=Granit)
    this.players = setup.players.map((p,i)=>({
      id:i, name:p.name, ai:!!p.ai, aiLevel:p.aiLevel||1, defeated:false,
      recruits: 4, aiState:{phase:0, lastAttack:0, wait:0},
    }));
    this.level = setup.level || null;
    this.objectives = (setup.objectives||[]).map(o=>({...o, done:false, prog:0}));
    // Startaufstellung
    gen.starts.forEach((node,i)=>{
      if(i>=this.players.length) return;
      const hq = this.spawnBuilding(i,'hq',node,true);
      hq.inv = {...START_GOODS};
      if(setup.startBoost) for(const k in hq.inv) hq.inv[k] = Math.ceil(hq.inv[k]*setup.startBoost);
      this.players[i].hq = hq.id;
    });
    this.recalcTerritory();
    this.exploreAll(0);
  }

  // ---------- Nachrichten ----------
  msg(txt, type='info', node=-1, player=0){
    if(player!==0) return; // nur menschlicher Spieler (id 0) bekommt Meldungen
    this.msgs.push({ t:this.t, txt, type, node });
    if(this.msgs.length>120) this.msgs.shift();
  }

  // ---------- Gebäude ----------
  spawnBuilding(player, type, node, instant=false){
    const def = BLD[type];
    const b = {
      id: NEXT_ID++, type, player, node,
      state: instant?'done':'build',           // build -> done -> burn
      progress: 0,
      stock: {},                                // Baumaterial / Produktionsinput
      out: 0,                                   // fertige Ware wartet auf Abtransport (Anzahl)
      incoming: {},                             // unterwegs
      inv: def.store? {} : undefined,           // Lagerbestand
      soldiers: def.mil? [] : undefined,        // Ränge stationierter Soldaten
      coins: 0, promoT: 0,
      worker: def.gather||def.mine||def.prod||def.cata ? { present: instant, state:'in', timer:0, target:-1, x:0,y:0 } : null,
      prodT: 0, foodT: 0, burnT: 0,
    };
    this.map.bld[node] = b.id;
    this.buildings.set(b.id, b);
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
    const nbs = this.map.nbs(node);
    // bevorzugt SE/SW (untere Reihe)
    const my = this.map.Y(node);
    const sorted = nbs.slice().sort((a,b)=> (this.map.Y(b)-my)-(this.map.Y(a)-my));
    for(const n of sorted){
      if(this.map.terrOkRoad(n) && this.map.bld[n]<0 && this.map.obj[n]===OBJ.NONE) return n;
      if(this.map.flag[n]) return n;
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
      if(def.size!=='S'){
        let free=0;
        for(const n of m.nbs(node)) if(m.bld[n]<0 && m.terr[n]!==TER.WATER && m.terr[n]!==TER.LAVA && m.terr[n]!==TER.MOUNT) free++;
        if(free < (def.size==='L'?5:4)) return {ok:false, r:'Zu wenig Platz (größeres Gebäude)'};
      }
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
    this.map.bld[b.node] = -1;
    this.buildings.delete(b.id);
    this.changedNodes.push(b.node);
    // verwaiste Türfahne aufräumen (wenn keine Straße und kein anderes Gebäude sie nutzt)
    if(b.door>=0 && this.map.flag[b.door]){
      const used=[...this.buildings.values()].some(o=>o.door===b.door)
        || [...this.roads.values()].some(r=>r.path[0]===b.door||r.path[r.path.length-1]===b.door);
      if(!used){ this.map.flag[b.door]=0; this.flagItems.delete(b.door); this.routeVer++; this.changedNodes.push(b.door); }
    }
    // Träger/Einheiten dieses Gebäudes entfernen
    this.units = this.units.filter(u=> u.bld!==b.id);
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
  canPlaceFlag(i, player){
    const m=this.map;
    if(m.owner[i]!==player) return false;
    if(m.flag[i] || m.bld[i]>=0 || m.obj[i]!==OBJ.NONE) return false;
    if(!m.terrOkRoad(i)) return false;
    for(const n of m.nbs(i)) if(m.flag[n]) return false; // Mindestabstand wie im Klassiker
    return true;
  }
  addFlag(i){ this.map.flag[i]=1; if(!this.flagItems.has(i)) this.flagItems.set(i,[]); this.routeVer++; this.changedNodes.push(i); }
  placeFlag(i, player){
    if(!this.canPlaceFlag(i,player)) return false;
    this.addFlag(i);
    // liegt die Fahne auf einer Straße? -> Straße teilen
    for(const [id,r] of [...this.roads]){
      const k=r.path.indexOf(i);
      if(k>0 && k<r.path.length-1){
        const p1=r.path.slice(0,k+1), p2=r.path.slice(k);
        this.removeRoad(id, true);
        this.createRoad(r.player, p1); this.createRoad(r.player, p2);
        break;
      }
    }
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
  // A*-Straßenpfad von Fahne zu Ziel (nur eigenes Gebiet, passierbar, keine Gebäude, kein Kreuzen anderer Straßen außer an Fahnen)
  roadPath(player, from, to){
    const m=this.map;
    if(from===to) return null;
    const onRoad=new Set();
    for(const r of this.roads.values()) r.path.forEach((n,ix)=>{ if(ix>0&&ix<r.path.length-1) onRoad.add(n); });
    const okNode=(n)=> m.owner[n]===player && m.terrOkRoad(n) && m.bld[n]<0 &&
      (m.obj[n]===OBJ.NONE) && (!onRoad.has(n) || n===to) ;
    if(!okNode(to) && !m.flag[to]) return null;
    const h=(n)=>{ const dx=m.X(n)-m.X(to), dy=m.Y(n)-m.Y(to); return Math.sqrt(dx*dx+dy*dy); };
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
        const ng=g.get(cur)+1;
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
    const end=path[path.length-1];
    if(!this.map.flag[end]){
      if(!this.canPlaceFlag(end,player)) return false;
      this.addFlag(end);
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
  prodGood(b){
    const def=BLD[b.type];
    if(def.out) return def.out;
    if(def.prod) return b.altOut && def.prod.out2 ? def.prod.out2 : def.prod.out;
    if(def.mine) return def.mine;
    return null;
  }
  soldierCount(pl){
    let n=0;
    for(const b of this.buildings.values()) if(b.player===pl && b.soldiers) n+=b.soldiers.length;
    for(const u of this.units) if(u.player===pl && u.type==='attack') n+=u.soldiers.length;
    return n + this.players[pl].recruits;
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
  callGeologist(pl, flagNode){
    if(!this.map.flag[flagNode]) return false;
    const near=this.nodesInRange(flagNode,6).some(n=>this.map.terr[n]===TER.MOUNT && !this.signs.has(n));
    if(!near) return false;
    const hq=this.buildings.get(this.players[pl].hq);
    const [sx,sy]=this.map.worldPos((hq||{node:flagNode}).node);
    this.units.push({ id:NEXT_ID++, type:'geo', player:pl, x:sx, y:sy,
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
      for(const n of this.nodesInRange(u.flag,6)){
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
        if(u.player===0 && ore){
          const name=['','Kohle','Eisenerz','Golderz','Granit'][ore];
          this.msg(`Geologe: ${name} gefunden!`, 'ok', u.target);
        }
        u.state='seek';
      }
    } else if(u.state==='home'){
      const hq=this.buildings.get(this.players[u.player].hq);
      const [tx,ty]=hq? m.worldPos(hq.node):[u.x,u.y];
      if(this.moveToward(u,tx,ty,WALK_SPEED)) u.dead=true;
    }
  }

  // ---------- Angriff ----------
  attackable(pl, bldId){
    const b=this.buildings.get(bldId);
    if(!b || b.player===pl) return 0;
    if(!(BLD[b.type].mil || b.type==='hq')) return 0;
    // verfügbare Angreifer: aus Militärgebäuden in Reichweite (Distanz < 30), je Gebäude bleibt 1
    let avail=0;
    for(const mb of this.buildings.values()){
      if(mb.player!==pl || !mb.soldiers || mb.state!=='done') continue;
      const d=Math.hypot(this.map.X(mb.node)-this.map.X(b.node), this.map.Y(mb.node)-this.map.Y(b.node));
      if(d>30) continue;
      avail += Math.max(0, mb.soldiers.length-1);
    }
    return avail;
  }
  attack(pl, bldId, count){
    const target=this.buildings.get(bldId);
    if(!target) return false;
    const sources=[];
    for(const mb of this.buildings.values()){
      if(mb.player!==pl || !mb.soldiers || mb.state!=='done') continue;
      const d=Math.hypot(this.map.X(mb.node)-this.map.X(target.node), this.map.Y(mb.node)-this.map.Y(target.node));
      if(d>30) continue;
      sources.push({mb, d});
    }
    sources.sort((a,b)=>a.d-b.d);
    const group=[];
    for(const {mb} of sources){
      while(group.length<count && mb.soldiers.length>1){
        group.push(mb.soldiers.sort((a,b)=>b-a).shift()); // stärkste zuerst
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
  step(){
    this.t++;
    const m=this.map;
    if(this.t%20===0) this.dispatch();
    this.tickConstruction();
    this.tickProduction();
    this.tickCarriers();
    this.tickUnits();
    this.tickBattles();
    this.tickMilitary();
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
    }
  }

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
        if(def.mine){
          let have=0; for(const f of FOODS) have+=(b.stock[f]||0)+(b.incoming[f]||0);
          if(have<2){ reqs.push({b, good:'@food', prio:1}); if(have<1) reqs.push({b, good:'@food', prio:1}); }
        }
        if(def.cata){
          const need=2-(b.stock.stone||0)-(b.incoming.stone||0);
          for(let k=0;k<need;k++) reqs.push({b, good:'stone', prio:2});
        }
        if(def.mil && b.soldiers){
          // Münzen für Beförderung
          if(b.coins + (b.incoming.coin||0) < 2 && b.soldiers.some(r=>r<RANKS.length-1))
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
      if(c.state==='toPick'){
        c.pos += Math.sign(c.targetIx-c.pos)*CARRY_SPEED;
        if(Math.abs(c.pos-c.targetIx)<CARRY_SPEED){ c.pos=c.targetIx; c.state='pickup'; }
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
      }
      if(c.state==='carry'){
        c.pos += Math.sign(c.targetIx-c.pos)*CARRY_SPEED;
        if(Math.abs(c.pos-c.targetIx)<CARRY_SPEED){
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
      const haveAll=(b.stock.board||0)>=needB && (b.stock.stone||0)>=needS;
      if(!haveAll) continue;
      b.progress += 1;
      const total = 80 + 30*((def.cost.board||0)+(def.cost.stone||0));
      if(b.progress>=total){
        b.state='done'; b.stock={};
        if(b.worker) b.worker.present=true;
        this.changedNodes.push(b.node);
        if(def.mil){ this.recalcTerritory(); }
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
      if(def.prod){
        if(b.out>=4) continue;
        // Brunnen ohne Inputs
        let ok=true;
        for(const g in def.prod.inputs) if((b.stock[g]||0)<def.prod.inputs[g]) ok=false;
        if(!ok){ b.prodT=0; continue; }
        b.prodT++;
        if(b.prodT>=def.prod.time){
          b.prodT=0;
          for(const g in def.prod.inputs) b.stock[g]-=def.prod.inputs[g];
          if(def.prod.out2){ b.altOut=!b.altOut; }
          b.out++;
          this.onProduce && this.onProduce(b);
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
          if(found){ b.out++; this.onProduce && this.onProduce(b); }
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
        if(b.worker.timer >= def.time*0.4 && b.out<4){
          const job=this.findGatherJob(b);
          if(job!==null){
            b.worker.timer=0;
            const [bx,by]=m.worldPos(b.node);
            const u={ id:NEXT_ID++, type:'worker', wtype:b.type, player:b.player, bld:b.id,
              x:bx, y:by, target:job.node, jobKind:job.kind, state:'go', actT:0 };
            this.units.push(u);
            b.worker.state='out';
            if(job.reserve) m.obj[job.node]|=128; // reserviert-Bit
          }
        }
      }
    }
  }
  findGatherJob(b){
    const m=this.map, def=BLD[b.type];
    const R=def.range;
    const nodes=this.nodesInRange(b.node, R);
    const un=(o)=>o&127;
    switch(def.gather){
      case 'tree': {
        const t=nodes.find(i=> un(m.obj[i])===OBJ.TREE && !(m.obj[i]&128));
        return t!==undefined? {node:t, kind:'chop', reserve:true} : null;
      }
      case 'plant': {
        const t=nodes.find(i=> m.obj[i]===OBJ.NONE && m.terr[i]===TER.GRASS && m.bld[i]<0 && !m.flag[i] && m.owner[i]===b.player);
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
        const forest=nodes.filter(i=> un(m.obj[i])===OBJ.TREE);
        if(forest.length>=4 && this.rng()<0.8){
          return {node:forest[(this.rng()*forest.length)|0], kind:'hunt', reserve:false};
        }
        return null;
      }
      case 'farm': {
        const ripe=nodes.find(i=> m.obj[i]===OBJ.FIELD2);
        if(ripe!==undefined) return {node:ripe, kind:'harvest', reserve:false};
        if(b.out<2){
          const empty=nodes.find(i=> m.obj[i]===OBJ.NONE && m.terr[i]===TER.GRASS && m.bld[i]<0 && !m.flag[i] && m.owner[i]===b.player);
          if(empty!==undefined) return {node:empty, kind:'sow', reserve:false};
        }
        return null;
      }
    }
    return null;
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

  // ---------- Einheiten ----------
  tickUnits(){
    const m=this.map;
    for(const u of this.units){
      if(u.type==='worker') this.tickWorker(u);
      else if(u.type==='attack') this.tickAttack(u);
      else if(u.type==='geo') this.tickGeo(u);
      else if(u.type==='soldierMove') this.tickSoldierMove(u);
      else if(u.type==='boulder'){
        u.prog+=0.02;
        const t2=Math.min(1,u.prog);
        u.x=u.sx+(u.tx-u.sx)*t2;
        u.y=u.sy+(u.ty-u.sy)*t2 - Math.sin(t2*Math.PI)*46;
        if(u.prog>=1){
          u.dead=true;
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
    if(d<=sp){ u.x=tx; u.y=ty; return true; }
    u.x+=dx/d*sp; u.y+=dy/d*sp;
    return false;
  }
  tickWorker(u){
    const m=this.map;
    const b=this.buildings.get(u.bld);
    if(!b){ u.dead=true; return; }
    const [tx,ty]=m.worldPos(u.target);
    const [hx,hy]=m.worldPos(b.node);
    if(u.state==='go'){
      if(this.moveToward(u,tx,ty,WALK_SPEED)) { u.state='act'; u.actT=0; }
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
            if(w!==undefined){ m.fish[w]--; u.carry='fish'; }
            u.state='back'; }
          break;
        case 'hunt':
          if(done(40)){ if(this.rng()<0.75) u.carry='meat'; u.state='back'; }
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
      if(this.moveToward(u,hx,hy,WALK_SPEED)){
        if(u.carry){ b.out=Math.min(6,(b.out||0)+1); }
        u.dead=true;
        if(b.worker){ b.worker.state='in'; b.worker.timer=0; }
      }
    }
  }
  tickSoldierMove(u){
    const m=this.map;
    const b=this.buildings.get(u.targetB);
    if(!b || b.state!=='done' || !b.soldiers){ // Gebäude weg -> zurück ins HQ (Rekrut zurück)
      u.dead=true; this.players[u.player].recruits++; return;
    }
    const [tx,ty]=m.worldPos(b.node);
    if(this.moveToward(u,tx,ty,WALK_SPEED)){
      u.dead=true;
      const cap=BLD[b.type].mil.cap;
      if(b.soldiers.length<cap) b.soldiers.push(u.rank);
      else this.players[u.player].recruits++;
    }
  }
  tickAttack(u){
    const m=this.map;
    const target=this.buildings.get(u.targetB);
    if(!target){ // Ziel weg -> Gruppe kehrt heim (löst sich auf, Soldaten zurück in Reserve)
      u.dead=true; this.players[u.player].recruits+=u.soldiers.length; return;
    }
    const [tx,ty]=m.worldPos(target.node);
    if(u.state==='walk'){
      if(this.moveToward(u,tx,ty,WALK_SPEED*0.9)){
        u.state='fight';
        this.battles.push({ bldId:target.id, attPlayer:u.player, roundT:0, unitId:u.id });
        this.onBattleStart && this.onBattleStart(target);
      }
    }
    // 'fight' übernimmt tickBattles
  }
  tickBattles(){
    for(const bt of this.battles){
      if(bt.doneFlag) continue;
      const u=this.units.find(x=>x.id===bt.unitId && x.type==='attack');
      if(!u){ bt.doneFlag=true; continue; }
      const b=this.buildings.get(bt.bldId);
      if(!b){ bt.doneFlag=true; u.dead=true; this.players[bt.attPlayer].recruits+=u.soldiers.length; continue; }
      bt.roundT++;
      if(bt.roundT<10) continue;
      bt.roundT=0;
      // Verteidiger: stationierte Soldaten, HQ nutzt Rekruten als Miliz
      let defRank=-1;
      if(b.soldiers && b.soldiers.length) defRank=b.soldiers[b.soldiers.length-1];
      else if(b.type==='hq' && this.players[b.player].recruits>0) defRank=0;
      if(defRank<0){
        // erobert!
        this.captureBuilding(b, bt.attPlayer, u.soldiers);
        bt.doneFlag=true; u.dead=true;
        continue;
      }
      if(!u.soldiers.length){ bt.doneFlag=true; u.dead=true; continue; }
      const atkRank=u.soldiers[u.soldiers.length-1];
      const p=0.5+(atkRank-defRank)*0.12;
      this.onClash && this.onClash(b);
      if(this.rng()<clamp(p,0.12,0.88)){
        if(b.soldiers && b.soldiers.length) b.soldiers.pop();
        else this.players[b.player].recruits--;
      } else {
        u.soldiers.pop();
      }
    }
    this.battles=this.battles.filter(bt=>!bt.doneFlag);
  }
  captureBuilding(b, byPl, attackers){
    const oldPl=b.player;
    if(b.type==='hq'){
      // HQ wird niedergebrannt
      this.burnBuilding(b);
      this.players[byPl].recruits+=attackers.length;
      if(byPl===0) this.msg('Feindliches Hauptquartier gefallen!', 'ok');
      this.checkPlayerDefeat(oldPl);
      return;
    }
    b.player=byPl;
    b.coins=0; b.incoming={};
    const cap=BLD[b.type].mil.cap;
    b.soldiers=attackers.slice(0,cap);
    const extra=attackers.length-b.soldiers.length;
    if(extra>0) this.players[byPl].recruits+=extra;
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
      // Rekrutierung im HQ: Bier+Schwert+Schild -> Rekrut
      const hq=this.buildings.get(p.hq);
      if(hq && hq.inv){
        while(p.recruits<10 && (hq.inv.beer||0)>0 && (hq.inv.sword||0)>0 && (hq.inv.shield||0)>0){
          hq.inv.beer--; hq.inv.sword--; hq.inv.shield--;
          p.recruits++;
          this.onRecruit && p.id===0 && this.onRecruit();
        }
      }
      // Besatzung auffüllen
      if(p.recruits>0){
        const milB=[...this.buildings.values()].filter(b=>b.player===p.id && b.soldiers && b.state==='done' && b.type!=='hq');
        milB.sort((a,b)=> (a.soldiers.length/BLD[a.type].mil.cap) - (b.soldiers.length/BLD[b.type].mil.cap));
        for(const b of milB){
          if(p.recruits<=0) break;
          const cap=BLD[b.type].mil.cap;
          const enroute=this.units.filter(u=>u.type==='soldierMove'&&u.targetB===b.id).length;
          if(b.soldiers.length+enroute<cap){
            p.recruits--;
            const src=hq||b;
            const [sx,sy]=this.map.worldPos(src.node);
            this.units.push({id:NEXT_ID++, type:'soldierMove', player:p.id, x:sx, y:sy, targetB:b.id, rank:0});
          }
        }
      }
      // Beförderungen
      for(const b of this.buildings.values()){
        if(b.player!==p.id || !b.soldiers || !b.coins) continue;
        b.promoT=(b.promoT||0)+1;
        if(b.promoT>=4){
          b.promoT=0;
          const ix=b.soldiers.findIndex(r=>r<RANKS.length-1);
          if(ix>=0){ b.soldiers[ix]++; b.coins--; if(p.id===0) this.onPromote && this.onPromote(b); }
        }
      }
    }
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
    if(this.t-(p.aiState.lastBonus||0)>=600 && hq.inv){
      p.aiState.lastBonus=this.t;
      hq.inv.board=(hq.inv.board||0)+2*lvl;
      hq.inv.stone=(hq.inv.stone||0)+1*lvl;
      if(lvl>=2){ hq.inv.beer=(hq.inv.beer||0)+1; hq.inv.sword=(hq.inv.sword||0)+1; hq.inv.shield=(hq.inv.shield||0)+1; }
    }
    const want=[];
    const c=(t)=>this.aiCount(p,t);
    // Bauplan (Reihenfolge = Priorität)
    if(c('woodcutter')<2) want.push('woodcutter');
    if(c('sawmill')<1) want.push('sawmill');
    if(c('quarry')<1+((lvl>1)?1:0)) want.push('quarry');
    if(c('forester')<1) want.push('forester');
    if(c('barracks')+c('guardhouse')+c('watchtower')+c('fortress') < 2 + Math.floor(this.t/3000)*lvl) want.push('@mil');
    if(c('fisher')<1) want.push('fisher');
    if(c('well')<1) want.push('well');
    if(c('farm')<1) want.push('farm');
    if(c('mill')<1) want.push('mill');
    if(c('bakery')<1) want.push('bakery');
    if(c('coalmine')<1) want.push('coalmine');
    if(c('ironmine')<1) want.push('ironmine');
    if(c('smelter')<1) want.push('smelter');
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
    if(this.t-p.aiState.lastAttack > 1200/lvl){
      const myS=this.soldierCount(p.id);
      let best=null, bs=1e9;
      for(const b of this.buildings.values()){
        if(b.player===p.id || b.player<0) continue;
        if(this.players[b.player]?.defeated) continue;
        if(!(BLD[b.type].mil||b.type==='hq')) continue;
        const avail=this.attackable(p.id, b.id);
        if(avail<2) continue;
        const defN=(b.soldiers?.length||0)+(b.type==='hq'?this.players[b.player].recruits:0);
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
      else if(def.gather==='hunt') s+=nearNodes.filter(n=>un(m.obj[n])===OBJ.TREE).length*0.6;
      else if(def.gather==='farm'||type==='pigfarm') s+=nearNodes.filter(n=>m.obj[n]===OBJ.NONE&&m.terr[n]===TER.GRASS).length*0.35;
      else if(def.mine){
        const targetT={coalmine:1,ironmine:2,goldmine:3,granitemine:4}[type];
        s+=nearNodes.filter(n=>m.oreT[n]===targetT&&m.oreA[n]>0).length*4;
        s+=[i,...m.nbs(i)].filter(n=>m.oreT[n]===targetT&&m.oreA[n]>0).length*8;
        if(s<4) continue;
      }
      else if(def.mil){
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
      units:this.units, battles:this.battles,
      signs:[...this.signs.entries()],
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
    g.signs=new Map(data.signs||[]);
    // Reservierungen & halboffene Trägeraufträge nach dem Laden zurücksetzen
    for(const items of g.flagItems.values()) for(const it of items) it.reserved=false;
    for(const r of g.roads.values()){
      const c=r.carrier;
      if(c.state==='toPick'||c.state==='pickup'){ c.state='idle'; c.job=null; }
    }
    g.objectives=data.objectives||[]; g.level=data.setup.level||null;
    NEXT_ID=Math.max(NEXT_ID, data.nextId||1);
    return g;
  }
}
