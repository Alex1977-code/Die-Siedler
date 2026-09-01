# -*- coding: utf-8 -*-
"""Baustufenblaetter auf die Kette des fertigen Hauses bringen.

Nutzerauftrag: "pruefe ob die baugroessen der haeuser zum fertigzustand
passen, das muss eine saubere kette ergeben in groesse lage und form".
Gemessen hat das tools/bauketten.mjs; zwei Befunde lassen sich nur am
BILD beheben, nicht ueber scales.json:

FISCHER. Alle drei Baustufen liegen auf 106x118 mit 44 bis 45 Zeilen
LEERRAUM UNTEN. Die Leinwand steht mit ihrer Unterkante 10 px unter dem
Knoten - der Rohbau schwebte dadurch 22 px ueber dem Boden, waehrend das
fertige Haus (101x118, randlos) aufsitzt. Hier wird eng beschnitten; die
Zeichenhoehen kommen aus scales.json und werden mitgezogen.

BERGWERKE. Die drei Minen-Baustufen sind 320x320 wie die fertigen Minen
und teilen sich deren festen Zeichenfaktor (MINE_F) - ueber scales.json
ist an ihnen nichts zu stellen. Ihr Inhalt war aber HOEHER als der der
fertigen Mine: 217 / 278 / 295 Zeilen gegen 239. Die letzte Baustufe
ueberragte das fertige Bergwerk also um 23 %, beim Fertigwerden schrumpfte
es. Hier wird der INHALT in der Leinwand verkleinert - um die Bodenlinie
und die Mittelachse, damit Stand und Lage bleiben.

Doppelt anwenden waere ein Fehler, darum traegt jede behandelte Datei
einen Vermerk im PNG.

    python3 tools/baustufenmass.py
"""
import sys, os
import numpy as np
from PIL import Image, PngImagePlugin

MARKE, WERT = 'neuland-baustufe', 'v1'

def rahmen(a):
    ys, xs = np.where(a[..., 3] > 8)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

def schon(im):
    return im.info.get(MARKE) == WERT

def sichern(im, pfad):
    info = PngImagePlugin.PngInfo()
    info.add_text(MARKE, WERT)
    im.save(pfad, 'PNG', pnginfo=info)

def eng(pfad):
    """Rundum eng beschneiden - das Blatt sitzt danach auf der Bodenlinie."""
    im = Image.open(pfad)
    if schon(im): return 'schon behandelt'
    im = im.convert('RGBA')
    b = rahmen(np.asarray(im))
    neu = im.crop(b)
    sichern(neu, pfad)
    return 'beschnitten auf %dx%d' % (neu.width, neu.height)

def schrumpfen(pfad, faktor, boden_zeile, mitte_spalte):
    """Inhalt verkleinern, Leinwand behalten, Bodenlinie und Achse halten."""
    im = Image.open(pfad)
    if schon(im): return 'schon behandelt'
    im = im.convert('RGBA')
    W, H = im.size
    x0, y0, x1, y1 = rahmen(np.asarray(im))
    inh = im.crop((x0, y0, x1, y1))
    nw, nh = max(1, round(inh.width * faktor)), max(1, round(inh.height * faktor))
    inh = inh.resize((nw, nh), Image.LANCZOS)
    leer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # unten auf dieselbe Bodenlinie, waagerecht auf dieselbe Mittelachse
    px = int(round(mitte_spalte - nw / 2))
    py = int(round(boden_zeile - nh))
    leer.paste(inh, (px, py), inh)
    sichern(leer, pfad)
    return 'Inhalt %.3f -> %dx%d' % (faktor, nw, nh)

