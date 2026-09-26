"use client";
import {useEffect,useState} from 'react';
import ActivityShare from './activity-share';
import {cachedWorkout,loadWorkout} from './workout-detail-cache';
import {localDate} from './week-overview';
import {sportName,sportFamily} from './sports';
import type {Workout} from './analytics';
export default function TodayShare({activities,now,token,isDemo}:{activities:Workout[];now:Date;token:string;isDemo:boolean}){
 const today=activities.filter(a=>localDate(new Date(a.date))===localDate(now)&&new Date(a.date)<=now),[id,setId]=useState('all'),[detail,setDetail]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const selected=today.find(a=>a.id===id);
 useEffect(()=>{let active=true;setDetail(null);setError('');setBusy(false);if(!selected||isDemo)return;setDetail(cachedWorkout(token,selected.id));setBusy(true);loadWorkout(token,selected.id).then(d=>{if(active)setDetail(d)}).catch(()=>{if(active)setError('Route and laps could not load. Summary designs are still available.')}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[id,token,isDemo]);
 if(!today.length)return <p>No activities synced for today yet. Sync after your workout to create a share image.</p>;
 const sum=(key:string)=>today.every(a=>Number.isFinite(a.summary?.[key]))?today.reduce((n,a)=>n+a.summary![key],0):undefined;
 const all={id:'today',date:now.toISOString(),title:"Today’s activities",sportType:'misc',summary:{duration:sum('duration'),calories:sum('calories')},demo:isDemo};
 const activity=selected?{...selected,...detail,summary:{...selected.summary,...detail?.summary},demo:isDemo}:all;
 return <div className="today-share"><label>Share today<select aria-label="Today's share activity" value={id} onChange={e=>setId(e.target.value)}><option value="all">All {today.length} {today.length===1?'activity':'activities'}</option>{today.map(a=><option key={a.id} value={a.id}>{new Date(a.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · {a.title||sportName(sportFamily(a))}</option>)}</select></label>{error&&<p role="status">{error}</p>}<ActivityShare key={id} activity={activity} history={activities} loading={busy} dayActivities={selected?undefined:today}/></div>;
}
