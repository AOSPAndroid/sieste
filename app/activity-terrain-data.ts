const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]};
type Climb={start:number;end:number;gain:number;distance:number;grade:number};
type Point={t:number;a:number;d:number};
export type ClimbDetectionOptions={mode?:'whole'|'steep';minGradePercent?:number};
function climbSettings(family:unknown,options?:ClimbDetectionOptions){
 const cycling=['cycling','biking','bike','ride'].includes(String(family).toLowerCase()),mode=cycling&&options?.mode==='steep'?'steep':'whole';
 const requested=finite(options?.minGradePercent)&&options.minGradePercent>0?options.minGradePercent:3;
 const grade=[2,3,4,5,6,8].reduce((best,value)=>Math.abs(value-requested)<Math.abs(best-requested)?value:best,3);
 return {mode:mode as 'whole'|'steep',grade:mode==='steep'?grade:1};
}
function steepSections(points:Point[],cutoff:number,thresholds:{minSeconds:number;minGainMetres:number;minDistanceMetres:number},windowMetres:number){
 const climbs:Climb[]=[];
 if(points.length<2||points.at(-1)!.d-points[0].d<windowMetres)return climbs;
 let leftIndex=0,rightIndex=0,start=-1,end=-1;
 const slope=(i:number)=>100*(points[i].a-points[i-1].a)/(points[i].d-points[i-1].d);
 const finish=()=>{
  if(start>=0){
   // Distance-window gradients can straddle a change in slope. Trim gentle
   // boundary edges so a steep core does not inherit its approach or tail.
   let first=start,last=end;
   while(first<last&&slope(first+1)+1e-9<cutoff)first++;
   while(last>first&&slope(last)+1e-9<cutoff)last--;
   const a=points[first],b=points[last],gain=b.a-a.a,distance=b.d-a.d;
   if(b.t-a.t>=thresholds.minSeconds&&gain>=thresholds.minGainMetres&&distance>=thresholds.minDistanceMetres)climbs.push({start:a.t,end:b.t,gain,distance,grade:100*gain/distance});
  }
  start=-1;end=-1;
 };
 const elevationAt=(distance:number,index:number)=>{const a=points[index],b=points[index+1];return a.a+(b.a-a.a)*(distance-a.d)/(b.d-a.d)};
 for(let i=1;i<points.length;i++){
  const centre=(points[i-1].d+points[i].d)/2,left=Math.max(points[0].d,Math.min(centre-windowMetres/2,points.at(-1)!.d-windowMetres)),right=left+windowMetres;
  while(leftIndex<points.length-2&&points[leftIndex+1].d<left)leftIndex++;
  while(rightIndex<points.length-2&&points[rightIndex+1].d<right)rightIndex++;
  const grade=100*(elevationAt(right,rightIndex)-elevationAt(left,leftIndex))/windowMetres;
  if(grade+1e-9>=cutoff){if(start<0)start=i-1;end=i}else finish();
 }
 finish();return climbs;
}
function computeClimbAnalysis(detail:any,family=detail.sportType,options?:ClimbDetectionOptions){
 const running=['running','run','walking','hiking','trail_running'].includes(String(family).toLowerCase()),step=detail.seriesSampled?.sampleSize,s=detail.seriesSampled?.data??{};
 const settings=climbSettings(family,options),steep=settings.mode==='steep';
 const thresholds={minSeconds:running?30:60,minGainMetres:running?10:20,minDistanceMetres:running?60:150,minGradePercent:1,dipToleranceMetres:running?3:5,maxDipToleranceMetres:running?8:12,smoothingSeconds:5,maxSampleSeconds:15};
 if(steep){thresholds.minSeconds=30;thresholds.minGainMetres=10;thresholds.minDistanceMetres=100;thresholds.minGradePercent=settings.grade}
 const method=steep?`Sections with local gradient at least ${settings.grade}% over approximately 50 metres of recorded moving distance; gentle approaches and tails are trimmed. Section average gradient is reported separately.`:'Valley-to-peak rise in recorded elevation and moving distance; median smoothing, small rolling dips and brief flats allowed. Net gain and average gradient describe the detected bounds.';
 const result={climbs:[] as Climb[],reason:null as string|null,status:'unavailable' as 'detected'|'none'|'unavailable',method,thresholds,mode:settings.mode,gradeCutoffPercent:settings.grade,localGradeWindowMetres:steep?50:null};
 if(!finite(step)||step<=0){result.reason='Timed elevation and distance samples are needed to identify climbs.';return result}
 if(step>thresholds.maxSampleSeconds){result.reason='Climb detection needs samples at least every 15 seconds.';return result}
 if(!Array.isArray(s.altitude)||!Array.isArray(s.distance)){result.reason='Recorded elevation and cumulative distance are both needed to identify climbs.';return result}
 const n=Math.min(s.altitude.length,s.distance.length),cap=finite(detail.summary?.durationTotal)&&detail.summary.durationTotal>=0?detail.summary.durationTotal:Infinity;
 if(n>604800){result.reason='This recording is too large for automatic climbs.';return result}
 const width=Math.max(1,Math.round(5/step));thresholds.smoothingSeconds=width*step;thresholds.minSeconds=Math.max(thresholds.minSeconds,step*3);
 // Build short bins only within uninterrupted source data. A missing sample,
 // reset or recorded stop always separates chunks; smoothing never fills it.
 const chunks:Point[][]=[];let nodes:Point[]=[],bin:Point[]=[],lastDistance:number|null=null,validSamples=0;
 const flushBin=()=>{if(bin.length){nodes.push({t:median(bin.map(p=>p.t)),a:median(bin.map(p=>p.a)),d:median(bin.map(p=>p.d))});bin=[]}};
 const finishChunk=()=>{flushBin();if(nodes.length)chunks.push(nodes);nodes=[];lastDistance=null};
 for(let i=0;i<n&&i*step<=cap;i++){
  const altitude=s.altitude[i],distance=s.distance[i],speed=s.speed?.[i];
  if(!finite(altitude)||!finite(distance)||distance<0||finite(speed)&&speed<=.2){finishChunk();continue}
  if(lastDistance!==null&&distance<lastDistance){finishChunk()}
  if(steep&&!finite(speed)&&lastDistance!==null&&distance===lastDistance){finishChunk();continue}
  bin.push({t:i*step,a:altitude,d:distance});lastDistance=distance;validSamples++;
  if(bin.length===width)flushBin();
 }
 finishChunk();
 if(validSamples<4||validSamples*step<thresholds.minSeconds){result.reason='Not enough paired elevation and moving-distance samples to identify climbs.';return result}
 let valley:Point|null=null,peak:Point|null=null,previous:Point|null=null;
 const finish=()=>{
  if(valley&&peak){const gain=peak.a-valley.a,distance=peak.d-valley.d,grade=distance>0?100*gain/distance:0;
   if(peak.t-valley.t>=thresholds.minSeconds&&gain>=thresholds.minGainMetres&&distance>=thresholds.minDistanceMetres&&grade>=thresholds.minGradePercent)result.climbs.push({start:valley.t,end:peak.t,gain,distance,grade});
  }
  valley=null;peak=null;
 };
 for(const chunk of chunks){
  // Three-bin median suppresses isolated GPS/barometer spikes. Use original
  // endpoint times and recorded distance for chart/map selection.
  const smoothed=chunk.map((point,i)=>i>0&&i<chunk.length-1?{...point,a:median([chunk[i-1].a,point.a,chunk[i+1].a])}:point);
  if(steep){
   let section:Point[]=[];
   const finishSection=()=>{for(const climb of steepSections(section,settings.grade,thresholds,50))result.climbs.push(climb);section=[]};
   for(const point of smoothed){
    const before=section.at(-1);
    if(before){const seconds=point.t-before.t,moved=point.d-before.d;
     if(seconds<=0||moved<Math.max(.2,seconds*.2)||Math.abs(point.a-before.a)>Math.max(6,seconds*1.5))finishSection();
    }
    section.push(point);
   }
   finishSection();continue;
  }
  previous=null;
  for(const point of smoothed){
   if(previous){const seconds=point.t-previous.t,moved=point.d-previous.d;
    // No movement means altitude drift, not climbing. An implausible jump
    // also ends the segment instead of supplying a spurious summit.
    if(seconds<=0||moved<Math.max(.2,seconds*.2)||Math.abs(point.a-previous.a)>Math.max(6,seconds*1.5)){
     finish();previous=point;valley=point;peak=point;continue;
    }
   }
   if(!valley){valley=point;peak=point}
   else if(point.a<valley.a){finish();valley=point;peak=point}
   else if(!peak||point.a>peak.a){peak=point}
   else{
    const dip=Math.max(thresholds.dipToleranceMetres,Math.min(thresholds.maxDipToleranceMetres,(peak.a-valley.a)*.15));
    if(peak.a-point.a>dip||point.t-peak.t>(running?90:180)){finish();valley=point;peak=point}
   }
   previous=point;
  }
  finish();
 }
 result.status=result.climbs.length?'detected':'none';
 if(!result.climbs.length)result.reason=steep?`No sustained steep sections met the ${settings.grade}% local-gradient cutoff and the minimum gain, distance and duration requirements.`:'No sustained moving climbs met the gain, distance and average-gradient requirements in the available samples.';
 return result;
}
export function paceFromSpeed(speed:unknown,metres=1000){if(!finite(speed)||speed<=0)return '—';const seconds=Math.round(metres/speed);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}

const resultCache=new WeakMap<object,Map<string,ReturnType<typeof computeClimbAnalysis>>>();
export function activityClimbAnalysis(detail:any,family=detail.sportType,options?:ClimbDetectionOptions){
 let entries=resultCache.get(detail);if(!entries){entries=new Map();resultCache.set(detail,entries)}
 const settings=climbSettings(family,options),key=String(family)+'::'+settings.mode+'::'+settings.grade;const cached=entries.get(key);if(cached)return cached;const result=computeClimbAnalysis(detail,family,options);entries.set(key,result);return result;
}
export function activityClimbs(detail:any,family=detail.sportType,options?:ClimbDetectionOptions){return activityClimbAnalysis(detail,family,options).climbs}
