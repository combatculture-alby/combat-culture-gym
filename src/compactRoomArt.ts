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
  // Each zone continues visually beyond the walkable training floor.
  // Subtle environmental context removes the black-box-on-a-black-void look.
  block(room==='outdoor'?0x6e938a:room==='upstairs'?0x536b74:0x414c50,0,24,480,202);
  if(room==='outdoor'){
    block(0x94b7ad,0,24,480,86);
    block(0xa8c9bb,0,25,480,25);
    // Distant rooftops, skyline, alley walls and pavement beyond the fence.
    for(const [x,y,w,h] of [[0,77,68,43],[68,67,44,54],[112,81,69,41],[181,72,56,50],
      [237,82,65,40],[302,70,45,52],[347,76,67,46],[414,65,66,57]]){
      block(0x5b7b78,x,y,w,h);
      block(0x7f9e94,x+4,y+4,w-8,3);
    }
    for(let x=12;x<478;x+=34){
      block(0x9eb6a4,x,92,14,2);
      block(0x436d66,x+5,91,3,20);
    }
    block(0x8ba092,0,211,480,15);
    for(let x=0;x<480;x+=40)block(0x6c887e,x,218,31,2);
  }else if(room==='upstairs'){
    block(0x617d85,0,25,480,94);
    for(const x of [0,93,188,283,378]){
      block(0x405b64,x,29,5,108);
      block(0x879e9f,x+5,45,85,2);
      block(0x8aa9ab,x+17,51,60,36);
      block(0x577f88,x+21,55,52,27);
      block(0xaac4ba,x+44,54,3,29);
    }
    block(0x937b63,0,205,480,21);
    block(0xc6a77f,0,208,480,3);
    for(let x=12;x<478;x+=55)block(0x655847,x,213,32,2);
    // Visible mezzanine rail outside the enclosed playable loft.
    block(0x30454d,7,103,67,5);block(0x30454d,405,103,68,5);
    for(const x of [14,38,62,413,437,461])block(0x344d53,x,106,3,42);
  }else{
    block(0x4c5759,0,24,480,202);
    for(let y=29;y<219;y+=15){
      for(let x=(Math.floor(y/15)%2)*18;x<480;x+=36){
        block(0x333f44,x,y,33,1,.65);
      }
    }
    block(0x748183,0,50,480,4);
    block(0x25383d,0,212,480,14);
    for(const x of [9,471]){
      block(0x28383c,x-7,31,9,185);
      block(0x929b94,x-4,35,3,174);
    }
    for(const x of [36,438]){
      block(0x2f484d,x,86,9,32);
      block(0x7a9b9d,x+2,90,5,19);
    }
  }
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
  // Room-specific fixtures are painted on walls, not as floating inventory
  // objects. They do not occupy the player-controlled floor.
  if(room==='outdoor'){
    // Hose reel, chalk-board weather sign and safely racked training cones.
    block(0x274a48,left+9,top+14,37,26);
    block(0xc2b18b,left+12,top+17,31,20);
    block(0x526e61,left+15,top+22,24,3);
    block(0x53746b,left+15,top+28,18,2);
    g.lineStyle(3,0xadc8a0).strokeCircle(right-28,top+33,10);
    g.lineStyle(2,0x4d7c66).strokeCircle(right-28,top+33,6);
    block(0xc4a77a,right-45,top+43,32,4);
    block(0x91724c,right-43,top+47,3,8);
    block(0x91724c,right-18,top+47,3,8);
    for(let x=left+35;x<left+70;x+=13){
      block(0x9f6a45,x,f.bottom+5,8,7);
      block(0xf2cd8c,x+2,f.bottom+4,4,2);
    }
  }else if(room==='upstairs'){
    // Loft cross-beams and built-in wall storage / bulletin board.
    block(0x354c53,left+7,top+7,right-left-14,6);
    block(0xc6ab80,left+9,top+9,right-left-18,2);
    block(0x354a4b,right-57,top+14,37,31);
    block(0xb0a17e,right-54,top+17,31,25);
    block(0x516b67,right-51,top+21,25,3);
    block(0xcbd1bc,right-50,top+28,12,9);
    block(0xd19d65,right-35,top+27,6,10);
    for(let y=top+21;y<top+42;y+=10)block(0x6c594b,left+14,y,38,3);
    for(const x of [left+19,left+34,left+48]){
      block(0x968b70,x,top+18,9,5);
      block(0x455b5b,x+3,top+15,4,3);
    }
  }else{
    // Utility panel, exposed ventilation duct and attached towel rack.
    block(0x35474b,left+13,top+17,37,29);
    block(0x899fa1,left+16,top+20,31,24);
    block(0x2d5154,left+20,top+25,23,3);
    for(const x of [left+23,left+33])block(0xb4d5c9,x,top+33,6,6);
    block(0x283f46,right-63,top+21,48,14);
    for(let x=right-59;x<right-17;x+=8)block(0x839da0,x,top+23,5,9);
    line(0x9caa99,right-62,top+42,right-16,top+42,2);
    for(const x of [right-55,right-36,right-19])block(0xd5d4c1,x,top+43,12,5);
  }
  // One realistic lighting treatment per zone, aligned to ceiling supports.
  for(const x of [left+(right-left)*.32,left+(right-left)*.69]){
    block(0x2d444b,x-1,top+3,2,8);
    block(0xd9c697,x-8,top+10,16,3);
    block(0xf5dfb0,x-5,top+13,10,2,.8);
  }
}
