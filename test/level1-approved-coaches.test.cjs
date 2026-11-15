const assert=require('node:assert/strict'); const vm=require('node:vm');
const fs=require('node:fs'); const path=require('node:path'); const code=fs.readFileSync(path.join(__dirname,'..','level1-approved-coaches.js'),'utf8');
const textures=new Map(),ui=[],calls=[];const storage=new Map();
const img={texture:{key:'combat-culture-approved-coach'},setTexture(k,f){this.texture.key=k;this.frame={name:f};return this},setDisplaySize(){return this},setOrigin(){return this},setFlipX(){return this},setFrame(f){this.frame.name=f;return this}};
const coach={image:img,body:{},approvedCoach:false,studentArt:null,artActor:null,frame:-1};
const panel={list:[],add(e){this.list.push(e)}};
const scene={sys:{isActive:()=>true},coach, gymLevel:()=>1, running:false,isPlacing:()=>false,
  textures:{exists:k=>textures.has(k),addImage(k){textures.set(k,{frames:new Map(),add(n,_i,x,y,w,h){this.frames.set(n,[x,y,w,h])}})},get:k=>textures.get(k)},
  add:{image(x,y,k,frame){return{setDisplaySize(){return this},key:k,frame,setOrigin(){return this}}},text(x,y,value){return{setOrigin(){return this},text:value}}},
  furniturePanel:panel,clearIntent(){}, menuShell(t,s){calls.push(['menu',t,s]);panel.list=[]},panelButton(p,n,x,y,w,h,fn){ui.push({name:n,fn,x,y})},
  openBuildHub(){calls.push(['old-build'])}, openCoachWardrobe(){calls.push(['old-wardrobe'])},
  openGearShop(){},openFurniture(){},events:{once(){}},
 };
class Img {constructor(){this.complete=true;this.naturalWidth=576;this.naturalHeight=192;}set src(s){this._src=s}get src(){return this._src}}
const window={CC_GAME:{scene:{scenes:[scene]}},dispatchEvent(){}};
const sandbox={window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}, Image:Img,Event:class{},setInterval:cb=>{cb();return 1}};
vm.runInNewContext(code,sandbox);
assert.equal(coach.image.texture.key,'cc-l1-approved-coach-male');
assert.equal(textures.get('cc-l1-approved-coach-male').frames.size,36);
assert.deepEqual(textures.get('cc-l1-approved-coach-male').frames.get('walk-left-2'),[8*48,64,48,64]);
scene.openBuildHub();assert.equal(ui.length,5);assert(ui.some(x=>x.name==='YOUR COACH'));
scene.openCoachWardrobe();assert(calls.find(x=>x[1]==='YOUR COACH'));
assert(ui.some(x=>x.name==='FEMALE'));
ui.find(x=>x.name==='FEMALE').fn();assert.equal(coach.image.texture.key,'cc-l1-approved-coach-female');
assert.equal(storage.get('cc-l1-approved-coach-preset-v1'),'female');
assert.equal(textures.get('cc-l1-approved-coach-female').frames.size,36);
console.log('PASS: male default; 36 frames each; build entry; female switch and persistence.');