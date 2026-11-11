import Phaser from 'phaser';
import type {RoomId} from './gymRooms';

type GatewayOptions={returning?:boolean;depth?:number};
type Side='left'|'right'|'back';

/** Entrances are built into room edges. Stairs are read in side elevation:
 * horizontal left-to-right flights, not ladders facing out of the screen.
 * Clicking a doorway still uses the normal route-to-entrance behavior.
 */
export function makeRoomGateway(scene:Phaser.Scene,kind:RoomId,x:number,y:number,
  onClick:()=>void,options:GatewayOptions={}):Phaser.GameObjects.Container {
  const body=scene.add.container(x,y).setDepth(options.depth??9.5);
  const g=scene.add.graphics();
  const rect=(c:number,x:number,y:number,w:number,h:number,a=1)=>
    g.fillStyle(c,a).fillRect(x,y,w,h);
  const line=(c:number,x1:number,y1:number,x2:number,y2:number,w=1)=>
    g.lineStyle(w,c).lineBetween(x1,y1,x2,y2);
  const side:Side=options.returning?(kind==='outdoor'?'right':'left'):
    kind==='upstairs'?'back':'left';
  const ink=0x1b333a,wall=0x3e5b60,stone=0xabb8a6,gold=0xd5b68a;
  if(kind==='outdoor'){
    // Exterior access is a walk-through gap cut into the left/right perimeter,
    // with real masonry jambs, lintel, raised threshold and an OPEN gate.
    // It replaces the tall freestanding glass cabinet from earlier versions.
    const flip=side==='right';
    const r=(c:number,xx:number,yy:number,w:number,h:number,a=1)=>
      rect(c,flip?-xx-w:xx,yy,w,h,a);
    const tx=(xx:number)=>flip?-xx:xx;
    // The wall pier and roofline physically join the room's side border.
    r(0x253f45,-35,-41,27,73);
    r(0x728f87,-34,-40,4,68);
    r(0x486a68,-28,-38,18,62);
    r(0x112c33,-28,-31,30,52);
    r(0x335956,-26,-29,27,48);
    r(0x182f35,-23,-28,24,43);
    // Paving running through the passage creates an actual entry gap.
    r(0x456b65,-23,10,36,10);
    r(0x789e8c,-20,13,32,3);
    for(let i=0;i<3;i++)r(0xb5bd9f,-16+i*10,18,7,2,.62);
    r(0x263f44,-37,-40,36,6);
    r(0xc4bca1,-35,-40,32,2);
    // Wide overhang and side posts make the gate part of the building.
    r(0x28474b,-40,-46,41,7);
    r(0xc9b98c,-38,-46,37,2);
    r(0x7fa097,-29,-37,3,47);
    r(0x809e91,-4,-35,4,53);
    // Hinged metal gate swung OPEN into the walkway. Four edges and
    // full-height slats make a readable door leaf, not a diagonal stair rail.
    line(0x1e3a40,tx(-4),-28,tx(23),-18,4);
    line(0x96b7a8,tx(-4),-28,tx(23),-18,2);
    line(0x243f43,tx(-4),11,tx(23),21,4);
    line(0x799b8e,tx(-3),9,tx(22),19,2);
    line(0x29474a,tx(23),-18,tx(23),21,4);
    for(let i=0;i<3;i++){
      const ox=3+i*8,offset=3+i*3;
      line(0x426d65,tx(ox),-27+offset,tx(ox),10+offset,3);
      line(0x86aba0,tx(ox-1),-26+offset,tx(ox-1),9+offset,1);
    }
    rect(0x253d42,tx(19)-2,0,4,3);
    line(0xabc3ae,tx(19),0,tx(19),5,2);
    // Small wall-mounted exterior sign, no giant floating arrow or portal.
    r(0x29454b,-31,-58,33,11);
    r(0xe1cb99,-29,-55,29,5);
    for(const xx of [-25,-17,-9])r(0x41655e,xx,-53,5,1);
    g.fillStyle(0x162c31,.25).fillEllipse(0,25,62,9);
  }else{
    // Side-on staircase: individual horizontal treads ascend from left to
    // right. A continuous diagonal handrail and full-length stringer connect
    // the flight to the landing and the floor.
    const rising=side==='back'||(options.returning?kind==='downstairs':kind==='upstairs');
    const rise=(i:number)=>rising?5-i:i;
    // Recess behind the high landing, tied to the architectural back/side wall.
    if(side==='back'){
      rect(0x2c4851,18,-61,29,41);
      rect(0x1a343e,22,-57,20,31);
      rect(0xa0b6a8,18,-61,29,3);
      rect(0x6e8b84,43,-57,3,34);
    }else{
      rect(0x2d4850,-48,-46,26,47);
      rect(0x162f38,-44,-42,20,41);
      rect(0x9fb5a8,-48,-46,26,3);
      rect(0x587773,-45,-39,2,35);
    }
    // Under-stair wall and 6 solid risers, all resting on the same floor.
    rect(ink,-41,-4,88,7);
    for(let i=0;i<6;i++){
      const x=-37+i*13;
      const top=-12-rise(i)*5;
      rect(0x2f4a50,x,top,14,-top);
      rect(0x6d7972,x+2,top+2,11,-top-2);
      rect(0x9b927b,x,top,14,4);
      rect(0xe2c99c,x,top,13,2);
      rect(0x364f55,x+12,top+4,2,Math.max(1,-top-4));
    }
    const y0=-12-rise(0)*5,y5=-12-rise(5)*5;
    line(0x354c51,-40,y0-10,40,y5-10,5);
    line(stone,-40,y0-12,40,y5-12,3);
    line(gold,-40,y0-13,40,y5-13,1);
    for(const idx of [0,2,4,5]){
      const xx=-37+idx*13;
      const yy=-12-rise(idx)*5;
      line(0x849994,xx,yy-11,xx,yy+3,2);
    }
    rect(0x2b4249,-44,-1,94,3);
    rect(0x9baea3,-42,-2,90,1);
    // A visible flat landing joins the return corridor at floor level.
    rect(0x425b5e,38,-5,15,7);
    rect(0xb5b39a,39,-6,13,2);
  }
  // Center the main upstairs run left of its landing, leaving the
  // timetable/noticeboard clear rather than crossing it.
  if(side==='back')g.x=-22;
  body.add(g);
  const caption=scene.add.text(0,-63,options.returning?'MAIN GYM':
    kind==='outdoor'?'OUTSIDE':kind==='upstairs'?'UPSTAIRS':'DOWNSTAIRS',{
    fontFamily:'Arial',fontSize:'8px',color:'#f8e9ce',
    backgroundColor:'#28454a',padding:{x:3,y:2}
  }).setOrigin(.5).setVisible(false);
  body.add(caption);
  // Zones cover the actual art, not an unrelated on-floor invisible portal.
  // Keep passageways walkable/clickable nearby; the door's upper half and
  // stair treads are the hotspots, not the entire side corridor.
  const hit=kind==='outdoor'
    ?scene.add.zone(0,-28,54,55)
    :scene.add.zone(0,-26,90,55);
  hit.setInteractive({useHandCursor:true});
  hit.on('pointerover',()=>caption.setVisible(true));
  hit.on('pointerout',()=>caption.setVisible(false));
  hit.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,
    event:Phaser.Types.Input.EventData)=>{event.stopPropagation();onClick();});
  body.add(hit);
  return body;
}
