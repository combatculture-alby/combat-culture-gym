import Phaser from 'phaser';
import {GymCharacter} from './characters';
import {SEMINAR_COACHES,seminarComplete,SEMINAR_STATS,type SeminarSave} from './seminars';

const FONT='Trebuchet MS, Arial, sans-serif';
const white='#f9f1db',gold=0xe8bd75;
type SeminarLaunch={coachId:number;saveKey:string};

export class SeminarScene extends Phaser.Scene {
  private coachId=0;
  private saveKey='';
  private question=0;
  private correct=0;
  private answered=false;
  private presenter?:GymCharacter;
  private roundUi:Phaser.GameObjects.GameObject[]=[];
  constructor(){super('Seminar');}
  init(data:SeminarLaunch):void {
    this.coachId=data.coachId;this.saveKey=data.saveKey;
    this.question=0;this.correct=0;this.answered=false;this.roundUi=[];
  }
  private readSave():SeminarSave|null {
    try{
      const raw=localStorage.getItem(this.saveKey);
      return raw?JSON.parse(raw) as SeminarSave:null;
    }catch{return null;}
  }
  private button(label:string,x:number,y:number,w:number,h:number,fn:()=>void,
    target:Phaser.GameObjects.GameObject[]=this.roundUi):void {
    const base=this.add.rectangle(x,y,w,h,0x30565d).setStrokeStyle(1,0x87aaa4)
      .setInteractive({useHandCursor:true});
    const text=this.add.text(x,y,label,{
      fontFamily:FONT,fontSize:'12px',fontStyle:'bold',color:white,
      align:'center',wordWrap:{width:w-16}
    }).setOrigin(.5);
    base.on('pointerover',()=>base.setFillStyle(0x4b7874));
    base.on('pointerout',()=>base.setFillStyle(0x30565d));
    base.on('pointerdown',()=>fn());
    target.push(base,text);
  }
  private text(x:number,y:number,value:string,size=12,color=white,
    width=260):Phaser.GameObjects.Text {
    const t=this.add.text(x,y,value,{
      fontFamily:FONT,fontSize:size+'px',color,
      wordWrap:{width},lineSpacing:3
    });
    this.roundUi.push(t);return t;
  }
  private clearRound():void {
    for(const obj of this.roundUi)obj.destroy();
    this.roundUi=[];
  }
  create():void {
    const coach=SEMINAR_COACHES[this.coachId];
    const booked=this.readSave()?.seminarPending?.coachId===this.coachId;
    this.add.rectangle(0,0,480,330,0x122b32).setOrigin(0);
    this.add.rectangle(11,11,458,309,0x25444b).setOrigin(0).setStrokeStyle(2,gold);
    this.add.rectangle(12,12,456,54,0x19353d).setOrigin(0);
    this.add.text(25,21,'GUEST SEMINAR',{fontFamily:FONT,fontSize:'19px',
      fontStyle:'bold',color:white});
    this.add.text(25,47,coach.name+'  /  '+coach.discipline,{
      fontFamily:FONT,fontSize:'11px',color:'#c5dcd4'});
    const exit=this.add.rectangle(428,35,64,28,0x614440)
      .setStrokeStyle(1,0xc9a78b).setInteractive({useHandCursor:true});
    this.add.text(428,35,'EXIT',{fontFamily:FONT,fontSize:'11px',
      color:white,fontStyle:'bold'}).setOrigin(.5);
    exit.on('pointerdown',()=>this.returnToGym());
    this.add.rectangle(82,191,134,219,0x395b5f).setStrokeStyle(1,0x8ba8a3);
    this.add.rectangle(82,265,120,35,0x233f43);
    this.add.text(82,279,'GUEST COACH',{fontFamily:FONT,fontSize:'10px',
      color:'#f2d69e'}).setOrigin(.5);
    this.add.rectangle(83,90,110,3,gold);
    this.presenter=new GymCharacter(this,84,242,1+this.coachId);
    this.presenter.body.setScale(2.3);
    this.add.text(82,113,coach.discipline.toUpperCase(),{
      fontFamily:FONT,fontSize:'10px',fontStyle:'bold',
      color:'#f1dfae'}).setOrigin(.5);
    this.add.text(82,128,SEMINAR_STATS[coach.focus]+' +\n'+SEMINAR_STATS[coach.secondary],{
      fontFamily:FONT,fontSize:'10px',color:'#cfdfd2',align:'center'
    }).setOrigin(.5,0);
    if(!booked){
      this.text(179,110,'This seminar was not booked, or it has already been completed.',14);
      this.button('RETURN TO GYM',302,252,207,34,()=>this.returnToGym());
      return;
    }
    this.renderRound();
  }
  private renderRound():void {
    this.clearRound();
    const coach=SEMINAR_COACHES[this.coachId];
    const lesson=coach.questions[this.question];
    this.text(180,78,'LESSON '+(this.question+1)+'/3      CORRECT '+this.correct,11,'#f0d19b');
    this.text(180,101,lesson.question,13,white,272);
    lesson.answers.forEach((choice,index)=>{
      this.button((index+1)+'. '+choice,311,170+index*36,260,32,
        ()=>this.answer(index));
    });
    this.text(187,290,'Choose the best coaching answer.',10,'#a9cfc9',260);
  }
  private answer(index:number):void {
    if(this.answered)return;
    this.answered=true;
    const lesson=SEMINAR_COACHES[this.coachId].questions[this.question];
    if(index===lesson.correct)this.correct++;
    this.clearRound();
    const right=index===lesson.correct;
    this.text(188,84,right?'CORRECT TECHNIQUE':'COACHING TIP',15,
      right?'#b3e9bf':'#f1cd9c',275);
    this.text(188,117,lesson.explanation,12,white,268);
    this.text(188,180,'Correct answers: '+this.correct+' / '+(this.question+1),
      11,'#e9d19a',268);
    this.button(this.question===2?'COMPLETE SEMINAR':'NEXT LESSON',
      308,241,255,35,()=>{
        if(this.question===2)this.complete();
        else{this.question++;this.answered=false;this.renderRound();}
      });
    this.text(195,281,right?'Good work.':'You still gain experience for attending.',
      10,'#b7d6cd',259);
  }
  private complete():void {
    const save=this.readSave();
    if(!save||save.seminarPending?.coachId!==this.coachId){
      this.clearRound();
      this.text(184,115,'This seminar reservation is no longer available.',13);
      this.button('RETURN TO GYM',313,231,235,35,()=>this.returnToGym());
      return;
    }
    const outcome=seminarComplete(save,this.coachId,this.correct);
    if(!outcome)return;
    try{localStorage.setItem(this.saveKey,JSON.stringify(save));}
    catch {
      this.clearRound();
      this.text(186,110,'Could not save your seminar. Please check browser storage.',12);
      this.button('RETRY SAVE',309,228,240,35,()=>this.complete());
      return;
    }
    this.clearRound();
    const coach=SEMINAR_COACHES[this.coachId];
    this.text(180,78,'SEMINAR COMPLETED',17,'#f6d39b');
    this.text(180,110,'Correct answers: '+this.correct+' / 3',12);
    this.text(180,140,coach.discipline+'  /  '+outcome.attendees+' students trained',12);
    this.text(180,170,SEMINAR_STATS[coach.focus]+' +'+outcome.primaryXp+' XP',12,'#c5ebc9');
    this.text(180,191,SEMINAR_STATS[coach.secondary]+' +'+outcome.secondaryXp+' XP',12,'#c5ebc9');
    this.text(180,212,'Reputation +'+outcome.reputation,12,'#f4dea4');
    this.button('RETURN TO GYM',311,260,257,36,()=>this.returnToGym());
  }
  private returnToGym():void {
    this.scene.start('Gym',{trainingBoard:true});
  }
  update(_time:number,delta:number):void {
    this.presenter?.animate('talk',Math.min(delta,50)/1000);
  }
}
