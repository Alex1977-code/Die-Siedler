// Neuland – Aufbau-Strategie  |  Kern: Konstanten & Hilfsfunktionen
// Alle Inhalte (Grafik, Sound, Texte) sind Eigenkreationen dieses Projekts.

export const TER = { WATER:0, GRASS:1, DESERT:2, MOUNT:3, SNOW:4, SWAMP:5, LAVA:6 };

// ROCK: Felsformation IM Gebirge (Nadeln, Bloecke, Geroell-, Kieshaufen,
// Klippen). Anders als STONE ist sie kein Rohstoff, sondern ein HINDERNIS:
// dort laesst sich nicht bauen, keine Strasse fuehrt hindurch und Figuren
// laufen aussen herum. Die Zeichnung im Renderer liest genau diese Knoten –
// Bild und Kollision koennen deshalb nicht auseinanderlaufen.
export const OBJ = { NONE:0, SAPLING:1, TREE2:2, TREE:3, STONE:4, FIELD0:5, FIELD1:6, FIELD2:7, RUIN:8, GATE:9, ROCK:10 };

export const GOODS = {
  trunk:  { name:'Baumstamm' },
  board:  { name:'Brett' },
  stone:  { name:'Stein' },
  fish:   { name:'Fisch' },
  meat:   { name:'Fleisch' },
  grain:  { name:'Getreide' },
  flour:  { name:'Mehl' },
  bread:  { name:'Brot' },
  water:  { name:'Wasser' },
  pig:    { name:'Schwein' },
  coal:   { name:'Kohle' },
  ironore:{ name:'Eisenerz' },
  iron:   { name:'Eisen' },
  gold:   { name:'Golderz' },
  coin:   { name:'Münze' },
  sword:  { name:'Schwert' },
  shield: { name:'Schild' },
  spear:  { name:'Speer' },
  bow:    { name:'Bogen' },
  beer:   { name:'Bier' },
  pick:   { name:'Spitzhacke' },
  hammer: { name:'Hammer' },
  axe:    { name:'Axt' },
  saw:    { name:'Säge' },
  scythe: { name:'Sense' },
  rod:    { name:'Angel' },
  cleaver:{ name:'Beil' },
  shovel: { name:'Schaufel' },
};
// Werkzeuge (Werkzeugschmiede); Bogen des Jägers kommt aus der Waffenschmiede
export const TOOLS = ['hammer','pick','axe','saw','scythe','rod','cleaver','shovel'];
export const GOOD_LIST = Object.keys(GOODS);

// TRANSPORT-RANGFOLGE (v196), wie in Die Siedler II.
//
// Bisher entschied allein der ANLASS, was zuerst befoerdert wird: Baustelle
// vor Produktionseingang vor Essen vor Sold. Innerhalb einer Stufe zaehlte
// nur, was zufaellig zuerst in der Liste stand. Der Spieler konnte nichts
// daran drehen - wer Nachschub fuer die Waffenschmiede wollte, musste
// warten, bis der Zufall es so wollte.
//
// Jetzt gibt es zusaetzlich eine Rangfolge JE WARE, die der Spieler selbst
// umsortieren kann. Sie greift als Zweitkriterium: der Anlass bleibt das
// staerkere Argument, aber bei gleichem Anlass gewinnt die Ware, die weiter
// oben steht - und dasselbe gilt fuer den Traeger, der an einer Fahne
// zwischen mehreren Waren waehlt.
//
// Die Voreinstellung bildet ab, was eine Siedlung in dieser Reihenfolge
// braucht: erst Baustoff, dann die Holz- und Nahrungskette, dann Erz und
// Metall, zuletzt Waffen, Werkzeug und Sold.
export const RANG_STD = [
  'board','stone','trunk',
  'bread','fish','meat','grain','flour','water','pig',
  'coal','ironore','iron','gold',
  'beer','coin',
  'hammer','pick','axe','saw','scythe','rod','cleaver','shovel',
  'sword','shield','spear','bow',
];
// Sicherheitsnetz: neue Waren, die noch nicht in RANG_STD stehen, haengen
// hinten an, statt aus der Rangfolge zu fallen.
export function rangListe(gespeichert){
  const raus=[];
  const gesehen=new Set();
  for(const k of (Array.isArray(gespeichert)? gespeichert : RANG_STD)){
    if(GOODS[k] && !gesehen.has(k)){ gesehen.add(k); raus.push(k); }
  }
  for(const k of GOOD_LIST) if(!gesehen.has(k)) raus.push(k);
  return raus;
}
export const FOODS = ['fish','bread','meat'];

