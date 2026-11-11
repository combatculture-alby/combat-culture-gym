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
  'gym-banner':{x:0,y:121,w:89,h:34},
  'garage-door':{x:92,y:119,w:66,h:36}
} as const;

export type HubArtName=keyof typeof HUB_ART_FRAMES;

export function preloadHubArt(scene:Phaser.Scene):void {
  // new URL is resolved and fingerprinted by Vite, including in Pages previews.
  if(!scene.textures.exists(HUB_ART_KEY))
    scene.load.image(HUB_ART_KEY,new URL('./assets/hub-atlas.png',import.meta.url).href);
}
export function registerHubArt(scene:Phaser.Scene):void {
  if(!scene.textures.exists(HUB_ART_KEY))return;
  const texture=scene.textures.get(HUB_ART_KEY);
  for(const [name,area] of Object.entries(HUB_ART_FRAMES)){
    if(!texture.has(name))
      texture.add(name,0,area.x,area.y,area.w,area.h);
  }
}
export function hasHubArt(scene:Phaser.Scene):boolean {
  return scene.textures.exists(HUB_ART_KEY)&&
    scene.textures.get(HUB_ART_KEY).has('heavy-bag');
}
export function placeHubArt(
  scene:Phaser.Scene,name:HubArtName,x:number,y:number,width:number,height:number,
  depth:number,originX=0.5,originY=0.5
):Phaser.GameObjects.Image {
  return scene.add.image(Math.round(x),Math.round(y),HUB_ART_KEY,name)
    .setOrigin(originX,originY).setDisplaySize(Math.round(width),Math.round(height))
    .setDepth(depth);
}
