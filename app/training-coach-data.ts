import {sensorEvidence} from './tredict-opportunities-data';
import {runningSignals,classifySession} from './session-intelligence-data';
import type {AthleteData,Workout} from './analytics';
import {sportFamily} from './sports';
import {localDate} from './week-overview';
import {fatigueRecovery} from './fatigue-recovery-data';
export const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const shift=(d:Date,n:number)=>{const v=new Date(d);v.setDate(v.getDate()+n);return v};
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
export const uniqueWorkouts=(activities:Workout[])=>[...new Map(activities.filter(a=>a.id&&Number.isFinite(Date.parse(a.date))).map(a=>[a.id,a])).values()];

// Exact fixed-time windows. Partial samples are integrated; gaps invalidate a window.
export function sampledBest(values:unknown[],step:number,seconds:number,cap:number){
 if(!finite(step)||step<=0||step>30||!finite(cap)||cap<seconds)return null;
 const count=Math.min(values.length,Math.floor(cap/step));
 const n=Math.floor(seconds/step),fraction=seconds/step-n;
 if(n<1||count<n+(fraction>0?1:0))return null;
 let sum=0,missing=0,best=-Infinity,start=0;
 const ok=(v:unknown):v is number=>finite(v)&&v>=0;
 for(let i=0;i<count;i++){
  if(ok(values[i]))sum+=values[i] as number;else missing++;
  if(i>=n){if(ok(values[i-n]))sum-=values[i-n] as number;else missing--}
  if(i>=n-1&&!missing){const tail=values[i+1];if(fraction>0&&(i+1>=count||!ok(tail)))continue;const value=(sum+(fraction?(tail as number)*fraction:0))/(n+fraction);if(value>best){best=value;start=(i-n+1)*step}}
 }
 return Number.isFinite(best)?{seconds,value:best,start}:null;
}
export function workoutEvidence(detail:any){
 const step=detail.seriesSampled?.sampleSize,series=detail.seriesSampled?.data??{},summary=detail.summary??{};
 // A missing elapsed duration may still use explicitly sampled time, never pad streams.
 const result:Record<string,ReturnType<typeof sampledBest>[]>={};
 for(const key of ['speed','power']){
  const values=series[key];if(!Array.isArray(values)||!finite(step)||step<=0)continue;
  const cap=finite(summary.durationTotal)?summary.durationTotal:values.length*step;
  result[key]=[5,15,30,60,300,1200,3600].map(s=>sampledBest(values,step,s,cap)).filter(v=>v!==null&&v.value>0);
 }
 return {version:1,best:result,sampleSeconds:finite(step)?step:null,insightVersion:2,sensors:sensorEvidence(detail),insights:runningSignals(detail),classification:classifySession(detail)};
}

export function sleepTrainingPattern(data:AthleteData,now:Date){
 const days=fatigueRecovery(data,now,14),activities=uniqueWorkouts(data.activities);
 const rows=days.map((r,i)=>{const previous=days[i-1],sessions=activities.filter(a=>localDate(new Date(a.date))===r.iso&&new Date(a.date)<=now),known=r.sleep!==null&&r.sleep>0;
  return {...r,sleep:known?r.sleep:null,sessions:sessions.length,minutes:sessions.every(a=>finite(a.summary?.duration)&&a.summary!.duration>=0)?sessions.reduce((s,a)=>s+a.summary!.duration,0)/60:null,short:known&&r.sleep!<6,repeated:known&&r.sleep!<6&&previous?.sleep!==null&&previous?.sleep>0&&previous.sleep<6};
 });
 const recent=rows.slice(-3),overlap=recent.filter(r=>r.repeated&&r.sessions>0),short=recent.filter(r=>r.short),latest=rows.at(-1)!;
 const title=overlap.length?'Training after repeated short nights':short.length>=2?'Repeated short nights':short.length?'Short sleep recorded':recent.every(r=>r.sleep!==null)?'No repeated short-sleep pattern':'Sleep coverage incomplete';
 return {rows,title,tone:overlap.length?'bad':short.length?'watch':'neutral',short:short.length,overlap:overlap.length,latest,coverage:recent.filter(r=>r.sleep!==null).length};
}

