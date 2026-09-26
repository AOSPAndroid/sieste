import {fatigueRecovery} from './fatigue-recovery-data';
import {localDate} from './week-overview';
import type {AthleteData} from './analytics';
export function loadAnalysis(data:AthleteData,now:Date,days:number,mode:'load'|'time'='load'){
 const history=fatigueRecovery(data,now,days+35).map(r=>{
  const sessions=data.activities.filter(a=>localDate(new Date(a.date))===r.iso&&new Date(a.date)<=now),values=sessions.map(a=>a.summary?.duration),known=!!data.historyStart&&data.historyStart.slice(0,10)<=r.iso&&data.historyComplete!==false&&(!data.syncedAt||r.iso<=localDate(new Date(data.syncedAt)));
  const minutes=sessions.length?values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)?values.reduce((a,b)=>a+b,0)/60:null:known?0:null;
  return {...r,value:mode==='load'?r.effort:minutes,sessions:sessions.length};
 });
 const avg=(list:typeof history)=>list.length&&list.every(r=>r.value!==null)?list.reduce((s,r)=>s+r.value!,0)/list.length:null;
 const rows=history.map((r,i)=>({...r,short:i>=6?avg(history.slice(i-6,i+1)):null,long:i>=27?avg(history.slice(i-27,i+1)):null})).slice(-days);
 const completed=history.slice(0,-1),recent=completed.slice(-7),prior=completed.slice(-14,-7),baseline=completed.slice(-28),a=avg(recent),b=avg(prior),base=avg(baseline);
 const change=a!==null&&b!==null&&b>0?(a/b-1)*100:null;
 const known=recent.filter(r=>r.value!==null),sum=known.length?known.reduce((s,r)=>s+r.value!,0):null;
 return {rows,today:rows.at(-1)!,recent,prior,average:a,baseline:base,change,previous:b===null?null:b*7,total:sum,complete:known.length===7,coverage:known.length,missing:rows.filter(r=>r.value===null),ratio:a!==null&&base!==null&&base>0?a/base:null,source:mode==='time'?'Training minutes':data.provider==='coros'?'COROS load':'Tredict effort',unit:mode==='time'?'min':'points'};
}
