import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COACH_SKINS,COACH_HAIR,COACH_SHIRTS,COACH_SHORTS,COACH_GLOVES,
  CLOTHING_SHOP,DEFAULT_COACH,normalizeCoachAppearance,normalizeCloset,
  normalizeUnlockedAppearance,hasClothing,coachTextureId
} from '../src/coachStyle.ts';

test('coach customization is normalized and safe with old or malformed saves',()=>{
  assert.deepEqual(normalizeCoachAppearance(undefined),DEFAULT_COACH);
  assert.deepEqual(normalizeCoachAppearance({skin:-3,hair:55,cut:'4',top:999,shorts:null,gloves:-1}),DEFAULT_COACH);
  assert.deepEqual(normalizeUnlockedAppearance({skin:4,hair:3,cut:2,top:5,shorts:4,gloves:3},[]),
    {skin:4,hair:3,cut:2,top:0,shorts:0,gloves:0},
    'Locked apparel must never be granted by altered save data');
  assert.deepEqual(normalizeCloset([2,2,3,-1,0,999,'2']),[0,2,3]);
});

test('every item has a distinct valid unlock and stable texture identity',()=>{
  const keys=new Set();
  const combos=[];
  for(let i=0;i<CLOTHING_SHOP.length;i++){
    const item=CLOTHING_SHOP[i];
    assert.equal(item.id,i);
    assert.ok(item.price>0);
    assert.ok(!combos.includes(item.slot+item.value),'No duplicate shop variants');
    combos.push(item.slot+item.value);
    const a={...DEFAULT_COACH,[item.slot]:item.value};
    const owned=normalizeUnlockedAppearance(a,[item.id]);
    assert.equal(owned[item.slot],item.value,'Purchased apparel should unlock');
    keys.add(coachTextureId(owned));
  }
  assert.equal(keys.size,CLOTHING_SHOP.length);
  assert.equal(COACH_SKINS.length,5);
  assert.equal(COACH_HAIR.length,5);
  assert.equal(COACH_SHIRTS.length,6);
  assert.equal(COACH_SHORTS.length,6);
  assert.equal(COACH_GLOVES.length,4);
  assert.equal(hasClothing('top',0,[]),true);
  assert.equal(hasClothing('top',5,[]),false);
  assert.equal(hasClothing('top',5,[3]),true);
});

test('appearance and clothing shop never include stat boosts',()=>{
  for(const item of CLOTHING_SHOP){
    assert.deepEqual(Object.keys(item).sort(),['id','name','price','slot','value']);
  }
  assert.ok(coachTextureId(DEFAULT_COACH).startsWith('coach-custom-'));
});
