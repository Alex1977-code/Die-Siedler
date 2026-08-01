# Grafik-Stilguide: Aufbaustrategiespiel im Siedler-Stil (realistische Qualität)

Dieser Guide beschreibt einen konsistenten, realistischen Grafikstil für ein Aufbaustrategiespiel im Genre von Siedlungs-/Wirtschaftssimulationen (z. B. Die Siedler, Anno, Manor Lords). Er ist so aufgebaut, dass er als Referenz in jeder neuen KI-Session eingefügt werden kann, um über viele Assets hinweg einen einheitlichen Look zu erzeugen.

Die eigentlichen Bild-Prompts sind bewusst auf **Englisch** formuliert, weil aktuelle Bildgenerierungsmodelle (Midjourney, Stable Diffusion, DALL·E, Ideogram etc.) auf englische Prompts deutlich zuverlässiger reagieren als auf deutsche.

## Update nach erstem Test-Ergebnis

Das erste Ergebnis war ein flaches, buntes Mobile-Game-Artwork mit sichtbarer Spiel-UI (Ressourcenleiste, Pause-Button, Geschwindigkeitsregler) – also fast das Gegenteil von "realistisch, painterly". Zwei mögliche Ursachen, je nachdem was die andere Session war:

1. **Bildgenerator (Midjourney/DALL·E/Stable Diffusion o. Ä.):** Der Begriff "Spielgrafik" triggert bei vielen Modellen eine starke Verzerrung Richtung generischer Mobile-Game-Screenshots inkl. erfundener UI-Elemente – selbst mit "photorealistic" im Prompt. Die Prompts unten sind jetzt deutlich härter formuliert, um das zu unterdrücken.
2. **Programmierte/laufende Spielsession (z. B. Claude Code):** Dann kommt die Grafik vermutlich aus einem fertigen Sprite-/Asset-Pack und nicht aus KI-generierten Bildern. In dem Fall ändert ein Text-Prompt allein nichts an der Optik – die Session müsste stattdessen angewiesen werden, für jedes Asset (Gebäude, Figuren, Terrain) tatsächlich Bilder mit den Prompts unten zu generieren und als Sprites einzubinden, statt die Standard-Assets zu verwenden.

Falls du weißt, welcher der beiden Fälle zutrifft, sag kurz Bescheid – dann kann ich gezielter nachschärfen.

**Update:** Der Screenshot stammt real aus der laufenden Session – das UI (Pause-Button, Geschwindigkeitsregler, live Ressourcenwerte) sieht nach einem tatsächlich programmierten, funktionierenden Spiel aus, nicht nach einem reinen KI-Bild-Mockup. Das heißt: die Grafik kommt vermutlich aus einem fertigen Sprite-Pack im Code. Ein reiner Beschreibungs-Prompt allein ändert daran nichts – dafür braucht es echte Einzel-Assets, siehe Abschnitt 14 unten.

---

## 1. Art Direction – Grundidee

Kein reiner Photoscan-Realismus, sondern **"painterly realism"**: fotorealistische Materialien und Beleuchtung, aber mit handwerklich-warmer, leicht idealisierter Komposition – der aktuell dominante Trend bei Siedlungs-Aufbauspielen (z. B. Manor Lords, Farthest Frontier). Wirkt glaubwürdig und lebendig statt steril-clean.

## 2. Perspektive & Kamera

- Isometrisch bzw. leicht geneigte Vogelperspektive (ca. 35–45°)
- Tilt-Shift-artige Schärfentiefe für einen Diorama-/Modellbau-Effekt bei Übersichtsaufnahmen
- Weite Establishing Shots für Landschaften, enge Framings für Gebäude- und Charakterdetails

## 3. Licht & Farbpalette

- Warmes, goldenes Tageslicht (goldene Stunde), weiche, lange Schatten
- Volumetrisches Licht/Lichtstrahlen durch Bäume und Morgennebel
- Farbpalette: erdige Brauntöne, Moosgrün, Strohgelb, Ziegelrot, gedecktes Himmelblau
- Jahreszeitliche Variation einplanen – Herbstfarben (Amber, Rost, tiefes Grün) sind aktuell besonders gefragt

## 4. Architektur & Umgebung

- Fachwerkhäuser, Strohdächer, verwittertes Holz, Natursteinsockel
- Handwerklich wirkende, leicht asymmetrische Bauweise statt perfekt symmetrischer CAD-Optik
- Details: Moos auf Dächern, ausgetretene Feldwege, Holzzäune, Brunnen, Marktstände, Stapelholz
- Landschaft: sanfte Hügel, Flüsse, Mühlen, Wälder, Getreidefelder, Nutzgärten

## 5. Charaktere & Einheiten

- Kleine, leicht stilisierte, aber realistisch texturierte Figuren (kein Chibi-/Cartoon-Look)
- Mittelalterlich/frühneuzeitlich anmutende Kleidung aus Leinen, Wolle, Leder
- Individuelle Beschäftigungsanimationen bzw. -posen: Holzfäller, Bauern, Fischer, Schmiede

## 6. Materialien & Texturen (PBR)

- Physically-Based-Rendering: Rauigkeit (Roughness), Normal Maps, Subsurface Scattering bei Haut und Blättern
- Sichtbare Verwitterung: Patina, abgenutzte Kanten, Risse im Holz
- Hohe Texturdichte im Nahbereich, vereinfachte Texturen in der Ferne (LOD-Gefälle)

## 7. Atmosphäre & Wetter

- Dynamisches Wetter als Stimmungsträger: Morgennebel, leichter Regen, erster Schnee im Winter
- Rauch aus Kaminen, Staubpartikel im Gegenlicht, Vogelschwärme für Lebendigkeit

## 8. Aktuelle Trends & Referenzen (Stand 2025/26)

- **Painterly Realism** statt reinem Photorealismus – Vorbilder: Manor Lords, Farthest Frontier
- Global-Illumination-Beleuchtung im Stil von Unreal Engine 5 / Lumen: weiche, physikalisch plausible Lichtstimmung
- Zu glatte, sterile 3D-Renderings wirken aktuell veraltet – "handcrafted believability" ist gefragt
- Feine Mikro-Details (einzelne Grashalme, Kieselsteine) ohne sichtbares Pop-in/Popping

## 9. Technische Rendering-Keywords (für Prompts)

`photorealistic, matte painting, AAA game environment concept art, PBR materials, volumetric lighting, ray-traced global illumination, subsurface scattering, 8K textures, cinematic depth of field, Unreal Engine 5 screenshot, ArtStation trending, isometric game art, single environment illustration, no UI, no HUD`

---

## 10. Fertiger Master-Prompt (copy-paste-fertig, v2 – verschärft)

```
Environment concept art, not a screenshot: a richly detailed,
photorealistic isometric matte painting of a medieval European
settler village, AAA game concept art style similar to Manor Lords
and Farthest Frontier, warm golden-hour lighting with soft
volumetric rays filtering through trees, timber-framed houses with
individually visible thatched straw and moss-covered roof shingles,
worn dirt paths with realistic mud and pebble texture, a small
market square with wooden stalls, farmers tending golden wheat
fields, a river winding past a working watermill with realistic
water splashes, smoke rising gently from stone chimneys, autumn
color palette of amber, rust and deep green, hyper-detailed PBR
materials with realistic weathering, individually visible grass
blades and bark texture, subsurface scattering on foliage,
physically accurate shadows and ambient occlusion, cinematic depth
of field with a tilt-shift diorama feel, Unreal Engine 5 render,
ultra-detailed 8K textures, ArtStation trending concept art.
Absolutely no game UI, no HUD, no resource bar, no icons, no
buttons, no health bars, no minimap, no on-screen text or numbers,
no cartoon shading, no flat vector art, no chibi proportions, no
pastel toy-like colors, no oversaturation, no watermark.
```

**Was sich geändert hat:** "Environment concept art, not a screenshot" am Anfang plus die explizite No-UI-Liste am Ende verhindern, dass das Modell eine erfundene Spiel-Oberfläche mit Ressourcenleiste dazu erfindet – das war beim ersten Versuch offenbar das Hauptproblem.

## 11. Varianten-Prompts für einzelne Asset-Typen

**Landschaft / Establishing Shot**
```
Environment concept art, not a game screenshot: wide isometric
establishing shot of a medieval settler valley, rolling hills, a
winding river, patchwork farmland, distant forest, small village
nestled near the water, painterly realistic lighting, golden hour,
volumetric atmosphere, photorealistic PBR textures, Unreal Engine 5
style, ultra-detailed 8K. No UI, no HUD, no icons, no buttons, no
on-screen text or numbers, no cartoon style, no flat vector look,
no watermark
```

**Gebäude (Beispiel: Sägewerk)**
```
Close-up isometric render of a rustic timber sawmill in a medieval
settler village, weathered wood planks, waterwheel turning with
realistic water splashes, stacked logs and sawdust, moss and lichen
on the roof, warm afternoon sunlight, photorealistic PBR textures,
painterly realism style like Manor Lords, cinematic lighting,
ultra-detailed, 8K. No UI, no HUD, no icons, no on-screen text,
no cartoon style, no watermark
```

**Charakter (Beispiel: Bauer)**
```
Photorealistic 3/4-view character render of a medieval farmer
villager, worn linen and wool clothing, leather boots, weathered
sun-tanned skin with subtle subsurface scattering, holding a wooden
hay rake, painterly realistic game art style, soft outdoor lighting,
detailed fabric textures, PBR shading, neutral background,
ultra-detailed 8K, no cartoon style, no anime style, no watermark
```

**Ressourcen-Icon (Beispiel: Holzstapel)**
```
Isolated realistic game icon of a stacked pile of chopped firewood
logs, warm wood grain texture, soft rim lighting, PBR materials,
subtle drop shadow, clean neutral background, ultra-detailed,
consistent with a photorealistic medieval settler-strategy game art
style, 8K icon render, no text, no watermark
```

## 12. Negative Prompt (was vermeiden werden sollte, v2 – erweitert)

`cartoonish, mobile game UI, HUD, resource bar, health bar, minimap, on-screen buttons, on-screen numbers, game screenshot, low-poly, flat shading, toy-like, pastel oversaturated colors, plastic look, chibi proportions, anime style, generic stock asset pack look, blurry, watermark, text, logo, extra limbs, distorted proportions`

## 13. Konsistenz-Tipps für mehrere Sessions/Assets

- Diesen gesamten Stilguide (Abschnitte 1–9) zu Beginn jeder neuen Session als Kontext mitgeben, bevor einzelne Asset-Prompts folgen
- Bei Tools mit Style-Referenz (z. B. Midjourney `--sref`) ein erstes gelungenes Bild als Referenz für alle Folgebilder nutzen
- Bei Tools mit festem Seed: denselben Seed für Variationen innerhalb eines Assets verwenden, für neue Motive im gleichen Stil aber neu würfeln
- Asset-Kategorien (Landschaft, Gebäude, Charakter, Icon) immer mit dem passenden Varianten-Prompt aus Abschnitt 11 kombinieren, nicht nur mit dem Master-Prompt

---

## 14. Für ein programmiertes/laufendes Spiel: einzelne Sprite-Assets

Ein laufendes Spiel wie im Screenshot braucht **keine große gemalte Szene**, sondern viele **einzelne, freigestellte Assets** (Gebäude, Figuren, Bäume, Tiles, Icons), die im Code anstelle der aktuellen Platzhalter-Sprites eingesetzt werden. Das ist ein zusätzlicher Schritt: Die andere Session muss für jedes Asset ein Bild generieren, als PNG mit transparentem/neutralem Hintergrund speichern und im Code referenzieren.

**Wiederverwendbares Sprite-Template** (für jedes Asset denselben Rahmen nutzen, nur `[OBJEKT]` und `[WINKEL]` austauschen – das sorgt für einen einheitlichen Look über viele einzeln generierte Bilder hinweg):

```
Isolated [OBJECT], single game asset on a plain white background,
photorealistic PBR materials, painterly realistic style like Manor
Lords, isometric 3/4 view at a fixed [ANGLE]-degree angle, consistent
warm afternoon sunlight from the upper-left, soft contact shadow
beneath the object, ultra-detailed 8K, centered composition with
empty margin around it. No UI, no HUD, no text, no watermark,
no background scenery, no cartoon style, no flat vector look
```

**Ausgefüllte Beispiele für die im Screenshot sichtbaren Asset-Typen:**

```
Isolated medieval timber-framed house with a moss-covered thatched
roof and whitewashed walls, single game asset on a plain white
background, photorealistic PBR materials, painterly realistic style
like Manor Lords, isometric 3/4 view at a fixed 40-degree angle,
consistent warm afternoon sunlight from the upper-left, soft contact
shadow beneath the object, ultra-detailed 8K, centered composition
with empty margin around it. No UI, no HUD, no text, no watermark,
no background scenery, no cartoon style, no flat vector look
```

```
Isolated small stone keep with two round towers and a wooden gate,
single game asset on a plain white background, photorealistic PBR
materials, painterly realistic style like Manor Lords, isometric 3/4
view at a fixed 40-degree angle, consistent warm afternoon sunlight
from the upper-left, soft contact shadow beneath the object,
ultra-detailed 8K, centered composition with empty margin around it.
No UI, no HUD, no text, no watermark, no background scenery,
no cartoon style, no flat vector look
```

```
Isolated medieval villager character in a standing walking pose,
wearing a simple wool cap, brown tunic and leather boots, single
game asset on a plain white background, photorealistic PBR
materials, painterly realistic style like Manor Lords, 3/4 view at
a fixed 40-degree angle, consistent warm afternoon sunlight from
the upper-left, soft contact shadow beneath the feet, ultra-detailed
8K, centered composition with empty margin around it. No UI, no HUD,
no text, no watermark, no background scenery, no cartoon style,
no flat vector look
```

```
Isolated square grass ground tile for an isometric game, seen from
directly above at a fixed 40-degree angle, photorealistic short
grass texture with natural color variation and small pebbles, subtle
worn dirt patch in one corner, single game asset on a plain white
background, painterly realistic style like Manor Lords, ultra-detailed
8K, seamlessly tileable edges. No UI, no HUD, no text, no watermark,
no cartoon style, no flat vector look
```

```
Isolated deciduous tree with autumn-colored amber and rust leaves,
single game asset on a plain white background, photorealistic PBR
materials, painterly realistic style like Manor Lords, isometric 3/4
view at a fixed 40-degree angle, consistent warm afternoon sunlight
from the upper-left, soft contact shadow beneath the object,
ultra-detailed 8K, centered composition with empty margin around it.
No UI, no HUD, no text, no watermark, no background scenery,
no cartoon style, no flat vector look
```

**Integration (Hinweis an die andere Session):** Für jedes Asset ein Bild mit den obigen Prompts generieren, freistellen (transparenter Hintergrund), unter einem sprechenden Dateinamen speichern (z. B. `house_01.png`, `keep.png`, `villager_walk.png`) und die bestehenden Platzhalter-Sprite-Referenzen im Code durch diese Dateien ersetzen. Ohne diesen Austauschschritt bleibt die Optik unverändert, egal wie gut der Text-Prompt ist.

---

## 15. Vollständige Einzel-Asset-Liste (alle Objekte aus dem Screenshot)

Kurzer Hinweis vorab: Die Liste deckt genre-typische Siedlungsspiel-Elemente ab (Gebäudetypen, Ressourcen, Belagerungseinheiten), die in vielen Aufbaustrategiespielen vorkommen – nicht die exakten, urheberrechtlich geschützten Designs eines einzelnen konkreten Titels. So bleibt die generierte Grafik eigenständig.

### A. Terrain & Wege

**Gras-Bodenkachel**
```
Isolated square grass ground tile for an isometric settler game, seen
from a fixed 40-degree isometric angle, photorealistic short grass
texture with natural color variation and a few small pebbles,
painterly realistic PBR materials, warm afternoon sunlight from the
upper-left, seamlessly tileable edges, plain white background,
ultra-detailed 8K. No UI, no text, no watermark, no cartoon style
```

**Weg-Kachel (gerade)**
```
Isolated straight dirt path tile for an isometric settler game, worn
mud and pebble texture with visible wheel ruts, fixed 40-degree
isometric angle, painterly realistic PBR materials, warm afternoon
sunlight from the upper-left, seamlessly tileable edges, plain white
background, ultra-detailed 8K. No UI, no text, no watermark, no
cartoon style
```

**Weg-Kachel (Kurve/Kreuzung)**
```
Isolated curved dirt path tile with a junction branching off, worn
mud and pebble texture, fixed 40-degree isometric angle, painterly
realistic PBR materials, warm afternoon sunlight from the upper-left,
seamlessly tileable edges, plain white background, ultra-detailed 8K.
No UI, no text, no watermark, no cartoon style
```

### B. Wohn- und Wirtschaftsgebäude

**Kleines Haus mit Strohdach**
```
Isolated small medieval cottage with a golden thatched roof and
whitewashed timber-framed walls, single game asset on a plain white
background, painterly realistic PBR materials, isometric 3/4 view at
a fixed 40-degree angle, warm afternoon sunlight from the upper-left,
soft contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Haus mit Schindeldach**
```
Isolated medieval house with a grey wooden shingle roof and stone
foundation, single game asset on a plain white background, painterly
realistic PBR materials, isometric 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow, ultra-detailed 8K. No UI, no HUD, no text, no watermark, no
background scenery, no cartoon style
```

**Marktstand**
```
Isolated wooden market stall with a striped fabric awning and a
counter displaying baskets of produce, single game asset on a plain
white background, painterly realistic PBR materials, isometric 3/4
view at a fixed 40-degree angle, warm afternoon sunlight from the
upper-left, soft contact shadow, ultra-detailed 8K. No UI, no HUD, no
text, no watermark, no background scenery, no cartoon style
```

**Mühlenturm mit Zahnrad**
```
Isolated stone mill tower with an exposed wooden gear mechanism and a
blue-grey shingle roof, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Baustelle mit Gerüst**
```
Isolated building under construction with exposed wooden scaffolding,
stacked timber beams and a partially finished stone base, single game
asset on a plain white background, painterly realistic PBR materials,
isometric 3/4 view at a fixed 40-degree angle, warm afternoon
sunlight from the upper-left, soft contact shadow, ultra-detailed 8K.
No UI, no HUD, no text, no watermark, no background scenery, no
cartoon style
```

### C. Militär- und Verteidigungsgebäude

**Kernburg mit Zwillingstürmen**
```
Isolated small stone keep with two round corner towers with blue
conical roofs and a reinforced wooden gate bearing a carved shield
emblem, single game asset on a plain white background, painterly
realistic PBR materials, isometric 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow, ultra-detailed 8K. No UI, no HUD, no text, no watermark, no
background scenery, no cartoon style
```

**Wehrturm mit Wappen**
```
Isolated square stone watchtower with a blue pyramidal roof and a
carved heraldic shield mounted on its front wall, single game asset
on a plain white background, painterly realistic PBR materials,
isometric 3/4 view at a fixed 40-degree angle, warm afternoon
sunlight from the upper-left, soft contact shadow, ultra-detailed 8K.
No UI, no HUD, no text, no watermark, no background scenery, no
cartoon style
```

**Schlanker Wachturm**
```
Isolated tall narrow stone watchtower with a steep blue roof and a
small window near the top, single game asset on a plain white
background, painterly realistic PBR materials, isometric 3/4 view at
a fixed 40-degree angle, warm afternoon sunlight from the upper-left,
soft contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

### D. Belagerungswaffe

**Katapult**
```
Isolated wooden catapult siege engine with a taut rope mechanism and
a counterweight, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

### E. Deko-Elemente

**Laubbaum**
```
Isolated deciduous tree with a round leafy canopy in natural green
tones, single game asset on a plain white background, painterly
realistic PBR materials, isometric 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow, ultra-detailed 8K. No UI, no HUD, no text, no watermark, no
background scenery, no cartoon style
```

**Nadelbaum**
```
Isolated tall pine tree with dense dark-green triangular foliage,
single game asset on a plain white background, painterly realistic
PBR materials, isometric 3/4 view at a fixed 40-degree angle, warm
afternoon sunlight from the upper-left, soft contact shadow,
ultra-detailed 8K. No UI, no HUD, no text, no watermark, no
background scenery, no cartoon style
```

**Banner/Wimpel**
```
Isolated wooden pole with a small blue triangular pennant flag
fluttering at the top, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Zaun-Segment**
```
Isolated short wooden picket fence segment, weathered pale wood with
visible grain, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

### F. Charakter

**Siedler/Arbeiter (gehend)**
```
Isolated medieval villager character in a walking pose, wearing a
simple wool cap, brown tunic, belt and leather boots, single game
asset on a plain white background, painterly realistic PBR materials,
3/4 view at a fixed 40-degree angle, warm afternoon sunlight from the
upper-left, soft contact shadow beneath the feet, ultra-detailed 8K.
No UI, no HUD, no text, no watermark, no background scenery, no
cartoon style
```

### G. UI-Ressourcen-Icons

Eigenes, kompakteres Template für Icons (frontal statt isometrisch, wie ein fotografiertes Einzelobjekt):

**Brot/Getreide-Icon**
```
Isolated photorealistic bread roll resting on a small burlap sack of
grain, game resource icon centered on a plain white background, soft
studio lighting with a subtle rim light from the upper-left,
painterly realistic PBR materials, subtle drop shadow, ultra-detailed.
No text, no numbers, no UI frame, no watermark, no cartoon style, no
flat vector look
```

**Edelstein-Icon**
```
Isolated photorealistic polished grey gemstone, game resource icon
centered on a plain white background, soft studio lighting with a
subtle rim light from the upper-left, painterly realistic PBR
materials, subtle drop shadow, ultra-detailed. No text, no numbers, no
UI frame, no watermark, no cartoon style, no flat vector look
```

**Ziel/Wachstums-Icon**
```
Isolated photorealistic carved wooden arrow pointing upward on a
small round medallion, game resource icon centered on a plain white
background, soft studio lighting with a subtle rim light from the
upper-left, painterly realistic PBR materials, subtle drop shadow,
ultra-detailed. No text, no numbers, no UI frame, no watermark, no
cartoon style, no flat vector look
```

**Wassertropfen-Icon**
```
Isolated photorealistic single water droplet, glossy and reflective,
game resource icon centered on a plain white background, soft studio
lighting with a subtle rim light from the upper-left, painterly
realistic PBR materials, subtle drop shadow, ultra-detailed. No text,
no numbers, no UI frame, no watermark, no cartoon style, no flat
vector look
```

**Holz-Icon**
```
Isolated photorealistic small stack of cut wooden planks tied with
rope, game resource icon centered on a plain white background, soft
studio lighting with a subtle rim light from the upper-left,
painterly realistic PBR materials, subtle drop shadow, ultra-detailed.
No text, no numbers, no UI frame, no watermark, no cartoon style, no
flat vector look
```

**Werkzeug-Icon**
```
Isolated photorealistic iron pickaxe with a worn wooden handle, game
resource icon centered on a plain white background, soft studio
lighting with a subtle rim light from the upper-left, painterly
realistic PBR materials, subtle drop shadow, ultra-detailed. No text,
no numbers, no UI frame, no watermark, no cartoon style, no flat
vector look
```

**Goldmünze-Icon**
```
Isolated photorealistic gold coin with a subtle embossed pattern,
game resource icon centered on a plain white background, soft studio
lighting with a subtle rim light from the upper-left, painterly
realistic PBR materials, subtle drop shadow, ultra-detailed. No text,
no numbers, no UI frame, no watermark, no cartoon style, no flat
vector look
```

**Gekreuzte-Schwerter-Icon**
```
Isolated pair of photorealistic crossed medieval swords with worn
leather-wrapped hilts, game resource icon centered on a plain white
background, soft studio lighting with a subtle rim light from the
upper-left, painterly realistic PBR materials, subtle drop shadow,
ultra-detailed. No text, no numbers, no UI frame, no watermark, no
cartoon style, no flat vector look
```

### H. UI-Bedienelemente

**Pause-Button**
```
Isolated round UI button carved from weathered wood with a simple
engraved pause symbol (two vertical bars), game interface icon
centered on a plain white background, soft studio lighting, painterly
realistic PBR materials matching a medieval settler-strategy game,
subtle drop shadow, ultra-detailed. No extra text, no watermark, no
flat vector look
```

**Geschwindigkeits-Button**
```
Isolated round UI button carved from weathered wood with a simple
engraved single forward arrow symbol, game interface icon centered on
a plain white background, soft studio lighting, painterly realistic
PBR materials matching a medieval settler-strategy game, subtle drop
shadow, ultra-detailed. No extra text, no watermark, no flat vector
look
```

**Menü-Button (Hexagon)**
```
Isolated hexagonal UI button made of dark engraved stone with a
simple carved square symbol in its center, game interface icon
centered on a plain white background, soft studio lighting, painterly
realistic PBR materials matching a medieval settler-strategy game,
subtle drop shadow, ultra-detailed. No extra text, no watermark, no
flat vector look
```
---

## 16. Ergänzende Elemente (Bergwerke, Wirtschaftsgebäude, Figuren, Terrain, Deko, Waren-Icons, UI, Effekte)

