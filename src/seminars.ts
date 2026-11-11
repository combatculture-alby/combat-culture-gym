import {attendingIndices,normalizeGymLevel,enrolledCount} from './gymProgression.ts';

export const SEMINAR_FEE=300;
export const SEMINAR_PRIMARY_XP=78;
export const SEMINAR_SECONDARY_XP=30;
export const SEMINAR_REPUTATION=3;

export type SeminarCoach={
  id:number;name:string;discipline:string;focus:number;secondary:number;
  fee:number;description:string;lessons:readonly [string,string,string];
};
export const SEMINAR_STATS=['Striking','Speed','Strength','Conditioning'] as const;
export const SEMINAR_COACHES:readonly SeminarCoach[]=[
  {id:0,name:'Mina Torres',discipline:'Boxing',focus:0,secondary:1,fee:SEMINAR_FEE,
    description:'Sharper combinations and timing.',
    lessons:[
      'The guest coach demonstrates jabs, counters and angle changes.',
      'Students practice combinations and work on clean, balanced footwork.',
      'Mina corrects guards and timing before a final technical round.'
    ]},
  {id:1,name:'Ajarn Niran',discipline:'Muay Thai',focus:0,secondary:2,fee:SEMINAR_FEE,
    description:'Kicks, knees, and clinch fundamentals.',
    lessons:[
      'Ajarn Niran demonstrates hip rotation, knee strikes and distance.',
      'Students alternate kicking drills with controlled clinch entries.',
      'The coach checks balance, posture and defensive timing.'
    ]},
  {id:2,name:'Coach Ellis',discipline:'Grappling',focus:2,secondary:3,fee:SEMINAR_FEE,
    description:'Base, frames, and positional control.',
    lessons:[
      'Coach Ellis demonstrates frames, hip movement and stable base.',
      'Partners practice takedown setups and technical escapes.',
      'Students drill positional control while Ellis corrects posture.'
    ]},
  {id:3,name:'Coach Vale',discipline:'Conditioning',focus:3,secondary:1,fee:SEMINAR_FEE,
    description:'Engine, pace and repeatable power.',
    lessons:[
      'The coach explains pacing, breathing and efficient movement.',
      'Students cycle through timed training and recovery stations.',
      'The group finishes with a focused conditioning challenge.'
    ]}
] as const;

export type SeminarPending={coachId:number;day:number};
export type SeminarSave={
  day:number;money:number;reputation:number;gymLevel?:number;enrolledStudents?:number;
  skills:number[];studentStats?:number[][];studentXP?:number[][];
  seminarPending?:SeminarPending;seminarLastDay?:number;
};

/** Guests rotate deterministically. At most two appear per day. */
export function seminarAvailable(day:number,coachId:number):boolean {
  const d=Math.max(1,Math.floor(day)||1),lead=(d-1)%4;
  return coachId===lead||(d%3===0&&coachId===(lead+2)%4);
}
export function seminarNextVisit(day:number,coachId:number):number {
  for(let offset=0;offset<=12;offset++)
    if(seminarAvailable(day+offset,coachId))return offset;
  return 13;
}
export function seminarCanBook(save:SeminarSave,coachId:number):boolean {
  const coach=SEMINAR_COACHES[coachId];
  return !!coach&&save.seminarLastDay!==save.day&&!save.seminarPending&&
    seminarAvailable(save.day,coachId)&&save.money>=coach.fee;
}
/** Charges once. An interrupted cutscene can be resumed at no extra cost. */
export function seminarBook(save:SeminarSave,coachId:number):boolean {
  if(!seminarCanBook(save,coachId))return false;
  save.money-=SEMINAR_COACHES[coachId].fee;
  save.seminarPending={coachId,day:save.day};
  return true;
}
function statThreshold(value:number):number {
  return value<20?30:value<40?55:value<60?90:value<80?140:220;
}
/** Same full reward whether a player watches or skips the cutscene.
 * One completed seminar/day; only students attending this day benefit. */
export function seminarComplete(save:SeminarSave,coachId:number):{
  attendees:number;primaryXp:number;secondaryXp:number;reputation:number
}|null {
  if(save.seminarPending?.coachId!==coachId||save.seminarLastDay===save.day)return null;
  const coach=SEMINAR_COACHES[coachId];
  if(!coach)return null;
  const level=normalizeGymLevel(save.gymLevel),count=enrolledCount(save.enrolledStudents,level);
  const attending=attendingIndices(count,level,save.day);
  save.studentStats=Array.from({length:count},(_,i)=>
    Array.from({length:4},(_,j)=>Math.min(100,Math.max(0,Math.floor(save.studentStats?.[i]?.[j]??10)))));
  save.studentXP=Array.from({length:count},(_,i)=>
    Array.from({length:4},(_,j)=>Math.max(0,Math.floor(save.studentXP?.[i]?.[j]??0))));
  for(const index of attending){
    for(const [stat,gain] of [[coach.focus,SEMINAR_PRIMARY_XP],[coach.secondary,SEMINAR_SECONDARY_XP]]){
      let xp=save.studentXP[index][stat]+gain,value=save.studentStats[index][stat];
      while(value<100&&xp>=statThreshold(value)){xp-=statThreshold(value);value++;}
      save.studentStats[index][stat]=value;
      save.studentXP[index][stat]=value>=100?0:xp;
    }
    if(index<save.skills.length)save.skills[index]++;
  }
  save.reputation+=SEMINAR_REPUTATION;
  save.seminarLastDay=save.day;
  delete save.seminarPending;
  return {attendees:attending.length,primaryXp:SEMINAR_PRIMARY_XP,
    secondaryXp:SEMINAR_SECONDARY_XP,reputation:SEMINAR_REPUTATION};
}
