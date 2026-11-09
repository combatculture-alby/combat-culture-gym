/// <reference types="vite/client" />
import Phaser from 'phaser';
import { GymCharacter, type Pose } from './characters';
import {SeminarScene} from './seminarScene';
import {SEMINAR_COACHES,SEMINAR_STATS,seminarAvailable,seminarNextVisit,
  seminarBook,type SeminarPending} from './seminars';
import {COACH_SKINS,COACH_HAIR,COACH_SHIRTS,COACH_SHORTS,COACH_GLOVES,
  CLOTHING_SHOP,DEFAULT_COACH,normalizeCoachAppearance,normalizeCloset,
  normalizeUnlockedAppearance,hasClothing,type CoachAppearance,type ClothingSlot
} from './coachStyle';
import { drawGym } from './gymWorld';
import {GYM_LEVELS,STUDENT_NAMES,normalizeGymLevel,studentCapacity,enrolledCount,activeStudentCount,recruitmentCost,canExpandGym,attendingIndices,normalizeClassPlan,trainingBounds,gymServiceLayout,classEarnings,CLASS_REPUTATION,dailySupplyPositions} from './gymProgression';
import { GymNavigation, clearSegment, type Footprint, type Point } from './navigation';

const W = 480, H = 270;
const UI_FONT = 'Trebuchet MS, Arial, sans-serif';
type Station = Footprint & { id:string; pose:'bag'|'lift'|'rest'; fixture?:Phaser.GameObjects.Graphics };
type Routine = { pose:Pose; goal:Point; route:Point[]; remaining:number; station?:Station; partner?:Student; elapsed:number };
type Student = Point & { name:string; friendship:number; skill:number; actor?:GymCharacter; indicator?:Phaser.GameObjects.Text; routine?:Routine; chatCooldown:number };
const STUDENT_HOMES:Point[]=[{x:90,y:90},{x:245,y:104},{x:105,y:183},{x:275,y:183},{x:164,y:111},{x:220,y:185},{x:164,y:188},{x:78,y:151}];
const GEAR_BOUNDS=[{rx:9,ry:12},{rx:13,ry:10},{rx:8,ry:11},{rx:14,ry:8},{rx:14,ry:11},{rx:14,ry:10},{rx:13,ry:13},{rx:16,ry:12}];
const NEAR=42;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const closeFeet=(a:Point,b:Point)=>Math.abs(a.x-b.x)<17&&Math.abs(a.y-b.y)<9;
const roundPlacement=(n:number)=>Math.round(n/6)*6;
type Furniture = { kind: number; x: number; y: number; rotation: number; stored: boolean };
const FURNITURE = [{name:'Floor Lamp',price:35,rep:0},{name:'Bench',price:60,rep:3},{name:'Trophy Case',price:90,rep:8},{name:'Water Cooler',price:45,rep:0},{name:'Punching Dummy',price:120,rep:12}];
type Save = { version: 1; day: number; money: number; reputation: number; completed: boolean; friendships: number[]; skills: number[]; equipment?: number; classesTaught?: number; classType?: number; lastTalkDays?: number[]; decorLevel?: number; lifetimeEarnings?: number; decorPositions?: Point[]; furniture?: Furniture[]; playedActivities?: Partial<Record<TrainingMode,number>>; studentStats?: number[][]; studentXP?: number[][]; classesToday?: number; ownedGear?: boolean[]; materials?: number[]; gatheredToday?: number[]; studentGoals?: number[][]; completedGoals?: number[]; gearPositions?: Point[]; gearStored?: boolean[]; gymLevel?:number; enrolledStudents?:number; classPlan?:number[]; coachAppearance?:CoachAppearance; wardrobeOwned?:number[]; seminarPending?:SeminarPending; seminarLastDay?:number };
const GEAR_ITEMS=[{name:'Heavy Bag',stat:0,cost:65},{name:'Thai Pads',stat:0,cost:90},{name:'Speed Bag',stat:1,cost:70},{name:'Jump Rope',stat:1,cost:35},{name:'Weight Bench',stat:2,cost:95},{name:'Kettlebells',stat:2,cost:75},{name:'Treadmill',stat:3,cost:120},{name:'Assault Bike',stat:3,cost:135}];
const MATERIAL_NAMES=['Scrap','Wood','Fabric'];
const GEAR_MATERIALS=[[2,0,3],[1,1,4],[3,1,0],[0,0,2],[5,3,0],[4,1,0],[6,4,0],[7,3,0]];
const DECOR_MATERIALS=[[0,2,2],[1,3,1],[0,3,1]];
const FURNITURE_MATERIALS=[[1,1,1],[0,3,1],[2,2,0],[2,1,1],[1,1,2]];
const materialCost=(items:number[]):string=>items.map((count,i)=>count>0?count+' '+MATERIAL_NAMES[i]:'').filter(Boolean).join(', ');
const hasMaterials=(stock:number[]|undefined,cost:number[]):boolean=>cost.every((count,i)=>(stock?.[i]||0)>=count);
const spendMaterials=(stock:number[]|undefined,cost:number[]):number[]=>cost.map((count,i)=>(stock?.[i]||0)-count);
const CORE_STATS=['Striking','Speed','Strength','Conditioning'] as const;
const CLASS_PROGRAMS=[{name:'Boxing',stats:[0,1]},{name:'Muay Thai',stats:[0,2]},{name:'Grappling',stats:[2,3]},{name:'HIIT',stats:[1,3]}];
const statThreshold=(value:number):number=>value<20?30:value<40?55:value<60?90:value<80?140:220;
const initialStats=()=>STUDENT_NAMES.map(()=>[10,10,10,10]);
const initialXP=()=>STUDENT_NAMES.map(()=>[0,0,0,0]);
const initialGoals=()=>STUDENT_NAMES.map((_,i)=>[[20,0],[25,2],[20,3],[25,1]][i%4].slice());
const PLAYTEST = import.meta.env.VITE_ISOLATE_SAVE === '1';
const SAVE_KEY = import.meta.env.VITE_GARAGE_PREVIEW === '1'
  ? 'combat-culture-gym-garage-preview-v1'
  : PLAYTEST ? 'combat-culture-gym-living-preview-v1' : 'combat-culture-gym-v1';
const walkable = (x:number,y:number,level:number):boolean => {
  const {room,board,desk}=gymServiceLayout(level);
  // The entire physical room expands; no invisible Level 1 mega-gym.
  const boardBase={x:board.x,y:board.y+board.h-6,w:board.w,h:13};
  return x>=room.left&&x<=room.right&&y>=room.top&&y<=room.bottom&&
    ![desk,boardBase].some(b=>x+9>b.x&&x-9<b.x+b.w&&y+8>b.y&&y-8<b.y+b.h);
};
const defaults: Save = { version: 1, day: 1, money: 100, reputation: 0, completed: false, friendships: [0,0,0,0], skills: [0,0,0,0], equipment: 0, classesTaught: 0, classType: 0, lastTalkDays: [0,0,0,0], decorLevel: 0, lifetimeEarnings: 0, decorPositions: [{x:148,y:48},{x:240,y:48},{x:302,y:184}], furniture: [], gymLevel:1, enrolledStudents:4, classPlan:[0,1], coachAppearance:{...DEFAULT_COACH}, wardrobeOwned:[] };
function newSave():Save {
  // A new player now starts in a genuine empty garage, including in previews.
  // Existing saves are read unchanged by loadSave().
  return JSON.parse(JSON.stringify(defaults)) as Save;
}
function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newSave();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') throw Error('invalid');
    const s = data as Partial<Save>;
    const level=normalizeGymLevel(s.gymLevel);
    const enrolled=enrolledCount(s.enrolledStudents,level);
    if (s.version !== 1 || !Number.isInteger(s.day) || (s.day ?? 0) < 1 ||
      !Number.isFinite(s.money) || !Number.isFinite(s.reputation) || typeof s.completed !== 'boolean' ||
      !Array.isArray(s.friendships) || !Array.isArray(s.skills) ||
      s.friendships.length < 4 || s.skills.length < 4 ||
      !s.friendships.every(n => Number.isInteger(n) && n >= 0) ||
      !s.skills.every(n => Number.isInteger(n) && n >= 0)) throw Error('invalid');
    return {...s, gymLevel:level,enrolledStudents:enrolled,classPlan:normalizeClassPlan(s.classPlan),
      coachAppearance:normalizeUnlockedAppearance(s.coachAppearance,s.wardrobeOwned),
      wardrobeOwned:normalizeCloset(s.wardrobeOwned),
      seminarLastDay:Number.isInteger(s.seminarLastDay)&&Number(s.seminarLastDay)>0?s.seminarLastDay:undefined,
      seminarPending:s.seminarPending&&Number.isInteger(s.seminarPending.coachId)&&
        s.seminarPending.coachId>=0&&s.seminarPending.coachId<SEMINAR_COACHES.length&&
        Number.isInteger(s.seminarPending.day)&&s.seminarPending.day>0?
        {coachId:s.seminarPending.coachId,day:s.seminarPending.day}:undefined,
      friendships:Array.from({length:enrolled},(_,i)=>Math.max(0,Math.floor(Number(s.friendships?.[i])||0))),
      skills:Array.from({length:enrolled},(_,i)=>Math.max(0,Math.floor(Number(s.skills?.[i])||0))), equipment: Math.max(0,Math.min(3,Math.floor(Number(s.equipment)||0))), classesTaught: Math.max(0,Math.floor(Number(s.classesTaught)||0)), classType: Math.max(0,Math.min(2,Math.floor(Number(s.classType)||0))), lastTalkDays: Array.from({length:enrolled},(_,i)=>Math.max(0,Math.floor(Number(s.lastTalkDays?.[i])||0))), decorLevel: Math.max(0,Math.min(3,Math.floor(Number(s.decorLevel)||0))), furniture: Array.isArray(s.furniture) ? s.furniture.filter((v:unknown)=>{ const f=v as Partial<Furniture>; return !!f && Number.isInteger(f.kind) && f.kind!>=0 && f.kind!<FURNITURE.length && Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isInteger(f.rotation) && typeof f.stored==='boolean'; }).slice(0,40).map((v:Furniture)=>({...v,x:Math.max(38,Math.min(309,v.x)),y:Math.max(70,Math.min(204,v.y)),rotation:((v.rotation%4)+4)%4})) : [], decorPositions: Array.from({length:3},(_,i)=>{ const fallback=defaults.decorPositions![i]; const p=s.decorPositions?.[i]; return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x>=45 && p.x<=308 && p.y>=45 && p.y<=204 ? {x:Math.round(p.x),y:Math.round(p.y)} : {...fallback}; }), lifetimeEarnings: Math.max(0,Math.floor(Number(s.lifetimeEarnings)||0)), classesToday:Math.max(0,Math.min(2,Math.floor(Number(s.classesToday)||0))), ownedGear:Array.from({length:8},(_,i)=>s.ownedGear?.[i]===true||(s.ownedGear===undefined&&i===0&&(s.equipment||0)>=1)), materials:Array.from({length:3},(_,i)=>Math.max(0,Math.floor(Number(s.materials?.[i])||0))), gatheredToday:Array.isArray(s.gatheredToday)?s.gatheredToday.filter(v=>Number.isInteger(v)&&v>=0&&v<12):[], studentGoals:Array.from({length:enrolled},(_,i)=>{const g=s.studentGoals?.[i]||initialGoals()[i];return [Math.max(10,Math.min(100,Math.floor(Number(g[0])||20))),Math.max(0,Math.min(3,Math.floor(Number(g[1])||0)))];}), completedGoals:Array.from({length:enrolled},(_,i)=>Math.max(0,Math.floor(Number(s.completedGoals?.[i])||0))), gearStored:Array.from({length:8},(_,i)=>s.gearStored?.[i]===true), gearPositions:Array.from({length:8},(_,i)=>({x:Math.max(38,Math.min(309,Number(s.gearPositions?.[i]?.x)||65+(i%4)*57)),y:Math.max(75,Math.min(204,Number(s.gearPositions?.[i]?.y)||(i<4?80:180)))})), studentStats:Array.from({length:enrolled},(_,i)=>Array.from({length:4},(_,j)=>Math.max(0,Math.min(100,Math.floor(Number(s.studentStats?.[i]?.[j])||10))))), studentXP:Array.from({length:enrolled},(_,i)=>Array.from({length:4},(_,j)=>Math.max(0,Math.floor(Number(s.studentXP?.[i]?.[j])||0))))} as Save;
  } catch { return newSave(); }
}

class GymScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private coach!: GymCharacter;
  private footprints:Footprint[]=[];
  private stations:Station[]=[];
  private navigation=new GymNavigation((x,y)=>this.canStand(x,y));
  private targetRefresh=0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W'|'A'|'S'|'D', Phaser.Input.Keyboard.Key>;
  private route: Point[] = [];
  private speed = 115;
  private saveData = loadSave();
  private running = false;
  private seconds = 50;
  private requests: number[] = [];
  private classHelped = 0;
  private friendshipBonus = 0;
  private quickBonus = 0;
  private classMissed = 0;
  private classIndex = 0;
  private classRequestsTotal = 0;
  private requestAge: Record<number,number> = {};
  private pendingRequests: number[] = [];
  private nextRequestAt = 0;
  private tasks: Record<number,string> = {};
  private feedback!: Phaser.GameObjects.Text;
  private decor!: Phaser.GameObjects.Graphics;
  private worldFixtures:Phaser.GameObjects.Graphics[]=[];
  private placementPreview!:Phaser.GameObjects.Graphics;
  private placementHint!:Phaser.GameObjects.Text;
  private buildMode=false;
  private placementCursor:Point={x:168,y:144};
  private keyboardPlacement=false;
  private buildPage=0;
  private stationTarget:'board'|'desk'|null=null;
  private pickupTarget:Point|null=null;
  private studentCard!: Phaser.GameObjects.Text;
  private cardTimer?:Phaser.Time.TimerEvent;
  private rosterPanel!: Phaser.GameObjects.Container;
  private modeLabel!: Phaser.GameObjects.Text;
  private classOverlay!: Phaser.GameObjects.Graphics;
  private placingDecor = -1;
  private selectedFurniture = -1;
  private furniturePanel!: Phaser.GameObjects.Container;
  private rotateControl!: Phaser.GameObjects.Container;
  private storeControl!: Phaser.GameObjects.Container;
  private cancelControl!: Phaser.GameObjects.Container;
  private hubControls:Phaser.GameObjects.Container[]=[];
  private readonly classNames=['Beginner Boxing','Muay Thai Fundamentals','Conditioning'];
  private targetStudent: Student | null = null;
  private status!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private students:Student[]=[];
  private activeStudents():Student[] {
    return attendingIndices(this.students.length,this.gymLevel(),this.saveData.day).map(i=>this.students[i]);
  }
  private rosterPage=0;
  private goalsPage=0;
  private wardrobePage=0;
  private speechBubbles:Phaser.GameObjects.Text[]=[];
  private speechLines=['...','blah blah','psst!','haha!','nice!','you got this','one more!'];
  private speechUntil:number[]=[];
  private speechTimers:(Phaser.Time.TimerEvent|undefined)[]=[];
  private hideSpeech(student:Student):void {
    const index=this.students.indexOf(student);
    if(index<0)return;
    this.speechTimers[index]?.remove(false);
    this.speechTimers[index]=undefined;
    this.speechUntil[index]=0;
    this.speechBubbles[index]?.setVisible(false);
  }
  private showSpeech(student:Student,line:string,duration=1400):void {
    const index=this.students.indexOf(student);
    if(index<0||!this.speechBubbles[index])return;
    this.hideSpeech(student);
    const bubble=this.speechBubbles[index];
    bubble.setText(line).setPosition(student.x,student.y-48).setVisible(true);
    this.speechUntil[index]=this.time.now+duration;
    // A real scene timer stops stale bubbles even while an NPC is idle.
    this.speechTimers[index]=this.time.delayedCall(duration,()=>this.hideSpeech(student));
  }
  constructor() { super('Gym'); }
  create(data?:{trainingBoard?:boolean;notice?:string}): void {
    this.saveData=loadSave();
    this.clearIntent();
    this.targetRefresh=0;
    this.buildMode=false;
    this.speechBubbles=[];
    this.speechUntil=[];
    this.speechTimers=[];
    this.buildPage=0;
    this.selectedSlot=Math.min(this.saveData.classesToday||0,1);
    this.placingGear=this.placingDecor=this.selectedFurniture=-1;
    this.worldFixtures=[];
    this.gatheringNodes=[];
    this.gatheringPositions=dailySupplyPositions(this.gymLevel());
    this.students=STUDENT_NAMES.slice(0,enrolledCount(this.saveData.enrolledStudents,this.gymLevel())).map((name,i)=>({
      ...STUDENT_HOMES[i%STUDENT_HOMES.length],name,friendship:0,skill:0,chatCooldown:12+i*5
    }));
    drawGym(this,this.gymLevel());
    this.classOverlay=this.add.graphics().setDepth(2);
    this.add.rectangle(0,0,480,23,0x152b30).setOrigin(0).setDepth(29);
    this.modeLabel=this.add.text(12,11,PLAYTEST&&import.meta.env.VITE_GARAGE_PREVIEW!=='1'?'PLAYTEST':'GYM HUB',{fontFamily:UI_FONT,fontSize:'11px',fontStyle:'bold',color:'#f6d598'}).setOrigin(0,.5).setDepth(30);
    this.coach=new GymCharacter(this,170,150,this.saveData.coachAppearance||DEFAULT_COACH);
    this.player=this.coach.body;
    const attending=this.activeStudents();
    this.students.forEach((student,i)=>{
      Object.assign(student,{friendship:this.saveData.friendships[i],skill:this.saveData.skills[i],chatCooldown:12+i*5});
      const floorIndex=attending.indexOf(student);
      if(floorIndex<0)return;
      Object.assign(student,STUDENT_HOMES[floorIndex]);
      student.actor=new GymCharacter(this,student.x,student.y,1+(i%4));
      student.routine=this.idleRoutine(student,1+i);
      student.indicator=this.add.text(student.x,student.y-38,'!',{fontFamily:UI_FONT,fontSize:'12px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#a53d34',padding:{x:4,y:1}}).setOrigin(0.5).setVisible(false).setDepth(31);
      this.speechBubbles[i]=this.add.text(student.x,student.y-48,'',{fontFamily:UI_FONT,fontSize:'9px',color:'#20343a',backgroundColor:'#fff0d6',padding:{x:5,y:3},align:'center'}).setOrigin(.5,1).setDepth(33).setVisible(false);
      this.speechUntil[i]=0;
    });
    this.status=this.add.text(104,11,'',{fontFamily:UI_FONT,fontSize:'11px',fontStyle:'bold',color:'#fff1d5'}).setOrigin(0,.5).setDepth(30);
    this.dailyStatus=this.add.text(468,11,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#c5ded4'}).setOrigin(1,.5).setDepth(30);
    this.studentCard=this.add.text(12,25,'',{fontFamily:UI_FONT,fontSize:'11px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:3}}).setDepth(34).setVisible(false);
    this.add.rectangle(0,226,480,104,0x152b30).setOrigin(0).setDepth(29);
    this.add.rectangle(12,248,456,28,0x203b42).setOrigin(0).setStrokeStyle(1,0x45635f).setDepth(29);
    this.message=this.add.text(21,250,'Welcome! Teach classes to earn cash and reputation, then grow your gym.',{fontFamily:UI_FONT,fontSize:'11px',color:'#fff1d5',wordWrap:{width:437}}).setDepth(30);
    this.timer=this.add.text(12,211,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#29383b'});
    this.feedback=this.add.text(165,197,'',{fontFamily:UI_FONT,fontSize:'10px',fontStyle:'bold',color:'#fff5dc',backgroundColor:'#294f52',padding:{x:4,y:2}}).setOrigin(0.5).setDepth(10).setVisible(false);
    this.add.text(240,322,'Tap the floor to walk. Tap a student to talk.',{fontFamily:UI_FONT,fontSize:'10px',color:'#b9cebf'}).setOrigin(.5).setDepth(30);
    this.hubControls=[
      this.addButton(12,278,111,36,'TRAIN',()=>this.openTrainingBoard(),true),
      this.addButton(127,278,111,36,'MANAGE',()=>this.openGymUpgrades()),
      this.addButton(242,278,111,36,'ROSTER',()=>this.toggleRoster()),
      this.addButton(357,278,111,36,'BUILD',()=>this.toggleBuildMode())
    ];
    this.rosterPanel=this.add.container(0,0).setDepth(80).setVisible(false);
    this.furniturePanel=this.add.container(0,0).setDepth(60).setVisible(false);
    this.placementPreview=this.add.graphics().setDepth(45);
    this.placementHint=this.add.text(240,219,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',backgroundColor:'#203d40',padding:{x:5,y:3}}).setOrigin(0.5).setDepth(46).setVisible(false);
    this.rotateControl=this.addButton(12,278,111,36,'ROTATE',()=>this.rotateFurniture());
    this.storeControl=this.addButton(127,278,111,36,'STORE',()=>this.storeSelection());
    this.cancelControl=this.addButton(357,278,111,36,'CANCEL',()=>this.cancelPlacement());
    this.updateFurnitureActions();
    this.refresh();
    this.recoverActors();
    if(data?.notice)this.say(data.notice);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<'W'|'A'|'S'|'D', Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-E',() => {if(this.furniturePanel.visible){this.closePanel();return;}if(this.isPlacing()||this.rosterPanel.visible)return;if(this.collectNearby())return;if(this.useNearbyStation())return;this.interact();});
    this.input.keyboard!.on('keydown-SPACE',(event:KeyboardEvent)=>{if(this.running||this.furniturePanel.visible||this.rosterPanel.visible||this.isPlacing())return;event.preventDefault();if(!this.collectNearby())this.say('Move closer to a material pile to pick it up.');});
    this.input.keyboard!.on('keydown-C',() => {if(!this.running&&!this.furniturePanel.visible)this.openClassSchedule();});
    this.input.keyboard!.on('keydown-P',()=>{if(!this.furniturePanel.visible)this.openArcade('Rhythm');});
    this.input.keyboard!.on('keydown-G',()=>{if(!this.furniturePanel.visible)this.openArcade('Memory');});
    this.input.keyboard!.on('keydown-N',() => {if(!this.furniturePanel.visible&&!this.rosterPanel.visible&&!this.isPlacing())this.nextDay();});
    this.input.keyboard!.on('keydown-B',() => {if(!this.furniturePanel.visible&&!this.rosterPanel.visible&&!this.isPlacing())this.openGymUpgrades();});
    this.input.keyboard!.on('keydown-V',() => this.toggleRoster());
    this.input.keyboard!.on('keydown-M',()=>this.toggleBuildMode());
    this.input.keyboard!.on('keydown-ENTER',()=>this.confirmPlacement());
    this.input.keyboard!.on('keydown-SPACE',()=>this.confirmPlacement());
    this.input.keyboard!.on('keydown-UP',()=>this.movePlacement(0,-6));
    this.input.keyboard!.on('keydown-DOWN',()=>this.movePlacement(0,6));
    this.input.keyboard!.on('keydown-LEFT',()=>this.movePlacement(-6,0));
    this.input.keyboard!.on('keydown-RIGHT',()=>this.movePlacement(6,0));
    this.input.keyboard!.on('keydown-Q',() => this.rotateFurniture());
    this.input.keyboard!.on('keydown-X',() => this.storeSelection());
    this.input.keyboard!.on('keydown-ESC',()=>{
      if(this.rosterPanel.visible)this.rosterPanel.setVisible(false);
      else if(this.furniturePanel.visible)this.closePanel();
      else if(this.buildMode||this.isPlacing())this.cancelPlacement();
    });
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{if(!p.wasTouch&&this.isPlacing())this.keyboardPlacement=false;});
    this.input.on('pointerdown',(p:Phaser.Input.Pointer,targets:Phaser.GameObjects.GameObject[]) => {
      if(targets.length)return;
      this.clearIntent();
      // Keep world clicks from passing through open management panels.
      if(this.rosterPanel.visible){this.rosterPanel.setVisible(false);return;}
      if(this.furniturePanel.visible) return;
      if(this.placingGear>=0){this.placeGear(p.worldX,p.worldY);return;}
      if(this.selectedFurniture>=0) {this.placeFurniture(p.worldX,p.worldY);return;}
      if(this.placingDecor>=0) { this.placeDecor(p.worldX,p.worldY); return; }
      if(this.buildMode&&p.worldX<330&&p.worldY<220){
        const fi=(this.saveData.furniture||[]).findIndex(item=>!item.stored&&Math.abs(item.x-p.worldX)<25&&Math.abs(item.y-p.worldY)<22);
        if(fi>=0){this.selectFurniture(fi);return;}
        const gi=(this.saveData.ownedGear||[]).findIndex((owned,i)=>{
          const pos=this.saveData.gearPositions?.[i];
          return owned&&!this.saveData.gearStored?.[i]&&pos&&Math.abs(pos.x-p.worldX)<15&&Math.abs(pos.y-p.worldY)<15;
        });
        if(gi>=0){this.beginGearPlacement(gi);return;}
        this.say('Click an item to move, or press M for inventory.');return;
      }
      if(p.worldY >= 225) return;
      if(this.useStationAt(p.worldX,p.worldY))return;
      const student=[...this.activeStudents()].sort((a,b)=>b.y-a.y).find(s=>
        Math.abs(s.x-p.worldX)<15&&p.worldY>=s.y-33&&p.worldY<=s.y+8);
      if(student){
        if(distance(this.player,student)<NEAR)this.interact(student);
        else{
          this.targetStudent=student;
          this.targetRefresh=0;
          this.followStudent();
        }
      }else if(!this.collectNodeAt(p.worldX,p.worldY)){
        this.route=this.playerRoute({x:p.worldX,y:p.worldY});
      }
    });
    if(data?.trainingBoard)this.openTrainingBoard();
  }
  private clearIntent():void {
    this.route=[];
    this.targetStudent=null;
    this.stationTarget=null;
    this.pickupTarget=null;
  }
  private playerRoute(goal:Point,exact=false):Point[] {
    return this.navigation.route(this.player,goal,(x,y)=>this.activeStudents().every(s=>!closeFeet(s,{x,y})),exact);
  }
  private followStudent():void {
    const student=this.targetStudent;
    if(!student)return;
    if(distance(this.player,student)<NEAR){
      this.clearIntent();
      this.interact(student);
      return;
    }
    const approaches=[[-25,0],[25,0],[0,17],[0,-17]].map(([dx,dy])=>({x:student.x+dx,y:student.y+dy}));
    approaches.sort((a,b)=>distance(a,this.player)-distance(b,this.player));
    this.route=[];
    for(const goal of approaches){
      this.route=this.playerRoute(goal,true);
      if(this.route.length)break;
    }
    this.targetRefresh=0.45;
  }
  private useStationAt(x:number,y:number):boolean {
    const layout=gymServiceLayout(this.gymLevel());
    const inRect=(r:{x:number;y:number;w:number;h:number},pad=0)=>
      x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad;
    const board=inRect(layout.board,3);
    const staff=this.gymLevel()===5&&
      x>=layout.desk.x+18&&x<=layout.desk.x+layout.desk.w-12&&
      y>=139&&y<layout.desk.y;
    const desk=inRect(layout.desk,3)||staff;
    if(!board&&!desk)return false;
    const anchor=board?layout.boardApproach:layout.deskApproach;
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,anchor.x,anchor.y)>43){
      this.route=this.playerRoute(anchor,true);
      if(!this.route.length){this.say('The path to the station is blocked.');return true;}
      this.stationTarget=board?'board':'desk';
      this.say('Walking to '+(board?'training board':'reception computer')+'.');
      return true;
    }
    this.stationTarget=null;
    if(board)this.openTrainingBoard();else this.openGymUpgrades();
    return true;
  }
  private useNearbyStation():boolean {
    const {deskApproach,boardApproach}=gymServiceLayout(this.gymLevel());
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,deskApproach.x,deskApproach.y)<43){this.openGymUpgrades();return true;}
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,boardApproach.x,boardApproach.y)<43){this.openTrainingBoard();return true;}
    return false;
  }
  private menuShell(title:string,subtitle:string,back?:()=>void,p=this.furniturePanel):void {
    p.removeAll(true);
    p.add(this.add.rectangle(0,23,480,203,0x10252a,.56).setOrigin(0));
    p.add(this.add.rectangle(67,24,346,222,0x152b30).setOrigin(0).setStrokeStyle(2,0xc7a579));
    p.add(this.add.rectangle(71,28,338,34,0x29494c).setOrigin(0));
    p.add(this.add.text(83,34,title,{fontFamily:UI_FONT,fontSize:'15px',fontStyle:'bold',color:'#fff1d5'}));
    p.add(this.add.text(83,52,subtitle,{fontFamily:UI_FONT,fontSize:'8px',color:'#a8c9c4'}));
    this.panelButton(p,'×',367,29,39,31,()=>p===this.rosterPanel?p.setVisible(false):this.closePanel(),false,0x79463f);
    if(back)this.panelButton(p,'‹ BACK',83,218,73,25,back);
    p.setVisible(true);
  }
  private panelButton(p:Phaser.GameObjects.Container,label:string,x:number,y:number,w:number,h:number,fn:()=>void,muted=false,fill=0x355b5d,detail?:string):void {
    const color=muted?0x30474b:fill;
    const rect=this.add.rectangle(x,y,w,h,color).setOrigin(0).setStrokeStyle(1,muted?0x506c6a:0x77958c);
    const close=label==='×';
    const labelText=this.add.text(x+(close?w/2:9),y+(detail?2:h/2),label,{fontFamily:UI_FONT,fontSize:close?'20px':'11px',fontStyle:'bold',color:muted?'#b8ccc5':'#fff0d3'}).setOrigin(close?.5:0,detail?0:.5);
    if(!muted){
      rect.setInteractive({useHandCursor:true});
      rect.on('pointerover',()=>rect.setFillStyle(0x527776));
      rect.on('pointerout',()=>rect.setFillStyle(color));
      rect.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{
        event.stopPropagation();playGymCue('tap');fn();
      });
    }
    p.add([rect,labelText]);
    if(detail)p.add(this.add.text(x+9,y+16,detail,{fontFamily:UI_FONT,fontSize:'9px',color:'#c5ded4'}));
  }
  private menuAction(label:string,x:number,y:number,w:number,fn:()=>void,muted=false,detail?:string):void {
    this.panelButton(this.furniturePanel,label,x,y,w,29,fn,muted,0x355b5d,detail);
  }
  private drillsToday():number {
    return TRAINING_OPTIONS.filter(({mode})=>this.saveData.playedActivities?.[mode]===this.saveData.day).length;
  }
  private openTrainingBoard():void {
    if(this.running||this.isPlacing())return;
    this.clearIntent();
    const drills=this.drillsToday();
    this.menuShell('TRAINING BOARD','Teach interactive classes in the gym; arcade drills are optional.');
    this.menuAction('TEACH A CLASS',84,70,149,()=>this.openClassSchedule(),false,(this.saveData.classesToday||0)+'/2 classes today');
    this.menuAction('STUDENT GOALS',245,70,149,()=>this.showStudentGoals(),false,'Review their progress');
    TRAINING_OPTIONS.forEach(({label,mode,summary},i)=>{
      const done=this.saveData.playedActivities?.[mode]===this.saveData.day;
      this.menuAction(label,84+(i%2)*161,106+Math.floor(i/2)*35,149,()=>this.openArcade(mode),done||drills>=2,
        done?'Completed today':drills>=2?'Daily limit reached':summary);
    });
    this.menuAction('GUEST SEMINARS',245,176,149,()=>this.openSeminars(),false,
      this.saveData.seminarPending?'Resume your booking':'Rotating guest coaches');
    this.panelButton(this.furniturePanel,'DAILY GYM PLAN  /  NO MINIGAMES NEEDED',
      84,211,310,28,()=>this.openDailyHubPlan(),false,0x39735f);
  }
  private openSeminars():void {
    if(this.running||this.isPlacing())return;
    this.clearIntent();
    this.menuShell('GUEST SEMINARS','EXPENSIVE TRAINING EVENTS. COACH AVAILABILITY ROTATES DAILY.',
      ()=>this.openTrainingBoard());
    const pending=this.saveData.seminarPending;
    const hostedToday=this.saveData.seminarLastDay===this.saveData.day;
    SEMINAR_COACHES.forEach((coach,i)=>{
      const available=seminarAvailable(this.saveData.day,i);
      const next=seminarNextVisit(this.saveData.day,i);
      const status=hostedToday?'Already hosted today':
        pending?'Finish your paid seminar first':
        !available?'Next visit in '+next+' day'+(next===1?'':'s'):
        this.saveData.money<coach.fee?'Available / need $'+coach.fee:
        'Available today!';
      this.panelButton(this.furniturePanel,coach.name+' / '+coach.discipline+
        '  $'+coach.fee,84,72+i*33,310,31,()=>this.previewSeminar(i),
        !!pending||hostedToday||!available||this.saveData.money<coach.fee,
        0x39735f,SEMINAR_STATS[coach.focus]+' + '+SEMINAR_STATS[coach.secondary]+'   |   '+status);
    });
    if(pending){
      this.panelButton(this.furniturePanel,'RESUME PAID SEMINAR',169,216,224,27,
        ()=>this.launchSeminar(pending.coachId),false,0x39735f);
    }else{
      this.furniturePanel.add(this.add.text(169,218,
        hostedToday?'Already hosted a seminar today.':'$'+this.saveData.money+
        ' available. Seminars do not use class slots.',{
          fontFamily:UI_FONT,fontSize:'10px',color:'#d2ded1'
        }));
    }
  }
  private previewSeminar(coachId:number):void {
    const coach=SEMINAR_COACHES[coachId];
    if(!coach||this.running)return;
    if(!seminarAvailable(this.saveData.day,coachId)||
      this.saveData.seminarPending||
      this.saveData.seminarLastDay===this.saveData.day||
      this.saveData.money<coach.fee){
      this.openSeminars();return;
    }
    this.menuShell('HOST '+coach.discipline.toUpperCase()+' SEMINAR',
      coach.name+' is available today.',()=>this.openSeminars());
    const details=[
      coach.description,
      'Specialty: '+SEMINAR_STATS[coach.focus]+
        '   Bonus: '+SEMINAR_STATS[coach.secondary],
      'Guest fee: $'+coach.fee+'      Your cash: $'+this.saveData.money,
      'Three interactive lessons. Better answers give bigger XP.',
      'All students attending today benefit from the seminar.'
    ];
    details.forEach((line,i)=>this.furniturePanel.add(this.add.text(86,83+i*22,line,{
      fontFamily:UI_FONT,fontSize:'10px',color:i===2?'#f0c890':'#d9e8df',
      wordWrap:{width:305}
    })));
    this.panelButton(this.furniturePanel,'BOOK SEMINAR / PAY $'+coach.fee,170,211,224,29,
      ()=>this.bookSeminar(coachId),false,0x39735f);
  }
  private bookSeminar(coachId:number):void {
    if(this.running||!seminarBook(this.saveData,coachId)){
      this.openSeminars();return;
    }
    this.persist();this.refresh();
    this.launchSeminar(coachId);
  }
  private launchSeminar(coachId:number):void {
    if(this.running||this.saveData.seminarPending?.coachId!==coachId)return;
    this.clearIntent();
    this.furniturePanel.setVisible(false);
    this.persist();
    this.scene.start('Seminar',{coachId,saveKey:SAVE_KEY});
  }
  private openDailyHubPlan():void {
    const level=this.gymLevel(),next=GYM_LEVELS[level];
    const collected=this.saveData.gatheredToday?.length||0;
    const owned=this.saveData.ownedGear?.filter(Boolean).length||0;
    const classes=this.saveData.classesTaught||0;
    this.menuShell('YOUR GYM PLAN','CLASSES + SUPPLIES + GEAR + STUDENTS. NO ARCADE REQUIRED.',
      ()=>this.openTrainingBoard());
    const lines=[
      'Day '+this.saveData.day+'   Classes '+(this.saveData.classesToday||0)+'/2   Supplies '+collected+'/12',
      'Students '+this.students.length+'/'+studentCapacity(level)+
        '   Cash $'+this.saveData.money+'   REP '+this.saveData.reputation,
      next?'Next: '+next.name+'   Expansion $'+next.cost:'Flagship academy unlocked. Keep building!',
      next?'Requires REP '+next.reputation+' / '+this.saveData.reputation+
        '   Classes '+classes+'/'+next.classesTaught+
        '   Gear '+owned+'/'+next.gearOwned:
        'All gym tiers complete. Continue training and recruiting.'
    ];
    lines.forEach((line,i)=>this.furniturePanel.add(this.add.text(83,73+i*20,line,{
      fontFamily:UI_FONT,fontSize:'10px',color:i===2?'#f5d49b':'#e3e9d9'
    })));
    const button=(label:string,x:number,y:number,fn:()=>void,disabled=false)=>
      this.panelButton(this.furniturePanel,label,x,y,149,24,fn,disabled,0x39735f);
    // Keep the second row above menuShell's Back button (y=218).
    button('TEACH NEXT CLASS',84,158,()=>this.openClassSchedule(),(this.saveData.classesToday||0)>=2);
    button('FIND SUPPLIES',245,158,()=>this.collectNextSupply(),collected>=12);
    button('EXPAND GYM',84,188,()=>this.openExpansion(),!next);
    button('NEXT DAY',245,188,()=>{this.furniturePanel.setVisible(false);this.nextDay();});
  }
  private addButton(x:number,y:number,w:number,h:number,label:string,fn:()=>void,primary=false):Phaser.GameObjects.Container {
    const bg=this.add.rectangle(0,0,w,h,primary?0x426c62:0x294f52).setOrigin(0).setStrokeStyle(1,primary?0xe2c285:0x77958c).setInteractive({useHandCursor:true});
    const text=this.add.text(w/2,h/2,label,{fontFamily:UI_FONT,fontSize:'12px',fontStyle:'bold',color:'#fff1d5'}).setOrigin(0.5);
    bg.on('pointerdown',(_pointer:Phaser.Input.Pointer,_x:number,_y:number,event:Phaser.Types.Input.EventData)=>{
      event.stopPropagation();
      if(this.furniturePanel.visible||this.rosterPanel.visible)return;
      playGymCue('tap');fn();
    });
    return this.add.container(x,y,[bg,text]).setDepth(32);
  }
  private closePanel():void {
    this.furniturePanel.setVisible(false);
    this.buildMode=false;
  }
  private persist():void {
    this.saveData.friendships=this.students.map(s=>s.friendship);
    this.saveData.skills=this.students.map(s=>s.skill);
    try { localStorage.setItem(SAVE_KEY,JSON.stringify(this.saveData)); } catch { this.say('Storage unavailable. Progress will not persist.'); }
  }
  private dailyStatus!:Phaser.GameObjects.Text;
  private gatheringNodes:Phaser.GameObjects.Container[]=[];
  private placingGear=-1;
  private gymLevel():number {return normalizeGymLevel(this.saveData.gymLevel);}
  private refresh():void {
    this.status.setText('LV '+this.gymLevel()+'  DAY '+this.saveData.day+'   $'+this.saveData.money+'   REP '+this.saveData.reputation);
    this.drawEquipment();
    this.drawGatheringNodes();
    this.dailyStatus.setText('CLASSES '+(this.saveData.classesToday||0)+'/2  SUPPLIES '+(this.saveData.gatheredToday?.length||0)+'/12');
  }
  private drawEquipment():void {
    this.footprints=this.solidFootprints();
    this.navigation.rebuild();
    this.stations=[];
    this.worldFixtures.forEach(g=>g.destroy());this.worldFixtures=[];
    const layer=(y:number):void=>{
      const g=this.add.graphics().setDepth(10+y/100-0.05);
      this.worldFixtures.push(g);this.decor=g;
    };
    (this.saveData.furniture||[]).forEach((item,i)=>{
      if(!item.stored)layer(item.y+this.furnitureSize(item).ry*0.6);
      if(item.stored) return;
      if(item.kind===1||item.kind===3||item.kind===4)this.stations.push({
        ...item,...this.furnitureSize(item),id:'furniture-'+i,pose:item.kind===4?'bag':'rest',
        fixture:item.kind===4?this.decor:undefined
      });
      const x=item.x,y=item.y,side=item.rotation%2===1;
      this.decor.fillStyle(0x1b3439,0.2).fillEllipse(x,y+7,side?27:44,11);
      this.decor.fillStyle([0xf3d48b,0x735b48,0xb08b56,0x7cc2cc,0x9e5148][item.kind]);
      if(item.kind===0) { // Side-view lamp: the shade and base turn with the furniture.
        const dx=[0,14,0,-14][item.rotation],dy=[-14,0,14,0][item.rotation];
        this.decor.fillStyle(0x695447).fillCircle(x,y,5);
        this.decor.fillStyle(0xf3d48b).fillRect(x-3,y-3,6,6);
        this.decor.lineStyle(4,0xf3d48b).lineBetween(x,y,x+dx,y+dy);
        this.decor.fillStyle(0xffdf84).fillCircle(x+dx,y+dy,9);
        this.decor.fillStyle(0xe6a75c).fillRect(x+dx-7,y+dy+3,14,3);
      }
      else if(item.kind===1) {
        this.decor.fillStyle(0x503d32).fillRoundedRect(x-(side?8:21),y-(side?21:8),side?16:42,side?42:16,3);
        this.decor.fillStyle(0x9e7c5a).fillRoundedRect(x-(side?6:19),y-(side?19:6),side?12:38,side?38:12,2);
        this.decor.fillStyle(0xc9a479).fillRect(x-(side?4:15),y-(side?16:4),side?8:30,side?32:8);
        this.decor.fillStyle(0x775444).fillRect(x-(side?5:17),y-(side?16:1),side?1:34,side?32:1);
        this.decor.fillStyle(0xe0b887).fillRect(x-(side?4:17),y-(side?17:5),side?1:34,side?32:1);
      }
      else if(item.kind===2) {
        this.decor.fillStyle(0x654c3a).fillRect(x-(side?10:17),y-(side?17:10),side?20:34,side?34:20);
        this.decor.fillStyle(0xc09c6b).fillRect(x-(side?8:15),y-(side?15:8),side?16:30,side?30:16);
        this.decor.fillStyle(0x7e6347).fillRect(x-(side?3:12),y-(side?12:3),side?6:24,side?24:6);
      }
      else if(item.kind===3) {this.decor.fillStyle(0x547f85).fillRect(x-10,y-19,20,33);this.decor.fillStyle(0xc3e5df).fillRect(x-7,y-16,14,11);this.decor.fillStyle(0x8fbdb7).fillRect(x-5,y-14,10,7);this.decor.fillStyle(0x3a575a).fillRect(x-5,y+5,10,4);}
      else {this.decor.fillStyle(0x34373a).fillRoundedRect(x-10,y-21,20,40,6);this.decor.fillStyle(0xa7554a).fillRoundedRect(x-8,y-17,16,31,5);this.decor.fillStyle(0xd5a77d).fillRect(x-8,y-11,16,3);this.decor.fillStyle(0x30353b).fillRect(x-3,y-25,6,5);}
      if(this.selectedFurniture===i) this.decor.lineStyle(2,0xffe08a).strokeRect(x-24,y-27,48,54);
    });
    const level=this.saveData.equipment||0;
    if(level>=1) {
      layer(95);
      this.stations.push({x:308,y:82,rx:9,ry:13,id:'legacy-bag',pose:'bag',fixture:this.decor});
      this.decor.fillStyle(0x8e3834).fillRoundedRect(302,63,13,38,3);
      this.decor.fillStyle(0x242a2b).fillRect(305,60,7,4);
      this.decor.lineStyle(1,0xd5b88a).lineBetween(308,53,308,60);
    }
    if(level>=2) {
      layer(150);
      this.stations.push({x:310,y:150,rx:15,ry:9,id:'legacy-weights',pose:'lift'});
      this.decor.fillStyle(0x343b40).fillRect(302,147,17,6);
      this.decor.fillStyle(0xd2ae6e).fillRect(298,143,5,14);
      this.decor.fillStyle(0xd2ae6e).fillRect(318,143,5,14);
    }
    if(level>=3) {
      layer(60);
      this.decor.fillStyle(0x733e36).fillRect(45,43,45,5);
      this.decor.fillStyle(0xe5d1a0).fillRect(49,44,37,2);
      this.decor.fillStyle(0xd9bd80).fillRect(46,48,3,13);
      this.decor.fillStyle(0xd9bd80).fillRect(86,48,3,13);
    }
    // New equipment purchases appear as compact floor fixtures.
    (this.saveData.ownedGear||[]).forEach((owned,i)=>{
      if(!owned||this.saveData.gearStored?.[i])return;
      const pos=this.saveData.gearPositions?.[i];
      const x=pos?.x||65+(i%4)*57,y=pos?.y||(i<4?80:180);
      layer(y+GEAR_BOUNDS[i].ry*0.6);
      // Distinct, readable pixel silhouettes instead of eight identical boxes.
      const g=this.decor;
      if([0,2,4,5].includes(i))this.stations.push({
        x,y,...GEAR_BOUNDS[i],id:'gear-'+i,pose:i<4?'bag':'lift',fixture:i<4?g:undefined
      });
      g.fillStyle(0x203b42,0.28).fillEllipse(x,y+5,28,9);
      if(i===0){ // Heavy bag
        g.fillStyle(0x2c3335).fillRect(x-2,y-25,4,8);
        g.fillStyle(0x493339).fillRect(x-8,y-19,16,28).fillRect(x-10,y-16,20,21);
        g.fillStyle(0xa04a40).fillRect(x-7,y-18,14,25).fillRect(x-8,y-16,16,20);
        g.fillStyle(0xbd6854).fillRect(x-7,y-13,3,15);
        g.fillStyle(0x7d413b).fillRect(x+5,y-13,3,16);
        g.fillStyle(0xd0a777).fillRect(x-9,y-15,18,3);
        g.fillStyle(0x733b35).fillRect(x-8,y+3,16,3);
        g.fillStyle(0xe9bd86).fillRect(x-2,y-8,4,1).fillRect(x-3,y-7,6,4).fillRect(x-2,y-3,4,1);
      }else if(i===1){ // Thai pads
        g.fillStyle(0x674534).fillRect(x-13,y-4,26,10);
        g.fillStyle(0xc8915c).fillRoundedRect(x-12,y-10,11,16,3);
        g.fillStyle(0xc8915c).fillRoundedRect(x+1,y-10,11,16,3);
        g.fillStyle(0x543b34).fillRect(x-8,y-7,4,11);
        g.fillStyle(0x543b34).fillRect(x+5,y-7,4,11);
      }else if(i===2){ // Speed bag
        g.fillStyle(0x343e43).fillRect(x-2,y-23,4,13);
        g.fillStyle(0x3b4b50).fillRect(x-12,y-23,24,4);
        g.fillStyle(0x8b463d).fillRoundedRect(x-6,y-11,12,15,5);
        g.fillStyle(0xc28e62).fillRect(x-4,y-9,8,2);
      }else if(i===3){ // Jump rope
        g.lineStyle(3,0xc5a15b).strokeEllipse(x,y-2,24,16);
        g.fillStyle(0x34575b).fillRect(x-14,y-5,6,4);
        g.fillStyle(0x34575b).fillRect(x+8,y-5,6,4);
      }else if(i===4){ // Bench
        g.fillStyle(0x353d47).fillRoundedRect(x-13,y-10,26,9,2);
        g.fillStyle(0x8c989d).fillRect(x-10,y-1,4,12);
        g.fillStyle(0x8c989d).fillRect(x+6,y-1,4,12);
        g.fillStyle(0x222c31).fillRect(x-12,y+8,24,3);
      }else if(i===5){ // Kettlebells
        for(const dx of [-7,7]){
          g.lineStyle(3,0x394c4c).strokeRect(x+dx-4,y-12,8,7);
          g.fillStyle(0x617d76).fillRoundedRect(x+dx-7,y-6,14,14,4);
          g.fillStyle(0xa7b4a4).fillRect(x+dx-4,y-4,4,3);
        }
      }else if(i===6){ // Treadmill
        g.fillStyle(0x3b4c53).fillRect(x-12,y-6,24,15);
        g.fillStyle(0x758c91).fillRect(x-9,y-3,18,9);
        g.fillStyle(0x30383b).fillRect(x-12,y-20,4,17);
        g.fillStyle(0x30383b).fillRect(x+8,y-20,4,17);
        g.fillStyle(0x80b9b1).fillRect(x-9,y-22,18,5);
      }else{ // Assault bike
        g.lineStyle(3,0x445c61).strokeCircle(x-9,y+3,7);
        g.lineStyle(3,0x445c61).strokeCircle(x+9,y+3,7);
        g.lineStyle(3,0x8da8a1).lineBetween(x-9,y+3,x+1,y-11);
        g.lineBetween(x+1,y-11,x+9,y+3);
        g.fillStyle(0x364f50).fillRect(x-3,y-14,13,4);
        g.fillStyle(0xb99d6f).fillRect(x-13,y-17,12,3);
      }
      if(this.placingGear===i)this.decor.lineStyle(2,0xffe08a).strokeRect(x-12,y-11,24,22);
    });
    const decor=this.saveData.decorLevel||0;
    const pos=this.saveData.decorPositions||defaults.decorPositions!;
    if(decor>=1) {
      const p=pos[0];
      layer(p.y);
      this.decor.fillStyle(0xe8d4a1).fillRect(p.x-25,p.y-9,50,18);
      this.decor.fillStyle(0x943f36).fillRect(p.x-21,p.y-5,42,10);
      this.decor.fillStyle(0xf4e4c3).fillRect(p.x-17,p.y-1,34,2);
    }
    if(decor>=2) {
      const p=pos[1];
      layer(p.y);
      this.decor.fillStyle(0x866142).fillRect(p.x-23,p.y-9,47,18);
      this.decor.fillStyle(0xd9bd80).fillRect(p.x-19,p.y-6,39,12);
      this.decor.fillStyle(0x476d66).fillRect(p.x-15,p.y-2,31,4);
    }
    if(decor>=3) {
      const p=pos[2];
      layer(p.y);
      this.decor.fillStyle(0x355d45).fillRect(p.x-8,p.y-6,16,20);
      this.decor.fillStyle(0x4d885c).fillCircle(p.x,p.y-11,12);
      this.decor.fillStyle(0x7ca76d).fillCircle(p.x-5,p.y-14,5);
    }
    if(this.placingDecor>=0) {
      const p=pos[this.placingDecor];
      layer(p.y);
      this.decor.lineStyle(2,0xffe08a).strokeRect(p.x-27,p.y-22,54,42);
    }

  }
  private openExpansion():void {
    const level=this.gymLevel();
    const current=GYM_LEVELS[level-1],next=GYM_LEVELS[level];
    this.menuShell('GYM EXPANSION','LEVEL '+level+' / 5   '+current.name,()=>this.openGymUpgrades());
    this.furniturePanel.add(this.add.text(86,77,'STUDENTS '+this.students.length+' / '+current.capacity+'   ON FLOOR '+this.activeStudents().length,{fontFamily:UI_FONT,fontSize:'12px',color:'#fff0d3'}));
    if(!next){
      this.furniturePanel.add(this.add.text(86,111,'MAX LEVEL: COMBAT ACADEMY',{fontFamily:UI_FONT,fontSize:'11px',color:'#a9dfbd'}));
      return;
    }
    const owned=this.saveData.ownedGear?.filter(Boolean).length||0;
    const goals:[string,number,number][]=[
      ['CASH',this.saveData.money,next.cost],
      ['REPUTATION',this.saveData.reputation,next.reputation],
      ['CLASSES TAUGHT',this.saveData.classesTaught||0,next.classesTaught],
      ['GEAR OWNED',owned,next.gearOwned]
    ];
    this.furniturePanel.add(this.add.text(86,100,'NEXT: '+next.name+'  /  '+next.capacity+' STUDENTS',{fontFamily:UI_FONT,fontSize:'11px',color:'#f2d291'}));
    goals.forEach(([label,have,required],i)=>{
      this.furniturePanel.add(this.add.text(87,124+i*17,label+': '+have+' / '+required,{fontFamily:UI_FONT,fontSize:'10px',color:have>=required?'#a9dfbd':'#f1b4a6'}));
    });
    const ready=canExpandGym(level,this.saveData.money,this.saveData.reputation,this.saveData.classesTaught||0,owned);
    this.panelButton(this.furniturePanel,ready?'EXPAND GYM':'LOCKED',229,201,167,31,()=>{
      if(!canExpandGym(this.gymLevel(),this.saveData.money,this.saveData.reputation,
        this.saveData.classesTaught||0,this.saveData.ownedGear?.filter(Boolean).length||0))return;
      this.saveData.money-=next.cost;
      this.saveData.gymLevel=level+1;
      this.persist();
      this.scene.restart({notice:'Expanded to '+next.name+'! Open Roster to recruit students.'});
    },!ready);
  }
  private recruitStudent():void {
    const count=this.students.length;
    const capacity=studentCapacity(this.gymLevel()),cost=recruitmentCost(count);
    if(count>=capacity){this.say('Gym is at capacity. Expand before recruiting.');return;}
    if(this.saveData.money<cost){this.say('Need $'+cost+' to recruit another student.');return;}
    this.saveData.money-=cost;
    this.saveData.enrolledStudents=count+1;
    this.students.push({...STUDENT_HOMES[count%STUDENT_HOMES.length],
      name:STUDENT_NAMES[count],friendship:0,skill:0,chatCooldown:12+count*5});
    this.persist();
    this.scene.restart({notice:STUDENT_NAMES[count]+' joined your gym! ('+(count+1)+'/'+capacity+')'});
  }
  private openGymUpgrades():void {
    if(this.running||this.isPlacing())return;
    this.clearIntent();
    this.menuShell('MANAGE GYM','Shop, arrange equipment, or start a new day.');
    const actions:[string,()=>void][]=[
      ['TRAINING GEAR',()=>this.openGearShop()],
      ['DECORATIONS',()=>this.openUpgradePurchase('decor')],
      ['FURNITURE SHOP',()=>this.openFurniture('shop')],
      ['BUILD / ARRANGE',()=>this.openFurniture('build')],
      ['INVENTORY / SELL',()=>this.openFurniture('inventory')],
      ['MATERIALS / CRAFT',()=>this.openMaterials()],
      ['EXPAND GYM',()=>this.openExpansion()],
      ['NEXT DAY',()=>{this.furniturePanel.setVisible(false);this.nextDay();}]
    ];
    actions.forEach(([label,fn],i)=>this.menuAction(label,84+(i%2)*161,77+Math.floor(i/2)*36,149,fn));
    this.panelButton(this.furniturePanel,'EDIT COACH / WARDROBE',84,216,149,25,
      ()=>this.openCoachWardrobe(),false,0x39735f);
    this.panelButton(this.furniturePanel,'NEW GYM / RESET',245,216,149,25,
      ()=>this.confirmNewGym(),false,0x564844);
  }
  private coachStyle():CoachAppearance {
    return normalizeUnlockedAppearance(this.saveData.coachAppearance,this.saveData.wardrobeOwned);
  }
  private changeCoachStyle(field:keyof CoachAppearance,direction:number):void {
    if(this.running)return;
    const appearance=this.coachStyle(),owned=normalizeCloset(this.saveData.wardrobeOwned);
    const lengths:Record<keyof CoachAppearance,number>={
      skin:COACH_SKINS.length,hair:COACH_HAIR.length,cut:5,
      top:COACH_SHIRTS.length,shorts:COACH_SHORTS.length,gloves:COACH_GLOVES.length
    };
    const total=lengths[field];
    for(let shift=1;shift<=total;shift++){
      const next=(appearance[field]+direction*shift+total*4)%total;
      if(['skin','hair','cut'].includes(field)||
        hasClothing(field as ClothingSlot,next,owned)){
        appearance[field]=next;break;
      }
    }
    this.saveData.coachAppearance=normalizeCoachAppearance(appearance);
    this.coach.setAppearance(this.saveData.coachAppearance);
    this.persist();
    this.openCoachWardrobe();
  }
  private openCoachWardrobe():void {
    if(this.running)return;
    this.clearIntent();
    this.menuShell('YOUR COACH','Change your look. Purchases are cosmetic only.');
    const appearance=this.coachStyle();
    const fields:{field:keyof CoachAppearance;label:string;total:number}[]=[
      {field:'skin',label:'Skin Tone',total:COACH_SKINS.length},
      {field:'hair',label:'Hair Color',total:COACH_HAIR.length},
      {field:'cut',label:'Haircut',total:5},
      {field:'top',label:'Shirt',total:COACH_SHIRTS.length},
      {field:'shorts',label:'Shorts',total:COACH_SHORTS.length},
      {field:'gloves',label:'Gloves',total:COACH_GLOVES.length}
    ];
    fields.forEach(({field,label,total},i)=>{
      const y=69+i*24;
      this.panelButton(this.furniturePanel,'‹',84,y,26,22,
        ()=>this.changeCoachStyle(field,-1));
      this.furniturePanel.add(this.add.text(119,y+5,
        label+' '+(appearance[field]+1)+'/'+total,
        {fontFamily:UI_FONT,fontSize:'10px',color:'#e4e7d7'}));
      this.panelButton(this.furniturePanel,'›',210,y,24,22,
        ()=>this.changeCoachStyle(field,1));
    });
    const avatar=this.add.image(318,129,this.coach.getTextureKey(),0).setScale(2.1);
    this.furniturePanel.add(avatar);
    this.furniturePanel.add(this.add.text(318,169,'YOUR COACH',{
      fontFamily:UI_FONT,fontSize:'10px',fontStyle:'bold',color:'#f3d5a0'
    }).setOrigin(.5));
    this.furniturePanel.add(this.add.text(318,187,'$'+this.saveData.money+
      '   |   '+normalizeCloset(this.saveData.wardrobeOwned).length+' items',{
      fontFamily:UI_FONT,fontSize:'10px',color:'#a6d2ba'
    }).setOrigin(.5));
    this.panelButton(this.furniturePanel,'BACK TO MANAGE',84,218,149,25,
      ()=>this.openGymUpgrades());
    this.panelButton(this.furniturePanel,'CLOTHING SHOP',245,218,149,25,
      ()=>{this.wardrobePage=0;this.openClothingShop();},false,0x39735f);
  }
  private buyOrEquipStyle(id:number):void {
    const item=CLOTHING_SHOP[id];
    if(!item||this.running)return;
    const owned=normalizeCloset(this.saveData.wardrobeOwned);
    if(!owned.includes(id)){
      if(this.saveData.money<item.price){
        this.say('Need $'+item.price+' to buy '+item.name+'.');return;
      }
      this.saveData.money-=item.price;
      owned.push(id);
      this.saveData.wardrobeOwned=normalizeCloset(owned);
    }
    const appearance=this.coachStyle();
    appearance[item.slot]=item.value;
    this.saveData.coachAppearance=appearance;
    this.coach.setAppearance(appearance);
    this.persist();this.refresh();
    this.openClothingShop();
    this.say(item.name+' equipped. Cosmetic only.');
  }
  private openClothingShop():void {
    if(this.running)return;
    this.menuShell('COACH CLOTHING SHOP','Buy shirts, shorts and training gloves for your coach.');
    const owned=normalizeCloset(this.saveData.wardrobeOwned);
    const pageSize=5, pages=Math.ceil(CLOTHING_SHOP.length/pageSize);
    this.wardrobePage=Math.max(0,Math.min(pages-1,this.wardrobePage));
    CLOTHING_SHOP.slice(this.wardrobePage*pageSize,(this.wardrobePage+1)*pageSize)
      .forEach(item=>{
        const i=item.id%pageSize,already=owned.includes(item.id);
        const label=(already?'EQUIP  ':'BUY $'+item.price+'  ')+item.name;
        this.panelButton(this.furniturePanel,label,84,72+i*28,310,25,
          ()=>this.buyOrEquipStyle(item.id),!already&&this.saveData.money<item.price);
      });
    this.furniturePanel.add(this.add.text(183,218,
      'PAGE '+(this.wardrobePage+1)+'/'+pages+'   $'+this.saveData.money,{
        fontFamily:UI_FONT,fontSize:'10px',color:'#d9c8ab'
      }));
    this.panelButton(this.furniturePanel,'‹',84,216,35,26,
      ()=>{this.wardrobePage--;this.openClothingShop();},this.wardrobePage===0);
    this.panelButton(this.furniturePanel,'›',275,216,35,26,
      ()=>{this.wardrobePage++;this.openClothingShop();},this.wardrobePage>=pages-1);
    this.panelButton(this.furniturePanel,'WARDROBE',318,216,78,26,
      ()=>this.openCoachWardrobe());
  }

  private confirmNewGym():void {
    this.menuShell('START OVER?','THIS WILL DELETE YOUR SAVED GARAGE PROGRESS.',
      ()=>this.openGymUpgrades());
    this.furniturePanel.add(this.add.text(84,91,
      'Your day, students, money, equipment, and all unlocks will reset.\n' +
      'Only the current game preview save is affected.',{
        fontFamily:UI_FONT,fontSize:'11px',color:'#f1cbb6',
        wordWrap:{width:305},lineSpacing:7
      }));
    this.panelButton(this.furniturePanel,'CANCEL',84,185,149,30,
      ()=>this.openGymUpgrades());
    this.panelButton(this.furniturePanel,'ERASE + RESTART',245,185,149,30,()=>{
      // Immediately persist the clean save so a reload or tab restore cannot
      // bring back the old progress after the confirmation.
      try {localStorage.setItem(SAVE_KEY,JSON.stringify(newSave()));}
      catch {this.say('Unable to reset the save in this browser.');return;}
      this.scene.restart({notice:'New garage started. Teach two classes each day to grow.'});
    },false,0x87483f);
  }
  private addShopInventory(y:number):void {
    const stock=this.saveData.materials||[0,0,0];
    const label='YOU HAVE  USD '+this.saveData.money+'  |  '+MATERIAL_NAMES.map((name,i)=>name+' '+(stock[i]||0)).join('  ');
    this.furniturePanel.add(this.add.rectangle(80,y-4,319,23,0x152f33).setOrigin(0).setStrokeStyle(1,0xd4b783));
    this.furniturePanel.add(this.add.text(84,y,label,{fontFamily:UI_FONT,fontSize:'10px',color:'#f4d68c'}));
  }
  private openGearShop():void {
    this.menuShell('TRAINING EQUIPMENT','PURCHASE  /  PLACE  /  UPGRADE',()=>this.openGymUpgrades());
    GEAR_ITEMS.forEach((gear,i)=>{
      const owned=this.saveData.ownedGear?.[i]===true;
      const line=this.add.text(84+(i%2)*161,69+Math.floor(i/2)*30,gear.name+'  '+(owned?'[MOVE]':'$'+gear.cost),{fontFamily:UI_FONT,fontSize:'9px',color:owned?'#8ec4a8':'#ffffff',backgroundColor:'#34575b',padding:{x:5,y:6}}).setInteractive({useHandCursor:true});
      line.on('pointerdown',()=>{
        if(owned){this.beginGearPlacement(i);return;}
        if(this.saveData.money<gear.cost){this.say('Not enough money for '+gear.name+'.');return;}
        if(!hasMaterials(this.saveData.materials,GEAR_MATERIALS[i])){this.say('Need '+materialCost(GEAR_MATERIALS[i])+' for '+gear.name+'.');return;}
        this.saveData.money-=gear.cost;
        this.saveData.materials=spendMaterials(this.saveData.materials,GEAR_MATERIALS[i]);
        if(!this.saveData.ownedGear)this.saveData.ownedGear=Array(8).fill(false);
        this.saveData.ownedGear[i]=true;
        if(!this.saveData.gearStored)this.saveData.gearStored=Array(8).fill(false);
        this.saveData.gearStored[i]=true;
        this.persist();this.refresh();this.furniturePanel.setVisible(false);
        this.say('Purchased '+gear.name+'! Open Build to place it.');
      });this.furniturePanel.add(line);
    });
    this.addShopInventory(189);
    this.menuAction('GYM UPGRADES',245,213,149,()=>this.openUpgradePurchase('equipment'));
    this.furniturePanel.setVisible(true);
  }
  private beginGearPlacement(index:number):void {
    this.clearIntent();
    this.placingGear=index;
    this.selectedFurniture=-1;this.placingDecor=-1;this.buildMode=true;
    const pos=this.saveData.gearPositions?.[index];this.placementCursor=pos&&!this.saveData.gearStored?.[index]?{...pos}:{x:168,y:144};this.keyboardPlacement=true;
    this.furniturePanel.setVisible(false);
    this.updateFurnitureActions();
    this.drawEquipment();
    this.say('Placing '+GEAR_ITEMS[index].name+'. Tap a clear spot on the mat.');
  }
  private placeGear(x:number,y:number):void {
    if(this.placingGear<0)return;
    x=roundPlacement(x);y=roundPlacement(y);
    const {rx,ry}=GEAR_BOUNDS[this.placingGear];
    if(!this.validPlacement(x,y,rx,ry,this.placingGear)){this.say('Choose a clear spot inside the mat.');return;}
    if(!this.saveData.gearPositions)this.saveData.gearPositions=Array.from({length:8},(_,i)=>({x:65+(i%4)*57,y:i<4?80:180}));
    this.saveData.gearPositions[this.placingGear]={x,y};
    const name=GEAR_ITEMS[this.placingGear].name;
    if(!this.saveData.gearStored)this.saveData.gearStored=Array(8).fill(false);
    this.saveData.gearStored[this.placingGear]=false;
    this.placingGear=-1;this.keyboardPlacement=false;this.buildMode=false;this.updateFurnitureActions();this.persist();this.refresh();
    this.say(name+' placed. Use Build to move it again.');
  }
  private openMaterials():void {
    const collected=this.saveData.gatheredToday?.length||0;
    this.menuShell('MATERIALS & CRAFT',collected+'/12 pickups collected today',()=>this.openGymUpgrades());
    const stock=this.saveData.materials||[0,0,0];
    this.furniturePanel.add(this.add.text(84,75,MATERIAL_NAMES.map((name,i)=>name+': '+(stock[i]||0)).join('    '),{fontFamily:UI_FONT,fontSize:'10px',color:'#f4d68c'}));
    this.furniturePanel.add(this.add.text(84,94,collected>=12?'All pickups collected. New materials appear tomorrow.':'Tap scattered material piles in the gym to collect them.',{fontFamily:UI_FONT,fontSize:'9px',color:'#b9d6c8',wordWrap:{width:310}}));
    const recipes=[{name:'Gym Supplies',cost:[3,1,0],reward:25},{name:'Salvage Bundle',cost:[2,2,2],reward:60}];
    recipes.forEach((recipe,i)=>{
      const canCraft=recipe.cost.every((amount,j)=>stock[j]>=amount);
      const cost=recipe.cost.map((amount,j)=>amount?amount+' '+MATERIAL_NAMES[j]:'').filter(Boolean).join(' + ');
      this.panelButton(this.furniturePanel,recipe.name+'  +$'+recipe.reward,84,122+i*43,310,35,()=>{
        const current=this.saveData.materials||[0,0,0];
        if(recipe.cost.some((amount,j)=>current[j]<amount)){this.say('Not enough materials. Gather more piles in the gym.');return;}
        recipe.cost.forEach((amount,j)=>current[j]-=amount);
        this.saveData.materials=current;
        this.saveData.money+=recipe.reward;
        this.persist();this.refresh();this.openMaterials();
        this.say('Crafted '+recipe.name+' and earned $'+recipe.reward+'.');
      },!canCraft,0x39735f,cost);
    });
    this.panelButton(this.furniturePanel,collected===12?'ALL SUPPLIES COLLECTED':'FIND NEXT SUPPLY PILE',168,211,225,27,()=>this.collectNextSupply(),collected===12,0x39735f);
    this.furniturePanel.setVisible(true);
  }
  // Deterministic daily material locations. No real-time timers or mandatory cleanup.
  private gatheringPositions:Point[]=[];
  private resourceKind(index:number):number {return (index+this.saveData.day)%3;}
  private resourceYield(index:number):number {return (index+this.saveData.day)%5===0?2:1;}
  private drawGatheringNodes():void {
    this.gatheringNodes.forEach(node=>node.destroy());this.gatheringNodes=[];
    this.gatheringPositions.forEach((pos,i)=>{
      if(this.saveData.gatheredToday?.includes(i))return;
      const g=this.add.graphics();
      g.fillStyle(0x263e3c,0.4).fillEllipse(0,3,15,5);
      const material=this.resourceKind(i);
      if(material===0){
        g.fillStyle(0x4b5556).fillRect(-6,-4,8,6).fillRect(2,-2,4,6);
        g.fillStyle(0xbcc6ba).fillRect(-5,-3,6,2).fillRect(3,-1,2,3);
      }else if(material===1){
        g.fillStyle(0x855e48).fillRect(-7,-2,14,5).fillRect(-4,-5,9,4);
        g.fillStyle(0xe6b47c).fillRect(-6,-2,12,2).fillRect(-3,-5,7,2);
      }else{
        g.fillStyle(0x886b66).fillRect(-6,-4,12,7);
        g.fillStyle(0xd9a899).fillRect(-5,-3,10,5);
        g.fillStyle(0xf1d7ab).fillRect(-1,-4,2,7);
      }
      const node=this.add.container(pos.x,pos.y,[g]).setDepth(6);
      this.gatheringNodes.push(node);
    });
  }
  private collectNextSupply():void {
    this.furniturePanel.setVisible(false);
    const remaining=this.gatheringPositions.filter((_,i)=>!this.saveData.gatheredToday?.includes(i));
    if(!remaining.length){this.say('All supplies collected today. Start a new day.');return;}
    remaining.sort((a,b)=>distance(a,this.player)-distance(b,this.player));
    this.collectNodeAt(remaining[0].x,remaining[0].y);
  }
  private collectNodeAt(x:number,y:number):boolean {
    const i=this.gatheringPositions.findIndex((p,index)=>!this.saveData.gatheredToday?.includes(index)&&Phaser.Math.Distance.Between(p.x,p.y,x,y)<13);
    if(i<0)return false;
    if(distance(this.player,this.gatheringPositions[i])>55){
      this.clearIntent();
      const pile=this.gatheringPositions[i];
      // Route toward a reachable point near the pile, even if it sits
      // behind a training fixture. Never set an impossible pickup target.
      const approaches=[pile,...[0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI/4,Math.PI*3/4,Math.PI*5/4,Math.PI*7/4]
        .map(a=>({x:pile.x+Math.round(Math.cos(a)*28),y:pile.y+Math.round(Math.sin(a)*28)}))]
        .filter(p=>this.canStand(p.x,p.y)&&distance(pile,p)<50);
      approaches.sort((a,b)=>distance(a,this.player)-distance(b,this.player));
      for(const approach of approaches){
        const route=this.playerRoute(approach,true);
        if(route.length){
          this.pickupTarget=pile;this.route=route;
          this.say('Walking to the supplies.');return true;
        }
      }
      this.say('No clear route to that pile. Move the blocking equipment.');
      return true;
    }
    if(!this.saveData.materials)this.saveData.materials=[0,0,0];
    if(!this.saveData.gatheredToday)this.saveData.gatheredToday=[];
    const kind=this.resourceKind(i),amount=this.resourceYield(i);
    this.saveData.materials[kind]+=amount;this.saveData.gatheredToday.push(i);
    this.persist();this.refresh();this.showFeedback('+'+amount+' '+MATERIAL_NAMES[kind]);
    this.say('Collected '+amount+' '+MATERIAL_NAMES[kind]+'. Save materials for equipment, furniture and decor.');
    return true;
  }
  private collectNearby():boolean {
    const p=this.gatheringPositions.find((p,i)=>!this.saveData.gatheredToday?.includes(i)&&Phaser.Math.Distance.Between(this.player.x,this.player.y,p.x,p.y)<24);
    return p?this.collectNodeAt(p.x,p.y):false;
  }
  private selectedSlot=0;
  private matchingClassGear(stats:number[]):number {
    return GEAR_ITEMS.filter((item,i)=>stats.includes(item.stat)&&
      this.saveData.ownedGear?.[i]&&!this.saveData.gearStored?.[i]).length;
  }
  private openClassSchedule():void {
    const finished=this.saveData.classesToday||0;
    const plan=this.saveData.classPlan??[0,1];
    const slot=this.selectedSlot;
    const programIndex=plan[slot]??0;
    const program=CLASS_PROGRAMS[programIndex];
    const editable=slot>=finished;
    this.menuShell('CLASS SCHEDULE','PLAN TWO SESSIONS. CLASSES RUN IN ORDER.',()=>this.openTrainingBoard());
    CLASS_PROGRAMS.forEach((option,i)=>{
      const selected=i===programIndex;
      this.panelButton(this.furniturePanel,(selected?'• ':'')+option.name,84,73+i*31,142,27,()=>{
        if(!editable)return;
        this.saveData.classPlan=normalizeClassPlan(this.saveData.classPlan);
        this.saveData.classPlan[slot]=i;
        this.persist();
        this.openClassSchedule();
      },!editable,selected?0x527f74:0x355b5d);
    });
    [0,1].forEach((position)=>{
      const session=CLASS_PROGRAMS[plan[position]??position];
      const selected=slot===position;
      const done=position<finished;
      const label=(position===0?'1  AM: ':'2  PM: ')+session.name+(done?' ✓':'');
      this.panelButton(this.furniturePanel,label,238,72+position*31,157,27,()=>{
        this.selectedSlot=position;
        this.openClassSchedule();
      },false,selected?0x527f74:0x355b5d);
    });
    const matchingGear=this.matchingClassGear(program.stats);
    const earnings=classEarnings(this.gymLevel(),this.students.length,matchingGear,this.saveData.equipment||0);
    this.furniturePanel.add(this.add.text(239,137,program.stats.map(k=>CORE_STATS[k]).join(' + '),
      {fontFamily:UI_FONT,fontSize:'9px',color:'#c7ddd2',wordWrap:{width:152}}));
    this.furniturePanel.add(this.add.text(239,160,'+$'+earnings+'   +'+CLASS_REPUTATION+' REP   GEAR '+matchingGear,
      {fontFamily:UI_FONT,fontSize:'9px',color:'#aee0b0'}));
    const ready=finished<2&&slot===finished;
    const label=finished>=2?'DAILY LIMIT':slot<finished?'ALREADY TAUGHT':'TEACH SESSION '+(slot+1);
    this.panelButton(this.furniturePanel,label,238,180,157,30,()=>{
      if(ready)this.startClass(programIndex);
    },!ready,0x39735f);
    this.furniturePanel.add(this.add.text(168,220,'Class starts in the gym. Help students to earn better rewards.',
      {fontFamily:UI_FONT,fontSize:'9px',color:'#b7cec8',wordWrap:{width:224}}));
    this.furniturePanel.setVisible(true);
  }
  private simulateClass(index:number,quality=0.5,showSchedule=true):void {
    if((this.saveData.classesToday||0)>=2){this.say('Two classes already taught today.');return;}
    const program=CLASS_PROGRAMS[index];
    if(!program)return;
    if(!this.saveData.studentStats)this.saveData.studentStats=initialStats();
    if(!this.saveData.studentXP)this.saveData.studentXP=initialXP();
    const attendance=this.activeStudents().map(student=>this.students.indexOf(student));
    const performance=Math.max(0,Math.min(1,quality));
    for(const student of attendance){
      for(const stat of program.stats){
        const matching=GEAR_ITEMS.filter((item,i)=>item.stat===stat&&
          this.saveData.ownedGear?.[i]&&!this.saveData.gearStored?.[i]).length;
        const gearBonus=matching>0?5:0;
        let xp=(this.saveData.studentXP[student][stat]||0)+6+Math.round(performance*8)+gearBonus;
        let value=this.saveData.studentStats[student][stat]||10;
        while(value<100 && xp>=statThreshold(value)){xp-=statThreshold(value);value++;}
        this.saveData.studentStats[student][stat]=value;
        this.saveData.studentXP[student][stat]=value>=100?0:xp;
      }
    }
    this.checkStudentGoals();
    this.saveData.classesToday=(this.saveData.classesToday||0)+1;
    this.selectedSlot=Math.min(this.saveData.classesToday,1);
    this.saveData.classesTaught=(this.saveData.classesTaught||0)+1;
    const base=classEarnings(this.gymLevel(),this.students.length,
      this.matchingClassGear(program.stats),this.saveData.equipment||0);
    const earnings=Math.round(base*(0.7+performance*0.6));
    const rep=performance>=0.85?4:performance>=0.6?3:
      performance>=0.5?CLASS_REPUTATION:1;
    this.saveData.money+=earnings;
    this.saveData.lifetimeEarnings=(this.saveData.lifetimeEarnings||0)+earnings;
    this.saveData.reputation+=rep;
    if((this.saveData.classesTaught||0)%4===0)
      attendance.forEach(student=>this.students[student].skill++);
    this.persist();this.refresh();
    this.say(program.name+' class completed! +$'+earnings+' and +'+rep+
      ' REP. '+attendance.length+' students trained.');
    if(showSchedule)this.openClassSchedule();
  }
  private checkStudentGoals():void {
    if(!this.saveData.studentGoals)this.saveData.studentGoals=initialGoals();
    if(!this.saveData.completedGoals)this.saveData.completedGoals=STUDENT_NAMES.map(()=>0);
    this.students.forEach((student,i)=>{
      const goal=this.saveData.studentGoals![i];
      if((this.saveData.studentStats?.[i]?.[goal[1]]||0)<goal[0])return;
      this.saveData.completedGoals![i]++;
      this.saveData.reputation+=2;
      this.saveData.money+=20;
      const nextStat=(goal[1]+1+i%2)%4;
      const current=this.saveData.studentStats?.[i]?.[nextStat]||10;
      this.saveData.studentGoals![i]=[Math.min(100,Math.max(current+5,goal[0]+5)),nextStat];
      this.showFeedback(student.name+' GOAL COMPLETE');
    });
  }
  private showStudentGoals():void {
    const pages=Math.max(1,Math.ceil(this.students.length/4));
    this.goalsPage=Math.min(this.goalsPage,pages-1);
    this.menuShell('STUDENT GOALS','TRAINING PROGRESS  /  PAGE '+(this.goalsPage+1)+' OF '+pages,()=>this.openTrainingBoard());
    this.students.slice(this.goalsPage*4,this.goalsPage*4+4).forEach((student,i)=>{
      const index=this.goalsPage*4+i;
      const goal=(this.saveData.studentGoals||initialGoals())[index];
      const current=this.saveData.studentStats?.[index]?.[goal[1]]||10;
      this.furniturePanel.add(this.add.text(84,80+i*34,student.name+'  '+CORE_STATS[goal[1]]+' '+current+'/'+goal[0]+'  |  Completed '+(this.saveData.completedGoals?.[index]||0),{fontFamily:UI_FONT,fontSize:'11px',color:'#ffffff'}));
    });
    if(this.goalsPage>0)this.panelButton(this.furniturePanel,'PREV',170,212,70,27,()=>{this.goalsPage--;this.showStudentGoals();});
    if(this.goalsPage<pages-1)this.panelButton(this.furniturePanel,'NEXT',267,212,70,27,()=>{this.goalsPage++;this.showStudentGoals();});
  }
  private openUpgradePurchase(kind:'equipment'|'decor'):void {
    const level=kind==='equipment'?(this.saveData.equipment||0):(this.saveData.decorLevel||0);
    const names=kind==='equipment'?['Heavy bag','Weight station','Training rack']:['Gym banner','Training poster','Indoor plant'];
    const cost=kind==='equipment'?40+level*35:25+level*25;
    const back=()=>kind==='equipment'?this.openGearShop():this.openGymUpgrades();
    this.menuShell(kind==='equipment'?'GYM UPGRADES':'GYM DECORATIONS','LEVEL '+level+' / 3',back);
    const complete=level>=3;
    const materials=kind==='decor'&&!complete?DECOR_MATERIALS[level]:[0,0,0];
    const canPay=!complete&&this.saveData.money>=cost&&hasMaterials(this.saveData.materials,materials);
    const next=complete?'MAX LEVEL REACHED':'NEXT: '+names[level].toUpperCase();
    this.furniturePanel.add(this.add.text(84,80,next,{fontFamily:UI_FONT,fontSize:'13px',fontStyle:'bold',color:'#f7e9cb'}));
    this.furniturePanel.add(this.add.text(84,109,complete?'All upgrades purchased.':('Price: $'+cost+(kind==='decor'?' + '+materialCost(materials):'')),{fontFamily:UI_FONT,fontSize:'10px',color:'#f4d68c',wordWrap:{width:310}}));
    this.furniturePanel.add(this.add.text(84,134,kind==='equipment'?'Unlocks gym fixtures and improves class rewards.':'Adds a visible decoration you can reposition in Build mode.',{fontFamily:UI_FONT,fontSize:'10px',color:'#e1d4bb',wordWrap:{width:305}}));
    if(!complete)this.panelButton(this.furniturePanel,canPay?'PURCHASE UPGRADE':'INSUFFICIENT RESOURCES',84,168,310,33,()=>{
      if(!canPay)return;
      if(kind==='equipment')this.upgradeEquipment();else this.buyDecor();
      this.openUpgradePurchase(kind);
    },!canPay,0x39735f);
    const stock=this.saveData.materials||[0,0,0];
    this.furniturePanel.add(this.add.text(168,217,'$'+this.saveData.money+
      '   SCRAP '+(stock[0]||0)+'   WOOD '+(stock[1]||0)+'   FABRIC '+(stock[2]||0),
      {fontFamily:UI_FONT,fontSize:'9px',color:'#f4d68c'}));
    this.furniturePanel.setVisible(true);
  }
  private sellFurniture(index:number):void {
    const items=this.saveData.furniture||[];
    const item=items[index];if(!item)return;
    const refund=Math.floor(FURNITURE[item.kind].price/2);
    this.saveData.money+=refund;items.splice(index,1);
    this.selectedFurniture=-1;this.placingDecor=-1;
    this.updateFurnitureActions();this.persist();this.refresh();
    this.openFurniture('inventory');
    this.say('Sold '+FURNITURE[item.kind].name+' for USD '+refund+' (50% resale).');
  }
  private openFurniture(mode:'shop'|'inventory'|'build'):void {
    if(this.running) { this.say('Finish class before using the shop.'); return; }
    const heading=mode==='shop'?'FURNITURE SHOP':mode==='build'?'BUILD MODE':'YOUR INVENTORY';
    this.menuShell(heading,mode==='shop'?'Buy furniture and place it from Build.':'Select an item to move it.',mode==='inventory'?()=>this.openGymUpgrades():undefined);
    if(mode==='shop') FURNITURE.forEach((item,i)=>{
      const unlocked=this.saveData.reputation>=item.rep;
      const row=this.add.text(84,72+i*28,item.name+'  USD '+item.price+' + '+materialCost(FURNITURE_MATERIALS[i]||[1,1,1])+(unlocked?'':'  REP '+item.rep),{fontFamily:UI_FONT,fontSize:'11px',color:unlocked?'#f7e9cb':'#9eabb0',backgroundColor:'#34575b',padding:{x:5,y:3}}).setInteractive();
      row.on('pointerdown',()=>this.buyFurniture(i));
      this.furniturePanel.add(row);
    });
    else {
      // Unified paginated build inventory: furniture, gear and decorations.
      const entries:{name:string;status:string;select:()=>void;sell?:()=>void}[]=[];
      (this.saveData.furniture||[]).forEach((item,i)=>entries.push({
        name:FURNITURE[item.kind].name,status:item.stored?'STORED':'PLACED',
        select:()=>this.selectFurniture(i),sell:()=>this.sellFurniture(i)
      }));
      (this.saveData.ownedGear||[]).forEach((owned,i)=>{
        if(owned)entries.push({name:GEAR_ITEMS[i].name,status:this.saveData.gearStored?.[i]?'STORED':'PLACED',select:()=>this.beginGearPlacement(i)});
      });
      for(let i=0;i<(this.saveData.decorLevel||0);i++){
        const idx=i;
        entries.push({name:['Gym Banner','Training Poster','Indoor Plant'][i],status:'DECOR',select:()=>{
          this.placingDecor=idx;this.selectedFurniture=-1;this.placingGear=-1;this.buildMode=true;
          const p=this.saveData.decorPositions?.[idx];this.placementCursor=p?{...p}:{x:168,y:144};this.keyboardPlacement=true;
          this.furniturePanel.setVisible(false);this.updateFurnitureActions();this.say('Tap a new spot or use arrows and Enter.');
        }});
      }
      const pageSize=5,pages=Math.max(1,Math.ceil(entries.length/pageSize));
      this.buildPage=Math.min(this.buildPage,pages-1);
      entries.slice(this.buildPage*pageSize,(this.buildPage+1)*pageSize).forEach((entry,i)=>{
        const y=79+i*27;
        const row=this.add.rectangle(84,y,310,24,0x34575b).setOrigin(0).setStrokeStyle(1,0x557a78).setInteractive({useHandCursor:true});
        const label=this.add.text(90,y+6,entry.name+'  ['+entry.status+']',{fontFamily:UI_FONT,fontSize:'10px',color:'#f7e9cb'});
        row.on('pointerdown',entry.select);
        this.furniturePanel.add([row,label]);
        if(mode==='inventory'&&entry.sell){
          const sell=this.add.text(350,y+5,'SELL',{fontFamily:UI_FONT,fontSize:'9px',color:'#ffdbcb',backgroundColor:'#974c40',padding:{x:3,y:2}}).setInteractive({useHandCursor:true});
          sell.on('pointerdown',entry.sell);this.furniturePanel.add(sell);
        }
      });
      if(!entries.length)this.furniturePanel.add(this.add.text(84,94,'No items yet. Buy gear or furniture at reception.',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}));
      const pageLabel=this.add.text(229,224,'PAGE '+(this.buildPage+1)+' / '+pages,{fontFamily:UI_FONT,fontSize:'10px',color:'#f4d68c'});
      this.furniturePanel.add(pageLabel);
      if(this.buildPage>0){
        const prev=this.add.text(157,224,'< PREV',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}).setInteractive({useHandCursor:true});
        prev.on('pointerdown',()=>{this.buildPage--;this.openFurniture(mode);});this.furniturePanel.add(prev);
      }
      if(this.buildPage<pages-1){
        const next=this.add.text(319,224,'NEXT >',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}).setInteractive({useHandCursor:true});
        next.on('pointerdown',()=>{this.buildPage++;this.openFurniture(mode);});this.furniturePanel.add(next);
      }
    }
    this.rosterPanel.setVisible(false);
    if(mode==='shop')this.addShopInventory(217);
    this.furniturePanel.setVisible(true);
    this.say(mode==='build'?'Build mode open: choose an owned item to move.':mode==='shop'?'Furniture shop open.':'Inventory open.');
  }
  private buyFurniture(kind:number):void {
    const item=FURNITURE[kind];
    if(this.saveData.reputation<item.rep) {this.say('Requires reputation '+item.rep+'.');return;}
    if(this.saveData.money<item.price) {this.say('Need USD '+item.price+' to buy '+item.name+'.');return;}
    if(!hasMaterials(this.saveData.materials,FURNITURE_MATERIALS[kind]||[1,1,1])){this.say('Need '+materialCost(FURNITURE_MATERIALS[kind]||[1,1,1])+' to buy '+item.name+'.');return;}
    if((this.saveData.furniture||[]).length>=40) {this.say('Inventory full.');return;}
    this.saveData.money-=item.price;
    this.saveData.materials=spendMaterials(this.saveData.materials,FURNITURE_MATERIALS[kind]||[1,1,1]);
    this.saveData.furniture=[...(this.saveData.furniture||[]),{kind,x:160,y:120,rotation:0,stored:true}];
    this.selectedFurniture=-1;
    this.placingDecor=-1;
    this.furniturePanel.setVisible(false);
    this.updateFurnitureActions();
    this.persist();this.refresh();
    this.say('Purchased '+item.name+'! Open Build to place it.');
  }
  private selectFurniture(i:number):void {
    this.clearIntent();
    this.selectedFurniture=i;this.placingDecor=-1;this.placingGear=-1;this.buildMode=true;this.furniturePanel.setVisible(false);
    const position=this.saveData.furniture?.[i];if(position)this.placementCursor={x:position.stored?168:position.x,y:position.stored?144:position.y};this.keyboardPlacement=true;
    this.updateFurnitureActions();this.drawEquipment();
    const item=this.saveData.furniture?.[i];
    if(item) this.say('Moving '+FURNITURE[item.kind].name+'. Arrows move, Enter place, Q rotate, X store, Esc cancel.');
  }
  private updateFurnitureActions():void {
    this.hubControls.forEach(button=>button.setVisible(!this.isPlacing()));
    this.rotateControl.setVisible(this.selectedFurniture>=0);
    this.storeControl.setVisible(this.selectedFurniture>=0||this.placingGear>=0);
    this.cancelControl.setVisible(this.isPlacing());
  }
  private placeFurniture(x:number,y:number):void {
    if(this.running||this.selectedFurniture<0) return;
    const selected=this.saveData.furniture?.[this.selectedFurniture];if(!selected)return;
    x=roundPlacement(x);y=roundPlacement(y);
    const size=this.furnitureSize(selected);
    if(!this.validPlacement(x,y,size.rx,size.ry,-1,this.selectedFurniture)){this.say('Choose a clear spot inside the mat.');return;}
    selected.x=x;selected.y=y;selected.stored=false;
    this.selectedFurniture=-1;this.keyboardPlacement=false;this.buildMode=false;this.updateFurnitureActions();
    this.persist();this.drawEquipment();this.say(FURNITURE[selected.kind].name+' placed!');
  }
  private rotateFurniture():void {
    const item=this.saveData.furniture?.[this.selectedFurniture];if(!item||this.running)return;
    const rotation=(item.rotation+1)%4;
    const candidate={...item,rotation},size=this.furnitureSize(candidate);
    if(!item.stored&&!this.validPlacement(item.x,item.y,size.rx,size.ry,-1,this.selectedFurniture)){
      this.say('Not enough room to rotate here. Move the item first.');return;
    }
    item.rotation=rotation;this.persist();this.drawEquipment();this.say('Rotated '+FURNITURE[item.kind].name+'.');
  }
  private storeSelection():void {
    if(this.running)return;
    if(this.placingGear>=0){
      const index=this.placingGear;
      this.saveData.gearStored??=Array(8).fill(false);
      this.saveData.gearStored[index]=true;
      this.cancelPlacement();this.persist();this.say(GEAR_ITEMS[index].name+' returned to inventory.');
      return;
    }
    const item=this.saveData.furniture?.[this.selectedFurniture];
    if(!item)return;
    item.stored=true;
    this.cancelPlacement();this.persist();this.say(FURNITURE[item.kind].name+' returned to inventory.');
  }
  private decorFits(x:number,y:number):boolean {
    const plant=this.placingDecor===2;
    const positions=this.saveData.decorPositions??defaults.decorPositions!;
    return this.validPlacement(x,y,plant?11:25,12,-1,-1,plant)&&
      !positions.some((p,i)=>i!==this.placingDecor&&i<(this.saveData.decorLevel||0)&&distance(p,{x,y})<44);
  }
  private placeDecor(x:number,y:number):void {
    if(this.running||this.placingDecor<0)return;
    x=roundPlacement(x);y=roundPlacement(y);
    if(!this.decorFits(x,y)){this.say('Choose a clear spot inside the mat.');return;}
    const positions=this.saveData.decorPositions??defaults.decorPositions!.map(p=>({...p}));
    positions[this.placingDecor]={x,y};
    this.saveData.decorPositions=positions;
    this.cancelPlacement();this.persist();this.say('Decoration moved and saved.');
  }
  private buyDecor():void {
    if(this.running) { this.say('Shop after class.'); return; }
    const level=this.saveData.decorLevel||0;
    if(level>=3) { this.say('All decorations purchased.'); return; }
    const cost=25+level*25;
    if(this.saveData.money<cost) { this.say('Need USD '+cost+' to decorate.'); return; }
    if(!hasMaterials(this.saveData.materials,DECOR_MATERIALS[level])){this.say('Need '+materialCost(DECOR_MATERIALS[level])+' to decorate.');return;}
    this.saveData.materials=spendMaterials(this.saveData.materials,DECOR_MATERIALS[level]);
    this.saveData.money-=cost;
    this.saveData.decorLevel=level+1;
    this.persist(); this.refresh();
    this.recoverActors();
    this.showFeedback('GYM DECOR +1');
    this.say('Added '+['Gym banner','Training poster','Indoor plant'][level]+'! Your gym is growing.');
  }
  private toggleRoster():void {
    if(this.running){this.say('Check the roster after class.');return;}
    if(this.isPlacing()||this.furniturePanel.visible)return;
    if(this.rosterPanel.visible){this.rosterPanel.setVisible(false);return;}
    this.clearIntent();
    this.showRosterPage();
  }
  private showRosterPage():void {
    const panel=this.rosterPanel,count=this.students.length,capacity=studentCapacity(this.gymLevel());
    const pages=Math.max(1,Math.ceil(count/4));
    this.rosterPage=Math.min(this.rosterPage,pages-1);
    this.menuShell('STUDENT ROSTER',count+' / '+capacity+' ENROLLED   |   '+this.activeStudents().length+' ON FLOOR   |   PAGE '+(this.rosterPage+1)+'/'+pages,undefined,panel);
    this.students.slice(this.rosterPage*4,this.rosterPage*4+4).forEach((student,offset)=>{
      const i=this.rosterPage*4+offset;
      const x=81+(offset%2)*161,y=69+Math.floor(offset/2)*68;
      const stats=this.saveData.studentStats?.[i]||[10,10,10,10];
      const rank=student.skill>=10?'Advanced':student.skill>=5?'Intermediate':'Beginner';
      panel.add([
        this.add.rectangle(x,y,155,63,0x28494d).setOrigin(0).setStrokeStyle(1,0x698780),
        this.add.image(x+22,y+23,'gym-character-'+(1+i%4),0),
        this.add.text(x+44,y+6,student.name,{fontFamily:UI_FONT,fontSize:'12px',fontStyle:'bold',color:'#fff1d5'}),
        this.add.text(x+44,y+23,rank+'  |  Bond '+student.friendship,{fontFamily:UI_FONT,fontSize:'9px',color:'#c5ded4'}),
      ]);
      CORE_STATS.forEach((label,j)=>panel.add(
        this.add.text(x+8+(j%2)*69,y+40+Math.floor(j/2)*11,label+' '+stats[j],
          {fontFamily:UI_FONT,fontSize:'8px',color:'#f6d598'})
      ));
    });
    this.panelButton(panel,'PREV',83,211,75,26,()=>{this.rosterPage--;this.showRosterPage();},this.rosterPage===0);
    const price=recruitmentCost(count),full=count>=capacity;
    this.panelButton(panel,full?'AT CAPACITY':'RECRUIT $'+price,169,211,138,26,()=>this.recruitStudent(),full||this.saveData.money<price,0x39735f);
    this.panelButton(panel,'NEXT',318,211,75,26,()=>{this.rosterPage++;this.showRosterPage();},this.rosterPage>=pages-1);
  }
  private showStudentCard(student:Student):void {
    const rank=student.skill>=10?'Advanced':student.skill>=5?'Intermediate':'Beginner';
    this.studentCard.setText(student.name+' | '+rank+' | Skill '+student.skill+' | Bond '+student.friendship).setVisible(true);
    this.cardTimer?.remove();
    this.cardTimer=this.time.delayedCall(2800,()=>this.studentCard.setVisible(false));
  }
  private upgradeEquipment():void {
    if(this.running) { this.say('Finish class before upgrading.'); return; }
    const level=this.saveData.equipment||0;
    if(level>=3) { this.say('Equipment fully upgraded!'); return; }
    const cost=40+level*35;
    if(this.saveData.money<cost) { this.say('Need $'+cost+' for the next equipment upgrade.'); return; }
    this.saveData.money-=cost;
    this.saveData.equipment=level+1;
    this.persist(); this.refresh();
    this.recoverActors();
    this.showFeedback('GEAR LEVEL '+(level+1));
    this.say('Purchased '+['Heavy bag','Weight station','Training rack'][level]+'! Gym gear adds $'+((level+1)*5)+' per class.');
  }
  private say(message:string):void { this.message.setText(message); }
  private updateIndicators():void {
    this.students.forEach((s,i)=>{
      const active=this.running && this.requests.includes(i);
      s.indicator?.setVisible(active).setText(active ? '! '+this.tasks[i] : '!');
    });
  }
  private showFeedback(text:string):void {
    this.feedback.setText(text).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.feedback);
    this.tweens.add({targets:this.feedback,alpha:0,duration:900,delay:550,onComplete:()=>this.feedback.setVisible(false)});
  }
  private interact(target?:Student):void {
    const nearest=target??[...this.activeStudents()].sort((a,b)=>Phaser.Math.Distance.Between(this.player.x,this.player.y,a.x,a.y)-Phaser.Math.Distance.Between(this.player.x,this.player.y,b.x,b.y))[0];
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,nearest.x,nearest.y)>42) { this.say('Move closer to a student.'); return; }
    const i=this.students.indexOf(nearest);
    nearest.routine=this.idleRoutine(nearest,3,'talk');
    this.showSpeech(nearest,['Working on my jab!','Good to see you!','Ready to train!','Thanks, coach!'][i%4],1700);
    nearest.actor?.face(this.player.x-nearest.x,this.player.y-nearest.y);
    this.coach.face(nearest.x-this.player.x,nearest.y-this.player.y);
    if(this.running) {
      const at=this.requests.indexOf(i);
      if(at<0) { this.say(nearest.name+': All good, coach!'); return; }
      if((this.requestAge[i] ?? 99)<=5) this.quickBonus+=2;
      this.requests.splice(at,1);
      this.updateIndicators();
      this.classHelped++;
      if(nearest.friendship>=5) this.friendshipBonus+=2;
      nearest.skill++;
      const task = this.tasks[i] || 'Assistance';
      this.showFeedback((this.requestAge[i]<=7?'QUICK +$2 | ':'HELPED | ')+task+' | '+nearest.name);
      this.say(nearest.name+': Thanks for the '+task.toLowerCase()+' help, coach!');

      if(!this.requests.length && !this.pendingRequests.length) this.finishClass();
    } else {
      const lastTalk=this.saveData.lastTalkDays||[0,0,0,0];
      const firstToday=lastTalk[i]!==this.saveData.day;
      if(firstToday) {
        nearest.friendship++;
        lastTalk[i]=this.saveData.day;
        this.saveData.lastTalkDays=lastTalk;
        this.persist();
      }
      this.showStudentCard(nearest);
      const lines=[['My jab needs work.','I want to compete someday.'],['I brought snacks!','I love this gym community.'],['I studied some fight footage.','I am working on combinations.'],['I am sore today.','I keep showing up!']];
      const milestone=nearest.friendship===3?' You are becoming regular training partners.':nearest.friendship===5?' Friendship milestone: Trusted teammate!':'';
      const dialogue=lines[i%lines.length][Math.max(0,nearest.friendship-1)%2];
      this.showSpeech(nearest,dialogue,1800);
      this.say(nearest.name+': '+dialogue+' Bond '+nearest.friendship+'.'+(firstToday?milestone:' Already chatted today.'));
    }
  }
  private openArcade(mode:TrainingMode):void {
    if(this.running||this.isPlacing()||this.rosterPanel.visible) return;
    if(this.saveData.playedActivities?.[mode]===this.saveData.day) {this.say('Already played today. Close gym for a new day.');return;}
    if(this.drillsToday()>=2){this.say('Two minigames already played today.');return;}
    this.persist();
    this.scene.start('Briefing',{mode});
  }
  private startClass(index:number):void {
    if(this.running||this.isPlacing()||(this.saveData.classesToday||0)>=2||
      this.selectedSlot!==(this.saveData.classesToday||0))return;
    const planned=(this.saveData.classPlan??[0,1])[this.selectedSlot];
    if(index!==planned||!CLASS_PROGRAMS[index])return;
    this.clearIntent();this.furniturePanel.setVisible(false);
    this.rosterPanel.setVisible(false);
    this.running=true;this.classIndex=index;this.seconds=36;
    this.classHelped=0;this.classMissed=0;this.friendshipBonus=0;this.quickBonus=0;
    this.requestAge={};this.nextRequestAt=4.5;
    this.requests=[];this.tasks={};
    const attending=this.activeStudents();
    this.classRequestsTotal=Math.min(6,attending.length);
    const offset=(this.saveData.day+this.selectedSlot-1)%attending.length;
    this.pendingRequests=Array.from({length:this.classRequestsTotal},(_,i)=>
      this.students.indexOf(attending[(offset+i)%attending.length]));
    const taskSets=[
      ['Check jab','Hold pads','Fix guard','Show footwork','Count punches','Fix stance'],
      ['Hold Thai pads','Check kicks','Adjust guard','Show clinch','Correct knees','Check balance'],
      ['Check grip','Show escape','Correct hip turn','Fix base','Drill takedown','Check posture'],
      ['Check breathing','Count reps','Fix squat','Lead warmup','Check pacing','Water break']
    ];
    this.pendingRequests.forEach((id,i)=>{
      this.tasks[id]=taskSets[index][(i+this.saveData.day)%6];
    });
    // Classes remain in the same hub. Students train rather than stand frozen.
    attending.forEach((student,i)=>{
      student.routine=this.idleRoutine(student,this.seconds+1,
        index===2?(i%2?'stretch':'lift'):index===3?(i%2?'stretch':'shadow'):'shadow');
    });
    this.modeLabel.setText('TEACHING');
    const b=trainingBounds(this.gymLevel());
    this.classOverlay.clear().lineStyle(2,0xe8bd6c,0.85)
      .strokeRect(b.left-3,b.top-3,b.right-b.left+6,b.bottom-b.top+6);
    this.spawnRequest();this.updateIndicators();
    this.say(CLASS_PROGRAMS[index].name+
      ' class started. Tap students marked ! or move to them. Coach for 36 seconds.');
    this.timer.setText('CLASS STARTED');
  }
  private spawnRequest():void {
    const index=this.pendingRequests.shift();
    if(index===undefined)return;
    this.requests.push(index);this.requestAge[index]=0;
    this.updateIndicators();
    this.showSpeech(this.students[index],'Coach, help!',1150);
    this.say(this.students[index].name+' needs '+this.tasks[index].toLowerCase()+'.');
  }
  private finishClass():void {
    if(!this.running)return;
    this.running=false;this.modeLabel.setText('GYM HUB');
    this.clearIntent();this.classOverlay.clear();
    const total=this.classRequestsTotal;
    const quality=total>0?Math.min(1,
      (this.classHelped+Math.min(this.quickBonus/4,1)*0.25)/total):0;
    const previousMoney=this.saveData.money,previousRep=this.saveData.reputation;
    const name=CLASS_PROGRAMS[this.classIndex].name;
    this.simulateClass(this.classIndex,quality,false);
    this.requests=[];this.pendingRequests=[];this.updateIndicators();
    this.timer.setText('');
    const earned=this.saveData.money-previousMoney,rep=this.saveData.reputation-previousRep;
    const rating=quality>=0.85?'EXCELLENT':quality>=0.6?'GOOD':quality>=0.35?'FAIR':'NEEDS WORK';
    this.menuShell('CLASS COMPLETE',name.toUpperCase()+'  /  '+rating);
    const lines=[
      'Students helped: '+this.classHelped+' / '+total+
        '     Missed: '+this.classMissed,
      'Class earnings: $'+earned+'     Reputation: +'+rep,
      'Student XP and equipment bonuses have been applied.',
      (this.saveData.classesToday||0)<2?
        'Your afternoon class is ready to teach.':'Both classes finished for today.'
    ];
    lines.forEach((text,i)=>this.furniturePanel.add(this.add.text(87,78+i*27,text,{
      fontFamily:UI_FONT,fontSize:'11px',color:i===1?'#c3eab5':'#f0e7d3',
      wordWrap:{width:305}
    })));
    this.panelButton(this.furniturePanel,'CLASS SCHEDULE',85,189,148,28,
      ()=>this.openClassSchedule(),(this.saveData.classesToday||0)>=2,0x39735f);
    this.panelButton(this.furniturePanel,'RETURN TO GYM',245,189,148,28,
      ()=>this.closePanel(),false,0x39735f);
  }
  private nextDay():void {
    if(this.running) { this.say('Finish class first.'); return; }
    this.saveData.day++;
    this.clearIntent();
    this.students.forEach((student,i)=>{student.routine=this.idleRoutine(student,0.5+i);student.chatCooldown=10+i*4;});
    this.saveData.classesToday=0;
    this.saveData.gatheredToday=[];
    this.saveData.completed=false;
    this.persist();
    this.scene.restart({notice:'New day! Supplies have respawned and a new group of students is attending.'});
  }
  // The same solid-object footprints drive movement, routing and placement.
  // Feet are the character's anchor; leave room for the sprite around each fixture.
  private furnitureSize(item:Furniture):{rx:number;ry:number} {
    const side=item.rotation%2===1;
    if(item.kind===1)return {rx:side?9:22,ry:side?22:9};
    if(item.kind===2)return {rx:side?11:18,ry:side?18:11};
    if(item.kind===3)return {rx:11,ry:11};
    if(item.kind===4)return {rx:10,ry:13};
    return {rx:9,ry:9};
  }
  private validPlacement(x:number,y:number,rx:number,ry:number,excludeGear=-1,excludeFurniture=-1,excludePlant=false):boolean {
    // Check the full footprint, including margins, rather than only its center.
    const {left,right,top,bottom}=trainingBounds(this.gymLevel());
    if(x-rx<left||x+rx>right||y-ry<top||y+ry>bottom)return false;
    if(!this.canPlace(x,y,rx,ry,excludeGear,excludeFurniture,excludePlant))return false;
    if(this.activeStudents().some(s=>Math.abs(s.x-x)<rx+11&&Math.abs(s.y-y)<ry+8))return false;
    if(Math.abs(this.player.x-x)<rx+9&&Math.abs(this.player.y-y)<ry+7)return false;
    return true;
  }
  private isPlacing():boolean {
    return this.placingGear>=0||this.placingDecor>=0||this.selectedFurniture>=0;
  }
  private cancelPlacement():void {
    this.placingGear=-1;this.placingDecor=-1;this.selectedFurniture=-1;this.buildMode=false;this.keyboardPlacement=false;
    this.placementPreview.clear();this.placementHint.setVisible(false);
    this.updateFurnitureActions();this.drawEquipment();this.say('Placement cancelled.');
  }
  private toggleBuildMode():void {
    if(this.running||this.rosterPanel.visible)return;
    this.clearIntent();
    if(this.isPlacing())this.cancelPlacement();
    if(this.furniturePanel.visible&&this.buildMode){this.furniturePanel.setVisible(false);this.buildMode=false;return;}
    this.buildMode=true;
    this.openFurniture('build');
  }
  private movePlacement(dx:number,dy:number):void {
    if(!this.isPlacing()||this.furniturePanel.visible)return;
    this.keyboardPlacement=true;
    this.placementCursor.x=Phaser.Math.Clamp(this.placementCursor.x+dx,38,310);
    this.placementCursor.y=Phaser.Math.Clamp(this.placementCursor.y+dy,83,207);
  }
  private confirmPlacement():void {
    if(!this.isPlacing()||this.furniturePanel.visible)return;
    const {x,y}=this.placementCursor;
    if(this.selectedFurniture>=0)this.placeFurniture(x,y);
    else if(this.placingGear>=0)this.placeGear(x,y);
    else if(this.placingDecor>=0)this.placeDecor(x,y);
  }
  private updatePlacementPreview():void {
    const g=this.placementPreview;g.clear();
    if(!this.isPlacing()||this.furniturePanel.visible||this.running){this.placementHint.setVisible(false);return;}
    const pointer=this.input.activePointer,x=roundPlacement(this.keyboardPlacement?this.placementCursor.x:pointer.worldX),y=roundPlacement(this.keyboardPlacement?this.placementCursor.y:pointer.worldY);
    let rx=12,ry=11,valid=false;
    if(this.selectedFurniture>=0){
      const item=this.saveData.furniture?.[this.selectedFurniture];
      if(!item)return;
      ({rx,ry}=this.furnitureSize(item));
      valid=this.validPlacement(x,y,rx,ry,-1,this.selectedFurniture);
    }else if(this.placingGear>=0){
      ({rx,ry}=GEAR_BOUNDS[this.placingGear]);
      valid=this.validPlacement(x,y,rx,ry,this.placingGear);
    }else{
      rx=this.placingDecor===2?11:25;ry=12;
      valid=this.decorFits(x,y);
    }
    const color=valid?0x83d7ac:0xe57770;
    g.fillStyle(color,0.24).fillRect(x-rx,y-ry,rx*2,ry*2);
    g.lineStyle(1,color,0.95).strokeRect(x-rx,y-ry,rx*2,ry*2);
    this.placementHint.setText((valid?'READY':'BLOCKED')+'  TAP TO PLACE  /  ARROWS + ENTER').setVisible(true);
  }
  private solidFootprints(excludeGear=-1,excludeFurniture=-1,excludePlant=false):Footprint[] {
    const solids:Footprint[]=[];
    (this.saveData.furniture||[]).forEach((item,i)=>{
      if(!item.stored&&i!==excludeFurniture)solids.push({...item,...this.furnitureSize(item)});
    });
    (this.saveData.ownedGear||[]).forEach((owned,i)=>{
      if(owned&&!this.saveData.gearStored?.[i]&&i!==excludeGear){
        solids.push({...this.saveData.gearPositions![i],...GEAR_BOUNDS[i]});
      }
    });
    if(!excludePlant&&(this.saveData.decorLevel||0)>=3)solids.push({...this.saveData.decorPositions![2],rx:11,ry:12});
    if((this.saveData.equipment||0)>=1)solids.push({x:308,y:82,rx:9,ry:13});
    if((this.saveData.equipment||0)>=2)solids.push({x:310,y:150,rx:15,ry:9});
    return solids;
  }
  private canStand(x:number,y:number):boolean {
    return walkable(x,y,this.gymLevel())&&!this.footprints.some(o=>Math.abs(x-o.x)<o.rx+6&&Math.abs(y-o.y)<o.ry+4);
  }
  private canPlace(x:number,y:number,rx:number,ry:number,excludeGear=-1,excludeFurniture=-1,excludePlant=false):boolean {
    return !this.solidFootprints(excludeGear,excludeFurniture,excludePlant).some(o=>
      Math.abs(x-o.x)<o.rx+rx+3&&Math.abs(y-o.y)<o.ry+ry+3);
  }
  private recoverActors():void {
    this.coach.place(...this.actorPosition(this.player));
    for(const student of this.activeStudents()){
      Object.assign(student,this.navigation.recover(student));
      student.actor?.place(student.x,student.y);
      const bubble=this.speechBubbles[this.students.indexOf(student)];
      bubble?.setPosition(student.x,student.y-48);
      student.indicator?.setPosition(student.x,student.y-38);
    }
  }
  private actorPosition(point:Point):[number,number] {
    const {x,y}=this.navigation.recover(point);
    return [x,y];
  }
  private idleRoutine(student:Student,remaining:number,pose:Pose='idle'):Routine {
    return {pose,goal:{x:student.x,y:student.y},route:[],remaining,elapsed:0};
  }
  private studentSpace(student:Student,x:number,y:number):boolean {
    const point={x,y};
    return !closeFeet(this.player,point)&&this.activeStudents().every(other=>other===student||!closeFeet(other,point));
  }
  private planStudent(student:Student,index:number):Routine {
    const preferred:Pose[][]=[
      ['bag','shadow','rest','stretch','rest'],
      ['stretch','rest','shadow','bag','rest'],
      ['lift','rest','stretch','shadow','rest'],
      ['bag','rest','bag','shadow','rest'],
    ];
    const options=preferred[index%preferred.length];
    const pose=options[Math.floor(Math.random()*options.length)];
    const open=(x:number,y:number)=>this.studentSpace(student,x,y);
    const plan=(goal:Point,action:Pose,station?:Station):Routine|undefined=>{
      if(!this.canStand(goal.x,goal.y)||!open(goal.x,goal.y))return;
      if(this.activeStudents().some(other=>other!==student&&other.routine&&
        (closeFeet(goal,other.routine.goal)||(station&&other.routine.station?.id===station.id))))return;
      const route=this.navigation.route(student,goal,open,true);
      if(!route.length)return;
      return {pose:action,goal,route,remaining:3+Math.random()*3+index*0.25,elapsed:0,station};
    };
    if(student.chatCooldown<=0){
      const partner=this.activeStudents().find(other=>other!==student&&other.routine&&!other.routine.route.length&&
        !other.routine.station&&other.routine.pose!=='talk'&&distance(other,student)<85&&
        this.activeStudents().every(peer=>peer.routine?.partner!==other));
      if(partner){
        for(const dx of [22,-22]){
          const routine=plan({x:partner.x+dx,y:partner.y},'talk');
          if(routine){
            student.chatCooldown=24+index*4;
            partner.chatCooldown=student.chatCooldown;
            partner.routine=this.idleRoutine(partner,6);
            return {...routine,partner,remaining:2.5};
          }
        }
      }
      student.chatCooldown=4+index;
    }
    if(pose==='bag'||pose==='lift'||pose==='rest'){
      const stations=this.stations.filter(s=>s.pose===pose).sort((a,b)=>distance(a,student)-distance(b,student));
      for(const station of stations){
        const side=station.rx+7,front=station.ry+6;
        const goals=[{x:station.x-side,y:station.y+3},{x:station.x+side,y:station.y+3},{x:station.x,y:station.y+front}];
        for(const goal of goals){
          const routine=plan(goal,pose,station);
          if(routine)return routine;
        }
      }
    }
    // Unavailable stations should never trigger pretend bag, lifting or resting interactions.
    // Without a real station or conversation partner, students practice shadowboxing.
    // Floor stretching and drinking from a personal bottle are valid solo activities.
    // Sitting/resting is reserved for an actual bench or rest station.
    // Rotate rest breaks between sitting on the mat and drinking water.
    // This also works in a new gym before any benches have been purchased.
    const action:Pose=pose==='stretch'?'stretch':pose==='rest'?(Math.random()<0.5?'rest':'drink'):pose==='lift'?'stretch':'shadow';
    for(let i=0;i<6;i++){
      const x=55+Math.floor(Math.random()*41)*6,y=96+Math.floor(Math.random()*17)*6;
      const routine=plan({x,y},action);
      if(routine)return routine;
    }
    return this.idleRoutine(student,1+index*0.3);
  }
  private updateStudentLife(dt:number):void {
    // Expire bubbles even when panels pause NPC animations.
    for(const student of this.activeStudents()){
      const index=this.students.indexOf(student);
      const bubble=this.speechBubbles[index];
      if(!bubble?.visible)continue;
      if(this.time.now>=this.speechUntil[index])this.hideSpeech(student);
      else bubble.setPosition(student.x,student.y-48);
    }
    const paused=this.buildMode||this.isPlacing()||this.furniturePanel.visible||this.rosterPanel.visible;
    for(const station of this.stations)station.fixture?.setX(0);
    for(const [i,student] of this.activeStudents().entries()){
      const actor=student.actor!;
      if(paused||this.running){actor.animate(this.running?(student.routine?.pose||'shadow'):'idle',dt);continue;}
      student.chatCooldown-=dt;
      let routine=student.routine!;
      if(routine.station&&!this.stations.includes(routine.station))routine=this.idleRoutine(student,0.3+i*0.2);
      if(routine.remaining<=0)routine=this.planStudent(student,i);
      student.routine=routine;
      const waypoint=routine.route[0];
      // Speech belongs to an interaction, not a wandering character.
      // Hide it the moment a new path starts.
      if(waypoint?.x!==undefined)this.hideSpeech(student);
      if(waypoint){
        const length=distance(student,waypoint);
        const t=length>0?Math.min(1,dt*(27+i*1.5)/length):1;
        const dx=waypoint.x-student.x,dy=waypoint.y-student.y;
        const next={x:student.x+dx*t,y:student.y+dy*t};
        const open=(x:number,y:number)=>this.canStand(x,y)&&this.studentSpace(student,x,y);
        if(clearSegment(student,next,open)){
          Object.assign(student,next);
          actor.face(dx,dy);
          actor.animate('walk',dt);
          if(t===1)routine.route.shift();
        }else{
          routine.route=this.navigation.route(student,routine.goal,open,true);
          if(!routine.route.length)student.routine=this.idleRoutine(student,0.55+i*0.3);
          actor.animate('idle',dt);
        }
      }else{
        const target=routine.partner??routine.station;
        if(target)actor.face(target.x-student.x,target.y-student.y);
        if(routine.partner){
          const partner=routine.partner;
          if(distance(student,partner)>30){student.routine=this.idleRoutine(student,0.5);continue;}
          if(partner.routine?.pose==='idle'){
            partner.routine=this.idleRoutine(partner,routine.remaining,'talk');
            partner.actor?.face(student.x-partner.x,student.y-partner.y);
          }
        }
        routine.remaining-=dt;
        routine.elapsed+=dt;
        actor.animate(routine.pose,dt);
        if(routine.pose==='bag'&&routine.station?.fixture){
          const impact=Math.floor(routine.elapsed*7)%2;
          routine.station.fixture.setX(impact*Math.sign(routine.station.x-student.x)*2);
        }
      }
      actor.place(student.x,student.y);
      student.indicator?.setPosition(student.x,student.y-38);
    }
  }
  private moveCoach(dt:number):void {
    const dx=Number(this.cursors.right.isDown||this.wasd.D.isDown)-Number(this.cursors.left.isDown||this.wasd.A.isDown);
    const dy=Number(this.cursors.down.isDown||this.wasd.S.isDown)-Number(this.cursors.up.isDown||this.wasd.W.isDown);
    const manual=!!(dx||dy);
    if(manual)this.clearIntent();
    if(this.targetStudent){
      this.targetRefresh-=dt;
      if(this.targetRefresh<=0||distance(this.player,this.targetStudent)<NEAR)this.followStudent();
    }
    if(this.pickupTarget&&distance(this.player,this.pickupTarget)<=55){
      const {x,y}=this.pickupTarget;
      this.clearIntent();this.collectNodeAt(x,y);
    }
    const waypoint=this.route[0];
    const heading=manual?{x:dx,y:dy}:waypoint?{x:waypoint.x-this.player.x,y:waypoint.y-this.player.y}:null;
    if(!heading){this.coach.animate('idle',dt);return;}
    const length=Math.hypot(heading.x,heading.y);
    const step=manual?dt*this.speed:Math.min(length,dt*this.speed);
    const ratio=length?step/length:0;
    const from={x:this.player.x,y:this.player.y};
    const nx=from.x+heading.x*ratio,ny=from.y+heading.y*ratio;
    const open=(x:number,y:number)=>this.canStand(x,y)&&this.activeStudents().every(s=>!closeFeet(s,{x,y}));
    let next={x:nx,y:ny};
    if(!clearSegment(from,next,open)){
      next=from;
      if(manual){
        if(clearSegment(from,{x:nx,y:from.y},open))next={x:nx,y:from.y};
        else if(clearSegment(from,{x:from.x,y:ny},open))next={x:from.x,y:ny};
      }else{
        const goal=this.route[this.route.length-1];
        this.route=this.playerRoute(goal,!!this.stationTarget);
        if(!this.route.length&&!this.targetStudent){this.clearIntent();this.say('Path blocked. Try another approach.');}
        this.coach.animate('idle',dt);
        return;
      }
    }
    this.coach.face(heading.x,heading.y);
    this.coach.place(next.x,next.y);
    this.coach.animate(distance(from,next)>0.01?'walk':'idle',dt);
    if(!manual&&step===length){
      this.route.shift();
      if(!this.route.length&&this.stationTarget){
        const station=this.stationTarget;
        this.clearIntent();
        if(station==='board')this.openTrainingBoard();
        else this.openGymUpgrades();
      }
    }
  }
  update(_time:number,delta:number):void {
    const dt=Math.min(delta,50)/1000;
    this.updateStudentLife(dt);
    this.updatePlacementPreview();
    if(this.running) {
      const classDelta=Math.min(delta,100)/1000;
      this.seconds-=classDelta;
      for(const index of [...this.requests]){
        this.requestAge[index]+=classDelta;
        if(this.requestAge[index]>11){
          this.requests.splice(this.requests.indexOf(index),1);
          this.classMissed++;this.updateIndicators();
          this.showSpeech(this.students[index],'Maybe next time',850);
        }
      }
      this.students.forEach((student,index)=>{
        if(!student.indicator||!this.requests.includes(index))return;
        const remaining=Math.max(0,Math.ceil(11-(this.requestAge[index]??0)));
        student.indicator.setText('! '+this.tasks[index]+' '+remaining+'s');
        student.indicator.setBackgroundColor(remaining>5?'#a53d34':'#914f44');
      });
      if(this.pendingRequests.length&&36-this.seconds>=this.nextRequestAt){
        this.spawnRequest();this.nextRequestAt+=4.5;
      }
      this.timer.setText('CLASS '+Math.ceil(this.seconds)+'s  HELPED '+this.classHelped+
        '/'+this.classRequestsTotal+'  OPEN '+this.requests.length);
      if(this.seconds<=0||(!this.pendingRequests.length&&!this.requests.length))
        this.finishClass();
    }
    if(this.buildMode||this.isPlacing()||this.furniturePanel.visible||this.rosterPanel.visible)this.coach.animate('idle',dt);
    else this.moveCoach(dt);
  }
}

