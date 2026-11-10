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
  assert.deepEqual(errors,[]);
  console.log('Release smoke passed: mobile Level 1 to Level 2 expansion, cap, and save reload.');
} finally {
  await browser?.close();
  server.kill();
}
