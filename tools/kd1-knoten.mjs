// KD1: Was liegt an der Stelle, an der die KI-Planierer einkeilen?
// Laesst Saat laufen, bis ein Planierer >60s in toSite haengt, und seziert
// dann seinen ersten Wegpunkt und seine Umgebung.
import { chromium } from 'playwright';
import { starteSpiel } from './messhelfer.mjs';

const SAAT=Number(process.argv[2]||3001);
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const t0=await starteSpiel(page, {saat:SAAT, groesse:'M', gegner:'1'});
if(t0!==0) throw new Error('Start nicht bei Takt 0');

const d=await page.evaluate(()=>{
  const g=window.__ui.game, m=g.map;
  const ki=g.players.find(p=>p.ai);
  let opfer=null;
  for(let i=0;i<40*600;i++){
    g.step();
    if(g.t%200!==0) continue;
    opfer=g.units.find(u=>!u.dead && u.player===ki.id && u.type==='leveler'
                       && u.state==='toSite' && (u.stallT||0)>600);
    if(opfer) break;
  }
  if(!opfer) return {nix:true};
  const u=opfer;
  const info=(n)=>{
    if(n<0) return 'kein Knoten';
    return { n, xy:m.worldPos(n).map(v=>+v.toFixed(0)), terr:m.terr[n],
      obj:m.obj[n]&127, bld:m.bld[n], bldTyp:m.bld[n]>=0? (g.buildings.get(m.bld[n])?.type+'/'+g.buildings.get(m.bld[n])?.state):null,
      flag:!!m.flag[n], road:!!g.roadAt(n), gehbar:g.gehbar(n, u.bld),
      schatten:g.bauSchatten().has(n) };
  };
  const wp0=u.wp && u.wp[u.wpi||0];
  const hier=m.nearestNode(u.x,u.y);
  const b=g.buildings.get(u.bld);
  // Ringsum: welche Nachbarn sind gehbar?
  const umfeld=hier>=0? m.nbs(hier).map(q=>({q, gehbar:g.gehbar(q,u.bld), bld:m.bld[q]>=0})) : [];
  // Quelle des Weges: erster Wegpunkt gehoert zu welcher Strasse?
  return {
    t:g.t, pos:[+u.x.toFixed(0),+u.y.toFixed(0)], stall:u.stallT, wpi:u.wpi||0, wpn:u.wp?.length,
    wp0: wp0? wp0.map(v=>+v.toFixed(0)) : null,
    wp0Knoten: wp0? info(m.nearestNode(wp0[0],wp0[1])) : null,
    wp1: u.wp && u.wp[1]? info(m.nearestNode(u.wp[1][0], u.wp[1][1])) : null,
    hier: info(hier), umfeld,
    ziel: b? {node:b.node, door:b.door, type:b.type} : null,
    wegVersperrt: wp0? g.wegVersperrt(u, wp0[0], wp0[1]) : null,
  };
});
console.log(JSON.stringify(d,null,1));
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
