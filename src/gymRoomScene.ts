import Phaser from 'phaser';
import {GymCharacter} from './characters';
import {DEFAULT_COACH,normalizeCoachAppearance} from './coachStyle';
import {attendingIndices,STUDENT_NAMES} from './gymProgression';
import {dailyHelpStudents,dailyShiftReady,DAILY_SHIFT_CASH,DAILY_SHIFT_REP} from './hubActivities';
import {recharge,GEAR_WIPE_RESTORE,GEAR_REPAIR_RESTORE,CLEAN_GEAR_THRESHOLD,GEAR_WORKING_THRESHOLD} from './facilityOps';
import {GymNavigation,type Point} from './navigation';
import {ROOMS,normalizeRoom,roomTransition,studentRoom,unlockedRooms,type RoomId} from './gymRooms';
import {normalizeRoomState,itemRoom,type RoomState} from './roomState';
import {canFitRoomItem,canWalkInRoom,firstOpenSpot,footprint,itemLabel,roomFloor,type RoomFixture} from './roomItems';
import {makeRoomFixture} from './roomArt';
import {makeRoomGateway} from './roomGateways';
import {paintCompactRoom} from './compactRoomArt';

const SAVE_KEY=import.meta.env.VITE_GARAGE_PREVIEW==='1'
  ?'combat-culture-gym-garage-preview-v1'
  :import.meta.env.VITE_ISOLATE_SAVE==='1'
    ?'combat-culture-gym-living-preview-v1':'combat-culture-gym-v1';
type Furniture={kind:number;x:number;y:number;rotation:number;stored:boolean};
type ExtraSave={
  gymLevel?:number;day?:number;gymPhase?:string;arrivedCount?:number;enrolledStudents?:number;
  money?:number;reputation?:number;materials?:number[];supplies?:number[];
  furniture?:Furniture[];gearPositions?:Point[];gearStored?:boolean[];
  ownedGear?:boolean[];decorPositions?:Point[];decorStored?:boolean[];decorLevel?:number;
  coachAppearance?:unknown;roomState?:RoomState;
  coachedToday?:number[];friendships?:number[];lastTalkDays?:number[];
  studentXP?:number[][];studentStats?:number[][];studentGoals?:number[][];
  classesToday?:number;gatheredToday?:number[];dailyShiftClaimed?:boolean;lifetimeEarnings?:number;
  gearCondition?:number[];gearCleanliness?:number[];gearWipedToday?:number[];gearServicedToday?:number[];
  [key:string]:unknown;
};
type RoomStudent={actor:GymCharacter;id:number;goal:Point;pause:number;chat:Phaser.GameObjects.Text;indicator:Phaser.GameObjects.Text;hit:Phaser.GameObjects.Zone;pose:'stretch'|'bag'|'lift'|'rest'|'shadow'|'drink'};
function taskPoints(room:RoomId,kind:'trash'|'mop'):Point[] {
  const f=roomFloor(room),w=f.right-f.left,h=f.bottom-f.top;
  const relative=kind==='trash'
    ?[[.17,.27],[.39,.73],[.60,.29],[.79,.72],[.23,.76],[.76,.30]]
    :[[.25,.48],[.52,.75],[.76,.44]];
  return relative.map(([x,y])=>({x:Math.round(f.left+x*w),y:Math.round(f.top+y*h)}));
}
const WALK_SPEED=102;

/** Secondary rooms share the exact saved economy, roster and inventory with
 * the main gym. Each scene owns only its visible NPC actors and world sprites.
 */
export class GymRoomScene extends Phaser.Scene {
  private current:RoomId='outdoor';
  private level=3;
  private save:ExtraSave={};
  private roomState!:RoomState;
  private coach!:GymCharacter;
  private students:RoomStudent[]=[];
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private navigation=new GymNavigation((x,y)=>this.canStand(x,y));
  private path:Point[]=[];
  private targetTrash:number|null=null;
  private targetMop:number|null=null;
  private movingItem:RoomFixture|null=null;
  private ghost!:Phaser.GameObjects.Graphics;
  private message!:Phaser.GameObjects.Text;
  private status!:Phaser.GameObjects.Text;
  private cleanNodes:Phaser.GameObjects.Container[]=[];
  private fixtureSprites:Phaser.GameObjects.Container[]=[];
  private displayItems:RoomFixture[]=[];
  private inventoryPanel:Phaser.GameObjects.Container|null=null;
  private inventoryPage=0;
  private mopActive=false;
  private mopMarks:Phaser.GameObjects.GameObject[]=[];
  private pendingStudent:number|null=null;
  private pendingExit:RoomId|null=null;
  constructor(){super('GymRoom');}

