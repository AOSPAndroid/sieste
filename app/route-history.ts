import {decode,metres,toSegment,type LatLon,type RouteSignature,type ClimbSignature} from './route-signature';
import {sportFamily} from './sports';

// Uses the compact routes and climbs stored with past workouts: the same
// route or climb ridden before, records set in this workout, and where you
// usually ride.
type Best={seconds:number;value:number};
export type HistoryWorkout={id:string;date:string;sportType?:string;subSportType?:string;title?:string;summary?:{duration?:unknown;distance?:unknown;heartrate?:unknown;power?:unknown};evidence?:{best?:Record<string,(Best|null)[]>;route?:RouteSignature|null;climbs?:ClimbSignature[]}};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const lineCache=new Map<string,LatLon[]>();
export function routePoints(route:RouteSignature){let points=lineCache.get(route.line);if(!points){points=decode(route.line);if(lineCache.size>2000)lineCache.clear();lineCache.set(route.line,points)}return points}
/** Distance from p to the nearest part of a line, in metres. */
function nearLine(p:LatLon,line:LatLon[]){let best=Infinity;for(let i=1;i<line.length;i++)best=Math.min(best,toSegment(p,line[i-1],line[i]));return line.length===1?metres(p,line[0]):best}
/** Points spread evenly along a line, for comparing shapes. */
function along(line:LatLon[],count=24){
 const lengths=[0];for(let i=1;i<line.length;i++)lengths.push(lengths[i-1]+metres(line[i-1],line[i]));
 const total=lengths.at(-1)!,out:LatLon[]=[];if(!total)return [line[0]];
 for(let k=0;k<count;k++){const d=total*k/(count-1);let i=1;while(i<lengths.length-1&&lengths[i]<d)i++;const t=lengths[i]===lengths[i-1]?0:(d-lengths[i-1])/(lengths[i]-lengths[i-1]);out.push([line[i-1][0]+(line[i][0]-line[i-1][0])*t,line[i-1][1]+(line[i][1]-line[i-1][1])*t])}
 return out;
}
/** Same start, same finish, similar length and the same shape both ways. */
export function sameRoute(a:RouteSignature,b:RouteSignature){
 if(metres(a.start,b.start)>300||metres(a.end,b.end)>300||Math.abs(a.distance-b.distance)>Math.max(a.distance,b.distance)*.1)return false;
 const la=routePoints(a),lb=routePoints(b),within=(from:LatLon[],to:LatLon[])=>along(from).filter(p=>nearLine(p,to)<=120).length/24;
 return within(la,lb)>=.85&&within(lb,la)>=.85;
}
const earlier=(w:HistoryWorkout,date:string,id:string,family:string)=>w.id!==id&&sportFamily(w)===family&&Date.parse(w.date)<Date.parse(date);

/** Earlier sessions on the same route, fastest first, with where this one ranks. */
export function routeAttempts(current:HistoryWorkout&{evidence:{route:RouteSignature}},history:HistoryWorkout[]){
 const family=sportFamily(current),route=current.evidence.route;
 const previous=history.filter(w=>earlier(w,current.date,current.id,family)&&w.evidence?.route&&finite(w.summary?.duration)&&sameRoute(route,w.evidence.route));
 if(!previous.length||!finite(current.summary?.duration))return null;
 const all=[current,...previous].sort((a,b)=>(a.summary!.duration as number)-(b.summary!.duration as number));
 const best=all[0],rank=all.indexOf(current)+1;
 return {attempts:all,rank,count:all.length,behind:(current.summary!.duration as number)-(best.summary!.duration as number),best};
}
/** Earlier times up the same climb: start and top within 80 m of this one's. */
export function climbAttempts(climb:ClimbSignature,current:HistoryWorkout,history:HistoryWorkout[]){
 const family=sportFamily(current),times:{seconds:number;date:string;id:string}[]=[];
 for(const w of history){if(!earlier(w,current.date,current.id,family))continue;for(const c of w.evidence?.climbs??[])if(metres(c.start,climb.start)<=80&&metres(c.end,climb.end)<=80){times.push({seconds:c.seconds,date:w.date,id:w.id});break}}
 if(!times.length)return null;
 const all=[...times,{seconds:climb.seconds,date:current.date,id:current.id}].sort((a,b)=>a.seconds-b.seconds);
 return {rank:all.findIndex(t=>t.id===current.id)+1,count:all.length,best:all[0],behind:climb.seconds-all[0].seconds};
}

