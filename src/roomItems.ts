import {ROOMS,type RoomId,type RoomPoint} from './gymRooms';

export type ItemKind='gear'|'furniture'|'decor';
export type RoomFixture={kind:ItemKind;index:number;typeId?:number;x:number;y:number;rotation:number};
export type Bounds={rx:number;ry:number};
export const GEAR_BOUNDS:readonly Bounds[]=[
  {rx:9,ry:12},{rx:13,ry:10},{rx:8,ry:11},{rx:14,ry:8},
  {rx:14,ry:11},{rx:14,ry:10},{rx:13,ry:13},{rx:16,ry:12}
];
export const GEAR_LABELS=['Heavy Bag','Thai Pads','Speed Bag','Jump Rope','Weight Bench','Kettlebells','Treadmill','Assault Bike'] as const;
export const FURNITURE_LABELS=['Floor Lamp','Bench','Trophy Case','Water Cooler','Punching Dummy'] as const;
export const DECOR_LABELS=['Gym Banner','Training Poster','Indoor Plant'] as const;
export const ROOM_FLOOR={left:36,right:444,top:101,bottom:211} as const;
export function roomFloor(room:RoomId){
  return room==='main'?ROOM_FLOOR:ROOMS.find(r=>r.id===room)!.bounds;
}
const blocked:{[key in RoomId]:RoomPoint[]}={
  main:[],
  outdoor:[{x:368,y:168}],
  upstairs:[{x:120,y:170}],
  downstairs:[{x:111,y:171}],
};
export function footprint(item:RoomFixture):Bounds {
  if(item.kind==='gear')return GEAR_BOUNDS[item.index]||{rx:14,ry:12};
  if(item.kind==='decor')return (item.typeId??item.index)===2?{rx:11,ry:12}:{rx:25,ry:12};
  const side=item.rotation%2===1,style=item.typeId??item.index;
  if(style===1)return side?{rx:9,ry:22}:{rx:22,ry:9};
  if(style===2)return side?{rx:11,ry:18}:{rx:18,ry:11};
  if(style===3)return {rx:11,ry:11};
  if(style===4)return {rx:10,ry:13};
  return {rx:9,ry:9};
}
export function itemLabel(item:RoomFixture):string {
  if(item.kind==='gear')return GEAR_LABELS[item.index]||'Equipment';
  if(item.kind==='furniture')return FURNITURE_LABELS[item.typeId??item.index]||'Furniture';
  return DECOR_LABELS[item.typeId??item.index]||'Decoration';
}
export function overlap(a:RoomFixture,b:RoomFixture,margin=3):boolean {
  const x=footprint(a),y=footprint(b);
  return Math.abs(a.x-b.x)<x.rx+y.rx+margin&&
    Math.abs(a.y-b.y)<x.ry+y.ry+margin;
}
export function canFitRoomItem(item:RoomFixture,others:RoomFixture[],room:RoomId):boolean {
  const size=footprint(item),floor=roomFloor(room);
  if(item.x-size.rx<floor.left+5||item.x+size.rx>floor.right-5||
    item.y-size.ry<floor.top+5||item.y+size.ry>floor.bottom-5)return false;
  if(others.some(other=>other.kind!==item.kind||other.index!==item.index?
    overlap(item,other):false))return false;
  return !blocked[room].some(p=>
    Math.abs(item.x-p.x)<size.rx+21&&Math.abs(item.y-p.y)<size.ry+18);
}
export function firstOpenSpot(item:RoomFixture,others:RoomFixture[],room:RoomId):RoomPoint|null {
  const floor=roomFloor(room);
  for(let y=floor.top+19;y<=floor.bottom-19;y+=17){
    for(let x=floor.left+22;x<=floor.right-22;x+=20){
      const trial={...item,x,y};
      if(canFitRoomItem(trial,others,room))return {x,y};
    }
  }
  return null;
}
export function canWalkInRoom(point:RoomPoint,items:RoomFixture[],room:RoomId='outdoor'):boolean {
  const floor=roomFloor(room);
  if(point.x<floor.left+7||point.x>floor.right-7||
    point.y<floor.top+4||point.y>floor.bottom-4)return false;
  return items.every(item=>{
    const b=footprint(item);
    return Math.abs(point.x-item.x)>=b.rx+8||Math.abs(point.y-item.y)>=b.ry+5;
  });
}
