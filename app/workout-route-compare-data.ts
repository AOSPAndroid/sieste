import {sportFamily} from './sports';
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const positive=(value:unknown):value is number=>finite(value)&&value>0;
type RouteSample={distance:number;lat:number;lon:number;time:number;moving:number;speed:number|null;power:number|null;hr:number|null;index:number};
export type RouteComparisonPoint={km:number;currentSpeed:number|null;priorSpeed:number|null;currentPower:number|null;priorPower:number|null;currentHR:number|null;priorHR:number|null;delta:number|null;currentTime:number;priorTime:number};
export type RouteComparison={matched:boolean;reason:string;points:RouteComparisonPoint[];overlap:number;medianGap:number|null;movingTimeAvailable:boolean;commonDistance:number;delta:number|null};
export type RouteCandidate={activity:Record<string,any>;distance:number;score:number};

/** Summary similarity is only a shortlist; it does not claim the route matches. */
export function routeCandidates(detail:Record<string,any>,history:Record<string,any>[]){
 const distance=detail.summary?.distance,when=Date.parse(detail.date),family=sportFamily(detail);
 if(!positive(distance)||!Number.isFinite(when))return [];
 return history.flatMap(activity=>{
  const d=activity.summary?.distance,date=Date.parse(activity.date);
  if(activity.id===detail.id||!activity.id||!positive(d)||!Number.isFinite(date)||date>=when||sportFamily(activity)!==family||!['running','cycling','walking','hiking'].includes(family))return [];
  const difference=Math.abs(d-distance)/distance;
  // Merged and imported recordings are only selectable if already resident.
  if(difference>.15||(activity.mergedIds||activity.imported)&&!activity.seriesSampled)return [];
  return [{activity,distance:d,score:difference+(when-date)/86400000*.0003}];
 }).sort((a,b)=>a.score-b.score).slice(0,8);
}

export function fetchableComparisonId(activity:Record<string,any>){
 return !activity.mergedIds&&!activity.imported&&typeof activity.id==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(activity.id);
}

function metres(a:Pick<RouteSample,'lat'|'lon'>,b:Pick<RouteSample,'lat'|'lon'>){
 const rad=Math.PI/180,p=Math.sin((b.lat-a.lat)*rad/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lon-a.lon)*rad/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,p)),Math.sqrt(Math.max(0,1-p)));
}

function samples(detail:Record<string,any>){
 const data=detail.seriesSampled?.data??{},step=detail.seriesSampled?.sampleSize,distance=data.distance;
 if(!positive(step)||step>10||!Array.isArray(distance)||distance.length<20||distance.length>604800||!Array.isArray(data.positionLat)||!Array.isArray(data.positionLong))return {points:[] as RouteSample[],reason:'Recorded GPS, cumulative distance and samples at least every 10 seconds are needed.',complete:false};
 const count=distance.length,points:RouteSample[]=[];let previousDistance=-Infinity,moving=0,missingClock=0,knownDistance=0,knownGPS=0;
 for(let index=0;index<count;index++){
  const d=distance[index],lat=data.positionLat[index],lon=data.positionLong[index],speed=data.speed?.[index];
  if(finite(speed)&&speed>=0&&speed<=45){if(speed>.5)moving+=step}else missingClock+=step;
  if(!finite(d)||d<0)continue;
  if(d<previousDistance-1e-8)return {points:[] as RouteSample[],reason:'The cumulative-distance stream resets or moves backwards.',complete:false};
  previousDistance=d;knownDistance++;
  if(!finite(lat)||!finite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)continue;
  knownGPS++;
  points.push({distance:d,lat,lon,time:index*step,moving:moving-(finite(speed)&&speed>.5?step:0),speed:finite(speed)&&speed>0&&speed<=45?speed:null,power:finite(data.power?.[index])&&data.power[index]>=0?data.power[index]:null,hr:positive(data.heartrate?.[index])&&data.heartrate[index]<250?data.heartrate[index]:null,index});
 }
 if(points.length<20||knownDistance/count<.95||knownGPS/count<.9||points[0].index>2||points.at(-1)!.index<count-3)return {points:[] as RouteSample[],reason:'Route coverage is too incomplete to compare the recordings reliably.',complete:false};
 const first=points[0].distance,last=points.at(-1)!.distance,summary=detail.summary?.distance;
 if(first>Math.max(40,last*.01)||last-first<400||positive(summary)&&Math.abs(last-summary)>Math.max(100,summary*.03))return {points:[] as RouteSample[],reason:'Recorded distance does not cover the whole route.',complete:false};
 return {points:points.map(point=>({...point,distance:point.distance-first})),reason:'',complete:missingClock===0};
}

