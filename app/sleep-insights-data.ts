import {sleepTiming} from './sleep-timing-data';
export const shiftSleepDate=(date:string,n:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export const lateBedtime=(minutes:number|null)=>minutes!==null&&minutes%1440>0&&minutes%1440<720;
export function sleepInsights(data:any,end:string,days:number,selectedDate?:string){
 const windows=data.extra?.coros?.sleepWindows??{},sleep=data.sleep??{},period=(end:string,n:number)=>sleepTiming(windows,sleep,end,n),current=period(end,days),previous=period(shiftSleepDate(end,-days),days),week=period(end,7),priorWeek=period(shiftSleepDate(end,-7),7);
 const mean=(rows:typeof current.rows)=>{const v=rows.filter(r=>r.hours!==null&&r.hours>0);return {value:v.length?v.reduce((s,r)=>s+r.hours!,0)/v.length:null,count:v.length}};
 const latest=current.rows.find(r=>r.date===selectedDate)??current.latest,anchor=latest?.date??end,night=latest?.hours??null;
 const compare=(label:string,rows:typeof current.rows,required:number)=>{const m=mean(rows);return {label,count:m.count,total:rows.length,baseline:m.count>=required?m.value:null,delta:night!==null&&m.count>=required?(night-m.value!)*60:null}};
 const yesterday=compare('vs yesterday',period(shiftSleepDate(anchor,-1),1).rows,1),seven=compare('vs prior 7d',period(shiftSleepDate(anchor,-1),7).rows,4),thirty=compare('vs prior 30d',period(shiftSleepDate(anchor,-1),30).rows,15);
 const lastYear=Number(anchor.slice(0,4))-1,yearDate=anchor.slice(5)==='02-29'?`${lastYear}-02-28`:`${lastYear}${anchor.slice(4)}`,year=compare('vs same 7d last year',period(yearDate,7).rows,4);
 const w=mean(week.rows),pw=mean(priorWeek.rows),weeklyDelta=w.count>=4&&pw.count>=4?(w.value!-pw.value!)*60:null;
 let streak=0,longest=0;for(const r of current.rows){streak=r.hours!==null&&r.hours>0&&r.hours<7?streak+1:0;longest=Math.max(longest,streak)}
 const lastIndex=current.rows.findIndex(r=>r.date===anchor);let recentStreak=0;for(let i=lastIndex;i>=0;i--){const h=current.rows[i].hours;if(h===null||h<=0||h>=7)break;recentStreak++}
 return {current,previous,latest,comparisons:[yesterday,seven,thirty],year,weeklyDelta,week:w,priorWeek:pw,late:current.rows.filter(r=>lateBedtime(r.bed)).length,timed:current.bed.count,longest,recentStreak};
}
