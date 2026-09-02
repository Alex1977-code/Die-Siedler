// BAUKETTE-BILD: dieselbe Stelle, Stufe fuer Stufe.
//
// Die Zahlen aus tools/bauketten.mjs sagen, wie gross gezeichnet wird -
// ob die Kette SAUBER aussieht, sagt nur das Bild. Also ein Haus setzen,
// den Fortschritt auf jede Stufe stellen und dieselbe Stelle abfotografieren.
//
//   node tools/bauketteBild.mjs <typ> [typ...]
import { chromium } from 'playwright';
import fs from 'fs';
import { starteSpiel } from './messhelfer.mjs';
const TYPEN=process.argv.slice(2);
const Z='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/bk/';
fs.mkdirSync(Z,{recursive:true});
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const page=await br.newPage({viewport:{width:640,height:520}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
await starteSpiel(page,{saat:11, groesse:'M', gegner:'0'});
for(const typ of TYPEN){
  const da=await page.evaluate((typ)=>{
    const g=window.__ui.game, m=g.map, ui=window.__ui;
    // altes Testhaus weg
    if(window.__probe){ g.removeBuilding? g.removeBuilding(window.__probe) : null; }
    const hq=g.buildings.get(g.players[0].hq);
    let b=null;
    for(let r=4;r<=26 && !b;r++) for(const n of g.nodesInRange(hq.node,r)){
      if(!g.canBuild(0,typ,n).ok) continue;
      const rr=g.placeBuilding(0,typ,n); if(rr.ok){ b=rr.b; break; } }
    if(!b) return null;
    window.__probe=b;
    b.leveled=true; b.bauerDa=true;
    const [x,y]=m.worldPos(b.node);
    ui.cam.x=x; ui.cam.y=y-10; ui.cam.z=2.6;
    return {id:b.id, node:b.node};
  }, typ);
  if(!da){ console.log(typ,'kein Bauplatz'); continue; }
  for(const [name,setz] of [['1',0.2],['2',0.65],['3',0.92],['fertig',-1]]){
    const masz=await page.evaluate(async ([id,f,typ])=>{
      const g=window.__ui.game;
      const { BLD } = await import('/js/core.js');
      const def=BLD[typ];
      // dieselbe Formel wie im Zeichner
      const total=80+30*((def.cost.board||0)+(def.cost.stone||0));
      const b=g.buildings.get(id);
      if(f<0){ b.state='done'; b.progress=1e9; }
      else { b.state='build'; b.progress=total*f; }
      return {total, prog:b.progress};
    },[da.id,setz,typ]);
    await page.waitForTimeout(700);
    await page.screenshot({path:`${Z}${typ}_${name}.png`});
    // was der Zeichner wirklich gezeichnet hat
    const m=await page.evaluate((id)=>{
      const v=window.__ui.renderer._bauMasse && window.__ui.renderer._bauMasse.get(id);
      return v? {ww:+v[0].toFixed(1), hh:+v[1].toFixed(1), blatt:v[2]} : null;
    }, da.id);
    console.log('   %s Stufe %-6s %s', typ, name, JSON.stringify(m));
  }
  console.log(typ,'ok');
}
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,3));
await br.close();
