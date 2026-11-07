import Phaser from 'phaser';

const W = 480, H = 270, CELL = 12;
const UI_FONT = 'Arial, Helvetica, sans-serif';
type Point = { x: number; y: number };
type Student = { name: string; x: number; y: number; color: number; friendship: number; skill: number; body?: Phaser.GameObjects.Container; indicator?: Phaser.GameObjects.Text };
type Furniture = { kind: number; x: number; y: number; rotation: number; stored: boolean };
const FURNITURE = [{name:'Floor Lamp',price:35,rep:0},{name:'Bench',price:60,rep:3},{name:'Trophy Case',price:90,rep:8},{name:'Water Cooler',price:45,rep:0},{name:'Punching Dummy',price:120,rep:12}];
type Save = { version: 1; day: number; money: number; reputation: number; completed: boolean; friendships: number[]; skills: number[]; equipment?: number; classesTaught?: number; classType?: number; lastTalkDays?: number[]; decorLevel?: number; lifetimeEarnings?: number; decorPositions?: Point[]; furniture?: Furniture[] };
const SAVE_KEY = 'combat-culture-gym-v1';
const blocks = [{ x: 368, y: 62, w: 38, h: 80 }, { x: 346, y: 180, w: 92, h: 34 }];
const walkable = (x: number, y: number) => x >= 15 && x <= 465 && y >= 32 && y <= 215 &&
  !blocks.some(b => x + 9 > b.x && x - 9 < b.x + b.w && y + 8 > b.y && y - 8 < b.y + b.h);
const defaults: Save = { version: 1, day: 1, money: 100, reputation: 0, completed: false, friendships: [0,0,0,0], skills: [0,0,0,0], equipment: 0, classesTaught: 0, classType: 0, lastTalkDays: [0,0,0,0], decorLevel: 0, lifetimeEarnings: 0, decorPositions: [{x:148,y:48},{x:240,y:48},{x:302,y:184}], furniture: [] };
function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...defaults, friendships: [...defaults.friendships], skills: [...defaults.skills] };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') throw Error('invalid');
    const s = data as Partial<Save>;
    if (s.version !== 1 || !Number.isInteger(s.day) || (s.day ?? 0) < 1 ||
      !Number.isFinite(s.money) || !Number.isFinite(s.reputation) || typeof s.completed !== 'boolean' ||
      !Array.isArray(s.friendships) || !Array.isArray(s.skills) ||
      s.friendships.length !== 4 || s.skills.length !== 4 ||
      !s.friendships.every(n => Number.isInteger(n) && n >= 0) ||
      !s.skills.every(n => Number.isInteger(n) && n >= 0)) throw Error('invalid');
    return {...s, equipment: Math.max(0,Math.min(3,Math.floor(Number(s.equipment)||0))), classesTaught: Math.max(0,Math.floor(Number(s.classesTaught)||0)), classType: Math.max(0,Math.min(2,Math.floor(Number(s.classType)||0))), lastTalkDays: Array.from({length:4},(_,i)=>Math.max(0,Math.floor(Number(s.lastTalkDays?.[i])||0))), decorLevel: Math.max(0,Math.min(3,Math.floor(Number(s.decorLevel)||0))), furniture: Array.isArray(s.furniture) ? s.furniture.filter((v:unknown)=>{ const f=v as Partial<Furniture>; return !!f && Number.isInteger(f.kind) && f.kind!>=0 && f.kind!<FURNITURE.length && Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isInteger(f.rotation) && typeof f.stored==='boolean'; }).slice(0,40).map((v:Furniture)=>({...v,x:Math.max(60,Math.min(290,v.x)),y:Math.max(70,Math.min(192,v.y)),rotation:((v.rotation%4)+4)%4})) : [], decorPositions: Array.from({length:3},(_,i)=>{ const fallback=defaults.decorPositions![i]; const p=s.decorPositions?.[i]; return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x>=45 && p.x<=308 && p.y>=45 && p.y<=195 ? {x:Math.round(p.x),y:Math.round(p.y)} : {...fallback}; }), lifetimeEarnings: Math.max(0,Math.floor(Number(s.lifetimeEarnings)||0))} as Save;
  } catch { return { ...defaults, friendships: [...defaults.friendships], skills: [...defaults.skills] }; }
}

class GymScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
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
  private requestAge: Record<number,number> = {};
  private pendingRequests: number[] = [];
  private nextRequestAt = 0;
  private tasks: Record<number,string> = {};
  private feedback!: Phaser.GameObjects.Text;
  private equipmentLabel!: Phaser.GameObjects.Text;
  private walkingClock = 0;
  private decor!: Phaser.GameObjects.Graphics;
  private studentCard!: Phaser.GameObjects.Text;
  private rosterPanel!: Phaser.GameObjects.Container;
  private rosterText!: Phaser.GameObjects.Text;
  private shopLabel!: Phaser.GameObjects.Text;
  private modeLabel!: Phaser.GameObjects.Text;
  private classOverlay!: Phaser.GameObjects.Graphics;
  private placingDecor = -1;
  private selectedFurniture = -1;
  private furniturePanel!: Phaser.GameObjects.Container;
  private rotateControl!: Phaser.GameObjects.Container;
  private storeControl!: Phaser.GameObjects.Container;
  private furnitureMode: 'shop'|'inventory'|'build' = 'shop';
  private buildButtonText!: Phaser.GameObjects.Text;
  private buildHint!: Phaser.GameObjects.Text;
  private readonly classNames=['Beginner Boxing','Muay Thai Fundamentals','Conditioning'];
  private targetStudent: Student | null = null;
  private status!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private students: Student[] = [
    { name:'Frank', x:90, y:90, color:0xd9a06c, friendship:0, skill:0 },
    { name:'Radish', x:245, y:104, color:0x8cbaaa, friendship:0, skill:0 },
    { name:'Marshall', x:105, y:183, color:0xaaa4d5, friendship:0, skill:0 },
    { name:'Pudge', x:275, y:183, color:0xe2bd77, friendship:0, skill:0 },
  ];
  constructor() { super('Gym'); }
  create(): void {
    this.students.forEach((s,i) => { s.friendship = this.saveData.friendships[i]; s.skill = this.saveData.skills[i]; });
    const g = this.add.graphics();
    g.fillStyle(0xc9ae86).fillRect(0,0,W,H);
    g.fillStyle(0x426f70).fillRect(32,32,286,178);
    g.lineStyle(1,0x639596,0.7);
    for(let x=32;x<=318;x+=32) g.lineBetween(x,32,x,210);
    for(let y=32;y<=210;y+=32) g.lineBetween(32,y,318,y);
    g.fillStyle(0x963d35).fillRoundedRect(368,62,38,80,10);
    g.fillStyle(0x342e2d).fillRect(367,57,40,6);
    g.fillStyle(0xe0bc83).fillRect(367,140,40,4);
    g.fillStyle(0x735a3d).fillRect(33,30,285,4);
    g.fillStyle(0x254b4b).fillRoundedRect(341,148,106,25,4);
    g.lineStyle(2,0xe5c58c).strokeRoundedRect(341,148,106,25,4);
    g.fillStyle(0x765337).fillRect(346,180,92,34);
    g.fillStyle(0x3b332d).fillRect(0,0,W,14);
    this.add.text(12,235,'COMBAT CULTURE GYM | Prototype 6.0',{fontFamily:UI_FONT,fontSize:'11px',color:'#29383b'});
    this.decor=this.add.graphics().setDepth(1);
    this.classOverlay=this.add.graphics().setDepth(2);
    this.modeLabel=this.add.text(12,17,'GYM HUB',{fontFamily:UI_FONT,fontSize:'11px',fontStyle:'bold',color:'#f6e8c8',backgroundColor:'#294f52',padding:{x:5,y:3}}).setDepth(12);
    this.shopLabel=this.add.text(344,225,'',{fontFamily:UI_FONT,fontSize:'9px',color:'#29383b'});
    this.equipmentLabel=this.add.text(344,119,'EQUIPMENT',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'});
    this.add.text(344,217,'RECEPTION',{fontFamily:UI_FONT,fontSize:'11px',color:'#493e33'});
    // Pixel-inspired owner: black hair, red headband, dark hoodie and Muay Thai shorts.
    this.player = this.makeCharacter(170,150,0x26292e,0xe6b28e,0x18191e,0xb8242c,true);
    for(const s of this.students) {
      const skin = [0xc68c66,0xe5b08e,0x9c674c,0xe0bc91][this.students.indexOf(s)];
      const hair = [0x29252a,0x503329,0x171a22,0x755039][this.students.indexOf(s)];
      s.body = this.makeCharacter(s.x,s.y,s.color,skin,hair,0x354e56,false);
      this.add.text(s.x,s.y-36,s.name,{fontFamily:UI_FONT,fontSize:'11px',color:'#ffffff',backgroundColor:'#203d40'}).setOrigin(0.5);
      s.indicator = this.add.text(s.x,s.y-55,'!',{fontFamily:UI_FONT,fontSize:'16px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#a53d34',padding:{x:5,y:1}}).setOrigin(0.5).setVisible(false).setDepth(4);
    }
    this.status = this.add.text(340,17,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:4}}).setDepth(10);
    this.studentCard=this.add.text(12,16,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:3}}).setDepth(10).setVisible(false);
    this.message = this.add.text(12,220,'Welcome to the gym!',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:3},wordWrap:{width:295}}).setDepth(10);
    this.timer = this.add.text(12,207,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#29383b'});
    this.feedback = this.add.text(165,197,'',{fontFamily:UI_FONT,fontSize:'10px',fontStyle:'bold',color:'#fff5dc',backgroundColor:'#294f52',padding:{x:4,y:2}}).setOrigin(0.5).setDepth(10).setVisible(false);
    this.buildHint=this.add.text(12,250,'Build mode: click BUILD to arrange your decorations',{fontFamily:UI_FONT,fontSize:'9px',color:'#29383b'});
    this.add.text(12,260,'MOVE: WASD / ARROWS  |  CLICK: WALK / TALK',{fontFamily:UI_FONT,fontSize:'9px',color:'#29383b'});
    this.addButton(340,149,124,17,'BUY GYM GEAR',() => this.upgradeEquipment());
    this.addButton(340,169,124,17,'CHANGE CLASS',() => this.changeClass());
    this.addButton(340,189,124,17,'START CLASS',() => this.startClass());
    this.addButton(340,209,124,17,'CLOSE GYM',() => this.nextDay());
    this.addButton(340,245,60,16,'DECOR',() => this.buyDecor());
    this.addButton(404,245,60,16,'ROSTER',() => this.toggleRoster());
    this.buildButtonText=this.addButton(404,265,60,16,'BUILD',() => this.openFurniture('build'));
    this.buildButtonText.setDepth(40);
    this.addButton(340,265,60,16,'SHOP',() => this.openFurniture('shop'));
    this.addButton(340,285,60,17,'PAD WORK',()=>this.openArcade('Rhythm'));
    this.addButton(404,285,60,17,'COACH SAYS',()=>this.openArcade('Memory'));
    this.add.text(342,302,'ARCADE: TRAIN FOR BONUSES',{fontFamily:UI_FONT,fontSize:'9px',color:'#29383b'});
    this.addButton(340,103,124,17,'INVENTORY',() => this.openFurniture('inventory'));
    const panelBack=this.add.rectangle(34,38,294,162,0x203d40).setOrigin(0).setStrokeStyle(2,0xd4b783);
    this.rosterText=this.add.text(44,48,'',{fontFamily:UI_FONT,fontSize:'11px',color:'#ffffff',lineSpacing:5});
    this.rosterPanel=this.add.container(0,0,[panelBack,this.rosterText]).setDepth(30).setVisible(false);
    this.furniturePanel=this.add.container(0,0).setDepth(60).setVisible(false);
    this.rotateControl=this.makeActionControl(36,238,'ROTATE',()=>this.rotateFurniture());
    this.storeControl=this.makeActionControl(112,238,'STORE',()=>this.storeFurniture());
    this.updateFurnitureActions();
    this.refresh();
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.input.keyboard!.on('keydown-E',() => this.interact());
    this.input.keyboard!.on('keydown-C',() => this.startClass());
    this.input.keyboard!.on('keydown-P',()=>this.openArcade('Rhythm'));
    this.input.keyboard!.on('keydown-G',()=>this.openArcade('Memory'));
    this.input.keyboard!.on('keydown-N',() => this.nextDay());
    this.input.keyboard!.on('keydown-R',() => this.reset());
    this.input.keyboard!.on('keydown-T',() => this.changeClass());
    this.input.keyboard!.on('keydown-B',() => this.buyDecor());
    this.input.keyboard!.on('keydown-V',() => this.toggleRoster());
    this.input.keyboard!.on('keydown-M',() => this.openFurniture('build'));
    this.input.keyboard!.on('keydown-Q',() => this.rotateFurniture());
    this.input.keyboard!.on('keydown-X',() => this.storeFurniture());
    this.input.on('pointerdown',(p:Phaser.Input.Pointer) => {
      // Explicitly route HUD clicks before world placement. Phaser input can hit the scene and UI together.
      if(p.worldX>=404 && p.worldY>=249) { this.openFurniture('build'); return; }
      if(this.furniturePanel.visible) return;
      if(this.selectedFurniture>=0) { if(p.worldX<330 && p.worldY>=32 && p.worldY<=215) this.placeFurniture(p.worldX,p.worldY); return; }
      if(this.placingDecor>=0) { this.placeDecor(p.worldX,p.worldY); return; }
      if(p.worldX >= 330 || p.worldY >= 215) return;
      if(this.rosterPanel.visible) { this.rosterPanel.setVisible(false); return; }
      const student = this.students.find(s => Phaser.Math.Distance.Between(s.x,s.y,p.worldX,p.worldY) < 23);
      if(student) {
        if(Phaser.Math.Distance.Between(this.player.x,this.player.y,student.x,student.y) < 42) this.interact(student);
        else { this.targetStudent = student; this.route = this.findRoute({x:this.player.x,y:this.player.y},{x:student.x-24,y:student.y+10}); }
      } else { this.targetStudent = null; this.route = this.findRoute({x:this.player.x,y:this.player.y},{x:p.worldX,y:p.worldY}); }
    });
  }
  private makeCharacter(x:number,y:number,shirt:number,skin:number,hair:number,shorts:number,owner:boolean):Phaser.GameObjects.Container {
    const parts: Phaser.GameObjects.GameObject[] = [];
    const rect=(px:number,py:number,w:number,h:number,color:number) => {
      parts.push(this.add.rectangle(px,py,w,h,color).setStrokeStyle(1,0x283137));
    };
    parts.push(this.add.ellipse(0,14,23,6,0x193b3c,0.3));
    rect(-5,13,6,7,skin); rect(5,13,6,7,skin);
    rect(0,5,21,14,shorts);
    rect(-12,-5,6,15,skin); rect(12,-5,6,15,skin);
    rect(0,-5,21,19,shirt);
    rect(0,-21,22,19,skin);
    rect(0,-30,23,8,hair);
    rect(-8,-25,6,10,hair);
    if(owner) {
      rect(0,-27,24,4,0xc82f31);
      rect(0,-5,8,8,0xc97c36);
      rect(-6,5,5,3,0xd6b36e); rect(6,5,5,3,0xd6b36e);
    } else {
      rect(-5,-21,2,2,0x302a2a); rect(5,-21,2,2,0x302a2a);
    }
    return this.add.container(x,y,parts);
  }
  private addButton(x:number,y:number,w:number,h:number,label:string,fn:()=>void):Phaser.GameObjects.Text {
    const b=this.add.rectangle(x,y,w,h,0x294f52).setOrigin(0,1).setStrokeStyle(1,0xd5b786).setInteractive();
    const t=this.add.text(x+w/2,y-h/2,label,{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}).setOrigin(0.5).setInteractive();
    b.on('pointerdown',fn); t.on('pointerdown',fn);
    return t;
  }
  private makeActionControl(x:number,y:number,label:string,fn:()=>void):Phaser.GameObjects.Container {
    const bg=this.add.rectangle(0,0,69,18,0x294f52).setOrigin(0).setStrokeStyle(1,0xd5b786).setInteractive();
    const t=this.add.text(34,9,label,{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}).setOrigin(0.5).setInteractive();
    bg.on('pointerdown',fn);t.on('pointerdown',fn);
    return this.add.container(x,y,[bg,t]).setDepth(25);
  }
  private persist():void {
    this.saveData.friendships=this.students.map(s=>s.friendship);
    this.saveData.skills=this.students.map(s=>s.skill);
    try { localStorage.setItem(SAVE_KEY,JSON.stringify(this.saveData)); } catch { this.say('Storage unavailable. Progress will not persist.'); }
  }
  private refresh():void {
    this.status.setText(['DAY '+this.saveData.day+'   $'+this.saveData.money,'REP '+this.saveData.reputation+'   CLASSES '+(this.saveData.classesTaught||0),'EARNED $'+(this.saveData.lifetimeEarnings||0),this.saveData.completed?'CLASS DONE':'CLASS READY']);
    const level=this.saveData.equipment||0;
    this.equipmentLabel.setText('GEAR '+level+'/3 | '+(level===3?'MAXED':'$'+(40+level*35)));
    const decor=this.saveData.decorLevel||0;
    this.shopLabel.setText('DECOR '+decor+'/3 '+(decor===3?'MAX':'$'+(25+decor*25)));
    this.drawEquipment();
  }
  private drawEquipment():void {
    this.decor.clear();
    (this.saveData.furniture||[]).forEach((item,i)=>{
      if(item.stored) return;
      const x=item.x,y=item.y,side=item.rotation%2===1;
      this.decor.fillStyle([0xf3d48b,0x735b48,0xb08b56,0x7cc2cc,0x9e5148][item.kind]);
      if(item.kind===0) { // Side-view lamp: the shade and base turn with the furniture.
        const dx=[0,14,0,-14][item.rotation],dy=[-14,0,14,0][item.rotation];
        this.decor.fillStyle(0x695447).fillCircle(x,y,5);
        this.decor.fillStyle(0xf3d48b).fillRect(x-3,y-3,6,6);
        this.decor.lineStyle(4,0xf3d48b).lineBetween(x,y,x+dx,y+dy);
        this.decor.fillStyle(0xffdf84).fillCircle(x+dx,y+dy,9);
        this.decor.fillStyle(0xe6a75c).fillRect(x+dx-7,y+dy+3,14,3);
      }
      else if(item.kind===1) this.decor.fillRoundedRect(x-(side?7:20),y-(side?20:7),side?14:40,side?40:14,3);
      else if(item.kind===2) this.decor.fillRect(x-(side?9:16),y-(side?16:9),side?18:32,side?32:18);
      else if(item.kind===3) {this.decor.fillRect(x-9,y-17,18,30);this.decor.fillStyle(0xe4f7fa).fillRect(x-6,y-14,12,8);}
      else {this.decor.fillRoundedRect(x-9,y-20,18,38,6);this.decor.fillStyle(0x30353b).fillRect(x-3,y-24,6,5);}
      if(this.selectedFurniture===i) this.decor.lineStyle(2,0xffe08a).strokeRect(x-24,y-27,48,54);
    });
    const level=this.saveData.equipment||0;
    if(level>=1) {
      this.decor.fillStyle(0x8e3834).fillRoundedRect(302,63,13,38,3);
      this.decor.fillStyle(0x242a2b).fillRect(305,60,7,4);
      this.decor.lineStyle(1,0xd5b88a).lineBetween(308,53,308,60);
    }
    if(level>=2) {
      this.decor.fillStyle(0x343b40).fillRect(302,147,17,6);
      this.decor.fillStyle(0xd2ae6e).fillRect(298,143,5,14);
      this.decor.fillStyle(0xd2ae6e).fillRect(318,143,5,14);
    }
    if(level>=3) {
      this.decor.fillStyle(0x733e36).fillRect(45,43,45,5);
      this.decor.fillStyle(0xe5d1a0).fillRect(49,44,37,2);
      this.decor.fillStyle(0xd9bd80).fillRect(46,48,3,13);
      this.decor.fillStyle(0xd9bd80).fillRect(86,48,3,13);
    }
    const decor=this.saveData.decorLevel||0;
    const pos=this.saveData.decorPositions||defaults.decorPositions!;
    if(decor>=1) {
      const p=pos[0];
      this.decor.fillStyle(0xe8d4a1).fillRect(p.x-25,p.y-9,50,18);
      this.decor.fillStyle(0x943f36).fillRect(p.x-21,p.y-5,42,10);
      this.decor.fillStyle(0xf4e4c3).fillRect(p.x-17,p.y-1,34,2);
    }
    if(decor>=2) {
      const p=pos[1];
      this.decor.fillStyle(0x866142).fillRect(p.x-23,p.y-9,47,18);
      this.decor.fillStyle(0xd9bd80).fillRect(p.x-19,p.y-6,39,12);
      this.decor.fillStyle(0x476d66).fillRect(p.x-15,p.y-2,31,4);
    }
    if(decor>=3) {
      const p=pos[2];
      this.decor.fillStyle(0x355d45).fillRect(p.x-8,p.y-6,16,20);
      this.decor.fillStyle(0x4d885c).fillCircle(p.x,p.y-11,12);
      this.decor.fillStyle(0x7ca76d).fillCircle(p.x-5,p.y-14,5);
    }
    if(this.placingDecor>=0) {
      const p=pos[this.placingDecor];
      this.decor.lineStyle(2,0xffe08a).strokeRect(p.x-27,p.y-22,54,42);
    }
  }
  private openFurniture(mode:'shop'|'inventory'|'build'):void {
    if(this.running) { this.say('Finish class before using the shop.'); return; }
    this.furnitureMode=mode;
    this.furniturePanel.removeAll(true);
    const bg=this.add.rectangle(32,32,292,178,0x203d40).setOrigin(0).setStrokeStyle(2,0xd4b783);
    this.furniturePanel.add(bg);
    const heading=this.add.text(44,40,mode==='shop'?'FURNITURE SHOP':mode==='build'?'BUILD MODE':'YOUR INVENTORY',{fontFamily:UI_FONT,fontSize:'12px',fontStyle:'bold',color:'#ffffff'});
    this.furniturePanel.add(heading);
    const close=this.add.text(301,40,'X',{fontFamily:UI_FONT,fontSize:'13px',color:'#ffffff',backgroundColor:'#a34b40',padding:{x:4,y:2}}).setInteractive();
    close.on('pointerdown',()=>this.furniturePanel.setVisible(false));
    this.furniturePanel.add(close);
    if(mode==='shop') FURNITURE.forEach((item,i)=>{
      const unlocked=this.saveData.reputation>=item.rep;
      const row=this.add.text(46,67+i*25,item.name+'  $'+item.price+(unlocked?'':'  REP '+item.rep),{fontFamily:UI_FONT,fontSize:'11px',color:unlocked?'#f7e9cb':'#9eabb0',backgroundColor:'#34575b',padding:{x:5,y:3}}).setInteractive();
      row.on('pointerdown',()=>this.buyFurniture(i));
      this.furniturePanel.add(row);
    });
    else if(mode==='build') {
      const owned=this.saveData.decorLevel||0;
      for(let i=0;i<owned;i++) {
        const idx=i;
        const row=this.add.text(46,67+i*23,['Gym banner','Training poster','Indoor plant'][i]+'  MOVE',{fontFamily:UI_FONT,fontSize:'10px',color:'#f7e9cb',backgroundColor:'#34575b',padding:{x:5,y:3}}).setInteractive();
        row.on('pointerdown',()=>{this.placingDecor=idx;this.selectedFurniture=-1;this.furniturePanel.setVisible(false);this.drawEquipment();this.say('Tap a clear spot to move '+['banner','poster','plant'][idx]+'.');});
        this.furniturePanel.add(row);
      }
      const items=this.saveData.furniture||[];
      items.slice(0,8).forEach((item,i)=>{
        const y=67+(owned+i)*23;
        const row=this.add.text(46,y,FURNITURE[item.kind].name+' '+(item.stored?'[STORED]':'[PLACED]')+'  MOVE',{fontFamily:UI_FONT,fontSize:'10px',color:'#f7e9cb',backgroundColor:'#34575b',padding:{x:5,y:3}}).setInteractive();
        row.on('pointerdown',()=>this.selectFurniture(i));this.furniturePanel.add(row);
      });
      if(owned+items.length===0) this.furniturePanel.add(this.add.text(46,82,'Buy furniture in SHOP first.',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}));
    }
    else {
      const items=this.saveData.furniture||[];
      if(!items.length) this.furniturePanel.add(this.add.text(46,78,'Nothing purchased yet. Visit SHOP.',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}));
      items.slice(0,5).forEach((item,i)=>{
        const row=this.add.text(46,67+i*25,FURNITURE[item.kind].name+(item.stored?' [STORED]':' [PLACED]')+'  SELECT',{fontFamily:UI_FONT,fontSize:'10px',color:'#f7e9cb',backgroundColor:'#34575b',padding:{x:5,y:3}}).setInteractive();
        row.on('pointerdown',()=>this.selectFurniture(i));
        this.furniturePanel.add(row);
      });
      if(items.length>5) this.furniturePanel.add(this.add.text(46,196,'Showing first 5 items',{fontFamily:UI_FONT,fontSize:'9px',color:'#ffffff'}));
    }
    this.rosterPanel.setVisible(false);
    this.furniturePanel.setVisible(true);
    this.say(mode==='build'?'Build mode open: choose an owned item to move.':mode==='shop'?'Furniture shop open.':'Inventory open.');
  }
  private buyFurniture(kind:number):void {
    const item=FURNITURE[kind];
    if(this.saveData.reputation<item.rep) {this.say('Requires reputation '+item.rep+'.');return;}
    if(this.saveData.money<item.price) {this.say('Need $'+item.price+' to buy '+item.name+'.');return;}
    if((this.saveData.furniture||[]).length>=40) {this.say('Inventory full.');return;}
    this.saveData.money-=item.price;
    this.saveData.furniture=[...(this.saveData.furniture||[]),{kind,x:160,y:120,rotation:0,stored:true}];
    this.selectedFurniture=this.saveData.furniture.length-1;
    this.placingDecor=-1;
    this.furniturePanel.setVisible(false);
    this.updateFurnitureActions();
    this.persist();this.refresh();
    this.say('Purchased '+item.name+'! Tap a clear mat location to place. Q rotate, X store.');
  }
  private selectFurniture(i:number):void {
    this.selectedFurniture=i;this.placingDecor=-1;this.furniturePanel.setVisible(false);
    this.updateFurnitureActions();this.drawEquipment();
    const item=this.saveData.furniture?.[i];
    if(item) this.say('Selected '+FURNITURE[item.kind].name+'. Tap mat to move, or use ROTATE / STORE.');
  }
  private updateFurnitureActions():void {
    const visible=this.selectedFurniture>=0;
    this.rotateControl.setVisible(visible);
    this.storeControl.setVisible(visible);
  }
  private placeFurniture(x:number,y:number):void {
    if(this.running||this.selectedFurniture<0) return;
    if(x<65||x>285||y<75||y>187) {this.say('Place furniture inside the mat, away from edges.');return;}
    if(this.students.some(s=>Phaser.Math.Distance.Between(s.x,s.y,x,y)<32)||Phaser.Math.Distance.Between(this.player.x,this.player.y,x,y)<32) {this.say('Choose a spot away from people.');return;}
    const items=this.saveData.furniture||[];
    if(items.some((v,i)=>i!==this.selectedFurniture&&!v.stored&&Phaser.Math.Distance.Between(v.x,v.y,x,y)<35)) {this.say('Too close to another item.');return;}
    const item=items[this.selectedFurniture];if(!item)return;
    item.x=Math.round(x/6)*6;item.y=Math.round(y/6)*6;item.stored=false;
    this.persist();this.drawEquipment();this.say(FURNITURE[item.kind].name+' placed! Q rotate, X store, or choose another from INVENTORY.');
  }
  private rotateFurniture():void {
    const item=this.saveData.furniture?.[this.selectedFurniture];if(!item||this.running)return;
    item.rotation=(item.rotation+1)%4;this.persist();this.drawEquipment();this.say('Rotated '+FURNITURE[item.kind].name+'.');
  }
  private storeFurniture():void {
    const item=this.saveData.furniture?.[this.selectedFurniture];if(!item||this.running)return;
    item.stored=true;this.persist();this.drawEquipment();this.say(FURNITURE[item.kind].name+' returned to inventory.');this.selectedFurniture=-1;this.updateFurnitureActions();
  }
  private cycleDecorPlacement():void {
    if(this.running) { this.say('Finish class before decorating.'); return; }
    const owned=this.saveData.decorLevel||0;
    if(!owned) { this.say('Buy a decoration first.'); return; }
    this.selectedFurniture=-1;
    this.placingDecor=this.placingDecor+1>=owned?-1:this.placingDecor+1;
    this.route=[]; this.targetStudent=null;
    this.drawEquipment();
    this.buildButtonText.setText(this.placingDecor<0?'BUILD':'NEXT');
    this.buildHint.setText(this.placingDecor<0?'Build mode: click BUILD to arrange your decorations':'BUILD MODE | Click mat to place | NEXT to cycle');
    this.say(this.placingDecor<0?'Decoration placement closed.':'Moving '+['Gym banner','Training poster','Indoor plant'][this.placingDecor]+'. Tap a free spot on the mat. Press M to switch or exit.');
  }
  private placeDecor(x:number,y:number):void {
    if(this.running || this.placingDecor<0) return;
    if(x<60 || x>290 || y<70 || y>192) { this.say('Place decorations inside the training area, away from the edges.'); return; }
    if(this.students.some(s=>Phaser.Math.Distance.Between(s.x,s.y,x,y)<30) || Phaser.Math.Distance.Between(this.player.x,this.player.y,x,y)<30) {
      this.say('Too close to someone. Choose another spot.'); return;
    }
    const positions=this.saveData.decorPositions||defaults.decorPositions!.map(p=>({...p}));
    if(positions.some((p,i)=>i!==this.placingDecor && i<(this.saveData.decorLevel||0) && Phaser.Math.Distance.Between(p.x,p.y,x,y)<44)) {
      this.say('Too close to another decoration.'); return;
    }
    positions[this.placingDecor]={x:Math.round(x/6)*6,y:Math.round(y/6)*6};
    this.saveData.decorPositions=positions;
    this.persist(); this.drawEquipment();
    this.say('Decoration moved and saved! Press M to choose another or exit.');
  }
  private buyDecor():void {
    if(this.running) { this.say('Shop after class.'); return; }
    const level=this.saveData.decorLevel||0;
    if(level>=3) { this.say('All decorations purchased.'); return; }
    const cost=25+level*25;
    if(this.saveData.money<cost) { this.say('Need $'+cost+' to decorate.'); return; }
    this.saveData.money-=cost;
    this.saveData.decorLevel=level+1;
    this.persist(); this.refresh();
    this.showFeedback('GYM DECOR +1');
    this.say('Added '+['Gym banner','Training poster','Indoor plant'][level]+'! Your gym is growing.');
  }
  private toggleRoster():void {
    if(this.running) { this.say('Check the roster after class.'); return; }
    const lines=this.students.map(s=>{
      const rank=s.skill>=10?'Advanced':s.skill>=5?'Intermediate':'Beginner';
      return s.name+'  |  '+rank+'\n  Skill '+s.skill+'   Bond '+s.friendship;
    });
    this.rosterText.setText('STUDENT ROSTER  (tap to close)\n\n'+lines.join('\n'));
    this.rosterPanel.setVisible(!this.rosterPanel.visible);
  }
  private showStudentCard(student:Student):void {
    const rank=student.skill>=10?'Advanced':student.skill>=5?'Intermediate':'Beginner';
    this.studentCard.setText(student.name+' | '+rank+' | Skill '+student.skill+' | Bond '+student.friendship).setVisible(true);
    this.time.delayedCall(2800,()=>this.studentCard.setVisible(false));
  }
  private changeClass():void {
    if(this.running || this.saveData.completed) { this.say('Choose tomorrow\'s class after closing the gym.'); return; }
    const next=((this.saveData.classType||0)+1)%this.classNames.length;
    if(next===1 && this.saveData.reputation<5) { this.say('Muay Thai unlocks at 5 reputation.'); return; }
    if(next===2 && this.saveData.reputation<15) { this.say('Conditioning unlocks at 15 reputation.'); return; }
    this.saveData.classType=next;
    this.persist();
    this.say('Scheduled: '+this.classNames[this.saveData.classType]+'. Press CHANGE CLASS to rotate.');
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
    const nearest=target??[...this.students].sort((a,b)=>Phaser.Math.Distance.Between(this.player.x,this.player.y,a.x,a.y)-Phaser.Math.Distance.Between(this.player.x,this.player.y,b.x,b.y))[0];
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,nearest.x,nearest.y)>42) { this.say('Move closer to a student.'); return; }
    const i=this.students.indexOf(nearest);
    this.showStudentCard(nearest);
    if(this.running) {
      const at=this.requests.indexOf(i);
      if(at<0) { this.say(nearest.name+': All good, coach!'); return; }
      if((this.requestAge[i] ?? 99)<=7) this.quickBonus+=2;
      this.requests.splice(at,1);
      this.updateIndicators();
      this.classHelped++;
      if(nearest.friendship>=5) this.friendshipBonus+=2;
      nearest.skill++;
      const task = this.tasks[i] || 'Assistance';
      this.showFeedback((this.requestAge[i]<=7?'QUICK +$2 | ':'HELPED | ')+task+' | '+nearest.name);
      this.say(nearest.name+': Thanks for the '+task.toLowerCase()+' help, coach!');
      this.tweens.add({targets:nearest.body,y:nearest.y-7,duration:140,yoyo:true,repeat:1});
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
      const lines=[['My jab needs work.','I want to compete someday.'],['I brought snacks!','I love this gym community.'],['I studied some fight footage.','I am working on combinations.'],['I am sore today.','I keep showing up!']];
      const milestone=nearest.friendship===3?' You are becoming regular training partners.':nearest.friendship===5?' Friendship milestone: Trusted teammate!':'';
      this.say(nearest.name+': '+lines[i][Math.max(0,nearest.friendship-1)%2]+' Bond '+nearest.friendship+'.'+(firstToday?milestone:' Already chatted today.'));
    }
  }
  private openArcade(mode:'Rhythm'|'Memory'):void {
    if(this.running) return;
    this.persist();
    this.scene.start(mode);
  }
  private startClass():void {
    if(this.running || this.saveData.completed) { this.say('Class already started or completed.'); return; }
    this.persist(); this.scene.start('Rush'); return;
    this.rosterPanel.setVisible(false);
    this.modeLabel.setText('CLASS RUSH');
    this.classOverlay.clear().lineStyle(3,0xe8bd6c).strokeRect(30,30,290,181);
    this.placingDecor=-1;
    this.selectedFurniture=-1;
    this.furniturePanel.setVisible(false);
    this.updateFurnitureActions();
    this.buildButtonText.setText('BUILD');
    this.buildHint.setText('Build mode: click BUILD to arrange your decorations');
    this.drawEquipment();
    this.running=true; this.seconds=50; this.classHelped=0; this.friendshipBonus=0; this.quickBonus=0; this.requestAge={}; this.nextRequestAt=5;
    const offset=(this.saveData.day-1)%4;
    this.pendingRequests=[offset,(offset+1)%4,(offset+2)%4];
    this.requests=[];
    const taskTypes=(this.saveData.classType||0)===1?['Kick technique','Pad work','Clinch drill']:(this.saveData.classType||0)===2?['Warm-up','Form check','Station change']:['Technique','Equipment','Station change'];
    this.tasks={};
    this.pendingRequests.forEach((index,position)=>{this.tasks[index]=taskTypes[(position+this.saveData.day-1)%taskTypes.length];});
    this.spawnRequest();
    this.updateIndicators();
    this.say(this.classNames[this.saveData.classType||0]+'! Students request help throughout class.');
  }
  private spawnRequest():void {
    const index=this.pendingRequests.shift();
    if(index===undefined) return;
    this.requests.push(index);
    this.requestAge[index]=0;
    this.updateIndicators();
    this.say(this.students[index].name+' needs '+this.tasks[index].toLowerCase()+' help!');
  }
  private finishClass():void {
    if(!this.running) return;
    this.running=false;
    this.modeLabel.setText('GYM HUB');
    this.classOverlay.clear();
    this.updateIndicators();
    this.saveData.completed=true;
    const gearBonus=(this.saveData.equipment||0)*5;
    const classBonus=(this.saveData.classType||0)*4;
    const reward=20+classBonus+this.classHelped*5+this.friendshipBonus+this.quickBonus+gearBonus;
    this.saveData.classesTaught=(this.saveData.classesTaught||0)+1;
    this.saveData.money+=reward;
    this.saveData.lifetimeEarnings=(this.saveData.lifetimeEarnings||0)+reward;
    const oldRep=this.saveData.reputation;
    this.saveData.reputation+=1+this.classHelped;
    this.persist();
    this.refresh();
    this.timer.setText('CLASS COMPLETE');
    const rating=this.classHelped===3?'Excellent':this.classHelped===2?'Good':this.classHelped===1?'Fair':'Needs practice';
    const unlock=oldRep<5&&this.saveData.reputation>=5?' MUAY THAI UNLOCKED!':oldRep<15&&this.saveData.reputation>=15?' CONDITIONING UNLOCKED!':'';
    this.say(rating+'! '+this.classHelped+'/3 helped | Earned $'+reward+' (speed $'+this.quickBonus+', gear $'+gearBonus+').'+unlock);
  }
  private nextDay():void {
    if(this.running) { this.say('Finish class first.'); return; }
    if(!this.saveData.completed) { this.say('Teach class first.'); return; }
    this.saveData.day++;
    this.saveData.completed=false;
    this.say('New day! '+this.classNames[this.saveData.classType||0]+' is scheduled. Save earnings for gym upgrades.');
    this.persist(); this.refresh();
    this.timer.setText('');
  }
  private reset():void {
    this.saveData={...defaults,friendships:[0,0,0,0],skills:[0,0,0,0]};
    this.running=false; this.placingDecor=-1; this.selectedFurniture=-1; this.updateFurnitureActions(); this.buildButtonText.setText('BUILD'); this.buildHint.setText('Build mode: click BUILD to arrange your decorations'); this.classOverlay.clear(); this.modeLabel.setText('GYM HUB'); this.requests=[]; this.pendingRequests=[]; this.targetStudent=null; this.updateIndicators(); this.persist();
    this.scene.restart();
  }
  private findRoute(start:Point,end:Point):Point[] {
    const cols=Math.ceil(W/CELL),rows=Math.ceil(H/CELL);
    const key=(x:number,y:number)=>y*cols+x;
    const cell=(p:Point)=>({x:Phaser.Math.Clamp(Math.floor(p.x/CELL),0,cols-1),y:Phaser.Math.Clamp(Math.floor(p.y/CELL),0,rows-1)});
    const s=cell(start),goal=cell(end);
    const valid=(x:number,y:number)=>x>=0&&x<cols&&y>=0&&y<rows&&walkable(x*CELL+CELL/2,y*CELL+CELL/2);
    if(!valid(goal.x,goal.y)) return [];
    const queue=[s],visited=new Set<number>([key(s.x,s.y)]),previous=new Map<number,number>();
    let found=false;
    for(let head=0;head<queue.length;head++) {
      const cur=queue[head];
      if(cur.x===goal.x&&cur.y===goal.y) { found=true; break; }
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x=cur.x+dx,y=cur.y+dy,id=key(x,y);
        if(!valid(x,y)||visited.has(id)) continue;
        visited.add(id); previous.set(id,key(cur.x,cur.y)); queue.push({x,y});
      }
    }
    if(!found) return [];
    const route:Point[]=[];
    let current=key(goal.x,goal.y),origin=key(s.x,s.y);
    while(current!==origin) {
      route.unshift({x:(current%cols)*CELL+CELL/2,y:Math.floor(current/cols)*CELL+CELL/2});
      const parent=previous.get(current);
      if(parent===undefined) return [];
      current=parent;
    }
    if(walkable(end.x,end.y)) route.push(end);
    return route;
  }
  update(_time:number,delta:number):void {
    if(this.running) {
      const dt=Math.min(delta,100)/1000;
      this.seconds-=dt;
      for(const index of this.requests) this.requestAge[index]+=dt;
      this.students.forEach((student,index)=>{
        if(!student.indicator || !this.requests.includes(index)) return;
        const remaining=Math.max(0,Math.ceil(7-(this.requestAge[index] ?? 0)));
        student.indicator.setText('! '+this.tasks[index]+(remaining>0?' +$2 '+remaining+'s':''));
        student.indicator.setBackgroundColor(remaining>0?'#a53d34':'#555b5d');
      });
      if(this.pendingRequests.length && 50-this.seconds>=this.nextRequestAt) {
        this.spawnRequest(); this.nextRequestAt+=5;
      }
      this.timer.setText('CLASS '+Math.ceil(this.seconds)+'s | '+this.requests.length+' active | '+this.pendingRequests.length+' upcoming');
      if(this.seconds<=0) this.finishClass();
    }
    let dx=Number(this.cursors.right.isDown||this.wasd.D.isDown)-Number(this.cursors.left.isDown||this.wasd.A.isDown);
    let dy=Number(this.cursors.down.isDown||this.wasd.S.isDown)-Number(this.cursors.up.isDown||this.wasd.W.isDown);
    if(dx||dy) { this.route=[]; this.targetStudent=null; }
    else if(this.route.length) {
      const target=this.route[0];
      const distance=Phaser.Math.Distance.Between(this.player.x,this.player.y,target.x,target.y);
      if(distance<2) { this.route.shift(); if(!this.route.length && this.targetStudent) { const s=this.targetStudent; this.targetStudent=null; this.interact(s); } return; }
      dx=(target.x-this.player.x)/distance; dy=(target.y-this.player.y)/distance;
    }
    const length=Math.hypot(dx,dy);
    if(!length) { this.player.setScale(1); return; }
    this.walkingClock+=delta;
    this.player.setScale(1,1+Math.sin(this.walkingClock/95)*0.035);
    const step=Math.min(delta,50)/1000*this.speed;
    const remaining=this.route.length?Phaser.Math.Distance.Between(this.player.x,this.player.y,this.route[0].x,this.route[0].y):step;
    const move=Math.min(step,remaining);
    const nx=this.player.x+dx/length*move,ny=this.player.y+dy/length*move;
    if(walkable(nx,this.player.y)) this.player.x=nx;
    if(walkable(this.player.x,ny)) this.player.y=ny;
    if(this.targetStudent && !this.route.length) { const s=this.targetStudent; this.targetStudent=null; this.interact(s); }
  }
}

