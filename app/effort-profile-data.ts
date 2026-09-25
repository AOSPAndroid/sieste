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
 for(const [i,lap] of (detail.laps??[]).entries()){const s={...lap,...lap.summary},d=s.durationTotal??s.duration;if(!finite(d)||d<=0){aligned=false;break}laps.push({index:i+1,start:cursor/60,end:(cursor+d)/60,power:finite(s.power)?s.power:null,hr:finite(s.heartrate)?s.heartrate:null});cursor+=d}
 // Cumulative active laps cannot be overlaid reliably onto elapsed samples when pauses differ.
 const extent=rows.length?rows.at(-1)!.time*60+step:0;if(Math.abs(cursor-extent)>Math.max(10,step*2))aligned=false;
 return {rows,laps:aligned?laps:[],efforts,threshold,reason:!aligned&&detail.laps?.length?'Lap timing does not match the sensor timeline; lap overlay omitted.':null};
}

const resultCache=new WeakMap<object,Map<string,ReturnType<typeof computeeffortProfile>>>();
export function effortProfile(detail:any,sensor='power'){
 let entries=resultCache.get(detail);if(!entries){entries=new Map();resultCache.set(detail,entries)}
 const key=String(sensor);const cached=entries.get(key);if(cached)return cached;const result=computeeffortProfile(detail,sensor);entries.set(key,result);return result;
}
