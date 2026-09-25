import {comparisonPeriods,volume,difference} from './training-comparison';
import {weekOverview} from './week-overview';
import {sportFamily} from './sports';
import type {AthleteData} from './analytics';
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export function trainingSnapshot(data:AthleteData,now:Date,zoneSport:string){
 const period=comparisonPeriods(now)[0],week=weekOverview(data,now,sportFamily);
 // Distance is run + ride only; strength does not require distance.
 const distanceData={...data,activities:data.activities.filter(a=>['running','cycling'].includes(sportFamily(a)))};
 const pair=(metric:string)=>{const source=metric==='distance'?distanceData:data,c=volume(source,period.current,now,sportFamily,'all',metric),p=volume(source,period.previous,now,sportFamily,'all',metric);return {value:c.value,partial:!c.complete,change:difference(c,p)?.absolute??null,previous:p.value}};
 const loadComplete=week.historyComplete&&data.historyComplete!==false&&week.current.effortDays===7&&week.previous.effortDays===7;
 const metrics=[{key:'distance',label:'Run + ride',unit:'km',...pair('distance')},{key:'duration',label:'Training time',unit:'h',...pair('duration')},{key:'sessions',label:'Sessions',unit:'',...pair('sessions')},{key:'load',label:'Load',unit:data.provider==='coros'?'COROS load':'effort',value:week.current.effort,previous:week.previous.effort,partial:week.current.effortDays<7||!week.historyComplete||data.historyComplete===false,change:loadComplete&&week.current.effort!==null&&week.previous.effort!==null?week.current.effort-week.previous.effort:null}];
 const acts=data.activities.filter(a=>{const d=new Date(a.date);return d>=period.current.start&&d<period.current.end&&d<=now&&sportFamily(a)===zoneSport});
 const recorded=acts.map(a=>a.summary?.zonesDistribution?.heartrate).filter((z):z is number[]=>Array.isArray(z)&&z.length>0&&z.every(valid)&&z.some(s=>s>0));
 const count=Math.max(0,...recorded.map(z=>z.length)),zones=Array.from({length:count},(_,i)=>recorded.reduce((sum,z)=>sum+(z[i]??0),0)),total=zones.reduce((a,b)=>a+b,0);
 return {metrics,zones,total,covered:recorded.length,sessions:acts.length,period,calories:week.current.calories,calorieCoverage:week.current.calorieCoverage,sessionCount:week.current.sessions};
}
