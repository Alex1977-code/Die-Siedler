// Neuland – GELAENDE AUF DER GPU (Weg A: Hoehenfeld + Dreiecksnetz).
//
// WARUM DIESER WEG
// Bis v252 wurde das Gelaende in 2D gemalt: ein Dreiecksnetz mit
// Gouraud-Verlaeufen, darauf weltverankerte Kachelmuster, und fuer das
// Gebirge ein eigener Malpass von rund 2970 Zeilen - Facettenbloecke,
// Wandflanken, Geroellband, Dither-Saum, Firndecke. Das ist ein
// 3D-Problem (Beleuchtung, Material, Verdeckung), von Hand mit einem
// 2D-Pinsel nachgebaut. Jede Eigenschaft, die auf der GPU aus der
// Geometrie faellt, musste dort als eigener Pass gebaut und einzeln
// kalibriert werden - und wurde EINMAL JE CHUNK gebacken, gemessen rund
// 320 ms.
//
// ZWEI BEFUNDE HABEN DEN UMBAU ENTSCHIEDEN
// 1. Die Kamera muss nicht angefasst werden. Die Projektion des Spiels,
//        wx = (spalte + (zeile&1)*0,5) * TILE
//        wy =  zeile*ROWH - hoehe*HSCALE
//    ist eine affine Abbildung des Gitters. Sie geht unveraendert in den
//    Vertex-Shader; Figuren, Gebaeude, HUD, Eingabe und Minikarte bleiben
//    in 2D und wissen von nichts.
// 2. Die ganze Karte passt in eine winzige Textur. Kartengroessen sind
//    96x96, 128x128 und 160x160 Knoten - das Hoehenfeld ist also maximal
//    160x160. Auf der GPU braucht das Gelaende deshalb KEIN Chunking:
//    ein Draw-Call fuer die ganze Karte.
//
// Damit faellt eine ganze Fehlerklasse weg, an der zuletzt gearbeitet
// wurde: Chunknaehte, Kachelnaehte, Bakezeit, das Umschalten der
// Backaufloesung beim Zoomen. Fuer das Gelaende gibt es das alles nicht.
//
// WAS HIER (NOCH) NICHT DRIN IST
// Schritt 1 ist bewusst schmal: Geometrie, Terrainfarbe je Knoten und
// Lambert-Licht pro Bildpunkt aus der ECHTEN Normalen des Hoehenfelds.
// Materialtexturen, Normal-Maps, Schlagschatten und Wasserbewegung
// kommen in den naechsten Schritten. Der Sinn dieser Reihenfolge: die
// entscheidende Frage - liest sich das Gebirge als KOERPER? - haengt an
// Geometrie und Licht, nicht am Material. Wer zuerst Texturen einbaut,
// misst hinterher das Material und nicht die Form.
//
// AUSFALLSICHERHEIT
// Ohne WebGL (oder bei verlorenem Kontext) meldet verfuegbar() falsch,
// und der Renderer malt weiter wie bisher. Der 2D-Weg bleibt vollstaendig
// erhalten - er ist der Rueckfall, nicht Altlast.

import { TILE, ROWH, HSCALE } from './map.js';

// Sonnenrichtung: dieselbe feste Quelle aus Nordwest wie im 2D-Pass
// (eckShade). Der Umbau soll die Beleuchtung TREUER rechnen, nicht anders
// aussehen - gleiche Richtung, gleiche Hoehe.
const LX = 0.75, LY = 0.5, SUNZ = 0.95;

const VERT = `
attribute vec2  aGrid;      // Spalte, Zeile
attribute float aHgt;       // Hoehe in Hoeheneinheiten
attribute vec3  aNrm;       // Knotennormale (schon normiert)
attribute vec3  aCol;       // Grundfarbe der Terrainart an diesem Knoten
uniform vec2  uCam;         // Kameramitte in Weltpixeln
uniform float uZoom;
uniform vec2  uView;        // Ansichtsgroesse in CSS-Pixeln
uniform vec3  uMass;        // TILE, ROWH, HSCALE
varying vec3  vNrm;
varying vec3  vCol;
varying vec2  vWorld;
void main(){
  // GENAU die Projektion des Spiels - kein Modell, keine Perspektive
  float wx = (aGrid.x + mod(aGrid.y, 2.0) * 0.5) * uMass.x;
  float wy =  aGrid.y * uMass.y - aHgt * uMass.z;
  vWorld = vec2(wx, wy);
  vec2 s = (vec2(wx, wy) - uCam) * uZoom + uView * 0.5;
  // Bildschirm -> NDC (y zeigt im Canvas nach unten)
  gl_Position = vec4(s.x / uView.x * 2.0 - 1.0,
                     1.0 - s.y / uView.y * 2.0, 0.0, 1.0);
  vNrm = aNrm;
  vCol = aCol;
}`;

