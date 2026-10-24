import {effortProfile} from './effort-profile-data';
import {activityClimbAnalysis,paceFromSpeed} from './activity-terrain-data';
import {classifySession,runningSignals} from './session-intelligence-data';

// Reads the analyses the activity page already runs (session type, efforts,
// climbs, laps, pacing, heart-rate drift) and keeps the few facts worth
// reading first, plus which section view tells this session's story best.
export type SectionMode='efforts'|'climbs'|'laps';
export type Insight={id:string;title:string;detail:string;mode?:SectionMode};
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
type Lap={distance?:unknown;summary?:{distance?:unknown}};
type WorkoutLike={seriesSampled?:{sampleSize?:unknown;data?:Record<string,unknown>};laps?:Lap[];sessionLabel?:string|null;[key:string]:unknown};
const footFamilies=['running','walking','hiking'];

/** The stream efforts are detected from by default: power on the bike, pace on foot, heart rate otherwise. */
export function effortSensor(detail:WorkoutLike,family:string){
 const streams=detail.seriesSampled?.data??{},has=(key:string)=>{const values=streams[key];return Array.isArray(values)&&values.some((v:unknown)=>valid(v)&&(key==='heartrate'?v>0:v>=0))};
 if(family==='cycling')return has('power')?'power':has('heartrate')?'heartrate':'speed';
 if([...footFamilies,'swimming'].includes(family))return has('speed')?'speed':has('power')?'power':'heartrate';
 return has('power')?'power':has('speed')?'speed':'heartrate';
}

/** Laps that differ in length were pressed by hand (or planned), so they carry the session's structure. */
export function lapsVary(laps:Lap[]|undefined){
 const distances=(laps??[]).map(l=>l?.summary?.distance??l?.distance).filter((d:unknown):d is number=>valid(d)&&d>0).slice(0,-1);
 if(distances.length<2)return false;
 const mean=distances.reduce((a,b)=>a+b,0)/distances.length;
 return Math.sqrt(distances.reduce((a,d)=>a+(d-mean)**2,0)/distances.length)/mean>.08;
}

/** Interval and tempo work opens on efforts, hilly routes on climbs, structured laps on laps. */
export function sectionMode({label,efforts,climbs,gain,laps,structuredLaps}:{label:string;efforts:number;climbs:number;gain:number;laps:number;structuredLaps:boolean}):SectionMode|null{
 if(['Intervals','Tempo','Race'].includes(label)&&efforts>0)return 'efforts';
 if(climbs>0&&(gain>=60||climbs>=3))return 'climbs';
 if(laps>=2&&structuredLaps)return 'laps';
 if(efforts>=3)return 'efforts';
 return efforts?'efforts':climbs?'climbs':laps?'laps':null;
}

function outputLabel(sensor:string,family:string,v:number){
 if(sensor==='power')return `${Math.round(v)} W`;
 if(sensor==='heartrate')return `${Math.round(v)} bpm`;
 return footFamilies.includes(family)?`${paceFromSpeed(v,1000)} /km`:family==='swimming'?`${paceFromSpeed(v,100)} /100m`:`${(v*3.6).toFixed(1)} km/h`;
}

// Halves by distance: seconds for each half from the sampled distance stream.
function halves(detail:WorkoutLike){
 const step=detail.seriesSampled?.sampleSize,distance=detail.seriesSampled?.data?.distance;
 if(!valid(step)||step<=0||!Array.isArray(distance))return null;
 const points=distance.map((d:unknown,i:number)=>valid(d)&&d>=0?{d,t:i*step,i}:null).filter(Boolean) as {d:number;t:number;i:number}[];
 if(points.length<10)return null;
 // A gap or counter reset cannot establish two comparable whole-session halves.
 if(points.some((p,i)=>!valid(p.t)||i>0&&(p.i!==points[i-1].i+1||p.d<points[i-1].d)))return null;
 const total=points.at(-1)!.d-points[0].d;if(!valid(total)||total<1000)return null;
 const target=points[0].d+total/2,index=points.findIndex(p=>p.d>=target),a=points[index-1],b=points[index];
 // The exact halfway distance usually falls between two recorded samples.
 const half=a.t+(target-a.d)/(b.d-a.d)*(b.t-a.t),first=half-points[0].t,second=points.at(-1)!.t-half;
 return first>0&&second>0?{first,second,total}:null;
}

