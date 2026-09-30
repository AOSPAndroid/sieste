"use client";

import {useEffect,useState} from 'react';

import {dailyShareHistory} from './daily-share-history';

import ActivityShare from './activity-share';

import {cachedWorkout,loadWorkout} from './workout-detail-cache';

import {localDate} from './week-overview';

import {metricStatus} from './metric-status';

import {sportName,sportFamily} from './sports';

import type {AthleteData} from './analytics';

export default function TodayShare({data,now,token,isDemo}:{data:AthleteData;now:Date;token:string;isDemo:boolean}){

 const activities=data.activities,stamp=localDate(now).replaceAll('-',''),dayHealth={history:dailyShareHistory(data,now),date:localDate(now),sleep:data.sleep[stamp]?.[0],hrv:data.hrv[stamp]?.[0],score:data.extra?.coros?.sleepWindows?.[stamp]?.score,hrvRange:metricStatus('hrv',data,now,sportFamily).range};

 const today=activities.filter(a=>localDate(new Date(a.date))===localDate(now)&&new Date(a.date)<=now),[id,setId]=useState('recovery'),[detail,setDetail]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');

 const selected=today.find(a=>a.id===id);

 useEffect(()=>{let active=true;setDetail(null);setError('');setBusy(false);if(!selected||isDemo)return;setDetail(cachedWorkout(token,selected.id));setBusy(true);loadWorkout(token,selected.id).then(d=>{if(active)setDetail(d)}).catch(()=>{if(active)setError('Route and laps could not load. Summary designs are still available.')}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[id,token,isDemo]);



 const sum=(key:string)=>today.every(a=>Number.isFinite(a.summary?.[key]))?today.reduce((n,a)=>n+a.summary![key],0):undefined;

 const all={id:'today',date:now.toISOString(),title:"Today · "+now.toLocaleDateString('en-GB',{day:'numeric',month:'short'}),sportType:'misc',summary:{duration:sum('duration'),calories:sum('calories')},demo:isDemo};

 const activity=selected?{...selected,...detail,summary:{...selected.summary,...detail?.summary},demo:isDemo}:all;

 return <div className="today-share"><label>Share today<select aria-label="Today's share activity" value={id} onChange={e=>setId(e.target.value)}><option value="recovery">Health only · sleep, score & HRV</option><option value="all">Today · {today.length} {today.length===1?'activity':'activities'} + sleep & HRV</option>{today.map(a=><option key={a.id} value={a.id}>{new Date(a.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · {a.title||sportName(sportFamily(a))}</option>)}</select></label>{error&&<p role="status">{error}</p>}<p className="share-hint">{now.toLocaleDateString('en-GB',{day:'numeric',month:'long'})} · today’s synced activities and overnight readings. Missing readings stay unavailable.</p><ActivityShare recoveryOnly={id==='recovery'} dayHealth={selected?undefined:dayHealth} key={id} activity={activity} history={activities} loading={busy} dayActivities={selected?undefined:today}/></div>;

}

