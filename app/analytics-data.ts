import type {AthleteData,Workout} from './analytics';
import {effortExcluded} from './workout-exclusions';
import {sportFamily} from './sports';
const num=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;

export function analyticsDays(data:AthleteData,end:Date,days:number,filter:string){
 const first=new Date(end);first.setUTCHours(0,0,0,0);first.setUTCDate(first.getUTCDate()-364);
 const byDay=new Map<string,Workout[]>();
 for(const activity of data.activities){
  if(filter!=='all'&&sportFamily(activity)!==filter)continue;
  const key=activity.date.slice(0,10),bucket=byDay.get(key);
  if(bucket)bucket.push(activity);else byDay.set(key,[activity]);
 }
 const efforts=data.extra?.efforts?.trainingEfforts;
 const series=Array.from({length:365},(_,i)=>{
  const date=new Date(first);date.setUTCDate(first.getUTCDate()+i);
  const iso=date.toISOString().slice(0,10),key=iso.replaceAll('-',''),daily=byDay.get(iso)??[],raw=efforts?.[key];
  const effort=effortExcluded(data,iso)?null:efforts&&filter==='all'?(Array.isArray(raw)?raw.reduce((s:number,e:any)=>s+(num(Array.isArray(e)?e[0]:e)??0),0):daily.length||!data.historyComplete?null:0):null;
  return {iso,date:date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit',timeZone:'UTC'}),effort,volume:daily.reduce((s,a)=>s+(num(a.summary?.duration)??0),0)/3600,sleep:num(data.sleep[key]?.[0])==null?null:data.sleep[key][0]/3600,sleepBaseline:num(data.sleep[key]?.[1])==null?null:data.sleep[key][1]/3600,hrv:num(data.hrv[key]?.[0]),hrvBaseline:num(data.hrv[key]?.[1])};
 });
 const sum=[0],count=[0],volume=[0];
 for(const row of series){sum.push(sum.at(-1)!+(row.effort??0));count.push(count.at(-1)!+(row.effort===null?0:1));volume.push(volume.at(-1)!+row.volume)}
 const mean=(end:number,window:number)=>{const observations=count[end]-count[end-window];return observations?(sum[end]-sum[end-window])/observations:null};
 return series.map((row,i)=>({...row,short:i>=6?mean(i+1,7):null,long:i>=41?mean(i+1,42):null,volume7:i>=6?volume[i+1]-volume[i-6]:null})).slice(-days);
}
