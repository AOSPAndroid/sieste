"use client";
import DailyThreeDays from './daily-three-days';
import {memo,useState,lazy} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import DeferredPanel from './deferred-panel';
const TrainingComparison=lazy(()=>import('./training-comparison-view'));
const WeekGlance=lazy(()=>import('./week-glance'));
const TrainingSnapshot=lazy(()=>import('./training-snapshot'));
import WeeklyVolume from './weekly-volume';
import FatigueRecovery from './fatigue-recovery';
import DashboardCalendar from './dashboard-calendar';
import type {AthleteData,Workout} from './analytics';
function Today({data,isDemo,syncing,token,onSelect}:{data:AthleteData;isDemo:boolean;syncing:boolean;token:string;onSelect:(a:Workout)=>void}){
 const [count,setCount]=useState<3|7>(3),[offset,setOffset]=useState(0);
 const now=isDemo?new Date('2026-09-17T23:59:59'):new Date();
 const dates=Array.from({length:count},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-offset*count-count+1+i);return d});
 return <section className="home-board" aria-label="Training at a glance"><header className="home-board-heading"><div><h1>Your day, in focus.</h1><p>{now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div><span>{isDemo?'Illustrative demo data':syncing?'Updating your training history…':'Your training, sleep & recovery'}</span></header>
 <div className="home-range-control"><span>Training view</span><div role="group" aria-label="Homepage view">{([3,7] as const).map(n=><button key={n} aria-pressed={count===n} onClick={()=>{setCount(n);setOffset(0)}}>{n} days</button>)}</div><button aria-label="Previous period" onClick={()=>setOffset(v=>v+1)}><ChevronLeft size={14}/></button><button aria-label="Next period" disabled={!offset} onClick={()=>setOffset(v=>Math.max(0,v-1))}><ChevronRight size={14}/></button></div><div className="v3-overview-grid"><DailyThreeDays data={data} now={now} count={count} offset={offset}/><FatigueRecovery data={data} now={now}/></div><div className="home-training-grid"><DashboardCalendar sharedDates={dates} activities={data.activities} now={now} token={token} isDemo={isDemo} syncKey={data.syncedAt} onSelect={onSelect}/>
 <div className="home-volume-column"><WeeklyVolume data={data} now={now}/></div></div>
 <DeferredPanel className="v2-explore" summary="Volume & trends · compare your weeks">{()=> <><TrainingComparison data={data} isDemo={isDemo} syncing={syncing}/><TrainingSnapshot data={data} now={now}/><WeekGlance data={data} isDemo={isDemo}/></>}</DeferredPanel>
 <details className="home-method"><summary>About these metrics</summary><p>Colours are sieste review flags: green means a target is met or a reading is within your usual range; black means neutral or insufficient data; orange means a change to review; red means a sustained deviation or a large shortfall. Tap a card for the exact rule. Arrows compare recorded values; green marks a favourable direction, amber/red an adverse direction, black no change and grey missing comparison data. Training-volume arrows show direction, not fitness. These are not medical diagnoses or permission to train. HRV uses the COROS normal range when available; resting HR uses a sieste range estimated from earlier readings. HRV below range or resting HR above range is amber; three consecutive out-of-range days are red. Sleep bars are deep green at 8h+, light green at 7½–8h, yellow at 7–7½h, amber at 6–7h and red below 6h. Within-range fluctuations and their arrows stay neutral. Day-to-day comparisons use the previous recorded day; Estimated ranges require 14 earlier readings; a supplied COROS HRV range can be used immediately. Stale values stay neutral. Daily-metric mini charts show seven days ending on the selected period’s final day; longer charts use their selected period. Fatigue trends end yesterday so load uses complete days. Missing readings remain gaps. Sleep variability measures differences in sleep duration, not bedtime regularity. Workout calories cover synced sessions only, not all-day energy use. COROS sleep scores and daily steps are available when recorded; daily totals are not real-time readings. Today is partial. Tap any metric or session to explore its details without leaving this page.</p><p>Baseline approach: <a href="https://www.hrv4training.com/blog2/daily-score-baseline-and-normal-range-an-overview" target="_blank" rel="noreferrer">HRV4Training explains individual baselines</a>. sieste’s thresholds are transparent app heuristics, not the HRV4Training algorithm.</p></details></section>
}

export default memo(Today);
