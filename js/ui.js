// Neuland – UI: Bildschirme, HUD, Baumenü, Dialoge, Spielschleife.
import { BLD, GOODS, GOOD_LIST, STYPES, STYPE_LIST, PLAYER_COLORS, OBJ, TER } from './core.js';
import { TILE, ROWH } from './map.js';
import { Game, TICK_MS } from './sim.js';
import { Renderer, goodColor } from './render.js';
import { setupInput } from './input.js';
import { Sound } from './sound.js';
import { CAMPAIGN, EPILOG } from './levels.js';
import * as SAVE from './save.js';

const $=(s)=>document.querySelector(s);
const el=(tag,cls,html)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; };

const CATS=[['basis','Holz & Stein'],['nahrung','Nahrung'],['industrie','Industrie'],['militaer','Militär'],['lager','Lager'],['schmuck','Schmuck']];

export class UI {
  constructor(){
    this.opts=SAVE.getOptions();
    Sound.sfxOn=this.opts.sfx; Sound.musicOn=this.opts.music;
    this.buildDOM();
    this.showScreen('title');
    this.cam={x:0,y:0,z:1};
    this.state={ sel:-1, mode:'view', roadFrom:-1, roadPath:null, buildCat:'basis', msgSeen:0 };
    this.renderer=new Renderer($('#cv'));
    setupInput($('#cv'), {
      cam:this.cam,
      bounds:()=> this.game? {w:this.game.map.w*TILE, h:this.game.map.h*ROWH} : {w:1000,h:1000},
      onTap:(wx,wy)=>this.onTap(wx,wy),
      onLong:(wx,wy)=>this.onLong(wx,wy),
    });
    window.addEventListener('resize',()=>this.resize());
    this.resize();
    document.addEventListener('pointerdown',()=>Sound.unlock(),{once:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden && this.game && !this.game.over) SAVE.saveSlot('auto', this.game, 'Autosave');
    });
    this.loop();
  }

  // ================= DOM =================
  buildDOM(){
    const app=$('#app');
    app.innerHTML=`
    <div id="scr-title" class="screen">
      <div class="title-wrap">
        <h1>NEULAND</h1>
        <p class="subtitle">Siedeln · Wirtschaft · Eroberung</p>
        <div class="menu">
          <button id="bt-campaign" class="mbtn">📜 Kampagne</button>
          <button id="bt-free" class="mbtn">🗺️ Freies Spiel</button>
          <button id="bt-multi" class="mbtn">⚔️ Mehrspieler</button>
          <button id="bt-load" class="mbtn">💾 Laden</button>
          <button id="bt-options" class="mbtn">⚙️ Optionen</button>
          <button id="bt-help" class="mbtn">❓ Anleitung</button>
        </div>
        <p class="credits">Ein Aufbau-Strategiespiel im Geiste der Klassiker · eigene Grafik, Musik & Story</p>
      </div>
    </div>
    <div id="scr-campaign" class="screen hidden">
      <div class="panel">
        <h2>Kampagne: Das zerbrochene Königreich</h2>
        <div id="mission-list" class="mission-list"></div>
        <button class="mbtn back" data-back>Zurück</button>
      </div>
    </div>
    <div id="scr-free" class="screen hidden">
      <div class="panel">
        <h2 id="free-title">Freies Spiel</h2>
        <div class="form">
          <label>Kartengröße
            <select id="f-size"><option value="S">Klein</option><option value="M" selected>Mittel</option><option value="L">Groß</option></select></label>
          <label>Landschaft
            <select id="f-theme">
              <option value="gruen">Grünland</option><option value="winter">Winter</option>
              <option value="wueste">Wüste</option><option value="sumpf">Moor</option>
              <option value="vulkan">Vulkan</option><option value="inseln">Inseln</option>
              <option value="gebirge">Gebirge</option>
            </select></label>
          <label>Gegner (Computer)
            <select id="f-ais"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="0">Keine (Friedlich)</option></select></label>
          <label>Stärke der Gegner
            <select id="f-lvl"><option value="1">Leicht</option><option value="2" selected>Mittel</option><option value="3">Schwer</option></select></label>
          <label>Rohstoffe
            <select id="f-res"><option value="0.7">Knapp</option><option value="1" selected>Normal</option><option value="1.5">Üppig</option></select></label>
          <label>Startkapital
            <select id="f-boost"><option value="1" selected>Normal</option><option value="1.6">Üppig</option></select></label>
          <label>Startpunkt (Seed)
            <input id="f-seed" type="number" placeholder="zufällig"></label>
        </div>
        <button id="f-start" class="mbtn primary">Spiel starten</button>
        <button class="mbtn back" data-back>Zurück</button>
      </div>
    </div>
    <div id="scr-multi" class="screen hidden">
      <div class="panel">
        <h2>Mehrspieler</h2>
        <p class="note">Miss dich in Echtzeit mit bis zu drei Computer-Fürsten – jede Partie auf einer
        neuen Karte. Ein Online-Modus gegen menschliche Spieler ist vorbereitet und folgt in einem
        späteren Update (dafür wird ein Spielserver benötigt).</p>
        <button id="m-vs1" class="mbtn">⚔️ Duell: Du gegen 1 Fürst</button>
        <button id="m-vs2" class="mbtn">⚔️ Dreikampf: Du gegen 2 Fürsten</button>
        <button id="m-vs3" class="mbtn">⚔️ Große Schlacht: Du gegen 3 Fürsten</button>
        <button class="mbtn back" data-back>Zurück</button>
      </div>
    </div>
    <div id="scr-load" class="screen hidden">
      <div class="panel">
        <h2>Spielstand laden</h2>
        <div id="slot-list" class="slot-list"></div>
        <div class="row">
          <button id="bt-import" class="mbtn">📥 Datei importieren</button>
          <input id="import-file" type="file" accept=".json" hidden>
        </div>
        <button class="mbtn back" data-back>Zurück</button>
      </div>
    </div>
    <div id="scr-options" class="screen hidden">
      <div class="panel">
        <h2>Optionen</h2>
        <label class="opt"><input type="checkbox" id="o-sfx"> Soundeffekte</label>
        <label class="opt"><input type="checkbox" id="o-music"> Musik</label>
        <p class="note">Tipp: Füge das Spiel über das Browser-Menü zum Startbildschirm hinzu, um es
        wie eine App im Vollbild zu spielen – auch offline.</p>
        <button class="mbtn back" data-back>Zurück</button>
      </div>
    </div>
    <div id="scr-help" class="screen hidden">
      <div class="panel help">
        <h2>Anleitung</h2>
        <h3>Steuerung</h3>
        <p>• Ziehen = Karte bewegen · Kneifen = Zoomen · Tippen = Auswählen/Bauen · Lange drücken = Info<br>
        • Minikarte unten rechts: Tippen springt dorthin.</p>
        <h3>Grundlagen</h3>
        <p>Alles beginnt mit <b>Holz und Stein</b>: Holzfäller fällen Bäume, das Sägewerk macht Bretter,
        der Steinmetz baut Felsen ab. <b>Jedes Gebäude braucht eine Straße</b> von seiner Fahne zum
        Hauptquartier, sonst transportiert niemand Waren!</p>
        <h3>Wirtschaft</h3>
        <p>Bauernhof → Mühle → Bäckerei (+Brunnen) ergibt Brot. Bergwerke im Gebirge fördern Kohle,
        Eisen und Gold – aber nur mit Essen (Fisch, Brot, Fleisch). Eisenhütte macht Eisen,
        die Waffenschmiede der Reihe nach Schwerter, Schilde, Speere und Bögen, die Brauerei Bier.
        Die <b>Werkzeugschmiede</b> (Eisen + Brett) schmiedet abwechselnd <b>Hämmer</b> und
        <b>Spitzhacken</b> – mit Essen beliefert arbeitet sie doppelt so schnell. Jede Baustelle
        braucht einen Hammer, jeder Geologe eine Spitzhacke.</p>
        <h3>Militär – drei Truppentypen</h3>
        <p>Im Hauptquartier entstehen Soldaten aus Bier + Waffe:
        <b>Schwertkämpfer</b> (Schwert + Schild, stark im Nahkampf),
        <b>Speerkämpfer</b> (Speer) und <b>Bogenschützen</b> (Bogen – schießen vor jedem
        Nahkampf eine Pfeilsalve). Es gilt: Schwert schlägt Speer, Speer schlägt Bogen,
        Bogen schlägt Schwert. Münzen aus der Prägerei sind Sold: Sie stärken die Verteidiger
        des Militärgebäudes, in dem sie lagern. Zum Angriff: feindliches Militärgebäude
        antippen, Truppenstärke wählen. Fällt das feindliche Hauptquartier, ist der Gegner besiegt.</p>
        <h3>Missionen</h3>
        <p>Die Kampagne erzählt in 10 Missionen die Geschichte von Königin Maras Volk – mit
        unterschiedlichen Landschaften und Zielen. Fortschritt wird automatisch gespeichert.</p>
        <button class="mbtn back" data-back>Zurück</button>
      </div>
    </div>
    <div id="scr-story" class="screen hidden">
      <div class="panel story">
        <h2 id="story-title"></h2>
        <p id="story-text"></p>
        <p id="story-tips" class="tips"></p>
        <button id="story-go" class="mbtn primary">Auf geht's!</button>
      </div>
    </div>
    <div id="scr-game" class="screen hidden">
      <canvas id="cv"></canvas>
      <div id="hud-top">
        <button id="g-menu" class="hbtn">☰</button>
        <div id="res-bar"></div>
        <button id="g-speed" class="hbtn">1×</button>
        <button id="g-pause" class="hbtn"></button>
      </div>
      <div id="objectives" class="hidden"></div>
      <div id="msg-toast" class="hidden"></div>
      <div id="minimap-wrap"><canvas id="minimap" width="140" height="140"></canvas></div>
      <div id="sheet" class="hidden"></div>
      <div id="game-menu" class="hidden">
        <div class="panel">
          <h2>Pause</h2>
          <button id="gm-resume" class="mbtn primary">Weiterspielen</button>
          <button id="gm-save" class="mbtn">💾 Speichern</button>
          <button id="gm-objectives" class="mbtn">🎯 Missionsziele</button>
          <button id="gm-export" class="mbtn">📤 Spielstand exportieren</button>
          <button id="gm-quit" class="mbtn back">Zum Hauptmenü</button>
        </div>
      </div>
      <div id="dlg" class="hidden"></div>
    </div>`;
    // Navigation
    $('#bt-campaign').onclick=()=>{ Sound.sfx('tap'); this.renderMissions(); this.showScreen('campaign'); };
    $('#bt-free').onclick=()=>{ Sound.sfx('tap'); this.freeMode='frei'; $('#free-title').textContent='Freies Spiel'; this.showScreen('free'); };
    $('#bt-multi').onclick=()=>{ Sound.sfx('tap'); this.showScreen('multi'); };
    $('#bt-load').onclick=()=>{ Sound.sfx('tap'); this.renderSlots(); this.showScreen('load'); };
    $('#bt-options').onclick=()=>{ Sound.sfx('tap'); this.showScreen('options'); };
    $('#bt-help').onclick=()=>{ Sound.sfx('tap'); this.showScreen('help'); };
    document.querySelectorAll('[data-back]').forEach(b=> b.onclick=()=>{ Sound.sfx('tap'); this.showScreen('title'); });
    $('#f-start').onclick=()=>this.startFree();
    $('#m-vs1').onclick=()=>this.startMulti(1);
    $('#m-vs2').onclick=()=>this.startMulti(2);
    $('#m-vs3').onclick=()=>this.startMulti(3);
    $('#o-sfx').checked=this.opts.sfx;
    $('#o-music').checked=this.opts.music;
    $('#o-sfx').onchange=(e)=>{ this.opts.sfx=e.target.checked; Sound.setSfx(this.opts.sfx); SAVE.setOptions(this.opts); };
    $('#o-music').onchange=(e)=>{ this.opts.music=e.target.checked; Sound.setMusic(this.opts.music); SAVE.setOptions(this.opts); };
    $('#bt-import').onclick=()=>$('#import-file').click();
    $('#import-file').onchange=async (e)=>{
      const f=e.target.files[0]; if(!f) return;
      try{
        const j=await SAVE.importSave(f);
        this.resumeFromData(j.data);
      }catch(err){ alert('Import fehlgeschlagen.'); }
    };
    // HUD
    $('#g-menu').onclick=()=>{ Sound.sfx('tap'); this.pauseMenu(true); };
    $('#gm-resume').onclick=()=>{ Sound.sfx('tap'); this.pauseMenu(false); };
    $('#gm-save').onclick=()=>{ Sound.sfx('tap'); this.saveDialog(); };
    $('#gm-export').onclick=()=>{ if(this.game) SAVE.exportSave(this.game); };
    $('#gm-objectives').onclick=()=>{ this.pauseMenu(false); this.toggleObjectives(true); };
    $('#gm-quit').onclick=()=>{
      Sound.sfx('tap');
      if(this.game && !this.game.over) SAVE.saveSlot('auto',this.game,'Autosave');
      this.game=null; this.pauseMenu(false); this.showScreen('title');
    };
    $('#g-speed').onclick=()=>{
      Sound.sfx('tap');
      this.opts.speed = this.opts.speed>=3?1:this.opts.speed+1;
      $('#g-speed').textContent=this.opts.speed+'×';
      SAVE.setOptions(this.opts);
    };
    $('#g-pause').onclick=()=>{
      Sound.sfx('tap');
      this.paused=!this.paused;
      $('#g-pause').textContent=this.paused?'▶':'';
    };
    $('#minimap').addEventListener('pointerdown',(e)=>{
      if(!this.game) return;
      const r=e.target.getBoundingClientRect();
      const fx=(e.clientX-r.left)/r.width, fy=(e.clientY-r.top)/r.height;
      this.cam.x=fx*this.game.map.w*TILE;
      this.cam.y=fy*this.game.map.h*ROWH;
    });
    $('#objectives').onclick=()=>this.toggleObjectives(false);
  }
  showScreen(name){
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    $('#scr-'+name).classList.remove('hidden');
    this.screen=name;
  }
  resize(){
    const cv=$('#cv');
    const dpr=Math.min(window.devicePixelRatio||1, 2);
    cv.style.width=window.innerWidth+'px';
    cv.style.height=window.innerHeight+'px';
    this.renderer.resize(window.innerWidth, window.innerHeight, dpr);
  }

  // ================= Spielstart =================
  renderMissions(){
    const prog=SAVE.getProgress();
    const list=$('#mission-list'); list.innerHTML='';
    CAMPAIGN.forEach((mi)=>{
      const locked=mi.id>prog.unlocked;
      const b=el('button','mission'+(locked?' locked':''),
        `<span class="mnum">${mi.id}</span><span><b>${mi.title}</b><br><small>${locked?'Gesperrt':'Spielbar'}</small></span>`);
      if(!locked) b.onclick=()=>{ Sound.sfx('tap'); this.startMission(mi); };
      list.appendChild(b);
    });
  }
  startMission(mi){
    const setup={
      mode:'kampagne', seed:mi.seed, size:mi.size, theme:mi.theme, resources:1,
      gate:!!mi.gate,
      players:[{name:'Königin Mara', ai:false},
        ...mi.ais.map(a=>({name:a.name, ai:true, aiLevel:a.lvl}))],
      level:{id:mi.id, title:mi.title},
      objectives:mi.objectives,
    };
    $('#story-title').textContent=`Mission ${mi.id}: ${mi.title}`;
    $('#story-text').textContent=mi.story;
    $('#story-tips').textContent='Tipp: '+mi.tips;
    this.showScreen('story');
    $('#story-go').onclick=()=>{ Sound.sfx('tap'); this.launch(new Game(setup)); };
  }
  startFree(){
    Sound.sfx('tap');
    const ais=+$('#f-ais').value, lvl=+$('#f-lvl').value;
    const seedIn=$('#f-seed').value;
    const setup={
      mode:this.freeMode||'frei',
      seed: seedIn? (+seedIn>>>0) : ((Math.random()*1e9)|0),
      size:$('#f-size').value, theme:$('#f-theme').value,
      resources:+$('#f-res').value, startBoost:+$('#f-boost').value,
      players:[{name:'Du', ai:false},
        ...Array.from({length:ais},(_,i)=>({name:['Fürst Corvin','Fürstin Isra','Fürst Halvar'][i], ai:true, aiLevel:lvl}))],
      objectives: ais>0? [{type:'destroyEnemies', desc:'Besiege alle Gegner'}]:[],
    };
    this.launch(new Game(setup));
  }
  startMulti(n){
    Sound.sfx('tap');
    $('#f-ais').value=String(n);
    this.freeMode='mehrspieler';
    $('#free-title').textContent='Mehrspieler-Partie einrichten';
    this.showScreen('free');
  }
  launch(game){
    this.game=game;
    this.paused=false;
    this._goHandled=false;
    this.state.sel=-1; this.state.mode='view'; this.state.msgSeen=0;
    this.renderer.setGame(game);
    this.renderer.onAmbient=(name,scale)=>Sound.sfx(name,scale);
    this.hookSounds(game);
    // Kamera aufs HQ
    const hq=game.buildings.get(game.players[0].hq);
    if(hq){ const [x,y]=game.map.worldPos(hq.node); this.cam.x=x; this.cam.y=y; this.cam.z=1.1; }
    $('#g-speed').textContent=this.opts.speed+'×';
    $('#g-pause').textContent='';
    this.closeSheet();
    this.showScreen('game');
    if(game.objectives.length) this.toggleObjectives(true, 4000);
  }
  resumeFromData(data){
    try{
      const g=Game.deserialize(data);
      this.launch(g);
    }catch(e){ console.error(e); alert('Spielstand konnte nicht geladen werden.'); }
  }
  hookSounds(g){
    g.onBuilt=()=>Sound.sfx('done');
    g.onProduce=()=>{};
    // Handwerker-Geräusche je nach Tätigkeit, leiser mit Entfernung zur Kamera
    const JOB_SFX={chop:'chop', pick:'pick', sow:'dig', plant:'dig', harvest:'rustle', fish:'splash', hunt:'rustle'};
    g.onWorkerAct=(u)=>{
      const name=JOB_SFX[u.jobKind];
      if(!name) return;
      const d=Math.hypot(u.x-this.cam.x, u.y-this.cam.y)*this.cam.z;
      if(d>750) return;
      Sound.sfx(name, Math.max(0.15, 1-d/750));
    };
    g.onGeoProbe=(u)=>{
      const d=Math.hypot(u.x-this.cam.x, u.y-this.cam.y)*this.cam.z;
      if(d>750) return;
      Sound.sfx('pick', Math.max(0.15, 1-d/750));
    };
    g.onClash=(b)=>{
      const [x,y]=g.map.worldPos(b.node);
      const d=Math.hypot(x-this.cam.x, y-this.cam.y)*this.cam.z;
      if(d>900) return;
      const s=Math.max(0.2, 1-d/900);
      Sound.sfx('clash', s);
      if(Math.random()<0.45) setTimeout(()=>Sound.sfx('grunt', s), 120+Math.random()*160);
    };
    g.onGeoFind=(u)=>{
      const d=Math.hypot(u.x-this.cam.x, u.y-this.cam.y)*this.cam.z;
      if(d>900) return;
      Sound.sfx('yay', Math.max(0.25, 1-d/900));
    };
    g.onRecruit=()=>Sound.sfx('recruit');
    g.onVolley=(x,y)=>{
      const d=Math.hypot(x-this.cam.x, y-this.cam.y)*this.cam.z;
      if(d>850) return;
      Sound.sfx('arrow', Math.max(0.15, 1-d/850));
    };
    g.onBurn=(b)=>{
      const [x,y]=g.map.worldPos(b.node);
      const d=Math.hypot(x-this.cam.x, y-this.cam.y)*this.cam.z;
      Sound.sfx('burn', Math.max(0.2, 1-d/900));
    };
    g.onBoulder=()=>Sound.sfx('boulder');
    g.onBattleStart=(b)=>{ if(b.player===0) Sound.sfx('war'); };
    g.onCapture=()=>Sound.sfx('done');
  }

  // ================= Interaktion =================
  onTap(wx,wy){
    if(!this.game || this.screen!=='game') return;
    const m=this.game.map;
    const i=m.nearestNode(wx,wy);
    if(i<0) return;
    Sound.sfx('tap');
    if(this.state.mode==='road'){
      this.roadTap(i);
      return;
    }
    if(this.state.mode==='place'){
      // Bauplatz antippen -> halbtransparente Vorschau + Bestätigung
      const can=this.game.canBuild(0, this.state.placeType, i);
      if(can.ok){
        this.state.placeAt=i;
        this.placeConfirmSheet();
      } else {
        this.toast(can.r||'Hier nicht möglich');
      }
      return;
    }
    // Auswahl: Gebäude? Fahne? Weg? freier Knoten?
    if(m.bld[i]>=0){ this.state.sel=i; this.openBuildingSheet(this.game.buildings.get(m.bld[i])); return; }
    if(m.flag[i]){ this.state.sel=i; this.openFlagSheet(i); return; }
    const road=this.game.roadAt(i);
    if(road && road.player===0){ this.state.sel=i; this.openRoadSheet(road, i); return; }
    if(m.owner[i]===0){ this.state.sel=i; this.openBuildSheet(i); return; }
    this.state.sel=-1; this.closeSheet();
  }
  onLong(wx,wy){
    if(!this.game || this.screen!=='game') return;
    const m=this.game.map;
    const i=m.nearestNode(wx,wy);
    if(i<0) return;
    Sound.sfx('tap');
    this.openInfoSheet(i);
  }
  isConnected(b){
    const hq=this.game.buildings.get(this.game.players[0].hq);
    if(!hq) return true;
    return this.game.compOf(b.door)!==undefined && this.game.compOf(b.door)===this.game.compOf(hq.door);
  }
  // ---------- Straßenbau ----------
  startRoad(fromFlag, autoHint=false){
    this.state.mode='road';
    this.state.roadFrom=fromFlag;
    this.state.roadNodes=[fromFlag];
    this.closeSheet();
    this.sheet(`<div class="sh-head"><b>🛤️ Straße bauen</b><button class="hbtn" id="sh-x">✕</button></div>
      ${autoHint?'<p class="note"><b>Verbinde das Gebäude mit deinem Wegenetz!</b></p>':''}
      <div class="road-help">
        <span>👆 Wegpunkte antippen</span>
        <span>🏠 Zielgebäude oder 🚩 Fahne antippen = anschließen</span>
        <span>👆👆 Doppeltipp aufs Ende = Fahne + fertig</span>
      </div>
      <div class="row">
      <button class="mbtn primary" id="road-done">🚩 Fahne setzen &amp; fertig</button>
      <button class="mbtn" id="road-undo">↩ Zurück</button>
      <button class="mbtn back" id="road-cancel">✕ Abbrechen</button></div>
      <p class="note" id="road-status">Noch keine Wegpunkte.</p>`);
    $('#sh-x').onclick=()=>this.cancelRoad();
    $('#road-cancel').onclick=()=>this.cancelRoad();
    $('#road-undo').onclick=()=>{
      if(this.state.roadNodes.length>1){ this.state.roadNodes.pop(); }
    };
    $('#road-done').onclick=()=>{
      const nodes=this.state.roadNodes;
      if(!nodes || nodes.length<2){ this.toast('Erst Wegpunkte antippen'); return; }
      if(this.game.buildRoad(0,nodes)){ Sound.sfx('road'); Sound.sfx('flag'); this.cancelRoad(); }
      else this.toast('Hier ist keine Fahne möglich (Abstand!)');
    };
  }
  cancelRoad(){ this.state.mode='view'; this.state.roadNodes=null; this.closeSheet(); }
  roadTap(i){
    const g=this.game;
    // Zielgebäude angetippt? -> automatisch dessen Türfahne anpeilen
    if(g.map.bld[i]>=0){
      const tb=g.buildings.get(g.map.bld[i]);
      if(tb && tb.player===0 && tb.door>=0 && g.map.flag[tb.door]) i=tb.door;
    }
    const cur=this.state.roadNodes[this.state.roadNodes.length-1];
    if(i===cur) return;
    const seg=g.roadPath(0, cur, i);
    if(!seg){ this.toast('Kein Weg dorthin möglich'); return; }
    const newPath=[...this.state.roadNodes, ...seg.slice(1)];
    if(g.map.flag[i] && i!==this.state.roadFrom){
      // fertig: an bestehender Fahne angeschlossen
      if(g.buildRoad(0, newPath)){ Sound.sfx('road'); this.cancelRoad(); }
      else this.toast('Straße nicht möglich');
      return;
    }
    // an bestehendem Weg anschließen: Fahne setzen (teilt den Weg) und abschließen
    const onRoad=g.roadAt(i);
    if(onRoad && onRoad.player===0 && g.canPlaceFlag(i,0)){
      if(g.placeFlag(i,0) && g.buildRoad(0,newPath)){
        Sound.sfx('road'); Sound.sfx('flag'); this.cancelRoad();
      } else this.toast('Anschluss nicht möglich');
      return;
    }
    this.state.roadNodes=newPath;
    const st=$('#road-status');
    if(st) st.textContent=`${newPath.length-1} Wegstück${newPath.length>2?'e':''} geplant.`;
    // Endpunkt könnte Fahne werden: Doppeltipp = abschließen
    if(g.canPlaceFlag(i,0)){
      if(this.lastRoadEnd===i){
        if(g.buildRoad(0,newPath)){ Sound.sfx('road'); Sound.sfx('flag'); this.cancelRoad(); }
        this.lastRoadEnd=null;
        return;
      }
      this.lastRoadEnd=i;
      if(st) st.textContent=`${newPath.length-1} Wegstücke – nochmal tippen für Fahne + fertig.`;
    }
  }

  // ---------- Sheets (Bottom-Panels) ----------
  sheet(html){
    const s=$('#sheet');
    s.innerHTML=html;
    s.classList.remove('hidden');
  }
  closeSheet(){ $('#sheet').classList.add('hidden'); this.state.showBuildDots=false; }
  openBuildSheet(i){
    const g=this.game;
    this.state.showBuildDots=true;
    const cat=this.state.buildCat;
    const inv=g.invTotal(0);
    let tabs=CATS.map(([k,label])=>`<button class="tab ${k===cat?'on':''}" data-cat="${k}">${label}</button>`).join('');
    let items='';
    for(const key in BLD){
      const def=BLD[key];
      if(def.cat!==cat || key==='hq') continue;
      const can=g.canBuild(0,key,i);
      const cost=Object.entries(def.cost).map(([k,v])=>`${v} ${GOODS[k].name}`).join(', ')||'–';
      const afford=(inv.board||0)>=(def.cost.board||0)&&(inv.stone||0)>=(def.cost.stone||0)&&(inv.hammer||0)>=1;
      // Gebäudebild aus dem Asset-Pack (Baukarte)
      const img=this.renderer.asset('bld_'+key)
        ? `<img class="bthumb" src="assets/bld_${key}.png" alt="" loading="lazy">` : '';
      const sz={S:'◾ klein', M:'◼ mittel', L:'⬛ groß', MINE:'⛰ Gebirge'}[def.size]||'';
      items+=`<button class="bitem" data-bld="${key}">
        ${img}<span class="binfo"><b>${def.name}</b><small>${cost} + 🔨 · ${sz}${afford?'':' ⚠️'}</small>
        <small class="desc">${def.desc}</small></span></button>`;
    }
    this.sheet(`<div class="sh-head"><b>Bauen</b>
      <button class="hbtn" id="sh-flag" title="Fahne">🚩</button>
      <button class="hbtn" id="sh-x">✕</button></div>
      <div class="tabs">${tabs}</div>
      <div class="bgrid">${items}</div>`);
    $('#sh-x').onclick=()=>{ this.state.sel=-1; this.closeSheet(); };
    $('#sh-flag').onclick=()=>{
      if(g.placeFlag(i,0)){ Sound.sfx('flag'); this.state.sel=-1; this.closeSheet(); }
      else this.toast('Fahne hier nicht möglich (Abstand!)');
    };
    document.querySelectorAll('.tab').forEach(t=> t.onclick=()=>{
      this.state.buildCat=t.dataset.cat; this.openBuildSheet(i);
    });
    document.querySelectorAll('.bitem').forEach(b=> b.onclick=()=>{
      const key=b.dataset.bld;
      // Platzieren-Modus: erst Vorschau, gebaut wird nach Bestätigung
      const can=g.canBuild(0,key,i);
      this.state.mode='place'; this.state.placeType=key;
      this.state.placeAt= can.ok? i : -1;
      if(this.state.placeAt>=0){
        this.placeConfirmSheet();
      } else {
        this.sheet(`<div class="sh-head"><b>${BLD[key].name} platzieren</b><button class="hbtn" id="sh-x">✕</button></div>
          <p class="note">Grüne Punkte zeigen, wo ${BLD[key].name} gebaut werden darf. Tippe einen an –
          du siehst erst eine Vorschau und bestätigst dann.</p>`);
        this.state.showBuildDots=true;
        $('#sh-x').onclick=()=>this.cancelPlace();
      }
    });
  }
  sizeLabel(def){
    return def.size==='MINE' ? 'Stollen – nur im Gebirge'
      : def.size==='L' ? 'großer Bauplatz (5 freie Nachbarfelder)'
      : def.size==='M' ? 'mittlerer Bauplatz (4 freie Nachbarfelder)'
      : 'kleiner Bauplatz (1 Feld)';
  }
  cancelPlace(){
    this.state.mode='view'; this.state.placeAt=-1; this.state.placeType=null;
    this.closeSheet();
  }
  placeConfirmSheet(){
    const g=this.game, key=this.state.placeType, def=BLD[key];
    const img=this.renderer.asset('bld_'+key)
      ? `<img class="bthumb" src="assets/bld_${key}.png" alt="">` : '';
    const cost=Object.entries(def.cost).map(([k,v])=>`${v} ${GOODS[k].name}`).join(', ')||'–';
    this.state.showBuildDots=true;
    this.sheet(`<div class="sh-head"><b>${def.name} – hier bauen?</b><button class="hbtn" id="sh-x">✕</button></div>
      <div class="bitem" style="cursor:default">${img}<span class="binfo">
        <small>${cost} + 🔨 · ${this.sizeLabel(def)}</small>
        <small class="desc">Vorschau auf der Karte – tippe woanders hin, um den Platz zu wechseln.</small>
      </span></div>
      <div class="row" style="margin-top:8px">
        <button class="mbtn primary" id="pl-ok">✓ Bauen</button>
        <button class="mbtn back" id="pl-cancel">✕ Abbrechen</button>
      </div>`);
    $('#sh-x').onclick=()=>this.cancelPlace();
    $('#pl-cancel').onclick=()=>this.cancelPlace();
    $('#pl-ok').onclick=()=>{
      const r=g.placeBuilding(0, key, this.state.placeAt);
      if(r.ok){
        Sound.sfx('place');
        this.state.mode='view'; this.state.placeAt=-1; this.state.placeType=null; this.state.sel=-1;
        this.closeSheet();
        if(!this.isConnected(r.b)) this.startRoad(r.b.door,true);
      } else {
        this.toast(r.r||'Hier nicht mehr möglich');
        this.state.placeAt=-1;
      }
    };
  }
  openFlagSheet(i){
    const g=this.game;
    const isDoor=[...g.buildings.values()].some(b=>b.door===i);
    const hasMount=g.nodesInRange(i,8).some(n=>g.map.terr[n]===TER.MOUNT && !g.signs.has(n));
    const picks=(g.invTotal(0).pick||0);
    const geoHint= !hasMount ? 'Kein unbeschildertes Gebirge in der Nähe dieser Fahne (Umkreis 8).'
      : picks<1 ? '⚠️ Keine Spitzhacke im Lager – die Werkzeugschmiede stellt sie her.'
      : 'Der Geologe untersucht das Gebirge in der Nähe und stellt Schilder auf, wo Erz liegt.';
    this.sheet(`<div class="sh-head"><b>Fahne</b><button class="hbtn" id="sh-x">✕</button></div>
      <div class="row">
      <button class="mbtn primary" id="fl-road">🛤️ Straße bauen</button>
      <button class="mbtn ${hasMount&&picks>0?'':'off'}" id="fl-geo">⛏️ Geologen rufen (${picks}⛏)</button>
      ${isDoor?'':'<button class="mbtn back" id="fl-del">Fahne entfernen</button>'}
      </div>
      <p class="note">${geoHint}</p>`);
    $('#sh-x').onclick=()=>{ this.state.sel=-1; this.closeSheet(); };
    $('#fl-road').onclick=()=>this.startRoad(i);
    const geo=$('#fl-geo');
    if(geo) geo.onclick=()=>{
      const r=g.callGeologist(0,i);
      if(r===true){ Sound.sfx('tap'); this.toast('Der Geologe macht sich auf den Weg'); this.state.sel=-1; this.closeSheet(); }
      else if(r==='nopick') this.toast('Keine Spitzhacke! Baue eine Werkzeugschmiede.');
      else if(r==='nomount') this.toast('Kein unbeschildertes Gebirge in der Nähe.');
    };
    const del=$('#fl-del');
    if(del) del.onclick=()=>{ g.removeFlag(i); Sound.sfx('tap'); this.state.sel=-1; this.closeSheet(); };
  }
  openRoadSheet(road, i){
    const g=this.game;
    const canFlag=g.canPlaceFlag(i,0);
    this.sheet(`<div class="sh-head"><b>Weg</b><button class="hbtn" id="sh-x">✕</button></div>
      <div class="row">
      ${canFlag?'<button class="mbtn primary" id="rd-flag">🚩 Fahne setzen (Weg teilen)</button>':''}
      <button class="mbtn back" id="rd-del">🔥 Weg abreißen</button>
      </div>`);
    $('#sh-x').onclick=()=>{ this.state.sel=-1; this.closeSheet(); };
    const fl=$('#rd-flag');
    if(fl) fl.onclick=()=>{
      if(g.placeFlag(i,0)){ Sound.sfx('flag'); this.state.sel=-1; this.closeSheet(); }
    };
    $('#rd-del').onclick=()=>{
      g.removeRoad(road.id); Sound.sfx('place');
      this.state.sel=-1; this.closeSheet();
    };
  }
  openBuildingSheet(b){
    if(!b) return;
    const g=this.game, def=BLD[b.type];
    if(b.player!==0){
      // Feindgebäude: Angriff?
      if(def.mil||b.type==='hq'){
        const avail=g.attackable(0,b.id);
        const defN=(b.soldiers?.length||0)+(b.type==='hq'?g.recruitTotal(b.player):0);
        this.sheet(`<div class="sh-head"><b style="color:${PLAYER_COLORS[b.player]}">${def.name} (${g.players[b.player].name})</b>
          <button class="hbtn" id="sh-x">✕</button></div>
          <p class="note">Verteidiger: ~${defN} · Deine verfügbaren Angreifer: ${avail}</p>
          ${avail>0?`<div class="row"><input type="range" id="atk-n" min="1" max="${avail}" value="${Math.min(avail,Math.max(1,defN+1))}">
          <span id="atk-nv">${Math.min(avail,Math.max(1,defN+1))}</span></div>
          <button class="mbtn primary" id="atk-go">⚔️ Angriff!</button>`:'<p class="note">Keine Soldaten in Reichweite. Baue Militärgebäude näher an den Feind!</p>'}`);
        $('#sh-x').onclick=()=>{ this.state.sel=-1; this.closeSheet(); };
        const rng=$('#atk-n');
        if(rng){ rng.oninput=()=>$('#atk-nv').textContent=rng.value;
          $('#atk-go').onclick=()=>{
            if(g.attack(0,b.id,+rng.value)){ Sound.sfx('war'); this.state.sel=-1; this.closeSheet(); }
          };
        }
      } else {
        this.sheet(`<div class="sh-head"><b style="color:${PLAYER_COLORS[b.player]}">${def.name} (${g.players[b.player].name})</b>
        <button class="hbtn" id="sh-x">✕</button></div><p class="note">Zivilgebäude des Gegners. Erobere das umliegende Militärgebäude!</p>`);
        $('#sh-x').onclick=()=>{ this.state.sel=-1; this.closeSheet(); };
      }
      return;
    }
    if(b.type==='chapel' && b.state==='done') Sound.sfx('bell');
    if(b.type==='market' && b.state==='done') Sound.sfx('market');
    let body='';
    if(b.state==='build'){
      const needB=def.cost.board||0, needS=def.cost.stone||0;
      body=`<p class="note">Baustelle · Bretter ${b.stock.board||0}/${needB} · Steine ${b.stock.stone||0}/${needS}</p>
      ${this.isConnected(b)?'':'<p class="warn">⚠️ Nicht mit dem Wegenetz verbunden!</p>'}`;
    } else {
      const rows=[];
      if(def.prod){
        for(const k in def.prod.inputs) rows.push(`${GOODS[k].name}: ${b.stock[k]||0}`);
        rows.push(`Fertig: ${b.out||0}`);
      }
      if(def.mine){ rows.push(`Essen: ${['fish','bread','meat'].map(f=>b.stock[f]||0).reduce((a,c)=>a+c,0)}`, `Gefördert wartend: ${b.out||0}`, b.depleted?'⚠️ Vorkommen erschöpft':''); }
      if(def.gather){ rows.push(`Ware wartend: ${b.out||0}`); }
      if(def.cata){ rows.push(`Steine: ${b.stock.stone||0}`); }
      if(b.soldiers){
        const byT=STYPE_LIST.map(t=>{
          const n=b.soldiers.filter(s=>s===t).length;
          return n? `${n}× ${STYPES[t].short}` : null;
        }).filter(Boolean).join(' · ');
        rows.push(`Besatzung: ${b.soldiers.length}/${def.mil.cap}${byT? ' ('+byT+')':''}`,
          `Sold (Münzen): ${b.coins||0}`);
      }
      if(b.inv){
        const inv=Object.entries(b.inv).filter(([,v])=>v>0).map(([k,v])=>`${GOODS[k].name} ${v}`).join(' · ')||'leer';
        rows.push('Lager: '+inv);
        if(b.type==='hq'){
          const r=g.players[0].recruits;
          rows.push(`Reserve: ${STYPE_LIST.map(t=>`${r[t]||0}× ${STYPES[t].short}`).join(' · ')}`);
        }
      }
      body=`<p class="note">${rows.filter(Boolean).join('<br>')}</p>
      ${this.isConnected(b)?'':'<p class="warn">⚠️ Nicht mit dem Wegenetz verbunden!</p>'}`;
    }
    this.sheet(`<div class="sh-head"><b>${def.name}</b><button class="hbtn" id="sh-x">✕</button></div>
      ${body}
      <div class="row">
        <button class="mbtn" id="bd-road">🛤️ Straße ab Fahne</button>
        ${b.type!=='hq'?'<button class="mbtn back" id="bd-del">🔥 Abreißen</button>':''}
      </div>`);
    $('#sh-x').onclick=()=>{ this.state.sel=-1; this.closeSheet(); };
    $('#bd-road').onclick=()=>this.startRoad(b.door);
    const del=$('#bd-del');
    if(del) del.onclick=()=>{
      this.confirm(`${def.name} wirklich abreißen?`, ()=>{
        g.demolish(b.id); Sound.sfx('place'); this.state.sel=-1; this.closeSheet();
      });
    };
  }
  openInfoSheet(i){
    const g=this.game, m=g.map;
    const tn={[TER.WATER]:'Wasser',[TER.GRASS]:'Wiese',[TER.DESERT]:'Trockenland',[TER.MOUNT]:'Gebirge',[TER.SNOW]:'Schnee',[TER.SWAMP]:'Moor',[TER.LAVA]:'Lava'}[m.terr[i]];
    const o=m.obj[i]&127;
    const on={[OBJ.TREE]:'Ausgewachsener Baum',[OBJ.TREE2]:'Junger Baum',[OBJ.SAPLING]:'Setzling',[OBJ.STONE]:`Felsbrocken (${m.amt[i]})`,[OBJ.FIELD0]:'Feld (gesät)',[OBJ.FIELD1]:'Feld (wächst)',[OBJ.FIELD2]:'Feld (reif)',[OBJ.GATE]:'⭐ Das Tor der Ahnen'}[o]||'';
    // Erz zeigt nur ein Geologen-Schild – nicht das bloße Antippen des Berges
    let ore='';
    if(g.signs.has(i)){
      const s=g.signs.get(i);
      ore= s? 'Vorkommen: '+['','Kohle','Eisenerz','Golderz','Granit'][s]+' ⛏' : 'Geologe: hier kein Erz';
    } else if(m.terr[i]===TER.MOUNT){
      ore='Erzvorkommen unbekannt – schicke einen Geologen!';
    }
    const owner=m.owner[i]>=0? g.players[m.owner[i]].name : 'Niemandsland';
    this.sheet(`<div class="sh-head"><b>Gelände-Info</b><button class="hbtn" id="sh-x">✕</button></div>
      <p class="note">${tn} · Besitzer: ${owner}${on?'<br>'+on:''}${ore?'<br>'+ore:''}</p>`);
    $('#sh-x').onclick=()=>this.closeSheet();
  }
  confirm(txt, cb){
    const d=$('#dlg');
    d.innerHTML=`<div class="panel"><p>${txt}</p><div class="row">
      <button class="mbtn primary" id="c-yes">Ja</button>
      <button class="mbtn back" id="c-no">Nein</button></div></div>`;
    d.classList.remove('hidden');
    $('#c-yes').onclick=()=>{ d.classList.add('hidden'); cb(); };
    $('#c-no').onclick=()=>d.classList.add('hidden');
  }
  saveDialog(){
    const d=$('#dlg');
    const slots=SAVE.listSlots().filter(s=>s.slot!=='auto');
    d.innerHTML=`<div class="panel"><h2>Speichern</h2>
      <div class="slot-list">${slots.map(s=>`<button class="slot" data-slot="${s.slot}">
        <b>Slot ${s.slot}</b><small>${s.meta? new Date(s.meta.date).toLocaleString('de-DE')+(s.meta.mission?' · '+s.meta.mission:''):'– leer –'}</small>
      </button>`).join('')}</div>
      <button class="mbtn back" id="sv-x">Abbrechen</button></div>`;
    d.classList.remove('hidden');
    $('#sv-x').onclick=()=>d.classList.add('hidden');
    d.querySelectorAll('.slot').forEach(b=> b.onclick=()=>{
      SAVE.saveSlot(b.dataset.slot, this.game, 'Manuell');
      d.classList.add('hidden');
      this.toast('Gespeichert ✓');
      Sound.sfx('done');
    });
  }
  renderSlots(){
    const list=$('#slot-list'); list.innerHTML='';
    for(const s of SAVE.listSlots()){
      const b=el('button','slot',`<b>${s.slot==='auto'?'Autosave':'Slot '+s.slot}</b>
        <small>${s.meta? new Date(s.meta.date).toLocaleString('de-DE')
          +(s.meta.mission?' · '+s.meta.mission:' · '+(s.meta.mode==='mehrspieler'?'Mehrspieler':'Freies Spiel')):'– leer –'}</small>`);
      if(s.meta){
        b.onclick=()=>{
          const d=SAVE.loadSlot(s.slot);
          if(d) this.resumeFromData(d.data);
        };
      } else b.classList.add('locked');
      list.appendChild(b);
    }
  }
  pauseMenu(show){
    this.paused=show;
    $('#game-menu').classList.toggle('hidden',!show);
    $('#g-pause').textContent=this.paused?'▶':'';
  }
  toggleObjectives(show, autohide=0){
    const o=$('#objectives');
    if(!this.game||!this.game.objectives.length){ o.classList.add('hidden'); return; }
    if(show){
      o.innerHTML='<b>🎯 Missionsziele</b><br>'+this.game.objectives.map(ob=>
        `${ob.done?'✅':'▫️'} ${ob.desc}${ob.count?` (${Math.min(ob.prog,ob.count)}/${ob.count})`:''}`).join('<br>');
      o.classList.remove('hidden');
      if(autohide){ clearTimeout(this._objT); this._objT=setTimeout(()=>o.classList.add('hidden'),autohide); }
    } else o.classList.add('hidden');
  }
  toast(txt){
    const t=$('#msg-toast');
    t.textContent=txt;
    t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT=setTimeout(()=>t.classList.add('hidden'),2600);
  }

  // ================= Spielschleife =================
  loop(){
    let last=performance.now();
    const frame=(now)=>{
      const dt=Math.min(100, now-last); last=now;
      if(this.game && this.screen==='game'){
        if(!this.paused) this.game.update(dt, this.opts.speed);
        // Straßenvorschau
        this.uiRenderState={
          sel:this.state.sel,
          roadPreview:this.state.mode==='road'? this.state.roadNodes:null,
          showBuildDots:this.state.showBuildDots||this.state.mode==='place',
          placeType:this.state.mode==='place'? this.state.placeType : null,
          placeAt:this.state.mode==='place'? (this.state.placeAt??-1) : -1,
        };
        this.renderer.draw(this.cam, this.uiRenderState, dt);
        if(!this._mmT||now-this._mmT>500){ this._mmT=now; this.renderer.drawMinimap($('#minimap'), this.cam); }
        if(!this._resT||now-this._resT>600){ this._resT=now; this.updateHud(); }
        this.pollMsgs();
        if(this.game.over) this.onGameOver();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  updateHud(){
    const g=this.game; if(!g) return;
    const inv=g.invTotal(0);
    const show=[['board','🪵'],['stone','🪨'],['bread','🍞'],['fish','🐟'],['coal','⬛'],['iron','⛓️'],['coin','🟡']];
    // Asset-Überschreibung (Stilguide §14/G): icon_<ware>.png ersetzt das Emoji
    const ic=(k,fallback)=> this.renderer.asset('icon_'+k)
      ? `<img class="res-ic" src="assets/icon_${k}.png" alt="">` : fallback;
    $('#res-bar').innerHTML=show.map(([k,em])=>`<span>${ic(k,em)}${inv[k]||0}</span>`).join('')
      +`<span>${ic('soldier','⚔️')}${g.soldierCount(0)}</span>`;
    if(!$('#objectives').classList.contains('hidden')) this.toggleObjectives(true);
  }
  pollMsgs(){
    const g=this.game;
    while(this.state.msgSeen<g.msgs.length){
      const msg=g.msgs[this.state.msgSeen++];
      this.toast(msg.txt);
      if(msg.type==='war') Sound.sfx('war');
      else if(msg.type==='ok') Sound.sfx('msg');
    }
  }
  onGameOver(){
    if(this._goHandled) { return; }
    this._goHandled=true;
    const g=this.game;
    const won=g.winner===0;
    if(won && g.setup.mode==='kampagne'){
      const prog=SAVE.getProgress();
      if(g.setup.level.id>=prog.unlocked && g.setup.level.id<CAMPAIGN.length){
        prog.unlocked=g.setup.level.id+1;
        SAVE.setProgress(prog);
      }
    }
    Sound.sfx(won?'win':'lose');
    const d=$('#dlg');
    const finale=won && g.setup.mode==='kampagne' && g.setup.level.id===CAMPAIGN.length;
    d.innerHTML=`<div class="panel"><h2>${won?'🏆 Sieg!':'💀 Niederlage'}</h2>
      <p>${finale? EPILOG.replace(/\n/g,'<br>') : won?'Deine Siedlung hat sich behauptet!':'Deine Siedlung ist gefallen. Versuche es erneut!'}</p>
      <div class="row">
      ${won&&g.setup.mode==='kampagne'&&!finale?'<button class="mbtn primary" id="go-next">Nächste Mission</button>':''}
      <button class="mbtn" id="go-menu">Hauptmenü</button></div></div>`;
    d.classList.remove('hidden');
    $('#go-menu').onclick=()=>{ d.classList.add('hidden'); this._goHandled=false; this.game=null; this.showScreen('title'); };
    const nx=$('#go-next');
    if(nx) nx.onclick=()=>{
      d.classList.add('hidden'); this._goHandled=false;
      const next=CAMPAIGN.find(mi=>mi.id===g.setup.level.id+1);
      if(next) this.startMission(next); else this.showScreen('title');
    };
  }
}
