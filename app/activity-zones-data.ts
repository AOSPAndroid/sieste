import {bandRange,histogramInZones,type ZoneBand} from './athlete-thresholds';
export function activityZoneTables(distribution:unknown){
 if(!distribution||typeof distribution!=='object')return [];
 const labels:Record<string,string>={heartrate:'Heart rate',power:'Power',pace:'Pace',cadence:'Cadence'};
 return Object.entries(distribution).filter(([,values])=>Array.isArray(values)&&values.length>0).map(([key,raw])=>{
  const values=(raw as unknown[]).map(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null);
  const total=values.reduce<number>((sum,v)=>sum+(v??0),0);
  return {key,label:labels[key]??key.replace(/([a-z])([A-Z])/g,'$1 $2'),total,partial:values.some(v=>v===null),rows:values.map((seconds,index)=>({zone:index+1,seconds,percent:seconds!==null&&total>0?seconds/total*100:null}))};
 }).sort((a,b)=>a.key==='heartrate'?-1:b.key==='heartrate'?1:a.label.localeCompare(b.label));
}
export function zoneDuration(seconds:number|null){
 if(seconds===null)return '—';const s=Math.round(seconds);
 return s>=3600?`${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m ${s%60}s`:`${Math.floor(s/60)}m ${s%60}s`;
}

export type ZoneTable=ReturnType<typeof activityZoneTables>[number]&{names?:string[];ranges?:string[]};
/**
 * Zone tables for one workout, named with the athlete's own heart-rate zones
 * when they are known: recorded zone times keep their values and gain names
 * when the count matches; without recorded heart-rate zones, the heart-rate
 * histogram is sorted into those zones instead of fixed bpm bands.
 */
export function workoutZoneTables(summary:{zonesDistribution?:unknown},histogram:{secondsByBpm?:Record<string,number>;validSeconds?:number}|null|undefined,bands:ZoneBand[]|null){
 const tables:ZoneTable[]=activityZoneTables(summary.zonesDistribution),hr=tables.find(t=>t.key==='heartrate');
 const named=(b:ZoneBand[])=>({names:b.map((z,i)=>z.name||`Zone ${i+1}`),ranges:b.map(z=>bandRange(z,''))});
 if(bands&&hr&&hr.rows.length===bands.length)Object.assign(hr,named(bands));
 if(bands&&!hr&&histogram?.validSeconds){
  const {seconds}=histogramInZones(histogram.secondsByBpm,bands),total=seconds.reduce((a,b)=>a+b,0);
  if(total>0)tables.unshift({key:'heartrate',label:'Heart rate',total,partial:false,rows:seconds.map((s,i)=>({zone:i+1,seconds:s,percent:s/total*100})),...named(bands)});
 }
 return tables;
}
