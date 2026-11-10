import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGymPhase,normalizeArrivalCount,outstandingTrash,
  canTeachInPhase,canCloseInPhase,canAdvanceDay,
  ARRIVAL_INTERVAL_SECONDS,DEPARTURE_INTERVAL_SECONDS,overnightSupplies,canCompleteDay
} from '../src/dayCycle.ts';

test('new gym opens empty; old saves remain in an open gym',()=>{
  assert.equal(normalizeGymPhase(undefined,false),'opening');
  assert.equal(normalizeGymPhase(undefined,true),'open');
  for(const phase of ['opening','open','closing'])assert.equal(normalizeGymPhase(phase),phase);
  assert.equal(normalizeArrivalCount(4,'opening',8),0);
  assert.equal(normalizeArrivalCount(undefined,'open',8),8);
  assert.equal(normalizeArrivalCount(30,'open',8),8);
  assert.equal(normalizeArrivalCount(-2,'closing',8),0);
  assert.equal(normalizeArrivalCount(3,'closing',8),3);
});
test('cannot teach while preparing, close before class or skip over closing',()=>{
  assert.equal(canTeachInPhase('opening',0),false);
  assert.equal(canTeachInPhase('open',0),false);
  assert.equal(canTeachInPhase('open',2),true);
  assert.equal(canTeachInPhase('closing',2),false);
  assert.equal(canCloseInPhase('open',0),false);
  assert.equal(canCloseInPhase('open',1),true);
  assert.equal(canAdvanceDay('open',0),false);
  assert.equal(canAdvanceDay('closing',1),false);
  assert.equal(canAdvanceDay('closing',0),true);
  assert.ok(ARRIVAL_INTERVAL_SECONDS>0&&DEPARTURE_INTERVAL_SECONDS>0);
});
test('overnight uncollected litter persists without respawning cleaned piles',()=>{
  assert.equal(outstandingTrash(9,1),8);
  assert.equal(outstandingTrash(12,12),0);
  assert.equal(outstandingTrash(4,0),4);
  assert.equal(outstandingTrash(15,0),12);
  assert.equal(outstandingTrash(1,5),0);
});


test('corrupted or partial day-cycle saves cannot create phantom attendance or trash',()=>{
  for(const bad of [NaN,Infinity,-Infinity]){
    assert.equal(outstandingTrash(bad,0),0);
    assert.equal(outstandingTrash(4,bad),4);
  }
  assert.equal(outstandingTrash(-4,0),0);
  assert.equal(outstandingTrash(4,-10),4);
  assert.equal(normalizeArrivalCount(3,'open',-5),0);
  assert.equal(normalizeArrivalCount(3,'closing',0),0);
});


test('overnight deliveries are capped and never mutate existing stock',()=>{
  const stock=[1,3,98,0],pending=[3,0,8,5];
  assert.deepEqual(overnightSupplies(stock,pending),[4,3,99,5]);
  assert.deepEqual(stock,[1,3,98,0]);
  assert.deepEqual(pending,[3,0,8,5]);
  assert.deepEqual(overnightSupplies([NaN,-1,Infinity,2],[3,4,5,-7]),[3,4,5,2]);
});
test('the day cannot advance before class or while a student remains',()=>{
  assert.equal(canCompleteDay('opening',0,1),false);
  assert.equal(canCompleteDay('open',0,1),false);
  assert.equal(canCompleteDay('closing',1,1),false);
  assert.equal(canCompleteDay('closing',0,0),false);
  assert.equal(canCompleteDay('closing',0,1),true);
});
