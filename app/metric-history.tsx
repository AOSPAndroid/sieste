'use client';
import {useId} from 'react';
import {ResponsiveContainer,ComposedChart,Area,Line,Bar,Cell,XAxis,YAxis,Tooltip,CartesianGrid,ReferenceLine} from 'recharts';
import {clockLabel} from './sleep-timing-data';

type Point={date:string;value:number|null};
const dayLabel=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
export default function MetricHistory({title,unit,kind,points,days,onDays,today,partial}:{title:string;unit:string;kind:string;points:Point[];days:number;onDays:(days:number)=>void;today:string;partial:boolean}){
 const fillId='history-'+useId().replace(/:/g,'');
 const bars=['running','cycling','strength','time','steps','dailyCalories'].includes(kind),clock=['bed','wake'].includes(kind);
 const readings=points.filter((p):p is Point&{value:number}=>p.value!==null&&Number.isFinite(p.value));
 const complete=readings.filter(p=>!(partial&&p.date===today));
 const last=readings.at(-1),mean=complete.length?complete.reduce((s,p)=>s+p.value,0)/complete.length:null;
 const low=complete.length?Math.min(...complete.map(p=>p.value)):null,high=complete.length?Math.max(...complete.map(p=>p.value)):null;
 const format=(v:number)=>clock?clockLabel(v):kind==='threshold'?`${Math.floor(Math.round(v)/60)}:${String(Math.round(v)%60).padStart(2,'0')}`:kind==='prediction'?`${Math.floor(v/3600)}:${String(Math.floor(v/60)%60).padStart(2,'0')}:${String(Math.round(v)%60).padStart(2,'0')}`:unit==='h'?`${Math.floor(Math.round(v*60)/60)}h ${String(Math.round(v*60)%60).padStart(2,'0')}m`:v.toLocaleString('en-GB',{maximumFractionDigits:unit==='km'?2:1});
 const suffix=clock||unit==='h'||kind==='prediction'?'':kind==='threshold'?'/km':unit;
 const axis=(v:number)=>clock||kind==='threshold'||kind==='prediction'?format(v):Math.abs(v)>=1000?`${Number((v/1000).toFixed(1))}k`:Number(v.toFixed(1)).toString();
 return <section className="metric-history-chart history-redesign" aria-label={title+' recorded history'}>
  <header><div><h3>{title} history</h3><span>{dayLabel(points[0].date)} – {dayLabel(points.at(-1)!.date)} {today.slice(0,4)}</span></div><div className="history-periods" role="group" aria-label="Metric chart period">{[7,28,90,365].map(n=><button key={n} aria-pressed={days===n} onClick={()=>onDays(n)}>{n===365?'1y':n+'d'}</button>)}</div></header>
  <div className="history-numbers"><div><small>Latest · {last?dayLabel(last.date):'no reading'}{last&&partial&&last.date===today?' · partial':''}</small><strong>{last?format(last.value):'—'} <em>{suffix}</em></strong></div><div><small>Daily average</small><b>{mean===null?'—':format(mean)} <em>{suffix}</em></b></div><div><small>Recorded range</small><b>{low===null||high===null?'—':format(low)+' – '+format(high)} <em>{suffix}</em></b></div></div>
  {readings.length?<div className="history-plot"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={points} accessibilityLayer margin={{top:12,right:12,left:0,bottom:0}}>
   <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={.14}/><stop offset="100%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
   <CartesianGrid vertical={false} stroke="#ededf3"/>
   <XAxis dataKey="date" tickFormatter={dayLabel} minTickGap={36} tick={{fontSize:10,fill:'#777786'}} tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd"/>
   <YAxis width={clock||kind==='prediction'?58:44} tickCount={4} tick={{fontSize:10,fill:'#777786'}} tickLine={false} axisLine={false} domain={bars?[0,'auto']:['auto','auto']} tickFormatter={axis}/>
   <Tooltip filterNull={false} cursor={{stroke:'#a5a1e2',strokeDasharray:'3 4',fill:'#6366f108'}} content={({active,payload,label})=>{if(!active||!label)return null;const p=payload?.[0]?.payload as Point|undefined;return <div className="history-tooltip"><small>{dayLabel(String(label))} {String(label).slice(0,4)}</small><strong>{p?.value==null?'No reading':format(p.value)} <span>{p?.value==null?'':suffix}</span></strong>{partial&&label===today&&<small>Today · still in progress</small>}</div>}}/>
   {mean!==null&&<ReferenceLine y={mean} stroke="#a1a1b1" strokeDasharray="4 5"/>}
   {bars?<Bar dataKey="value" fill="#7770db" radius={[3,3,0,0]} maxBarSize={28} isAnimationActive={false}>{points.map(p=><Cell key={p.date} fill={p.date===today?'#5145cd':'#aaa5e9'} fillOpacity={partial&&p.date===today?.55:1}/>)}</Bar>:<><Area dataKey="value" stroke="none" fill={`url(#${fillId})`} connectNulls={false} isAnimationActive={false} tooltipType="none"/><Line dataKey="value" stroke="#6860cf" strokeWidth={2} strokeDasharray="2 4" dot={days<=28?{r:2.5,fill:'#6860cf',stroke:'#fff',strokeWidth:1.5}:false} activeDot={{r:5,fill:'#5145cd',stroke:'#fff',strokeWidth:2}} connectNulls={false} isAnimationActive={false}/></>}
  </ComposedChart></ResponsiveContainer></div>:<p className="history-empty">No recorded readings in this period. Try a longer window.</p>}
  <footer><span><i/>Daily average{partial?' · completed days':''}</span><span>{readings.length}/{points.length} days recorded</span></footer><p className="history-note">Tap a point to inspect · gaps are missing data{partial?' · today may still grow':''}. Average and range use recorded days{partial?', excluding today':''}; they are not a normal range.</p>
 </section>;
}
