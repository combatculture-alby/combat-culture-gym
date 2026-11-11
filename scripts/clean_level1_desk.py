from PIL import Image, ImageDraw
import numpy as np
from pathlib import Path

path = Path("src/assets/approved-level1-folding-desk.png")
im = Image.open(path).convert("RGBA")
original_size = im.size
im = im.resize((320, 187), Image.Resampling.NEAREST)
a = np.array(im)
mask = Image.new("L", im.size, 0)
d = ImageDraw.Draw(mask)
# Mask only the open spaces behind chair slats and inside folding leg braces.
d.polygon([(127,115),(193,115),(193,126),(127,126)], fill=255)
d.polygon([(128,146),(192,146),(192,165),(128,165)], fill=255)
d.polygon([(23,94),(50,94),(23,127)], fill=255)
d.polygon([(267,94),(293,94),(293,127)], fill=255)
region = np.asarray(mask)>0
rgb = a[:,:,:3].astype(np.int16)
bright = (rgb.min(axis=2)>168) & ((rgb.max(axis=2)-rgb.min(axis=2))<42)
selected = region & bright & (a[:,:,3]>0)
a[selected,3] = 0
# Soften only immediate light matte fringe around removed pixels.
from PIL import ImageFilter
edge = Image.fromarray((selected.astype("uint8")*255),"L").filter(ImageFilter.MaxFilter(3))
fringe = region & (np.asarray(edge)>0) & ~selected & (rgb.min(axis=2)>125) & ((rgb.max(axis=2)-rgb.min(axis=2))<50)
a[fringe,3] = (a[fringe,3].astype(float)*0.35).astype("uint8")
result = Image.fromarray(a,"RGBA").resize(original_size,Image.Resampling.NEAREST)
result.save(path,optimize=True)
print(f"Cleaned {int(selected.sum())} white matte pixels; preserved original {original_size} sprite size")
