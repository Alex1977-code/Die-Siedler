# Grafik-Stilguide – Siedler-Aufbauspiel

Das einzige gültige Stilguide-Dokument. Alle Prompts stehen vollständig ausgeschrieben und sind direkt einsetzbar – nichts zusammenzusetzen, nichts einzufügen.


Aufgeräumte Fassung. Enthält nur, was aktuell gilt. Die vollständige
Historie inklusive der verworfenen Ansätze (alter fotorealistischer Stil,
gescheiterte Sammelprompt-Varianten, Beinphasen-Experimente) steht im
großen Dokument `siedler_grafik_stilguide.md`.

## Der Stil in einem Satz

Knuffiger Cartoon-Look mit gedrungenen Proportionen, großen Nasen, klobigen
vereinfachten Formen und weicher 3D-Volumen-Schattierung – bewusst
detailarm, weil alles klein auf der Karte dargestellt wird.

## Zwei Produktionswege

| Was | Wie | Warum |
|---|---|---|
| **Figuren und Tiere** | A-Pose-Bild (gpt-image-2) → Tripo Image-to-3D → Auto-Rig → Animations-Preset → als Sprites rendern | Bewegung: viele Laufphasen × 5 Richtungen lassen sich per Bildprompt nicht konsistent erzeugen |
| **Alles andere** | Direkt als 2D-Bild, gruppenweise in Sheets | Steht still, feste isometrische Kamera – ein Bild reicht |

## Feste Regeln

- **Kamera**: isometrisch, 40° Höhenwinkel – bei jedem Asset gleich
- **Licht**: immer von oben-links, dreht sich nie mit
- **Hintergrund**: weiß und opak, nie transparent (deaktiviert bei
  gpt-image-2 die Referenzbild-Nutzung); Effekte auf schwarz für Alpha
- **Referenzbilder**: ohne begleitende Aussehensbeschreibung im Text –
  Beschreibung und Referenzbild konkurrieren sonst miteinander
- **Größenverhältnisse**: Kartenobjekte im Sheet mit dem Wohnhaus als
  Anker (Wohnhaus = 1). Waren- und HUD-Icons dagegen ausdrücklich alle
  gleich groß
- **Spielerfarben**: Umhang und Helmbusch der Soldaten sind flache,
  gleichmäßige Farbflächen – Umfärbung für Mehrspieler per Shader-Tint,
  nicht sechsmal generieren
- **Freistellen**: Größenverhältnisse aus den Sheets beibehalten, nicht
  jedes Objekt auf einheitliche Pixelgröße skalieren

---


---

# 1. Figuren und Tiere


## 1.1 Produktionsweg: Bild zu 3D

Grundidee: statt jede Pose als Bild zu erwürfeln, die Figur **einmal** als 3D-Modell erzeugen und daraus alle Richtungen und Laufphasen rendern - genau die Produktionstechnik der 90er-Aufbauspiele. Löst alle vier Probleme, an denen die Prompt-Route hängt: identische Figur in jedem Frame, exakt gleicher Kamerawinkel, gleicher Bodenpunkt, echter Beinwechsel.

### 1.1.1 Schritt 1 - Sauberes A-Pose-Bild als 3D-Input

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

### 1.1.2 Schritt 2 - Bild zu 3D-Modell

Tool z. B. Meshy (Image to 3D) oder Tripo. Wichtig laut Meshy-Doku: in der Image-to-3D-Konfiguration die Pose-Option auf T-Pose bzw. A-Pose stellen bzw. Custom Pose Control mit Referenzbild nutzen, BEVOR generiert wird.

Zur Beruhigung: Die bei KI-generierten Meshes übliche Schwachstelle - unsaubere Topologie - ist in eurem Fall weitgehend egal. Ihr rendert das Modell nur zu 2D-Sprites; das Mesh selbst landet nie im Spiel. Was im gerenderten Bild gut aussieht, reicht.

### 1.1.3 Schritt 3 - Auto-Rigging

Meshy und Tripo riggen automatisch. Laut Meshy-Tutorial wichtig:
- Figur vor dem Riggen zentrieren, nach vorn ausrichten, Füße auf Bodenhöhe - sonst sitzt der Root-Bone falsch und die Animation ist versetzt
- Stark stilisierte Proportionen (großer Kopf, kurze Beine - also genau euer Fall) sind kein Hindernis; die Rigging-Punkte müssen aber an die tatsächlichen Gelenke gesetzt werden, nicht dorthin, wo sie bei normalen Proportionen wären
- Nach dem Riggen sofort eine Walk-Animation abspielen: Schulter- und Hüftfehler sieht man dort in zwei Sekunden

### 1.1.4 Schritt 4 - Laufanimation aus der Preset-Bibliothek

Meshy bringt laut eigenen Angaben 600+ Motion-Clips mit (Walk, Idle, Run u. a.). Walk-Preset auswählen - damit habt ihr einen anatomisch korrekten Zyklus inklusive Beinwechsel, Armschwung und vertikalem Bob, ohne dass irgendetwas davon per Text beschrieben werden muss.

### 1.1.5 Schritt 5 - Export und Rendering zu Sprites

Export als GLB/FBX. Für das Rendern zu 2D-Sprites:

- **Kamera**: orthographisch (nicht perspektivisch - sonst passen die Sprites nicht zur isometrischen Karte), Höhenwinkel ~40 Grad, in 5 Richtungen um die Figur (die übrigen 3 durch Spiegeln)
- **Licht**: fix von oben-links, in allen Renderings identisch - nicht mit der Kamera mitdrehen
- **Frames**: Laufzyklus gleichmäßig abtasten, z. B. 8 Frames pro Richtung; Frame-Anzahl ist jetzt frei wählbar, da sie nichts mehr kostet
- **Ausgabe**: PNG mit Alphakanal, gleiche Bildgröße und gleicher Bodenpunkt in allen Frames (ergibt sich beim Rendern automatisch, wenn Kamera und Figur-Root fix bleiben)

Werkzeuge: Blender (kostenlos) für volle Kontrolle, oder der kostenlose Open-Source "Sprite Builder" (MIT-Lizenz), der GLB-Modelle mit Animationssequenzen im Batch als 2D-Sprites exportiert.

### 1.1.6 Schritt 6 - Restliche Figuren

Pro Figur denselben Ablauf. Der Schmalzpunkt: Rig und Animationen lassen sich zwischen ähnlich proportionierten Figuren oft wiederverwenden - die 12 verbleibenden Menschen-Figuren teilen sich denselben Körperbau, es ändern sich nur Kleidung und Ausrüstung.

### 1.1.7 Was diese Route besser und was sie schlechter macht

Besser: exakte Posen-Kontrolle, perfekte Konsistenz, beliebig viele Frames und Richtungen zum Nulltarif, Aktionen (Wurf, Hieb, Arbeitsbewegung) über dieselbe Preset-Bibliothek statt über neue Prompt-Experimente.

Schlechter: einmalige Einarbeitung in ein 3D-Tool, und der Look des 3D-Modells wird nie zu 100 Prozent dem gefeilten 2D-Bild entsprechen - AI-Rekonstruktionen interpretieren verdeckte Seiten. Deshalb: erst den Träger komplett durchspielen und das Ergebnis anschauen, bevor die anderen 12 Figuren folgen.

---


---


## 1.2 A-Pose-Prompts der Figuren