export function planComparison(data:AthleteData,now:Date){
 const today=localDate(now),start=shift(now,-((now.getDay()+6)%7)),startKey=localDate(start),endKey=localDate(shift(start,6));
 const source=data.extra?.plannedTrainingList?._embedded?.plannedWorkoutList,available=Array.isArray(source)&&data.sources?.plannedTrainingList?.status!=='unavailable';
 const plans=available?uniqueWorkouts(source):[];
 const activities=uniqueWorkouts(data.activities).filter(a=>new Date(a.date)<=now),families=['running','cycling','strength_training'];
 const covered=!!data.historyStart&&localDate(new Date(data.historyStart))<=startKey&&data.historyComplete!==false&&(!data.syncedAt||localDate(new Date(data.syncedAt))>=localDate(shift(now,-1)));
 const sum=(rows:any[],planned=false)=>{const values=rows.map(a=>planned?(a.duration??a.summary?.duration):a.summary?.duration);return values.every(v=>finite(v)&&v>=0)?values.reduce((s,v)=>s+v,0)/60:null};
 const rows=families.map(family=>{const scoped=plans.filter(a=>sportFamily(a)===family&&localDate(new Date(a.date))>=startKey&&localDate(new Date(a.date))<=endKey),due=scoped.filter(a=>localDate(new Date(a.date))<today),done=activities.filter(a=>sportFamily(a)===family&&localDate(new Date(a.date))>=startKey&&localDate(new Date(a.date))<today);
  const planned=available?sum(due,true):null,actual=covered?sum(done):null;
  return {family,planned,actual,weekPlan:available?sum(scoped,true):null,plannedSessions:due.length,actualSessions:done.length,change:planned!==null&&planned>0&&actual!==null?(actual/planned-1)*100:null};
 });
 return {rows,available,covered,startKey,endKey,duePlans:rows.reduce((s,r)=>s+r.plannedSessions,0),plans:plans.filter(a=>localDate(new Date(a.date))>=startKey&&localDate(new Date(a.date))<=endKey)};
}

export function progressRecords(data:AthleteData,now:Date,family:'running'|'cycling',days=28){
 const end=new Date(now);end.setHours(0,0,0,0);const recentStart=shift(end,-days),priorStart=shift(end,-days*2),metric=family==='running'?'speed':'power';
 const acts=uniqueWorkouts(data.activities).filter(a=>sportFamily(a)===family&&new Date(a.date)>=priorStart&&new Date(a.date)<end);
 const best=(list:Workout[],seconds:number)=>list.flatMap(a=>((a as any).evidence?.best?.[metric]??[]).filter((p:any)=>p?.seconds===seconds&&finite(p.value)&&p.value>0).map((p:any)=>({...p,activity:a}))).sort((a,b)=>b.value-a.value)[0]??null;
 const recent=acts.filter(a=>new Date(a.date)>=recentStart),prior=acts.filter(a=>new Date(a.date)<recentStart);
 const historyCovered=!!data.historyStart&&localDate(new Date(data.historyStart))<=localDate(priorStart)&&data.historyComplete!==false&&(!data.syncedAt||localDate(new Date(data.syncedAt))>=localDate(shift(end,-1)));
 return {metric,recent,prior,historyCovered,from:localDate(priorStart),to:localDate(shift(end,-1)),analyzed:acts.filter(a=>(a as any).evidence?.version===1).length,eligible:acts.length,rows:[60,300,1200,3600].map(seconds=>({seconds,recent:best(recent,seconds),prior:best(prior,seconds)}))};
}

export function intervalConsistency(laps:any[],selected:number[],family:string){
 const rows=selected.map(index=>{const lap=laps[index];if(!lap)return null;const s={...lap,...lap.summary};return {...s,index,pace:finite(s.distance)&&s.distance>0&&finite(s.duration)&&s.duration>0?s.duration/s.distance*1000:finite(s.pace)&&s.pace>0?s.pace:null}}).filter(Boolean).sort((a,b)=>a.index-b.index);
 const metric=family==='cycling'?'power':'pace',valid=rows.length>=3&&rows.every(r=>finite(r[metric])&&r[metric]>0);
 const distances=rows.map(r=>r.distance),durations=rows.map(r=>r.duration);
 const similar=(v:any[])=>v.every(x=>finite(x)&&x>0)&&Math.max(...v)/Math.min(...v)<=1.2;
 const comparable=similar(distances)||similar(durations),n=Math.max(1,Math.floor(rows.length/3));
 const first=rows.slice(0,n),last=rows.slice(-n),average=(part:any[],key:string)=>part.every(r=>finite(r[key])&&r[key]>0)?mean(part.map(r=>r[key])):null;
 const changes=[metric,'heartrate','cadence',...(family==='running'?['stepLength']:[])].map(key=>({key,first:average(first,key),last:average(last,key)}));
 const baseline=average(first,metric),firstFade=valid&&comparable&&baseline?rows.slice(n).find(r=>metric==='pace'?r.pace>baseline*1.03:r.power<baseline*.97):null;
 return {rows,valid:valid&&comparable,n,changes,firstFade:firstFade?.index??null,reason:rows.length<3?'Select at least 3 work laps.':!valid?`Selected laps need ${metric==='pace'?'pace':'power'} readings.`:!comparable?'Choose repeats with similar duration or distance (within 20%).':null};
}
