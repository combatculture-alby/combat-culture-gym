import Phaser from 'phaser';

/** Transparent character graphics cropped from the original Combat Culture
 * coach, Frank, Radish and Pudge pixel-art sheets. 4 rows x 7 poses. */
export const CHARACTER_ART_KEY='combat-culture-actor-art';
export const ACTOR_FRAME_SIZE={width:24,height:32} as const;
const ACTOR_COUNT=4;
const FRAME_COUNT=7;


/** Approved 48×64 transparent student sheets. Each is 12 columns × 3 rows:
 * poses idle, walk, run; 3 frames per direction (down, left, right, up).
 * Use the student ID rather than the old four-palette character rotation.
 */
export const STUDENT_ART_NAMES=['frank','radish','marshall','pudge','holly','gao'] as const;
export const STUDENT_FRAME_WIDTH=48;
export const STUDENT_FRAME_HEIGHT=64;
export function studentArtKey(index:number):string {
  return 'combat-culture-student-'+STUDENT_ART_NAMES[index];
}
export function studentArtAvailable(scene:Phaser.Scene,index:number):boolean {
  return index>=0&&index<STUDENT_ART_NAMES.length&&
    scene.textures.exists(studentArtKey(index))&&
    scene.textures.get(studentArtKey(index)).has('idle-down-0');
}
export function studentArtFrame(facing:'down'|'up'|'side',left:boolean,
  pose:string,phase:number):string {
  const dir=facing==='side'?(left?'left':'right'):facing;
  const row=pose==='walk'?'walk':'idle';
  return row+'-'+dir+'-'+Math.floor(phase%3);
}

export function preloadCharacterArt(scene:Phaser.Scene):void {
  if(!scene.textures.exists(CHARACTER_ART_KEY)){
    scene.load.image(CHARACTER_ART_KEY,
      new URL('./assets/hub-actors.png',import.meta.url).href);
  }
  const sources=[
    new URL('./assets/frank.png',import.meta.url).href,
    new URL('./assets/radish.png',import.meta.url).href,
    new URL('./assets/marshall.png',import.meta.url).href,
    new URL('./assets/pudge.png',import.meta.url).href,
    new URL('./assets/holly.png',import.meta.url).href,
    new URL('./assets/gao.png',import.meta.url).href
  ];
  sources.forEach((url,index)=>{
    if(!scene.textures.exists(studentArtKey(index)))
      scene.load.image(studentArtKey(index),url);
  });
}
export function registerCharacterArt(scene:Phaser.Scene):void {
  STUDENT_ART_NAMES.forEach((_,index)=>{
    const key=studentArtKey(index);
    if(!scene.textures.exists(key))return;
    const texture=scene.textures.get(key);
    // The original sheets place the right-facing profile before left-facing.
    // Labels must follow the visible nose direction, not the concept-board headings.
    const dirs=['down','right','left','up'] as const;
    const actions=['idle','walk','run'] as const;
    for(let row=0;row<3;row++)
      for(let direction=0;direction<4;direction++)
        for(let frame=0;frame<3;frame++){
          const name=actions[row]+'-'+dirs[direction]+'-'+frame;
          if(!texture.has(name))texture.add(name,0,
            (direction*3+frame)*STUDENT_FRAME_WIDTH,
            row*STUDENT_FRAME_HEIGHT,
            STUDENT_FRAME_WIDTH,STUDENT_FRAME_HEIGHT);
        }
  });
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
export function actorPoseFrame(
  facing:'down'|'up'|'side',pose:string,phase=0
):number {
  const standing=facing==='up'?1:facing==='side'?2:0;
  if(pose==='walk')return facing==='side'&&phase%2===1?3:standing;
  if(pose==='shadow'||pose==='bag'||pose==='lift'||pose==='stretch')return 4;
  if(pose==='rest')return 5;
  // A bottle comes up to the face and lowers; dialogue gestures alternate.
  if(pose==='drink')return phase===1||phase===2?6:standing;
  if(pose==='talk')return phase%2===1?4:standing;
  return standing;
}
