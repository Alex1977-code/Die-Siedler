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
uniform float uZeit;        // Sekunden, Echtzeit (Wasser lebt auch in Pause)
uniform float uSchattenAn;  // Diagnoseschalter wie _ohneCast im 2D-Weg
uniform float uDebug;       // 0 normal, 1 Gewichte als Farben, 2 Licht als Grau
uniform vec3 uFelsCol;      // Felsfarbe des Themas (fester Ton, NICHT das
                            // interpolierte vCol - das mischt am Massivrand
                            // Wiesengruen hinein)

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
  return texture2D(t, w / sk).rgb;
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

// ---- Wasser: zwei driftende Lagen + leises Glitzern ----
// Der 2D-Weg brauchte dafuer Muster-Transformationen je Frame, einen
// 1/6-Offscreen und Stempel-Schleifen (waterStamps). Hier sind es zwei
// Texturabfragen mit wandernden Koordinaten und zwei Sinuszuege, deren
// Produkt nur an den Spitzen ueber die Schwelle kommt - Funkeln statt
// Streifen, deterministisch aus Ort und Zeit.
vec3 wasser(){
  vec2 uv = vWorld / uSk2.x;
  // Nutzerkritik (Handyfoto v262): "wellen im wasser zu schnell und
  // regelmaessig". Zwei Aenderungen: das Tempo auf rund ein Drittel
  // (Drift halbiert, Funkel-Uhren 1.9/1.3/1.1 -> 0.55/0.41/0.33), und
  // gegen das Punktgitter laufen die Funkel-Sinusse auf VERBOGENEN
  // Koordinaten (Ortswellen schieben x und y je +-26 px) mit
  // inkommensurablen Frequenzen - die Spitzen des Produkts stehen dann
  // nicht mehr in Reih und Glied.
  vec3 a = texture2D(tWasser, uv + vec2(uZeit*0.005, uZeit*0.003)).rgb;
  vec3 b = texture2D(tWasser, uv*1.7 + vec2(-uZeit*0.0035, uZeit*0.0055)).rgb;
  vec3 w = mix(a, b, 0.40);
  // Warp-Uhren bewusst traege (erster Wurf 0.21/0.17 liess das ganze
  // Funkelfeld wandern und frass die Verlangsamung wieder auf - gemessen
  // fiel die 0,6-s-Bilddifferenz nur von 1,26 auf 1,04)
  float wx = vWorld.x + 26.0*sin(vWorld.y*0.013 + uZeit*0.07);
  float wy = vWorld.y + 22.0*sin(vWorld.x*0.011 - uZeit*0.055);
  float g1 = sin(wx*0.051 + uZeit*0.55) * sin(wy*0.0407 - uZeit*0.41);
  float g2 = sin((wx*0.83 + wy)*0.0343 + uZeit*0.33);
  float gl = max(0.0, g1*g2 - 0.62) * 1.1;
  return w + vec3(gl);
}

