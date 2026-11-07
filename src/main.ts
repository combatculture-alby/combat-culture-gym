import Phaser from 'phaser';
class GymScene extends Phaser.Scene {
 private player!: Phaser.GameObjects.Rectangle;
 private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
 private wasd!: Record<'W'|'A'|'S'|'D', Phaser.Input.Keyboard.Key>;
 private destination: Phaser.Math.Vector2 | null = null;
 private readonly speed = 115;
 constructor() { super('Gym'); }
 create(): void {
  const g=this.add.graphics();
  g.fillStyle(0xc9ae86).fillRect(0,0,480,270);
  g.fillStyle(0x426f70).fillRect(32,32,286,178);
  g.lineStyle(1,0x639596,0.7);
  for(let x=32;x<=318;x+=32)g.lineBetween(x,32,x,210);
  for(let y=32;y<=210;y+=32)g.lineBetween(32,y,318,y);
  g.fillStyle(0x963d35).fillRoundedRect(368,62,38,80,10);
  g.fillStyle(0x765337).fillRect(346,180,92,34);
  g.fillStyle(0x3b332d).fillRect(0,0,480,14);
  this.add.text(12,235,'COMBAT CULTURE GYM | Prototype 0.1',{fontFamily:'monospace',fontSize:'12px',color:'#29383b'});
  this.add.text(12,250,'WASD / Arrows: Move | Click: Move',{fontFamily:'monospace',fontSize:'10px',color:'#29383b'});
  this.add.text(340,220,'RECEPTION',{fontFamily:'monospace',fontSize:'10px',color:'#493e33'});
  this.player=this.add.rectangle(170,150,22,30,0x292a2c).setStrokeStyle(2,0xb52427);
  this.add.rectangle(170,132,22,5,0xd92928);
  this.cursors=this.input.keyboard!.createCursorKeys();
  this.wasd=this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{this.destination=new Phaser.Math.Vector2(Phaser.Math.Clamp(p.worldX,20,460),Phaser.Math.Clamp(p.worldY,25,218));});
 }
 update(_time:number,delta:number):void {
  let dx=Number(this.cursors.right.isDown||this.wasd.D.isDown)-Number(this.cursors.left.isDown||this.wasd.A.isDown);
  let dy=Number(this.cursors.down.isDown||this.wasd.S.isDown)-Number(this.cursors.up.isDown||this.wasd.W.isDown);
  if(dx||dy)this.destination=null;
  else if(this.destination){
   const distance=Phaser.Math.Distance.Between(this.player.x,this.player.y,this.destination.x,this.destination.y);
   if(distance<3)this.destination=null;
   else{dx=(this.destination.x-this.player.x)/distance;dy=(this.destination.y-this.player.y)/distance;}
  }
  const length=Math.hypot(dx,dy)||1;
  const step=Math.min(delta,50)/1000*this.speed;
  this.player.x=Phaser.Math.Clamp(this.player.x+dx/length*step,12,468);
  this.player.y=Phaser.Math.Clamp(this.player.y+dy/length*step,25,220);
 }
}
new Phaser.Game({type:Phaser.AUTO,parent:'game',width:480,height:270,backgroundColor:'#c9ae86',pixelArt:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[GymScene]});
