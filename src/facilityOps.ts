/** In-gym facilities. Each task consumes a real resource or is limited per day. */
export const SUPPLY_NAMES=['Water jugs','Fresh towels','Toilet paper','Sanitizer'] as const;
export const SUPPLY_BUNDLES=[
  {amount:3,price:35},
  {amount:4,price:28},
  {amount:4,price:20},
  {amount:4,price:32}
] as const;
export const INITIAL_SUPPLIES=[2,3,2,3] as const;
export const WATER_REFILL=55;
export const WATER_CONSUMPTION_PER_CLASS=24;
export const MAT_DIRT_PER_CLASS=22;
export const MOP_SPOTS=5;
export const PHONE_CALL_LIMIT=2;
export const GEAR_DIRT_PER_CLASS=24;
export const GEAR_WIPE_RESTORE=65;
export const GEAR_HEALTH_PER_CLASS=6;
export const GEAR_REPAIR_RESTORE=50;
export const CLEAN_GEAR_THRESHOLD=40;
export const GEAR_WORKING_THRESHOLD=25;
export const MAX_GEAR_INTERACTIONS=2;

export function normalizeStock(raw:unknown,defaults:number[]=Array.from(INITIAL_SUPPLIES)):number[]{
 return Array.from({length:4},(_,i)=>{
   const value=Array.isArray(raw)?raw[i]:undefined;
   return typeof value==='number'&&Number.isInteger(value)&&value>=0?
     Math.min(99,value):defaults[i];
 });
}
export function normalizePercent(value:unknown,otherwise=100):number {
 return typeof value==='number'&&Number.isFinite(value)?
   Math.max(0,Math.min(100,Math.floor(value))):otherwise;
}
export function gearActive(owned:boolean,stored:boolean,condition:number,cleanliness:number):boolean {
 return !!owned&&!stored&&condition>=GEAR_WORKING_THRESHOLD&&
   cleanliness>=CLEAN_GEAR_THRESHOLD;
}
export function maintenanceWear(current:number,loss:number):number{
 return Math.max(0,Math.min(100,current-Math.max(0,loss)));
}
export function recharge(current:number,amount:number):number {
 return Math.max(0,Math.min(100,current+Math.max(0,amount)));
}
export function discountRecruitment(base:number,phoneLeads:number):number{
 return Math.max(0,Math.round(base*(phoneLeads>0?0.75:1)));
}
export function availablePhoneCalls(spawned:number,answered:number):number {
 return Math.max(0,Math.min(PHONE_CALL_LIMIT,spawned)-answered);
}
export function canEarnMopReward(cleaned:number,claimed:boolean):boolean {
 return !claimed&&cleaned>=MOP_SPOTS;
}
