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
attribute vec3  aCol;       // Themenfarbe der Terrainart an diesem Knoten
attribute vec4  aW1;        // Anteil Wiese, Wueste, Schnee, Moor
attribute vec4  aW2;        // Anteil Wasser, Fels, Lava, (frei)
uniform vec2  uCam;         // Kameramitte in Weltpixeln
uniform float uZoom;
uniform vec2  uView;        // Ansichtsgroesse in CSS-Pixeln
uniform vec3  uMass;        // TILE, ROWH, HSCALE
varying vec3  vNrm;
varying vec3  vCol;
varying vec2  vWorld;
varying vec2  vGrid;
varying float vHgt;
varying vec4  vW1;
varying vec4  vW2;
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
  vGrid = aGrid;
  vHgt = aHgt;
  // Die Materialanteile sind je Knoten 1 fuer die eigene Art und 0 sonst.
  // Die Interpolation ueber das Dreieck macht daraus von selbst einen
  // weichen Uebergang - dasselbe, was der 2D-Weg mit weichgezeichneten
  // Zellmasken je Terrainart von Hand aufbauen musste, nur umsonst und
  // ohne Kante.
  vW1 = aW1;
  vW2 = aW2;
}`;

const FRAG = `
precision mediump float;
varying vec3 vNrm;
varying vec3 vCol;
varying vec2 vWorld;
varying vec2 vGrid;
varying float vHgt;
varying vec4 vW1;
varying vec4 vW2;
uniform vec3 uSun;          // Richtung zur Sonne (normiert)
uniform sampler2D tHgt;     // Hoehenfeld der ganzen Karte (R, 0..uHMax)
uniform vec3 uHfeld;        // Kartenbreite, -hoehe, uHMax
uniform vec2 uPix;          // Puffergroesse in Geraetepixeln (goldene Stunde)
uniform float uTint;        // wie stark die Themenfarbe das Material faerbt
uniform sampler2D tWiese, tWueste, tSchnee, tMoor, tWasser, tFels, tLava;
uniform vec4 uSk1;          // Kachelmass in Weltpixeln: Wiese,Wueste,Schnee,Moor
uniform vec4 uSk2;          //                          Wasser,Fels,Lava,(frei)

vec3 hol(sampler2D t, float sk){ return texture2D(t, vWorld / sk).rgb; }

