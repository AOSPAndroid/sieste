// How a workout's sections (laps, efforts or climbs) changed through the
// session, and how hard you went on the hills compared with the flat.
// Times are elapsed minutes, as in the profile chart; step is seconds.
export type AnalysisRow={time:number;altitude?:number|null;distance?:number|null;speed?:number|null;power?:number|null;heartrate?:number|null;cadence?:number|null;stepLength?:number|null};
export type Span={start:number;end:number};
type Metric='speed'|'gap'|'power'|'heartrate'|'cadence'|'stepLength';
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const positive=(v:unknown):v is number=>finite(v)&&v>0;
const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;

/**
 * Effort of running a gradient relative to the flat, close to the curve
 * fitted from heart rate in large running datasets: about 3% per 1% uphill,
 * easiest near −10%, steep descents cost again. Clamped against GPS noise.
 */
export function gradeFactor(grade:number){
 const g=Math.max(-30,Math.min(30,grade*100));
 return Math.max(.8,1+.0302*g+.00099*g*g);
}

/** Shared per-sample terrain: smoothed altitude, distance along the route and local gradient. */
export function terrainSamples(rows:readonly AnalysisRow[],step:number){
 const n=rows.length,half=Math.max(1,Math.round(15/step)),altitude:(number|null)[]=new Array(n).fill(null);
 // Altitude averaged over about 30 s, so barometer jitter does not count as climbing.
 for(let i=0;i<n;i++){let sum=0,count=0;for(let j=Math.max(0,i-half);j<=Math.min(n-1,i+half);j++){const a=rows[j].altitude;if(finite(a)){sum+=a;count++}}if(count&&finite(rows[i].altitude))altitude[i]=sum/count}
 // Distance from the recorded stream when it only ever grows, otherwise from speed.
 const recorded=rows.every((r,i)=>!i||!finite(r.distance)||!finite(rows[i-1].distance)||r.distance>=rows[i-1].distance!)&&rows.filter(r=>finite(r.distance)).length>n*.8;
 const distance:number[]=[];let run=0;
 for(let i=0;i<n;i++){if(recorded&&finite(rows[i].distance))run=Math.max(run,rows[i].distance!);else if(i&&positive(rows[i-1].speed))run+=rows[i-1].speed!*step;distance.push(run)}
 // Gradient over about 50 m either side of each sample.
 const grade:(number|null)[]=new Array(n).fill(null);let lo=0,hi=0;
 for(let i=0;i<n;i++){
  while(lo<i&&distance[i]-distance[lo+1]>=50)lo++;
  if(hi<i)hi=i;while(hi<n-1&&distance[hi]-distance[i]<50)hi++;
  const span=distance[hi]-distance[lo],a=altitude[lo],b=altitude[hi];
  if(span>=40&&finite(a)&&finite(b))grade[i]=(b-a)/span;
 }
 return {altitude,distance,grade};
}
export type Terrain=ReturnType<typeof terrainSamples>;

const index=(minutes:number,step:number)=>Math.max(0,Math.round(minutes*60/step));
/** Climbing and descending in a span (1 m hysteresis), with its net gradient. */
export function spanTerrain(terrain:Terrain,step:number,span:Span){
 const from=index(span.start,step),to=Math.min(terrain.altitude.length-1,index(span.end,step));
 let ascent=0,descent=0,anchor:number|null=null,first:number|null=null,last:number|null=null;
 for(let i=from;i<=to;i++){const a=terrain.altitude[i];if(!finite(a))continue;first??=a;last=a;if(anchor===null){anchor=a;continue}if(a-anchor>=1){ascent+=a-anchor;anchor=a}else if(anchor-a>=1){descent+=anchor-a;anchor=a}}
 const metres=to>from?terrain.distance[to]-terrain.distance[from]:0;
 return {ascent:first===null?null:Math.round(ascent),descent:first===null?null:Math.round(descent),grade:first!==null&&last!==null&&metres>=100?(last-first)/metres*100:null};
}

/** Grade-adjusted speed in a span: the flat-ground speed for the same running effort. */
export function spanGap(rows:readonly AnalysisRow[],terrain:Terrain,step:number,span:Span){
 const from=index(span.start,step),to=Math.min(rows.length,index(span.end,step));let sum=0,count=0;
 for(let i=from;i<to;i++){const v=rows[i].speed,g=terrain.grade[i];if(positive(v)){sum+=v*(finite(g)?gradeFactor(g):1);count++}}
 return count?sum/count:null;
}

