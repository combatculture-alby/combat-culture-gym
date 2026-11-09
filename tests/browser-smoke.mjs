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
  await page.addInitScript(({key,value})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(value));},
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

  // Separate screenshots for every tier. Read pixels from the baked
  // texture rather than trusting that a differently named texture exists.
  const themePixels=new Set();
  for(const [level,capacity] of [[1,4],[2,6],[3,10],[4,16],[5,24]]){
    await openScenario('layout-level-'+level,sampleSave({
      gymLevel:level,enrolledStudents:capacity,
      friendships:Array(capacity).fill(0),skills:Array(capacity).fill(0),money:1000
    }),async page=>{
      const state=await sceneState(page);
      assert.equal(state.level,level);
      assert.equal(state.enrolled,capacity);
      assert.equal(state.activeNames.length,Math.min(capacity,level+3));
      assert.equal(state.room,true);
      const theme=await page.evaluate(()=>{
        const game=window.__combatGym;
        const source=game.textures.get('gym-room-'+game.scene.getScene('Gym').gymLevel()).getSourceImage();
        const context=source.getContext('2d');
        return [...context.getImageData(115,125,1,1).data];
      });
      assert.equal(theme[3],255,'Baked gym artwork should be opaque');
      themePixels.add(theme.slice(0,3).join(','));
      if(level===5){
        const valid=await page.evaluate(()=>{
          const scene=window.__combatGym.scene.getScene('Gym');
          return scene.validPlacement(310,140,8,8);
        });
        assert.equal(valid,true,'Academy should unlock its wider training mat');
      }
      await page.waitForTimeout(750);
    });
  }
  assert.equal(themePixels.size,5,'Every gym level needs a distinct floor palette');

  // Validate service-object hitboxes and routes at both extremes of the gym.
  await openScenario('tiny-garage-interactions',sampleSave(),async page=>{
    const state=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      const starting=scene.canStand(25,140);
      const board=scene.useStationAt(415,92);
      const boardTarget=scene.stationTarget;
      const boardRoute=scene.route.length;
      const desk=scene.useStationAt(440,203);
      return {starting,board,boardTarget,boardRoute,desk,
        deskTarget:scene.stationTarget,deskRoute:scene.route.length};
    });
    assert.equal(state.starting,false,'Garage must have genuine physical side walls');
    assert.equal(state.board,true);
    assert.equal(state.boardTarget,'board');
    assert.ok(state.boardRoute>0,'Small bulletin board must have reachable interaction route');
    assert.equal(state.desk,true);
    assert.equal(state.deskTarget,'desk');
    assert.ok(state.deskRoute>0,'Folding desk must have reachable interaction route');
    await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      scene.clearIntent();
    });
  });
  await openScenario('classic-level-three',sampleSave({
    gymLevel:3,enrolledStudents:8,friendships:Array(8).fill(0),skills:Array(8).fill(0)
  }),async page=>{
    const state=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {board:scene.useStationAt(400,82),
        boardTarget:scene.stationTarget,
        desk:scene.useStationAt(430,197),
        deskTarget:scene.stationTarget,
        originalWideMat:scene.validPlacement(300,151,8,8)};
    });
    assert.equal(state.board,true);
    assert.equal(state.boardTarget,'board');
    assert.equal(state.desk,true);
    assert.equal(state.deskTarget,'desk');
    assert.equal(state.originalWideMat,true,'Original Level 3 mat must be placeable');
  });
  await openScenario('flagship-receptionist',sampleSave({
    gymLevel:5,enrolledStudents:24,friendships:Array(24).fill(0),
    skills:Array(24).fill(0)
  }),async page=>{
    const state=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      const standing=scene.canStand(18,151);
      const staff=scene.useStationAt(424,155);
      return {standing,staff,target:scene.stationTarget,route:scene.route.length};
    });
    assert.equal(state.standing,true,'Flagship should open nearly all room width');
    assert.equal(state.staff,true,'Academy staff should be clickable');
    assert.equal(state.target,'desk');
    assert.ok(state.route>0,'Receptionist must be reachable');
  });

  // The full daily loop must work without opening a single arcade scene.
  await openScenario('hub-only-training-and-save',sampleSave({
    money:100,reputation:0,classesTaught:0,materials:[0,0,0],
    ownedGear:Array(8).fill(false),gearStored:Array(8).fill(false)
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openDailyHubPlan());
    const plan=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return scene.furniturePanel.visible&&
        scene.furniturePanel.list.some(o=>o.text?.includes('YOUR GYM PLAN'));
    });
    assert.equal(plan,true,'A standalone daily plan must be accessible');
    await clickGame(page,154,180); // Teach next class, actual pointer button.
    await clickGame(page,308,195); // Teach session one.
    let state=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {money:scene.saveData.money,rep:scene.saveData.reputation,
        classesToday:scene.saveData.classesToday,
        taught:scene.saveData.classesTaught,
        xp:scene.saveData.studentXP?.[0]?.[0],activities:scene.saveData.playedActivities,
        scene:scene.scene.key};
    });
    assert.equal(state.money,153,'Class one should pay the garage rate without arcade');
    assert.equal(state.rep,2,'Class one should grant reputation without arcade');
    assert.equal(state.classesToday,1);
    assert.ok(state.xp>0);
    assert.equal(state.scene,'Gym');
    assert.equal(state.activities?.Rush,undefined);
    await clickGame(page,308,195); // Teach afternoon session.
    state=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {money:scene.saveData.money,rep:scene.saveData.reputation,
        classesToday:scene.saveData.classesToday,taught:scene.saveData.classesTaught};
    });
    assert.equal(state.money,206);
    assert.equal(state.rep,4);
    assert.equal(state.classesToday,2);
    assert.equal(state.taught,2);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').nextDay());
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===2);
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    const saved=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym').saveData;
      return {cash:s.money,rep:s.reputation,classesToday:s.classesToday,day:s.day};
    });
    assert.deepEqual(saved,{cash:206,rep:4,classesToday:0,day:2},
      'Daily training rewards and reset must survive reload');
  });

  for(const level of [1,5]){
    await openScenario('hub-supplies-level-'+level,sampleSave({
      gymLevel:level,enrolledStudents:level===1?4:24,
      friendships:Array(level===1?4:24).fill(0),skills:Array(level===1?4:24).fill(0),
      materials:[0,0,0],gatheredToday:[]
    }),async page=>{
      const gathered=await page.evaluate(()=>{
        const scene=window.__combatGym.scene.getScene('Gym');
        const first=scene.gatheringPositions[0];
        scene.coach.place(first.x,first.y);
        const result=scene.collectNodeAt(first.x,first.y);
        const total=scene.saveData.materials.reduce((a,b)=>a+b,0);
        scene.openMaterials();
        return {result,total,collected:scene.saveData.gatheredToday?.length,
          points:scene.gatheringPositions.length,menu:scene.furniturePanel.visible};
      });
      assert.equal(gathered.result,true);
      assert.ok(gathered.total>=1);
      assert.equal(gathered.collected,1);
      assert.equal(gathered.points,12);
      assert.equal(gathered.menu,true);
      await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').nextDay());
      await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===2);
      assert.equal(await page.evaluate(()=>
        window.__combatGym.scene.getScene('Gym').saveData.gatheredToday?.length||0),0,
      'Piles must respawn for each new day');
    });
  }

  await openScenario('hub-only-first-expansion',sampleSave({
    money:500,reputation:0,classesTaught:0,
    ownedGear:[true,true,false,false,false,false,false,false],
    gearStored:Array(8).fill(true)
  }),async page=>{
    for(let day=1;day<=4;day++){
      await page.evaluate(()=>{
        const s=window.__combatGym.scene.getScene('Gym');
        s.simulateClass(0);s.simulateClass(1);s.nextDay();
      });
      await page.waitForFunction(day=>
        window.__combatGym.scene.getScene('Gym').saveData.day===day+1,day);
    }
    const state=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {rep:s.saveData.reputation,classes:s.saveData.classesTaught,
        level:s.gymLevel(),cash:s.saveData.money,
        canExpand:s.saveData.ownedGear?.filter(Boolean).length>=2};
    });
    assert.equal(state.classes,8);
    assert.ok(state.rep>=12,'Hub classes alone must unlock first expansion reputation');
    assert.ok(state.cash>=400,'Hub classes should finance first expansion');
    assert.equal(state.canExpand,true);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openExpansion());
    await clickGame(page,300,217);
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.gymLevel===2);
    assert.equal((await sceneState(page)).level,2,'Expansion should work without launching a minigame');
  });

  await openScenario('hub-equipment-placement-save',sampleSave({
    money:400,materials:[10,10,10],
    ownedGear:[true,false,false,false,false,false,false,false],
    gearStored:[true,false,false,false,false,false,false,false]
  }),async page=>{
    const placed=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.beginGearPlacement(0);
      s.placeGear(120,150);
      return {stored:s.saveData.gearStored?.[0],position:s.saveData.gearPositions?.[0],
        status:s.placingGear};
    });
    assert.equal(placed.stored,false,'Owned gear must be placeable in garage');
    assert.deepEqual(placed.position,{x:120,y:150});
    assert.equal(placed.status,-1);
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    const saved=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym').saveData;
      return {stored:s.gearStored?.[0],position:s.gearPositions?.[0]};
    });
    assert.deepEqual(saved,{stored:false,position:{x:120,y:150}});
  });

  await openScenario('speech-bubble-lifetime',sampleSave(),async page=>{
    const initial=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      const student=scene.activeStudents()[0];
      scene.showSpeech(student,'Testing a short chat');
      const index=scene.students.indexOf(student);
      return {until:scene.speechUntil[index]-scene.time.now,
        visible:scene.speechBubbles[index].visible,index};
    });
    assert.equal(initial.visible,true,'Chat must appear immediately');
    assert.ok(initial.until>900&&initial.until<1700,'Default bubbles should be brief');
    await page.waitForTimeout(1900);
    const dismissed=await page.evaluate(index=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return scene.speechBubbles[index].visible;
    },initial.index);
    assert.equal(dismissed,false,'Chat must automatically disappear when expired');
    await page.evaluate(index=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      const student=scene.students[index];
      scene.showSpeech(student,'Paused chat',700);
      scene.openGymUpgrades();
    },initial.index);
    await page.waitForTimeout(1050);
    const pausedVisible=await page.evaluate(index=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return scene.speechBubbles[index].visible;
    },initial.index);
    assert.equal(pausedVisible,false,'Chat must expire while menus are open');
    // Force an actual NPC walking route and verify the bubble does not
    // travel around the gym with the character.
    await page.evaluate(index=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      scene.furniturePanel.setVisible(false);
      const student=scene.students[index];
      scene.showSpeech(student,'I should leave now',3500);
      const routine=scene.idleRoutine(student,3,'walk');
      routine.route=[{x:student.x+10,y:student.y}];
      routine.goal={x:student.x+10,y:student.y};
      student.routine=routine;
    },initial.index);
    await page.waitForTimeout(120);
    const walkingBubble=await page.evaluate(index=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return scene.speechBubbles[index].visible;
    },initial.index);
    assert.equal(walkingBubble,false,'A walking NPC must immediately lose their speech bubble');
  });

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

  await openScenario('class-timetable',sampleSave({money:1000}),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openClassSchedule());
    await clickGame(page,130,178); // Assign HIIT to morning slot.
    assert.deepEqual((await sceneState(page)).classPlan,[3,1]);
    await clickGame(page,300,195); // Teach session one.
    assert.equal((await sceneState(page)).classesToday,1);
    await clickGame(page,135,146); // Assign Grappling to afternoon slot.
    assert.deepEqual((await sceneState(page)).classPlan,[3,2]);
    await clickGame(page,300,195); // Teach session two.
    assert.equal((await sceneState(page)).classesToday,2);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').nextDay());
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===2);
    const state=await sceneState(page);
    assert.deepEqual(state.classPlan,[3,2],'Schedule should persist to the next day');
    assert.equal(state.classesToday,0,'New day should reset remaining class slots');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    assert.deepEqual((await sceneState(page)).classPlan,[3,2],'Schedule should persist after reload');
  });

  await openScenario('level-1-equipment-bounds',sampleSave(),async page=>{
    const valid=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {edge:scene.validPlacement(48,120,8,8),
        inner:scene.validPlacement(80,132,8,8),
        outside:scene.validPlacement(310,132,8,8)};
    });
    assert.equal(valid.edge,false,'Garage must reject equipment outside its smaller mat');
    assert.equal(valid.inner,true,'Garage must permit clear usable equipment placements');
    assert.equal(valid.outside,false);
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
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').rosterPanel.setVisible(false));
    await page.waitForTimeout(3000);
    const positions=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return scene.activeStudents().map(student=>({
        name:student.name,x:student.x,y:student.y,
        hasActor:!!student.actor,hasRoutine:!!student.routine
      }));
    });
    assert.equal(positions.length,8);
    for(const student of positions){
      assert.ok(student.hasActor&&student.hasRoutine,'Attending students must have active sprites and routines');
      assert.ok(Number.isFinite(student.x)&&Number.isFinite(student.y),'No NPC may have invalid coordinates');
      assert.ok(student.x>=15&&student.x<=465&&student.y>=75&&student.y<=215,'NPCs must stay in the room');
    }
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').nextDay());
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===3);
    assert.equal((await sceneState(page)).activeNames[0],'Ash','The daily shift must rotate NPC attendance');
  });

  // Real mobile touch input, not a mouse click masquerading as a tap.
  const mobile=await browser.newContext({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true
  });
  try{
    const page=await mobile.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{
      key:saveKey,value:sampleSave()
    });
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    const canvas=page.locator('#game canvas');
    const bounds=await canvas.boundingBox();
    assert.ok(bounds&&bounds.width>=300&&bounds.height>=190,'Game must fit phone screen');
    await page.touchscreen.tap(bounds.x+180/480*bounds.width,bounds.y+296/330*bounds.height);
    assert.equal(await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').furniturePanel.visible),
      true,'MANAGE should respond to a real phone tap');
    assert.deepEqual(errors,[],'Mobile view should not emit JS errors');
    await page.screenshot({path:output+'/mobile-garage.png',fullPage:true});
  }finally{await mobile.close();}

  console.log('Browser smoke passed: five distinct levels, garage, menu, placement bounds, class timetable, recruitment/save, expansion/save, 24-student roster, rotating crowded NPCs, and mobile touch.');
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
