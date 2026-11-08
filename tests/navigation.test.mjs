import assert from 'node:assert/strict';
import test from 'node:test';
import { clearSegment, GymNavigation } from '../src/navigation.ts';

const start={x:75,y:105};
const end={x:171,y:105};
const floor=(x,y)=>x>=15&&x<=465&&y>=32&&y<=215;
const obstacle=(x,y)=>x>=107&&x<=137&&y>=90&&y<=120;

test('routes around placed equipment without cutting corners',()=>{
  const open=(x,y)=>floor(x,y)&&!obstacle(x,y);
  const nav=new GymNavigation(open);
  nav.rebuild();
  const path=nav.route(start,end);
  assert.ok(path.length>=2);
  assert.deepEqual(path.at(-1),end);
  assert.ok(path.every((point,i)=>clearSegment(path[i-1]??start,point,open)));
});

test('routes around a student and refuses a reserved exact destination',()=>{
  const nav=new GymNavigation(floor);
  nav.rebuild();
  const free=(x,y)=>!obstacle(x,y);
  const path=nav.route(start,end,free,true);
  assert.ok(path.length>=2);
  assert.deepEqual(path.at(-1),end);
  assert.ok(path.every((point,i)=>clearSegment(path[i-1]??start,point,free)));
  assert.deepEqual(nav.route(start,{x:120,y:105},free,true),[]);
});

test('recovers a legacy spawn covered by furniture after a layout rebuild',()=>{
  let furniture=false;
  const nav=new GymNavigation((x,y)=>floor(x,y)&&(!furniture||!obstacle(x,y)));
  const spawn={x:120,y:105};
  nav.rebuild();
  assert.deepEqual(nav.recover(spawn),spawn);
  furniture=true;
  nav.rebuild();
  const safe=nav.recover(spawn);
  assert.ok(floor(safe.x,safe.y)&&!obstacle(safe.x,safe.y));
  assert.ok(nav.route(safe,end).length>0);
});

test('rejects routes across a fully blocked floor and falls back for an ordinary click',()=>{
  const open=(x,y)=>floor(x,y)&&(x<120||x>135);
  const nav=new GymNavigation(open);
  nav.rebuild();
  assert.deepEqual(nav.route(start,end,undefined,true),[]);
  const path=nav.route(start,{x:121,y:105});
  assert.ok(path.length>0&&path.at(-1).x<120);
});
