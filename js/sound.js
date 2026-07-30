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
    this.musicGain=this.ctx.createGain(); this.musicGain.gain.value=0.32; this.musicGain.connect(this.master);
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
  startMusic(){
    if(this._musicTimer||!this.ctx) return;
    const BPM=92, STEP=60/BPM/4;             // 16tel-Raster
    // eigene, schlichte 4-Akkord-Schleife (moll -> träumerisch-modern)
    const CH=[
      { pad:[220.00,261.63,329.63], bass:55.00, arp:[220.00,261.63,329.63,440.00] },
      { pad:[174.61,220.00,261.63], bass:43.65, arp:[174.61,220.00,261.63,349.23] },
      { pad:[196.00,246.94,293.66], bass:49.00, arp:[196.00,246.94,293.66,392.00] },
      { pad:[164.81,196.00,246.94], bass:41.20, arp:[164.81,196.00,246.94,329.63] },
    ];
    this._step=0;
    const play=()=>{
      if(!this.musicOn) return;
      const t=this.ctx.currentTime+0.02;
      const s=this._step++;
      const ch=CH[(s>>4)%4], st=s&15;
      // warmes Pad bei jedem Akkordwechsel (2 leicht verstimmte Sägezähne durch Tiefpass)
      if(st===0){
        for(const f of ch.pad){
          const o=this.ctx.createOscillator(), o2=this.ctx.createOscillator();
          o.type='sawtooth'; o2.type='sawtooth';
          o.frequency.value=f*0.997; o2.frequency.value=f*1.003;
          const flt=this.ctx.createBiquadFilter(); flt.type='lowpass';
          flt.frequency.value=820; flt.Q.value=0.4;
          const gn=this.ctx.createGain();
          const dur=STEP*16;
          gn.gain.setValueAtTime(0.0001,t);
          gn.gain.linearRampToValueAtTime(0.042,t+0.9);
          gn.gain.setValueAtTime(0.042,t+dur-1.1);
          gn.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.2);
          o.connect(flt); o2.connect(flt); flt.connect(gn); gn.connect(this.musicGain);
          o.start(t); o2.start(t); o.stop(t+dur+0.3); o2.stop(t+dur+0.3);
        }
      }
      // Sub-Bass-Muster
      if(st===0||st===3||st===8||st===10){
        const o=this.ctx.createOscillator(); o.type='sine'; o.frequency.value=ch.bass*2;
        const gn=this.ctx.createGain();
        gn.gain.setValueAtTime(0.0001,t);
        gn.gain.linearRampToValueAtTime(0.15,t+0.015);
        gn.gain.exponentialRampToValueAtTime(0.0001,t+0.32);
        o.connect(gn); gn.connect(this.musicGain);
        o.start(t); o.stop(t+0.38);
      }
      // weiche Kick auf den Vierteln
      if(st%4===0){
        const o=this.ctx.createOscillator(); o.type='sine';
        o.frequency.setValueAtTime(105,t);
        o.frequency.exponentialRampToValueAtTime(42,t+0.1);
        const gn=this.ctx.createGain();
        gn.gain.setValueAtTime(0.2,t);
        gn.gain.exponentialRampToValueAtTime(0.0001,t+0.14);
        o.connect(gn); gn.connect(this.musicGain);
        o.start(t); o.stop(t+0.18);
      }
      // Snare-Hauch auf 2 und 4, HiHat-Ticken auf Achteln
      if(st===4||st===12) this._mNoise(t,0.1,0.05,1300,3200);
      if(st%2===0) this._mNoise(t,0.025,(st%4===2)?0.032:0.02,6500,10500);
      // Arpeggio-Pluck mit Echo
      if(st%2===1 && Math.random()<0.65){
        const f=ch.arp[(Math.random()*ch.arp.length)|0]*(Math.random()<0.25?2:1);
        this._pluck(t,f,0.055);
        this._pluck(t+STEP*3,f,0.02);
      }
      this._musicTimer=setTimeout(play, STEP*1000);
    };
    play();
  },
  stopMusic(){
    if(this._musicTimer){ clearTimeout(this._musicTimer); this._musicTimer=null; }
  },
};
