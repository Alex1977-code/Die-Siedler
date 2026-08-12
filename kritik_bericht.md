# Kritikbericht „Neuland" — Grafik · Sound · Spielspaß

**Datum:** 12.08.2026 · **Geprüfter Stand:** `b12ae91` (Branch `claude/siedler-2-mobile-clone-0rc5db`)
**Prüfaufbau:** Chromium headless 1000×800 (DPR 2), freies Spiel Saat 11 und 23 (Größe M, 1 Gegner Stufe 2, Normal), je 30 Spielminuten simuliert (18 000 Takte), Saat 11 zusätzlich 60 Minuten; Kampagne Mission 1 angespielt; alle Belege liegen als `kritik_*.png` im Repo-Wurzelverzeichnis (unversioniert).

Berücksichtigt wurden die letzten 15 Commits (v143–v154): Stillstands-Fixes (v151/v152), KI-Materialhilfe als Boden (v153), Zellgrenzen-Linien (v154) u. a. — Behobenes wurde stichprobenartig nachgeprüft und zählt nicht als offener Mangel (Details je Abschnitt).

---

## Grafik: **6/10**

**Was trägt:** Die Gebäude sind das Prunkstück — Burg, Sägewerk mit offenem Sägeschuppen, Hütte, Mine mit Fördergerüst, Windmühle, Bauernhof samt goldener Felder lesen sich sofort und sitzen stimmig im Gelände (kritik_p_s23_ki_20min.png, kritik_p_s11_ki_30min.png). Baumvielfalt (Eiche, Birke, Weide, Fichte) mit sauberen Fußschatten, Wild (Reh, Hase, Wildschein), Falter und Vögel beleben die Karte (kritik_g10_wald_z22.png). Straßen wirken wie echte Trampelpfade, Baustellen zeigen Fachwerk-Rohbau mit Materialstapeln und Fortschrittsbalken (kritik_g16_baustelle_z22.png). HUD, Bau-Menü, Lager- und Statistik-Blätter sind vorbildlich lesbar (kritik_u04–u06).

### Befunde (absteigend nach Punktkosten)

**G1 · Boden wird bei Nahzoom zu Aquarell-Brei — „−0,75"**
Beobachtung: Ab Zoom ~1,6 ist das Gras eine weiche, konturlose Fläche; Detailtupfer (Steinchen, Halme) sind spärlich und selbst unscharf, während Bäume/Gebäude knackscharf bleiben — der Stilbruch fällt auf jedem Screenshot bei z2,2 auf (kritik_g08_wiese_z22.png, kritik_g13_gebirge_z22.png). Siedler II hatte auf Maximalzoom klar strukturierten Boden.
Abhilfe: In `js/render.js` beim Chunk-Backen eine zweite, höher aufgelöste Kachelstufe für cam.z > ~1,5 vorsehen (Texturen `ter_grass.png` & Co. in 2×), zusätzlich Detail-Overlay (feines Rauschen/dichtere Grasbüschel) nur in der Nahstufe einblenden.

**G2 · Nach jedem Schwenk ploppen sekundenlang pixelige Kacheln — „−0,75"**
Beobachtung: Nach Kamerabewegung bleibt v. a. am unteren Bildrand ein Streifen grob verpixelter Geländekacheln stehen (Bäume als Klötzchen, Straßen als rote Striche): kritik_g06_hq_z06.png, kritik_g11_gebirge_z1.png (Ecke unten rechts), kritik_g14_kueste_z1.png (unterer Streifen), kritik_u03_mission1_start.png (links unten) — noch 1,5 s nach dem Schwenk sichtbar (kritik_p_s11_ki_30min.png); erst nach ~6 s Ruhe ist alles scharf (kritik_g19_band_nach6s.png). Beim Spielen mit Wischgesten ist das ein Dauerärgernis.
Abhilfe: `js/render.js`, Chunk-Cache: Bake-Reihenfolge nach Sichtbarkeit priorisieren (Viewport-Chunks zuerst, unterer Rand nicht zuletzt), Bake-Budget pro Frame erhöhen oder Zwischenstufe bilinear statt nearest hochskalieren, bis der scharfe Bake vorliegt.

