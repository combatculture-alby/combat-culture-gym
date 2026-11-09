import Phaser from 'phaser';
import {normalizeGymLevel,trainingBounds} from './gymProgression';

// All art is drawn into Phaser textures so it ships without external image assets.
// Room dimensions, board, and reception stay fixed; each expansion opens more mat
// space and makes the gym visually more established.
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
    rect(0x343f42,23,26,301,48);
    rect(0x9fa8a0,27,29,293,42);
    for(let y=29;y<71;y+=8){
      rect(0x778781,29,y,288,2);
      rect(0xf6f0df,31,y+3,284,1,0.31);
      rect(0x57655f,31,y+7,284,1,0.28);
    }
    for(const x of [27,316])rect(0x35484b,x,27,4,46);
    rect(0x425659,168,29,4,41);
    rect(0x2e4246,116,25,121,5);
    rect(0xffefd2,140,27,73,2,0.92);
    rect(0xffffff,139,30,75,5,0.06);
    rect(0x37484a,0,82,22,98);
    for(let y=90;y<177;y+=14){
      rect(0x9a866d,3,y,17,3);
      rect(0x677269,5,y-4,8,4);
    }
    rect(0x5c6059,308,81,18,64);
    for(let y=85;y<141;y+=7)for(let x=311;x<325;x+=5)
      rect(0xe5c18c,x,y,1,1,0.34);
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
    // One central training square and paired warmup strips.
    g.lineStyle(2,theme.edge,0.3).strokeCircle(cx,cy,30);
    for(const x of [b.left+19,b.right-24])
      rect(theme.accent,x,b.top+15,3,height-30,0.19);
    rect(theme.accent,cx-20,cy+2,40,1,0.32);
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

export function drawGym(scene:Phaser.Scene,level=1):void {
  const key='gym-room-'+level;
  if(!scene.textures.exists(key))bakeRoom(scene,level);
  scene.add.image(0,0,key).setOrigin(0);
  const label=['COMBAT GARAGE','NEIGHBORHOOD GYM','FIGHT GYM','PRO FACILITY','COMBAT ACADEMY'][normalizeGymLevel(level)-1];
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