export type HillBucket={seconds:number;speed:number|null;gap:number|null;power:number|null;heartrate:number|null;cadence:number|null};
/** Climbing threshold: rolling 2% rises already change a ride; on foot 3%. */
export const hillGrade=(family:string)=>family==='cycling'?.02:.03;
/** Time on climbs, on the flat and downhill, with how you moved on each. Stops are left out. */
export function hillSplit(rows:readonly AnalysisRow[],terrain:Terrain,step:number,threshold=.03){
 const sums={up:[] as number[],flat:[] as number[],down:[] as number[]};
 const acc=Object.fromEntries((['up','flat','down'] as const).map(k=>[k,{speed:[] as number[],gap:[] as number[],power:[] as number[],heartrate:[] as number[],cadence:[] as number[]}]));
 rows.forEach((r,i)=>{
  const g=terrain.grade[i];if(!finite(g)||!positive(r.speed))return;
  const k=g>=threshold?'up':g<=-threshold?'down':'flat',a=acc[k];sums[k].push(step);
  a.speed.push(r.speed);a.gap.push(r.speed*gradeFactor(g));if(finite(r.power)&&r.power>=0)a.power.push(r.power);if(positive(r.heartrate))a.heartrate.push(r.heartrate);if(positive(r.cadence))a.cadence.push(r.cadence);
 });
 const bucket=(k:'up'|'flat'|'down'):HillBucket=>{const a=acc[k];return {seconds:sums[k].length*step,speed:mean(a.speed),gap:mean(a.gap),power:a.power.length>a.speed.length*.5?mean(a.power):null,heartrate:a.heartrate.length>a.speed.length*.5?mean(a.heartrate):null,cadence:a.cadence.length>a.speed.length*.5?mean(a.cadence):null}};
 return {up:bucket('up'),flat:bucket('flat'),down:bucket('down')};
}

export type HillVerdict={kind:'pushed'|'eased'|'even';metric:'gap'|'power'|'heartrate';up:number;flat:number;change:number;hrUp:number|null;hrFlat:number|null};
/**
 * Did you push the hills? On foot, grade-adjusted pace uphill against the
 * flat; on the bike, power (or heart rate without a power meter). Needs two
 * minutes of each to compare.
 */
export function hillVerdict(split:ReturnType<typeof hillSplit>,family:string):HillVerdict|null{
 const {up,flat}=split;if(up.seconds<120||flat.seconds<120)return null;
 const metric=family==='cycling'?(up.power!==null&&flat.power!==null&&flat.power>0?'power':'heartrate'):'gap';
 const a=up[metric],b=flat[metric];if(!finite(a)||!positive(b))return null;
 const change=metric==='heartrate'?a-b:a/b-1,limit=metric==='heartrate'?3:.03;
 return {kind:change>limit?'pushed':change<-limit?'eased':'even',metric,up:a,flat:b,change,hrUp:up.heartrate,hrFlat:flat.heartrate};
}

export type SectionValues={durationSeconds:number;mean:Partial<Record<'speed'|'power'|'heartrate'|'cadence'|'stepLength',number|null>>;gap?:number|null};
export type TrendItem={key:Metric;from:number;to:number;change:number;verdict:'down'|'up'|'held'};
// Change needed to call a trend: relative for pace, power, cadence and step length; beats per minute for heart rate.
const limits:Record<Metric,number>={speed:.03,gap:.03,power:.04,heartrate:3,cadence:.02,stepLength:.03};
/**
 * The first third of the sections against the last third. Sections much
 * shorter than the rest (a final partial lap, a short effort) are left out so
 * they do not decide the trend. Needs three comparable sections.
 */
