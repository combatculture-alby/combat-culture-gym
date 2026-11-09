import Phaser from 'phaser';

function bakeRoom(scene:Phaser.Scene,level:number):void {
  const g=scene.add.graphics();
  const rect=(color:number,x:number,y:number,w:number,h:number,alpha=1)=>g.fillStyle(color,alpha).fillRect(x,y,w,h);
  const brick=0x7b4c40, trim=0x3c3537, wood=0xc39160, pale=0xedce91;
  rect(0x233436,0,0,480,330);
  rect(brick,0,23,480,54);
  for(let y=24;y<75;y+=8){
    rect(0x4b3b3a,0,y,480,1,0.45);
    for(let x=(y%16)*2-16;x<480;x+=24){
      rect(0xac6d55,x+1,y+1,23,5,((x+y)%3===0)?0.37:0.19);
      rect(0x4b3b3a,x,y,1,8,0.45);
    }
  }
  rect(trim,0,72,480,7);
  rect(0xa87855,0,72,480,2);
  rect(0xa87550,0,79,480,145);
  for(let row=0;row<18;row++){
    const y=79+row*8;
    for(let col=-1;col<12;col++){
      const x=col*43+(row%3)*14;
      const tint=[0xb47d52,0xbf8b5d,0xc89864,0xc08b5b][Math.abs(col*7+row*3)%4];
      rect(tint,x+1,y,42,7);
      rect(0xe7b981,x+3,y,37,1,0.42);
      rect(0x845b43,x+5+Math.abs(col*row)%11,y+4,12,1,0.24);
      rect(0xe8b988,x+25,y+2,10,1,0.26);
    }
  }
  rect(0x533f3b,0,222,480,4);
  rect(0xd5a573,0,221,480,1);

  rect(0x2d3f43,25,76,300,141);
  rect(0xb5604e,28,76,294,138);
  rect(0x335b60,33,80,284,131);
  for(let y=81;y<211;y+=26)for(let x=34;x<317;x+=31){
    const w=Math.min(30,316-x);
    rect((x+y)%2===0?0x598780:0x507e79,x,y,w,25);
    rect(0x8ca99a,x+1,y+1,w-1,1,0.42);
    rect(0x285960,x+1,y+24,w-1,1,0.5);
    for(let i=0;i<4;i++) rect(0x9cb7a2,x+3+(i*7)%Math.max(1,w-4),y+4+(i*11+x)%17,1,1,0.24);
  }
  rect(0x72988a,37,84,276,2);
  rect(0x72988a,37,206,276,2);
  rect(0x72988a,37,86,2,120);
  rect(0x72988a,311,86,2,120);
  for(const x of [43,303])for(const y of [91,198]){
    rect(0xa7bda4,x,y,6,1);
    rect(0xa7bda4,x+2,y-2,1,5);
  }
  // A faded floor mark under the sparring area.
  g.lineStyle(2,0xc5c7a2,0.19).strokeCircle(175,145,25);
  g.lineStyle(1,0xc5c7a2,0.19).strokeCircle(175,145,21);
  rect(0xc5c7a2,161,141,28,9,0.15);

  const window=(x:number)=>{
    rect(trim,x,31,79,40);
    rect(wood,x+2,33,75,35);
    rect(0x668e98,x+5,36,69,29);
    rect(0x9bbab2,x+5,37,69,11);
    rect(0xe5c28a,x+8,41,15,2);
    for(let i=0;i<7;i++){
      const h=5+(i*11)%12;
      rect(0x577780,x+6+i*9,65-h,8,h);
      rect(0xe4b77f,x+9+i*9,65-h+3,2,2,0.62);
    }
    rect(pale,x+37,36,3,29);
    rect(pale,x+5,49,69,2);
    rect(0xb57c57,x-2,67,83,4);
    rect(pale,x-2,67,83,1);
    g.fillStyle(0xffd89c,0.10).fillPoints([
      {x:x+4,y:71},{x:x+72,y:71},{x:x+107,y:138},{x:x+37,y:138}
    ],true);
    g.fillStyle(0xffe4ac,0.10).fillPoints([
      {x:x+19,y:71},{x:x+26,y:71},{x:x+62,y:138},{x:x+56,y:138}
    ],true);
  };
  window(44);
  window(224);
  rect(trim,135,32,77,34);
  rect(0xa45a48,138,35,71,28);
  rect(pale,143,38,61,2);
  rect(pale,143,58,61,2);
  rect(trim,331,27,5,195);
  rect(0xad7b55,331,28,2,193);


  // Stage-specific architecture is baked into separate textures. The training board
  // and reception desk retain their click targets at every level.
  if(level<=2){
    const starter=level===1;
    const wall=starter?0x7b817d:0x526b67;
    const floor=starter?0x777777:0xa38a73;
    rect(floor,0,79,480,146);
    rect(wall,0,23,480,56);
    rect(starter?0x535b5b:0x354e50,0,72,480,7);
    // A residential roll-up garage door with visible segmented metal panels.
    rect(0x303e42,21,26,303,49);
    rect(starter?0x99a29c:0x94aaa1,25,29,295,42);
    for(let y=29;y<69;y+=8){
      rect(starter?0x78837f:0x6a918a,27,y,291,1);
      rect(0xf1efe2,29,y+2,285,1,0.25);
    }
    for(const x of [29,314])rect(0x384547,x,27,4,46);
    rect(0x283d40,170,30,5,40);
    rect(0x4b5754,31,79,295,4);
    // The garage starts with concrete, chalk lines and a single compact mat.
    for(let y=80;y<221;y+=21)for(let x=0;x<480;x+=44){
      rect(0x3d4141,x,y,40,1,0.13);
      rect(0xe8e1cd,x+3+(y%13),y+8,12,1,0.06);
    }
    const mx=starter?57:46,my=starter?94:86,mw=starter?240:260,mh=starter?106:121;
    rect(0x303d3d,mx-4,my-4,mw+8,mh+8);
    rect(starter?0x415e60:0x316b6a,mx,my,mw,mh);
    for(let y=my+7;y<my+mh;y+=20){
      rect(starter?0x587778:0x4b8581,mx+5,y,mw-10,1,0.32);
    }
    for(let x=mx+8;x<mx+mw;x+=22)rect(0xbed0b9,x,my+4,1,mh-8,0.12);
    rect(starter?0x87a18b:0xa8c7a4,mx+4,my+4,mw-8,2);
    rect(starter?0x87a18b:0xa8c7a4,mx+4,my+mh-6,mw-8,2);
    rect(starter?0x87a18b:0xa8c7a4,mx+4,my+6,2,mh-12);
    rect(starter?0x87a18b:0xa8c7a4,mx+mw-6,my+6,2,mh-12);
    // Home-gym clutter stays on the wall, not in the walkable training floor.
    rect(0x3c4e4e,3,91,19,86);
    for(let y=97;y<174;y+=13)rect(0xb89972,8,y,12,3);
    rect(0x454341,335,76,4,145);
    rect(0xb99674,337,78,2,141);
    rect(0xd5bb89,42,86,17,4);
    rect(0xc1a16a,48,81,4,13);
    rect(0x334545,25,197,30,6);
    rect(0x718b80,26,195,28,2);
    // Fluorescent strip and garage ceiling hardware.
    rect(0x364a4c,124,24,100,4);
    rect(0xffe8b6,141,25,66,2,0.85);
    if(!starter){
      rect(0x304d50,62,79,222,4);
      rect(0xcaa26d,75,81,196,2);
      rect(0x28484a,4,35,18,32);
      rect(0xcda96d,7,40,12,22);
      rect(0x37635c,10,43,6,16);
    }
  }else if(level>=4){
    const academy=level===5;
    // Renovated facility: premium wall panels and tournament-grade mat trims.
    rect(academy?0x253a43:0x41605e,0,23,480,12);
    rect(academy?0xd4ac61:0xb1bda2,0,35,480,2);
    rect(academy?0x1b3038:0x435a59,0,72,480,6);
    const accent=academy?0xd9b26d:0x8bc8b1;
    rect(accent,32,78,286,3);
    rect(accent,32,207,286,3);
    rect(accent,32,81,3,126);
    rect(accent,315,81,3,126);
    rect(academy?0x1c3f48:0x326767,41,88,266,4,0.38);
    rect(academy?0x1c3f48:0x326767,41,194,266,4,0.38);
    for(const x of [11,333,467]){
      rect(academy?0x0f222b:0x314c4e,x,31,8,40);
      rect(accent,x+1,35,6,2);
      rect(accent,x+1,64,6,2);
    }
    rect(academy?0x1d303b:0x344c50,136,37,75,26);
    rect(accent,140,38,67,2);
    rect(accent,140,58,67,2);
    if(academy){
      rect(0xd8b876,106,199,143,1,0.28);
      for(let x=56;x<301;x+=48)rect(0xffe7aa,x,190,2,5,0.32);
    }
  }

  g.generateTexture('gym-room-'+level,480,330);
  g.destroy();
}

