export type Window={start:Date;end:Date};
const day=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const shift=(d:Date,n:number)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r};
export function lastYear(d:Date){return new Date(d.getFullYear()-1,d.getMonth(),Math.min(d.getDate(),new Date(d.getFullYear()-1,d.getMonth()+1,0).getDate()))}
export function comparisonPeriods(now:Date){const end=shift(day(now),1),today=day(now),priorEnd=shift(lastYear(today),1);return [7,30].map(n=>({label:`Last ${n} days`,current:{start:shift(end,-n),end},previous:{start:shift(end,-n*2),end:shift(end,-n)},year:{start:shift(priorEnd,-n),end:priorEnd}})).concat([{label:'Year to date',current:{start:new Date(today.getFullYear(),0,1),end},previous:{start:new Date(today.getFullYear()-1,0,1),end:priorEnd},year:{start:new Date(today.getFullYear()-1,0,1),end:priorEnd}}])}
export function volume(data:any,window:Window,now:Date,family:(a:any)=>string,sport:string,metric:string){
 const sessions=data.activities.filter((a:any)=>{const d=new Date(a.date);return d>=window.start&&d<window.end&&d<=now&&(sport==='all'||family(a)===sport)});
 const values=sessions.map((a:any)=>metric==='sessions'?1:a.summary?.[metric==='distance'?'distance':'duration']);
 const valid=values.filter((v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
 const complete=!!data.historyStart&&new Date(data.historyStart)<=window.start&&data.historyComplete!==false;
 const value=valid.length?valid.reduce((s:number,v:number)=>s+v,0)/(metric==='distance'?1000:metric==='duration'?3600:1):sessions.length?null:complete?0:null;
 return {value,historyCovered:complete,complete:complete&&valid.length===sessions.length,sessions:sessions.length,missing:sessions.length-valid.length};
}
export function difference(current:ReturnType<typeof volume>,previous:ReturnType<typeof volume>){if(!current.complete||!previous.complete||current.value==null||previous.value==null)return null;return {absolute:current.value-previous.value,percent:previous.value===0?null:(current.value/previous.value-1)*100}}