// Gebäudedefinitionen. size: S/M/L/MINE. cat für das Baumenü.
export const BLD = {
  hq:         { name:'Hauptquartier', cat:'lager', size:'L', cost:{}, mil:{cap:0,radius:11}, store:true, desc:'Zentrum deiner Siedlung. Lager und Rekrutierung.' },
  storehouse: { name:'Lagerhaus', cat:'lager', size:'M', cost:{board:4,stone:3}, store:true, desc:'Zusätzliches Lager für alle Waren.' },
  woodcutter: { name:'Holzfäller', cat:'basis', size:'S', cost:{board:2}, gather:'tree', out:'trunk', range:8, time:60, desc:'Fällt Bäume und liefert Stämme.' },
  // Förster: Radius wie der Holzfäller (sonst blieb der äußere Ring gerodeter
  // Fläche für immer kahl) und kürzerer Takt – zusammen mit den zwei
  // Setzlingen je Gang trägt EIN Förster so etwa anderthalb Holzfäller
  // (Kritikbericht: Wald nach <9 Spielminuten unwiederbringlich leer).
  forester:   { name:'Förster', cat:'basis', size:'S', cost:{board:2}, gather:'plant', range:8, time:60, desc:'Pflanzt neue Bäume.' },
  sawmill:    { name:'Sägewerk', cat:'basis', size:'M', cost:{board:2,stone:2}, prod:{out:'board', inputs:{trunk:1}, time:90}, desc:'Sägt Stämme zu Brettern.' },
  // Steinmetz-Radius angehoben (Kritikbericht Stein-Spirale): er erreicht
  // mehr Brocken, bevor die Granitmine im Gebirge übernehmen muss.
  quarry:     { name:'Steinmetz', cat:'basis', size:'S', cost:{board:2}, gather:'stone', out:'stone', range:10, time:70, desc:'Baut Felsbrocken zu Steinen ab.' },
  fisher:     { name:'Fischer', cat:'nahrung', size:'S', cost:{board:2}, gather:'fish', out:'fish', range:7, time:70, desc:'Fängt Fische an Gewässern.' },
  hunter:     { name:'Jäger', cat:'nahrung', size:'S', cost:{board:2}, gather:'hunt', out:'meat', range:9, time:120, desc:'Jagt Wild in den Wäldern.' },
  well:       { name:'Brunnen', cat:'nahrung', size:'S', cost:{board:2,stone:1}, prod:{out:'water', inputs:{}, time:80}, desc:'Fördert Wasser.' },
  farm:       { name:'Bauernhof', cat:'nahrung', size:'L', cost:{board:3,stone:3}, gather:'farm', out:'grain', range:6, time:50, space:2, desc:'Sät und erntet Getreide auf den umliegenden Feldern.' },
  mill:       { name:'Mühle', cat:'nahrung', size:'M', cost:{board:2,stone:2}, prod:{out:'flour', inputs:{grain:1}, time:90}, desc:'Mahlt Getreide zu Mehl.' },
  bakery:     { name:'Bäckerei', cat:'nahrung', size:'M', cost:{board:2,stone:2}, prod:{out:'bread', inputs:{flour:1,water:1}, time:90}, desc:'Backt Brot aus Mehl und Wasser.' },
  pigfarm:    { name:'Schweinezucht', cat:'nahrung', size:'L', cost:{board:3,stone:3}, prod:{out:'pig', inputs:{grain:1,water:1}, time:140}, space:2, desc:'Züchtet Schweine.' },
  butcher:    { name:'Schlachterei', cat:'nahrung', size:'M', cost:{board:2,stone:2}, prod:{out:'meat', inputs:{pig:1}, time:80}, desc:'Verarbeitet Schweine zu Fleisch.' },
  brewery:    { name:'Brauerei', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{out:'beer', inputs:{grain:1,water:1}, time:110}, desc:'Braut Bier für neue Rekruten.' },
  coalmine:   { name:'Kohlebergwerk', cat:'industrie', size:'MINE', cost:{board:4}, mine:'coal', time:90, desc:'Fördert Kohle. Mit zugeteiltem Essen fördern die Bergleute schneller.' },
  ironmine:   { name:'Eisenbergwerk', cat:'industrie', size:'MINE', cost:{board:4}, mine:'ironore', time:90, desc:'Fördert Eisenerz. Mit zugeteiltem Essen fördern die Bergleute schneller.' },
  goldmine:   { name:'Goldbergwerk', cat:'industrie', size:'MINE', cost:{board:4}, mine:'gold', time:100, desc:'Fördert Golderz. Mit zugeteiltem Essen fördern die Bergleute schneller.' },
  granitemine:{ name:'Steinbergwerk', cat:'industrie', size:'MINE', cost:{board:4}, mine:'stone', time:90, desc:'Fördert Steine aus dem Berg.' },
  smelter:    { name:'Eisenhütte', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{out:'iron', inputs:{ironore:1,coal:1}, time:100}, desc:'Schmilzt Erz zu Eisen.' },
  mint:       { name:'Münzprägerei', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{out:'coin', inputs:{gold:1,coal:1}, time:110}, desc:'Prägt Münzen. Als Sold machen sie Verteidiger stärker.' },
  armory:     { name:'Waffenschmiede', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{outs:['sword','shield','spear','bow'], inputs:{iron:1,coal:1}, time:100}, desc:'Schmiedet Schwerter, Schilde, Speere und Bögen.' },
  toolsmith:  { name:'Werkzeugschmiede', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{outs:['hammer','pick','axe','saw','scythe','rod','cleaver','shovel'], inputs:{iron:1,board:1}, time:130}, foodBoost:true, desc:'Schmiedet alle Werkzeuge (Hammer, Spitzhacke, Axt, Säge, Sense, Angel, Beil, Schaufel) – bevorzugt das, was gerade fehlt. Mit Essen deutlich schneller.' },
  donkeyfarm: { name:'Eselzucht', cat:'industrie', size:'M', cost:{board:3,stone:1}, prod:{out:'@donkey', inputs:{grain:1,water:1}, time:200}, space:1, desc:'Züchtet Esel. Sie verstärken stark befahrene Straßen – der Transport wird schneller.' },
  harbor:     { name:'Hafen', cat:'lager', size:'M', cost:{board:3,stone:3}, store:true, coastal:true, desc:'Küstenlager. Zwei Häfen und ein Schiff eröffnen einen Seeweg für Waren.' },
  shipyard:   { name:'Werft', cat:'industrie', size:'M', cost:{board:4,stone:2}, coastal:true, prod:{out:'@ship', inputs:{board:2}, time:240}, desc:'Der Werftarbeiter baut Schiffe, die Waren zwischen Häfen befördern.' },
  barracks:   { name:'Baracke', cat:'militaer', size:'S', cost:{board:2,stone:1}, mil:{cap:2,radius:8}, desc:'Kleiner Posten. Erweitert dein Gebiet.' },
  guardhouse: { name:'Wachhaus', cat:'militaer', size:'S', cost:{board:2,stone:3}, mil:{cap:3,radius:9}, desc:'Fester Posten mit drei Soldaten.' },
  watchtower: { name:'Wachturm', cat:'militaer', size:'M', cost:{board:3,stone:5}, mil:{cap:6,radius:11}, desc:'Hoher Turm, weite Grenzen.' },
  fortress:   { name:'Festung', cat:'militaer', size:'L', cost:{board:4,stone:7}, mil:{cap:9,radius:13}, desc:'Mächtigste Verteidigung, größtes Gebiet.' },
  catapult:   { name:'Katapult', cat:'militaer', size:'M', cost:{board:4,stone:2}, cata:{radius:11, time:220}, desc:'Beschießt feindliche Militärgebäude mit Steinen.' },
  chapel:     { name:'Kapelle', cat:'schmuck', size:'S', cost:{board:1,stone:2}, desc:'Schmuckbau. Tippe sie an – die Glocke läutet!' },
  tithebarn:  { name:'Zehntscheune', cat:'schmuck', size:'M', cost:{board:3,stone:1}, store:true, desc:'Große Strohscheune, dient als kleines Zusatzlager.' },
  market:     { name:'Marktstand', cat:'schmuck', size:'S', cost:{board:2}, desc:'Schmuckbau. Buntes Markttreiben – tippe ihn an!' },
  cottage:    { name:'Wohnhaus', cat:'schmuck', size:'S', cost:{board:2,stone:1}, desc:'Schmuckes Wohnhaus – jede Bauweise sieht anders aus.' },
};
export const BLD_KEYS = Object.keys(BLD);

