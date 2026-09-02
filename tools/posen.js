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
// Spaltenzahlen der uebrigen Sets (render.js COLS): cheer laeuft als
// Schleife, die/hit sind EINMALCLIPS - render.js faehrt sie ueber prog
// 0..1 einmal ab, 'die' bleibt auf der letzten Spalte liegen. Die Posen
// muessen deshalb OHNE Ruecksprung enden (kein Wrap auf Schluessel 0).
const FRAMES_CHEER = 12, FRAMES_DIE = 10, FRAMES_HIT = 8;

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
// ---------- Asterix-Runde 2 (T18): staerker uebertrieben ------------------
// "mehr asterix-stil auch bei ... koerperformen und accessoires". Ziel ist
// KONTRAST ZWISCHEN den Berufen, nicht Einheitsmass: der Flinke duerr mit
// grossem Kopf, der Starke breit auf schmalen Beinen, der Geniesser kugelig.
// Y bleibt ueberall 1 (UNIT_FIT), Koepfe wachsen ueber NeckTwist01.
const FLINK={    // duenn, flink, markanter Kopf (Traeger - haeufigste Figur)
  Waist:[0.88,1,0.90], Spine01:[0.97,1,0.97],
  NeckTwist01:[1.18,1,1.16],
  L_Thigh:[0.92,1,0.92], R_Thigh:[0.92,1,0.92],
};
const KRAFT={    // Kraftpaket: breite Schultern auf schmalen Beinen (Bauarbeiter)
  Waist:[1.14,1,1.14], Spine02:[1.24,1,1.12],
  NeckTwist01:[0.92,1,0.95],
  L_Upperarm:[1.10,1.02,1.10], R_Upperarm:[1.10,1.02,1.10],
  L_Thigh:[0.94,1,0.94], R_Thigh:[0.94,1,0.94],
};
const HOLZFAELLER={ // kraeftig, eine Stufe unter KRAFT (Holzfaeller)
  Waist:[1.10,1,1.10], Spine02:[1.12,1,1.06],
  NeckTwist01:[0.97,1,1.00],
  L_Upperarm:[1.08,1.02,1.08], R_Upperarm:[1.08,1.02,1.08],
  L_Thigh:[0.96,1,0.96], R_Thigh:[0.96,1,0.96],
};
const SCHMIED={  // STAEMMIG uebertrieben: Schrank auf Beinen (Schmied)
  Waist:[1.16,1,1.16], Spine02:[1.30,1,1.14],
  NeckTwist01:[0.80,1,0.84],
  L_Upperarm:[1.13,1.03,1.13], R_Upperarm:[1.13,1.03,1.13],
  L_Thigh:[0.95,1,0.95], R_Thigh:[0.95,1,0.95],
};
const KUGEL={    // Kugelbauch des Geniessers (Brauer)
  Waist:[1.55,1,1.62], Spine01:[0.90,1,0.90],
  NeckTwist01:[0.74,1,0.70],
  L_Thigh:[1.10,1,1.10], R_Thigh:[1.10,1,1.10],
};
const DICK_KOPF={ // DICK mit markanterem Kopf (Metzger)
  Waist:[1.45,1,1.50], Spine01:[0.94,1,0.94],
  NeckTwist01:[0.82,1,0.80],
  L_Thigh:[1.14,1,1.14], R_Thigh:[1.14,1,1.14],
};
const SPUERNASE={ // duerr-drahtig, Kopf noch groesser (Kundschafter)
  Waist:[0.82,1,0.84], Spine01:[0.95,1,0.95],
  NeckTwist01:[1.30,1,1.27],
  L_Thigh:[0.90,1,0.90], R_Thigh:[0.90,1,0.90],
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
// Beim Ausholen kippt die Faust den Kopf zusaetzlich nach hinten-oben
// (R_Hand X-): ohne das zeigte der Hammer laengs der Blickachse und
// verschwand in der Seitenansicht fast voellig (Zoom-Pruefung T15).
const HAMMERN = [
  [0,   { R_Upperarm:[42,0,-6],  R_Forearm:[-55,0,0],
          L_Upperarm:[14,0,6],   L_Forearm:[-20,0,0],
          Spine01:[-8,0,0], Head:[4,0,0] }],
  [1.5, { R_Upperarm:[100,0,-10],R_Forearm:[-62,0,0], R_Hand:[-32,0,0],
          L_Upperarm:[16,0,6],   L_Forearm:[-22,0,0],
          Spine01:[2,0,0], Head:[6,0,0] }],
  [2.5, { R_Upperarm:[122,0,-12],R_Forearm:[-72,0,0], R_Hand:[-42,0,0],
          L_Upperarm:[18,0,7],   L_Forearm:[-24,0,0],
          Spine01:[6,0,0], Spine02:[2,0,0], Head:[8,0,0] }],
  [4,   { R_Upperarm:[44,0,-6],  R_Forearm:[-10,0,0], R_Hand:[8,0,0], // KONTAKT
          L_Upperarm:[14,0,6],   L_Forearm:[-18,0,0],
          Spine01:[-18,0,0], Spine02:[-7,0,0], Head:[11,0,0],
          R_Thigh:[-4,0,0], R_Calf:[6,0,0], L_Thigh:[-3,0,0], L_Calf:[5,0,0] }],
  // RUECKWEG GESTRAFFT (T21), gleicher Befund wie bei der Axt: die
  // Spalten 5 bis 7 standen alle vorgebeugt mit dem Werkzeug unten.
  [4.6, { R_Upperarm:[52,0,-7],  R_Forearm:[-34,0,0],
          L_Upperarm:[14,0,6],   L_Forearm:[-18,0,0],
          Spine01:[-18,0,0], Spine02:[-6,0,0], Head:[10,0,0] }],
  [6,   { R_Upperarm:[70,0,-8],  R_Forearm:[-52,0,0], R_Hand:[-20,0,0],
          L_Upperarm:[15,0,6],   L_Forearm:[-20,0,0],
          Spine01:[-4,0,0], Head:[4,0,0] }],
  [7,   { R_Upperarm:[46,0,-6],  R_Forearm:[-52,0,0], R_Hand:[-10,0,0],
          L_Upperarm:[14,0,6],   L_Forearm:[-20,0,0],
          Spine01:[-8,0,0], Head:[4,0,0] }],
];
// AXT: ECHTER beidhaendiger Diagonalhieb (Holzfaeller). Die erste Fassung
// (v233) las sich als "Decke ausschuetteln" (Spielerkritik): am Kontakt
// standen die Arme nur 42 Grad vor - die Haende hingen optisch an der
// Huefte, die Axt zeigte unlesbar zu Boden, und die linke Hand pendelte
// unbeteiligt mit. Neu vermessen an der Vorschau:
//   - Ausholen BEIDARMIG uebers rechte Schulterblatt (Rumpf dreht Y+24
//     mit) - beide Faeuste bleiben am Stiel; der linke Arm ADDUZIERT dabei
//     (Z-, numerisch vermessen: Z+ haette ihn seitlich weggespreizt, das
//     war der "Winke-Arm" der Vorschau). Faustabstand in der Ausholpose
//     per bonePos kalibriert: L[150,0,-34]+Forearm-80 ergibt |LR|=0.157
//     (~Stielbreite), die erste Fassung lag bei 0.28 = lose Haende,
//   - oben wird KURZ verharrt (Schluessel 2.4 und 3.2 fast identisch),
//     dann faellt der Hieb in nur 0.8 Frames - das gibt ihm die Wucht,
//   - Kontakt (Spalte 4): Arme weit vorn-unten gestreckt (66 Grad,
//     Ellbogen fast lang), Rumpf klar vorgebeugt (-32), Knie federn,
//   - kurzes Verharren "im Holz" (Spalte 5), dann zurueck zur Bereitschaft.
const HACKEN_AXT = [
  [0,   { R_Upperarm:[48,0,-6],  R_Forearm:[-42,0,0],                // Bereitschaft
          L_Upperarm:[40,0,-8],  L_Forearm:[-50,0,0],
          Spine01:[-8,6,0], Head:[5,-2,0] }],
  [1.3, { R_Upperarm:[120,0,-12],R_Forearm:[-82,0,0],                // Axt steigt
          L_Upperarm:[112,0,-26],L_Forearm:[-78,0,0],
          Spine01:[10,16,0], Spine02:[4,7,0], Head:[6,-8,0],
          R_Thigh:[3,0,0], L_Thigh:[3,0,0] }],
  [2.4, { R_Upperarm:[160,0,-14],R_Forearm:[-96,0,0],                // volles Ausholen
          L_Upperarm:[150,0,-34],L_Forearm:[-80,0,0],
          Spine01:[17,24,0], Spine02:[7,10,0], Head:[8,-10,0],
          R_Thigh:[4,0,0], L_Thigh:[4,0,0] }],
  [3.2, { R_Upperarm:[150,0,-13],R_Forearm:[-90,0,0],                // Verharren oben
          L_Upperarm:[142,0,-32],L_Forearm:[-78,0,0],
          Spine01:[14,22,0], Spine02:[6,9,0], Head:[8,-9,0],
          R_Thigh:[4,0,0], L_Thigh:[4,0,0] }],
  [4,   { R_Upperarm:[66,0,0],   R_Forearm:[-8,0,0],                 // KONTAKT
          L_Upperarm:[60,0,-12], L_Forearm:[-14,0,0],
          Spine01:[-32,-10,0], Spine02:[-12,-4,0], Head:[16,4,0],
          R_Thigh:[-8,0,0], R_Calf:[10,0,0], L_Thigh:[-7,0,0], L_Calf:[9,0,0] }],
  // RUECKWEG GESTRAFFT (T21). Vorher lagen die Schluessel bei 5 und 6.5:
  // die Spalten 5, 6 und 7 zeigten damit alle dieselbe vorgebeugte
  // Haltung mit der Axt am Boden - drei von acht Bildern standen still,
  // und der Hieb las sich als einmaliges Bruecken statt als Takt
  // (Nutzerbefund "komische bewegungen", Beleg pb_woodcutter.png).
  // Jetzt sitzt die Axt nur noch eine halbe Spalte im Holz, danach richtet
  // sich die Figur sichtbar auf und die Axt loest sich schon in Spalte 6.
  [4.6, { R_Upperarm:[68,0,0],   R_Forearm:[-12,0,0],                // sitzt im Holz
          L_Upperarm:[60,0,-12], L_Forearm:[-16,0,0],
          Spine01:[-30,-8,0], Spine02:[-11,-3,0], Head:[15,3,0],
          R_Thigh:[-7,0,0], R_Calf:[9,0,0], L_Thigh:[-6,0,0], L_Calf:[8,0,0] }],
  [6,   { R_Upperarm:[78,0,-4],  R_Forearm:[-40,0,0],                // Axt loest sich
          L_Upperarm:[70,0,-16], L_Forearm:[-46,0,0],
          Spine01:[-12,4,0], Spine02:[-4,2,0], Head:[7,-1,0],
          R_Thigh:[-2,0,0], R_Calf:[3,0,0] }],
  [7,   { R_Upperarm:[56,0,-6],  R_Forearm:[-44,0,0],                // wieder bereit
          L_Upperarm:[48,0,-10], L_Forearm:[-52,0,0],
          Spine01:[-8,6,0], Head:[5,-2,0] }],
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
// Linke Hand ADDUZIERT (Z-) an den Schaft - Z+ spreizte sie weg vom
// Werkzeug (gleiche Messung wie beim Holzfaeller, T15).
const SCHAUFELN = [
  // AUSSCHLAG VERGROESSERT (T21). Nutzerbefund "planierer ... mit
  // komischen bewegungen": im Blatt schwang die Schaufel ueber acht
  // Spalten um vielleicht zwanzig Grad, die Figur stand dabei fast still -
  // sie sah aus, als lehne sie auf einem Spazierstock, nicht als grabe
  // sie (Beleg prevr_leveler.png). Gemessen an der Vorschau war der
  // Rumpf der Engpass: er ging nur von 0 auf -34 und wieder zurueck.
  // Jetzt vier klar getrennte Abschnitte statt eines Wiegens:
  //   0     Schaufel angesetzt, Rumpf aufrecht
  //   1.5   AUSHOLEN - Rumpf streckt sich, die Schaufel hebt an
  //   4     STICH (Kontakt) - voller Beugung, Knie federn, Blatt im Boden
  //   5.2   HEBELN - Rumpf richtet sich mit der Last auf
  //   6.4   AUSWERFEN - Rumpf dreht seitlich weg, Arme folgen
  // Beide Haende bleiben am Schaft: der linke Oberarm laeuft mit dem
  // rechten mit (Differenz konstant ~8 Grad), sonst haengt er unbeteiligt
  // an der Huefte - derselbe Fehler, den die Axt in v233 hatte.
  [0,   { R_Upperarm:[34,0,-6],  R_Forearm:[-28,0,0],
          L_Upperarm:[28,0,-14], L_Forearm:[-38,0,0],
          Spine01:[-12,0,0], Head:[6,0,0] }],
  [1.5, { R_Upperarm:[76,0,-10], R_Forearm:[-58,0,0],
          L_Upperarm:[66,0,-20], L_Forearm:[-64,0,0],
          Spine01:[10,0,0], Spine02:[4,0,0], Head:[2,0,0],
          R_Thigh:[3,0,0], L_Thigh:[3,0,0] }],
  [2.6, { R_Upperarm:[58,0,-8],  R_Forearm:[-30,0,0],
          L_Upperarm:[50,0,-18], L_Forearm:[-40,0,0],
          Spine01:[-22,0,0], Spine02:[-9,0,0], Head:[12,0,0],
          R_Thigh:[-6,0,0], R_Calf:[8,0,0], L_Thigh:[-5,0,0], L_Calf:[7,0,0] }],
  [4,   { R_Upperarm:[38,0,-6],  R_Forearm:[-8,0,0],                 // KONTAKT (Stich)
          L_Upperarm:[30,0,-14], L_Forearm:[-18,0,0],
          Spine01:[-46,0,0], Spine02:[-18,0,0], Head:[22,0,0],
          R_Thigh:[-13,0,0], R_Calf:[17,0,0], L_Thigh:[-11,0,0], L_Calf:[15,0,0] }],
  [5.2, { R_Upperarm:[64,0,-8],  R_Forearm:[-36,0,0],                // hebeln
          L_Upperarm:[56,0,-18], L_Forearm:[-46,0,0],
          Spine01:[-14,-8,0], Spine02:[-5,-3,0], Head:[9,3,0],
          R_Thigh:[-4,0,0], R_Calf:[6,0,0] }],
  [6.4, { R_Upperarm:[70,0,-12], R_Forearm:[-52,0,0],                // auswerfen
          L_Upperarm:[62,0,-24], L_Forearm:[-60,0,0],
          Spine01:[-6,-30,0], Spine02:[-2,-11,0], Head:[5,11,0] }],
  [7,   { R_Upperarm:[46,0,-8],  R_Forearm:[-38,0,0],
          L_Upperarm:[38,0,-16], L_Forearm:[-48,0,0],
          Spine01:[-11,-12,0], Head:[6,4,0] }],
];
// ---------- Soldaten (T14/T16) --------------------------------------------
// Die Tripo-Angriffs-Clips der Soldaten (1.29 s) ZERFETZEN Helmbusch und
// Umhang in freischwebende Fragmente, teils fehlen ganze Spalten (s. die
// zerrissenen Blaetter unit_sword_atk/unit_spear_atk/unit_bow_atk vom
// 13.08.). Die idle-/Geh-Blaetter derselben Modelle sind GANZ - das
// Zerreissen kommt also vom Clip, nicht vom Mesh. Heilung wie bei den
// Berufen: handgesetzte Schluesselbilder ueber der ruhigen Basis (die
// Soldaten haben keinen echten Warte-Clip, der Treiber nimmt den
// Geh-Durchschwung bei 27 %).
//
// T16 (Spielerkritik "Golfspielen"): die MESH-Waffen von sword/spear sind
// NUR an die Oberarmkette geskinnt (~60 % des Armwinkels, Drehpunkt
// Schulter) - Faust und Ellbogen bewegen sie nicht, mehr als eine flache
// Diagonale war damit unerreichbar. Darum jetzt die Jaeger-Methode:
// Mesh-Klinge/-Speer per 'entfernen' raus (Insel-IDs unten, verifiziert
// ueber Isolationsproben waffe2-sword/waffe3-spear), stattdessen
// prozedurale Faust-Waffen (kinds 'sword'/'spearw' in bake-sprites.html).
// Die Waffe haengt an R_Hand - Faust-Drehungen sind WIRKSAM und tragen
// die Pose. Der SCHILD bleibt im Mesh (sitzt sauber am linken Unterarm).
// Nur der bow-Soldat behaelt seine Mesh-Waffe (linke Faust, ok).
//
// SCHWERT: WUCHTIGER Ueberkopf-Hieb. Faust-Winkel per kalibw-Montagen
// vermessen (kalib-sword2/3.png) - die Faust-X-Achse wirkt oben und
// unten GEGENLAEUFIG (Quaternion-Komposition, kein lineares Modell):
//   Garde (Up40/Fa-55): Hand +40 hebt die Klinge auf ~+45 Grad,
//   Ausholen (Up165/Fa-100): Hand +10 legt sie ~45 Grad HINTER den Kopf
//     (Hand -80 kippte sie faelschlich nach VORN - sah aus wie ein Winken),
//   Kontakt (Up62/Fa-6): Hand -45 stellt sie vor-unten (~-20 Grad;
//     positive Werte druecken sie senkrecht zu Boden = alter "Golfschlag").
// Ablauf: Garde - Klinge steigt - volles Ueberkopf-Ausholen mit
// Rumpf-Aufdrehen (Y+22) - kurzes Verharren - der Hieb kracht in 0.9
// Frames nach vorn-unten: Arm gestreckt, Rumpf beugt kraeftig vor und
// dreht gegen, Knie federn. Kontakt Spalte 4, Verharren im Ziel,
// zurueck. Der linke Arm haelt den Schild konstant vor der Brust.
const SCHWERTHIEB = [
  [0,   { R_Upperarm:[40,0,-8],  R_Forearm:[-55,0,0], R_Hand:[40,0,0],  // Bereitschaft (Garde)
          L_Upperarm:[38,0,-6],  L_Forearm:[-66,0,0],
          Spine01:[-6,6,0], Head:[4,-2,0] }],
  [1.2, { R_Upperarm:[112,0,-14],R_Forearm:[-80,0,0], R_Hand:[25,0,0],  // Klinge steigt
          L_Upperarm:[40,0,-6],  L_Forearm:[-68,0,0],
          Spine01:[8,14,0], Spine02:[3,6,0], Head:[5,-6,0],
          R_Thigh:[3,0,0], L_Thigh:[3,0,0] }],
  [2.3, { R_Upperarm:[165,0,-18],R_Forearm:[-100,0,0],R_Hand:[-5,0,0],  // Klinge HINTER dem Kopf
          L_Upperarm:[42,0,-7],  L_Forearm:[-70,0,0],                   // (Hand -5 statt +10: bei
          Spine01:[16,22,0], Spine02:[7,9,0], Head:[8,-10,0],           // +10 verschwand die Klinge
          R_Thigh:[4,0,0], L_Thigh:[4,0,0] }],                          // auf 35px im Helmbusch)
  [3.1, { R_Upperarm:[158,0,-17],R_Forearm:[-95,0,0], R_Hand:[-6,0,0],  // Verharren oben
          L_Upperarm:[42,0,-7],  L_Forearm:[-70,0,0],
          Spine01:[14,20,0], Spine02:[6,8,0], Head:[8,-9,0],
          R_Thigh:[4,0,0], L_Thigh:[4,0,0] }],
  [4,   { R_Upperarm:[62,0,4],   R_Forearm:[-6,0,0],  R_Hand:[-45,0,0], // KONTAKT
          L_Upperarm:[40,0,-6],  L_Forearm:[-62,0,0],
          Spine01:[-30,-12,0], Spine02:[-11,-5,0], Head:[15,5,0],
          R_Thigh:[-8,0,0], R_Calf:[10,0,0], L_Thigh:[-7,0,0], L_Calf:[9,0,0] }],
  [5,   { R_Upperarm:[66,0,3],   R_Forearm:[-10,0,0], R_Hand:[-42,0,0], // Klinge steht im Ziel
          L_Upperarm:[40,0,-6],  L_Forearm:[-64,0,0],
          Spine01:[-27,-10,0], Spine02:[-10,-4,0], Head:[14,4,0],
          R_Thigh:[-7,0,0], R_Calf:[9,0,0], L_Thigh:[-6,0,0], L_Calf:[8,0,0] }],
  [6.5, { R_Upperarm:[46,0,-8],  R_Forearm:[-40,0,0], R_Hand:[-10,0,0], // zurueck zur Garde
          L_Upperarm:[39,0,-6],  L_Forearm:[-67,0,0],
          Spine01:[-10,2,0], Head:[6,0,0] }],
];
// SPEER: Stoss auf Hueft-Hoehe. Faust-Winkel per kalibw-Montagen vermessen
// (kalib-spear1/2.png): am Kontakt macht Hand X-50 den Schaft exakt
// WAAGERECHT (h-24 zeigte 35 Grad hoch, h-75 kippte in den Boden); die
// Spannpose W4 (Up4/Fa-30/Hand-55) legt ihn waagerecht AN DIE HUEFTE -
// ein weiter zurueckgerissener Arm (Up -30) versteckte den Speer komplett
// hinter Ruecken und Umhang, nur die Spitze lugte am Helm hervor.
// Ablauf: Bereitschaft diagonal - zuruecknehmen an die Huefte (Gewicht
// hinten, Rumpf-Yaw +26 auf) - gespannt verharren - STOSS: Arm streckt
// nach vorn, Schaft bleibt waagerecht, Rumpf dreht kraeftig gegen (Y-16)
// und lehnt in den Ausfall, Knie federn. Kontakt Spalte 4.
const SPEERSTOSS = [
  [0,   { R_Upperarm:[16,0,-4],  R_Forearm:[-14,0,0], R_Hand:[-25,0,0], // Bereitschaft (diagonal)
          L_Upperarm:[26,0,-10], L_Forearm:[-44,0,0],
          Spine01:[-4,4,0], Head:[3,0,0] }],
  [1.6, { R_Upperarm:[8,0,-5],   R_Forearm:[-24,0,0], R_Hand:[-42,0,0], // an die Huefte nehmen
          L_Upperarm:[40,0,-16], L_Forearm:[-56,0,0],
          Spine01:[6,22,0], Spine02:[2,9,0], Head:[2,-9,0],
          R_Thigh:[3,0,0], L_Thigh:[3,0,0] }],
  [3.2, { R_Upperarm:[4,0,-6],   R_Forearm:[-30,0,0], R_Hand:[-55,0,0], // gespannt, Gewicht hinten
          L_Upperarm:[44,0,-18], L_Forearm:[-60,0,0],
          Spine01:[8,26,0], Spine02:[3,11,0], Head:[2,-11,0],
          R_Thigh:[4,0,0], L_Thigh:[4,0,0] }],
  [4,   { R_Upperarm:[52,0,2],   R_Forearm:[-6,0,0],  R_Hand:[-50,0,0], // KONTAKT (Stoss, waagerecht)
          L_Upperarm:[46,0,-24], L_Forearm:[-30,0,0],
          Spine01:[-20,-16,0], Spine02:[-8,-7,0], Head:[11,7,0],
          R_Thigh:[-8,0,0], R_Calf:[10,0,0], L_Thigh:[-6,0,0], L_Calf:[8,0,0] }],
  [5,   { R_Upperarm:[48,0,1],   R_Forearm:[-10,0,0], R_Hand:[-47,0,0], // steckt
          L_Upperarm:[44,0,-22], L_Forearm:[-34,0,0],
          Spine01:[-18,-14,0], Spine02:[-7,-6,0], Head:[10,6,0],
          R_Thigh:[-7,0,0], R_Calf:[9,0,0], L_Thigh:[-5,0,0], L_Calf:[7,0,0] }],
  [6.5, { R_Upperarm:[24,0,-4],  R_Forearm:[-20,0,0], R_Hand:[-34,0,0], // herausziehen
          L_Upperarm:[34,0,-14], L_Forearm:[-42,0,0],
          Spine01:[-4,2,0], Head:[4,0,0] }],
];
// BOGENSCHUSS: heben - spannen - LÖSEN (Spalte 4) - absetzen. Kalibriert
// am Jaeger (T13), der den prozeduralen Bogen in der RECHTEN Faust traegt.
const BOGENSCHUSS = [
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
];
// Der bow-SOLDAT ist Linkshand-Traeger: sein Mesh-Bogen haengt in der
// LINKEN Faust (numerisch geprueft: R_Hand-Drehungen bewegen ihn gar
// nicht, L_Upperarm 85 hebt ihn sauber vor die Brust; die Wurfarme sind
// zusaetzlich auf Twist-/Calf-Knochen verschmiert, folgen aber bei
// moderaten Amplituden ohne zu zerreissen). Darum das SPIEGELBILD der
// Jaeger-Geste: links haelt den Bogen, rechts zieht die Sehne zur Wange.
const BOGENSCHUSS_SPIEGEL = [
  [0,   { L_Upperarm:[30,0,8],  L_Forearm:[-30,0,0],
          R_Upperarm:[12,0,-4], R_Forearm:[-18,0,0], Spine01:[0,0,0], Head:[2,0,0] }],
  [1,   { L_Upperarm:[62,0,6],  L_Forearm:[-14,0,0],
          R_Upperarm:[35,0,-8], R_Forearm:[-60,0,0], Spine01:[2,1,0], Head:[0,0,0] }],
  [2,   { L_Upperarm:[85,0,6],  L_Forearm:[-8,0,0],
          R_Upperarm:[55,0,-10],R_Forearm:[-100,0,0], Spine01:[4,2,0], Head:[-2,0,0] }],
  [3,   { L_Upperarm:[85,0,6],  L_Forearm:[-8,0,0],
          R_Upperarm:[60,0,-10],R_Forearm:[-120,0,0], Spine01:[5,3,0], Head:[-3,0,0] }],
  [4,   { L_Upperarm:[85,0,6],  L_Forearm:[-8,0,0],                   // LÖSEN
          R_Upperarm:[42,0,-6], R_Forearm:[-55,0,0],  Spine01:[3,2,0], Head:[-2,0,0] }],
  [5,   { L_Upperarm:[78,0,6],  L_Forearm:[-12,0,0],
          R_Upperarm:[25,0,-4], R_Forearm:[-30,0,0],  Spine01:[2,1,0], Head:[0,0,0] }],
  [6.5, { L_Upperarm:[40,0,8],  L_Forearm:[-25,0,0],
          R_Upperarm:[14,0,-4], R_Forearm:[-20,0,0],  Spine01:[0,0,0], Head:[2,0,0] }],
];
// ---------- Soldaten: Jubel / Treffer / Sterben (T17) ----------------------
// Die alten unit_*_cheer/die/hit-Blaetter stammten aus bake-clips.js
// (Scratchpad): prozedurale Posen ueber einem CARRIER-Donor-Warteclip.
// Der Donor-Clip fuehrt aber nicht alle 41 Knochen der Soldaten-Rigs -
// Helmbusch und Umhang blieben in Bind-Pose und schwebten als lose
// Fragmente neben der Figur (s. die zerrissenen alten Blaetter). Die
// GLBs selbst haben NUR Geh-Clip (2,38 s) + den bekannten kaputten
// 1,29-s-Clip (Streifenprobe T17: Figur zerknautscht in der Luft,
// Spalten ab ~70 % leer) - clip-basiert ist hier nichts zu holen.
// Darum dieselbe Behandlung wie atk: handgesetzte Schluesselbilder
// ueber dem Geh-Durchschwung, Waffe an der Faust.
//
// JUBEL (12 Spalten, Schleife, render.js 95 ms/Bild): zwei Faust-
// stoesse gen Himmel je Runde - Waffenarm reckt sich, Knie federn im
// Gegentakt, Kopf geht mit. Der linke Arm (Schild) schwingt halbhoch
// mit, ohne den Blick auf die Waffe zu verdecken.
const JUBEL = [
  [0,   { R_Upperarm:[104,0,-10], R_Forearm:[-38,0,0], R_Hand:[-45,0,0],  // tief, Knie gebeugt
          L_Upperarm:[30,0,-40],  L_Forearm:[-30,0,0],
          Spine01:[2,0,0], Head:[4,0,0],
          R_Thigh:[-9,0,0], R_Calf:[14,0,0], L_Thigh:[-9,0,0], L_Calf:[14,0,0] }],
  [1.5, { R_Upperarm:[168,0,-16], R_Forearm:[-10,0,0], R_Hand:[-70,0,0], // STOSS - Waffe hoch
          L_Upperarm:[46,0,-64],  L_Forearm:[-24,0,0],
          Spine01:[10,0,0], Spine02:[4,0,0], Head:[12,0,0] }],
  [3,   { R_Upperarm:[158,0,-15], R_Forearm:[-16,0,0], R_Hand:[-65,0,0], // oben halten
          L_Upperarm:[42,0,-58],  L_Forearm:[-26,0,0],
          Spine01:[8,0,0], Spine02:[3,0,0], Head:[10,0,0] }],
  [4.5, { R_Upperarm:[118,0,-11], R_Forearm:[-32,0,0], R_Hand:[-55,0,0],   // absinken
          L_Upperarm:[34,0,-46],  L_Forearm:[-28,0,0],
          Spine01:[4,0,0], Head:[6,0,0],
          R_Thigh:[-5,0,0], R_Calf:[8,0,0], L_Thigh:[-5,0,0], L_Calf:[8,0,0] }],
  [6,   { R_Upperarm:[104,0,-10], R_Forearm:[-38,0,0], R_Hand:[-45,0,0],  // tief (wie 0)
          L_Upperarm:[30,0,-40],  L_Forearm:[-30,0,0],
          Spine01:[2,0,0], Head:[4,0,0],
          R_Thigh:[-9,0,0], R_Calf:[14,0,0], L_Thigh:[-9,0,0], L_Calf:[14,0,0] }],
  [7.5, { R_Upperarm:[168,0,-16], R_Forearm:[-10,0,0], R_Hand:[-70,0,0], // zweiter STOSS
          L_Upperarm:[46,0,-64],  L_Forearm:[-24,0,0],
          Spine01:[10,0,0], Spine02:[4,0,0], Head:[12,0,0] }],
  [9,   { R_Upperarm:[158,0,-15], R_Forearm:[-16,0,0], R_Hand:[-65,0,0],
          L_Upperarm:[42,0,-58],  L_Forearm:[-26,0,0],
          Spine01:[8,0,0], Spine02:[3,0,0], Head:[10,0,0] }],
  [10.5,{ R_Upperarm:[118,0,-11], R_Forearm:[-32,0,0], R_Hand:[-55,0,0],
          L_Upperarm:[34,0,-46],  L_Forearm:[-28,0,0],
          Spine01:[4,0,0], Head:[6,0,0],
          R_Thigh:[-5,0,0], R_Calf:[8,0,0], L_Thigh:[-5,0,0], L_Calf:[8,0,0] }],
];
// JUBEL fuer den bow-Soldaten: der Mesh-Bogen haengt an der linken Faust,
// seine Wurfarme sind aber auf Twist-/Calf-Knochen verschmiert - ueber
// ~110 Grad Oberarm DEFORMIERT er nur noch, statt zu steigen (Vorschau-
// probe T17: der gespiegelte JUBEL liess den Bogen am Koerper kleben).
// Darum: Bogenarm hebt MODERAT (bis ~106), die freie RECHTE Faust pumpt
// dafuer voll gen Himmel - sie traegt kein Mesh und darf alles.
const JUBEL_BOGEN = [
  [0,   { R_Upperarm:[100,0,-10], R_Forearm:[-46,0,0],
          L_Upperarm:[58,0,10],   L_Forearm:[-24,0,0],
          Spine01:[2,0,0], Head:[4,0,0],
          R_Thigh:[-9,0,0], R_Calf:[14,0,0], L_Thigh:[-9,0,0], L_Calf:[14,0,0] }],
  [1.5, { R_Upperarm:[162,0,-32], R_Forearm:[-12,0,0],
          L_Upperarm:[106,0,8],   L_Forearm:[-10,0,0],
          Spine01:[10,0,0], Spine02:[4,0,0], Head:[12,0,0] }],
  [3,   { R_Upperarm:[152,0,-28], R_Forearm:[-16,0,0],
          L_Upperarm:[100,0,8],   L_Forearm:[-12,0,0],
          Spine01:[8,0,0], Spine02:[3,0,0], Head:[10,0,0] }],
  [4.5, { R_Upperarm:[116,0,-18], R_Forearm:[-36,0,0],
          L_Upperarm:[76,0,9],    L_Forearm:[-18,0,0],
          Spine01:[4,0,0], Head:[6,0,0],
          R_Thigh:[-5,0,0], R_Calf:[8,0,0], L_Thigh:[-5,0,0], L_Calf:[8,0,0] }],
  [6,   { R_Upperarm:[100,0,-10], R_Forearm:[-46,0,0],
          L_Upperarm:[58,0,10],   L_Forearm:[-24,0,0],
          Spine01:[2,0,0], Head:[4,0,0],
          R_Thigh:[-9,0,0], R_Calf:[14,0,0], L_Thigh:[-9,0,0], L_Calf:[14,0,0] }],
  [7.5, { R_Upperarm:[162,0,-32], R_Forearm:[-12,0,0],
          L_Upperarm:[106,0,8],   L_Forearm:[-10,0,0],
          Spine01:[10,0,0], Spine02:[4,0,0], Head:[12,0,0] }],
  [9,   { R_Upperarm:[152,0,-28], R_Forearm:[-16,0,0],
          L_Upperarm:[100,0,8],   L_Forearm:[-12,0,0],
          Spine01:[8,0,0], Spine02:[3,0,0], Head:[10,0,0] }],
  [10.5,{ R_Upperarm:[116,0,-18], R_Forearm:[-36,0,0],
          L_Upperarm:[76,0,9],    L_Forearm:[-18,0,0],
          Spine01:[4,0,0], Head:[6,0,0],
          R_Thigh:[-5,0,0], R_Calf:[8,0,0], L_Thigh:[-5,0,0], L_Calf:[8,0,0] }],
];
// TREFFER (8 Spalten, Einmalclip): scharfer Ruecksturz - Brust und Kopf
// fliegen zurueck, die Arme reissen auf, ein Bein stemmt nach vorn;
// danach langsames Fangen zurueck zur Haltung. Spitze frueh (Spalte 1),
// damit der Schlag-Kontakt des Gegners und der Ruck zusammenfallen.
const TREFFER = [
  [0,   { Spine01:[6,0,2], Head:[5,0,2],
          R_Upperarm:[-8,0,6],  L_Upperarm:[-8,0,-6] }],
  [1,   { Spine01:[30,0,8], Spine02:[16,0,5], Head:[26,0,9],             // voller Ruck
          R_Upperarm:[-46,0,30], R_Forearm:[-24,0,0],
          L_Upperarm:[-46,0,-30],L_Forearm:[-24,0,0],
          L_Thigh:[7,0,0], R_Thigh:[4,0,0], R_Calf:[6,0,0] }],
  [2.5, { Spine01:[20,0,5], Spine02:[11,0,3], Head:[18,0,6],
          R_Upperarm:[-30,0,20], R_Forearm:[-18,0,0],
          L_Upperarm:[-30,0,-20],L_Forearm:[-18,0,0],
          L_Thigh:[5,0,0], R_Thigh:[3,0,0], R_Calf:[4,0,0] }],
  [4.5, { Spine01:[9,0,2], Spine02:[5,0,1], Head:[8,0,3],
          R_Upperarm:[-12,0,8],  R_Forearm:[-10,0,0],
          L_Upperarm:[-12,0,-8], L_Forearm:[-10,0,0],
          L_Thigh:[2,0,0], R_Thigh:[1,0,0] }],
  [7,   { Spine01:[0,0,0], Head:[2,0,0],
          R_Upperarm:[2,0,0],   L_Upperarm:[2,0,0] }],
];
// STERBEN (10 Spalten, Einmalclip, letzte Spalte bleibt liegen): erst
// der Treffer-Ruck nach hinten, dann geben die Knie nach, der Rumpf
// sackt vor, und ab Spalte ~6 kippt der ganze Koerper (Root X+) nach
// vorn zu Boden - Beine gefaltet, Arme fallen vor, Kopf sinkt. Die
// Waffe bleibt in der Faust und legt sich mit um.
const STERBEN = [
  [0,   { Spine01:[2,0,0], Head:[2,0,0] }],
  [1.2, { Spine01:[14,0,4], Spine02:[8,0,2], Head:[12,0,5],              // Treffer
          R_Upperarm:[-20,0,14], L_Upperarm:[-20,0,-14],
          L_Thigh:[4,0,0] }],
  [2.8, { Spine01:[-12,0,2], Spine02:[-4,0,0], Head:[2,0,3],             // Knie geben nach
          R_Upperarm:[6,0,4],  R_Forearm:[-14,0,0],
          L_Upperarm:[6,0,-4], L_Forearm:[-14,0,0],
          Hip:[-6,0,0], R_Thigh:[-18,0,0], R_Calf:[36,0,0], L_Thigh:[-16,0,0], L_Calf:[32,0,0] }],
  [4.5, { Spine01:[-26,0,3], Spine02:[-10,0,0], Head:[-6,0,4],           // tiefes Sacken
          R_Upperarm:[16,0,6],  R_Forearm:[-10,0,0],
          L_Upperarm:[16,0,-6], L_Forearm:[-10,0,0],
          Hip:[-12,0,0], R_Thigh:[-34,0,0], R_Calf:[68,0,0], L_Thigh:[-32,0,0], L_Calf:[64,0,0] }],
  [6.2, { Root:[30,0,4],                                                  // Kippen beginnt
          Spine01:[-34,0,4], Spine02:[-14,0,0], Head:[-14,0,5],
          R_Upperarm:[30,0,8],  R_Forearm:[-8,0,0],
          L_Upperarm:[30,0,-8], L_Forearm:[-8,0,0],
          Hip:[-14,0,0], R_Thigh:[-44,0,0], R_Calf:[84,0,0], L_Thigh:[-42,0,0], L_Calf:[80,0,0] }],
  [8,   { Root:[62,0,6],                                                  // fast unten
          Spine01:[-42,0,4], Spine02:[-16,0,0], Head:[-22,0,6],
          R_Upperarm:[44,0,10],  R_Forearm:[-6,0,0],
          L_Upperarm:[44,0,-10], L_Forearm:[-6,0,0],
          Hip:[-18,0,0], R_Thigh:[-50,0,0], R_Calf:[94,0,0], L_Thigh:[-48,0,0], L_Calf:[90,0,0] }],
  [9,   { Root:[76,0,6],                                                  // liegt
          Spine01:[-45,0,4], Spine02:[-17,0,0], Head:[-26,0,6],
          R_Upperarm:[52,0,10],  R_Forearm:[-4,0,0],
          L_Upperarm:[52,0,-10], L_Forearm:[-4,0,0],
          Hip:[-20,0,0], R_Thigh:[-52,0,0], R_Calf:[98,0,0], L_Thigh:[-50,0,0], L_Calf:[94,0,0] }],
];
// FLUCHT (12 Spalten, Schleife ueber dem Geh-Zyklus): vornuebergebeugt,
// Kopf hoch (Panikblick), Arme angewinkelt mit leichtem Gegenpendeln -
// im Spiel schneller abgespielt (render.js 46 ms) ergibt das Rennen.
// Uebernimmt die Geste der alten bake-clips.js-Blaetter (T18).
export const FLUCHT = [
  [0, { Spine01:[-24,0,0], Spine02:[-13,0,0], Head:[26,0,0],
        R_Forearm:[-35,0,0], L_Forearm:[-35,0,0] }],
  [3, { Spine01:[-24,0,0], Spine02:[-13,0,0], Head:[26,0,0],
        R_Forearm:[-39,0,0], L_Forearm:[-31,0,0] }],
  [6, { Spine01:[-24,0,0], Spine02:[-13,0,0], Head:[26,0,0],
        R_Forearm:[-35,0,0], L_Forearm:[-35,0,0] }],
  [9, { Spine01:[-24,0,0], Spine02:[-13,0,0], Head:[26,0,0],
        R_Forearm:[-31,0,0], L_Forearm:[-39,0,0] }],
];
// Werkzeug-Anbringung: Stiel liegt QUER in der Faust (Grundlage +Y aus der
// Faust). rot [90,0,0] kippt ihn ueber die FINGERKNOECHEL nach vorn - so
// zeigt der Kopf beim Ausholen nach hinten-oben und am Kontakt nach
// vorn-unten (kalibriert ueber die Vorschau-Blaetter, T13; die erste
// Fassung [0,0,-90] stand seitlich uebers Daumengelenk ab).
const IN_FAUST=(kind,scale=1,rot=[90,0,0])=>({ atk:{ kind, bone:'R_Hand', pos:[0,0.02,0], rot, scale } });
// ---------- Asterix-Zubehoer (T18) ----------------------------------------
// Starre toolAttach-Anbauten am Knochen; sie gelten je Beruf fuer ALLE
// Sets (ruesten() nimmt seit T18 Listen), damit beim Set-Wechsel nichts
// flackert. Bart-Anker per Sondenmessung (bartkalib): das Gesicht liegt
// in Head-lokal Richtung -z (+z = Hinterkopf), der Mund bei y-0.12/
// z-0.23, die Gesichtsflaeche kippt ~45 Grad vor (rot X+45) - erst damit
// legen sich die Fluegel sichtbar UEBER die Wangen statt hinter die Nase.
const BART       =(s=2.2,pos=[0,-0.12,-0.23],rx=45)=>({ kind:'bart',      bone:'Head', pos, rot:[rx,0,0], scale:s });
const BART_GROSS =(s=2.4,pos=[0,-0.12,-0.23],rx=45)=>({ kind:'bartGross', bone:'Head', pos, rot:[rx,0,0], scale:s });
const BART_SCHMAL=(s=2.2,pos=[0,-0.12,-0.23])=>({ kind:'bartSchmal',bone:'Head', pos, rot:[45,0,0], scale:s });
// Robin-Hood-Feder hinten-oben an der Kappe (Probe D, feder-hunter.png)
const FEDER      =(s=1.6)=>({ kind:'feder',     bone:'Head', pos:[0,0.12,0.16], rot:[35,0,0], scale:s });
// werkzeug-Eintraege je Set um Zubehoer ergaenzen (macht Listen daraus)
const MIT=(werkzeug={}, zubehoer=[], sets=['walk','idle','atk','trag','flee','cheer','die','hit'])=>{
  const out={};
  for(const s of sets){
    const w=werkzeug[s];
    const arr=[...(w? (Array.isArray(w)?w:[w]) : []), ...zubehoer];
    if(arr.length) out[s]=arr;
  }
  return out;
};

export const POSEN = {
  // geo: der Geh-Clip (1,88 s) enthaelt ZWEI Schrittzyklen (Fusshoehen-
  // Periodik: bestes P=0.5 bei Fehler 0.026, T15) - ohne Fenster zeigten
  // die 12 Spalten beide Zyklen, also nur 6 echte Phasen (hastig).
  // T21: die prozedurale Spitzhacke ist bei allen dreien RAUS. Jedes der
  // drei Modelle traegt sein Werkzeug selbst und sauber in der Faust
  // (Beleg ws_zoom.png, obere Reihe: Geologenhammer, Bergmannshacke,
  // Steinmetzeisen) - die Zugabe lag als zweites Werkzeug darueber und
  // stand beim Steinmetz sogar frei neben der Figur.
  geo:        { atk: HACK,       koerper: DRAHTIG, walkFenster:[0,0.5] },
  miner:      { atk: HACK },
  quarry:     { atk: HACK },
  // Bauarbeiter: KEIN Zusatzwerkzeug und KEIN Bart mehr (T21).
  // Nutzerbefund "planierer bauarbeiter ... mit komischen bewegungen":
  // neben der Figur schwebte ein gebogener brauner Klotz in der Luft. Er
  // war weder Werkzeug noch Mesh-Rest, sondern der BART - der Anker
  // [0,-0.14,-0.36] schob ihn 36 cm vor den Kopfknochen, im Seitenbild
  // stand er frei neben dem Gesicht (Beleg builder_zoom.png). Der
  // Standardanker -0.23 half nicht (Abtastung bart_vergleich.png: sechs
  // Werte in vier Richtungen - naeher am Kopf verschwindet er darin,
  // weiter weg schwebt er). Dasselbe Ergebnis wie beim Holzfaeller in
  // T18, also dieselbe Folge: Bart raus.
  // Und das Modell bringt seine Spitzhacke SAUBER GESKINNT in der Faust
  // mit (Beleg wz_builder_vgl.png, Spalte "voll"); der prozedurale Hammer
  // lag als ZWEITES Werkzeug darueber. Das Mesh-Werkzeug bleibt.
  builder:    { atk: HAMMERN,    koerper: KRAFT },
  // Axt eine Stufe groesser (1.35 -> 1.5): auf Spielzoom war der Hieb sonst
  // kaum als Axtschlag lesbar (Spielerkritik "Decke ausschuetteln").
  // Ruck beim Laufen (T15, Spielerkritik): zwei 2-Dreieck-Inseln der
  // getragenen Axt haengen je zu 1/4 am STATISCHEN neutral_bone - bei der
  // Root-Motion des Geh-Clips (+0,55 z) bleiben diese Vertices zurueck,
  // zeichnen eine wachsende "Faden"-Linie und verankern die Zentrier-Box
  // (Knick -> Figur rutscht, Loop springt). 'entfernen' loescht die
  // Dreiecke, 'zentrierKnochen' macht den Versatz Box-unabhaengig.
  // Der Geh-Clip enthaelt ausserdem wie beim geo ZWEI Schrittzyklen
  // (R_Foot-Hoehenperiodik: Spitzen bei 0/0.47/0.94) -> walkFenster.
  // Bart beim Holzfaeller GEPRUEFT und verworfen (T18): sein Gesicht
  // neigt sich im Gehen so stark, dass jeder Bart-Anker entweder im
  // Kopf verschwindet oder als Klecks vor dem Gesicht schwebt
  // (bart-woodcutter*.png) - Identitaet kommt aus Axt+Statur+Tunika.
  // T21: die prozedurale Axt ist RAUS. Das Modell traegt seine eigene Axt
  // sauber in der Faust; die zweite, groessere lag quer darueber und
  // erschien im Blatt als flaches Brett vor der Brust (Beleg
  // prev-woodcutter-atk.png, Spalte 1). Mit dem Mesh-Werkzeug allein
  // liest sich der Hieb sofort: die Axt steigt in Spalte 1-3 und sitzt in
  // Spalte 4 im Holz (Beleg pb_woodcutter.png).
  // 'entfernen' bleibt: das sind die zwei 2-Dreieck-Inseln am statischen
  // neutral_bone, die im Gehen als Faden hinterherhaengen - nicht die Axt.
  woodcutter: { atk: HACKEN_AXT, koerper: HOLZFAELLER,
                entfernen:[2992,3092], zentrierKnochen:'Hip',
                walkFenster:[0,0.5] },
  // Sense: Blatt zum BODEN. Der Bauer ist der einzige der gemeldeten
  // Berufe OHNE eigenes Mesh-Werkzeug (Probe pb_farm.png: leere Haende) -
  // die prozedurale Sense muss also sitzen. -70 stellte sie fast
  // senkrecht: sie stak wie ein Spazierstock im Boden, und die
  // Maehdrehung des Rumpfes lief ins Leere. Sechs Winkel abgetastet, je
  // vier Spalten (Beleg ww_farm.png): bei -110/0/-30 liegt das Blatt flach
  // am Boden, der Stiel laeuft schraeg nach vorn-unten, und die
  // Rumpfdrehung traegt das Blatt sichtbar durch den Halm.
  farm:       { atk: MAEHEN,     werkzeug: IN_FAUST('scythe',1.15,[-110,0,-30]) },
  // leveler: im GLB steht eine ZWEITE Schaufel senkrecht neben der Figur -
  // 71 Inseln (511 Verts), alle AUSSCHLIESSLICH an R_ToeBase geskinnt
  // (islands()-Scan T15): sie folgt dem rechten Fuss statt der Hand und
  // schwebte in jedem atk-Frame los vom Koerper. Isolationsprobe
  // (axtprobe leveler): die IDs sind exakt Stiel+Blatt, die Schuhe
  // bleiben ganz. Raus damit - die Faust-Schaufel uebernimmt.
  // Werkzeug-rot -90 statt +90: der leveler ist der einzige Schaufel-
  // Beruf mit ECHTEM Warte-Clip als atk-Basis, und dessen Faust steht
  // um ~180 Grad anders als im Geh-Durchschwung - mit +90 zeigte das
  // Blatt nach hinten-oben ueber die Schulter (Vorschau T15), mit -90
  // nach vorn-unten in den Boden.
  // T21: die gemalte Schaufel wird UMGEHAENGT statt weggeworfen.
  // Sie ist zu 100 % an R_ToeBase gewichtet und stand deshalb senkrecht
  // neben dem rechten Fuss; bisher flog sie raus und ein prozeduraler
  // Kasten trat an ihre Stelle. Das gemalte Blatt ist die bessere Grafik -
  // es haengt nur am falschen Knochen. umhaengen() legt ihr oberes
  // Stielende (greifer 1, laengste Achse ist y) auf die Bindeposition der
  // rechten Faust und gewichtet sie allein dorthin. Drehung aus sechs
  // abgetasteten Werten ueber vier Spalten (Beleg uh_leveler.png): bei
  // -120/0/-25 zeigt der Stiel nach vorn-unten, am Kontakt steht das
  // Blatt im Boden.
  // T21: die gemalte Schaufel wird UMGEHAENGT statt weggeworfen. Sie ist
  // zu 100 % an R_ToeBase gewichtet und stand deshalb senkrecht neben
  // dem rechten Fuss; bisher flog sie raus und ein prozeduraler Kasten
  // trat an ihre Stelle. Das gemalte Blatt ist die bessere Grafik - es
  // haengt nur am falschen Knochen. umhaengen() legt ihr oberes
  // Stielende (greifer 1, laengste Achse ist y) auf die Bindeposition
  // der rechten Faust und gewichtet sie allein dorthin.
  //
  // ZWEI HALTUNGEN, nicht eine. Mit dem Grabwinkel in allen Blaettern
  // trug er die Schaufel im GEHEN waagerecht vor dem Bauch wie ein
  // Gewehr (Nutzerbefund "was macht der planierer fuer bewegungen",
  // Beleg lev_walk.png). Je zwoelf Winkel ueber vier Gehspalten
  // abgetastet (tragen.png, tragen2.png): 180/0/0 legt den Stiel
  // diagonal ueber die Brust, das Blatt an die Schulter - kompakte
  // Silhouette, nichts steht seitlich ab. Beim Graben bleibt -120/0/-25.
  //
  // Die vierzehn Splitter, die ich zuerst mit umgehaengt hatte, sind
  // NICHT Teil der Schaufel: isoliert sind sie ein eigener kleiner
  // Klotz (Beleg s14.png), der am Werkzeug haengend neben dem Kopf
  // schwebte. Sie fliegen raus.
  leveler:    { atk: SCHAUFELN,
                umhaengen:{ ids:[372,238,406,448,231,99,111,464,465,94,105,390,310,1759,29,289,256,410,2,86,389,239,178,270,386,1711,138,309,400,363,375,557,621,72,411,443,398,408,474,23,224,261,419,342,325,355,444,762,39,169,68,208,104,120,121,110,198,125,287,299,332,356,379,361,403,404,385,402,450,451,579],
                            bone:'R_Hand', greifer:1, rot:[-120,0,-25],
                            rotSet:{ walk:[180,0,0], idle:[180,0,0], trag:[180,0,0], flee:[180,0,0] } },
                entfernen:[2261,1819,1754,2316,2937,1760,1808,1820,2888,2941,2782,3119,1710,2117] },
  // fisher: das Mesh enthaelt eine EIGENE Angel-Ausruestung, wie beim
  // Jaeger quer ueber Hand- UND Fussknochen verschmiert - sie zerriss in
  // jeder Pose zu Strichen neben Kopf, Ruecken und Beinen. Drei Teile
  // (T19, Regel-Scan fischscan/fischprobe + Isolationsproben):
  //   1. Rute rechts (x=-0.28-Band, Boden bis y 0.98): R_Hand+R_ToeBase-
  //      Mix, Schnur/Spitze rein R_UpperarmTwist01, ein Fragment
  //      schwebte als "Punkt" neben dem Kopf (Head+R_UpperarmTwist01),
  //   2. Schnurbuendel links an der Huefte (lange flache Strips dz~0.35,
  //      unmoeglicher L_Hand+L_Bein-Mix): riss im Gehen zu Drahtschlaufen
  //      hinterm Ruecken auf,
  //   3. Schnur-Enden/Haken (L_Hand-dominant, z ueber +-0.16 hinaus).
  // Erkennungsregel: Hand+Zehen-Mischgewichte bzw. Einzelknochen-Strips
  // weit ausserhalb der Silhouette - echte Haende (L: 2108/1495/2423,
  // R: 5363/403/821), Stiefel und Zehen-Miniinseln bleiben unberuehrt
  // (verifiziert: Isolat = exakt die Angel, Restfigur vollstaendig).
  // Die prozedurale 'rod' an der Faust uebernimmt.
  // Getragene Rute (T20, Spielerwunsch): auch in walk/idle haelt er die
  // Rute - GESCHULTERT wie ein Angler auf dem Weg zum Wasser (Spitze
  // schraeg hinter-oben). Trage-Rotation per kalibrot-fisher(2).png
  // vermessen: [0,0,0] schleifte die Spitze vorn-unten ueber den Boden,
  // [90,0,0] (atk-Wert) lag laengs der Blickachse und verschwand in der
  // Seitenansicht, [160,0,0]+ klebte an Kopf/Kapuze, [200,0,0] stand
  // quer seitlich ab. [140,0,0] gibt die klarste freie Diagonale
  // (Spitze hinter der Schulter, keine Bein-/Kapuzen-Kollision).
  // idle EIGENER Winkel: der echte Warte-Clip des Fischers haelt die
  // Faust ~35 Grad anders als der Geh-Zyklus - mit dem walk-Wert 140
  // kippte die Rute fast waagerecht nach hinten (kalibrot-fisher-idle
  // .png: 175=waagerecht, 205=haengend); 125 stellt sie wieder auf die
  // geschulterte ~50-Grad-Diagonale (kalibrot-fisher-idle2.png).
  fisher:  { koerper: DICK, atk: ANGELN,
             werkzeug:{
               walk:{ kind:'rod', bone:'R_Hand', pos:[0,0.02,0], rot:[140,0,0], scale:1.25 },
               idle:{ kind:'rod', bone:'R_Hand', pos:[0,0.02,0], rot:[125,0,0], scale:1.25 },
               // atk NEU (T21): 90 legte die Rute DURCH den Koerper - sie
               // lief von unten links diagonal hinter dem Rumpf hindurch und
               // beruehrte keine Hand (Beleg prev-fisher-atk.png). Der Wert
               // stammte aus der Geh-Messung, wo die Faust anders steht.
               // Sechs Winkel abgetastet (ww_fisher.png): -20 haelt die Rute
               // waagerecht nach vorn aus der Faust, die Spitze frei ueber
               // dem Wasser, ohne Rumpf- oder Kapuzenschnitt.
               atk: { kind:'rod', bone:'R_Hand', pos:[0,0.02,0], rot:[-20,0,0], scale:1.25 },
             },
             entfernen:[1978,3663,4085,3826,2943,2739,4166,2946,3498,3840,120,4127,3704,3805,3827,4100,4053,4169,4624,4614,4766,3405,3643,3817,3732,3818,3825,3801,3917,4130,4060,4196,4325,4416,1335,3819,3891,4434,4577,4414,4578,4625,4719,1830,1519,4083,4165,3260,3568,4139,3496,3560,3726,3660,3727,3832,3796,3778,3908,3894,3939,3941,3896,4152,4019,4067,4059,4072,4087,4093,4133,4172,4134,4161,4158,4199,4171,4217,4501,4327,4415,4472,4579,4503,4505,4527,4649,4605,4720,4615,4616,4683,1449,4102,4185,3376,3500,3645,3719,3612,3738,3838,3812,3887,3888,3936,3897,3895,3892,3931,3861,3862,3934,3890,3964,3893,3928,3981,3940,3943,3933,3935,3946,4005,4145,4020,3989,3990,4075,4151,4144,4028,4094,4178,4150,4435,4245,4163,4160,4247,4220,4232,4233,4235,4288,4440,4442,4328,4378,4363,4366,4525,4417,4502,4528,4537,4475,4546,4477,4478,4479,4617,4663,4664,4679,4513,4545,4691,4548,4589,4694,4596,4653,4600,4558,4654,4658,4604,4594,4595,4657,4660,4665,4723,4724,4633,4635,4684,4662,4682,4701,4738,7164,7123,4637,7159,4737,6843,6749,6765,6746,6768,6552,6854,5186,6444,6913,3723,3970,6503,2482,2484,4730,6980,1116,4347,6381,6859,6963,4303,7175,6943,6322,6747,3906,2887,6750,6869,6931,6898,6936,6892,6995,5105,2485,3693,3767,3953,3700,1014,4061,4230,4227,5492,6576,7106,7084,107,1018,109,5069,1918,2487,1916,2489,3701,4305,4251,4275,4301,4639,6171,6173,7162,7177,7115,3460,4206,4404,4298,4308,4361,4467,6985,7094,2880,4314,4292,4354,4575,6966,7112,4190,4223,4290,4456,4372,4572,4447,7051,7064,4032,4261,4271,4340,4457,4454,4496,4498,4573,4397,4398,4445,7010,7119,7110,7093,7113,162,7073,7108,6748,7041,7092,6896,531,1705,732,5070,6808,6810,6965,6921,6981,5695,5106,6784,6785,6835,6935,7002,7042,6938,6982,6971,6941,6961,6970,6987,7013,6984,7067,6989,7007,7097,7021,7098,7191,7202,7189,7212,6903,4359,4565,6901,1982,1834,1334] },
  // Soldaten (T16): sword/spear tragen jetzt PROZEDURALE Faust-Waffen -
  // die Mesh-Waffen (nur Oberarm-geskinnt, "Golfschlag"-Grenze) fliegen
  // per 'entfernen' raus. Der Schild bleibt im Mesh. Insel-IDs verifiziert
  // ueber Isolationsproben (Waffe komplett isoliert, Figur+Faust+Schild
  // unversehrt). Beim Speer haengt der Mesh-Schaft an Oberarm UND Zehe
  // (wie der Jaeger-Bogen) samt Bodenkappen-Fragmenten bei y=0.
  sword:   { atk: SCHWERTHIEB, cheer: JUBEL, hit: TREFFER, die: STERBEN,
             entfernen:[911,21,22],
             // cheer: Klinge quer zur hochgereckten Faust (rot 90 wie atk) -
             // eine senkrecht weitergefuehrte Klinge (Trage-rot 155) stiesse
             // beim vollen Recken oben aus dem festen Bildausschnitt.
             // hit/die: Trage-Rotation (155) - die Waffe bleibt gesenkt.
             werkzeug:{
               walk:{ kind:'sword', bone:'R_Hand', pos:[0,0.02,0], rot:[155,0,0], scale:1.25 },
               idle:{ kind:'sword', bone:'R_Hand', pos:[0,0.02,0], rot:[155,0,0], scale:1.25 },
               atk: { kind:'sword', bone:'R_Hand', pos:[0,0.02,0], rot:[90,0,0],  scale:1.25 },
               cheer:{kind:'sword', bone:'R_Hand', pos:[0,0.02,0], rot:[90,0,0],  scale:1.25 },
               hit: { kind:'sword', bone:'R_Hand', pos:[0,0.02,0], rot:[155,0,0], scale:1.25 },
               die: { kind:'sword', bone:'R_Hand', pos:[0,0.02,0], rot:[155,0,0], scale:1.25 },
             } },
  spear:   { atk: SPEERSTOSS, cheer: JUBEL, hit: TREFFER, die: STERBEN,
             entfernen:[3026,1703,2264,2943,1639,1882,1479,2253,2254,1873,1884,2150,2556,2831,3029,3036,2941,2935,2630,2693,2695,3039,2552,3021,3028,3126,3230,2931,2153,2265,2575,2267,2567,2465,2272,2543,3038,2562,2687,2628,2627,2689,2788,2942],
             // Trage-Rotation per kalibrot-spear.png vermessen: [0,0,0]
             // liess den Schaft nach vorn-unten haengen (schleifender
             // Speer), [150,0,0] schultert ihn (Spitze schraeg hinter-oben)
             werkzeug:{
               walk:{ kind:'spearw', bone:'R_Hand', pos:[0,-0.05,0], rot:[150,0,0], scale:1.25 },
               idle:{ kind:'spearw', bone:'R_Hand', pos:[0,-0.05,0], rot:[150,0,0], scale:1.25 },
               atk: { kind:'spearw', bone:'R_Hand', pos:[0,0.02,0],  rot:[90,0,0],  scale:1.25 },
               cheer:{kind:'spearw', bone:'R_Hand', pos:[0,0.02,0],  rot:[90,0,0],  scale:1.25 },
               hit: { kind:'spearw', bone:'R_Hand', pos:[0,-0.05,0], rot:[150,0,0], scale:1.25 },
               die: { kind:'spearw', bone:'R_Hand', pos:[0,-0.05,0], rot:[150,0,0], scale:1.25 },
             } },
  // bow: Mesh-Bogen haengt in der LINKEN Faust und ist in Ordnung (T16) -
  // cheer/die/hit brauchen KEIN prozedurales Werkzeug, der Bogen folgt der
  // linken Faust von selbst. Jubel gespiegelt (Bogenarm reckt sich).
  bow:     { atk: BOGENSCHUSS_SPIEGEL, cheer: JUBEL_BOGEN, hit: TREFFER, die: STERBEN },
  butcher: { koerper: DICK_KOPF, werkzeug: MIT({}, [BART(2.2,[0,-0.13,-0.27])]) },
  miller:  { koerper: RUNDLICH },
  baker:   { koerper: RUNDLICH },
  // T18: der Schmied als Schrank mit Walross-Bart, der Brauer als Kugel,
  // der Kundschafter duerr mit Riesenkopf und Hutfeder
  smith:   { koerper: SCHMIED, werkzeug: MIT({}, [BART_GROSS(2.4,[0,-0.13,-0.28])]) },
  brewer:  { koerper: KUGEL,   werkzeug: MIT({}, [BART(2.5,[0,-0.13,-0.28],55)]) },
  scout:   { koerper: SPUERNASE, werkzeug: MIT({}, [FEDER(1.4)]) },
  hunter: {
    koerper: DRAHTIG,
    // eingebauter (zerreißender) Bogen samt Streufragmenten
    entfernen: [49,93,94,97,101,105,114,115,117,118,124,126,129,130,132,136,140,141,166,169,170,179,183,186,192,194,195,200,205,206,213,216,217,221,224,235,245,249,259,267,270,273,278,282,292,297,298,300,320,321,327,328,333,338,347,350,355,360,364,368,370,374,375,376,385,387,388,391,394,401,403,408,414,420,440,467,473,478,490,495,502,505,509,518,519,521,538,598,601,602,603,643,644,839,1552,1742,1855,1889,1890,1891,1899,1904,2973,3111,3254,3255,3807,3808,3809,3810,4919,4921,5142,5143,5147,5613,5614,5617,5622,6101,6102,6168,6169,6171,6174,6178,6200,6217,6222,6224,6225,6226,6230,6239,6243,6244,6245,6258,6265,6280,6284,6286,6287,6288,6289,6291,6298,6304,6306,6309,6322,6323],
    // Werkzeug je Blatt: getragen (Gehen/Warten) hängt der Bogen längs der
    // Faust nach unten; beim Schießen steht er quer zur Faust (kalibriert:
    // Bogenebene senkrecht, Sehne zum Gesicht, leicht vorgeneigt).
    werkzeug: MIT({
      walk: { kind:'bow', bone:'R_Hand', pos:[0,0.02,0], rot:[0,90,0],   scale:1.1 },
      idle: { kind:'bow', bone:'R_Hand', pos:[0,0.02,0], rot:[0,90,0],   scale:1.1 },
      atk:  { kind:'bow', bone:'R_Hand', pos:[0,0.05,0], rot:[105,0,90], scale:1.1 },
    }, [FEDER()]),   // T18: Hutfeder
    // Bogenschuss: gemeinsame Geste mit dem bow-Soldaten (s. BOGENSCHUSS)
    atk: BOGENSCHUSS,
  },
  carrier: {
    koerper: FLINK,   // T18: haeufigste Figur - duenn-flink, markanter Kopf
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
// Liefert die Pose zum (Bruch-)Frame k. wrap=true haengt Schluessel 0 ans
// Ende (Schleifen: atk/cheer); wrap=false haelt den LETZTEN Schluessel
// (Einmalclips: die/hit - render.js laesst 'die' auf der Endspalte liegen).
export function keyPose(keys, k, frames, wrap=true){
  const ks= wrap ? [...keys,[frames,keys[0][1]]] : keys;
  if(k<=ks[0][0]) return ks[0][1];
  for(let i=0;i<ks.length-1;i++){
    if(k>=ks[i][0] && k<=ks[i+1][0]){
      const t=(k-ks[i][0])/Math.max(0.0001,(ks[i+1][0]-ks[i][0]));
      return poseLerp(ks[i][1],ks[i+1][1],ease(t));
    }
  }
  return ks[ks.length-1][1];
}
export const atkPose=(keys,k)=>keyPose(keys,k,FRAMES_ATK,true);
export const SET_FRAMES={ atk:FRAMES_ATK, cheer:FRAMES_CHEER, die:FRAMES_DIE, hit:FRAMES_HIT };
