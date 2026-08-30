# Stylized Diorama Render — verbindlicher Hausstil

Gilt für **alle** Assets: Gelände, Gebäude, Figuren, Ressourcen-Icons,
Deko, Bedienoberfläche, und für alle sieben Landschaftsthemen
(`gruen`, `inseln`, `winter`, `wueste`, `vulkan`, `sumpf`, `gebirge`).

Dieses Kapitel steht **über** den bisherigen Kapiteln. Wo ein älteres
Kapitel etwas anderes sagt, gilt dieses hier. Referenzbild:
Diorama-Insel im Abendlicht auf rundem Holzsockel.

---

## 1. Kartenform — Spielelement, nicht Deko

Jede Karte ist eine **runde bzw. ovale Inselplatte** mit umlaufendem
Holzrand aus einzelnen senkrechten Bohlen, fassartig gesetzt, warmes Braun
mit sichtbarer Holzmaserung. Die Platte hat eine sichtbare Materialstärke.
Die Insel steht frei auf einer neutralen, warmgrauen Fläche mit weichem
Kontaktschatten. Kein Horizont, keine Skybox, keine Wolken. Das gilt für
alle sieben Themen — gleiche Plattenform, nur der Inhalt wechselt.

**Das ist kein Rahmen um das Bild, sondern die Form der Karte.** Drei
Stellen im Code müssen dieselbe Ellipse kennen, sonst fällt es
auseinander:

| Ort | Was dort steht |
|---|---|
| `js/map.js`, `edge()` | Inselmaske: der Höhenabfall zum Rand läuft radial in normierten Gitterkoordinaten, nicht mehr im Rechteckrahmen. Außerhalb der Ellipse liegt kein Land. |
| `js/terrain-gl.js`, Fragment-Shader | Plattenschnitt: `dot(pr,pr) > 1.0 → discard`, gerechnet in **Gitter**-, nicht Weltkoordinaten — sonst wanderte der Schnitt mit der Geländehöhe. |
| `js/terrain-gl.js`, `sockelNeu()` | Zarge, Deckring und Kontaktschatten als Ellipsenringe. |
| `js/render.js`, `aufPlatte()` | Wasserleben, Glanzlichter und Fische hören am Plattenrand auf. |

Maße: Halbachsen `(w-1)/2·TILE` und `(h-1)/2·ROWH`, Mitte um eine
Viertelkachel versetzt (der halbe Zeilenversatz ungerader Reihen).
Materialstärke 110 Weltpixel, Holzlippe oben 22 Weltpixel **konstant** —
nicht als Bruchteil der Halbachsen, sonst ist der Rand an den Flanken
anderthalbmal so breit wie oben. 160 Dauben rundherum, jede aus zwei
Vierecken, damit die Mitte hell und beide Kanten dunkel sind: eine lineare
Rampe über ein einziges Viereck gibt eine Schräge, keine Wölbung.

## 2. Formensprache

Weiche, abgerundete Low-Poly-Silhouetten mit hochwertigem Shading.
**Keine harten Kanten, keine flachen Farbflächen.**

| Element | Regel |
|---|---|
| Felsen | glatte, gerundete Kieselformen in gestaffelten Größen, vom faustgroßen Stein bis zum Felsblock; nie kantig, nie kristallin |
| Berge | gerundete, gestapelte Gesteinsformen mit hellen Beige-Spitzen |
| Bäume | dicker Stamm, Laub aus mehreren überlappenden Kugeln, gelbgrün mit dunkelgrüner Schattierung und feiner Punkt-Struktur |
| Gras | sattes Gelbgrün mit winzigen hellen Blüten-Sprenkeln und feinem Rauschen |
| Gebäude | dieselben gerundeten Kanten, dieselben matten Materialien, dieselbe Palette wie die Landschaft |
| Gebäude | dieselbe Rundung: gebrochene Kanten, keine scharfen Ecken, Dachflächen leicht gewölbt |
| Figuren | knetartige Rundung, keine harten Falten, Silhouette vor Detail |
| Icons | dieselbe Beleuchtung wie im Spiel (Sonne oben links), kein Outline-Stil |

Was das ausschließt: Facettenlook mit sichtbaren Dreieckskanten,
Cel-Shading mit harten Tonwertstufen, Umrisslinien, flache Vektorflächen.

## 3. Farbpalette

Warm und leicht entsättigt.

| Rolle | Werte |
|---|---|
| Gras | `#8FBF3F` bis `#6E9B2E` |
| Fels | `#9A9A96`, Spitzen ins warme Beige |
| Sand | `#E4C98F` |
| Holzrand | `#A9703F` |

## 4. Wasser

