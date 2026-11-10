import Phaser from 'phaser';
import type {RoomId} from './gymRooms';

type GatewayOptions={returning?:boolean;depth?:number};
/** Consistent physical exits: a framed garden door and navigable stair flights.
 * Art is in world coordinates and shares the 40px character sprite scale.
 */
export function makeRoomGateway(scene:Phaser.Scene,kind:RoomId,x:number,y:number,
  onClick:()=>void,options:GatewayOptions={}):Phaser.GameObjects.Container {
  const body=scene.add.container(x,y).setDepth(options.depth??25);
  const g=scene.add.graphics();
  const box=(c:number,x:number,y:number,w:number,h:number)=>g.fillStyle(c).fillRect(x,y,w,h);
  const rail=(c:number,x1:number,y1:number,x2:number,y2:number,w=2)=>
    g.lineStyle(w,c).lineBetween(x1,y1,x2,y2);
  const edge=0x1d343c,trim=0xc1a478,light=0xb5d1c4;
  g.fillStyle(0x101b23,.25).fillEllipse(0,2,45,12);
  if(kind==='outdoor'){
    // Framed exit with an unmistakable opening into the training yard.
    box(edge,-21,-43,42,44);box(trim,-19,-42,38,40);
    box(0x294e53,-16,-39,32,35);
    box(0x9dced2,-13,-37,26,23);
    box(0x81b48c,-13,-19,26,15);
    box(0x5c8973,-12,-17,24,8);
    for(let i=0;i<3;i++)box(0x3e685e,-11+i*9,-22,2,19);
    box(0xd4c49e,-1,-40,2,37);
    box(0x28494c,-18,-3,37,5);
    box(0xaac5b4,-15,-2,31,2);
    g.fillStyle(light).fillCircle(11,-11,2);
  }else{
    // The landing, visible individual treads and handrail form real stairs,
    // not the colored navigation cards used by the early prototype.
    box(edge,-24,-8,48,11);
    for(let i=0;i<5;i++){
      const h=5;
      const y0=-34+i*6;
      const width=26+i*4;
      box(0x324950,-width/2,y0,width,h+3);
      box(i%2?0x8b725b:0x9e8669,-width/2+2,y0+1,width-4,h);
      box(0xd4ba89,-width/2+2,y0+1,width-4,2);
    }
    const left=kind==='upstairs';
    rail(edge,left?-24:-24,-5,left?-13:-17,-35,4);
    rail(trim,left?-24:-24,-6,left?-13:-17,-36,2);
    rail(edge,24,-5,14,-35,4);rail(trim,24,-6,14,-36,2);
    for(let i=0;i<3;i++)rail(0xd7c093,-19+i*3,-9-i*9,-18+i*3,-13-i*9,2);
    box(edge,-24,-5,48,5);
    if(kind==='downstairs'){
      box(0x223940,-13,-31,25,5);
      box(0x58666a,-11,-30,21,2);
    }
  }
  body.add(g);
  const plaque=options.returning?'GYM':kind==='outdoor'?'YARD':kind==='upstairs'?'2F':'B1';
  const label=scene.add.text(0,-46,plaque,{
    fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#f7e6c7',
    backgroundColor:'#304b4c',padding:{x:3,y:1}
  }).setOrigin(.5);
  body.add(label);
  // Entire architectural shape is a touch target, not a separate UI button.
  const hit=scene.add.zone(0,-20,46,49).setInteractive({useHandCursor:true});
  hit.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,
    event:Phaser.Types.Input.EventData)=>{event.stopPropagation();onClick();});
  body.add(hit);
  return body;
}
