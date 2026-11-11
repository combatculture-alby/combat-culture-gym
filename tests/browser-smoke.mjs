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
  {stdio:'pipe',detached:process.platform!=='win32',env:{...process.env,VITE_ISOLATE_SAVE:'1',VITE_FULL_GYM_QA:'1'}});
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
  // Phaser consumes pointer events on its game tick. Two synthetic clicks in
  // the same 16ms frame can be dropped, unlike ordinary human input.
  await page.waitForTimeout(130);
}

/** Exercise one real pointer help, then complete the other scheduled requests
 * through the same interaction method without a 36-second CI delay. */
async function finishScheduledClass(page){
  const initial=await page.evaluate(()=>{
    const scene=window.__combatGym.scene.getScene('Gym');
    if(!scene.running||!scene.requests.length)throw Error('Scheduled coaching did not start');
    const student=scene.students[scene.requests[0]];
    scene.coach.place(student.x,student.y);
    return {x:student.x,y:student.y};
  });
  await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    window.__classTapDebug={};
    const canvas=document.querySelector('#game canvas');
    canvas?.addEventListener('pointerdown',event=>{
      window.__classTapDebug.dom={x:event.clientX,y:event.clientY,
        target:event.target?.tagName};
    },{once:true,capture:true});
    s.input.once('pointerdown',(p,targets)=>{
      window.__classTapDebug.pointer={x:p.worldX,y:p.worldY,
        targets:targets.map(o=>o.type)};
    });
    s.students[s.requests[0]].actor.body.once('pointerdown',()=>{
      window.__classTapDebug.actor=true;
    });
  });
  await clickGame(page,initial.x,initial.y-10);
  const first=await page.evaluate(()=>{
    const s=window.__combatGym.scene.getScene('Gym');
    const student=s.students[s.requests[0]];
    const input=student?.actor?.body?.input;
    return {helped:s.classHelped,debug:window.__classTapDebug,handler:s.studentTapDebug,
      student:student&&{x:student.x,y:student.y},
      hitArea:input?.hitArea&&{x:input.hitArea.x,y:input.hitArea.y,
        width:input.hitArea.width,height:input.hitArea.height},
      actorSize:student?.actor&&{w:student.actor.body.width,h:student.actor.body.height},
      targetAtClick:(()=>{
        const canvas=document.querySelector('#game canvas');
        const box=canvas?.getBoundingClientRect();
        if(!box)return null;
        const x=box.left+(student?.x||94)/480*box.width;
        const y=box.top+((student?.y||139)-10)/330*box.height;
        const el=document.elementFromPoint(x,y);
        return {tag:el?.tagName,id:el?.id,className:typeof el?.className==='string'?el.className:'',x,y};
      })()};
  });
  assert.equal(first.helped,1,'Tapping a student should fulfill a live class request: '+JSON.stringify(first));
  return page.evaluate(()=>{
    const scene=window.__combatGym.scene.getScene('Gym');
    while(scene.running&&scene.pendingRequests.length){
      scene.spawnRequest();
      const student=scene.students[scene.requests[0]];
      scene.coach.place(student.x,student.y);
      scene.interact(student);
    }
    if(scene.running)scene.finishClass();
    return {running:scene.running,helped:scene.classHelped,
      money:scene.saveData.money,rep:scene.saveData.reputation};
  });
}

