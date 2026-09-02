# -*- coding: utf-8 -*-
"""Die Textur IM Modell aufhellen - vor dem Backen, nicht danach.

Traeger, Schmied und Geologe kamen von Tripo mit sehr dunklen Texturen
zurueck (mittlere Luma 79 / 51 / 70 gegen 81 beim Holzfaeller, der als
gelungen gilt - beim Schmied ist es ein dunkles Schieferblau). Gebacken
ergibt das Figuren mit Luma 49 / 20 / 40; die 29 Menschenfiguren liegen
im Median bei 88, das zehnte Perzentil bei 49. Der Schmied ist damit
keine Figur mehr, sondern eine Silhouette.

ZWEI WEGE, EINER DAVON FALSCH:
 1. Am fertigen Blatt aufhellen. Gebaut, gemessen, verworfen: beim
    Schmied braucht es dafuer Gamma 0,20, und selbst das reicht nur bis
    Luma 72 (18,5 -> 70,0 bei 0,217; ab 0,20 bewegt sich nichts mehr).
    Eine so steile Kurve zieht die wenigen hellen Stellen zusammen und
    frisst die Zeichnung im Gesicht.
 2. Die Textur aufhellen und neu backen. Dann macht das Hauslicht seine
    Arbeit wie bei jeder anderen Figur: der Verlauf ueber die Rundungen
    entsteht neu, statt aus dem Dunkeln herausgezogen zu werden.
Deshalb Weg 2. Das Licht in tools/bake-sprites.html bleibt unangetastet -
es ist der Hausstil, und ein Modell darf nicht das Licht der ganzen Welt
verstellen, nur weil sein Albedo zu dunkel ist.

Gehoben wird ueber eine Gammakurve auf der Luma, der Ton bleibt. Das
Gamma wird eingeschachtelt, bis die mittlere Luma der Textur den Zielwert
trifft.

tools/models/*.glb sind NICHT versioniert (sie werden fuer einen Backlauf
von main geholt). Damit ein zweiter Lauf nicht doppelt hebt, traegt die
Datei den Vermerk in asset.extras['neuland-textur'].

    python3 tools/modelltextur.py smith --ziel 120
"""
import sys, json, struct, io
import numpy as np
from PIL import Image

MARKE = 'neuland-textur'

def lies(pfad):
    d = open(pfad, 'rb').read()
    assert d[:4] == b'glTF', pfad
    off, js, bins = 12, None, None
    while off < len(d):
        ln, ty = struct.unpack_from('<II', d, off); off += 8
        if ty == 0x4E4F534A: js = json.loads(d[off:off+ln].decode('utf-8'))
        elif ty == 0x004E4942: bins = bytearray(d[off:off+ln])
        off += ln
    return js, bins

def schreib(pfad, js, bins):
    j = json.dumps(js, separators=(',', ':')).encode('utf-8')
    j += b' ' * ((4 - len(j) % 4) % 4)
    b = bytes(bins) + b'\0' * ((4 - len(bins) % 4) % 4)
    ganz = (b'JSON'[::-1] if False else struct.pack('<II', len(j), 0x4E4F534A)) + j \
         + struct.pack('<II', len(b), 0x004E4942) + b
    open(pfad, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + len(ganz)) + ganz)

def luma(a):
    return 0.299*a[..., 0] + 0.587*a[..., 1] + 0.114*a[..., 2]

def hebe(a, gamma):
    L = luma(a)
    Ln = 255.0*np.power(np.clip(L, 0, 255)/255.0, gamma)
    k = np.where(L > 1, Ln/np.maximum(L, 1), 1.0)[..., None]
    return np.clip(a*k, 0, 255)

def behandle(modell, ziel):
    pfad = 'tools/models/%s.glb' % modell
    js, bins = lies(pfad)
    alt = js.setdefault('asset', {}).setdefault('extras', {}).get(MARKE)
    if alt:
        print('%-10s schon gehoben (%s)' % (modell, alt)); return
    bild = js['images'][0]
    bv = js['bufferViews'][bild['bufferView']]
    o, n = bv.get('byteOffset', 0), bv['byteLength']
    im = Image.open(io.BytesIO(bytes(bins[o:o+n]))).convert('RGB')
    a = np.asarray(im).astype(np.float64)
    vorher = luma(a).mean()
    lo, hi = 0.15, 1.0
    for _ in range(40):
        g = (lo + hi)/2
        if luma(hebe(a, g)).mean() < ziel: hi = g
        else: lo = g
    g = (lo + hi)/2
    neu = hebe(a, g)
    roh = io.BytesIO()
    Image.fromarray(neu.astype(np.uint8), 'RGB').save(roh, 'JPEG', quality=95)
    roh = roh.getvalue()
    # Der neue Datenblock haengt hinten an, der alte bleibt als Loch liegen -
    # ein GLB darf das, und ein neu zusammengesetzter Puffer wuerde alle
    # anderen bufferViews verschieben.
    while len(bins) % 4: bins.append(0)
    bv['byteOffset'] = len(bins); bv['byteLength'] = len(roh)
    bins.extend(roh)
    js['buffers'][0]['byteLength'] = len(bins)
    js['asset']['extras'][MARKE] = '%.0f' % ziel
    schreib(pfad, js, bins)
    print('%-10s Textur-Luma %5.1f -> %5.1f  (Gamma %.3f, %d kB)'
          % (modell, vorher, luma(neu).mean(), g, len(roh)//1024))

args = sys.argv[1:]
ziel = 110.0
if '--ziel' in args:
    i = args.index('--ziel'); ziel = float(args[i+1]); del args[i:i+2]
for m in args: behandle(m, ziel)
