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
// TILE, ROWH, HSCALE fuer den Schattenmarsch. EIGENER Name: der
// Vertex-Shader fuehrt uMass in hoher Genauigkeit (Weltpixel bis ~6600,
// mediump waere dort auf einige Pixel genau), der Fragment-Shader
// rechnet mediump - gleicher Name mit anderer Praezision laesst das
// Programm nicht mehr linken ("Precisions of uniform 'uMass' differ").
// Hier stehen nur die kleinen Massstabszahlen, mediump reicht.
uniform vec3 uMassF;
uniform sampler2D tHgt;     // Hoehenfeld der ganzen Karte (R, 0..uHMax)
uniform vec3 uHfeld;        // Kartenbreite, -hoehe, uHMax
uniform vec2 uPix;          // Puffergroesse in Geraetepixeln (goldene Stunde)
uniform float uTint;        // wie stark die Themenfarbe das Material faerbt
uniform sampler2D tWiese, tWueste, tSchnee, tMoor, tWasser, tFels, tLava;
uniform vec4 uSk1;          // Kachelmass in Weltpixeln: Wiese,Wueste,Schnee,Moor
uniform vec4 uSk2;          //                          Wasser,Fels,Lava,(frei)
uniform float uZeit;        // Sekunden, Echtzeit (Wasser lebt auch in Pause)
uniform float uSchattenAn;  // Diagnoseschalter wie _ohneCast im 2D-Weg
uniform float uDebug;       // 0 normal, 1 Gewichte als Farben, 2 Licht als Grau
uniform float uZoomF;       // Kamerazoom. EIGENER Name, nicht uZoom: derselbe
                            // Uniform-Name in VERT (highp) und FRAG (mediump)
                            // laesst das Programm nicht linken ("Precisions of
                            // uniform differ") - dieselbe Falle wie bei uMassF.
                            // Gebraucht fuer die Feinzeichnung: Blueten,
                            // Grundsteine und Bergspitzen sind bei weitem Zoom
                            // kleiner als ein Bildpunkt und flimmern dann.
uniform vec3 uFelsCol;      // Felsfarbe des Themas (fester Ton, NICHT das
                            // interpolierte vCol - das mischt am Massivrand
                            // Wiesengruen hinein)
uniform vec3 uG[8];         // Grundfarben LINEAR (Cartoon-Spez Variante 5):
                            // wiese,wueste,schnee,moor,wasserFlach,fels,
                            // lava,wasserTief - die Kachel liegt nur noch
                            // mit ~25 % Deckkraft darueber

// Materialprobe mit KOORDINATEN-WARP gegen das Wiederholraster: traege
// Ortswellen (571/698 px, bewusst inkommensurabel zur 430er-Felskachel)
// verbiegen die Abtastkoordinate um bis zu +-30 px - jede Kachelinstanz
// sieht dadurch anders aus, Fugen laufen nicht mehr als gerade Rasterlinien.
// Der Vorgaenger (2x2-Spiegel-Grosskachel, v263) erzeugte Symmetrieachsen
// mit Schmetterlingsfugen - Symmetrie faellt dem Auge noch schneller auf
// als Wiederholung (Nutzerfoto v264). Der Warp ist GLATT, die Ableitungen
// bleiben stetig - die Mip-Wahl kippt nirgends.
vec3 hol(sampler2D t, float sk){
  vec2 w = vWorld + vec2(
    30.0*sin(vWorld.y*0.011 + 1.7*sin(vWorld.x*0.0043)),
    26.0*sin(vWorld.x*0.009 - 1.3*sin(vWorld.y*0.0047)));
  return pow(texture2D(t, w / sk).rgb, vec3(2.2));   // sRGB -> linear
}

// ---- LICHTAUFBAU NACH DEM STILGUIDE "STYLIZED DIORAMA RENDER" (v288) ----
// Verbindlich sind: EINE warme, tiefstehende Sonne von oben links
// (#FFE2B8, Hoehenwinkel 35 Grad), eine Hemisphaeren-Aufhellung
// (Himmel #CFE2FF, Boden #8A7A5C) und ein neutrales Rundum-Licht.
// KEIN zweites gerichtetes Licht - das frueher hier stehende C_FILLDIR
// ist raus (Spez: "Fill: HemisphereLight"). Die Form auf der
// Schattenseite traegt jetzt die Verdeckungsrechnung (AO), nicht ein
// zweiter Scheinwerfer; genau so entsteht der Diorama-Eindruck.
//
// Hoehenwinkel: sin(35 Grad) = 0,574. Der Azimut bleibt wie gehabt
// (Einheitsrichtung in der Bildebene -0,641/-0,767), mit cos(35 Grad)
// = 0,819 skaliert. Vorher standen 0,699, also 44,4 Grad - die Sonne
// steht jetzt tiefer und streift die Haenge staerker.
const vec3 C_KEYDIR  = vec3(-0.525, -0.628, 0.574);
const vec3 C_RIMDIR  = vec3( 0.200,  0.750, 0.630);
const vec3 C_VDIR    = vec3( 0.000, -0.349, 0.937);
// Lichtfarben und -staerken aus dem Stilguide. Die Zahlen dort sind
// three.js-Einheiten (die Sprite-Baeckerei rechnet damit), hier steht ein
// eigener Shader: uebernommen werden die FARBEN und die VERHAELTNISSE,
// die Gesamthelligkeit stellt LICHT_SKALA. Sie ist so kalibriert, dass
// die mittlere Bildhelligkeit gegenueber v287 (gemessen 141,3) gleich
// bleibt - die Umstellung soll als Lichtwechsel lesen, nicht als
// Belichtungssprung.
const vec3  C_SONNE  = vec3(1.000, 0.886, 0.722);   // #FFE2B8
const vec3  C_HIMMEL = vec3(0.812, 0.886, 1.000);   // #CFE2FF
const vec3  C_GRUND  = vec3(0.541, 0.478, 0.361);   // #8A7A5C
const float I_SONNE  = 2.50;
const float I_HEMI   = 0.60;
const float I_ENV    = 0.30;
const float LICHT_SKALA = 0.402;

// ACES-Tonemapping (Spez Abschnitt 6)
vec3 aces(vec3 x){
  return clamp((x * (2.51*x + 0.03)) / (x * (2.43*x + 0.59) + 0.14), 0.0, 1.0);
}

// ---- Steinblockwerk: der Fels im Stil der gemalten Steinhaufen ----
// Nutzerentscheid nach v267: "die berge sollen den stil der steinhaufen
// haben" - also einzelne, plastisch gewoelbte Bloecke mit eigenem Ton
// und schmalen dunklen Fugen, wie die obj_-Felsobjekte. Prozedural als
// Voronoi: jede Zelle ein Stein. Der Ton kommt aus dem Zell-Hash, die
// Woelbung aus der Richtung zum Steinzentrum (Nordwest-Seite hell, wie
// die Sprites gemalt sind), die Fuge aus dem Abstand zweier Zentren.
vec2 sh2(vec2 z){
  float h = fract(sin(dot(z, vec2(127.1, 311.7))) * 43758.5453);
  return vec2(h, fract(h * 167.17));
}
vec3 steine(vec3 grund){
  float SK = 34.0;                       // Steingroesse in Weltpixeln
  vec2 u = vWorld / SK;
  // Zellraster leicht verbiegen, sonst stehen die Steine in Reihen
  u += 0.35 * vec2(sin(u.y*1.7), sin(u.x*1.9));
  vec2 zi = floor(u), zf = u - zi;
  float d1 = 8.0, d2 = 8.0; vec2 best = vec2(0.0); vec2 bid = vec2(0.0);
  for(int dy=-1; dy<=1; dy++)
  for(int dx=-1; dx<=1; dx++){
    vec2 nb = vec2(float(dx), float(dy));
    vec2 p = nb + sh2(zi + nb) - zf;     // Fragment -> Nachbarzentrum
    float d = dot(p, p);
    if(d < d1){ d2 = d1; d1 = d; best = p; bid = zi + nb; }
    else if(d < d2){ d2 = d; }
  }
  vec2 h = sh2(bid + 7.3);
  float ton = 0.84 + 0.30 * h.x;         // jeder Stein ein eigener Ton
  // Woelbung: best zeigt vom Fragment zum Zentrum; auf der Nordwest-
  // Seite des Steins zeigt es nach Suedost (x+y > 0) -> Lichtseite
  vec2 nrm = best / max(0.001, length(best));
  float licht = 0.5 + 0.5 * clamp((nrm.x + nrm.y) * 0.7, -1.0, 1.0);
  float fuge = 1.0 - smoothstep(0.04, 0.16, sqrt(d2) - sqrt(d1));
  vec3 c = grund * ton * (0.82 + 0.34 * licht);
  return mix(c, grund * 0.45, fuge * 0.7);
}

// ---- Steine auf dem Sandgrund (Flachwasser) ----
// steine() oben pflastert die ganze Flaeche - auf dem Meeresgrund liegen
// aber EINZELNE Steine im Sand (Stilguide, Abschnitt Wasser). Dieselbe
// Voronoi-Zerlegung, aber nur ein Teil der Zellen traegt einen Stein, und
// der ist rund statt zellfuellend.
vec3 grundSteine(vec3 sand, float sicht){
  if(sicht < 0.02) return sand;
  float SK = 34.0;                              // kleinere Zellen: im
  vec2 u = vWorld / SK;                         // schmalen Schelf trafen
  u += 0.30 * vec2(sin(u.y*1.6), sin(u.x*1.8)); // 46er Zellen zu selten
  vec2 zi = floor(u), zf = u - zi;
  vec3 c = sand;
  for(int dy=-1; dy<=1; dy++)
  for(int dx=-1; dx<=1; dx++){
    vec2 nb = vec2(float(dx), float(dy));
    vec2 h = sh2(zi + nb);
    if(h.x < 0.62) continue;                    // gut ein Drittel der Zellen
    vec2 p = nb + h - zf;
    float r = 0.17 + h.y * 0.17;
    float d = length(p);
    float m = 1.0 - smoothstep(r*0.70, r, d);
    if(m <= 0.001) continue;
    // Woelbung wie bei den gemalten Steinen: Nordwestseite hell
    vec2 nn = p / max(0.001, d);
    float li = 0.5 + 0.5 * clamp((nn.x + nn.y) * 0.8, -1.0, 1.0);
    vec3 st = vec3(0.26, 0.25, 0.23) * (0.68 + 0.66*li) * (0.86 + 0.34*h.y);
    // weicher Fuss im Sand: ohne ihn liegen die Steine als flache
    // Scheiben AUF dem Grund statt darin (Beleg d_ufer_r5)
    float ms = 1.0 - smoothstep(r*0.92, r*1.45, d);
    c = mix(c, sand * 0.70, ms * 0.50 * sicht);
    c = mix(c, st, m * sicht);
  }
  return c;
}

