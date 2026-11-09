import {attendingIndices,normalizeGymLevel,enrolledCount} from './gymProgression';

export type SeminarCoach={
  id:number;name:string;discipline:string;focus:number;secondary:number;
  fee:number;description:string;questions:readonly SeminarQuestion[];
};
export type SeminarQuestion={
  question:string;answers:readonly [string,string,string];correct:number;explanation:string;
};
export const SEMINAR_STATS=['Striking','Speed','Strength','Conditioning'] as const;
export const SEMINAR_COACHES:readonly SeminarCoach[]=[
  {id:0,name:'Mina Torres',discipline:'Boxing',focus:0,secondary:1,fee:240,
    description:'Sharper combinations and timing.',
    questions:[
      {question:'When entering behind a jab, what protects you?',
       answers:['Drop the rear hand','Keep the rear hand home','Cross your feet'],
       correct:1,explanation:'The rear hand protects your chin while you jab.'},
      {question:'After a combination, what creates a safer exit?',
       answers:['Angle off the line','Stand in front','Lean back with hands low'],
       correct:0,explanation:'An angle changes the line of return fire.'},
      {question:'To punch quickly without losing balance, prioritize:',
       answers:['Tense every muscle','Overreach','Relaxed, balanced mechanics'],
       correct:2,explanation:'Efficiency and balance create repeatable speed.'}
    ]},
  {id:1,name:'Ajarn Niran',discipline:'Muay Thai',focus:0,secondary:2,fee:300,
    description:'Kicks, knees, and clinch fundamentals.',
    questions:[
      {question:'What should drive a powerful round kick?',
       answers:['Only the lower leg','Hip rotation through the target','A straight stiff knee'],
       correct:1,explanation:'Rotate through the hip while maintaining balance.'},
      {question:'In the clinch, what helps you stay in control?',
       answers:['Pull from far away','Give up your posture','Strong posture and inside position'],
       correct:2,explanation:'Posture and inside control make techniques work.'},
      {question:'To defend a low kick, lift the leg to:',
       answers:['Check with the shin','Catch it with the foot','Turn your back'],
       correct:0,explanation:'A correct shin check protects the leg.'}
    ]},
  {id:2,name:'Coach Ellis',discipline:'Grappling',focus:2,secondary:3,fee:350,
    description:'Base, frames, and positional control.',
    questions:[
      {question:'From bottom position, your first defensive priority is:',
       answers:['Bench press the opponent','Build frames and protect space','Turn your back'],
       correct:1,explanation:'Frames maintain space for safe escapes.'},
      {question:'During a takedown entry, what protects your balance?',
       answers:['Cross your feet','Reach without stepping','Stable base and level change'],
       correct:2,explanation:'A stable base supports a safe entry.'},
      {question:'When passing guard, emphasize:',
       answers:['Control position before attacking','Give up pressure immediately','Ignore the hips'],
       correct:0,explanation:'Positional control keeps the opponent pinned.'}
    ]},
  {id:3,name:'Coach Vale',discipline:'Conditioning',focus:3,secondary:1,fee:420,
    description:'Engine, pace and repeatable power.',
    questions:[
      {question:'For repeated hard rounds, start by finding:',
       answers:['A sustainable effort','An all-out sprint every second','No rest ever'],
       correct:0,explanation:'Pacing makes repeated quality rounds possible.'},
      {question:'When technique breaks down from fatigue:',
       answers:['Push harder regardless','Reset or reduce intensity','Stop breathing'],
       correct:1,explanation:'Protect technique and safety before intensity.'},
      {question:'To measure improved conditioning, compare:',
       answers:['Only soreness','Only maximum load','Work output and recovery over time'],
       correct:2,explanation:'Output and recovery show useful progress.'}
    ]}
] as const;

export type SeminarPending={coachId:number;day:number};
export type SeminarSave={
  day:number;money:number;reputation:number;gymLevel?:number;enrolledStudents?:number;
  skills:number[];studentStats?:number[][];studentXP?:number[][];
  seminarPending?:SeminarPending;seminarLastDay?:number;
};

/** Guests rotate. Exactly one or two of four are available on each day.
 * The cycle is deterministic across saves and reloads, not a real-time RNG. */
export function seminarAvailable(day:number,coachId:number):boolean {
  const d=Math.max(1,Math.floor(day)||1),lead=(d-1)%4;
  return coachId===lead||(d%3===0&&coachId===(lead+2)%4);
}
export function seminarNextVisit(day:number,coachId:number):number {
  for(let offset=0;offset<=12;offset++){
    if(seminarAvailable(day+offset,coachId))return offset;
  }
  return 13;
}
export function seminarCanBook(save:SeminarSave,coachId:number):boolean {
  const coach=SEMINAR_COACHES[coachId];
  return !!coach&&save.seminarLastDay!==save.day&&!save.seminarPending&&
    seminarAvailable(save.day,coachId)&&save.money>=coach.fee;
}
export function seminarBook(save:SeminarSave,coachId:number):boolean {
  if(!seminarCanBook(save,coachId))return false;
  save.money-=SEMINAR_COACHES[coachId].fee;
  save.seminarPending={coachId,day:save.day};
  return true;
}
function statThreshold(value:number):number {
  return value<20?30:value<40?55:value<60?90:value<80?140:220;
}
/** Applies the guest's training to attending students once, only after a
 * paid booking. Performance increases both specialized XP and reputation. */
export function seminarComplete(save:SeminarSave,coachId:number,correct:number):{
  attendees:number;primaryXp:number;secondaryXp:number;reputation:number
}|null {
  if(save.seminarPending?.coachId!==coachId||save.seminarLastDay===save.day)return null;
  const coach=SEMINAR_COACHES[coachId];if(!coach)return null;
  const score=Math.max(0,Math.min(3,Math.floor(correct)||0));
  const level=normalizeGymLevel(save.gymLevel);
  const count=enrolledCount(save.enrolledStudents,level);
  const attending=attendingIndices(count,level,save.day);
  save.studentStats=Array.from({length:count},(_,i)=>
    Array.from({length:4},(_,j)=>Math.min(100,Math.max(0,Math.floor(save.studentStats?.[i]?.[j]??10)))));
  save.studentXP=Array.from({length:count},(_,i)=>
    Array.from({length:4},(_,j)=>Math.max(0,Math.floor(save.studentXP?.[i]?.[j]??0))));
  const primaryXp=42+score*12,secondaryXp=16+score*6;
  for(const index of attending){
    for(const [stat,gain] of [[coach.focus,primaryXp],[coach.secondary,secondaryXp]]){
      let xp=save.studentXP[index][stat]+gain,value=save.studentStats[index][stat];
      while(value<100&&xp>=statThreshold(value)){xp-=statThreshold(value);value++;}
      save.studentStats[index][stat]=value;
      save.studentXP[index][stat]=value>=100?0:xp;
    }
    if(score>=2&&index<save.skills.length)save.skills[index]++;
  }
  const reputation=1+score;
  save.reputation+=reputation;
  save.seminarLastDay=save.day;
  delete save.seminarPending;
  return {attendees:attending.length,primaryXp,secondaryXp,reputation};
}
