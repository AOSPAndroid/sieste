import {sportFamily} from './sports';
import type {Workout} from './analytics';
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const average=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
export const sessionLabels=['Easy','Recovery','Long','Intervals','Tempo','Race','Strength','Other'] as const;
export function classifySession(detail:any){
 const family=sportFamily(detail),s=detail.summary??{},title=(detail.title??'').toLowerCase();
 if(family==='strength_training')return {label:'Strength',confidence:'High',reason:'Recorded strength sport.'};
 if(!['running','cycling'].includes(family))return {label:'Other',confidence:'Low',reason:'No endurance classification for this sport.'};
 for(const [pattern,label] of [[/\b(recovery|récupération)\b/,'Recovery'],[/\b(intervals?|track|fractionné)\b/,'Intervals'],[/\b(tempo|threshold|seuil)\b/,'Tempo'],[/\b(race|competition)\b/,'Race']] as const)if(pattern.test(title))return {label,confidence:'Medium',reason:'Suggested from the recorded title; confirm the session purpose.'};
 const laps=(detail.laps??[]).map((l:any)=>({...l,...l.summary})).filter((l:any)=>valid(l.duration)&&l.duration>=20&&l.duration<=1200&&valid(l.distance)&&l.distance>0);
 if(laps.length>=6){let alternations=0;for(let i=1;i<laps.length-1;i++){const a=laps[i-1].distance/laps[i-1].duration,b=laps[i].distance/laps[i].duration,c=laps[i+1].distance/laps[i+1].duration;if(b>Math.max(a,c)*1.2)alternations++}if(alternations>=3)return {label:'Intervals',confidence:'Medium',reason:'At least 3 faster laps separated by slower laps (speed difference >20%). Terrain and auto-laps can mimic intervals.'}}
 const z=s.zonesDistribution?.heartrate,duration=s.duration;
 const complete=Array.isArray(z)&&z.length>=3&&z.every((v:unknown)=>valid(v)&&v>=0),total=complete?z.reduce((a:number,b:number)=>a+b,0):0;
 const low=complete&&total>0?(z[0]+z[1])/total:null,coverage=valid(duration)&&duration>0?total/duration:0;
 if(valid(duration)&&duration>=(family==='running'?5400:10800))return {label:'Long',confidence:'Low',reason:'Duration ≥90 min running / ≥3 h cycling. This fixed rule may differ from your normal long session.'};
 if(low!==null&&low>=.85&&coverage>=.8&&coverage<=1.1)return {label:duration<=2400?'Recovery':'Easy',confidence:'Low',reason:`${Math.round(low*100)}% of classified HR time in your first two Tredict zones; ${Math.round(coverage*100)}% duration covered. Zone definitions and intended purpose may differ.`};
 return {label:'Unclassified',confidence:'Low',reason:'Insufficient evidence of session purpose. Choose a label if useful.'};
}
type Block={minute:number;speed:number;grade:number;heartrate:number|null;cadence:number|null;stepLength:number|null;groundContactTime:number|null;verticalOscillation:number|null};
// Whole, non-overlapping minutes only. Reject stops, hills, gaps and changing pace.
export function runningSignals(detail:any){
 const step=detail.seriesSampled?.sampleSize,series=detail.seriesSampled?.data??{},speed=series.speed;
 const unavailable=(reason:string)=>({reason,pairs:0,drift:null,earlyHR:null,lateHR:null,pace:null,mechanics:[] as {key:string;early:number;late:number;change:number}[],blocks:[] as Block[]});
 if(sportFamily(detail)!=='running')return unavailable('Running only.');
 if(!valid(step)||step<=0||step>15||!Array.isArray(speed))return unavailable('Need sampled running pace and heart rate.');
 if(!Array.isArray(series.grade))return unavailable('Gradient samples are needed to exclude hills.');
 const end=Math.min(speed.length*step,valid(detail.summary?.durationTotal)?detail.summary.durationTotal:Infinity),blocks:Block[]=[];
 for(let t=600;t+60<=end-120;t+=60){
  const start=Math.ceil(t/step),stop=Math.ceil((t+60)/step),count=stop-start;
  const read=(key:string,min:number,max:number)=>{const values=(series[key]??[]).slice(start,stop);return values.length===count&&values.filter((v:unknown)=>valid(v)&&v>=min&&v<=max).length>=count*.9?average(values.filter((v:unknown)=>valid(v)&&v>=min&&v<=max)):null};
  const v=speed.slice(start,stop);if(v.length!==count||v.some((x:unknown)=>!valid(x)||x<1.5||x>9))continue;
  const m=average(v),cv=Math.sqrt(average(v.map((x:number)=>(x-m)**2)))/m,g=read('grade',-2,2);
  if(cv>.05||g===null)continue;
  blocks.push({minute:t/60,speed:m,grade:g,heartrate:read('heartrate',60,220),cadence:read('cadence',60,250),stepLength:read('stepLength',30,250),groundContactTime:read('groundContactTime',80,500),verticalOscillation:read('verticalOscillation',1,25)});
 }
 const midpoint=(600+end-120)/2/60,early=blocks.filter(b=>b.minute<midpoint),late=blocks.filter(b=>b.minute>=midpoint),used=new Set<number>(),pairs:{early:Block;late:Block}[]=[];
 for(const b of late){const a=early.filter(a=>!used.has(a.minute)&&Math.abs(a.speed/b.speed-1)<=.03&&Math.abs(a.grade-b.grade)<=.5).sort((a,c)=>Math.abs(a.speed-b.speed)-Math.abs(c.speed-b.speed))[0];if(a){used.add(a.minute);pairs.push({early:a,late:b})}}
 if(pairs.length<5)return {...unavailable('Need ≥5 matched minutes in each half after warm-up; steady pace and near-flat terrain.'),blocks};
 const hr=pairs.filter(p=>p.early.heartrate!==null&&p.late.heartrate!==null),earlyHR=hr.length>=5?average(hr.map(p=>p.early.heartrate!)):null,lateHR=hr.length>=5?average(hr.map(p=>p.late.heartrate!)):null;
 const drift=hr.length>=5?(average(hr.map(p=>p.late.heartrate!/p.late.speed))/average(hr.map(p=>p.early.heartrate!/p.early.speed))-1)*100:null;
 const mechanics=['cadence','stepLength','groundContactTime','verticalOscillation'].flatMap(key=>{const validPairs=pairs.filter(p=>valid(p.early[key as keyof Block])&&valid(p.late[key as keyof Block]));if(validPairs.length<5)return [];const early=average(validPairs.map(p=>p.early[key as keyof Block] as number)),late=average(validPairs.map(p=>p.late[key as keyof Block] as number));return [{key,early,late,change:(late/early-1)*100}]});
 return {reason:null,pairs:pairs.length,drift,earlyHR,lateHR,pace:1000/average(pairs.flatMap(p=>[p.early.speed,p.late.speed])),mechanics,blocks};
}
export function newRecordedBests(activities:Workout[],now:Date,family:string){
 const key=family==='cycling'?'power':'speed',all=[...new Map(activities.filter(a=>sportFamily(a)===family&&new Date(a.date)<=now).map(a=>[a.id,a])).values()].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-7);
 const records:any[]=[];for(const seconds of [60,300,1200,3600]){let best:any=null;for(const a of all){const p=a.evidence?.best?.[key]?.find((p:any)=>p.seconds===seconds&&valid(p.value)&&p.value>0);if(!p)continue;if(!best||p.value>best.value){if(best&&new Date(a.date)>=cutoff&&Date.parse(a.date)>Date.parse(best.activity.date))records.push({seconds,value:p.value,activity:a,previous:best,change:(p.value/best.value-1)*100});best={...p,activity:a}}}}
 return {records:records.sort((a,b)=>Date.parse(b.activity.date)-Date.parse(a.activity.date)),analyzed:all.filter(a=>a.evidence?.version===1).length,total:all.length};
}
export function latestRunningSignals(activities:Workout[],now:Date){return [...activities].filter(a=>sportFamily(a)==='running'&&Date.parse(a.date)<=+now&&(a.evidence as any)?.insights).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))[0]??null}
export function mechanicsHistory(current:Workout,history:Workout[]){
 const blocks=current.evidence?.insights?.blocks??[],cutoff=Date.parse(current.date)-56*86400000;
 const previous=[...new Map(history.filter(a=>a.id!==current.id&&sportFamily(a)==='running'&&(a.subSportType??'')===(current.subSportType??'')&&Date.parse(a.date)<Date.parse(current.date)&&Date.parse(a.date)>=cutoff).map(a=>[a.id,a])).values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 return previous.flatMap(activity=>{const candidates=activity.evidence?.insights?.blocks??[],used=new Set<number>(),pairs:{a:Block;b:Block}[]=[];
  for(const a of blocks){const b=candidates.filter(b=>!used.has(b.minute)&&Math.abs(a.speed/b.speed-1)<=.03&&Math.abs(a.grade-b.grade)<=.5).sort((b,c)=>Math.abs(b.speed-a.speed)-Math.abs(c.speed-a.speed))[0];if(b){used.add(b.minute);pairs.push({a,b})}}
  if(pairs.length<5)return [];
  const metrics=['cadence','stepLength','groundContactTime','verticalOscillation'].flatMap(key=>{const p=pairs.filter(({a,b})=>valid(a[key as keyof Block])&&valid(b[key as keyof Block]));if(p.length<5)return [];const current=average(p.map(({a})=>a[key as keyof Block] as number)),prior=average(p.map(({b})=>b[key as keyof Block] as number));return [{key,current,prior,change:(current/prior-1)*100}]});
  return metrics.length?[{activity,minutes:pairs.length,metrics}]:[];
 }).slice(0,5);
}
