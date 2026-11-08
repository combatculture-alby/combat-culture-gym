import Phaser from 'phaser';

const W = 480, H = 270, CELL = 6;
const UI_FONT = 'Trebuchet MS, Arial, sans-serif';
type Point = { x: number; y: number };
type Student = { name: string; x: number; y: number; color: number; friendship: number; skill: number; body?: Phaser.GameObjects.Container; indicator?: Phaser.GameObjects.Text; nameTag?: Phaser.GameObjects.Text; activityTag?: Phaser.GameObjects.Text; ai?: {target:Point; timer:number; activity:number; phase:number; route:Point[]; socialCooldown:number} };
type Furniture = { kind: number; x: number; y: number; rotation: number; stored: boolean };
const FURNITURE = [{name:'Floor Lamp',price:35,rep:0},{name:'Bench',price:60,rep:3},{name:'Trophy Case',price:90,rep:8},{name:'Water Cooler',price:45,rep:0},{name:'Punching Dummy',price:120,rep:12}];
type Save = { version: 1; day: number; money: number; reputation: number; completed: boolean; friendships: number[]; skills: number[]; equipment?: number; classesTaught?: number; classType?: number; lastTalkDays?: number[]; decorLevel?: number; lifetimeEarnings?: number; decorPositions?: Point[]; furniture?: Furniture[]; playedActivities?: Partial<Record<TrainingMode,number>>; studentStats?: number[][]; studentXP?: number[][]; classesToday?: number; ownedGear?: boolean[]; materials?: number[]; gatheredToday?: number[]; studentGoals?: number[][]; completedGoals?: number[]; gearPositions?: Point[]; gearStored?: boolean[] };
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
const initialStats=()=>Array.from({length:4},()=>[10,10,10,10]);
const initialXP=()=>Array.from({length:4},()=>[0,0,0,0]);
const initialGoals=()=>[[20,0],[25,2],[20,3],[25,1]];
const SAVE_KEY = 'combat-culture-gym-v1';
const blocks = [{ x: 395, y: 185, w: 65, h: 35 }];
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
    return {...s, equipment: Math.max(0,Math.min(3,Math.floor(Number(s.equipment)||0))), classesTaught: Math.max(0,Math.floor(Number(s.classesTaught)||0)), classType: Math.max(0,Math.min(2,Math.floor(Number(s.classType)||0))), lastTalkDays: Array.from({length:4},(_,i)=>Math.max(0,Math.floor(Number(s.lastTalkDays?.[i])||0))), decorLevel: Math.max(0,Math.min(3,Math.floor(Number(s.decorLevel)||0))), furniture: Array.isArray(s.furniture) ? s.furniture.filter((v:unknown)=>{ const f=v as Partial<Furniture>; return !!f && Number.isInteger(f.kind) && f.kind!>=0 && f.kind!<FURNITURE.length && Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isInteger(f.rotation) && typeof f.stored==='boolean'; }).slice(0,40).map((v:Furniture)=>({...v,x:Math.max(60,Math.min(290,v.x)),y:Math.max(70,Math.min(192,v.y)),rotation:((v.rotation%4)+4)%4})) : [], decorPositions: Array.from({length:3},(_,i)=>{ const fallback=defaults.decorPositions![i]; const p=s.decorPositions?.[i]; return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x>=45 && p.x<=308 && p.y>=45 && p.y<=195 ? {x:Math.round(p.x),y:Math.round(p.y)} : {...fallback}; }), lifetimeEarnings: Math.max(0,Math.floor(Number(s.lifetimeEarnings)||0)), classesToday:Math.max(0,Math.min(2,Math.floor(Number(s.classesToday)||0))), ownedGear:Array.from({length:8},(_,i)=>s.ownedGear?.[i]===true||(s.ownedGear===undefined&&i===0&&(s.equipment||0)>=1)), materials:Array.from({length:3},(_,i)=>Math.max(0,Math.floor(Number(s.materials?.[i])||0))), gatheredToday:Array.isArray(s.gatheredToday)?s.gatheredToday.filter(v=>Number.isInteger(v)&&v>=0&&v<12):[], studentGoals:Array.from({length:4},(_,i)=>{const g=s.studentGoals?.[i]||initialGoals()[i];return [Math.max(10,Math.min(100,Math.floor(Number(g[0])||20))),Math.max(0,Math.min(3,Math.floor(Number(g[1])||0)))];}), completedGoals:Array.from({length:4},(_,i)=>Math.max(0,Math.floor(Number(s.completedGoals?.[i])||0))), gearStored:Array.from({length:8},(_,i)=>s.gearStored?.[i]===true), gearPositions:Array.from({length:8},(_,i)=>({x:Math.max(65,Math.min(285,Number(s.gearPositions?.[i]?.x)||65+(i%4)*57)),y:Math.max(75,Math.min(187,Number(s.gearPositions?.[i]?.y)||(i<4?80:180)))})), studentStats:Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>Math.max(0,Math.min(100,Math.floor(Number(s.studentStats?.[i]?.[j])||10))))), studentXP:Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>Math.max(0,Math.floor(Number(s.studentXP?.[i]?.[j])||0))))} as Save;
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
  private worldFixtures:Phaser.GameObjects.Graphics[]=[];
  private placementPreview!:Phaser.GameObjects.Graphics;
  private placementHint!:Phaser.GameObjects.Text;
  private buildMode=false;
  private placementCursor:Point={x:168,y:144};
  private keyboardPlacement=false;
  private buildPage=0;
  private stationTarget:'board'|'desk'|null=null;
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
    this.saveData=loadSave();
    this.students.forEach((s,i) => { s.friendship = this.saveData.friendships[i]; s.skill = this.saveData.skills[i]; });
    const g = this.add.graphics();
    g.fillStyle(0xc9ae86).fillRect(0,0,W,330);
    // Warm timber wall, windows, posters, and a clear right-side control desk.
    g.fillStyle(0x73563e).fillRect(0,0,480,31);
    // Layered 32px retro-RPG tiles: timber floor, textured wall, and stitched training mats.
    g.fillStyle(0xe3cfaa).fillRect(0,31,480,194);
    for(let y=32;y<225;y+=16)for(let x=0;x<480;x+=32){
      const offset=(Math.floor(y/16)%2)*16;
      g.fillStyle((Math.floor(x/32)+Math.floor(y/16))%3===0?0xd8c19b:0xe9d7b5,0.55).fillRect(x+offset,y,30,15);
      g.fillStyle(0xb99e79,0.25).fillRect(x+offset,y+14,30,1);
    }
    g.fillStyle(0x8a674c).fillRect(0,224,480,46);
    for(let y=225;y<270;y+=11) {
      g.fillStyle(0xa27b58).fillRect(0,y,480,1);
      for(let x=(Math.floor(y/11)%2)*34;x<480;x+=68)g.fillStyle(0x6d513e).fillRect(x,y,2,11);
    }
    g.fillStyle(0xe4d3ac).fillRect(330,31,150,194);
    g.fillStyle(0x71533e).fillRect(43,35,83,44);
    g.fillStyle(0x86b8bd).fillRect(48,39,73,36);
    g.fillStyle(0xe9d9b6).fillRect(82,39,4,36);
    g.fillStyle(0xe9d9b6).fillRect(48,55,73,3);
    g.fillStyle(0x5d4638).fillRect(195,34,92,34);
    g.fillStyle(0x36545b).fillRect(199,38,84,26);
    g.fillStyle(0xe0c38c).fillRect(204,43,74,16);
    g.fillStyle(0x6b4636).fillRect(0,216,330,9);
    g.fillStyle(0x243f43).fillRect(28,74,294,141);
    g.fillStyle(0x537d7b).fillRect(33,79,284,131);
    for(let y=79;y<210;y+=32)for(let x=33;x<317;x+=32){
      const alternate=(Math.floor((x-33)/32)+Math.floor((y-79)/32))%2===0;
      g.fillStyle(alternate?0x5b8782:0x517b79).fillRect(x,y,31,31);
      g.fillStyle(0x83a69c,0.55).fillRect(x,y,31,1);
      g.fillStyle(0x2e5b5b,0.6).fillRect(x+30,y,1,31);
    }
    g.fillStyle(0x9b5149).fillRect(32,79,5,131);
    g.fillStyle(0x9b5149).fillRect(312,79,5,131);
    g.fillStyle(0xc49a72).fillRect(26,72,297,5);
    g.fillStyle(0x644a39).fillRect(26,211,297,5);
    // Training board and reception desk are physical interaction points.
    g.fillStyle(0x795a3f).fillRect(344,51,112,69);
    g.fillStyle(0xd9c18e).fillRect(349,56,102,58);
    g.lineStyle(2,0x644a35).strokeRect(349,56,102,58);
    g.fillStyle(0x476c69).fillRect(359,65,80,13);
    g.fillStyle(0xe7d8b3).fillRect(357,59,14,3);
    g.fillStyle(0xe7d8b3).fillRect(423,59,17,3);
    g.fillStyle(0xa34f42).fillRect(359,84,46,5);
    g.fillStyle(0x8d9f87).fillRect(359,95,70,5);
    g.fillStyle(0x8a6242).fillRect(390,185,78,36);
    g.fillStyle(0xc9a477).fillRect(388,182,82,8);
    g.fillStyle(0x263b3c).fillRect(409,163,40,23);
    g.fillStyle(0x77ada9).fillRect(413,167,32,15);
    g.fillStyle(0x315f63).fillRect(416,170,26,9);
    g.fillStyle(0xc7e0c7).fillRect(418,172,12,2);
    g.fillStyle(0x97c4bb).fillRect(418,176,19,1);
    g.fillStyle(0xe6d2a8).fillRect(410,191,39,5);
    g.fillStyle(0x735a3d).fillRect(33,76,285,4);
    g.fillStyle(0x765337).fillRect(385,217,88,6);
    g.fillStyle(0x3b332d).fillRect(0,0,W,14);
    this.add.text(346,127,'TRAINING BOARD',{fontFamily:UI_FONT,fontSize:'10px',color:'#493e33'});
    this.add.text(385,226,'RECEPTION',{fontFamily:UI_FONT,fontSize:'10px',color:'#493e33'});
    this.decor=this.add.graphics().setDepth(1);
    this.classOverlay=this.add.graphics().setDepth(2);
    this.modeLabel=this.add.text(12,5,'OPEN MAT',{fontFamily:UI_FONT,fontSize:'11px',fontStyle:'bold',color:'#f6e8c8',backgroundColor:'#294f52',padding:{x:5,y:3}}).setDepth(12);
    this.shopLabel=this.add.text(0,0,'',{fontFamily:UI_FONT,fontSize:'9px'}).setVisible(false);
    this.equipmentLabel=this.add.text(0,0,'EQUIPMENT',{fontFamily:UI_FONT,fontSize:'10px'}).setVisible(false);
    // Pixel-inspired owner: black hair, red headband, dark hoodie and Muay Thai shorts.
    this.player = this.makeCharacter(170,150,0x26292e,0xe6b28e,0x18191e,0xb8242c,true);
    for(const s of this.students) {
      const skin = [0xc68c66,0xe5b08e,0x9c674c,0xe0bc91][this.students.indexOf(s)];
      const hair = [0x29252a,0x503329,0x171a22,0x755039][this.students.indexOf(s)];
      s.body = this.makeCharacter(s.x,s.y,s.color,skin,hair,0x354e56,false);
      s.nameTag=this.add.text(s.x,s.y-36,s.name,{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',backgroundColor:'#203d40'}).setOrigin(0.5).setDepth(10+s.y/100+0.1);
      s.activityTag=this.add.text(s.x,s.y-48,'',{fontFamily:UI_FONT,fontSize:'8px',color:'#f5dfb6',backgroundColor:'#34575b',padding:{x:3,y:1}}).setOrigin(0.5).setDepth(10+s.y/100+0.1).setVisible(false);
      s.ai={target:{x:s.x,y:s.y},timer:1+this.students.indexOf(s)*1.4,activity:0,phase:0,route:[],socialCooldown:6+this.students.indexOf(s)*3};
      s.indicator = this.add.text(s.x,s.y-55,'!',{fontFamily:UI_FONT,fontSize:'16px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#a53d34',padding:{x:5,y:1}}).setOrigin(0.5).setVisible(false).setDepth(4);
    }
    this.status = this.add.text(111,5,'',{fontFamily:UI_FONT,fontSize:'9px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:3}}).setDepth(30);
    this.studentCard=this.add.text(12,16,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:3}}).setDepth(10).setVisible(false);
    this.message = this.add.text(12,232,'Welcome to the gym!',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:3},wordWrap:{width:430}}).setDepth(30);
    this.timer = this.add.text(12,225,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#29383b'});
    this.feedback = this.add.text(165,197,'',{fontFamily:UI_FONT,fontSize:'10px',fontStyle:'bold',color:'#fff5dc',backgroundColor:'#294f52',padding:{x:4,y:2}}).setOrigin(0.5).setDepth(10).setVisible(false);
    this.buildHint=this.add.text(12,281,'',{fontFamily:UI_FONT,fontSize:'9px',color:'#29383b'}).setVisible(false);
    this.add.text(12,255,'WASD: MOVE   E: INTERACT   CLICK: WALK / USE',{fontFamily:UI_FONT,fontSize:'9px',color:'#29383b'});


    this.dailyStatus=this.add.text(325,5,'',{fontFamily:UI_FONT,fontSize:'9px',color:'#f5e8cc',backgroundColor:'#294f52',padding:{x:4,y:2}}).setDepth(30);
    const panelBack=this.add.rectangle(67,24,346,222,0x203d40).setOrigin(0).setStrokeStyle(2,0xd4b783);
    this.rosterText=this.add.text(83,39,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',lineSpacing:4});
    this.rosterPanel=this.add.container(0,0,[panelBack,this.rosterText]).setDepth(80).setVisible(false);
    this.furniturePanel=this.add.container(0,0).setDepth(60).setVisible(false);
    this.placementPreview=this.add.graphics().setDepth(45);
    this.placementHint=this.add.text(240,219,'',{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',backgroundColor:'#203d40',padding:{x:5,y:3}}).setOrigin(0.5).setDepth(46).setVisible(false);
    // Legacy decoration controls still update this label; keep it initialized without exposing a duplicate button.
    this.buildButtonText=this.add.text(0,0,'BUILD',{fontFamily:UI_FONT,fontSize:'9px'}).setVisible(false);
    this.rotateControl=this.makeActionControl(36,238,'ROTATE',()=>this.rotateFurniture());
    this.storeControl=this.makeActionControl(112,238,'STORE',()=>this.storeFurniture());
    this.updateFurnitureActions();
    this.refresh();
    this.drawGatheringNodes();
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.input.keyboard!.on('keydown-E',() => {if(this.furniturePanel.visible){this.furniturePanel.setVisible(false);return;}if(this.collectNearby())return;if(this.useNearbyStation())return;this.interact();});
    this.input.keyboard!.on('keydown-C',() => {if(!this.furniturePanel.visible)this.openArcade('Rush');});
    this.input.keyboard!.on('keydown-P',()=>{if(!this.furniturePanel.visible)this.openArcade('Rhythm');});
    this.input.keyboard!.on('keydown-G',()=>{if(!this.furniturePanel.visible)this.openArcade('Memory');});
    this.input.keyboard!.on('keydown-N',() => {if(!this.furniturePanel.visible&&!this.isPlacing())this.nextDay();});
    this.input.keyboard!.on('keydown-R',() => {if(!this.furniturePanel.visible&&!this.isPlacing())this.reset();});
    this.input.keyboard!.on('keydown-B',() => {if(!this.furniturePanel.visible&&!this.isPlacing())this.openGymUpgrades();});
    this.input.keyboard!.on('keydown-V',() => this.toggleRoster());
    this.input.keyboard!.on('keydown-M',()=>this.toggleBuildMode());
    this.input.keyboard!.on('keydown-ENTER',()=>this.confirmPlacement());
    this.input.keyboard!.on('keydown-SPACE',()=>this.confirmPlacement());
    this.input.keyboard!.on('keydown-UP',()=>this.movePlacement(0,-6));
    this.input.keyboard!.on('keydown-DOWN',()=>this.movePlacement(0,6));
    this.input.keyboard!.on('keydown-LEFT',()=>this.movePlacement(-6,0));
    this.input.keyboard!.on('keydown-RIGHT',()=>this.movePlacement(6,0));
    this.input.keyboard!.on('keydown-Q',() => this.rotateFurniture());
    this.input.keyboard!.on('keydown-X',() => this.storeFurniture());
    this.input.keyboard!.on('keydown-ESC',()=>{if(this.furniturePanel.visible)this.furniturePanel.setVisible(false);else this.cancelPlacement();});
    this.input.on('pointerdown',(p:Phaser.Input.Pointer) => {
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
      if(this.collectNodeAt(p.worldX,p.worldY))return;
      const student = this.students.find(s => Phaser.Math.Distance.Between(s.x,s.y,p.worldX,p.worldY) < 23);
      if(student) {
        if(Phaser.Math.Distance.Between(this.player.x,this.player.y,student.x,student.y) < 42) this.interact(student);
        else { this.targetStudent = student; this.route = this.findRoute({x:this.player.x,y:this.player.y},{x:student.x-24,y:student.y+10}); }
      } else { this.targetStudent = null; this.route = this.findRoute({x:this.player.x,y:this.player.y},{x:p.worldX,y:p.worldY}); }
    });
  }
  private useStationAt(x:number,y:number):boolean {
    const board=x>=344&&x<=457&&y>=49&&y<=122;
    const desk=x>=390&&x<=470&&y>=158&&y<=224;
    if(!board&&!desk)return false;
    const anchor=board?{x:348,y:145}:{x:375,y:198};
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,anchor.x,anchor.y)>43){
      this.route=this.findRoute({x:this.player.x,y:this.player.y},anchor);
      this.stationTarget=board?'board':'desk';
      this.say('Walking to '+(board?'training board':'reception computer')+'.');
      return true;
    }
    this.stationTarget=null;
    if(board)this.openTrainingBoard();else this.openGymUpgrades();
    return true;
  }
  private useNearbyStation():boolean {
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,375,198)<48){this.openGymUpgrades();return true;}
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,348,145)<48){this.openTrainingBoard();return true;}
    return false;
  }
  private menuShell(title:string,subtitle:string,back:()=>void):void {
    this.furniturePanel.removeAll(true);
    const p=this.furniturePanel;
    p.add(this.add.rectangle(67,24,346,222,0x152b30).setOrigin(0).setStrokeStyle(2,0xc7a579));
    p.add(this.add.rectangle(71,28,338,34,0x29494c).setOrigin(0));
    p.add(this.add.text(83,34,title,{fontFamily:UI_FONT,fontSize:'15px',fontStyle:'bold',color:'#fff1d5'}));
    p.add(this.add.text(83,52,subtitle,{fontFamily:UI_FONT,fontSize:'8px',color:'#a8c9c4'}));
    const close=this.add.text(381,35,'X',{fontFamily:UI_FONT,fontSize:'13px',color:'#ffffff',backgroundColor:'#a34b40',padding:{x:5,y:2}}).setInteractive({useHandCursor:true});
    close.on('pointerdown',()=>p.setVisible(false));p.add(close);
    const backBtn=this.add.text(84,225,'< BACK',{fontFamily:UI_FONT,fontSize:'10px',color:'#f4d68c'}).setInteractive({useHandCursor:true});
    backBtn.on('pointerdown',back);p.add(backBtn);
    p.setVisible(true);
  }
  private menuAction(label:string,x:number,y:number,w:number,fn:()=>void,muted=false):void {
    const p=this.furniturePanel;
    const rect=this.add.rectangle(x,y,w,29,muted?0x365254:0x355b5d).setOrigin(0).setStrokeStyle(1,0x6f9590).setInteractive({useHandCursor:true});
    const labelText=this.add.text(x+9,y+7,label,{fontFamily:UI_FONT,fontSize:'10px',color:muted?'#b7c3bc':'#fff0d3'});
    rect.on('pointerover',()=>rect.setFillStyle(0x527776));
    rect.on('pointerout',()=>rect.setFillStyle(muted?0x365254:0x355b5d));
    rect.on('pointerdown',fn);p.add([rect,labelText]);
  }
  private openTrainingBoard():void {
    if(this.running)return;
    this.menuShell('TRAINING BOARD','CLASSES  /  PRACTICE  /  STUDENTS',()=>this.furniturePanel.setVisible(false));
    this.menuAction('SCHEDULE CLASSES',84,74,149,()=>this.openClassSchedule());
    this.menuAction('STUDENT GOALS',245,74,149,()=>this.showStudentGoals());
    const games:[string,TrainingMode][]=[
      ['CLASS RUSH','Rush'],['PAD WORK','Rhythm'],['BAG WORK','Memory'],
      ['DEFENSE','Defense'],['SPARRING','Competition'],['AGILITY','Conditioning']
    ];
    games.forEach(([name,mode],i)=>this.menuAction(name,84+(i%2)*161,114+Math.floor(i/2)*34,149,()=>this.openArcade(mode),this.saveData.playedActivities?.[mode]===this.saveData.day));
  }
  private makeCharacter(x:number,y:number,shirt:number,skin:number,hair:number,shorts:number,owner:boolean):Phaser.GameObjects.Container {
    const parts: Phaser.GameObjects.GameObject[] = [];
    // Pixel-art silhouette, 2px highlights and strong outlines at the feet anchor.
    const rect=(px:number,py:number,w:number,h:number,color:number) => {
      parts.push(this.add.rectangle(px,py,w,h,color).setStrokeStyle(1,0x283137));
    };
    parts.push(this.add.ellipse(0,14,23,6,0x193b3c,0.3));
    rect(-5,13,6,7,skin); rect(5,13,6,7,skin);
    rect(-5,17,9,3,0x35454b);rect(5,17,9,3,0x35454b);
    rect(0,5,21,14,shorts);
    rect(0,1,18,2,0xd5b98c);
    rect(-12,-5,6,15,skin); rect(12,-5,6,15,skin);
    rect(0,-5,21,19,shirt);
    rect(-5,-10,7,2,owner?0x69747b:0xd5b98c);
    rect(7,-2,3,12,0x263b3c);
    rect(0,-21,22,19,skin);
    rect(-5,-22,3,3,0xf4d3b0);
    rect(5,-22,3,3,0xf4d3b0);
    rect(0,-30,23,8,hair);
    rect(-8,-32,7,3,hair);
    rect(5,-34,10,3,hair);
    rect(-8,-25,6,10,hair);
    if(owner) {
      rect(0,-27,24,4,0xc82f31);
      rect(0,-5,8,8,0xc97c36);
      rect(-6,5,5,3,0xd6b36e); rect(6,5,5,3,0xd6b36e);
    } else {
      rect(-5,-21,2,2,0x302a2a); rect(5,-21,2,2,0x302a2a);
    }
    return this.add.container(x,y,parts).setDepth(10+y/100);
  }
  private addButton(x:number,y:number,w:number,h:number,label:string,fn:()=>void):Phaser.GameObjects.Text {
    const b=this.add.rectangle(x,y,w,h,0x294f52).setOrigin(0,1).setStrokeStyle(1,0xd5b786).setInteractive();
    const t=this.add.text(x+w/2,y-h/2,label,{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}).setOrigin(0.5).setInteractive();
    b.on('pointerdown',()=>{playGymCue('tap');fn();}); t.on('pointerdown',()=>{playGymCue('tap');fn();});
    return t;
  }
  private makeActionControl(x:number,y:number,label:string,fn:()=>void):Phaser.GameObjects.Container {
    const bg=this.add.rectangle(0,0,69,18,0x294f52).setOrigin(0).setStrokeStyle(1,0xd5b786).setInteractive();
    const t=this.add.text(34,9,label,{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}).setOrigin(0.5).setInteractive();
    bg.on('pointerdown',()=>{playGymCue('tap');fn();});t.on('pointerdown',fn);
    return this.add.container(x,y,[bg,t]).setDepth(25);
  }
  private persist():void {
    this.saveData.friendships=this.students.map(s=>s.friendship);
    this.saveData.skills=this.students.map(s=>s.skill);
    try { localStorage.setItem(SAVE_KEY,JSON.stringify(this.saveData)); } catch { this.say('Storage unavailable. Progress will not persist.'); }
  }
  private dailyStatus!:Phaser.GameObjects.Text;
  private gatheringNodes:Phaser.GameObjects.Container[]=[];
  private placingGear=-1;
  private refresh():void {
    this.status.setText('DAY '+this.saveData.day+'  $'+this.saveData.money+'  REP '+this.saveData.reputation);
    const level=this.saveData.equipment||0;
    this.equipmentLabel.setText('GEAR '+level+'/3 | '+(level===3?'MAXED':'$'+(40+level*35)));
    const decor=this.saveData.decorLevel||0;
    this.shopLabel.setText('DECOR '+decor+'/3 '+(decor===3?'MAX':'$'+(25+decor*25)));
    this.drawEquipment();
    this.drawGatheringNodes();
    this.dailyStatus.setText('G '+(['Rush','Rhythm','Memory','Defense','Competition','Conditioning'] as TrainingMode[]).filter(m=>this.saveData.playedActivities?.[m]===this.saveData.day).length+'/2  C '+(this.saveData.classesToday||0)+'/2');
  }
  private drawEquipment():void {
    this.decor.clear();
    this.worldFixtures.forEach(g=>g.destroy());this.worldFixtures=[];
    const layer=(y:number):void=>{
      const g=this.add.graphics().setDepth(10+y/100-0.05);
      this.worldFixtures.push(g);this.decor=g;
    };
    (this.saveData.furniture||[]).forEach((item,i)=>{
      if(!item.stored)layer(item.y);
      if(item.stored) return;
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
      layer(101);
      this.decor.fillStyle(0x8e3834).fillRoundedRect(302,63,13,38,3);
      this.decor.fillStyle(0x242a2b).fillRect(305,60,7,4);
      this.decor.lineStyle(1,0xd5b88a).lineBetween(308,53,308,60);
    }
    if(level>=2) {
      layer(154);
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
      layer(y);
      // Distinct, readable pixel silhouettes instead of eight identical boxes.
      const g=this.decor;
      g.fillStyle(0x203b42,0.28).fillEllipse(x,y+5,28,9);
      if(i===0){ // Heavy bag
        g.fillStyle(0x2c3335).fillRect(x-2,y-25,4,8);
        g.fillStyle(0xa04a40).fillRoundedRect(x-9,y-19,18,28,4);
        g.fillStyle(0xd0a777).fillRect(x-9,y-15,18,3);
        g.fillStyle(0x733b35).fillRect(x-8,y+3,16,3);
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
    this.decor=this.add.graphics().setDepth(1);
    this.worldFixtures.push(this.decor);
  }
  private openGymUpgrades():void {
    if(this.running)return;
    this.menuShell('RECEPTION COMPUTER','GYM MANAGEMENT  /  DAY '+this.saveData.day,()=>this.furniturePanel.setVisible(false));
    const actions:[string,()=>void][]=[
      ['TRAINING GEAR',()=>this.openGearShop()],
      ['DECORATIONS',()=>this.openUpgradePurchase('decor')],
      ['FURNITURE SHOP',()=>this.openFurniture('shop')],
      ['BUILD / ARRANGE',()=>this.openFurniture('build')],
      ['INVENTORY / SELL',()=>this.openFurniture('inventory')],
      ['MATERIALS / CRAFT',()=>this.openMaterials()],
      ['STUDENT ROSTER',()=>{this.furniturePanel.setVisible(false);this.time.delayedCall(1,()=>{this.rosterPanel.setDepth(80);this.toggleRoster();});}],
      ['NEXT DAY',()=>{this.furniturePanel.setVisible(false);this.nextDay();}]
    ];
    actions.forEach(([label,fn],i)=>this.menuAction(label,84+(i%2)*161,77+Math.floor(i/2)*36,149,fn));
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
      const line=this.add.text(84+(i%2)*161,77+Math.floor(i/2)*36,gear.name+'  '+(owned?'[MOVE]':'$'+gear.cost),{fontFamily:UI_FONT,fontSize:'9px',color:owned?'#8ec4a8':'#ffffff',backgroundColor:'#34575b',padding:{x:5,y:6}}).setInteractive({useHandCursor:true});
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
        this.say('Purchased '+gear.name+'! Stored in inventory. Press M to place it.');
      });this.furniturePanel.add(line);
    });
    this.addShopInventory(203);
    this.furniturePanel.setVisible(true);
  }
  private beginGearPlacement(index:number):void {
    this.placingGear=index;
    this.selectedFurniture=-1;this.placingDecor=-1;this.buildMode=true;
    const pos=this.saveData.gearPositions?.[index];this.placementCursor=pos&&!this.saveData.gearStored?.[index]?{...pos}:{x:168,y:144};this.keyboardPlacement=true;
    this.furniturePanel.setVisible(false);
    this.drawEquipment();
    this.say('Placing '+GEAR_ITEMS[index].name+': click an open spot on the mat.');
  }
  private placeGear(x:number,y:number):void {
    if(this.placingGear<0)return;
    if(!this.validPlacement(x,y,12,11,this.placingGear,-1)){this.say('Choose a clear spot inside the mat.');return;}
    if(this.students.some(s=>Phaser.Math.Distance.Between(s.x,s.y,x,y)<25)||Phaser.Math.Distance.Between(this.player.x,this.player.y,x,y)<25){this.say('Choose a spot away from people.');return;}
    const occupied=(this.saveData.gearPositions||[]).some((p,i)=>i!==this.placingGear&&this.saveData.ownedGear?.[i]&&Phaser.Math.Distance.Between(p.x,p.y,x,y)<24);
    if(occupied||!this.canPlace(x,y,12,11,this.placingGear)){this.say('Too close to another object.');return;}
    if(!this.saveData.gearPositions)this.saveData.gearPositions=Array.from({length:8},(_,i)=>({x:65+(i%4)*57,y:i<4?80:180}));
    this.saveData.gearPositions[this.placingGear]={x:Math.round(x/6)*6,y:Math.round(y/6)*6};
    const name=GEAR_ITEMS[this.placingGear].name;
    if(!this.saveData.gearStored)this.saveData.gearStored=Array(8).fill(false);
    this.saveData.gearStored[this.placingGear]=false;
    this.placingGear=-1;this.keyboardPlacement=false;this.persist();this.refresh();
    this.say(name+' placed. Open Training Equipment to move it again.');
  }
  private openMaterials():void {
    this.menuShell('MATERIALS & CRAFT','GATHER  /  CONVERT  /  EARN',()=>this.openGymUpgrades());
    this.furniturePanel.add(this.add.text(84,76,MATERIAL_NAMES.map((name,i)=>name+': '+(this.saveData.materials?.[i]||0)).join('   '),{fontFamily:UI_FONT,fontSize:'10px',color:'#f4d68c'}));
    const recipes=[{name:'Gym Supplies',cost:[3,1,0],reward:25},{name:'Salvage Bundle',cost:[2,2,2],reward:60}];
    recipes.forEach((recipe,i)=>{
      const label=recipe.name+'  ('+recipe.cost.map((v,j)=>v+' '+MATERIAL_NAMES[j]).join(', ')+')';
      const item=this.add.text(84,108+i*47,label,{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff',backgroundColor:'#34575b',padding:{x:6,y:6},wordWrap:{width:302}}).setInteractive();
      item.on('pointerdown',()=>{
        const stock=this.saveData.materials||[0,0,0];
        if(recipe.cost.some((amount,j)=>stock[j]<amount)){this.say('Gather more materials to craft this.');return;}
        recipe.cost.forEach((amount,j)=>stock[j]-=amount);
        this.saveData.materials=stock;this.saveData.money+=recipe.reward;
        this.persist();this.refresh();this.openMaterials();this.say('Crafted '+recipe.name+' and earned USD '+recipe.reward+'.');
      });this.furniturePanel.add(item);
    });
    this.furniturePanel.setVisible(true);
  }
  // Deterministic daily material locations. No real-time timers or mandatory cleanup.
  private gatheringPositions:Point[]=Array.from({length:12},(_,i)=>({x:49+(i%6)*46,y:i<6?92:183}));
  private resourceKind(index:number):number {return (index+this.saveData.day)%3;}
  private resourceYield(index:number):number {return (index+this.saveData.day)%5===0?2:1;}
  private drawGatheringNodes():void {
    this.gatheringNodes.forEach(node=>node.destroy());this.gatheringNodes=[];
    this.gatheringPositions.forEach((pos,i)=>{
      if(this.saveData.gatheredToday?.includes(i))return;
      const g=this.add.graphics();
      g.fillStyle([0xa8a6a0,0xa27851,0xc3a58a][this.resourceKind(i)]).fillRoundedRect(-6,-5,12,10,2);
      g.lineStyle(1,0xf4e6c7).strokeRect(-5,-4,10,8);
      const node=this.add.container(pos.x,pos.y,[g]).setDepth(6);
      this.gatheringNodes.push(node);
    });
  }
  private collectNodeAt(x:number,y:number):boolean {
    const i=this.gatheringPositions.findIndex((p,index)=>!this.saveData.gatheredToday?.includes(index)&&Phaser.Math.Distance.Between(p.x,p.y,x,y)<13);
    if(i<0)return false;
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,x,y)>55){this.say('Walk closer and press E to collect.');this.route=this.findRoute({x:this.player.x,y:this.player.y},{x,y});return true;}
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
  private openClassSchedule():void {
    const count=this.saveData.classesToday||0;
    this.menuShell('CLASS SCHEDULE',count+'/2 CLASSES TAUGHT TODAY',()=>this.openTrainingBoard());
    CLASS_PROGRAMS.forEach((program,i)=>{
      const label=program.name+'  ('+program.stats.map(k=>CORE_STATS[k]).join(' + ')+')';
      this.menuAction(label,84,76+i*36,310,()=>this.simulateClass(i),count>=2);
    });
    this.furniturePanel.setVisible(true);
  }
  private simulateClass(index:number):void {
    if((this.saveData.classesToday||0)>=2){this.say('Two classes already taught today.');return;}
    const program=CLASS_PROGRAMS[index];
    if(!program)return;
    if(!this.saveData.studentStats)this.saveData.studentStats=initialStats();
    if(!this.saveData.studentXP)this.saveData.studentXP=initialXP();
    for(let student=0;student<4;student++){
      for(const stat of program.stats){
        const matching=GEAR_ITEMS.filter((item,i)=>item.stat===stat&&this.saveData.ownedGear?.[i]).length;
        const gearBonus=matching>0?5:0;
        let xp=(this.saveData.studentXP[student][stat]||0)+10+gearBonus;
        let value=this.saveData.studentStats[student][stat]||10;
        while(value<100 && xp>=statThreshold(value)){xp-=statThreshold(value);value++;}
        this.saveData.studentStats[student][stat]=value;
        this.saveData.studentXP[student][stat]=value>=100?0:xp;
      }
    }
    this.checkStudentGoals();
    this.saveData.classesToday=(this.saveData.classesToday||0)+1;
    this.saveData.classesTaught=(this.saveData.classesTaught||0)+1;
    this.saveData.money+=15;
    this.persist();this.refresh();this.say(program.name+' completed: all students earned training XP.');
    this.openClassSchedule();
  }
  private checkStudentGoals():void {
    if(!this.saveData.studentGoals)this.saveData.studentGoals=initialGoals();
    if(!this.saveData.completedGoals)this.saveData.completedGoals=[0,0,0,0];
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
    this.menuShell('STUDENT GOALS','TRAINING PROGRESS  /  MILESTONES',()=>this.openTrainingBoard());
    this.students.forEach((student,i)=>{
      const goal=(this.saveData.studentGoals||initialGoals())[i];
      const current=this.saveData.studentStats?.[i]?.[goal[1]]||10;
      this.furniturePanel.add(this.add.text(84,80+i*34,student.name+'  '+CORE_STATS[goal[1]]+' '+current+'/'+goal[0]+'  |  Completed '+(this.saveData.completedGoals?.[i]||0),{fontFamily:UI_FONT,fontSize:'11px',color:'#ffffff'}));
    });
    this.furniturePanel.setVisible(true);
  }
  private openUpgradePurchase(kind:'equipment'|'decor'):void {
    const level=kind==='equipment'?(this.saveData.equipment||0):(this.saveData.decorLevel||0);
    const names=kind==='equipment'?['Heavy bag','Weight station','Training rack']:['Gym banner','Training poster','Indoor plant'];
    const cost=kind==='equipment'?40+level*35:25+level*25;
    this.furniturePanel.removeAll(true);
    this.furniturePanel.add(this.add.rectangle(32,24,292,228,0x203d40).setOrigin(0).setStrokeStyle(2,0xd4b783));
    this.furniturePanel.add(this.add.text(44,41,kind==='equipment'?'TRAINING EQUIPMENT':'GYM DECORATIONS',{fontFamily:UI_FONT,fontSize:'13px',color:'#ffffff'}));
    const close=this.add.text(381,37,'X',{fontFamily:UI_FONT,fontSize:'13px',color:'#ffffff',backgroundColor:'#a34b40',padding:{x:4,y:2}}).setInteractive();
    close.on('pointerdown',()=>this.openGymUpgrades());this.furniturePanel.add(close);
    const details=level>=3?'All upgrades purchased.':'Next: '+names[level]+'  |  USD '+cost+' + '+materialCost(DECOR_MATERIALS[level]);
    this.furniturePanel.add(this.add.text(46,78,details,{fontFamily:UI_FONT,fontSize:'11px',color:'#f7e9cb'}));
    this.furniturePanel.add(this.add.text(46,109,kind==='equipment'?'Adds equipment to the gym and boosts class pay.':'Adds a visible decoration you can move in Build.',{fontFamily:UI_FONT,fontSize:'10px',color:'#e1d4bb',wordWrap:{width:255}}));
    if(level<3){
      const buy=this.add.text(46,160,'BUY '+names[level].toUpperCase(),{fontFamily:UI_FONT,fontSize:'12px',color:'#ffffff',backgroundColor:'#34575b',padding:{x:8,y:5}}).setInteractive();
      buy.on('pointerdown',()=>{if(kind==='equipment')this.upgradeEquipment();else this.buyDecor();this.openUpgradePurchase(kind);});
      this.furniturePanel.add(buy);
    }
    this.addShopInventory(226);
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
    this.furnitureMode=mode;
    this.furniturePanel.removeAll(true);
    const bg=this.add.rectangle(67,24,346,222,0x203d40).setOrigin(0).setStrokeStyle(2,0xd4b783);
    this.furniturePanel.add(bg);
    const heading=this.add.text(83,37,mode==='shop'?'FURNITURE SHOP':mode==='build'?'BUILD MODE':'YOUR INVENTORY',{fontFamily:UI_FONT,fontSize:'12px',fontStyle:'bold',color:'#ffffff'});
    this.furniturePanel.add(heading);
    const close=this.add.text(381,37,'X',{fontFamily:UI_FONT,fontSize:'13px',color:'#ffffff',backgroundColor:'#a34b40',padding:{x:4,y:2}}).setInteractive();
    close.on('pointerdown',()=>this.furniturePanel.setVisible(false));
    this.furniturePanel.add(close);
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
          this.furniturePanel.setVisible(false);this.say('Move with arrows, Enter to place, Esc to cancel.');
        }});
      }
      const pageSize=5,pages=Math.max(1,Math.ceil(entries.length/pageSize));
      this.buildPage=Math.min(this.buildPage,pages-1);
      this.furniturePanel.add(this.add.text(84,60,'CLICK TO MOVE  |  M BUILD  |  ESC CLOSE',{fontFamily:UI_FONT,fontSize:'9px',color:'#b8d2ca'}));
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
    if(mode==='shop')this.addShopInventory(228);
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
    this.say('Purchased '+item.name+'! Stored in inventory. Press M to enter Build Mode and place it.');
  }
  private selectFurniture(i:number):void {
    this.selectedFurniture=i;this.placingDecor=-1;this.placingGear=-1;this.buildMode=true;this.furniturePanel.setVisible(false);
    const position=this.saveData.furniture?.[i];if(position)this.placementCursor={x:position.stored?168:position.x,y:position.stored?144:position.y};this.keyboardPlacement=true;
    this.updateFurnitureActions();this.drawEquipment();
    const item=this.saveData.furniture?.[i];
    if(item) this.say('Moving '+FURNITURE[item.kind].name+'. Arrows move, Enter place, Q rotate, X store, Esc cancel.');
  }
  private updateFurnitureActions():void {
    const visible=this.selectedFurniture>=0;
    this.rotateControl.setVisible(visible);
    this.storeControl.setVisible(visible);
  }
  private placeFurniture(x:number,y:number):void {
    if(this.running||this.selectedFurniture<0) return;
    const selected=this.saveData.furniture?.[this.selectedFurniture];if(!selected)return;
    const size=this.furnitureSize(selected);
    if(!this.validPlacement(x,y,size.rx,size.ry,-1,this.selectedFurniture)){this.say('Choose a clear spot inside the mat.');return;}
    if(this.students.some(s=>Phaser.Math.Distance.Between(s.x,s.y,x,y)<32)||Phaser.Math.Distance.Between(this.player.x,this.player.y,x,y)<32) {this.say('Choose a spot away from people.');return;}
    const items=this.saveData.furniture||[];
    if(!this.canPlace(x,y,size.rx,size.ry,-1,this.selectedFurniture)) {this.say('Too close to another item.');return;}
    const item=items[this.selectedFurniture];if(!item)return;
    item.x=Math.round(x/6)*6;item.y=Math.round(y/6)*6;item.stored=false;
    this.selectedFurniture=-1;this.keyboardPlacement=false;this.updateFurnitureActions();
    this.persist();this.drawEquipment();this.say(FURNITURE[item.kind].name+' placed! Click another item or press M for inventory.');
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
    if(!this.canPlace(x,y,this.placingDecor===2?12:25,12)||positions.some((p,i)=>i!==this.placingDecor && i<(this.saveData.decorLevel||0) && Phaser.Math.Distance.Between(p.x,p.y,x,y)<44)) {
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
    if(this.saveData.money<cost) { this.say('Need USD '+cost+' to decorate.'); return; }
    if(!hasMaterials(this.saveData.materials,DECOR_MATERIALS[level])){this.say('Need '+materialCost(DECOR_MATERIALS[level])+' to decorate.');return;}
    this.saveData.materials=spendMaterials(this.saveData.materials,DECOR_MATERIALS[level]);
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
      return s.name+'  |  '+rank+'\n  '+(this.saveData.studentStats?.[this.students.indexOf(s)]||[10,10,10,10]).map((v,i)=>CORE_STATS[i].slice(0,3)+' '+v).join('  ')+'\n  Bond '+s.friendship;
    });
    this.rosterText.setText('STUDENT ROSTER  (tap to close)\n\n'+lines.join('\n\n'));
    this.rosterPanel.setVisible(!this.rosterPanel.visible);
  }
  private showStudentCard(student:Student):void {
    const rank=student.skill>=10?'Advanced':student.skill>=5?'Intermediate':'Beginner';
    this.studentCard.setText(student.name+' | '+rank+' | Skill '+student.skill+' | Bond '+student.friendship).setVisible(true);
    this.time.delayedCall(2800,()=>this.studentCard.setVisible(false));
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
    if(nearest.ai){nearest.ai.route=[];nearest.ai.target={x:nearest.x,y:nearest.y};nearest.ai.timer=6;}
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
  private openArcade(mode:TrainingMode):void {
    if(this.running) return;
    if(this.saveData.playedActivities?.[mode]===this.saveData.day) {this.say('Already played today. Close gym for a new day.');return;}
    if(Object.values(this.saveData.playedActivities||{}).filter(day=>day===this.saveData.day).length>=2){this.say('Two minigames already played today.');return;}
    this.persist();
    this.scene.start('Briefing',{mode});
  }
  private startClass():void {
    if(this.running || this.saveData.completed) { this.say('Class already started or completed.'); return; }
    this.persist(); this.scene.start('Briefing',{mode:'Rush'}); return;
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
    this.saveData.day++;
    this.students.forEach((student,i)=>{if(student.ai){student.ai.timer=0.5+i;student.ai.route=[];student.ai.socialCooldown=5+i*4;}});
    this.saveData.classesToday=0;
    this.saveData.gatheredToday=[];
    this.saveData.completed=false;
    this.say('New day! Twelve material pickups have respawned. Gather whenever you like.');
    this.persist(); this.refresh();
    this.timer.setText('');
  }
  private reset():void {
    this.saveData={...defaults,friendships:[0,0,0,0],skills:[0,0,0,0],studentStats:initialStats(),studentXP:initialXP(),studentGoals:initialGoals(),completedGoals:[0,0,0,0],gearPositions:Array.from({length:8},(_,i)=>({x:65+(i%4)*57,y:i<4?80:180})),classesToday:0,ownedGear:Array(8).fill(false),materials:[0,0,0],gatheredToday:[]};
    this.running=false; this.placingDecor=-1; this.selectedFurniture=-1; this.updateFurnitureActions(); this.buildButtonText.setText('BUILD'); this.buildHint.setText('Build mode: click BUILD to arrange your decorations'); this.classOverlay.clear(); this.modeLabel.setText('GYM HUB'); this.requests=[]; this.pendingRequests=[]; this.targetStudent=null; this.updateIndicators(); this.persist();
    this.scene.restart();
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
  private validPlacement(x:number,y:number,rx:number,ry:number,excludeGear=-1,excludeFurniture=-1):boolean {
    // Check the full footprint, including margins, rather than only its center.
    if(x-rx<38||x+rx>309||y-ry<84||y+ry>204)return false;
    if(!this.canPlace(x,y,rx,ry,excludeGear,excludeFurniture))return false;
    if(this.students.some(s=>Math.abs(s.x-x)<rx+11&&Math.abs(s.y-y)<ry+8))return false;
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
    if(this.running)return;
    if(this.furniturePanel.visible){this.furniturePanel.setVisible(false);this.buildMode=true;return;}
    if(this.isPlacing()||this.buildMode){this.openFurniture('build');return;}
    this.buildMode=true;this.say('Build Mode: click an item to move it, or press M for inventory.');
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
    const pointer=this.input.activePointer,x=this.keyboardPlacement?this.placementCursor.x:Math.round(pointer.worldX/6)*6,y=this.keyboardPlacement?this.placementCursor.y:Math.round(pointer.worldY/6)*6;
    let rx=12,ry=11,valid=false;
    if(this.selectedFurniture>=0){
      const item=this.saveData.furniture?.[this.selectedFurniture];
      if(!item)return;
      ({rx,ry}=this.furnitureSize(item));
      valid=this.validPlacement(x,y,rx,ry,-1,this.selectedFurniture);
    }else if(this.placingGear>=0){
      valid=this.validPlacement(x,y,rx,ry,this.placingGear);
    }else{
      rx=this.placingDecor===2?12:25;ry=12;
      valid=this.validPlacement(x,y,rx,ry);
    }
    const color=valid?0x83d7ac:0xe57770;
    g.fillStyle(color,0.24).fillRect(x-rx,y-ry,rx*2,ry*2);
    g.lineStyle(1,color,0.95).strokeRect(x-rx,y-ry,rx*2,ry*2);
    this.placementHint.setText((valid?'READY':'BLOCKED')+'  ARROWS MOVE  ENTER PLACE  Q ROTATE  ESC CANCEL').setVisible(true);
  }
  private solidFootprints(excludeGear=-1,excludeFurniture=-1):{x:number;y:number;rx:number;ry:number}[] {
    const solids:{x:number;y:number;rx:number;ry:number}[]=[];
    (this.saveData.furniture||[]).forEach((item,i)=>{
      if(item.stored||i===excludeFurniture)return;
      const {rx,ry}=this.furnitureSize(item);
      solids.push({x:item.x,y:item.y,rx,ry});
    });
    const gearBounds:[number,number][]=[[9,12],[13,10],[8,11],[12,8],[14,10],[14,10],[13,13],[13,12]];
    (this.saveData.ownedGear||[]).forEach((owned,i)=>{
      if(!owned||this.saveData.gearStored?.[i]||i===excludeGear)return;
      const pos=this.saveData.gearPositions?.[i]||{x:65+(i%4)*57,y:i<4?80:180};
      const [rx,ry]=gearBounds[i]||[12,11];
      solids.push({x:pos.x,y:pos.y,rx,ry});
    });
    const level=this.saveData.decorLevel||0;
    (this.saveData.decorPositions||defaults.decorPositions!).slice(0,level).forEach((p,i)=>{
      // Wall banners and posters are flat; only the floor plant blocks walking.
      if(i===2)solids.push({x:p.x,y:p.y,rx:11,ry:12});
    });
    if((this.saveData.equipment||0)>=1)solids.push({x:308,y:82,rx:9,ry:13});
    if((this.saveData.equipment||0)>=2)solids.push({x:310,y:150,rx:15,ry:9});
    return solids;
  }
  private canStand(x:number,y:number,excludeGear=-1,excludeFurniture=-1):boolean {
    if(!walkable(x,y))return false;
    return !this.solidFootprints(excludeGear,excludeFurniture).some(o=>
      Math.abs(x-o.x)<o.rx+6&&Math.abs(y-o.y)<o.ry+4);
  }
  private canPlace(x:number,y:number,rx:number,ry:number,excludeGear=-1,excludeFurniture=-1):boolean {
    return !this.solidFootprints(excludeGear,excludeFurniture).some(o=>
      Math.abs(x-o.x)<o.rx+rx+3&&Math.abs(y-o.y)<o.ry+ry+3);
  }
  private findRoute(start:Point,end:Point):Point[] {
    // Eight-way A* on a 6px navigation grid, using the same collision check as manual movement.
    const cols=Math.ceil(W/CELL),rows=Math.ceil(H/CELL);
    const key=(x:number,y:number)=>y*cols+x;
    const cell=(p:Point)=>({x:Phaser.Math.Clamp(Math.round((p.x-CELL/2)/CELL),0,cols-1),y:Phaser.Math.Clamp(Math.round((p.y-CELL/2)/CELL),0,rows-1)});
    const startCell=cell(start),goal=cell(end);
    const valid=(x:number,y:number)=>x>=0&&x<cols&&y>=0&&y<rows&&this.canStand(x*CELL+CELL/2,y*CELL+CELL/2);
    if(!valid(startCell.x,startCell.y)) {
      // Old saves can contain objects overlapping the coach. Do not lock movement permanently.
      const nearest=this.nearestWalkable(start);
      if(!nearest)return [];
      startCell.x=nearest.x;startCell.y=nearest.y;
    }
    if(!valid(goal.x,goal.y)){
      const nearest=this.nearestWalkable(end);
      if(!nearest)return [];
      goal.x=nearest.x;goal.y=nearest.y;
    }
    const heuristic=(x:number,y:number)=>Math.hypot(goal.x-x,goal.y-y);
    const origin=key(startCell.x,startCell.y),dest=key(goal.x,goal.y);
    const open=[origin],closed=new Set<number>(),gScore=new Map<number,number>([[origin,0]]);
    const cameFrom=new Map<number,number>();
    const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    while(open.length){
      let best=0,bestScore=Infinity;
      for(let i=0;i<open.length;i++){
        const id=open[i],score=(gScore.get(id)??Infinity)+heuristic(id%cols,Math.floor(id/cols));
        if(score<bestScore){best=i;bestScore=score;}
      }
      const current=open.splice(best,1)[0];
      if(current===dest)break;
      closed.add(current);
      const cx=current%cols,cy=Math.floor(current/cols);
      for(const [dx,dy] of dirs){
        const x=cx+dx,y=cy+dy,id=key(x,y);
        if(!valid(x,y)||closed.has(id))continue;
        if(dx&&dy&&(!valid(cx+dx,cy)||!valid(cx,cy+dy)))continue; // No corner clipping.
        const tentative=(gScore.get(current)??Infinity)+Math.hypot(dx,dy);
        if(tentative>=(gScore.get(id)??Infinity))continue;
        cameFrom.set(id,current);gScore.set(id,tentative);
        if(!open.includes(id))open.push(id);
      }
    }
    if(origin!==dest&&!cameFrom.has(dest))return [];
    const path:Point[]=[];let current=dest;
    while(current!==origin){
      path.unshift({x:(current%cols)*CELL+CELL/2,y:Math.floor(current/cols)*CELL+CELL/2});
      const parent=cameFrom.get(current);
      if(parent===undefined)return [];
      current=parent;
    }
    // Remove unnecessary waypoints only if the entire segment is walkable.
    const simplified:Point[]=[];
    let anchor=start;
    for(let i=0;i<path.length;i++){
      const next=path[i+1];
      if(next&&this.clearWalkSegment(anchor,next))continue;
      simplified.push(path[i]);anchor=path[i];
    }
    if(this.canStand(end.x,end.y)&&this.clearWalkSegment(anchor,end))simplified.push(end);
    return simplified;
  }
  private nearestWalkable(p:Point):{x:number;y:number}|null {
    const cols=Math.ceil(W/CELL),rows=Math.ceil(H/CELL);
    let nearest:null|{x:number;y:number}=null,best=Infinity;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const px=x*CELL+CELL/2,py=y*CELL+CELL/2;
      if(!this.canStand(px,py))continue;
      const distance=(px-p.x)**2+(py-p.y)**2;
      if(distance<best){best=distance;nearest={x,y};}
    }
    return nearest;
  }
  private clearWalkSegment(a:Point,b:Point):boolean {
    const steps=Math.ceil(Phaser.Math.Distance.Between(a.x,a.y,b.x,b.y)/3);
    for(let i=1;i<=steps;i++){
      const t=i/Math.max(steps,1);
      if(!this.canStand(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;
    }
    return true;
  }
  private studentSocialMoment(s:Student,i:number):void {
    const partner=this.students[(i+1)%this.students.length];
    const nearby=Phaser.Math.Distance.Between(s.x,s.y,partner.x,partner.y)<65;
    const dialogue=[
      ['Frank: One more round!','Frank: Nice combination!'],
      ['Radish: Water break?','Radish: Looking sharp!'],
      ['Marshall: Working on my footwork.','Marshall: Let us drill that.'],
      ['Pudge: I needed that stretch.','Pudge: Good session today.']
    ];
    const ai=s.ai;if(!ai)return;
    if(nearby&&ai.activity===4){
      s.activityTag?.setText('CHATTING').setVisible(true);
      partner.activityTag?.setText('LISTENING').setVisible(true);
      if(Math.random()<0.3)this.say(dialogue[i][(this.saveData.day+i)%2]);
    }
  }
  private animateStudent(s:Student,moving:boolean):void {
    const ai=s.ai,body=s.body;if(!ai||!body)return;
    // Animate actual sprite parts rather than scaling the entire character.
    // makeCharacter inserts shadow, legs, shoes, shorts, waist, arms in this order.
    const parts=body.list as Phaser.GameObjects.GameObject[];
    const leftLeg=parts[1] as Phaser.GameObjects.Rectangle;
    const rightLeg=parts[2] as Phaser.GameObjects.Rectangle;
    const leftArm=parts[6] as Phaser.GameObjects.Rectangle;
    const rightArm=parts[7] as Phaser.GameObjects.Rectangle;
    const swing=Math.sin(ai.phase);
    leftLeg.y=13+(moving?swing*2:0);
    rightLeg.y=13-(moving?swing*2:0);
    if(moving){
      leftArm.y=-5-swing*3;rightArm.y=-5+swing*3;
      leftArm.angle=swing*15;rightArm.angle=-swing*15;
    }else if(ai.activity===0||ai.activity===1){
      // Shadowboxing and bag drills: alternating punches.
      leftArm.y=-12;rightArm.y=-12;
      leftArm.angle=30+swing*38;rightArm.angle=-30-swing*38;
    }else if(ai.activity===2){
      // Strength training: rhythmic presses.
      leftArm.y=-10-swing*5;rightArm.y=-10-swing*5;
      leftArm.angle=15;rightArm.angle=-15;
    }else if(ai.activity===3){
      // Stretching: arms reach outward.
      leftArm.y=-8;rightArm.y=-8;leftArm.angle=65;rightArm.angle=-65;
    }else{
      leftArm.y=-5;rightArm.y=-5;leftArm.angle=0;rightArm.angle=0;
    }
  }
  private updateStudentLife(delta:number):void {
    // Autonomous ambient behavior is cosmetic: it never changes saved stats or interrupts a class.
    if(this.running||this.isPlacing()||this.furniturePanel.visible||this.rosterPanel.visible){
      this.students.forEach(s=>{s.activityTag?.setVisible(false);if(s.ai){s.ai.activity=5;this.animateStudent(s,false);}});
      return;
    }
    const dt=Math.min(delta,70)/1000;
    const routines=['SHADOWBOX','BAG WORK','STRENGTH','STRETCH','SOCIAL','REST'];
    this.students.forEach((s,i)=>{
      const ai=s.ai;if(!ai||!s.body)return;
      ai.timer-=dt;
      if(ai.timer<=0){
        // Each student has a preferred discipline and a different daily rhythm.
        const preferred=[0,3,2,1][i];
        ai.activity=Math.random()<0.53?preferred:Math.floor(Math.random()*routines.length);
        const available=(this.saveData.ownedGear||[]).map((owned,j)=>owned&&!this.saveData.gearStored?.[j]?j:-1).filter(j=>j>=0);
        let goal:Point;
        if(ai.activity===1&&available.length){
          const gear=available[(i+this.saveData.day)%available.length];
          const p=this.saveData.gearPositions?.[gear]||{x:100,y:130};
          goal={x:p.x+24,y:p.y+14};
        }else if(ai.activity===4){
          const friend=this.students[(i+1)%this.students.length];
          goal={x:friend.x+22,y:friend.y};
        }else {
          goal={x:75+Math.floor(Math.random()*34)*6,y:94+Math.floor(Math.random()*16)*6};
        }
        if(this.canStand(goal.x,goal.y)&&this.students.every(other=>other===s||Phaser.Math.Distance.Between(goal.x,goal.y,other.x,other.y)>24)){
          ai.target=goal;
        }else ai.target={x:s.x,y:s.y};
        ai.route=this.findRoute({x:s.x,y:s.y},ai.target);
        ai.timer=7+Math.random()*9+i*0.6;
      }
      // Follow the same collision-aware A* routes as the player.
      let waypoint=ai.route[0];
      if(waypoint&&Phaser.Math.Distance.Between(s.x,s.y,waypoint.x,waypoint.y)<4){
        ai.route.shift();waypoint=ai.route[0];
      }
      const destination=waypoint||{x:s.x,y:s.y};
      const distance=Phaser.Math.Distance.Between(s.x,s.y,destination.x,destination.y);
      if(distance>1){
        const speed=17+i*1.2,step=Math.min(distance,speed*dt);
        const nx=s.x+(destination.x-s.x)/distance*step;
        const ny=s.y+(destination.y-s.y)/distance*step;
        if(this.canStand(nx,ny)&&this.students.every(other=>other===s||Phaser.Math.Distance.Between(nx,ny,other.x,other.y)>16)){
          s.x=nx;s.y=ny;
        }else {
          ai.route=[];ai.target={x:s.x,y:s.y};ai.timer=Math.min(ai.timer,2);
        }
      }
      ai.socialCooldown-=dt;
      if(ai.socialCooldown<=0){
        if(ai.activity===4)this.studentSocialMoment(s,i);
        ai.socialCooldown=15+i*3+Math.random()*6;
      }
      ai.phase+=dt*(ai.activity===0||ai.activity===1?11:5);
      s.body.setPosition(s.x,s.y).setDepth(10+s.y/100);
      this.animateStudent(s,distance>1);
      s.nameTag?.setPosition(s.x,s.y-36).setDepth(10+s.y/100+0.1);
      s.indicator?.setPosition(s.x,s.y-55);
      s.activityTag?.setPosition(s.x,s.y-49).setDepth(10+s.y/100+0.1).setVisible(ai.route.length===0).setText(routines[ai.activity]);
    });
  }
  update(_time:number,delta:number):void {
    this.updateStudentLife(delta);
    this.updatePlacementPreview();
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
    if(this.isPlacing()&&!this.furniturePanel.visible){this.player.setScale(1);return;}
    let dx=Number(this.cursors.right.isDown||this.wasd.D.isDown)-Number(this.cursors.left.isDown||this.wasd.A.isDown);
    let dy=Number(this.cursors.down.isDown||this.wasd.S.isDown)-Number(this.cursors.up.isDown||this.wasd.W.isDown);
    if(dx||dy) { this.route=[]; this.targetStudent=null;this.stationTarget=null; }
    else if(this.route.length) {
      const target=this.route[0];
      const distance=Phaser.Math.Distance.Between(this.player.x,this.player.y,target.x,target.y);
      if(distance<2) { this.route.shift(); if(!this.route.length && this.targetStudent) { const s=this.targetStudent; this.targetStudent=null; this.interact(s); } else if(!this.route.length&&this.stationTarget){const station=this.stationTarget;this.stationTarget=null;if(station==='board')this.openTrainingBoard();else this.openGymUpgrades();} return; }
      dx=(target.x-this.player.x)/distance; dy=(target.y-this.player.y)/distance;
    }
    this.player.setDepth(10+this.player.y/100);
    const length=Math.hypot(dx,dy);
    if(!length) { this.player.setScale(1); return; }
    this.player.setDepth(10+this.player.y/100);
    this.walkingClock+=delta;
    this.player.setScale(1,1+Math.sin(this.walkingClock/95)*0.035);
    const step=Math.min(delta,50)/1000*this.speed;
    const remaining=this.route.length?Phaser.Math.Distance.Between(this.player.x,this.player.y,this.route[0].x,this.route[0].y):step;
    const move=Math.min(step,remaining);
    const nx=this.player.x+dx/length*move,ny=this.player.y+dy/length*move;
    const beforeX=this.player.x,beforeY=this.player.y;
    if(this.canStand(nx,this.player.y)) this.player.x=nx;
    if(this.canStand(this.player.x,ny)) this.player.y=ny;
    if(this.route.length&&Phaser.Math.Distance.Between(beforeX,beforeY,this.player.x,this.player.y)<0.01){
      // A fixture moved into the route. Replan rather than vibrating against it.
      const destination=this.route[this.route.length-1];
      this.route=this.findRoute({x:this.player.x,y:this.player.y},destination);
      if(!this.route.length){this.stationTarget=null;this.targetStudent=null;this.say('Path blocked. Try another approach.');}
    }
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
class BriefingScene extends Phaser.Scene {
  private mode:TrainingMode='Rhythm';
  private difficulty:TrainingDifficulty='normal';
  constructor(){super('Briefing');}
  init(data:{mode:TrainingMode}):void {this.mode=data.mode;activeActivity=data.mode;this.difficulty='normal';}
  create():void {
    const guides:Record<TrainingMode,{title:string;lines:string[]}> = {
      Rush:{title:'CLASS RUSH',lines:['Students ask for help during class.','Click a student with a request to walk over.','Help as many as possible before time runs out.']},
      Rhythm:{title:'PAD WORK',lines:['Watch the technique and timing bar.','Tap the matching pad or use A S D F G H.','Strike near the timing sweet spot. 15 attempts.']},
      Memory:{title:'BAG WORK',lines:['Watch the combination, then repeat it.','Use the pads or A S D F G H.','Complete 10 rounds. Mistakes count, but do not end class.']},
      Defense:{title:'DEFENSE',lines:['Read the incoming attack before the timer ends.','HEAD = BLOCK, BODY = GUARD, LOW KICK = CHECK.','STRAIGHT = SLIP. Use buttons or J K L ;.']},
      Competition:{title:'COMPETITION',lines:['Choose attacks, defense, or recovery.','Both fighters act on each turn.','Manage health and stamina to win.']},
      Conditioning:{title:'STRENGTH & CONDITIONING',lines:['Run an obstacle course with direct movement control.','Use LEFT / RIGHT to move, SPACE to jump, DOWN to duck.','Reach the finish line while avoiding gym obstacles.']}
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
    arcadeButton(this,419,35,74,27,'BACK',()=>{activeActivity=null;this.scene.start('Gym');});
  }
}

class RushScene extends Phaser.Scene {
  private active=false;private seconds=50;private score=0;private missed=0;private spawn=0;
  private difficulty:TrainingDifficulty='normal';
  init(data:{difficulty?:TrainingDifficulty}):void {this.difficulty=data?.difficulty||'normal';}
  private requests:{lane:number,age:number,task:string}[]=[];private info!:Phaser.GameObjects.Text;
  private markers!:Phaser.GameObjects.Container;private coach!:Phaser.GameObjects.Container;
  private coachTarget=-1;private coachSpeed=130;private coachBusy=false;
  private students:Phaser.GameObjects.Container[]=[];private positions=[{x:90,y:153},{x:182,y:153},{x:273,y:153},{x:365,y:153}];
  private names=['FRANK','RADISH','MARSHALL','PUDGE'];
  private tasks=['FIX STANCE','HOLD PADS','CHECK FORM','NEED WATER','SHOW COMBO','ADJUST GUARD'];
  constructor(){super('Rush');}
  create():void {
    this.active=true;this.seconds=50;this.score=0;this.missed=0;this.spawn=1.4;this.requests=[];this.coachTarget=-1;this.coachBusy=false;this.students=[];
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
    this.add.text(42,281,'TRAINING MAT  /  SAME GYM, CLASS VIEW',{fontFamily:UI_FONT,fontSize:'9px',color:'#273d42'});
    this.info=this.add.text(24,75,'',{fontFamily:UI_FONT,fontSize:'12px',color:cream});
    this.positions.forEach((p,i)=>{
      const character=this.makeTrainee(p.x,p.y,[0x986446,0x507c78,0x8576a2,0xc7a053][i],false);
      this.students.push(character);
      this.add.text(p.x,p.y+24,this.names[i],{fontFamily:UI_FONT,fontSize:'11px',color:'#ffffff',backgroundColor:'#1c4045',padding:{x:3,y:2}}).setOrigin(0.5);
      const hit=this.add.rectangle(p.x,p.y-3,77,87,0xffffff,0).setInteractive({useHandCursor:true});
      hit.on('pointerdown',()=>this.help(i));
    });
    this.coach=this.makeTrainee(240,242,0xc4463c,true);
    this.markers=this.add.container(0,0);
    arcadeButton(this,415,35,75,27,'EXIT',()=>this.exit());
    this.render();
  }
  private makeTrainee(x:number,y:number,shirt:number,coach:boolean):Phaser.GameObjects.Container {
    const p:Phaser.GameObjects.GameObject[]=[];
    const r=(px:number,py:number,w:number,h:number,color:number)=>p.push(this.add.rectangle(px,py,w,h,color).setStrokeStyle(1,0x29383b));
    p.push(this.add.ellipse(0,13,26,7,0x183c40,0.45));
    r(-6,10,7,12,0x30343b);r(6,10,7,12,0x30343b);
    r(0,1,23,16,0x333c46);r(-14,-10,7,18,0xc99473);r(14,-10,7,18,0xc99473);
    r(0,-10,24,21,shirt);r(0,-30,23,20,0xc99473);r(0,-40,24,8,0x2b2929);
    if(coach)r(0,-13,9,7,0xe3c66e);
    return this.add.container(x,y,p);
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
    this.markers.removeAll(true);
    for(const r of this.requests){
      const p=this.positions[r.lane],remain=Math.max(0,9-r.age);
      const warning=remain<3?0xf58b79:0xf4d68c;
      const bubble=this.add.rectangle(p.x,p.y-73,104,33,0x17383e).setStrokeStyle(2,warning);
      const text=this.add.text(p.x,p.y-79,r.task,{fontFamily:UI_FONT,fontSize:'10px',fontStyle:'bold',color:'#ffffff'}).setOrigin(0.5);
      const track=this.add.rectangle(p.x,p.y-63,88,5,0x4c5858);
      const bar=this.add.rectangle(p.x-44,p.y-63,88*remain/9,5,warning).setOrigin(0,0.5);
      this.markers.add([bubble,text,track,bar]);
    }
    this.info.setText('TIME '+Math.ceil(Math.max(0,this.seconds))+'s   HELPED '+this.score+'   MISSED '+this.missed+'   '+(this.coachBusy?'COACH MOVING':'TAP REQUEST'));
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
      const p=this.positions[this.coachTarget];const dx=p.x-this.coach.x,dy=(p.y+27)-this.coach.y,dist=Math.hypot(dx,dy);
      if(dist<6)this.serve(this.coachTarget);
      else{const step=Math.min(dist,this.coachSpeed*dt);this.coach.x+=dx/dist*step;this.coach.y+=dy/dist*step;}
    }
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
    this.add.rectangle(240,164,350,176,ink).setStrokeStyle(2,gold);
    this.add.text(240,114,'CLASS COMPLETE',{fontFamily:UI_FONT,fontSize:'21px',fontStyle:'bold',color:cream}).setOrigin(0.5);
    this.add.text(240,153,'Earned $'+earned+'   Reputation +'+rep,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
    arcadeButton(this,240,210,160,35,'RETURN TO GYM',()=>this.scene.start('Gym'));
  }
  private exit():void {this.active=false;this.scene.start('Gym');}
}

const TECHNIQUES=['JAB','CROSS','HOOK','KICK','KNEE','SPRAWL'];
const KEYS=['A','S','D','F','G','H'];
function trainingButton(scene:Phaser.Scene,x:number,y:number,w:number,h:number,label:string,fn:()=>void):void {
  arcadeButton(scene,x,y,w,h,label,fn);
}
class RhythmScene extends Phaser.Scene {
  private active=false;private attempts=0;private hits=0;private streak=0;private target=0;
  private clock=0;private window=1.4;private level=0;private difficulty:TrainingDifficulty='normal';
  init(data:{difficulty?:TrainingDifficulty}):void {this.difficulty=data?.difficulty||'normal';}
  private info!:Phaser.GameObjects.Text;
  private cue!:Phaser.GameObjects.Text;private meter!:Phaser.GameObjects.Rectangle;
  private feedback!:Phaser.GameObjects.Text;private keys:Phaser.Input.Keyboard.Key[]=[];
  constructor(){super('Rhythm');}
  create():void {
    this.active=true;this.attempts=0;this.hits=0;this.streak=0;this.clock=0;this.level=0;this.window=1.4;
    arcadeFrame(this,'PAD WORK','Hit the FLASHING technique on the beat. Tap a pad or use A S D F G H.');
    this.info=this.add.text(24,81,'',{fontFamily:UI_FONT,fontSize:'13px',color:cream});
    this.cue=this.add.text(240,120,'',{fontFamily:UI_FONT,fontSize:'25px',fontStyle:'bold',color:'#ffe29b'}).setOrigin(0.5);
    this.add.rectangle(240,150,340,12,0x132b30);
    this.meter=this.add.rectangle(70,150,0,12,0xe8bb70).setOrigin(0,0.5);
    this.feedback=this.add.text(240,169,'Watch the timing bar',{fontFamily:UI_FONT,fontSize:'12px',color:cream}).setOrigin(0.5);
    for(let i=0;i<6;i++){
      const x=90+(i%3)*150,y=215+Math.floor(i/3)*58;
      trainingButton(this,x,y,135,46,TECHNIQUES[i]+' ['+KEYS[i]+']',()=>this.strike(i));
    }
    arcadeButton(this,415,35,75,27,'EXIT',()=>this.exit());
    this.keys=KEYS.map(k=>this.input.keyboard!.addKey(k));
    this.next();
  }
  private next():void {
    this.level=this.attempts<5?0:this.attempts<10?1:2;
    const count=this.difficulty==='easy'?3:this.difficulty==='hard'?6:[2,4,6][this.level];this.target=Phaser.Math.Between(0,count-1);
    this.window=[1.5,1.15,0.9][this.level]*(this.difficulty==='easy'?1.45:this.difficulty==='hard'?0.7:1);this.clock=0;
    this.cue.setText(TECHNIQUES[this.target]+'  ['+KEYS[this.target]+']');
    this.info.setText('ROUND '+(this.attempts+1)+'/15  |  ACCURATE '+this.hits+'  |  STREAK '+this.streak+'  |  '+['EASY','MEDIUM','HARD'][this.level]);
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
    for(let i=0;i<this.keys.length;i++)if(Phaser.Input.Keyboard.JustDown(this.keys[i])){this.strike(i);break;}
    this.clock+=Math.min(delta,100)/1000;
    this.meter.width=340*Math.min(1,this.clock/this.window);
    if(this.clock>=this.window){this.streak=0;this.attempts++;playGymCue('timeout');this.feedback.setText('TOO SLOW');if(this.attempts>=15)this.finish();else this.next();}
  }
  private finish():void {
    playGymCue('complete');
    this.active=false;const cash=8+this.hits*3;awardArcade(cash,Math.floor(this.hits/5),false);
    this.add.rectangle(240,164,355,170,ink).setStrokeStyle(2,gold);
    this.add.text(240,117,'PAD WORK COMPLETE',{fontFamily:UI_FONT,fontSize:'20px',color:cream}).setOrigin(0.5);
    this.add.text(240,153,this.hits+'/15 on target  |  Earned $'+cash,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
    arcadeButton(this,240,205,160,35,'RETURN TO GYM',()=>this.scene.start('Gym'));
  }
  private exit():void {this.active=false;this.scene.start('Gym');}
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
    arcadeFrame(this,'BAG WORK CLASS','Remember the combination. Call out each move and your student hits the bag.');
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
    this.add.rectangle(240,164,345,170,ink).setStrokeStyle(2,gold);
    this.add.text(240,115,'BAG WORK COMPLETE',{fontFamily:UI_FONT,fontSize:'21px',color:cream}).setOrigin(0.5);
    this.add.text(240,153,'Round '+this.round+'/10  |  Earned $'+earned,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
    arcadeButton(this,240,206,160,35,'RETURN TO GYM',()=>this.scene.start('Gym'));
  }
  private exit():void {this.active=false;this.scene.start('Gym');}
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
    ['BLOCK','GUARD','CHECK','SLIP'].forEach((label,i)=>trainingButton(this,65+i*116,248,105,50,label+' ['+['J','K','L',';'][i]+']',()=>this.defend(i)));
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
    for(let i=0;i<this.keys.length;i++)if(Phaser.Input.Keyboard.JustDown(this.keys[i])){this.defend(i);break;}
    this.elapsed+=Math.min(delta,100)/1000;this.bar.width=340*Math.max(0,1-this.elapsed/this.limit);
    if(this.elapsed>=this.limit){this.count++;playGymCue('timeout');this.feedback.setText('TOO SLOW - HIT!');if(this.count>=15)this.finish();else this.next();}
  }
  private finish():void {
    playGymCue('complete');
    this.active=false;const earned=8+this.correct*3;awardArcade(earned,Math.floor(this.correct/5),false);
    this.add.rectangle(240,164,345,170,ink).setStrokeStyle(2,gold);
    this.add.text(240,115,'DEFENSE COMPLETE',{fontFamily:UI_FONT,fontSize:'21px',color:cream}).setOrigin(0.5);
    this.add.text(240,153,this.correct+'/15 defended  |  Earned $'+earned,{fontFamily:UI_FONT,fontSize:'14px',color:cream}).setOrigin(0.5);
    arcadeButton(this,240,206,160,35,'RETURN TO GYM',()=>this.scene.start('Gym'));
  }
  private exit():void {this.active=false;this.scene.start('Gym');}
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
  private fighters:Phaser.GameObjects.Container[]=[];private visuals:Phaser.GameObjects.GameObject[]=[];private busy=false;
  constructor(){super('Competition');}
  create():void {
    arcadeFrame(this,'COMPETITION','Predict your opponent. Both fighters choose simultaneously.');
    arcadeButton(this,420,35,72,27,'EXIT',()=>this.scene.start('Gym'));
    this.add.text(24,88,'CHOOSE DIFFICULTY',{fontFamily:UI_FONT,fontSize:'14px',color:cream});
    (['easy','normal','hard'] as FightDifficulty[]).forEach((d,i)=>
      arcadeButton(this,105+i*135,139,117,37,d.toUpperCase(),()=>this.startFight(d)));
    this.status=this.add.text(240,208,'Equal HP and stamina at every difficulty.',{fontFamily:UI_FONT,fontSize:'13px',color:cream,align:'center'}).setOrigin(.5);
    this.bars=this.add.text(240,240,'',{fontFamily:UI_FONT,fontSize:'13px',color:cream}).setOrigin(.5);
  }
  private startFight(d:FightDifficulty):void {
    this.difficulty=d;this.hp=100;this.sp=50;this.enemyHp=100;this.enemySp=50;this.turn=1;this.history=[];this.active=true;
    this.children.list.filter(o=>o instanceof Phaser.GameObjects.Rectangle && o.y===139).forEach(o=>o.destroy());
    this.controls.forEach(o=>o.destroy());this.controls=[];
    this.visuals.forEach(o=>o.destroy());this.visuals=[];this.fighters=[];this.busy=false;
    this.drawArena();
    const descriptions=['-5 SP / 12 DMG','+5 SP / BLOCK','-20 SP / POWER','+15 SP / +8 HP'];
    FIGHT_MOVES.forEach((move,i)=>{
      const x=126+(i%2)*227,y=261+Math.floor(i/2)*42;
      const rect=this.add.rectangle(x,y,208,35,0x376b70).setStrokeStyle(2,gold).setInteractive({useHandCursor:true});
      const label=this.add.text(x,y,FIGHT_LABEL[move]+'  '+descriptions[i],{fontFamily:UI_FONT,fontSize:'11px',color:cream}).setOrigin(.5);
      rect.on('pointerdown',()=>this.choose(move));
      this.controls.push(this.add.container(0,0,[rect,label]));
    });
    this.status.setPosition(240,222).setFontSize(11).setText('Fight! Read the opponent and choose your move.');
    this.bars.setPosition(240,89).setFontSize(11);this.renderStats();
  }

  private drawArena():void {
    const floor=this.add.rectangle(240,171,430,86,0xc6a77e).setStrokeStyle(2,0x8a7055);
    const back=this.add.rectangle(240,117,430,28,0x23454b);
    const rope1=this.add.rectangle(240,143,430,3,0xe4d1a8);
    const rope2=this.add.rectangle(240,189,430,3,0xe4d1a8);
    this.visuals.push(floor,back,rope1,rope2);
    this.fighters=[this.drawFighter(147,170,false),this.drawFighter(333,170,true)];
    this.fighters.forEach(f=>this.visuals.push(f));
  }
  private drawFighter(x:number,y:number,enemy:boolean):Phaser.GameObjects.Container {
    const g=this.add.container(x,y);
    const skin=enemy?0xc99170:0xd5a17e,shorts=enemy?0x9c4e53:0x327c78,glove=enemy?0xbf5149:0xe5b65d;
    const pixel=(px:number,py:number,w:number,h:number,color:number)=>this.add.rectangle(px,py,w,h,color).setOrigin(0);
    g.add([
      pixel(-21,34,43,6,0x8e775e),pixel(-14,14,12,22,0x303f4a),pixel(3,14,12,22,0x303f4a),
      pixel(-18,-16,36,34,shorts),pixel(-15,-39,30,27,skin),pixel(-17,-44,34,12,0x302c2b),
      pixel(-21,-9,9,22,skin),pixel(12,-9,9,22,skin),
      pixel(enemy?-32:17,-12,17,17,glove),pixel(enemy?15:-32,-28,17,17,glove),
      pixel(-8,-30,4,4,0x292b2b),pixel(6,-30,4,4,0x292b2b)
    ]);
    return g;
  }
  private animateTurn(player:FightMove,enemy:FightMove,taken:number,dealt:number):void {
    const animate=(fighter:Phaser.GameObjects.Container,move:FightMove,amount:number,dir:number)=>{
      const base=fighter.x;
      if(move==='attack'||move==='big'){
        this.tweens.add({targets:fighter,x:base+dir*(move==='big'?25:15),duration:130,yoyo:true,ease:'Quad.Out'});
      }else if(move==='defend'){
        this.tweens.add({targets:fighter,scaleX:0.88,scaleY:0.94,duration:140,yoyo:true});
      }else{
        this.tweens.add({targets:fighter,y:fighter.y-9,duration:220,yoyo:true});
      }
      const label=move==='breath'?'+8 HP':move==='defend'?'BLOCK':amount>0?'-'+amount:'MISS';
      const popup=this.add.text(base,126,label,{fontFamily:UI_FONT,fontSize:'12px',fontStyle:'bold',color:move==='breath'?'#9cf2b0':'#fff1bf'}).setOrigin(.5);
      this.tweens.add({targets:popup,y:108,alpha:0,duration:650,onComplete:()=>popup.destroy()});
    };
    animate(this.fighters[0],player,taken,1);
    animate(this.fighters[1],enemy,dealt,-1);
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
    if(this.hp<=0||this.enemyHp<=0){this.busy=true;this.time.delayedCall(650,()=>this.finish());}
  }
  private renderStats():void {
    this.bars.setText('YOU  HP '+this.hp+'  SP '+this.sp+'     |     AI  HP '+this.enemyHp+'  SP '+this.enemySp+'\nTURN '+this.turn+'  |  '+this.difficulty.toUpperCase());
  }
  private finish():void {
    this.active=false;
    const win=this.hp>0&&this.enemyHp<=0,draw=this.hp<=0&&this.enemyHp<=0;
    const factor=this.difficulty==='hard'?2:this.difficulty==='normal'?1.5:1;
    const cash=Math.round((win?40:draw?15:8)*factor),rep=win?Math.round(factor):0;
    awardArcade(cash,rep,false);
    playFightSound(win?'win':'lose');
    this.controls.forEach(c=>c.destroy());this.controls=[];
    this.status.setText((win?'YOU WIN!':draw?'DRAW!':'YOU LOSE!')+'  EARNED $'+cash);
    arcadeButton(this,240,280,180,36,'RETURN TO GYM',()=>this.scene.start('Gym'));
  }
}


class ConditioningScene extends Phaser.Scene {
  private difficulty:TrainingDifficulty='normal';
  private active=false;private distance=0;private hits=0;private playerX=90;private y=248;private vy=0;private duck=false;
  private runner!:Phaser.GameObjects.Container;private status!:Phaser.GameObjects.Text;
  private obstacles:{x:number,type:'jump'|'duck',body:Phaser.GameObjects.Rectangle,passed:boolean}[]=[];
  private left=false;private right=false;private down=false;private jumpPressed=false;
  init(data:{difficulty?:TrainingDifficulty}):void {this.difficulty=data.difficulty||'normal';}
  constructor(){super('Conditioning');}
  create():void {
    this.active=true;this.distance=0;this.hits=0;this.playerX=90;this.y=248;this.vy=0;this.obstacles=[];
    arcadeFrame(this,'STRENGTH & CONDITIONING','Move with arrows / A D. Jump SPACE / UP. Duck DOWN / S.');
    this.add.rectangle(240,267,440,6,0xc4a37b);
    this.add.rectangle(240,290,440,42,0x587b68);
    this.status=this.add.text(24,78,'',{fontFamily:UI_FONT,fontSize:'12px',color:cream});
    this.runner=this.add.container(this.playerX,this.y);
    this.runner.add([this.add.rectangle(0,-23,17,23,0x367b82),this.add.rectangle(0,-42,17,17,0xe6b18a),this.add.rectangle(-6,-7,6,15,0x343b4c),this.add.rectangle(6,-7,6,15,0x343b4c)]);
    const kb=this.input.keyboard!;
    kb.on('keydown-SPACE',()=>{this.jumpPressed=true;});
    arcadeButton(this,419,35,74,27,'EXIT',()=>{this.active=false;this.scene.start('Gym');});
    arcadeButton(this,75,307,75,28,'LEFT',()=>{this.left=true;this.time.delayedCall(180,()=>this.left=false);});
    arcadeButton(this,160,307,75,28,'RIGHT',()=>{this.right=true;this.time.delayedCall(180,()=>this.right=false);});
    arcadeButton(this,285,307,75,28,'JUMP',()=>{this.jumpPressed=true;});
    arcadeButton(this,375,307,75,28,'DUCK',()=>{this.down=true;this.time.delayedCall(450,()=>this.down=false);});
  }
  update(_time:number,delta:number):void {
    if(!this.active)return;
    const dt=Math.min(delta/1000,0.05),kb=this.input.keyboard!;
    const keys=kb.addKeys('A,D,S,LEFT,RIGHT,DOWN,UP') as Record<string,Phaser.Input.Keyboard.Key>;
    const left=this.left||keys.A.isDown||keys.LEFT.isDown,right=this.right||keys.D.isDown||keys.RIGHT.isDown;
    this.duck=this.down||keys.S.isDown||keys.DOWN.isDown;
    this.playerX=Phaser.Math.Clamp(this.playerX+(Number(right)-Number(left))*170*dt,45,275);
    if((this.jumpPressed||Phaser.Input.Keyboard.JustDown(keys.UP))&&this.y>=248){this.vy=-295;}
    this.jumpPressed=false;this.vy+=790*dt;this.y=Math.min(248,this.y+this.vy*dt);if(this.y>=248)this.vy=0;
    this.runner.setPosition(this.playerX,this.y);this.runner.setScale(1,this.duck&&this.y>=248?0.65:1);
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
    this.add.rectangle(240,165,365,160,ink).setStrokeStyle(2,gold).setDepth(50);
    this.add.text(240,132,'COURSE COMPLETE',{fontFamily:UI_FONT,fontSize:'22px',color:cream}).setOrigin(.5).setDepth(51);
    this.add.text(240,171,'Hits: '+this.hits+'   Earned USD '+earned,{fontFamily:UI_FONT,fontSize:'13px',color:cream}).setOrigin(.5).setDepth(51);
    arcadeButton(this,240,210,170,33,'RETURN TO GYM',()=>this.scene.start('Gym'));
  }
}

new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:330,backgroundColor:'#c9ae86',pixelArt:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[GymScene,BriefingScene,RushScene,RhythmScene,MemoryScene,DefenseScene,CompetitionScene,ConditioningScene]});
