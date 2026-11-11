import Phaser from 'phaser';
import type {HubService} from './hubServiceLayout';

/** Hand-authored pixel props; all coordinates are relative to the object.
 * Their clickable hit areas are provided separately by the hub scene. */
export function paintHubFixture(
  g:Phaser.GameObjects.Graphics,
  type:HubService,level:number,urgent=false
):void {
  g.clear();
  const tier=Math.max(1,Math.min(5,Math.floor(level)));
  const px=(color:number,x:number,y:number,w:number,h:number,alpha=1)=>
    g.fillStyle(color,alpha).fillRect(x,y,w,h);
  const outline=0x26373e,metal=tier>=4?0x9cbabb:0x667b7d;
  if(type==='phone'){
    // Actual phone sitting on the reception counter; not a wall sign.
    // Desk-sized phone. The larger invisible touch area remains unchanged.
    px(0x182a30,-8,5,17,2,.24);
    if(tier<=2){
      px(outline,-10,-2,21,9);
      px(tier===1?0x535853:0x54747c,-8,0,17,5);
      px(0x202a30,-9,-6,19,4);
      px(0x8b9993,-7,-5,15,1);
      for(const x of [-5,0,5])px(0xd8ccb2,x,2,3,2);
    }else{
      px(outline,-10,-4,21,11);
      px(tier===5?0x243b46:0x536c71,-8,-2,17,7);
      px(0x122b35,-3,-1,11,4);
      px(urgent?0xffd078:0x70aab1,-1,0,7,2);
      px(tier===5?0xd7b479:0xc1bdb2,-9,-8,19,4);
      px(outline,-7,-7,15,1);
      for(let n=0;n<3;n++)px(0xb6c6bd,-6+n*4,4,2,1);
    }
    px(outline,-10,-9,4,4);px(outline,7,-9,4,4);
    px(urgent?0xe4a64b:0x70a6aa,8,1,2,2);
    if(urgent){
      g.lineStyle(1,0xf8c774,.9);
      g.lineBetween(-12,-10,-15,-13);g.lineBetween(13,-10,16,-13);
      g.lineBetween(-12,-2,-16,-2);g.lineBetween(13,-2,17,-2);
    }
    return;
  }
  if(type==='water'){
    // Slim cooler silhouette; the invisible interaction zone stays generous.
    px(0x142c32,-11,20,22,4,.18);
    if(tier===1){
      // Budget jug on a narrow plastic stand and drip tray.
      px(0x42575b,-10,-4,20,23);
      px(0x748d8b,-8,0,16,15);
      px(0xa3d2d6,-8,-29,16,25);
      px(0xd8eff0,-5,-27,5,18,.75);
      px(0x6c9fa4,-7,-13,14,3);
      px(0x1c3840,-5,17,10,3);px(0xd7ded4,-3,13,6,2);
    }else if(tier===2){
      px(outline,-12,-11,24,31);
      px(0xc8c5b1,-10,-9,20,27);
      px(0xa2d3df,-9,-28,18,20);
      px(0xdfedf0,-5,-26,4,16,.8);
      px(metal,-8,9,16,5);px(0x1f5058,-3,8,6,4);
      px(0x88a3a0,-10,17,20,3);
    }else if(tier===3){
      // The original gym gets a conventional electric cooler.
      px(outline,-13,-25,26,47);
      px(0xcfd7d2,-11,-23,22,44);
      px(0x77a6a8,-9,-20,18,10);
      px(0x344e58,-8,-5,16,12);
      px(0xc3dfe0,-4,-3,8,3);
      px(0x6aa4b8,-5,8,4,4);px(0xd36b61,2,8,4,4);
      px(0x758b8a,-10,19,20,3);
    }else{
      // Professional chilled hydration system, with digital display.
      px(outline,-14,-29,28,52);
      px(tier===5?0xb5bbb5:0x8ea4a6,-12,-27,24,48);
      px(0x203d46,-10,-21,20,11);
      px(urgent?0xda9952:0x79c5bf,-7,-18,14,3);
      px(tier===5?0xe0c58d:0x8cc0c0,-9,-5,18,2);
      px(0x274d54,-8,0,16,13);
      px(0x97dce0,-4,2,8,2);px(0xd3e0d6,-1,5,2,7);
      px(0x677c7b,-12,19,24,3);
      if(tier===5)px(0xd1af73,-12,-29,24,2);
    }
    return;
  }
  if(type==='stock'){
    px(0x13282d,-17,24,35,3,.25);
    if(tier===1){
      // Exposed garage shelves, visible boxes and rolled towels.
      px(0x624d3d,-15,-24,30,48);
      for(const y of [-19,-5,10,20])px(0xb08b66,-13,y,26,3);
      px(0x806a50,-11,-17,12,9);px(0xc7a176,1,-17,9,9);
      px(0xc8c4ad,-11,-2,18,5);px(0xefdebd,-10,-1,15,2);
      px(0x688991,-8,13,8,6);px(0x9ab6ad,2,13,7,6);
      px(0x283e42,-13,-26,26,3);
    }else if(tier===2){
      px(outline,-17,-26,34,52);
      px(0x788889,-15,-24,30,48);
      px(0x4c676d,-13,-21,26,17);
      px(0x839c9c,-13,-1,26,24);
      px(0xc3d5cd,1,-17,2,8);
      px(0x34535b,-1,7,3,10);
      for(const y of [-21,-16,-11])px(0xacc6c0,-11,y,20,1,.55);
    }else if(tier===3){
      // Full-height janitor / supply closet with two doors.
      px(outline,-18,-27,36,54);
      px(0xa88664,-16,-25,32,49);
      px(0x735744,-14,-23,13,45);
      px(0x7c604c,2,-23,13,45);
      px(0xd2ae7c,-11,-22,9,1);
      px(0xd2ae7c,4,-22,9,1);
      px(0xe0c58e,-4,0,2,7);px(0xe0c58e,3,0,2,7);
      px(0x4e4034,-17,23,34,3);
    }else{
      // Premium built-in cabinets, no loose cardboard in the flagship.
      px(outline,-18,-28,36,55);
      px(tier===5?0x52615c:0x778e91,-16,-26,32,51);
      px(0x233e45,-13,-23,26,17);
      px(tier===5?0x8faeab:0x93b5b6,-11,-21,22,13);
      px(tier===5?0xe7ca8a:0xb7d1cd,-11,-23,22,2);
      px(0xb8c8bf,-14,-3,13,25);
      px(0x9aacac,1,-3,13,25);
      px(0x4b7778,-4,5,2,10);px(0x4b7778,3,5,2,10);
      px(tier===5?0xd7b676:metal,-18,-28,36,3);
      px(0x3e5a60,-15,24,30,3);
    }
    if(urgent)px(0xe8b768,10,-24,4,4);
    return;
  }
  // Mop and bucket are distinct objects: angled wooden shaft and pale cotton head.
  px(0x183037,-15,20,31,3,.3);
  g.lineStyle(3,0xe4cb93).lineBetween(4,-33,-8,12);
  g.lineStyle(1,0x8b704b).lineBetween(6,-33,-6,10);
  px(0x335d65,2,-36,6,5);
  px(0xe8e0c9,-15,9,15,4);
  for(let i=0;i<5;i++)px(i%2?0xe5d7b6:0xf5e8cb,-15+i*3,12,2,10);
  if(tier===1){
    px(0x253c47,-12,4,21,15);
    px(0xe1b54f,-10,6,17,11);
    px(0xc2ae7e,-10,7,16,2);
    px(0x8b9ea2,-7,16,12,2);
  }else if(tier===2||tier===3){
    px(outline,-14,3,25,18);
    px(tier===2?0xd6ad48:0xe0bd5c,-12,5,21,14);
    px(0xbad5d7,-10,7,17,3);
    px(0x3c656c,-12,17,21,3);
    if(tier===3){px(0x2b363c,-11,21,5,4);px(0x2b363c,5,21,5,4);}
  }else{
    // Commercial cleaning cart and wheeled bucket.
    px(outline,-15,1,29,22);
    px(tier===5?0xbca990:0x8ba9ac,-13,3,25,18);
    px(0x284d55,-11,7,21,9);
    px(0xc6e2df,-8,9,15,3);
    px(tier===5?0xdbb879:0x8daeb6,-14,0,28,3);
    for(const x of [-10,7])px(0x222f36,x,21,5,5);
    px(0x5a8c88,-10,-7,6,7);px(0x97c8bd,-6,-5,3,4);
  }
  if(urgent)px(0xf1c16e,-13,-3,3,4);
}
