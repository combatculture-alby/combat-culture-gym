import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockedRooms,roomTransition,normalizeRoom} from '../src/gymRooms.ts';
import {normalizeRoomState,itemRoom,defaultRoomState,moveItemToRoom} from '../src/roomState.ts';
import {canFitRoomItem,canWalkInRoom,firstOpenSpot,footprint,itemLabel} from '../src/roomItems.ts';

test('only the new rooms unlock at levels three, four and five',()=>{
  assert.deepEqual([1,2,3,4,5].map(level=>unlockedRooms(level).map(r=>r.id)),[
    ['main'],['main'],['main','outdoor'],
    ['main','outdoor','upstairs'],
    ['main','outdoor','upstairs','downstairs']
  ]);
  assert.equal(roomTransition('main','outdoor',2),null);
  assert.ok(roomTransition('main','outdoor',3));
  assert.equal(roomTransition('main','upstairs',3),null);
  assert.ok(roomTransition('upstairs','main',4));
  assert.ok(roomTransition('downstairs','main',5));
});

test('legacy saves migrate without losing ownership and disallow locked room IDs',()=>{
  const state=normalizeRoomState({furnitureRooms:['outdoor','upstairs'],gearRooms:['downstairs'],
    playerPositions:{outdoor:{x:200,y:150}},assignmentLevel:3,
    trashByRoom:{outdoor:[2,1,2,900,-1]},moppedByRoom:{outdoor:[0]}},3);
  assert.deepEqual(state.furnitureRooms,['outdoor','main']);
  assert.deepEqual(state.gearRooms,['main']);
  assert.deepEqual(state.trashByRoom.outdoor,[2,1]);
  assert.deepEqual(state.moppedByRoom.outdoor,[0]);
  assert.equal(state.assignmentLevel,3);
  assert.equal(itemRoom(state.furnitureRooms,10,3),'main');
  assert.equal(normalizeRoom('downstairs',4),'main');
  assert.equal(defaultRoomState().currentRoom,'main');
  const moved=moveItemToRoom(state,'furniture',0,'downstairs',3);
  assert.equal(moved,state,'Cannot move into locked rooms');
  const allowed=moveItemToRoom(state,'gear',0,'outdoor',3);
  assert.equal(allowed.gearRooms[0],'outdoor');
  assert.equal(state.gearRooms[0],'main','Moving should not mutate old room state');
});

test('equipment is physically bounded and cannot overlap or block the door',()=>{
  const bag={kind:'gear',index:0,x:180,y:149,rotation:0};
  assert.equal(canFitRoomItem(bag,[],'outdoor'),true);
  assert.equal(canFitRoomItem({...bag,x:19},[],'outdoor'),false);
  assert.equal(canFitRoomItem({...bag,y:215},[],'outdoor'),false);
  assert.equal(canFitRoomItem({...bag,x:422,y:153},[],'outdoor'),false,
    'Outside entry remains passable');
  assert.equal(canFitRoomItem({...bag,x:192},[{...bag,index:1}],'outdoor'),false);
  assert.equal(canFitRoomItem({...bag,x:260},[bag],'outdoor'),true);
  assert.equal(canWalkInRoom({x:180,y:149},[bag]),false);
  assert.equal(canWalkInRoom({x:270,y:149},[bag]),true);
  assert.ok(firstOpenSpot(bag,[bag],'outdoor'));
});

test('rotated furniture uses its true design type, not array slot',()=>{
  const bench={kind:'furniture',index:9,typeId:1,x:170,y:150,rotation:0};
  assert.deepEqual(footprint(bench),{rx:22,ry:9});
  assert.deepEqual(footprint({...bench,rotation:1}),{rx:9,ry:22});
  assert.equal(itemLabel(bench),'Bench');
  const cooler={kind:'furniture',index:2,typeId:3,x:245,y:160,rotation:0};
  assert.deepEqual(footprint(cooler),{rx:11,ry:11});
  assert.equal(itemLabel(cooler),'Water Cooler');
});