const ink=0x203b42,cream='#f5e8cc',gold=0xe8bb70;
function arcadeButton(scene:Phaser.Scene,x:number,y:number,w:number,h:number,label:string,fn:()=>void,depth=0):Phaser.GameObjects.Rectangle {
  const bg=scene.add.rectangle(x,y,w,h,0x355b5d).setStrokeStyle(1,0xa0aa87).setInteractive({useHandCursor:true}).setDepth(depth);
  scene.add.text(x,y,label,{fontFamily:UI_FONT,fontSize:'13px',color:cream,fontStyle:'bold'}).setOrigin(0.5).setDepth(depth+1);
  bg.on('pointerover',()=>bg.setFillStyle(0x47716d));
  bg.on('pointerout',()=>bg.setFillStyle(0x355b5d));
  bg.on('pointerdown',fn);
  return bg;
}
function arcadeFrame(scene:Phaser.Scene,title:string,subtitle:string):void {
  const g=scene.add.graphics();
  g.fillStyle(0x152b30).fillRect(0,0,480,330);
  g.fillStyle(0x23454b).fillRect(12,12,456,306);
  g.lineStyle(1,0x77958c).strokeRect(12,12,456,306);
  g.fillStyle(0x29494c).fillRect(13,13,454,55);
  g.fillStyle(gold).fillRect(24,21,17,2);
  scene.add.text(24,25,title,{fontFamily:UI_FONT,fontSize:'21px',fontStyle:'bold',color:cream});
  scene.add.text(24,52,subtitle,{fontFamily:UI_FONT,fontSize:'11px',color:'#c5ded4'});
}
function returnToTraining(scene:Phaser.Scene):void {
  activeActivity=null;
  scene.scene.start('Gym',{trainingBoard:true});
}
function arcadeResult(scene:Phaser.Scene,title:string,score:string,cash:number,rep:number):void {
  scene.add.rectangle(240,165,480,330,0x10252a,.72).setDepth(48).setInteractive();
  scene.add.rectangle(240,165,372,182,ink).setStrokeStyle(2,gold).setDepth(49);
  scene.add.text(240,111,title,{fontFamily:UI_FONT,fontSize:'21px',fontStyle:'bold',color:cream}).setOrigin(.5).setDepth(50);
  scene.add.text(240,144,score,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(.5).setDepth(50);
  scene.add.text(240,171,'+$'+cash+(rep?'   •   +'+rep+' reputation':''),{fontFamily:UI_FONT,fontSize:'13px',color:'#f6d598'}).setOrigin(.5).setDepth(50);
  arcadeButton(scene,158,216,145,35,'RETURN TO GYM',()=>{activeActivity=null;scene.scene.start('Gym');},51);
  arcadeButton(scene,322,216,151,35,'TRAINING BOARD',()=>returnToTraining(scene),51);
}
let activeActivity:TrainingMode|null=null;
function awardArcade(cash:number,rep:number,completeClass:boolean):void {
  const s=loadSave();
  s.money+=cash;s.lifetimeEarnings=(s.lifetimeEarnings||0)+cash;s.reputation+=rep;
  if(completeClass){s.completed=true;s.classesTaught=(s.classesTaught||0)+1;}
  const activity=completeClass?'Rush':activeActivity;
  if(activity)s.playedActivities={...s.playedActivities,[activity]:s.day};
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));}catch{}
}