Auch hier gilt: Die Beschreibungen bleiben bei generischen, historisch plausiblen Gebäude- und Berufstypen (Holzfäller, Sägewerk, Münzprägerei usw. sind ganz normale deutsche Berufs-/Gebäudebezeichnungen, keine geschützten Eigennamen) – die konkrete Bildumsetzung bleibt eigenständig.


### 16.1 Bergwerke (4)


**Kohlebergwerk**
```
Isolated a rustic mine entrance built into a rocky hillside with reinforced wooden support beams and a small coal cart on rails, dark coal dust stains around the entrance, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Eisenerzbergwerk**
```
Isolated a rustic mine entrance built into a rocky hillside with reinforced wooden support beams and a small ore cart on rails, reddish-brown iron ore stains around the entrance, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Goldbergwerk**
```
Isolated a rustic mine entrance built into a rocky hillside with reinforced wooden support beams and a small ore cart on rails, glinting golden ore fragments around the entrance, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Granitbergwerk / Steinbruch**
```
Isolated an open granite quarry cut into a rocky hillside with a wooden crane and stacked cut granite blocks, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```


### 16.2 Wirtschaftsgebäude mit eigenem Charakter (16)


**Holzfäller-Hütte**
```
Isolated a small rustic woodcutter's hut made of rough-hewn logs with an axe leaning against the wall and a stack of freshly cut logs beside it, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Förster-Hütte**
```
Isolated a small rustic forester's hut made of timber with young tree saplings and a watering can placed beside it, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Steinmetz-Hütte**
```
Isolated a small stonemason's hut with a stone-cutting yard, chisels, a stone block mid-carving and rock dust on the ground, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Fischerhütte (auf Stelzen)**
```
Isolated a small wooden fisherman's hut built on stilts at the water's edge with a fishing net hanging to dry and a small rowboat tied nearby, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Jägerhütte**
```
Isolated a small rustic hunter's lodge made of timber and animal hides stretched on a drying frame, with a hunting bow leaning against the wall, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Brunnen**
```
Isolated a small round stone well with a wooden roof, a hand crank and a bucket hanging on a rope, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Bauernhof**
```
Isolated a timber-framed farmhouse with an attached barn, a small fenced field patch and a hay cart beside it, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Schweinefarm**
```
Isolated a rustic timber pig farm building with a fenced muddy pen and a wooden feeding trough, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Sägewerk**
```
Isolated a timber sawmill building with a large exposed saw blade mechanism, stacked logs on one side and cut planks on the other, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Bäckerei**
```
Isolated a stone and timber bakery building with a domed clay oven, a chimney and sacks of flour stacked outside, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Brauerei**
```
Isolated a stone brewery building with large wooden barrels stacked outside and a brewing chimney, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Metzgerei**
```
Isolated a timber butcher's building with hanging cured meats visible through an open shutter and a wooden chopping block outside, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Eisenhütte**
```
Isolated a stone iron smelter building with a tall smoking chimney and a glowing furnace opening, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Münzprägerei**
```
Isolated a stone mint building with a small chimney and a reinforced door, gold coins glinting on a table visible through the window, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Waffenschmiede**
```
Isolated a stone weapon smithy with a forge, an anvil outside and racks of swords and spearheads by the door, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Lagerhaus**
```
Isolated a large sturdy timber warehouse building with wide double doors and stacked crates and barrels visible inside, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```


### 16.3 Schmuckgebäude (2)


**Kapelle**
```
Isolated a small stone chapel with a wooden bell tower, a modest cross on the roof and stained-glass-style windows, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Zehntscheune**
```
Isolated a large timber tithe barn with wide doors, stacked grain sacks and hanging tools inside, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```


### 16.4 Militärgebäude (2)


**Kaserne (Palisade)**
```
Isolated a timber barracks building enclosed by a sturdy wooden palisade wall with a gate and a watch platform, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Hauptquartier (große Burg)**
```
Isolated a large fortified medieval castle headquarters with multiple towers, thick stone walls, a raised drawbridge and a prominent carved shield emblem above the gate, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```


### 16.5 Figuren: Träger, Berufe, Soldaten (14)


**Träger ohne Ware**
```
Isolated a medieval carrier villager in a walking pose, empty-handed, wearing simple work clothes and a wool cap, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Träger mit Ware**
```
Isolated a medieval carrier villager in a walking pose, carrying a wooden crate strapped to his back, wearing simple work clothes and a wool cap, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Holzfäller (Figur)**
```
Isolated a medieval woodcutter character in a working pose, holding an axe, wearing rugged work clothes, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Förster (Figur)**
```
Isolated a medieval forester character in a working pose, holding a young sapling and a small spade, wearing simple work clothes, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Steinmetz (Figur)**
```
Isolated a medieval stonemason character in a working pose, holding a chisel and hammer, wearing a leather apron, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Fischer (Figur)**
```
Isolated a medieval fisherman character in a working pose, holding a fishing net, wearing simple work clothes with rolled-up sleeves, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Jäger (Figur)**
```
Isolated a medieval hunter character in a walking pose, carrying a hunting bow over one shoulder, wearing leather and fur clothing, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Bauer (Figur)**
```
Isolated a medieval farmer character in a working pose, holding a wooden hay rake, wearing a simple tunic and straw hat, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Geologe (Figur)**
```
Isolated a medieval geologist character in a kneeling working pose, holding a small hammer and a wooden sign post, wearing a simple traveling cloak, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Soldat Rang 1 – Rekrut**
```
Isolated a young medieval recruit soldier in a standing pose, wearing a simple padded gambeson and holding a basic wooden shield, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Soldat Rang 2 – Infanterist**
```
Isolated a medieval infantryman soldier in a standing pose, wearing leather armor and holding a sword and round shield, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Soldat Rang 3 – Sergeant**
```
Isolated a medieval sergeant soldier in a standing pose, wearing chainmail armor and holding a sword and a reinforced shield, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Soldat Rang 4 – Offizier**
```
Isolated a medieval officer soldier in a standing pose, wearing polished plate armor with a cloth surcoat and holding a longsword, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Soldat Rang 5 – General**
```
Isolated a medieval general soldier in a commanding standing pose, wearing ornate plate armor with a plumed helmet and a decorated cloak, holding an ornate sword, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```


### 16.6 Kartenobjekte & Deko (16)


**Herbstbaum**
```
Isolated a deciduous tree with autumn-colored amber and rust leaves, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Getreidefeld – Stufe 1 (gesät)**
```
Isolated a small farmland field patch with freshly sown bare soil rows and a few tiny green sprouts, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Getreidefeld – Stufe 2 (wachsend)**
```
Isolated a small farmland field patch with young green wheat stalks growing in neat rows, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Getreidefeld – Stufe 3 (erntereif)**
```
Isolated a small farmland field patch with tall golden ripe wheat ready for harvest, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Steinvorkommen / Felsen**
```
Isolated a large mineable granite rock outcrop with visible chisel marks and small chipped fragments around its base, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Ruine**
```
Isolated a burned and partially collapsed medieval building ruin with charred timber beams and scattered rubble, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Tor**
```
Isolated a large reinforced wooden gate set into a stone archway, bound with iron fittings, serving as a campaign objective, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Geologen-Schild – Kohle**
```
Isolated a small wooden signpost stuck in the ground with a carved coal symbol on its board, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Geologen-Schild – Eisen**
```
Isolated a small wooden signpost stuck in the ground with a carved iron ore symbol on its board, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Geologen-Schild – Gold**
```
Isolated a small wooden signpost stuck in the ground with a carved gold nugget symbol on its board, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Geologen-Schild – Granit**
```
Isolated a small wooden signpost stuck in the ground with a carved granite block symbol on its board, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Geologen-Schild – nichts gefunden**
```
Isolated a small wooden signpost stuck in the ground with a carved crossed-out symbol on its board, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Schaf**
```
Isolated a fluffy white sheep standing in a grazing pose, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Vogel**
```
Isolated a small songbird in a perched pose with detailed feather texture, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Schwein (Deko)**
```
Isolated a pink farm pig standing in a grazing pose, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Verschneiter Baum**
```
Isolated a deciduous tree with bare snow-dusted branches and a light snow cover on the ground beneath it, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```


### 16.7 Terrain – zusätzliche Landschaftsthemen & Straße (7)


**Wasser / Ufer**
```
Isolated square shoreline ground tile where water meets sandy shore, with gentle waves and wet sand texture for an isometric settler game, seen from a fixed
40-degree isometric angle, photorealistic texture with natural
variation, painterly realistic PBR materials, warm afternoon
sunlight from the upper-left, seamlessly tileable edges, plain white
background, ultra-detailed 8K. No UI, no text, no watermark, no
cartoon style
```

**Sand / Wüste**
```
Isolated square desert sand ground tile with wind-blown ripple patterns and a few scattered pebbles for an isometric settler game, seen from a fixed
40-degree isometric angle, photorealistic texture with natural
variation, painterly realistic PBR materials, warm afternoon
sunlight from the upper-left, seamlessly tileable edges, plain white
background, ultra-detailed 8K. No UI, no text, no watermark, no
cartoon style
```

**Schnee**
```
Isolated square snow-covered ground tile with soft fresh snow texture and subtle footprints for an isometric settler game, seen from a fixed
40-degree isometric angle, photorealistic texture with natural
variation, painterly realistic PBR materials, warm afternoon
sunlight from the upper-left, seamlessly tileable edges, plain white
background, ultra-detailed 8K. No UI, no text, no watermark, no
cartoon style
```

**Sumpf**
```
Isolated square swamp ground tile with dark muddy water patches, reeds and moss for an isometric settler game, seen from a fixed
40-degree isometric angle, photorealistic texture with natural
variation, painterly realistic PBR materials, warm afternoon
sunlight from the upper-left, seamlessly tileable edges, plain white
background, ultra-detailed 8K. No UI, no text, no watermark, no
cartoon style
```

**Vulkan / Lava**
```
Isolated square volcanic ground tile with cracked dark basalt rock and glowing orange lava fissures for an isometric settler game, seen from a fixed
40-degree isometric angle, photorealistic texture with natural
variation, painterly realistic PBR materials, warm afternoon
sunlight from the upper-left, seamlessly tileable edges, plain white
background, ultra-detailed 8K. No UI, no text, no watermark, no
cartoon style
```

**Fels / Gebirge**
```
Isolated square rocky mountain ground tile with jagged grey stone and sparse patches of hardy vegetation for an isometric settler game, seen from a fixed
40-degree isometric angle, photorealistic texture with natural
variation, painterly realistic PBR materials, warm afternoon
sunlight from the upper-left, seamlessly tileable edges, plain white
background, ultra-detailed 8K. No UI, no text, no watermark, no
cartoon style
```

**Gepflasterte Straße**
```
Isolated square cobblestone road tile made of tightly fitted worn grey stones with subtle moss in the gaps for an isometric settler game, seen from a fixed
40-degree isometric angle, photorealistic texture with natural
variation, painterly realistic PBR materials, warm afternoon
sunlight from the upper-left, seamlessly tileable edges, plain white
background, ultra-detailed 8K. No UI, no text, no watermark, no
cartoon style
```


### 16.8 Waren-Icons – fehlende Ressourcen (14)


Hinweis: Die beiden Icons aus §15 G, die *nicht* zu eurem aktuellen Spiel passen (Edelstein-Icon und Werkzeug/Spitzhacke-Icon), sind unten nicht erneut aufgeführt – die könnt ihr für später (Werkzeug-Wirtschaft auf der Roadmap) einfach aufheben oder ignorieren.


**Baumstamm-Icon**
```
Isolated photorealistic cut wooden log resting on the ground, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Stein-Icon**
```
Isolated photorealistic rough-cut grey stone block, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Fisch-Icon**
```
Isolated photorealistic fresh fish resting on a wooden board, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Fleisch-Icon**
```
Isolated photorealistic cut of raw meat resting on a wooden board, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Getreide-Icon**
```
Isolated photorealistic bundled sheaf of golden wheat, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Mehl-Icon**
```
Isolated photorealistic small burlap sack of flour with a light dusting spilling from the top, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Schwein-Icon (Ressource)**
```
Isolated photorealistic small pink pig standing on a wooden platform, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Kohle-Icon**
```
Isolated photorealistic small pile of black coal lumps, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Eisenerz-Icon**
```
Isolated photorealistic rough chunk of reddish-brown iron ore, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Eisen-Icon**
```
Isolated photorealistic stack of forged iron bars, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Golderz-Icon**
```
Isolated photorealistic rough chunk of gold-flecked ore, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Schild-Icon**
```
Isolated photorealistic round medieval wooden shield with iron reinforcements, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Bier-Icon**
```
Isolated photorealistic wooden beer mug filled with foaming beer, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```

**Soldat-Icon**
```
Isolated photorealistic simple medieval helmet resting on a wooden stand, game resource icon centered on a
plain white background, soft studio lighting with a subtle rim
light from the upper-left, painterly realistic PBR materials,
subtle drop shadow, ultra-detailed. No text, no numbers, no UI
frame, no watermark, no cartoon style, no flat vector look
```


### 16.9 UI – fehlende Bedienelemente (11)


**Baumenü-Kategorie: Wohnen**
```
Isolated a round UI button carved from weathered wood with a simple engraved house symbol, game interface icon centered on a plain white
background, soft studio lighting, painterly realistic PBR materials
matching a medieval settler-strategy game, subtle drop shadow,
ultra-detailed. No extra text, no watermark, no flat vector look
```

**Baumenü-Kategorie: Militär**
```
Isolated a round UI button carved from weathered wood with simple engraved crossed swords, game interface icon centered on a plain white
background, soft studio lighting, painterly realistic PBR materials
matching a medieval settler-strategy game, subtle drop shadow,
ultra-detailed. No extra text, no watermark, no flat vector look
```

**Baumenü-Kategorie: Bergbau**
```
Isolated a round UI button carved from weathered wood with a simple engraved pickaxe symbol, game interface icon centered on a plain white
background, soft studio lighting, painterly realistic PBR materials
matching a medieval settler-strategy game, subtle drop shadow,
ultra-detailed. No extra text, no watermark, no flat vector look
```

**Baumenü-Kategorie: Rohstoffe**
```
Isolated a round UI button carved from weathered wood with a simple engraved wheat sheaf symbol, game interface icon centered on a plain white
background, soft studio lighting, painterly realistic PBR materials
matching a medieval settler-strategy game, subtle drop shadow,
ultra-detailed. No extra text, no watermark, no flat vector look
```

**Angriffs-Button**
```
Isolated a round UI button carved from weathered wood with a simple engraved sword symbol, game interface icon centered on a plain white
background, soft studio lighting, painterly realistic PBR materials
matching a medieval settler-strategy game, subtle drop shadow,
ultra-detailed. No extra text, no watermark, no flat vector look
```

**Abreiß-Button**
```
Isolated a round UI button carved from weathered wood with a simple engraved hammer-and-cross symbol, game interface icon centered on a plain white
background, soft studio lighting, painterly realistic PBR materials
matching a medieval settler-strategy game, subtle drop shadow,
ultra-detailed. No extra text, no watermark, no flat vector look
```

**Fahnen-Button**
```
Isolated a round UI button carved from weathered wood with a simple engraved small flag symbol, game interface icon centered on a plain white
background, soft studio lighting, painterly realistic PBR materials
matching a medieval settler-strategy game, subtle drop shadow,
ultra-detailed. No extra text, no watermark, no flat vector look
```

**Geologen-Button**
```
Isolated a round UI button carved from weathered wood with a simple engraved magnifying-glass-over-rock symbol, game interface icon centered on a plain white
background, soft studio lighting, painterly realistic PBR materials
matching a medieval settler-strategy game, subtle drop shadow,
ultra-detailed. No extra text, no watermark, no flat vector look
```

**Minimap-Rahmen**
```
Isolated ornate circular frame carved from dark weathered wood with
subtle iron rivets around the rim and an empty center, single UI
asset on a plain white background, soft studio lighting, painterly
realistic PBR materials matching a medieval settler-strategy game,
ultra-detailed. No extra text, no watermark, no flat vector look
```

**Panel-Hintergrundtextur (Holz)**
```
Seamless tileable weathered wood plank texture for a UI panel
background, painterly realistic PBR material with natural grain and
subtle wear, flat orthographic view, ultra-detailed 8K, warm neutral
lighting. No UI elements, no text, no icons, no watermark, no
cartoon style
```

**Panel-Hintergrundtextur (Pergament)**
```
Seamless tileable aged parchment paper texture for a UI panel
background, painterly realistic material with subtle stains, creases
and torn edges, flat orthographic view, ultra-detailed 8K, warm
neutral lighting. No UI elements, no text, no icons, no watermark, no
cartoon style
```


### 16.10 Effekte (5)


**Schornsteinrauch**
```
Isolated a soft billowing plume of white-grey chimney smoke, rising and dispersing, standalone visual effect asset for a game, rendered
on a plain black background for easy alpha/transparency extraction,
painterly realistic style matching a medieval settler-strategy game,
ultra-detailed. No UI, no text, no watermark, no cartoon style
```

**Katapult-Steinkugel**
```
Isolated a rough round grey stone projectile with subtle motion-blur streaks, standalone visual effect asset for a game, rendered
on a plain black background for easy alpha/transparency extraction,
painterly realistic style matching a medieval settler-strategy game,
ultra-detailed. No UI, no text, no watermark, no cartoon style
```

**Einschlagstaub**
```
Isolated a small burst of brown dust and debris from a ground impact, standalone visual effect asset for a game, rendered
on a plain black background for easy alpha/transparency extraction,
painterly realistic style matching a medieval settler-strategy game,
ultra-detailed. No UI, no text, no watermark, no cartoon style
```

**Kampf-Funken**
```
Isolated a small burst of bright orange metal sparks from clashing blades, standalone visual effect asset for a game, rendered
on a plain black background for easy alpha/transparency extraction,
painterly realistic style matching a medieval settler-strategy game,
ultra-detailed. No UI, no text, no watermark, no cartoon style
```

**Wasser-Splash**
```
Isolated a small splash of water droplets and foam, as if from a fishing net hitting the water, standalone visual effect asset for a game, rendered
on a plain black background for easy alpha/transparency extraction,
painterly realistic style matching a medieval settler-strategy game,
ultra-detailed. No UI, no text, no watermark, no cartoon style
```
---

## 17. Kampf-Effekte, Kampf-Posen, weitere Truppentypen & brennende Gebäude

Zur Einordnung, was ich wie umgesetzt habe: "Kämpfen / Angreifen / Verteidigen" hab ich als drei generische Aktions-Posen verstanden (unabhängig vom Waffentyp), Bogenschütze/Speerkämpfer/Schwertkämpfer als je eine stehende Bereitschaftspose ohne Rang-Varianten (wie gewünscht) und "brennende Gebäude" als ein wiederverwendbares Feuer-Template, das sich mit jeder Gebäudebeschreibung aus §15/§16 kombinieren lässt.


### 17.1 Fliegender Pfeil (Projektil-Effekt)


**Fliegender Pfeil**
```
Isolated a single arrow in mid-flight, wooden shaft with feather fletching and a metal arrowhead, angled diagonally as if soaring through the air, standalone visual effect asset for a game, rendered
on a plain black background for easy alpha/transparency extraction,
painterly realistic style matching a medieval settler-strategy game,
ultra-detailed. No UI, no text, no watermark, no cartoon style
```


### 17.2 Kampf-Aktionen (Soldat allgemein, 3)


**Soldat – Kämpfen (Nahkampf)**
```
Isolated a medieval soldier in a dynamic melee combat pose, sword raised mid-swing and shield angled forward, dramatic action stance, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Soldat – Angreifen**
```
Isolated a medieval soldier in an aggressive attacking pose, lunging forward with a sword thrust and shield pushed ahead, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Soldat – Verteidigen**
```
Isolated a medieval soldier in a defensive blocking pose, shield raised high covering the body, sword held low and ready, braced stance, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```


### 17.3 Weitere Truppentypen nach Waffe, ohne Ränge (3)


**Bogenschütze**
```
Isolated a medieval archer soldier in a standing ready pose, holding a longbow with an arrow nocked, wearing leather armor and a quiver of arrows on his back, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Speerkämpfer**
```
Isolated a medieval spearman soldier in a standing ready pose, holding a long spear angled forward, wearing leather armor and a round shield strapped to his arm, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```

**Schwertkämpfer**
```
Isolated a medieval swordsman soldier in a standing ready pose, holding a drawn sword and a round shield, wearing chainmail armor, single game asset on a plain white background,
painterly realistic PBR materials, 3/4 view at a fixed 40-degree
angle, warm afternoon sunlight from the upper-left, soft contact
shadow beneath the feet, ultra-detailed 8K. No UI, no HUD, no text,
no watermark, no background scenery, no cartoon style
```


### 17.4 Brennendes Gebäude (wiederverwendbares Feuer-Template)


**Feuer-Template (auf jede Gebäudebeschreibung anwendbar)**
```
Isolated [GEBÄUDEBESCHREIBUNG aus §15/§16 einsetzen] engulfed in flames, with thick black smoke billowing upward, glowing orange embers and visible charring on the roof and walls, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

**Beispiel: Brennendes Wohnhaus**
```
Isolated a small medieval timber-framed cottage engulfed in flames, with thick black smoke billowing upward, glowing orange embers, a partially collapsed burning thatched roof and charring on the walls, single game asset on a plain white background,
painterly realistic PBR materials, isometric 3/4 view at a fixed
40-degree angle, warm afternoon sunlight from the upper-left, soft
contact shadow, ultra-detailed 8K. No UI, no HUD, no text, no
watermark, no background scenery, no cartoon style
```

---

## 18. Hergestellte Waffen aus der Waffenschmiede (Ressourcen-Icons, 3)

**Schwert-Icon**
```
Isolated photorealistic single medieval sword with a leather-wrapped
hilt and a polished steel blade, resting diagonally, game resource
icon centered on a plain white background, soft studio lighting with
a subtle rim light from the upper-left, painterly realistic PBR
materials, subtle drop shadow, ultra-detailed. No text, no numbers,
no UI frame, no watermark, no cartoon style, no flat vector look
```

**Speer-Icon**
```
Isolated photorealistic single medieval spear with a wooden shaft
and a sharp iron spearhead, resting diagonally, game resource icon
centered on a plain white background, soft studio lighting with a
subtle rim light from the upper-left, painterly realistic PBR
materials, subtle drop shadow, ultra-detailed. No text, no numbers,
no UI frame, no watermark, no cartoon style, no flat vector look
```

**Bogen-Icon**
```
Isolated photorealistic single medieval longbow made of curved wood
with a taut bowstring, resting diagonally, game resource icon
centered on a plain white background, soft studio lighting with a
subtle rim light from the upper-left, painterly realistic PBR
materials, subtle drop shadow, ultra-detailed. No text, no numbers,
no UI frame, no watermark, no cartoon style, no flat vector look
```

---

---

---

---

---

---

---

## 19. Figuren-Sammelprompts für GPT-Image 2 (validierte Version)

Wichtigster Fund: Die ausformulierte Aussehensbeschreibung im Text hat dem Ergebnis geschadet statt geholfen - sie konkurrierte offenbar mit dem Referenzbild und hat nebenbei auch die Beinphasen-Anweisungen verwässert. Ohne Beschreibungstext, nur Referenzbild (über die Bild-Upload-/Edit-Funktion des Tools anhängen, nicht im Text erwähnen) + Layout + Panels, funktionieren jetzt beide Dinge gleichzeitig: Identität UND Beinphasen. Die Prompts unten enthalten deshalb ab jetzt keine Charakterbeschreibung mehr. Zurück zur 3er-Struktur pro Vollset-Figur (Basis / Diagonalen / Aktion), plus eine neue Regel gegen Hand-durch-Schild-Clipping.


### 19.1 Feste Regeln


- KEINE Charakterbeschreibung im Prompt-Text - nur Referenzbild anhängen (über die Bild-Funktion des Tools) plus Layout- und Panel-Text.
- Hintergrund immer opak/weiß, NIE transparent (bricht bei euch die Referenzbild-Nutzung).
- Beinphasen bleiben drin (funktioniert, wenn kein Beschreibungstext den Prompt zumüllt).
- Anti-Clipping-Satz am Ende jedes Prompts (Hände/Ausrüstung).
- Pro Vollset-Figur 3 Sammelprompts: Basis (5 Panels), Diagonalen (4 Panels), ggf. Aktion (2 Panels).


### 19.2 Speerkämpfer (Basis 5 / Diagonalen 4 / Wurf-Aktion 2×4)


Schild beim Laufen/Idle jetzt auf dem Rücken statt aktiv in der Hand - nimmt die Zwei-Hand-Prop-Kollision raus, die auf dem markierten Bild das Problem war. Nur bei der Wurf-Aktion bleibt der Schild aktiv im Einsatz, da dort inhaltlich passend.


