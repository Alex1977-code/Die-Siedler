// Wie viel BEBAUBARES Land liegt im Startgebiet?
//
// Das Startgebiet ist der Radius des Hauptquartiers (BLD.hq.mil.radius).
// Gemessen wird mit derselben Entfernung, die sim.js fuer die Grenze
// benutzt: Schritte von Nachbar zu Nachbar. Ausgegeben wird je Saat und
// Spieler die Zahl der bebaubaren Knoten, dazu Wasser und Gebirge zum
// Vergleich - und am Ende die Verteilung ueber alle Startplaetze.
//
//   node tools/ki-startland.mjs [radius] [spieler] [groesse] [saaten...]
//
// Der Vergleich alt/neu laeuft ueber git stash: einmal mit dem alten
// map.js laufen lassen, einmal mit dem neuen, dann die Verteilungen
// nebeneinanderlegen.
import { genWorld } from '../js/map.js';
import { TER } from '../js/core.js';

const R      = +(process.argv[2] || 11);
const nPl    = +(process.argv[3] || 2);
const groesse=  (process.argv[4] || 'M');
const saaten = process.argv.slice(5).length
  ? process.argv.slice(5)
  : Array.from({length:40}, (_,k)=> String(k+1));

// Achsenkoordinaten des versetzten Gitters -> Entfernung als Formel
const aq=(x,y)=> x - ((y-(y&1))>>1);
const hexDist=(x1,y1,x2,y2)=>{
  const dq=aq(x1,y1)-aq(x2,y2), dr=y1-y2;
  return (Math.abs(dq)+Math.abs(dq+dr)+Math.abs(dr))>>1;
};

const alle=[], abstaende=[];
for(const s of saaten){
  const g = genWorld({ seed:+s, size:groesse, theme:'gruen', resources:1, playersN:nPl });
  const map = g.map || g;
  const starts = g.starts || g.startNodes;
  for(let p=0;p<starts.length;p++){
    const i=starts[p], cx=map.X(i), cy=map.Y(i);
    let land=0, wasser=0, berg=0, gesamt=0;
    for(let y=Math.max(0,cy-R); y<=Math.min(map.h-1,cy+R); y++)
      for(let x=Math.max(0,cx-R-1); x<=Math.min(map.w-1,cx+R+1); x++){
        if(hexDist(x,y,cx,cy)>R) continue;
        const j=map.idx(x,y); gesamt++;
        if(map.terrOkBuild(j)) land++;
        if(map.terr[j]===TER.WATER) wasser++;
        else if(map.terr[j]===TER.MOUNT) berg++;
      }
    alle.push({saat:+s, spieler:p, land, wasser, berg, gesamt});
  }
  // Abstand der Startplaetze: zu nah beieinander waere der Preis dafuer,
  // dass der Generator jetzt nach Land sucht statt nach Weite.
  for(let a=0;a<starts.length;a++) for(let b2=a+1;b2<starts.length;b2++)
    abstaende.push(hexDist(map.X(starts[a]),map.Y(starts[a]),
                           map.X(starts[b2]),map.Y(starts[b2])));
}

const v=alle.map(x=>x.land).sort((a,b)=>a-b);
const q=(f)=> v[Math.min(v.length-1, Math.floor(v.length*f))];
const mw=Math.round(v.reduce((a,b)=>a+b,0)/v.length);
const schlecht=alle.filter(x=>x.land<150).sort((a,b)=>a.land-b.land);
console.log(JSON.stringify({
  radius:R, spieler:nPl, groesse, saaten:saaten.length, startplaetze:alle.length,
  ringGesamt:alle[0].gesamt,
  land:{ min:v[0], p10:q(0.10), median:q(0.5), mittel:mw, p90:q(0.90), max:v[v.length-1] },
  abstand: (()=>{ const d=abstaende.slice().sort((a,b)=>a-b);
    return d.length? { min:d[0], median:d[Math.floor(d.length/2)],
      mittel:Math.round(d.reduce((a,b)=>a+b,0)/d.length), max:d[d.length-1] } : null; })(),
  unter150: schlecht.length,
  unter100: alle.filter(x=>x.land<100).length,
  schlimmste: schlecht.slice(0,8)
}, null, 1));