**G3 · Braune „Waldboden"-Flecken wie Kaffeeflecken auf der Wiese — „−0,5"**
Beobachtung: Unter Baumgruppen liegen große, weichgezeichnete Braunflächen mit weiß gesprenkeltem Rand; aus der Übersicht wirken sie wie Schmutzflecken auf dem Gras, nicht wie Waldboden (kritik_g04_hq_z1.png rechts, kritik_g06_hq_z06.png, kritik_g08_wiese_z22.png unten, kritik_p_s11_spieler_30min.png). Bei z2,2 zeigt der Rand ein körniges Weiß-Rauschen wie ein Kopierfehler.
Abhilfe: Übergang in `js/render.js`/`map.js` (Waldboden-Maske): Farbton Richtung dunkles Moosgrün statt Braun, Rand ohne weißes Speckle (weiche Alpha-Rampe statt Dither), Deckkraft senken.

**G4 · Brandungs-Schaum als weißes Rauschen — auch auf Felswänden — „−0,5"**
Beobachtung: Jede Küste, jede Sandinsel trägt einen dicken, statischen Weiß-Flaum, der wie Fell/Raureif liest statt wie Gischt (kritik_g14_kueste_z1.png, kritik_g11_gebirge_z1.png). Grober Fehler: Auf der Klippe ÜBER dem Wasser liegen große Schaumflächen mit hindurchwachsenden Grasbüscheln (kritik_g13_gebirge_z22.png, rechte Bildhälfte).
Abhilfe: `trans_foam`-Auftrag nur an Kanten Land→Wasser mit Wassernachbar auf gleicher/niedrigerer Höhe (Höhenprüfung wie bei der Wehen-Logik, render.js ~Z. 4246 ff.), Deckkraft ~50 %, optional 2-Phasen-Versatz für leichte Bewegung.

**G5 · Gebirge = konturarmer brauner Facettenklumpen — „−0,5"**
Beobachtung: Das Massiv besteht aus sehr großen, gleichförmigen Facetten mit matschiger, gestreckter Textur; aus der Ferne eine braune Masse ohne Gipfelcharakter, das Schnee-/Firnfeld wirkt wie aufgelegtes Papier (kritik_g11_gebirge_z1.png, kritik_g12_gebirge_z06.png, kritik_p_s11_ki_30min.png). Die Steinstapel-Deko am Rand hilft, die Flächen dazwischen bleiben leer.
Abhilfe: Felstextur (ter_fels_*.png) kontrastreicher einsetzen, Facettengröße halbieren, Rissen/Bändern mehr Deckkraft geben (render.js Massiv-Zeichnung ~Z. 3900–5100), Schneegrenze mit weicher Kante + Felsdurchbrüchen.

**G6 · Weißer Halo-Saum am Burgfuß — „−0,25"**
Beobachtung: Um die Basis des Hauptquartiers läuft ein heller Randstreifen, der das Sprite wie ausgeschnitten-aufgeklebt wirken lässt, besonders bei z2,2 (kritik_g05_hq_z22.png, links und rechts der Mauer; auch kritik_g17_strasse_z16.png).
Abhilfe: `assets/bld_hq.png` am unteren Rand prüfen (eingebackener heller Sockel/Matte-Kante); entweder Asset beschneiden oder in `drawBld` einen Boden-Blendverlauf unter das Gebäude legen.

**G7 · Vereinzelte harte Horizontal-Nähte im Gras — „−0,25"**
Beobachtung: v154 hat die Zellgrenzen weitgehend beseitigt, aber es bleiben einzelne durchgehende Linien: in kritik_g08_wiese_z22.png verläuft bei y≈1218 eine messbar harte Naht (Zeilenhelligkeits-Sprung 9σ über Rauschniveau), ähnlich in kritik_g17_strasse_z16.png.
Abhilfe: Beim Chunk-Bake 1 px Überlappung + clamp-to-edge sampeln (render.js Chunk-Zeichnung), damit Chunk-Ränder nicht auf Subpixel-Grenzen fallen.

