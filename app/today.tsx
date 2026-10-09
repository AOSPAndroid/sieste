"use client";
import {useExpand} from './expansion';
const MonthRoutePoster=lazy(()=>import('./month-route-poster'));
const HomeSnapshot=lazy(()=>import('./home-snapshot'));
import HomeActivityImport from './home-activity-import';
import HomeShare from './home-share';
import DailyThreeDays from './daily-three-days';
import {memo,useEffect,useRef,useState,lazy,Suspense} from 'react';
import {ChevronLeft,ChevronRight,Camera,Map} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {FeatureBoundary} from './loading-state';
const HomeAnalysisWidgets=lazy(()=>import('./home-analysis-widgets'));
import DashboardCalendar from './dashboard-calendar';
import type {AthleteData,Workout} from './analytics';
import {localDate} from './week-overview';
function HomeAnalysisLoading(){return <><Card size="sm" aria-label="Loading weekly volume"><CardHeader><CardTitle>Weekly volume</CardTitle></CardHeader><CardContent className="flex flex-col gap-2" aria-hidden="true"><Skeleton className="h-14"/><Skeleton className="h-14"/><Skeleton className="h-14"/></CardContent></Card><Card size="sm" aria-label="Loading training load"><CardHeader><CardTitle>Training load</CardTitle></CardHeader><CardContent className="flex flex-col gap-3" aria-hidden="true"><Skeleton className="h-24"/><Skeleton className="h-12"/><Skeleton className="h-40"/><Skeleton className="h-8"/></CardContent></Card></>}
function HomeAnalysis({data,now}:{data:AthleteData;now:Date}){
 const host=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false);
 useEffect(()=>{const node=host.current;if(!node)return;if(!('IntersectionObserver' in window)){setVisible(true);return}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'160px'});observer.observe(node);return()=>observer.disconnect()},[]);
 return <div ref={host} className="snapshot-home-analysis">{visible?<FeatureBoundary><Suspense fallback={<HomeAnalysisLoading/>}><HomeAnalysisWidgets data={data} now={now}/></Suspense></FeatureBoundary>:<HomeAnalysisLoading/>}</div>;
}
function Today({data,isDemo,token,onSelect}:{data:AthleteData;isDemo:boolean;token:string;onSelect:(a:Workout)=>void}){
 const expand=useExpand();
 const [count,setCount]=useState<3|7>(3),[offset,setOffset]=useState(0);
 const now=isDemo?new Date('2026-09-17T23:59:59'):new Date();
 const dates=Array.from({length:count},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-offset*count-count+1+i);return d});
 return <section className="home-board" aria-label="Training at a glance">
 <div className="home-range-control"><div className="home-share-actions" role="group" aria-label="Share your data"><HomeShare data={data} now={now} token={token} isDemo={isDemo}/><Button variant="outline" size="sm" onClick={()=>expand.widget("Monthly route poster",<Suspense fallback={<p>Loading poster…</p>}><MonthRoutePoster activities={data.activities} now={now} token={token} isDemo={isDemo}/></Suspense>)}><Map data-icon="inline-start"/><span>Route poster</span></Button><Button variant="outline" size="sm" onClick={()=>expand.widget("Health & training snapshot",<Suspense fallback={<p>Preparing snapshot…</p>}><HomeSnapshot data={data} dates={dates} now={now} token={token} isDemo={isDemo}/></Suspense>)}><Camera data-icon="inline-start"/><span>Snapshot</span></Button></div><div className="home-period-actions"><time dateTime={localDate(now)} title={now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}>{now.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</time><div className="home-range-picker"><ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={String(count)} onValueChange={value=>{if(value==='3'||value==='7'){setCount(Number(value) as 3|7);setOffset(0)}}} aria-label="Homepage view"><ToggleGroupItem value="3">3 days</ToggleGroupItem><ToggleGroupItem value="7">7 days</ToggleGroupItem></ToggleGroup><Button variant="ghost" size="icon-sm" aria-label="Previous period" onClick={()=>setOffset(v=>v+1)}><ChevronLeft data-icon="inline-start"/></Button><Button variant="ghost" size="icon-sm" aria-label="Next period" disabled={!offset} onClick={()=>setOffset(v=>Math.max(0,v-1))}><ChevronRight data-icon="inline-start"/></Button></div><HomeActivityImport/></div></div><div className="snapshot-home-layout"><div className="snapshot-home-focus"><DailyThreeDays data={data} now={now} count={count} offset={offset}/><DashboardCalendar sharedDates={dates} activities={data.activities} now={now} token={token} isDemo={isDemo} syncKey={data.syncedAt} onSelect={onSelect}/>
 </div><HomeAnalysis data={data} now={now}/></div>
 <details className="home-method"><summary>About these metrics</summary><p>Colours are sieste review flags: green means a target is met or a reading is within your usual range; black means neutral or insufficient data; orange means a change to review; red means a sustained deviation or a large shortfall. Tap a card for the exact rule. Arrows compare recorded values; green marks a favourable direction, amber/red an adverse direction, black no change and grey missing comparison data. Training-volume arrows show direction, not fitness. These are not medical diagnoses or permission to train. HRV uses the COROS normal range when available; resting HR uses a sieste range estimated from earlier readings. HRV below range or resting HR above range is amber; three consecutive out-of-range days are red. Sleep bars are deep green at 8h+, light green at 7½–8h, yellow at 7–7½h, amber at 6–7h and red below 6h. Within-range fluctuations and their arrows stay neutral. Day-to-day comparisons use the previous recorded day; Estimated ranges require 14 earlier readings; a supplied COROS HRV range can be used immediately. Stale values stay neutral. Daily-metric mini charts show seven days ending on the selected period’s final day; longer charts use their selected period. Load comparisons use completed days; the chart also shows today so far. Missing readings remain gaps. Sleep variability measures differences in sleep duration, not bedtime regularity. Workout calories cover synced sessions only, not all-day energy use. COROS sleep scores and daily steps are available when recorded; daily totals are not real-time readings. Today is partial. Tap any metric or session to explore its details without leaving this page.</p><p>Baseline approach: <a href="https://www.hrv4training.com/blog2/daily-score-baseline-and-normal-range-an-overview" target="_blank" rel="noreferrer">HRV4Training explains individual baselines</a>. sieste’s thresholds are transparent app heuristics, not the HRV4Training algorithm.</p></details></section>
}

export default memo(Today);
