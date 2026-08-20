// Posen- und Mesh-Korrekturen je Figur für den Sprite-Bäcker (bake-treiber.mjs).
//
// Warum diese Datei existiert: die Tripo-GLBs liefern nur drei Roh-Clips
// (Gehen, Warten, "Angriff"), und der Angriffs-Clip ist bei mehreren
// Modellen schlicht kaputt (Figur klappt zu Boden, Bogen zerreißt).
// Die Arbeitsgesten entstehen deshalb als HANDGESETZTE Schlüsselbilder:
// additive Knochendrehungen (Grad, [x,y,z]) über der Warte-Grundpose,
// zwischen den Schlüsseln weich geblendet (smoothstep). Spalte 4 ist per
// Konvention der KONTAKT-Moment (Ton-Synchronität, s. render.js ATK_MS).
//
// Achsen des gemeinsamen 41-Knochen-Tripo-Rigs (numerisch vermessen,
// s. agentS-Kalibrierung Bauarbeiter):
//   Spine01/02 X-  = Rumpf beugt VOR          Head X+ = Blick hebt sich
//   R/L_Upperarm X+ = Arm hebt nach VORN      Forearm X- = Ellbogen beugt
//   R/L_Thigh X-  = Bein hebt vor (Hocke)     Calf X+ = Knie beugt
//
// 'entfernen' sind Insel-IDs im EINEN SkinnedMesh des Modells (stabil je
// GLB-Datei, ermittelt über Dreiecks-Zusammenhang + Gewichtsregeln +
// empirische Streupixel-Bisektion): beim Jäger der eingebaute Bogen, der
// an Hand UND Fuß geskinnt war und bei jeder Pose zerriss - er wird durch
// das prozedurale 'bow'-Werkzeug (bake-sprites.html) ersetzt.

// Stützhand-Kürzel wie in den agentS-Posen: ruhig vor der Brust
const FRAMES_ATK = 8;

// ---------- Koerperbau (Asterix-Silhouetten, Spielerwunsch) ----------------
// 'koerper' skaliert Knochen statisch [sx,sy,sz] - Y bleibt 1 (Hoehe und
// UNIT_FIT unveraendert), nur die SILHOUETTE aendert sich (der Kritiker:
// ±20 % Breite liest sich auf Spielzoom klar). Kinder erben die Skalierung:
// wer Waist/Spine verbreitert, gibt dem Hals den Kehrwert zurueck, damit
// der Kopf normal bleibt. Hierarchie: Hip -> {Pelvis -> Thighs,
// Waist -> Spine01 -> Spine02 -> {NeckTwist01 -> Head, Clavicles -> Arme}}.
const DICK={     // runder Bauch, stramme Beine (Fischer, Metzger)
  Waist:[1.45,1,1.50], Spine01:[0.94,1,0.94],       // Bauch breit, Brust verjuengt
  NeckTwist01:[0.74,1,0.72],                        // Kopf bleibt normal
  L_Thigh:[1.14,1,1.14], R_Thigh:[1.14,1,1.14],
};
const RUNDLICH={ // gemuetlicher Ansatz (Mueller, Baecker)
  Waist:[1.28,1,1.32], Spine01:[0.97,1,0.97],
  NeckTwist01:[0.81,1,0.79],
  L_Thigh:[1.08,1,1.08], R_Thigh:[1.08,1,1.08],
};
const STAEMMIG={ // breite Schultern, kraeftige Arme (Schmied)
  // erste Fassung (Spine02 1,26 + Arme 1,14) wirkte als Gorilla-Klotz -
  // eine Stufe zurueckgenommen liest er sich als stark, nicht aufgeblasen
  Waist:[1.12,1,1.12], Spine02:[1.16,1,1.08],       // Schulterpartie breit
  NeckTwist01:[0.82,1,0.86],
  L_Upperarm:[1.07,1.02,1.07], R_Upperarm:[1.07,1.02,1.07],
  L_Thigh:[1.08,1,1.08], R_Thigh:[1.08,1,1.08],
};
const SCHLANK={  // hager (Foerster)
  Waist:[0.85,1,0.86], Spine01:[0.96,1,0.96],
  NeckTwist01:[1.20,1,1.19],
  L_Thigh:[0.92,1,0.92], R_Thigh:[0.92,1,0.92],
};
const DRAHTIG={  // sehnig-duenn (Jaeger)
  Waist:[0.80,1,0.82], Spine01:[0.95,1,0.95],
  NeckTwist01:[1.28,1,1.25],
  L_Thigh:[0.88,1,0.88], R_Thigh:[0.88,1,0.88],
};

