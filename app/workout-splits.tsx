"use client";
import {useMemo} from 'react';
import {distanceSplits,splitLength,splitPace,type Split,type SampledDetail} from './workout-splits-data';

const clock=(s:number)=>{const r=Math.round(s),h=Math.floor(r/3600),m=Math.floor(r%3600/60),x=r%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${m}:${String(x).padStart(2,'0')}`};

// Per-kilometre (per 5 km on rides, per 100 m swimming) splits: pace for runs,
// speed for rides. Bars grow with speed so the quickest split is the longest.
export default function WorkoutSplits({detail,family}:{detail:SampledDetail;family:string}){
 const unit=splitLength(family),ride=family==='cycling';
 const splits=useMemo(()=>{const d=detail.seriesSampled?.data,step=detail.seriesSampled?.sampleSize;return d&&step?distanceSplits(d.distance,step,unit,d.heartrate):[]},[detail.seriesSampled,unit]);
 if(splits.length<2)return null;
 const speeds=splits.map(s=>unit/splitPace(s,unit)),max=Math.max(...speeds),min=Math.min(...speeds),fastest=speeds.indexOf(max);
 const label=(s:Split)=>s.partial?`${unit>=1000?(s.distance/1000).toFixed(1):Math.round(s.distance)}${unit>=1000?'':' m'}`:String(unit>=1000?s.index*unit/1000:s.index*unit);
 const value=(s:Split)=>ride?(s.distance/s.seconds*3.6).toFixed(1):clock(splitPace(s,unit));
 const hasHr=splits.some(s=>s.heartrate!==null);
 return <section className="workout-splits" aria-label="Splits">
  <header><h3>Splits</h3><span>{unit>=1000?`per ${unit/1000} km`:`per ${unit} m`}</span></header>
  <div className="workout-splits-head" aria-hidden="true"><span>{unit>=1000?'km':'m'}</span><span>{ride?'km/h':unit===100?'/100m':'/km'}</span><span/>{hasHr&&<span>bpm</span>}</div>
  <ol>{splits.map((s,i)=>{const width=max===min?100:55+45*(speeds[i]-min)/(max-min);return <li key={s.index} className={i===fastest?'is-fastest':undefined}>
   <span className="split-label">{label(s)}</span>
   <span className="split-value">{value(s)}</span>
   <span className="split-bar" aria-hidden="true"><i style={{width:`${width}%`}}/></span>
   {hasHr&&<span className="split-hr">{s.heartrate===null?'—':Math.round(s.heartrate)}</span>}
  </li>})}</ol>
 </section>;
}
