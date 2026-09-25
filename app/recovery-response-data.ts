import {localDate} from './week-overview';
import {sleepTraining} from './sleep-training-data';
import {shiftSleepDate} from './sleep-insights-data';
export function recoveryResponse(data:any,end:string){
 const rows=sleepTraining(data,end,60).rows,known=(v:any)=>typeof v==='number'&&Number.isFinite(v),mean=(v:number[])=>v.length?v.reduce((s,v)=>s+v,0)/v.length:null;
 const hard=rows.flatMap((r,i)=>{const prior=rows.slice(Math.max(0,i-28),i).map(v=>v.load).filter((v):v is number=>v!==null&&v>0).sort((a,b)=>a-b);if(r.load===null||prior.length<7||r.load<=prior[Math.floor(prior.length*.75)])return [];
 const mornings=[0,1,2].map(n=>{const d=rows.find(v=>v.date===shiftSleepDate(r.date,n)),h=d?.hrvStatus?.range,hr=d?.rhrStatus?.range;return {date:shiftSleepDate(r.date,n),hrv:d?.hrv??null,rhr:d?.rhr??null,sleep:d?.hours??null,normal:!d||d.hrv===null||d.rhr===null||!h||!hr?null:d.hrv>=h[0]&&d.hrv<=h[1]&&d.rhr>=hr[0]&&d.rhr<=hr[1],trainingBefore:!!d?.sessions.length}});
 const first=mornings.findIndex(m=>m.normal===true),observed=first>=0&&mornings.slice(0,first).every(m=>m.normal!==null)?first+1:null;return [{date:r.prior,load:r.load,mornings,observed}];}).filter(r=>r.date>=shiftSleepDate(end,-28));
 const groups=[true,false].map(late=>{const matches=rows.filter(r=>{if(!r.sessions.length||r.bed===null)return false;const ends=r.sessions.map((a:any)=>{const duration=a.summary?.duration;if(!known(duration)||duration<0)return null;return new Date(new Date(a.date).getTime()+duration*1000)});if(ends.some((v:Date|null)=>!v||!Number.isFinite(v.getTime())))return false;const latest=Math.max(...ends.map((v:Date|null)=>v!.getTime())),finish=new Date(latest),finishLate=finish.getHours()>=20||localDate(finish)>r.prior;return finishLate===late;});
 const stat=(key:'hours'|'hrv'|'bed')=>{const v=matches.map(r=>key==='bed'?(r.bed===null?null:((r.bed%1440)<720?r.bed%1440+1440:r.bed%1440)):r[key]).filter((v):v is number=>v!==null);return {count:v.length,value:v.length>=3?mean(v):null}};
 return {late,count:matches.length,hours:stat('hours'),hrv:stat('hrv'),bed:stat('bed')};});
 return {hard,groups};
}
