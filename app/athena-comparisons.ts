import type {AthleteData,Workout} from './analytics';
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function wantsMechanics(message:string){return /\b(mechanic\w*|biomechan\w*|cadenc\w*|stride|ground.contact|vertical.oscillation|technique|form)\b|mécanique|foulée/i.test(message)}
export function wantsComparison(message:string,explicit=false){return explicit||wantsMechanics(message)||/\b(compar\w*|efficien\w*|efficac\w*|cadenc\w*|econom\w*|économ\w*|versus|vs|progress\w*)\b/i.test(message)}
export function resolveAthenaActivity(data:AthleteData,message:string,selectedId?:string){
 const open=data.activities.find(a=>a.id===selectedId),requested=/\b(run|running|jog|stride)\b|course à pied|foulée/i.test(message)?'running':/\b(cycling|ride|bike|pedal\w*)\b|vélo|pédal/i.test(message)?'cycling':null;
 const latest=requested?[...data.activities].filter(a=>a.sportType===requested&&Date.parse(a.date)<=Date.now()).sort((a,b)=>b.date.localeCompare(a.date))[0]:undefined;
 const explicitlyLatest=/\b(latest|last|recent)\b|derni[eè]r/i.test(message);
 const conflict=!!open&&!!requested&&open.sportType!==requested&&!explicitlyLatest;
 const target=conflict?undefined:requested&&(!open||explicitlyLatest)?latest:open;
 const metadata=(a:Workout|undefined)=>a?{sport:a.sportType,date:a.date}:null;
 return {target,selection:{needsClarification:conflict||!!selectedId&&!open||!!requested&&!target,reason:conflict?'Question sport differs from the open activity. Ask which session; do not silently choose.':target?'Use this activity, not an activity from older chat messages.':'No matching activity selected.',open:metadata(open),requestedSport:requested,latestMatching:metadata(latest),target:metadata(target)}};
}
export function activityMetrics(a:Workout){const s=a.summary??{},speed=positive(s.distance)&&positive(s.duration)?s.distance/s.duration:null;
 const recorded=Object.fromEntries(['duration','distance','heartrate','power','cadence','pace','stepLength','groundContactTime','verticalOscillation','flightTime','runningEffectiveness','speedAerobicFactor','powerAerobicFactor','formPower','temperature'].filter(k=>typeof s[k]==='number'&&Number.isFinite(s[k])).map(k=>[k,Math.round(s[k]*1000)/1000]));
 return {date:a.date,sport:a.sportType,provider:a.provider,recorded,derived:{...(speed!==null?{averageSpeedMps:Math.round(speed*1000)/1000}:{}),...(speed!==null&&positive(s.heartrate)?{speedPerHeartbeat:Math.round(speed/s.heartrate*100000)/100000}:{}),...(positive(s.power)&&positive(s.heartrate)?{wattsPerBpm:Math.round(s.power/s.heartrate*1000)/1000}:{})}};
}
export function savedMechanicsEvidence(a:Workout){
 const e=a.evidence?.insights;if(!e)return null;
 return {matchedMinutes:typeof e.pairs==='number'?e.pairs:null,metrics:(e.mechanics??[]).slice(0,4).map(m=>({metric:m.key,early:m.early,late:m.late,changePercent:m.change})),method:'Previously saved early/late minute pairs matched within 3% speed and 0.5 percentage-point gradient, excluding warmup. Not a new telemetry analysis.'};
}
export function activityComparisons(data:AthleteData,selected:Workout){const t=Date.parse(selected.date),duration=selected.summary?.duration;
 const eligible=data.activities.filter(a=>a.id!==selected.id&&a.sportType===selected.sportType&&(a.subSportType??'')===(selected.subSportType??'')&&(a.provider??data.provider)===(selected.provider??data.provider)&&Date.parse(a.date)<t&&Date.parse(a.date)>=t-90*86400000&&positive(duration)&&positive(a.summary?.duration)&&Math.abs(a.summary!.duration/duration-1)<=.35);
 const ranked=eligible.sort((a,b)=>Math.abs(a.summary!.duration/duration-1)-Math.abs(b.summary!.duration/duration-1)||b.date.localeCompare(a.date)).slice(0,5);
 return {selected:activityMetrics(selected),sessions:ranked.map(activityMetrics),eligibleCount:eligible.length,matching:'Up to 5 prior sessions in 90 days, same sport, discipline and provider, duration within 35%. Closest duration first.',limitations:'Summary comparisons only. Terrain, weather, stops and effort may differ; not controlled comparisons. Speed/HR and watts/HR are proxies, not physiological efficiency. Higher cadence is not automatically better. Missing metrics are unavailable. No telemetry or provider fetch.'};
}
