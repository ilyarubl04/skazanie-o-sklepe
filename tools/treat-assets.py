#!/usr/bin/env python3
"""
Unify the game's clashing art (oil portraits + photo scenes + B&W engravings)
into pages of ONE candlelit tome by baking a single warm sepia/duotone grade.

Two strengths:
  * STRONG  — scene backgrounds (assets/scenes/*.jpg) and enemy art
              (assets/enemies/*.png). Heavy duotone: this is what erases the
              "photo vs engraving" gap and makes everything match the oils.
  * LIGHT   — hero portraits (assets/portraits/*.png). Only a subtle warm tone
              + consistent contrast so the six paintings share a palette WITHOUT
              flattening them (they are the strongest asset — keep their depth).

Idempotent: ALWAYS reads the untreated source from assets/_raw/ and writes the
treated result to the live path. Re-run any time after changing source art
(just refresh assets/_raw/ first for any file you swapped).

    python3 tools/treat-assets.py            # treat everything
    python3 tools/treat-assets.py portraits  # only portraits  (or: scenes / enemies)

Requires: Pillow (PIL).
"""
import os
import sys

from PIL import Image, ImageOps, ImageEnhance, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "assets", "_raw")
ASSETS = os.path.join(ROOT, "assets")

# ---- tome palette ---------------------------------------------------------
SHADOW = (15, 10, 4)      # #0f0a04  warm near-black
MID    = (122, 78, 30)    # warm umber midtone (keeps the duotone from going flat)
HILITE = (201, 169, 110)  # #c9a96e  parchment highlight


def _lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def _duotone_lut():
    """A 256-entry RGB gradient SHADOW -> MID -> HILITE used to colour-map luminance.
    Three stops give a rich sepia instead of a harsh two-colour poster look."""
    lut = []
    for i in range(256):
        t = i / 255.0
        if t < 0.5:
            c = _lerp(SHADOW, MID, t / 0.5)
        else:
            c = _lerp(MID, HILITE, (t - 0.5) / 0.5)
        lut.append(c)
    return lut


_LUT = _duotone_lut()


def _apply_duotone(rgb):
    """Map an RGB image through the tome gradient by its luminance."""
    gray = ImageOps.grayscale(rgb)               # perceptual luminance
    duo = Image.new("RGB", rgb.size)
    duo.putdata([_LUT[p] for p in gray.getdata()])
    return duo


def _paper_grain(size, strength):
    """A faint warm paper-grain overlay (deterministic so re-runs are identical)."""
    import random
    random.seed(1497)                            # fixed seed -> idempotent output
    w, h = size
    # build grain small then upscale: cheaper and gives a softer 'fibre' than per-pixel
    sw, sh = max(1, w // 2), max(1, h // 2)
    g = Image.new("L", (sw, sh))
    base = 128
    g.putdata([base + random.randint(-strength, strength) for _ in range(sw * sh)])
    g = g.resize((w, h), Image.BILINEAR)
    return g


def treat(src_path, out_path, *, strength):
    """strength: 'strong' (scenes/enemies) or 'light' (portraits)."""
    im = Image.open(src_path)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    alpha = im.convert("RGBA").split()[-1] if has_alpha else None
    rgb = im.convert("RGB")

    if strength == "strong":
        # gentle contrast first so the duotone ramp has punchy shadows/highlights
        rgb = ImageEnhance.Contrast(rgb).enhance(1.10)
        duo = _apply_duotone(rgb)
        # 82% duotone, keep 18% of the original so some tonal life survives
        out = Image.blend(rgb, duo, 0.82)
        out = ImageEnhance.Color(out).enhance(0.92)      # pull stray saturation toward sepia
        out = ImageEnhance.Brightness(out).enhance(0.98)
        grain_strength, grain_opacity = 26, 0.06
    else:  # light — portraits: protect the oils
        rgb = ImageEnhance.Contrast(rgb).enhance(1.05)
        duo = _apply_duotone(rgb)
        # only 22% toward the tome palette: shared warmth, NOT a repaint
        out = Image.blend(rgb, duo, 0.22)
        # a whisper of an umber wash unifies the six different canvases
        wash = Image.new("RGB", out.size, MID)
        out = Image.blend(out, wash, 0.07)
        out = ImageEnhance.Color(out).enhance(1.02)      # keep them alive
        grain_strength, grain_opacity = 14, 0.035

    # faint paper grain: nudges every surface toward the same parchment fibre
    grain = _paper_grain(out.size, grain_strength)
    grain_rgb = Image.merge("RGB", (grain, grain, grain))
    out = Image.blend(out, grain_rgb, grain_opacity)

    ext = os.path.splitext(out_path)[1].lower()
    if ext in (".jpg", ".jpeg"):
        out.save(out_path, "JPEG", quality=88, optimize=True)
    else:
        if alpha is not None:
            out = out.convert("RGBA")
            out.putalpha(alpha)
        out.save(out_path, "PNG", optimize=True)
    return out.size


JOBS = {
    "scenes":    dict(folder="scenes",    exts=(".jpg", ".jpeg"), strength="strong"),
    "enemies":   dict(folder="enemies",   exts=(".png",),         strength="strong"),
    "portraits": dict(folder="portraits", exts=(".png",),         strength="light"),
}


def run(which):
    job = JOBS[which]
    raw_dir = RAW
    live_dir = os.path.join(ASSETS, job["folder"])
    n = 0
    for name in sorted(os.listdir(live_dir)):
        ext = os.path.splitext(name)[1].lower()
        if ext not in job["exts"]:
            continue
        src = os.path.join(raw_dir, name)
        if not os.path.exists(src):
            print("  ! no _raw source for %s/%s — skipped" % (job["folder"], name))
            continue
        out = os.path.join(live_dir, name)
        w, h = treat(src, out, strength=job["strength"])
        kb = os.path.getsize(out) // 1024
        print("  %-9s %-16s %4dx%-4d  %s  %dKB" % (which, name, w, h, job["strength"], kb))
        n += 1
    return n


def main():
    targets = sys.argv[1:] or list(JOBS.keys())
    bad = [t for t in targets if t not in JOBS]
    if bad:
        sys.exit("unknown target(s): %s  (choose from %s)" % (bad, list(JOBS.keys())))
    total = 0
    for t in targets:
        print("== %s ==" % t)
        total += run(t)
    print("done — %d image(s) treated." % total)


if __name__ == "__main__":
    main()