  create(data?:{room?:RoomId;mopping?:boolean}):void {
    this.save=this.readSave();
    this.level=Math.max(1,Math.min(5,Math.floor(Number(this.save.gymLevel)||1)));
    this.roomState=normalizeRoomState(this.save.roomState,this.level);
    this.current=normalizeRoom(data?.room??this.roomState.currentRoom,this.level);
    if(this.current==='main'){this.scene.start('Gym');return;}
    this.roomState.currentRoom=this.current;
    this.roomState.trashByRoom[this.current]??=[0,1,2];
    this.save.roomState=this.roomState;
    this.writeSave();
    this.students=[];this.path=[];this.targetTrash=null;this.targetMop=null;this.movingItem=null;
    this.cleanNodes=[];this.displayItems=[];this.fixtureSprites=[];this.inventoryPanel=null;
    this.mopActive=!!data?.mopping;this.mopMarks=[];this.pendingStudent=null;this.pendingExit=null;
    this.reflowRoomItems();
    this.drawEnvironment();
    const room=ROOMS.find(r=>r.id===this.current)!;
    const savedPosition=this.roomState.playerPositions[this.current]||room.entry;
    const safe=this.canStand(savedPosition.x,savedPosition.y)?savedPosition:room.entry;
    this.coach=new GymCharacter(this,safe.x,safe.y,normalizeCoachAppearance(this.save.coachAppearance||DEFAULT_COACH));
    this.coach.body.setDepth(15);
    this.ghost=this.add.graphics().setDepth(42);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,ESC,M,ENTER,Q,X') as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-ESC',()=>{if(this.movingItem)this.cancelMove();else if(this.inventoryPanel)this.closeInventory();else this.requestExit('main');});
    this.input.keyboard!.on('keydown-M',()=>this.openInventory());
    this.input.keyboard!.on('keydown-Q',()=>this.rotateItem());
    this.input.keyboard!.on('keydown-X',()=>this.storeSelected());
    this.input.keyboard!.on('keydown-ENTER',()=>{if(this.movingItem)this.placeAt(this.coach.body.x+34,this.coach.body.y);});
    this.input.keyboard!.on('keydown-E',()=>this.interactNearby());
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer,targets:Phaser.GameObjects.GameObject[])=>{
      if(targets.length||this.inventoryPanel)return;
      this.pendingExit=null;
      if(pointer.worldY<94||pointer.worldY>220)return;
      if(this.movingItem){this.placeAt(pointer.worldX,pointer.worldY);return;}
      this.walkTo({x:pointer.worldX,y:pointer.worldY});
    });
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>{
      if(!this.movingItem||!pointer.wasTouch){
        if(this.movingItem)this.showPlacement(pointer.worldX,pointer.worldY);
      }
    });
    this.drawFixtures();
    this.navigation.rebuild();
    this.drawTrash();
    this.drawMop();
    this.drawStudents();
    this.addExits();
    this.addControls();
    this.updateStatus();
    this.notice('Walk up to equipment to inspect it, or open Inventory to build.');
  }
  private readSave():ExtraSave {
    try{
      const value=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
      return value&&typeof value==='object'?value as ExtraSave:{};
    }catch{return {};}
  }
  private writeSave():void {
    this.save.roomState=this.roomState;
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.save));}catch{/* unsupported storage */}
  }
  private trashPoints():Point[]{return taskPoints(this.current,'trash');}
  private mopPoints():Point[]{return taskPoints(this.current,'mop');}
  private mopStation():Point {
    const f=roomFloor(this.current);
    return {x:f.right-25,y:f.bottom-11};
  }
  private randomRoomPoint():Point {
    const f=roomFloor(this.current);
    return {x:f.left+22+Math.random()*(f.right-f.left-44),
      y:f.top+17+Math.random()*(f.bottom-f.top-34)};
  }
  /** Keep existing saves after rooms shrink: relocate items onto clear floor,
   * or store them without losing ownership when the smaller room is full. */
  private reflowRoomItems():void {
    const placed:RoomFixture[]=[];
    let changed=false;
    for(const item of this.createItemList()){
      if(canFitRoomItem(item,placed,this.current)){placed.push(item);continue;}
      const point=firstOpenSpot(item,placed,this.current);
      if(point){
        const updated={...item,...point};
        placed.push(updated);
        if(item.kind==='gear'){
          this.save.gearPositions??=[];this.save.gearPositions[item.index]=point;
        }else if(item.kind==='furniture'){
          Object.assign(this.save.furniture![item.index],point);
        }else{
          this.save.decorPositions??=[];this.save.decorPositions[item.index]=point;
        }
      }else if(item.kind==='gear'){
        this.save.gearStored??=[];
        this.save.gearStored[item.index]=true;
      }else if(item.kind==='furniture')this.save.furniture![item.index].stored=true;
      else{
        this.save.decorStored??=[];
        this.save.decorStored[item.index]=true;
      }
      changed=true;
    }
    if(changed)this.writeSave();
  }
  private persistPosition():void {
    this.roomState.playerPositions[this.current]={x:this.coach.body.x,y:this.coach.body.y};
    this.writeSave();
  }
  private restartRoom(mopping=this.mopActive):void {
    // Phaser destroys the scene on restart. Without recording the coach's
    // current position, every pickup or cleanup teleports them to the entrance.
    this.roomState.playerPositions[this.current]={x:this.coach.body.x,y:this.coach.body.y};
    this.writeSave();
    this.scene.restart({room:this.current,mopping});
  }
  private drawEnvironment():void {
    paintCompactRoom(this,this.current);
    this.add.rectangle(0,0,480,23,0x152b30).setOrigin(0).setDepth(29);
    this.status=this.add.text(12,11,'',{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#f9e0ad'})
      .setOrigin(0,.5).setDepth(30);
    this.add.rectangle(0,226,480,104,0x152b30).setOrigin(0).setDepth(29);
    this.message=this.add.text(16,244,'',{fontFamily:'Arial',fontSize:'10px',color:'#f2e8cf',
      wordWrap:{width:448}}).setDepth(31);
  }
  private createItemList():RoomFixture[] {
    const result:RoomFixture[]=[];
    (this.save.furniture||[]).forEach((item,i)=>{
      if(!item.stored&&itemRoom(this.roomState.furnitureRooms,i,this.level)===this.current)
        result.push({kind:'furniture',index:i,typeId:item.kind,x:item.x,y:item.y,rotation:item.rotation});
    });
    (this.save.ownedGear||[]).forEach((owned,i)=>{
      if(!owned||this.save.gearStored?.[i]||
        itemRoom(this.roomState.gearRooms,i,this.level)!==this.current)return;
      const point=this.save.gearPositions?.[i]||{x:120,y:140};
      result.push({kind:'gear',index:i,x:point.x,y:point.y,rotation:0});
    });
    (this.save.decorPositions||[]).forEach((pos,i)=>{
      if(i>=(this.save.decorLevel||0)||this.save.decorStored?.[i]||
        itemRoom(this.roomState.decorRooms,i,this.level)!==this.current)return;
      result.push({kind:'decor',index:i,typeId:i,x:pos.x,y:pos.y,rotation:0});
    });
    return result;
  }
  private drawFixtures():void {
    this.fixtureSprites.forEach(sprite=>sprite.destroy());
    this.fixtureSprites=[];
    this.displayItems=this.createItemList();
    for(const item of this.displayItems){
      this.fixtureSprites.push(makeRoomFixture(this,item,
        ()=>item.kind==='gear'?this.openGearStation(item):this.moveItem(item)));
    }
    this.navigation.rebuild();
  }
  private canStand(x:number,y:number):boolean {
    return canWalkInRoom({x,y},this.displayItems,this.current);
  }
  private walkTo(point:Point):void {
    if(this.movingItem)return;
    this.pendingExit=null;
    const target=this.navigation.recover(point);
    this.path=this.navigation.route(this.coach.body,target);
  }
  private addExits():void {
    const room=ROOMS.find(r=>r.id===this.current)!;
    for(const [destination,exit] of Object.entries(room.exits)){
      if(!exit||!unlockedRooms(this.level).some(r=>r.id===destination))continue;
      const target=destination as RoomId;
      makeRoomGateway(this,this.current,exit.x,exit.y,
        ()=>this.requestExit(target),{returning:target==='main',depth:9.5});
    }
  }
  private addControls():void {
    this.control(16,282,135,'INVENTORY  [M]',()=>this.openInventory());
    this.control(171,282,137,'CLEAN / MOP',()=>this.beginMop());
    this.control(326,282,137,'MAIN GYM',()=>this.requestExit('main'));
    this.add.text(240,321,'WASD / ARROWS: MOVE    E: INTERACT    ESC: RETURN',
      {fontFamily:'Arial',fontSize:'9px',color:'#b5c9c0'}).setOrigin(.5).setDepth(31);
  }
  private control(x:number,y:number,w:number,label:string,callback:()=>void):void {
    const background=this.add.rectangle(x,y,w,30,0x345c60).setOrigin(0)
      .setStrokeStyle(1,0x6e9d97).setDepth(31).setInteractive({useHandCursor:true});
    const caption=this.add.text(x+w/2,y+15,label,{fontFamily:'Arial',fontSize:'10px',color:'#f4e8cd'})
      .setOrigin(.5).setDepth(32);
    background.on('pointerdown',callback);
    caption.setInteractive({useHandCursor:true}).on('pointerdown',callback);
  }
  private updateStatus():void {
    const name=ROOMS.find(r=>r.id===this.current)!.name.toUpperCase();
    this.status.setText(name+'   LV '+this.level+'  DAY '+(this.save.day||1)+
      '   $'+(this.save.money||0)+'   REP '+(this.save.reputation||0));
  }
  private notice(text:string):void {this.message.setText(text);}
  private requestExit(destination:RoomId):void {
    const transition=roomTransition(this.current,destination,this.level);
    if(!transition||this.inventoryPanel||this.movingItem)return;
    const f=roomFloor(this.current);
    const exit=transition.exit;
    const approach=this.navigation.recover({
      x:Phaser.Math.Clamp(exit.x+(exit.x<(f.left+f.right)/2?27:-27),f.left+15,f.right-15),
      y:Phaser.Math.Clamp(exit.y,f.top+12,f.bottom-12)
    });
    if(Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,approach.x,approach.y)<14){
      this.goTo(destination);return;
    }
    this.pendingStudent=null;
    this.path=this.navigation.route(this.coach.body,approach);
    if(!this.path.length){this.notice('That exit is blocked. Clear equipment from the walkway.');return;}
    this.pendingExit=destination;
    this.notice('Walking to the '+(destination==='main'?'main gym':'next room')+' entrance.');
  }
  private goTo(destination:RoomId):void {
    if(!roomTransition(this.current,destination,this.level))return;
    this.roomState.playerPositions[this.current]={
      x:this.coach.body.x,y:this.coach.body.y
    };
    this.roomState.currentRoom=destination;
    if(destination==='main'){
      // Each return point is inside the unchanged Level 2-sized main mat,
      // never in the wall, reception fixtures or a locked service corridor.
      const approaches:Record<RoomId,Point>={
        main:{x:170,y:150},outdoor:{x:86,y:153},upstairs:{x:273,y:144},downstairs:{x:85,y:191}
      };
      this.roomState.playerPositions.main=approaches[this.current];
    }
    this.writeSave();
    if(destination==='main')this.scene.start('Gym');
    else this.scene.restart({room:destination});
  }
  private inventoryOptions():RoomFixture[] {
    const items:RoomFixture[]=[];
    (this.save.furniture||[]).forEach((item,i)=>items.push({
      kind:'furniture',index:i,typeId:item.kind,x:item.x,y:item.y,rotation:item.rotation
    }));
    (this.save.ownedGear||[]).forEach((owned,i)=>{
      if(!owned)return;
      const p=this.save.gearPositions?.[i]||{x:180,y:150};
      items.push({kind:'gear',index:i,x:p.x,y:p.y,rotation:0});
    });
    (this.save.decorPositions||[]).forEach((p,i)=>{
      if(i>=(this.save.decorLevel||0))return;
      items.push({kind:'decor',index:i,typeId:i,x:p.x,y:p.y,rotation:0});
    });
    return items;
  }
  private openInventory(page=0):void {
    if(this.movingItem||this.inventoryPanel)return;
    this.path=[];this.pendingExit=null;
    const panel=this.add.container(0,0).setDepth(65);
    this.inventoryPanel=panel;
    panel.add(this.add.rectangle(240,137,432,182,0x243e44).setStrokeStyle(2,0xb9a379)
      .setInteractive());
    panel.add(this.add.text(37,54,'BUILD / MOVE INVENTORY',{
      fontFamily:'Arial',fontSize:'13px',color:'#ffe1a0'
    }));
    const all=this.inventoryOptions();
    const pages=Math.max(1,Math.ceil(all.length/10));
    this.inventoryPage=Math.max(0,Math.min(pages-1,page));
    const options=all.slice(this.inventoryPage*10,(this.inventoryPage+1)*10);
    if(!options.length)panel.add(this.add.text(47,96,'No equipment purchased. Visit the main desk shop.',{
      fontFamily:'Arial',fontSize:'11px',color:'#f5e6cc'
    }));
    options.forEach((item,i)=>{
      const room=itemRoom(item.kind==='gear'?this.roomState.gearRooms:
        item.kind==='furniture'?this.roomState.furnitureRooms:this.roomState.decorRooms,item.index,this.level);
      const stored=item.kind==='gear'?!!this.save.gearStored?.[item.index]:
        item.kind==='furniture'?!!this.save.furniture?.[item.index]?.stored:
          !!this.save.decorStored?.[item.index];
      const text=itemLabel(item).toUpperCase()+' ['+(stored?'STORED':room===this.current?'HERE':room.toUpperCase())+']';
      const x=41+(i%2)*200,y=79+Math.floor(i/2)*25;
      const option=this.add.text(x,y,text,{fontFamily:'Arial',fontSize:'9px',color:'#f4dfb9',
        backgroundColor:'#396268',padding:{x:4,y:5}}).setInteractive({useHandCursor:true});
      option.on('pointerdown',()=>{this.closeInventory();this.moveItem(item);});
      panel.add(option);
    });
    if(pages>1){
      const nav=(x:number,label:string,next:number)=>{
        const button=this.add.text(x,210,label,{fontFamily:'Arial',fontSize:'10px',
          color:'#ffdfad',backgroundColor:'#41646c',padding:{x:7,y:3}})
          .setInteractive({useHandCursor:true});
        button.on('pointerdown',()=>{this.closeInventory();this.openInventory(next);});
        panel.add(button);
      };
      if(this.inventoryPage>0)nav(43,'PREVIOUS',this.inventoryPage-1);
      if(this.inventoryPage<pages-1)nav(346,'NEXT',this.inventoryPage+1);
      panel.add(this.add.text(243,214,(this.inventoryPage+1)+' / '+pages,{
        fontFamily:'Arial',fontSize:'10px',color:'#eed0a2'}).setOrigin(.5));
    }
    const close=this.add.text(424,54,'CLOSE', {fontFamily:'Arial',fontSize:'10px',
      color:'#ffffff',backgroundColor:'#684e47',padding:{x:5,y:5}}).setOrigin(1,0)
      .setInteractive({useHandCursor:true});
    close.on('pointerdown',()=>this.closeInventory());
    panel.add(close);
  }
  private closeInventory():void {this.inventoryPanel?.destroy();this.inventoryPanel=null;}
  private openGearStation(item:RoomFixture):void {
    if(this.inventoryPanel||this.movingItem||item.kind!=='gear')return;
    const i=item.index;
    if(!this.save.ownedGear?.[i]||this.save.gearStored?.[i])return;
    const health=this.save.gearCondition?.[i]??100;
    const clean=this.save.gearCleanliness?.[i]??100;
    const sanitizer=this.save.supplies?.[3]??0;
    const scrap=this.save.materials?.[0]??0;
    const panel=this.add.container(0,0).setDepth(65);
    this.inventoryPanel=panel;
    panel.add(this.add.rectangle(240,143,426,180,0x243e44)
      .setStrokeStyle(2,0xd5b588).setInteractive());
    panel.add(this.add.text(240,68,itemLabel(item).toUpperCase()+' / MAINTENANCE',{
      fontFamily:'Arial',fontSize:'12px',color:'#f4e5c9'
    }).setOrigin(.5));
    panel.add(this.add.text(240,90,'CONDITION '+health+'%    HYGIENE '+clean+'%',{
      fontFamily:'Arial',fontSize:'11px',
      color:health<GEAR_WORKING_THRESHOLD||clean<CLEAN_GEAR_THRESHOLD?'#f1ad91':'#b3e5ba'
    }).setOrigin(.5));
    panel.add(this.add.text(240,106,'SANITIZER '+sanitizer+'  |  SCRAP '+scrap,{
      fontFamily:'Arial',fontSize:'10px',color:'#e8d19e'
    }).setOrigin(.5));
    const action=(x:number,y:number,width:number,label:string,enabled:boolean,callback:()=>void)=>{
      const button=this.add.text(x,y,label,{
        fontFamily:'Arial',fontSize:'10px',color:enabled?'#f5e8d1':'#879a9a',
        backgroundColor:enabled?'#3b7066':'#35494b',padding:{x:7,y:6}
      }).setOrigin(.5);
      if(enabled){button.setInteractive({useHandCursor:true});button.on('pointerdown',callback);}
      panel.add(button);return button;
    };
    action(145,146,158,'CLEAN: -1 SANITIZER',clean<90&&sanitizer>0&&
      !this.save.gearWipedToday?.includes(i),()=>this.maintainGear(i,'clean'));
    action(340,146,155,'REPAIR: -1 SCRAP',health<90&&scrap>0&&
      !this.save.gearServicedToday?.includes(i),()=>this.maintainGear(i,'repair'));
    action(147,193,158,'MOVE / REPOSITION',true,()=>{this.closeInventory();this.moveItem(item);});
    action(343,193,155,'CLOSE',true,()=>this.closeInventory());
  }
  private maintainGear(index:number,kind:'clean'|'repair'):void {
    if(!this.save.ownedGear?.[index]||this.save.gearStored?.[index])return;
    if(kind==='clean'){
      if((this.save.supplies?.[3]||0)<1||this.save.gearWipedToday?.includes(index)||
        (this.save.gearCleanliness?.[index]??100)>=90)return;
      this.save.supplies![3]--;
      this.save.gearCleanliness??=Array(8).fill(100);
      this.save.gearCleanliness[index]=recharge(this.save.gearCleanliness[index],GEAR_WIPE_RESTORE);
      this.save.gearWipedToday??=[];this.save.gearWipedToday.push(index);
    }else{
      if((this.save.materials?.[0]||0)<1||this.save.gearServicedToday?.includes(index)||
        (this.save.gearCondition?.[index]??100)>=90)return;
      this.save.materials![0]--;
      this.save.gearCondition??=Array(8).fill(100);
      this.save.gearCondition[index]=recharge(this.save.gearCondition[index],GEAR_REPAIR_RESTORE);
      this.save.gearServicedToday??=[];this.save.gearServicedToday.push(index);
    }
    this.writeSave();this.closeInventory();
    this.notice(itemLabel({kind:'gear',index,x:0,y:0,rotation:0})+
      (kind==='clean'?' sanitized.':' repaired.'));
  }
  private moveItem(item:RoomFixture):void {
    if(this.inventoryPanel)return;
    this.movingItem={...item};
    this.path=[];this.pendingExit=null;
    this.showPlacement(this.coach.body.x+37,this.coach.body.y);
    this.notice('Moving '+itemLabel(item)+'. Click a clear floor spot; Q rotates, X stores, ESC cancels.');
  }
  private showPlacement(x:number,y:number):void {
    if(!this.movingItem)return;
    const candidate={...this.movingItem,x:Math.round(x/6)*6,y:Math.round(y/6)*6};
    const others=this.displayItems.filter(item=>item.kind!==candidate.kind||item.index!==candidate.index);
    const valid=canFitRoomItem(candidate,others,this.current)&&
      Math.abs(candidate.x-this.coach.body.x)>=footprint(candidate).rx+8;
    this.ghost.clear();
    this.ghost.lineStyle(2,valid?0x84d2a2:0xe98377);
    const size=footprint(candidate);
    this.ghost.strokeRect(candidate.x-size.rx,candidate.y-size.ry,size.rx*2,size.ry*2);
    this.ghost.setAlpha(.9);
  }
  private placeAt(x:number,y:number):void {
    if(!this.movingItem)return;
    const chosen={...this.movingItem,x:Math.round(x/6)*6,y:Math.round(y/6)*6};
    const others=this.displayItems.filter(item=>item.kind!==chosen.kind||item.index!==chosen.index);
    if(!canFitRoomItem(chosen,others,this.current)||
      Math.abs(chosen.x-this.coach.body.x)<footprint(chosen).rx+8&&
      Math.abs(chosen.y-this.coach.body.y)<footprint(chosen).ry+5){
      this.notice('Not enough clear floor space. Avoid equipment, doorways and the coach.');return;
    }
    if(chosen.kind==='furniture'){
      const item=this.save.furniture?.[chosen.index];if(!item)return;
      Object.assign(item,{x:chosen.x,y:chosen.y,rotation:chosen.rotation,stored:false});
      this.roomState.furnitureRooms[chosen.index]=this.current;
    }else if(chosen.kind==='gear'){
      this.save.gearPositions??=[];
      this.save.gearPositions[chosen.index]={x:chosen.x,y:chosen.y};
      this.save.gearStored??=[];
      this.save.gearStored[chosen.index]=false;
      this.roomState.gearRooms[chosen.index]=this.current;
    }else{
      this.save.decorPositions??=[];
      this.save.decorPositions[chosen.index]={x:chosen.x,y:chosen.y};
      this.save.decorStored??=[];
      this.save.decorStored[chosen.index]=false;
      this.roomState.decorRooms[chosen.index]=this.current;
    }
    this.persistPosition();this.movingItem=null;this.ghost.clear();
    this.drawFixtures();this.notice('Item placed without leaving the room.');
  }
  private storeSelected():void {
    if(!this.movingItem)return;
    const item=this.movingItem;
    if(item.kind==='gear'){this.save.gearStored??=[];this.save.gearStored[item.index]=true;}
    else if(item.kind==='furniture'){
      const furniture=this.save.furniture?.[item.index];if(!furniture)return;
      furniture.stored=true;
    }else{this.save.decorStored??=[];this.save.decorStored[item.index]=true;}
    this.persistPosition();this.movingItem=null;this.ghost.clear();
    this.drawFixtures();this.notice('Item stored in the shared gym inventory.');
  }
  private rotateItem():void {
    if(this.movingItem?.kind!=='furniture')return;
    this.movingItem.rotation=(this.movingItem.rotation+1)%4;
    this.notice('Rotated '+itemLabel(this.movingItem)+'. Select a clear space to place it.');
  }
  private cancelMove():void {
    this.movingItem=null;this.ghost.clear();
    this.notice('Placement cancelled. Your equipment has not moved.');
  }
  private drawTrash():void {
    this.cleanNodes.forEach(node=>node.destroy());this.cleanNodes=[];
    const left=this.roomState.trashByRoom[this.current]||[];
    for(const id of left){
      const p=this.trashPoints()[id];if(!p)continue;
      const node=this.add.container(p.x,p.y).setDepth(9+p.y/100);
      const art=this.add.graphics();
      art.fillStyle(0x344f4a,.4).fillEllipse(0,2,19,6);
      if(id%3===0){art.fillStyle(0x9bc4ba).fillRect(-6,-4,10,6);art.fillStyle(0x4d8c8b).fillRect(2,-2,4,4);}
      else if(id%3===1){art.fillStyle(0xc5a77b).fillRect(-7,-4,14,7);art.fillStyle(0x896b56).fillRect(-5,-2,10,2);}
      else{art.fillStyle(0xb9766d).fillRect(-7,-5,15,7);art.fillStyle(0xe8bca1).fillRect(-4,-4,10,5);}
      const hint=this.add.text(0,-19,'CLEAN',{fontFamily:'Arial',fontSize:'8px',
        color:'#ffeaad',backgroundColor:'#3c5254'}).setOrigin(.5).setVisible(false);
      const hit=this.add.zone(0,-3,30,24).setInteractive({useHandCursor:true});
      hit.on('pointerover',()=>hint.setVisible(true));
      hit.on('pointerout',()=>hint.setVisible(false));
      hit.on('pointerdown',()=>this.pickTrash(id));
      node.add([art,hint,hit]);this.cleanNodes.push(node);
    }
  }
  private pickTrash(index:number):void {
    const p=this.trashPoints()[index];if(!p)return;
    if(Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,p.x,p.y)<27){
      this.cleanTrash(index);return;
    }
    this.targetTrash=index;this.targetMop=null;
    this.walkTo(p);
    this.notice('Heading to clean up discarded gym supplies.');
  }
  private cleanTrash(index:number):void {
    const list=this.roomState.trashByRoom[this.current]||[];
    if(!list.includes(index))return;
    this.roomState.trashByRoom[this.current]=list.filter(n=>n!==index);
    this.save.materials??=[0,0,0];
    this.save.materials[index%3]=(this.save.materials[index%3]||0)+1;
    if(!this.roomState.trashByRoom[this.current]?.length)
      this.save.reputation=(this.save.reputation||0)+1;
    this.persistPosition();this.drawTrash();this.updateStatus();
    this.notice('Trash cleared. Materials collected and saved.');
  }
  private drawMop():void {
    const point=this.mopStation();
    const mop=this.add.container(point.x,point.y).setDepth(14);
    const art=this.add.graphics();
    art.fillStyle(0x2a4347).fillEllipse(0,3,27,7);
    art.fillStyle(0x7694a0).fillRect(-7,-9,14,13);
    art.fillStyle(0xb6c9c7).fillRect(-8,-8,16,2);
    art.lineStyle(3,0xd1ad75).lineBetween(8,-31,11,-5);
    art.fillStyle(0x97b2a8).fillRect(5,-6,13,4);
    const hit=this.add.zone(0,-10,35,35).setInteractive({useHandCursor:true});
    hit.on('pointerdown',()=>this.beginMop());
    mop.add([art,hit]);
    // Floor targets are an ACTIVE mop minigame, never default room graphics.
    if(this.mopActive)this.drawMopMarkers();
  }
  private drawMopMarkers():void {
    if(this.mopMarks.length)return;
    const done=this.roomState.moppedByRoom[this.current]||[];
    for(const [id,p] of this.mopPoints().entries()){
      if(done.includes(id))continue;
      const spot=this.add.circle(p.x,p.y,7,0x80bed1,.35)
        .setStrokeStyle(1,0xbde6e1).setDepth(8).setInteractive({useHandCursor:true});
      spot.on('pointerdown',()=>this.goMop(id));
      this.mopMarks.push(spot);
    }
  }
  private beginMop():void {
    if((this.roomState.moppedByRoom[this.current]||[]).length>=this.mopPoints().length){
      this.notice('This room has already been mopped today.');return;
    }
    if((this.save.supplies?.[3]||0)<1){
      this.notice('Buy sanitizing supplies at the main gym storage closet first.');return;
    }
    if(!this.mopActive){this.mopActive=true;this.drawMopMarkers();}
    const remaining=this.mopPoints().findIndex((_,i)=>!this.roomState.moppedByRoom[this.current]?.includes(i));
    if(remaining>=0)this.goMop(remaining);
  }
  private goMop(index:number):void {
    if((this.save.supplies?.[3]||0)<1){this.notice('No sanitizer. Restock at reception.');return;}
    const p=this.mopPoints()[index];if(!p)return;
    if(Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,p.x,p.y)<19){
      this.mopSpot(index);return;
    }
    this.targetMop=index;this.targetTrash=null;
    this.walkTo(p);this.notice('Mopping this room. Cross all three floor markers.');
  }
  private mopSpot(index:number):void {
    const cleaned=this.roomState.moppedByRoom[this.current]||[];
    if(cleaned.includes(index))return;
    const next=[...cleaned,index];
    this.roomState.moppedByRoom[this.current]=next;
    if(next.length===this.mopPoints().length){
      this.save.supplies![3]--;
      this.save.reputation=(this.save.reputation||0)+1;
    }
    this.mopActive=next.length<this.mopPoints().length;
    this.persistPosition();
    this.mopMarks.forEach(mark=>mark.destroy());this.mopMarks=[];
    if(this.mopActive)this.drawMopMarkers();
    this.updateStatus();
    this.notice(this.mopActive?'Keep mopping the remaining spots.':'Room mopped. Reputation improved.');
  }
  private drawStudents():void {
    if(this.save.gymPhase==='opening'||this.save.gymPhase==='closing')return;
    const enrolled=Number(this.save.enrolledStudents)||4;
    const schedule=attendingIndices(enrolled,this.level,Number(this.save.day)||1)
      .slice(0,Math.max(0,Number(this.save.arrivedCount)||0));
    for(const id of schedule){
      const assignment=this.roomState.studentRooms[id]||studentRoom(id,this.level);
      if(assignment!==this.current)continue;
      const seed=this.students.length;
      const f=roomFloor(this.current);
      const point={x:f.left+(seed%3+1)*(f.right-f.left)/4,
        y:f.top+(Math.floor(seed/3)+1)*(f.bottom-f.top)/3};
      const spawn=this.navigation.recover(point);
      const actor=new GymCharacter(this,spawn.x,spawn.y,1+(id%4));
      const chat=this.add.text(spawn.x,spawn.y-43,'',{fontFamily:'Arial',fontSize:'9px',color:'#233d42',
        backgroundColor:'#f8ebd6',padding:{x:5,y:2}}).setOrigin(.5,1).setVisible(false).setDepth(34);
      const indicator=this.add.text(spawn.x,spawn.y-40,'?',{fontFamily:'Arial',fontSize:'12px',
        color:'#f9e9c9',backgroundColor:'#5d6650',padding:{x:3,y:1}})
        .setOrigin(.5).setDepth(35).setVisible(this.canCoach(id));
      // Containers can lose pointer hit tests when children use foot-origin
      // coordinates. A dedicated transparent zone follows the NPC each frame.
      const hit=this.add.zone(spawn.x,spawn.y-20,38,44).setDepth(25)
        .setInteractive({useHandCursor:true});
      const npc:RoomStudent={id,actor,goal:{...spawn},pause:seed*.7+1,
        chat,indicator,hit,pose:'shadow'};
      hit.on('pointerdown',(_p:Phaser.Input.Pointer,_x:number,_y:number,
        event:Phaser.Types.Input.EventData)=>{
        event.stopPropagation();
        if(!this.inventoryPanel&&!this.movingItem)this.talkTo(npc);
      });
      this.students.push(npc);
    }
  }
  private talkTo(npc:RoomStudent):void {
    if(Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,
      npc.actor.body.x,npc.actor.body.y)>48){
      this.pendingStudent=npc.id;
      this.walkTo({x:npc.actor.body.x,y:npc.actor.body.y});
      this.notice('Walking over to '+STUDENT_NAMES[npc.id]+'.');return;
    }
    this.pendingStudent=null;
    if(this.canCoach(npc.id)){this.openCoaching(npc);return;}
    const lines=['Ready for training!','Working on my technique.','Nice gym, coach.','One more round!'];
    npc.chat.setText(STUDENT_NAMES[npc.id]+': '+lines[(npc.id+(this.save.day||1))%lines.length])
      .setPosition(npc.actor.body.x,npc.actor.body.y-43).setVisible(true);
    this.time.delayedCall(2200,()=>npc.chat?.setVisible(false));
    npc.pause=2.5;npc.actor.animate('talk',0.1);
  }
  private canCoach(id:number):boolean {
    const present=attendingIndices(Number(this.save.enrolledStudents)||4,this.level,
      Number(this.save.day)||1);
    return this.save.gymPhase==='open'&&
      dailyHelpStudents(present,Number(this.save.day)||1).includes(id)&&
      !(this.save.coachedToday||[]).includes(id)&&
      (this.save.coachedToday||[]).length<2;
  }
  private openCoaching(npc:RoomStudent):void {
    if(this.inventoryPanel||!this.canCoach(npc.id))return;
    const panel=this.add.container(0,0).setDepth(65);
    this.inventoryPanel=panel;
    panel.add(this.add.rectangle(240,142,422,157,0x243e44).setStrokeStyle(2,0xd5b588).setInteractive());
    const goal=this.save.studentGoals?.[npc.id]||[0,0];
    const statName=['STRIKING','SPEED','STRENGTH','CONDITIONING'][goal[1]]||'STRIKING';
    panel.add(this.add.text(240,86,STUDENT_NAMES[npc.id].toUpperCase()+' NEEDS HELP',{
      fontFamily:'Arial',fontSize:'13px',color:'#f6e4bc'
    }).setOrigin(.5));
    const choose=(x:number,label:string,kind:'goal'|'bond')=>{
      const button=this.add.text(x,135,label,{fontFamily:'Arial',fontSize:'10px',
        color:'#f6e4bc',backgroundColor:'#396a62',padding:{x:10,y:9}})
        .setOrigin(.5).setInteractive({useHandCursor:true});
      button.on('pointerdown',()=>{this.closeInventory();this.coachStudent(npc,kind);});
      panel.add(button);
    };
    choose(150,'COACH '+statName+'  +25 XP','goal');
    choose(341,'ENCOURAGE  +3 BOND','bond');
    const cancel=this.add.text(240,180,'CANCEL',{fontFamily:'Arial',fontSize:'10px',
      color:'#f6e4bc',backgroundColor:'#644c45',padding:{x:9,y:5}}).setOrigin(.5).setInteractive();
    cancel.on('pointerdown',()=>this.closeInventory());panel.add(cancel);
  }
  private coachStudent(npc:RoomStudent,kind:'goal'|'bond'):void {
    const id=npc.id;
    if(!this.canCoach(id))return;
    this.save.coachedToday??=[];
    this.save.coachedToday.push(id);
    this.save.friendships??=[];
    this.save.friendships[id]=(this.save.friendships[id]||0)+(kind==='bond'?3:1);
    if(kind==='goal'){
      const stat=Math.max(0,Math.min(3,this.save.studentGoals?.[id]?.[1]||0));
      const total=Math.max(Number(this.save.enrolledStudents)||4,id+1);
      this.save.studentStats??=Array.from({length:total},()=>[10,10,10,10]);
      this.save.studentXP??=Array.from({length:total},()=>[0,0,0,0]);
      this.save.studentStats[id]??=[10,10,10,10];
      this.save.studentXP[id]??=[0,0,0,0];
      let level=this.save.studentStats[id][stat]||10;
      let xp=(this.save.studentXP[id][stat]||0)+25;
      const threshold=(n:number)=>n<20?30:n<40?55:n<60?90:n<80?140:220;
      while(level<100&&xp>=threshold(level)){xp-=threshold(level);level++;}
      this.save.studentStats[id][stat]=level;
      this.save.studentXP[id][stat]=level>=100?0:xp;
    }
    this.save.reputation=(this.save.reputation||0)+1;
    if(dailyShiftReady(this.save.coachedToday.length,
      this.save.gatheredToday?.length||0,this.save.classesToday||0,
      this.save.dailyShiftClaimed===true,
      Math.min(2,attendingIndices(Number(this.save.enrolledStudents)||4,this.level,
        Number(this.save.day)||1).length))){
      this.save.dailyShiftClaimed=true;
      this.save.money=(this.save.money||0)+DAILY_SHIFT_CASH;
      this.save.lifetimeEarnings=(this.save.lifetimeEarnings||0)+DAILY_SHIFT_CASH;
      this.save.reputation=(this.save.reputation||0)+DAILY_SHIFT_REP;
    }
    this.writeSave();this.updateStatus();
    this.notice(STUDENT_NAMES[id]+': Thanks, coach! '+(kind==='goal'?'+25 training XP.':'+3 bond.'));
    npc.indicator.setVisible(false);
  }
  private interactNearby():void {
    if(this.movingItem){this.placeAt(this.coach.body.x+34,this.coach.body.y);return;}
    for(const [destination,point] of Object.entries(ROOMS.find(r=>r.id===this.current)!.exits)){
      if(point&&Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,point.x,point.y)<42){
        this.requestExit(destination as RoomId);return;
      }
    }
    const nearest=(this.roomState.trashByRoom[this.current]||[]).find(i=>{
      const p=this.trashPoints()[i];
      return p&&Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,p.x,p.y)<28;
    });
    if(nearest!==undefined){this.cleanTrash(nearest);return;}
    const station=this.mopStation();
    if(Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,station.x,station.y)<36){
      this.beginMop();return;
    }
    for(const npc of this.students){
      if(Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,
        npc.actor.body.x,npc.actor.body.y)<35){this.talkTo(npc);return;}
    }
    this.notice('Move closer to a door, student, litter or cleaning station.');
  }
  update(_time:number,delta:number):void {
    if(!this.coach)return;
    const dt=Math.min(delta,50)/1000;
    if(!this.inventoryPanel&&!this.movingItem){
      const x=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-
        Number(this.keys.A.isDown||this.keys.LEFT.isDown);
      const y=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-
        Number(this.keys.W.isDown||this.keys.UP.isDown);
      if(x||y){
        this.path=[];this.pendingExit=null;
        const len=Math.hypot(x,y);
        const nx=this.coach.body.x+x/len*WALK_SPEED*dt;
        const ny=this.coach.body.y+y/len*WALK_SPEED*dt;
        if(this.canStand(nx,this.coach.body.y))this.coach.body.x=nx;
        if(this.canStand(this.coach.body.x,ny))this.coach.body.y=ny;
        this.coach.face(x,y);this.coach.animate('walk',dt);
      }else if(this.path.length){
        const p=this.path[0],dx=p.x-this.coach.body.x,dy=p.y-this.coach.body.y;
        const d=Math.hypot(dx,dy),speed=Math.min(WALK_SPEED*dt,d);
        if(d<3){
          this.path.shift();
          if(!this.path.length&&this.pendingExit){
            const destination=this.pendingExit;
            this.pendingExit=null;this.goTo(destination);return;
          }
        }
        else{
          const nx=this.coach.body.x+dx/d*speed,ny=this.coach.body.y+dy/d*speed;
          if(this.canStand(nx,ny)){this.coach.body.setPosition(nx,ny);
            this.coach.face(dx,dy);this.coach.animate('walk',dt);}
          else{this.path=[];this.pendingExit=null;}
        }
      }else this.coach.animate('idle',dt);
    }
    if(this.movingItem||this.inventoryPanel)this.coach.animate('idle',dt);
    this.coach.place(this.coach.body.x,this.coach.body.y);
    if(this.targetTrash!==null){
      const p=this.trashPoints()[this.targetTrash];
      if(p&&Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,p.x,p.y)<27){
        this.cleanTrash(this.targetTrash);return;
      }
    }
    if(this.targetMop!==null){
      const p=this.mopPoints()[this.targetMop];
      if(p&&Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,p.x,p.y)<19){
        this.mopSpot(this.targetMop);return;
      }
    }
    if(this.inventoryPanel||this.movingItem)return;
    if(this.pendingStudent!==null){
      const target=this.students.find(npc=>npc.id===this.pendingStudent);
      if(target&&Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,
        target.actor.body.x,target.actor.body.y)<46){
        this.path=[];this.pendingStudent=null;this.talkTo(target);
      }else if(!target||!this.path.length){this.pendingStudent=null;}
    }
    for(const npc of this.students){
      if(npc.pause>0){npc.pause-=dt;npc.actor.animate(npc.pose,dt);}
      else{
        const body=npc.actor.body;
        const dist=Phaser.Math.Distance.Between(body.x,body.y,npc.goal.x,npc.goal.y);
        if(dist<3){
          npc.pause=2+Math.random()*4;
          const nearby=this.displayItems.filter(item=>item.kind!=='decor');
          const selected=nearby.length?nearby[Math.floor(Math.random()*nearby.length)]:null;
          if(selected){
            const b=footprint(selected);
            const goal={x:selected.x+b.rx+14,y:selected.y};
            if(this.canStand(goal.x,goal.y)){
              npc.goal=goal;
              npc.pose=selected.kind==='furniture'&&selected.typeId===3?'drink':
                selected.kind==='furniture'&&selected.typeId===1?'rest':
                selected.kind==='gear'&&selected.index>=4?'lift':'bag';
            }
          }else npc.pose='shadow';
          if(Math.hypot(npc.goal.x-body.x,npc.goal.y-body.y)<3){
            for(let tryNo=0;tryNo<8;tryNo++){
              const goal=this.randomRoomPoint();
              if(this.canStand(goal.x,goal.y)){npc.goal=goal;npc.pose='shadow';break;}
            }
          }
          npc.actor.animate('rest',dt);
        }else{
          const step=Math.min(dist,27*dt),dx=npc.goal.x-body.x,dy=npc.goal.y-body.y;
          const nx=body.x+dx/dist*step,ny=body.y+dy/dist*step;
          const clear=this.canStand(nx,ny)&&
            this.students.every(other=>other===npc||
              Math.abs(other.actor.body.x-nx)>16||Math.abs(other.actor.body.y-ny)>11)&&
            Math.hypot(this.coach.body.x-nx,this.coach.body.y-ny)>16;
          if(clear){npc.actor.face(dx,dy);npc.actor.place(nx,ny);npc.actor.animate('walk',dt);}
          else{npc.goal={x:body.x,y:body.y};npc.pause=1;}
        }
      }
      npc.chat.setPosition(npc.actor.body.x,npc.actor.body.y-43);
      npc.hit.setPosition(npc.actor.body.x,npc.actor.body.y-20);
      npc.indicator.setPosition(npc.actor.body.x,npc.actor.body.y-39)
        .setVisible(this.canCoach(npc.id));
    }
  }
}
