"use client";
import {useState} from 'react';
import {intervalConsistency} from './training-coach-data';
import {sportFamily,runningPace} from './sports';
import {valueTrend} from './trend';
import TrendBadge from './trend-badge';
const labels:Record<string,string>={pace:'Pace',power:'Power',heartrate:'HR',cadence:'Cadence',stepLength:'Step length'};
export default function IntervalConsistency({detail}:{detail:any}){
 const [selected,setSelected]=useState<number[]>([]),family=sportFamily(detail),laps=detail.laps??[];
 if(!['running','cycling'].includes(family)||laps.length<3)return null;
 const result=intervalConsistency(laps,selected,family);
 const format=(key:string,v:number|null)=>v===null?'—':key==='pace'?runningPace(v):`${Math.round(v)} ${key==='power'?'W':key==='heartrate'?'bpm':key==='stepLength'?'cm':family==='cycling'?'rpm':'spm'}`;
 return <details className="coach-intervals"><summary>Repeat consistency <span>Select work laps to compare ↗</span></summary><p>Select only comparable work repeats. Leave warm-up, recovery and cool-down unchecked.</p><div className="coach-lap-picker">{laps.map((_:any,i:number)=><button key={i} aria-pressed={selected.includes(i)} onClick={()=>setSelected(v=>v.includes(i)?v.filter(j=>j!==i):[...v,i])}>Lap {i+1}</button>)}</div>{result.reason?<p>{result.reason}</p>:<><strong className={result.firstFade!==null?'trend-watch':'trend-steady'}>{result.firstFade!==null?`First output drop >3%: lap ${result.firstFade+1}`:'No output drop >3% in selected repeats'}</strong><div className="coach-grid">{result.changes.map(c=><div className="coach-tile" key={c.key}><span>{labels[c.key]}</span><strong>{format(c.key,c.first)} → {format(c.key,c.last)}</strong><TrendBadge trend={valueTrend(c.last,c.first,c.key==='pace'?'lower':c.key==='power'?'higher':'neutral',`last ${result.n} vs first ${result.n} selected laps`)}/></div>)}</div><p>Last {result.n} versus first {result.n} work laps. HR, cadence and step-length changes describe movement; their direction alone does not establish fatigue. Hills and intentional pacing can explain output changes.</p></>}</details>;
}
