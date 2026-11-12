import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceFixtureLayout} from '../src/hubServiceLayout.ts';
import {BLOCK_SIZE,GARAGE_ASSET_BLOCKS,garageFixture,garageEntrance,garageFixtures,garageBoardApproach,garageRoom} from '../src/garageLayout.ts';
import {GymNavigation} from '../src/navigation.ts';
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

test('cooler, supply closet and mop stay in the utility corridor at levels two through five',()=>{
  for(let level=2;level<=5;level++){
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
  assert.ok(p.mop.approach.y>p.water.approach.y);
});

test('garage fixtures clear the mat and admit exact routes to each station',()=>{
  const fixtures=Object.values(garageFixtures);
  const mat=trainingBounds(1);
  const canStand=(x,y)=>x>=garageRoom.left&&x<=garageRoom.right&&
    y>=garageRoom.top&&y<=garageRoom.bottom&&
    !fixtures.some(({footprint:p})=>Math.abs(x-p.x)<p.rx+6&&Math.abs(y-p.y)<p.ry+4);
  const nav=new GymNavigation(canStand);
  nav.rebuild();

  for(const [i,{art,footprint,approach}] of fixtures.entries()){
    assert.ok(art.x>=garageRoom.left-10&&art.x+art.w<=garageRoom.right+10,'fixture stays within the painted walls');
    assert.ok(art.y+art.h<=mat.top||art.x>=mat.right,'fixture stays off the mat');
    assert.ok(!canStand(footprint.x,footprint.y),'fixture blocks its floor base');
    assert.ok(canStand(approach.x,approach.y),'station approach is walkable');
    for(const {art:other} of fixtures.slice(i+1)){
      assert.ok(art.x+art.w<=other.x||other.x+other.w<=art.x||
        art.y+art.h<=other.y||other.y+other.h<=art.y,'fixture artwork has its own space');
    }
  }
  const approaches=[garageEntrance,{x:172,y:156},garageBoardApproach,...fixtures.map(f=>f.approach)];
  for(const start of approaches){
    for(const goal of approaches){
      assert.deepEqual(nav.route(start,goal,undefined,true).at(-1),goal);
    }
  }
});

test('garage fixture visuals, collision and station targets follow saved positions',()=>{
  const positions=JSON.parse(JSON.stringify({water:{x:240,y:108},desk:{x:366,y:186}}));
  const cooler=garageFixture('water',positions);
  const desk=garageFixture('desk',positions);
  const layout=gymServiceLayout(1,positions);
  const service=serviceFixtureLayout(1,positions);
  assert.equal(cooler.art.h,BLOCK_SIZE*GARAGE_ASSET_BLOCKS.water[1]);
  assert.equal(cooler.footprint.x,240);
  assert.equal(service.water.x,240);
  assert.deepEqual(service.water.approach,cooler.approach);
  assert.deepEqual(layout.desk,desk.art);
  assert.deepEqual(service.phone.approach,desk.approach);
  assert.deepEqual(gymServiceLayout(2,positions),gymServiceLayout(2));
});
