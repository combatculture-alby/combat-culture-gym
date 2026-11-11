from PIL import Image, ImageDraw
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BOARD=Image.open(ROOT/'art-source/approved-originals/Combat Culture Gym Asset Board(3).png').convert('RGBA')
TILES=Image.open(ROOT/'art-source/approved-originals/Combat Culture Gym Tileset Showcase(1).png').convert('RGBA')
SIZE=(480,330)

def tiled(image, source, crop, bounds, size):
    patch=source.crop(crop).resize(size,Image.Resampling.NEAREST)
    x0,y0,x1,y1=bounds
    for y in range(y0,y1,size[1]):
        for x in range(x0,x1,size[0]):
            w=min(size[0],x1-x)
            h=min(size[1],y1-y)
            image.paste(patch.crop((0,0,w,h)),(x,y))

def fixture(image,source,rect,bounds):
    x0,y0,x1,y1=bounds
    art=source.crop(rect).resize((x1-x0,y1-y0),Image.Resampling.NEAREST)
    image.paste(art,(x0,y0),art)

for level in (1,2):
    image=Image.new('RGBA',SIZE,(41,45,44,255))
    draw=ImageDraw.Draw(image)
    # All background features stay in the wall band. Previous source crops
    # were scaled into the walking area and covered the training mats.
    tiled(image,BOARD,(25,131,119,220),(14,14,466,79),(40,32))
    tiled(image,BOARD,(24,233,119,294),(14,80,466,225),(40,32))
    draw.rectangle((0,12,13,225),fill=(48,56,55))
    draw.rectangle((466,12,479,225),fill=(48,56,55))
    draw.rectangle((13,76,466,81),fill=(42,49,49))
    draw.line((13,78,466,78),fill=(169,150,119),width=2)
    if level==1:
        # Garage shutter belongs on the wall, not on the floor.
        fixture(image,BOARD,(321,128,520,296),(65,14,255,76))
        fixture(image,BOARD,(529,140,598,295),(294,16,333,77))
    else:
        for x in (42,238):
            draw.rectangle((x,21,x+101,73),fill=(29,38,42),outline=(164,144,113),width=3)
            draw.rectangle((x+4,25,x+97,69),fill=(71,109,116))
            draw.rectangle((x+49,25,x+52,69),fill=(190,186,163))
            draw.line((x+4,47,x+97,47),fill=(190,186,163),width=2)
    # Training zones match gymProgression.ts; Level 2 has a clear corridor.
    zones=[(59,99,315,202)] if level==1 else [(55,93,294,140),(55,153,294,200)]
    for x0,y0,x1,y1 in zones:
        draw.rectangle((x0-3,y0-3,x1+3,y1+3),fill=(31,35,38),outline=(146,144,135),width=2)
        # Approved seamless dark-gray puzzle-mat layout from the tileset showcase.
        # The old crop was the labeled Top Edge example, incorrectly repeated
        # across the entire floor, producing repeated edge teeth everywhere.
        if level==1:
            fixture(image,TILES,(32,772,569,1004),(x0,y0,x1,y1))
        else:
            tiled(image,TILES,(30,98,215,273),(x0,y0,x1,y1),(24,24))
        draw=ImageDraw.Draw(image)
        draw.rectangle((x0,y0,x1,y1),outline=(109,106,108),width=2)
    # The service lane on the right remains visually clear for the board,
    # reception and interactions. Never place a background prop there.
    draw.rectangle((0,225,479,329),fill=(66,74,70) if level==1 else (74,85,79))
    for x in range(0,480,40):
        draw.line((x,230,x,329),fill=(52,61,58),width=1)
    for y in range(240,330,24):
        draw.line((0,y,479,y),fill=(53,61,58),width=1)
    draw.rectangle((0,224,479,230),fill=(39,49,48))
    draw.line((0,225,479,225),fill=(150,142,120),width=2)
    path=ROOT/f'src/assets/approved-room-level{level}.png'
    image.save(path,optimize=True)
    print(path)
