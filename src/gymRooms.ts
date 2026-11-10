/** Room topology is independent of the arcade and class schedule.
 * The main floor stops expanding at level two. Additional rooms are
 * unlocked, not enlarged, as the gym grows.
 */
export const ROOM_IDS=['main','outdoor','upstairs','downstairs'] as const;
export type RoomId=typeof ROOM_IDS[number];
export type RoomPoint={x:number;y:number};
export type RoomPlacement={room:RoomId;x:number;y:number};
export type RoomDefinition={
  id:RoomId;name:string;unlocksAt:number;
  entry:RoomPoint;bounds:{left:number;right:number;top:number;bottom:number};
  exits:Partial<Record<RoomId,RoomPoint>>;
};
export const ROOMS:readonly RoomDefinition[]=[
  {id:'main',name:'Main Gym',unlocksAt:1,
   entry:{x:170,y:150},bounds:{left:44,right:450,top:84,bottom:213},
   exits:{outdoor:{x:44,y:153},upstairs:{x:348,y:106},downstairs:{x:348,y:205}}},
  {id:'outdoor',name:'Outdoor Training',unlocksAt:3,
   entry:{x:422,y:153},bounds:{left:26,right:453,top:78,bottom:222},
   exits:{main:{x:443,y:153}}},
  {id:'upstairs',name:'Upstairs',unlocksAt:4,
   entry:{x:48,y:200},bounds:{left:26,right:453,top:78,bottom:222},
   exits:{main:{x:42,y:207}}},
  {id:'downstairs',name:'Downstairs',unlocksAt:5,
   entry:{x:48,y:106},bounds:{left:26,right:453,top:78,bottom:222},
   exits:{main:{x:42,y:106}}},
];
export function unlockedRooms(level:number):RoomDefinition[]{
  const safe=Math.max(1,Math.min(5,Math.floor(Number(level)||1)));
  return ROOMS.filter(room=>room.unlocksAt<=safe);
}
export function roomUnlocked(room:RoomId,level:number):boolean {
  return unlockedRooms(level).some(item=>item.id===room);
}
export function normalizeRoom(value:unknown,level:number):RoomId {
  return ROOM_IDS.includes(value as RoomId)&&roomUnlocked(value as RoomId,level)
    ?value as RoomId:'main';
}
/** Deterministic student home rooms, independent of the visible scene.
 * Rendering should instantiate only students whose assigned room is active.
 */
export function studentRoom(index:number,level:number):RoomId {
  const rooms=unlockedRooms(level);
  return rooms[Math.abs(Math.floor(index))%rooms.length].id;
}
export function roomTransition(from:RoomId,to:RoomId,level:number):
  {exit:RoomPoint;entry:RoomPoint}|null {
  if(!roomUnlocked(from,level)||!roomUnlocked(to,level))return null;
  const source=ROOMS.find(room=>room.id===from)!;
  const target=ROOMS.find(room=>room.id===to)!;
  const exit=source.exits[to];
  return exit?{exit,entry:target.entry}:null;
}
