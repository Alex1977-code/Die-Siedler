// Wie abwechslungsreich ist die Musik? - gemessen, nicht gehoert.
//
// Die Musik wird von startMusic() Sechzehntel fuer Sechzehntel geplant.
// Hier laeuft sie an einer VIRTUELLEN Uhr: ctx.currentTime ist ein
// Zaehler, setTimeout wird abgefangen und von Hand weitergeschaltet.
// Damit spielt sich eine halbe Stunde Musik in einer Sekunde ab, und
// jeder erzeugte Ton wird mitgeschrieben (Instrument, Takt, Schritt,
// Tonhoehe).
//
// Gemessen wird daraus:
//   TAKTBILDER   Wie viele VERSCHIEDENE Takte kommen vor? Ein Takt wird
//                auf seine Signatur reduziert: welches Instrument auf
//                welchem Sechzehntel. Zwei Takte mit gleicher Signatur
//                klingen rhythmisch gleich, auch wenn die Akkorde anders
//                sind.
//   WIEDERKEHR   Nach wie vielen Takten wiederholt sich die Signatur des
//                ersten Takts zum ersten Mal? Das ist die gefuehlte
//                Schleifenlaenge des Schlagwerks.
//   ENTROPIE     Shannon-Entropie ueber die Taktsignaturen in Bit. 0 =
//                immer derselbe Takt. Je hoeher, desto weniger vorhersagbar.
//   TONVORRAT    Wie viele verschiedene Tonhoehen kommen vor.
//
//   node tools/musikprobe.mjs [taktzahl]
import { chromium } from 'playwright';
const TAKTE = +(process.argv[2]||600);

const browser = await chromium.launch({ executablePath: process.env.CHROME
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-gl=swiftshader'] });
const page = await browser.newPage();
await page.goto((process.env.BAKE_URL||'http://127.0.0.1:8901')+'/index.html', {waitUntil:'load'});
const r = await page.evaluate(async (TAKTE)=>{
  const S=(await import('/js/sound.js')).Sound;
  const ev=[]; let vt=0;
  // --- Schein-Audiograph: merkt sich nur, WAS wann startet ---
  const par=()=>({ value:0, setValueAtTime(){return this}, linearRampToValueAtTime(){return this},
                   exponentialRampToValueAtTime(){return this}, setTargetAtTime(){return this},
                   cancelScheduledValues(){return this} });
  const knoten=(art)=>({ art, gain:par(), frequency:par(), delayTime:par(), pan:par(),
                   type:'', Q:par(), buffer:null, connect(){return this}, disconnect(){},
                   start(t){ ev.push({art, t:t??vt, f:this.frequency.value}); }, stop(){} });
  const ctx={ sampleRate:44100, state:'running', get currentTime(){ return vt; },
    createOscillator:()=>knoten('osc'), createGain:()=>knoten('gain'),
    createBiquadFilter:()=>knoten('filter'), createDelay:()=>knoten('delay'),
    createStereoPanner:()=>knoten('pan'), createBufferSource:()=>knoten('src'),
    createBuffer:(c,n)=>({ getChannelData:()=>new Float32Array(n) }),
    destination:knoten('out'), resume(){} };
  S.ctx=ctx; S.master=knoten('gain'); S.musicGain=knoten('gain'); S.sfxGain=knoten('gain');
  S.musicOn=true; S._musicTimer=null;
  // setTimeout abfangen: der naechste Sechzehntel-Schritt wird von Hand geholt
  const echt=window.setTimeout;
  let naechster=null, schritt=0;
  window.setTimeout=(fn,ms)=>{ naechster=fn; schritt=ms/1000; return 1; };
  S.startMusic();
  const SCHRITTE=TAKTE*16;
  for(let i=0;i<SCHRITTE && naechster;i++){
    const f=naechster; naechster=null; vt+=schritt; f();
  }
  window.setTimeout=echt;
  return {ev, schritt};
}, TAKTE);
await browser.close();

// --- auswerten ---
const STEP=r.schritt;
const taktLen=STEP*16;
const sig=new Map();          // Takt -> Signatur
for(const e of r.ev){
  const takt=Math.floor(e.t/taktLen+1e-6);
  const st=Math.round((e.t/STEP))%16;
  const s=sig.get(takt)||new Set(); s.add(e.art+st); sig.set(takt,s);
}
const takte=[...sig.keys()].sort((a,b)=>a-b).filter(k=>k>0 && k<TAKTE);
const strs=takte.map(k=>[...sig.get(k)].sort().join(','));
const zaehl=new Map(); for(const s of strs) zaehl.set(s,(zaehl.get(s)||0)+1);
// Vollbild: Rhythmus UND Tonhoehen. Die Signatur oben kennt nur, welches
// Instrument auf welchem Sechzehntel liegt - zwei Takte mit gleichem
// Schlagwerk, aber anderem Akkord sind dort dasselbe. Fuer die Frage
// "wann klingt es wieder genau so" braucht es die Toene dazu.
const voll=new Map();
for(const e of r.ev){
  const takt=Math.floor(e.t/taktLen+1e-6);
  const st=Math.round(e.t/STEP)%16;
  const v=voll.get(takt)||new Set();
  v.add(e.art+st+':'+(e.f>20?Math.round(12*Math.log2(e.f/220)):'-'));
  voll.set(takt,v);
}
const vstrs=takte.map(k=>[...(voll.get(k)||[])].sort().join(','));
let vwieder=-1;
for(let i=1;i<vstrs.length;i++) if(vstrs[i]===vstrs[0]){ vwieder=i; break; }
const vzaehl=new Set(vstrs);
const n=strs.length;
const H=[...zaehl.values()].reduce((a,c)=>{const p=c/n; return a-p*Math.log2(p);},0);
let wieder=-1;
for(let i=1;i<strs.length;i++) if(strs[i]===strs[0]){ wieder=i; break; }
const toene=new Set(r.ev.filter(e=>e.f>20).map(e=>Math.round(12*Math.log2(e.f/220))));
console.log(`${r.ev.length} Toene in ${takte.length} Takten (${(takte.length*taktLen/60).toFixed(1)} Minuten Musik)`);
console.log(`Taktbilder:  ${zaehl.size} verschiedene von ${n} Takten  (${(100*zaehl.size/n).toFixed(1)} %)`);
console.log(`Wiederkehr:  Schlagwerk nach ${wieder<0?'>'+strs.length:wieder} Takten, `
  + `Vollbild nach ${vwieder<0?'>'+vstrs.length:vwieder} Takten `
  + `(${vwieder<0?'nie in dieser Messung':(vwieder*taktLen).toFixed(0)+' s'})`);
console.log(`Vollbilder:  ${vzaehl.size} verschiedene von ${n} Takten  (${(100*vzaehl.size/n).toFixed(1)} %)`);
console.log(`Entropie:    ${H.toFixed(2)} Bit  (0 = immer derselbe Takt)`);
console.log(`Tonvorrat:   ${toene.size} verschiedene Tonhoehen`);
const top=[...zaehl.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
console.log(`Haeufigstes Taktbild kommt ${top[0][1]}x vor = ${(100*top[0][1]/n).toFixed(1)} % aller Takte`);