export function sectionTrend(sections:SectionValues[],family:string){
 const lengths=sections.map(s=>s.durationSeconds).filter(positive).sort((a,b)=>a-b),median=lengths[Math.floor(lengths.length/2)]??0;
 const kept=sections.filter(s=>s.durationSeconds>=median*.5);if(kept.length<3)return null;
 const k=Math.max(1,Math.floor(kept.length/3)),head=kept.slice(0,k),tail=kept.slice(-k);
 const keys:Metric[]=family==='cycling'?['power','speed','heartrate','cadence']:family==='running'?['gap','speed','heartrate','cadence','stepLength']:['speed','heartrate','cadence'];
 const value=(s:SectionValues,key:Metric)=>key==='gap'?s.gap??null:s.mean[key]??null;
 const items:TrendItem[]=keys.flatMap(key=>{
  if(kept.filter(s=>positive(value(s,key))).length<3)return [];
  const from=mean(head.map(s=>value(s,key)).filter(positive)),to=mean(tail.map(s=>value(s,key)).filter(positive));
  if(from===null||to===null)return [];
  const change=key==='heartrate'?to-from:to/from-1;
  return [{key,from,to,change,verdict:change>limits[key]?'up':change<-limits[key]?'down':'held'}];
 });
 // Grade-adjusted pace already tells the pace story on foot; keep raw pace only without it.
 const shown=items.some(i=>i.key==='gap')?items.filter(i=>i.key!=='speed'):items;
 return shown.length?{items:shown,count:kept.length,compared:k}:null;
}

/**
 * Aerobic decoupling: output per heartbeat in the second half against the
 * first (grade-adjusted pace on foot, power or speed on the bike). Under 5%
 * means heart rate held steady for the work; more is drift from fatigue,
 * heat or fuel. Needs 20 minutes of moving samples with heart rate.
 */
export function decoupling(rows:readonly AnalysisRow[],terrain:Terrain,step:number,family:string){
 const usePower=family==='cycling'&&rows.filter(r=>finite(r.power)&&r.power>0).length>rows.length*.5;
 const pairs:[number,number][]=[];
 rows.forEach((r,i)=>{if(!positive(r.heartrate)||!positive(r.speed))return;const g=terrain.grade[i],out=usePower?r.power:family==='cycling'?r.speed:r.speed*(finite(g)?gradeFactor(g):1);if(positive(out))pairs.push([out,r.heartrate])});
 if(pairs.length*step<1200)return null;
 const half=Math.floor(pairs.length/2),ratio=(list:[number,number][])=>list.reduce((a,p)=>a+p[0],0)/list.reduce((a,p)=>a+p[1],0);
 const first=ratio(pairs.slice(0,half)),second=ratio(pairs.slice(half));
 return {drift:(first-second)/first*100,basis:usePower?'power':family==='cycling'?'speed':'pace'};
}

/** One plain sentence for the trend, read the way a coach would. */
export function trendSummary(trend:NonNullable<ReturnType<typeof sectionTrend>>,family:string,sections:string){
 const at=(key:Metric)=>trend.items.find(i=>i.key===key),output=family==='cycling'?at('power')??at('speed'):at('gap')??at('speed'),hr=at('heartrate'),cadence=at('cadence');
 const pct=(v:number)=>`${Math.round(Math.abs(v)*100)}%`,beats=(v:number)=>`${Math.round(Math.abs(v))} bpm`;
 const what=family==='cycling'?(output?.key==='power'?'Power':'Speed'):'Pace',foot=family!=='cycling';
 let text:string;
 if(!output)text=hr?`Heart rate ${hr.verdict==='up'?`rose ${beats(hr.change)}`:hr.verdict==='down'?`fell ${beats(hr.change)}`:'held steady'} from the first to the last ${sections}.`:`No clear change from the first to the last ${sections}.`;
 else if(output.verdict==='down')text=`${what} ${foot?'slowed':'faded'} ${pct(output.change)} from the first to the last ${sections}${hr?.verdict==='up'?` while heart rate rose ${beats(hr.change)}: tiring`:hr?.verdict==='held'?' at the same heart rate':''}.`;
 else if(output.verdict==='up')text=`You finished stronger: ${foot?`${pct(output.change)} faster`:`${what.toLowerCase()} up ${pct(output.change)}`} from the first to the last ${sections}${hr?.verdict==='up'?`, with heart rate up ${beats(hr.change)}`:''}.`;
 else if(hr?.verdict==='up')text=`${what} held, but heart rate drifted up ${beats(hr.change)} for the same work.`;
 else if(hr?.verdict==='down')text=`${what} held while heart rate fell ${beats(hr.change)} from the first to the last ${sections}.`;
 else text=hr?`${what} and heart rate held steady across the ${sections}: well paced.`:`${what} held steady across the ${sections}.`;
 if(cadence&&cadence.verdict!=='held')text+=` Cadence ${cadence.verdict==='down'?'dropped':'rose'} ${pct(cadence.change)}.`;
 return text;
}
