export type GymPhase='opening'|'open'|'closing';
export const ARRIVAL_INTERVAL_SECONDS=3.5;
export const DEPARTURE_INTERVAL_SECONDS=2.7;
export function normalizeGymPhase(value:unknown,legacy=false):GymPhase {
  return value==='opening'||value==='open'||value==='closing'?value:legacy?'open':'opening';
}
export function normalizeArrivalCount(value:unknown,phase:GymPhase,attendance:number):number {
  if(phase==='opening')return 0;
  const capacity=Number.isFinite(attendance)?Math.max(0,Math.floor(attendance)):0;
  if(typeof value!=='number'||!Number.isInteger(value))
    return phase==='open'?capacity:0;
  return Math.max(0,Math.min(capacity,value));
}
export function outstandingTrash(spawned:number,cleaned:number):number {
  const total=Number.isFinite(spawned)?Math.max(0,Math.floor(spawned)):0;
  const removed=Number.isFinite(cleaned)?Math.max(0,Math.floor(cleaned)):0;
  return Math.max(0,Math.min(12,total-removed));
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

/** Daily services persist; only deliveries and per-day counters reset overnight. */
export function overnightSupplies(stock:number[],pending:number[]):number[]{
  return Array.from({length:4},(_,i)=>{
    const available=Number.isFinite(stock?.[i])?Math.max(0,Math.floor(stock[i])):0;
    const ordered=Number.isFinite(pending?.[i])?Math.max(0,Math.floor(pending[i])):0;
    return Math.min(99,available+ordered);
  });
}

/** A day cannot be skipped while students are still on the floor. */
export function canCompleteDay(phase:GymPhase,arrived:number,classesToday:number):boolean {
  return canAdvanceDay(phase,arrived)&&classesToday>=1;
}

/** Consistent daily coaching requests, regardless of staggered arrivals. */
export function availableCoachingRequests(planned:number[],present:number[],completed:number[],limit=2):number[]{
  const visible=new Set(present);
  const done=new Set(completed);
  return planned.filter(index=>visible.has(index)&&!done.has(index)).slice(0,Math.max(0,limit));
}

/** Projected earnings should never imply the full roster is on the floor. */
export function classAttendanceForPreview(phase:GymPhase,arrived:number,scheduled:number):number {
  if(phase!=='open')return 0;
  const a=Number.isFinite(arrived)?Math.max(0,Math.floor(arrived)):0;
  const cap=Number.isFinite(scheduled)?Math.max(0,Math.floor(scheduled)):0;
  return Math.min(a,cap);
}
