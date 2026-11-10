export const GYM_LEVELS = [
  {name:'Garage Gym',capacity:4,active:4,cost:0,reputation:0,classesTaught:0,gearOwned:0},
  {name:'Neighborhood Gym',capacity:6,active:5,cost:400,reputation:12,classesTaught:8,gearOwned:2},
  {name:'Fight Gym',capacity:8,active:6,cost:1100,reputation:35,classesTaught:22,gearOwned:4},
  {name:'Pro Facility',capacity:10,active:7,cost:2600,reputation:75,classesTaught:48,gearOwned:6},
  {name:'Combat Academy',capacity:12,active:8,cost:6000,reputation:140,classesTaught:90,gearOwned:8},
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

/** Hub-only class rewards. No arcade results are needed to earn money or rep.
 * Members and placed relevant gear improve revenue as the school expands. */
export const CLASS_REPUTATION=2;
export function classEarnings(level:number,enrolled:number,matchingPlacedGear=0,facilityUpgrades=0):number {
  const members=Math.max(4,Math.min(12,Math.floor(enrolled)));
  const gear=Math.max(0,Math.min(8,Math.floor(matchingPlacedGear)));
  const facilities=Math.max(0,Math.min(3,Math.floor(facilityUpgrades)));
  return 16+members*7+normalizeGymLevel(level)*9+gear*5+facilities*4;
}

/** Twelve piles spread across the actual gym at each level.
 * Stable pile indexes make daily pickup progress backwards compatible. */
export function dailySupplyPositions(level:number):{x:number;y:number}[]{
  const bounds=trainingBounds(level),span=bounds.right-bounds.left;
  return Array.from({length:12},(_,i)=>({
    x:Math.round(bounds.left+15+(i%6)*(span-30)/5),
    y:i<6?bounds.top+12:bounds.bottom-12,
  }));
}

export function attendingIndices(enrolled:number,level:number,day:number):number[] {
  const total=Number.isFinite(enrolled)?Math.max(0,Math.min(studentCapacity(level),STUDENT_NAMES.length,Math.floor(enrolled))):0;
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

/** Visible training area, also enforced for equipment footprint placement.
 * The right-hand board and reception corridor stay accessible at every level. */
export const GYM_TRAINING_BOUNDS=[
  {left:70,right:278,top:103,bottom:190}, // compact garage
  {left:55,right:294,top:93,bottom:200},  // neighborhood
  {left:33,right:317,top:80,bottom:211},  // original Combat Culture gym
  {left:29,right:323,top:79,bottom:214},  // enlarged professional facility
  {left:25,right:329,top:78,bottom:215},  // flagship academy
] as const;

export function trainingBounds(level:number) {
  return GYM_TRAINING_BOUNDS[normalizeGymLevel(level)-1];
}

export type GymRect={x:number;y:number;w:number;h:number};
export type GymPoint={x:number;y:number};

/** Stage-specific furniture hit targets, route anchors and room footprint.
 * Keep physical station interaction aligned with the artwork at every level.
 * A tiny check-in desk grows into a staffed luxury reception on Level 5. */
export const GYM_SERVICE_LAYOUTS=[
  {room:{left:44,right:450,top:84,bottom:213},
   board:{x:381,y:75,w:66,h:39},desk:{x:415,y:192,w:47,h:24},
   boardApproach:{x:363,y:144},deskApproach:{x:397,y:200}},
  {room:{left:27,right:460,top:79,bottom:215},
   board:{x:364,y:65,w:83,h:49},desk:{x:401,y:187,w:65,h:30},
   boardApproach:{x:351,y:144},deskApproach:{x:385,y:200}},
  {room:{left:15,right:465,top:75,bottom:215},
   board:{x:344,y:50,w:112,h:65},desk:{x:388,y:181,w:82,h:39},
   boardApproach:{x:348,y:145},deskApproach:{x:375,y:198}},
  {room:{left:15,right:469,top:75,bottom:215},
   board:{x:339,y:43,w:123,h:74},desk:{x:379,y:178,w:92,h:42},
   boardApproach:{x:343,y:147},deskApproach:{x:368,y:198}},
  {room:{left:11,right:474,top:74,bottom:216},
   board:{x:334,y:32,w:132,h:84},desk:{x:372,y:176,w:101,h:44},
   boardApproach:{x:341,y:146},deskApproach:{x:359,y:198}},
] as const;

export function gymServiceLayout(level:number){
  return GYM_SERVICE_LAYOUTS[normalizeGymLevel(level)-1];
}
