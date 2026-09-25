export type MetricStatus={tone:'green'|'lightgreen'|'yellow'|'neutral'|'orange'|'red';label:string;reason:string;range?:[number,number];rangeLabel?:string};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const mean=(v:number[])=>v.reduce((s,n)=>s+n,0)/v.length;
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const shifted=(d:Date,n:number)=>{const t=new Date(d);t.setDate(t.getDate()+n);return iso(t)};
const status=(tone:MetricStatus['tone'],label:string,reason:string):MetricStatus=>({tone,label,reason});
export function metricDecline(key:string,value:number,previous:number,comparison:string):MetricStatus|null{
 if(['hrv','rhr','sleep'].includes(key)||!finite(value)||!finite(previous))return null;
 const change=(value/previous-1)*100,adverse=key==='rhr'?value>previous:value<previous;
 if(!adverse||!['hrv','rhr','vo2','sleep'].includes(key))return null;
 if(key==='rhr'&&value-previous<=2)return null;
 const large=key==='rhr'?value-previous>=5:key==='vo2'?change<=-3:key==='hrv'?change<=-10:change<=-20;
 const amount=key==='rhr'?`${(value-previous).toFixed(1)} bpm`:`${Math.abs(change)<.1?'<0.1':Math.abs(change).toFixed(1)}%`;
 const name=key==='rhr'?'Resting HR':key==='vo2'?'VO₂ estimate':key==='hrv'?'HRV':'Sleep';
 return status(large?'red':'orange',`${key==='rhr'?'↑':'↓'} ${name} ${amount}`,`${comparison}: ${previous.toFixed(1)} → ${value.toFixed(1)}. Resting-HR rises of 2 bpm or less are treated as small variation; other adverse changes are highlighted. Red marks HRV drops ≥10%, VO₂ estimate drops ≥3%, sleep drops ≥20%, or resting HR rises ≥5 bpm. These are sieste display rules, not a diagnosis or proof of lost fitness.`);
}
export function metricStatus(key:string,data:any,now:Date,family:(a:any)=>string,weekly=false):MetricStatus{
 const today=iso(now),rows=new Map<string,number>();
 if(key==='sleep'||key==='hrv'||key==='variability')Object.entries(data[key==='hrv'?'hrv':'sleep']??{}).forEach(([k,v]:any)=>{if(/^\d{8}$/.test(k)&&finite(v?.[0]))rows.set(`${k.slice(0,4)}-${k.slice(4,6)}-${k.slice(6)}`,v[0]/(key==='hrv'?1:3600))});
 if(key==='rhr')[...(data.extra?.bodyvalues?.bodyvalues??[])].sort((a:any,b:any)=>a.timestamp.localeCompare(b.timestamp)).forEach((r:any)=>{if(finite(r.hrRestDynamic)&&new Date(r.timestamp)<=now)rows.set(iso(new Date(r.timestamp)),r.hrRestDynamic)});
 if(key==='vo2'){const grouped=new Map<string,number[]>();data.activities.filter((a:any)=>family(a)==='running'&&finite(a.summary?.vo2max)&&new Date(a.date)<=now).forEach((a:any)=>{const day=iso(new Date(a.date));grouped.set(day,[...(grouped.get(day)??[]),a.summary.vo2max])});grouped.forEach((v,k)=>rows.set(k,mean(v)))}
 if(!['sleep','hrv','rhr','variability','vo2'].includes(key))return status('neutral','Recorded total','More volume, load or calories is not automatically better. No target is set for this total.');
 const all=[...rows].filter(([d])=>d<=today).sort(([a],[b])=>a.localeCompare(b)),last=all.at(-1);
 if(!last)return status('neutral','No reading','No usable reading was supplied.');
 if(last[0]<shifted(now,key==='vo2'?-14:-2))return status('neutral','Older reading',`Latest reading is ${last[0]}; current status is unavailable.`);
 const current=all.filter(([d])=>d>=shifted(now,-6)).map(([,v])=>v);
 if(weekly&&!current.length)return status('neutral','Limited coverage','No readings were supplied in the last seven days.');
 const value=weekly?mean(current):last[1];
 const previous=weekly?all.filter(([d])=>d>=shifted(now,-13)&&d<=shifted(now,-7)).map(([,v])=>v):all.slice(0,-1).filter(([d])=>d>=shifted(now,-35)).slice(-1).map(([,v])=>v);
 const decline=previous.length?metricDecline(key,value,mean(previous),weekly?`Observed daily means, last 7 days (${current.length} readings) vs previous 7 days (${previous.length} readings)`:`Latest vs previous recorded day (${all.at(-2)?.[0]})`):null;
 if(key==='sleep'){const reason='Sleep duration: 8h or more deep green; 7½ to under 8h light green; 7 to under 7½h light yellow; 6 to under 7h amber; below 6h red. Changes from the previous night do not change this colour. These are your display thresholds, not a sleep-quality score.';return status(value<6?'red':value<7?'orange':value<7.5?'yellow':value<8?'lightgreen':'green',value<6?'Below 6h':value<7?'Below 7h':value<7.5?'Below 7½h':value<8?'7½–8h sleep':'8h target met',reason);}
 if(key==='variability'){if(current.length<5)return status('neutral','Need 5 nights','Sleep duration variability requires at least five nights in the last seven days.');const avg=mean(current),sd=Math.sqrt(mean(current.map(v=>(v-avg)**2)))*60;return status(sd<=30?'green':sd<=60?'neutral':sd<=90?'orange':'red',sd<=30?'Consistent duration':sd<=60?'Some variation':sd<=90?'Variable duration':'Large variation','sieste duration SD rules: ≤30 min green, 30–60 neutral, 60–90 orange, >90 red. This does not measure bedtime regularity.');}
 const boundary=shifted(now,weekly||key==='vo2'?-7:-3),start=shifted(now,weekly||key==='vo2'?-34:-30),base=all.filter(([d])=>d>=start&&d<=boundary).map(([,v])=>v);
 if(key==='vo2'){
  if(decline)return decline;
  if(!previous.length)return status('neutral','No prior comparison','A previous running estimate is needed. Missing or stale readings are not judged.');
  const change=(value/mean(previous)-1)*100;return status(change>0?'green':'neutral',change>0?`↑ VO₂ estimate ${change.toFixed(1)}%`:'Estimate unchanged',weekly?'Observed running estimate means: last 7 days vs previous 7 days. Different sessions can affect VO₂ estimates.':'Latest running estimate vs previous recorded day. This is an estimate comparison, not a confirmed fitness change.');
 }
 const supplied=(day:string):[number,number]|null=>{const v=data.hrv?.[day.replaceAll('-','')];return key==='hrv'&&finite(v?.[2])&&finite(v?.[3])&&v[2]<v[3]?[v[2],v[3]]:null};
 let personal=false;try{personal=key==='rhr'&&typeof window!=='undefined'&&window.localStorage.getItem('sieste-rhr-range')==='47-52'}catch{}
 let range=personal?[47,52] as [number,number]:supplied(last[0]);const official=!personal&&!!range;
 if(!range&&base.length<14)return status('neutral','Learning usual range',`${base.length}/14 required readings in the earlier 28-day window. Changes alone do not trigger alerts.`);
 if(!range){const log=key==='hrv',values=base.map(v=>log?Math.log(v):v),avg=mean(values),sd=Math.max(Math.sqrt(mean(values.map(v=>(v-avg)**2))),log?.1:2);range=log?[Math.exp(avg-2*sd),Math.exp(avg+2*sd)]:[Math.max(0,avg-2*sd),avg+2*sd]}
 const [low,high]=range,adverse=key==='hrv'?value<low:value>high;
 const recentDays=[0,1,2].map(i=>shifted(new Date(last[0]+'T12:00:00'),-i));
 const sustained=!personal&&recentDays.every(day=>{const v=rows.get(day),bounds=supplied(day)??range!;return v!==undefined&&(key==='hrv'?v<bounds[0]:v>bounds[1])});
 const rangeLabel=`${low.toFixed(0)}–${high.toFixed(0)} ${key==='hrv'?'ms':'bpm'}`;
 const reason=`${personal?'Your selected RHR range':official?'COROS normal range':'sieste estimated usual range'}: ${rangeLabel}. ${personal?'Saved on this device.':official?'Supplied for '+last[0]+'.':'Mean ±2 standard deviations from '+base.length+' earlier daily readings; log scale for HRV, minimum spread 0.10 log units / 2 bpm.'} Amber means ${key==='hrv'?'below':'above'} this range. ${personal?'Above 52 bpm is amber.':'Red requires three consecutive recorded calendar days outside it in that direction.'} Within-range readings are light green. HRV above the upper bound is deeper green; this colour is a display preference, not proof that higher is always better. These are review flags, not a diagnosis.`;
 return {...status(adverse?(sustained?'red':'orange'):key==='hrv'&&value>high?'green':value>=low&&value<=high?'lightgreen':'neutral',adverse?(sustained?'Outside range · 3 days':key==='hrv'?'Below usual range':'Above usual range'):value<low?'Below usual range':value>high?'Above usual range':'Within usual range',reason),range,rangeLabel};

}
