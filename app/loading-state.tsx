"use client";
import {Component,useEffect,type ReactNode} from 'react';
import {sportFamily,sportDescription} from './sports';
import {X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';
export function LoadingState({label='Loading…',compact=false}:{label?:string;compact?:boolean}){return <div className={`loading-state${compact?' is-compact':''}`} role="status" aria-live="polite"><span className="loading-orbit" aria-hidden="true"/><span>{label}</span>{!compact&&<div className="loading-skeleton flex gap-2" aria-hidden="true"><Skeleton className="h-20 flex-1"/><Skeleton className="h-20 flex-1"/><Skeleton className="h-20 flex-1"/></div>}</div>}
export function DashboardLoading(){return <div className="dashboard-loading" role="status" aria-label="Loading your saved dashboard"><strong>sieste<span className="loading-orbit" aria-hidden="true"/></strong><p>Loading your saved dashboard…</p><div className="dashboard-skeleton" aria-hidden="true"><div className="skeleton-metrics"><Skeleton className="h-20"/><Skeleton className="h-20"/><Skeleton className="h-20"/></div><div className="skeleton-calendar"><Skeleton className="h-40"/><Skeleton className="h-40"/><Skeleton className="h-40"/></div><Skeleton className="h-28"/></div></div>}
// While the workout view loads, a sheet with the same frame as the real one: sport, date and
// title are already known, the rest shimmers. The real sheet then fades in over it instead of
// sliding up a second time.
let skeletonAt=0;
export const skeletonShownRecently=()=>{const shown=skeletonAt>0&&performance.now()-skeletonAt<10000;skeletonAt=0;return shown};
export function WorkoutLoading({onClose,activity}:{onClose:()=>void;activity?:{date?:string;title?:string;sportType?:string;subSportType?:string}}){
 useEffect(()=>{skeletonAt=performance.now()},[]);
 const family=activity?sportFamily(activity):'misc',when=activity?.date?new Date(activity.date):null;
 return <section className={`modal workout-modal workout-loading workout-skeleton sport-${family}`} role="dialog" aria-modal="true" aria-label="Opening workout" aria-busy="true" onClick={e=>e.stopPropagation()}>
  <header><p><i aria-hidden="true"/>{activity?sportDescription(activity):'Workout'}{when&&!Number.isNaN(+when)?` · ${when.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})} · ${when.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}</p><h2>{activity?.title||(activity?sportDescription(activity):'Opening workout')}</h2><Button variant="ghost" size="icon" className="workout-skeleton-close" autoFocus aria-label="Close workout" onClick={onClose}><X data-icon="inline-start"/></Button></header>
  <div className="workout-skeleton-tabs" aria-hidden="true"><b/><i/><i/><i/></div>
  <div className="workout-skeleton-body" aria-hidden="true"><i className="is-map"/><i/><div><i/><i/><i/></div></div>
  <span className="sr-only" role="status">Opening workout…</span>
 </section>;
}
export class FeatureBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true}}render(){return this.state.failed?<div className="notice" role="alert">This view could not load. <button className="lab-button" onClick={()=>window.location.reload()}>Reload app</button></div>:this.props.children}}
