"use client";
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
import type {ActivityMetric} from './activity-metrics';

const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);

// Swimmers read pace per 100 m rather than km/h.
export function swimPace(summary?:{duration?:unknown;distance?:unknown}):ActivityMetric|null{
 const d=summary?.distance,t=summary?.duration;
 if(!finite(d)||!finite(t)||!(d>0)||!(t>0))return null;
 const per=Math.round(t/d*100);if(!Number.isFinite(per))return null;
 return {id:'speed',title:'Pace',value:`${Math.floor(per/60)}:${String(per%60).padStart(2,'0')}`,unit:'/100m',note:'Workout average',color:'#3268d6',values:[],group:'Session',explanation:'Average pace per 100 m: duration divided by distance.'};
}

// The sheet's header: sport, date and title. The numbers live in the
// workout data squares, the route with its efforts, climbs and laps.
export default function WorkoutHero({sportName,title,when,icon,onClose,loading}:{sportName:string;title:string;when:string;icon:ReactNode;onClose:()=>void;loading?:boolean}){
 return <header className="workout-hero">
  <div className="workout-hero-actions">
   <button type="button" className="workout-hero-close" aria-label="Close workout" onClick={onClose}><X size={18}/></button>
  </div>
  <div className="workout-hero-body">
   <p className="workout-hero-kicker"><span className="workout-hero-icon">{icon}</span>{sportName}<span aria-hidden="true">·</span>{when}{loading&&<i className="workout-hero-loading" aria-label="Loading details"/>}</p>
   <h2 id="workout-title">{title}</h2>
  </div>
 </header>;
}
