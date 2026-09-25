"use client";
import CorosDaily from './coros-daily';
import {memo} from 'react';
import TrendBadge from './trend-badge';
import {recoveryTrend} from './trend';
import {Moon,Activity,Heart,ChevronRight} from 'lucide-react';
import {useExpand} from './expansion';
import {metricStatus} from './metric-status';
import {sleepOverview} from './sleep-overview';
import {weekOverview,localDate} from './week-overview';
import TrainingComparison from './training-comparison-view';
import WeekGlance from './week-glance';
import TrainingSnapshot from './training-snapshot';
import WeeklyVolume from './weekly-volume';
import FatigueRecovery from './fatigue-recovery';
import DashboardCalendar,{clockDuration} from './dashboard-calendar';
import WidgetSpark from './widget-spark';
import type {AthleteData,Workout} from './analytics';
import {sportFamily} from './sports';
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const show=(v:unknown)=>valid(v)?v.toLocaleString('en-GB',{maximumFractionDigits:1}):'—';
function Today({data,isDemo,syncing,token,onSelect}:{data:AthleteData;isDemo:boolean;syncing:boolean;token:string;onSelect:(a:Workout)=>void}){
 const expand=useExpand(),now=isDemo?new Date('2026-09-17T23:59:59'):new Date(),day=localDate(now),w=weekOverview(data,now,sportFamily);
 const latest=(rows:any[],key:string)=>[...rows].filter(r=>valid(r[key])&&new Date(r.timestamp)<=now).sort((a,b)=>b.timestamp.localeCompare(a.timestamp))[0];
 const rhr=latest(data.extra?.bodyvalues?.bodyvalues??[],'hrRestDynamic');
 const dateNote=(v?:string)=>v?new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'No reading supplied';
 const sleep=sleepOverview(data.sleep,day),hrvDate=Object.keys(data.hrv).filter(k=>k<=day.replaceAll('-','')&&valid(data.hrv[k]?.[0])).sort().at(-1),hrv=hrvDate?data.hrv[hrvDate][0]:null;
 const tiles=[
 {key:'sleep',label:'Sleep',title:'Latest sleep',value:clockDuration(sleep.seconds),unit:'',note:sleep.date===day?'Last night':dateNote(sleep.date??undefined),values:w.rows.map(r=>r.sleep),Icon:Moon},
 {key:'hrv',label:'HRV',title:'Average HRV',value:show(hrv),unit:'ms',note:hrvDate?`Latest · ${hrvDate.slice(6,8)}/${hrvDate.slice(4,6)}`:'No reading supplied',values:w.rows.map(r=>r.hrv),Icon:Activity},
 {key:'rhr',label:'Resting HR',title:'Resting HR',value:show(rhr?.hrRestDynamic),unit:'bpm',note:dateNote(rhr?.timestamp),values:w.rows.map(r=>r.rhr),Icon:Heart},
 ].map(t=>{const readings=t.values.filter(valid),status=metricStatus(t.key,data,now,sportFamily);return {...t,status,trend:recoveryTrend(status.label==='Older reading'?null:readings.at(-1),readings.at(-2),status)}});
 return <section className="home-board" aria-label="Training at a glance"><header className="home-board-heading"><div><h1>Your training at a glance</h1><p>{now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div><span>{isDemo?'Illustrative demo data':syncing?'Updating your training history…':'Your training, sleep & recovery'}</span></header>
 <section className="home-vitals-table" aria-label="Daily metrics"><div className="vitals-table-head"><span>Metric / change</span><span>Latest</span><span>7 days</span><span>Status / date</span></div>
 <div className="home-recovery">{tiles.map(t=><button className={`home-metric home-surface status-${t.status.tone}`} key={t.title} onClick={()=>expand.metric(t.title)}><div className="home-metric-title"><t.Icon size={21} strokeWidth={1.6}/><span>{t.label}</span></div><span className="metric-state" title={t.status.reason}>{t.status.tone==='green'?'✓ ':t.status.tone==='orange'||t.status.tone==='red'?'! ':''}{t.status.label}</span><TrendBadge trend={t.trend}/><strong>{t.value} <small>{t.value==='—'?'':t.unit}</small></strong><WidgetSpark mode={t.key==='sleep'?'bars':'line'} dotted={t.key!=='sleep'} pointLabels={w.rows.map((r,i)=>`${r.iso}: ${t.values[i]??'No reading'} ${t.key==='sleep'?'h':t.unit}`)} pointColors={t.key==='sleep'?undefined:w.rows.map(r=>({green:'#16804a',lightgreen:'#6ba985',yellow:'#b29c38',orange:'#c58a20',red:'#dc4545',neutral:'#8893a3'}[metricStatus(t.key,data,new Date(r.iso+'T23:59:59'),sportFamily).tone]))} negativeBelow={t.key==='sleep'?6:undefined} positiveFrom={t.label==='Sleep'?8:undefined} amberBelow={t.key==='sleep'?7:undefined} yellowBelow={t.key==='sleep'?7.5:undefined} lightGreenFrom={t.key==='sleep'?7.5:undefined} values={t.values} label={`${t.label}, last 7 days${t.key==='sleep'?' · red below 6h, amber 6 to under 7h, light yellow 7 to under 7½h, light green 7½ to under 8h, deep green 8h or more':''}`}/><div className="home-metric-foot"><span>{t.status.rangeLabel?`Usual ${t.status.rangeLabel} · ${t.note}`:t.note}</span><ChevronRight size={15}/></div></button>)}</div>
 <CorosDaily data={data} now={now}/></section><div className="home-training-grid"><DashboardCalendar activities={data.activities} now={now} token={token} isDemo={isDemo} syncKey={data.syncedAt} onSelect={onSelect}/>
 <div className="home-volume-column"><WeeklyVolume data={data} now={now}/><FatigueRecovery data={data} now={now}/></div></div>
 <div className="home-secondary-grid"><TrainingComparison data={data} isDemo={isDemo} syncing={syncing}/>
 <div className="home-movement-row"><TrainingSnapshot data={data} now={now}/></div></div>
 <div className="home-more"><WeekGlance data={data} isDemo={isDemo}/></div>
 <details className="home-method"><summary>About these metrics</summary><p>Colours are sieste review flags: green means a target is met or a reading is within your usual range; black means neutral or insufficient data; orange means a change to review; red means a sustained deviation or a large shortfall. Tap a card for the exact rule. Arrows compare recorded values; green marks a favourable direction, amber/red an adverse direction, black no change and grey missing comparison data. Training-volume arrows show direction, not fitness. These are not medical diagnoses or permission to train. HRV uses the COROS normal range when available; resting HR uses a sieste range estimated from earlier readings. HRV below range or resting HR above range is amber; three consecutive out-of-range days are red. Sleep bars are deep green at 8h+, light green at 7½–8h, yellow at 7–7½h, amber at 6–7h and red below 6h. Within-range fluctuations and their arrows stay neutral. Day-to-day comparisons use the previous recorded day; Estimated ranges require 14 earlier readings; a supplied COROS HRV range can be used immediately. Stale values stay neutral. Top-card sparklines show seven days through today; longer charts use their selected period. Fatigue trends end yesterday so load uses complete days. Missing readings remain gaps. Sleep variability measures differences in sleep duration, not bedtime regularity. Workout calories cover synced sessions only, not all-day energy use. COROS sleep scores and daily steps are available when recorded; daily totals are not real-time readings. Today is partial. Tap any metric or session to explore its details without leaving this page.</p><p>Baseline approach: <a href="https://www.hrv4training.com/blog2/daily-score-baseline-and-normal-range-an-overview" target="_blank" rel="noreferrer">HRV4Training explains individual baselines</a>. sieste’s thresholds are transparent app heuristics, not the HRV4Training algorithm.</p></details></section>
}

export default memo(Today);
