# Grafiklieferung 8 — Gelände-Materialien für die GPU

Stand v253. Gehört zum Technologiewechsel „Gelände auf die GPU"
(`js/terrain-gl.js`). Die Prompts sind vollständig und einzeln zum
direkten Einsetzen in GPT Image 2 gedacht — nichts zusammenbauen.

---

## Die Stilfrage: Mischung — aber mit einer klaren Trennlinie

Nicht Geschmack, sondern Arbeitsteilung. Seit dem Umbau rechnet der Shader
das Licht. Damit zerfällt „Stil" in zwei Hälften:

| | Zuständig | Stil |
|---|---|---|
| **Licht, Schatten, Form** | der Shader, aus dem Höhenfeld | **realistisch** |
| **Farbe, Muster, Körnung** | die gelieferte Kachel | **Asterix** |

**Warum das Licht realistisch sein muss:** genau dafür war der Umbau. Ein
physikalisch richtig beleuchteter Hang ist das, was den Berg als Körper
lesbar macht — mit gemaltem Licht ist das in fünf Anläufen nicht gelungen.

**Warum das Material *nicht* realistisch sein darf:** die Figuren sind im
Asterix-Stil. Der Konflikt ist schon einmal gemessen worden, der Kommentar
in `rockPal()` hält ihn fest:

> „die Palette des Auftrags liegt bei HSV-Sättigung 0,14–0,17, während
> Figuren und Gebäude bei 0,5–0,8 stehen. Ein so entsättigter Fels beisst
> sich mit dem knuffig-cartoonhaften Rest."

Ein fotorealistischer Boden unter Asterix-Figuren lässt die Figuren wie
aufgeklebte Sticker aussehen. Dazu kommt: auf dem Handy wird feine
Fotokörnung bei diesem Zoom ohnehin zu Rauschen.

Das Rezept heißt **stilisiertes PBR**: realistisches Licht auf
illustriertem Material.

---

## Keine Normal-Maps bestellen

Bildgeneratoren können keine Normal-Maps. Sie malen etwas Blau-Lila-Buntes,
das wie eine aussieht, aber keine gültigen Normalen enthält.

**Liefere nur die Albedo — die Normal-Map rechne ich daraus.** Optional und
nur beim Fels zusätzlich eine Graustufen-Höhenkarte (Prompts ganz unten).

---

## Format

1024 × 1024 PNG, nahtlos kachelbar, Draufsicht, flach ausgeleuchtet,
gleichmäßige Helligkeit bis an den Rand.

Der wichtigste Punkt ist das **flache Licht**: kein Schlagschatten, kein
Kantenlicht, keine Sonnenrichtung, keine Vignette. Der Shader setzt das
Licht; was schon im Bild steckt, kommt doppelt und kippt die Fläche. Der
alte 2D-Weg konnte eingemaltes Licht noch herausrechnen — auf der GPU gibt
es diesen Rettungsanker nicht mehr.

Und der **Rand**: gleichmäßig hell bis an die Kante. Genau das war der
Fehler in `ter_grass.png` — die äußeren zehn Bildpunkte fallen um 6 % ab,
und beim Kacheln stand alle 225 Weltpixel eine dunkle Linie im Gras.

---

# Die acht Prompts

---

## 1 · `mat_fels_alb.png` — Grundgestein (Grünland, Gebirge)

```
A seamless tileable 1024x1024 texture of a weathered granite rock
surface, viewed from directly above at a perfectly perpendicular angle,
as if photographed straight down but painted by hand.

The rock is broken into large angular plates, each roughly one sixth to
one quarter of the image wide, separated by clean dark cracks two to
four pixels wide. The plates are irregular polygons with straight
edges and sharp corners, not rounded pebbles. Within each plate the
surface is calm and almost flat, with only a faint mottling of colour.
A few plates are slightly tilted or chipped at one corner. Scattered
across perhaps one tenth of the surface are small patches of muted
olive-green lichen with soft irregular outlines.

Colour palette, warm ochre-brown granite, use these exact values:
#5C4C36 for the deepest cracks, #745E42 for shaded plate faces,
#967F5F as the dominant mid tone, #B29F80 for lighter plates, #CAB794
for the brightest few. Warm and slightly saturated, never neutral grey.

Style: stylised hand-painted game art in the spirit of a printed board
game tile or a European comic album. Large clean readable shapes, flat
colour areas with soft painterly edges, a reduced palette. Absolutely
no photographic grain, no fine speckled noise, no micro detail, no
realistic photo texture.

Lighting: completely flat and even across the entire image. No cast
shadows, no highlights, no rim light, no sun direction, no ambient
occlusion, no vignette, no darkening or brightening toward any edge or
corner. The brightness at the four borders must match the brightness at
the centre exactly.

Composition: the pattern must tile seamlessly when repeated left to
right and top to bottom. No frame, no border, no watermark, no text.
```

