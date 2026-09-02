# Kapitel 11 – Gebirge

Anhängen an `stilguide.md`. Deckt Felsflächen, Wandtexturen, Felsobjekte,
Bergwerke, Eis und Wasser ab. Alle Zahlen sind an den gelieferten Assets
gemessen, nicht geschätzt.

---

## 11.1 Was den Stil bestimmt

Das Gebirge wird nicht als fertig beleuchtetes Bild gemalt, sondern aus
neutralen Texturen im Spiel zusammengesetzt. Daraus folgt fast alles andere.

**Der Renderer schattiert, nicht die Textur.** Das Höhenmodell rechnet die
Hangbeleuchtung mit gemittelten Vertexnormalen, Helligkeitsbereich etwa
`0.55` bis `1.00`, Licht von oben links. Jede Kachel muss deshalb völlig
richtungslos beleuchtet sein — sonst multiplizieren sich zwei Beleuchtungen.

**Die Textur muss lauter sein als die Schattierung.** Das ist der Grund,
warum das Gebirge im Facettenstil überhaupt funktioniert: sind die
Dreieckskanten das einzige Signal im Bild, sieht man das Gitter. Ist die
Textur kontrastreicher, verschwindet es. Kennwert:

```
Kontrastverhältnis = (p95 / p5 der Luminanz) / 1.82
```

Über 1,0 heißt: Textur übertönt die Schattierung. Zielband **1,2 bis 1,5**.
Darunter scheint das Gitter durch, darüber erschlägt die Textur die
Geländeform.

**Objekte werden dagegen fertig beleuchtet.** Felsobjekte, Bergwerke und
Gebäude bekommen Licht von oben links eingebacken, harte Tonwertbrüche
zwischen den Flächen, keine weichen Verläufe. Bodenschatten macht das Spiel.

---

## 11.2 Palette

Hergeleitet aus dem gemessenen Bildschirmfoto: Wiese liegt bei Sättigung
0,75 und Luminanz 125, Wasser bei 0,39 und 89. Der Fels muss darunter
bleiben, aber in derselben Familie sitzen.

**Fels** — identisch mit den Straßensteinen aus Kapitel 10:

| Rolle | Wert |
|---|---|
| Spitzlicht | `#BCAE93` |
| hell | `#A49B8A` |
| mittel | `#8A7E68` |
| Schatten | `#6A5C4A` |
| Tiefschatten | `#57503F` |

Nichts heller als `#BCAE93`. Sättigung 0,38–0,42.

**Eis und Firn:**

| Rolle | Wert |
|---|---|
| Firn hell | `#E4E6E2` |
| mittel | `#C2CACC` |
| Eisschatten | `#93A6AC` |
| Spaltentiefe | `#5E7378` |

Sättigung **0,10–0,14**. Nicht höher — bei fast farblosem Ausgangsbild
verstärkt jede Nachregelung die wenige Farbe zu Cyan.

**Moos und Flechten:** Moos `#4E6B3A` / `#5F7D45` / `#74914F`,
Flechten `#A8935C` / `#C0AE74`. Deckung rund ein Drittel.

**Wasser:** tief `#334D53`, mittel `#3A585E`, hell `#4E7178`, Wellenlicht
`#577E83`. Sättigung 0,38, mittlere Luminanz um 83. Kein Türkis, kein Cyan.

---

## 11.3 Die vier Regeln, die Geld gekostet haben

**1. Das Referenzbild trägt Material, nicht Disziplin.** Es überträgt
zuverlässig Farbe, Machart und Pinselhandschrift. Es überträgt *nicht*
flache Füllung, kantige Ränder oder Fugenmaß. Die Disziplinzeilen aus 11.4
müssen in jedem Prompt stehen, auch wenn eine Referenz hochgeladen ist.

**2. Transparenz-Modus schaltet Referenzbilder ab.** Objekte und Gebäude
immer auf weißem Grund generieren und danach freistellen.

**3. Blockgröße als Bruchteil der Objekthöhe angeben, nie als Anzahl.**
„16 Facetten hoch" bezieht das Modell auf das feine Rissnetz und liefert das
Doppelte. „Jeder Block ist etwa ein Sechstel der Turmhöhe" ist eindeutig.

**4. Größenanker im Prompt funktionieren nicht.** Relative Höhen werden
ignoriert, alles kommt formatfüllend. Die relativen Größen werden beim
Schneiden gesetzt, nicht beim Generieren.

