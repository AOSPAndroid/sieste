import {terrainSamples,gradeFactor,type AnalysisRow} from './section-analysis-data';
import {capacityAt} from './athlete-thresholds';
import {sportFamily} from './sports';

// Running economy: what a kilometre costs you, estimated from heart rate and
// judged against your own usual cost at the same pace.
//
// Oxygen use follows the share of your heart-rate reserve in use (Swain's
// %HRR ≈ %VO₂R): VO₂ = 3.5 + (HR − rest)/(max − rest) × (VO₂max − 3.5) ml/kg/min.
// Divided by speed it gives ml of oxygen per kg per km, the unit lab tests use
// (most runners 190–220, elite about 180). Only steady running counts: no
// warm-up, stops, hills or surges, with pace adjusted for small gradients.

const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
const median=(v:number[])=>{if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
export const ECONOMY_MECHANICS=['cadence','groundContactTime','verticalOscillation','verticalRatio','stepLength','dutyFactor'] as const;
export type Mechanic=typeof ECONOMY_MECHANICS[number];
export type SteadyBlock={seconds:number;share:number;hr:number;speed:number;gap:number;variation:number;power:number|null}&Partial<Record<Mechanic,number|null>>;

/**
 * The steady part of a run, averaged: after the first 10 minutes, moving,
 * gradient within ±4 %, heart rate recorded, and within 12 % of the run's
 * typical grade-adjusted pace over the surrounding minute. Needs 10 minutes.
 */
export function steadyBlock(detail:{summary?:Record<string,unknown>;seriesSampled?:{sampleSize?:unknown;data?:Record<string,unknown>}}):SteadyBlock|null{
 const step=detail.seriesSampled?.sampleSize,d=detail.seriesSampled?.data??{};
 if(!finite(step)||step<=0||step>10)return null;
 const col=(k:string)=>Array.isArray(d[k])?d[k] as unknown[]:[],speed=col('speed'),hr=col('heartrate');
 const n=Math.min(speed.length,hr.length);if(n*step<1200)return null;
 const rows:AnalysisRow[]=Array.from({length:n},(_,i)=>({time:i*step/60,altitude:finite(col('altitude')[i])?col('altitude')[i] as number:null,distance:finite(col('distance')[i])?col('distance')[i] as number:null,speed:finite(speed[i])?speed[i] as number:null}));
 const terrain=terrainSamples(rows,step),recorded=col('grade');
 const grade=(i:number)=>{const g=recorded[i];return finite(g)&&Math.abs(g)<=40?g/100:terrain.grade[i]};
 // Grade-adjusted speed per sample; null where not moving or no heart rate.
 const gap=rows.map((r,i)=>{const v=r.speed,g=grade(i),h=hr[i];return finite(v)&&v>=1.6&&v<=7&&finite(h)&&h>=60&&h<=220&&i*step>=600?v*(finite(g)?gradeFactor(g):1):null});
 const moving=gap.filter(finite).length;if(moving*step<600)return null;
 const typical=median(gap.filter(finite))!,half=Math.max(1,Math.round(30/step));
 const keep:number[]=[];
 for(let i=0;i<n;i++){
  const g=grade(i);if(gap[i]===null||(finite(g)&&Math.abs(g)>.04))continue;
  let sum=0,count=0;for(let j=Math.max(0,i-half);j<=Math.min(n-1,i+half);j++){const v=gap[j];if(v!==null){sum+=v;count++}}
  if(count&&Math.abs(sum/count/typical-1)<=.12)keep.push(i);
 }
 if(keep.length*step<600)return null;
 const avg=(k:string,lo:number,hi:number,share=.6)=>{const c=col(k),v=keep.map(i=>c[i]).filter((x):x is number=>finite(x)&&x>=lo&&x<=hi);return v.length>=keep.length*share?mean(v):null};
 const gaps=keep.map(i=>gap[i]!),g=mean(gaps)!,spread=Math.sqrt(mean(gaps.map(v=>(v-g)**2))!)/g;
 const cadence=avg('cadence',120,240),gct=avg('groundContactTime',120,500);
 return {seconds:keep.length*step,share:keep.length/moving,hr:mean(keep.map(i=>hr[i] as number))!,speed:mean(keep.map(i=>rows[i].speed!))!,gap:g,variation:spread,power:avg('power',50,800,.8),
  cadence,groundContactTime:gct,verticalOscillation:avg('verticalOscillation',2,20),verticalRatio:avg('verticalRatio',2,20),stepLength:avg('stepLength',40,250),
  // Share of each step spent on the ground: contact time over step time.
  dutyFactor:cadence&&gct?gct/1000/(60/cadence):null};
}

type Run={id?:string;date?:string;sportType?:string;subSportType?:string;summary?:Record<string,unknown>;evidence?:{steady?:SteadyBlock|null;economyVersion?:number}|null};
type Athlete={tredictCapacity?:unknown;bodyvalues?:unknown;fitness?:{vo2max?:unknown};fitnessHistory?:Record<string,{vo2max?:unknown}>}|null|undefined;
const day=86400000,time=(d:unknown)=>typeof d==='string'?Date.parse(d):NaN;

/**
 * The heart-rate anchors and VO₂max used for a whole comparison. VO₂max and
 * max HR are held fixed over the year: watch VO₂max is itself estimated from
 * heart rate and pace, so letting it move would hide the change being measured.
 */
export function economyReference(athlete:Athlete,history:Run[],date:string){
 const at=time(date),year=history.filter(a=>Number.isFinite(time(a.date))&&time(a.date)<=at&&at-time(a.date)<=365*day);
 const body=Array.isArray(athlete?.bodyvalues)?athlete!.bodyvalues as {timestamp?:string;hrRestDynamic?:unknown;restingHeartrate?:unknown;hrMaxDynamic?:unknown}[]:[];
 const rests=body.map(r=>({t:time(r.timestamp),v:r.hrRestDynamic??r.restingHeartrate})).filter((r):r is {t:number;v:number}=>Number.isFinite(r.t)&&finite(r.v)&&r.v>25&&r.v<110);
 // Resting HR from the fortnight before each run, else the year's median.
 const yearRest=median(rests.filter(r=>r.t<=at&&at-r.t<=365*day).map(r=>r.v));
 const restAt=(when:number)=>median(rests.filter(r=>r.t<=when&&when-r.t<=14*day).map(r=>r.v))??yearRest;
 const capacity=capacityAt(athlete?.tredictCapacity,'running',date)?.hrMax??null;
 const loggedMax=body.filter(r=>time(r.timestamp)<=at).sort((a,b)=>time(b.timestamp)-time(a.timestamp)).map(r=>r.hrMaxDynamic).find((v):v is number=>finite(v)&&v>120&&v<230)??null;
 const seen=year.map(a=>a.summary?.heartrateMax).filter((v):v is number=>finite(v)&&v>120&&v<230).sort((a,b)=>b-a);
 const max=capacity??loggedMax??(seen.length>=10?seen[1]:null);
 const sessionVo2=year.filter(a=>sportFamily(a)==='running').map(a=>a.summary?.vo2max).filter((v):v is number=>finite(v)&&v>20&&v<90);
 const corosVo2=Object.entries(athlete?.fitnessHistory??{}).filter(([k])=>{const t=Date.parse(`${k.slice(0,4)}-${k.slice(4,6)}-${k.slice(6,8)}`);return t<=at&&at-t<=365*day}).map(([,v])=>v?.vo2max).filter((v):v is number=>finite(v)&&v>20&&v<90);
 const vo2max=median(sessionVo2.length>=3?sessionVo2:corosVo2)??(finite(athlete?.fitness?.vo2max)?athlete!.fitness!.vo2max as number:null);
 return {max,vo2max,restAt,maxSource:capacity?'Tredict max HR':loggedMax?'daily max HR':max?'second-highest recorded HR this year':null};
}

/** Estimated oxygen and heartbeat cost of a kilometre at the block's pace. */
export function economyOf(block:Pick<SteadyBlock,'hr'|'gap'|'power'>,rest:number|null,max:number|null,vo2max:number|null,weight:number|null=null){
 const minutesPerKm=1000/block.gap/60;
 const reserve=rest!==null&&max!==null&&max-rest>40?(block.hr-rest)/(max-rest):null;
 const oxygen=reserve!==null&&reserve>.2&&reserve<1.05&&vo2max!==null?(3.5+reserve*(vo2max-3.5))*minutesPerKm:null;
 return {oxygen,reserve,netBeats:rest!==null?(block.hr-rest)*minutesPerKm:null,energy:block.power!==null&&weight?block.power/weight/block.gap:null};
}

/** A run's steady block: stored with its analysis, else the whole-run averages of a flat run as a rough stand-in. */
function blockOf(a:Run):(SteadyBlock&{rough?:boolean})|null{
 if(a.evidence?.steady)return a.evidence.steady;
 const s=a.summary??{},speed=finite(s.speed)&&s.speed>0?s.speed:finite(s.distance)&&finite(s.duration)&&s.duration>0?s.distance/s.duration:null,hr=s.heartrate,dist=s.distance,climb=(s.altitude as {ascent?:unknown}|undefined)?.ascent;
 if(!speed||speed<1.6||!finite(hr)||!finite(s.duration)||s.duration<1200||!finite(dist)||(finite(climb)&&climb/(dist/1000)>10))return null;
 const pick=(k:string)=>finite(s[k])?s[k] as number:null;
 return {rough:true,seconds:s.duration,share:1,hr,speed,gap:speed,variation:0,power:pick('power'),cadence:pick('cadence'),groundContactTime:pick('groundContactTime'),verticalOscillation:pick('verticalOscillation'),verticalRatio:pick('verticalRatio'),stepLength:pick('stepLength'),dutyFactor:pick('cadence')&&pick('groundContactTime')?pick('groundContactTime')!/1000/(60/pick('cadence')!):null};
}
/** Least-squares line y = a + b·x. */
function fit(points:[number,number][]){const n=points.length,mx=mean(points.map(p=>p[0]))!,my=mean(points.map(p=>p[1]))!,sxx=points.reduce((s,p)=>s+(p[0]-mx)**2,0);const b=sxx?points.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/sxx:0;return {a:my-b*mx,b,n}}
const correlation=(x:number[],y:number[])=>{const mx=mean(x)!,my=mean(y)!,sx=Math.sqrt(x.reduce((s,v)=>s+(v-mx)**2,0)),sy=Math.sqrt(y.reduce((s,v)=>s+(v-my)**2,0));return sx&&sy?x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/(sx*sy):0};

/**
 * This run's economy against your own: the cost your past steady runs predict
 * at this pace (a line fitted over the last year), the 30-day and yearly
 * average gap from that line, and which mechanics, for the pace, go with
 * cheaper runs (partial correlation, pace held constant).
 */
export function runningEconomy(detail:Run&Parameters<typeof steadyBlock>[0],history:Run[],athlete:Athlete,weight:number|null=null){
 const date=detail.date??'',at=time(date),current=steadyBlock(detail)??blockOf(detail);if(!current||!Number.isFinite(at))return null;
 const ref=economyReference(athlete,history,date),cost=(b:SteadyBlock,when:number)=>economyOf(b,ref.restAt(when),ref.max,ref.vo2max,weight);
 const today=cost(current,at);
 const runs=history.filter(a=>a.id!==detail.id&&a.sportType===detail.sportType&&(a.subSportType??'generic')===(detail.subSportType??'generic')&&Number.isFinite(time(a.date))&&time(a.date)<at&&at-time(a.date)<=365*day);
 // Like with like: steady blocks with steady blocks, whole-run averages with whole-run averages.
 const steady=!('rough' in current&&current.rough),past=runs.map(a=>({a,b:blockOf(a)})).filter((r):r is {a:Run;b:SteadyBlock&{rough?:boolean}}=>!!r.b&&!r.b.rough===steady)
  .map(r=>({when:time(r.a.date),block:r.b,cost:cost(r.b,time(r.a.date))})).filter(r=>r.cost.oxygen!==null||r.cost.netBeats!==null);
 const measure:'oxygen'|'netBeats'=today.oxygen!==null?'oxygen':'netBeats';
 const usable=past.filter(r=>r.cost[measure]!==null),value=today[measure];
 const line=usable.length>=8?fit(usable.map(r=>[r.block.gap,r.cost[measure]!])):null;
 const paceSupported=!!line&&current.gap>=Math.min(...usable.map(r=>r.block.gap))*.95&&current.gap<=Math.max(...usable.map(r=>r.block.gap))*1.05;
 const prediction=line&&paceSupported?line.a+line.b*current.gap:null;
 const expected=prediction!==null&&prediction>0&&value!==null?prediction:null,vsUsual=expected!==null&&value!==null?value/expected-1:null;
 const residual=(r:typeof usable[number])=>r.cost[measure]!/(line!.a+line!.b*r.block.gap)-1;
 const windowGap=(days:number)=>{const w=line?usable.filter(r=>at-r.when<=days*day):[];return w.length>=3?{runs:w.length,gap:mean(w.map(residual))!}:null};
 // Which mechanics go with cheaper running, with pace taken out of both sides.
 const links=line&&usable.length>=10?ECONOMY_MECHANICS.flatMap(k=>{const rows=usable.filter(r=>finite(r.block[k]));if(rows.length<10)return [];const m=fit(rows.map(r=>[r.block.gap,r.block[k] as number])),x=rows.map(r=>(r.block[k] as number)-(m.a+m.b*r.block.gap)),y=rows.map(residual),r=correlation(x,y);return Math.abs(r)>=.3?[{key:k,r,runs:rows.length,best:median(rows.filter((_,i)=>y[i]<0).map(row=>row.block[k] as number)),today:finite(current[k])?current[k] as number:null}]:[]}).sort((a,b)=>Math.abs(b.r)-Math.abs(a.r)):[];
 return {block:current,steady,reference:ref,measure,today,expected,vsUsual,paceSupported,month:windowGap(30),year:windowGap(365),links,history:usable.length,
  // Points for a cost-vs-pace chart: past runs and this one.
  points:usable.map(r=>({gap:r.block.gap,cost:r.cost[measure]!,recent:at-r.when<=30*day})),line};
}
