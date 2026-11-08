# -*- coding: utf-8 -*-
"""Figurenblaetter auf die Weltpalette ziehen.

Nutzerwunsch: "die farben texturen der figuren soll mehr zum stil passen".
Gemessen ueber alle 26 Menschenblaetter gegen die 43 Gebaeude und 13
Baeume (deckende Pixel, flaechengewichtet):

             Saettigung  Helligkeit  Waerme (r-b)
   Figuren      0,662       75,4        57,6
   Gebaeude     0,416       84,2        45,2
   Baeume       0,702      118,0        90,2

Die Figuren sind also nicht vor allem zu bunt - die Baeume sind bunter -,
sondern zu DUNKEL: neun Punkte unter den Gebaeuden, 43 unter den Baeumen.
Dazu kommen kalte Farben, die es in dieser Welt sonst nicht gibt: das
Tuerkis des Bauern, das Blaugrau von Fischer und Bergmann.

Vier Schritte, alle an den Blaettern abgetastet (je drei Staerken, Belege
pv_alle.png und wv_alle.png):
  1. AUFHELLEN ueber eine weiche Kurve (Gamma 0,78). Trifft 83 - die
     Gebaeude liegen bei 84,2.
  2. KALTE TOENE ENTSAETTIGEN. Der erste Versuch faerbte sie rot ein; Rot
     auf Blau gibt aber Lila, nicht Waerme - Fischer und Bergmann wurden
     malvenfarben. Jetzt werden sie zur eigenen Helligkeit gezogen und nur
     leicht angewaermt: aus dem Tuerkis wird ein ruhiges Salbei, aus dem
     Blaugrau ein Schiefer wie der Stein der Haeuser.
  3. Uebersaettigte Stellen daempfen, wie palBld() es fuer die Gebaeude tut.
  4. Warmer Grundton, danach die Helligkeit zurueckholen.

WARUM IM BILD UND NICHT IM ZEICHNER: als Zeichnerschritt (wie palBld fuer
die Gebaeude) haette es je Blatt eine Leinwand gekostet - 704x440 sind
1,24 MB, und in einer gewachsenen Siedlung sind 40 bis 50 Blaetter
gleichzeitig im Bild. Auf einem Telefon sind das ueber 50 MB fuer eine
Farbverschiebung. Im Blatt kostet sie nichts.

DOPPELT ANWENDEN WAERE EIN FEHLER, darum traegt jede behandelte Datei
einen Vermerk im PNG (tEXt 'neuland-palette'). Dateien mit Vermerk werden
uebersprungen. Der Backtreiber ruft dieses Werkzeug nach jedem frisch
gebackenen Blatt auf, damit neue Blaetter automatisch passen.

    python3 tools/figurenpalette.py assets/unit_*.png
    python3 tools/figurenpalette.py --alle
"""
import sys, glob, os
import numpy as np
from PIL import Image, PngImagePlugin

MARKE, WERT = 'neuland-palette', 'v1'
GAMMA, KALT_WARM, KALT_DE, SAT_S, SAT_K = 0.78, 12.0, 0.50, 0.45, 0.28

def tone(a):
    a = a.astype(np.float64)
    al = a[..., 3]
    r, g, b = a[..., 0].copy(), a[..., 1].copy(), a[..., 2].copy()
    # 1. aufhellen, Farbe behalten
    L = 0.299*r + 0.587*g + 0.114*b
    f = np.where(L > 1, 255*np.power(np.clip(L, 0, 255)/255, GAMMA)/np.maximum(L, 1), 1)
    r, g, b = r*f, g*f, b*f
    # 2. kalt = Rot ist der kleinste Kanal (faengt Blau UND Tuerkis)
    kalt = np.clip((np.maximum(g, b) - r)/60.0, 0, 1)
    Lk = 0.299*r + 0.587*g + 0.114*b
    de = KALT_DE*kalt
    r = Lk + (r - Lk)*(1 - de); g = Lk + (g - Lk)*(1 - de); b = Lk + (b - Lk)*(1 - de)
    r = r + KALT_WARM*kalt; b = b - KALT_WARM*0.8*kalt
    # 3. Uebersaettigung daempfen
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    sa = (mx - mn)/np.maximum(mx, 1)
    L3 = 0.299*r + 0.587*g + 0.114*b
    d = np.clip((sa - SAT_S)/0.35, 0, 1)*SAT_K
    r = L3 + (r - L3)*(1 - d); g = L3 + (g - L3)*(1 - d); b = L3 + (b - L3)*(1 - d)
    # 4. warmer Grundton, Helligkeit zurueck
    r *= 1.03; b *= 0.96
    L4 = 0.299*r + 0.587*g + 0.114*b
    f2 = np.where(L4 > 1, L3/np.maximum(L4, 1), 1)
    r, g, b = r*f2, g*f2, b*f2
    return np.stack([np.clip(r, 0, 255), np.clip(g, 0, 255),
                     np.clip(b, 0, 255), al], -1).astype(np.uint8)

def behandle(pfad):
    im = Image.open(pfad)
    if im.info.get(MARKE) == WERT:
        return 'schon getont'
    im = im.convert('RGBA')
    neu = Image.fromarray(tone(np.asarray(im)), 'RGBA')
    info = PngImagePlugin.PngInfo()
    info.add_text(MARKE, WERT)
    neu.save(pfad, 'PNG', pnginfo=info)
    return 'getont'

def main(args):
    if not args or args == ['--alle']:
        args = sorted(glob.glob('assets/unit_*.png'))
    n = {'getont': 0, 'schon getont': 0}
    for p in args:
        if not os.path.exists(p):
            print('fehlt:', p); continue
        n[behandle(p)] += 1
    print('%d getont, %d schon getont' % (n['getont'], n['schon getont']))

if __name__ == '__main__':
    main([a for a in sys.argv[1:]])
