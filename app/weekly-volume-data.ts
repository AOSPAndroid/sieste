import type {AthleteData} from './analytics';
import {sportFamily} from './sports';
import {localDate} from './week-overview';
export type VolumeMetric='sport'|'hours'|'sessions';
export function weeklyVolume(data:AthleteData,now:Date,sport:string,count:number,metric:VolumeMetric){
 const monday=new Date(now.getFullYear(),now.getMonth(),now.getDate());monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
 const field=metric==='sessions'?'sessions':metric==='hours'||sport==='strength_training'?'duration':'distance',unit=field==='duration'?'h':field==='distance'?'km':'sessions';
 const excluded=new Set((data.excludedWorkouts??[]).map(a=>a.id));
 const rows=Array.from({length:count},(_,i)=>{const start=new Date(monday);start.setDate(start.getDate()-7*(count-1-i));const end=new Date(start);end.setDate(end.getDate()+7);const last=new Date(end);last.setDate(last.getDate()-1);
 const acts=data.activities.filter(a=>!excluded.has(a.id)&&sportFamily(a)===sport&&new Date(a.date)>=start&&new Date(a.date)<end&&new Date(a.date)<=now),values=acts.map(a=>field==='sessions'?1:a.summary?.[field]),valid=values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0),covered=!!data.historyStart&&new Date(data.historyStart)<=start&&data.historyComplete!==false;
 const value=valid.length?valid.reduce((a,b)=>a+b,0)/(field==='duration'?3600:field==='distance'?1000:1):acts.length||!covered?null:0;
 return {start:localDate(start),end:localDate(last),label:start.toLocaleDateString('en-GB',{day:'numeric',month:'short'}),value,sessions:acts.length,missing:values.length-valid.length,incomplete:!covered||values.length!==valid.length,current:i===count-1};
 });
 const earlier=rows.slice(-5,-1),average=earlier.length===4&&earlier.every(r=>!r.incomplete&&r.value!==null)?earlier.reduce((s,r)=>s+r.value!,0)/4:null;
 const current=rows.at(-1)!,priorStart=new Date(monday),priorEnd=new Date(now);priorStart.setDate(priorStart.getDate()-7);priorEnd.setDate(priorEnd.getDate()-7);
 const priorActs=data.activities.filter(a=>!excluded.has(a.id)&&sportFamily(a)===sport&&new Date(a.date)>=priorStart&&new Date(a.date)<=priorEnd),priorValues=priorActs.map(a=>field==='sessions'?1:a.summary?.[field]),priorValid=priorValues.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
 const priorComplete=!!data.historyStart&&new Date(data.historyStart)<=priorStart&&data.historyComplete!==false&&priorValid.length===priorValues.length;
 const previous=priorComplete?priorValid.reduce((a,b)=>a+b,0)/(field==='duration'?3600:field==='distance'?1000:1):null;
 const absolute=!current.incomplete&&current.value!==null&&previous!==null?current.value-previous:null,percent=absolute===null||previous===null?null:previous>0?absolute/previous*100:absolute===0?0:null;
 const direction=absolute===null?'unavailable':absolute>0?'up':absolute<0?'down':'flat';
 return {rows,unit,average,current,comparison:{previous,absolute,percent,direction,through:priorEnd.toISOString()}};

}
