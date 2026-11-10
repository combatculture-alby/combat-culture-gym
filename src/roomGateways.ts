import Phaser from 'phaser';
import type {RoomId} from './gymRooms';

type GatewayOptions={returning?:boolean;depth?:number};
type WallSide='left'|'right'|'back';

/** Architectural entrances share the 40px coach scale. Side exits are
 * recessed into the room perimeter; only the upstairs main-gym stairwell
 * extends from the back wall onto the mat. They are not placeable props.
 */
export function makeRoomGateway(scene:Phaser.Scene,kind:RoomId,x:number,y:number,
  onClick:()=>void,options:GatewayOptions={}):Phaser.GameObjects.Container {
  const body=scene.add.container(x,y).setDepth(options.depth??12);
  const g=scene.add.graphics();
  const rect=(c:number,x:number,y:number,w:number,h:number,a=1)=>
    g.fillStyle(c,a).fillRect(x,y,w,h);
  const line=(c:number,x1:number,y1:number,x2:number,y2:number,w=2)=>
    g.lineStyle(w,c).lineBetween(x1,y1,x2,y2);
  const dark=0x172c32,ink=0x233e45,metal=0xa1b3ac,wood=0xb49b73;
  // The main room's outdoor and basement entrances are in its left wall;
  // return entrances occupy the left/right edge of each smaller room.
  const side:WallSide=options.returning?(kind==='outdoor'?'right':'left'):
    kind==='upstairs'?'back':'left';
  const ascending=options.returning?kind==='downstairs':kind==='upstairs';

  if(side==='back'){
    // An open flight of stairs meets the existing BACK WALL at y-46.
    // No black 50x50 box or freestanding door casing on top of the floor.
    // Structural opening starts at the wall/floor seam (world y~74).
    // Extending the recess behind the steps makes it a real stairwell.
    rect(0x38545a,-20,-61,40,32);
    rect(0x9ab1a7,-21,-62,42,3);
    rect(ink,-17,-58,34,28);
    rect(dark,-14,-56,28,25);
    rect(0x59716b,-12,-51,24,3);
    rect(wood,-18,-30,36,3);
    for(let step=0;step<5;step++){
      const yTop=-28+step*6;
      rect(0x294248,-16,yTop,32,6);
      rect(ascending?0xa38a67:0x73817a,-15,yTop+2,30,4);
      rect(ascending?0xd9c397:0xa9b7a9,-14,yTop+2,28,1);
    }
    line(metal,-19,-31,-19,-1,3);
    line(metal,19,-31,19,-1,3);
    rect(0x395a5e,-21,-3,42,3);
    rect(0xb8bcac,-18,-3,36,1);
    // Feet of the staircase visibly terminate at the walkable mat.
    rect(0x1b3439,-21,0,42,2,.45);
  }else{
    // Mirror one wall-recess design onto the opposite side of the room.
    // The architectural masonry stays OUTSIDE the buildable mat; the
    // threshold just meets its edge instead of sitting in its middle.
    const r=(c:number,xx:number,yy:number,w:number,h:number,a=1)=>
      rect(c,side==='right'?-xx-w:xx,yy,w,h,a);
    const edge=(xx:number)=>side==='right'?-xx:xx;
    // Wall pier, lintel, floor continuation and a genuine dark opening.
    r(0x38565a,-33,-35,23,65);
    r(0x627f7c,-32,-34,3,62);
    r(0x29464d,-34,-35,28,5);
    r(0xa8b9a9,-32,-34,25,2);
    r(0x29464d,-34,23,28,7);
    r(0x8ea198,-32,24,25,2);
    r(dark,-28,-28,31,49);
    r(0x304b4d,-25,-26,27,45);
    // Structural inner jamb and the thin line where it meets the floor.
    r(0xb8b3a0,-9,-28,3,48);
    r(0x19323a,-6,-28,3,48);
    r(0x6c8c86,-8,17,16,3);
    r(0xc4c6aa,-5,18,13,2);
    if(kind==='outdoor'){
      // Sliding glass gate in a side-wall track, not a standalone cabinet.
      // The opening is an inset passage with a partly open side gate,
      // not an opaque rectangular "door prop" pasted onto the mat.
      r(0x162f33,-26,-25,18,43);
      r(0x294d48,-24,-23,14,39);
      r(0x1c3938,-22,-21,11,35);
      r(0x749b8e,-25,-23,2,39);
      r(0x577c6e,-13,-20,2,35);
      line(wood,edge(-11),-19,edge(1),-10,3);
      line(0xa8b5a0,edge(-10),-17,edge(0),-9,1);
      r(0x94aba0,-27,-28,21,2);
      // Paving visibly continues from the passage across the threshold.
      for(let k=0;k<3;k++)r(0x658f83,-5+k*4,12,2,7,.75);
    }else{
      // Recessed stair treads follow the wall edge. Their darker side
      // disappears into the stairwell, with no freestanding stair box.
      r(ink,-27,-25,20,42);
      for(let step=0;step<5;step++){
        const yTop=-23+step*8;
        r(ascending?0x947f65:0x677978,-25,yTop,17,6);
        r(ascending?0xd5bd93:0xa0b5a8,-24,yTop+1,15,2);
      }
      r(wood,-29,-29,25,3);
      r(0xaec3b6,-28,-29,23,1);
      line(0xadbab1,edge(-6),-25,edge(-6),16,2);
      r(0x476269,-7,16,15,4);
    }
  }

  body.add(g);
  const name=options.returning?'MAIN GYM':kind==='outdoor'?'YARD':
    kind==='upstairs'?'UPSTAIRS':'DOWNSTAIRS';
  const caption=scene.add.text(side==='left'?-8:side==='right'?8:0,-50,name,{
    fontFamily:'Arial',fontSize:'8px',color:'#f8e9ce',
    backgroundColor:'#28454a',padding:{x:3,y:2}
  }).setOrigin(.5).setVisible(false);
  body.add(caption);
  const hit=scene.add.zone(side==='left'?-8:side==='right'?8:0,-11,
    side==='back'?44:40,side==='back'?45:58)
    .setInteractive({useHandCursor:true});
  hit.on('pointerover',()=>caption.setVisible(true));
  hit.on('pointerout',()=>caption.setVisible(false));
  hit.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,
    event:Phaser.Types.Input.EventData)=>{event.stopPropagation();onClick();});
  body.add(hit);
  return body;
}
