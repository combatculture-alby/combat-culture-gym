import Phaser from 'phaser';
import { GymCharacter } from './characters';

type StudentState = 'waiting'|'walking'|'training'|'needs-water'|'resting'|'finished';
type Trainee = {actor:GymCharacter; state:StudentState; bag:number|null; patience:number; training:number; x:number; y:number; targetX:number; targetY:number; requestAt:number};
const BAG_X=[84,190,296,402];
const BAG_Y=112;
const DURATION=90;

/** Isolated Class Rush prototype. No hub save data is changed. */
export class MuayThaiClassRushScene extends Phaser.Scene {
  private coach!:GymCharacter;
  private students:Trainee[]=[];
  private selected=-1;
  private bagOwners:(number|null)[]=[null,null,null,null];
  private elapsed=0;
  private served=0;
  private missed=0;
  private carryingWater=false;
  private active=true;
  private hud!:Phaser.GameObjects.Text;
  private notice!:Phaser.GameObjects.Text;
  private overlays:Phaser.GameObjects.Text[]=[];
  private cursors!:Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!:Record<'W'|'A'|'S'|'D',Phaser.Input.Keyboard.Key>;
  private destination:{x:number;y:number}|null=null;
  constructor(){super('MuayThaiClassRush');}
  create():void {
    this.students=[];this.selected=-1;this.bagOwners=[null,null,null,null];
    this.elapsed=0;this.served=0;this.missed=0;this.carryingWater=false;this.active=true;
    this.cameras.main.setBackgroundColor('#6c8278');
    this.add.rectangle(240,175,468,298,0x748a83).setStrokeStyle(7,0x6b5746);
    this.add.rectangle(240,30,468,38,0x8a6852);
    this.add.text(240,22,'MUAY THAI CLASS RUSH',{fontFamily:'Arial',fontSize:'16px',color:'#fff1d5',fontStyle:'bold'}).setOrigin(.5);
    for(let i=0;i<4;i++){
      const x=BAG_X[i];
      this.add.rectangle(x,98,36,63,0x2d4144).setStrokeStyle(2,0xd4a96e);
      this.add.rectangle(x,96,22,46,0xa84b40).setStrokeStyle(2,0x573a35);
      this.add.text(x,141,'BAG '+(i+1),{fontFamily:'Arial',fontSize:'10px',color:'#fff1d5'}).setOrigin(.5);
      const zone=this.add.zone(x,104,66,104).setInteractive({useHandCursor:true});
      zone.on('pointerdown',()=>this.assign(i));
    }
    this.add.rectangle(55,232,86,53,0x365b70).setStrokeStyle(2,0xd6d7ce);
    this.add.text(55,232,'WATER\nCLICK TO PICK UP',{fontFamily:'Arial',fontSize:'10px',color:'#ffffff',align:'center'}).setOrigin(.5);
    this.add.zone(55,232,86,60).setInteractive({useHandCursor:true}).on('pointerdown',()=>{
      if(!this.active)return;
      this.destination={x:100,y:210};
      this.carryingWater=true;this.setNotice('Water collected. Click a thirsty student.');
    });
    this.add.rectangle(425,232,86,53,0xb6a07d).setStrokeStyle(2,0x514e43);
    this.add.text(425,232,'BREAK\nSTATION',{fontFamily:'Arial',fontSize:'11px',color:'#25383b',align:'center'}).setOrigin(.5);
    this.coach=new GymCharacter(this,240,211,0);
    this.hud=this.add.text(12,289,'',{fontFamily:'Arial',fontSize:'12px',color:'#ffffff'}).setDepth(40);
    this.notice=this.add.text(240,316,'Click a student, then an empty bag.',{fontFamily:'Arial',fontSize:'11px',color:'#fff1d5'}).setOrigin(.5).setDepth(40);
    this.cursors=this.input.keyboard!.createCursorKeys();
    this.keys=this.input.keyboard!.addKeys('W,A,S,D') as typeof this.keys;
    this.add.text(466,21,'EXIT',{fontFamily:'Arial',fontSize:'11px',color:'#ffffff',backgroundColor:'#8c453b',padding:{x:5,y:5}})
      .setOrigin(1,.5).setDepth(50).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.exit());
    this.input.on('pointerdown',(p:Phaser.Input.Pointer,targets:Phaser.GameObjects.GameObject[])=>{
      if(!this.active||targets.length)return;
      this.destination={x:Phaser.Math.Clamp(p.x,20,460),y:Phaser.Math.Clamp(p.y,160,270)};
    });
    this.spawnStudent();
  }
  private setNotice(s:string):void {this.notice.setText(s);}
  private spawnStudent():void {
    if(this.students.length>=4)return;
    const i=this.students.length;
    const x=155+i*55,y=267;
    const actor=new GymCharacter(this,x,y,(i%4)+1);
    const student:Trainee={actor,state:'waiting',bag:null,patience:100,training:0,x,y,targetX:x,targetY:y,requestAt:8+i*3};
    this.students.push(student);
    const hit=this.add.zone(x,y-16,32,44).setInteractive({useHandCursor:true}).setDepth(32);
    const label=this.add.text(x,y-45,'WAITING',{fontFamily:'Arial',fontSize:'9px',color:'#fff1d5',backgroundColor:'#294447',padding:{x:3,y:2}}).setOrigin(.5).setDepth(33);
    this.overlays.push(label);
    hit.on('pointerdown',()=>{
      if(!this.active)return;
      if(student.state==='needs-water'&&this.carryingWater){
        this.carryingWater=false;student.state='training';student.patience=Math.min(100,student.patience+30);
        student.requestAt=student.training+11;this.served++;this.setNotice('Water delivered!');return;
      }
      this.selected=i;this.setNotice(student.state==='waiting'?'Now click an empty bag.':'Student '+(i+1)+' selected.');
    });
    this.events.on('update',()=>{hit.setPosition(student.x,student.y-16);label.setPosition(student.x,student.y-45);});
  }
  private assign(bag:number):void {
    if(!this.active)return;
    if(this.selected<0){this.setNotice('Select a waiting student first.');return;}
    const student=this.students[this.selected];
    if(student.state!=='waiting'){this.setNotice('That student is already training.');return;}
    if(this.bagOwners[bag]!==null){this.setNotice('That bag is occupied.');return;}
    this.bagOwners[bag]=this.selected;student.bag=bag;student.state='walking';
    student.targetX=BAG_X[bag]+22;student.targetY=173;
    this.setNotice('Student '+(this.selected+1)+' assigned to bag '+(bag+1)+'.');
    this.selected=-1;
  }
  update(_time:number,delta:number):void {
    if(!this.active)return;
    const dt=Math.min(delta/1000,.05);
    this.elapsed+=dt;
    if(this.students.length<4&&this.elapsed>this.students.length*4)this.spawnStudent();
    const dx=Number(this.cursors.right.isDown||this.keys.D.isDown)-Number(this.cursors.left.isDown||this.keys.A.isDown);
    const dy=Number(this.cursors.down.isDown||this.keys.S.isDown)-Number(this.cursors.up.isDown||this.keys.W.isDown);
    let vx=dx,vy=dy;
    if(!vx&&!vy&&this.destination){
      const x=this.destination.x-this.coach.body.x,y=this.destination.y-this.coach.body.y;
      if(Math.hypot(x,y)<4)this.destination=null;
      else {const length=Math.hypot(x,y);vx=x/length;vy=y/length;}
    }else if(vx||vy)this.destination=null;
    if(vx||vy){const l=Math.hypot(vx,vy);this.coach.place(Phaser.Math.Clamp(this.coach.body.x+vx/l*115*dt,20,460),Phaser.Math.Clamp(this.coach.body.y+vy/l*115*dt,165,270));this.coach.face(vx,vy);}
    this.coach.animate(vx||vy?'walk':'idle',dt);
    this.students.forEach((s,i)=>{
      if(s.state==='walking'){
        const dx=s.targetX-s.x,dy=s.targetY-s.y,dist=Math.hypot(dx,dy);
        if(dist<2){s.x=s.targetX;s.y=s.targetY;s.state='training';}
        else{s.x+=dx/dist*Math.min(dist,70*dt);s.y+=dy/dist*Math.min(dist,70*dt);s.actor.face(dx,dy);}
      }
      if(s.state==='training'){
        s.training+=dt;
        if(s.training>=s.requestAt){s.state='needs-water';}
        if(s.training>=35){s.state='finished';this.served++;if(s.bag!==null)this.bagOwners[s.bag]=null;}
      }
      if(s.state==='needs-water'){s.patience-=dt*5;if(s.patience<=0){s.state='finished';this.missed++;if(s.bag!==null)this.bagOwners[s.bag]=null;}}
      s.actor.place(s.x,s.y);s.actor.animate(s.state==='training'?'bag':s.state==='walking'?'walk':'idle',dt);
      const label=this.overlays[i];
      label.setText(s.state==='needs-water'?'WATER '+Math.ceil(s.patience)+'%':s.state==='training'?'TRAINING':s.state.toUpperCase());
      label.setColor(s.state==='needs-water'?'#ffad91':'#fff1d5');
    });
    this.hud.setText('TIME '+Math.max(0,Math.ceil(DURATION-this.elapsed))+'s    HELPED '+this.served+'    MISSED '+this.missed+(this.carryingWater?'    CARRYING WATER':''));
    if(this.elapsed>=DURATION)this.finish();
  }
  private finish():void {
    this.active=false;this.add.rectangle(240,168,390,170,0x203d40,.97).setDepth(60);
    this.add.text(240,126,'CLASS COMPLETE',{fontFamily:'Arial',fontSize:'22px',color:'#fff1d5',fontStyle:'bold'}).setOrigin(.5).setDepth(61);
    this.add.text(240,164,'Helped: '+this.served+'   Missed: '+this.missed+'\nPrototype only: no save rewards yet.',{fontFamily:'Arial',fontSize:'14px',color:'#ffffff',align:'center'}).setOrigin(.5).setDepth(61);
    this.add.text(240,221,'RETURN TO GYM',{fontFamily:'Arial',fontSize:'14px',color:'#ffffff',backgroundColor:'#527b70',padding:{x:12,y:8}})
      .setOrigin(.5).setDepth(62).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.exit());
  }
  private exit():void {this.scene.start('Gym');}
}
