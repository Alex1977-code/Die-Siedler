// Neuland – Aufbau-Strategie  |  Kern: Konstanten & Hilfsfunktionen
// Alle Inhalte (Grafik, Sound, Texte) sind Eigenkreationen dieses Projekts.

export const TER = { WATER:0, GRASS:1, DESERT:2, MOUNT:3, SNOW:4, SWAMP:5, LAVA:6 };

export const OBJ = { NONE:0, SAPLING:1, TREE2:2, TREE:3, STONE:4, FIELD0:5, FIELD1:6, FIELD2:7, RUIN:8, GATE:9 };

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
};
export const GOOD_LIST = Object.keys(GOODS);
export const FOODS = ['fish','bread','meat'];

// Gebäudedefinitionen. size: S/M/L/MINE. cat für das Baumenü.
export const BLD = {
  hq:         { name:'Hauptquartier', cat:'lager', size:'L', cost:{}, mil:{cap:0,radius:9}, store:true, desc:'Zentrum deiner Siedlung. Lager und Rekrutierung.' },
  storehouse: { name:'Lagerhaus', cat:'lager', size:'M', cost:{board:4,stone:3}, store:true, desc:'Zusätzliches Lager für alle Waren.' },
  woodcutter: { name:'Holzfäller', cat:'basis', size:'S', cost:{board:2}, gather:'tree', out:'trunk', range:8, time:60, desc:'Fällt Bäume und liefert Stämme.' },
  forester:   { name:'Förster', cat:'basis', size:'S', cost:{board:2}, gather:'plant', range:7, time:80, desc:'Pflanzt neue Bäume.' },
  sawmill:    { name:'Sägewerk', cat:'basis', size:'M', cost:{board:2,stone:2}, prod:{out:'board', inputs:{trunk:1}, time:90}, desc:'Sägt Stämme zu Brettern.' },
  quarry:     { name:'Steinmetz', cat:'basis', size:'S', cost:{board:2}, gather:'stone', out:'stone', range:8, time:70, desc:'Baut Felsbrocken zu Steinen ab.' },
  fisher:     { name:'Fischer', cat:'nahrung', size:'S', cost:{board:2}, gather:'fish', out:'fish', range:7, time:70, desc:'Fängt Fische an Gewässern.' },
  hunter:     { name:'Jäger', cat:'nahrung', size:'S', cost:{board:2}, gather:'hunt', out:'meat', range:9, time:120, desc:'Jagt Wild in den Wäldern.' },
  well:       { name:'Brunnen', cat:'nahrung', size:'S', cost:{board:2,stone:1}, prod:{out:'water', inputs:{}, time:80}, desc:'Fördert Wasser.' },
  farm:       { name:'Bauernhof', cat:'nahrung', size:'L', cost:{board:3,stone:3}, gather:'farm', out:'grain', range:6, time:50, desc:'Sät und erntet Getreide auf den umliegenden Feldern.' },
  mill:       { name:'Mühle', cat:'nahrung', size:'M', cost:{board:2,stone:2}, prod:{out:'flour', inputs:{grain:1}, time:90}, desc:'Mahlt Getreide zu Mehl.' },
  bakery:     { name:'Bäckerei', cat:'nahrung', size:'M', cost:{board:2,stone:2}, prod:{out:'bread', inputs:{flour:1,water:1}, time:90}, desc:'Backt Brot aus Mehl und Wasser.' },
  pigfarm:    { name:'Schweinezucht', cat:'nahrung', size:'L', cost:{board:3,stone:3}, prod:{out:'pig', inputs:{grain:1,water:1}, time:140}, desc:'Züchtet Schweine.' },
  butcher:    { name:'Schlachterei', cat:'nahrung', size:'M', cost:{board:2,stone:2}, prod:{out:'meat', inputs:{pig:1}, time:80}, desc:'Verarbeitet Schweine zu Fleisch.' },
  brewery:    { name:'Brauerei', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{out:'beer', inputs:{grain:1,water:1}, time:110}, desc:'Braut Bier für neue Rekruten.' },
  coalmine:   { name:'Kohlebergwerk', cat:'industrie', size:'MINE', cost:{board:4}, mine:'coal', time:90, desc:'Fördert Kohle. Bergleute brauchen Essen.' },
  ironmine:   { name:'Eisenbergwerk', cat:'industrie', size:'MINE', cost:{board:4}, mine:'ironore', time:90, desc:'Fördert Eisenerz. Bergleute brauchen Essen.' },
  goldmine:   { name:'Goldbergwerk', cat:'industrie', size:'MINE', cost:{board:4}, mine:'gold', time:100, desc:'Fördert Golderz. Bergleute brauchen Essen.' },
  granitemine:{ name:'Steinbergwerk', cat:'industrie', size:'MINE', cost:{board:4}, mine:'stone', time:90, desc:'Fördert Steine aus dem Berg.' },
  smelter:    { name:'Eisenhütte', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{out:'iron', inputs:{ironore:1,coal:1}, time:100}, desc:'Schmilzt Erz zu Eisen.' },
  mint:       { name:'Münzprägerei', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{out:'coin', inputs:{gold:1,coal:1}, time:110}, desc:'Prägt Münzen. Als Sold machen sie Verteidiger stärker.' },
  armory:     { name:'Waffenschmiede', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{outs:['sword','shield','spear','bow'], inputs:{iron:1,coal:1}, time:100}, desc:'Schmiedet Schwerter, Schilde, Speere und Bögen.' },
  toolsmith:  { name:'Werkzeugschmiede', cat:'industrie', size:'M', cost:{board:2,stone:2}, prod:{outs:['hammer','pick'], inputs:{iron:1,board:1}, time:130}, foodBoost:true, desc:'Schmiedet Hämmer (Bauarbeiter) und Spitzhacken (Geologen). Mit Essen doppelt so schnell.' },
  donkeyfarm: { name:'Eselzucht', cat:'industrie', size:'M', cost:{board:3,stone:1}, prod:{out:'@donkey', inputs:{grain:1,water:1}, time:200}, desc:'Züchtet Esel. Sie verstärken stark befahrene Straßen – der Transport wird schneller.' },
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
  pigfarm:'pigfarmer', donkeyfarm:'pigfarmer', shipyard:'shipwright',
  coalmine:'miner', ironmine:'miner', goldmine:'miner', granitemine:'miner',
  woodcutter:'woodcutter', forester:'forester', quarry:'quarry',
  fisher:'fisher', hunter:'hunter', farm:'farm',
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

export const START_GOODS = { board:24, stone:16, trunk:6, fish:8, bread:6, beer:5, sword:3, shield:3, spear:2, bow:2, coal:4, iron:2, coin:2, grain:4, water:4, hammer:10, pick:2 };

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
