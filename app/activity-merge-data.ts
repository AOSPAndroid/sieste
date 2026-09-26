import {sportFamily,sportName} from './sports';
const finite=(v:any):v is number=>typeof v==='number'&&Number.isFinite(v);
export type MergeGroup={id:string;ids:string[];timeZone:string};
export function mergeDay(date:string,timeZone:string){return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date))}
export function validateMerge(activities:any[],timeZone:string){
 if(activities.length<2||activities.length>10||new Set(activities.map(a=>a.id)).size!==activities.length)throw Error('Choose 2–10 activities.');
 const sorted=[...activities].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)),first=sorted[0];
 if(sorted.some(a=>a.mergedIds||sportFamily(a)!==sportFamily(first)||mergeDay(a.date,timeZone)!==mergeDay(first.date,timeZone)))throw Error('Choose unmerged activities of the same sport on the same day.');
 if(sorted.some(a=>!finite(a.summary?.duration)||a.summary.duration<=0))throw Error('Each activity needs a recorded duration before merging.');
 for(let i=1;i<sorted.length;i++){const prev=sorted[i-1],end=Date.parse(prev.date)+1000*(prev.summary.durationTotal??prev.summary.duration);if(Date.parse(sorted[i].date)<end)throw Error('These recordings overlap. Merge separate recordings to avoid counting the same effort twice.');}
 return sorted;
}
export function mergedActivity(parts:any[],id:string){
 const sorted=[...parts].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)),summary:any={},s=sorted.map(a=>a.summary??{});
 const sum=(key:string)=>s.every(v=>finite(v[key]))?s.reduce((n,v)=>n+v[key],0):undefined;
 for(const key of ['duration','distance','calories','steps','sets','trainingLoad']){const value=sum(key);if(value!==undefined)summary[key]=value;}
 for(const key of ['heartrate','power','cadence','temperature','stepLength','groundContactTime','verticalOscillation','verticalRatio'])if(s.every(v=>finite(v[key])&&finite(v.duration))&&summary.duration>0)summary[key]=s.reduce((n,v)=>n+v[key]*v.duration,0)/summary.duration;
 for(const key of ['heartrateMax','powerMax','speedMax','cadenceMax'])if(s.every(v=>finite(v[key])))summary[key]=Math.max(...s.map(v=>v[key]));
 summary.altitude={};for(const key of ['ascent','descent'])if(s.every(v=>finite(v.altitude?.[key])))summary.altitude[key]=s.reduce((n,v)=>n+v.altitude[key],0);
 for(const field of ['effort','intensityDistribution','zonesDistribution']){const result:any={};for(const key of Object.keys(s[0]?.[field]??{})){const values=s.map(v=>v[field]?.[key]);if(values.every(finite))result[key]=values.reduce((n,v)=>n+v,0);else if(values.every(v=>Array.isArray(v)&&v.length===values[0].length&&v.every(finite)))result[key]=values[0].map((_:any,i:number)=>values.reduce((n,v)=>n+v[i],0));}if(Object.keys(result).length)summary[field]=result;}
 if(summary.duration>0&&summary.distance>0){summary.speed=summary.distance/summary.duration;summary.pace=1000/summary.speed;}
 const last=sorted.at(-1)!;summary.durationTotal=(Date.parse(last.date)-Date.parse(sorted[0].date))/1000+(last.summary?.durationTotal??last.summary?.duration??0);
 let hrHistogram:any=null;if(sorted.every(a=>a.hrHistogram)){hrHistogram={secondsByBpm:{},validSeconds:0,missingSeconds:0,sampleSeconds:null};for(const a of sorted){for(const [bpm,seconds] of Object.entries(a.hrHistogram.secondsByBpm))hrHistogram.secondsByBpm[bpm]=(hrHistogram.secondsByBpm[bpm]??0)+(seconds as number);hrHistogram.validSeconds+=a.hrHistogram.validSeconds;hrHistogram.missingSeconds+=a.hrHistogram.missingSeconds;}}
 return {id,date:sorted[0].date,sportType:sorted[0].sportType,provider:sorted.every(a=>a.provider===sorted[0].provider)?sorted[0].provider:'merged',title:`${sportName(sportFamily(sorted[0]))} · ${sorted.length} recordings`,summary,hrHistogram,mergedIds:sorted.map(a=>a.id),analyzed:true};
}
export function applyMerges(data:any,groups:MergeGroup[]){
 if(!data?.activities)return data;const activities=[...data.activities],used=new Set<string>(),combined:any[]=[];
 for(const group of groups){const parts=group.ids.map(id=>activities.find(a=>a.id===id));if(parts.some(a=>!a||used.has(a.id)))continue;try{validateMerge(parts,group.timeZone)}catch{continue}combined.push(mergedActivity(parts,group.id));parts.forEach(a=>used.add(a.id));}
 return {...data,activities:[...activities.filter(a=>!used.has(a.id)),...combined].sort((a,b)=>b.date.localeCompare(a.date))};
}
export function mergeDetails(parts:any[],id:string){
 const sorted=[...parts].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)),activity=mergedActivity(sorted,id),keys=[...new Set<string>(sorted.flatMap(a=>Object.keys(a.seriesSampled?.data??{})))];
 const steps=sorted.map(a=>a.seriesSampled?.sampleSize).filter(v=>finite(v)&&v>0),step=Math.max(1,...steps),count=Math.min(100000,Math.ceil(activity.summary.durationTotal/step)+1),data:any={};for(const key of keys)data[key]=Array(count).fill(null);
 let distance=0;const laps:any[]=[];
 for(const part of sorted){const offset=(Date.parse(part.date)-Date.parse(activity.date))/1000,stream=part.seriesSampled?.data??{},sourceStep=part.seriesSampled?.sampleSize,span=part.summary?.durationTotal??part.summary?.duration??0;
  if(finite(sourceStep)&&sourceStep>0)for(let i=Math.ceil(offset/step);i<count&&i*step<offset+span;i++){const src=Math.floor((i*step-offset)/sourceStep);for(const key of keys){const value=stream[key]?.[src];data[key][i]=finite(value)?value+(key==='distance'?distance:0):null;}}
  // Always preserve a visual break at the boundary, even for back-to-back recordings.
  if(part!==sorted[0])for(const key of keys){const boundary=Math.ceil(offset/step);if(boundary<count)data[key][boundary]=null;}
  const lapTotal=(part.laps??[]).reduce((n:number,l:any)=>n+(l.summary?.durationTotal??l.durationTotal??l.summary?.duration??l.duration??0),0),aligned=Math.abs(lapTotal-span)<=Math.max(10,step*2);let local=0;for(const lap of part.laps??[]){const duration=lap.summary?.durationTotal??lap.durationTotal??lap.summary?.duration??lap.duration??0;laps.push({...lap,lap:laps.length+1,mergedStartSeconds:aligned?offset+local:null,sourceActivityId:part.id});local+=duration;}
  distance+=part.summary?.distance??0;
 }
 return {...activity,laps,seriesSampled:{sampleSize:step,data},mergeNote:'Combined in sieste. Riding/training time excludes the break; the profile uses elapsed time and keeps gaps. HR, power and cadence averages are duration-weighted.',recordedSource:'Merged recordings'};
}
