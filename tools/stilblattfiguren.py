# -*- coding: utf-8 -*-
"""Stilblatt der FIGUREN bauen - Referenzbild fuer Figuren-Massenprompts.

Es gab bisher drei Blaetter (Gebaeude, Baeume, GUI-Werkstoffe) und keines
fuer Figuren. Fuer die Neubestellung des Traegers fehlt damit die
Vorlage: der Traeger soll aussehen wie seine Kollegen, und das zeigt kein
Text so scharf wie sechs von ihnen nebeneinander.

Gleiches Verfahren wie bei den anderen Blaettern: Inhalt freistellen, auf
eine gemeinsame Hoehe ziehen, nebeneinander auf dasselbe neutrale warme
Grau (214/210/203). Keine Farbdrehung - die Figurenblaetter sind seit
v308 auf der Weltpalette, sie zeigen das Ziel schon.

AUSWAHL: sechs Figuren mit deutlich UNTERSCHIEDLICHER Kleidung. Ein Blatt
mit sechs gleich gekleideten Figuren liest sich als "so sieht ein
Siedler aus" und das Modell malt die Vorlage nach; sechs verschiedene
lesen sich als Konvention (Kittel, Hose, Stiefel, Hut) und lassen die
Bauform frei - dasselbe Argument wie beim Gebaeudeblatt.

Genommen wird die FRONTALE Zeile (Zeile 3 von 5: r, fr, f, br, b) des
idle-Blattes, erstes Bild.

NICHT auf dem Blatt: smith, geo und der carrier selbst. Der Kontaktabzug
aller 35 Figuren zeigt sie als die drei misslungenen - der Schmied ist ein
grauschwarzer Fleck ohne lesbare Silhouette, der Geologe malvenfarben,
der Traeger ohne jede Kleidung. Sie sind der Grund fuer dieses Blatt und
duerfen nicht seine Vorlage sein.

    python3 tools/stilblattfiguren.py
"""
import numpy as np
from PIL import Image

FIGUREN = ['woodcutter', 'farm', 'forester', 'baker', 'carpenter', 'scout']
ZELLE, ZEILE_F = 88, 2            # 88er Zellen, Zeile 'f' ist die dritte
GRAU = (214, 210, 203)
HOEHE, RAND = 300, 20             # Zielhoehe der groessten Figur

def figur(key):
    im = Image.open('assets/unit_%s_idle.png' % key).convert('RGBA')
    z = im.crop((0, ZEILE_F*ZELLE, ZELLE, (ZEILE_F+1)*ZELLE))
    a = np.asarray(z)
    ys, xs = np.where(a[..., 3] > 8)
    return z.crop((xs.min(), ys.min(), xs.max()+1, ys.max()+1))

teile = [figur(k) for k in FIGUREN]
hmax = max(t.height for t in teile)
skal = HOEHE / hmax
teile = [t.resize((max(1, round(t.width*skal)), max(1, round(t.height*skal))), Image.LANCZOS)
         for t in teile]
breite = sum(t.width for t in teile) + RAND*(len(teile)+1)
blatt = Image.new('RGB', (breite, HOEHE + 2*RAND), GRAU)
x = RAND
for t in teile:
    blatt.paste(t, (x, RAND + (HOEHE - t.height)), t)
    x += t.width + RAND
blatt.save('tools/ref/stilblattfiguren.png')
print('tools/ref/stilblattfiguren.png  %dx%d  (%s)' % (*blatt.size, ', '.join(FIGUREN)))
