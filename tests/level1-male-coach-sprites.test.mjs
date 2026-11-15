import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../level1-male-coach-sprites.js', import.meta.url), 'utf8');

function sprite() {
  return {
    active:true, visible:true, frame:'0',
    setOrigin(){return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},
    setVisible(v){this.visible=v;return this;},setFrame(v){this.frame=v;return this;},
    setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){this.active=false;}
  };
}

test('32 user-edited coach frames and activity fallback', () => {
  const frameIds=[];
  const old = sprite();
  const animCalls=[];
  const sprint = {isDown:false};
  const coach = {
    approvedCoach:true, image:old, facing:'down',left:false,elapsed:0,pose:'idle',
    body:{x:100,y:150,add(v){this.child=v;}},
    animate(pose,dt){animCalls.push(pose);if(this.pose!==pose)this.elapsed=0;this.pose=pose;this.elapsed+=dt;}
  };
  const active = [];
  const scene = {
    sys:{isActive:()=>true}, scene:{key:'Gym'},coach,
    textures:{exists:()=>false,addImage(_k,img){assert.equal(img.naturalWidth,480);return {add(id){frameIds.push(id);}};}},
    add:{image(){return sprite();}},input:{keyboard:{addKey(){return sprint;}}},
    events:{once(event,fn){active.push([event,fn]);}}
  };
  const context={
    Image:class {naturalWidth=480;naturalHeight=456;set src(url){this.url=url;this.onload?.();}},
    window:{CC_GAME:{scene:{scenes:[scene]}}},
    setInterval(){},console
  };
  vm.runInNewContext(source,context,{filename:'level1-male-coach-sprites.js'});
  assert.equal(frameIds.length,32);
  assert.equal(old.visible,false);
  const replacement=coach.body.child;
  assert.equal(replacement.frame,'0');
  assert.equal(replacement.width,35);
  assert.equal(replacement.height,64);
  coach.facing='side';coach.left=true;coach.animate('walk',0.1);
  assert.equal(replacement.frame,'14');
  coach.facing='side';coach.left=false;coach.animate('walk',0.14);
  assert.equal(replacement.frame,'18');
  coach.facing='up';coach.animate('walk',0.3);
  assert.ok(['11','12','13'].includes(replacement.frame));
  coach.facing='down';sprint.isDown=true;coach.animate('walk',0.1);
  assert.ok(['20','21','22'].includes(replacement.frame));
  coach.animate('shadow',0.2);
  assert.equal(replacement.visible,false);
  assert.equal(old.visible,true);
  assert.equal(context.window.CC_L1_MALE_COACH.frameCount,32);
  active[0][1]();
  assert.equal(replacement.active,false);
});