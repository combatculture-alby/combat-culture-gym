import Phaser from 'phaser';
import {ROOMS,unlockedRooms,normalizeRoom,type RoomId} from './gymRooms';
import {normalizeRoomState,itemRoom} from './roomState';

const KEY=import.meta.env.VITE_GARAGE_PREVIEW==='1'
  ?'combat-culture-gym-garage-preview-v1'
  :import.meta.env.VITE_ISOLATE_SAVE==='1'
    ?'combat-culture-gym-living-preview-v1':'combat-culture-gym-v1';

/** A lightweight secondary hub scene. The existing classes and arcade scenes
 * stay untouched. This scene renders only the room currently visited.
 */
export class GymRoomScene extends Phaser.Scene {
  private current:RoomId='main';
  private level=1;
  private player!:Phaser.GameObjects.Container;
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private exits:Phaser.GameObjects.Container[]=[];
  private roomItems:Phaser.GameObjects.Container[]=[];
  constructor(){super('GymRoom');}
  create(data?:{room?:RoomId}):void {
    let raw:Record<string,unknown>={};
    try{raw=JSON.parse(localStorage.getItem(KEY)||'{}') as Record<string,unknown>;}catch{/* fresh save */}
    this.level=Number(raw.gymLevel)||1;
    const state=normalizeRoomState(raw.roomState,this.level);
    this.current=normalizeRoom(data?.room??state.currentRoom,this.level);
    if(this.current==='main'){this.scene.start('Gym');return;}
    state.currentRoom=this.current;
    raw.roomState=state;
    try{localStorage.setItem(KEY,JSON.stringify(raw));}catch{/* storage disabled */}
    const room=ROOMS.find(r=>r.id===this.current)!;
    const palette=this.current==='outdoor'
      ?{wall:0x83a6a0,floor:0x6c9773,mat:0x426c61}
      :this.current==='upstairs'
        ?{wall:0x586b79,floor:0x947b64,mat:0x3a6570}
        :{wall:0x6c6664,floor:0x807d77,mat:0x4b6263};
    const g=this.add.graphics();
    g.fillStyle(0x152d33).fillRect(0,0,480,330);
    g.fillStyle(palette.wall).fillRect(0,23,480,56);
    g.fillStyle(palette.floor).fillRect(0,79,480,146);
    g.fillStyle(0x223d42).fillRect(22,84,436,136);
    g.fillStyle(palette.mat).fillRect(27,89,426,126);
    for(let x=27;x<453;x+=24)for(let y=89;y<215;y+=21){
      g.lineStyle(1,0xa9c2b3,.17).strokeRect(x,y,24,21);
    }
    if(this.current==='outdoor'){
      for(let x=16;x<480;x+=34){
        g.fillStyle(0x466956).fillRect(x,31,20,43);
        g.fillStyle(0x6b9873).fillCircle(x+10,34,17);
      }
    }else{
      for(const x of [63,213,365]){
        g.fillStyle(0x263d44).fillRect(x,36,62,33);
        g.fillStyle(0x95b9c1).fillRect(x+4,40,54,25);
        g.fillStyle(0xc5d6c9).fillRect(x+29,40,2,25);
      }
    }
    this.add.rectangle(0,0,480,23,0x152b30).setOrigin(0);
    this.add.text(12,11,'COMBAT CULTURE / '+room.name.toUpperCase(),{
      fontFamily:'Arial',fontSize:'11px',color:'#ffe3a9'}).setOrigin(0,.5);
    this.add.rectangle(0,226,480,104,0x152b30).setOrigin(0);
    this.add.text(240,246,'ADDITIONAL TRAINING SPACE',{
      fontFamily:'Arial',fontSize:'13px',color:'#f4ddad'}).setOrigin(.5);
    this.add.text(240,268,'Click an item to store it. Place stored items using the room inventory.',{
      fontFamily:'Arial',fontSize:'10px',color:'#c7d6cc'}).setOrigin(.5);
    const saved=state.playerPositions[this.current]||room.entry;
    this.player=this.add.container(saved.x,saved.y);
    const shadow=this.add.ellipse(0,3,19,7,0x18363c,.4);
    const body=this.add.rectangle(0,-12,14,18,0xb57a4c);
    const head=this.add.circle(0,-26,8,0xe0b78c);
    const hair=this.add.rectangle(0,-33,15,5,0x333a3b);
    this.player.add([shadow,body,head,hair]);
    this.player.setDepth(14);
    this.drawRoomInventory(raw,state);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E') as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-ESC',()=>this.goTo('main'));
    for(const [destination,exit] of Object.entries(room.exits)){
      if(!exit||!unlockedRooms(this.level).some(r=>r.id===destination))continue;
      const target=destination as RoomId;
      const marker=this.add.container(exit.x,exit.y);
      const panel=this.add.rectangle(0,0,75,25,0x264c53).setStrokeStyle(1,0xe4c68d);
      const label=this.add.text(0,0,target==='main'?'MAIN GYM':target.toUpperCase(),{
        fontFamily:'Arial',fontSize:'9px',color:'#f7e4b8'}).setOrigin(.5);
      marker.add([panel,label]).setDepth(20).setSize(75,25).setInteractive({useHandCursor:true});
      marker.on('pointerdown',()=>this.goTo(target));
      this.exits.push(marker);
    }
    this.add.text(240,314,'WASD / ARROWS TO WALK  •  CLICK EXIT TO CHANGE ROOMS',{
      fontFamily:'Arial',fontSize:'10px',color:'#b9cebf'}).setOrigin(.5);
  }
  private drawRoomInventory(raw:Record<string,unknown>,state:ReturnType<typeof normalizeRoomState>):void {
    const furniture=Array.isArray(raw.furniture)?raw.furniture as Array<{kind:number;x:number;y:number;rotation:number;stored:boolean}>:[];
    const gearNames=['Heavy Bag','Thai Pads','Speed Bag','Jump Rope','Weight Bench','Kettlebells','Treadmill','Assault Bike'];
    const gearPositions=Array.isArray(raw.gearPositions)?raw.gearPositions as Array<{x:number;y:number}>:[];
    const gearOwned=Array.isArray(raw.ownedGear)?raw.ownedGear as boolean[]:[];
    const gearStored=Array.isArray(raw.gearStored)?raw.gearStored as boolean[]:[];
    const furnitureNames=['Lamp','Bench','Trophy Case','Water Cooler','Punching Dummy'];
    const placeable:Array<{label:string;kind:'furniture'|'gear';index:number;x:number;y:number;stored:boolean}>=[];
    furniture.forEach((item,index)=>{
      if(itemRoom(state.furnitureRooms,index,this.level)===this.current)
        placeable.push({label:furnitureNames[item.kind]||'Furniture',kind:'furniture',index,x:item.x,y:item.y,stored:item.stored});
      else if(item.stored)placeable.push({label:furnitureNames[item.kind]||'Furniture',kind:'furniture',index,x:0,y:0,stored:true});
    });
    gearOwned.forEach((owned,index)=>{
      if(!owned)return;
      const room=itemRoom(state.gearRooms,index,this.level);
      if(room!==this.current&&!gearStored[index])return;
      const pos=gearPositions[index]||{x:160,y:140};
      placeable.push({label:gearNames[index]||'Gear',kind:'gear',index,x:pos.x,y:pos.y,stored:!!gearStored[index]});
    });
    const placed=placeable.filter(item=>!item.stored);
    for(const item of placed){
      const g=this.add.container(item.x,item.y);
      const isGear=item.kind==='gear';
      const shadow=this.add.ellipse(0,3,isGear?31:38,9,0x172f35,.5);
      const body=this.add.rectangle(0,-9,isGear?20:30,isGear?24:17,isGear?0x9d594b:0x9b805e).setStrokeStyle(2,0xd1b88c);
      const label=this.add.text(0,-29,item.label.toUpperCase(),{fontFamily:'Arial',fontSize:'8px',color:'#f4dfb5',backgroundColor:'#28464b'}).setOrigin(.5);
      g.add([shadow,body,label]).setDepth(11+item.y/100).setSize(42,40).setInteractive({useHandCursor:true});
      g.on('pointerdown',()=>this.storeRoomItem(item));
      this.roomItems.push(g);
    }
    const available=placeable.filter(item=>item.stored);
    const inventory=this.add.text(240,291,'ROOM INVENTORY ('+available.length+' STORED)',{
      fontFamily:'Arial',fontSize:'10px',color:'#ffe0a2',backgroundColor:'#31525b',
      padding:{x:8,y:4}}).setOrigin(.5).setInteractive({useHandCursor:true}).setDepth(31);
    inventory.on('pointerdown',()=>{
      if(!available.length){this.add.text(240,213,'No stored equipment. Buy items at the main desk.',{fontFamily:'Arial',fontSize:'10px',color:'#ffe0a2'}).setOrigin(.5).setDepth(31);return;}
      const chosen=available[0];
      const spots=[{x:90,y:145},{x:150,y:145},{x:210,y:145},{x:270,y:145},{x:330,y:145},{x:390,y:145},{x:90,y:190},{x:150,y:190},{x:210,y:190},{x:270,y:190},{x:330,y:190},{x:390,y:190}];
      const occupied=placed.map(item=>({x:item.x,y:item.y}));
      const spot=spots.find(p=>occupied.every(o=>Math.abs(p.x-o.x)>=52||Math.abs(p.y-o.y)>=34));
      if(!spot)return;
      this.saveRoomItem(chosen,false,spot);
    });
  }
  private storeRoomItem(item:{kind:'furniture'|'gear';index:number}):void {
    this.saveRoomItem(item,true);
  }
  private saveRoomItem(item:{kind:'furniture'|'gear';index:number},stored:boolean,position?:{x:number;y:number}):void {
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||'{}') as Record<string,unknown>;
      const state=normalizeRoomState(raw.roomState,this.level);
      if(item.kind==='furniture'){
        const furniture=raw.furniture as Array<{x:number;y:number;stored:boolean}>;
        if(!furniture?.[item.index])return;
        furniture[item.index].stored=stored;
        if(position)Object.assign(furniture[item.index],position);
        state.furnitureRooms[item.index]=this.current;
      }else{
        const gearStored=raw.gearStored as boolean[];
        const positions=raw.gearPositions as Array<{x:number;y:number}>;
        if(!gearStored||!positions)return;
        gearStored[item.index]=stored;
        if(position)positions[item.index]=position;
        state.gearRooms[item.index]=this.current;
      }
      raw.roomState=state;
      localStorage.setItem(KEY,JSON.stringify(raw));
      this.scene.restart({room:this.current});
    }catch{/* storage unavailable */}
  }
  private goTo(destination:RoomId):void {
    if(!unlockedRooms(this.level).some(r=>r.id===destination))return;
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||'{}') as Record<string,unknown>;
      const state=normalizeRoomState(raw.roomState,this.level);
      state.playerPositions[this.current]={x:this.player.x,y:this.player.y};
      state.currentRoom=destination;
      raw.roomState=state;
      localStorage.setItem(KEY,JSON.stringify(raw));
    }catch{/* storage unavailable */}
    if(destination==='main')this.scene.start('Gym');
    else this.scene.restart({room:destination});
  }
  update(_time:number,delta:number):void {
    if(!this.player)return;
    const dt=Math.min(delta,50)/1000;
    const horizontal=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown);
    const vertical=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
    const length=Math.hypot(horizontal,vertical)||1;
    this.player.x=Phaser.Math.Clamp(this.player.x+horizontal/length*100*dt,32,448);
    this.player.y=Phaser.Math.Clamp(this.player.y+vertical/length*100*dt,102,211);
    this.player.setDepth(10+this.player.y/100);
    if(Phaser.Input.Keyboard.JustDown(this.keys.E)){
      const room=ROOMS.find(r=>r.id===this.current)!;
      for(const [destination,point] of Object.entries(room.exits)){
        if(point&&Phaser.Math.Distance.Between(this.player.x,this.player.y,point.x,point.y)<42){
          this.goTo(destination as RoomId);break;
        }
      }
    }
  }
}
