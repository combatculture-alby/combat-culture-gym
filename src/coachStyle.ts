/** Coach customization is cosmetic only. Purchases never increase class rewards. */
export type CoachAppearance={
  skin:number;hair:number;cut:number;top:number;shorts:number;gloves:number;
};
export type ClothingSlot='top'|'shorts'|'gloves';
export type ClothingItem={
  id:number;name:string;slot:ClothingSlot;value:number;price:number;
};
export const COACH_SKINS=[
  {skin:'#dfab81',shade:'#a36452'},
  {skin:'#f0c39a',shade:'#b57c5c'},
  {skin:'#cb8e64',shade:'#95543e'},
  {skin:'#ab7255',shade:'#744436'},
  {skin:'#754a38',shade:'#4c312e'},
] as const;
export const COACH_HAIR=[
  {hair:'#292735',light:'#504557'},
  {hair:'#754338',light:'#a46048'},
  {hair:'#1f1d25',light:'#46444d'},
  {hair:'#b68b47',light:'#ebc37b'},
  {hair:'#9c6b59',light:'#d59c7c'},
] as const;
export const COACH_SHIRTS=[
  {top:'#354754',dark:'#23343e',trim:'#d56b50'},
  {top:'#ded2bd',dark:'#938f81',trim:'#365b60'},
  {top:'#a43c3b',dark:'#662d39',trim:'#f2c88c'},
  {top:'#65a58c',dark:'#396b65',trim:'#dbd4a8'},
  {top:'#e4bc69',dark:'#a77d45',trim:'#5c6579'},
  {top:'#37394a',dark:'#272b39',trim:'#d1a65c'},
] as const;
export const COACH_SHORTS=[
  '#a74a43','#383d56','#d6d0b8','#315f66','#d7a65a','#655d84'
] as const;
export const COACH_GLOVES=[
  null,'#c94945','#2b4858','#dab35f'
] as const;

export const DEFAULT_COACH:CoachAppearance={
  skin:0,hair:0,cut:0,top:0,shorts:0,gloves:0
};
export const FREE_CLOTHING:{[key in ClothingSlot]:readonly number[]}={
  top:[0,1],shorts:[0,1],gloves:[0]
};
export const CLOTHING_SHOP:ClothingItem[]=[
  {id:0,name:'Classic Red Training Tee',slot:'top',value:2,price:75},
  {id:1,name:'Seafoam Team Jersey',slot:'top',value:3,price:85},
  {id:2,name:'Gold Academy Tee',slot:'top',value:4,price:110},
  {id:3,name:'Midnight Coach Shirt',slot:'top',value:5,price:130},
  {id:4,name:'White Muay Thai Shorts',slot:'shorts',value:2,price:75},
  {id:5,name:'Teal Fight Shorts',slot:'shorts',value:3,price:90},
  {id:6,name:'Gold Fight Shorts',slot:'shorts',value:4,price:125},
  {id:7,name:'Purple Fight Shorts',slot:'shorts',value:5,price:105},
  {id:8,name:'Red Training Gloves',slot:'gloves',value:1,price:60},
  {id:9,name:'Blue Training Gloves',slot:'gloves',value:2,price:70},
  {id:10,name:'Gold Training Gloves',slot:'gloves',value:3,price:110}
];

function index(value:unknown,length:number,fallback=0):number {
  return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<length?
    value:fallback;
}
export function normalizeCoachAppearance(value:unknown):CoachAppearance {
  const raw=value&&typeof value==='object'?value as Partial<CoachAppearance>:{};
  return {
    skin:index(raw.skin,COACH_SKINS.length),
    hair:index(raw.hair,COACH_HAIR.length),
    cut:index(raw.cut,5),
    top:index(raw.top,COACH_SHIRTS.length),
    shorts:index(raw.shorts,COACH_SHORTS.length),
    gloves:index(raw.gloves,COACH_GLOVES.length)
  };
}
export function normalizeCloset(value:unknown):number[] {
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter(id=>Number.isInteger(id)&&id>=0&&id<CLOTHING_SHOP.length))].sort((a,b)=>a-b);
}
export function hasClothing(slot:ClothingSlot,value:number,owned:number[]):boolean {
  return FREE_CLOTHING[slot].includes(value)||
    CLOTHING_SHOP.some(item=>item.slot===slot&&item.value===value&&owned.includes(item.id));
}
export function normalizeUnlockedAppearance(value:unknown,owned:unknown):CoachAppearance {
  const a=normalizeCoachAppearance(value),closet=normalizeCloset(owned);
  for(const slot of ['top','shorts','gloves'] as ClothingSlot[]){
    if(!hasClothing(slot,a[slot],closet))a[slot]=0;
  }
  return a;
}
export function coachTextureId(value:CoachAppearance):string {
  const a=normalizeCoachAppearance(value);
  return 'coach-custom-'+[a.skin,a.hair,a.cut,a.top,a.shorts,a.gloves].join('-');
}
