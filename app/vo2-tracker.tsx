"use client";
import {useMemo,useState} from 'react';
import {ResponsiveContainer,ComposedChart,Line,Scatter,CartesianGrid,XAxis,YAxis,Tooltip,Legend} from 'recharts';
import type {AthleteData} from './analytics';
import './vo2-tracker.css';
import {vo2Points,vo2Trendline,vo2Summary,corosVo2History,TREDICT_VO2_LABEL,COROS_VO2_LABEL,VO2_WINDOW_DAYS,VO2_MIN_RUNS} from './vo2-tracking';

const DAY=86400000;
const one=(v:number|null|undefined)=>v===null||v===undefined?'—':v.toLocaleString('en-GB',{maximumFractionDigits:1,minimumFractionDigits:1});
const day=(t:number)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short'});

type TooltipEntry={dataKey?:unknown;name?:unknown;value?:unknown;color?:string;payload?:{t?:number;title?:string}};
// Series values only: the scatter's x value is a timestamp and is not shown.
function Vo2Tooltip({active,payload}:{active?:boolean;payload?:readonly TooltipEntry[]}){
 const rows=(payload??[]).filter(p=>['run','trend','coros'].includes(String(p.dataKey))&&typeof p.value==='number');
 if(!active||!rows.length)return null;
 const t=rows[0].payload?.t,title=rows.find(r=>r.dataKey==='run')?.payload?.title;
 return <div className="vo2-tooltip"><strong>{typeof t==='number'?day(t):''}{title?` · ${title}`:''}</strong>{rows.map(r=><span key={String(r.dataKey)} style={{color:r.color}}>{String(r.name)}: {one(r.value as number)}</span>)}</div>;
}

export default function Vo2Tracker({data,isDemo}:{data:AthleteData;isDemo:boolean}){
 const [days,setDays]=useState(180);
 const [opened]=useState(()=>Date.now()),now=isDemo?Date.parse('2026-09-17T23:59:59'):opened;
 const points=useMemo(()=>vo2Points(data.activities),[data.activities]);
 const summary=useMemo(()=>vo2Summary(points,now),[points,now]);
 const coros=useMemo(()=>corosVo2History(data.extra?.coros?.fitnessHistory),[data.extra?.coros?.fitnessHistory]);
 const corosNow=data.extra?.coros?.fitness?.vo2max;
 const rows=useMemo(()=>{
  const start=now-days*DAY;
  const runs=vo2Trendline(points).filter(p=>p.t>start&&p.t<=now).map(p=>({t:p.t,run:p.value,trend:p.trend,title:p.title}));
  const watch=coros.filter(c=>c.t>start&&c.t<=now).map(c=>({t:c.t,coros:c.value}));
  return [...runs,...watch].sort((a,b)=>a.t-b.t);
 },[points,coros,days,now]);
 if(!points.length)return <div className="expanded-snapshot"><p>No Tredict run VO₂ estimates yet. Tredict adds one to running activities with heart rate; connect Tredict in Account to track them.</p>{typeof corosNow==='number'&&<p>{COROS_VO2_LABEL}: <strong>{corosNow}</strong> ml/kg/min.</p>}</div>;
 const change=summary.change;
 return <>
  <details className="snapshot-method"><summary>About this tracking</summary><p>Each dot is Tredict’s VO₂ estimate from one run. The line is the median of your runs over the previous {VO2_WINDOW_DAYS} days (at least {VO2_MIN_RUNS} runs), so a single hot, hilly or tired run does not move it much. {COROS_VO2_LABEL} is your watch’s own assessment from a different model, shown dashed for reference; the two rarely match exactly.</p></details>
  <div className="expanded-numbers vo2-numbers">
   <div><span>Latest run</span><strong>{one(summary.latest?.value)}</strong><small>{summary.latest?day(summary.latest.t):'No runs'}</small></div>
   <div><span>{VO2_WINDOW_DAYS}-day median</span><strong>{one(summary.current.median)}</strong><small>{summary.current.count} {summary.current.count===1?'run':'runs'}{summary.current.median===null?` · needs ${VO2_MIN_RUNS}`:''}</small></div>
   <div><span>vs previous {VO2_WINDOW_DAYS} days</span><strong className={change===null?undefined:change>=0.5?'positive-value':change<=-0.5?'negative-value':undefined}>{change===null?'—':`${change>0?'+':''}${one(change)}`}</strong><small>{change===null?'Not enough runs':'ml/kg/min'}</small></div>
   <div><span>Best · 12 months</span><strong>{one(summary.best?.value)}</strong><small>{summary.best?day(summary.best.t):'—'}</small></div>
   {typeof corosNow==='number'&&<div><span>{COROS_VO2_LABEL}</span><strong>{corosNow}</strong><small>current · different model</small></div>}
  </div>
  <div className="expanded-controls"><span>ml/kg/min · {summary.runs} runs with an estimate in 12 months</span><select aria-label="Chart period" value={days} onChange={e=>setDays(+e.target.value)}>{[90,180,365,730].map(d=><option key={d} value={d}>{d<365?`${d} days`:d===365?'12 months':'24 months'}</option>)}</select></div>
  <div className="expanded-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{left:0,right:18,top:15,bottom:10}}>
   <CartesianGrid stroke="#e5e5e5" vertical={false}/>
   <XAxis dataKey="t" type="number" scale="time" domain={[now-days*DAY,now]} tickFormatter={day} minTickGap={40} tick={{fontSize:12}}/>
   <YAxis domain={['dataMin - 2','dataMax + 2']} tickFormatter={(v:number)=>String(Math.round(v))} tick={{fontSize:12}} width={36}/>
   <Tooltip content={Vo2Tooltip}/>
   <Legend wrapperStyle={{fontSize:12}}/>
   <Scatter name={TREDICT_VO2_LABEL} dataKey="run" fill="#a78bfa" isAnimationActive={false}/>
   <Line name={`${VO2_WINDOW_DAYS}-day median · Tredict`} dataKey="trend" stroke="#6d28d9" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false}/>
   {coros.length>0&&<Line name={COROS_VO2_LABEL} dataKey="coros" type="stepAfter" stroke="#0f766e" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false}/>}
  </ComposedChart></ResponsiveContainer></div>
  <p className="lab-note">Compare runs of the same kind: easy flat runs give the steadiest estimates. Missing estimates (runs without heart rate, other sports) are left out rather than filled in.</p>
 </>;
}
