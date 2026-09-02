# -*- coding: utf-8 -*-
"""Zeichenhoehen der typeigenen Baustufen auf eine saubere Kette setzen.

Nutzerauftrag: "pruefe ob die baugroessen der haeuser zum fertigzustand
passen, das muss eine saubere kette ergeben in groesse lage und form".

BEFUND (tools/bauketten.mjs): 24 Haeuser bringen eigene Baustufenblaetter
mit - und in scales.json steht fuer alle drei Stufen DERSELBE Wert wie
fuer das fertige Haus. Die Kette kam damit allein aus der Grafik, aus dem
Anteil, den der Inhalt in seiner Leinwand einnimmt. Das ging oft gut und
manchmal gar nicht:

    Muehle    60,5 -> 59,6 -> 92     Stufe 2 kleiner als Stufe 1
    Kapelle   63,5 -> 60   -> 96     dito
    Katapult  61,5 -> 77,5 -> 62     auf und ab
    Fischer   18   -> 37   -> 36,5   Stufe 1 ein Achtel des Hauses

Hier wird die Zeichenhoehe je Stufe so gesetzt, dass die HOEHE DES
GEZEICHNETEN HAUSES einem festen Anteil der fertigen Hoehe entspricht:
0,55 / 0,80 / 0,92 bei drei Stufen, 0,60 / 0,88 bei zweien. Die Grafik
bleibt unberuehrt, nur ihr Massstab wird gesetzt.

BREITENDECKEL: eine Stufe darf hoechstens 1,15 mal so breit werden wie
das fertige Haus. Ohne ihn wuerde das flache Fundament des Wachturms auf
das Dreifache der Turmbreite wachsen - die Hoehe stimmt dann zwar, aber
die FORM nicht mehr. Wo der Deckel greift, ist die Stufe entsprechend
niedriger; das ist der ehrlichere Kompromiss, weil der Grundriss die
Lage bestimmt.

    python3 tools/baukette.py [--schreiben]
"""
import json, os, sys, io, re
import numpy as np
from PIL import Image

DREI = [0.55, 0.80, 0.92]
ZWEI = [0.60, 0.88]
BREIT_MAX = 1.15

def inhalt(pfad):
    a = np.asarray(Image.open(pfad).convert('RGBA'))
    ys, xs = np.where(a[..., 3] > 8)
    if not len(ys): return None
    return dict(w=a.shape[1], h=a.shape[0],
                iw=xs.max() - xs.min() + 1, ih=ys.max() - ys.min() + 1)

def main(schreiben):
    sc = json.load(open('assets/scales.json'))
    aend = {}
    typen = set()
    for k in sc:
        if k.startswith('bld_build_'):
            rest = k[len('bld_build_'):]
            if '_' in rest:
                t, n = rest.rsplit('_', 1)
                if n.isdigit() and t not in ('s', 'm', 'l', 'turm', 'mine'):
                    typen.add(t)
    for t in sorted(typen):
        fp = 'assets/bld_%s.png' % t
        if not os.path.exists(fp): continue
        fi = inhalt(fp)
        fh = sc.get('bld_%s' % t)
        if not fi or not fh: continue
        f_ih = fh * fi['ih'] / fi['h']              # Hoehe des fertigen Hauses
        f_iw = fh * (fi['w'] / fi['h']) * fi['iw'] / fi['w']
        stufen = [n for n in (1, 2, 3) if os.path.exists('assets/bld_build_%s_%d.png' % (t, n))]
        anteile = DREI if len(stufen) == 3 else ZWEI
        zeile = []
        for n, ant in zip(stufen, anteile):
            p = 'assets/bld_build_%s_%d.png' % (t, n)
            i = inhalt(p)
            if not i: continue
            # Zeichenhoehe der LEINWAND, damit der INHALT die Zielhoehe hat
            hh = (f_ih * ant) / (i['ih'] / i['h'])
            # Breitendeckel
            iw = hh * (i['w'] / i['h']) * i['iw'] / i['w']
            if iw > f_iw * BREIT_MAX:
                hh *= (f_iw * BREIT_MAX) / iw
                iw = f_iw * BREIT_MAX
            key = 'bld_build_%s_%d' % (t, n)
            aend[key] = round(hh, 1)
            zeile.append('%s: %s->%s (Haus %.0f x %.0f)'
                         % (n, sc.get(key), round(hh, 1), hh * i['ih'] / i['h'], iw))
        print('%-12s fertig %.0f x %.0f   %s' % (t, f_ih, f_iw, '  '.join(zeile)))
    if schreiben:
        # NUR die betroffenen Zeilen anfassen: die Datei ist von Hand
        # gepflegt und nach Sachgruppen sortiert, ein json.dump wuerfe die
        # Reihenfolge durcheinander und machte den Unterschied unlesbar.
        txt = io.open('assets/scales.json', encoding='utf-8').read()
        n = 0
        for k, v in aend.items():
            neu = '"%s": %s' % (k, ('%g' % v))
            alt = re.search(r'"%s"\s*:\s*[0-9.]+' % re.escape(k), txt)
            if alt:
                txt = txt[:alt.start()] + neu + txt[alt.end():]; n += 1
            else:
                txt = txt.rstrip().rstrip('}').rstrip().rstrip(',') + ',\n' + neu + '\n}\n'; n += 1
        io.open('assets/scales.json', 'w', encoding='utf-8').write(txt)
        json.loads(txt)      # Syntax sofort pruefen
        print('\n%d Eintraege in assets/scales.json geschrieben.' % n)
    else:
        print('\n%d Eintraege - mit --schreiben uebernehmen.' % len(aend))

if __name__ == '__main__':
    main('--schreiben' in sys.argv)
