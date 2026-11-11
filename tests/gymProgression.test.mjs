import assert from 'node:assert/strict';
import test from 'node:test';
import {dailyHelpStudents,DAILY_SHIFT_CASH,dailyShiftHelpTarget,dailyShiftReady} from '../src/hubActivities.ts';
import {GYM_LEVELS,STUDENT_NAMES,normalizeGymLevel,studentCapacity,enrolledCount,activeStudentCount,recruitmentCost,canExpandGym,attendingIndices,normalizeClassPlan,trainingBounds,gymServiceLayout,CLASS_REPUTATION,classEarnings,dailySupplyPositions,equipmentPlacementZone,fitsEquipmentZone,WALL_EQUIPMENT_SLOTS,isWallEquipment,equipmentXpBonus} from '../src/gymProgression.ts';

test('all five levels have increasing capacity and an on-floor crowd limit',()=>{
  assert.equal(GYM_LEVELS.length,5);
  assert.ok(STUDENT_NAMES.length>=12);
  assert.deepEqual(GYM_LEVELS.map(l=>l.capacity),[4,6,8,10,12]);
  assert.deepEqual(GYM_LEVELS.map(l=>l.active),[4,5,6,7,8]);
  assert.equal(activeStudentCount(12,5),8);
  assert.equal(activeStudentCount(5,2),5);
});
test('old saves remain garage level with four students and recruits cannot overfill',()=>{
  assert.equal(normalizeGymLevel(undefined),1);
  assert.equal(enrolledCount(undefined,1),4);
  assert.equal(enrolledCount(100,1),4);
  assert.equal(enrolledCount(100,2),6);
  assert.equal(studentCapacity(5),12);
});
test('expansion is gated by money, reputation, classes and purchased gear',()=>{
  assert.equal(canExpandGym(1,400,12,8,2),true);
  assert.equal(canExpandGym(1,399,12,8,2),false);
  assert.equal(canExpandGym(1,400,11,8,2),false);
  assert.equal(canExpandGym(1,400,12,7,2),false);
  assert.equal(canExpandGym(1,400,12,8,1),false);
  assert.equal(canExpandGym(5,999999,999,999,24),false);
  assert.equal(recruitmentCost(4),35);
  assert.equal(recruitmentCost(5),60);
});

test('attendance rotates across recruited students without exceeding floor space',()=>{
  assert.deepEqual(attendingIndices(4,1,1),[0,1,2,3]);
  assert.deepEqual(attendingIndices(6,2,1),[0,1,2,3,4]);
  assert.deepEqual(attendingIndices(6,2,2),[5,0,1,2,3]);
  const seen=new Set();
  for(let day=1;day<=6;day++){
    const group=attendingIndices(12,5,day);
    assert.equal(group.length,8);
    for(const student of group)seen.add(student);
  }
  assert.equal(seen.size,12);
  assert.deepEqual(attendingIndices(0,1,1),[]);
});

test('class schedules default safely and only accept four valid programs',()=>{
  assert.deepEqual(normalizeClassPlan(undefined),[0,1]);
  assert.deepEqual(normalizeClassPlan([3,2]),[3,2]);
  assert.deepEqual(normalizeClassPlan([-1,99]),[0,1]);
  assert.deepEqual(normalizeClassPlan([0,'1']),[0,1]);
});

test('garage mat is bounded and higher levels retain the Level 2 training footprint',()=>{
  const spaces=Array.from({length:5},(_,i)=>trainingBounds(i+1));
  const areas=spaces.map(s=>(s.right-s.left)*(s.bottom-s.top));
  for(let i=0;i<spaces.length;i++){
    const b=spaces[i];
    assert.ok(b.left>=25&&b.right<=330,'Mat must not overlap the training board corridor');
    assert.ok(b.top>=75&&b.bottom<=215,'Mat must stay inside the playable gym');
    if(i>1){
      assert.equal(areas[i],areas[1],'Levels 3-5 keep the Level 2 training footprint');
      assert.deepEqual(b,spaces[1]);
    }
  }
  assert.deepEqual(trainingBounds(0),trainingBounds(1));
  assert.deepEqual(trainingBounds(99),trainingBounds(5));
});