Tiefenabhängiger Farbverlauf: Türkis `#3FC9D6` im Flachwasser →
Tiefblau `#1E6FA8`. Im Flachwasser ist der Sandgrund durchscheinend
sichtbar, mit einzelnen Steinen darin. Weiße Schaumkante entlang der
gesamten Uferlinie. Feine, ruhige Wellen über Normalmap, keine harte
Sonnenspiegelung.

**Am Plattenrand gilt das nicht.** Dort endet die Karte, dort ist kein
Ufer. Die Materialgewichte laufen an der Feldgrenze aus; ohne Gegenmaßnahme
liest der Shader das als Flachwasser und malt einen Schaumsaum rings um die
Platte (Beleg `p_r2`). Der Randabfall `randAus` schaltet Schelf, Nasssaum
und Schaumlinie in den letzten Prozent vor der Ellipse ab.

## 5. Licht

**EINE** warme, tiefstehende Sonne von links oben, Goldene-Stunde-Charakter.
Sehr weiche Schatten. Kräftige Ambient Occlusion in allen Vertiefungen.
Keine harten Glanzlichter, alle Materialien matt.

Kein zweites gerichtetes Licht. Die Aufhellung kommt aus Hemisphäre und
Rundum-Licht — die Form auf der Schattenseite trägt die Verdeckung (AO),
nicht ein zweiter Scheinwerfer. Das ist der Unterschied zwischen
„Diorama" und „Bühne".

## 6. Hintergrund

Neutraler warmgrauer Verlauf, leer. Keine Wolken, keine Skybox mit
Landschaft.

## 7. Render-Settings — der eigentliche Hebel

Diese Zahlen sind verbindlich. Sie stehen in three.js-Einheiten, weil die
Sprite-Bäckerei damit rechnet.

```
Renderer     ACESFilmicToneMapping, toneMappingExposure 1.05, sRGB-Output
Sonne        DirectionalLight #FFE2B8, Intensität 2.5, Höhenwinkel 35°,
             aus Richtung oben-links
Schatten     PCFSoftShadowMap, Shadow Map 4096, normalBias 0.02
Fill         HemisphereLight, Himmel #CFE2FF / Boden #8A7A5C, Intensität 0.6
Environment  neutrale Environment-Map, Intensität 0.3
Material     Standard-PBR, roughness 0.85–0.95, metalness 0,
             keine Clearcoat-/Glanz-Effekte außer Wasser
Post         SSAO/GTAO mit kleinem Radius, spürbar stark
             Bloom schwach: Threshold hoch, Intensität ~0.15
             Vignette 0.2
             Warme Farbkorrektur: Schatten leicht ins Blaue, Lichter ins Warme
             Tiefenschärfe: leichter Tilt-Shift, Fokus auf der Bildmitte,
             Unschärfe nur zu den Bildrändern, Stärke einstellbar
             (Startwert schwach)
Kamera       bleibt wie bisher (Siedler-2-Projektion), nur Licht, Material
             und Post-Processing ändern sich
```

### 7.1 Wo diese Zahlen im Projekt wirklich stehen

Das Spiel benutzt three.js **nur zum Backen** der Sprites. Im Spiel selbst
läuft ein eigener WebGL1-Shader für den Boden und eine 2D-Leinwand für
alles darüber. Die Zahlen oben leben deshalb an drei Orten, und wer den
Stil ändert, muss alle drei anfassen:

**`tools/bake-sprites.html` — Sprite-Bäckerei (Figuren aus GLB).**
Hier stehen die Zahlen 1:1, weil hier three.js rechnet. Sonne, Hemisphäre,
Environment-Map, Tonemapping, Schattenkarte, Materialnormalisierung.

**`js/terrain-gl.js` — Bodenebene im Spiel.**
Eigener Shader, keine three.js-Einheiten. Übernommen werden die **Farben**
und die **Verhältnisse**; die Gesamthelligkeit stellt `LICHT_SKALA`. Sie
ist kalibriert, nicht geraten: gemessen soll die mittlere Bildhelligkeit
gegenüber der Vorfassung stehenbleiben, damit die Umstellung als
Lichtwechsel liest und nicht als Belichtungssprung.

| Guide | Shader |
|---|---|
| Sonne #FFE2B8 @2.5 | `C_SONNE * I_SONNE` |
| Höhenwinkel 35° | `C_KEYDIR.z = sin(35°) = 0.574` |
| Hemisphäre #CFE2FF/#8A7A5C @0.6 | `mix(C_GRUND, C_HIMMEL, up) * I_HEMI` |
| Environment 0.3 | `+ vec3(I_ENV)` |
| Exposure 1.05 | `col *= 1.05` vor ACES |
| roughness 0.85–0.95 | Materialtabelle `rough`, Wasser bleibt bei 0.14 |
| AO spürbar stark | `clamp(1.0 - (hB-hRel)*3.6, 0.40, 1.0)` |
| Farbkorrektur | Split-Toning über die Luminanz nach ACES |
| Sandgrund im Flachwasser | `grundSteine()` plus das Sichtfenster in `wasser()` |
| Blüten im Gras | `blueten()`, aufgetragen NACH der Materialmischung |
| Beige Bergspitzen | `spitze` = Höhe × Aufwärtsneigung, auf `fels` gemischt |