const FRAG = `
precision mediump float;
varying vec3 vNrm;
varying vec3 vCol;
varying vec2 vWorld;
uniform vec3 uSun;          // Richtung zur Sonne (normiert)
void main(){
  vec3 n = normalize(vNrm);
  // NORD-DAEMPFUNG wie im 2D-Pass (eckShade): nordgerichtete Haenge sind
  // in dieser Projektion die bildschirmgestreckten Rueckseiten. Voll
  // beleuchtet standen sie als grelle fahle Dreiecke ueber dem Massivrand.
  // n.y > 0 heisst hier: die Flaeche kippt nach Norden.
  if (n.y > 0.0) n.y *= 0.35;
  n = normalize(n);
  float lam = max(0.0, dot(n, uSun));
  // Rampe wie im 2D-Pass: ebener Boden (Lambert ~0,72) liegt auf dem
  // Mittelton, Schattenflanken sacken ab, volle Sonnenflanke leuchtet auf.
  float v = 0.42 + 0.86 * lam;
  // Ambient aus dem Himmel: Schatten kippen ins Kuehle statt ins Schwarze
  vec3 amb = vec3(0.62, 0.68, 0.80) * 0.18;
  gl_FragColor = vec4(vCol * v + amb * (1.0 - lam), 1.0);
}`;

export class TerrainGL {
  constructor(canvas){
    this.cv = canvas;
    this.gl = null;
    this.bereit = false;
    this._verloren = false;
    try {
      const opt = { alpha:false, antialias:true, depth:false, stencil:false,
                    powerPreference:'high-performance', preserveDrawingBuffer:false };
      this.gl = canvas.getContext('webgl2', opt) || canvas.getContext('webgl', opt);
    } catch(_){ this.gl = null; }
    if(!this.gl) return;
    // Kontextverlust ist auf Mobilgeraeten Alltag (Tab im Hintergrund,
    // Speicherdruck). Ohne Behandlung stuende das Gelaende dann schwarz da.
    canvas.addEventListener('webglcontextlost', (e)=>{
      e.preventDefault(); this._verloren = true; this.bereit = false;
    });
    canvas.addEventListener('webglcontextrestored', ()=>{
      this._verloren = false; this._baueProgramm();
      if(this._karte) this.setzeKarte(this._karte, this._thema);
    });
    this._baueProgramm();
  }
  verfuegbar(){ return !!this.gl && !!this.prog && !this._verloren; }

