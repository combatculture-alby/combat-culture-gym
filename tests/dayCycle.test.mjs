import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGymPhase,normalizeArrivalCount,outstandingTrash,
  canTeachInPhase,canCloseInPhase,canAdvanceDay,
  ARRIVAL_INTERVAL_SECONDS,DEPARTURE_INTERVAL_SECONDS
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
