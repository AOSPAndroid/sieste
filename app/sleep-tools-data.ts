import {sleepTiming} from './sleep-timing-data';
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const avg=(values:(number|null)[])=>{const v=values.filter(valid);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
export function sleepToolsData(data:any,end:string,days:number,target:number){
 const timing=sleepTiming(data.extra?.coros?.sleepWindows??{},data.sleep??{},end,days),body=new Map<string,number>();
 for(const r of [...(data.extra?.bodyvalues?.bodyvalues??[])].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))){if(valid(r.hrRestDynamic)&&r.hrRestDynamic>0){const d=new Date(r.timestamp);body.set(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,r.hrRestDynamic)}}
 const rows=timing.rows.map(r=>{const key=r.date.replaceAll('-',''),w=data.extra?.coros?.sleepWindows?.[key]??{},hrv=data.hrv?.[key]?.[0];return {...r,awake:valid(w.awakeMinutes)?w.awakeMinutes:null,naps:valid(w.napMinutes)?w.napMinutes:null,hrv:valid(hrv)&&hrv>0?hrv:null,rhr:body.get(r.date)??null,shortfall:r.hours===null?null:Math.max(0,target-r.hours),weekend:[0,6].includes(new Date(r.date+'T12:00:00').getDay())}});
 const recorded=rows.filter(r=>r.hours!==null),week=rows.slice(-7),complete=week.length===7&&week.every(r=>r.hours!==null),groups=[false,true].map(weekend=>{const r=rows.filter(r=>r.weekend===weekend);return {nights:r.filter(r=>r.hours!==null).length,sleep:avg(r.map(r=>r.hours)),bed:avg(r.map(r=>r.bed)),wake:avg(r.map(r=>r.wake))}});
 const recovery=(key:'hrv'|'rhr')=>[true,false].map(short=>{const pairs=rows.filter(r=>r.hours!==null&&(short?r.hours<7:r.hours>=7)&&r[key]!==null);return {count:pairs.length,value:pairs.length>=3?avg(pairs.map(r=>r[key])):null}});
 return {rows,mean:avg(rows.map(r=>r.hours)),recorded:recorded.length,met:recorded.filter(r=>r.hours!>=target).length,shortNights:recorded.filter(r=>r.hours!<7).length,shortfall:complete?week.reduce((s,r)=>s+r.shortfall!,0):null,coverage:week.filter(r=>r.hours!==null).length,groups,hrv:recovery('hrv'),rhr:recovery('rhr')};
}
