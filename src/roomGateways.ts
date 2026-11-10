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
  const ascending=options.returning?kind==='downstairs':kind==='upstairs';
  // Each entrance is inset into structural masonry and meets the floor;
  // no freestanding portal frame or always-visible UI plaque.
  g.fillStyle(0x101f26,.26).fillEllipse(0,3,45,10);
  px(0x263f44,-25,-47,50,47);
  px(0x77908a,-24,-46,48,2);
  px(0x5a7774,-25,-44,5,43);
  px(0x5a7774,20,-44,5,43);
  for(const y of [-35,-24,-13]){
    px(0x9caf9f,-25,y,5,2,.5);px(0x9caf9f,20,y,5,2,.5);
  }
  if(kind==='outdoor'){
    // Recessed glass gym door, attached wall jambs and a short paved step.
    px(0x1b353d,-19,-45,38,46);
    px(dark,-17,-43,34,44);
    px(stone,-19,-44,4,46);px(stone,15,-44,4,46);
    px(0xcbb68e,-21,-46,42,3);
    px(0x405f5c,-20,-49,40,3);
    px(0x2f5359,-13,-40,26,37);
    px(0x92b8b5,-11,-38,22,22);
    px(0x618e79,-11,-20,22,17);
    for(const railX of [-7,0,7])px(0x395f53,railX,-17,2,13);
    px(0xcbb68e,-1,-39,2,34);
    px(0x233a41,-20,-4,40,4);px(0x9bada4,-17,-3,34,2);
    px(0x7b9c8f,-24,1,48,3);
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
      px(ascending?0xb39b76:0x817968,-width/2+1,yTop+2,width-2,4);
      px(ascending?0xd9bd8b:0xa7ad9b,-width/2+2,yTop+2,width-4,1);
    }
    line(stone,-22,-1,-15,-36,3);
    line(stone,22,-1,15,-36,3);
    line(0xd3bf99,-21,-1,-14,-35,1);
    line(0xd3bf99,21,-1,14,-35,1);
    px(0x2f4b50,-20,-3,40,4);
    px(0x9caeaa,-17,-2,34,1);
    // Above-door direction indicator is integrated in the lintel.
    px(wood,-9,-42,18,7);
    px(dark,-7,-40,14,3);
    if(ascending){
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