---

## 11.4 Bausteine zum Einsetzen

Diese drei Blöcke gehören in jeden Fels-Prompt. Wörtlich übernehmen.

**Disziplin** — gegen verwaschene Platten, Krümelränder und Feinrissteppich:

```
Each surface is a SINGLE FLAT TONE with only very subtle mottling. No soft
gradients inside a face, no airbrushed shading, no painterly blending, no
photographic weathering detail.
Outlines are ANGULAR and hard-edged, straight or gently kinked, with the
occasional small chip knocked out of a corner. Do NOT round them into blobs
or amoeba shapes. Do NOT line the edges with rows of small pebble-like nubs,
and do NOT place pale pebbles inside the cracks.
A few of the larger faces carry one or two long hairline cracks that do not
break them apart. Most stay completely unbroken. Do not cover the surface in
a fine crack network.
```

**Licht für Flächenkacheln** — gegen eingebackene Beleuchtung:

```
ALL darkness comes from DEPTH ONLY. Cracks and joints are dark because they
are deep. Every flat face is evenly lit — do NOT shade one side of a block
darker than the other, do NOT give any block a lit face and a shadow face,
do NOT imply a sun position. No light direction, no cast shadows, no bevel
highlight, no vignette. The overall brightness must be evenly balanced
across the whole frame: left half as bright as the right half, top half as
bright as the bottom half, and no smooth slope from one side to the other.
```

**Licht für Objekte** — das Gegenteil, hier wird bewusst beleuchtet:

```
Isometric three-quarter view, camera 40 degrees above the horizon. Light
from the upper LEFT: surfaces facing up and left are bright, surfaces facing
right and down are dark. Hard tonal breaks between faces, no soft gradients
across a face, no rim light.
No ground shadow, no cast shadow on the background, no ground plane, no base
plate.
```

**Kachelung** — zwingend bei allen Flächen- und Wandtexturen:

```
Fills the frame edge to edge and is seamlessly tileable on all four sides:
the pattern at the left edge continues into the right edge, top into bottom.
No border, no frame, no drop shadow, no text, no watermark.
```

Bei Wandtexturen zusätzlich:

```
CRITICAL: the TOP edge must continue into the BOTTOM edge — every vertical
column that reaches the top edge lines up with a column of the same width at
the bottom edge, and no horizontal crack may run along the top or bottom
edge itself.
```

---

## 11.5 Pipeline

```
  ter_rock_top (Master, ohne Referenz generiert)
    │  heilen --saettigung 0.40 --deckel 175 --entkippen
    ├─► ter_rock_top2, ter_rock_rubble, ter_rock_moss   (Referenz: Master)
    ├─► ter_rock_cliff                                   (Referenz: Master)
    │      └─► ter_rock_cliff2                           (Referenz: cliff)
    ├─► Objektblatt 2×3                                  (Referenz: Master)
    └─► Minenblatt 2×2                                   (Referenz: Master)
           └─► Baustufenblatt 1×3                        (Referenz: Kohlemine)
  ter_glacier ──► ter_ridge_snow
```

**Sammelblätter statt Einzelbilder.** Was zusammen aussehen muss, entsteht in
einer Generierung — Bilder aus derselben Generierung können nicht
auseinanderdriften. Objekte 2×3 auf 1024×1536, Minen 2×2 auf 1024×1024,
Baustufen 1×3 auf 1536×1024.

**Zwei Ketten weichen ab.** Die Baustufen referenzieren die *fertige
Kohlemine*, nicht den Master — nur so stimmt die Perspektive mit den fertigen
Minen. Die Wandvariante referenziert die *neue Wand*, nicht den Master.

**Nach jeder Generierung nachbehandeln.** Roh geliefert stimmt keine Kachel:

```
python3 kachel_werkzeug.py pruefen X.png
python3 kachel_werkzeug.py heilen X.png --saettigung 0.40 --deckel 175 --entkippen
```

Fels 0.40, Wasser 0.38, Eis **0.10**. Beim Eis kein `--deckel`.

**Danach auf Zweierpotenz**, wickelnd verkleinert, sonst reißt die Naht
wieder auf:

```python
a = np.asarray(im); S = a.shape[0]; p = 64
w = np.pad(a, ((p,p),(p,p),(0,0)), mode='wrap')
big = Image.fromarray(w).resize((int((S+2*p)*ziel/S),)*2, Image.LANCZOS)
o = int(p*ziel/S)
big.crop((o, o, o+ziel, o+ziel)).save(pfad)
```