**Drei Fallen, die beim Einbau dieser drei Punkte aufgefallen sind** — sie
gelten für jede weitere Feinzeichnung im Shader:

1. **Nicht auf ein Material auftragen, sondern auf das Ergebnis.** Die
   Blüten hingen zuerst an `mWiese`. Das steckt über `berggras` und die
   Uferblenden aber auch in Flächen, die gar keine Wiese sind — es lag
   weißes Konfetti auf Wasser und Sand. Jetzt werden sie nach der
   Materialmischung mit dem Grasanteil gewichtet.
2. **Warm plus kühl ergibt grau.** Der Sandgrund einfach in die
   Wasserfarbe gemischt gab ein fahles Grau-Beige, das Türkis war weg —
   dieselbe Falle wie beim Füll-Licht. Wasser schluckt Rot und lässt Grün
   und Blau durch; der Grund wird deshalb *eingefärbt*, nicht
   übergelegt.
3. **Erst messen, ob es überhaupt gezeichnet wird.** Die Grundsteine waren
   unsichtbar. Ein Rot-Test hat sie überführt: 281 rote Bildpunkte von
   139500 — sie wurden gezeichnet, trafen den Schelf nur fast nie, weil
   die Tiefenrampe den sichtbaren Bereich auf rund 20 Weltpixel presst.
   Die Sicht hängt jetzt am Wasseranteil statt an der Tiefenrampe.

**`js/render.js` — Bildschirmebene.**
Vignette, Überstrahl und Tilt-Shift. Beide müssen wissen, dass die 2D-Leinwand über
dem GL-Boden **durchsichtig** ist: eine Vollbild-Mischung (`soft-light`,
`lighten`) schreibt dort die Quellfarbe statt zu tönen. Deshalb sitzt die
Farbkorrektur im Shader und nicht hier; die Vignette ist ein schlichter
`source-over`-Verlauf, und der Überstrahl bekommt seine Deckkraft aus der
Luminanz je Bildpunkt.

### 7.2 Was bewusst nicht umgesetzt ist

**SSAO/GTAO als Post-Pass.** Der Boden hat eine echte, aus dem Höhenfeld
gerechnete Verdeckung (`ao` im Shader) — die ist billiger und genauer als
ein Bildschirmraum-Verfahren. Objekte darüber bekommen ihre Verdeckung
beim Backen mit. Ein echter SSAO-Pass über beide Ebenen bräuchte die
gemeinsame Tiefe, und die gibt es nicht: Boden und Objekte liegen auf
zwei verschiedenen Leinwänden.

**Bloom — eingebaut, aber Vorgabe AUS.** Der Pass existiert
(`renderer.bloomAus=false` schaltet ihn zu) und hält sich an die Zahlen des
Guides: Schwellwert 0.78, Intensität 0.15, Deckkraft aus der Luminanz je
Bildpunkt. Er muss dafür die Hauptleinwand zurücklesen, und genau das ist
das Problem: gemessen kippt Chromium eine Leinwand, die jedes Bild
zurückgelesen wird, aus der Beschleunigung in den Software-Pfad. Unter
swiftshader wurde das Bild dadurch *schneller* (22,8 / 23,3 ms mit gegen
137,9 / 139,9 ms ohne, in beiden Reihenfolgen gemessen) — auf einem Gerät
mit echter Grafikeinheit wirkt derselbe Mechanismus andersherum. Solange
das nicht auf einem echten Telefon nachgemessen ist, bleibt er aus.
Der richtige Ort ist ein GL-Nachbearbeitungsschritt auf einem
Zwischenpuffer des Geländes: kein Zurücklesen, und derselbe Umbau würde
GTAO und Tiefenunschärfe erst möglich machen.

**Tiefenunschärfe.** Ausdrücklich ausgeschlossen — das Spiel muss über die
ganze Karte lesbar bleiben.

## 8. Einschränkungen

Zwei Punkte haben sich gegenüber der ersten Fassung dieses Guides
**umgedreht**. Beides steht hier, damit niemand die alte Regel aus einem
Kommentar wieder aufgreift:

- **Der Holzrand ist jetzt Spielelement**, nicht Präsentationsrahmen. Die
  Karte selbst ist die Platte (Abschnitt 1). Vorher stand hier: „nur für
  Menü-Hintergründe, Icons und Store-Screenshots".