---

## 2 · `mat_fels_winter_alb.png` — Gestein kalt (Winter, Gebirge)

```
A seamless tileable 1024x1024 texture of a weathered alpine rock
surface, viewed from directly above at a perfectly perpendicular angle,
painted by hand.

The rock is broken into large angular plates, each roughly one sixth to
one quarter of the image wide, separated by clean cracks two to four
pixels wide. The plates are irregular polygons with straight edges and
sharp corners. Within each plate the surface is calm with a faint
mottling. In the cracks and along a few plate edges sits a thin line of
pale frost, like rime that has not melted. No snow lying on top, only
frost in the crevices.

Colour palette, cool blue-grey stone that is coloured and not neutral,
use these exact values: #565C66 for the deepest cracks, #707884 for
shaded plate faces, #9098A4 as the dominant mid tone, #B0B7C2 for
lighter plates, #CCD1D9 for the brightest few and for the frost.

Style: stylised hand-painted game art in the spirit of a printed board
game tile or a European comic album. Large clean readable shapes, flat
colour areas with soft painterly edges, a reduced palette. Absolutely
no photographic grain, no fine speckled noise, no micro detail.

Lighting: completely flat and even across the entire image. No cast
shadows, no highlights, no rim light, no sun direction, no ambient
occlusion, no vignette, no darkening toward any edge or corner. The
brightness at the four borders must match the centre exactly.

Composition: the pattern must tile seamlessly when repeated left to
right and top to bottom. No frame, no border, no watermark, no text.
```

---

## 3 · `mat_fels_wueste_alb.png` — Gestein warm (Wüste)

```
A seamless tileable 1024x1024 texture of a weathered sandstone surface,
viewed from directly above at a perfectly perpendicular angle, painted
by hand.

The rock is broken into large angular plates, each roughly one sixth to
one quarter of the image wide, separated by clean cracks two to four
pixels wide. Running across several plates are faint horizontal bedding
lines, the layered banding typical of sandstone, subtle enough to read
as texture rather than stripes. A thin dusting of fine sand has
collected in some of the cracks and in the shallow corners.

Colour palette, warm sand-brown sandstone, use these exact values:
#4E3C28 for the deepest cracks, #70583A for shaded plate faces,
#9E8058 as the dominant mid tone, #C4A67A for lighter plates, #DAC29C
for the brightest few and the drifted sand.

Style: stylised hand-painted game art in the spirit of a printed board
game tile or a European comic album. Large clean readable shapes, flat
colour areas with soft painterly edges, a reduced palette. Absolutely
no photographic grain, no fine speckled noise, no micro detail.

Lighting: completely flat and even across the entire image. No cast
shadows, no highlights, no rim light, no sun direction, no ambient
occlusion, no vignette, no darkening toward any edge or corner. The
brightness at the four borders must match the centre exactly.

Composition: the pattern must tile seamlessly when repeated left to
right and top to bottom. No frame, no border, no watermark, no text.
```

---

## 4 · `mat_fels_vulkan_alb.png` — Gestein dunkel (Vulkan)

