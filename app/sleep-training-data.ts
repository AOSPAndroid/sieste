import {sleepToolsData} from './sleep-tools-data';
import {fatigueRecovery} from './fatigue-recovery-data';
import {shiftSleepDate,lateBedtime} from './sleep-insights-data';
import {metricStatus} from './metric-status';
import {localDate} from './week-overview';
export function sleepTraining(data:any,end:string,days:number){
 const history=sleepToolsData(data,end,Math.max(days,28),8).rows,loads=fatigueRecovery(data,new Date(end+'T23:59:59'),Math.max(days,28)+1);
 const rows=history.map(r=>{const prior=shiftSleepDate(r.date,-1),sessions=data.activities.filter((a:any)=>localDate(new Date(a.date))===prior),durations=sessions.map((a:any)=>a.summary?.duration),duration=sessions.length&&durations.every((v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0)?durations.reduce((s:number,v:number)=>s+v,0):null;return {...r,prior,sessions,duration,load:loads.find(l=>l.iso===prior)?.effort??null,hrvStatus:r.hrv===null?null:metricStatus('hrv',data,new Date(r.date+'T23:59:59'),()=>''),rhrStatus:r.rhr===null?null:metricStatus('rhr',data,new Date(r.date+'T23:59:59'),()=>''),sleepStatus:r.hours===null?null:metricStatus('sleep',data,new Date(r.date+'T23:59:59'),()=>''),late:r.bed===null?null:lateBedtime(r.bed)};});
 const associations=[{label:'After short nights',predicate:(r:typeof rows[number])=>r.hours===null?null:r.hours<7,groups:['<7h','≥7h']},{label:'After late bedtimes',predicate:(r:typeof rows[number])=>r.late,groups:['After 00:00','Before / at 00:00']}].map(test=>({...test,values:[true,false].map(flag=>{const selected=rows.filter(r=>test.predicate(r)===flag&&r.hrv!==null);return {count:selected.length,mean:selected.length>=3?selected.reduce((s,r)=>s+r.hrv!,0)/selected.length:null}})}));
 const visible=rows.slice(-days),paired=visible.filter(r=>r.load!==null&&r.load>0&&r.hrvStatus?.range&&r.hrv!==null),inRange=paired.filter(r=>r.hrv!>=r.hrvStatus!.range![0]&&r.hrv!<=r.hrvStatus!.range![1]).length;
 return {rows:visible,associations,paired:paired.length,inRange};
}