void main(){
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
  float band = 0.14 + 0.26*rausch;
  vec4 w1 = max(vec4(0.0), q1 - (mx - band));
  vec4 w2 = max(vec4(0.0), q2 - (mx - band));
  float sum = dot(w1, vec4(1.0)) + dot(w2, vec4(1.0));
  // Firndecke: weiche, leicht gestraffte und gefranste Rampe INNERHALB
  // der Gruppe - die Rolle der weichgezeichneten Firnmaske im 2D-Weg
  // Spanne 0,15..0,85 statt 0,30..0,70 und Rauschamplitude 0,34: die
  // vereisten Kammknoten liegen knotenweise 0/1 gestreut - straff
  // gefasst standen ihre halbdeckenden Dreieckspaare als blasse
  // Rechtecke im Fels (Reststufen nach der Normalenglaettung). Breiter
  // und staerker verrauscht lesen sie sich als Schneeflecken.
  float sMix = smoothstep(0.15, 0.85, sAnteil + (rausch - 0.5)*0.34);
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
  vec3 fels = steine(uFelsCol * (0.97 + 0.05*korn));
  vec3 massiv = mix(fels, hol(tSchnee, uSk1.z), sMix);
  vec3 alb =
      hol(tWiese,  uSk1.x) * w1.x + hol(tWueste, uSk1.y) * w1.y
    + hol(tSchnee, uSk1.z) * w1.z + hol(tMoor,   uSk1.w) * w1.w
    + wasser()               * w2.x + massiv       * w2.y
    + hol(tLava,   uSk2.z) * w2.z;
  alb /= max(0.001, sum);

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

  // ---- Hoehenstaffelung: der Berg wird nach oben hin heller ----
  // Ohne Kachel braucht das Auge einen zweiten Hinweis auf "hinauf":
  // der Fuss liegt gedeckt, Kamm und Gipfel hell - die klassische
  // Bergstaffelung. Nur auf dem Massiv.
  alb *= mix(1.0, 0.80 + 0.42*clamp(vHgt / max(1.0, uHfeld.z), 0.0, 1.0),
             clamp(mas, 0.0, 1.0));

  // ---- Kueste: Flachwasser und Schaumsaum ----
  // Der Wasseranteil aw laeuft vom offenen Wasser (1) ueber die Ufer-
  // dreiecke stetig auf 0 - dieselbe Interpolation, die die Material-
  // uebergaenge macht, ist hier gratis ein Tiefen-Ersatz: mittlere aw
  // heisst ufernah. Dort hellt Flachwasser auf (COAST_COL-Ton), und um
  // die 0,4-Linie laeuft ein schmaler, leise atmender Schaumsaum - die
  // Rolle von trans_sand/trans_foam im 2D-Weg, nur als Feld statt als
  // Stempelkette.
  if(aw > 0.03 && aw < 0.97){
    // Die Isolinie linear interpolierter Gewichte ist je Dreieck eine
    // GERADE - unverrauscht zeichnete der Saum das Dreiecksnetz als
    // Leuchtdraht nach (Beleg t31, Kuestenkontur aus geraden Segmenten).
    // Das Ortsrauschen kommt seit dem Kantenpass von oben.
    // STRAND: die Landseite des Uferbands bekommt Sand statt nassen
    // Grases - aber NUR, wo weiches Land ans Wasser stoesst (landWeich).
    // Ein Bergsee hat ein Felsufer, keinen Strand - derselbe Befund stand
    // im 2D-Weg schon als v101-Kommentar am Sandpinsel; und die
    // Winterkueste behaelt ihren Schnee.
    float strand = smoothstep(0.02, 0.16, aw) * (1.0 - smoothstep(0.28, 0.52, aw));
    strand *= clamp(landWeich / max(0.001, 1.0 - aw), 0.0, 1.0);
    alb = mix(alb, hol(tWueste, uSk1.y), strand * 0.55);
    float kante = smoothstep(0.10, 0.45, aw) * (1.0 - smoothstep(0.45, 0.85, aw));
    alb = mix(alb, vec3(0.42, 0.61, 0.72), kante * 0.24);
    float puls = 0.5 + 0.5*sin(uZeit*0.8 + (vWorld.x + vWorld.y)*0.011);
    float d9 = (aw - 0.18 - 0.38*rausch - 0.04*puls) / (0.05 + 0.05*rausch);
    float schaum = exp(-d9*d9);
    // LAENGS der Kueste in Flecken aufloesen: geschlossene Girlanden lesen
    // sich als Draht, echte Gischt kommt und geht
    schaum *= 0.35 + 0.65*max(0.0, sin(vWorld.x*0.024 - vWorld.y*0.019 + uZeit*0.35));
    alb = mix(alb, vec3(0.95, 0.97, 1.0), schaum * 0.30);
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

  // Nenner ist die Luminanz der PALETTENFARBE, nicht pauschal 0,5: das
  // Mischziel bekommt so genau die Helligkeit der Kachel (echte color-
  // Glasur). Mit /0.5 wurde die fast weisse Schnee-/Firnpalette um das
  // 1,6-fache verstaerkt - die Firnflaeche sass VOR dem Licht schon bei
  // 1,2 und klippte trotz Lichtschulter komplett aus (Beleg t34: 92 %
  // der Flaeche >= 250, Kachelzeichnung unsichtbar).
  float lum = dot(alb, vec3(0.299, 0.587, 0.114));
  float lumP = dot(vCol, vec3(0.299, 0.587, 0.114));
  alb = mix(alb, vCol * (lum / max(0.2, lumP)), uTint);

  // ---- Licht ----
  vec3 n = normalize(vNrm);
  // NORD-DAEMPFUNG wie im 2D-Pass (eckShade): nordgerichtete Haenge sind
  // in dieser Projektion die bildschirmgestreckten Rueckseiten. Voll
  // beleuchtet standen sie als grelle fahle Dreiecke ueber dem Massivrand.
  if (n.y > 0.0) n.y *= 0.35;
  // FACETTEN (Variante B): je Gitterzelle kippt die Normale um einen
  // festen kleinen Zufallsbetrag - das Facettenmosaik des alten 2D-Wegs,
  // nur aus der echten Normalen statt gemalter Bloecke. Nur auf dem
  // Massiv; die Wiese bleibt weich. ZWEI Lagen (ganze + halbe Zelle):
  // eine Lage allein liess die Flaechen so glatt, dass die kleinteiligen
  // Felsobjekte darauf wie aufgeklebt wirkten (Nutzerfoto v266, "mehr
  // kontur ... felsobjekte gut integriert") - die feine Lage bringt das
  // Detailniveau des Bodens an das der Objekte heran.
  // Seit dem Steinblockwerk (steine) traegt das MATERIAL die
  // Kleinteiligkeit - der Zellkipp ist auf eine dezente grobe Lage
  // zurueckgenommen, sonst doppeln sich die Facetten unruhig.
  {
    float m9 = clamp(mas, 0.0, 1.0);
    vec2 z9 = floor(vGrid + 0.5);
    float f1 = fract(sin(dot(z9, vec2(127.1, 311.7))) * 43758.5453);
    float f2 = fract(f1 * 167.17);
    n.xy += (vec2(f1, f2) - 0.5) * 0.18 * m9;
  }
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
  if(uSchattenAn > 0.5){
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
  float v = 0.36 + 0.98 * lam;
  // Kantige Lichtstufen auf dem Massiv (5 Stufen, +0,1 zentriert die
  // Stufe): zusammen mit dem Zellkipp oben entsteht das Facettenmosaik.
  v = mix(v, floor(v*5.0)/5.0 + 0.1, clamp(mas, 0.0, 1.0));
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

  // ---- Weiche Lichtschulter statt hartem Klipp ----
  // v laeuft bis 1,28; auf hellen Albedos (Schnee/Firn ~0,82) klippte das
  // Produkt und die sonnige Firnflaeche stand als reinweisse Flaeche ohne
  // jede Zeichnung da (Beleg t34: 98 % der Flaeche >= 250 - schon MIT der
  // alten ter_snow-Kachel waren es 94 %, kein Lieferungsfehler). Unterhalb
  // der Schulter s aendert sich nichts, darueber laeuft alles asymptotisch
  // gegen 1 aus - die Albedo-Zeichnung ueberlebt komprimiert.
  vec3 ue = max(col - vec3(0.86), vec3(0.0)) / 0.14;
  col = min(col, vec3(0.86)) + 0.14 * (1.0 - exp(-ue));
  // Debug-Ansichten: 1 = Gewichte (Fels rot, Schnee/Firn blau, Wiese
  // gruen, Rest tuerkis), 2 = reines Licht. Nur von Messwerkzeugen gesetzt.
  if(uDebug > 0.5 && uDebug < 1.5){
    col = vec3(w2.y, q1.x, sAnteil) / max(0.001, max(w2.y, max(q1.x, sAnteil)));
  } else if(uDebug > 1.5){
    col = vec3(v * 0.6);
  }
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
    this.uZeit = gl.getUniformLocation(p, 'uZeit');
    this.uSchattenAn = gl.getUniformLocation(p, 'uSchattenAn');
    this.uDebug = gl.getUniformLocation(p, 'uDebug');
    this.uTHgt = gl.getUniformLocation(p, 'tHgt');
    this.uSk1  = gl.getUniformLocation(p, 'uSk1');
    this.uSk2  = gl.getUniformLocation(p, 'uSk2');
    this.uFelsCol = gl.getUniformLocation(p, 'uFelsCol');
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
    // Felsfarbe des Themas (0..1) - traegt seit dem Facetten-Umbau den
    // Fels allein, die tFels-Kachel liegt nicht mehr auf dem Massiv
    if(bilder && bilder.felsFarbe) this._felsCol = bilder.felsFarbe;
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
      for(let i=0; i<n; i++) px[i*4] = Math.max(0, Math.min(255, Math.round(H[i]/mx*255)));
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

  zeichne(cam, himmel, zeit){
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
    const fc = this._felsCol || [0.55, 0.52, 0.50];
    gl.uniform3f(this.uFelsCol, fc[0], fc[1], fc[2]);
    gl.uniform2f(this.uPix, this.cv.width, this.cv.height);
    gl.uniform1f(this.uZeit, zeit || 0);
    gl.uniform1f(this.uSchattenAn, this.ohneSchatten? 0 : 1);
    gl.uniform1f(this.uDebug, this.debug || 0);
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
