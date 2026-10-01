"use client";
import type {loadAnalysis} from './load-analysis-data';
type Model=ReturnType<typeof loadAnalysis>;

/** Small overview only; the expanded view retains the full interactive chart. */
export default function CompactLoadChart({model,onHover}:{model:Model;onHover:(row:Model['rows'][number]|null)=>void}){
 const width=520,height=170,left=42,right=8,top=12,bottom=28;
 const plotWidth=width-left-right,plotHeight=height-top-bottom;
 const maximum=Math.max(1,model.baseline??0,...model.rows.map(r=>r.value??0));
 const ceiling=Math.ceil(maximum/4)*4,step=plotWidth/Math.max(1,model.rows.length);
 const y=(value:number)=>top+plotHeight*(1-value/ceiling);
 return <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-label="Daily training values; focus a day for its reading" onMouseLeave={()=>onHover(null)}>
  {[0,1,2,3,4].map(i=>{const value=ceiling*i/4;return <g key={i}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} stroke="#ececf1" strokeDasharray="2 4"/><text x={left-7} y={y(value)+3} textAnchor="end" fontSize={10} fill="#777">{Math.round(value)}</text></g>})}
  {model.baseline!==null&&<line x1={left} x2={width-right} y1={y(model.baseline)} y2={y(model.baseline)} stroke="#64748b" strokeDasharray="4 4"/>}
  {model.rows.map((row,i)=>{const x=left+step*i+step/2,today=row.iso===model.today.iso,barWidth=Math.min(22,step*.7),label=`${row.label}: ${row.value===null?'Missing reading':row.value.toLocaleString('en-GB',{maximumFractionDigits:1})+' '+model.unit}${today?' · so far':''} · ${row.sessions} sessions`;return <g key={row.iso} tabIndex={0} role="img" aria-label={label} onFocus={()=>onHover(row)} onBlur={()=>onHover(null)} onMouseEnter={()=>onHover(row)} onPointerDown={()=>onHover(row)} style={{outlineOffset:2}}>
   <title>{label}</title><rect x={left+step*i} y={top} width={step} height={plotHeight} fill="transparent"/>
   {row.value!==null&&<rect x={x-barWidth/2} y={y(row.value)} width={barWidth} height={Math.max(0,plotHeight*(row.value/ceiling))} rx={3} fill={today?'#c7d2fe':row.iso>=model.recent[0].iso?'#6366f1':'#a5b4fc'} stroke={today?'#6366f1':undefined} strokeDasharray={today?'3 2':undefined}/>}
   {(i===0||i===model.rows.length-1||i%3===0)&&<text x={x} y={height-8} textAnchor="middle" fontSize={10} fill="#777">{row.label}</text>}
  </g>})}
 </svg>;
}
