import {sleepTraining} from './sleep-training-data';
import {sleepInsights} from './sleep-insights-data';
import {sleepToolsData} from './sleep-tools-data';
import {recoveryResponse} from './recovery-response-data';
import {clockLabel} from './sleep-timing-data';

// One view of the sleep period: every night with its recovery readings and
// the day before's training, overlays to lay over the sleep chart, the one
// worth opening on, and the few findings that stand out.
export type OverlayKey='hrv'|'rhr'|'score'|'deep'|'load';
export type Overlay={key:OverlayKey;label:string;unit:string;color:string;dates:string[];values:(number|null)[];ranges:([number,number]|null)[];higherIsBetter:boolean|null};
export type Finding={id:string;tone:'good'|'watch'|'neutral';text:string;priority:number};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
const minutes=(m:number)=>`${Math.round(Math.abs(m))} min`;

export function sleepPeriod(data:Parameters<typeof sleepTraining>[0],end:string,days:number){
 const training=sleepTraining(data,end,days),rows=training.rows;
 const dates=rows.map(r=>r.date);
 const overlays:Overlay[]=([
  {key:'hrv',dates,label:'HRV',unit:'ms',color:'#0f9f8f',values:rows.map(r=>r.hrv),ranges:rows.map(r=>r.hrvStatus?.range??null),higherIsBetter:true},
  {key:'rhr',dates,label:'Resting HR',unit:'bpm',color:'#e0607a',values:rows.map(r=>r.rhr),ranges:rows.map(r=>r.rhrStatus?.range??null),higherIsBetter:false},
  {key:'score',dates,label:'Sleep score',unit:'',color:'#7c5cd6',values:rows.map(r=>r.score??null),ranges:rows.map(()=>null),higherIsBetter:true},
  {key:'deep',dates,label:'Deep sleep',unit:'%',color:'#4f46e5',values:rows.map(r=>r.deep??null),ranges:rows.map(()=>null),higherIsBetter:true},
  {key:'load',dates,label:'Training',unit:'load',color:'#f59e0b',values:rows.map(r=>r.load!==null&&r.load>0?r.load:r.load===0?0:null),ranges:rows.map(()=>null),higherIsBetter:null},
 ] as Overlay[]).filter(o=>o.values.filter(finite).length>=2);

 // Open on what matters this period: readings outside your normal range first, then training followed by low HRV, then sleep score.
 const outside=(o:Overlay)=>o.values.filter((v,i)=>finite(v)&&o.ranges[i]&&(v<o.ranges[i]![0]||v>o.ranges[i]![1])).length;
 const hrv=overlays.find(o=>o.key==='hrv'),rhr=overlays.find(o=>o.key==='rhr'),load=overlays.find(o=>o.key==='load'),score=overlays.find(o=>o.key==='score');
 const loads=rows.map(r=>r.load).filter((v):v is number=>finite(v)&&v>0).sort((a,b)=>a-b),heavyCut=loads.length>=4?loads[Math.floor(loads.length*.75)]:null;
 const hrvValues=rows.map(r=>r.hrv).filter(finite).sort((a,b)=>a-b),hrvMid=hrvValues.length?hrvValues[hrvValues.length>>1]:null;
 const heavy=heavyCut===null?[]:rows.filter(r=>finite(r.load)&&r.load>=heavyCut&&r.load>0),heavyDips=hrvMid===null?0:heavy.filter(r=>finite(r.hrv)&&r.hrv<hrvMid).length;
 const pick:{key:OverlayKey;reason:string}|null=hrv&&outside(hrv)?{key:'hrv',reason:`${outside(hrv)} ${outside(hrv)===1?'morning':'mornings'} outside your normal HRV range`}
  :rhr&&outside(rhr)?{key:'rhr',reason:`${outside(rhr)} ${outside(rhr)===1?'morning':'mornings'} outside your normal resting HR`}
  :load&&heavyDips>=2&&heavyDips>=Math.ceil(heavy.length/2)?{key:'load',reason:`HRV dipped below your period median after ${heavyDips} of ${heavy.length} heavier training days`}
  :score?{key:'score',reason:'Sleep score for each night'}:hrv?{key:'hrv',reason:hrv.values.every((v,i)=>!finite(v)||hrv.ranges[i])?'Morning HRV, all within your normal range':'Morning HRV · normal range unavailable for some readings'}:overlays[0]?{key:overlays[0].key,reason:overlays[0].label}:null;

 const findings:Finding[]=[];
 const ins=sleepInsights(data,end,days);
 if(ins.recentStreak>=2)findings.push({id:'streak',tone:'watch',priority:9,text:`${ins.recentStreak} nights in a row under 7 hours.`});
 if(ins.weeklyDelta!==null&&Math.abs(ins.weeklyDelta)>=20)findings.push({id:'week',tone:ins.weeklyDelta>0?'good':'watch',priority:6,text:`Sleeping ${minutes(ins.weeklyDelta)} ${ins.weeklyDelta>0?'more':'less'} a night than the week before.`});
 const bed=ins.current.bed,prevBed=ins.previous.bed;
 if(bed.sd!==null&&bed.count>=4){const change=prevBed.sd!==null&&prevBed.count>=4?bed.sd-prevBed.sd:null;findings.push({id:'bed',tone:bed.sd>=45?'watch':bed.sd<=25?'good':'neutral',priority:bed.sd>=45?7:3,text:`Bedtime ${bed.mean===null?'':`around ${clockLabel(bed.mean)}, `}${bed.sd<=25?'regular':'varying'} by ±${Math.round(bed.sd)} min${change!==null&&Math.abs(change)>=10?` (${change<0?'steadier':'less steady'} than the ${days} days before)`:''}.`})}
 if(ins.late>=2)findings.push({id:'late',tone:'watch',priority:5,text:`${ins.late} of ${ins.timed} bedtimes after midnight.`});
 const short=training.associations.find(a=>a.label==='After short nights');
 if(short&&short.values[0].mean!==null&&short.values[1].mean!==null){const d=short.values[0].mean-short.values[1].mean;if(Math.abs(d)>=3)findings.push({id:'short-hrv',tone:d<0?'watch':'neutral',priority:Math.abs(d)>=8?8:5,text:`Over ${Math.max(days,28)} days, HRV ${Math.round(Math.abs(d))} ms ${d<0?'lower':'higher'} after nights under 7 hours (${short.values[0].count} nights) than after longer ones.`})}
 const tools=sleepToolsData(data,end,Math.max(days,28),8);
 const byScore=tools.byScore;if(byScore&&byScore.high.hrv.value!==null&&byScore.low.hrv.value!==null){const d=byScore.high.hrv.value-byScore.low.hrv.value;if(Math.abs(d)>=3)findings.push({id:'score-hrv',tone:'neutral',priority:4,text:`Over ${Math.max(days,28)} days, after nights scoring ${Math.round(byScore.cut)}+, your HRV is ${Math.round(Math.abs(d))} ms ${d>0?'higher':'lower'} than after lower-scoring ones.`})}
 const response=recoveryResponse(data,end),assessed=response.hard.filter(r=>r.observed!==null||r.mornings.every(m=>m.normal!==null));
 if(assessed.length>=2){const back=response.hard.filter(r=>r.observed!==null).length;findings.push({id:'recovery',tone:back===assessed.length?'good':back<assessed.length/2?'watch':'neutral',priority:back<assessed.length/2?8:4,text:`Over 28 days, HRV and resting HR back in range within 3 days after ${back} of ${assessed.length} high-load days.`})}
 const lateTraining=response.groups[0],early=response.groups[1];
 if(lateTraining.hours.value!==null&&early.hours.value!==null){const d=(lateTraining.hours.value-early.hours.value)*60;if(Math.abs(d)>=15)findings.push({id:'late-training',tone:d<0?'watch':'neutral',priority:Math.abs(d)>=30?6:3,text:`Over 60 days, ${minutes(d)} ${d<0?'less':'more'} sleep after training that ends at 20:00 or later.`})}
 const recorded=rows.map(r=>r.hours).filter(finite),average=mean(recorded);
 if(!findings.length&&average!==null)findings.push({id:'coverage',tone:'neutral',priority:1,text:`${recorded.length} of ${days} nights recorded, averaging ${average.toFixed(1)} hours.`});
 findings.sort((a,b)=>b.priority-a.priority);
 return {rows,overlays,pick,findings:findings.slice(0,4)};
}
