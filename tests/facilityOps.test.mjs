import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPLY_NAMES,SUPPLY_BUNDLES,INITIAL_SUPPLIES,
  normalizeStock,normalizePercent,gearActive,maintenanceWear,recharge,
  discountRecruitment,availablePhoneCalls,MOP_SPOTS
} from '../src/facilityOps.ts';

test('four types of gym consumables use real priced next-day orders',()=>{
  assert.deepEqual([...SUPPLY_NAMES],['Water jugs','Fresh towels','Toilet paper','Sanitizer']);
  assert.equal(SUPPLY_BUNDLES.length,4);
  for(const b of SUPPLY_BUNDLES)assert.ok(b.price>0&&b.amount>=3);
  assert.deepEqual(normalizeStock(undefined),Array.from(INITIAL_SUPPLIES));
  assert.deepEqual(normalizeStock([5,-2,Infinity,'8']),[5,3,2,3],
    'Invalid saves should recover sensible starting supplies');
  assert.deepEqual(normalizeStock([3,0,10,0]),[3,0,10,0],
    'Legitimate empty supply inventory is preserved');
  assert.deepEqual(normalizeStock([2,4,4,1],[0,0,0,0]),[2,4,4,1]);
});
test('equipment bonuses only apply to placed functional clean equipment',()=>{
  assert.equal(gearActive(true,false,100,100),true);
  assert.equal(gearActive(false,false,100,100),false);
  assert.equal(gearActive(true,true,100,100),false);
  assert.equal(gearActive(true,false,10,100),false);
  assert.equal(gearActive(true,false,100,20),false);
  assert.equal(gearActive(true,false,25,40),true);
  assert.equal(gearActive(true,false,24,100),false);
  assert.equal(gearActive(true,false,100,39),false);
  assert.equal(maintenanceWear(100,24),76);
  assert.equal(maintenanceWear(10,24),0);
  assert.equal(recharge(80,65),100);
  assert.equal(recharge(30,65),95);
});
test('phone calls are capped and create meaningful discounted student leads',()=>{
  assert.equal(availablePhoneCalls(1,0),1);
  assert.equal(availablePhoneCalls(2,1),1);
  assert.equal(availablePhoneCalls(2,2),0);
  assert.equal(availablePhoneCalls(10,0),2);
  assert.equal(discountRecruitment(100,0),100);
  assert.equal(discountRecruitment(100,1),75);
  assert.equal(discountRecruitment(100,2),75,'Additional calls cannot stack discounts');
});
test('mat condition and save normalization are bounded',()=>{
  assert.equal(MOP_SPOTS,5);
  assert.equal(normalizePercent(undefined,70),70);
  assert.equal(normalizePercent(120,70),100);
  assert.equal(normalizePercent(-9),0);
  assert.equal(normalizePercent(43.9),43);
});
