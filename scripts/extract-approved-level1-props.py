#!/usr/bin/env python3
"""Extract a complete transparent Level 1 prop library from approved source art.

Source: approved 1536x1024 white-background garage prop board.
Crops use source pixel coordinates, not scaled thumbnail positions.
"""
from pathlib import Path
from PIL import Image, ImageFilter
from collections import deque

root=Path(__file__).resolve().parents[1]
source=root/"art-source/approved-originals/Level 1 Garage Gym Asset Sheet(2).png"
target=root/"art-source/extracted/level1"
target.mkdir(parents=True,exist_ok=True)
# Exact pixel crop coordinates on the approved 1536x1024 source board.\n# The old normalized boxes cut through objects, causing visibly incomplete sprites.
# All objects are isolated from their neighbors. Only remove near-pure white
# connected to the crop boundary; the previous permissive 229/22 threshold
# erased light-colored parts of furniture and made fixtures look fragmented.
regions={
"reception-desk":(20,20,575,330),
"supply-shelf":(594,12,858,333),
"storage-closet":(874,18,1096,332),
"water-cooler":(1124,34,1244,327),
"fan":(1256,47,1396,325),
"trash-can":(1395,145,1533,324),
"heavy-bag":(7,322,228,654),
"cardboard-boxes":(339,394,585,600),
"kettlebells":(638,486,881,596),
"bands":(937,366,1092,596),
"jump-rope":(1115,378,1226,591),
"foam-roller":(1245,370,1500,594),
"dumbbell-rack":(45,656,337,839),
"weight-bench":(348,682,652,825),
"mop":(705,609,819,822),
"dustpan":(824,662,951,821),
"cleaner":(973,643,1072,805),
"paper-roll":(1093,656,1184,809),
"towels":(1189,708,1315,797),
"gym-mats":(8,849,760,1008),
"bulletin-board":(768,845,1014,1006),
"toolbox":(1009,888,1136,994),
"desk-phone":(391,39,482,193),
"clock":(1390,915,1533,1006),
}
im=Image.open(source).convert("RGBA")
assert im.size==(1536,1024),im.size
for name,(l,t,r,b) in regions.items():
    crop=im.crop((l,t,r,b))
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
        if min(red,green,blue)<250 or max(red,green,blue)-min(red,green,blue)>8:continue
        p[x,y]=(0,0,0,0)
        q.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
    # Remove the near-white matte halo left by the original white backdrop.
    # Restrict cleanup to pixels immediately beside transparency so white
    # lettering, highlights and interior details remain untouched.
    # Repeat over two edge pixels to eliminate the visible white fringe.
    # Only neutral, bright pixels on the *outer* silhouette are affected.
    # Interior white highlights and the dark pixel-art outline stay intact.
    for pass_no in range(2):
        alpha=crop.getchannel("A")
        inner=alpha.filter(ImageFilter.MinFilter(3)).load()
        px=crop.load()
        for yy in range(h):
            for xx in range(w):
                rr,gg,bb,aa=px[xx,yy]
                if aa==0 or inner[xx,yy]==255:continue
                neutral=max(rr,gg,bb)-min(rr,gg,bb)<22
                if neutral and min(rr,gg,bb)>=232:
                    px[xx,yy]=(0,0,0,0)
                elif neutral and min(rr,gg,bb)>=205:
                    px[xx,yy]=(rr,gg,bb,min(aa,70))
    bbox=crop.getbbox()
    if not bbox:raise ValueError("Empty crop "+name)
    crop.crop(bbox).save(target/(name+".png"),optimize=True)
print("Extracted",len(regions),"approved Level 1 props")

# Asset extraction is run by GitHub Actions and committed as binary sprites.
