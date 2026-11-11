import test from 'node:test';
import assert from 'node:assert/strict';
import {SEMINAR_COACHES,SEMINAR_STATS,SEMINAR_FEE,
  SEMINAR_PRIMARY_XP,SEMINAR_SECONDARY_XP,SEMINAR_REPUTATION,
  seminarAvailable,seminarNextVisit,seminarCanBook,seminarBook,seminarComplete
} from '../src/seminars.ts';

function save(overrides={}){
  return {day:1,money:500,reputation:0,gymLevel:1,enrolledStudents:4,
    skills:[0,0,0,0],studentStats:Array.from({length:4},()=>[10,10,10,10]),
    studentXP:Array.from({length:4},()=>[0,0,0,0]),...overrides};
}
test('four guest specialists cost exactly the same and have three cutscene beats',()=>{
  assert.equal(SEMINAR_COACHES.length,4);
  assert.equal(SEMINAR_FEE,300);
  assert.equal(new Set(SEMINAR_COACHES.map(c=>c.discipline)).size,4);
  assert.equal(SEMINAR_STATS.length,4);
  for(const [i,coach] of SEMINAR_COACHES.entries()){
    assert.equal(coach.id,i);
    assert.equal(coach.fee,SEMINAR_FEE);
    assert.notEqual(coach.focus,coach.secondary);
    assert.equal(coach.lessons.length,3);
    for(const beat of coach.lessons)assert.ok(beat.length>20);
    assert.equal(coach.questions,undefined,'Paid seminars do not require trivia');
  }
});
test('coach availability rotates deterministically and cannot be exploited',()=>{
  for(let day=1;day<=28;day++){
    const current=SEMINAR_COACHES.filter(c=>seminarAvailable(day,c.id));
    assert.ok(current.length>=1&&current.length<=2);
    for(const coach of SEMINAR_COACHES){
      const wait=seminarNextVisit(day,coach.id);
      assert.ok(wait>=0&&wait<=5);
      assert.equal(seminarAvailable(day+wait,coach.id),true);
    }
  }
  assert.deepEqual(SEMINAR_COACHES.filter(c=>seminarAvailable(1,c.id)).map(c=>c.id),[0]);
});
test('seminars are expensive, bookings cannot be charged twice, and only one per day',()=>{
  const broke=save({money:SEMINAR_FEE-1});
  assert.equal(seminarBook(broke,0),false);
  assert.equal(broke.money,SEMINAR_FEE-1);
  const s=save();
  assert.equal(seminarCanBook(s,1),false);
  assert.equal(seminarBook(s,1),false);
  assert.equal(seminarBook(s,0),true);
  assert.equal(s.money,200);
  assert.deepEqual(s.seminarPending,{coachId:0,day:1});
  assert.equal(seminarBook(s,0),false);
  assert.equal(s.money,200,'Resuming a seminar must not charge twice');
  const outcome=seminarComplete(s,0);
  assert.equal(outcome?.reputation,SEMINAR_REPUTATION);
  assert.equal(s.seminarPending,undefined);
  assert.equal(s.seminarLastDay,1);
  assert.equal(seminarComplete(s,0),null,'Cannot get two rewards');
  s.money+=1000;
  assert.equal(seminarBook(s,0),false,'Cannot buy again on the same day');
  s.day=2;
  assert.equal(seminarBook(s,1),true,'A new available coach can be booked the next day');
});
test('watching or skipping a paid cutscene always yields full fixed rewards',()=>{
  const watched=save(),skipped=save();
  assert.equal(seminarBook(watched,0),true);
  assert.equal(seminarBook(skipped,0),true);
  const x=seminarComplete(watched,0);
  const y=seminarComplete(skipped,0);
  assert.deepEqual(x,y,'No variable performance based on a cutscene');
  assert.equal(x.attendees,4);
  assert.equal(x.primaryXp,SEMINAR_PRIMARY_XP);
  assert.equal(x.secondaryXp,SEMINAR_SECONDARY_XP);
  assert.equal(x.reputation,SEMINAR_REPUTATION);
  assert.deepEqual(watched.studentXP,skipped.studentXP);
  assert.deepEqual(watched.studentStats,skipped.studentStats);
  assert.equal(skipped.money,200);
  assert.equal(skipped.skills[0],1);
});
test('seminars only boost actual attendees at the academy',()=>{
  const s=save({gymLevel:5,enrolledStudents:24,money:1000,
    skills:Array(24).fill(0),studentStats:Array.from({length:24},()=>[10,10,10,10]),
    studentXP:Array.from({length:24},()=>[0,0,0,0])});
  assert.equal(seminarBook(s,0),true);
  const r=seminarComplete(s,0);
  assert.equal(r.attendees,8);
  const trained=s.studentXP.filter(x=>x[0]>0||x[1]>0).length;
  assert.equal(trained,8);
});
