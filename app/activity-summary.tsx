"use client";
import {useState,useRef,lazy,useMemo} from 'react';
import type {RouteSelection} from './route-geometry';
import DeferredPanel from './deferred-panel';
const CyclingAnalysis=lazy(()=>import('./cycling-analysis'));
const RunningAnalysis=lazy(()=>import('./running-analysis'));
import ActivityProfile from './activity-profile';
import RecordedFields from './recorded-fields';
import WidgetSpark from './widget-spark';
import SessionIntelligence from './session-intelligence';
import {ResponsiveContainer,ComposedChart,Line,Area,CartesianGrid,XAxis,YAxis,Tooltip} from 'recharts';
import RouteMap from './route-map';
import {ExpandButton} from './expansion';
const ActivityLaps=lazy(()=>import('./activity-laps'));
import ActivityZones from './activity-zones';
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
 return <section className={`activity-glance-card${hasChart?' has-microchart':''}`}><header><h3><i style={{background:metric.color}}/>{metric.title}</h3><ExpandButton title={metric.title}><div className="activity-expanded-sensor"><div className="activity-expanded-value"><strong style={{color:metric.color}}>{metric.value}</strong> {metric.unit}<small>{metric.note}</small></div><p>{metric.explanation}</p>{comparison?.metric===metric.id&&<><TrendBadge trend={comparison.trend} caption={comparison.comparison}/><p>{comparison.explanation}</p></>}{hasChart&&<SensorChart rows={rows} title={metric.title} unit={metric.unit} color={metric.color} step={step} pace={metric.pace} area={metric.id==='altitude'} expanded/>}</div></ExpandButton></header><div className="activity-glance-value"><strong style={{color:metric.color}}>{metric.value}</strong><span>{metric.unit}</span></div><p>{metric.note}</p>{comparison?.metric===metric.id&&<TrendBadge trend={comparison.trend} caption={comparison.metric==='vo2max'?'vs prior estimate':'vs similar session'}/>}{hasChart&&<MicroChart metric={metric}/>}</section>;
}
export default function ActivitySummary({detail,loading,history=[],onClassify}:{onClassify?:(label:string|null)=>void;detail:Record<string,any>;loading:boolean;history?:any[]}){
 const mapRef=useRef<HTMLDivElement>(null);
 const [routeSelection,setRouteSelection]=useState<RouteSelection|null>(null);
 const {cards,other,family}=useMemo(()=>activityMetrics(detail),[detail]),step=detail.seriesSampled?.sampleSize,comparison=useMemo(()=>sessionTrend(detail,history),[detail,history]),vo2=useMemo(()=>vo2Trend(detail,history),[detail,history]);
 return <div className="activity-scroll-summary compact-activity activity-glance">
 {['running','cycling','walking','hiking'].includes(family)&&<div className="activity-mini-map" ref={mapRef}><ExpandButton title="Recorded route"><RouteMap detail={detail} loading={loading} selection={routeSelection}/></ExpandButton><RouteMap detail={detail} loading={loading} selection={routeSelection}/></div>}
 {detail.seriesSampled?.data&&<ActivityProfile key={`profile-${detail.id}`} detail={detail} onSelection={setRouteSelection} onShowMap={()=>mapRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}/>}
 {detail.recordedSource==='COROS FIT'&&<a className="docs-link" href={'/api/coros/file?id='+encodeURIComponent(detail.id)}>Download original COROS FIT ↗</a>}<ActivityZones summary={detail.summary??{}} loading={loading}/>
 {family==='cycling'&&<DeferredPanel className="activity-extra-sensors" summary="Deep analysis · efficiency, power & durability"><CyclingAnalysis detail={detail} history={history}/></DeferredPanel>}

 {family==='running'&&<DeferredPanel className="activity-extra-sensors" summary="Deep analysis · running pace & repeats"><RunningAnalysis detail={detail}/></DeferredPanel>}
 <DeferredPanel className="activity-extra-sensors" summary="Lap table & consistency"><ActivityLaps detail={detail}/><IntervalConsistency key={detail.id} detail={detail}/></DeferredPanel>
 {!loading&&<SessionIntelligence key={`intelligence-${detail.id}`} detail={detail} onClassify={onClassify}/>}
 {(['Session','Technique','Conditions'] as const).map(group=>{const metrics=cards.filter(m=>m.group===group);return metrics.length>0&&<section className="activity-glance-group" key={group}><div className="activity-section-label"><h3>{group==='Session'?'Workout at a glance':group==='Technique'?'Movement & technique':'Terrain & conditions'}</h3><span>{group==='Session'?'↗ Details & charts':''}</span></div><div className="activity-glance-grid">{metrics.map(metric=><MetricCard key={metric.id} metric={metric} step={step} comparison={metric.id==='vo2max'?vo2:comparison}/>)}</div></section>})}
 {detail.notes&&<p className="plan-notes">{detail.notes}</p>}
 {other.length>0&&<details className="activity-extra-sensors"><summary>{other.length} additional recorded sensors</summary><p>Available under Telemetry and Raw data. No assumed units or generic averages.</p><div>{other.map(key=><span key={key}>{key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase())}</span>)}</div></details>}
 <RecordedFields detail={detail}/>
 <p className="activity-data-note">Micro charts show the whole workout; each has its own scale. Expand for units and values. Gaps are preserved. {detail.demo?'Illustrative demo.':''}</p></div>;
}
