import Phaser from 'phaser';
import {GymCharacter,type Pose} from './characters';
import {SEMINAR_COACHES,seminarComplete,SEMINAR_STATS,type SeminarSave} from './seminars';

const FONT='Trebuchet MS, Arial, sans-serif';
const ivory='#f9f1db',gold=0xe8bd75;
const PHASE_DURATION_MS=3000;
type SeminarLaunch={coachId:number;saveKey:string};

/** Non-interactive paid coaching event: three brief training shots, then
 * the same guaranteed XP whether watched in full or skipped. */
export class SeminarScene extends Phaser.Scene {
  private coachId=0;
  private saveKey='';
  private phase=0;
  private finished=false;
  private presenter?:GymCharacter;
  private pupils:GymCharacter[]=[];
  private titleText!:Phaser.GameObjects.Text;
  private lessonText!:Phaser.GameObjects.Text;
  private progressText!:Phaser.GameObjects.Text;
  private progressFill!:Phaser.GameObjects.Rectangle;
  private skip!:Phaser.GameObjects.Container;
  private resultUi:Phaser.GameObjects.GameObject[]=[];
  private advanceTimer?:Phaser.Time.TimerEvent;
  constructor(){super('Seminar');}
  init(data:SeminarLaunch):void {
    this.coachId=data.coachId;this.saveKey=data.saveKey;
    this.phase=0;this.finished=false;this.pupils=[];
    this.advanceTimer=undefined;this.resultUi=[];
  }
  private readSave():SeminarSave|null {
    try{
      const raw=localStorage.getItem(this.saveKey);
      return raw?JSON.parse(raw) as SeminarSave:null;
    }catch{return null;}
  }
  private text(x:number,y:number,value:string,size=12,color=ivory,
    width=260):Phaser.GameObjects.Text {
    return this.add.text(x,y,value,{
      fontFamily:FONT,fontSize:size+'px',color,
      wordWrap:{width},lineSpacing:4
    });
  }
  private button(label:string,x:number,y:number,w:number,h:number,
    fn:()=>void):Phaser.GameObjects.Container {
    const base=this.add.rectangle(0,0,w,h,0x365d62)
      .setStrokeStyle(1,0x91aaa4).setInteractive({useHandCursor:true});
    const copy=this.add.text(0,0,label,{
      fontFamily:FONT,fontSize:'12px',fontStyle:'bold',color:ivory
    }).setOrigin(.5);
    base.on('pointerover',()=>base.setFillStyle(0x4e7d78));
    base.on('pointerout',()=>base.setFillStyle(0x365d62));
    base.on('pointerdown',fn);
    return this.add.container(x,y,[base,copy]).setDepth(25);
  }
  create():void {
    const coach=SEMINAR_COACHES[this.coachId];
    if(!coach){this.scene.start('Gym',{trainingBoard:true});return;}
    const bg=this.add.graphics();
    bg.fillStyle(0x102a32).fillRect(0,0,480,330);
    bg.fillStyle(0x24464b).fillRect(12,12,456,306);
    bg.lineStyle(2,gold).strokeRect(12,12,456,306);
    bg.fillStyle(0x172e39).fillRect(14,14,452,54);
    bg.fillStyle(0x315d62).fillRect(20,86,440,197);
    bg.fillStyle(0x4a7c79).fillRect(24,95,431,181);
    bg.lineStyle(1,0x93c4b4,0.8).strokeRect(24,95,431,181);
    bg.lineStyle(1,0x80aaa4,0.36);
    for(let x=45;x<450;x+=41)bg.lineBetween(x,95,x,275);
    for(let y=115;y<275;y+=35)bg.lineBetween(24,y,455,y);
    bg.fillStyle(0x17343a).fillRect(29,104,122,161);
    bg.fillStyle(0xc9a06c).fillRect(30,105,120,3);
    bg.fillStyle(0x233f48).fillRect(159,103,287,26);
    this.text(23,22,'GUEST SEMINAR',19,ivory,258);
    this.text(23,47,coach.name+'  /  '+coach.discipline,11,'#c7e1d4',310);
    this.button('EXIT',428,35,66,27,()=>this.returnToGym());
    this.text(43,116,coach.discipline.toUpperCase(),11,'#f7d79a',110)
      .setOrigin(.5,0).setX(90);
    this.text(37,140,SEMINAR_STATS[coach.focus]+' +\n'+
      SEMINAR_STATS[coach.secondary],10,'#d5e3d6',106).setAlign('center');
    this.presenter=new GymCharacter(this,91,252,1+this.coachId);
    this.presenter.body.setScale(2.25).setDepth(8);
    const positions=[{x:218,y:225},{x:315,y:225},{x:413,y:225}];
    this.pupils=positions.map((p,i)=>{
      const pupil=new GymCharacter(this,p.x,p.y,1+((i+this.coachId+1)%4));
      pupil.body.setScale(1.65).setDepth(8);
      return pupil;
    });
    for(const [i,p] of positions.entries())
      this.text(p.x-32,241,'STUDENT '+(i+1),9,'#d0e5d4',70);
    this.titleText=this.text(167,111,'',13,'#f2dbad',264);
    this.lessonText=this.text(172,146,'',12,ivory,268);
    const progressX=173,progressY=282;
    this.add.rectangle(progressX,progressY,258,5,0x223e43).setOrigin(0,.5);
    this.progressFill=this.add.rectangle(progressX,progressY,0,5,0xe0b878)
      .setOrigin(0,.5);
    this.progressText=this.text(176,291,'',10,'#d2e1d4',250);
    this.skip=this.button('SKIP SCENE',364,302,120,26,()=>this.complete());
    const booked=this.readSave()?.seminarPending?.coachId===this.coachId;
    if(!booked){
      this.finished=true;
      this.skip.setVisible(false);
      this.titleText.setText('SEMINAR NOT BOOKED');
      this.lessonText.setText('This seminar is unavailable or already complete.');
      this.progressText.setText('Return to the training board.');
      return;
    }
    this.showPhase();
  }
  private showPhase():void {
    if(this.finished)return;
    const coach=SEMINAR_COACHES[this.coachId];
    const stages=['DEMONSTRATION','GUIDED DRILLS','TECHNIQUE CORRECTIONS'];
    this.titleText.setText((this.phase+1)+'/3  '+stages[this.phase]);
    this.lessonText.setText(coach.lessons[this.phase]);
    this.progressText.setText('SCENE '+(this.phase+1)+' / 3');
    this.progressFill.setDisplaySize(258*this.phase/3,5);
    this.advanceTimer?.remove(false);
    this.advanceTimer=this.time.delayedCall(PHASE_DURATION_MS,()=>{
      if(this.phase>=2)this.complete();
      else{this.phase++;this.showPhase();}
    });
  }
  private complete():void {
    if(this.finished)return;
    this.advanceTimer?.remove(false);
    const save=this.readSave();
    if(!save||save.seminarPending?.coachId!==this.coachId){
      this.finished=true;this.skip.setVisible(false);
      this.titleText.setText('SEMINAR NOT AVAILABLE');
      this.lessonText.setText('The paid booking was not found. Return to the gym.');
      return;
    }
    const outcome=seminarComplete(save,this.coachId);
    if(!outcome){
      this.finished=true;this.skip.setVisible(false);
      this.titleText.setText('ALREADY COMPLETED');
      this.lessonText.setText('Seminar credit has already been awarded.');
      return;
    }
    try{localStorage.setItem(this.saveKey,JSON.stringify(save));}
    catch{
      this.titleText.setText('SAVE NOT AVAILABLE');
      this.lessonText.setText('Could not save seminar progress. Check browser storage.');
      this.progressText.setText('Use SKIP SCENE to retry.');
      return;
    }
    this.finished=true;this.skip.setVisible(false);
    this.progressFill.setDisplaySize(258,5);
    this.progressText.setVisible(false);
    // Results sit above the student sprites on an opaque score panel.
    this.add.rectangle(307,205,281,145,0x173740,0.94).setDepth(11);
    this.titleText.setDepth(12);
    this.lessonText.setDepth(12);
    const coach=SEMINAR_COACHES[this.coachId];
    this.titleText.setText('SEMINAR COMPLETE');
    this.lessonText.setText(coach.discipline+' training finished.\n'+
      outcome.attendees+' students attended.\n\n'+
      SEMINAR_STATS[coach.focus]+' +'+outcome.primaryXp+' XP\n'+
      SEMINAR_STATS[coach.secondary]+' +'+outcome.secondaryXp+' XP\n'+
      'Reputation +'+outcome.reputation);
    this.resultUi.push(this.button('RETURN TO GYM',333,302,173,26,
      ()=>this.returnToGym()));
  }
  private returnToGym():void {
    this.advanceTimer?.remove(false);
    this.scene.start('Gym',{trainingBoard:true});
  }
  update(_time:number,delta:number):void {
    const dt=Math.min(delta,50)/1000;
    const poses:Pose[]=['shadow','bag','talk'];
    this.presenter?.animate(poses[this.finished?2:this.phase],dt);
    for(const [i,pupil] of this.pupils.entries()){
      const action:Pose=this.finished?'rest':
        this.phase===0?'shadow':this.phase===1?
          (i===0?'shadow':i===1?'bag':'lift'):'stretch';
      pupil.animate(action,dt);
    }
  }
}
