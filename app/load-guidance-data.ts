import {loadAnalysis} from './load-analysis-data';
import {metricStatus} from './metric-status';
import {sportFamily} from './sports';
import {localDate} from './week-overview';
export type Feeling='unknown'|'normal'|'tired'|'unwell';
const valid=(v:any):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function loadGuidance(data:any,now:Date,feeling:Feeling='unknown'){
 const load=loadAnalysis(data,now,36),volume=loadAnalysis(data,now,36,'time');
 const loadCovered=load.complete&&load.rows.slice(0,28).every(r=>r.value!==null),model=loadCovered?load:volume,timeOnly=!loadCovered;
 const base=model.rows.slice(0,28),baseComplete=base.every(r=>r.value!==null),baseWeek=baseComplete?base.reduce((n,r)=>n+r.value!,0)/4:null;
 const aboveBase=baseWeek!==null&&baseWeek>0&&model.complete?(model.total!/baseWeek-1)*100:null;
 const ramp=aboveBase!==null&&aboveBase>=20&&model.change!==null&&model.change>=30;
 const restart=model.complete&&model.previous===0&&model.total!>0;
 const previousDays=model.rows.slice(7,-1),training=previousDays.map(r=>r.value).filter((v):v is number=>v!==null&&v>0).sort((a,b)=>a-b);
 const median=training[Math.floor(training.length*.5)],high=training[Math.floor(training.length*.9)];
 const bigToday=training.length>=7&&model.today.value!==null&&model.today.value>Math.max(high,median*1.5);
 const today=localDate(now),day=(offset:number)=>{const d=new Date(now);d.setDate(d.getDate()+offset);return d};
 const health=(at:Date)=>{const key=localDate(at),compact=key.replaceAll('-',''),sleep=data.sleep?.[compact]?.[0],hrv=data.hrv?.[compact]?.[0],rhr=(data.extra?.bodyvalues?.bodyvalues??[]).filter((r:any)=>localDate(new Date(r.timestamp))===key&&new Date(r.timestamp)<=at&&valid(r.hrRestDynamic)).at(-1)?.hrRestDynamic;
  const hs=metricStatus('hrv',data,at,sportFamily),rs=metricStatus('rhr',data,at,sportFamily);
  const hKnown=valid(hrv)&&!!hs.range,rKnown=valid(rhr)&&!!rs.range,sKnown=valid(sleep);
  const flags=[sKnown&&sleep<7*3600,hKnown&&hrv<hs.range![0],rKnown&&rhr>rs.range![1]];
  return {sleep,hrv,rhr,hs,rs,flags,count:flags.filter(Boolean).length,known:[sKnown,hKnown,rKnown].filter(Boolean).length};
 };
 const fresh=health(now),previous=health(day(-1)),persistent=fresh.flags.filter((flag,i)=>flag&&previous.flags[i]).length;
 const syncedToday=!!data.syncedAt&&localDate(new Date(data.syncedAt))===today,loadReady=model.complete&&baseComplete&&syncedToday;
 const reasons:string[]=[];
 if(ramp)reasons.push(`${Math.round(model.change!)}% more ${timeOnly?'training time':'load'} than the preceding week; ${Math.round(aboveBase!)}% above the four weeks before this build-up.`);
 if(restart)reasons.push('Training has resumed after seven days with no recorded load.');
 if(bigToday)reasons.push(`Today is already above 90% of your recorded training days in the prior 28 days and more than 1½ times their median ${timeOnly?'duration':'load'}.`);
 if(fresh.flags[0])reasons.push(`Last night: ${Math.floor(fresh.sleep/3600)}h ${Math.round(fresh.sleep%3600/60)}m sleep, below 7h.`);
 if(fresh.flags[1])reasons.push(`Today’s HRV: ${Math.round(fresh.hrv)} ms, below your ${fresh.hs.rangeLabel} range.`);
 if(fresh.flags[2])reasons.push(`Today’s resting HR: ${Math.round(fresh.rhr)} bpm, above your ${fresh.rs.rangeLabel} range.`);
 if(persistent)reasons.push(`${persistent} recovery signal${persistent===1?' has':'s have'} remained outside the review range for two mornings.`);
 if(feeling==='tired')reasons.push('You reported unusual tiredness.');
 if(feeling==='unwell')reasons.push('You reported feeling unwell or having pain.');
 let title='Recovery check incomplete',action='Sync today’s readings and check how you feel before choosing a hard session.',tone='neutral';
 if(feeling==='unwell'){title='Rest and reassess';action='Skip strenuous training while unwell or in pain. Seek medical advice for new, persistent or worsening symptoms.';tone='rest';}
 else if(fresh.count>=2&&(ramp||bigToday||persistent>=2||feeling==='tired')){title='Consider a rest day';action='Several signals favour recovery. Consider rest or gentle movement, and reassess tomorrow before a hard session.';tone='rest';}
 else if(fresh.count>0||feeling==='tired'){title='An easy day is worth considering';action='Choose an easy session or rest according to how you feel. Recheck recovery before adding intensity.';tone='easy';}
 else if(ramp){title='Build-up worth slowing';action='Hold your training steady rather than increasing it again. Make the next session easy if you feel fatigued.';tone='easy';}
 else if(bigToday){title='Big day — allow recovery';action='Avoid adding more hard work today. Consider an easy day tomorrow and check your morning readings.';tone='easy';}
 else if(restart){title='Build back gradually';action='Start with manageable sessions rather than making up missed training at once.';tone='easy';}
 else if(loadReady&&fresh.known===3){title='No clear back-off signal';action='The available readings do not suggest an extra rest day. Follow your plan if you feel well; this is not a green light to add intensity.';tone='steady';}
 if(!reasons.length&&fresh.known===3)reasons.push('Sleep is at least 7h; HRV is not below its range and resting HR is not above its range.');
 if(!loadReady)reasons.push('Load history is incomplete or was not synced today; training progression cannot be fully assessed.');
 if(fresh.known<3)reasons.push(`${fresh.known}/3 current recovery signals available with the required ranges. Older readings are not used as today’s recovery.`);
 return {title,action,tone,reasons,timeOnly,ramp,bigToday,persistent,coverage:fresh.known,loadReady};
}