// Beruf, der beim fertigen Gebäude sichtbar einzieht (Einzugswanderung)
export const PROF_OF = {
  armory:'smith', toolsmith:'toolsmith', mint:'minter', bakery:'baker',
  butcher:'butcher', mill:'miller', brewery:'brewer', smelter:'smelter',
  pigfarm:'pigfarmer', donkeyfarm:'donkeyherder', shipyard:'shipwright',
  coalmine:'miner', ironmine:'miner', goldmine:'miner', granitemine:'miner',
  woodcutter:'woodcutter', forester:'forester', quarry:'quarry',
  fisher:'fisher', hunter:'hunter', farm:'farm',
  sawmill:'carpenter', well:'welldigger',
};

// Werkzeug, das die Fachkraft beim Einzug mitbringen muss (bleibt im Gebäude,
// kehrt bei Flucht/Abriss ins Lager zurück). Innenberufe brauchen keins.
export const TOOL_OF = {
  woodcutter:'axe', sawmill:'saw', quarry:'pick', forester:'shovel',
  farm:'scythe', fisher:'rod', hunter:'bow', butcher:'cleaver',
  coalmine:'pick', ironmine:'pick', goldmine:'pick', granitemine:'pick',
};

// Truppentypen (keine Ränge): Stärke im Nahkampf + Überlegenheits-Dreieck
// Schwert schlägt Speer, Speer schlägt Bogen, Bogen schlägt Schwert (leicht).
// Bogenschützen schießen vor jedem Nahkampf eine Pfeilsalve.
export const STYPES = {
  sword: { name:'Schwertkämpfer', short:'Schwert', str:3, weapons:{sword:1, shield:1} },
  spear: { name:'Speerkämpfer',  short:'Speer',   str:2, weapons:{spear:1} },
  bow:   { name:'Bogenschütze',  short:'Bogen',   str:1, weapons:{bow:1}, ranged:true },
};
export const STYPE_LIST = Object.keys(STYPES);

