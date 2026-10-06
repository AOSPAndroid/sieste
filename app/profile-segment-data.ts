import {segmentStatistics} from './segment-statistics';

export type ProfileSegmentRow={
 time:number;
 power?:unknown;
 speed?:unknown;
 heartrate?:unknown;
 cadence?:unknown;
 stepLength?:unknown;
 altitude?:unknown;
 distance?:unknown;
};
type Metric='power'|'speed'|'heartrate'|'cadence'|'stepLength';
const metrics:Metric[]=['power','speed','heartrate','cadence','stepLength'];
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const measured=(value:unknown,key:Metric):value is number=>finite(value)&&(key==='power'||key==='speed'?value>=0:value>0);
const epsilon=1e-7;

/** Source times and segment boundaries are elapsed minutes; step is seconds. */
export function profileSegmentStats<T extends ProfileSegmentRow>(rows:readonly T[],step:unknown,segment:{start:number;end:number},lapValues:Record<string,unknown>|null=null){
 const start=segment.start*60,end=segment.end*60;
 const seconds=finite(start)&&finite(end)&&end>start?end-start:0;
 const recordedDuration=finite(lapValues?.duration)&&lapValues.duration>0?lapValues.duration:finite(lapValues?.durationTotal)&&lapValues.durationTotal>0?lapValues.durationTotal:null;
 const durationSeconds=recordedDuration??seconds;
 const samples:T[]=[];
 const totals:Record<Metric,number>={power:0,speed:0,heartrate:0,cadence:0,stepLength:0};
 const weights:Record<Metric,number>={power:0,speed:0,heartrate:0,cadence:0,stepLength:0};
 const peaks:Record<Metric,number|null>={power:null,speed:null,heartrate:null,cadence:null,stepLength:null};
 let speedDistance=0,speedComplete=false,powerComplete=false,recordedDistance:number|null=null;

 if(finite(step)&&step>0&&seconds>0&&rows.length){
  // Find the first boundary in source time. Keeping its predecessor permits
  // partial samples and cumulative-distance interpolation without reindexing gaps.
  let low=0,high=rows.length;
  while(low<high){const middle=Math.floor((low+high)/2);if(rows[middle].time*60<start)low=middle+1;else high=middle}
  const first=Math.max(0,low-1);
  let coveredUntil=start;
  speedComplete=true;powerComplete=true;
  for(let i=first;i<rows.length;i++){
   const row=rows[i],time=row.time*60;
   if(time>=end)break;
   if(!finite(time)){speedComplete=false;powerComplete=false;continue}
   const from=Math.max(start,time),to=Math.min(end,time+step),weight=to-from;
   if(weight<=epsilon)continue;
   samples.push(row);
   if(Math.abs(from-coveredUntil)>epsilon){speedComplete=false;powerComplete=false}
   coveredUntil=Math.max(coveredUntil,to);
   for(const key of metrics){
    const value=row[key];
    if(!measured(value,key))continue;
    totals[key]+=value*weight;weights[key]+=weight;
    if(peaks[key]===null||value>peaks[key]!)peaks[key]=value;
   }
   if(measured(row.speed,'speed'))speedDistance+=row.speed*weight;else speedComplete=false;
   if(!measured(row.power,'power'))powerComplete=false;
  }
  if(coveredUntil<end-epsilon){speedComplete=false;powerComplete=false}

  let distanceComplete=true,distanceUntil=start,distance=0;
  for(let i=first;i+1<rows.length;i++){
   const before=rows[i],after=rows[i+1],beforeTime=before.time*60,afterTime=after.time*60;
   if(beforeTime>=end)break;
   if(afterTime<=start)continue;
   const from=Math.max(start,beforeTime),to=Math.min(end,afterTime),span=afterTime-beforeTime;
   if(to-from<=epsilon)continue;
   if(!finite(beforeTime)||!finite(afterTime)||Math.abs(span-step)>epsilon||Math.abs(from-distanceUntil)>epsilon||!finite(before.distance)||before.distance<0||!finite(after.distance)||after.distance<before.distance){
    distanceComplete=false;
   }else distance+=(after.distance-before.distance)*(to-from)/span;
   distanceUntil=Math.max(distanceUntil,to);
  }
  if(distanceComplete&&distanceUntil>=end-epsilon)recordedDistance=distance;
 }

 const mean:Record<Metric,number|null>={power:null,speed:null,heartrate:null,cadence:null,stepLength:null};
 for(const key of metrics){
  const recorded=lapValues?.[key];
  mean[key]=measured(recorded,key)?recorded:weights[key]>0?totals[key]/weights[key]:null;
 }
 const maximum=(key:Metric)=>{const recorded=lapValues?.[key+'Max'];return measured(recorded,key)?recorded:peaks[key]};
 const maxPower=maximum('power'),maxSpeed=maximum('speed'),maxHR=maximum('heartrate'),maxCadence=maximum('cadence');
 let normalized:number|null=null;
 if(powerComplete&&seconds>=300&&durationSeconds>=300&&finite(step)&&step<=10){
  // Reuse the established rolling-window NP estimate. Supplying all maxima
  // keeps its legacy Math.max(...values) path away from large source streams.
  normalized=segmentStatistics(samples,step,seconds,{powerMax:maxPower??0,speedMax:maxSpeed??0,heartrateMax:maxHR??0,cadenceMax:maxCadence??0}).normalized;
 }
 const lapDistance=lapValues?.distance;
 return {
  durationSeconds,
  distance:finite(lapDistance)&&lapDistance>=0?lapDistance:recordedDistance??(speedComplete?speedDistance:null),
  mean,
  stats:{normalized,maxPower,maxHR,maxCadence,maxSpeed},
  samples,
 };
}
