"use client";
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
import type {ActivityMetric} from './activity-metrics';
import RouteMap from './route-map';
import {ExpandButton} from './expansion';
import type {RouteSelection} from './route-geometry';
import type {SampledDetail} from './workout-splits-data';

// Headline numbers chosen per sport; the first three available become the large
// figures, the next few the quieter row beneath them.
const ORDER:Record<string,string[]>={
 running:['distance','duration','speed','heartrate','altitude','calories','trainingLoad','effort','vo2max'],
 walking:['distance','duration','speed','heartrate','altitude','steps','calories'],
 hiking:['distance','duration','altitude','speed','heartrate','calories'],
 cycling:['distance','duration','power','speed','heartrate','altitude','normalizedPower','calories','trainingLoad','effort'],
 swimming:['distance','duration','speed','heartrate','calories','trainingLoad','effort'],
 strength_training:['duration','heartrate','calories','trainingLoad','effort'],
};
const FALLBACK=['distance','duration','heartrate','speed','calories','trainingLoad','effort'];
const SHORT:Record<string,string>={duration:'Time',speed:'',heartrate:'Avg HR',altitude:'Climb',calories:'Energy',trainingLoad:'Load',effort:'Effort',normalizedPower:'NP',power:'Avg power',vo2max:'VO₂ · Tredict'};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);

// Swimmers read pace per 100 m rather than km/h.
function swimPace(summary?:{duration?:unknown;distance?:unknown}):ActivityMetric|null{
 const d=summary?.distance,t=summary?.duration;
 if(!finite(d)||!finite(t)||!(d>0)||!(t>0))return null;
 const per=Math.round(t/d*100);if(!Number.isFinite(per))return null;
 return {id:'speed',title:'Pace',value:`${Math.floor(per/60)}:${String(per%60).padStart(2,'0')}`,unit:'/100m',note:'',color:'',values:[],group:'Session',explanation:''};
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
 if(!finite(seconds)||seconds<=0)return null;
 const s=Math.round(seconds),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60,pad=(n:number)=>String(n).padStart(2,'0');
 return h?`${h}:${pad(m)}:${pad(r)}`:`${m}:${pad(r)}`;
}
const display=(m:ActivityMetric,duration?:number)=>m.id==='duration'?clock(duration)??m.value:m.id==='altitude'?m.value.replace(/^↑\s*/,'').split(' · ')[0]:m.value;

// The sheet's header: the recorded route fills the top when there is GPS, the
// title and headline numbers sit on a dark band that the map fades into.
export default function WorkoutHero({detail,cards,family,sportName,title,when,icon,onClose,loading,selection=null}:{selection?:RouteSelection|null;detail:SampledDetail&Record<string,unknown>;cards:ActivityMetric[];family:string;sportName:string;title:string;when:string;icon:ReactNode;onClose:()=>void;loading?:boolean}){
 const summary=detail.summary??{},{primary,secondary}=heroMetrics(cards,family,summary);
 const lat=detail.seriesSampled?.data?.positionLat,hasRoute=Array.isArray(lat)&&lat.some(finite);
 return <header className={`workout-hero ${hasRoute?'has-route':'no-route'}`}>
  {hasRoute&&<a className="workout-hero-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>}
  {hasRoute&&<div className="workout-hero-map" aria-hidden="true" inert><RouteMap detail={detail} selection={selection} compact/></div>}
  <div className="workout-hero-actions">
   {hasRoute&&<ExpandButton title="Recorded route"><RouteMap detail={detail} selection={selection}/></ExpandButton>}
   <button type="button" className="workout-hero-close" aria-label="Close workout" onClick={onClose}><X size={18}/></button>
  </div>
  <div className="workout-hero-body">
   <p className="workout-hero-kicker"><span className="workout-hero-icon">{icon}</span>{sportName}<span aria-hidden="true">·</span>{when}{loading&&<i className="workout-hero-loading" aria-label="Loading details"/>}</p>
   <h2 id="workout-title">{title}</h2>
   {primary.length>0&&<dl className="workout-hero-primary" data-count={primary.length}>
    {primary.map(m=><div key={m.id}><dt>{label(m)}</dt><dd><strong>{display(m,summary.duration)}</strong>{m.unit&&<span>{m.unit}</span>}</dd></div>)}
   </dl>}
   {secondary.length>0&&<dl className="workout-hero-secondary">
    {secondary.map(m=><div key={m.id}><dt>{label(m)}</dt><dd>{display(m,summary.duration)}{m.unit&&m.id!=='vo2max'&&<span> {m.unit}</span>}</dd></div>)}
   </dl>}
  </div>
 </header>;
}