type TrainingMode='Rush'|'Rhythm'|'Memory'|'Defense'|'Competition'|'Conditioning';
type TrainingDifficulty='easy'|'normal'|'hard';
const TRAINING_OPTIONS:{mode:TrainingMode;label:string;summary:string}[]=[
  {mode:'Rhythm',label:'PAD WORK',summary:'Strike on the beat'},
  {mode:'Memory',label:'BAG WORK',summary:'Repeat the combination'},
  {mode:'Defense',label:'DEFENSE',summary:'React to incoming strikes'},
  {mode:'Competition',label:'SPARRING',summary:'Read the other fighter'},
  {mode:'Conditioning',label:'AGILITY',summary:'Clear the obstacle course'}
];
class BriefingScene extends Phaser.Scene {
  private mode:TrainingMode='Rhythm';
  private difficulty:TrainingDifficulty='normal';
  constructor(){super('Briefing');}
  init(data:{mode:TrainingMode}):void {this.mode=data.mode;activeActivity=data.mode;this.difficulty='normal';}
  create():void {
    const guides:Record<TrainingMode,{title:string;lines:string[]}> = {
      Rush:{title:'CLASS RUSH',lines:['Students ask for help during class.','Tap a student or their request to walk over.','Help as many as possible before time runs out.']},
      Rhythm:{title:'PAD WORK',lines:['Watch the technique and timing bar.','Tap the highlighted pad when the marker reaches the gold zone.','You have 15 attempts. Keyboard: A S D F G H.']},
      Memory:{title:'BAG WORK',lines:['Watch the combination, then repeat it.','Use the pads or A S D F G H.','Complete 10 rounds. Mistakes count, but do not end class.']},
      Defense:{title:'DEFENSE',lines:['Read the incoming attack before the timer ends.','HEAD = BLOCK, BODY = GUARD, LOW KICK = CHECK.','STRAIGHT = SLIP. Use buttons or J K L ;.']},
      Competition:{title:'SPARRING',lines:['Choose attacks, defense, or recovery.','Both fighters act on each turn.','Manage health and stamina to win.']},
      Conditioning:{title:'AGILITY COURSE',lines:['Run an obstacle course with direct movement control.','Hold Left, Right, or Duck. Tap Jump to clear a hurdle.','Reach the finish line while avoiding gym obstacles.']}
    };
    const guide=guides[this.mode];
    arcadeFrame(this,guide.title,'HOW TO PLAY');
    this.add.rectangle(240,174,430,216,ink).setStrokeStyle(2,gold);
    guide.lines.forEach((line,i)=>this.add.text(240,102+i*30,line,{fontFamily:UI_FONT,fontSize:'13px',color:cream,align:'center'}).setOrigin(.5));
    this.add.text(240,208,'DIFFICULTY',{fontFamily:UI_FONT,fontSize:'12px',color:'#ffe29b'}).setOrigin(.5);
    const selection=this.add.text(240,263,'SELECTED: NORMAL',{fontFamily:UI_FONT,fontSize:'10px',color:cream}).setOrigin(.5);
    (['easy','normal','hard'] as TrainingDifficulty[]).forEach((d,i)=>{
      arcadeButton(this,110+i*130,241,112,29,d.toUpperCase(),()=>{this.difficulty=d;selection.setText('SELECTED: '+d.toUpperCase());});
    });
    arcadeButton(this,240,291,170,32,'START TRAINING',()=>this.scene.start(this.mode,{difficulty:this.difficulty}));
    arcadeButton(this,419,35,74,27,'BACK',()=>returnToTraining(this));
  }
}

