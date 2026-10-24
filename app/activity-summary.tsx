"use client";
import {lazy,useMemo,useRef,useState,type Ref} from 'react';
import type {RouteSelection} from './route-geometry';
import DeferredPanel from './deferred-panel';
import type {AthleteData,Workout} from './analytics';
import WorkoutContext,{StrengthSummary} from './workout-context';
import {heroMetrics} from './workout-hero';
import WorkoutSplits from './workout-splits';
import './workout-explorer.css';
const WorkoutExplorer=lazy(()=>import('./workout-explorer'));
const CyclingAnalysis=lazy(()=>import('./cycling-analysis'));
const RunningAnalysis=lazy(()=>import('./running-analysis'));
import ActivityProfile from './activity-profile';
import {workoutInsights,type SectionMode} from './workout-insights';
import {runningTechnique} from './running-technique-data';
import RouteMap from './route-map';
import RecordedFields from './recorded-fields';
import WidgetSpark from './widget-spark';
import SessionIntelligence from './session-intelligence';
import RunningTechnique from './running-technique';
import {ResponsiveContainer,ComposedChart,Line,Area,CartesianGrid,XAxis,YAxis,Tooltip} from 'recharts';
import {ExpandButton} from './expansion';
const ActivityLaps=lazy(()=>import('./activity-laps'));
import ActivityZones from './activity-zones';
const IntervalConsistency=lazy(()=>import('./interval-consistency'));
import TrendBadge from './trend-badge';
import {sessionTrend,vo2Trend} from './trend';
import {activityMetrics,finite,numberLabel as format,paceLabel,type ActivityMetric} from './activity-metrics';
const runningPace=paceLabel;
// Movement measures shown up front, in reading order; missing ones are skipped.
const foot=['cadence','stepLength','verticalOscillation','verticalRatio','groundContactTime','flightTime','groundContactTimeBalance','formPower','airPower'];
const MECHANICS:Record<string,string[]>={running:foot,walking:foot,hiking:foot,cycling:['cadence','leftRightBalance','torqueEffectiveness','pedalSmoothness']};
function SensorChart({rows,title,unit,color,step,area=false,pace=false,expanded=false}:{rows:{x:number;value:number|null}[];title:string;unit:string;color:string;step:unknown;area?:boolean;pace?:boolean;expanded?:boolean}){
 return <div className={expanded?'activity-sensor-chart is-expanded':'activity-sensor-chart'}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{left:-12,right:8,top:8,bottom:0}}><CartesianGrid stroke="#e9edf3" vertical={false} strokeDasharray="2 4"/><XAxis dataKey="x" type="number" tickFormatter={v=>`${Math.round(v)}${finite(step)?'m':''}`} tick={{fontSize:10,fill:'#8893a3'}} minTickGap={25} axisLine={false} tickLine={false} height={22}/><YAxis domain={['auto','auto']} reversed={pace} tickFormatter={v=>pace?runningPace(v):format(v,0)} tick={{fontSize:10,fill:'#8893a3'}} tickCount={3} width={48} axisLine={false} tickLine={false}/><Tooltip wrapperStyle={{pointerEvents:'none',zIndex:2}} contentStyle={{fontSize:11,padding:'5px 8px',border:'1px solid #e3e8ef',borderRadius:8}} labelFormatter={v=>finite(step)?`${Number(v).toFixed(1)} min`:`Sample ${v}`} formatter={(v:any)=>[`${pace?runningPace(v):format(v,1)} ${unit}`,title]}/>{area?<Area type="linear" dataKey="value" stroke={color} fill={color} fillOpacity={.1} connectNulls={false} isAnimationActive={false}/>:<Line dataKey="value" stroke={color} strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false}/>}</ComposedChart></ResponsiveContainer></div>;
}
function MicroChart({metric}:{metric:ActivityMetric}){return <WidgetSpark className="activity-microchart" values={metric.values} label={`${metric.title} through this workout; expand for scale and values`} color={metric.color} reverse={metric.pace}/>;}
function MetricCard({metric,step,comparison,baseline}:{metric:ActivityMetric;step:unknown;comparison:ReturnType<typeof sessionTrend>;baseline?:{change:number;days:number;runs:number}|null}){
 const hasChart=metric.values.some(finite),rows=metric.values.map((value,i)=>({x:finite(step)?i*step/60:i,value}));
 return <section className={`activity-glance-card${hasChart?' has-microchart':''}`}><header><h3><i style={{background:metric.color}}/>{metric.title}</h3><ExpandButton title={metric.title}><div className="activity-expanded-sensor"><div className="activity-expanded-value"><strong style={{color:metric.color}}>{metric.value}</strong> {metric.unit}<small>{metric.note}</small></div><p>{metric.explanation}</p>{comparison?.metric===metric.id&&<><TrendBadge trend={comparison.trend} caption={comparison.comparison}/><p>{comparison.explanation}</p></>}{hasChart&&<SensorChart rows={rows} title={metric.title} unit={metric.unit} color={metric.color} step={step} pace={metric.pace} area={metric.id==='altitude'} expanded/>}</div></ExpandButton></header><div className="activity-glance-value"><strong style={{color:metric.color}}>{metric.value}</strong><span>{metric.unit}</span></div><p>{metric.note}</p>{comparison?.metric===metric.id&&<TrendBadge trend={comparison.trend} caption={comparison.metric==='vo2max'?(comparison.comparison.startsWith('median')?'vs 28-day median':'vs prior session'):'vs similar session'}/>}{baseline&&<p className="activity-baseline" title={`Duration-weighted average of your ${baseline.runs} runs in the last ${baseline.days} days`}>{baseline.change>0?'+':''}{baseline.change.toFixed(1)}% vs your {baseline.days}-day average</p>}{hasChart&&<MicroChart metric={metric}/>}</section>;
}
export default function ActivitySummary({detail,loading,history=[],onClassify,healthData,token='',storageScope='',isDemo=false,onSelect,onRouteSelection,routeSelection=null,mapRef}:{onRouteSelection?:(selection:RouteSelection|null)=>void;routeSelection?:RouteSelection|null;mapRef?:Ref<HTMLDivElement>;onClassify?:(label:string|null)=>void;detail:Workout&Record<string,any>;loading:boolean;history?:Workout[];healthData?:AthleteData;token?:string;storageScope?:string;isDemo?:boolean;onSelect?:(activity:Workout)=>void}){
 const {cards,other,family}=useMemo(()=>activityMetrics(detail),[detail]),step=detail.seriesSampled?.sampleSize,comparison=useMemo(()=>sessionTrend(detail,history),[detail,history]),vo2=useMemo(()=>vo2Trend(detail,history),[detail,history]);
 // The hero carries the headline numbers; tiles retain charts, elapsed time and elevation gain/loss.
 const headline=useMemo(()=>new Set(heroMetrics(cards,family,detail.summary).primary.map(m=>m.id)),[cards,family,detail.summary]);
 const mechanics=useMemo(()=>(MECHANICS[family]??[]).map(id=>cards.find(c=>c.id===id)).filter((c):c is ActivityMetric=>!!c&&c.value!=='—'),[cards,family]),vo2Metric=cards.find(c=>c.id==='vo2max'&&c.value!=='—'),shown=new Set([...mechanics.map(m=>m.id),'vo2max']);
 const groups=(['Session','Technique','Conditions'] as const).map(group=>({group,metrics:cards.filter(m=>m.group===group&&!shown.has(m.id)&&!(group==='Session'&&headline.has(m.id)&&!['duration','altitude','speed','heartrate','power'].includes(m.id)))})).filter(g=>g.metrics.length>0),metricCount=groups.reduce((n,g)=>n+g.metrics.length,0);
 const lat=detail.seriesSampled?.data?.positionLat,hasRoute=Array.isArray(lat)&&lat.some(finite);
 const insights=useMemo(()=>workoutInsights(detail,family).insights,[detail,family]),analysis=useRef<HTMLElement>(null),[modeRequest,setModeRequest]=useState<{mode:SectionMode;nonce:number}|null>(null);
 const openSection=(mode:SectionMode)=>{setModeRequest(r=>({mode,nonce:(r?.nonce??0)+1}));analysis.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
 // Mechanics tiles compare with your own recent running, 30 days first, else 90.
 const technique=useMemo(()=>family==='running'?runningTechnique(detail,history):null,[detail,history,family]);
 const baseline=(id:string)=>{const row=technique?.rows.find(r=>r.key===id);for(const days of [30,90]){const b=row?.baselines[technique!.windows.findIndex(w=>w.days===days)];if(b&&b.change!==null&&b.count>=2)return {change:b.change,days,runs:b.count}}return null};
 // Summary is the route with its climbs and laps, then movement mechanics and Tredict VO₂max; the rest waits in folded rows.
 return <div className="activity-scroll-summary compact-activity activity-glance">
 {family==='strength_training'&&<StrengthSummary detail={detail} history={history}/>}
 {insights.length>0&&<section className="workout-highlights" aria-label="Highlights"><ul>{insights.map(i=><li key={i.id}>{i.mode?<button type="button" onClick={()=>openSection(i.mode!)}><strong>{i.title}</strong><small>{i.detail}</small></button>:<div><strong>{i.title}</strong><small>{i.detail}</small></div>}</li>)}</ul></section>}
 {family!=='strength_training'&&(hasRoute||detail.seriesSampled?.data)&&<section ref={analysis} className="workout-route-analysis" aria-label="Route and sections">
  {hasRoute&&<div ref={mapRef} className="workout-route-map"><RouteMap detail={detail} selection={routeSelection} compact/><ExpandButton title="Recorded route"><RouteMap detail={detail} selection={routeSelection}/></ExpandButton><a className="workout-route-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></div>}
  {detail.seriesSampled?.data&&<ActivityProfile key={`profile-${detail.id}`} detail={detail} compact onSelection={onRouteSelection} modeRequest={modeRequest}/>}
 </section>}
 {mechanics.length>0&&<section className="workout-mechanics" aria-labelledby="workout-mechanics-title"><header><h3 id="workout-mechanics-title">{family==='cycling'?'Pedalling':family==='running'?'Running mechanics':'Movement'}</h3></header><div className="activity-glance-grid">{mechanics.map(metric=><MetricCard key={metric.id} metric={metric} step={step} comparison={comparison} baseline={baseline(metric.id)}/>)}</div>
  {family==='running'&&<DeferredPanel className="activity-extra-sensors" summary={<span>Compare with earlier runs<small>Your 7, 30 and 90-day averages</small></span>}><RunningTechnique key={`technique-${detail.id}`} detail={detail} history={history} loading={loading}/></DeferredPanel>}
 </section>}
 {vo2Metric&&<section className="workout-vo2" aria-label="Tredict VO₂max"><MetricCard metric={vo2Metric} step={step} comparison={vo2}/></section>}
 {detail.notes&&<p className="plan-notes">{detail.notes}</p>}
 <section className="workout-more" aria-label="More analysis">
 {family!=='strength_training'&&<DeferredPanel className="activity-extra-sensors" summary={<span>Splits<small>{family==='cycling'?'Every 5 km':family==='swimming'?'Every 100 m':'Every kilometre'}</small></span>}><WorkoutSplits detail={detail} family={family}/></DeferredPanel>}
 <DeferredPanel className="activity-extra-sensors" summary={<span>Time in zones<small>Heart rate & power</small></span>}><ActivityZones summary={detail.summary??{}} loading={loading}/></DeferredPanel>
 {metricCount>0&&<DeferredPanel className="activity-extra-sensors" summary={<span>All metrics & charts<small>{metricCount} recorded measures</small></span>}>{()=><>{groups.map(({group,metrics})=><section className="activity-glance-group" key={group}><div className="activity-section-label"><h3>{group==='Session'?'Session':group==='Technique'?'Movement & technique':'Terrain & conditions'}</h3><span>{group==='Session'?'Tap ↗ to expand':''}</span></div><div className="activity-glance-grid">{metrics.map(metric=><MetricCard key={metric.id} metric={metric} step={step} comparison={metric.id==='vo2max'?vo2:comparison}/>)}</div></section>)}{other.length>0&&<details className="activity-extra-sensors"><summary>{other.length} additional recorded sensors</summary><p>Available under Telemetry and Raw data. No assumed units or generic averages.</p><div>{other.map(key=><span key={key}>{key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase())}</span>)}</div></details>}<p className="activity-data-note">Micro charts show the whole workout; each has its own scale. Expand for units and values. Gaps are preserved. {detail.demo?'Illustrative demo.':''}</p></>}</DeferredPanel>}
 <DeferredPanel className="activity-extra-sensors workout-explorer-fold" summary={<span>Explore workout<small>{family==='cycling'?'Replay · terrain · coasting · compare':family==='running'?'Replay · fingerprint · terrain · compare':'Laps · recovery'}</small></span>}><WorkoutExplorer detail={detail} history={history} healthData={healthData} token={token} storageScope={storageScope} isDemo={isDemo}/></DeferredPanel>
 {family==='cycling'&&<DeferredPanel className="activity-extra-sensors" summary={<span>Deep analysis<small>Efficiency, power & durability</small></span>}><CyclingAnalysis detail={detail} history={history}/></DeferredPanel>}
 {family==='running'&&<DeferredPanel className="activity-extra-sensors" summary={<span>Deep analysis<small>Running pace & repeats</small></span>}><RunningAnalysis detail={detail}/></DeferredPanel>}
 <DeferredPanel className="activity-extra-sensors" summary={<span>Execution<small>Repeat consistency & fading</small></span>}><IntervalConsistency key={detail.id} detail={detail}/><ActivityLaps detail={detail}/></DeferredPanel>
 {!loading&&!detail.mergedIds&&<DeferredPanel className="activity-extra-sensors" summary={<span>Session type<small>Label & coaching notes</small></span>}><SessionIntelligence key={`intelligence-${detail.id}`} detail={detail} onClassify={onClassify}/></DeferredPanel>}
 <DeferredPanel className="activity-extra-sensors" summary={<span>Previous & next sessions<small>Gaps and context around this one</small></span>}><WorkoutContext detail={detail} history={history} healthData={healthData} onSelect={onSelect}/></DeferredPanel>
 <RecordedFields detail={detail}/>
 {detail.recordedSource==='COROS FIT'&&<a className="docs-link" href={'/api/coros/file?id='+encodeURIComponent(detail.id)}>Download original COROS FIT ↗</a>}
 </section></div>;
}