**G8 · Geologen-Schilderwald: ∅-Schilder spammen das Gebirge zu — „−0,15"**
Beobachtung: Nach 30 Minuten stehen >10 „kein Vorkommen"-Schilder dicht gestreut auf dem KI-Berg — visuelles Rauschen ohne Informationswert (kritik_p_s11_ki_30min.png).
Abhilfe: `sign_none` nach 2–3 Spielminuten ausblenden (sim.js signs-Verwaltung) oder je 3×3-Raster nur ein Schild behalten.

**G9 · Baustufe 0 ist ein nacktes weißes Rechteck — „−0,15"**
Beobachtung: Frisch begonnene Bauplätze erscheinen als dünner weißer Rechteckrahmen, was wie ein Debug-Overlay liest (kritik_g16_baustelle_z22.png oben Mitte, kritik_p_s11_ki_30min.png rechts).
Abhilfe: Absteck-Sprite (4 Holzpfähle + Schnur, angelehnt an `bld_build_*_0.png`) statt Rahmenlinie zeichnen.

**G10 · Spielerfarben-Binde der Grenzpfosten in Spielzoom unlesbar — „−0,1"**
Beobachtung: Die Binde ist da und nah betrachtet sauber (kritik_u10_pfosten_nah.png), aber bei z ≤ 1 sind es 2–3 px — die Grenze liest sich als Reihe weißer Störpunkte, Besitzer unklar (kritik_g04_hq_z1.png links, kritik_g06_hq_z06.png).
Abhilfe: In `postTinted` (render.js Z. 11106 ff.) Bandhöhe von 15 % auf ~28 % erhöhen und Sättigung anheben; optional zweiter schmaler Ring.

**G11 · Titelbildschirm ohne Schauwert — „−0,1"**
Beobachtung: Solide Holztafel, aber der Hintergrund ist ein dunkel vermatschter Screenshot; kein Wappen/Key-Art, Knöpfe reine Textzeilen (kritik_g01_titel.png). Für den ersten Eindruck eines 10/10-Spiels zu karg.
Abhilfe: Gemaltes Titelbild (Stil der Story-Tafeln, vgl. assets/story_1.jpg) als Hintergrund, Menüknöpfe mit kleinen Symbolen.

### Nachprüfung der bekannten Nutzerliste
- **Fahnen-Tiefensortierung:** behoben — Sortierung am gezeichneten Fuß (`render.js` Z. 8502–8511), Stichproben unauffällig.
- **Begrenzungspfosten ohne Binde:** behoben (`postTinted`, Z. 11106 ff.), Binde sichtbar (kritik_u10) — Rest siehe G10 (Lesbarkeit in Spielzoom).
- **Pfosten im Gebirge uneinheitlich:** behoben — ein Pfosten für alle Böden, Fels-Variante stillgelegt (`drawBorderPost`, Z. 11367 ff.). Scheinbar „verschieden helle" Reihen in kritik_g11 sind die Kachel-Unschärfe aus G2, kein zweites Sprite.
- **Sägewerk-Sägeblatt ohne Drehung:** behoben — Blatt rotiert im Betrieb (`drawBld`, Z. 9445 ff., `ang=time/420`), steht nur bei ruhendem Werk (gewollt).
- **Burgfahne im Eingang:** weitgehend behoben (`flagVisualPos` rückt 72 % zum Wegknoten, Z. 10024 ff.); bei z ≥ 2 überlappt das Tuch noch die Torbogen-Silhouette (kritik_g05_hq_z22.png) — Schönheitsrest, ~−0,05.
- **Wegfahnen ohne Weh-Animation:** behoben — Streifen-Sinus-Wehen (Z. 10051 ff.).
- **Fahnen-Klickpunkt zu tief:** behoben — Treffkasten über das ganze Bild inkl. Felsanhebung und Zoom-Mindestrand (`ui.js` Z. 536–563).

---

## Sound: **4/10**