class RushScene extends Phaser.Scene {
  private active=false;private seconds=50;private score=0;private missed=0;private spawn=0;
  private difficulty:TrainingDifficulty='normal';
  init(data:{difficulty?:TrainingDifficulty}):void {this.difficulty=data?.difficulty||'normal';}
  private requests:{lane:number,age:number,task:string}[]=[];private info!:Phaser.GameObjects.Text;
  private markers!:Phaser.GameObjects.Container;private coach!:GymCharacter;
  private requestViews=new Map<number,{box:Phaser.GameObjects.Container;bar:Phaser.GameObjects.Rectangle}>();
  private coachTarget=-1;private coachSpeed=130;private coachBusy=false;
  private positions=[{x:90,y:183},{x:190,y:183},{x:290,y:183},{x:390,y:183}];
  private names=['FRANK','RADISH','MARSHALL','PUDGE'];
  private tasks=['FIX STANCE','HOLD PADS','CHECK FORM','NEED WATER','SHOW COMBO','ADJUST GUARD'];
  constructor(){super('Rush');}
  create():void {
    this.active=true;this.seconds=50;this.score=0;this.missed=0;this.spawn=1.4;this.requests=[];this.coachTarget=-1;this.coachBusy=false;this.requestViews.clear();
    arcadeFrame(this,'CLASS RUSH','Tap a student with a request. Your coach walks over to help.');
    const floor=this.add.graphics();
    floor.fillStyle(0xc5aa83).fillRoundedRect(23,91,434,207,8);
    floor.fillStyle(0x416e70).fillRoundedRect(34,101,412,175,6);
    floor.lineStyle(2,0xd9c58e).strokeRoundedRect(34,101,412,175,6);
    floor.lineStyle(1,0x5c8b89,0.7);
    for(let x=55;x<445;x+=27)floor.lineBetween(x,101,x,276);
    for(let y=112;y<276;y+=27)floor.lineBetween(34,y,446,y);
    floor.fillStyle(0x8e3834).fillRoundedRect(38,112,22,56,5);
    floor.fillStyle(0x2b3034).fillRect(43,107,12,5);
    floor.fillStyle(0x8e3834).fillRoundedRect(418,112,22,56,5);
    floor.fillStyle(0x2b3034).fillRect(423,107,12,5);
    this.add.text(240,286,'Help quickly to earn more points',{fontFamily:UI_FONT,fontSize:'11px',color:'#203b42'}).setOrigin(.5);
    this.info=this.add.text(24,75,'',{fontFamily:UI_FONT,fontSize:'12px',color:cream});
    this.positions.forEach((p,i)=>{
      new GymCharacter(this,p.x,p.y,i+1);
      this.add.text(p.x,p.y+24,this.names[i],{fontFamily:UI_FONT,fontSize:'11px',color:'#ffffff',backgroundColor:'#1c4045',padding:{x:3,y:2}}).setOrigin(0.5);
      const hit=this.add.rectangle(p.x,159,94,112,0xffffff,0).setInteractive({useHandCursor:true});
      hit.on('pointerdown',()=>this.help(i));
    });
    this.coach=new GymCharacter(this,240,250,0);
    this.markers=this.add.container(0,0).setDepth(20);
    arcadeButton(this,415,35,75,27,'EXIT',()=>this.exit());
    this.render();
  }
  private help(i:number):void {
    if(!this.active||this.coachBusy)return;
    if(!this.requests.some(r=>r.lane===i))return;
    playGymCue('tap');this.coachTarget=i;this.coachBusy=true;
  }
  private serve(i:number):void {
    const index=this.requests.findIndex(r=>r.lane===i);if(index<0)return;
    playGymCue('success');const r=this.requests.splice(index,1)[0];this.score+=r.age<4?4:2;
    this.coachBusy=false;this.coachTarget=-1;
    this.render();
  }
  private render():void {
    for(const [lane,view] of this.requestViews){
      if(this.requests.some(r=>r.lane===lane))continue;
      view.box.destroy();
      this.requestViews.delete(lane);
    }
    const maxAge=this.difficulty==='easy'?13:this.difficulty==='hard'?6:9;
    for(const r of this.requests){
      const p=this.positions[r.lane],remain=Math.max(0,maxAge-r.age);
      let view=this.requestViews.get(r.lane);
      if(!view){
        const bubble=this.add.rectangle(0,0,94,34,0x17383e).setStrokeStyle(1,gold);
        const text=this.add.text(0,-6,r.task,{fontFamily:UI_FONT,fontSize:'10px',fontStyle:'bold',color:'#ffffff'}).setOrigin(.5);
        const track=this.add.rectangle(0,9,78,4,0x4c5858);
        const bar=this.add.rectangle(-39,9,78,4,gold).setOrigin(0,.5);
        const box=this.add.container(p.x,124,[bubble,text,track,bar]);
        this.markers.add(box);
        view={box,bar};
        this.requestViews.set(r.lane,view);
      }
      view.bar.setDisplaySize(78*remain/maxAge,4).setFillStyle(remain<3?0xf58b79:gold);
    }
    this.info.setText('TIME '+Math.ceil(Math.max(0,this.seconds))+'s   POINTS '+this.score+'   MISSED '+this.missed+'   '+(this.coachBusy?'COACH MOVING':'TAP A REQUEST'));
  }
  update(_t:number,delta:number):void {
    if(!this.active)return;
    const dt=Math.min(delta,100)/1000;this.seconds-=dt;this.spawn-=dt;
    if(this.spawn<=0){
      const free=[0,1,2,3].filter(i=>!this.requests.some(r=>r.lane===i));
      if(free.length){const lane=Phaser.Utils.Array.GetRandom(free);this.requests.push({lane,age:0,task:Phaser.Utils.Array.GetRandom(this.tasks)});}
      this.spawn=this.difficulty==='easy'?4:this.difficulty==='hard'?1.8:2.8;
    }
    if(this.coachBusy&&this.coachTarget>=0){
      const p=this.positions[this.coachTarget],body=this.coach.body;
      const dx=p.x-body.x,dy=(p.y+52)-body.y,dist=Math.hypot(dx,dy);
      if(dist<6)this.serve(this.coachTarget);
      else{
        const step=Math.min(dist,this.coachSpeed*dt);
        this.coach.face(dx,dy);
        this.coach.place(body.x+dx/dist*step,body.y+dy/dist*step);
      }
    }
    this.coach.animate(this.coachBusy?'walk':'idle',dt);
    for(const r of this.requests)r.age+=dt;
    const maxAge=this.difficulty==='easy'?13:this.difficulty==='hard'?6:9;
    const expired=this.requests.filter(r=>r.age>=maxAge);
    this.missed+=expired.length;this.requests=this.requests.filter(r=>r.age<maxAge);
    if(this.coachTarget>=0&&!this.requests.some(r=>r.lane===this.coachTarget)){this.coachBusy=false;this.coachTarget=-1;}
    if(this.seconds<=0){this.finish();return;}
    this.render();
  }
  private finish():void {
    this.active=false;this.requests=[];this.markers.removeAll(true);
    playGymCue('complete');
    const earned=20+this.score*3,rep=Math.max(1,Math.floor(this.score/4));
    awardArcade(earned,rep,true);
    arcadeResult(this,'CLASS COMPLETE',this.score+' points  •  '+this.missed+' missed requests',earned,rep);
  }
  private exit():void {this.active=false;returnToTraining(this);}
}