// gedeckte, erdige Spielerfarben (Stilguide: keine Übersättigung)
export const PLAYER_COLORS = ['#4a6d9c','#a84a38','#c2a24e','#7d5a8a'];
export const PLAYER_COLORS_DARK = ['#33506f','#7d3628','#8f7639','#5d4368'];

// R2: Die Startkiste sah mit 23 Warenarten reich aus, war aber falsch
// gepackt. Gemessen (Spieler 0 als KI, drei Saaten, 20 Spielminuten):
//   - BRETTER waren nach 1 bis 3 Minuten aufgebraucht. Sie sind das einzige,
//     was wirklich bindet - alle 34 baubaren Haeuser kosten sie.
//   - WERKZEUG lag dagegen als totes Gewicht herum: 26 Stueck zum Start,
//     nach 20 Minuten 60 Haemmer, 37 Spitzhacken, 20 Saegen, Sensen, Angeln
//     und Beile. Spitzhacke, Sense, Angel und Beil wurden in keiner Saat
//     jemals unter den Startbestand gedrueckt - der Werkzeugschmied hatte
//     die ersten zwanzig Minuten schlicht keinen Grund zu existieren.
// Die Kiste enthaelt deshalb jetzt mehr von dem, was die Eroeffnung
// wirklich braucht, und weniger von dem, was nur im Lager lag.
// NACHTRAG (Testpartie v166): zwei Spitzhacken sind zu wenig. Steinbruch
// UND jedes Bergwerk binden je eine dauerhaft, der Geologe leiht sich fuer
// jede Tour eine weitere - mit Bruch + einer Mine war das Lager leer, der
// Geologe blieb daheim, ohne Geologe kein Eisen, ohne Eisen keine neuen
// Hacken: Todesspirale, Spiel tot. Vier Hacken tragen Bruch, erste Mine
// und den Geologen gleichzeitig, mit einer in Reserve.
// scythe/rod je 2 (Kritik R3 S2): mit nur einem stand Hof bzw. Fischer
// Nummer zwei still, bis die Eisenkette lief (Sense-Wartemeldung ab
// Minute 4 im Messlauf)
export const START_GOODS = { trunk:16, board:30, stone:20, fish:8, water:6, bread:6, beer:5, sword:3, shield:3, spear:2, bow:3, coal:4, iron:2, coin:2, grain:4, hammer:6, pick:4, axe:2, saw:1, scythe:2, rod:2, cleaver:1, shovel:2 };