**Was trägt:** Die Architektur in `js/sound.js` ist sauber: zentrale `sfx()`-Fabrik, Entfernungsdämpfung an fast allen Weltereignissen (linear bis 750–900 Weltpixel, `ui.js` Z. 439–493), defensives Clamping, Musik-Ducking über getrennte Gain-Busse, und die generative Musik hat mit drei 8-Takt-Varianten samt weichem Übergang echte Sorgfalt. Ereignisabdeckung ist breit: Hacken/Picken/Graben/Sägen/Angeln, Bau-Hammer, Fertigstellungs-Dreiklang, Rekrutierung, Kampf (Klirren, Grunzen, Pfeilsalve, Katapult, Feuer), Geologen-Jauchzer, Tier-Laute (Schaf, Schwein, Vogel), Sieg/Niederlage, UI-Taps.

### Befunde (absteigend nach Punktkosten)

**S1 · Alles ist Oszillator-Piepen — kein einziges Sample — „−2,5"**
Beobachtung: Jeder Klang ist synthetisch aus Sinus/Sägezahn/Rauschband gebaut (`sound.js` Z. 49–144). Ein Hammer ist ein 50-ms-Rauschstoß, das Schwertklirren ein Bandpass-Zischen. Was Siedler II akustisch ausmachte — das satte „Tock" der Axt, das rhythmische Sägen, echtes Hämmern am Rohbau — fehlt als Klangkörper komplett; das Spiel klingt nach Chiptune-Skizze, nicht nach Werkstatt.
Abhilfe: Kleines OGG/WebM-Sample-Set (~15 Dateien, je 20–50 kB: Axt, Säge, 2× Hammer, Spitzhacke, Schaufel, Platschen, Glocke, Fanfare, Marschtritte, Schaf/Schwein/Vogel, Kampf-Klirren) über `AudioBufferSourceNode` mit ±5 % Pitch-Streuung; Synthese als Fallback behalten.

**S2 · Keine Umgebungsgeräusche, keine Arbeits-Loops — „−1,0"**
Beobachtung: Es gibt keine Klangteppiche: kein Wind auf der Wiese, kein Wellenrauschen an der Küste, kein Vogel-Bett im Wald, nichts Biom-Spezifisches (Wüste/Winter/Sumpf stumm identisch); Tag/Nacht existiert ohnehin nicht. Laufende Betriebe (Sägewerk, Schmelze, Mühle) haben keinen Dauerklang, nur der Einzel-Event `onWorkerAct` tickt. Chapel-Glocke und Markttreiben erklingen ausschließlich beim Öffnen des Gebäude-Blatts (`ui.js` Z. 952 f.) — die Welt selbst schweigt.
Abhilfe: Pro Biom ein 10-s-Ambience-Loop (leise, kamerapositionsabhängig gemischt); je Gebäudetyp mit `working=true` in Kameranähe einen gedämpften Loop starten/stoppen (Anbindung an die vorhandene FX-Tabelle `render.js` Z. 201 ff.).

**S3 · Musikstil passt nicht zum Spiel — „−1,0"**
Beobachtung: Der Soundtrack ist ausdrücklich „moderner Chill-Soundtrack" (Kommentar `sound.js` Z. 147): 84-BPM-LoFi mit Hi-Hats, Shaker und Side-Kick. Handwerklich nett, aber zur mittelalterlichen Siedlerwelt passt es wie Fahrstuhlmusik zur Schmiede; Siedler II lebte von folkloristischen Themen. Drei Varianten derselben A-Moll-Stimmung ermüden zudem über Stunden.
Abhilfe: Instrumentierung Richtung Flöte/Laute/Streicher-Pizzicato drehen (gleiches generatives Gerüst, andere Klangerzeuger: Karplus-Strong-Zupfsynthese statt LoFi-Beat, Hi-Hats raus), zweite Tonart/Dur-Variante für Aufbauphasen, Kampf-Stinger bei `onBattleStart`.

**S4 · Kein Stereo-Panorama — „−0,5"**
Beobachtung: Kein einziger `StereoPannerNode`/`PannerNode` im Code — ein Kampf links außen klingt exakt wie einer in Bildmitte; auf dem Handy (quer, Stereo) verschenkt das Ortung und Tiefe.
Abhilfe: In `sfx()` optionalen Pan-Parameter (−1…1 aus `(x−cam.x)*cam.z/width`) durch einen `StereoPannerNode` vor `sfxGain` routen; Aufrufer in `ui.js` reichen die Weltposition ohnehin schon fast überall herein.

