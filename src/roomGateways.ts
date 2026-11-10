import Phaser from 'phaser';
import type {RoomId} from './gymRooms';

type GatewayOptions={returning?:boolean;depth?:number};
/** Wall-anchored pixel architecture. Door/stair width is ~2 coach sprites,
 * and the clickable zone is independent of the rendered geometry. */
export function makeRoomGateway(scene:Phaser.Scene,kind:RoomId,x:number,y:number,
  onClick:()=>void,options:GatewayOptions={}):Phaser.GameObjects.Container {
  const body=scene.add.container(x,y).setDepth(options.depth??20);
  const g=scene.add.graphics();
  const px=(c:number,x:number,y:number,w:number,h:number)=>g.fillStyle(c).fillRect(x,y,w,h);
  const line=(c:number,x1:number,y1:number,x2:number,y2:number,w=2)=>
    g.lineStyle(w,c).lineBetween(x1,y1,x2,y2);
  const dark=0x223940,wall=0x4d696b,stone=0x9c9481,wood=0xab8b61;
  // Shared contact shadow / step at walkable floor height.
  g.fillStyle(0x101f26,.3).fillEllipse(0,1,38,7);
  if(kind==='outdoor'){
    // Recessed glass gym door, attached wall jambs and a short paved step.
    px(dark,-17,-43,34,44);
    px(stone,-19,-44,4,46);px(stone,15,-44,4,46);
    px(0xcbb68e,-18,-45,36,3);
    px(0x2f5359,-13,-40,26,37);
    px(0x92b8b5,-11,-38,22,22);
    px(0x618e79,-11,-20,22,17);
    for(const railX of [-7,0,7])px(0x395f53,railX,-17,2,13);
    px(0xcbb68e,-1,-39,2,34);
    px(0x233a41,-17,-4,34,4);px(0x9bada4,-14,-3,29,2);
    px(0xe2cca2,8,-14,2,3);
  }else{
    // Stairwell is rooted in a wall opening; the flight is small enough
    // for 40px characters and visibly connects to the floor.
    px(dark,-18,-42,36,42);
    px(wall,-15,-39,30,34);
    px(0x263e45,-12,-38,24,24);
    // Rising vs descending tread lighting makes direction unmistakable.
    for(let n=0;n<5;n++){
      const width=20+n*3,yTop=-26+n*5;
      px(0x30474d,-width/2,yTop,width,7);
      px(kind==='upstairs'?0xb39b76:0x817968,-width/2+1,yTop+2,width-2,4);
      px(kind==='upstairs'?0xd9bd8b:0xa7ad9b,-width/2+2,yTop+2,width-4,1);
    }
    line(stone,-19,-1,-13,-28,3);
    line(stone,19,-1,13,-28,3);
    px(0x2f4b50,-20,-3,40,4);
    px(0x9caeaa,-17,-2,34,1);
    // Above-door direction indicator is integrated in the lintel.
    px(wood,-9,-42,18,7);
    px(dark,-7,-40,14,3);
    if(kind==='upstairs'){
      px(0xe0cd9d,-1,-40,2,3);
      px(0xe0cd9d,-3,-40,2,1);px(0xe0cd9d,1,-40,2,1);
    }else{
      px(0xe0cd9d,-1,-40,2,3);
      px(0xe0cd9d,-3,-38,2,1);px(0xe0cd9d,1,-38,2,1);
    }
  }
  body.add(g);
  // No floating text plaques. Identification is revealed on hover/focus only.
  const name=options.returning?'MAIN GYM':kind==='outdoor'?'YARD':kind==='upstairs'?'UPSTAIRS':'DOWNSTAIRS';
  const caption=scene.add.text(0,-50,name,{
    fontFamily:'Arial',fontSize:'8px',color:'#f8e9ce',
    backgroundColor:'#28454a',padding:{x:3,y:2}
  }).setOrigin(.5).setVisible(false);
  body.add(caption);
  const hit=scene.add.zone(0,-22,44,49).setInteractive({useHandCursor:true});
  hit.on('pointerover',()=>caption.setVisible(true));
  hit.on('pointerout',()=>caption.setVisible(false));
  hit.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,
    event:Phaser.Types.Input.EventData)=>{event.stopPropagation();onClick();});
  body.add(hit);
  return body;
}