/** Interpolate only neighbouring recorded samples; no joining GPS/data gaps. */
function at(points:RouteSample[],target:number){
 let low=0,high=points.length-1;while(low<high){const middle=(low+high)>>1;if(points[middle].distance<target)low=middle+1;else high=middle}
 const after=points[low],before=points[Math.max(0,low-1)];
 if(target<before.distance-.1||target>after.distance+.1||after.index-before.index>2)return null;
 const delta=after.distance-before.distance,fraction=delta>0?(target-before.distance)/delta:0;
 const value=(key:'speed'|'power'|'hr')=>before[key]!==null&&after[key]!==null?before[key]!+(after[key]!-before[key]!)*fraction:null;
 // Longitude is unwrapped for routes crossing the dateline.
 let longitude=after.lon-before.lon;while(longitude>180)longitude-=360;while(longitude< -180)longitude+=360;
 return {...before,distance:target,lat:before.lat+(after.lat-before.lat)*fraction,lon:before.lon+longitude*fraction,time:before.time+(after.time-before.time)*fraction,moving:before.moving+(after.moving-before.moving)*fraction,speed:value('speed'),power:value('power'),hr:value('hr')};
}

export function compareRoutes(detail:Record<string,any>,prior:Record<string,any>):RouteComparison{
 const fail=(reason:string):RouteComparison=>({matched:false,reason,points:[],overlap:0,medianGap:null,movingTimeAvailable:false,commonDistance:0,delta:null});
 if(sportFamily(detail)!==sportFamily(prior))return fail('Choose an earlier recording of the same sport.');
 const current=samples(detail),previous=samples(prior);
 if(!current.points.length)return fail(current.reason);if(!previous.points.length)return fail(`Earlier recording: ${previous.reason}`);
 const currentDistance=current.points.at(-1)!.distance,priorDistance=previous.points.at(-1)!.distance;
 if(Math.abs(currentDistance-priorDistance)/Math.max(currentDistance,priorDistance)>.03)return fail('The routes have different recorded lengths. Try a closer match.');
 const gaps:number[]=[];let agreeingDirection=0,directions=0;
 // Shape checks at the same route fraction are separate from time differences,
 // which use common recorded metres without stretching either time axis.
 for(let i=0;i<=60;i++){
  const fraction=i/60,a=at(current.points,currentDistance*fraction),b=at(previous.points,priorDistance*fraction);
  if(!a||!b)continue;gaps.push(metres(a,b));
  if(i%4===0&&i<60){const nextA=at(current.points,currentDistance*Math.min(1,fraction+.025)),nextB=at(previous.points,priorDistance*Math.min(1,fraction+.025));if(nextA&&nextB){const cosine=Math.cos(a.lat*Math.PI/180),ax=(nextA.lon-a.lon)*cosine,ay=nextA.lat-a.lat,bx=(nextB.lon-b.lon)*cosine,by=nextB.lat-b.lat,denominator=Math.hypot(ax,ay)*Math.hypot(bx,by);if(denominator>1e-10){directions++;if((ax*bx+ay*by)/denominator>.3)agreeingDirection++}}}
 }
 const overlap=gaps.filter(gap=>gap<=75).length/gaps.length,sorted=[...gaps].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
 const startGap=metres(current.points[0],previous.points[0]),finishGap=metres(current.points.at(-1)!,previous.points.at(-1)!);
 if(gaps.length<55||overlap<.9||median>35||startGap>80||finishGap>80||directions<8||agreeingDirection/directions<.8)return fail('GPS does not confirm the same route in the same direction. Similar distance alone is not enough.');
 const commonDistance=Math.min(currentDistance,priorDistance),movingTimeAvailable=current.complete&&previous.complete,points:RouteComparisonPoint[]=[];
 for(let i=0;i<=100;i++){
  const target=commonDistance*i/100,a=at(current.points,target),b=at(previous.points,target);
  if(!a||!b){points.push({km:target/1000,currentSpeed:null,priorSpeed:null,currentPower:null,priorPower:null,currentHR:null,priorHR:null,delta:null,currentTime:0,priorTime:0});continue}
  points.push({km:target/1000,currentSpeed:a.speed!==null?a.speed*3.6:null,priorSpeed:b.speed!==null?b.speed*3.6:null,currentPower:a.power,priorPower:b.power,currentHR:a.hr,priorHR:b.hr,delta:movingTimeAvailable?a.moving-b.moving:null,currentTime:a.time/60,priorTime:b.time/60});
 }
 return {matched:true,reason:'GPS confirms a close route match. Differences use common recorded distance; GPS and sample resolution make them approximate.',points,overlap,medianGap:median,movingTimeAvailable,commonDistance,delta:movingTimeAvailable?points.at(-1)?.delta??null:null};
}