const TECHNIQUES=['JAB','CROSS','HOOK','KICK','KNEE','SPRAWL'];
const KEYS=['A','S','D','F','G','H'];
class RhythmScene extends Phaser.Scene {
  private active=false;private attempts=0;private hits=0;private streak=0;private target=0;
  private clock=0;private window=1.4;private level=0;private difficulty:TrainingDifficulty='normal';
  init(data:{difficulty?:TrainingDifficulty}):void {this.difficulty=data?.difficulty||'normal';}
  private info!:Phaser.GameObjects.Text;
  private cue!:Phaser.GameObjects.Text;private meter!:Phaser.GameObjects.Rectangle;
  private feedback!:Phaser.GameObjects.Text;private keys:Phaser.Input.Keyboard.Key[]=[];
  private pads:Phaser.GameObjects.Rectangle[]=[];
  constructor(){super('Rhythm');}
  create():void {
    this.active=true;this.attempts=0;this.hits=0;this.streak=0;this.clock=0;this.level=0;this.window=1.4;
    this.pads=[];
    arcadeFrame(this,'PAD WORK','Tap the highlighted technique when the marker enters the gold zone.');
    this.info=this.add.text(24,81,'',{fontFamily:UI_FONT,fontSize:'13px',color:cream});
    this.cue=this.add.text(240,120,'',{fontFamily:UI_FONT,fontSize:'25px',fontStyle:'bold',color:'#ffe29b'}).setOrigin(0.5);
    this.add.rectangle(240,150,340,12,0x132b30);
    this.add.rectangle(70+340*.53,150,340*.38,12,0xc49f5b).setOrigin(0,.5);
    this.meter=this.add.rectangle(70,150,4,18,0xfff1d5);
    this.feedback=this.add.text(240,169,'Watch the timing bar',{fontFamily:UI_FONT,fontSize:'12px',color:cream}).setOrigin(0.5);
    for(let i=0;i<6;i++){
      const x=90+(i%3)*150,y=215+Math.floor(i/3)*58;
      this.pads.push(arcadeButton(this,x,y,135,46,TECHNIQUES[i]+' ['+KEYS[i]+']',()=>this.strike(i)));
    }
    arcadeButton(this,415,35,75,27,'EXIT',()=>this.exit());
    this.keys=KEYS.map(k=>this.input.keyboard!.addKey(k));
    this.next();
  }
  private next():void {
    this.level=this.attempts<5?0:this.attempts<10?1:2;
    const count=this.difficulty==='easy'?3:this.difficulty==='hard'?6:[2,4,6][this.level];this.target=Phaser.Math.Between(0,count-1);
    this.window=[1.5,1.15,0.9][this.level]*(this.difficulty==='easy'?1.45:this.difficulty==='hard'?0.7:1);this.clock=0;
    this.meter.x=70;
    this.pads.forEach((pad,i)=>pad.setStrokeStyle(i===this.target?3:1,i===this.target?gold:0xa0aa87));
    this.cue.setText(TECHNIQUES[this.target]+'  ['+KEYS[this.target]+']');
    this.info.setText('ROUND '+(this.attempts+1)+'/15  |  ACCURATE '+this.hits+'  |  STREAK '+this.streak+'  |  PHASE '+(this.level+1)+'/3');
  }
  private strike(i:number):void {
    if(!this.active)return;
    const timing=Math.abs(this.clock/this.window-0.72);
    const good=i===this.target && timing<=0.19;
    this.hits+=Number(good);this.streak=good?this.streak+1:0;
    playGymCue(good?'success':'miss');
    this.feedback.setText(good?'PERFECT!':i!==this.target?'WRONG TECHNIQUE':'MISSED THE BEAT');
    this.attempts++;
    if(this.attempts>=15)this.finish();else this.next();
  }
  update(_t:number,delta:number):void {
    if(!this.active)return;
    for(let i=0;i<this.keys.length;i++)if(Phaser.Input.Keyboard.JustDown(this.keys[i])){this.strike(i);return;}
    this.clock+=Math.min(delta,100)/1000;
    this.meter.x=70+340*Math.min(1,this.clock/this.window);
    if(this.clock>=this.window){this.streak=0;this.attempts++;playGymCue('timeout');this.feedback.setText('TOO SLOW');if(this.attempts>=15)this.finish();else this.next();}
  }
  private finish():void {
    playGymCue('complete');
    this.active=false;const cash=8+this.hits*3;awardArcade(cash,Math.floor(this.hits/5),false);
    arcadeResult(this,'PAD WORK COMPLETE',this.hits+'/15 on target',cash,Math.floor(this.hits/5));
  }
  private exit():void {this.active=false;returnToTraining(this);}
}
class MemoryScene extends Phaser.Scene {
  private sequence:number[]=[];private position=0;private round=0;private showing=false;private active=false;private mistakes=0;private successes=0;
  private difficulty:TrainingDifficulty='normal';
  init(data:{difficulty?:TrainingDifficulty}):void {this.difficulty=data?.difficulty||'normal';}
  private info!:Phaser.GameObjects.Text;private coach!:Phaser.GameObjects.Text;private pads:Phaser.GameObjects.Rectangle[]=[];
  private keys:Phaser.Input.Keyboard.Key[]=[];
  constructor(){super('Memory');}
  create():void {
    this.active=true;this.sequence=[];this.round=0;this.position=0;this.showing=false;this.pads=[];this.mistakes=0;this.successes=0;
    arcadeFrame(this,'BAG WORK CLASS','Watch the combination, then tap the techniques in the same order.');
    this.info=this.add.text(24,78,'',{fontFamily:UI_FONT,fontSize:'13px',color:cream});
    this.coach=this.add.text(240,111,'COACH: READY!',{fontFamily:UI_FONT,fontSize:'19px',fontStyle:'bold',color:'#ffe29b'}).setOrigin(0.5);
    for(let i=0;i<6;i++){
      const x=90+(i%3)*150,y=170+Math.floor(i/3)*72;
      const pad=this.add.rectangle(x,y,134,60,[0x376b70,0x965a4d,0x6c658c,0x8c7447,0x497f66,0x795e88][i]).setStrokeStyle(2,gold).setInteractive({useHandCursor:true});
      this.add.text(x,y,TECHNIQUES[i]+' ['+KEYS[i]+']',{fontFamily:UI_FONT,fontSize:'13px',fontStyle:'bold',color:cream}).setOrigin(0.5);
      pad.on('pointerdown',()=>this.choose(i));this.pads.push(pad);
    }
    this.keys=KEYS.map(k=>this.input.keyboard!.addKey(k));
    arcadeButton(this,415,35,75,27,'EXIT',()=>this.exit());
    this.nextRound();
  }
  update():void {if(!this.active)return;for(let i=0;i<this.keys.length;i++)if(Phaser.Input.Keyboard.JustDown(this.keys[i])){this.choose(i);break;}}
  private nextRound():void {
    if(!this.active)return;
    if(this.round>=10){this.finish();return;}
    this.round++;this.position=0;const count=this.difficulty==='easy'?3:this.difficulty==='hard'?6:this.round<=3?3:this.round<=6?4:6;
    this.sequence=Array.from({length:Math.min((this.difficulty==='easy'?1:this.difficulty==='hard'?4:2)+this.round,10)},()=>Phaser.Math.Between(0,count-1));
    this.showing=true;this.info.setText('ROUND '+this.round+'/10  |  MEMORIZE '+this.sequence.length+' MOVES');
    this.coach.setText('WATCH THE COMBINATION');
    this.sequence.forEach((n,i)=>this.time.delayedCall(500+i*650,()=>{
      if(!this.active)return;this.coach.setText(TECHNIQUES[n]+'!');
      this.pads[n].setStrokeStyle(5,0xffffff);
      this.time.delayedCall(350,()=>{if(this.active)this.pads[n].setStrokeStyle(2,gold);});
    }));
    this.time.delayedCall(750+this.sequence.length*650,()=>{
      if(!this.active)return;this.showing=false;this.coach.setText('YOUR TURN, COACH!');
      this.info.setText('ROUND '+this.round+'/10  |  CALL THE COMBINATION: 0/'+this.sequence.length);
    });
  }
  private choose(n:number):void {
    if(!this.active||this.showing)return;
    if(this.sequence[this.position]!==n){playGymCue('miss');this.mistakes++;this.coach.setText('WRONG CALL! TRY THE NEXT ROUND');this.showing=true;this.time.delayedCall(850,()=>{if(this.round>=10)this.finish();else this.nextRound();});return;}
    playGymCue('success');this.position++;this.coach.setText('COACH: '+TECHNIQUES[n]+'!  |  STUDENT: HIT!');
    this.info.setText('ROUND '+this.round+'/10  |  COMBINATION '+this.position+'/'+this.sequence.length);
    if(this.position===this.sequence.length){
      this.successes++;this.showing=true;if(this.round>=10)this.finish();
      else this.time.delayedCall(650,()=>this.nextRound());
    }
  }
  private finish():void {
    playGymCue('complete');
    this.active=false;const earned=10+this.successes*7;awardArcade(earned,Math.floor(this.successes/3),false);
    arcadeResult(this,'BAG WORK COMPLETE',this.successes+'/10 combinations completed',earned,Math.floor(this.successes/3));
  }
  private exit():void {this.active=false;returnToTraining(this);}
}
class DefenseScene extends Phaser.Scene {
  private active=false;private count=0;private correct=0;private attack=0;private elapsed=0;private limit=2.6;
  private difficulty:TrainingDifficulty='normal';
  init(data:{difficulty?:TrainingDifficulty}):void {this.difficulty=data?.difficulty||'normal';}
  private info!:Phaser.GameObjects.Text;private cue!:Phaser.GameObjects.Text;private bar!:Phaser.GameObjects.Rectangle;
  private feedback!:Phaser.GameObjects.Text;private keys:Phaser.Input.Keyboard.Key[]=[];
  private readonly attacks=[{name:'HEAD SHOT',defense:'BLOCK'},{name:'BODY SHOT',defense:'GUARD'},{name:'LOW KICK',defense:'CHECK'},{name:'STRAIGHT',defense:'SLIP'}];
  constructor(){super('Defense');}
  create():void {
    this.active=true;this.count=0;this.correct=0;
    arcadeFrame(this,'DEFENSE DRILLS','Read the incoming attack. Choose the right defense before impact.');
    this.info=this.add.text(24,81,'',{fontFamily:UI_FONT,fontSize:'13px',color:cream});
    this.cue=this.add.text(240,128,'',{fontFamily:UI_FONT,fontSize:'25px',fontStyle:'bold',color:'#ffb7a4'}).setOrigin(0.5);
    this.add.rectangle(240,163,340,12,0x132b30);
    this.bar=this.add.rectangle(70,163,340,12,0xe8bb70).setOrigin(0,0.5);
    this.feedback=this.add.text(240,189,'READ THE ATTACK',{fontFamily:UI_FONT,fontSize:'12px',color:cream}).setOrigin(0.5);
    ['BLOCK','GUARD','CHECK','SLIP'].forEach((label,i)=>arcadeButton(this,65+i*116,248,105,50,label+' ['+['J','K','L',';'][i]+']',()=>this.defend(i)));
    this.keys=['J','K','L','SEMICOLON'].map(k=>this.input.keyboard!.addKey(k));
    arcadeButton(this,415,35,75,27,'EXIT',()=>this.exit());
    this.next();
  }
  private next():void {
    this.elapsed=0;this.limit=Math.max(0.8,(2.6-this.count*0.09)*(this.difficulty==='easy'?1.5:this.difficulty==='hard'?0.7:1));this.attack=Phaser.Math.Between(0,3);
    this.cue.setText('INCOMING: '+this.attacks[this.attack].name);
    this.info.setText('ATTACK '+(this.count+1)+'/15  |  DEFENDED '+this.correct+'  |  REACT!');
  }
  private defend(i:number):void {
    if(!this.active)return;
    const good=i===this.attack;playGymCue(good?'success':'miss');this.correct+=Number(good);this.count++;
    this.feedback.setText(good?'GOOD DEFENSE!':'HIT! WRONG RESPONSE');
    if(this.count>=15)this.finish();else this.next();
  }
  update(_t:number,delta:number):void {
    if(!this.active)return;
    for(let i=0;i<this.keys.length;i++)if(Phaser.Input.Keyboard.JustDown(this.keys[i])){this.defend(i);return;}
    this.elapsed+=Math.min(delta,100)/1000;this.bar.setDisplaySize(340*Math.max(0,1-this.elapsed/this.limit),12);
    if(this.elapsed>=this.limit){this.count++;playGymCue('timeout');this.feedback.setText('TOO SLOW - HIT!');if(this.count>=15)this.finish();else this.next();}
  }
  private finish():void {
    playGymCue('complete');
    this.active=false;const earned=8+this.correct*3;awardArcade(earned,Math.floor(this.correct/5),false);
    arcadeResult(this,'DEFENSE COMPLETE',this.correct+'/15 defended',earned,Math.floor(this.correct/5));
  }
  private exit():void {this.active=false;returnToTraining(this);}
}


