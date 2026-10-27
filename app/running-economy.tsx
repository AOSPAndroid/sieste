import {useMemo} from 'react';
import {CartesianGrid,ComposedChart,Line,ResponsiveContainer,Scatter,XAxis,YAxis,ZAxis} from 'recharts';
import {runningEconomy,economyOf,type Mechanic} from './running-economy-data';
import {weightAt} from './athlete-thresholds';
import {paceLabel} from './activity-metrics';

type Props={detail:Parameters<typeof runningEconomy>[0];history:Parameters<typeof runningEconomy>[1];athlete:(NonNullable<Parameters<typeof runningEconomy>[2]>&{profile?:{weight?:unknown}})|null};
const mechanicLabels:Record<Mechanic,[string,string,number]>={cadence:['Cadence','spm',0],groundContactTime:['Ground contact','ms',0],verticalOscillation:['Vertical oscillation','cm',1],verticalRatio:['Vertical ratio','%',1],stepLength:['Step length','cm',0],dutyFactor:['Time on the ground','% of each step',0]};
const pace=(speed:number)=>paceLabel(1000/speed);
// Small differences keep a decimal so they read consistently with the verdict.
const delta=(v:number)=>{const p=v*100;return Math.abs(p)<.05?'0%':`${p<0?'−':'+'}${Math.abs(p)<10?Math.abs(p).toFixed(1):Math.round(Math.abs(p))}%`};
// Each run against your usual cost at its own pace, in words rather than a signed percentage.
const versus=(v:number)=>Math.abs(v)<.0005?'As usual':`${delta(v).slice(1)} ${v<0?'cheaper':'costlier'}`;
const tone=(v:number)=>v<-.015?'better':v>.015?'worse':undefined;

