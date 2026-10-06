const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]};
type Climb={start:number;end:number;gain:number;distance:number;grade:number};
type Point={t:number;a:number;d:number};
function computeClimbAnalysis(detail:any,family=detail.sportType){
 const running=['running','run','walking','hiking','trail_running'].includes(String(family).toLowerCase()),step=detail.seriesSampled?.sampleSize,s=detail.seriesSampled?.data??{};
 const thresholds={minSeconds:running?30:60,minGainMetres:running?10:20,minDistanceMetres:running?60:150,minGradePercent:1,dipToleranceMetres:running?3:5,maxDipToleranceMetres:running?8:12,smoothingSeconds:5,maxSampleSeconds:15};
 const method='Valley-to-peak rise in recorded elevation and moving distance; median smoothing, small rolling dips and brief flats allowed. Net gain and average gradient describe the detected bounds.';
 const result={climbs:[] as Climb[],reason:null as string|null,status:'unavailable' as 'detected'|'none'|'unavailable',method,thresholds};
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
 if(!result.climbs.length)result.reason='No sustained moving climbs met the gain, distance and average-gradient requirements in the available samples.';
 return result;
}
export function paceFromSpeed(speed:unknown,metres=1000){if(!finite(speed)||speed<=0)return '—';const seconds=Math.round(metres/speed);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}

const resultCache=new WeakMap<object,Map<string,ReturnType<typeof computeClimbAnalysis>>>();
export function activityClimbAnalysis(detail:any,family=detail.sportType){
 let entries=resultCache.get(detail);if(!entries){entries=new Map();resultCache.set(detail,entries)}
 const key=String(family);const cached=entries.get(key);if(cached)return cached;const result=computeClimbAnalysis(detail,family);entries.set(key,result);return result;
}
export function activityClimbs(detail:any,family=detail.sportType){return activityClimbAnalysis(detail,family).climbs}
