#!/usr/bin/env python3
"""Apply the reviewed Holly divider cleanup to the tracked runtime atlas.

The exact twenty removed pixels were established by comparing the existing
GitHub atlas with the approved corrected atlas. Idempotent.
"""
from pathlib import Path
from PIL import Image

atlas = Path(__file__).resolve().parents[1] / "src/assets/holly.png"
coords = [
    (420,117),(421,117),(420,118),(421,118),(420,119),(421,119),
    (420,120),(420,121),(420,122),
    (423,180),(424,180),(423,181),(424,181),(423,182),(424,182),
    (423,183),(424,183),(423,184),(424,184),(424,185)
]
with Image.open(atlas) as source:
    image = source.convert("RGBA")
if image.size != (576,192):
    raise ValueError(f"Unexpected Holly atlas size: {image.size}")
for xy in coords:
    pixel = image.getpixel(xy)
    if pixel[3] and min(pixel[:3]) < 220:
        raise ValueError(f"Refusing to remove non-divider pixel at {xy}: {pixel}")
    image.putpixel(xy,(0,0,0,0))
image.save(atlas,optimize=True)
print(f"Corrected {len(coords)} divider pixels in {atlas}")

# The generated runtime atlas is committed by the asset workflow.
