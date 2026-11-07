import Phaser from 'phaser';

const W = 480, H = 270, CELL = 12;
const UI_FONT = 'Arial, Helvetica, sans-serif';
type Point = { x: number; y: number };
type Student = { name: string; x: number; y: number; color: number; friendship: number; skill: number; body?: Phaser.GameObjects.Container };
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
  private status!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private students: Student[] = [
    { name:'Alex', x:90, y:90, color:0xd9a06c, friendship:0, skill:0 },
    { name:'Maya', x:245, y:104, color:0x8cbaaa, friendship:0, skill:0 },
    { name:'Jordan', x:105, y:183, color:0xaaa4d5, friendship:0, skill:0 },
    { name:'Sam', x:275, y:183, color:0xe2bd77, friendship:0, skill:0 },
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
    this.add.text(12,235,'COMBAT CULTURE GYM | Prototype 0.3',{fontFamily:UI_FONT,fontSize:'11px',color:'#29383b'});
    this.add.text(344,217,'RECEPTION',{fontFamily:UI_FONT,fontSize:'11px',color:'#493e33'});
    this.player = this.add.container(170,150,[
      this.add.ellipse(0,14,22,6,0x203a3a,0.35),
      this.add.rectangle(0,0,22,26,0x292a2c).setStrokeStyle(2,0xb52427),
      this.add.rectangle(0,-14,22,5,0xd92928),
    ]);
    for(const s of this.students) {
      s.body = this.add.container(s.x,s.y,[
        this.add.ellipse(0,12,18,6,0x193b3c,0.3),
        this.add.rectangle(0,0,17,20,s.color).setStrokeStyle(1,0x283638),
        this.add.circle(0,-13,9,0xe4b18d).setStrokeStyle(1,0x563e35),
      ]);
      this.add.text(s.x,s.y-36,s.name,{fontFamily:UI_FONT,fontSize:'11px',color:'#ffffff',backgroundColor:'#203d40'}).setOrigin(0.5);
    }
    this.status = this.add.text(345,17,'',{fontFamily:UI_FONT,fontSize:'12px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:4}});
    this.message = this.add.text(12,16,'Welcome to the gym!',{fontFamily:UI_FONT,fontSize:'12px',color:'#ffffff',backgroundColor:'#253e43',padding:{x:5,y:4},wordWrap:{width:295}}).setDepth(10);
    this.timer = this.add.text(12,219,'',{fontFamily:UI_FONT,fontSize:'12px',color:'#29383b'});
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
        else this.route = this.findRoute({x:this.player.x,y:this.player.y},{x:student.x-24,y:student.y+10});
      } else this.route = this.findRoute({x:this.player.x,y:this.player.y},{x:p.worldX,y:p.worldY});
    });
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
  private interact(target?:Student):void {
    const nearest=target??[...this.students].sort((a,b)=>Phaser.Math.Distance.Between(this.player.x,this.player.y,a.x,a.y)-Phaser.Math.Distance.Between(this.player.x,this.player.y,b.x,b.y))[0];
    if(Phaser.Math.Distance.Between(this.player.x,this.player.y,nearest.x,nearest.y)>42) { this.say('Move closer to a student.'); return; }
    const i=this.students.indexOf(nearest);
    if(this.running) {
      const at=this.requests.indexOf(i);
      if(at<0) { this.say(nearest.name+': All good, coach!'); return; }
      this.requests.splice(at,1);
      this.classHelped++;
      nearest.skill++;
      this.say(nearest.name+': Thanks, coach!');
      if(!this.requests.length) this.finishClass();
    } else {
      nearest.friendship++;
      this.persist();
      const lines=['Working on my jab today!','I want better footwork.','This gym feels welcoming.','Ready to train, coach!'];
      this.say(nearest.name+': '+lines[i]+' Friendship +1');
    }
  }
  private startClass():void {
    if(this.running || this.saveData.completed) { this.say('Class already started or completed.'); return; }
    this.running=true; this.seconds=50; this.classHelped=0;
    const offset=(this.saveData.day-1)%4;
    this.requests=[offset,(offset+1)%4,(offset+2)%4];
    this.say('Beginner Boxing! Help the three students named below.');
  }
  private finishClass():void {
    if(!this.running) return;
    this.running=false;
    this.saveData.completed=true;
    const reward=20+this.classHelped*5;
    this.saveData.money+=reward;
    this.saveData.reputation+=1+this.classHelped;
    this.persist();
    this.refresh();
    this.timer.setText('CLASS COMPLETE');
    this.say('Helped '+this.classHelped+'/3. Earned $'+reward+'. Close gym for next day.');
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
    this.running=false; this.requests=[]; this.persist();
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
      this.seconds-=Math.min(delta,100)/1000;
      this.timer.setText('CLASS '+Math.ceil(this.seconds)+'s | Help: '+this.requests.map(i=>this.students[i].name).join(', '));
      if(this.seconds<=0) this.finishClass();
    }
    let dx=Number(this.cursors.right.isDown||this.wasd.D.isDown)-Number(this.cursors.left.isDown||this.wasd.A.isDown);
    let dy=Number(this.cursors.down.isDown||this.wasd.S.isDown)-Number(this.cursors.up.isDown||this.wasd.W.isDown);
    if(dx||dy) this.route=[];
    else if(this.route.length) {
      const target=this.route[0];
      const distance=Phaser.Math.Distance.Between(this.player.x,this.player.y,target.x,target.y);
      if(distance<2) { this.route.shift(); return; }
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
  }
}
new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#c9ae86',pixelArt:true,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[GymScene]});
