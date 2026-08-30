# -*- coding: utf-8 -*-
"""Lieferung aus gebaeude/ freistellen und auf die Sprite-Leinwand setzen.

Hintergrund und Schlagschatten weg, dann jedes Bild GENAU so gross und an
genau der Stelle ablegen, wo das bisherige Sprite sein Gebaeude hatte.
Damit bleiben alle Sonderregeln im Zeichner gueltig, ohne Codeaenderung:
Bergwerke werden ueber 320x320 erkannt, Ruinen und HQ ueber scales.json.

Schattenerkennung: Der Schatten ist der Hintergrund mal einem Faktor - seine
FARBIGKEIT bleibt also die des Hintergrunds, nur die Helligkeit faellt. Das
Gebaeude ist waermer. Grauer Stein am Bau hat aber fast dieselbe Farbigkeit
wie der Hintergrund, deshalb reicht der Farbtest allein nicht: Es zaehlt nur,
was vom BILDRAND aus erreichbar ist. Der Schatten haengt am Hintergrund, der
Stein liegt hinter der Gebaeudekante.
"""
import json, os, re, sys
import numpy as np
from PIL import Image

QUELLE, ZIEL = 'gebäude', 'assets'
CHROMA = 0.020      # Farbigkeitsabstand, ab dem ein Pixel zum Gebaeude zaehlt
HELLER = 8          # Pixel heller als der Hintergrund sind nie Schatten
BLEED  = 8          # so weit werden Gebaeudefarben nach aussen verschmiert

def vom_rand(maske):
    """Alle True-Pixel, die vom Bildrand aus zusammenhaengend erreichbar sind.
    Eigene Laufweiten-Flutfuellung: ImageDraw.floodfill aus Pillow 12 fuellt
    hier nichts (gemessen: 0 gefuellte Pixel bei vier gueltigen Saatpunkten)."""
    h, w = maske.shape
    aus = np.zeros((h, w), bool)
    stapel = []
    for x in range(w):
        if maske[0, x]:   stapel.append((x, 0))
        if maske[h-1, x]: stapel.append((x, h-1))
    for y in range(h):
        if maske[y, 0]:   stapel.append((0, y))
        if maske[y, w-1]: stapel.append((w-1, y))
    while stapel:
        x, y = stapel.pop()
        if aus[y, x] or not maske[y, x]: continue
        x1 = x
        while x1 > 0 and maske[y, x1-1] and not aus[y, x1-1]: x1 -= 1
        x2 = x
        while x2 < w-1 and maske[y, x2+1] and not aus[y, x2+1]: x2 += 1
        aus[y, x1:x2+1] = True
        for ny in (y-1, y+1):
            if 0 <= ny < h:
                lauf = maske[ny, x1:x2+1] & ~aus[ny, x1:x2+1]
                if lauf.any():
                    start = np.flatnonzero(lauf & ~np.r_[False, lauf[:-1]])
                    for i in start: stapel.append((x1+int(i), ny))
    return aus


def freistellen(pfad):
    im = Image.open(pfad).convert("RGB")
    a  = np.asarray(im).astype(np.float64)
    h, w, _ = a.shape
    rand = np.concatenate([a[:5].reshape(-1,3), a[-5:].reshape(-1,3),
                           a[:,:5].reshape(-1,3), a[:,-5:].reshape(-1,3)])
    bg = np.median(rand, 0)
    su   = a.sum(2, keepdims=True); su[su<1]=1
    ch   = a[...,:2]/su[...,0:1]
    bgch = bg[:2]/max(1.0, bg.sum())
    lum  = a@np.array([0.299,0.587,0.114]); bglum = float(bg@np.array([0.299,0.587,0.114]))
    # Hintergrund ODER Schatten: gleiche Farbigkeit, nicht heller als der Grund
    bgish = (np.abs(ch-bgch).sum(2) < CHROMA) & (lum < bglum+HELLER)

    # nur was vom Rand aus zusammenhaengend erreichbar ist, faellt weg
    aussen = vom_rand(bgish)
    alpha = np.where(aussen, 0, 255).astype(np.uint8)

    # Gebaeudefarben nach aussen ziehen, sonst zieht das Verkleinern Grau herein
    rgb = a.copy(); frei = aussen.copy()
    for _ in range(BLEED):
        r = np.zeros_like(rgb); n = np.zeros((h,w))
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            src = np.roll(~frei, (dy,dx), (0,1))
            val = np.roll(rgb,   (dy,dx), (0,1))
            r += val*src[...,None]; n += src
        neu = frei & (n>0)
        rgb[neu] = (r[neu]/n[neu,None]); frei[neu]=False
    out = np.dstack([np.clip(rgb,0,255).astype(np.uint8), alpha])
    return Image.fromarray(out, "RGBA")

def bbox(im):
    al = np.asarray(im)[...,3] > 8
    ys, xs = np.where(al)
    if not len(ys): return None
    return xs.min(), ys.min(), xs.max()+1, ys.max()+1

def main():
    zuo = json.load(open('tools/zuordnung.json', encoding='utf-8'))
    fehlt = []
    for quelle, ziel in sorted(zuo.items()):
        qp, zp = os.path.join(QUELLE, quelle), os.path.join(ZIEL, ziel)
        if not os.path.exists(qp) or not os.path.exists(zp):
            fehlt.append((quelle, ziel)); continue
        neu = freistellen(qp)
        nb = bbox(neu)
        neu = neu.crop(nb)
        alt = Image.open(zp).convert("RGBA")
        AW, AH = alt.size
        ab = bbox(alt)
        if ab is None: ab = (0,0,AW,AH)
        zielh = ab[3]-ab[1]
        s = min(zielh/neu.height, (AW*0.98)/neu.width)
        neu = neu.resize((max(1,round(neu.width*s)), max(1,round(neu.height*s))), Image.LANCZOS)
        lein = Image.new("RGBA", (AW, AH), (0,0,0,0))
        cx = (ab[0]+ab[2])/2
        lein.paste(neu, (int(round(cx-neu.width/2)), int(round(ab[3]-neu.height))), neu)
        lein.save(zp)
        print("%-24s -> %-22s %dx%d  Inhalt %dx%d" % (quelle, ziel, AW, AH, neu.width, neu.height))
    if fehlt: print("FEHLT:", fehlt, file=sys.stderr)

if __name__ == '__main__':
    main()
