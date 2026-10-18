"use client";
import {useMemo,useState} from 'react';
import {ResponsiveContainer,ComposedChart,Line,Scatter,CartesianGrid,XAxis,YAxis,Tooltip,Legend} from 'recharts';
import type {AthleteData} from './analytics';
import './vo2-tracker.css';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {useExpand} from './expansion';
import {vo2Points,vo2Sports,vo2Trendline,vo2Summary,corosVo2History,COROS_VO2_LABEL,VO2_WINDOW_DAYS,VO2_MIN_RUNS,type Vo2Sport} from './vo2-tracking';

const DAY=86400000;
const one=(v:number|null|undefined)=>v===null||v===undefined?'—':v.toLocaleString('en-GB',{maximumFractionDigits:1,minimumFractionDigits:1});
const word=(sport:Vo2Sport,plural=false)=>(sport==='running'?'run':'ride')+(plural?'s':'');
const seriesLabel=(sport:Vo2Sport)=>(sport==='running'?'Run':'Ride')+' VO₂ · Tredict';
const day=(t:number)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short'});

type TooltipEntry={dataKey?:unknown;name?:unknown;value?:unknown;color?:string;payload?:{t?:number;title?:string}};
// Series values only: the scatter's x value is a timestamp and is not shown.
function Vo2Tooltip({active,payload}:{active?:boolean;payload?:readonly TooltipEntry[]}){
 const rows=(payload??[]).filter(p=>['run','trend','coros'].includes(String(p.dataKey))&&typeof p.value==='number');
 if(!active||!rows.length)return null;
 const t=rows[0].payload?.t,title=rows.find(r=>r.dataKey==='run')?.payload?.title;
 return <div className="vo2-tooltip"><strong>{typeof t==='number'?day(t):''}{title?` · ${title}`:''}</strong>{rows.map(r=><span key={String(r.dataKey)} style={{color:r.color}}>{String(r.name)}: {one(r.value as number)}</span>)}</div>;
}