// ---------- Militär-Kennzahlen ----------
// KI-Druck je Stufe (aiLevel 1=Leicht, 2=Normal, 3=Schwer). Wirkt in sim.js
// (aiStep): erlaubte Militärgebäude = milBase + t/milGrow, gedeckelt auf
// milMax; grpMax = größte Angriffsgruppe; lossPause = Angriffs-Pause nach dem
// Verlust eines eigenen Postens (Ticks); hqTabu = Hauptquartier samt Umfeld
// (HQ_SCHUTZ) wird NIE angegriffen; hqIv = eigener, langsamer Takt für
// HQ-Angriffe (0 = normaler Angriffstakt). So bekommt das Endspiel die im
// Kritikbericht geforderte Kurve Drohung -> Scharmützel -> Entscheidung,
// statt Leicht-Dampfwalze (F2) oder Kalter-Krieg-Patt (F3).
// edW = Richtungs-Gewicht der Militär-Bauplätze zum Feind hin: LEICHT
// expandiert breit und gemütlich, NORMAL/SCHWER schieben ihre Postenkette
// zielstrebig Richtung Gegner (Kontakt binnen ~30 min auf M-Karten).
export const AI_MIL = {
  // R4: Stufe 1 war nicht zahm, sondern TOT. Gemessen ueber 45 Spielminuten
  // stand sie ab Minute 10 vollstaendig still: Land 339, 16 Gebaeude, 3
  // Posten, 3 Soldaten - vierzig Minuten lang keine einzige Aenderung. Ein
  // Gegner, der sich nie veraendert, ist kein leichter Gegner, sondern gar
  // keiner. milGrow 6000 hiess: ein neuer Posten alle zehn Spielminuten,
  // gedeckelt bei sechs. Jetzt alle gut vier Minuten, gedeckelt bei zehn.
  // Harmlos bleibt sie durch das, was sie harmlos MACHT: Gruppen von
  // hoechstens drei, Hauptquartier tabu, lange Pause nach jedem Verlust.
  // vorlauf  = Soldaten (Besatzungen + Reserve), die zusammenkommen muessen,
  //            BEVOR die KI ueberhaupt angreift. Vorher zog sie los, sobald
  //            zwei Mann abkoemmlich waren - das war kein Feldzug, das war
  //            Tropfenzaehlen, und der Spieler merkte nie einen Druckaufbau.
  // heimwehr = Anteil des Vorlaufs, der zu Hause bleiben MUSS. Verhindert,
  //            dass die KI ihr eigenes Land entbloesst.
  // milNeed  = wie stark der BEDARF (Feinddruck an der Grenze, Platznot)
  //            zusaetzliche Posten erlaubt - ueber die reine Uhr hinaus.
  // bauMax   = Obergrenze gleichzeitiger Baustellen. Ohne Grenze faengt die
  //            KI an, sobald das Material fuer das naechste Haus reicht, und
  //            verzettelt sich: gemessen 176 Rohbauten gegen 289 fertige
  //            Haeuser, bei 8 nur noch 91 Rohbauten und dabei ein Drittel
  //            mehr Soldaten und ein Viertel mehr Gebiet. Die tatsaechliche
  //            Grenze waechst mit der Siedlung (siehe aiStep), das hier ist
  //            die Decke. Eine leichte KI baut behaebiger, eine schwere
  //            haelt mehr Eisen im Feuer.
  1: { grpMax:3,  milBase:2, milGrow:2500, milMax:10,  lossPause:3000, hqTabu:true,  hqIv:0,     edW:0.25, vorlauf:5,  heimwehr:0.5, milNeed:1, bauMax:6 },
  2: { grpMax:6,  milBase:2, milGrow:1000, milMax:12,  lossPause:600,  hqTabu:false, hqIv:12000, edW:0.6,  vorlauf:9,  heimwehr:0.45, milNeed:3, bauMax:8 },
  3: { grpMax:99, milBase:2, milGrow:1000, milMax:999, lossPause:0,    hqTabu:false, hqIv:0,     edW:0.6,  vorlauf:14, heimwehr:0.3,  milNeed:5, bauMax:10 },
};
// Schutzzone um ein Hauptquartier (Knotenabstand): das HQ und Posten in
// diesem Umkreis gelten für die HQ-Regeln oben als "HQ-Angriff".
export const HQ_SCHUTZ = 2.5;
// Angriffsgruppen marschieren zügiger als Fachkräfte (Faktor auf WALK_SPEED)
export const ATK_MARCH = 1.25;
// Sammel-Angriff: Abstand des Sammelpunkts vor dem Ziel (Weltpixel, ~2,5
// Knoten) und maximale Wartezeit dort (Ticks), bis Nachzügler einzeln folgen.
export const MUSTER_DIST = 130;
export const MUSTER_WAIT = 600;

