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
  env(dur, vol=0.5, attack=0.005){
    const g=this.ctx.createGain();
    const t=this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(vol,t+attack);
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
  sfx(name){
    if(!this.ctx||!this.sfxOn) return;
    switch(name){
      case 'tap':    this.osc('sine', 660, 0.06, 0.15); break;
      case 'place':  this.noise(0.12,0.4,120,500); this.osc('sine',110,0.15,0.3,-40); break;
      case 'flag':   this.osc('triangle', 520, 0.1, 0.25); this.osc('triangle', 780, 0.12, 0.2); break;
      case 'road':   this.noise(0.08,0.25,300,900); break;
      case 'chop':   this.noise(0.07,0.5,900,2400); this.osc('square',180,0.05,0.12); break;
      case 'pick':   this.noise(0.05,0.4,1800,4000); this.osc('square',260,0.04,0.1); break;
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

  // ---------- Generative Musik ----------
  // ruhige Pentatonik über Bordun – bewusst schlicht & eigenständig
  startMusic(){
    if(this._musicTimer||!this.ctx) return;
    const scale=[220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
    const beat=0.42; this._step=0;
    const tickMusic=()=>{
      if(!this.musicOn){ return; }
      const t=this.ctx.currentTime;
      const s=this._step++;
      // Bordun alle 16 Schritte
      if(s%16===0){
        const o=this.ctx.createOscillator(), g=this.ctx.createGain();
        o.type='sine'; o.frequency.value=110;
        g.gain.setValueAtTime(0.0001,t);
        g.gain.linearRampToValueAtTime(0.10,t+0.6);
        g.gain.exponentialRampToValueAtTime(0.0001,t+beat*16);
        o.connect(g); g.connect(this.musicGain);
        o.start(t); o.stop(t+beat*16);
        const o2=this.ctx.createOscillator(), g2=this.ctx.createGain();
        o2.type='sine'; o2.frequency.value=164.8;
        g2.gain.setValueAtTime(0.0001,t);
        g2.gain.linearRampToValueAtTime(0.05,t+0.8);
        g2.gain.exponentialRampToValueAtTime(0.0001,t+beat*16);
        o2.connect(g2); g2.connect(this.musicGain);
        o2.start(t); o2.stop(t+beat*16);
      }
      // Melodienote mit Pausen
      if(Math.random()<0.55){
        const note=scale[(Math.random()*scale.length)|0];
        const o=this.ctx.createOscillator(), g=this.ctx.createGain();
        o.type='triangle'; o.frequency.value=note;
        const dur=beat*(Math.random()<0.3?2:1)*0.95;
        g.gain.setValueAtTime(0.0001,t);
        g.gain.linearRampToValueAtTime(0.12,t+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
        o.connect(g); g.connect(this.musicGain);
        o.start(t); o.stop(t+dur+0.05);
      }
      this._musicTimer=setTimeout(tickMusic, beat*1000);
    };
    tickMusic();
  },
  stopMusic(){
    if(this._musicTimer){ clearTimeout(this._musicTimer); this._musicTimer=null; }
  },
};
