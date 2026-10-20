"use client";
import type {ActivityMetric} from './activity-metrics';

// Headline numbers chosen per sport; the first three available become the large
// figures, the next few become the quieter row beneath them.
const ORDER:Record<string,string[]>={
 running:['distance','duration','speed','heartrate','altitude','calories','trainingLoad','effort','vo2max'],
 walking:['distance','duration','speed','heartrate','altitude','steps','calories'],
 hiking:['distance','duration','altitude','speed','heartrate','calories'],
 cycling:['distance','duration','power','speed','heartrate','altitude','normalizedPower','calories','trainingLoad','effort'],
 swimming:['distance','duration','speed','heartrate','calories','trainingLoad','effort'],
 strength_training:['duration','heartrate','calories','trainingLoad','effort'],
};
const FALLBACK=['distance','duration','heartrate','speed','calories','trainingLoad','effort'];
const SHORT:Record<string,string>={duration:'Time',speed:'',heartrate:'Avg HR',altitude:'Climb',calories:'Calories',trainingLoad:'Load',effort:'Effort',normalizedPower:'NP',power:'Avg power',vo2max:'VO₂ · Tredict'};

// Swimmers read pace per 100 m rather than km/h.
function swimPace(summary?:{duration?:unknown;distance?:unknown}):ActivityMetric|null{
 const d=summary?.distance,t=summary?.duration;
 if(typeof d!=='number'||typeof t!=='number'||!(d>0)||!(t>0))return null;
 const per=t/d*100;
 return {id:'speed',title:'Pace',value:`${Math.floor(per/60)}:${String(Math.round(per%60)).padStart(2,'0')}`,unit:'/100m',note:'',color:'',values:[],group:'Session',explanation:''};
}
export function heroMetrics(cards:ActivityMetric[],family:string,summary?:{duration?:unknown;distance?:unknown}){
 const byId=new Map(cards.filter(c=>c.value!=='—').map(c=>[c.id,c]));
 const pace=family==='swimming'?swimPace(summary):null;if(pace)byId.set('speed',pace);
 const picked=(ORDER[family]??FALLBACK).map(id=>byId.get(id)).filter((c):c is ActivityMetric=>!!c);
 return {primary:picked.slice(0,3),secondary:picked.slice(3,7)};
}

const label=(m:ActivityMetric)=>SHORT[m.id]||m.title;
// Time reads as a clock; elevation ("↑ 120 · ↓ 118") shows the gain only.
export function clock(seconds:unknown){
 if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0)return null;
 const s=Math.round(seconds),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60,pad=(n:number)=>String(n).padStart(2,'0');
 return h?`${h}:${pad(m)}:${pad(r)}`:`${m}:${pad(r)}`;
}
const display=(m:ActivityMetric,duration?:number)=>m.id==='duration'?clock(duration)??m.value:m.id==='altitude'?m.value.replace(/^↑\s*/,'').split(' · ')[0]:m.value;

export default function WorkoutHero({cards,family,sportName,summary,loading}:{cards:ActivityMetric[];family:string;sportName:string;summary?:{duration?:number;distance?:number};loading?:boolean}){
 const {primary,secondary}=heroMetrics(cards,family,summary),duration=summary?.duration;
 if(!primary.length)return null;
 return <section className="workout-hero" aria-label={`${sportName} summary`}>
  <span className="workout-hero-sport">{sportName}{loading&&<i aria-label="Loading details"/>}</span>
  <dl className="workout-hero-primary" data-count={primary.length}>
   {primary.map(m=><div key={m.id}><dt>{label(m)}</dt><dd><strong>{display(m,duration)}</strong>{m.unit&&<span>{m.unit}</span>}</dd></div>)}
  </dl>
  {secondary.length>0&&<dl className="workout-hero-secondary">
   {secondary.map(m=><div key={m.id}><dt>{label(m)}</dt><dd>{display(m,duration)}{m.unit&&<span> {m.unit}</span>}</dd></div>)}
  </dl>}
 </section>;
}
