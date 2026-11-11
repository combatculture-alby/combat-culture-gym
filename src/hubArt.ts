import Phaser from 'phaser';

/** Source art: Combat Culture Gym Level 1 garage asset set, branded
 * Combat Culture gym banner, and roll-up garage door reference sheet.
 * Frames are cropped from an indexed transparent atlas, not placeholder
 * rectangles. All dimensions are pixel-aligned for nearest-neighbor display. */
export const HUB_ART_KEY='combat-culture-hub-art';

export const HUB_ART_FRAMES={
  'heavy-bag':{x:0,y:0,w:38,h:59},
  'speed-bag':{x:41,y:0,w:29,h:56},
  'kettlebell-rack':{x:73,y:0,w:45,h:35},
  'supply-shelf':{x:119,y:0,w:41,h:56},
  'water-cooler':{x:0,y:61,w:24,h:47},
  'weight-bench':{x:27,y:61,w:46,h:47},
  'training-mat':{x:76,y:61,w:84,h:47},
  // Opaque center section of the original mat; tiles without trapezoid edges.
  'training-mat-tile':{x:101,y:75,w:32,h:21},
  'gym-banner':{x:0,y:121,w:89,h:34},
  'garage-door':{x:92,y:119,w:66,h:36}
} as const;

export const HUB_LEVEL2_ART_KEY='combat-culture-level-2-art';
export const HUB_LEVEL2_FRAMES={
  'heavy-bag-l2':{x:0,y:0,w:38,h:77},
  'speed-bag-l2':{x:42,y:0,w:37,h:65},
  'thai-pads':{x:84,y:0,w:70,h:69},
  'jump-rope':{x:0,y:79,w:50,h:43},
  'water-cooler-l2':{x:54,y:79,w:32,h:55},
  'bench-l2':{x:90,y:79,w:63,h:45},
  'agility-ladder':{x:0,y:125,w:54,h:33},
  'medicine-ball':{x:58,y:125,w:43,h:33},
  'boxing-poster':{x:106,y:126,w:47,h:32}
} as const;

export const HUB_SERVICE_ART_KEY='combat-culture-service-art';
export const HUB_SERVICE_FRAMES={
  'desk-phone':{x:0,y:0,w:32,h:28},
  'mop-bucket':{x:36,y:0,w:44,h:57}
} as const;
export type HubArtName=keyof typeof HUB_ART_FRAMES|
  keyof typeof HUB_LEVEL2_FRAMES|keyof typeof HUB_SERVICE_FRAMES;

