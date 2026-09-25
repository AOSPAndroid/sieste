import type {AthleteData} from './analytics';
import {sportFamily} from './sports';
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
type Band={name?:string;from:number;to:number};
export function zoneWeek(now:Date,offset:number){const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-(start.getDay()+6)%7+offset*7);const end=new Date(start);end.setDate(end.getDate()+7);return {start,end};}
export function weeklyZones(data:AthleteData,now:Date,offset:number,family:string){
 const {start,end}=zoneWeek(now,offset),cutoff=new Date(Math.min(now.getTime(),end.getTime()-1));
 const sessions=data.activities.filter(a=>sportFamily(a)===family&&new Date(a.date)>=start&&new Date(a.date)<end&&new Date(a.date)<=now);
 const versions=data.extra?.zones?.zones?.[family]?.heartrate??{};
 const definition=(date:Date):Band[]|null=>{const key=Object.keys(versions).filter(k=>new Date(k)<=date).sort((a,b)=>+new Date(a)-+new Date(b)).at(-1),z=key?versions[key]:null;return Array.isArray(z)&&z.length&&z.every(b=>Number.isFinite(b.from)&&Number.isFinite(b.to)&&(b.from<0||b.to<0||b.from<=b.to))?z:null;};
 const bands=definition(cutoff),groups=new Map<string,{id:string;label:string;bands:Band[]|null;seconds:number[];covered:number;unclassified:number}>();
 for(const a of sessions){
  const raw=a.summary?.zonesDistribution?.heartrate,h=a.hrHistogram,recorded=Array.isArray(raw)&&raw.length>0&&raw.every(valid)&&raw.some(v=>v>0),own=definition(new Date(a.date));
  let values:number[]=[],unclassified=0,id='',label='',used:Band[]|null=null;
  if(bands&&h&&h.validSeconds>0){values=bands.map(()=>0);for(const [b,t] of Object.entries(h.secondsByBpm)){if(!valid(t)||!valid(+b)||+b===0)continue;const i=bands.findIndex(z=>(z.from<0||+b>=z.from)&&(z.to<0||+b<=z.to));if(i<0)unclassified+=t;else values[i]+=t;}id='fixed';label='Saved BPM zones';used=bands;}
  else if(recorded&&own&&own.length===raw.length){used=own;values=raw;id=JSON.stringify(own)===JSON.stringify(bands)?'fixed':JSON.stringify(own);label=id==='fixed'?'Saved BPM zones':'Earlier BPM zones';}
  else if(recorded){values=raw;id=`unverified-${a.provider??data.provider??'tredict'}-${raw.length}`;label=`${(a.provider??data.provider??'tredict').toUpperCase()} · ${raw.length} recorded zones`;}
  if(!values.some(v=>v>0))continue;
  const g=groups.get(id)??{id,label,bands:used,seconds:values.map(()=>0),covered:0,unclassified:0};values.forEach((v,i)=>g.seconds[i]+=v);g.covered++;g.unclassified+=unclassified;groups.set(id,g);
 }
 return {start,end,sessions:sessions.length,partial:offset===0,groups:[...groups.values()].sort((a,b)=>a.id==='fixed'?-1:b.id==='fixed'?1:b.covered-a.covered)};
}
