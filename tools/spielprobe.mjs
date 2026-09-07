// Spielprobe: misst, was Spannung ausmacht - mit einem Spieler, der
// wirklich spielt.
//
// WARUM ES SIE BRAUCHT. Alle bisherigen Messlaeufe liessen Spieler 0
// still sitzen: ein Hauptquartier, kein Ausbau, keine Grenze. Fragen wie
// "greift die KI an?" sind damit nicht zu beantworten - es gab schlicht
// nichts anzugreifen. Ein Lauf ueber 60 Spielminuten meldete pflichtschuldig
// null Angriffe, und das sagte ueber das Spiel genau nichts aus.
//
// WER HIER SPIELT. Nicht ein von Hand geskriptetes Drehbuch, sondern die
// KI des Spiels selbst, auf Spieler 0 angesetzt (players[0].ai=true). Zwei
// Gruende: sie baut nachweislich eine vollstaendige Wirtschaft, und sie
// ist derselbe Massstab, an dem sich der Gegner misst. Der Code ist darauf
// vorbereitet - die Rivalen-Suche in aiStep nennt "reine KI-Partien (und
// Messlaeufe)" ausdruecklich und faellt auf den staerksten Anderen zurueck.
//
// WAS SIE NICHT IST: ein Urteil ueber Spielspass. Sie misst Druck, Tempo
// und Stillstand - Zahlen, an denen sich ablesen laesst, OB ueberhaupt
// etwas passiert. Ob es Freude macht, sagt sie nicht.
//
//   node tools/spielprobe.mjs [saat ...]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';

const SAATEN = process.argv.slice(2).map(Number).filter(Boolean);
const SEEDS = SAATEN.length ? SAATEN : [11, 23, 4242];
const MINUTEN = 60, TAKTE_JE_MIN = 600, PROBE = 5;

