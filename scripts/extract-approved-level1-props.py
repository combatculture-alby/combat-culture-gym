#!/usr/bin/env python3
"""Extract a complete transparent Level 1 prop library from approved source art.

Source: approved 1536x1024 white-background garage prop board.
Crops use source pixel coordinates, not scaled thumbnail positions.
"""
from pathlib import Path
from PIL import Image
from collections import deque

root=Path(__file__).resolve().parents[1]
source=root/"art-source/approved-originals/Level 1 Garage Gym Asset Sheet(2).png"
target=root/"art-source/extracted/level1"
target.mkdir(parents=True,exist_ok=True)
# Normalized coordinates from the approved 1536x1024 source board.
# All objects are isolated from their neighbors; remove only connected
# white background, preserving internal white highlights and lettering.
regions={
"reception-desk":(0.005,0.055,0.298,0.270),
"supply-shelf":(0.300,0.040,0.478,0.300),
"storage-closet":(0.490,0.040,0.635,0.295),
"water-cooler":(0.635,0.055,0.752,0.293),
"fan":(0.755,0.080,0.875,0.280),
"trash-can":(0.875,0.080,0.992,0.290),
"heavy-bag":(0.008,0.315,0.175,0.565),
"cardboard-boxes":(0.210,0.315,0.395,0.540),
"kettlebells":(0.402,0.315,0.565,0.535),
"bands":(0.580,0.320,0.680,0.550),
"jump-rope":(0.690,0.320,0.785,0.540),
"foam-roller":(0.820,0.325,0.985,0.550),
"dumbbell-rack":(0.010,0.585,0.195,0.820),
"weight-bench":(0.210,0.620,0.410,0.795),
"mop":(0.460,0.590,0.535,0.815),
"dustpan":(0.540,0.610,0.650,0.810),
"cleaner":(0.665,0.600,0.750,0.800),
"paper-roll":(0.765,0.630,0.840,0.805),
"towels":(0.845,0.635,0.990,0.795),
"gym-mats":(0.005,0.835,0.440,0.995),
"bulletin-board":(0.460,0.835,0.630,0.995),
"toolbox":(0.650,0.845,0.790,0.990),
"desk-phone":(0.810,0.835,0.895,0.990),
"clock":(0.900,0.835,0.990,0.995),
}
im=Image.open(source).convert("RGBA")
assert im.size==(1536,1024),im.size
for name,(l,t,r,b) in regions.items():
    crop=im.crop((int(l*im.width),int(t*im.height),int(r*im.width),int(b*im.height)))
    p=crop.load();w,h=crop.size;seen=bytearray(w*h);q=deque()
    for x in range(w):q.extend(((x,0),(x,h-1)))
    for y in range(h):q.extend(((0,y),(w-1,y)))
    while q:
        x,y=q.popleft()
        if x<0 or y<0 or x>=w or y>=h:continue
        i=y*w+x
        if seen[i]:continue
        seen[i]=1
        red,green,blue,alpha=p[x,y]
        if min(red,green,blue)<229 or max(red,green,blue)-min(red,green,blue)>22:continue
        p[x,y]=(0,0,0,0)
        q.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
    bbox=crop.getbbox()
    if not bbox:raise ValueError("Empty crop "+name)
    crop.crop(bbox).save(target/(name+".png"),optimize=True)
print("Extracted",len(regions),"approved Level 1 props")

# Asset extraction is run by GitHub Actions and committed as binary sprites.
