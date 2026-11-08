import Phaser from 'phaser';

export type Facing = 'down' | 'up' | 'side';
export type Pose = 'idle' | 'walk' | 'shadow' | 'bag' | 'lift' | 'stretch' | 'rest' | 'talk' | 'drink';

const looks = [
  { skin:'#dfab81', shade:'#a36452', hair:'#292735', light:'#504557', top:'#354754', dark:'#23343e', trim:'#d56b50', pants:'#a74a43', cut:0 },
  { skin:'#cb8e64', shade:'#95543e', hair:'#3a2930', light:'#69413a', top:'#da8f57', dark:'#965745', trim:'#f8dca2', pants:'#463d43', cut:1 },
  { skin:'#edb795', shade:'#b97962', hair:'#754338', light:'#a46048', top:'#65a58c', dark:'#396b65', trim:'#c8d8a0', pants:'#334c53', cut:2 },
  { skin:'#9d6549', shade:'#713e38', hair:'#262934', light:'#4b4656', top:'#a695c0', dark:'#625b87', trim:'#dfb978', pants:'#383d56', cut:3 },
  { skin:'#e2bc8c', shade:'#a77a57', hair:'#79543d', light:'#af7849', top:'#e4bc69', dark:'#a77d45', trim:'#f6e2af', pants:'#566358', cut:4 },
];
const directions: Facing[] = ['down','up','side'];
const poses: Pose[] = ['idle','walk','shadow','bag','lift','stretch','rest','talk','drink'];
const frameSize = 40;
const foot = 36;
const ink = '#282934';
const linen = '#e8dac3';

function drawFrame(ctx: CanvasRenderingContext2D, look: typeof looks[number], facing: Facing, pose: Pose, frame: number): void {
  const pixel = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle=color;
    ctx.fillRect(x,y,w,h);
  };
  const silhouette = (color: string, x: number, y: number, w: number, h: number) => {
    pixel(ink,x+1,y,w-2,h);
    pixel(ink,x,y+1,w,h-2);
    pixel(color,x+1,y+1,w-2,h-2);
  };
  const side=facing==='side', back=facing==='up';
  const stride=pose==='walk'?[0,2,0,-2][frame]:0;
  const crouch=pose==='rest'?7:pose==='lift'&&frame<2?2:0;
  const bob=crouch+(pose==='walk'&&frame%2===0?1:0);
  const center=20, bodyX=side?15:13, bodyW=side?10:14;
  const leg=(x:number,y:number,far=false) => {
    silhouette(far?look.shade:look.skin,x,y,5,8-crouch/2);
    pixel(ink,x-1,y+5-crouch/2,7,3);
    pixel(far?'#a89b8c':linen,x,y+5-crouch/2,5,1);
  };
  const arm=(x:number,y:number,length:number,far=false) => {
    silhouette(far?look.dark:look.top,x,y,5,length);
    pixel(look.shade,x+1,y+length-5,3,3);
    pixel(pose==='bag'||pose==='shadow'?look.trim:look.skin,x+1,y+length-4,3,2);
  };
  if(pose==='rest'){
    // Seated pose: folded legs and lowered torso, with feet resting on the floor.
    silhouette(look.pants,side?13:10,29,side?17:20,5);
    pixel(look.dark,side?12:9,33,side?19:22,2);
  }else if(side){
    leg(17+stride,27,true);
    leg(18-stride,28);
  }else{
    leg(14,27+stride,true);
    leg(21,28-stride);
  }

  const punch=pose==='bag'||pose==='shadow';
  if(side) arm(22,19+bob-stride,9,true);
  else arm(10,19+bob-stride,10,true);
  silhouette(look.dark,bodyX,16+bob,bodyW,14-crouch/2);
  pixel(look.top,bodyX+2,18+bob,bodyW-4,7);
  pixel(look.trim,bodyX+2,back?23+bob:19+bob,side?2:back?6:3,1);
  pixel(look.pants,bodyX+1,25+bob,bodyW-2,4-crouch/2);
  pixel(look.trim,bodyX+2,26+bob,bodyW-4,1);

  if(pose==='lift'){
    const height=[26,21,14,21][frame];
    const handle=side?24:20;
    arm(side?16:10,Math.min(19+bob,height),9);
    arm(side?23:25,Math.min(19+bob,height),9);
    pixel('#b3bbb7',handle-8,height+3,16,2);
    silhouette('#52626a',handle-9,height+1,4,6);
    silhouette('#52626a',handle+5,height+1,4,6);
  }else if(pose==='stretch'){
    // Alternate overhead reaches and side bends instead of static raised arms.
    const reach=frame%2===0?3:6;
    const tilt=frame>=2?3:0;
    silhouette(look.top,bodyX-reach-2-tilt,12+bob,5,13);
    silhouette(look.top,bodyX+bodyW+tilt-2,12+bob,5,13);
    pixel(look.skin,bodyX-reach-1-tilt,10+bob,3,4);
    pixel(look.skin,bodyX+bodyW+tilt-1,10+bob,3,4);
  }else if(pose==='drink'){
    // A personal water bottle rises to the mouth, pauses, then lowers.
    const raised=frame===1||frame===2;
    arm(side?15:25,raised?12+bob:19+bob,9);
    const bx=side?25:29,by=raised?13+bob:25+bob;
    silhouette('#579cae',bx,by,5,8);
    pixel('#e6f4e9',bx+1,by+2,3,2);
    pixel('#294f62',bx+1,by-2,3,2);
  }else if(punch){
    if(side){
      const extension=[5,14,6,12][frame];
      silhouette(look.top,19,20+bob,extension,5);
      silhouette(look.trim,16+extension,19+bob,6,6);
      pixel(linen,18+extension,20+bob,2,1);
    }else{
      arm(10,frame%2===0?14+bob:20+bob,10);
      arm(25,frame%2===1?14+bob:20+bob,10);
    }
  }else{
    arm(side?15:25,19+bob+stride-(pose==='talk'&&frame%2?3:0),10);
  }

  const hy=5+bob-(look.cut===3?1:0);
  const hx=side?15:13;
  const headW=side?11:14;
  if(look.cut===2) silhouette(look.hair,hx-3,hy+4,6,13);
  silhouette(look.skin,hx,hy+2,headW,13);
  pixel(look.shade,hx+2,hy+12,headW-4,2);
  const hairHeight=back?11:look.cut===3?5:6;
  silhouette(look.hair,hx-1,hy,headW+1,hairHeight);
  pixel(look.light,hx+1,hy+2,headW-4,1);
  if(look.cut===1) pixel(look.light,hx+4,hy,5,2);
  if(look.cut===2) pixel(look.hair,hx-2,hy-2,5,4);
  if(look.cut===3) pixel(look.light,hx+1,hy+3,headW-4,1);
  if(look.cut===4) pixel(look.hair,hx+4,hy-2,5,3);
  if(look.cut===0) pixel(look.trim,hx,hy+4,headW-1,2);
  if(!back){
    const blinking=pose==='idle'&&frame===3;
    pixel(ink,side?23:16,hy+8,blinking?2:1,blinking?1:2);
    if(!side) pixel(ink,23,hy+8,blinking?2:1,blinking?1:2);
    pixel(look.shade,side?24:center-1,hy+11,2,1);
    if(side) pixel(look.skin,25,hy+9,2,2);
  }
}

