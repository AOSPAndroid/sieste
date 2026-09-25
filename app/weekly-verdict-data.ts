import {localDate} from './week-overview';
import {shiftSleepDate} from './sleep-insights-data';
import {sportFamily} from './sports';
export function weeklyVerdict(data:any,now:Date,family:string){
 const end=shiftSleepDate(localDate(now),-1),start=shiftSleepDate(end,-6),priorStart=shiftSleepDate(start,-7),valid=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const blocks=[priorStart,start].map(from=>{const to=shiftSleepDate(from,6),sessions=data.activities.filter((a:any)=>sportFamily(a)===family&&localDate(new Date(a.date))>=from&&localDate(new Date(a.date))<=to),covered=!!data.historyStart&&data.historyStart.slice(0,10)<=from&&data.historyComplete!==false&&!!data.syncedAt&&localDate(new Date(data.syncedAt))>=to,distances=sessions.map((a:any)=>a.summary?.distance),sleep=Array.from({length:7},(_,i)=>data.sleep?.[shiftSleepDate(from,i).replaceAll('-','')]?.[0]).filter((v:any)=>valid(v)&&v>0);return {from,to,sessions:sessions.length,distance:covered&&distances.every(valid)?distances.reduce((s:number,v:number)=>s+v,0)/1000:null,sleep:sleep.length>=4?sleep.reduce((s:number,v:number)=>s+v,0)/sleep.length/60:null,nights:sleep.length}});
 const [prior,current]=blocks;return {prior,current,volumeChange:current.distance!==null&&prior.distance!==null&&prior.distance>0?(current.distance/prior.distance-1)*100:null,sleepChange:current.sleep!==null&&prior.sleep!==null?current.sleep-prior.sleep:null};
}
