export const GYM_LEVELS = [
  {name:'Garage Gym',capacity:4,active:4,cost:0,reputation:0,classesTaught:0,gearOwned:0},
  {name:'Neighborhood Gym',capacity:6,active:5,cost:400,reputation:12,classesTaught:8,gearOwned:2},
  {name:'Fight Gym',capacity:8,active:6,cost:1100,reputation:35,classesTaught:22,gearOwned:4},
  {name:'Pro Facility',capacity:10,active:7,cost:2600,reputation:75,classesTaught:48,gearOwned:6},
  {name:'Combat Academy',capacity:12,active:8,cost:6000,reputation:140,classesTaught:90,gearOwned:8},
] as const;

export const STUDENT_NAMES=[
  'Frank','Radish','Marshall','Pudge',
  'Holly','Gao','Jules','Nico','Sam','Robin',
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
  return [money,reputation,classesTaught,gearOwned].every(Number.isFinite)&&
    money>=next.cost&&reputation>=next.reputation&&classesTaught>=next.classesTaught&&gearOwned>=next.gearOwned;
}

/** Hub-only class rewards. No arcade results are needed to earn money or rep.
 * Members and placed relevant gear improve revenue as the school expands. */
export const CLASS_REPUTATION=2;
export function classEarnings(level:number,enrolled:number,matchingPlacedGear=0,facilityUpgrades=0):number {
  const members=Number.isFinite(enrolled)?Math.max(4,Math.min(12,Math.floor(enrolled))):4;
  const gear=Number.isFinite(matchingPlacedGear)?Math.max(0,Math.min(8,Math.floor(matchingPlacedGear))):0;
  const facilities=Number.isFinite(facilityUpgrades)?Math.max(0,Math.min(3,Math.floor(facilityUpgrades))):0;
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
  const safeDay=Number.isFinite(day)?Math.max(1,Math.floor(day)):1;
  const start=((safeDay-1)*attending)%total;
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
  {left:59,right:315,top:99,bottom:202}, // compact garage: matches approved mat texture
  {left:55,right:294,top:93,bottom:200},  // neighborhood
  {left:55,right:294,top:93,bottom:200},  // level 3: new outdoor area, main room unchanged
  {left:55,right:294,top:93,bottom:200},  // level 4: upstairs unlocked, main room unchanged
  {left:55,right:294,top:93,bottom:200},  // level 5: downstairs unlocked, main room unchanged
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
   board:{x:380,y:37,w:66,h:39},desk:{x:415,y:192,w:47,h:24},
   boardApproach:{x:363,y:144},deskApproach:{x:397,y:200}},
  {room:{left:27,right:460,top:79,bottom:215},
   board:{x:377,y:65,w:83,h:49},desk:{x:395,y:185,w:65,h:30},
   boardApproach:{x:351,y:144},deskApproach:{x:382,y:200}},
  // The main room never expands again. These tiers upgrade the same
  // reception corridor while unlocking outdoor/upstairs/downstairs.
  {room:{left:27,right:460,top:79,bottom:215},
   board:{x:347,y:50,w:112,h:65},desk:{x:378,y:181,w:82,h:39},
   boardApproach:{x:335,y:145},deskApproach:{x:363,y:198}},
  {room:{left:27,right:460,top:79,bottom:215},
   board:{x:337,y:43,w:123,h:74},desk:{x:368,y:178,w:92,h:42},
   boardApproach:{x:332,y:147},deskApproach:{x:357,y:198}},
  {room:{left:27,right:460,top:79,bottom:215},
   board:{x:328,y:32,w:132,h:84},desk:{x:359,y:176,w:101,h:44},
   boardApproach:{x:327,y:146},deskApproach:{x:346,y:198}},
] as const;

export function gymServiceLayout(level:number){
  return GYM_SERVICE_LAYOUTS[normalizeGymLevel(level)-1];
}

/** Level 1 has one compact equipment mat. Level 2 separates training and
 * strength areas while keeping the reception corridor permanently clear. */
export function equipmentPlacementZone(level:number,stat:number):{left:number;right:number;top:number;bottom:number} {
  const bounds=trainingBounds(level);
  if(normalizeGymLevel(level)===1)return bounds;
  // Striking and speed share the upper training area; strength and
  // conditioning use the lower area. The gap is a walking corridor.
  return stat<=1
    ?{...bounds,bottom:140}
    :{...bounds,top:153};
}

/** Fixed wall fixtures are installed automatically; they do not consume floor mat space. */
export const WALL_EQUIPMENT_SLOTS:Readonly<Record<number,{x:number;y:number}>>={
  1:{x:116,y:94}, // Thai pads
  2:{x:218,y:94}, // speed bag
};
export function isWallEquipment(index:number):boolean {
  return Object.prototype.hasOwnProperty.call(WALL_EQUIPMENT_SLOTS,index);
}
/** Two mats at Level 2: a training area and a strength/conditioning area. */
export function fitsEquipmentZone(level:number,stat:number,x:number,y:number,rx:number,ry:number):boolean {
  const z=equipmentPlacementZone(level,stat);
  return x-rx>=z.left&&x+rx<=z.right&&y-ry>=z.top&&y+ry<=z.bottom;
}
/** First usable piece grants 5 XP, second grants 3 additional XP. */
export function equipmentXpBonus(count:number):number {
  return count<=0?0:count===1?5:8;
}
