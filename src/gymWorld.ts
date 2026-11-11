import Phaser from 'phaser';
import {normalizeGymLevel,trainingBounds,equipmentPlacementZone,gymServiceLayout} from './gymProgression';
import {hasHubArt,placeHubArt,approvedRoomKey} from './hubArt';

// All art is drawn into Phaser textures so it ships without external image assets.
// The floor plan expands within the 480px stage; mat, navigation and placement
// must all use the same per-level bounds.
const THEMES=[
  {wall:0x737d79,mortar:0x56625e,floor:0x7d7f7c,floorLine:0x515957,
   mat:0x425e61,tile:0x506f71,edge:0x94a69a,accent:0xe2c391,ink:0x2a4245},
  {wall:0x56736d,mortar:0x345951,floor:0xa08368,floorLine:0x80694f,
   mat:0x326969,tile:0x46837d,edge:0xb7c9a8,accent:0xd7ad74,ink:0x294c4e},
  {wall:0x6c413b,mortar:0x442f31,floor:0x906d60,floorLine:0x674b41,
   mat:0x3b5559,tile:0x47656a,edge:0xc57a60,accent:0xf0bd82,ink:0x273c43},
  {wall:0x3b555a,mortar:0x263e46,floor:0x758c88,floorLine:0x546f6c,
   mat:0x264e62,tile:0x346a76,edge:0x8fc6be,accent:0xdec39a,ink:0x1c3a48},
  {wall:0x263c4b,mortar:0x1b303c,floor:0x597b7d,floorLine:0x3c5b60,
   mat:0x193d50,tile:0x265669,edge:0xe0b875,accent:0xffdf95,ink:0x142e3c},
] as const;

