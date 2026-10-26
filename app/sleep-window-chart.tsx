'use client';
import {useState} from 'react';
import {Moon,Sunrise,Clock3} from 'lucide-react';
import {lateBedtime} from './sleep-insights-data';
import {sleepTiming,clockLabel} from './sleep-timing-data';
import type {Overlay} from './sleep-overlays-data';
type Timing=ReturnType<typeof sleepTiming>;
const sleepDuration=(hours:number)=>{const minutes=Math.round(hours*60);return `${Math.floor(minutes/60)}h${String(minutes%60).padStart(2,'0')}`};
// overlay: one recovery or training reading per night, drawn on its own scale over the sleep windows.
export default function SleepWindowChart({data,onSelect,selectedDate,overlay=null}:{data:Timing;onSelect?:(date:string)=>void;selectedDate?:string;overlay?:Overlay|null}){
 const [selected,setSelected]=useState('');
 const choose=(date:string)=>{setSelected(date);onSelect?.(date)};
 const rows=data.rows.map(r=>{let bed=r.bed===null?null:r.bed%1440,wake=r.wake===null?null:r.wake%1440;if(bed!==null&&bed<720)bed+=1440;if(wake!==null&&bed!==null&&wake<=bed)wake+=1440;return {...r,bed,wake}}),valid=rows.filter(r=>r.bed!==null&&r.wake!==null);
 const active=rows.find(r=>r.date===(selectedDate??selected))??rows.find(r=>r.date===data.latest?.date)??rows.at(-1),dense=rows.length>7;
 const lo=Math.floor(Math.min(1200,...valid.map(r=>r.bed!))/60)*60,hi=Math.ceil(Math.max(2160,...valid.map(r=>r.wake!))/60)*60,y=(v:number)=>12+(v-lo)/(hi-lo)*214,x=(i:number)=>40+(i+.5)*312/rows.length,bw=Math.min(27,224/rows.length);
 // Overlay scale: readings and their normal range use the plot height, higher values at the top;
 // training load is a band of bars along the bottom so the sleep windows stay readable.
 const ov=overlay?rows.map(r=>{const i=overlay.dates.indexOf(r.date);return i<0?{v:null,range:null}:{v:overlay.values[i],range:overlay.ranges[i]}}):[];
 const ovValues=ov.flatMap(o=>[o.v,...(o.range??[])]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
 const ovLo=overlay?.key==='load'?0:ovValues.length?Math.min(...ovValues):0,ovHi=ovValues.length?Math.max(...ovValues):1,pad=(ovHi-ovLo||1)*.12,bars=overlay?.key==='load',oy=(v:number)=>bars?220-v/(ovHi||1)*70:220-(v-(ovLo-pad))/((ovHi+pad)-(ovLo-pad))*200;
 const outside=(o:{v:number|null;range:[number,number]|null})=>o.v!==null&&o.range!==null&&(o.v<o.range[0]||o.v>o.range[1]);
 const fmt=(v:number)=>overlay?.key==='load'?Math.round(v).toString():overlay?.unit==='%'?`${Math.round(v)}%`:Math.round(v).toString();
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
    {overlay&&<g key={overlay.key} className="sleep-overlay" pointerEvents="none" style={{color:overlay.color}} aria-hidden="true">
     {ov.map((o,i)=>o.range&&<rect key={'r'+i} x={x(i)-156/rows.length+2} width={312/rows.length-4} y={oy(o.range[1])} height={Math.max(1,oy(o.range[0])-oy(o.range[1]))} className="sleep-overlay-range"/>)}
     {overlay.key==='load'?ov.map((o,i)=>o.v!==null&&o.v>0&&<rect key={i} x={x(i)-Math.max(2,bw/4)} width={Math.max(4,bw/2)} y={oy(o.v)} height={220-oy(o.v)} rx="2" className="sleep-overlay-bar"/>)
      :<path d={ov.map((o,i)=>o.v===null?'':`${i&&ov[i-1].v!==null?'L':'M'}${x(i)},${oy(o.v)}`).join(' ')} className="sleep-overlay-line"/>}
     {overlay.key!=='load'&&ov.map((o,i)=>o.v!==null&&<circle key={'d'+i} cx={x(i)} cy={oy(o.v)} r={outside(o)?4.5:3} className={outside(o)?'sleep-overlay-dot is-outside':'sleep-overlay-dot'}/>)}
     {rows.length<=7&&ov.map((o,i)=>o.v!==null&&<text key={'t'+i} x={x(i)} y={oy(o.v)-8} textAnchor="middle" className="sleep-overlay-value">{fmt(o.v)}</text>)}
     {ovValues.length>0&&<><text x="356" y={oy(ovHi)+3} textAnchor="end" className="sleep-overlay-axis">{fmt(ovHi)}</text><text x="356" y={oy(overlay.key==='load'?0:ovLo)+3} textAnchor="end" className="sleep-overlay-axis">{fmt(overlay.key==='load'?0:ovLo)}</text></>}
    </g>}
   </svg>
  </div>
  <div className="sleep-window-caption"><p>{valid.length?'Tap a night · window includes awake time':'Bedtime and wake times have not been recorded for this period.'}</p>{valid.some(r=>lateBedtime(r.bed!))&&<span><i/> After midnight</span>}</div>
 </div>;
}
