# Stylized Diorama Render — verbindlicher Hausstil

Gilt für **alle** Assets: Gelände, Gebäude, Figuren, Ressourcen-Icons,
Deko, Bedienoberfläche, und für alle sieben Landschaftsthemen
(`gruen`, `inseln`, `winter`, `wueste`, `vulkan`, `sumpf`, `gebirge`).

Dieses Kapitel steht **über** den bisherigen Kapiteln. Wo ein älteres
Kapitel etwas anderes sagt, gilt dieses hier. Referenzbild:
Diorama-Insel im Abendlicht auf rundem Holzsockel.

---

## 1. Formensprache

Weiche, abgerundete Low-Poly-Silhouetten mit hochwertigem Shading.
**Keine harten Kanten, keine flachen Farbflächen.**

| Element | Regel |
|---|---|
| Felsen | glatte, gerundete Kieselformen in gestaffelten Größen; nie kantig, nie kristallin |
| Bäume | dicker Stamm, Laub aus mehreren überlappenden Kugeln, gelbgrün mit dunkelgrüner Schattierung und feiner Punkt-Struktur |
| Gras | sattes Gelbgrün mit winzigen hellen Blüten-Sprenkeln |
| Gebäude | dieselbe Rundung: gebrochene Kanten, keine scharfen Ecken, Dachflächen leicht gewölbt |
| Figuren | knetartige Rundung, keine harten Falten, Silhouette vor Detail |
| Icons | dieselbe Beleuchtung wie im Spiel (Sonne oben links), kein Outline-Stil |

Was das ausschließt: Facettenlook mit sichtbaren Dreieckskanten,
Cel-Shading mit harten Tonwertstufen, Umrisslinien, flache Vektorflächen.

## 2. Farbpalette

Warm und leicht entsättigt.

| Rolle | Werte |
|---|---|
| Gras | `#8FBF3F` bis `#6E9B2E` |
| Fels | `#9A9A96`, Spitzen ins warme Beige |
| Sand | `#E4C98F` |
| Wasser flach | `#3FC9D6` |
| Wasser tief | `#1E6FA8` |

Wasser zeigt in der Flachwasserzone den Grund und trägt am Ufer eine
weiße Schaumkante.

## 3. Licht

**EINE** warme, tiefstehende Sonne von links oben, Goldene-Stunde-Charakter.
Sehr weiche Schatten. Kräftige Ambient Occlusion in allen Vertiefungen.
Keine harten Glanzlichter, alle Materialien matt.

Kein zweites gerichtetes Licht. Die Aufhellung kommt aus Hemisphäre und
Rundum-Licht — die Form auf der Schattenseite trägt die Verdeckung (AO),
nicht ein zweiter Scheinwerfer. Das ist der Unterschied zwischen
„Diorama" und „Bühne".

## 4. Hintergrund

Neutraler warmgrauer Verlauf, leer. Keine Wolken, keine Skybox mit
Landschaft.

## 5. Render-Settings — der eigentliche Hebel

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
Kamera       bleibt wie bisher (Siedler-2-Projektion), nur Licht, Material
             und Post-Processing ändern sich
```

### 5.1 Wo diese Zahlen im Projekt wirklich stehen

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

**`js/render.js` — Bildschirmebene.**
Vignette und Überstrahl. Beide müssen wissen, dass die 2D-Leinwand über
dem GL-Boden **durchsichtig** ist: eine Vollbild-Mischung (`soft-light`,
`lighten`) schreibt dort die Quellfarbe statt zu tönen. Deshalb sitzt die
Farbkorrektur im Shader und nicht hier; die Vignette ist ein schlichter
`source-over`-Verlauf, und der Überstrahl bekommt seine Deckkraft aus der
Luminanz je Bildpunkt.

### 5.2 Was bewusst nicht umgesetzt ist

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

## 6. Einschränkungen aus dem Referenzbild

- Die **Tiefenunschärfe** im Bild ist Hero-Shot-Optik. Im Spiel bleibt
  alles durchgehend scharf, sonst wird die Karte unlesbar.
- Der **runde Holzrand** ist ein Präsentationsrahmen, kein Spielelement.
  Nur für Menü-Hintergründe, Icons und Store-Screenshots.

## 7. Themen

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

Was in **keinem** Thema abweichen darf: Sonnenrichtung, Höhenwinkel,
Tonemapping, Exposure, Materialrauheit, Vignette.

## 8. Bild-Prompt

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
> Isometric-style camera as in Settlers II, orthographic.
> Palette: grass #8FBF3F to #6E9B2E, rock #9A9A96 with warm beige
> highlights, sand #E4C98F, water turquoise #3FC9D6 to deep blue #1E6FA8
> with visible bottom in the shallows and a white foam line at the shore.
> PNG with transparent background, no ground plate baked in, no round
> wooden rim.

Der letzte Satz ist wichtig und wird gern übersehen: **kein eingebackener
Bodenteller.** Der Sockel und der Bodenschatten kommen aus dem Spiel. Die
alte Trauerweide (`tree_willow.png`) trug ihren eigenen Teich mit
Seerosen im Blatt — genau deshalb ließ sie sich nicht in die Wiese
setzen, und genau deshalb wird sie nicht mehr gezeichnet.
