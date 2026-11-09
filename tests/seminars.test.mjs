import test from 'node:test';
import assert from 'node:assert/strict';
import {SEMINAR_COACHES,SEMINAR_STATS,seminarAvailable,seminarNextVisit,
  seminarCanBook,seminarBook,seminarComplete} from '../src/seminars.ts';

function save(overrides={}){
  return {day:1,money:500,reputation:0,gymLevel:1,enrolledStudents:4,
    skills:[0,0,0,0],studentStats:Array.from({length:4},()=>[10,10,10,10]),
    studentXP:Array.from({length:4},()=>[0,0,0,0]),...overrides};
}
test('four specialist coaches have meaningful fees, distinct training focuses and three questions',()=>{
  assert.equal(SEMINAR_COACHES.length,4);
  assert.deepEqual(SEMINAR_COACHES.map(c=>c.focus),[0,0,2,3]);
  assert.equal(new Set(SEMINAR_COACHES.map(c=>c.discipline)).size,4);
  assert.equal(SEMINAR_STATS.length,4);
  for(const [i,c] of SEMINAR_COACHES.entries()){
    assert.equal(c.id,i);
    assert.ok(c.fee>=200,'Seminars must remain expensive optional events');
    assert.notEqual(c.focus,c.secondary);
    assert.equal(c.questions.length,3);
    for(const q of c.questions){
      assert.equal(q.answers.length,3);
      assert.ok(q.correct>=0&&q.correct<3);
      assert.ok(q.explanation.length>10);
    }
  }
});
test('guest appearances rotate deterministically, with one or two available each day',()=>{
  const count=Array(4).fill(0);
  for(let day=1;day<=28;day++){
    const available=SEMINAR_COACHES.filter(c=>seminarAvailable(day,c.id));
    assert.ok(available.length>=1&&available.length<=2);
    available.forEach(c=>count[c.id]++);
    for(const c of SEMINAR_COACHES){
      const next=seminarNextVisit(day,c.id);
      assert.ok(next>=0&&next<=5);
      assert.equal(seminarAvailable(day+next,c.id),true);
    }
  }
  count.forEach(n=>assert.ok(n>=4&&n<20));
  assert.deepEqual(SEMINAR_COACHES.filter(c=>seminarAvailable(1,c.id)).map(c=>c.id),[0]);
  assert.deepEqual(SEMINAR_COACHES.filter(c=>seminarAvailable(3,c.id)).map(c=>c.id),[0,2]);
});
test('reservation is costly, cannot charge twice, and blocks unavailable guests',()=>{
  const broke=save({money:239});
  assert.equal(seminarBook(broke,0),false);
  assert.equal(broke.money,239);
  const s=save();
  assert.equal(seminarCanBook(s,1),false,'Unavailable coach cannot be booked');
  assert.equal(seminarBook(s,1),false);
  assert.equal(seminarBook(s,0),true);
  assert.equal(s.money,260);
  assert.deepEqual(s.seminarPending,{coachId:0,day:1});
  assert.equal(seminarBook(s,0),false);
  assert.equal(s.money,260,'A resumed seminar must never charge twice');
});
test('better participation produces larger specialist XP and reputation',()=>{
  const bad=save(),great=save();
  assert.equal(seminarBook(bad,0),true);
  assert.equal(seminarBook(great,0),true);
  const weak=seminarComplete(bad,0,0),best=seminarComplete(great,0,3);
  assert.ok(weak&&best);
  assert.equal(best.attendees,4);
  assert.equal(weak.reputation,1);
  assert.equal(best.reputation,4);
  assert.ok(best.primaryXp>weak.primaryXp);
  assert.ok(best.secondaryXp>weak.secondaryXp);
  assert.ok(great.studentStats[0][0]>bad.studentStats[0][0]||
    great.studentXP[0][0]>bad.studentXP[0][0]);
  assert.equal(great.skills[0],1);
  assert.equal(bad.skills[0],0);
  assert.equal(great.money,260);
  assert.equal(great.seminarPending,undefined);
  assert.equal(great.seminarLastDay,1);
  assert.equal(seminarComplete(great,0,3),null,'Award must be one-time');
  assert.equal(seminarBook(great,0),false,'Only one seminar each day');
  great.day=2;
  assert.equal(seminarBook(great,1),true,'Can book a different available guest on another day only with sufficient funds' );
});
test('academy seminars only affect actual attending students',()=>{
  const s=save({gymLevel:5,enrolledStudents:24,money:1000,
    skills:Array(24).fill(0),studentStats:Array.from({length:24},()=>[10,10,10,10]),
    studentXP:Array.from({length:24},()=>[0,0,0,0])});
  assert.equal(seminarBook(s,0),true);
  const r=seminarComplete(s,0,2);
  assert.equal(r.attendees,8);
  const trained=s.studentXP.filter(x=>x[0]>0||x[1]>0).length;
  assert.equal(trained,8);
});
