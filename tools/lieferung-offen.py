# -*- coding: utf-8 -*-
"""Die sechs NEUEN Bilder der Offen-Lieferung ablegen.

tools/freistellen.py kann nur ERSETZEN: es liest die Leinwandmasse aus der
alten Datei. Sieben Bilder der Lieferung haben ein solches Vorbild
(Grenzstein, Muehlenfluegel, fuenf Baustufen) und laufen dort. Sechs sind
neu und bekommen ihre Leinwand hier:

  deco_gras1..3     Wiesenbueschel, Hoehe 150 wie deco_thistle/deco_flowers.
                    Sie ersetzen die drei gezeichneten Halmboegen in
                    render.drawDoodad - dieselbe Stelle, dieselbe Streuung.
  deco_flowers4..5  zwei weitere Blumensorten in denselben Streutopf.
  obj_minewheel     Das Foerderrad der Mine. QUADRATISCH und mittig wie
                    obj_millsails: es wird um seine Bildmitte gedreht, ein
                    aus der Mitte sitzendes Rad wuerde eiern. Die Mitte ist
                    dabei die NABE, nicht die Bounding Box - deshalb wird
                    sie gesucht (groesste eingeschriebene Scheibe der
                    Deckungsmaske) und nicht aus den Raendern gerechnet.

    python3 tools/lieferung-offen.py
"""
import os, sys, json, importlib.util
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('fs', 'tools/freistellen.py')
fs = importlib.util.module_from_spec(spec); spec.loader.exec_module(fs)

Q = 'gebäude'
DEKO = [('offen-01-grasbuschel-1', 'deco_gras1'),
        ('offen-02-grasbuschel-2', 'deco_gras2'),
        ('offen-03-grasbuschel-3', 'deco_gras3'),
        ('offen-04-wiesenblumen-1', 'deco_flowers4'),
        ('offen-05-wiesenblumen-2', 'deco_flowers5')]
HOEHE = 150
RAD = ('offen-07-minenrad', 'obj_minewheel', 512)

def nabe(al):
    """Mitte der groessten eingeschriebenen Scheibe - beim Speichenrad die
    Nabe. Die Bounding Box taugt nicht: die Speichen sind symmetrisch, der
    Rand aber ausgefranst, und ein Rad mit einem Pixel Ueberstand haette
    seine Achse daneben."""
    m = al > 8
    d = np.zeros(m.shape, np.int32)
    # Abstandstransformation, zwei Durchlaeufe (Chamfer)
    d[m] = 1 << 20
    h, w = m.shape
    for y in range(h):
        for x in range(w):
            if not m[y, x]: continue
            v = d[y, x]
            if y: v = min(v, d[y-1, x]+1)
            if x: v = min(v, d[y, x-1]+1)
            d[y, x] = v
    for y in range(h-1, -1, -1):
        for x in range(w-1, -1, -1):
            if not m[y, x]: continue
            v = d[y, x]
            if y < h-1: v = min(v, d[y+1, x]+1)
            if x < w-1: v = min(v, d[y, x+1]+1)
            d[y, x] = v
    y, x = np.unravel_index(np.argmax(d), d.shape)
    return float(x), float(y), int(d[y, x])

def main():
    man = set(json.load(open('assets/manifest.json')))
    for quelle, ziel in DEKO:
        im = fs.freistellen(os.path.join(Q, quelle + '.png'))
        im = im.crop(fs.bbox(im))
        s = HOEHE / im.height
        im = im.resize((max(1, round(im.width*s)), HOEHE), Image.LANCZOS)
        im.save('assets/%s.png' % ziel)
        man.add(ziel + '.png')
        print('%-24s -> %-16s %dx%d' % (quelle, ziel, *im.size))
    quelle, ziel, K = RAD
    im = fs.freistellen(os.path.join(Q, quelle + '.png'))
    im = im.crop(fs.bbox(im))
    nx, ny, r = nabe(np.asarray(im)[..., 3])
    # so skalieren, dass das Rad um die NABE gedreht ganz auf die Leinwand passt
    reich = max(nx, im.width-nx, ny, im.height-ny)
    s = (K/2 * 0.98) / reich
    im2 = im.resize((max(1, round(im.width*s)), max(1, round(im.height*s))), Image.LANCZOS)
    lein = Image.new('RGBA', (K, K), (0, 0, 0, 0))
    lein.alpha_composite(im2, (int(round(K/2 - nx*s)), int(round(K/2 - ny*s))))
    lein.save('assets/%s.png' % ziel)
    # ZWEITER DURCHGANG. Der Freisteller flutet nur vom Bildrand, die acht
    # Zwickel zwischen den Speichen sind aber ringsum von Rad umschlossen -
    # sie bleiben stehen, und das Rad ist beim ersten Messen eine VOLLE
    # SCHEIBE. Die gesuchte Nabe waere dann irgendein Punkt in der Mitte
    # dieser Scheibe, nicht die Achse. Also: Loecher raus (dasselbe
    # Werkzeug wie bei den Gebaeuden), dann die Nabe noch einmal suchen und
    # das Rad darauf schieben.
    import subprocess
    subprocess.run([sys.executable, 'tools/loecherfrei.py', 'assets/%s.png' % ziel],
                   check=True, capture_output=True)
    off = Image.open('assets/%s.png' % ziel).convert('RGBA')
    nx2, ny2, r2 = nabe(np.asarray(off)[..., 3])
    lein = Image.new('RGBA', (K, K), (0, 0, 0, 0))
    lein.alpha_composite(off, (int(round(K/2 - nx2)), int(round(K/2 - ny2))))
    lein.save('assets/%s.png' % ziel)
    man.add(ziel + '.png')
    print('%-24s -> %-16s %dx%d  Nabe %.0f/%.0f (voll) -> %.0f/%.0f r=%d'
          % (quelle, ziel, K, K, nx, ny, nx2, ny2, r2))
    json.dump(sorted(man), open('assets/manifest.json', 'w'), indent=1)
    print('%d Namen im Manifest' % len(man))

main()