  _baueProgramm(){
    const gl = this.gl; if(!gl) return;
    const mk = (typ, src)=>{
      const s = gl.createShader(typ);
      gl.shaderSource(s, src); gl.compileShader(s);
      if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
        console.warn('Shader:', gl.getShaderInfoLog(s)); gl.deleteShader(s); return null;
      }
      return s;
    };
    const vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, FRAG);
    if(!vs || !fs){ this.prog = null; return; }
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
      console.warn('Programm:', gl.getProgramInfoLog(p)); this.prog = null; return;
    }
    this.prog = p;
    this.aGrid = gl.getAttribLocation(p, 'aGrid');
    this.aHgt  = gl.getAttribLocation(p, 'aHgt');
    this.aNrm  = gl.getAttribLocation(p, 'aNrm');
    this.aCol  = gl.getAttribLocation(p, 'aCol');
    this.uCam  = gl.getUniformLocation(p, 'uCam');
    this.uZoom = gl.getUniformLocation(p, 'uZoom');
    this.uView = gl.getUniformLocation(p, 'uView');
    this.uMass = gl.getUniformLocation(p, 'uMass');
    this.uSun  = gl.getUniformLocation(p, 'uSun');
    this.bufGrid = gl.createBuffer();
    this.bufHgt  = gl.createBuffer();
    this.bufNrm  = gl.createBuffer();
    this.bufCol  = gl.createBuffer();
    this.bufIdx  = gl.createBuffer();
  }

  // ---------- Netz aufbauen ----------
  // Dieselbe Dreieckszerlegung wie der 2D-Pass, damit die Silhouette
  // identisch bleibt:
  //   p = zeile & 1
  //   Dreieck 1: (x,y) (x+1,y)   (x+p,   y+1)
  //   Dreieck 2: (x,y) (x+p,y+1) (x-1+p, y+1)
  setzeKarte(map, thema, farbeVon){
    const gl = this.gl;
    if(!gl || !this.prog) return;
    this._karte = map; this._thema = thema; this._farbeVon = farbeVon;
    const w = map.w, h = map.h, n = w*h;
    const grid = new Float32Array(n*2);
    for(let y=0; y<h; y++) for(let x=0; x<w; x++){
      const i = y*w + x;
      grid[i*2] = x; grid[i*2+1] = y;
    }
    // Indexe. 160x160 sind rund 50600 Dreiecke - fuer eine GPU nichts,
    // aber ueber 65535 Knoten kaeme WebGL1 ohne die Erweiterung
    // OES_element_index_uint nicht aus. 160*160 = 25600 Knoten, also
    // reicht Uint16 mit Reserve; groessere Karten muessten den Index
    // aufteilen.
    const idx = new Uint16Array((w-1)*(h-1)*6);
    let k = 0;
    for(let y=0; y<h-1; y++) for(let x=0; x<w-1; x++){
      const p = y & 1;
      const i   = y*w + x;
      const iE  = y*w + (x+1);
      const iSE = (y+1)*w + Math.min(w-1, x+p);
      const iSW = (y+1)*w + Math.max(0, x-1+p);
      idx[k++]=i; idx[k++]=iE;  idx[k++]=iSE;
      idx[k++]=i; idx[k++]=iSE; idx[k++]=iSW;
    }
    this.anzIdx = k;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufGrid);
    gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.hoehenNeu(map);
    this.farbenNeu(map, farbeVon);
    this.bereit = true;
  }

  // Hoehen und Normalen nachziehen (der Planierer aendert das Gelaende).
  // Die Normale kommt aus zentralen Differenzen in WELTmassen - dieselbe
  // Rechnung wie eckShade im 2D-Pass, nur einmal je Knoten statt je Ecke.
  hoehenNeu(map){
    const gl = this.gl; if(!gl || !this.prog) return;
    const w = map.w, h = map.h, n = w*h;
    const hgt = new Float32Array(n);
    const nrm = new Float32Array(n*3);
    const H = map.hgt;
    for(let y=0; y<h; y++) for(let x=0; x<w; x++){
      const i = y*w + x;
      hgt[i] = H[i];
      const xa = x>0 ? i-1 : i, xb = x<w-1 ? i+1 : i;
      const ya = y>0 ? i-w : i, yb = y<h-1 ? i+w : i;
      // Steigung in Weltpixeln: eine Hoeheneinheit sind HSCALE Pixel,
      // ein Spaltenschritt TILE, ein Zeilenschritt ROWH.
      const sx = (H[xb]-H[xa]) * HSCALE / ((xb===xa?1:(x>0&&x<w-1?2:1)) * TILE);
      const sy = (H[yb]-H[ya]) * HSCALE / ((yb===ya?1:(y>0&&y<h-1?2:1)) * ROWH);
      // Normale der Flaeche z = f(x,y): (-df/dx, -df/dy, 1)
      const l = Math.hypot(sx, sy, 1);
      nrm[i*3]   = -sx/l;
      nrm[i*3+1] = -sy/l;
      nrm[i*3+2] =  1/l;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufHgt);
    gl.bufferData(gl.ARRAY_BUFFER, hgt, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufNrm);
    gl.bufferData(gl.ARRAY_BUFFER, nrm, gl.DYNAMIC_DRAW);
  }

  // Grundfarbe je Knoten. farbeVon(i) liefert [r,g,b] in 0..1 - der
  // Renderer reicht seine Terrainpalette herein, damit die Themenfarben
  // an EINER Stelle stehen bleiben.
  farbenNeu(map, farbeVon){
    const gl = this.gl; if(!gl || !this.prog || !farbeVon) return;
    const n = map.w * map.h;
    const col = new Float32Array(n*3);
    for(let i=0; i<n; i++){
      const c = farbeVon(i);
      col[i*3] = c[0]; col[i*3+1] = c[1]; col[i*3+2] = c[2];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol);
    gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW);
  }

  resize(vw, vh, dpr){
    this.vw = vw; this.vh = vh; this.dpr = dpr;
    if(!this.cv) return;
    this.cv.width = Math.round(vw*dpr);
    this.cv.height = Math.round(vh*dpr);
    this.cv.style.width = vw+'px';
    this.cv.style.height = vh+'px';
  }

  zeichne(cam, himmel){
    const gl = this.gl;
    if(!gl || !this.prog || !this.bereit || this._verloren) return false;
    gl.viewport(0, 0, this.cv.width, this.cv.height);
    gl.clearColor(himmel[0], himmel[1], himmel[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    const bind = (buf, loc, gr)=>{
      if(loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, gr, gl.FLOAT, false, 0, 0);
    };
    bind(this.bufGrid, this.aGrid, 2);
    bind(this.bufHgt,  this.aHgt,  1);
    bind(this.bufNrm,  this.aNrm,  3);
    bind(this.bufCol,  this.aCol,  3);
    gl.uniform2f(this.uCam, cam.x, cam.y);
    gl.uniform1f(this.uZoom, cam.z);
    gl.uniform2f(this.uView, this.vw, this.vh);
    gl.uniform3f(this.uMass, TILE, ROWH, HSCALE);
    const sl = Math.hypot(LX, LY, SUNZ);
    // Richtung ZUR Sonne. Im 2D-Pass steht die Rechnung als
    // dot(N,(−LX,−LY,SUNZ)) mit N=(−sx,−sy,1) da; ausmultipliziert ist das
    // dasselbe wie hier mit N=(−sx,−sy,1) und S=(−LX,−LY,SUNZ).
    gl.uniform3f(this.uSun, -LX/sl, -LY/sl, SUNZ/sl);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    gl.drawElements(gl.TRIANGLES, this.anzIdx, gl.UNSIGNED_SHORT, 0);
    return true;
  }
}