export default function Vo2Tracker({data,isDemo,compact=false,initialSport}:{data:AthleteData;isDemo:boolean;compact?:boolean;initialSport?:Vo2Sport}){
 const expand=useExpand();
 const sports=useMemo(()=>vo2Sports(data.activities),[data.activities]);
 const [chosen,setSport]=useState<Vo2Sport|undefined>(initialSport);
 const sport:Vo2Sport=chosen&&sports.includes(chosen)?chosen:sports[0]??'running';
 const [range,setDays]=useState(180),days=compact?90:range;
 const [opened]=useState(()=>Date.now()),now=isDemo?Date.parse('2026-09-17T23:59:59'):opened;
 const points=useMemo(()=>vo2Points(data.activities,sport),[data.activities,sport]);
 const summary=useMemo(()=>vo2Summary(points,now),[points,now]);
 // COROS VO₂ max is a running assessment, so it is only a reference for runs.
 const coros=useMemo(()=>sport==='running'?corosVo2History(data.extra?.coros?.fitnessHistory):[],[data.extra?.coros?.fitnessHistory,sport]);
 const corosNow=sport==='running'?data.extra?.coros?.fitness?.vo2max:undefined;
 const rows=useMemo(()=>{
  const start=now-days*DAY;
  const runs=vo2Trendline(points).filter(p=>p.t>start&&p.t<=now).map(p=>({t:p.t,run:p.value,trend:p.trend,title:p.title}));
  const watch=coros.filter(c=>c.t>start&&c.t<=now).map(c=>({t:c.t,coros:c.value}));
  return [...runs,...watch].sort((a,b)=>a.t-b.t);
 },[points,coros,days,now]);
 if(!sports.length){
  if(compact)return null;
  return <div className="expanded-snapshot"><p>No Tredict VO₂ estimates yet. Tredict adds one to sessions with heart rate; connect Tredict in Account to track them.</p>{typeof data.extra?.coros?.fitness?.vo2max==='number'&&<p>{COROS_VO2_LABEL}: <strong>{data.extra.coros.fitness.vo2max}</strong> ml/kg/min.</p>}</div>;
 }
 const change=summary.change,toneClass=change===null?undefined:change>=0.5?'positive-value':change<=-0.5?'negative-value':undefined;
 const picker=sports.length>1&&<ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={sport} onValueChange={v=>{if(v==='running'||v==='cycling')setSport(v)}} aria-label="VO₂ estimates from"><ToggleGroupItem value="running">Runs</ToggleGroupItem><ToggleGroupItem value="cycling">Rides</ToggleGroupItem></ToggleGroup>;
 const chart=<ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={compact?{left:-8,right:8,top:8,bottom:0}:{left:0,right:18,top:15,bottom:10}}>
   <CartesianGrid stroke="#e5e5e5" vertical={false}/>
   <XAxis dataKey="t" type="number" scale="time" domain={[now-days*DAY,now]} tickFormatter={day} minTickGap={40} tick={{fontSize:compact?11:12}}/>
   <YAxis domain={['dataMin - 2','dataMax + 2']} tickFormatter={(v:number)=>String(Math.round(v))} tick={{fontSize:compact?11:12}} width={36}/>
   <Tooltip content={Vo2Tooltip}/>
   {!compact&&<Legend wrapperStyle={{fontSize:12}}/>}
   <Scatter name={seriesLabel(sport)} dataKey="run" fill="#a78bfa" isAnimationActive={false}/>
   <Line name={`${VO2_WINDOW_DAYS}-day median · Tredict`} dataKey="trend" stroke="#6d28d9" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false}/>
   {coros.length>0&&<Line name={COROS_VO2_LABEL} dataKey="coros" type="stepAfter" stroke="#0f766e" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false}/>}
  </ComposedChart></ResponsiveContainer>;
 if(compact)return <section className="fatigue-recovery vo2-home" aria-label="VO₂ tracker"><header><h2>VO₂ · Tredict</h2><button onClick={()=>expand.widget('VO₂ · Tredict',<Vo2Tracker data={data} isDemo={isDemo} initialSport={sport}/>)}>Track ↗</button></header>
  {picker&&<div className="vo2-home-picker">{picker}</div>}
  <div className="vo2-home-numbers">
   <div><small>Latest {word(sport)}</small><strong>{one(summary.latest?.value)}</strong><span>{summary.latest?day(summary.latest.t):'—'}</span></div>
   <div><small>{VO2_WINDOW_DAYS}-day median</small><strong>{one(summary.current.median)}</strong><span>{summary.current.count} {word(sport,summary.current.count!==1)}</span></div>
   <div><small>vs prior {VO2_WINDOW_DAYS} days</small><strong className={toneClass}>{change===null?'—':`${change>0?'+':''}${one(change)}`}</strong><span>ml/kg/min</span></div>
  </div>
  <div className="vo2-home-chart">{chart}</div>
  <p className="vo2-home-note">Dots: each {word(sport)} · line: {VO2_WINDOW_DAYS}-day median{coros.length?' · dashed: VO₂ max · COROS':''}. Last 90 days.</p>
 </section>;
 return <>
  {picker&&<div className="expanded-controls">{picker}</div>}
  <details className="snapshot-method"><summary>About this tracking</summary><p>Each dot is Tredict’s VO₂ estimate from one {word(sport)}. The line is the median of your {word(sport,true)} over the previous {VO2_WINDOW_DAYS} days (at least {VO2_MIN_RUNS}), so a single hot, hilly or tired session does not move it much.{sport==='cycling'?' Ride estimates are kept separate from run estimates because they come from different inputs and usually differ.':` ${COROS_VO2_LABEL} is your watch’s own running assessment from a different model, shown dashed for reference; the two rarely match exactly.`}</p></details>
  <div className="expanded-numbers vo2-numbers">
   <div><span>Latest {word(sport)}</span><strong>{one(summary.latest?.value)}</strong><small>{summary.latest?day(summary.latest.t):'None yet'}</small></div>
   <div><span>{VO2_WINDOW_DAYS}-day median</span><strong>{one(summary.current.median)}</strong><small>{summary.current.count} {word(sport,summary.current.count!==1)}{summary.current.median===null?` · needs ${VO2_MIN_RUNS}`:''}</small></div>
   <div><span>vs previous {VO2_WINDOW_DAYS} days</span><strong className={toneClass}>{change===null?'—':`${change>0?'+':''}${one(change)}`}</strong><small>{change===null?`Not enough ${word(sport,true)}`:'ml/kg/min'}</small></div>
   <div><span>Best · 12 months</span><strong>{one(summary.best?.value)}</strong><small>{summary.best?day(summary.best.t):'—'}</small></div>
   {typeof corosNow==='number'&&<div><span>{COROS_VO2_LABEL}</span><strong>{corosNow}</strong><small>current · different model</small></div>}
  </div>
  <div className="expanded-controls"><span>ml/kg/min · {summary.runs} {word(sport,summary.runs!==1)} with an estimate in 12 months</span><select aria-label="Chart period" value={range} onChange={e=>setDays(+e.target.value)}>{[90,180,365,730].map(d=><option key={d} value={d}>{d<365?`${d} days`:d===365?'12 months':'24 months'}</option>)}</select></div>
  <div className="expanded-chart">{chart}</div>
  <p className="lab-note">Compare sessions of the same kind: easy, flat {word(sport,true)} give the steadiest estimates. Sessions without an estimate are left out rather than filled in.</p>
 </>;
}
