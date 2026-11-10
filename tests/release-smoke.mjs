import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const url='http://127.0.0.1:4175/combat-culture-gym/';
const saveKey='combat-culture-gym-living-preview-v1';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4175','--strictPort'],
  {env:{...process.env,VITE_ISOLATE_SAVE:'1',VITE_GARAGE_PREVIEW:'0'},stdio:'inherit'});
let browser;

try {
  for(let attempt=0;;attempt++){
    if(server.exitCode!==null||attempt===60)throw Error('Release preview failed to start');
    if(await fetch(url).then(response=>response.ok).catch(()=>false))break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(key=>{
    if(localStorage.getItem(key))return;
    localStorage.setItem(key,JSON.stringify({version:1,day:9,money:8000,reputation:200,
      completed:false,friendships:[0,0,0,0],skills:[0,0,0,0],classesTaught:90,
      ownedGear:[true,true,true,true,true,true,true,true]}));
  },saveKey);
  const ready=level=>page.waitForFunction(expected=>{
    const scene=window.__combatGym?.scene.getScene('Gym');
    return scene?.sys.isActive()&&scene.gymLevel()===expected;
  },level);
  await page.goto(url);
  await ready(1);
  await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openExpansion());
  const canvas=await page.locator('#game canvas').boundingBox();
  await page.touchscreen.tap(canvas.x+(229+84)/480*canvas.width,canvas.y+216/330*canvas.height);
  await ready(2);
  const inspect=()=>page.evaluate(()=>{
    const scene=window.__combatGym.scene.getScene('Gym');
    scene.openExpansion();
    return {money:scene.saveData.money,text:scene.furniturePanel.list.map(item=>item.text).filter(Boolean),
      dev:scene.devToolsEnabled()};
  });
  const levelTwo=await inspect();
  assert.equal(levelTwo.money,7600);
  assert.ok(levelTwo.text.some(line=>line.includes('LEVEL 2 / 2')));
  assert.ok(levelTwo.text.includes('MAX LEVEL: NEIGHBORHOOD GYM'));
  assert.ok(!levelTwo.text.includes('EXPAND GYM'));
  assert.equal(levelTwo.dev,false);
  await page.reload();
  await ready(2);
  assert.deepEqual(await inspect(),levelTwo);

  // The initial open/close loop must work even when students have not yet
  // arrived, and "talk" must never crash on an empty floor.
  await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    s.closePanel();
    s.saveData.gymPhase='opening';
    s.saveData.arrivedCount=0;
    s.persist();s.scene.restart();
  });
  await ready(2);
  const empty=await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    s.interact();
    return {phase:s.dayPhase(),students:s.activeStudents().length};
  });
  assert.deepEqual(empty,{phase:'opening',students:0});
  const classDay=await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    s.advanceGymPhase();
    const started=s.dayPhase();
    s.saveData.arrivedCount=2;
    s.refresh();
    const before={money:s.saveData.money,reputation:s.saveData.reputation,
      classes:s.saveData.classesTaught||0,day:s.saveData.day};
    s.simulateClass(0,0.9,false);
    return {started,present:s.activeStudents().length,before,
      after:{money:s.saveData.money,reputation:s.saveData.reputation,
        classes:s.saveData.classesTaught,classesToday:s.saveData.classesToday}};
  });
  assert.equal(classDay.started,'open');
  assert.equal(classDay.present,2);
  assert.ok(classDay.after.money>classDay.before.money);
  assert.ok(classDay.after.reputation>classDay.before.reputation);
  assert.equal(classDay.after.classes,classDay.before.classes+1);
  assert.equal(classDay.after.classesToday,1);
  await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    s.advanceGymPhase();
  });
  const closing=await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    return {phase:s.dayPhase(),classesToday:s.saveData.classesToday};
  });
  assert.equal(closing.phase,'closing');
  await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    s.saveData.arrivedCount=0;s.persist();
    s.advanceGymPhase();
  });
  await page.waitForFunction(day=>{
    const s=window.__combatGym.scene.getScene('Gym');
    return s?.sys.isActive()&&s.saveData.day===day+1;
  },classDay.before.day);
  const tomorrow=await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    return {level:s.gymLevel(),phase:s.dayPhase(),arrived:s.saveData.arrivedCount,
      classesToday:s.saveData.classesToday,classes:s.saveData.classesTaught};
  });
  assert.deepEqual(tomorrow,{level:2,phase:'opening',arrived:0,
    classesToday:0,classes:classDay.after.classes});
  await page.reload();
  await ready(2);
  assert.deepEqual(await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    return {level:s.gymLevel(),phase:s.dayPhase(),arrived:s.saveData.arrivedCount,
      classesToday:s.saveData.classesToday,classes:s.saveData.classesTaught};
  }),tomorrow);
  assert.deepEqual(errors,[]);
  console.log('Release smoke passed: touch Level 1->2, cap, empty gym, class day cycle, and reload.');
} finally {
  await browser?.close();
  server.kill();
}
