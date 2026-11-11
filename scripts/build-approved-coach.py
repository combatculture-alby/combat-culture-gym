#!/usr/bin/env python3
"""Build a 12x3 transparent coach animation atlas from approved coach art.

Frame order: down, right, left, up, three frames each.
Rows: idle, walk, run. Output frames 48x64.
"""
from collections import deque
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
src=root/'art-source/approved-originals/Player Coach Approved.png'
dst=root/'src/assets/coach-approved.png'
im=Image.open(src).convert('RGBA')
assert im.size==(1536,1024),im.size
atlas=Image.new('RGBA',(576,192))
# Source art has down, LEFT, RIGHT, up. Runtime requires down, RIGHT, LEFT, up.
centers=[
 [[365,444],[750,832],[560,639],[939,1016]],
 [[345,405,466],[729,793,852],[538,604,661],[922,987,1047]],
 [[345,405,466],[729,793,852],[538,604,661],[922,987,1047]],
]
vertical=[(182,279),(304,410),(434,542)]
for row in range(3):
    y0,y1=vertical[row]
    for direction in range(4):
        xs=centers[row][direction]
        for frame in range(3):
            cx=xs[min(frame,len(xs)-1)]
            # Crop the character only, excluding row separators.
            crop=im.crop((cx-35,y0,cx+35,y1)).convert('RGBA')
            p=crop.load();w,h=crop.size;seen=bytearray(w*h);q=deque()
            for x in range(w):q.extend(((x,0),(x,h-1)))
            for y in range(h):q.extend(((0,y),(w-1,y)))
            while q:
                x,y=q.popleft()
                if not(0<=x<w and 0<=y<h):continue
                idx=y*w+x
                if seen[idx]:continue
                seen[idx]=1
                r,g,b,a=p[x,y]
                # Only flood-fill the connected dark blue sheet background.
                if r>45 or g>50 or b>66 or r>g+18:continue
                p[x,y]=(0,0,0,0)
                q.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
            bbox=crop.getbbox()
            if not bbox:raise ValueError((row,direction,frame))
            crop=crop.crop(bbox)
            crop.thumbnail((42,58),Image.Resampling.NEAREST)
            x=direction*3*48+frame*48+(48-crop.width)//2
            y=row*64+64-crop.height
            atlas.alpha_composite(crop,(x,y))
atlas.save(dst,optimize=True)
print('Generated',dst,atlas.size)

# GitHub Actions commits the generated atlas directly to the release branch.