**S5 · Marsch/Träger stumm; Erfolgsmomente zu dünn — „−0,5"**
Beobachtung: Soldaten marschieren lautlos zum Angriff, Träger tappen lautlos über die Straßen (Siedler II: hörbare Schritte, Ächzen). Der Sieg ist ein 4-Ton-Arpeggio (Z. 142), die Eroberung nur das Standard-`done` — für die dramatischsten Momente des Spiels zu wenig.
Abhilfe: Schritt-Loop für Angriffsgruppen in Kameranähe (an `ATK_MARCH`-Bewegung koppeln), echte Fanfare (Sample) für `win`/`onCapture`, Trommel-Stinger für `war`.

**S6 · Nur An/Aus, keine Lautstärkeregler — „−0,5"**
Beobachtung: Optionen bieten zwei Checkboxen (`ui.js` Z. 145 f.); Musik- zu Effektbalance ist fest verdrahtet (0,34/0,8). Auf Handylautsprechern will man Musik oft leiser als Effekte.
Abhilfe: Zwei Schieberegler in den Optionen, die `Sound.musicGain.gain`/`sfxGain.gain` setzen und in `opts` persistieren.

---

## Spielspaß: **6/10**

**Was trägt:** Der Wirtschaftskern ist echt „Siedler": 28 Waren, Werkzeug- und Nahrungsketten, Sättigungsbremse mit Hysterese, Träger auf Wegen, Planierer/Bauarbeiter-Choreografie — und er funktioniert: Testbau Holzfäller + Straße lief fehlerfrei durch („Holzfäller fertiggestellt", Stämme liefen ins Lager; die Stillstands-Fixes v149–v152 halten). Die KI baut glaubwürdig und flott (Saat 11: 13→39 fertige Gebäude in 30 min; Saat 23: 16→48; stets ≤8 Baustellen dank v147), ihr Dorf ist eine Schau (kritik_p_s23_ki_20min.png). Statistik mit Verlaufskurven, anheftbare HUD-Waren, Speichern/Laden, 3 Schwierigkeitsgrade + Startwaren-Optionen: viel richtig. Die Kampagne (js/levels.js) ist dramaturgisch ordentlich gebaut: 10 Missionen über 7 Biome, Zieltypen wechseln sauber (bauen → Güter → Soldaten/Vernichten → Erobern → Überleben → Territorium → Okkupieren), Stufen steigen 0→1→2→3 Gegner, Story-Tafeln mit eigenem Artwork und pointierten Texten (kritik_u02_story.png), Epilog vorhanden. Mission-1-Ziel „50 Bretter" erzwingt seit R9 wirklich die Kette.

### Befunde (absteigend nach Punktkosten)

**F1 · Es kommt kein Druck vom Gegner — auf M-Karten Friedhofsruhe — „−1,5"**
Beobachtung: In 60 Spielminuten (Saat 11, Stufe 2, Normal) griff die KI **kein einziges Mal** an (`aiState.lastAttack` blieb 0), obwohl sie 72 Garnisonssoldaten gegen 9 Spieler-Rekruten und 3 100 gegen 397 Felder Land hielt. Grund: Angriffe brauchen `attackable ≥ 2`, also KI-Militärposten in Radius-Reichweite eines Spieler-Ziels — die KI-Grenze kroch aber nur von Distanz 76 auf 19 Knoten ans Spieler-HQ heran und kam nie in Reichweite. Auch Saat 23: 0 Angriffe, 0 sichtbare Soldaten in 30 min. Für einen Siedler-II-Spieler heißt das: kein Wettlauf, keine Verteidigung, keine Dramaturgie — die halbe Spielspannung fehlt. (Belege: Messreihe im Bericht-Anhang unten; kritik_p_s11_spieler_30min.png zeigt das unberührte Spieler-HQ nach 30 min.)
Abhilfe: In `sim.js aiStep`/`aiFindSpot` Expansion RICHTUNG nächstem Feind gewichten (Zielfunktion: Abstand zum Feind-HQ negativ einpreisen), und ab z. B. Minute 20 „Vorstoß-Posten": erlaubt einen Wachturm außerhalb des Komfortradius auf den Spieler zu. Zusätzlich Meldung + Kamera-Sprungziel „Der Feind steht an deiner Grenze", sobald `dGrenze` < 12.

