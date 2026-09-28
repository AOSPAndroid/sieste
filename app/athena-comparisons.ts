import type {AthleteData,Workout} from './analytics';
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function wantsComparison(message:string,explicit=false){return explicit||/\b(compar\w*|efficien\w*|efficac\w*|cadenc\w*|econom\w*|économ\w*|versus|vs|progress\w*)\b/i.test(message)}
export function activityMetrics(a:Workout){const s=a.summary??{},speed=positive(s.distance)&&positive(s.duration)?s.distance/s.duration:null;
 const recorded=Object.fromEntries(['duration','distance','heartrate','power','cadence','pace','stepLength','groundContactTime','runningEffectiveness','speedAerobicFactor','powerAerobicFactor','formPower','temperature'].filter(k=>typeof s[k]==='number'&&Number.isFinite(s[k])).map(k=>[k,Math.round(s[k]*1000)/1000]));
 return {date:a.date,sport:a.sportType,provider:a.provider,recorded,derived:{...(speed!==null?{averageSpeedMps:Math.round(speed*1000)/1000}:{}),...(speed!==null&&positive(s.heartrate)?{speedPerHeartbeat:Math.round(speed/s.heartrate*100000)/100000}:{}),...(positive(s.power)&&positive(s.heartrate)?{wattsPerBpm:Math.round(s.power/s.heartrate*1000)/1000}:{})}};
}
export function activityComparisons(data:AthleteData,selected:Workout){const t=Date.parse(selected.date),duration=selected.summary?.duration;
 const eligible=data.activities.filter(a=>a.id!==selected.id&&a.sportType===selected.sportType&&(a.subSportType??'')===(selected.subSportType??'')&&(a.provider??data.provider)===(selected.provider??data.provider)&&Date.parse(a.date)<t&&Date.parse(a.date)>=t-90*86400000&&positive(duration)&&positive(a.summary?.duration)&&Math.abs(a.summary!.duration/duration-1)<=.35);
 const ranked=eligible.sort((a,b)=>Math.abs(a.summary!.duration/duration-1)-Math.abs(b.summary!.duration/duration-1)||b.date.localeCompare(a.date)).slice(0,5);
 return {selected:activityMetrics(selected),sessions:ranked.map(activityMetrics),eligibleCount:eligible.length,matching:'Up to 5 prior sessions in 90 days, same sport, discipline and provider, duration within 35%. Closest duration first.',limitations:'Summary comparisons only. Terrain, weather, stops and effort may differ; not controlled comparisons. Speed/HR and watts/HR are proxies, not physiological efficiency. Higher cadence is not automatically better. Missing metrics are unavailable. No telemetry or provider fetch.'};
}
