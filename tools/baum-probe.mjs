// BAUM-PROBE: die sechs neuen Baumblaetter im Spiel ansehen.
//
// tree_autumn, tree_dead, tree_palm, tree_stump, tree_willow und
// tree_winter erscheinen nur in bestimmten Landschaften (treeKindOf).
// Der Zeichner teilt jedes Baumbild bei 36 % Hoehe in Stamm und Krone -
// ein zu weit beschnittenes Blatt schneidet die Naht durch die Krone.
// Also je Landschaft ein Bild, in dem die Baeume gross genug sind, um das
// zu sehen.
//
//   node tools/baum-probe.mjs [port]
import { chromium } from 'playwright';
const PORT=+(process.argv[2]||8901);
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const page=await br.newPage({viewport:{width:900,height:640}});
const fehler=[]; page.on('pageerror',e=>fehler.push(e.message));
const ZIEL='/tmp/claude-0/-home-user-Die-Siedler/fbbd5f27-b354-51b2-90dd-1b50b428c3b9/scratchpad/';
for(const thema of ['winter','wueste','sumpf','inseln']){
  await page.goto(`http://127.0.0.1:${PORT}/`, {waitUntil:'load'});
  await page.evaluate(()=>{
    const ui=window.__ui;
    if(!ui || ui.__messRiegel) return;
    ui.__messRiegel=true;
    Object.defineProperty(ui,'paused',{configurable:true,get(){return true;},set(){}});
  });
  await page.click('#bt-free');
  await page.selectOption('#f-size','M');
  await page.selectOption('#f-theme', thema).catch(()=>{});
  await page.selectOption('#f-ais','0');
  await page.fill('#f-seed','11');
  await page.click('#f-start',{noWaitAfter:true});
  for(let k=0;k<40;k++){ await page.waitForTimeout(400);
    if(await page.evaluate(()=>!!(window.__ui&&window.__ui.game))) break; }
  // dorthin fahren, wo die meisten Baeume stehen
  const n=await page.evaluate(()=>{
    const ui=window.__ui, g=ui.game, m=g.map;
    // NUR in der Naehe des Hauptquartiers suchen. Der erste Lauf nahm den
    // dichtesten Fleck der ganzen Karte - der lag bei drei von vier
    // Landschaften am Kartenrand, und dort zeichnet die Gelaendeebene
    // nichts mehr: drei schwarze Bilder.
    const hq=g.buildings.get(g.players[0].hq);
    let best=hq.node,bv=-1;
    for(const i of g.nodesInRange(hq.node, 34)){
      let v=0; for(const q of [i,...m.nbs(i)]){ const o=m.obj[q]&127; if(o===2||o===3) v++; }
      if(v>bv){ bv=v; best=i; }
    }
    const [x,y]=m.worldPos(best);
    ui.cam.x=x; ui.cam.y=y; ui.cam.z=2.6;
    return {best,bv};
  });
  await page.waitForTimeout(1600);
  await page.screenshot({path:ZIEL+`baum_${thema}.png`});
  console.log(thema, JSON.stringify(n));
}
if(fehler.length) console.log('SEITENFEHLER', fehler.slice(0,4));
await br.close();
