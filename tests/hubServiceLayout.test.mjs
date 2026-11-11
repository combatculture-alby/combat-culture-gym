import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceFixtureLayout} from '../src/hubServiceLayout.ts';
import {gymServiceLayout,trainingBounds} from '../src/gymProgression.ts';

test('the phone always sits directly on the real reception desk',()=>{
  const seen=new Set();
  for(let level=1;level<=5;level++){
    const l=serviceFixtureLayout(level),desk=gymServiceLayout(level).desk;
    assert.ok(l.phone.x>=desk.x&&l.phone.x<=desk.x+desk.w);
    assert.ok(l.phone.y>=desk.y&&l.phone.y<=desk.y+desk.h);
    assert.deepEqual(l.phone.approach,gymServiceLayout(level).deskApproach);
    seen.add(l.phone.x);
  }
  assert.ok(seen.size>=4,'Phone should move with the changing desk');
});

test('cooler, supply closet and mop stay in the utility corridor at all five levels',()=>{
  for(let level=1;level<=5;level++){
    const props=serviceFixtureLayout(level),mat=trainingBounds(level);
    const room=gymServiceLayout(level).room;
    assert.ok(props.water.x>mat.right,'Water fixture must not fill training mat');
    assert.ok(props.mop.x>props.water.x,'Mop and cooler need separate footprints');
    assert.ok(props.stock.x>props.mop.x,'Closet should be on the service wall');
    for(const [name,obj] of Object.entries(props)){
      assert.ok(obj.x>=room.left&&obj.x<=room.right,level+' '+name+' x within gym');
      assert.ok(obj.y>=room.top&&obj.y<=room.bottom,level+' '+name+' y within gym');
      assert.ok(obj.hitWidth>=24&&obj.hitHeight>=20,'Actual objects should have phone-friendly touch targets');
      assert.ok(obj.approach.x>=room.left&&obj.approach.x<=room.right,'approach x');
      assert.ok(obj.approach.y>=room.top&&obj.approach.y<=room.bottom,'approach y');
    }
    const dx=props.water.x-props.mop.x,dy=props.water.y-props.mop.y;
    assert.ok(Math.hypot(dx,dy)>37,'Cooler must not collide with mop bucket');
  }
});

test('level 5 keeps the flagship cabinet on the edge and leaves reception center free',()=>{
  const p=serviceFixtureLayout(5),desk=gymServiceLayout(5).desk;
  assert.ok(p.stock.x>desk.x+desk.w*.7);
  assert.ok(p.phone.x<desk.x+desk.w*.5);
  assert.ok(p.mop.y>p.water.y);
});
