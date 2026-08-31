// TEMPOMESSUNG: wie schnell laeuft wer, in Bildpunkten je Takt?
//
// Nutzerbefund "der traeger ist x-mal schneller". Die Zahlen im Quelltext
// sind nicht vergleichbar: WALK_SPEED ist ein Faktor auf Bildpunkte
// (moveToward: speed*40 px je Takt), CARRY_SPEED zaehlt KNOTEN je Takt
// entlang der Strasse. Was schneller aussieht, entscheidet allein der
// zurueckgelegte Bildweg - also den messen.
//
//   node tools/tempomessung.mjs [port]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:640}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page, {saat:11, groesse:'M', gegner:'0'});

// Eine kleine Siedlung aufbauen - im leeren Freispiel ohne Gegner gibt es
// weder Traeger noch Arbeiter, und dann misst man nichts (erster Lauf:
// units Array 0, roads Map 0).
const gebaut=await page.evaluate(()=>{
  const g=window.__ui.game, m=g.map;
  const hq=g.buildings.get(g.players[0].hq);
  hq.inv=hq.inv||{}; hq.inv.board=60; hq.inv.stone=60;
  const aus={strassen:0, bauten:[]};
  // Von der Burgfahne aus eine Strasse legen und daran Betriebe haengen.
  // Zwei Knoten je Abschnitt: benachbarte Fahnen sind zu dicht beieinander
  // (canPlaceFlag lehnt ab), ein Weg braucht also einen Zwischenknoten.
  const gelegt=new Set([hq.door]);
  let kopf=hq.door;
  for(let k=0;k<6;k++){
    let weiter=-1;
    suche:
    for(const nb of m.nbs(kopf)){
      if(gelegt.has(nb)) continue;
      for(const nb2 of m.nbs(nb)){
        if(nb2===kopf || gelegt.has(nb2)) continue;
        if(g.buildRoad(0,[kopf,nb,nb2])){ weiter=nb2; gelegt.add(nb); break suche; }
      }
    }
    if(weiter<0) break;
    gelegt.add(weiter); kopf=weiter; aus.strassen++;
    // an jede zweite Fahne einen Betrieb
    if(k%2===1) for(const typ of ['woodcutter','quarry']){
      for(const n of m.nbs(kopf)){
        if(!g.canBuild(0,typ,n).ok) continue;
        const r=g.placeBuilding(0,typ,n);
        if(r.ok){ aus.bauten.push(typ); break; }
      }
    }
  }
  return aus;
});
console.log('Aufbau:', JSON.stringify(gebaut));

const erg=await page.evaluate(()=>{
  const g=window.__ui.game, m=g.map;
  // 12000 Takte laufen lassen, dabei je Takt die Bildwege sammeln
  const wege={}, letzte=new Map(), letzteC=new Map();
  const notiere=(art, d)=>{ (wege[art]=wege[art]||[]).push(d); };
  for(let t=0;t<12000;t++){
    g.step();
    // 1) Figuren: Weg zwischen zwei Takten
    for(const u of g.units){
      if(u.dead) continue;
      const k='u'+u.id, v=letzte.get(k);
      if(v){ const d=Math.hypot(u.x-v[0], u.y-v[1]); if(d>0.01 && d<40) notiere(u.wtype||u.type||'?', d); }
      letzte.set(k,[u.x,u.y]);
    }
    // 2) Strassentraeger. Gemessen wird mit der Formel des ZEICHNERS
    // (roadPos/roadPts), nicht mit den nackten Knotenorten: der Zeichner
    // setzt die beiden Strassenenden auf die TUERPOSITION und streut die
    // Zwischenknoten um wenige Bildpunkte. Was der Spieler als Tempo
    // wahrnimmt, ist der Weg auf dem Bildschirm - also der hier.
    const R=window.__ui.renderer;
    for(const r of g.roads.values()){
      const c=r.carrier; if(!c) continue;
      const k='r'+r.id, v=letzteC.get(k);
      const [x,y]=R.roadPos(r, c.pos);
      // Nach Zustand trennen: 'carry'/'toPick' ist FAHRT, 'idle' ist das
      // langsame Zurueckdriften zur Streckenmitte (bewusst 0,4-fach).
      // Zusammengeworfen ergaeben sie zwei Haeufungen und einen Median,
      // den es gar nicht gibt.
      if(v){ const d=Math.hypot(x-v[0], y-v[1]);
             if(d>0.01 && d<40) notiere((c.state==='carry'||c.state==='toPick')
                                        ? 'TRAEGER Fahrt' : 'TRAEGER Leerlauf', d); }
      letzteC.set(k,[x,y]);
    }
  }
  const aus={};
  for(const k in wege){
    const a=wege[k]; a.sort((x,y)=>x-y);
    const q=(f)=>+a[Math.min(a.length-1,Math.floor(a.length*f))].toFixed(2);
    aus[k]={ n:a.length, median:q(0.5), mittel:+(a.reduce((s,v)=>s+v,0)/a.length).toFixed(2),
             p10:q(0.1), p90:q(0.9), p99:q(0.99), max:q(0.999),
             // Anteil der Takte, in denen mehr als ein halber Knoten (26 px)
             // zurueckgelegt wurde - das waeren Spruenge, keine Schritte
             spruenge:+(100*a.filter(v=>v>26).length/a.length).toFixed(1),
             gesamt:Math.round(a.reduce((s,v)=>s+v,0)) };
  }
  // Knotenabstand zum Einordnen
  const abst=[];
  for(let i=0;i<400;i++){ const nb=m.nbs(i); if(!nb.length) continue;
    const [ax,ay]=m.worldPos(i), [bx,by]=m.worldPos(nb[0]);
    abst.push(Math.hypot(bx-ax,by-ay)); }
  abst.sort((a,b)=>a-b);
  return {aus, knotenabstand:+abst[abst.length>>1].toFixed(1)};
});
console.log('Knotenabstand (Median):', erg.knotenabstand, 'px\n');
const z=Object.entries(erg.aus).sort((a,b)=>b[1].median-a[1].median);
console.log('Art              Takte   p10   Med   Mittel   p90   p99    max   >26px   Gesamtweg');
for(const [k,v] of z)
  console.log(`${k.padEnd(16)} ${String(v.n).padEnd(7)} ${String(v.p10).padEnd(5)} ${String(v.median).padEnd(5)} `
            + `${String(v.mittel).padEnd(8)} ${String(v.p90).padEnd(5)} ${String(v.p99).padEnd(6)} `
            + `${String(v.max).padEnd(6)} ${String(v.spruenge+' %').padEnd(7)} ${v.gesamt}`);
const tr=erg.aus['TRAEGER Fahrt'];
if(tr) for(const [k,v] of z) if(!k.startsWith('TRAEGER') && v.n>100)
  console.log(`  Traeger / ${k}:  Median ${(tr.median/v.median).toFixed(2)}x   Mittel ${(tr.mittel/v.mittel).toFixed(2)}x`);
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,3));
await br.close();