---

## 11.6 Schneiden von Sammelblättern

`schneiden_final.py`. Drei Dinge, die es anders macht als naives Zerteilen:

**Kein Rasterschnitt.** Der Hintergrund wird einmal über das ganze Blatt
bestimmt, Objektteile werden gefunden und dem nächsten Rasterplatz
zugeordnet. Objekte ragen regelmäßig über ihre Zellgrenze; ein starrer
Schnitt köpft sie.

**Lichthof abziehen.** Manche Blätter haben einen weichen Hof um die Objekte
— beim zweiten Objektblatt 15 000 Pixel im Band 230–240 gegen 831 beim
ersten. Als Objekt eingestuft bleibt er als heller Saum stehen. Maske um zwei
Pixel schrumpfen, Kantenfarbe aus dem Inneren nachziehen. Prüfwert: die
halbtransparenten Randpixel dürfen höchstens 10 Luminanzstufen heller sein
als das Objektinnere.

**Gemeinsames Blockmaß über alle Blätter.** Jedes Blatt bekommt eine eigene
Skala, so gewählt, dass die mittlere Blockkante über *alle* Objekte gleich
ist und das breiteste noch passt. Ohne diesen Schritt sind zwei Blätter
unabhängig auf ihre Leinwand normiert und die Blöcke unterschiedlich groß.

**Ausrichtung.** Unterkante = Bodenlinie, 4 % Rand. Bei Gebäudereihen
zusätzlich auf ein Bauteil ausrichten, nicht auf die Bounding Box: die
Baustufen laufen sonst seitlich weg, weil Stufe 1 kein Gleis hat. Verwendet
wird der Schwerpunkt des oberen Objektdrittels, also der Felsdom.

---

## 11.7 Prüfwerte

| Kennwert | Fläche | Wand | Eis | Wasser | Objekte |
|---|---|---|---|---|---|
| Naht x/y | <1,3 | <1,3 | <1,3 | <1,3 | – |
| Neigung x/y | ±5 | ±5 | ±5 | ±5 | – |
| Spitzlicht | <175 | <175 | <235 | <150 | <175 |
| Kontrast zum Shading | 1,2–1,5 | 1,2–1,5 | >1,0 | egal | – |
| Sättigung | 0,38–0,42 | 0,38–0,42 | 0,10–0,14 | 0,36–0,40 | 0,38–0,42 |
| Plattenmaß | 1/14–1/20 | 1/8–1/12 | 1/8–1/12 | egal | – |
| Tonfelder | 30–50 | 28–45 | >25 | egal | – |
| Relief-Delta | <6 | <15 | <15 | <5 | – |
| Blockmaß Streuung | – | – | – | – | Faktor <1,7 |
| Weißsaum | – | – | – | – | <10 |

Zwei Kennwerte sind mit Vorsicht zu lesen:

**Naht als Quotient bläht sich auf**, wenn die Kachel aus großen flachen
Platten besteht — innen passiert wenig, also wirkt jeder Rest am Rand groß.
Bei Werten knapp über 1,3 den absoluten Kantensprung gegen die mittlere
Nachbardifferenz halten. Liegt er darunter, ist alles in Ordnung.

**Lichtgefälle unterscheidet nicht** zwischen echter Schräge und großen
Tonfeldern. Dafür gibt es den Ebenenanteil: über 12 % oder eine Neigung über
8 heißt echte Schräge, darunter sind es Tonfelder und harmlos.

---

## 11.8 Fehlerkatalog

Symptome, die in dieser Reihenfolge aufgetreten sind, mit Ursache und Griff.

