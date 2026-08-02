import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:760,height:660},hasTouch:true});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
await page.goto('http://localhost:8901/',{waitUntil:'networkidle'});
await page.click('#bt-free');
await page.selectOption('#f-size','M'); await page.selectOption('#f-ais','0');
await page.fill('#f-seed','11'); await page.click('#f-start');
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(()=>{
  const ui=window.__ui,g=ui.game,m=g.map;
  m.explored.fill(1);
  const TER=window.__TER||null;
  const hq=[...g.buildings.values()].find(b=>b.type==='hq');
  const out={};

  // --- 1) Baum jenseits eines Wassergrabens ---------------------------------
  // Holzfaellerhuette setzen, dann rundum einen Wassergraben ziehen und
  // jenseits davon einen Baum pflanzen. Vorher waehlte der Holzfaeller ihn.
  let hut=null;
  for(const nd of g.nodesInRange(hq.node,6)){
    if(g.canBuild(0,'woodcutter',nd).ok){ hut=g.spawnBuilding(0,'woodcutter',nd,true); break; }
  }
  const WATER=m.terr[[...Array(m.terr.length).keys()].find(i=>m.terr[i]===g.constructor.name?0:0)]; // dummy
  // Wassertyp aus einem vorhandenen Seeknoten ableiten
  let wasserTyp=null;
  for(let i=0;i<m.terr.length;i++){ if(m.fish && m.fish[i]>0){ wasserTyp=m.terr[i]; break; } }
  if(wasserTyp===null) wasserTyp=m.terr.find? null : null;
  // Ring 1 um die Huette fluten, Ring 2 mit Baeumen bepflanzen
  const ring1=m.nbs(hut.node);
  const ring2=[];
  for(const a of ring1) for(const b2 of m.nbs(a)) if(b2!==hut.node && !ring1.includes(b2) && !ring2.includes(b2)) ring2.push(b2);
  for(const a of ring1){ m.terr[a]=wasserTyp; m.obj[a]=0; }
  for(const b2 of ring2){ m.obj[b2]=3; }             // OBJ.TREE = 3
  // alle anderen Baeume in Reichweite entfernen, damit nur die jenseits bleiben
  const job=g.findGatherJob(hut);
  out.baumJenseits = job ? 'FEHLER: '+job.node : 'kein unerreichbarer Baum gewaehlt';
  // Gegenprobe: eine Bruecke aus Land legen -> jetzt MUSS er einen finden
  m.terr[ring1[0]]=m.terr[hut.node];
  const job2=g.findGatherJob(hut);
  out.mitLandbruecke = job2 ? 'Baum gefunden ('+job2.node+')' : 'FEHLER: keiner gefunden';

  // --- 2) Strasse unter der Burg -------------------------------------------
  // Alle Knoten sammeln, die unter dem gezeichneten Burgbild liegen
  const unter=[];
  for(const n of g.nodesInRange(hq.node,4)) if(g.unterHaus(n)) unter.push(n);
  out.knotenUnterBurg=unter.length;
  out.bldFoot = g.bldFoot ? g.bldFoot.hq : 'Notmasse';
  // Strasse quer an der Burg vorbei bauen und pruefen, ob sie durchlaeuft
  let treffer=0, versuche=0;
  for(const ziel of g.nodesInRange(hq.node,5)){
    if(!m.flag[ziel] && !g.canFlag) {}
    const pfad=g.roadPath(0, hq.door, ziel);
    if(!pfad) continue;
    versuche++;
    if(pfad.some(n=>unter.includes(n))) treffer++;
  }
  out.wegeGeprueft=versuche;
  out.wegeUnterBurg=treffer;
  return out;
})));
console.log('ERRORS('+errors.length+')'); errors.forEach(e=>console.log(' -',e));
await browser.close();
