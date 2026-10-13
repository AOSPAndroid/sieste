'use client';
import {useState} from 'react';
import {Moon,Sunrise,Clock3} from 'lucide-react';
import {lateBedtime} from './sleep-insights-data';
import {sleepTiming,clockLabel} from './sleep-timing-data';
type Timing=ReturnType<typeof sleepTiming>;
const sleepDuration=(hours:number)=>{const minutes=Math.round(hours*60);return `${Math.floor(minutes/60)}h${String(minutes%60).padStart(2,'0')}`};
export default function SleepWindowChart({data,onSelect,selectedDate}:{data:Timing;onSelect?:(date:string)=>void;selectedDate?:string}){
 const [selected,setSelected]=useState('');
 const choose=(date:string)=>{setSelected(date);onSelect?.(date)};
 const rows=data.rows.map(r=>{let bed=r.bed===null?null:r.bed%1440,wake=r.wake===null?null:r.wake%1440;if(bed!==null&&bed<720)bed+=1440;if(wake!==null&&bed!==null&&wake<=bed)wake+=1440;return {...r,bed,wake}}),valid=rows.filter(r=>r.bed!==null&&r.wake!==null);
 const active=rows.find(r=>r.date===(selectedDate??selected))??rows.find(r=>r.date===data.latest?.date)??rows.at(-1),dense=rows.length>7;
 const lo=Math.floor(Math.min(1200,...valid.map(r=>r.bed!))/60)*60,hi=Math.ceil(Math.max(2160,...valid.map(r=>r.wake!))/60)*60,y=(v:number)=>12+(v-lo)/(hi-lo)*214,x=(i:number)=>40+(i+.5)*312/rows.length,bw=Math.min(27,224/rows.length);
 const path=(key:'bed'|'wake')=>{let connected=false;return rows.map((r,i)=>{if(r.bed===null||r.wake===null){connected=false;return ''}const command=connected?'L':'M';connected=true;return `${command}${x(i)},${y(r[key]!)}`}).join(' ')};
 const label=(r:typeof rows[number])=>`${r.date}: bedtime ${r.bed===null?'not recorded':clockLabel(r.bed)}, wake time ${r.wake===null?'not recorded':clockLabel(r.wake)}${r.hours===null?'':`, ${sleepDuration(r.hours)} asleep`}${r.bed!==null&&lateBedtime(r.bed)?', after midnight':''}`;
 return <div className="sleep-window-plot">
  <div className="sleep-window-selection"><span>{active?.date??'Selected night'}</span><small>Selected night</small></div>
  <div className="sleep-window-readout" aria-live="polite">
   <div><small><Clock3 aria-hidden="true"/> Asleep</small><strong>{active?.hours==null?'—':sleepDuration(active.hours)}</strong></div>
   <div><small><Moon aria-hidden="true"/> Bedtime</small><strong>{active?.bed==null?'—':clockLabel(active.bed)}</strong></div>
   <div><small><Sunrise aria-hidden="true"/> Wake up</small><strong>{active?.wake==null?'—':clockLabel(active.wake)}</strong></div>
  </div>
  <div className="sleep-window-timeline" data-dense={dense}>
   <svg viewBox="0 0 360 270" role="group" aria-label="Recorded sleep windows. Each column is a night, from bedtime to wake time. Tap a column to select that night. Missing clock times stay as gaps.">
    {Array.from({length:Math.floor((hi-lo)/120)+1},(_,i)=>lo+i*120).map(t=><g key={t}><line x1="40" x2="352" y1={y(t)} y2={y(t)} className="sleep-window-grid"/><text x="32" y={y(t)+4} textAnchor="end" className="sleep-window-axis">{clockLabel(t)}</text></g>)}
    <line x1="40" x2="352" y1={y(1440)} y2={y(1440)} className="sleep-window-midnight"/>
    {rows.map((r,i)=>{const pair=r.bed!==null&&r.wake!==null;return <g key={r.date} role="button" tabIndex={0} aria-pressed={active?.date===r.date} aria-label={label(r)} onClick={()=>choose(r.date)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(r.date)}}}>
     <rect x={x(i)-156/rows.length} y="3" width={312/rows.length} height="264" rx="8" className="sleep-window-column"/>
     <title>{label(r)}</title>
     {pair?<><rect x={x(i)-bw/2} y={y(r.bed!)} width={bw} height={Math.max(1,y(r.wake!)-y(r.bed!))} rx={dense?2:5} className="sleep-window-range"/><circle cx={x(i)} cy={y(r.bed!)} r={lateBedtime(r.bed!)?3.5:2.5} className={lateBedtime(r.bed!)?'sleep-window-late':'sleep-window-bed-dot'}/><circle cx={x(i)} cy={y(r.wake!)} r="2.5" className="sleep-window-wake-dot"/></>:<line x1={x(i)-Math.min(6,bw/2)} x2={x(i)+Math.min(6,bw/2)} y1={y(1920)} y2={y(1920)} className="sleep-window-missing"/>}
     {(rows.length<=7||i%4===0||i===rows.length-1)&&<><text x={x(i)} y="244" textAnchor="middle" className="sleep-window-day">{new Date(r.date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'})}</text><text x={x(i)} y="261" textAnchor="middle" className="sleep-window-date">{r.label.slice(0,2)}</text></>}
    </g>})}
    <path pointerEvents="none" d={path('bed')} className="sleep-window-bed-line"/><path pointerEvents="none" d={path('wake')} className="sleep-window-wake-line"/>
   </svg>
  </div>
  <div className="sleep-window-caption"><p>{valid.length?'Tap a night · window includes awake time':'Bedtime and wake times have not been recorded for this period.'}</p>{valid.some(r=>lateBedtime(r.bed!))&&<span><i/> After midnight</span>}</div>
 </div>;
}
