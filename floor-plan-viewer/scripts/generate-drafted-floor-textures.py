"""Generate seamless Drafted-style floor PNGs for the 2D plan viewer."""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "textures"
OUT.mkdir(parents=True, exist_ok=True)

random.seed(92653)


def save(name: str, img: Image.Image) -> None:
    path = OUT / name
    img.save(path, format="PNG", optimize=True)
    print("wrote", path)


def wood_plank(size: int = 512) -> Image.Image:
    img = Image.new("RGB", (size, size), (232, 224, 213))
    draw = ImageDraw.Draw(img)
    plank_w = max(18, size // 9)
    for x in range(0, size, plank_w):
        tone = 228 + int(math.sin(x * 0.07) * 6)
        fill = (tone, tone - 10, tone - 22)
        draw.rectangle([x, 0, x + plank_w - 2, size], fill=fill)
        draw.line([(x + plank_w - 1, 0), (x + plank_w - 1, size)], fill=(180, 155, 120), width=1)
        for y in range(0, size, 4):
            shade = 150 + int(abs(math.sin(y * 0.05 + x * 0.02)) * 35)
            draw.line([(x + 2, y), (x + plank_w - 4, y + 1)], fill=(shade, shade - 18, shade - 40), width=1)
    return img.filter(ImageFilter.GaussianBlur(radius=0.35))


def kitchen_tile(size: int = 512) -> Image.Image:
    img = Image.new("RGB", (size, size), (245, 245, 240))
    draw = ImageDraw.Draw(img)
    tile = size // 8
    for y in range(0, size, tile):
        for x in range(0, size, tile):
            v = 4 if ((x // tile) + (y // tile)) % 2 == 0 else -3
            fill = (245 + v, 245 + v, 240 + v)
            draw.rectangle([x + 1, y + 1, x + tile - 2, y + tile - 2], fill=fill)
    for i in range(0, size + 1, tile):
        draw.line([(i, 0), (i, size)], fill=(220, 215, 205), width=1)
        draw.line([(0, i), (size, i)], fill=(220, 215, 205), width=1)
    return img


def marble_tile(size: int = 512) -> Image.Image:
    img = Image.new("RGB", (size, size), (238, 244, 248))
    draw = ImageDraw.Draw(img)
    tile = size // 6
    for y in range(0, size, tile):
        for x in range(0, size, tile):
            v = int(math.sin(x * 0.04) * math.cos(y * 0.05) * 5)
            fill = (236 + v, 242 + v, 247 + v)
            draw.rectangle([x + 1, y + 1, x + tile - 2, y + tile - 2], fill=fill)
    for i in range(0, size + 1, tile):
        draw.line([(i, 0), (i, size)], fill=(200, 215, 225), width=1)
        draw.line([(0, i), (size, i)], fill=(200, 215, 225), width=1)
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    for _ in range(10):
        sx, sy = random.randint(0, size), random.randint(0, size)
        points = [(sx, sy)]
        for _ in range(4):
            points.append((points[-1][0] + random.randint(-50, 50), points[-1][1] + random.randint(-50, 50)))
        odraw.line(points, fill=(180, 195, 210, 70), width=2)
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def concrete(size: int = 512) -> Image.Image:
    img = Image.new("RGB", (size, size), (200, 200, 200))
    draw = ImageDraw.Draw(img)
    for _ in range(size * size // 40):
        x, y = random.randint(0, size - 1), random.randint(0, size - 1)
        v = random.randint(-18, 18)
        c = 200 + v
        draw.point((x, y), fill=(c, c, c))
    return img.filter(ImageFilter.GaussianBlur(radius=0.8))


def outdoor_stone(size: int = 512) -> Image.Image:
    img = Image.new("RGB", (size, size), (224, 221, 213))
    draw = ImageDraw.Draw(img)
    for y in range(0, size, 64):
        for x in range(0, size, 64):
            v = random.randint(-8, 8)
            fill = (224 + v, 221 + v, 213 + v)
            draw.rectangle([x + 1, y + 1, x + 62, y + 62], fill=fill, outline=(200, 195, 185))
    return img.filter(ImageFilter.GaussianBlur(radius=0.4))


def carpet(size: int = 256) -> Image.Image:
    img = Image.new("RGB", (size, size), (232, 223, 210))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        for x in range(size):
            n = math.sin(x * 0.8) * math.cos(y * 0.6)
            t = 232 + int(n * 4)
            draw.point((x, y), fill=(t, t - 6, t - 14))
    return img


if __name__ == "__main__":
    save("drafted-wood-plank.png", wood_plank())
    save("drafted-kitchen-tile.png", kitchen_tile())
    save("drafted-marble-tile.png", marble_tile())
    save("drafted-concrete.png", concrete())
    save("drafted-outdoor-stone.png", outdoor_stone())
    save("drafted-carpet.png", carpet())
