// Resolve each dated metric independently. A missing primary reading must not erase fallback data.
const valid=(v:any)=>v!==null&&v!==undefined&&(typeof v!=='number'||Number.isFinite(v));
function daily(primary:any={},fallback:any={}){
 const values:any={},sources:any={};
 for(const [name,rows] of [['coros',fallback],['tredict',primary]] as const)for(const [day,pair] of Object.entries(rows??{})){
  if(Array.isArray(pair)&&typeof pair[0]==='number'&&Number.isFinite(pair[0])&&pair[0]>0){values[day]=pair;sources[day]=name;}
 }
 return {values,sources};
}
export function mergeBodyValues(primary:any[]=[],fallback:any[]=[],fallbackProvider='coros'){
 const days=new Map<string,any>();
 for(const [provider,rows] of [[fallbackProvider,fallback],['tredict',primary]] as const)for(const row of [...rows].sort((a,b)=>(a.timestamp??'').localeCompare(b.timestamp??''))){
  const day=row.timestamp?.slice(0,10);if(!day)continue;
  const value=days.get(day)??{timestamp:day+'T00:00:00Z',fieldSources:{}};
  for(const [key,v] of Object.entries(row))if(!['timestamp','source','fieldSources'].includes(key)&&valid(v)&&(!['hrRestDynamic','weightInKilograms','heightInCentimeters'].includes(key)||(typeof v==='number'&&v>0))){value[key]=v;value.fieldSources[key]=provider;}
  value.source='Tredict primary · COROS fallback';days.set(day,value);
 }
 return [...days.values()].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
}
// Tredict is the workout source, but it imports from COROS some time after a
// session ends. A recent COROS session with no Tredict session starting within
// five minutes is shown provisionally until Tredict delivers it; the Tredict
// copy then carries the COROS id as an alias so removals and alerts match.
const PENDING_WINDOW=3*86400000,SAME_SESSION=5*60000;
type Session={id:string;date:string;provider?:string;fallbackId?:string;provisional?:string};
export function withPendingCorosSessions<T extends Session>(primary:T[]=[],coros:T[]=[],now=Date.now()):T[]{
 const recent=coros.filter(a=>a?.provider==='coros'&&typeof a.id==='string'&&Number.isFinite(Date.parse(a.date))&&now-Date.parse(a.date)<=PENDING_WINDOW&&Date.parse(a.date)<=now+SAME_SESSION);
 if(!recent.length)return primary;
 const matched=new Set<string>();
 const activities=primary.map(a=>{
  const t=Date.parse(a.date);if(!Number.isFinite(t))return a;
  const twin=recent.find(c=>!matched.has(c.id)&&Math.abs(Date.parse(c.date)-t)<=SAME_SESSION);
  if(!twin)return a;matched.add(twin.id);
  return a.fallbackId?a:{...a,fallbackId:twin.id};
 });
 const pending=recent.filter(c=>!matched.has(c.id)).map(c=>({...c,provisional:'tredict'}) as T);
 return pending.length?[...pending,...activities].sort((a,b)=>String(b.date).localeCompare(String(a.date))):activities;
}
export function combineProviders(training:any,health:any){
 if(!training)return health;if(!health)return training;
 const sleep=daily(training.sleep,health.sleep),hrv=daily(training.hrv,health.hrv);
 return {...training,activities:withPendingCorosSessions(training.activities,health.activities),provider:'tredict',sleep:sleep.values,hrv:hrv.values,extra:{...training.extra,bodyvalues:{...health.extra?.bodyvalues,...training.extra?.bodyvalues,bodyvalues:mergeBodyValues(training.extra?.bodyvalues?.bodyvalues,health.extra?.bodyvalues?.bodyvalues)},coros:health.extra?.coros},sources:{...training.sources,corosHealth:{provider:'coros',retrievedAt:health.syncedAt}},metricSources:{sleep:sleep.sources,hrv:hrv.sources},warnings:[...new Set([...(training.warnings??[]),...(health.warnings??[])])],sourceNote:'Tredict primary · COROS fills missing readings and additional metrics',healthSyncedAt:health.syncedAt};
}
