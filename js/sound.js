// Neuland – Sound: synthetisierte Effekte + generative Hintergrundmusik (WebAudio).
export const Sound = {
  ctx:null, master:null, musicGain:null, sfxGain:null,
  sfxOn:true, musicOn:true, started:false,
  _musicTimer:null, _step:0,

  init(){
    if(this.ctx) return;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return;
    this.ctx=new AC();
    this.master=this.ctx.createGain(); this.master.gain.value=0.9;
    this.master.connect(this.ctx.destination);
    this.sfxGain=this.ctx.createGain(); this.sfxGain.gain.value=0.8; this.sfxGain.connect(this.master);
    this.musicGain=this.ctx.createGain(); this.musicGain.gain.value=0.34; this.musicGain.connect(this.master);
    // Raumklang für die Musik: gefiltertes Echo mit Rückkopplung
    this.mDelay=this.ctx.createDelay(1); this.mDelay.delayTime.value=0.31;
    const fb=this.ctx.createGain(); fb.gain.value=0.34;
    const lp=this.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2600;
    const wet=this.ctx.createGain(); wet.gain.value=0.28;
    this.musicGain.connect(this.mDelay);
    this.mDelay.connect(lp); lp.connect(fb); fb.connect(this.mDelay);
    lp.connect(wet); wet.connect(this.master);
  },
  unlock(){ // beim ersten Touch aufrufen
    this.init();
    if(!this.ctx) return;
    if(this.ctx.state==='suspended') this.ctx.resume();
    if(!this.started){ this.started=true; if(this.musicOn) this.startMusic(); }
  },
  setSfx(on){ this.sfxOn=on; },
  setMusic(on){
    this.musicOn=on;
    if(!this.ctx) return;
    if(on) this.startMusic(); else this.stopMusic();
  },

  // ---------- Effekte ----------
  _scale:1,
  env(dur, vol=0.5, attack=0.005){
    const g=this.ctx.createGain();
    const t=this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(vol*this._scale,t+attack);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    g.connect(this.sfxGain);
    return g;
  },
  osc(type,freq,dur,vol=0.4,slide=0){
    if(!this.ctx||!this.sfxOn) return;
    const o=this.ctx.createOscillator();
    o.type=type; o.frequency.value=freq;
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide), this.ctx.currentTime+dur);
    o.connect(this.env(dur,vol));
    o.start(); o.stop(this.ctx.currentTime+dur+0.05);
  },
  noise(dur,vol=0.3,fLow=400,fHigh=3000){
    if(!this.ctx||!this.sfxOn) return;
    const n=this.ctx.sampleRate*dur;
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const f=this.ctx.createBiquadFilter(); f.type='bandpass';
    f.frequency.value=(fLow+fHigh)/2; f.Q.value=0.7;
    src.connect(f); f.connect(this.env(dur,vol));
    src.start();
  },
  sfx(name, scale=1){
    if(!this.ctx||!this.sfxOn) return;
    this._scale=Math.max(0,Math.min(1,scale));
    switch(name){
      case 'tap':    this.osc('sine', 660, 0.06, 0.15); break;
      case 'place':  this.noise(0.12,0.4,120,500); this.osc('sine',110,0.15,0.3,-40); break;
      case 'flag':   this.osc('triangle', 520, 0.1, 0.25); this.osc('triangle', 780, 0.12, 0.2); break;
      case 'road':   this.noise(0.08,0.25,300,900); break;
      case 'chop':   this.noise(0.06,0.55,700,2000); this.osc('square',160,0.06,0.14,-40); break;
      case 'pick':   // Spitzhacke: metallischer Ping auf Stein
        this.noise(0.035,0.45,2200,5200);
        this.osc('triangle',1250,0.09,0.16,-500);
        this.osc('sine',2400,0.05,0.08,-800); break;
      case 'dig':    this.noise(0.09,0.4,150,600); break;
      case 'rustle': this.noise(0.12,0.28,1000,3000); break;
      case 'splash': this.noise(0.1,0.35,1600,5000); this.osc('sine',420,0.12,0.12,-180); break;
      case 'saw':    this.noise(0.16,0.3,700,1600); break;
      case 'bell':   // Kapellenglocke: zwei Teiltöne mit langem Ausklang
        this.noise(0.02,0.2,2000,5000);
        this.osc('triangle',784,1.1,0.3);
        this.osc('sine',1175,0.9,0.14);
        setTimeout(()=>{ this.osc('triangle',784,1.2,0.24); this.osc('sine',1175,1.0,0.11); },650);
        break;
      case 'sheep':  // freches Blöken
        this.osc('sawtooth',430,0.12,0.14,-40);
        setTimeout(()=>this.osc('sawtooth',360,0.2,0.16,-70),110);
        break;
      case 'hammer': this.noise(0.05,0.35,1200,3200); break;
      case 'done':   [440,554,659].forEach((f,i)=> setTimeout(()=>this.osc('triangle',f,0.25,0.25),i*90)); break;
      case 'coin':   this.osc('sine',1200,0.1,0.2); setTimeout(()=>this.osc('sine',1600,0.15,0.18),60); break;
      case 'clash':  this.noise(0.09,0.5,2500,6000); this.osc('square',150,0.08,0.15,-60); break;
      case 'war':    this.osc('sawtooth',110,0.5,0.3,-30); this.noise(0.4,0.2,150,500); break;
      case 'msg':    this.osc('sine',880,0.09,0.15); break;
      case 'recruit':this.osc('triangle',330,0.15,0.2); setTimeout(()=>this.osc('triangle',440,0.18,0.2),110); break;
      case 'boulder':this.noise(0.3,0.5,80,300); break;
      case 'win':    [523,659,784,1047].forEach((f,i)=> setTimeout(()=>this.osc('triangle',f,0.4,0.3),i*160)); break;
      case 'lose':   [392,330,262,196].forEach((f,i)=> setTimeout(()=>this.osc('sawtooth',f,0.45,0.22),i*200)); break;
    }
  },

  // ---------- Generative Musik: moderner Chill-Soundtrack (eigene Komposition) ----------
  _mNoise(t,dur,vol,f1,f2){
    const n=Math.max(1,(this.ctx.sampleRate*dur)|0);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const f=this.ctx.createBiquadFilter(); f.type='bandpass';
    f.frequency.value=(f1+f2)/2; f.Q.value=0.8;
    const gn=this.ctx.createGain();
    gn.gain.setValueAtTime(vol,t);
    gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(f); f.connect(gn); gn.connect(this.musicGain);
    src.start(t);
  },
  _pluck(t,f,vol){
    const o=this.ctx.createOscillator(); o.type='triangle'; o.frequency.value=f;
    const flt=this.ctx.createBiquadFilter(); flt.type='lowpass'; flt.frequency.value=2600;
    const gn=this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001,t);
    gn.gain.linearRampToValueAtTime(vol,t+0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001,t+0.34);
    o.connect(flt); flt.connect(gn); gn.connect(this.musicGain);
    o.start(t); o.stop(t+0.4);
  },
  // weiche Lead-Stimme mit Vibrato für Melodie-Motive
  _lead(t,f,dur,vol){
    const o=this.ctx.createOscillator(); o.type='sine'; o.frequency.value=f;
    const lfo=this.ctx.createOscillator(); lfo.frequency.value=5.2;
    const lg=this.ctx.createGain(); lg.gain.value=f*0.006;
    lfo.connect(lg); lg.connect(o.frequency);
    const gn=this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001,t);
    gn.gain.linearRampToValueAtTime(vol,t+0.06);
    gn.gain.setValueAtTime(vol*0.85,t+dur*0.7);
    gn.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.15);
    o.connect(gn); gn.connect(this.musicGain);
    o.start(t); lfo.start(t); o.stop(t+dur+0.2); lfo.stop(t+dur+0.2);
  },
  startMusic(){
    if(this._musicTimer||!this.ctx) return;
    const BPM=84, STEP=60/BPM/4;                       // entspanntes 16tel-Raster
    const N=(s)=>220*Math.pow(2,s/12);                 // Halbtöne relativ zu A3
    // eigene 8-Takt-Schleife aus schlichten Septakkorden (A-Teil + B-Teil)
    const mk=(root,ints,arp)=>({ pad:ints.map(s=>N(root+s)), bass:N(root-24), arp:arp.map(s=>N(root+s)) });
    const CH=[
      mk(0,[0,3,7,10],[0,7,10,12]),   mk(-4,[0,4,7,11],[0,7,11,12]),
      mk(3,[0,4,7,11],[0,7,11,12]),   mk(-2,[0,4,7,9],[0,7,9,12]),
      mk(0,[0,3,7,10],[0,7,10,12]),   mk(-4,[0,4,7,11],[0,7,11,12]),
      mk(5,[0,3,7,10],[0,7,10,12]),   mk(-2,[0,4,7,9],[0,4,7,9]),
    ];
    // kleine eigene Melodie-Motive (Pentatonik, als Halbton-Schritte + Länge in 16teln)
    const MOTIFS=[
      [[12,2],[10,2],[7,4],[3,4]],
      [[7,2],[10,2],[12,4],[15,4],[12,4]],
      [[3,2],[7,2],[10,2],[7,4],[3,4]],
      [[15,2],[12,2],[10,4],[7,6]],
    ];
    const ARP=[0,1,2,3,2,1,0,2];                        // festes, musikalisches Muster
    this._step=0;
    const play=()=>{
      if(!this.musicOn) return;
      const t=this.ctx.currentTime+0.03;
      const s=this._step++;
      const bar=(s>>4)%8, st=s&15;
      const ch=CH[bar];
      // Pad: drei verstimmte Stimmen, Filter öffnet und schließt sanft
      if(st===0){
        for(const f of ch.pad){
          for(const det of [0.996,1.0,1.004]){
            const o=this.ctx.createOscillator();
            o.type=det===1.0?'triangle':'sawtooth';
            o.frequency.value=f*det;
            const flt=this.ctx.createBiquadFilter(); flt.type='lowpass'; flt.Q.value=0.4;
            const dur=STEP*16;
            flt.frequency.setValueAtTime(620,t);
            flt.frequency.linearRampToValueAtTime(1150,t+dur*0.55);
            flt.frequency.linearRampToValueAtTime(700,t+dur);
            const gn=this.ctx.createGain();
            gn.gain.setValueAtTime(0.0001,t);
            gn.gain.linearRampToValueAtTime(det===1.0?0.028:0.02,t+1.1);
            gn.gain.setValueAtTime(det===1.0?0.028:0.02,t+dur-1.2);
            gn.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.3);
            o.connect(flt); flt.connect(gn); gn.connect(this.musicGain);
            o.start(t); o.stop(t+dur+0.4);
          }
        }
      }
      // runder Bass (Grundton, Oktave als Antwort)
      if(st===0||st===7||st===10){
        const o=this.ctx.createOscillator(); o.type='sine';
        o.frequency.value=ch.bass*(st===10?2:1)*2;
        const gn=this.ctx.createGain();
        gn.gain.setValueAtTime(0.0001,t);
        gn.gain.linearRampToValueAtTime(st===0?0.17:0.11,t+0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001,t+0.45);
        o.connect(gn); gn.connect(this.musicGain);
        o.start(t); o.stop(t+0.5);
      }
      // LoFi-Beat: Kick 1 & "und" von 3, Snare-Hauch auf 3, Hats mit Dynamik
      if(st===0||st===11){
        const o=this.ctx.createOscillator(); o.type='sine';
        o.frequency.setValueAtTime(96,t);
        o.frequency.exponentialRampToValueAtTime(40,t+0.11);
        const gn=this.ctx.createGain();
        gn.gain.setValueAtTime(st===0?0.2:0.12,t);
        gn.gain.exponentialRampToValueAtTime(0.0001,t+0.15);
        o.connect(gn); gn.connect(this.musicGain);
        o.start(t); o.stop(t+0.2);
      }
      if(st===8) this._mNoise(t,0.12,0.045,1100,2800);
      if(st%2===0) this._mNoise(t,0.022,(st===4||st===12)?0.03:0.016,7000,11000);
      if(st===6||st===14) this._mNoise(t,0.05,0.02,3200,5200);   // Shaker
      // Arpeggio: festes Muster, sanfte Anschläge
      if(st%2===0 && Math.random()<0.9){
        const f=ch.arp[ARP[(s>>1)%ARP.length]%ch.arp.length]*2;
        this._pluck(t,f,0.045);
        this._pluck(t+STEP*3,f,0.016);
      }
      // Melodie-Motiv alle zwei Takte, zart obenauf
      if(st===0 && bar%2===1 && Math.random()<0.75){
        const mo=MOTIFS[(Math.random()*MOTIFS.length)|0];
        let off=STEP*2;
        for(const [semi,len] of mo){
          this._lead(t+off, N(semi)*2, STEP*len*0.92, 0.05);
          off+=STEP*len;
        }
      }
      this._musicTimer=setTimeout(play, STEP*1000);
    };
    play();
  },
  stopMusic(){
    if(this._musicTimer){ clearTimeout(this._musicTimer); this._musicTimer=null; }
  },
};
