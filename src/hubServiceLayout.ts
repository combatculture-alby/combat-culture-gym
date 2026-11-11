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
export function serviceFixtureLayout(requestedLevel:number):Record<HubService,ServiceFixture>{
  const level=normalizeGymLevel(requestedLevel);
  const {desk,deskApproach,room}=gymServiceLayout(level);
  const mat=trainingBounds(level);
  const coolerX=mat.right+21;
  // The stock closet must sit above the desk, not in its footprint.
  // Leave enough clearance for the tallest 55px cabinet and its hit target.
  const stockY=level===1?120:Math.min(145,desk.y-30);
  // Wall cabinet is to the right of reception, not across the desk or board.
  const stockX=room.right-20;
  // The mop lives below the cooler, away from the reception desk.
  const mopX=coolerX+26;
  return {
    phone:{
      x:desk.x+Math.min(15,Math.floor(desk.w*.27)),y:desk.y+3,
      hitWidth:30,hitHeight:24,
      approach:{...deskApproach}
    },
    water:{
      x:coolerX,y:169,
      hitWidth:32,hitHeight:57,
      approach:{x:coolerX+27,y:174}
    },
    stock:{
      x:stockX,y:stockY,
      hitWidth:35,hitHeight:53,
      approach:{x:stockX-25,y:stockY+9}
    },
    mop:{
      x:mopX,y:205,
      hitWidth:31,hitHeight:38,
      approach:{x:mopX+14,y:193}
    }
  };
}