export function drawGym(scene:Phaser.Scene,level=1):void {
  const key='gym-room-'+level;
  if(!scene.textures.exists(key))bakeRoom(scene,level);
  scene.add.image(0,0,key).setOrigin(0);
  const label=level===1?'COMBAT GARAGE':level===2?'NEIGHBORHOOD GYM':level===5?'COMBAT ACADEMY':'COMBAT CULTURE';
  scene.add.text(174,49,label,{fontFamily:'monospace',fontSize:'7px',fontStyle:'bold',color:'#f8ddb1'}).setOrigin(0.5);

  const trim=0x3c3537, wood=0xc39160, pale=0xedce91;
  // The bulletin board and counter stand in the room and occlude actors behind them.
  const board=scene.add.graphics().setDepth(10+120/100);
  board.fillStyle(0x3a2d32,0.24).fillEllipse(402,119,111,12);
  board.fillStyle(trim).fillRect(344,50,112,65);
  board.fillStyle(wood).fillRect(346,51,108,61);
  board.fillStyle(0xa87755).fillRect(350,55,100,53);
  board.fillStyle(0x395e5f).fillRect(356,59,88,13);
  for(let i=0;i<4;i++){
    const x=356+i*22,y=77+i%2*4;
    board.fillStyle([0xf3ddaa,0xc3d2af,0xe2ad7b,0xe4cba1][i]).fillRect(x,y,18,24-i%2*4);
    board.fillStyle(0x744a42).fillRect(x+7,y+1,3,2);
    for(let row=0;row<3;row++)board.fillStyle(0x6c6a57,0.7).fillRect(x+3,y+8+row*4,12-row*2,1);
  }
  board.fillStyle(trim).fillRect(352,113,5,9).fillRect(442,113,5,9);
  scene.add.text(400,65,'TRAINING BOARD',{fontFamily:'monospace',fontSize:'8px',fontStyle:'bold',color:'#f2dfb8'}).setOrigin(0.5).setDepth(11.21);

  const desk=scene.add.graphics().setDepth(10+220/100);
  desk.fillStyle(0x2c3132,0.24).fillEllipse(429,219,88,12);
  desk.fillStyle(trim).fillRect(388,181,82,39);
  desk.fillStyle(0x8d5b47).fillRect(392,194,74,23);
  desk.fillStyle(0x523e3d).fillRect(397,198,64,15);
  desk.fillStyle(0xad7655).fillRect(399,200,60,11);
  desk.fillStyle(0xd4a36d).fillRect(388,183,82,12);
  desk.fillStyle(pale).fillRect(389,183,80,2);
  desk.fillStyle(trim).fillRect(412,161,30,24).fillRect(424,182,7,6);
  desk.fillStyle(0x496f72).fillRect(415,164,24,16);
  desk.fillStyle(0xa6d5b4).fillRect(418,168,12,2).fillRect(418,173,17,1);
  desk.fillStyle(0x503d3b).fillRect(416,188,22,4);
  desk.fillStyle(0xf1d19c).fillRect(396,186,12,5);
  desk.fillStyle(0xae6450).fillRect(453,181,6,8);
  desk.fillStyle(0x765344).fillRect(454,181,4,2);
  scene.add.text(429,205,'RECEPTION',{fontFamily:'monospace',fontSize:'8px',fontStyle:'bold',color:'#f5d9aa'}).setOrigin(0.5).setDepth(12.21);
}
