import {effortExcluded} from './workout-exclusions';
import {localDate} from './week-overview';
import type {AthleteData} from './analytics';
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export function fatigueRecovery(data:AthleteData,now:Date,days=28){
 const source=data.extra?.efforts?.trainingEfforts;
 const rows=Array.from({length:days+27},(_,i)=>{
  const date=new Date(now);date.setDate(date.getDate()-days-26+i);date.setHours(0,0,0,0);
  const iso=localDate(date),key=iso.replaceAll('-',''),covered=!!data.historyStart&&data.historyStart.slice(0,10)<=iso&&data.historyComplete!==false&&(!data.syncedAt||iso<=localDate(new Date(data.syncedAt)));
  const sessions=data.activities.filter(a=>localDate(new Date(a.date))===iso&&new Date(a.date)<=now);
  const raw=source?.[key],values=Array.isArray(raw)?raw.map((v:any)=>Array.isArray(v)?v[0]:v):[];
  const effort=effortExcluded(data,iso)?null:values.length&&values.every(valid)?values.reduce((a:number,b:number)=>a+b,0):source&&covered&&raw===undefined&&sessions.length===0?0:null;
  const body=(data.extra?.bodyvalues?.bodyvalues??[]).filter((r:any)=>new Date(r.timestamp)<=now&&localDate(new Date(r.timestamp))===iso&&valid(r.hrRestDynamic)).sort((a:any,b:any)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
  return {iso,label:date.toLocaleDateString('en-GB',{day:'numeric',month:'short'}),effort:effort as number|null,sleep:valid(data.sleep[key]?.[0])?data.sleep[key][0]/3600:null,hrv:valid(data.hrv[key]?.[0])?data.hrv[key][0]:null,rhr:(body[0]?.hrRestDynamic??null) as number|null};
 });
 return rows.map((r,i)=>{const average=(n:number)=>{const window=rows.slice(Math.max(0,i-n+1),i+1);return window.length===n&&window.every(d=>d.effort!==null)?window.reduce((s,d)=>s+d.effort!,0)/n:null};return {...r,load7:average(7),load28:average(28)}}).slice(-days);
}

// Baseline indices compare trends, not quantities of recovery versus effort.
export function loadRecoveryTrends(data:AthleteData,now:Date,days=28){
 const end=new Date(now);
 const history=fatigueRecovery(data,end,days+34);
 return history.slice(34).map((r,j)=>{
  const i=j+34,recent=history.slice(i-6,i+1),baseline=history.slice(i-34,i-6);
  const mean=(values:(number|null)[],required:number)=>{const present=values.filter((v):v is number=>v!==null&&Number.isFinite(v));return present.length>=required?present.reduce((a,b)=>a+b,0)/present.length:null};
  const load=mean(recent.map(v=>v.effort),7),loadBase=mean(baseline.map(v=>v.effort),28);
  const hrv=mean(recent.map(v=>v.hrv&&v.hrv>0?v.hrv:null),4),hrvBase=mean(baseline.map(v=>v.hrv&&v.hrv>0?v.hrv:null),14);
  const fresh=recent.slice(-2).some(v=>v.hrv!==null&&v.hrv>0);
  const coros=data.provider==='coros'?data.extra?.coros?.load?.find((v:any)=>v.date===r.iso):null;
  return {...r,loadIndex:data.provider==='coros'?(Number.isFinite(coros?.ratio)?coros.ratio*100:null):load!==null&&loadBase!==null&&loadBase>0?load/loadBase*100:null,recoveryIndex:fresh&&hrv!==null&&hrvBase!==null&&hrvBase>0?hrv/hrvBase*100:null,hrvMean:hrv,loadMean:data.provider==='coros'?coros?.short??null:load};
 });
}
