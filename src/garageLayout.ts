// Dimensions are in game pixels. One block is 24 pixels at the world scale.
export const BLOCK_SIZE=24;
export const GARAGE_ASSET_BLOCKS={
  coach:[1.2,2.2],door:[1.5,3],shutter:[5,3.25],
  desk:[4.4,2.5],stock:[3.5,3.5],water:[.95,2.5],mop:[1.22,2.1],
  board:[2.8,1.9],closet:[2.2,3.15],dumbbellRack:[2.5,1.6],heavyBag:[1.5,2.5],weightBench:[2.25,1.25],focusMitts:[1.12,1.12],wallPads:[1.12,1.12],speedBag:[1.12,1.12],
  kettlebells:[1.9,.8],fan:[1.05,2.2],trashCan:[.95,1.25],
  tile:[1,1],clock:[1.05,.65],toolbox:[.95,.75],dustpan:[.95,.95],
  cleaner:[.65,.95],paperRoll:[.65,.95],jumpRope:[.7,1.25],bands:[.95,1.25]
} as const;

export const garageWall={left:0,right:480,top:23,bottom:95};
export const garageFloor={left:0,right:480,top:96,bottom:257};
export const garageRoom={left:10,right:470,top:101,bottom:247};
export const garageMat={left:59,right:315,top:138,bottom:226};
export const garageEntrance={x:313,y:101};
export const garageDoors=[
  {x:122,y:30,w:77,h:65},
  {x:298,y:34,w:31,h:61}
];
export type GarageFixtureId='stock'|'water'|'mop'|'desk'|'board';
type Point={x:number;y:number};
export type GaragePositions=Partial<Record<GarageFixtureId,Point>>;
const defaults:Record<GarageFixtureId,Point>={
  stock:{x:73,y:113},water:{x:229,y:108},mop:{x:272,y:108},
  desk:{x:372,y:182},board:{x:379,y:69}
};
const baseDepth={stock:12,water:12,mop:10,desk:20,board:0};
const artRatios={stock:242/311,water:101/287,mop:107/196,desk:1437/841,board:229/150};
export const garageFixtureIds=Object.keys(defaults) as GarageFixtureId[];

export function garageFixture(id:GarageFixtureId,positions:GaragePositions={}){
  const p=positions[id];
  const {x,y}=p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?p:defaults[id];
  const [width,height]=GARAGE_ASSET_BLOCKS[id];
  const h=Math.min(height,width/artRatios[id])*BLOCK_SIZE;
  const w=h*artRatios[id];
  const depth=baseDepth[id];
  return {
    art:{x:x-w/2,y:y-h,w,h},
    footprint:{x,y:y-depth/2,rx:w/2,ry:depth/2},
    approach:{x,y:id==='board'?garageRoom.top+11:y+15}
  };
}

export function garageServiceGeometry(positions:GaragePositions={}){
  const board=garageFixture('board',positions),desk=garageFixture('desk',positions);
  return {room:garageRoom,board:board.art,desk:desk.art,
    boardApproach:board.approach,deskApproach:desk.approach};
}

export const garageFixtures={
  stock:garageFixture('stock'),water:garageFixture('water'),
  mop:garageFixture('mop'),desk:garageFixture('desk')
};
export const garageBoard=garageFixture('board').art;
export const garageBoardApproach=garageFixture('board').approach;