| Symptom im Bild | Ursache | Griff |
|---|---|---|
| Sichtbares Dreiecksraster im Gelände | Flache Schattierung pro Fläche, Quantisierung auf 8–12 Stufen | Vertexnormalen mitteln, Quantisierung streichen, Textur-UV vom Gitter entkoppeln |
| Berg wirkt wie Sandloch in der Wiese | Kein Klippenpass, kein Schlagschatten, Spitzlicht 45 % heller als das hellste Grün | Wandtextur ab 45° Hangneigung, Fußverdunklung, Spitzlicht deckeln |
| Kachel wie verlegte Steinfliesen | Alle Fugen gleich breit und gleich tief, keine Tonfelder | Rissbreite und -tiefe ausdrücklich variabel fordern, blind endende Risse, Tonfelder |
| Platten verwaschen, rundlappig, Krümelränder | Zeile zur flachen Füllung fehlt, „weathering" überzogen | Disziplinblock aus 11.4 |
| Kachel liest sich als Kiesbett | Alle Platten gleich groß, Tonwerte zufällig gestreut | Größenvariation und Cluster fordern, im Shader zweite Textur-Lage per Rauschmaske |
| Wandtextur wie Cord oder Rinde | Waagerechte Bänder parallel und gleich verteilt, gemalte 3D-Sims | Senkrechte Klüfte als Hauptsignal, Bänder unregelmäßig, keine vorspringenden Sims |
| Wandtextur wie Trockenmauerwerk | Schichtung führt statt zu folgen | Bänder zurücknehmen, Säulen dominieren lassen |
| Objekte alle gleich groß | Größenanker im Prompt wird ignoriert | Relative Größe beim Schneiden setzen |
| Objekte feiner gebrochen als der Rest | Blockgröße als Anzahl statt als Bruchteil angegeben | Bruchteil der Objekthöhe, dazu Referenzbild mit vorbildlichen Objekten |
| Heller Saum um freigestellte Objekte | Lichthof im Blatt als Objekt eingestuft | Maske schrumpfen, Kantenfarbe nachziehen |
| Baustelle kippt gegenüber dem fertigen Gebäude | Baustufen gegen den Material-Master referenziert | Gegen das fertige Gebäude referenzieren |
| Schnee wirkt wie Beton | Sättigung unter 0,05 | auf 0,10–0,14 anheben |
| Schnee wirkt türkis | Sättigung über 0,15 bei fast farblosem Ausgangsbild | auf 0,10 zurück |
| Wasser wirkt als Loch | Luminanz 65 gegen Wiese 125 | auf etwa 83 anheben |

---

## 11.9 Was sich nicht messen lässt

Zwei Eigenschaften bleiben Augenmaß, dafür gibt es keinen Kennwert:

**Fliesen gegen verwitterten Fels.** Versucht wurden Fugenbreiten-Streuung
und der Anteil blind endender Risse. Beide unterschieden nicht — die
Fliesenkachel schnitt teils besser ab als eine gute. Der einzige Hilfswert
ist die Tonfeld-Spanne, und die misst nur einen Teilaspekt.

**Kantiger Facettencharakter.** Zwei Fassungen können identische Kennwerte
haben und trotzdem unterschiedlich hart wirken. Bei gleichen Zahlen die
Fassung mit den härteren Kanten nehmen.

---

## 11.10 Werkzeuge

`kachel_werkzeug.py` — `pruefen`, `heilen`, `schneiden`
`schneiden_final.py` — Sammelblätter mit gemeinsamem Blockmaß

Beide brauchen nur Pillow, numpy und scipy.

---

## 11.11 Bestand

**Flächenkacheln, 1024×1024, nahtlos, richtungslos**
`ter_rock_top` · `ter_rock_top2` · `ter_rock_rubble` · `ter_rock_moss` · `ter_glacier`

**Kleine Kacheln, 512×512**
`ter_ridge_snow` · `ter_water`

**Wandtexturen, 1024×1536**
`ter_rock_cliff` · `ter_rock_cliff2`

Nicht quadratisch, deshalb im Shader:

```
cliffScale.y = cliffScale.x * 1.5 / 0.64      # Seitenverhältnis × Stauchung bei 40°
```

**Felsobjekte, 512×512, transparent, gemeinsames Blockmaß 62,5 px**
`obj_rockspire_1` bis `_6` · `obj_crag_1` · `obj_crag_2` · `obj_summit_1` ·
`obj_cliff_ledge` · `obj_glacier_snout` · `ter_scree_cone`

Alle mit einem Zeichenfaktor verwendbar, Unterkante ist die Bodenlinie.

**Bergwerke, 320×300, transparent, Domachse bei 47,4 % der Breite**
`bld_coalmine` · `bld_ironmine` · `bld_goldmine` · `bld_granitemine` ·
`bld_build_mine_1` bis `_3`

Baufortschritt 51 % → 75 % → 88 % → 100 % der fertigen Höhe. Ebenfalls ein
gemeinsamer Zeichenfaktor.
