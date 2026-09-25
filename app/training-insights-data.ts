import {effortExcluded} from './workout-exclusions';
import type {AthleteData,Workout} from './analytics';
import {sportFamily} from './sports';
import {metricStatus} from './metric-status';
import {localDate} from './week-overview';
const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const temperature=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const median=(v:number[])=>{const a=[...v].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2};
const shift=(date:Date,n:number)=>{const d=new Date(date);d.setDate(d.getDate()+n);return d};
export function recoveryInsight(data:AthleteData,now:Date){
 const readings=[['sleep','Sleep'],['hrv','HRV'],['rhr','Resting HR']].map(([key,label])=>({...metricStatus(key,data,now,sportFamily),metric:label}));
 const flagged=readings.filter(r=>r.tone==='orange'||r.tone==='red'),known=readings.filter(r=>!['No reading','Older reading','Learning your baseline'].includes(r.label)).length;
 return {readings,tone:flagged.some(r=>r.tone==='red')?'red':flagged.length?'orange':known===3&&readings[0].tone==='green'?'green':'neutral',title:flagged.length?`${flagged.length} signal${flagged.length===1?'':'s'} to review`:known===3?(readings[0].tone==='neutral'?'Sleep below 8h target':'Signals in range'):'Recovery data incomplete',summary:flagged.length?flagged.map(r=>`${r.metric}: ${r.label}`).join(' · '):known===3?`${readings[0].label} · HRV and RHR within your range`:'Open to see which readings need more history.'};
}
export function workloadInsight(data:AthleteData,now:Date){
 const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()),start=shift(end,-35),source=data.extra?.efforts?.trainingEfforts;
 const weeks=Array.from({length:5},(_,i)=>{const from=shift(start,i*7),to=shift(from,7),sessions=data.activities.filter(a=>new Date(a.date)>=from&&new Date(a.date)<to),durations=sessions.map(a=>a.summary?.duration),history=!!data.historyStart&&new Date(data.historyStart)<=from&&data.historyComplete!==false;
 const values=Array.from({length:7},(_,j)=>{const date=shift(from,j),key=localDate(date),raw=source?.[key.replaceAll('-','')],active=sessions.some(a=>localDate(new Date(a.date))===key),v=Array.isArray(raw)?raw.map((e:any)=>Array.isArray(e)?e[0]:e):[];return effortExcluded(data,key)?null:source&&v.length&&v.every(number)?v.reduce((s:number,n:number)=>s+n,0):source&&!active?0:null});
 return {label:i===4?'Last 7 full days':`${4-i} week${i===3?'':'s'} earlier`,from:localDate(from),to:localDate(shift(to,-1)),hours:history&&durations.every(number)?durations.reduce((s,n)=>s+n,0)/3600:null,load:history&&values.every(v=>v!==null)?values.reduce<number>((s,v)=>s+v!,0):null,sessions:sessions.length};});
 const current=weeks[4],base=weeks.slice(0,4),complete=weeks.every(w=>w.load!==null),baseline=complete?base.reduce((s,w)=>s+w.load!,0)/4:null,change=baseline!==null&&baseline>0?(current.load!/baseline-1)*100:null;
 return {weeks,current,baseline,change,title:change===null?'Load comparison pending':`${change>=0?'+':''}${change.toFixed(0)}% training load`,summary:change===null?'Needs five complete weeks of effort data.':'Last 7 full days vs your previous 4-week average.'};
}
export function efficiencyInsight(data:AthleteData,now:Date,family:'running'|'cycling'){
 const boundary=shift(now,-28),start=shift(now,-84);
 const candidates=data.activities.filter(a=>sportFamily(a)===family&&new Date(a.date)>=start&&new Date(a.date)<=now).filter(a=>{const s=a.summary??{};return number(s.duration)&&s.duration>=1200&&s.duration<=7200&&number(s.heartrate)&&s.heartrate>=80&&s.heartrate<=190&&(family==='running'?number(s.distance)&&s.distance>0:number(s.power)&&s.power>0)&&!/(interval|track|race|tempo)/i.test(`${a.title??''} ${a.subSportType??''} ${a.sessionLabel??a.evidence?.classification?.label??''}`)});
 const recent=candidates.filter(a=>new Date(a.date)>=boundary).sort((a,b)=>b.date.localeCompare(a.date)),older=candidates.filter(a=>new Date(a.date)<boundary),used=new Set<string>();
 const output=(a:Workout)=>family==='running'?a.summary!.distance/a.summary!.duration:a.summary!.power;
 const elevation=(a:Workout)=>{const ascent=a.summary?.altitude?.ascent,distance=a.summary?.distance;return number(ascent)&&number(distance)&&distance>0?ascent/(distance/1000):null};
 const pairs: {recent:Workout;prior:Workout;change:number;terrainMatched:boolean;temperatureMatched:boolean}[]=[];
 for(const a of recent){const matches=older.filter(b=>!used.has(b.id)&&(a.subSportType??'generic')===(b.subSportType??'generic')&&Math.abs(a.summary!.heartrate-b.summary!.heartrate)<=5&&Math.abs(a.summary!.duration/b.summary!.duration-1)<=.2&&(!(temperature(a.summary?.temperature)&&temperature(b.summary?.temperature))||Math.abs(a.summary!.temperature-b.summary!.temperature)<=5)&&(!(elevation(a)!==null&&elevation(b)!==null)||Math.abs(elevation(a)!-elevation(b)!)<=5)).sort((b,c)=>Math.abs(a.summary!.heartrate-b.summary!.heartrate)-Math.abs(a.summary!.heartrate-c.summary!.heartrate)||b.id.localeCompare(c.id));
 const b=matches[0];if(b){used.add(b.id);pairs.push({recent:a,prior:b,change:(output(a)/output(b)-1)*100,terrainMatched:elevation(a)!==null&&elevation(b)!==null,temperatureMatched:temperature(a.summary?.temperature)&&temperature(b.summary?.temperature)})}}
 const change=pairs.length>=3?median(pairs.map(p=>p.change)):null;
 return {pairs,change,recentCount:recent.length,priorCount:older.length,title:change===null?'Building a fair comparison':`${change>=0?'+':''}${change.toFixed(1)}% ${family==='running'?'speed':'power'} at similar HR`,summary:change===null?`${pairs.length}/3 matched pairs · last 28 vs earlier 56 days`:`Median of ${pairs.length} matched pairs · conditions may differ`,family};
}