// ---- Blueten im Gras ----
// Stilguide: "sattes Gelbgruen mit winzigen hellen Blueten-Sprenkeln".
// Ein Punkt je Rasterzelle, nur ein Fuenftel der Zellen traegt einen, die
// Farbe wechselt zwischen cremeweiss und blassgelb. Bei weitem Zoom
// ausgeblendet (unter einem Bildpunkt flimmert es sonst).
// ERSTER WURF VERWORFEN (im Beleg t68 nachzusehen): Zellraster 17 px,
// jede fuenfte Zelle, Punktradius bis 0,115 Zellen, Deckung 0,80 - und
// aufgetragen auf mWiese. Das gab weisses Konfetti ueber die halbe Karte,
// und zwar AUCH auf Wasser und Sand: mWiese steckt ueber die Bergwiese
// (berggras) und die Uferblenden in Flaechen, die gar keine Wiese sind.
// Jetzt: groebere Zellen, ein Achtel davon traegt eine Bluete, halber
// Radius, halbe Deckung - und aufgetragen wird NACH der Materialmischung
// auf den fertigen Farbwert, gewichtet mit dem Grasanteil.
vec3 blueten(vec3 gras, float fein){
  if(fein < 0.02) return gras;
  float BK = 24.0;
  vec2 u = vWorld / BK;
  vec2 zi = floor(u), zf = u - zi;
  vec2 h = sh2(zi);
  if(h.x < 0.88) return gras;
  vec2 p = zf - vec2(h.y, fract(h.x * 31.7));
  float m = 1.0 - smoothstep(0.028, 0.058, length(p));
  if(m <= 0.001) return gras;
  vec3 bl = mix(vec3(1.00, 0.97, 0.86), vec3(0.98, 0.90, 0.55), fract(h.y*7.1));
  return mix(gras, bl, m * 0.55 * fein);
}

// ---- Wasser: zwei driftende Lagen + leises Glitzern ----
// Der 2D-Weg brauchte dafuer Muster-Transformationen je Frame, einen
// 1/6-Offscreen und Stempel-Schleifen (waterStamps). Hier sind es zwei
// Texturabfragen mit wandernden Koordinaten und zwei Sinuszuege, deren
// Produkt nur an den Spitzen ueber die Schwelle kommt - Funkeln statt
// Streifen, deterministisch aus Ort und Zeit.
// ---- Wasser (Cartoon-Spez Variante 5, Abschnitt 5/7) ----
// Tiefengradient flach->tief, Ripple aus der driftenden Kachel plus dem
// traegen Funkel-Sinus (v263: unregelmaessig, halbes Tempo), Glitzern
// als Schwellenwert, Schaum rechnerisch an der Uferlinie. Die aw-Rampe
// der Materialgewichte ist weiter der Tiefen-Ersatz.
vec3 wasser(float aw, float rausch){
  vec2 uv = vWorld / uSk2.x;
  vec3 a = texture2D(tWasser, uv + vec2(uZeit*0.005, uZeit*0.003)).rgb;
  vec3 b = texture2D(tWasser, uv*1.7 + vec2(-uZeit*0.0035, uZeit*0.0055)).rgb;
  float ripple = dot(mix(a, b, 0.40), vec3(0.3333));
  float wx = vWorld.x + 26.0*sin(vWorld.y*0.013 + uZeit*0.07);
  float wy = vWorld.y + 22.0*sin(vWorld.x*0.011 - uZeit*0.055);
  ripple = clamp(ripple + 0.18*sin(wx*0.051 + uZeit*0.55)*sin(wy*0.0407 - uZeit*0.41), 0.0, 1.0);
  // Beleg t37: die erste Fassung (Rampe 0,45-0,95, Schaum 0,8 voll weiss
  // auf enger Schwelle) legte einen gleichmaessigen Leuchtsaum um jede
  // Kueste - wie ein Kontur-Effekt. Das Referenzbild hat einen BREITEN,
  // unregelmaessigen Flachwasserschelf mit fleckigen Schaumkronen: darum
  // wird die Tiefenrampe mit dem Ortsrauschen verbogen (Schelfbreite
  // schwankt mit 60-150 px Wellenlaenge) und der Schaum haengt an einer
  // Fleckenmaske aus Ripple und Rausch statt am durchlaufenden Sinus.
  float tiefe = smoothstep(0.30, 0.98, aw + (rausch - 0.5) * 0.35);
  vec3 farbe = mix(uG[4], uG[7], tiefe);
  // SANDGRUND IM FLACHWASSER (Stilguide): "im Flachwasser ist der
  // Sandgrund durchscheinend sichtbar, mit einzelnen Steinen darin".
  // Der Grund liegt UNTER der Wasserfarbe und blendet mit der Tiefe aus -
  // je tiefer, desto weniger kommt vom Boden zurueck. Er wird nicht
  // ueberblendet, sondern durchscheinend gemischt (0,42), sonst
  // verschwindet das Wasser und es liegt trockener Sand im Bild.
  // Erster Wurf war zu schwach (Beleg d_ufer_r2: der Grund kaum zu ahnen,
  // die Steine gar nicht). Zwei Gruende: das Tiefenfenster endete zu
  // frueh, und der Grund kam hoechstens mit 42 Prozent durch - die Steine
  // darin landeten damit bei rund 20 Prozent Deckung, unter dem
  // Strandsaum, der oben drueber liegt. Fenster breiter, Grund kraeftiger.
  // DREI ANLAEUFE, alle gemessen - hier steht warum es so aussieht:
  // (1) Fenster ueber "tiefe", am groessten wo tiefe gegen null geht. Dort
  //     ist aber kaum noch Wasser: der Wasseranteil w2.x gewichtet die
  //     ganze Wasserfarbe samt Grund fast auf null (Beleg d_ufer_r2).
  // (2) Fenster in die Mitte der Tiefenrampe geschoben (d_ufer_r3/r4):
  //     der Grund kam durch, die STEINE aber nicht. Ein Rot-Test hat es
  //     ueberfuehrt - 281 rote Bildpunkte von 139500, die Steine wurden
  //     also gezeichnet, trafen den Schelf nur fast nie. Die Tiefenrampe
  //     (smoothstep 0,30..0,98 auf aw) presst den sichtbaren Bereich auf
  //     rund 20 Weltpixel Breite zusammen; bei 46er Steinzellen liegt dort
  //     im Schnitt alle 120 Pixel einer.
  // (3) Jetzt haengt die Sicht direkt am WASSERANTEIL statt an der
  //     Tiefenrampe. Damit deckt sie den ganzen ufernahen Bereich
  //     (aw 0,52 bis 0,88) statt einer Scheibe daraus, und der Schelf ist
  //     so breit wie im Referenzbild.
  float sicht = smoothstep(0.30, 0.52, aw) * (1.0 - smoothstep(0.88, 0.99, aw))
              * clamp(uZoomF*2.6, 0.0, 1.0);
  if(sicht > 0.01){
    // DURCH WASSER GESEHEN, nicht darueber gelegt. Der Sand einfach in
    // die Wasserfarbe zu mischen gab ein breites fahles Grau-Beige und
    // das Tuerkis war weg (Belege d_ufer_r5/r6) - warmer Sand plus kuehles
    // Tuerkis ergibt Grau, dieselbe Falle wie beim Fuell-Licht in v285.
    // Wasser schluckt Rot und laesst Gruen und Blau durch; dazu ein
    // Streuanteil in Wasserfarbe. Damit bleibt der Schelf tuerkisgruen und
    // der Grund ist trotzdem zu sehen, genau wie im Referenzbild.
    vec3 grund = grundSteine(uG[1] * 0.92, 1.0);
    grund = grund * vec3(0.52, 0.92, 0.98) + uG[4] * 0.22;
    farbe = mix(farbe, grund, sicht * 0.62);
  }
  farbe *= 1.0 + (ripple - 0.5) * 0.18;
  farbe += vec3(1.0) * clamp((ripple - 0.74) * 3.0, 0.0, 1.0) * 0.55;
  float saum = clamp(1.0 - abs(aw - 0.42 - 0.20*(rausch - 0.5)) * 4.5, 0.0, 1.0);
  float fleck = smoothstep(0.50, 0.72, ripple * 0.7 + rausch * 0.45);
  farbe += vec3(1.0) * saum * fleck * 0.5;
  return farbe;
}