function bakeRoom(scene:Phaser.Scene,requestedLevel:number):void {
  const level=normalizeGymLevel(requestedLevel),theme=THEMES[level-1];
  const g=scene.add.graphics();
  // Every tier now draws the mat from the same placement bounds.
  // The original oversized Level 3 art is retired because it no longer
  // matches the Level 2-sized main floor once extra rooms are unlocked.
  const rect=(color:number,x:number,y:number,w:number,h:number,alpha=1)=>
    g.fillStyle(color,alpha).fillRect(x,y,w,h);
  const line=(color:number,x1:number,y1:number,x2:number,y2:number,alpha=1,width=1)=>{
    g.lineStyle(width,color,alpha).lineBetween(x1,y1,x2,y2);
  };
  const border=(color:number,x:number,y:number,w:number,h:number,weight=2)=>{
    rect(color,x,y,w,weight);rect(color,x,y+h-weight,w,weight);
    rect(color,x,y+weight,weight,h-weight*2);rect(color,x+w-weight,y+weight,weight,h-weight*2);
  };
  const labelBar=(x:number,y:number,width:number,color=theme.accent)=>{
    rect(theme.ink,x,y,width,3);rect(color,x+3,y+1,width-6,1,0.6);
  };

  // Shared perspective: walkable 75–215px, a board in the right-hand
  // alcove, and reception in the lower-right. Decorative art is flat, not
  // physical furniture; it must never obstruct pathfinding.
  rect(0x233436,0,0,480,330);
  rect(theme.floor,0,77,480,149);
  rect(theme.wall,0,23,480,54);
  for(let y=23;y<74;y+=9){
    rect(theme.mortar,0,y,480,1,0.42);
    for(let x=-12+(y%3)*8;x<480;x+=26){
      rect(theme.mortar,x,y+1,1,8,0.25);
      rect(0xffffff,x+2,y+2,20,2,0.045);
    }
  }
  rect(theme.mortar,0,72,480,6);
  rect(theme.accent,0,76,480,2,0.52);
  for(let y=79;y<225;y+=24){
    rect(theme.floorLine,0,y,480,1,0.35);
    for(let x=((y/24|0)%2)*23;x<480;x+=46){
      rect(theme.floorLine,x,y+1,1,23,0.25);
      rect(0xffffff,x+3,y+3,21,1,0.045);
    }
  }
  rect(theme.ink,0,224,480,3);
  rect(theme.accent,0,222,480,2,0.45);

  // The right alcove and entry corridor remain accessible at every tier.
  rect(theme.mortar,329,26,7,198);
  rect(theme.accent,332,26,2,196,0.56);
  rect(theme.ink,337,119,42,3,0.52);
  rect(theme.floorLine,342,126,36,91,0.24);
  rect(theme.accent,346,123,26,1,0.35);
  rect(theme.accent,346,213,26,1,0.35);
  // Square floor drains and directional tiles; neither is a collision.
  for(const x of [24,354]){
    rect(theme.ink,x,202,12,8,0.4);
    for(let i=0;i<3;i++)rect(theme.accent,x+2+i*3,204,1,4,0.33);
  }

  if(level===1){
    // Residential garage: concrete, a corrugated roll-up door, pegboard,
    // unpainted columns, exposed strip light, and a short home-training mat.
    // Compact single-car bay, not the full-sized original roll-up.
    rect(0x303c3d,43,25,249,49);
    rect(0x9fa8a0,59,29,223,42);
    for(let y=29;y<71;y+=8){
      rect(0x778781,61,y,218,2);
      rect(0xf6f0df,64,y+3,213,1,0.31);
      rect(0x57655f,64,y+7,213,1,0.28);
    }
    for(const x of [57,280])rect(0x35484b,x,27,4,46);
    rect(0x425659,169,29,4,41);
    rect(0x2e4246,105,25,111,5);
    rect(0xffefd2,127,27,68,2,0.92);
    rect(0xffffff,127,30,68,5,0.06);
    rect(0x26383d,0,79,44,145);
    rect(0x6c7772,39,79,7,143);
    rect(0x37484a,45,92,19,86);
    for(let y=90;y<177;y+=14){
      rect(0x9a866d,48,y,14,3);
      rect(0x677269,49,y-4,8,4);
    }
    rect(0x5c6059,303,90,18,64);
    for(let y=94;y<150;y+=7)for(let x=306;x<320;x+=5)
      rect(0xe5c18c,x,y,1,1,0.34);
    rect(0x3a4e51,0,209,45,15);
    rect(0xc4ad86,0,211,40,2,0.42);
    rect(0x25353a,463,80,17,144);
    // Hairline concrete cracks outside the mat.
    line(0x495351,24,190,37,183,0.48);
    line(0x495351,37,183,43,191,0.48);
    line(0x495351,302,186,317,180,0.36);
  }else{
    // Commercial facilities gain broad windows, a full fascia and brighter
    // light fixtures. Each tier changes materials and facade detailing.
    const viewWindow=(x:number,glass:number)=>{
      rect(theme.ink,x-3,28,83,43);
      rect(theme.accent,x-1,29,79,2,0.62);
      rect(glass,x,32,75,34);
      rect(0xb3d5ce,x+2,34,71,10,0.25);
      for(let j=0;j<8;j++){
        const height=7+(j*13+level*7)%14;
        rect(theme.mortar,x+3+j*9,66-height,7,height,0.55);
        rect(theme.accent,x+5+j*9,66-height+3,1,2,0.45);
      }
      rect(theme.accent,x+36,32,2,34,0.8);
      rect(theme.accent,x,48,75,2,0.7);
      rect(theme.ink,x-4,66,84,4);
      rect(theme.accent,x-2,66,80,1,0.68);
    };
    if(level<=4){
      viewWindow(43,level===2?0x789b9c:level===3?0x9b8170:0x63959e);
      viewWindow(233,level===2?0x789b9c:level===3?0x9b8170:0x63959e);
    }
    rect(theme.ink,131,31,97,35);
    border(theme.accent,133,33,93,31,1);
    labelBar(144,38,71);
    labelBar(144,60,71);
    for(const x of [10,328,469]){
      rect(theme.ink,x,30,8,42);
      rect(theme.accent,x+2,34,4,2,0.78);
      rect(theme.accent,x+2,64,4,2,0.78);
    }
    if(level===2){
      // Neighborhood club: painted masonry, notice posters and warm wood.
      rect(0x3c635e,2,90,23,80);
      for(let y=96;y<162;y+=17){
        rect(0xe6c48d,5,y,17,12);
        rect(0xb0725c,8,y+3,12,2);
        rect(0x557976,8,y+7,9,2);
      }
      rect(0x9a7251,309,92,14,46);
      rect(0xd3ac79,311,94,10,2);
      rect(0x576c56,312,99,8,34);
      rect(0xb2c5a2,314,102,4,5,0.45);
    }else if(level===3){
      // Fight gym: red corner styling, competition posters and wall trophies.
      rect(0x652d32,0,78,29,98);
      for(let y=83;y<174;y+=19){
        rect(0xcba16e,3,y,22,16);
        rect(0x512f36,5,y+3,18,2);
        rect(0x854947,6,y+7,15,5);
      }
      rect(0xd18e6b,303,77,21,85,0.3);
      for(const y of [86,116,146]){
        rect(0x1d353b,310,y,11,13);
        rect(0xe7bc86,312,y+2,7,3);
        rect(0xc17858,314,y+6,3,5);
      }
    }else if(level===4){
      // Pro-level facility: LED wall strips and disciplined training zones.
      rect(0x203d48,0,79,28,112);
      for(let y=91;y<185;y+=16)rect(0x80cbbd,5,y,18,3,0.75);
      rect(0x2a5464,303,79,22,116);
      for(let y=87;y<187;y+=21)rect(0xcde4dc,309,y,11,2,0.66);
    }else{
      // Academy: dark stone, gold championship lights, trophy silhouettes.
      rect(0x102634,27,27,297,43);
      border(0xc9a363,29,29,293,39,2);
      rect(0x295365,34,34,84,30);
      rect(0x295365,231,34,86,30);
      for(const x of [42,60,78,96,240,258,276,294]){
        rect(0xd3ac67,x,39,7,15);
        rect(0xf1d99b,x+2,35,3,5);
        rect(0xd3ac67,x+2,54,3,4);
        rect(0xf1d99b,x,58,7,2);
      }
      rect(0x101f2b,2,82,24,101);
      for(let y=88;y<179;y+=24){
        rect(0xd8b574,6,y,16,2);
        rect(0xe7d5ad,10,y+3,8,11);
        rect(0xcda867,12,y+13,4,5);
      }
      rect(0xd8b574,306,79,16,2);
      for(let y=86;y<176;y+=19){
        rect(0x213e4a,307,y,14,15);
        rect(0xd7b476,310,y+2,8,10);
      }
    }
  }

  const b=trainingBounds(level);
  const width=b.right-b.left,height=b.bottom-b.top;
  // A visible boundary that exactly matches equipment placement constraints.
  rect(theme.ink,b.left-5,b.top-5,width+10,height+10);
  rect(theme.edge,b.left-3,b.top-3,width+6,height+6);
  rect(theme.mat,b.left,b.top,width,height);
  // Interlocking square mats; varied geometry emphasizes the amount of usable
  // floor space that becomes available at each tier.
  for(let y=b.top+2;y<b.bottom-2;y+=18){
    for(let x=b.left+2;x<b.right-2;x+=24){
      const w=Math.min(23,b.right-2-x),h=Math.min(17,b.bottom-2-y);
      rect((Math.floor(x/24)+Math.floor(y/18)+level)%3===0?theme.tile:theme.mat,x,y,w,h);
      rect(0xffffff,x+1,y+1,w-1,1,0.08);
      rect(theme.ink,x+1,y+h-1,w-1,1,0.13);
    }
  }
  border(theme.edge,b.left,b.top,width,height,2);
  // Corner tape and exact mat edges remain distinct from visual decoration.
  for(const x of [b.left+5,b.right-9])for(const y of [b.top+5,b.bottom-9]){
    rect(theme.accent,x,y,5,1);
    rect(theme.accent,x+2,y-2,1,5);
  }
  const cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;
  if(level===1){
    g.lineStyle(1,theme.edge,0.24).strokeCircle(cx,cy,23);
    rect(theme.accent,cx-18,cy+1,36,1,0.18);
  }else if(level===2){
    // Level 2's floor art must match the actual two equipment-placement
    // zones. The contrasting center aisle stays walkable but cannot hold gear.
    const striking=equipmentPlacementZone(2,0);
    const strength=equipmentPlacementZone(2,2);
    rect(theme.floorLine,b.left,striking.bottom,width,strength.top-striking.bottom,0.94);
    rect(theme.accent,b.left,striking.bottom,width,1,0.6);
    rect(theme.accent,b.left,strength.top-1,width,1,0.6);
    const outline=(z:typeof striking,color:number)=>{
      border(color,z.left+2,z.top+2,z.right-z.left-4,z.bottom-z.top-4,1);
      for(let x=z.left+8;x<z.right-8;x+=24)
        rect(color,x,z.top+5,12,1,0.32);
    };
    outline(striking,0x83bdb2);
    outline(strength,0xc8b28a);
    // Small pixel-style floor markings distinguish striking from weights.
    rect(0x83bdb2,striking.left+9,striking.top+9,26,3,0.66);
    rect(0xc8b28a,strength.left+9,strength.bottom-12,26,3,0.66);
  }else if(level===3){
    // Sparring-circle markings, not rope obstacles.
    g.lineStyle(3,theme.edge,0.69).strokeCircle(cx,cy,45);
    g.lineStyle(1,theme.accent,0.38).strokeCircle(cx,cy,39);
    rect(theme.accent,cx-38,cy,76,2,0.23);
    rect(theme.accent,cx-1,cy-37,2,74,0.23);
    for(const x of [b.left+12,b.right-19]){
      rect(0xa95b52,x,b.top+9,7,7,0.75);
      rect(0xc78c70,x,b.bottom-17,7,7,0.75);
    }
  }else if(level===4){
    // Two technical lanes with an oval training core.
    for(const x of [b.left+36,b.right-38]){
      rect(theme.edge,x,b.top+10,2,height-20,0.35);
      for(let y=b.top+18;y<b.bottom-8;y+=24)
        rect(theme.accent,x-5,y,12,2,0.3);
    }
    g.lineStyle(2,theme.edge,0.65).strokeCircle(cx,cy,42);
    g.lineStyle(1,theme.edge,0.35).strokeCircle(cx,cy,31);
    rect(theme.accent,cx-32,cy,64,2,0.24);
  }else{
    // Tournament-grade academy floor with a large premium central seal.
    for(const x of [b.left+22,b.right-24])
      rect(theme.accent,x,b.top+11,2,height-22,0.36);
    for(const y of [b.top+16,b.bottom-18])
      rect(theme.accent,b.left+20,y,width-40,2,0.36);
    g.lineStyle(3,theme.edge,0.82).strokeCircle(cx,cy,48);
    g.lineStyle(1,theme.accent,0.75).strokeCircle(cx,cy,40);
    g.lineStyle(1,theme.edge,0.55).strokeCircle(cx,cy,28);
    for(let a=0;a<8;a++){
      const ang=a*Math.PI/4;
      const x=Math.round(cx+34*Math.cos(ang)),y=Math.round(cy+34*Math.sin(ang));
      rect(theme.accent,x-2,y-2,4,4,0.65);
    }
    rect(theme.accent,cx-21,cy-2,42,4,0.27);
    rect(theme.accent,cx-2,cy-15,4,30,0.19);
  }
  // The top tiers are new facilities, not the garage recolored.
  const display=(x:number,y:number,w:number,h:number,gold:boolean)=>{
    rect(0x0e202a,x-3,y-3,w+6,h+6);
    rect(gold?0xcfa96b:0x83b4b6,x-2,y-2,w+4,h+4);
    rect(0x142d39,x,y,w,h);
    rect(gold?0x243e53:0x315660,x+2,y+2,w-4,h-4);
    rect(gold?0xf0c882:0x94d4c2,x+5,y+5,w-10,2);
    rect(0xf5dfb4,x+5,y+10,Math.floor(w*0.36),2);
    for(let i=0;i<4;i++)
      rect(i%2?0x96b7b0:0xd7b56c,x+5+i*Math.floor((w-12)/4),y+h-12,
        Math.max(5,Math.floor((w-20)/4)),2,0.87);
    rect(gold?0xd4ae6b:0x83c6b8,x+5,y+h-6,w-10,1);
  };
  if(level===4){
    display(233,30,83,34,false);
  }else if(level===5){
    display(39,29,81,36,true);
    display(233,29,84,36,true);
    // Premium flagship lounge: marble aisle, warm lighting, water bar and greenery.
    rect(0x234653,332,119,145,104);
    for(let y=125;y<224;y+=16)for(let x=333;x<478;x+=22){
      rect((x+y)%3?0x5c7b7e:0x698487,x,y,21,15,0.78);
      rect(0xdce0c8,x+1,y+1,19,1,0.16);
    }
    rect(0xd5ae74,333,121,144,2,0.72);
    rect(0xe4d7bc,339,139,22,18,0.3);
    rect(0x284b4b,343,141,14,14);
    rect(0x8db4a5,348,134,4,19);
    for(let y=140;y<157;y+=4){
      rect(0x79a778,342,y,7,3);
      rect(0xb9cf9f,353,y,8,3);
    }
    rect(0xdbcba7,339,161,22,3,0.72);
    rect(0x283c45,335,204,28,10);
    for(let i=0;i<3;i++)rect(0x6eaaab,339+i*8,202,5,7);
    rect(0xe7cf9e,335,200,28,3,0.74);
  }
  // Wall spotlights point toward the mats without fake physical obstacles.
  for(const x of [b.left+21,b.right-22]){
    rect(theme.ink,x-8,73,16,6,0.65);
    rect(theme.accent,x-5,77,10,2,0.62);
    g.fillStyle(0xffe2a3,0.055).fillPoints([
      {x:x-5,y:79},{x:x+5,y:79},{x:x+26,y:121},{x:x-26,y:121}
    ],true);
  }
  g.generateTexture('gym-room-'+level,480,330);
  g.destroy();
}