**Speerkämpfer - Basis-Set (Schild auf dem Rücken)**
*(ergibt die Einzelbilder: unit_spear_idle, _down_a/_b, _up_a/_b)*
```
Generate this as ONE single image containing multiple separate
panels, arranged in a clean layout with generous empty space between
panels so each one can be cropped out individually afterward. No
panel borders, no grid lines, no labels, no text and no numbers
anywhere in the image itself. Every panel must share the exact same
character scale/height, the same fixed light direction from the
upper-left, and the same painterly realistic PBR art style. Plain
solid white background throughout.

Include exactly these panels, each fully separated:

1. Idle: standing still in a relaxed waiting pose, weight balanced
evenly on both feet, the shield slung across the back on its
strap, the spear held upright in one hand with the shaft resting
against that shoulder, the other arm relaxed at the side, looking
straight ahead.

2. Walking toward the viewer (front view), captured at the exact
"contact" moment of a walking gait: the leg closer to the LEFT
edge of the frame is planted forward, heel down, knee slightly
bent; the other leg trails fully extended behind with the heel
lifted. The shield is slung across the back on its strap; the
spear is held upright in one hand resting against the shoulder,
the other arm swinging naturally with the stride.

3. Walking toward the viewer (front view), same gait but mirrored:
the leg closer to the RIGHT edge of the frame is planted forward,
heel down; the other leg trails fully extended behind with the
heel lifted. The shield is slung across the back on its strap; the
spear is held upright in one hand resting against the shoulder,
the other arm swinging naturally with the stride.

4. Walking away from the viewer (back view): the leg closer to the
LEFT edge of the frame is planted forward; the other leg trails
behind with the heel lifted. The shield is slung across the back
on its strap, clearly visible from behind; the spear is held
upright in one hand resting against the shoulder.

5. Walking away from the viewer (back view), mirrored: the leg
closer to the RIGHT edge of the frame is planted forward; the
other leg trails behind with the heel lifted. The shield is slung
across the back on its strap, clearly visible from behind; the
spear is held upright in one hand resting against the shoulder.

Ultra-detailed, no cartoon style, no watermark, no drop shadows
connecting panels. The hand must fully and correctly grip the spear
shaft: individual fingers wrapped around it with the thumb
overlapping, the shaft passing naturally through the closed fist
with no gaps and no floating. The shield strap sits naturally across
the chest and opposite shoulder, the shield resting flush against
the back with no clipping through the body or armor.
```

**Speerkämpfer - Diagonalen (Schild auf dem Rücken, ohne "mirrored")**
*(ergibt die Einzelbilder: unit_spear_downdiag_a/_b, _updiag_a/_b)*
```
Generate this as ONE single image containing multiple separate
panels, arranged in a clean layout with generous empty space between
panels so each one can be cropped out individually afterward. No
panel borders, no grid lines, no labels, no text and no numbers
anywhere in the image itself. Every panel must share the exact same
character scale/height, the same fixed light direction from the
upper-left, and the same painterly realistic PBR art style. Plain
solid white background throughout.

Include exactly these panels, each fully separated:

1. Walking at a 3/4 front-diagonal angle toward the lower-right of
the frame: the leg closer to the LEFT edge of the frame is planted
forward with the heel down, the leg closer to the RIGHT edge of
the frame trails behind fully extended with the heel lifted. The
shield is slung across the back on its strap; the spear is held
upright in one hand resting against the shoulder.

2. Walking at a 3/4 front-diagonal angle toward the lower-right of
the frame: the leg closer to the RIGHT edge of the frame is
planted forward with the heel down, the leg closer to the LEFT
edge of the frame trails behind fully extended with the heel
lifted. The shield is slung across the back on its strap; the
spear is held upright in one hand resting against the shoulder.

3. Walking at a 3/4 back-diagonal angle toward the upper-right of
the frame: the leg closer to the LEFT edge of the frame is planted
forward with the heel down, the leg closer to the RIGHT edge of
the frame trails behind fully extended with the heel lifted. The
shield is slung across the back on its strap, visible from behind;
the spear is held upright in one hand resting against the
shoulder.

4. Walking at a 3/4 back-diagonal angle toward the upper-right of
the frame: the leg closer to the RIGHT edge of the frame is
planted forward with the heel down, the leg closer to the LEFT
edge of the frame trails behind fully extended with the heel
lifted. The shield is slung across the back on its strap, visible
from behind; the spear is held upright in one hand resting against
the shoulder.

Ultra-detailed, no cartoon style, no watermark, no drop shadows
connecting panels. The hand must fully and correctly grip the spear
shaft: individual fingers wrapped around it with the thumb
overlapping, the shaft passing naturally through the closed fist
with no gaps and no floating. The shield strap sits naturally across
the chest and opposite shoulder, the shield resting flush against
the back with no clipping through the body or armor.
```

**Speerkämpfer - Wurf-Aktion, vorne/hinten (Schild auf dem Rücken)**
*(ergibt die Einzelbilder: unit_spear_throw_down_windup/_release, _up_windup/_release)*
```
Generate this as ONE single image containing multiple separate
panels, arranged in a clean layout with generous empty space between
panels so each one can be cropped out individually afterward. No
panel borders, no grid lines, no labels, no text and no numbers
anywhere in the image itself. Every panel must share the exact same
character scale/height, the same fixed light direction from the
upper-left, and the same painterly realistic PBR art style. Plain
solid white background throughout.

Include exactly these panels, each fully separated:

1. Spear throw wind-up, seen from the front (facing the viewer):
the throwing arm drawn back and angled outward to the side at
shoulder height (not straight behind the torso), gripping the
spear horizontally with the full shaft and spearhead clearly
visible extending past the body, torso rotated back, weight
shifted onto the back leg, the shield slung across the back on its
strap, the off hand raised naturally for balance, about to
release.

2. Spear throw release, seen from the front (facing the viewer):
the throwing arm fully extended forward and slightly outward at
shoulder height having just released the spear, the spear's full
length still visible along the arm's line of motion, torso rotated
forward, weight now on the front leg, back leg trailing in a
follow-through pose, the shield slung across the back on its
strap.

3. Spear throw wind-up, seen from directly behind (facing away
from the viewer): the throwing arm drawn back and angled outward
to the side at shoulder height (not straight behind the torso),
gripping the spear horizontally with the full shaft and spearhead
clearly visible extending past the body, torso rotated back,
weight shifted onto the back leg, the shield slung across the back
on its strap, the off hand raised naturally for balance, about to
release.

4. Spear throw release, seen from directly behind (facing away
from the viewer): the throwing arm fully extended forward and
slightly outward at shoulder height having just released the
spear, the spear's full length still visible along the arm's line
of motion, torso rotated forward, weight now on the front leg,
back leg trailing in a follow-through pose, the shield slung
across the back on its strap.

Ultra-detailed, no cartoon style, no watermark, no drop shadows
connecting panels. The full length of the spear shaft and spearhead
must remain clearly visible in every panel, extending clear of the
body and head - never hidden, cut off, or clipped by the torso, arm,
shoulder, or helmet. The throwing hand must fully and correctly grip
the spear shaft with individual fingers wrapped around it and the
thumb overlapping, no gaps, no floating. The shield strap sits
naturally across the chest and opposite shoulder, the shield resting
flush against the back.
```

**Speerkämpfer - Wurf-Aktion, diagonal (Schild auf dem Rücken)**
*(ergibt die Einzelbilder: unit_spear_throw_downdiag_windup/_release, _updiag_windup/_release)*
```
Generate this as ONE single image containing multiple separate
panels, arranged in a clean layout with generous empty space between
panels so each one can be cropped out individually afterward. No
panel borders, no grid lines, no labels, no text and no numbers
anywhere in the image itself. Every panel must share the exact same
character scale/height, the same fixed light direction from the
upper-left, and the same painterly realistic PBR art style. Plain
solid white background throughout.

Include exactly these panels, each fully separated:

1. Spear throw wind-up, seen from a 3/4 front-diagonal angle: the
throwing arm drawn back and angled outward to the side at shoulder
height (not straight behind the torso), gripping the spear
horizontally with the full shaft and spearhead clearly visible
extending past the body, torso rotated back, weight shifted onto
the back leg, the shield slung across the back on its strap, the
off hand raised naturally for balance, about to release.

2. Spear throw release, seen from a 3/4 front-diagonal angle: the
throwing arm fully extended forward and slightly outward at
shoulder height having just released the spear, the spear's full
length still visible along the arm's line of motion, torso rotated
forward, weight now on the front leg, back leg trailing in a
follow-through pose, the shield slung across the back on its
strap.

3. Spear throw wind-up, seen from a 3/4 back-diagonal angle: the
throwing arm drawn back and angled outward to the side at shoulder
height (not straight behind the torso), gripping the spear
horizontally with the full shaft and spearhead clearly visible
extending past the body, torso rotated back, weight shifted onto
the back leg, the shield slung across the back on its strap, the
off hand raised naturally for balance, about to release.

4. Spear throw release, seen from a 3/4 back-diagonal angle: the
throwing arm fully extended forward and slightly outward at
shoulder height having just released the spear, the spear's full
length still visible along the arm's line of motion, torso rotated
forward, weight now on the front leg, back leg trailing in a
follow-through pose, the shield slung across the back on its
strap.

Ultra-detailed, no cartoon style, no watermark, no drop shadows
connecting panels. The full length of the spear shaft and spearhead
must remain clearly visible in every panel, extending clear of the
body and head - never hidden, cut off, or clipped by the torso, arm,
shoulder, or helmet. The throwing hand must fully and correctly grip
the spear shaft with individual fingers wrapped around it and the
thumb overlapping, no gaps, no floating. The shield strap sits
naturally across the chest and opposite shoulder, the shield resting
flush against the back.
```


Dasselbe Prinzip gilt für andere Waffen-tragende Figuren, falls dort ähnliche Grip-Probleme auftauchen: Ausrüstung beim Laufen/Idle wegstecken (Schild Rücken, Schwert Scheide, Bogen Rücken) statt aktiv in der Hand halten, nur bei der jeweiligen Kampf-/Aktions-Pose aktiv einsetzen.

### 19.3 Träger, Schwertkämpfer, Bogenschütze (Basis 5 / Diagonalen 4)


**Basis-Set (gleiches Muster, per Referenzbild für jede der drei Figuren)**
*(ergibt die Einzelbilder: unit_*_idle, _down_a/_b, _up_a/_b)*
```
Generate this as ONE single image containing multiple separate
panels, arranged in a clean layout with generous empty space between
panels so each one can be cropped out individually afterward. No
panel borders, no grid lines, no labels, no text and no numbers
anywhere in the image itself. Every panel must share the exact same
character scale/height, the same fixed light direction from the
upper-left, and the same painterly realistic PBR art style. Plain
solid white background throughout.

Include exactly these panels, each fully separated:

1. Idle: standing still in a relaxed waiting pose, weight balanced
evenly on both feet, arms resting naturally, holding the equipment
passively, looking straight ahead.

2. Walking toward the viewer (front view), captured at the exact
"contact" moment of a walking gait: the leg closer to the LEFT
edge of the frame is planted forward, heel down, knee slightly
bent; the other leg trails fully extended behind with the heel
lifted.

3. Walking toward the viewer (front view), same gait but mirrored:
the leg closer to the RIGHT edge of the frame is planted forward,
heel down; the other leg trails fully extended behind with the
heel lifted.

4. Walking away from the viewer (back view): the leg closer to the
LEFT edge of the frame is planted forward; the other leg trails
behind with the heel lifted.

5. Walking away from the viewer (back view), mirrored: the leg
closer to the RIGHT edge of the frame is planted forward; the
other leg trails behind with the heel lifted.

Ultra-detailed, no cartoon style, no watermark, no drop shadows
connecting panels. Hands must fully and correctly grip every held
object: individual fingers wrapped around the spear/weapon shaft
with the thumb overlapping, the shaft passing naturally through the
closed fist with no gaps and no floating; the same firm,
anatomically correct grip applies to the shield handle. No merged,
warped, or disconnected geometry between hands and any held object.
```

**Diagonalen (ohne "mirrored")**
*(ergibt die Einzelbilder: unit_*_downdiag_a/_b, _updiag_a/_b)*
```
Generate this as ONE single image containing multiple separate
panels, arranged in a clean layout with generous empty space between
panels so each one can be cropped out individually afterward. No
panel borders, no grid lines, no labels, no text and no numbers
anywhere in the image itself. Every panel must share the exact same
character scale/height, the same fixed light direction from the
upper-left, and the same painterly realistic PBR art style. Plain
solid white background throughout.

Include exactly these panels, each fully separated:

1. Walking at a 3/4 front-diagonal angle toward the lower-right of
the frame: the leg closer to the LEFT edge of the frame is planted
forward with the heel down, the leg closer to the RIGHT edge of
the frame trails behind fully extended with the heel lifted.

2. Walking at a 3/4 front-diagonal angle toward the lower-right of
the frame: the leg closer to the RIGHT edge of the frame is
planted forward with the heel down, the leg closer to the LEFT
edge of the frame trails behind fully extended with the heel
lifted.

3. Walking at a 3/4 back-diagonal angle toward the upper-right of
the frame: the leg closer to the LEFT edge of the frame is planted
forward with the heel down, the leg closer to the RIGHT edge of
the frame trails behind fully extended with the heel lifted.

4. Walking at a 3/4 back-diagonal angle toward the upper-right of
the frame: the leg closer to the RIGHT edge of the frame is
planted forward with the heel down, the leg closer to the LEFT
edge of the frame trails behind fully extended with the heel
lifted.

Ultra-detailed, no cartoon style, no watermark, no drop shadows
connecting panels. Hands must fully and correctly grip any held
object: individual fingers wrapped around it with the thumb
overlapping, no gaps, no floating, no clipping through the body,
armor, or other held objects.
```


### 19.4 Priorität 2/3 - Minimal-Set (nur Basis, 5 Panels)


**Minimal-Set (per Referenzbild für jede der acht Figuren)**
*(ergibt die Einzelbilder: unit_*_idle, _down_a/_b, _up_a/_b)*
```
Generate this as ONE single image containing multiple separate
panels, arranged in a clean layout with generous empty space between
panels so each one can be cropped out individually afterward. No
panel borders, no grid lines, no labels, no text and no numbers
anywhere in the image itself. Every panel must share the exact same
character scale/height, the same fixed light direction from the
upper-left, and the same painterly realistic PBR art style. Plain
solid white background throughout.

Include exactly these panels, each fully separated:

1. Idle: standing still in a relaxed waiting pose, weight balanced
evenly on both feet, arms resting naturally, holding the equipment
passively, looking straight ahead.

2. Walking toward the viewer (front view), captured at the exact
"contact" moment of a walking gait: the leg closer to the LEFT
edge of the frame is planted forward, heel down, knee slightly
bent; the other leg trails fully extended behind with the heel
lifted.

3. Walking toward the viewer (front view), same gait but mirrored:
the leg closer to the RIGHT edge of the frame is planted forward,
heel down; the other leg trails fully extended behind with the
heel lifted.

4. Walking away from the viewer (back view): the leg closer to the
LEFT edge of the frame is planted forward; the other leg trails
behind with the heel lifted.

5. Walking away from the viewer (back view), mirrored: the leg
closer to the RIGHT edge of the frame is planted forward; the
other leg trails behind with the heel lifted.

Ultra-detailed, no cartoon style, no watermark, no drop shadows
connecting panels. Hands must fully and correctly grip every held
object: individual fingers wrapped around the spear/weapon shaft
with the thumb overlapping, the shaft passing naturally through the
closed fist with no gaps and no floating; the same firm,
anatomically correct grip applies to the shield handle. No merged,
warped, or disconnected geometry between hands and any held object.
```


### 19.5 Tiere - Schaf (5 Panels)


**Schaf**
*(ergibt die Einzelbilder: deco_sheep_idle, _down_a/_b, _up_a/_b)*
```
Generate this as ONE single image containing multiple separate
panels, arranged in a clean layout with generous empty space between
panels so each one can be cropped out individually afterward. No
panel borders, no grid lines, no labels, no text and no numbers
anywhere in the image itself. Every panel must share the exact same
character scale/height, the same fixed light direction from the
upper-left, and the same painterly realistic PBR art style. Plain
solid white background throughout.

Include exactly these panels, each fully separated:

1. Idle: standing still in a relaxed pose, head level, looking
forward.

2. Walking toward the viewer (front view), captured mid-stride:
both legs closer to the LEFT edge of the frame are stepped
forward, while both legs closer to the RIGHT edge trail back.

3. Walking toward the viewer (front view), mirrored: both legs
closer to the RIGHT edge of the frame are stepped forward, while
both legs closer to the LEFT edge trail back.

4. Walking away from the viewer (back view): both legs closer to
the LEFT edge of the frame are stepped forward, the other pair
trails back.

5. Walking away from the viewer (back view), mirrored: both legs
closer to the RIGHT edge of the frame are stepped forward, the
other pair trails back.

Ultra-detailed, no cartoon style, no watermark, no drop shadows
connecting panels. Hands must fully and correctly grip every held
object: individual fingers wrapped around the spear/weapon shaft
with the thumb overlapping, the shaft passing naturally through the
closed fist with no gaps and no floating; the same firm,
anatomically correct grip applies to the shield handle. No merged,
warped, or disconnected geometry between hands and any held object.
```


Zusätzlich weiterhin separat (nur beim Basisbild relevant, das grast):


**Schaf - gehende Seitenansicht (Einzelbild)**
*(ergibt die Einzelbilder: deco_sheep_walk_side)*
```
Generate this as ONE single image containing multiple separate
panels, arranged in a clean layout with generous empty space between
panels so each one can be cropped out individually afterward. No
panel borders, no grid lines, no labels, no text and no numbers
anywhere in the image itself. Every panel must share the exact same
character scale/height, the same fixed light direction from the
upper-left, and the same painterly realistic PBR art style. Plain
solid white background throughout.

Include exactly these panels, each fully separated:

1. The sheep in a walking side-view pose instead of grazing, head
raised and looking forward, mid-stride.

Ultra-detailed, no cartoon style, no watermark, no drop shadows
connecting panels. Hands must fully and correctly grip every held
object: individual fingers wrapped around the spear/weapon shaft
with the thumb overlapping, the shaft passing naturally through the
closed fist with no gaps and no floating; the same firm,
anatomically correct grip applies to the shield handle. No merged,
warped, or disconnected geometry between hands and any held object.
```

---

## 20. Charakter-Stilwechsel: niedlicher Karikatur-Stil

Ab hier gilt für Figuren ein neuer Stil - deutlich niedlicher/karikaturhafter statt photorealistisch, angelehnt an die Chibi-Charme-Tradition von Siedler 2 und klassischen europäischen Comic-Karikaturen (große Nase, kräftige Tuschelinien, gedrungene Proportionen). Gebäude/Umgebung aus §1-18 bleiben unverändert im realistischen Stil.

### 20.1 Neue Stil-Merkmale für Figuren

- Übergroßer, runder Kopf mit markanter, großer Nase, warmen/freundlichen Augen
- Gedrungene, kindliche Proportionen (Kopf:Körper ca. 1:3 statt realistisch 1:7)
- Kräftige, klare schwarze Tuschekontur um alle Formen
- Flächige, satte Farben statt realistischem PBR-Materiallook, minimale Schattierung
- Ausrüstung (Helm, Rüstung, Waffen) bleibt inhaltlich wie bisher (siehe jeweilige Figur), wird aber vereinfacht und in dieser Karikatur-Sprache gezeichnet statt fotorealistisch
- Schilde dürfen ruhig ein kräftiges, farbiges Muster tragen statt gedeckter Töne
- **Wichtig, da im Spiel klein dargestellt:** die Figuren erscheinen als kleine Sprites auf der Karte, nicht als große Illustration. Detailgrad entsprechend deutlich REDUZIEREN - große einfache Formen und Flächen statt feiner Details wie einzelner Schnurrhaare, Nieten oder Farbverläufe. Nur die großen, silhouettenprägenden Merkmale (große Nase, Schnurrbart-Form, runder Kopf, Schildfarbe) müssen auch klein erkennbar bleiben; alles Feinteilige geht bei geringer Größe ohnehin verloren und macht das Bild nur unruhig.

### 20.2 Basis-Prompt: Speerkämpfer im neuen Stil (Design-Basis, kein Referenzbild nötig)

Dieser Prompt erzeugt die *erste* Version im neuen Stil per Text allein - das Ergebnis wird danach das neue Referenzbild für alle weiteren Ansichten (genau wie das bisherige Referenzbild für den realistischen Stil).

```
A charming caricature-style illustration of a stocky medieval
spearman, designed to work as a SMALL in-game sprite - keep shapes
bold and simple with reduced detail throughout, since fine detail
will be lost at small display size. An oversized round head with a
big simple expressive nose, a bold simple mustache shape (no
individual hair strands or fine texture), and warm simple eyes, set
on a compact chibi-proportioned body (roughly 1:3 head-to-body
ratio) with sturdy short limbs. Wearing a rounded steel conical
helmet with a small nose guard (no fine rivet or scratch detail),
simplified brown leather armor with bold crossed chest straps (no
individual stitching, rivets, or texture), and sturdy boots. Holding
a round wooden shield painted with a bold, simple colorful pattern
(deep blue and warm gold in flat color blocks), and gripping a
wooden spear with a simplified steel spearhead, the hand fully and
correctly wrapped around the shaft. Thick clean black ink outlines
throughout, flat rich saturated colors with NO gradient shading and
no fine surface texture - at most one flat shadow tone per area,
playful and endearing expression, bold simple shapes that stay
clearly readable at a very small size. Standing in a confident,
friendly pose, isolated on a plain white background, no text, no
watermark.
```

### 20.3 Wie es weitergeht, sobald die Basis passt

- Das Ergebnis aus 20.2 wird das neue Referenzbild für den Speerkämpfer.
- Die gesamte Struktur aus §14-19 bleibt gültig (Layout-Regeln, Beinphasen-Formulierung, Schild-auf-dem-Rücken-Logik, Anti-Clipping-Satz, Wurf-Aktion aus vier Richtungen) - nur die Stil-Stichworte in jedem Prompt wechseln von "painterly realistic PBR materials" etc. auf die neue Karikatur-Sprache aus 20.1, plus das neue Referenzbild.
- Für jede andere Figur (Träger, Bogenschütze, Holzfäller, ...) braucht es einmalig denselben Schritt wie in 20.2 - einen Design-Basis-Prompt ohne Referenzbild, um die neue Stil-Version zu erzeugen.

Sag Bescheid, wenn die Speerkämpfer-Basis passt - dann übertrage ich den Stilwechsel auf die bestehenden Sammelprompts aus §19 (Basis/Diagonalen/Wurf-Aktion) und baue die Design-Basis-Prompts für die übrigen Figuren.

---

## 21. Kamera, Rendering-Look und 4-Phasen-Laufzyklus (neue Produktionsstandards)

Ab hier gelten drei neue feste Bausteine für JEDEN Figuren-Prompt (lösen die bisherige "painterly/frontal"-Sprache aus §19/20 ab, sobald sich das hier bewährt):


### 21.1 Kamera-Baustein

```
Camera: elevated oblique angle at roughly 40 degrees looking down
onto the character, matching the isometric camera used for the
game's buildings - not a flat frontal or eye-level view. We look
down onto the shoulders and the top of the head; the foot further
back in the stride sits visibly higher in the frame than the foot
further forward, consistent with looking down at an angle.
```


### 21.2 Rendering-Baustein

```
Rendering look: pre-rendered 3D sprite aesthetic rather than a
painterly illustration - smooth volumetric shading with a clear,
crisp light-to-shadow boundary (not a soft painterly blend), a
subtle specular highlight on any metal or leather surface, soft
self-shadowing where one part of the body shades another (e.g. an
arm casting a soft shadow onto the torso). Fixed light direction
from the upper-left in every single panel.
```


### 21.3 Vier-Phasen-Laufzyklus statt zwei

Kontakt (Beine gespreizt) und Passier-/Hochpunkt (Beine kreuzen sich, Körper leicht angehoben) wechseln sich ab: Kontakt-A → Passieren-A → Kontakt-B → Passieren-B. Referenzbild weiterhin ohne Textbeschreibung mitgeben, sobald eins existiert (siehe §19-Fund) - bei diesem ersten Träger-Set gibt's noch keins, deshalb unten eine Aussehensbeschreibung als Design-Basis wie beim Speerkämpfer in §20.2.


### 21.4 Träger - Seite, 4 Laufphasen (höchste Priorität, erster Test)


