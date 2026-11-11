import Phaser from 'phaser';

/** Transparent character graphics cropped from the original Combat Culture
 * coach, Frank, Radish and Pudge pixel-art sheets. 4 rows x 7 poses. */
export const CHARACTER_ART_KEY='combat-culture-actor-art';
export const ACTOR_FRAME_SIZE={width:24,height:32} as const;
const ACTOR_COUNT=4;
const FRAME_COUNT=7;

export function preloadCharacterArt(scene:Phaser.Scene):void {
  if(!scene.textures.exists(CHARACTER_ART_KEY)){
    scene.load.image(CHARACTER_ART_KEY,
      new URL('./assets/hub-actors.png',import.meta.url).href);
  }
}
export function registerCharacterArt(scene:Phaser.Scene):void {
  if(!scene.textures.exists(CHARACTER_ART_KEY))return;
  const texture=scene.textures.get(CHARACTER_ART_KEY);
  for(let actor=0;actor<ACTOR_COUNT;actor++){
    for(let pose=0;pose<FRAME_COUNT;pose++){
      const name=actor+'-'+pose;
      if(!texture.has(name))texture.add(name,0,
        pose*ACTOR_FRAME_SIZE.width,actor*ACTOR_FRAME_SIZE.height,
        ACTOR_FRAME_SIZE.width,ACTOR_FRAME_SIZE.height);
    }
  }
}
export function actorArtAvailable(scene:Phaser.Scene):boolean {
  return scene.textures.exists(CHARACTER_ART_KEY)&&
    scene.textures.get(CHARACTER_ART_KEY).has('0-0');
}

/** Number 3 is Marshall, whose dedicated artwork is not available yet.
 * Keep his existing animated custom character rather than mislabel an asset. */
export function actorArtIndex(look:number):number|null {
  switch(look){
    case 0:return 0;
    case 1:return 1;
    case 2:return 2;
    case 4:return 3;
    default:return null;
  }
}
export function actorPoseFrame(facing:'down'|'up'|'side',pose:string):number {
  if(pose==='shadow'||pose==='bag'||pose==='lift')return 4;
  if(pose==='stretch')return 4;
  if(pose==='rest')return 5;
  if(pose==='drink')return 6;
  if(pose==='walk'&&facing==='side')return 3;
  return facing==='up'?1:facing==='side'?2:0;
}