export class GymCharacter {
  readonly body: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;
  private facing: Facing='down';
  private left=false;
  private pose: Pose='idle';
  private elapsed=0;
  private frame=-1;

  constructor(scene: Phaser.Scene, x:number, y:number, look:number) {
    const key='gym-character-'+look;
    if(!scene.textures.exists(key)){
      const texture=scene.textures.createCanvas(key,frameSize*4,frameSize*directions.length*poses.length)!;
      const ctx=texture.context;
      for(const [direction,facing] of directions.entries()){
        for(const [index,pose] of poses.entries()){
          const row=direction*poses.length+index;
          for(let frame=0;frame<4;frame++){
            ctx.save();
            ctx.translate(frame*frameSize,row*frameSize);
            drawFrame(ctx,looks[look],facing,pose,frame);
            ctx.restore();
            texture.add(row*4+frame,0,frame*frameSize,row*frameSize,frameSize,frameSize);
          }
        }
      }
      texture.refresh();
    }
    this.image=scene.add.image(0,0,key,0).setOrigin(0.5,foot/frameSize);
    const shadow=scene.add.ellipse(0,0,19,6,0x202930,0.36);
    this.body=scene.add.container(x,y,[shadow,this.image]);
    this.place(x,y);
  }

  place(x:number,y:number):void {
    this.body.setPosition(x,y).setDepth(10+y/100);
    this.image.setPosition(Math.round(x)-x,Math.round(y)-y);
  }

  face(dx:number,dy:number):void {
    if(Math.abs(dx)+Math.abs(dy)<0.02)return;
    this.facing=Math.abs(dx)>Math.abs(dy)*0.85?'side':dy>0?'down':'up';
    this.left=this.facing==='side'&&dx<0;
  }

  animate(pose:Pose,dt:number):void {
    if(this.pose!==pose){this.pose=pose;this.elapsed=0;}
    this.elapsed+=dt;
    const phase=pose==='idle'?[0,0,0,0,0,0,0,3][Math.floor(this.elapsed*5)%8]:
      Math.floor(this.elapsed*({walk:9,shadow:7,bag:7,lift:4,stretch:2,rest:2,talk:3,drink:2}[pose]))%4;
    const frame=(directions.indexOf(this.facing)*poses.length+poses.indexOf(pose))*4+phase;
    if(frame!==this.frame){this.image.setFrame(frame);this.frame=frame;}
    this.image.setFlipX(this.left);
  }
}
