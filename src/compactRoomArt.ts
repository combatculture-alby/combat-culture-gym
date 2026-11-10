import Phaser from 'phaser';
import {roomFloor,roomWalkBounds} from './roomItems';
import type {RoomId} from './gymRooms';

type Palette={wall:number;floor:number;tile:number;mat:number;matTile:number;edge:number;trim:number};
/** A single continuous walkable floor across each secondary room.
 * The central training mat is the only item placement zone. Furnished side
 * corridors, doorways and stairs are part of the room, not a boxed backdrop.
 */
export function paintCompactRoom(scene:Phaser.Scene,room:RoomId):void {
  const f=roomFloor(room),walk=roomWalkBounds(room);
  const p:Palette=room==='outdoor'
    ?{wall:0x658c84,floor:0x78968b,tile:0x92ac9c,mat:0x426f60,matTile:0x568371,edge:0xc0c4a5,trim:0xd2c097}
    :room==='upstairs'
      ?{wall:0x536d77,floor:0x8f8572,tile:0xa69b84,mat:0x396b72,matTile:0x467d81,edge:0xb6ccc3,trim:0xd4b88c}
      :{wall:0x515f62,floor:0x82827a,tile:0x94978d,mat:0x425f63,matTile:0x506e71,edge:0xb7aca0,trim:0xc5b58b};
  const g=scene.add.graphics().setDepth(0);
  const rect=(c:number,x:number,y:number,w:number,h:number,a=1)=>
    g.fillStyle(c,a).fillRect(x,y,w,h);
  const line=(c:number,x1:number,y1:number,x2:number,y2:number,width=1,a=1)=>
    g.lineStyle(width,c,a).lineBetween(x1,y1,x2,y2);

  // One continuous architectural shell, with the upper wall or landscape
  // meeting a floor across the full available width.
  rect(0x172d34,0,23,480,203);
  if(room==='outdoor'){
    // Open sky, distant neighborhood, continuous yard fencing.
    rect(0xa9d0c4,0,24,480,50);
    rect(0x95beb6,0,61,480,34);
    for(const [x,y,w,h] of [
      [0,70,62,34],[57,61,46,44],[101,74,76,32],[175,64,68,42],
      [240,73,54,33],[293,59,77,47],[366,73,47,33],[411,67,69,40]
    ]){
      rect(0x6e968f,x,y,w,h);
      rect(0x91b6a7,x+3,y+4,w-6,2);
      rect(0x547b76,x+8,y+10,7,10,.55);
      rect(0x547b76,x+w-17,y+10,7,10,.55);
    }
    rect(0x365b58,0,97,480,4);
    rect(0x95b5a5,0,99,480,2);
    for(let x=15;x<475;x+=18){
      rect(0x476e65,x,85,3,25);
      rect(0x9fbaaa,x+3,89,12,2);
    }
    rect(0x3d625c,0,109,480,5);
  }else if(room==='upstairs'){
    // Mezzanine wall, four large windows, beams and lighting.
    rect(p.wall,0,24,480,84);
    for(let x=0;x<480;x+=78){
      rect(0x314e58,x,25,5,82);
      rect(0x97aaa4,x+2,26,1,74,.5);
    }
    for(const x of [32,145,259,374]){
      rect(0x233f49,x-3,37,77,52);
      rect(0x9fc3c2,x+1,41,69,44);
      rect(0x7fa8ae,x+4,44,63,36);
      rect(0x587e8d,x+5,69,62,10,.7);
      rect(0xcee0d5,x+34,42,3,43);
      rect(0xc4d5cf,x+2,62,66,2);
      rect(0xe4eadc,x+3,42,64,2,.58);
      rect(0x324e58,x-4,87,79,4);
    }
    rect(0x324a50,0,102,480,7);
    rect(p.trim,0,105,480,2);
    for(const x of [16,240,462]){
      rect(0x3c5862,x-4,24,7,84);
      rect(0x9ab6ad,x-2,28,2,75,.52);
    }
  }else{
    // Basement masonry, plumbing and narrow high windows.
    rect(p.wall,0,24,480,84);
    for(let y=29;y<107;y+=13){
      rect(0x394b50,0,y,480,1,.65);
      for(let x=(Math.floor(y/13)%2)*24;x<480;x+=48)
        rect(0x35484d,x,y+1,1,12,.55);
    }
    rect(0x98aaa5,0,46,480,4);
    rect(0x283d45,0,50,480,3);
    for(const x of [110,275,384]){
      rect(0x253d45,x,57,57,28);
      rect(0x86a6a5,x+4,60,49,19);
      rect(0x4d7479,x+8,64,41,11);
      rect(0xbed0c4,x+25,61,2,18);
    }
    rect(0x273b42,0,103,480,6);
    rect(p.trim,0,106,480,2,.6);
    for(const x of [46,354]){
      rect(0x7b9694,x,25,4,70);
      rect(0xa7bbb2,x+1,29,1,62);
      rect(0x29444a,x-3,92,10,5);
    }
  }

  // Visible walkable floor fills both wings and the front aisle.
  rect(p.floor,0,109,480,117);
  rect(0x31494c,0,108,480,3);
  rect(p.trim,0,111,480,1,.45);
  for(let y=116,ri=0;y<221;y+=17,ri++){
    line(room==='upstairs'?0x766f62:0x546b67,0,y,480,y,1,.27);
    for(let x=(ri%2)*22;x<480;x+=44){
      rect(p.tile,x+2,y+2,39,12,.09);
      rect(0x233c41,x,y,1,16,.12);
    }
  }
  // Side corridors are a distinct paving material, not inaccessible scenery.
  const leftWidth=f.left-walk.left-3;
  const rightStart=f.right+3;
  rect(p.tile,walk.left,114,leftWidth,105,.13);
  rect(p.tile,rightStart,114,walk.right-rightStart,105,.13);
  for(let y=123;y<217;y+=25){
    for(const x of [walk.left+7,f.right+11])
      rect(p.trim,x,y,8,2,.25);
  }

  // Small central training floor. It remains the ONLY placement zone.
  const width=f.right-f.left,height=f.bottom-f.top;
  rect(0x26454a,f.left-5,f.top-5,width+10,height+10);
  rect(p.edge,f.left-3,f.top-3,width+6,height+6);
  rect(p.mat,f.left,f.top,width,height);
  for(let y=f.top;y<f.bottom;y+=19){
    const row=Math.floor((y-f.top)/19);
    for(let x=f.left;x<f.right;x+=22){
      rect((row+Math.floor((x-f.left)/22))%3===0?p.matTile:p.mat,
        x+1,y+1,Math.max(1,Math.min(21,f.right-x-1)),
        Math.max(1,Math.min(18,f.bottom-y-1)));
      rect(0xd3e1d3,x+2,y+2,Math.max(1,Math.min(17,f.right-x-3)),1,.09);
    }
  }
  for(const x of [f.left+5,f.right-9])for(const y of [f.top+5,f.bottom-9]){
    rect(p.trim,x,y,5,1,.85);
    rect(p.trim,x+2,y-2,1,5,.85);
  }
  // Grounded border and entrance-side floor tiles read as one connected room.
  rect(0x29454a,0,223,480,3);
  rect(p.trim,0,220,480,2,.75);
  for(let x=17;x<465;x+=37)rect(0x314a4c,x,221,21,1,.35);
  rect(0x30464b,0,111,10,115);
  rect(0x30464b,470,111,10,115);
  rect(0x839e99,10,112,2,106,.45);
  rect(0x839e99,468,112,2,106,.45);

  if(room==='outdoor'){
    // Shed/utility station attached to the LEFT fence. Its base is a solid
    // obstruction, but the wide paving strip below it is walkable.
    rect(0x304e4a,19,91,46,48);
    rect(0xb1b89c,22,93,40,3);
    rect(0x6d8978,23,97,38,40);
    for(const x of [27,39,51])rect(0x43675f,x,101,4,33);
    rect(0x243f42,46,121,4,5);
    rect(0xadc6b2,20,136,45,3);
    rect(0x263e40,24,140,38,4,.3);
    // Built-in outdoor seating/planter on the right wall.
    rect(0x3a6059,410,108,47,19);
    rect(0xc3b69a,413,109,41,5);
    rect(0x52795f,415,96,37,14);
    for(const [x,y] of [[419,95],[431,90],[446,96]]){
      g.fillStyle(0x6f9b75).fillEllipse(x,y,19,15);
      g.fillStyle(0x95b68e).fillEllipse(x-2,y-2,8,6);
    }
    rect(0x3a5854,414,127,40,11);
    rect(0xaeb7a3,417,129,34,2);
    rect(0x2d4744,417,138,34,4,.5);
    // Outdoor drainage, expansion joints and boundary kerb.
    for(let x=32;x<459;x+=66){
      rect(0x49685f,x,214,31,2,.4);
      for(let k=0;k<4;k++)rect(0xa4b5a2,x+5+k*6,215,2,1,.5);
    }
  }else if(room==='upstairs'){
    // Built-in changing-room lockers on LEFT, wall-mounted and grounded.
    rect(0x243f47,18,88,64,46);
    rect(0x7f9c9e,22,91,56,39);
    for(let x=24;x<77;x+=18){
      rect(0x426a70,x,94,16,33);
      rect(0xa6bdb7,x+3,99,10,2);
      rect(0xa6bdb7,x+3,103,10,1,.7);
      rect(0xd1bd93,x+12,113,2,5);
    }
    rect(0x304e56,19,132,61,6);
    // Lounge bench on RIGHT with a wall picture above it.
    rect(0x2e4852,403,57,45,27);
    rect(0xc1aa87,406,60,39,21);
    rect(0x587b76,410,65,31,13);
    rect(0xcfe0cf,413,67,14,2,.7);
    rect(0x354d56,397,115,57,22);
    rect(0x9a826b,400,116,51,9);
    rect(0xc9ac85,400,116,51,2);
    for(const x of [407,443])rect(0x31474d,x,127,4,12);
    // Mezzanine rail runs along the FRONT edge, not through walkable lanes.
    rect(0x314950,12,221,456,4);
    for(let x=15;x<464;x+=34)rect(0x46656b,x,220,3,6);
  }else{
    // Utility shelves on LEFT and lockers on RIGHT, with open walking lanes.
    rect(0x263e46,17,85,63,52);
    for(const y of [94,112,129]){
      rect(0xa2a89a,20,y,57,3);
      for(const x of [25,43,62]){
        rect(0x55706f,x,y-15,12,14);
        rect(0xb1c0af,x+2,y-12,8,2,.8);
      }
    }
    rect(0x324f54,20,137,56,4);
    rect(0x293e46,406,94,52,43);
    rect(0x8c9c98,409,96,46,39);
    for(let x=411;x<454;x+=14){
      rect(0x47656b,x,99,12,33);
      rect(0xb3bfae,x+3,104,6,2);
      rect(0xd2be92,x+9,118,2,4);
    }
    rect(0x30494b,406,135,53,7);
    // Overhead maintenance plumbing remains on the wall.
    line(0xa4aaa0,190,40,190,94,3);
    line(0xa4aaa0,190,94,241,94,3);
    rect(0x2f484e,237,89,9,9);
  }

  // Perimeter lighting is part of the architecture, not floating on the mat.
  for(const x of [130,350]){
    rect(0x2d444b,x-1,26,3,9);
    rect(0xd9c697,x-10,35,20,3);
    rect(0xf5dfb0,x-7,38,14,2,.85);
  }
}
