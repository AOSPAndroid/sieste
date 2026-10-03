"use client";
import WidgetSpark from './widget-spark';
import {useState,lazy,Suspense,type CSSProperties} from 'react';
const WeeklyVolumeDetail=lazy(()=>import('./weekly-volume-detail'));
import {Footprints,Bike,Dumbbell} from 'lucide-react';
import {useExpand} from './expansion';
import {weeklyVolume,type VolumeMetric} from './weekly-volume-data';
import type {AthleteData} from './analytics';
const sports=[{key:'running',label:'Running',color:'#2563eb',Icon:Footprints},{key:'cycling',label:'Cycling',color:'#7c3aed',Icon:Bike},{key:'strength_training',label:'Strength',color:'#b76a08',Icon:Dumbbell}];
const fmt=(v:number|null)=>v===null?'—':v.toLocaleString('en-GB',{maximumFractionDigits:1});
function changeLabel(c:ReturnType<typeof weeklyVolume>){const d=c.comparison;if(d.direction==='unavailable')return '—';if(d.direction==='flat')return '→ 0%';const arrow=d.direction==='up'?'↑':'↓';return `${arrow} ${d.percent===null?fmt(Math.abs(d.absolute!))+' '+c.unit:Math.abs(d.percent).toLocaleString('en-GB',{maximumFractionDigits:0})+'%'}`}
export default function WeeklyVolume({data,now}:{data:AthleteData;now:Date}){
 const [weeks,setWeeks]=useState(8),[metric,setMetric]=useState<VolumeMetric>('sport'),expand=useExpand();
 const charts=sports.map(s=>({sport:s,chart:weeklyVolume(data,now,s.key,weeks,metric)})),current=charts[0].chart.current;
 const date=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
 function open(s:typeof sports[number],chart:ReturnType<typeof weeklyVolume>){expand.widget(`${s.label} · weekly volume`,<Suspense fallback={<p role="status">Loading weekly volume…</p>}><WeeklyVolumeDetail chart={chart} color={s.color} change={changeLabel(chart)}/></Suspense>)}
 return <section className="weekly-volume weekly-volume-modern" aria-label="Weekly training volume">
  <header>
   <div className="volume-heading"><h2>Weekly volume</h2><span>This week · {date(current.start)} – {date(current.end)}</span></div>
   <div className="volume-controls"><select aria-label="Weekly volume metric" value={metric} onChange={e=>setMetric(e.target.value as VolumeMetric)}><option value="sport">Sport volume</option><option value="hours">Hours</option><option value="sessions">Sessions</option></select><select aria-label="Weeks displayed" value={weeks} onChange={e=>setWeeks(+e.target.value)}>{[8,12,26].map(n=><option key={n} value={n}>{n} weeks</option>)}</select></div>
  </header>
  <div className="weekly-volume-list">{charts.map(({sport:s,chart})=><button className="weekly-volume-row" key={s.key} style={{'--volume-color':s.color} as CSSProperties} onClick={()=>open(s,chart)} aria-label={`${s.label}: ${fmt(chart.current.value)} ${chart.unit} this week${chart.current.incomplete?', partial data':''}. ${chart.current.sessions} sessions. ${chart.comparison.direction==='unavailable'?'Comparison unavailable':changeLabel(chart)+' compared with the same point last week'}. Previous four-week average: ${fmt(chart.average)} ${chart.unit}. Open weekly volume details.`}>
   <div className="volume-summary"><span className="volume-sport"><i><s.Icon size={15}/></i>{s.label}</span><strong className="volume-total">{fmt(chart.current.value)}<small>{chart.unit}</small></strong><span className="volume-sessions">{chart.current.sessions} {chart.current.sessions===1?'session':'sessions'}{chart.current.incomplete&&<span className="volume-coverage"> · Partial data</span>}</span></div>
   <div className="volume-history"><div className="volume-history-head"><span>vs same point last week</span><span className={`volume-change is-${chart.comparison.direction}`} title="Compared with the same elapsed portion of last week" aria-label={`${changeLabel(chart)} compared with the same point last week`}>{changeLabel(chart)}</span></div><WidgetSpark className="volume-trend" values={chart.rows.map(r=>r.value)} color={s.color} label={`${s.label} weekly ${chart.unit}, ${weeks} weeks. Hollow dots mark partial weeks.`} partial={chart.rows.map(r=>!!(r.current||r.incomplete))} pointLabels={chart.rows.map(r=>`${r.label}: ${fmt(r.value)} ${chart.unit}${r.incomplete?' · incomplete':r.current?' · week in progress':''}`)}/><div className="volume-history-foot"><span>{chart.rows[0].label} – Now</span><span>4w avg <b>{fmt(chart.average)} {chart.unit}</b></span></div></div>
  </button>)}</div>
 </section>
}
