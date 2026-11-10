import Phaser from 'phaser';
import {GymCharacter} from './characters';
import {DEFAULT_COACH,normalizeCoachAppearance} from './coachStyle';
import {attendingIndices,STUDENT_NAMES} from './gymProgression';
import {GymNavigation,type Point} from './navigation';
import {ROOMS,normalizeRoom,roomTransition,studentRoom,unlockedRooms,type RoomId} from './gymRooms';
import {normalizeRoomState,itemRoom,type RoomState} from './roomState';
import {canFitRoomItem,canWalkInRoom,firstOpenSpot,footprint,itemLabel,type RoomFixture} from './roomItems';
import {makeRoomFixture,paintRoomFixture} from './roomArt';

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
  [key:string]:unknown;
};
type RoomStudent={actor:GymCharacter;id:number;goal:Point;pause:number;chat:Phaser.GameObjects.Text};
const TRASH_POSITIONS:Point[]=[
  {x:98,y:125},{x:174,y:184},{x:259,y:137},
  {x:343,y:187},{x:123,y:185},{x:348,y:135}
];
const MOP_POSITIONS:Point[]=[{x:109,y:145},{x:237,y:190},{x:350,y:147}];
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
  private displayItems:RoomFixture[]=[];
  private inventoryPanel:Phaser.GameObjects.Container|null=null;
  constructor(){super('GymRoom');}

  create(data?:{room?:RoomId}):void {
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
    this.cleanNodes=[];this.displayItems=[];this.inventoryPanel=null;
    this.drawEnvironment();
    const room=ROOMS.find(r=>r.id===this.current)!;
    const savedPosition=this.roomState.playerPositions[this.current]||room.entry;
    const safe=this.canStand(savedPosition.x,savedPosition.y)?savedPosition:room.entry;
    this.coach=new GymCharacter(this,safe.x,safe.y,normalizeCoachAppearance(this.save.coachAppearance||DEFAULT_COACH));
    this.coach.body.setDepth(15);
    this.ghost=this.add.graphics().setDepth(42);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,ESC,M,ENTER,Q,X') as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-ESC',()=>{if(this.movingItem)this.cancelMove();else if(this.inventoryPanel)this.closeInventory();else this.goTo('main');});
    this.input.keyboard!.on('keydown-M',()=>this.openInventory());
    this.input.keyboard!.on('keydown-Q',()=>this.rotateItem());
    this.input.keyboard!.on('keydown-X',()=>this.storeSelected());
    this.input.keyboard!.on('keydown-ENTER',()=>{if(this.movingItem)this.placeAt(this.coach.body.x+34,this.coach.body.y);});
    this.input.keyboard!.on('keydown-E',()=>this.interactNearby());
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer,targets:Phaser.GameObjects.GameObject[])=>{
      if(targets.length||this.inventoryPanel)return;
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
    this.drawTrash();
    this.drawMop();
    this.drawStudents();
    this.addExits();
    this.addControls();
    this.navigation.rebuild();
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
  private drawEnvironment():void {
    const c=this.current==='outdoor'
      ?{wall:0x86b2a6,floor:0x829976,mat:0x527869,edge:0xa9bea3}
      :this.current==='upstairs'
        ?{wall:0x637782,floor:0xa38b70,mat:0x44737d,edge:0xb1c9c3}
        :{wall:0x67656a,floor:0x857c70,mat:0x435b61,edge:0xb1aaa0};
    const g=this.add.graphics();
    const rect=(color:number,x:number,y:number,w:number,h:number)=>g.fillStyle(color).fillRect(x,y,w,h);
    rect(0x172e33,0,0,480,330);
    rect(c.wall,0,23,480,54);
    rect(c.floor,0,77,480,149);
    for(let y=79;y<=225;y+=19)rect(0x243c40,y%2?0:5,y,480,1);
    if(this.current==='outdoor'){
      rect(0x9fd0cc,0,25,480,49);
      rect(0xd5e8d2,0,62,480,15);
      for(let x=8;x<475;x+=35){
        rect(0x345c53,x,45,4,30);rect(0x2c5148,x,50,28,3);
        g.fillStyle(0x59846b).fillCircle(x+13,36,17);
        g.fillStyle(0x78a080).fillCircle(x+6,37,9);
      }
      for(const x of [25,442]){
        rect(0x3b5453,x,78,12,146);
        for(let y=90;y<220;y+=12)rect(0x89b9aa,x+2,y,8,2);
      }
    }else if(this.current==='upstairs'){
      for(const x of [60,208,355]){
        rect(0x2d4d55,x,29,72,40);rect(0x9cc6c8,x+4,33,64,31);
        rect(0xe2e5d3,x+34,33,2,31);
      }
      rect(0xd3bc8e,15,52,29,15);rect(0x2e575a,20,57,19,7);
    }else{
      for(let y=25;y<75;y+=11)for(let x=0;x<480;x+=39){
        rect(0x45474c,x+(y%3)*7,y,36,2);
      }
      for(const x of [69,348]){rect(0x394c51,x,37,51,35);rect(0x6c8b8f,x+4,42,43,26);}
      for(let x=22;x<=430;x+=82){rect(0x46545b,x,82,40,21);rect(0x6f8790,x+3,86,34,13);}
    }
    rect(0x263c41,24,86,431,132);
    rect(c.edge,28,89,424,126);
    rect(c.mat,31,92,418,120);
    for(let y=93;y<212;y+=19)for(let x=32;x<450;x+=25){
      rect((x+y)%3?c.mat:0x416a69,x,y,24,18);
      rect(0xd5e1d0,x+2,y+2,20,1);
    }
    for(const x of [31,449])rect(c.edge,x,91,2,124);
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
        result.push({kind:'furniture',index:i,x:item.x,y:item.y,rotation:item.rotation});
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
      result.push({kind:'decor',index:i,x:pos.x,y:pos.y,rotation:0});
    });
    return result;
  }
  private drawFixtures():void {
    this.displayItems=this.createItemList();
    for(const item of this.displayItems){
      makeRoomFixture(this,item,()=>this.moveItem(item));
    }
  }
  private canStand(x:number,y:number):boolean {
    return canWalkInRoom({x,y},this.displayItems);
  }
  private walkTo(point:Point):void {
    if(this.movingItem)return;
    const target=this.navigation.recover(point);
    this.path=this.navigation.route(this.coach.body,target);
  }
  private addExits():void {
    const room=ROOMS.find(r=>r.id===this.current)!;
    for(const [destination,exit] of Object.entries(room.exits)){
      if(!exit||!unlockedRooms(this.level).some(r=>r.id===destination))continue;
      const target=destination as RoomId;
      const marker=this.add.container(exit.x,exit.y).setDepth(20);
      const plate=this.add.rectangle(0,0,65,25,0x294d52).setStrokeStyle(2,0xddbc8a);
      const text=this.add.text(0,0,target==='main'?'MAIN GYM':target.toUpperCase(),
        {fontFamily:'Arial',fontSize:'9px',color:'#f9e8cb'}).setOrigin(.5);
      marker.add([plate,text]).setSize(65,25).setInteractive({useHandCursor:true});
      marker.on('pointerdown',()=>this.goTo(target));
    }
  }
  private addControls():void {
    this.control(16,282,135,'INVENTORY  [M]',()=>this.openInventory());
    this.control(171,282,137,'CLEAN / MOP',()=>this.beginMop());
    this.control(326,282,137,'MAIN GYM',()=>this.goTo('main'));
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
  private goTo(destination:RoomId):void {
    if(!roomTransition(this.current,destination,this.level))return;
    this.roomState.playerPositions[this.current]={
      x:this.coach.body.x,y:this.coach.body.y
    };
    this.roomState.currentRoom=destination;
    if(destination==='main')this.roomState.playerPositions.main=
      roomTransition(this.current,destination,this.level)!.entry;
    this.writeSave();
    if(destination==='main')this.scene.start('Gym');
    else this.scene.restart({room:destination});
  }
  private inventoryOptions():RoomFixture[] {
    const items:RoomFixture[]=[];
    (this.save.furniture||[]).forEach((item,i)=>items.push({
      kind:'furniture',index:i,x:item.x,y:item.y,rotation:item.rotation
    }));
    (this.save.ownedGear||[]).forEach((owned,i)=>{
      if(!owned)return;
      const p=this.save.gearPositions?.[i]||{x:180,y:150};
      items.push({kind:'gear',index:i,x:p.x,y:p.y,rotation:0});
    });
    (this.save.decorPositions||[]).forEach((p,i)=>{
      if(i>=(this.save.decorLevel||0))return;
      items.push({kind:'decor',index:i,x:p.x,y:p.y,rotation:0});
    });
    return items;
  }
  private openInventory():void {
    if(this.movingItem||this.inventoryPanel)return;
    this.path=[];
    const panel=this.add.container(0,0).setDepth(65);
    this.inventoryPanel=panel;
    panel.add(this.add.rectangle(240,137,432,182,0x243e44).setStrokeStyle(2,0xb9a379)
      .setInteractive());
    panel.add(this.add.text(37,54,'BUILD / MOVE INVENTORY',{
      fontFamily:'Arial',fontSize:'13px',color:'#ffe1a0'
    }));
    const options=this.inventoryOptions();
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
    if(options.length>10)panel.add(this.add.text(41,215,'More gear is available on the next gym visit.',{
      fontFamily:'Arial',fontSize:'9px',color:'#e5cca7'
    }));
    const close=this.add.text(424,54,'CLOSE', {fontFamily:'Arial',fontSize:'10px',
      color:'#ffffff',backgroundColor:'#684e47',padding:{x:5,y:5}}).setOrigin(1,0)
      .setInteractive({useHandCursor:true});
    close.on('pointerdown',()=>this.closeInventory());
    panel.add(close);
  }
  private closeInventory():void {this.inventoryPanel?.destroy();this.inventoryPanel=null;}
  private moveItem(item:RoomFixture):void {
    if(this.inventoryPanel)return;
    this.movingItem={...item};
    this.path=[];
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
    this.writeSave();
    this.scene.restart({room:this.current});
  }
  private storeSelected():void {
    if(!this.movingItem)return;
    const item=this.movingItem;
    if(item.kind==='gear'){this.save.gearStored??=[];this.save.gearStored[item.index]=true;}
    else if(item.kind==='furniture'){
      const furniture=this.save.furniture?.[item.index];if(!furniture)return;
      furniture.stored=true;
    }else{this.save.decorStored??=[];this.save.decorStored[item.index]=true;}
    this.writeSave();this.scene.restart({room:this.current});
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
    const left=this.roomState.trashByRoom[this.current]||[];
    for(const id of left){
      const p=TRASH_POSITIONS[id];if(!p)continue;
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
    const p=TRASH_POSITIONS[index];if(!p)return;
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
    this.writeSave();this.scene.restart({room:this.current});
  }
  private drawMop():void {
    const mop=this.add.container(411,185).setDepth(14);
    const art=this.add.graphics();
    art.fillStyle(0x2a4347).fillEllipse(0,3,30,7);
    art.fillStyle(0x7694a0).fillRect(-7,-9,14,13);
    art.fillStyle(0xb6c9c7).fillRect(-8,-8,16,2);
    art.lineStyle(3,0xd1ad75).lineBetween(8,-31,11,-5);
    art.fillStyle(0x97b2a8).fillRect(5,-6,13,4);
    const hit=this.add.zone(0,-10,36,37).setInteractive({useHandCursor:true});
    hit.on('pointerdown',()=>this.beginMop());
    mop.add([art,hit]);
    const done=this.roomState.moppedByRoom[this.current]||[];
    for(const [id,p] of MOP_POSITIONS.entries()){
      if(done.includes(id))continue;
      const spot=this.add.circle(p.x,p.y,7,0x80bed1,.35)
        .setStrokeStyle(1,0xbde6e1).setDepth(8).setInteractive({useHandCursor:true});
      spot.on('pointerdown',()=>this.goMop(id));
    }
  }
  private beginMop():void {
    if((this.roomState.moppedByRoom[this.current]||[]).length>=MOP_POSITIONS.length){
      this.notice('This room has already been mopped today.');return;
    }
    if((this.save.supplies?.[3]||0)<1){
      this.notice('Buy sanitizing supplies at the main gym storage closet first.');return;
    }
    const remaining=MOP_POSITIONS.findIndex((_,i)=>!this.roomState.moppedByRoom[this.current]?.includes(i));
    if(remaining>=0)this.goMop(remaining);
  }
  private goMop(index:number):void {
    if((this.save.supplies?.[3]||0)<1){this.notice('No sanitizer. Restock at reception.');return;}
    const p=MOP_POSITIONS[index];if(!p)return;
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
    if(next.length===MOP_POSITIONS.length){
      this.save.supplies![3]--;
      this.save.reputation=(this.save.reputation||0)+1;
    }
    this.writeSave();this.scene.restart({room:this.current});
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
      const point={x:130+(seed%3)*88,y:145+Math.floor(seed/3)*36};
      const spawn=this.navigation.recover(point);
      const actor=new GymCharacter(this,spawn.x,spawn.y,1+(id%4));
      const chat=this.add.text(spawn.x,spawn.y-43,'',{fontFamily:'Arial',fontSize:'9px',color:'#233d42',
        backgroundColor:'#f8ebd6',padding:{x:5,y:2}}).setOrigin(.5,1).setVisible(false).setDepth(34);
      const npc:RoomStudent={id,actor,goal:{...spawn},pause:seed*.7+1,chat};
      actor.body.setSize(28,40).setInteractive(new Phaser.Geom.Rectangle(-14,-39,28,40),Phaser.Geom.Rectangle.Contains);
      actor.body.on('pointerdown',()=>this.talkTo(npc));
      this.students.push(npc);
    }
  }
  private talkTo(npc:RoomStudent):void {
    const lines=['Ready for training!','Working on my technique.','Nice gym, coach.','One more round!'];
    npc.chat.setText(STUDENT_NAMES[npc.id]+': '+lines[(npc.id+(this.save.day||1))%lines.length])
      .setPosition(npc.actor.body.x,npc.actor.body.y-43).setVisible(true);
    this.time.delayedCall(2200,()=>npc.chat?.setVisible(false));
    npc.pause=2.5;npc.actor.animate('talk',0.1);
  }
  private interactNearby():void {
    if(this.movingItem){this.placeAt(this.coach.body.x+34,this.coach.body.y);return;}
    for(const [destination,point] of Object.entries(ROOMS.find(r=>r.id===this.current)!.exits)){
      if(point&&Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,point.x,point.y)<42){
        this.goTo(destination as RoomId);return;
      }
    }
    const nearest=(this.roomState.trashByRoom[this.current]||[]).find(i=>{
      const p=TRASH_POSITIONS[i];
      return p&&Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,p.x,p.y)<28;
    });
    if(nearest!==undefined){this.cleanTrash(nearest);return;}
    if(Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,411,185)<40){
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
        this.path=[];
        const len=Math.hypot(x,y);
        const nx=this.coach.body.x+x/len*WALK_SPEED*dt;
        const ny=this.coach.body.y+y/len*WALK_SPEED*dt;
        if(this.canStand(nx,this.coach.body.y))this.coach.body.x=nx;
        if(this.canStand(this.coach.body.x,ny))this.coach.body.y=ny;
        this.coach.face(x,y);this.coach.animate('walk',dt);
      }else if(this.path.length){
        const p=this.path[0],dx=p.x-this.coach.body.x,dy=p.y-this.coach.body.y;
        const d=Math.hypot(dx,dy),speed=Math.min(WALK_SPEED*dt,d);
        if(d<3)this.path.shift();
        else{
          const nx=this.coach.body.x+dx/d*speed,ny=this.coach.body.y+dy/d*speed;
          if(this.canStand(nx,ny)){this.coach.body.setPosition(nx,ny);
            this.coach.face(dx,dy);this.coach.animate('walk',dt);}
          else this.path=[];
        }
      }else this.coach.animate('idle',dt);
    }
    if(this.movingItem||this.inventoryPanel)this.coach.animate('idle',dt);
    this.coach.place(this.coach.body.x,this.coach.body.y);
    if(this.targetTrash!==null){
      const p=TRASH_POSITIONS[this.targetTrash];
      if(p&&Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,p.x,p.y)<27){
        this.cleanTrash(this.targetTrash);return;
      }
    }
    if(this.targetMop!==null){
      const p=MOP_POSITIONS[this.targetMop];
      if(p&&Phaser.Math.Distance.Between(this.coach.body.x,this.coach.body.y,p.x,p.y)<19){
        this.mopSpot(this.targetMop);return;
      }
    }
    if(this.inventoryPanel||this.movingItem)return;
    for(const npc of this.students){
      if(npc.pause>0){npc.pause-=dt;npc.actor.animate('stretch',dt);}
      else{
        const body=npc.actor.body;
        const dist=Phaser.Math.Distance.Between(body.x,body.y,npc.goal.x,npc.goal.y);
        if(dist<3){npc.pause=2+Math.random()*5;npc.goal={...body};npc.actor.animate('rest',dt);}
        else{
          const step=Math.min(dist,27*dt),dx=npc.goal.x-body.x,dy=npc.goal.y-body.y;
          const nx=body.x+dx/dist*step,ny=body.y+dy/dist*step;
          if(this.canStand(nx,ny)){npc.actor.face(dx,dy);npc.actor.place(nx,ny);npc.actor.animate('walk',dt);}
          else npc.pause=.3;
        }
        if(npc.pause<=0&&dist<3){
          for(let tryNo=0;tryNo<6;tryNo++){
            const goal={x:80+Math.random()*320,y:122+Math.random()*77};
            if(this.canStand(goal.x,goal.y)){npc.goal=goal;break;}
          }
        }
      }
      npc.chat.setPosition(npc.actor.body.x,npc.actor.body.y-43);
    }
  }
}
