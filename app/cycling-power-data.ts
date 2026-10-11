import {sportFamily} from './sports';

type PowerSource='recorded'|'estimated'|null;
export type CyclingPowerStats={average:number|null;normalized:number|null;averageSource:PowerSource;normalizedSource:PowerSource};
const measured=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const provenance=(v:unknown):v is Exclude<PowerSource,null>=>v==='recorded'||v==='estimated';
const empty=():CyclingPowerStats=>({average:null,normalized:null,averageSource:null,normalizedSource:null});
const maxSamples=604800;

/** Provider values take precedence; zero watts is a real reading, not missing data. */
export function cyclingPowerStats(detail:Record<string,any>):CyclingPowerStats{
 if(sportFamily(detail)!=='cycling')return empty();
 const summary=detail.summary??{},sampled=detail.seriesSampled??{},power=sampled.data?.power;
 const hasStream=Array.isArray(power)&&power.length>0,step=sampled.sampleSize,stats=empty();
 if(measured(summary.power)){stats.average=summary.power;stats.averageSource='recorded'}
 const recorded=measured(summary.normalizedPower)?summary.normalizedPower:measured(summary.powerNormalized)?summary.powerNormalized:null;
 if(recorded!==null){stats.normalized=recorded;stats.normalizedSource=summary.normalizedPowerSource==='estimated'?'estimated':'recorded'}
 if(hasStream&&measured(step)&&step>0){
  // Active duration can omit watch pauses; only elapsed duration can clip the
  // sample timeline. Otherwise retain the whole recording, including its gaps.
  const span=measured(summary.durationTotal)?summary.durationTotal:power.length*step;
  const count=Math.ceil(span/step);
  // Bound work before scanning malformed or oversized recordings.
  if(count>0&&count<=maxSamples){
   const included=Math.min(count,power.length);let sum=0,seconds=0,complete=included===count;
   for(let i=0;i<included;i++){
    const weight=Math.min(step,span-i*step),value=power[i];
    if(measured(value)){sum+=value*weight;seconds+=weight}else complete=false;
   }
   if(stats.average===null&&seconds>0&&Number.isFinite(sum/seconds)){stats.average=sum/seconds;stats.averageSource='estimated'}
   // A truncated recording must not become a complete, shorter ride through clipping.
   const coversActiveDuration=!measured(summary.duration)||span>=summary.duration;
   if(stats.normalized===null&&span>=300&&step<=5&&complete&&coversActiveDuration){
    // Evaluate exact 30-second rolling means at sample endpoints. Removing the
    // overlap of the first cell supports noninteger sampling intervals without
    // quietly using a 32/35-second window. The final partial cell is time-weighted.
    let rolling=0,left=0,windowStart=0,total=0,weightTotal=0;
    for(let i=0;i<count;i++){
     const end=Math.min(span,(i+1)*step),weight=end-i*step;
     rolling+=power[i]*weight;
     const target=Math.max(0,end-30);
     while(windowStart<target){
      const boundary=Math.min(target,(left+1)*step),removed=boundary-windowStart;
      rolling-=power[left]*removed;windowStart=boundary;
      if(boundary>=(left+1)*step)left++;
     }
     if(end>=30){total+=(Math.max(0,rolling)/30)**4*weight;weightTotal+=weight}
    }
    if(weightTotal>0&&Number.isFinite(total)){stats.normalized=(total/weightTotal)**.25;stats.normalizedSource='estimated'}
   }
  }
 }
 // Compact preview metadata is used only when there is no raw power stream.
 // Fresh summary or samples always win; invalid provenance fails closed.
 if(!hasStream){
  const cached=detail.powerStats;
  if(stats.average===null&&measured(cached?.average)&&provenance(cached?.averageSource)){stats.average=cached.average;stats.averageSource=cached.averageSource}
  if(stats.normalized===null&&measured(cached?.normalized)&&provenance(cached?.normalizedSource)){stats.normalized=cached.normalized;stats.normalizedSource=cached.normalizedSource}
 }
 return stats;
}
