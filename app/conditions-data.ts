import {sportFamily} from './sports';
// What the weather cost: heart rate in this session against your similar
// sessions (same sport, same output, similar length) in clearly different
// temperatures. Heat usually raises heart rate for the same pace or power.
type Session={id?:string;date?:string;sportType?:string;subSportType?:string;summary?:Record<string,unknown>};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const median=(v:number[])=>{const s=[...v].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
function output(a:Session,family:string){
 const s=a.summary??{};
 if(family==='cycling'&&finite(s.power)&&s.power>0)return {key:'power',value:s.power};
 const speed=finite(s.speed)&&s.speed>0?s.speed:finite(s.distance)&&finite(s.duration)&&s.duration>0?s.distance/s.duration:null;
 return speed?{key:'speed',value:speed}:null;
}
export function heatEffect(detail:Session,history:Session[]){
 const family=sportFamily(detail),s=detail.summary??{},t=s.temperature,hr=s.heartrate,out=output(detail,family);
 if(!['running','cycling'].includes(family)||!finite(t)||!finite(hr)||hr<=0||!out||!finite(s.duration))return null;
 const at=Date.parse(detail.date??'');
 const similar=history.filter(a=>{
  if(a.id===detail.id||sportFamily(a)!==family)return false;
  const p=a.summary??{},o=output(a,family),when=Date.parse(a.date??'');
  return o?.key===out.key&&Math.abs(o.value/out.value-1)<=.08&&finite(p.duration)&&Math.abs(p.duration/(s.duration as number)-1)<=.5&&finite(p.temperature)&&finite(p.heartrate)&&p.heartrate>0&&(!Number.isFinite(at)||Math.abs(when-at)<=365*86400000);
 });
 const cooler=similar.filter(a=>(a.summary!.temperature as number)<=t-6),warmer=similar.filter(a=>(a.summary!.temperature as number)>=t+6);
 const pick=cooler.length>=3?{kind:'warmer' as const,list:cooler}:warmer.length>=3?{kind:'cooler' as const,list:warmer}:null;
 if(!pick)return null;
 const otherHr=median(pick.list.map(a=>a.summary!.heartrate as number)),otherT=median(pick.list.map(a=>a.summary!.temperature as number));
 return {kind:pick.kind,difference:hr-otherHr,otherTemperature:otherT,count:pick.list.length,basis:out.key==='power'?'power':family==='running'?'pace':'speed'};
}
export function heatNote(e:NonNullable<ReturnType<typeof heatEffect>>){
 const d=Math.round(e.difference),diff=Math.abs(d)<2?'about the same heart rate':`heart rate ${d>0?'+':'−'}${Math.abs(d)} bpm`;
 return `${diff} vs ${e.count} similar-${e.basis} sessions at ~${Math.round(e.otherTemperature)}°C`;
}
