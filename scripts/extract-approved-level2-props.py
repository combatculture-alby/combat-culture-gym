#!/usr/bin/env python3
"""Extract approved Level 2 prop sheet into individual transparent sprites.

Coordinates are native 1774x887 pixel source positions. Only background
connected to crop edges is removed, preserving enclosed black details.
"""
from collections import deque
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=root/'art-source/approved-originals/Combat Culture Gym Asset Sheet(3).png'
dest=root/'art-source/extracted/level2'
dest.mkdir(parents=True,exist_ok=True)
rects={
 'squat-rack':(38,151,341,356),
 'weight-plates':(342,161,445,350),
 'flat-bench':(442,276,570,357),
 'dumbbell-rack':(572,201,752,357),
 'heavy-bag':(816,149,918,355),
 'speed-bag':(927,156,1072,298),
 'double-end-bag':(1090,152,1163,354),
 'thai-pads':(1190,198,1328,319),
 'focus-mitts':(1340,209,1458,312),
 'wall-target':(1470,209,1583,296),
 'boxing-gloves':(1585,202,1690,318),
 'plyo-box':(39,444,174,581),
 'battle-ropes':(176,443,349,582),
 'jump-rope':(341,436,455,585),
 'agility-ladder':(453,429,594,583),
 'medicine-ball':(585,455,698,563),
 'water-cooler':(785,427,875,584),
 'mop-bucket':(896,425,1017,589),
 'trash-can':(1027,455,1123,582),
 'towel-rack':(1141,423,1320,585),
 'storage-closet':(1331,421,1479,584),
 'supply-shelf':(1516,418,1702,584),
 'muay-thai-poster':(62,664,216,832),
 'boxing-poster':(245,665,397,833),
 'wai-kru-poster':(436,665,580,833),
 'mma-poster':(608,665,768,833),
}
im=Image.open(source).convert('RGBA')
assert im.size==(1774,887),im.size
for name,rect in rects.items():
    crop=im.crop(rect);px=crop.load();w,h=crop.size
    seen=bytearray(w*h);q=deque()
    for x in range(w):q.append((x,0));q.append((x,h-1))
    for y in range(h):q.append((0,y));q.append((w-1,y))
    while q:
        x,y=q.popleft()
        if not(0<=x<w and 0<=y<h):continue
        idx=y*w+x
        if seen[idx]:continue
        seen[idx]=1
        r,g,b,a=px[x,y]
        # Remove only near-black sheet background connected to edges.
        if max(r,g,b)>39 or max(r,g,b)-min(r,g,b)>28:continue
        px[x,y]=(0,0,0,0)
        q.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
    bbox=crop.getbbox()
    if not bbox:raise ValueError(name)
    crop.crop(bbox).save(dest/(name+'.png'),optimize=True)
print('Extracted',len(rects),'approved Level 2 sprites')
