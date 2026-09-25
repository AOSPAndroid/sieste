import type {AthleteData,Workout} from './analytics';
import {sportFamily} from './sports';
const num=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const avg=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
const unique=(a:Workout[])=>[...new Map(a.map(v=>[v.id,v])).values()];
export const sensorSpecs=[
 ['leftRightBalance','Left power balance','%'],['leftTorqueEffectiveness','Left torque effectiveness','%'],['rightTorqueEffectiveness','Right torque effectiveness','%'],['leftPedalSmoothness','Left pedal smoothness','%'],['rightPedalSmoothness','Right pedal smoothness','%'],['formPower','Form power','W'],['airPower','Air power','W'],['temperature','Temperature','°C']
] as const;
export const factorSpecs=[['runningEffectiveness','Running effectiveness'],['speedAerobicFactor','Speed aerobic factor'],['powerAerobicFactor','Power aerobic factor'],['formPowerFactor','Form power factor'],['speedIndex','Speed index']] as const;
export function sensorEvidence(detail:any){
 const step=detail.seriesSampled?.sampleSize,s=detail.seriesSampled?.data??{},duration=detail.summary?.durationTotal;
 const equipment=Array.isArray(detail.equipment)?detail.equipment.filter((e:any)=>typeof e.id==='string').map((e:any)=>({id:e.id,name:e.name,type:e.type})):[];
 const sensors:Record<string,{value:number;coverage:number;seconds:number}>={},powerBands:Record<string,Record<string,{value:number;seconds:number}>>={};
 if(!num(step)||step<=0||step>30)return {version:1,equipment,sensors,powerBands};
 for(const [key] of sensorSpecs){if(!Array.isArray(s[key]))continue;const values=s[key] as unknown[],cap=num(duration)?Math.max(0,duration):values.length*step;let sum=0,seconds=0;const bands:Record<string,{sum:number;seconds:number}>={};
  values.forEach((v,i)=>{const dt=Math.max(0,Math.min(step,cap-i*step));const percent=/Balance|Effectiveness|Smoothness/.test(key);if(!dt||!num(v)||(key==='temperature'?(v< -60||v>70):(v<0||(percent&&v>100))))return;
   sum+=v*dt;seconds+=dt;const p=s.power?.[i];if(num(p)&&p>=50&&p<1000){const band=String(Math.floor(p/25)*25);bands[band]??={sum:0,seconds:0};bands[band].sum+=v*dt;bands[band].seconds+=dt}
  });if(seconds&&cap>0)sensors[key]={value:sum/seconds,coverage:Math.min(1,seconds/cap),seconds};
  for(const [band,b] of Object.entries(bands))if(b.seconds>=120){powerBands[band]??={};powerBands[band][key]={value:b.sum/b.seconds,seconds:b.seconds}}
 }
 return {version:1,equipment,sensors,powerBands};
}
export function planLinks(data:AthleteData,now:Date){
 const source=data.extra?.plannedTrainingList?._embedded?.plannedWorkoutList,available=Array.isArray(source)&&data.sources?.plannedTrainingList?.status!=='unavailable';
 const acts=new Map(unique(data.activities).filter(a=>new Date(a.date)<=now).map(a=>[a.id,a])),start=new Date(now);start.setDate(start.getDate()-28);
 const plans=available?[...new Map<string,any>(source.filter((p:any)=>p.id&&Number.isFinite(Date.parse(p.date))&&new Date(p.date)>=start&&new Date(p.date)<=now).map((p:any)=>[p.id,p])).values()]:[];
 return {available,rows:plans.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).map(p=>{const done=acts.get(p.executedTrainingId)??[...acts.values()].find(a=>a.fallbackId===p.executedTrainingId),removed=data.excludedWorkouts?.some(a=>a.id===p.executedTrainingId);return {plan:p,done,status:done?'Linked':removed?'Removed from sieste':p.executedTrainingId?'Linked activity not synced':'No completion link',planned:num(p.duration)?p.duration:null,actual:num(done?.summary?.duration)?done!.summary!.duration:null}})};
}
export function equipmentHistory(data:AthleteData,now:Date){
 const acts=unique(data.activities).filter(a=>new Date(a.date)<=now).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)),source=data.extra?.equipmentList?.equipment,items=new Map<string,any>();
 if(Array.isArray(source))for(const e of source)if(e.id)items.set(e.id,e);
 for(const a of acts)for(const e of a.evidence?.sensors?.equipment??[])if(!items.has(e.id))items.set(e.id,e);
 return [...items.values()].map(e=>{const ids=new Set(Array.isArray(e.trainingIds)?e.trainingIds:[]),sessions=acts.filter(a=>ids.has(a.id)||(a.fallbackId&&ids.has(a.fallbackId))||a.evidence?.sensors?.equipment.some((x:{id:string})=>x.id===e.id)),known=sessions.filter(a=>num(a.summary?.distance)&&a.summary!.distance>=0);
 return {equipment:e,sessions,km:known.length?known.reduce((n,a)=>n+a.summary!.distance,0)/1000:null,missing:sessions.length-known.length,minutes:sessions.length&&sessions.every(a=>num(a.summary?.duration))?sessions.reduce((n,a)=>n+a.summary!.duration,0)/60:null};});
}
export function comparableSessions(current:Workout,history:Workout[]){
 const s=current.summary??{},family=sportFamily(current),speed=(a:Workout)=>a.summary?.distance>0&&a.summary?.duration>0?a.summary!.distance/a.summary!.duration:null,v=speed(current);
 const climb=(a:Workout)=>num(a.summary?.altitude?.ascent)&&a.summary?.distance>0?a.summary.altitude.ascent/a.summary.distance*1000:null;
 return unique(history).filter(a=>{const p=a.summary??{},w=speed(a);return a.id!==current.id&&sportFamily(a)===family&&(a.subSportType??'')===(current.subSportType??'')&&Date.parse(a.date)<Date.parse(current.date)&&Date.parse(a.date)>=Date.parse(current.date)-84*86400000&&num(s.duration)&&s.duration>=1200&&num(p.duration)&&p.duration>=1200&&Math.abs(s.duration/p.duration-1)<=.2&&(family==='cycling'?num(s.power)&&s.power>0&&num(p.power)&&p.power>0&&Math.abs(s.power/p.power-1)<=.1:v!==null&&w!==null&&Math.abs(v/w-1)<=.05)&&climb(current)!==null&&climb(a)!==null&&Math.abs(climb(current)!-climb(a)!)<=5;}).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5);
}
export function factorComparison(current:Workout,history:Workout[]){const peers=comparableSessions(current,history);return factorSpecs.map(([key,label])=>{const v=current.summary?.[key],used=peers.filter(a=>num(a.summary?.[key])),baseline=used.length>=3?avg(used.map(a=>a.summary![key])):null;return {key,label,value:num(v)?v:null,baseline,used,change:num(v)&&baseline!==null&&baseline!==0?(v/baseline-1)*100:null}})}
export function pedalComparison(current:Workout,history:Workout[],band:string){
 const peers=comparableSessions(current,history),own=current.evidence?.sensors?.powerBands?.[band]??{};
 return sensorSpecs.slice(0,5).map(([key,label,unit])=>{const v=own[key],used=peers.filter(a=>a.evidence?.sensors?.powerBands?.[band]?.[key]),baseline=used.length>=3?avg(used.map(a=>a.evidence!.sensors!.powerBands[band][key].value)):null;return {key,label,unit,value:v?.value??null,seconds:v?.seconds??0,baseline,used}});
}
export function conditionsComparison(current:Workout,history:Workout[]){const peers=comparableSessions(current,history);return ['temperature','airPower','formPower'].map(key=>{const reading=(a:Workout)=>{const s=a.evidence?.sensors?.sensors[key];return s&&s.coverage>=.8?s.value:key==='temperature'&&num(a.summary?.temperature)?a.summary.temperature:null},value=reading(current),used=peers.filter(a=>reading(a)!==null),baseline=used.length>=3?avg(used.map(a=>reading(a)!)):null;return {key,value,baseline,used}})}
