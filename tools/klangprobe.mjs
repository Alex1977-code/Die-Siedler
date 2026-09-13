// Klaenge nachmessen statt behaupten.
//
// Ich kann die Effekte nicht abhoeren. Ein neuer Synthesizer-Klang laesst
// sich aber nachrechnen: gerendert wird er in einem OfflineAudioContext,
// gemessen ueber eine Filterbank aus acht Baendern. Damit ist "der
// Mahlstein liegt tief" keine Behauptung, sondern eine Zahl - und
// vergleichbar mit Klaengen, die es schon gibt und die als gelungen
// gelten (boulder tief, hammer mittig, coin hoch).
//
// Was NICHT gemessen wird: alles, was per setTimeout nachkommt. Ein
// Offline-Rendering laeuft in Nullzeit, die Rueckrufe kommen nie. Die
// Zahlen beschreiben also den SOFORT-Teil jedes Klangs - genau den, der
// seinen Charakter traegt.
//
//   node tools/klangprobe.mjs [name ...]
import { chromium } from 'playwright';
const NAMEN = process.argv.slice(2).length ? process.argv.slice(2)
  : ['mill','oven','brew','boulder','hammer','coin','saw','splash'];
const BAENDER = [60,120,250,500,1000,2000,4000,8000];

const browser = await chromium.launch({ executablePath: process.env.CHROME
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-gl=swiftshader'] });
const page = await browser.newPage();
await page.goto((process.env.BAKE_URL||'http://127.0.0.1:8901')+'/index.html', {waitUntil:'load'});
const erg = await page.evaluate(async ({NAMEN, BAENDER})=>{
  const S=(await import('/js/sound.js')).Sound;
  const SR=44100, DAUER=1.2;
  const messe=async (name, mitte)=>{
    const oc=new OfflineAudioContext(1, SR*DAUER, SR);
    S.ctx=oc; S.sfxOn=true; S._scale=1; S._pan=0;
    S.master=oc.createGain(); S.master.gain.value=0.9;
    let ziel=S.master;
    if(mitte){
      const f=oc.createBiquadFilter(); f.type='bandpass';
      f.frequency.value=mitte; f.Q.value=1.4;
      S.master.connect(f); ziel=f;
    }
    ziel.connect(oc.destination);
    S.sfxGain=oc.createGain(); S.sfxGain.gain.value=0.8; S.sfxGain.connect(S.master);
    S.sfx(name);
    const buf=await oc.startRendering();
    const d=buf.getChannelData(0);
    let sum=0, spitze=0, ende=0;
    for(let i=0;i<d.length;i++){
      const v=Math.abs(d[i]); sum+=d[i]*d[i];
      if(v>spitze) spitze=v;
      if(v>0.002) ende=i;
    }
    return { rms:Math.sqrt(sum/d.length), spitze, dauer:ende/SR };
  };
  const out={};
  for(const n of NAMEN){
    const voll=await messe(n, 0);
    const b=[]; for(const f of BAENDER) b.push((await messe(n,f)).rms);
    out[n]={ ...voll, baender:b };
  }
  return out;
}, {NAMEN, BAENDER});
await browser.close();

console.log('Band-Energie in Prozent (60 Hz links, 8 kHz rechts), Schwerpunkt in Hz\n');
console.log('Name      Spitze  Dauer  ' + BAENDER.map(f=>String(f).padStart(5)).join('') + '   Schwerpunkt');
for(const [n,v] of Object.entries(erg)){
  const s=v.baender.reduce((a,b)=>a+b,0)||1;
  const p=v.baender.map(x=>x/s);
  const sp=Math.round(Math.exp(p.reduce((a,x,i)=>a+x*Math.log(BAENDER[i]),0)));
  console.log(`${n.padEnd(9)} ${v.spitze.toFixed(3)}  ${v.dauer.toFixed(2)}s  `
    + p.map(x=>(100*x).toFixed(0).padStart(5)).join('') + `   ${String(sp).padStart(6)} Hz`);
}