```
A seamless tileable 1024x1024 texture of a weathered basalt surface,
viewed from directly above at a perfectly perpendicular angle, painted
by hand.

The rock is broken into large angular plates, each roughly one sixth to
one quarter of the image wide, separated by clean cracks two to four
pixels wide. A few of the cracks are wider and read as cooled lava
seams, filled with a slightly warmer and duller stone than the plates
around them. The plate surfaces are calm with a faint mottling.

Colour palette, very dark basalt with a slight reddish cast, dark but
never pure black, use these exact values: #2B2224 for the deepest
cracks, #47393A for shaded plate faces, #6B5A55 as the dominant mid
tone, #8A746A for lighter plates, #A68C7C for the brightest few and the
cooled seams.

Style: stylised hand-painted game art in the spirit of a printed board
game tile or a European comic album. Large clean readable shapes, flat
colour areas with soft painterly edges, a reduced palette. Absolutely
no photographic grain, no fine speckled noise, no micro detail. No
glowing lava, no embers, no orange light.

Lighting: completely flat and even across the entire image. No cast
shadows, no highlights, no rim light, no sun direction, no ambient
occlusion, no vignette, no darkening toward any edge or corner. The
brightness at the four borders must match the centre exactly.

Composition: the pattern must tile seamlessly when repeated left to
right and top to bottom. No frame, no border, no watermark, no text.
```

---

## 5 · `mat_wiese_alb.png` — Wiese

```
A seamless tileable 1024x1024 texture of lush meadow grass, viewed from
directly above at a perfectly perpendicular angle, painted by hand.

Short dense turf covering the whole image, made of loose readable tufts
of grass blades rather than individual hairs. Each tuft is a small
painted cluster of three to six strokes leaning in a slightly different
direction, so the surface never looks combed. Between the tufts the
turf closes into a soft even mat. Scattered sparsely across the image
are a few slightly larger clumps and a handful of tiny rounded leaves.
No flowers, no stones, no bare earth patches, no paths.

Colour palette, fresh mid-green, base colour #7BA55E, varied with
yellower greens around #93B061 and cooler bluer greens around #6A9660
for depth. Saturated and friendly, never olive-drab, never neon.

Style: stylised hand-painted game art in the spirit of a printed board
game tile or a European comic album. Large clean readable shapes, flat
colour areas with soft painterly edges, a reduced palette. Absolutely
no photographic grain, no fine speckled noise, no micro detail, no
realistic lawn photo texture.

Lighting: completely flat and even across the entire image. No cast
shadows under the tufts, no highlights, no sun direction, no ambient
occlusion, no vignette, no darkening toward any edge or corner. The
brightness at the four borders must match the centre exactly.

Composition: the pattern must tile seamlessly when repeated left to
right and top to bottom. No frame, no border, no watermark, no text.
```

---

## 6 · `mat_sand_alb.png` — Strand und Wüstenboden

```
A seamless tileable 1024x1024 texture of fine dry sand, viewed from
directly above at a perfectly perpendicular angle, painted by hand.

Gentle wind ripples run across the surface in long soft parallel bands
that curve slowly and never form a regular repeating comb. The ripples
are shallow and calm, read as soft tonal waves rather than sharp
ridges. Scattered sparsely across the image are a few tiny pebbles and
small shell fragments, no more than a dozen in total, each a simple
rounded painted shape.

Colour palette, warm pale sand, base colour #D1BA82, varied with
slightly deeper tan around #BFA771 in the ripple troughs and lighter
cream around #E2D0A0 on the crests. Warm and clean, never grey, never
muddy.

Style: stylised hand-painted game art in the spirit of a printed board
game tile or a European comic album. Large clean readable shapes, flat
colour areas with soft painterly edges, a reduced palette. Absolutely
no photographic grain, no fine speckled noise, no realistic sand grain
photo texture.

Lighting: completely flat and even across the entire image. No cast
shadows, no highlights, no sun direction picking out the ripples, no
ambient occlusion, no vignette, no darkening toward any edge or corner.
The brightness at the four borders must match the centre exactly.

Composition: the pattern must tile seamlessly when repeated left to
right and top to bottom. No frame, no border, no watermark, no text.
```

---

## 7 · `mat_schnee_alb.png` — Firn und Schneefläche

