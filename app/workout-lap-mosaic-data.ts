import {effortProfile} from './effort-profile-data';
import {sportFamily} from './sports';

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const positive=(value:unknown):value is number=>finite(value)&&value>0;
export const lapLabelOptions=['Warm-up','Work','Recovery','Cool-down'] as const;
export type LapLabel=typeof lapLabelOptions[number];
export type MosaicLap={index:number;duration:number|null;distance:number|null;speed:number|null;power:number|null;hr:number|null;cadence:number|null;start:number|null;end:number|null};

/** Keep source lap metrics even when their timing cannot be placed on the route. */
export function lapMosaic(detail:Record<string,any>){
 const family=sportFamily(detail),sensor=Array.isArray(detail.seriesSampled?.data?.speed)?'speed':'power';
 const profile=effortProfile(detail,sensor,family);
 const laps:MosaicLap[]=(Array.isArray(detail.laps)?detail.laps:[]).map((lap:any,index:number)=>{
  const value={...lap,...lap.summary},aligned=profile.laps.find(l=>l.index===index+1);
  const duration=positive(value.duration)?value.duration:positive(value.durationTotal)?value.durationTotal:null;
  const distance=positive(value.distance)?value.distance:null;
  const speed=positive(value.speed)?value.speed:positive(value.pace)?1000/value.pace:duration&&distance?distance/duration:null;
  return {index:index+1,duration,distance,speed,power:finite(value.power)&&value.power>=0?value.power:null,hr:positive(value.heartrate)?value.heartrate:null,cadence:positive(value.cadence)?value.cadence:null,start:aligned?.start??null,end:aligned?.end??null};
 });
 return {laps,reason:profile.reason,totalDuration:laps.reduce((sum,lap)=>sum+(lap.duration??0),0),family};
}

export function mosaicLevel(lap:MosaicLap,laps:MosaicLap[],metric:'speed'|'power'){
 const value=lap[metric],known=laps.flatMap(l=>finite(l[metric])?[l[metric]!]:[]);
 if(!finite(value)||!known.length)return null;
 const low=Math.min(...known),high=Math.max(...known);
 // Equal laps remain visibly equal rather than inventing differences.
 return high-low<1e-8?.5:(value-low)/(high-low);
}

/** Stored labels contain only an activity key and a small enum, never credentials. */
export function mosaicStorageKey(scope:string,detail:Record<string,any>){
 if(!scope||!detail.id||detail.demo)return null;
 const safeScope=String(scope).slice(0,160),activity=String(detail.id).slice(0,160);
 const revision=(detail.laps??[]).map((lap:any)=>{const s={...lap,...lap.summary};return `${s.duration??s.durationTotal??''}:${s.distance??''}`}).join('|');
 let hash=2166136261;for(const character of revision){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619)}
 return `sieste:lap-labels:${encodeURIComponent(safeScope)}:${encodeURIComponent(activity)}:${(hash>>>0).toString(36)}`;
}

export function validLapLabels(value:unknown,count:number):Record<string,LapLabel>{
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(Object.entries(value).filter(([key,label])=>/^\d+$/.test(key)&&Number(key)>=1&&Number(key)<=count&&lapLabelOptions.includes(label as LapLabel))) as Record<string,LapLabel>;
}
