"use client";
import {useMemo} from 'react';
import {ArrowUpRight} from 'lucide-react';
import type {AthleteData} from './analytics';
import {recoveryResponse} from './recovery-response-data';
import {clockLabel} from './sleep-timing-data';
import {useExpand} from './expansion';
const num=(v:number|null)=>v===null?'—':Math.round(v).toString();
export default function RecoveryResponse({data,end}:{data:AthleteData;end:string}){
 const d=useMemo(()=>recoveryResponse(data,end),[data,end]),expand=useExpand(),normal=d.hard.filter(r=>r.observed!==null),assessed=d.hard.filter(r=>r.observed!==null||r.mornings.every(m=>m.normal!==null)),late=d.groups[0],early=d.groups[1],diff=late.hours.value!==null&&early.hours.value!==null?Math.round((late.hours.value-early.hours.value)*60):null;
 return <div className="recovery-response response-cards">
  <button onClick={()=>expand.widget('After high-load days',<div className="coach-evidence"><p>High-load means above the upper quarter of the previous 28 days’ recorded positive daily loads, with at least 7 active days. These are load-based candidates, not confirmed high-intensity workouts.</p><table><thead><tr><th>Training day</th><th>+1 morning</th><th>+2</th><th>+3</th></tr></thead><tbody>{d.hard.map(r=><tr key={r.date}><td>{r.date.slice(5)}<small>{Math.round(r.load)} effort</small></td>{r.mornings.map((m,i)=><td key={m.date}><b>{m.normal===null?'—':m.normal?'In range':'Review'}</b><small>HRV {num(m.hrv)} ms</small><small>RHR {num(m.rhr)} bpm</small><small>{m.sleep===null?'—':m.sleep.toFixed(1)+'h sleep'}</small>{i>0&&m.trainingBefore&&<small>More training</small>}</td>)}</tr>)}</tbody></table>{!d.hard.length&&<p>Not enough load history or no qualifying high-load days in the last 28 days.</p>}<p>The fraction counts days with an observed return to range, or three known mornings. Days with incomplete observations are shown separately. Both HRV and RHR must be within their dated ranges. Missing mornings interrupt a measured return; upcoming mornings remain unknown. A normal reading is not proof of full recovery. Additional training, illness and other factors may affect the response.</p></div>)}>
   <span className="response-card-heading"><small>After high-load days</small><ArrowUpRight size={14} aria-hidden="true"/></span>
   <strong>{assessed.length?<>{normal.length}<small>/{assessed.length}</small> <span>in range by +3</span></>:d.hard.length?'Awaiting readings':'Building history'}</strong>
   <span>HRV + RHR{d.hard.length>assessed.length?` · ${d.hard.length-assessed.length} incomplete`:''}</span>
  </button>
  <button onClick={()=>expand.widget('Late training → sleep',<div className="coach-evidence"><p>Last 60 days, training finishes at or after 20:00 versus earlier. Uses recorded duration to estimate finish time; only training days with known bedtime and all finish times are compared.</p><table><thead><tr><th>Finish</th><th>Sleep</th><th>Bedtime</th><th>HRV</th></tr></thead><tbody>{d.groups.map(g=><tr key={String(g.late)}><th>{g.late?'≥20:00':'Earlier'}<small>{g.count} nights</small></th><td>{g.hours.value===null?'—':g.hours.value.toFixed(1)+'h'}<small>{g.hours.count} readings</small></td><td>{g.bed.value===null?'—':clockLabel(g.bed.value)}<small>{g.bed.count} readings</small></td><td>{num(g.hrv.value)} ms<small>{g.hrv.count} readings</small></td></tr>)}</tbody></table><p>At least 3 readings per metric per group. This is an unadjusted association: session intensity, weekday and lifestyle may differ. It does not show that training time caused the change.</p></div>)}>
   <span className="response-card-heading"><small>Late training & sleep</small><ArrowUpRight size={14} aria-hidden="true"/></span>
   <strong>{diff===null?'Building comparison':<>{diff>0?'+':diff<0?'−':''}{Math.abs(diff)} <span>min sleep</span></>}</strong>
   <span>{late.hours.count} late / {early.hours.count} earlier nights</span>
  </button>
 </div>;
}
