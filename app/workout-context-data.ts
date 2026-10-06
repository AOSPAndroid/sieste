import type {AthleteData,Workout} from './analytics';
import {sportFamily} from './sports';
import {corosNativeSummary,COROS_NATIVE_VERSION} from './coros-native';

type RecordedWorkout=Workout&{localDay?:string};
type Summary=Record<string,any>;
export type UsualRange={low:number;high:number;mean:number;count:number;source:string};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const positive=(v:unknown):v is number=>finite(v)&&v>0;
const mean=(values:number[])=>values.reduce((sum,v)=>sum+v,0)/values.length;
const day=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const shift=(date:string,amount:number)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+amount);return day(d)};
export function workoutDay(activity:RecordedWorkout){return /^\d{4}-\d\d-\d\d$/.test(activity.localDay??'')?activity.localDay!:day(new Date(activity.date))}
export function recordedWorkoutSummary(activity:RecordedWorkout):Summary{return activity.provider==='coros'?corosNativeSummary(activity.summary,activity.nativeVersion===COROS_NATIVE_VERSION):activity.summary??{}}
function workouts(detail:RecordedWorkout,history:Workout[],now:Date){const byId=new Map<string,RecordedWorkout>();for(const a of history)if(Number.isFinite(Date.parse(a.date))&&new Date(a.date)<=now)byId.set(a.id,a);byId.set(detail.id,detail);return [...byId.values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.id.localeCompare(b.id))}
function finish(activity:RecordedWorkout){const summary=recordedWorkoutSummary(activity),seconds=positive(summary.durationTotal)?summary.durationTotal:positive(summary.duration)?summary.duration:null;return seconds===null?null:Date.parse(activity.date)+seconds*1000}
function gap(first:RecordedWorkout,second:RecordedWorkout){const end=finish(first);if(end===null)return {hours:null,overlap:false};const milliseconds=Date.parse(second.date)-end;return {hours:milliseconds>=0?milliseconds/3600000:null,overlap:milliseconds<0}}
export function workoutContext(detail:RecordedWorkout,history:Workout[],now=new Date()){
 const ordered=workouts(detail,history,now),index=ordered.findIndex(a=>a.id===detail.id),previous=ordered[index-1]??null,next=ordered[index+1]??null;
 return {previous,current:detail,next,before:previous?gap(previous,detail):null,after:next?gap(detail,next):null};
}
function strengthRow(activity:RecordedWorkout){const s=recordedWorkoutSummary(activity);return {activity,duration:positive(s.duration)?s.duration:null,sets:finite(s.sets)&&s.sets>=0&&Number.isInteger(s.sets)?s.sets:null,aerobic:finite(s.aerobicTrainingEffect)&&s.aerobicTrainingEffect>=0?s.aerobicTrainingEffect:null,anaerobic:finite(s.anaerobicTrainingEffect)&&s.anaerobicTrainingEffect>=0?s.anaerobicTrainingEffect:null}}
export function strengthSummary(detail:RecordedWorkout,history:Workout[],now=new Date()){
 if(sportFamily(detail)!=='strength_training')return null;
 const current=strengthRow(detail),previous=workouts(detail,history,now).filter(a=>a.id!==detail.id&&Date.parse(a.date)<Date.parse(detail.date)&&sportFamily(a)==='strength_training').slice(-3).reverse().map(strengthRow),last=previous[0];
 return {current,previous,durationChange:last?.duration!==null&&last?.duration!==undefined&&current.duration!==null?current.duration-last.duration:null,setsChange:last?.sets!==null&&last?.sets!==undefined&&current.sets!==null?current.sets-last.sets:null};
}
function usual(values:number[],kind:'sleep'|'hrv'|'rhr'):UsualRange|null{
 if(values.length<(kind==='sleep'?7:14))return null;
 const transformed=kind==='hrv'?values.map(Math.log):values,average=mean(transformed),spread=Math.max(Math.sqrt(mean(transformed.map(v=>(v-average)**2))),kind==='hrv'?.1:kind==='rhr'?2:.25),width=2*spread;
 return {low:kind==='hrv'?Math.exp(average-width):Math.max(0,average-width),high:kind==='hrv'?Math.exp(average+width):average+width,mean:mean(values),count:values.length,source:'Prior 28 days · mean ±2 SD'+(kind==='hrv'?' on log scale':'')};
}
export function recoveryAfterWorkout(detail:RecordedWorkout,history:Workout[],healthData?:AthleteData,now=new Date()){
 const date=workoutDay(detail),today=day(now),all=workouts(detail,history,now),sessions=all.filter(a=>workoutDay(a)===date),empty={date,sessions,rows:[],ranges:{sleep:null,hrv:null,rhr:null},available:false} as const;
 if(!healthData)return empty;
 const rhrByDay=new Map<string,{timestamp:string;value:number}>();
 for(const record of healthData.extra?.bodyvalues?.bodyvalues??[]){const t=new Date(record.timestamp);if(!Number.isFinite(t.getTime())||t>now||!positive(record.hrRestDynamic))continue;const key=day(t),previous=rhrByDay.get(key);if(!previous||t.getTime()>Date.parse(previous.timestamp))rhrByDay.set(key,{timestamp:record.timestamp,value:record.hrRestDynamic});}
 const reading=(d:string)=>{if(d>today)return {sleep:null,hrv:null,rhr:null};const key=d.replaceAll('-',''),sleep=healthData.sleep?.[key]?.[0],hrv=healthData.hrv?.[key]?.[0];return {sleep:positive(sleep)?sleep/3600:null,hrv:positive(hrv)?hrv:null,rhr:rhrByDay.get(d)?.value??null}};
 const prior=Array.from({length:28},(_,i)=>reading(shift(date,i-28))),ranges={sleep:usual(prior.map(r=>r.sleep).filter(positive),'sleep'),hrv:usual(prior.map(r=>r.hrv).filter(positive),'hrv'),rhr:usual(prior.map(r=>r.rhr).filter(positive),'rhr')};
 const rows=Array.from({length:3},(_,i)=>shift(date,i+1)).filter(d=>d<=today).map(d=>({date:d,...reading(d),sessions:all.filter(a=>workoutDay(a)===d)}));
 return {date,sessions,rows,ranges,available:true};
}
