#!/usr/bin/env python3
"""Generate the social-share preview image assets/og-image.jpg (1200x630)
from the menu background + the game title in gold. Run once (or after art changes)."""
import os
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "assets", "scenes", "menu.jpg")
OUT = os.path.join(ROOT, "assets", "og-image.jpg")
W, H = 1200, 630

GOLD = (212, 168, 83)
PARCH = (240, 230, 200)

# a serif TTF that includes Cyrillic (macOS system fonts)
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
]
def font(sz):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

base = Image.open(SRC).convert("RGB")
base = ImageOps.fit(base, (W, H), Image.LANCZOS)

# darken with a vertical gradient (stronger at the bottom for text legibility)
overlay = Image.new("L", (1, H), 0)
for y in range(H):
    t = y / H
    overlay.putpixel((0, y), int(90 + 150 * (t ** 1.5)))  # 90 -> 240
overlay = overlay.resize((W, H))
dark = Image.new("RGB", (W, H), (8, 5, 2))
base = Image.composite(dark, base, overlay)

# subtle gold vignette frame
draw = ImageDraw.Draw(base, "RGBA")
draw.rectangle([14, 14, W - 15, H - 15], outline=(212, 168, 83, 180), width=3)

def centered(draw, text, fnt, y, fill, shadow=(0, 0, 0)):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    tw = bbox[2] - bbox[0]
    x = (W - tw) // 2
    draw.text((x + 3, y + 3), text, font=fnt, fill=shadow)
    draw.text((x, y), text, font=fnt, fill=fill)

title1 = font(96)
title2 = font(96)
sub = font(40)
small = font(30)

centered(draw, "Сказание", title1, 250, GOLD)
centered(draw, "о Старом Склепе", title2, 350, GOLD)
centered(draw, "Настольное D&D-приключение для двоих", sub, 478, PARCH)
centered(draw, "ИИ-мастер · кубик · озвучка · музыка", small, 540, (200, 180, 130))

base.save(OUT, "JPEG", quality=88)
print("saved", OUT, os.path.getsize(OUT) // 1024, "KB")