type FightMove='attack'|'defend'|'big'|'breath';
type FightDifficulty='easy'|'normal'|'hard';
const FIGHT_MOVES:FightMove[]=['attack','defend','big','breath'];
const FIGHT_COST:Record<FightMove,number>={attack:5,defend:-5,big:20,breath:-15};
const FIGHT_LABEL:Record<FightMove,string>={attack:'ATTACK',defend:'DEFEND',big:'BIG ATTACK',breath:'CATCH BREATH'};
function fightDamage(a:FightMove,b:FightMove,sp:number):number {
  let n=a==='attack'?12:a==='big'?28:0;
  if(b==='defend')n=a==='big'?3:Math.ceil(n*.25);
  if(a==='big'&&b==='breath')n=40;
  if(a==='attack'&&b==='breath')n=18;
  if(a==='attack'&&b==='big')n=18;
  if(sp<10)n=Math.ceil(n*.75);
  return n;
}
// Shared lightweight audio cues for every training activity.
type GymCue='tap'|'success'|'miss'|'timeout'|'complete';
let gymAudio:AudioContext|undefined;
function playGymCue(kind:GymCue):void {
  try {
    const AudioCtx=window.AudioContext;
    if(!AudioCtx)return;
    if(!gymAudio)gymAudio=new AudioCtx();
    const ctx=gymAudio;
    if(ctx.state==='suspended')void ctx.resume();
    const notes:Record<GymCue,[number,number,number,OscillatorType]>={
      tap:[480,390,.055,'sine'],success:[600,870,.13,'sine'],
      miss:[240,130,.16,'triangle'],timeout:[330,120,.22,'sawtooth'],
      complete:[540,920,.35,'sine']
    };
    const [start,end,duration,wave]=notes[kind],t=ctx.currentTime;
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(start,t);
    osc.frequency.exponentialRampToValueAtTime(end,t+duration);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(.055,t+.01);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start(t);osc.stop(t+duration+.01);
  }catch{/* Audio must never interrupt gameplay. */}
}
// Short synthesized cues avoid external audio assets and play only after player interaction.
function playFightSound(kind:'attack'|'big'|'defend'|'breath'|'win'|'lose'):void {
  try {
    const AudioCtx=window.AudioContext;
    if(!AudioCtx)return;
    const ctx=new AudioCtx();
    const now=ctx.currentTime;
    const tones:Record<typeof kind,[number,number,number,string]>={
      attack:[180,85,.11,'triangle'],big:[115,48,.23,'sawtooth'],
      defend:[420,260,.09,'square'],breath:[320,570,.3,'sine'],
      win:[530,790,.32,'sine'],lose:[240,110,.35,'triangle']
    };
    const [start,end,duration,wave]=tones[kind];
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=wave as OscillatorType;
    osc.frequency.setValueAtTime(start,now);
    osc.frequency.exponentialRampToValueAtTime(end,now+duration);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(.075,now+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start(now);osc.stop(now+duration+.015);
    osc.onended=()=>{void ctx.close();};
  }catch{/* Audio is optional if the browser blocks playback. */}
}
class CompetitionScene extends Phaser.Scene {
  private difficulty:FightDifficulty='normal';
  private hp=100;private sp=50;private enemyHp=100;private enemySp=50;private turn=1;
  private history:FightMove[]=[];private active=false;private status!:Phaser.GameObjects.Text;
  private bars!:Phaser.GameObjects.Text;private controls:Phaser.GameObjects.Container[]=[];
  private fighters:GymCharacter[]=[];private busy=false;
  private moves?:[FightMove,FightMove];
  constructor(){super('Competition');}
  init(data:{difficulty?:FightDifficulty}):void {this.difficulty=data?.difficulty||'normal';}
  create():void {
    arcadeFrame(this,'SPARRING','Both fighters act on each turn. Watch your stamina.');
    arcadeButton(this,420,35,72,27,'EXIT',()=>returnToTraining(this));
    this.controls=[];
    this.status=this.add.text(240,222,'',{fontFamily:UI_FONT,fontSize:'11px',color:cream,align:'center'}).setOrigin(.5);
    this.bars=this.add.text(240,89,'',{fontFamily:UI_FONT,fontSize:'11px',color:cream,align:'center'}).setOrigin(.5);
    this.startFight(this.difficulty);
  }
  private startFight(d:FightDifficulty):void {
    this.difficulty=d;this.hp=100;this.sp=50;this.enemyHp=100;this.enemySp=50;this.turn=1;this.history=[];this.active=true;
    this.busy=false;this.moves=undefined;
    this.drawArena();
    const descriptions=['-5 SP / 12 DMG','+5 SP / BLOCK','-20 SP / POWER','+15 SP / +8 HP'];
    FIGHT_MOVES.forEach((move,i)=>{
      const x=126+(i%2)*227,y=259+Math.floor(i/2)*40;
      const rect=this.add.rectangle(x,y,208,35,0x376b70).setStrokeStyle(2,gold).setInteractive({useHandCursor:true});
      const label=this.add.text(x,y,FIGHT_LABEL[move]+'  '+descriptions[i],{fontFamily:UI_FONT,fontSize:'11px',color:cream}).setOrigin(.5);
      rect.on('pointerdown',()=>this.choose(move));
      this.controls.push(this.add.container(0,0,[rect,label]));
    });
    this.status.setPosition(240,222).setFontSize(11).setText('Fight! Read the opponent and choose your move.');
    this.bars.setPosition(240,89).setFontSize(11);this.renderStats();
  }

  private drawArena():void {
    this.add.rectangle(240,171,430,86,0xc6a77e).setStrokeStyle(2,0x8a7055);
    this.add.rectangle(240,117,430,28,0x23454b);
    this.add.rectangle(240,143,430,3,0xe4d1a8);
    this.add.rectangle(240,189,430,3,0xe4d1a8);
    this.fighters=[new GymCharacter(this,147,202,0),new GymCharacter(this,333,202,3)];
    this.fighters.forEach((fighter,i)=>{
      fighter.body.setScale(1.8);
      fighter.face(i===0?1:-1,0);
      fighter.animate('idle',0);
    });
  }
  update(_time:number,delta:number):void {
    if(!this.active)return;
    this.fighters.forEach((fighter,i)=>{
      const move=this.busy?this.moves?.[i]:undefined;
      fighter.animate(move==='attack'||move==='big'?'shadow':move==='defend'||move==='breath'?'rest':'idle',Math.min(delta,50)/1000);
    });
  }
  private animateTurn(player:FightMove,enemy:FightMove,taken:number,dealt:number):void {
    const animate=(fighter:Phaser.GameObjects.Container,move:FightMove,amount:number,dir:number)=>{
      const base=fighter.x;
      if(move==='attack'||move==='big'){
        this.tweens.add({targets:fighter,x:base+dir*(move==='big'?25:15),duration:130,yoyo:true,ease:'Quad.Out'});
      }else if(move==='defend'){
        this.tweens.add({targets:fighter,scaleX:1.65,scaleY:1.7,duration:140,yoyo:true});
      }else{
        this.tweens.add({targets:fighter,y:fighter.y-9,duration:220,yoyo:true});
      }
      const label=move==='breath'?'+8 HP':move==='defend'?'BLOCK':amount>0?'-'+amount:'MISS';
      const popup=this.add.text(base,126,label,{fontFamily:UI_FONT,fontSize:'12px',fontStyle:'bold',color:move==='breath'?'#9cf2b0':'#fff1bf'}).setOrigin(.5).setDepth(20);
      this.tweens.add({targets:popup,y:108,alpha:0,duration:650,onComplete:()=>popup.destroy()});
    };
    this.moves=[player,enemy];
    animate(this.fighters[0].body,player,taken,1);
    animate(this.fighters[1].body,enemy,dealt,-1);
  }
  private probabilities():Record<FightMove,number> {
    const w:Record<FightMove,number>={attack:3,defend:1.5,big:2,breath:1.5};
    if(this.sp<15){w.breath+=8;w.big=0;}
    if(this.hp<30)w.breath+=2;
    if(this.difficulty!=='easy'){
      for(const m of this.history.slice(this.difficulty==='hard'?-8:-3))w[m]+=this.difficulty==='hard'?2.5:1;
      const last=this.history[this.history.length-1];if(last)w[last]+=this.difficulty==='hard'?3:1;
    }
    const legal=FIGHT_MOVES.filter(m=>FIGHT_COST[m]<=this.sp);
    const total=legal.reduce((s,m)=>s+w[m],0);
    return {attack:legal.includes('attack')?w.attack/total:0,defend:w.defend/total,big:legal.includes('big')?w.big/total:0,breath:w.breath/total};
  }
  private opponentMove():FightMove {
    const legal=FIGHT_MOVES.filter(m=>FIGHT_COST[m]<=this.enemySp);
    if(this.difficulty==='easy'&&Math.random()<.65)return Phaser.Utils.Array.GetRandom(legal);
    const probs=this.probabilities();
    const scored=legal.map(move=>{
      let score=0;
      for(const other of FIGHT_MOVES){
        const p=probs[other];if(!p)continue;
        const dealt=fightDamage(move,other,this.enemySp),taken=fightDamage(other,move,this.sp);
        const heal=move==='breath'?Math.min(8,100-this.enemyHp):0;
        const delta=Math.min(50,this.enemySp-FIGHT_COST[move])-this.enemySp;
        score+=p*(dealt*1.1-taken*1.3+heal+delta*(this.difficulty==='hard'?.4:.2));
        if(dealt>=this.hp)score+=p*60;
        if(taken>=this.enemyHp)score-=p*70;
      }
      return {move,score};
    }).sort((a,b)=>b.score-a.score);
    const error=this.difficulty==='easy'?.4:this.difficulty==='normal'?.18:.035;
    if(Math.random()<error)return Phaser.Utils.Array.GetRandom(legal);
    if(this.difficulty==='hard')return scored[0].move;
    return scored[Math.random()<.8?0:Math.min(1,scored.length-1)].move;
  }
  private choose(move:FightMove):void {
    if(!this.active||this.busy||FIGHT_COST[move]>this.sp)return;
    const enemy=this.opponentMove();
    const dealt=fightDamage(move,enemy,this.sp),taken=fightDamage(enemy,move,this.enemySp);
    this.hp=Phaser.Math.Clamp(this.hp-taken+(move==='breath'?8:0),0,100);
    this.enemyHp=Phaser.Math.Clamp(this.enemyHp-dealt+(enemy==='breath'?8:0),0,100);
    this.sp=Phaser.Math.Clamp(this.sp-FIGHT_COST[move],0,50);
    this.enemySp=Phaser.Math.Clamp(this.enemySp-FIGHT_COST[enemy],0,50);
    playFightSound(move);
    this.history.push(move);this.turn++;
    this.status.setText('YOU: '+FIGHT_LABEL[move]+'  |  AI: '+FIGHT_LABEL[enemy]+'\nDealt '+dealt+'  /  Took '+taken);
    this.renderStats();
    this.animateTurn(move,enemy,taken,dealt);
    this.busy=true;
    if(this.hp<=0||this.enemyHp<=0)this.time.delayedCall(650,()=>this.finish());
    else this.time.delayedCall(440,()=>{this.busy=false;});
  }
  private renderStats():void {
    this.bars.setText('YOU  HP '+this.hp+'  SP '+this.sp+'     |     OPPONENT  HP '+this.enemyHp+'  SP '+this.enemySp+'\nTURN '+this.turn+'  |  '+this.difficulty.toUpperCase());
    this.controls.forEach((control,i)=>control.setAlpha(FIGHT_COST[FIGHT_MOVES[i]]>this.sp?.42:1));
  }
  private finish():void {
    this.active=false;
    const win=this.hp>0&&this.enemyHp<=0,draw=this.hp<=0&&this.enemyHp<=0;
    const factor=this.difficulty==='hard'?2:this.difficulty==='normal'?1.5:1;
    const cash=Math.round((win?40:draw?15:8)*factor),rep=win?Math.round(factor):0;
    awardArcade(cash,rep,false);
    playFightSound(win?'win':'lose');
    this.controls.forEach(c=>c.destroy());this.controls=[];
    arcadeResult(this,win?'YOU WIN':draw?'DRAW':'YOU LOSE','Finished in '+(this.turn-1)+' turns',cash,rep);
  }
}


class ConditioningScene extends Phaser.Scene {
  private difficulty:TrainingDifficulty='normal';
  private active=false;private distance=0;private hits=0;private playerX=90;private y=248;private vy=0;private duck=false;
  private runner!:GymCharacter;private status!:Phaser.GameObjects.Text;
  private obstacles:{x:number,type:'jump'|'duck',body:Phaser.GameObjects.Rectangle,passed:boolean}[]=[];
  private readonly held=new Map<number,'left'|'right'|'down'>();
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private jumpPressed=false;
  init(data:{difficulty?:TrainingDifficulty}):void {this.difficulty=data.difficulty||'normal';}
  constructor(){super('Conditioning');}
  create():void {
    this.active=true;this.distance=0;this.hits=0;this.playerX=90;this.y=248;this.vy=0;this.obstacles=[];
    this.held.clear();this.duck=false;this.jumpPressed=false;
    arcadeFrame(this,'AGILITY COURSE','Jump hurdles and duck under bars. Hold the buttons to move.');
    this.add.rectangle(240,267,440,6,0xc4a37b);
    this.add.rectangle(240,290,440,42,0x587b68);
    this.status=this.add.text(24,78,'',{fontFamily:UI_FONT,fontSize:'12px',color:cream}).setDepth(20);
    this.runner=new GymCharacter(this,this.playerX,this.y,0);
    this.runner.face(1,0);
    const kb=this.input.keyboard!;
    this.keys=kb.addKeys('A,D,S,LEFT,RIGHT,DOWN,UP,SPACE') as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.on('pointerup',(p:Phaser.Input.Pointer)=>this.held.delete(p.id));
    this.input.on('pointerupoutside',(p:Phaser.Input.Pointer)=>this.held.delete(p.id));
    const clear=()=>this.held.clear();
    this.game.events.on(Phaser.Core.Events.BLUR,clear);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.game.events.off(Phaser.Core.Events.BLUR,clear));
    arcadeButton(this,419,35,74,27,'EXIT',()=>{this.active=false;returnToTraining(this);});
    this.holdButton(72,'LEFT','left');
    this.holdButton(166,'RIGHT','right');
    arcadeButton(this,314,295,84,34,'JUMP',()=>{this.jumpPressed=true;});
    this.holdButton(408,'DUCK','down');
  }
  private holdButton(x:number,label:string,action:'left'|'right'|'down'):void {
    const button=arcadeButton(this,x,295,84,34,label,()=>{});
    button.on('pointerdown',(p:Phaser.Input.Pointer)=>this.held.set(p.id,action));
  }
  update(_time:number,delta:number):void {
    if(!this.active)return;
    const dt=Math.min(delta/1000,0.05),keys=this.keys;
    const held=[...this.held.values()];
    const left=held.includes('left')||keys.A.isDown||keys.LEFT.isDown,right=held.includes('right')||keys.D.isDown||keys.RIGHT.isDown;
    this.duck=held.includes('down')||keys.S.isDown||keys.DOWN.isDown;
    this.playerX=Phaser.Math.Clamp(this.playerX+(Number(right)-Number(left))*170*dt,45,275);
    const jumpUp=Phaser.Input.Keyboard.JustDown(keys.UP),jumpSpace=Phaser.Input.Keyboard.JustDown(keys.SPACE);
    if((this.jumpPressed||jumpUp||jumpSpace)&&this.y>=248){this.vy=-295;}
    this.jumpPressed=false;this.vy+=790*dt;this.y=Math.min(248,this.y+this.vy*dt);if(this.y>=248)this.vy=0;
    this.runner.place(this.playerX,this.y);
    this.runner.body.setScale(1.4,this.duck&&this.y>=248?.94:1.4);
    this.runner.animate(this.y<248?'idle':this.duck?'rest':'walk',dt);
    const speed=this.difficulty==='easy'?105:this.difficulty==='hard'?170:135;
    this.distance+=speed*dt;
    const spacing=this.difficulty==='easy'?170:this.difficulty==='hard'?105:135;
    if(!this.obstacles.length||this.obstacles[this.obstacles.length-1].x<480-spacing){
      const type: 'jump'|'duck'=Math.random()<0.55?'jump':'duck';
      const body=this.add.rectangle(490,type==='jump'?250:207,type==='jump'?24:48,type==='jump'?26:10,type==='jump'?0xc07855:0xe6c076);
      this.obstacles.push({x:490,type,body,passed:false});
    }
    for(const o of this.obstacles){
      o.x-=speed*dt;o.body.x=o.x;
      if(!o.passed&&Math.abs(o.x-this.playerX)<18){
        o.passed=true;
        if(o.type==='jump'&&this.y>220||o.type==='duck'&&(!this.duck||this.y<240)){this.hits++;playGymCue('timeout');}
      }
    }
    this.obstacles=this.obstacles.filter(o=>{if(o.x<15){o.body.destroy();return false;}return true;});
    this.status.setText('DISTANCE '+Math.floor(this.distance)+'/1800   |   HITS '+this.hits+'   |   '+this.difficulty.toUpperCase());
    if(this.distance>=1800)this.finish();
  }
  private finish():void {
    this.active=false;const earned=Math.max(5,35-this.hits*5);
    awardArcade(earned,Math.max(0,3-this.hits),false);playGymCue('complete');
    arcadeResult(this,'COURSE COMPLETE',this.hits+' obstacles hit',earned,Math.max(0,3-this.hits));
  }
}

const combatGym = new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:330,backgroundColor:'#c9ae86',pixelArt:true,input:{activePointers:2},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[GymScene,SeminarScene,BriefingScene,RushScene,RhythmScene,MemoryScene,DefenseScene,CompetitionScene,ConditioningScene]});
// Test-only visibility for headless browser QA. Production builds do not expose the game object.
if(import.meta.env.DEV)(window as unknown as {__combatGym?:Phaser.Game}).__combatGym=combatGym;
