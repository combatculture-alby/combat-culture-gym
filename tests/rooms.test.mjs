import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const room=readFileSync(new URL('../src/gymRooms.ts',import.meta.url),'utf8');
const state=readFileSync(new URL('../src/roomState.ts',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const scene=readFileSync(new URL('../src/gymRoomScene.ts',import.meta.url),'utf8');
const progression=readFileSync(new URL('../src/gymProgression.ts',import.meta.url),'utf8');

test('five-level progression unlocks outdoor, upstairs and downstairs',()=>{
  assert.match(room,/id:'outdoor'.*unlocksAt:3/);
  assert.match(room,/id:'upstairs'.*unlocksAt:4/);
  assert.match(room,/id:'downstairs'.*unlocksAt:5/);
  assert.match(room,/function unlockedRooms/);
});
test('room state retains legacy main-floor placements',()=>{
  assert.match(state,/function normalizeRoomState/);
  assert.match(state,/furnitureRooms:roomArray/);
  assert.match(state,/gearRooms:roomArray/);
  assert.match(state,/trashByRoom:normalizeRoomIndices/);
  assert.match(state,/moppedByRoom:normalizeRoomIndices/);
  assert.match(state,/currentRoom:'main'/);
});
test('secondary room scene has walk controls and exit navigation',()=>{
  assert.match(scene,/class GymRoomScene/);
  assert.match(scene,/private goTo\(destination:RoomId\)/);
  assert.match(scene,/this\.scene\.start\('Gym'\)/);
  assert.match(scene,/W,A,S,D,UP,DOWN,LEFT,RIGHT,E/);
  assert.match(main,/GymRoomScene,SeminarScene/);
  assert.match(main,/VISIT OTHER ROOMS/);
});
test('main mat no longer expands past level two',()=>{
  const lines=progression.split('\n').filter(line=>line.includes('left:55,right:294,top:93,bottom:200'));
  assert.equal(lines.length,4);
});

test('main room filters out equipment assigned to other rooms',()=>{
  assert.match(main,/itemRoom\(this\.saveData\.roomState\?\.furnitureRooms,i,this\.gymLevel\(\)\)!=='main'/);
  assert.match(main,/itemRoom\(this\.saveData\.roomState\?\.gearRooms,i,this\.gymLevel\(\)\)!=='main'/);
});
test('secondary room supports storing and placing owned inventory',()=>{
  assert.match(scene,/private drawRoomInventory/);
  assert.match(scene,/private saveRoomItem/);
  assert.match(scene,/state\.furnitureRooms\[item\.index\]=this\.current/);
  assert.match(scene,/state\.gearRooms\[item\.index\]=this\.current/);
});