**F2 · Missionsziele verschwinden — teils erscheinen sie gar nicht — „−0,5"**
Beobachtung: Das Ziel-Overlay wird beim Start nur 4 s eingeblendet (`ui.js` Z. 431) und ist danach ausschließlich über Menü → Missionsziele erreichbar; in mehreren Messläufen erschien es überhaupt nicht (Polling über 5,6 s: durchgehend `hidden`; Screenshots kritik_u03_mission1_start.png und kritik_u09_ziele_overlay.png zeigen den Missionsstart ohne jedes Ziel), in anderen Läufen korrekt — ein Race. Gerade Mission 1 mit „50 Bretter" braucht permanent sichtbaren Fortschritt.
Abhilfe: Race in `launch()`/`toggleObjectives` fixen und statt Autohide einen kompakten, antippbaren Ziel-Chip dauerhaft oben links zeigen („🎯 2/4 · Bretter 31/50"), der das Overlay öffnet.

**F3 · Ereignis-Ödnis: eine Meldung, sechsmal wiederholt — „−0,5"**
Beobachtung: In 30 Minuten kam **genau eine** Meldungsart, im 5-Minuten-Takt identisch: „Waffen liegen bereit, aber es fehlt das Bier …" (beide Saaten, je 6×). Kein Grenzkontakt, kein „Gegner expandiert", keine Erschöpfungs- oder Fortschrittsmeldung erreichte den Spieler; gleichzeitig nervt die Bier-Warnung Anfänger, die noch gar keine Brauerei bauen KÖNNEN, ohne zu sagen, was zu tun ist.
Abhilfe: Bier-Warnung nur einmal, mit Handlungshinweis („Baue Bauernhof → Brauerei") und Antipp-Sprung zur Brauerei-Kategorie; neue Meldungsklassen: Feind-Grenzkontakt, erster Soldat des Gegners gesichtet, eigene Ressource erschöpft sich (v143-Vorwarnung kam im Test nie), Meilensteine („10 Gebäude fertig").

**F4 · Freies Spiel wirft Neulinge ins kalte Wasser — „−0,5"**
Beobachtung: Im freien Spiel gibt es keinerlei Einstieg: keine Tipps, keine Aufgabenleiste, der Bildschirm zeigt Burg + Wiese (kritik_g03_start_onboarding.png), und ohne Vorwissen ist „Tippe auf einen freien Punkt" nicht zu erraten. Die guten Tipp-Texte existieren nur auf den Kampagnen-Story-Tafeln. Die ersten 5 Minuten fühlen sich stumm an (erst nach ~4 min die erste — falsche — Bier-Warnung).
Abhilfe: Beim ersten freien Spiel eine 3-Schritte-Toastfolge („Tippe ins eigene Gebiet → wähle Holzfäller → verbinde mit Straße"), gespeist aus den vorhandenen `tips`-Texten; Option „Hinweise" in den Einstellungen.

**F5 · Kampagne: Ziele statisch, nichts passiert unterwegs — „−0,5"**
Beobachtung: Alle Missionsziele stehen ab Sekunde 1 fest; es gibt keine Zwischenereignisse, keine Verstärkungswellen, keine freigeschalteten Zusatzziele, keine Dialogzeile nach Missionsmitte (levels.js definiert nur Startzustand). Die gute Story bleibt dadurch Kulisse; „Halte 25/30 Minuten" (M5/M6) droht ohne KI-Druck (siehe F1) zur Wartezeit zu werden.
Abhilfe: Pro Mission 1–2 geskriptete Auslöser in `sim.js checkObjectives` (Zeit-/Fortschritts-Trigger): M3 z. B. „Nach 10 min: Aschehand-Überfall auf deinen Grenzturm" + Story-Toast; M5: Sandsturm-Warnung mit kurzem Produktionsmalus.

**F6 · Bauplätze zeigen ihre Größe nicht — „−0,25"**
Beobachtung: Im Bau-Modus sind alle freien Knoten identische weiße Punkte (kritik_u04_baumenu.png); ob dort Hütte, großes Gebäude oder gar nichts passt, erfährt man erst nach Wahl des Gebäudes per Fehlversuch („Hier nicht möglich"-Toast). Siedler II zeigte die Baugrößen-Symbole direkt auf der Karte.
Abhilfe: Punktfarbe/-form nach maximal möglicher Baugröße differenzieren (klein/mittel/groß/Mine/Fahne) — die Information liefert `canBuild` bereits; Zeichnung in `render.js` (showBuildDots).

**F7 · Freies Spiel kennt nur „Vernichte alle" — „−0,25"**
Beobachtung: Einziges Ziel im freien Spiel ist `destroyEnemies` (`ui.js` Z. 402); keine Siegpunkte-, Territorium-, Wirtschaftsziele, kein friedliches Spiel mit Endauswertung — auf Dauer wenig Wiederspielreiz jenseits der Kampagne.
Abhilfe: Zielauswahl im Setup (Vernichtung / 60 % Land / 100 Münzen / Zeitrennen), Typen existieren in `checkObjectives` bereits (`territory`, `good`, `survive`) und müssen nur ins Setup-Formular.

**Randnotiz (keine Punktkosten):** Die Sim ist flott (0,5–0,8 ms/Takt gemessen) — Spielgeschwindigkeit 1×/2× und die Meldungsbremse aus v143 funktionieren; „KI mauert sich ein"/Dauerbaustellen aus früheren Berichten traten in 2×30 + 60 Minuten nicht mehr auf.

**Messanhang (Saat 11, Stufe 2, Normal):** KI-Garnison 6→72 Soldaten (min 5→60), Gebiet 661→3 102 Felder, Grenzabstand zum Spieler-HQ 76→19 Knoten, Angriffe: 0. Meldungen an Spieler: 6 (alle identisch). Saat 23 analog (48 fertige KI-Gebäude nach 30 min, 0 Angriffe).

---

## Weg zur 10 — die fünf Maßnahmen mit dem größten Hebel

1. **Gegnerdruck-Kurve bauen (Spielspaß +1,5, strahlt auf alles aus):** KI-Expansion auf den Spieler zu gewichten, ab Minute ~20 Vorstoß-Posten Richtung Spieler, Angriffe spätestens bei Grenzkontakt; begleitend Warnmeldung + Kamera-Sprung „Feind an der Grenze". (`sim.js aiFindSpot`/`aiStep`)
2. **Sample-Soundpaket + Panorama (Sound +3):** ~15 kurze OGG-Samples für Werk-, Kampf- und Tiergeräusche mit Pitch-Streuung, StereoPanner nach Bildposition, Ambience-Loop je Biom, Arbeits-Loops für Sägewerk/Schmelze/Mühle; Musikinstrumentierung Richtung Mittelalter-Folk drehen. (`js/sound.js`, Hooks in `ui.js` vorhanden)
3. **Terrain-Nahstufe + Kachel-Nachschärfen (Grafik +1,5):** höher aufgelöste Boden-Bakes für z > 1,5, Chunk-Bake nach Sichtbarkeit priorisieren (kein Pixel-Streifen mehr nach Schwenks), Waldboden-Flecken und Schaum entschärfen (Höhenprüfung, weiche Ränder). (`js/render.js`)
4. **Ziele permanent sichtbar + lebendiges Meldungswesen (Spielspaß +1):** Ziel-Chip mit Live-Fortschritt statt 4-s-Overlay (Race fixen), Meldungsklassen für Grenzkontakt/Erschöpfung/Meilensteine, Bier-Warnung mit Handlungslink statt Wiederholung. (`ui.js`, `sim.js msg`)
5. **Bauplatz-Größenvorschau nach Siedler-Art (Spielspaß +0,25, Grafik-Feinschliff gleich mit):** Baupunkte nach Größenklasse differenzieren; im selben Zug Baustufe-0-Rechteck durch Absteck-Sprite und ∅-Schilder-Verfall ersetzen. (`render.js`, `sim.js`)

*Alle Screenshots: `/home/user/Die-Siedler/kritik_*.png` — unversioniert, nichts am Spielcode verändert.*
