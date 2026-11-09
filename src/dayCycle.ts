export type GymPhase='opening'|'open'|'closing';
export const ARRIVAL_INTERVAL_SECONDS=3.5;
export const DEPARTURE_INTERVAL_SECONDS=2.7;
export function normalizeGymPhase(value:unknown,legacy=false):GymPhase {
  return value==='opening'||value==='open'||value==='closing'?value:legacy?'open':'opening';
}
export function normalizeArrivalCount(value:unknown,phase:GymPhase,attendance:number):number {
  if(phase==='opening')return 0;
  if(typeof value!=='number'||!Number.isInteger(value))
    return phase==='open'?attendance:0;
  return Math.max(0,Math.min(attendance,value));
}
export function outstandingTrash(spawned:number,cleaned:number):number {
  return Math.max(0,Math.min(12,Math.floor(spawned)-Math.floor(cleaned)));
}
export function canTeachInPhase(phase:GymPhase,arrived:number):boolean {
  return phase==='open'&&arrived>0;
}
export function canCloseInPhase(phase:GymPhase,classesToday:number):boolean {
  return phase==='open'&&classesToday>=1;
}
export function canAdvanceDay(phase:GymPhase,arrived:number):boolean {
  return phase==='closing'&&arrived===0;
}