**Träger - Seitenansicht, 4-Phasen-Laufzyklus v2 (mit Referenzbild)**
*(ergibt die Einzelbilder: traeger_seite_1, _2, _3, _4)*
```
Camera: elevated oblique angle at roughly 40 degrees looking down
onto the character, matching the isometric camera used for the
game's buildings - not a flat frontal or eye-level view. We look
down onto the shoulders and the top of the head; the foot further
back in the stride sits visibly higher in the frame than the foot
further forward, consistent with looking down at an angle.

Rendering look: pre-rendered 3D sprite aesthetic rather than a
painterly illustration - smooth volumetric shading with a clear,
crisp light-to-shadow boundary (not a soft painterly blend), a
subtle specular highlight on any metal or leather surface, soft
self-shadowing where one part of the body shades another. Fixed
light direction from the upper-left in every single panel.

Same character as the reference image, identical clothing, colors
and proportions. Generate this as ONE single image containing
multiple separate panels, arranged in a clean layout with generous
empty space between panels so each one can be cropped out
individually afterward. No panel borders, no grid lines, no labels,
no text and no numbers anywhere in the image itself. Every panel
must share the exact same character scale/height and the exact same
ground point. Plain solid white background throughout.

Include exactly these panels, each fully separated:

1. Viewed from the side at the elevated 40-degree camera angle,
walking toward the right of the frame: captured at the "contact"
moment of the gait, legs maximally spread apart in a wide stance,
the leg closer to the RIGHT edge of the frame planted flat on the
ground forward with the heel down and knee slightly bent, the leg
closer to the LEFT edge of the frame stretched fully backward with
only the toe touching and the heel lifted high. The arm closer to
the RIGHT edge swings backward, the arm closer to the LEFT edge
swings forward - opposite to the legs. Body at the LOWEST point of
its vertical bob, close to the ground.

2. Viewed from the side at the elevated 40-degree camera angle,
walking toward the right of the frame: captured at the "passing"
moment of the gait, mid-transition: the leg closer to the LEFT
edge of the frame is swinging forward, its knee bent and lifted
clearly off the ground, passing close beside the other leg's shin;
the leg closer to the RIGHT edge is the single supporting leg,
extended straight and vertical beneath the body. The arm closer to
the LEFT edge swings backward, the arm closer to the RIGHT edge
swings forward - opposite to the legs. Body at the HIGHEST point
of its vertical bob, visibly raised above the contact-pose height,
both feet closer together beneath the body than in any other
phase.

3. Viewed from the side at the elevated 40-degree camera angle,
walking toward the right of the frame: captured at the "contact"
moment of the gait, legs maximally spread apart in a wide stance,
the leg closer to the LEFT edge of the frame planted flat on the
ground forward with the heel down and knee slightly bent, the leg
closer to the RIGHT edge of the frame stretched fully backward
with only the toe touching and the heel lifted high. The arm
closer to the LEFT edge swings backward, the arm closer to the
RIGHT edge swings forward - opposite to the legs. Body at the
LOWEST point of its vertical bob, close to the ground.

4. Viewed from the side at the elevated 40-degree camera angle,
walking toward the right of the frame: captured at the "passing"
moment of the gait, mid-transition: the leg closer to the RIGHT
edge of the frame is swinging forward, its knee bent and lifted
clearly off the ground, passing close beside the other leg's shin;
the leg closer to the LEFT edge is the single supporting leg,
extended straight and vertical beneath the body. The arm closer to
the RIGHT edge swings backward, the arm closer to the LEFT edge
swings forward - opposite to the legs. Body at the HIGHEST point
of its vertical bob, visibly raised above the contact-pose height,
both feet closer together beneath the body than in any other
phase.

Ultra-detailed but with reduced fine surface texture (small in-game
sprite). No cartoon ink outlines - rely on the rendered shading
described above instead. No watermark, no drop shadows connecting
panels. Hands must correctly and naturally interact with the
carrying strap, no clipping through the body.
```



### 21.5 Roadmap (nach deiner Priorität)

1. 🔄 Träger Seite, 4 Phasen - Stil/Konsistenz bestätigt, Phasen-Unterscheidung wird gerade nachgeschärft (v2 unten, ersetzt die erste Version)
2. 🔄 Träger vorn + hinten, je 4 Phasen (8 Bilder) - gleiche Nachschärfung, Prompts unten in 21.6/21.7
3. Die 3 Soldaten (Speerkämpfer, Schwertkämpfer, Bogenschütze), Seite, je 4 Phasen (12 Bilder)
4. Restliche Berufe nach der Prioritätsliste aus §19.4

Sobald der Kamerawinkel/Rendering-Look beim Träger überzeugt, übertrage ich dieselben drei Bausteine auf die bestehenden Speerkämpfer-Prompts aus §19 (die dann von 2 auf 4 Phasen erweitert werden) und baue Schritt 3-4 in derselben Machart.

---

### 21.6 Träger - Vorne, 4 Laufphasen


**Träger - Vorderansicht, 4-Phasen-Laufzyklus v2 (mit Referenzbild)**
*(ergibt die Einzelbilder: traeger_vorn_1, _2, _3, _4)*
```
Camera: elevated oblique angle at roughly 40 degrees looking down
onto the character, matching the isometric camera used for the
game's buildings - not a flat frontal or eye-level view. We look
down onto the shoulders and the top of the head; the foot further
back in the stride sits visibly higher in the frame than the foot
further forward, consistent with looking down at an angle.

Rendering look: pre-rendered 3D sprite aesthetic rather than a
painterly illustration - smooth volumetric shading with a clear,
crisp light-to-shadow boundary (not a soft painterly blend), a
subtle specular highlight on any metal or leather surface, soft
self-shadowing where one part of the body shades another. Fixed
light direction from the upper-left in every single panel.

Same character as the reference image, identical clothing, colors
and proportions. Generate this as ONE single image containing
multiple separate panels, arranged in a clean layout with generous
empty space between panels so each one can be cropped out
individually afterward. No panel borders, no grid lines, no labels,
no text and no numbers anywhere in the image itself. Every panel
must share the exact same character scale/height and the exact same
ground point. Plain solid white background throughout.

Include exactly these panels, each fully separated:

1. Viewed from the front at the elevated 40-degree camera angle,
walking toward the viewer: captured at the "contact" moment of the
gait, legs maximally spread apart in a wide stance, the leg closer
to the RIGHT edge of the frame planted flat on the ground forward
with the heel down and knee slightly bent, the leg closer to the
LEFT edge of the frame stretched fully backward with only the toe
touching and the heel lifted high. The arm closer to the RIGHT
edge swings backward, the arm closer to the LEFT edge swings
forward - opposite to the legs. Body at the LOWEST point of its
vertical bob, close to the ground.

2. Viewed from the front at the elevated 40-degree camera angle,
walking toward the viewer: captured at the "passing" moment of the
gait, mid-transition: the leg closer to the LEFT edge of the frame
is swinging forward, its knee bent and lifted clearly off the
ground, passing close beside the other leg's shin; the leg closer
to the RIGHT edge is the single supporting leg, extended straight
and vertical beneath the body. The arm closer to the LEFT edge
swings backward, the arm closer to the RIGHT edge swings forward -
opposite to the legs. Body at the HIGHEST point of its vertical
bob, visibly raised above the contact-pose height, both feet
closer together beneath the body than in any other phase.

3. Viewed from the front at the elevated 40-degree camera angle,
walking toward the viewer: captured at the "contact" moment of the
gait, legs maximally spread apart in a wide stance, the leg closer
to the LEFT edge of the frame planted flat on the ground forward
with the heel down and knee slightly bent, the leg closer to the
RIGHT edge of the frame stretched fully backward with only the toe
touching and the heel lifted high. The arm closer to the LEFT edge
swings backward, the arm closer to the RIGHT edge swings forward -
opposite to the legs. Body at the LOWEST point of its vertical
bob, close to the ground.

4. Viewed from the front at the elevated 40-degree camera angle,
walking toward the viewer: captured at the "passing" moment of the
gait, mid-transition: the leg closer to the RIGHT edge of the
frame is swinging forward, its knee bent and lifted clearly off
the ground, passing close beside the other leg's shin; the leg
closer to the LEFT edge is the single supporting leg, extended
straight and vertical beneath the body. The arm closer to the
RIGHT edge swings backward, the arm closer to the LEFT edge swings
forward - opposite to the legs. Body at the HIGHEST point of its
vertical bob, visibly raised above the contact-pose height, both
feet closer together beneath the body than in any other phase.

Ultra-detailed but with reduced fine surface texture (small in-game
sprite). No cartoon ink outlines - rely on the rendered shading
described above instead. No watermark, no drop shadows connecting
panels. Hands must correctly and naturally interact with the
carrying strap, no clipping through the body.
```



### 21.7 Träger - Hinten, 4 Laufphasen


**Träger - Rückansicht, 4-Phasen-Laufzyklus v2 (mit Referenzbild)**
*(ergibt die Einzelbilder: traeger_hinten_1, _2, _3, _4)*
```
Camera: elevated oblique angle at roughly 40 degrees looking down
onto the character, matching the isometric camera used for the
game's buildings - not a flat frontal or eye-level view. We look
down onto the shoulders and the top of the head; the foot further
back in the stride sits visibly higher in the frame than the foot
further forward, consistent with looking down at an angle.

Rendering look: pre-rendered 3D sprite aesthetic rather than a
painterly illustration - smooth volumetric shading with a clear,
crisp light-to-shadow boundary (not a soft painterly blend), a
subtle specular highlight on any metal or leather surface, soft
self-shadowing where one part of the body shades another. Fixed
light direction from the upper-left in every single panel.

Same character as the reference image, identical clothing, colors
and proportions. Generate this as ONE single image containing
multiple separate panels, arranged in a clean layout with generous
empty space between panels so each one can be cropped out
individually afterward. No panel borders, no grid lines, no labels,
no text and no numbers anywhere in the image itself. Every panel
must share the exact same character scale/height and the exact same
ground point. Plain solid white background throughout.

Include exactly these panels, each fully separated:

1. Viewed from behind at the elevated 40-degree camera angle,
walking away from the viewer: captured at the "contact" moment of
the gait, legs maximally spread apart in a wide stance, the leg
closer to the RIGHT edge of the frame planted flat on the ground
forward with the heel down and knee slightly bent, the leg closer
to the LEFT edge of the frame stretched fully backward with only
the toe touching and the heel lifted high. The arm closer to the
RIGHT edge swings backward, the arm closer to the LEFT edge swings
forward - opposite to the legs. Body at the LOWEST point of its
vertical bob, close to the ground.

2. Viewed from behind at the elevated 40-degree camera angle,
walking away from the viewer: captured at the "passing" moment of
the gait, mid-transition: the leg closer to the LEFT edge of the
frame is swinging forward, its knee bent and lifted clearly off
the ground, passing close beside the other leg's shin; the leg
closer to the RIGHT edge is the single supporting leg, extended
straight and vertical beneath the body. The arm closer to the LEFT
edge swings backward, the arm closer to the RIGHT edge swings
forward - opposite to the legs. Body at the HIGHEST point of its
vertical bob, visibly raised above the contact-pose height, both
feet closer together beneath the body than in any other phase.

3. Viewed from behind at the elevated 40-degree camera angle,
walking away from the viewer: captured at the "contact" moment of
the gait, legs maximally spread apart in a wide stance, the leg
closer to the LEFT edge of the frame planted flat on the ground
forward with the heel down and knee slightly bent, the leg closer
to the RIGHT edge of the frame stretched fully backward with only
the toe touching and the heel lifted high. The arm closer to the
LEFT edge swings backward, the arm closer to the RIGHT edge swings
forward - opposite to the legs. Body at the LOWEST point of its
vertical bob, close to the ground.

4. Viewed from behind at the elevated 40-degree camera angle,
walking away from the viewer: captured at the "passing" moment of
the gait, mid-transition: the leg closer to the RIGHT edge of the
frame is swinging forward, its knee bent and lifted clearly off
the ground, passing close beside the other leg's shin; the leg
closer to the LEFT edge is the single supporting leg, extended
straight and vertical beneath the body. The arm closer to the
RIGHT edge swings backward, the arm closer to the LEFT edge swings
forward - opposite to the legs. Body at the HIGHEST point of its
vertical bob, visibly raised above the contact-pose height, both
feet closer together beneath the body than in any other phase.

Ultra-detailed but with reduced fine surface texture (small in-game
sprite). No cartoon ink outlines - rely on the rendered shading
described above instead. No watermark, no drop shadows connecting
panels. Hands must correctly and naturally interact with the
carrying strap, no clipping through the body.
```


---

## 22. 3D-Workflow (Alternative zur reinen Prompt-Route)

Grundidee: statt jede Pose als Bild zu erwürfeln, die Figur **einmal** als 3D-Modell erzeugen und daraus alle Richtungen und Laufphasen rendern - genau die Produktionstechnik der 90er-Aufbauspiele. Löst alle vier Probleme, an denen die Prompt-Route hängt: identische Figur in jedem Frame, exakt gleicher Kamerawinkel, gleicher Bodenpunkt, echter Beinwechsel.

### 22.1 Schritt 1 - Sauberes A-Pose-Bild als 3D-Input

Image-to-3D funktioniert am besten mit einer neutralen, symmetrischen Ausgangspose, nicht mit einer Laufpose. Also zuerst ein A-Pose-Bild des Trägers erzeugen (mit dem bestehenden Träger-Referenzbild als Vorlage):

```
Same character as the reference image - identical clothing, colors,
proportions and equipment. A SINGLE character standing in a neutral
A-pose: facing the camera straight on, body upright and symmetrical,
both feet flat on the ground shoulder-width apart, both arms hanging
straight down and angled slightly away from the body, palms facing
inward, head level and looking straight ahead, neutral expression.

Camera: straight-on front view at eye level, orthographic-looking,
no perspective distortion, no tilt.

Rendering: clean 3D character render, smooth volumetric shading, even
neutral lighting with no strong shadows, full body visible from head
to feet, isolated on a plain solid white background.

No text, no watermark, no props in the hands, no dynamic pose, no
cropping.
```

Falls das Tool eine Multi-View-Eingabe unterstützt: dasselbe nochmal als Rückansicht erzeugen und beide zusammen einspeisen - das verbessert die Rekonstruktion der Rückseite deutlich.

### 22.2 Schritt 2 - Bild zu 3D-Modell

Tool z. B. Meshy (Image to 3D) oder Tripo. Wichtig laut Meshy-Doku: in der Image-to-3D-Konfiguration die Pose-Option auf T-Pose bzw. A-Pose stellen bzw. Custom Pose Control mit Referenzbild nutzen, BEVOR generiert wird.

Zur Beruhigung: Die bei KI-generierten Meshes übliche Schwachstelle - unsaubere Topologie - ist in eurem Fall weitgehend egal. Ihr rendert das Modell nur zu 2D-Sprites; das Mesh selbst landet nie im Spiel. Was im gerenderten Bild gut aussieht, reicht.

### 22.3 Schritt 3 - Auto-Rigging

Meshy und Tripo riggen automatisch. Laut Meshy-Tutorial wichtig:
- Figur vor dem Riggen zentrieren, nach vorn ausrichten, Füße auf Bodenhöhe - sonst sitzt der Root-Bone falsch und die Animation ist versetzt
- Stark stilisierte Proportionen (großer Kopf, kurze Beine - also genau euer Fall) sind kein Hindernis; die Rigging-Punkte müssen aber an die tatsächlichen Gelenke gesetzt werden, nicht dorthin, wo sie bei normalen Proportionen wären
- Nach dem Riggen sofort eine Walk-Animation abspielen: Schulter- und Hüftfehler sieht man dort in zwei Sekunden

### 22.4 Schritt 4 - Laufanimation aus der Preset-Bibliothek

Meshy bringt laut eigenen Angaben 600+ Motion-Clips mit (Walk, Idle, Run u. a.). Walk-Preset auswählen - damit habt ihr einen anatomisch korrekten Zyklus inklusive Beinwechsel, Armschwung und vertikalem Bob, ohne dass irgendetwas davon per Text beschrieben werden muss.

### 22.5 Schritt 5 - Export und Rendering zu Sprites

Export als GLB/FBX. Für das Rendern zu 2D-Sprites:

- **Kamera**: orthographisch (nicht perspektivisch - sonst passen die Sprites nicht zur isometrischen Karte), Höhenwinkel ~40 Grad, in 5 Richtungen um die Figur (die übrigen 3 durch Spiegeln)
- **Licht**: fix von oben-links, in allen Renderings identisch - nicht mit der Kamera mitdrehen
- **Frames**: Laufzyklus gleichmäßig abtasten, z. B. 8 Frames pro Richtung; Frame-Anzahl ist jetzt frei wählbar, da sie nichts mehr kostet
- **Ausgabe**: PNG mit Alphakanal, gleiche Bildgröße und gleicher Bodenpunkt in allen Frames (ergibt sich beim Rendern automatisch, wenn Kamera und Figur-Root fix bleiben)

Werkzeuge: Blender (kostenlos) für volle Kontrolle, oder der kostenlose Open-Source "Sprite Builder" (MIT-Lizenz), der GLB-Modelle mit Animationssequenzen im Batch als 2D-Sprites exportiert.

### 22.6 Schritt 6 - Restliche Figuren

Pro Figur denselben Ablauf. Der Schmalzpunkt: Rig und Animationen lassen sich zwischen ähnlich proportionierten Figuren oft wiederverwenden - die 12 verbleibenden Menschen-Figuren teilen sich denselben Körperbau, es ändern sich nur Kleidung und Ausrüstung.

### 22.7 Was diese Route besser und was sie schlechter macht

Besser: exakte Posen-Kontrolle, perfekte Konsistenz, beliebig viele Frames und Richtungen zum Nulltarif, Aktionen (Wurf, Hieb, Arbeitsbewegung) über dieselbe Preset-Bibliothek statt über neue Prompt-Experimente.

Schlechter: einmalige Einarbeitung in ein 3D-Tool, und der Look des 3D-Modells wird nie zu 100 Prozent dem gefeilten 2D-Bild entsprechen - AI-Rekonstruktionen interpretieren verdeckte Seiten. Deshalb: erst den Träger komplett durchspielen und das Ergebnis anschauen, bevor die anderen 12 Figuren folgen.

---

## 23. Text-zu-3D-Prompts für Tripo (übrige Figuren im Träger-Stil)

Alle Prompts unten sind fertig zum direkten Einsetzen in Tripo (Text-to-3D). Jeder enthält denselben Stil-Block (Chibi-Proportionen, großer Kopf, große Nase, einfache Formen) wie der fertige Träger, denselben A-Pose-Block fürs anschließende Auto-Rigging, und die figurenspezifische Kleidung/Ausrüstung.


### 23.1 Wichtige Hinweise vorab


- **A-Pose ist Pflicht**, nicht Kosmetik: Ohne neutrale, symmetrische Ausgangspose scheitert oder verzerrt das Auto-Rigging. Steht in jedem Prompt drin.
- **Mehrspieler-Farben nicht 6x generieren**: Umhang und Helmbusch sind in den Prompts bewusst als einzelne, flache, gleichmäßige Farbfläche ohne Muster oder Verlauf beschrieben. So könnt ihr die Farbe später im Spiel per Shader-Tint oder Textur-Tausch umfärben (Rot/Gelb/Grün/Orange/Rosa), statt jede Figur sechsmal zu erzeugen. Generiert wird immer die Einzelspieler-Variante in Königsblau.
- **Stil-Konsistenz**: Text-zu-3D trifft den Träger-Stil nur näherungsweise. Zuverlässiger wäre der Umweg über Bilder (siehe 23.3) - euer Bild-Referenz-Workflow hat sich ja bereits als sehr konsistenzstark erwiesen.
- **Werkzeuge in der Hand** können das Auto-Rigging stören. Falls eine Figur schlecht riggt: dieselbe Figur ohne Werkzeug generieren, riggen, und das Werkzeug später in Blender an den Hand-Bone hängen.


### 23.2 Die Prompts


