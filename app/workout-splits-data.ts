// The recorded fields the workout sheet reads from a workout detail.
export type SampledDetail={summary?:{duration?:number;distance?:number};seriesSampled?:{sampleSize?:number;data?:Record<string,unknown[]>}};
export type Split={index:number;distance:number;seconds:number;heartrate:number|null;partial:boolean};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);

export function splitLength(family:string){return family==='cycling'?5000:family==='swimming'?100:1000}

// Distance splits from the sampled cumulative distance stream: each split's
// time is interpolated at the exact boundary, so a 1 km split never borrows
// time from its neighbours. Gaps in the stream are skipped, not filled.
export function distanceSplits(distance:unknown[],step:number,unit:number,heartrate:unknown[]=[]):Split[]{
 if(!Array.isArray(distance)||!finite(step)||!finite(unit)||!(step>0)||!(unit>0))return [];
 const points:{t:number;d:number;i:number}[]=[];
 distance.forEach((d,i)=>{if(finite(d)&&(!points.length||d>=points[points.length-1].d))points.push({t:i*step,d,i})});
 if(points.length<2)return [];
 const start=points[0],total=points[points.length-1].d-start.d;
 if(total<unit*.2)return [];
 const splits:Split[]=[];let boundary=start.d+unit,prevT:number|null=start.t,prevI=start.i,k=1;
 const hrBetween=(from:number,to:number)=>{const v=heartrate.slice(from,to+1).filter(finite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
 for(let j=1;j<points.length;j++){
  const a=points[j-1],b=points[j];
  while(b.d>=boundary){
   // A recorded endpoint gives an exact boundary even after a gap; a boundary
   // inside a missing interval has no known time and cannot produce a split.
   const f=b.d===a.d?1:(boundary-a.d)/(b.d-a.d),t=b.i===a.i+1||b.d===boundary?a.t+f*(b.t-a.t):null;
   if(t!==null&&prevT!==null)splits.push({index:k,distance:unit,seconds:t-prevT,heartrate:hrBetween(prevI,b.i),partial:false});
   k++;
   prevT=t;prevI=b.i;boundary+=unit;
  }
 }
 const last=points[points.length-1],rest=last.d-(boundary-unit);
 if(rest>=unit*.1&&prevT!==null)splits.push({index:k,distance:rest,seconds:last.t-prevT,heartrate:hrBetween(prevI,last.i),partial:true});
 return splits.filter(s=>s.seconds>0);
}

// Seconds per split unit; used to rank splits and size bars.
export const splitPace=(s:Split,unit:number)=>s.seconds/s.distance*unit;