export function workoutInsights(detail:WorkoutLike,family:string){
 const insights:Insight[]=[];
 if(!detail?.seriesSampled?.data&&!detail?.laps?.length)return {insights,mode:null as SectionMode|null};
 const classified=classifySession(detail),label=detail.sessionLabel??classified.label;
 const sensor=effortSensor(detail,family),profile=effortProfile(detail,sensor,family),efforts=profile.efforts;
 const terrain=family==='cycling'||footFamilies.includes(family)?activityClimbAnalysis(detail,family):{climbs:[]as {start:number;end:number;gain:number;grade:number}[]};
 const climbs=terrain.climbs,gain=climbs.reduce((n,c)=>n+c.gain,0),laps=detail.laps?.length??profile.laps.length;
 const mode=sectionMode({label,efforts:efforts.length,climbs:climbs.length,gain,laps,structuredLaps:lapsVary(detail.laps)});
 if(!['Unclassified','Other'].includes(label))insights.push({id:'type',title:`${label} session`,detail:detail.sessionLabel?'Your label':classified.confidence==='Low'?'Suggested · low confidence':'Suggested from the workout'});
 const effortInsight=():Insight|null=>{
  if(efforts.length<2)return null;
  const means=efforts.map(e=>e.mean).filter(valid);if(means.length<2)return null;
  // Faster pace, more power or a higher heart rate all read as "more" here.
  const lo=Math.min(...means),hi=Math.max(...means),avg=means.reduce((a,b)=>a+b,0)/means.length,spread=(hi-lo)/avg*100;
  const paced=sensor==='speed'&&(footFamilies.includes(family)||family==='swimming'),metres=family==='swimming'?100:1000;
  const range=paced?`${paceFromSpeed(hi,metres)}–${paceFromSpeed(lo,metres)} /${family==='swimming'?'100m':'km'}`:`${outputLabel(sensor,family,lo).split(' ')[0]}–${outputLabel(sensor,family,hi)}`;
  const fade=means.length>=3?(means.at(-1)!/means[0]-1)*100:0;
  const detail=sensor!=='heartrate'&&fade<=-3?`Last one ${Math.abs(fade).toFixed(0)}% down on the first`:spread<=3?`Even: within ${Math.max(1,Math.round(spread))}%`:`${Math.round(spread)}% between strongest and weakest`;
  return {id:'efforts',title:`${efforts.length} efforts · ${range}`,detail,mode:'efforts'};
 };
 const climbInsight=():Insight|null=>{
  if(!climbs.length)return null;
  const biggest=climbs.reduce((a,c)=>c.gain>a.gain?c:a);
  return {id:'climbs',title:`${climbs.length} climb${climbs.length>1?'s':''} · +${Math.round(gain)} m`,detail:`Biggest +${Math.round(biggest.gain)} m at ${biggest.grade.toFixed(1)}%`,mode:'climbs'};
 };
 const sections=[effortInsight(),climbInsight()].filter((i):i is Insight=>!!i).sort((a,b)=>(a.mode===mode?-1:0)-(b.mode===mode?-1:0));
 insights.push(...sections);
 const split=halves(detail);
 if(split&&family!=='swimming'){
  const change=(split.second/split.first-1)*100,perKm=Math.abs(split.second-split.first)/(split.total/2000);
  const amount=footFamilies.includes(family)?`${Math.round(perKm)} s/km`:`${Math.abs(change).toFixed(0)}%`;
  insights.push(Math.abs(change)<2?{id:'pacing',title:'Even pacing',detail:'Both halves within 2%'}:{id:'pacing',title:change<0?'Negative split':'Positive split',detail:`Second half ${amount} ${change<0?'faster':'slower'}`});
 }
 if(family==='running'){
  const signals=runningSignals(detail);
  if(valid(signals.drift))insights.push({id:'drift',title:`Heart-rate drift ${signals.drift>=0?'+':''}${signals.drift.toFixed(1)}%`,detail:signals.drift<5?'Steady: little cost at the same pace':'Rising cost at the same pace late on'});
 }
 return {insights:insights.slice(0,4),mode};
}
