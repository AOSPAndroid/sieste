"use client";
import {ResponsiveContainer,ComposedChart,Line,Bar,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine,Cell} from 'recharts';
import type {loadAnalysis} from './load-analysis-data';
import {loadOverlays,loadPrimaryCeiling} from './load-chart-series';
type Model=ReturnType<typeof loadAnalysis>;
export default function LoadChart({model,large,layers,onHover}:{model:Model;large:boolean;layers:string[];onHover:(row:Model['rows'][number]|null)=>void}){
 const overlays=loadOverlays(model).filter(series=>layers.includes(series.key));
 return <ResponsiveContainer width="100%" height="100%"><ComposedChart data={model.rows} margin={{left:-15,right:8,top:8,bottom:0}} onMouseMove={s=>{if(s.activeTooltipIndex!==undefined)onHover(model.rows[Number(s.activeTooltipIndex)]??null)}} onMouseLeave={()=>onHover(null)}>
  <CartesianGrid vertical={false} stroke="#ececf1" strokeDasharray="2 4"/><XAxis dataKey="label" tick={{fontSize:10}} minTickGap={38} axisLine={false} tickLine={false}/><YAxis yAxisId="training" domain={[0,loadPrimaryCeiling(model)]} width={44} tick={{fontSize:10}} axisLine={false} tickLine={false}/>
  {overlays.filter(series=>series.key!=='fatigue'||model.unit!=='points').map(series=><YAxis key={series.key} yAxisId={series.key} domain={[0,series.ceiling]} width={0} hide/>)}
  <Tooltip content={()=>null} cursor={{stroke:'#a5b4fc'}}/>{model.baseline!==null&&<ReferenceLine yAxisId="training" y={model.baseline} ifOverflow="extendDomain" stroke="#64748b" strokeDasharray="4 4"/>}
  {layers.includes('value')&&<Bar yAxisId="training" dataKey="value" fill="#c7d2fe" maxBarSize={large?16:22} radius={[3,3,0,0]} isAnimationActive={false}>{model.rows.map(r=><Cell key={r.iso} fill={r.iso===model.today.iso?'#e0e7ff':r.iso>=model.recent[0].iso?'#a5b4fc':'#c7d2fe'} stroke={r.iso===model.today.iso?'#6366f1':undefined} strokeDasharray={r.iso===model.today.iso?'3 2':undefined}/>)}</Bar>}
  {layers.includes('short')&&<Line yAxisId="training" dataKey="short" stroke="#4f46e5" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false}/>}
  {layers.includes('long')&&<Line yAxisId="training" dataKey="long" stroke="#64748b" strokeDasharray="3 4" dot={false} connectNulls={false} isAnimationActive={false}/>}
  {overlays.map(series=><Line key={series.key} yAxisId={series.key==='fatigue'&&model.unit==='points'?'training':series.key} dataKey={series.key} stroke={series.color} strokeWidth={2} strokeDasharray={series.dash} dot={{r:1.8,strokeWidth:0,fill:series.color}} activeDot={{r:4}} connectNulls={false} isAnimationActive={false}/>)}
 </ComposedChart></ResponsiveContainer>;
}
