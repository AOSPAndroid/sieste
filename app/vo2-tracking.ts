import {sportFamily} from './sports';

// Tredict estimates VO₂ from each run; COROS reports one current fitness value.
// Single-run estimates move with heat, terrain and fatigue, so tracking uses a
// rolling median of recent runs rather than run-to-run changes.
export const TREDICT_VO2_LABEL='Run VO₂ · Tredict';
export const COROS_VO2_LABEL='VO₂ max · COROS';
export const VO2_WINDOW_DAYS=28;
export const VO2_MIN_RUNS=3;
const DAY=86400000;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);

export type Vo2Point={id:string;date:string;t:number;value:number;title?:string};
type Activity={id:string;date:string;title?:string;summary?:{vo2max?:unknown}};

export function median(values:number[]){
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),mid=sorted.length>>1;
 return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}

// Running estimates in date order. Implausible values (outside 20–95) are dropped.
export function vo2Points(activities:Activity[]):Vo2Point[]{
 return activities
  .filter(a=>sportFamily(a as never)==='running'&&finite(a.summary?.vo2max)&&(a.summary!.vo2max as number)>=20&&(a.summary!.vo2max as number)<=95&&Number.isFinite(Date.parse(a.date)))
  .map(a=>({id:a.id,date:a.date,t:Date.parse(a.date),value:a.summary!.vo2max as number,title:a.title}))
  .sort((a,b)=>a.t-b.t);
}

// Median of the runs in the window ending at `end` (inclusive); null below the minimum run count.
export function windowMedian(points:Vo2Point[],end:number,days=VO2_WINDOW_DAYS){
 const values=points.filter(p=>p.t<=end&&p.t>end-days*DAY).map(p=>p.value);
 return {median:values.length>=VO2_MIN_RUNS?median(values):null,count:values.length};
}

// Each run with the rolling median that includes it.
export function vo2Trendline(points:Vo2Point[]){
 return points.map(p=>({...p,trend:windowMedian(points,p.t).median}));
}

export function vo2Summary(points:Vo2Point[],now:number){
 const current=windowMedian(points,now),previous=windowMedian(points,now-VO2_WINDOW_DAYS*DAY);
 const year=points.filter(p=>p.t<=now&&p.t>now-365*DAY);
 const best=year.reduce<Vo2Point|null>((b,p)=>!b||p.value>b.value?p:b,null);
 const latest=points.filter(p=>p.t<=now).at(-1)??null;
 const change=current.median!==null&&previous.median!==null?current.median-previous.median:null;
 return {latest,current,previous,change,best,runs:year.length};
}

// How a single run compares with the runs before it: the median of the prior
// 28 days when there are enough runs, otherwise the previous estimate.
export function vo2Baseline(points:Vo2Point[],activityId:string,date:number){
 const prior=points.filter(p=>p.id!==activityId&&p.t<date&&p.t>=date-VO2_WINDOW_DAYS*DAY);
 if(prior.length>=VO2_MIN_RUNS)return {value:median(prior.map(p=>p.value))!,kind:'median' as const,count:prior.length};
 const last=points.filter(p=>p.id!==activityId&&p.t<date&&p.t>=date-35*DAY).at(-1);
 return last?{value:last.value,kind:'previous' as const,count:1,date:last.date}:null;
}

// COROS fitness history is keyed by YYYYMMDD.
export function corosVo2History(history:Record<string,{vo2max?:unknown}|undefined>|undefined){
 return Object.entries(history??{})
  .filter(([key,v])=>/^\d{8}$/.test(key)&&finite(v?.vo2max))
  .map(([key,v])=>({t:Date.UTC(+key.slice(0,4),+key.slice(4,6)-1,+key.slice(6,8),12),value:v!.vo2max as number}))
  .sort((a,b)=>a.t-b.t);
}