void main(){
  // ---- PLATTENSCHNITT (v289) ----
  // Die Karte ist eine ovale Inselplatte auf einem Holzsockel. Alles
  // ausserhalb der Ellipse gehoert nicht mehr zur Karte und wird gar
  // nicht erst gezeichnet. Gerechnet wird in GITTERkoordinaten, nicht in
  // Weltkoordinaten: sonst wanderte der Schnitt mit der Hoehe, und ein
  // Berg am Rand waere schief abgeschnitten. Dieselbe Formel steht in
  // map.js (Inselmaske) und im Sockelbau.
  // Geschnitten wird an der VOLLEN Ellipse. Der Deckring des Sockels
  // liegt AUSSEN davor, nicht innen: nur so hat die Holzlippe ringsum
  // dieselbe Breite. Ein Schnitt bei 0,97 haette sie in Bruchteilen der
  // Halbachsen gemessen - an den Flanken 99 Weltpixel breit, oben und
  // unten 61 (Beleg p_r1: der Rand sah an den Seiten doppelt so breit
  // aus wie oben).
  vec2 pr9 = vec2(vGrid.x/(uHfeld.x-1.0), vGrid.y/(uHfeld.y-1.0)) * 2.0 - 1.0;
  if(dot(pr9, pr9) > 1.0) discard;
  // Ortsrauschen aus zwei Sinuszuegen (60-150 px Wellenlaenge). Vorgezogen:
  // es steuert jetzt KANTENPASS und Gischt gemeinsam - dieselbe Quelle,
  // damit Uferfransen und Schaumflecken zueinander passen.
  float r1 = sin(vWorld.x*0.083 + vWorld.y*0.047 + 2.1*sin(vWorld.y*0.031));
  float r2 = sin(vWorld.x*0.021 - vWorld.y*0.036);
  float rausch = 0.5 + 0.24*r1 + 0.16*r2;

  // ---- KANTENPASS: Materialgrenzen schaerfen und fransen ----
  // Roh laeuft jede Grenze linear ueber die volle Dreiecksbreite - 52
  // Weltpixel Matsch, in denen Wiese und Fels sich zu einem Brei mischen.
  // Der 2D-Weg brauchte dagegen den Dither-Saum (eigener Pass mit
  // Feldmaske). Hier der Splatting-Trick: nur Gewichte nahe am MAXIMUM
  // ueberleben, band ist die Uebergangsbreite - und band haengt am
  // Ortsrauschen, also franst die Grenze statt der Dreiecksgeraden zu
  // folgen. Fels- und Schneegewicht werden zusaetzlich multiplikativ
  // verrauscht (multiplikativ, damit nie Material entsteht, wo roh keins
  // ist): die Felskante und die Firngrenze wandern +-, die zwei Grenzen,
  // die das Gebirge lesbar machen.
  float sumR = dot(vW1, vec4(1.0)) + dot(vW2, vec4(1.0));
  vec4 q1 = vW1 / max(0.001, sumR);
  vec4 q2 = vW2 / max(0.001, sumR);
  // Kueste braucht die ROHE Rampe (Tiefen-Ersatz) - vor der Schaerfung
  float aw = q2.x;
  float landWeich = q1.x + q1.y;    // Wiese+Wueste am Ufer -> Strand erlaubt
  // Massivgruppe: Fels + Firn (w2.w) werden ALS EINS geschaerft - die
  // Kante zur Wiese bleibt hart, die Firngrenze im Inneren bleibt Decke
  float mas = q2.y + q2.w;
  float sAnteil = q2.w / max(0.001, mas);
  q2.y = mas; q2.w = 0.0;
  q2.y *= 1.0 + (rausch - 0.5)*0.8;
  float mx = max(max(max(q1.x, q1.y), max(q1.z, q1.w)),
                 max(max(q2.x, q2.y), q2.z));
  // BAND: Breite der Materialgrenze. Frueher 0,14-0,40 - eine schmale,
  // GESCHAERFTE Kante, die den Sechsecken des Knotengitters folgte. Fuer
  // den Diorama-Look ist die Grenze breit und weich (Gras laeuft in Sand,
  // Sand in Wasser), und die Ortswelle franst sie organisch aus.
  float band = 0.34 + 0.44*rausch;
  vec4 w1 = max(vec4(0.0), q1 - (mx - band));
  vec4 w2 = max(vec4(0.0), q2 - (mx - band));
  // WASSER NUR AUF WASSERHOEHE: alles Wasser der Karte liegt auf
  // Meereshoehe (~-0,09 Einheiten, gemessen). Ohne Sperre schmiert die
  // Gewichts-Interpolation das Tuerkis die Schluchtwaende hinauf
  // (Nutzerfoto v273: Wandflaechen bis in 6 Einheiten Hoehe teils
  // wassergefaerbt). Fragmente deutlich ueber dem Spiegel geben ihr
  // Wassergewicht an die Massivgruppe ab - NICHT einfach streichen,
  // sonst kann die Summe auf einer hohen Wand gegen null gehen (das
  // Fragment kippte schwarz). Nebeneffekt: die Uferlinie der Bergseen
  // folgt jetzt der HOEHE statt den Sechseckkanten.
  float wGate = 1.0 - smoothstep(0.8, 2.2, vHgt);
  w2.y += w2.x * (1.0 - wGate);
  w2.x *= wGate;
  float sum = dot(w1, vec4(1.0)) + dot(w2, vec4(1.0));
  // Firndecke: weiche, leicht gestraffte und gefranste Rampe INNERHALB
  // der Gruppe - die Rolle der weichgezeichneten Firnmaske im 2D-Weg
  // Spanne 0,15..0,85 statt 0,30..0,70 und Rauschamplitude 0,34: die
  // vereisten Kammknoten liegen knotenweise 0/1 gestreut - straff
  // gefasst standen ihre halbdeckenden Dreieckspaare als blasse
  // Rechtecke im Fels (Reststufen nach der Normalenglaettung). Breiter
  // und staerker verrauscht lesen sie sich als Schneeflecken.
  // Rampe von 0,15..0,85 auf 0,45..0,95: ein Zehntel Schneeanteil machte
  // die Flaeche vorher schon halb weiss. Firn ist jetzt eine Gipfeldecke,
  // kein Schleier ueber dem ganzen Koerper.
  float sMix = smoothstep(0.45, 0.95, sAnteil + (rausch - 0.5)*0.34);
  // FELS OHNE KACHEL (Nutzerentscheid, Variante B der Berg-Optik): die
  // Plattenkachel las sich auf den grossen Hochflaechen als Pflasterplatz,
  // nicht als Berg - drei Anlaeufe, sie per Spiegelung/Warp zu retten,
  // haben das Grundproblem nicht geloest. Der Fels traegt jetzt die feste
  // Themenfarbe mit feinem prozeduralem Korn; die ZEICHNUNG macht das
  // kantige Facettenlicht (Lichtblock unten). Die Schneewehen-Kachel der
  // Firndecke bleibt. tFels haengt weiter als Slot am Programm, wird aber
  // nicht mehr aufs Massiv gelegt.
  // Fleckigkeit statt Korn: der erste Wurf (20-px-Sinusse) interferierte
  // als Schachbrett ueber die ganzen Flaechen (A/B-Beleg t34 winter,
  // ohne Korn glatt). Jetzt ~150-px-Wellen mit verbogenen Traegern -
  // liest sich als Felston-Wechsel, nicht als Raster. Zweite, feinere
  // Oktave (~70 px) fuer die Kontur-Runde (Nutzerfoto v266).
  float korn = sin(vWorld.x*0.043 + 1.9*sin(vWorld.y*0.023))
             * sin(vWorld.y*0.037 - 1.5*sin(vWorld.x*0.019))
             + 0.6 * sin(vWorld.x*0.089 - 1.7*sin(vWorld.y*0.047))
                   * sin(vWorld.y*0.079 + 1.3*sin(vWorld.x*0.053));
  // RUHIGER FELS (Lieferung 9 + Stil-Analyse): die Kachel ist prozedural
  // nahtlos und auf Mittel 0,5 normiert - sie traegt NUR eine leise
  // Risszeichnung, mal 2 mal Themenfarbe ergibt den Ton. Fehlt die
  // Kachel, liefert die 1x1-Grau-Ersatztextur exakt uFelsCol. Der
  // Knet-Look entsteht im LICHT (3 Toon-Stufen, Senken-AO, matter
  // Glanz), nicht im Material: das Voronoi-Blockwerk (v268) lag als
  // Schlangenhaut ueber dem Berg (Nutzerfoto) und ist ausgebaut -
  // steine() bleibt fuer spaetere Schuttzonen im Bestand.
  // VARIANTE 5: die GRUNDFARBE traegt die Flaeche, die Kachel liegt nur
  // mit 25 % Deckkraft darueber (Spez Abschnitt 6). Alles linear.
  // Feinzeichnungs-Faktor: unter Zoom 0,38 sind Blueten und Grundsteine
  // kleiner als ein Bildpunkt und wuerden nur flimmern.
  float fein9 = clamp((uZoomF - 0.22) * 6.0, 0.0, 1.0);
  vec3 mWiese  = mix(uG[0], hol(tWiese,  uSk1.x), 0.25);
  vec3 mWueste = mix(uG[1], hol(tWueste, uSk1.y), 0.25);
  vec3 mSchnee = mix(uG[2], hol(tSchnee, uSk1.z), 0.25);
  vec3 mMoor   = mix(uG[3], hol(tMoor,   uSk1.w), 0.25);
  vec3 mLava   = mix(uG[6], hol(tLava,   uSk2.z), 0.25);
  // Fels: die neutrale Risskachel (Mittel 0,5 sRGB = 0,218 linear) wirkt
  // multiplikativ - Faktor 4,8 normiert ihr Mittel auf 1
  // Kachelanteil 0,16 statt 0,25 (Beleg t34: auf dem hellen Winterfels
  // trat das Zellnetz der Risskachel als Muster hervor - dieselbe Sorte
  // Beanstandung wie die Schlangenhaut in v268; die Spez nennt fuer
  // Texturen ohnehin nur 15-20 % Deckkraft)
  // Kachelanteil 0,16 -> 0,40: mit der flachen Kachel (Std 3,3) war 16 %
  // gleichbedeutend mit "keine Zeichnung". Die Kachel traegt jetzt
  // wieder Kontrast (Std 16, wie die Wiese), damit darf sie auch
  // deutlicher durchkommen - sonst bleibt der Fels eine leere Flaeche.
  vec3 fels = uG[5] * mix(vec3(1.0), hol(tFels, uSk2.y) * 4.8, 0.40) * (0.97 + 0.05*korn);
  // ---- BERGWIESE: das Gras klettert den Berg hinauf ----
  // Referenzbild (Diorama-Huegel): der Berg ist unten GRUEN, der Fels
  // bricht erst oben und an Steilflanken durch. Bisher war das ganze
  // Massiv vom Fuss bis zum Gipfel grau - der grosse leere Teppich im
  // Nutzerfoto v272 war der Hauptabstand zur Referenz. Die Grenze liegt
  // in ABSOLUTEN Hoeheneinheiten (gemessen, Saat 58 M: Massivfuss
  // 1,7-3, Firngrenze 6,2, Gipfel 9,2): Gras bis ~3, Fels ab ~5,
  // dazwischen der Uebergang, am Ortsrauschen ausgefranst. Steile
  // Flanken bleiben immer Fels (Detailnormale), die Firndecke (sMix)
  // liegt unveraendert darueber.
  float hbM = texture2D(tHgt, (vGrid + 0.5) / uHfeld.xy).g * uHfeld.z;
  // Schwellen nach der Messung der NEUEN Hoehenverteilung (Saat 58 M:
  // Massiv p10 1,7 / p50 3,0 / p90 5,3, Firn ab 5,4): Gras traegt den
  // Koerper bis 3,5 und laeuft bis 6,0 aus - wie in der Referenz, wo nur
  // die Gipfelzone Fels zeigt.
  // Grenze RELATIV zur Kartenhoehe (uHfeld.z), nicht absolut: das Profil
  // der Massive haengt am Thema und an der Saat - feste 3,5/6,0 lagen
  // nach dem Kuppel-Umbau (Kartenhoehe 12,4 statt 9,2) viel zu tief, das
  // sichtbare Massiv stand komplett darueber und blieb grau (gemessen mit
  // der Diagnoseansicht: Hoehe 9,5, Neigungsfenster offen, aber
  // Hoehenfenster 0,03). Jetzt Gras bis 42 % der Kartenhoehe, Fels ab
  // 72 % - der Koerper ist gruen, die Kuppe Fels, wie in der Referenz.
  // 42/72 % war immer noch zu tief: das SICHTBARE Massiv liegt gemessen
  // bei 77 % der Kartenhoehe, also komplett in der Felszone. Im
  // Referenzbild traegt der Huegel bis kurz unter den Gipfel Gras, Fels
  // bricht nur in der Kuppe und an Steilstellen durch. Jetzt 60/90 %.
  // WARME BEIGE-SPITZEN (Stilguide: "Fels #9A9A96 mit warmen
  // Beige-Spitzen"). Kriterium ist HOEHE mal Aufwaertsneigung: eine
  // steile Wand bleibt grau, eine Kuppe wird hell und warm. Genau das
  // macht die gestapelten Gesteinsformen im Referenzbild plastisch -
  // ohne den Wechsel liest der Berg als eine graue Masse.
  float spitze = smoothstep(uHfeld.z*0.52, uHfeld.z*0.88, hbM + (rausch - 0.5) * 1.2)
               * smoothstep(0.26, 0.74, normalize(vNrm).z);
  // Staerke am REFERENZBILD gemessen: dort liegt der Fels bei R-B 21,4.
  // Der erste Wurf (1,30/1,19/1,00 mit 0,85) kam auf 28,7 - zu warm.
  fels = mix(fels, fels * vec3(1.24, 1.16, 1.02) + vec3(0.035, 0.028, 0.016),
             clamp(spitze, 0.0, 1.0) * 0.80);
  float gipfel = smoothstep(uHfeld.z*0.60, uHfeld.z*0.90, hbM + (rausch - 0.5) * 1.6);
  // NEIGUNGSFENSTER: mit HSCALE 40 (Kamera-Umbau) sind alle Haenge
  // steiler als vorher - 0,78..0,92 liess fast nichts mehr durch, das
  // Massiv blieb grau (Beleg t39 neu1). Jetzt greift Gras auch an
  // maessig geneigten Flanken; nur die echten Steilstellen bleiben Fels.
  // Neigungsfenster weit oeffnen: in der Referenz waechst Gras auch auf
  // deutlich geneigten Flanken - nur die echten Steilbrueche bleiben kahl.
  float sanft = smoothstep(0.22, 0.52, normalize(vNrm).z);
  // BERGGRAS: frueher 40 % Wueste beigemischt - das ergab ein trockenes
  // Oliv, waehrend die Referenz auf dem Huegel DASSELBE frische Gruen
  // zeigt wie in der Ebene. Nur ein Hauch Sand (12 %) fuer den
  // Hoehenunterschied. Deckung voll (1,0 statt 0,9), sonst schimmert der
  // Fels als grauer Schleier durch die Wiese.
  vec3 berggras = mix(mWiese, mWueste, 0.12);
  // ENTSCHIEDENE GRENZE statt Mischbrei: (1-gipfel)*sanft lieferte ueber
  // weite Flaechen Werte um 0,5 - und ein halb-halb aus grauem Fels und
  // gruenem Gras ist ein texturloser grau-gruener Teppich. Genau der
  // stand als heller Keil im Nutzerfoto (Ebenenprobe t47: der Keil sitzt
  // in der GL-Ebene, nicht in einer Ueberlagerung). Die Referenz kennt
  // nur Gras ODER Fels, mit Bloecken darauf. Die Schwelle macht daraus
  // eine Kante, die das Ortsrauschen ausfranst.
  float gras = smoothstep(0.34, 0.62, (1.0 - gipfel) * sanft + (rausch - 0.5)*0.18);
  fels = mix(fels, berggras, gras);
  vec3 massiv = mix(fels, mSchnee, sMix);
  vec3 alb =
      mWiese * w1.x + mWueste * w1.y + mSchnee * w1.z + mMoor * w1.w
    + wasser(aw, rausch) * w2.x + massiv * w2.y + mLava * w2.z;
  alb /= max(0.001, sum);
  // Blueten NUR auf Gras: der Wiesenanteil, dazu die Bergwiese auf dem
  // Massiv (dort ist gras der Grasmix aus dem Bergwiesen-Block oben).
  {
    float blA = clamp(w1.x/max(0.001,sum) + (w2.y/max(0.001,sum))*gras, 0.0, 1.0);
    alb = blueten(alb, fein9 * smoothstep(0.30, 0.75, blA));
  }
  // Rauheit je Material (Spez-Tabelle), gleich gewichtet wie alb
  // Rauheit nach Stilguide: alle Landmaterialien 0,85-0,95, metalness 0,
  // keine Glanzeffekte ausser Wasser. Vorher lagen Schnee (0,72) und Fels
  // (0,66) deutlich darunter und trugen ein sichtbares Glanzlicht - die
  // Spez verlangt ausdruecklich matte Materialien.
  float rough = (0.90*w1.x + 0.92*w1.y + 0.88*w1.z + 0.90*w1.w
               + 0.14*w2.x + 0.88*w2.y + 0.86*w2.z) / max(0.001, sum);

  // ---- KLIPPENKANTE: Terrassenabbrueche als Bruchkante zeigen ----
  // Die Kartenerzeugung baut das Massiv aus Terrassen mit exakten
  // Hoehenspruengen (Knotendump in gewichteNeu). Der 2D-Weg versteckte
  // diese Kanten hinter gemalten Wandflanken; hier werden sie GEZEIGT -
  // ehrliche Geometrie als Stilmittel. Das Hoehenfeld liegt bilinear
  // gefiltert an, also kann jedes Fragment seine Steilheit selbst messen:
  // die WANDflaeche wird dunkler und kuehler abgesetzt, an der OBERKANTE
  // (Steilheit nimmt bergauf ab) sitzt eine helle Bruchkante, am FUSS
  // (Steilheit nimmt bergab ab) eine dunkle Fuge. Nur auf dem Massiv -
  // ein steiler Wiesenhang ist keine Felswand.
  {
    vec2 texel = 1.0 / uHfeld.xy;
    vec2 uvH = (vGrid + 0.5) * texel;
    float hE = texture2D(tHgt, uvH + vec2(texel.x*0.5, 0.0)).r;
    float hW = texture2D(tHgt, uvH - vec2(texel.x*0.5, 0.0)).r;
    float hS = texture2D(tHgt, uvH + vec2(0.0, texel.y*0.5)).r;
    float hN = texture2D(tHgt, uvH - vec2(0.0, texel.y*0.5)).r;
    // Steigung in Weltpixel je Weltpixel (26/52 bzw. 26/44 je Knoten)
    vec2 gradH = vec2((hE - hW) * uHfeld.z * 0.5,
                      (hS - hN) * uHfeld.z * 0.591);
    float steil = length(gradH);
    // Schwelle auf ECHTE Terrassenabbrueche (3 Hoeheneinheiten je Knoten
    // ~ Steigung 1,5): mit 0,55 feuerte die Kante auch auf mittlere
    // Schneehaenge - das Massiv las sich zerkratzt (Beleg t35, erster Wurf)
    // Schwelle seit dem Facetten-Umbau frueher (0,60 statt 0,85) und die
    // Wandflaeche deutlich dunkler: ohne Kachelzeichnung sind die Waende
    // der Haupttraeger der Berg-Lesbarkeit
    float wand = smoothstep(0.60, 1.30, steil) * smoothstep(0.12, 0.4, mas);
    if(wand > 0.01){
      // bergauf ist -gradH (h nimmt dorthin zu)
      vec2 rauf = -normalize(gradH) * 0.45;
      float steilO = length(vec2(
        (texture2D(tHgt, uvH + (rauf + vec2(0.5,0.0))*texel).r
       - texture2D(tHgt, uvH + (rauf - vec2(0.5,0.0))*texel).r) * uHfeld.z * 0.5,
        (texture2D(tHgt, uvH + (rauf + vec2(0.0,0.5))*texel).r
       - texture2D(tHgt, uvH + (rauf - vec2(0.0,0.5))*texel).r) * uHfeld.z * 0.591));
      // Wandflaeche: dunkler, leicht kuehler - liest als Bruchflaeche
      alb = mix(alb, alb * vec3(0.62, 0.61, 0.64), wand * 0.60);
      // Oberkante: bergauf wird es flach -> helle Bruchkante, leicht
      // verrauscht, damit sie nicht als Draht liest
      float kante = clamp((steil - steilO) * 0.9, 0.0, 1.0) * wand;
      alb += vec3(0.24, 0.22, 0.19) * kante * wand * (0.55 + 0.45*rausch);
      // Fussfuge: bergab wird es flach -> dunkle Fuge (gleiches Mass,
      // gegenlaeufig gemessen waere eine dritte Abtastreihe - die
      // Differenz steilO-steil unter der Kante reicht als Naeherung)
      float fuge = clamp((steilO - steil) * 0.7, 0.0, 1.0) * smoothstep(0.3, 0.9, steil);
      alb *= 1.0 - 0.30 * fuge;
    }
  }

  // ---- Kueste: Flachwasser und Schaumsaum ----
  // Der Wasseranteil aw laeuft vom offenen Wasser (1) ueber die Ufer-
  // dreiecke stetig auf 0 - dieselbe Interpolation, die die Material-
  // uebergaenge macht, ist hier gratis ein Tiefen-Ersatz: mittlere aw
  // heisst ufernah. Dort hellt Flachwasser auf (COAST_COL-Ton), und um
  // die 0,4-Linie laeuft ein schmaler, leise atmender Schaumsaum - die
  // Rolle von trans_sand/trans_foam im 2D-Weg, nur als Feld statt als
  // Stempelkette.
  // Am PLATTENRAND keine Uferwirkung. Die Materialgewichte laufen an der
  // Feldgrenze aus, dadurch sank aw dort unter 1 und der Shader malte
  // seinen Flachwasserschelf samt Schaumlinie - im Beleg p_r2 lag ein
  // heller Saum rings um die Platte, als haette das Meer dort ein Ufer.
  // Es hat keins: dort ist die Platte zu Ende.
  float randAus = 1.0 - smoothstep(0.90, 0.995, length(pr9));
  if(aw > 0.03 && aw < 0.97 && randAus > 0.01){
    // Die Isolinie linear interpolierter Gewichte ist je Dreieck eine
    // GERADE - unverrauscht zeichnete der Saum das Dreiecksnetz als
    // Leuchtdraht nach (Beleg t31, Kuestenkontur aus geraden Segmenten).
    // Das Ortsrauschen kommt seit dem Kantenpass von oben.
    // STRAND: die Landseite des Uferbands bekommt Sand statt nassen
    // Grases - aber NUR, wo weiches Land ans Wasser stoesst (landWeich).
    // Ein Bergsee hat ein Felsufer, keinen Strand - derselbe Befund stand
    // im 2D-Weg schon als v101-Kommentar am Sandpinsel; und die
    // Winterkueste behaelt ihren Schnee.
    float weich = clamp(landWeich / max(0.001, 1.0 - aw), 0.0, 1.0);
    float strand = smoothstep(0.02, 0.16, aw) * (1.0 - smoothstep(0.28, 0.52, aw)) * randAus;
    strand *= weich;
    alb = mix(alb, mWueste, strand * 0.55);
    // NASSER SAND (Referenz-Diorama): direkt unter der Wasserlinie
    // dunkelt der Strand feucht ab ...
    float nass = smoothstep(0.24, 0.42, aw) * (1.0 - smoothstep(0.46, 0.60, aw)) * weich * randAus;
    alb *= 1.0 - 0.16 * nass;
    // ... und GENAU auf der Wasserlinie laeuft die duenne weisse
    // Schaumkante, leicht verrauscht; die fleckigen Schaumkronen im
    // Flachwasser macht wasser() weiter selbst. Beide nur an weichen
    // Ufern - ein Bergsee hat keinen Schaumstrand.
    float linie = clamp(1.0 - abs(aw - 0.47 - 0.05*(rausch - 0.5)) * 11.0, 0.0, 1.0) * randAus;
    alb += vec3(1.0) * linie * weich * 0.30;
  }

  // ---- Themenfarbe daruebergelegt ----
  // Die Kacheln sind fuer alle Klimazonen dieselben; Winterwiese und
  // Wuestenboden bekommen ihren Ton aus der Palette des Spiels. Das
  // Verfahren ist dasselbe wie die 'color'-Glasur im 2D-Weg: die
  // HELLIGKEITSzeichnung der Kachel bleibt stehen, Farbton und Saettigung
  // kommen aus der Palette.
  // ---- Grossflaechige Tonvariation ----
  // Zweiter Teil der Antwort auf "kachelartig": selbst mit der
  // Spiegel-Grosskachel bleibt die Flaeche in sich gleichfoermig. Zwei
  // sehr niederfrequente Ortswellen (~675/800 px, inkommensurabel zur
  // Kachelperiode) heben und senken den Ton um +-5 % - wie Patina.
  float ton = sin(vWorld.x*0.0093 + 1.9*sin(vWorld.y*0.0061))
            * sin(vWorld.y*0.0079 - 1.3*sin(vWorld.x*0.0053));
  alb *= 1.0 + 0.05*ton;

  // ---- Filmlicht (Cartoon-Spez Variante 5, Abschnitt 3) ----
  // Dreipunktlicht plus Hemisphaeren-Ambient, linear gerechnet. Ersetzt
  // Lambert + Nord-Daempfung + Toon-Stufen + goldene Stunde + Schulter.
  vec3 n = normalize(vNrm);
  // ---- Kuppelform: grobe Normale aus der voll geglaetteten Hoehe ----
  // Das Massivinnere ist nach der Darstellungs-Glaettung fast eben; die
  // Detailnormale gibt dem Hauptlicht dort NICHTS zu modellieren - der
  // Berg las sich als flacher Teppich (Nutzerfoto v272). Die Steigung
  // des hBlur-Felds (G-Kanal, gleiche Quelle wie das AO) traegt die
  // grosse Huegelform; Key und Fill mischen sie zur Haelfte ein (Faktor
  // 1,6 ueberhoeht die sanfte Kuppel), Rim und Glanz behalten die
  // Detailnormale - Kanten bleiben knackig.
  vec2 tk = 1.0 / uHfeld.xy;
  vec2 uvK = (vGrid + 0.5) * tk;
  float kE = texture2D(tHgt, uvK + vec2(tk.x, 0.0)).g;
  float kW = texture2D(tHgt, uvK - vec2(tk.x, 0.0)).g;
  float kS = texture2D(tHgt, uvK + vec2(0.0, tk.y)).g;
  float kN = texture2D(tHgt, uvK - vec2(0.0, tk.y)).g;
  vec3 nGrob = normalize(vec3(-(kE - kW) * uHfeld.z * 0.25 * 1.6,
                              -(kS - kN) * uHfeld.z * 0.295 * 1.6, 1.0));
  vec3 nK = normalize(mix(n, nGrob, 0.55));

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
  if(uSchattenAn > 0.5){
    // Sonnenrichtung in Weltpixeln je Schritt (zur Sonne: +LX/+LY im
    // Bildsinn heisst nach Nordwest = -x/-y in Weltkoordinaten)
    // Massstaebe aus uMass (TILE, ROWH, HSCALE) - NICHT fest verdrahtet:
    // beim Kamera-Umbau (ROWH 44->32, HSCALE 26->40) waeren die alten
    // Zahlen hier stehengeblieben und der Marsch haette in eine falsche
    // Richtung gerechnet, sobald jemand den Schatten zuschaltet
    vec2 dW = vec2(-0.75, -0.5) * uMassF.z;   // eine Hoeheneinheit je Schritt
    float dZ = 0.95 * uMassF.z;               // Steigung des Strahls
    float z0 = vHgt * uMassF.z;
    vec2 gSchritt = vec2(dW.x / uMassF.x, dW.y / uMassF.y);
    for(int k = 1; k <= 16; k++){
      vec2 gp = vGrid + gSchritt * float(k);
      if(gp.x < 0.0 || gp.y < 0.0 || gp.x > uHfeld.x-1.0 || gp.y > uHfeld.y-1.0) break;
      float hb = texture2D(tHgt, (gp + 0.5) / uHfeld.xy).r * uHfeld.z;
      float ueber = hb * uMassF.z - (z0 + dZ * float(k));
      // weicher Rand: knapp drueber daemmert, deutlich drueber deckt
      schatten = min(schatten, 1.0 - clamp(ueber / 30.0, 0.0, 0.62));
    }
  }
  // Key mit Subsurface-Anteil (weicher, warm auslaufender Terminator);
  // der Schattenmarsch geht nur noch WEICH ein und steht standardmaessig
  // aus (Spez: keine harten Schlagschatten)
  // WEICHER TERMINATOR (v285). Gemessen am Hangbeleg (t55_dbg2, reines
  // Key-Licht): die sonnenabgewandte Bergflanke lag vollstaendig auf
  // null, und weil die Flanke plan ist, lief die Grenze als SCHNURGERADE
  // Kante quer durchs Bild - die "blasse Flaeche mit gerader Kante".
  // Ursache ist der Knick von max(dot,0) bei genau 90 Grad.
  // ERSTER VERSUCH, VERWORFEN: reines Halb-Lambert pow(nd*0.5+0.5, 2.2).
  // Die Kante verschwand, aber gemessen stieg die Schattenflanke von
  // Helligkeit 134,5 auf 143,2 und lag damit HELLER als die Sonnenseite
  // (141,3) - der Schatten war weg, das warme Hauptlicht flutete die
  // abgewandte Seite (Faktor 5,6 bei nd 0).
  // JETZT: Wrap-Diffus mit kleinem Ueberhang (0,18) und Toe-Gamma 1,31.
  // Das Gamma legt die besonnte Haelfte exakt auf die alten Werte
  // zurueck (nd 1,0 -> 1,000 wie vorher, nd 0,699 - ebener Boden ->
  // 0,700 wie vorher), waehrend bei nd 0 kein Knick mehr sitzt; der
  // verbliebene Knick liegt bei nd -0,18, wo ohnehin nur Ambient traegt.
  float nd  = dot(nK, C_KEYDIR);
  float key = pow(max((nd + 0.18) / 1.18, 0.0), 1.31) * (0.55 + 0.45*schatten);
  // AO: Hoehe gegen weichgezeichnete Hoehe (G-Kanal von tHgt, CPU-seitig
  // vorgerechnet) - Senken und Stufenfuesse liegen im weichen Eigenschatten
  float hRel = vHgt / max(1.0, uHfeld.z);
  float hB = texture2D(tHgt, (vGrid + 0.5) / uHfeld.xy).g;
  // AO SPUERBAR STARK (Stilguide): kleiner Radius, kraeftig in jeder
  // Vertiefung. Vorher Faktor 2,4 mit Boden 0,55; jetzt 3,6 mit Boden
  // 0,40. Weil das gerichtete Fuell-Licht weggefallen ist, traegt die
  // Verdeckung die Form auf der Schattenseite - sie darf und muss
  // deshalb deutlicher sein.
  float ao = clamp(1.0 - (hB - hRel) * 3.6, 0.40, 1.0);
  // Hemisphaere plus neutrales Rundum-Licht - das ist die GANZE
  // Aufhellung. Ein zweites gerichtetes Fuell-Licht gibt es nicht mehr
  // (s. Lichtaufbau oben).
  // VERSUCH UND IRRTUM (v285, hier dokumentiert damit es niemand noch
  // einmal probiert): die blasse Bergflanke sah nach zu schwachem
  // Schatten aus - gemessen 134,5 Helligkeit gegen 144,0 auf der
  // Sonnenseite, Saettigung 0,28 gegen 0,60. Ich habe daraufhin das
  // Fuell-Licht gesenkt und entschieden blau gefaerbt. Gemessen brachte
  // das die Saettigung NICHT zurueck (0,278 -> 0,267) und nahm dem Bild
  // vier Helligkeitspunkte. Verworfen. Die Ursache lag in der Geometrie:
  // dort stand eine senkrechte Wand aus der Kartenerzeugung (Wandbrecher
  // in map.js). Die Messung war ausserdem irrefuehrend, weil
  // "Schattenseite" und "Sonnenseite" zugleich verschiedene MATERIALIEN
  // waren - Fels gegen Wiese.
  float up = clamp(n.z*0.5 + 0.5, 0.0, 1.0);
  vec3 amb = (mix(C_GRUND, C_HIMMEL, up) * I_HEMI + vec3(I_ENV)) * LICHT_SKALA;
  vec3 direct = C_SONNE * I_SONNE * key * LICHT_SKALA;
  vec3 col = alb * (direct * ao + amb * ao * ao);
  // Specular aus der Materialrauheit: matt auf Land, scharf nur auf Wasser
  float shin = 2.0 / max(0.02, rough * rough);
  float spec = pow(max(dot(n, normalize(C_KEYDIR + C_VDIR)), 0.0), shin) * (1.0 - rough) * 0.20;
  col += vec3(1.00, 0.95, 0.85) * spec * key;
  // Rim: hebt die Silhouette ab - sparsam, sonst wird das Bild milchig.
  // Seit v272 GOLDEN statt blau: in der Referenz traegt die warme
  // Sonnenkante die Felskuppen und Baumkronen.
  float rim = pow(1.0 - max(dot(n, C_VDIR), 0.0), 2.6) * max(dot(n, C_RIMDIR), 0.0);
  // Rim gedaempft (0,24 -> 0,10): der Stilguide kennt nur EINE Sonne und
  // verlangt "keine harten Glanzlichter". Ganz raus fliegt er nicht - er
  // haelt die Silhouette gegen den Hintergrund lesbar, was auf einer
  // Spielkarte mehr zaehlt als auf einem Standbild. Bewusste Abweichung.
  col += vec3(1.00, 0.86, 0.60) * rim * 0.10;

  // ---- Belichtung, ACES, Gamma (Reihenfolge bindend, Spez Abschn. 6) ----
  col *= 1.05;                       // Exposure 1.05 (Stilguide)
  col = aces(col);
  // WARME FARBKORREKTUR (Stilguide): Schatten leicht ins Blaue, Lichter
  // ins Warme. Als Split-Toning ueber die Luminanz nach dem Tonemapping.
  // Es sitzt im Shader und nicht in einem Post-Pass, weil unter der
  // GL-Ebene der 2D-Canvas DURCHSICHTIG ist: eine Vollbild-Mischung dort
  // wuerde auf leerem Grund die Quellfarbe schreiben statt zu toenen
  // (dieselbe Falle, an der der frueher gemalte Goldschleier haengt).
  float lum9 = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= mix(vec3(0.955, 0.975, 1.055), vec3(1.045, 1.010, 0.945),
             smoothstep(0.18, 0.72, lum9));
  col = pow(col, vec3(1.0 / 2.2));

  // Debug-Ansichten: 1 = Gewichte (Fels rot, Schnee/Firn blau, Wiese
  // gruen, Rest tuerkis), 2 = reines Licht. Nur von Messwerkzeugen gesetzt.
  if(uDebug > 0.5 && uDebug < 1.5){
    col = vec3(w2.y, q1.x, sAnteil) / max(0.001, max(w2.y, max(q1.x, sAnteil)));
  } else if(uDebug > 1.5 && uDebug < 2.5){
    col = vec3(key * 0.8);
  } else if(uDebug > 3.5){
    // Diagnose 4: R = Firnanteil sMix, G = Massivgruppe mas, B = Grasmix
    col = vec3(sMix, mas, gras);
  } else if(uDebug > 2.5){
    // Diagnose Bergwiese: R = Hoehe/10, G = sanft (Neigungsfenster),
    // B = 1-gipfel (Hoehenfenster). Gras entsteht aus G*B.
    col = vec3(clamp(hbM/10.0,0.0,1.0), sanft, 1.0 - gipfel);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Reihenfolge der Materialkanaele. Sie steht an EINER Stelle, damit
// Shader, Attributaufbau und Renderer nicht auseinanderlaufen koennen.
const KANAL = ['wiese','wueste','schnee','moor','wasser','fels','lava'];

// ---- SOCKEL: Holzpodest unterm Kartenrand (Referenz-Diorama) ----
// Das Referenzbild zeigt die Landschaft als Modell auf einer runden
// Holzplatte. Uebersetzt auf die rechteckige Karte: ein Holzring um den
// Kartenrand (Deckflaeche), an der Suedkante die sichtbare Seitenwand
// des Podests, aussen herum ein weicher Schattenrock auf der warmen
// "Tischplatte" (der Loeschfarbe). Gezeichnet VOR dem Gelaende - wo die
// Randknoten angehoben sind, schaut das Podest darunter hervor, genau
// wie beim Diorama. Tonwert je Ecke: positiv = Holz mal Ton (deckend),
// negativ = Schatten mit Alpha -Ton.
const VERT_S = `
attribute vec4 aPos;        // x,y Weltpixel, z Tonwert, w Plankendrehung
uniform vec2  uCam;
uniform float uZoom;
uniform vec2  uView;
varying float vTon;
varying float vDreh;
varying vec2  vP;
void main(){
  vec2 s = (aPos.xy - uCam) * uZoom + uView * 0.5;
  gl_Position = vec4(s.x / uView.x * 2.0 - 1.0,
                     1.0 - s.y / uView.y * 2.0, 0.0, 1.0);
  vTon = aPos.z; vDreh = aPos.w; vP = aPos.xy;
}`;
const FRAG_S = `
precision mediump float;
varying float vTon;
varying float vDreh;
varying vec2  vP;
uniform sampler2D tHolz;    // Plankenkachel (Lieferung V2); Rueckfall ist
                            // eine 1x1-Holzfarbe - dann traegt die
                            // Sinus-Maserung allein
void main(){
  // leise Holzmaserung, gleiche Sinus-Bauart wie das Fels-Korn
  float maser = 0.95 + 0.05 * sin(vP.x*0.083 + 2.0*sin(vP.y*0.031))
                     * sin(vP.y*0.071 - 1.5*sin(vP.x*0.027));
  if(vTon > 0.0){
    // dreh 0 = Maserung waagerecht (Deckring), dreh 1 = senkrecht
    // (Dauben der Zarge - die stehen hochkant, fassartig)
    vec2 uv = mix(vP, vP.yx, vDreh) / 230.0;
    gl_FragColor = vec4(texture2D(tHolz, uv).rgb * vTon * maser, 1.0);
  }
  else gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(-vTon, 0.0, 1.0));
}`;

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
    this.uMassF= gl.getUniformLocation(p, 'uMassF');
    this.uSun  = gl.getUniformLocation(p, 'uSun');
    this.uTint = gl.getUniformLocation(p, 'uTint');
    this.uPix  = gl.getUniformLocation(p, 'uPix');
    this.uHfeld= gl.getUniformLocation(p, 'uHfeld');
    this.uZeit = gl.getUniformLocation(p, 'uZeit');
    this.uSchattenAn = gl.getUniformLocation(p, 'uSchattenAn');
    this.uDebug = gl.getUniformLocation(p, 'uDebug');
    this.uZoomF = gl.getUniformLocation(p, 'uZoomF');
    this.uTHgt = gl.getUniformLocation(p, 'tHgt');
    this.uSk1  = gl.getUniformLocation(p, 'uSk1');
    this.uSk2  = gl.getUniformLocation(p, 'uSk2');
    this.uFelsCol = gl.getUniformLocation(p, 'uFelsCol');
    this.uG = gl.getUniformLocation(p, 'uG[0]');
    this.uTex  = KANAL.map(k=>gl.getUniformLocation(p,
      't'+k.charAt(0).toUpperCase()+k.slice(1)));
    // Sockel-Programm (Holzpodest) - scheitert es, faellt nur das Podest
    // aus, das Gelaende zeichnet weiter
    this.progS = null;
    const vsS = mk(gl.VERTEX_SHADER, VERT_S), fsS = mk(gl.FRAGMENT_SHADER, FRAG_S);
    if(vsS && fsS){
      const pS = gl.createProgram();
      gl.attachShader(pS, vsS); gl.attachShader(pS, fsS); gl.linkProgram(pS);
      if(gl.getProgramParameter(pS, gl.LINK_STATUS)){
        this.progS = pS;
        this.aPosS  = gl.getAttribLocation(pS, 'aPos');
        this.uCamS  = gl.getUniformLocation(pS, 'uCam');
        this.uZoomS = gl.getUniformLocation(pS, 'uZoom');
        this.uViewS = gl.getUniformLocation(pS, 'uView');
        this.uHolzS = gl.getUniformLocation(pS, 'tHolz');
      }
    }
    this.bufSockel = gl.createBuffer();
    this.anzSockel = 0;
    // Rueckfalltextur des Sockels: 1x1 in Holzfarbe - bis (oder falls)
    // die Plankenkachel mat_sockel_holz geladen ist
    this.texSockel = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texSockel);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
                  gl.UNSIGNED_BYTE, new Uint8Array([161,112,74,255]));
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
    // Variante 5 kennt keinen harten Schlagschatten - der Marsch bleibt
    // als Werkzeug erhalten (ohneSchatten=false schaltet ihn zu) und
    // geht dann nur WEICH in den Key ein
    if(this.ohneSchatten === undefined) this.ohneSchatten = true;
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
    // Felsfarbe des Themas (0..1) - traegt seit dem Facetten-Umbau den
    // Fels allein, die tFels-Kachel liegt nicht mehr auf dem Massiv
    if(bilder && bilder.felsFarbe) this._felsCol = bilder.felsFarbe;
    // Grundfarben je Materialkanal (LINEAR, Cartoon-Spez Variante 5):
    // Reihenfolge wiese,wueste,schnee,moor,wasserFlach,fels,lava,wasserTief
    if(bilder && bilder.grundfarben){
      const g = bilder.grundfarben;
      this._grund = new Float32Array([].concat(
        g.wiese, g.wueste, g.schnee, g.moor,
        g.wasserFlach, g.fels, g.lava, g.wasserTief));
    }
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
    // Sockelholz: Plankenkachel des Podestrings (mat_sockel_holz);
    // fehlt sie, bleibt die 1x1-Holzfarbe aus dem Programmaufbau
    const so = this._bilder.sockel;
    if(so && so.img && this.texSockel){
      const im = so.img, w = im.naturalWidth||im.width, h = im.naturalHeight||im.height;
      if(w && h){
        gl.bindTexture(gl.TEXTURE_2D, this.texSockel);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        if(p2(w) && p2(h)){
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    }
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
    this.sockelNeu(map);
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
    // KANTENERHALTENDE HOEHENGLAETTUNG (Stil-Analyse Lieferung 9:
    // "Heightmap kraeftig glaetten ... Steilwaende durch wenige harte
    // Hoehenspruenge, nicht durch Detailrelief"). NUR die Darstellung:
    // Spiellogik, Wege, Bauplaetze und der Planierer rechnen weiter mit
    // map.hgt. Gauss-artige Runden ueber die 4er-Nachbarn, aber ein
    // Nachbar, der mehr als SCHWELLE Hoeheneinheiten entfernt liegt,
    // fliesst NICHT ein - die Terrassenspruenge (2..9 Einheiten) bleiben
    // exakt stehen, nur das Kleinrelief auf den Flaechen laeuft zu
    // weichen Woelbungen aus. Der Versatz gegen die 2D-Objektanker
    // (liftAt) bleibt dadurch unter einer halben Hoeheneinheit.
    // RUNDEN von 3 auf 1: die Kartenerzeugung liefert seit dem
    // Diorama-Umbau selbst weiche Hoehen (Rasterstaerke q 1,00 -> 0,12).
    // Drei weitere Runden darueber machten das Massiv teigig - es hatte
    // keine Form mehr (Beleg t39 neu1). Eine Runde nimmt das Restkorn,
    // laesst die Kuppe aber stehen.
    const SCHWELLE = 1.6, RUNDEN = 1;
    const H = new Float32Array(map.hgt);
    for(let r=0; r<RUNDEN; r++){
      const Q = new Float32Array(H);
      for(let y=0; y<h; y++) for(let x=0; x<w; x++){
        const i = y*w + x;
        let s = Q[i]*2, c = 2;
        for(const q of [x>0? i-1:-1, x<w-1? i+1:-1, y>0? i-w:-1, y<h-1? i+w:-1]){
          if(q<0 || Math.abs(Q[q]-Q[i]) > SCHWELLE) continue;
          s += Q[q]; c++;
        }
        H[i] = s/c;
      }
    }
    // Voll geglaettetes Feld fuer das AO der Variante 5 (hBlur - h):
    // gleiche Runden, aber OHNE Kantenerhalt - an Stufenfuessen liegt
    // hBlur ueber der echten Hoehe, dort dunkelt das AO ab
    const HB = new Float32Array(H);
    for(let r=0; r<3; r++){
      const Q = new Float32Array(HB);
      for(let y=0; y<h; y++) for(let x=0; x<w; x++){
        const i = y*w + x;
        let s = Q[i]*2, c = 2;
        for(const q of [x>0? i-1:-1, x<w-1? i+1:-1, y>0? i-w:-1, y<h-1? i+w:-1]){
          if(q<0) continue;
          s += Q[q]; c++;
        }
        HB[i] = s/c;
      }
    }
    this._hBlur = HB;
    // ANZEIGEHOEHE nach aussen geben: der 2D-Weg verankert Wege, Felsen
    // und Fahnen an map.hgt, die GPU-Ebene zeichnet den Boden aber an der
    // GEGLAETTETEN Hoehe H. Ohne diesen Abgleich schwebt alles ein Stueck
    // ueber oder unter dem Boden - bei einer langen Strasse quer zum Hang
    // faellt das sofort auf (Nutzerbefund "weg auf berg passt optisch
    // nicht zur hoehenlage").
    this._hDisp = H;
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
    // EINE Glaettungsrunde ueber die Nachbarn. Ohne sie standen im Licht
    // pixelscharfe Kanten (Beleg t33: erst der Mauerkachel, dann dem
    // Schatten, dann dem Kantenpass zugeschrieben - die Debug-Ansicht
    // 'reines Licht' ueberfuehrte die Normalen, und geglaettete Hoehen
    // sprachen das Rendering frei). Der Mechanismus: an einer Klippe
    // stehen Wand- und Plateaunormale ueber 80 Grad auseinander; die
    // Interpolation fast gegensaetzlicher Normalen kippt auf kurzer
    // Strecke, der Uebergang kollabiert zur harten Linie. Der 2D-Weg
    // kannte das laengst - eckShade mittelt die Grossform ueber zwei
    // Ringe (gradBigAt). Gewicht 2:1 Zentrum:Nachbarmittel behaelt die
    // lokale Zeichnung.
    // Zwei Runden wie gradBigAt im 2D-Weg (zwei Ringe): nach einer Runde
    // blieben schwache Reststufen an den hoechsten Klippen sichtbar.
    for(let runde=0; runde<2; runde++){
      const ng = new Float32Array(nrm);
      for(let y=0; y<h; y++) for(let x=0; x<w; x++){
        const i = y*w + x;
        let ax=0, ay=0, az=0, c=0;
        for(const q of [x>0? i-1:-1, x<w-1? i+1:-1, y>0? i-w:-1, y<h-1? i+w:-1]){
          if(q<0) continue;
          ax+=ng[q*3]; ay+=ng[q*3+1]; az+=ng[q*3+2]; c++;
        }
        const bx=ng[i*3]*2 + ax/Math.max(1,c)*2;
        const by=ng[i*3+1]*2 + ay/Math.max(1,c)*2;
        const bz=ng[i*3+2]*2 + az/Math.max(1,c)*2;
        const l2=Math.hypot(bx,by,bz)||1;
        nrm[i*3]=bx/l2; nrm[i*3+1]=by/l2; nrm[i*3+2]=bz/l2;
      }
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
      // RGBA statt LUMINANCE: SwiftShader filtert LUMINANCE mit NEAREST -
      // der Schattenmarsch bekam texelscharfe Kanten, im Beleg t32 standen
      // knotengrosse achsenparallele Stufen in der Firnkante (erst der
      // Mauerkachel zugeschrieben; der Nahzoom ueberfuehrte den Schatten:
      // die Stufen skalieren mit dem Zoom und sind messerscharf). RGBA
      // filtert jede Implementierung bilinear.
      const px = new Uint8Array(n*4);
      for(let i=0; i<n; i++){
        px[i*4]   = Math.max(0, Math.min(255, Math.round(H[i]/mx*255)));
        px[i*4+1] = Math.max(0, Math.min(255, Math.round((this._hBlur? this._hBlur[i] : H[i])/mx*255)));
      }
      gl.bindTexture(gl.TEXTURE_2D, this.texHgt);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA,
                    gl.UNSIGNED_BYTE, px);
      // bilinear: der Marsch tastet zwischen den Knoten ab
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
    // TER.SNOW (Index 4) geht in den GRUPPEN-Kanal w2.w, nicht in w1.z:
    // auf den Massiven liegen die vereisten Kammknoten kleinteilig
    // zwischen Felsknoten verstreut (Gebirge Saat 58: 1819 Schneeknoten
    // auf den Gratlinien) - als eigener Kanal presste der Kantenpass
    // dieses Gemisch zu harten knotengrossen Flecken (Beleg t32, dritter
    // Anlauf: Mauerkachel und Schatten waren per Schalter freigesprochen,
    // erst die Gruppe hat es behoben). In der Gruppe gilt: aussen scharf
    // zur Wiese, innen weiche Fels/Schnee-Rampe - auch fuer die
    // Schneefelder der Winterebene, deren Kante zur aperen Wiese die
    // Gruppe genauso schaerft.
    const ZIEL = [ [w2,0], [w1,0], [w1,1], [w2,1], [w2,3], [w1,3], [w2,2] ];
    // Schneedeckung auf dem Massiv VOR dem Upload glaetten: die
    // Schneeknoten liegen knotenweise 0/1 gestreut, und die Interpolation
    // KANN aus 0/1-Nachbarn nichts Weiches machen - im Shader war dagegen
    // kein Kraut gewachsen (drei Parameterversuche an sMix, gemessen kaum
    // Wirkung). Hier, einen Schritt frueher, ist es ein Mittel ueber die
    // Nachbarn - aus Einzelknoten werden Schneeflecken mit Saum.
    //
    // EINORDNUNG des Restbefunds (Knotendump kantenprobe.mjs): die blassen
    // rechteckigen Schneefelder im Fels sind ECHTE KARTENDATEN. Die
    // Kartenerzeugung baut das Massiv aus Terrassen mit exakten
    // Hoehenspruengen (9,2 / 6,2 / 2,x), der Schnee sitzt knotengenau auf
    // den Plateaus, und Terrassenkanten laufen im versetzten Gitter teils
    // achsenparallel. Der 2D-Weg VERSTECKTE diese Kanten hinter gemalten
    // Wandflanken und Zellmasken; die GL-Ebene zeigt sie ehrlich. Wer die
    // Flecken anders will, muss an die Kartenerzeugung oder eine
    // gestalterische Klippenkante - nicht an diese Glaettung.
    const deck = (map.nbs && fv) ? (()=>{
      const roh = new Float32Array(n);
      for(let i=0; i<n; i++){
        const t = map.terr[i];
        roh[i] = t === 4 ? 1 : (t === 3 ? fv(i) : 0);
      }
      const d = new Float32Array(n);
      for(let i=0; i<n; i++){
        let s9 = roh[i]*2, c9 = 2;
        for(const q of map.nbs(i)){ s9 += roh[q]; c9++; }
        d[i] = s9/c9;
      }
      return d;
    })() : null;
    for(let i=0; i<n; i++){
      const t = map.terr[i];
      const z = ZIEL[t] || ZIEL[1];
      let g9 = 1;
      // Firn und Kamm-Schnee in den GRUPPEN-Kanal (w2.w), nicht in den
      // Ebenen-Schnee: der Kantenpass im Shader schaerft Materialgrenzen -
      // eine Schneedecke AUF dem Fels ist aber keine Grenze, sondern eine
      // Mischzone. In w1.z gepresst wurde sie von der Schaerfung zu einer
      // harten Kante mitten im Firn zusammengeschoben (Beleg t32).
      if(deck && (t === 3 || t === 4)){   // TER.MOUNT / TER.SNOW
        const sn = deck[i];
        w2[i*4+3] = sn; g9 = 1 - sn;
        if(t === 4){ w2[i*4+1] += g9; g9 = 0; }   // Rest des Kammknotens: Fels
      } else if(fv && t === 3){
        const sn = fv(i);
        if(sn > 0){ w2[i*4+3] = sn; g9 = 1 - sn; }
      }
      if(g9 > 0) z[0][i*4 + z[1]] += g9;
    }
    // ---- RUNDE UMRISSE statt Sechsecke (Diorama-Umbau) ----
    // Die Gewichte liegen je KNOTEN, also je Sechseckzelle. Ein kleiner
    // See deckt ~7 Knoten - sein Umriss WAR damit zwangslaeufig eine
    // Wabe, egal wie fein interpoliert wird (Nutzerfotos v276/v277: die
    // Bergseen als klare Sechsecke mit hartem Sandring). Zwei Runden
    // Nachbarmittel ueber ALLE Kanaele verschmieren die Zellgrenzen zu
    // einem stetigen Feld; die Uferlinie folgt danach dem Mittelwert,
    // nicht mehr der Zellkante. Dieselbe Mechanik, die oben schon die
    // Schneedeckung gerettet hat (deck) - nur fuer alles.
    if(map.nbs){
      for(let r = 0; r < 2; r++){
        const a1 = new Float32Array(w1), a2 = new Float32Array(w2);
        for(let i = 0; i < n; i++){
          const nb = map.nbs(i);
          for(let c = 0; c < 4; c++){
            let s1 = a1[i*4+c]*2, s2 = a2[i*4+c]*2, cc = 2;
            for(const q of nb){ s1 += a1[q*4+c]; s2 += a2[q*4+c]; cc++; }
            w1[i*4+c] = s1/cc;
            // Kanal 3 von w2 ist der FIRN. Er hat oben schon seine eigene
            // Glaettung (deck) - noch zwei Runden darueber trugen den
            // Schnee zwei Knoten weit in den Fels hinein, und das Massiv
            // lag unter einem weissen Schleier (gemessen: 3 % Gruen,
            // Felsmittel 193 bei Std 21). Firn bleibt deshalb scharf.
            if(c < 3) w2[i*4+c] = s2/cc;
          }
        }
      }
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

  // ---------- Sockel: ovale Platte mit fassartiger Daubenzarge ----------
  // Das Referenzbild zeigt die Karte als ovale Platte mit einem
  // umlaufenden Holzrand aus EINZELNEN senkrechten Bohlen, fassartig
  // gesetzt, mit sichtbarer Materialstaerke und weichem Kontaktschatten
  // auf einer neutralen Flaeche. Das ist seit v289 Spielelement, nicht
  // Deko: der Gelaende-Shader schneidet die Karte an derselben Ellipse ab.
  //
  // Vorher stand hier ein RECHTECKIGER Holzring mit vier Baendern und
  // einer Suedwand. Der passte zur alten Rechteckmaske der
  // Kartenerzeugung; mit der ovalen Inselmaske (map.js) waere er
  // sinnlos - er lag ueber offenem Wasser statt am Landrand.
  //
  // Aufbau von aussen nach innen:
  //   1. Kontaktschatten auf der Tischplatte (Ellipsenring, weich aus)
  //   2. Zarge: N Dauben, jede aus ZWEI Vierecken, damit die Mitte hell
  //      und beide Kanten dunkel sind - eine lineare Rampe ueber ein
  //      einziges Viereck kann das nicht, die gaebe eine Schraege statt
  //      einer Woelbung. Der Ton kommt aus der Lage der Daube zur Sonne
  //      (oben links), dazu ein Hauch Streuung je Daube.
  //   3. Deckring: die schmale Holzlippe oben, die der Gelaendeschnitt
  //      bei 0,97 freilaesst.
  sockelNeu(map){
    const gl = this.gl; if(!gl || !this.progS) return;
    // Ellipse in Weltkoordinaten - dieselbe wie die Inselmaske in map.js.
    // worldPos: x = (X + (Y&1)*0.5)*TILE, y = Y*ROWH. Der halbe Versatz
    // ungerader Zeilen verschiebt die Mitte um ein Viertel Kachel.
    const cx = ((map.w - 1) * 0.5 + 0.25) * TILE;
    const cy =  (map.h - 1) * 0.5 * ROWH;
    const rx =  (map.w - 1) * 0.5 * TILE;
    const ry =  (map.h - 1) * 0.5 * ROWH;
    this._platte = [cx, cy, rx, ry];
    const WSP  = 4;      // Wasserspiegel: hgt -0,10 mal HSCALE 40
    const LIP  = 22;     // Breite der Holzlippe oben, KONSTANT in Weltpixeln
    const DICK = 110;    // Materialstaerke der Platte
    const N    = 160;    // Dauben rundherum (rund 106 Weltpixel je Daube)
    const SR   = 150;    // Breite des Kontaktschattens
    const A    = -0.34;  // Deckkraft am Plattenrand
    const E    = -0.001; // aussen praktisch durchsichtig (nicht 0 - sonst
                         // kippt die Ecke in den Holz-Zweig des Shaders)
    const v = [];
    const quad = (p0,p1,p2,p3, t0,t1,t2,t3, dreh)=>{
      v.push(p0[0],p0[1],t0,dreh, p1[0],p1[1],t1,dreh, p2[0],p2[1],t2,dreh,
             p0[0],p0[1],t0,dreh, p2[0],p2[1],t2,dreh, p3[0],p3[1],t3,dreh);
    };
    // Punkt auf der Ellipse, um d Weltpixel nach AUSSEN versetzt (entlang
    // der echten Ellipsennormale, damit die Lippe ueberall gleich breit
    // ist - radial versetzt waere sie an den Flanken breiter)
    const nrm = (a)=>{
      let nxv=Math.cos(a)/rx, nyv=Math.sin(a)/ry;
      const l=Math.hypot(nxv,nyv)||1; return [nxv/l, nyv/l];
    };
    const pt = (a,d)=>{
      const n=nrm(a);
      return [cx + rx*Math.cos(a) + n[0]*d, cy + ry*Math.sin(a) + n[1]*d + WSP];
    };
    // Sonne oben links: Richtung zur Sonne in der Bildebene ist (-1,-1)
    // Halbkugel-Licht statt reiner Richtung: rein gerichtet lag die
    // VORDERE Zarge (Normale zeigt nach unten) auf null und wurde fast
    // schwarz (Beleg p_r2). Eine Holzzarge im Gegenlicht bekommt Ambient
    // und Bodenreflex - der dunkelste Wert liegt deshalb bei 0, der
    // hellste bei 1, und die Tonwerte darunter setzen den Boden.
    const lichtAn = (a)=>{ const n=nrm(a); return 0.5 + 0.5*((-n[0]-n[1])*0.7071); };
    // 1. Kontaktschatten auf der Tischplatte - liegt unter allem, zuerst
    for(let k=0;k<N;k++){
      const a0=k/N*6.283185, a1=(k+1)/N*6.283185;
      const i0=pt(a0,LIP), i1=pt(a1,LIP);
      const o0=pt(a0,LIP+SR), o1=pt(a1,LIP+SR);
      // der Schatten faellt bei tiefstehender Sonne nach rechts unten weg
      const vz=[18, DICK*0.45 + 16];
      quad([i0[0],i0[1]+DICK],[i1[0],i1[1]+DICK],
           [o1[0]+vz[0],o1[1]+DICK+vz[1]],[o0[0]+vz[0],o0[1]+DICK+vz[1]], A,A,E,E, 0);
    }
    // 2. Zarge aus einzelnen Dauben. Jede aus ZWEI Vierecken, damit die
    // Mitte hell und beide Kanten dunkel sind - ueber ein einziges
    // Viereck gaebe die lineare Interpolation eine Schraege statt einer
    // Woelbung, und die Zarge laese sich als gemaltes Band statt als
    // gesetzte Bohlen (Beleg p_r1: flaches dunkles Band).
    // Die Toene liegen hoch, weil die Kachel mit Mittel 132/80/45
    // deutlich dunkler ist als der geforderte Randton #A9703F
    // (169/112/63): 169/132 = 1,28 auf der Sonnenseite.
    for(let k=0;k<N;k++){
      const a0=k/N*6.283185, a1=(k+1)/N*6.283185, am=(a0+a1)*0.5;
      const licht=lichtAn(am);
      // Streuung je Daube, damit die Zarge nicht wie gedruckt aussieht
      const streu=0.93 + (((Math.sin(k*12.9898)*43758.5453)%1)+1)%1 * 0.14;
      const hell=(0.80 + 0.62*licht) * streu;
      const fuge=hell*0.52;                    // dunkle Fuge zwischen zwei
      const o0=pt(a0,LIP), om=pt(am,LIP), o1=pt(a1,LIP);
      const u=(p)=>[p[0], p[1]+DICK];
      // Unterkante dunkler: erst der Tonwertabfall nach unten laesst die
      // Zarge als stehende Wand lesen statt als liegendes Band
      quad(o0,om,u(om),u(o0), fuge,hell,hell*0.58,fuge*0.58, 1);
      quad(om,o1,u(o1),u(om), hell,fuge,fuge*0.58,hell*0.58, 1);
    }
    // 3. Deckring: die Holzlippe zwischen Gelaendeschnitt und Aussenkante
    for(let k=0;k<N;k++){
      const a0=k/N*6.283185, a1=(k+1)/N*6.283185, am=(a0+a1)*0.5;
      const hell=1.14 + 0.30*lichtAn(am);
      const i0=pt(a0,0), i1=pt(a1,0), o0=pt(a0,LIP), o1=pt(a1,LIP);
      quad(i0,i1,o1,o0, hell*0.88,hell*0.88,hell,hell, 0);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSockel);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    this.anzSockel = v.length / 4;
  }

  zeichne(cam, himmel, zeit){
    const gl = this.gl;
    if(!gl || !this.prog || !this.bereit || this._verloren) return false;
    gl.viewport(0, 0, this.cv.width, this.cv.height);
    gl.clearColor(himmel[0], himmel[1], himmel[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Sockel zuerst - das Gelaende deckt ihn dort, wo es liegt
    if(this.progS && this.anzSockel){
      gl.useProgram(this.progS);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSockel);
      gl.enableVertexAttribArray(this.aPosS);
      gl.vertexAttribPointer(this.aPosS, 4, gl.FLOAT, false, 0, 0);
      gl.uniform2f(this.uCamS, cam.x, cam.y);
      gl.uniform1f(this.uZoomS, cam.z);
      gl.uniform2f(this.uViewS, this.vw, this.vh);
      // Einheit 0 gehoert waehrend dieses Zugs dem Holz - das Gelaende
      // bindet seine Einheiten unten ohnehin jeden Frame neu
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texSockel);
      gl.uniform1i(this.uHolzS, 0);
      gl.drawArrays(gl.TRIANGLES, 0, this.anzSockel);
      gl.disable(gl.BLEND);
    }
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
    gl.uniform3f(this.uMassF, TILE, ROWH, HSCALE);
    const sl = Math.hypot(LX, LY, SUNZ);
    // Richtung ZUR Sonne. Im 2D-Pass steht die Rechnung als
    // dot(N,(−LX,−LY,SUNZ)) mit N=(−sx,−sy,1) da; ausmultipliziert ist das
    // dasselbe wie hier mit N=(−sx,−sy,1) und S=(−LX,−LY,SUNZ).
    gl.uniform3f(this.uSun, -LX/sl, -LY/sl, SUNZ/sl);
    // Themenfarbe halb auftragen: die Kacheln liefern die Zeichnung, die
    // Palette den Klimaton (Winterwiese fahl, Wuestenfels sandig).
    gl.uniform1f(this.uTint, 0.5);
    const fc = this._felsCol || [0.55, 0.52, 0.50];
    gl.uniform3f(this.uFelsCol, fc[0], fc[1], fc[2]);
    // Grundfarben (linear); Rueckfall = neutrale Toene, damit vor dem
    // ersten setzeMaterial nichts schwarz steht
    gl.uniform3fv(this.uG, this._grund || new Float32Array([
      0.16,0.52,0.04,  0.72,0.56,0.28,  0.83,0.85,0.90,  0.10,0.15,0.03,
      0.11,0.55,0.60,  0.29,0.28,0.38,  0.13,0.04,0.03,  0.01,0.15,0.29]));
    gl.uniform2f(this.uPix, this.cv.width, this.cv.height);
    gl.uniform1f(this.uZeit, zeit || 0);
    gl.uniform1f(this.uSchattenAn, this.ohneSchatten? 0 : 1);
    gl.uniform1f(this.uDebug, this.debug || 0);
    gl.uniform1f(this.uZoomF, cam.z);
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
