'use client';
import type {AthleteData} from './analytics';
import {weekOverview} from './week-overview';
import {sportFamily} from './sports';
import {metricStatus} from './metric-status';
import {clockDuration} from './dashboard-calendar';
import {useExpand} from './expansion';
import WidgetSpark from './widget-spark';
import CorosDaily from './coros-daily';
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export default function DailyThreeDays({data,now}:{data:AthleteData;now:Date}){
 const expand=useExpand(),days=weekOverview(data,now,sportFamily).rows.slice(-3),coros=data.extra?.coros;
 const metrics=[{key:'sleep',label:'Sleep',unit:'',title:'Latest sleep'},{key:'hrv',label:'HRV',unit:'ms',title:'Average HRV'},{key:'rhr',label:'Resting HR',unit:'bpm',title:'Resting HR'},{key:'score',label:'Sleep score',unit:'/100',title:'Sleep score'},{key:'steps',label:'Steps',unit:'',title:'Daily steps'},{key:'calories',label:'Calories',unit:'kcal',title:'Daily calories'}];
 const value=(key:string,day:typeof days[number]):number|null=>{const stamp=day.iso.replaceAll('-',''),v=key==='score'?coros?.sleepWindows?.[stamp]?.score:key==='steps'||key==='calories'?coros?.daily?.[stamp]?.[key]:day[key as 'sleep'|'hrv'|'rhr'];return finite(v)?v:null};
 return <section className="daily-three-days" aria-label="Daily metrics, last three days"><table><thead><tr><th>Daily metrics</th>{days.map((day,i)=><th key={day.iso}>{i===2?'Today':i===1?'Yesterday':'2 days ago'}<small>{new Date(day.iso+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></th>)}</tr></thead><tbody>{metrics.map(metric=>{const values=days.map(d=>value(metric.key,d));return <tr key={metric.key}><th scope="row"><span>{metric.label}</span><WidgetSpark values={values} dotted label={`${metric.label}, last three days; gaps mean missing readings`} className="three-day-trend" color="#8b98a8"/></th>{days.map((day,i)=>{const v=values[i],physiology=['sleep','hrv','rhr'].includes(metric.key),status=v===null?null:physiology?metricStatus(metric.key,data,i===2?now:new Date(day.iso+'T23:59:59'),sportFamily):null,tone=status?.tone??(metric.key==='score'&&v!==null?(v>=80?'green':v>=60?'orange':'red'):'neutral'),formatted=v===null?'—':metric.key==='sleep'?clockDuration(v*3600):v.toLocaleString('en-GB',{maximumFractionDigits:0});return <td key={day.iso}><button className={`status-${tone}`} title={`${day.iso} · ${status?.label??(v===null?'No reading':metric.key==='score'?'sieste score colours: 80+ green, 60–79 amber, below 60 red':'Recorded total')}${status?.rangeLabel?' · Usual '+status.rangeLabel:''}`} aria-label={`${metric.label}, ${day.iso}: ${formatted} ${v===null?'':metric.unit}. Open analysis`} onClick={()=>physiology?expand.metric(metric.title):expand.widget(metric.title,<CorosDaily data={data} now={new Date(day.iso+'T23:59:59')}/>)}><strong>{formatted}</strong>{v!==null&&metric.unit&&<small>{metric.unit}</small>}</button></td>})}</tr>})}</tbody></table><p>Tap for analysis · today’s steps & calories are partial</p></section>;
}
