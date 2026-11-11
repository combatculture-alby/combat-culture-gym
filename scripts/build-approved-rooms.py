from PIL import Image, ImageDraw
from pathlib import Path
base=Path(__file__).resolve().parents[1]
board=Image.open(base/'art-source/approved-originals/Combat Culture Gym Asset Board(3).png').convert('RGBA')
tiles=Image.open(base/'art-source/approved-originals/Combat Culture Gym Tileset Showcase(1).png').convert('RGBA')
def tile(dst,src,rect,area,tw,th):
    patch=src.crop(rect).resize((tw,th),Image.Resampling.NEAREST)
    for y in range(area[1],area[3],th):
        for x in range(area[0],area[2],tw):
            w=min(tw,area[2]-x)
            h=min(th,area[3]-y)
            dst.paste(patch.crop((0,0,w,h)),(x,y))
for level in (1,2):
    im=Image.new('RGBA',(480,330),(32,39,41,255))
    d=ImageDraw.Draw(im)
    tile(im,board,(25,131,119,220),(0,23,480,79),48,48)
    tile(im,board,(24,233,119,294),(0,79,480,225),48,48)
    d.rectangle((0,75,479,79),fill=(39,43,45))
    d.line((0,78,479,78),fill=(166,142,109),width=2)
    if level==1:
        garage=board.crop((321,128,520,296)).resize((175,92),Image.Resampling.NEAREST)
        im.paste(garage,(49,14),garage)
        door=board.crop((529,140,598,295)).resize((37,91),Image.Resampling.NEAREST)
        im.paste(door,(263,18),door)
    else:
        for x in (45,240):
            d.rectangle((x-4,29,x+89,74),fill=(28,37,42),outline=(164,144,113),width=3)
            d.rectangle((x,33,x+85,69),fill=(69,110,119))
            d.rectangle((x+40,33,x+43,69),fill=(191,190,164))
            d.line((x,51,x+85,51),fill=(185,186,169),width=2)
        d.rectangle((138,26,219,65),fill=(35,39,41),outline=(181,146,101),width=3)
    bounds=(70,103,278,190) if level==1 else (55,93,294,200)
    x0,y0,x1,y1=bounds
    d.rectangle((x0-4,y0-4,x1+4,y1+4),fill=(29,32,37),outline=(152,149,140),width=3)
    tile(im,tiles,(257,97,432,274),(x0,y0,x1,y1),32,26)
    d=ImageDraw.Draw(im)
    d.rectangle((x0,y0,x1,y1),outline=(109,106,108),width=2)
    light=board.crop((1091,142,1255,205)).resize((102,25),Image.Resampling.NEAREST)
    im.paste(light,(109 if level==1 else 181,9),light)
    # Keep the full gameplay stage covered by the same room materials.
    # The floor ends at 225, while the near wall/foundation sits below it.
    d.rectangle((0,225,479,329),fill=(65,72,69) if level==1 else (72,85,78))
    for x in range(0,480,48):
        d.line((x,231,x,328),fill=(49,57,55),width=1)
    for y in range(240,330,24):
        d.line((0,y,479,y),fill=(55,62,59),width=1)
    d.rectangle((0,224,479,230),fill=(38,49,49))
    d.line((0,225,479,225),fill=(145,142,123),width=2)
    # Edge-mounted columns and the room perimeter establish one coherent bay.
    d.rectangle((0,23,13,225),fill=(48,58,56))
    d.rectangle((466,23,479,225),fill=(48,58,56))
    d.rectangle((13,75,466,79),fill=(38,48,47))
    d.line((13,78,466,78),fill=(168,150,119),width=2)
    target=base/f'src/assets/approved-room-level{level}.png'
    im.save(target,optimize=True)
    print(target)

# Generated textures are tracked in the release branch.