// Bedarfsbremse: reine Erzeuger (Brunnen, Sägewerk, Steinmetz, ...) ruhen,
// wenn vom eigenen Gut SAT_PAUSE Stück ungenutzt lagern, und laufen erst
// unter SAT_RESUME wieder an (Hysterese, damit nichts an der Schwelle
// flattert). Kein hartes Abschalten der Kette: sobald Verbraucher das Gut
// abrufen, sinkt der Bestand und die Produktion springt von selbst an.
// ESSEN IST TEMPO, NICHT PFLICHT (v194). Ein Betrieb mit zugeteiltem Essen
// arbeitet um diesen Faktor schneller - vorher war es glatt das Doppelte,
// und Bergwerke foerderten ohne Mahlzeit ueberhaupt nicht. Gemessen kostete
// das den Erzverbund 45,5 Mahlzeiten je Minute (rund 31 Bauernhoefe); die
// Kette hat deshalb nie jemand zu Ende gebaut. 1,5 laesst dem Essen einen
// spuerbaren Wert, ohne dass ohne Essen alles stillsteht.
export const ESSEN_TEMPO = 1.5;
export const SAT_PAUSE = 60;
export const SAT_RESUME = 50;
// R6: EINE Schwelle fuer alles war zu grob. 60 Bretter auf Halde sind
// Vorrat, 60 Haemmer sind Unsinn - so viele Baustellen hat niemand. Waren
// mit eigener Schwelle bremsen frueher; alles ohne Eintrag bleibt bei
// SAT_PAUSE. Wieder angeworfen wird bei 75 % der Schwelle.
// R11: Alter (in Wachstums-Stichproben), das ein Setzling bzw. ein Jungbaum
// erreichen muss, um eine Stufe weiterzukommen. Steht hier, weil der
// Kartengenerator dem Startwald ein GESTREUTES Alter mitgeben muss - sonst
// reift der ganze Wald im Gleichschritt. Siehe Game.baeumeReifen.
export const BAUM_REIF = 10;

export const SAT_OF = {
  hammer:12, pick:10, axe:10, saw:8, scythe:8, rod:8, cleaver:6, shovel:10,
  sword:24, shield:24, spear:24, bow:24,
  // Bier trinkt nur die Rekrutierung (1 je Rekrut, Reserve maximal 10) -
  // ohne eigene Schwelle braute die Brauerei bis zur Allgemeinschwelle 60
  // weiter, obwohl niemand mehr rekrutierte (Nutzer-Report v186).
  beer:16,
  coin:20, water:40,
};

// ---------- Hilfsfunktionen ----------
export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
export const clamp = (v,a,b)=> v<a?a: v>b?b: v;
export const lerp = (a,b,t)=> a+(b-a)*t;
export function fmtTime(ticks){ const s=Math.floor(ticks/10); const m=Math.floor(s/60); return m+':'+String(s%60).padStart(2,'0'); }

// Kleine Prioritätswarteschlange für A*/Dijkstra
export class MinHeap {
  constructor(){ this.a=[]; }
  get size(){ return this.a.length; }
  push(k,v){ const a=this.a; a.push([k,v]); let i=a.length-1; while(i>0){ const p=(i-1)>>1; if(a[p][0]<=a[i][0]) break; [a[p],a[i]]=[a[i],a[p]]; i=p; } }
  pop(){ const a=this.a; const top=a[0]; const last=a.pop(); if(a.length){ a[0]=last; let i=0; for(;;){ const l=i*2+1,r=l+1; let m=i; if(l<a.length&&a[l][0]<a[m][0])m=l; if(r<a.length&&a[r][0]<a[m][0])m=r; if(m===i)break; [a[m],a[i]]=[a[i],a[m]]; i=m; } } return top; }
}
