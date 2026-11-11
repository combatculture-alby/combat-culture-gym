/** In-room activities. No arcade result is needed to complete these tasks. */
export const DAILY_HELP_LIMIT=2;
export const DAILY_CLEAN_TARGET=3;
export const DAILY_SHIFT_CASH=45;
export const DAILY_SHIFT_REP=2;
export const DAILY_GEAR_DRILLS=2;
export const GEAR_WORKING_THRESHOLD=25;
export const GEAR_WEAR_PER_CLASS=6;
export const GEAR_WEAR_PER_DRILL=3;
export const GEAR_SERVICE_RESTORED=45;

export function dailyHelpStudents(attending:number[],day:number):number[] {
  if(!attending.length)return [];
  const count=Math.min(DAILY_HELP_LIMIT,attending.length);
  const start=(Math.max(1,Math.floor(day)||1)-1)%attending.length;
  return Array.from({length:count},(_,i)=>attending[(start+i)%attending.length]);
}
export function dailyShiftHelpTarget(attending:number):number {
  return Math.min(DAILY_HELP_LIMIT,Math.max(0,Math.floor(attending)));
}
export function dailyShiftReady(
  coached:number,cleaned:number,classes:number,claimed=false,attending=DAILY_HELP_LIMIT
):boolean {
  const target=dailyShiftHelpTarget(attending);
  return target>0&&!claimed&&coached>=target&&
    cleaned>=DAILY_CLEAN_TARGET&&classes>=1;
}
export function workingGear(
  owned:boolean,stored:boolean,condition:number
):boolean {
  return !!owned&&!stored&&Number.isFinite(condition)&&condition>=GEAR_WORKING_THRESHOLD;
}
export function wornCondition(current:number,amount=GEAR_WEAR_PER_CLASS):number {
  return Math.max(0,Math.min(100,Math.round(current)-Math.max(0,amount)));
}
export function servicedCondition(current:number):number {
  return Math.min(100,Math.max(0,Math.round(current))+GEAR_SERVICE_RESTORED);
}
