# -*- coding: utf-8 -*-
"""Drei Zahlen je Figurenblatt - genau die drei Maengel, um die es geht.

Nutzerauftrag: "traeger schmied und geologe kannst du die selber
reparieren". Damit "repariert" mehr ist als ein Bauchgefuehl, braucht es
ein Mass, das die drei Maengel trennt, und zwar OHNE die Regel
nachzubauen, nach der spaeter gefaerbt wird:

  EINFARBIG  Anteil des groessten Farbfeldes am Rumpf. Der Rumpf wird in
             Ton- und Helligkeitsfelder einsortiert (12 Tonfelder a 30
             Grad, 4 Helligkeitsfelder); wie gross ist das groesste?
             Eine Figur mit Kittel, Hose und Stiefeln in verschiedenen
             Farben verteilt sich, eine einfarbig uebermalte nicht.
             Der KOPF bleibt draussen (oberste 24 % der Figur, dieselbe
             Ortsregel wie render.haarMaske und tunika.kopfZone) - Hut
             und Haare sind ohnehin eine eigene Flaeche und wuerden das
             Mass je nach Kopfbedeckung verzerren.
  HELLIGKEIT Mittlere Luma der deckenden Pixel. Zu dunkel heisst: die
             Figur liest sich auf Spielzoom als Silhouette.
  VIOLETT    Anteil der Pixel mit b>g und r>g. Diese Farbe kommt in der
             Welt sonst nicht vor - jeder Prozentpunkt ist ein Fremdkoerper.

Gemessen wird die FRONTALE Zeile (Zeile 3 von 5) des idle-Blattes, alle
Spalten.

    python3 tools/figurenpruefung.py            # alle Figuren, sortiert
    python3 tools/figurenpruefung.py carrier smith geo
"""
import os, sys
import numpy as np
from PIL import Image

ZELLE, ZEILE_F, KOPF = 88, 2, 0.24

def hsv_ton(r, g, b):
    mx = np.maximum(np.maximum(r, g), b).astype(float)
    mn = np.minimum(np.minimum(r, g), b).astype(float)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6,
        np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60.0
    return np.where(h < 0, h + 360, h), np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)

def messe(pfad):
    a = np.asarray(Image.open(pfad).convert('RGBA')).astype(int)
    zeile = a[ZEILE_F*ZELLE:(ZEILE_F+1)*ZELLE]
    deck = zeile[..., 3] > 200
    if deck.sum() < 200: return None
    r, g, b = zeile[..., 0], zeile[..., 1], zeile[..., 2]
    L = 0.299*r + 0.587*g + 0.114*b
    violett = ((b > g+6) & (r > g+6) & deck).sum() / deck.sum()
    # Kopfzone je Zelle abschneiden
    rumpf = deck.copy()
    for i in range(zeile.shape[1] // ZELLE):
        sp = deck[:, i*ZELLE:(i+1)*ZELLE]
        ys = np.where(sp.any(1))[0]
        if not len(ys): continue
        grenze = ys.min() + int(round((ys.max()-ys.min()+1) * KOPF))
        rumpf[:grenze, i*ZELLE:(i+1)*ZELLE] = False
    if rumpf.sum() < 100: return None
    h, s = hsv_ton(r, g, b)
    ton = (h[rumpf] // 30).astype(int)
    hel = np.clip((L[rumpf] // 48), 0, 4).astype(int)
    # GRAU IST KEIN TON. Erster Anlauf sortierte auch blasse Pixel nach
    # ihrem Farbton ein - bei Saettigung nahe null ist der aber Rauschen,
    # und eine durchweg graue Figur streute damit ueber alle zwoelf
    # Tonfelder. Der Schmied kam so auf 28 % und galt als unauffaellig,
    # obwohl er von Kopf bis Fuss dasselbe Grau traegt. Alles unter
    # Saettigung 0,20 landet deshalb in eigenen Graufeldern.
    grau = s[rumpf] < 0.20
    feld = np.where(grau, 96 + hel, ton*8 + hel)
    gross = np.bincount(feld).max() / rumpf.sum()
    return gross, L[deck].mean(), violett*100

def main(wahl):
    zeilen = []
    for f in sorted(os.listdir('assets')):
        if not f.startswith('unit_') or not f.endswith('_idle.png'): continue
        k = f[5:-9]
        if wahl and k not in wahl: continue
        m = messe('assets/'+f)
        if m: zeilen.append((m[0], k, m[1], m[2]))
    zeilen.sort(reverse=True)
    print('%-14s einfarbig  Helligkeit  violett' % 'Figur')
    for e, k, l, v in zeilen:
        print('%-14s %7.1f %%  %8.1f  %6.1f %%' % (k, e*100, l, v))
    if len(zeilen) > 4:
        print('\nMittel: einfarbig %.1f %%, Helligkeit %.1f, violett %.1f %%'
              % (100*np.mean([z[0] for z in zeilen]),
                 np.mean([z[2] for z in zeilen]), np.mean([z[3] for z in zeilen])))

main(set(sys.argv[1:]))