test('reception and community board are progressively upgraded with the room',()=>{
  const services=Array.from({length:5},(_,i)=>gymServiceLayout(i+1));
  for(let i=1;i<5;i++){
    const smaller=services[i-1],bigger=services[i];
    assert.ok(bigger.board.w>smaller.board.w,'Community board must get physically wider');
    assert.ok(bigger.board.h>smaller.board.h,'Community board must get taller');
    // Level 1 uses a wide folding table; Level 2 replaces it with a compact
    // purpose-built counter. The desk then expands in Levels 3-5.
    if(i>=2){
      assert.ok(bigger.desk.w>smaller.desk.w,'Reception desk must physically grow after Level 2');
      assert.ok(bigger.desk.h>=smaller.desk.h,'Reception desk must not shrink after Level 2');
    }
    assert.ok(bigger.room.left<=smaller.room.left,'Room must not shrink');
    assert.ok(bigger.room.right>=smaller.room.right,'Room must not shrink');
    if(i>=2)assert.deepEqual(bigger.room,services[1].room,
      'Levels 3 to 5 unlock new rooms rather than enlarging the main room');
  }
  assert.deepEqual(services[2].board,{x:347,y:50,w:112,h:65},'Level 3 upgrades the board without resizing the room');
  assert.deepEqual(services[2].desk,{x:378,y:181,w:82,h:39},'Level 3 upgrades reception inside Level 2 walls');
  assert.ok(services[0].board.w<=70&&services[0].desk.w<=50,'Garage must look makeshift');
  assert.ok(services[4].desk.w>=100,'Flagship must have a real reception counter');
  for(const layout of services){
    const {room,boardApproach,deskApproach}=layout;
    for(const approach of [boardApproach,deskApproach]){
      assert.ok(approach.x>=room.left&&approach.x<=room.right);
      assert.ok(approach.y>=room.top&&approach.y<=room.bottom);
    }
  }
});

test('normal classes alone provide enough reputation for every gym expansion',()=>{
  assert.equal(CLASS_REPUTATION,2);
  assert.equal(classEarnings(1,4),53);
  assert.equal(classEarnings(2,6),76);
  assert.equal(classEarnings(5,12),145);
  assert.equal(classEarnings(3,10,2,3),classEarnings(3,10)+22);
  for(const level of GYM_LEVELS){
    assert.ok(level.reputation<=level.classesTaught*CLASS_REPUTATION,
      'Classes alone must supply enough reputation by the required class milestone');
  }
});

test('each gym has twelve daily piles on its own mat without overlapping indices',()=>{
  for(let level=1;level<=5;level++){
    const supply=dailySupplyPositions(level),b=trainingBounds(level);
    assert.equal(supply.length,12);
    assert.equal(new Set(supply.map(p=>p.x+','+p.y)).size,12);
    for(const point of supply){
      assert.ok(point.x>=b.left&&point.x<=b.right);
      assert.ok(point.y>=b.top&&point.y<=b.bottom);
    }
  }
  assert.deepEqual(dailySupplyPositions(5),dailySupplyPositions(2),
    'Later levels share the Level 2 training room footprint');
});


test('daily shift target adjusts to the students available and never grants an empty-gym reward',()=>{
  assert.equal(dailyShiftHelpTarget(0),0);
  assert.equal(dailyShiftHelpTarget(1),1);
  assert.equal(dailyShiftHelpTarget(4),2);
  assert.equal(dailyShiftReady(0,3,1,false,0),false);
  assert.equal(dailyShiftReady(1,3,1,false,1),true);
  assert.equal(dailyShiftReady(0,3,1,false,1),false);
  assert.equal(dailyShiftReady(1,2,1,false,1),false);
  assert.equal(dailyShiftReady(1,3,0,false,1),false);
  assert.equal(dailyShiftReady(1,3,1,true,1),false);
  assert.equal(dailyShiftReady(1,3,1,false,2),false);
  assert.equal(dailyShiftReady(2,3,1,false,2),true);
});


