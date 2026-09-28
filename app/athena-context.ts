import {trainingBrief,recoveryBrief} from './athena-brief';
import type {AthleteData,Workout} from './analytics';
import {sleepToolsData} from './sleep-tools-data';
import {clockLabel} from './sleep-timing-data';
import {activityComparisons,wantsComparison} from './athena-comparisons';
export function athenaContext(data:AthleteData,day:string,selectedId?:string,timeZone="Europe/Paris",message='',compare=false){
 const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const workout=(a:Workout)=>({date:a.date,sport:a.sportType,discipline:a.subSportType,provider:a.provider??data.provider,summary:Object.fromEntries(['duration','distance','heartrate','heartrateMax','power','powerMax','cadence','calories','trainingLoad','pace','elevationGain'].map(k=>[k,finite(a.summary?.[k])])),effort:a.summary?.effort?{heartrate:finite(a.summary.effort.heartrate),power:finite(a.summary.effort.power)}:null});
 const localDay=(v:string)=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v))}catch{return v.slice(0,10)}};
 const rhr=new Map<string,number>();
 for(const row of [...(data.extra?.bodyvalues?.bodyvalues??[])].sort((a,b)=>String(a.timestamp).localeCompare(String(b.timestamp))))if(typeof row.timestamp==='string'&&finite(row.hrRestDynamic)!==null)rhr.set(localDay(row.timestamp),row.hrRestDynamic);
 const f=data.extra?.coros?.fitness;
 const start=new Date(day+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-27);
 const recent=data.activities.filter(a=>localDay(a.date)>=start.toISOString().slice(0,10)&&localDay(a.date)<=day).sort((a,b)=>b.date.localeCompare(a.date));
 const selected=data.activities.find(a=>a.id===selectedId);
 const comparison=selected&&wantsComparison(message,compare)?activityComparisons(data,selected):null;
 const days=/\b(month|28|30|mois|trend|tendance)\b/i.test(message)?28:7;
 const allDaily=sleepToolsData(data,day,35,8).rows.map(r=>({date:r.date,sleepHours:r.hours,hrvMs:r.hrv,restingHrBpm:rhr.get(r.date)??null,bedtime:r.bed===null?null:clockLabel(r.bed),wakeTime:r.wake===null?null:clockLabel(r.wake),awakeMinutes:r.awake,sleepScore:r.score}));
 return {trainingSummary:trainingBrief(data,day,timeZone),recoverySummary:recoveryBrief(allDaily),activityComparison:comparison,contextPolicy:{comparisonOnRequest:true,days,workoutLimit:selected?0:6},asOf:day,timeZone,fitness:f?{source:"COROS",observedAt:typeof f.observedAt==="string"?f.observedAt:null,ftpWatts:finite(f.ftp),thresholdPaceSecondsPerKm:finite(f.thresholdPace),vo2max:finite(f.vo2max)}:null,syncedAt:data.syncedAt??null,provider:data.provider??'mixed',historyComplete:data.historyComplete??false,units:{duration:'seconds',distance:'metres',pace:'seconds/km',power:'watts',heartrate:'bpm',cadence:'recorded provider cadence',sleep:'hours',hrv:'ms'},daily:allDaily.slice(-days),workouts:recent.slice(0,selected?0:6).map(workout),workoutCount:recent.length,selectedWorkout:selected?workout(selected):null,notes:['Null means missing, never zero. Today may be incomplete.','Resting HR is daily, not an overnight trace. Sleep date is wake date.','Load/effort scales differ by provider; do not add or compare incompatible scales.','Training history may be incomplete. No location, route coordinates or credentials are included.']};
}