export function drawGym(scene:Phaser.Scene,requestedLevel=1):void {
  const level=normalizeGymLevel(requestedLevel);
  const key='gym-room-'+level;
  const approvedKey=approvedRoomKey(level);
  const approved=level<=2&&scene.textures.exists(approvedKey);
  if(!approved&&!scene.textures.exists(key))bakeRoom(scene,level);
  scene.add.image(0,0,approved?approvedKey:key).setOrigin(0);
  // The source sprites are layered onto the collision-accurate room layout.
  // These are visual only: trainingBounds remains the single navigation and
  // placement authority, and no unpurchased equipment appears in the room.
  const customArt=level<=2&&hasHubArt(scene);
  if(customArt){
    const mat=trainingBounds(level);
    if(level===1){
      if(!approved)placeHubArt(scene,'garage-door',47,25,242,63,0.25,0,0);
      placeHubArt(scene,'gym-banner',299,29,91,30,0.4,0,0);
    }else{
      for(const area of [
        {top:mat.top,bottom:140},
        {top:153,bottom:mat.bottom}
      ]){
        // The approved room image already contains its correctly sized mats.
      }
      placeHubArt(scene,'gym-banner',140,29,121,32,0.4,0,0);
    }
  }
  const label=level===3?'COMBAT CULTURE':
    ['COMBAT GARAGE','NEIGHBORHOOD GYM','','PRO FACILITY','COMBAT ACADEMY'][level-1];
  if(!customArt)scene.add.text(174,49,label,{fontFamily:'monospace',
    fontSize:'7px',fontStyle:'bold',color:'#f8ddb1'}).setOrigin(0.5);

  if(level===3){
    // The user's original gym is reproduced here, not just approximated.
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
    return;
  }

  const {board:b,desk:d}=gymServiceLayout(level);
  const charcoal=0x26363a;
  const gold=level===5?0xe8c58e:0xd4a36d;
  const draw=(g:Phaser.GameObjects.Graphics,color:number,x:number,y:number,
    w:number,h:number,alpha=1)=>g.fillStyle(color,alpha).fillRect(x,y,w,h);

  // Community board evolves from pinned paper to a full digital notice wall.
  const board=scene.add.graphics().setDepth(11.2);
  board.fillStyle(0x172a2b,0.22).fillEllipse(b.x+b.w/2,b.y+b.h+5,b.w+8,9);
  draw(board,charcoal,b.x-2,b.y-2,b.w+4,b.h+4);
  draw(board,level>=4?0x9c9a88:0xae8761,b.x,b.y,b.w,b.h);
  draw(board,level>=4?0x274b4e:0x95704d,b.x+4,b.y+4,b.w-8,b.h-8);
  draw(board,level>=4?0x172f3a:0x426866,b.x+5,b.y+5,b.w-10,11);
  if(level===5){
    draw(board,gold,b.x+3,b.y+1,b.w-6,2);
    draw(board,gold,b.x+5,b.y+17,b.w-10,1,0.76);
    draw(board,gold,b.x+5,b.y+b.h-9,b.w-10,2);
  }
  const posterCount=level===1?2:level===2?3:level===4?4:5;
  const posterGap=3;
  const posterWidth=Math.floor((b.w-12-(posterCount-1)*posterGap)/posterCount);
  const posterHeight=b.h-(level===1?23:level===2?26:30);
  const paper=[0xf3dcaa,0xc0d8c8,0xe5aa7b,0xe7cda0,0x98c2bc];
  for(let i=0;i<posterCount;i++){
    const x=b.x+6+i*(posterWidth+posterGap),y=b.y+(level===1?19:22);
    draw(board,paper[i%paper.length],x,y,posterWidth,posterHeight);
    draw(board,0x865e48,x+posterWidth/2-1,y+1,2,1);
    for(let row=0;row<3;row++){
      draw(board,0x64817a,x+2,y+4+row*3,Math.max(2,posterWidth-5-row),1,0.8);
    }
  }
  const header=level===1?'CLASS LIST':level===2?'TRAINING BOARD':
    level===4?'GYM SCHEDULE':'COMMUNITY HUB';
  scene.add.text(b.x+b.w/2,b.y+10,header,{
    fontFamily:'monospace',fontSize:level===1?'6px':level===5?'8px':'7px',
    fontStyle:'bold',color:'#f8ddb1'
  }).setOrigin(0.5).setDepth(11.4);
  if(level===5){
    scene.add.text(b.x+b.w/2,b.y+b.h-5,'NEWS  •  EVENTS  •  CLASSES',{
      fontFamily:'monospace',fontSize:'5px',color:'#f2d9a6'
    }).setOrigin(.5).setDepth(11.4);
  }

  // A receptionist actually works at the Academy desk, with an idle animation.
  // She stays behind the counter; tapping her opens the existing management UI.
  if(level===5){
    const staff=scene.add.graphics().setDepth(11.8);
    const cx=d.x+Math.round(d.w*0.52);
    // Staff shirt, shoulders, head, hair, small face highlights.
    draw(staff,0x102f3b,cx-10,169,20,16);
    draw(staff,0x426b69,cx-9,169,18,16);
    draw(staff,0xe0c49d,cx-6,157,12,14);
    draw(staff,0x292b32,cx-7,154,14,7);
    draw(staff,0x292b32,cx-8,159,3,10);
    draw(staff,0x292b32,cx+5,159,3,10);
    draw(staff,0x35302e,cx-4,162,1,2);
    draw(staff,0x35302e,cx+3,162,1,2);
    draw(staff,0x9b765b,cx-2,167,4,1);
    draw(staff,0xe6ce9f,cx-2,174,4,4);
    draw(staff,gold,cx-8,178,5,2);
    scene.tweens.add({targets:staff,y:-1,duration:1100,
      ease:'Sine.easeInOut',yoyo:true,repeat:-1});
    scene.add.text(cx,148,'FRONT DESK',{fontFamily:'monospace',
      fontSize:'6px',color:'#f8dfad'}).setOrigin(.5).setDepth(11.9);
  }

  const desk=scene.add.graphics().setDepth(12.2);
  desk.fillStyle(0x263333,0.32).fillEllipse(d.x+d.w/2,d.y+d.h+1,d.w+5,11);
  if(level===1){
    // A real folding table with just a clipboard and coin box.
    draw(desk,0x554c46,d.x+3,d.y+4,d.w-6,d.h-4);
    draw(desk,0x263d41,d.x+6,d.y+7,3,d.h-7);
    draw(desk,0x263d41,d.x+d.w-9,d.y+7,3,d.h-7);
    draw(desk,0xc4a278,d.x,d.y,d.w,6);
    draw(desk,0xeddbb1,d.x+3,d.y+1,d.w-6,1);
    draw(desk,0xe5dbc4,d.x+7,d.y-4,13,6);
    draw(desk,0x657d71,d.x+9,d.y-2,9,2);
    draw(desk,0x333e42,d.x+d.w-15,d.y-5,10,6);
    draw(desk,0x9fbba4,d.x+d.w-13,d.y-3,6,2);
  }else{
    // Standard desk at Level 2; luxury curved visual detailing at 4 and 5.
    const premium=level>=4;
    draw(desk,charcoal,d.x,d.y+4,d.w,d.h-4);
    draw(desk,premium?0x354c54:0x8d5b47,d.x+4,d.y+10,d.w-8,d.h-13);
    draw(desk,premium?0x18353e:0x573e37,d.x+8,d.y+16,d.w-16,d.h-21);
    draw(desk,premium?0x668785:0xb47d5c,d.x+10,d.y+18,d.w-20,d.h-25);
    draw(desk,premium?0xcac7b7:0xd4a36d,d.x,d.y,d.w,10);
    draw(desk,premium?gold:0xf2d6a8,d.x+1,d.y+1,d.w-2,2);
    draw(desk,premium?gold:0xd4a36d,d.x+7,d.y+d.h-9,d.w-14,2);
    // Computer is progressively replaced by a sleek reception tablet.
    const monitorX=d.x+Math.round(d.w*0.52);
    draw(desk,0x1b333d,monitorX-14,d.y-18,28,18);
    draw(desk,0x42757a,monitorX-11,d.y-16,22,13);
    draw(desk,0xb4d5c7,monitorX-8,d.y-13,14,2);
    draw(desk,0x829f99,monitorX-8,d.y-9,10,1);
    draw(desk,0x26373a,monitorX-2,d.y,4,5);
    draw(desk,0x395358,monitorX-12,d.y+4,24,2);
    if(premium){
      draw(desk,0xe9e2c7,d.x+5,d.y+5,13,3);
      draw(desk,0x3f6771,d.x+d.w-19,d.y-3,12,8);
      draw(desk,gold,d.x+d.w-16,d.y-3,6,2);
    }
  }
  const deskTitle=level===1?'CHECK IN':level===2?'FRONT DESK':
    level===4?'RECEPTION':'COMBAT CULTURE';
  scene.add.text(d.x+d.w/2,d.y+d.h-10,deskTitle,{
    fontFamily:'monospace',fontSize:level===5?'7px':level===1?'6px':'7px',
    fontStyle:'bold',color:level>=4?'#f6dfa8':'#f7d9aa'
  }).setOrigin(.5).setDepth(12.25);
}
