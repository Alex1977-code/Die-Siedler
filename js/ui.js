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

// Warenleiste: Standardbelegung kommt aus save.js (auch für neue Profile),
// HUD_MAX begrenzt, wie viele Waren angeheftet werden können
const HUD_DEFAULT=SAVE.HUD_DEFAULT;
const HUD_MAX=12;

// Spieltempo: 1x ist ans gemächliche Tempo des Vorbilds angelehnt und der
// Standard. "Test" ist echtes 10-fach-Tempo (10 x 0.45) zum Durchspulen.
const SPEED_STEPS=[1,2,3,'T'];
const SPEED_MULT={ 1:0.45, 2:0.9, 3:1.35, T:4.5 };
const speedLabel=(v)=> v==='T' ? 'Test' : v+'×';

export class UI {
  constructor(){
    this.opts=SAVE.getOptions();
    // einmalige Umstellung auf die neuen Tempostufen (1x Standard, "Test"
    // jetzt 10-fach): wer bisher "Test" gewählt hatte, behält es; alles
    // andere wird auf eine gültige Stufe geklemmt.
    if(!this.opts.speedV3){
      if(this.opts.speed!=='T' && !SPEED_STEPS.includes(this.opts.speed)) this.opts.speed=1;
      this.opts.speedV3=1; SAVE.setOptions(this.opts);
    }
    if(!SPEED_STEPS.includes(this.opts.speed)) this.opts.speed=1;
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
          <button id="bt-campaign" class="mbtn">Kampagne</button>
          <button id="bt-free" class="mbtn">Freies Spiel</button>
          <button id="bt-multi" class="mbtn">Mehrspieler</button>
          <button id="bt-load" class="mbtn">Laden</button>
          <button id="bt-options" class="mbtn">Optionen</button>
          <button id="bt-help" class="mbtn">Anleitung</button>
        </div>
        <p class="credits">Ein Aufbau-Strategiespiel im Geiste der Klassiker · eigene Grafik, Musik & Story</p>
      </div>
    </div>
    <div id="scr-campaign" class="screen hidden">
      <div class="panel">
        <h2>Kampagne: Das zerbrochene Königreich</h2>
        <div class="form" style="margin-bottom:10px">
          <label>Schwierigkeitsgrad
            <select id="c-diff"><option value="leicht">Leicht</option><option value="normal" selected>Normal</option><option value="schwer">Schwer</option></select></label>
        </div>
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
          <label>Schwierigkeitsgrad
            <select id="f-diff"><option value="leicht">Leicht (mehr Startwaren, zahme Gegner)</option><option value="normal" selected>Normal</option><option value="schwer">Schwer (knapper Start, aggressive Gegner)</option></select></label>
          <label>Rohstoffe
            <select id="f-res"><option value="0.7">Knapp</option><option value="1" selected>Normal</option><option value="1.5">Üppig</option></select></label>
          <label>Startkapital
            <select id="f-boost"><option value="1" selected>Normal</option><option value="1.6">Üppig</option></select></label>
          <label>Spielziel
            <select id="f-ziel">
              <option value="sieg" selected>Alle Gegner besiegen</option>
              <option value="land">Großmacht: 1500 Felder beherrschen</option>
              <option value="heer">Feldherr: 25 Soldaten aufstellen</option>
              <option value="frei">Nur bauen (ohne Ziel)</option>
            </select></label>
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
        <button id="m-vs1" class="mbtn">Duell · Du gegen 1 Fürst</button>
        <button id="m-vs2" class="mbtn">Dreikampf · Du gegen 2 Fürsten</button>
        <button id="m-vs3" class="mbtn">Große Schlacht · Du gegen 3 Fürsten</button>
        <button class="mbtn back" data-back>Zurück</button>
      </div>
    </div>
    <div id="scr-load" class="screen hidden">
      <div class="panel">
        <h2>Spielstand laden</h2>
        <div id="slot-list" class="slot-list"></div>
        <div class="row">
          <button id="bt-import" class="mbtn">Datei importieren</button>
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
        <label class="opt">Lautstärke <input type="range" id="o-vol" min="0" max="100" step="5"></label>
        <label class="opt">Musik-Pegel <input type="range" id="o-vol-music" min="0" max="100" step="5"></label>
        <label class="opt">Effekt-Pegel <input type="range" id="o-vol-sfx" min="0" max="100" step="5"></label>
        <label class="opt"><input type="checkbox" id="o-tilt"> Weichzeichner am Bildrand</label>
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
        die Waffenschmiede der Reihe nach Schwerter, Schilde, Speere und Bögen, die Brauerei Bier.</p>
        <h3>Werkzeuge</h3>
        <p>Die <b>Werkzeugschmiede</b> (Eisen + Brett) schmiedet <b>alle Werkzeuge</b> – und zwar
        bevorzugt das, was gerade fehlt: Hammer (Bauarbeiter), Spitzhacke (Geologe, Steinmetz,
        Bergleute), Axt (Holzfäller), Säge (Schreiner im Sägewerk), Sense (Bauer), Angel (Fischer),
        Beil (Metzger) und Schaufel (Planierer, Förster). Mit Essen beliefert arbeitet sie doppelt
        so schnell. <b>Jede Fachkraft mit Werkzeugberuf zieht nur ein, wenn ihr Werkzeug im Lager
        liegt</b> – der Jäger braucht einen Bogen aus der Waffenschmiede. Fehlt es, wartet das
        Gebäude sichtbar (Hinweis im Gebäudemenü). Bei Zerstörung oder Abriss rettet die Fachkraft
        ihr Werkzeug zurück ins Lager. Jede Baustelle braucht erst einen <b>Planierer mit
        Schaufel</b>, dann einen <b>Bauarbeiter mit Hammer</b> (beide bringen ihr Werkzeug danach
        zurück). Auch der <b>Geologe</b> nimmt eine Spitzhacke mit und bringt sie nach seinem
        Einsatz zurück ins Lager.</p>
        <h3>Jagd & Tiere</h3>
        <p>In den Wäldern streift <b>Wild</b> umher: Rehe, Hasen und Wildschweine. Der <b>Jäger</b>
        pirscht sich an ein echtes Tier heran und erlegt es mit dem Bogen – ohne Wild in Reichweite
        gibt es kein Fleisch. In unbesiedelten Wäldern vermehrt sich das Wild langsam. Auch
        <b>Fischgründe</b> erholen sich mit der Zeit ein wenig. Der <b>Späher</b> (an jeder
        Fahne) erkundet den Nebel. Die <b>Eselzucht</b> schickt Esel auf stark befahrene Straßen –
        der Transport dort wird schneller. <b>Seehandel</b>: Baue zwei Häfen an der Küste und eine
        Werft – ihr Schiff eröffnet einen Seeweg, über den Waren automatisch verschifft werden.</p>
        <h3>Schwierigkeitsgrad</h3>
        <p><b>Leicht</b>: mehr Startwaren, zurückhaltende Gegner. <b>Normal</b>: ausgewogen.
        <b>Schwer</b>: knapper Start, stärkere und aggressivere Gegner. Einstellbar vor jeder
        Partie – in der Kampagne über der Missionsliste, im freien Spiel im Formular.</p>
        <h3>Militär – drei Truppentypen</h3>
        <p>Im Hauptquartier entstehen Soldaten aus Bier + Waffe:
        <b>Schwertkämpfer</b> (Schwert + Schild, stark im Nahkampf),
        <b>Speerkämpfer</b> (Speer) und <b>Bogenschützen</b> (Bogen – schießen vor jedem
        Nahkampf eine Pfeilsalve). Es gilt: Schwert schlägt Speer, Speer schlägt Bogen,
        Bogen schlägt Schwert. Münzen aus der Prägerei sind Sold: Sie stärken die Verteidiger
        des Militärgebäudes, in dem sie lagern.</p>
        <h3>So greifst du an</h3>
        <p>1. Baue <b>Militärgebäude in Richtung des Feindes</b> – nur Soldaten aus Gebäuden
        in Reichweite können angreifen.<br>
        2. Über jedem erreichbaren Feindgebäude erscheint ein <b>⚔️ Schwerter-Zeichen</b>.<br>
        3. <b>Tippe das Feindgebäude an</b>, wähle mit dem Regler die Truppenstärke und
        bestätige mit „Angriff!“.<br>
        Angreifbar sind nur <b>Militärgebäude und das Hauptquartier</b>. Fällt das feindliche
        Hauptquartier, ist der Gegner besiegt.</p>
        <h3>Missionen</h3>
        <p>Die Kampagne erzählt in 10 Missionen die Geschichte von Königin Maras Volk – mit
        unterschiedlichen Landschaften und Zielen. Fortschritt wird automatisch gespeichert.</p>
        <button class="mbtn back" data-back>Zurück</button>
      </div>
    </div>
    <div id="scr-story" class="screen hidden">
      <div class="panel story">
        <h2 id="story-title"></h2>
        <img id="story-img" alt="" hidden>
        <p id="story-text"></p>
        <p id="story-tips" class="tips"></p>
        <button id="story-go" class="mbtn primary">Auf geht's!</button>
      </div>
    </div>
    <div id="scr-game" class="screen hidden">
      <canvas id="cv"></canvas>
      <div id="title-banner"><span>Neuland</span></div>
      <div id="hud-top">
        <div id="res-bar"></div>
      </div>
      <div id="goods-row">
        <div id="unit-bar"></div>
      </div>
      <div id="objectives" class="hidden"></div>
      <div id="obj-chip" class="hidden"></div>
      <div id="msg-toast" class="hidden"></div>
      <!-- H1: die Knoepfe, die man WIRKLICH drueckt, liegen unten links in
           der Daumenzone. Oben stehen nur noch die Anzeigen (Siedler, Waren) -
           die liest man, man tippt sie kaum an. Vorher sass alles Bedienbare
           am oberen Rand: auf einem 6-Zoll-Geraet muss man dafuer die Hand
           umgreifen, waehrend die untere Haelfte leer blieb. -->
      <div id="hud-thumb">
        <button id="g-menu" class="hbtn" title="Menü"></button>
        <button id="g-pause" class="hbtn"></button>
        <button id="g-speed" class="hbtn">1×</button>
      </div>
      <div id="minimap-wrap"><canvas id="minimap" width="220" height="220"></canvas><img id="mapring" src="assets/ui_ring.png" alt=""></div>
      <div id="sheet" class="hidden"></div>
      <div id="game-menu" class="hidden">
        <div class="panel">
          <h2>Pause</h2>
          <button id="gm-resume" class="mbtn primary">Weiterspielen</button>
          <button id="gm-save" class="mbtn">💾 Speichern</button>
          <button id="gm-objectives" class="mbtn">🎯 Missionsziele</button>
          <button id="gm-stats" class="mbtn">📊 Statistik</button>
          <button id="gm-export" class="mbtn">📤 Spielstand exportieren</button>
          <button id="gm-quit" class="mbtn back">Zum Hauptmenü</button>
          <p class="note" id="gm-build" style="text-align:center;opacity:0.5">Fassung –</p>
        </div>
      </div>
      <div id="stats" class="hidden"></div>
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
    // Lautstärkeregler (KD2): live beim Ziehen, gespeichert beim Loslassen
    const volInit=(id, key, kind)=>{
      const s=$(id); if(!s) return;
      const v0=this.opts[key]??1;
      s.value=String(Math.round(v0*100));
      Sound.setVol(kind, v0);
      s.oninput=(e)=>{ const v=(+e.target.value)/100; this.opts[key]=v; Sound.setVol(kind, v); };
      s.onchange=()=>SAVE.setOptions(this.opts);
    };
    volInit('#o-vol','volMaster','master');
    volInit('#o-vol-music','volMusic','music');
    volInit('#o-vol-sfx','volSfx','sfx');
    // Weichzeichner am Bildrand (Tilt-Shift). Er liest jedes Bild zweimal aus
    // dem Canvas zurueck; auf schwacher Grafik ist das der groesste einzelne
    // Posten der Bildzeit.
    // Seit v164 STANDARDMAESSIG AUS: der Nutzer hat die Randunschaerfe
    // zweimal als stoerend gemeldet (oben am Massiv, unten am Bildrand) -
    // die Diorama-Anmutung ist Geschmackssache und jetzt Opt-in. Wer sie
    // frueher ausdruecklich angehakt hat (tilt===true), behaelt sie.
    const tiltAn=(this.opts.tilt===true);
    $('#o-tilt').checked=tiltAn;
    if(this.renderer) this.renderer.tiltAus=!tiltAn;
    $('#o-tilt').onchange=(e)=>{ this.opts.tilt=e.target.checked;
      if(this.renderer) this.renderer.tiltAus=!e.target.checked;
      SAVE.setOptions(this.opts); };
    // Schwierigkeitsgrad (gemerkt für Kampagne und freies Spiel)
    const diffInit=this.opts.diff||'normal';
    for(const id of ['#c-diff','#f-diff']){
      const s=$(id); if(!s) continue;
      s.value=diffInit;
      s.onchange=(e)=>{ this.opts.diff=e.target.value; SAVE.setOptions(this.opts);
        const o=$(id==='#c-diff'?'#f-diff':'#c-diff'); if(o) o.value=e.target.value; };
    }
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
    $('#res-bar').onclick=()=>{ Sound.sfx('tap'); this.openStockSheet(); };
    const ub=$('#unit-bar');
    if(ub) ub.onclick=()=>{ Sound.sfx('tap'); this.openStockSheet(); };
    $('#gm-resume').onclick=()=>{ Sound.sfx('tap'); this.pauseMenu(false); };
    $('#gm-save').onclick=()=>{ Sound.sfx('tap'); this.saveDialog(); };
    $('#gm-export').onclick=()=>{ if(this.game) SAVE.exportSave(this.game); };
    $('#gm-objectives').onclick=()=>{ this.pauseMenu(false); this.toggleObjectives(true); };
    $('#gm-stats').onclick=()=>{ Sound.sfx('tap'); this.pauseMenu(false); this.openStats(); };
    $('#gm-quit').onclick=()=>{
      Sound.sfx('tap');
      if(this.game && !this.game.over) SAVE.saveSlot('auto',this.game,'Autosave');
      this.game=null; this.pauseMenu(false); this.showScreen('title');
    };
    $('#g-speed').onclick=()=>{
      Sound.sfx('tap');
      const ix=SPEED_STEPS.indexOf(this.opts.speed);
      this.opts.speed=SPEED_STEPS[(ix+1)%SPEED_STEPS.length];
      $('#g-speed').textContent=speedLabel(this.opts.speed);
      SAVE.setOptions(this.opts);
    };
    $('#g-pause').onclick=()=>{
      Sound.sfx('tap');
      this.paused=!this.paused;
      this.syncPauseBtn();
    };
    $('#minimap').addEventListener('pointerdown',(e)=>{
      if(!this.game) return;
      const r=e.target.getBoundingClientRect();
      const m=this.game.map;
      // H4: Die Karte fuellt seit dem Umbau nicht mehr das ganze Quadrat,
      // sondern das groesste vollstaendig in den Kreis passende Rechteck
      // (siehe drawMinimap). Der Tipp muss dieselbe Umrechnung benutzen,
      // sonst springt die Kamera daneben.
      const kk=1/Math.hypot(m.w,m.h);            // Seitenanteil je Knoten
      const fx=((e.clientX-r.left)/r.width  - (1-kk*m.w)/2)/(kk*m.w);
      const fy=((e.clientY-r.top )/r.height - (1-kk*m.h)/2)/(kk*m.h);
      this.cam.x=Math.max(0,Math.min(1,fx))*m.w*TILE;
      this.cam.y=Math.max(0,Math.min(1,fy))*m.h*ROWH;
    });
    $('#objectives').onclick=()=>this.toggleObjectives(false);
    // KD4/F2: der Ziel-Chip ist DAUERHAFT im Bild (das grosse Zieltableau
    // verschwand nach 4 s und kam nur ueber das Pausemenue wieder - wer die
    // Einblendung verpasste, spielte blind). Tippen oeffnet das Tableau.
    $('#obj-chip').onclick=()=>{ Sound.sfx('tap'); this.toggleObjectives(true); };
  }
  showScreen(name){
    document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
    $('#scr-'+name).classList.remove('hidden');
    this.screen=name;
    // Ambience-Bett gehoert zur Spielansicht - in Menues ausblenden (KD2)
    if(name!=='game') Sound.ambienceMix({wasser:0, wald:0, fels:0});
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
      difficulty:this.opts.diff||'normal',
      gate:!!mi.gate,
      players:[{name:'Königin Mara', ai:false},
        ...mi.ais.map(a=>({name:a.name, ai:true, aiLevel:a.lvl}))],
      level:{id:mi.id, title:mi.title},
      objectives:mi.objectives,
    };
    $('#story-title').textContent=`Mission ${mi.id}: ${mi.title}`;
    // Missions-Tafel (Landschaftsbild der Karte)
    const simg=$('#story-img');
    simg.hidden=true;
    simg.onload=()=>{ simg.hidden=false; };
    simg.onerror=()=>{ simg.hidden=true; };
    simg.src=`assets/story_${mi.id}.jpg`;
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
      difficulty:$('#f-diff')?.value || this.opts.diff || 'normal',
      players:[{name:'Du', ai:false},
        ...Array.from({length:ais},(_,i)=>({name:['Fürst Corvin','Fürstin Isra','Fürst Halvar'][i], ai:true, aiLevel:lvl}))],
      // KD5/F7: waehlbares Spielziel statt fest "Vernichtung". Die Zieltypen
      // territory/soldiers existieren seit R9 in checkObjectives; ohne
      // Gegner faellt "Alle besiegen" automatisch auf "Nur bauen" zurueck.
      objectives: (()=>{
        const z=$('#f-ziel')?.value || 'sieg';
        if(z==='land') return [{type:'territory', count:1500, desc:'Beherrsche 1500 Felder'}];
        if(z==='heer') return [{type:'soldiers', count:25, desc:'Stelle 25 Soldaten auf'}];
        if(z==='frei' || ais===0) return [];
        return [{type:'destroyEnemies', desc:'Besiege alle Gegner'}];
      })(),
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
    // Minikarte sofort zeichnen statt erst im 500-ms-Takt der Spielschleife
    this._mmT=0;
    this.renderer.drawMinimap($('#minimap'), this.cam);
    $('#g-speed').textContent=speedLabel(this.opts.speed);
    this.syncPauseBtn();
    this.closeSheet();
    this.showScreen('game');
    if(game.objectives.length) this.toggleObjectives(true, 4000);
    // KD4/F4: Erste-Schritte-Tipps, einmal je Profil, nur im freien Spiel
    // (die Kampagne erklaert sich ueber ihre Story-Tafeln). Drei kurze
    // Toasts in den ersten zwei Minuten; danach nie wieder.
    if(this.freeMode && !this.opts.tippsGesehen){
      this.opts.tippsGesehen=true; SAVE.setOptions(this.opts);
      const T=[
        [6000,  'Erste Schritte: Holzfäller, Sägewerk und Steinbruch bauen – Bauplatz antippen.'],
        [45000, 'Jedes Gebäude braucht eine STRASSE von seiner Fahne zum Hauptquartier – sonst trägt niemand Waren.'],
        [100000,'Wachhäuser erweitern dein Gebiet. Erz findet der Geologe: Fahne im Gebirge antippen und losschicken.'],
      ];
      for(const [ms,txt] of T)
        setTimeout(()=>{ if(this.game && this.screen==='game') this.toast('💡 '+txt); }, ms);
    }
  }
  resumeFromData(data){
    try{
      const g=Game.deserialize(data);
      this.launch(g);
    }catch(e){ console.error(e); alert('Spielstand konnte nicht geladen werden.'); }
  }
  // Stereo (KD2): Wo liegt die Weltposition im Bild? Links/rechts der
  // Bildmitte ergibt den Pan, gedeckelt, damit nichts hart im Ohr klebt.
  panVon(wx){
    const px=(wx-this.cam.x)*this.cam.z;
    return Math.max(-0.8, Math.min(0.8, px/(((this.renderer&&this.renderer.vw)||800)/2)));
  }
  hookSounds(g){
    g.onBuilt=()=>Sound.sfx('done');
    g.onProduce=()=>{};
    // Handwerker-Geräusche je nach Tätigkeit, leiser mit Entfernung zur
    // Kamera und (KD2) von der Seite, auf der sie im Bild liegen
    const JOB_SFX={chop:'chop', pick:'pick', sow:'dig', plant:'dig', harvest:'rustle', fish:'splash', hunt:'rustle'};
    g.onWorkerAct=(u)=>{
      const name=JOB_SFX[u.jobKind];
      if(!name) return;
      const d=Math.hypot(u.x-this.cam.x, u.y-this.cam.y)*this.cam.z;
      if(d>750) return;
      Sound.sfx(name, Math.max(0.15, 1-d/750), this.panVon(u.x));
    };
    g.onGeoProbe=(u)=>{
      const d=Math.hypot(u.x-this.cam.x, u.y-this.cam.y)*this.cam.z;
      if(d>750) return;
      Sound.sfx('pick', Math.max(0.15, 1-d/750), this.panVon(u.x));
    };
    g.onClash=(b)=>{
      const [x,y]=g.map.worldPos(b.node);
      const d=Math.hypot(x-this.cam.x, y-this.cam.y)*this.cam.z;
      if(d>900) return;
      const s=Math.max(0.2, 1-d/900), p=this.panVon(x);
      Sound.sfx('clash', s, p);
      if(Math.random()<0.45) setTimeout(()=>Sound.sfx('grunt', s, p), 120+Math.random()*160);
    };
    g.onGeoFind=(u)=>{
      const d=Math.hypot(u.x-this.cam.x, u.y-this.cam.y)*this.cam.z;
      if(d>900) return;
      Sound.sfx('yay', Math.max(0.25, 1-d/900), this.panVon(u.x));
    };
    g.onRecruit=()=>Sound.sfx('recruit');
    g.onVolley=(x,y)=>{
      const d=Math.hypot(x-this.cam.x, y-this.cam.y)*this.cam.z;
      if(d>850) return;
      Sound.sfx('arrow', Math.max(0.15, 1-d/850), this.panVon(x));
    };
    g.onBurn=(b)=>{
      const [x,y]=g.map.worldPos(b.node);
      const d=Math.hypot(x-this.cam.x, y-this.cam.y)*this.cam.z;
      Sound.sfx('burn', Math.max(0.2, 1-d/900), this.panVon(x));
    };
    g.onBoulder=()=>Sound.sfx('boulder');
    g.onHammer=(u)=>{
      const d=Math.hypot(u.x-this.cam.x, u.y-this.cam.y)*this.cam.z;
      if(d>750) return;
      Sound.sfx('hammer', Math.max(0.15, 1-d/750), this.panVon(u.x));
    };
    g.onLevel=(u)=>{
      const d=Math.hypot(u.x-this.cam.x, u.y-this.cam.y)*this.cam.z;
      if(d>750) return;
      Sound.sfx('dig', Math.max(0.15, 1-d/750), this.panVon(u.x));
    };
    g.onShip=()=>Sound.sfx('splash');
    g.onBattleStart=(b)=>{ if(b.player===0) Sound.sfx('war'); };
    g.onCapture=()=>Sound.sfx('done');
  }
  // Ambience-Bett (KD2): alle 2 s den Bildausschnitt abtasten - Wasser-,
  // Wald- und Gebirgsanteil steuern drei leise Dauerklaenge in sound.js.
  klangKulisse(){
    const g=this.game; if(!g) return;
    const m=g.map;
    let wasser=0, wald=0, fels=0, n=0;
    const halbW=(((this.renderer&&this.renderer.vw)||800)/2)/this.cam.z;
    const halbH=(((this.renderer&&this.renderer.vh)||600)/2)/this.cam.z;
    for(let k=0;k<60;k++){
      const i=m.nearestNode(this.cam.x+(Math.random()*2-1)*halbW,
                            this.cam.y+(Math.random()*2-1)*halbH);
      if(i<0) continue;
      n++;
      const t=m.terr[i];
      if(t===TER.WATER) wasser++;
      else if(t===TER.MOUNT) fels++;
      const o=m.obj[i]&127;
      if(o===OBJ.TREE||o===OBJ.TREE2||o===OBJ.SAPLING) wald++;
    }
    if(!n) return;
    // Wald zaehlt pro Baum-Knoten - schon ein lockerer Hain soll hoerbar
    // sein, deshalb der Faktor 3 mit Deckel.
    Sound.ambienceMix({ wasser:wasser/n, wald:Math.min(1,(wald/n)*3), fels:fels/n });
  }
  // Marschtrommel (KD2/KD1): ziehende Angriffstruppen in Kameranaehe sind
  // zu HOEREN, bevor man sie sieht - alle ~1,2 s ein dumpfer Doppelschlag
  // von der Seite, auf der sie marschieren.
  marschTrommel(){
    const g=this.game; if(!g || this.paused) return;
    let bx=0, bd=1e9;
    for(const u of g.units){
      if(u.dead || u.type!=='attack') continue;
      const d=Math.hypot(u.x-this.cam.x, u.y-this.cam.y)*this.cam.z;
      if(d<bd){ bd=d; bx=u.x; }
    }
    if(bd>800) return;
    Sound.sfx('march', Math.max(0.15, 1-bd/800), this.panVon(bx));
  }

  // ================= Interaktion =================
  onTap(wx,wy){
    if(!this.game || this.screen!=='game') return;
    const m=this.game.map;
    // Haken und Kreuz zuerst: sie stehen im Bild unter dem durchsichtigen
    // Haus und müssen auch dann gehen, wenn sie gerade über Wasser oder
    // über dem Kartenrand liegen – dort gibt es keinen Gitterpunkt.
    if(this.state.mode==='place' && this.renderer._placeBtn){
      const bt=this.renderer._placeBtn;
      const traf=(p)=> p && Math.hypot(wx-p[0], wy-p[1])<=bt.r;
      if(traf(bt.no)){ Sound.sfx('tap'); this.cancelPlace(); return; }
      if(traf(bt.ok)){ Sound.sfx('tap'); this.confirmPlace(); return; }
    }
    if(this.state.mode==='road' && this.renderer._roadBtn){
      const bt=this.renderer._roadBtn;
      const traf=(p)=> p && Math.hypot(wx-p[0], wy-p[1])<=bt.r;
      if(traf(bt.no)){ Sound.sfx('tap'); this.cancelRoad(); return; }
      if(traf(bt.ok)){ Sound.sfx('tap'); this.autoConnect(); return; }
    }
    // Schwebendes Fahnenmenü: Treffer auf die drei Knöpfe zuerst
    if(this.state.flagSel>=0 && this.renderer._flagBtn){
      const bt=this.renderer._flagBtn, fi=this.state.flagSel;
      const traf=(p)=> p && Math.hypot(wx-p[0], wy-p[1])<=bt.r;
      if(traf(bt.weg)){ Sound.sfx('tap'); this.state.flagSel=-1; this.startRoad(fi); return; }
      if(traf(bt.geo)){
        Sound.sfx('tap');
        const r=this.game.callGeologist(0,fi);
        if(r===true){ this.toast('Der Geologe macht sich auf den Weg'); this.state.flagSel=-1; this.state.sel=-1; }
        else if(r==='nopick') this.toast('Keine Spitzhacke! Baue eine Werkzeugschmiede.');
        else if(r==='nomount') this.toast('Kein unbeschildertes Gebirge in der Nähe.');
        return;
      }
      if(traf(bt.sp)){
        Sound.sfx('tap');
        if(this.game.callScout(0,fi)){ this.toast('Der Späher erkundet die Umgebung'); this.state.flagSel=-1; this.state.sel=-1; }
        return;
      }
      // daneben getippt: Menü zu, der Tipp zählt normal weiter
      this.state.flagSel=-1;
    }
    // Fahnen wehen im Bild ÜBER ihrem Bodenpunkt - wer den Wimpel antippt,
    // traf bisher den Knoten dahinter ("der Klickkreis ist immer
    // unterhalb"). Ein Tipp ins gezeichnete Fähnchen zählt deshalb als
    // Tipp auf die Fahne, beim Auswählen wie beim Wegebau.
    let fahnenTreff=-1;
    if(this.state.mode==='view' || this.state.mode==='road'){
      // direkt über alle Fahnen suchen: Türfahnen werden an der Zugbrücke
      // gezeichnet, nicht am Gitterpunkt - der nächste Knoten zum Tipp wäre
      // dort ein anderer. Grobfenster + exakter Bildkasten je Fahne.
      // Der Kasten deckt das GANZE gezeichnete Bild ab (F7, zweiter Anlauf).
      // Vorher fehlten drei Dinge: die Felsanhebung (drawFlag hebt die
      // Fahne um liftAt*HSCALE an, der Klicktest wusste davon nichts - auf
      // Fels tippte man systematisch UNTER die Fahne), die rechte Haelfte
      // des Tuchs (Kasten +-13 um den Mast, das Tuch weht aber bis +16
      // nach rechts) und der Zoom (in Weltpixeln gemessen schrumpft der
      // Kasten am Handy beim Rauszoomen unter jede Fingerspitze - deshalb
      // waechst der Rand mit 1/zoom auf mindestens ~20 Bildschirmpixel).
      const rand=Math.max(4, 20/(this.cam.z||1));
      for(let k=0;k<m.flag.length;k++){
        if(!m.flag[k]) continue;
        const [px,py]=m.worldPos(k);
        if(Math.abs(px-wx)>44+rand || Math.abs(py-wy)>60+rand) continue;
        const p=this.renderer.flagVisualPos? this.renderer.flagVisualPos(k)
              : this.renderer.doorVisualPos? this.renderer.doorVisualPos(k) : [px,py];
        const py2=p[1]-(this.renderer.liftAt? this.renderer.liftAt(k)*26 : 0);
        if(wx>=p[0]-8-rand && wx<=p[0]+16+rand
           && wy>=py2-25-rand && wy<=py2+6+rand){ fahnenTreff=k; break; }
      }
    }
    const i=m.nearestNode(wx,wy);
    if(i<0 && fahnenTreff<0) return;
    Sound.sfx('tap');
    if(this.state.mode==='road'){
      this.roadTap(fahnenTreff>=0? fahnenTreff : i);
      return;
    }
    if(this.state.mode==='place'){
      const can=this.game.canBuild(0, this.state.placeType, i);
      if(can.ok){
        this.state.placeAt=i;
        this.state.showBuildDots=true;
        this.closeSheet();
      } else {
        this.toast(can.r||'Hier nicht möglich');
      }
      return;
    }
    // Auswahl: Gebäude? Fahne? Weg? freier Knoten?
    if(fahnenTreff>=0){ this.state.sel=fahnenTreff; this.openFlagSheet(fahnenTreff); return; }
    if(i<0) return;
    if(m.bld[i]>=0){
      const bb=this.game.buildings.get(m.bld[i]);
      // Feindgebäude im unerforschten Dunkel sind unsichtbar – ein Tipp
      // dorthin darf kein Angriffs-Sheet vor schwarzem Nebel öffnen (F8).
      if(bb && bb.player!==0 && !m.explored[i]){ this.state.sel=-1; this.closeSheet(); return; }
      this.state.sel=i; this.openBuildingSheet(bb); return;
    }
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
    // Das Hauptquartier IST das Netz - es kann nicht von sich selbst getrennt
    // sein. Vorher meldete ausgerechnet das erste Gebaeude, das der Spieler
    // antippt, "Nicht mit dem Wegenetz verbunden": compOf speist sich aus dem
    // Fahnengraphen, und der ist ohne eine einzige Strasse leer.
    if(b.id===hq.id) return true;
    // NICHT zusaetzlich "ohne Wegenetz gilt alles als verbunden": diese
    // Auskunft loest ueber confirmPlace auch den automatischen Wegebau aus.
    // Ein frisch gesetztes Haus ist ohne Strasse WIRKLICH nicht angebunden -
    // sagt man hier "doch", bietet das Spiel nie wieder einen Weg an.
    const c=this.game.compOf(b.door), ch=this.game.compOf(hq.door);
    return c!==undefined && c===ch;
  }
  // ---------- Straßenbau ----------
  startRoad(fromFlag, autoHint=false){
    this.state.mode='road';
    this.state.roadFrom=fromFlag;
    this.state.roadNodes=[fromFlag];
    this.closeSheet();
    // Kein Menü am unteren Rand mehr: an der Fahne schweben ein Schild
    // "Weg bauen" und Haken/Kreuz - dieselbe Bedienung wie beim
    // Bau-Bestätigen. Haken = automatisch ans Netz verbinden, Kreuz =
    // abbrechen, Tippen auf Fahne/Weg = dorthin bauen (roadTap).
  }
  cancelRoad(){ this.state.mode='view'; this.state.roadNodes=null; this.closeSheet(); }
  // sucht selbst den nächsten sinnvollen Anschluss (auch über kurze Distanz)
  // Verbinden: sucht den KÜRZESTEN Anschluss ans eigene Wegenetz – das kann
  // mitten auf einer Straße liegen (dort wird eine Fahne gesetzt, die den Weg
  // teilt) und muss nicht die nächste bestehende Fahne sein.
  autoConnect(){
    const g=this.game, m=g.map;
    const from=this.state.roadNodes[this.state.roadNodes.length-1];
    const mine=new Set(this.state.roadNodes);
    // Nur ANS NETZ verbinden: ein Anschlusspunkt taugt nur, wenn er über
    // Straßen mit einem Lager (Hauptquartier, Lagerhaus, Hafen) verbunden
    // ist. Eine einsame Fahne - etwa die eines Geologen im Gebirge - ist
    // KEIN Anschluss: eine Straße dorthin hinge in der Luft, die Träger
    // liefen ins Leere, und beim nächsten Verbinden entstünde ein
    // Parallelweg zurück ins Tal.
    const netz=new Set();
    {
      const anKnoten=new Map();
      for(const r of g.roads.values()){
        if(r.player!==0 || r.isSea) continue;
        for(const n of r.path){
          let a=anKnoten.get(n);
          if(!a){ a=[]; anKnoten.set(n,a); }
          a.push(r);
        }
      }
      const q=[];
      for(const b of g.buildings.values())
        if(b.player===0 && b.inv && b.state==='done' && b.door>=0 && m.flag[b.door]){ netz.add(b.door); q.push(b.door); }
      while(q.length){
        const n=q.pop();
        for(const r of anKnoten.get(n)||[]) for(const pn of r.path)
          if(!netz.has(pn)){ netz.add(pn); q.push(pn); }
      }
    }
    const cands=[];
    const add=(i,isFlag)=>{
      if(i===from || mine.has(i) || m.owner[i]!==0) return;
      const d=Math.hypot(m.X(i)-m.X(from), m.Y(i)-m.Y(from));
      if(d<=26) cands.push({i,d,isFlag});
    };
    for(const i of netz) add(i, !!m.flag[i]);
    // die schon getippten Wegpunkte darf das Anschlussstück nicht nochmal
    // überlaufen – sonst überlappte der fertige Weg sich selbst
    const avoid=new Set(this.state.roadNodes.slice(0,-1));
    // nach echter Weglänge sortieren, nicht nach Luftlinie
    const scored=[];
    for(const c of cands){
      const seg=g.roadPath(0, from, c.i, avoid);
      if(!seg) continue;
      // Anschluss mitten im Weg kostet eine Fahne -> minimal schlechter bewertet,
      // damit bei Gleichstand die vorhandene Fahne gewinnt
      scored.push({...c, seg, cost: seg.length + (c.isFlag?0:0.5)});
      if(scored.length>=40) break;
    }
    scored.sort((a,b)=>a.cost-b.cost);
    for(const c of scored.slice(0,20)){
      const p=[...this.state.roadNodes, ...c.seg.slice(1)];
      if(c.isFlag){
        if(g.buildRoad(0,p)){ Sound.sfx('road'); this.cancelRoad(); return true; }
      } else if(g.canPlaceFlag(c.i,0)){
        if(g.placeFlag(c.i,0) && g.buildRoad(0,p)){
          Sound.sfx('road'); Sound.sfx('flag'); this.cancelRoad(); return true;
        }
      }
    }
    this.toast('Kein Netz-Anschluss in Reichweite – Fahne oder Weg antippen');
    return false;
  }
  roadTap(i){
    const g=this.game, m=g.map;
    // nach einem Abschluss (cancelRoad) ist die Planung weg – ein
    // nachklappernder Tipp darf dann nicht mehr hineingreifen
    if(this.state.mode!=='road' || !this.state.roadNodes || !this.state.roadNodes.length) return;
    // Zielgebäude angetippt? -> automatisch dessen Türfahne anpeilen
    if(m.bld[i]>=0){
      const tb=g.buildings.get(m.bld[i]);
      if(tb && tb.player===0 && tb.door>=0 && m.flag[tb.door]) i=tb.door;
    }
    // Weg angetippt: dort teilen – und wenn dort keine Fahne erlaubt ist
    // (Mindestabstand bei kurzen Wegen), auf die nächste Fahne des Wegs ausweichen
    if(!m.flag[i]){
      const r0=g.roadAt(i);
      if(r0 && r0.player===0 && !g.canPlaceFlag(i,0)){
        const ends=[r0.path[0], r0.path[r0.path.length-1]].filter(n=>m.flag[n]);
        let best=-1, bd=1e9;
        for(const e of ends){
          const d=Math.hypot(m.X(e)-m.X(i), m.Y(e)-m.Y(i));
          if(d<bd){ bd=d; best=e; }
        }
        if(best>=0) i=best;
      }
    }
    const cur=this.state.roadNodes[this.state.roadNodes.length-1];
    if(i===cur){
      // Nochmal auf den Endpunkt getippt = Weg hier abschließen (Fahne setzen).
      // Das stand zwar als Hinweis in der Statuszeile, kam aber nie zum Zug,
      // weil dieser Fall vorher kommentarlos verschluckt wurde.
      if(this.state.roadNodes.length>1 && g.buildRoad(0, this.state.roadNodes)){
        Sound.sfx('road'); Sound.sfx('flag'); this.cancelRoad();
      }
      return;
    }
    // Tipp auf einen schon getippten Wegpunkt = Planung bis dorthin zurücknehmen.
    // Vorher lief der Tipp auf die STARTFAHNE hier durch und hängte sie als
    // Wegpunkt hintenan – der fertige Weg führte dann mitten durch eine Fahne
    // und über sich selbst.
    {
      const k=this.state.roadNodes.indexOf(i);
      if(k>=0){
        this.state.roadNodes=this.state.roadNodes.slice(0,k+1);
        const st=$('#road-status');
        if(st) st.textContent = k===0? 'Weg bauen' : `${k} Stück`;
        return;
      }
    }
    // das Anschlussstück darf die schon getippten Wegpunkte nicht überlaufen
    const avoid=new Set(this.state.roadNodes.slice(0,-1));
    const seg=g.roadPath(0, cur, i, avoid);
    if(!seg){ this.toast('Kein Weg dorthin möglich'); return; }
    const newPath=[...this.state.roadNodes, ...seg.slice(1)];
    if(g.map.flag[i]){
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
    if(st) st.textContent=`${newPath.length-1} Stück`;
    // Endpunkt könnte Fahne werden: nochmal tippen = abschließen
    // (der Abschluss selbst steckt oben im Fall i===cur)
    if(g.canPlaceFlag(i,0) && st)
      st.textContent=`${newPath.length-1} Stück · nochmal tippen = fertig`;
  }

  // ---------- Sheets (Bottom-Panels) ----------
  sheet(html){
    const s=$('#sheet');
    s.innerHTML=html;
    s.classList.remove('hidden');
  }
  // H2: Das Blatt am unteren Rand ist bis zu 52 % hoch. Wer einen Bauplatz
  // im unteren Bilddrittel antippt, waehlt danach ein Gebaeude fuer eine
  // Stelle, die er nicht mehr sieht - und die gruenen Bauplatzpunkte
  // daneben genauso wenig. Die Kamera schiebt den Platz deshalb in das
  // freie Band zwischen Kopfleisten und Blatt. Sie GLEITET dorthin (rund
  // eine Fuenftelsekunde): ein Sprung im selben Moment, in dem sich das
  // Blatt aufschiebt, verliert den Bezug zum angetippten Punkt.
  blattFreiRuecken(node){
    if(node==null || node<0 || !this.game) return;
    requestAnimationFrame(()=>{
      const s=$('#sheet');
      const hoehe = (!s || s.classList.contains('hidden'))? 0 : s.getBoundingClientRect().height;
      const vh=this.renderer.vh;
      const oben=118, unten=vh-hoehe-16;
      if(unten-oben<80) return;                       // kein sinnvolles Band
      const [,wy]=this.game.map.worldPos(node);
      const sy=(wy-this.cam.y)*this.cam.z + vh/2;
      if(sy>=oben && sy<=unten) return;               // liegt schon frei
      const ziel=(oben+unten)/2;
      this._camZug={ von:this.cam.y, nach: wy-(ziel-vh/2)/this.cam.z, t0:performance.now(), ms:190 };
    });
  }
  kameraZiehen(now){
    const z=this._camZug; if(!z) return;
    // Wer waehrenddessen selbst schiebt, hat Vorrang: hat sich cam.y seit dem
    // letzten Bild von aussen geaendert, bricht der Zug ab.
    if(z.zuletzt!==undefined && Math.abs(this.cam.y-z.zuletzt)>0.5){ this._camZug=null; return; }
    const f=Math.min(1,(now-z.t0)/z.ms);
    const e=f<0.5? 2*f*f : 1-Math.pow(-2*f+2,2)/2;    // weich rein, weich raus
    this.cam.y = z.von + (z.nach-z.von)*e;
    z.zuletzt = this.cam.y;
    if(f>=1) this._camZug=null;
  }
  closeSheet(){ $('#sheet').classList.add('hidden'); this.state.showBuildDots=false; }
  openBuildSheet(i){
    const g=this.game;
    this.state.showBuildDots=true;
    const cat=this.state.buildCat;
    const inv=g.invTotal(0);
    let tabs=CATS.map(([k,label])=>{
      const ic=this.renderer.asset('ui_tab_'+k)
        ? `<img class="tabicon" src="assets/ui_tab_${k}.png" alt="">` : '';
      return `<button class="tab ${k===cat?'on':''}" data-cat="${k}">${ic}${label}</button>`;
    }).join('');
    let items='';
    for(const key in BLD){
      const def=BLD[key];
      if(def.cat!==cat || key==='hq') continue;
      const can=g.canBuild(0,key,i);
      const cost=Object.entries(def.cost).map(([k,v])=>`${v} ${GOODS[k].name}`).join(', ')||'–';
      const afford=(inv.board||0)>=(def.cost.board||0)&&(inv.stone||0)>=(def.cost.stone||0);
      // Gebäudebild aus dem Asset-Pack (Baukarte)
      const img=this.renderer.asset('bld_'+key)
        ? `<img class="bthumb" src="assets/bld_${key}.png" alt="" loading="lazy">` : '';
      const sz={S:'◾ klein', M:'◼ mittel', L:'⬛ groß', MINE:'⛰ Gebirge'}[def.size]||'';
      items+=`<button class="bitem" data-bld="${key}">
        ${img}<span class="binfo"><b>${def.name}</b><small>${cost} · ${sz}${afford?'':' ⚠️'}</small>
        <small class="desc">${def.desc}</small></span></button>`;
    }
    this.sheet(`<div class="sh-head"><b>Bauen</b>
      <button class="hbtn" id="sh-flag" title="Fahne">🚩</button>
      <button class="hbtn" id="sh-x">✕</button></div>
      <div class="tabs">${tabs}</div>
      <div class="bgrid">${items}</div>`);
    this.blattFreiRuecken(i);          // H2: Bauplatz nicht unters Blatt legen
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
      this.state.showBuildDots=true;
      if(this.state.placeAt>=0){
        // Vorschau steht schon im Bild, samt Namen, Haken und Kreuz –
        // das Menü macht dafür den Blick frei
        this.closeSheet();
      } else {
        this.sheet(`<div class="sh-head"><b>${BLD[key].name} platzieren</b><button class="hbtn" id="sh-x">✕</button></div>
          <p class="note">Grüne Punkte zeigen, wo ${BLD[key].name} gebaut werden darf.
          Tippe einen an, dann bestätigst du mit dem Haken.</p>`);
        $('#sh-x').onclick=()=>this.cancelPlace();
      }
    });
  }
  cancelPlace(){
    this.state.mode='view'; this.state.placeAt=-1; this.state.placeType=null;
    this.closeSheet();
  }
  // Bestätigen über den grünen Haken im Bild – ein eigener Dialog dafür
  // verdeckte ausgerechnet die Stelle, um die es gerade ging.
  confirmPlace(){
    const key=this.state.placeType;
    if(!key || this.state.placeAt<0) return;
    const r=this.game.placeBuilding(0, key, this.state.placeAt);
    if(r.ok){
      Sound.sfx('place');
      this.state.mode='view'; this.state.placeAt=-1; this.state.placeType=null; this.state.sel=-1;
      this.closeSheet();
      if(!this.isConnected(r.b)) this.startRoad(r.b.door,true);
    } else {
      this.toast(r.r||'Hier nicht mehr möglich');
      this.state.placeAt=-1;
    }
  }
  openFlagSheet(i){
    // Kein schwarzes Menü am Rand mehr: an der Fahne schweben drei Knöpfe
    // (Weg bauen / Geologe / Späher) - gezeichnet vom Renderer, Treffer
    // laufen über onTap. "Fahne entfernen" liegt im Langdruck-Menü.
    const g=this.game;
    const hasMount=g.nodesInRange(i,8).some(n=>g.map.terr[n]===TER.MOUNT && !g.signs.has(n));
    const picks=(g.invTotal(0).pick||0);
    this.state.flagSel=i;
    this.state.flagGeoOk= hasMount && picks>0;
    this.closeSheet();
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
    // H2 gilt genauso fuer das Haus selbst: sein eigenes Blatt schob es
    // sonst unter den Bildrand, und man regelte Vorraete fuer ein Gebaeude,
    // das man nicht mehr sah.
    this.blattFreiRuecken(b.node);
    const g=this.game, def=BLD[b.type];
    if(b.player!==0){
      // Feindgebäude: Angriff?
      if(def.mil||b.type==='hq'){
        // Spähwissen durch den Angriffsbefehl: Kamera aufs Ziel und einen
        // kleinen Sichtkreis lüften, damit das Sheet nicht vor schwarzem
        // Nebel schwebt (Kritikbericht F8).
        // Radius 4: die Nebelschwaden fransen ~1,5 Knoten in Sichtbares
        // hinein – ein kleinerer Kreis ersöffe komplett im Dunst
        g.exploreAround(b.node, 4);
        this.jumpTo(b.node);
        const avail=g.attackable(0,b.id);
        const isSite=b.state==='build';
        const defN=(b.soldiers?.length||0)+(b.type==='hq'?g.recruitTotal(b.player):0);
        this.sheet(`<div class="sh-head"><b style="color:${PLAYER_COLORS[b.player]}">${def.name} (${g.players[b.player].name})</b>
          <button class="hbtn" id="sh-x">✕</button></div>
          <p class="note">${isSite?'⚠️ Baustelle – ein Angriff reißt sie nieder (keine Eroberung).':`Verteidiger: ~${defN}`} · Deine verfügbaren Angreifer: ${avail}</p>
          ${avail>0?`<div class="row"><input type="range" id="atk-n" min="1" max="${avail}" value="${isSite?1:Math.min(avail,Math.max(1,defN+1))}">
          <span id="atk-nv">${isSite?1:Math.min(avail,Math.max(1,defN+1))}</span></div>
          <button class="mbtn primary" id="atk-go">${isSite?'🔥 Baustelle zerstören':'⚔️ Angriff!'}</button>`:'<p class="note">Keine Soldaten in Reichweite. Baue Militärgebäude näher an den Feind!</p>'}`);
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
    let body='', body_extra='';
    if(b.state==='build'){
      const needB=def.cost.board||0, needS=def.cost.stone||0;
      body=`<p class="note">Baustelle · Bretter ${b.stock.board||0}/${needB} · Steine ${b.stock.stone||0}/${needS}</p>
      ${this.isConnected(b)?'':'<p class="warn">⚠️ Nicht mit dem Wegenetz verbunden!</p>'}`;
    } else {
      const rows=[];
      if(b.worker && !b.worker.present){
        rows.push(b.needTool
          ? `⚠️ Wartet auf Werkzeug: <b>${GOODS[b.needTool].name}</b> (Werkzeugschmiede!)`
          : '🚶 Fachkraft ist auf dem Weg …');
      }
      if(b.type==='hunter' && b.state==='done'){
        const [bx,by]=g.map.worldPos(b.node);
        const wild=g.animals.filter(a=>Math.hypot(a.x-bx,a.y-by)<(def.range||9)*40).length;
        rows.push(wild? `Wild in Reichweite: ${wild}` : '⚠️ Kein Wild in Reichweite – Wälder ziehen Tiere an.');
      }
      if(def.prod){
        for(const k in def.prod.inputs) rows.push(`${GOODS[k].name}: ${b.stock[k]||0}`);
        rows.push(`Fertig: ${b.out||0}`);
      }
      // Schmieden: der Spieler bestimmt, was gerade auf den Amboss kommt
      if(def.prod && def.prod.outs){
        const cur=b.makeGood||null;
        rows.push(`Schmiedet: <b>${cur? GOODS[cur].name : 'nach Bedarf'}</b>`);
        body_extra=`<div class="pickrow" id="mk-row">
          <button class="pick${cur?'':' on'}" data-mk="">🎯<small>Bedarf</small></button>
          ${def.prod.outs.map(o=>`<button class="pick${cur===o?' on':''}" data-mk="${o}" title="${GOODS[o].name}">
            ${this.goodIcon(o)}<small>${GOODS[o].name}</small></button>`).join('')}
        </div>`;
      }
      if(def.mine){
        const left=g.oreLeft(b)||0;
        const oreN={coal:'Kohle',ironore:'Eisenerz',gold:'Golderz',stone:'Granit'}[def.mine]||'Vorkommen';
        rows.push(`Essen: ${['fish','bread','meat'].map(f=>b.stock[f]||0).reduce((a,c)=>a+c,0)}`,
          `Gefördert wartend: ${b.out||0}`,
          b.depleted? '⚠️ Vorkommen erschöpft'
            : `${oreN} im Berg: <b>${left}</b> ${this.oreBar(left)}`);
      }
      if(def.gather){
        rows.push(`Ware wartend: ${b.out||0}`);
        if(b.exhausted) rows.push('⚠️ Nichts mehr in Reichweite – Umgebung erschöpft');
      }
      if(def.cata){ rows.push(`Steine: ${b.stock.stone||0}`); }
      if(b.soldiers){
        const byT=STYPE_LIST.map(t=>{
          const n=b.soldiers.filter(s=>s===t).length;
          return n? `${n}× ${STYPES[t].short}` : null;
        }).filter(Boolean).join(' · ');
        const want=b.garrison??def.mil.cap;
        rows.push(`Besatzung: ${b.soldiers.length}/${def.mil.cap}${byT? ' ('+byT+')':''}`,
          `Sold (Münzen): ${b.coins||0}`,
          `Soll-Stärke (antippen): <span class="pips" id="gar-pips">${
            Array.from({length:def.mil.cap},(_,k)=>
              `<button class="pip${k<want?' on':''}" data-n="${k+1}" title="${k+1} Mann">🛡</button>`).join('')
          }</span>`);
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
    // Arbeitsbetrieb: pausieren und Essen zuteilen (nur fertige Produktionsstätten)
    const works=b.state==='done' && (def.prod||def.mine||def.gather);
    const canFeed=works && !def.foodBoost && !def.mine;
    const status= b.state==='build' ? 'Im Bau'
      : b.paused ? 'Pausiert'
      : b.worker && !b.worker.present ? 'Wartet auf Fachkraft'
      : b.satPause ? 'Lager voll – ruht'          // Bedarfsbremse (läuft von selbst wieder an)
      : b.exhausted ? 'Umgebung erschöpft'
      : 'In Betrieb';
    this.sheet(`${this.sheetHead(def.name, status, 'bld_'+b.type)}
      ${body}
      ${body_extra}
      <div class="sh-acts">
        ${this.actBtn('bd-road','🛤️','Straße')}
        ${works? this.actBtn('bd-pause', b.paused?'▶️':'⏸️', b.paused?'Weiter':'Pausieren', b.paused):''}
        ${canFeed? this.actBtn('bd-food','🍖','Essen', b.foodPrio):''}
        ${b.type!=='hq'? this.actBtn('bd-del','🔥','Abreißen', false, true):''}
      </div>`);
    $('#sh-x').onclick=()=>{ this.state.sel=-1; this.closeSheet(); };
    $('#bd-road').onclick=()=>this.startRoad(b.door);
    const pz=$('#bd-pause');
    if(pz) pz.onclick=()=>{ b.paused=!b.paused; Sound.sfx('tap'); this.openBuildingSheet(b); };
    const fd=$('#bd-food');
    if(fd) fd.onclick=()=>{ b.foodPrio=!b.foodPrio; Sound.sfx('tap'); this.openBuildingSheet(b); };
    document.querySelectorAll('#mk-row .pick').forEach(p=> p.onclick=()=>{
      b.makeGood = p.dataset.mk || null;
      b.chosenTool = b.makeGood || b.chosenTool;
      Sound.sfx('tap'); this.openBuildingSheet(b);
    });
    document.querySelectorAll('#gar-pips .pip').forEach(p=> p.onclick=()=>{
      const n=+p.dataset.n;
      // erneutes Antippen der aktuellen Stärke setzt wieder auf volle Besatzung
      b.garrison = (b.garrison===n)? def.mil.cap : n;
      Sound.sfx('tap'); this.openBuildingSheet(b);
    });
    const del=$('#bd-del');
    if(del) del.onclick=()=>{
      this.confirm(`${def.name} wirklich abreißen?`, ()=>{
        g.demolish(b.id); Sound.sfx('place'); this.state.sel=-1; this.closeSheet();
      });
    };
  }
  // kleines Warenbild für Knöpfe und Listen
  goodIcon(k){
    return this.renderer.asset('good_'+k) ? `<img src="assets/good_${k}.png" alt="">`
         : this.renderer.asset('icon_'+k) ? `<img src="assets/icon_${k}.png" alt="">`
         : `<span>${(GOODS[k]?GOODS[k].name:k).slice(0,2)}</span>`;
  }
  // Kopfzeile eines Sheets: Gebäudebild, Name, Statuszeile
  sheetHead(title, status, imgKey){
    const img= imgKey && this.renderer.asset(imgKey) ? `<img class="sh-ic" src="assets/${imgKey}.png" alt="">` : '';
    return `<div class="sh-head">${img}
      <div class="sh-title"><b>${title}</b>${status?`<small>${status}</small>`:''}</div>
      <button class="hbtn" id="sh-x">✕</button></div>`;
  }
  // Aktionsknopf: Symbol oben, Beschriftung darunter – überall gleich groß
  actBtn(id, icon, label, on=false, danger=false){
    return `<button class="abtn${on?' on':''}${danger?' danger':''}" id="${id}">
      <i>${icon}</i><span>${label}</span></button>`;
  }
  // kleiner Balken für das verbleibende Erzvorkommen
  oreBar(n){
    const f=Math.max(0,Math.min(1,n/60));
    const col= f>0.5? '#7ec96b' : f>0.2? '#e8c15a' : '#d9704f';
    return `<span class="orebar"><i style="width:${(f*100).toFixed(0)}%;background:${col}"></i></span>`;
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
    // Eigene Fahnen (außer Türfahnen) lassen sich hier entfernen - das
    // Fahnen-Tippmenü zeigt nur noch die drei schwebenden Knöpfe.
    const darfWeg= m.flag[i] && m.owner[i]===0 && ![...g.buildings.values()].some(b=>b.door===i);
    this.sheet(`<div class="sh-head"><b>Gelände-Info</b><button class="hbtn" id="sh-x">✕</button></div>
      <p class="note">${tn} · Besitzer: ${owner}${on?'<br>'+on:''}${ore?'<br>'+ore:''}</p>
      ${darfWeg?'<div class="row"><button class="mbtn back" id="in-delflag">Fahne entfernen</button></div>':''}`);
    $('#sh-x').onclick=()=>this.closeSheet();
    const del=$('#in-delflag');
    if(del) del.onclick=()=>{ this.game.removeFlag(i); Sound.sfx('tap'); this.state.flagSel=-1; this.state.sel=-1; this.closeSheet(); };
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
    // Der Knopf traegt sein Zeichen als CSS-Klasse (font-size ist 0, ein
    // gesetzter Text war ohnehin unsichtbar). Ohne syncPauseBtn blieb er nach
    // "Weiterspielen" auf Pause stehen: der naechste Tipp pausierte, obwohl
    // der Spieler fortsetzen wollte.
    this.syncPauseBtn();
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
  // ================= Statistik (H3) =================
  // Bisher gab es keinerlei Zahlenwerk: ob die Siedlung waechst oder nur
  // beschaeftigt ist, ob der Gegner davonzieht, wo die Waren haengen - alles
  // Bauchgefuehl. Der Bildschirm zeigt drei Dinge:
  //   1. Verlaufskurve einer Groesse ueber die Spielzeit, alle Spieler
  //      uebereinander (Land, Bauten, Siedler, Soldaten, Waren)
  //   2. Der aktuelle Stand als Balken im Vergleich
  //   3. Das eigene Lager, Ware fuer Ware
  // Die Daten sammelt die Simulation alle 30 Sekunden Spielzeit selbst.
  static STAT_FELDER=[['land','Land','🗺'],['bauten','Gebäude','🏠'],
                      ['siedler','Siedler','🧍'],['soldaten','Soldaten','⚔️'],
                      ['waren','Waren','📦']];
  openStats(feld){
    const g=this.game; if(!g) return;
    if(!g.stats) g.statistikTakt();               // sofort einen Stand erzeugen
    this.statFeld = feld || this.statFeld || 'land';
    const F=UI.STAT_FELDER;
    const akt=this.statFeld;
    const s=g.stats;
    const tabs=F.map(([k,label,ic])=>
      `<button class="tab ${k===akt?'on':''}" data-f="${k}">${ic} ${label}</button>`).join('');
    // Balken: aktueller Stand je Spieler
    const jetzt=g.players.map((p,i)=>{
      const r=s.spieler[i]; const arr=r? r[akt] : [];
      return { i, name:p.name, wert: arr.length? arr[arr.length-1] : 0, tot:!!p.defeated };
    });
    const max=Math.max(1, ...jetzt.map(x=>x.wert));
    const balken=jetzt.map(x=>`<div class="st-zeile">
        <span class="st-name" style="color:${PLAYER_COLORS[x.i]}">${x.name}${x.tot?' †':''}</span>
        <span class="st-bahn"><i style="width:${Math.round(x.wert/max*100)}%;
              background:${PLAYER_COLORS[x.i]}"></i></span>
        <b class="st-wert">${x.wert}</b></div>`).join('');
    // Lager: eigene Waren, absteigend
    const inv=g.invTotal(0);
    const waren=GOOD_LIST.filter(k=>inv[k]).sort((a,b)=>inv[b]-inv[a])
      .map(k=>`<span class="st-ware"><i style="background:${goodColor(k)}"></i>${GOODS[k].name} <b>${inv[k]}</b></span>`).join('');
    const min=Math.floor(g.t/600), sek=Math.floor(g.t/10)%60;
    $('#stats').innerHTML=`<div class="panel">
      <div class="sh-head"><b>📊 Statistik</b>
        <span class="st-zeit">${min}:${String(sek).padStart(2,'0')} Spielzeit</span>
        <button class="hbtn" id="st-x">✕</button></div>
      <div class="tabs">${tabs}</div>
      <canvas id="st-kurve" width="640" height="300"></canvas>
      <div class="st-legende">${g.players.map((p,i)=>
        `<span style="color:${PLAYER_COLORS[i]}">▬ ${p.name}</span>`).join('')}</div>
      <div class="st-balken">${balken}</div>
      <h3>Eigenes Lager</h3>
      <div class="st-waren">${waren||'<i>nichts eingelagert</i>'}</div>
    </div>`;
    $('#stats').classList.remove('hidden');
    $('#st-x').onclick=()=>{ Sound.sfx('tap'); $('#stats').classList.add('hidden'); };
    document.querySelectorAll('#stats .tab').forEach(t=>
      t.onclick=()=>{ Sound.sfx('tap'); this.openStats(t.dataset.f); });
    this.zeichneKurve($('#st-kurve'), akt);
  }
  zeichneKurve(cv, feld){
    const g=this.game, s=g.stats, c=cv.getContext('2d');
    const W=cv.width, H=cv.height, L=42, Rr=10, O=10, U=24;
    c.clearRect(0,0,W,H);
    c.fillStyle='rgba(12,18,28,0.55)'; c.fillRect(0,0,W,H);
    const n=s.t.length;
    let max=1;
    for(const sp of s.spieler) for(const v of sp[feld]) if(v>max) max=v;
    // Gitter mit runden Stufen
    const stufe=Math.pow(10,Math.floor(Math.log10(max)));
    const schritt=(max/stufe>5? 2 : max/stufe>2? 1 : 0.5)*stufe;
    c.font='12px system-ui, sans-serif'; c.textBaseline='middle';
    for(let v=0; v<=max+1e-6; v+=schritt){
      const y=H-U-(H-U-O)*(v/max);
      c.strokeStyle='rgba(201,160,90,0.18)'; c.lineWidth=1;
      c.beginPath(); c.moveTo(L,y+0.5); c.lineTo(W-Rr,y+0.5); c.stroke();
      c.fillStyle='#b9c6d8'; c.textAlign='right'; c.fillText(String(Math.round(v)), L-6, y);
    }
    if(n<2){
      c.fillStyle='#b9c6d8'; c.textAlign='center';
      c.fillText('Noch keine Messwerte – die erste Kurve entsteht nach einer halben Minute.', W/2, H/2);
      return;
    }
    // Zeitachse: Minuten. Die aeussersten Beschriftungen werden nach innen
    // gesetzt, sonst schneidet der Bildrand sie an ("14 m").
    c.fillStyle='#b9c6d8';
    for(let k=0;k<=4;k++){
      const x=L+(W-Rr-L)*k/4;
      const t=s.t[Math.min(n-1, Math.round((n-1)*k/4))];
      c.textAlign= k===0? 'left' : k===4? 'right' : 'center';
      c.fillText(Math.floor(t/600)+' min', x, H-10);
    }
    for(let p=0;p<s.spieler.length;p++){
      const arr=s.spieler[p][feld];
      c.strokeStyle=PLAYER_COLORS[p]; c.lineWidth= p===0? 3 : 2;
      c.beginPath();
      for(let i=0;i<n;i++){
        const x=L+(W-Rr-L)*(n===1?0:i/(n-1));
        const y=H-U-(H-U-O)*((arr[i]||0)/max);
        if(i===0) c.moveTo(x,y); else c.lineTo(x,y);
      }
      c.stroke();
    }
  }
  toast(txt, type='info', node=-1){
    const t=$('#msg-toast');
    const war=type==='war';
    t.className=war?'war':'';
    if(war && this.renderer.asset('ui_warframe')) t.classList.add('framed');
    t.innerHTML= war
      ? `<span class="toast-ic">⚔️</span><span>${txt}</span>${node>=0?'<span class="toast-go">Hinsehen ▸</span>':''}`
      : `<span>${txt}</span>`;
    t.classList.remove('hidden');
    t.onclick=()=>{
      if(node>=0){ this.jumpTo(node); Sound.sfx('tap'); }
      t.classList.add('hidden');
    };
    clearTimeout(this._toastT);
    // KD4: Anzeigedauer waechst mit der Textlaenge - ein Zweizeiler war in
    // 2,6 s nicht zu Ende gelesen, laengere Tipps und Warnungen erst recht.
    this._toastT=setTimeout(()=>t.classList.add('hidden'),
      war?6000:Math.max(2600, Math.min(9000, txt.length*55)));
  }

  // ================= Spielschleife =================
  loop(){
    let last=performance.now();
    const frame=(now)=>{
      const dt=Math.min(100, now-last); last=now;
      if(this.game && this.screen==='game'){
        if(!this.paused) this.game.update(dt, SPEED_MULT[this.opts.speed]||1);
        this.kameraZiehen(now);
        // Straßenvorschau
        this.uiRenderState={
          sel:this.state.sel,
          roadPreview:this.state.mode==='road'? this.state.roadNodes:null,
          roadAnchor:this.state.mode==='road'? this.state.roadNodes[this.state.roadNodes.length-1] : -1,
          showBuildDots:this.state.showBuildDots||this.state.mode==='place',
          placeType:this.state.mode==='place'? this.state.placeType : null,
          placeAt:this.state.mode==='place'? (this.state.placeAt??-1) : -1,
          mode:this.state.mode,
          flagSel:this.state.mode==='view'? (this.state.flagSel??-1) : -1,
          flagGeoOk:this.state.flagGeoOk!==false,
        };
        // Figuren-Uhr des Renderers: Echtzeit x Tempofaktor RELATIV zu 1x
        // (0.45 ist die Basis) - bei "Test" (10-fach) schreiten die Figuren
        // also wirklich 10-mal so schnell, statt über die Karte zu gleiten;
        // in der Pause frieren sie ein statt auf der Stelle zu marschieren.
        const tempoRel=this.paused? 0 : (SPEED_MULT[this.opts.speed]||SPEED_MULT[1])/SPEED_MULT[1];
        this.renderer.draw(this.cam, this.uiRenderState, dt, dt*tempoRel);
        if(!this._mmT||now-this._mmT>500){ this._mmT=now; this.renderer.drawMinimap($('#minimap'), this.cam); }
        if(!this._resT||now-this._resT>600){ this._resT=now; this.updateHud(); }
        if(!this._ambT||now-this._ambT>2000){ this._ambT=now; this.klangKulisse(); }
        if(!this._marT||now-this._marT>1200){ this._marT=now; this.marschTrommel(); }
        this.pollMsgs();
        if(this.game.over) this.onGameOver();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  unitChip(key, fallback, title, n){
    const ic=this.renderer.asset(key)
      ? `<img class="res-ic unit-ic" src="assets/${key}.png" alt="">` : fallback;
    return `<span title="${title}">${ic}${n}</span>`;
  }
  syncPauseBtn(){
    const b=$('#g-pause');
    if(!b) return;
    b.textContent='';
    b.classList.toggle('paused', !!this.paused);
    b.title=this.paused?'Weiter':'Pause';
  }
  // Warenleiste: frei wählbare Waren + Bevölkerung, antippen öffnet das Lager
  updateHud(){
    const g=this.game; if(!g) return;
    const inv=g.invTotal(0);
    const sel=(this.opts.hudGoods&&this.opts.hudGoods.length? this.opts.hudGoods
      : HUD_DEFAULT).slice(0,HUD_MAX);
    const ic=(k)=> this.renderer.asset('icon_'+k) ? `<img class="res-ic" src="assets/icon_${k}.png" alt="">`
      : this.renderer.asset('good_'+k) ? `<img class="res-ic" src="assets/good_${k}.png" alt="">` : '';
    const st=g.settlerStats(0);
    // Oben zwischen den Knöpfen stehen die Siedler, darunter über die volle
    // Breite die Waren – dort ist Platz für alle angehefteten Waren.
    $('#res-bar').innerHTML=
      this.unitChip('icon_settler','🧑‍🌾','Freie Siedler',st.free)
      +this.unitChip('icon_geo','⛏️','Geologen',st.geo)
      +`<span class="res-sep"></span>`
      +this.unitChip('icon_sword','🗡️','Schwertkämpfer',st.sword)
      +this.unitChip('icon_spear','🔱','Speerkämpfer',st.spear)
      +this.unitChip('icon_bow','🏹','Bogenschützen',st.bow);
    const ub=$('#unit-bar');
    if(ub) ub.innerHTML=
      sel.map(k=>`<span class="${(inv[k]||0)?'':'leer'}" title="${GOODS[k]?GOODS[k].name:k}">${ic(k)}${inv[k]||0}</span>`).join('')
      +`<span class="res-more">📦</span>`;
    if(!$('#objectives').classList.contains('hidden')) this.toggleObjectives(true);
    // KD4/F2: Ziel-Chip aktualisieren - zeigt das naechste offene Ziel mit
    // Fortschritt (oder den Sieg-Haken), laeuft im updateHud-Takt (600 ms)
    {
      const chip=$('#obj-chip');
      const g=this.game;
      if(!g || !g.objectives.length) chip.classList.add('hidden');
      else {
        const offen=g.objectives.filter(o=>!o.done);
        const n=g.objectives.length, fertig=n-offen.length;
        const o=offen[0];
        // Kritik S5: "Besiege alle Gegner" stand 45 Minuten unveraendert da.
        // Als Fortschritt dient die Zahl der FEINDPOSTEN (stehende Gebaeude
        // nicht besiegter Gegner) - sie sinkt sichtbar mit jeder Eroberung
        // und steigt, wenn der Feind expandiert.
        // Kritik R3 S4: auf Handybreite wurde der Text abgeschnitten
        // ("...(Feindposte..."). Unter 520 px die Kurzfassung.
        const schmal=(window.innerWidth||9999)<520;
        let zusatz='', desc9=o? o.desc : '';
        if(o && o.type==='destroyEnemies'){
          let fp=0;
          for(const b of g.buildings.values())
            if(b.player!==0 && b.state!=='burn' && !g.players[b.player].defeated) fp++;
          if(schmal){ desc9='Gegner besiegen'; zusatz=` <b>· Posten: ${fp}</b>`; }
          else zusatz=` <b>(Feindposten: ${fp})</b>`;
        }
        chip.innerHTML = o
          ? `🎯 ${n>1?`<b>${fertig}/${n}</b> · `:''}${desc9}${o.count?` <b>(${Math.min(o.prog||0,o.count)}/${o.count})</b>`:''}${zusatz}`
          : '🎯 ✅ Alle Ziele erfüllt';
        chip.classList.remove('hidden');
      }
    }
  }
  // vollständige Warenübersicht (alle 28 Waren)
  openStockSheet(){
    const g=this.game; if(!g) return;
    const inv=g.invTotal(0);
    const ic=(k)=> this.renderer.asset('good_'+k) ? `<img class="stock-ic" src="assets/good_${k}.png" alt="">`
      : this.renderer.asset('icon_'+k) ? `<img class="stock-ic" src="assets/icon_${k}.png" alt="">` : '';
    const sel=(this.opts.hudGoods&&this.opts.hudGoods.length? this.opts.hudGoods
      : HUD_DEFAULT);
    const cells=GOOD_LIST.map(k=>`<button class="stock-it${(inv[k]||0)?'':' zero'}${sel.includes(k)?' pinned':''}" data-good="${k}">${ic(k)}
      <b>${inv[k]||0}</b><small>${GOODS[k].name}</small></button>`).join('');
    const r=g.players[0].recruits;
    this.sheet(`<div class="sh-head"><b>📦 Lager &amp; Vorräte</b><button class="hbtn" id="sh-x">✕</button></div>
      <p class="note">Antippen heftet eine Ware oben an die Leiste (max. ${HUD_MAX}) – nochmal antippen nimmt sie wieder weg.
      Angeheftet: <b id="pin-n">${sel.length}</b>/${HUD_MAX} <button class="lnk" id="pin-clr">alle lösen</button></p>
      <div class="stock-grid">${cells}</div>
      <p class="note">Reserve im Hauptquartier: ${STYPE_LIST.map(t=>`${r[t]||0}× ${STYPES[t].short}`).join(' · ')}
      · Soldaten im Feld/in Gebäuden: ${g.soldierCount(0)}</p>`);
    $('#sh-x').onclick=()=>this.closeSheet();
    const setPins=(list)=>{
      this.opts.hudGoods=list;
      SAVE.setOptions(this.opts);
      Sound.sfx('tap');
      this.updateHud();
      this.openStockSheet();
    };
    $('#pin-clr').onclick=()=>setPins([]);
    document.querySelectorAll('.stock-it').forEach(btn=> btn.onclick=()=>{
      const k=btn.dataset.good;
      const list=sel.slice();
      const ix=list.indexOf(k);
      if(ix>=0){ list.splice(ix,1); setPins(list); return; }   // abwählen
      // Ist die Leiste voll, muss der Spieler bewusst etwas abwählen –
      // sonst verschwände unbemerkt die älteste Ware.
      if(list.length>=HUD_MAX){
        Sound.sfx('tap');
        this.toast(`Leiste voll (${HUD_MAX}) – erst eine Ware abwählen`);
        return;
      }
      list.push(k);
      setPins(list);
    });
  }
  pollMsgs(){
    const g=this.game;
    while(this.state.msgSeen<g.msgs.length){
      const msg=g.msgs[this.state.msgSeen++];
      this.toast(msg.txt, msg.type, msg.node);
      if(msg.type==='war'){
        Sound.sfx('war');
        // Kritik R2 S6 / R3 S5: Kriegsgeschehen ausserhalb des Bildes war
        // nur Text - jetzt zeigen ein Richtungspfeil am Bildrand und ein
        // Puls auf der Minikarte, WO es brennt (7 Sekunden lang).
        if(msg.node!=null && msg.node>=0)
          this.renderer._warPing={node:msg.node, bis:Date.now()+7000};
      }
      else if(msg.type==='ok') Sound.sfx('msg');
    }
  }
  // springt zur Stelle auf der Karte, zu der eine Meldung gehört
  jumpTo(node){
    if(!this.game || node==null || node<0) return;
    const [x,y]=this.game.map.worldPos(node);
    this.cam.x=x; this.cam.y=y;
    this.cam.z=Math.max(this.cam.z, 1.4);
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