Richtet sich exakt nach eurer Figurenliste. Nicht enthalten: Träger (#1) und Schwertkämpfer (#4), die sind fertig. Ablauf pro Figur unverändert: Prompt + Referenzbild in gpt-image-2 -> A-Pose-Bild -> Tripo Image-to-3D -> Auto-Rig -> Animationen.


### 1.2.1 Referenzbild-Zuordnung


- **#5 Speerkämpfer, #6 Bogenschütze**: den fertigen **Schwertkämpfer** als Referenz (Rüstung, Umhang, Helm, Farben sitzen dort schon).
- **#2, #3, #7-#27**: den fertigen **Träger** als Referenz (Stil, Proportionen, Gesichtsdesign; Kleidung wird im Prompt neu beschrieben).
- **#28 Esel, #29 Schaf**: Träger nur als Stil-/Render-Referenz, beim Riggen in Tripo als **Quadruped** wählen, nicht Humanoid.
- **#30 Schiff**: statisches Objekt, kein Rigging, keine A-Pose.
- **#13 Jäger** bekommt bewusst KEINE Soldatenrüstung (Fellweste, ziviler Bogen), damit er im Spiel nicht mit dem Bogenschützen verwechselt wird.
- **#23 Bergmann** deckt laut eurer Liste alle vier Bergwerke ab - ein Modell, kein Farb-/Werkzeugunterschied nötig.


### 1.2.2 Gemeinsamer Schlussblock (steht in jedem Figuren-Prompt unten schon drin)


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


### 1.2.3 Die Prompts (vollständig, copy-paste-fertig)


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


### 1.2.4 Tiere und Schiff


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


---


## 1.3 Neue Berufsfiguren

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

Der **Schreiner** (Sägewerk) und der **Werftarbeiter** aus Kapitel 1.2 sind sich inhaltlich nah - beide Zimmermannsberufe mit Säge. Ich habe den Werftarbeiter mit Säge UND Hobel plus Werkzeuggürtel beschrieben, den Schreiner nur mit Säge und Schürze, damit sie sich im Spiel unterscheiden lassen. Falls euch das zu knapp ist: dem Werftarbeiter zusätzlich eine Schiffsplanke oder ein Tau in die Hand geben.

---


## 1.4 Wildtiere

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


## 1.5 Karten-Deko: wuselnde Schweine

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


## 1.6 Arbeitsanimationen aus dem Skelett

Tripos Preset-Bibliothek liefert Gehen, Warten und generische Kampfbewegungen, aber kein "Netz auswerfen" oder "kniend klopfen". Statt zwölf Clips einzeln zu bauen: die Arbeitsbewegungen im Code aus dem vorhandenen Rig erzeugen, indem gezielt einzelne Knochen rotiert werden.

### 1.6.1 Warum das hier besonders gut funktioniert

Die Figuren werden am Ende als kleine Sprites dargestellt. Auf dieser Größe trägt das Werkzeug in der Hand die Information, nicht die Feinmechanik der Bewegung - ein Hammerschlag ist optisch nicht von einem Axthieb oder einem Meißelschlag zu unterscheiden. Es reichen deshalb **drei generische Bewegungen** für alle zwölf Berufe.

### 1.6.2 Die drei Bewegungen

| Bewegung | Deckt ab | Kern |
|---|---|---|
| **Schwung** | Bauarbeiter, Holzfäller, Steinmetz, beide Schmiede, Metzger, Hüttenarbeiter, Bergmann, Bauer (Mähen) | Werkzeugarm holt über Schulterhöhe aus und schlägt nach vorn-unten durch, Oberkörper neigt sich mit |
| **Bücken** | Planierer, Förster, Bauer (Säen), Brunnenbauer, Geologe | Hüfte und Wirbelsäule beugen sich nach vorn, Knie leicht ein, Arm greift zum Boden und zurück |
| **Strecken** | Fischer, Späher | Arm und Oberkörper strecken sich nach vorn-oben und schwingen zurück |

Bäcker, Müller, Brauer, Goldschmied, Schweinehirt, Eselhirt, Werftarbeiter, Schreiner und Dorfbewohner brauchen laut eurer Liste ohnehin nur Gehen und Warten.

### 1.6.3 Knochen und Rotationen

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

### 1.6.4 Umsetzung

- Nur die genannten Knochen anfassen, alle übrigen aus der Idle-Pose übernehmen. Dann bleibt die Figur unten stabil stehen, während oben gearbeitet wird.
- Zwischen den Phasen mit einer Ease-Funktion interpolieren (`easeInOutQuad` o. Ä.), nicht linear - lineare Knochenrotation sieht mechanisch aus.
- Beim Wechsel Gehen zu Arbeiten über etwa 0,2 s überblenden, sonst springt die Figur.
- Der Geologe soll laut eurer Liste kniend klopfen: Standard-Bücken nehmen und zusätzlich `LeftUpLeg` auf etwa +90 Grad und `LeftLeg` auf -90 Grad setzen, dann kniet er. Das ist die einzige Figur, für die sich eine Sonderbehandlung lohnt, weil die Kniehaltung auch klein erkennbar bleibt.

### 1.6.5 Falls ihr Sprites backt statt live zu rendern

Der Ansatz funktioniert genauso: Skelett per Skript in die Phasenposen setzen, Zwischenwerte interpolieren, Frames aus der 40-Grad-Kamera rendern. Bei Arbeitsbewegungen reichen 4 bis 6 Frames pro Zyklus - anders als beim Laufen fällt hier eine geringe Bildrate kaum auf, weil die Figur an Ort und Stelle bleibt und das Auge keine Bewegungsrichtung verfolgt.

---


---

# 2. Gebäude


Zwei Probleme auf einmal gelöst: Einzelbilder haben keinen Größenbezug (jedes Gebäude wird formatfüllend gerendert, also wird die Burg so groß wie die Hütte), und ihr wolltet weniger Prompts. Lösung: 7 Sheets mit je 6 Gebäuden, in jedem Sheet dasselbe Standard-Wohnhaus als Größenanker. Innerhalb eines Sheets stimmen die Verhältnisse, über den wiederkehrenden Anker auch zwischen den Sheets.


## 2.1 Die Größenskala (Wohnhaus = 1)


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


## 2.2 Die 7 Sheet-Prompts


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


## 2.3 Katapult (Einzelprompt, kein Gebäude)


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


## 2.4 Hinweis zum Zuschneiden

Beim Freistellen die Größenverhältnisse UNBEDINGT beibehalten - also nicht jedes Gebäude auf eine einheitliche Bildgröße skalieren, sondern mit gemeinsamem Maßstab zuschneiden und die Pixelgröße unterschiedlich lassen. Sonst ist der ganze Aufwand im Sheet umsonst.

---


---


## 2.5 Baustellen in drei Größenklassen

Statt 38 gebäudespezifischer Baustellen nur drei Sätze - klein, mittel, groß. Jeder Satz hat vier Stufen, wobei Stufe 4 das fertige Gebäude ist. Stufe 4 braucht ihr nicht auszuschneiden (die fertigen Gebäude habt ihr aus Kapitel 2.2); sie steht bewusst mit im Prompt, weil sie dem Modell zeigt, worauf die drei Bauphasen hinauslaufen sollen - dadurch werden die Zwischenstufen stimmiger.


### 2.5.1 Die vier Stufen


| Stufe | Was zu sehen ist |
|---|---|
| 1 | Abgesteckte, planierte Erdfläche mit Pfählen und Schnur, flacher Graben, Schaufel |
| 2 | Fundament fertig, Ständerwerk aus Holz steht - offen, ohne Wände und Dach |
| 3 | Wände weitgehend zu, Dachstuhl steht aber ist noch nicht gedeckt, Gerüst und Leiter dran |
| 4 | Fertiges Gebäude (habt ihr bereits - nur als Zielbild im Prompt) |

Kernvorgabe in allen drei Prompts: Die Baustelle wird nicht breiter, sondern nur höher. Alle vier Stufen belegen dieselbe Grundfläche, sonst springt das Gebäude beim Baufortschritt auf der Karte.


### 2.5.2 Zuordnung Gebäude zu Größenklasse


| Klasse | Gebäude |
|---|---|
| **Klein** (Höhe 1) | Wohnhäuser 1-3, Holzfäller, Förster, Fischer, Jäger, Brunnen, Marktstand, Schweinezucht, Wachhaus, Metzger, Münzprägerei |
| **Mittel** (Höhe 1,5) | Sägewerk, Lagerhaus, Bauernhof, Bäckerei, Brauerei, Eisenhütte, Waffenschmiede, Werkzeugschmiede, Werft, Hafen, Eselzucht, Steinmetz, Baracke, alle vier Bergwerke |
| **Groß** (Höhe 3) | Hauptquartier, Festung, Mühle, Kapelle, Zehntscheune, Wachturm |

Wachturm ist zwar schmal, aber hoch - er passt trotzdem besser zu groß als zu mittel, weil der Bauablauf bei einem Steinturm eher dem großen Gebäude gleicht.


### 2.5.3 Die drei Prompts


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


### 2.5.4 Hinweis zum Einbau

Beim Zuschneiden alle vier Stufen mit identischem Ausschnitt und identischer Bodenlinie schneiden - also einen festen Rahmen über alle vier legen, nicht jede Stufe einzeln eng beschneiden. Nur dann wächst das Gebäude im Spiel sauber nach oben, statt bei jedem Phasenwechsel zu verrutschen.

---


---

# 3. Gelände (Höhenmodell)


## 3.1 Terrain- und Steilwand-Texturen

Der entscheidende Satz steht in jedem Kopf: die Textur darf KEINE eigene Beleuchtung mitbringen - keine Schlagschatten, kein Ambient Occlusion, keine gebackenen Glanzlichter. Sämtliche Schattierung entsteht aus den Mesh-Normalen. Eine Textur mit eingebackener Beleuchtung kämpft sonst gegen die Hangschattierung und lässt Hänge flach wirken.

**Reihenfolge:** Die drei Prompts unter "Vorrangig" zuerst - eine gute Felskachel plus die beiden Steilwände geben dem Gebirge die Silhouette, die im Vorbild den Unterschied macht. Alles Weitere ist Feinschliff.

**Warum Steilwände überhaupt:** Eine Bodentextur wird an fast senkrechten Flächen extrem verzerrt. Deshalb bekommen steile Dreiecke ab einem Schwellwinkel (etwa 45 bis 55 Grad) eine eigene, seitlich ausgerichtete Textur mit waagerechter Struktur. Genau daraus entstehen die Vorsprünge aus Siedler 2.

#### Grosse Absturzkanten, Felsnadeln und Grenzstein

Acht Assets fuer den ausgebauten Gebirgs-Look. Abweichend vom Rest von
Kapitel 3 tragen diese eine eingebackene Beleuchtung von oben links wie
die Gebaeude - sie werden als Objekte bzw. Wandflaechen aus fester
Kameraperspektive gesehen, nicht ueber wechselnd geneigte Mesh-Dreiecke
gelegt. Kein eingebrannter Schlagschatten, den setzt der Renderer passend
zur Gelaendehoehe.

Bei `ter_cliff_tall.png` und `ter_scree_cone.png` steht ausdruecklich
KEIN Gras auf der Oberkante - die Grasnarbe legt der Renderer separat
auf.

| Datei | Groesse | Zweck |
|---|---|---|
| `ter_cliff_tall.png` | 512x1024 | grosser Absturz in einem Stueck, senkrechte Saeulenstruktur statt gestapelter Baender |
| `obj_rockspire_1/2/3.png` | je 512x512 | freistehende Felsnadeln, schlank / blockig / gedrungen |
| `ter_scree_cone.png` | 512x384 | Geroellkegel am Wandfuss, unten breit auslaufend |
| `ter_cliff_corner.png` | 384x512 | Aussenecke, damit Terrassen nicht abgesaegt enden |
| `ter_cliff_lava.png` | 512x512 | Basaltwand mit glimmenden Rissen fuers Vulkan-Szenario |
| `ui_pfosten.png` | 256x256 | Grenzstein, Wappenschild in reinem Weiss zum Einfaerben |

**`ter_cliff_tall.png`** (512x1024)
```
A seamless TALL CLIFF WALL texture for a stylized cartoon medieval
settlement-building game, in the tradition of classic 1990s isometric
settlement games. Tall portrait format, twice as high as it is wide.

SURFACE: a high grey mountain rock face with predominantly VERTICAL
structure - tall columnar basalt-like pillars of varied width running
the full height of the image, separated by deep narrow shadowed
clefts. The columns are broken irregularly by a few shallow horizontal
fracture lines that do not line up across neighbours, and a few narrow
ledges carry small loose stones. Muted desaturated warm grey, a few
faint patches of dry ochre lichen.

The vertical emphasis is the point: this texture covers one large drop
in a single piece, so it must NOT read as a stack of horizontal bands.

Soft painterly look, LOW contrast, chunky simplified shapes, no black
outlines, no fine speckle - the wall is drawn small in game, so
structure must stay bold and readable.

Lighting: soft light from the upper left, gently brightening the left-
facing column faces and shading the right-facing ones and the clefts.
No cast shadow on the ground, no drop shadow, no ambient occlusion
blob at the base.

Flat orthographic side view, seamlessly tileable on the LEFT and RIGHT
edges. NO grass, turf, soil or vegetation along the top edge - the
rock runs right up to the top of the frame. No rubble at the bottom.
Fully transparent background outside the rock face. No text, no
watermark, no UI, no objects, no characters, no sky, no border.
```

**`obj_rockspire_1.png`** (512x512)
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes, minimal fine surface detail, smooth
matte surfaces, muted desaturated warm grey palette, no black
outlines.

OBJECT: a free-standing rock spire - a SLENDER, tall, needle-like
pillar of grey stone rising steeply from a narrow rocky base, its
sides broken into a few large angular facets with one clear vertical
fracture line, the tip slightly leaning and irregular. A couple of
small loose stones at the foot. Roughly four times as tall as it is
wide.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, seen
from slightly above. Soft light from the upper left, brightening the
left-facing facets and shading the right-facing ones. No cast shadow
on the ground, no drop shadow, no ambient occlusion blob at the base.

Centered with empty margin on all sides, fully transparent background.
No text, no watermark, no UI, no ground plane, no grass, no background
scenery, no characters, no other objects.
```

**`obj_rockspire_2.png`** (512x512)
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes, minimal fine surface detail, smooth
matte surfaces, muted desaturated warm grey palette, no black
outlines.

OBJECT: a free-standing rock outcrop - a MEDIUM, blocky pillar of grey
stone, roughly twice as tall as it is wide, built of three or four
stacked angular blocks that step back slightly as they rise, with a
broad flat top and a wider rubble-strewn base. A couple of small loose
stones at the foot.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, seen
from slightly above. Soft light from the upper left, brightening the
left-facing facets and shading the right-facing ones. No cast shadow
on the ground, no drop shadow, no ambient occlusion blob at the base.

Centered with empty margin on all sides, fully transparent background.
No text, no watermark, no UI, no ground plane, no grass, no background
scenery, no characters, no other objects.
```

**`obj_rockspire_3.png`** (512x512)
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes, minimal fine surface detail, smooth
matte surfaces, muted desaturated warm grey palette, no black
outlines.

OBJECT: a free-standing rock outcrop - a SQUAT, wide crag of grey
stone, about as wide as it is tall, a low hunched mass with two uneven
humps, deep shadowed clefts between them and a broken slab leaning
against one side. A scatter of small loose stones at the foot.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, seen
from slightly above. Soft light from the upper left, brightening the
left-facing facets and shading the right-facing ones. No cast shadow
on the ground, no drop shadow, no ambient occlusion blob at the base.

Centered with empty margin on all sides, fully transparent background.
No text, no watermark, no UI, no ground plane, no grass, no background
scenery, no characters, no other objects.
```

**`ter_scree_cone.png`** (512x384)
```
A stylized cartoon SCREE FAN asset for a medieval settlement-building
game, in the tradition of classic 1990s isometric settlement games.
Landscape format, wider than it is high.

OBJECT: a talus cone of fallen rubble spilling out from the foot of a
high cliff - narrow and taller at the top center, spreading downward
and outward into a broad fan that widens toward the bottom of the
frame. Loose angular grey stones of clearly mixed sizes: larger broken
blocks near the top and center, progressively smaller gravel and grit
toward the outer edges. The outline is irregular and asymmetric, never
a clean triangle.

Chunky simplified shapes, muted desaturated warm grey palette, LOW
contrast, no black outlines, no fine speckle.

Isometric 3/4 view at a fixed 40-degree elevated camera angle,
matching the game's buildings. Soft light from the upper left. No cast
shadow on the ground, no drop shadow, no ambient occlusion blob.

The top edge of the cone ends in loose individual stones rather than a
straight line, so it blends into a cliff face above. The lower and
outer edges break up into single scattered stones and fade to nothing
so the fan sits naturally on the ground. NO grass, turf or vegetation
anywhere. Fully transparent background. No text, no watermark, no UI,
no cliff face, no characters, no border.
```

**`ter_cliff_corner.png`** (384x512)
```
A stylized cartoon CLIFF OUTER CORNER asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games. Tall portrait format, higher than it is wide.

OBJECT: the outer corner of a rock terrace where two cliff faces meet
at a right angle - a vertical wedge of grey stone showing BOTH faces,
the left face turned slightly toward the viewer and the right face
turned away, with a clear vertical arris running down the middle where
they meet. Horizontal strata run across both faces and line up across
the corner, and the arris itself is chipped and broken rather than a
clean sharp edge, with a few loose stones on the ledges.

Chunky simplified shapes, muted desaturated warm grey palette, LOW
contrast, no black outlines, no fine speckle - bold and readable at
small size.

Soft light from the upper left, so the left face is noticeably lighter
than the right face - that tonal difference is what makes the corner
read as a corner. No cast shadow on the ground, no drop shadow, no
ambient occlusion blob.

Flat orthographic view matching a fixed 40-degree isometric game
camera. The top and bottom edges end in broken rock so the corner
joins onto the surrounding wall textures. Fully transparent
background. No text, no watermark, no UI, no grass on top, no rubble
at the base, no characters, no sky, no border.
```

**`ter_cliff_lava.png`** (512x512)
```
A seamless BASALT CLIFF WALL texture for a stylized cartoon medieval
settlement-building game, in the tradition of classic 1990s isometric
settlement games. Square format.

SURFACE: a dark volcanic basalt wall seen straight on from the side -
near-black and charcoal columnar stone with strong VERTICAL jointing,
the columns of varied width and broken irregularly by a few shallow
horizontal fractures. A network of narrow cracks runs between and
across the columns, and inside the narrowest of these cracks a
restrained dull orange-red glow shows through, brightest deep in the
clefts and dying out toward the surface. A fine dusting of pale grey
ash settles on the few narrow ledges.

Keep the glow restrained: thin lines only, never large glowing pools
or bright flames, so the wall still reads as rock rather than as fire.

Chunky simplified shapes, LOW contrast in the stone itself, no black
outlines, no fine speckle - bold and readable at small size.

Lighting: soft light from the upper left on the stone. No cast shadow
on the ground, no drop shadow, no ambient occlusion blob at the base.

Flat orthographic side view, seamlessly tileable on the LEFT and RIGHT
edges. No grass or vegetation, no rubble at the base, no smoke, no
sparks, no lava flows. Fully transparent background outside the rock
face. No text, no watermark, no UI, no characters, no sky, no border.
```

**`ui_pfosten.png`** (256x256)
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes, minimal fine surface detail, smooth
matte surfaces, warm muted earthy palette, no black outlines.

OBJECT: a territory boundary marker - a stout carved oak post standing
upright, with visible wood grain, a few simple carved notches down its
shaft and a rounded knob cap on top. Nailed to the front of the post,
a small shield-shaped wooden plaque held by four visible iron nails.
The post stands in a small mound of turned brown earth with a couple
of pebbles at its foot.

CRITICAL: the shield plaque must be PURE FLAT WHITE with no shading,
no gradient, no texture, no outline and no highlights of any kind -
completely uniform white, because it is tinted to the player color at
runtime and any baked shading would turn muddy. Everything else in the
image is normally shaded.

Isometric 3/4 view at a fixed 40-degree elevated camera angle,
matching the game's buildings. Soft light from the upper left on the
post and the earth mound. No cast shadow on the ground, no drop
shadow, no ambient occlusion blob at the base.

Centered with empty margin on all sides, fully transparent background.
No text, no lettering, no numbers, no emblem or symbol on the shield,
no watermark, no UI, no grass, no background scenery, no characters.
```

#### Gebirgs-Texturatlas und Look-Referenz (Stiluebertragung)

Zwei Prompts, die vorhandene Pixel-Art-Vorlagen in unseren Stil ueberfuehren. Beide brauchen das jeweilige Vorlagenbild als Referenzbild.

Der entscheidende Satz steht in beiden am Anfang: das Referenzbild liefert NUR Aufbau und Inhalt, nicht den Rendering-Stil. Ohne diese ausdrueckliche Trennung uebernimmt das Modell die harten Kanten und das Dithering der Vorlage, auch wenn man glatt und malerisch verlangt.

Neu und wertvoll aus dem Atlas: die drei Erz-Kacheln (Kohle, Eisen, Gold). Sichtbare Erzadern im Gebirgsboden geben Spielern einen Grund, das Gebirge ueberhaupt anzuschauen. Kachel 8 (Fels trifft Gras) braucht ihr beim Hoehenmodell vermutlich nicht, da Uebergaenge ueber Vertex-Blending laufen - sie faellt im selben Bild aber ohnehin mit ab.

**Textur-Atlas** (Referenzbild: der Pixel-Art-Atlas, 4x2 Kacheln)
```
Use the reference image ONLY for its LAYOUT and CONTENT: the same 4x2
grid of eight separate square tiles in the same order, showing the
same eight materials. Do NOT copy its rendering style. The reference
is pixel art; this output must be the exact opposite - smooth
painterly cartoon rendering with soft edges. No pixelation, no visible
pixel grid, no dithering, no hard aliased edges, no limited retro
palette, no scanline look.

Style: stylized cartoon ground textures for a medieval settlement-
building game - soft painterly look, chunky simplified shapes with
rounded soft edges, LOW contrast, MUTED desaturated warm grey-brown
palette, no black outlines, no fine noise.

These textures are laid over a 3D terrain mesh, so they must carry NO
lighting information of their own: completely flat, even, ambient
illumination, no directional light, no cast shadows, no ambient
occlusion, no baked highlights, no bevel, no sense of anything being
raised or recessed. All shading comes from the mesh.

The eight tiles, left to right, top row then bottom row: 1. bare grey-
brown mountain rock, evenly mottled, medium roughness 2. the same rock
broken by darker angular fissures and cracks 3. the same rock with
loose clusters of glossy black coal specks 4. the same rock with
clusters of rust-red iron ore specks 5. the same rock with clusters of
warm ochre-gold ore specks 6. the same rock with pale grey granite
blocks set into it 7. the same rock partly covered by irregular
patches of soft snow 8. the same rock meeting dry olive alpine grass
along an irregular organic boundary

Every tile must be seamlessly tileable on all four edges with no
visible seam. Detail stays small and fine-grained: no single element
larger than about one fifteenth of a tile width, so nothing forms a
recognisable repeating shape when tiled.

Arrange the eight tiles in a clean 4x2 grid with a thin neutral gap
between them so each can be cropped out individually. No text, no
labels, no numbers, no watermark, no UI, no objects, no characters, no
border decoration, no drop shadow.
```

**Look-Referenz** (Referenzbild: die Pixel-Art-Landschaft) - Kalibrierungsziel, kein Spiel-Asset
```
Use the reference image ONLY for its COMPOSITION and TERRAIN
STRUCTURE: the same oblique top-down view at a shallow angle, the same
mountain massif of faceted triangular terrain rising out of rolling
grassland, the same stepped bands of slope, the same scattered
boulders and the dark cave mouth at the foot of the slope. Do NOT copy
its rendering style. The reference is 1990s pixel art; this output
must be the opposite - smooth painterly cartoon rendering. No
pixelation, no visible pixel grid, no dithering, no hard aliased
edges, no limited retro palette.

Style: stylized cartoon landscape for a medieval settlement-building
game - soft painterly surfaces, chunky simplified forms, MUTED
desaturated warm palette of grey-brown rock and olive-green grass, LOW
contrast, no black outlines, no fine noise.

Terrain: built from a lattice of triangular facets, each facet filled
with one flat even tone so the faceted low-poly structure stays
clearly readable, with soft but distinct edges between neighbouring
facets. Elevation is expressed purely by facets stepping upward on
screen, so slopes read as stacked bands. Boundaries between rock and
grass follow the facet edges in an irregular stepped line rather than
blending smoothly.

Lighting: a single soft light from the upper left. Facets angled
toward the light are lighter, facets angled away are darker, in clear
distinct tonal steps rather than a continuous gradient - but the steps
themselves are softly rendered, not hard-edged.

Scattered detail: a few pairs of rounded grey granite boulders and
small loose stones on the grassland, and one dark arched cave mouth
set into the rock at the foot of the slope.

No text, no HUD, no UI, no characters, no buildings, no vehicles, no
watermark, no border.
```

#### Vorrangig: Klippen-Wandtexturen und Abschlusskanten

Fuenf Bilder, die den Gebirgs-Look tragen: drei Wandtexturen (passend zum jeweiligen Gelaende) und zwei transparente Abschlusskanten fuer Ober- und Unterkante. Die Wandtexturen kacheln WAAGERECHT entlang der Klippe; senkrecht stehen sie fuer sich, mit einer vollstaendigen Bandfolge ueber die ganze Hoehe. Da die Waende im Spiel nur etwa 24 bis 70 Pixel hoch gezeichnet werden, steht in jedem Prompt ausdruecklich, dass wenige, dicke, klar getrennte Baender noetig sind - Feindetail geht bei der Groesse ohnehin verloren.

**`klippe_fels2.png`**
```
A seamless VERTICAL WALL texture for a stylized cartoon medieval
settlement-building game with heightmap terrain, in the tradition of
classic 1990s isometric settlement games. This is a WALL seen straight
on from the side, never a ground tile: all structure runs HORIZONTALLY
across the width. It is laid over the steep faces of a 3D terrain
mesh, so it must carry NO lighting information of its own - completely
flat, even, ambient illumination, no directional light, no cast
shadows, no ambient occlusion, no baked highlights. All shading comes
from the mesh. Soft painterly look, LOW contrast, MUTED desaturated
warm palette, no black outlines.

SURFACE: bare grey mountain rock face - 4 to 6 thick horizontal strata
of stacked stone spanning the full height, each band with a straight
but broken upper edge and a slightly darker recess beneath it. A few
vertical cracks cross two bands at a time. Small loose stones rest on
the ledges where one band steps back from the one below.

Boldness is critical: in the game this wall is drawn only about 24 to
70 pixels tall, so the bands must be few, thick and clearly separated,
with strong simple silhouettes. No fine detail, no small speckle, no
thin hairline structures - they would vanish or turn to mush at that
size.

Seen straight on from the side, flat orthographic view, perfectly
square, seamlessly tileable on the LEFT and RIGHT edges so the wall
can repeat along a cliff. Vertically the strata form one complete
sequence filling the frame from top edge to bottom edge. No text, no
watermark, no UI, no objects, no characters, no sky, no ground at the
base, no grass on top, no border, no vignette.
```

**`klippe_erde2.png`**
```
A seamless VERTICAL WALL texture for a stylized cartoon medieval
settlement-building game with heightmap terrain, in the tradition of
classic 1990s isometric settlement games. This is a WALL seen straight
on from the side, never a ground tile: all structure runs HORIZONTALLY
across the width. It is laid over the steep faces of a 3D terrain
mesh, so it must carry NO lighting information of its own - completely
flat, even, ambient illumination, no directional light, no cast
shadows, no ambient occlusion, no baked highlights. All shading comes
from the mesh. Soft painterly look, LOW contrast, MUTED desaturated
warm palette, no black outlines.

SURFACE: an exposed earth bank - 3 to 4 horizontal layers of warm
brown soil and paler clay spanning the full height, each with a soft
crumbling edge. Small pebbles embedded irregularly throughout, a few
half fallen out. Thin pale roots hang down between the layers. The
lowest band is noticeably darker and damper than the ones above.

Boldness is critical: in the game this wall is drawn only about 24 to
70 pixels tall, so the layers must be few, thick and clearly
separated, with strong simple silhouettes. No fine detail, no small
speckle, no thin hairline structures - they would vanish or turn to
mush at that size.

Seen straight on from the side, flat orthographic view, perfectly
square, seamlessly tileable on the LEFT and RIGHT edges so the wall
can repeat along a cliff. Vertically the strata form one complete
sequence filling the frame from top edge to bottom edge. No text, no
watermark, no UI, no objects, no characters, no sky, no ground at the
base, no grass on top, no border, no vignette.
```

**`klippe_schnee.png`**
```
A seamless VERTICAL WALL texture for a stylized cartoon medieval
settlement-building game with heightmap terrain, in the tradition of
classic 1990s isometric settlement games. This is a WALL seen straight
on from the side, never a ground tile: all structure runs HORIZONTALLY
across the width. It is laid over the steep faces of a 3D terrain
mesh, so it must carry NO lighting information of its own - completely
flat, even, ambient illumination, no directional light, no cast
shadows, no ambient occlusion, no baked highlights. All shading comes
from the mesh. Soft painterly look, LOW contrast, MUTED desaturated
warm palette, no black outlines.

SURFACE: a snow-covered rock face - grey stone strata only partly
visible, with thick white snow ledges resting on top of every band and
spilling slightly over their front edges. Pale blue-grey shadow tones
sit in the recesses beneath the overhangs. A few short icicles hang
down from the ledges.

Boldness is critical: in the game this wall is drawn only about 24 to
70 pixels tall, so the bands and snow ledges must be few, thick and
clearly separated, with strong simple silhouettes. No fine detail, no
small speckle, no thin hairline structures - they would vanish or turn
to mush at that size.

Seen straight on from the side, flat orthographic view, perfectly
square, seamlessly tileable on the LEFT and RIGHT edges so the wall
can repeat along a cliff. Vertically the strata form one complete
sequence filling the frame from top edge to bottom edge. No text, no
watermark, no UI, no objects, no characters, no sky, no ground at the
base, no grass on top, no border, no vignette.
```

**`kante_oben.png`** - Grasrand auf der Oberkante
```
A seamless horizontal CLIFF TOP EDGE strip for a stylized cartoon
medieval settlement-building game with heightmap terrain, in the
tradition of classic 1990s isometric settlement games. Soft painterly
look, LOW contrast, MUTED desaturated warm earthy palette, flat even
ambient illumination with no directional light, no cast shadows, no
ambient occlusion, no baked highlights, no black outlines.

CONTENT: the very lip of a cliff seen straight on from the side - a
band of green grass turf running across the full width, its front edge
overhanging slightly and irregularly, with a thin layer of dark soil
visible directly beneath it and a few short pale roots and loose
crumbs dangling down from the underside. A few small tufts of longer
grass break the silhouette of the upper edge. Bold and simple: this
strip is only a few pixels tall in the game.

The strip occupies the middle band of the image and runs the full
width. Everything above it and everything below it is FULLY
TRANSPARENT, so it can be laid across the top of a wall texture and
blend into the ground above and the rock below.

Flat orthographic side view, seamlessly tileable on the LEFT and RIGHT
edges. No text, no watermark, no UI, no objects, no characters, no
sky, no full rock face, no border, no vignette.
```

**`kante_unten.png`** - Geroell am Wandfuss
```
A seamless horizontal CLIFF FOOT strip for a stylized cartoon medieval
settlement-building game with heightmap terrain, in the tradition of
classic 1990s isometric settlement games. Soft painterly look, LOW
contrast, MUTED desaturated warm grey palette, flat even ambient
illumination with no directional light, no cast shadows, no ambient
occlusion, no baked highlights, no black outlines.

CONTENT: a talus of fallen rubble heaped against the base of a cliff,
seen straight on from the side - loose angular grey stones and gravel
of mixed sizes piled up in a low, irregular, gently undulating bank
that is thicker in some places than others along the width. The pile
is denser and darker at the bottom, thinning out toward its upper edge
into single scattered stones. Bold and simple: this strip is only a
few pixels tall in the game.

The rubble occupies the lower band of the image and runs the full
width. Everything above it is FULLY TRANSPARENT, and its upper edge
breaks up into individual stones rather than ending in a line, so it
blends into the rock face above. The bottom edge fades softly so it
sits naturally on the ground.

Flat orthographic side view, seamlessly tileable on the LEFT and RIGHT
edges. No text, no watermark, no UI, no objects, no characters, no
full rock face, no grass, no border, no vignette.
```

#### Vorrangig: Felskachel fuer den Gebirgsboden

**`gebirge3.png`** - ersetzt die bisherige Felskachel
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights. All shading
comes from the mesh. Soft painterly look, LOW contrast, MUTED
desaturated warm grey palette, no black outlines.

TERRAIN: bare rocky mountain ground made of interlocking angular stone
facets with a CLEARLY MIXED size distribution: a handful of dominant
larger plates spanning roughly one sixth to one eighth of the tile
width, surrounded and separated by medium shards and a scatter of
small chips filling the gaps. Each larger plate reads as one flat
facet with a few internal fracture lines, its edges slightly chipped.
Thin seams of darker grit run between the stones. A few faint patches
of dry ochre lichen break up the grey.

Explicitly avoid both failure modes: NOT a few huge boulders filling
the frame, and NOT a uniform granular field of same-sized rounded
pebbles that reads as gravel, concrete or leather. The variety of
stone sizes is the point.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

**`ter_ridge_snow.png`** (512x512, kachelbar) - Firn fuer Gipfelgrate, haerter und blaeulicher als die Tiefschnee-Kachel
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with heightmap terrain, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, no black outlines.

TERRAIN: hard wind-packed firn snow on a high mountain ridge - cool
bluish-white and noticeably harder-looking than soft deep snow, its
surface carved into fine parallel wind ripples and small sastrugi
ridges that all run roughly the same direction. The snow is thin and
scoured in places, so a few small patches of dark grey rock break
through the surface, their edges softened by drifted snow. Faint cool
blue-grey tonal variation, a hint of a crusted glazed sheen without
any bright specular highlight.

Distinct from deep powder snow: this reads as compacted, weathered,
old snow on an exposed ridge, not as fresh soft cover.

Detail scale: the texture repeats many times across the terrain, so
every feature must be small and fine-grained - no single element
larger than about one fifteenth of the tile width, and the exposed
rock patches only occasional so they do not form a recognisable
repeating shape when tiled.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no footprints, no border, no vignette.
```

**`obj_pass.png`** (512x384, freigestellt) - markiert durchquerbare Stellen eines Gebirgszugs
```
A stylized cartoon MOUNTAIN PASS asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games. Landscape format, wider than it is high.

OBJECT: a gap through a mountain ridge - a substantial grey rock
shoulder rising on the LEFT side of the frame and a second,
differently shaped rock shoulder rising on the RIGHT side, both
angular and layered, their inner faces sloping down toward the middle.
Between them lies a low open saddle: a shallow dip strewn with loose
grey scree and a few larger fallen blocks resting against the foot of
each shoulder. The two shoulders are clearly asymmetric - different
width, height and profile - so the pass does not look mirrored or
stamped.

The saddle in the middle must read as OPEN and passable: low, clear
and inviting, with the shoulders framing it rather than closing it
off. That contrast is the whole point of the asset.

IMPORTANT for gameplay: in the middle saddle, draw only a sparse
scatter of individual scree stones with fully transparent gaps between
them, not a solid ground surface. The terrain and the units walking
through must remain visible between the stones.

Chunky simplified shapes, muted desaturated warm grey palette, LOW
contrast, no black outlines, no fine speckle - bold and readable at
small size.

Isometric 3/4 view at a fixed 40-degree elevated camera angle,
matching the game's buildings. Soft light from the upper left,
brightening the left-facing rock faces and shading the right-facing
ones. No cast shadow on the ground, no drop shadow, no ambient
occlusion blob at the base.

Fully transparent background, including the sky between and above the
shoulders. No snow, no grass, no trees, no path markings, no text, no
watermark, no UI, no characters, no border.
```

#### Flache Bodentexturen

**`wiese.png`**
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, MUTED desaturated warm earthy
colors, no dark outlines.

Detail scale: the texture repeats many times across the terrain, so
every feature must be SMALL and fine-grained - no single element
larger than about one fifteenth of the tile width. Do not include any
distinct standalone objects such as individual flowers, plants, reeds,
mushrooms, bushes or large boulders: those are placed separately as
decoration. Avoid any conspicuous shape, blotch or line that the eye
would recognise as a repeated copy when the texture is tiled.

TERRAIN: soft green meadow grass in three closely related muted green
tones, gently mottled into gradual irregular patches, with a fine even
suggestion of short grass blades throughout - visible as texture but
never as individual identifiable tufts. Slightly desaturated, leaning
warm rather than acid or yellow. No flowers, no clumps.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

**`moor.png`**
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, MUTED desaturated warm earthy
colors, no dark outlines.

Detail scale: the texture repeats many times across the terrain, so
every feature must be SMALL and fine-grained - no single element
larger than about one fifteenth of the tile width. Do not include any
distinct standalone objects such as individual flowers, plants, reeds,
mushrooms, bushes or large boulders: those are placed separately as
decoration. Avoid any conspicuous shape, blotch or line that the eye
would recognise as a repeated copy when the texture is tiled.

TERRAIN: damp boggy moorland ground in muted dark olive and peat
brown, softly mottled with damp darker areas and faint dull-green moss
patches, plus a few very small shallow dull water films with soft
edges. No reeds, no plants, no grass clumps.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

**`wasser.png`**
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, MUTED desaturated warm earthy
colors, no dark outlines.

Detail scale: the texture repeats many times across the terrain, so
every feature must be SMALL and fine-grained - no single element
larger than about one fifteenth of the tile width. Do not include any
distinct standalone objects such as individual flowers, plants, reeds,
mushrooms, bushes or large boulders: those are placed separately as
decoration. Avoid any conspicuous shape, blotch or line that the eye
would recognise as a repeated copy when the texture is tiled.

TERRAIN: calm shallow lake water seen from above, in a muted
desaturated blue-green - soft and slightly greyed, not bright
turquoise. Very gentle broad tonal undulations with faint soft light
patterns, low contrast, no crisp caustic network, no foam, no
shoreline, no sparkle.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

**`gebirge.png`**
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, MUTED desaturated warm earthy
colors, no dark outlines.

Detail scale: the texture repeats many times across the terrain, so
every feature must be SMALL and fine-grained - no single element
larger than about one fifteenth of the tile width. Do not include any
distinct standalone objects such as individual flowers, plants, reeds,
mushrooms, bushes or large boulders: those are placed separately as
decoration. Avoid any conspicuous shape, blotch or line that the eye
would recognise as a repeated copy when the texture is tiled.

TERRAIN: bare rocky mountain ground in muted warm grey, formed of
interlocking irregular angular stone facets of clearly varied sizes -
some broader plates, some narrow slivers, with thin seams of darker
grit between them and a fine scatter of small loose chips. Clear
varied stone shapes, NOT a uniform field of same-sized round pebbles
and NOT smooth gravel or concrete. A few faint patches of dry ochre
lichen.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

**`lava.png`**
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, MUTED desaturated warm earthy
colors, no dark outlines.

Detail scale: the texture repeats many times across the terrain, so
every feature must be SMALL and fine-grained - no single element
larger than about one fifteenth of the tile width. Do not include any
distinct standalone objects such as individual flowers, plants, reeds,
mushrooms, bushes or large boulders: those are placed separately as
decoration. Avoid any conspicuous shape, blotch or line that the eye
would recognise as a repeated copy when the texture is tiled.

TERRAIN: cooled dark volcanic ground in muted charcoal and ash grey,
broken into many small angular plates with a fine network of thin
cracks, a restrained dull orange glow only inside the narrowest
cracks. Low contrast overall. No smoke, no sparks, no large lava
pools.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

**`wueste.png`**
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, MUTED desaturated warm earthy
colors, no dark outlines.

Detail scale: the texture repeats many times across the terrain, so
every feature must be SMALL and fine-grained - no single element
larger than about one fifteenth of the tile width. Do not include any
distinct standalone objects such as individual flowers, plants, reeds,
mushrooms, bushes or large boulders: those are placed separately as
decoration. Avoid any conspicuous shape, blotch or line that the eye
would recognise as a repeated copy when the texture is tiled.

TERRAIN: dry desert sand in muted warm ochre and pale beige, softly
mottled with very fine wind ripple patterns and gentle tonal shifts.
Low contrast. No pebbles, no rocks, no dry plants.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

**`schnee.png`**
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, MUTED desaturated warm earthy
colors, no dark outlines.

Detail scale: the texture repeats many times across the terrain, so
every feature must be SMALL and fine-grained - no single element
larger than about one fifteenth of the tile width. Do not include any
distinct standalone objects such as individual flowers, plants, reeds,
mushrooms, bushes or large boulders: those are placed separately as
decoration. Avoid any conspicuous shape, blotch or line that the eye
would recognise as a repeated copy when the texture is tiled.

TERRAIN: fresh snow cover in soft off-white with very faint cool grey-
blue tonal variation, extremely low contrast and evenly grainy. No
sparkle highlights, no ice, no footprints, no rocks, no drifts or
hollows - the terrain mesh provides all form.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

**`gletscher.png`**
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, MUTED desaturated warm earthy
colors, no dark outlines.

Detail scale: the texture repeats many times across the terrain, so
every feature must be SMALL and fine-grained - no single element
larger than about one fifteenth of the tile width. Do not include any
distinct standalone objects such as individual flowers, plants, reeds,
mushrooms, bushes or large boulders: those are placed separately as
decoration. Avoid any conspicuous shape, blotch or line that the eye
would recognise as a repeated copy when the texture is tiled.

TERRAIN: glacier ice seen from above, pale blue-white with a fine
network of faint hairline crevasses and subtle tonal banding in cool
grey-blue, plus a light dusting of granular snow. Low contrast, no
deep crevasses, no dramatic cracks.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

**`pflaster.png`**
```
A seamless top-down GROUND texture for a stylized cartoon medieval
settlement-building game with HEIGHTMAP TERRAIN, in the tradition of
classic 1990s isometric settlement games. This texture is laid over a
3D terrain mesh, so it must carry NO lighting information of its own:
completely flat, even, ambient illumination, no directional light, no
cast shadows, no ambient occlusion, no baked highlights, no sense of
anything being raised or recessed. All shading comes from the mesh.
Soft painterly look, LOW contrast, MUTED desaturated warm earthy
colors, no dark outlines.

Detail scale: the texture repeats many times across the terrain, so
every feature must be SMALL and fine-grained - no single element
larger than about one fifteenth of the tile width. Do not include any
distinct standalone objects such as individual flowers, plants, reeds,
mushrooms, bushes or large boulders: those are placed separately as
decoration. Avoid any conspicuous shape, blotch or line that the eye
would recognise as a repeated copy when the texture is tiled.

TERRAIN: worn packed dirt path surface in muted warm brown, softly
mottled with slightly lighter compacted areas and a fine even scatter
of very small embedded grit. No cart ruts, no large pebbles, no grass,
no sharp edges.

Seen from directly above, flat orthographic top-down view, perfectly
square, seamlessly tileable on all four edges with no visible seam.
Filling the entire frame edge to edge. No text, no watermark, no UI,
no objects, no characters, no border, no vignette.
```

#### Praktische Hinweise zum Hoehenmodell

- **Hoehenstufen diskret halten.** Siedler 2 nutzt feste Hoehenschritte statt beliebiger Werte. Das macht die Landschaft lesbar, Wege planbar und erlaubt eine klare Regel, ab welchem Hoehenunterschied nicht mehr gebaut oder gelaufen werden kann.
- **Steigung entscheidet ueber Nutzbarkeit.** Aus der Hoehendifferenz zwischen benachbarten Punkten ergibt sich automatisch: flach genug zum Bauen, noch begehbar, oder gesperrt. Gletscherpfade und Gebirgspaesse entstehen dann von selbst als die schmalen begehbaren Streifen zwischen zu steilen Feldern - ihr muesst sie nicht von Hand einzeichnen.
- **Geländeart pro Gitterpunkt, nicht pro Kachel.** Dann laufen Uebergaenge weich und ihr braucht keine Uebergangsgrafiken.
- **Beleuchtung aus den Normalen.** Eine feste Lichtrichtung von oben-links ueber die Mesh-Normalen schattiert alle Haenge einheitlich - dieselbe Lichtrichtung, die auch alle eure Gebaeude und Figuren haben. Damit passt das Gelände automatisch zum Rest.

**Geometrie**

- Dreiecksgitter, jede zweite Zeile um eine halbe Kantenlaenge versetzt.
- Hoehe verschiebt den Vertex ausschliesslich nach oben auf dem Bildschirm (Screen-Y), nicht perspektivisch.
- Verhaeltnis Zeilenabstand zu Kantenlaenge etwa 1:2.
- Hoehenschritt etwa ein Achtel der Kantenlaenge - am Referenzbild nachkalibrieren.

**Shading**

- Helligkeit pro Vertex aus der Hoehendifferenz zum Nachbarn oben-links, naeherungsweise `b = clamp(1.0 + (h[x,y] - h[x-1,y-1]) * k)`.
- Ergebnis auf diskrete Stufen quantisieren und multiplikativ auf die Textur legen.
- Zur Stufenzahl: In der Pixel-Art-Vorlage sind harte Stufen ein Stilmittel. In unserem weichen Cartoon-Look koennen sie schnell nach Fehler aussehen. Lieber mit 8 bis 12 Stufen anfangen und erst runtergehen, wenn es zu glatt wirkt - nicht gleich auf 6.

**Uebergaenge**

- Ein Dreieck traegt genau einen Terraintyp, keine Blends innerhalb eines Dreiecks.
- Die Kante zwischen zwei Typen bekommt einen schmalen, unregelmaessig gezackten Uebergangsstreifen als eigenes Sprite.
- Das steht bewusst im Widerspruch zum Vertex-Blending weiter oben: beides ist moeglich. Vertex-Blending ist weicher und braucht keine zusaetzlichen Grafiken, gezackte Streifen sind naeher am Vorbild. Entscheidet euch fuer eines - gemischt sieht es uneinheitlich aus.

## 3.2 Übergangs-Pinsel (ein Sammelbild, 6 Formen, transparent)

Beim Höhenmodell vermutlich entbehrlich, da Übergänge über Vertex-Blending laufen. Erzeugt sie erst, falls sich zeigt, dass ihr sie doch braucht.

**`uebergaenge.png`**
```
Six terrain transition brushes for a stylized cartoon medieval
settlement-building game, in the tradition of classic 1990s isometric
settlement games: soft painterly look, LOW contrast, MUTED desaturated
warm earthy colors, flat even ambient lighting with no directional
shadows, no black outlines.

Generate this as ONE single image containing all six brushes as
separate square panels arranged in a row with generous empty space
between them, so each can be cropped out individually afterward. In
every panel the material fills roughly the upper half of the square
and fades out downward through a soft, irregular, organic edge with
small tongues and inlets - never a straight line and never a clean
geometric curve. Below that edge each panel is FULLY TRANSPARENT so
the brush can be laid over any terrain. The left and right edges of
each panel must tile seamlessly with copies of itself.

Include exactly these six brushes, side by side:

1. Beach sand: pale warm ochre sand thinning downward into scattered
sand patches and single grains.

2. Scree: loose grey stone chips and gravel of mixed sizes thinning
downward into single scattered stones.

3. Snow: soft off-white snow with faint cool grey-blue tones thinning
downward into patchy flecks.

4. Bog mud: dark olive-brown wet mud with faint moss thinning downward
into damp scattered patches.

5. Foam line: a soft band of white and pale blue-white water froth
with small bubbles, fading downward into nothing.

6. Dry earth: cracked pale brown dry soil thinning downward into
scattered crumbs and dust.

Plain fully transparent background everywhere outside the brushes. No
panel borders, no grid lines, no labels, no text, no numbers, no
watermark, no second terrain material behind the brushes.
```


---

# 4. Vegetation, Kartenobjekte und Wasser


## 4.1 Bäume

Groessenangaben jeweils relativ zum Wohnhaus, damit die Baeume untereinander stimmen.

**`baum_eiche.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a broad-leaved oak tree with a wide round dense canopy painted
in three distinct green tones, a thick short gnarled trunk and heavy
low branches. Scale: about 1.5 times the height of a one-storey
cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`baum_buche.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a slender beech tree with a tall narrow oval canopy in soft
mid-green tones and a smooth straight pale-grey trunk. Scale: about
1.5 times the height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`baum_birke.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a birch tree with a slim white trunk marked with black bands,
a light airy canopy of small bright yellow-green leaves and a few
drooping thin branches. Scale: about 1.3 times the height of a one-
storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`baum_kiefer.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a tall pine tree with a long bare reddish-brown trunk and a
compact dark green crown only at the very top. Scale: about twice the
height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`baum_fichte.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a dense spruce tree, a tall narrow cone of very dark blue-
green needled branches layered in tiers from the ground up. Scale:
about twice the height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`baum_weide.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a willow tree at the waterside with a short thick leaning
trunk and long drooping branches of pale silvery-green leaves hanging
down almost to the ground. Scale: about 1.3 times the height of a one-
storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`baum_palme.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a desert palm with a slim curved ringed trunk and a crown of
six or seven large arching fronds, plus a small cluster of dates
beneath them. Scale: about 1.5 times the height of a one-storey
cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`baum_tot.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a dead tree, a bare cracked grey-black trunk with a few broken
jagged branches reaching upward, no leaves at all, faint ash dusting
on the bark. Scale: about 1.2 times the height of a one-storey
cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`baum_setzling.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a young tree sapling, a thin flexible stem with just five or
six small fresh green leaves and a small ring of turned soil at its
base. Scale: about one quarter the height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`baum_stumpf.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a cut tree stump, a low wide trunk section with a pale sawn
top surface showing growth rings, rough bark on the sides, a few wood
chips and a small green shoot at its foot. Scale: about one fifth the
height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```


## 4.2 Wiesendeko

**`deko_blumen.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: THREE separate small wildflower clumps side by side in one
image with clear empty space between them, so each can be cropped out
individually: the first with white daisy-like flowers, the second with
yellow buttercup-like flowers, the third with small blue-violet
flowers. Each clump low and rounded with a few green leaves at the
base. Scale: each about one tenth the height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`deko_pilze.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a small group of four rounded mushrooms of slightly different
heights, warm red-brown caps with pale cream stems, growing from a
tiny patch of moss. Scale: about one twelfth the height of a one-
storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`deko_farn.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a low bushy tuft of fern and long grass blades fanning outward
in two green tones, denser at the base. Scale: about one eighth the
height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`deko_moosstein.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a low rounded grey fieldstone half covered in soft bright
green moss, with a few small pebbles at its foot. Scale: about one
sixth the height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`deko_distel.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a spiky thistle plant with jagged grey-green leaves and one
purple flower head, together with a few dry brown weed stalks. Scale:
about one eighth the height of a one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```

**`deko_schilf.png`**
```
A single stylized cartoon 3D game asset for a medieval settlement-
building game, in the tradition of classic 1990s isometric settlement
games: chunky simplified shapes with rounded edges, minimal fine
surface detail, smooth matte surfaces, soft volumetric shading with a
clear light-to-shadow boundary, warm muted earthy palette. Charming
and slightly exaggerated proportions, clearly readable at very small
size.

OBJECT: a cluster of tall thin reeds at a waterside, straight upright
stalks in yellow-green with a few dark brown seed heads at the top and
a couple of broad flat leaves. Scale: about one third the height of a
one-storey cottage.

Isometric 3/4 view at a fixed 40-degree elevated camera angle, fixed
light direction from the upper-left, small soft contact shadow
directly beneath the object. The object stands alone, centered, with
empty margin on all sides. Fully transparent background. No text, no
watermark, no UI, no ground plane, no background scenery, no
characters, no other objects.
```


## 4.3 Kartenobjekte

**Sheet - Kartenobjekte**
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

2. A cluster of mineable grey granite boulders with flat chiselled
facets and small chipped fragments at the base. Scale: about half
the height of the cottage.

3. A burned-out building ruin: charred blackened timber beams
leaning at angles, a partially collapsed stone wall and scattered
rubble. Stylized, not gruesome. Scale: about the same size as the
cottage.

4. An ancient ceremonial stone archway with weathered carved runes
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


## 4.4 Getreidefelder

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


## 4.5 Geologen-Schilder

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


## 4.6 Wasser-Objekte

Draufsicht statt Isometrie, da diese Objekte flach im Wasser liegen.

**`fx_fischschwarm.png`** (512x512, ersetzt `wasser_fischschwarm.png`)
```
A stylized cartoon top-down FISH SCHOOL asset for a medieval
settlement-building game, in the tradition of classic 1990s isometric
settlement games. Square format.

OBJECT: a loose school of 8 fish seen from directly above, as if
looking down through clear water. All of them face and swim toward the
RIGHT edge of the frame, arranged in a natural staggered formation -
not a rigid row and not evenly spaced, with a few leading the group
and the rest trailing behind at slightly different distances and small
vertical offsets. Sizes vary slightly from fish to fish, and one or
two are angled a few degrees off the common direction so the group
looks alive rather than stamped.

Each fish is a simple rounded silhouette with a slightly darker
silvery blue-grey back, a paler belly hinted at along the flank, and a
soft forked tail. No eyes, no scales, no fins in detail, no outlines -
they are seen through water, so shapes stay soft and simplified.

CRITICAL - seen through water: the fish must be rendered SEMI
TRANSPARENT, roughly 60 to 75 percent opaque, with soft blurred edges
that fade rather than end in a crisp line. They should look submerged
and slightly diffused, never like solid stickers laid on top of the
surface.

Muted desaturated silvery blue palette, LOW contrast, soft painterly
look, no black outlines, no bright highlights.

Fully transparent background - no water surface, no blue tint layer,
no ripples, no caustics, no bubbles behind the fish. No cast shadow,
no drop shadow, no dark blob beneath the school. Centered with empty
margin on all sides so the group can be rotated freely to any swimming
direction without clipping. No text, no watermark, no UI, no plants,
no other objects.
```

**`wasser_seerosen.png`**
```
A single stylized cartoon top-down game asset for a medieval
settlement-building game, in the tradition of classic 1990s isometric
settlement games: chunky simplified shapes, minimal fine detail, warm
muted palette, soft even lighting with no strong directional shadow.

OBJECT: a group of four water lily pads seen from above, flat round
green discs with a single notch cut into each, arranged loosely apart,
two of them carrying a small white open blossom with a yellow center.

Seen from directly above, flat orthographic top-down view, centered
with empty margin on all sides. Fully transparent background. No water
surface behind it, no text, no watermark, no UI, no shoreline, no
other objects.
```

**`wasser_schaum.png`**
```
A single stylized cartoon top-down game asset for a medieval
settlement-building game, in the tradition of classic 1990s isometric
settlement games: chunky simplified shapes, minimal fine detail, warm
muted palette, soft even lighting with no strong directional shadow.

OBJECT: a horizontal strip of gentle wave foam seen from above, a soft
irregular band of white and pale blue-white froth with small bubbles,
thicker in the middle and fading out to nothing at both ends, tileable
left and right.

Seen from directly above, flat orthographic top-down view, centered
with empty margin on all sides. Fully transparent background. No water
surface behind it, no text, no watermark, no UI, no shoreline, no
other objects.
```


---

# 5. Waren und Icons


## 5.1 Waren, Teil 1

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


## 5.2 Waren, Teil 2

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


## 5.3 Werkzeuge

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


## 5.4 HUD-Icons

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


---

# 6. Effekte


## 6.1 Kampf- und Bau-Effekte

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


## 6.2 Nebel und Staub

Bewusste Abweichung von frueher: Effekte nicht mehr auf Schwarz und per Alpha freistellen, sondern direkt transparent - beim Nebel bliebe eine harte Schwarzkante sonst sichtbar.

**`fx_nebel.png`**
```
A single stylized cartoon visual effect asset for a medieval
settlement-building game: chunky simplified shapes, soft edges,
minimal fine detail, matching a warm muted earthy hand-painted art
style.

EFFECT: a soft drifting bank of fog, an irregular horizontal cloud of
pale grey-white haze, densest in the middle and fading gradually to
fully transparent at every edge, with no hard outline anywhere - soft
enough to be tiled and layered along a map border.

Centered with empty margin on all sides, fully transparent background
so the effect can be layered over the game world. Soft even lighting
with no directional shadow. No text, no watermark, no UI, no
characters, no scenery, no ground, no other objects.
```

**`fx_staub.png`**
```
A single stylized cartoon visual effect asset for a medieval
settlement-building game: chunky simplified shapes, soft edges,
minimal fine detail, matching a warm muted earthy hand-painted art
style.

EFFECT: a small puff of light brown construction dust rising from the
ground, a rounded billowing cloud with a few tiny stone chips flying
outward, fading to transparent at the top and edges.

Centered with empty margin on all sides, fully transparent background
so the effect can be layered over the game world. Soft even lighting
with no directional shadow. No text, no watermark, no UI, no
characters, no scenery, no ground, no other objects.
```

**`fx_kampfstaub.png`**
```
A single stylized cartoon visual effect asset for a medieval
settlement-building game: chunky simplified shapes, soft edges,
minimal fine detail, matching a warm muted earthy hand-painted art
style.

EFFECT: a wider low burst of grey-brown dust kicked up by a scuffle,
spreading sideways more than upward, with a few small dirt clods
flying out and the edges fading to transparent.

Centered with empty margin on all sides, fully transparent background
so the effect can be layered over the game world. Soft even lighting
with no directional shadow. No text, no watermark, no UI, no
characters, no scenery, no ground, no other objects.
```


---

# 7. Benutzeroberfläche


## 7.1 Buttons und Baumenü-Tabs

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


## 7.2 Texturen und Zierring

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


---


## 7.3 Kampfrahmen und Einheiten-Medaillons

**`ui_kampfrahmen.png`**
```
A stylized cartoon UI frame for a medieval settlement-building game,
matching a warm hand-painted earthy art style: an aged parchment panel
with softly torn irregular edges, slightly curled corners and faint
stains, mounted on a simple dark wooden backing with iron rivets in
the corners. Across the top center of the frame, two simple crossed
medieval swords with leather-wrapped hilts, rendered in the same
chunky simplified style.

The center of the parchment is completely empty and evenly toned,
leaving a clean rectangular area for a battle message to be placed
later.

Seen straight on from the front, flat to the camera, no perspective
distortion, no tilt. Centered, fully transparent background outside
the frame.

No text, no lettering, no numbers, no watermark, no characters, no
other decoration inside the panel.
```

**`icon_unit_*.png`** (alle fuenf Medaillons in einem Bild)
```
A row of FIVE small round UI medallion icons for a medieval
settlement-building game, arranged side by side with clear empty space
between them so each can be cropped out individually. All five
identical in size, shape and framing: a simple round dark wooden
medallion with a thin iron rim, matching a warm hand-painted earthy
cartoon art style. Only the emblem inside differs, each rendered as
one bold simple readable symbol in a light tone against the dark
medallion:

1. a plain villager: a simple head-and-shoulders silhouette wearing a
soft cap 2. a geologist: a small pickaxe crossed over a chunk of rock
3. a swordsman: a single upright sword in front of a small round
shield 4. a spearman: a single upright spear in front of a small round
buckler 5. an archer: a bow drawn upright with one arrow nocked

Seen straight on from the front, flat to the camera, no perspective
distortion, no tilt. Soft even lighting, no strong directional shadow.
Fully transparent background around and between the medallions.

No text, no lettering, no numbers, no watermark, no UI frames around
the row.
```


## 7.4 App-Icon

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


---

# 8. Titelbild, Dialoge und Story-Tafeln


## 8.1 Titelbild und Sieg-/Niederlage-Dialog

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


---


## 8.2 Story-Tafeln der 10 Missionen

Je eine Tafel pro Karte, abgeleitet aus euren Storyboards. Jede zeigt die prägende Landschaftsform der Karte aus erhöhter Panorama-Sicht, damit man schon am Bild erkennt, worum es geht - Kessel, Fluss, Oasen, Pässe, Inseln und so weiter. Im unteren Drittel ist bewusst ruhige Fläche freigelassen, damit euer Missionstext dort Platz hat.


Ein bewusster Unterschied zum Rest des Stilguides: Diese Bilder sind keine freigestellten Assets, sondern vollflächige Illustrationen. Deshalb kein weißer Hintergrund und keine isometrische 40-Grad-Kamera, sondern eine erhöhte Panorama-Perspektive. Der Cartoon-Stil bleibt identisch, damit sie zum Spiel passen.


### 8.2.1 Karte 1: Der Grüne Kessel

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


### 8.2.2 Karte 2: Zwei Ufer

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


### 8.2.3 Karte 3: Die Trockene Weite

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


### 8.2.4 Karte 4: Winterpass

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


### 8.2.5 Karte 5: Die Goldene See

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


### 8.2.6 Karte 6: Das Moordelta

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


### 8.2.7 Karte 7: Der Vulkanring

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


### 8.2.8 Karte 8: Die Alte Handelsstraße

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


### 8.2.9 Karte 9: Kontinent der Vier Winde

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


### 8.2.10 Karte 10: Der Weltenrand

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

Falls die Tafeln im Spiel hochkant oder quadratisch dargestellt werden, im Prompt "Wide landscape composition" durch "Tall portrait composition" bzw. "Square composition" ersetzen und den Satz zur Textfläche entsprechend anpassen - sonst schneidet ihr euch die freigehaltene Fläche wieder weg.

---


---

# 9. Status

| Bereich | Kapitel | Status |
|---|---|---|
| Figuren und Tiere | 1.2 - 1.5 | vollständig |
| Arbeitsanimationen | 1.6 | prozedural aus dem Skelett |
| Gebäude | 2.1 - 2.4 | vollständig |
| Baustellen | 2.5 | vollständig |
| Gelände (Höhenmodell) | 3.1 | vollständig |
| Übergangs-Pinsel | 3.2 | optional, beim Höhenmodell vermutlich entbehrlich |
| Bäume, Deko, Kartenobjekte, Felder, Schilder, Wasser | 4.1 - 4.6 | vollständig |
| Waren, Werkzeuge, HUD-Icons | 5.1 - 5.4 | vollständig |
| Effekte | 6.1 - 6.2 | vollständig |
| Benutzeroberfläche, App-Icon | 7.1 - 7.4 | vollständig |
| Titelbild, Dialoge, Story-Tafeln | 8.1 - 8.2 | vollständig |

Nicht enthalten und auch nicht nötig: alles, was euer Spiel prozedural erzeugt - Wellengang, Kielwasser, Gebietsgrenzen, Wegsaum, Baum-Wachstumsstufen, Bau-Vorschau, Minimap-Inhalt, Wolkenschatten, Vögel, Zzz-Symbol, Schmiede-Glut und Brandflammen.
