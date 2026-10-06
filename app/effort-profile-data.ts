const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
type Effort={start:number;end:number;mean:number;gain:number|null;peak:number};
type EffortStatus='detected'|'none'|'unavailable';
function sustainedLevels(rows:{value:number|null}[],step:number,seconds:number,recoverySeconds:number,cap:number,limit:number,zeros:boolean){
 const known=(v:unknown):v is number=>finite(v)&&v>=0&&v<=limit&&(zeros||v>0),window=Math.max(1,Math.ceil(seconds/step)),recoveryWindow=Math.max(3,Math.round(recoverySeconds/step));
 const minima:number[]=[],maxima:number[]=[],signal:number[]=[];let minHead=0,maxHead=0,from=0,low=Infinity,high=-Infinity;
 for(let i=0;i<rows.length&&i*step<cap;i++){
  const value=rows[i].value;
  if(!known(value)){minima.length=0;maxima.length=0;minHead=0;maxHead=0;from=i+1;signal.push(0);continue}
  const before=rows[i-1]?.value,after=(i+1)*step<cap?rows[i+1]?.value:null;
  // A single noisy positive reading should not set the session's extrema.
  // Median filtering applies only to fully observed neighbours, never gaps.
  const v=known(before)&&known(after)?value+before+after-Math.min(value,before,after)-Math.max(value,before,after):value;signal.push(v);
  while(minima.length>minHead&&signal[minima.at(-1)!]>=v)minima.pop();minima.push(i);
  while(maxima.length>maxHead&&signal[maxima.at(-1)!]<=v)maxima.pop();maxima.push(i);
  while(minHead<minima.length&&minima[minHead]<=i-window)minHead++;
  while(maxHead<maxima.length&&maxima[maxHead]<=i-recoveryWindow)maxHead++;
  if(i-from+1>=recoveryWindow)low=Math.min(low,signal[maxima[maxHead]]);
  if(i-from+1>=window)high=Math.max(high,signal[minima[minHead]]);
 }
 return finite(low)&&finite(high)?{low,high}:null;
}
function detectEfforts(rows:{time:number;altitude:number|null;value:number|null}[],streams:any,step:number,sensor:string,family:string,cap:number){
 const foot=['running','run','trail_running','walking','hiking'].includes(family),speed=sensor==='speed',power=sensor==='power';
 const smoothingSamples=Math.max(1,Math.ceil((power?15:speed?(foot?6:10):15)/step)),smoothingSeconds=smoothingSamples*step,minSeconds=Math.max(speed&&foot?20:power||speed?30:60,step*3);
 const effortMethod={smoothingSeconds,minSeconds,cutoff:null as number|null,releaseCutoff:null as number|null,minContrast:power?30:speed?(foot?.25:1):8,maxSampleSeconds:10};
 const result={efforts:[] as Effort[],threshold:null as number|null,effortReason:null as string|null,effortSource:sensor,effortStatus:'unavailable' as EffortStatus,effortMethod};
 if(!['power','speed','heartrate'].includes(sensor)){result.effortReason='This sensor is not supported for automatic sections.';return result}
 if(step>effortMethod.maxSampleSeconds){result.effortReason='Automatic sections need samples at least every 10 seconds. Recorded laps remain available.';return result}
 const limit=power?5000:speed?(foot?15:40):240;
 const valid=(value:unknown):value is number=>finite(value)&&value>0&&value<=limit;
 const values=rows.flatMap((row)=>row.time*60<cap&&valid(row.value)?[row.value]:[]);
 if(values.length<6||values.length*step<minSeconds*2){result.effortReason=`Not enough recorded ${sensor==='heartrate'?'heart-rate':sensor} samples to identify sustained sections.`;return result}
 // Lower and upper session levels work when intervals occupy most of a session.
 // A required contrast keeps steady outings and small sensor noise unsegmented.
 values.sort((a,b)=>a-b);let low=values[Math.floor((values.length-1)*.1)],high=values[Math.floor((values.length-1)*.9)];
 const contrastAt=(baseline:number)=>Math.max(effortMethod.minContrast,baseline*(power?.15:speed?(foot?.08:.15):.06));
 // Rare surges or near-continuous work can fall outside both quantiles. Use
 // genuinely sustained extrema as a fallback, rather than raw spike extrema.
 if(high-low<contrastAt(low)){
  const sustained=sustainedLevels(rows,step,minSeconds,smoothingSeconds,cap,limit,power||speed);
  if(sustained){low=Math.min(low,sustained.low);high=Math.max(high,sustained.high)}
 }
 const contrast=contrastAt(low);
 effortMethod.minContrast=contrast;
 if(high-low<contrast){result.effortStatus='none';result.effortReason='No distinct sustained changes in the recorded signal; a steady session can have no automatic sections.';return result}
 const cutoff=low+(high-low)*.5,release=low+(high-low)*.35;result.threshold=cutoff;effortMethod.cutoff=cutoff;effortMethod.releaseCutoff=release;
 const distanceStops=new Uint8Array(sensor==='heartrate'?rows.length:0);
 if(sensor==='heartrate'){
  // With no speed reading, a sustained plateau in cumulative distance can
  // still expose a stop despite delayed HR recovery. Confirm five seconds
  // before marking the original plateau; brief distance rounding is ignored.
  let stationary=-1;
  const finishStop=(end:number)=>{if(stationary>=0&&(end-stationary+1)*step>=5)for(let j=stationary;j<=end;j++)distanceStops[j]=1;stationary=-1};
  for(let i=1;i<rows.length;i++){
   const a=streams.distance?.[i-1],b=streams.distance?.[i];
   if(!finite(streams.speed?.[i])&&!finite(streams.speed?.[i-1])&&finite(a)&&finite(b)&&b>=a&&b-a<=.2*step){if(stationary<0)stationary=i-1}else finishStop(i-1);
  }
  finishStop(rows.length-1);
 }
 const window=smoothingSamples;let sum=0,from=0,start=-1,lastHigh=-1,candidateFloor=0,previousDistance:number|null=null;
 const qualifying:number[]=[];let head=0;
 const finish=()=>{
  if(start>=0&&lastHigh>=start){
   const end=Math.min(cap,(lastHigh+1)*step),seconds=end-start*step;
   let total=0,count=0,peak=0,above=0;
   for(let i=start;i<=lastHigh;i++){const v=rows[i].value!;total+=v;count++;peak=Math.max(peak,v);if(v>=release)above+=Math.min(step,Math.max(0,cap-i*step))}
   if(seconds>=minSeconds-1e-7&&above>=minSeconds*.8-1e-7&&above>=seconds*.65){const a=rows[start].altitude,b=rows[lastHigh].altitude;result.efforts.push({start:start*step/60,end:end/60,mean:total/count,peak,gain:finite(a)&&finite(b)?b-a:null})}
   candidateFloor=lastHigh+1;
  }
  start=-1;lastHigh=-1;
 };
 for(let i=0;i<rows.length&&i*step<cap;i++){
  const value=rows[i].value,distance=streams.distance?.[i],motion=streams.speed?.[i],reset=finite(distance)&&previousDistance!==null&&distance<previousDistance-.5;
  if(finite(distance))previousDistance=distance;
  // Recorded zeros and missing primary samples are boundaries, never recovery
  // invented by a rolling average. HR sections also stop at recorded stops.
  if(!valid(value)||reset||sensor==='heartrate'&&(finite(motion)&&motion<=.2||distanceStops[i])){finish();sum=0;from=i+1;qualifying.length=0;head=0;continue}
  sum+=value;if(i-from+1>window){sum-=rows[from].value!;from++}
  if(value>=cutoff)qualifying.push(i);while(head<qualifying.length&&qualifying[head]<Math.max(from,candidateFloor))head++;
  const average=sum/(i-from+1),ready=i-from+1===window;
  if(start<0&&ready&&average>=cutoff&&value>=cutoff){start=qualifying[head]??i;lastHigh=i}
  if(start>=0){if(value>=release)lastHigh=i;if(average<release)finish()}
 }
 finish();result.effortStatus=result.efforts.length?'detected':'none';
 if(!result.efforts.length)result.effortReason='No sustained sections met the duration and signal-contrast requirements in the available samples.';
 return result;
}
function computeeffortProfile(detail:any,sensor='power',family=detail.sportType){
 const streams=detail.seriesSampled?.data??{},step=detail.seriesSampled?.sampleSize;
 const blank={efforts:[] as Effort[],threshold:null as number|null,effortReason:'Timed sensor samples are needed to identify automatic sections.' as string|null,effortSource:sensor,effortStatus:'unavailable' as EffortStatus,effortMethod:{smoothingSeconds:sensor==='power'?15:sensor==='speed'?6:15,minSeconds:sensor==='power'?30:sensor==='speed'?20:60,cutoff:null as number|null,releaseCutoff:null as number|null,minContrast:sensor==='power'?30:sensor==='speed'?.25:8,maxSampleSeconds:10}};
 if(!finite(step)||step<=0)return {rows:[],laps:[],...blank,reason:'Timed sensor samples are needed to align the profile.'};
 const n=Math.max(...['altitude',sensor].map(k=>Array.isArray(streams[k])?streams[k].length:0)),duration=detail.summary?.durationTotal;
 if(n>604800)return {rows:[],laps:[],...blank,effortReason:'This recording is too large for automatic sections.',reason:'This recording is too large for the interactive profile.'};
 const rows=Array.from({length:n},(_,i)=>({time:i*step/60,altitude:finite(streams.altitude?.[i])?streams.altitude[i]:null,value:finite(streams[sensor]?.[i])?streams[sensor][i]:null})).filter(r=>!finite(duration)||r.time*60<=duration);
 const detection=detectEfforts(rows,streams,step,sensor,String(family??(sensor==='speed'?'running':'cycling')).toLowerCase(),finite(duration)&&duration>=0?duration:n*step);
 const laps:{index:number;start:number;end:number;power:number|null;hr:number|null}[]=[];let cursor=0,aligned=true;
 for(const [i,lap] of (detail.laps??[]).entries()){const s={...lap,...lap.summary},d=s.durationTotal??s.duration;if(!finite(d)||d<=0){aligned=false;break}if(detail.mergedIds){if(!finite(lap.mergedStartSeconds)){aligned=false;break}cursor=lap.mergedStartSeconds;}laps.push({index:i+1,start:cursor/60,end:(cursor+d)/60,power:finite(s.power)?s.power:null,hr:finite(s.heartrate)?s.heartrate:null});cursor+=d}
 // Sensor streams may omit pauses while lap timestamps use wall-clock time.
 // Match cumulative recorded distances instead of stretching lap timer durations.
 const extent=rows.length?rows.at(-1)!.time*60+step:0;
 const tolerance=Math.max(10,step*2);
 if(Math.abs(cursor-extent)>tolerance)aligned=false;
 let distanceAligned=false,timerApproximate=false;
 if(!detail.mergedIds&&laps.length===(detail.laps??[]).length&&laps.length){
  const distances=detail.laps.map((l:any)=>({...l,...l.summary}).distance);
  const stream=streams.distance;
  const total=distances.reduce((sum:number,d:any)=>sum+(finite(d)?d:0),0);
  const points:Array<{distance:number;index:number}>=Array.isArray(stream)?stream.flatMap((d:any,i:number)=>finite(d)&&d>=0?[{distance:d,index:i}]:[]):[];
  const complete=Array.isArray(stream)&&Math.abs(stream.length-n)<=2&&points.length>=2&&points[0].index<=2&&points.at(-1)!.index>=stream.length-3&&points.every((p,i)=>i===0||p.distance>=points[i-1].distance&&p.index-points[i-1].index<=2);
  if(complete&&distances.every((d:any)=>finite(d)&&d>0)&&total>0&&Math.abs(points.at(-1)!.distance-total)<=Math.max(5,total*.005)&&points[0].distance<=Math.max(100,total*.02)){
   const boundary=(target:number)=>{
    const j=points.findIndex(p=>p.distance>=target);
    if(j<0)return rows.at(-1)!.time;
    if(j===0)return 0;
    const before=points[j-1],after=points[j],delta=after.distance-before.distance;
    return (before.index+(delta>0?(target-before.distance)/delta:0)*(after.index-before.index))*step/60;
   };
   let distance=0,prior=0;
   const bounds=distances.map((d:number,i:number)=>{distance+=d;const end=i===distances.length-1?Math.min(extent,detail.summary?.duration??extent)/60:boundary(distance);const result={start:prior,end};prior=end;return result});
   if(bounds.every((v:any)=>finite(v.end)&&v.end>v.start)){
    bounds.forEach((v:any,i:number)=>Object.assign(laps[i],v));aligned=true;distanceAligned=true;
   }
  }
 }
 // A small accumulated timer discrepancy is not a reason to hide every lap.
 // Only reconcile near-complete active-time streams; never bridge merged gaps.
 const activeDuration=detail.summary?.duration;
 if(!aligned&&!detail.mergedIds&&laps.length===(detail.laps??[]).length&&laps.length&&finite(activeDuration)&&activeDuration>0&&Math.abs(extent-activeDuration)<=tolerance&&Math.abs(cursor-activeDuration)<=Math.max(15,activeDuration*.01)){
  const scale=Math.min(activeDuration,extent)/cursor;
  for(const lap of laps){lap.start*=scale;lap.end*=scale}
  aligned=true;timerApproximate=true;
 }
 return {rows,laps:aligned?laps:[],...detection,reason:timerApproximate?'Lap highlights are approximate: recorded lap timers were fitted to the active sensor timeline. Recorded durations and averages are unchanged.':distanceAligned?'Lap highlights follow recorded distance; boundaries are approximate at the sensor sample resolution.':!aligned&&detail.laps?.length?'Recorded laps are available below. Their timing cannot be reliably aligned with this sensor timeline.':null};

}

const resultCache=new WeakMap<object,Map<string,ReturnType<typeof computeeffortProfile>>>();
export function effortProfile(detail:any,sensor='power',family=detail.sportType){
 let entries=resultCache.get(detail);if(!entries){entries=new Map();resultCache.set(detail,entries)}
 const key=String(sensor)+'::'+String(family);const cached=entries.get(key);if(cached)return cached;const result=computeeffortProfile(detail,sensor,family);entries.set(key,result);return result;
}