def main():
    print('FISCHER (eng beschneiden)')
    for k in ['bld_build_fisher_1', 'bld_build_fisher_2', 'bld_build_fisher_3']:
        p = 'assets/%s.png' % k
        print('  %-22s %s' % (k, eng(p)))
    # Bergwerke: Zielhoehen als Anteil des fertigen Bergwerks (239 Zeilen
    # Inhalt, gemessen an bld_coalmine). 0,55 / 0,78 / 0,95 - die letzte

    print('BERGWERKE (Inhalt verkleinern)')
    ZIEL = {'bld_build_mine_1': 0.55, 'bld_build_mine_2': 0.78, 'bld_build_mine_3': 0.95}
    FERTIG = 239.0
    for k, anteil in ZIEL.items():
        p = 'assets/%s.png' % k
        im = Image.open(p)
        if schon(im):
            print('  %-22s schon behandelt' % k); continue
        a = np.asarray(im.convert('RGBA'))
        x0, y0, x1, y1 = rahmen(a)
        f = (FERTIG * anteil) / (y1 - y0)
        # Bodenlinie und Achse aus dem FERTIGEN Bergwerk: Inhalt endet dort
        # 20 Zeilen ueber der Unterkante, die Achse liegt in der Bildmitte
        print('  %-22s %s' % (k, schrumpfen(p, f, im.height - 20, im.width / 2)))

    print('EISENBERGWERK (Inhalt vergroessern)')
    # Alle vier Bergwerke teilen sich den festen Zeichenfaktor MINE_F, ueber
    # scales.json ist an ihnen nichts zu stellen. Ihre Inhalte sind aber
    # verschieden hoch: Kohle 239, Gold 238, Granit 239 - und Eisen nur 206
    # Zeilen. Die letzte Baustufe (227 Zeilen) ueberragte damit ausgerechnet
    # das fertige Eisenbergwerk, es schrumpfte beim Fertigwerden um 9 %.
    # Also auf das Mass der Geschwister ziehen.
    p = 'assets/bld_ironmine.png'
    im = Image.open(p)
    if schon(im):
        print('  bld_ironmine           schon behandelt')
    else:
        a = np.asarray(im.convert('RGBA'))
        x0, y0, x1, y1 = rahmen(a)
        f = 239.0 / (y1 - y0)
        print('  %-22s %s' % ('bld_ironmine', schrumpfen(p, f, im.height - 20, im.width / 2)))

    print('ERSCHOEPFTE BERGWERKE (auf den arbeitenden Zwilling ziehen)')
    # Wenn ein Vorkommen versiegt, tauscht der Zeichner bld_<typ> gegen
    # bld_<typ>_leer. Gemessen waren die erschoepften Bilder aber durchweg
    # groesser als die arbeitenden - 260 bis 263 Zeilen Inhalt gegen 238 bis
    # 239 - und sassen ein bis zwei Zeilen hoeher. Das Bergwerk WUCHS also
    # beim Versiegen und rutschte dabei nach oben.
    #
    # Jeder Erschoepfte wird deshalb auf das Mass SEINES Zwillings gezogen:
    # gleiche Inhaltshoehe, gleiche Bodenlinie, gleiche Mittelachse. Nicht
    # auf einen gemeinsamen Mittelwert - Gold und Granit stehen im Bild
    # etwas rechts der Mitte, und das soll erhalten bleiben.
    for typ in ['coalmine', 'ironmine', 'goldmine', 'granitemine']:
        pa, pl = 'assets/bld_%s.png' % typ, 'assets/bld_%s_leer.png' % typ
        if not (os.path.exists(pa) and os.path.exists(pl)): continue
        im = Image.open(pl)
        if schon(im):
            print('  %-22s schon behandelt' % ('bld_%s_leer' % typ)); continue
        aa = np.asarray(Image.open(pa).convert('RGBA'))
        ax0, ay0, ax1, ay1 = rahmen(aa)
        ziel_h = ay1 - ay0                      # Inhaltshoehe des arbeitenden
        boden = ay1                             # dessen Bodenzeile
        achse = (ax0 + ax1) / 2.0               # dessen Mittelachse
        al = np.asarray(im.convert('RGBA'))
        lx0, ly0, lx1, ly1 = rahmen(al)
        f = ziel_h / float(ly1 - ly0)
        print('  %-22s %s' % ('bld_%s_leer' % typ, schrumpfen(pl, f, boden, achse)))

if __name__ == '__main__':
    main()
