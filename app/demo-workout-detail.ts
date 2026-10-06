import type {Workout} from './analytics';
import {sportFamily} from './sports';
/** Only for the explicitly labelled demo account, never connected recordings. */
export function demoWorkoutDetail(activity:Workout){
 const family=sportFamily(activity),cycling=family==='cycling',endurance=['running','cycling','walking','hiking'].includes(family),duration=activity.summary?.duration??3600,step=5,count=Math.ceil(duration/step)+1;
 const distance=activity.summary?.distance??0,seed=Array.from(activity.id).reduce((sum,c)=>sum+c.charCodeAt(0),0)%17;
 const phase=(i:number)=>i/(count-1),speedShape=Array.from({length:count},(_,i)=>i%240===130?0:1+.025*Math.sin(i/19+seed)+(i%180>145?.12:0)),scale=distance>0?distance/speedShape.slice(1).reduce((sum,v)=>sum+v*step,0):0;
 const speed=speedShape.map(v=>v*scale),distances:number[]=[0];for(let i=1;i<count;i++)distances.push(distances[i-1]+speed[i]*step);
 const series:Record<string,(number|null)[]>={heartrate:Array.from({length:count},(_,i)=>Math.round((activity.summary?.heartrate??135)+7*Math.sin(i/30)+phase(i)*5)),cadence:Array.from({length:count},(_,i)=>cycling?(i%180>155?0:Math.round(85+5*Math.sin(i/20))):Math.round(178+4*Math.sin(i/25)))};
 if(!endurance)delete series.cadence;
 if(endurance){Object.assign(series,{speed,distance:distances,grade:Array.from({length:count},(_,i)=>i%300>230?5:i%300>180?-4:.3*Math.sin(i/40)),altitude:Array.from({length:count},(_,i)=>70+30*Math.sin(i/60)),positionLat:distances.map(d=>48.86+.012*Math.cos(d/Math.max(1,distance)*Math.PI*2)),positionLong:distances.map(d=>2.29+.02*Math.sin(d/Math.max(1,distance)*Math.PI*2))});}
 if(cycling)series.power=Array.from({length:count},(_,i)=>i%180>155?0:Math.round((activity.summary?.power??230)+10*Math.sin(i/35+seed)+(i%180>145?80:0)));
 else if(family==='running'){series.power=speed.map(v=>Math.round(v*62));series.stepLength=speed.map(v=>v>0?Math.round(v/3*100):null);series.groundContactTime=speed.map(v=>v>0?Math.round(230-v*4):null)}
 const proportions=[.15,.35,.35,.15],boundaries=[0];for(const p of proportions)boundaries.push(boundaries.at(-1)!+p*duration);
 const average=(key:string,start:number,end:number)=>{const values=series[key]?.slice(Math.floor(start/step),Math.floor(end/step)).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v))??[];return values.length?values.reduce((sum,v)=>sum+v,0)/values.length:undefined};
 const laps=proportions.map((p,i)=>{const start=boundaries[i],end=boundaries[i+1],from=Math.floor(start/step),to=Math.min(count-1,Math.floor(end/step));return {lap:i+1,duration:p*duration,durationTotal:p*duration,...(endurance?{distance:distances[to]-distances[from],speed:average('speed',start,end)}:{}),heartrate:average('heartrate',start,end),power:average('power',start,end),cadence:average('cadence',start,end),notes:'Illustrative demo lap'}});
 return {...activity,demo:true,laps,summary:{...activity.summary,durationTotal:duration},seriesSampled:{sampleSize:step,data:series}};
}