// ---------- Gemeinsame Arbeitsgesten (T13) --------------------------------
// Die uebrigen Berufe liefen bis v232 auf den KAPUTTEN Tripo-Angriffs-Clips
// (Figur klappt zu Boden - die "Verbeugung" des Geologen), waehrend das
// Werkzeug als losgeloestes Overlay seinen eigenen Bogen schlug. Jetzt
// bekommen alle dieselbe Behandlung wie Jaeger/Foerster: handgesetzte
// Schluesselbilder + Werkzeug IN der Hand (am Knochen mitgebacken).
//
// HACK: rechtshaendiger Schlag von ueber dem Kopf nach vorn-unten
// (Geologe, Bergmann, Steinmetz - Spitzhacke). Kontakt Spalte 4.
const HACK = [
  [0,   { R_Upperarm:[38,0,-6],  R_Forearm:[-45,0,0],
          L_Upperarm:[18,0,8],   L_Forearm:[-26,0,0],
          Spine01:[-6,0,0], Head:[4,0,0] }],
  [1,   { R_Upperarm:[90,0,-10], R_Forearm:[-75,0,0],
          L_Upperarm:[26,0,10],  L_Forearm:[-36,0,0],
          Spine01:[6,0,0], Head:[8,0,0] }],
  [2,   { R_Upperarm:[138,0,-12],R_Forearm:[-88,0,0],
          L_Upperarm:[32,0,10],  L_Forearm:[-46,0,0],
          Spine01:[14,0,0], Spine02:[4,0,0], Head:[10,0,0],
          R_Thigh:[2,0,0], L_Thigh:[2,0,0] }],
  [3,   { R_Upperarm:[96,0,-8],  R_Forearm:[-38,0,0],
          L_Upperarm:[26,0,9],   L_Forearm:[-30,0,0],
          Spine01:[-10,0,0], Spine02:[-4,0,0], Head:[6,0,0] }],
  [4,   { R_Upperarm:[40,0,-6],  R_Forearm:[-4,0,0],                 // KONTAKT
          L_Upperarm:[20,0,8],   L_Forearm:[-14,0,0],
          Spine01:[-24,0,0], Spine02:[-9,0,0], Head:[13,0,0],
          R_Thigh:[-6,0,0], R_Calf:[8,0,0], L_Thigh:[-5,0,0], L_Calf:[7,0,0] }],
  [5,   { R_Upperarm:[44,0,-6],  R_Forearm:[-8,0,0],
          L_Upperarm:[20,0,8],   L_Forearm:[-16,0,0],
          Spine01:[-21,0,0], Spine02:[-8,0,0], Head:[12,0,0],
          R_Thigh:[-5,0,0], R_Calf:[7,0,0], L_Thigh:[-4,0,0], L_Calf:[6,0,0] }],
  [6.5, { R_Upperarm:[52,0,-7],  R_Forearm:[-40,0,0],
          L_Upperarm:[19,0,8],   L_Forearm:[-22,0,0],
          Spine01:[-12,0,0], Head:[7,0,0] }],
];
// HAMMER: kurzer, flinker Schlag auf Brust-/Kniehoehe (Bauarbeiter).
const HAMMERN = [
  [0,   { R_Upperarm:[42,0,-6],  R_Forearm:[-55,0,0],
          L_Upperarm:[14,0,6],   L_Forearm:[-20,0,0],
          Spine01:[-8,0,0], Head:[4,0,0] }],
  [1.5, { R_Upperarm:[100,0,-10],R_Forearm:[-62,0,0],
          L_Upperarm:[16,0,6],   L_Forearm:[-22,0,0],
          Spine01:[2,0,0], Head:[6,0,0] }],
  [2.5, { R_Upperarm:[122,0,-12],R_Forearm:[-72,0,0],
          L_Upperarm:[18,0,7],   L_Forearm:[-24,0,0],
          Spine01:[6,0,0], Spine02:[2,0,0], Head:[8,0,0] }],
  [4,   { R_Upperarm:[44,0,-6],  R_Forearm:[-10,0,0],                // KONTAKT
          L_Upperarm:[14,0,6],   L_Forearm:[-18,0,0],
          Spine01:[-18,0,0], Spine02:[-7,0,0], Head:[11,0,0],
          R_Thigh:[-4,0,0], R_Calf:[6,0,0], L_Thigh:[-3,0,0], L_Calf:[5,0,0] }],
  [5,   { R_Upperarm:[52,0,-7],  R_Forearm:[-34,0,0],
          L_Upperarm:[14,0,6],   L_Forearm:[-18,0,0],
          Spine01:[-18,0,0], Spine02:[-6,0,0], Head:[10,0,0] }],
  [6.5, { R_Upperarm:[46,0,-6],  R_Forearm:[-48,0,0],
          L_Upperarm:[14,0,6],   L_Forearm:[-20,0,0],
          Spine01:[-10,0,0], Head:[5,0,0] }],
];
// AXT: beidarmig angedeuteter Diagonalhieb von schraeg oben (Holzfaeller).
// Der Rumpf dreht leicht mit (Y), damit der Hieb Schwung hat.
const HACKEN_AXT = [
  [0,   { R_Upperarm:[40,0,-8],  R_Forearm:[-50,0,0],
          L_Upperarm:[28,0,10],  L_Forearm:[-44,0,0],
          Spine01:[-6,4,0], Head:[4,0,0] }],
  [1,   { R_Upperarm:[112,0,-14],R_Forearm:[-70,0,0],
          L_Upperarm:[45,0,14],  L_Forearm:[-60,0,0],
          Spine01:[8,10,0], Spine02:[3,4,0], Head:[8,-4,0] }],
  [2,   { R_Upperarm:[148,0,-18],R_Forearm:[-78,0,0],
          L_Upperarm:[58,0,16],  L_Forearm:[-68,0,0],
          Spine01:[14,14,0], Spine02:[5,6,0], Head:[10,-6,0],
          R_Thigh:[2,0,0], L_Thigh:[2,0,0] }],
  [3,   { R_Upperarm:[92,0,-10], R_Forearm:[-42,0,0],
          L_Upperarm:[44,0,12],  L_Forearm:[-40,0,0],
          Spine01:[-6,4,0], Head:[6,0,0] }],
  [4,   { R_Upperarm:[42,0,-6],  R_Forearm:[-8,0,0],                 // KONTAKT
          L_Upperarm:[26,0,8],   L_Forearm:[-16,0,0],
          Spine01:[-26,-8,0], Spine02:[-10,-3,0], Head:[14,4,0],
          R_Thigh:[-5,0,0], R_Calf:[7,0,0], L_Thigh:[-4,0,0], L_Calf:[6,0,0] }],
  [5,   { R_Upperarm:[46,0,-6],  R_Forearm:[-14,0,0],
          L_Upperarm:[26,0,8],   L_Forearm:[-18,0,0],
          Spine01:[-22,-6,0], Spine02:[-8,-2,0], Head:[12,3,0] }],
  [6.5, { R_Upperarm:[44,0,-7],  R_Forearm:[-42,0,0],
          L_Upperarm:[27,0,9],   L_Forearm:[-38,0,0],
          Spine01:[-10,0,0], Head:[6,0,0] }],
];
// SENSE: ruhiger Maehschwung - der Rumpf dreht von rechts nach links,
// die Arme bleiben lang (Bauer). Kontakt = Mitte des Schwungs.
const MAEHEN = [
  [0,   { R_Upperarm:[30,0,-10], R_Forearm:[-18,0,0],
          L_Upperarm:[34,0,12],  L_Forearm:[-30,0,0],
          Spine01:[-10,38,0], Spine02:[0,14,0], Head:[6,-13,0] }],
  [2,   { R_Upperarm:[34,0,-10], R_Forearm:[-14,0,0],
          L_Upperarm:[36,0,12],  L_Forearm:[-26,0,0],
          Spine01:[-12,18,0], Spine02:[0,7,0], Head:[7,-7,0] }],
  [4,   { R_Upperarm:[36,0,-10], R_Forearm:[-12,0,0],                // KONTAKT
          L_Upperarm:[38,0,12],  L_Forearm:[-24,0,0],
          Spine01:[-13,-12,0], Spine02:[0,-5,0], Head:[8,5,0] }],
  [5.5, { R_Upperarm:[33,0,-10], R_Forearm:[-15,0,0],
          L_Upperarm:[36,0,12],  L_Forearm:[-27,0,0],
          Spine01:[-11,-36,0], Spine02:[0,-13,0], Head:[7,12,0] }],
  [7,   { R_Upperarm:[30,0,-10], R_Forearm:[-18,0,0],
          L_Upperarm:[34,0,12],  L_Forearm:[-30,0,0],
          Spine01:[-10,24,0], Spine02:[0,9,0], Head:[6,-9,0] }],
];
// ANGEL: auswerfen und halten (Fischer). ATK_MS laeuft langsam (240 ms),
// die zweite Haelfte ist bewusst fast still - er WARTET auf den Biss.
const ANGELN = [
  [0,   { R_Upperarm:[42,0,-6],  R_Forearm:[-30,0,0],
          L_Upperarm:[12,0,6],   L_Forearm:[-18,0,0],
          Spine01:[-4,0,0], Head:[4,0,0] }],
  [1.5, { R_Upperarm:[108,0,-10],R_Forearm:[-70,0,0],
          L_Upperarm:[16,0,6],   L_Forearm:[-20,0,0],
          Spine01:[8,0,0], Head:[8,0,0] }],
  [3,   { R_Upperarm:[70,0,-8],  R_Forearm:[-16,0,0],
          L_Upperarm:[12,0,6],   L_Forearm:[-18,0,0],
          Spine01:[-6,0,0], Head:[2,0,0] }],
  [4,   { R_Upperarm:[54,0,-6],  R_Forearm:[-10,0,0],                // Schnur liegt
          L_Upperarm:[10,0,5],   L_Forearm:[-16,0,0],
          Spine01:[-8,0,0], Head:[0,0,0] }],
  [6,   { R_Upperarm:[52,0,-6],  R_Forearm:[-12,0,0],
          L_Upperarm:[10,0,5],   L_Forearm:[-16,0,0],
          Spine01:[-7,0,0], Head:[1,0,0] }],
  [7,   { R_Upperarm:[50,0,-6],  R_Forearm:[-16,0,0],
          L_Upperarm:[11,0,5],   L_Forearm:[-17,0,0],
          Spine01:[-6,0,0], Head:[2,0,0] }],
];
// SCHAUFEL: einstechen, hebeln, seitlich auswerfen (Planierer).
const SCHAUFELN = [
  [0,   { R_Upperarm:[36,0,-6],  R_Forearm:[-30,0,0],
          L_Upperarm:[30,0,10],  L_Forearm:[-40,0,0],
          Spine01:[-10,0,0], Head:[5,0,0] }],
  [1.5, { R_Upperarm:[62,0,-8],  R_Forearm:[-50,0,0],
          L_Upperarm:[42,0,12],  L_Forearm:[-52,0,0],
          Spine01:[0,0,0], Head:[6,0,0] }],
  [3,   { R_Upperarm:[46,0,-6],  R_Forearm:[-18,0,0],
          L_Upperarm:[34,0,10],  L_Forearm:[-30,0,0],
          Spine01:[-24,0,0], Spine02:[-8,0,0], Head:[12,0,0],
          R_Thigh:[-6,0,0], R_Calf:[8,0,0], L_Thigh:[-5,0,0], L_Calf:[7,0,0] }],
  [4,   { R_Upperarm:[40,0,-6],  R_Forearm:[-10,0,0],                // KONTAKT (Stich)
          L_Upperarm:[32,0,10],  L_Forearm:[-24,0,0],
          Spine01:[-34,0,0], Spine02:[-12,0,0], Head:[16,0,0],
          R_Thigh:[-8,0,0], R_Calf:[11,0,0], L_Thigh:[-7,0,0], L_Calf:[10,0,0] }],
  [5.5, { R_Upperarm:[58,0,-8],  R_Forearm:[-44,0,0],
          L_Upperarm:[48,0,14],  L_Forearm:[-56,0,0],
          Spine01:[-8,-14,0], Spine02:[-2,-5,0], Head:[8,5,0] }],
  [7,   { R_Upperarm:[40,0,-7],  R_Forearm:[-34,0,0],
          L_Upperarm:[33,0,10],  L_Forearm:[-42,0,0],
          Spine01:[-10,-4,0], Head:[6,1,0] }],
];
// Werkzeug-Anbringung: Stiel liegt QUER in der Faust (Grundlage +Y aus der
// Faust). rot [90,0,0] kippt ihn ueber die FINGERKNOECHEL nach vorn - so
// zeigt der Kopf beim Ausholen nach hinten-oben und am Kontakt nach
// vorn-unten (kalibriert ueber die Vorschau-Blaetter, T13; die erste
// Fassung [0,0,-90] stand seitlich uebers Daumengelenk ab).
const IN_FAUST=(kind,scale=1,rot=[90,0,0])=>({ atk:{ kind, bone:'R_Hand', pos:[0,0.02,0], rot, scale } });

