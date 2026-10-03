const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const positive=(value:unknown):value is number=>finite(value)&&value>0;
type Point={x:number;metres:number};
export type LapElevation={version:1;min:number;max:number;segments:Point[][]};

/** Recorded altitude, mapped into the same lap widths as the Home pace bars. */
export function lapElevation(detail:any):LapElevation|null{
 const samples=detail?.seriesSampled?.data?.altitude,step=detail?.seriesSampled?.sampleSize;
 if(!Array.isArray(samples)||samples.length<2||samples.length>604800||!positive(step)||detail.mergedIds)return null;
 const laps=(detail.laps??[]).map((lap:any)=>({...lap,...lap.summary}));
 const widths=laps.map((lap:any)=>positive(lap.duration)?lap.duration:positive(lap.durationTotal)?lap.durationTotal:null);
 if(!laps.length||widths.some((width:any)=>width===null))return null;
 const total=widths.reduce((sum:number,width:number)=>sum+width,0),extent=samples.length*step,tolerance=Math.max(5,step*2);
 let durations=laps.map((lap:any)=>positive(lap.durationTotal)?lap.durationTotal:lap.duration);
 const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
 let bounds:{start:number;end:number}[]=[];
 if(durations.every(positive)&&Math.abs(sum(durations)-extent)<=tolerance){
  let at=0;bounds=durations.map((duration:number)=>{const start=at;at+=duration;return {start,end:at}});
 }else if(Math.abs(total-extent)<=tolerance){
  durations=widths;let at=0;bounds=durations.map((duration:number)=>{const start=at;at+=duration;return {start,end:at}});
 }else{
  // For compressed sensor timelines, locate lap boundaries by recorded distance.
  const stream=detail.seriesSampled.data.distance,distances=laps.map((lap:any)=>lap.distance);
  if(!Array.isArray(stream)||stream.length!==samples.length||!distances.every(positive))return null;
  const points=stream.flatMap((distance:any,index:number)=>finite(distance)&&distance>=0?[{distance,index}]:[]),distanceTotal=sum(distances);
  if(points.length<2||points[0].index>1||points.at(-1)!.index<stream.length-2||points[0].distance>Math.max(5,distanceTotal*.005)||Math.abs(points.at(-1)!.distance-distanceTotal)>Math.max(5,distanceTotal*.005)||points.some((point,i)=>i>0&&(point.distance<points[i-1].distance||point.index-points[i-1].index>2)))return null;
  let target=0,previous=0,index=0;
  for(const [i,distance] of distances.entries()){
   target+=distance;while(index<points.length-1&&points[index].distance<target)index++;
   const after=points[index],before=points[Math.max(0,index-1)],delta=after.distance-before.distance;
   const end=i===distances.length-1?extent:(before.index+(delta>0?(target-before.distance)/delta:0)*(after.index-before.index))*step;
   if(end<=previous)return null;bounds.push({start:previous,end});previous=end;
  }
 }
 const runs:Point[][]=[];let run:Point[]=[],lap=0,left=0;
 const finish=()=>{if(run.length>=2)runs.push(run);run=[]};
 for(let i=0;i<samples.length;i++){
  const time=i*step;while(lap<bounds.length-1&&time>=bounds[lap].end){left+=widths[lap];lap++}
  const value=samples[i];if(!finite(value)||time>bounds[lap].end){finish();continue}
  const fraction=(time-bounds[lap].start)/(bounds[lap].end-bounds[lap].start),x=(left+Math.max(0,Math.min(1,fraction))*widths[lap])/total;
  run.push({x,metres:value});
 }
 finish();if(!runs.length||runs.length>32)return null;
 let min=Infinity,max=-Infinity;for(const points of runs)for(const point of points){min=Math.min(min,point.metres);max=Math.max(max,point.metres)}
 const count=runs.reduce((n,points)=>n+points.length,0);
 // Keep each bucket's endpoints and extrema. Gaps remain separate paths;
 // even long recordings send at most 384 points in their Home preview.
 const segments=runs.map(points=>{
  const buckets=Math.max(1,Math.floor(64*points.length/count)),size=Math.ceil(points.length/buckets),selected:Point[]=[];
  for(let start=0;start<points.length;start+=size){
   const end=Math.min(points.length,start+size);let low=start,high=start;
   for(let i=start+1;i<end;i++){if(points[i].metres<points[low].metres)low=i;if(points[i].metres>points[high].metres)high=i}
   for(const index of [...new Set([start,low,high,end-1])].sort((a,b)=>a-b))selected.push({x:+points[index].x.toFixed(6),metres:+points[index].metres.toFixed(1)});
  }
  return selected;
 });
 return {version:1,min:+min.toFixed(1),max:+max.toFixed(1),segments};
}

export function lapElevationPaths(elevation:LapElevation){
 const range=elevation.max-elevation.min;
 return elevation.segments.map(points=>points.map((point,i)=>`${i?'L':'M'}${(point.x*1000).toFixed(2)},${(range>0?92-(point.metres-elevation.min)/range*84:50).toFixed(2)}`).join(' '));
}
