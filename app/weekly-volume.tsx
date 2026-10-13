"use client";
import './overview-styles.css';
import {useMemo,useState,lazy,Suspense} from 'react';
const WeeklyVolumeDetail=lazy(()=>import('./weekly-volume-detail'));
import {Footprints,Bike,Dumbbell,ArrowUpRight} from 'lucide-react';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {useExpand} from './expansion';
import {weeklyVolume,type VolumeMetric} from './weekly-volume-data';
import type {AthleteData} from './analytics';
const sports=[{key:'running',label:'Running',Icon:Footprints},{key:'cycling',label:'Cycling',Icon:Bike},{key:'strength_training',label:'Strength',Icon:Dumbbell}];
type VolumeChart=ReturnType<typeof weeklyVolume>;
const fmt=(v:number|null)=>v===null?'—':v.toLocaleString('en-GB',{maximumFractionDigits:1});
function changeLabel(c:VolumeChart){const d=c.comparison;if(d.direction==='unavailable')return '—';if(d.direction==='flat')return '→ 0%';const arrow=d.direction==='up'?'↑':'↓';return `${arrow} ${d.percent===null?fmt(Math.abs(d.absolute!))+' '+c.unit:Math.abs(d.percent).toLocaleString('en-GB',{maximumFractionDigits:0})+'%'}`}
function VolumeBars({chart,sport}:{chart:VolumeChart;sport:string}){
 const width=180,baseline=56,max=Math.max(1,...chart.rows.map(row=>row.value??0)),step=width/chart.rows.length,barWidth=Math.min(15,step*.66);
 const history=chart.rows.map(row=>`${row.label}: ${fmt(row.value)} ${chart.unit}${row.incomplete?' · incomplete data':''}${row.current?' · week in progress':''}`).join('; ');
 return <svg className="volume-bars" viewBox={`0 0 ${width} 60`} preserveAspectRatio="none" role="img" aria-label={`${sport} weekly history. ${history}. Solid bars: complete weeks. Outlined bar: this week. Dashed outlines: incomplete data. Gaps: unknown.`}>
  <line className="volume-baseline" x1="0" x2={width} y1={baseline} y2={baseline}/>
  {chart.rows.map((row,index)=>{
   const x=step*index+(step-barWidth)/2,height=row.value===null?0:Math.max(row.value>0?2:1,row.value/max*48);
   return <g key={row.start} className={`${row.current?'is-current ':''}${row.incomplete?'is-incomplete':''}`}><title>{row.label} – {row.end}: {fmt(row.value)} {chart.unit}{row.incomplete?' · incomplete data':''}{row.current?' · week in progress':''}</title>{row.value===null?<line className="volume-unknown" x1={x+barWidth*.25} x2={x+barWidth*.75} y1="44" y2="44"/>:<rect className="volume-bar" x={x} y={baseline-height} width={barWidth} height={height} rx={Math.min(2,height/2)}/>}</g>;
  })}
 </svg>;
}
export default function WeeklyVolume({data,now}:{data:AthleteData;now:Date}){
 const [weeks,setWeeks]=useState(8),[metric,setMetric]=useState<VolumeMetric>('sport'),expand=useExpand(),timestamp=now.getTime();
 const charts=useMemo(()=>sports.map(s=>({sport:s,chart:weeklyVolume(data,new Date(timestamp),s.key,weeks,metric)})),[data,timestamp,weeks,metric]),current=charts[0].chart.current;
 const date=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
 function open(s:typeof sports[number],chart:VolumeChart){expand.widget(`${s.label} · weekly volume`,<Suspense fallback={<p role="status">Loading weekly volume…</p>}><WeeklyVolumeDetail chart={chart} color="#5147df" change={changeLabel(chart)}/></Suspense>)}
 return <section className="weekly-volume weekly-volume-modern" aria-label="Weekly training volume">
  <header>
   <div className="volume-heading"><h2>Weekly volume</h2><span>{date(current.start)} – {date(current.end)} · so far</span></div>
   <div className="volume-controls"><NativeSelect size="sm" aria-label="Weekly volume metric" value={metric} onChange={e=>setMetric(e.target.value as VolumeMetric)}><NativeSelectOption value="sport">Sport volume</NativeSelectOption><NativeSelectOption value="hours">Hours</NativeSelectOption><NativeSelectOption value="sessions">Sessions</NativeSelectOption></NativeSelect><NativeSelect size="sm" aria-label="Weeks displayed" value={weeks} onChange={e=>setWeeks(+e.target.value)}>{[8,12,26].map(n=><NativeSelectOption key={n} value={n}>{n} weeks</NativeSelectOption>)}</NativeSelect></div>
  </header>
  <div className="weekly-volume-list">{charts.map(({sport:s,chart})=><button type="button" className="weekly-volume-row" key={s.key} onClick={()=>open(s,chart)} aria-label={`${s.label}: ${fmt(chart.current.value)} ${chart.unit} this week so far${chart.current.incomplete?', incomplete data':''}. ${chart.current.sessions} sessions. ${chart.comparison.direction==='unavailable'?'Comparison unavailable':changeLabel(chart)+' compared with the same point last week'}. Previous four-week average: ${fmt(chart.average)} ${chart.unit}. Open weekly volume details.`}>
   <div className="volume-summary"><span className="volume-sport"><s.Icon size={15} aria-hidden="true"/>{s.label}<ArrowUpRight size={12} className="volume-open" aria-hidden="true"/></span><strong className="volume-total">{fmt(chart.current.value)}<small>{chart.unit==='sessions'?(chart.current.value===1?'session':'sessions'):chart.unit}</small></strong><span className="volume-sessions">{chart.current.incomplete?'Partial data':`${chart.current.sessions} ${chart.current.sessions===1?'session':'sessions'}`}</span></div>
   <div className="volume-history"><VolumeBars chart={chart} sport={s.label}/><div className="volume-history-foot"><span>{chart.rows[0].label}</span><span>This week</span></div></div>
   <div className="volume-comparison"><span className="volume-change">{chart.comparison.direction==='unavailable'?'No comparison':changeLabel(chart)}</span>{chart.comparison.direction!=='unavailable'&&<span>vs last week</span>}</div>
  </button>)}</div>
  <p className="volume-comparison-note"><span className="volume-outline-key" aria-hidden="true"/>This week so far<span>Changes vs same point last week</span></p>
 </section>
}
