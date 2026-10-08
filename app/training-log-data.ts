import {localDate} from './week-overview';
import {sportFamily,sportName} from './sports';
import type {Workout} from './analytics';
export type TrainingLogHeatMetric='duration'|'distance'|'calories';
export const trainingLogHeatThresholds={duration:[1800,3600,7200,10800],distance:[5000,10000,25000,50000],calories:[250,500,1000,1500]} as const;
/** Calendar volume uses recorded source units; strength has no distance measure. */
export function trainingLogHeat(activities:Workout[],metric:TrainingLogHeatMetric){
 const applicable=metric==='distance'?activities.filter(a=>sportFamily(a)!=='strength_training'):activities;
 const values=applicable.map(a=>a.summary?.[metric]),valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const missing=values.some(v=>!valid(v)),total=values.reduce((sum,v)=>sum+(valid(v)?v:0),0);
 const unavailable=activities.length>0&&(missing||applicable.length===0);
 const level=unavailable||total<=0?0:1+trainingLogHeatThresholds[metric].filter(threshold=>total>=threshold).length;
 return {total,level,missing,unavailable};
}
export function trainingLogMonth(activities:Workout[],month:string,sport:string,query:string,now:Date){
 const matches=activities.filter(a=>new Date(a.date)<=now&&localDate(new Date(a.date)).startsWith(month)&&(sport==='all'||sportFamily(a)===sport)&&`${a.title??''} ${sportName(sportFamily(a))}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
 const first=new Date(month+'-01T12:00:00'),offset=(first.getDay()+6)%7,count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
 const cells=Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{const day=i-offset+1;if(day<1||day>count)return null;const key=`${month}-${String(day).padStart(2,'0')}`;return {day,key,activities:matches.filter(a=>localDate(new Date(a.date))===key)}});
 const finite=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const times=matches.filter(a=>finite(a.summary?.duration)),distances=matches.filter(a=>sportFamily(a)!=='strength_training'),known=distances.filter(a=>finite(a.summary?.distance));
 return {matches,cells,duration:times.reduce((s,a)=>s+a.summary!.duration,0),durationMissing:matches.length-times.length,distance:known.reduce((s,a)=>s+a.summary!.distance,0)/1000,distanceMissing:distances.length-known.length};
}
