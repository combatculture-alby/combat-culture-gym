import assert from 'node:assert/strict';
import test from 'node:test';
import {GYM_LEVELS,STUDENT_NAMES,normalizeGymLevel,studentCapacity,enrolledCount,activeStudentCount,recruitmentCost,canExpandGym,attendingIndices,normalizeClassPlan} from '../src/gymProgression.ts';

test('all five levels have increasing capacity and an on-floor crowd limit',()=>{
  assert.equal(GYM_LEVELS.length,5);
  assert.equal(STUDENT_NAMES.length,24);
  assert.deepEqual(GYM_LEVELS.map(l=>l.capacity),[4,6,10,16,24]);
  assert.deepEqual(GYM_LEVELS.map(l=>l.active),[4,5,6,7,8]);
  assert.equal(activeStudentCount(24,5),8);
  assert.equal(activeStudentCount(5,2),5);
});
test('old saves remain garage level with four students and recruits cannot overfill',()=>{
  assert.equal(normalizeGymLevel(undefined),1);
  assert.equal(enrolledCount(undefined,1),4);
  assert.equal(enrolledCount(100,1),4);
  assert.equal(enrolledCount(100,2),6);
  assert.equal(studentCapacity(5),24);
});
test('expansion is gated by money, reputation, classes and purchased gear',()=>{
  assert.equal(canExpandGym(1,400,12,8,2),true);
  assert.equal(canExpandGym(1,399,12,8,2),false);
  assert.equal(canExpandGym(1,400,11,8,2),false);
  assert.equal(canExpandGym(1,400,12,7,2),false);
  assert.equal(canExpandGym(1,400,12,8,1),false);
  assert.equal(canExpandGym(5,999999,999,999,24),false);
  assert.equal(recruitmentCost(4),35);
  assert.equal(recruitmentCost(5),60);
});

test('attendance rotates across recruited students without exceeding floor space',()=>{
  assert.deepEqual(attendingIndices(4,1,1),[0,1,2,3]);
  assert.deepEqual(attendingIndices(6,2,1),[0,1,2,3,4]);
  assert.deepEqual(attendingIndices(6,2,2),[5,0,1,2,3]);
  const seen=new Set();
  for(let day=1;day<=6;day++){
    const group=attendingIndices(24,5,day);
    assert.equal(group.length,8);
    for(const student of group)seen.add(student);
  }
  assert.equal(seen.size,24);
  assert.deepEqual(attendingIndices(0,1,1),[]);
});

test('class schedules default safely and only accept four valid programs',()=>{
  assert.deepEqual(normalizeClassPlan(undefined),[0,1]);
  assert.deepEqual(normalizeClassPlan([3,2]),[3,2]);
  assert.deepEqual(normalizeClassPlan([-1,99]),[0,1]);
  assert.deepEqual(normalizeClassPlan([0,'1']),[0,1]);
});