void main(){
  // ---- Material: gewichtete Summe der Terrainarten ----
  float sum = dot(vW1, vec4(1.0)) + dot(vW2, vec4(1.0));
  vec3 alb =
      hol(tWiese,  uSk1.x) * vW1.x + hol(tWueste, uSk1.y) * vW1.y
    + hol(tSchnee, uSk1.z) * vW1.z + hol(tMoor,   uSk1.w) * vW1.w
    + hol(tWasser, uSk2.x) * vW2.x + hol(tFels,   uSk2.y) * vW2.y
    + hol(tLava,   uSk2.z) * vW2.z;
  alb /= max(0.001, sum);

  // ---- Themenfarbe daruebergelegt ----
  // Die Kacheln sind fuer alle Klimazonen dieselben; Winterwiese und
  // Wuestenboden bekommen ihren Ton aus der Palette des Spiels. Das
  // Verfahren ist dasselbe wie die 'color'-Glasur im 2D-Weg: die
  // HELLIGKEITSzeichnung der Kachel bleibt stehen, Farbton und Saettigung
  // kommen aus der Palette.
  float lum = dot(alb, vec3(0.299, 0.587, 0.114));
  alb = mix(alb, vCol * (lum / 0.5), uTint);

  // ---- Licht ----
  vec3 n = normalize(vNrm);
  // NORD-DAEMPFUNG wie im 2D-Pass (eckShade): nordgerichtete Haenge sind
  // in dieser Projektion die bildschirmgestreckten Rueckseiten. Voll
  // beleuchtet standen sie als grelle fahle Dreiecke ueber dem Massivrand.
  if (n.y > 0.0) n.y *= 0.35;
  n = normalize(n);
  float lam = max(0.0, dot(n, uSun));

  // ---- Schlagschatten: Marsch durchs Hoehenfeld zur Sonne ----
  // Die ganze Karte liegt als winzige Textur an (max 160x160). Der Strahl
  // laeuft vom Fragment in Weltrichtung der Sonne (LX, LY, SUNZ*HSCALE);
  // steht auf dem Weg ein Knoten hoeher als der Strahl, liegt das Fragment
  // im Schatten. 16 Schritte decken rund sechs Knoten - weiter wirft in
  // diesem Massstab kein Berg. Genau das, was der 2D-Weg als eigene
  // Silhouetten-Geometrie je Chunk gebaut hat (castShadow), nur aus der
  // echten Hoehe und mit weichem Rand aus der Blocker-Ueberhoehung.
  // Der Halbspalten-Versatz ungerader Zeilen wird ignoriert - unter einem
  // halben Knoten Fehler quer zum Strahl, dem weichen Rand nicht anzusehen.
  float schatten = 1.0;
  {
    // Sonnenrichtung in Weltpixeln je Schritt (zur Sonne: +LX/+LY im
    // Bildsinn heisst nach Nordwest = -x/-y in Weltkoordinaten)
    vec2 dW = vec2(-0.75, -0.5) * 26.0;      // 26 px je Schritt
    float dZ = 0.95 * 26.0;                  // Steigung des Strahls
    float z0 = vHgt * 26.0;                  // HSCALE
    vec2 gSchritt = vec2(dW.x / 52.0, dW.y / 44.0);  // TILE, ROWH
    for(int k = 1; k <= 16; k++){
      vec2 gp = vGrid + gSchritt * float(k);
      if(gp.x < 0.0 || gp.y < 0.0 || gp.x > uHfeld.x-1.0 || gp.y > uHfeld.y-1.0) break;
      float hb = texture2D(tHgt, (gp + 0.5) / uHfeld.xy).r * uHfeld.z;
      float ueber = hb * 26.0 - (z0 + dZ * float(k));
      // weicher Rand: knapp drueber daemmert, deutlich drueber deckt
      schatten = min(schatten, 1.0 - clamp(ueber / 30.0, 0.0, 0.62));
    }
  }
  lam *= schatten;
  float v = 0.42 + 0.86 * lam;
  // Ambient aus dem Himmel: Schatten kippen ins Kuehle statt ins Schwarze
  vec3 amb = vec3(0.62, 0.68, 0.80) * 0.18;
  vec3 col = alb * v + amb * (1.0 - lam);

  // ---- Goldene Stunde (vom 2D-Weg uebernommen) ----
  // Dort lagen zwei Vollbild-Auftraege AUF dem fertigen Bild: ein
  // Diagonalverlauf warm (NW) nach kuehl (SO) und ein soft-light-Warmton.
  // Mit der GL-Ebene kippen beide auf dem transparenten 2D-Canvas um
  // (s. Kommentar in render.js) - hier stehen dieselben Rechnungen im
  // Shader, mit denselben Farben und Deckungen.
  vec2 uv = gl_FragCoord.xy / uPix;
  float d = (uv.x + (1.0 - uv.y)) * 0.5;      // 0 oben links .. 1 unten rechts
  float aW = mix(0.12, 0.02, clamp(d/0.55, 0.0, 1.0));
  float aK = 0.10 * clamp((d-0.55)/0.45, 0.0, 1.0);
  col = mix(col, vec3(1.0, 0.808, 0.549), aW);
  col = mix(col, vec3(0.149, 0.204, 0.361), aK);
  // soft-light mit fester Quelle (255,190,120), Deckung 0,16.
  // W3C-Formel je Kanal; fuer s>0,5 mit der sqrt-Naeherung.
  vec3 sl = vec3(sqrt(col.r),
                 col.g + 0.49 * (sqrt(col.g) - col.g),
                 col.b - 0.059 * col.b * (1.0 - col.b));
  col = mix(col, sl, 0.16);
  gl_FragColor = vec4(col, 1.0);
}`;

// Reihenfolge der Materialkanaele. Sie steht an EINER Stelle, damit
// Shader, Attributaufbau und Renderer nicht auseinanderlaufen koennen.
const KANAL = ['wiese','wueste','schnee','moor','wasser','fels','lava'];

export class TerrainGL {
  constructor(canvas){
    this.cv = canvas;
    this.gl = null;
    this.bereit = false;
    this._verloren = false;
    try {
      // antialias:false - MSAA kostet auf schwachen und Software-GPUs ein
      // Vielfaches (im Messlauf unter SwiftShader blockierte das ERSTE
      // Bild den Hauptfaden laenger als 20 Sekunden). Die Gitterdreiecke
      // sind gross; Treppen sieht man nur an der Silhouette, und die
      // bekommt spaeter einen gezielten Kantenpass statt Voll-MSAA.
      const opt = { alpha:false, antialias:false, depth:false, stencil:false,
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
    this.aW1   = gl.getAttribLocation(p, 'aW1');
    this.aW2   = gl.getAttribLocation(p, 'aW2');
    this.uCam  = gl.getUniformLocation(p, 'uCam');
    this.uZoom = gl.getUniformLocation(p, 'uZoom');
    this.uView = gl.getUniformLocation(p, 'uView');
    this.uMass = gl.getUniformLocation(p, 'uMass');
    this.uSun  = gl.getUniformLocation(p, 'uSun');
    this.uTint = gl.getUniformLocation(p, 'uTint');
    this.uPix  = gl.getUniformLocation(p, 'uPix');
    this.uHfeld= gl.getUniformLocation(p, 'uHfeld');
    this.uTHgt = gl.getUniformLocation(p, 'tHgt');
    this.uSk1  = gl.getUniformLocation(p, 'uSk1');
    this.uSk2  = gl.getUniformLocation(p, 'uSk2');
    this.uTex  = KANAL.map(k=>gl.getUniformLocation(p,
      't'+k.charAt(0).toUpperCase()+k.slice(1)));
    this.bufGrid = gl.createBuffer();
    this.bufHgt  = gl.createBuffer();
    this.bufNrm  = gl.createBuffer();
    this.bufCol  = gl.createBuffer();
    this.bufW1   = gl.createBuffer();
    this.bufW2   = gl.createBuffer();
    this.bufIdx  = gl.createBuffer();
    // 1x1-Ersatztextur je Kanal: solange (oder falls) ein Bild fehlt,
    // liefert der Kanal neutrales Mittelgrau - die Themenfarbe aus aCol
    // traegt dann allein, und nichts ist schwarz.
    this.tex = KANAL.map(()=>{
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
                    gl.UNSIGNED_BYTE, new Uint8Array([128,128,128,255]));
      return t;
    });
    this.skala = KANAL.map(()=>225);   // Vorgabe: 512-px-Kachel bei 0,44
    // Hoehenfeld-Textur fuer den Schattenmarsch (8 Bit reichen: Hoehen
    // 0..~12 auf 0..255 sind 0,05 Einheiten Aufloesung, der weiche
    // Schattenrand deckt das dreifache davon)
    this.texHgt = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texHgt);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE,
                  gl.UNSIGNED_BYTE, new Uint8Array([0]));
    this._hMax = 1;
    if(this._bilder) this._bilderAnwenden();
  }

  // ---------- Materialtexturen ----------
  // bilder: { wiese: {img, skala}, fels: {...}, ... } - der Renderer reicht
  // fertig geladene Bilder samt Kachelmass in Weltpixeln herein. Fehlende
  // Kanaele behalten die neutrale Ersatztextur.
  setzeMaterial(bilder){
    this._bilder = bilder;
    this._bilderAnwenden();
  }
  _bilderAnwenden(){
    const gl = this.gl; if(!gl || !this.prog || !this._bilder) return;
    const p2 = (n)=> (n & (n-1)) === 0;
    KANAL.forEach((k, ix)=>{
      const e = this._bilder[k];
      if(!e || !e.img) return;
      const im = e.img;
      const w = im.naturalWidth||im.width, h = im.naturalHeight||im.height;
      if(!w || !h) return;
      gl.bindTexture(gl.TEXTURE_2D, this.tex[ix]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      // Mipmaps nur bei Zweierpotenz (WebGL1-Regel; die Kacheln sind
      // 512/768/1024, also fast immer erfuellt). 768er wie ter_snow
      // laufen ohne Mipmap mit LINEAR - sichtbar erst bei weitem
      // Herauszoomen als leichtes Flirren.
      if(p2(w) && p2(h)){
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if(e.skala) this.skala[ix] = e.skala;
    });
  }

  // ---------- Netz aufbauen ----------
  // Dieselbe Dreieckszerlegung wie der 2D-Pass, damit die Silhouette
  // identisch bleibt:
  //   p = zeile & 1
  //   Dreieck 1: (x,y) (x+1,y)   (x+p,   y+1)
  //   Dreieck 2: (x,y) (x+p,y+1) (x-1+p, y+1)
  setzeKarte(map, thema, farbeVon, firnVon){
    const gl = this.gl;
    if(!gl || !this.prog) return;
    this._karte = map; this._thema = thema; this._farbeVon = farbeVon;
    this.gewichteNeu(map, firnVon);
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
    // Hoehenfeld als Textur (Schattenmarsch im Fragment-Shader)
    {
      let mx = 1;
      for(let i=0; i<n; i++) if(H[i] > mx) mx = H[i];
      this._hMax = mx;
      const px = new Uint8Array(n);
      for(let i=0; i<n; i++) px[i] = Math.max(0, Math.min(255, Math.round(H[i]/mx*255)));
      gl.bindTexture(gl.TEXTURE_2D, this.texHgt);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE,
                    gl.UNSIGNED_BYTE, px);
      // bilinear: der Marsch tastet zwischen den Knoten ab
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    }
  }

  // Materialgewichte je Knoten: 1 fuer die eigene Terrainart, 0 sonst.
  // Die Interpolation ueber die Dreiecke macht daraus den weichen
  // Uebergang (s. Vertex-Shader). Terrainwerte wie in core.js:
  // WATER 0, GRASS 1, DESERT 2, MOUNT 3, SNOW 4, SWAMP 5, LAVA 6.
  // firnVon (optional): liefert je Knoten den Schneedeckungsgrad 0..1 auf
  // dem MASSIV. Damit traegt die Hochflaeche ihre Firndecke: der Fels-
  // Kanal wird anteilig auf den Schnee-Kanal umgebucht. Die Grenze laeuft
  // ueber die Knotengewichte und interpoliert weich den Hang hinab -
  // genau die Uebergangszone, die der 2D-Weg mit Zellmasken, Weich-
  // zeichnern und der Alphakurve 1-(1-a)^3 von Hand gebaut hat.
  gewichteNeu(map, firnVon){
    const gl = this.gl; if(!gl || !this.prog) return;
    this._firnVon = firnVon || this._firnVon;
    const fv = this._firnVon;
    const n = map.w * map.h;
    const w1 = new Float32Array(n*4);
    const w2 = new Float32Array(n*4);
    // Terrainwert -> (Puffer, Kanal): Reihenfolge aus KANAL
    //   w1 = wiese, wueste, schnee, moor   w2 = wasser, fels, lava, frei
    const ZIEL = [ [w2,0], [w1,0], [w1,1], [w2,1], [w1,2], [w1,3], [w2,2] ];
    for(let i=0; i<n; i++){
      const t = map.terr[i];
      const z = ZIEL[t] || ZIEL[1];
      let g9 = 1;
      if(fv && t === 3){                 // TER.MOUNT
        const sn = fv(i);
        if(sn > 0){ w1[i*4+2] = sn; g9 = 1 - sn; }
      }
      z[0][i*4 + z[1]] += g9;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufW1);
    gl.bufferData(gl.ARRAY_BUFFER, w1, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufW2);
    gl.bufferData(gl.ARRAY_BUFFER, w2, gl.DYNAMIC_DRAW);
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
    bind(this.bufW1,   this.aW1,   4);
    bind(this.bufW2,   this.aW2,   4);
    gl.uniform2f(this.uCam, cam.x, cam.y);
    gl.uniform1f(this.uZoom, cam.z);
    gl.uniform2f(this.uView, this.vw, this.vh);
    gl.uniform3f(this.uMass, TILE, ROWH, HSCALE);
    const sl = Math.hypot(LX, LY, SUNZ);
    // Richtung ZUR Sonne. Im 2D-Pass steht die Rechnung als
    // dot(N,(−LX,−LY,SUNZ)) mit N=(−sx,−sy,1) da; ausmultipliziert ist das
    // dasselbe wie hier mit N=(−sx,−sy,1) und S=(−LX,−LY,SUNZ).
    gl.uniform3f(this.uSun, -LX/sl, -LY/sl, SUNZ/sl);
    // Themenfarbe halb auftragen: die Kacheln liefern die Zeichnung, die
    // Palette den Klimaton (Winterwiese fahl, Wuestenfels sandig).
    gl.uniform1f(this.uTint, 0.5);
    gl.uniform2f(this.uPix, this.cv.width, this.cv.height);
    gl.uniform4f(this.uSk1, this.skala[0], this.skala[1], this.skala[2], this.skala[3]);
    gl.uniform4f(this.uSk2, this.skala[4], this.skala[5], this.skala[6], 225);
    for(let k=0; k<KANAL.length; k++){
      gl.activeTexture(gl.TEXTURE0 + k);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[k]);
      gl.uniform1i(this.uTex[k], k);
    }
    gl.activeTexture(gl.TEXTURE0 + KANAL.length);
    gl.bindTexture(gl.TEXTURE_2D, this.texHgt);
    gl.uniform1i(this.uTHgt, KANAL.length);
    const km = this._karte;
    gl.uniform3f(this.uHfeld, km? km.w : 1, km? km.h : 1, this._hMax || 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    gl.drawElements(gl.TRIANGLES, this.anzIdx, gl.UNSIGNED_SHORT, 0);
    return true;
  }
}