const ink=0x203b42,cream='#f5e8cc',gold=0xe8bb70;
function arcadeButton(scene:Phaser.Scene,x:number,y:number,w:number,h:number,label:string,fn:()=>void):void {
  const bg=scene.add.rectangle(x,y,w,h,0x376b70).setStrokeStyle(2,gold).setInteractive({useHandCursor:true});
  scene.add.text(x,y,label,{fontFamily:UI_FONT,fontSize:'13px',color:cream,fontStyle:'bold'}).setOrigin(0.5);
  bg.on('pointerdown',fn);
}
function arcadeFrame(scene:Phaser.Scene,title:string,subtitle:string):void {
  const g=scene.add.graphics();
  g.fillStyle(0x172f38).fillRect(0,0,480,330);
  g.fillStyle(0x23454b).fillRoundedRect(12,12,456,306,10);
  g.lineStyle(2,gold).strokeRoundedRect(12,12,456,306,10);
  scene.add.text(24,22,title,{fontFamily:UI_FONT,fontSize:'23px',fontStyle:'bold',color:cream});
  scene.add.text(24,53,subtitle,{fontFamily:UI_FONT,fontSize:'11px',color:'#b7d2d0'});
}
function awardArcade(cash:number,rep:number,completeClass:boolean):void {
  const s=loadSave();
  s.money+=cash;s.lifetimeEarnings=(s.lifetimeEarnings||0)+cash;s.reputation+=rep;
  if(completeClass){s.completed=true;s.classesTaught=(s.classesTaught||0)+1;}
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));}catch{}
}
class RushScene extends Phaser.Scene {
  private active=false;private seconds=45;private score=0;private missed=0;private requests:{lane:number,age:number}[]=[];
  private spawn=0;private info!:Phaser.GameObjects.Text;private lanes!:Phaser.GameObjects.Container;
  constructor(){super('Rush');}
  create():void {
    this.active=true;this.seconds=45;this.score=0;this.missed=0;this.requests=[];this.spawn=0;
    arcadeFrame(this,'CLASS RUSH','Help students before their patience runs out. Click their HELP buttons.');
    this.info=this.add.text(24,80,'',{fontFamily:UI_FONT,fontSize:'14px',color:cream});
    this.lanes=this.add.container(0,0);
    ['FRANK','RADISH','MARSHALL','PUDGE'].forEach((name,i)=>{
      const y=125+i*43;
      this.add.rectangle(238,y,418,38,i%2?0x31535a:0x294950).setStrokeStyle(1,0x628186);
      this.add.circle(52,y,13,[0xd9a06c,0x8cbaaa,0xaaa4d5,0xe2bd77][i]);
      this.add.text(75,y,name,{fontFamily:UI_FONT,fontSize:'13px',color:cream}).setOrigin(0,0.5);
      arcadeButton(this,392,y,76,28,'HELP',()=>this.help(i));
    });
    arcadeButton(this,415,35,75,27,'EXIT',()=>this.exit());
    this.render();
  }
  private help(i:number):void {
    if(!this.active)return;
    const idx=this.requests.findIndex(r=>r.lane===i);
    if(idx<0)return;
    const r=this.requests.splice(idx,1)[0];this.score+=r.age<4?3:2;this.render();
  }
  private render():void {
    this.lanes.removeAll(true);
    for(const r of this.requests){
      const y=125+r.lane*43;
      const remain=Math.max(0,Math.ceil(9-r.age));
      const t=this.add.text(235,y,'NEEDS HELP  '+remain+'s',{fontFamily:UI_FONT,fontSize:'11px',color:remain<4?'#ffb3a2':'#ffe5a4'}).setOrigin(0.5);
      this.lanes.add(t);
    }
    this.info.setText('TIME '+Math.ceil(this.seconds)+'s    POINTS '+this.score+'    MISSED '+this.missed);
  }
  update(_t:number,delta:number):void {
    if(!this.active)return;
    const dt=Math.min(delta,100)/1000;this.seconds-=dt;this.spawn-=dt;
    if(this.spawn<=0){const free=[0,1,2,3].filter(i=>!this.requests.some(r=>r.lane===i));if(free.length)this.requests.push({lane:Phaser.Utils.Array.GetRandom(free),age:0});this.spawn=2.4;}
    for(const r of this.requests)r.age+=dt;
    const expired=this.requests.filter(r=>r.age>=9);this.missed+=expired.length;this.requests=this.requests.filter(r=>r.age<9);
    if(this.seconds<=0){this.finish();return;}this.render();
  }
  private finish():void {
    this.active=false;this.requests=[];this.render();
    const earned=20+this.score*3,rep=Math.max(1,Math.floor(this.score/4));
    awardArcade(earned,rep,true);
    this.add.rectangle(240,164,330,180,ink).setStrokeStyle(2,gold);
    this.add.text(240,112,'CLASS COMPLETE',{fontFamily:UI_FONT,fontSize:'21px',fontStyle:'bold',color:cream}).setOrigin(0.5);
    this.add.text(240,155,'Earned $'+earned+'   Reputation +'+rep,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
+earned+'   Reputation +'+rep,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
    arcadeButton(this,240,209,160,35,'RETURN TO GYM',()=>this.scene.start('Gym'));
  }
  private exit():void {
    if(!this.active)return;this.active=false;this.scene.start('Gym');
  }
}
class RhythmScene extends Phaser.Scene {
  private active=false;private beat=0;private hits=0;private attempts=0;private info!:Phaser.GameObjects.Text;private marker!:Phaser.GameObjects.Rectangle;
  constructor(){super('Rhythm');}
  create():void {
    this.active=true;this.beat=0;this.hits=0;this.attempts=0;
    arcadeFrame(this,'PAD WORK','Time 12 strikes as the marker crosses the gold target. SPACE or STRIKE.');
    this.info=this.add.text(24,84,'',{fontFamily:UI_FONT,fontSize:'14px',color:cream});
    this.add.rectangle(240,165,380,16,0x112b32);
    this.add.rectangle(240,165,46,30,0xe8bb70,0.5).setStrokeStyle(2,gold);
    this.marker=this.add.rectangle(65,165,10,37,0xe8e5d8);
    arcadeButton(this,240,248,165,43,'STRIKE',()=>this.strike());
    arcadeButton(this,415,35,75,27,'EXIT',()=>this.scene.start('Gym'));
    this.input.keyboard?.on('keydown-SPACE',()=>this.strike());
    this.render();
  }
  private strike():void {
    if(!this.active)return;
    const x=this.marker.x;
    const good=Math.abs(x-240)<=26;
    this.hits+=Number(good);this.attempts++;this.beat=0;this.render();
    if(this.attempts>=12)this.finish();
  }
  private render():void {this.info.setText('STRIKES '+this.attempts+'/12   PERFECT '+this.hits+'   '+(this.attempts?Math.round(this.hits/this.attempts*100):0)+'%');}
  update(_t:number,delta:number):void {
    if(!this.active)return;
    this.beat+=Math.min(delta,100)/1000;
    this.marker.x=240+175*Math.sin(this.beat*3.2-Math.PI/2);
  }
  private finish():void {
    this.active=false;const earned=5+this.hits*4;awardArcade(earned,Math.floor(this.hits/5),false);
    this.add.rectangle(240,165,345,168,ink).setStrokeStyle(2,gold);
    this.add.text(240,117,'PAD WORK COMPLETE',{fontFamily:UI_FONT,fontSize:'20px',color:cream}).setOrigin(0.5);
    this.add.text(240,155,this.hits+'/12 accurate  |  +$'+earned,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
+earned,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
    arcadeButton(this,240,207,160,35,'RETURN TO GYM',()=>this.scene.start('Gym'));
  }
}
class MemoryScene extends Phaser.Scene {
  private sequence:number[]=[];private position=0;private round=0;private showing=false;private active=false;
  private info!:Phaser.GameObjects.Text;private pads:Phaser.GameObjects.Rectangle[]=[];
  constructor(){super('Memory');}
  create():void {
    this.active=true;this.sequence=[];this.round=0;this.position=0;this.showing=false;
    arcadeFrame(this,'COACH SAYS','Watch the drill, then repeat the sequence. Complete five rounds.');
    this.info=this.add.text(24,85,'',{fontFamily:UI_FONT,fontSize:'14px',color:cream});
    const labels=['JAB','CROSS','HOOK','KICK'];
    for(let i=0;i<4;i++){
      const x=137+(i%2)*206,y=151+Math.floor(i/2)*76;
      const pad=this.add.rectangle(x,y,180,62,[0x376b70,0x965a4d,0x6c658c,0x8c7447][i]).setStrokeStyle(2,gold).setInteractive({useHandCursor:true});
      this.add.text(x,y,labels[i],{fontFamily:UI_FONT,fontSize:'17px',fontStyle:'bold',color:cream}).setOrigin(0.5);
      pad.on('pointerdown',()=>this.choose(i));this.pads.push(pad);
    }
    arcadeButton(this,415,35,75,27,'EXIT',()=>this.scene.start('Gym'));
    this.nextRound();
  }
  private nextRound():void {
    if(!this.active)return;
    this.round++;this.position=0;this.sequence.push(Phaser.Math.Between(0,3));this.showing=true;
    this.info.setText('ROUND '+this.round+'/5   |   WATCH THE DRILL');
    this.sequence.forEach((n,i)=>{
      this.time.delayedCall(600+i*730,()=>{
        if(!this.active)return;
        this.pads[n].setStrokeStyle(5,0xffffff);
        this.time.delayedCall(390,()=>{if(this.active)this.pads[n].setStrokeStyle(2,gold);});
      });
    });
    this.time.delayedCall(750+this.sequence.length*730,()=>{
      if(!this.active)return;this.showing=false;this.info.setText('ROUND '+this.round+'/5   |   YOUR TURN: '+this.sequence.length+' MOVES');
    });
  }
  private choose(n:number):void {
    if(!this.active||this.showing)return;
    if(this.sequence[this.position]!==n){this.finish(false);return;}
    this.position++;
    if(this.position===this.sequence.length){
      this.showing=true;
      if(this.round>=5)this.finish(true);
      else this.time.delayedCall(700,()=>this.nextRound());
    }
  }
  private finish(won:boolean):void {
    this.active=false;const earned=won?35:Math.max(0,(this.round-1)*5);awardArcade(earned,won?2:0,false);
    this.add.rectangle(240,164,345,170,ink).setStrokeStyle(2,gold);
    this.add.text(240,115,won?'DRILL MASTERED':'DRILL ENDED',{fontFamily:UI_FONT,fontSize:'21px',color:cream}).setOrigin(0.5);
    this.add.text(240,153,'Round '+this.round+'/5   |   Earned $'+earned,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
+earned,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
    arcadeButton(this,240,206,160,35,'RETURN TO GYM',()=>this.scene.start('Gym'));
  }
}

new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:330,backgroundColor:'#c9ae86',pixelArt:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[GymScene,RushScene,RhythmScene,MemoryScene]});
