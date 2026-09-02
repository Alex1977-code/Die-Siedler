# -*- coding: utf-8 -*-
"""Die 22 Bedien-Zeichen freistellen und in assets/ ablegen.

WARUM NICHT tools/freistellen.py: das Werkzeug sucht den Hintergrund
ueber die FARBIGKEIT (gleicher Ton wie der Rand, nicht heller) und
flutet vom Bildrand. Bei einem Gebaeude ist das richtig - der
Schlagschatten hat die Farbigkeit des Grundes. Bei diesen Zeichen waere
es toedlich: sie sind aus dunklem EISEN, also grau, und der Grund ist
ebenfalls grau. Chromatisch sind beide identisch; die Flutfuellung liefe
vom Rand direkt ins Zeichen hinein und friesse es auf.

Hier geht es einfacher, weil der Grund flach ist (gemessen: Streuung
0,5 bis 0,8 ueber alle 22). Es zaehlt der ABSTAND zur Grundfarbe im RGB,
und den hat dunkles Eisen reichlich (dunkelster Bildpunkt 0 bis 64 gegen
Grund 118 bis 228). Weiche Kante von 20 bis 40, damit kein Saum bleibt.

Der Schlagschatten faellt dabei von selbst weg: er ist der Grund mal
einem Faktor knapp unter eins, sein Abstand liegt also unter der
Schwelle. Nachgemessen an drei Zeichen mit Schatten (Glocke, Haus,
Zahnrad): zwischen Schwelle 10 und 30 aendert sich die Deckung nur um
1,8 / 1,0 / 1,1 Prozentpunkte - da ist nichts Massives mehr.

Keine Flutfuellung heisst zugleich: eingeschlossene Flaechen sind
automatisch durchsichtig. Das Loch im Zahnrad und die Zwickel zwischen
den gekreuzten Schwertern muessen es sein.

    python3 tools/icons-einbau.py
"""
import json, os, glob
import numpy as np
from PIL import Image

QUELLE, ZIEL, KANTE = 'ui', 'assets', 128
T0, T1 = 20.0, 40.0
NAMEN = {
 'ic-01-kampagne':'kampagne',   'ic-02-freispiel':'freispiel', 'ic-03-mehrspieler':'mehrspieler',
 'ic-04-laden':'laden',         'ic-05-optionen':'optionen',   'ic-06-anleitung':'anleitung',
 'ic-07-speichern':'speichern', 'ic-08-ziele':'ziele',         'ic-09-statistik':'statistik',
 'ic-10-transport':'transport', 'ic-11-testmodus':'test',      'ic-12-meldungen':'meldungen',
 'ic-13-export':'export',       'ic-14-fahne':'fahne',         'ic-15-abreissen':'abreissen',
 'ic-16-angriff':'angriff',     'ic-17-warnung':'warnung',     'ic-18-erfuellt':'erfuellt',
 'ic-19-tipp':'tipp',           'ic-20-waren':'waren',         'ic-21-schliessen':'schliessen',
 'ic-22-gebaeude':'gebaeude',
}

def frei(pfad):
    a = np.asarray(Image.open(pfad).convert('RGB')).astype(float)
    rand = np.concatenate([a[:6].reshape(-1,3), a[-6:].reshape(-1,3),
                           a[:,:6].reshape(-1,3), a[:,-6:].reshape(-1,3)])
    bg = np.median(rand, 0)
    al = np.clip((np.abs(a-bg).max(2) - T0)/(T1-T0), 0, 1)
    # Zeichenfarben nach aussen ziehen, sonst zieht das Verkleinern Grau herein
    rgb = a.copy(); frei_m = al < 0.02
    for _ in range(6):
        s = np.zeros_like(rgb); n = np.zeros(al.shape)
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            q = np.roll(~frei_m, (dy,dx), (0,1)); v = np.roll(rgb, (dy,dx), (0,1))
            s += v*q[...,None]; n += q
        neu = frei_m & (n > 0)
        rgb[neu] = s[neu]/n[neu,None]; frei_m[neu] = False
    return Image.fromarray(np.dstack([np.clip(rgb,0,255), al*255]).astype(np.uint8), 'RGBA')

man = set(json.load(open('assets/manifest.json')))
for q, kurz in sorted(NAMEN.items()):
    p = os.path.join(QUELLE, q + '.png')
    if not os.path.exists(p): print('FEHLT', p); continue
    im = frei(p)
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > 6)
    im = im.crop((xs.min(), ys.min(), xs.max()+1, ys.max()+1))
    s = KANTE/max(im.width, im.height)
    im = im.resize((max(1, round(im.width*s)), max(1, round(im.height*s))), Image.LANCZOS)
    ziel = 'ui_ic_%s' % kurz
    im.save(os.path.join(ZIEL, ziel + '.png'))
    man.add(ziel + '.png')
    print('%-20s -> %-18s %dx%d' % (q, ziel, *im.size))
json.dump(sorted(man), open('assets/manifest.json', 'w'), indent=1)
print('%d Namen im Manifest' % len(man))
