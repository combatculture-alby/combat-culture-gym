import {normalizeRoom,roomUnlocked,type RoomId,type RoomPoint} from './gymRooms';

export type RoomItemLocation={room:RoomId;x:number;y:number};
export type RoomState={
  currentRoom:RoomId;
  playerPositions:Partial<Record<RoomId,RoomPoint>>;
  furnitureRooms:RoomId[];
  gearRooms:RoomId[];
  decorRooms:RoomId[];
  studentRooms:RoomId[];
  assignmentLevel?:number;
  trashByRoom:Partial<Record<RoomId,number[]>>;
  moppedByRoom:Partial<Record<RoomId,number[]>>;
};
export function defaultRoomState():RoomState {
  return {currentRoom:'main',playerPositions:{main:{x:170,y:150}},
    furnitureRooms:[],gearRooms:[],decorRooms:[],studentRooms:[],
    trashByRoom:{},moppedByRoom:{}};
}
/** Migration deliberately assigns legacy placements to the original main room.
 * No owned equipment or furniture is discarded when multi-room saves appear.
 */
export function normalizeRoomState(raw:unknown,level:number):RoomState {
  const data=raw&&typeof raw==='object'?raw as Partial<RoomState>:{};
  const fallback=defaultRoomState();
  const roomArray=(value:unknown):RoomId[]=>
    Array.isArray(value)?value.map(v=>normalizeRoom(v,level)):[];
  const positions:Partial<Record<RoomId,RoomPoint>>={};
  if(data.playerPositions&&typeof data.playerPositions==='object'){
    for(const [key,value] of Object.entries(data.playerPositions)){
      if(!roomUnlocked(key as RoomId,level)||!value)continue;
      const p=value as RoomPoint;
      if(Number.isFinite(p.x)&&Number.isFinite(p.y))
        positions[key as RoomId]={x:p.x,y:p.y};
    }
  }
  return {
    currentRoom:normalizeRoom(data.currentRoom,level),
    playerPositions:{...fallback.playerPositions,...positions},
    furnitureRooms:roomArray(data.furnitureRooms),
    gearRooms:roomArray(data.gearRooms),
    decorRooms:roomArray(data.decorRooms),
    studentRooms:roomArray(data.studentRooms),
    assignmentLevel:Number.isInteger(data.assignmentLevel)?data.assignmentLevel:undefined,
    trashByRoom:normalizeRoomIndices(data.trashByRoom,level),
    moppedByRoom:normalizeRoomIndices(data.moppedByRoom,level),
  };
}
function normalizeRoomIndices(value:unknown,level:number):Partial<Record<RoomId,number[]>>{
  const result:Partial<Record<RoomId,number[]>>={};
  if(!value||typeof value!=='object')return result;
  for(const [key,indices] of Object.entries(value)){
    if(!roomUnlocked(key as RoomId,level)||!Array.isArray(indices))continue;
    result[key as RoomId]=[...new Set(indices.filter(n=>Number.isInteger(n)&&n>=0&&n<100))];
  }
  return result;
}
export function itemRoom(rooms:RoomId[]|undefined,index:number,level:number):RoomId {
  return normalizeRoom(rooms?.[index],level);
}
export function moveItemToRoom(state:RoomState,kind:'furniture'|'gear'|'decor',
  index:number,room:RoomId,level:number):RoomState {
  if(!roomUnlocked(room,level))return state;
  const key=kind==='furniture'?'furnitureRooms':kind==='gear'?'gearRooms':'decorRooms';
  const next={...state,[key]:[...state[key]]};
  next[key][index]=room;
  return next;
}
