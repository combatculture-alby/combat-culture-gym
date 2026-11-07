import Phaser from 'phaser';

const W = 480, H = 270, CELL = 12;
const UI_FONT = 'Arial, Helvetica, sans-serif';
type Point = { x: number; y: number };
type Student = { name: string; x: number; y: number; color: number; friendship: number; skill: number; body?: Phaser.GameObjects.Container; indicator?: Phaser.GameObjects.Text };
type Save = { version: 1; day: number; money: number; reputation: number; completed: boolean; friendships: number[]; skills: number[] };
const SAVE_KEY = 'combat-culture-gym-v1';
const blocks = [{ x: 368, y: 62, w: 38, h: 80 }, { x: 346, y: 180, w: 92, h: 34 }];
const walkable = (x: number, y: number) => x >= 15 && x <= 465 && y >= 32 && y <= 215 &&
  !blocks.some(b => x + 9 > b.x && x - 9 < b.x + b.w && y + 8 > b.y && y - 8 < b.y + b.h);
const defaults: Save = { version: 1, day: 1, money: 100, reputation: 0, completed: false, friendships: [0,0,0,0], skills: [0,0,0,0] };
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
    return s as Save;
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
    g.fillStyle(0x765337).fillRect(346,180,92,34);
    g.fillStyle(0x3b332d).fillRect(0,0,W,14);
    this.add.text(12,235,'COMBAT CULTURE GYM | Prototype 1.3',{fontFamily:UI_FONT,fontSize:'11px',color:'#29383b'});
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
    this.status = this.add.text(345,17,'',{fontFamily:UI_FONT,fontSize:'12px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:4}});
    this.message = this.add.text(12,16,'Welcome to the gym!',{fontFamily:UI_FONT,fontSize:'12px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:4},wordWrap:{width:295}}).setDepth(10);
    this.timer = this.add.text(12,219,'',{fontFamily:UI_FONT,fontSize:'12px',color:'#29383b'});
    this.feedback = this.add.text(160,195,'',{fontFamily:UI_FONT,fontSize:'13px',fontStyle:'bold',color:'#fff5dc',backgroundColor:'#294f52',padding:{x:6,y:4}}).setOrigin(0.5).setDepth(10).setVisible(false);
    this.add.text(12,250,'Tap student to talk/help; tap floor to move',{fontFamily:UI_FONT,fontSize:'10px',color:'#29383b'});
    this.add.text(12,260,'E: Help   C: Class   N: Close   R: Reset',{fontFamily:UI_FONT,fontSize:'10px',color:'#29383b'});
    this.addButton(363,242,101,18,'START CLASS',() => this.startClass());
    this.addButton(363,263,101,18,'CLOSE GYM',() => this.nextDay());
    this.refresh();
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as typeof this.wasd;
    this.input.keyboard!.on('keydown-E',() => this.interact());
    this.input.keyboard!.on('keydown-C',() => this.startClass());
    this.input.keyboard!.on('keydown-N',() => this.nextDay());
    this.input.keyboard!.on('keydown-R',() => this.reset());
    this.input.on('pointerdown',(p:Phaser.Input.Pointer) => {
      if(p.worldY > 231 && p.worldX > 350) return;
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
  private addButton(x:number,y:number,w:number,h:number,label:string,fn:()=>void):void {
    const b=this.add.rectangle(x,y,w,h,0x294f52).setOrigin(0,1).setStrokeStyle(1,0xd5b786).setInteractive();
    const t=this.add.text(x+w/2,y-h/2,label,{fontFamily:UI_FONT,fontSize:'10px',color:'#ffffff'}).setOrigin(0.5).setInteractive();
    b.on('pointerdown',fn); t.on('pointerdown',fn);
  }
  private persist():void {
    this.saveData.friendships=this.students.map(s=>s.friendship);
    this.saveData.skills=this.students.map(s=>s.skill);
    try { localStorage.setItem(SAVE_KEY,JSON.stringify(this.saveData)); } catch { this.say('Storage unavailable. Progress will not persist.'); }
  }
  private refresh():void {
    this.status.setText(['DAY '+this.saveData.day,'$'+this.saveData.money,'REP '+this.saveData.reputation,this.saveData.completed?'CLASS DONE':'CLASS READY']);
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
      nearest.friendship++;
      this.persist();
      const lines=[['My jab needs work.','I want to compete someday.'],['I brought snacks!','I love this gym community.'],['I studied some fight footage.','I am working on combinations.'],['I am sore today.','I keep showing up!']];
      const milestone=nearest.friendship===3?' You are becoming regular training partners.':nearest.friendship===5?' Friendship milestone: Trusted teammate!':'';
      this.say(nearest.name+': '+lines[i][(nearest.friendship-1)%2]+' Friendship '+nearest.friendship+'.'+milestone);
    }
  }
  private startClass():void {
    if(this.running || this.saveData.completed) { this.say('Class already started or completed.'); return; }
    this.running=true; this.seconds=50; this.classHelped=0; this.friendshipBonus=0; this.quickBonus=0; this.requestAge={}; this.nextRequestAt=5;
    const offset=(this.saveData.day-1)%4;
    this.pendingRequests=[offset,(offset+1)%4,(offset+2)%4];
    this.requests=[];
    const taskTypes=['Technique','Equipment','Station change'];
    this.tasks={};
    this.pendingRequests.forEach((index,position)=>{this.tasks[index]=taskTypes[(position+this.saveData.day-1)%taskTypes.length];});
    this.spawnRequest();
    this.updateIndicators();
    this.say('Beginner Boxing! Students request help throughout class.');
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
    this.updateIndicators();
    this.saveData.completed=true;
    const reward=20+this.classHelped*5+this.friendshipBonus+this.quickBonus;
    this.saveData.money+=reward;
    this.saveData.reputation+=1+this.classHelped;
    this.persist();
    this.refresh();
    this.timer.setText('CLASS COMPLETE');
    const rating=this.classHelped===3?'Excellent':this.classHelped===2?'Good':this.classHelped===1?'Fair':'Needs practice';
    this.say(rating+'! Helped '+this.classHelped+'/3. Quick $'+this.quickBonus+'. Teamwork $'+this.friendshipBonus+'. Total $'+reward+'.');
  }
  private nextDay():void {
    if(this.running) { this.say('Finish class first.'); return; }
    if(!this.saveData.completed) { this.say('Teach class first.'); return; }
    this.saveData.day++;
    this.saveData.completed=false;
    this.persist(); this.refresh();
    this.timer.setText('');
    this.say('New day! Students are ready.');
  }
  private reset():void {
    this.saveData={...defaults,friendships:[0,0,0,0],skills:[0,0,0,0]};
    this.running=false; this.requests=[]; this.pendingRequests=[]; this.targetStudent=null; this.updateIndicators(); this.persist();
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
    if(!length) return;
    const step=Math.min(delta,50)/1000*this.speed;
    const remaining=this.route.length?Phaser.Math.Distance.Between(this.player.x,this.player.y,this.route[0].x,this.route[0].y):step;
    const move=Math.min(step,remaining);
    const nx=this.player.x+dx/length*move,ny=this.player.y+dy/length*move;
    if(walkable(nx,this.player.y)) this.player.x=nx;
    if(walkable(this.player.x,ny)) this.player.y=ny;
    if(this.targetStudent && !this.route.length) { const s=this.targetStudent; this.targetStudent=null; this.interact(s); }
  }
}
new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#c9ae86',pixelArt:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[GymScene]});
