"""Remove white matte artifacts from the extracted Level 1 mop sprite only."""
from pathlib import Path
from collections import deque
from PIL import Image
import numpy as np

path=Path("art-source/extracted/level1/mop.png")
image=Image.open(path).convert("RGBA")
a=np.array(image)
rgb=a[:,:,:3].astype(np.int16)
alpha=a[:,:,3]
h,w=alpha.shape
# Near-neutral, nearly white matte; leave colored mop strands and shaded handle alone.
white=(rgb.min(axis=2)>=205)&((rgb.max(axis=2)-rgb.min(axis=2))<=40)&(alpha>=160)
seen=np.zeros((h,w),dtype=bool)
removed=0
for y in range(h):
    for x in range(w):
        if not white[y,x] or seen[y,x]:continue
        q=deque([(y,x)]);seen[y,x]=True;component=[];touches_clear=False
        while q:
            cy,cx=q.popleft();component.append((cy,cx))
            for ny,nx in ((cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)):
                if not (0<=ny<h and 0<=nx<w):
                    touches_clear=True;continue
                if alpha[ny,nx]<64:touches_clear=True
                if white[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True;q.append((ny,nx))
        # Matte patches adjacent to clear background, including interior openings.
        # Ignore tiny white glints to avoid destroying genuine highlights.
        if touches_clear and len(component)>=3:
            for cy,cx in component:a[cy,cx,3]=0
            removed+=len(component)
Image.fromarray(a,"RGBA").save(path,optimize=True)
print(f"Level 1 mop: {w}x{h}; cleared {removed} white-matte pixels")
