export type Point = { x:number; y:number };
export type Footprint = Point & { rx:number; ry:number };

const cell=6, cols=80, rows=37;
const steps=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const gridPoint=(id:number):Point=>({x:(id%cols)*cell+3,y:Math.floor(id/cols)*cell+3});
const gridId=(p:Point)=>clamp(Math.round((p.y-3)/cell),0,rows-1)*cols+clamp(Math.round((p.x-3)/cell),0,cols-1);

export function clearSegment(a:Point,b:Point,canStand:(x:number,y:number)=>boolean):boolean {
  const samples=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));
  for(let i=1;i<=samples;i++){
    const t=i/samples;
    if(!canStand(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;
  }
  return true;
}

export class GymNavigation {
  private readonly grid=new Uint8Array(cols*rows);
  private readonly canStand:(x:number,y:number)=>boolean;
  constructor(canStand:(x:number,y:number)=>boolean) {this.canStand=canStand;}

  rebuild():void {
    for(let id=0;id<this.grid.length;id++){
      const p=gridPoint(id);
      this.grid[id]=Number(this.canStand(p.x,p.y));
    }
  }

  recover(point:Point):Point {
    return this.canStand(point.x,point.y)?point:gridPoint(this.nearest(point,id=>this.grid[id]===1)??gridId(point));
  }

  private nearest(point:Point, valid:(id:number)=>boolean):number|undefined {
    let best=Infinity, found: number|undefined;
    for(let id=0;id<this.grid.length;id++){
      if(!valid(id))continue;
      const p=gridPoint(id),distance=(point.x-p.x)**2+(point.y-p.y)**2;
      if(distance<best){found=id;best=distance;}
    }
    return found;
  }

  route(start:Point,end:Point,openAt:(x:number,y:number)=>boolean=()=>true,exact=false):Point[] {
    const openPoint=(x:number,y:number)=>this.canStand(x,y)&&openAt(x,y);
    const openCell=(id:number)=>{
      if(!this.grid[id])return false;
      const p=gridPoint(id);
      return openAt(p.x,p.y);
    };
    if(openPoint(end.x,end.y)&&clearSegment(start,end,openPoint))return [end];
    if(exact&&!openPoint(end.x,end.y))return [];
    const reachableStart=(id:number)=>openCell(id)&&clearSegment(start,gridPoint(id),openPoint);
    const startId=gridId(start);
    const origin=reachableStart(startId)?startId:this.nearest(start,reachableStart);
    const endId=gridId(end);
    const reachableEnd=(id:number)=>openCell(id)&&(!exact||clearSegment(gridPoint(id),end,openPoint));
    const goal=reachableEnd(endId)?endId:this.nearest(end,reachableEnd);
    if(origin===undefined||goal===undefined)return [];
    const heuristic=(id:number)=>Math.hypot(id%cols-goal%cols,Math.floor(id/cols)-Math.floor(goal/cols));
    const open=new Set([origin]), closed=new Set<number>(), parents=new Map<number,number>();
    const scores=new Map<number,number>([[origin,0]]);
    while(open.size){
      let best=Infinity,current=origin;
      for(const id of open){
        const score=scores.get(id)!+heuristic(id);
        if(score<best){best=score;current=id;}
      }
      if(current===goal){
        const path:Point[]=[];
        for(let id=goal;;id=parents.get(id)!){
          path.unshift(gridPoint(id));
          if(id===origin)break;
        }
        if(openPoint(end.x,end.y)&&clearSegment(path[path.length-1],end,openPoint))path.push(end);
        const simplified:Point[]=[];
        let anchor=start;
        for(let i=0;i<path.length;i++){
          if(i+1<path.length&&clearSegment(anchor,path[i+1],openPoint))continue;
          simplified.push(path[i]);anchor=path[i];
        }
        return simplified;
      }
      open.delete(current);closed.add(current);
      const cx=current%cols,cy=Math.floor(current/cols);
      for(const [dx,dy] of steps){
        const x=cx+dx,y=cy+dy,id=y*cols+x;
        if(x<0||x>=cols||y<0||y>=rows||closed.has(id)||!openCell(id))continue;
        if(dx&&dy&&(!openCell(cy*cols+x)||!openCell(y*cols+cx)))continue;
        if(!clearSegment(gridPoint(current),gridPoint(id),openPoint))continue;
        const score=scores.get(current)!+Math.hypot(dx,dy);
        if(score>=(scores.get(id)??Infinity))continue;
        parents.set(id,current);scores.set(id,score);open.add(id);
      }
    }
    return [];
  }
}