const browser = await chromium.launch({ executablePath: process.env.CHROME
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

const alle=[];
for(const saat of SEEDS){
  const page = await browser.newPage({ viewport:{width:420,height:900} });
  await starteSpiel(page, { saat, groesse:'M', gegner:'1' });
  const r = await page.evaluate(async ({MINUTEN, TAKTE_JE_MIN, PROBE})=>{
    const g=window.__ui.game, m=g.map;
    // Spieler 0 spielt mit - sonst gibt es keine Grenze und nichts zu messen
    g.players[0].ai=true;
    // GLEICHE STUFE FUER BEIDE. Beim ersten Lauf stand Spieler 0 auf
    // Stufe 1 und der Gegner auf 2 - der Konstruktor setzt aiLevel nur
    // fuer Spieler, die schon beim Start KI sind. Ergebnis war 27 zu 59
    // Gebaeude, und das sagte nichts ueber das Spiel, sondern nur ueber
    // meine Messung. Beide bekommen jetzt die Stufe des Gegners.
    g.players[0].aiLevel=g.players[1]?.aiLevel||2;
    const hq0=g.buildings.get(g.players[0].hq);
    let angriffe=0, ersterAngriff=-1, ersterKontakt=-1, erstesBrett=-1, zehnBauten=-1;
    const oc=g.onClash; g.onClash=(...a)=>{ angriffe++; if(ersterAngriff<0) ersterAngriff=g.t; return oc&&oc(...a); };
    // GRENZKONTAKT ist eine Beruehrung, kein Abstand: hat irgendein eigener
    // Knoten einen Nachbarn in Feindhand? Der erste Lauf fragte stattdessen
    // "ist der Feind naeher als sechs Knoten am HAUPTQUARTIER" - der Wert
    // blieb bei 14 stehen und meldete "nie Kontakt", waehrend gleichzeitig
    // zwoelf Angriffe liefen. Das Mass mass das Falsche.
    const beruehrung=()=>{
      for(let n=0;n<m.owner.length;n++){
        if(m.owner[n]!==0) continue;
        for(const q of m.nbs(n)) if(m.owner[q]===1) return true;
      }
      return false;
    };
    // Abstand des naechsten Feindknotens zum eigenen Hauptquartier - als
    // ZWEITE, eigene Zahl (dasselbe Mass wie im Kritikbericht)
    const [hx,hy]=m.worldPos(hq0.node);
    const knoten=Math.hypot(...m.worldPos(m.nbs(hq0.node)[0]).map((v,i)=>v-[hx,hy][i]));
    const grenzAbstand=()=>{
      let d2=Infinity;
      for(let n=0;n<m.owner.length;n++){
        if(m.owner[n]!==1) continue;
        const [x,y]=m.worldPos(n);
        const q=(x-hx)*(x-hx)+(y-hy)*(y-hy);
        if(q<d2) d2=q;
      }
      return d2===Infinity? -1 : Math.round(Math.sqrt(d2)/knoten);
    };
    const zaehleBauten=(pid)=>{ let n=0; for(const b of g.buildings.values())
      if(b.player===pid && b.state==='done') n++; return n; };
    // Stillstand NACH GRUND getrennt. Zusammengezaehlt sagt die Zahl
    // wenig: "Lager voll" ist eine gesunde Bremse, "wartet auf Werkzeug"
    // ist Frust. Der erste Lauf warf beides in einen Topf und meldete
    // 35 % - ohne zu sagen, wovon.
    const stillstand=(pid)=>{
      let fertig=0, satt=0, werkzeug=0, leer=0, pause=0;
      for(const b of g.buildings.values()){
        if(b.player!==pid || b.state!=='done' || b.type==='hq') continue;
        fertig++;
        if(b.worker && !b.worker.present && b.needTool) werkzeug++;
        else if(b.exhausted || b.depleted) leer++;
        else if(b.satPause) satt++;
        else if(b.paused) pause++;
      }
      const q=(n)=> fertig? Math.round(100*n/fertig) : 0;
      return { fertig, satt:q(satt), werkzeug:q(werkzeug), leer:q(leer), pause:q(pause) };
    };
    const proben=[];
    const gesamt=MINUTEN*TAKTE_JE_MIN;
    for(let i=0;i<gesamt;i++){
      g.step();
      if(erstesBrett<0 && (hq0.inv?.board||0)>0) erstesBrett=g.t;
      if(zehnBauten<0 && zaehleBauten(0)>=10) zehnBauten=g.t;
      if(ersterKontakt<0 && i%60===0 && beruehrung()) ersterKontakt=g.t;
      if((i+1)%(PROBE*TAKTE_JE_MIN)===0){
        const sp=stillstand(0);
        proben.push({ min:(i+1)/TAKTE_JE_MIN,
          spieler:zaehleBauten(0), gegner:zaehleBauten(1),
          grenze:grenzAbstand(), angriffe, ...sp,
          meldungen:g.msgs.length });
      }
    }
    const texte=new Map();
    for(const x of g.msgs){ const k=(x.txt||'').slice(0,40); texte.set(k,(texte.get(k)||0)+1); }
    return { proben, angriffe,
      ersterAngriff:ersterAngriff<0?-1:ersterAngriff/600,
      ersterKontakt:ersterKontakt<0?-1:ersterKontakt/600,
      erstesBrett:erstesBrett<0?-1:erstesBrett/600,
      zehnBauten:zehnBauten<0?-1:zehnBauten/600,
      meldungen:g.msgs.length, arten:texte.size,
      haeufigste:[...texte.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3) };
  }, {MINUTEN, TAKTE_JE_MIN, PROBE});
  await page.close();
  alle.push({saat, ...r});

  console.log(`\n===== Saat ${saat} =====`);
  const z=(v)=> v<0? '  nie' : v.toFixed(1).padStart(6);
  console.log(`erstes Brett ${z(r.erstesBrett)} min   10 Gebaeude ${z(r.zehnBauten)} min`);
  console.log(`Grenzkontakt ${z(r.ersterKontakt)} min   erster Angriff ${z(r.ersterAngriff)} min   Angriffe gesamt ${r.angriffe}`);
  console.log(`Meldungen ${r.meldungen}, davon ${r.arten} verschiedene`);
  for(const [t,n] of r.haeufigste) console.log(`   ${String(n).padStart(3)}x  ${t}`);
  console.log('\n min  Spieler Gegner  HQ-Abst  Angriffe |  Betriebe  Lager voll  ohne Werkzeug  erschoepft');
  for(const p of r.proben)
    console.log(`${String(p.min).padStart(4)} ${String(p.spieler).padStart(7)} ${String(p.gegner).padStart(6)} `
      + `${String(p.grenze).padStart(8)} ${String(p.angriffe).padStart(9)} | ${String(p.fertig).padStart(9)} `
      + `${String(p.satt).padStart(10)} % ${String(p.werkzeug).padStart(13)} % ${String(p.leer).padStart(10)} %`);
}
await browser.close();

console.log('\n===== Zusammenfassung =====');
console.log('Saat   Kontakt  1.Angriff  Angriffe  Meldungsarten  Gebaeude S:G nach 60 min');
for(const r of alle){
  const l=r.proben[r.proben.length-1];
  console.log(`${String(r.saat).padStart(4)}   `
    + `${(r.ersterKontakt<0?'nie':r.ersterKontakt.toFixed(0)+' min').padStart(7)}  `
    + `${(r.ersterAngriff<0?'nie':r.ersterAngriff.toFixed(0)+' min').padStart(9)}  `
    + `${String(r.angriffe).padStart(8)}  ${String(r.arten).padStart(13)}  ${String(l.spieler).padStart(8)}:${l.gegner}`);
}
