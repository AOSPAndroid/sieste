"use client";
import {lazy,memo,useCallback,useEffect,useMemo,useRef,useState,type Ref} from 'react';
import type {RouteSelection} from './route-geometry';
import DeferredPanel from './deferred-panel';
import type {AthleteData,Workout} from './analytics';
import WorkoutContext,{StrengthSummary} from './workout-context';
import {swimPace} from './workout-hero';
import WorkoutSplits from './workout-splits';
import './workout-explorer.css';
const WorkoutExplorer=lazy(()=>import('./workout-explorer'));
const CyclingAnalysis=lazy(()=>import('./cycling-analysis'));
const RunningAnalysis=lazy(()=>import('./running-analysis'));
import ActivityProfileView from './activity-profile';
// Hovering the chart only moves the map dot; the chart itself need not re-render.
const ActivityProfile=memo(ActivityProfileView);
import {intensityLevels,intensityColors} from './workout-insights';
import {workoutEvidence} from './training-coach-data';
import {ROUTE_VERSION} from './route-signature';
import {routeAttempts,climbAttempts,workoutRecords,type HistoryWorkout} from './route-history';
import {paceFromSpeed} from './activity-terrain-data';
import RouteMap from './route-map';
import RecordedFields from './recorded-fields';
import WidgetSpark from './widget-spark';
import SessionIntelligence from './session-intelligence';
import RunningTechnique from './running-technique';
import {ResponsiveContainer,ComposedChart,Line,Area,CartesianGrid,XAxis,YAxis,Tooltip} from 'recharts';
import {ExpandButton} from './expansion';
const ActivityLaps=lazy(()=>import('./activity-laps'));
import ActivityZones,{ZoneStrip} from './activity-zones';
import {zoneVersionAt} from './athlete-thresholds';
import Pedalling from './pedalling';
import {heatEffect,heatNote} from './conditions-data';
const IntervalConsistency=lazy(()=>import('./interval-consistency'));
import TrendBadge from './trend-badge';
import {sessionTrend,vo2Trend} from './trend';
import {activityMetrics,finite,numberLabel as format,paceLabel,type ActivityMetric} from './activity-metrics';
const runningPace=paceLabel;
function SensorChart({rows,title,unit,color,step,area=false,pace=false,expanded=false}:{rows:{x:number;value:number|null}[];title:string;unit:string;color:string;step:unknown;area?:boolean;pace?:boolean;expanded?:boolean}){
 return <div className={expanded?'activity-sensor-chart is-expanded':'activity-sensor-chart'}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{left:-12,right:8,top:8,bottom:0}}><CartesianGrid stroke="#e9edf3" vertical={false} strokeDasharray="2 4"/><XAxis dataKey="x" type="number" tickFormatter={v=>`${Math.round(v)}${finite(step)?'m':''}`} tick={{fontSize:10,fill:'#8893a3'}} minTickGap={25} axisLine={false} tickLine={false} height={22}/><YAxis domain={['auto','auto']} reversed={pace} tickFormatter={v=>pace?runningPace(v):format(v,0)} tick={{fontSize:10,fill:'#8893a3'}} tickCount={3} width={48} axisLine={false} tickLine={false}/><Tooltip wrapperStyle={{pointerEvents:'none',zIndex:2}} contentStyle={{fontSize:11,padding:'5px 8px',border:'1px solid #e3e8ef',borderRadius:8}} labelFormatter={v=>finite(step)?`${Number(v).toFixed(1)} min`:`Sample ${v}`} formatter={(v:any)=>[`${pace?runningPace(v):format(v,1)} ${unit}`,title]}/>{area?<Area type="linear" dataKey="value" stroke={color} fill={color} fillOpacity={.1} connectNulls={false} isAnimationActive={false}/>:<Line dataKey="value" stroke={color} strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false}/>}</ComposedChart></ResponsiveContainer></div>;
}
function MicroChart({metric}:{metric:ActivityMetric}){return <WidgetSpark className="activity-microchart" values={metric.values} label={`${metric.title} through this workout; expand for scale and values`} color={metric.color} reverse={metric.pace}/>;}
function MetricCard({metric,step,comparison}:{metric:ActivityMetric;step:unknown;comparison:ReturnType<typeof sessionTrend>}){
 const hasChart=metric.values.some(finite),rows=metric.values.map((value,i)=>({x:finite(step)?i*step/60:i,value}));
 return <section className={`activity-glance-card${hasChart?' has-microchart':''}`}><header><h3><i style={{background:metric.color}}/>{metric.title}</h3><ExpandButton title={metric.title}><div className="activity-expanded-sensor"><div className="activity-expanded-value"><strong style={{color:metric.color}}>{metric.value}</strong> {metric.unit}<small>{metric.note}</small></div><p>{metric.explanation}</p>{comparison?.metric===metric.id&&<><TrendBadge trend={comparison.trend} caption={comparison.comparison}/><p>{comparison.explanation}</p></>}{hasChart&&<SensorChart rows={rows} title={metric.title} unit={metric.unit} color={metric.color} step={step} pace={metric.pace} area={metric.id==='altitude'} expanded/>}</div></ExpandButton></header><div className="activity-glance-value"><strong style={{color:metric.color}}>{metric.value}</strong><span>{metric.unit}</span></div><p>{metric.note}</p>{comparison?.metric===metric.id&&<TrendBadge trend={comparison.trend} caption={comparison.metric==='vo2max'?(comparison.comparison.startsWith('median')?'vs 28-day median':'vs prior session'):'vs similar session'}/>}{hasChart&&<MicroChart metric={metric}/>}</section>;
}
const ordinal=(n:number)=>`${n}${n%100>=11&&n%100<=13?'th':['th','st','nd','rd'][n%10]??'th'}`;
const clockOf=(seconds:number)=>{const s=Math.round(seconds),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60,p=(n:number)=>String(n).padStart(2,'0');return h?`${h}:${p(m)}:${p(r)}`:`${m}:${p(r)}`};
type Records=ReturnType<typeof workoutRecords>;
function recordText(r:Records[number],family:string){
 const foot=family!=='cycling'&&family!=='swimming';
 if(r.kind==='power')return [`${Math.round(r.value)} W`,`+${Math.round(r.value-r.previous)} W on your best`];
 if(r.kind==='speed')return foot?[`${paceFromSpeed(r.value)} /km`,`${Math.round(1000/r.previous-1000/r.value)} s/km faster than your best`]:[`${(r.value*3.6).toFixed(1)} km/h`,`+${((r.value-r.previous)*3.6).toFixed(1)} km/h on your best`];
 if(r.kind==='distance')return [`${(r.value/1000).toFixed(1)} km`,`+${((r.value-r.previous)/1000).toFixed(1)} km on your longest`];
 return [`+${Math.round(r.value)} m`,`+${Math.round(r.value-r.previous)} m on your biggest`];
}
// The route and its efforts, climbs and laps share a cursor: moving along the
// chart moves a dot on the map, and tapping the route marks that moment on the chart.
function RouteSections({detail,hasRoute,intensity,pushedBy,routeSelection,onRouteSelection,mapRef,attempts,segmentNote,onSelect,family}:{attempts:ReturnType<typeof routeAttempts>;segmentNote?:(mode:string,start:number,end:number)=>string|null;onSelect?:(activity:Workout)=>void;family:string;detail:Workout&{seriesSampled?:{data?:Record<string,unknown>}};hasRoute:boolean;intensity:ReturnType<typeof intensityLevels>;pushedBy:string;routeSelection:RouteSelection|null;onRouteSelection?:(selection:RouteSelection|null)=>void;mapRef?:Ref<HTMLDivElement>}){
 const [hover,setHover]=useState<number|null>(null),[picked,setPicked]=useState<number|null>(null),frame=useRef(0);
 const onCursor=useCallback((index:number|null)=>{cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>setHover(index))},[]);
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 const cursor=hover??picked;
 return <section className="workout-route-analysis" aria-label="Route and sections">
  {hasRoute&&<div ref={mapRef} className="workout-route-map"><RouteMap detail={detail} selection={routeSelection} intensity={intensity?.levels} cursorIndex={cursor??undefined} onPick={setPicked} compact/><ExpandButton title="Recorded route"><RouteMap detail={detail} selection={routeSelection} intensity={intensity?.levels}/></ExpandButton><a className="workout-route-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>{intensity&&<p className="workout-route-legend" aria-label={`Route coloured by ${pushedBy}, easy to hardest`}><span>Easy</span>{intensityColors.map(c=><i key={c} style={{background:c}}/>)}<span>Hard · {pushedBy}</span></p>}</div>}
  {attempts&&<details className="route-attempts"><summary><span>Same route as {attempts.count-1} earlier {({cycling:'ride',running:'run',walking:'walk',hiking:'hike'} as Record<string,string>)[family]??'session'}{attempts.count>2?'s':''}<small>{attempts.rank===1?`Your fastest of ${attempts.count}`:`${ordinal(attempts.rank)} fastest of ${attempts.count} · ${clockOf(attempts.behind)} off your best`}</small></span></summary><ol>{attempts.attempts.filter((a,i)=>i<10||a.id===detail.id).map(a=><li key={a.id}>{a.id===detail.id?<div className="is-current" data-rank={attempts.attempts.indexOf(a)+1}><span>This one</span><b>{clockOf(a.summary!.duration as number)}</b></div>:<button type="button" data-rank={attempts.attempts.indexOf(a)+1} onClick={()=>onSelect?.(a as Workout)}><span>{new Date(a.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span><b>{clockOf(a.summary!.duration as number)}</b></button>}</li>)}</ol>{attempts.count>10&&<p className="route-attempts-more">Showing your 10 fastest of {attempts.count}</p>}</details>}
  {detail.seriesSampled?.data&&<ActivityProfile key={`profile-${detail.id}`} detail={detail} compact onSelection={onRouteSelection} onCursor={hasRoute?onCursor:undefined} pickedIndex={picked} segmentNote={segmentNote}/>}
 </section>;
}
export default function ActivitySummary({detail,loading,history=[],onClassify,healthData,token='',storageScope='',isDemo=false,onSelect,onRouteSelection,routeSelection=null,mapRef}:{onRouteSelection?:(selection:RouteSelection|null)=>void;routeSelection?:RouteSelection|null;mapRef?:Ref<HTMLDivElement>;onClassify?:(label:string|null)=>void;detail:Workout&Record<string,any>;loading:boolean;history?:Workout[];healthData?:AthleteData;token?:string;storageScope?:string;isDemo?:boolean;onSelect?:(activity:Workout)=>void}){
 const {cards,other,family}=useMemo(()=>activityMetrics(detail),[detail]),step=detail.seriesSampled?.sampleSize,comparison=useMemo(()=>sessionTrend(detail,history),[detail,history]),vo2=useMemo(()=>vo2Trend(detail,history),[detail,history]);
 // Every recorded measure as a square, swim pace per 100 m; extra unlabelled sensors stay under Raw data.
 // The temperature square says what the weather cost, against your similar sessions in other temperatures.
 const heat=useMemo(()=>heatEffect(detail,history),[detail,history]);
 const squares=useMemo(()=>{const swim=family==='swimming'?swimPace(detail.summary):null;return (['Session','Technique','Conditions'] as const).flatMap(group=>cards.filter(m=>m.group===group&&m.value!=='—').map(m=>m.id==='speed'&&swim?swim:m.id==='temperature'&&heat?{...m,note:heatNote(heat)}:m))},[cards,family,detail.summary,heat]);
 // The athlete's own Tredict heart-rate zones as they were on the workout's day.
 const ownZones=zoneVersionAt(detail.cyclingContext?.tredictZones,family,detail.date);
 const lat=detail.seriesSampled?.data?.positionLat,hasRoute=Array.isArray(lat)&&lat.some(finite);
 // This workout's route, climbs and bests in the stored format, recomputed when older.
 const {attempts,records,climbRanks}=useMemo(()=>{
  const evidence=detail.evidence?.routeVersion===ROUTE_VERSION?detail.evidence:workoutEvidence(detail),me={...detail,evidence} as HistoryWorkout,past=history as HistoryWorkout[];
  return {attempts:evidence.route?routeAttempts(me as Parameters<typeof routeAttempts>[0],past):null,records:workoutRecords(me,past),climbRanks:(evidence.climbs??[]).map(c=>({at:c.at,rank:climbAttempts(c,me,past)}))};
 },[detail,history]);
 const segmentNote=useCallback((mode:string,start:number)=>{if(mode!=='climbs')return null;const r=climbRanks.find(c=>Math.abs(c.at-start*60)<=45)?.rank;return r?`${ordinal(r.rank)} of ${r.count}${r.behind>0?` · ${clockOf(r.behind)} off best`:' · your best'}`:null},[climbRanks]);
 const intensity=useMemo(()=>hasRoute?intensityLevels(detail,family):null,[detail,family,hasRoute]),pushedBy=intensity?.sensor==='power'?'power':intensity?.sensor==='heartrate'?'heart rate':['running','walking','hiking','swimming'].includes(family)?'pace':'speed';
 // Summary: where and when you pushed (map, efforts, climbs, laps), every number as a square, running economy; the rest folds away.
 return <div className="activity-scroll-summary compact-activity activity-glance">
 {family==='strength_training'&&<StrengthSummary detail={detail} history={history}/>}
 {family!=='strength_training'&&(hasRoute||detail.seriesSampled?.data)&&<RouteSections attempts={attempts} segmentNote={segmentNote} onSelect={onSelect} family={family} detail={detail} hasRoute={hasRoute} intensity={intensity} pushedBy={pushedBy} routeSelection={routeSelection} onRouteSelection={onRouteSelection} mapRef={mapRef}/>}
 {records.length>0&&<section className="workout-records" aria-labelledby="workout-records-title"><h3 id="workout-records-title">New records</h3><ul>{records.map(r=>{const [value,delta]=recordText(r,family);return <li key={r.id}><strong>{r.label} · {value}</strong><small>{delta}</small></li>})}</ul></section>}
 {squares.length>0&&<section className="workout-squares" aria-labelledby="workout-squares-title"><h3 id="workout-squares-title">Workout data</h3><div className="workout-square-grid">{squares.map(metric=><MetricCard key={metric.id} metric={metric} step={step} comparison={metric.id==='vo2max'?vo2:comparison}/>)}</div></section>}
 {family==='cycling'&&<Pedalling detail={detail}/>}
 {family!=='strength_training'&&<ZoneStrip summary={detail.summary??{}} histogram={detail.hrHistogram} zones={ownZones?.bands}/>}
 {family==='running'&&<RunningTechnique key={`technique-${detail.id}`} detail={detail} history={history} loading={loading}/>}
 {detail.notes&&<p className="plan-notes">{detail.notes}</p>}
 <details className="workout-more-fold"><summary><span>More analysis<small>Splits, zones, replay, deep analysis, session type</small></span></summary><section className="workout-more" aria-label="More analysis">
 {family!=='strength_training'&&<DeferredPanel className="activity-extra-sensors" summary={<span>Splits<small>{family==='cycling'?'Every 5 km':family==='swimming'?'Every 100 m':'Every kilometre'}</small></span>}><WorkoutSplits detail={detail} family={family}/></DeferredPanel>}
 <DeferredPanel className="activity-extra-sensors" summary={<span>Time in zones<small>Heart rate & power</small></span>}><ActivityZones summary={detail.summary??{}} loading={loading} zones={ownZones?.bands} histogram={detail.hrHistogram} zonesSince={ownZones?.since}/></DeferredPanel>
 <DeferredPanel className="activity-extra-sensors workout-explorer-fold" summary={<span>Explore workout<small>{family==='cycling'?'Replay · terrain · coasting · compare':family==='running'?'Replay · fingerprint · terrain · compare':'Laps · recovery'}</small></span>}><WorkoutExplorer detail={detail} history={history} healthData={healthData} token={token} storageScope={storageScope} isDemo={isDemo}/></DeferredPanel>
 {family==='cycling'&&<DeferredPanel className="activity-extra-sensors" summary={<span>Deep analysis<small>Efficiency, power & durability</small></span>}><CyclingAnalysis detail={detail} history={history}/></DeferredPanel>}
 {family==='running'&&<DeferredPanel className="activity-extra-sensors" summary={<span>Deep analysis<small>Running pace & repeats</small></span>}><RunningAnalysis detail={detail}/></DeferredPanel>}
 <DeferredPanel className="activity-extra-sensors" summary={<span>Execution<small>Repeat consistency & fading</small></span>}><IntervalConsistency key={detail.id} detail={detail}/><ActivityLaps detail={detail}/></DeferredPanel>
 {!loading&&!detail.mergedIds&&<DeferredPanel className="activity-extra-sensors" summary={<span>Session type<small>Label & coaching notes</small></span>}><SessionIntelligence key={`intelligence-${detail.id}`} detail={detail} onClassify={onClassify}/></DeferredPanel>}
 <DeferredPanel className="activity-extra-sensors" summary={<span>Previous & next sessions<small>Gaps and context around this one</small></span>}><WorkoutContext detail={detail} history={history} healthData={healthData} onSelect={onSelect}/></DeferredPanel>
 {other.length>0&&<details className="activity-extra-sensors"><summary><span>{other.length} more recorded sensors<small>Shown under Telemetry and Raw data</small></span></summary><div className="workout-other-sensors">{other.map(key=><span key={key}>{key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase())}</span>)}</div></details>}
 <RecordedFields detail={detail}/>
 {detail.recordedSource==='COROS FIT'&&<a className="docs-link" href={'/api/coros/file?id='+encodeURIComponent(detail.id)}>Download original COROS FIT ↗</a>}
 </section></details></div>;
}
