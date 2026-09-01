# -*- coding: utf-8 -*-
"""Eingeschlossene Hintergrundflaechen aus den Gebaeudebildern entfernen.

Nutzerbefund: "die transparenz passt nicht bei den gebaeuden,
eingeschlossene flaechen sind weiss anstatt transparent".

URSACHE: tools/freistellen.py entfernt den Hintergrund mit einer
Flutfuellung VOM BILDRAND. Das muss so sein - der Schlagschatten hat
dieselbe Farbigkeit wie der Hintergrund, und grauer Stein am Bau auch;
ohne die Randbedingung frisst der Freisteller den Stein mit. Der Preis
ist genau der gemeldete: was RINGSUM von Gebaeude umschlossen ist - die
Oeffnung in einem Geruest, das Innere einer Rundmauer, der Giebel eines
Fachwerks - bleibt stehen und leuchtet milchig.

DASS es der Hintergrund ist, ist gemessen: die Randfarbe der Quellbilder
ist ueber alle Lieferungen (213,1 / 209,5 / 202,5) mit einer Streuung von
0,6 - und die milchigen Reste im fertigen Sprite haben dieselbe Farbe
(bld_build_m_1: Mittel 213,1 / 209,0 / 201,2).

Der Schatten-Einwand gilt hier NICHT, weil nicht nach Farbigkeit gesucht
wird, sondern nach der GANZEN Farbe: ein abgedunkelter Hintergrund liegt
weit weg von ihr, gemalter Werkstoff ebenfalls. Nachgeprueft an zehn
Blaettern mit markierter Maske (Beleg maske.png): getroffen werden
ausschliesslich Oeffnungen; Putz, Stroh und grauer Stein bleiben
unberuehrt - Lagerhaus, Wohnhaus, Baeckerei und Zehntscheune melden
0,0 Prozent.

Weiche Kante: unter T0 ganz weg, ueber T1 ganz da, dazwischen linear -
sonst bliebe ein Saum aus den Mischpixeln der Kante stehen.

    python3 tools/loecherfrei.py [--pruefen]
"""
import sys, glob, os
import numpy as np
from PIL import Image, PngImagePlugin

MARKE, WERT = 'neuland-loecher', 'v1'
BG = np.array([213.1, 209.5, 202.5])
T0, T1 = 12.0, 24.0

def behandle(pfad, nur_pruefen=False):
    im = Image.open(pfad)
    if im.info.get(MARKE) == WERT:
        return 'schon behandelt', 0
    im = im.convert('RGBA')
    a = np.asarray(im).astype(float)
    al = a[..., 3]
    d = np.abs(a[..., :3] - BG).max(2)
    # 0 unter T0, 1 ueber T1, dazwischen weich
    f = np.clip((d - T0) / (T1 - T0), 0, 1)
    neu = np.minimum(al, f * 255.0)
    weg = int(((al > 200) & (neu < 60)).sum())
    if nur_pruefen:
        return '%d Pixel wuerden fallen' % weg, weg
    a[..., 3] = neu
    info = PngImagePlugin.PngInfo()
    info.add_text(MARKE, WERT)
    Image.fromarray(a.astype(np.uint8), 'RGBA').save(pfad, 'PNG', pnginfo=info)
    return '%d Pixel entfernt' % weg, weg

def main(nur_pruefen):
    gesamt = 0
    zeilen = []
    for p in sorted(glob.glob('assets/bld_*.png')):
        txt, n = behandle(p, nur_pruefen)
        gesamt += n
        if n: zeilen.append((n, os.path.basename(p), txt))
    zeilen.sort(reverse=True)
    for n, f, txt in zeilen[:12]:
        print('  %-30s %s' % (f, txt))
    print('%d Blaetter betroffen, %d Pixel %s'
          % (len(zeilen), gesamt, 'wuerden fallen' if nur_pruefen else 'entfernt'))

if __name__ == '__main__':
    main('--pruefen' in sys.argv)
