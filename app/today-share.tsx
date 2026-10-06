"use client";

import {useEffect,useState} from 'react';

import {dailyShareHistory} from './daily-share-history';

import ActivityShare from './activity-share';

import {cachedWorkout,loadWorkout} from './workout-detail-cache';

import {localDate} from './week-overview';

import {metricStatus} from './metric-status';

import {sportName,sportFamily} from './sports';

import type {AthleteData} from './analytics';

export default function TodayShare({data,now,token,isDemo,onClose}:{data:AthleteData;now:Date;token:string;isDemo:boolean;onClose:()=>void}){

 const [shareDate,setShareDate]=useState(localDate(now));
 const day=new Date(shareDate+'T12:00:00'),isToday=shareDate===localDate(now);
 const activities=data.activities,stamp=shareDate.replaceAll('-',''),dayHealth={history:dailyShareHistory(data,day),date:shareDate,sleep:data.sleep[stamp]?.[0],hrv:data.hrv[stamp]?.[0],score:data.extra?.coros?.sleepWindows?.[stamp]?.score,hrvRange:metricStatus('hrv',data,isToday?now:day,sportFamily).range};

 const today=activities.filter(a=>localDate(new Date(a.date))===shareDate&&new Date(a.date)<=now),[id,setId]=useState('recovery'),[detail,setDetail]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');

 const selected=today.find(a=>a.id===id);

 useEffect(()=>{let active=true;setDetail(null);setError('');setBusy(false);if(!selected||isDemo)return;setDetail(cachedWorkout(token,selected.id));setBusy(true);loadWorkout(token,selected.id).then(d=>{if(active)setDetail(d)}).catch(()=>{if(active)setError('Route and laps could not load. Summary designs are still available.')}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[id,shareDate,token,isDemo]);



 const sum=(key:string)=>today.every(a=>Number.isFinite(a.summary?.[key]))?today.reduce((n,a)=>n+a.summary![key],0):undefined;

 const all={id:'day-'+shareDate,date:(isToday?now:day).toISOString(),title:(isToday?'Today · ':'')+day.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}),sportType:'misc',summary:{duration:sum('duration'),calories:sum('calories')},demo:isDemo};

 const activity=selected?{...selected,...detail,summary:{...selected.summary,...detail?.summary},demo:isDemo}:all;

 function chooseDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value>localDate(now)||Number.isNaN(new Date(value+'T12:00:00').getTime()))return;setShareDate(value);setId(id==='all'?'all':'recovery');setDetail(null);}
 function shiftDay(offset:number){const next=new Date(day);next.setDate(next.getDate()+offset);chooseDate(localDate(next));}
 const selectionControls=<div className="share-day-controls"><div className="share-day-picker"><button aria-label="Previous share day" onClick={()=>shiftDay(-1)}>‹</button><label>Date<input aria-label="Share date" type="date" value={shareDate} max={localDate(now)} onChange={e=>chooseDate(e.target.value)}/></label><button aria-label="Next share day" disabled={isToday} onClick={()=>shiftDay(1)}>›</button>{!isToday&&<button onClick={()=>chooseDate(localDate(now))}>Today</button>}</div><label>Include<select aria-label="Share content" value={id} onChange={e=>{setDetail(null);setError('');setId(e.target.value)}}><option value="recovery">Health only · sleep, score & HRV</option><option value="all">{isToday?'Today':'Selected day'} · {today.length} {today.length===1?'activity':'activities'} + sleep & HRV</option>{today.map(a=><option key={a.id} value={a.id}>{new Date(a.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · {a.title||sportName(sportFamily(a))}</option>)}</select></label>{error&&<p role="status">{error}</p>}<p className="share-hint">{day.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} · synced activities and overnight readings for this date. Missing readings stay unavailable.</p></div>;
 return <ActivityShare onClose={onClose} selectionControls={selectionControls} recoveryOnly={id==='recovery'} dayHealth={selected?undefined:dayHealth} key={shareDate+id} activity={activity} history={activities} loading={busy} dayActivities={selected?undefined:today}/>;

}

