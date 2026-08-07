// Neuland – Renderer: komplett prozedural gezeichnete 2D-Grafik (Canvas), poliert.
import { TER, OBJ, BLD, PLAYER_COLORS, PLAYER_COLORS_DARK } from './core.js';
import { TILE, ROWH, HSCALE } from './map.js';

// Stilguide-Palette: erdige Töne, Moosgrün, Strohgelb, gedecktes Blau (keine Übersättigung)
const TER_COL = {
  gruen:  { [TER.WATER]:'#4a83a6', [TER.GRASS]:'#7ba55e', [TER.DESERT]:'#d1ba82', [TER.MOUNT]:'#a1988a', [TER.SNOW]:'#eceff3', [TER.SWAMP]:'#5d8560', [TER.LAVA]:'#8d3a1e' },
  winter: { [TER.WATER]:'#547e99', [TER.GRASS]:'#94ac88', [TER.DESERT]:'#cdba86', [TER.MOUNT]:'#949aa4', [TER.SNOW]:'#eceff5', [TER.SWAMP]:'#6d8573', [TER.LAVA]:'#8d3a1e' },
  wueste: { [TER.WATER]:'#4f8dab', [TER.GRASS]:'#a3aa6c', [TER.DESERT]:'#dcc78f', [TER.MOUNT]:'#b09e82', [TER.SNOW]:'#efe9dc', [TER.SWAMP]:'#7d8c60', [TER.LAVA]:'#8d3a1e' },
  vulkan: { [TER.WATER]:'#477693', [TER.GRASS]:'#7e9660', [TER.DESERT]:'#b0946e', [TER.MOUNT]:'#84766c', [TER.SNOW]:'#eceff3', [TER.SWAMP]:'#677852', [TER.LAVA]:'#c65a24' },
  sumpf:  { [TER.WATER]:'#4d7b82', [TER.GRASS]:'#729660', [TER.DESERT]:'#bfae7f', [TER.MOUNT]:'#918e82', [TER.SNOW]:'#eceff3', [TER.SWAMP]:'#5a7a5e', [TER.LAVA]:'#8d3a1e' },
};
TER_COL.inseln=TER_COL.gruen; TER_COL.gebirge=TER_COL.winter;

// Küstenfarben je Thema: [Strand, Flachwasser]
const COAST_COL = {
  gruen:['#d8c896','#6b9cb8'], winter:['#c2c8cd','#6f92a6'], wueste:['#e4d19c','#6ba0bc'],
  vulkan:['#9f8c6a','#578299'], sumpf:['#998f6a','#5a8a90'],
};
COAST_COL.inseln=COAST_COL.gruen; COAST_COL.gebirge=COAST_COL.winter;

const CHUNK = 12; // Knoten pro Chunk-Kante
// ---- Felsobjekte und Bergwerke: EIN gemeinsamer Zeichenfaktor ----
// Stilguide 11.11: die zwoelf Felsobjekte liegen alle auf 512x512, tragen
// genau 20 px Bodenrand und ein gemeinsames Blockmass von 62,5 px. Ihre
// relativen Groessen stecken damit BEREITS im Bild – eine Skala je Datei
// (das alte scales.json) wuerde sie wieder auseinanderziehen. Es gibt
// deshalb nur noch FELS_F, die Bildunterkante minus FELS_BODEN ist die
// Bodenlinie.
// FELS_F=0.235 -> Blockkante 14,7 px auf dem Schirm; die Flaechenkachel
// zeigt bei Skala (TILE*2.37)/1024 eine Plattenkante von rund 15 px, die
// Objekte sind also genauso grob gebrochen wie der Untergrund (11.8,
// "Objekte feiner gebrochen als der Rest").
const FELS_F = 0.235;
const FELS_BODEN = 20;
// ---- Massstab der Felsflaechen-Lasuren ----------------------------------
// Umbau 3.1 (Nutzerurteil v81: "Steinhaufen / Schotterberg statt Fels").
// Gemessen: ter_rock_top traegt auf 1024 px 48 Platten mit einer Median-
// Kante von 80 px, also 1/13 der Kachelbreite. Bei der alten Abdeckung
// TILE*2.37 = 123 Weltpixel je Kachel wurde eine Platte 9,7 Weltpixel
// gross; ein Massiv von 10 Knoten Breite (520 px) zeigte ueber 50 Platten
// nebeneinander. Zum Vergleich: ein Baum ist 40-60 px hoch, ein Wohnhaus
// rund 80 px – 9,7 px lesen sich zwangslaeufig als Kies.
// Die Referenzbilder (Stilguide 11.9, "bei gleichen Zahlen gilt das
// Augenmass") zeigen WENIGE GROSSE Facetten. Die alte Regel "eine Platte
// hoechstens ein Fuenftel einer Dreieckskante" stammt aus der Zeit, als
// das Dreiecksraster durchschlug; seit dem Vertexnormalen-Umbau ist das
// Raster weg und die Regel produziert nur noch Grus. Sie ist ueberholt.
// Werte sind KACHELABDECKUNGEN in Kachelbreiten (TILE=52):
//   Plattenmass in Weltpixeln = Asset-Median * TILE * Faktor / 1024
const FM_TOP    = 7.4;   // Hauptflaeche   80 px -> 30,1 Weltpixel
const FM_TOP2   = 6.8;   // Nesterlage    113 px -> 39,0 Weltpixel
const FM_DRITT  = 5.9;   // Drittlage (gedreht, gegen die Wiederholung)
const FM_RUBBLE = 6.0;   // Geroell        49 px -> 14,9 Weltpixel (feiner)
const FM_MOSS   = 7.4;   // Moos           70 px -> 27,7 Weltpixel
// Stilguide 11.11: die sieben Bergwerksbilder liegen auf 320x300, ihre
// Bodenlinie ist y=288 und die DOMACHSE (Schwerpunkt des oberen Drittels,
// also der Felsdom) liegt bei 47,4 % der Breite – nicht in der Bildmitte.
// Verankert wird auf die Domachse, sonst wandert der Dom zwischen den
// Baustufen seitlich weg. Baufortschritt 51/75/88/100 % steckt im Bild.
const MINE_F = 0.265;
const MINE_BODEN = 288;      // Bodenlinie in Bildzeilen (von 300)
const MINE_DOM = 0.474;      // Domachse als Anteil der Bildbreite
const OUT='rgba(88,58,34,0.5)';    // Standard-Kontur (warm, weich)
// natürliche Blickrichtung der Figuren-Bilder: -1 = schaut nach links, 1 = nach rechts
const UNIT_FACING={
  unit_carrier:-1, unit_worker:-1, unit_sword:-1, unit_spear:-1, unit_bow:1,
  unit_woodcutter:1, unit_fisher:-1, unit_hunter:1, unit_farm:-1, unit_forester:-1,
  unit_quarry:-1, unit_geo:-1, unit_sword_atk:-1, unit_sword_atk2:-1, unit_sword_def:-1,
  unit_soldier:-1,
};
// Gemessene Zell-Füllung der Menschen-Blätter (assets/unit_*_idle.png,
// Alpha-Dichteprofil von idle-Frame 0, Median über die 5 Richtungszeilen;
// dünne Werkzeuge/Waffen herausgefiltert): die 88er-Zellen sind je Beruf
// unterschiedlich stark gefüllt — der Planierer z. B. deutlich kleiner
// gebacken als der Träger. s skaliert die Zeichenhöhe so, dass die
// KÖRPERHÖHE aller Figuren der des Trägers entspricht (Größenanker);
// f ist der gemessene Leerraum unter den Füßen (Anteil der Zellhöhe),
// damit jede Figur exakt auf ihrer Schattenlinie steht statt zu schweben.
// Werkzeug-Overlays (unit_*_atk_tool) werden in drawFigure mit denselben
// ww/hh gezeichnet und erben den Faktor automatisch. Tiere (Reh/Hase/
// Schwein/Esel ...) laufen bewusst NICHT über diese Tabelle.
const UNIT_FIT={
  unit_carrier:     {s:1.000,f:0.091},
  unit_worker:      {s:1.000,f:0.102},
  unit_builder:     {s:0.982,f:0.102},
  unit_leveler:     {s:1.146,f:0.170},
  unit_geo:         {s:0.982,f:0.102},
  unit_scout:       {s:1.038,f:0.091},
  unit_woodcutter:  {s:1.078,f:0.114},
  unit_forester:    {s:0.965,f:0.057},
  unit_quarry:      {s:0.965,f:0.091},
  unit_fisher:      {s:1.038,f:0.102},
  unit_hunter:      {s:0.982,f:0.102},
  unit_farm:        {s:0.965,f:0.102},
  unit_miner:       {s:0.982,f:0.102},
  unit_smith:       {s:1.000,f:0.091},
  unit_toolsmith:   {s:1.000,f:0.091},
  unit_minter:      {s:0.948,f:0.102},
  unit_baker:       {s:0.965,f:0.102},
  unit_butcher:     {s:1.000,f:0.091},
  unit_miller:      {s:0.948,f:0.102},
  unit_brewer:      {s:0.982,f:0.091},
  unit_smelter:     {s:1.000,f:0.091},
  unit_pigfarmer:   {s:0.982,f:0.114},
  unit_donkeyherder:{s:0.982,f:0.102},
  unit_shipwright:  {s:0.948,f:0.091},
  unit_carpenter:   {s:0.965,f:0.091},
  unit_welldigger:  {s:1.000,f:0.091},
  unit_sword:       {s:1.100,f:0.205},
  unit_spear:       {s:0.948,f:0.091},
  unit_bow:         {s:0.948,f:0.080},
};
const UNIT_FIT_DEF={s:1,f:0.08};

function shade(hex, f){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.max(0,Math.min(255,r*f)); g=Math.max(0,Math.min(255,g*f)); b=Math.max(0,Math.min(255,b*f));
  return `rgb(${r|0},${g|0},${b|0})`;
}
function hash01(n){
  n=Math.imul(n^(n>>>15), 2246822519);
  n=Math.imul(n^(n>>>13), 3266489917);
  return ((n^(n>>>16))>>>0)/4294967296;
}
function mix(hexA, hexB, t){
  const a=parseInt(hexA.slice(1),16), b=parseInt(hexB.slice(1),16);
  const r=((a>>16)&255)+((((b>>16)&255)-((a>>16)&255))*t);
  const g=((a>>8)&255)+((((b>>8)&255)-((a>>8)&255))*t);
  const c=(a&255)+(((b&255)-(a&255))*t);
  return `rgb(${r|0},${g|0},${c|0})`;
}
function hex2arr(hex){
  const n=parseInt(hex.slice(1),16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function mixArr(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
// abgerundetes Rechteck (mit Fallback)
function rr(g,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  g.beginPath();
  g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r);
  g.closePath();
}

// ---------- Arbeits-Effekte der Gebäude: Ankertabelle ----------
// Jedes Gebäude bekommt seinen PASSENDEN Effekt an der PASSENDEN Stelle des
// Sprites. a = Ankerpunkt in BILD-BRUCHTEILEN des Gebäudebildes (quer 0..1 von
// links, hoch 0..1 von oben) – an den Originalgrafiken vermessen, damit Rauch
// exakt aus dem gemalten Schornstein steigt, egal wie groß das Haus gezeichnet
// wird. s = Stärke/Größe. on: 'work' (nur bei laufender Arbeit, Standard),
// 'staffed' (solange der Arbeiter eingezogen ist), 'always' (dauerhaft).
// col bei smoke: 'grau' | 'weiss' | 'dunkel'; bei chips/dust ein rgba-Muster
// mit $A als Alpha-Platzhalter.
const BLD_FX = {
  // Holzfäller: Späne am Hackklotz mit der Axt (links vor der Hütte)
  woodcutter: [ {k:'chips', a:[0.16,0.72], s:1, col:'rgba(214,178,116,$A)'} ],
  // Förster: frisches Grün wirbelt bei den Setzlingstöpfen
  forester:   [ {k:'leaves', a:[0.68,0.72], s:1} ],
  // Sägewerk: Sägemehl sprüht am Sägeblatt – KEIN Rauch (dort brennt nichts)
  sawmill:    [ {k:'sawdust', a:[0.40,0.66], s:1} ],
  // Steinmetz: Steinstaub und Splitter am Werkblock unterm Vordach
  quarry:     [ {k:'stonedust', a:[0.42,0.58], s:1} ],
  // Fischerhütte: nur stille Wasserringe unter dem Steg (kein Rauch am Wasser)
  fisher:     [ {k:'ripple', a:[0.48,0.86], s:1, on:'always'} ],
  // Jäger: dünner Rauch vom Räucherfeuer – der Schlot mit gemaltem Rauchfähnchen
  hunter:     [ {k:'smoke', a:[0.26,0.20], s:0.5, col:'grau', on:'staffed'} ],
  // Brunnen: nur dezente Tropfen vom Eimer in den Schacht
  well:       [ {k:'drips', a:[0.42,0.46], s:1} ],
  // Bauernhof: dünner Herdrauch aus dem Schornstein links auf dem Strohdach
  farm:       [ {k:'smoke', a:[0.29,0.05], s:0.55, col:'grau'} ],
  // Mühle: sie MAHLT – kein Rauch, nur feiner Mehlstaub bei den Säcken am Fuß
  mill:       [ {k:'flour', a:[0.76,0.86], s:1} ],
  // Bäckerei: kräftiger heller Ofenrauch aus dem großen Steinschornstein,
  // dazu Hitzeflimmer-Dampf am Kuppelofen-Abzug und Glut im Ofenmaul
  bakery:     [ {k:'smoke', a:[0.575,0.035], s:1, col:'weiss'},
                {k:'steam', a:[0.665,0.43], s:0.6},
                {k:'glow',  a:[0.60,0.63], s:0.8} ],
  // Schweinezucht: aufgewirbelter Staub im Matschauslauf
  pigfarm:    [ {k:'dustpuff', a:[0.52,0.66], s:1, col:'rgba(150,122,86,$A)'} ],
  // Schlachterei: dünner Rauch aus dem Räucherschornstein rechts
  butcher:    [ {k:'smoke', a:[0.695,0.03], s:0.55, col:'grau'} ],
  // Brauerei: Dampf vom kupfernen Braukessel im Torbogen, dünner Schlotrauch,
  // warmer Feuerschein unterm Kessel
  brewery:    [ {k:'smoke', a:[0.365,0.035], s:0.6, col:'grau'},
                {k:'steam', a:[0.42,0.57], s:1},
                {k:'glow',  a:[0.44,0.66], s:0.6} ],
  // Bergwerke: Staub am Stollenmund + Abraum-Krümel in der Farbe des Erzes
  coalmine:   [ {k:'minedust', a:[0.50,0.56], s:1, col:'rgba(70,66,62,$A)'} ],
  ironmine:   [ {k:'minedust', a:[0.47,0.50], s:1, col:'rgba(142,96,70,$A)'} ],
  goldmine:   [ {k:'minedust', a:[0.50,0.50], s:1, col:'rgba(168,138,74,$A)'} ],
  granitemine:[ {k:'minedust', a:[0.52,0.62], s:1, col:'rgba(160,154,144,$A)'} ],
  // Eisenhütte: dunkler Qualm aus dem hohen Schmelzschornstein, Glut + Funken
  // am Ofenmaul unten
  smelter:    [ {k:'smoke', a:[0.42,0.02], s:1.25, col:'dunkel'},
                {k:'glow',  a:[0.34,0.77], s:1.3},
                {k:'sparks',a:[0.34,0.74], s:1} ],
  // Münzprägerei: feiner Schlotrauch, goldenes Funkeln an der Werkstatttür
  mint:       [ {k:'smoke', a:[0.655,0.03], s:0.5, col:'grau'},
                {k:'glint', a:[0.24,0.62], s:1} ],
  // Waffenschmiede: Esse zieht durch den glühenden Kamin ab – Funken stieben
  // aus der Kaminöffnung, drinnen warmer Schein
  armory:     [ {k:'smoke', a:[0.465,0.04], s:0.8, col:'dunkel'},
                {k:'sparks',a:[0.465,0.05], s:1},
                {k:'glow',  a:[0.48,0.62], s:0.7} ],
  // Werkzeugschmiede: Rauch aus dem glühenden Kamin, Glut + Funken an der Esse
  toolsmith:  [ {k:'smoke', a:[0.405,0.03], s:0.7, col:'grau'},
                {k:'glow',  a:[0.41,0.66], s:0.9},
                {k:'sparks',a:[0.41,0.64], s:0.8} ],
  // Eselzucht: Heustaub am Futterhaufen im Auslauf
  donkeyfarm: [ {k:'chips', a:[0.66,0.64], s:1, col:'rgba(226,196,110,$A)'} ],
  // Werft: Holzspäne am Schiffsrumpf in der offenen Halle
  shipyard:   [ {k:'sawdust', a:[0.45,0.55], s:0.8} ],
  // Hafen: Wasserringe zwischen den Stegpfählen
  harbor:     [ {k:'ripple', a:[0.55,0.82], s:1.2, on:'always'} ],
  // Kapelle: ruhiger goldener Schein um die Glocke im Turm
  chapel:     [ {k:'bell', a:[0.30,0.30], s:1, on:'always'} ],
  // Marktstand: bunte Wimpel flattern an der Markise
  market:     [ {k:'pennants', a:[0.42,0.33], s:1, on:'always'} ],
};

// ---------- Kleintier-Deko: Schmetterlinge und Vögel ----------
// REINE ZIERDE: keine Sim-Objekte, kein Speicherstand, keine Jagd, keine
// Kollision. Platz und Farbvariante stecken deterministisch im Knoten-Hash,
// die Bewegung hängt allein an this.time – derselbe Spielstand sieht in zwei
// Läufen gleich aus. Kein Math.random() pro Bild.
// Falter: [Flügel hell, Flügel halb (abgewandte Seite), Saum dunkel, Körper]
const FALTER_FARBEN = [
  ['#f8f4e6','#e4ddc6','#c9bd9d','#4b4438'],   // Weißling
  ['#f5db63','#e4c541','#c09622','#584422'],   // Zitronenfalter
  ['#e79148','#cd7330','#9a4c1c','#4a3220'],   // Fuchs (orange-braun)
  ['#9cc9ea','#7cabd2','#5386ae','#3c4652'],   // Bläuling
];
// Singvögel: [Rücken, Kopf/Flügel/Schwanz, Brust/Bauch]
const VOGEL_FARBEN = [
  ['#8d6e4c','#5c452d','#dccdb1'],   // Spatz
  ['#7e6351','#4d3a2b','#d97b45'],   // Rotkehlchen
  ['#71805b','#3e4933','#e8db7d'],   // Meise
];

export class Renderer {
  constructor(canvas){
    this.cv=canvas; this.ctx=canvas.getContext('2d');
    this.chunks=new Map();
    this.chunkVer=new Map();
    this._signsSeen=new Set();
    this._mineSeen=new Set();
    this.sprites=new Map();
    this.time=0;
    // Kleintier-Deko (Falter, Singvögel, Zugvögel) – reiner Schalter fürs
    // Abschalten bei Leistungsmessungen, ohne Wirkung aufs Spiel
    this.dekoTiere=true;
    this.loadAssets();
  }
  setGame(game){
    this.game=game;
    this.theme=game.setup.theme||'gruen';
    this.chunks.clear(); this.chunkVer.clear();
    this.sprites.clear();
    this.lastTerritoryVer=-1;
    this.borderEdges=[];
    this._signsSeen=new Set();
    this._mineSeen=new Set();
    this._fogCount=-1; this._fogT=-1e9;
    this.fogDark=null; this.fogMist=null;
    this._snowLine=null; this._massifSnow=null; this._firnLine=null; this._hiLo=null; this._tips=null; this._bTint=null;
    this._liftC=null; this._liftFld=null;   // Anhebung (G1) haengt an Karte+Minen
    this._palRock=null; this._spireTint=null;   // Fels-Palette/Nadeltönung hängen am Thema
    this._lasurC=null; this._felsBox=null;      // Fels-Lasurkacheln hängen am Thema
    this._mineApronC=undefined;                 // Minen-Schürze haengt an der Felstönung
    this._vogelFlucht=null; this._zugSchar=null;   // Kleintier-Deko neu anfangen
    this.initSheep();
  }
  // ---------- Schafe: kleine Wander-Deko auf den Wiesen ----------
  initSheep(){
    const m=this.game.map;
    this.sheep=[];
    let tries=0;
    while(this.sheep.length<9 && tries<600){
      tries++;
      const i=(hash01(tries*7919+m.w)*m.terr.length)|0;
      if(m.terr[i]!==1 /*GRASS*/ || m.obj[i]!==0 || m.bld[i]>=0) continue;
      const [x,y]=m.worldPos(i);
      this.sheep.push({ home:i, x, y, tx:x, ty:y, state:'graze', t:1000+hash01(tries)*3000, phase:hash01(tries*13)*6.28 });
    }
  }
  updateSheep(dt){
    if(!this.sheep) return;
    const m=this.game.map;
    for(const s of this.sheep){
      s.t-=dt;
      if(s.state==='walk'){
        const dx=s.tx-s.x, dy=s.ty-s.y;
        const d=Math.hypot(dx,dy);
        const sp=dt*0.011;
        if(d<sp||d<0.5){ s.x=s.tx; s.y=s.ty; s.state='graze'; s.t=1800+Math.random()*4200; }
        else { s.x+=dx/d*sp; s.y+=dy/d*sp; }
      } else if(s.t<=0){
        // neues Ziel in Heimatnähe suchen (nur freie Wiese)
        const [hx,hy]=m.worldPos(s.home);
        for(let k=0;k<6;k++){
          const nx=hx+(Math.random()-0.5)*140, ny=hy+(Math.random()-0.5)*110;
          const n=m.nearestNode(nx,ny);
          if(n>=0 && m.terr[n]===1 && m.bld[n]<0 && (m.obj[n]&127)===0){
            s.tx=nx; s.ty=ny; s.state='walk';
            break;
          }
        }
        s.t=2000;
        // seltenes Blöken, wenn nahe der Kamera
        if(this.onAmbient && Math.random()<0.3 && m.explored[s.home]){
          const cam=this._lastCam;
          if(cam){
            const d=Math.hypot(s.x-cam.x,s.y-cam.y)*cam.z;
            if(d<600) this.onAmbient('sheep', Math.max(0.15,1-d/600));
          }
        }
      }
    }
  }
  // ---------- Schweine wuseln im Gehege der Schweinezucht ----------
  updatePigs(dt){
    if(!this.pigs) this.pigs=new Map();
    const g=this.game;
    // Bestände mit den vorhandenen Schweinezuchten abgleichen
    for(const id of [...this.pigs.keys()])
      if(!g.buildings.has(id) || g.buildings.get(id).state!=='done') this.pigs.delete(id);
    for(const b of g.buildings.values()){
      if(b.type!=='pigfarm' || b.state!=='done' || this.pigs.has(b.id)) continue;
      const [bx,by]=g.map.worldPos(b.node);
      const herd=[];
      for(let k=0;k<3;k++){
        herd.push({ bx, by, x:bx+(hash01(b.id*7+k)-0.5)*30, y:by+6+(hash01(b.id*13+k)-0.5)*14,
          tx:bx, ty:by+8, state:'graze', t:800+hash01(b.id+k)*2600, phase:hash01(b.id*31+k)*6.28 });
      }
      this.pigs.set(b.id, herd);
    }
    for(const herd of this.pigs.values()){
      for(const p of herd){
        p.t-=dt;
        if(p.state==='walk'){
          const dx=p.tx-p.x, dy=p.ty-p.y;
          const d=Math.hypot(dx,dy);
          const sp=dt*0.014;
          if(d<sp||d<0.5){ p.state='graze'; p.t=1200+Math.random()*3200; }
          else { p.x+=dx/d*sp; p.y+=dy/d*sp; }
        } else if(p.t<=0){
          // neues Ziel im Gehege (kleiner Radius ums Gebäude)
          p.tx=p.bx+(Math.random()-0.5)*46;
          p.ty=p.by+7+(Math.random()-0.5)*18;
          p.state='walk'; p.t=1500;
          if(this.onAmbient && Math.random()<0.25){
            const cam=this._lastCam;
            if(cam){
              const d=Math.hypot(p.x-cam.x,p.y-cam.y)*cam.z;
              if(d<520) this.onAmbient('oink', Math.max(0.15,1-d/520));
            }
          }
        }
      }
    }
  }
  drawPig(g,p){
    const m=this.game.map;
    const n=m.nearestNode(p.x,p.y);
    if(n<0 || !m.explored[n]) return;
    const walk=p.state==='walk';
    // gebackene GLB-Animation (Spritesheet) zuerst
    this._animSeed=(p.phase||0)*2.2;
    const panim=this.animFrame('unit_pig', walk?[p.tx-p.x,p.ty-p.y]:null, walk);
    if(panim){
      this.shadow(g,p.x+1,p.y+3.6,5.4,2,0.22);
      const hh=12, ww=hh*(panim.sw/panim.sh);
      g.save();
      g.translate(p.x, p.y+3.6+hh*0.04);
      if(panim.flip) g.scale(-1,1);
      g.drawImage(panim.img, panim.sx, panim.sy, panim.sw, panim.sh, -ww/2, -hh, ww, hh);
      g.restore();
      return;
    }
    const bob=walk? Math.abs(Math.sin(this.time/120+p.phase))*1.1 : 0;
    this.shadow(g,p.x+1,p.y+3.6,5.4,2,0.22);
    const ov=this.asset('good_pig');
    g.save();
    g.translate(p.x, p.y+3.4-bob);
    if(walk && p.tx<p.x-0.5) g.scale(-1,1);
    if(ov){
      const hh=11, ww=hh*(ov.naturalWidth/ov.naturalHeight);
      g.drawImage(ov,-ww/2,-hh,ww,hh);
    } else {
      g.fillStyle='#d9a08e';
      g.beginPath(); g.ellipse(0,-3.6,5,3,0,0,7); g.fill();
      g.strokeStyle='rgba(120,70,55,0.5)'; g.lineWidth=0.8; g.stroke();
      g.beginPath(); g.ellipse(4.6,-4.6,2,1.6,0.2,0,7); g.fill();   // Kopf
      g.fillStyle='#c78a78';
      g.beginPath(); g.arc(6.2,-4.4,0.9,0,7); g.fill();             // Rüssel
      g.strokeStyle='#b57a68'; g.lineWidth=1.2;
      const st=walk? Math.sin(this.time/120+p.phase)*1.2 : 0;
      g.beginPath();
      g.moveTo(-2.6,-1.4); g.lineTo(-2.6+st,1.4);
      g.moveTo(2.6,-1.4); g.lineTo(2.6-st,1.4);
      g.stroke();
      g.strokeStyle='#c78a78';
      g.beginPath(); g.moveTo(-4.8,-4.6); g.quadraticCurveTo(-6.2,-5.4,-5.6,-3.8); g.stroke(); // Ringelschwanz
    }
    g.restore();
  }
  // ---------- Wild: Reh, Hase, Wildschwein (Beute des Jägers) ----------
  drawAnimal(g, a){
    const m=this.game.map;
    const n=m.nearestNode(a.x,a.y);
    if(n<0 || !m.explored[n]) return;
    const walk=a.state==='walk';
    const ph=this.time/110 + (a.id||0)*1.7;
    const bob=walk? Math.abs(Math.sin(ph))*1.3 : 0;
    // gebackene GLB-Animation (Spritesheet) zuerst
    const adir=walk? [a.tx-a.x, a.ty-a.y] : null;
    this._animSeed=(a.id||0)*1.3;
    const anim=this.animFrame('unit_'+a.kind, adir, walk);
    if(anim){
      const hh=a.kind==='hare'?12: a.kind==='boar'?17:22;
      const ww=hh*(anim.sw/anim.sh);
      this.shadow(g,a.x,a.y+3.9,hh*0.36,2.2,0.2);
      g.save();
      g.translate(a.x, a.y+3.9+hh*0.04);
      if(anim.flip) g.scale(-1,1);
      g.drawImage(anim.img, anim.sx, anim.sy, anim.sw, anim.sh, -ww/2, -hh, ww, hh);
      g.restore();
      return;
    }
    const ov=this.asset('unit_'+({deer:'deer',hare:'hare',boar:'boar'}[a.kind]));
    g.save();
    g.translate(a.x, a.y+3.4-bob);
    // Bilder schauen nach links – spiegeln bei Lauf nach rechts
    if(walk && a.tx>a.x+0.5) g.scale(-1,1);
    if(ov){
      const hh=a.kind==='hare'?10: a.kind==='boar'?13:17;
      const ww=hh*(ov.naturalWidth/ov.naturalHeight);
      this.shadow(g,0,0.5,hh*0.42,2.2,0.2);
      g.drawImage(ov,-ww/2,-hh,ww,hh);
      g.restore();
      return;
    }
    const st=walk? Math.sin(ph)*1.5 : 0;
    if(a.kind==='deer'){
      this.shadow(g,0,0.6,6.4,2.3,0.2);
      g.strokeStyle='#6d5136'; g.lineWidth=1.4;
      g.beginPath();                                       // schlanke Läufe
      g.moveTo(-3.4,-4.2); g.lineTo(-3.4+st,0.6);
      g.moveTo(3.2,-4.2); g.lineTo(3.2-st,0.6);
      g.stroke();
      g.fillStyle='#8a6a44';
      g.beginPath(); g.ellipse(0,-6.4,5.4,3.1,0,0,7); g.fill();      // Rumpf
      g.beginPath(); g.ellipse(4.8,-9.6,1.8,2.6,0.5,0,7); g.fill();  // Hals
      g.beginPath(); g.ellipse(6.2,-12,2.1,1.5,0.2,0,7); g.fill();   // Kopf
      g.fillStyle='#f4efe2';
      g.beginPath(); g.ellipse(-4.6,-5.6,1.4,1.9,0,0,7); g.fill();   // Spiegel
      g.strokeStyle='#5d4530'; g.lineWidth=0.8;                       // kurzes Lauscher-Paar
      g.beginPath(); g.moveTo(5.2,-13.1); g.lineTo(4.5,-14.2); g.stroke();
      g.strokeStyle='#4a3826'; g.lineWidth=0.9;                       // kleines Geweih
      g.beginPath();
      g.moveTo(6.4,-13.3); g.lineTo(6.9,-15.6); g.lineTo(7.8,-16.6);
      g.moveTo(6.9,-15.6); g.lineTo(6.2,-16.8);
      g.stroke();
    } else if(a.kind==='hare'){
      this.shadow(g,0,0.4,4,1.6,0.2);
      g.fillStyle='#9a8668';
      const hop=walk? Math.abs(Math.sin(ph*1.6))*1.6 : 0;
      g.beginPath(); g.ellipse(0,-2.8-hop,3.4,2.4,0,0,7); g.fill();  // Körper
      g.beginPath(); g.arc(2.9,-4.4-hop,1.7,0,7); g.fill();          // Kopf
      g.strokeStyle='#8a755a'; g.lineWidth=1;                         // Löffel
      g.beginPath(); g.moveTo(2.9,-6-hop); g.lineTo(2.4,-8.4-hop);
      g.moveTo(3.6,-6-hop); g.lineTo(3.9,-8.2-hop); g.stroke();
      g.fillStyle='#f4efe2';
      g.beginPath(); g.arc(-3.1,-2.4-hop,1,0,7); g.fill();           // Blume
    } else { // Wildschwein
      this.shadow(g,0,0.6,5.6,2.1,0.22);
      g.strokeStyle='#4a3b2c'; g.lineWidth=1.5;
      g.beginPath();
      g.moveTo(-2.8,-2.2); g.lineTo(-2.8+st,1);
      g.moveTo(2.8,-2.2); g.lineTo(2.8-st,1);
      g.stroke();
      g.fillStyle='#5d4a38';
      g.beginPath(); g.ellipse(0,-4.4,5.2,3.2,0,0,7); g.fill();      // massiger Rumpf
      g.beginPath(); g.ellipse(4.9,-4.9,2.2,1.8,0.15,0,7); g.fill(); // Kopf
      g.fillStyle='#3f332a';
      g.beginPath(); g.arc(6.8,-4.5,1,0,7); g.fill();                // Rüssel
      g.strokeStyle='#8a7a68'; g.lineWidth=0.8;                       // Borstenkamm
      g.beginPath(); g.moveTo(-3.4,-7.2); g.quadraticCurveTo(0,-8.4,3.2,-7.4); g.stroke();
      g.fillStyle='#e8e2d4';
      g.beginPath(); g.moveTo(5.9,-3.4); g.lineTo(6.7,-2.6); g.lineTo(6.1,-3); g.fill(); // Hauer
    }
    g.restore();
  }
  drawSheep(g, s){
    const m=this.game.map;
    const n=m.nearestNode(s.x,s.y);
    if(n<0 || !m.explored[n]) return;
    const walk=s.state==='walk';
    // gebackene GLB-Animation (Spritesheet) zuerst
    this._animSeed=(s.phase||0)*1.8;
    const sanim=this.animFrame('unit_sheep', walk?[s.tx-s.x,s.ty-s.y]:null, walk);
    if(sanim){
      this.shadow(g,s.x+2,s.y+4,7,2.6,0.22);
      const hh=16, ww=hh*(sanim.sw/sanim.sh);
      g.save();
      g.translate(s.x, s.y+4.6+hh*0.04);
      if(sanim.flip) g.scale(-1,1);
      g.drawImage(sanim.img, sanim.sx, sanim.sy, sanim.sw, sanim.sh, -ww/2, -hh, ww, hh);
      g.restore();
      return;
    }
    const bob=walk? Math.abs(Math.sin(this.time/130+s.phase))*1.4 : 0;
    const x=s.x, y=s.y-bob;
    this.shadow(g,s.x+2,s.y+4,7,2.6,0.22);
    const ovSh=this.asset('deco_sheep');
    if(ovSh){
      const hh=15, ww=hh*(ovSh.naturalWidth/ovSh.naturalHeight);
      // Schaf-Bild schaut nach links -> spiegeln, wenn es nach rechts läuft
      g.save();
      g.translate(x, y+5);
      if(walk && s.tx>s.x+0.5) g.scale(-1,1);
      g.drawImage(ovSh, -ww/2, -hh, ww, hh);
      g.restore();
      return;
    }
    // Beine
    g.strokeStyle='#5a5248'; g.lineWidth=1.8;
    const st=walk? Math.sin(this.time/130+s.phase)*1.6 : 0;
    g.beginPath();
    g.moveTo(x-3.5,y+1); g.lineTo(x-3.5+st,y+4.6);
    g.moveTo(x+3.5,y+1); g.lineTo(x+3.5-st,y+4.6);
    g.stroke();
    // flauschiger Körper
    g.fillStyle='#f4f1e8';
    g.beginPath();
    g.arc(x-3,y-2.4,4.4,0,7); g.arc(x+2.6,y-2.6,4.6,0,7); g.arc(x,y-4.6,4.2,0,7);
    g.fill();
    g.strokeStyle='rgba(120,110,95,0.4)'; g.lineWidth=1;
    g.beginPath(); g.arc(x,y-3,6.6,0,7); g.stroke();
    // Kopf (grast: unten, sonst vorn)
    const graze=s.state==='graze' && (this.time/1000+s.phase)%4<2.6;
    const hx2=x+6.4, hy2=graze? y+2.4 : y-3.4;
    g.fillStyle='#4a4038';
    g.beginPath(); g.ellipse(hx2,hy2,2.8,3.4,graze?0.9:0.3,0,7); g.fill();
    // Öhrchen
    g.beginPath(); g.ellipse(hx2-1.6,hy2-2,1.6,0.9,0.6,0,7); g.fill();
    g.fillStyle='#f4f1e8';
    g.beginPath(); g.arc(hx2-1,hy2-2.6,1.7,0,7); g.fill();
    // Schwänzchen
    g.fillStyle='#f4f1e8';
    g.beginPath(); g.arc(x-7,y-3.4,1.7,0,7); g.fill();
  }
  // ================= Kleintier-Deko: Falter, Singvögel, Zugvögel =================
  // Die Plätze werden je Bild aus dem SICHTBAREN Knotenfenster gehasht – es
  // gibt keinen Vorrat, nichts wird gespeichert, außerhalb des Fensters wird
  // gar nicht erst gerechnet. Die Anzahl ist hart gedeckelt und die Dichte an
  // die Fenstergröße gekoppelt, damit ein großer Bildschirm keinen Schwarm
  // bekommt. Sichtbarkeit hängt am Zoom: bei weitem Blick wären die Tierchen
  // nur Pixelrauschen und würden bloß Leistung kosten.

  // Falter und Singvögel des sichtbaren Fensters in die Tiefensortierung
  // einreihen. figs = Figurenliste desselben Bildes (fürs Aufscheuchen).
  sammleKleintiere(items, figs, m, x0, x1, y0, y1, cam){
    if(this.dekoTiere===false) return;
    const zF = cam.z>=1.15;          // Schmetterlinge: nur bei nahem Zoom
    const zV = cam.z>=1.05;          // Bodenvögel: nur bei näherem Zoom
    if(!zF && !zV) return;
    // Rasterzellen statt Würfeln je Knoten: so verteilen sich die Tierchen
    // gleichmäßig über die sichtbare Wiese (kein Schwarm, aber auch keine
    // leere Ecke), die Anzahl hängt nicht am Bildschirmformat, und je Bild
    // werden nur ein paar Dutzend Knoten geprüft statt des ganzen Fensters.
    // Die Rasterweite kommt aus Sichtfeld und Zoom – NICHT aus dem gerundeten
    // Knotenfenster, sonst würden die Tierchen beim Schieben der Karte
    // springen, weil das Fenster mal eine Spalte mehr umfasst.
    const sp=this.vw/cam.z/TILE, sr=this.vh/cam.z/ROWH;   // sichtbare Spalten/Zeilen
    const zell=Math.max(2, Math.min(16, Math.round(Math.sqrt(Math.max(4,sp*sr)/7))));
    // Die Rasterweite ist ganzzahlig und trifft die Zielzahl deshalb nur grob;
    // der Füllgrad zieht nach, damit auf dem breiten Schirm nicht plötzlich
    // doppelt so viele Tierchen unterwegs sind wie auf dem Handy.
    const zellenF=(sp/zell+1)*(sr/zell+1);
    const fuellF=Math.min(0.8, 6/zellenF);      // Zielzahl Falter im Blick
    // Nur der WIRKLICH sichtbare Ausschnitt zählt: das Knotenfenster x0..y1
    // reicht für die hohen Baum- und Hausbilder weit über den Rand hinaus –
    // dort würden Tierchen bloß außerhalb des Bildes gezeichnet. Der Zuschnitt
    // läuft über die WELTLAGE des Knotens, nicht über Spaltennummern: eine
    // Spalte ist bei nahem Zoom ein Drittel Bildschirmbreite.
    const hw=this.vw/2/cam.z, hh=this.vh/2/cam.z;
    const vx0=cam.x-hw-16, vx1=cam.x+hw+16, vy0=cam.y-hh-16, vy1=cam.y+hh+20;
    const ax0=Math.max(x0, Math.floor(vx0/TILE)), ax1=Math.min(x1, Math.ceil(vx1/TILE));
    const ay0=Math.max(y0, Math.floor(vy0/ROWH)), ay1=Math.min(y1, Math.ceil(vy1/ROWH)+1);
    if(ax1<ax0 || ay1<ay0) return;
    const MAXF=12, MAXV=6;           // harte Obergrenze je Bild
    let nF=0, nV=0;
    // ---- Schmetterlinge: Wiese und Acker, am liebsten bei den Blumen ----
    if(zF) for(let cy=Math.floor(ay0/zell); cy<=Math.floor(ay1/zell) && nF<MAXF; cy++)
      for(let cx=Math.floor(ax0/zell); cx<=Math.floor(ax1/zell) && nF<MAXF; cx++){
        const hz=(Math.imul(cx,73856093)^Math.imul(cy,19349663))|0;
        if(hash01(hz^0x51ab)>fuellF) continue;        // die meisten Zellen bleiben leer
        const i=this.wiesenKnoten(m, hz, cx, cy, zell, ax0,ax1,ay0,ay1, true);
        if(i<0) continue;
        const [px,py]=m.worldPos(i);
        if(px<vx0||px>vx1||py<vy0||py>vy1) continue;
        items.push({kind:'falter', f:this.falterLage(i, m), y:py+2});
        nF++;
      }
    // ---- Singvögel: freie Wiese, am liebsten in Baumnähe (gröberes Raster) ----
    const zellV=Math.max(3, Math.min(24, Math.round(zell*1.3)));
    const fuellV=Math.min(0.75, 3.6/((sp/zellV+1)*(sr/zellV+1)));
    if(zV) for(let cy=Math.floor(ay0/zellV); cy<=Math.floor(ay1/zellV) && nV<MAXV; cy++)
      for(let cx=Math.floor(ax0/zellV); cx<=Math.floor(ax1/zellV) && nV<MAXV; cx++){
        const hz=(Math.imul(cx,83492791)^Math.imul(cy,29349673))|0;
        if(hash01(hz^0x2cd1)>fuellV) continue;
        const i=this.wiesenKnoten(m, hz, cx, cy, zellV, ax0,ax1,ay0,ay1, false);
        if(i<0) continue;
        const [px,py]=m.worldPos(i);
        if(px<vx0||px>vx1||py<vy0||py>vy1) continue;
        const v=this.vogelLage(i, m, figs);
        items.push({kind:'singvogel', v, y:v.gy+2});
        nV++;
      }
    // Aufscheuch-Merker aufräumen: was 20 s nicht im Blick war, ist längst
    // außer Sicht – der Vogel darf dort ohne sichtbaren Sprung zurückfallen.
    const fl=this._vogelFlucht;
    if(fl && fl.size>48)
      for(const [k,s] of fl) if(this.time-s.seen>20000) fl.delete(k);
  }
  // Sucht in einer Rasterzelle den passendsten Knoten. Für Falter zählt Wiese
  // oder Acker, Blumenbüschel und Feld am stärksten; für Singvögel nur freie
  // Wiese, dort zählt Baumnähe am stärksten. -1 = diese Zelle bleibt leer.
  // Der GEWÄHLTE Platz hängt nur an der Zelle, nicht am Sichtfenster – beim
  // Schieben der Karte bleiben die Tierchen deshalb dort stehen, wo sie waren;
  // das Fenster entscheidet nur, ob die Zelle überhaupt zum Zug kommt.
  wiesenKnoten(m, hz, cx, cy, zell, x0, x1, y0, y1, falter){
    let best=-1, bw=0;
    for(let k=0;k<4;k++){
      const nx=cx*zell+((hash01(hz^(0x7a3b+k*977))*zell)|0);
      const ny=cy*zell+((hash01(hz^(0x9e37+k*613))*zell)|0);
      if(nx<x0||nx>x1||ny<y0||ny>y1||!m.inb(nx,ny)) continue;
      const i=m.idx(nx,ny);
      if(!m.explored[i] || m.bld[i]>=0) continue;
      const t=m.terr[i], o=m.obj[i]&127;
      let w=0;
      if(falter){
        const acker=(o===OBJ.FIELD0||o===OBJ.FIELD1||o===OBJ.FIELD2);
        if(t!==TER.GRASS && !acker) continue;
        // Die Blumenbüschel sitzen im Chunk-Bake auf genau diesen Knoten
        // (terrainBrush: h>0.97 und Blumen aus dem Deko-Vorrat)
        const blume=t===TER.GRASS && hash01(i*17+9)>0.97 && hash01(i*31+5)<0.22;
        w=(blume||acker)? 3 : (o===OBJ.NONE? 2 : 1);
      } else {
        if(t!==TER.GRASS || o!==OBJ.NONE || m.flag[i]) continue;
        w=1;
        for(const n of m.nbs(i)){
          const q=m.obj[n]&127;
          if(q===OBJ.TREE||q===OBJ.TREE2||q===OBJ.SAPLING){ w=3; break; }
        }
      }
      if(w>bw){ bw=w; best=i; if(w>=3) break; }
    }
    // Singvögel setzen sich nur ausnahmsweise weit weg von jedem Baum
    if(!falter && bw<3 && hash01(hz^0x3f11)>0.5) return -1;
    return best;
  }

  // ---------- Schmetterling: taumelnde Bahn um seinen Ankerknoten ----------
  // Kein gerader Kurs: die Bahn entsteht aus unharmonischen Schwingungen.
  // Am Ende jeder Runde landet er kurz auf einer Blüte und klappt die Flügel
  // zusammen, dann flattert er weiter.
  falterLage(i, m){
    const [ax,ay]=m.worldPos(i);
    const T=this.time*0.001;
    const h1=hash01(i*911+3), h2=hash01(i*1733+7), h3=hash01(i*2477+13), h4=hash01(i*3181+17);
    const zyk=8+h1*6;                                    // Sekunden je Runde
    const ph=((T+h2*zyk)%zyk)/zyk;                       // 0..1
    // Sitzphase: weich anfliegen, kurz verharren, weich abheben
    let sitz=0;
    if(ph>0.72) sitz=Math.min(1,(ph-0.72)/0.08)*Math.min(1,(1-ph)/0.06);
    const s2=sitz*sitz*(3-2*sitz);
    const rx=12+h3*10, ry=6+h4*5;
    const fx=ax + Math.sin(T*1.27+h1*6.28)*rx + Math.sin(T*2.13+h2*6.28)*rx*0.42;
    const hoch=10 + 5*Math.sin(T*0.79+h3*6.28) + 3.5*Math.sin(T*1.93+h4*6.28);
    const fy=ay - hoch + Math.sin(T*1.09+h2*6.28)*ry*0.5;
    const lx=ax+(h3-0.5)*17, ly=ay-1.0+(h4-0.5)*3;       // Landeplatz auf der Blüte
    // Flügelschlag 6,6..9,8 Hz, durch eine langsame Schwebung leicht unruhig
    const fq=6.6+h1*3.2;
    const schlag=Math.sin((T*fq + Math.sin(T*0.53+h2*6.28)*0.17)*6.2832);
    const x=fx+(lx-fx)*s2, y=fy+(ly-fy)*s2;
    return {
      x, y, gy:ay, hoehe:Math.max(0, ay-y),
      // Grundmaß: voll aufgeschlagen misst er rund 7..9 Weltpixel Spannweite,
      // im Mittel des Schlags gut 5 – deutlich kleiner als der Singvogel
      // (knapp 8 px lang) und ein Bruchteil der Siedlerhöhe (17 px).
      s: 1.8+h3*0.7,
      v: (h4*4)|0,                                       // Farbvariante
      sitz: s2,
      // Flügelbreite perspektivisch: flach offen bis zusammengeklappt
      br: (0.24+0.76*Math.abs(schlag))*(1-s2) + 0.16*s2,
      hb: (1-Math.abs(schlag))*(1-s2),                   // angehobene Spitzen
      kipp: (h2-0.5)*0.5,
    };
  }
  zeichneFalter(g, f){
    const S=f.s, sitzt=f.sitz>0.55;
    // Feinheiten (Fühler, Flügelsaum) erst, wenn sie überhaupt ein paar Pixel
    // breit werden – darunter sind es nur teure Unterpixel-Striche
    const fein=S*((this._lastCam&&this._lastCam.z)||1) > 4.2;
    // hauchzarter Bodenschatten – er verrät, wie hoch der Falter gerade steht
    const a=Math.max(0.03, 0.14-f.hoehe*0.005);
    if(a>0.05) this.shadow(g, f.x+f.hoehe*0.14, f.gy+0.8, S*0.40, S*0.14, a);
    g.save();
    g.translate(f.x, f.y);
    g.rotate(f.kipp);
    // gemalte Fassung zuerst (Draufsicht offen bzw. sitzend zusammengeklappt)
    const key='deco_falter'+(f.v+1)+(sitzt?'_sitz':'');
    const bild=this.asset(key) || (sitzt? this.asset('deco_falter'+(f.v+1)) : null);
    if(bild){
      const hh=S*2.0, ww=hh*(bild.naturalWidth/bild.naturalHeight)*(sitzt?1:f.br);
      g.drawImage(bild, -ww/2, -hh*0.55, ww, hh);
      g.restore();
      return;
    }
    const [hell,halb,saum,koerper]=FALTER_FARBEN[f.v];
    if(sitzt){
      // sitzend: beide Flügel senkrecht über dem Rücken zusammengeklappt,
      // der hintere lugt schmaler und dunkler hervor
      g.fillStyle=halb;
      g.beginPath(); g.ellipse(-S*0.20,-S*0.48, S*0.21, S*0.58, -0.10, 0,7); g.fill();
      g.fillStyle=hell;
      g.beginPath(); g.ellipse( S*0.08,-S*0.56, S*0.26, S*0.66,  0.08, 0,7); g.fill();
      g.fillStyle=saum;                                  // Saum an der Flügelkante
      g.beginPath(); g.ellipse( S*0.28,-S*0.66, S*0.09, S*0.34,  0.16, 0,7); g.fill();
      g.fillStyle=koerper;                               // Hinterleib
      g.beginPath(); g.ellipse(0,-S*0.10, S*0.12, S*0.22, 0,0,7); g.fill();
      if(fein){
        g.strokeStyle=koerper; g.lineWidth=0.4;          // ein Fühler
        g.beginPath();
        g.moveTo(S*0.06,-S*0.26); g.quadraticCurveTo(S*0.30,-S*0.54, S*0.44,-S*0.64);
        g.stroke();
      }
    } else {
      // Flügeltiefe bewusst kräftig: bei mittlerem Zoom soll die Silhouette
      // ein Falter bleiben und kein waagerechter Strich werden
      const owx=Math.max(0.3,S*1.02*f.br), owy=S*0.70;    // Oberflügel
      const uwx=Math.max(0.24,S*0.72*f.br), uwy=S*0.50;   // Unterflügel
      const hb=f.hb*S*0.5;
      for(const sd of [1,-1]){
        g.fillStyle = sd>0? hell : halb;                  // Schräglage lesbar machen
        g.beginPath(); g.ellipse(sd*uwx*0.9,  S*0.30-hb*0.5, uwx, uwy, sd*0.34, 0,7); g.fill();
        g.beginPath(); g.ellipse(sd*owx*0.95,-S*0.24-hb,     owx, owy, -sd*0.22, 0,7); g.fill();
      }
      // Saum und Leib bleiben IMMER: ohne sie verschmelzen die beiden Flügel
      // bei mittlerem Zoom zu einem farbigen Klecks
      g.fillStyle=saum;                                   // dunkler Flügelsaum
      g.beginPath();
      g.ellipse( owx*1.48,-S*0.34-hb, owx*0.32, owy*0.32, 0,0,7);
      g.ellipse(-owx*1.48,-S*0.34-hb, owx*0.32, owy*0.32, 0,0,7);
      g.fill();
      g.fillStyle=koerper;                                // Leib trennt die Flügel
      g.beginPath(); g.ellipse(0,-S*0.06,S*0.17,S*0.50,0,0,7); g.fill();
      if(fein){
        g.strokeStyle=koerper; g.lineWidth=0.35;          // Fühlerpaar
        g.beginPath();
        g.moveTo(-S*0.05,-S*0.34); g.quadraticCurveTo(-S*0.22,-S*0.58,-S*0.32,-S*0.66);
        g.moveTo( S*0.05,-S*0.34); g.quadraticCurveTo( S*0.22,-S*0.58, S*0.32,-S*0.66);
        g.stroke();
      }
    }
    g.restore();
  }

  // ---------- Singvogel: hüpft, pickt, fliegt vor Figuren auf ----------
  // Hüpfen und Picken laufen rein aus this.time und dem Knoten-Hash. Nur das
  // Aufscheuchen braucht einen winzigen Merker (Startzeit + Versatz), damit
  // der Vogel sich woanders hinsetzen kann.
  vogelLage(i, m, figs){
    const [ax,ay]=m.worldPos(i);
    const T=this.time*0.001;
    const h1=hash01(i*577+5), h2=hash01(i*1279+11), h3=hash01(i*1993+19);
    if(!this._vogelFlucht) this._vogelFlucht=new Map();
    let st=this._vogelFlucht.get(i);
    let vx=0, vy=0, flug=0, hoehe=0;
    if(st){
      st.seen=this.time;
      const fl=(this.time-st.t0)/1250;
      if(fl<1){
        flug=1;
        const e=fl*fl*(3-2*fl);
        vx=st.ox+(st.zx-st.ox)*e; vy=st.oy+(st.zy-st.oy)*e;
        hoehe=Math.sin(fl*Math.PI)*26;
      } else { vx=st.zx; vy=st.zy; }
    }
    const gx=ax+vx, gy=ay+vy;                    // Standplatz (Boden)
    let bx=gx, by=gy-hoehe, pick=0, richt=1, bogen=0;
    if(flug){
      richt = (st.zx>=st.ox)? 1 : -1;
    } else {
      // Hüpfen: kurze Sprünge zwischen festen Plätzchen, dazwischen picken
      const takt=1.5+h1*1.1;
      const u0=T/takt + h2*97;
      const k=Math.floor(u0), u=u0-k;
      const pkt=(kk)=>[gx+(hash01(i*31+kk*17+3)-0.5)*24, gy+(hash01(i*37+kk*23+9)-0.5)*10];
      const p0=pkt(k-1), p1=pkt(k);
      const s=Math.min(1,u/0.24), e=s*s*(3-2*s);
      bx=p0[0]+(p1[0]-p0[0])*e; by=p0[1]+(p1[1]-p0[1])*e;
      bogen = u<0.24? Math.sin(s*Math.PI)*3.4 : 0;
      richt = (p1[0]>=p0[0])? 1 : -1;
      if(u>0.38) pick=Math.max(0, Math.sin((u-0.38)*Math.PI*5.5));
      by-=bogen;
    }
    // Aufscheuchen: kommt eine Figur zu nah, fliegt er auf und setzt sich um
    if(!flug){
      let nah=false;
      for(const q of figs){
        if(Math.abs(q.x-bx)>40) continue;
        const dx=q.x-bx, dy=q.y-by;
        if(dx*dx+dy*dy < 1156){ nah=true; break; }      // 34 px
      }
      if(nah && (!st || this.time-st.t0>2400)){
        const n=st? (st.n+1)&255 : 1;
        st={ t0:this.time, n, ox:bx-ax, oy:by-ay,
             zx:(hash01(i*53+n*29)-0.5)*76, zy:(hash01(i*59+n*31)-0.5)*36,
             seen:this.time };
        this._vogelFlucht.set(i, st);
        this.vogelZwitschern(i, n, bx, by);
      }
    }
    return { x:bx, y:by, gy, flug, hoehe:hoehe+bogen, pick, richt,
             v:(h3*3)|0, ph:h2*6.28, s:0.92+h1*0.24 };
  }
  zeichneSingvogel(g, v){
    const S=3.1*v.s;
    const a=v.flug? Math.max(0.05, 0.20-v.hoehe*0.006) : 0.22;
    this.shadow(g, v.x+1, v.gy+1.4, S*0.7*(v.flug?0.7:1), S*0.24, a);
    g.save();
    g.translate(v.x, v.y);
    if(v.richt<0) g.scale(-1,1);
    // gemalte Fassung zuerst (Stand- bzw. Flugbild)
    const bild=this.asset('deco_singvogel'+(v.v+1)+(v.flug?'_flug':''))
            || this.asset('deco_singvogel'+(v.v+1));
    if(bild){
      const hh=S*1.9, ww=hh*(bild.naturalWidth/bild.naturalHeight);
      g.drawImage(bild, -ww/2, -hh, ww, hh);
      g.restore();
      return;
    }
    const [ruecken,kopf,bauch]=VOGEL_FARBEN[v.v];
    if(v.flug){
      // Flugbild: Flügel weit auf und ab, Körper waagerechter
      const fl=Math.sin(this.time*0.009+v.ph);
      g.fillStyle=kopf;
      for(const sd of [1,-1]){
        g.beginPath();
        g.moveTo(0,-S*0.7);
        g.quadraticCurveTo(sd*S*0.9,-S*0.7-fl*S*0.9, sd*S*1.55,-S*0.6-fl*S*1.15);
        g.quadraticCurveTo(sd*S*0.9,-S*0.35-fl*S*0.75, 0,-S*0.42);
        g.closePath(); g.fill();
      }
      g.fillStyle=ruecken;
      g.beginPath(); g.ellipse(0,-S*0.58, S*0.72, S*0.44, -0.12, 0,7); g.fill();
      g.fillStyle=bauch;
      g.beginPath(); g.ellipse(S*0.12,-S*0.48, S*0.42, S*0.26, -0.12, 0,7); g.fill();
      g.fillStyle=kopf;
      g.beginPath(); g.arc(S*0.72,-S*0.76, S*0.34, 0,7); g.fill();
      g.beginPath();                                        // Schwanzfächer
      g.moveTo(-S*0.62,-S*0.66); g.lineTo(-S*1.35,-S*0.86);
      g.lineTo(-S*1.30,-S*0.44); g.closePath(); g.fill();
      g.fillStyle='#e8b53c';
      g.beginPath(); g.moveTo(S*1.0,-S*0.78); g.lineTo(S*1.32,-S*0.70); g.lineTo(S*1.0,-S*0.64); g.closePath(); g.fill();
      g.restore();
      return;
    }
    // Standbild: sitzt aufrecht, beim Picken kippt er nach vorn
    const fein=S*((this._lastCam&&this._lastCam.z)||1) > 4.5;
    g.rotate(v.pick*0.42);
    if(fein){
      g.strokeStyle='#c98a3e'; g.lineWidth=0.6;              // Beinchen
      g.beginPath();
      g.moveTo(-S*0.12,-S*0.3); g.lineTo(-S*0.16,0);
      g.moveTo( S*0.16,-S*0.3); g.lineTo( S*0.20,0);
      g.stroke();
    }
    g.fillStyle=ruecken;                                     // Körper
    g.beginPath(); g.ellipse(0,-S*0.66, S*0.66, S*0.56, -0.18, 0,7); g.fill();
    g.fillStyle=bauch;                                       // helle Brust
    g.beginPath(); g.ellipse(S*0.20,-S*0.56, S*0.40, S*0.38, -0.18, 0,7); g.fill();
    g.fillStyle=kopf;                                        // Flügel angelegt
    g.beginPath(); g.ellipse(-S*0.12,-S*0.70, S*0.42, S*0.30, 0.24, 0,7); g.fill();
    g.beginPath();                                           // Schwanz
    g.moveTo(-S*0.52,-S*0.82); g.lineTo(-S*1.28,-S*1.22);
    g.lineTo(-S*1.14,-S*0.76); g.closePath(); g.fill();
    g.beginPath(); g.arc(S*0.52,-S*1.20, S*0.40, 0,7); g.fill();   // Kopf
    g.fillStyle='#e8b53c';                                   // Schnäbelchen
    g.beginPath();
    g.moveTo(S*0.86,-S*1.24); g.lineTo(S*1.22,-S*1.14); g.lineTo(S*0.86,-S*1.06);
    g.closePath(); g.fill();
    if(fein){
      g.fillStyle='#1c1a16';                                 // Auge
      g.beginPath(); g.arc(S*0.66,-S*1.30, S*0.11, 0,7); g.fill();
    }
    g.restore();
  }
  // leises, seltenes Zwitschern beim Auffliegen – mit großzügiger Sperre,
  // damit auf einer belebten Wiese kein Dauergezirpe entsteht
  vogelZwitschern(i, n, bx, by){
    if(!this.onAmbient) return;
    if(this.time - (this._zwitscherT||-1e9) < 7000) return;
    if(hash01(i*97+n*13) > 0.4) return;
    const cam=this._lastCam;
    if(!cam) return;
    const d=Math.hypot(bx-cam.x, by-cam.y)*cam.z;
    if(d>420) return;
    this._zwitscherT=this.time;
    this.onAmbient('zwitscher', Math.max(0.12, (1-d/420)*0.5));
  }

  // ---------- Zugvögel: ab und zu zieht eine kleine Schar vorbei ----------
  // Die Zeit ist in Fenster geteilt; in gut der Hälfte davon zieht eine Schar
  // von 3..7 Tieren in V- oder Reihenformation vorbei. Bahn, Richtung und
  // Länge werden EINMAL beim Aufbruch gemerkt (winziger Merker, nichts davon
  // wird gespeichert) – so wandert die Schar beim Schieben der Karte nicht
  // mit und zieht trotzdem in Sichtweite vorbei statt irgendwo am anderen
  // Ende der Karte. Sie liegen ÜBER allem (nach der Tiefensortierung
  // gezeichnet), aber unter der Bedienoberfläche und unter dem Nebel.
  zeichneZugvoegel(g, wx0, wx1, wy0, wy1, cam){
    if(this.dekoTiere===false) return;
    if(cam.z<0.55) return;                       // bei weitem Blick nur Rauschen
    const T=this.time*0.001;
    const ZYK=65;                                // Sekunden je Zeitfenster
    const nr=Math.floor(T/ZYK);
    let s=this._zugSchar;
    if(s && s.nr!==nr){ s=null; this._zugSchar=null; }
    if(!s && hash01(nr*7919+13)>0.4){             // nicht in jedem Fenster zieht eine
      const t0=nr*ZYK + hash01(nr*31+5)*10;
      // gemächlich: die Schar braucht rund acht Sekunden quer durchs Bild
      const dauer=38+hash01(nr*47+9)*14;
      // Erst BEIM AUFBRUCH anlegen und nur, solange die Schar noch weit vor
      // dem Bild steht – sonst würde sie mitten im Bild aufpoppen.
      if(T>=t0 && T<=t0+dauer*0.2){
        // flache Zugrichtung: quer vorbei, höchstens leicht schräg
        const ang=(hash01(nr*13+3)<0.5? 0 : Math.PI) + (hash01(nr*19+11)-0.5)*0.6;
        // Bahnlänge so, dass sie klar außerhalb des Bildes anfängt und endet
        const L=(this.vw+this.vh)/cam.z + 700;
        s={ nr, t0, dauer, L,
            dx:Math.cos(ang), dy:Math.sin(ang),
            ax:cam.x+(hash01(nr*53+7)-0.5)*L*0.16,
            ay:cam.y+(hash01(nr*59+3)-0.5)*L*0.20,
            n:3+((hash01(nr*23+21)*5)|0),
            reihe:hash01(nr*29+17)>0.55 };
        this._zugSchar=s;
      }
    }
    if(!s) return;
    const u=(T-s.t0)/s.dauer;
    if(u<0 || u>1) return;
    {
      const nr=s.nr, dx=s.dx, dy=s.dy, n=s.n, reihe=s.reihe;
      const px=s.ax + dx*(u-0.5)*s.L;
      const py=s.ay + dy*(u-0.5)*s.L;
      const bob=Math.sin(T*0.31+nr)*4;
      // klein und weich gehalten: sie sollen hoch am Himmel wirken, nicht wie
      // Striche auf der Wiese liegen
      g.strokeStyle='rgba(46,52,62,0.6)';
      g.lineWidth=1.15;
      g.fillStyle='rgba(46,52,62,0.6)';
      for(let k=0;k<n;k++){
        let zur, quer;
        if(reihe){ zur=k*10; quer=k*3.6; }
        else { const rang=Math.ceil(k/2), sd=(k%2)?1:-1; zur=rang*11; quer=sd*rang*8; }
        const bx=px - dx*zur - dy*quer + (hash01(nr*7+k*37)-0.5)*4;
        const by=py - dy*zur + dx*quer + bob + (hash01(nr*11+k*41)-0.5)*4;
        if(bx+12<wx0||bx-12>wx1||by+12<wy0||by-12>wy1) continue;
        // gemächlicher Schlag, je Tier leicht versetzt -> die Schar wellt
        const fq=1.8+hash01(nr*5+k*19)*0.7;
        const flap=Math.sin((T*fq)*6.2832 + k*0.55);
        const W=3.8, H=flap*2.0;
        const bild=this.asset('deco_zugvogel'+(1+Math.min(2,(Math.abs(flap)*3)|0)));
        if(bild){
          const hh=6, ww=hh*(bild.naturalWidth/bild.naturalHeight);
          g.save(); g.translate(bx,by);
          if(dx<0) g.scale(-1,1);
          g.drawImage(bild,-ww/2,-hh/2,ww,hh);
          g.restore();
          continue;
        }
        g.beginPath();
        g.moveTo(bx-W, by-H*0.35);
        g.quadraticCurveTo(bx-W*0.42, by-H-0.5, bx, by);
        g.quadraticCurveTo(bx+W*0.42, by-H-0.5, bx+W, by-H*0.35);
        g.stroke();
        // winziger Rumpf: ohne ihn liest sich der Bogen als bloßer Kringel
        g.beginPath(); g.ellipse(bx, by-0.1, 0.85, 0.5, 0, 0, 7); g.fill();
      }
    }
  }
  // ---------- Nebel: weiche Dunstschichten statt harter Kreise ----------
  rebuildFog(){
    const m=this.game.map;
    let count=0;
    for(let i=0;i<m.explored.length;i++) if(!m.explored[i]) count++;
    if(count===this._fogCount && this.fogDark) return;
    this._fogCount=count;
    const S=8;
    const w=m.w*S, h=m.h*S;
    const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h;
    const tg=tmp.getContext('2d');
    tg.fillStyle='#000';
    // Rand außerhalb der Karte gehört ebenfalls zum Unbekannten
    tg.fillRect(0,0,w,S); tg.fillRect(0,h-S,w,S); tg.fillRect(0,0,S,h); tg.fillRect(w-S,0,S,h);
    // Unerforschtes als unregelmäßige Schwaden: je Knoten mehrere versetzte,
    // verschieden große Kleckse -> die Grenze franst aus statt halbrund zu sein
    tg.beginPath();
    for(let y=0;y<m.h;y++){
      const off=(y&1)*S*0.5;
      for(let x=0;x<m.w;x++){
        const i=m.idx(x,y);
        if(m.explored[i]) continue;
        const cx=x*S+off+S*0.5, cy=y*S+S*0.5;
        for(let k=0;k<3;k++){
          const hs=hash01(i*7+k*31);
          const rx=cx+(hash01(i*13+k)-0.5)*S*1.5;
          const ry=cy+(hash01(i*19+k)-0.5)*S*1.5;
          const rr=S*(0.55+hs*0.7);
          tg.moveTo(rx+rr,ry);
          tg.arc(rx,ry,rr,0,7);
        }
      }
    }
    tg.fill();
    const mk=(blur,tint)=>{
      const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      const g2=cv.getContext('2d');
      this.blurInto(g2, tmp, blur);
      g2.globalCompositeOperation='source-in';
      g2.fillStyle=tint; g2.fillRect(0,0,w,h);
      return cv;
    };
    // Ankerpunkte für gemalte Nebelschwaden entlang der Sichtgrenze
    this.borderFog=[];
    for(let y=0;y<m.h;y++) for(let x=0;x<m.w;x++){
      const i=m.idx(x,y);
      if(m.explored[i]) continue;
      let edge=false;
      for(const n of m.nbs(i)) if(m.explored[n]){ edge=true; break; }
      if(!edge) continue;
      if(hash01(i*13+3)>0.34) continue;              // ausgedünnt
      const [px,py]=m.worldPos(i);
      this.borderFog.push({x:px, y:py, s:hash01(i)*6.28});
    }
    this.fogDark=mk(11,'#05080d');       // langer Verlauf transparent -> schwarz
    this.fogCore=mk(3,'#05080d');        // dichter Kern im Unerforschten
    this.fogMist=mk(20,'#8ea2b4');       // vorgelagerte Nebelschwaden
  }
  resize(w,h,dpr){
    this.cv.width=w*dpr; this.cv.height=h*dpr;
    this.dpr=dpr; this.vw=w; this.vh=h;
    // Vignette vorbereiten
    const v=document.createElement('canvas'); v.width=w; v.height=h;
    const g=v.getContext('2d');
    const rad=g.createRadialGradient(w/2,h/2, Math.min(w,h)*0.42, w/2,h/2, Math.hypot(w,h)*0.62);
    rad.addColorStop(0,'rgba(8,12,20,0)');
    rad.addColorStop(1,'rgba(8,12,20,0.22)');
    g.fillStyle=rad; g.fillRect(0,0,w,h);
    this.vignette=v;
  }
  // ---------- Chunks (Terrain) ----------
  chunkKey(cx,cy){ return cx+cy*1000; }
  markDirtyNode(i){
    const m=this.game.map;
    const x=m.X(i), y=m.Y(i);
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const cx=Math.floor((x+dx)/CHUNK), cy=Math.floor((y+dy)/CHUNK);
      this.chunkVer.set(this.chunkKey(cx,cy), (this.chunkVer.get(this.chunkKey(cx,cy))||0)+1);
    }
  }
  getChunk(cx,cy){
    const key=this.chunkKey(cx,cy);
    const ver=this.chunkVer.get(key)||0;
    // Kritik G3: Chunks werden bei nahem Zoom in dpr-gekoppelter, DOPPELTER
    // Aufloesung gebacken (S=2) und beim Zeichnen herunterskaliert – der
    // Fels wird so scharf wie die pro Frame gezeichneten Baeume daneben.
    // S bestimmt draw() aus dpr*zoom mit Hysterese (this._chunkScale).
    const S=this._chunkScale||1;
    let c=this.chunks.get(key);
    if(c && c.ver===ver && c.scale===S){ c.used=this.time; return c; }
    // Veralteter Chunk, aber Frame-Budget aufgebraucht? Dann diesmal den
    // alten Stand zeigen – mehrere gleichzeitig ungültige Chunks (frische
    // Erzader am Chunk-Rand, Aufloesungswechsel beim Zoomen) bauen sich
    // über die nächsten Frames verteilt neu auf, statt in EINEM Frame zu
    // ruckeln.
    if(c && this._chunkBudget!==undefined){
      if(this._chunkBudget<=0){ c.used=this.time; return c; }
      this._chunkBudget--;
    }
    const m=this.game.map;
    const pad=TILE*1.5;
    const w=CHUNK*TILE+pad*2, h=CHUNK*ROWH+pad*2+HSCALE*8;
    const W2=Math.round(w*S), H2=Math.round(h*S);
    if(!c){
      // Speicherbremse: jeder Chunk ist ein großes Canvas – selten benutzte
      // Chunks werden verworfen, bevor der Speicher auf dem Handy volläuft.
      // Gerade sichtbare (frisch benutzte) bleiben aber IMMER stehen, sonst
      // verwirft die Bremse bei maximalem Zoom-raus auf großen Bildschirmen
      // Chunks, die im nächsten Frame teuer neu gebaut werden müssten.
      // Gewichtet nach SPEICHER (S=2 wiegt 4x), damit die hochaufgeloesten
      // Nah-Chunks das Handy-Budget nicht sprengen.
      let mem=0; for(const cc of this.chunks.values()) mem+=cc.mem||1;
      if(mem>46){
        const olds=[...this.chunks.entries()].sort((a2,b2)=>(a2[1].used||0)-(b2[1].used||0));
        for(let k=0;k<olds.length && mem>34;k++){
          if((olds[k][1].used||0) > this.time-400) break;
          mem-=olds[k][1].mem||1;
          this.chunks.delete(olds[k][0]);
        }
      }
      c={cv:document.createElement('canvas')}; this.chunks.set(key,c);
    }
    c.used=this.time;
    c.ver=ver;
    c.scale=S; c.mem=S*S; c.dw=w; c.dh=h;
    c.ox=cx*CHUNK*TILE-pad; c.oy=cy*CHUNK*ROWH-pad-HSCALE*6;
    if(c.cv.width!==W2 || c.cv.height!==H2){ c.cv.width=W2; c.cv.height=H2; }
    const g=c.cv.getContext('2d');
    // Grundtransformation S: der GESAMTE Bake-Code arbeitet unveraendert in
    // Weltpixeln; save/restore erhalten die Basis. Compose-Schritte zwischen
    // den Zwischenflaechen geben die Zielgroesse (w,h) explizit an.
    g.setTransform(S,0,0,S,0,0);
    g.clearRect(0,0,w,h);
    // Zwischenflaechen zentral in Bake-Aufloesung anlegen (frueher verstreut)
    const mkTmpC=(nm)=>{
      if(!this[nm] || this[nm].width!==W2 || this[nm].height!==H2){
        this[nm]=document.createElement('canvas');
        this[nm].width=W2; this[nm].height=H2;
      }
      const ctx=this[nm].getContext('2d');
      ctx.setTransform(S,0,0,S,0,0);
      ctx.globalCompositeOperation='source-over';
      return ctx;
    };
    mkTmpC('_texTmp');
    mkTmpC('_shadeTmp'); mkTmpC('_blurTmp');
    // Gouraud-Basis, Reliefpass, Masken, Schattensilhouette und der
    // Boden-Schichtenpass sind per Definition WEICHE Formen – sie backen
    // in 1x (S wuerde nur Fuellrate kosten, keine Schaerfe bringen); die
    // Compose-Schritte mit expliziten Zielmassen skalieren sie hoch.
    const mkTmp1=(nm)=>{
      if(!this[nm] || this[nm].width!==w || this[nm].height!==h){
        this[nm]=document.createElement('canvas');
        this[nm].width=w; this[nm].height=h;
      }
      const ctx=this[nm].getContext('2d');
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalCompositeOperation='source-over';
      return ctx;
    };
    mkTmp1('_tmpChunk'); mkTmp1('_relTmp'); mkTmp1('_relTmp2');
    mkTmp1('_maskTmp'); mkTmp1('_castTmp'); mkTmp1('_texTmp1');
    // Umbau 3.4: zweite Maskenflaeche fuer die WEICHE Firnkante (der Firn
    // braucht seine harte Zellmaske und die weichgezeichnete Fassung
    // gleichzeitig – _blurTmp liegt in Bake-Aufloesung und passt nicht).
    mkTmp1('_maskTmp2');
    const cols=TER_COL[this.theme]||TER_COL.gruen;
    const ncache=new Map();
    // 1) Dreiecksnetz auf Zwischenfläche zeichnen (mit breitem Überstand für nahtlose Chunks)
    const tg=this._tmpChunk.getContext('2d');
    tg.globalCompositeOperation='source-over';
    tg.clearRect(0,0,w,h);
    // additiv: die Gouraud-Verläufe summieren sich zur stufenlosen Fläche
    tg.globalCompositeOperation='lighter';
    tg.save(); tg.translate(-c.ox,-c.oy);
    const x0=cx*CHUNK-3, y0=cy*CHUNK-3, x1=x0+CHUNK+6, y1=y0+CHUNK+6;
    for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++){
      for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
        const i=m.idx(x,y);
        const p=y&1;
        const iE = x+1<m.w ? m.idx(x+1,y) : i;
        const iSW = m.inb(x-1+p,y+1)? m.idx(x-1+p,y+1) : i;
        const iSE = m.inb(x+p,y+1)? m.idx(x+p,y+1) : i;
        this.tri(tg, m, cols, ncache, i, iE, iSE);
        this.tri(tg, m, cols, ncache, i, iSE, iSW);
      }
    }
    tg.restore();
    tg.globalCompositeOperation='source-over';
    // 2) direkt übernehmen – die Gouraud-Fläche ist bereits stufenlos
    g.drawImage(this._tmpChunk,0,0,w,h);
    // 3) Geländetexturen geschichtet: jede Terrainart bekommt eine weich
    //    gefiederte Maske; die Arten werden von "Untergrund" nach "Auflage"
    //    gezeichnet, dadurch gehen sie ineinander über statt hart zu stoßen.
    //    Anschließend färbt das (weichgezeichnete) Farbnetz die Textur ein und
    //    ein Reliefpass aus dem Höhengradienten setzt Licht und Schatten.
    {
      const perT=new Map();
      const gorge=[], ridgeSnow=[];
      // Umbau 2.7b: der Massiv-Pass baut die Schlagschatten-Silhouette in
      // _castTmp; aufgelegt wird sie erst NACH dem Bergfuss-Band (der
      // Schatten liegt auch auf Geroell und Grasbuescheln der Ebene)
      let castShadow=false;
      // Huellrechteck fuer die Schlagschatten-Anwendung (wird im
      // Massiv-Pass gesetzt; Anwendung erfolgt erst nach dem Bergfuss-Band)
      let sbx0=0, sby0=0, sbw=0, sbh=0;
      // Massiv-Zugehörigkeit: MOUNT/LAVA immer, SNOW nur als vereister Gipfelkamm.
      // Diese Knoten malt der Massiv-Pass komplett selbst – sie fallen aus den
      // weichen Boden-Schichten heraus, sonst überlagern sich beide Systeme.
      const msn=this.massifSnow();
      const isMassif=(q)=>{ const t2=m.terr[q]; return t2===TER.MOUNT||t2===TER.LAVA||(t2===TER.SNOW&&msn[q]); };
      // --- Gebirgskritik G1 / Nutzer-Leitlinien A+C: kleine und schmale
      // Massive muessen aus der Ebene HERAUSRAGEN statt wie eine Wiese mit
      // Felstextur zu wirken. Der GEZEICHNETE Fels (nur Zeichnung – m.hgt
      // und damit Spiellogik/Klickziele bleiben unangetastet) bekommt eine
      // Hoehen-Anhebung, wo das lokale Relief (Kamm minus Vorland) unter
      // ~1.7 Hoeheneinheiten liegt: das Defizit wird aufgefuellt. Das
      // Profil waechst von der Randreihe (0.55) zum Inneren (1.0) – eine
      // Kuppe mit Wandkante: talseitig eine echte Absturzwand mit
      // Fallhoehe, bergseitig verdeckt die angehobene Silhouette die
      // Wiese dahinter. An Paessen und um Bergwerke wird die Anhebung
      // stark gedaempft, damit Wege und Minen nicht unter dem gemalten
      // Fels verschwinden. Deterministisch aus Karte+Passnetz+Minen –
      // chunkuebergreifend stabil; Minenbau markiert die Chunks dreckig
      // (siehe _mineSeen in draw()).
      const mineNodes=new Set();
      for(const b3 of this.game.buildings.values())
        if(BLD[b3.type] && BLD[b3.type].size==='MINE') mineNodes.add(b3.node);
      // Cache RENDERER-weit (nicht je Bake): auch Schilder/Fahnen fragen die
      // Anhebung ab (liftAt), damit sie auf dem angehobenen Fels stehen.
      // Wird bei Minenbau/-abriss und Spielwechsel geleert.
      if(!this._liftC) this._liftC=new Map();
      const liftC=this._liftC;
      const LF=this.liftField();
      const liftInfo=(q)=>{
        let v=liftC.get(q);
        if(v) return v;
        // Lava hebt sich nie: Lavaflaechen sind Becken, keine Kuppen
        if(!isMassif(q) || m.terr[q]===TER.LAVA){
          v={lift:0, rel: m.terr[q]===TER.LAVA? 2.5 : 0}; liftC.set(q,v); return v;
        }
        // Basis aus dem globalen Anhebungsfeld (liftField); oertlich
        // gedaempft an Paessen (Wege!) und um Bergwerke (Verankerung)
        let damp=1;
        if(m.pass && m.pass[q]) damp=0.12;
        if(mineNodes.has(q)) damp=0;
        if(damp>0.12){
          for(const b4 of m.nbs(q)){
            if(m.pass && m.pass[b4]) damp=Math.min(damp,0.25);
            if(mineNodes.has(b4)) damp=Math.min(damp,0.15);
          }
          if(damp>0.5){
            outer:
            for(const b4 of m.nbs(q)) for(const b5 of m.nbs(b4)){
              if(mineNodes.has(b5)){ damp=Math.min(damp,0.5); break outer; }
              if(m.pass && m.pass[b5]) damp=Math.min(damp,0.6);
            }
          }
        }
        v={lift: LF.lift[q]*damp, rel: LF.rel[q]};
        liftC.set(q,v);
        return v;
      };
      const liftOf=(q)=>liftInfo(q).lift;
      // effektives Relief NACH Anhebung: Grundlage der RELATIVEN
      // Wand-/Klippen-Schwellen (Kritik G1: absolute Schwellwerte
      // erreichten kleine Massive nie)
      const relEffOf=(q)=>{ const v=liftInfo(q); return Math.max(v.rel, Math.min(1.7, v.rel+v.lift)); };
      for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++)
        for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
          const i=m.idx(x,y);
          const t=m.terr[i];
          if(t===TER.SNOW && msn[i]){
            // Gipfel-Eis gehört zum Massiv (Firn kommt dort aus dem Massiv-Pass)
            if(!perT.has(TER.MOUNT)) perT.set(TER.MOUNT,[]);
            perT.get(TER.MOUNT).push(i);
            continue;
          }
          if(!perT.has(t)) perT.set(t,[]);
          perT.get(t).push(i);
          if(t===TER.MOUNT){
            // Risse nur im offenen Fels – auf der Firndecke läsen sie sich
            // als Schmutzstriche im Schnee (großzügiger Abstand: die
            // Franszone reicht über Nachbarzellen unter die Grenzhöhe,
            // und neben Gipfel-Eis liegt praktisch immer Schnee)
            if(this.slopeOf(m,i)>0.62 && m.hgt[i]<=this.firnLine()-1.2
               && !m.nbs(i).some(n=>m.terr[n]===TER.SNOW&&msn[n])) gorge.push(i);
          }
          // Schnee AUF dem Hang der Ebene ist Firn, nicht die weiche Winter-
          // decke. NUR mit Nachbar-Stützung: einzelne Knoten knapp über der
          // Schwelle standen sonst als Ketten heller Einzelblasen ("Perlen")
          // parallel zu jedem Geländeanstieg im Schnee
          if(t===TER.SNOW && this.slopeOf(m,i)>0.42
             && m.nbs(i).some(q=>m.terr[q]===TER.SNOW && this.slopeOf(m,q)>0.42))
            ridgeSnow.push(i);
        }
      // Zeichenreihenfolge: weiche Böden zuerst, Fels/Lava zuletzt
      // Fels wird NICHT weich eingeblendet – ihn zeichnet der Massiv-Pass
      // unten als durchgehende Felsdecke mit Facettenlicht.
      const ORDER=[TER.WATER, TER.SWAMP, TER.GRASS, TER.DESERT, TER.SNOW, TER.LAVA];
      const layers=ORDER.filter(t=>perT.has(t)).map(t=>({key:t, nodes:perT.get(t), pat:t}));
      // Firn liegt auf den Schneehängen der Ebene; das Massiv bekommt seine
      // Firndecke im Massiv-Pass
      if(ridgeSnow.length) layers.push({key:'firn', nodes:ridgeSnow,
        pat:this.asset('ter_firn')? 'firn' : TER.SNOW});
      const tex=this._texTmp1.getContext('2d');
      const mk=this._maskTmp.getContext('2d');
      for(const L of layers){
        const pat=this.terrainPattern(L.pat, tex);
        if(!pat) continue;
        // Muster in Weltkoordinaten füllen (CTM verankert es weltweit einheitlich)
        tex.globalCompositeOperation='source-over';
        tex.clearRect(0,0,w,h);
        tex.save(); tex.translate(-c.ox,-c.oy);
        tex.fillStyle=pat;
        tex.fillRect(c.ox,c.oy,w,h);
        // Varianz: dieselbe Kachel ein zweites Mal, größer und versetzt, als
        // fleckige Auflage -> die Wiederholung der einen Kachel verschwindet
        const pat2=this.terrainPattern(L.pat, tex, 1);
        if(pat2){
          tex.globalAlpha=0.16;
          tex.fillStyle=pat2;
          tex.fillRect(c.ox,c.oy,w,h);
          tex.globalAlpha=1;
        }
        tex.restore();
        // Maske aus den Zellen der Knoten, nicht aus Kreisen. Kreise ließen
        // die Küste als Kette von Halbmonden erscheinen; die (verzerrten)
        // Sechsecke stoßen lückenlos aneinander und ergeben eine
        // durchgehende, unregelmäßige Uferlinie.
        mk.globalCompositeOperation='source-over';
        mk.clearRect(0,0,w,h);
        mk.save(); mk.translate(-c.ox,-c.oy);
        mk.fillStyle='#fff';
        const RC = L.soft? 30 : 36;                    // Zellradius (überlappt leicht)
        for(const i of L.nodes){
          const [px,py]=m.worldPos(i);
          const path=()=>{
            mk.beginPath();
            for(let k=0;k<7;k++){
              const a2=k*Math.PI/3 + hash01(i*11+1)*0.6;
              // jede Ecke einzeln ausgebeult -> der Rand franst nie regelmäßig aus
              const rr=RC*(0.82+hash01(i*17+k*5)*0.46);
              const qx=px+Math.cos(a2)*rr, qy=py+Math.sin(a2)*rr*0.86;
              if(k===0) mk.moveTo(qx,qy); else mk.lineTo(qx,qy);
            }
            mk.closePath();
          };
          // weicher Saum direkt in der Form – funktioniert ohne ctx.filter
          this.softShape(mk, path, px, py, L.soft? 7 : 5);
        }
        mk.restore();
        tex.globalCompositeOperation='destination-in';
        tex.drawImage(this._maskTmp,0,0);
        tex.globalCompositeOperation='source-over';
        g.globalAlpha= L.soft? 0.8 : L.key===TER.WATER? 0.72 : 1;
        g.drawImage(this._texTmp1,0,0,w,h);
        g.globalAlpha=1;
      }
      // Farb-Lasur: das weiche Farbnetz gibt Region, Küstennähe und Höhe vor,
      // die Kachel behält ihre Zeichnung ('color' übernimmt nur Farbton)
      {
        const bg=this._blurTmp.getContext('2d');
        bg.globalCompositeOperation='source-over';
        bg.clearRect(0,0,w,h);
        this.blurInto(bg, this._tmpChunk, 9, 1, W2, H2);
        g.save();
        g.globalCompositeOperation='color';
        g.globalAlpha=0.3;
        g.drawImage(this._blurTmp,0,0,w,h);
        g.restore();
      }
      // ---------- Bergmassiv: blockig facettierter Fels ----------
      // Referenzstil (Fels-Referenzbilder): große FLACHE Facetten mit klaren
      // Kanten, DREI Tonwerte (helle Deckflächen, mittlere lichtzugewandte
      // Flanken, dunkle Schattenseiten), warmes Hellgrau/Beige, Licht von
      // oben links – KEIN feinkörniges Rauschen. Die Dreiecke des Höhen-
      // netzes werden dazu über ein grobes, verwackeltes Gitter zu BLÖCKEN
      // gebündelt; jeder Block bekommt EINEN flachen, quantisierten Ton.
      // Fugen-/Lichtkantenpaare zwischen verschiedenen Tönen machen die
      // Blockkanten lesbar, quantisierte Höhenbänder terrassieren hohe
      // Massive, Felsnadeln und kantige Trümmer setzen Akzente. Alles
      // entsteht EINMAL im Chunk-Aufbau (nichts pro Frame) und ist
      // deterministisch aus Knotenindex/-position gehasht.
      {
        if(!this._rockPats) this._rockPats={};
        const pats=this._rockPats;
        // Muster mit Welt-Transformation, je (Bild, Lage) nur einmal erzeugt.
        // scy (optional): EIGENER y-Faktor. Die Wandkacheln sind seit der
        // Gebirgs-Lieferung nicht mehr quadratisch (1024x1536), die
        // Schichtung braucht deshalb eine getrennte Hoehenskala – ohne sie
        // laege die Wandzeichnung um das Seitenverhaeltnis daneben. Fehlt
        // scy, wird wie bisher uniform skaliert (alle Altaufrufer bleiben
        // unveraendert). Versatz gehoert in den Schluessel, sonst teilen
        // sich zwei Lagen mit gleichem Massstab dasselbe Muster.
        const patOf=(key,sc,rot,tx2,ty2,imOv,scy)=>{
          const sy=(scy===undefined||scy===null)? sc : scy;
          const ck=key+'|'+sc+'|'+sy+'|'+(rot||0)+'|'+(tx2||0)+'|'+(ty2||0);
          if(pats[ck]!==undefined) return pats[ck];
          const im=imOv||this.asset(key);
          let pt=null;
          if(im){
            pt=g.createPattern(im,'repeat');
            if(pt.setTransform){
              let mtx=new DOMMatrix();
              if(tx2||ty2) mtx=mtx.translate(tx2,ty2);
              if(rot) mtx=mtx.rotate(rot);
              pt.setTransform(mtx.scale(sc,sy));
            } else if(rot||sy!==sc) pt=null;   // ohne setTransform keine Zweitlage
          }
          pats[ck]=pt;
          return pt;
        };
        {
          const firnY=this.firnLine();
          const signs=this.game.signs;
          const PAL=this.rockPal();
          const [hlo,hhi]=this.massifHiLo();
          const spanH=(hhi-hlo)||1;
          // Umbau 2.5 (Gebirge-Papier): das Hoehenfeld wird VOR der
          // Schattierung terrassiert – NUR fuer den Massiv-Pass, reine
          // Zeichensache (m.hgt und damit Geometrie/Spiellogik unveraendert).
          // Formel aus dem Papier: Rauschen addieren (damit die Stufenkanten
          // nicht dem Gitter folgen), floor + smoothstep(0.72..1.0) auf den
          // Nachkommateil, Mischung 0.7. step=1.9 entspricht ~3.5 der
          // 0.55er-Hoehenstufen, auf die der Kartengenerator Fels einrastet.
          // Ergebnis: breite Plateaus und steile Stufen, die 2.4 automatisch
          // als Wand zeichnet.
          const TSTEP=1.9;
          const smT=(u)=> u<=0?0 : u>=1?1 : u*u*(3-2*u);
          const tvv=(xx,yy)=>hash01((Math.imul(xx,73856093)^Math.imul(yy,19349663)^0x7a3b)|0);
          const tnoise=(X,Y)=>{
            const gx0=X*0.7, gy0=Y*0.7;
            const x2=Math.floor(gx0), y2=Math.floor(gy0);
            const fx=smT(gx0-x2), fy=smT(gy0-y2);
            return (tvv(x2,y2)*(1-fx)+tvv(x2+1,y2)*fx)*(1-fy)
                 + (tvv(x2,y2+1)*(1-fx)+tvv(x2+1,y2+1)*fx)*fy;
          };
          const hTc=new Map();
          const hgtT=(q)=>{
            let v=hTc.get(q);
            if(v!==undefined) return v;
            const h9=m.hgt[q]+liftOf(q);   // G1: Anhebung geht in die Zeichnung ein
            if(!isMassif(q)) v=h9;      // Umland bleibt unangetastet
            else {
              const X9=m.X(q), Y9=m.Y(q);
              // Nutzer-Leitlinie B ("die Felsen sehen wie grosse TREPPEN
              // aus"): drei Stoerungen brechen den gleichmaessigen
              // Terrassen-Rhythmus.
              // 1) WARP (langsame Verschiebung): Stufenkanten wandern
              //    seitlich und verschmelzen stellenweise.
              // 2) KLUFT (vor allem laengs X laufendes Rauschen):
              //    senkrechte Phasenspruenge zerschneiden die
              //    waagerechten Baender in Sporne.
              // 3) MISCHUNG 0.45..0.85 statt fest 0.7: der Terrassierungs-
              //    grad schwankt – zwischen harten Stufen liegen gewoelbte
              //    Kuppen ganz ohne Band.
              const hIn=h9+(tnoise(X9,Y9)-0.5)*TSTEP*0.4
                        +(tnoise(X9*0.34+53,Y9*0.34+17)-0.5)*TSTEP*0.9
                        +(tnoise(X9*1.15+211,Y9*0.27+97)-0.5)*TSTEP*0.55;
              const t9=hIn/TSTEP, f9=t9-Math.floor(t9);
              const mix9=0.45+tnoise(X9*0.22+139,Y9*0.22+71)*0.40;
              v=h9*(1-mix9)+(Math.floor(t9)+smT((f9-0.72)/0.28))*TSTEP*mix9;
              // Bergwerks-Umfeld glaetten: die Mine steht nie quer ueber
              // einer gemalten Terrassenkante (Nutzerfoto IMG_7989)
              if(mineNodes.size){
                let mf=1;
                if(mineNodes.has(q)) mf=0;
                else { for(const b9 of m.nbs(q)) if(mineNodes.has(b9)){ mf=0.3; break; } }
                if(mf<1) v=h9*(1-mf)+v*mf;
              }
            }
            hTc.set(q,v);
            return v;
          };
          // Wölbung je Knoten: Grat (konvex) fängt Licht, Kessel (konkav)
          // liegt im Eigenschatten – das eingebaute Ambient-Occlusion
          const curv=new Map();
          const curvOf=(q)=>{
            let v=curv.get(q);
            if(v!==undefined) return v;
            let s2=0, n2=0;
            for(const b3 of m.nbs(q)){ s2+=hgtT(b3); n2++; }
            v=n2? hgtT(q)-s2/n2 : 0;
            curv.set(q,v);
            return v;
          };
          // Höhengradient je Knoten (roh, ungenormt) – die Facette wird aus
          // den GEMITTELTEN Eckgradienten beleuchtet statt aus ihrer eigenen
          // Flächennormalen: auf dem versetzten Gitter kippen Auf- und
          // Ab-Dreiecke einer Wand abwechselnd leicht nach Ost/West, mit
          // echten Normalen ergäbe das einen hell/dunklen Reißverschluss.
          const grad=new Map();
          const gradAt=(q)=>{
            let v=grad.get(q);
            if(v) return v;
            let gx=0, gy=0;
            for(const b3 of m.nbs(q)){
              const ddx=(m.X(b3)+((m.Y(b3)&1)*0.5))-(m.X(q)+((m.Y(q)&1)*0.5));
              const ddy=m.Y(b3)-m.Y(q);
              const dh=hgtT(b3)-hgtT(q);
              gx+=dh*ddx; gy+=dh*ddy;
            }
            v=[gx,gy];
            grad.set(q,v);
            return v;
          };
          // Steilheit auf dem TERRASSIERTEN Feld – Grundlage der cliffMask
          // (2.4) und der hangabhaengigen Schneedecke (2.6)
          const slopeT=(q)=>{ const gv=gradAt(q); return Math.hypot(gv[0],gv[1]); };
          // GROSSFORM-Gradient (Umbau 3.2): derselbe Operator, aber auf dem
          // ueber einen Knotenring GEMITTELTEN Hoehenfeld – der Gradient
          // reicht damit ueber zwei Ringe und ueberspringt die Terrassen-
          // stufen. Er liefert die grossen zusammenhaengenden Licht- und
          // Schattenhaenge, an denen das Auge die Bergform abliest; der
          // rohe Knotengradient sieht auf jeder Hochflaeche nur Null.
          const hSm=new Map();
          const hgtS=(q)=>{
            let v=hSm.get(q);
            if(v!==undefined) return v;
            let s2=hgtT(q), n2=1;
            for(const b3 of m.nbs(q)){ s2+=hgtT(b3); n2++; }
            v=s2/n2; hSm.set(q,v);
            return v;
          };
          const gradB=new Map();
          const gradBigAt=(q)=>{
            let v=gradB.get(q);
            if(v) return v;
            let gx=0, gy=0;
            for(const b3 of m.nbs(q)){
              const ddx=(m.X(b3)+((m.Y(b3)&1)*0.5))-(m.X(q)+((m.Y(q)&1)*0.5));
              const ddy=m.Y(b3)-m.Y(q);
              const dh=hgtS(b3)-hgtS(q);
              gx+=dh*ddx; gy+=dh*ddy;
            }
            v=[gx,gy];
            gradB.set(q,v);
            return v;
          };
          // Naehe zum BERGFUSS (1 = Randknoten, 0.55 = zweite Reihe, sonst 0):
          // Grundlage der Geroellzone (3) und der Moos-Einblendung. Einmal je
          // Knoten bestimmt und gecacht.
          const footC=new Map();
          const footOf=(q)=>{
            let v=footC.get(q);
            if(v!==undefined) return v;
            v=0;
            const nb=m.nbs(q);
            if(nb.some(b9=>!isMassif(b9))) v=1;
            else {
              for(const b9 of nb){ if(m.nbs(b9).some(c9=>!isMassif(c9))){ v=0.55; break; } }
            }
            footC.set(q,v);
            return v;
          };
          // --- Block-Gitter: jeder Knoten gehört zu EINEM Felsblock ---
          // Zentren auf einem groben, je Zelle verwackelten Gitter in
          // Knotenkoordinaten – deterministisch aus der Gitterzelle gehasht
          // und damit chunkübergreifend stabil (keine Nähte).
          const BQ=2.6;                       // Blockgröße in Knoten
          const bctr=(bx,by)=>{
            const j1=hash01((Math.imul(bx,73856093)^Math.imul(by,19349663)^0x51ab)|0);
            const j2=hash01((Math.imul(bx,83492791)^Math.imul(by,29349673)^0x2cd1)|0);
            return [(bx+0.18+j1*0.64)*BQ, (by+0.18+j2*0.64)*BQ];
          };
          const blockOfXY=(nx,ny)=>{
            const bx0=Math.floor(nx/BQ), by0=Math.floor(ny/BQ);
            let bk=0, bd=1e9;
            for(let by=by0-1;by<=by0+1;by++) for(let bx=bx0-1;bx<=bx0+1;bx++){
              const [zx,zy]=bctr(bx,by);
              // y leicht gewichtet: liegende Blöcke wie in den Referenzen
              const d=(zx-nx)*(zx-nx)+(zy-ny)*(zy-ny)*1.35;
              if(d<bd){ bd=d; bk=bx|(by<<10); }
            }
            return bk;
          };
          // Grundton je Block aus Gradient+Wölbung am Blockzentrum – global
          // deterministisch (Zentrum -> nächster Knoten), plus Blockvarianz
          const btone=new Map();
          const toneOf=(bk)=>{
            let v=btone.get(bk);
            if(v!==undefined) return v;
            const [zx,zy]=bctr(bk&1023, bk>>10);
            const cyi=Math.max(0,Math.min(m.h-1,Math.round(zy)));
            const cxi=Math.max(0,Math.min(m.w-1,Math.round(zx-((cyi&1)*0.5))));
            const cn=m.idx(cxi,cyi);
            const gv=gradAt(cn), cu=curvOf(cn);
            // Sonne aus Nordwest, stärker aus WEST als aus Nord (wie gehabt)
            let li=0.5+(gv[0]*0.75+gv[1]*0.5)*0.30;
            li += cu>0? cu*0.55 : cu*1.0;
            li += (hash01(bk*13+7)-0.5)*0.16;   // nicht jeder Block gleich
            btone.set(bk,li);
            return li;
          };
          // Höhenband-Faktoren (Fuß dunkler/wärmer, Gipfel fahler/kühler) -
          // seit Umbau 2.1 STETIG verlaufen statt in Stufen; die Mischung
          // übernimmt colAt() im Füllpass. Die Stufen t3.ci bleiben nur als
          // Metadaten für Fugen und Kantenlicht erhalten.
          const FB=[0.88,0.94,1.0,1.05,1.09];
          const kalt=[213,220,232];
          const warmOnly=(this.theme==='vulkan'||this.theme==='wueste');
          // 1) Fels-Dreiecke einsammeln: EIN flacher Blockton je Facette,
          //    dazu das Kantennetz (für Fugen- und Lichtkanten)
          const tris=[];
          const wp=new Map();
          const pos=(q)=>{
            let v=wp.get(q);
            if(!v){
              v=m.worldPos(q);
              const L9=liftOf(q);
              if(L9>0) v[1]-=L9*HSCALE;   // G1: gezeichnete Anhebung
              else if(!isMassif(q)){
                // Zeichnungs-Rueckzug (Kritik G4a): Wiesen-Ecken gemischter
                // Facetten ruecken ~1/3 zur Felsseite – der gemalte Fels
                // uebergreift die Logik um <0.5 Knoten, Baeume der
                // Nachbarwiese stehen frei statt mitten auf dem Band
                let ax9=0, ay9=0, n9=0;
                for(const b9 of m.nbs(q)) if(isMassif(b9)){
                  const P9=m.worldPos(b9); ax9+=P9[0]; ay9+=P9[1]; n9++;
                }
                if(n9){ v[0]+=(ax9/n9-v[0])*0.34; v[1]+=(ay9/n9-v[1])*0.34; }
              }
              wp.set(q,v);
            }
            return v;
          };
          const edges=new Map();
          const edge=(u,v,t3)=>{
            const k5= u<v? u*131072+v : v*131072+u;
            const e=edges.get(k5);
            if(e) e.b=t3; else edges.set(k5,{u,v,a:t3,b:null});
          };
          const facet=(a2,b2,c2)=>{
            let nr=0;
            if(isMassif(a2)) nr++;
            if(isMassif(b2)) nr++;
            if(isMassif(c2)) nr++;
            if(nr<1) return;
            if(nr===1){
              // Dreiecke mit nur EINER Fels-Ecke gehören normalerweise dem
              // Umland. Ausnahme Steilwand: dort spannen sie sich über die
              // ganze Absturzhöhe – blieben sie Wiese/Schnee, stünde am
              // Wandfuß ein Kamm aus hellen Zacken zwischen den Felszähnen.
              // Schwelle RELATIV zum Massiv-Relief (Kritik G1): auch kleine
              // Massive erreichen ihre Wandkante; Anhebung zaehlt mit.
              const hE=(q9)=>m.hgt[q9]+liftOf(q9);
              const hmax=Math.max(hE(a2),hE(b2),hE(c2));
              const hmin=Math.min(hE(a2),hE(b2),hE(c2));
              const rq=isMassif(a2)? a2 : isMassif(b2)? b2 : c2;
              // an ANGEHOBENEN Raendern (kleine Massive) grosszuegiger:
              // sonst bleiben Luecken zwischen den Wandzaehnen der Suedkante
              const thr9=Math.min(1.15, 0.55+relEffOf(rq)*0.28-(liftOf(rq)>0.25?0.3:0));
              if(hmax-hmin<Math.max(0.5,thr9)) return;
            }
            const A=pos(a2), B=pos(b2), C=pos(c2);
            // Block aus dem SCHWERPUNKT des Dreiecks: rastert die Voronoi-
            // Blockzellen sauber (Eckmehrheit ergab gezackte Sternkanten)
            const blk=blockOfXY(
              (m.X(a2)+((m.Y(a2)&1)*0.5)+m.X(b2)+((m.Y(b2)&1)*0.5)+m.X(c2)+((m.Y(c2)&1)*0.5))/3,
              (m.Y(a2)+m.Y(b2)+m.Y(c2))/3);
            // Grundstufe aus dem BLOCKton: der ganze Block liegt auf einer
            // Tonstufe – das macht die großen ruhigen Platten
            const li=Math.max(0.20, Math.min(0.86, toneOf(blk)));
            let qi= li<0.30?0 : li<0.44?1 : li<0.62?2 : li<0.77?3 : 4;
            // lokales Wandlicht aus den GEMITTELTEN Eckgradienten (auf dem
            // versetzten Gitter kippen Auf-/Ab-Dreiecke sonst abwechselnd
            // nach Ost/West – Reißverschluss). Es verschiebt die Stufe nur
            // an ECHTEN Wänden um ±1 – direktes Einmischen vor der
            // Quantisierung ließ auf zerklüfteten Massiven jedes Dreieck
            // einzeln kippen (Harlekinmuster statt Platten).
            const ga=gradAt(a2), gb=gradAt(b2), gc=gradAt(c2);
            const gx=(ga[0]+gb[0]+gc[0])/3, gy=(ga[1]+gb[1]+gc[1])/3;
            let lf=0.5+(gx*0.75+gy*0.5)*0.26;
            const cu=(curvOf(a2)+curvOf(b2)+curvOf(c2))/3;
            lf += cu>0? cu*0.5 : cu*0.95;
            if(lf>0.68 && qi<4) qi++;
            else if(lf<0.32 && qi>0) qi--;
            // Hohe Absturzwände (stark gestreckte Dreiecke) bleiben im
            // HalbSCHATTEN – die WAND soll lesbar sein, kein schwarzer Zahn
            // und keine gleißende Folie. Obergrenze 2 statt 3: helle Wand-
            // dreiecke neben dunklen lasen sich als Harlekin-Fächer.
            // Wand-Schwelle RELATIV zum Massiv-Relief (Kritik G1) und NUR
            // TALSEITIG (gyM<0: der Hang faellt nach Sueden, zum
            // Betrachter). Die gestreckten Facetten der RUECKSEITE (gyM>0)
            // sind die angehobene Silhouette, die die Wiese dahinter
            // verdeckt – dort Mauerwerk zu zeichnen ergab die
            // "Stuetzmauer einer Grube" (Nutzerfoto IMG_7988).
            const spanY=Math.max(A[1],B[1],C[1])-Math.min(A[1],B[1],C[1]);
            const relF=Math.max(relEffOf(a2),relEffOf(b2),relEffOf(c2));
            const gyM=(ga[1]+gb[1]+gc[1])/3;
            const wall9=spanY>ROWH*Math.min(1.7, 0.95+relF*0.35) && gyM<0;
            if(wall9) qi=Math.max(1,Math.min(2,qi));
            const hh=(hgtT(a2)+hgtT(b2)+hgtT(c2))/3;
            const u4=Math.max(0,Math.min(1,(hh-hlo)/spanH));
            const band=Math.min(4,(u4*5)|0);
            // Schwerpunkt fürs gerichtete Kantenlicht (Pass 4): die Licht-
            // kante liegt auf der SONNENSEITE der helleren Platte.
            // wl markiert Wanddreiecke – zwischen ihnen keine Fugen, eine
            // Absturzwand ist EINE Fläche (Fugen zerhackten sie in Zähne).
            const t3={A,B,C,ci:qi*5+band,blk, wl:wall9, gy:gyM,
                      qa:a2, qb:b2, qc:c2,
                      cx:(A[0]+B[0]+C[0])/3, cy:(A[1]+B[1]+C[1])/3};
            tris.push(t3);
            edge(a2,b2,t3); edge(b2,c2,t3); edge(c2,a2,t3);
          };
          for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++){
            for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
              const i=m.idx(x,y);
              const p2=y&1;
              const iE = x+1<m.w ? m.idx(x+1,y) : i;
              const iSW = m.inb(x-1+p2,y+1)? m.idx(x-1+p2,y+1) : i;
              const iSE = m.inb(x+p2,y+1)? m.idx(x+p2,y+1) : i;
              facet(i,iE,iSE);
              facet(i,iSE,iSW);
            }
          }
          // Massiv-Hüllrechteck in CHUNK-LOKALEN Weltkoordinaten: die
          // teuren Vollflächen-Pässe (Klippentextur, Firn, Schlagschatten,
          // Geröllband) beschneiden ihre Füll-/Compose-Schritte darauf –
          // auf Chunks mit schmalem Massivanteil spart das den Großteil
          // der Füllrate der hochaufgelösten Bake-Flächen (G3-Budget).
          let mbx0=1e9, mby0=1e9, mbx1=-1e9, mby1=-1e9;
          for(const t3 of tris){
            for(const P9 of [t3.A,t3.B,t3.C]){
              if(P9[0]<mbx0) mbx0=P9[0];
              if(P9[0]>mbx1) mbx1=P9[0];
              if(P9[1]<mby0) mby0=P9[1];
              if(P9[1]>mby1) mby1=P9[1];
            }
          }
          const mrx0=mbx0-c.ox, mry0=mby0-c.oy, mrx1=mbx1-c.ox, mry1=mby1-c.oy;
          mbx0=Math.max(0, mrx0-8); mby0=Math.max(0, mry0-8);
          mbx1=Math.min(w, mrx1+8); mby1=Math.min(h, mry1+8);
          const mbw=Math.max(0,mbx1-mbx0), mbh=Math.max(0,mby1-mby0);
          // grosszuegigere Huelle fuer den Firn: die Zellen ragen (senkrecht
          // gestreckt, ystr bis 1.8) gut 100 px ueber die Knoten hinaus
          const fbx0=Math.max(0, mrx0-110), fby0=Math.max(0, mry0-110);
          const fbx1=Math.min(w, mrx1+110), fby1=Math.min(h, mry1+110);
          const fbw=Math.max(0,fbx1-fbx0), fbh=Math.max(0,fby1-fby0);
          // Schlagschatten-Huelle: Versatz (bis 2.6 Kacheln) + Blur-Saum
          sbx0=Math.max(0, mrx0-40); sby0=Math.max(0, mry0-40);
          const sbx1=Math.min(w, mrx1+TILE*2.6*0.552+80), sby1=Math.min(h, mry1+TILE*2.6*0.834+80);
          sbw=Math.max(0,sbx1-sbx0); sbh=Math.max(0,sby1-sby0);
          if(tris.length){
            g.save(); g.translate(-c.ox,-c.oy);
            // Massiv-Umriss als EIN Beschnittpfad – alles Weitere (Decke,
            // Lasur, Erz, Firn, Licht) bleibt exakt innerhalb des Berges
            g.beginPath();
            for(const t3 of tris){
              g.moveTo(t3.A[0],t3.A[1]); g.lineTo(t3.B[0],t3.B[1]);
              g.lineTo(t3.C[0],t3.C[1]); g.closePath();
            }
            g.clip();
            // 2) Facetten DECKEND und FLACH füllen – erst auf die Zwischen-
            //    fläche (nach Farbe gebündelt: benachbarte gleichfarbige
            //    Dreiecke verschmelzen im selben Pfad nahtlos), dann in
            //    EINEM Zug auflegen. Die Zwischenfläche wird unten für das
            //    durchscheinende Relief der Firndecke wiederverwendet.
            {
              const sg2=this._shadeTmp.getContext('2d');
              sg2.globalCompositeOperation='source-over';
              sg2.clearRect(0,0,w,h);
              sg2.save(); sg2.translate(-c.ox,-c.oy);
              // Umbau 2.1 (Gebirge-Papier): Helligkeit je ECKE aus dem
              // gemittelten Knotengradienten, im Dreieck LINEAR interpoliert
              // (b = 0.55 + 0.45*dot(n,L)). Die Tonstufen-Quantisierung ist
              // ersatzlos gestrichen - sie erzeugte Bänder, die exakt an den
              // Dreieckskanten umsprangen; die Stufen (t3.ci) leben nur noch
              // als Metadaten für Fugen und Kantenlicht weiter. Ein Linear-
              // verlauf ist die EXAKTE Ebene durch die drei Eckwerte.
              const lerp5=(a9,b9,t9)=>a9+(b9-a9)*t9;
              const colAt=(s9,u9)=>{
                const p9=Math.max(0,Math.min(3.999,(s9-0.20)/0.66*4));
                const i9=p9|0, f9=p9-i9, P0=PAL[i9], P1=PAL[Math.min(4,i9+1)];
                const pb=Math.max(0,Math.min(3.999,u9*4));
                const j9=pb|0, fu=pb-j9;
                const fb=lerp5(FB[j9],FB[Math.min(4,j9+1)],fu);
                let r9=lerp5(P0[0],P1[0],f9)*fb;
                let g9=lerp5(P0[1],P1[1],f9)*fb;
                let b9=lerp5(P0[2],P1[2],f9)*fb;
                // Ambient aus der Wiese (Papier §3): #5C5540 dezent in die
                // Schatten – bindet den Fels an das Gruen der Umgebung.
                // Nicht auf Vulkan/Wueste (eigene Farbwelt) und nicht im
                // Winter (dort liegt keine gruene Wiese um den Berg).
                if(!warmOnly && this.theme!=='winter' && s9<0.42){
                  const ta=Math.min(0.16,(0.42-s9)*0.6);
                  r9+=(92-r9)*ta; g9+=(85-g9)*ta; b9+=(64-b9)*ta;
                }
                if(!warmOnly && u9>0.55){
                  const t4=Math.min(0.10,(u9-0.55)*0.28);
                  r9+=(kalt[0]-r9)*t4; g9+=(kalt[1]-g9)*t4; b9+=(kalt[2]-b9)*t4;
                }
                // Spitzlicht-Deckel (Befund im Umbau-Papier: der Fels war
                // 45 % heller als alles andere im Bild und sprang heraus)
                // (Umbau 3.2: 182 statt 156. Der Deckel lag so tief, dass
                //  ALLE Sonnenhaenge auf demselben Wert einrasteten – die
                //  Grossform wurde oben abgeschnitten. Der Multiply-Zug der
                //  Lasur (3.2b) nimmt die Anhebung wieder heraus; gemessen
                //  am Endbild nach ALLEN Paessen liegt der hellste Felspixel
                //  bei 171, also unter dem Ziel 180.)
                const lum=0.299*r9+0.587*g9+0.114*b9;
                if(lum>182){ const f0=182/lum; r9*=f0; g9*=f0; b9*=f0; }
                return [r9|0,g9|0,b9|0];
              };
              const uAt=(q)=>Math.max(0,Math.min(1,(hgtT(q)-hlo)/spanH));
              const vsh=new Map();
              const shadeAt=(q)=>{
                let v=vsh.get(q);
                if(v!==undefined) return v;
                const gv=gradAt(q), gb=gradBigAt(q);
                // Umbau 3.2 (Nutzerkritik "dem Berg fehlt die GROSSFORM"):
                // die Schattierung lief bisher NUR ueber den lokalen
                // Knotengradienten. Auf einem terrassierten Massiv ist der
                // auf allen Hochflaechen nahe 0 – das ganze Massiv lag damit
                // auf einem Ton, und die Textur war das einzige Signal.
                // Jetzt tragen den Ton drei Beitraege, vom Grossen zum
                // Kleinen:
                //  a) GROSSFORM: Gradient des ueber zwei Knotenringe
                //     geglaetteten Hoehenfelds. Er ueberspringt Terrassen-
                //     stufen und zeichnet ganze Sonnen- und Schattenhaenge.
                //  b) HOEHENLAGE im Massiv: Gipfel hell, Fuss dunkel – die
                //     zweite grosse Tonwertflaeche, die ein Berg braucht.
                //  c) lokaler Hang: nur noch Feinzeichnung.
                const dB=(gb[0]*0.75+gb[1]*0.5)*0.62;
                const dL=(gv[0]*0.75+gv[1]*0.5)*0.14;
                const d9=Math.max(-1,Math.min(1,dB+dL));
                v=0.55+0.50*d9;
                v+=(uAt(q)-0.44)*0.44;
                const cu=curvOf(q);
                v+= cu>0? cu*0.5 : cu*0.85;
                // Umbau 2.7c (Gebirge-Papier): Gratlicht +0.12 auf KONVEXEN,
                // klar sonnenzugewandten Kanten – der Grat bekommt eine
                // Lichtkante, ohne dass eine Linie gezeichnet werden muss
                if(cu>0.02 && d9>0.30)
                  v+=0.14*Math.min(1,(cu-0.02)*10)*Math.min(1,(d9-0.30)*4);
                v=Math.max(0.21,Math.min(0.90,v));
                vsh.set(q,v);
                return v;
              };
              for(const t3 of tris){
                const {A,B,C}=t3;
                // leise Blockvarianz: trennt die Platten tonal, der Sprung
                // liegt exakt auf der gezeichneten Fuge
                const jb=(hash01(t3.blk*13+7)-0.5)*0.10;
                let sA=shadeAt(t3.qa)+jb, sB=shadeAt(t3.qb)+jb, sC=shadeAt(t3.qc)+jb;
                // Absturzwände bleiben im Halbschatten - WEICH komprimiert
                // statt hart gedeckelt (der harte Deckel riss sichtbare
                // Helligkeitskanten zwischen Wand- und Plateaudreiecken auf)
                if(t3.wl){
                  const cap=(s9)=> s9>0.58? 0.58+(s9-0.58)*0.30 : s9;
                  sA=cap(sA); sB=cap(sB); sC=cap(sC);
                }
                const uA2=uAt(t3.qa), uB2=uAt(t3.qb), uC2=uAt(t3.qc);
                const d1x=B[0]-A[0], d1y=B[1]-A[1], f1=sB-sA;
                const d2x=C[0]-A[0], d2y=C[1]-A[1], f2=sC-sA;
                const det9=d1x*d2y-d1y*d2x;
                const span9=Math.max(sA,sB,sC)-Math.min(sA,sB,sC);
                sg2.beginPath();
                sg2.moveTo(A[0],A[1]); sg2.lineTo(B[0],B[1]);
                sg2.lineTo(C[0],C[1]); sg2.closePath();
                let fill9;
                if(span9<0.015 || Math.abs(det9)<1e-6){
                  const cm=colAt((sA+sB+sC)/3,(uA2+uB2+uC2)/3);
                  fill9='rgb('+cm[0]+','+cm[1]+','+cm[2]+')';
                } else {
                  // Ebenen-Gradient der Helligkeit + Höhe an den Endpunkten
                  const bx9=(f1*d2y-f2*d1y)/det9, by9=(f2*d1x-f1*d2x)/det9;
                  const n9=bx9*bx9+by9*by9;
                  const tA=bx9*A[0]+by9*A[1], tB=bx9*B[0]+by9*B[1], tC=bx9*C[0]+by9*C[1];
                  const tmin=Math.min(tA,tB,tC), tmax=Math.max(tA,tB,tC);
                  const p0x=A[0]+bx9*(tmin-tA)/n9, p0y=A[1]+by9*(tmin-tA)/n9;
                  const p1x=A[0]+bx9*(tmax-tA)/n9, p1y=A[1]+by9*(tmax-tA)/n9;
                  const g1=uB2-uA2, g2=uC2-uA2;
                  const ux9=(g1*d2y-g2*d1y)/det9, uy9=(g2*d1x-g1*d2x)/det9;
                  const u0=uA2+ux9*(p0x-A[0])+uy9*(p0y-A[1]);
                  const u1=uA2+ux9*(p1x-A[0])+uy9*(p1y-A[1]);
                  const c0=colAt(sA+(tmin-tA), Math.max(0,Math.min(1,u0)));
                  const c1=colAt(sA+(tmax-tA), Math.max(0,Math.min(1,u1)));
                  const lg9=sg2.createLinearGradient(p0x,p0y,p1x,p1y);
                  lg9.addColorStop(0,'rgb('+c0[0]+','+c0[1]+','+c0[2]+')');
                  lg9.addColorStop(1,'rgb('+c1[0]+','+c1[1]+','+c1[2]+')');
                  fill9=lg9;
                }
                sg2.fillStyle=fill9;
                sg2.fill();
                // Haarriss-Fugen zwischen einzeln gefüllten Dreiecken zudecken
                sg2.strokeStyle=fill9; sg2.lineWidth=1; sg2.lineJoin='round';
                sg2.stroke();
              }
              // (2b Plattenvolumen entfällt: die interpolierte Vertex-
              //  Schattierung liefert das Volumen jetzt direkt)
              sg2.restore();
              g.drawImage(this._shadeTmp, c.ox, c.oy, w, h);
            }
            // 3) Detail-Lasur (Stilguide 11.1): die Textur muss LAUTER sein
            //    als die Schattierung, sonst scheint das Dreiecksgitter durch.
            //    Kennwert (p95/p5 der Luminanz)/1.82, Zielband 1.2-1.5.
            //    ter_rock_top (verwitterter Fels) traegt die Flaeche.
            //    Dazu drei weitere Kacheln aus der Lieferung:
            //      ter_rock_top2   ZWEITE LAGE per Rauschmaske – gegen den
            //                      Fehler "Kachel liest sich als Kiesbett"
            //                      (11.8: "im Shader zweite Textur-Lage per
            //                      Rauschmaske"). Grosse Platten in Nestern,
            //                      nicht flaechendeckend.
            //      ter_rock_rubble Geroell-/Uebergangszone am Bergfuss; dort
            //                      ERSETZT die kantige Schuttkachel die feine
            //                      Platte (Kritik "graue Matschwolken").
            //      ter_rock_moss   niedrigste Massivlagen nahe der Wiese,
            //                      ueber die Hoehe weich eingeblendet (drei
            //                      Alphastufen mit verrauschter Grenze –
            //                      keine harte Kante, keine Hoehenlinie).
            {
              // Umbau 2.2 bleibt: KRUMME Vielfache der Kantenlänge, damit das
              // Muster nie am Dreiecksgitter einrastet und die Wiederholung
              // verschwindet. tintedSpire toent die Kachel auf die Thema-
              // Felspalette (Winter grau, Vulkan dunkel).
              const imT=this.felsLasur('ter_rock_top');
              const w3=imT? (imT.naturalWidth||imT.width) : 1024;
              const det1= imT? patOf('ter_rock_top',(TILE*FM_TOP)/w3,0,0,0,imT) : null;
              if(det1){
                // Lasur-Alpha ist am Kennwert aus 11.1 eingestellt (gemessen
                // am Endbild, nicht geschaetzt). Auf dunklem Vulkanfels
                // wirkt die Aufhellung doppelt so stark -> dort drosseln.
                // Umbau 3.2: leicht zurueckgenommen (0.86 -> 0.78). Weiter
                // herunter (probiert: 0.50 und 0.62) verlieren die Platten
                // ihre Fugen und die Flaeche wird teigig – die Lasur ist bei
                // grossem Massstab NICHT der Gegner der Form: sie arbeitet
                // auf 30 Weltpixeln (Plattenmass), die Form auf mehreren
                // hundert. Die beiden Frequenzen stoeren sich nicht. Was die
                // Form in v81 erschlug, war der Spitzlicht-Deckel bei 156,
                // auf dem alle Sonnenhaenge einrasteten.
                const aBase= this.theme==='vulkan'? 0.53
                           : this.theme==='winter'? 0.68 : 0.78;
                // Umbau 3.2b: EIN leiser MULTIPLY-Zug VOR dem Overlay.
                // 'overlay' verhaelt sich auf Untergruenden ueber 128 wie
                // 'screen' – genau auf den grossen SONNENHAENGEN, die 3.2
                // erst hell gemacht hat, wusch es die Plattenzeichnung weiss.
                // Die hellen Grossflaechen standen dann als glatte Keile
                // ohne Fugen im Bild. 'multiply' traegt ueberall gleich und
                // holt die Fugen im Licht zurueck; die Verdunklung faengt
                // der angehobene Spitzlicht-Deckel (182) wieder auf.
                g.globalCompositeOperation='multiply';
                g.fillStyle=det1;
                g.globalAlpha=aBase*0.30;
                g.fillRect(c.ox,c.oy,w,h);
                g.globalCompositeOperation='overlay';
                g.globalAlpha=aBase;
                g.fillRect(c.ox,c.oy,w,h);
                // --- zweite und dritte Lage per Rauschmaske ---
                // Der grosse Massstab aus 3.1 laesst eine Kachel 385 Welt-
                // pixel (7,4 Knoten) ueberdecken. Innerhalb eines Bildes
                // wiederholt sie sich damit kaum noch – dafuer faellt jede
                // Wiederholung staerker auf. Dagegen stehen zwei weitere
                // Lagen in Nestern: ter_rock_top2 in eigenem Massstab und
                // eigener Phase, dazu ter_rock_top selbst noch einmal,
                // GEDREHT (29 Grad) und anders phasenversetzt. Beide Masken
                // kommen aus DEMSELBEN Rauschfeld (ein Durchlauf ueber die
                // Dreiecke), damit das Budget nicht zweimal bezahlt wird.
                const imT2=this.felsLasur('ter_rock_top2');
                const w4=imT2? (imT2.naturalWidth||imT2.width) : 1024;
                const det2= imT2? patOf('ter_rock_top2',(TILE*FM_TOP2)/w4,0,
                                        TILE*0.37, TILE*0.71, imT2) : null;
                const det3= patOf('ter_rock_top',(TILE*FM_DRITT)/w3,29,
                                  TILE*2.9, TILE*1.7, imT);
                if(det2||det3){
                  const n2=[], n3=[];
                  for(const t3 of tris){
                    const X9=(m.X(t3.qa)+m.X(t3.qb)+m.X(t3.qc))/3;
                    const Y9=(m.Y(t3.qa)+m.Y(t3.qb)+m.Y(t3.qc))/3;
                    const f9=tnoise(X9*0.62+311,Y9*0.62+83);
                    if(f9>=0.58) n2.push(t3);
                    else if(f9<=0.34) n3.push(t3);
                  }
                  const zug=(list,pat,al)=>{
                    if(!list.length||!pat) return;
                    g.beginPath();
                    for(const t3 of list){
                      g.moveTo(t3.A[0],t3.A[1]); g.lineTo(t3.B[0],t3.B[1]);
                      g.lineTo(t3.C[0],t3.C[1]); g.closePath();
                    }
                    g.fillStyle=pat; g.globalAlpha=al; g.fill();
                  };
                  zug(n2,det2,aBase*0.72);
                  zug(n3,det3,aBase*0.66);
                }
                // --- Geroellzone am Bergfuss: ter_rock_rubble ---
                const imR=this.felsLasur('ter_rock_rubble');
                if(imR){
                  const w5=imR.naturalWidth||imR.width;
                  // Schutt darf FEINER bleiben als die Hauptflaeche (halbes
                  // Plattenmass), aber 5 Weltpixel wie in v81 waren Sand.
                  const detR=patOf('ter_rock_rubble',(TILE*FM_RUBBLE)/w5,0,
                                   TILE*0.53, TILE*0.19, imR);
                  if(detR){
                    let anyR=false;
                    g.beginPath();
                    for(const t3 of tris){
                      if(t3.wl) continue;              // Waende bleiben Wand
                      const fo=Math.max(footOf(t3.qa),footOf(t3.qb),footOf(t3.qc));
                      if(fo<0.5) continue;
                      // verrauschte Grenze: kein gleichmaessiger Ring um den
                      // Berg (Leitlinie B)
                      const X9=(m.X(t3.qa)+m.X(t3.qb)+m.X(t3.qc))/3;
                      const Y9=(m.Y(t3.qa)+m.Y(t3.qb)+m.Y(t3.qc))/3;
                      if(fo<0.9 && tnoise(X9*0.85+41,Y9*0.85+167)<0.46) continue;
                      anyR=true;
                      g.moveTo(t3.A[0],t3.A[1]); g.lineTo(t3.B[0],t3.B[1]);
                      g.lineTo(t3.C[0],t3.C[1]); g.closePath();
                    }
                    if(anyR){
                      g.fillStyle=detR;
                      g.globalAlpha=Math.min(0.86,aBase*1.5);
                      g.fill();
                    }
                  }
                }
                g.globalAlpha=1;
                g.globalCompositeOperation='source-over';
                // --- Moos in den niedrigsten Massivlagen ---
                // NICHT auf Vulkan/Wueste/Winter: dort waechst nichts, und
                // Gruen in der grauen bzw. dunklen Palette laese sich als
                // Fehlfarbe. Die Kachel bleibt UNGETOENT (tintedSpire zoege
                // ihr das Gruen heraus).
                const imM= (warmOnly||this.theme==='winter')? null : this.asset('ter_rock_moss');
                if(imM && imM.naturalWidth){
                  const detM=patOf('ter_rock_moss',(TILE*FM_MOSS)/imM.naturalWidth,0,
                                   TILE*0.83, TILE*0.29, imM);
                  if(detM){
                    // Hoehenlage 0 (Fuss) .. 1 (Gipfel), mit Rauschen
                    // aufgeweicht; drei Alphastufen ergeben zusammen mit dem
                    // Rauschen einen weichen Verlauf ohne Hoehenlinie.
                    // EIN Durchlauf ueber die Dreiecke, danach je Stufe ein
                    // Zug – die Hoehenlage ist der teure Teil (G3-Budget).
                    const STUF=[[0.16,1.00],[0.30,0.62],[0.44,0.30]];
                    const kb=[[],[],[]];
                    for(const t3 of tris){
                      const hm=(hgtT(t3.qa)+hgtT(t3.qb)+hgtT(t3.qc))/3;
                      const u0=(hm-hlo)/spanH;
                      if(u0>=0.60) continue;          // grob vorsortiert
                      const X9=(m.X(t3.qa)+m.X(t3.qb)+m.X(t3.qc))/3;
                      const Y9=(m.Y(t3.qa)+m.Y(t3.qb)+m.Y(t3.qc))/3;
                      const u9=u0+(tnoise(X9*0.74+7,Y9*0.74+229)-0.5)*0.17;
                      if(u9<0) continue;
                      const k9= u9<STUF[0][0]? 0 : u9<STUF[1][0]? 1 : u9<STUF[2][0]? 2 : -1;
                      if(k9>=0) kb[k9].push(t3);
                    }
                    g.globalCompositeOperation='overlay';
                    g.fillStyle=detM;
                    for(let k9=0;k9<3;k9++){
                      if(!kb[k9].length) continue;
                      g.beginPath();
                      for(const t3 of kb[k9]){
                        g.moveTo(t3.A[0],t3.A[1]); g.lineTo(t3.B[0],t3.B[1]);
                        g.lineTo(t3.C[0],t3.C[1]); g.closePath();
                      }
                      g.globalAlpha=0.46*STUF[k9][1];
                      g.fill();
                    }
                    g.globalAlpha=1;
                    g.globalCompositeOperation='source-over';
                  }
                }
              }
            }
            // 3b) Umbau 2.4 (Gebirge-Papier), Klippenpass: steile Haenge
            //     zeigen die WANDtextur ter_rock_cliff statt der Draufsicht-
            //     Lasur. Verankerung sinngemaess zu uvCliff des Papiers:
            //     horizontal die Welt-x-Achse, vertikal die Welt-y-Achse des
            //     Bildschirms – die projizierte y-Koordinate enthaelt den
            //     Hoehenversatz (worldPos zieht hgt*HSCALE ab), an einer Wand
            //     ist sie also praktisch die Hoehenachse: die Schichtbaender
            //     liegen waagerecht am Bildschirm und wandern mit der Hoehe.
            //     cliffMask als smoothstep ueber die terrassierte Steilheit
            //     (Papier: 0.42-0.62 auf normierter slope; auf die hiesige
            //     Gradientenmetrik uebertragen: p50~2.0, p75~3.0 der
            //     Massivknoten -> Fenster 2.0..3.2). Die Maske wird je ECKE
            //     bestimmt und ueber das Dreieck interpoliert (drei additive
            //     Alpha-Verlaeufe wie beim Gouraud) – kein hartes Umschalten
            //     je Dreieck. Wanddreiecke (t3.wl) sind immer Wand.
            {
              const imC=this.felsLasur('ter_rock_cliff');
              if(imC){
                const cmv=new Map();
                const cmOf=(q)=>{
                  let v=cmv.get(q);
                  if(v!==undefined) return v;
                  // Schwelle RELATIV zum Massiv-Relief (Kritik G1): kleine
                  // Massive kippen frueher in die Wandtextur
                  const thrC=Math.max(1.30, Math.min(2.0, relEffOf(q)*0.85));
                  v= m.terr[q]===TER.LAVA? 0 : smT((slopeT(q)-thrC)/1.2);
                  cmv.set(q,v);
                  return v;
                };
                const mk4=this._maskTmp.getContext('2d');
                mk4.globalCompositeOperation='source-over';
                mk4.clearRect(0,0,w,h);
                mk4.globalCompositeOperation='lighter';
                mk4.save(); mk4.translate(-c.ox,-c.oy);
                let anyC=false;
                for(const t3 of tris){
                  let ma=cmOf(t3.qa), mb=cmOf(t3.qb), mc=cmOf(t3.qc);
                  if(t3.wl){ ma=Math.max(ma,0.9); mb=Math.max(mb,0.9); mc=Math.max(mc,0.9); }
                  // Rueckseite (Silhouette zur Wiese dahinter): dort keine
                  // Mauerwerk-Textur – der Rand ist Deckflaeche/Grat
                  if(t3.gy>0.08){ ma*=0.18; mb*=0.18; mc*=0.18; }
                  if(ma+mb+mc<0.05) continue;
                  anyC=true;
                  const P=[t3.A,t3.B,t3.C], AL=[ma,mb,mc];
                  const path=()=>{ mk4.beginPath();
                    mk4.moveTo(P[0][0],P[0][1]); mk4.lineTo(P[1][0],P[1][1]);
                    mk4.lineTo(P[2][0],P[2][1]); mk4.closePath(); };
                  let flat=false;
                  for(let k=0;k<3 && !flat;k++){
                    const A=P[k], B=P[(k+1)%3], D=P[(k+2)%3];
                    const ex=D[0]-B[0], ey=D[1]-B[1];
                    const L9=ex*ex+ey*ey;
                    if(L9<1e-6){ flat=true; break; }
                    const t9=((A[0]-B[0])*ex+(A[1]-B[1])*ey)/L9;
                    const fx=B[0]+ex*t9, fy=B[1]+ey*t9;
                    if(Math.hypot(A[0]-fx,A[1]-fy)<0.5){ flat=true; break; }
                    const gr9=mk4.createLinearGradient(fx,fy,A[0],A[1]);
                    gr9.addColorStop(0,'rgba(255,255,255,0)');
                    gr9.addColorStop(1,'rgba(255,255,255,'+AL[k].toFixed(3)+')');
                    mk4.fillStyle=gr9;
                    path(); mk4.fill();
                  }
                  if(flat){
                    mk4.fillStyle='rgba(255,255,255,'+((AL[0]+AL[1]+AL[2])/3).toFixed(3)+')';
                    path(); mk4.fill();
                  }
                }
                mk4.restore();
                mk4.globalCompositeOperation='source-over';
                if(anyC && mbw>0 && mbh>0){
                  const tex4=this._texTmp.getContext('2d');
                  tex4.globalCompositeOperation='source-over';
                  tex4.clearRect(0,0,w,h);
                  // alles auf das Massiv-Hüllrechteck beschneiden (G3-Budget)
                  tex4.save();
                  tex4.beginPath(); tex4.rect(mbx0,mby0,mbw,mbh); tex4.clip();
                  tex4.save(); tex4.translate(-c.ox,-c.oy);
                  // Bandmassstab: die Wandkachel ist 1024x1536 (Stilguide
                  // 11.11) und traegt Bloecke von rund 135x140 Bildpixeln.
                  // scX=0.225 -> eine Saeule ist 30 Weltpixel breit, gut ein
                  // halber Knotenabstand; ueber eine typische Wand laufen
                  // damit 3-5 Saeulen. 0.225 ist ein krummes Verhaeltnis zu
                  // TILE/ROWH – kein Einrasten am Gitter.
                  //
                  // Stilguide 11.11: cliffScale.y = cliffScale.x * 1.5 / 0.64
                  // (Seitenverhaeltnis x Stauchung bei 40 Grad) = 2.344.
                  // Die Wandkachel ist mit 1024x1536 nicht quadratisch, ihre
                  // Bloecke sind im Bild rund 135x140 px, also fast quadrat-
                  // isch. Uniform gezeichnet stehen auf dem Schirm ebenso
                  // quadratische Bloecke – und damit fuehrt die waagerechte
                  // SCHICHTUNG, was 11.8 ausdruecklich verbietet
                  // ("Wandtextur wie Trockenmauerwerk: Schichtung fuehrt
                  // statt zu folgen -> Baender zuruecknehmen, Saeulen
                  // dominieren lassen"). Mit der Formel wird die Kachel in
                  // der Hoehe gestreckt: aus 30x31 px Bloecken werden
                  // 30x74 px SAEULEN, die Baender treten zurueck. Das
                  // arbeitet zugleich gegen Leitlinie B – waagerechte
                  // Baender auf jeder Terrassenstufe lasen sich als Treppe.
                  const CST=1.5/0.64;
                  const patC=patOf('ter_rock_cliff',0.19,0,0,0,imC,0.19*CST);
                  tex4.fillStyle=patC||'#8a7e68';
                  tex4.fillRect(c.ox,c.oy,w,h);
                  // Leitlinie B (keine gleichmaessigen TREPPEN): jedes WAND-
                  // SEGMENT bekommt deterministisch eine eigene Lage aus
                  // Kachel (cliff/cliff2), Massstab und PHASE. Damit laufen
                  // die Schichtbaender nicht mehr im selben Takt quer ueber
                  // alle Terrassenstufen. Vier Toepfe, der erste ist die
                  // Grundfuellung oben – es bleiben drei Zusatzlagen.
                  const imC2=this.felsLasur('ter_rock_cliff2')||imC;
                  const LAGEN=[
                    // [von, bis, Bild, scX, tx, ty]
                    [0.30,0.55, imC,  0.237, 37, 61],
                    [0.55,0.80, imC2, 0.19,   0,  0],
                    [0.80,1.01, imC2, 0.221, 91, 23],
                  ];
                  // EIN Durchlauf sortiert die Dreiecke in die Toepfe, danach
                  // je Topf ein Beschnitt-Zug (G3-Budget)
                  const tb9=[[],[],[]];
                  for(const t3 of tris){
                    const hB=hash01(t3.blk*29+3);
                    if(hB<0.30) continue;
                    tb9[hB<0.55? 0 : hB<0.80? 1 : 2].push(t3);
                  }
                  for(let k9=0;k9<3;k9++){
                    if(!tb9[k9].length) continue;
                    const L=LAGEN[k9];
                    const pL=patOf(L[2]===imC?'ter_rock_cliff':'ter_rock_cliff2',
                                   L[3],0,L[4],L[5],L[2],L[3]*CST);
                    if(!pL) continue;
                    tex4.save();
                    tex4.beginPath();
                    for(const t3 of tb9[k9]){
                      tex4.moveTo(t3.A[0],t3.A[1]); tex4.lineTo(t3.B[0],t3.B[1]);
                      tex4.lineTo(t3.C[0],t3.C[1]); tex4.closePath();
                    }
                    tex4.clip();
                    tex4.fillStyle=pL;
                    tex4.fillRect(c.ox,c.oy,w,h);
                    tex4.restore();
                  }
                  tex4.restore();
                  // Facettenlicht der Wand uebernehmen: die Toene aus Pass 2
                  // (liegen noch in _shadeTmp) weichgezeichnet als Weichlicht
                  // auf die Wandtextur – die Wand bleibt im Halbschatten der
                  // Vertex-Schattierung statt flach beleuchtet zu wirken
                  {
                    const bgC=this._blurTmp.getContext('2d');
                    bgC.globalCompositeOperation='source-over';
                    bgC.clearRect(0,0,w,h);
                    this.blurInto(bgC, this._shadeTmp, 4*S);
                    tex4.globalCompositeOperation='soft-light';
                    tex4.globalAlpha=0.88;
                    tex4.drawImage(this._blurTmp,0,0,w,h);
                    // Umbau 3.3 (Nutzerkritik "MATERIALBRUCH"): die Wand las
                    // sich deutlich dunkler und KAELTER (graugruen) als die
                    // beige Flaeche darueber – wie anderes Gestein statt wie
                    // die beschattete Seite desselben Berges. Ursache: die
                    // Wandkachel wurde DECKEND aufgelegt, ihre von felsLasur
                    // fast neutralisierte Eigenfarbe ersetzte die Palette aus
                    // colAt. Jetzt zieht ein 'color'-Zug Farbton UND
                    // Saettigung aus den (weichgezeichneten) Facettentoenen –
                    // die Wand behaelt ihre eigene HELLIGKEIT und damit die
                    // senkrechte Kluefzung, sitzt aber in derselben
                    // Farbfamilie wie die Deckflaeche (Palette 11.2).
                    tex4.globalCompositeOperation='color';
                    tex4.globalAlpha=0.92;
                    tex4.drawImage(this._blurTmp,0,0,w,h);
                    tex4.globalAlpha=1;
                  }
                  tex4.globalCompositeOperation='destination-in';
                  tex4.drawImage(this._maskTmp,0,0,w,h);
                  tex4.globalCompositeOperation='source-over';
                  tex4.restore();   // Hüllrechteck-Clip
                  // 0.78 statt 0.92: der Facettenton (und mit ihm die
                  // Grossform aus 3.2) scheint durch die Wandzeichnung durch,
                  // statt von ihr zugedeckt zu werden.
                  g.globalAlpha=0.78;
                  g.drawImage(this._texTmp, mbx0*S, mby0*S, mbw*S, mbh*S,
                              c.ox+mbx0, c.oy+mby0, mbw, mbh);
                  g.globalAlpha=1;
                }
              }
            }
            // 4) Fugen + Kantenlicht, GERICHTET statt Drahtgitter: jede
            //    Blockfuge bekommt einen breiten, sehr weichen AO-Saum und
            //    eine schlanke Fuge, deren Kraft mit dem TONSPRUNG wächst.
            //    Das helle Kantenlicht liegt nur noch auf SONNENZUGEWANDTEN
            //    Kanten der jeweils helleren Platte (Referenzen: die Platten
            //    sind an ihrer Nordwestkante hell gesäumt, die Südostkanten
            //    verschwinden im Fugenschatten). Ein gleichmäßiger Doppel-
            //    strich um alles herum – das alte Drahtgitter – entfällt.
            //    Silhouettenkanten (nur ein Dreieck) macht das Geröllband.
            {
              const ao=new Path2D(), soft=new Path2D();
              const dark=new Path2D(), dark2=new Path2D();
              const lite=new Path2D(), lite2=new Path2D();
              let nE=0, nL=0;
              const SXD=-0.552, SYD=-0.834;    // Sonne aus Nordwest
              for(const e of edges.values()){
                if(!e.b) continue;
                if(e.a.blk===e.b.blk && e.a.ci===e.b.ci) continue;
                const P1=pos(e.u), P2=pos(e.v);
                if(e.a.blk===e.b.blk){
                  // reiner Terrassen-/Bandwechsel im selben Block: nur eine
                  // leise Knickfalte – volle Fugen ergaben auf sanften
                  // Hängen ein Drahtgitter ohne sichtbaren Tonsprung
                  soft.moveTo(P1[0]+0.5,P1[1]+0.7); soft.lineTo(P2[0]+0.5,P2[1]+0.7);
                  nE++; continue;
                }
                // Wand-zu-Wand-Kanten: nur leise Knickfalte – die Wand ist
                // EINE Fläche, Blockfugen zerschnitten sie in Einzelzähne
                if(e.a.wl && e.b.wl){
                  soft.moveTo(P1[0]+0.5,P1[1]+0.7); soft.lineTo(P2[0]+0.5,P2[1]+0.7);
                  nE++; continue;
                }
                const qa=(e.a.ci/5)|0, qb=(e.b.ci/5)|0;
                const dq=Math.abs(qa-qb);
                // AO-Saum NUR an echten Tonstufen: gleichtonige Blockfugen
                // quer über Hochflächen wurden sonst zu fetten Kapselstrichen
                if(dq>=1){ ao.moveTo(P1[0]+0.6,P1[1]+1.1); ao.lineTo(P2[0]+0.6,P2[1]+1.1); }
                const dst=dq>=1? dark2 : dark;
                dst.moveTo(P1[0]+0.5,P1[1]+0.8); dst.lineTo(P2[0]+0.5,P2[1]+0.8);
                nE++;
                // Kantenlicht: Normale der Kante zeigt zur helleren Platte;
                // nur wenn sie zugleich Richtung Sonne weist, wird die Kante
                // knapp INNERHALB der hellen Platte gesäumt. Ein Teil der
                // Kanten setzt bewusst aus – durchgehende Lichtkanten längs
                // ganzer Terrassen lasen sich als leuchtende Paspel.
                if(dq<1 || hash01(e.u*7+e.v*13+5)<0.62) continue;
                const L4=qa>=qb? e.a : e.b;
                const mx4=(P1[0]+P2[0])/2, my4=(P1[1]+P2[1])/2;
                let nx4=L4.cx-mx4, ny4=L4.cy-my4;
                const nl4=Math.hypot(nx4,ny4)||1; nx4/=nl4; ny4/=nl4;
                const dot=nx4*SXD+ny4*SYD;
                if(dot>0.25 && Math.max(qa,qb)>=2){
                  const t7=dot>0.72? lite2 : lite;
                  t7.moveTo(P1[0]+nx4*1.5,P1[1]+ny4*1.5);
                  t7.lineTo(P2[0]+nx4*1.5,P2[1]+ny4*1.5);
                  nL++;
                }
              }
              if(nE){
                // stumpfe Kappen für Fugen+AO: vereinzelte kurze Tonstufen-
                // kanten mitten auf Hochflächen wurden mit Rundkappen zu
                // dunklen "Kapsel"-Strichen (Ästchen-Optik); in Ketten
                // teilen sich die Segmente ihre Endpunkte, da braucht es
                // keine Rundung
                // Umbau 2.3 (Gebirge-Papier): STARK zurueckgenommen – das
                // Fugennetz liegt jetzt in der ter_rock_top-Kachel; die
                // gezeichneten geraden Fugenlinien lasen sich daneben wie
                // Kratzer. Es bleibt nur ein leiser AO-Hauch an echten
                // Tonstufen, der die grossen Blockgrenzen erdet.
                g.lineCap='butt'; g.lineJoin='round';
                const fug= this.theme==='vulkan'? '20,15,12' : '56,49,41';
                g.strokeStyle='rgba('+fug+',0.05)'; g.lineWidth=5.5; g.stroke(ao);
                g.strokeStyle='rgba('+fug+',0.05)'; g.lineWidth=1.4; g.stroke(dark);
                g.strokeStyle='rgba('+fug+',0.12)'; g.lineWidth=1.8; g.stroke(dark2);
                g.lineCap='round';
                g.strokeStyle='rgba('+fug+',0.03)'; g.lineWidth=1.2; g.stroke(soft);
              }
              if(nL){
                g.lineCap='round';
                g.strokeStyle='rgba(255,250,238,0.05)'; g.lineWidth=1.0; g.stroke(lite);
                g.strokeStyle='rgba(255,251,240,0.10)'; g.lineWidth=1.1; g.stroke(lite2);
              }
            }
            // 4b) Gebirgsfuß-AO: entlang der ECHTEN Außensilhouette dunkelt
            //     der Fels zum Boden hin weich ab (Kontaktschatten wie unter
            //     Bäumen und Gebäuden) – der Übergang zur Ebene bekommt
            //     Gewicht statt einer harten Schnittkante. Kanten, die nur
            //     durch den Chunk-Zeichenausschnitt entstehen, bleiben außen
            //     vor, sonst stünden AO-Streifen an jeder Chunknaht.
            {
              const bnd=new Map();
              const isBnd=(q)=>{
                let v=bnd.get(q);
                if(v===undefined){ v=m.nbs(q).some(q2=>!isMassif(q2)); bnd.set(q,v); }
                return v;
              };
              const p1=new Path2D(); let nB=0;
              const pL=new Path2D(); let nL2=0;   // helle Oberkante (Grat)
              for(const e of edges.values()){
                if(e.b) continue;
                if(!isBnd(e.u)||!isBnd(e.v)) continue;
                // nicht auf Schnee: die Grenze Firnplateau/Schnee-Ebene ist
                // unsichtbar weiß auf weiß – ein AO-Strich malte dort eine
                // dunkle Geisterlinie quer über den Schnee. Auch unterm
                // Firnrand kein brauner Saum (Schnee schattet kühl, das
                // macht die Schneewehe des Bergfuß-Passes).
                if(m.terr[e.u]===TER.SNOW||m.terr[e.v]===TER.SNOW) continue;
                if(firnY<90 && (m.hgt[e.u]>firnY-0.4||m.hgt[e.v]>firnY-0.4)) continue;
                const P1=pos(e.u),P2=pos(e.v);
                // Aussennormale der Silhouettenkante (vom Facetten-
                // Schwerpunkt weg): trennt Sonnen-/Talseite
                const mx9=(P1[0]+P2[0])/2, my9=(P1[1]+P2[1])/2;
                let nx9=mx9-e.a.cx, ny9=my9-e.a.cy;
                const nl9=Math.hypot(nx9,ny9)||1; nx9/=nl9; ny9/=nl9;
                // Fuss-AO nur tal-/seitwaerts – auf der RUECKSEITE laege der
                // Strich mitten auf der angehobenen Deckflaeche
                if(ny9>-0.45){
                  // am FUSS der Wand (unangehobene Grundlinie), nicht auf
                  // der angehobenen Kante selbst
                  const F1=m.worldPos(e.u), F2=m.worldPos(e.v);
                  p1.moveTo(F1[0],F1[1]); p1.lineTo(F2[0],F2[1]); nB++;
                }
                // Nutzer-Leitlinien A+C: helle OBERKANTE – die sonnen-
                // zugewandte (NW-)Silhouette kleiner Massive bekommt eine
                // schmale Lichtkante, der Grat setzt sich von der Wiese
                // dahinter ab. Lueckenhaft gehasht, sonst leuchtende Paspel.
                if(nx9*-0.552+ny9*-0.834>0.30
                   && Math.min(relEffOf(e.u),relEffOf(e.v))<2.4
                   && hash01(e.u*13+e.v*7+3)<0.78){
                  pL.moveTo(P1[0]-nx9*0.8,P1[1]-ny9*0.8);
                  pL.lineTo(P2[0]-nx9*0.8,P2[1]-ny9*0.8);
                  nL2++;
                }
              }
              if(nB){
                g.lineCap='round'; g.lineJoin='round';
                // zwei ineinanderliegende weiche Säume statt ctx.filter.
                // Umbau 2.7a: auf Papier-Staerke angehoben (Ziel dort:
                // 1-0.35*smoothstep(2,0,dist)) – zusammen mit dem neuen
                // Schlagschatten der Ebene traegt der Fuss jetzt ~0.3
                // Verdunklung an der Kante statt vorher ~0.2.
                g.strokeStyle='rgba(36,30,24,0.11)'; g.lineWidth=24; g.stroke(p1);
                g.strokeStyle='rgba(36,30,24,0.13)'; g.lineWidth=10; g.stroke(p1);
                g.strokeStyle='rgba(36,30,24,0.10)'; g.lineWidth=4;  g.stroke(p1);
              }
              if(nL2){
                g.lineCap='round'; g.lineJoin='round';
                g.strokeStyle='rgba(255,250,236,0.26)'; g.lineWidth=1.6; g.stroke(pL);
                g.strokeStyle='rgba(255,246,224,0.10)'; g.lineWidth=3.4; g.stroke(pL);
              }
            }
            // 5) Erzadern NUR dort, wo der Geologe geschürft hat – als weiche
            //    runde Flecken statt harter Dreieckskacheln
            if(signs && signs.size){
              const OREK={1:'ter_ore_coal',2:'ter_ore_iron',3:'ter_ore_gold',4:'ter_ore_granite'};
              for(const [q,v] of signs){
                if(!v || !OREK[v] || !isMassif(q)) continue;
                const [qx,qy]=m.worldPos(q);
                if(qx<c.ox-60||qx>c.ox+w+60||qy<c.oy-60||qy>c.oy+h+60) continue;
                const blob=this.oreBlob(OREK[v]);
                if(blob) g.drawImage(blob, qx-54, qy-44, 108, 88);
              }
            }
            // 6) Firn NACH den Facetten: harte, KANTIGE Decke – die Grenze
            //    bricht wie eine Schneebrettkante in eckigen Zellen über
            //    den Blöcken (Referenzstil: klare Kanten statt Wattesaum).
            //    Das Facettenrelief scheint gedämpft durch; eine dunkle
            //    Schattenlippe setzt die Decke vom Fels ab. Steile Wände
            //    halten keinen Schnee.
            {
              const mk2=this._maskTmp.getContext('2d');
              mk2.globalCompositeOperation='source-over';
              mk2.clearRect(0,0,w,h);
              mk2.save(); mk2.translate(-c.ox,-c.oy);
              mk2.fillStyle='#fff';
              let anySnow=false;
              // örtlich KORRELIERTES Fransen-Rauschen: Nachbarknoten kippen
              // gemeinsam. Weißes Knotenrauschen ergäbe auf Hochflächen genau
              // an der Grenzhöhe ein Wabenmuster aus Einzelzellen.
              const sm=(u)=>u*u*(3-2*u);
              const vv=(xx,yy)=>hash01((Math.imul(xx,73856093)^Math.imul(yy,19349663)^0x9e37)|0);
              const fnoise=(X,Y)=>{
                const gx0=X/4.6, gy0=Y/4.6;
                const x2=Math.floor(gx0), y2=Math.floor(gy0);
                const fx=sm(gx0-x2), fy=sm(gy0-y2);
                return (vv(x2,y2)*(1-fx)+vv(x2+1,y2)*fx)*(1-fy)
                     + (vv(x2,y2+1)*(1-fx)+vv(x2+1,y2+1)*fx)*fy;
              };
              // Deckungsentscheidung je Knoten, MERKBAR (auch für Nachbar-
              // fragen): 0 = kahler Fels, -1 = kein Massiv, sonst Deckungsgrad
              const snCache=new Map();
              const snOf=(i2)=>{
                let v=snCache.get(i2);
                if(v!==undefined) return v;
                if(!isMassif(i2) || m.terr[i2]===TER.LAVA){ snCache.set(i2,-1); return -1; }
                // Deckungsgrad steuert die ZELLGRÖSSE, nicht die Deckkraft:
                // Schnee liegt oder liegt nicht – halbdurchsichtige Schleier
                // ergäben fleckige Überlappungen statt einer Firnkante
                let sn=(m.hgt[i2]-(firnY-0.4))/0.8;
                // Winterwelt: Schnee liegt überall, wo er liegen BLEIBT –
                // flache Bergpartien sind zu, nur Steilwände apern aus.
                // Steilheit über die NACHBARSCHAFT gemittelt: der rohe
                // Knotenwert kippt von Knoten zu Knoten – statt zusammen-
                // hängender Schneefelder standen Reihen einzelner weißer
                // Blasen ("Perlenketten") entlang jedes Hangs
                if(this.theme==='winter'){
                  let sAvg=this.slopeOf(m,i2), nn2=1;
                  for(const q2 of m.nbs(i2)){ sAvg+=this.slopeOf(m,q2); nn2++; }
                  sn=Math.max(sn, 1.15-(sAvg/nn2)*1.5);
                }
                if(m.terr[i2]===TER.SNOW) sn=Math.max(sn,0.85); // Gipfel-Eis: immer zu
                else sn += (fnoise(m.X(i2),m.Y(i2))-0.5)*0.9 + (hash01(i2*13+7)-0.5)*0.2;
                // Umbau 2.6 (Gebirge-Papier): Schnee liegt nur, wo es flach
                // genug ist – steile Waende bleiben blanker Fels. Papier:
                // snow *= 1 - smoothstep(0.30,0.50,slope); auf die hiesige
                // Gradientenmetrik uebertragen (Massiv-p50 ~2.0): Fenster
                // 1.35..2.6 auf der TERRASSIERTEN Steilheit – genau an den
                // 2.5-Stufen reisst die Decke auf, und 2.4 zeichnet dort die
                // blanke Wand. Gipfel-Eis (TER.SNOW) bleibt zu; im Winter
                // gilt weiter die bewaehrte Ausaper-Logik samt leisem
                // Steilheitsabzug (F9-Regression nicht wieder einreissen).
                if(this.theme==='winter') sn -= Math.max(0, this.slopeOf(m,i2)-0.95)*0.35;
                else if(m.terr[i2]!==TER.SNOW) sn *= 1-smT((slopeT(i2)-1.35)/1.25);
                // Schwelle nicht zu tief: knapp qualifizierte EINZELknoten
                // ohne qualifizierte Nachbarn stünden als einzelne weiße
                // Perlen im Abstand des Gitters auf dem Fels
                if(sn<=0.34) sn=0;
                // Auf der RANDreihe des Massivs keine Teildeckung: halbe
                // Zellen zerfielen dort zur Perlenkette über dem Bergfuß –
                // den Übergang zur Ebene macht die Schneewehe des
                // Geröllband-Passes, nicht die Firndecke.
                // AUSSER im Winter gegen Schnee-Ebene: dort ist der Übergang
                // weiß auf weiß (keine Perlen möglich) – die Randregel ließ
                // gerade die hohen Randwände kahl, deren Facetten dann als
                // grauer Polygon-Dorn aus dem weißen Massiv stachen (F9).
                else if(sn<0.9 && m.nbs(i2).some(q=>!isMassif(q))
                        && !(this.theme==='winter'
                             && m.nbs(i2).every(q=>isMassif(q)||m.terr[q]===TER.SNOW))) sn=0;
                // Winter: die RANDZONE des Massivs (2 Reihen) apert nie aus.
                // Eine steile Randwand blieb sonst als einziger grauer
                // Polygon-Dorn zwischen weißer Decke und weißer Ebene stehen
                // (Kritikbericht F9, Winter S/Seed 3) – Steilwände zeigen
                // ihren Fels weiterhin, aber nur im Massiv-Inneren, wo Fels
                // um sie herum liegt.
                if(sn===0 && this.theme==='winter'){
                  const amRand=(q3)=>m.nbs(q3).some(p3=>!isMassif(p3));
                  if(amRand(i2) || m.nbs(i2).some(q3=>isMassif(q3)&&amRand(q3))) sn=0.95;
                }
                snCache.set(i2,sn);
                return sn;
              };
              // Nachsorge zum hangabhaengigen Ausapern (2.6): kahle
              // ZUSAMMENHANGSKOMPONENTEN, die nirgends ans offene Unter-
              // Firn-Gestein anschliessen (kein Mitglied deutlich unter der
              // Firngrenze), sind isolierte Steilsplitter mitten im
              // geschlossenen Eisfeld – sie standen als braune Dreiecksdorne
              // im Weiss und werden zugedeckt. Die grossen aufgerissenen
              // Waende an Terrassen und am Feldrand haengen immer am
              // offenen Fels und bleiben blank. Deterministisch und
              // chunkuebergreifend stabil (die Flut folgt snOf ueber die
              // Chunkgrenze hinaus).
              const iceHole=new Set();
              if(this.theme!=='winter' && firnY<90){
                const seen9=new Set();
                for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++)
                  for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
                    const i=m.idx(x,y);
                    if(seen9.has(i) || snOf(i)!==0) continue;
                    const comp=[i]; seen9.add(i);
                    let open=false;
                    // KEIN Fruehabbruch bei "open": die Komponente muss ganz
                    // in seen9 landen, sonst wuerde ihr Rest bei spaeterem
                    // Scanstart ohne den offenen Knoten neu bewertet
                    for(let k=0;k<comp.length && comp.length<400;k++){
                      if(m.hgt[comp[k]]<firnY-0.8) open=true;
                      for(const q of m.nbs(comp[k])){
                        if(seen9.has(q)) continue;
                        if(snOf(q)===0){ seen9.add(q); comp.push(q); }
                      }
                    }
                    // sehr grosse Komponenten gelten als offen (Abbruch)
                    if(!open && comp.length<400) for(const q of comp) iceHole.add(q);
                  }
              }
              for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++)
                for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
                  const i=m.idx(x,y);
                  let sn=snOf(i);
                  if(sn<0) continue;
                  if(sn===0){
                    // Winter-Sonderfall (Kritikbericht F9): eine EINZELNE
                    // kahle Zelle inmitten verschneiter Nachbarn stand als
                    // scharfer grauer Polygon-Dorn im weißen Massivrand
                    // (Winter S/Seed 3). Kahl ausapern darf nur, wer noch
                    // einen kahlen Massiv-Nachbarn hat – Einzelgänger werden
                    // zugedeckt, größere Felswände bleiben sichtbar.
                    if(this.theme==='winter' && !m.nbs(i).some(q=>snOf(q)===0)) sn=0.95;
                    else if(iceHole.has(i)) sn=0.9;
                    else continue;
                  }
                  sn=Math.min(1,sn);
                  anySnow=true;
                  const [px,py]=m.worldPos(i);
                  // großzügiger Radius: an Steilstufen rücken die Zeilen auf
                  // dem Bildschirm auseinander – zu kleine Zellen ließen dort
                  // Lücken, durch die der dunkle Fels als Pfeil sticht.
                  // An Steilstufen wird die Zelle SENKRECHT gestreckt, sonst
                  // stächen zwischen den projizierten Zeilen Felskeile durch.
                  const ystr=1+Math.min(0.8, Math.max(0, this.slopeOf(m,i)-0.35)*0.7);
                  // Umbau 2.6-Feinschliff: neben KAHLEM Fels zieht sich die
                  // Decke etwas zurueck – sonst quetschen die ueberhaengenden
                  // Zellen (Radius > Kachelmass) eine legitime Kahlwand zu
                  // einem unlesbaren Splitter zusammen. Nur ausserhalb des
                  // Winters (dort deckt die Randlogik bewusst grosszuegig).
                  const shrink=(this.theme!=='winter'
                    && m.nbs(i).some(q=>snOf(q)===0 && !iceHole.has(q)))? 0.80 : 1;
                  // Umbau 3.4 (Nutzerkritik "Firn wirkt als weisse Facetten-
                  // pfuetze mit harten Kanten mitten im Fels"): die Zellen
                  // bleiben eckig – der Umriss der Decke folgt weiter den
                  // Blockkanten – aber sie werden GROESSER angelegt und die
                  // fertige Maske wird anschliessend weichgezeichnet. Die
                  // Kante laeuft dadurch in den Fels aus: Schnee liegt AUF
                  // dem Gestein, statt als weisse Flaeche eingelegt zu sein.
                  // Der Zuschlag 1.10 gleicht aus, was der Weichzeichner am
                  // Rand wegnimmt.
                  mk2.beginPath();
                  for(let k=0;k<6;k++){
                    const a3=k*1.047 + hash01(i*11+1)*0.8 + (hash01(i*19+k*7)-0.5)*0.5;
                    const rr2=47*1.10*(0.80+hash01(i*17+k*5)*0.36)*(0.72+0.28*sn)*shrink;
                    const qx=px+Math.cos(a3)*rr2, qy=py+Math.sin(a3)*rr2*0.95*ystr;
                    if(k===0) mk2.moveTo(qx,qy); else mk2.lineTo(qx,qy);
                  }
                  mk2.closePath();
                  mk2.fill();
                }
              mk2.restore();
              if(anySnow){
                // Weiche Firnkante: die harte Zellmaske ueber _maskTmp2
                // weichzeichnen (blurInto, kein ctx.filter) und
                // zurueckschreiben. Zweimal zusaetzlich aufaddiert ergibt das
                // die Alphakurve 1-(1-a)^3: das INNERE der Decke wird wieder
                // voll deckend, nur ein schmaler Saum von rund 10 Weltpixeln
                // laeuft in den Fels aus. Reines Weichzeichnen allein liess
                // die Decke als Wattewolke schweben.
                const mb2=this._maskTmp2.getContext('2d');
                mb2.globalCompositeOperation='copy';
                this.blurInto(mb2, this._maskTmp, 5);
                mb2.globalCompositeOperation='source-over';
                mk2.globalCompositeOperation='copy';
                mk2.drawImage(this._maskTmp2,0,0,w,h);
                mk2.globalCompositeOperation='source-over';
                mk2.drawImage(this._maskTmp2,0,0,w,h);
                mk2.drawImage(this._maskTmp2,0,0,w,h);
              }
              if(anySnow && fbw>0 && fbh>0){
                const tex2=this._texTmp.getContext('2d');
                tex2.globalCompositeOperation='source-over';
                tex2.clearRect(0,0,w,h);
                // Firn-Huellrechteck (G3-Budget)
                tex2.save();
                tex2.beginPath(); tex2.rect(fbx0,fby0,fbw,fbh); tex2.clip();
                tex2.save(); tex2.translate(-c.ox,-c.oy);
                // bestellte Sastrugi-Kachel (ter_ridge_snow) GEDÄMPFT über
                // weichem Firngrund: pur gefüllt las sich die hartkantige
                // Kachel als zerknülltes Papier (und ihre eingebauten
                // Felsfenster als aufgeklebte braune Späne) – halbe Deck-
                // kraft macht aus den Sastrugi eine leise Windzeichnung
                // (Grundton = Firn hell #E4E6E2 aus Papier §3)
                tex2.fillStyle='#e4e6e2';
                tex2.fillRect(c.ox,c.oy,w,h);
                const sastr=patOf('ter_ridge_snow',0.5)||patOf('ter_firn',0.4);
                if(sastr){
                  tex2.globalAlpha=0.55;
                  tex2.fillStyle=sastr;
                  tex2.fillRect(c.ox,c.oy,w,h);
                  tex2.globalAlpha=1;
                }
                tex2.restore();
                tex2.globalCompositeOperation='destination-in';
                tex2.drawImage(this._maskTmp,0,0,w,h);
                // Relief AUF der Decke: die Facettentöne (liegen noch in
                // _shadeTmp) scheinen gedämpft durchs Weiß – die Block-
                // struktur bleibt unterm Schnee lesbar, mit kühlen
                // Schatten. VORHER weichzeichnen (blurInto, kein
                // ctx.filter): scharf durchgepauste Dreieckskanten lasen
                // sich als Geisterfacetten im Schnee – unter einer Firn-
                // decke verrunden sich alle Kanten. Blend-Modi zeichnen
                // auch dort, wo die Decke transparent ist, deshalb danach
                // erneut maskieren.
                {
                  const bg3=this._blurTmp.getContext('2d');
                  bg3.globalCompositeOperation='copy';
                  bg3.fillStyle='rgba(0,0,0,0)'; bg3.fillRect(0,0,w,h);
                  bg3.globalCompositeOperation='source-over';
                  bg3.clearRect(0,0,w,h);
                  this.blurInto(bg3, this._shadeTmp, 4*S);
                  // Dunkel-Deckel VOR dem Weichlicht: hohe Absturzwände
                  // liegen in den Facettentönen fast schwarz – durch das
                  // Weichlicht stachen sie als scharfer grauer Polygon-Dorn
                  // durch die weiße Decke (Kritikbericht F9, Winter S/Seed 3,
                  // "Geisterlinie aus dem Relief-Pass"). 'lighten' hebt alle
                  // Töne auf mindestens Firn-Halbdunkel; die leise
                  // Blockzeichnung der Decke bleibt erhalten. Die Alphamaske
                  // stellt das destination-in unten ohnehin wieder her.
                  bg3.globalCompositeOperation='lighten';
                  bg3.fillStyle='rgb(118,117,115)';
                  bg3.fillRect(0,0,w,h);
                  bg3.globalCompositeOperation='source-over';
                  tex2.globalCompositeOperation='soft-light';
                  tex2.globalAlpha=0.62;
                  tex2.drawImage(this._blurTmp,0,0,w,h);
                  tex2.globalAlpha=1;
                }
                tex2.globalCompositeOperation='destination-in';
                tex2.drawImage(this._maskTmp,0,0,w,h);
                tex2.globalCompositeOperation='source-over';
                // Schattenlippe: die dunkle Silhouette der Decke leicht nach
                // Südost versetzt ZUERST – die harte Firnkante steht dadurch
                // sichtbar ÜBER dem Fels statt aufgemalt zu wirken
                {
                  const bg2=this._blurTmp.getContext('2d');
                  bg2.globalCompositeOperation='copy';
                  bg2.drawImage(this._texTmp,0,0,w,h);
                  bg2.globalCompositeOperation='source-in';
                  // Spaltentiefe #5E7378 (Papier §3) statt Nachtblau
                  bg2.fillStyle='rgb(94,115,120)';
                  bg2.fillRect(0,0,w,h);
                  bg2.globalCompositeOperation='source-over';
                  g.globalAlpha=0.30;
                  g.drawImage(this._blurTmp, fbx0*S, fby0*S, fbw*S, fbh*S,
                              c.ox+fbx0+1.8, c.oy+fby0+2.8, fbw, fbh);
                }
                // fast deckend: einzelne dunkle Steilstufen mitten im
                // Eisfeld sollen nur ahnbar durchscheinen
                g.globalAlpha=0.94;
                g.drawImage(this._texTmp, fbx0*S, fby0*S, fbw*S, fbh*S,
                            c.ox+fbx0, c.oy+fby0, fbw, fbh);
                g.globalAlpha=1;
                tex2.restore();   // Firn-Huellrechteck-Clip
                // Umbau 2.6 (Gebirge-Papier): GLETSCHER als eigene Flaeche.
                // Zusammenhaengende FLACHE Deckenbereiche oberhalb der
                // Schneegrenze bekommen die Spalten-Kachel ter_glacier
                // (Firnplatten mit Spaltenlinien); die Abbruchkante nach
                // unten markieren obj_glacier_snout-Stempel. Kriterium
                // "zusammenhaengend": der Knoten und mindestens 4 seiner
                // Nachbarn sind geschlossen verschneit und flach.
                {
                  const imG=this.asset('ter_glacier');
                  if(imG){
                    const gq=new Map();
                    const isGl=(q)=>{
                      let v=gq.get(q);
                      if(v!==undefined) return v;
                      v= snOf(q)>=0.8 && m.hgt[q]>firnY+0.15 && slopeT(q)<1.1;
                      gq.set(q,v);
                      return v;
                    };
                    const cells=[];
                    for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++)
                      for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
                        const i=m.idx(x,y);
                        if(!isGl(i)) continue;
                        let nn3=0;
                        for(const q of m.nbs(i)) if(isGl(q)) nn3++;
                        if(nn3>=4) cells.push(i);
                      }
                    if(cells.length>=3){
                      const mkG=this._maskTmp.getContext('2d');
                      mkG.globalCompositeOperation='source-over';
                      mkG.clearRect(0,0,w,h);
                      mkG.save(); mkG.translate(-c.ox,-c.oy);
                      mkG.fillStyle='#fff';
                      for(const i of cells){
                        const [px,py]=m.worldPos(i);
                        // gleiche kantige Zellsprache wie die Firnkante
                        mkG.beginPath();
                        for(let k=0;k<6;k++){
                          const a3=k*1.047 + hash01(i*23+5)*0.8 + (hash01(i*31+k*7)-0.5)*0.5;
                          const rr2=44*(0.80+hash01(i*41+k*5)*0.34);
                          const qx=px+Math.cos(a3)*rr2, qy=py+Math.sin(a3)*rr2*0.92;
                          if(k===0) mkG.moveTo(qx,qy); else mkG.lineTo(qx,qy);
                        }
                        mkG.closePath(); mkG.fill();
                      }
                      mkG.restore();
                      // wie die Firnkante weichgezeichnet (3.4): das
                      // Spaltenfeld ist eine Auflage IM Firn, keine
                      // eingelegte Facettenscheibe
                      {
                        const mg2=this._maskTmp2.getContext('2d');
                        mg2.globalCompositeOperation='copy';
                        this.blurInto(mg2, this._maskTmp, 7);
                        mg2.globalCompositeOperation='source-over';
                        mkG.globalCompositeOperation='copy';
                        mkG.drawImage(this._maskTmp2,0,0,w,h);
                        mkG.globalCompositeOperation='source-over';
                        mkG.drawImage(this._maskTmp2,0,0,w,h);
                      }
                      const texG=this._texTmp.getContext('2d');
                      texG.globalCompositeOperation='source-over';
                      texG.clearRect(0,0,w,h);
                      texG.save(); texG.translate(-c.ox,-c.oy);
                      // weltverankert, krumme Skala wie die Felskacheln
                      const patG=patOf('ter_glacier',0.42);
                      texG.fillStyle=patG||'#c2cacc';
                      texG.fillRect(c.ox,c.oy,w,h);
                      texG.restore();
                      texG.globalCompositeOperation='destination-in';
                      texG.drawImage(this._maskTmp,0,0,w,h);
                      texG.globalCompositeOperation='source-over';
                      // halbtransparent ueber dem Firn: die Sastrugi-Decke
                      // bleibt am Rand sichtbar, die Spaltenzeichnung traegt
                      g.globalAlpha=0.85;
                      g.drawImage(this._texTmp, fbx0*S, fby0*S, fbw*S, fbh*S,
                                  c.ox+fbx0, c.oy+fby0, fbw, fbh);
                      g.globalAlpha=1;
                      // Abbruchkante: Stempel an der Unterkante des Eisfelds,
                      // dort wo es deutlich zu einem kahlen Massivknoten
                      // abfaellt. "Unten" des Sprites zeigt hangab.
                      // Gletscherzunge mit dem GEMEINSAMEN Zeichenfaktor
                      // (11.11) – nicht mehr aus der Absturzhoehe skaliert
                      const snImg=this.asset('obj_glacier_snout');
                      if(snImg&&snImg.naturalWidth){
                        for(const i of cells){
                          if(hash01(i*67+9)>0.55) continue;   // sparsam
                          let best=-1, bd=0;
                          for(const q of m.nbs(i)){
                            if(isGl(q) || !isMassif(q)) continue;
                            const d=hgtT(i)-hgtT(q);
                            if(d>bd){ bd=d; best=q; }
                          }
                          if(best<0 || bd<0.5) continue;
                          const [ax2,ay2]=m.worldPos(i), [bx2,by2]=m.worldPos(best);
                          const mx4=(ax2+bx2)/2, my4=(ay2+by2)/2;
                          let ux4=bx2-ax2, uy4=by2-ay2;
                          const L4=Math.hypot(ux4,uy4)||1; ux4/=L4; uy4/=L4;
                          const f4=FELS_F*(0.9+hash01(i*83+7)*0.2);
                          const ww4=snImg.naturalWidth*f4, hh4=snImg.naturalHeight*f4;
                          g.save();
                          g.translate(mx4,my4);
                          g.rotate(Math.atan2(uy4,ux4)-Math.PI/2);
                          g.globalAlpha=0.95;
                          // gedreht um den Fusspunkt: die Bodenlinie des
                          // Bildes liegt auf der Abbruchkante
                          g.drawImage(snImg,-ww4/2,-hh4+FELS_BODEN*f4,ww4,hh4);
                          g.restore();
                        }
                        g.globalAlpha=1;
                      }
                    }
                  }
                }
              }
            }
            // 7) Akzente – sparsam, das Relief machen die Blockfacetten:
            //    (a) Muldenschatten vertieft echte Kessel nur noch leicht,
            //    (c) Schneereste liegen in Mulden knapp unter der Firn-
            //    grenze. (Kammlicht-Striche und Geröllrinnen sind entfallen:
            //    Kritzellinien passen nicht zum flachen Facettenstil –
            //    Kanten zeichnet jetzt das Fugennetz.)
            {
              const fOn=firnY<90;
              for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++)
                for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
                  const i=m.idx(x,y);
                  if(!isMassif(i) || m.terr[i]===TER.LAVA) continue;
                  const cvv=curvOf(i);
                  const hg2=m.hgt[i];
                  const [px,py]=pos(i);
                  const onFirn=fOn && hg2>firnY-0.4;
                  // (a) Muldenschatten: konkave Kerben dunkeln weich ein –
                  //     auf Firn kühl-blau statt braun (Schnee schattet blau)
                  if(cvv<-0.08){
                    const al=Math.min(0.10,(-cvv-0.08)*1.6);
                    const ct=onFirn? '94,115,120' : '30,28,26';
                    const rg2=g.createRadialGradient(px,py,3, px,py,30);
                    rg2.addColorStop(0,'rgba('+ct+','+al.toFixed(3)+')');
                    rg2.addColorStop(1,'rgba('+ct+',0)');
                    g.fillStyle=rg2;
                    g.beginPath(); g.ellipse(px,py,30,21,0,0,7); g.fill();
                  }
                  // (c) Schneereste: in Mulden hält sich der Schnee auch
                  //     unterhalb der geschlossenen Firndecke. SEHR sparsam
                  //     und nur in echten Kesseln nahe der Grenze.
                  if(fOn && !onFirn && m.terr[i]===TER.MOUNT && cvv<-0.07
                     && hg2>firnY-1.0 && hash01(i*37+5)<0.09){
                    // WEICHER Muldenrest statt dreier harter Striche – die
                    // alten Ellipsenreihen lasen sich als weiße Kratzer auf
                    // der Wand. Jetzt: ein verlaufender Fleck mit Schatten-
                    // bett, quer zur Falllinie gelagert.
                    const gr6=this.gradOf(m,i);
                    const a5=gr6? Math.atan2(gr6[0],-gr6[1]*0.7) : (hash01(i*11+2)-0.5)*0.7;
                    const rx5=6+hash01(i*19+3)*5;
                    g.fillStyle='rgba(94,115,120,0.18)';
                    g.beginPath(); g.ellipse(px+1.0,py+1.6,rx5*1.05,rx5*0.42,a5,0,7); g.fill();
                    const rg8=g.createRadialGradient(px,py,rx5*0.15, px,py,rx5);
                    rg8.addColorStop(0,'rgba(228,230,226,0.55)');
                    rg8.addColorStop(0.7,'rgba(194,202,204,0.30)');
                    rg8.addColorStop(1,'rgba(194,202,204,0)');
                    g.fillStyle=rg8;
                    g.beginPath(); g.ellipse(px,py,rx5,rx5*0.45,a5,0,7); g.fill();
                  }
                }
            }
            g.restore();
            // 7b) Umbau 2.7b (Gebirge-Papier): SCHLAGSCHATTEN – die Massiv-
            //     Silhouette wird entlang des Lichtvektors (Sonne aus Nord-
            //     west) auf die Ebene projiziert. Hier wird nur die scharfe
            //     Sweep-Maske gebaut (Dreiecke in 3 Schritten hoehenabhaengig
            //     versetzt, Massivflaeche ausgestanzt); weichgezeichnet und
            //     aufgelegt wird sie NACH dem Bergfuss-Band. Alles bake-
            //     zeitig im Chunk; chunkuebergreifend konsistent, weil die
            //     Dreiecksliste die Massivknoten der Umgebung (3 Knoten
            //     Ueberhang) mitliest und deterministisch ist.
            {
              const cg=this._castTmp.getContext('2d');
              cg.globalCompositeOperation='source-over';
              cg.clearRect(0,0,w,h);
              cg.save(); cg.translate(-c.ox,-c.oy);
              cg.fillStyle='#000';
              const SHX=0.552, SHY=0.834;   // Gegenrichtung der Sonne
              // Gebirgskritik G2: der alte 3-Schritt-Sweep (f=0.35/0.7/1.0)
              // hinterliess in der Vereinigung harte Dreieckszacken
              // ("Chevrons" im Nutzerfoto). Jetzt wird je Dreieck das VOLLE
              // Schattenvolumen gefuellt: Basisdreieck, versetztes Dreieck
              // und die drei Verbindungs-Vierecke der Kanten – die exakte
              // kontinuierliche Projektion ohne Stufen. Das Basisdreieck
              // stanzt der Massiv-Ausschnitt unten ohnehin wieder aus.
              for(const t3 of tris){
                // Schattenlaenge waechst mit der Hoehe: 0.8..2.6 Kacheln
                const u4=Math.max(0,Math.min(1,
                  ((hgtT(t3.qa)+hgtT(t3.qb)+hgtT(t3.qc))/3-hlo)/spanH));
                const D=TILE*(0.8+1.8*u4);
                const dx=SHX*D, dy=SHY*D;
                const P=[t3.A,t3.B,t3.C];
                // jede Teilform einzeln fuellen: in EINEM Pfad koennten sich
                // gegenlaeufig gewundene Teilpfade (nonzero) ausstanzen
                cg.beginPath();
                cg.moveTo(P[0][0],P[0][1]); cg.lineTo(P[1][0],P[1][1]);
                cg.lineTo(P[2][0],P[2][1]); cg.closePath(); cg.fill();
                cg.beginPath();
                cg.moveTo(P[0][0]+dx,P[0][1]+dy); cg.lineTo(P[1][0]+dx,P[1][1]+dy);
                cg.lineTo(P[2][0]+dx,P[2][1]+dy); cg.closePath(); cg.fill();
                for(let k9=0;k9<3;k9++){
                  const A=P[k9], B=P[(k9+1)%3];
                  cg.beginPath();
                  cg.moveTo(A[0],A[1]); cg.lineTo(B[0],B[1]);
                  cg.lineTo(B[0]+dx,B[1]+dy); cg.lineTo(A[0]+dx,A[1]+dy);
                  cg.closePath(); cg.fill();
                }
              }
              // das Massiv wirft den Schatten, traegt ihn aber nicht selbst
              cg.globalCompositeOperation='destination-out';
              cg.beginPath();
              for(const t3 of tris){
                cg.moveTo(t3.A[0],t3.A[1]); cg.lineTo(t3.B[0],t3.B[1]);
                cg.lineTo(t3.C[0],t3.C[1]); cg.closePath();
              }
              cg.fill();
              cg.globalCompositeOperation='source-over';
              cg.restore();
              castShadow=true;
            }
            // 8) Felsnadeln: schlanke, facettierte Einzelfelsen als Akzente
            //    auf offenen Felsflächen. NACH dem Massiv-Beschnitt
            //    gezeichnet – sie ragen über die Facettendecke.
            //    obj_rockspire_1..6 aus der Lieferung, alle mit dem
            //    GEMEINSAMEN Zeichenfaktor FELS_F (Stilguide 11.11): _1/_5
            //    sind hohe Nadeln, _3/_4/_6 breite Blockgruppen – das steckt
            //    im Bild, nicht in einer Skalentabelle.
            //    Sparsam und deterministisch gestreut; Bauplätze, Straßen,
            //    Pässe, Zeichen und belegte Knoten bleiben frei.
            {
              const roadSet=new Set();
              for(const r of this.game.roads.values())
                for(const n2 of r.path) roadSet.add(n2);
              g.save(); g.translate(-c.ox,-c.oy);
              for(let y=Math.max(0,y0+1); y<Math.min(m.h-1,y1-1); y++)
                for(let x=Math.max(0,x0+1); x<Math.min(m.w-1,x1-1); x++){
                  const i=m.idx(x,y);
                  if(m.terr[i]!==TER.MOUNT) continue;
                  const h7=hash01(i*53+11);
                  // seltener als früher, dafür GROSS: die kleinen Nadeln
                  // lasen sich nur als graue Stöckchen auf den Platten.
                  // Leitlinie B: an TERRASSENKANTEN haeufiger – die Sporne
                  // zerschneiden die waagerechten Stufenbaender.
                  if(h7>=0.05) continue;
                  let brink=false;
                  for(const q of m.nbs(i))
                    if(isMassif(q) && hgtT(i)-hgtT(q)>0.9){ brink=true; break; }
                  if(h7>=(brink? 0.05 : 0.022)) continue;
                  if(!brink && (this.slopeOf(m,i)>0.5 || curvOf(i)<-0.02)) continue;
                  if(m.bld[i]>=0 || m.flag[i] || (m.obj[i]&127)!==0) continue;
                  if(m.pass && m.pass[i]) continue;
                  if(signs && signs.has(i)) continue;
                  if(roadSet.has(i)) continue;
                  const onFirn2=firnY<90 && m.hgt[i]>firnY-0.4;
                  if(onFirn2 && hash01(i*59+3)<0.65) continue;  // auf Firn seltener
                  const [px,py]=pos(i);
                  const ox2=(hash01(i*13+3)-0.5)*18, oy2=(hash01(i*19+11)-0.5)*10;
                  // Streuung je FUNDORT, nicht je Bild: +-12 % brechen die
                  // Wiederholung, ohne die relativen Groessen der Lieferung
                  // zu verschieben
                  const sc7=0.88+hash01(i*43+7)*0.24;
                  const vN=1+((h7*137|0)%6);
                  const box=this.drawFelsObj(g,'obj_rockspire_'+vN,
                                             px+ox2, py+oy2+3, sc7,
                                             hash01(i*7+1)>0.5, 0.26);
                  const hh7=box? box.h : 70;
                  if(!box) this.drawRockNeedle(g, px+ox2, py+oy2+3, hh7, i);
                  // kantige Trümmer am Fuß der Nadel (Referenz: Blöcke
                  // um die Basis)
                  const bw7=box? box.w : hh7*0.5;
                  for(let k7=0;k7<4;k7++){
                    const bx7=px+ox2+(hash01(i*29+k7*7)-0.5)*bw7*0.9;
                    const by7=py+oy2+2+(hash01(i*31+k7*11)-0.30)*7;
                    this.rockChunklet(g, bx7, by7, 2.8+hash01(i*37+k7)*3.4, i*5+k7);
                  }
                }
              // 8b) TERRASSENBRECHER an Abbruchkanten: obj_cliff_ledge
              //     (Balkon), obj_crag_1 und obj_crag_2 (gedrungene Felsnasen
              //     aus der Lieferung). Sie sitzen auf der Brinklinie und
              //     ragen hangab – gegen den gleichmaessigen Stufentakt
              //     (Leitlinie B). Alle drei mit demselben Zeichenfaktor.
              {
                const KANT=['obj_cliff_ledge','obj_crag_1','obj_crag_2'];
                for(let y=Math.max(0,y0+1); y<Math.min(m.h-1,y1-1); y++)
                  for(let x=Math.max(0,x0+1); x<Math.min(m.w-1,x1-1); x++){
                    const i=m.idx(x,y);
                    if(m.terr[i]!==TER.MOUNT) continue;
                    const h8=hash01(i*97+13);
                    if(h8>=0.11) continue;
                    if(m.bld[i]>=0 || m.flag[i] || (m.obj[i]&127)!==0) continue;
                    if(m.pass && m.pass[i]) continue;
                    if(signs && signs.has(i)) continue;
                    if(roadSet.has(i)) continue;
                    if(firnY<90 && m.hgt[i]>firnY-0.5) continue;  // nicht im Firn
                    // hoechste Abbruchkante zum Nachbarn suchen
                    let best8=-1, bd8=0;
                    for(const q of m.nbs(i)){
                      if(!isMassif(q)) continue;
                      const d=hgtT(i)-hgtT(q);
                      if(d>bd8){ bd8=d; best8=q; }
                    }
                    if(best8<0 || bd8<Math.min(1.25, 0.45+relEffOf(i)*0.35)) continue;
                    const [px,py]=pos(i), [qx8,qy8]=pos(best8);
                    const mx8=px*0.55+qx8*0.45, my8=py*0.55+qy8*0.45;
                    const kk=KANT[(h8*211|0)%KANT.length];
                    this.drawFelsObj(g, kk, mx8, my8+4,
                                     0.88+hash01(i*41+7)*0.24, qx8<px, 0.24);
                  }
              }
              // 8c) GIPFELKUPPE obj_summit_1 auf den hoechsten Massivknoten:
              //     der Berg soll oben als Kuppe abschliessen statt flach
              //     auszulaufen (Nutzer-Leitlinie "Gebirge muessen aus der
              //     Wiese HERAUSRAGEN"). Kriterium: konvexer Knoten, der
              //     ueber allen Nachbarn liegt, mit spuerbarem Relief und
              //     unterhalb des Firns – dort liegt schon Schnee. Ein
              //     Gipfel je Kuppe, deterministisch ausgeduennt.
              {
                for(let y=Math.max(0,y0+1); y<Math.min(m.h-1,y1-1); y++)
                  for(let x=Math.max(0,x0+1); x<Math.min(m.w-1,x1-1); x++){
                    const i=m.idx(x,y);
                    if(m.terr[i]!==TER.MOUNT) continue;
                    if(hash01(i*181+29)>=0.62) continue;   // nicht jede Kuppe
                    if(m.bld[i]>=0 || m.flag[i] || (m.obj[i]&127)!==0) continue;
                    if(m.pass && m.pass[i]) continue;
                    if(signs && signs.has(i)) continue;
                    if(roadSet.has(i)) continue;
                    if(firnY<90 && m.hgt[i]>firnY-0.6) continue;
                    if(relEffOf(i)<0.85 || curvOf(i)<0.05) continue;
                    const hi=hgtT(i);
                    let top=true;
                    for(const q of m.nbs(i)) if(hgtT(q)>hi-0.02){ top=false; break; }
                    if(!top) continue;
                    const [px,py]=pos(i);
                    this.drawFelsObj(g,'obj_summit_1', px, py+3,
                                     0.92+hash01(i*67+5)*0.22,
                                     hash01(i*11+9)>0.5, 0.28);
                  }
              }
              g.restore();
            }
          }
        }
      }
      // Geländeübergänge: gemalte Pinsel entlang jeder Geländegrenze. Der
      // Pinsel wird so gedreht, dass seine ausgefranste Seite ins Nachbar-
      // gelände zeigt – dadurch gehen die Arten ineinander über.
      {
        // Fels taucht hier bewusst NICHT auf: den Bergfuß malt unten das
        // Geröllband – dünn gestempelte trans_scree-Abdrücke lasen sich nur
        // als gleichmäßiger grauer Schleier um den ganzen Berg.
        const BRUSH={ [TER.DESERT]:'trans_dry', [TER.SNOW]:'trans_snow',
                      [TER.SWAMP]:'trans_bog' };
        const sandImg=this.fadedBrush('trans_sand'), foamImg=this.fadedBrush('trans_foam');
        // Der Pinsel sitzt mit seiner geschlossenen Seite auf dem Ausgangs-
        // gelände; nur der ausgefranste Teil ragt über die Grenze.
        // Der Pinsel wird quer zur Grenze GESTRECHT: so entsteht ein Saum,
        // der der Uferlinie folgt, statt einer Kette runder Kleckse.
        const put=(img,mx2,my2,ang,hh2,alpha,jit,wide=1.85)=>{
          const ar=(img.naturalWidth||img.width)/(img.naturalHeight||img.height);
          const ww2=hh2*ar*wide;
          g.save();
          g.translate(mx2,my2);
          g.rotate(ang+jit);
          g.globalAlpha=alpha;
          g.drawImage(img, -ww2/2, -hh2*0.72, ww2, hh2);
          g.restore();
        };
        let any=false;
        g.save(); g.translate(-c.ox,-c.oy);
        for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++){
          for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
            const i=m.idx(x,y);
            const t=m.terr[i];
            const [ax,ay]=m.worldPos(i);
            for(const n of m.nbs(i)){
              const tn=m.terr[n];
              if(tn===t) continue;
              const [bx,by]=m.worldPos(n);
              const mx2=(ax+bx)/2, my2=(ay+by)/2;
              // Winkel so, dass die ausgefranste Unterkante nach außen zeigt
              const ang=Math.atan2(by-ay, bx-ax)-Math.PI/2;
              const hsh=hash01(i*17+n);
              if(t!==TER.WATER && tn===TER.WATER){
                const jit=(hsh-0.5)*0.22;              // nur leicht kippen: der Saum folgt der Kante
                if(sandImg){ put(sandImg, mx2-(bx-ax)*0.10, my2-(by-ay)*0.10, ang, 34+hsh*9, 0.55, jit, 2.3); any=true; }
                if(foamImg){ put(foamImg, mx2+(bx-ax)*0.22, my2+(by-ay)*0.22, ang, 21+hsh*6, 0.45, -jit, 2.5); any=true; }
              } else if(t!==TER.WATER && tn!==TER.WATER){
                // Die GESAMTE Berggrenze gehört dem Geröllband unten – weder
                // stempelt der Fels nach außen noch die Ebene auf den Fels
                // (Schnee-Stempel AUF dem Massiv gäben zusammen mit der
                // Schneewehe des Bands doppelte, versetzte Weißsäume).
                if(t===TER.MOUNT || isMassif(n)) continue;
                const img=BRUSH[t]? this.fadedBrush(BRUSH[t]) : null;
                if(img){ put(img, mx2, my2, ang, 30+hsh*10, 0.4, (hsh-0.5)*0.25, 2.1); any=true; }
              }
            }
          }
        }
        g.restore();
        if(!any){
          // Rückfall ohne Pinselgrafiken: gemalter Sandsaum wie bisher
          const coastLand=[];
          for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++)
            for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
              const i=m.idx(x,y);
              if(m.terr[i]===TER.WATER) continue;
              if(m.nbs(i).some(n=>m.terr[n]===TER.WATER)) coastLand.push(i);
            }
          if(coastLand.length){
            g.save(); g.translate(-c.ox,-c.oy);
            for(const i of coastLand){
              const [px,py]=m.worldPos(i);
              const rad=g.createRadialGradient(px,py,6,px,py,34);
              rad.addColorStop(0,'rgba(226,206,158,0)');
              rad.addColorStop(0.6,'rgba(226,206,158,0.2)');
              rad.addColorStop(1,'rgba(226,206,158,0)');
              g.fillStyle=rad;
              g.beginPath(); g.arc(px,py,34,0,7); g.fill();
            }
            g.restore();
          }
        }
      }
      // ---------- Bergfuß: Geröllband, trockener Saum, Brocken, Schatten ----------
      // Spielerkritik: "der Übergang der Gebirge an z.B. Wiese passt nicht".
      // Vorher endete der Massiv-Beschnitt an rohen Dreieckskanten (Sägezahn),
      // darüber lagen fast unsichtbare Pinsel-Stempel und ein Rundum-
      // Schlagschatten je Randknoten – zusammen ein gleichmäßiger grauer
      // Nebelrahmen mit Zackenkante um den ganzen Berg.
      // Jetzt nach Siedler-2-Vorbild: der Fels läuft über ein ZUSAMMEN-
      // HÄNGENDES Geröllband aus (eine Maskenform mit Textur darin, Technik
      // wie beim Straßenband). Das Band deckt innen die Dreieckszähne des
      // Beschnitts, atmet in der Breite mit örtlich korreliertem Rauschen
      // (kein Stempel-Rahmen) und schickt Zungen der Falllinie nach in die
      // Wiese. Außen hält ein schmaler trockener Saum das satte Wiesengrün
      // von der Felskante fern, einzelne Brocken streuen noch weiter hinaus.
      // An Schnee-Ebenen übernimmt eine Schneewehe die Rolle des Bands –
      // graues Geröll auf Weiß läse sich als Schmutzfleck.
      {
        const eScree=[], eSnow=[];
        for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++)
          for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
            const i=m.idx(x,y);
            if(m.terr[i]!==TER.MOUNT) continue;
            const [ax,ay]=m.worldPos(i);
            for(const n of m.nbs(i)){
              const tn=m.terr[n];
              if(isMassif(n) || tn===TER.WATER || tn===TER.LAVA) continue;
              const [bx,by]=m.worldPos(n);
              let ux=bx-ax, uy=by-ay;
              const L2=Math.hypot(ux,uy)||1; ux/=L2; uy/=L2;
              // Kritik G1: das Band lief SYMMETRISCH um alle Seiten – der
              // "Donut um den Deckel". sf = Schuttfuss-Faktor: talseitig
              // (Sueden, uy>0) breit, seitlich halb, bergseitig (Norden)
              // gegen null; grosse Fallhoehe (dp, mit Anhebung) gibt auch
              // Seitenkanten einen Fuss.
              const dp=(m.hgt[i]+liftOf(i))-m.hgt[n];
              const sf=Math.max(Math.min(1, 0.55+uy*0.55),
                                Math.min(0.5, Math.max(0,(dp-0.8)*0.3)));
              (tn===TER.SNOW? eSnow : eScree).push({i,n,tn,mx:(ax+bx)/2,my:(ay+by)/2,ux,uy,dp,sf});
            }
          }
        if(eScree.length || eSnow.length){
          // korreliertes Breitenrauschen: das Band schwillt über MEHRERE
          // Zellen an und ab. Weißes Rauschen je Kante gäbe nur eine
          // Zitterkante, konstante Breite den kritisierten Stempel-Rahmen.
          const sm2=(u)=>u*u*(3-2*u);
          const vn=(xx,yy)=>hash01((Math.imul(xx,40503)^Math.imul(yy,87119)^0x2f3a)|0);
          const bno=(X,Y)=>{
            const gx0=X/3.6, gy0=Y/3.6;
            const x2=Math.floor(gx0), y2=Math.floor(gy0);
            const fx=sm2(gx0-x2), fy=sm2(gy0-y2);
            return (vn(x2,y2)*(1-fx)+vn(x2+1,y2)*fx)*(1-fy)
                 + (vn(x2,y2+1)*(1-fx)+vn(x2+1,y2+1)*fx)*fy;
          };
          const mk3=this._maskTmp.getContext('2d');
          const tex3=this._texTmp.getContext('2d');
          // unregelmäßige Bandzelle (verbeulter Siebeneck-Klecks) mit weichem
          // Rand – softShape statt ctx.filter (iPhone)
          // 9 Ecken mit Winkel-Jitter: gleichmäßig verteilte Ecken ließen
          // gerade Polygonseiten stehen (Papierschnitt-Kante)
          const cell=(gctx,e,cx4,cy4,r,steps)=>{
            const path=()=>{
              gctx.beginPath();
              for(let k=0;k<9;k++){
                const a4=k*0.698 + hash01(e.i*11+e.n*3+1)*0.7 + (hash01(e.i*29+e.n+k*13)-0.5)*0.4;
                const rr=r*(0.76+hash01(e.i*17+e.n+k*5)*0.48);
                const qx=cx4+Math.cos(a4)*rr, qy=cy4+Math.sin(a4)*rr*0.82;
                if(k===0) gctx.moveTo(qx,qy); else gctx.lineTo(qx,qy);
              }
              gctx.closePath();
            };
            this.softShape(gctx, path, cx4, cy4, steps);
          };
          // Band-Huellrechteck (G3-Budget): Trockensaum und Geroellband
          // beschneiden ihre Vollflaechen-Schritte auf die Grenzkanten-
          // Umgebung. Die SCHNEEWEHE bleibt unbeschnitten – ihre Zellen
          // klettern die projizierten Waende weit ueber die Kantenmitte
          // hinauf (ein zu enger Clip riss dort Sägezahn-Löcher).
          let ebx0=1e9, eby0=1e9, ebx1=-1e9, eby1=-1e9;
          for(const e of eScree){
            if(e.mx<ebx0) ebx0=e.mx; if(e.mx>ebx1) ebx1=e.mx;
            if(e.my<eby0) eby0=e.my; if(e.my>eby1) eby1=e.my;
          }
          ebx0=Math.max(0, ebx0-c.ox-115); eby0=Math.max(0, eby0-c.oy-115);
          ebx1=Math.min(w, ebx1-c.ox+115); eby1=Math.min(h, eby1-c.oy+115);
          const ebw=Math.max(0,ebx1-ebx0), ebh=Math.max(0,eby1-eby0);
          const clipE=(ctx)=>{ ctx.save(); ctx.beginPath(); ctx.rect(ebx0,eby0,ebw,ebh); ctx.clip(); };
          const drawE=(alpha)=>{
            if(ebw<=0||ebh<=0) return;
            g.globalAlpha=alpha;
            g.drawImage(this._texTmp, ebx0*S, eby0*S, ebw*S, ebh*S, c.ox+ebx0, c.oy+eby0, ebw, ebh);
            g.globalAlpha=1;
          };
          // ---- 1) trockener Saum außen, nur gegen Wiese (im Winter liegt
          //         dort ohnehin Schnee statt Dürre) ----
          const dryE=eScree.filter(e=>e.tn===TER.GRASS);
          if(dryE.length && this.theme!=='winter'){
            mk3.globalCompositeOperation='source-over';
            mk3.clearRect(0,0,w,h);
            mk3.save(); mk3.translate(-c.ox,-c.oy);
            mk3.fillStyle='#fff';
            for(const e of dryE){
              const wn=bno(m.X(e.n)+7, m.Y(e.n)+3);
              cell(mk3, e, e.mx+e.ux*(13+wn*13), e.my+e.uy*(11+wn*11), 20+wn*11, 5);
            }
            mk3.restore();
            tex3.globalCompositeOperation='source-over';
            tex3.clearRect(0,0,w,h);
            clipE(tex3);
            // ausgedörrter Boden: flacher fahler Ton plus Sandkorn; die halbe
            // Deckkraft lässt die Graszeichnung durchscheinen -> vertrocknetes
            // Gras statt aufgemalter Farbstreifen
            tex3.fillStyle='#b7a26a';
            tex3.fillRect(0,0,w,h);
            const sp=this.terrainPattern(TER.DESERT, tex3);
            if(sp){
              tex3.save(); tex3.translate(-c.ox,-c.oy);
              tex3.globalAlpha=0.5; tex3.fillStyle=sp;
              tex3.fillRect(c.ox,c.oy,w,h);
              tex3.restore(); tex3.globalAlpha=1;
            }
            tex3.globalCompositeOperation='destination-in';
            tex3.drawImage(this._maskTmp,0,0,w,h);
            tex3.globalCompositeOperation='source-over';
            tex3.restore();
            drawE(0.42);
          }
          // ---- 2) Geröllband über der Grenze ----
          if(eScree.length){
            mk3.globalCompositeOperation='source-over';
            mk3.clearRect(0,0,w,h);
            mk3.save(); mk3.translate(-c.ox,-c.oy);
            mk3.fillStyle='#fff';
            for(const e of eScree){
              const wn=bno(m.X(e.n), m.Y(e.n));
              const h4=hash01(e.i*13+e.n*7);
              // Versatz LÄNGS der Grenze: die Zellen sitzen sonst im festen
              // Gitterabstand der Kantenmitten – bei mittlerem Zoom las sich
              // das Band als Reihe gleichmäßiger Buckel ("Schildkröten")
              const tj=(h4-0.5)*18, tx=-e.uy, ty=e.ux;
              // wenige weiche Stufen (2-3): die Kante wird durch die FORM
              // unruhig, nicht durch einen breiten Alphaverlauf – ein zu
              // weiter Verlauf läse sich wieder als grauer Nebel auf der Wiese
              // innen: deckt die Wurzeln der Dreieckszähne des Beschnitts
              // (bergseitig kleiner: dort deckt die angehobene Silhouette)
              cell(mk3, e, e.mx-e.ux*13+tx*tj*0.6, e.my-e.uy*11+ty*tj*0.5,
                   (17+h4*5)*(1-0.35*Math.max(0,-e.uy)), 2);
              // Umbau 2.8 + Kritik G1: das Band darf NIRGENDS gleichmaessig
              // breit laufen UND ist ASYMMETRISCH (e.sf): talseitig der
              // breite Schuttfuss, bergseitig faellt es weg. Aussenmasse
              // mit vollem wn-Hub; G4a: Reichweite gestrafft, der gemalte
              // Uebergriff bleibt unter ~0,5 Knoten (Zungen ausgenommen).
              const sc9=0.40+0.60*e.sf;
              const o5=8+h4*9, o6=-(7+hash01(e.i*47+e.n)*9);
              if((wn>0.16 || h4>0.55) && e.sf>0.12)
                cell(mk3, e, e.mx+e.ux*(2+wn*7)+tx*o5, e.my+e.uy*(2+wn*5)+ty*o5*0.8,
                     (7+wn*15+h4*4)*sc9, 3);
              if((wn>0.10 || h4<0.45) && e.sf>0.12)
                cell(mk3, e, e.mx+e.ux*(1+wn*5)+tx*o6, e.my+e.uy*(1+wn*4)+ty*o6*0.8,
                     (6+hash01(e.i*31+e.n*3)*7+wn*9)*sc9, 3);
              // Zunge hangabwärts – Geröll fließt der Falllinie nach
              // (nur talseitig: eine Zunge bergauf gaebe es nicht)
              if(h4<0.62 && e.sf>0.35){
                let dx4=e.ux, dy4=e.uy;
                const gr=this.gradOf(m,e.n);
                if(gr){ dx4=-gr[0]; dy4=-gr[1]; }
                // nur wenn die Zunge vom Berg WEG zeigt
                if(dx4*e.ux+dy4*e.uy>0.1){
                  cell(mk3, e, e.mx+e.ux*5+dx4*(10+h4*20), e.my+e.uy*4+dy4*(8+h4*16), (8+h4*6)*sc9, 3);
                  // lange Zungen laufen in einem zweiten, kleineren Glied aus
                  if(h4<0.30)
                    cell(mk3, e, e.mx+e.ux*5+dx4*(26+h4*34), e.my+e.uy*4+dy4*(21+h4*28), (6+h4*5)*sc9, 3);
                }
              }
            }
            mk3.restore();
            tex3.globalCompositeOperation='source-over';
            tex3.clearRect(0,0,w,h);
            clipE(tex3);
            tex3.save(); tex3.translate(-c.ox,-c.oy);
            const tile=this.screeTile(S);
            if(tile){
              // weltverankert wie die Felsdecke; Muster einmal je
              // Bake-Aufloesung erzeugt und über Chunks wiederverwendet
              if(!this._screePatC || this._screePatS!==S){
                this._screePatC=tex3.createPattern(tile,'repeat');
                if(this._screePatC.setTransform)
                  this._screePatC.setTransform(new DOMMatrix().scale(0.66/S));
                this._screePatS=S;
              }
              tex3.fillStyle=this._screePatC;
            } else tex3.fillStyle='#8b857c';   // Bild (noch) nicht da: neutraler Schutt
            tex3.fillRect(c.ox,c.oy,w,h);
            tex3.restore();
            tex3.globalCompositeOperation='destination-in';
            tex3.drawImage(this._maskTmp,0,0,w,h);
            tex3.globalCompositeOperation='source-atop';
            // Farbangleich: die hellen trans_scree-Steine werden zur
            // Felsfarbe des Themas hingezogen – sonst steht ein fast weißes
            // Schuttband grell vor dem dunkelbraunen Massiv
            {
              const rc=hex2arr(cols[TER.MOUNT]||'#8a8177');
              tex3.fillStyle='rgba('+(rc[0]|0)+','+(rc[1]|0)+','+(rc[2]|0)+',0.34)';
              tex3.fillRect(0,0,w,h);
            }
            // Kontaktschatten der Felswand auf dem Schutt: die Innenseite des
            // Bands liegt im Schatten des Massivs – erst dadurch liegt das
            // Band UNTER dem Fels statt daneben
            tex3.save(); tex3.translate(-c.ox,-c.oy);
            for(const e of eScree){
              // nur talseitig: bergseitig gibt es keinen Wandschatten aufs
              // Band (dort liegt die Silhouette OBEN)
              if(e.sf<0.25) continue;
              // Jitter längs der Grenze + flacher: die im Kantenraster
              // gestempelten Schattenkerne lasen sich bei mittlerem Zoom als
              // periodische dunkle Kleckse überm Band
              const tj2=(hash01(e.i*61+e.n*23)-0.5)*20;
              const sx5=e.mx-e.ux*15-e.uy*tj2, sy5=e.my-e.uy*12+e.ux*tj2*0.8;
              const rg=tex3.createRadialGradient(sx5,sy5,2, sx5,sy5,36);
              rg.addColorStop(0,'rgba(38,34,28,'+(0.10+0.09*e.sf).toFixed(3)+')');
              rg.addColorStop(1,'rgba(38,34,28,0)');
              tex3.fillStyle=rg;
              // LÄNGS der Grenze ausgerichtet und gestreckt: runde Einzel-
              // kleckse lasen sich auf geraden Grenzstücken als Perlenkette
              tex3.beginPath();
              tex3.ellipse(sx5,sy5,36,13,Math.atan2(e.ux,-e.uy),0,7);
              tex3.fill();
            }
            tex3.restore();
            tex3.globalCompositeOperation='source-over';
            tex3.restore();   // Band-Huellrechteck
            drawE(0.94);
            // ---- 2b) Grasüberwuchs: von der Wiese her wachsen Büschel über
            //      den äußeren Bandrand – Fels und Wiese verzahnen sich,
            //      statt an einer Linie aneinanderzustoßen. Deterministisch
            //      gestreut, nur an Gras-Kanten und nie im Winter.
            if(this.theme!=='winter'){
              const gc0=hex2arr(cols[TER.GRASS]||'#6bb254');
              const gcol=(f)=>'rgb('+Math.min(255,gc0[0]*f|0)+','
                +Math.min(255,gc0[1]*f|0)+','+Math.min(255,gc0[2]*f|0)+')';
              g.save(); g.translate(-c.ox,-c.oy);
              g.lineCap='round';
              for(const e of eScree){
                if(e.tn!==TER.GRASS) continue;
                // bergseitig der angehobenen Silhouette stuenden die
                // Bueschel mitten auf dem gemalten Fels
                if(-e.uy>0.5 && liftOf(e.i)>0.35) continue;
                const nT=2+((hash01(e.i*77+e.n*31)*7)|0)%2;
                for(let k=0;k<nT;k++){
                  const hK=hash01(e.i*101+e.n*13+k*37);
                  // Umbau 2.8: das erste Bueschel jeder Kante LIEGT AUF der
                  // Grenze (halb Fels, halb Gras) statt nur davor – Wiese
                  // und Fels verzahnen sich ueber die Kante hinweg
                  const d8= k===0? -3+hK*10 : 9+hK*15;
                  const sw8=(hash01(e.i*59+e.n*7+k*17)-0.5)*28;
                  const bx8=e.mx+e.ux*d8-e.uy*sw8, by8=e.my+e.uy*d8*0.85+e.ux*sw8*0.8;
                  // Schattenbett: das Büschel liegt AUF dem Schutt
                  g.fillStyle='rgba(26,34,18,0.20)';
                  g.beginPath(); g.ellipse(bx8,by8+0.8,4.6,1.8,0,0,7); g.fill();
                  // 5 Halme als kleine Bögen in zwei Grüntönen
                  for(let b8=0;b8<5;b8++){
                    const a8=-1.571+(b8-2)*0.34+(hash01(e.i*7+k*11+b8*3)-0.5)*0.24;
                    const l8=4.5+hash01(e.i*13+k*5+b8*7)*3.5;
                    g.strokeStyle=(b8&1)? gcol(0.78) : gcol(1.06);
                    g.lineWidth=1.3;
                    g.beginPath();
                    g.moveTo(bx8,by8);
                    g.quadraticCurveTo(bx8+Math.cos(a8)*l8*0.5, by8+Math.sin(a8)*l8*0.7,
                                       bx8+Math.cos(a8)*l8*1.1, by8+Math.sin(a8)*l8);
                    g.stroke();
                  }
                }
              }
              g.restore();
            }
          }
          // ---- 3) Schneewehe an Schnee-Ebenen (Winterwelt) ----
          if(eSnow.length){
            mk3.globalCompositeOperation='source-over';
            mk3.clearRect(0,0,w,h);
            mk3.save(); mk3.translate(-c.ox,-c.oy);
            mk3.fillStyle='#fff';
            // KANTIGE, hart gefüllte Zellen statt weicher Wattebäusche:
            // die Wehe bricht wie eine Schneebrettkante gegen den Fels
            // (passend zur harten Firnkante des Massivs). Die Außenzelle
            // verschwindet nahtlos in der ohnehin weißen Ebene.
            const cellS=(e,cx4,cy4,r)=>{
              mk3.beginPath();
              for(let k=0;k<7;k++){
                const a4=k*0.897 + hash01(e.i*11+e.n*3+1)*0.7 + (hash01(e.i*29+e.n+k*13)-0.5)*0.45;
                const rr=r*(0.78+hash01(e.i*17+e.n+k*5)*0.42);
                const qx=cx4+Math.cos(a4)*rr, qy=cy4+Math.sin(a4)*rr*0.82;
                if(k===0) mk3.moveTo(qx,qy); else mk3.lineTo(qx,qy);
              }
              mk3.closePath();
              mk3.fill();
            };
            for(const e of eSnow){
              const wn=bno(m.X(e.n), m.Y(e.n));
              const h4=hash01(e.i*13+e.n*7);
              // Versatz längs der Grenze wie beim Geröllband: ohne ihn stand
              // die Wehe als Raupe gleich großer Zellen im Kantenraster
              const tj=(h4-0.5)*16, tx=-e.uy, ty=e.ux;
              // Innenzelle satt: auf schmalen Felsrippen treffen sich die
              // Wehen beider Seiten – zu kleine Zellen blieben Einzelperlen
              cellS(e, e.mx-e.ux*12+tx*tj*0.6, e.my-e.uy*10+ty*tj*0.5, 23+h4*6);
              cellS(e, e.mx+e.ux*(4+wn*5)+tx*tj, e.my+e.uy*(3+wn*4)+ty*tj*0.8, 22+wn*12+h4*5);
              // Hohe Randwände: die Wehe klettert die PROJIZIERTE Wand
              // hinauf (Höhenversatz HSCALE, inkl. G1-Anhebung), sonst
              // ragen die vollen Wanddreiecke als dunkle Sägezähne aus
              // der weißen Ebene
              const drop=e.dp;
              if(drop>0.55){
                const [ax2,ay3]=m.worldPos(e.i);
                const ay2=ay3-liftOf(e.i)*HSCALE;
                cellS(e, (ax2+e.mx)/2, (ay2+e.my)/2, 19+drop*7);
                if(drop>1.1)
                  cellS(e, ax2*0.78+e.mx*0.22, ay2*0.78+e.my*0.22, 15+drop*6);
              }
            }
            mk3.restore();
            tex3.globalCompositeOperation='source-over';
            tex3.clearRect(0,0,w,h);
            tex3.save(); tex3.translate(-c.ox,-c.oy);
            const sp2=this.terrainPattern(TER.SNOW, tex3);
            tex3.fillStyle=sp2||'#e8edf4';
            tex3.fillRect(c.ox,c.oy,w,h);
            tex3.restore();
            tex3.globalCompositeOperation='destination-in';
            tex3.drawImage(this._maskTmp,0,0,w,h);
            tex3.globalCompositeOperation='source-over';
            g.globalAlpha=0.97;
            g.drawImage(this._texTmp,0,0,w,h);
            g.globalAlpha=1;
          }
          // (---- 4) entfallen: die Radialkleckse auf der Suedostseite sind
          // durch den PROJIZIERTEN Schlagschatten aus 2.7b ersetzt, der nach
          // diesem Block als Ganzes aufgelegt wird.)
          // ---- 5) kantige TRÜMMERBLÖCKE laufen in die Ebene aus ----
          // Referenzstil: eckige Einzelblöcke mit heller Deckfläche und
          // dunkler Schattenseite statt runder Kiesel. Nicht auf Schnee
          // (dunkler Punkt im Weiß = Schmutz) – dort deckt die Wehe alles zu
          g.save(); g.translate(-c.ox,-c.oy);
          // Geröllkegel (bestelltes Bild ter_scree_cone): an Kanten mit
          // hoher Absturzhöhe ein Schuttfächer hangab über dem Band –
          // ohne das Bild bleibt das prozedurale Band allein
          {
            const cone=this.tintedSpire('ter_scree_cone');
            if(cone){
              // Kritik G5 ("Zeltreihe"): Stempel spiegeln, in Kippung
              // variieren und gelegentlich eine flache Blockgruppe
              // einstreuen – nie zweimal dieselbe Silhouette in Reihe.
              // Nur talseitig (Kritik G1): der Kegel gehoert zum Schuttfuss.
              // Groesse aus dem GEMEINSAMEN Zeichenfaktor (11.11): der
              // Kegel ist im Bild breiter und flacher als eine Nadel, das
              // muss nicht mehr nachskaliert werden. Dafuer duenner
              // gestreut (0.30 statt 0.45) – ein breiter Faecher deckt
              // deutlich mehr Kantenlaenge ab als der alte kleine Stempel.
              const clus=this.tintedSpire('obj_rockspire_6');
              for(const e of eScree){
                if(e.dp<0.55 || e.uy<-0.15 || hash01(e.i*71+e.n*13)>0.30) continue;
                const h8=hash01(e.i*91+e.n*17);
                g.save();
                g.translate(e.mx+e.ux*9, e.my+e.uy*7);
                g.rotate(Math.atan2(e.uy,e.ux)-Math.PI/2+(h8-0.5)*0.24);
                if(h8>0.5) g.scale(-1,1);
                const im8= (clus && h8>0.34 && h8<0.48)? clus : cone;
                const f8=FELS_F*(0.88+h8*0.24);
                const W8=(im8.naturalWidth||im8.width), H8=(im8.naturalHeight||im8.height);
                g.globalAlpha= im8===clus? 0.92 : 0.86+h8*0.10;
                g.drawImage(im8, -W8*f8/2, -H8*f8+FELS_BODEN*f8, W8*f8, H8*f8);
                g.restore();
              }
              g.globalAlpha=1;
            }
          }
          for(const e of eScree){
            const h5=hash01(e.i*43+e.n*11);
            if(h5>0.34) continue;
            // bergseitig kaum Streubloecke – die Truemmer rollen talwaerts
            if(-e.uy>0.6 && h5>0.10) continue;
            const nB=1+((h5*29|0)&1);
            for(let k=0;k<nB;k++){
              const d5=26+hash01(e.i*7+e.n+k*13)*46;
              const sw5=(hash01(e.i*19+e.n+k*29)-0.5)*30;
              const bx5=e.mx+e.ux*d5-e.uy*sw5, by5=e.my+e.uy*d5*0.8+e.ux*sw5*0.8;
              this.rockChunklet(g, bx5, by5, 2.6+hash01(e.i*23+e.n+k*17)*3.6, e.i*13+e.n*5+k*29);
            }
          }
          // Umbau 2.8: Bloecke DIREKT AUF der Grenze – sie ueberlappen die
          // Kante (halb Fels, halb Gras) und zerschneiden jede Restlinie,
          // die das Band uebrig laesst
          for(const e of eScree){
            const h6=hash01(e.i*83+e.n*19);
            if(h6>0.30) continue;
            const sw6=(hash01(e.i*89+e.n*7)-0.5)*26;
            const d6=-3+h6*20;
            const bx6=e.mx+e.ux*d6-e.uy*sw6, by6=e.my+e.uy*d6*0.8+e.ux*sw6*0.8;
            this.rockChunklet(g, bx6, by6, 3.0+hash01(e.i*97+e.n*3)*3.4, e.i*17+e.n*11+3);
          }
          g.restore();
        }
      }
      // Umbau 2.7b (Gebirge-Papier): den in 7b gebauten Schlagschatten weich
      // (blurInto, kein ctx.filter) auf die Ebene legen – NACH dem Bergfuss-
      // Band, damit Geroell, Saum und Grasbueschel mit im Schatten liegen.
      // Wiese x0.78 laut Papier -> deckendes Dunkel mit Alpha 0.22; im
      // Winter kuehler und leiser (Schnee schattet blaugrau).
      if(castShadow){
        const bgS=this._blurTmp.getContext('2d');
        bgS.globalCompositeOperation='copy';
        bgS.fillStyle='rgba(0,0,0,0)'; bgS.fillRect(0,0,w,h);
        bgS.globalCompositeOperation='source-over';
        bgS.clearRect(0,0,w,h);
        this.blurInto(bgS, this._castTmp, 8, 1, W2, H2);
        if(this.theme==='winter'){
          bgS.globalCompositeOperation='source-in';
          bgS.fillStyle='rgb(70,84,110)';
          bgS.fillRect(0,0,w,h);
          bgS.globalCompositeOperation='source-over';
        }
        g.globalAlpha= this.theme==='winter'? 0.16 : 0.22;
        if(sbw>0 && sbh>0)
          g.drawImage(this._blurTmp, sbx0*S, sby0*S, sbw*S, sbh*S,
                      c.ox+sbx0, c.oy+sby0, sbw, sbh);
        g.globalAlpha=1;
      }
      // Reliefpass: Höhengradient als Graustufenrelief, weichgezeichnet und
      // im Weichlicht-Modus aufgelegt -> Hänge, Kuppen und Senken werden sichtbar
      {
        // in 1x-Aufloesung (_relTmp, siehe mkTmp1): der Pass ist ein
        // weiches Verlaufsrelief – hoehere Bake-Aufloesung (G3) braechte
        // keine Schaerfe, kostete aber die vierfache Fuellrate
        const sg=this._relTmp.getContext('2d');
        sg.globalCompositeOperation='source-over';
        sg.clearRect(0,0,w,h);
        // Gouraud braucht eine transparente Fläche im Modus 'lighter';
        // unbedeckte Bereiche bleiben transparent und damit im Weichlicht neutral
        sg.globalCompositeOperation='lighter';
        sg.save(); sg.translate(-c.ox,-c.oy);
        const scache=new Map();
        for(let y=Math.max(0,y0); y<Math.min(m.h-1,y1); y++){
          for(let x=Math.max(0,x0); x<Math.min(m.w-1,x1); x++){
            const i=m.idx(x,y);
            const p=y&1;
            const iE = x+1<m.w ? m.idx(x+1,y) : i;
            const iSW = m.inb(x-1+p,y+1)? m.idx(x-1+p,y+1) : i;
            const iSE = m.inb(x+p,y+1)? m.idx(x+p,y+1) : i;
            this.triShade(sg, m, scache, i, iE, iSE);
            this.triShade(sg, m, scache, i, iSE, iSW);
          }
        }
        sg.restore();
        // nur dort belichten, wo überhaupt Gelände liegt
        sg.globalCompositeOperation='destination-in';
        sg.drawImage(this._tmpChunk,0,0);
        sg.globalCompositeOperation='source-over';
        // Additiv-Überlauf kappen: an hohen Steilwänden überlappen sich die
        // PROJIZIERTEN Dreiecke (die obere Geländeetage schiebt sich auf dem
        // Bildschirm über die untere). Im Modus 'lighter' addierte sich das
        // doppelt Überdeckte zu gleißendem Weiß – es lag als durchscheinende
        // "Folien"-Dreiecke auf dem Fels. Der 'darken'-Deckel begrenzt jeden
        // Kanal auf das hellste LEGITIME shadeCol-Licht (188/180/162); die
        // Alphamaske wird danach wiederhergestellt, sonst färbte der Deckel
        // auch das Nicht-Gelände ein.
        {
          const bg2=this._relTmp2.getContext('2d');
          bg2.globalCompositeOperation='copy';
          bg2.drawImage(this._relTmp,0,0);
          bg2.globalCompositeOperation='darken';
          bg2.fillStyle='rgb(188,180,162)';
          bg2.fillRect(0,0,w,h);
          bg2.globalCompositeOperation='destination-in';
          bg2.drawImage(this._relTmp,0,0);
          bg2.globalCompositeOperation='source-over';
        }
        g.save();
        g.globalCompositeOperation='soft-light';
        g.drawImage(this._relTmp2,0,0,w,h);
        g.restore();
        // KEIN zweiter Durchgang mehr fürs Gebirge: die Felsplastik kommt
        // jetzt aus der Facettenschattierung des Massiv-Passes – doppelt
        // aufgelegt soff der Berg in Schwärze ab
      }
      // Schluchten: dunkle Felsspalten in den steilen Flanken
      if(gorge.length){
        g.save();
        g.translate(-c.ox,-c.oy);
        for(const i of gorge){
          // ausgedünnt: an Terrassenbrüchen qualifiziert sich jede Kanten-
          // reihe – ein Riss je Knoten ergab gestrichelte Ketten längs
          // der ganzen Abbruchkante
          if(hash01(i*57+3)>0.35) continue;
          let [px,py]=m.worldPos(i);
          const gr=this.gradOf(m,i);
          if(!gr) continue;
          // vom Terrassenbruch weg IN die Wand gerückt: direkt auf der
          // Brinklinie lasen sich die Risse als gestrichelte Kante
          px-=gr[0]*7; py-=gr[1]*5;
          const hsh=hash01(i*29+7);
          // Riss verläuft quer zum Gefälle (wie eine ausgewaschene Kluft).
          // KANTIG als Knickzug – die alten weichen Bögen mit runden Enden
          // lagen wie dunkle Ästchen AUF den Platten statt in ihnen.
          const a=Math.atan2(gr[1],gr[0])+Math.PI/2;
          const len=12+hsh*10;
          const cx3=Math.cos(a), sy3=Math.sin(a)*0.55;
          const kx=px+sy3*3+(hash01(i*43+1)-0.5)*4, ky=py-cx3*2+(hash01(i*47+2)-0.5)*3;
          g.lineCap='butt'; g.lineJoin='miter';
          g.strokeStyle='rgba(30,26,22,0.26)';
          g.lineWidth=1.6+hsh*1.2;
          g.beginPath();
          g.moveTo(px-cx3*len*0.5, py-sy3*len*0.5);
          g.lineTo(kx,ky);
          g.lineTo(px+cx3*len*0.5, py+sy3*len*0.5);
          g.stroke();
          g.strokeStyle='rgba(236,238,240,0.13)';
          g.lineWidth=0.9;
          g.beginPath();
          g.moveTo(px-cx3*len*0.5, py-sy3*len*0.5-1.4);
          g.lineTo(kx,ky-1.4);
          g.lineTo(px+cx3*len*0.5, py+sy3*len*0.5-1.4);
          g.stroke();
        }
        g.restore();
      }
    }
    // 4) gemalte Textur-Tupfer (Gras, Fels, Sand ...) scharf obendrauf.
    //    terrainBrush rechnet in WELTkoordinaten -> Chunk-Versatz setzen!
    g.save(); g.translate(-c.ox,-c.oy);
    for(let y=Math.max(0,y0+2); y<Math.min(m.h-1,y1-2); y++){
      for(let x=Math.max(0,x0+2); x<Math.min(m.w-1,x1-2); x++){
        const i=m.idx(x,y);
        this.terrainBrush(g, m, i);
      }
    }
    g.restore();
    return c;
  }
  terrainBrush(g, m, i){
    const t=m.terr[i];
    const h=hash01(i*17+9);
    const [px,py]=m.worldPos(i);
    const o1=(hash01(i*23+2)-0.5)*30, o2=(hash01(i*41+4)-0.5)*24;
    if(t===TER.GRASS){
      // Wiesen-Deko aus dem Asset-Paket (Blumen, Pilze, Distel ...), sparsam gestreut
      if(h>0.97){
        const water=m.nbs(i).some(n=>m.terr[n]===TER.WATER);
        const POOL=water? ['deco_reed','deco_fern','deco_flowers']
          : ['deco_flowers','deco_fern','deco_mushroom','deco_moss','deco_thistle'];
        let dk=POOL[(hash01(i*31+5)*POOL.length)|0];
        // Der Blumen-Dreierstreifen ist in drei Einzelbuescheln zerlegt - je
        // Knoten eines davon, sonst stand dieselbe Dreierreihe auf jeder Wiese.
        if(dk==='deco_flowers'){
          const v=(hash01(i*5+2)*3)|0;
          if(v>0 && this.asset('deco_flowers'+(v+1))) dk='deco_flowers'+(v+1);
        }
        const dimg=this.asset(dk);
        if(dimg){
          const dh=this.scaleOf(dk,20)*(0.62+hash01(i*37)*0.34);
          const dw=dh*(dimg.naturalWidth/dimg.naturalHeight);
          const dx=px+o1, dy=py+o2;
          // Bodenschatten: ohne ihn kleben Pilz und Blume wie aufgemalt
          // auf der Wiese statt darin zu stehen
          const sh=g.createRadialGradient(dx+1.5,dy+2.4,0.5, dx+1.5,dy+2.4, dw*0.62);
          sh.addColorStop(0,'rgba(28,44,20,0.34)');
          sh.addColorStop(1,'rgba(28,44,20,0)');
          g.fillStyle=sh;
          g.beginPath(); g.ellipse(dx+1.5,dy+2.4, dw*0.62, dw*0.24, 0,0,7); g.fill();
          g.drawImage(dimg, dx-dw/2, dy-dh+3, dw, dh);
        }
      }
      // weiche Farbtupfer (Wiesen-Sprenkelung)
      if(h>0.82 && h<=0.955){
        g.fillStyle=h>0.91?'rgba(190,230,140,0.08)':'rgba(40,95,40,0.07)';
        g.beginPath(); g.ellipse(px+o1,py+o2,15,9,h*3,0,7); g.fill();
      }
      // dichte Grasbüschel in mehreren Tönen -> liest sich als echte Wiese
      const tones=['rgba(50,105,45,0.3)','rgba(88,150,70,0.28)','rgba(175,220,135,0.26)'];
      for(let c2=0;c2<3;c2++){
        const hh=hash01(i*53+c2*7);
        if(hh>0.62) continue;
        const bx0=px+(hash01(i*61+c2)-0.5)*40;
        const by0=py+(hash01(i*67+c2)-0.5)*30;
        g.strokeStyle=tones[c2];
        g.lineWidth=1.4;
        for(let k=0;k<4;k++){
          const bx=bx0+k*3.4-5, lean=(hash01(i*3+k+c2)-0.5)*3;
          g.beginPath();
          g.moveTo(bx,by0);
          g.quadraticCurveTo(bx+lean,by0-3.2, bx+lean*1.8,by0-5.8);
          g.stroke();
        }
      }
    } else if(t===TER.MOUNT){
      const hg=m.hgt[i];
      // unter der Firndecke keine dunklen Kritzel – sie läsen sich als
      // Schmutz im Schnee. Großzügig gefasst: auch die ausgefranste
      // Übergangszone franst über Nachbarzellen bis hierher, und neben
      // Gipfel-Eis liegt praktisch immer Schnee.
      if(hg>this.firnLine()-1.2) return;
      const msn2=this.massifSnow();
      if(m.nbs(i).some(n=>m.terr[n]===TER.SNOW&&msn2[n])) return;
      if(h<0.15){
        // Felsnase: kleine Gruppe KANTIGER Trümmerblöcke im Facettenstil
        // (helle Deckfläche, dunkle Schattenseite – wie am Bergfuß)
        const zx=px+o1, zy=py+o2;
        for(let k=0;k<3;k++){
          const bx=zx+(hash01(i*7+k*11)-0.5)*22;
          const by=zy+(hash01(i*13+k*17)-0.5)*14;
          this.rockChunklet(g, bx, by, 2.4+hash01(i*19+k)*3.0, i*7+k*13);
        }
      } else if(h<0.5){
        // Geröllfeld
        g.fillStyle='rgba(60,54,46,0.35)';
        for(let k=0;k<6;k++){
          g.beginPath();
          g.arc(px+o1+hash01(i*7+k)*26-13, py+o2+hash01(i*11+k)*18-9, 1+hash01(i*13+k)*1.6, 0, 7);
          g.fill();
        }
        g.fillStyle='rgba(255,255,255,0.14)';
        for(let k=0;k<3;k++){
          g.beginPath();
          g.arc(px+o1+hash01(i*17+k)*22-11, py+o2+hash01(i*19+k)*15-8, 1.1, 0, 7);
          g.fill();
        }
      } else if(h<0.58 && hg>1.06 && this.theme!=='vulkan' && this.theme!=='wueste'){
        // Schneefleck in Gipfelnähe – FLACH liegend (die alte freie Drehung
        // stellte den Fleck senkrecht: er hing als weißer Tropfen im Fels)
        g.fillStyle='rgba(240,246,252,0.28)';
        g.beginPath(); g.ellipse(px+o1,py+o2,7,3,(h-0.5)*0.6,0,7); g.fill();
      }
    } else if(t===TER.DESERT && h<0.4){
      g.fillStyle='rgba(160,130,80,0.3)';
      for(let k=0;k<5;k++){
        g.beginPath();
        g.arc(px+o1+hash01(i*7+k)*20-10, py+o2+hash01(i*11+k)*14-7, 1.1, 0, 7);
        g.fill();
      }
    } else if(t===TER.SWAMP && h<0.45){
      g.fillStyle='rgba(40,70,45,0.3)';
      g.beginPath(); g.ellipse(px+o1,py+o2,7,3.4,0.4,0,7); g.fill();
      g.strokeStyle='rgba(120,160,90,0.4)'; g.lineWidth=1.3;
      g.beginPath(); g.moveTo(px+o1+3,py+o2); g.lineTo(px+o1+4,py+o2-6); g.stroke();
    } else if(t===TER.SNOW && h<0.3){
      g.fillStyle='rgba(255,255,255,0.5)';
      g.beginPath(); g.arc(px+o1,py+o2,1.3,0,7); g.arc(px+o1+7,py+o2+4,1,0,7); g.fill();
    } else if(t===TER.LAVA && h<0.5){
      g.strokeStyle='rgba(255,190,80,0.5)'; g.lineWidth=1.6;
      g.beginPath();
      g.moveTo(px+o1-6,py+o2); g.lineTo(px+o1,py+o2+3); g.lineTo(px+o1+6,py+o2+1);
      g.stroke();
    }
  }
  // weiche Farbe pro KNOTEN (Küstenmischung + sanfte, örtlich korrelierte Variation)
  nodeColor(m, cols, coast, ncache, i){
    let v=ncache.get(i);
    if(v) return v;
    const t=m.terr[i];
    const nbs=m.nbs(i);
    let col;
    if(t===TER.WATER){
      // kontinuierlicher Küsten-/Tiefenverlauf über zwei Nachbarringe (keine Sprünge)
      const landN=nbs.filter(n=>m.terr[n]!==TER.WATER).length;
      const seen=new Set([i]); let landC=0;
      for(const n of nbs){
        for(const q of m.nbs(n)){
          if(seen.has(q)) continue; seen.add(q);
          if(m.terr[q]!==TER.WATER) landC++;
        }
      }
      const base=hex2arr(cols[TER.WATER]);
      const depth=Math.min(1,(landN*3+landC)/9);          // 1 = ufernah
      const shore=Math.min(1,(landN*2.2+landC*0.55)/8);   // Flachwasser-Anteil
      // offene Fläche etwas dunkler, Flachwasser einen Hauch klarer/grünlicher
      col=mixArr(base.map(v=>v*0.85), base, depth);
      col=mixArr(col, hex2arr(coast[1]), shore*0.66);
    } else if(t===TER.GRASS||t===TER.DESERT||t===TER.SNOW){
      const waterN=nbs.filter(n=>m.terr[n]===TER.WATER).length;
      col = waterN? mixArr(hex2arr(cols[t]), hex2arr(coast[0]), Math.min(1,waterN/4)*0.8) : hex2arr(cols[t]);
    } else if(t===TER.MOUNT){
      // Höhenzonen: Geröllfuß -> Fels -> Gipfellicht/Schnee; Grasübergang am Bergfuß
      const rock=hex2arr(cols[t]);
      const scree=mixArr(rock, hex2arr(cols[TER.GRASS]||'#6bb254'), 0.42);
      const hg=m.hgt[i];
      col = hg<0.8 ? mixArr(scree, rock, Math.max(0,Math.min(1,(hg-0.4)/0.4))) : rock.slice();
      const peak=Math.max(0,Math.min(0.8,(hg-0.98)*1.35));
      if(peak>0) col=mixArr(col,[229,234,241],peak);
      const grassN=nbs.filter(n=>m.terr[n]===TER.GRASS||n===i&&false).length;
      if(grassN) col=mixArr(col, hex2arr(cols[TER.GRASS]), Math.min(1,grassN/4)*0.45);
    } else {
      col = hex2arr(cols[t]||'#888888');
    }
    // großflächiges, weich interpoliertes Wertrauschen (nicht auf Wasser)
    if(t!==TER.WATER){
      const gx0=m.X(i)/7, gy0=m.Y(i)/7;
      const x0=Math.floor(gx0), y0=Math.floor(gy0);
      const fx=gx0-x0, fy=gy0-y0;
      const sm=(u)=>u*u*(3-2*u);
      const vv=(xx,yy)=>hash01(((xx*73856093)^(yy*19349663))|0);
      const s=(vv(x0,y0)*(1-sm(fx))+vv(x0+1,y0)*sm(fx))*(1-sm(fy))
            + (vv(x0,y0+1)*(1-sm(fx))+vv(x0+1,y0+1)*sm(fx))*sm(fy);
      const f = t===TER.MOUNT? 0.93+s*0.14 : 0.958+s*0.084;
      col=[col[0]*f, col[1]*f, col[2]*f];
    }
    // Relieflicht pro KNOTEN (nicht pro Dreieck!) -> nach dem Weichzeichnen keinerlei Facetten
    if(t!==TER.WATER){
      let gx=0, gy=0;
      for(const n of nbs){
        const ddx=(m.X(n)+((m.Y(n)&1)*0.5))-(m.X(i)+((m.Y(i)&1)*0.5));
        const ddy=m.Y(n)-m.Y(i);
        const dh=m.hgt[n]-m.hgt[i];
        gx+=dh*ddx; gy+=dh*ddy;
      }
      const k = t===TER.MOUNT? 0.22 : 0.06;   // schwächer: Hauptlicht macht der Reliefpass
      let l=1+(gx*0.7+gy)*k;
      l=Math.max(t===TER.MOUNT?0.62:0.86, Math.min(t===TER.MOUNT?1.42:1.14, l));
      col=[col[0]*l, col[1]*l, col[2]*l];
    }
    ncache.set(i,col);
    return col;
  }
  // ---------- Weichzeichnen ohne ctx.filter ----------
  // ctx.filter ist in diesem Projekt VERBOTEN (Gebirgskritik G2): mehrere
  // WebKit-Staende bestehen den Setter-Test (filter liest den Wert zurueck),
  // IGNORIEREN den Filter aber beim Zeichnen – der alte Faehigkeitstest
  // CANFILTER meldete dort faelschlich "kann Filter" und die Schatten-/
  // Masken-Weichzeichnung fiel komplett aus (harte Dreieckszacken auf der
  // Wiese, Nutzerfoto IMG_7988). Deshalb laufen ALLE Nutzer ueber die
  // filterfreien Pfade; einen Filter-Zweig gibt es nicht mehr.
  // Verkleinern und wieder vergrößern: die bilineare Interpolation der GPU
  // ergibt eine sehr brauchbare Unschärfe und läuft überall.
  blurInto(dst, src, radius, alpha=1, dw=0, dh=0){
    const w=dw||src.width, h=dh||src.height;
    const f=Math.max(2, Math.round(radius*1.35));
    const sw=Math.max(1,Math.round(src.width/f)), sh=Math.max(1,Math.round(src.height/f));
    if(!this._blurA) this._blurA=document.createElement('canvas');
    const a2=this._blurA;
    if(a2.width!==sw||a2.height!==sh){ a2.width=sw; a2.height=sh; }
    const ag=a2.getContext('2d');
    ag.setTransform(1,0,0,1,0,0);
    ag.globalCompositeOperation='copy';
    ag.imageSmoothingEnabled=true; ag.imageSmoothingQuality='medium';
    ag.drawImage(src,0,0,sw,sh);
    ag.globalCompositeOperation='source-over';
    dst.save();
    // rein in PIXELN arbeiten – die Chunk-Kontexte tragen seit G3 eine
    // Basis-Skalierung (Bake-Aufloesung), die hier nicht doppelt wirken darf
    dst.setTransform(1,0,0,1,0,0);
    dst.globalAlpha=alpha;
    dst.imageSmoothingEnabled=true; dst.imageSmoothingQuality='medium';
    dst.drawImage(a2,0,0,sw,sh,0,0,w,h);
    dst.restore();
  }
  // Weiche Kante direkt in die Form gezeichnet: die Kontur wird mehrfach in
  // abnehmender Größe gefüllt. Braucht keinen Filter und keine Zwischenfläche.
  softShape(g, path, cx, cy, steps=6){
    for(let k=0;k<steps;k++){
      const sc=1.18-k*(0.42/steps);
      g.save();
      g.translate(cx,cy); g.scale(sc,sc); g.translate(-cx,-cy);
      g.globalAlpha=k===steps-1? 1 : 0.30;
      path();
      g.fill();
      g.restore();
    }
    g.globalAlpha=1;
  }
  // Gouraud-Schattierung: die drei Eckfarben werden über die Dreiecksfläche
  // interpoliert. Jede baryzentrische Gewichtung ist linear und damit exakt
  // als Verlauf vom Lotfußpunkt auf der Gegenkante bis zur Ecke darstellbar;
  // additiv überlagert ergeben die drei Verläufe eine stufenlose Fläche.
  // Ohne das zerfällt jeder Hang in flache Facetten – das Gelände sieht
  // rautenförmig aus. Voraussetzung: Ziel-Canvas transparent, Modus 'lighter'.
  gouraud(g, P, C){
    const path=()=>{ g.beginPath(); g.moveTo(P[0][0],P[0][1]); g.lineTo(P[1][0],P[1][1]);
                     g.lineTo(P[2][0],P[2][1]); g.closePath(); };
    const grads=[];
    for(let k=0;k<3;k++){
      const A=P[k], B=P[(k+1)%3], D=P[(k+2)%3];
      const ex=D[0]-B[0], ey=D[1]-B[1];
      const L=ex*ex+ey*ey;
      if(L<1e-6){ grads.length=0; break; }
      const t=((A[0]-B[0])*ex+(A[1]-B[1])*ey)/L;
      const fx=B[0]+ex*t, fy=B[1]+ey*t;
      if(Math.hypot(A[0]-fx,A[1]-fy)<0.5){ grads.length=0; break; }
      const gr=g.createLinearGradient(fx,fy,A[0],A[1]);
      const c=C[k];
      gr.addColorStop(0,`rgba(${c[0]|0},${c[1]|0},${c[2]|0},0)`);
      gr.addColorStop(1,`rgba(${c[0]|0},${c[1]|0},${c[2]|0},1)`);
      grads.push(gr);
    }
    if(!grads.length){                                   // entartetes Dreieck
      const r=(C[0][0]+C[1][0]+C[2][0])/3, gg=(C[0][1]+C[1][1]+C[2][1])/3, b=(C[0][2]+C[1][2]+C[2][2])/3;
      g.fillStyle=`rgb(${r|0},${gg|0},${b|0})`;
      path(); g.fill();
      return;
    }
    for(const gr of grads){ g.fillStyle=gr; path(); g.fill(); }
  }
  tri(g, m, cols, ncache, a,b,c){
    const [ax,ay]=m.worldPos(a), [bx,by]=m.worldPos(b), [cx2,cy2]=m.worldPos(c);
    const coast=COAST_COL[this.theme]||COAST_COL.gruen;
    const ca=this.nodeColor(m,cols,coast,ncache,a);
    const cb=this.nodeColor(m,cols,coast,ncache,b);
    const cc=this.nodeColor(m,cols,coast,ncache,c);
    this.gouraud(g, [[ax,ay],[bx,by],[cx2,cy2]], [ca,cb,cc]);
    // Lava-Glut
    if(m.terr[a]===TER.LAVA){
      g.fillStyle=`rgba(255,${150+((hash01(a)*60)|0)},50,0.3)`;
      g.beginPath(); g.arc((ax+bx+cx2)/3,(ay+by+cy2)/3, 6+hash01(b)*6, 0, 7); g.fill();
    }
  }

  // ---------- Sprite-Werkzeuge (2x Supersampling für scharfe Nahansicht) ----------
  sprite(key, w, h, draw){
    let s=this.sprites.get(key);
    if(s) return s;
    const SS=2;
    const cv=document.createElement('canvas'); cv.width=w*SS; cv.height=h*SS;
    const g=cv.getContext('2d');
    g.lineJoin='round'; g.lineCap='round';
    g.scale(SS,SS);
    draw(g, w, h);
    s={cv, w, h};
    this.sprites.set(key,s);
    return s;
  }
  // ---------- Asset-Überschreibungen (Stilguide §14): PNGs aus assets/ ersetzen Prozedural-Sprites ----------
  loadAssets(){
    if(this.assets) return;
    this.assets=new Map();
    this._scales=null;
    fetch('assets/scales.json')
      .then(r=> r.ok? r.json() : null)
      .then(s=>{ if(s) this._scales=s; })
      .catch(()=>{});
    fetch('assets/manifest.json')
      .then(r=> r.ok? r.json() : null)
      .then(list=>{
        if(!Array.isArray(list)) return;
        for(const name of list){
          if(!/\.png$/i.test(name)) continue;      // JPEGs (Story-Tafeln) laufen direkt über <img src>
          const img=new Image();
          const key=name.replace(/\.png$/i,'');
          // Terrain-Texturen wirken in die Chunk-Caches hinein -> neu aufbauen
          // (auch die abgeleiteten Fels-Muster und Erzflecken verwerfen, sonst
          // bleibt ein vor dem Laden gemerktes "Bild fehlt" für immer hängen)
          // trans_-Pinsel gehören dazu: Chunks, die VOR dem Laden gebaut
          // wurden, haben sonst für immer ein leeres Geröllband/Sandufer
          // (fadedBrush/screeTile merken sich "Bild fehlt")
          // die Felsobjekte (obj_rockspire/crag/summit/cliff/glacier) wirken
          // ebenfalls in die Chunk-Caches: sie sind eingebackene Akzente
          if(key.startsWith('ter_')||key.startsWith('deco_')||key.startsWith('trans_')
             ||key.startsWith('obj_rockspire')||key.startsWith('obj_crag')
             ||key.startsWith('obj_summit')||key.startsWith('obj_cliff')
             ||key.startsWith('obj_glacier')) img.onload=()=>{
            this._terPat=null; this._rockPats=null; this._oreBlobs=null;
            this._screeTile=null; this._screePatC=null; this._fbr=null;
            this._spireTint=null; this._lasurC=null; this._felsBox=null;
            this._mineApronC=undefined;   // Minen-Schürze nutzt ter_rock_top
            this.chunks.clear();
          };
          img.src='assets/'+name;
          this.assets.set(key, img);
        }
      })
      .catch(()=>{});
  }
  // Anzeigehöhe aus dem Asset-Paket (Sheet-Proportionen, Wohnhaus=Anker)
  scaleOf(key, fb){
    return (this._scales && this._scales[key]) || fb;
  }
  // Terrain-Kacheln als durchgehendes, weltverankertes Muster (völlig nahtlos)
  terrainPattern(t, g, variant=0){
    // 512er-Kacheln: Grundskala je Terrainart; Variante 1 legt dieselbe Kachel
    // größer und gedreht darüber, damit die Wiederholung verschwindet
    const KEY={ [TER.GRASS]:['ter_grass',0.44], [TER.DESERT]:['ter_sand',0.5], [TER.SNOW]:['ter_snow',0.5],
                [TER.SWAMP]:['ter_swamp',0.5], [TER.MOUNT]:['ter_rock',0.42],
                [TER.WATER]:['ter_water',0.26], [TER.LAVA]:['ter_lava',0.5],
                // Firn liegt auf den Gipfelgraten: härter und windgeriffelt
                firn:['ter_firn',0.4] };
    const e=KEY[t];
    if(!e) return null;
    if(!this._terPat) this._terPat={};
    const ck=t+'|'+variant;
    if(this._terPat[ck]) return this._terPat[ck];
    const img=this.asset(e[0]);
    if(!img) return null;
    const pat=g.createPattern(img,'repeat');
    if(pat.setTransform){
      const mtx=variant
        ? new DOMMatrix().translate(137,229).rotate(37).scale(e[1]*1.85)
        : new DOMMatrix().scale(e[1]);
      pat.setTransform(mtx);
    } else if(variant) return null;
    this._terPat[ck]=pat;
    return pat;
  }
  // Schneegrenze: relativ zur höchsten Erhebung der Karte (einmal je Karte)
  snowLine(){
    if(this._snowLine!=null) return this._snowLine;
    const m=this.game.map;
    const hs=[];
    for(let i=0;i<m.terr.length;i++) if(m.terr[i]===TER.MOUNT) hs.push(m.hgt[i]);
    if(hs.length<40){ this._snowLine=99; return 99; }   // kaum Gebirge -> kein Schnee
    hs.sort((a,b)=>a-b);
    const p97=hs[Math.floor(hs.length*0.97)];
    // nur echte Gipfel bekommen eine Schneekappe
    this._snowLine = Math.max(1.0, p97);
    return this._snowLine;
  }
  // Untergrenze der geschlossenen Firndecke. Sie hängt an der HÖHENVERTEILUNG
  // des ganzen Massivs (oberstes Fünftel), nicht an einzelnen TER.SNOW-Knoten:
  // die vereisten Kammknoten liegen verstreut auf den Gratlinien – eine an
  // ihnen aufgehängte Decke zerfiele in weiße Einzeltupfen.
  firnLine(){
    if(this._firnLine!=null) return this._firnLine;
    const m=this.game.map;
    const msn=this.massifSnow();
    const hs=[];
    for(let i=0;i<m.terr.length;i++)
      if(m.terr[i]===TER.MOUNT || (m.terr[i]===TER.SNOW && msn[i])) hs.push(m.hgt[i]);
    if(hs.length<40){ this._firnLine=99; return 99; }   // kaum Gebirge -> kein Firn
    hs.sort((a,b)=>a-b);
    // Anteil je Thema: im Winter sind die Berge fast ganz eingeschneit (ihre
    // Füße stehen in Schnee-Ebenen – nackter Fels ergäbe harte Zacken), im
    // Hochgebirge trägt das oberste Fünftel Firn, in mildem Klima nur Kappen.
    // Auf Vulkan- und Wüstenbergen liegt gar kein Schnee.
    const p={ winter:0.25, gebirge:0.80, vulkan:2, wueste:2 }[this.theme] ?? 0.88;
    this._firnLine = p>=1 ? 99 : Math.max(1.0, hs[Math.floor(hs.length*p)]);
    return this._firnLine;
  }
  // Globale Höhenanker des Massivs (Perzentile 6/94) fürs Höhen-Licht des
  // Massiv-Passes. GLOBAL statt je Chunk: eine Chunk-lokale Normierung ergäbe
  // an jeder Chunk-Grenze einen Helligkeitssprung im Berg.
  massifHiLo(){
    if(this._hiLo) return this._hiLo;
    const m=this.game.map;
    const msn=this.massifSnow();
    const hs=[];
    for(let i=0;i<m.terr.length;i++){
      const t=m.terr[i];
      if(t===TER.MOUNT||t===TER.LAVA||(t===TER.SNOW&&msn[i])) hs.push(m.hgt[i]);
    }
    if(hs.length<20){ this._hiLo=[0.5,1.5]; return this._hiLo; }
    hs.sort((a,b)=>a-b);
    const lo=hs[Math.floor(hs.length*0.06)];
    // Mindestspanne: auf sehr flachen Massiven bliebe die Rampe sonst ein
    // Streifenmuster aus Quantisierungsstufen
    this._hiLo=[lo, Math.max(hs[Math.floor(hs.length*0.94)], lo+0.5)];
    return this._hiLo;
  }
  // SNOW-Knoten, die zum Bergmassiv gehören (vereiste Gipfelkämme). Kriterium:
  // die zusammenhängende Schneefläche ist überwiegend von Fels umschlossen.
  // Schneefelder der Ebene grenzen dagegen an Wiese/Sand und bleiben weiche
  // Bodentextur – ohne diese Trennung bekäme im Winter jede Schneewiese
  // Felstextur und Facettenlicht.
  massifSnow(){
    if(this._massifSnow) return this._massifSnow;
    const m=this.game.map;
    const n=m.terr.length;
    const out=new Uint8Array(n);
    const seen=new Uint8Array(n);
    for(let i=0;i<n;i++){
      if(seen[i] || m.terr[i]!==TER.SNOW) continue;
      const comp=[i]; seen[i]=1;
      let rockB=0, openB=0;
      for(let q=0;q<comp.length;q++){
        for(const b of m.nbs(comp[q])){
          const t=m.terr[b];
          if(t===TER.SNOW){ if(!seen[b]){ seen[b]=1; comp.push(b); } }
          else if(t===TER.MOUNT||t===TER.LAVA) rockB++;
          else openB++;
        }
      }
      if(rockB>0 && rockB>=openB*2) for(const q of comp) out[q]=1;
    }
    this._massifSnow=out;
    return out;
  }
  // Erzader als weicher runder Bodenfleck: die Erz-Kachel wird unregelmäßig
  // ausgestanzt, damit im Massiv keine Dreiecks- oder Kachelkante entsteht
  oreBlob(key){
    if(!this._oreBlobs) this._oreBlobs=new Map();
    if(this._oreBlobs.has(key)) return this._oreBlobs.get(key);
    const img=this.asset(key);
    if(!img){ this._oreBlobs.set(key,null); return null; }
    const S=138;
    const cv=document.createElement('canvas'); cv.width=S; cv.height=S;
    const t=cv.getContext('2d');
    // gröber als die Felsdecke (0.5): die Erz-Sprenkel müssen auch aus
    // mittlerer Kamerahöhe als Farbtupfer erkennbar bleiben
    const pat=t.createPattern(img,'repeat');
    if(pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.5));
    t.fillStyle=pat; t.fillRect(0,0,S,S);
    // Maske: drei überlappende weiche Kreise -> unregelmäßiger Fleck
    const mcv=document.createElement('canvas'); mcv.width=S; mcv.height=S;
    const mg=mcv.getContext('2d');
    for(let k=0;k<3;k++){
      const cx=S/2+(hash01(k*7+1)-0.5)*36, cy=S/2+(hash01(k*11+3)-0.5)*30;
      const rad=mg.createRadialGradient(cx,cy,4, cx,cy, S*0.33);
      rad.addColorStop(0,'rgba(0,0,0,0.95)');
      rad.addColorStop(0.6,'rgba(0,0,0,0.7)');
      rad.addColorStop(1,'rgba(0,0,0,0)');
      mg.fillStyle=rad;
      mg.beginPath(); mg.arc(cx,cy,S*0.33,0,7); mg.fill();
    }
    t.globalCompositeOperation='destination-in';
    t.drawImage(mcv,0,0);
    t.globalCompositeOperation='source-over';
    this._oreBlobs.set(key,cv);
    return cv;
  }
  // Nahtlose Geröll-Kachel, prozedural aus trans_scree: der Pinsel selbst ist
  // nicht kachelbar (er franst nach unten aus). Aus seiner DICHTEN Oberkante
  // werden zufällig gedrehte Ausschnitte mit Umgriff (±Kachelmaß in beide
  // Richtungen) übereinandergeworfen – das Ergebnis kachelt nahtlos und
  // liefert dem Geröllband am Bergfuß echte Einzelsteine statt Grauschleier.
  screeTile(res=1){
    if(this._screeTile && this._screeTileRes===res) return this._screeTile;
    const img=this.asset('trans_scree');
    if(!img) return null;                 // noch nicht geladen -> später erneut
    const S=256;
    // res>1 (G3): Kachel in Bake-Aufloesung – gleiche Weltmasse, mehr Pixel
    const cv=document.createElement('canvas'); cv.width=S*res; cv.height=S*res;
    const t=cv.getContext('2d');
    t.scale(res,res);
    this._screeTileRes=res;
    const W=img.naturalWidth, H=img.naturalHeight;
    for(let k=0;k<46;k++){
      const sw=Math.min(W, 70+hash01(k*7+1)*60);
      const sh=Math.min(H*0.38, 50+hash01(k*13+5)*40);
      const sx=hash01(k*29+11)*(W-sw);
      const sy=hash01(k*37+3)*Math.max(1, H*0.40-sh);
      const dx=hash01(k*17+9)*S, dy=hash01(k*23+13)*S;
      const rot=(hash01(k*41+2)-0.5)*3.2;
      for(const ox of [-S,0,S]) for(const oy of [-S,0,S]){
        t.save(); t.translate(dx+ox,dy+oy); t.rotate(rot);
        t.drawImage(img, sx,sy,sw,sh, -sw/2,-sh/2, sw,sh);
        t.restore();
      }
    }
    this._screeTile=cv;
    return cv;
  }
  // ---------- Fels-Bausteine (Referenzstil: kantige Blöcke, drei Tonwerte) ----------
  // Warme Hellgrau/Beige-Palette je Thema: [tief, dunkel, mittel, hell, licht].
  // Mittel = Grundton der Facetten, hell = Deckflächen, dunkel = Schattenseiten.
  rockPal(){
    if(this._palRock) return this._palRock;
    const PALS={
      vulkan:[[52,45,41],[84,74,66],[113,101,90],[142,129,115],[166,153,138]],
      wueste:[[112,94,70],[150,129,98],[182,160,126],[205,187,153],[221,206,177]],
      winter:[[76,75,74],[110,109,107],[143,142,139],[174,174,171],[200,201,199]],
    };
    // Standard (gruen/gebirge/...): exakt die fuenf Felstoene aus dem
    // Umbau-Papier §3 – Tiefschatten #57503F, Schatten #6A5C4A, mittel
    // #8A7E68, hell #A49B8A (= Strassen-Stein), Spitzlicht #BCAE93.
    this._palRock=PALS[this.theme]||[[87,80,63],[106,92,74],[138,126,104],[164,155,138],[188,174,147]];
    return this._palRock;
  }
  // Kleiner kantiger Trümmerblock: unregelmäßiges Fünfeck mit dunkler
  // Südost-Facette und heller, nach Nordwest gerückter Deckfläche – Licht
  // von oben links wie im ganzen Spiel. Deterministisch aus seed; ersetzt
  // die alten runden Kiesel an Bergfuß und Felsnase.
  rockChunklet(g,x,y,r,seed){
    const P=this.rockPal();
    const C=(k)=>'rgb('+(P[k][0]|0)+','+(P[k][1]|0)+','+(P[k][2]|0)+')';
    // Bodenschatten zuerst – ohne ihn klebt der Block AUF dem Boden
    g.fillStyle='rgba(28,25,21,0.28)';
    g.beginPath(); g.ellipse(x+r*0.28,y+r*0.42,r*1.12,r*0.5,0,0,7); g.fill();
    const a0=hash01(seed*17+1)*6.283;
    const pts=[];
    for(let k=0;k<5;k++){
      const a=a0+k*1.2566+(hash01(seed*23+k*7)-0.5)*0.5;
      const rr=r*(0.78+hash01(seed*31+k*5)*0.45);
      pts.push([x+Math.cos(a)*rr, y+Math.sin(a)*rr*0.72, a]);
    }
    const poly=(arr)=>{ g.beginPath(); g.moveTo(arr[0][0],arr[0][1]);
      for(let k=1;k<arr.length;k++) g.lineTo(arr[k][0],arr[k][1]); g.closePath(); };
    // Körper im Mittelton
    poly(pts); g.fillStyle=C(2); g.fill();
    // dunkle Schattenfacette: die Ecken der Südost-Hälfte plus Blockmitte
    const se=pts.filter(p=>{ const a=((p[2]%6.283)+6.283)%6.283; return a>0.2 && a<2.7; });
    if(se.length>1){
      poly([[x-r*0.12,y-r*0.10], ...se]);
      g.fillStyle=C(1); g.fill();
    }
    // helle Deckfläche: verkleinertes Polygon nach oben links geschoben
    poly(pts.map(p=>[x+(p[0]-x)*0.52-r*0.22, y+(p[1]-y)*0.52-r*0.30]));
    g.fillStyle=C(3); g.fill();
    // feine dunkle Kontur hält den Block zusammen
    poly(pts); g.strokeStyle='rgba(40,35,29,0.25)'; g.lineWidth=1; g.stroke();
  }
  // Felsnadel-Bild auf die Thema-Felspalette getönt (einmal je Bild
  // gecacht): das neutrale Hellgrau der gemalten Nadeln stünde sonst
  // fremd auf dunklem Vulkanfels bzw. warmem Wüstenstein.
  tintedSpire(key){
    if(!this._spireTint) this._spireTint=new Map();
    if(this._spireTint.has(key)) return this._spireTint.get(key);
    const img=this.asset(key);
    if(!img){ this._spireTint.set(key,null); return null; }
    const P=this.rockPal();
    const W=img.naturalWidth, H=img.naturalHeight;
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const t=cv.getContext('2d');
    t.drawImage(img,0,0);
    t.globalCompositeOperation='color';
    t.globalAlpha=0.55;
    t.fillStyle='rgb('+(P[2][0]|0)+','+(P[2][1]|0)+','+(P[2][2]|0)+')';
    t.fillRect(0,0,W,H);
    // Vulkan/Wüste zusätzlich andunkeln – die Nadel darf nicht leuchten
    if(this.theme==='vulkan'||this.theme==='wueste'){
      t.globalCompositeOperation='multiply';
      t.globalAlpha=0.45;
      t.fillRect(0,0,W,H);
    }
    t.globalAlpha=1;
    t.globalCompositeOperation='destination-in';
    t.drawImage(img,0,0);
    t.globalCompositeOperation='source-over';
    this._spireTint.set(key,cv);
    return cv;
  }
  // Alpha-Hüllrechteck eines Felsobjekts, einmal je Bild bestimmt und
  // gecacht. Die zwölf Bilder haben denselben Rahmen (512x512, 20 px
  // Bodenrand), aber sehr verschiedene Inhalte (Nadel 202 px breit,
  // Geröllkegel 492 px). Bodenschatten und Streuabstände richten sich nach
  // dem INHALT, nicht nach der Leinwand.
  felsBox(key){
    if(!this._felsBox) this._felsBox=new Map();
    let b=this._felsBox.get(key);
    if(b!==undefined) return b;
    b=null;
    const img=this.asset(key);
    if(img&&img.naturalWidth){
      const W=img.naturalWidth, H=img.naturalHeight;
      const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
      const t=cv.getContext('2d',{willReadFrequently:true});
      t.drawImage(img,0,0);
      let x0=W, x1=-1, y0=H, y1=-1;
      try{
        const d=t.getImageData(0,0,W,H).data;
        for(let y=0;y<H;y+=2){
          const row=y*W;
          for(let x=0;x<W;x+=2){
            if(d[(row+x)*4+3]<12) continue;
            if(x<x0)x0=x; if(x>x1)x1=x;
            if(y<y0)y0=y; if(y>y1)y1=y;
          }
        }
      }catch(e){ /* getImageData gesperrt -> Rueckfall unten */ }
      b= x1>=0? {x0,y0,x1,y1,w:x1-x0+1,h:y1-y0+1}
              : {x0:0,y0:0,x1:W-1,y1:H-1,w:W,h:H};
    }
    this._felsBox.set(key,b);
    return b;
  }
  // Felsobjekt zeichnen (Stilguide 11.11): EIN gemeinsamer Zeichenfaktor
  // FELS_F, Unterkante des Bildinhalts = Bodenlinie am Knoten. sc ist eine
  // leichte Streuung je FUNDORT (nicht je Bild) – die relativen Größen
  // kommen aus dem Bild. Liefert die Inhaltsmaße auf dem Schirm zurück.
  drawFelsObj(g, key, x, y, sc, spiegel, schatten){
    const img=this.tintedSpire(key);
    if(!img) return null;
    const W=img.naturalWidth||img.width, H=img.naturalHeight||img.height;
    const f=FELS_F*(sc||1);
    const dw=W*f, dh=H*f;
    const bx=this.felsBox(key);
    const cw=(bx? bx.w : W)*f, ch=(bx? bx.h : H)*f;
    if(schatten>0){
      g.fillStyle='rgba(30,27,23,'+schatten+')';
      g.beginPath();
      g.ellipse(x+cw*0.10, y+2.5, cw*0.44, cw*0.15, 0, 0, 7);
      g.fill();
    }
    g.save();
    if(spiegel){ g.translate(x,0); g.scale(-1,1); g.translate(-x,0); }
    // die Bildunterkante liegt FELS_BODEN unter der Bodenlinie
    g.drawImage(img, x-dw/2, y-dh+FELS_BODEN*f, dw, dh);
    g.restore();
    return {w:cw, h:ch};
  }
  // Lasur-Kachel für die Felsflächen und -wände (Stilguide 11.1: "Die
  // Textur muss lauter sein als die Schattierung", Kennwert
  // (p95/p5 der Luminanz)/1.82 im Zielband 1.2-1.5).
  //
  // Roh aufgelegt reicht keine Kachel an dieses Band heran: 'overlay' auf
  // einen hellen Untergrund staucht die dunkle Haelfte, aus 1.14 der
  // Quellkachel werden im Endbild rund 1.0 – das Dreiecksgitter scheint
  // durch. Deshalb wird die Kachel EINMAL je Bild/Thema vorbehandelt:
  //   1) Kontrast anheben, indem die Kachel mit SICH SELBST 'overlay'
  //      ueberlagert wird (kein ctx.filter – der ist auf iOS gesperrt).
  //      Fugen werden tiefer, Plattenruecken heller, der Mittelton bleibt.
  //   2) Farbe auf die Thema-Felspalette ziehen und dabei entsaettigen:
  //      'overlay' multipliziert die Kanaldifferenzen, eine Kachel mit
  //      voller Saettigung 0.40 landet im Endbild sonst bei 0.50.
  //      Ziel laut 11.7: 0.38-0.42.
  // Gecacht wie tintedSpire; wird beim Nachladen von Bildern verworfen.
  felsLasur(key){
    if(!this._lasurC) this._lasurC=new Map();
    if(this._lasurC.has(key)) return this._lasurC.get(key);
    const img=this.asset(key);
    if(!img||!img.naturalWidth){ this._lasurC.set(key,null); return null; }
    const W=img.naturalWidth, H=img.naturalHeight;
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const t=cv.getContext('2d');
    t.drawImage(img,0,0);
    // 1) Eigenkontrast
    t.globalCompositeOperation='overlay';
    t.globalAlpha=0.82;
    t.drawImage(img,0,0);
    // 2) Farbton/Saettigung auf die entsaettigte Palettenmitte
    const P=this.rockPal()[2];
    const Lp=0.299*P[0]+0.587*P[1]+0.114*P[2];
    // 'overlay' MULTIPLIZIERT den Farbstich von Untergrund und Lasur (aus
    // zweimal r/b=1.33 wird 1.77). Die Lasur muss deshalb fast neutral
    // sein – die Farbe kommt aus der Palette in colAt, die Lasur liefert
    // nur die Zeichnung. Mit voller Kachelsaettigung landete der Fels im
    // Endbild bei 0.58 statt bei den geforderten 0.38-0.42.
    const d=0.97;                       // Entsaettigung der Lasur
    const cc=[P[0]+(Lp-P[0])*d, P[1]+(Lp-P[1])*d, P[2]+(Lp-P[2])*d];
    t.globalCompositeOperation='color';
    t.globalAlpha=0.94;
    t.fillStyle='rgb('+(cc[0]|0)+','+(cc[1]|0)+','+(cc[2]|0)+')';
    t.fillRect(0,0,W,H);
    t.globalAlpha=1;
    t.globalCompositeOperation='source-over';
    this._lasurC.set(key,cv);
    return cv;
  }
  // Prozedurale Felsnadel als Rückfall, solange obj_rockspire_*
  // fehlen: schlanker, gestufter Keil mit heller Westflanke, dunkler
  // Ostflanke, Stufenkanten und Spitzenlicht (Referenz: Felsnadel).
  drawRockNeedle(g,x,y,h,seed){
    const P=this.rockPal();
    const C=(k)=>'rgb('+(P[k][0]|0)+','+(P[k][1]|0)+','+(P[k][2]|0)+')';
    const w=h*0.36*(0.9+hash01(seed*7+2)*0.3);
    const tx=x+(hash01(seed*11+4)-0.5)*w*0.5;
    const NS=3;
    const L=[],R=[],M=[];
    for(let k=0;k<NS;k++){
      const u=k/NS*0.82;
      const yy=y-u*h;
      const ww=w*(1-u*0.8);
      const cx=x+(tx-x)*u;
      L.push([cx-ww*0.5+(hash01(seed*13+k*5)-0.5)*w*0.2, yy]);
      R.push([cx+ww*0.5+(hash01(seed*17+k*7)-0.5)*w*0.2, yy]);
      M.push([cx-ww*0.06+(hash01(seed*19+k*11)-0.5)*w*0.16, yy]);
    }
    const top=[tx,y-h];
    const sil=()=>{
      g.beginPath();
      g.moveTo(L[0][0],L[0][1]);
      for(let k=1;k<NS;k++) g.lineTo(L[k][0],L[k][1]);
      g.lineTo(top[0],top[1]);
      for(let k=NS-1;k>=0;k--) g.lineTo(R[k][0],R[k][1]);
      g.closePath();
    };
    sil(); g.fillStyle=C(2); g.fill();
    // helle Westflanke (Licht von oben links)
    g.beginPath();
    g.moveTo(L[0][0],L[0][1]);
    for(let k=1;k<NS;k++) g.lineTo(L[k][0],L[k][1]);
    g.lineTo(top[0],top[1]);
    for(let k=NS-1;k>=0;k--) g.lineTo(M[k][0],M[k][1]);
    g.closePath();
    g.fillStyle=C(3); g.fill();
    // dunkle Ostflanke
    g.beginPath();
    g.moveTo(M[0][0],M[0][1]);
    for(let k=1;k<NS;k++) g.lineTo(M[k][0],M[k][1]);
    g.lineTo(top[0],top[1]);
    for(let k=NS-1;k>=0;k--) g.lineTo(R[k][0],R[k][1]);
    g.closePath();
    g.fillStyle=C(1); g.fill();
    // Stufenabsätze: kurze dunkle Querkanten mit Lichtkante darüber
    for(let k=1;k<NS;k++){
      g.strokeStyle='rgba(40,35,29,0.30)'; g.lineWidth=1.2;
      g.beginPath(); g.moveTo(L[k][0],L[k][1]); g.lineTo(M[k][0],M[k][1]+1); g.stroke();
      g.strokeStyle='rgba(255,250,240,0.25)'; g.lineWidth=1;
      g.beginPath(); g.moveTo(L[k][0]+0.6,L[k][1]-1); g.lineTo(M[k][0]+0.6,M[k][1]); g.stroke();
    }
    // Spitzenlicht
    g.beginPath();
    g.moveTo(top[0],top[1]);
    g.lineTo(L[NS-1][0],L[NS-1][1]);
    g.lineTo((L[NS-1][0]+top[0])/2+1.5,(L[NS-1][1]+top[1])/2);
    g.closePath();
    g.fillStyle=C(4); g.fill();
    sil(); g.strokeStyle='rgba(40,35,29,0.28)'; g.lineWidth=1.1; g.stroke();
  }
  // Fels-Schürze unter Bergwerken (Minen-Verankerung, IMG_7989): eine
  // weich auslaufende Platte in der Fels-Plattentextur plus Kontaktschatten.
  // Einmal je Thema gebaut und gecacht; deterministisch, kein ctx.filter.
  mineApron(g, x, y, ww){
    // Die Schürze muss in DERSELBEN Plattengröße laufen wie die Felsfläche
    // ringsum (Nutzerkritik "die Mine sieht aus wie ein Fremdkörper"): die
    // Flächenkachel liegt auf dem Schirm bei TILE*2.37 px je Kachel. Die
    // Schürze wird in einer 220 px breiten Vorlage gebaut und auf aw px
    // gezeichnet – der Musterfaktor muss diese Verkleinerung ausgleichen.
    const aw=ww*1.55;
    const kf=Math.round(aw);
    let ap=this._mineApronC;
    if(ap===undefined || this._mineApronW!==kf){
      const W=220, H=132;
      ap=document.createElement('canvas'); ap.width=W; ap.height=H;
      const t=ap.getContext('2d');
      const im=this.tintedSpire('ter_rock_top');
      if(im){
        const pt=t.createPattern(im,'repeat');
        const iw=im.naturalWidth||im.width||1024;
        if(pt.setTransform)
          pt.setTransform(new DOMMatrix().scale((TILE*2.37/iw)*(W/Math.max(1,aw))));
        t.fillStyle=pt;
      } else {
        const P=this.rockPal();
        t.fillStyle='rgb('+(P[2][0]|0)+','+(P[2][1]|0)+','+(P[2][2]|0)+')';
      }
      t.beginPath(); t.ellipse(W/2,H/2,W*0.49,H*0.47,0,0,7); t.fill();
      // leise Plastik: oben-links heller, unten-rechts dunkler (Sonnenseite)
      const lg=t.createLinearGradient(0,0,W,H);
      lg.addColorStop(0,'rgba(255,250,238,0.14)');
      lg.addColorStop(0.5,'rgba(0,0,0,0)');
      lg.addColorStop(1,'rgba(30,26,20,0.20)');
      t.globalCompositeOperation='source-atop';
      t.fillStyle=lg; t.fillRect(0,0,W,H);
      // weiche Aussenkante ohne ctx.filter: radiale Alphamaske, elliptisch
      // gestaucht auf die Plattenform
      t.globalCompositeOperation='destination-in';
      t.save(); t.translate(W/2,H/2); t.scale(1,H/W);
      const rg=t.createRadialGradient(0,0,W*0.12, 0,0,W*0.50);
      rg.addColorStop(0,'rgba(0,0,0,1)');
      rg.addColorStop(0.68,'rgba(0,0,0,1)');
      rg.addColorStop(1,'rgba(0,0,0,0)');
      t.fillStyle=rg; t.fillRect(-W/2,-W*0.5,W,W);
      t.restore();
      t.globalCompositeOperation='source-over';
      this._mineApronC=ap; this._mineApronW=kf;
    }
    if(ap){
      const ah=aw*(ap.height/ap.width);
      g.drawImage(ap, x-aw/2, y+7-ah*0.56, aw, ah);
    }
    // Kontaktschatten: der Dom steht AUF der Schürze
    const sh=g.createRadialGradient(x+2,y+4,2, x+2,y+4, ww*0.55);
    sh.addColorStop(0,'rgba(26,22,18,0.30)');
    sh.addColorStop(1,'rgba(26,22,18,0)');
    g.fillStyle=sh;
    g.beginPath(); g.ellipse(x+2,y+4, ww*0.55, ww*0.22, 0, 0, 7); g.fill();
  }
  // Globales Anhebungsfeld (G1): fuer jeden Massivknoten wird per
  // Multi-Source-BFS vom Massivrand die Hoehe der angrenzenden Ebene
  // propagiert; das lokale Relief (Kamm in Reichweite 3 minus Ebene) wird
  // auf ~1.7 Hoeheneinheiten aufgefuellt. Das Profil waechst vom Rand
  // (0.55) ueber Ring 2 (0.9) zum Inneren (1.0) – Kuppe statt Donut,
  // auch bei BREITEN flachen Massiven (die alte je-Knoten-Suche liess
  // dort das Innere auf 0 fallen: Rand hoch, Mitte tief). Einmal je
  // Karte gebaut, deterministisch, chunkuebergreifend stabil.
  liftField(){
    if(this._liftFld) return this._liftFld;
    const m=this.game.map;
    const msn=this.massifSnow();
    const N=m.terr.length;
    const isMas=(q)=>{ const t=m.terr[q]; return t===TER.MOUNT||(t===TER.SNOW&&msn[q]); };
    const dist=new Int32Array(N).fill(1<<29);
    const plainH=new Float32Array(N);
    let ring=[];
    for(let i=0;i<N;i++){
      if(!isMas(i)) continue;
      let pS=0, pN=0;
      for(const q of m.nbs(i))
        if(!isMas(q) && m.terr[q]!==TER.LAVA){ pS+=m.hgt[q]; pN++; }
      if(pN){ dist[i]=1; plainH[i]=pS/pN; ring.push(i); }
    }
    for(let d=2; ring.length; d++){
      const nx=[];
      for(const i of ring) for(const q of m.nbs(i)){
        if(!isMas(q) || dist[q]<=d) continue;
        if(dist[q]===(1<<29)){ dist[q]=d; plainH[q]=plainH[i]; nx.push(q); }
      }
      ring=nx;
    }
    const lift=new Float32Array(N);
    const rel=new Float32Array(N);
    for(let i=0;i<N;i++){
      if(!isMas(i) || dist[i]===(1<<29)) continue;
      // Kamm in Reichweite 3 (kleiner Ring-BFS je Knoten)
      let crest=m.hgt[i];
      let r2=[i]; const seen=new Set([i]);
      for(let d=0; d<3; d++){
        const nx=[];
        for(const p of r2) for(const q of m.nbs(p)){
          if(seen.has(q)) continue; seen.add(q);
          if(isMas(q)){ nx.push(q); if(m.hgt[q]>crest) crest=m.hgt[q]; }
        }
        r2=nx;
      }
      const rl=Math.max(0, crest-plainH[i]);
      const deficit=Math.max(0, 1.7-rl);
      const prof= dist[i]<=1? 0.55 : dist[i]===2? 0.9 : 1.0;
      lift[i]=deficit*prof;
      rel[i]=rl;
    }
    this._liftFld={lift, rel};
    return this._liftFld;
  }
  // Gezeichnete Anhebung eines Knotens (G1, aus dem Chunk-Bake gecacht):
  // Schilder/Fahnen auf angehobenem Fels ruecken um denselben Betrag hoch.
  // Vor dem ersten Bake der Umgebung 0 – dann steht dort ohnehin noch
  // kein gebackener Fels im Bild.
  liftAt(i){
    const v=this._liftC && this._liftC.get(i);
    return v? v.lift : 0;
  }
  // Richtung des stärksten Gefälles
  gradOf(m,i){
    let gx=0, gy=0;
    for(const n of m.nbs(i)){
      const ddx=(m.X(n)+((m.Y(n)&1)*0.5))-(m.X(i)+((m.Y(i)&1)*0.5));
      const ddy=m.Y(n)-m.Y(i);
      const dh=m.hgt[n]-m.hgt[i];
      gx+=dh*ddx; gy+=dh*ddy;
    }
    const L=Math.hypot(gx,gy);
    return L>1e-4 ? [gx/L, gy/L] : null;
  }
  // Steigung (Betrag des Höhengradienten) – für Schluchten und Felsplastik
  slopeOf(m,i){
    let gx=0, gy=0;
    for(const n of m.nbs(i)){
      const ddx=(m.X(n)+((m.Y(n)&1)*0.5))-(m.X(i)+((m.Y(i)&1)*0.5));
      const ddy=m.Y(n)-m.Y(i);
      const dh=m.hgt[n]-m.hgt[i];
      gx+=dh*ddx; gy+=dh*ddy;
    }
    return Math.hypot(gx,gy);
  }
  // Graustufen-Relief je Knoten (128 = eben, hell = der Sonne zugewandt)
  nodeShade(m, scache, i){
    let v=scache.get(i);
    if(v!==undefined) return v;
    let gx=0, gy=0;
    for(const n of m.nbs(i)){
      const ddx=(m.X(n)+((m.Y(n)&1)*0.5))-(m.X(i)+((m.Y(i)&1)*0.5));
      const ddy=m.Y(n)-m.Y(i);
      const dh=m.hgt[n]-m.hgt[i];
      gx+=dh*ddx; gy+=dh*ddy;
    }
    const t=m.terr[i];
    // Gebirge nur noch SCHWACH: das Licht liefern die flachen Blockfacetten
    // des Massiv-Passes – ein kräftiger Weichlicht-Verlauf darüber würde
    // die flachen Tonflächen wieder zu weichem Relief verschmieren
    let k = t===TER.MOUNT? 0.5 : t===TER.WATER? 0.12 : 1.15;
    let lo=0.14, hi=0.94;
    if(t===TER.MOUNT){ lo=0.30; hi=0.76; }
    // unter der Firndecke nur noch sanft modellieren: eine einzelne
    // Steilstufe mitten im Eisfeld stünde sonst als dunkler Pfeil im Weiß
    if((t===TER.MOUNT || (t===TER.SNOW && this.massifSnow()[i])) && m.hgt[i]>this.firnLine()-1.2){
      k=0.45; lo=0.30; hi=0.78;
    }
    // Sonne von oben-links (wie alle Schlagschatten): nach Nordwest geneigte
    // Hänge hell, nach Südost geneigte dunkel
    let l = 0.5 + (gx*0.8+gy*0.6)*k;
    l = Math.max(lo, Math.min(hi, l));
    v = Math.round(l*255);
    scache.set(i,v);
    return v;
  }
  // Schatten kühl-blau, Licht warm – wirkt deutlich plastischer als reines Grau
  shadeCol(v){
    const t2=(v-128)/127;
    return t2<0
      ? [128+t2*54, 128+t2*44, 128+t2*22]        // Richtung kühles Blau
      : [128+t2*60, 128+t2*52, 128+t2*34];       // Richtung warmes Sonnenlicht
  }
  triShade(g, m, scache, a, b, c){
    const A=m.worldPos(a), B=m.worldPos(b), C=m.worldPos(c);
    // Übergefaltete Dreiecke überspringen: an hohen Steilwänden klappt die
    // Projektion um (die obere Knotenzeile rutscht auf dem Bildschirm UNTER
    // die untere). Im Additiv-Modus 'lighter' wurde der doppelt überdeckte
    // Bereich doppelt so hell und stand als gleißende "Folien"-Dreiecke auf
    // dem Fels – unabhängig von den eigentlichen Schattierungswerten.
    if((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]) <= 0) return;
    this.gouraud(g, [A,B,C],
      [this.shadeCol(this.nodeShade(m,scache,a)),
       this.shadeCol(this.nodeShade(m,scache,b)),
       this.shadeCol(this.nodeShade(m,scache,c))]);
  }
  asset(key){
    const img=this.assets && this.assets.get(key);
    return (img && img.complete && img.naturalWidth>0) ? img : null;
  }
  // ---------- Spielerfarben auf Bilder legen ----------
  // Militärgebäude: die cremefarbenen Banner/Wimpel bekommen die Spielerfarbe.
  // Ergebnis wird je (Bild, Spieler) einmal gerendert und gecacht.
  fadedBrush(key){
    if(!this._fbr) this._fbr=new Map();
    if(this._fbr.has(key)) return this._fbr.get(key);
    const img=this.asset(key);
    if(!img){ this._fbr.set(key,null); return null; }
    const W=img.naturalWidth, H=img.naturalHeight;
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const t=cv.getContext('2d');
    t.drawImage(img,0,0);
    t.globalCompositeOperation='destination-in';
    const gv=t.createLinearGradient(0,0,0,H);
    gv.addColorStop(0,'rgba(0,0,0,0)');
    gv.addColorStop(0.30,'rgba(0,0,0,1)');
    gv.addColorStop(1,'rgba(0,0,0,1)');
    t.fillStyle=gv; t.fillRect(0,0,W,H);
    const gh=t.createLinearGradient(0,0,W,0);
    gh.addColorStop(0,'rgba(0,0,0,0)');
    gh.addColorStop(0.22,'rgba(0,0,0,1)');
    gh.addColorStop(0.78,'rgba(0,0,0,1)');
    gh.addColorStop(1,'rgba(0,0,0,0)');
    t.fillStyle=gh; t.fillRect(0,0,W,H);
    t.globalCompositeOperation='source-over';
    this._fbr.set(key,cv);
    return cv;
  }
  // Turmspitzen eines Gebäudebildes finden (oberste Punkte je Turm) – dort
  // setzt das Spiel Wimpel in Spielerfarbe. Ergebnis wird je Bild gecacht.
  towerTips(img, key){
    if(!this._tips) this._tips=new Map();
    if(this._tips.has(key)) return this._tips.get(key);
    let tips=[];
    try{
      const W=img.naturalWidth, H=img.naturalHeight;
      const cv=document.createElement('canvas');
      cv.width=W; cv.height=H;
      const t=cv.getContext('2d',{willReadFrequently:true});
      t.drawImage(img,0,0);
      const d=t.getImageData(0,0,W,H).data;
      const top=new Float32Array(W).fill(H+1);
      for(let x=0;x<W;x++){
        for(let y=0;y<H;y++){ if(d[(y*W+x)*4+3]>150){ top[x]=y; break; } }
      }
      const valid=[...top].filter(v=>v<=H);
      if(!valid.length){ this._tips.set(key,[]); return []; }
      valid.sort((a2,b2)=>a2-b2);
      const med=valid[valid.length>>1];
      const win=Math.max(3, Math.round(W*0.04));
      const cand=[];
      for(let x=win;x<W-win;x++){
        if(top[x]>H) continue;
        if(top[x] > med-H*0.06) continue;           // nur deutlich herausragende Spitzen
        let isMin=true;
        for(let k=1;k<=win;k++){
          if(top[x-k]<top[x] || top[x+k]<top[x]){ isMin=false; break; }
        }
        if(isMin) cand.push({x, y:top[x]});
      }
      // dicht beieinander liegende Kandidaten zusammenfassen
      const merged=[];
      for(const c of cand){
        const near=merged.find(mm=>Math.abs(mm.x-c.x)<W*0.08);
        if(near){ if(c.y<near.y){ near.x=c.x; near.y=c.y; } }
        else merged.push({...c});
      }
      // Die vorhandenen Wimpel wehen nach rechts: eine Spitze, die rechts neben
      // und knapp unter einer anderen liegt, ist die Tuchspitze – kein zweiter Turm
      for(let a2=merged.length-1;a2>=0;a2--){
        const c=merged[a2];
        if(merged.some(o=>o!==c && o.x<c.x && c.x-o.x<W*0.24 && c.y>o.y && c.y-o.y<H*0.07))
          merged.splice(a2,1);
      }
      merged.sort((p1,p2)=>p1.y-p2.y);
      tips=merged.slice(0,6).map(c=>[c.x/W, c.y/H]);
    }catch(_){ tips=[]; }
    this._tips.set(key,tips);
    return tips;
  }
  // Wimpel in Spielerfarbe an einer Turmspitze
  drawTowerFlag(g, x, y, size, pl, phase){
    const col=PLAYER_COLORS[pl]||'#999';
    const w=Math.sin(this.time/240+phase)*size*0.12;
    g.strokeStyle='#4a3826'; g.lineWidth=Math.max(1, size*0.09);
    g.beginPath(); g.moveTo(x,y+size*0.15); g.lineTo(x,y-size*0.62); g.stroke();
    g.fillStyle=col;
    g.beginPath();
    g.moveTo(x, y-size*0.60);
    g.quadraticCurveTo(x+size*0.45, y-size*0.56+w, x+size*0.86, y-size*0.40+w);
    g.lineTo(x+size*0.52, y-size*0.28+w*0.6);
    g.lineTo(x+size*0.80, y-size*0.14+w*0.5);
    g.quadraticCurveTo(x+size*0.40, y-size*0.20+w*0.5, x, y-size*0.16);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(25,18,10,0.5)'; g.lineWidth=Math.max(0.7,size*0.05); g.stroke();
    g.fillStyle='rgba(255,255,255,0.22)';
    g.beginPath();
    g.moveTo(x, y-size*0.60);
    g.quadraticCurveTo(x+size*0.45, y-size*0.56+w, x+size*0.86, y-size*0.40+w);
    g.lineTo(x+size*0.74, y-size*0.36+w);
    g.quadraticCurveTo(x+size*0.42, y-size*0.50+w, x, y-size*0.52);
    g.closePath(); g.fill();
    g.fillStyle='#c9a05a';
    g.beginPath(); g.arc(x, y-size*0.66, Math.max(0.9,size*0.07), 0, 7); g.fill();
  }
  // Soldaten: Umhang/Helmbusch (blaue Flächen) als Maske, im Spiel eingefärbt
  unitMask(img){
    if(!this._uMask) this._uMask=new Map();
    const key=img.src;
    if(this._uMask.has(key)) return this._uMask.get(key);
    let out=null;
    try{
      const cv=document.createElement('canvas');
      cv.width=img.naturalWidth; cv.height=img.naturalHeight;
      const t=cv.getContext('2d',{willReadFrequently:true});
      t.drawImage(img,0,0);
      const id=t.getImageData(0,0,cv.width,cv.height), d=id.data;
      let n=0;
      for(let p=0;p<d.length;p+=4){
        const r=d[p], gg=d[p+1], b=d[p+2], a=d[p+3];
        const blue = a>50 && b>r*1.22 && b>gg*1.1 && (b-Math.min(r,gg))>24;
        if(blue){
          const l=0.299*r+0.587*gg+0.114*b;
          const v=Math.min(255, 96+l*0.85);            // Graustufe = Schattierung
          d[p]=v; d[p+1]=v; d[p+2]=v;
          n++;
        } else d[p+3]=0;
      }
      if(n>40){ t.putImageData(id,0,0); out=cv; }
    }catch(_){ out=null; }
    this._uMask.set(key,out);
    return out;
  }
  // Welcher Baum steht hier? Landschaft, Nachbarschaft und Wachstumsstufe
  treeKindOf(m,i,st,hsh){
    if(st===1 && this.asset('tree_sapling')) return 'tree_sapling';
    const th=this.theme;
    const nearWater=m.nbs(i).some(n=>m.terr[n]===TER.WATER);
    if(nearWater && this.asset('tree_willow') && hsh<0.55) return 'tree_willow';
    const SETS={
      gruen:  ['tree_oak','tree_beech','tree_birch','tree_spruce','tree_conifer'],
      inseln: ['tree_oak','tree_beech','tree_palm','tree_birch'],
      winter: ['tree_winter','tree_spruce','tree_conifer','tree_dead'],
      wueste: ['tree_palm','tree_dead','tree_stump'],
      vulkan: ['tree_dead','tree_conifer','tree_stump'],
      sumpf:  ['tree_willow','tree_birch','tree_dead','tree_beech'],
      gebirge:['tree_spruce','tree_conifer','tree_birch'],
    };
    const list=(SETS[th]||SETS.gruen).filter(k=>this.asset(k));
    if(!list.length) return this.asset('tree_leaf')?'tree_leaf':'tree_conifer';
    return list[Math.floor(hsh*list.length)%list.length];
  }
  // Baumbilder einmalig an die Wiesenpalette anpassen + zum Boden hin abdunkeln
  tintedTree(key){
    const img=this.asset(key);
    if(!img) return null;
    if(!this._tint) this._tint=new Map();
    let cv=this._tint.get(key);
    if(cv) return cv;
    cv=document.createElement('canvas');
    cv.width=img.naturalWidth; cv.height=img.naturalHeight;
    const t=cv.getContext('2d');
    t.drawImage(img,0,0);
    t.globalCompositeOperation='source-atop';
    // die neuen Bäume sind bereits farblich abgestimmt – kein Farbstich mehr
    const gr=t.createLinearGradient(0,cv.height*0.72,0,cv.height);
    gr.addColorStop(0,'rgba(40,54,28,0)');        // unten leicht verschattet -> verwurzelt
    gr.addColorStop(1,'rgba(40,54,28,0.3)');
    t.fillStyle=gr;
    t.fillRect(0,0,cv.width,cv.height);
    t.globalCompositeOperation='source-over';
    this._tint.set(key,cv);
    return cv;
  }
  shadow(g,x,y,rx,ry,a=0.26){
    g.fillStyle=`rgba(12,18,10,${a})`;
    g.beginPath(); g.ellipse(x,y,rx,ry,0,0,7); g.fill();
  }

  // ================= Gebäude-Sprites =================
  bldSprite(type, player, state){
    const key=`b_${type}_${player}_${state}`;
    const def=BLD[type];
    const big=def.size==='L'||type==='hq', med=def.size==='M';
    const W=big?96:med?80:64, H=big?92:med?78:64;
    return this.sprite(key, W, H, (g)=>{
      const pc=PLAYER_COLORS[player]||'#888', pcd=PLAYER_COLORS_DARK[player]||'#555';
      g.translate(0.5,0.5);
      // ---- gemeinsame Zeichen-Helfer ----
      // ---- Pseudo-3D: rechte Seitenflächen mit Tiefe D ----
      const D=8, DY=0.55;
      const sideQuad=(x1,y1,x2,y2,col)=>{
        const path=()=>{
          g.beginPath();
          g.moveTo(x1,y1); g.lineTo(x1+D,y1-D*DY);
          g.lineTo(x2+D,y2-D*DY); g.lineTo(x2,y2);
          g.closePath();
        };
        path(); g.fillStyle=col; g.fill();
        // Seitenfläche dunkelt nach rechts ab -> plastischer
        const gr=g.createLinearGradient(x1,0,x1+D,0);
        gr.addColorStop(0,'rgba(0,0,0,0.02)'); gr.addColorStop(1,'rgba(0,0,0,0.22)');
        path(); g.fillStyle=gr; g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.1; g.stroke();
      };
      const wallGrad=(x,y,w,h,light='#f2e6c9',dark='#d5c39a')=>{
        sideQuad(x+w,y+2,x+w,y+h,'#b39a70');
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,light); gr.addColorStop(1,dark);
        g.fillStyle=gr; rr(g,x,y,w,h,2.5); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        // Verwitterungsschlieren (Patina)
        g.strokeStyle='rgba(96,74,48,0.12)'; g.lineWidth=2;
        const sd=(w*7+h*3)|0;
        for(let k=0;k<2;k++){
          const wx2=x+w*(0.18+hash01(sd+k*5)*0.64);
          g.beginPath(); g.moveTo(wx2,y+2); g.lineTo(wx2+1,y+h*0.5+hash01(sd+k)*h*0.3); g.stroke();
        }
      };
      const stoneGrad=(x,y,w,h)=>{
        sideQuad(x+w,y+2,x+w,y+h,'#87816f'+'');
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,'#d2cdc1'); gr.addColorStop(1,'#a19b8e');
        g.fillStyle=gr; rr(g,x,y,w,h,2.5); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        // romanisches Quadermauerwerk: Lagen mit versetzten Stoßfugen
        g.strokeStyle='rgba(80,70,58,0.22)'; g.lineWidth=1;
        let row=0;
        for(let yy=y+5;yy<y+h-3;yy+=5.5,row++){
          g.beginPath(); g.moveTo(x+2,yy); g.lineTo(x+w-2,yy); g.stroke();
          for(let xx=x+5+(row%2?5:0); xx<x+w-3; xx+=10){
            g.beginPath(); g.moveTo(xx,yy); g.lineTo(xx,Math.min(yy+5.5,y+h-2)); g.stroke();
          }
        }
        // helle Eckquader
        g.fillStyle='rgba(255,255,255,0.14)';
        for(let yy=y+3; yy<y+h-5; yy+=11){ g.fillRect(x+1,yy,4.5,5); g.fillRect(x+w-5.5,yy+5.5,4.5,5); }
      };
      // Blockhaus aus liegenden Stämmen (Waldarbeiter-Hütten)
      const logWall=(x,y,w,h)=>{
        sideQuad(x+w,y+2,x+w,y+h,'#7d5a34');
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,'#c99e66'); gr.addColorStop(1,'#a37c4c');
        g.fillStyle=gr; rr(g,x,y,w,h,3); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        g.strokeStyle='rgba(90,60,30,0.4)'; g.lineWidth=1.1;
        for(let yy=y+4.5;yy<y+h-2;yy+=4.5){
          g.beginPath(); g.moveTo(x+1.5,yy); g.lineTo(x+w-1.5,yy); g.stroke();
        }
        // Stirnseiten der Stämme
        g.fillStyle='#d9b37d';
        for(let yy=y+2.2;yy<y+h-2;yy+=4.5){
          g.beginPath(); g.arc(x+1.6,yy+2.2,1.5,0,7); g.fill();
        }
      };
      // heller Verputz mit Bruchstein-Sockel (Stadthandwerker)
      const plaster=(x,y,w,h)=>{
        sideQuad(x+w,y+2,x+w,y+h,'#c2b193');
        const gr=g.createLinearGradient(0,y,0,y+h);
        gr.addColorStop(0,'#f4ecd9'); gr.addColorStop(1,'#ddd0b3');
        g.fillStyle=gr; rr(g,x,y,w,h,2.5); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        // Bruchstein-Sockel
        g.fillStyle='#a89f8d'; g.fillRect(x+1,y+h-6,w-2,5);
        g.strokeStyle='rgba(80,70,58,0.3)'; g.lineWidth=0.9;
        for(let xx=x+4;xx<x+w-3;xx+=6.5){
          g.beginPath(); g.arc(xx,y+h-3.4,2.4,Math.PI,0); g.stroke();
        }
      };
      const timber=(x,y,w,h)=>{
        g.strokeStyle='rgba(140,105,62,0.55)'; g.lineWidth=2.2;
        g.beginPath();
        g.moveTo(x+w*0.33,y+2); g.lineTo(x+w*0.33,y+h-2);
        g.moveTo(x+w*0.66,y+2); g.lineTo(x+w*0.66,y+h-2);
        g.stroke();
        g.lineWidth=1.6;
        g.beginPath(); g.moveTo(x+2,y+h-2); g.lineTo(x+w*0.33,y+2); g.moveTo(x+w*0.66,y+h-2); g.lineTo(x+w-2,y+2); g.stroke();
      };
      // rechte Dachfläche (Pseudo-3D)
      const roofSide=(x,y,w,rh,over,col)=>{
        g.fillStyle=col;
        g.beginPath();
        g.moveTo(x+w/2,y-rh);
        g.lineTo(x+w/2+D,y-rh-D*DY);
        g.lineTo(x+w+over+D,y+1-D*DY);
        g.lineTo(x+w+over,y+1);
        g.closePath(); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.1; g.stroke();
      };
      const gableFront=(x,y,w,rh,over)=>{
        // leichte handwerkliche Asymmetrie: Firstpunkt und Überstände variieren
        const wk=(hash01(((w*31+rh*17)|0)+1)-0.5)*4;
        const oL=over+wk*0.8, oR=over-wk*0.5, ax=x+w/2+wk;
        g.beginPath();
        g.moveTo(x-oL,y+1);
        g.quadraticCurveTo(x+w*0.16,y-rh*0.62, ax-3,y-rh+1.5);
        g.quadraticCurveTo(ax,y-rh-1.5, ax+3,y-rh+1.5);
        g.quadraticCurveTo(x+w*0.84,y-rh*0.62, x+w+oR,y+1);
        g.quadraticCurveTo(x+w/2,y+4, x-oL,y+1);
        g.closePath();
      };
      // Moosflecken auf Dachflächen (Verwitterung, deterministisch je Form)
      const roofMoss=(x,y,w,rh)=>{
        const seed=(w*13+rh*7)|0;
        g.fillStyle='rgba(104,132,66,0.45)';
        for(let k=0;k<3;k++){
          if(hash01(seed+k*3)>0.75) continue;
          const mx=x+w*(0.2+hash01(seed+k)*0.6);
          const my=y-rh*(0.15+hash01(seed+k*7)*0.35);
          g.beginPath(); g.ellipse(mx,my,3.4+hash01(seed+k*11)*3,2+hash01(seed+k*13)*1.5,hash01(seed+k)*3,0,7); g.fill();
        }
        g.fillStyle='rgba(140,166,90,0.35)';
        g.beginPath(); g.ellipse(x+w*(0.3+hash01(seed+29)*0.4), y-rh*0.28, 2.2, 1.4, 0.5, 0, 7); g.fill();
      };
      const roofGable=(x,y,w,rh,color,over=6)=>{
        const base=mixArr(hex2arr(color),[255,255,255],0.16);
        const cl=(f)=>`rgb(${base.map(v=>Math.max(0,Math.min(255,v*f))|0).join(',')})`;
        roofSide(x,y,w,rh,over,cl(0.6));
        const gr=g.createLinearGradient(0,y-rh,0,y);
        gr.addColorStop(0,cl(1.16)); gr.addColorStop(1,cl(0.85));
        g.fillStyle=gr;
        gableFront(x,y,w,rh,over);
        g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.5; g.stroke();
        // Schindelreihen
        g.strokeStyle='rgba(40,26,14,0.16)'; g.lineWidth=1.1;
        for(const fr of [0.34,0.58,0.8]){
          const yy=y-rh*(1-fr);
          const spread=(w/2+over)*fr;
          g.beginPath();
          g.moveTo(x+w/2-spread, yy+rh*fr*0.28);
          g.quadraticCurveTo(x+w/2, yy+3, x+w/2+spread, yy+rh*fr*0.28);
          g.stroke();
        }
        g.strokeStyle='rgba(255,255,255,0.4)'; g.lineWidth=1.4;
        g.beginPath(); g.moveTo(x-over+3,y-1); g.quadraticCurveTo(x+w*0.17,y-rh*0.6, x+w/2-2,y-rh+2.4); g.stroke();
        roofMoss(x,y,w,rh);
        // Dachschatten fällt auf die Wand (verstärkt die Tiefe)
        const shE=g.createLinearGradient(0,y+1,0,y+9);
        shE.addColorStop(0,'rgba(30,20,10,0.24)'); shE.addColorStop(1,'rgba(30,20,10,0)');
        g.fillStyle=shE; g.fillRect(x+1,y+1,w-2,8);
      };
      // Strohdach – Alltagsbauten des 12./13. Jahrhunderts
      const thatch=(x,y,w,rh,over=7)=>{
        roofSide(x,y,w,rh,over,'#8f7440');
        const gr=g.createLinearGradient(0,y-rh,0,y);
        gr.addColorStop(0,'#e3c586'); gr.addColorStop(1,'#b3925c');
        g.fillStyle=gr;
        gableFront(x,y,w,rh,over);
        g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.5; g.stroke();
        // Kammlinien des Strohs
        g.strokeStyle='rgba(110,80,40,0.3)'; g.lineWidth=1.2;
        for(const fr of [0.3,0.5,0.7,0.88]){
          const yy=y-rh*(1-fr);
          const spread=(w/2+over)*fr*0.94;
          g.beginPath();
          g.moveTo(x+w/2-spread, yy+rh*fr*0.26);
          g.quadraticCurveTo(x+w/2, yy+2.5, x+w/2+spread, yy+rh*fr*0.26);
          g.stroke();
        }
        // ausgefranste Traufkante
        g.fillStyle='#b3925c';
        for(let xx=x-over+3; xx<x+w+over-2; xx+=5.5){
          g.beginPath(); g.arc(xx, y+1.6, 2.6, 0, Math.PI); g.fill();
        }
        // Firstkappe
        g.strokeStyle='#8f7440'; g.lineWidth=3;
        g.beginPath(); g.moveTo(x+w/2-5,y-rh+2.6); g.quadraticCurveTo(x+w/2,y-rh-1, x+w/2+5,y-rh+2.6); g.stroke();
        roofMoss(x,y,w,rh);
        // Dachschatten auf der Wand
        const shE2=g.createLinearGradient(0,y+2,0,y+10);
        shE2.addColorStop(0,'rgba(30,20,10,0.24)'); shE2.addColorStop(1,'rgba(30,20,10,0)');
        g.fillStyle=shE2; g.fillRect(x+1,y+2,w-2,8);
      };
      // Rundturm mit Zylinderschattierung (Kegel- oder Zinnenabschluss)
      const towerRound=(cx,by,r,h,capH,cap='cone')=>{
        const gr=g.createLinearGradient(cx-r,0,cx+r,0);
        gr.addColorStop(0,'#dad5c9'); gr.addColorStop(0.55,'#b5afa2'); gr.addColorStop(1,'#7b7669');
        g.fillStyle=gr;
        g.beginPath();
        g.moveTo(cx-r,by); g.lineTo(cx-r,by-h);
        g.quadraticCurveTo(cx,by-h-r*0.3,cx+r,by-h);
        g.lineTo(cx+r,by); g.quadraticCurveTo(cx,by+r*0.3,cx-r,by);
        g.closePath(); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
        g.strokeStyle='rgba(80,70,58,0.2)'; g.lineWidth=1;
        for(let yy=by-6; yy>by-h+4; yy-=6){
          g.beginPath(); g.moveTo(cx-r+1.5,yy); g.quadraticCurveTo(cx,yy+2.4,cx+r-1.5,yy); g.stroke();
        }
        g.fillStyle='#2c3644'; g.fillRect(cx-1.4,by-h+9,2.8,7); // Schießscharte
        if(cap==='cone'){
          const cg=g.createLinearGradient(cx-r,0,cx+r,0);
          cg.addColorStop(0,mix(pcd,'#ffffff',0.28)); cg.addColorStop(1,pcd);
          g.fillStyle=cg;
          g.beginPath();
          g.moveTo(cx-r-2.5,by-h);
          g.quadraticCurveTo(cx-r*0.5,by-h-capH*0.55, cx,by-h-capH);
          g.quadraticCurveTo(cx+r*0.5,by-h-capH*0.55, cx+r+2.5,by-h);
          g.closePath(); g.fill();
          g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
          g.fillStyle='#e8c990'; g.beginPath(); g.arc(cx,by-h-capH-1.5,1.6,0,7); g.fill();
        } else {
          g.fillStyle='#c6c1b4';
          for(let k=-2;k<=2;k++){
            g.fillRect(cx+k*r*0.45-2.2, by-h-6, 4.4, 6.5);
            g.strokeStyle=OUT; g.lineWidth=1; g.strokeRect(cx+k*r*0.45-2.2, by-h-6, 4.4, 6.5);
          }
        }
      };
      // romanisches Rundbogenfenster
      const window_=(x,y,w=7,h=9,lit=true)=>{
        g.strokeStyle='#c2b8a4'; g.lineWidth=2.2;   // Steinlaibung
        g.beginPath();
        g.moveTo(x-0.5,y+h); g.lineTo(x-0.5,y+w/2);
        g.arc(x+w/2,y+w/2,w/2+0.5,Math.PI,0);
        g.lineTo(x+w+0.5,y+h);
        g.stroke();
        g.fillStyle=lit?'#ffd98a':'#4a4033';
        g.beginPath();
        g.moveTo(x,y+h); g.lineTo(x,y+w/2);
        g.arc(x+w/2,y+w/2,w/2,Math.PI,0);
        g.lineTo(x+w,y+h);
        g.closePath(); g.fill();
        g.strokeStyle='#8a6b43'; g.lineWidth=1.2; g.stroke();
        if(lit){ g.fillStyle='rgba(255,220,140,0.28)'; g.beginPath(); g.arc(x+w/2,y+h/2,w*0.95,0,7); g.fill(); }
      };
      // Rundbogentür mit Steingewände
      const door=(x,y,w=9,h=13)=>{
        g.strokeStyle='#c2b8a4'; g.lineWidth=2.6;
        g.beginPath();
        g.moveTo(x-1,y+h); g.lineTo(x-1,y+w*0.45);
        g.arc(x+w/2,y+w*0.45,w/2+1,Math.PI,0);
        g.lineTo(x+w+1,y+h);
        g.stroke();
        g.fillStyle='#5d4028';
        g.beginPath();
        g.moveTo(x,y+h); g.lineTo(x,y+w*0.45);
        g.arc(x+w/2,y+w*0.45,w/2,Math.PI,0);
        g.lineTo(x+w,y+h);
        g.closePath(); g.fill();
        g.strokeStyle='#8a6b43'; g.lineWidth=1.3; g.stroke();
        // Brettfugen + Beschlag
        g.strokeStyle='rgba(40,26,14,0.4)'; g.lineWidth=0.9;
        g.beginPath(); g.moveTo(x+w*0.35,y+2); g.lineTo(x+w*0.35,y+h-1); g.moveTo(x+w*0.65,y+1); g.lineTo(x+w*0.65,y+h-1); g.stroke();
        g.fillStyle='#e8c990'; g.beginPath(); g.arc(x+w*0.76,y+h*0.55,1,0,7); g.fill();
      };
      const banner=(x,y,len=16)=>{
        g.strokeStyle='#4a3520'; g.lineWidth=2.2;
        g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+len); g.stroke();
        g.fillStyle='#4a3520'; g.beginPath(); g.arc(x,y-1,1.6,0,7); g.fill();
        g.fillStyle=pc;
        g.beginPath(); g.moveTo(x,y); g.lineTo(x+11,y+3.5); g.lineTo(x,y+7); g.closePath(); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1; g.stroke();
      };
      const logPile=(x,y,n=3)=>{
        for(let k=0;k<n;k++){
          const lx=x+(k%2)*3, ly=y-Math.floor(k/2)*5;
          g.fillStyle='#8a5f33'; g.beginPath(); g.ellipse(lx,ly,7.5,3.6,0,0,7); g.fill();
          g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke();
          g.fillStyle='#c9a05a'; g.beginPath(); g.ellipse(lx-4.6,ly,2.4,3.2,0,0,7); g.fill();
        }
      };
      const crate=(x,y,s=8)=>{
        g.fillStyle='#a97e46'; g.fillRect(x,y,s,s);
        g.strokeStyle=OUT; g.lineWidth=1.3; g.strokeRect(x,y,s,s);
        g.strokeStyle='rgba(70,48,24,0.6)'; g.lineWidth=1;
        g.beginPath(); g.moveTo(x,y); g.lineTo(x+s,y+s); g.moveTo(x+s,y); g.lineTo(x,y+s); g.stroke();
      };
      const barrel=(x,y)=>{
        g.fillStyle='#8a5f33';
        g.beginPath(); g.ellipse(x,y,5.5,7,0,0,7); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
        g.strokeStyle='#c9a05a'; g.lineWidth=1.6;
        g.beginPath(); g.moveTo(x-5.2,y-2.4); g.lineTo(x+5.2,y-2.4); g.moveTo(x-5.2,y+2.4); g.lineTo(x+5.2,y+2.4); g.stroke();
      };
      const chimney=(x,y,h=14)=>{
        g.fillStyle='#6f6a63'; g.fillRect(x,y-h,7,h);
        g.strokeStyle=OUT; g.lineWidth=1.4; g.strokeRect(x,y-h,7,h);
        g.fillStyle='#4a4640'; g.fillRect(x-1.5,y-h-3,10,4);
      };
      // heraldisches Wappenschild in Spielerfarbe
      const heraldShield=(x,y,s2=1)=>{
        g.save(); g.translate(x,y); g.scale(s2,s2);
        g.fillStyle=pc;
        g.beginPath();
        g.moveTo(-5.5,-6); g.lineTo(5.5,-6);
        g.lineTo(5.5,0); g.quadraticCurveTo(5,4.6, 0,7);
        g.quadraticCurveTo(-5,4.6, -5.5,0);
        g.closePath(); g.fill();
        g.strokeStyle='rgba(40,26,14,0.7)'; g.lineWidth=1.3; g.stroke();
        // Sparren (Chevron)
        g.strokeStyle='rgba(255,255,255,0.85)'; g.lineWidth=2;
        g.beginPath(); g.moveTo(-4,-0.5); g.lineTo(0,-3.6); g.lineTo(4,-0.5); g.stroke();
        g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=1;
        g.beginPath(); g.moveTo(-4.5,-5); g.lineTo(4.5,-5); g.stroke();
        g.restore();
      };

      // ================= Baustelle =================
      if(state==='build'){
        g.strokeStyle='#8a6b43'; g.lineWidth=3;
        stoneGrad(W*0.24,H*0.62,W*0.52,H*0.24);
        g.strokeStyle='#9a7a4c'; g.lineWidth=2.6;
        for(const sx of [W*0.2,W*0.5,W*0.8]){
          g.beginPath(); g.moveTo(sx,H*0.9); g.lineTo(sx,H*0.36); g.stroke();
        }
        g.beginPath(); g.moveTo(W*0.14,H*0.4); g.lineTo(W*0.86,H*0.4); g.stroke();
        g.beginPath(); g.moveTo(W*0.2,H*0.66); g.lineTo(W*0.8,H*0.42); g.stroke();
        logPile(W*0.22,H*0.86,3);
        g.fillStyle='#9a958c';
        g.beginPath(); g.arc(W*0.74,H*0.86,4.5,0,7); g.arc(W*0.82,H*0.88,3.6,0,7); g.fill();
        g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke();
        return;
      }

      const roofC = def.mil? '#7a8592' : (def.mine? '#6b625a' : pc);

      switch(def.size){
        case 'MINE': {
          // Stollenportal im Fels
          const gr=g.createLinearGradient(0,H*0.25,0,H*0.9);
          gr.addColorStop(0,'#6f675d'); gr.addColorStop(1,'#4e463d');
          g.fillStyle=gr;
          g.beginPath(); g.moveTo(W*0.08,H*0.9); g.lineTo(W*0.5,H*0.22); g.lineTo(W*0.92,H*0.9); g.closePath(); g.fill();
          g.strokeStyle=OUT; g.lineWidth=1.8; g.stroke();
          g.fillStyle='rgba(255,255,255,0.12)';
          g.beginPath(); g.moveTo(W*0.5,H*0.22); g.lineTo(W*0.3,H*0.9); g.lineTo(W*0.08,H*0.9); g.closePath(); g.fill();
          // Stollenmund + Balkenrahmen
          g.fillStyle='#1c1712';
          g.beginPath(); g.moveTo(W*0.34,H*0.9); g.lineTo(W*0.34,H*0.6); g.quadraticCurveTo(W*0.5,H*0.46,W*0.66,H*0.6); g.lineTo(W*0.66,H*0.9); g.closePath(); g.fill();
          g.strokeStyle='#8a6b43'; g.lineWidth=4;
          g.beginPath(); g.moveTo(W*0.32,H*0.9); g.lineTo(W*0.32,H*0.58); g.moveTo(W*0.68,H*0.9); g.lineTo(W*0.68,H*0.58); g.moveTo(W*0.28,H*0.58); g.lineTo(W*0.72,H*0.58); g.stroke();
          // Laterne
          g.fillStyle='rgba(255,200,110,0.85)'; g.beginPath(); g.arc(W*0.5,H*0.64,2.6,0,7); g.fill();
          g.fillStyle='rgba(255,200,110,0.2)'; g.beginPath(); g.arc(W*0.5,H*0.64,6,0,7); g.fill();
          // Lore
          g.fillStyle='#5d452a'; g.fillRect(W*0.72,H*0.8,13,7);
          g.strokeStyle=OUT; g.lineWidth=1.2; g.strokeRect(W*0.72,H*0.8,13,7);
          g.fillStyle='#2e2e2e';
          g.beginPath(); g.arc(W*0.75,H*0.9,2.4,0,7); g.arc(W*0.82,H*0.9,2.4,0,7); g.fill();
          banner(W*0.5,H*0.1,12);
          break;
        }
        case 'L': {
          if(type==='hq' || type==='fortress'){
            // Hochmittelalterliche Burg: Ringmauer mit Wehrgang, Bergfried, Rundtürme, Torbogen
            // Bergfried (hinten, quaderförmig mit Pyramidendach und Doppelbogenfenster)
            stoneGrad(W*0.35,H*0.18,W*0.3,H*0.42);
            g.fillStyle='#6d6759';
            g.beginPath(); // Pyramidendach
            g.moveTo(W*0.33,H*0.18); g.lineTo(W*0.5,H*0.06); g.lineTo(W*0.67,H*0.18);
            g.closePath(); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
            g.fillStyle='rgba(255,255,255,0.18)';
            g.beginPath(); g.moveTo(W*0.33,H*0.18); g.lineTo(W*0.5,H*0.06); g.lineTo(W*0.5,H*0.18); g.closePath(); g.fill();
            // Biforium (romanisches Doppelfenster)
            window_(W*0.42,H*0.26,5.5,8,true); window_(W*0.53,H*0.26,5.5,8,true);
            g.fillStyle='#c2b8a4'; g.fillRect(W*0.485,H*0.26,2.4,8);
            // Kragstein-Reihe (Maschikuli) unter dem Bergfried-Abschluss
            g.fillStyle='#8f897b';
            for(let k=0;k<6;k++) g.fillRect(W*0.36+k*W*0.048,H*0.2,W*0.024,3.4);
            // Ringmauer mit Wehrgang
            stoneGrad(W*0.14,H*0.5,W*0.72,H*0.38);
            g.fillStyle='#c6c1b4';
            for(let k=0;k<7;k++){
              g.fillRect(W*0.155+k*W*0.1,H*0.455,W*0.06,7);
              g.strokeStyle=OUT; g.lineWidth=0.9; g.strokeRect(W*0.155+k*W*0.1,H*0.455,W*0.06,7);
            }
            // Wehrgang-Schatten + Verwitterungsspuren
            g.fillStyle='rgba(40,30,20,0.18)'; g.fillRect(W*0.15,H*0.5,W*0.7,4);
            g.strokeStyle='rgba(60,55,45,0.16)'; g.lineWidth=1.6;
            for(const fx2 of [0.2,0.31,0.62,0.79]){
              g.beginPath(); g.moveTo(W*fx2,H*0.52); g.lineTo(W*fx2,H*(0.62+(fx2*7%1)*0.1)); g.stroke();
            }
            // Rundtürme mit Kegeldach
            towerRound(W*0.14,H*0.9,W*0.075,H*0.5,H*0.16,'cone');
            towerRound(W*0.86,H*0.9,W*0.075,H*0.5,H*0.16,'cone');
            // Torhaus: zwei kleine Flankentürmchen
            towerRound(W*0.375,H*0.9,W*0.045,H*0.32,H*0.09,'cone');
            towerRound(W*0.625,H*0.9,W*0.045,H*0.32,H*0.09,'cone');
            // Torbogen mit Fallgitter
            door(W*0.44,H*0.66,W*0.12,H*0.22);
            g.strokeStyle='#4a4033'; g.lineWidth=1.2;
            for(let k=0;k<3;k++){ g.beginPath(); g.moveTo(W*(0.455+k*0.032),H*0.66); g.lineTo(W*(0.455+k*0.032),H*0.8); g.stroke(); }
            g.beginPath(); g.moveTo(W*0.445,H*0.72); g.lineTo(W*0.555,H*0.72); g.stroke();
            heraldShield(W*0.5,H*0.58,1.2);
            banner(W*0.5,H*0.02,14);
            break;
          }
          if(type==='farm'||type==='pigfarm'){
            // Langhaus mit tiefem Strohdach + Scheune + Zaun
            wallGrad(W*0.08,H*0.56,W*0.42,H*0.28,'#e0d0aa','#c2ab7d');
            timber(W*0.08,H*0.56,W*0.42,H*0.28);
            thatch(W*0.08,H*0.56,W*0.42,H*0.3);
            window_(W*0.16,H*0.62,6.5,8); door(W*0.32,H*0.7,9,14);
            // Scheune
            wallGrad(W*0.56,H*0.6,W*0.32,H*0.26,'#d8b98a','#b08d5c');
            thatch(W*0.56,H*0.6,W*0.32,H*0.16,4);
            g.fillStyle='#5d452a'; g.fillRect(W*0.66,H*0.68,W*0.14,H*0.18);
            g.strokeStyle='#3a2d20'; g.lineWidth=1.4;
            g.strokeRect(W*0.66,H*0.68,W*0.14,H*0.18);
            g.beginPath(); g.moveTo(W*0.66,H*0.68); g.lineTo(W*0.8,H*0.86); g.moveTo(W*0.8,H*0.68); g.lineTo(W*0.66,H*0.86); g.stroke();
            // Zaun
            g.strokeStyle='#8a6b43'; g.lineWidth=2;
            g.beginPath(); g.moveTo(W*0.05,H*0.93); g.lineTo(W*0.95,H*0.93); g.stroke();
            for(let k=0;k<8;k++){ g.beginPath(); g.moveTo(W*0.08+k*W*0.12,H*0.89); g.lineTo(W*0.08+k*W*0.12,H*0.97); g.stroke(); }
            if(type==='pigfarm'){
              // Schweinchen in der Matschkuhle
              g.fillStyle='rgba(120,90,60,0.5)';
              g.beginPath(); g.ellipse(W*0.5,H*0.91,10,3.6,0,0,7); g.fill();
              g.fillStyle='#e3a2a2';
              g.beginPath(); g.ellipse(W*0.5,H*0.89,6,4,0,0,7); g.fill();
              g.fillStyle='#d98f8f'; g.beginPath(); g.arc(W*0.565,H*0.885,2.2,0,7); g.fill();
              g.fillStyle='#b5716e'; g.beginPath(); g.ellipse(W*0.575,H*0.885,1,1.3,0,0,7); g.fill();
              g.strokeStyle='#d98f8f'; g.lineWidth=1.2;   // Ringelschwanz
              g.beginPath(); g.moveTo(W*0.44,H*0.88); g.quadraticCurveTo(W*0.42,H*0.86,W*0.435,H*0.85); g.stroke();
            } else {
              // Vogelscheuche im Hof (kleiner Spaß)
              g.strokeStyle='#6d4f2e'; g.lineWidth=2;
              g.beginPath(); g.moveTo(W*0.93,H*0.86); g.lineTo(W*0.93,H*0.62); g.stroke();
              g.lineWidth=1.6;
              g.beginPath(); g.moveTo(W*0.875,H*0.68); g.lineTo(W*0.985,H*0.68); g.stroke();
              g.fillStyle='#c9a05a';   // ärmeliges Hemd
              g.beginPath(); g.moveTo(W*0.9,H*0.68); g.lineTo(W*0.96,H*0.68); g.lineTo(W*0.945,H*0.8); g.lineTo(W*0.915,H*0.8); g.closePath(); g.fill();
              g.fillStyle='#e8d9a8';   // Strohkopf
              g.beginPath(); g.arc(W*0.93,H*0.63,3.2,0,7); g.fill();
              g.fillStyle='#8a6b43';   // Schlapphut
              g.beginPath(); g.ellipse(W*0.93,H*0.605,4.4,1.4,0,0,7); g.fill();
              g.beginPath(); g.arc(W*0.93,H*0.6,2.2,Math.PI,0); g.fill();
              // frecher Vogel sitzt trotzdem drauf
              g.fillStyle='#3a3e46';
              g.beginPath(); g.ellipse(W*0.975,H*0.665,2,1.5,0,0,7); g.fill();
              g.beginPath(); g.arc(W*0.988,H*0.655,1.1,0,7); g.fill();
              g.fillStyle='#e8b93c';
              g.beginPath(); g.moveTo(W*0.995,H*0.655); g.lineTo(W*1.003,H*0.657); g.lineTo(W*0.995,H*0.661); g.fill();
            }
            break;
          }
          // Lagerhaus: steinernes Erdgeschoss, Fachwerk-Obergeschoss, Kranbalken am Giebel
          stoneGrad(W*0.12,H*0.66,W*0.76,H*0.2);
          wallGrad(W*0.12,H*0.44,W*0.76,H*0.24);
          timber(W*0.12,H*0.44,W*0.76,H*0.24);
          roofGable(W*0.12,H*0.44,W*0.76,H*0.28,pc);
          window_(W*0.2,H*0.5,6.5,8); window_(W*0.68,H*0.5,6.5,8);
          door(W*0.44,H*0.68,11,15);
          // Kranbalken mit Seil und Kiste (mittelalterlicher Lastenaufzug)
          g.strokeStyle='#6d4f2e'; g.lineWidth=2.6;
          g.beginPath(); g.moveTo(W*0.5,H*0.2); g.lineTo(W*0.62,H*0.2); g.stroke();
          g.strokeStyle='rgba(90,70,45,0.9)'; g.lineWidth=1.1;
          g.beginPath(); g.moveTo(W*0.62,H*0.2); g.lineTo(W*0.62,H*0.34); g.stroke();
          crate(W*0.585,H*0.34,7);
          crate(W*0.16,H*0.78,9); crate(W*0.26,H*0.8,7); barrel(W*0.86,H*0.8);
          // Lagerkatze auf der Kiste (kleiner Spaß)
          g.fillStyle='#2e2a26';
          g.beginPath(); g.ellipse(W*0.185,H*0.755,3.4,2.6,0,0,7); g.fill();          // Körper
          g.beginPath(); g.arc(W*0.215,H*0.735,2.2,0,7); g.fill();                     // Kopf
          g.beginPath();                                                                // Ohren
          g.moveTo(W*0.205,H*0.72); g.lineTo(W*0.21,H*0.7); g.lineTo(W*0.216,H*0.718);
          g.moveTo(W*0.222,H*0.717); g.lineTo(W*0.228,H*0.7); g.lineTo(W*0.231,H*0.72);
          g.fill();
          g.strokeStyle='#2e2a26'; g.lineWidth=1.4;                                     // Schwanz
          g.beginPath(); g.moveTo(W*0.155,H*0.76); g.quadraticCurveTo(W*0.135,H*0.74,W*0.145,H*0.72); g.stroke();
          g.fillStyle='#7fd08a';                                                        // Augen
          g.beginPath(); g.arc(W*0.211,H*0.733,0.5,0,7); g.arc(W*0.221,H*0.733,0.5,0,7); g.fill();
          banner(W*0.5,H*0.08,13);
          break;
        }
        case 'M': {
          if(type==='mill'){
            // Turmwindmühle mit Galerie auf Steinsockel
            stoneGrad(W*0.31,H*0.76,W*0.38,H*0.14);
            g.fillStyle='#d5c5a2';
            g.beginPath(); g.moveTo(W*0.34,H*0.9); g.lineTo(W*0.41,H*0.3); g.lineTo(W*0.59,H*0.3); g.lineTo(W*0.66,H*0.9); g.closePath(); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.8; g.stroke();
            g.fillStyle='rgba(255,255,255,0.25)';
            g.beginPath(); g.moveTo(W*0.41,H*0.3); g.lineTo(W*0.45,H*0.9); g.lineTo(W*0.34,H*0.9); g.closePath(); g.fill();
            // Galerie
            g.strokeStyle='#8a6b43'; g.lineWidth=2;
            g.beginPath(); g.moveTo(W*0.3,H*0.66); g.lineTo(W*0.7,H*0.66); g.stroke();
            for(let k=0;k<5;k++){ g.beginPath(); g.moveTo(W*0.32+k*W*0.09,H*0.66); g.lineTo(W*0.34+k*W*0.08,H*0.74); g.stroke(); }
            // Kappe
            g.fillStyle=pcd;
            g.beginPath(); g.moveTo(W*0.38,H*0.3); g.quadraticCurveTo(W*0.5,H*0.16,W*0.62,H*0.3); g.closePath(); g.fill();
            g.strokeStyle=OUT; g.stroke();
            window_(W*0.46,H*0.48,7,9); door(W*0.45,H*0.76,9,14);
            // Flügel mit Gitterwerk
            g.strokeStyle='#5d452a'; g.lineWidth=2.6;
            for(let k=0;k<4;k++){
              const a=k*Math.PI/2+0.5;
              const ex=W*0.5+Math.cos(a)*W*0.34, ey=H*0.26+Math.sin(a)*W*0.34;
              g.beginPath(); g.moveTo(W*0.5,H*0.26); g.lineTo(ex,ey); g.stroke();
              // Segelfläche
              g.save();
              g.translate(W*0.5,H*0.26); g.rotate(a);
              g.fillStyle='rgba(238,228,200,0.9)';
              g.fillRect(4,-5.2,W*0.3,6);
              g.strokeStyle='#8a6b43'; g.lineWidth=1;
              g.strokeRect(4,-5.2,W*0.3,6);
              for(let s2=0;s2<3;s2++){ g.beginPath(); g.moveTo(6+s2*8,-5.2); g.lineTo(6+s2*8,0.8); g.stroke(); }
              g.restore();
            }
            g.fillStyle='#4a3520'; g.beginPath(); g.arc(W*0.5,H*0.26,3.4,0,7); g.fill();
            break;
          }
          if(type==='watchtower'){
            // Rundturm mit hölzernem Wehrgang (Hurde) oben
            towerRound(W*0.5,H*0.9,W*0.17,H*0.62,0,'zinnen');
            // Hurde: auskragender Holzkasten
            g.fillStyle='#8a6842';
            rr(g,W*0.26,H*0.24,W*0.48,H*0.12,2); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
            g.strokeStyle='rgba(60,40,20,0.4)'; g.lineWidth=1;
            for(let k=1;k<6;k++){ g.beginPath(); g.moveTo(W*0.26+k*W*0.08,H*0.245); g.lineTo(W*0.26+k*W*0.08,H*0.355); g.stroke(); }
            // Stützstreben
            g.strokeStyle='#6d4f2e'; g.lineWidth=2;
            g.beginPath();
            g.moveTo(W*0.3,H*0.36); g.lineTo(W*0.37,H*0.44);
            g.moveTo(W*0.7,H*0.36); g.lineTo(W*0.63,H*0.44);
            g.stroke();
            // Pultdach der Hurde
            g.fillStyle=pcd;
            g.beginPath();
            g.moveTo(W*0.23,H*0.24); g.lineTo(W*0.5,H*0.15); g.lineTo(W*0.77,H*0.24);
            g.closePath(); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
            window_(W*0.45,H*0.28,7,8,true);
            heraldShield(W*0.5,H*0.6,1);
            door(W*0.43,H*0.74,10,14);
            banner(W*0.5,H*0.04,13);
            break;
          }
          if(type==='catapult'){
            // Plattform
            g.fillStyle='#7a5b35'; g.fillRect(W*0.14,H*0.72,W*0.72,H*0.1);
            g.strokeStyle=OUT; g.lineWidth=1.6; g.strokeRect(W*0.14,H*0.72,W*0.72,H*0.1);
            // Räder
            for(const wx of [W*0.24,W*0.76]){
              g.fillStyle='#5d452a'; g.beginPath(); g.arc(wx,H*0.85,7,0,7); g.fill();
              g.strokeStyle=OUT; g.lineWidth=1.6; g.stroke();
              g.strokeStyle='#3a2d20'; g.lineWidth=1.4;
              g.beginPath(); g.moveTo(wx-6,H*0.85); g.lineTo(wx+6,H*0.85); g.moveTo(wx,H*0.85-6); g.lineTo(wx,H*0.85+6); g.stroke();
            }
            // Rahmen + Wurfarm
            g.strokeStyle='#6d4f2e'; g.lineWidth=4.4;
            g.beginPath(); g.moveTo(W*0.3,H*0.74); g.lineTo(W*0.5,H*0.5); g.lineTo(W*0.7,H*0.74); g.stroke();
            g.strokeStyle='#5d452a'; g.lineWidth=5;
            g.beginPath(); g.moveTo(W*0.34,H*0.72); g.lineTo(W*0.66,H*0.28); g.stroke();
            g.fillStyle='#4a4a4a'; g.beginPath(); g.arc(W*0.68,H*0.26,5.4,0,7); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.4; g.stroke();
            // Steinstapel
            g.fillStyle='#9a958c';
            g.beginPath(); g.arc(W*0.16,H*0.66,4,0,7); g.arc(W*0.22,H*0.68,3.4,0,7); g.fill();
            banner(W*0.86,H*0.4,12);
            break;
          }
          if(type==='tithebarn'){
            // Zehntscheune: mächtiges Strohdach, niedrige Wände, großes Tor, Säcke
            wallGrad(W*0.1,H*0.6,W*0.72,H*0.26,'#dcc79a','#bda275');
            timber(W*0.1,H*0.6,W*0.72,H*0.26);
            thatch(W*0.1,H*0.6,W*0.72,H*0.4,7);
            g.fillStyle='#5d4028'; rr(g,W*0.34,H*0.66,W*0.24,H*0.2,2); g.fill();
            g.strokeStyle='#8a6b43'; g.lineWidth=1.4; g.stroke();
            g.beginPath(); g.moveTo(W*0.34,H*0.66); g.lineTo(W*0.58,H*0.86);
            g.moveTo(W*0.58,H*0.66); g.lineTo(W*0.34,H*0.86); g.stroke();
            // Kornsäcke
            for(const [sx2,sy2] of [[0.16,0.82],[0.24,0.84],[0.72,0.83]]){
              g.fillStyle='#d9bb84';
              g.beginPath(); g.ellipse(W*sx2,H*sy2,4.4,5.4,0,0,7); g.fill();
              g.strokeStyle=OUT; g.lineWidth=1; g.stroke();
              g.strokeStyle='#8a6b43'; g.lineWidth=1.2;
              g.beginPath(); g.moveTo(W*sx2-2,H*sy2-5); g.lineTo(W*sx2+2,H*sy2-5); g.stroke();
            }
            banner(W*0.18,H*0.42,10);
            break;
          }
          // mittlere Häuser: Wandstil + Dachfarbe je Handwerk (mehr Vielfalt)
          const ROOFC={ sawmill:'#8f6a3f', bakery:'#c05a3a', butcher:'#a34a52',
            brewery:'#8f6a3f', smelter:'#707a88', mint:'#606b7d', armory:'#5f6a78' };
          const mRoof=ROOFC[type]||roofC;
          if(type==='smelter'||type==='mint'||type==='armory'){
            stoneGrad(W*0.14,H*0.46,W*0.6,H*0.4);
          } else if(type==='bakery'||type==='butcher'){
            plaster(W*0.14,H*0.46,W*0.6,H*0.4);
          } else {
            wallGrad(W*0.14,H*0.46,W*0.6,H*0.4);
            timber(W*0.14,H*0.46,W*0.6,H*0.4);
          }
          roofGable(W*0.14,H*0.46,W*0.6,H*0.26,mRoof);
          window_(W*0.2,H*0.56); door(W*0.36,H*0.68,10,15);
          banner(W*0.2,H*0.28,10);
          if(type==='smelter'||type==='mint'||type==='armory'||type==='bakery'){
            chimney(W*0.72,H*0.44,16);
            if(type==='smelter'){
              g.fillStyle='rgba(255,120,40,0.8)'; g.fillRect(W*0.2,H*0.79,8,6);
              g.fillStyle='rgba(255,160,60,0.3)'; g.fillRect(W*0.18,H*0.76,12,10);
            }
          }
          if(type==='bakery'){
            // Kuppel-Backofen neben dem Haus
            g.fillStyle='#b5a48c';
            g.beginPath(); g.arc(W*0.85,H*0.82,8.6,Math.PI,0); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
            g.fillStyle='#2c2018';
            g.beginPath(); g.arc(W*0.85,H*0.82,4,Math.PI,0); g.fill();
            g.fillStyle='rgba(255,150,60,0.7)';
            g.beginPath(); g.arc(W*0.85,H*0.82,2.4,Math.PI,0); g.fill();
          }
          if(type==='butcher'){
            // Wurstkette unter der Traufe (kleiner Spaß)
            g.strokeStyle='rgba(70,50,35,0.8)'; g.lineWidth=1;
            g.beginPath(); g.moveTo(W*0.4,H*0.5); g.quadraticCurveTo(W*0.55,H*0.56,W*0.7,H*0.5); g.stroke();
            g.fillStyle='#a34a3f';
            for(const fx4 of [0.45,0.52,0.59,0.66]){
              g.beginPath(); g.ellipse(W*fx4,H*0.535,2.1,3.4,0.25,0,7); g.fill();
              g.strokeStyle='rgba(60,25,18,0.5)'; g.lineWidth=0.7; g.stroke();
            }
          }
          if(type==='sawmill'){
            // Stämme-Rampe an der Seite
            g.strokeStyle='#8a6238'; g.lineWidth=3.2;
            g.beginPath(); g.moveTo(W*0.78,H*0.86); g.lineTo(W*0.95,H*0.6); g.stroke();
            g.fillStyle='#8a5f33';
            g.beginPath(); g.ellipse(W*0.88,H*0.71,7,3,-1,0,7); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1; g.stroke();
          }
          // Zunftzeichen
          const sign=(draw)=>{ g.save(); g.translate(W*0.62,H*0.56); draw(); g.restore(); };
          if(type==='sawmill'){ logPile(W*0.84,H*0.84,3);
            sign(()=>{ g.fillStyle='#c9c9c9'; g.beginPath(); g.arc(0,0,5,0,7); g.fill();
              g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke();
              g.fillStyle='#8a8a8a'; g.beginPath(); g.arc(0,0,1.8,0,7); g.fill(); }); }
          if(type==='bakery') sign(()=>{ g.strokeStyle='#e8b93c'; g.lineWidth=2.6;
            g.beginPath(); g.arc(0,0,4.4,0.6,5.8); g.stroke(); });
          if(type==='brewery'){ barrel(W*0.82,H*0.8); sign(()=>{ g.fillStyle='#c78f3f';
            g.beginPath(); g.arc(0,0,4.4,0,7); g.fill(); g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke(); }); }
          if(type==='butcher') sign(()=>{ g.fillStyle='#c26a5a';
            g.beginPath(); g.ellipse(0,0,4.6,3.4,0.5,0,7); g.fill(); g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke(); });
          if(type==='mint') sign(()=>{ g.fillStyle='#ffd54a'; g.beginPath(); g.arc(0,0,4.6,0,7); g.fill();
            g.strokeStyle='#a8802a'; g.lineWidth=1.4; g.stroke();
            g.strokeStyle='#a8802a'; g.beginPath(); g.arc(0,0,2.4,0,7); g.stroke(); });
          if(type==='armory') sign(()=>{ g.fillStyle='#4a4a52';
            g.fillRect(-5,-1,10,3.6); g.fillRect(-2,-4,4,4);
            g.strokeStyle=OUT; g.lineWidth=1; g.strokeRect(-5,-1,10,3.6); });
          if(type==='smelter') sign(()=>{ g.fillStyle='#ff8c46';
            g.beginPath(); g.moveTo(0,-4.5); g.quadraticCurveTo(4.4,0,0,4.8); g.quadraticCurveTo(-4.4,0,0,-4.5); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1; g.stroke(); });
          break;
        }
        default: { // S
          if(type==='barracks'){
            // Holzpalisade mit Hütte – früher Militärposten
            // Hütte hinten
            wallGrad(W*0.3,H*0.4,W*0.4,H*0.24,'#d9c39a','#b39a70');
            thatch(W*0.3,H*0.4,W*0.4,H*0.18,4);
            // Palisadenring: angespitzte Stämme
            for(let k=0;k<9;k++){
              const px2=W*0.12+k*W*0.095;
              const hh=H*0.26+((k*37)%3)*2;
              const gr2=g.createLinearGradient(px2,0,px2+W*0.075,0);
              gr2.addColorStop(0,'#a8845a'); gr2.addColorStop(1,'#7a5b35');
              g.fillStyle=gr2;
              g.beginPath();
              g.moveTo(px2,H*0.88); g.lineTo(px2,H*0.88-hh);
              g.lineTo(px2+W*0.038,H*0.88-hh-6); g.lineTo(px2+W*0.075,H*0.88-hh);
              g.lineTo(px2+W*0.075,H*0.88);
              g.closePath(); g.fill();
              g.strokeStyle=OUT; g.lineWidth=1.1; g.stroke();
            }
            // Toröffnung
            g.fillStyle='#2e2318'; g.fillRect(W*0.44,H*0.66,W*0.13,H*0.22);
            heraldShield(W*0.5,H*0.58,0.9);
            banner(W*0.5,H*0.12,13);
            break;
          }
          if(type==='guardhouse'){
            // steinernes Turmhaus, zwei Geschosse, Zinnenkranz
            stoneGrad(W*0.26,H*0.3,W*0.48,H*0.58);
            g.fillStyle='#c6c1b4';
            for(let k=0;k<4;k++){
              g.fillRect(W*0.27+k*W*0.12,H*0.22,W*0.07,8);
              g.strokeStyle=OUT; g.lineWidth=0.9; g.strokeRect(W*0.27+k*W*0.12,H*0.22,W*0.07,8);
            }
            g.fillStyle='rgba(40,30,20,0.18)'; g.fillRect(W*0.27,H*0.3,W*0.46,3.4);
            window_(W*0.34,H*0.4,6.5,8,true);
            g.fillStyle='#22303e'; g.fillRect(W*0.58,H*0.42,3,7); // Scharte
            door(W*0.42,H*0.72,11,15);
            heraldShield(W*0.63,H*0.62,0.9);
            banner(W*0.5,H*0.08,13);
            break;
          }
          if(type==='well'){
            // Steinring mit Textur
            stoneGrad(W*0.28,H*0.6,W*0.44,H*0.22);
            g.fillStyle='#1d3245';
            g.beginPath(); g.ellipse(W*0.5,H*0.62,W*0.17,4,0,0,7); g.fill();
            // Pfosten + Dach + Winde
            g.strokeStyle='#7a5b35'; g.lineWidth=3.4;
            g.beginPath(); g.moveTo(W*0.28,H*0.6); g.lineTo(W*0.28,H*0.3); g.moveTo(W*0.72,H*0.6); g.lineTo(W*0.72,H*0.3); g.stroke();
            roofGable(W*0.24,H*0.3,W*0.52,H*0.16,pcd,3);
            g.strokeStyle='#5d452a'; g.lineWidth=2.4;
            g.beginPath(); g.moveTo(W*0.28,H*0.44); g.lineTo(W*0.72,H*0.44); g.stroke();
            g.strokeStyle='#3a2d20'; g.lineWidth=1.4;
            g.beginPath(); g.moveTo(W*0.5,H*0.44); g.lineTo(W*0.5,H*0.58); g.stroke();
            g.fillStyle='#8a5f33'; g.fillRect(W*0.46,H*0.56,W*0.08,5);
            g.strokeStyle=OUT; g.lineWidth=1; g.strokeRect(W*0.46,H*0.56,W*0.08,5);
            break;
          }
          if(type==='chapel'){
            // kleine romanische Kapelle mit Apsis und Glockengiebel
            stoneGrad(W*0.24,H*0.46,W*0.44,H*0.4);
            // Apsis (halbrund, rechts)
            g.fillStyle='#b5afa2';
            g.beginPath();
            g.moveTo(W*0.68,H*0.52); g.quadraticCurveTo(W*0.84,H*0.66,W*0.68,H*0.86);
            g.closePath(); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.3; g.stroke();
            g.fillStyle='#8f897b';
            g.beginPath();
            g.moveTo(W*0.66,H*0.52); g.quadraticCurveTo(W*0.86,H*0.5,W*0.8,H*0.6);
            g.quadraticCurveTo(W*0.74,H*0.54,W*0.66,H*0.55);
            g.closePath(); g.fill();
            // steiles Satteldach
            roofGable(W*0.24,H*0.46,W*0.44,H*0.3,'#7d8896',4);
            // Glockengiebel mit Glöckchen
            stoneGrad(W*0.4,H*0.08,W*0.12,H*0.14);
            g.fillStyle='#2c2620';
            g.beginPath(); g.arc(W*0.46,H*0.14,3.4,0,7); g.fill();
            g.fillStyle='#e8c258';
            g.beginPath();
            g.moveTo(W*0.44,H*0.115); g.quadraticCurveTo(W*0.46,H*0.09,W*0.48,H*0.115);
            g.lineTo(W*0.485,H*0.155); g.lineTo(W*0.435,H*0.155);
            g.closePath(); g.fill();
            // Rundfenster (Rosette)
            g.fillStyle='#ffd98a'; g.beginPath(); g.arc(W*0.46,H*0.36,3.6,0,7); g.fill();
            g.strokeStyle='#8a6b43'; g.lineWidth=1.2; g.stroke();
            g.beginPath(); g.moveTo(W*0.46-3.6,H*0.36); g.lineTo(W*0.46+3.6,H*0.36);
            g.moveTo(W*0.46,H*0.36-3.6); g.lineTo(W*0.46,H*0.36+3.6); g.stroke();
            door(W*0.41,H*0.7,9,14);
            break;
          }
          if(type==='fisher'){
            // Fischerhütte auf Stelzen mit Trockenleine
            g.strokeStyle='#6d4f2e'; g.lineWidth=2.6;   // Stelzen
            g.beginPath();
            g.moveTo(W*0.24,H*0.86); g.lineTo(W*0.24,H*0.74);
            g.moveTo(W*0.44,H*0.87); g.lineTo(W*0.44,H*0.74);
            g.moveTo(W*0.64,H*0.86); g.lineTo(W*0.64,H*0.74);
            g.stroke();
            logWall(W*0.18,H*0.46,W*0.52,H*0.3);
            thatch(W*0.18,H*0.46,W*0.52,H*0.24,5);
            window_(W*0.28,H*0.53,6,7.5); door(W*0.48,H*0.6,8,13);
            // Steg-Brettchen
            g.fillStyle='#8a6b43'; g.fillRect(W*0.16,H*0.75,W*0.56,3.4);
            g.strokeStyle=OUT; g.lineWidth=1; g.strokeRect(W*0.16,H*0.75,W*0.56,3.4);
            // Trockenleine mit Fischen (kleiner Spaß)
            g.strokeStyle='#5d452a'; g.lineWidth=1.6;
            g.beginPath(); g.moveTo(W*0.72,H*0.84); g.lineTo(W*0.72,H*0.5); g.stroke();
            g.strokeStyle='rgba(70,60,45,0.8)'; g.lineWidth=1;
            g.beginPath(); g.moveTo(W*0.7,H*0.52); g.quadraticCurveTo(W*0.86,H*0.56,W*0.98,H*0.5); g.stroke();
            g.fillStyle='#7db3cf';
            for(const fx3 of [0.78,0.88]){
              g.beginPath(); g.ellipse(W*fx3,H*0.585,3.6,1.7,1.35,0,7); g.fill();
              g.beginPath(); g.moveTo(W*fx3-1,H*0.62); g.lineTo(W*fx3-2.6,H*0.655); g.lineTo(W*fx3+0.8,H*0.645); g.closePath(); g.fill();
            }
            banner(W*0.24,H*0.28,9);
            break;
          }
          // kleine Häuser: Wandstil je nach Beruf
          if(type==='woodcutter'||type==='forester'||type==='hunter'){
            logWall(W*0.18,H*0.54,W*0.6,H*0.32);          // Blockhütte der Waldleute
          } else if(type==='quarry'){
            stoneGrad(W*0.18,H*0.54,W*0.6,H*0.32);        // Steinhütte des Steinmetz
          } else {
            wallGrad(W*0.18,H*0.54,W*0.6,H*0.32);
            timber(W*0.18,H*0.54,W*0.6,H*0.32);
          }
          thatch(W*0.18,H*0.54,W*0.6,H*0.26,5);
          window_(W*0.26,H*0.6,6.5,8); door(W*0.52,H*0.7,9,13);
          banner(W*0.24,H*0.34,9);   // kleiner Besitz-Wimpel am Giebel
          if(type==='woodcutter'){ logPile(W*0.14,H*0.86,3);
            // Axt im Block
            g.fillStyle='#6d4f2e'; g.fillRect(W*0.82,H*0.8,7,7);
            g.strokeStyle='#9a9a9a'; g.lineWidth=2.4;
            g.beginPath(); g.moveTo(W*0.85,H*0.8); g.lineTo(W*0.9,H*0.7); g.stroke(); }
          if(type==='forester'){
            g.fillStyle='#3f7d35';
            g.beginPath(); g.moveTo(W*0.88,H*0.86); g.lineTo(W*0.94,H*0.72); g.lineTo(W*0.99,H*0.86); g.closePath(); g.fill();
            g.fillStyle='#6b4a2c'; g.fillRect(W*0.925,H*0.86,2.4,4); }
          if(type==='quarry'){
            g.fillStyle='#9a958c';
            g.beginPath(); g.arc(W*0.12,H*0.84,4.6,0,7); g.arc(W*0.2,H*0.87,3.6,0,7); g.fill();
            g.strokeStyle=OUT; g.lineWidth=1.2; g.stroke(); }
          if(type==='fisher'){
            g.strokeStyle='#5d452a'; g.lineWidth=2;
            g.beginPath(); g.moveTo(W*0.88,H*0.86); g.lineTo(W*0.97,H*0.6); g.stroke();
            g.strokeStyle='#a9c7d9'; g.lineWidth=1.2;
            g.beginPath(); g.moveTo(W*0.97,H*0.6); g.lineTo(W*0.94,H*0.76); g.stroke();
            g.fillStyle='#6fa7c7';
            g.beginPath(); g.ellipse(W*0.93,H*0.78,3.4,1.8,0.4,0,7); g.fill(); }
          if(type==='hunter'){
            g.strokeStyle='#6d4f2e'; g.lineWidth=2;
            g.beginPath(); g.moveTo(W*0.9,H*0.84); g.lineTo(W*0.86,H*0.72); g.moveTo(W*0.9,H*0.84); g.lineTo(W*0.95,H*0.72); g.stroke();
            g.beginPath(); g.moveTo(W*0.86,H*0.72); g.lineTo(W*0.83,H*0.66); g.moveTo(W*0.95,H*0.72); g.lineTo(W*0.98,H*0.66); g.stroke(); }
        }
      }
    });
  }

  // ================= Bäume & Objekte =================
  treeSprite(stage, theme, species){
    return this.sprite(`t_${stage}_${theme}_${species}`, 56, 74, (g,W,H)=>{
      const winter=theme==='winter';
      const s= stage===1? 0.45 : stage===2? 0.72 : 1;
      g.translate(W/2, H-2);
      if(species===0){
        // Nadelbaum: schlanker Stamm, 5 hängende Astlagen mit unruhiger Kante
        g.fillStyle='#7d5a38';
        g.beginPath();
        g.moveTo(-2.6*s,0); g.lineTo(-1.4*s,-16*s); g.lineTo(1.4*s,-16*s); g.lineTo(2.6*s,0);
        g.closePath(); g.fill();
        const leaf= winter? '#548061' : '#3f8040';
        const leafD= winter? '#42664f' : '#2f6532';
        const leafL= winter? '#78a184' : '#5ba455';
        const layer=(y,w2,h2)=>{
          // dunkle Unterlage
          for(const [c,sh] of [[leafD,0],[leaf,-1.6]]){
            g.fillStyle=c;
            g.beginPath();
            g.moveTo(0,(y-h2+sh)*s);
            // rechte Seite mit "Zacken" (hängende Astspitzen)
            g.quadraticCurveTo(w2*0.55*s,(y-h2*0.5+sh)*s, w2*0.72*s,(y-2+sh)*s);
            g.quadraticCurveTo(w2*0.8*s,(y+1.5+sh)*s, w2*s,(y+sh)*s);
            g.quadraticCurveTo(w2*0.5*s,(y+3+sh)*s, 0,(y+3+sh)*s);
            g.quadraticCurveTo(-w2*0.5*s,(y+3+sh)*s, -w2*s,(y+sh)*s);
            g.quadraticCurveTo(-w2*0.8*s,(y+1.5+sh)*s, -w2*0.72*s,(y-2+sh)*s);
            g.quadraticCurveTo(-w2*0.55*s,(y-h2*0.5+sh)*s, 0,(y-h2+sh)*s);
            g.closePath(); g.fill();
          }
        };
        layer(-8, 19, 14);
        layer(-18, 16, 13);
        layer(-28, 13, 12);
        layer(-38, 10, 11);
        layer(-47, 6.6, 10);
        // Lichtkante links
        g.strokeStyle='rgba(200,235,180,0.4)'; g.lineWidth=1.4;
        g.beginPath();
        g.moveTo(-1*s,-56*s); g.quadraticCurveTo(-9*s,-40*s,-13*s,-30*s);
        g.stroke();
        g.fillStyle=leafL;
        g.beginPath(); g.arc(-4*s,-44*s,2.6*s,0,7); g.arc(-7*s,-33*s,2.2*s,0,7); g.arc(-10*s,-22*s,2.4*s,0,7); g.fill();
        if(winter){
          g.fillStyle='rgba(244,248,252,0.95)';
          g.beginPath(); g.ellipse(0,-53*s,4*s,2.4*s,0,0,7); g.fill();
          g.beginPath(); g.ellipse(-6*s,-30*s,7*s,2.4*s,0.25,0,7); g.fill();
          g.beginPath(); g.ellipse(7*s,-19*s,8*s,2.6*s,-0.2,0,7); g.fill();
        }
      } else {
        // Laubbaum (species 1 = grün, 2 = Herbst in Amber/Rost)
        const autumn=species===2;
        g.fillStyle='#7d5a38';
        g.beginPath();
        g.moveTo(-3.4*s,0);
        g.quadraticCurveTo(-2*s,-10*s,-2.6*s,-20*s);   // Stamm
        g.lineTo(-0.6*s,-22*s);
        g.lineTo(0.8*s,-20*s);
        g.quadraticCurveTo(2*s,-10*s,3.4*s,0);
        g.closePath(); g.fill();
        g.strokeStyle='#7d5a38'; g.lineWidth=2.2*s;    // Astgabeln
        g.beginPath();
        g.moveTo(-1*s,-19*s); g.quadraticCurveTo(-7*s,-24*s,-10*s,-28*s);
        g.moveTo(0.4*s,-19*s); g.quadraticCurveTo(6*s,-25*s,9*s,-29*s);
        g.stroke();
        // Kronen-Lappen (unregelmäßig, wie echte Baumkrone)
        const lobes=[
          [0,-42,13],[ -11,-36,10],[11,-35,10],[ -6,-47,9],[7,-46,9],[0,-30,11],[-14,-28,7.5],[14,-27,7.5],
        ];
        const leaf= winter? '#7fa072' : autumn? '#c08a42' : '#5c9c4c';
        const leafD= winter? '#617f58' : autumn? '#96622c' : '#47793a';
        const leafL= winter? '#a2bd92' : autumn? '#dcab60' : '#7fb968';
        // dunkle Silhouette
        g.fillStyle=leafD;
        g.beginPath();
        for(const [lx,ly,lr] of lobes){ g.moveTo((lx+lr+1.5)*s,ly*s); g.arc(lx*s,ly*s,(lr+1.5)*s,0,7); }
        g.fill();
        // Hauptton
        g.fillStyle=leaf;
        g.beginPath();
        for(const [lx,ly,lr] of lobes){ g.moveTo((lx+lr-0.6)*s,(ly-1)*s); g.arc((lx-0.8)*s,(ly-1.2)*s,(lr-0.6)*s,0,7); }
        g.fill();
        // Formschatten unten rechts
        g.fillStyle=autumn?'rgba(90,50,15,0.3)':'rgba(30,70,25,0.3)';
        g.beginPath();
        g.arc(8*s,-28*s,9*s,0,7); g.arc(3*s,-33*s,8*s,0,7);
        g.fill();
        // Blattbüschel-Highlights oben links (kleine Kreisgruppen)
        g.fillStyle=leafL;
        for(const [hx,hy,hr] of [[-8,-48,3.4],[-4,-51,2.8],[-13,-40,3],[-16,-33,2.6],[-2,-44,2.4],[4,-50,2.6],[-9,-31,2.2]]){
          g.beginPath(); g.arc(hx*s,hy*s,hr*s,0,7); g.fill();
        }
        g.fillStyle=autumn?'rgba(245,215,150,0.6)':'rgba(225,245,195,0.6)';
        for(const [hx,hy,hr] of [[-9,-49,1.6],[-14,-41,1.4],[-3,-52,1.3]]){
          g.beginPath(); g.arc(hx*s,hy*s,hr*s,0,7); g.fill();
        }
        // vereinzelte Blatt-Tupfer an der Kronenkante
        g.fillStyle=leaf;
        for(const [hx,hy] of [[-17,-24],[17,-23],[0,-55],[12,-44],[-13,-49]]){
          g.beginPath(); g.arc(hx*s,hy*s,1.8*s,0,7); g.fill();
        }
      }
    });
  }
  // kleine Wiesen-Deko: Blümchen, Grasbüschel, Kiesel (rein dekorativ)
  drawDoodad(g, m, i){
    const t=m.terr[i];
    if(t!==TER.GRASS && t!==TER.DESERT) return;
    const h=hash01(i*13+5);
    if(h>0.24) return;
    const [x,y]=m.worldPos(i);
    const h2=hash01(i*29+11);
    const ox=(h2-0.5)*22, oy=(hash01(i*31+7)-0.5)*16;
    if(t===TER.DESERT){
      if(h<0.1){ // Steinchen
        g.fillStyle='rgba(150,135,105,0.7)';
        g.beginPath(); g.arc(x+ox,y+oy,2.2,0,7); g.arc(x+ox+4,y+oy+1.6,1.6,0,7); g.fill();
      } else { // trockenes Büschel
        g.strokeStyle='rgba(150,140,90,0.8)'; g.lineWidth=1.4;
        for(let k=-1;k<=1;k++){ g.beginPath(); g.moveTo(x+ox+k*2,y+oy); g.quadraticCurveTo(x+ox+k*3,y+oy-4,x+ox+k*4.5,y+oy-6); g.stroke(); }
      }
      return;
    }
    // Gemaltes Bluemchen und gemalter Pilz sind entfallen: dafuer gibt es
    // jetzt die Deko-Bilder (deco_flowers, deco_mushroom ...), die weiter
    // oben gestreut werden. Zwei Sorten Blumen nebeneinander sahen aus wie
    // zwei verschiedene Spiele. Der Bereich bleibt bewusst leer, damit die
    // Wiese nicht plötzlich mit Beerenstraeuchern zuwaechst.
    if(h<0.105){ /* frei - hier uebernimmt die Deko-Grafik */ }
    else if(h<0.14){ // Beerenstrauch
      g.fillStyle='#3f7d3a';
      g.beginPath(); g.arc(x+ox,y+oy-2.5,4,0,7); g.arc(x+ox+3.4,y+oy-1.5,3,0,7); g.arc(x+ox-3.4,y+oy-1.5,3,0,7); g.fill();
      g.fillStyle='#68a552';
      g.beginPath(); g.arc(x+ox-1,y+oy-3.6,2.6,0,7); g.fill();
      g.fillStyle='#d0453a';
      g.beginPath(); g.arc(x+ox-2,y+oy-2,0.9,0,7); g.arc(x+ox+1.6,y+oy-3.2,0.9,0,7); g.arc(x+ox+3,y+oy-0.8,0.9,0,7); g.fill();
    } else if(h<0.2){ // Grasbüschel
      g.strokeStyle='rgba(62,118,52,0.75)'; g.lineWidth=1.6;
      for(let k=-1;k<=1;k++){
        g.beginPath(); g.moveTo(x+ox+k*2.2,y+oy);
        g.quadraticCurveTo(x+ox+k*3,y+oy-4.4, x+ox+k*4.6,y+oy-6.6);
        g.stroke();
      }
    } else { // Kiesel
      g.fillStyle='rgba(140,140,130,0.55)';
      g.beginPath(); g.arc(x+ox,y+oy,2,0,7); g.arc(x+ox+3.6,y+oy+1.2,1.4,0,7); g.fill();
    }
  }

  // ---------- Wasser-Stempel (einmal vorbereitet, pro Frame nur drawImage) ----------
  // Weiche Offscreen-Stempel für die Wasser-Animation: kleine Glanzlichter,
  // ein nahtloses "Wolkenlicht"-Tile für großflächige Helligkeitsmodulation
  // und ein länglicher Schaumfleck für den Ufersaum. Alles ohne ctx.filter
  // (iPhone!) – nur Radialverläufe. Deterministisch aus hash01 aufgebaut.
  waterStamps(){
    if(this._waterStamps) return this._waterStamps;
    const mk=(w,h,fn)=>{
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      fn(c.getContext('2d'),w,h); return c;
    };
    // weicher elliptischer Lichtfleck (Radialverlauf, gequetscht)
    const blob=(q,x,y,r,sx,sy,col,a)=>{
      q.save(); q.translate(x,y); q.scale(sx,sy);
      const gr=q.createRadialGradient(0,0,0, 0,0,r);
      gr.addColorStop(0, `${col}${a})`);
      gr.addColorStop(0.55, `${col}${(a*0.42).toFixed(3)})`);
      gr.addColorStop(1, `${col}0)`);
      q.fillStyle=gr; q.beginPath(); q.arc(0,0,r,0,7); q.fill();
      q.restore();
    };
    const st={};
    // 4 Glanzlicht-Varianten: 1-2 überlappende, horizontal gestreckte Flecken
    st.glints=[];
    for(let v=0; v<4; v++){
      st.glints.push(mk(52,22,(q,w,h)=>{
        const n=1+(v&1);
        for(let k=0;k<=n;k++){
          const bx=w/2+(hash01(v*31+k*7+1)-0.5)*15;
          const by=h/2+(hash01(v*17+k*13+2)-0.5)*5;
          const r=4+hash01(v*13+k*3+3)*3.5;
          blob(q,bx,by,r,2.1,0.55,'rgba(255,252,240,', k===0?0.8:0.45);
        }
      }));
    }
    // nahtloses Wolkenlicht-Tile: helle und dunkle Weichflecken, an den
    // Kacheln umgebrochen (jeder Fleck 9x versetzt gezeichnet -> nahtlos)
    st.cloud=mk(512,512,(q,w,h)=>{
      const wrap=(x,y,r,sx,sy,col,a)=>{
        for(const [ox,oy] of [[0,0],[w,0],[-w,0],[0,h],[0,-h],[w,h],[-w,h],[w,-h],[-w,-h]])
          blob(q,x+ox,y+oy,r,sx,sy,col,a);
      };
      for(let k=0;k<5;k++)
        wrap(hash01(k*7+101)*w, hash01(k*11+102)*h, 92+hash01(k*13+103)*68,
             1.35, 0.78, 'rgba(232,246,255,', 0.5);
      for(let k=0;k<5;k++)
        wrap(hash01(k*7+201)*w, hash01(k*11+202)*h, 105+hash01(k*13+203)*75,
             1.3, 0.85, 'rgba(6,26,40,', 0.5);
    });
    // Wolkenlicht als weltverankertes Muster in zwei Maßstäben
    st.patA=this.ctx.createPattern(st.cloud,'repeat');
    st.patB=this.ctx.createPattern(st.cloud,'repeat');
    if(st.patB && st.patB.setTransform){
      try{ st.patB.setTransform(new DOMMatrix().rotate(23).scale(2.1)); }
      catch(_){ st.patB=st.patA; }
    } else st.patB=st.patA;
    // Ufersaum: länglicher, unregelmäßiger Schaumfleck (heller Kern, weicher Rand)
    st.foam=mk(72,30,(q,w,h)=>{
      blob(q,w/2,h/2,12,2.6,0.9,'rgba(244,250,255,',0.30);
      blob(q,w/2,h/2,9,2.3,0.75,'rgba(248,252,255,',0.42);
      for(let k=-1;k<=1;k++)
        blob(q, w/2+k*17+(hash01(k*5+11)-0.5)*6, h/2+(hash01(k*3+21)-0.5)*4,
             4.6+hash01(k*7+31)*2, 1.25, 0.85, 'rgba(250,253,255,', 0.5);
    });
    this._waterStamps=st;
    return st;
  }
  // ================= Hauptzeichnung =================
  draw(cam, ui, dtMs){
    const g=this.ctx, game=this.game, m=game.map;
    this.time+=dtMs;
    this._lastCam=cam;
    g.setTransform(this.dpr,0,0,this.dpr,0,0);
    // Hintergrund: Tiefwasser mit leichtem Verlauf
    const cols=TER_COL[this.theme]||TER_COL.gruen;
    const bg=g.createLinearGradient(0,0,0,this.vh);
    bg.addColorStop(0, shade(cols[TER.WATER],0.95));
    bg.addColorStop(1, shade(cols[TER.WATER],0.85));
    g.fillStyle=bg;
    g.fillRect(0,0,this.vw,this.vh);
    // Kamera
    g.save();
    g.translate(this.vw/2, this.vh/2);
    g.scale(cam.z, cam.z);
    g.translate(-cam.x, -cam.y);
    g.lineJoin='round'; g.lineCap='round';
    // Die Gelände-Chunks hängen NUR an Gelände/Höhe (unveränderlich) und den
    // Erzadern der Geologen-Schilder. Objekt-/Fahnen-/Gebäudeänderungen
    // (gefällte Bäume, Felder, Baustellen ...) werden pro Frame separat
    // gezeichnet – sie invalidieren die Chunks NICHT mehr. Vorher kostete
    // jeder gefällte Baum den Neuaufbau von bis zu 4 Chunks (~50 ms Ruckler).
    game.changedNodes.length=0;
    if(game.signs && game.signs.size!==this._signsSeen.size){
      for(const q of game.signs.keys())
        if(!this._signsSeen.has(q)){ this._signsSeen.add(q); this.markDirtyNode(q); }
    }
    // Bergwerke glaetten die gemalte Terrassierung/Anhebung um ihren Knoten
    // (Minen-Verankerung, Nutzerfoto IMG_7989) – neu gebaute oder abgerissene
    // Minen backen die betroffenen Chunks neu. Billig: wenige Gebaeude,
    // seltene Aenderung, Vergleich ueber Anzahl+Knotensumme.
    {
      let nM=0, sumM=0;
      for(const b of game.buildings.values())
        if(BLD[b.type] && BLD[b.type].size==='MINE'){ nM++; sumM+=b.node; }
      if(nM!==this._mineSeen.size || sumM!==(this._mineSum|0)){
        const cur=new Set();
        for(const b of game.buildings.values())
          if(BLD[b.type] && BLD[b.type].size==='MINE') cur.add(b.node);
        for(const q of cur) if(!this._mineSeen.has(q)) this.markDirtyNode(q);
        for(const q of this._mineSeen) if(!cur.has(q)) this.markDirtyNode(q);
        this._mineSeen=cur; this._mineSum=sumM;
        this._liftC=null;   // Anhebung haengt an den Minenknoten
      }
    }
    // hoechstens 2 veraltete Chunks je Frame neu aufbauen; im teureren
    // 2x-Bake (G3) nur 1 – die Nachbauten verteilen sich auf mehr Frames
    this._chunkBudget= (this._chunkScale===2)? 1 : 2;
    // Kritik G3: Bake-Aufloesung an devicePixelRatio*Zoom koppeln. Ueber
    // q=1.75 backen Chunks doppelt aufgeloest (Fels so scharf wie die
    // Baeume), unter 1.35 wieder einfach – die Hysterese verhindert
    // Rebake-Pendeln beim Pinch. Der Wechsel invalidiert die Chunks ueber
    // den c.scale-Vergleich in getChunk, verteilt aufs Frame-Budget.
    {
      const q=this.dpr*cam.z;
      const cs=this._chunkScale||1;
      if(cs===1 && q>1.75) this._chunkScale=2;
      else if(cs===2 && q<1.35) this._chunkScale=1;
      else if(!this._chunkScale) this._chunkScale=cs;
    }
    const halfW=this.vw/2/cam.z, halfH=this.vh/2/cam.z;
    const wx0=cam.x-halfW-TILE*2, wx1=cam.x+halfW+TILE*2;
    const wy0=cam.y-halfH-ROWH*2, wy1=cam.y+halfH+ROWH*3;
    const cx0=Math.floor(wx0/(CHUNK*TILE)), cx1=Math.floor(wx1/(CHUNK*TILE));
    const cy0=Math.floor(wy0/(CHUNK*ROWH)), cy1=Math.floor(wy1/(CHUNK*ROWH));
    for(let cy=Math.max(0,cy0); cy<=Math.min(Math.ceil(m.h/CHUNK)-1,cy1); cy++)
      for(let cx=Math.max(0,cx0); cx<=Math.min(Math.ceil(m.w/CHUNK)-1,cx1); cx++){
        const c=this.getChunk(cx,cy);
        // Nur den SICHTBAREN Ausschnitt zeichnen (Quellrechteck in
        // Bake-Pixeln, Ziel in Weltpixeln): das Herunterfiltern des ganzen
        // hochaufgeloesten Canvas (G3) kostete sonst ein Vielfaches des
        // Sichtfelds an Fuellrate – gerade auf dem Handy.
        const sc=c.scale||1;
        const ix0=Math.max(c.ox, wx0-8), ix1=Math.min(c.ox+c.dw, wx1+8);
        const iy0=Math.max(c.oy, wy0-8), iy1=Math.min(c.oy+c.dh, wy1+8);
        if(ix1<=ix0 || iy1<=iy0) continue;
        g.drawImage(c.cv, (ix0-c.ox)*sc, (iy0-c.oy)*sc, (ix1-ix0)*sc, (iy1-iy0)*sc,
                    ix0, iy0, ix1-ix0, iy1-iy0);
      }
    const x0=Math.max(0,Math.floor(wx0/TILE)-1), x1=Math.min(m.w-1,Math.ceil(wx1/TILE)+1);
    const y0=Math.max(0,Math.floor(wy0/ROWH)-2), y1=Math.min(m.h-1,Math.ceil(wy1/ROWH)+6);
    // Fischschwärme zeigen ergiebige Fanggründe an (Anzahl = Bestand)
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=m.idx(x,y);
      if(m.terr[i]!==TER.WATER || !m.explored[i] || m.fish[i]<2) continue;
      const [px,py]=m.worldPos(i);
      // nur in echtem Tiefwasser – sonst ragt der Schwarm über den Strand
      let deep=true;
      for(const q of m.nbs(i)) if(m.terr[q]!==TER.WATER){ deep=false; break; }
      if(!deep) continue;
      const n=Math.min(9, 3+Math.floor(m.fish[i]/1.4));
      // Der Schwarm zieht in EINE Richtung und pendelt nur leicht, statt sich
      // um sich selbst zu drehen. Richtung fest je Fanggrund.
      const dirA=hash01(i*3+11)*6.283;
      const t=this.time/5200 + hash01(i)*6.28;
      const swing=Math.sin(t)*13;
      const cx3=px+Math.cos(dirA)*swing, cy3=py+Math.sin(dirA)*swing*0.55;
      const head=dirA + (Math.cos(t)>=0?0:Math.PI) + Math.sin(this.time/2400+i)*0.10;
      const simg=this.asset('fx_school');
      if(simg){
        const hh=20+Math.min(9,m.fish[i])*1.6, ww=hh*(simg.naturalWidth/simg.naturalHeight);
        g.save();
        g.translate(cx3,cy3); g.rotate(head);
        g.globalAlpha=0.66;
        g.drawImage(simg,-ww/2,-hh/2,ww,hh);
        g.restore();
        g.globalAlpha=1;
        continue;
      }
      // Schwarmschatten: die Gruppe steht erkennbar UNTER der Oberflaeche
      const sh=g.createRadialGradient(cx3,cy3,2,cx3,cy3,7+n*2.1);
      sh.addColorStop(0,'rgba(12,34,50,0.28)');
      sh.addColorStop(1,'rgba(12,34,50,0)');
      g.fillStyle=sh;
      g.save(); g.translate(cx3,cy3); g.rotate(head); g.scale(1.5,0.8);
      g.beginPath(); g.arc(0,0,7+n*2.1,0,7); g.fill();
      g.restore();
      for(let k=0;k<n;k++){
        // gestaffelte Formation statt Kette: breiter, lebendiger Schwarm
        const row=(k/3)|0, col=(k%3)-1;
        const fx2=cx3-Math.cos(head)*row*5.4 - Math.sin(head)*col*4.6 + (hash01(i*13+k)-0.5)*3.4;
        const fy2=cy3-Math.sin(head)*row*5.4 + Math.cos(head)*col*4.6 + (hash01(i*17+k)-0.5)*3;
        const wig=Math.sin(this.time/190+k*1.7+i)*0.34;
        g.save();
        g.translate(fx2,fy2); g.rotate(head+wig);
        // Leib: schlank, silbrig, nach hinten spitz zulaufend
        g.fillStyle='rgba(70,110,132,0.62)';
        g.beginPath();
        g.moveTo(3.4,0);
        g.quadraticCurveTo(1.2,-1.5, -2.2,-0.9);
        g.quadraticCurveTo(-3.2,0, -2.2,0.9);
        g.quadraticCurveTo(1.2,1.5, 3.4,0);
        g.closePath(); g.fill();
        // Schwanzflosse mit Kerbe
        g.beginPath();
        g.moveTo(-2.2,0); g.lineTo(-4.4,-1.6); g.lineTo(-3.4,0); g.lineTo(-4.4,1.6);
        g.closePath(); g.fill();
        // Rueckenlinie hell -> liest sich durch das Wasser als Fisch
        g.strokeStyle='rgba(206,236,248,0.5)'; g.lineWidth=0.7;
        g.beginPath(); g.moveTo(2.4,-0.35); g.quadraticCurveTo(0,-1.05,-1.8,-0.5); g.stroke();
        g.restore();
      }
    }
    // Wasser-Leben: statt der früheren Linien-"Wellen" (lasen sich als dünne
    // Striche quer über den See) drei weiche Schichten:
    //  (1) sehr langsames, großflächiges Wolkenlicht (Hell-/Dunkel-Flecken),
    //  (2) zwei Lagen kleiner Glanzlichter, die sanft aufblinken und mit
    //      unterschiedlicher Drift wandern (Parallaxe-Gefühl).
    // Alles läuft NACH den Chunks (Animation darf nie in den Chunk-Cache)
    // und ist deterministisch aus Zellkoordinaten gehasht — kein
    // Math.random pro Frame. Die Stempel sind vorbereitete Offscreens.
    {
      g.save();
      g.beginPath();
      let any=false;
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const i=m.idx(x,y);
        if(m.terr[i]!==TER.WATER || !m.explored[i]) continue;
        const [px,py]=m.worldPos(i);
        g.moveTo(px+TILE*0.62, py);
        g.arc(px,py,TILE*0.62,0,7);
        any=true;
      }
      if(any){
        g.clip();
        const st=this.waterStamps();
        const t=this.time;
        // (1) Wolkenlicht: das nahtlose Tile als Muster, zwei Lagen mit
        // eigener Drift und ganz langsamer Atmung — belebt große Flächen,
        // ohne je ein Streifenmuster zu bilden. Die Muster-Füllungen sind
        // teuer, deshalb werden beide Lagen in einen KLEINEN Offscreen
        // (1/6 der Sichtgröße) gemalt und einmal weich hochskaliert —
        // das kostet fast nichts und macht die Flecken zusätzlich weicher.
        if(st.patA){
          if(!this._wcC) this._wcC=document.createElement('canvas');
          const sw=Math.max(32,Math.ceil(this.vw/6)), sh=Math.max(32,Math.ceil(this.vh/6));
          if(this._wcC.width!==sw||this._wcC.height!==sh){ this._wcC.width=sw; this._wcC.height=sh; }
          const q=this._wcC.getContext('2d');
          q.setTransform(1,0,0,1,0,0);
          q.clearRect(0,0,sw,sh);
          q.setTransform(sw/(wx1-wx0),0,0,sh/(wy1-wy0),0,0);
          q.translate(-wx0,-wy0);
          for(const L of [{pat:st.patA, vx:4.6, vy:2.0, a:0.10, per:9000},
                          {pat:st.patB, vx:-2.4, vy:3.1, a:0.075, per:13000}]){
            if(!L.pat) continue;
            const ox=t*L.vx/1000, oy=t*L.vy/1000;
            q.save();
            q.translate(ox,oy);
            q.globalAlpha=L.a*(0.8+0.2*Math.sin(t/L.per*6.283));
            q.fillStyle=L.pat;
            q.fillRect(wx0-ox,wy0-oy,wx1-wx0,wy1-wy0);
            q.restore();
          }
          q.setTransform(1,0,0,1,0,0);
          g.imageSmoothingEnabled=true;
          g.drawImage(this._wcC, wx0, wy0, wx1-wx0, wy1-wy0);
        }
        // (2) Glanzlichter: je Rasterzelle höchstens ein Fleck (niedrige
        // Dichte), Position/Phase aus der Zelle gehasht, die ganze Lage
        // driftet gleichmäßig — feine Lage bei weitem Zoom ausgeblendet
        const fein=Math.max(0,Math.min(1,(cam.z-0.5)/0.3));
        for(const L of [{cell:46, vx:6.4, vy:2.7, sc:1.0, a:0.27*fein, dens:0.34, per:2600, sd:29},
                        {cell:80, vx:-3.3, vy:1.5, sc:1.6, a:0.20, dens:0.40, per:3600, sd:57}]){
          if(L.a<=0.01) continue;
          const ox=t*L.vx/1000, oy=t*L.vy/1000;
          const c0x=Math.floor((wx0-ox)/L.cell), c1x=Math.floor((wx1-ox)/L.cell);
          const c0y=Math.floor((wy0-oy)/L.cell), c1y=Math.floor((wy1-oy)/L.cell);
          for(let cy2=c0y;cy2<=c1y;cy2++) for(let cx2=c0x;cx2<=c1x;cx2++){
            const key=(Math.imul(cx2,73856093)^Math.imul(cy2,19349663)^L.sd)|0;
            const h1=hash01(key), h2=hash01(key+77), h3=hash01(key+154);
            if(h1>L.dens) continue;
            const px2=(cx2+0.15+h2*0.7)*L.cell+ox, py2=(cy2+0.15+h3*0.7)*L.cell+oy;
            // sanftes Aufblinken (quadriert -> weiches Ein-/Ausblenden)
            const tw=Math.sin(t/(L.per*(0.7+h2*0.6))*6.283 + h1*40);
            if(tw<=0.05) continue;
            const cv=st.glints[(key>>>2)&3];
            const s=L.sc*(0.8+h3*0.5);
            const w2=cv.width*s, h4=cv.height*s;
            g.globalAlpha=L.a*tw*tw;
            g.drawImage(cv, px2-w2/2, py2-h4/2, w2, h4);
          }
        }
        g.globalAlpha=1;
      }
      g.restore();
    }
    // Einzelfische, die gemächlich durch das offene Wasser ziehen
    {
      const fimg=this.asset('fx_fish');
      if(fimg) for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const i=m.idx(x,y);
        if(m.terr[i]!==TER.WATER || !m.explored[i]) continue;
        if(hash01(i*7+29)<0.90) continue;                 // sehr sparsam
        let deep=true;
        for(const q of m.nbs(i)) if(m.terr[q]!==TER.WATER){ deep=false; break; }
        if(!deep) continue;
        const [px,py]=m.worldPos(i);
        const a2=hash01(i*13+5)*6.283;
        const t=this.time/6400 + hash01(i)*6.28;
        const sw=Math.sin(t)*17;
        const fx2=px+Math.cos(a2)*sw, fy2=py+Math.sin(a2)*sw*0.5;
        const hh=7.5, ww=hh*(fimg.naturalWidth/fimg.naturalHeight);
        g.save();
        g.translate(fx2,fy2);
        g.rotate(a2 + (Math.cos(t)>=0?0:Math.PI) + Math.sin(this.time/700+i)*0.12);
        g.globalAlpha=0.5;
        g.drawImage(fimg,-ww/2,-hh/2,ww,hh);
        g.restore();
        g.globalAlpha=1;
      }
    }
    // sanfter Uferschaum entlang der Küste: weiche, längliche Schaumflecken
    // (vorbereiteter Stempel) statt dünner Striche; jeder Fleck atmet
    // langsam in Helligkeit und schiebt sich minimal zum Wasser und zurück
    {
      const fcv=this.waterStamps().foam;
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const i=m.idx(x,y);
        if(m.terr[i]!==TER.WATER || !m.explored[i]) continue;
        let kE=0;
        for(const n of m.nbs(i)){
          if(m.terr[n]===TER.WATER) continue;
          const hsh=hash01(i*5+kE*131+1);
          kE++;
          const foamA=0.30+0.20*Math.sin(this.time/1900+hsh*6.283);
          if(foamA<=0.06) continue;
          const [px,py]=m.worldPos(i), [lx,ly]=m.worldPos(n);
          const dx=lx-px, dy=ly-py;
          const L=Math.hypot(dx,dy)||1;
          // Atmen: der Saum wandert minimal Richtung Wasser und zurück
          const push=Math.sin(this.time/1600+hsh*9)*2.2 - 1.5;
          const mx=(px+lx)/2 + dx/L*push, my=(py+ly)/2 + dy/L*push;
          g.save();
          g.translate(mx,my);
          g.rotate(Math.atan2(dy,dx)+Math.PI/2);   // längs zur Uferlinie
          g.globalAlpha=Math.min(0.5,foamA);
          const w2=44+hsh*14, h2=16+hsh*5;
          g.drawImage(fcv,-w2/2,-h2/2,w2,h2);
          g.restore();
        }
      }
      g.globalAlpha=1;
    }
    // Wiesen-Deko (nur bei näherem Zoom sichtbar sinnvoll)
    if(cam.z>=0.7){
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const i=m.idx(x,y);
        if(!m.explored[i] || m.bld[i]>=0 || m.flag[i] || (m.obj[i]&127)!==OBJ.NONE) continue;
        this.drawDoodad(g, m, i);
      }
    }
    // Territorium-Grenzen
    if(this.lastTerritoryVer!==game.territoryVer){ this.computeBorders(); this.lastTerritoryVer=game.territoryVer; }
    // dezente Linie als Orientierung ...
    for(const e of this.borderEdges){
      if(e.x2<wx0||e.x1>wx1||e.y2<wy0-60||e.y1>wy1+60) continue;
      g.strokeStyle=PLAYER_COLORS[e.pl]+'55'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(e.x1,e.y1); g.lineTo(e.x2,e.y2); g.stroke();
    }
    // ... und Grenzpfosten mit Wimpel in Spielerfarbe als eigentliche Markierung
    if(this.borderPosts) for(const p of this.borderPosts){
      if(p.x<wx0-20||p.x>wx1+20||p.y<wy0-40||p.y>wy1+40) continue;
      this.drawBorderPost(g, p);
    }
    // Zuordnung Türfahne -> Gebäude (für die Eingangs-Position der Fahnen)
    this._doorMap=new Map();
    for(const b of game.buildings.values())
      if(b.door!=null && b.door>=0 && m.flag[b.door] && !this._doorMap.has(b.door))
        this._doorMap.set(b.door, b);
    // ---------- Getreideäcker ----------
    // Getreide wächst nicht in Beeten, sondern auf einer zusammenhängenden
    // Fläche. Gezeichnet wird deshalb nicht Knoten für Knoten ein Kästchen,
    // sondern je Acker EINE Fläche: Kreise auf den Feldpunkten, dazwischen
    // Verbindungsstücke, alles als eine Form gefüllt und als Maske gesetzt.
    // Innerhalb liegen Furchen und Halme durch – über Knotengrenzen hinweg,
    // damit der Acker wie ein Stück wirkt und nicht wie ein Flickenteppich.
    {
      const istFeld=(n)=>{ const o=m.obj[n]&127; return o===OBJ.FIELD0||o===OBJ.FIELD1||o===OBJ.FIELD2; };
      const gesehen=new Set();
      const aecker=[];
      const fy0=Math.max(0, Math.floor((wy0-120)/ROWH)), fy1=Math.min(m.h-1, Math.ceil((wy1+120)/ROWH));
      const fx0=Math.max(0, Math.floor((wx0-120)/TILE)), fx1=Math.min(m.w-1, Math.ceil((wx1+120)/TILE));
      for(let yy=fy0; yy<=fy1; yy++) for(let xx=fx0; xx<=fx1; xx++){
        const n=m.idx(xx,yy);
        if(gesehen.has(n) || !istFeld(n)) continue;
        // zusammenhängende Feldpunkte einsammeln
        const grp=[], stapel=[n];
        gesehen.add(n);
        while(stapel.length){
          const c=stapel.pop(); grp.push(c);
          for(const q of m.nbs(c)) if(!gesehen.has(q) && istFeld(q)){ gesehen.add(q); stapel.push(q); }
        }
        aecker.push(grp);
      }
      for(const grp of aecker){
        // Ein Acker ist ein ECKIGES Stueck Land: ein Quadrat in der
        // Spielperspektive, also ein Parallelogramm mit waagerechter Ober-
        // und Unterkante und schraegen Seiten (die beiden Gitterachsen
        // u=(TILE,0) und v=(TILE/2,ROWH)). Nicht je Zelle eine Form -
        // hochkant stehende Rauten sahen aus wie Wimpel, nicht wie Felder.
        const pos=grp.map(n=>m.worldPos(n));
        let cx=0, cy=0;
        for(const [px2,py2] of pos){ cx+=px2; cy+=py2; }
        cx/=pos.length; cy/=pos.length;
        // Achsen wie bei den GEBAEUDEN: deren Grundkanten laufen in der
        // gemalten Iso-Ansicht mit etwa 2:1-Steigung nach rechts oben und
        // rechts unten. Ein Acker mit denselben Kanten liegt in derselben
        // Welt wie die Hoefe - vorher stand er quer zur Bauperspektive.
        const E1=[TILE, TILE*0.5], E2=[-TILE, TILE*0.5];
        let su=0.36, sv=0.36;
        for(const [px2,py2] of pos){
          const dx=px2-cx, dy=py2-cy;
          const pp=(dx/E1[0]+dy/E1[1])/2, qq=(dy/E1[1]-dx/E1[0])/2;
          su=Math.max(su, Math.abs(pp)+0.36);
          sv=Math.max(sv, Math.abs(qq)+0.36);
        }
        // Sicherheitsnetz gegen Riesenrauten (Alt-Stände, KI-Restfelder):
        // die Zeichenachsen passen nicht exakt aufs Gitter, mehrzeilige
        // Gruppen blähten die Raute sonst weit über ihre Zellen hinaus auf
        su=Math.min(su, 1.35); sv=Math.min(sv, 1.35);
        const viereck=(f, u0,u1,v0,v1)=>{
          const P=(pu,pv)=>[cx+pu*E1[0]+pv*E2[0], cy+pu*E1[1]+pv*E2[1]];
          const A=P(u0,v0), B=P(u1,v0), C=P(u1,v1), D=P(u0,v1);
          f.moveTo(A[0],A[1]); f.lineTo(B[0],B[1]); f.lineTo(C[0],C[1]); f.lineTo(D[0],D[1]); f.closePath();
        };
        const form=new Path2D();
        viereck(form, -su, su, -sv, sv);
        // Feldrain: schmaler Erdstreifen rundum, gleiche eckige Form
        const rain=new Path2D();
        viereck(rain, -su-0.10, su+0.10, -sv-0.10, sv+0.10);
        g.save();
        g.fillStyle='rgba(96,74,44,0.55)';
        g.fill(rain);
        g.restore();
        g.save();
        g.clip(form);
        const tex=[this.asset('ter_field_0'), this.asset('ter_field_1'), this.asset('ter_field_2')];
        if(tex[0]&&tex[1]&&tex[2]){
          if(!this._fieldPat) this._fieldPat=new Map();
          const pat=(ix)=>{
            let pp=this._fieldPat.get(ix);
            if(!pp){
              pp=g.createPattern(tex[ix],'repeat');
              try{ if(pp&&pp.setTransform){
                const mtx=new DOMMatrix(); mtx.rotateSelf(26.57); mtx.scaleSelf(104/512, 88/512);
                pp.setTransform(mtx);
              } }catch(_){}
              this._fieldPat.set(ix,pp);
            }
            return pp;
          };
          // Grundlage: gepfluegte Erde
          const p0=pat(0);
          try{ if(p0&&p0.setTransform){
            const mtx=new DOMMatrix(); mtx.rotateSelf(26.57); mtx.scaleSelf(104/512, 88/512);
            p0.setTransform(mtx);
          } }catch(_){}
          g.fillStyle=p0;
          const bw2=(su+sv)*TILE, bh2=(su+sv)*TILE*0.5;
          g.fillRect(cx-bw2, cy-bh2, bw2*2, bh2*2);
          // Wachstum als durchlaufende Baender von unten nach oben: der Hof
          // saet der Reihe nach, entsprechend reift das Feld in Streifen.
          const n1=grp.filter(n=>(m.obj[n]&127)===OBJ.FIELD1).length;
          const n2=grp.filter(n=>(m.obj[n]&127)===OBJ.FIELD2).length;
          const f12=(n1+n2)/grp.length, f2=n2/grp.length;
          const wPh=this.time/900 + (grp[0]%17);
          const band=(stufe, anteil)=>{
            if(anteil<=0.001) return;
            const teil=new Path2D();
            viereck(teil, -su, su, sv-2*sv*anteil, sv);
            const pp=pat(stufe);
            const wob=Math.sin(wPh)*(stufe===2?1.0:0.5);
            try{ if(pp&&pp.setTransform){
              // Wind = reine Scherung um den FELDFUSS: die Halmwurzeln
              // stehen fest, nur die Spitzen neigen sich. Die frühere
              // seitliche Verschiebung (translate) schob die ganze Textur
              // durchs Feld - das las sich als Fließband.
              const yFuss=cy+sv*TILE*0.5;
              const mtx=new DOMMatrix();
              mtx.translateSelf(0, yFuss); mtx.skewXSelf(2.4*wob); mtx.translateSelf(0, -yFuss);
              mtx.rotateSelf(26.57); mtx.scaleSelf(104/512, 88/512);
              pp.setTransform(mtx);
            } }catch(_){}
            g.fillStyle=pp; g.fill(teil);
            g.globalAlpha=0.20; g.strokeStyle='rgba(58,40,24,1)'; g.lineWidth=1.3;
            g.stroke(teil); g.globalAlpha=1;
          };
          band(1, f12);
          band(2, f2);
        } else {
          g.fillStyle='#7d5a37';
          const bw3=(su+sv)*TILE, bh3=(su+sv)*TILE*0.5;
          g.fillRect(cx-bw3, cy-bh3, bw3*2, bh3*2);
          g.strokeStyle='rgba(58,40,24,0.30)'; g.lineWidth=1.3;
          for(let yy=Math.floor((cy-bh3)/7)*7; yy<cy+bh3; yy+=7){
            g.beginPath(); g.moveTo(cx-bw3, yy); g.lineTo(cx+bw3, yy); g.stroke();
          }
        }
        g.restore();
        // eckige Kante des Ackers
        g.save();
        g.strokeStyle='rgba(70,52,30,0.4)'; g.lineWidth=1.6;
        g.stroke(form);
        g.restore();
      }
    }
    // Vorplatz: vor den Toren der großen Lagerbauten liegt gepflasterter
    // Grund. Er gehört an den EINGANG. Mittig unters Haus gelegt verschwände
    // er darunter und lugte nur als grauer Fleck am Fuß hervor – genau das
    // sah aus wie ein Schmutzrand statt wie ein Platz.
    {
      const pl=this.asset('road_plaza');
      if(pl) for(const b of game.buildings.values()){
        const def=BLD[b.type];
        if(!def || !def.store || b.state!=='done') continue;
        if(b.door==null || b.door<0 || !m.flag[b.door]) continue;
        const [dx,dy]=this.doorVisualPos(b.door);
        if(dx<wx0-160||dx>wx1+160||dy<wy0-160||dy>wy1+160) continue;
        const [bx,by]=m.worldPos(b.node);
        // Schwerpunkt zwischen Tor und Hauswand: der Platz reicht bis unter
        // die Schwelle, läuft aber nicht hinter dem Haus in die Wiese aus
        const cx=dx+(bx-dx)*0.34, cy=dy+((by+6)-dy)*0.34;
        const rw= b.type==='hq'? 56 : def.size==='M'? 38 : 31;
        const sp=this.plazaSprite(pl, rw*2);
        if(!sp) continue;
        g.save();
        g.globalAlpha=0.86;
        g.translate(cx, cy);
        g.scale(1, 0.52);                   // in die Bodenebene gekippt
        g.drawImage(sp, -rw, -rw, rw*2, rw*2);
        g.restore();
      }
    }
    // ---------- Wegenetz ----------
    // Zwei Dinge muessen zusammenkommen, die sich bisher gegenseitig kaputt
    // gemacht haben: die KACHELN (Steinreihen in Wegrichtung, Kurven,
    // Kreuzungen) und ein SAUBERER RAND ohne Stossnaehte.
    //
    // Der Trick ist die Trennung von Silhouette und Textur:
    //   1. Die Aussenform kommt aus EINEM zusammenhaengenden Band - je
    //      Abschnitt ein Rechteck, an jedem Knoten ein Kreis, alles als
    //      eine einzige Flaeche gefuellt. Eine Naht kann darin gar nicht
    //      entstehen, weil es nur eine Kante gibt.
    //   2. In dieses Band hinein kommen die Kacheln, jede in die
    //      tatsaechliche Richtung ihres Abschnitts gedreht. Innerhalb des
    //      Bandes ist jede Kachel deckend - zwei Kacheln duerfen sich also
    //      ueberlagern, ohne dass sich halbdurchsichtige Raender addieren.
    //      Die ausgefransten Kachelraender liegen ausserhalb und fallen weg.
    const tStr=this.asset('road_str');
    if(tStr){
      const tDirt=this.asset('road_dirt')||tStr, tSlope=this.asset('road_slope')||tStr;
      // Zielgroesse auf dem Schirm – danach richtet sich der Kachel-Vorrat
      const zpx=(w2)=> w2*cam.z*(this.dpr||1);
      const BAND=TILE*0.30, half=BAND/2;
      // Die Vorlage ist auf eine ganze Gitterzelle ausgelegt: ihr Wegband
      // fuellt gut die halbe Kachel. Zeichnet man die Kachel nur so gross
      // wie das Band, schrumpfen die Steine zu Kies. Deshalb wird sie
      // deutlich groesser gezeichnet und nur ihr mittlerer Streifen benutzt
      // - die Steine behalten damit fast ihre gedachte Groesse.
      const bw=BAND/0.36;
      const band=new Path2D();
      const wege=[];
      const links=new Map();               // Knoten -> Richtungen der Anschluesse
      // Torstummel: das Stueck von der Tuerfahne bis an die Schwelle. Es lag
      // frueher als duenner Faden neben der Strasse - eine 16 Pixel breite
      // Fahrbahn endete an der Fahne, und weiter ging es mit fuenf Pixeln.
      // Genau das sah nicht "aus einem Guss" aus. Jetzt ist es ein Abschnitt
      // wie jeder andere: gleiche Breite, gleiche Kacheln, gleiche Form.
      const stummel=[];
      for(const b of game.buildings.values()){
        if(b.door==null || b.door<0 || !m.flag[b.door]) continue;
        // Die Burg betritt man ueber die Zugbruecke; Pflaster darueber saehe
        // aus wie ein Weg im Wassergraben
        if(b.type==='hq' && this.asset('bld_hq')) continue;
        const [bx,by]=m.worldPos(b.node);
        if(bx<wx0-120||bx>wx1+120||by<wy0-120||by>wy1+120) continue;
        const [fx3,fy3]=this.doorVisualPos(b.door);
        const sw=[bx+(fx3-bx)*0.20, by+7];          // Schwelle am Hausfuss
        if(Math.hypot(sw[0]-fx3, sw[1]-fy3)<2) continue;
        stummel.push({a:[fx3,fy3], b:sw, nd:b.door});
      }
      for(const r of game.roads.values()){
        if(r.isSea) continue;
        const pts=this.roadPts(r);
        if(pts.length<2) continue;
        let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
        for(const q of pts){ if(q[0]<x0)x0=q[0]; if(q[0]>x1)x1=q[0]; if(q[1]<y0)y0=q[1]; if(q[1]>y1)y1=q[1]; }
        if(x1<wx0-60||x0>wx1+60||y1<wy0-60||y0>wy1+60) continue;
        wege.push({r,pts});
        for(let k=0;k<pts.length-1;k++){
          const [ax,ay]=pts[k], [bx,by]=pts[k+1];
          const dx=bx-ax, dy=by-ay, L2=Math.hypot(dx,dy)||1;
          const nx=-dy/L2*half, ny=dx/L2*half;
          // Umlaufsinn wie beim Kreis, sonst loeschen sich Rechteck und
          // Kreis bei der Nonzero-Fuellung gegenseitig aus
          band.moveTo(ax-nx,ay-ny); band.lineTo(bx-nx,by-ny);
          band.lineTo(bx+nx,by+ny); band.lineTo(ax+nx,ay+ny); band.closePath();
        }
        for(const [px2,py2] of pts){ band.moveTo(px2+half,py2); band.arc(px2,py2,half,0,6.2832); }
        // Anschlussrichtungen je Knoten sammeln (fuer die Kreuzungskacheln)
        for(let k=0;k<r.path.length;k++){
          const nd=r.path[k];
          let arr=links.get(nd);
          if(!arr){ arr=[]; links.set(nd,arr); }
          const [nx2,ny2]=this.doorVisualPos(nd);
          for(const nb of [r.path[k-1], r.path[k+1]]){
            if(nb===undefined) continue;
            const [qx,qy]=this.doorVisualPos(nb);
            const a3=Math.atan2(qy-ny2, qx-nx2);
            if(!arr.some(v=>{ let d=Math.abs(v-a3); if(d>Math.PI) d=Math.PI*2-d; return d<0.3; })) arr.push(a3);
          }
        }
      }
      for(const st of stummel){
        const dx=st.b[0]-st.a[0], dy=st.b[1]-st.a[1], L2=Math.hypot(dx,dy)||1;
        const nx=-dy/L2*half, ny=dx/L2*half;
        band.moveTo(st.a[0]-nx,st.a[1]-ny); band.lineTo(st.b[0]-nx,st.b[1]-ny);
        band.lineTo(st.b[0]+nx,st.b[1]+ny); band.lineTo(st.a[0]+nx,st.a[1]+ny); band.closePath();
        band.moveTo(st.b[0]+half,st.b[1]); band.arc(st.b[0],st.b[1],half,0,6.2832);
      }
      if(wege.length || stummel.length){
        // ausgetretener Erdsaum UNTER dem Band: er allein macht den
        // Uebergang zur Wiese weich, das Band selbst hat eine klare Kante
        g.save();
        g.lineJoin='round'; g.lineCap='round';
        const saum=new Path2D();
        for(const {pts} of wege){
          saum.moveTo(pts[0][0],pts[0][1]);
          for(let k=1;k<pts.length;k++) saum.lineTo(pts[k][0],pts[k][1]);
        }
        for(const st of stummel){ saum.moveTo(st.a[0],st.a[1]); saum.lineTo(st.b[0],st.b[1]); }
        g.strokeStyle='rgba(112,92,60,0.16)'; g.lineWidth=BAND+13; g.stroke(saum);
        g.strokeStyle='rgba(112,92,60,0.20)'; g.lineWidth=BAND+6;  g.stroke(saum);
        g.restore();
        // ---- Kacheln im Band ----
        g.save();
        g.clip(band);
        // Schnittkante zwischen zwei Abschnitten: die Winkelhalbierende.
        // Ohne sie ueberschreibt der naechste Abschnitt den vorigen mit
        // einer beliebigen Querkante quer durchs Pflaster - das war der
        // harte Bruch am Knick. Mit ihr stossen die beiden Steinmuster
        // aneinander wie eine Gehrung in einer echten Pflasterung.
        const schnitt=(p1,d1,q1,e1)=>{
          const den=d1[0]*e1[1]-d1[1]*e1[0];
          if(Math.abs(den)<1e-6) return [q1[0],q1[1]];
          const t=((q1[0]-p1[0])*e1[1]-(q1[1]-p1[1])*e1[0])/den;
          return [p1[0]+d1[0]*t, p1[1]+d1[1]*t];
        };
        // Wie stark ist ein Weg zu Pflaster festgetreten? Das war bisher eine
        // harte Schwelle: eine Strasse kippte bei 14 Warengaengen komplett um,
        // die Nachbarstrasse blieb Trampelpfad - daher das zusammengewuerfelte
        // Bild. Jetzt ist das Pflaster eine ABNUTZUNGSSCHICHT ueber dem Pfad,
        // deren Deckkraft mit dem Verkehr waechst. Der Uebergang ist damit
        // fliessend statt sprunghaft.
        // Eine Strasse ist eine Einheit von Fahne zu Fahne: der Belag gilt
        // fuer ihre ganze Laenge. Kein Verlauf entlang des Weges - sonst
        // waere ein Stueck nur deshalb gepflastert, weil dort zufaellig ein
        // Traeger oefter hin und her gelaufen ist.
        const pflast=(r)=> r.hasDonkey? 1 : Math.max(0, Math.min(1, ((r.traffic||0)-6)/26));
        // Fuer die Knotenkacheln: wie ausgefahren ist es an dieser Fahne?
        const knotenP=new Map();
        for(const {r} of wege) for(const nd of [r.path[0], r.path[r.path.length-1]])
          knotenP.set(nd, Math.max(knotenP.get(nd)||0, pflast(r)));
        for(const {r,pts} of wege){
          const deck=pflast(r);
          const N=pts.length;
          const dirs=[];
          for(let k=0;k<N-1;k++){
            const dx=pts[k+1][0]-pts[k][0], dy=pts[k+1][1]-pts[k][1], L2=Math.hypot(dx,dy)||1;
            dirs.push([dx/L2,dy/L2,L2]);
          }
          // mittlere Richtung an jedem Knoten = Normale der Schnittlinie
          const norm=[];
          for(let k=0;k<N;k++){
            const a=dirs[k-1], b2=dirs[k];
            if(!a) norm.push([b2[0],b2[1]]);
            else if(!b2) norm.push([a[0],a[1]]);
            else { const sx=a[0]+b2[0], sy=a[1]+b2[1], L3=Math.hypot(sx,sy)||1; norm.push([sx/L3,sy/L3]); }
          }
          let phase=0;
          for(let k=0;k<N-1;k++){
            const [ux,uy,L2]=dirs[k];
            const steil=Math.abs(m.hgt[r.path[k]]-m.hgt[r.path[k+1]])>0.45;
            const img=steil? tSlope : tDirt;
            // An den beiden Enden eines Weges ueber den Knoten hinausziehen:
            // dort stoesst ein anderer Weg an, und ohne Ueberstand klaffte
            // im Band eine Luecke, durch die das Gras schiene.
            const e0=(k===0)? BAND*0.9 : 0, eN=(k===N-2)? BAND*0.9 : 0;
            const A=[pts[k][0]-ux*e0,   pts[k][1]-uy*e0];
            const B=[pts[k+1][0]+ux*eN, pts[k+1][1]+uy*eN];
            const px3=-uy, py3=ux, H=BAND*1.4;             // seitlich reichlich
            const n0=norm[k], n1=norm[k+1];
            const m0=[-n0[1],n0[0]], m1=[-n1[1],n1[0]];    // Richtung der Schnittlinien
            const lp=[A[0]+px3*H, A[1]+py3*H], lm=[A[0]-px3*H, A[1]-py3*H];
            const d1=[ux,uy];
            const c1=schnitt(lp,d1,A,m0), c2=schnitt(lp,d1,B,m1);
            const c3=schnitt(lm,d1,B,m1), c4=schnitt(lm,d1,A,m0);
            g.save();
            g.beginPath();
            g.moveTo(c1[0],c1[1]); g.lineTo(c2[0],c2[1]);
            g.lineTo(c3[0],c3[1]); g.lineTo(c4[0],c4[1]);
            g.closePath();
            g.clip();
            g.translate(pts[k][0],pts[k][1]);
            g.rotate(Math.atan2(uy,ux)-Math.PI/2);   // lokales +y laeuft den Weg entlang
            // Kacheln stossen genau aneinander (die Vorlage ist in
            // Laengsrichtung kachelbar) und laufen ueber Abschnittsgrenzen
            // hinweg durch - deshalb die fortlaufende Phase
            const off=-(phase%bw);
            const kBasis=this.roadKachel(img, steil?'slope':'dirt', zpx(bw));
            for(let yy=off-bw; yy<L2+bw*1.6; yy+=bw) g.drawImage(kBasis, -bw/2, yy, bw, bw);
            // Pflaster als zweite Lage darueber. Weil der Pfad darunter
            // deckend ist, darf diese Lage halbdurchsichtig sein - dann
            // schaut zwischen den Steinen noch Erde durch, wie bei einem
            // halb ausgefahrenen Weg.
            if(!steil && deck>0.01){
              g.globalAlpha=deck;
              const kPfl=this.roadKachel(tStr,'str',zpx(bw));
              for(let yy=off-bw; yy<L2+bw*1.6; yy+=bw) g.drawImage(kPfl, -bw/2, yy, bw, bw);
              g.globalAlpha=1;
            }
            g.restore();
            phase+=L2;
          }
        }
        // Torstummel bekommen dieselben Kacheln wie die Strasse, die an
        // dieser Fahne ankommt - dadurch laeuft der Belag ohne Bruch bis an
        // die Schwelle.
        for(const st of stummel){
          const dx=st.b[0]-st.a[0], dy=st.b[1]-st.a[1], L2=Math.hypot(dx,dy)||1;
          const deck=knotenP.get(st.nd)||0;
          g.save();
          g.translate(st.a[0],st.a[1]);
          g.rotate(Math.atan2(dy,dx)-Math.PI/2);
          const kD=this.roadKachel(tDirt,'dirt',zpx(bw));
          for(let yy=-bw*0.6; yy<L2+bw; yy+=bw) g.drawImage(kD, -bw/2, yy, bw, bw);
          if(deck>0.01){
            g.globalAlpha=deck;
            const kP=this.roadKachel(tStr,'str',zpx(bw));
            for(let yy=-bw*0.6; yy<L2+bw; yy+=bw) g.drawImage(kP, -bw/2, yy, bw, bw);
            g.globalAlpha=1;
          }
          g.restore();
        }
        // ---- Knotenkacheln darueber ----
        // An einem Knick stossen zwei Steinmuster hart aneinander. Genau
        // dafuer gibt es die Kurven- und Kreuzungskacheln: sie decken die
        // Stossstelle mit einem Muster ab, das um die Ecke laeuft.
        const kEnd=this.asset('road_end'), kCur=this.asset('road_cur'),
              kY=this.asset('road_y'), kX=this.asset('road_x');
        const js=bw*1.3;
        // Knoten, an denen mehrere Wege zusammenstossen
        const zaehl=new Map();
        for(const {r} of wege) for(const nd of [r.path[0], r.path[r.path.length-1]])
          zaehl.set(nd,(zaehl.get(nd)||0)+1);
        const doppel=new Set([...zaehl].filter(e=>e[1]>1).map(e=>e[0]));
        for(const [nd,arr] of links){
          if(!arr.length) continue;
          const [nx2,ny2]=this.doorVisualPos(nd);
          if(nx2<wx0-60||nx2>wx1+60||ny2<wy0-60||ny2>wy1+60) continue;
          let img=null, rot=0, kind='';
          if(arr.length===1){ img=kEnd; rot=arr[0]-Math.PI/2; }   // Stummel zeigt zum Nachbarn
          else if(arr.length===2){
            // Durchgangsknoten braucht keine eigene Kachel: dort sorgt die
            // Gehrung schon fuer eine saubere Fuge. Nur wo zwei Wege
            // aufeinandertreffen (beide Enden, also je ein Anschluss aus
            // zwei verschiedenen Wegen), deckt die Kurvenkachel den Stoss ab.
            if(!doppel.has(nd)) continue;
            let d=arr[0]-arr[1];
            while(d> Math.PI) d-=Math.PI*2;
            while(d<-Math.PI) d+=Math.PI*2;
            if(Math.abs(Math.abs(d)-Math.PI)<0.35){ img=tStr; rot=arr[0]-Math.PI/2; }
            else {
              // Kurvenkachel: ihre Arme zeigen nach unten und nach rechts,
              // die Winkelhalbierende also nach unten rechts (45 Grad)
              img=kCur;
              rot=Math.atan2(Math.sin(arr[0])+Math.sin(arr[1]), Math.cos(arr[0])+Math.cos(arr[1]))-Math.PI/4;
            }
          }
          else {
            // Drei und mehr Arme: auf dem Sechseck-Gitter liegen die Arme
            // immer in den sechs Rasterrichtungen. Die gedrehten T-/Y-/X-
            // Kacheln treffen diese Winkel NIE (ihre Arme stehen auf 90
            // Grad) – ihre Sandfransen legten sich deshalb als heller
            // Schleier QUER uebers saubere Band: der "hingeklatschte" Fleck
            // an jedem Stoss. Die Sechswege-Nabe dagegen ist rasterfest
            // gezeichnet: unrotiert decken ihre Arme jede echte
            // Armrichtung exakt, und die Arme ohne Weg schneidet der
            // Band-Clip einfach weg.
            const hub=this.asset('road_hub');
            if(hub){ img=hub; rot=0; kind='hub'; }
            else if(arr.length===3){
              // Notnagel ohne Nabe: Y-Kachel, Stiel zum Gegenueber-Arm
              img=kY;
              let best=0, bw2=-9;
              for(let i=0;i<3;i++){
                let sx=0, sy=0;
                for(let j=0;j<3;j++) if(j!==i){ sx+=Math.cos(arr[j]); sy+=Math.sin(arr[j]); }
                const s=-(Math.cos(arr[i])*sx+Math.sin(arr[i])*sy);
                if(s>bw2){ bw2=s; best=i; }
              }
              rot=arr[best]-Math.PI/2;
            }
            else { img=kX; rot=arr[0]; }
          }
          if(!img) continue;
          g.save();
          // Die Knotenkacheln gibt es nur gepflastert. An einem wenig
          // benutzten Weg wird deshalb nur angedeutet, was an einem
          // ausgefahrenen voll durchkommt – ein Knotenpunkt tritt sich
          // ohnehin als Erstes fest.
          g.globalAlpha=0.35+0.65*(knotenP.get(nd)||0);
          g.translate(nx2,ny2);
          // Unterlage: ein gerades Wegstueck, auf den ersten Arm gedreht.
          // Die gedrehte Knotenkachel deckt die Knotenscheibe des Bandes nie
          // vollstaendig – zwischen ihren Armen und den ECHTEN Armrichtungen
          // blieb ein Zwickel, in dem der blanke Erdsaum durchschien (der
          // helle, musterlose Fleck an jedem Stoss). Die Unterlage fuellt
          // die Scheibe immer mit Steinmuster, die Knotenkachel legt danach
          // nur noch ihr Richtungsmuster darueber.
          g.save();
          g.rotate(arr[0]-Math.PI/2);
          g.drawImage(this.roadKachel(tStr,'kbase',zpx(js)), -js/2, -js/2, js, js);
          g.restore();
          g.rotate(rot);
          g.drawImage(this.roadKachel(img,'k'+arr.length+kind+(img===tStr?'s':''),zpx(js)), -js/2, -js/2, js, js);
          g.restore();
        }
        g.restore();
      }
    }
    // Straßen: sanft geschwungen und gepflastert
    for(const r of game.roads.values()){
      const pts=this.roadPts(r);
      const trace=()=>{
        g.beginPath();
        g.moveTo(pts[0][0],pts[0][1]);
        for(let k=1;k<pts.length-1;k++){
          const mx=(pts[k][0]+pts[k+1][0])/2, my=(pts[k][1]+pts[k+1][1])/2;
          g.quadraticCurveTo(pts[k][0],pts[k][1],mx,my);
        }
        g.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]);
      };
      // Seeweg: gestrichelte Route übers Wasser statt Pflaster
      if(r.isSea){
        g.save();
        g.setLineDash([7,9]);
        g.lineDashOffset=-this.time/140;
        trace(); g.strokeStyle='rgba(240,248,252,0.35)'; g.lineWidth=2.2; g.stroke();
        g.restore();
        continue;
      }
      // Belag und Kreuzungen liegen schon im Band (siehe oben). Hier
      // kommen nur noch die Zutaten je Weg dazu.
      if(tStr){
        const nodes=r.path;
        // Esel-Straße: doppelte Fahrspur andeuten
        if(r.hasDonkey){
          g.globalAlpha=0.22;
          for(let k=0;k<nodes.length-1;k++){
            const [ax,ay]=m.worldPos(nodes[k]), [bx,by]=m.worldPos(nodes[k+1]);
            g.strokeStyle='rgba(90,74,52,1)'; g.lineWidth=1.4;
            g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.stroke();
          }
          g.globalAlpha=1;
        }
        // Grasbüschel verzahnen die Ränder mit der Wiese
        if(cam.z>0.7 && this.theme!=='winter' && this.theme!=='wueste'){
          for(let k=0;k<pts.length-1;k++){
            const hsh=hash01(r.id*31+k*7);
            if(hsh<0.55) continue;
            const [x1,y1]=pts[k], [x2,y2]=pts[k+1];
            const dx=x2-x1, dy=y2-y1, L2=Math.hypot(dx,dy)||1;
            const t=0.25+hsh*0.5, side=(k%2?1:-1)*(11+hsh*3);
            const gx=x1+dx*t+(-dy/L2)*side, gy=y1+dy*t+(dx/L2)*side;
            g.strokeStyle= hsh>0.8?'rgba(88,120,54,0.5)':'rgba(112,140,66,0.42)';
            g.lineWidth=1.1;
            g.beginPath();
            g.moveTo(gx-1.5,gy+1); g.quadraticCurveTo(gx-1.3,gy-2.2,gx-0.5,gy-3);
            g.moveTo(gx,gy+1.2); g.quadraticCurveTo(gx+0.3,gy-2.6,gx+1.1,gy-3.4);
            g.stroke();
          }
        }
        continue;
      }
      trace(); g.strokeStyle='rgba(92,78,60,0.6)'; g.lineWidth=9.5; g.stroke();   // Bordkante
      trace(); g.strokeStyle='#b3a68c'; g.lineWidth=7; g.stroke();                // Pflasterbett
      // Pflastersteine entlang des Weges (zwei Farbtöne, versetzt)
      if(cam.z>0.55){
        const dark=new Path2D(), light=new Path2D();
        let acc=0, idx=0;
        for(let k=0;k<pts.length-1;k++){
          const dx=pts[k+1][0]-pts[k][0], dy=pts[k+1][1]-pts[k][1];
          const L=Math.hypot(dx,dy)||1;
          const ux=dx/L, uy=dy/L, vx=-uy, vy=ux;
          for(let d2=acc; d2<L; d2+=5.6, idx++){
            const cx3=pts[k][0]+ux*d2, cy3=pts[k][1]+uy*d2;
            const side=(idx%2? 1:-1)*1.75;
            const p=(idx%3===0)? dark:light;
            p.moveTo(cx3+vx*side+1.55, cy3+vy*side);
            p.arc(cx3+vx*side, cy3+vy*side, 1.55, 0, 7);
            p.moveTo(cx3-vx*side*0.4+1.3, cy3-vy*side*0.4);
            p.arc(cx3-vx*side*0.4, cy3-vy*side*0.4, 1.3, 0, 7);
          }
          acc=(acc-L)%5.6; if(acc<0) acc+=5.6;
        }
        g.fillStyle='rgba(122,106,86,0.55)'; g.fill(dark);
        g.fillStyle='rgba(199,186,164,0.6)'; g.fill(light);
      }
      // ausgetretene Wegmitte
      trace(); g.strokeStyle='rgba(94,80,62,0.22)'; g.lineWidth=2.6; g.stroke();
    }
    // Straßen-Vorschau
    if(ui.roadPreview && ui.roadPreview.length>1){
      g.strokeStyle='rgba(255,244,170,0.95)'; g.lineWidth=4; g.setLineDash([8,7]);
      g.lineDashOffset=-this.time/60;
      g.beginPath();
      ui.roadPreview.forEach((n,ix)=>{ const [x,y]=m.worldPos(n); if(ix===0) g.moveTo(x,y); else g.lineTo(x,y); });
      g.stroke(); g.setLineDash([]); g.lineDashOffset=0;
    }
    // Objekte + Gebäude + Fahnen + Einheiten sammeln, nach y sortieren
    const items=[];
    const figs=[];                 // Figuren fürs gegenseitige Ausweichen
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const i=m.idx(x,y);
      const o=m.obj[i]&127;
      if(o!==OBJ.NONE) items.push({kind:'obj', i, o, y:m.worldPos(i)[1]});
      // Pässe: zwei Felsschultern rahmen die Sattelstelle
      else if(m.pass && m.pass[i] && m.bld[i]<0)
        items.push({kind:'pass', i, y:m.worldPos(i)[1]});
      // Felsnadeln und Blöcke brechen die waagerechte Terrassenstruktur auf
      // Felsnadeln ("spire") sind entfallen: einzeln aufgesetzte Klippen
      // wirkten wie Fremdkörper auf dem Facettenrelief. Das Gebirge bekommt
      // ein eigenes großes Grafik-Update.
      if(m.bld[i]>=0){ const b=game.buildings.get(m.bld[i]); if(b) items.push({kind:'bld', b, y:m.worldPos(i)[1]}); }
      if(m.flag[i]) items.push({kind:'flag', i, y:m.worldPos(i)[1]+2});
      if(game.signs && game.signs.has(i) && m.bld[i]<0) items.push({kind:'sign', i, ore:game.signs.get(i), y:m.worldPos(i)[1]+1});
    }
    for(const r of game.roads.values()){
      const c=r.carrier;
      // zwischen zwei Sim-Takten überblenden (flüssiger Lauf, siehe drawUnit)
      const al=this.game.lerpA? this.game.lerpA() : 1;
      const pos=this.roadPos(r, c._pp!==undefined? c._pp+(c.pos-c._pp)*al : c.pos);
      // Bewegungsrichtung aus der Bilddifferenz (fürs Spiegeln/Wippen der Figur)
      if(c._lx!==undefined){
        const ddx=pos[0]-c._lx, ddy=pos[1]-c._ly;
        if(Math.hypot(ddx,ddy)>0.05){
          // geglättet, damit die Blickrichtung in Kurven nicht flackert –
          // bei einer Kehrtwende aber SOFORT umdrehen, sonst läuft die Figur
          // nach dem Abladen ein Stück rückwärts
          const turn = c._dx!==undefined && (c._dx*ddx + c._dy*ddy) < 0;
          if(c._dx===undefined || turn){ c._dx=ddx; c._dy=ddy; }
          else { c._dx=c._dx*0.75+ddx*0.25; c._dy=c._dy*0.75+ddy*0.25; }
          c._movT=this.time+260;                 // Nachlauf über die Sim-Pause
        }
      }
      const mov=(c._movT||0)>this.time;
      c._lx=pos[0]; c._ly=pos[1];
      const cit={kind:r.isSea?'ship':'carrier', pl:r.player, x:pos[0], y:pos[1],
        carrying:!!c.item, good:c.item?.good,
        dir:c._dx!==undefined?[c._dx,c._dy]:null, mov, seed:r.id*2.7, road:r};
      items.push(cit);
      // Träger nehmen am Ausweichen teil (Schiffe nicht - breite See)
      if(!r.isSea) figs.push({o:c, it:cit, x:pos[0], y:pos[1], mov, dx:c._dx, dy:c._dy});
    }
    for(const u of game.units){
      if(u._lx!==undefined){
        const ddx=u.x-u._lx, ddy=u.y-u._ly;
        if(Math.hypot(ddx,ddy)>0.05){
          const turn = u._dx!==undefined && (u._dx*ddx + u._dy*ddy) < 0;
          if(u._dx===undefined || turn){ u._dx=ddx; u._dy=ddy; }
          else { u._dx=u._dx*0.75+ddx*0.25; u._dy=u._dy*0.75+ddy*0.25; }
          u._movT=this.time+260;                 // Nachlauf über die Sim-Pause
        }
      }
      u._mov=(u._movT||0)>this.time;
      u._lx=u.x; u._ly=u.y;
      items.push({kind:'unit', u, y:u.y});
      // alles außer Katapult-Geschossen weicht einander aus
      if(u.type!=='boulder') figs.push({o:u, it:null, x:u.x, y:u.y, mov:!!u._mov, dx:u._dx, dy:u._dy});
    }
    // Weiches gegenseitiges Ausweichen: rein OPTISCHER Versatz nach rechts,
    // wenn eine andere Figur dicht voraus ist. Die Sim-Positionen bleiben
    // unangetastet (Ankommen/Reichweiten kippen nicht); der Versatz wird
    // sanft ein- und ausgeblendet und NACH der Takt-Überblendung gezeichnet.
    this.dodgePass(figs, dtMs);
    for(const f of figs){
      if(!f.it) continue;                        // Einheiten versetzt drawUnit selbst
      f.it.x+=f.o._doX||0; f.it.y+=f.o._doY||0;
    }
    // Schafe & Schweine in die Tiefensortierung einreihen
    if(this.sheep) for(const sh of this.sheep) items.push({kind:'sheep', sh, y:sh.y+4});
    if(this.pigs) for(const herd of this.pigs.values()) for(const p of herd) items.push({kind:'pig', p, y:p.y+3});
    // Wild (Rehe, Hasen, Wildschweine) aus der Simulation
    if(game.animals) for(const a of game.animals) items.push({kind:'animal', a, y:a.y+3});
    // Kleintier-Deko: Falter und Singvögel reihen sich wie die Schafe ein
    // (figs liefert die Figurenplätze fürs Aufscheuchen der Vögel)
    this.sammleKleintiere(items, figs, m, x0, x1, y0, y1, cam);
    items.sort((a,b)=>a.y-b.y);
    for(const it of items){
      if(it.kind==='obj') this.drawObj(g, m, it.i, it.o);
      else if(it.kind==='pass') this.drawPass(g, m, it.i);
      else if(it.kind==='bld') this.drawBld(g, m, it.b);
      else if(it.kind==='sign') this.drawSign(g, m, it.i, it.ore);
      else if(it.kind==='flag') this.drawFlag(g, m, game, it.i);
      else if(it.kind==='ship') this.drawShip(g, it.x, it.y, it.pl, it.dir, it.carrying);
      else if(it.kind==='carrier'){
        this._animSeed=it.seed;
        this.drawFigure(g, it.x, it.y, it.pl, it.carrying? it.good:null, 'carrier', 0, null, null, it.dir, it.mov);
        // Esel trottet neben dem Träger der verstärkten Straße
        if(it.road && it.road.hasDonkey) this.drawDonkey(g, it.x-11, it.y+3, it.dir, it.mov);
      }
      else if(it.kind==='unit'){ this._animSeed=(it.u.id||0)*1.9; this.drawUnit(g, it.u); }
      else if(it.kind==='sheep') this.drawSheep(g, it.sh);
      else if(it.kind==='pig') this.drawPig(g, it.p);
      else if(it.kind==='animal') this.drawAnimal(g, it.a);
      else if(it.kind==='falter') this.zeichneFalter(g, it.f);
      else if(it.kind==='singvogel') this.zeichneSingvogel(g, it.v);
    }
    this.drawFx(g, game);
    // Wolkenschatten ziehen über das Land
    const cw=m.w*TILE, chh=m.h*ROWH;
    for(let k=0;k<4;k++){
      const spd=7+k*2.6;
      let cx2=((this.time/1000*spd + k*1637) % (cw+700)) - 350;
      const cy2=((k*911)%chh) + Math.sin(this.time/8000+k*2.1)*90;
      if(cx2+320<wx0||cx2-320>wx1||cy2+220<wy0||cy2-220>wy1) continue;
      const rad=g.createRadialGradient(cx2,cy2,20,cx2,cy2,230+k*40);
      rad.addColorStop(0,'rgba(25,35,25,0.11)');
      rad.addColorStop(0.7,'rgba(25,35,25,0.07)');
      rad.addColorStop(1,'rgba(25,35,25,0)');
      g.fillStyle=rad;
      g.save();
      g.translate(cx2,cy2); g.scale(1.5,0.85);
      g.beginPath(); g.arc(0,0,230+k*40,0,7);
      g.arc(150,60,150,0,7);
      g.fill();
      g.restore();
    }
    // ziehende Nebelschwaden (Morgennebel, sehr dezent)
    for(let k=0;k<3;k++){
      const mx=((this.time/1000*(3.5+k*1.2) + k*2311) % (cw+900)) - 450;
      const my=((k*1481)%chh) + Math.sin(this.time/7000+k*1.9)*70;
      if(mx+400<wx0||mx-400>wx1||my+200<wy0||my-200>wy1) continue;
      const rad=g.createRadialGradient(mx,my,30,mx,my,300);
      rad.addColorStop(0,'rgba(238,242,246,0.028)');
      rad.addColorStop(0.6,'rgba(238,242,246,0.015)');
      rad.addColorStop(1,'rgba(238,242,246,0)');
      g.fillStyle=rad;
      g.save(); g.translate(mx,my); g.scale(1.8,0.7);
      g.beginPath(); g.arc(0,0,300,0,7); g.fill();
      g.restore();
    }
    // ziehende Vogelscharen – über allem, aber unter der Bedienoberfläche
    this.zeichneZugvoegel(g, wx0, wx1, wy0, wy1, cam);
    // Schafe & Schweine: Positionen aktualisieren (gezeichnet tiefensortiert oben)
    this.updateSheep(dtMs);
    this.updatePigs(dtMs);
    // Auswahl-Marker
    if(ui.sel>=0){
      const [x,y]=m.worldPos(ui.sel);
      const r=15+Math.sin(this.time/180)*2;
      g.strokeStyle='rgba(20,26,18,0.5)'; g.lineWidth=4;
      g.beginPath(); g.arc(x,y,r,0,7); g.stroke();
      g.strokeStyle='rgba(255,255,255,0.95)'; g.lineWidth=2;
      g.beginPath(); g.arc(x,y,r,0,7); g.stroke();
      g.save();
      g.translate(x,y); g.rotate(this.time/600);
      g.strokeStyle='rgba(255,244,170,0.9)'; g.lineWidth=2.4;
      for(let k=0;k<4;k++){ g.rotate(Math.PI/2); g.beginPath(); g.arc(0,0,r+5,-0.28,0.28); g.stroke(); }
      g.restore();
    }
    // Baubarkeits-Punkte im Baumodus
    if(ui.showBuildDots){
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const i=m.idx(x,y);
        if(m.owner[i]!==0) continue;
        if(m.bld[i]>=0||m.flag[i]||(m.obj[i]&127)!==OBJ.NONE) continue;
        if(!m.terrOkBuild(i)&&!m.terrOkMine(i)) continue;
        // Netzbewusstsein (F1): Landstücke ohne möglichen Straßenanschluss
        // (Sandbank hinter dem Wasserarm) bekommen gar keine Punkte –
        // gecachte O(1)-Maske, kein A* pro Punkt pro Frame.
        if(!game.netLandOk(0,i)) continue;
        const [px,py]=m.worldPos(i);
        if(ui.placeType){
          // gewählter Gebäudetyp: nur gültige Plätze, grün markiert
          if(!game.canBuild(0, ui.placeType, i).ok) continue;
          const pulse=0.7+0.3*Math.sin(this.time/300+i);
          g.fillStyle='rgba(20,30,16,0.45)';
          g.beginPath(); g.arc(px,py+1,4,0,7); g.fill();
          g.fillStyle=`rgba(150,230,120,${0.85*pulse})`;
          g.beginPath(); g.arc(px,py,3.4,0,7); g.fill();
          continue;
        }
        const mine=m.terrOkMine(i);
        g.fillStyle='rgba(20,26,18,0.4)';
        g.beginPath(); g.arc(px,py+1,(mine?2.6:3.4),0,7); g.fill();
        g.fillStyle=mine?'rgba(255,190,90,0.85)':'rgba(255,255,255,0.85)';
        g.beginPath(); g.arc(px,py,(mine?2.2:3),0,7); g.fill();
      }
    }
    // halbtransparente Bau-Vorschau am gewählten Platz
    if(ui.placeType && ui.placeAt>=0){
      const [px,py]=m.worldPos(ui.placeAt);
      const def=BLD[ui.placeType];
      const ok=game.canBuild(0, ui.placeType, ui.placeAt).ok;
      // Bauplatz-Ring (pulsierend, grün = passt / rot = blockiert)
      const pulse=0.6+0.4*Math.sin(this.time/260);
      g.strokeStyle= ok? `rgba(150,230,120,${pulse})` : `rgba(230,110,90,${pulse})`;
      g.lineWidth=2.6;
      const rr2= def.size==='L'?34 : def.size==='M'?28 : 22;
      g.beginPath(); g.ellipse(px,py+2,rr2,rr2*0.42,0,0,7); g.stroke();
      const ov=this.asset('bld_'+ui.placeType);
      g.globalAlpha=0.55;
      if(ov){
        const legacy= ui.placeType==='hq'?118 : def.size==='L'?96 : def.size==='M'?80 : def.size==='MINE'?58 : 64;
        const hh=this.scaleOf('bld_'+ui.placeType, legacy);
        const ww=hh*(ov.naturalWidth/ov.naturalHeight);
        g.drawImage(ov, px-ww/2, py-hh+10, ww, hh);
      } else {
        const s=this.bldSprite(ui.placeType, 0, 'done');
        g.drawImage(s.cv, px-s.w/2, py-s.h+10, s.w, s.h);
      }
      g.globalAlpha=1;
      // Name unter dem durchsichtigen Haus und zwei Knöpfe direkt daneben.
      // Ein Dialog am unteren Rand hatte den Platz verdeckt, um den es
      // gerade ging – und drei Zeilen Text für eine Ja/Nein-Frage.
      // Alle Maße in Bildschirmpunkten, deshalb durch den Zoom geteilt.
      const u=1/Math.max(0.25, cam.z);
      const ty=py+15*u;
      this.uiSchild(g, px, ty, u, def.name, ok);
      const R=21*u, by2=ty+10*u+R+7*u, sp=30*u;
      if(ok){
        this.uiKnopf(g, px-sp, by2, u, 'ok');
        this.uiKnopf(g, px+sp, by2, u, 'no');
        this._placeBtn={ ok:[px-sp,by2], no:[px+sp,by2], r:R*1.25 };
      } else {
        this.uiKnopf(g, px, by2, u, 'no');
        this._placeBtn={ ok:null, no:[px,by2], r:R*1.25 };
      }
    } else this._placeBtn=null;
    // Wegebau: Schild "Weg bauen" samt Haken/Kreuz schwebt an der aktuellen
    // Fahne - dieselbe Bedienung wie beim Bau-Bestätigen. Haken = automatisch
    // ans Netz verbinden, Kreuz = abbrechen, Tippen auf Fahne oder Weg
    // verbindet dorthin.
    if(ui.roadPreview && ui.roadAnchor>=0){
      const [ax,ay]=this.doorVisualPos(ui.roadAnchor);
      const u=1/Math.max(0.25, cam.z);
      const n=ui.roadPreview.length-1;
      const ty=ay+26*u;
      this.uiSchild(g, ax, ty, u, n>0? `Weg bauen · ${n} Stück` : 'Weg bauen', true);
      const R=21*u, by2=ty+10*u+R+7*u, sp=30*u;
      this.uiKnopf(g, ax-sp, by2, u, 'ok');
      this.uiKnopf(g, ax+sp, by2, u, 'no');
      this._roadBtn={ ok:[ax-sp,by2], no:[ax+sp,by2], r:R*1.25 };
    } else this._roadBtn=null;
    // Fahnenmenü: drei schwebende Knöpfe an der angetippten Fahne
    // (Weg bauen / Geologe / Späher) statt des schwarzen Menüs am Rand.
    if(ui.flagSel>=0 && m.flag[ui.flagSel]){
      const [fx,fy]=this.doorVisualPos(ui.flagSel);
      const u=1/Math.max(0.25, cam.z);
      const R=21*u, by2=fy+16*u+R, sp=50*u;
      this.uiRundKnopf(g, fx-sp, by2, u, 'weg', true);
      this.uiRundKnopf(g, fx,    by2, u, 'geo', ui.flagGeoOk);
      this.uiRundKnopf(g, fx+sp, by2, u, 'spaeher', true);
      g.save();
      g.font=`600 ${Math.round(9.5*u*10)/10}px Georgia, serif`;
      g.textAlign='center'; g.textBaseline='top';
      g.lineWidth=3*u; g.strokeStyle='rgba(22,17,9,0.72)'; g.lineJoin='round';
      g.fillStyle='#f4e6c4';
      const ly=by2+R+3*u;
      for(const [tx,tt] of [[fx-sp,'Weg'],[fx,'Geologe'],[fx+sp,'Späher']]){
        g.strokeText(tt,tx,ly); g.fillText(tt,tx,ly);
      }
      g.restore();
      this._flagBtn={ weg:[fx-sp,by2], geo:[fx,by2], sp:[fx+sp,by2], r:R*1.25 };
    } else this._flagBtn=null;
    // Nebel des Unbekannten: Dunstsaum + dunkler Kern, leicht treibend
    if(this.time-this._fogT>600){ this._fogT=this.time; this.rebuildFog(); }
    if(this.fogDark){
      const fx=-TILE*0.5, fy=-ROWH*0.5;
      const fw=m.w*TILE, fh=m.h*ROWH;
      const drift=Math.sin(this.time/2600)*7;
      const drift2=Math.cos(this.time/3400)*5;
      g.globalAlpha=0.34; g.drawImage(this.fogMist, fx+drift, fy+drift2*0.5, fw, fh);
      g.globalAlpha=0.38; g.drawImage(this.fogMist, fx-drift2, fy-drift*0.4, fw, fh);
      // gemalte Schwaden entlang der Grenze zum Unerforschten
      const fimg=this.asset('fx_fog');
      if(fimg && this.borderFog){
        const fh2=64, fw2=fh2*(fimg.naturalWidth/fimg.naturalHeight);
        for(const p of this.borderFog){
          if(p.x<wx0-90||p.x>wx1+90||p.y<wy0-70||p.y>wy1+70) continue;
          const ph=this.time/2400+p.s;
          g.globalAlpha=0.42+0.18*Math.sin(ph);
          g.drawImage(fimg, p.x-fw2/2+Math.sin(ph)*9, p.y-fh2*0.6, fw2, fh2);
        }
        g.globalAlpha=1;
      }
      g.globalAlpha=0.55; g.drawImage(this.fogDark, fx+drift*0.3, fy, fw, fh);
      g.globalAlpha=0.85; g.drawImage(this.fogDark, fx, fy, fw, fh);
      if(this.fogCore){ g.globalAlpha=0.95; g.drawImage(this.fogCore, fx, fy, fw, fh); }
      g.globalAlpha=1;
    }
    g.restore();
    // goldene Stunde: warmes Streiflicht von Nordwest, kühle Schatten im Südosten
    const sun=g.createLinearGradient(0,0,this.vw,this.vh);
    sun.addColorStop(0,'rgba(255,206,140,0.12)');
    sun.addColorStop(0.55,'rgba(255,206,140,0.02)');
    sun.addColorStop(1,'rgba(38,52,92,0.1)');
    g.fillStyle=sun;
    g.fillRect(0,0,this.vw,this.vh);
    // warmer Gesamtfarbton (painterly, keine Sterilität)
    g.globalCompositeOperation='soft-light';
    g.fillStyle='rgba(255,190,120,0.16)';
    g.fillRect(0,0,this.vw,this.vh);
    g.globalCompositeOperation='source-over';
    // Tilt-Shift: weiche Unschärfebänder oben/unten -> Diorama-Gefühl.
    // Ohne ctx.filter (siehe blurInto: WebKit-Falschmeldung G2). SCHNELL:
    // EIN kleiner Schnappschuss der beiden Randbänder je Frame (bilinear,
    // keine High-Quality-Filterung – das kostete pro Band einen teuren
    // Lese-/Resampling-Pass und verdoppelte die Frametime; auf iOS lief
    // dieser Pfad schon immer) und daraus zwei Vergrößerungs-Züge je Band.
    {
      const dpr=this.dpr, band=Math.round(this.vh*0.14);
      const b2=Math.round(band*0.55);
      const K=4;                                  // Verkleinerungsfaktor
      const sw2=Math.max(1,Math.round(this.vw/K));
      const shTop=Math.max(1,Math.round((band+b2)/K));
      if(!this._tsTmp) this._tsTmp=document.createElement('canvas');
      const t=this._tsTmp;
      if(t.width!==sw2||t.height!==shTop*2){ t.width=sw2; t.height=shTop*2; }
      const tg2=t.getContext('2d');
      tg2.globalCompositeOperation='copy';
      // oberes und unteres Band in EINEM kleinen Canvas (bilinear)
      tg2.drawImage(this.cv, 0,0,this.cv.width,(band+b2)*dpr, 0,0,sw2,shTop);
      tg2.globalCompositeOperation='source-over';
      tg2.drawImage(this.cv, 0,this.cv.height-(band+b2)*dpr,this.cv.width,(band+b2)*dpr,
                    0,shTop,sw2,shTop);
      const fTop=shTop/(band+b2);                 // Kleinbild-px je Bild-px
      // starkes Band aussen, halbstarkes innen (wie zuvor 2.4/1.2)
      g.globalAlpha=1;
      g.drawImage(t, 0,0,sw2,band*fTop, 0,0,this.vw,band);
      g.globalAlpha=0.55;
      g.drawImage(t, 0,band*fTop,sw2,b2*fTop, 0,band,this.vw,b2);
      g.globalAlpha=1;
      g.drawImage(t, 0,shTop+b2*fTop,sw2,band*fTop, 0,this.vh-band,this.vw,band);
      g.globalAlpha=0.55;
      g.drawImage(t, 0,shTop,sw2,b2*fTop, 0,this.vh-band-b2,this.vw,b2);
      g.globalAlpha=1;
    }
    // Kartenrand: außerhalb der Karte liegt kein Nichts, sondern ein
    // dunkler Saum, der weich zur Bildkante hin ausläuft. Vorher brach die
    // Karte hart ab und darunter stand schwarze Fläche.
    {
      const m2=this.game.map;
      const L=(0-cam.x)*cam.z+this.vw/2, R=(m2.w*TILE-cam.x)*cam.z+this.vw/2;
      const T=(0-cam.y)*cam.z+this.vh/2, B=(m2.h*ROWH-cam.y)*cam.z+this.vh/2;
      const F=Math.max(26, 78*cam.z);          // Breite des Saums
      const band=(x0b,y0b,wb,hb,gx0,gy0,gx1,gy1)=>{
        if(wb<=0||hb<=0) return;
        const gr=g.createLinearGradient(gx0,gy0,gx1,gy1);
        gr.addColorStop(0,'rgba(8,12,18,0)');
        gr.addColorStop(0.55,'rgba(8,12,18,0.65)');
        gr.addColorStop(1,'rgba(8,12,18,0.96)');
        g.fillStyle=gr; g.fillRect(x0b,y0b,wb,hb);
      };
      // Saum nach außen, dahinter volle Deckung
      band(L-F,0,F,this.vh, L,0,L-F,0);
      band(R,0,F,this.vh, R,0,R+F,0);
      band(0,T-F,this.vw,F, 0,T,0,T-F);
      band(0,B,this.vw,F, 0,B,0,B+F);
      g.fillStyle='rgba(8,12,18,0.96)';
      if(L-F>0) g.fillRect(0,0,L-F,this.vh);
      if(R+F<this.vw) g.fillRect(R+F,0,this.vw-(R+F),this.vh);
      if(T-F>0) g.fillRect(0,0,this.vw,T-F);
      if(B+F<this.vh) g.fillRect(0,B+F,this.vw,this.vh-(B+F));
    }
    // Vignette (Bildschirmraum)
    if(this.vignette) g.drawImage(this.vignette,0,0);
  }
  // Türfahnen werden optisch an den Gebäudeeingang gerückt
  doorVisualPos(i){
    const m=this.game.map;
    const [fx,fy]=m.worldPos(i);
    const b=this._doorMap && this._doorMap.get(i);
    if(!b) return [fx,fy];
    let [bx,by]=m.worldPos(b.node);
    // Der Eingang liegt nicht bei jedem Bild mittig. Die Hauptburg betritt man
    // über die Zugbrücke links vorn – die Wegfahne (und damit das Ende der
    // Straße) muss genau dort stehen, sonst endet das Pflaster im Wassergraben.
    if(b.type==='hq'){
      const img=this.asset('bld_hq');
      if(img){
        const hh=this.scaleOf('bld_hq',118);
        const ww=hh*(img.naturalWidth/img.naturalHeight);
        // Bildanteil des äußeren Brückenkopfes (aus der Grafik ausgemessen)
        const BX=0.155, BY=0.895;
        // Gebäude wird bei (bx-ww/2, by-hh+10) gezeichnet
        const px=bx-ww/2+BX*ww, py=by-hh+10+BY*hh;
        // ein Stück in Richtung Knoten versetzt, damit die Fahne vor der
        // Brücke steht statt darauf
        return [px+(fx-px)*0.14, py+4+(fy-py)*0.14];
      }
      bx-=8; by+=4;
    }
    const k=0.46;
    return [fx+(bx-fx)*k, fy+((by+8)-fy)*k];
  }
  // Straßenpunkte mit dezentem Versatz (Enden/Fahnen bleiben exakt,
  // Türfahnen-Enden ziehen bis vor den Gebäudeeingang)
  roadPts(r){
    const m=this.game.map;
    return r.path.map((n,ix)=>{
      if(ix===0 || ix===r.path.length-1) return this.doorVisualPos(n);
      const [x,y]=m.worldPos(n);
      if(m.flag[n]) return [x,y];
      return [x+(hash01(n*3+1)-0.5)*6, y+(hash01(n*5+2)-0.5)*5];
    });
  }
  roadPos(r, pos){
    const pts=this.roadPts(r);
    const i0=Math.max(0,Math.min(pts.length-1,Math.floor(pos))), f=pos-Math.floor(pos);
    const a=pts[i0], b=pts[Math.min(i0+1,pts.length-1)];
    return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f];
  }
  drawObj(g, m, i, o){
    const [x,y]=m.worldPos(i);
    switch(o){
      case OBJ.SAPLING: case OBJ.TREE2: case OBJ.TREE: {
        const st=o===OBJ.SAPLING?1:o===OBJ.TREE2?2:3;
        const hsh=hash01(i);
        const sc=0.85+hash01(i*7+1)*0.3;
        // Baumarten je Landschaft; Setzlinge und Jungbäume haben eigene Bilder
        const treeKey=this.treeKindOf(m,i,st,hsh);
        const species=treeKey==='tree_conifer'||treeKey==='tree_spruce'?0:1;
        const ovT=this.tintedTree(treeKey);
        // Jungbaum ist deutlich kleiner als der ausgewachsene Stamm, der
        // Setzling bringt seine eigene (kleine) Grafik mit
        const grow=(treeKey==='tree_sapling')?1:(st===3?1:st===2?0.52:0.34);
        const s=ovT?null:this.treeSprite(st,this.theme,species);
        const h=this.scaleOf(treeKey,74)*sc*(ovT?grow:1);
        const w=ovT? h*(ovT.width/ovT.height) : 56*sc;
        // kühler Wiesenschatten unter der Krone statt grauem Fleck
        const shR=20*sc*(st/3)+7;
        const gr2=g.createRadialGradient(x+3*sc,y+2,2, x+3*sc,y+2, shR);
        gr2.addColorStop(0,'rgba(28,44,20,0.3)');
        gr2.addColorStop(0.7,'rgba(28,44,20,0.15)');
        gr2.addColorStop(1,'rgba(28,44,20,0)');
        g.fillStyle=gr2;
        g.beginPath(); g.ellipse(x+3*sc,y+2, shR, shR*0.38, 0,0,7); g.fill();
        // gerichteter Kernschatten (goldene Stunde, nach Südost)
        this.shadow(g,x+9*sc,y+3, 13*sc*(st/3), 3.6*sc, 0.14);
        // Wind: Krone schwingt (Scherung, Fußpunkt bleibt fest)
        // Wind bewegt nur die Blätter – der Stamm bleibt fest verwurzelt
        const sway=Math.sin(this.time/1150 + i*0.73)*0.055 + Math.sin(this.time/451 + i*1.7)*0.014;
        const img2=ovT||s.cv;
        const trunkY=h*0.36;                       // unteres Drittel = Stamm
        g.save();
        g.translate(x, y+4);
        g.drawImage(img2, 0, img2.height*(1-0.36), img2.width, img2.height*0.36,
                    -w/2, -trunkY, w, trunkY);     // Stamm: unbewegt
        g.restore();
        g.save();
        g.translate(x, y+4-trunkY);
        g.transform(1,0,sway,1,0,0);
        g.drawImage(img2, 0, 0, img2.width, img2.height*(1-0.36),
                    -w/2, -(h-trunkY), w, h-trunkY);   // Krone: schwingt
        g.restore();
        // Grasbüschel am Stammfuß: der Baum steht IM Gras, nicht darauf
        if(this.theme!=='winter' && this.theme!=='wueste'){
          for(let k2=0;k2<4;k2++){
            const hx2=x+(hash01(i*13+k2)-0.5)*13*sc, hy2=y+3.4+(hash01(i*29+k2)-0.5)*3.4;
            g.strokeStyle=k2%2?'rgba(92,124,56,0.7)':'rgba(116,144,66,0.65)';
            g.lineWidth=1.2;
            g.beginPath();
            g.moveTo(hx2-1.4,hy2+1); g.quadraticCurveTo(hx2-1.2,hy2-2.6,hx2-0.4,hy2-3.6);
            g.moveTo(hx2,hy2+1); g.quadraticCurveTo(hx2+0.3,hy2-3,hx2+1.1,hy2-4);
            g.stroke();
          }
        }
        break;
      }
      case OBJ.STONE: {
        this.shadow(g,x,y+2,14,4.6,0.22);
        const ovO=this.asset('obj_stone');
        if(ovO){
          const hh=34, ww=hh*(ovO.naturalWidth/ovO.naturalHeight);
          g.drawImage(ovO, x-ww/2, y+8-hh, ww, hh);
          break;
        }
        const rock=(rx,ry,rr,c)=>{
          g.fillStyle=c;
          g.beginPath();
          g.moveTo(rx-rr,ry);
          g.lineTo(rx-rr*0.5,ry-rr*0.9);
          g.lineTo(rx+rr*0.55,ry-rr*0.85);
          g.lineTo(rx+rr,ry);
          g.lineTo(rx+rr*0.5,ry+rr*0.5);
          g.lineTo(rx-rr*0.5,ry+rr*0.5);
          g.closePath(); g.fill();
          g.strokeStyle='rgba(50,46,40,0.5)'; g.lineWidth=1.2; g.stroke();
        };
        rock(x-6,y-3,8,'#8b867c');
        rock(x+5,y-1,9.5,'#9a958b');
        rock(x-1,y-10,6,'#a5a096');
        g.fillStyle='rgba(255,255,255,0.25)';
        g.beginPath(); g.moveTo(x+1,y-8); g.lineTo(x+6,y-9); g.lineTo(x+9,y-4); g.closePath(); g.fill();
        break;
      }
      case OBJ.FIELD0: case OBJ.FIELD1: case OBJ.FIELD2:
        // Äcker werden nicht mehr Knoten für Knoten als Kästchen gezeichnet,
        // sondern weiter oben je Fläche am Stück (siehe "Getreideäcker").
        // Die Beet-Bilder obj_field0..2 zeigen ein Hochbeet mit Rand – als
        // Getreidefeld aneinandergereiht sah das aus wie ein Gemüsegarten.
        break;
      case OBJ.RUIN: {
        // verkohlte Brandruine: Aschehügel, geborstene Balken, Reststein
        this.shadow(g,x,y+2,15,4.6,0.2);
        const ovR=this.asset('obj_ruin');
        if(ovR){
          const hh=this.scaleOf('obj_ruin',30), ww=hh*(ovR.naturalWidth/ovR.naturalHeight);
          g.drawImage(ovR, x-ww/2, y+6-hh, ww, hh);
          break;
        }
        g.fillStyle='rgba(46,42,38,0.85)';
        g.beginPath(); g.ellipse(x,y+1,15,6,0,0,7); g.fill();
        g.fillStyle='rgba(72,66,58,0.7)';
        g.beginPath(); g.ellipse(x-3,y-0.5,9,4,0,0,7); g.fill();
        const beam=(bx,by,a,len)=>{
          g.save(); g.translate(bx,by); g.rotate(a);
          g.fillStyle='#241f1a'; g.fillRect(-1.6,-len,3.2,len);
          g.fillStyle='rgba(120,100,80,0.35)'; g.fillRect(-1.6,-len,1.1,len);
          g.restore();
        };
        beam(x-7,y+1,-0.5,16); beam(x+5,y+2,0.4,13); beam(x-1,y+1,0.1,9);
        g.fillStyle='#6d6860';
        g.beginPath(); g.moveTo(x+8,y+1); g.lineTo(x+11,y-3); g.lineTo(x+14,y+1); g.closePath(); g.fill();
        // feiner Restrauch
        for(let k=0;k<2;k++){
          const ph=(this.time/1600+k*0.5+(i%7)*0.1)%1;
          g.fillStyle=`rgba(90,86,80,${0.2*(1-ph)})`;
          g.beginPath(); g.arc(x-2+k*5+Math.sin(this.time/900+k)*4*ph, y-4-ph*22, 2.4+ph*4.4, 0, 7); g.fill();
        }
        break;
      }
      case OBJ.GATE: {
        this.shadow(g,x,y+3,22,6,0.3);
        const ovG=this.asset('obj_gate');
        if(ovG){
          const hh=this.scaleOf('obj_gate',54), ww=hh*(ovG.naturalWidth/ovG.naturalHeight);
          g.drawImage(ovG, x-ww/2, y+4-hh, ww, hh);
          // Portal-Schimmer bleibt als magischer Akzent
          const pulse=0.3+0.15*Math.sin(this.time/400);
          g.fillStyle=`rgba(160,225,255,${pulse})`;
          g.beginPath(); g.ellipse(x,y-hh*0.4,ww*0.16,hh*0.3,0,0,7); g.fill();
          break;
        }
        const pil=(px)=>{
          const gr=g.createLinearGradient(px-5,0,px+5,0);
          gr.addColorStop(0,'#9a958c'); gr.addColorStop(0.5,'#c2bdb2'); gr.addColorStop(1,'#7d786e');
          g.fillStyle=gr; g.fillRect(px-5,y-40,10,40);
          g.strokeStyle=OUT; g.lineWidth=1.5; g.strokeRect(px-5,y-40,10,40);
        };
        pil(x-14); pil(x+14);
        g.fillStyle='#b5b0a6'; g.fillRect(x-22,y-47,44,9);
        g.strokeStyle=OUT; g.lineWidth=1.5; g.strokeRect(x-22,y-47,44,9);
        // Portal-Schimmer
        const pulse=0.4+0.2*Math.sin(this.time/400);
        const gr=g.createLinearGradient(0,y-38,0,y);
        gr.addColorStop(0,`rgba(140,220,255,${pulse})`);
        gr.addColorStop(1,'rgba(140,220,255,0.05)');
        g.fillStyle=gr; g.fillRect(x-9,y-38,18,38);
        g.fillStyle=`rgba(200,240,255,${pulse*0.5})`;
        g.beginPath(); g.ellipse(x,y-19,5,14,0,0,7); g.fill();
        break;
      }
    }
  }
  // Gebirgspass: die Grafik bringt beide Felsschultern und das Geröll
  // dazwischen mit. Sie wird auf die Durchgangsrichtung ausgerichtet.
  drawPass(g, m, i){
    const img=this.asset('obj_pass');
    if(!img) return;
    const [x,y]=m.worldPos(i);
    // Richtung des Durchgangs: dorthin, wo es NICHT Fels ist
    let ox=0, oy=0, n=0;
    for(const q of m.nbs(i)){
      const rocky=m.terr[q]===TER.MOUNT||m.terr[q]===TER.SNOW;
      if(rocky) continue;
      const [qx,qy]=m.worldPos(q);
      ox+=qx-x; oy+=qy-y; n++;
    }
    const hh=this.scaleOf('obj_pass',56)*(0.9+hash01(i*31+3)*0.25);
    const ww=hh*(img.naturalWidth/img.naturalHeight);
    this.shadow(g, x+ww*0.14, y+4, ww*0.42, hh*0.16, 0.26);
    g.save();
    g.translate(x, y);
    // Der Durchgang zeigt zur offenen Seite: liegt sie links, wird gespiegelt.
    // Gedreht wird nicht – ein gekippter Fels sähe aus, als fiele er um.
    if(n && ox<0){ g.scale(-1,1); }
    g.drawImage(img, -ww/2, 6-hh, ww, hh);
    g.restore();
  }
  drawBld(g, m, b){
    const [x,y]=m.worldPos(b.node);
    const s=this.bldSprite(b.type, b.player, b.state==='build'?'build':'done');
    const def=BLD[b.type];
    const big=def.size==='L'||b.type==='hq';
    // Asset-Überschreibung (Stilguide §14): bld_<typ>.png bzw. bld_<typ>_build.png
    // Wohnhaus: drei Bauweisen, stabil je Gebäude gewählt
    let typeKey='bld_'+b.type;
    if(b.type==='cottage'){
      const v=b.id%3;
      if(v>0 && this.asset('bld_cottage'+(v+1))) typeKey='bld_cottage'+(v+1);
    }
    // gemalte Bodenellipse + Richtungsschatten nur für Prozedural-/Altbilder –
    // die neuen Cartoon-Bilder bringen ihren eigenen Bodenschatten mit
    if(!this.scaleOf(typeKey, null)){
      g.fillStyle='rgba(128,104,70,0.2)';
      g.beginPath(); g.ellipse(x,y+2, big?36:def.size==='M'?29:23, big?11:9, 0, 0, 7); g.fill();
      this.shadow(g,x+11,y+5, big?40:def.size==='M'?32:25, big?9:7, 0.24);
    }
    // Festgetretener Boden rund um jedes Gebäude. Ohne ihn steht das Haus
    // wie ausgeschnitten auf der Wiese; der Saum bindet es ein.
    if(b.state==='done' || b.leveled){
      const R = big?34 : def.size==='M'?27 : def.size==='MINE'?20 : 22;
      const pad=g.createRadialGradient(x,y+3,R*0.30, x,y+3,R);
      pad.addColorStop(0,'rgba(122,102,72,0.34)');
      pad.addColorStop(0.55,'rgba(122,102,72,0.20)');
      pad.addColorStop(1,'rgba(122,102,72,0)');
      g.fillStyle=pad;
      g.beginPath(); g.ellipse(x,y+3, R, R*0.42, 0,0,7); g.fill();
      // ein paar Grasbüschel am Rand verzahnen den Saum mit der Wiese
      if(this.theme!=='winter' && this.theme!=='wueste'){
        for(let k=0;k<6;k++){
          const a2=hash01(b.id*13+k)*6.283;
          const rr=R*(0.72+hash01(b.id*17+k)*0.3);
          const gx=x+Math.cos(a2)*rr, gy=y+3+Math.sin(a2)*rr*0.42;
          g.strokeStyle= k%2? 'rgba(92,124,56,0.5)':'rgba(116,144,66,0.44)';
          g.lineWidth=1.1;
          g.beginPath();
          g.moveTo(gx-1.2,gy+0.8); g.quadraticCurveTo(gx-1,gy-1.8,gx-0.3,gy-2.8);
          g.moveTo(gx+0.6,gy+0.8); g.quadraticCurveTo(gx+0.9,gy-2,gx+1.6,gy-2.9);
          g.stroke();
        }
      }
    }
    // Baustellen-Phasen aus dem Asset-Paket: Planierung + 3 Baufortschritte je Größe
    // Baustellen nach Größe UND Form: Bergwerke sind kleine Hütten (die
    // mittlere Baustelle wirkte daneben riesig), schmale Turmbauten nutzen
    // die kleine. Liegt ein eigenes Bild bld_build_<typ>_<stufe> im Paket,
    // gewinnt automatisch das.
    const TURMFORM=['watchtower','chapel','mill','guardhouse','well'];
    const sizeKey= (def.size==='L'||b.type==='hq') ? 'l'
      : def.size==='MINE' ? (this.asset('bld_build_mine_1')?'mine':'s')
      : TURMFORM.includes(b.type) ? (this.asset('bld_build_turm_1')?'turm':'s')
      : def.size==='S' ? 's' : 'm';
    // Bauablauf sichtbar in drei Schritten: erst ebnet der PLANIERER den
    // Platz (wachsende Erdfläche + Absteckpfähle), dann kommt der
    // BAUARBEITER - und erst mit seiner Ankunft (b.bauerDa) erscheint das
    // erste Baustellenbild. Vorher stand hier ab Tag eins ein Geisterbild
    // der Baustufe, obwohl noch niemand einen Finger gerührt hatte.
    if(b.state==='build' && (!b.leveled || !b.bauerDa)){
      const t= b.leveled? 1 : Math.min(1,(b.levelT||0)/70);
      g.fillStyle=`rgba(122,95,61,${0.2+t*0.35})`;
      g.beginPath(); g.ellipse(x,y+2, 14+t*10, (14+t*10)*0.42, 0, 0, 7); g.fill();
      g.strokeStyle='rgba(90,66,40,0.4)'; g.lineWidth=1;
      g.beginPath(); g.ellipse(x,y+2, 14+t*10, (14+t*10)*0.42, 0, 0, 7); g.stroke();
      // Absteckpfähle mit Schnur
      g.strokeStyle='#6d4f2e'; g.lineWidth=1.6;
      for(const [px2,py2] of [[x-16,y-4],[x+16,y-4],[x-14,y+8],[x+14,y+8]]){
        g.beginPath(); g.moveTo(px2,py2); g.lineTo(px2,py2-8); g.stroke();
      }
      g.strokeStyle='rgba(233,222,193,0.6)'; g.lineWidth=0.8;
      g.beginPath();
      g.moveTo(x-16,y-10); g.lineTo(x+16,y-10); g.lineTo(x+14,y+2); g.lineTo(x-14,y+2); g.closePath();
      g.stroke();
      // Auch die noch unplanierte Baustelle zeigt ihr Warnschild, wenn sie
      // minutenlang auf Baumaterial wartet (F4/F5)
      const zu=this.bldZustand(b);
      if(zu && b.player===0) this.statusSchild(g, x, y-34, zu, b.id);
      return;
    }
    let ov, ovKey=typeKey;
    if(b.state==='build'){
      // Baustelle zeigt bewusst NUR das eckige Holzgerüst (Phase 1/2),
      // nie das fast fertige Haus – das erscheint erst beim Umschalten auf 'done'
      const total=80+30*((def.cost.board||0)+(def.cost.stone||0));
      const drei=(sizeKey==='turm'||sizeKey==='mine');
      const f2=b.progress/total;
      const ph= drei ? (f2<0.4?1: f2<0.75?2:3) : (f2<0.55?1:2);
      ovKey=`bld_build_${b.type}_${ph}`;
      if(!this.asset(ovKey)) ovKey=`bld_build_${sizeKey}_${ph}`;
      ov=this.asset(ovKey) || this.asset(typeKey+'_build') || this.asset('bld_baustelle');
      if(!this.asset(ovKey)) ovKey=null;
    } else {
      ov=this.asset(typeKey);
    }
    if(ov){
      // Bergwerke (Stilguide 11.11): alle sieben Bilder liegen auf 320x300,
      // die Bodenlinie ist y=288 und die DOMACHSE bei 47,4 % der Breite.
      // Sie bekommen EINEN gemeinsamen Zeichenfaktor MINE_F – die
      // Baustufen (Inhaltshoehe 47/69/82 % gegen 92 % der fertigen Mine)
      // wachsen damit von selbst, ohne eine Skala je Datei. Verankert wird
      // auf die DOMACHSE statt auf die Bildmitte: der Felsdom bleibt sonst
      // zwischen den Stufen nicht stehen, weil Stufe 1 kein Gleis hat und
      // ihre Bounding Box seitlich wegläuft (11.6).
      const mineNeu = def.size==='MINE'
                    && ov.naturalWidth===320 && ov.naturalHeight===300;
      let hh, ww, dx0, dy0;
      if(mineNeu){
        ww=320*MINE_F; hh=300*MINE_F;
        dx0=x-MINE_DOM*ww;
        dy0=y+4-MINE_BODEN*MINE_F;
      } else {
        // Höhen aus dem Sheet-Maßstab (Wohnhaus=Anker); Rückfall: alte Festwerte
        const legacy= b.type==='hq'?118 : big?96 : def.size==='M'?80 : def.size==='MINE'?58 : 64;
        hh=this.scaleOf(ovKey||typeKey, legacy);
        ww=hh*(ov.naturalWidth/ov.naturalHeight);
        dx0=x-ww/2;
        dy0=y-hh+(def.size==='MINE'?8:10);
      }
      // Die tatsächlichen Bildmaße an die Simulation melden: sie sperrt damit
      // Straßen, die sonst unter dem Haus hindurchliefen. Nur der Zeichner
      // kennt die Maßstäbe aus scales.json.
      if(b.state==='done'){
        if(!this.game.bldFoot) this.game.bldFoot={};
        const vor=this.game.bldFoot[b.type];
        if(!vor || Math.abs(vor[0]-ww)>0.5 || Math.abs(vor[1]-hh)>0.5){
          this.game.bldFoot[b.type]=[ww,hh];
          this.game.bldVer=(this.game.bldVer||0)+1;    // Bauschatten neu rechnen
        }
      }

      // Bergwerke: neue Bilder bringen ihren Felshügel mit, alte brauchen den Felskragen
      if(def.size==='MINE' && !mineNeu && !this.scaleOf(typeKey, null)){
        const rk=g.createRadialGradient(x,y-hh*0.45,4, x,y-hh*0.45, ww*0.75);
        rk.addColorStop(0,'rgba(112,106,96,0.85)');
        rk.addColorStop(0.65,'rgba(96,90,80,0.55)');
        rk.addColorStop(1,'rgba(90,84,74,0)');
        g.fillStyle=rk;
        g.beginPath(); g.ellipse(x,y-hh*0.42, ww*0.72, hh*0.62, 0, 0, 7); g.fill();
        g.drawImage(this.solidBld(ovKey||typeKey, ov), x-ww/2, y-hh+6, ww, hh);
        g.fillStyle='rgba(96,90,80,0.5)';
        for(let k=0;k<5;k++){
          const rx=x-ww*0.4+k*ww*0.2, ry=y+4+((k*13)%5);
          g.beginPath(); g.ellipse(rx,ry,4.5,2.4,0,0,7); g.fill();
        }
      } else {
        // Minen-Verankerung (Nutzerfoto IMG_7989): unter dem Bergwerk eine
        // Fels-Schürze (Plattentextur, weich auslaufend) und ein Kontakt-
        // schatten – der gemalte Dom sitzt im Terrain statt zu schweben.
        // Die Schürze liegt unter der DOMACHSE, nicht unter der Bildmitte.
        if(def.size==='MINE') this.mineApron(g, x, y, ww*0.86);
        // Küstenbauten rücken über die Uferlinie, damit Steg und Rumpf im
        // Wasser stehen statt auf der Wiese zu kleben
        let sx=0, sy=0;
        if(def.coastal){
          if(b._wx===undefined){
            let wx=0, wy=0, n2=0;
            for(const q of m.nbs(b.node)) if(m.terr[q]===TER.WATER){
              const [qx,qy]=m.worldPos(q); wx+=qx-x; wy+=qy-y; n2++;
            }
            const L=n2? Math.hypot(wx,wy)||1 : 1;
            b._wx=n2? (wx/L)*TILE*0.34 : 0;
            b._wy=n2? (wy/L)*TILE*0.24 : 0;
          }
          sx=b._wx; sy=b._wy;
        }
        g.drawImage(this.solidBld(ovKey||typeKey, ov), dx0+sx, dy0+sy, ww, hh);
      }
      // Militärbauten und Hauptburg: Wimpel in Spielerfarbe auf den Turmspitzen
      if((def.mil||b.type==='hq') && b.state==='done'){
        const tips=this.towerTips(ov, ovKey||typeKey);
        const fs=Math.max(9, Math.min(22, hh*0.135));
        const ox=dx0, oy=dy0;
        tips.forEach(([fx,fy],k)=>{
          this.drawTowerFlag(g, ox+fx*ww, oy+fy*hh+fs*0.10, fs, b.player, k*1.7+b.id);
        });
      }
    } else {
      g.drawImage(s.cv, x-s.w/2, y-s.h+10, s.w, s.h);
    }
    if(b.state==='build'){
      const total=80+30*((def.cost.board||0)+(def.cost.stone||0));
      g.fillStyle='rgba(15,20,12,0.55)'; g.fillRect(x-17,y+7,34,6);
      g.fillStyle='#ffd54a'; g.fillRect(x-16,y+8,32*Math.min(1,b.progress/total),4);
      g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=1; g.strokeRect(x-17,y+7,34,6);
    }
    // Angriffs-Hinweis: feindliche Militärbauten/HQ, die du erreichen kannst,
    // tragen ein pulsierendes Schwerter-Zeichen ("hier antippen zum Angriff")
    if(b.player>0 && (def.mil||b.type==='hq') && this.game.players[0] && !this.game.players[0].defeated){
      if(!this._atkC || this.time-this._atkC.t>1200) this._atkC={t:this.time, m:new Map()};
      let n=this._atkC.m.get(b.id);
      if(n===undefined){ n=this.game.attackable(0,b.id); this._atkC.m.set(b.id,n); }
      if(n>0){
        const hh2=this.scaleOf(typeKey, big?96:64);
        const by=y-hh2-6, pulse=0.75+0.25*Math.sin(this.time/320);
        const md=this.asset('ui_tab_militaer');
        g.globalAlpha=pulse;
        if(md){
          const s2=19, w2=s2*(md.naturalWidth/md.naturalHeight);
          g.drawImage(md, x-w2/2, by-s2, w2, s2);
        } else {
          g.fillStyle='rgba(20,26,34,0.8)';
          g.beginPath(); g.arc(x,by-9,9,0,7); g.fill();
          g.strokeStyle='#e8e2d4'; g.lineWidth=2;
          g.beginPath(); g.moveTo(x-5,by-14); g.lineTo(x+5,by-4);
          g.moveTo(x+5,by-14); g.lineTo(x-5,by-4); g.stroke();
        }
        g.globalAlpha=1;
      }
    }
    if(b.soldiers && b.state==='done'){
      const n=b.soldiers.length;
      const yy=y-(big?58:def.size==='M'?46:40);
      for(let k=0;k<n;k++){
        g.fillStyle='rgba(15,20,12,0.5)';
        g.beginPath(); g.arc(x-15+k*6.4, yy+1, 3, 0, 7); g.fill();
        g.fillStyle=PLAYER_COLORS[b.player];
        g.beginPath(); g.arc(x-15+k*6.4, yy, 2.6, 0, 7); g.fill();
      }
      // Belagerung: Verteidiger treten kämpfend vor das Tor (Blick zum Angreifer)
      const bt=this.game && this.game.battles.find(bt=>bt.bldId===b.id);
      if(bt){
        const au=this.game.units.find(u2=>u2.id===bt.unitId);
        const ddir=au? [au.x-x, au.y-y] : null;
        b.soldiers.slice(0,3).forEach((st,k)=>{
          this.drawFigure(g, x-10+k*10, y+13, b.player, null, 'soldier', st, null, 2.6+k*2.2, ddir, false);
        });
      }
    }
    // ---------- Dauerzustände als schwebendes Holzschild (F5) ----------
    // Ein einheitliches Zeichen im Bild statt Toast-Wiederholung: ⚠-Schild
    // (erschöpfte Umgebung, leeres Bergwerk, wartendes Baumaterial), Zz
    // (pausiert, Lager voll, eingeschlafener Sammler) und Werkzeug-Symbol
    // (wartet auf Werkzeug). Ersetzt die alte Doppelbalken-Pausenplakette
    // und die frei schwebenden Zzz-Buchstaben.
    if(b.player===0){
      const zu=this.bldZustand(b);
      if(zu){
        const hh3=this.scaleOf(typeKey, big?96:64);
        this.statusSchild(g, x, y-hh3-14, zu, b.id);
      }
    }
    // ---------- deutliche Arbeits-Effekte ----------
    const working=b.state==='done' && !b.paused && (BLD[b.type].prod||BLD[b.type].mine) && b.prodT>0;
    // Windmühle: rotierendes Flügelkreuz-Bild an der Nabe des Turms
    if(b.type==='mill' && b.state==='done' && this.asset('obj_millsails')){
      const sails=this.asset('obj_millsails');
      const mimg=this.asset('bld_mill');
      const hh=this.scaleOf('bld_mill',92);
      const ww=hh*(mimg? mimg.naturalWidth/mimg.naturalHeight : 0.5);
      // Nabe an der Kappe, knapp unter der Dachspitze, leicht nach vorn.
      // Vorher saß sie auf dem linken Dachrand und die Spannweite war fast
      // so groß wie der ganze Turm – die Flügel lagen wie ein Aufkleber quer
      // über dem Dach.
      // Achszapfen der neuen Muehle (im Turmbild vermessen: der graue
      // Zapfen links am Kegeldach)
      const hubX=x-ww/2+ww*0.30, hubY=y-hh+10+hh*0.205;
      const span=hh*0.62;                    // Flügelspannweite
      const ang= working? this.time/650 : (b.id%6.28);
      // Das Fluegelbild ist jetzt exakt rotationssymmetrisch und FRONTAL
      // (orthografisch, Nabe in der Bildmitte). Die frueher eingebackene
      // Schraegsicht (oberer Fluegel kuerzer als der untere) drehte sich
      // beim Rotieren mit - der kurze Fluegel wanderte im Kreis und das Rad
      // "eierte". Die Schraegsicht kommt darum komplett zur Laufzeit:
      // erst die FESTE Kippmatrix (bleibt in Bildschirmrichtung stehen),
      // DANN die Rotation - so bleibt die Radebene stabil und das Rad
      // laeuft rund, leicht gekippt wie ein echtes Muehlrad von schraeg vorn.
      // Kippmatrix = reine Stauchung auf 0.86 laengs der Achsrichtung des
      // Zapfens am Kegeldach (zeigt auf dem Turmbild nach links und ca. 10
      // Grad nach unten): M = I - 0.14*u*uT mit u=(cos-10, sin-10).
      g.save();
      g.translate(hubX,hubY);
      // weicher Schatten aufs Dach, damit die Flügel aufliegen statt zu
      // schweben. Der Versatz passiert VOR der Kippung, also in fester
      // Bildschirmrichtung - sonst kreist der Schatten mit dem Rad.
      g.save();
      g.globalAlpha=0.22;
      g.translate(span*0.045, span*0.05);
      g.transform(0.8642, 0.0239, 0.0239, 0.9958, 0, 0);
      g.rotate(ang);
      g.drawImage(sails, -span/2, -span/2, span, span);
      g.restore();
      g.transform(0.8642, 0.0239, 0.0239, 0.9958, 0, 0);
      g.rotate(ang);
      g.drawImage(sails, -span/2, -span/2, span, span);
      g.restore();
    }
    // alte Bilder ohne Flügel: prozedurale Flügel als Rückfall
    else if(b.type==='mill' && b.state==='done' && !this.scaleOf('bld_mill', null)){
      const hubX=x+1, hubY=y-58;
      const ang= working? this.time/650 : (b.id%6.28);
      g.save();
      g.translate(hubX,hubY);
      g.scale(1,0.92);                       // leichte Perspektive
      for(let k=0;k<4;k++){
        g.save();
        g.rotate(ang + k*Math.PI/2);
        // Holzrahmen des Flügels
        g.strokeStyle='#6d5433'; g.lineWidth=2.2;
        g.beginPath(); g.moveTo(0,3); g.lineTo(0,-30); g.stroke();
        // bespannte Gitterfläche
        g.fillStyle='rgba(233,222,193,0.88)';
        g.beginPath();
        g.moveTo(0,-4); g.lineTo(7.5,-8); g.lineTo(7.5,-28) ; g.lineTo(0,-30);
        g.closePath(); g.fill();
        g.strokeStyle='rgba(94,74,46,0.75)'; g.lineWidth=1; g.stroke();
        for(let s=1;s<4;s++){                // Querstreben
          g.beginPath(); g.moveTo(0,-4-s*6.4); g.lineTo(7.5,-8-s*5.2); g.stroke();
        }
        g.restore();
      }
      g.fillStyle='#4a3826';
      g.beginPath(); g.arc(0,0,3,0,7); g.fill();
      g.fillStyle='#c9a05a';
      g.beginPath(); g.arc(0,0,1.3,0,7); g.fill();
      g.restore();
    }
    // Arbeits-Effekte (Rauch, Funken, Staub …) – je Gebäude passend verankert
    this.bldEffect(g, b, x, y, working);
  }
  // Welcher Dauerzustand gilt für dieses Gebäude? (F5)
  // 'warn'  = erschöpfte Umgebung / leeres Vorkommen / Baustelle wartet auf Material
  // 'sleep' = pausiert, Lager voll (satPause) oder eingeschlafener Sammler
  // 'tool'  = wartet auf Werkzeug aus der Werkzeugschmiede
  bldZustand(b){
    if(b.state==='build') return (b.matWaitT||0)>=1200 ? 'warn' : null;
    if(b.state!=='done') return null;
    if(b.paused) return 'sleep';
    if(b.worker && !b.worker.present && b.needTool) return 'tool';
    if(b.exhausted || b.depleted) return 'warn';
    if(b.satPause) return 'sleep';
    if(b.worker && b.worker.present && b.worker.state==='in'
       && b.worker.timer > (BLD[b.type].time||100)*3) return 'sleep';
    return null;
  }
  // Kleines schwebendes Holzschild mit Zeichen – prozedural im Spielstil
  // gemalt (Brett, Nägel, aufgemaltes Symbol), KEINE Emojis im Canvas.
  statusSchild(g, x, y, kind, id=0){
    const bob=Math.sin(this.time/520+id*1.3)*1.6;
    const cy=y+bob;
    const w=19, h=15, r=3;
    g.save();
    // weicher Schatten unterm Schild
    g.fillStyle='rgba(15,20,12,0.30)';
    g.beginPath(); g.ellipse(x, y+11, 7.5, 2.4, 0, 0, 7); g.fill();
    // Brett mit Holzverlauf
    const grad=g.createLinearGradient(x, cy-h/2, x, cy+h/2);
    grad.addColorStop(0,'#9a7a4e'); grad.addColorStop(1,'#6d5433');
    g.beginPath();
    g.moveTo(x-w/2+r, cy-h/2);
    g.lineTo(x+w/2-r, cy-h/2); g.quadraticCurveTo(x+w/2, cy-h/2, x+w/2, cy-h/2+r);
    g.lineTo(x+w/2, cy+h/2-r); g.quadraticCurveTo(x+w/2, cy+h/2, x+w/2-r, cy+h/2);
    g.lineTo(x-w/2+r, cy+h/2); g.quadraticCurveTo(x-w/2, cy+h/2, x-w/2, cy+h/2-r);
    g.lineTo(x-w/2, cy-h/2+r); g.quadraticCurveTo(x-w/2, cy-h/2, x-w/2+r, cy-h/2);
    g.closePath();
    g.fillStyle=grad; g.fill();
    g.strokeStyle='#3a2c18'; g.lineWidth=1.2; g.stroke();
    // Maserung + Ziernägel
    g.strokeStyle='rgba(61,43,20,0.3)'; g.lineWidth=0.7;
    g.beginPath(); g.moveTo(x-w/2+2, cy+3.6); g.lineTo(x+w/2-2, cy+3.2); g.stroke();
    g.fillStyle='rgba(233,222,193,0.8)';
    for(const [nx,ny] of [[x-w/2+2.2,cy-h/2+2.2],[x+w/2-2.2,cy-h/2+2.2],[x-w/2+2.2,cy+h/2-2.2],[x+w/2-2.2,cy+h/2-2.2]]){
      g.beginPath(); g.arc(nx,ny,0.8,0,7); g.fill();
    }
    if(kind==='warn'){
      // aufgemaltes Warndreieck mit Ausrufezeichen
      g.beginPath();
      g.moveTo(x, cy-5.4); g.lineTo(x+5.4, cy+4.4); g.lineTo(x-5.4, cy+4.4);
      g.closePath();
      g.fillStyle='#f2c94c'; g.fill();
      g.strokeStyle='#472f18'; g.lineWidth=1.1; g.lineJoin='round'; g.stroke();
      g.fillStyle='#472f18';
      g.fillRect(x-0.8, cy-2.6, 1.6, 4.0);
      g.beginPath(); g.arc(x, cy+2.9, 0.9, 0, 7); g.fill();
    } else if(kind==='sleep'){
      // gemaltes "Zz" auf dem Brett + ein kleines z steigt auf
      g.fillStyle='#f2e4c2';
      g.strokeStyle='rgba(40,28,14,0.55)'; g.lineWidth=2.6; g.lineJoin='round';
      g.font='bold 11px Georgia,serif'; g.textAlign='left'; g.textBaseline='middle';
      g.strokeText('Z', x-6, cy+0.5); g.fillText('Z', x-6, cy+0.5);
      g.font='bold 8px Georgia,serif';
      g.strokeText('z', x+1.5, cy+2.2); g.fillText('z', x+1.5, cy+2.2);
      const ph=(this.time/900+id)%1;
      g.font='bold 8px Georgia,serif';
      g.fillStyle=`rgba(240,245,255,${0.7*(1-ph)})`;
      g.fillText('z', x+7, cy-7-ph*7);
    } else if(kind==='tool'){
      // aufgemalter Hammer: Stiel schräg, Kopf aus dunklem Stahl
      g.save();
      g.translate(x, cy); g.rotate(-0.65);
      g.fillStyle='#a87f4e';
      g.fillRect(-1.1, -1.5, 2.2, 8.6);           // Stiel
      g.strokeStyle='#3a2c18'; g.lineWidth=0.8; g.strokeRect(-1.1, -1.5, 2.2, 8.6);
      g.fillStyle='#7d8894';
      g.beginPath();
      g.moveTo(-4.6,-4.6); g.lineTo(4.6,-4.6); g.lineTo(4.0,-1.2); g.lineTo(-4.0,-1.2);
      g.closePath(); g.fill();
      g.strokeStyle='#39404a'; g.lineWidth=1; g.lineJoin='round'; g.stroke();
      g.fillStyle='rgba(236,240,244,0.5)';
      g.fillRect(-3.6,-4.1, 6.6, 1.0);            // Lichtkante am Kopf
      g.restore();
    }
    g.restore();
  }
  // Maße und Lage des gezeichneten Gebäudesprites (Weltkoordinaten), damit
  // Effekt-Anker aus BLD_FX in Bild-Bruchteilen umgerechnet werden können.
  // Muss zur Zeichnung in drawBld passen (gleiche Höhenwahl, gleicher Versatz).
  bldFxFrame(b){
    const def=BLD[b.type];
    let typeKey='bld_'+b.type;
    if(b.type==='cottage'){
      const v=b.id%3;
      if(v>0 && this.asset('bld_cottage'+(v+1))) typeKey='bld_cottage'+(v+1);
    }
    const big=def.size==='L'||b.type==='hq';
    const legacy= b.type==='hq'?118 : big?96 : def.size==='M'?80 : def.size==='MINE'?58 : 64;
    const hh=this.scaleOf(typeKey, legacy);
    const img=this.asset(typeKey);
    const ww=hh*((img && img.naturalWidth)? img.naturalWidth/img.naturalHeight : 0.95);
    const sx=def.coastal? (b._wx||0) : 0;
    const sy=def.coastal? (b._wy||0) : 0;
    return [ww, hh, sx, sy, def.size==='MINE'?8:10];
  }
  // Jedes Gebäude bekommt den Effekt, der zu seiner Arbeit passt, exakt an der
  // Stelle des Sprites, wo die Arbeit sichtbar wird (Schornstein, Esse, Säge …).
  bldEffect(g, b, x, y, working){
    if(b.state!=='done') return;
    const spec=BLD_FX[b.type];
    if(!spec) return;
    const def=BLD[b.type];
    // Arbeitszustand: Produktion/Bergwerk = prodT läuft; Sammler (Holzfäller,
    // Bauernhof …) haben kein prodT – dort zählt der ausgerückte Arbeiter bzw.
    // eine kurze Nacharbeitszeit in der Hütte, bis er einschläft.
    let act=working;
    if(!act && def.gather && !b.paused && b.worker && b.worker.present){
      act = b.worker.state==='out' || b.worker.timer <= (def.time||60);
    }
    const staffed = !b.paused && (!b.worker || b.worker.present);
    const t=this.time, id=b.id;
    const [bw,bh,sx,sy,lift]=this.bldFxFrame(b);
    const ox=x+sx-bw/2, oy=y+sy-bh+lift;
    const sc=bh/80;                         // Größenmaßstab: M-Gebäude ≈ 1
    // kleine Helfer (deterministisch über die Zeit, kein Zustand, keine Allokation)
    const puff=(px,py,col,n,rise,size,speed)=>{
      for(let k=0;k<n;k++){
        const ph=((t/speed)+k/n+id*0.13)%1;
        g.fillStyle=col.replace('$A', (0.5*(1-ph)).toFixed(3));
        g.beginPath();
        g.arc(px+Math.sin(t/430+k*2.1+id)*4*sc*ph, py-ph*rise, size*(0.5+ph), 0, 7);
        g.fill();
      }
    };
    const chips=(px,py,col,n,spread)=>{
      const cw=Math.max(2.2, 2.6*sc), ch=Math.max(1.0, 1.2*sc);
      for(let k=0;k<n;k++){
        const ph=((t/620)+k/n+id*0.21)%1;
        const a=(hash01(id*7+k)-0.5)*2.2;
        g.fillStyle=col.replace('$A',(0.85*(1-ph)).toFixed(3));
        g.save();
        g.translate(px+Math.cos(a)*spread*ph, py-Math.sin(Math.PI*ph)*9*sc+ph*4*sc);
        g.rotate(a*3+ph*6);
        g.fillRect(-cw/2,-ch/2,cw,ch);
        g.restore();
      }
    };
    for(const e of spec){
      if(e.on==='always' ? false : e.on==='staffed' ? !staffed : !act) continue;
      const ax=ox+e.a[0]*bw, ay=oy+e.a[1]*bh;
      const S=e.s*sc;
      switch(e.k){
        case 'smoke': {
          // Schornstein-Rauch: sitzt exakt auf der gemalten Kaminöffnung;
          // dunkler Qualm (Eisenhütte) hat sein eigenes gemaltes Bild
          const smi=(e.col==='dunkel' && this.asset('fx_smoke_dark')) || this.asset('fx_smoke');
          const white=e.col==='weiss', dark=e.col==='dunkel';
          if(smi){
            const asp=smi.naturalWidth/smi.naturalHeight;
            for(const off of [0,0.33,0.66]){
              const ph=(t/2400 + id*0.37 + off)%1;
              const h2=(12+ph*26)*S, w2=h2*asp;
              const sway=Math.sin(t/900+id+off*3)*4*S;
              g.globalAlpha=(white?0.78:dark?0.82:0.62)*(1-ph);
              g.drawImage(smi, ax-w2/2+sway*ph, ay-ph*24*S-h2+h2*0.14, w2, h2);
              if(white){
                // helle zweite Lage statt Helligkeitsfilter (ctx.filter tabu)
                g.globalCompositeOperation='lighter';
                g.globalAlpha=0.36*(1-ph);
                g.drawImage(smi, ax-w2/2+sway*ph, ay-ph*24*S-h2+h2*0.14, w2, h2);
                g.globalCompositeOperation='source-over';
              }
            }
            g.globalAlpha=1;
          } else for(const off of [0,0.45]){
            const ph=(t/900 + id*0.7 + off)%1;
            const sway=Math.sin(t/600+id+off*4)*3*S;
            g.fillStyle= white? `rgba(245,245,242,${0.55*(1-ph)})`
              : dark? `rgba(96,96,102,${0.5*(1-ph)})`
              : `rgba(215,215,218,${0.42*(1-ph)})`;
            g.beginPath(); g.arc(ax+sway*ph, ay-2-ph*20*S, (2.2+ph*4.6)*S, 0, 7); g.fill();
          }
          break;
        }
        case 'steam': {
          // heller Wasserdampf (Braukessel, Ofenabzug)
          const st=this.asset('fx_steam');
          if(st){
            const asp=st.naturalWidth/st.naturalHeight;
            for(const off of [0,0.5]){
              const ph=(t/2000+id*0.41+off)%1;
              const h2=(10+ph*20)*S, w2=h2*asp;
              g.globalAlpha=0.7*(1-ph);
              g.drawImage(st, ax-w2/2+Math.sin(t/800+id+off*3)*3*S*ph, ay-ph*18*S-h2, w2, h2);
            }
            g.globalAlpha=1;
          } else puff(ax, ay, 'rgba(240,244,246,$A)', 3, 15*S, 2.6*S, 1500);
          break;
        }
        case 'glow': {
          // flackernder Feuerschein (Esse, Ofenmaul); 'lighter' statt Filter
          const fl=0.55+0.3*Math.sin(t/95+id*1.7)+0.15*Math.sin(t/41+id*3.1);
          const R=13*S;
          g.globalCompositeOperation='lighter';
          const rad=g.createRadialGradient(ax,ay,1,ax,ay,R);
          rad.addColorStop(0,`rgba(255,150,50,${0.45*fl})`);
          rad.addColorStop(0.6,`rgba(255,110,30,${0.22*fl})`);
          rad.addColorStop(1,'rgba(255,90,20,0)');
          g.fillStyle=rad;
          g.beginPath(); g.arc(ax,ay,R,0,7); g.fill();
          g.globalCompositeOperation='source-over';
          break;
        }
        case 'sparks':
          // aufsteigende Glutfünkchen; gemalte Glutsäule als Grundlage
          g.globalCompositeOperation='lighter';
          {
            const em=this.asset('fx_embers');
            if(em){
              const asp=em.naturalWidth/em.naturalHeight;
              const ph=(t/900+id*0.3)%1;
              const h2=(9+ph*7)*S, w2=h2*asp;
              g.globalAlpha=0.7*(1-ph*0.6);
              g.drawImage(em, ax-w2/2, ay-h2+2*S-ph*5*S, w2, h2);
              g.globalAlpha=1;
            }
          }
          for(let k=0;k<3;k++){
            const ph=(t/520+k/3+id*0.3)%1;
            g.fillStyle=`rgba(255,200,110,${0.85*(1-ph)})`;
            g.beginPath();
            g.arc(ax+Math.sin(t/140+k*4+id)*2.5*S, ay-ph*10*S, Math.max(0.7,1.0*sc), 0, 7);
            g.fill();
          }
          g.globalCompositeOperation='source-over';
          break;
        case 'chips':
          // wirbelnde Splitter/Halme in Materialfarbe
          chips(ax, ay, e.col, 4, 12*S);
          break;
        case 'sawdust': {
          // Sägemehl: gemalte Staubwolke + wirbelnde Späne am Sägeblatt
          const sd=this.asset('fx_sawdust');
          if(sd){
            const asp=sd.naturalWidth/sd.naturalHeight;
            for(const off of [0,0.5]){
              const ph=(t/1500+id*0.27+off)%1;
              const h2=(7+ph*9)*S, w2=h2*asp;
              g.globalAlpha=0.55*(1-ph);
              g.drawImage(sd, ax-w2/2, ay-2*S-ph*8*S-h2/2, w2, h2);
            }
            g.globalAlpha=1;
          } else puff(ax, ay-2*S, 'rgba(226,208,170,$A)', 2, 11*S, 2.6*S, 1500);
          chips(ax, ay, 'rgba(228,200,146,$A)', 4, 13*S);
          break;
        }
        case 'stonedust':
          // Steinstaub + Splitter am Werkblock
          puff(ax, ay, 'rgba(168,160,146,$A)', 3, 12*S, 3.0*S, 1400);
          chips(ax, ay, 'rgba(136,128,116,$A)', 3, 9*S);
          break;
        case 'minedust': {
          // Abbaustaub quillt aus dem Stollenmund, dazu Abraum in Erzfarbe
          const di=this.asset('fx_dust');
          if(di){
            const asp=di.naturalWidth/di.naturalHeight;
            for(const off of [0,0.5]){
              const ph=(t/1700+id*0.23+off)%1;
              const h2=(8+ph*10)*S, w2=h2*asp;
              g.globalAlpha=0.5*(1-ph);
              g.drawImage(di, ax-w2/2+Math.sin(t/700+off*4+id)*3*ph, ay-ph*7*S-h2*0.6, w2, h2);
            }
            g.globalAlpha=1;
          } else puff(ax, ay, 'rgba(150,140,124,$A)', 3, 10*S, 3.2*S, 1500);
          chips(ax, ay+3*S, e.col, 2, 7*S);
          break;
        }
        case 'flour': {
          // feiner Mehlstaub am Auslass/bei den Säcken – kein Rauch!
          const fli=this.asset('fx_flour');
          if(fli){
            const asp=fli.naturalWidth/fli.naturalHeight;
            for(let k=0;k<2;k++){
              const ph=(t/1700+k*0.5+id*0.29)%1;
              const h2=(6+ph*8)*S, w2=h2*asp;
              g.globalAlpha=0.5*(1-ph);
              g.drawImage(fli, ax-w2/2+Math.sin(t/500+k*2.2+id)*3*S, ay-ph*6*S-h2/2, w2, h2);
            }
            g.globalAlpha=1;
          } else for(let k=0;k<3;k++){
            const ph=(t/1700+k/3+id*0.29)%1;
            g.fillStyle=`rgba(246,241,228,${0.52*(1-ph)})`;
            g.beginPath();
            g.arc(ax+Math.sin(t/500+k*2.2+id)*3*S+ph*3*S, ay-ph*6*S, (1.6+ph*2.8)*S, 0, 7);
            g.fill();
          }
          break;
        }
        case 'drips':
          // Tropfen fallen vom Eimer in den Schacht, kleines Blitzen unten
          for(let k=0;k<2;k++){
            const ph=(t/750+k*0.5+id*0.31)%1;
            g.fillStyle=`rgba(176,216,238,${0.8*(1-ph*0.45)})`;
            g.beginPath();
            g.arc(ax+(k? 2.4:-1.8)*S, ay+ph*ph*13*S, Math.max(0.9,1.2*S), 0, 7);
            g.fill();
          }
          break;
        case 'ripple': {
          // stille Wasserringe (Fischer, Hafen)
          const ri=this.asset('fx_rings');
          if(ri){
            const asp=ri.naturalWidth/ri.naturalHeight;
            for(let k=0;k<2;k++){
              const ph=((t/1300)+k*0.5+id*0.17)%1;
              const w2=(8+ph*24)*S, h2=w2/asp;
              g.globalAlpha=0.55*(1-ph);
              g.drawImage(ri, ax-w2/2, ay-h2/2, w2, h2);
            }
            g.globalAlpha=1;
          } else for(let k=0;k<2;k++){
            const ph=((t/1300)+k*0.5+id*0.17)%1;
            g.strokeStyle=`rgba(190,226,242,${0.5*(1-ph)})`;
            g.lineWidth=1.2;
            g.beginPath();
            g.ellipse(ax, ay, (3+ph*12)*S, (3+ph*12)*S*0.38, 0, 0, 7);
            g.stroke();
          }
          break;
        }
        case 'dustpuff':
          // niedriger, aufgewirbelter Staub (Auslauf der Schweinezucht)
          puff(ax, ay, e.col, 3, 6*S, 2.8*S, 1600);
          break;
        case 'leaves':
          // frisches Grün wirbelt bei den Setzlingen
          for(let k=0;k<3;k++){
            const ph=((t/2400)+k/3+id*0.19)%1;
            g.fillStyle=`rgba(150,196,96,${0.55*(1-ph)})`;
            g.save();
            g.translate(ax+Math.sin(t/700+k*2)*8*S, ay-ph*13*S);
            g.rotate(t/500+k);
            g.beginPath(); g.ellipse(0,0,2.2*S,1.1*S,0,0,7); g.fill();
            g.restore();
          }
          break;
        case 'glint':
          // goldenes Funkeln frisch geprägter Münzen
          for(let k=0;k<3;k++){
            const ph=(t/800+k/3+id*0.3)%1;
            const a2=hash01(id*11+k)*6.28;
            const px=ax+Math.cos(a2+k)*6*S, py=ay-ph*9*S;
            const L=Math.max(1,3.6*S)*(1-ph);
            g.fillStyle=`rgba(255,224,120,${0.9*(1-ph)})`;
            g.fillRect(px-L, py-0.5, L*2, 1);
            g.fillRect(px-0.5, py-L, 1, L*2);
          }
          break;
        case 'bell': {
          // ruhiger goldener Schein um die Glocke, im Takt eines Glockenschlags
          const bell=0.5+0.5*Math.sin(t/1900+id);
          const R=20*S;
          g.globalCompositeOperation='lighter';
          const rad=g.createRadialGradient(ax,ay,2,ax,ay,R);
          rad.addColorStop(0,`rgba(255,226,150,${0.18*bell})`);
          rad.addColorStop(1,'rgba(255,226,150,0)');
          g.fillStyle=rad;
          g.beginPath(); g.arc(ax,ay,R,0,7); g.fill();
          g.globalCompositeOperation='source-over';
          break;
        }
        case 'pennants': {
          // bunte Wimpel entlang der Markise
          const cols=['#d9704f','#e8c15a','#7ec96b','#6fa8dc'];
          for(let k=0;k<4;k++){
            const px=ax-bw*0.27+k*bw*0.18, py=ay+Math.sin(k*1.3)*2*S;
            const w=Math.sin(t/380+k*1.7)*1.6*S;
            g.fillStyle=cols[k];
            g.beginPath();
            g.moveTo(px,py); g.lineTo(px+5*S+w,py+2.4*S); g.lineTo(px,py+5*S);
            g.closePath(); g.fill();
          }
          break;
        }
        default: break;
      }
    }
  }
  drawFlag(g, m, game, i){
    let [x,y]=this.doorVisualPos(i);   // Türfahnen stehen direkt am Eingang
    y-=this.liftAt(i)*HSCALE;          // auf angehobenem Fels (G1)
    const pl=m.owner[i];
    this.shadow(g,x+1,y+1.4,4,1.6,0.28);
    // Mast (etwas kleiner, damit er die Figuren nicht überragt)
    g.strokeStyle='#3d2c18'; g.lineWidth=2.2;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-15); g.stroke();
    g.strokeStyle='#7a5b35'; g.lineWidth=1;
    g.beginPath(); g.moveTo(x-0.5,y-1); g.lineTo(x-0.5,y-14); g.stroke();
    g.fillStyle='#c9a05a'; g.beginPath(); g.arc(x,y-15.5,1.4,0,7); g.fill();
    // wehender Ritter-Wimpel mit Schwalbenschwanz
    const col=pl>=0?PLAYER_COLORS[pl]:'#999';
    const w1=Math.sin(this.time/260+i)*1.4, w2=Math.sin(this.time/260+i+1.4)*2;
    g.fillStyle=col;
    g.beginPath();
    g.moveTo(x,y-15);
    g.quadraticCurveTo(x+5.5,y-15.8+w1, x+11,y-13.8+w2);
    g.lineTo(x+7.5,y-12.2+w2*0.8);
    g.lineTo(x+11,y-10.2+w2*0.7);
    g.quadraticCurveTo(x+5.5,y-11.3+w1, x,y-9.4);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(30,20,10,0.5)'; g.lineWidth=0.9; g.stroke();
    g.fillStyle='rgba(255,255,255,0.25)';
    g.beginPath();
    g.moveTo(x,y-15); g.quadraticCurveTo(x+5.5,y-15.8+w1, x+11,y-13.8+w2);
    g.lineTo(x+10.2,y-13+w2); g.quadraticCurveTo(x+5,y-14.6+w1,x,y-13.7);
    g.closePath(); g.fill();
    // wartende Waren als kleiner Stapel (Bild-Assets, sonst Kistchen)
    const items=game.flagItems.get(i);
    if(items && items.length){
      for(let k=0;k<Math.min(items.length,8);k++){
        const bx=x-7+(k%4)*5.6, by=y+4.4+Math.floor(k/4)*5;
        this.drawGood(g, items[k].good, bx, by, 7.4);
      }
    }
  }
  // ---------- Kampf- und Zerstörungseffekte (game.fx, rein kosmetisch) ----------
  drawFx(g, game){
    if(!game.fx || !game.fx.length) return;
    const m=game.map;
    for(const f of game.fx){
      const age=game.t - f.t0;
      // Gefallener: die Figur sackt zusammen und bleibt kurz liegen
      if(f.type==='fallen'){
        const DUR=14;
        if(age>DUR+42) continue;
        const prog=Math.min(1, age/DUR);
        g.globalAlpha= age>DUR+22 ? Math.max(0, 1-(age-DUR-22)/20) : 1;
        this._animSeed=(f.x|0)*0.7;
        this.drawFigure(g, f.x, f.y, f.player, null, 'soldier', f.stype||'sword',
          null, null, null, false, {set:'die', prog});
        g.globalAlpha=1;
        continue;
      }
      // Jubel der Sieger vor dem eroberten Gebäude
      if(f.type==='cheer'){
        if(age>34) continue;
        g.globalAlpha= age>26 ? Math.max(0,1-(age-26)/8) : 1;
        this._animSeed=(f.x|0)*1.3;
        this.drawFigure(g, f.x, f.y, f.player, null, 'soldier', f.stype||'sword',
          null, null, null, false, {set:'cheer'});
        g.globalAlpha=1;
        continue;
      }
      if(f.type==='arrow'){
        const DUR=8;                       // Flugticks
        if(age>DUR+30) continue;
        const t=Math.min(1, age/DUR);
        const dx=f.x1-f.x0, dy=f.y1-f.y0;
        const dist=Math.hypot(dx,dy);
        const arc=Math.min(26, dist*0.22+6);
        const px=f.x0+dx*t, py=f.y0+dy*t - Math.sin(t*Math.PI)*arc;
        // Flugrichtung inkl. Bogen
        const vx=dx/Math.max(1,dist), vy=dy/Math.max(1,dist) - Math.cos(t*Math.PI)*arc*Math.PI/Math.max(1,dist);
        const a=Math.atan2(vy,vx);
        const fade= age<=DUR ? 1 : (f.hit ? 0 : Math.max(0, 1-(age-DUR)/30));
        if(fade<=0) continue;
        g.save();
        g.translate(px,py); g.rotate(a);
        g.globalAlpha=fade;
        const ai=this.asset('fx_arrow');
        if(ai){
          const hh=6, ww=hh*(ai.naturalWidth/ai.naturalHeight);
          g.drawImage(ai, -ww/2, -hh/2, ww, hh);
        } else {
          g.strokeStyle='#6d4f2e'; g.lineWidth=1.1;
          g.beginPath(); g.moveTo(-5,0); g.lineTo(3.6,0); g.stroke();
          g.fillStyle='#b8bfc7';
          g.beginPath(); g.moveTo(5.4,0); g.lineTo(3,-1.2); g.lineTo(3,1.2); g.closePath(); g.fill();
          g.strokeStyle='#d8cfa8'; g.lineWidth=0.9;
          g.beginPath(); g.moveTo(-5,0); g.lineTo(-6.6,-1.4); g.moveTo(-5,0); g.lineTo(-6.8,0.2); g.stroke();
        }
        g.restore();
        g.globalAlpha=1;
      } else if(f.type==='dust'){
        // Staubwölkchen bei jedem Hammerschlag auf der Baustelle
        if(age>16) continue;
        const t=age/16;
        const di=this.asset('fx_smoke');
        if(di){
          const hh=(9+t*15), ww=hh*(di.naturalWidth/di.naturalHeight);
          g.globalAlpha=(1-t)*0.5;
          g.drawImage(di, f.x-ww/2, f.y-hh*0.85-t*5, ww, hh);
          g.globalAlpha=1;
        } else {
          g.globalAlpha=(1-t)*0.45;
          g.fillStyle='#c3b49a';
          for(let k=0;k<4;k++){
            const an=k*1.6+(f.t0%6);
            const r=2+t*9;
            g.beginPath();
            g.arc(f.x+Math.cos(an)*r, f.y-t*6+Math.sin(an)*r*0.4, 1.8+t*2.6, 0, 7);
            g.fill();
          }
          g.globalAlpha=1;
        }
      } else if(f.type==='impact'){
        if(age>18) continue;
        const t=age/18;
        const di=this.asset('fx_impact');
        if(di){
          const hh=(16+t*30), ww=hh*(di.naturalWidth/di.naturalHeight);
          g.globalAlpha=(1-t)*0.85;
          g.drawImage(di, f.x-ww/2, f.y-hh*0.7, ww, hh);
          g.globalAlpha=1;
        } else {
          g.globalAlpha=(1-t)*0.5;
          g.fillStyle='#b8a98e';
          for(let k=0;k<7;k++){
            const an=k*0.9+(f.t0%7);
            const r=4+t*17;
            g.beginPath();
            g.arc(f.x+Math.cos(an)*r, f.y+Math.sin(an)*r*0.5, 2.4+t*3.4, 0, 7);
            g.fill();
          }
          g.globalAlpha=1;
        }
      } else if(f.type==='splash'){
        if(age>14) continue;
        const t=age/14;
        const si=this.asset('fx_splash');
        if(si){
          const hh=(9+t*13), ww=hh*(si.naturalWidth/si.naturalHeight);
          g.globalAlpha=(1-t)*0.9;
          g.drawImage(si, f.x-ww/2, f.y-hh, ww, hh);
          g.globalAlpha=1;
        } else {
          g.strokeStyle=`rgba(220,240,255,${(1-t)*0.7})`; g.lineWidth=1.4;
          g.beginPath(); g.ellipse(f.x,f.y,3+t*9,1.4+t*3.4,0,0,7); g.stroke();
        }
      } else if(f.type==='burn'){
        if(age>300) continue;
        const [x,y]=m.worldPos(f.node);
        const w=f.big?30:20;
        const heat=Math.max(0, 1-age/160);          // Flammen klingen ab
        const sm=Math.max(0, 1-age/300);            // Rauch hält länger
        // Glutschein
        if(heat>0){
          const rad=g.createRadialGradient(x,y-6,2,x,y-6,w+16);
          rad.addColorStop(0,`rgba(255,150,40,${0.26*heat})`);
          rad.addColorStop(1,'rgba(255,120,30,0)');
          g.fillStyle=rad;
          g.beginPath(); g.arc(x,y-6,w+16,0,7); g.fill();
          // Flammenzungen (flackern)
          for(let k=0;k<6;k++){
            const fx3=x+(k-2.5)*w*0.32 + Math.sin(this.time/90+k*2.4)*2.2;
            const hh=(10+((k*37)%9)) * heat * (0.75+0.25*Math.sin(this.time/70+k));
            const grd=g.createLinearGradient(fx3,y+2,fx3,y-hh-8);
            grd.addColorStop(0,`rgba(255,196,80,${0.85*heat})`);
            grd.addColorStop(0.55,`rgba(232,110,38,${0.7*heat})`);
            grd.addColorStop(1,'rgba(160,40,20,0)');
            g.fillStyle=grd;
            g.beginPath();
            g.moveTo(fx3-3.4,y+2);
            g.quadraticCurveTo(fx3-4,y-hh*0.45, fx3+Math.sin(this.time/80+k)*3, y-hh-6);
            g.quadraticCurveTo(fx3+4,y-hh*0.45, fx3+3.4,y+2);
            g.closePath(); g.fill();
          }
          // Funken: Bild-Effekt (Funkenschauer) oder Punkte
          const sp2=this.asset('fx_sparks');
          if(sp2){
            const fl=0.6+0.4*Math.sin(this.time/120+f.node);
            const hh=w*1.3, ww=hh*(sp2.naturalWidth/sp2.naturalHeight);
            g.globalAlpha=heat*fl*0.85;
            g.drawImage(sp2, x-ww/2, y-hh+2, ww, hh);
            g.globalAlpha=1;
          } else for(let k=0;k<4;k++){
            const ph=(this.time/700+k*0.31)%1;
            g.fillStyle=`rgba(255,190,90,${(1-ph)*heat})`;
            g.beginPath();
            g.arc(x+Math.sin(this.time/210+k*5)*w*0.4, y-4-ph*30, 1.1, 0, 7);
            g.fill();
          }
        }
        // dunkler Qualm: Bild-Rauchsäule (mehrfach, aufsteigend) oder Kreise
        const smi=this.asset('fx_smoke');
        if(smi){
          for(let k=0;k<3;k++){
            const ph=(this.time/2400 + k*0.33 + f.node%7*0.1)%1;
            const hh=26+ph*44, ww=hh*(smi.naturalWidth/smi.naturalHeight);
            const drift=Math.sin(this.time/1100+k*2.1)*8;
            g.globalAlpha=0.5*(1-ph)*sm;
            g.drawImage(smi, x-ww/2+drift*ph+(k-1)*4, y-10-ph*52-hh, ww, hh);
          }
          g.globalAlpha=1;
        } else for(let k=0;k<5;k++){
          const ph=(this.time/1400 + k*0.23 + f.node%5*0.13)%1;
          const drift=Math.sin(this.time/900+k*2.2)*7;
          g.fillStyle=`rgba(52,48,44,${0.34*(1-ph)*sm})`;
          g.beginPath();
          g.arc(x+(k-2)*5+drift*ph, y-12-ph*46, 4+ph*10, 0, 7);
          g.fill();
        }
      }
    }
  }
  // Lokales Ausweichen der Figuren: wer läuft und eine andere Figur dicht
  // voraus hat, versetzt sich leicht nach RECHTS (quer zur Laufrichtung) -
  // zwei Entgegenkommende weichen so automatisch auf verschiedene Seiten
  // aus, wie Fußgänger. KEIN Pfadfinden, kein Eingriff in die Simulation:
  // der Versatz existiert nur im Bild und klingt weich wieder ab.
  // Abstandsgitter hält den Paarvergleich billig (typisch <100 Figuren).
  dodgePass(figs, dtMs){
    const R=16, A=7.5;                          // Sichtradius / max. Versatz (px)
    const sm=1-Math.pow(0.82, (dtMs||16.7)/16.7);   // ~18 % Annäherung je 60-Hz-Bild
    const grid=new Map();
    const cell=(x,y)=> ((x/16)|0)*100003 + ((y/16)|0);
    for(const f of figs){
      f._tx=0; f._ty=0;
      const k=cell(f.x,f.y);
      let b=grid.get(k); if(!b){ b=[]; grid.set(k,b); }
      b.push(f);
    }
    for(const f of figs){
      const dl=f.dx!==undefined? Math.hypot(f.dx,f.dy) : 0;
      if(!(f.mov && dl>0.01)) continue;
      const nx=f.dx/dl, ny=f.dy/dl;
      const gx=(f.x/16)|0, gy=(f.y/16)|0;
      outer:
      for(let cy=gy-1;cy<=gy+1;cy++) for(let cx=gx-1;cx<=gx+1;cx++){
        const b=grid.get(cx*100003+cy);
        if(!b) continue;
        for(const q of b){
          if(q===f || q.o===f.o) continue;
          const rx=q.x-f.x, ry=q.y-f.y;
          const d=Math.hypot(rx,ry);
          if(d>=R) continue;
          if(rx*nx+ry*ny < -4) continue;         // deutlich hinter mir: egal
          const w=1-d/R;
          f._tx+=-ny*w; f._ty+=nx*w;             // Läufer weicht nach rechts aus
          // Wer STEHT (Bauarbeiter beim Hämmern, Planierer beim Graben),
          // macht dem Läufer zur Gegenseite hin Platz - vorher liefen
          // Träger mitten durch stehende Figuren hindurch.
          if(!q.mov){ q._tx+=ny*w; q._ty+=-nx*w; }
          if(Math.hypot(f._tx,f._ty)>1.5) break outer;   // reicht - früh abbrechen
        }
      }
    }
    for(const f of figs){
      let tx=f._tx, ty=f._ty;
      const l=Math.hypot(tx,ty);
      if(l>1){ tx/=l; ty/=l; }
      // Stehende lehnen sich nur beiseite (halber Weg), Läufer gehen ganz vorbei
      const amp=f.mov? A : A*0.45;
      tx*=amp; ty*=amp;
      const o=f.o;
      o._doX=(o._doX||0)+(tx-(o._doX||0))*sm;
      o._doY=(o._doY||0)+(ty-(o._doY||0))*sm;
    }
  }
  drawUnit(g,u){
    // Zwischen zwei Sim-Takten überblenden: die Simulation springt nur alle
    // 100 ms, gezeichnet wird mit jedem Bild. Ohne die Überblendung ruckeln
    // alle Figuren im Takt - bei gemächlichem Tempo besonders sichtbar.
    // Der Ausweich-Versatz (dodgePass) kommt oben drauf - NACH der
    // Überblendung, damit er das Takt-Lerp nicht verfälscht.
    const a=this.game.lerpA? this.game.lerpA() : 1;
    let ox=(u._px!==undefined)? (u._px+(u.x-u._px)*a)-u.x : 0;
    let oy=(u._py!==undefined)? (u._py+(u.y-u._py)*a)-u.y : 0;
    ox+=u._doX||0; oy+=u._doY||0;
    if(Math.abs(ox)>0.01 || Math.abs(oy)>0.01){
      g.save(); g.translate(ox,oy);
      this.drawUnitRaw(g,u);
      g.restore();
      return;
    }
    this.drawUnitRaw(g,u);
  }
  drawUnitRaw(g,u){
    if(u.type==='boulder'){
      this.shadow(g,u.x,(u.sy??u.y)+40,6,2.4,0.25);
      const bi=this.asset('fx_boulder');
      if(bi){
        // Geschoss mit Staubschweif, in Flugrichtung gedreht
        const ang=Math.atan2((u.ty-u.sy), (u.tx-u.sx));
        g.save();
        g.translate(u.x,u.y); g.rotate(ang+Math.PI);
        const hh=12, ww=hh*(bi.naturalWidth/bi.naturalHeight);
        g.drawImage(bi, -ww*0.3, -hh/2, ww, hh);
        g.restore();
        return;
      }
      // unregelmäßiger, rotierender Felsbrocken
      g.save();
      g.translate(u.x,u.y); g.rotate((u.prog||0)*9);
      g.fillStyle='#57534c';
      g.beginPath();
      g.moveTo(-5,-1.5); g.lineTo(-2.5,-4.6); g.lineTo(2.2,-4.2); g.lineTo(5.1,-0.8);
      g.lineTo(3.6,3.8); g.lineTo(-1.8,4.9); g.lineTo(-4.6,2.2);
      g.closePath(); g.fill();
      g.strokeStyle='rgba(20,16,12,0.5)'; g.lineWidth=0.9; g.stroke();
      g.fillStyle='rgba(255,255,255,0.22)';
      g.beginPath(); g.moveTo(-3.6,-1.4); g.lineTo(-1.6,-3.6); g.lineTo(1.4,-3.2); g.lineTo(-0.6,-0.8); g.closePath(); g.fill();
      g.restore();
      return;
    }
    const udir=u._dx!==undefined?[u._dx,u._dy]:null;
    if(u.type==='attack'){
      const fighting=u.state==='fight';
      // frischer Treffer: die Gruppe zuckt kurz zurück
      const age=this.game.t-(u.hitT??-999);
      const act= age>=0 && age<9 ? {set:'hit', prog:age/9} : null;
      u.soldiers.forEach((r,k)=>{
        this.drawFigure(g, u.x+(k%3)*9-9, u.y+Math.floor(k/3)*6.4, u.player, null, 'soldier', r,
          null, fighting ? k*1.9 : null, udir, !!u._mov, act);
      });
      return;
    }
    if(u.type==='soldierMove'){ this.drawFigure(g,u.x,u.y,u.player,null,'soldier',u.stype||'sword',null,null,udir,!!u._mov); return; }
    if(u.type==='geo'){
      // beim Proben schlägt er mit der Spitzhacke auf den Fels. Maßgeblich
      // ist der SIM-Zustand, nicht die Bewegungserkennung: die läuft nach
      // dem Ankommen noch kurz nach und zeigte solange Marschieren.
      const picking = u.state==='probe';
      this.drawFigure(g,u.x,u.y,u.player,null,'worker',0,'geo', picking?(u.id%5):null, udir,!!u._mov);
      return;
    }
    if(u.type==='settle'||u.type==='flee'){
      // Flüchtende laufen vornübergebeugt und schneller
      const act= u.type==='flee' ? {set:'flee'} : null;
      this.drawFigure(g,u.x,u.y,u.player,null,'worker',0,u.wtype||'worker',null,udir,!!u._mov,act);
      return;
    }
    if(u.type==='scout'){ this.drawFigure(g,u.x,u.y,u.player,null,'worker',0,'scout',null,udir,!!u._mov); return; }
    if(u.type==='leveler'){
      // beim Ebnen die gebackene Schaufel-Geste spielen. atSpot ist der
      // Sim-Zustand "steht und gräbt" - er schaltet die Geste sofort ein,
      // während die Bewegungserkennung (_mov) noch ~250 ms nachliefe.
      const lw= u.state==='work' && u.atSpot && this.asset('unit_leveler_atk');
      this.drawFigure(g,u.x,u.y,u.player,null,'worker',0,'leveler', lw? (u.id%5):null, udir,!!u._mov);
      // Schaufel-Overlay nur für die Prozeduralfigur (GLB-Modell bringt sie mit)
      if(!this.asset('unit_leveler_walk')){
        const dig= u.state==='work' ? Math.sin(this.time/160+u.id)*0.5 : 0.2;
        g.save();
        g.translate(u.x+6,u.y-5); g.rotate(dig);
        g.strokeStyle='#8a6b43'; g.lineWidth=1.5;
        g.beginPath(); g.moveTo(0,4); g.lineTo(0,-6); g.stroke();
        g.fillStyle='#9aa0a8';
        g.beginPath(); g.moveTo(-2.2,4); g.lineTo(2.2,4); g.lineTo(1.6,8.4); g.lineTo(-1.6,8.4); g.closePath(); g.fill();
        g.restore();
      }
      return;
    }
    if(u.type==='donkey'){ this.drawDonkey(g,u.x,u.y,udir,!!u._mov); return; }
    if(u.type==='builder'){
      // beim Hämmern die gebackene Arbeitsgeste nutzen (fight-Kanal = Arbeitszyklus)
      const working=u.state==='work' && u.atSpot && this.asset('unit_builder_atk');
      this.drawFigure(g,u.x,u.y,u.player,null,'worker',0,'builder', working? (u.id%5):null, udir,!!u._mov);
      // Hammer-Overlay nur für die Prozeduralfigur (GLB-Modell bringt ihn mit)
      if(!this.asset('unit_builder_walk')){
        const swing= u.state==='work' ? Math.sin(this.time/110+u.id)*0.9 : 0.35;
        g.save();
        g.translate(u.x+6,u.y-7);
        g.rotate(swing);
        g.strokeStyle='#7a5b35'; g.lineWidth=1.6;
        g.beginPath(); g.moveTo(0,4); g.lineTo(0,-5); g.stroke();
        g.fillStyle='#8a8f96';
        g.fillRect(-3,-8,6,3.4);
        g.restore();
      }
      return;
    }
    // Sammel-Arbeiter: am Ziel die gebackene Arbeitsgeste spielen (Hacken, Netz, Sense ...)
    const acting=u.type==='worker' && u.state==='act' && this.asset('unit_'+u.wtype+'_atk');
    this.drawFigure(g, u.x, u.y, u.player, u.carry||null, 'worker', 0, u.wtype, acting?(u.id%5):null, udir, !!u._mov);
  }
  // Erzschild des Geologen (Holzpfahl mit Symbolscheibe)
  drawSign(g, m, i, ore){
    let [x,y]=m.worldPos(i);
    y-=this.liftAt(i)*HSCALE;   // steht auf dem ANGEHOBENEN Fels (G1)
    // Asset-Überschreibung: sign_none/coal/iron/gold/granite.png
    const ovS=this.asset('sign_'+(['none','coal','iron','gold','granite'][ore]||'none'));
    if(ovS){
      this.shadow(g,x+1,y+1.4,5,1.8,0.25);
      const hh=30, ww=hh*(ovS.naturalWidth/ovS.naturalHeight);
      g.drawImage(ovS, x-ww/2, y+3-hh, ww, hh);
      return;
    }
    this.shadow(g,x+1,y+1.4,4,1.6,0.25);
    g.strokeStyle='#5d452a'; g.lineWidth=2.2;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x,y-12); g.stroke();
    g.fillStyle='#c9a05a';
    g.beginPath(); g.arc(x,y-14.5,5,0,7); g.fill();
    g.strokeStyle='rgba(60,40,20,0.6)'; g.lineWidth=1.2; g.stroke();
    const oc=['#a8a29a','#31312e','#b3705a','#e8c258','#84807a'][ore]||'#a8a29a';
    if(ore===0){
      g.strokeStyle='#8a8478'; g.lineWidth=1.6;
      g.beginPath(); g.moveTo(x-2.4,y-14.5); g.lineTo(x+2.4,y-14.5); g.stroke();
    } else {
      g.fillStyle=oc;
      g.beginPath(); g.arc(x,y-14.5,2.8,0,7); g.fill();
      g.fillStyle='rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(x-0.9,y-15.3,1,0,7); g.fill();
    }
  }
  // Frame einer gebackenen 3D-Animation wählen (oder null, wenn keine existiert).
  // Frames liegen als Spritesheet: Spalten = Frames, Zeilen = Richtungen (r,fr,f,br,b).
  // act: {set:'hit'|'die'|'flee'|'cheer', prog:0..1} überschreibt die Auswahl
  animFrame(baseKey, dir, mov, fight=null, act=null){
    // Blickrichtung in 8 Sektoren; linke Hälfte wird gespiegelt.
    // Mit Hysterese je Figur (Sektor/Spiegel wechseln erst bei klarem Abstand,
    // sonst flackert die Ansicht an den Sektorgrenzen)
    if(!this._dirHyst) this._dirHyst=new Map();
    if(this._dirHyst.size>4000) this._dirHyst.clear();
    const hkey=(this._animSeed||0)+'|'+baseKey;
    const st=this._dirHyst.get(hkey);
    let dirKey='r', flip=false;
    if(dir && (Math.abs(dir[0])>0.01 || Math.abs(dir[1])>0.01)){
      let fx=dir[0];
      if(fx<0){ flip=true; fx=-fx; }
      // schwache Horizontalkomponente: Spiegelung vom letzten Mal behalten
      if(st && Math.abs(dir[0])<0.15*Math.abs(dir[1])) flip=st.flip;
      const ang=Math.atan2(dir[1], fx)*180/Math.PI;   // -90..90 (0 = rechts, + = abwärts)
      dirKey= ang>67.5?'f' : ang>22.5?'fr' : ang>-22.5?'r' : ang>-67.5?'br' : 'b';
      // Sektor-Hysterese: alten Sektor behalten, solange der Winkel nahe dran ist
      if(st && st.dirKey!==dirKey && st.flip===flip){
        const RANGE={f:[67.5,90.01], fr:[22.5,67.5], r:[-22.5,22.5], br:[-67.5,-22.5], b:[-90.01,-67.5]};
        const old=RANGE[st.dirKey];
        if(old && ang>old[0]-9 && ang<old[1]+9) dirKey=st.dirKey;
      }
      if(dirKey==='f'||dirKey==='b') flip=false;      // frontal/Rücken sind symmetrisch
      this._dirHyst.set(hkey,{dirKey,flip});
    } else if(st){
      // stehend: zuletzt gelaufene Richtung beibehalten
      dirKey=st.dirKey; flip=st.flip;
    }
    const COLS={ walk:12, idle:12, atk:8, hit:8, die:10, flee:12, cheer:12 };
    let set= (act && this.asset(baseKey+'_'+act.set)) ? act.set
      : fight!=null && this.asset(baseKey+'_atk') ? 'atk'
      : mov? 'walk' : (this.asset(baseKey+'_idle')? 'idle':'walk');
    let img=this.asset(baseKey+'_'+set);
    if(!img && set!=='walk'){ set='walk'; img=this.asset(baseKey+'_walk'); }
    if(!img) return null;
    const n=COLS[set];
    const row={r:0, fr:1, f:2, br:3, b:4}[dirKey]||0;
    let k;
    if(set==='hit' || set==='die'){
      // Einmalclips laufen über den übergebenen Fortschritt; Sterben bleibt
      // auf dem letzten Bild liegen
      const pr=Math.max(0, Math.min(0.999, (act&&act.prog)||0));
      k= set==='die' ? Math.min(n-1, Math.floor(pr*n)) : Math.floor(pr*n)%n;
    } else if(set==='flee'){
      k=Math.floor(this.time/46 + (this._animSeed||0))%n;   // schneller = Rennen
    } else if(set==='cheer'){
      k=Math.floor(this.time/95 + (this._animSeed||0))%n;
    } else if(set==='walk'){
      // 12 Frames -> kürzere Frame-Zeit, damit der Schritt flüssig bleibt.
      // OHNE Bewegung (Lauf-Set nur als Rückfall, weil kein Warte-Set da
      // ist) wird Frame 0 eingefroren - niemand marschiert auf der Stelle.
      k= mov ? Math.floor(this.time/62 + (this._animSeed||0))%n : 0;
    } else if(set==='atk'){
      // Arbeitstakt je Beruf: schwere Schläge langsamer als flinkes Hämmern;
      // der Fischer wirft aus und HÄLT dann die Rute (deshalb am längsten).
      // Der Kontaktmoment liegt bei allen fest auf Spalte 4 - Frame-Dauer
      // ändern verschiebt ihn nicht, nur das Tempo.
      const ATK_MS={ unit_fisher:240, unit_farm:135, unit_woodcutter:115,
        unit_leveler:125, unit_quarry:100, unit_builder:95, unit_geo:120,
        unit_miner:110 };
      k=Math.floor(this.time/(ATK_MS[baseKey]||85) + (fight||0)*2.1)%n;
    } else {
      // Warten mit Leben: meist ruhige Grundpose, alle paar Sekunden eine
      // Geste (Fußtippen, Umschauen, Recken – aus dem Warte-Clip)
      const T=this.time/1000 + (this._animSeed||0)*0.7;
      const cyc=T%7.5;
      if(cyc<3.0) k=Math.floor(cyc/3.0*n)%n;   // Geste: Clip einmal durchspielen
      else k=0;                                 // ruhig stehen
    }
    const sw=img.naturalWidth/n, sh=img.naturalHeight/5;
    return {img, sx:k*sw, sy:row*sh, sw, sh, flip, set};
  }
  // Esel: kleines Packtier (Bild-Asset unit_donkey oder prozedural)
  drawDonkey(g,x,y,dir,mov){
    // gebackene GLB-Animation zuerst (Spritesheet), sonst Bild/prozedural
    const anim=this.animFrame('unit_donkey', dir, mov);
    if(anim){
      this.shadow(g,x+1,y+5.4,7,2.4,0.24);
      const hh=20, ww=hh*(anim.sw/anim.sh);
      g.save();
      g.translate(x, y+5+hh*0.04);
      if(anim.flip) g.scale(-1,1);
      g.drawImage(anim.img, anim.sx, anim.sy, anim.sw, anim.sh, -ww/2, -hh, ww, hh);
      g.restore();
      return;
    }
    const ov=this.asset('unit_donkey');
    this.shadow(g,x+1,y+5.4,7,2.4,0.24);
    const flip=dir && dir[0]<-0.05;
    g.save();
    g.translate(x,y+5);
    if(flip) g.scale(-1,1);
    if(ov){
      const hh=17, ww=hh*(ov.naturalWidth/ov.naturalHeight);
      g.drawImage(ov,-ww/2,-hh,ww,hh);
    } else {
      const step=mov? Math.sin(this.time/110+x*0.2)*1.6 : 0;
      g.strokeStyle='#5d5248'; g.lineWidth=1.6;
      g.beginPath();
      g.moveTo(-4,-3); g.lineTo(-4+step,1.6);
      g.moveTo(4,-3); g.lineTo(4-step,1.6);
      g.stroke();
      g.fillStyle='#8a7a66';
      g.beginPath(); g.ellipse(0,-5.4,6.4,3.4,0,0,7); g.fill();
      g.strokeStyle='rgba(50,40,30,0.5)'; g.lineWidth=0.9; g.stroke();
      // Kopf + lange Ohren
      g.beginPath(); g.ellipse(6.6,-8,2.6,2,0.3,0,7); g.fillStyle='#8a7a66'; g.fill();
      g.strokeStyle='#6d5f4e'; g.lineWidth=1.3;
      g.beginPath(); g.moveTo(6,-9.6); g.lineTo(5.2,-12.6); g.moveTo(7.6,-9.4); g.lineTo(7.6,-12.4); g.stroke();
      // Packtaschen
      g.fillStyle='#a3814e';
      g.fillRect(-3.4,-8.6,3.2,3.6); g.fillRect(0.6,-8.6,3.2,3.6);
      g.strokeStyle='rgba(60,45,25,0.6)'; g.lineWidth=0.8;
      g.strokeRect(-3.4,-8.6,3.2,3.6); g.strokeRect(0.6,-8.6,3.2,3.6);
    }
    g.restore();
  }
  // Handelsschiff auf dem Seeweg
  drawShip(g,x,y,pl,dir,carrying){
    const bob=Math.sin(this.time/700+x*0.05)*1.2;
    const ovShip=this.asset('unit_ship');
    if(ovShip){
      // neues Cartoon-Handelsschiff (Bild blickt nach links) + Spielerwimpel am Mast
      const flip=dir && dir[0]>0.05;
      this.shadow(g,x,y+6,13,3.4,0.22);
      g.save();
      g.translate(x,y+bob);
      g.strokeStyle='rgba(235,245,250,0.4)'; g.lineWidth=1.2;
      g.beginPath(); g.moveTo(-14,5); g.quadraticCurveTo(-9,6.6,-5,5.6); g.stroke();
      if(flip) g.scale(-1,1);
      const hh=38, ww=hh*(ovShip.naturalWidth/ovShip.naturalHeight);
      g.drawImage(ovShip, -ww/2, 6-hh, ww, hh);
      const col=PLAYER_COLORS[pl]||'#888';
      g.fillStyle=col;
      g.beginPath(); g.moveTo(0.5,-hh+7); g.lineTo(7.5,-hh+9.4); g.lineTo(0.5,-hh+11.6); g.closePath(); g.fill();
      g.restore();
      return;
    }
    const flip=dir && dir[0]<-0.05;
    this.shadow(g,x,y+6,11,3,0.2);
    g.save();
    g.translate(x,y+bob);
    if(flip) g.scale(-1,1);
    // Kielwasser
    g.strokeStyle='rgba(235,245,250,0.4)'; g.lineWidth=1.2;
    g.beginPath(); g.moveTo(-13,5); g.quadraticCurveTo(-9,6.4,-6,5.4); g.stroke();
    // Rumpf
    g.fillStyle='#6d4f2e';
    g.beginPath();
    g.moveTo(-10,1); g.quadraticCurveTo(0,7.4,10,1);
    g.lineTo(7.4,-2.6); g.lineTo(-7.4,-2.6);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(40,26,12,0.6)'; g.lineWidth=1; g.stroke();
    g.strokeStyle='rgba(220,195,150,0.4)';
    g.beginPath(); g.moveTo(-8,-0.6); g.quadraticCurveTo(0,4,8,-0.6); g.stroke();
    // Mast + Segel mit Spielerfarbe
    g.strokeStyle='#4a3826'; g.lineWidth=1.6;
    g.beginPath(); g.moveTo(0,-2.6); g.lineTo(0,-16); g.stroke();
    const col=PLAYER_COLORS[pl]||'#888';
    g.fillStyle='#efe6d2';
    g.beginPath();
    g.moveTo(0.8,-15); g.quadraticCurveTo(8.4,-11,0.8,-4);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(60,45,25,0.5)'; g.lineWidth=0.9; g.stroke();
    g.fillStyle=col;
    g.beginPath(); g.moveTo(0.8,-11.6); g.quadraticCurveTo(5,-9.8,0.8,-7.4); g.closePath(); g.fill();
    // Ladung
    if(carrying){
      g.fillStyle='#a3814e'; g.fillRect(-5.4,-6,4,3.4);
      g.strokeStyle='rgba(50,35,18,0.6)'; g.lineWidth=0.8; g.strokeRect(-5.4,-6,4,3.4);
    }
    g.restore();
  }
  // getragene Ware: Bild-Asset (good_<ware>) oder farbiges Kistchen
  drawGood(g, good, x, y, h=6.8){
    const gi=this.asset('good_'+good);
    if(gi){
      const ww=h*(gi.naturalWidth/gi.naturalHeight);
      g.drawImage(gi, x-ww/2, y-h/2, ww, h);
    } else {
      g.fillStyle=goodColor(good);
      g.fillRect(x-h/2,y-h/2,h,h*0.8);
      g.strokeStyle='rgba(20,15,10,0.5)'; g.lineWidth=0.9; g.strokeRect(x-h/2,y-h/2,h,h*0.8);
    }
  }
  // kind 'soldier': rank trägt den Truppentyp ('sword'|'spear'|'bow'),
  // fight!==null aktiviert die Kampfpose (Wert = Phasenversatz der Figur)
  // dir=[dx,dy] Bewegungsrichtung, mov=true wenn die Figur gerade läuft
  drawFigure(g, x, y, pl, good, kind, rank=0, wtype=null, fight=null, dir=null, mov=false, act=null){
    // Asset-Überschreibung (Stilguide §14): unit_<typ>.png / unit_carrier.png / unit_soldier.png
    let baseKey= kind==='soldier'
      ? 'unit_'+(rank==='spear'||rank==='bow'?rank:'sword')
      : kind==='carrier' ? 'unit_carrier' : 'unit_'+(wtype||'worker');
    // Berufe ohne eigenes Bild nutzen den generischen Siedler
    if(kind==='worker' && !this.asset(baseKey) && !this.asset(baseKey+'_walk_r_0') && this.asset('unit_worker'))
      baseKey='unit_worker';
    // Gebackene 3D-Animation (aus GLB): unit_<typ>_walk/idle_<r|f|b>_<n>.png
    const anim=this.animFrame(baseKey, dir, mov, fight, act);
    if(anim){
      this.shadow(g,x,y+7.4,4.8,1.9,0.26);
      g.strokeStyle=PLAYER_COLORS[pl]||'#888';
      g.lineWidth=1.4; g.globalAlpha=0.8;
      g.beginPath(); g.ellipse(x,y+6.8,5,2,0,0,7); g.stroke();
      g.globalAlpha=1;
      // Größenanker: Figur ≈ halbe Wohnhaushöhe (klassische Lesbarkeit).
      // UNIT_FIT gleicht die je Blatt unterschiedliche Zell-Füllung aus:
      // s normiert die Körperhöhe auf den Träger, f die gemessene Restluft
      // unter den Füßen, damit die Figur exakt auf ihrem Schatten steht.
      const fit=UNIT_FIT[baseKey]||UNIT_FIT_DEF;
      const hh=30*fit.s, ww=hh*(anim.sw/anim.sh);
      g.save();
      // Wer etwas schleppt, beugt sich leicht nach vorn und wiegt sich
      // schwerer – Last soll man der Figur ansehen
      const heavy= good==='trunk'||good==='stone'||good==='board'||good==='pig';
      const load= good? (heavy?1:0.55) : 0;
      const bob= load? Math.sin(this.time/(heavy?260:210)+(this._animSeed||0))*load*0.7 : 0;
      g.translate(x, y+7.4+hh*fit.f+bob);
      if(anim.flip) g.scale(-1,1);
      if(load) g.rotate((anim.flip?-1:1)*0.045*load);
      g.drawImage(anim.img, anim.sx, anim.sy, anim.sw, anim.sh, -ww/2, -hh, ww, hh);
      // Eigenständiges Werkzeug (Spielerwunsch): das Arbeitsgerät liegt als
      // deckungsgleich gebackenes Overlay-Blatt über der Figur. Verdeckung
      // hinter dem Körper steckt bereits im Blatt (Tiefen-Pass beim Backen),
      // deshalb genügt hier einfaches Darüberzeichnen mit derselben Zelle.
      if(anim.set==='atk'){
        const tl=this.asset(baseKey+'_atk_tool');
        if(tl && tl.naturalWidth===anim.img.naturalWidth)
          g.drawImage(tl, anim.sx, anim.sy, anim.sw, anim.sh, -ww/2, -hh, ww, hh);
      }
      // Umhang/Helmbusch der Soldaten in Spielerfarbe einfärben
      if(kind==='soldier'){
        const mk=this.unitMask(anim.img);
        if(mk){
          const sc=this._tintScratch || (this._tintScratch=document.createElement('canvas'));
          if(sc.width!==anim.sw||sc.height!==anim.sh){ sc.width=anim.sw; sc.height=anim.sh; }
          const tc=sc.getContext('2d');
          tc.globalCompositeOperation='source-over';
          tc.clearRect(0,0,sc.width,sc.height);
          tc.drawImage(mk, anim.sx, anim.sy, anim.sw, anim.sh, 0,0, sc.width,sc.height);
          tc.globalCompositeOperation='multiply';
          tc.fillStyle=PLAYER_COLORS[pl]||'#888';
          tc.fillRect(0,0,sc.width,sc.height);
          tc.globalCompositeOperation='destination-in';
          tc.drawImage(mk, anim.sx, anim.sy, anim.sw, anim.sh, 0,0, sc.width,sc.height);
          tc.globalCompositeOperation='source-over';
          g.drawImage(sc, -ww/2, -hh, ww, hh);
        }
      }
      g.restore();
      if(good) this.drawGood(g, good, x, y-15.5, 11);   // auf Schulterhöhe, gut erkennbar
      return;
    }
    let ovU=this.asset(baseKey) || (kind==='soldier'?this.asset('unit_soldier'):null);
    let imgKey=baseKey;
    if(ovU){
      // Kampfpose des Schwertkämpfers: eigene Bild-Posen (Hieb, Sprung, Deckung)
      if(kind==='soldier' && fight!=null && baseKey==='unit_sword'){
        const pool=['unit_sword_atk','unit_sword_atk2','unit_sword_def'];
        const pi=Math.abs(Math.round(fight*3.1))%3;
        const pimg=this.asset(pool[pi]);
        if(pimg){ ovU=pimg; imgKey=pool[pi]; }
      }
      // Richtungsvarianten (falls vorhanden): unit_<typ>_up / _down; sonst Andeutung
      let vert=0;
      if(dir && Math.abs(dir[1])>Math.abs(dir[0])*1.6){
        const alt=this.asset(baseKey+(dir[1]<0?'_up':'_down'));
        if(alt){ ovU=alt; imgKey=baseKey; } else vert=dir[1]<0?-1:1;
      }
      // natürliche Blickrichtung des Bildes (die meisten schauen nach links)
      const face=UNIT_FACING[imgKey]??-1;
      // gespiegelt, wenn Laufrichtung und Bildrichtung nicht übereinstimmen
      const flip= dir && Math.abs(dir[0])>0.05 ? (dir[0]>0 ? face===-1 : face===1) : false;
      this.shadow(g,x,y+7.4,5.8,2.3,0.26);
      // Spielerfarb-Ring unter den Füßen (Bilder sind farbneutral)
      g.strokeStyle=PLAYER_COLORS[pl]||'#888';
      g.lineWidth=1.5; g.globalAlpha=0.8;
      g.beginPath(); g.ellipse(x,y+6.8,6,2.4,0,0,7); g.stroke();
      g.globalAlpha=1;
      const hh=34, ww=hh*(ovU.naturalWidth/ovU.naturalHeight);
      // Laufanimation: Wippen + leichtes Pendeln; im Kampf: Ausfallschritt
      const ph=this.time/95 + (x+y)*0.13;
      const bob=mov? Math.abs(Math.sin(ph))*1.6 : 0;
      const tilt=mov? Math.sin(ph)*0.055 : 0;
      const lunge=fight!=null? Math.max(0,Math.sin(this.time/140+fight))*2.4 : 0;
      g.save();
      g.translate(x+(flip?-lunge:lunge), y+7-bob);
      if(flip) g.scale(-1,1);
      if(vert) g.scale(0.9,1);              // frontal/rückwärtig angedeutet: schmaler
      g.rotate(tilt);
      g.drawImage(ovU, -ww/2, -hh, ww, hh);
      g.restore();
      if(good) this.drawGood(g, good, x, y-16, 11);
      return;
    }
    const col=PLAYER_COLORS[pl]||'#888';
    // Berufs-Ausstattung: Kleidung, Kopfbedeckung, Werkzeug
    const PRO={
      geo:       {tunic:'#7d5a6b', hat:'band',    hatC:'#5a4050', tool:'pick'},
      woodcutter:{tunic:'#8a6242', hat:'cap',     hatC:'#6d4f2e', tool:'axe'},
      forester:  {tunic:'#4e7d48', hat:'cap',     hatC:'#3d6338', tool:'sapling'},
      quarry:    {tunic:'#7d7a72', hat:'band',    hatC:'#5d5a52', tool:'pick'},
      fisher:    {tunic:'#4e6d8a', hat:'straw',   hatC:'#d9bb7d', tool:'rod'},
      hunter:    {tunic:'#5d6b42', hat:'feather', hatC:'#4a5636', tool:'bow'},
      farm:      {tunic:'#a3814e', hat:'straw',   hatC:'#d9bb7d', tool:'scythe'},
      scout:     {tunic:'#6b5d3f', hat:'feather', hatC:'#54482f', tool:null},
      leveler:   {tunic:'#7a6a4f', hat:'band',    hatC:'#5d5040', tool:null},
      builder:   {tunic:'#8a7355', hat:'cap',     hatC:'#6d5940', tool:null},
      smith:     {tunic:'#5d5248', hat:'band',    hatC:'#3f3830', tool:null},
      toolsmith: {tunic:'#6d6152', hat:'band',    hatC:'#4a4238', tool:null},
      minter:    {tunic:'#8a6d3f', hat:'cap',     hatC:'#6d5426', tool:null},
      baker:     {tunic:'#d9d2c2', hat:'cap',     hatC:'#efe6d2', tool:null},
      butcher:   {tunic:'#a3564a', hat:'band',    hatC:'#7d3f36', tool:null},
      miller:    {tunic:'#cfc7b4', hat:'cap',     hatC:'#b5ac96', tool:null},
      brewer:    {tunic:'#7a5b35', hat:'band',    hatC:'#5d4426', tool:null},
      smelter:   {tunic:'#6d5a52', hat:'band',    hatC:'#4f403a', tool:null},
      miner:     {tunic:'#6d665c', hat:'cap',     hatC:'#4f4a42', tool:'pick'},
      pigfarmer: {tunic:'#96805c', hat:'straw',   hatC:'#d9bb7d', tool:null},
      donkeyherder:{tunic:'#8a7a5c', hat:'straw', hatC:'#cfa96a', tool:null},
      shipwright:{tunic:'#4e6d8a', hat:'cap',     hatC:'#3a5268', tool:null},
      carpenter: {tunic:'#a3905a', hat:'cap',     hatC:'#8a744a', tool:null},
      welldigger:{tunic:'#5a7d8a', hat:'band',    hatC:'#44606b', tool:null},
    };
    const pro=kind==='worker' ? (PRO[wtype]||null) : null;
    const tunic= kind==='soldier' ? '#8a95a0' : pro? pro.tunic : '#6d5a44';
    const step=Math.sin((this.time/85)+x*0.31);
    const bob=Math.abs(step)*1.1;
    this.shadow(g,x,y+7.4,5.8,2.3,0.26);
    // Figuren etwas größer und dadurch feiner lesbar
    g.save();
    g.translate(x,y); g.scale(1.16,1.24); g.translate(-x,-y);   // leicht gestreckt = natürlicher
    if(dir && dir[0]<-0.05){ g.translate(x,y); g.scale(-1,1); g.translate(-x,-y); }  // Blick nach links
    y-=bob;
    // Beine mit Schuhen
    g.strokeStyle='#4a3b2c'; g.lineWidth=2.2;
    g.beginPath(); g.moveTo(x-2,y); g.lineTo(x-2+step*1.8,y+6); g.moveTo(x+2,y); g.lineTo(x+2-step*1.8,y+6); g.stroke();
    g.fillStyle='#3a2e22';
    g.beginPath(); g.ellipse(x-2+step*1.8,y+6.4,1.6,1,0,0,7); g.ellipse(x+2-step*1.8,y+6.4,1.6,1,0,0,7); g.fill();
    // hinterer Arm (schwingt gegenläufig)
    g.strokeStyle=shade(tunic,0.8); g.lineWidth=2;
    g.beginPath();
    if(good){ g.moveTo(x-3.2,y-6.5); g.quadraticCurveTo(x-4.6,y-11,x-2.6,y-14.5); }
    else { g.moveTo(x-3.2,y-6.5); g.lineTo(x-3.2-step*2,y-1.5); }
    g.stroke();
    // Körper: Kittel mit Saum
    g.fillStyle=tunic;
    g.beginPath();
    g.moveTo(x-4.2,y+1.4);
    g.quadraticCurveTo(x-4.4,y-7.5, x,y-8.6);
    g.quadraticCurveTo(x+4.4,y-7.5, x+4.2,y+1.4);
    g.quadraticCurveTo(x,y+3, x-4.2,y+1.4);
    g.closePath(); g.fill();
    g.strokeStyle='rgba(60,40,25,0.45)'; g.lineWidth=1; g.stroke();
    g.strokeStyle='rgba(255,255,255,0.25)'; g.lineWidth=1;      // Lichtkante links
    g.beginPath(); g.moveTo(x-3.4,y); g.quadraticCurveTo(x-3.8,y-6,x-1.4,y-8); g.stroke();
    // Gürtel mit Schnalle
    g.fillStyle='#4a3826'; g.fillRect(x-4,y-3.2,8,1.8);
    g.fillStyle='#c9a05a'; g.fillRect(x-0.9,y-3.4,1.8,2.2);
    // Schärpe in Spielerfarbe
    g.fillStyle=col;
    g.fillRect(x-3.8,y-7.8,7.6,2.6);
    // vorderer Arm
    g.strokeStyle=tunic; g.lineWidth=2.1;
    g.beginPath();
    if(good){ g.moveTo(x+3.2,y-6.5); g.quadraticCurveTo(x+4.6,y-11,x+2.6,y-14.5); }
    else { g.moveTo(x+3.2,y-6.5); g.lineTo(x+3.2+step*2,y-1.5); }
    g.stroke();
    g.fillStyle='#f2cfa0';   // Hand
    g.beginPath(); g.arc(good? x+2.6 : x+3.2+step*2, good? y-14.5 : y-1.3, 1.2, 0, 7); g.fill();
    // Kopf: natürliche Proportion (Stilguide: leicht stilisiert, kein Chibi)
    g.fillStyle='#e0b98c';
    g.beginPath(); g.ellipse(x,y-11.9,3.1,3.4,0,0,7); g.fill();
    g.strokeStyle='rgba(60,40,25,0.3)'; g.lineWidth=0.8; g.stroke();
    // dezentes Gesicht
    g.fillStyle='#3a3028';
    g.beginPath(); g.arc(x-1.1,y-12,0.4,0,7); g.arc(x+1.1,y-12,0.4,0,7); g.fill();
    g.strokeStyle='rgba(120,80,55,0.4)'; g.lineWidth=0.7;
    g.beginPath(); g.moveTo(x-0.8,y-10.6); g.lineTo(x+0.8,y-10.6); g.stroke();
    // Berufswerkzeug + Kopfbedeckung
    if(pro){
      switch(pro.tool){
        case 'axe':
          g.strokeStyle='#8a6b43'; g.lineWidth=1.6;
          g.beginPath(); g.moveTo(x+4.6,y-2); g.lineTo(x+7.4,y-13); g.stroke();
          g.fillStyle='#b5bcc4';
          g.beginPath(); g.moveTo(x+6.4,y-13.6); g.quadraticCurveTo(x+10.4,y-12.4,x+8.4,y-9.6);
          g.lineTo(x+6.8,y-11.4); g.closePath(); g.fill();
          break;
        case 'pick':
          g.strokeStyle='#8a6b43'; g.lineWidth=1.6;
          g.beginPath(); g.moveTo(x+4.6,y-2); g.lineTo(x+7,y-13); g.stroke();
          g.strokeStyle='#b5bcc4'; g.lineWidth=1.8;
          g.beginPath(); g.moveTo(x+3.6,y-12.4); g.quadraticCurveTo(x+7,y-16,x+10.4,y-12.4); g.stroke();
          break;
        case 'rod':
          g.strokeStyle='#8a6b43'; g.lineWidth=1.3;
          g.beginPath(); g.moveTo(x+4.4,y-1); g.lineTo(x+9.4,y-16); g.stroke();
          g.strokeStyle='rgba(220,230,240,0.7)'; g.lineWidth=0.8;
          g.beginPath(); g.moveTo(x+9.4,y-16); g.quadraticCurveTo(x+10.4,y-11,x+9.6,y-7); g.stroke();
          break;
        case 'bow':
          g.strokeStyle='#6d4f2e'; g.lineWidth=1.6;
          g.beginPath(); g.arc(x+6.4,y-7.5,5.4,-1.2,1.2); g.stroke();
          g.strokeStyle='rgba(230,230,230,0.8)'; g.lineWidth=0.7;
          g.beginPath(); g.moveTo(x+8.4,y-12.4); g.lineTo(x+8.4,y-2.6); g.stroke();
          break;
        case 'scythe':
          g.strokeStyle='#8a6b43'; g.lineWidth=1.6;
          g.beginPath(); g.moveTo(x+4.6,y-1); g.lineTo(x+7.2,y-14); g.stroke();
          g.strokeStyle='#b5bcc4'; g.lineWidth=1.7;
          g.beginPath(); g.moveTo(x+7.2,y-14); g.quadraticCurveTo(x+12,y-13.4,x+13,y-9.6); g.stroke();
          break;
        case 'sapling':
          g.strokeStyle='#6b4a2c'; g.lineWidth=1.4;
          g.beginPath(); g.moveTo(x+5.4,y-1); g.lineTo(x+5.4,y-6.4); g.stroke();
          g.fillStyle='#5ba455';
          g.beginPath(); g.arc(x+5.4,y-8,2.6,0,7); g.fill();
          break;
      }
      if(pro.hat==='straw'){
        g.fillStyle=pro.hatC;
        g.beginPath(); g.ellipse(x,y-13.4,6,1.9,0,0,7); g.fill();
        g.strokeStyle='rgba(120,90,45,0.6)'; g.lineWidth=0.8; g.stroke();
        g.beginPath(); g.arc(x,y-13.8,3,Math.PI,0); g.fill();
      } else if(pro.hat==='cap'){
        g.fillStyle=pro.hatC;
        g.beginPath(); g.arc(x,y-12.6,4.1,Math.PI*0.95,Math.PI*2.05); g.fill();
        g.fillRect(x-4.4,y-13,5.4,1.6);
      } else if(pro.hat==='band'){
        g.fillStyle=pro.hatC; g.fillRect(x-4,y-14.2,8,1.8);
      } else if(pro.hat==='feather'){
        g.fillStyle=pro.hatC;
        g.beginPath(); g.arc(x,y-12.8,4,Math.PI,0); g.fill();
        g.strokeStyle='#d0453a'; g.lineWidth=1.3;
        g.beginPath(); g.moveTo(x+2.6,y-15); g.quadraticCurveTo(x+4.6,y-18.4,x+6,y-19); g.stroke();
      }
    }
    if(kind==='soldier'){
      const st= rank==='spear'||rank==='bow' ? rank : 'sword';
      // Kampfpose: rhythmisches Ausholen/Zurückweichen
      const fph= fight==null ? 0 : Math.sin(this.time/140 + fight);
      if(st==='sword'){
        // Nasalhelm
        g.fillStyle='#c2ccd6';
        g.beginPath(); g.arc(x,y-12.4,4.3,Math.PI,0); g.fill();
        rr(g,x-4.4,y-12.6,8.8,1.8,1); g.fill();
        g.strokeStyle='rgba(60,40,25,0.35)'; g.lineWidth=0.8;
        g.beginPath(); g.arc(x,y-12.4,4.3,Math.PI,0); g.stroke();
        g.strokeStyle='#9aa5b0'; g.lineWidth=1.1;
        g.beginPath(); g.moveTo(x,y-12.4); g.lineTo(x,y-9.6); g.stroke();
        // Schwert (schwingt im Kampf um die Schulter)
        g.save();
        g.translate(x+4.2,y-6.5);
        g.rotate(fight==null ? 0.5 : 0.9+fph*0.85);
        g.strokeStyle='#5d452a'; g.lineWidth=1.8;
        g.beginPath(); g.moveTo(0,1.6); g.lineTo(0,-1); g.stroke();
        g.strokeStyle='#3f3428'; g.lineWidth=1.2;
        g.beginPath(); g.moveTo(-2,-1.2); g.lineTo(2,-1.2); g.stroke();
        g.strokeStyle='#d8dde4'; g.lineWidth=1.7;
        g.beginPath(); g.moveTo(0,-1.6); g.lineTo(0,-11.5); g.stroke();
        g.strokeStyle='rgba(255,255,255,0.55)'; g.lineWidth=0.6;
        g.beginPath(); g.moveTo(-0.4,-2); g.lineTo(-0.4,-11); g.stroke();
        g.restore();
        // Rundschild in Spielerfarbe
        g.fillStyle=col;
        g.beginPath(); g.ellipse(x-5.8,y-4+(fight!=null?fph*1.2:0),2.8,3.8,0,0,7); g.fill();
        g.strokeStyle='rgba(30,20,10,0.5)'; g.lineWidth=1; g.stroke();
        g.fillStyle='#c9a05a';
        g.beginPath(); g.arc(x-5.8,y-4+(fight!=null?fph*1.2:0),1,0,7); g.fill();
      } else if(st==='spear'){
        // Eisenhut (breite Krempe)
        g.fillStyle='#b5bfc9';
        g.beginPath(); g.ellipse(x,y-13.2,5.6,1.7,0,0,7); g.fill();
        g.beginPath(); g.arc(x,y-13.6,3.2,Math.PI,0); g.fill();
        g.strokeStyle='rgba(60,40,25,0.35)'; g.lineWidth=0.8;
        g.beginPath(); g.ellipse(x,y-13.2,5.6,1.7,0,0,7); g.stroke();
        // Speer: aufrecht, im Kampf gesenkt und stoßend
        g.save();
        g.translate(x+4.6,y-4);
        g.rotate(fight==null ? 0 : 1.05);
        const thrust= fight==null ? 0 : Math.max(0,fph)*3.4;
        g.strokeStyle='#8a6b43'; g.lineWidth=1.5;
        g.beginPath(); g.moveTo(0,6-thrust); g.lineTo(0,-13.5-thrust); g.stroke();
        g.fillStyle='#d5d5d5';
        g.beginPath(); g.moveTo(0,-16.5-thrust); g.lineTo(1.5,-13.2-thrust); g.lineTo(-1.5,-13.2-thrust); g.closePath(); g.fill();
        g.restore();
        // kleiner Faustschild
        g.fillStyle=col;
        g.beginPath(); g.arc(x-5.4,y-4.6,2.2,0,7); g.fill();
        g.strokeStyle='rgba(30,20,10,0.5)'; g.lineWidth=0.9; g.stroke();
      } else {
        // Bogenschütze: Kapuze in Spielerfarbe, Köcher, gespannter Bogen
        g.fillStyle=mix(col,'#3a3228',0.35);
        g.beginPath(); g.arc(x,y-12.6,4.1,Math.PI*0.92,Math.PI*2.08); g.fill();
        g.beginPath(); g.moveTo(x-4,y-12); g.quadraticCurveTo(x,y-17.8,x+4,y-12); g.closePath(); g.fill();
        // Köcher schräg auf dem Rücken
        g.save();
        g.translate(x-4.4,y-8); g.rotate(-0.5);
        g.fillStyle='#6d4f2e'; rr(g,-1.5,-3.4,3,7,1.4); g.fill();
        g.strokeStyle='#d8cfa8'; g.lineWidth=0.8;
        g.beginPath(); g.moveTo(-0.7,-3.6); g.lineTo(-0.7,-5.4); g.moveTo(0.7,-3.6); g.lineTo(0.7,-5.6); g.stroke();
        g.restore();
        // Bogen (im Kampf gespannt, Sehne gezogen): schlanker Halbbogen, kein "Rad"
        const draw= fight==null ? 0 : Math.max(0,fph)*2.2;
        g.strokeStyle='#7a5b35'; g.lineWidth=1.3;
        g.beginPath(); g.arc(x+2.6,y-7.5,4.6,-0.95,0.95); g.stroke();
        g.strokeStyle='rgba(235,235,235,0.8)'; g.lineWidth=0.6;
        g.beginPath();
        g.moveTo(x+5.3,y-11.2); g.lineTo(x+3.4-draw,y-7.5); g.lineTo(x+5.3,y-3.8);
        g.stroke();
        if(fight!=null){
          g.strokeStyle='#8a6b43'; g.lineWidth=0.9;
          g.beginPath(); g.moveTo(x+3.4-draw,y-7.5); g.lineTo(x+8.6,y-7.5); g.stroke();
        }
      }
    } else if(!pro){
      // runde Zipfelmütze in Spielerfarbe (Träger)
      g.fillStyle=mix(col,'#ffffff',0.12);
      g.beginPath();
      g.moveTo(x-4.1,y-12.2);
      g.quadraticCurveTo(x-1,y-17.6, x+2.4,y-16.4);
      g.quadraticCurveTo(x+4.6,y-15.6, x+4.1,y-12.2);
      g.quadraticCurveTo(x,y-14, x-4.1,y-12.2);
      g.closePath(); g.fill();
      g.fillStyle='#fff'; g.beginPath(); g.arc(x+2.6,y-16.6,1.2,0,7); g.fill();
    }
    if(good) this.drawGood(g, good, x, y-13, 9.4);
    g.restore();
  }
  computeBorders(){
    const m=this.game.map;
    this.borderEdges=[];
    this.borderPosts=[];
    const seen=new Set();
    for(let i=0;i<m.owner.length;i++){
      const o=m.owner[i];
      if(o<0) continue;
      const [x,y]=m.worldPos(i);
      for(const n of m.nbs(i)){
        if(m.owner[n]===o) continue;
        const [nx,ny]=m.worldPos(n);
        const mx=(x+nx)/2, my=(y+ny)/2;
        const dx=nx-x, dy=ny-y;
        const L=Math.hypot(dx,dy)||1;
        const px=-dy/L, py=dx/L;
        this.borderEdges.push({pl:o, x1:mx-px*12, y1:my-py*12, x2:mx+px*12, y2:my+py*12});
        // Grenzpfosten: ausgedünnt auf ein grobes Raster, damit sie als Reihe
        // von Wegmarken lesbar bleiben statt als Zaun. Im Wasser (und in
        // Lava) steht kein Pfahl – vorher marschierte die Reihe mitten
        // durch den See (Grafik-Ärgernis aus dem Kritikbericht).
        const nass=(q)=>{ const t2=m.terr[q]; return t2===TER.WATER||t2===TER.LAVA; };
        if(nass(i)||nass(n)) continue;
        const gx=Math.round(mx/34), gy=Math.round(my/30);
        const key=gx+','+gy;
        if(!seen.has(key)){
          seen.add(key);
          this.borderPosts.push({pl:o, x:mx, y:my});
        }
      }
    }
  }
  // Grenzpfosten: weißer Pfahl mit Ringen in Spielerfarbe
  // Das Band am gemalten Pfosten ist REIN weiß und flach (so im Stilguide
  // gefordert). Genau daran erkennt man es: Sättigung ~0 und Helligkeit am
  // Anschlag, während der Schaft gebrochen weiß und schattiert ist.
  postTinted(pl){
    const img=this.asset('obj_borderpost');
    if(!img) return null;
    if(!this._postT) this._postT=new Map();
    let cv=this._postT.get(pl);
    if(cv!==undefined) return cv;
    const w=img.naturalWidth, h=img.naturalHeight;
    cv=document.createElement('canvas'); cv.width=w; cv.height=h;
    const t=cv.getContext('2d',{willReadFrequently:true});
    t.drawImage(img,0,0);
    try{
      const id=t.getImageData(0,0,w,h), d=id.data;
      const col=toArr(PLAYER_COLORS[pl]||'#888');
      for(let p2=0;p2<d.length;p2+=4){
        if(d[p2+3]<8) continue;
        const mn=Math.min(d[p2],d[p2+1],d[p2+2]), mx=Math.max(d[p2],d[p2+1],d[p2+2]);
        if(mn<246 || mx-mn>6) continue;                 // nicht das Band
        // das Band ist flach – die Rundung kommt hier dazu
        const x=((p2/4)%w)/w;
        const sh=0.72+0.42*Math.cos((x-0.36)*2.6);
        d[p2]  = Math.min(255, col[0]*sh);
        d[p2+1]= Math.min(255, col[1]*sh);
        d[p2+2]= Math.min(255, col[2]*sh);
      }
      t.putImageData(id,0,0);
    }catch(_){ cv=null; }
    this._postT.set(pl,cv);
    return cv;
  }
  // Schild mit Text in der Karte (gleicher Stil überall). u = 1/Zoom,
  // damit Schrift und Knöpfe bei jedem Zoom gleich groß bleiben.
  uiSchild(g, cx, cy, u, text, gut){
    g.save();
    g.font=`600 ${Math.round(13*u*10)/10}px Georgia, serif`;
    g.textAlign='center'; g.textBaseline='middle';
    const tw=g.measureText(text).width;
    const bild=this.asset('ui_schild');
    if(bild){
      // gemaltes Schild in drei Teilen: beide Enden unverzerrt, die Mitte
      // streckt sich auf die Textbreite
      const ph=26*u, sc=ph/bild.naturalHeight;
      const endB=Math.round(bild.naturalWidth*0.22);
      const eb=endB*sc, mw=Math.max(tw+8*u, 10*u);
      const x0=cx-mw/2-eb, y0=cy-ph/2;
      g.drawImage(bild, 0,0,endB,bild.naturalHeight, x0,y0, eb,ph);
      g.drawImage(bild, endB,0,bild.naturalWidth-endB*2,bild.naturalHeight, x0+eb,y0, mw,ph);
      g.drawImage(bild, bild.naturalWidth-endB,0,endB,bild.naturalHeight, x0+eb+mw,y0, eb,ph);
      g.fillStyle= gut? '#f4e6c4' : '#f6cdc4';
      g.fillText(text, cx, cy+0.5*u);
      g.restore();
      return;
    }
    const ph=20*u, pw=tw+18*u;
    g.fillStyle='rgba(24,30,20,0.72)';
    rr(g, cx-pw/2, cy-ph/2, pw, ph, 6*u); g.fill();
    g.fillStyle= gut? '#dff3cd' : '#f6cdc4';
    g.fillText(text, cx, cy+0.5*u);
    g.restore();
  }
  // Schwebender Rund-Knopf (Haken/Kreuz). Nimmt ui_ok.png / ui_cancel.png,
  // sobald die im Asset-Paket liegen; bis dahin der gezeichnete Ersatz.
  uiKnopf(g, cx, cy, u, art){
    const bild=this.asset(art==='ok'?'ui_ok':'ui_cancel');
    const R=21*u;
    if(bild){
      const d2=R*2.3;
      g.drawImage(bild, cx-d2/2, cy-d2/2, d2, d2);
      return;
    }
    g.save();
    g.textAlign='center'; g.textBaseline='middle';
    g.beginPath(); g.arc(cx,cy+1.5*u,R,0,7);
    g.fillStyle='rgba(12,16,10,0.45)'; g.fill();
    g.beginPath(); g.arc(cx,cy,R,0,7);
    g.fillStyle= art==='ok'? '#4c8a3a' : '#8a3f34'; g.fill();
    g.lineWidth=2*u;
    g.strokeStyle= art==='ok'? 'rgba(226,246,210,0.9)' : 'rgba(246,214,206,0.9)';
    g.stroke();
    g.font=`700 ${Math.round(22*u*10)/10}px system-ui, -apple-system, sans-serif`;
    g.fillStyle='#fff';
    g.fillText(art==='ok'?'✓':'✕', cx, cy+1*u);
    g.restore();
  }
  // Schwebender Holz-Rundknopf mit gemaltem Sinnbild (Wegweiser, Spitzhacke,
  // Fernrohr) - gleiche Bedienung wie Haken/Kreuz beim Bau-Bestätigen.
  // aktiv=false zeichnet halbdurchsichtig (z.B. Geologe ohne Spitzhacke).
  uiRundKnopf(g, cx, cy, u, art, aktiv=true){
    const R=21*u;
    // gemalte Knöpfe (ui_fahnenmenü-Lieferung), gezeichneter Ersatz als Rückfall
    const bild=this.asset(art==='weg'?'ui_btn_weg': art==='geo'?'ui_btn_geologe':'ui_btn_spaeher');
    if(bild){
      g.save();
      if(!aktiv) g.globalAlpha=0.5;
      const d2=R*2.3;
      g.drawImage(bild, cx-d2/2, cy-d2/2, d2, d2);
      g.restore();
      return;
    }
    g.save();
    if(!aktiv) g.globalAlpha=0.5;
    g.beginPath(); g.arc(cx,cy+1.5*u,R,0,7); g.fillStyle='rgba(12,16,10,0.45)'; g.fill();
    g.beginPath(); g.arc(cx,cy,R,0,7); g.fillStyle='#4a3521'; g.fill();
    g.lineWidth=2*u; g.strokeStyle='#c9a24b'; g.stroke();
    g.beginPath(); g.arc(cx,cy,R*0.8,0,7); g.fillStyle='#6b4b2e'; g.fill();
    g.strokeStyle='#f4e6c4'; g.fillStyle='#f4e6c4'; g.lineCap='round'; g.lineJoin='round';
    if(art==='weg'){
      // Wegweiser: Pfahl mit Pfeilbrett
      g.lineWidth=2.2*u;
      g.beginPath(); g.moveTo(cx-1.5*u, cy+9*u); g.lineTo(cx-1.5*u, cy-3*u); g.stroke();
      g.beginPath();
      g.moveTo(cx-8*u, cy-3*u); g.lineTo(cx+4*u, cy-3*u); g.lineTo(cx+8*u, cy-6.5*u);
      g.lineTo(cx+4*u, cy-10*u); g.lineTo(cx-8*u, cy-10*u); g.closePath(); g.fill();
    } else if(art==='geo'){
      // Spitzhacke: Stiel + gebogener Kopf
      g.lineWidth=2.4*u;
      g.beginPath(); g.moveTo(cx-6*u, cy+9*u); g.lineTo(cx+5*u, cy-4*u); g.stroke();
      g.lineWidth=3*u;
      g.beginPath(); g.moveTo(cx-8*u, cy-4*u); g.quadraticCurveTo(cx+0.5*u, cy-12*u, cx+9*u, cy-2*u); g.stroke();
    } else {
      // Fernrohr: drei Rohrstufen, schräg nach oben
      g.translate(cx,cy); g.rotate(-0.55);
      g.fillRect(-10*u,-2.6*u, 9*u, 5.2*u);
      g.fillRect(-1*u,-1.9*u, 5*u, 3.8*u);
      g.fillRect(4*u,-2.4*u, 5*u, 4.8*u);
    }
    g.restore();
  }
  // Beim Freistellen vor weissem Hintergrund haben helle INNENflaechen Alpha
  // eingebuesst – der weisse Muehlenturm und das helle Reetdach schimmern im
  // Spiel durch. Hier wird alles innerhalb der Silhouette wieder deckend
  // gemacht; der weiche Aussenrand (zwei Punkte breit) bleibt unangetastet,
  // sonst bekaeme das Gebaeude eine harte Treppchenkante.
  solidBld(key, img){
    if(!img) return img;
    if(!this._solid) this._solid=new Map();
    const hit=this._solid.get(key);
    if(hit!==undefined) return hit||img;
    let cv=null;
    try{
      const w=img.naturalWidth, h=img.naturalHeight;
      cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      const t=cv.getContext('2d');
      t.drawImage(img,0,0);
      const id=t.getImageData(0,0,w,h), d=id.data;
      // 1) Flutfuellung vom Rand her ueber alles Durchsichtige: so ist klar,
      //    was aussen liegt und was ein heller Fleck INNERHALB des Hauses ist
      const aussen=new Uint8Array(w*h);
      const stapel=[];
      const pruef=(x,y)=>{
        const k=y*w+x;
        if(aussen[k] || d[(k<<2)+3]>=16) return;
        aussen[k]=1; stapel.push(k);
      };
      for(let x=0;x<w;x++){ pruef(x,0); pruef(x,h-1); }
      for(let y=0;y<h;y++){ pruef(0,y); pruef(w-1,y); }
      while(stapel.length){
        const k=stapel.pop(), x=k%w, y=(k/w)|0;
        if(x>0) pruef(x-1,y);
        if(x<w-1) pruef(x+1,y);
        if(y>0) pruef(x,y-1);
        if(y<h-1) pruef(x,y+1);
      }
      // 2) Aussenbereich um zwei Punkte verbreitern = der Saum, der weich
      //    bleiben soll
      const saum=new Uint8Array(aussen);
      for(let r=0;r<2;r++){
        const vor=new Uint8Array(saum);
        for(let y=0;y<h;y++) for(let x=0;x<w;x++){
          if(vor[y*w+x]) continue;
          if((x>0&&vor[y*w+x-1])||(x<w-1&&vor[y*w+x+1])||(y>0&&vor[(y-1)*w+x])||(y<h-1&&vor[(y+1)*w+x]))
            saum[y*w+x]=1;
        }
      }
      // 3) alles Uebrige deckend machen
      let geaendert=0;
      for(let k=0;k<w*h;k++){
        if(saum[k]) continue;
        const a=d[(k<<2)+3];
        if(a>=24 && a<255){ d[(k<<2)+3]=255; geaendert++; }
      }
      if(!geaendert){ this._solid.set(key,null); return img; }
      t.putImageData(id,0,0);
    }catch(_){ cv=null; }
    this._solid.set(key, cv);
    return cv||img;
  }
  // Wegekachel in Zielgroesse vorhalten. Die Vorlagen sind 256 Pixel gross,
  // gezeichnet werden sie mit rund 40 – jedes Bild neu herunterzuskalieren
  // kostet auf dem Handy spuerbar Zeit. Die Groesse wird in Stufen von acht
  // Pixeln gerundet, damit beim Zoomen nicht dauernd neu gerechnet wird.
  roadKachel(img, key, px){
    if(!img) return null;
    const s=Math.max(8, Math.min(256, Math.round(px/8)*8));
    if(!this._rk) this._rk=new Map();
    const ck=key+'@'+s;
    let cv=this._rk.get(ck);
    if(cv) return cv;
    cv=document.createElement('canvas'); cv.width=s; cv.height=s;
    const t=cv.getContext('2d');
    t.imageSmoothingQuality='high';
    t.drawImage(img,0,0,s,s);
    if(this._rk.size>60) this._rk.clear();       // Zoomfahrten nicht horten
    this._rk.set(ck,cv);
    return cv;
  }
  // Platzpflaster mit weich auslaufendem Rand. Die Kachel ist rechteckig;
  // ohne Maske stünde eine harte Raute im Gras. Ein sauberer Kreis sähe
  // allerdings aus wie ein ausgestanzter Deckel – deshalb setzt sich die
  // Maske aus mehreren versetzten Wolken zusammen und franst unregelmäßig
  // aus. Wird je Größe zwischengespeichert.
  plazaSprite(img, sz){
    if(!img) return null;
    if(!this._plaza) this._plaza=new Map();
    const key=sz;
    let cv=this._plaza.get(key);
    if(cv!==undefined) return cv;
    cv=document.createElement('canvas'); cv.width=sz; cv.height=sz;
    const t=cv.getContext('2d');
    t.drawImage(img,0,0,sz,sz);
    // Maske getrennt aufbauen: mehrere Wolken addieren sich zu einem
    // unregelmäßigen Rand. Direkt mit 'destination-in' gefüllt würde jede
    // Wolke die vorige wieder wegradieren.
    const mk=document.createElement('canvas'); mk.width=sz; mk.height=sz;
    const q=mk.getContext('2d');
    q.globalCompositeOperation='lighter';
    const R=sz*0.5;
    const wolke=(cx,cy,r,a)=>{
      const rd=q.createRadialGradient(cx,cy,r*0.30, cx,cy,r);
      rd.addColorStop(0,`rgba(255,255,255,${a})`);
      rd.addColorStop(0.62,`rgba(255,255,255,${a*0.8})`);
      rd.addColorStop(1,'rgba(255,255,255,0)');
      q.fillStyle=rd;
      q.beginPath(); q.arc(cx,cy,r,0,7); q.fill();
    };
    wolke(R,R,R*0.66,0.95);
    for(let k=0;k<7;k++){
      const a2=k/7*6.283+hash01(k*13+5)*0.7;
      const d=R*(0.24+hash01(k*7+1)*0.14);
      wolke(R+Math.cos(a2)*d, R+Math.sin(a2)*d, R*(0.40+hash01(k*11+3)*0.16), 0.62);
    }
    t.globalCompositeOperation='destination-in';
    t.drawImage(mk,0,0);
    t.globalCompositeOperation='source-over';
    this._plaza.set(key,cv);
    return cv;
  }
  // Grenzpfosten: schlichter weißer Steckpfosten mit einem breiten,
  // umlaufenden Band in der Farbe des Gebietsbesitzers.
  drawBorderPost(g, p){
    const {x,y,pl}=p;
    const tint=this.postTinted(pl);
    if(tint){
      const hh=this.scaleOf('obj_borderpost',22), ww=hh*(tint.width/tint.height);
      this.shadow(g, x+2, y+1.2, ww*0.5, 1.4, 0.28);
      g.drawImage(tint, x-ww/2, y+2-hh, ww, hh);
      return;
    }
    const col=PLAYER_COLORS[pl]||'#999';
    const H=16, W=4.4;
    this.shadow(g, x+2, y+1.2, 3.4, 1.3, 0.28);
    const wg=g.createLinearGradient(x-W/2,0,x+W/2,0);
    wg.addColorStop(0,'#ffffff'); wg.addColorStop(0.55,'#f1efe7'); wg.addColorStop(1,'#c7c4b9');
    g.fillStyle=wg;
    g.fillRect(x-W/2, y-H, W, H);
    // breites Band in Spielerfarbe
    g.fillStyle=col;
    g.fillRect(x-W/2, y-H*0.66, W, H*0.34);
    // abgewandte Seite dunkler -> der Pfosten wirkt rund
    g.fillStyle='rgba(0,0,0,0.20)';
    g.fillRect(x+W*0.14, y-H*0.66, W*0.36, H*0.34);
    g.fillStyle='#ffffff';
    g.beginPath(); g.ellipse(x, y-H, W*0.6, W*0.3, 0,0,7); g.fill();
    g.strokeStyle='rgba(70,68,60,0.45)'; g.lineWidth=0.7;
    g.strokeRect(x-W/2, y-H, W, H);
  }
  // ---------- Minimap ----------
  drawMinimap(cv, cam){
    const m=this.game.map, g=cv.getContext('2d');
    const w=cv.width, h=cv.height;
    const sx=w/m.w, sy=h/m.h;
    const cols=TER_COL[this.theme]||TER_COL.gruen;
    g.fillStyle='#0a0e16'; g.fillRect(0,0,w,h);
    // Unerkundetes: dezentes Karo statt tiefschwarzer Fläche – die fast
    // leere Minikarte der ersten Minuten wirkte wie ein Darstellungsfehler
    // (Kritikbericht F12). Das Muster sagt "Karte, noch nicht erkundet".
    g.fillStyle='#111827';
    for(let y=0;y<m.h;y+=4) for(let x=0;x<m.w;x+=4){
      if(((x>>2)+(y>>2))%2) continue;
      g.fillRect(x*sx, y*sy, Math.ceil(sx*4), Math.ceil(sy*4));
    }
    for(let y=0;y<m.h;y++) for(let x=0;x<m.w;x++){
      const i=m.idx(x,y);
      if(!m.explored[i]) continue;
      // Gelände in Geländefarbe; eigenes/fremdes Gebiet nur leicht eingefärbt,
      // damit man die Landschaft weiter erkennt
      let c=cols[m.terr[i]];
      if((m.obj[i]&127)===OBJ.TREE) c=shade(cols[TER.GRASS],0.72);
      if(m.owner[i]>=0) c=mixHex(c, PLAYER_COLORS[m.owner[i]], 0.42);
      g.fillStyle=c;
      g.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));
    }
    // Gebietsgrenzen kräftig in der Farbe des Besitzers
    g.lineWidth=Math.max(1.2, sx*0.9);
    for(let y=0;y<m.h;y++) for(let x=0;x<m.w;x++){
      const i=m.idx(x,y);
      const o=m.owner[i];
      if(o<0 || !m.explored[i]) continue;
      let border=false;
      for(const n of m.nbs(i)) if(m.owner[n]!==o){ border=true; break; }
      if(!border) continue;
      g.fillStyle=PLAYER_COLORS[o];
      g.fillRect(x*sx-sx*0.15, y*sy-sy*0.15, Math.ceil(sx*1.3), Math.ceil(sy*1.3));
    }
    // laufende Kämpfe blinken rot
    if(this.game.battles && this.game.battles.length){
      for(const bt of this.game.battles){
        const b=this.game.buildings.get(bt.bldId);
        if(!b) continue;
        const bx=(m.X(b.node)+0.5)*sx, by=(m.Y(b.node)+0.5)*sy;
        const pulse=0.55+0.45*Math.sin(this.time/180);
        g.fillStyle=`rgba(255,${60+pulse*80|0},40,${0.55+pulse*0.45})`;
        g.beginPath(); g.arc(bx,by,Math.max(3,sx*2.4),0,7); g.fill();
        g.strokeStyle='rgba(255,240,210,0.9)'; g.lineWidth=1.2;
        g.beginPath(); g.arc(bx,by,Math.max(3,sx*2.4)+pulse*2.6,0,7); g.stroke();
      }
    }
    g.strokeStyle='#fff'; g.lineWidth=1;
    const vx=(cam.x/TILE)*sx, vy=(cam.y/ROWH)*sy;
    const vw=(this.vw/cam.z/TILE)*sx, vh=(this.vh/cam.z/ROWH)*sy;
    g.strokeRect(vx-vw/2, vy-vh/2, vw, vh);
  }
}

function toArr(c){
  if(c[0]==='#') return hex2arr(c);
  const m2=/rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c);
  return m2? [+m2[1],+m2[2],+m2[3]] : [128,128,128];
}
function mixHex(a,b,t){
  const A=toArr(a), B=toArr(b);
  return `rgb(${(A[0]+(B[0]-A[0])*t)|0},${(A[1]+(B[1]-A[1])*t)|0},${(A[2]+(B[2]-A[2])*t)|0})`;
}
export function goodColor(good){
  return {
    trunk:'#8a5a2c', board:'#c9a05a', stone:'#9a958c', fish:'#6fa7c7', meat:'#c26a5a',
    grain:'#d9b74a', flour:'#efe6d2', bread:'#b8813f', water:'#5a8fc7', pig:'#d99a9a',
    coal:'#3a3a3a', ironore:'#8a6a5a', iron:'#b0b4ba', gold:'#e0b23a', coin:'#ffd54a',
    sword:'#c0c8d2', shield:'#7d8896', spear:'#a3814e', bow:'#7a5b35', beer:'#c78f3f',
    hammer:'#8a7355', pick:'#7d7a72', axe:'#96703f', saw:'#aab0b8', scythe:'#c2b26a',
    rod:'#6d8a9c', cleaver:'#b0685a', shovel:'#8a7a5c',
  }[good]||'#fff';
}
