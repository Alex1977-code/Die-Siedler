# -*- coding: utf-8 -*-
"""Schwarzen Saum aus den Sprites nehmen (Alpha-Bluten).

Nutzerauftrag: "pruefe die transparenz auch bei den figuren und objekten".

BEFUND. Die vollstaendig durchsichtigen Pixel tragen in ALLEN Gruppen zu
95 bis 99,5 Prozent reines Schwarz. Das allein ist harmlos - der Browser
rechnet beim Zeichnen mit vormultiplizierten Werten, dort faellt ein
schwarzer, aber unsichtbarer Pixel nicht ins Gewicht.

Schaedlich ist der HALBDURCHSICHTIGE Saum. Gemessen wurde je Blatt, ob
seine Saumfarbe eher der Kantenfarbe entspricht (gerades Alpha, richtig)
oder der Kantenfarbe MAL dem Alphawert (vormultipliziert, falsch):

    good_coin   Kante 190,7/145,1/54,1   Saum 79,4/50,8/11,6
                Kante mal Alpha 0,45:    85,9/65,4/24,4  -> passt

Solche Blaetter mischen beim Zeichnen Schwarz ein. Im Browser auf Magenta
nachgesehen: der dunkelste Uebergang von good_coin ist 153/0/153, also
reines Magenta mal 0,6 - die fehlenden 40 Prozent sind Schwarz.

BEHANDLUNG. Nicht durch Teilen durch Alpha (das verstaerkt Rauschen bei
kleinen Alphawerten), sondern durch BLUTEN: die Farbe des Saums wird durch
die naechstgelegene deckende Farbe ersetzt, das Alpha bleibt. Damit
verschwindet das Schwarz, ohne dass eine Farbe erfunden wird.

NICHT ANGEFASST werden fx_*: Rauch, Glut und Funken laufen absichtlich
dunkel aus, dort IST der dunkle Saum die Grafik.

    python3 tools/randbluten.py [--pruefen]
"""
import sys, glob, os
import numpy as np
from PIL import Image, PngImagePlugin

MARKE, WERT = 'neuland-randbluten', 'v1'
SCHWELLE = 25.0          # wie weit der Saum vom geraden Modell abweichen darf

def messe(a):
    al = a[..., 3]
    saum = (al > 20) & (al < 235); deck = al > 250
    if saum.sum() < 30: return None
    nb = np.zeros_like(deck)
    nb[1:, :] |= saum[:-1, :]; nb[:-1, :] |= saum[1:, :]
    nb[:, 1:] |= saum[:, :-1]; nb[:, :-1] |= saum[:, 1:]
    kante = deck & nb
    if kante.sum() < 20: return None
    kf = a[kante][:, :3].mean(0); sf = a[saum][:, :3].mean(0)
    sa = al[saum].mean() / 255.0
    if sa < 0.05 or sa > 0.95: return None
    return float(np.abs(sf - kf * sa).mean()), float(np.abs(sf - kf).mean())

def bluten(a):
    """Farbe der nicht voll deckenden Pixel aus der Nachbarschaft holen."""
    rgb = a[..., :3].copy(); al = a[..., 3]
    fest = al > 250
    frei = ~fest
    for _ in range(14):
        if not frei.any(): break
        s = np.zeros_like(rgb); n = np.zeros(rgb.shape[:2])
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = np.roll(fest, (dy, dx), (0, 1))
            v = np.roll(rgb, (dy, dx), (0, 1))
            s += v * q[..., None]; n += q
        neu = frei & (n > 0)
        if not neu.any(): break
        rgb[neu] = s[neu] / n[neu, None]
        fest = fest | neu; frei = ~fest
    out = a.copy(); out[..., :3] = rgb
    return out

def main(nur_pruefen):
    treffer = []
    for p in sorted(glob.glob('assets/*.png')):
        n = os.path.basename(p)
        if n.startswith('fx_'): continue
        im = Image.open(p)
        if im.info.get(MARKE) == WERT: continue
        a = np.asarray(im.convert('RGBA')).astype(float)
        m = messe(a)
        if not m: continue
        vor, ger = m
        if vor < ger and ger > SCHWELLE:
            treffer.append((ger, n, p, a, im))
    treffer.sort(reverse=True)
    for ger, n, p, a, im in treffer[:12]:
        print('  %-30s Abweichung vom geraden Modell %.1f' % (n, ger))
    print('%d Blaetter %s' % (len(treffer), 'wuerden bluten' if nur_pruefen else 'geblutet'))
    if nur_pruefen: return
    for ger, n, p, a, im in treffer:
        info = PngImagePlugin.PngInfo(); info.add_text(MARKE, WERT)
        Image.fromarray(np.clip(bluten(a), 0, 255).astype(np.uint8), 'RGBA').save(p, 'PNG', pnginfo=info)

if __name__ == '__main__':
    main('--pruefen' in sys.argv)
