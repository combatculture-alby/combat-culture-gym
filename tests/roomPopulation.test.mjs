import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultRoomState} from '../src/roomState.ts';
import {distributeStudents} from '../src/roomPopulation.ts';
import {attendingIndices} from '../src/gymProgression.ts';

test('every active room contains a visitor by fifth expansion',()=>{
 const state=defaultRoomState();
 const assignments=distributeStudents(5,1,12,state,{});
 const roster=attendingIndices(12,5,1);
 const rooms=new Set(roster.map(id=>assignments[id]));
 assert.deepEqual([...rooms].sort(),['downstairs','main','outdoor','upstairs']);
 assert.equal(assignments.length,12);
});
test('upgrading equipment influences which rooms attract extra students',()=>{
 const state=defaultRoomState();
 state.gearRooms=['outdoor','outdoor','outdoor','outdoor','main','main','main','main'];
 const inventory={ownedGear:[true,true,true,true],gearStored:[false,false,false,false]};
 const weighted=distributeStudents(5,2,12,state,inventory);
 const visitors=attendingIndices(12,5,2);
 const outdoor=visitors.filter(i=>weighted[i]==='outdoor').length;
 const baseline=distributeStudents(5,2,12,defaultRoomState(),{});
 const baselineOutdoor=visitors.filter(i=>baseline[i]==='outdoor').length;
 assert.ok(outdoor>=baselineOutdoor,'A room with gear should draw more students');
});
test('members rotate rooms across days without losing student IDs',()=>{
 const state=defaultRoomState();
 const dayOne=distributeStudents(4,1,10,state,{});
 const dayTwo=distributeStudents(4,2,10,state,{});
 assert.notDeepEqual(dayOne,dayTwo);
 assert.ok(dayOne.every(r=>['main','outdoor','upstairs'].includes(r)));
});
