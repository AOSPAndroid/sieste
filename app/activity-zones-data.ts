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
