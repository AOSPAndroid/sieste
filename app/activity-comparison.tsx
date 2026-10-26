'use client';
import {useEffect,useId,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {Workout} from './analytics';
import {sportFamily,sportName} from './sports';
import {activityComparison,activityMetricPath,activityMetricPosition,formatActivityMetric,type ActivityMetricKey} from './activity-comparison-data';
import {Card,CardHeader,CardTitle,CardDescription,CardAction,CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription} from '@/components/ui/empty';
import './activity-comparison.css';

const day=(date:string)=>new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const time=(date:string)=>new Date(date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
type Model=ReturnType<typeof activityComparison>;
type Series=Model['series'];
function MetricPlot({model,series,active,onActive}:{model:Model;series:Series;active:Workout;onActive:(id:string)=>void}){
 const svg=useRef<SVGSVGElement>(null),points=useRef<(SVGGElement|null)[]>([]),[width,setWidth]=useState(640),description=useId();
 useEffect(()=>{const node=svg.current;if(!node)return;const measure=()=>setWidth(Math.max(180,Math.round(node.getBoundingClientRect().width)));measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect()},[]);
 const height=226,left=series.length===1?52:32,right=18,top=12,bottom=30,plotWidth=width-left-right,plotHeight=height-top-bottom,n=model.rows.length,step=plotWidth/Math.max(1,n-1);
 const x=(i:number)=>n===1?left+plotWidth/2:left+i*step,y=(value:number)=>top+plotHeight*(1-value/100),labelEvery=Math.max(1,Math.ceil(64/step));
 const activeIndex=model.rows.findIndex(a=>a.id===active.id),only=series.length===1?series[0]:null;
 const label=(index:number)=>`${day(model.rows[index].date)} ${time(model.rows[index].date)} · ${model.rows[index].title??sportName(sportFamily(model.rows[index]))}. ${series.map(s=>`${s.label}: ${s.values[index]===null?'not recorded':formatActivityMetric(s.key,s.values[index])+(s.key==='duration'?'':' '+s.unit)}`).join('. ')}`;
 return <svg className="activity-comparison-plot" ref={svg} viewBox={`0 0 ${width} ${height}`} height={height} width="100%" role="group" aria-label="Activity metrics comparison chart" aria-describedby={description}>
  <desc id={description}>Sessions in date order. {only?only.label+' in '+only.unit:'Each metric uses its own recorded range, from 0 to 100 percent; exact readings appear below'}. Missing readings break the lines. Use the arrow keys to inspect sessions.</desc>
  {[0,25,50,75,100].map(tick=><g key={tick} className="activity-comparison-axis"><line x1={left} x2={width-right} y1={y(tick)} y2={y(tick)}/>{(!only||only.max!==only.min||tick===50)&&<text x={left-8} y={y(tick)+3} textAnchor="end">{only?formatActivityMetric(only.key,only.min+(only.max-only.min)*tick/100):tick+'%'}</text>}</g>)}
  <line x1={x(activeIndex)} x2={x(activeIndex)} y1={top} y2={height-bottom} className="activity-comparison-cursor"/>
  {model.rows.map((a,i)=><g key={a.id} ref={node=>{points.current[i]=node}} role="button" tabIndex={activeIndex===i?0:-1} aria-pressed={activeIndex===i} aria-label={label(i)} onFocus={()=>onActive(a.id)} onPointerEnter={()=>onActive(a.id)} onClick={()=>onActive(a.id)} onKeyDown={event=>{
   const next=event.key==='ArrowRight'?Math.min(n-1,i+1):event.key==='ArrowLeft'?Math.max(0,i-1):event.key==='Home'?0:event.key==='End'?n-1:null;
   if(next!==null){event.preventDefault();points.current[next]?.focus();onActive(model.rows[next].id);}else if(event.key===' '||event.key==='Enter'){event.preventDefault();onActive(a.id);}
  }}><title>{label(i)}</title><rect className="activity-comparison-hit" x={n===1?left:i===0?left:x(i)-step/2} y={top-4} width={n===1?plotWidth:i===0||i===n-1?step/2:step} height={plotHeight+8}/>
   {(n===1||i===0||i===n-1||i%labelEvery===0&&i<=n-1-labelEvery)&&<text className="activity-comparison-date" x={x(i)} y={height-8} textAnchor={n===1?'middle':i===0?'start':i===n-1?'end':'middle'}>{day(a.date)}</text>}
  </g>)}
  <g pointerEvents="none">{series.map(s=>{
   const point=(i:number)=>({x:x(i),y:y(activityMetricPosition(s.values[i],s.min,s.max)!)});
   return <g key={s.key} data-series={s.key} style={{color:s.color}}><path d={activityMetricPath(s.values,point)} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={s.dash} strokeLinejoin="round"/>{s.values.map((value,i)=>value===null?null:<circle key={model.rows[i].id} cx={point(i).x} cy={point(i).y} r={activeIndex===i?4:2.5} fill="currentColor" stroke="var(--card)" strokeWidth={1.5}/>)}</g>;
  })}</g>
 </svg>;
}

export default function ActivityComparison({activities,month,onSelect}:{activities:Workout[];month:string;onSelect:(activity:Workout)=>void}){
 const sports=useMemo(()=>Array.from(new Set(activities.filter(a=>Number.isFinite(Date.parse(a.date))).map(sportFamily))).sort(),[activities]);
 const [chosenSport,setSport]=useState('running'),family=sports.includes(chosenSport)?chosenSport:sports.includes('running')?'running':sports[0]??'running';
 const model=useMemo(()=>activityComparison(activities,family),[activities,family]),[chosen,setChosen]=useState<ActivityMetricKey[]|null>(null),[activeId,setActive]=useState('');
 const defaults:ActivityMetricKey[]=['vo2','heartrate',family==='cycling'?'power':'pace'];
 const keys=chosen??(model.series.some(s=>defaults.includes(s.key))?defaults:model.series.slice(0,1).map(s=>s.key));
 const selected=model.series.filter(s=>keys.includes(s.key)),active=model.rows.find(a=>a.id===activeId)??model.rows.at(-1),activeIndex=active?model.rows.indexOf(active):-1;
 const monthLabel=new Date(month+'-01T12:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
 return <Card size="sm" className="activity-comparison" role="region" aria-label="Activity comparison">
  <CardHeader><CardTitle><h2>Activity comparison</h2></CardTitle><CardDescription>{monthLabel} · {model.rows.length} {sportName(family).toLowerCase()} sessions</CardDescription><CardAction>{sports.length>0&&<NativeSelect size="sm" value={family} onChange={e=>{setSport(e.target.value);setChosen(null);setActive('')}} aria-label="Comparison sport">{sports.map(s=><NativeSelectOption key={s} value={s}>{sportName(s)}</NativeSelectOption>)}</NativeSelect>}</CardAction></CardHeader>
  <CardContent className="flex min-w-0 flex-col gap-3">
   {model.series.length>0?<>
    <div className="activity-comparison-controls"><ToggleGroup type="multiple" variant="outline" size="sm" spacing={1} className="flex-wrap" value={selected.map(s=>s.key)} onValueChange={value=>setChosen(value as ActivityMetricKey[])} aria-label="Overlay activity metrics">{model.series.map(s=><ToggleGroupItem key={s.key} value={s.key} title={`${s.label} · ${s.unit} · ${s.count}/${model.rows.length} recorded`}><i aria-hidden="true" style={{'--metric-color':s.color} as CSSProperties}/>{s.label}</ToggleGroupItem>)}</ToggleGroup><Button variant="ghost" size="sm" aria-label="Overlay all available metrics" onClick={()=>setChosen(model.series.map(s=>s.key))}>All</Button></div>
    {selected.length&&active?<>
     <div className="activity-comparison-scale">{selected.length===1?`${selected[0].label} · ${selected[0].unit}`:'Each metric uses its own scale · 0–100% of its recorded range'}</div>
     <MetricPlot model={model} series={selected} active={active} onActive={setActive}/>
     <div className="activity-comparison-inspection"><div className="activity-comparison-session"><span><b>{day(active.date)} · {time(active.date)}</b> · {active.title??sportName(family)}</span><Button variant="ghost" size="sm" onClick={()=>onSelect(active)}>View session ↗</Button></div><dl className="activity-comparison-readings" aria-live="polite">{selected.map(s=><div key={s.key} style={{'--metric-color':s.color} as CSSProperties} title={`Recorded range: ${formatActivityMetric(s.key,s.min)}–${formatActivityMetric(s.key,s.max)} ${s.unit}`}><dt><i aria-hidden="true"/>{s.label}</dt><dd>{formatActivityMetric(s.key,s.values[activeIndex])}{s.values[activeIndex]!==null&&s.key!=='duration'&&<small>{s.key==='pace'?'/km':s.unit}</small>}</dd></div>)}</dl></div>
     <p className="activity-comparison-note">Tap a session or use ← → to inspect. Gaps are missing readings.{selected.some(s=>s.key==='pace')?' Lower pace means faster.':''} {model.rows.length===1?'Only one session matches these filters.':'Uses all matching sessions in this month.'}</p>
    </>:<Empty><EmptyHeader><EmptyTitle>Choose metrics to compare</EmptyTitle><EmptyDescription>Turn on one or more metrics above to overlay them.</EmptyDescription></EmptyHeader></Empty>}
   </>:<Empty><EmptyHeader><EmptyTitle>No recorded metrics to compare</EmptyTitle><EmptyDescription>Try another month, sport or activity filter.</EmptyDescription></EmptyHeader></Empty>}
  </CardContent>
 </Card>;
}
