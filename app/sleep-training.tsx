"use client";
import RecoveryResponse from './recovery-response';
import {useMemo} from 'react';
import type {AthleteData} from './analytics';
import {sleepTraining} from './sleep-training-data';
import {clockLabel} from './sleep-timing-data';
import {localDate} from './week-overview';
import {useExpand} from './expansion';
const hours=(v:number|null)=>v===null?'—':`${Math.floor(Math.round(v*60)/60)}h${String(Math.round(v*60)%60).padStart(2,'0')}`;

export default function SleepTraining({data,end,days}:{data:AthleteData;end:string;days:number}){
 const d=useMemo(()=>sleepTraining(data,end,days),[data,end,days]),expand=useExpand(),max=Math.max(1,...d.rows.map(r=>r.load??0));
 const weekday=new Intl.DateTimeFormat('en-GB',{weekday:'short'}),today=localDate(new Date());
 return <section className="sleep-training recovery-ledger">
  <header><h2>Training → recovery</h2><small>{d.rows[0]?.label} – {d.rows.at(-1)?.label}</small></header>
  <div className="sleep-training-scroll"><div className="sleep-training-matrix" style={{gridTemplateColumns:`48px repeat(${days},minmax(30px,1fr))`,minWidth:days>7?days*44+48:undefined}}>
   <div className="sleep-training-labels"><span>Morning</span><span>Load<small>prev. day</small></span><span>Sleep</span><span>HRV<small>ms</small></span><span>RHR<small>bpm</small></span></div>
   {d.rows.map(r=><button className={r.date===today?'is-today':undefined} key={r.date} aria-label={`Recovery on ${r.date}, training on ${r.prior}`} onClick={()=>expand.widget(`Training → recovery · ${r.label}`,<div className="sleep-pair-detail">
    <p><b>Training · {r.prior}</b></p><p>{r.load===null?'Load unavailable':`${Math.round(r.load)} recorded load`} · {r.sessions.length} recorded sessions{r.duration===null?'':` · ${hours(r.duration/3600)}`}</p>
    {r.sessions.map((a:any)=><p key={a.id}>{a.title??a.sport??'Workout'} · {typeof a.summary?.duration==='number'?hours(a.summary.duration/3600):'Duration unavailable'}{typeof a.summary?.distance==='number'?` · ${(a.summary.distance/1000).toFixed(2)} km`:''}{typeof a.summary?.heartrate==='number'?` · ${Math.round(a.summary.heartrate)} bpm`:''}{typeof a.summary?.calories==='number'&&Number.isFinite(a.summary.calories)?` · ${Math.round(a.summary.calories)} kcal`:''}</p>)}
    <p><b>Night ending {r.date}</b> · {hours(r.hours)} asleep</p><p>{r.bed===null?'—':clockLabel(r.bed)} → {r.wake===null?'—':clockLabel(r.wake)} · {r.awake??'—'} min awake · score {r.score??'—'}</p>
    <p>HRV {r.hrv??'—'} ms · {r.hrvStatus?.label??'No reading'}</p><p>{r.hrvStatus?.reason}</p>
    <p>Resting HR {r.rhr??'—'} bpm · {r.rhrStatus?.label??'No reading'}</p><p>{r.rhrStatus?.reason}</p>
    <p>These observations are paired by date, not proof that a workout caused a recovery change. RHR is a daily reading. No new recovery score is calculated.</p>
   </div>)}>
    <span className="sleep-pair-date"><small>{weekday.format(new Date(r.date+'T12:00:00'))}</small><time dateTime={r.date}>{Number(r.date.slice(-2))}</time></span>
    <span className="sleep-pair-load" title={`Training on ${r.prior}: ${r.load===null?'load unavailable':Math.round(r.load)+' points'}`}><i aria-hidden="true" style={{height:r.load!==null&&r.load>0?Math.max(2,r.load/max*24):0}}/><b>{r.load===null?'—':Math.round(r.load)}</b></span>
    <span className={`status-${r.sleepStatus?.tone??'neutral'}`} title={r.sleepStatus?.reason}>{hours(r.hours)}</span>
    <span className={`status-${r.hrvStatus?.tone??'neutral'}`} title={r.hrvStatus?.reason}>{r.hrv===null?'—':Math.round(r.hrv)}</span>
    <span className={`status-${r.rhrStatus?.tone??'neutral'}`} title={r.rhrStatus?.reason}>{r.rhr===null?'—':Math.round(r.rhr)}</span>
   </button>)}
  </div></div>
  <div className="sleep-training-summary"><span>{d.paired?<>HRV in range <b>{d.inRange}/{d.paired}</b> paired mornings</>:'No paired HRV readings'}</span><small>Previous-day load · wake-up readings</small></div>
  <RecoveryResponse data={data} end={end}/>
  <details><summary>Sleep & HRV associations</summary>{d.associations.map(a=><div className="sleep-association" key={a.label}><b>{a.label}</b>{a.values.map((v,i)=><span key={i}>{a.groups[i]}: <strong>{v.mean===null?'—':Math.round(v.mean)+' ms'}</strong> <small>{v.count} nights</small></span>)}</div>)}<p>Last {Math.max(days,28)} calendar days. At least 3 paired nights per group; missing readings are excluded. These unadjusted comparisons do not establish cause or account for illness, training intensity or other factors.</p></details>
 </section>;
}
