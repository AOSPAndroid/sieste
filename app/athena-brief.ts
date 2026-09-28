import type {AthleteData} from './analytics';
const shift=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const round=(n:number)=>Math.round(n*10)/10;
export function trainingBrief(data:AthleteData,day:string,timeZone:string){
 const date=(s:string)=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s))}catch{return ''}};
 const records=data.activities.map(a=>({a,day:date(a.date)}));
 const window=(start:string,end:string)=>{const list=records.filter(r=>r.day>=start&&r.day<=end),durations=list.map(r=>r.a.summary?.duration).filter(valid),groups=new Map<string,typeof list>();for(const r of list){const k=r.a.sportType+(r.a.subSportType?'/'+r.a.subSportType:'');groups.set(k,[...(groups.get(k)??[]),r])}
 return {start,end,sessions:list.length,recordedMinutes:round(durations.reduce((s,n)=>s+n,0)/60),missingDuration:list.length-durations.length,historyCovered:!!data.historyStart&&data.historyStart.slice(0,10)<=start&&data.historyComplete===true&&!!data.syncedAt&&date(data.syncedAt)>=end,sports:[...groups].map(([sport,rows])=>({sport,sessions:rows.length,minutes:round(rows.reduce((s,r)=>s+(valid(r.a.summary?.duration)?r.a.summary!.duration:0),0)/60)}))};};
 const weeks=Array.from({length:5},(_,i)=>window(shift(day,-7*(i+1)),shift(day,-7*i-1))),baseline=weeks.slice(1),complete=weeks.every(w=>w.historyCovered&&w.missingDuration===0),base=baseline.reduce((s,w)=>s+w.recordedMinutes,0)/4;
 let consecutiveDays=0;for(let i=1;i<=35;i++){if(records.some(r=>r.day===shift(day,-i)))consecutiveDays++;else break}
 return {today:window(day,day),lastThreeCompletedDays:window(shift(day,-3),shift(day,-1)),weeks,recentWeekVsPriorFourWeeksPercent:complete&&base>0?round((weeks[0].recordedMinutes/base-1)*100):null,consecutiveRecordedTrainingDaysThroughYesterday:consecutiveDays,interpretation:'Weeks are consecutive non-overlapping 7-day periods ending yesterday; today excluded. Totals are recorded training time, NOT physiological load. Missing history is not rest. Incomplete totals can describe recorded activity, but cannot establish a complete baseline or safe/unsafe threshold.'};
}
export function recoveryBrief(rows:{date:string;sleepHours:number|null;hrvMs:number|null;restingHrBpm:number|null}[]){
 const summarize=(list:typeof rows)=>Object.fromEntries((['sleepHours','hrvMs','restingHrBpm'] as const).map(k=>{const values=list.map(r=>r[k]).filter((v):v is number=>v!==null&&Number.isFinite(v)&&v>0);return [k,{mean:values.length?round(values.reduce((s,v)=>s+v,0)/values.length):null,count:values.length,days:list.length}]}));
 return {lastThreeNights:summarize(rows.slice(-3)),lastSevenNights:summarize(rows.slice(-7)),prior28Nights:summarize(rows.slice(-35,-7))};
}
