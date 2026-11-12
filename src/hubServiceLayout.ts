import {garageFixture,type GaragePositions} from './garageLayout.ts';
import {gymServiceLayout,trainingBounds,normalizeGymLevel} from './gymProgression.ts';

export type HubService='phone'|'water'|'stock'|'mop';
export type ServiceFixture={
  x:number;y:number;hitWidth:number;hitHeight:number;
  approach:{x:number;y:number};
};

/** The service props are physical objects in the room, not menu labels.
 * Reception moves with the expanding desk; utilities stay against the
 * service corridor walls so they never cover the training mat.
 */
export function serviceFixtureLayout(requestedLevel:number,positions?:GaragePositions):Record<HubService,ServiceFixture>{
  const level=normalizeGymLevel(requestedLevel);
  const {desk,deskApproach,room}=gymServiceLayout(level,positions);
  const mat=trainingBounds(level);
  const coolerX=mat.right+21;
  const stockY=Math.min(145,desk.y-30);
  const stockX=room.right-20;
  const mopX=coolerX+38;
  const garageService=(type:'water'|'stock'|'mop'):ServiceFixture=>{
    const {art,approach}=garageFixture(type,positions);
    return {x:art.x+art.w/2,y:art.y+art.h/2,hitWidth:art.w,hitHeight:art.h,approach};
  };
  return {
    phone:{
      x:desk.x+Math.min(15,Math.floor(desk.w*.27)),y:desk.y+3,
      hitWidth:30,hitHeight:24,
      approach:{...deskApproach}
    },
    water:level===1?garageService('water'):{
      x:coolerX,y:169,
      hitWidth:32,hitHeight:57,
      approach:{x:coolerX+20,y:174}
    },
    stock:level===1?garageService('stock'):{
      x:stockX,y:stockY,
      hitWidth:35,hitHeight:53,
      approach:{x:stockX-25,y:stockY+9}
    },
    mop:level===1?garageService('mop'):{
      x:mopX,y:169,
      hitWidth:31,hitHeight:38,
      approach:{x:mopX+14,y:191}
    }
  };
}