export const APPROVED_GARAGE_PROPS=['heavy-bag','kettlebells','jump-rope','weight-bench','water-cooler','supply-shelf','desk-phone','mop','trash-can','reception-desk','dumbbell-rack','storage-closet','fan','gym-mats','bulletin-board','toolbox','towels','cardboard-boxes','foam-roller','cleaner','dustpan','paper-roll','clock','bands'] as const;
export const garagePropKey=(name:string)=>'approved-garage-'+name;
const garagePropUrls=import.meta.glob('./../art-source/extracted/level1/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>;

export const APPROVED_LEVEL2_PROPS=['squat-rack','weight-plates','flat-bench','dumbbell-rack','heavy-bag','speed-bag','double-end-bag','thai-pads','focus-mitts','wall-target','boxing-gloves','plyo-box','battle-ropes','jump-rope','agility-ladder','medicine-ball','water-cooler','mop-bucket','trash-can','towel-rack','storage-closet','supply-shelf','muay-thai-poster','boxing-poster','wai-kru-poster','mma-poster'] as const;
export const level2PropKey=(name:string)=>'approved-level2-'+name;
const level2PropUrls=import.meta.glob('./../art-source/extracted/level2/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>;

export const approvedRoomKey=(level:number)=>'approved-room-level'+level;
export function preloadHubArt(scene:Phaser.Scene):void {
  for(const level of [1,2]){
    const key=approvedRoomKey(level);
    if(!scene.textures.exists(key))
      scene.load.image(key,new URL('./assets/approved-room-level'+level+'.png',import.meta.url).href);
  }
  for(const name of APPROVED_LEVEL2_PROPS){
    const url=Object.entries(level2PropUrls).find(([path])=>path.endsWith('/'+name+'.png'))?.[1];
    const key=level2PropKey(name);
    if(url&&!scene.textures.exists(key))scene.load.image(key,url);
  }
  for(const name of APPROVED_GARAGE_PROPS){
    const key=garagePropKey(name);
    const url=Object.entries(garagePropUrls).find(([path])=>path.endsWith('/'+name+'.png'))?.[1];
    if(url&&!scene.textures.exists(key))scene.load.image(key,url);
  }
  // new URL is resolved and fingerprinted by Vite, including in Pages previews.
  if(!scene.textures.exists(HUB_ART_KEY))
    scene.load.image(HUB_ART_KEY,new URL('./assets/hub-atlas.png',import.meta.url).href);
  if(!scene.textures.exists(HUB_LEVEL2_ART_KEY))
    scene.load.image(HUB_LEVEL2_ART_KEY,new URL('./assets/hub-level2-atlas.png',import.meta.url).href);
  if(!scene.textures.exists(HUB_SERVICE_ART_KEY))
    scene.load.image(HUB_SERVICE_ART_KEY,new URL('./assets/hub-services.png',import.meta.url).href);
}
export function registerHubArt(scene:Phaser.Scene):void {
  if(!scene.textures.exists(HUB_ART_KEY))return;
  const texture=scene.textures.get(HUB_ART_KEY);
  for(const [name,area] of Object.entries(HUB_ART_FRAMES)){
    if(!texture.has(name))
      texture.add(name,0,area.x,area.y,area.w,area.h);
  }
  if(scene.textures.exists(HUB_LEVEL2_ART_KEY)){
    const level2=scene.textures.get(HUB_LEVEL2_ART_KEY);
    for(const [name,area] of Object.entries(HUB_LEVEL2_FRAMES)){
      if(!level2.has(name))
        level2.add(name,0,area.x,area.y,area.w,area.h);
    }
  }
  if(scene.textures.exists(HUB_SERVICE_ART_KEY)){
    const services=scene.textures.get(HUB_SERVICE_ART_KEY);
    for(const [name,area] of Object.entries(HUB_SERVICE_FRAMES)){
      if(!services.has(name))
        services.add(name,0,area.x,area.y,area.w,area.h);
    }
  }
}
export function hasHubArt(scene:Phaser.Scene):boolean {
  return scene.textures.exists(HUB_ART_KEY)&&
    scene.textures.get(HUB_ART_KEY).has('heavy-bag');
}
export function hasLevel2HubArt(scene:Phaser.Scene):boolean {
  return scene.textures.exists(HUB_LEVEL2_ART_KEY)&&
    scene.textures.get(HUB_LEVEL2_ART_KEY).has('heavy-bag-l2');
}
export function hasServiceHubArt(scene:Phaser.Scene):boolean {
  return scene.textures.exists(HUB_SERVICE_ART_KEY)&&
    scene.textures.get(HUB_SERVICE_ART_KEY).has('desk-phone');
}
/** Use the source mat's opaque interlocking tiles for a rectangular floor.
 * The perspective-shaped full mat sprite cannot be stretched into a playable
 * rectangle: it leaves diagonal black edges and makes characters look airborne. */
export function placeHubTrainingMat(
  scene:Phaser.Scene,left:number,top:number,right:number,bottom:number,
  depth=0.3
):Phaser.GameObjects.TileSprite {
  const width=Math.max(1,Math.round(right-left)-4);
  const height=Math.max(1,Math.round(bottom-top)-4);
  const tile=scene.add.tileSprite(Math.round(left)+2,Math.round(top)+2,
    width,height,HUB_ART_KEY,'training-mat-tile')
    .setOrigin(0,0).setDepth(depth);
  // TileSprite may render via an internal generated canvas texture. Retain
  // the exact authored source-frame identity for runtime QA and inspection.
  tile.setData('approvedSourceArt','training-mat-tile');
  return tile;
}

export function placeHubArt(
  scene:Phaser.Scene,name:HubArtName,x:number,y:number,width:number,height:number,
  depth:number,originX=0.5,originY=0.5
):Phaser.GameObjects.Image {
  const level1Aliases:Record<string,string>={
    'heavy-bag':'heavy-bag','kettlebell-rack':'kettlebells',
    'supply-shelf':'supply-shelf','water-cooler':'water-cooler',
    'weight-bench':'weight-bench','desk-phone':'desk-phone',
    'mop-bucket':'mop'
  };
  const level2Aliases:Record<string,string>={
    'heavy-bag-l2':'heavy-bag','speed-bag-l2':'speed-bag',
    'thai-pads':'thai-pads','jump-rope':'jump-rope',
    'water-cooler-l2':'water-cooler','bench-l2':'flat-bench',
    'agility-ladder':'agility-ladder','medicine-ball':'medicine-ball',
    'boxing-poster':'boxing-poster'
  };
  const preferred=Object.prototype.hasOwnProperty.call(level2Aliases,name)
    ?level2PropKey(level2Aliases[name]):level1Aliases[name]
    ?garagePropKey(level1Aliases[name]):null;
  if(preferred&&scene.textures.exists(preferred))
    return scene.add.image(Math.round(x),Math.round(y),preferred)
      .setOrigin(originX,originY).setDisplaySize(Math.round(width),Math.round(height))
      .setDepth(depth);
  const atlas=Object.prototype.hasOwnProperty.call(HUB_SERVICE_FRAMES,name)
    ?HUB_SERVICE_ART_KEY:
    Object.prototype.hasOwnProperty.call(HUB_LEVEL2_FRAMES,name)
    ?HUB_LEVEL2_ART_KEY:HUB_ART_KEY;
  return scene.add.image(Math.round(x),Math.round(y),atlas,name)
    .setOrigin(originX,originY).setDisplaySize(Math.round(width),Math.round(height))
    .setDepth(depth);
}