const durations:[number,string][]=[[60,'1 min'],[300,'5 min'],[1200,'20 min'],[3600,'60 min']];
/**
 * New bests set in this workout against everything recorded before it: best
 * power (bike) or pace (on foot) over 1-60 minutes, longest distance and the
 * biggest single climb. Needs a few earlier analysed sessions to mean much.
 */
export function workoutRecords(current:HistoryWorkout,history:HistoryWorkout[]){
 const family=sportFamily(current),prior=history.filter(w=>earlier(w,current.date,current.id,family));
 const analysed=prior.filter(w=>w.evidence?.best);if(analysed.length<3)return [];
 const key=family==='cycling'?'power':'speed',records:{id:string;label:string;value:number;previous:number;kind:'power'|'speed'|'distance'|'climb'}[]=[];
 const bestOf=(w:HistoryWorkout,seconds:number)=>w.evidence?.best?.[key]?.find(b=>b?.seconds===seconds)?.value;
 for(const [seconds,label] of durations){
  const mine=bestOf(current,seconds);if(!finite(mine))continue;
  const before=Math.max(...analysed.map(w=>bestOf(w,seconds)).filter(finite));
  if(Number.isFinite(before)&&mine>before)records.push({id:`${key}-${seconds}`,label:`${label} ${key==='power'?'power':'pace'}`,value:mine,previous:before,kind:key as 'power'|'speed'});
 }
 const distance=current.summary?.distance,longest=Math.max(...prior.map(w=>w.summary?.distance).filter(finite));
 if(finite(distance)&&Number.isFinite(longest)&&distance>longest)records.push({id:'distance',label:'Longest distance',value:distance,previous:longest,kind:'distance'});
 const gain=Math.max(...(current.evidence?.climbs??[]).map(c=>c.gain)),biggest=Math.max(...prior.flatMap(w=>(w.evidence?.climbs??[]).map(c=>c.gain)));
 if(Number.isFinite(gain)&&Number.isFinite(biggest)&&gain>biggest)records.push({id:'climb',label:'Biggest climb',value:gain,previous:biggest,kind:'climb'});
 return records;
}

/** Outbound bearing in degrees: from the start towards the point farthest from it. */
export function outboundBearing(line:LatLon[]){
 const start=line[0];let far=start,d=0;for(const p of line){const m=metres(start,p);if(m>d){d=m;far=p}}
 const k=Math.PI/180,y=Math.sin((far[1]-start[1])*k)*Math.cos(far[0]*k),x=Math.cos(start[0]*k)*Math.sin(far[0]*k)-Math.sin(start[0]*k)*Math.cos(far[0]*k)*Math.cos((far[1]-start[1])*k);
 return (Math.atan2(y,x)/k+360)%360;
}
/**
 * Rides you have done from near this place, ranked for the forecast: heading
 * out into the wind (so it is behind you on the way home) and a length that
 * fits the ride window. Near-identical routes count once, most recent kept.
 */
export function suggestLoops(history:HistoryWorkout[],place:LatLon,wind:{from:number;mean:number}|null,targetMetres:number|null,limit=3){
 const rides=history.filter(w=>sportFamily(w)==='cycling'&&w.evidence?.route&&metres(w.evidence.route.start,place)<=3000).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 const unique:HistoryWorkout[]=[];for(const r of rides)if(!unique.some(u=>sameRoute(u.evidence!.route!,r.evidence!.route!)))unique.push(r);
 return unique.map(w=>{
  const route=w.evidence!.route!,line=routePoints(route),heading=outboundBearing(line);
  const into=wind&&wind.mean>=8?Math.cos((heading-wind.from)*Math.PI/180):0,fit=targetMetres?1-Math.min(1,Math.abs(route.distance-targetMetres)/targetMetres):.5;
  return {workout:w,route,line,heading,into,fit,score:(wind&&wind.mean>=8?.6*into:0)+.4*fit};
 }).sort((a,b)=>b.score-a.score).slice(0,limit);
}