export const POSEN = {
  geo:        { atk: HACK,       werkzeug: IN_FAUST('pick',1.25) },
  miner:      { atk: HACK,       werkzeug: IN_FAUST('pick',1.25) },
  quarry:     { atk: HACK,       werkzeug: IN_FAUST('pick',1.25) },
  builder:    { atk: HAMMERN,    werkzeug: IN_FAUST('hammer',1.7) },
  woodcutter: { atk: HACKEN_AXT, werkzeug: IN_FAUST('axe',1.35) },
  // Sense: Blatt zum BODEN gedreht (die Faust-Grundlage hielte es nach oben)
  farm:       { atk: MAEHEN,     werkzeug: IN_FAUST('scythe',1.15,[-70,0,0]) },
  leveler:    { atk: SCHAUFELN,  werkzeug: IN_FAUST('shovel',1.25) },
  fisher:  { koerper: DICK, atk: ANGELN, werkzeug: IN_FAUST('rod',1.25) },
  butcher: { koerper: DICK },
  miller:  { koerper: RUNDLICH },
  baker:   { koerper: RUNDLICH },
  smith:   { koerper: STAEMMIG },
  hunter: {
    koerper: DRAHTIG,
    // eingebauter (zerreißender) Bogen samt Streufragmenten
    entfernen: [49,93,94,97,101,105,114,115,117,118,124,126,129,130,132,136,140,141,166,169,170,179,183,186,192,194,195,200,205,206,213,216,217,221,224,235,245,249,259,267,270,273,278,282,292,297,298,300,320,321,327,328,333,338,347,350,355,360,364,368,370,374,375,376,385,387,388,391,394,401,403,408,414,420,440,467,473,478,490,495,502,505,509,518,519,521,538,598,601,602,603,643,644,839,1552,1742,1855,1889,1890,1891,1899,1904,2973,3111,3254,3255,3807,3808,3809,3810,4919,4921,5142,5143,5147,5613,5614,5617,5622,6101,6102,6168,6169,6171,6174,6178,6200,6217,6222,6224,6225,6226,6230,6239,6243,6244,6245,6258,6265,6280,6284,6286,6287,6288,6289,6291,6298,6304,6306,6309,6322,6323],
    // Werkzeug je Blatt: getragen (Gehen/Warten) hängt der Bogen längs der
    // Faust nach unten; beim Schießen steht er quer zur Faust (kalibriert:
    // Bogenebene senkrecht, Sehne zum Gesicht, leicht vorgeneigt).
    werkzeug: {
      walk: { kind:'bow', bone:'R_Hand', pos:[0,0.02,0], rot:[0,90,0],   scale:1.1 },
      idle: { kind:'bow', bone:'R_Hand', pos:[0,0.02,0], rot:[0,90,0],   scale:1.1 },
      atk:  { kind:'bow', bone:'R_Hand', pos:[0,0.05,0], rot:[105,0,90], scale:1.1 },
    },
    // Bogenschuss: heben - spannen - LÖSEN (Spalte 4) - absetzen
    atk: [
      [0,   { R_Upperarm:[30,0,-8],  R_Forearm:[-30,0,0], R_Hand:[0,0,0],
              L_Upperarm:[12,0,4],   L_Forearm:[-18,0,0], Spine01:[0,0,0], Head:[2,0,0] }],
      [1,   { R_Upperarm:[62,0,-6],  R_Forearm:[-14,0,0], R_Hand:[0,0,0],
              L_Upperarm:[35,0,8],   L_Forearm:[-60,0,0], Spine01:[2,-1,0], Head:[0,0,0] }],
      [2,   { R_Upperarm:[85,0,-6],  R_Forearm:[-8,0,0],  R_Hand:[0,0,0],
              L_Upperarm:[55,0,10],  L_Forearm:[-100,0,0], Spine01:[4,-2,0], Head:[-2,0,0] }],
      [3,   { R_Upperarm:[85,0,-6],  R_Forearm:[-8,0,0],  R_Hand:[0,0,0],
              L_Upperarm:[60,0,10],  L_Forearm:[-120,0,0], Spine01:[5,-3,0], Head:[-3,0,0] }],
      [4,   { R_Upperarm:[85,0,-6],  R_Forearm:[-8,0,0],  R_Hand:[0,0,0],   // LÖSEN
              L_Upperarm:[42,0,6],   L_Forearm:[-55,0,0],  Spine01:[3,-2,0], Head:[-2,0,0] }],
      [5,   { R_Upperarm:[78,0,-6],  R_Forearm:[-12,0,0], R_Hand:[0,0,0],
              L_Upperarm:[25,0,4],   L_Forearm:[-30,0,0],  Spine01:[2,-1,0], Head:[0,0,0] }],
      [6.5, { R_Upperarm:[40,0,-8],  R_Forearm:[-25,0,0], R_Hand:[0,0,0],
              L_Upperarm:[14,0,4],   L_Forearm:[-20,0,0],  Spine01:[0,0,0], Head:[2,0,0] }],
    ],
  },
  carrier: {
    // Tragepose (Set 'trag'): beide Haende halten die Kiste vor der Brust
    // (drawGood zeichnet die Ware mittig auf Schulterhoehe), leichtes
    // Zuruecklehnen als Gegengewicht. KONSTANT ueber dem Geh-Zyklus -
    // die Beine laufen aus dem Clip weiter, nur die Arme sind ersetzt.
    trag: { L_Upperarm:[58,0,8], L_Forearm:[-98,0,0], L_Hand:[-10,0,0],
            R_Upperarm:[58,0,-8], R_Forearm:[-98,0,0], R_Hand:[-10,0,0],
            Spine01:[4,0,0] },
  },
  forester: {
    koerper: SCHLANK,
    // Der Setzling steckt sauber geskinnt in der linken Hand des Meshes -
    // nichts zu entfernen, kein Zusatzwerkzeug.
    // Pflanzen: bücken - Setzling in den Boden (Spalte 4) - andrücken - aufrichten.
    // Bewusst ein STAND-Bücken (Spine-lastig, Knie nur leicht): eine echte
    // Hocke würde die Füße vom Boden heben, weil poseAdd nur dreht, nicht
    // verschiebt.
    atk: [
      [0,   { Spine01:[-4,0,0],  Head:[4,0,0],
              L_Upperarm:[30,0,6],  L_Forearm:[-35,0,0],
              R_Upperarm:[8,0,-4],  R_Forearm:[-12,0,0],
              R_Thigh:[-2,0,0], R_Calf:[3,0,0], L_Thigh:[-1,0,0], L_Calf:[2,0,0] }],
      [1,   { Spine01:[-20,0,0], Spine02:[-8,0,0], Head:[8,0,0],
              L_Upperarm:[42,0,6],  L_Forearm:[-22,0,0],
              R_Upperarm:[15,0,-4], R_Forearm:[-10,0,0],
              R_Thigh:[-6,0,0], R_Calf:[8,0,0], L_Thigh:[-5,0,0], L_Calf:[7,0,0] }],
      [2,   { Spine01:[-38,0,0], Spine02:[-16,0,0], Head:[14,0,0],
              L_Upperarm:[58,0,8],  L_Forearm:[-10,0,0],
              R_Upperarm:[30,0,-6], R_Forearm:[-8,0,0],
              R_Thigh:[-9,0,0], R_Calf:[12,0,0], L_Thigh:[-8,0,0], L_Calf:[11,0,0] }],
      [3,   { Spine01:[-56,0,0], Spine02:[-24,0,0], Head:[20,0,0],
              L_Upperarm:[78,0,8],  L_Forearm:[-6,0,0],
              R_Upperarm:[45,0,-6], R_Forearm:[-10,0,0],
              R_Thigh:[-10,0,0], R_Calf:[14,0,0], L_Thigh:[-9,0,0], L_Calf:[13,0,0] }],
      [4,   { Spine01:[-58,0,0], Spine02:[-25,0,0], Head:[20,0,0],           // KONTAKT
              L_Upperarm:[82,0,8],  L_Forearm:[-4,0,0],
              R_Upperarm:[55,0,-6], R_Forearm:[-14,0,0],
              R_Thigh:[-10,0,0], R_Calf:[14,0,0], L_Thigh:[-9,0,0], L_Calf:[13,0,0] }],
      [5,   { Spine01:[-48,0,0], Spine02:[-20,0,0], Head:[17,0,0],
              L_Upperarm:[64,0,7],  L_Forearm:[-15,0,0],
              R_Upperarm:[48,0,-6], R_Forearm:[-10,0,0],
              R_Thigh:[-9,0,0], R_Calf:[12,0,0], L_Thigh:[-8,0,0], L_Calf:[11,0,0] }],
      [6.5, { Spine01:[-14,0,0], Spine02:[-5,0,0], Head:[7,0,0],
              L_Upperarm:[34,0,6],  L_Forearm:[-30,0,0],
              R_Upperarm:[15,0,-4], R_Forearm:[-10,0,0],
              R_Thigh:[-4,0,0], R_Calf:[5,0,0], L_Thigh:[-3,0,0], L_Calf:[4,0,0] }],
    ],
  },
};

// ---------- Schlüsselbild-Blende (identisch zur agentS-Mathematik) ----------
const mixv=(a,b,t)=>a+(b-a)*t;
const ease=(t)=>t<0?0:t>1?1:t*t*(3-2*t);
function poseLerp(A,B,t){
  const out={}, keys=new Set([...Object.keys(A),...Object.keys(B)]);
  for(const k of keys){
    const a=A[k]||[0,0,0], b=B[k]||[0,0,0];
    out[k]=[mixv(a[0],b[0],t),mixv(a[1],b[1],t),mixv(a[2],b[2],t)];
  }
  return out;
}
// Liefert die Pose zum (Bruch-)Frame k eines 8er-Zyklus
export function atkPose(keys, k){
  const ks=[...keys,[FRAMES_ATK,keys[0][1]]];
  for(let i=0;i<ks.length-1;i++){
    if(k>=ks[i][0] && k<=ks[i+1][0]){
      const t=(k-ks[i][0])/Math.max(0.0001,(ks[i+1][0]-ks[i][0]));
      return poseLerp(ks[i][1],ks[i+1][1],ease(t));
    }
  }
  return ks[0][1];
}
