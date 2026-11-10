import Phaser from 'phaser';
import {roomFloor} from './roomItems';
import type {RoomId} from './gymRooms';

type Palette={wall:number;shadow:number;ground:number;mat:number;rim:number;trim:number};
/** Smaller rooms are *architecturally* smaller: enclosing walls, a distinct
 * 2.5D back wall and a limited playable footprint. The canvas remains 480x330.
 */
export function paintCompactRoom(scene:Phaser.Scene,room:RoomId):void {
  const f=roomFloor(room);
  const p:Palette=room==='outdoor'
    ?{wall:0x50766e,shadow:0x244e48,ground:0x668c70,mat:0x4a7160,rim:0xb5bb98,trim:0xc9d7ae}
    :room==='upstairs'
      ?{wall:0x657b86,shadow:0x2a4956,ground:0x877664,mat:0x477078,rim:0xaec9c3,trim:0xd3c6a1}
      :{wall:0x696866,shadow:0x373b3e,ground:0x76746b,mat:0x4a6163,rim:0xb1a697,trim:0xc3ae87};
  const g=scene.add.graphics().setDepth(0);
  const block=(color:number,x:number,y:number,w:number,h:number,alpha=1)=>
    g.fillStyle(color,alpha).fillRect(x,y,w,h);
  const line=(color:number,x1:number,y1:number,x2:number,y2:number,width=2)=>
    g.lineStyle(width,color).lineBetween(x1,y1,x2,y2);
  // Recessed dark surround means additional rooms never appear as enormous
  // full-canvas floors, unlike the legacy placeholder.
  block(0x152b30,0,0,480,330);
  const left=f.left-18,right=f.right+18,top=f.top-54,bottom=f.bottom+12;
  block(0x0f252b,left-6,top-5,right-left+12,bottom-top+9);
  block(p.shadow,left,top,right-left,bottom-top);
  block(p.wall,left+6,top+4,right-left-12,f.top-top-4);
  block(p.ground,left+4,f.top-4,right-left-8,f.bottom-f.top+15);
  // Ceiling / support walls cast shadows behind characters.
  block(0x1d343a,left,top,right-left,6);
  block(p.trim,left+6,top+6,right-left-12,2);
  block(0x30494d,left,f.top-5,right-left,4);
  block(0x20383d,left,f.bottom+6,right-left,5);
  block(p.rim,f.left-4,f.top-3,f.right-f.left+8,f.bottom-f.top+6);
  block(p.mat,f.left,f.top,f.right-f.left,f.bottom-f.top);
  for(let y=f.top;y<f.bottom;y+=17){
    for(let x=f.left;x<f.right;x+=21){
      block((Math.floor(x/21)+Math.floor(y/17))%2?0x16373a:0xd3d7c0,
        x+1,y+1,Math.min(19,f.right-x-2),1,.18);
    }
  }
  for(const x of [left+4,right-10]){
    block(0x162d34,x,top,6,bottom-top);
    block(p.trim,x+1,top+5,2,bottom-top-13,.35);
  }
  if(room==='outdoor'){
    // Open-air courtyard with a believable alley fence, vegetation and sky.
    block(0xaacfc6,left+10,top+10,right-left-20,f.top-top-14);
    block(0x91b4aa,left+11,f.top-18,right-left-22,9);
    for(let x=left+14;x<right-10;x+=20){
      block(0x3f645a,x,top+14,3,f.top-top-16);
      block(0x4e786b,x+2,top+18,14,2);
    }
    for(const x of [left+20,right-23]){
      block(0x675b4a,x,f.top-15,4,15);
      g.fillStyle(0x558067).fillEllipse(x+2,f.top-22,30,26);
      g.fillStyle(0x83a57e).fillEllipse(x+3,f.top-26,16,14);
    }
    // Concrete edge and drainage outside the training mat.
    block(0x788c77,left+4,f.bottom+3,right-left-8,4);
    for(let x=f.left+14;x<f.right-14;x+=31)block(0x3d5a55,x,f.bottom+4,19,2);
  }else if(room==='upstairs'){
    // Balcony room: high windows, plaster, wood pilasters and a half railing.
    for(let x=left+21;x<right-40;x+=89){
      block(0x243f49,x,top+13,55,32);
      block(0x90bec2,x+4,top+17,47,23);
      block(0xc5dfd3,x+26,top+17,3,23);
      block(0xd9e7d9,x+4,top+17,47,2);
    }
    block(0xb09977,left+8,f.top-8,right-left-16,4);
    for(const x of [left+8,right-15]){
      block(0x7f6650,x,top+5,6,f.top-top-8);
      block(0xc2a785,x,top+7,2,f.top-top-10);
    }
    block(0x8f7661,left+8,f.bottom+4,right-left-16,3);
  }else{
    // Basement: painted concrete block wall, pipes, exposed foundation and
    // small high windows. It feels enclosed, not a second giant arena.
    for(let y=top+13;y<f.top-8;y+=9){
      const offset=(Math.floor(y/9)%2)*17;
      for(let x=left+8-offset;x<right-9;x+=35)
        block(0x293e42,Math.max(left+7,x),y,Math.min(31,right-8-Math.max(left+7,x)),1,.55);
    }
    line(0x758c89,left+10,top+12,right-11,top+12,3);
    for(const x of [left+26,right-34]){
      line(0x7b9c9b,x,top+12,x,f.top-11,3);
      block(0x223b44,x-4,f.top-12,11,4);
    }
    for(const x of [left+45,right-73]){
      block(0x263e44,x,top+22,39,18);
      block(0x71979c,x+3,top+25,33,12);
      block(0x536b70,x+17,top+25,3,12);
    }
    block(0x8a8271,left+8,f.bottom+4,right-left-16,3);
  }
  // Small overhead lamps anchored to the room rather than giant foreground tiles.
  for(const x of [left+(right-left)*.32,left+(right-left)*.69]){
    block(0x2d444b,x-1,top+3,2,10);
    block(0xd9c697,x-9,top+12,18,4);
    block(0xf5dfb0,x-6,top+15,12,2,.8);
  }
}
