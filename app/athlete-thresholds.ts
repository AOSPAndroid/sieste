// The athlete's own thresholds and zones as Tredict keeps them: dated
// versions per sport, so an old workout is judged by the values that held
// on its day, not today's.
export type ZoneBand={name?:string;from:number;to:number;intensity?:number};
export type Capacity={timestamp?:string;hrMax?:number;hrLth?:number;ftp?:number;ftpa?:number};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const time=(d:unknown)=>typeof d==='string'?Date.parse(d):NaN;

/** The latest capacity entry for the sport recorded on or before the date. */
export function capacityAt(capacity:unknown,family:string,date:string|number|Date){
 const list=(capacity as Record<string,Capacity[]>|null)?.[family],at=new Date(date).getTime();
 if(!Array.isArray(list)||!Number.isFinite(at))return null;
 const entry=list.filter(c=>Number.isFinite(time(c?.timestamp))&&time(c.timestamp)<=at).sort((a,b)=>time(b.timestamp)-time(a.timestamp))[0];
 if(!entry)return null;
 const pick=(v:unknown)=>finite(v)&&v>0?v:null;
 return {since:entry.timestamp!,hrMax:pick(entry.hrMax),lthr:pick(entry.hrLth),ftp:pick(entry.ftp),ftpa:pick(entry.ftpa)};
}

/** The zone bands for a sport and sensor that held on the date, with when they were set; open ends are −1. */
export function zoneVersionAt(zones:unknown,family:string,date:string|number|Date,sensor='heartrate'):{since:string;bands:ZoneBand[]}|null{
 const versions=(zones as Record<string,Record<string,Record<string,ZoneBand[]>>>|null)?.[family]?.[sensor],at=new Date(date).getTime();
 if(!versions||typeof versions!=='object'||!Number.isFinite(at))return null;
 const key=Object.keys(versions).filter(k=>time(k)<=at).sort((a,b)=>time(a)-time(b)).at(-1),bands=key?versions[key]:null;
 return key&&Array.isArray(bands)&&bands.length&&bands.every(b=>finite(b?.from)&&finite(b?.to)&&(b.from<0||b.to<0||b.from<=b.to))?{since:key,bands}:null;
}
export const zonesAt=(zones:unknown,family:string,date:string|number|Date,sensor='heartrate')=>zoneVersionAt(zones,family,date,sensor)?.bands??null;

/** Seconds of a heart-rate histogram in each band; readings outside every band are counted apart. */
export function histogramInZones(secondsByBpm:Record<string,number>|undefined,bands:ZoneBand[]){
 const seconds=bands.map(()=>0);let outside=0;
 for(const [bpm,t] of Object.entries(secondsByBpm??{})){const b=+bpm;if(!finite(t)||t<=0||!(b>0))continue;const i=bands.findIndex(z=>(z.from<0||b>=z.from)&&(z.to<0||b<=z.to));if(i<0)outside+=t;else seconds[i]+=t}
 return {seconds,outside};
}

/** "146–168 bpm", "≤145 bpm", "169+ bpm"; no unit gives "146–168". */
export function bandRange(b:ZoneBand,unit='bpm'){const tail=unit?` ${unit}`:'';return b.from<0?`≤${b.to}${tail}`:b.to<0?`${b.from}+${tail}`:`${b.from}–${b.to}${tail}`}

/** The latest body weight logged on or within 60 days before the date. */
export function weightAt(bodyvalues:unknown,date:string|number|Date){
 const at=new Date(date).getTime();if(!Array.isArray(bodyvalues)||!Number.isFinite(at))return null;
 const row=bodyvalues.filter((r:{timestamp?:string;weightInKilograms?:unknown})=>finite(r?.weightInKilograms)&&r.weightInKilograms>20&&r.weightInKilograms<250&&time(r.timestamp)<=at&&at-time(r.timestamp)<=60*86400000).sort((a,b)=>time(b.timestamp)-time(a.timestamp))[0];
 return row?{weight:row.weightInKilograms as number,on:String(row.timestamp).slice(0,10)}:null;
}
