import {attendingIndices} from './gymProgression.ts';
import {roomUnlocked,studentRoom,unlockedRooms,type RoomId} from './gymRooms.ts';
import type {RoomState} from './roomState.ts';

export type RoomPopulationInventory={
  ownedGear?:boolean[];gearStored?:boolean[];
  furniture?:Array<{stored:boolean;kind:number}>;
};
/** Reassign attendance at opening every new day. At least one attending
 * student visits each unlocked area; equipment and usable furnishings draw
 * larger groups without requiring simulation of invisible character sprites.
 */
export function distributeStudents(
  level:number,day:number,enrolled:number,roomState:RoomState,inventory:RoomPopulationInventory
):RoomId[]{
  const rooms=unlockedRooms(level).map(room=>room.id);
  const total=Math.max(4,Math.floor(Number(enrolled)||4));
  const assigned=Array.from({length:total},(_,i)=>studentRoom(i,level));
  const attendance=attendingIndices(total,level,day);
  const weights=Object.fromEntries(rooms.map(id=>[id,id==='main'?2:1])) as Record<RoomId,number>;
  (inventory.ownedGear||[]).forEach((owned,i)=>{
    if(!owned||inventory.gearStored?.[i])return;
    const room=roomState.gearRooms?.[i]||'main';
    if(roomUnlocked(room,level))weights[room]+=3;
  });
  (inventory.furniture||[]).forEach((item,i)=>{
    if(item.stored)return;
    const room=roomState.furnitureRooms?.[i]||'main';
    if(roomUnlocked(room,level))weights[room]+=item.kind===1||item.kind===3||item.kind===4?2:1;
  });
  const counts=Object.fromEntries(rooms.map(id=>[id,0])) as Record<RoomId,number>;
  // Rotate who visits each room to avoid the same permanent student schedule.
  const rotate=(day-1)%rooms.length;
  attendance.forEach((id,i)=>{
    let room:RoomId;
    if(i<rooms.length)room=rooms[(i+rotate)%rooms.length];
    else{
      const best=[...rooms].sort((a,b)=>
        (counts[a]+1)/weights[a]-(counts[b]+1)/weights[b]||
        ((rooms.indexOf(a)+rotate)%rooms.length)-((rooms.indexOf(b)+rotate)%rooms.length));
      room=best[0];
    }
    assigned[id]=room;counts[room]++;
  });
  return assigned;
}
