"use client";
import {useEffect,useRef,useState} from 'react';
import type {loadAnalysis} from './load-analysis-data';
import {loadOverlays,loadPrimaryCeiling,formatLoadOverlay,defaultLoadLayers} from './load-chart-series';
type Model=ReturnType<typeof loadAnalysis>;

/** Small overview only; the expanded view retains the full interactive chart. */
export default function CompactLoadChart({model,layers=defaultLoadLayers,onHover,activeIso}:{model:Model;layers?:string[];onHover:(row:Model['rows'][number]|null)=>void;activeIso?:string}){
 const chart=useRef<SVGSVGElement>(null),[width,setWidth]=useState(520),height=180,left=42,right=8,top=12,bottom=28;
 useEffect(()=>{const node=chart.current;if(!node)return;const measure=()=>setWidth(Math.max(200,Math.round(node.getBoundingClientRect().width)));measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect()},[]);
 const plotWidth=width-left-right,plotHeight=height-top-bottom;
 const ceiling=loadPrimaryCeiling(model),step=plotWidth/Math.max(1,model.rows.length),labelEvery=Math.max(1,Math.ceil(44/step)),overlays=loadOverlays(model).filter(series=>layers.includes(series.key));
 const y=(value:number)=>top+plotHeight*(1-value/ceiling);
 const path=(key:'short'|'long'|'minutes'|'sleep'|'hrv',maximum:number)=>{let connected=false;return model.rows.map((row,i)=>{const value=row[key];if(value===null||value===undefined){connected=false;return '';}const command=connected?'L':'M';connected=true;return `${command}${left+step*i+step/2},${top+plotHeight*(1-value/maximum)}`}).join(' ')};
 return <svg ref={chart} viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-label="Training and recovery by date; overlay lines use separate scales. Focus a day for its actual readings" onMouseLeave={()=>onHover(null)}>
  {[0,1,2,3,4].map(i=>{const value=ceiling*i/4;return <g key={i}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} stroke="#ececf1" strokeDasharray="2 4"/><text x={left-7} y={y(value)+3} textAnchor="end" fontSize={10} fill="#777">{Math.round(value)}</text></g>})}
  {model.baseline!==null&&<line x1={left} x2={width-right} y1={y(model.baseline)} y2={y(model.baseline)} stroke="#64748b" strokeDasharray="4 4"/>}
  {model.rows.map((row,i)=>{const x=left+step*i+step/2,today=row.iso===model.today.iso,barWidth=Math.min(22,step*.7),label=`${row.label}: ${row.value===null?'Missing reading':row.value.toLocaleString('en-GB',{maximumFractionDigits:1})+' '+model.unit}${today?' · training so far':''} · ${row.sessions} sessions${overlays.map(series=>' · '+series.label+' '+formatLoadOverlay(series.key,row[series.key])).join('')}`;return <g key={row.iso} tabIndex={0} role="img" aria-label={label} onFocus={()=>onHover(row)} onBlur={()=>onHover(null)} onMouseEnter={()=>onHover(row)} onPointerDown={()=>onHover(row)} style={{outlineOffset:2}}>
   <title>{label}</title><rect x={left+step*i} y={top} width={step} height={plotHeight} fill="transparent"/>
   {layers.includes('value')&&row.value!==null&&<rect x={x-barWidth/2} y={y(row.value)} width={barWidth} height={Math.max(0,plotHeight*(row.value/ceiling))} rx={3} fill={today?'#e0e7ff':row.iso>=model.recent[0].iso?'#a5b4fc':'#c7d2fe'} stroke={today?'#6366f1':undefined} strokeDasharray={today?'3 2':undefined}/>}
   {(i===0||i===model.rows.length-1||i%labelEvery===0&&i<=model.rows.length-1-labelEvery)&&<text x={x} y={height-8} textAnchor="middle" fontSize={10} fill="#777">{row.label}</text>}
  </g>})}
  <g pointerEvents="none">{layers.includes('short')&&<path d={path('short',ceiling)} fill="none" stroke="#4f46e5" strokeWidth={2}/>}{layers.includes('long')&&<path d={path('long',ceiling)} fill="none" stroke="#64748b" strokeDasharray="3 4"/>}
  {overlays.map(series=><g key={series.key} data-series={series.key}><path d={path(series.key,series.ceiling)} fill="none" stroke={series.color} strokeWidth={2} strokeDasharray={series.dash} strokeLinejoin="round"/>{model.rows.map((row,i)=>row[series.key]===null||row[series.key]===undefined?null:<circle key={row.iso} cx={left+step*i+step/2} cy={top+plotHeight*(1-row[series.key]!/series.ceiling)} r={1.8} fill={series.color}/>)}</g>)}
  {activeIso&&model.rows.some(row=>row.iso===activeIso)&&<line x1={left+step*model.rows.findIndex(row=>row.iso===activeIso)+step/2} x2={left+step*model.rows.findIndex(row=>row.iso===activeIso)+step/2} y1={top} y2={top+plotHeight} stroke="#64748b" strokeDasharray="2 3"/>}</g>
 </svg>;
}
