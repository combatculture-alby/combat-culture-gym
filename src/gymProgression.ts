export const GYM_LEVELS = [
  {name:'Garage Gym',capacity:4,active:4,cost:0,reputation:0,classesTaught:0,gearOwned:0},
  {name:'Neighborhood Gym',capacity:6,active:5,cost:400,reputation:12,classesTaught:8,gearOwned:2},
  {name:'Fight Gym',capacity:10,active:6,cost:1100,reputation:35,classesTaught:22,gearOwned:4},
  {name:'Pro Facility',capacity:16,active:7,cost:2600,reputation:75,classesTaught:48,gearOwned:6},
  {name:'Combat Academy',capacity:24,active:8,cost:6000,reputation:140,classesTaught:90,gearOwned:8},
] as const;

export const STUDENT_NAMES=[
  'Frank','Radish','Marshall','Pudge',
  'Maya','Alex','Jules','Nico','Sam','Robin',
  'Kai','Lena','Drew','Inez','Tariq','June',
  'Ash','Bea','Casey','Emil','Tess','Noel','Ari','Val',
] as const;

export function normalizeGymLevel(value:unknown):number {
  const level=Number(value);
  return Number.isFinite(level)?Math.max(1,Math.min(GYM_LEVELS.length,Math.floor(level))):1;
}
export function studentCapacity(level:number):number {
  return GYM_LEVELS[normalizeGymLevel(level)-1].capacity;
}
export function enrolledCount(value:unknown,level:number):number {
  const count=Number(value);
  return Number.isFinite(count)?Math.max(4,Math.min(studentCapacity(level),Math.floor(count))):4;
}
export function activeStudentCount(count:number,level:number):number {
  return Math.min(count,GYM_LEVELS[normalizeGymLevel(level)-1].active);
}
export function recruitmentCost(count:number):number {
  return 35+Math.max(0,count-4)*25;
}
export function canExpandGym(level:number,money:number,reputation:number,classesTaught:number,gearOwned:number):boolean {
  if(normalizeGymLevel(level)>=GYM_LEVELS.length)return false;
  const next=GYM_LEVELS[normalizeGymLevel(level)];
  return money>=next.cost&&reputation>=next.reputation&&classesTaught>=next.classesTaught&&gearOwned>=next.gearOwned;
}

export function attendingIndices(enrolled:number,level:number,day:number):number[] {
  const total=Math.max(0,Math.min(STUDENT_NAMES.length,Math.floor(enrolled)));
  if(!total)return [];
  const attending=activeStudentCount(total,level);
  const start=(Math.max(1,Math.floor(day))-1)*attending%total;
  return Array.from({length:attending},(_,i)=>(start+i)%total);
}

export function normalizeClassPlan(value:unknown):number[] {
  const incoming=Array.isArray(value)?value:[];
  return [0,1].map((fallback,i)=>{
    const program=incoming[i];
    return Number.isInteger(program)&&program>=0&&program<4?program:fallback;
  });
}