try{
  await mkdir(output,{recursive:true});
  await waitForServer();
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});

  // Separate screenshots for every tier. Read pixels from the baked
  // texture rather than trusting that a differently named texture exists.
  const themePixels=new Set();
  for(const [level,capacity] of [[1,4],[2,6],[3,8],[4,10],[5,12]]){
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
        assert.equal(valid,false,'Main mat must stop expanding at Level 2');
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
    assert.equal(state.originalWideMat,false,'Level 3 unlocks outdoor space, not extra main mat');
  });
  await openScenario('flagship-receptionist',sampleSave({
    gymLevel:5,enrolledStudents:12,friendships:Array(12).fill(0),
    skills:Array(12).fill(0)
  }),async page=>{
    const state=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      const standing=scene.canStand(18,151);
      const staff=scene.useStationAt(424,155);
      return {standing,staff,target:scene.stationTarget,route:scene.route.length};
    });
    assert.equal(state.standing,false,'Flagship main room retains Level 2 walls');
    assert.equal(state.staff,true,'Academy staff should be clickable');
    assert.equal(state.target,'desk');
    assert.ok(state.route>0,'Receptionist must be reachable');
  });

  await openScenario('interactive-class-rush-merged',sampleSave(),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openTrainingBoard());
    const options=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return s.furniturePanel.list.map(item=>item.text||'');
    });
    assert.ok(!options.some(t=>t==='CLASS RUSH'),
      'Class Rush must no longer appear as a separate minigame');
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openClassSchedule());
    await clickGame(page,301,195);
    const running=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {active:scene.running,total:scene.classRequestsTotal,
        marked:scene.activeStudents().filter(s=>s.indicator.visible).length,
        routine:scene.activeStudents()[0].routine.pose,
        scene:scene.scene.key};
    });
    assert.equal(running.active,true);
    assert.equal(running.scene,'Gym','Classes must happen inside the hub');
    assert.equal(running.total,4);
    assert.ok(running.marked>=1,'Students must show visible coaching requests');
    assert.equal(running.routine,'shadow');
    await page.screenshot({path:output+'/interactive-class-active.png'});
    const score=await finishScheduledClass(page);
    assert.equal(score.helped,running.total);
    assert.ok(score.rep>=3);
  });

  await openScenario('class-rewards-depend-on-coaching',sampleSave(),async page=>{
    const low=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.startClass(0);
      s.seconds=0;s.finishClass();
      return {money:s.saveData.money,rep:s.saveData.reputation};
    });
    assert.ok(low.money>100);
    assert.equal(low.rep,1,'Unattended class should earn minimal reputation');
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openClassSchedule());
    await clickGame(page,303,195);
    const high=await finishScheduledClass(page);
    assert.ok(high.money-low.money>low.money-100,
      'Successful coaching must beat passive earnings');
    assert.ok(high.rep-low.rep>low.rep,'Coaching must improve reputation');
  });

  await openScenario('seminar-availability-and-purchase',sampleSave({
    money:1000,reputation:0,seminarLastDay:0,studentXP:Array.from({length:4},()=>[0,0,0,0])
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openTrainingBoard());
    const tiles=await page.evaluate(()=>window.__combatGym.scene.getScene('Gym')
      .furniturePanel.list.map(o=>o.text||''));
    assert.ok(tiles.includes('GUEST SEMINARS'),'Seminar replaces the separate Class Rush minigame slot');
    await clickGame(page,304,192); // Training Board → Guest Seminars.
    const offerings=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {title:s.furniturePanel.list.find(o=>o.text==='GUEST SEMINARS')?.text,
        labels:s.furniturePanel.list.map(o=>o.text||'')};
    });
    assert.equal(offerings.title,'GUEST SEMINARS');
    for(const name of ['Mina Torres','Ajarn Niran','Coach Ellis','Coach Vale'])
      assert.ok(offerings.labels.some(t=>t.includes(name)),'Missing coach '+name);
    assert.ok(offerings.labels.some(t=>t.includes('VISITS IN')),
      'Unavailable coaches must show the next visit day');
    assert.ok(offerings.labels.some(t=>t.includes('[HERE] Mina Torres')),
      'Today\'s featured guest must be clearly marked');
    assert.ok(offerings.labels.some(t=>t.includes('[AWAY] Coach Ellis')),
      'Unavailable guests must be visibly marked away');
    assert.ok(offerings.labels.some(t=>t.startsWith('TODAY: Mina Torres')),
      'An at-a-glance today banner should name the visiting guest');
    await page.screenshot({path:output+'/seminars-availability.png'});
    await clickGame(page,178,85); // Available guest coach Mina.
    await clickGame(page,266,225); // Confirm seminar and pay fee.
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Seminar').sys.isActive());
    const booked=await page.evaluate(()=>{
      const s=JSON.parse(localStorage.getItem('combat-culture-gym-living-preview-v1'));
      return {money:s.money,pending:s.seminarPending,rep:s.reputation};
    });
    assert.equal(booked.money,700);
    assert.deepEqual(booked.pending,{coachId:0,day:1});
    assert.equal(booked.rep,0);
    await page.screenshot({path:output+'/seminar-cutscene.png'});
    const scene=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Seminar');
      return {phase:s.phase,finished:s.finished,lessons:s.presenter!==undefined,
        lessonText:s.lessonText.text};
    });
    assert.equal(scene.phase,0);
    assert.equal(scene.finished,false);
    assert.equal(scene.lessons,true);
    assert.ok(scene.lessonText.includes('demonstrates'));
    await clickGame(page,364,302); // Skip cutscene, still receive full paid rewards.
    const completed=await page.evaluate(()=>{
      const s=JSON.parse(localStorage.getItem('combat-culture-gym-living-preview-v1'));
      return {money:s.money,rep:s.reputation,pending:s.seminarPending,
        last:s.seminarLastDay,xp:s.studentXP[0][0],stats:s.studentStats[0][0]};
    });
    assert.equal(completed.money,700);
    assert.equal(completed.rep,3);
    assert.equal(completed.pending,undefined);
    assert.equal(completed.last,1);
    assert.ok(completed.xp>0||completed.stats>10,'Students must receive specialized XP');
    await page.screenshot({path:output+'/seminar-cutscene-complete.png'});
    await clickGame(page,329,302); // Return to gym from the fixed results panel.
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').sys.isActive());
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').sys.isActive());
    assert.equal(await page.evaluate(()=>
      window.__combatGym.scene.getScene('Gym').saveData.seminarLastDay),1);
  });

  await openScenario('seminar-auto-cutscene-rewards',sampleSave({
    money:700,seminarPending:{coachId:0,day:1}
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').launchSeminar(0));
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Seminar').sys.isActive());
    const pending=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Seminar');
      return {phase:s.phase,finished:s.finished,skip:s.skip.visible};
    });
    assert.equal(pending.phase,0);
    assert.equal(pending.finished,false);
    assert.equal(pending.skip,true);
    // The animation must progress and grant full credit without any interaction.
    await page.waitForFunction(()=>{
      const stored=JSON.parse(localStorage.getItem('combat-culture-gym-living-preview-v1'));
      return stored.seminarLastDay===1;
    },null,{timeout:14000});
    const completed=await page.evaluate(()=>{
      const s=JSON.parse(localStorage.getItem('combat-culture-gym-living-preview-v1'));
      const scene=window.__combatGym.scene.getScene('Seminar');
      return {money:s.money,rep:s.reputation,last:s.seminarLastDay,
        pending:s.seminarPending,finished:scene.finished,skip:scene.skip.visible};
    });
    assert.deepEqual(completed,{money:700,rep:3,last:1,
      pending:undefined,finished:true,skip:false});
    await page.evaluate(()=>window.__combatGym.scene.getScene('Seminar').complete());
    assert.equal(await page.evaluate(()=>{
      const s=JSON.parse(localStorage.getItem('combat-culture-gym-living-preview-v1'));
      return s.reputation;
    }),3,'Even a repeated completion call must not award again');
  });

  await openScenario('seminar-paid-resume',sampleSave({
    money:100,seminarPending:{coachId:0,day:1}
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openSeminars());
    const resume=await page.evaluate(()=>window.__combatGym.scene.getScene('Gym')
      .furniturePanel.list.some(o=>o.text==='RESUME PAID SEMINAR'));
    assert.equal(resume,true);
    await clickGame(page,285,228);
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Seminar').sys.isActive());
    await clickGame(page,427,35); // Exit without completing the seminar.
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').sys.isActive());
    const pending=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym').saveData;
      return {money:s.money,pending:s.seminarPending};
    });
    assert.equal(pending.money,100);
    assert.deepEqual(pending.pending,{coachId:0,day:1},
      'Leaving a seminar should preserve a paid booking for later');
  });

  await openScenario('seminar-not-free',sampleSave({
    day:1,money:100
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openSeminars());
    await clickGame(page,180,86); // Affordable? No: must not book.
    const state=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {cash:s.saveData.money,pending:s.saveData.seminarPending,
        seminarActive:window.__combatGym.scene.getScene('Seminar').sys.isActive()};
    });
    assert.equal(state.cash,100);
    assert.equal(state.pending,undefined);
    assert.equal(state.seminarActive,false);
  });

  await openScenario('opening-prep-gradual-arrivals-and-closing',sampleSave({
    gymPhase:'opening',arrivedCount:0,day:2,money:600,
    waterLevel:8,towelLevel:12,paperLevel:14,matCleanliness:22,
    gearCondition:[15,100,100,100,100,100,100,100],
    trashSpawnedToday:7,gatheredToday:[0,1],
    supplies:[0,1,1,1],pendingSupplies:[2,0,0,0]
  }),async page=>{
    const start=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {phase:s.dayPhase(),attending:s.todaysStudents().length,
        present:s.activeStudents().length,actors:s.todaysStudents().map(t=>t.actor.body.visible),
        water:s.saveData.waterLevel,trash:s.saveData.trashSpawnedToday};
    });
    assert.equal(start.phase,'opening');
    assert.equal(start.present,0);
    assert.ok(start.attending>0);
    assert.ok(start.actors.every(x=>!x),'No students should be visible during opening prep');
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.startClass(0); // Cannot teach before opening.
    });
    assert.equal((await sceneState(page)).classesToday,0);
    await page.screenshot({path:output+'/opening-prep-empty-gym.png'});
    // Prep phase does not magically restore water or spawn callers.
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.phoneClock=s.phoneRingAt;s.trashClock=14;
      s.update(0,100);
    });
    let prep=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {calls:s.saveData.phoneCallsSpawned||0,trash:s.saveData.trashSpawnedToday,
        water:s.saveData.waterLevel};
    });
    assert.deepEqual(prep,{calls:0,trash:7,water:8});
    // Physically press OPEN GYM.
    await clickGame(page,413,241);
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').dayPhase()==='open');
    let opened=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {phase:s.dayPhase(),present:s.activeStudents().length};
    });
    assert.deepEqual(opened,{phase:'open',present:0});
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.advanceGymPhase();
    });
    assert.equal((await sceneState(page)).activeNames.length,0,
      'Cannot close without teaching any classes');
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.arrivalsClock=4;s.updateArrivals(0.02);
    });
    let arrived=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {present:s.activeStudents().length,
        visible:s.activeStudents().every(t=>t.actor.body.visible),
        hidden:s.todaysStudents().slice(1).every(t=>!t.actor.body.visible)};
    });
    assert.deepEqual(arrived,{present:1,visible:true,hidden:true});
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.arrivalsClock=4;s.updateArrivals(0.02);
    });
    assert.equal((await sceneState(page)).activeNames.length,2,
      'Student arrivals must be staggered');
    await page.screenshot({path:output+'/gym-opening-two-students.png'});
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.simulateClass(0,0.5,false); // No schedule panel blocks the Close Gym HUD.
    });
    assert.equal((await sceneState(page)).classesToday,1);
    await clickGame(page,413,241); // Close Gym.
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').dayPhase()==='closing');
    assert.equal(await page.evaluate(()=>{
      const g=window.__combatGym.scene.getScene('Gym');
      return g.serviceHotspots.find(p=>p.type==='phone')?.ring?.visible;
    }),false,'The desk phone must stop flashing outside open hours');
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.arrivalsClock=3;s.updateArrivals(0.05);
    });
    assert.equal((await sceneState(page)).activeNames.length,1);
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.arrivalsClock=3;s.updateArrivals(0.05);
    });
    assert.equal((await sceneState(page)).activeNames.length,0);
    await page.screenshot({path:output+'/closing-empty-gym.png'});
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    const closed=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {phase:s.dayPhase(),arrived:s.saveData.arrivedCount,
        water:s.saveData.waterLevel,mat:s.saveData.matCleanliness,
        paper:s.saveData.paperLevel,
        remainingTrash:s.saveData.trashSpawnedToday-s.saveData.gatheredToday.length};
    });
    assert.equal(closed.phase,'closing');
    assert.equal(closed.arrived,0);
    assert.ok(closed.water<=8,'Class usage cannot magically refill water');
    assert.ok(closed.paper<=14,'Paper is consumed rather than restocked');
    await clickGame(page,413,241); // Next Day, no hard reset of neglected services.
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===3);
    const tomorrow=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym'),d=s.saveData;
      return {phase:s.dayPhase(),present:s.activeStudents().length,
        water:d.waterLevel,paper:d.paperLevel,stock:d.supplies[0],
        deliveries:d.pendingSupplies[0],
        trash:d.trashSpawnedToday,cleaned:d.gatheredToday.length,
        condition:d.gearCondition[0],mat:d.matCleanliness};
    });
    assert.equal(tomorrow.phase,'opening');
    assert.equal(tomorrow.present,0);
    assert.equal(tomorrow.water,closed.water,'No free water refill overnight');
    assert.equal(tomorrow.paper,closed.paper,'Unrestocked toilet paper persists');
    assert.equal(tomorrow.stock,2,'Only ordered supplies arrive the next day');
    assert.equal(tomorrow.deliveries,0);
    assert.equal(tomorrow.trash,closed.remainingTrash,'Every uncollected pile carries forward, including any that spawned during gym hours');
    assert.equal(tomorrow.cleaned,0);
    assert.ok(tomorrow.condition<=15,'Broken equipment stays broken overnight');
    assert.ok(tomorrow.mat<100,'Unmopped mat remains dirty');
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
    await page.screenshot({path:output+'/hub-daily-plan.png'});
    await clickGame(page,154,180); // Teach next class, actual pointer button.
    await clickGame(page,308,195); // Start the real interactive coaching session.
    const firstClass=await finishScheduledClass(page);
    assert.equal(firstClass.running,false);
    assert.ok(firstClass.helped>=3);
    let state=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {money:scene.saveData.money,rep:scene.saveData.reputation,
        classesToday:scene.saveData.classesToday,
        taught:scene.saveData.classesTaught,
        xp:scene.saveData.studentXP?.[0]?.[0],activities:scene.saveData.playedActivities,
        scene:scene.scene.key};
    });
    assert.ok(state.money>153,'Good live coaching must earn more than the passive class rate');
    assert.ok(state.rep>=3,'Helping students should raise reputation rewards');
    assert.equal(state.classesToday,1);
    assert.ok(state.xp>0);
    assert.equal(state.scene,'Gym');
    assert.equal(state.activities?.Rush,undefined);
    await clickGame(page,159,204); // Class results → Class Schedule.
    await clickGame(page,308,195); // Start afternoon class.
    if(!await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').running)){
      const stage=await page.evaluate(()=>{
        const scene=window.__combatGym.scene.getScene('Gym');
        return {slot:scene.selectedSlot,classesToday:scene.saveData.classesToday,
          phase:scene.saveData.gymPhase,students:scene.activeStudents().length,
          panel:scene.furniturePanel.visible,
          labels:scene.furniturePanel.list.filter(o=>o?.text).map(o=>o.text).slice(-14)};
      });
      console.log('Second-class retry after missing pointer',JSON.stringify(stage));
      await clickGame(page,308,195);
    }
    await finishScheduledClass(page);
    state=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {money:scene.saveData.money,rep:scene.saveData.reputation,
        classesToday:scene.saveData.classesToday,taught:scene.saveData.classesTaught};
    });
    assert.ok(state.money>206);
    assert.ok(state.rep>=6);
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
    assert.deepEqual(saved,{cash:state.money,rep:state.rep,classesToday:0,day:2},
      'Daily interactive coaching rewards must survive reload');
  });

  for(const level of [1,5]){
    await openScenario('hub-supplies-level-'+level,sampleSave({
      gymLevel:level,enrolledStudents:level===1?4:12,
      friendships:Array(level===1?4:12).fill(0),skills:Array(level===1?4:12).fill(0),
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
      await page.waitForFunction(day=>{
        const g=window.__combatGym.scene.getScene('Gym');
        return g.saveData.day===day+1&&g.sys.isActive()&&g.message?.text?.includes('Opening prep');
      },day);
      await page.waitForTimeout(120); // Phaser has completed the scene restart.
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
    await page.screenshot({path:output+'/first-expansion-ready.png'});
    await clickGame(page,300,217);
    await page.waitForTimeout(350);
    const expansion=await page.evaluate(()=>{
      const g=window.__combatGym.scene.getScene('Gym');
      return {level:g.saveData.gymLevel,rep:g.saveData.reputation,
        cash:g.saveData.money,taught:g.saveData.classesTaught,
        owned:g.saveData.ownedGear?.filter(Boolean).length,
        menu:g.furniturePanel.visible,
        text:g.furniturePanel.list.map(x=>x.text).filter(Boolean),
        status:g.message?.text};
    });
    assert.equal(expansion.level,2,
      'Hub-only expansion should work without arcade. '+JSON.stringify(expansion));
  });

  await openScenario('hub-find-supplies-button',sampleSave({
    materials:[0,0,0],gatheredToday:[]
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openMaterials());
    await clickGame(page,235,222); // Real Materials > Find next supply button.
    await page.waitForFunction(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return (scene.saveData.gatheredToday?.length||0)>0;
    },{timeout:7000});
    const state=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {supplies:scene.saveData.gatheredToday.length,stock:scene.saveData.materials,
        scene:scene.scene.key};
    });
    assert.ok(state.supplies>0);
    assert.ok(state.stock.some(x=>x>0));
    assert.equal(state.scene,'Gym','Collecting supplies must never launch a minigame');
  });

  await openScenario('coach-customization-and-shop',sampleSave({
    money:500,coachAppearance:{skin:1,hair:2,cut:4,top:0,shorts:0,gloves:0},
    wardrobeOwned:[]
  }),async page=>{
    let initial=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {appearance:scene.saveData.coachAppearance,
        texture:scene.coach.getTextureKey()};
    });
    assert.ok(initial.texture.startsWith('coach-custom-'));
    assert.equal(initial.appearance.skin,1);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openCoachWardrobe());
    await clickGame(page,222,135); // Change the haircut in the editor.
    const changed=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {appearance:s.saveData.coachAppearance,
        texture:s.coach.getTextureKey()};
    });
    assert.notEqual(changed.texture,initial.texture,'Custom appearance must change the rendered atlas');
    assert.notEqual(changed.appearance.cut,initial.appearance.cut);
    await page.screenshot({path:output+'/coach-editor.png'});
    await clickGame(page,309,233); // Open clothing shop.
    const shopHeading=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return scene.furniturePanel.list.find(item=>typeof item.text==='string'&&
        (item.text.includes('CLOTHING SHOP')||item.text.includes('YOUR COACH')))?.text;
    });
    assert.equal(shopHeading,'COACH CLOTHING SHOP','Wardrobe shop button must open the purchase panel');
    await clickGame(page,180,84); // Purchase red training tee for $75.
    let purchased=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {money:s.saveData.money,owned:s.saveData.wardrobeOwned,
        outfit:s.saveData.coachAppearance,texture:s.coach.getTextureKey()};
    });
    assert.equal(purchased.money,425);
    assert.ok(purchased.owned.includes(0));
    assert.equal(purchased.outfit.top,2);
    assert.notEqual(purchased.texture,changed.texture);
    await page.screenshot({path:output+'/coach-shop-purchase.png'});
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    const persisted=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {money:s.saveData.money,owned:s.saveData.wardrobeOwned,
        outfit:s.saveData.coachAppearance,texture:s.coach.getTextureKey()};
    });
    assert.deepEqual(persisted,purchased,'Coach appearance and purchases must survive reload');
  });

  await openScenario('wardrobe-locked-items',sampleSave({
    money:0,coachAppearance:{skin:0,hair:0,cut:0,top:5,shorts:4,gloves:3},
    wardrobeOwned:[999]
  }),async page=>{
    const loaded=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.openCoachWardrobe();
      return {appearance:s.saveData.coachAppearance,closet:s.saveData.wardrobeOwned};
    });
    assert.equal(loaded.appearance.top,0);
    assert.equal(loaded.appearance.shorts,0);
    assert.equal(loaded.appearance.gloves,0);
    assert.deepEqual(loaded.closet,[]);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openClothingShop());
    const before=await sceneState(page);
    await clickGame(page,180,84);
    assert.equal((await sceneState(page)).money,before.money,
      'Unfunded wardrobe purchase must not deduct money');
  });

  await openScenario('safe-new-game-reset',sampleSave({
    gymLevel:3,enrolledStudents:8,day:6,money:333,reputation:65,
    friendships:Array(8).fill(1),skills:Array(8).fill(3)
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').confirmNewGym());
    await clickGame(page,150,201); // Cancel: no save mutations.
    let state=await sceneState(page);
    assert.equal(state.level,3);
    assert.equal(state.day,6);
    assert.equal(state.money,333);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').confirmNewGym());
    await clickGame(page,313,201); // Deliberate destructive confirmation.
    // Wait for the scene restart; if a frame swallowed the pointer, retry once.
    try {
      await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===1,null,{timeout:3000});
    } catch {
      await clickGame(page,313,201);
      await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===1,null,{timeout:10000});
    }
    state=await sceneState(page);
    assert.equal(state.level,1);
    assert.equal(state.day,1);
    assert.equal(state.money,100);
    assert.equal(state.enrolled,4);
    assert.deepEqual(await page.evaluate(()=>{
      const g=window.__combatGym.scene.getScene('Gym');
      return {phase:g.dayPhase(),students:g.activeStudents().length};
    }),{phase:'opening',students:0},'A restarted gym begins before students arrive');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    assert.equal((await sceneState(page)).level,1,'Reset must survive reload');
  });

  await openScenario('trash-accumulates-and-cleans',sampleSave({
    materials:[0,0,0],gatheredToday:[],trashSpawnedToday:2
  }),async page=>{
    const initial=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {spawned:s.saveData.trashSpawnedToday,visible:s.gatheringNodes.length};
    });
    assert.deepEqual(initial,{spawned:4,visible:4},
      'A new day starts with a small amount of litter');
    const cleanup=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym'),point=s.gatheringPositions[0];
      // Unspawned future locations are not collectible.
      const future=s.gatheringPositions[6];
      s.coach.place(future.x,future.y);
      const blocked=s.collectNodeAt(future.x,future.y);
      s.coach.place(point.x,point.y);
      const cleaned=s.collectNodeAt(point.x,point.y);
      const repeat=s.collectNodeAt(point.x,point.y);
      return {blocked,cleaned,repeat,spawned:s.saveData.trashSpawnedToday,
        gathered:s.saveData.gatheredToday.length,
        materials:s.saveData.materials.reduce((a,b)=>a+b,0),
        visible:s.gatheringNodes.length};
    });
    assert.equal(cleanup.blocked,false,'Cannot clean trash that has not appeared');
    assert.equal(cleanup.cleaned,true);
    assert.equal(cleanup.repeat,false,'No double farming the same mess');
    assert.equal(cleanup.gathered,1);
    assert.ok(cleanup.materials>0);
    assert.equal(cleanup.visible,3,'Cleaning physically removes the litter');
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.trashClock=35;
      s.update(0,16);
    });
    const timed=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {spawned:s.saveData.trashSpawnedToday,visible:s.gatheringNodes.length};
    });
    assert.equal(timed.spawned,5,'Trash should accumulate during gym activity');
    assert.equal(timed.visible,4);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').simulateClass(0));
    let after=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {spawned:s.saveData.trashSpawnedToday,visible:s.gatheringNodes.length,
        classes:s.saveData.classesToday};
    });
    assert.deepEqual(after,{spawned:9,visible:8,classes:1},
      'Classes should leave extra trash to clean');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    assert.equal(await page.evaluate(()=>
      window.__combatGym.scene.getScene('Gym').saveData.trashSpawnedToday),9,
    'Accumulated trash must persist after reload');
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').nextDay());
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===2);
    after=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {spawned:s.saveData.trashSpawnedToday,cleaned:s.saveData.gatheredToday.length};
    });
    assert.deepEqual(after,{spawned:8,cleaned:0},'Uncollected litter carries into the following day');
  });

  await openScenario('cleanup-shift-walks-between-messes',sampleSave({
    materials:[0,0,0],trashSpawnedToday:4,gatheredToday:[]
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openDailyHubPlan());
    await clickGame(page,300,171); // Real Daily Gym Plan > Clean the Gym.
    const started=await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      return {shift:scene.cleaningShift,menu:scene.furniturePanel.visible,
        target:scene.pickupTarget,cleaning:scene.cleaningAt,steps:scene.route.length};
    });
    assert.equal(started.menu,false);
    assert.equal(started.shift,true);
    assert.ok(started.target||started.cleaning||started.steps>0,
      'Cleanup should walk to a pile or visibly pick up nearby trash');
    const result=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      for(let i=0;i<480;i++){
        s.update(0,50);
        if(!s.cleaningShift&&s.saveData.gatheredToday.length>=3)break;
      }
      return {cleaned:s.saveData.gatheredToday.length,
        stock:s.saveData.materials.reduce((a,b)=>a+b,0),
        active:s.cleaningShift,
        visible:s.gatheringNodes.length};
    });
    assert.ok(result.cleaned>=2,'Cleanup shift must pick up more than one pile');
    assert.ok(result.stock>=result.cleaned,'Every removed pile grants materials');
    assert.equal(result.visible,4-result.cleaned,'Physical rubbish should disappear');
  });

  // Physical hub props remain walk-up objects rather than persistent UI tiles.
  for(const level of [1,3,5]){
    await openScenario('level-'+level+'-physical-service-props',sampleSave({
      gymLevel:level,money:300,phoneCallsSpawned:0,
      enrolledStudents:level===1?4:level===3?8:12,
      friendships:Array(level===1?4:level===3?8:12).fill(0),
      skills:Array(level===1?4:level===3?8:12).fill(0)
    }),async page=>{
      const info=await page.evaluate(()=>{
        const s=window.__combatGym.scene.getScene('Gym');
        const props=s.serviceHotspots.map(({type,frame,hit,hint,art})=>({
          type,graphic:frame.type,hit:hit.type,
          visible:frame.visible||!!art?.visible,clickable:!!hit.input?.enabled,
          hintHidden:!hint.visible,point:s.servicePosition(type)
        }));
        const blocked=['water','stock','mop'].map(type=>{
          const p=s.servicePosition(type);
          return {type,blocked:!s.canStand(p.x,p.y+7)};
        });
        return {props,blocked};
      });
      assert.deepEqual(info.props.map(p=>p.type),['phone','water','stock','mop']);
      assert.ok(info.props.every(p=>p.graphic==='Graphics'&&p.hit==='Zone'&&
        p.visible&&p.clickable&&p.hintHidden),
        'Every service must be a tappable rendered object, not a floating labeled button');
      assert.ok(info.blocked.every(x=>x.blocked),
        'World props should have solid collision footprints');
      await page.screenshot({path:output+'/physical-services-level-'+level+'.png'});
      // Use actual graphical fixture taps with a coach close to each object.
      for(const [type,panel] of [
        ['water','GYM WATER & AMENITIES'],
        ['stock','ORDER GYM SUPPLIES'],
        ['mop','MOP THE TRAINING MAT'],
        ['phone','FRONT DESK PHONE']
      ]){
        const p=await page.evaluate(type=>{
          const s=window.__combatGym.scene.getScene('Gym');
          const fixture=s.servicePosition(type);
          s.coach.place(fixture.x-25,fixture.y+10);
          return fixture;
        },type);
        await clickGame(page,p.x,p.y);
        const heading=await page.evaluate(title=>
          window.__combatGym.scene.getScene('Gym').furniturePanel.list
            .some(obj=>obj.text===title),panel);
        assert.equal(heading,true,type+' physical fixture should open its existing workflow');
        await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').closePanel());
      }
    });
  }

  await openScenario('water-cooler-used-by-real-students',sampleSave({
    waterLevel:0,supplies:[2,2,2,2]
  }),async page=>{
    const state=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      const before=s.stations.some(item=>item.id==='water-cooler');
      s.refillAmenity(0);
      const after=s.stations.some(item=>item.id==='water-cooler'&&
        item.pose==='drink');
      return {before,after,water:s.saveData.waterLevel,
        stock:s.saveData.supplies[0]};
    });
    assert.deepEqual(state,{before:false,after:true,water:55,stock:1},
      'Students should be able to use the actual cooler only while stocked');
  });

  await openScenario('random-phone-rings-from-reception',sampleSave({
    phoneCallsSpawned:0,phoneCallsAnswered:0,day:2
  }),async page=>{
    const before=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {calls:s.saveData.phoneCallsSpawned,
        ringVisible:s.serviceHotspots.find(p=>p.type==='phone')?.ring?.visible,
        hit:s.servicePosition('phone')};
    });
    assert.equal(before.calls,0);
    assert.equal(before.ringVisible,false,'No immediate phone call on a fresh day');
    const after=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.phoneClock=s.phoneRingAt;
      s.update(0,16);
      return {calls:s.saveData.phoneCallsSpawned,
        visible:s.serviceHotspots.find(p=>p.type==='phone')?.ring?.visible};
    });
    assert.deepEqual(after,{calls:1,visible:true},
      'Random elapsed waiting time should make the physical desk phone ring');
    await page.screenshot({path:output+'/phone-ringing-at-desk.png'});
    // Tap the animated RING! callout itself; it should reach the phone.
    const bubble=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      const phone=s.servicePosition('phone');
      s.coach.place(phone.x-24,phone.y+11);
      const ring=s.serviceHotspots.find(p=>p.type==='phone').ring;
      return {x:ring.x,y:ring.y-7};
    });
    await clickGame(page,bubble.x,bubble.y);
    assert.equal(await page.evaluate(()=>
      window.__combatGym.scene.getScene('Gym').furniturePanel.list
        .some(t=>t.text==='FRONT DESK PHONE')),true,
      'The flashing callout must be a touch target');
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.answerPhone('info');
    });
    const answered=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {available:s.saveData.phoneCallsSpawned-s.saveData.phoneCallsAnswered,
        visible:s.serviceHotspots.find(p=>p.type==='phone')?.ring?.visible,
        rep:s.saveData.reputation,nextRing:s.phoneRingAt};
    });
    assert.equal(answered.available,0);
    assert.equal(answered.visible,false,'Phone stops flashing when call is answered');
    assert.equal(answered.rep,2);
    assert.ok(answered.nextRing>=28&&answered.nextRing<=72);
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    assert.equal(await page.evaluate(()=>
      window.__combatGym.scene.getScene('Gym').saveData.phoneCallsAnswered),1);
  });

  await openScenario('keyboard-walk-up-service-objects',sampleSave({
    phoneCallsSpawned:1,phoneCallsAnswered:0
  }),async page=>{
    for(const type of ['water','stock','mop']){
      const result=await page.evaluate(type=>{
        const s=window.__combatGym.scene.getScene('Gym');
        const p=s.servicePosition(type);
        const approach=type==='water'?{x:p.x+27,y:174}:
          type==='stock'?{x:p.x-33,y:165}:{x:p.x+8,y:193};
        s.coach.place(approach.x,approach.y);
        s.closePanel();
        const activated=s.useNearbyStation();
        const labels=s.furniturePanel.list.map(x=>x.text||'');
        return {activated,labels};
      },type);
      const heading={water:'GYM WATER & AMENITIES',stock:'ORDER GYM SUPPLIES',
        mop:'MOP THE TRAINING MAT'}[type];
      assert.equal(result.activated,true);
      assert.ok(result.labels.includes(heading),
        'E proximity should open '+type+' rather than the reception menu');
    }
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.closePanel();
      const phone=s.servicePosition('phone');
      s.coach.place(phone.x-30,phone.y+10);
    });
    // Point E toward reception, with a call waiting. It should answer phone.
    const keyboard=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.useNearbyStation();
      return s.furniturePanel.list.map(x=>x.text||'');
    });
    assert.ok(keyboard.includes('FRONT DESK PHONE'));
  });

  await openScenario('phone-inquiries-recruitment-discount',sampleSave({
    gymLevel:2,enrolledStudents:4,money:500,
    phoneCallsSpawned:1,phoneCallsAnswered:0,phoneLeads:0
  }),async page=>{
    const phone=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym'),p=s.servicePosition('phone');
      s.coach.place(p.x-26,p.y+10);
      return p;
    });
    await clickGame(page,phone.x,phone.y); // Click the physical desk phone, not a floating button.
    const opened=await page.evaluate(()=>window.__combatGym.scene.getScene('Gym')
      .furniturePanel.list.some(x=>x.text==='FRONT DESK PHONE'));
    assert.equal(opened,true,'Phone must be interactable on the gym floor');
    await page.screenshot({path:output+'/phone-inquiry.png'});
    await clickGame(page,197,184); // Offer intro trial.
    const call=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {answered:s.saveData.phoneCallsAnswered,
        leads:s.saveData.phoneLeads,rep:s.saveData.reputation,cash:s.saveData.money};
    });
    assert.deepEqual(call,{answered:1,leads:1,rep:1,cash:500});
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').recruitStudent());
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').students.length===5);
    const outcome=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {students:s.students.length,cash:s.saveData.money,leads:s.saveData.phoneLeads};
    });
    assert.equal(outcome.students,5);
    assert.equal(outcome.leads,0,'The phone lead discount must be used once');
    assert.ok(outcome.cash<500&&outcome.cash>430,'Recruitment should be discounted but not free');
  });

  await openScenario('order-and-refill-gym-supplies',sampleSave({
    money:600,supplies:[1,1,1,2],pendingSupplies:[0,0,0,0],
    waterLevel:20,towelLevel:15,paperLevel:10
  }),async page=>{
    const closet=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym'),p=s.servicePosition('stock');
      s.coach.place(p.x-30,p.y+14);
      return p;
    });
    await clickGame(page,closet.x,closet.y); // Click physical supply closet.
    assert.equal(await page.evaluate(()=>window.__combatGym.scene.getScene('Gym')
      .furniturePanel.list.some(x=>x.text==='ORDER GYM SUPPLIES')),true);
    await clickGame(page,175,90); // Order 3 water jugs ($35).
    const order=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym').saveData;
      return {cash:s.money,stock:s.supplies[0],pending:s.pendingSupplies[0]};
    });
    assert.deepEqual(order,{cash:565,stock:1,pending:3},
      'Orders charge immediately but arrive on the following day');
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openWaterStation());
    await page.screenshot({path:output+'/water-station-low-supplies.png'});
    await clickGame(page,190,143); // Refill drinking water with one jug.
    await clickGame(page,190,175); // Restock towels with one pack.
    await clickGame(page,190,204); // Restock toilet paper.
    const after=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym').saveData;
      return {stock:s.supplies.slice(0,3),water:s.waterLevel,
        towels:s.towelLevel,paper:s.paperLevel};
    });
    assert.deepEqual(after,{stock:[0,0,0],water:75,towels:85,paper:80});
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').nextDay());
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===2);
    const delivered=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym').saveData;
      return {water:s.supplies[0],pending:s.pendingSupplies[0],cash:s.money};
    });
    assert.deepEqual(delivered,{water:3,pending:0,cash:565});
  });

  await openScenario('mop-activity-on-the-mat',sampleSave({
    supplies:[2,2,2,2],matCleanliness:20,mopSpotsToday:[],
    mopDoneToday:false,money:100,reputation:0
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openMopStation());
    await clickGame(page,295,221); // Start Mopping.
    const begin=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {active:s.mopActive,marks:s.mopMarks.length,
        done:s.saveData.mopSpotsToday?.length||0,mat:s.saveData.matCleanliness};
    });
    assert.deepEqual(begin,{active:true,marks:5,done:0,mat:20});
    await page.screenshot({path:output+'/mop-mat-markers.png'});
    const finish=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      for(const point of s.mopSpotPositions()){
        s.coach.place(point.x,point.y);
        s.updateMopping();
      }
      return {active:s.mopActive,done:s.saveData.mopDoneToday,
        marks:s.mopMarks.length,mat:s.saveData.matCleanliness,
        stock:s.saveData.supplies[3],money:s.saveData.money,rep:s.saveData.reputation};
    });
    assert.deepEqual(finish,{active:false,done:true,marks:0,mat:100,
      stock:1,money:120,rep:1});
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').sys.isActive());
    assert.equal(await page.evaluate(()=>window.__combatGym.scene.getScene('Gym')
      .saveData.mopDoneToday),true,'Completed mop work must survive reload');
  });

  await openScenario('dirty-or-broken-equipment-maintenance',sampleSave({
    ownedGear:[true,false,false,false,false,false,false,false],
    gearStored:[false,true,true,true,true,true,true,true],
    gearPositions:[{x:120,y:150}],money:100,materials:[2,0,0],
    supplies:[1,1,1,2],
    gearCondition:[20,100,100,100,100,100,100,100],
    gearCleanliness:[20,100,100,100,100,100,100,100]
  }),async page=>{
    const initial=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.coach.place(99,150);
      return {active:s.matchingClassGear([0])};
    });
    assert.equal(initial.active,0,'Dirty and broken placed gear must have no bonus');
    await clickGame(page,120,150); // Tap the physical heavy bag.
    const panel=await page.evaluate(()=>window.__combatGym.scene.getScene('Gym')
      .furniturePanel.list.some(x=>x.text==='EQUIPMENT MAINTENANCE'));
    assert.equal(panel,true,'Tapped gear should open physical servicing actions');
    await page.screenshot({path:output+'/equipment-needs-service.png'});
    await clickGame(page,191,178); // Wipe with sanitizer.
    const cleaned=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {hygiene:s.saveData.gearCleanliness[0],
        stock:s.saveData.supplies[3],bonus:s.matchingClassGear([0])};
    });
    assert.deepEqual(cleaned,{hygiene:85,stock:1,bonus:0},
      'Wiping should not magically repair broken equipment');
    await clickGame(page,192,210); // Repair with scrap.
    const fixed=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {condition:s.saveData.gearCondition[0],
        scrap:s.saveData.materials[0],bonus:s.matchingClassGear([0])};
    });
    assert.deepEqual(fixed,{condition:70,scrap:1,bonus:1});
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').simulateClass(0));
    let worn=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {condition:s.saveData.gearCondition[0],
        hygiene:s.saveData.gearCleanliness[0],bonus:s.matchingClassGear([0])};
    });
    assert.deepEqual(worn,{condition:64,hygiene:61,bonus:1});
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').simulateClass(1));
    worn=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {condition:s.saveData.gearCondition[0],
        hygiene:s.saveData.gearCleanliness[0],bonus:s.matchingClassGear([0])};
    });
    assert.deepEqual(worn,{condition:58,hygiene:37,bonus:0},
      'Repeated classes soil equipment enough to deactivate training bonuses');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').sys.isActive());
    assert.equal(await page.evaluate(()=>window.__combatGym.scene.getScene('Gym')
      .matchingClassGear([0])),0);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').nextDay());
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===2);
    const reset=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {cleaned:s.saveData.gearWipedToday.length,
        serviced:s.saveData.gearServicedToday.length};
    });
    assert.deepEqual(reset,{cleaned:0,serviced:0});
  });

  await openScenario('student-complaints-are-readable',sampleSave({
    waterLevel:5,towelLevel:5,paperLevel:5,matCleanliness:10,
    ownedGear:[true,false,false,false,false,false,false,false],
    gearStored:Array(8).fill(false),gearCondition:[10,100,100,100,100,100,100,100]
  }),async page=>{
    const issues=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.showFacilityComplaint();
      let visible=s.speechBubbles.filter(b=>b?.visible);
      if(visible.length!==1)throw Error('Student should visibly complain once');
      const before=visible[0].text;
      s.updateStudentLife(0.1);
      visible=s.speechBubbles.filter(b=>b?.visible);
      return {before,after:visible[0]?.text||'',routine:s.activeStudents()
        .find(student=>student.routine?.pose==='talk')?.routine?.pose};
    });
    assert.ok(/water|towels|paper|mat|broken/i.test(issues.before));
    assert.equal(issues.after,issues.before,'Complaint remains visible while student stops to talk');
    assert.equal(issues.routine,'talk');
    await page.screenshot({path:output+'/student-facility-complaint.png'});
  });

  await openScenario('daily-shift-completion-without-mini-games',sampleSave({
    reputation:0,money:100,coachedToday:[],gatheredToday:[],
    trashSpawnedToday:4,dailyShiftClaimed:false
  }),async page=>{
    const outcome=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      const firstTwo=s.requestStudentIds();
      s.completeStudentRequest(firstTwo[0],'goal');
      s.completeStudentRequest(firstTwo[1],'bond');
      for(const p of s.gatheringPositions.slice(0,3)){
        s.coach.place(p.x,p.y);s.collectNodeAt(p.x,p.y);
      }
      const ready=s.saveData.dailyShiftClaimed;
      s.simulateClass(0);
      const first={claimed:s.saveData.dailyShiftClaimed,cash:s.saveData.money,
        rep:s.saveData.reputation,coached:s.saveData.coachedToday.length,
        trash:s.saveData.gatheredToday.length};
      s.checkDailyShift();
      return {ready,first,cashAfterRepeat:s.saveData.money};
    });
    assert.equal(outcome.ready,false,'Shift should require a scheduled class');
    assert.deepEqual({claimed:outcome.first.claimed,coached:outcome.first.coached,
      trash:outcome.first.trash},{claimed:true,coached:2,trash:3});
    assert.ok(outcome.first.cash>=100+45,'Completing shift awards cash');
    assert.ok(outcome.first.rep>=4,'Coaching and completing shift earns reputation');
    assert.equal(outcome.cashAfterRepeat,outcome.first.cash,'Shift can only award once');
  });

  await openScenario('gear-purchase-place-or-store',sampleSave({
    money:500,materials:[20,20,20],gearStored:Array(8).fill(false),
    ownedGear:Array(8).fill(false)
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openGearShop());
    await clickGame(page,130,80); // Heavy bag, $65.
    let prompt=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {title:s.furniturePanel.list.find(o=>o.text==='ITEM PURCHASED')?.text,
        hasPlace:s.furniturePanel.list.some(o=>o.text==='PLACE NOW'),
        hasStore:s.furniturePanel.list.some(o=>o.text==='STORE FOR LATER'),
        cash:s.saveData.money,stored:s.saveData.gearStored?.[0],
        bonus:s.matchingClassGear([0])};
    });
    assert.deepEqual(prompt,{title:'ITEM PURCHASED',hasPlace:true,hasStore:true,
      cash:435,stored:true,bonus:0});
    await page.screenshot({path:output+'/new-item-place-store-prompt.png'});
    await clickGame(page,157,194); // Place Now.
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.placeGear(120,150);
    });
    let gear=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {stored:s.saveData.gearStored?.[0],bonus:s.matchingClassGear([0]),
        pos:s.saveData.gearPositions?.[0]};
    });
    assert.equal(gear.stored,false);
    assert.equal(gear.bonus,1,'Placed heavy bag activates class training bonus');
    assert.deepEqual(gear.pos,{x:120,y:150});
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openGearShop());
    // Click the actual named shop item rather than a pixel coordinate that
    // may overlap the close/reopen transition on slower CI browsers.
    await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      const pad=scene.furniturePanel.list.find(o=>typeof o.text==='string'&&
        o.text.startsWith('Thai Pads'));
      if(!pad)throw Error('Thai Pads shop entry is missing');
      pad.emit('pointerdown');
    }); // Thai pads install in their fixed wall slot.
    const installed=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {stored:s.saveData.gearStored?.[1],cash:s.saveData.money,
        active:s.matchingClassGear([0]),
        shop:s.furniturePanel.list.some(o=>typeof o.text==='string'&&o.text.includes('TRAINING EQUIPMENT'))};
    });
    assert.equal(installed.stored,false);
    assert.equal(installed.cash,345);
    assert.equal(installed.active,2,'Installed Thai Pads add a second striking bonus');
    assert.equal(installed.shop,true,'Fixed-slot purchase returns to the shop');
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.beginGearPlacement(0);
      s.storeSelection();
    });
    gear=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {stored:s.saveData.gearStored[0],bonus:s.matchingClassGear([0])};
    });
    assert.deepEqual(gear,{stored:true,bonus:1},
      'Storing the heavy bag leaves only the wall-mounted Thai pads active');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    assert.deepEqual(await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return [s.saveData.gearStored[0],s.saveData.gearStored[1],s.matchingClassGear([0])];
    }),[true,false,1],'Stored floor gear and installed wall gear persist across reload');
  });

  await openScenario('level-2-equipment-zone-and-preview',sampleSave({
    gymLevel:2,money:500,materials:[20,20,20],
    ownedGear:[true,false,false,false,true,false,false,false],
    gearStored:[true,false,false,false,true,false,false,false]
  }),async page=>{
    const result=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.beginGearPlacement(0);
      const striking={...s.placementCursor};
      const strikingValid=s.validGearPlacement(striking.x,striking.y,9,12,0);
      const strikingWrong=s.validGearPlacement(120,175,9,12,0);
      s.cancelPlacement();
      s.beginGearPlacement(4);
      const strength={...s.placementCursor};
      const strengthValid=s.validGearPlacement(strength.x,strength.y,14,11,4);
      const strengthWrong=s.validGearPlacement(120,115,14,11,4);
      return {striking,strikingValid,strikingWrong,strength,strengthValid,strengthWrong};
    });
    assert.equal(result.strikingValid,true,'Striking gear begins in an available training zone');
    assert.equal(result.strikingWrong,false,'Striking gear cannot be placed in strength area');
    assert.equal(result.strengthValid,true,'Weight gear begins in an available strength zone');
    assert.equal(result.strengthWrong,false,'Weight gear cannot be placed in striking area');
  });

  await openScenario('build-placement-collision-recovery',sampleSave({
    gymLevel:1,money:500,materials:[20,20,20],
    furniture:[{kind:1,x:168,y:144,rotation:0,stored:false},
      {kind:0,x:168,y:144,rotation:0,stored:true}],
    decorLevel:3,decorStored:[true,true,true],
    ownedGear:[true,true,false,false,false,false,false,false],
    gearStored:[true,false,false,false,false,false,false,false]
  }),async page=>{
    const result=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.selectFurniture(1);
      const furniture={...s.placementCursor};
      const furnitureValid=s.validPlacement(furniture.x,furniture.y,9,9,-1,1);
      s.cancelPlacement();
      s.beginDecorPlacement(2);
      const plant={...s.placementCursor};
      const plantValid=s.decorFits(plant.x,plant.y);
      s.cancelPlacement();
      s.beginGearPlacement(0);
      const bag={...s.placementCursor};
      const bagValid=s.validGearPlacement(bag.x,bag.y,9,12,0);
      s.cancelPlacement();
      s.beginGearPlacement(1);
      const wallBlocked=s.placingGear===-1;
      return {furniture,furnitureValid,plant,plantValid,bag,bagValid,wallBlocked};
    });
    assert.equal(result.furnitureValid,true,'Stored furniture starts at a free placement point');
    assert.equal(result.plantValid,true,'Stored plant starts at a free placement point');
    assert.equal(result.bagValid,true,'Stored training gear starts at a free placement point');
    assert.equal(result.wallBlocked,true,'Fixed wall gear never enters floor placement mode');
  });

  await openScenario('furniture-and-decor-purchase-choice',sampleSave({
    money:600,reputation:20,materials:[20,20,20],furniture:[],decorLevel:0
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openFurniture('shop'));
    await clickGame(page,137,83); // Floor lamp.
    let state=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {prompt:s.furniturePanel.list.some(o=>o.text==='ITEM PURCHASED'),
        count:s.saveData.furniture.length,stored:s.saveData.furniture[0].stored};
    });
    assert.deepEqual(state,{prompt:true,count:1,stored:true});
    await clickGame(page,153,194); // Place lamp immediately.
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.placeFurniture(120,150);
    });
    assert.equal(await page.evaluate(()=>
      window.__combatGym.scene.getScene('Gym').saveData.furniture[0].stored),false);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openFurniture('shop'));
    await clickGame(page,145,110); // Bench.
    await clickGame(page,310,194); // Store.
    assert.equal(await page.evaluate(()=>
      window.__combatGym.scene.getScene('Gym').saveData.furniture[1].stored),true);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openUpgradePurchase('decor'));
    await clickGame(page,191,183); // Buy gym banner.
    state=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {prompt:s.furniturePanel.list.some(o=>o.text==='ITEM PURCHASED'),
        decor:s.saveData.decorLevel,stored:s.saveData.decorStored[0]};
    });
    assert.deepEqual(state,{prompt:true,decor:1,stored:true});
    await clickGame(page,312,197); // Store banner.
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.beginDecorPlacement(0);
      s.coach.place(415,171);
      s.placeDecor(210,150);
    });
    const placed=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {stored:s.saveData.decorStored[0],pos:s.saveData.decorPositions[0]};
    });
    assert.deepEqual(placed,{stored:false,pos:{x:210,y:150}});
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    assert.equal(await page.evaluate(()=>
      window.__combatGym.scene.getScene('Gym').saveData.decorStored[0]),false);
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
    await clickGame(page,300,195); // Start session one.
    await finishScheduledClass(page);
    assert.equal((await sceneState(page)).classesToday,1);
    await clickGame(page,158,204); // Class result → schedule.
    await clickGame(page,135,146); // Assign Grappling to afternoon slot.
    assert.deepEqual((await sceneState(page)).classPlan,[3,2]);
    await clickGame(page,300,195); // Start session two.
    await finishScheduledClass(page);
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
        inner:scene.validPlacement(180,125,8,8),
        outside:scene.validPlacement(310,132,8,8)};
    });
    assert.equal(valid.edge,false,'Garage must reject equipment outside its smaller mat');
    assert.equal(valid.inner,true,'Garage must permit clear usable equipment placements');
    assert.equal(valid.outside,false);
  });

  await openScenario('level-5-attendance',sampleSave({gymLevel:5,enrolledStudents:12,
    friendships:Array(12).fill(0),skills:Array(12).fill(0),money:99999,day:2}),async page=>{
    const state=await sceneState(page);
    assert.equal(state.level,5);
    assert.equal(state.enrolled,12);
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
    assert.equal((await sceneState(page)).activeNames.length,0,
      'Following day begins with an empty room before opening');
    await page.evaluate(()=>{
      const scene=window.__combatGym.scene.getScene('Gym');
      scene.advanceGymPhase();
      scene.arrivalsClock=4;
      scene.updateArrivals(0.1);
    });
    assert.equal((await sceneState(page)).activeNames[0],'Holly',
      "Next day attending group arrives after opening");
  });

  // Coaching assignments must not jump between students during staggered arrivals.
  await openScenario('stable-coaching-requests-during-arrivals',sampleSave({
    gymLevel:2,enrolledStudents:6,friendships:Array(6).fill(0),
    skills:Array(6).fill(0),day:2,gymPhase:'open',arrivedCount:1
  }),async page=>{
    const before=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.updateIndicators();
      return {requests:s.requestStudentIds(),present:s.activeStudents().map(t=>s.students.indexOf(t)),
        visible:s.students.map((t,i)=>t.indicator?.visible?i:-1).filter(i=>i>=0)};
    });
    assert.equal(before.requests.length,2);
    assert.ok(before.requests.every(i=>!before.visible.includes(i)||before.present.includes(i)));
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.arrivalsClock=4;s.updateArrivals(0.01);s.updateIndicators();
    });
    const after=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {requests:s.requestStudentIds(),present:s.activeStudents().map(t=>s.students.indexOf(t)),
        visible:s.students.map((t,i)=>t.indicator?.visible?i:-1).filter(i=>i>=0)};
    });
    assert.deepEqual(after.requests,before.requests,
      'Daily coaching assignments cannot change as students arrive');
    assert.ok(after.visible.every(i=>after.present.includes(i)),
      'Only physically present students may show coaching prompts');
  });

  await openScenario('management-roster-and-class-day-controls',sampleSave({
    gymPhase:'open',arrivedCount:2,classesToday:0,enrolledStudents:4
  }),async page=>{
    const state=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.openGymUpgrades();
      const menu=s.furniturePanel.list.map(o=>o.text||'');
      const rosterButton=s.furniturePanel.list.find(o=>o.text==='STUDENT ROSTER');
      return {menu,hasRoster:!!rosterButton};
    });
    assert.ok(state.hasRoster,'Manage Gym should offer direct student roster access');
    assert.ok(state.menu.includes('SUPPLY ORDERS'),'Supply ordering should be accessible from management');
    assert.ok(state.menu.includes('DAILY GYM PLAN'),'Daily operations should be accessible from management');
    assert.ok(state.menu.includes('EXPAND / UPGRADE'),'Gym expansion should remain accessible');
    assert.ok(state.menu.includes('EDIT COACH'),'Coach wardrobe should remain accessible');
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.furniturePanel.setVisible(false);
      s.showRosterPage();
    });
    const roster=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {visible:s.rosterPanel.visible,title:s.rosterPanel.list.some(o=>o.text==='STUDENT ROSTER')};
    });
    assert.deepEqual(roster,{visible:true,title:true});
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.rosterPanel.setVisible(false);
      s.openDailyHubPlan();
    });
    const dayPlan=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return s.furniturePanel.list.filter(o=>o.text==='CLOSE GYM').length;
    });
    assert.equal(dayPlan,1);
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.advanceGymPhase();
    });
    assert.equal((await sceneState(page)).classesToday,0,'Gym cannot close without teaching');
  });

  await openScenario('release-candidate-phase-controls',sampleSave({
    gymPhase:'open',arrivedCount:2,classesToday:0
  }),async page=>{
    const initial=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.updatePhaseDisplay();
      return {action:s.phaseActionText.text,status:s.phaseStatus.text};
    });
    assert.equal(initial.action,'TEACH FIRST');
    assert.match(initial.status,/2 PRESENT \/ 0\/2 CLASSES/);
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.simulateClass(0,0.75,false);
      s.updatePhaseDisplay();
    });
    const after=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {action:s.phaseActionText.text,status:s.phaseStatus.text};
    });
    assert.equal(after.action,'CLOSE GYM');
    assert.match(after.status,/2 PRESENT \/ 1\/2 CLASSES/);
  });

  // Full multi-day hub regression: unfinished services, delayed supplies and
  // rotating attendance must remain consistent across class days and reloads.
  await openScenario('three-day-hub-continuity',sampleSave({
    gymLevel:3,enrolledStudents:8,friendships:Array(8).fill(0),
    skills:Array(8).fill(0),money:900,supplies:[1,2,1,2],
    pendingSupplies:[3,0,0,0],gymPhase:'opening',arrivedCount:0,
    waterLevel:42,matCleanliness:55,
    trashSpawnedToday:6,gatheredToday:[0,1],day:1
  }),async page=>{
    const initial=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {day:s.saveData.day,phase:s.dayPhase(),
        attending:s.todaysStudents().map(t=>t.name),
        water:s.saveData.waterLevel,trash:s.saveData.trashSpawnedToday};
    });
    assert.equal(initial.phase,'opening');
    assert.equal(initial.attending.length,6);
    assert.equal(initial.trash,6);
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.advanceGymPhase();
      for(let i=0;i<6;i++){s.arrivalsClock=4;s.updateArrivals(0.01);}
      s.simulateClass(0,0.75,false);
      s.advanceGymPhase();
      for(let i=0;i<6;i++){s.arrivalsClock=3;s.updateArrivals(0.01);}
    });
    assert.equal((await sceneState(page)).activeNames.length,0);
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('Gym')?.sys.isActive());
    const closed=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {phase:s.dayPhase(),water:s.saveData.waterLevel,
        mat:s.saveData.matCleanliness,money:s.saveData.money,
        remainingTrash:s.saveData.trashSpawnedToday-(s.saveData.gatheredToday?.length||0)};
    });
    assert.equal(closed.phase,'closing');
    assert.ok(closed.water<initial.water);
    assert.ok(closed.mat<55);
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').nextDay());
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===2);
    const second=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {phase:s.dayPhase(),stock:s.saveData.supplies[0],
        pending:s.saveData.pendingSupplies[0],trash:s.saveData.trashSpawnedToday,
        cleaned:s.saveData.gatheredToday.length,water:s.saveData.waterLevel,
        mat:s.saveData.matCleanliness,attending:s.todaysStudents().map(t=>t.name)};
    });
    assert.equal(second.phase,'opening');
    assert.equal(second.stock,4);
    assert.equal(second.pending,0);
    assert.equal(second.trash,closed.remainingTrash);
    assert.equal(second.cleaned,0);
    assert.equal(second.water,closed.water);
    assert.equal(second.mat,closed.mat);
    assert.notDeepEqual(second.attending,initial.attending);
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.advanceGymPhase();
      for(let i=0;i<6;i++){s.arrivalsClock=4;s.updateArrivals(0.01);}
      s.simulateClass(0,0.75,false);
      s.advanceGymPhase();
      for(let i=0;i<6;i++){s.arrivalsClock=3;s.updateArrivals(0.01);}
      s.nextDay();
    });
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym').saveData.day===3);
    const third=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {phase:s.dayPhase(),stock:s.saveData.supplies[0],
        trash:s.saveData.trashSpawnedToday,water:s.saveData.waterLevel,
        attending:s.todaysStudents().map(t=>t.name)};
    });
    assert.equal(third.phase,'opening');
    assert.equal(third.stock,4);
    assert.equal(third.trash,second.trash+4);
    assert.ok(third.water<=second.water);
    assert.notDeepEqual(third.attending,second.attending);
  });

  // Multi-room release gate: unlocks, identical sprite scaling, owned gear
  // placed in a different room, resource collection and return to the hub.
  await openScenario('four-room-navigation-and-assets',sampleSave({
    gymLevel:5,enrolledStudents:12,friendships:Array(12).fill(0),
    skills:Array(12).fill(0),gymPhase:'open',arrivedCount:8,
    money:1500,supplies:[2,2,2,3],materials:[0,0,0],
    ownedGear:[true,false,false,false,false,false,false,false],
    gearStored:[true,true,true,true,true,true,true,true],
    gearPositions:[{x:120,y:150}]
  }),async page=>{
    const doors=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {names:s.gymLevel(),roomCount:s.saveData.roomState?.studentRooms.length||0,
        assigned:s.saveData.roomState?.studentRooms?.slice(0,8),
        exits:s.children.list.filter(o=>o?.list?.some?.(x=>x?.text==='UP')).length};
    });
    assert.equal(doors.names,5);
    assert.equal(doors.roomCount,12,'All members must have a room assignment');
    assert.ok(doors.assigned.includes('outdoor'));
    assert.ok(doors.assigned.includes('upstairs'));
    assert.ok(doors.assigned.includes('downstairs'));
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').visitRoom('outdoor'));
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('GymRoom')?.sys.isActive());
    const initial=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return {room:s.current,npcs:s.students.length,
        level:s.level,gear:s.displayItems.length,
        coachTexture:s.coach.getTextureKey(),litter:s.roomState.trashByRoom.outdoor};
    });
    assert.equal(initial.room,'outdoor');
    assert.equal(initial.level,5);
    assert.ok(initial.npcs>0,'Outdoor room must show assigned students');
    assert.ok(initial.coachTexture.startsWith('coach-custom-')||
      initial.coachTexture.startsWith('gym-character-')||
      initial.coachTexture==='combat-culture-actor-art',
      'Room coach must retain a real sprite texture');
    assert.deepEqual(initial.litter,[0,1,2]);
    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      s.moveItem({kind:'gear',index:0,x:120,y:145,rotation:0});
    });
    await clickGame(page,180,145);
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('GymRoom')
      ?.displayItems?.some(i=>i.kind==='gear'&&i.index===0));
    const placed=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return {owned:s.save.ownedGear[0],stored:s.save.gearStored[0],
        room:s.roomState.gearRooms[0],pos:s.save.gearPositions[0],
        artwork:s.displayItems.length};
    });
    assert.equal(placed.owned,true);
    assert.equal(placed.stored,false);
    assert.equal(placed.room,'outdoor');
    assert.deepEqual(placed.pos,{x:180,y:144});
    assert.ok(placed.artwork>=1);
    await page.screenshot({path:output+'/room-outdoor-with-heavy-bag.png'});
    await page.evaluate(()=>window.__combatGym.scene.getScene('GymRoom').cleanTrash(0));
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('GymRoom')
      ?.roomState?.trashByRoom?.outdoor?.length===2);
    const afterTrash=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return {stock:s.save.materials,trash:s.roomState.trashByRoom.outdoor};
    });
    assert.equal(afterTrash.stock[0],1);
    assert.deepEqual(afterTrash.trash,[1,2]);
    for(const index of [0,1,2]){
      await page.evaluate(i=>window.__combatGym.scene.getScene('GymRoom').mopSpot(i),index);
      await page.waitForTimeout(100);
    }
    const mop=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return {done:s.roomState.moppedByRoom.outdoor,stock:s.save.supplies[3],rep:s.save.reputation};
    });
    assert.deepEqual(mop.done,[0,1,2]);
    assert.equal(mop.stock,2,'One sanitizer is used only on completion');
    assert.ok(mop.rep>=1);
    await page.evaluate(()=>window.__combatGym.scene.getScene('GymRoom').goTo('main'));
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym')?.sys.isActive());
    const home=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {gear:s.saveData.gearStored[0],room:s.saveData.roomState.gearRooms[0],
        onFloor:s.solidFootprints().some(o=>o.x===180&&o.y===144)};
    });
    assert.equal(home.gear,false);
    assert.equal(home.room,'outdoor');
    assert.equal(home.onFloor,false,'Other-room equipment must not block main-room paths');
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym')?.sys.isActive());
    const persisted=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {room:s.saveData.roomState.gearRooms[0],
        cleaned:s.saveData.roomState.trashByRoom.outdoor,
        mop:s.saveData.roomState.moppedByRoom.outdoor};
    });
    assert.equal(persisted.room,'outdoor');
    assert.deepEqual(persisted.cleaned,[1,2]);
    assert.deepEqual(persisted.mop,[0,1,2]);
  });

  await openScenario('room-unlock-gates',sampleSave({
    gymLevel:2,enrolledStudents:6,friendships:Array(6).fill(0),
    skills:Array(6).fill(0)
  }),async page=>{
    const before=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.visitRoom('outdoor');
      return {active:s.sys.isActive(),level:s.gymLevel()};
    });
    assert.deepEqual(before,{active:true,level:2},
      'The outdoor area must not be accessible until Level 3');
  });

  await openScenario('menu-travel-walks-to-physical-door',sampleSave({
    gymLevel:5,enrolledStudents:12,friendships:Array(12).fill(0),
    skills:Array(12).fill(0),gymPhase:'opening',arrivedCount:0
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').openRoomTravel());
    await clickGame(page,319,102);
    const intent=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {active:s.sys.isActive(),target:s.roomExitTarget,
        moving:s.route.length>0,panel:s.furniturePanel.visible};
    });
    assert.deepEqual(intent,{active:true,target:'outdoor',moving:true,panel:false},
      'Choosing a room in Manage must not teleport the coach');
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('GymRoom')?.sys.isActive(),
      null,{timeout:15000});
    assert.equal(await page.evaluate(()=>window.__combatGym.scene.getScene('GymRoom').current),
      'outdoor');
  });

  // Inspect the art and player/navigation paths of every unlocked room.
  await openScenario('all-additional-rooms-visual-playtest',sampleSave({
    gymLevel:5,enrolledStudents:12,friendships:Array(12).fill(0),
    skills:Array(12).fill(0),money:900,day:4,
    gymPhase:'open',arrivedCount:8
  }),async page=>{
    const visits=[
      {id:'outdoor',door:{x:44,y:132}},
      {id:'upstairs',door:{x:310,y:115}},
      {id:'downstairs',door:{x:44,y:191}}
    ];
    for(const room of visits){
      await clickGame(page,room.door.x,room.door.y);
      const clicked=await page.evaluate(()=>{
        const game=window.__combatGym;
        const main=game.scene.getScene('Gym');
        return {activeMain:main.sys.isActive(),exitIntent:main.roomExitTarget,
          waypoints:main.route.length};
      });
      assert.equal(clicked.activeMain,true,'Door clicks must not teleport the coach');
      assert.equal(clicked.exitIntent,room.id,'Door click should initiate a walk');
      assert.ok(clicked.waypoints>=1,'Door click should compute a real walking path');
      await page.waitForFunction(id=>{
        const game=window.__combatGym;
        const scene=game?.scene.getScene('GymRoom');
        return scene?.sys.isActive()&&scene.current===id;
      },room.id,{timeout:15000});
      const check=await page.evaluate(()=>{
        const s=window.__combatGym.scene.getScene('GymRoom');
        return {name:s.current,students:s.students.length,
          player:s.coach.body.getBounds().height,gear:s.displayItems.length,
          ui:s.status.text};
      });
      assert.equal(check.name,room.id);
      assert.ok(check.students>=1,'Every room has visiting students');
      assert.ok(check.player>=31&&check.player<=42,
        'Character must stay within the 31-42px gameplay sprite scale');
      await page.screenshot({path:output+'/room-'+room.id+'-before-building.png'});
      // Side wings are navigable, but never item-placement zones.
      const wing=await page.evaluate(()=>{
        const s=window.__combatGym.scene.getScene('GymRoom');
        const start={x:s.coach.body.x,y:s.coach.body.y};
        const left={x:45,y:184},right={x:427,y:184};
        return {left:s.canStand(left.x,left.y),right:s.canStand(right.x,right.y),
          pathLeft:s.navigation.route(start,left).length,
          pathRight:s.navigation.route(start,right).length};
      });
      assert.deepEqual([wing.left,wing.right],[true,true],
        'Both non-mat wings must remain walkable in '+room.id);
      assert.ok(wing.pathLeft>0&&wing.pathRight>0,
        'Pathfinding must reach both wings in '+room.id);
      const wingDestination=room.id==='outdoor'?{x:427,y:184}:{x:45,y:184};
      await clickGame(page,wingDestination.x,wingDestination.y);
      await page.waitForFunction(p=>{
        const s=window.__combatGym.scene.getScene('GymRoom');
        return s.sys.isActive()&&Math.hypot(s.coach.body.x-p.x,s.coach.body.y-p.y)<9;
      },wingDestination,{timeout:15000});
      await page.screenshot({path:output+'/room-'+room.id+'-walkable-side-floor.png'});
      const returnDoor=room.id==='outdoor'?{x:443,y:146}:room.id==='upstairs'?{x:68,y:151}:{x:68,y:152};
      await clickGame(page,returnDoor.x,returnDoor.y);
      const leaving=await page.evaluate(()=>{
        const s=window.__combatGym.scene.getScene('GymRoom');
        return {active:s.sys.isActive(),intent:s.pendingExit,waypoints:s.path.length};
      });
      assert.equal(leaving.active,true,'Exiting a room must walk first, not warp');
      assert.equal(leaving.intent,'main');
      assert.ok(leaving.waypoints>0);
      await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym')?.sys.isActive(),null,{timeout:15000});
      const landing=await page.evaluate(()=>{
        const gym=window.__combatGym.scene.getScene('Gym');
        return gym.canStand(gym.player.x,gym.player.y);
      });
      assert.equal(landing,true,'Returning from '+room.id+' must use a walkable landing');
    }
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').visitRoom('downstairs'));
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('GymRoom')?.sys.isActive());
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__combatGym?.scene.getScene('GymRoom')?.sys.isActive());
    assert.equal(await page.evaluate(()=>window.__combatGym.scene.getScene('GymRoom').current),
      'downstairs','Browser reload must reopen the visited room');
    await page.evaluate(()=>window.__combatGym.scene.getScene('GymRoom').goTo('main'));
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('Gym')?.sys.isActive());
  });

  await openScenario('compact-room-feedback-regressions',sampleSave({
    gymLevel:5,enrolledStudents:12,friendships:Array(12).fill(0),
    skills:Array(12).fill(0),day:4,gymPhase:'open',arrivedCount:8,
    supplies:[2,2,2,3],materials:[0,0,0],ownedGear:[true],
    gearStored:[true],gearPositions:[{x:180,y:148}]
  }),async page=>{
    await page.evaluate(()=>window.__combatGym.scene.getScene('Gym').visitRoom('outdoor'));
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('GymRoom')?.sys.isActive());
    const initial=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return {mopping:s.mopActive,marks:s.mopMarks.length,
        inside:s.canStand(240,165),outside:s.canStand(430,165),
        boundary:s.canStand(477,165),students:s.students.length};
    });
    assert.equal(initial.mopping,false,'Mopping should not start on room entry');
    assert.equal(initial.marks,0,'Mop target circles must remain hidden by default');
    assert.equal(initial.inside,true);
    assert.equal(initial.outside,true,'The yard side floor is walkable');
    assert.equal(initial.boundary,false,'The solid exterior wall still blocks movement');
    assert.ok(initial.students>=1,'At least one NPC appears in the outside gym');

    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      s.coach.place(250,178);
      s.moveItem({kind:'gear',index:0,x:180,y:148,rotation:0});
      s.placeAt(180,147);
    });
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('GymRoom')
      ?.displayItems?.some(i=>i.kind==='gear'&&i.index===0));
    const afterPlace=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return {x:s.coach.body.x,y:s.coach.body.y,room:s.roomState.gearRooms[0]};
    });
    assert.deepEqual(afterPlace,{x:250,y:178,room:'outdoor'},
      'Placing equipment must not teleport the player to the room entrance');

    await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      s.cleanTrash(0);
    });
    await page.waitForFunction(()=>window.__combatGym.scene.getScene('GymRoom')
      ?.roomState?.trashByRoom?.outdoor?.length===2);
    const afterPickup=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return {x:s.coach.body.x,y:s.coach.body.y,marks:s.mopMarks.length};
    });
    assert.deepEqual(afterPickup,{x:250,y:178,marks:0},
      'Picking up litter must preserve player position and keep mop activity off');

    await page.evaluate(()=>window.__combatGym.scene.getScene('GymRoom').beginMop());
    const during=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return {mopping:s.mopActive,marks:s.mopMarks.length};
    });
    assert.deepEqual(during,{mopping:true,marks:3},
      'Mop markers appear only after intentionally activating the mop');

    const nearbyStudent=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      s.targetMop=null;s.path=[];
      const npc=s.students[0];
      s.coach.place(npc.actor.body.x+9,npc.actor.body.y);
      return {x:npc.actor.body.x,y:npc.actor.body.y-17};
    });
    await clickGame(page,nearbyStudent.x,nearbyStudent.y);
    const talked=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return {bubble:s.students[0]?.chat.visible,panel:!!s.inventoryPanel};
    });
    assert.ok(talked.bubble||talked.panel,
      'Clicking a nearby student outside must open conversation or coaching');

    const distantStudent=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      s.closeInventory();
      const npc=s.students[0];
      npc.pause=999;npc.chat.setVisible(false);
      const offset=npc.actor.body.x<240?88:-88;
      s.coach.place(npc.actor.body.x+offset,npc.actor.body.y);
      return {x:npc.actor.body.x,y:npc.actor.body.y-17};
    });
    await clickGame(page,distantStudent.x,distantStudent.y);
    await page.waitForFunction(()=>{
      const s=window.__combatGym.scene.getScene('GymRoom');
      return s.pendingStudent===null&&
        (s.students[0]?.chat.visible||!!s.inventoryPanel);
    },null,{timeout:10000});
  });

  // Exercise the entire opening -> arrivals -> class -> closing -> next day
  // lifecycle, including carryover maintenance and overnight deliveries.
  await openScenario('full-day-lifecycle-and-carryover',sampleSave({
    gymLevel:1,gymPhase:'opening',arrivedCount:0,day:4,
    money:350,reputation:12,classesToday:0,classesTaught:2,
    supplies:[2,1,0,0],pendingSupplies:[3,2,1,0],
    waterLevel:18,towelLevel:22,paperLevel:17,matCleanliness:26,
    trashSpawnedToday:5,gatheredToday:[0,1],
    ownedGear:[true,false,false,false,false,false,false,false],
    gearStored:[true,false,false,false,false,false,false,false]
  }),async page=>{
    const before=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      const initial={phase:s.dayPhase(),present:s.activeStudents().length};
      s.advanceGymPhase();
      const opened=s.dayPhase();
      s.updateArrivals(1000);
      s.updateArrivals(1000);
      const present=s.activeStudents().length;
      s.simulateClass(0,0.7,false);
      const taught=s.saveData.classesToday;
      s.advanceGymPhase();
      const closing=s.dayPhase();
      s.updateArrivals(1000);
      s.updateArrivals(1000);
      const departed=s.activeStudents().length;
      const carry={
        water:s.saveData.waterLevel,towels:s.saveData.towelLevel,
        paper:s.saveData.paperLevel,mat:s.saveData.matCleanliness,
        trash:s.saveData.trashSpawnedToday-(s.saveData.gatheredToday?.length||0),
        supplies:[...s.saveData.supplies],pending:[...s.saveData.pendingSupplies]
      };
      s.advanceGymPhase();
      return {initial,opened,present,taught,closing,departed,carry};
    });
    assert.deepEqual(before.initial,{phase:'opening',present:0});
    assert.equal(before.opened,'open');
    assert.equal(before.present,2,'Students arrive one at a time');
    assert.equal(before.taught,1,'Class completes in open phase');
    assert.equal(before.closing,'closing');
    assert.equal(before.departed,0,'Students leave before next day');
    await page.waitForFunction(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return s.sys.isActive()&&s.saveData.day===5;
    },null,{timeout:15000});
    const after=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {day:s.saveData.day,phase:s.dayPhase(),present:s.activeStudents().length,
        classes:s.saveData.classesToday,water:s.saveData.waterLevel,
        towels:s.saveData.towelLevel,paper:s.saveData.paperLevel,
        mat:s.saveData.matCleanliness,trash:s.saveData.trashSpawnedToday,
        gathered:s.saveData.gatheredToday.length,
        supplies:s.saveData.supplies,pending:s.saveData.pendingSupplies};
    });
    assert.equal(after.phase,'opening');
    assert.equal(after.present,0);
    assert.equal(after.classes,0);
    for(const key of ['water','towels','paper','mat'])
      assert.equal(after[key],before.carry[key],key+' maintenance must persist overnight');
    assert.equal(after.trash,before.carry.trash,'Uncollected trash must carry over');
    assert.equal(after.gathered,0,'Daily trash tracking resets');
    assert.deepEqual(after.pending,[0,0,0,0],'Overnight delivery queue clears');
    assert.deepEqual(after.supplies,before.carry.supplies.map((n,i)=>n+before.carry.pending[i]),
      'Ordered supplies arrive next morning');
  });

  await openScenario('no-phantom-training-gear',sampleSave({
    gymLevel:2,equipment:3,ownedGear:Array(8).fill(false),
    gearStored:Array(8).fill(false)
  }),async page=>{
    const state=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return s.stations.map(station=>station.id);
    });
    assert.ok(!state.includes('legacy-bag'),'Legacy upgrade cannot create a free bag');
    assert.ok(!state.includes('legacy-weights'),'Legacy upgrade cannot create free weights');
    assert.ok(!state.some(id=>id.startsWith('gear-')),'No purchased equipment means no gear stations');
  });
  await openScenario('installed-equipment-npc-stations',sampleSave({
    gymLevel:2,ownedGear:[true,true,true,true,true,true,true,true],
    gearStored:[false,false,false,false,false,false,false,false],
    gearPositions:[{x:85,y:115},{x:116,y:94},{x:218,y:94},
      {x:175,y:115},{x:85,y:175},{x:130,y:175},
      {x:195,y:175},{x:260,y:175}]
  }),async page=>{
    const state=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return s.stations.map(station=>station.id);
    });
    for(const i of [0,3,4,5,6,7])
      assert.ok(state.includes('gear-'+i),'Installed floor gear '+i+' needs a student station');
    for(const i of [1,2])
      assert.ok(!state.includes('gear-'+i),'Wall gear should not occupy the floor');
  });

  await openScenario('equipment-maintenance-controls-student-activities',sampleSave({
    gymLevel:2,gymPhase:'open',arrivedCount:1,ownedGear:[true,false,false,false,true],
    gearStored:[false,false,false,false,false],
    gearPositions:[{x:85,y:115},null,null,null,{x:85,y:175}],
    gearCondition:[100,100,100,100,100],
    gearCleanliness:[100,100,100,100,100]
  }),async page=>{
    const checks=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      const bag=s.stations.find(station=>station.id==='gear-0');
      const bench=s.stations.find(station=>station.id==='gear-4');
      if(!bag||!bench)throw Error('Purchased gear stations not rendered');
      const valid=s.stationUsable(bag)&&s.stationUsable(bench);
      s.saveData.gearCondition[0]=0;
      const broken=!s.stationUsable(bag)&&s.stationUsable(bench);
      s.saveData.gearCondition[0]=100;
      s.saveData.gearCleanliness[0]=0;
      const dirty=!s.stationUsable(bag);
      s.saveData.gearCleanliness[0]=100;
      s.saveData.gearStored[0]=true;
      const stored=!s.stationUsable(bag);
      s.saveData.gearStored[0]=false;
      const restored=s.stationUsable(bag);
      const student=s.activeStudents()[0];
      if(!student)throw Error('Expected student present for interruption test');
      let interrupted=false;
      {
        s.saveData.gearCondition[0]=0;
        student.routine={pose:'bag',goal:{x:bag.x,y:bag.y},route:[],
          remaining:5,elapsed:0,station:bag};
        s.updateStudentLife(0.016);
        interrupted=student.routine.station!==bag;
        s.saveData.gearCondition[0]=100;
      }
      return {valid,broken,dirty,stored,restored,interrupted};
    });
    for(const [condition,passed] of Object.entries(checks))
      assert.ok(passed,'Equipment activity condition failed: '+condition);
  });

  await openScenario('water-cooler-runs-out-during-activity',sampleSave({
    gymLevel:1,waterLevel:50
  }),async page=>{
    const state=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      const cooler=s.stations.find(station=>station.id==='water-cooler');
      if(!cooler)throw Error('Water cooler station not present');
      const full=s.stationUsable(cooler);
      s.saveData.waterLevel=0;
      const empty=!s.stationUsable(cooler);
      s.saveData.waterLevel=60;
      const refilled=s.stationUsable(cooler);
      return {full,empty,refilled};
    });
    for(const [condition,passed] of Object.entries(state))
      assert.ok(passed,'Water station state failed: '+condition);
  });

  // Graphics must be the actual cropped sprite atlas, not more hand-drawn
  // stand-ins. These tests also catch missing Vite asset URLs on GitHub Pages.
  await openScenario('level-one-imported-hub-art',sampleSave({
    gymLevel:1
  }),async page=>{
    const art=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {
        services:s.serviceHotspots.map(s=>({
          type:s.type,texture:s.art?.texture?.key,frame:s.art?.frame?.name,
          visible:s.art?.visible,hit:!!s.hit?.input?.enabled
        })),
        loaded:s.textures.exists('combat-culture-hub-art'),
        frames:s.textures.get('combat-culture-hub-art').getFrameNames(),
        placed:s.children.list.filter(object=>object.texture?.key==='combat-culture-hub-art')
          .map(object=>object.frame?.name)
      };
    });
    assert.ok(art.loaded,'Approved hub art atlas failed to load');
    for(const name of ['garage-door','training-mat-tile','gym-banner','water-cooler','supply-shelf'])
      assert.ok(art.placed.includes(name),'Missing Level 1 imported art: '+name);
    assert.ok(art.frames.includes('heavy-bag'),'Gear artwork was not registered');
    for(const type of ['phone','water','stock','mop']){
      const item=art.services.find(s=>s.type===type);
      assert.ok(item?.visible&&item?.hit&&item.texture?.startsWith('combat-culture-'),
        'Approved service artwork should have a working physical hotspot: '+type);
    }
  });
  await openScenario('level-two-purchased-gear-art',sampleSave({
    gymLevel:2,ownedGear:[true,false,false,false,true,true],
    gearStored:[false,false,false,false,false,false],
    gearPositions:[{x:85,y:115},null,null,null,{x:85,y:175},{x:135,y:175}]
  }),async page=>{
    const frames=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return s.children.list.filter(object=>['combat-culture-hub-art',
        'combat-culture-level-2-art'].includes(object.texture?.key))
        .map(object=>object.frame?.name);
    });
    for(const name of ['heavy-bag-l2','bench-l2','kettlebell-rack','water-cooler-l2','supply-shelf','gym-banner'])
      assert.ok(frames.includes(name),'Missing Level 2 equipment art: '+name);
    assert.equal(frames.filter(name=>name==='training-mat-tile').length,2,
      'Level 2 uses two independent square-edged training mat zones');
  });

  // A stretched perspective mat used to produce jagged diagonal borders.
  // Verify source-art tiling fills the actual collision footprint instead.
  for(const [level,expected] of [
    [1,[{x:72,y:105,w:204,h:83}]],
    [2,[{x:57,y:95,w:235,h:43},{x:57,y:155,w:235,h:43}]]
  ]){
    await openScenario('mat-and-student-layout-level-'+level,sampleSave({
      gymLevel:level,gymPhase:'open',arrivedCount:level===1?4:5,
      enrolledStudents:level===1?4:5
    }),async page=>{
      const visual=await page.evaluate(()=>{
        const s=window.__combatGym.scene.getScene('Gym');
        return {
          mats:s.children.list.filter(o=>o.texture?.key==='combat-culture-hub-art'&&
            o.frame?.name==='training-mat-tile').map(o=>({
              x:o.x,y:o.y,w:o.width,h:o.height,type:o.type
            })).sort((a,b)=>a.y-b.y),
          students:s.activeStudents().map(student=>({
            name:student.name,x:student.x,y:student.y,
            canStand:s.canStand(student.x,student.y)
          }))
        };
      });
      assert.deepEqual(visual.mats.map(({x,y,w,h})=>({x,y,w,h})),expected,
        'Imported mat tiles must match square-edged training zones at Level '+level);
      assert.ok(visual.mats.every(mat=>mat.type==='TileSprite'),
        'The source mat must be repeated as tiles, not perspective-scaled');
      assert.equal(visual.students.length,level===1?4:5,
        'Expected the full Level '+level+' active student group');
      const bounds=level===1?
        {left:70,right:278,top:103,bottom:190}:
        {left:55,right:294,top:93,bottom:200};
      for(const student of visual.students){
        assert.ok(student.x>=bounds.left+8&&student.x<=bounds.right-8&&
          student.y>=bounds.top+35&&student.y<=bounds.bottom-8&&student.canStand,
          student.name+' must start on a navigable training mat, not inside the garage door');
      }
    });
  }

  await openScenario('original-coach-and-student-chibis',sampleSave({
    gymLevel:1
  }),async page=>{
    const actors=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      return {
        atlas:s.textures.exists('combat-culture-actor-art'),
        coach:s.coach.getTextureKey(),
        coachFrame:s.coach.getTextureFrame(),
        students:s.students.slice(0,4).map(x=>({
          name:x.name,texture:x.actor.getTextureKey(),
          frame:x.actor.getTextureFrame()
        }))
      };
    });
    assert.ok(actors.atlas,'Approved character atlas failed to load');
    assert.equal(actors.coach,'combat-culture-actor-art');
    assert.equal(actors.coachFrame,'0-0');
    for(const name of ['Frank','Radish','Pudge'])
      assert.equal(actors.students.find(s=>s.name===name)?.texture,
        'combat-culture-actor-art','Missing original chibi for '+name);
    assert.notEqual(actors.students.find(s=>s.name==='Marshall')?.texture,
      'combat-culture-actor-art',
      'Marshall has no supplied art; should retain the existing fallback');
    const motion=await page.evaluate(()=>{
      const coach=window.__combatGym.scene.getScene('Gym').coach;
      coach.face(1,0);
      coach.animate('walk',0.01);
      const walkStart=coach.image.frame.name;
      coach.animate('walk',0.14);
      const walkStep=coach.image.frame.name;
      coach.animate('drink',0.01);
      const bottleDown=coach.image.frame.name;
      coach.animate('drink',0.6);
      const bottleUp=coach.image.frame.name;
      coach.animate('idle',0);
      return {walkStart,walkStep,bottleDown,bottleUp};
    });
    assert.notEqual(motion.walkStart,motion.walkStep,
      'Imported chibi must animate walking rather than freeze on one frame');
    assert.notEqual(motion.bottleDown,motion.bottleUp,
      'Imported chibi must lift the bottle while drinking');
    await page.screenshot({path:output+'/original-chibis-level-1.png'});
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
    const water=await page.evaluate(()=>{
      const s=window.__combatGym.scene.getScene('Gym');
      s.closePanel();
      const point=s.servicePosition('water');
      s.coach.place(point.x+27,point.y+5);
      return point;
    });
    await page.touchscreen.tap(bounds.x+water.x/480*bounds.width,
      bounds.y+water.y/330*bounds.height);
    assert.equal(await page.evaluate(()=>window.__combatGym.scene.getScene('Gym')
      .furniturePanel.list.some(t=>t.text==='GYM WATER & AMENITIES')),true,
      'The physical cooler should respond to a real mobile touch');
    assert.deepEqual(errors,[],'Mobile view should not emit JS errors');
    await page.screenshot({path:output+'/mobile-garage.png',fullPage:true});
  }finally{await mobile.close();}

  console.log('Browser smoke passed: five distinct levels, garage, menu, placement bounds, class timetable, recruitment/save, expansion/save, 12-student roster, rotating crowded NPCs, and mobile touch.');
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
