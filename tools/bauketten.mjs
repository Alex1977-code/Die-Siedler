// BAUKETTEN: passen die Baustufen zum fertigen Haus?
//
// Nutzerauftrag: "pruefe ob die baugroessen der haeuser zum fertigzustand
// passen, das muss eine saubere kette ergeben in groesse lage und form".
//
// Die Kette entsteht aus denselben Regeln, die drawBuilding benutzt:
//   Groessenklasse   L/hq -> l,  MINE -> mine,  Turmform -> turm,
//                    S -> s,  sonst m
//   Blatt je Stufe   bld_build_<typ>_<n>, sonst bld_build_<klasse>_<n>
//   Stufenzahl       drei bei turm/mine oder wenn es ein eigenes _3 gibt,
//                    sonst zwei (die generische _3 zeigt das fast fertige
//                    Haus und darf die Enthuellung nicht vorwegnehmen)
//   Zeichenhoehe     scaleOf(blatt, Rueckfall), Breite ueber das
//                    Seitenverhaeltnis; Bergwerke ueber MINE_F
//   Verankerung      dx0 = x - ww/2,  dy0 = y - hh + 10
//
// Geprueft wird dreierlei:
//   GROESSE  waechst die Zeichenhoehe von Stufe zu Stufe und bleibt unter
//            dem fertigen Haus? Ein Rohbau, der groesser ist als das Haus,
//            schrumpft beim Fertigwerden.
//   LAGE     steht der Inhalt in seiner Leinwand mittig? Die Leinwand wird
//            auf den Knoten zentriert - sitzt der Inhalt seitlich darin,
//            springt das Haus beim Stufenwechsel zur Seite.
//   FORM     bleibt das Seitenverhaeltnis in der Naehe des fertigen Hauses?
//            Ein schmaler Turm darf nicht als lange Scheune anfangen.
//
//   node tools/bauketten.mjs [port]
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await br.newPage({viewport:{width:900,height:640}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
// Landschaft waehlbar: die Bergwerke brauchen Erz in Reichweite, das gibt
// es auf der Wiese oft nicht ('kein Bauplatz').
const THEMA=process.argv[2]||null;
await starteSpiel(page,{saat:11, groesse:'M', gegner:'0', thema:THEMA});
// Auf die Bilder warten: asset() liefert erst etwas, wenn das Bild
// dekodiert ist, und beim Start ist nur geladen, was schon gezeichnet
// wurde. Ohne dieses Warten meldete die Probe fuer die Haelfte der
// Haeuser "kein Bild".
await page.evaluate(async ()=>{
  const R=window.__ui.renderer;
  const offen=[...R.assets.values()].filter(i=>i && !i.complete);
  await Promise.all(offen.map(i=>new Promise(r=>{ i.onload=i.onerror=r; })));
});
// GEMESSEN WIRD, WAS DER ZEICHNER ZEICHNET.
// Die erste Fassung rechnete die Massstabsregel nach - und merkte deshalb
// nicht, als die Regel sich aenderte: nach dem Umbau der generischen
// Baustufen meldete sie fuer Holzfaeller und Marktstand weiter die alten
// Zahlen. Eine Pruefung, die die Regel des Geprueften nachbaut, prueft
// nichts. Jetzt wird jedes Haus wirklich gesetzt, auf jede Stufe gestellt
// und aus renderer._bauMasse abgelesen, mit welchen Massen es gezeichnet
// wurde; die Hoehe des HAUSES darin kommt aus dem Alpha-Rahmen des Blattes.
const erg=await page.evaluate(async ()=>{
  const R=window.__ui.renderer, g=window.__ui.game;
  const { BLD } = await import('/js/core.js');
  const hq=g.buildings.get(g.players[0].hq);
  hq.inv=hq.inv||{}; hq.inv.board=200; hq.inv.stone=200;
  const rahmenCache=new Map();
  const rahmen=(key)=>{
    if(rahmenCache.has(key)) return rahmenCache.get(key);
    const img=R.asset(key); let v=null;
    if(img && img.naturalWidth){
      const w=img.naturalWidth, h=img.naturalHeight;
      const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      const t=cv.getContext('2d',{willReadFrequently:true});
      t.drawImage(img,0,0);
      const d=t.getImageData(0,0,w,h).data;
      let x0=w,y0=h,x1=-1,y1=-1;
      for(let y=0;y<h;y++) for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]<=8) continue;
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
      if(x1>=0) v={fw:(x1-x0+1)/w, fh:(y1-y0+1)/h, unten:(h-1-y1)/h,
                   mitte:((x0+x1+1)/2-w/2)/w};
    }
    rahmenCache.set(key,v); return v;
  };
  const zeilen=[];
  for(const typ of Object.keys(BLD)){
    const def=BLD[typ];
    let b=null;
    for(let r=3;r<=32 && !b;r++) for(const n of g.nodesInRange(hq.node,r)){
      if(!g.canBuild(0,typ,n).ok) continue;
      const rr=g.placeBuilding(0,typ,n); if(rr.ok){ b=rr.b; break; } }
    if(!b){ zeilen.push({typ, fehler:'kein Bauplatz'}); continue; }
    b.leveled=true; b.bauerDa=true;
    const total=80+30*((def.cost.board||0)+(def.cost.stone||0));
    const stufen=[];
    for(const f of [0.15,0.5,0.85,-1]){
      if(f<0){ b.state='done'; b.progress=1e9; }
      else { b.state='build'; b.progress=total*f; }
      R._bauMasse && R._bauMasse.delete(b.id);
      R.draw(window.__ui.cam, window.__ui, 16, 16);
      const v=R._bauMasse && R._bauMasse.get(b.id);
      if(!v) continue;
      const [ww,hh,key]=v;
      const ra=rahmen(key);
      stufen.push({stufe:f<0?'fertig':String(f), blatt:key,
        ih:ra?+(hh*ra.fh).toFixed(1):null, iw:ra?+(ww*ra.fw).toFixed(1):null,
        luft:ra?+(hh*ra.unten).toFixed(1):null,
        // LAGE: Mitte des gezeichneten Hauses gegen den Knoten
        mitte:v[3]!==undefined && ra? +((v[3]+ww/2)-v[4]+ra.mitte*ww).toFixed(1) : (ra?+(ww*ra.mitte).toFixed(1):null)});
    }
    // Doppelte Stufen zusammenfassen (bei zwei Blaettern zeigen 0.5 und 0.85 dasselbe)
    const eind=[]; for(const s of stufen) if(!eind.length||eind[eind.length-1].blatt!==s.blatt) eind.push(s);
    g.removeBuilding? g.removeBuilding(b.id) : (b.state='done');
    zeilen.push({typ, groesse:def.size, stufen:eind});
  }
  return zeilen;
});
// ---- auswerten
const P=[];
for(const z of erg){
  if(z.fehler || !z.stufen || z.stufen.length<2){ P.push({typ:z.typ, fehler:z.fehler||'zu wenige Stufen'}); continue; }
  const f=z.stufen[z.stufen.length-1];
  const hs=z.stufen.map(s=>s.ih), ws=z.stufen.map(s=>s.iw);
  let waechst=true, schrumpft=[];
  for(let i=1;i<hs.length;i++) if(hs[i]<hs[i-1]-0.5){ waechst=false; schrumpft.push(`${i}: ${hs[i-1]}->${hs[i]}`); }
  P.push({typ:z.typ, blaetter:z.stufen.map(s=>s.blatt),
    hoehen:hs, breiten:ws, luft:z.stufen.map(s=>s.luft),
    waechst, schrumpft,
    breiteAnteil:ws.slice(0,-1).map(w=>+(w/f.iw).toFixed(2)),
    maxVersatz:+Math.max(...z.stufen.map(s=>Math.abs(s.mitte||0))).toFixed(1)});
}
console.log(JSON.stringify(P,null,1));
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,3));
await br.close();
