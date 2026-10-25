import {paceFromSpeed} from './activity-terrain-data';
import {trendSummary,type HillBucket,type HillVerdict,type TrendItem,type sectionTrend,type decoupling,type hillSplit} from './section-analysis-data';

// The trend across sections and the hills breakdown, under the profile chart.
type Props={family:string;cadenceUnit:string;sections:string;count:number;trend:ReturnType<typeof sectionTrend>;hills:ReturnType<typeof hillSplit>|null;verdict:HillVerdict|null;drift:ReturnType<typeof decoupling>};
const labels:Record<TrendItem['key'],string>={gap:'Grade-adjusted pace',speed:'Speed',power:'Power',heartrate:'Heart rate',cadence:'Cadence',stepLength:'Step length'};
const clock=(seconds:number)=>{const s=Math.round(seconds);return s>=3600?`${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,'0')}h`:`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};

export default function SectionAnalysis({family,cadenceUnit,sections,count,trend,hills,verdict,drift}:Props){
 const foot=family!=='cycling',grade=family==='cycling'?2:3;
 const speed=(v:number|null)=>v===null?'—':foot?`${paceFromSpeed(v)} /km`:`${(v*3.6).toFixed(1)} km/h`;
 const bare=(v:number|null)=>v===null?'—':foot?paceFromSpeed(v):(v*3.6).toFixed(1);
 const value=(item:TrendItem,v:number)=>item.key==='gap'||item.key==='speed'?speed(v):item.key==='power'?`${Math.round(v)} W`:item.key==='heartrate'?`${Math.round(v)} bpm`:item.key==='cadence'?`${Math.round(v)} ${cadenceUnit==='steps/min'?'spm':cadenceUnit}`:`${Math.round(v)} cm`;
 // On foot a falling speed is a slower pace, so name the direction in words.
 const change=(item:TrendItem)=>item.verdict==='held'?'held':item.key==='heartrate'?`${item.change>0?'+':'−'}${Math.round(Math.abs(item.change))} bpm`:(item.key==='gap'||item.key==='speed')&&foot?`${Math.round(Math.abs(item.change)*100)}% ${item.change<0?'slower':'faster'}`:`${item.change>0?'+':'−'}${Math.round(Math.abs(item.change)*100)}%`;
 // Slowing down or heart rate rising for the work reads as fading; the reverse as building.
 const tone=(item:TrendItem)=>item.verdict==='held'?'held':item.key==='heartrate'?(item.verdict==='up'?'fade':'build'):item.verdict==='down'?'fade':'build';
 const total=hills?hills.up.seconds+hills.flat.seconds+hills.down.seconds:0;
 const hillText=verdict&&(verdict.metric==='gap'?`${verdict.kind==='pushed'?'You pushed the climbs':verdict.kind==='eased'?'You eased off on the climbs':'Even effort on climbs and flat'}: grade-adjusted pace ${speed(verdict.up)} uphill against ${speed(verdict.flat)} on the flat.`:verdict.metric==='power'?`${verdict.kind==='pushed'?'You pushed the climbs':verdict.kind==='eased'?'You eased off on the climbs':'Even power on climbs and flat'}: ${Math.round(verdict.up)} W uphill against ${Math.round(verdict.flat)} W on the flat (${verdict.change>0?'+':'−'}${Math.round(Math.abs(verdict.change)*100)}%).`:`Heart rate ${Math.round(verdict.up)} bpm uphill against ${Math.round(verdict.flat)} bpm on the flat${verdict.kind==='pushed'?': you pushed the climbs':verdict.kind==='eased'?': you eased off on the climbs':''}.`);
 const rows:[string,HillBucket][]=hills?([['Uphill',hills.up],['Flat',hills.flat],['Downhill',hills.down]] as [string,HillBucket][]).filter(([,b])=>b.seconds>=30):[];
 const flat=!!hills&&hills.up.seconds<60&&hills.down.seconds<60&&hills.flat.seconds>0;
 if(!trend&&!rows.length&&!drift&&count<2)return null;
 return <div className="section-analysis">
  {trend&&<section aria-label={`How your ${sections} changed`}>
   <h4>First {trend.compared>1?`${trend.compared} `:''}vs last {trend.compared>1?`${trend.compared} `:''}{sections}</h4>
   <p className="section-analysis-lead">{trendSummary(trend,family,sections)}</p>
   <ul className="section-trend">{trend.items.map(item=><li key={item.key} data-tone={tone(item)}><span>{labels[item.key]}</span><b>{value(item,item.from)} → {value(item,item.to)}</b><small>{change(item)}</small></li>)}</ul>
  </section>}
  {!trend&&count>=2&&<p className="section-analysis-lead">Too few {sections} of similar length to compare the first with the last; short warm-up, cool-down and final laps are left out.</p>}
  {drift&&<p className="section-drift" data-tone={drift.drift>5?'fade':'held'}><b>Heart-rate drift {drift.drift>0?'+':'−'}{Math.abs(drift.drift).toFixed(1)}%</b> {drift.drift>5?`Your ${drift.basis} per heartbeat fell in the second half: fatigue, heat or under-fuelling.`:`Your ${drift.basis} per heartbeat held in the second half (under 5% is steady aerobic work).`}</p>}
  {flat&&<p className="section-analysis-lead">Flat route: no stretch of {grade}% or steeper long enough to compare hills with the flat.</p>}
  {rows.length>0&&!flat&&<section aria-label="On the hills">
   <h4>On the hills</h4>
   {hillText&&<p className="section-analysis-lead">{hillText}</p>}
   <div className="section-hills" role="table" aria-label="Uphill, flat and downhill"><div role="row"><span role="columnheader">Terrain</span><span role="columnheader">Time</span><span role="columnheader">{foot?'Pace /km':'km/h'}</span><span role="columnheader" title={foot?'Grade-adjusted pace: the flat pace for the same effort':undefined}>{foot?'GAP':'Watts'}</span><span role="columnheader">HR</span><span role="columnheader">Cad.</span></div>
    {rows.map(([label,b])=><div role="row" key={label}><span role="cell">{label}<small>{label==='Uphill'?`${grade}%+`:label==='Downhill'?`−${grade}%+`:`±${grade}%`}</small></span><span role="cell">{clock(b.seconds)}<small>{Math.round(b.seconds/total*100)}%</small></span><span role="cell">{bare(b.speed)}</span><span role="cell">{foot?bare(b.gap):b.power===null?'—':Math.round(b.power)}</span><span role="cell">{b.heartrate===null?'—':Math.round(b.heartrate)}</span><span role="cell">{b.cadence===null?'—':Math.round(b.cadence)}</span></div>)}
   </div>
  </section>}
 </div>;
}
