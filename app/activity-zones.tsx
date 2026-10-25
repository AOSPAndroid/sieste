"use client";
import {useState} from 'react';
import {workoutZoneTables,zoneDuration} from './activity-zones-data';
const colors=['#afc8e0','#75a9d1','#448ec0','#6179c0','#8a66b7','#a669ac','#bc719b'];
// With the athlete's own zones, rows carry their names and limits and a
// heart-rate histogram is sorted into them when no zone times were recorded.
export default function ActivityZones({summary,loading=false,zones=null,histogram=null,zonesSince}:{summary:Record<string,any>;loading?:boolean;zones?:{name?:string;from:number;to:number}[]|null;histogram?:{secondsByBpm?:Record<string,number>;validSeconds?:number}|null;zonesSince?:string}){
 const measured=workoutZoneTables(summary,histogram,zones),bands=!measured.length&&Array.isArray(summary.hrBands),tables=bands?workoutZoneTables({zonesDistribution:{heartrate:summary.hrBands}},null,null):measured,[sensor,setSensor]=useState('heartrate'),selected=tables.find(t=>t.key===sensor)??tables[0];
 return <section className="activity-zone-micro" aria-label="Time in training zones"><header><h3>{bands?'Time by heart rate':'Time in zones'}</h3>{tables.length>1?<select aria-label="Time in zones sensor" value={selected.key} onChange={e=>setSensor(e.target.value)}>{tables.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</select>:<span>{selected?.label??'Heart rate'}</span>}</header>{selected?<><table><thead><tr><th scope="col">Zone</th><th scope="col" aria-label="Proportion"/><th scope="col">Time</th><th scope="col">%</th></tr></thead><tbody>{selected.rows.map(row=><tr key={row.zone}><th scope="row"><i style={{background:colors[Math.min(row.zone-1,colors.length-1)]}}/>{bands?['<120','120–139','140–159','160–179','180+'][row.zone-1]:selected.names?<>{selected.names[row.zone-1]}<small>{selected.ranges?.[row.zone-1]}</small></>:'Z'+row.zone}</th><td><span className="activity-zone-track" aria-hidden="true"><i style={{width:`${row.percent??0}%`,background:colors[Math.min(row.zone-1,colors.length-1)]}}/></span></td><td>{zoneDuration(row.seconds)}</td><td>{row.percent===null?'—':`${row.percent.toFixed(1)}%`}</td></tr>)}</tbody></table><p>{zoneDuration(selected.total)} {bands?'bpm bands · COROS zone boundaries unavailable':selected.names?`in your heart-rate zones${zonesSince?` (Tredict, set ${zonesSince.slice(0,10)})`:''}`:'classified · % of classified time'}{selected.partial?' · incomplete zone data':''}{summary.zonesSource?' · '+summary.zonesSource:''}</p></>:<p>{loading?'Loading recorded zones…':'Zone times not supplied for this activity.'}</p>}</section>;
}

/** One bar of time in heart-rate zones for the summary: which zone the session lived in. */
export function ZoneStrip({summary,histogram=null,zones=null}:{summary:{zonesDistribution?:unknown};histogram?:{secondsByBpm?:Record<string,number>;validSeconds?:number}|null;zones?:{name?:string;from:number;to:number}[]|null}){
 const hr=workoutZoneTables(summary,histogram,zones).find(t=>t.key==='heartrate');
 if(!hr||hr.total<=0)return null;
 // Easy to hard: the same ramp as the route's intensity colours, spread over however many zones there are.
 const ramp=['#60a5fa','#34d399','#facc15','#fb923c','#ef4444'],tone=(i:number)=>ramp[hr.rows.length<2?0:Math.round(i/(hr.rows.length-1)*(ramp.length-1))];
 const label=(i:number)=>hr.names?.[i]??`Z${i+1}`,top=hr.rows.reduce((best,r,i)=>(r.seconds??0)>(hr.rows[best].seconds??0)?i:best,0);
 return <section className="zone-strip" aria-label="Time in heart-rate zones">
  <header><h3>Heart-rate zones</h3><small>Mostly {label(top)} · {Math.round(hr.rows[top].percent??0)}%{hr.names?'':' · zone limits not supplied'}</small></header>
  <div className="zone-strip-bar" role="img" aria-label={hr.rows.map((r,i)=>`${label(i)} ${Math.round(r.percent??0)}%`).join(', ')}>{hr.rows.map((r,i)=>(r.percent??0)>0&&<i key={i} style={{width:`${r.percent}%`,background:tone(i)}}/>)}</div>
  <ul>{hr.rows.map((r,i)=>(r.seconds??0)>=30&&<li key={i}><i style={{background:tone(i)}}/>{label(i)}{hr.ranges?<small>{hr.ranges[i]}</small>:null}<b>{zoneDuration(r.seconds)}</b></li>)}</ul>
 </section>;
}