// Estimated economy for this run against your own runs at the same pace.
export default function RunningEconomy({detail,history,athlete}:Props){
 const weight=weightAt(athlete?.bodyvalues,detail.date??'')?.weight??(typeof athlete?.profile?.weight==='number'?athlete.profile.weight:null);
 const model=useMemo(()=>runningEconomy(detail,history,athlete,weight),[detail,history,athlete,weight]);
 if(!model)return <p className="economy-empty">Economy needs at least 20 minutes of running with heart rate and pace.</p>;
 const {block,today,measure,vsUsual,month,year,links,reference,points,line}=model,value=today[measure];
 const oxygen=measure==='oxygen',unit=oxygen?'ml O₂/kg/km':'beats/km';
 if(value===null)return <p className="economy-empty">Economy needs your resting heart rate, from Tredict or COROS daily readings, to work out what each kilometre costs.</p>;
 // Within ±1.5% of the line is ordinary run-to-run noise.
 const better=vsUsual!==null&&vsUsual<-.015,worse=vsUsual!==null&&vsUsual>.015,size=vsUsual===null?'':delta(vsUsual).replace(/^[−+]/,'');
 const verdict=vsUsual===null?model.line&&!model.paceSupported?'Your earlier runs do not cover this pace yet. More runs near this pace are needed to compare economy.':`Needs 8 earlier ${model.steady?'steady':'flat'} runs to judge against your usual at this pace (${model.history} so far).`:better?`${size} more economical than your usual at this pace`:worse?`${size} costlier than your usual at this pace`:'About your usual cost at this pace';
 const chart=line?[...points.map(p=>({gap:p.gap*3.6,past:p.cost,recent:p.recent})),{gap:block.gap*3.6,today:value}]:[];
 const range=points.length?[Math.min(...points.map(p=>p.gap)),Math.max(...points.map(p=>p.gap))]:null;
 const trend=line&&range?[{gap:range[0]*3.6,usual:line.a+line.b*range[0]},{gap:range[1]*3.6,usual:line.a+line.b*range[1]}]:[];
 const energy=economyOf(block,reference.restAt(Date.parse(detail.date??'')),reference.max,reference.vo2max,weight).energy;
 return <section className="running-economy" aria-labelledby="economy-title">
  <header><h4 id="economy-title">{oxygen?'Estimated oxygen cost':'Heartbeats per km above resting'}</h4><small>{Math.round(block.seconds/60)} min of {model.steady?'steady running':'running (whole-run averages)'} at {pace(block.gap)} /km{model.steady?' grade-adjusted':''}</small></header>
  <div className="economy-headline"><b>{value===null?'—':Math.round(value)}</b><span>{unit}</span>{oxygen&&<small>Modelled from heart rate · lower is cheaper</small>}</div>
  <p className={`economy-verdict${better?' is-better':worse?' is-worse':''}`}>{verdict}{vsUsual!==null&&<small>Usual at this pace: {Math.round(model.expected!)} {unit}</small>}</p>
  {(month||year)&&<ul className="economy-windows">{vsUsual!==null&&<li data-tone={tone(vsUsual)}><span>This run</span><b>{versus(vsUsual)}</b></li>}{month&&<li data-tone={tone(month.gap)}><span>Last 30 days · {month.runs} runs</span><b>{versus(month.gap)}</b></li>}{year&&<li data-tone={tone(year.gap)}><span>Last year · {year.runs} runs</span><b>{versus(year.gap)}</b></li>}</ul>}
  {chart.length>0&&<div className="economy-chart" role="img" aria-label={`Cost against pace for ${points.length} earlier runs with your usual line; this run ${value===null?'':Math.round(value)} ${unit}`}>
   <ResponsiveContainer width="100%" height={170}><ComposedChart data={[...chart,...trend]} margin={{top:8,right:8,left:-14,bottom:0}}>
    <CartesianGrid stroke="#edf0f5" vertical={false}/><XAxis dataKey="gap" type="number" domain={['dataMin','dataMax']} tickFormatter={v=>pace(v/3.6)} tick={{fontSize:10}} tickCount={4} height={22}/><YAxis tick={{fontSize:10}} domain={['auto','auto']} width={40}/>
    <Line dataKey="usual" stroke="#94a3b8" strokeDasharray="4 4" dot={false} isAnimationActive={false} connectNulls/><ZAxis range={[22,22]}/>
    <Scatter data={chart.filter(p=>'past' in p)} dataKey="past" fill="#94a3b8" isAnimationActive={false}/>
    <Scatter data={chart.filter(p=>'today' in p)} dataKey="today" fill="#4f46e5" isAnimationActive={false} shape={(p:{cx?:number;cy?:number})=><circle cx={p.cx} cy={p.cy} r={6} fill="#4f46e5" stroke="#fff" strokeWidth={2}/>}/>
   </ComposedChart></ResponsiveContainer><p className="economy-legend" aria-hidden="true"><span><i className="is-past"/>Earlier runs</span><span><i className="is-usual"/>Your usual</span><span><i className="is-today"/>This run</span></p></div>}
  {links.length>0&&<div className="economy-links"><h5>What goes with your cheaper runs</h5><ul>{links.slice(0,3).map(l=>{const [label,u,digits]=mechanicLabels[l.key],fmt=(v:number)=>(l.key==='dutyFactor'?v*100:v).toFixed(digits);return <li key={l.key}><b>{l.r<0?'More':'Less'} {label.toLowerCase()} for the pace</b><span>{l.best!==null?`Your cheaper runs: ${fmt(l.best)} ${u}`:''}{l.today!==null?` · this run ${fmt(l.today)} ${u}`:''} · {l.runs} runs</span></li>})}</ul></div>}
  <details className="economy-method"><summary>How this is estimated</summary>
   <p>{oxygen?`Oxygen use follows the share of your heart-rate reserve in use: resting ${reference.restAt(Date.parse(detail.date??''))===null?'—':Math.round(reference.restAt(Date.parse(detail.date??''))!)} bpm (the fortnight before), max ${reference.max} bpm (${reference.maxSource}) and VO₂max ${reference.vo2max?.toFixed(1)} held fixed for the year, because watch VO₂max is itself worked out from heart rate and pace. Cost = oxygen per minute ÷ pace.`:`Without a max heart rate and VO₂max, the cost is counted in heartbeats above resting per kilometre.`}{energy!==null?` Energy from running power: ${energy.toFixed(2)} J/kg/m (about 1.0 is typical; watch power is modelled, so it mostly follows pace).`:''}</p>
   <p>Only steady running counts: after the first 10 minutes, moving, gradient within ±4%, and within 12% of the run&apos;s usual pace, so warm-up, stops, hills, surges and recoveries are left out. Your usual line is fitted over a year of such runs; economy worsens with heat, fatigue, illness and dehydration as well as form. Mechanics links compare runs with pace taken out of both sides; they show what goes together, not what causes what.</p>
  </details>
 </section>;
}
