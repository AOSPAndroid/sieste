import {effortExcluded} from './workout-exclusions';
import {localDate} from './week-overview';
import type {AthleteData} from './analytics';
import {activitiesByDay} from './activity-day-index';
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export function fatigueRecovery(data:AthleteData,now:Date,days=28){
 const dateLabel=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'});
 const source=data.extra?.efforts?.trainingEfforts;
 const sessionsByDay=activitiesByDay(data.activities,now),restingByDay=new Map<string,{time:number;value:number}>();
 for(const reading of data.extra?.bodyvalues?.bodyvalues??[]){
  const date=new Date(reading.timestamp);
  if(!(date<=now)||!valid(reading.hrRestDynamic))continue;
  const key=localDate(date),previous=restingByDay.get(key);
  if(!previous||date.getTime()>previous.time)restingByDay.set(key,{time:date.getTime(),value:reading.hrRestDynamic});
 }
 const rows=Array.from({length:days+27},(_,i)=>{
  const date=new Date(now);date.setDate(date.getDate()-days-26+i);date.setHours(0,0,0,0);
  const iso=localDate(date),key=iso.replaceAll('-',''),covered=!!data.historyStart&&data.historyStart.slice(0,10)<=iso&&data.historyComplete!==false&&(!data.syncedAt||iso<=localDate(new Date(data.syncedAt)));
  const sessions=sessionsByDay.get(iso)??[];
  const raw=source?.[key],values=Array.isArray(raw)?raw.map((v:any)=>Array.isArray(v)?v[0]:v):[];
  // The daily endpoint can lag behind workout summaries. Only use a complete,
  // same-provider set; never combine COROS load with Tredict effort.
  const channel=sessions.every(a=>valid(a.summary?.effort?.heartrate))?'heartrate':'power';
  const recorded=sessions.map(a=>data.provider==='coros'?a.provider==='coros'?a.summary?.trainingLoad:null:a.provider==='coros'?null:a.summary?.effort?.[channel]);
  const completeSessions=recorded.length>0&&recorded.every(valid);
  // A complete activity history confirms rest even when the effort feed failed.
  const restCovered=covered&&(!!source||data.historyComplete===true);
  const effort=effortExcluded(data,iso)?null:completeSessions?recorded.reduce((sum:number,v:number)=>sum+v,0):values.length&&values.every(valid)?values.reduce((a:number,b:number)=>a+b,0):restCovered&&(raw===undefined||Array.isArray(raw)&&raw.length===0)&&sessions.length===0?0:null;
  return {iso,label:dateLabel.format(date),effort:effort as number|null,sleep:valid(data.sleep[key]?.[0])?data.sleep[key][0]/3600:null,hrv:valid(data.hrv[key]?.[0])?data.hrv[key][0]:null,rhr:restingByDay.get(iso)?.value??null};
 });
 return rows.map((r,i)=>{const average=(n:number)=>{const window=rows.slice(Math.max(0,i-n+1),i+1);return window.length===n&&window.every(d=>d.effort!==null)?window.reduce((s,d)=>s+d.effort!,0)/n:null};return {...r,load7:average(7),load28:average(28)}}).slice(-days);
}
