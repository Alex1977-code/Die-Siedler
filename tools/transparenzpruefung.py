# -*- coding: utf-8 -*-
"""Transparenz der Sprites pruefen - ohne Annahme ueber die Hintergrundfarbe.

Nutzerauftrag: "pruefe die transparenz auch bei den figuren und objekten".

Bei den Gebaeuden war die Hintergrundfarbe der Lieferung bekannt (213,1 /
209,5 / 202,5) und die Suche danach eindeutig. Fuer Figuren und Objekte
taugt das nicht: die Figuren kommen aus dem 3D-Backen und haben nie einen
gemalten Hintergrund gehabt, und bei Objekten liegt echter heller
Werkstoff (Schnee, Tuch, Fischbauch) genau in diesem Farbbereich.

Deshalb drei Pruefungen, die ohne Farbannahme auskommen:

  FLACHE INSELN  Eingeschlossene deckende Flaechen, deren Farbe fast nicht
                 streut. Ein gemalter Werkstoff hat immer Schattierung;
                 ein stehengebliebener Renderhintergrund ist glatt. Ab 60
                 Pixeln und Streuung unter 3 gilt eine Insel als verdaechtig.
  SAUM           Anteil halbdurchsichtiger Pixel (Alpha 8..200) am Umfang.
                 Ein weicher Rand ist normal; ein sehr breiter Saum heisst,
                 dass beim Verkleinern Hintergrund mit eingerechnet wurde.
  DUNKLER RAND   Mittlere Helligkeit des aeussersten deckenden Rings gegen
                 den Kern. Ein deutlich dunklerer Ring ist der klassische
                 Halo eines schlecht freigestellten Bildes.

    python3 tools/transparenzpruefung.py [muster ...]
"""
import sys, glob, os
import numpy as np
from PIL import Image

def inseln(maske):
    h, w = maske.shape
    lab = np.zeros((h, w), np.int32); nr = 0; gr = []
    for sy in range(h):
        for sx in range(w):
            if not maske[sy, sx] or lab[sy, sx]: continue
            nr += 1; st = [(sy, sx)]; n = 0
            while st:
                y, x = st.pop()
                if lab[y, x] or not maske[y, x]: continue
                x0 = x
                while x0 > 0 and maske[y, x0-1] and not lab[y, x0-1]: x0 -= 1
                x1 = x
                while x1 < w-1 and maske[y, x1+1] and not lab[y, x1+1]: x1 += 1
                lab[y, x0:x1+1] = nr; n += x1 - x0 + 1
                for yy in (y-1, y+1):
                    if 0 <= yy < h:
                        for xx in range(x0, x1+1):
                            if maske[yy, xx] and not lab[yy, xx]: st.append((yy, xx))
            gr.append(n)
    return lab, gr

def pruefe(pfad):
    a = np.asarray(Image.open(pfad).convert('RGBA')).astype(float)
    al = a[..., 3]
    deck = al > 200
    if deck.sum() < 200: return None
    # --- SAUM
    saum = int(((al > 8) & (al <= 200)).sum())
    # Umfang grob: deckende Pixel mit mindestens einem nicht-deckenden Nachbarn
    n4 = np.zeros_like(deck)
    n4[1:, :] |= ~deck[:-1, :]; n4[:-1, :] |= ~deck[1:, :]
    n4[:, 1:] |= ~deck[:, :-1]; n4[:, :-1] |= ~deck[:, 1:]
    rand = deck & n4
    umfang = max(1, int(rand.sum()))
    # --- DUNKLER RAND
    lum = 0.299*a[..., 0] + 0.587*a[..., 1] + 0.114*a[..., 2]
    kern = deck & ~rand
    dunkel = (lum[rand].mean() - lum[kern].mean()) if kern.sum() > 50 else 0.0
    # --- FLACHE INSELN: eingeschlossen, also nicht am Bildrand haengend
    h, w = deck.shape
    frei = ~deck
    aus = np.zeros_like(frei)
    st = [(0, x) for x in range(w) if frei[0, x]] + [(h-1, x) for x in range(w) if frei[h-1, x]] \
       + [(y, 0) for y in range(h) if frei[y, 0]] + [(y, w-1) for y in range(h) if frei[y, w-1]]
    while st:
        y, x = st.pop()
        if aus[y, x] or not frei[y, x]: continue
        x0 = x
        while x0 > 0 and frei[y, x0-1] and not aus[y, x0-1]: x0 -= 1
        x1 = x
        while x1 < w-1 and frei[y, x1+1] and not aus[y, x1+1]: x1 += 1
        aus[y, x0:x1+1] = True
        for yy in (y-1, y+1):
            if 0 <= yy < h:
                for xx in range(x0, x1+1):
                    if frei[yy, xx] and not aus[yy, xx]: st.append((yy, xx))
    # deckende Flaechen, die NICHT an den durchsichtigen Aussenraum grenzen
    grenzt = np.zeros_like(deck)
    grenzt[1:, :] |= aus[:-1, :]; grenzt[:-1, :] |= aus[1:, :]
    grenzt[:, 1:] |= aus[:, :-1]; grenzt[:, :-1] |= aus[:, 1:]
    innen = deck & ~grenzt
    lab, gr = inseln(innen)
    flach = []
    for i, n in enumerate(gr):
        if n < 60: continue
        m = lab == (i+1)
        st3 = a[m][:, :3].std(0).max()
        if st3 < 3.0:
            flach.append((n, st3, np.round(a[m][:, :3].mean(0), 1)))
    return dict(saum=saum, umfang=umfang, saumQ=saum/umfang, dunkel=dunkel,
                flach=sorted(flach, reverse=True)[:2], deck=int(deck.sum()))

def main(muster):
    for mus in muster:
        print('===', mus)
        zeilen = []
        for p in sorted(glob.glob(mus)):
            r = pruefe(p)
            if not r: continue
            punkte = (2 if r['flach'] else 0) + (1 if r['saumQ'] > 2.5 else 0) + (1 if r['dunkel'] < -14 else 0)
            zeilen.append((punkte, r['saumQ'], os.path.basename(p), r))
        zeilen.sort(reverse=True)
        auff = [z for z in zeilen if z[0]]
        for punkte, sq, f, r in zeilen[:10]:
            fl = ('  FLACHE INSEL %d px, Streuung %.1f, Farbe %s' % r['flach'][0]) if r['flach'] else ''
            print('  %-30s Saum %.2f x Umfang   Rand %+5.1f%s' % (f, sq, r['dunkel'], fl))
        print('  -> %d von %d auffaellig' % (len(auff), len(zeilen)))

if __name__ == '__main__':
    main(sys.argv[1:] or ['assets/unit_*.png', 'assets/obj_*.png', 'assets/tree_*.png', 'assets/good_*.png'])
