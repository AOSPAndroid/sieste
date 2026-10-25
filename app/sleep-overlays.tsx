import type {Overlay,OverlayKey,Finding,sleepPeriod} from './sleep-overlays-data';
import {clockLabel} from './sleep-timing-data';

type Row=ReturnType<typeof sleepPeriod>['rows'][number];
const hours=(v:number|null)=>v===null?'—':`${Math.floor(Math.round(v*60)/60)}h${String(Math.round(v*60)%60).padStart(2,'0')}`;

/** Which reading to lay over the sleep chart; the automatic pick says why it was chosen. */
export function SleepOverlayPicker({overlays,value,onChange,reason,date}:{overlays:Overlay[];value:OverlayKey|'none';onChange:(key:OverlayKey|'none')=>void;reason:string|null;date?:string}){
 if(!overlays.length)return null;
 // The selected night's reading, so the overlay can be read without counting gridlines.
 const shown=overlays.find(o=>o.key===value),i=shown&&date?shown.dates.indexOf(date):-1,v=shown&&i>=0?shown.values[i]:null;
 const reading=shown&&date?`${new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',timeZone:'UTC'})}: ${v===null?'no reading':`${Math.round(v)}${shown.unit==='%'?'%':shown.unit?' '+shown.unit:''}`}`:null;
 return <div className="sleep-overlay-picker">
  <div role="group" aria-label="Overlay on the sleep chart">{[{key:'none' as const,label:'Sleep only',color:'#94a3b8'},...overlays].map(o=><button key={o.key} type="button" aria-pressed={value===o.key} onClick={()=>onChange(o.key)}><i style={{background:o.color}}/>{o.label}</button>)}</div>
  {(reading||reason)&&<small>{reading&&<b>{shown!.label} · {reading}</b>}{reading&&reason?' · ':''}{reason}{shown?.ranges.some(Boolean)?' · shaded: your normal range':''}</small>}
 </div>;
}

/** Everything known about one night: score, stages, awake time, morning readings and the day before. */
export function SleepNightCard({row,night}:{row:Row|undefined;night:{score?:unknown;deepPercent?:unknown;lightPercent?:unknown;remPercent?:unknown;awakeMinutes?:unknown}}){
 if(!row)return null;
 const stages=[['Deep',night.deepPercent,'#4f46e5'],['Light',night.lightPercent,'#a5b4fc'],['REM',night.remPercent,'#38bdf8']] as const,known=stages.filter(([,v])=>typeof v==='number'&&v>0);
 const status=(s:{label?:string;tone?:string}|null|undefined)=>s?<small className={`status-${s.tone}`}>{s.label}</small>:null;
 return <section className="sleep-night-card" aria-label={`Night ending ${row.date}`}>
  <div className="sleep-night-stats">
   <span><small>Score</small><b>{typeof night.score==='number'?night.score:'—'}</b></span>
   <span><small>Awake</small><b>{typeof night.awakeMinutes==='number'?`${night.awakeMinutes} min`:'—'}</b></span>
   <span><small>HRV</small><b>{row.hrv===null?'—':`${Math.round(row.hrv)} ms`}</b>{status(row.hrvStatus)}</span>
   <span><small>Resting HR</small><b>{row.rhr===null?'—':`${Math.round(row.rhr)} bpm`}</b>{status(row.rhrStatus)}</span>
  </div>
  {known.length>0&&<div className="sleep-night-stages"><div className="sleep-stage-stack" role="img" aria-label={known.map(([l,v])=>`${l} ${v}%`).join(', ')}>{known.map(([l,v,c])=><i key={l} style={{width:`${v}%`,background:c}}/>)}</div><ul>{known.map(([l,v,c])=><li key={l}><i style={{background:c}}/>{l} <b>{v as number}%</b></li>)}</ul></div>}
  <p className="sleep-night-day">{row.sessions.length?<>Day before: {row.sessions.map((a:{id:string;title?:string;sportType?:string})=>a.title||a.sportType||'Workout').join(', ')}{row.load!==null?` · load ${Math.round(row.load)}`:''}{row.duration!==null?` · ${hours(row.duration/3600)}`:''}</>:'Rest day before'}{row.bed!==null?` · in bed ${clockLabel(row.bed)}`:''}</p>
 </section>;
}

export function SleepFindings({findings}:{findings:Finding[]}){
 if(!findings.length)return null;
 return <section className="sleep-findings" aria-label="What stands out"><h2>What stands out</h2><ul>{findings.map(f=><li key={f.id} data-tone={f.tone}>{f.text}</li>)}</ul></section>;
}
