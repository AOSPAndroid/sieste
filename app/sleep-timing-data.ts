const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function clockMinutes(value:unknown){if(typeof value!=='string')return null;const m=value.match(/(?:^|[T ])(\d{2}):(\d{2})(?::\d{2})?$/);return m&&+m[1]<24&&+m[2]<60?+m[1]*60 + +m[2]:null}
export function clockLabel(value:number){const n=((Math.round(value)%1440)+1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`}
// Place the day boundary in the largest empty clock interval. 23:55 and
// 00:05 therefore average to midnight, not noon; no timezone conversion.
function timing(values:(number|null)[]){const sorted=values.filter(finite).sort((a,b)=>a-b);if(!sorted.length)return {values,mean:null,sd:null,count:0,near:0};let largest=-1,start=sorted[0];for(let i=0;i<sorted.length;i++){const next=sorted[(i+1)%sorted.length]+(i===sorted.length-1?1440:0),gap=next-sorted[i];if(gap>largest){largest=gap;start=next%1440}}const aligned=values.map(v=>v===null?null:v<start?v+1440:v),valid=aligned.filter(finite),mean=valid.reduce((a,b)=>a+b,0)/valid.length;return {values:aligned,mean,sd:valid.length>=2?Math.sqrt(valid.reduce((s,v)=>s+(v-mean)**2,0)/valid.length):null,count:valid.length,near:valid.filter(v=>Math.abs(v-mean)<=30).length}}
export function sleepTiming(windows:Record<string,any>,sleep:Record<string,number[]>,end:string,days:number){
 const dates=Array.from({length:days},(_,i)=>{const d=new Date(end+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-days+1+i);return d.toISOString().slice(0,10)});
 const base=dates.map(date=>{const key=date.replaceAll('-',''),w=windows[key]??{};return {date,label:date.slice(8)+'/'+date.slice(5,7),bed:clockMinutes(w.bedtime),wake:clockMinutes(w.wakeTime),hours:finite(sleep[key]?.[0])?sleep[key][0]/3600:null,score:finite(w.score)?w.score:null}});
 const bed=timing(base.map(r=>r.bed)),wake=timing(base.map(r=>r.wake)),rows=base.map((r,i)=>({...r,bed:bed.values[i],wake:wake.values[i]}));
 const span=Math.max(180,...[bed,wake].map(t=>t.mean===null?0:Math.max(...t.values.filter(finite).map(v=>Math.abs(v-t.mean!)))*2+40));
 return {rows,bed,wake,span,latest:[...rows].reverse().find(r=>r.hours!==null||r.bed!==null||r.wake!==null||r.score!==null)};
}