```
A seamless tileable 1024x1024 texture of wind-packed snow, viewed from
directly above at a perfectly perpendicular angle, painted by hand.

The surface is covered by sastrugi, the long low waves that wind carves
into hard snow. They run in soft parallel bands that curve slowly
across the image, wide and shallow, reading as gentle tonal swells
rather than sharp edges. A few small ice crystals catch as tiny pale
flecks, very sparse. No footprints, no rocks breaking through, no
debris.

Colour palette, almost white with cool blue shadows in the troughs,
base colour #ECEFF3, troughs around #D6DEE6, crests around #F7F9FB.
The whole image must stay bright; the darkest tone anywhere is still a
light blue-grey.

Style: stylised hand-painted game art in the spirit of a printed board
game tile or a European comic album. Very calm, very few marks, large
clean readable shapes, soft painterly edges, a reduced palette.
Absolutely no photographic grain, no fine speckled noise, no realistic
snow photo texture.

Lighting: completely flat and even across the entire image. No cast
shadows, no highlights, no sun direction picking out the sastrugi, no
ambient occlusion, no vignette, no darkening toward any edge or corner.
The brightness at the four borders must match the centre exactly.

Composition: the pattern must tile seamlessly when repeated left to
right and top to bottom. No frame, no border, no watermark, no text.
```

---

## 8 · `mat_geroell_alb.png` — Schutt am Bergfuß

```
A seamless tileable 1024x1024 texture of loose rock scree, viewed from
directly above at a perfectly perpendicular angle, painted by hand.

The image is packed with broken angular stones, each roughly one
twentieth to one twelfth of the image wide, lying tightly against one
another with only narrow gaps. Every stone is an irregular polygon with
straight edges and sharp corners, freshly broken rather than
water-worn, and each is turned at its own angle so no two look alike.
Between the stones sits a little fine grit in the same colour family.
The stones must stay individually readable and not merge into a mush.

Colour palette, the same warm granite family as the rock tiles, use
these exact values: #745E42 for the darker stones and the grit between
them, #967F5F as the dominant mid tone, #B29F80 for lighter stones,
with a few at #CAB794. Warm ochre-brown, never neutral grey.

Style: stylised hand-painted game art in the spirit of a printed board
game tile or a European comic album. Chunky clean readable shapes, flat
colour areas with soft painterly edges, a reduced palette. Absolutely
no photographic grain, no fine speckled noise, no realistic gravel
photo texture.

Lighting: completely flat and even across the entire image. Each stone
is one flat tone; no cast shadows between the stones, no highlights, no
sun direction, no ambient occlusion, no vignette, no darkening toward
any edge or corner. The brightness at the four borders must match the
centre exactly.

Composition: the pattern must tile seamlessly when repeated left to
right and top to bottom. No frame, no border, no watermark, no text.
```

---

# Optional: Höhenkarten für den Fels

Nur für die vier Fels-Materialien, gleicher Aufbau wie die zugehörige
Albedo. Dateiname `mat_fels_hgt.png`, `mat_fels_winter_hgt.png`,
`mat_fels_wueste_hgt.png`, `mat_fels_vulkan_hgt.png`.

```
A seamless tileable 1024x1024 GRAYSCALE HEIGHT MAP of a weathered rock
surface broken into large angular plates, viewed from directly above.

Pure greyscale only, no colour anywhere. Bright means high, dark means
low. Each plate is a broad area of near-white with a smooth gentle
gradient across it, so plates read as slightly domed slabs. The cracks
between the plates are narrow lines of near-black with a sharp drop at
the plate edge, not a soft fade. A few plates sit a little lower than
their neighbours and are therefore a uniform mid grey.

The plates are irregular polygons with straight edges and sharp
corners, roughly one sixth to one quarter of the image wide, matching
the layout of a rock texture.

No lighting information, no cast shadows, no surface colour, no
material detail, no grain, no noise. Only height. Nothing in the image
means anything except elevation.

The pattern must tile seamlessly when repeated left to right and top to
bottom. No frame, no border, no watermark, no text.
```

---

## Abnahme

Zwei schnelle Prüfungen, bevor du eine Kachel schickst:

1. **Kachelprobe** — das Bild vierfach nebeneinander legen. Sichtbare
   Kreuze oder wiederkehrende Auffälligkeiten heißen: nicht nahtlos.
2. **Randprobe** — sind die Ränder genauso hell wie die Mitte? Ein
   dunkler Saum ergibt später ein Gitter über die ganze Karte.

Beides messe ich beim Einbau ohnehin nach und melde die Zahlen zurück.
