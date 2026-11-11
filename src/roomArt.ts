import Phaser from 'phaser';
import type {RoomFixture} from './roomItems';
import {footprint,itemLabel} from './roomItems';
import {HUB_ART_KEY,HUB_LEVEL2_ART_KEY,hasHubArt,hasLevel2HubArt} from './hubArt';

/** One pixel-art scale across equipment and 40px character sprites.
 * The feet/ground contact is always local 0,0.
 */
export function paintRoomFixture(g:Phaser.GameObjects.Graphics,item:RoomFixture):void {
  const rect=(color:number,x:number,y:number,w:number,h:number)=>g.fillStyle(color).fillRect(x,y,w,h);
  const line=(color:number,x1:number,y1:number,x2:number,y2:number,width=2)=>g.lineStyle(width,color).lineBetween(x1,y1,x2,y2);
  const ring=(x:number,y:number,r:number,color:number,width=2)=>g.lineStyle(width,color).strokeCircle(x,y,r);
  const body=0x4a5a5c,edge=0x283e44,metal=0xc3c9b9,red=0xa35049,gold=0xc9ab73,wood=0x987450;
  const fp=footprint(item);
  g.fillStyle(0x112d34,.28).fillEllipse(0,3,Math.max(14,fp.rx*2+5),Math.max(6,fp.ry*.65));
  if(item.kind==='gear'){
    switch(item.index){
      case 0: // hanging bag: chain, dark rim, red pad and stitch
        line(metal,0,-43,0,-34,2);
        rect(edge,-9,-36,18,36);rect(red,-7,-33,14,30);
        rect(0xce8064,-6,-29,2,21);rect(0x7a3b3c,5,-29,2,21);
        rect(gold,-8,-32,16,3);rect(edge,-8,-6,16,4);break;
      case 1: // pair of curved thai pads
        rect(edge,-16,-17,14,23);rect(edge,2,-17,14,23);
        g.fillStyle(0xc28755).fillRoundedRect(-14,-16,10,20,3);
        g.fillStyle(0xc28755).fillRoundedRect(4,-16,10,20,3);
        rect(0xf0cc9d,-12,-14,6,3);rect(0xf0cc9d,6,-14,6,3);
        rect(0x5d4442,-13,-2,8,3);rect(0x5d4442,5,-2,8,3);break;
      case 2: // speed bag: column, swivel, pear leather
        rect(metal,-1,-37,2,23);rect(edge,-12,-37,24,4);
        rect(gold,-2,-28,4,5);g.fillStyle(red).fillEllipse(0,-17,13,16);
        rect(0xc67a61,-2,-24,4,11);rect(body,-6,-4,12,5);break;
      case 3: // rope and gripped handles
        g.lineStyle(2,0xe2c58f).strokeEllipse(0,-10,28,25);
        rect(edge,-16,-12,5,13);rect(edge,11,-12,5,13);
        rect(red,-16,-11,5,8);rect(red,11,-11,5,8);break;
      case 4: // bench with barbell
        rect(edge,-17,-19,34,5);rect(0x9f5a4a,-15,-21,30,5);
        line(metal,-12,-16,-14,-1,3);line(metal,12,-16,14,-1,3);
        line(metal,-24,-30,24,-30,2);
        rect(edge,-24,-36,5,13);rect(edge,19,-36,5,13);
        rect(metal,-21,-37,3,15);rect(metal,18,-37,3,15);break;
      case 5: // three correctly sized kettlebells
        for(const [x,y,r] of [[-13,-2,6],[0,0,8],[15,-1,7]]){
          ring(x,y-r-1,r-3,metal,3);
          g.fillStyle(x<0?0x657d83:x>0?red:0x465b60).fillCircle(x,y-r/2,r);
          g.fillStyle(0xc2b8a0,.28).fillCircle(x-2,y-r/2-2,2);
        }break;
      case 6: // treadmill with angled console and running deck
        rect(edge,-19,-6,38,8);rect(0x596a70,-16,-6,32,5);
        line(metal,12,-6,13,-29,3);line(metal,-12,-6,-9,-26,3);
        rect(edge,-11,-31,26,10);rect(0x90bcc0,-7,-29,19,5);
        rect(gold,-9,-3,19,2);break;
      case 7: // assault bike with fan, pedals and handle bars
        g.fillStyle(edge).fillCircle(-11,-8,12);
        ring(-11,-8,10,metal,2);
        for(let i=0;i<6;i++){
          const a=i*Math.PI/3;line(0x8da6a5,-11,-8,-11+Math.cos(a)*9,-8+Math.sin(a)*9,2);
        }
        g.fillStyle(gold).fillCircle(16,-5,5);
        line(metal,-3,-13,13,-20,3);line(metal,13,-20,20,-20,3);
        line(metal,7,-9,15,-2,2);line(metal,17,-8,11,0,2);
        rect(red,-1,-23,14,4);break;
      default: rect(body,-9,-17,18,17);
    }
  }else if(item.kind==='furniture'){
    const side=item.rotation%2===1;
    switch(item.typeId??item.index){
      case 0: // compact floor lamp, not a giant service prop
        rect(edge,-2,-26,4,28);rect(gold,-6,-4,12,4);
        rect(0xe9c68e,-9,-34,18,10);rect(0xf5d79c,-7,-32,14,6);break;
      case 1:
        rect(edge,side?-10:-24,-14,side?20:48,6);
        rect(wood,side?-9:-22,-15,side?18:44,5);
        line(edge,side?-7:-18,-9,side?-7:-18,2,3);
        line(edge,side?7:18,-9,side?7:18,2,3);break;
      case 2:
        rect(edge,side?-12:-19,-35,side?24:38,36);
        rect(wood,side?-10:-17,-33,side?20:34,31);
        for(const y of [-27,-16,-5]){
          rect(0x2c484c,side?-7:-14,y,side?14:28,7);
          g.fillStyle(gold).fillCircle(-5,y+3,2);g.fillStyle(gold).fillCircle(6,y+3,2);
        }break;
      case 3:
        rect(edge,-10,-25,20,25);rect(0xb5d3d3,-9,-25,18,16);
        rect(0x80b1b7,-6,-22,12,10);rect(metal,-8,-10,16,12);
        rect(0x4d8191,-4,-7,8,3);rect(red,3,-6,2,2);break;
      case 4:
        rect(edge,-5,-34,10,34);
        g.fillStyle(0xc99a78).fillCircle(0,-31,8);
        rect(0xc99a78,-11,-24,22,4);rect(0xa8735c,-6,-25,12,21);
        rect(edge,-9,0,18,4);break;
      default: rect(body,-10,-20,20,19);
    }
  }else if((item.typeId??item.index)===2){
    // Potted plant at human knee height, in a visible, grounded clay planter.
    rect(edge,-9,-10,18,10);rect(0xad7955,-7,-10,14,9);
    rect(gold,-9,-11,18,3);rect(edge,-6,-1,12,2);
    for(const [x,y,r] of [[-8,-20,6],[0,-25,8],[8,-19,6]]){
      g.fillStyle(x<0?0x4b7759:x>0?0x709b6a:0x568363).fillCircle(x,y,r);
    }
    rect(0x9dc69a,-2,-27,3,3);rect(0x9dc69a,6,-23,2,2);
  }else{
    // Posters and banners travel with the gym's shared inventory. They
    // need a physical display frame rather than a floating floor rectangle.
    const banner=(item.typeId??item.index)===0;
    const c=banner?red:0xc6ae82;
    rect(edge,-22,-39,44,28);rect(gold,-20,-37,40,25);
    rect(c,-18,-35,36,21);
    rect(edge,-23,-39,2,28);rect(edge,21,-39,2,28);
    rect(gold,-15,-29,30,3);rect(gold,-12,-23,24,2);
    rect(metal,-17,-11,3,12);rect(metal,14,-11,3,12);
    rect(edge,-23,0,46,3);
  }
}
export function makeRoomFixture(scene:Phaser.Scene,item:RoomFixture,onClick:()=>void):Phaser.GameObjects.Container {
  // Use the same authored equipment atlases in every room, not the old
  // procedural substitutes. Unillustrated equipment keeps a fallback.
  const artwork:Record<number,{key:string;frame:string;w:number;h:number}>= {
    0:{key:HUB_ART_KEY,frame:'heavy-bag',w:28,h:45},
    1:{key:HUB_LEVEL2_ART_KEY,frame:'thai-pads',w:34,h:34},
    2:{key:HUB_ART_KEY,frame:'speed-bag',w:23,h:42},
    3:{key:HUB_LEVEL2_ART_KEY,frame:'jump-rope',w:29,h:24},
    4:{key:HUB_ART_KEY,frame:'weight-bench',w:40,h:36},
    5:{key:HUB_ART_KEY,frame:'kettlebell-rack',w:42,h:30}
  };
  const art=item.kind==='gear'?artwork[item.index]:undefined;
  const available=art&&((art.key===HUB_ART_KEY&&hasHubArt(scene))||
    (art.key===HUB_LEVEL2_ART_KEY&&hasLevel2HubArt(scene)));
  const visual=available
    ?scene.add.image(0,0,art.key,art.frame).setOrigin(.5,1).setDisplaySize(art.w,art.h)
    :scene.add.graphics();
  if(visual instanceof Phaser.GameObjects.Graphics)paintRoomFixture(visual,item);
  const display=scene.add.container(item.x,item.y,[visual]);
  display.setDepth(10+item.y/100);
  const fp=footprint(item);
  const hit=scene.add.zone(0,-20,Math.max(30,fp.rx*2+8),item.kind==='decor'?52:45)
    .setInteractive({useHandCursor:true});
  display.add(hit);
  hit.on('pointerdown',onClick);
  const name=scene.add.text(0,-47,itemLabel(item).toUpperCase(),{
    fontFamily:'Arial',fontSize:'8px',color:'#f5e8c5',
    backgroundColor:'#263e44',padding:{x:3,y:2}
  }).setOrigin(.5).setVisible(false);
  display.add(name);
  hit.on('pointerover',()=>name.setVisible(true));
  hit.on('pointerout',()=>name.setVisible(false));
  return display;
}
