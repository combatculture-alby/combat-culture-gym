#!/usr/bin/env python3
"""Generate a REVIEW-ONLY 12x3 Frank atlas from the approved concept board.

Usage: python -m pip install Pillow
       python scripts/extract-frank-atlas.py

The generated file is NOT copied into src/assets automatically.
"""
from pathlib import Path
from collections import deque
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art-source/approved-originals/Frank_ Combat Culture Gym Sprite Sheet.png'
OUTPUT = ROOT / 'art-source/generated-preview/frank-atlas.png'
CENTERS_X = ((441, 507, 573), (665, 731, 795),
             (873, 939, 1005), (1075, 1140, 1201))
CENTERS_Y = (218, 346, 472)
FRAME_W, FRAME_H = 48, 64

def background(rgb):
    r, g, b = rgb
    return b > r * 1.3 and b > g * 1.04 and r < 52 and g < 62

def remove_navy_background(crop):
    pixels = crop.load()
    w, h = crop.size
    queue = deque()
    seen = set()
    for x in range(w):
        for y in (0, h - 1):
            if background(pixels[x, y][:3]):
                queue.append((x, y))
                seen.add((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if background(pixels[x, y][:3]):
                queue.append((x, y))
                seen.add((x, y))
    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                if background(pixels[nx, ny][:3]):
                    seen.add((nx, ny))
                    queue.append((nx, ny))
    return crop

def main():
    source = Image.open(SOURCE).convert('RGB')
    if source.size != (1254, 1254):
        raise ValueError(f'Unexpected source dimensions: {source.size}')
    atlas = Image.new('RGBA', (12 * FRAME_W, 3 * FRAME_H))
    for row, cy in enumerate(CENTERS_Y):
        for direction, centers in enumerate(CENTERS_X):
            for frame, cx in enumerate(centers):
                crop = source.crop((cx-28, cy-51, cx+28, cy+45)).convert('RGBA')
                crop = remove_navy_background(crop)
                bbox = crop.getbbox()
                if bbox is None:
                    raise ValueError(f'Empty frame: {row}/{direction}/{frame}')
                crop = crop.crop(bbox)
                crop.thumbnail((46, 62), Image.Resampling.NEAREST)
                x = (direction * 3 + frame) * FRAME_W + (FRAME_W-crop.width)//2
                y = row * FRAME_H + FRAME_H-crop.height
                atlas.alpha_composite(crop, (x, y))
    # Remove the white separator inadvertently captured at the boundary of\n    # the right-facing animation group. Restrict cleanup to this exact\n    # narrow column range so the character's white clothing is preserved.\n    pixels = atlas.load()\n    for y in range(atlas.height):\n        for x in (423, 424, 425):\n            r, g, b, a = pixels[x, y]\n            if a and min(r, g, b) > 225:\n                pixels[x, y] = (0, 0, 0, 0)\n    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT)
    print(f'Wrote review-only atlas: {OUTPUT}')
    print('Inspect edge artifacts and facing directions before runtime integration.')

if __name__ == '__main__':
    main()