- **Tiefenunschärfe ist jetzt erwünscht**: leichter Tilt-Shift, Fokus in
  der Bildmitte, Unschärfe nur zu den Rändern. Vorher stand hier: „im Spiel
  bleibt alles durchgehend scharf". Die Stärke ist einstellbar
  (`renderer.tiltStaerke`, Anteil der kürzeren Bildkante je Rand, 0 = aus)
  und liegt in den Einstellungen als Schieberegler. Startwert 5 %.
  Zum Vergleich: bis v247 stand hier 14 %, damit lagen im Hochformat oben
  und unten je rund 135 px im Weichzeichner und die Massive am oberen
  Bildrand verschwammen zu hellem Nebel. 5 % ist bewusst schwach.

## 9. Themen

Alle sieben Themen benutzen dieselbe Formensprache, dasselbe Licht und
dieselben Render-Settings. Sie unterscheiden sich **nur** in der Palette:

| Thema | Grundton | Besonderheit |
|---|---|---|
| `gruen` | Palette aus Abschnitt 2, unverändert | Referenzfall |
| `inseln` | Sand heller `#EED7A2`, Wasser türkiser | breiterer Flachwasserschelf |
| `winter` | Gras zu Firn `#E4E6E2`, Fels kühler | Sonne bleibt warm, Schatten deutlicher ins Blaue |
| `wueste` | Gras zu Sand `#E4C98F`, Fels warm sandig | härtere Kontraste, trotzdem weiche Formen |
| `vulkan` | Fels dunkel `#4A443F`, Lava als einzige Lichtquelle neben der Sonne | Lava glüht, bleibt aber matt |
| `sumpf` | Gras gedämpft `#7A9B46`, Wasser braungrün | mehr Bodennebel, gleiche Sonne |
| `gebirge` | Fels führt, Gras nur in Mulden | Bergwiese am Fuß, Firn ab der Höhengrenze |

Was in **keinem** Thema abweichen darf: Plattenform und Holzrand,
Sonnenrichtung, Höhenwinkel, Tonemapping, Exposure, Materialrauheit,
Vignette, Tilt-Shift.

## 10. Bild-Prompt

Für neue Assets wortgleich verwenden, nur den ersten Satz austauschen:

> **[GEGENSTAND]**, stylized diorama render, soft rounded low-poly
> silhouette, high-quality shading, no hard edges, no flat color areas.
> Warm slightly desaturated palette. Single warm low sun from upper left,
> golden hour, very soft shadows, strong ambient occlusion in every
> crevice, no hard speculars, all materials matte.
> Neutral warm-grey gradient background, empty, no clouds, no landscape
> skybox. Everything in sharp focus — no depth of field.
> Render settings: ACES filmic tone mapping, exposure 1.05, sRGB output.
> Directional light #FFE2B8 intensity 2.5 at 35° elevation from upper
> left, PCF soft shadows, 4096 shadow map, normal bias 0.02.
> Hemisphere fill, sky #CFE2FF, ground #8A7A5C, intensity 0.6, plus a
> neutral environment map at intensity 0.3.
> Standard PBR materials, roughness 0.85–0.95, metalness 0, no clearcoat.
> Post: GTAO with small radius, clearly visible; very weak bloom
> (high threshold, intensity 0.15); slight vignette 0.2; warm grade with
> shadows pushed slightly blue and highlights pushed warm.
> Post also: slight tilt-shift depth of field, focus on the centre, blur
> only towards the frame edges, subtle.
> Isometric-style camera as in Settlers II, orthographic.
> Palette: grass #8FBF3F to #6E9B2E, rock #9A9A96 with warm beige
> highlights, sand #E4C98F, wooden rim #A9703F, water turquoise #3FC9D6 to
> deep blue #1E6FA8 with the sandy bottom translucently visible in the
> shallows including a few stones in it, and a white foam line along the
> entire shoreline; fine calm waves via normal map, no hard sun specular.
> PNG with transparent background, **no ground plate baked in, no round
> wooden rim.**

### Für eine ganze Karte (Übersichts- oder Menübild)

Hier gehört der Holzrand ausdrücklich dazu — er ist die Kartenform:

> **[LANDSCHAFT]** as a round/oval island plate, stylized diorama render,
> surrounded by a rim of individual vertical wooden staves set like a
> barrel, warm brown #A9703F with visible wood grain, the plate has visible
> material thickness. The island stands free on a neutral warm-grey surface
> with a soft contact shadow. No horizon, no skybox, no clouds.
> Then everything from the asset prompt above: shapes, palette, light,
> render settings, post.

Der letzte Satz ist wichtig und wird gern übersehen: **kein eingebackener
Bodenteller.** Der Sockel und der Bodenschatten kommen aus dem Spiel. Die
alte Trauerweide (`tree_willow.png`) trug ihren eigenen Teich mit
Seerosen im Blatt — genau deshalb ließ sie sich nicht in die Wiese
setzen, und genau deshalb wird sie nicht mehr gezeichnet.