**Schwertkämpfer** (`unit_sword`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing
layered leather-and-metal armor over a simple tunic, and a long
flowing ancient-style cloak in ROYAL BLUE fastened at both shoulders
and hanging down the back. On his head a Roman-style helmet with
hinged cheek guards and a chin strap, topped with a tall ROYAL BLUE
crest brush running front to back along the crown. The cloak and the
helmet crest are both a single flat uniform royal blue with no pattern
or gradient. He holds a short broad sword in one hand, pointing
downward, and a round wooden shield with a metal boss in the other
hand. Standing in a neutral A-pose: facing forward, upright and
symmetrical, both feet flat on the ground shoulder-width apart, both
arms hanging down and angled slightly away from the body, head level
looking straight ahead.
```

**Speerkämpfer** (`unit_spear`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing
layered leather-and-metal armor over a simple tunic, and a long
flowing ancient-style cloak in ROYAL BLUE fastened at both shoulders
and hanging down the back. On his head a Roman-style helmet with
hinged cheek guards and a chin strap, topped with a tall ROYAL BLUE
crest brush running front to back along the crown. The cloak and the
helmet crest are both a single flat uniform royal blue with no pattern
or gradient. He holds a long wooden spear with a leaf-shaped steel
spearhead upright in one hand, and a round wooden shield with a metal
boss in the other hand. Standing in a neutral A-pose: facing forward,
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging down and angled slightly away from the body,
head level looking straight ahead.
```

**Bogenschütze** (`unit_bow`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing
layered leather-and-metal armor over a simple tunic, and a long
flowing ancient-style cloak in ROYAL BLUE fastened at both shoulders
and hanging down the back. On his head a Roman-style helmet with
hinged cheek guards and a chin strap, topped with a tall ROYAL BLUE
crest brush running front to back along the crown. The cloak and the
helmet crest are both a single flat uniform royal blue with no pattern
or gradient. He holds a wooden longbow in one hand and wears a quiver
full of arrows strapped to his back. Standing in a neutral A-pose:
facing forward, upright and symmetrical, both feet flat on the ground
shoulder-width apart, both arms hanging down and angled slightly away
from the body, head level looking straight ahead.
```

**Generischer Siedler** (`unit_worker`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing a
simple rough wool cap, a plain work tunic with rolled-up sleeves, a
wide leather belt, simple trousers and sturdy leather boots. Empty
hands, no weapons, no armor. Standing in a neutral A-pose: facing
forward, upright and symmetrical, both feet flat on the ground
shoulder-width apart, both arms hanging down and angled slightly away
from the body, head level looking straight ahead.
```

**Geologe** (`unit_geo`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing a
wide-brimmed traveling hat, a simple traveling cloak over a work
tunic, a leather belt with a small pouch, and sturdy boots. He holds a
small geologist's hammer in one hand. Standing in a neutral A-pose:
facing forward, upright and symmetrical, both feet flat on the ground
shoulder-width apart, both arms hanging down and angled slightly away
from the body, head level looking straight ahead.
```

**Holzfäller** (`unit_woodcutter`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing a
simple wool cap, a rough work tunic with rolled-up sleeves, a leather
belt and sturdy boots. He holds a woodcutter's axe with a wooden
handle in one hand. Standing in a neutral A-pose: facing forward,
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging down and angled slightly away from the body,
head level looking straight ahead.
```

**Förster** (`unit_forester`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing a
soft green cap, a simple green-brown work tunic, a leather belt and
sturdy boots. He holds a young potted tree sapling in one hand and a
small planting spade in the other. Standing in a neutral A-pose:
facing forward, upright and symmetrical, both feet flat on the ground
shoulder-width apart, both arms hanging down and angled slightly away
from the body, head level looking straight ahead.
```

**Steinmetz** (`unit_quarry`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing a
simple cloth cap, a heavy leather work apron over a tunic, a leather
belt and sturdy boots. He holds a stone chisel in one hand and a
wooden mallet in the other. Standing in a neutral A-pose: facing
forward, upright and symmetrical, both feet flat on the ground
shoulder-width apart, both arms hanging down and angled slightly away
from the body, head level looking straight ahead.
```

**Fischer** (`unit_fisher`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing a
simple knitted cap, a work tunic with rolled-up sleeves, a leather
belt and tall boots. He holds a long wooden fishing rod in one hand
and a small woven fish basket in the other. Standing in a neutral
A-pose: facing forward, upright and symmetrical, both feet flat on the
ground shoulder-width apart, both arms hanging down and angled
slightly away from the body, head level looking straight ahead.
```

**Jäger** (`unit_hunter`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing a
fur-trimmed cap, a leather-and-fur hunting jerkin over a tunic, a
leather belt and tall boots. He holds a short hunting crossbow in one
hand. Standing in a neutral A-pose: facing forward, upright and
symmetrical, both feet flat on the ground shoulder-width apart, both
arms hanging down and angled slightly away from the body, head level
looking straight ahead.
```

**Bauer** (`unit_farm`)
```
Stylized cartoon 3D game character, chibi proportions with an
oversized round head roughly one third of the total body height, a big
bulbous nose, small friendly eyes, thick eyebrows, sturdy short arms
and legs, chunky simple shapes with minimal fine surface detail.
Smooth matte surfaces, muted earthy medieval color palette. Wearing a
wide straw hat, a simple linen tunic, a rope belt and worn boots. He
holds a wooden pitchfork upright in one hand. Standing in a neutral
A-pose: facing forward, upright and symmetrical, both feet flat on the
ground shoulder-width apart, both arms hanging down and angled
slightly away from the body, head level looking straight ahead.
```


### 23.3 Alternative für maximale Stil-Treue: über Bilder statt Text

Statt Text-zu-3D: für jede Figur zuerst ein A-Pose-BILD mit dem A-Pose-Prompt aus §22.1 erzeugen und den fertigen Träger als Referenzbild mitgeben (im Prompt dann die Kleidung/Ausrüstung der jeweiligen Figur beschreiben statt der des Trägers). Dieses Bild anschließend in Tripo per Image-to-3D verarbeiten. Ein Zwischenschritt mehr, dafür sitzen Proportionen, Gesicht und Stil deutlich näher am Träger - der Bild-Referenz-Weg war in euren bisherigen Tests genau die Stärke, die Text allein nicht liefert.

---

## 24. A-Pose-Bildprompts für gpt-image-2 (Input für Tripo Image-to-3D)

Fertige Prompts für die übrigen Figuren. Ablauf pro Figur: Prompt unten + passendes Referenzbild in gpt-image-2 -> A-Pose-Bild -> in Tripo per Image-to-3D -> Auto-Rig -> Walk-Preset -> ins Spiel, genau wie beim Träger.


### 24.1 Welches Referenzbild wozu


- **Speerkämpfer, Bogenschütze**: den fertigen **Schwertkämpfer** als Referenz - Rüstung, Umhang, Helm und Farben sind dort schon richtig, es ändert sich nur die Waffe.
- **Alle zivilen Berufe**: den fertigen **Träger** als Referenz - dort geht es um Stil, Proportionen und Gesichtsdesign, die Kleidung wird im Prompt neu beschrieben.
- Werkzeuge hängen in allen Prompts locker seitlich herunter, damit die A-Pose fürs Auto-Rigging erhalten bleibt.
- Falls eine Figur schlecht riggt: dieselbe ohne Werkzeug erzeugen und das Werkzeug später in Blender an den Hand-Bone hängen.
- Optional für bessere 3D-Rekonstruktion: denselben Prompt nochmal mit "seen from directly behind" statt "straight-on front view" laufen lassen und beide Bilder zusammen in Tripo einspeisen.


### 24.2 Die Prompts


**Speerkämpfer** (`unit_spear`) - Referenzbild: Schwertkämpfer
```
Same character design as the reference image - identical armor,
ancient-style royal blue cloak, Roman-style helmet with cheek guards
and royal blue crest brush, identical colors, proportions, face style
and art style. Only the weapon differs: he holds a long wooden spear
with a leaf-shaped steel spearhead vertically at his side, and a round
wooden shield with a metal boss in the other hand.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Bogenschütze** (`unit_bow`) - Referenzbild: Schwertkämpfer
```
Same character design as the reference image - identical armor,
ancient-style royal blue cloak, Roman-style helmet with cheek guards
and royal blue crest brush, identical colors, proportions, face style
and art style. Only the weapon differs: he holds a wooden longbow
vertically at his side and wears a quiver full of arrows strapped to
his back.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Generischer Siedler** (`unit_worker`) - Referenzbild: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple rough wool cap, a plain work tunic
with rolled-up sleeves, a wide leather belt, simple trousers and
sturdy leather boots. Empty hands, no bag, no weapons, no armor.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Geologe** (`unit_geo`) - Referenzbild: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a wide-brimmed traveling hat, a simple
traveling cloak over a work tunic, a leather belt with a small pouch,
and sturdy boots. He holds a small geologist's hammer at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Holzfäller** (`unit_woodcutter`) - Referenzbild: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple wool cap, a rough work tunic with
rolled-up sleeves, a leather belt and sturdy boots. He holds a
woodcutter's axe with a wooden handle at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Förster** (`unit_forester`) - Referenzbild: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a soft green cap, a simple green-brown work
tunic, a leather belt and sturdy boots. He holds a small planting
spade at his side and carries a young tree sapling in the other hand.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Steinmetz** (`unit_quarry`) - Referenzbild: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple cloth cap, a heavy leather work apron
over a tunic, a leather belt and sturdy boots. He holds a wooden
mallet at his side and a stone chisel in the other hand.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Fischer** (`unit_fisher`) - Referenzbild: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple knitted cap, a work tunic with rolled-
up sleeves, a leather belt and tall boots. He holds a long wooden
fishing rod vertically at his side and a small woven fish basket in
the other hand.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Jäger** (`unit_hunter`) - Referenzbild: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a fur-trimmed cap, a leather-and-fur hunting
jerkin over a tunic, a leather belt and tall boots. He holds a short
hunting crossbow at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Bauer** (`unit_farm`) - Referenzbild: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a wide straw hat, a simple linen tunic, a rope
belt and worn boots. He holds a wooden pitchfork vertically at his
side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```


### 24.3 Schaf (Vierbeiner, Sonderfall)


**Schaf** (`deco_sheep`) - Referenzbild: Träger (nur für Stil/Rendering)
```
Same art style and rendering as the reference image, but a different
subject: a stylized cartoon 3D sheep with a fluffy cream-white fleece,
a small dark face, short sturdy legs and small ears. Chunky simple
shapes with minimal fine surface detail, smooth matte surfaces.

Standing in a neutral rest pose: seen from the side, body level and
symmetrical, all four legs straight and evenly planted on the ground,
head raised and looking forward, not grazing.

Camera: straight-on side view at eye level, no perspective distortion,
no tilt. Full body visible including all four legs.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping.
```


Beim Riggen in Tripo als Quadruped auswählen, nicht als Humanoid.

---

## 25. A-Pose-Bildprompts für die vollständige Figurenliste (Stand: 30 Assets)

Ersetzt §23/§24 - richtet sich exakt nach eurer aktuellen Liste. Nicht enthalten: Träger (#1) und Schwertkämpfer (#4), die sind fertig. Ablauf pro Figur unverändert: Prompt + Referenzbild in gpt-image-2 -> A-Pose-Bild -> Tripo Image-to-3D -> Auto-Rig -> Animationen.


### 25.1 Referenzbild-Zuordnung


- **#5 Speerkämpfer, #6 Bogenschütze**: den fertigen **Schwertkämpfer** als Referenz (Rüstung, Umhang, Helm, Farben sitzen dort schon).
- **#2, #3, #7-#27**: den fertigen **Träger** als Referenz (Stil, Proportionen, Gesichtsdesign; Kleidung wird im Prompt neu beschrieben).
- **#28 Esel, #29 Schaf**: Träger nur als Stil-/Render-Referenz, beim Riggen in Tripo als **Quadruped** wählen, nicht Humanoid.
- **#30 Schiff**: statisches Objekt, kein Rigging, keine A-Pose.
- **#13 Jäger** bekommt bewusst KEINE Soldatenrüstung (Fellweste, ziviler Bogen), damit er im Spiel nicht mit dem Bogenschützen verwechselt wird.
- **#23 Bergmann** deckt laut eurer Liste alle vier Bergwerke ab - ein Modell, kein Farb-/Werkzeugunterschied nötig.


### 25.2 Gemeinsamer Schlussblock (steht in jedem Figuren-Prompt unten schon drin)


```
Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```


### 25.3 Die Prompts (vollständig, copy-paste-fertig)


**#2 Bauarbeiter** (`bauarbeiter.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple cloth cap, a sturdy work tunic with
rolled-up sleeves, a leather tool belt and worn boots. He holds a
carpenter's hammer at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#3 Planierer** (`planierer.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple wool cap, a rough work tunic with
rolled-up sleeves, a wide leather belt and muddy boots. He holds a
long-handled wooden shovel vertically at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#5 Speerkämpfer** (`speerkaempfer.glb`) - Referenz: Schwertkämpfer
```
Same character design as the reference image - identical armor,
ancient-style royal blue cloak, Roman-style helmet with cheek guards
and royal blue crest brush, identical colors, proportions, face style
and art style. Only the equipment differs: he holds a long wooden
spear with a leaf-shaped steel spearhead vertically at his side, and a
small round buckler shield strapped to his other forearm.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#6 Bogenschütze** (`bogenschuetze.glb`) - Referenz: Schwertkämpfer
```
Same character design as the reference image - identical armor,
ancient-style royal blue cloak, Roman-style helmet with cheek guards
and royal blue crest brush, identical colors, proportions, face style
and art style. Only the equipment differs: he holds a wooden longbow
vertically at his side and wears a quiver full of arrows strapped to
his back.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#7 Geologe** (`geologe.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a wide-brimmed traveling hat, a simple
traveling coat over a work tunic, and sturdy boots, with a leather
satchel slung across his chest. He holds a pickaxe vertically at his
side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#8 Späher** (`spaeher.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a soft pointed hat with a single long feather,
a light green traveling tunic, a leather belt and light boots, with a
small bedroll and a small leather pack strapped to his back. Empty
hands.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#9 Holzfäller** (`holzfaeller.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple wool cap, a rough work tunic with
rolled-up sleeves, a leather belt and sturdy boots. He holds a
woodcutter's axe with a wooden handle at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#10 Steinmetz** (`steinmetz.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple cloth cap, a heavy leather work apron
over a tunic, a leather belt and sturdy boots. He holds a stone
pickaxe at his side and a chisel in the other hand.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#11 Bauer** (`bauer.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a wide straw hat, a simple linen tunic, a rope
belt and worn boots, with a cloth seed bag slung across his chest. He
holds a long-handled scythe vertically at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#12 Fischer** (`fischer.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple knitted cap, a work tunic with rolled-
up sleeves, a leather belt and tall boots. He holds a bundled fishing
net at his side and a long wooden fishing rod in the other hand.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#13 Jäger** (`jaeger.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a fur-trimmed cap and a fur vest over a leather
tunic, a leather belt and tall boots. He holds a wooden hunting bow
vertically at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#14 Förster** (`foerster.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a soft green cap, a simple green-brown work
tunic, a leather belt and sturdy boots. He holds a planting spade at
his side and a young tree sapling in the other hand.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#15 Waffenschmied** (`schmied.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a heavy dark leather apron over a soot-stained
tunic with rolled-up sleeves, thick gloves and sturdy boots, with iron
tongs and a small hammer hanging from his belt. Empty hands.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#16 Werkzeugschmied** (`werkzeugschmied.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a brown leather apron over a work tunic with
rolled-up sleeves and sturdy boots, with a wide tool belt holding
files, pliers and small tools. Empty hands.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#17 Goldschmied/Münzer** (`goldschmied.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a fine dark red tunic with embroidered trim, a
soft cap, a narrow belt and neat leather shoes, with a small coin
pouch on his belt. He holds a small balance scale at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#18 Bäcker** (`baecker.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a white cloth cap and a white apron over a
light tunic with rolled-up sleeves, and simple shoes. He holds a long
wooden bread peel vertically at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#19 Metzger** (`metzger.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple cloth cap and a heavy apron over a
tunic with rolled-up sleeves, and sturdy boots. He holds a broad
butcher's cleaver at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#20 Müller** (`mueller.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a light cloth cap and pale flour-dusted
clothing, a rope belt and simple shoes. He carries a small sack of
flour under one arm.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#21 Brauer** (`brauer.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple cap and a broad leather apron over a
work tunic with rolled-up sleeves, and sturdy boots. He holds a long-
handled wooden ladle at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#22 Hüttenarbeiter** (`huettenarbeiter.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a thick leather cap, heavy leather shoulder
protection and a leather apron over a soot-stained tunic, thick gloves
and heavy boots. He holds a long-handled casting ladle vertically at
his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#23 Bergmann** (`bergmann.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a leather miner's cap with a small oil lamp
mounted on the front, a rough work tunic, a wide leather belt and
sturdy boots. He holds a pickaxe vertically at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#24 Schweinehirt** (`schweinehirt.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a wide straw hat, a simple worn tunic, a rope
belt and muddy boots. He holds a long wooden herding staff vertically
at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#25 Eselhirt** (`eselhirt.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a wide straw hat, a simple travel tunic, a
leather belt and sturdy boots. He holds a coiled leading rope at his
side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#26 Werftarbeiter** (`werftarbeiter.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple cloth cap, a carpenter's tunic with
rolled-up sleeves, a leather tool belt with wood shavings, and sturdy
boots. He holds a hand saw at his side and a wooden plane in the other
hand.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**#27 Dorfbewohner** (`siedler.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing plain simple everyday clothing: a soft cap, an
undyed tunic, a rope belt and simple shoes. Empty hands, no tools, no
bag.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```


### 25.4 Tiere und Schiff


**#28 Esel** (`esel.glb`) - Referenz: Träger (nur Stil), Rigging: Quadruped
```
Same art style and rendering as the reference image, but a different
subject: a stylized cartoon 3D donkey with a grey-brown coat, a
lighter muzzle and belly, long ears, a short dark mane and short
sturdy legs. It carries a pair of woven pack baskets strapped over its
back. Chunky simple shapes with minimal fine surface detail, smooth
matte surfaces.

Standing in a neutral rest pose: seen from the side, body level and
symmetrical, all four legs straight and evenly planted on the ground,
head raised and looking forward.

Camera: straight-on side view at eye level, no perspective distortion,
no tilt. Full body visible including all four legs.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping.
```

**#29 Schaf** (`schaf.glb`) - Referenz: Träger (nur Stil), Rigging: Quadruped
```
Same art style and rendering as the reference image, but a different
subject: a stylized cartoon 3D sheep with a thick fluffy cream-white
fleece, a small dark face, small ears and short sturdy legs. Chunky
simple shapes with minimal fine surface detail, smooth matte surfaces.

Standing in a neutral rest pose: seen from the side, body level and
symmetrical, all four legs straight and evenly planted on the ground,
head raised and looking forward, not grazing.

Camera: straight-on side view at eye level, no perspective distortion,
no tilt. Full body visible including all four legs.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping.
```

**#30 Schiff** (`schiff.glb`) - Referenz: Träger (nur Stil), kein Rigging
```
Same art style and rendering as the reference image, but a different
subject: a stylized cartoon 3D single-masted medieval merchant ship. A
stout wooden hull with visible plank lines and a curved bow and stern,
a single central mast with a furled square sail on a horizontal yard,
simple rigging ropes, a small raised deck at the stern with a tiller,
and a few wooden crates and barrels lashed on deck. Chunky simple
shapes with minimal fine surface detail, smooth matte surfaces, warm
brown timber tones with a plain undyed sail.

Seen from a three-quarter side angle, floating level, the whole ship
visible from bow to stern including the top of the mast.

Camera: three-quarter view at eye level, no perspective distortion, no
tilt.

Rendering: clean stylized 3D asset render, smooth volumetric shading,
even neutral lighting with no strong shadows, isolated on a plain
solid white background.

No water, no waves, no crew, no flags, no text, no watermark, no
cropping.
```

---

## 26. Cartoon-Stil für ALLE Assets + fehlende Elemente

Zwei Dinge in diesem Abschnitt: (1) der universelle Cartoon-Stilblock, mit dem sich jeder bestehende Prompt aus §15/§16 auf den neuen Look umstellen lässt, und (2) fertige Prompts für die Elemente, die laut eurer Liste noch fehlen.


### 26.1 Der Stilbruch - Entscheidung nötig


Die mit ✓ markierten Gebäude, Terrains, Waren und Icons stammen aus dem alten fotorealistisch-malerischen Stil (§15/§16). Die Figuren sind seit dem Träger Cartoon. Beides zusammen auf einer Karte wirkt uneinheitlich. Drei Möglichkeiten:

- **Alles neu im Cartoon-Stil**: stimmigster Look, aber ~100 Assets nochmal. Mit dem Stilblock unten ist das mechanische Arbeit, kein neues Konzept.
- **Schrittweise**: zuerst das, was am häufigsten und größten im Bild ist (Wohnhäuser, Hauptquartier, Bäume, Wiese, Kopfsteinpflaster), den Rest später. Der Bruch fällt am wenigsten bei kleinen Waren-Icons auf.
- **Nur Neues im Cartoon-Stil**: schnellster Weg, aber der Bruch bleibt.

Empfehlung: schrittweise, in der Reihenfolge Sichtbarkeit. Terrain und Wohnhäuser füllen den Bildschirm, ein Waren-Icon ist 16 Pixel groß.


### 26.2 Universeller Cartoon-Stilblock


Ersetzt in jedem Prompt aus §15/§16 die alte Stil-Sprache ("photorealistic", "painterly realism", "PBR materials", "ultra-detailed 8K" usw.):

```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.
```

Dazu je nach Asset-Typ einer dieser Schlussblöcke:

**Gebäude und Kartenobjekte:**
```
Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**Terrain-Kacheln:**
```
Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**Waren-/HUD-Icons:**
```
Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```


### 26.3 Fehlende Gebäude


**#23 Werkzeugschmiede** (`bld_toolsmith`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A medieval toolsmith's workshop:
a timber-framed building with an open work bay at the front, a small
stone chimney with a glowing forge opening, an anvil and a rack of
finished tools (files, pliers, saws) visible under the awning, stacked
iron bars beside the door.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#24 Eselzucht** (`bld_donkeyfarm`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A medieval donkey farm: a low
timber stable building with a wide open doorway and a thatched roof,
an attached fenced paddock with a wooden feeding trough and a water
bucket, bales of straw stacked against the outside wall.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#25 Hafen** (`bld_harbor`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small medieval harbor: a wooden
pier on stilts extending over the water, a timber warehouse building
at the landward end with wide double doors, mooring posts with coiled
ropes, stacked crates and barrels on the dock, a crane arm for
loading.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#26 Werft** (`bld_shipyard`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A medieval shipyard: an open
timber-framed boathouse with a pitched roof over a slipway leading
down to the water, a partly built wooden boat hull on wooden supports
inside, stacked planks and beams, a sawhorse and shipwright's tools
beside it.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```


### 26.4 Fehlende Terrain-Texturen


**#65 Lava** (`ter_lava`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A volcanic ground texture of
cracked dark basalt rock with glowing orange and yellow lava running
through the fissures, subtle ember glow.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#64 Wasser (optional)** (`ter_water`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A calm water surface texture in
clear blue-green tones with gentle stylized ripple patterns and soft
light reflections.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```


### 26.5 Fehlende Objekte und Waren


**#53 Geologen-Schild Kohle** (`sign_coal`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small wooden signpost stuck
upright in a patch of ground, its square board carved and painted with
a simple black coal lump symbol.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#125 Hammer (Ware)** (`good_hammer`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single blacksmith's hammer with
a wooden handle and an iron head, lying at a slight angle.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```


### 26.6 Titelbild und Dialog-Grafiken


**#151 Titelbildschirm / Key-Art**
```
Stylized cartoon illustration for a medieval settlement-building game
title screen: a warm golden-hour view over a small thriving village in
a green valley - timber-framed cottages with thatched roofs, a
windmill on a hill, winding cobblestone paths, tiny settlers at work,
a river and a forest, distant mountains on the horizon. Chunky
simplified shapes with rounded edges, smooth matte surfaces, soft
volumetric shading, warm inviting earthy color palette, charming and
slightly exaggerated proportions.

Wide landscape composition with generous empty sky in the upper third
for a title to be placed later. Cinematic depth, soft atmospheric haze
in the distance.

No text, no title, no logo, no lettering, no watermark, no UI
elements.
```

**#153 Sieg-Dialog**
```
Stylized cartoon illustration for a victory screen in a medieval
settlement-building game: a cheerful crowd of chubby big-nosed cartoon
villagers celebrating in a village square - raised arms, colorful
banners on poles, a garland strung between houses, warm golden
sunlight. Chunky simplified shapes with rounded edges, smooth matte
surfaces, soft volumetric shading, warm bright color palette.

Wide landscape composition with empty space in the center for a
message to be placed later.

No text, no lettering, no watermark, no UI elements.
```

**#153 Niederlage-Dialog**
```
Stylized cartoon illustration for a defeat screen in a medieval
settlement-building game: a quiet, subdued village at dusk under a
grey overcast sky - a few chubby big-nosed cartoon villagers standing
with lowered heads, a fallen banner on the ground, cold muted blue-
grey color palette, soft rain in the air. Still gentle and stylized,
not grim or violent.

Wide landscape composition with empty space in the center for a
message to be placed later.

No text, no lettering, no watermark, no UI elements, no destruction,
no fire, no injured characters.
```


Zu #152 (Story-Tafeln der 10 Missionen): dafür bräuchte ich pro Mission eine kurze Inhaltsangabe - sag Bescheid, dann baue ich die zehn Prompts.


### 26.7 Was KEIN Bild braucht

Alle mit 🔧 markierten Punkte macht euer Spiel prozedural (Wellengang, Gebietsgrenzen, Wegsaum, Baum-Wachstumsstufen, Bau-Vorschau, Minimap, Wolkenschatten, Zzz-Symbol, Vögel usw.) - dafür sind keine Prompts nötig. Ebenso #49-51 (Felder), #150 (Baumenü-Icons) und die Baustellen-Varianten #39, die laut eurer Liste bereits bereitliegen bzw. bewusst generisch bleiben.

---

## 27. VOLLSTÄNDIGE Asset-Liste im Cartoon-Stil (ersetzt §15/§16/§26.3-26.5)

Jeder Prompt unten ist komplett zusammengesetzt und direkt einsetzbar. Gemeinsame Bausteine sind in jedem Prompt bereits enthalten - nichts mehr zusammenzukopieren. Für die Figuren gilt weiterhin §25 (A-Pose-Bilder für Tripo), für Titel-/Dialogbilder §26.6.


### 27.1 Gebäude (38)


**#1 Hauptquartier** (`bld_hq`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A large fortified castle
headquarters with thick stone walls, three round corner towers with
slate-grey conical roofs, a raised wooden drawbridge over a small moat, a
carved shield emblem above the gate, and plain undyed flat banners on the
battlements.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#2 Lagerhaus** (`bld_storehouse`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A large sturdy timber warehouse
with wide double doors standing open, a steep shingled roof, an
external staircase to a loft hatch, and stacked crates and barrels
visible just inside the doorway.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#3 Holzfäller** (`bld_woodcutter`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small rustic woodcutter's hut
built of rough-hewn logs with a mossy plank roof, an axe embedded in a
chopping block outside, and a neat stack of freshly cut logs against
the wall.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#4 Förster** (`bld_forester`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small timber forester's hut
with a green mossy roof, young tree saplings in wooden pots lined up
beside the door, a watering can and a planting spade leaning against
the wall.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#5 Sägewerk** (`bld_sawmill`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A timber sawmill building with a
large exposed circular saw blade at the open front bay, a stack of raw
logs on one side and neatly cut planks on the other, sawdust piled on
the ground.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#6 Steinmetz** (`bld_quarry`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. An open stonemason's yard cut
into a rocky outcrop, with a timber shelter roof over a stone-cutting
area, a half-carved block on a work table, chisels and mallets, and
stacked cut stone blocks.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#7 Fischerhütte** (`bld_fisher`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small wooden fisherman's hut
raised on stilts at the water's edge, with a thatched roof, a fishing
net hung out to dry on a frame, and a small rowboat moored beneath the
stilts.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#8 Jägerhütte** (`bld_hunter`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small rustic hunter's lodge of
timber and stone with animal hides stretched on a drying frame
outside, a hunting bow leaning by the door, and antlers mounted above
the entrance.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#9 Brunnen** (`bld_well`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small round stone well with a
peaked wooden roof, a hand crank with a rope, and a wooden bucket
hanging over the opening.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#10 Bauernhof** (`bld_farm`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A timber-framed farmhouse with a
thatched roof and an attached barn, a small fenced vegetable patch, a
hay cart parked beside it and a pitchfork stuck in a hay pile.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#11 Mühle** (`bld_mill`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round stone windmill tower with
a white plaster upper section, a conical wooden cap, and four large
wooden sail blades on the front. Sacks of grain stacked at the base.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#12 Bäckerei** (`bld_bakery`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A stone and timber bakery with a
large domed clay oven bulging from one side, a tall chimney with a
warm glow at the opening, sacks of flour stacked outside and bread
cooling on a window ledge.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#13 Schweinezucht** (`bld_pigfarm`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A rustic timber pig sty with a
low thatched roof, an attached fenced muddy paddock with a wooden
feeding trough and a water bucket, straw scattered on the ground.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#14 Schlachterei** (`bld_butcher`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A timber butcher's building with
an open shuttered window at the front, a heavy wooden chopping block
outside with a cleaver in it, and cured sausages hanging under the
awning.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#15 Brauerei** (`bld_brewery`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A stone brewery building with a
stout chimney, large wooden barrels stacked in a pyramid outside, a
brewing vat visible through the open door and a wooden ladle hanging
by the entrance.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#16 Kohlebergwerk** (`bld_coalmine`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A timber-framed mine entrance
built into a rocky hillside with heavy support beams, a small wooden
cart on rails at the mouth, and dark coal dust staining the ground and
a heap of coal beside it.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#17 Eisenbergwerk** (`bld_ironmine`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A timber-framed mine entrance
built into a rocky hillside with heavy support beams, a small wooden
ore cart on rails, and reddish-brown iron ore chunks heaped beside the
entrance.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#18 Goldbergwerk** (`bld_goldmine`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A timber-framed mine entrance
built into a rocky hillside with heavy support beams, a small wooden
ore cart on rails, and glinting golden ore fragments heaped beside the
entrance.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#19 Steinbergwerk** (`bld_granitemine`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. An open granite quarry cut into a
rocky hillside with a timber crane arm, a cut rock face with visible
chisel steps, and neatly stacked square granite blocks.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#20 Eisenhütte** (`bld_smelter`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A stone iron smelter with a tall
wide chimney, a glowing orange furnace opening at the front, a bellows
on one side, and iron bars stacked on a wooden rack.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#21 Münzprägerei** (`bld_mint`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A neat stone mint building with a
small chimney, a reinforced iron-banded door, a barred window, and a
small wooden chest with gold coins spilling out beside the entrance.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#22 Waffenschmiede** (`bld_armory`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A stone weapon smithy with a
glowing forge opening, an anvil under an open front awning, and racks
of swords, spears and shields lined up along the outside wall.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#23 Werkzeugschmiede** (`bld_toolsmith`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A medieval toolsmith's workshop:
a timber-framed building with an open work bay at the front, a small
stone chimney with a glowing forge opening, an anvil and a rack of
finished tools (files, pliers, saws) under the awning, stacked iron
bars beside the door.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#24 Eselzucht** (`bld_donkeyfarm`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A low timber donkey stable with a
wide open doorway and a thatched roof, an attached fenced paddock with
a wooden feeding trough and a water bucket, straw bales stacked
against the outside wall.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#25 Hafen** (`bld_harbor`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small medieval harbor: a wooden
pier on stilts extending over the water, a timber warehouse at the
landward end with wide double doors, mooring posts with coiled ropes,
stacked crates and barrels on the dock, and a simple loading crane
arm.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#26 Werft** (`bld_shipyard`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A medieval shipyard: an open
timber-framed boathouse with a pitched roof over a slipway leading
down to the water, a partly built wooden boat hull on supports inside,
stacked planks and beams, a sawhorse and shipwright's tools.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#27 Baracke** (`bld_barracks`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A simple timber barracks building
with a shingled roof, enclosed by a sturdy wooden palisade wall with a
gate, a small watch platform at one corner, and a banner pole by the
entrance.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#28 Wachhaus** (`bld_guardhouse`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A compact square stone guardhouse
with a small slate-grey pitched roof, a narrow arched doorway, arrow slit
windows, and a plain undyed flat banner on the roof ridge.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#29 Wachturm** (`bld_watchtower`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A tall narrow round stone
watchtower with a slate-grey conical roof, a small railed lookout platform
near the top, arrow slit windows, and a banner pole at the peak.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#30 Festung** (`bld_fortress`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A massive square stone fortress
with crenellated battlements, four corner turrets with slate-grey roofs, a
heavy iron-banded gate, and plain undyed flat banners along the walls.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#31 Katapult** (`bld_catapult`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A wooden catapult siege engine on
a heavy timber frame with large wooden wheels, a taut twisted-rope
torsion mechanism, a throwing arm with a bucket, and a stone ball
resting beside it.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#32 Kapelle** (`bld_chapel`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small stone chapel with a steep
shingled roof, a little wooden bell tower with a visible bell, a
rounded arched door, and small colorful stained-glass windows.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#33 Zehntscheune** (`bld_tithebarn`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A large timber tithe barn with a
very steep thatched roof reaching almost to the ground, tall wide
doors standing open, and stacked grain sacks and hanging tools visible
inside.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#34 Marktstand** (`bld_market`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A wooden market stall with a
striped red-and-white fabric awning on four poles, a counter
displaying baskets of produce, hanging bunches of herbs, and a small
barrel beside it.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#35 Wohnhaus 1** (`bld_cottage`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small medieval cottage with
whitewashed timber-framed walls, a golden thatched roof, a stone
chimney with a wisp of smoke, a small window with shutters and a
flower box.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#36 Wohnhaus 2** (`bld_cottage2`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small medieval cottage with
warm ochre plaster walls, a grey wooden shingle roof, a stone
foundation, an external wooden staircase to an upper door, and a small
barrel by the wall.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#37 Wohnhaus 3** (`bld_cottage3`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small medieval cottage of dark
timber and stone with a moss-covered thatched roof, a low doorway with
a rounded arch, a woodpile stacked against one wall and a small fenced
herb patch.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#38 Baustelle** (`bld_baustelle`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A generic building under
construction: wooden scaffolding poles lashed together around a
partially finished stone foundation, stacked timber beams, a bucket of
mortar, and a wooden ladder leaning against the frame.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```


### 27.2 Vegetation, Kartenobjekte, Felder, Schilder (15)


**#41 Laubbaum** (`tree_leaf`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single deciduous tree with a
full rounded canopy of fresh green leaves on a sturdy brown trunk.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#42 Herbstbaum** (`tree_autumn`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single deciduous tree with a
full rounded canopy of amber, rust and golden autumn leaves, a few
leaves drifting down.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#43 Nadelbaum** (`tree_conifer`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single tall conifer with dense
dark green triangular foliage layered in tiers on a straight trunk.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#44 Winterbaum** (`tree_winter`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single bare deciduous tree with
dark twisting branches dusted with white snow, and a small mound of
snow at its base.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#46 Steinvorkommen** (`obj_stone`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A cluster of mineable grey
granite boulders with flat chiselled facets and a few small chipped
fragments scattered at the base.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#47 Brandruine** (`obj_ruin`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A burned-out building ruin:
charred blackened timber beams leaning at angles, a partially
collapsed stone wall, scattered rubble and a faint wisp of smoke.
Stylized and not gruesome.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#48 Tor der Ahnen** (`obj_gate`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. An ancient ceremonial stone
archway with weathered carved runes along its pillars, a heavy iron-
banded wooden gate set within it, and creeping vines along one side.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#49 Feld gesät** (`feld_gepfluegt`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small square patch of freshly
ploughed farmland with neat parallel furrows of dark brown soil and a
few tiny green sprouts just breaking through.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#50 Feld wachsend** (`feld_gruen`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small square patch of farmland
with young green wheat stalks growing in neat rows, about knee height.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#51 Feld erntereif** (`feld_weizen`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small square patch of farmland
with tall ripe golden wheat in neat rows, heavy heads bending
slightly.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#52 Schild nichts** (`sign_none`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small wooden signpost stuck
upright in a patch of ground, its square board carved and painted with
a simple crossed-out circle symbol meaning nothing found.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#53 Schild Kohle** (`sign_coal`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small wooden signpost stuck
upright in a patch of ground, its square board carved and painted with
a simple black coal lump symbol.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#54 Schild Eisen** (`sign_iron`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small wooden signpost stuck
upright in a patch of ground, its square board carved and painted with
a simple reddish-brown iron ore chunk symbol.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#55 Schild Gold** (`sign_gold`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small wooden signpost stuck
upright in a patch of ground, its square board carved and painted with
a simple golden nugget symbol.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```

**#56 Schild Granit** (`sign_granite`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small wooden signpost stuck
upright in a patch of ground, its square board carved and painted with
a simple grey stone block symbol.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```


### 27.3 Terrain-Texturen (8)


**#58 Wiese** (`ter_grass`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A lush green meadow ground
texture of short grass with subtle natural color variation and a few
tiny scattered pebbles.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#59 Sand/Wüste** (`ter_sand`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A warm golden desert sand ground
texture with soft wind-blown ripple patterns and a few small scattered
pebbles.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#60 Schnee** (`ter_snow`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A fresh white snow ground texture
with soft undulating drifts and a subtle blue-tinted sparkle in the
shadows.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#61 Sumpf** (`ter_swamp`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A dark boggy swamp ground texture
of wet mud with murky green water patches, scattered moss and a few
reed stubs.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#62 Fels/Gebirge** (`ter_rock`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A rugged grey mountain rock
ground texture with angular cracked stone facets and sparse patches of
hardy moss.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#63 Kopfsteinpflaster** (`ter_cobble`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A cobblestone road texture of
tightly fitted rounded grey stones of varying sizes with subtle moss
growing in the gaps.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#64 Wasser** (`ter_water`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A calm water surface texture in
clear blue-green tones with gentle stylized ripple patterns and soft
light reflections.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#65 Lava** (`ter_lava`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A volcanic ground texture of
cracked dark basalt rock with glowing orange and yellow lava running
through the fissures and a subtle ember glow.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```


### 27.4 Waren (22)


**#104 Baumstamm** (`good_trunk`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single cut tree trunk log with
visible bark and pale cut ends, lying horizontally.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#105 Brett** (`good_board`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small neat stack of three cut
wooden planks with visible grain.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#106 Stein** (`good_stone`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single rough-cut grey stone
block with chiselled facets.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#107 Fisch** (`good_fish`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single plump silver-blue fish
lying on its side.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#108 Fleisch** (`good_meat`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single cut of raw red meat on a
small wooden board.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#109 Getreide** (`good_grain`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A bundled sheaf of golden wheat
tied with twine.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#110 Mehl** (`good_flour`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small burlap sack of flour,
open at the top with a light dusting spilling over the rim.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#111 Brot** (`good_bread`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single round rustic loaf of
bread with a scored crust.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#112 Wasser** (`good_water`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A wooden bucket filled with clear
water, with an iron band and a rope handle.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#113 Schwein** (`good_pig`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single plump pink cartoon pig
standing in profile.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#114 Kohle** (`good_coal`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small heap of glossy black coal
lumps.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#115 Eisenerz** (`good_ironore`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A rough chunk of reddish-brown
iron ore with visible mineral speckles.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#116 Eisen** (`good_iron`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small stack of three forged
grey iron bars.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#117 Golderz** (`good_gold`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A rough grey ore chunk with
bright gold veins running through it.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#118 Münze** (`good_coin`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small stack of three shiny gold
coins with a simple embossed pattern.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#119 Schwert** (`good_sword`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single short broad sword with a
leather-wrapped hilt and polished steel blade, lying at a slight
angle.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#120 Schild** (`good_shield`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single round wooden shield with
a metal boss in the center and a simple painted blue and gold pattern.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#121 Speer** (`good_spear`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single wooden spear with a
leaf-shaped steel spearhead, lying at a slight angle.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#122 Bogen** (`good_bow`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single curved wooden longbow
with a taut bowstring, standing at a slight angle.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#123 Bier** (`good_beer`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A wooden tankard filled with
amber beer and a thick white foam head.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#124 Spitzhacke** (`good_pick`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single pickaxe with a wooden
handle and an iron head, lying at a slight angle.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#125 Hammer** (`good_hammer`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single blacksmith's hammer with
a wooden handle and an iron head, lying at a slight angle.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```


### 27.5 HUD-Icons (8)


**#126 Bretter** (`icon_board`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small neat stack of cut wooden
planks, simplified as a bold clear HUD icon.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#127 Steine** (`icon_stone`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small pile of rough-cut grey
stone blocks, simplified as a bold clear HUD icon.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#128 Brot** (`icon_bread`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round rustic loaf of bread,
simplified as a bold clear HUD icon.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#129 Fisch** (`icon_fish`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A plump silver-blue fish,
simplified as a bold clear HUD icon.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#130 Kohle** (`icon_coal`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small heap of glossy black coal
lumps, simplified as a bold clear HUD icon.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#131 Eisen** (`icon_iron`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A stack of forged grey iron bars,
simplified as a bold clear HUD icon.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#132 Münzen** (`icon_coin`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A stack of shiny gold coins,
simplified as a bold clear HUD icon.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```

**#133 Soldaten** (`icon_soldier`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A Roman-style helmet with cheek
guards and a royal blue crest brush, simplified as a bold clear HUD
icon.

Centered single object, soft studio lighting with a subtle rim light
from the upper-left, subtle drop shadow. Isolated on a plain solid
white background. No text, no numbers, no UI frame, no watermark.
```


### 27.6 Effekte (6)


**#134 Pfeil im Flug** (`fx_arrow`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single arrow in mid-flight,
wooden shaft with feather fletching and a steel arrowhead, angled
diagonally with a faint motion streak.

Isolated visual effect rendered on a plain solid black background for
easy alpha extraction, centered with empty margin around it. No text,
no watermark, no UI, no characters, no scenery.
```

**#135 Einschlagstaub** (`fx_impact`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A small burst of brown dust and
flying debris radiating outward from a ground impact point.

Isolated visual effect rendered on a plain solid black background for
easy alpha extraction, centered with empty margin around it. No text,
no watermark, no UI, no characters, no scenery.
```

**#136 Funkenschauer** (`fx_sparks`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A bright burst of orange and
yellow sparks scattering outward from a central point.

Isolated visual effect rendered on a plain solid black background for
easy alpha extraction, centered with empty margin around it. No text,
no watermark, no UI, no characters, no scenery.
```

**#137 Rauchsäule** (`fx_smoke`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A soft billowing plume of grey-
white smoke rising and widening as it dissipates upward.

Isolated visual effect rendered on a plain solid black background for
easy alpha extraction, centered with empty margin around it. No text,
no watermark, no UI, no characters, no scenery.
```

**#138 Wasserspritzer** (`fx_splash`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A crown-shaped splash of clear
blue water with scattered droplets flying outward.

Isolated visual effect rendered on a plain solid black background for
easy alpha extraction, centered with empty margin around it. No text,
no watermark, no UI, no characters, no scenery.
```

**#139 Katapult-Geschoss** (`fx_boulder`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single rough round grey stone
boulder with a faint motion blur streak behind it.

Isolated visual effect rendered on a plain solid black background for
easy alpha extraction, centered with empty margin around it. No text,
no watermark, no UI, no characters, no scenery.
```


### 27.7 UI-Elemente (6)


**#144 Holztextur** (`ui_wood`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A seamless weathered wood plank
texture with warm brown grain, subtle knots and gentle wear, for use
as a UI panel background. Seamlessly tileable on all four edges, flat
orthographic view, even neutral lighting.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**#145 Pergament** (`ui_parchment`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A seamless aged parchment paper
texture in warm cream tones with subtle stains, soft creases and a
slightly mottled surface, for use as a UI panel background. Seamlessly
tileable on all four edges, flat orthographic view, even neutral
lighting.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**#146 Zierring** (`ui_ring`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. An ornate circular decorative
frame ring of dark carved wood with small iron rivets and simple
knotwork along the rim, with an empty transparent center.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**#147 Pause-Button** (`ui_btn_pause`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round button carved from
weathered wood with an iron rim, bearing a simple engraved pause
symbol of two vertical bars.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**#148 Menü-Button** (`ui_btn_menu`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round button carved from
weathered wood with an iron rim, bearing a simple engraved symbol of
three stacked horizontal bars.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**#149 Tempo-Button** (`ui_btn_speed`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round button carved from
weathered wood with an iron rim, bearing a simple engraved forward
double-arrow symbol.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```


### 27.8 Baumenü-Kategorie-Icons (6 Tabs, #150)


**Tab: Wohnen**
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round button carved from
weathered wood with an iron rim, bearing a simple engraved house
symbol.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**Tab: Rohstoffe**
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round button carved from
weathered wood with an iron rim, bearing a simple engraved wheat sheaf
symbol.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**Tab: Verarbeitung**
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round button carved from
weathered wood with an iron rim, bearing a simple engraved cogwheel-
and-hammer symbol.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**Tab: Bergbau**
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round button carved from
weathered wood with an iron rim, bearing a simple engraved pickaxe
symbol.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**Tab: Militär**
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round button carved from
weathered wood with an iron rim, bearing a simple engraved crossed
swords symbol.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

**Tab: Sonstiges**
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A round button carved from
weathered wood with an iron rim, bearing a simple engraved simple star
symbol.

Centered single interface element, soft even studio lighting, subtle
drop shadow. Isolated on a plain solid white background. No text, no
lettering, no numbers, no watermark.
```

---

## 28. Gebäude als Gruppen-Sheets mit korrekten Größenverhältnissen

Ersetzt §27.1. Zwei Probleme auf einmal gelöst: Einzelbilder haben keinen Größenbezug (jedes Gebäude wird formatfüllend gerendert, also wird die Burg so groß wie die Hütte), und ihr wolltet weniger Prompts. Lösung: 7 Sheets mit je 6 Gebäuden, in jedem Sheet dasselbe Standard-Wohnhaus als Größenanker. Innerhalb eines Sheets stimmen die Verhältnisse, über den wiederkehrenden Anker auch zwischen den Sheets.


### 28.1 Die Größenskala (Wohnhaus = 1)


| Gebäude | Höhe | Breite |
|---|---|---|
| Marktstand | 0,5 | 1 |
| Brunnen | 0,3 | 0,5 |
| Schweinezucht | 0,5 | 1 |
| Holzfäller, Förster, Fischer, Jäger | 0,7 | 0,7 |
| Wohnhäuser 1-3, Wachhaus, Metzger, Münze, Baustelle | 1 | 1 |
| Waffen-/Werkzeugschmiede, Bäckerei, Brauerei | 1,2 | 1,2 |
| Bauernhof, Sägewerk, Eisenhütte, Werft | 1,5 | 2 |
| Lagerhaus | 1,5 | 2 |
| Kapelle, Zehntscheune | 2 | 1,5 |
| Wachturm | 2,5 | 0,8 |
| Mühle | 3 | 1 |
| Festung | 3 | 3 |
| **Hauptquartier** | **4** | **4** |

Katapult ist kein Gebäude, sondern ein Fahrzeug: etwa 0,5 - eigener Prompt unten.


### 28.2 Die 7 Sheet-Prompts


Jedes Sheet enthält das Standard-Wohnhaus als ersten Eintrag. Das braucht ihr nur einmal - in den anderen Sheets ist es reiner Maßstabs-Anker und wird beim Zuschneiden verworfen.


**Sheet 1 - Wohnen und Lager**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the buildings
below as separate objects, arranged in a row with generous empty space
between them so each can be cropped out individually afterward.
CRITICAL: all buildings must be drawn to CORRECT RELATIVE SCALE within
this image - the small cottage is the size reference, and every other
building must be sized proportionally to it as stated. Do not scale
each building to fill its own space; a large fortress must visibly
tower over the cottage.

Include exactly these buildings, side by side:

1. A small medieval cottage with whitewashed timber-framed walls,
a golden thatched roof and a stone chimney - THIS IS THE SIZE
REFERENCE, one storey tall.

2. A small medieval cottage with warm ochre plaster walls, a grey
shingle roof and an external wooden staircase. Scale: same size as
the cottage.

3. A small medieval cottage of dark timber and stone with a moss-
covered thatched roof and a woodpile against the wall. Scale: same
size as the cottage.

4. A large sturdy timber warehouse with wide open double doors, a
steep shingled roof and an external staircase to a loft hatch.
Scale: about twice the width and 1.5 times the height of the
cottage.

5. A large timber tithe barn with a very steep thatched roof
reaching almost to the ground and tall open doors. Scale: about
twice the width and twice the height of the cottage.

6. A generic building under construction: wooden scaffolding
around a partly finished stone foundation, stacked timber and a
ladder. Scale: same size as the cottage.

Every building shown in the same isometric 3/4 view at a fixed
40-degree elevated camera angle, with the same fixed light direction
from the upper-left and a soft contact shadow beneath it. All standing
on the same ground line. Plain solid white background throughout. No
panel borders, no grid lines, no labels, no text, no numbers, no UI,
no characters, no background scenery, no watermark.
```

**Sheet 2 - Rohstoffgewinnung**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the buildings
below as separate objects, arranged in a row with generous empty space
between them so each can be cropped out individually afterward.
CRITICAL: all buildings must be drawn to CORRECT RELATIVE SCALE within
this image - the small cottage is the size reference, and every other
building must be sized proportionally to it as stated. Do not scale
each building to fill its own space; a large fortress must visibly
tower over the cottage.

Include exactly these buildings, side by side:

1. A small medieval cottage with whitewashed timber-framed walls,
a golden thatched roof and a stone chimney - THIS IS THE SIZE
REFERENCE, one storey tall.

2. A small rustic woodcutter's hut of rough-hewn logs with a mossy
plank roof, an axe in a chopping block and stacked logs. Scale:
about two thirds the size of the cottage.

3. A small timber forester's hut with a green mossy roof and young
saplings in pots beside the door. Scale: about two thirds the size
of the cottage.

4. An open stonemason's yard cut into a rocky outcrop with a
timber shelter roof, a half-carved block and stacked cut stone.
Scale: about the same height but wider than the cottage.

5. A small wooden fisherman's hut raised on stilts with a thatched
roof, a drying net and a small rowboat beneath. Scale: about two
thirds the size of the cottage.

6. A small rustic hunter's lodge of timber and stone with hides on
a drying frame and antlers above the door. Scale: about two thirds
the size of the cottage.

Every building shown in the same isometric 3/4 view at a fixed
40-degree elevated camera angle, with the same fixed light direction
from the upper-left and a soft contact shadow beneath it. All standing
on the same ground line. Plain solid white background throughout. No
panel borders, no grid lines, no labels, no text, no numbers, no UI,
no characters, no background scenery, no watermark.
```

**Sheet 3 - Landwirtschaft und Nahrung**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the buildings
below as separate objects, arranged in a row with generous empty space
between them so each can be cropped out individually afterward.
CRITICAL: all buildings must be drawn to CORRECT RELATIVE SCALE within
this image - the small cottage is the size reference, and every other
building must be sized proportionally to it as stated. Do not scale
each building to fill its own space; a large fortress must visibly
tower over the cottage.

Include exactly these buildings, side by side:

1. A small medieval cottage with whitewashed timber-framed walls,
a golden thatched roof and a stone chimney - THIS IS THE SIZE
REFERENCE, one storey tall.

2. A timber-framed farmhouse with a thatched roof and attached
barn, a fenced vegetable patch and a hay cart. Scale: about twice
the width and 1.3 times the height of the cottage.

3. A round stone windmill tower with a white plaster upper
section, a conical wooden cap and four large sail blades. Scale:
about three times the height of the cottage.

4. A stone and timber bakery with a large domed clay oven and a
tall chimney, flour sacks outside. Scale: slightly larger than the
cottage.

5. A rustic timber pig sty with a low thatched roof and an
attached fenced muddy paddock with a feeding trough. Scale: about
the same width but only half the height of the cottage.

6. A small round stone well with a peaked wooden roof, a hand
crank and a hanging bucket. Scale: about one third the height of
the cottage.

Every building shown in the same isometric 3/4 view at a fixed
40-degree elevated camera angle, with the same fixed light direction
from the upper-left and a soft contact shadow beneath it. All standing
on the same ground line. Plain solid white background throughout. No
panel borders, no grid lines, no labels, no text, no numbers, no UI,
no characters, no background scenery, no watermark.
```

**Sheet 4 - Verarbeitung**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the buildings
below as separate objects, arranged in a row with generous empty space
between them so each can be cropped out individually afterward.
CRITICAL: all buildings must be drawn to CORRECT RELATIVE SCALE within
this image - the small cottage is the size reference, and every other
building must be sized proportionally to it as stated. Do not scale
each building to fill its own space; a large fortress must visibly
tower over the cottage.

Include exactly these buildings, side by side:

1. A small medieval cottage with whitewashed timber-framed walls,
a golden thatched roof and a stone chimney - THIS IS THE SIZE
REFERENCE, one storey tall.

2. A timber sawmill with a large exposed circular saw blade at the
open front bay, raw logs on one side and cut planks on the other.
Scale: about 1.5 times the size of the cottage.

3. A timber butcher's building with an open shuttered window, a
chopping block with a cleaver and hanging sausages. Scale: same
size as the cottage.

4. A stone brewery with a stout chimney, barrels stacked in a
pyramid outside and a brewing vat visible inside. Scale: slightly
larger than the cottage.

5. A stone iron smelter with a tall wide chimney, a glowing orange
furnace opening and a bellows. Scale: about 1.5 times the height
of the cottage.

6. A neat stone mint building with a small chimney, a reinforced
iron-banded door and a barred window. Scale: same size as the
cottage.

Every building shown in the same isometric 3/4 view at a fixed
40-degree elevated camera angle, with the same fixed light direction
from the upper-left and a soft contact shadow beneath it. All standing
on the same ground line. Plain solid white background throughout. No
panel borders, no grid lines, no labels, no text, no numbers, no UI,
no characters, no background scenery, no watermark.
```

**Sheet 5 - Schmieden, Bergbau**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the buildings
below as separate objects, arranged in a row with generous empty space
between them so each can be cropped out individually afterward.
CRITICAL: all buildings must be drawn to CORRECT RELATIVE SCALE within
this image - the small cottage is the size reference, and every other
building must be sized proportionally to it as stated. Do not scale
each building to fill its own space; a large fortress must visibly
tower over the cottage.

Include exactly these buildings, side by side:

1. A small medieval cottage with whitewashed timber-framed walls,
a golden thatched roof and a stone chimney - THIS IS THE SIZE
REFERENCE, one storey tall.

2. A stone weapon smithy with a glowing forge opening, an anvil
under an open awning and racks of swords and spears. Scale:
slightly larger than the cottage.

3. A timber-framed toolsmith's workshop with an open work bay, a
glowing forge chimney, an anvil and a rack of files and saws.
Scale: slightly larger than the cottage.

4. A timber-framed mine entrance built into a rocky hillside with
heavy support beams, an ore cart on rails and a heap of black coal
beside it. Scale: about the same height but set into a hillside
roughly twice the width of the cottage.

5. A timber-framed mine entrance built into a rocky hillside with
support beams, an ore cart and a heap of reddish-brown iron ore.
Scale: same size as the coal mine.

6. An open granite quarry cut into a rocky hillside with a timber
crane arm and stacked square granite blocks. Scale: about twice
the width of the cottage.

Every building shown in the same isometric 3/4 view at a fixed
40-degree elevated camera angle, with the same fixed light direction
from the upper-left and a soft contact shadow beneath it. All standing
on the same ground line. Plain solid white background throughout. No
panel borders, no grid lines, no labels, no text, no numbers, no UI,
no characters, no background scenery, no watermark.
```

**Sheet 6 - Militär**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the buildings
below as separate objects, arranged in a row with generous empty space
between them so each can be cropped out individually afterward.
CRITICAL: all buildings must be drawn to CORRECT RELATIVE SCALE within
this image - the small cottage is the size reference, and every other
building must be sized proportionally to it as stated. Do not scale
each building to fill its own space; a large fortress must visibly
tower over the cottage.

Include exactly these buildings, side by side:

1. A small medieval cottage with whitewashed timber-framed walls,
a golden thatched roof and a stone chimney - THIS IS THE SIZE
REFERENCE, one storey tall.

2. A simple timber barracks with a shingled roof, enclosed by a
wooden palisade wall with a gate and a small watch platform.
Scale: about 1.5 times the width of the cottage, same height.

3. A compact square stone guardhouse with a small slate-grey
pitched roof, a narrow arched doorway, arrow slit windows and a
plain undyed flat banner on the roof ridge. Scale: about
the same size as the cottage.

4. A tall narrow round stone watchtower with a slate-grey conical
roof, a small railed lookout platform near the top and a plain
undyed flat banner at the peak. Scale: about 2.5
times the height of the cottage but narrower.

5. A massive square stone fortress with crenellated battlements,
four corner turrets with slate-grey roofs, a heavy iron-banded gate
and plain undyed flat banners along the walls.
Scale: about three times the height and three times the width of
the cottage - clearly a huge structure.

6. A large fortified castle headquarters with thick stone walls,
three round corner towers with slate-grey conical roofs, a raised
drawbridge over a moat and plain undyed flat banners on the
battlements. Scale: the largest building of all, about
four times the height and four times the width of the cottage.

Every building shown in the same isometric 3/4 view at a fixed
40-degree elevated camera angle, with the same fixed light direction
from the upper-left and a soft contact shadow beneath it. All standing
on the same ground line. Plain solid white background throughout. No
panel borders, no grid lines, no labels, no text, no numbers, no UI,
no characters, no background scenery, no watermark.
```

**Sheet 7 - Hafen, Sonderbauten**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the buildings
below as separate objects, arranged in a row with generous empty space
between them so each can be cropped out individually afterward.
CRITICAL: all buildings must be drawn to CORRECT RELATIVE SCALE within
this image - the small cottage is the size reference, and every other
building must be sized proportionally to it as stated. Do not scale
each building to fill its own space; a large fortress must visibly
tower over the cottage.

Include exactly these buildings, side by side:

1. A small medieval cottage with whitewashed timber-framed walls,
a golden thatched roof and a stone chimney - THIS IS THE SIZE
REFERENCE, one storey tall.

2. A small medieval harbor: a wooden pier on stilts over water, a
timber warehouse at the landward end, mooring posts, crates and a
loading crane arm. Scale: about three times the width of the
cottage, similar height.

3. A medieval shipyard: an open timber boathouse over a slipway
with a partly built boat hull on supports inside. Scale: about
twice the width and 1.5 times the height of the cottage.

4. A low timber donkey stable with a wide open doorway, a thatched
roof and an attached fenced paddock with a trough. Scale: about
1.5 times the width of the cottage, slightly lower.

5. A small stone chapel with a steep shingled roof, a wooden bell
tower with a visible bell and small stained-glass windows. Scale:
about twice the height of the cottage.

6. A wooden market stall with a striped red-and-white fabric
awning on four poles and a counter with produce baskets. Scale:
about half the height of the cottage.

Every building shown in the same isometric 3/4 view at a fixed
40-degree elevated camera angle, with the same fixed light direction
from the upper-left and a soft contact shadow beneath it. All standing
on the same ground line. Plain solid white background throughout. No
panel borders, no grid lines, no labels, no text, no numbers, no UI,
no characters, no background scenery, no watermark.
```


### 28.3 Katapult (Einzelprompt, kein Gebäude)


```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. A wooden catapult siege engine on a
heavy timber frame with large wooden wheels, a taut twisted-rope
torsion mechanism, a throwing arm with a bucket and a stone ball
resting beside it. Scale: roughly half the height of a one-storey
cottage - it is a vehicle, not a building.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```


### 28.4 Hinweis zum Zuschneiden

Beim Freistellen die Größenverhältnisse UNBEDINGT beibehalten - also nicht jedes Gebäude auf eine einheitliche Bildgröße skalieren, sondern mit gemeinsamem Maßstab zuschneiden und die Pixelgröße unterschiedlich lassen. Sonst ist der ganze Aufwand im Sheet umsonst.

---

## 29. Restliche Elemente als Gruppen-Sheets

Gleiches Prinzip wie bei den Gebäuden. Wichtig: Größenverhältnisse gelten nur dort, wo die Objekte auf der KARTE stehen (Bäume, Felsen, Ruine, Tor) - dort ist wieder das Wohnhaus der Anker. Waren- und HUD-Icons werden im Spiel alle gleich groß angezeigt, dort steht deshalb ausdrücklich das Gegenteil im Prompt: alle gleich groß rendern, unabhängig davon was sie darstellen. Sonst wird der Baumstamm riesig und die Münze verschwindet.


### 29.1 Bäume und Kartenobjekte (Sheet, mit Größenanker)


**Sheet V1 - Bäume und Kartenobjekte**
*Wohnhaus nur als Maßstab, beim Zuschneiden verwerfen*
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the objects below
as separate items, arranged in a row with generous empty space between
them so each can be cropped out individually afterward. CRITICAL: all
objects must be drawn to CORRECT RELATIVE SCALE within this image -
the small cottage is the size reference, and every other object must
be sized proportionally to it as stated. Do not scale each object to
fill its own space.

Include exactly these objects, side by side:

1. A small medieval cottage with whitewashed timber-framed walls,
a golden thatched roof and a stone chimney - THIS IS THE SIZE
REFERENCE, one storey tall.

2. A single deciduous tree with a full rounded canopy of fresh
green leaves on a sturdy brown trunk. Scale: about 1.5 times the
height of the cottage.

3. A single deciduous tree with a full rounded canopy of amber,
rust and golden autumn leaves. Scale: about 1.5 times the height
of the cottage.

4. A single tall conifer with dense dark green triangular foliage
layered in tiers on a straight trunk. Scale: about twice the
height of the cottage.

5. A single bare deciduous tree with dark twisting branches dusted
with white snow and a mound of snow at its base. Scale: about 1.5
times the height of the cottage.

6. A cluster of mineable grey granite boulders with flat chiselled
facets and small chipped fragments at the base. Scale: about half
the height of the cottage.

7. A burned-out building ruin: charred blackened timber beams
leaning at angles, a partially collapsed stone wall and scattered
rubble. Stylized, not gruesome. Scale: about the same size as the
cottage.

8. An ancient ceremonial stone archway with weathered carved runes
on its pillars, a heavy iron-banded wooden gate within it and
creeping vines along one side. Scale: about twice the height of
the cottage.

Every object shown in the same isometric 3/4 view at a fixed 40-degree
elevated camera angle, with the same fixed light direction from the
upper-left and a soft contact shadow beneath it. All standing on the
same ground line. Plain solid white background throughout. No panel
borders, no grid lines, no labels, no text, no numbers, no UI, no
characters, no background scenery, no watermark.
```


### 29.2 Getreidefelder (Sheet, alle gleich groß)


**Sheet V2 - Feld-Wachstumsstufen**
*Alle drei exakt gleich groß, damit sie im Spiel austauschbar sind*
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all three field patches
as separate items, arranged in a row with generous empty space between
them so each can be cropped out individually afterward. All three
patches must be EXACTLY the same size and shape - only the crop stage
differs.

Include exactly these objects, side by side:

1. A small square patch of freshly ploughed farmland with neat
parallel furrows of dark brown soil and a few tiny green sprouts
just breaking through.

2. A small square patch of farmland with young green wheat stalks
growing in neat rows, about knee height.

3. A small square patch of farmland with tall ripe golden wheat in
neat rows, heavy heads bending slightly.

Every object shown in the same isometric 3/4 view at a fixed 40-degree
elevated camera angle, with the same fixed light direction from the
upper-left and a soft contact shadow beneath it. All standing on the
same ground line. Plain solid white background throughout. No panel
borders, no grid lines, no labels, no text, no numbers, no UI, no
characters, no background scenery, no watermark.
```


### 29.3 Geologen-Schilder (Sheet, alle gleich groß)


**Sheet V3 - Geologen-Schilder**
*Identischer Pfosten, nur das Symbol wechselt*
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all five signposts as
separate items, arranged in a row with generous empty space between
them so each can be cropped out individually afterward. All five
signposts must be IDENTICAL in shape, size, wood color and post design
- only the carved symbol on the board differs.

Include exactly these objects, side by side:

1. A small wooden signpost stuck upright in a patch of ground, its
square board carved and painted with a simple crossed-out circle
symbol meaning nothing found.

2. The same signpost, its board carved and painted with a simple
black coal lump symbol.

3. The same signpost, its board carved and painted with a simple
reddish-brown iron ore chunk symbol.

4. The same signpost, its board carved and painted with a simple
golden nugget symbol.

5. The same signpost, its board carved and painted with a simple
grey stone block symbol.

Every object shown in the same isometric 3/4 view at a fixed 40-degree
elevated camera angle, with the same fixed light direction from the
upper-left and a soft contact shadow beneath it. All standing on the
same ground line. Plain solid white background throughout. No panel
borders, no grid lines, no labels, no text, no numbers, no UI, no
characters, no background scenery, no watermark.
```


### 29.4 Waren, Teil 1 (11 Stück)


**Sheet W1 - Waren 1**
*Alle gleich groß als Inventar-Icons*
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the objects below
as separate items, arranged in a row with generous empty space between
them so each can be cropped out individually afterward. All objects
must be rendered at the SAME icon size, each filling a similar amount
of space regardless of what it depicts - these are inventory icons,
not real-world scale comparisons.

Include exactly these objects, side by side:

1. A single cut tree trunk log with visible bark and pale cut
ends, lying horizontally.

2. A small neat stack of three cut wooden planks with visible
grain.

3. A single rough-cut grey stone block with chiselled facets.

4. A single plump silver-blue fish lying on its side.

5. A single cut of raw red meat on a small wooden board.

6. A bundled sheaf of golden wheat tied with twine.

7. A small burlap sack of flour, open at the top with a light
dusting spilling over the rim.

8. A single round rustic loaf of bread with a scored crust.

9. A wooden bucket filled with clear water, with an iron band and
a rope handle.

10. A single plump pink cartoon pig standing in profile.

11. A small heap of glossy black coal lumps.

Every object centered in its own space, same soft studio lighting with
a subtle rim light from the upper-left, same subtle drop shadow. Plain
solid white background throughout. No panel borders, no grid lines, no
labels, no text, no numbers, no UI frames, no watermark.
```


### 29.5 Waren, Teil 2 (11 Stück)


**Sheet W2 - Waren 2**
*Alle gleich groß als Inventar-Icons*
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the objects below
as separate items, arranged in a row with generous empty space between
them so each can be cropped out individually afterward. All objects
must be rendered at the SAME icon size, each filling a similar amount
of space regardless of what it depicts - these are inventory icons,
not real-world scale comparisons.

Include exactly these objects, side by side:

1. A rough chunk of reddish-brown iron ore with visible mineral
speckles.

2. A small stack of three forged grey iron bars.

3. A rough grey ore chunk with bright gold veins running through
it.

4. A small stack of three shiny gold coins with a simple embossed
pattern.

5. A single short broad sword with a leather-wrapped hilt and
polished steel blade, at a slight angle.

6. A single round wooden shield with a metal boss in the center
and a simple painted blue and gold pattern.

7. A single wooden spear with a leaf-shaped steel spearhead, at a
slight angle.

8. A single curved wooden longbow with a taut bowstring, at a
slight angle.

9. A wooden tankard filled with amber beer with a thick white foam
head.

10. A single pickaxe with a wooden handle and an iron head, at a
slight angle.

11. A single blacksmith's hammer with a wooden handle and an iron
head, at a slight angle.

Every object centered in its own space, same soft studio lighting with
a subtle rim light from the upper-left, same subtle drop shadow. Plain
solid white background throughout. No panel borders, no grid lines, no
labels, no text, no numbers, no UI frames, no watermark.
```


### 29.6 HUD-Icons (8 Stück)


**Sheet H - HUD-Icons**
*Bewusst simpler und kontrastreicher als die Waren-Icons, da sehr klein angezeigt*
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the objects below
as separate items, arranged in a row with generous empty space between
them so each can be cropped out individually afterward. All objects
must be rendered at the SAME icon size, each filling a similar amount
of space regardless of what it depicts - these are inventory icons,
not real-world scale comparisons. Keep each icon bolder and more
simplified than a normal item illustration - they are displayed very
small in a status bar.

Include exactly these objects, side by side:

1. A small neat stack of cut wooden planks.

2. A small pile of rough-cut grey stone blocks.

3. A round rustic loaf of bread.

4. A plump silver-blue fish.

5. A small heap of glossy black coal lumps.

6. A stack of forged grey iron bars.

7. A stack of shiny gold coins.

8. A Roman-style helmet with cheek guards and a royal blue crest
brush.

Every object centered in its own space, same soft studio lighting with
a subtle rim light from the upper-left, same subtle drop shadow. Plain
solid white background throughout. No panel borders, no grid lines, no
labels, no text, no numbers, no UI frames, no watermark.
```


### 29.7 Effekte (6 Stück, schwarzer Hintergrund)


**Sheet FX - Effekte**
*Schwarzer Hintergrund fürs Freistellen per Alpha*
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the objects below
as separate items, arranged in a row with generous empty space between
them so each can be cropped out individually afterward. All objects
must be rendered at the SAME icon size, each filling a similar amount
of space regardless of what it depicts - these are inventory icons,
not real-world scale comparisons.

Include exactly these objects, side by side:

1. A single arrow in mid-flight, wooden shaft with feather
fletching and a steel arrowhead, angled diagonally with a faint
motion streak.

2. A small burst of brown dust and flying debris radiating outward
from a ground impact point.

3. A bright burst of orange and yellow sparks scattering outward
from a central point.

4. A soft billowing plume of grey-white smoke rising and widening
as it dissipates upward.

5. A crown-shaped splash of clear blue water with scattered
droplets flying outward.

6. A single rough round grey stone boulder with a faint motion
blur streak behind it.

Every effect centered in its own space, same lighting treatment. Plain
solid BLACK background throughout for easy alpha extraction. No panel
borders, no grid lines, no labels, no text, no numbers, no UI, no
characters, no scenery, no watermark.
```


### 29.8 UI-Buttons und Baumenü-Tabs (9 Stück)


**Sheet UI - Buttons**
*Reihenfolge: Pause, Menü, Tempo, dann die 6 Baumenü-Tabs (Wohnen, Rohstoffe, Verarbeitung, Bergbau, Militär, Sonstiges)*
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the objects below
as separate items, arranged in a row with generous empty space between
them so each can be cropped out individually afterward. All objects
must be rendered at the SAME icon size, each filling a similar amount
of space regardless of what it depicts - these are inventory icons,
not real-world scale comparisons. All buttons must be exactly the same
diameter and use the same wood and iron treatment - only the engraved
symbol differs.

Include exactly these objects, side by side:

1. A round button carved from weathered wood with an iron rim,
bearing a simple engraved pause symbol of two vertical bars.

2. A round button carved from weathered wood with an iron rim,
bearing a simple engraved symbol of three stacked horizontal bars.

3. A round button carved from weathered wood with an iron rim,
bearing a simple engraved forward double-arrow symbol.

4. A round button carved from weathered wood with an iron rim,
bearing a simple engraved house symbol.

5. A round button carved from weathered wood with an iron rim,
bearing a simple engraved wheat sheaf symbol.

6. A round button carved from weathered wood with an iron rim,
bearing a simple engraved cogwheel and hammer symbol.

7. A round button carved from weathered wood with an iron rim,
bearing a simple engraved pickaxe symbol.

8. A round button carved from weathered wood with an iron rim,
bearing a simple engraved crossed swords symbol.

9. A round button carved from weathered wood with an iron rim,
bearing a simple engraved five-pointed star symbol.

Every button centered in its own space, same soft even studio
lighting, same subtle drop shadow, all exactly the same diameter.
Plain solid white background throughout. No panel borders, no labels,
no text, no lettering, no numbers, no watermark.
```


### 29.9 Terrain-Texturen (8 EINZELprompts - kein Sheet)


Terrain muss nahtlos kachelbar sein. Im Sammelbild geht das verloren, deshalb hier bewusst einzeln:


**#58 Wiese** (`ter_grass`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A lush green meadow ground
texture of short grass with subtle natural color variation and a few
tiny scattered pebbles.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#59 Sand/Wüste** (`ter_sand`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A warm golden desert sand ground
texture with soft wind-blown ripple patterns and a few small scattered
pebbles.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#60 Schnee** (`ter_snow`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A fresh white snow ground texture
with soft undulating drifts and a subtle blue-tinted sparkle in the
shadows.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#61 Sumpf** (`ter_swamp`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A dark boggy swamp ground texture
of wet mud with murky green water patches, scattered moss and a few
reed stubs.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#62 Fels/Gebirge** (`ter_rock`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A rugged grey mountain rock
ground texture with angular cracked stone facets and sparse patches of
hardy moss.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#63 Kopfsteinpflaster** (`ter_cobble`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A cobblestone road texture of
tightly fitted rounded grey stones of varying sizes with subtle moss
growing in the gaps.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#64 Wasser** (`ter_water`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A calm water surface texture in
clear blue-green tones with gentle stylized ripple patterns and soft
light reflections.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```

**#65 Lava** (`ter_lava`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A volcanic ground texture of
cracked dark basalt rock with glowing orange and yellow lava running
through the fissures and a subtle ember glow.

Seen from directly above, flat orthographic top-down view, seamlessly
tileable on all four edges, even neutral lighting with no strong
directional shadows. Isolated square texture tile filling the entire
frame. No text, no watermark, no UI, no objects, no characters.
```


### 29.10 UI-Texturen und Zierring (3 Einzelprompts)


**#144 Holztextur** (`ui_wood`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A seamless weathered wood plank
texture with warm brown grain, subtle knots and gentle wear, for use
as a UI panel background.

Seamlessly tileable on all four edges, flat orthographic view, even
neutral lighting with no strong directional shadows, filling the
entire frame. No text, no watermark, no UI elements, no objects.
```

**#145 Pergament** (`ui_parchment`)
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A seamless aged parchment paper
texture in warm cream tones with subtle stains, soft creases and a
slightly mottled surface, for use as a UI panel background.

Seamlessly tileable on all four edges, flat orthographic view, even
neutral lighting with no strong directional shadows, filling the
entire frame. No text, no watermark, no UI elements, no objects.
```

**#146 Zierring** (`ui_ring`)
```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading, warm muted earthy medieval color palette. An
ornate circular decorative frame ring of dark carved wood with small
iron rivets and simple knotwork along the rim, with a completely empty
open center.

Seen straight on from the front, centered, soft even studio lighting,
subtle drop shadow. Isolated on a plain solid white background. No
text, no lettering, no numbers, no watermark, no content inside the
ring.
```

---

## 30. Restposten - was noch offen ist

Nach Abgleich mit eurer 157er-Liste sind das die letzten offenen Punkte. Alles andere ist entweder abgedeckt (§25 Figuren, §26.6 Titelbilder, §28 Gebäude, §29 restliche Elemente) oder mit 🔧 als prozedural markiert und braucht kein Bild.


### 30.1 #100 Wuselnde Schweine (Karten-Deko)


Nicht zu verwechseln mit `good_pig` aus Sheet W1 - das ist das Waren-Icon. Hier geht es um die Schweine, die auf der Karte herumlaufen. Euer vorhandenes Bild stammt noch aus dem alten Stil.


```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A single plump pink cartoon pig
standing in profile with short legs, a curly tail, a round snout and
small floppy ears, in a relaxed standing pose with its head slightly
lowered as if snuffling the ground. Scale: roughly one third the
height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```


### 30.2 #57 Wiesen-Detail (optional, bei euch als prozedural markiert)


Falls ihr das doch als Bilder wollt statt prozedural - ein Sheet mit Streu-Deko:


```
Stylized cartoon 3D game asset, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size. A loose scatter of small meadow
details as separate items in one row: a small clump of wildflowers in
white and yellow, a tuft of tall grass blades, a pair of small brown
mushrooms, a small flat rock with moss, and a tiny thistle. Each item
tiny - roughly one tenth the height of a one-storey cottage - and each
clearly separated with empty space around it so they can be cropped
individually.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, soft contact shadow beneath the
object. Isolated on a plain solid white background, centered with
empty margin around it. No text, no watermark, no UI, no background
scenery, no characters.
```


### 30.3 #157 App-Icon (neu im Cartoon-Stil)


Vorhanden, aber im alten Stil. Da es der erste Eindruck im Store bzw. auf dem Homescreen ist, lohnt sich hier der Neuanlauf besonders.


```
Stylized cartoon app icon for a medieval settlement-building game: a
single bold, simple composition of a small timber-framed cottage with
a golden thatched roof on a green hill, with a tiny windmill
silhouette behind it and a warm golden sky. Chunky simplified shapes
with rounded edges, smooth matte surfaces, soft volumetric shading,
warm inviting earthy color palette. Very bold and readable at very
small size - few elements, strong silhouette, high contrast.

Square composition, centered, filling the frame with a small even
margin.

No text, no lettering, no numbers, no watermark, no UI elements, no
rounded corner mask, no border frame.
```


### 30.4 Noch nicht möglich - fehlt Input von euch


- **#152 Story-Tafeln der 10 Missionen**: dafür brauche ich je eine kurze Inhaltsangabe (ein bis zwei Sätze pro Mission), sonst wären die Bilder beliebig.
- **#39 Baustellen je Gebäudetyp**: in eurer Liste als optional markiert, aktuell nutzt ihr die generische Baustelle. Falls ihr sie doch wollt, wären das 38 weitere Motive - ich würde davon abraten und stattdessen die generische Baustelle plus das fertige Gebäude als Halbtransparenz überblenden.


### 30.5 Vollständigkeits-Check gegen eure Liste


| Bereich | Abgedeckt in | Status |
|---|---|---|
| Gebäude #1-38 | §28 (7 Sheets) + Katapult einzeln | vollständig |
| Vegetation/Objekte #41-56 | §29.1-29.3 | vollständig |
| Terrain #58-65 | §29.9 (Einzelprompts) | vollständig |
| Figuren #70-99 | §25 (A-Pose für Tripo) | vollständig |
| Deko-Schweine #100 | §30.1 | jetzt vollständig |
| Waren #104-125 | §29.4-29.5 | vollständig |
| HUD-Icons #126-133 | §29.6 | vollständig |
| Effekte #134-139 | §29.7 | vollständig |
| UI #144-150 | §29.8, §29.10 | vollständig |
| Titel/Dialoge #151, #153 | §26.6 | vollständig |
| App-Icon #157 | §30.3 | jetzt vollständig |
| Story-Tafeln #152 | - | wartet auf Missions-Inhalte |
| Alle 🔧-Punkte | - | prozedural, kein Bild nötig |

---

## 31. Baustellen in drei Größenklassen mit je vier Bauphasen

Statt 38 gebäudespezifischer Baustellen nur drei Sätze - klein, mittel, groß. Jeder Satz hat vier Stufen, wobei Stufe 4 das fertige Gebäude ist. Stufe 4 braucht ihr nicht auszuschneiden (die fertigen Gebäude habt ihr aus §28); sie steht bewusst mit im Prompt, weil sie dem Modell zeigt, worauf die drei Bauphasen hinauslaufen sollen - dadurch werden die Zwischenstufen stimmiger.


### 31.1 Die vier Stufen


| Stufe | Was zu sehen ist |
|---|---|
| 1 | Abgesteckte, planierte Erdfläche mit Pfählen und Schnur, flacher Graben, Schaufel |
| 2 | Fundament fertig, Ständerwerk aus Holz steht - offen, ohne Wände und Dach |
| 3 | Wände weitgehend zu, Dachstuhl steht aber ist noch nicht gedeckt, Gerüst und Leiter dran |
| 4 | Fertiges Gebäude (habt ihr bereits - nur als Zielbild im Prompt) |

Kernvorgabe in allen drei Prompts: Die Baustelle wird nicht breiter, sondern nur höher. Alle vier Stufen belegen dieselbe Grundfläche, sonst springt das Gebäude beim Baufortschritt auf der Karte.


### 31.2 Zuordnung Gebäude zu Größenklasse


| Klasse | Gebäude |
|---|---|
| **Klein** (Höhe 1) | Wohnhäuser 1-3, Holzfäller, Förster, Fischer, Jäger, Brunnen, Marktstand, Schweinezucht, Wachhaus, Metzger, Münzprägerei |
| **Mittel** (Höhe 1,5) | Sägewerk, Lagerhaus, Bauernhof, Bäckerei, Brauerei, Eisenhütte, Waffenschmiede, Werkzeugschmiede, Werft, Hafen, Eselzucht, Steinmetz, Baracke, alle vier Bergwerke |
| **Groß** (Höhe 3) | Hauptquartier, Festung, Mühle, Kapelle, Zehntscheune, Wachturm |

Wachturm ist zwar schmal, aber hoch - er passt trotzdem besser zu groß als zu mittel, weil der Bauablauf bei einem Steinturm eher dem großen Gebäude gleicht.


### 31.3 Die drei Prompts


**Sheet B-K - Baustelle KLEIN**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing four construction stages
of the SAME building site, arranged in a row from left to right in
chronological build order, with generous empty space between them so
each can be cropped out individually afterward. CRITICAL: all four
stages must occupy the SAME ground footprint and be drawn at the SAME
scale - the site does not grow wider, it only grows upward as it is
built. The footprint is that of a kleines einstöckiges Fachwerkgebäude
(Höhe 1, Breite 1 - entspricht einem Wohnhaus). Each stage must be
clearly and obviously further along than the one before it.

Include exactly these four stages, left to right:

1. STAGE 1 - staked ground: a cleared, levelled patch of bare
brown earth marked out with thin wooden stakes and taut string
along the outline, a shallow dug trench along the edges, a few
loose stones and a shovel stuck in a small dirt pile. Nothing
built upward yet, completely flat.

2. STAGE 2 - foundation and frame: the stone foundation course now
complete and level, with the timber post-and-beam skeleton
standing on it - upright corner posts and horizontal beams only,
completely open with no walls and no roof. A short wooden scaffold
along one side, stacked timber beams and a bucket of mortar on the
ground.

3. STAGE 3 - walls and open roof truss: the walls now mostly
filled in but still raw and unfinished, the bare roof truss
rafters in place but NOT yet covered, so the sky shows through
between them. Wooden scaffolding still standing along two sides, a
ladder leaning against the frame, stacked roofing material waiting
on the ground.

4. STAGE 4 - finished: a small one-storey timber-framed cottage
with whitewashed walls, a golden thatched roof and a stone
chimney. No scaffolding, no building materials, no stakes -
completely finished and clean.

Every stage shown in the same isometric 3/4 view at a fixed 40-degree
elevated camera angle, with the same fixed light direction from the
upper-left and a soft contact shadow beneath it. All standing on the
same ground line. Plain solid white background throughout. No panel
borders, no grid lines, no labels, no text, no numbers, no UI, no
characters, no background scenery, no watermark.
```

**Sheet B-M - Baustelle MITTEL**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing four construction stages
of the SAME building site, arranged in a row from left to right in
chronological build order, with generous empty space between them so
each can be cropped out individually afterward. CRITICAL: all four
stages must occupy the SAME ground footprint and be drawn at the SAME
scale - the site does not grow wider, it only grows upward as it is
built. The footprint is that of a mittelgroßes Werkstattgebäude (Höhe
1,5, Breite 2 - entspricht Sägewerk oder Lagerhaus). Each stage must
be clearly and obviously further along than the one before it.

Include exactly these four stages, left to right:

1. STAGE 1 - staked ground: a cleared, levelled patch of bare
brown earth marked out with thin wooden stakes and taut string
along the outline, a shallow dug trench along the edges, a few
loose stones and a shovel stuck in a small dirt pile. Nothing
built upward yet, completely flat.

2. STAGE 2 - foundation and frame: the stone foundation course now
complete and level, with the timber post-and-beam skeleton
standing on it - upright corner posts and horizontal beams only,
completely open with no walls and no roof. A short wooden scaffold
along one side, stacked timber beams and a bucket of mortar on the
ground.

3. STAGE 3 - walls and open roof truss: the walls now mostly
filled in but still raw and unfinished, the bare roof truss
rafters in place but NOT yet covered, so the sky shows through
between them. Wooden scaffolding still standing along two sides, a
ladder leaning against the frame, stacked roofing material waiting
on the ground.

4. STAGE 4 - finished: a medium-sized timber workshop building,
one and a half storeys tall and about twice as wide as a cottage,
with a steep shingled roof, wide double doors and a stone base
course. No scaffolding, no building materials, no stakes -
completely finished and clean.

Every stage shown in the same isometric 3/4 view at a fixed 40-degree
elevated camera angle, with the same fixed light direction from the
upper-left and a soft contact shadow beneath it. All standing on the
same ground line. Plain solid white background throughout. No panel
borders, no grid lines, no labels, no text, no numbers, no UI, no
characters, no background scenery, no watermark.
```

**Sheet B-G - Baustelle GROSS**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing four construction stages
of the SAME building site, arranged in a row from left to right in
chronological build order, with generous empty space between them so
each can be cropped out individually afterward. CRITICAL: all four
stages must occupy the SAME ground footprint and be drawn at the SAME
scale - the site does not grow wider, it only grows upward as it is
built. The footprint is that of a großes Steingebäude (Höhe 3, Breite
3 - entspricht Festung, Mühle oder Kapelle). Each stage must be
clearly and obviously further along than the one before it.

Include exactly these four stages, left to right:

1. STAGE 1 - staked ground: a cleared, levelled patch of bare
brown earth marked out with thin wooden stakes and taut string
along the outline, a shallow dug trench along the edges, a few
loose stones and a shovel stuck in a small dirt pile. Nothing
built upward yet, completely flat.

2. STAGE 2 - foundation and frame: the stone foundation course now
complete and level, with the timber post-and-beam skeleton
standing on it - upright corner posts and horizontal beams only,
completely open with no walls and no roof. A short wooden scaffold
along one side, stacked timber beams and a bucket of mortar on the
ground.

3. STAGE 3 - walls and open roof truss: the walls now mostly
filled in but still raw and unfinished, the bare roof truss
rafters in place but NOT yet covered, so the sky shows through
between them. Wooden scaffolding still standing along two sides, a
ladder leaning against the frame, stacked roofing material waiting
on the ground.

4. STAGE 4 - finished: a large stone building about three times
the height and width of a cottage, with thick walls, a tall steep
roof and a heavy arched doorway. No scaffolding, no building
materials, no stakes - completely finished and clean.

Every stage shown in the same isometric 3/4 view at a fixed 40-degree
elevated camera angle, with the same fixed light direction from the
upper-left and a soft contact shadow beneath it. All standing on the
same ground line. Plain solid white background throughout. No panel
borders, no grid lines, no labels, no text, no numbers, no UI, no
characters, no background scenery, no watermark.
```


### 31.4 Hinweis zum Einbau

Beim Zuschneiden alle vier Stufen mit identischem Ausschnitt und identischer Bodenlinie schneiden - also einen festen Rahmen über alle vier legen, nicht jede Stufe einzeln eng beschneiden. Nur dann wächst das Gebäude im Spiel sauber nach oben, statt bei jedem Phasenwechsel zu verrutschen.

---

## 32. Nachtrag: neue Elemente aus Jagd, Werkzeugwirtschaft und neuen Berufen

Abgleich mit eurer aktualisierten Liste: das meiste ist bereits abgedeckt (siehe Tabelle unten). Wirklich neu sind nur 6 Werkzeug-Waren-Icons, 3 Wildtiere und 2 Berufsfiguren.


### 32.1 Was bereits abgedeckt ist


| Aus eurer Liste | Steht in | Anmerkung |
|---|---|---|
| Werkzeugschmiede, Eselzucht, Hafen, Werft | §28 Sheet 5 und 7 | eigene Motive, nicht das Wohnhaus-Bild |
| Baustellen je Gebäudetyp | §31 | drei Größenklassen statt 38 Motiven |
| Geologen-Schild Kohle | §29.3 Sheet V3 | mit allen fünf Schildern zusammen |
| Lava, Wasser | §29.9 | Einzelprompts wegen Kachelbarkeit |
| Hammer (good_hammer) | §29.5 Sheet W2 | |
| Esel, Schaf, Schiff | §25.4 | |
| Alle Figuren außer Schreiner und Brunnenbauer | §25 | |
| Titelbild, Sieg-/Niederlage-Bild | §26.6 | |
| Story-Tafeln der 10 Missionen | – | wartet weiterhin auf die Missions-Inhalte |


### 32.2 Werkzeug-Waren-Icons (Sheet, 6 neue)


Der Hammer aus Sheet W2 ist hier bewusst nicht nochmal dabei. Falls ihr alle sieben Werkzeuge im gleichen Zug erzeugen wollt, hängt ihr ihn einfach als siebten Punkt an.


**Sheet W3 - Werkzeuge**
```
Stylized cartoon 3D game assets, chunky simplified shapes with rounded
edges and minimal fine surface detail, smooth matte surfaces, soft
volumetric shading with a clear light-to-shadow boundary, warm muted
earthy medieval color palette. Charming and slightly exaggerated
proportions, readable at small size.

Generate this as ONE single image containing all of the objects below
as separate items, arranged in a row with generous empty space between
them so each can be cropped out individually afterward. All objects
must be rendered at the SAME icon size, each filling a similar amount
of space regardless of what it depicts - these are inventory icons,
not real-world scale comparisons.

Include exactly these objects, side by side:

1. A single woodcutter's axe with a wooden handle and a broad iron
blade, at a slight angle.

2. A single carpenter's hand saw with a wooden grip and a toothed
steel blade, at a slight angle.

3. A single long-handled scythe with a curved steel blade, at a
slight angle.

4. A single wooden fishing rod with a line and a small hook, at a
slight angle.

5. A single butcher's cleaver with a broad rectangular steel blade
and a wooden handle, at a slight angle.

6. A single long-handled wooden shovel with an iron-edged blade,
at a slight angle.

Every object centered in its own space, same soft studio lighting with
a subtle rim light from the upper-left, same subtle drop shadow. Plain
solid white background throughout. No panel borders, no grid lines, no
labels, no text, no numbers, no UI frames, no watermark.
```


### 32.3 Wildtiere (3 Einzelprompts)


Bewusst einzeln statt als Sheet: Die drei sind sehr unterschiedlich gebaut, und für Tripo Image-to-3D braucht ihr ohnehin ein sauberes, formatfüllendes Einzelbild pro Tier. Beim Riggen in Tripo Quadruped wählen, nicht Humanoid. Blickrichtung nach links, wie von euch vorgegeben.


**Reh** (`reh.glb / unit_deer`)
```
A stylized cartoon 3D roe deer with a warm reddish-brown coat, a
lighter cream belly and rump patch, large dark eyes, big alert ears,
slender legs and a very short tail. Small delicate build, no antlers.
Chunky simplified shapes with minimal fine surface detail, smooth
matte surfaces.

Standing in a neutral rest pose seen from the side, facing LEFT, body
level and symmetrical, all four legs straight and evenly planted on
the ground, head raised and looking forward.

Camera: straight-on side view at eye level, no perspective distortion,
no tilt. Full body visible including all four legs and the tail.

Rendering: clean stylized cartoon 3D render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no scenery, no
other animals.
```

**Hase** (`hase.glb / unit_hare`)
```
A stylized cartoon 3D brown hare with a sandy-brown coat, a pale
belly, very long upright ears with dark tips, large dark eyes, strong
hind legs and a small fluffy tail. Compact rounded build. Chunky
simplified shapes with minimal fine surface detail, smooth matte
surfaces.

Standing in a neutral rest pose seen from the side, facing LEFT, body
level and symmetrical, all four legs straight and evenly planted on
the ground, head raised and looking forward.

Camera: straight-on side view at eye level, no perspective distortion,
no tilt. Full body visible including all four legs and the tail.

Rendering: clean stylized cartoon 3D render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no scenery, no
other animals.
```

**Wildschwein** (`wildschwein.glb / unit_boar`)
```
A stylized cartoon 3D wild boar with a coarse dark grey-brown bristly
coat, a long snout, small tusks curving up from the lower jaw, small
ears, a stocky humped back and short sturdy legs. Chunky simplified
shapes with minimal fine surface detail, smooth matte surfaces.

Standing in a neutral rest pose seen from the side, facing LEFT, body
level and symmetrical, all four legs straight and evenly planted on
the ground, head raised and looking forward.

Camera: straight-on side view at eye level, no perspective distortion,
no tilt. Full body visible including all four legs and the tail.

Rendering: clean stylized cartoon 3D render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no scenery, no
other animals.
```


### 32.4 Neue Berufsfiguren (2 Einzelprompts)


Referenzbild: der fertige Träger, wie bei allen zivilen Berufen.


**Schreiner** (`schreiner.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a simple cloth cap, a carpenter's tunic with
rolled-up sleeves, a leather apron with wood shavings on it, and
sturdy boots. He holds a hand saw at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```

**Brunnenbauer** (`brunnenbauer.glb`) - Referenz: Träger
```
Same art style, chibi proportions, head shape, nose and face design as
the reference image, but a different villager with different clothing
and equipment: wearing a plain wool cap, a simple work tunic with
rolled-up sleeves, a rope belt and worn boots, with a coil of rope
over one shoulder. He holds a wooden bucket at his side.

Standing in a neutral A-pose: facing the camera straight on, body
upright and symmetrical, both feet flat on the ground shoulder-width
apart, both arms hanging straight down and angled slightly away from
the body, head level and looking straight ahead, neutral friendly
expression. Any held tool hangs down at the side, gripped loosely,
without crossing in front of the body.

Camera: straight-on front view at eye level, no perspective
distortion, no tilt. Full body visible from head to feet.

Rendering: clean stylized 3D character render, smooth volumetric
shading, even neutral lighting with no strong shadows, isolated on a
plain solid white background.

No text, no watermark, no dynamic pose, no cropping, no extra props on
the ground.
```


### 32.5 Hinweis zur Abgrenzung

Der **Schreiner** (Sägewerk) und der **Werftarbeiter** aus §25 sind sich inhaltlich nah - beide Zimmermannsberufe mit Säge. Ich habe den Werftarbeiter mit Säge UND Hobel plus Werkzeuggürtel beschrieben, den Schreiner nur mit Säge und Schürze, damit sie sich im Spiel unterscheiden lassen. Falls euch das zu knapp ist: dem Werftarbeiter zusätzlich eine Schiffsplanke oder ein Tau in die Hand geben.

---

## 33. Story-Tafeln der 10 Missionen (#152)

Je eine Tafel pro Karte, abgeleitet aus euren Storyboards. Jede zeigt die prägende Landschaftsform der Karte aus erhöhter Panorama-Sicht, damit man schon am Bild erkennt, worum es geht - Kessel, Fluss, Oasen, Pässe, Inseln und so weiter. Im unteren Drittel ist bewusst ruhige Fläche freigelassen, damit euer Missionstext dort Platz hat.


Ein bewusster Unterschied zum Rest des Stilguides: Diese Bilder sind keine freigestellten Assets, sondern vollflächige Illustrationen. Deshalb kein weißer Hintergrund und keine isometrische 40-Grad-Kamera, sondern eine erhöhte Panorama-Perspektive. Der Cartoon-Stil bleibt identisch, damit sie zum Spiel passen.


### 33.1 Karte 1: Der Grüne Kessel

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. A lush green valley basin completely
ringed by steep forested hills like the inside of a bowl. Dense
woodland and scattered boulders along both rims, two small settlements
with thatched cottages facing each other from opposite sides, and a
single bare rocky ridge rising out of the greenery in the very center.
Warm midday light, fresh green and earthy brown palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.2 Karte 2: Zwei Ufer

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. A broad calm river cutting the land in
two, with a mirrored settlement of thatched cottages on each bank and
thin smoke rising from both. A narrow shallow ford crosses the river
at the center, and a second smaller crossing lies far upstream to the
north where low golden hills rise. Reeds and fishing boats along the
banks. Warm afternoon light, green and blue-grey palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.3 Karte 3: Die Trockene Weite

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. A parched sun-bleached plain where
drifting sand has swallowed half the grassland. Three small palm-
fringed oases with water and green patches sit far apart near the
edges, tents and simple huts clustered around them. Sparse palm
groves, and a spine of red rock formations along the southern horizon.
Hot hazy light, ochre, sand-gold and dusty green palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.4 Karte 4: Winterpass

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. Four snow-covered valleys arranged around
a central icy mountain massif, each valley holding a small cluster of
snow-roofed cottages, dark conifers and a frozen lake. Three narrow
snowy passes cut through the mountains between the valleys, leading up
to a bright windswept summit plateau in the middle. Cold clear winter
light, white, slate-grey and deep pine-green palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.5 Karte 5: Die Goldene See

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. A shallow inland sea dotted with islands.
Four equally sized home islands in the corners, each with woodland,
cottages and a small wooden harbor, several mid-sized empty islands
between them, and one small mist-shrouded island at the very center.
Calm turquoise water, a few sailing boats. Soft hazy light, blue-green
and warm sand palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.6 Karte 6: Das Moordelta

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. A wide river delta of dark boggy marshland
threaded with narrow firm earthen causeways. Three raised dry plateaus
carry small settlements with cottages and woodland, connected only by
these thin winding dams. Reeds, still black water pools, drifting
mist, and three low rocky islets out in the marsh. Muted overcast
light, dark green, peat-brown and grey palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.7 Karte 7: Der Vulkanring

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. A ring of cooled grey ash land encircling
a large smoking volcanic crater. Glowing orange lava streams cut the
ring into five wedge-shaped segments, each holding a small settlement
of dark stone huts and a few sheltered pockets of stunted trees. The
crater walls in the center glint faintly with gold. Dramatic warm-on-
cold light, charcoal grey, ash-white and glowing orange palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.8 Karte 8: Die Alte Handelsstraße

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. An ancient cobbled road running straight
from east to west across rolling hill country, punctuated by three
crumbling stone gatehouses standing astride it. Rich dark forests and
rocky hills at both far ends with settlements tucked among them, and a
bare windswept stretch of open ground in the middle. Long low
afternoon light, green, stone-grey and golden palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.9 Karte 9: Kontinent der Vier Winde

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. A vast open snow-covered continent whose
coastline breaks into six sheltered bays, each holding a small
settlement with conifers, a frozen shoreline and a nearby dark coal
hill. Broad empty snow plains stretch across the interior, with four
dark rocky ore ranges rising between the bays and four small ice
islands floating offshore. Pale arctic light, white, ice-blue and dark
pine palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.10 Karte 10: Der Weltenrand

```
Stylized cartoon illustration for a story panel in a medieval
settlement-building game. Chunky simplified shapes with rounded edges,
smooth matte surfaces, soft volumetric shading with a clear light-to-
shadow boundary, charming and slightly exaggerated proportions. Wide
panoramic landscape seen from an elevated vantage point, as if looking
down over the whole region. An enormous varied continent at the edge
of the known world, showing every kind of terrain at once: green
meadows, dark forests, sandy stretches, marsh, snow-capped peaks and a
rocky heartland. Six generous settled regions spread around the outer
edge, each with cottages and fields, and at the very center a rocky
basin holding a half-buried ancient stone gateway, reachable through
two long narrow valleys. Golden hour light, full rich earthy palette.

Wide landscape composition with generous calm empty space in the lower
third where a caption will be placed later. Soft atmospheric haze in
the distance, cinematic depth. No text, no lettering, no numbers, no
title, no logo, no watermark, no UI elements, no map markers, no
borders.
```


### 33.11 Hinweis

Falls die Tafeln im Spiel hochkant oder quadratisch dargestellt werden, im Prompt "Wide landscape composition" durch "Tall portrait composition" bzw. "Square composition" ersetzen und den Satz zur Textfläche entsprechend anpassen - sonst schneidet ihr euch die freigehaltene Fläche wieder weg.

---

## 34. Arbeitsanimationen prozedural aus dem GLB-Skelett

Tripos Preset-Bibliothek liefert Gehen, Warten und generische Kampfbewegungen, aber kein "Netz auswerfen" oder "kniend klopfen". Statt zwölf Clips einzeln zu bauen: die Arbeitsbewegungen im Code aus dem vorhandenen Rig erzeugen, indem gezielt einzelne Knochen rotiert werden.

### 34.1 Warum das hier besonders gut funktioniert

Die Figuren werden am Ende als kleine Sprites dargestellt. Auf dieser Größe trägt das Werkzeug in der Hand die Information, nicht die Feinmechanik der Bewegung - ein Hammerschlag ist optisch nicht von einem Axthieb oder einem Meißelschlag zu unterscheiden. Es reichen deshalb **drei generische Bewegungen** für alle zwölf Berufe.

### 34.2 Die drei Bewegungen

| Bewegung | Deckt ab | Kern |
|---|---|---|
| **Schwung** | Bauarbeiter, Holzfäller, Steinmetz, beide Schmiede, Metzger, Hüttenarbeiter, Bergmann, Bauer (Mähen) | Werkzeugarm holt über Schulterhöhe aus und schlägt nach vorn-unten durch, Oberkörper neigt sich mit |
| **Bücken** | Planierer, Förster, Bauer (Säen), Brunnenbauer, Geologe | Hüfte und Wirbelsäule beugen sich nach vorn, Knie leicht ein, Arm greift zum Boden und zurück |
| **Strecken** | Fischer, Späher | Arm und Oberkörper strecken sich nach vorn-oben und schwingen zurück |

Bäcker, Müller, Brauer, Goldschmied, Schweinehirt, Eselhirt, Werftarbeiter, Schreiner und Dorfbewohner brauchen laut eurer Liste ohnehin nur Gehen und Warten.

### 34.3 Knochen und Rotationen

Zuerst die tatsächlichen Knochennamen im exportierten GLB prüfen - Rigging-Tools benennen unterschiedlich. Verbreitet ist das Mixamo-Schema (`Hips`, `Spine`, `Spine1`, `RightArm`, `RightForeArm`, `RightHand`, `RightUpLeg`, `RightLeg`). Die Werte unten sind Startwerte zum Nachjustieren, nicht Dogma.

**Schwung** (Zyklus ca. 0,8 s, Werkzeugarm = rechts angenommen)

| Phase | Zeit | RightArm (X) | RightForeArm (X) | Spine1 (X) |
|---|---|---|---|---|
| Ausholen | 0,00 | -110 Grad | -70 Grad | -10 Grad |
| Halten | 0,25 | -120 Grad | -80 Grad | -12 Grad |
| Schlag | 0,40 | +40 Grad | -10 Grad | +18 Grad |
| Rückkehr | 0,80 | -110 Grad | -70 Grad | -10 Grad |

Der Schlag ist bewusst kurz und die Rückkehr lang - das erzeugt den typischen Arbeitsrhythmus. Ein linearer Sinus über den ganzen Zyklus wirkt dagegen wie Winken.

**Bücken** (Zyklus ca. 1,4 s)

| Phase | Zeit | Hips (X) | Spine (X) | RightArm (X) | RightUpLeg / LeftUpLeg (X) |
|---|---|---|---|---|---|
| Aufrecht | 0,00 | 0 | 0 | -10 Grad | 0 |
| Gebeugt | 0,50 | +35 Grad | +25 Grad | -80 Grad | +15 Grad |
| Halten | 0,70 | +35 Grad | +28 Grad | -90 Grad | +15 Grad |
| Aufrichten | 1,40 | 0 | 0 | -10 Grad | 0 |

Wichtig: die Hüfte zusätzlich um etwa 6 Prozent der Figurenhöhe absenken, sonst sieht das Bücken aus wie ein Klappmesser.

**Strecken** (Zyklus ca. 1,2 s)

| Phase | Zeit | RightArm (X) | RightForeArm (X) | Spine1 (Y) |
|---|---|---|---|---|
| Zurück | 0,00 | -30 Grad | -60 Grad | -15 Grad |
| Auswurf | 0,35 | -140 Grad | -5 Grad | +20 Grad |
| Nachschwingen | 0,55 | -120 Grad | -15 Grad | +12 Grad |
| Zurück | 1,20 | -30 Grad | -60 Grad | -15 Grad |

### 34.4 Umsetzung

- Nur die genannten Knochen anfassen, alle übrigen aus der Idle-Pose übernehmen. Dann bleibt die Figur unten stabil stehen, während oben gearbeitet wird.
- Zwischen den Phasen mit einer Ease-Funktion interpolieren (`easeInOutQuad` o. Ä.), nicht linear - lineare Knochenrotation sieht mechanisch aus.
- Beim Wechsel Gehen zu Arbeiten über etwa 0,2 s überblenden, sonst springt die Figur.
- Der Geologe soll laut eurer Liste kniend klopfen: Standard-Bücken nehmen und zusätzlich `LeftUpLeg` auf etwa +90 Grad und `LeftLeg` auf -90 Grad setzen, dann kniet er. Das ist die einzige Figur, für die sich eine Sonderbehandlung lohnt, weil die Kniehaltung auch klein erkennbar bleibt.

### 34.5 Falls ihr Sprites backt statt live zu rendern

Der Ansatz funktioniert genauso: Skelett per Skript in die Phasenposen setzen, Zwischenwerte interpolieren, Frames aus der 40-Grad-Kamera rendern. Bei Arbeitsbewegungen reichen 4 bis 6 Frames pro Zyklus - anders als beim Laufen fällt hier eine geringe Bildrate kaum auf, weil die Figur an Ort und Stelle bleibt und das Auge keine Bewegungsrichtung verfolgt.
