# -*- coding: utf-8 -*-
"""Effekt-Anker aus dem Gebaeudebild MESSEN statt tippen.

BLD_FX in js/render.js verankert jeden Effekt in Bild-Bruchteilen. Diese
Werte waren Handmasse auf die alten Sprites - nach einer Bildlieferung
zeigen sie ins Leere (Nutzerbefund v297: "beim Holzfaeller dreht sich
etwas das nicht passt, im Saegewerk eierte ein Rad"). Damit das nicht bei
jeder Lieferung von vorn beginnt, werden die beiden auffaelligsten Arten
aus dem Bild bestimmt:

  glow/sparks -> Schwerpunkt der HEISSEN Pixel (Esse, Ofenmaul, Schmelze).
                 Heiss heisst: kraeftig und deutlich rotstichig.
  smoke       -> Kopf des Schornsteins: oberster schmaler Vorsprung der
                 Silhouette. Ein Schornstein ist schmal und steht ueber
                 dem First; Dachfirst und Wimpel fallen ueber die Breite
                 beziehungsweise ueber die Deckung heraus.
"""
import json, os, sys
import numpy as np
from PIL import Image

def lade(name):
    p = os.path.join('assets', name + '.png')
    if not os.path.exists(p): return None
    return np.asarray(Image.open(p).convert("RGBA")).astype(int)

def heiss(a):
    """Schwerpunkt der Glutpixel als Bild-Bruchteil, oder None."""
    al = a[..., 3] > 60
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # Warmes Holz und Reet erfuellen "rotstichig" auch - gemessen 4251
    # Treffer beim Reetdach der Baeckerei. Echte Glut ist zusaetzlich SEHR
    # hell und stark gesaettigt; danach bleiben nur Esse und Ofenmaul.
    m = al & (r > 215) & (r - b > 120) & (g > 90) & (g < r - 40)
    # Das obere Fuenftel ausschliessen: dort glimmt bei mehreren Bauten der
    # SCHORNSTEINKOPF, und der zog den Schwerpunkt vom Ofenmaul weg
    # (Waffenkammer 0,513/0,457 lag auf dem Dach statt an der Esse).
    m[:int(a.shape[0] * 0.20)] = False
    if m.sum() < 4: return None
    ys, xs = np.where(m)
    # Gewicht nach Roetung: das Zentrum der Glut zaehlt mehr als der Saum
    w = (r[m] - b[m]).astype(float)
    return (float((xs * w).sum() / w.sum()) / a.shape[1],
            float((ys * w).sum() / w.sum()) / a.shape[0],
            int(m.sum()))

def schornstein(a, maxbreite=0.28, minhoehe=0.07, drift=0.05):
    """Kopf des Schornsteins als Bild-Bruchteil.

    Ein schmaler Lauf allein reicht nicht: die SPITZE DES DACHFIRSTS ist am
    Giebel ebenfalls schmal und liegt oft hoeher als der Schornstein
    (gemessen: Bauernhof, Schlachterei, Muenze und Waffenkammer bekamen
    alle den First bei x rund 0,74). Ein Schornstein bleibt aber ueber eine
    SPANNE schmal und behaelt seine Mitte; ein First wird sofort breiter.
    Verlangt wird deshalb: schmal ueber mindestens minhoehe der Bildhoehe,
    Mitte wandert dabei weniger als drift.
    """
    al = a[..., 3] > 60
    H, W, _ = a.shape
    def laeufe(y):
        z = np.flatnonzero(al[y])
        if not len(z): return []
        br = np.flatnonzero(np.diff(z) > 1)
        st = np.r_[z[0], z[br + 1]]; en = np.r_[z[br], z[-1]]
        return list(zip(st, en))
    for y in range(H):
        for s0, e0 in laeufe(y):
            b0 = e0 - s0 + 1
            if b0 < 2 or b0 > W * maxbreite: continue
            mitte = (s0 + e0) / 2
            tief = 0
            for y2 in range(y + 1, H):
                # Breite muss KONSTANT bleiben. Die Standhoehe allein trennt
                # nicht: am Giebel bleibt der Dachrand ebenfalls lange
                # schmal, er wird nur stetig breiter (gemessen: Bauernhof,
                # Schlachterei, Muenze und Werkzeugschmiede bekamen weiter
                # alle den First bei x rund 0,74).
                tr = [(s, e) for s, e in laeufe(y2)
                      if abs((s + e) / 2 - mitte) <= W * drift
                      and (e - s + 1) <= b0 + 3 and (e - s + 1) >= b0 - 2]
                if not tr: break
                tief += 1
            if tief >= H * minhoehe:
                return (mitte / W, y / H, int(b0))
    return None


if __name__ == '__main__':
    ziele = json.load(open('tools/fx-ziele.json', encoding='utf-8'))
    print(f"{'Gebaeude':14s} {'Art':7s} {'x':>6s} {'y':>6s}  Belegpixel")
    erg = {}
    for typ, arten in ziele.items():
        a = lade('bld_' + typ)
        if a is None:
            print(f"{typ:14s} BILD FEHLT"); continue
        erg[typ] = {}
        for art in arten:
            if art in ('glow', 'sparks'):
                t = heiss(a)
                if t: erg[typ][art] = [round(t[0], 3), round(t[1], 3)]
                print(f"{typ:14s} {art:7s} " + (f"{t[0]:6.3f} {t[1]:6.3f}  {t[2]}" if t else "   nichts gefunden"))
            elif art == 'smoke':
                t = schornstein(a)
                if t: erg[typ][art] = [round(t[0], 3), round(t[1], 3)]
                print(f"{typ:14s} {art:7s} " + (f"{t[0]:6.3f} {t[1]:6.3f}  Breite {t[2]}" if t else "   nichts gefunden"))
    json.dump(erg, open('tools/fx-anker.json', 'w', encoding='utf-8'), indent=1)
