"""
Nahtlose Chibi-Terrain-Texturen (Albedo + Normalmap).

Nahtlosigkeit ist hier nicht "geprompted", sondern strukturell:
alle Rauschfelder werden per FFT-Bandpass auf dem Torus erzeugt,
alle Zellrauschen mit toroidaler Distanz. Damit ist jede Textur
per Konstruktion periodisch.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os

SIZE = 1024
OUT = "/mnt/user-data/outputs/terrain"
os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------- Rauschen
def norm(a):
    a = a - a.min()
    m = a.max()
    return a / m if m > 0 else a


def tiling_noise(size, freq, seed, width=0.6):
    """Bandbegrenztes, periodisches Rauschen via FFT-Filter."""
    rng = np.random.default_rng(seed)
    F = np.fft.fft2(rng.normal(size=(size, size)))
    f = np.fft.fftfreq(size) * size
    FX, FY = np.meshgrid(f, f)
    r = np.sqrt(FX ** 2 + FY ** 2)
    filt = np.exp(-((r - freq) ** 2) / (2 * (freq * width) ** 2))
    filt[0, 0] = 0
    return norm(np.real(np.fft.ifft2(F * filt)))


def fbm(size, freq, seed, octaves=4, gain=0.5):
    out = np.zeros((size, size))
    amp, f, tot = 1.0, freq, 0.0
    for i in range(octaves):
        out += amp * tiling_noise(size, f, seed + i * 101)
        tot += amp
        amp *= gain
        f *= 2
    return norm(out / tot)


def tiling_worley(size, n_cells, seed):
    """F1/F2 mit Wrap-around-Distanz -> kachelbar."""
    rng = np.random.default_rng(seed)
    pts = rng.random((n_cells, 2))
    ys, xs = np.mgrid[0:size, 0:size]
    ys = ys / size
    xs = xs / size
    f1 = np.full((size, size), 9.0)
    f2 = np.full((size, size), 9.0)
    for py, px in pts:
        dy = np.abs(ys - py)
        dy = np.minimum(dy, 1 - dy)
        dx = np.abs(xs - px)
        dx = np.minimum(dx, 1 - dx)
        d = np.sqrt(dy * dy + dx * dx)
        nearer = d < f1
        f2 = np.where(nearer, f1, np.minimum(f2, d))
        f1 = np.where(nearer, d, f1)
    return f1, f2


def blur(a, radius):
    """Periodische Gauss-Unschaerfe (im Frequenzraum -> bleibt kachelbar)."""
    size = a.shape[0]
    f = np.fft.fftfreq(size) * size
    FX, FY = np.meshgrid(f, f)
    r2 = FX ** 2 + FY ** 2
    k = np.exp(-2 * (np.pi * radius / size) ** 2 * r2)
    return np.real(np.fft.ifft2(np.fft.fft2(a) * k))


def lerp_col(c1, c2, t):
    c1 = np.array(c1, float)
    c2 = np.array(c2, float)
    return c1[None, None, :] + (c2 - c1)[None, None, :] * t[:, :, None]


def save_albedo(rgb, name):
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    img.save(f"{OUT}/{name}_albedo.png")
    return img


def save_normal(height, name, strength=1.0):
    """Normalmap aus Hoehenfeld, Gradient mit np.roll -> periodisch."""
    h = height.astype(np.float64)
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    s = strength * 60.0
    nx, ny, nz = -dx * s, -dy * s, np.ones_like(h)
    ln = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    nrm = np.stack([nx / ln, ny / ln, nz / ln], axis=-1)
    img = Image.fromarray(((nrm * 0.5 + 0.5) * 255).astype(np.uint8))
    img.save(f"{OUT}/{name}_normal.png")


# ---------------------------------------------------------------- Materialien
def mat_gras():
    low = fbm(SIZE, 3, 11, 3)                       # grosse Farbfelder
    mid = tiling_noise(SIZE, 26, 23)                # feine Sprenkelung
    tuft = tiling_noise(SIZE, 70, 31)               # Grasbueschel
    tuft = np.clip((tuft - 0.68) * 4.5, 0, 1)

    t = np.clip(low * 0.75 + mid * 0.25, 0, 1)
    rgb = lerp_col((123, 190, 56), (163, 216, 78), t)          # zwei nahe Gruens
    rgb = rgb * (1 - 0.10 * tuft[:, :, None]) + \
          np.array([96, 165, 48])[None, None, :] * 0.10 * tuft[:, :, None]
    save_albedo(rgb, "01_gras")
    save_normal(blur(tuft * 0.6 + mid * 0.4, 1.2), "01_gras", 0.35)


def mat_fels():
    f1, f2 = tiling_worley(SIZE, 22, 7)
    seam = np.clip(1 - (f2 - f1) * 60, 0, 1)        # feine Fugen zwischen Platten
    seam = blur(seam, 2.2)
    plate = norm(blur(f1, 14.0))                    # sehr sanfte Woelbung
    grain = fbm(SIZE, 18, 19, 3)

    t = np.clip(plate * 0.30 + grain * 0.70, 0, 1)
    rgb = lerp_col((134, 136, 160), (163, 164, 186), t)        # graublau / lila
    rgb = rgb * (1 - 0.09 * seam[:, :, None])
    save_albedo(rgb, "02_fels")
    save_normal(blur(-seam * 0.7 + plate * 0.3 + grain * 0.25, 1.6), "02_fels", 0.7)


def mat_bergwiese():
    """Fels mit Moos - fuer die Hoehenblendung Wiese -> Hochgebirge."""
    f1, f2 = tiling_worley(SIZE, 22, 7)
    seam = blur(np.clip(1 - (f2 - f1) * 60, 0, 1), 2.2)
    plate = norm(blur(f1, 14.0))
    grain = fbm(SIZE, 18, 19, 3)
    patch = fbm(SIZE, 4, 47, 4)                     # grosse, weiche Moosflecken
    moss = np.clip((patch - 0.46) * 3.4, 0, 1)
    moss = np.clip(moss * (0.82 + 0.35 * seam), 0, 1)   # Fugen nur leicht bevorzugt
    moss = blur(moss, 2.0)

    t = np.clip(plate * 0.30 + grain * 0.70, 0, 1)
    rgb = lerp_col((134, 136, 160), (163, 164, 186), t)
    rgb = rgb * (1 - 0.09 * seam[:, :, None])
    rgb = rgb * (1 - moss[:, :, None]) + \
          lerp_col((112, 158, 66), (142, 186, 80), t) * moss[:, :, None]
    save_albedo(rgb, "03_bergwiese")
    save_normal(blur(-seam * 0.8 + plate * 0.5 + grain * 0.15, 1.5), "03_bergwiese", 0.9)


def mat_vulkan():
    f1, f2 = tiling_worley(SIZE, 9, 5)
    crack = np.clip(1 - (f2 - f1) * 150, 0, 1)      # wenige, sehr duenne Risse
    crack = np.clip(blur(crack, 1.0), 0, 1)
    fade = np.clip((fbm(SIZE, 5, 91, 3) - 0.34) * 2.4, 0, 1)   # Risse brechen ab
    crack = crack * fade
    glow = np.clip(blur(crack, 11.0) * 2.4, 0, 1)   # weicher Schein drumherum
    plate = norm(blur(f1, 14.0))
    grain = fbm(SIZE, 20, 13, 3)

    t = np.clip(plate * 0.30 + grain * 0.70, 0, 1)
    rgb = lerp_col((70, 54, 66), (94, 74, 88), t)              # dunkles Pflaumengrau
    rgb = rgb + np.array([132, 44, 6])[None, None, :] * (glow * 0.30)[:, :, None]
    rgb = rgb * (1 - 0.85 * crack[:, :, None]) + \
          np.array([255, 150, 52])[None, None, :] * (0.85 * crack)[:, :, None]
    save_albedo(rgb, "04_vulkan")
    save_normal(blur(-crack * 0.9 + plate * 0.3 + grain * 0.25, 1.5), "04_vulkan", 0.7)


def mat_wasser():
    r1 = tiling_noise(SIZE, 6, 3, 0.40)
    r2 = tiling_noise(SIZE, 14, 71, 0.40)
    ripple = norm(r1 * 0.78 + r2 * 0.22)

    rgb = lerp_col((30, 118, 134), (62, 165, 173), ripple)     # ruhiges Teal
    save_albedo(rgb, "05_wasser")
    save_normal(blur(ripple, 2.0), "05_wasser", 1.4)


# ---------------------------------------------------------------- Preview
def preview():
    names = ["01_gras", "02_fels", "03_bergwiese", "04_vulkan", "05_wasser"]
    labels = ["Gras (begehbar)", "Fels (begehbar)", "Bergwiese (Blend)",
              "Vulkanboden (begehbar)", "Wasser"]
    cell, pad, lab = 384, 16, 34
    cols, rows = 3, 2
    W = cols * cell + (cols + 1) * pad
    H = rows * (cell + lab) + (rows + 1) * pad
    canvas = Image.new("RGB", (W, H), (28, 30, 36))
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)

    for i, (n, l) in enumerate(zip(names, labels)):
        src = Image.open(f"{OUT}/{n}_albedo.png").resize((cell // 3, cell // 3), Image.LANCZOS)
        tile = Image.new("RGB", (cell, cell))
        for ty in range(3):
            for tx in range(3):
                tile.paste(src, (tx * cell // 3, ty * cell // 3))
        cx = pad + (i % cols) * (cell + pad)
        cy = pad + (i // cols) * (cell + lab + pad)
        canvas.paste(tile, (cx, cy))
        d.text((cx, cy + cell + 7), l, font=font, fill=(225, 228, 235))

    d.text((pad + 2 * (cell + pad), pad + cell + lab + pad + 60),
           "jeweils 3x3 gekachelt\nkeine sichtbaren Kanten",
           font=font, fill=(150, 155, 168))
    canvas.save(f"{OUT}/00_vorschau_3x3.png")


# ---------------------------------------------------------------- Verifikation
def verify():
    print("Kantenpruefung (mittlere Abweichung gegenueberliegender Kanten, 0-255):")
    for f in sorted(os.listdir(OUT)):
        if not f.endswith(".png") or f.startswith("00_"):
            continue
        a = np.asarray(Image.open(f"{OUT}/{f}").convert("RGB"), float)
        # Naht entsteht zwischen letzter und erster Zeile/Spalte der Nachbarkachel
        dv = np.abs(a[-1, :, :] - a[0, :, :]).mean()
        dh = np.abs(a[:, -1, :] - a[:, 0, :]).mean()
        # Referenz: normale Nachbarzeilen-Differenz im Bildinneren
        ref = np.abs(a[1:, :, :] - a[:-1, :, :]).mean()
        print(f"  {f:28s} Naht v={dv:5.2f} h={dh:5.2f}   innen={ref:5.2f}")


if __name__ == "__main__":
    mat_gras()
    mat_fels()
    mat_bergwiese()
    mat_vulkan()
    mat_wasser()
    preview()
    verify()
    print("\nfertig ->", OUT)
