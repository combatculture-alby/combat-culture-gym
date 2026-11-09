import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const port=4173;
const origin='http://127.0.0.1:'+port;
const url=origin+'/combat-culture-gym/';
const saveKey='combat-culture-gym-living-preview-v1';
const output='browser-artifacts';
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],
  {stdio:'pipe',detached:process.platform!=='win32',env:{...process.env,VITE_ISOLATE_SAVE:'1'}});
let serverOutput='';
server.stdout.on('data',data=>serverOutput+=data.toString());
server.stderr.on('data',data=>serverOutput+=data.toString());
let browser;

function sampleSave(overrides={}){
  return {version:1,day:1,money:100,reputation:0,completed:false,
    friendships:[0,0,0,0],skills:[0,0,0,0],...overrides};
}
async function waitForServer(){
  for(let i=0;i<120;i++){
    if(server.exitCode!==null)throw new Error('Vite exited early: '+serverOutput);
    try{const res=await fetch(url);if(res.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Vite did not respond: '+serverOutput);
}
async function sceneState(page){
  return page.evaluate(()=>{
    const game=window.__combatGym;
    const scene=game.scene.getScene('Gym');
    return {
      active:scene.sys.isActive(),
      day:scene.saveData.day,
      level:scene.saveData.gymLevel||1,
      money:scene.saveData.money,
      enrolled:scene.students.length,
      activeNames:scene.activeStudents().map(s=>s.name),
      classPlan:scene.saveData.classPlan,
      classesToday:scene.saveData.classesToday||0,
      room:game.textures.exists('gym-room-'+(scene.saveData.gymLevel||1)),
      rosterVisible:scene.rosterPanel.visible
    };
  });
}
async function openScenario(name,save,action){
  const context=await browser.newContext({viewport:{width:1024,height:704},deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),
    {key:saveKey,value:save});
  try{
    await page.goto(url,{waitUntil:'networkidle',timeout:30000});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive(),{timeout:15000});
    await action(page);
    assert.deepEqual(errors,[],'Unexpected page errors in '+name);
    await page.screenshot({path:output+'/'+name+'.png'});
  }finally{await context.close();}
}
async function clickGame(page,x,y){
  const canvas=page.locator('#game canvas');
  const box=await canvas.boundingBox();
  assert.ok(box,'Game canvas absent');
  await page.mouse.click(box.x+x/480*box.width,box.y+y/330*box.height);
}
try{
  await mkdir(output,{recursive:true});
  await waitForServer();
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});

  await openScenario('level-1-garage',sampleSave(),async page=>{
    const state=await sceneState(page);
    assert.equal(state.level,1);
    assert.equal(state.enrolled,4);
    assert.equal(state.activeNames.length,4);
    assert.equal(state.room,true);
    await clickGame(page,180,296); // MANAGE, real pointer input
    const heading=await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').furniturePanel.visible);
    assert.equal(heading,true,'MANAGE button did not open the menu');
  });

  await openScenario('level-2-recruitment',sampleSave({gymLevel:2,money:1000,
    reputation:20,classesTaught:8,classPlan:[3,2]}),async page=>{
    let state=await sceneState(page);
    assert.equal(state.level,2);
    assert.deepEqual(state.classPlan,[3,2]);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').toggleRoster());
    assert.equal((await sceneState(page)).rosterVisible,true);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').recruitStudent());
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').students.length===5);
    state=await sceneState(page);
    assert.equal(state.enrolled,5);
    assert.equal(state.money,965);
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    state=await sceneState(page);
    assert.equal(state.enrolled,5,'Recruit was not saved');
    assert.deepEqual(state.classPlan,[3,2],'Class plan was not saved');
  });

  await openScenario('level-1-expansion',sampleSave({money:1000,
    reputation:20,classesTaught:10,ownedGear:[true,true,false,false,false,false,false,false]}),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openExpansion());
    await clickGame(page,302,217); // actual EXPAND button
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.gymLevel===2);
    const state=await sceneState(page);
    assert.equal(state.level,2);
    assert.equal(state.money,600,'Expansion cost must be paid once');
    assert.equal(state.room,true,'Level 2 artwork was not loaded');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    assert.equal((await sceneState(page)).level,2,'Expanded level did not persist');
  });

  await openScenario('level-5-attendance',sampleSave({gymLevel:5,enrolledStudents:24,
    friendships:Array(24).fill(0),skills:Array(24).fill(0),money:99999,day:2}),async page=>{
    const state=await sceneState(page);
    assert.equal(state.level,5);
    assert.equal(state.enrolled,24);
    assert.equal(state.activeNames.length,8);
    assert.equal(state.activeNames[0],'Sam');
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').toggleRoster());
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').rosterPage=5);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').showRosterPage());
    assert.equal((await sceneState(page)).rosterVisible,true);
  });

  console.log('Browser smoke passed: garage, menu, recruitment/save, expansion/save, 24-student roster.');
}catch(error){
  console.error(error);
  process.exitCode=1;
}finally{
  await browser?.close();
  if(server.pid){
    try{if(process.platform==='win32')server.kill('SIGTERM');
    else process.kill(-server.pid,'SIGTERM');}catch{}
  }
}