test('daily coaching requests are stable for the full planned attendance roster',()=>{
  for(let level=1;level<=5;level++){
    const capacity=GYM_LEVELS[level-1].capacity;
    for(let day=1;day<=8;day++){
      const attending=attendingIndices(capacity,level,day);
      const requests=dailyHelpStudents(attending,day);
      assert.equal(requests.length,Math.min(2,attending.length));
      assert.equal(new Set(requests).size,requests.length);
      assert.ok(requests.every(index=>attending.includes(index)));
      assert.deepEqual(requests,dailyHelpStudents(attending,day),
        'Student coaching targets must not change during arrivals');
    }
  }
});


test('attendance respects level roster caps and handles invalid saved counts',()=>{
  for(let level=1;level<=5;level++){
    const cap=studentCapacity(level);
    const floor=GYM_LEVELS[level-1].active;
    for(const count of [cap,cap+1,24,100]){
      for(let day=1;day<=12;day++){
        const group=attendingIndices(count,level,day);
        assert.equal(group.length,floor);
        assert.ok(group.every(index=>index>=0&&index<cap));
        assert.equal(new Set(group).size,group.length);
      }
    }
  }
  assert.deepEqual(attendingIndices(Number.NaN,3,1),[]);
  assert.deepEqual(attendingIndices(Infinity,3,1),[]);
  assert.deepEqual(attendingIndices(-1,3,1),[]);
});

test('every gym tier can fund expansion from class income without minigames',()=>{
  for(let level=1;level<5;level++){
    const next=GYM_LEVELS[level];
    const base=classEarnings(level,GYM_LEVELS[level-1].active);
    assert.ok(base>0);
    const daysToAfford=Math.ceil(next.cost/(base+DAILY_SHIFT_CASH));
    assert.ok(daysToAfford<=60,
      'Expansion should not require more than 60 fully paid days before supplies or equipment');
    assert.ok(next.classesTaught>GYM_LEVELS[level-1].classesTaught);
  }
});


test('corrupted day and economy values cannot create invalid gym state',()=>{
  for(const day of [NaN,Infinity,-Infinity]){
    assert.deepEqual(attendingIndices(8,3,day),attendingIndices(8,3,1));
  }
  assert.equal(classEarnings(1,NaN,NaN,NaN),classEarnings(1,4,0,0));
  assert.equal(classEarnings(3,Infinity,Infinity,Infinity),classEarnings(3,4,0,0));
  for(const value of [NaN,Infinity,-Infinity]){
    assert.equal(canExpandGym(1,value,100,100,100),false);
    assert.equal(canExpandGym(1,1000,value,100,100),false);
    assert.equal(canExpandGym(1,1000,100,value,100),false);
    assert.equal(canExpandGym(1,1000,100,100,value),false);
  }
});

test('garage uses one mat and Level 2 equipment stays in its designated zone',()=>{
  assert.deepEqual(equipmentPlacementZone(1,0),equipmentPlacementZone(1,3));
  const striking=equipmentPlacementZone(2,0),strength=equipmentPlacementZone(2,2);
  assert.ok(striking.bottom<strength.top,'Keep a walkable corridor between Level 2 zones');
  assert.deepEqual(equipmentPlacementZone(2,1),striking);
  assert.deepEqual(equipmentPlacementZone(2,3),strength);
  assert.equal(fitsEquipmentZone(2,0,100,120,8,8),true);
  assert.equal(fitsEquipmentZone(2,0,100,170,8,8),false);
  assert.equal(fitsEquipmentZone(2,2,100,170,8,8),true);
  assert.equal(fitsEquipmentZone(2,2,100,120,8,8),false);
  assert.equal(fitsEquipmentZone(2,0,striking.left+2,120,8,8),false);
});
test('wall fixtures have fixed slots and equipment XP has diminishing returns',()=>{
  assert.equal(isWallEquipment(1),true);
  assert.equal(isWallEquipment(2),true);
  assert.equal(isWallEquipment(0),false);
  assert.deepEqual(WALL_EQUIPMENT_SLOTS[1],{x:116,y:94});
  assert.deepEqual(WALL_EQUIPMENT_SLOTS[2],{x:218,y:94});
  assert.deepEqual([0,1,2,3,10].map(equipmentXpBonus),[0,5,8,8,8]);
});
