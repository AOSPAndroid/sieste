const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const quantile=(v:number[],q:number)=>{const a=[...v].sort((a,b)=>a-b);return a[Math.floor((a.length-1)*q)]};
function computeeffortProfile(detail:any,sensor='power'){
 const streams=detail.seriesSampled?.data??{},step=detail.seriesSampled?.sampleSize;
 if(!finite(step)||step<=0)return {rows:[],laps:[],efforts:[],threshold:null,reason:'Timed sensor samples are needed to align the profile.'};
 const n=Math.max(...['altitude',sensor].map(k=>Array.isArray(streams[k])?streams[k].length:0)),duration=detail.summary?.durationTotal;
 const rows=Array.from({length:n},(_,i)=>({time:i*step/60,altitude:finite(streams.altitude?.[i])?streams.altitude[i]:null,value:finite(streams[sensor]?.[i])?streams[sensor][i]:null})).filter(r=>!finite(duration)||r.time*60<=duration);
 const positive=rows.map(r=>r.value).filter((v):v is number=>finite(v)&&v>0),median=positive.length?quantile(positive,.5):0;
 const threshold=positive.length>=20?Math.max(quantile(positive,.8),median*(sensor==='power'?1.2:sensor==='speed'?1.08:1.05)):null;
 const efforts:{start:number;end:number;mean:number;gain:number|null;peak:number}[]=[];
 // Running uses 10s smoothing to retain short surges; require 30s sustained.
 // Gaps always break efforts.
 const window=Math.max(1,Math.ceil((sensor==='speed'?10:30)/step));let start=-1;
 function finish(end:number){if(start<0)return;const part=rows.slice(start,end+1);if(part.length*step>=30){const values=part.map(r=>r.value).filter(finite),a=part[0].altitude,b=part.at(-1)!.altitude;efforts.push({start:part[0].time,end:(part.at(-1)!.time+step/60),mean:values.reduce((a,b)=>a+b,0)/values.length,peak:Math.max(...values),gain:finite(a)&&finite(b)?b-a:null})}start=-1}
 for(let i=0;i<rows.length;i++){const sample=rows.slice(Math.max(0,i-window+1),i+1).map(r=>r.value),valid=sample.length===window&&sample.every(finite);const high=threshold!==null&&valid&&(sample as number[]).reduce((a,b)=>a+b,0)/window>=threshold;if(high){if(start<0)start=i}else finish(i-1)}finish(rows.length-1);
 const laps:{index:number;start:number;end:number;power:number|null;hr:number|null}[]=[];let cursor=0,aligned=true;
 for(const [i,lap] of (detail.laps??[]).entries()){const s={...lap,...lap.summary},d=s.durationTotal??s.duration;if(!finite(d)||d<=0){aligned=false;break}if(detail.mergedIds){if(!finite(lap.mergedStartSeconds)){aligned=false;break}cursor=lap.mergedStartSeconds;}laps.push({index:i+1,start:cursor/60,end:(cursor+d)/60,power:finite(s.power)?s.power:null,hr:finite(s.heartrate)?s.heartrate:null});cursor+=d}
 // Sensor streams may omit pauses while lap timestamps use wall-clock time.
 // Match cumulative recorded distances instead of stretching lap timer durations.
 const extent=rows.length?rows.at(-1)!.time*60+step:0;
 const tolerance=Math.max(10,step*2);
 if(Math.abs(cursor-extent)>tolerance)aligned=false;
 let distanceAligned=false;
 if(!detail.mergedIds&&laps.length===(detail.laps??[]).length&&laps.length){
  const distances=detail.laps.map((l:any)=>({...l,...l.summary}).distance);
  const stream=streams.distance;
  const total=distances.reduce((sum:number,d:any)=>sum+(finite(d)?d:0),0);
  const complete=Array.isArray(stream)&&stream.length===n&&stream.every((d:any,i:number)=>finite(d)&&d>=0&&(i===0||d>=stream[i-1]));
  if(complete&&distances.every((d:any)=>finite(d)&&d>0)&&total>0&&Math.abs(stream.at(-1)-total)<=Math.max(5,total*.005)&&stream[0]<=Math.max(100,total*.02)){
   const boundary=(target:number)=>{
    const j=stream.findIndex((d:number)=>d>=target);
    if(j<0)return rows.at(-1)!.time;
    if(j===0)return 0;
    const delta=stream[j]-stream[j-1];
    return ((j-1)+(delta>0?(target-stream[j-1])/delta:0))*step/60;
   };
   let distance=0,prior=0;
   const bounds=distances.map((d:number,i:number)=>{distance+=d;const end=i===distances.length-1?Math.min(extent,detail.summary?.duration??extent)/60:boundary(distance);const result={start:prior,end};prior=end;return result});
   if(bounds.every((v:any)=>finite(v.end)&&v.end>v.start)){
    bounds.forEach((v:any,i:number)=>Object.assign(laps[i],v));aligned=true;distanceAligned=true;
   }
  }
 }
 return {rows,laps:aligned?laps:[],efforts,threshold,reason:distanceAligned?'Lap highlights follow recorded distance; boundaries are approximate at the sensor sample resolution.':!aligned&&detail.laps?.length?'Recorded laps are available below. Their timing cannot be reliably aligned with this sensor timeline.':null};

}

const resultCache=new WeakMap<object,Map<string,ReturnType<typeof computeeffortProfile>>>();
export function effortProfile(detail:any,sensor='power'){
 let entries=resultCache.get(detail);if(!entries){entries=new Map();resultCache.set(detail,entries)}
 const key=String(sensor);const cached=entries.get(key);if(cached)return cached;const result=computeeffortProfile(detail,sensor);entries.set(key,result);return result;
}
