import {activityClimbAnalysis} from './activity-terrain-data';
import {sportFamily} from './sports';

// A compact, stored copy of a workout's route and climbs: enough to recognise
// the same route or climb later, draw where you ride, and suggest loops,
// without fetching every past workout again.
export {ROUTE_VERSION} from './route-version';
export type LatLon=[number,number];
export type ClimbSignature={at:number;start:LatLon;end:LatLon;gain:number;seconds:number;distance:number;grade:number};
export type RouteSignature={line:string;distance:number;start:LatLon;end:LatLon};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const outdoor=['running','cycling','walking','hiking'];
type Sampled={sportType?:string;subSportType?:string;seriesSampled?:{sampleSize?:unknown;data?:Record<string,unknown>};[key:string]:unknown};

/** Metres between two points (equirectangular; ample at route scale). */
export function metres(a:LatLon,b:LatLon){
 const k=Math.PI/180,x=(b[1]-a[1])*k*Math.cos((a[0]+b[0])/2*k),y=(b[0]-a[0])*k;return Math.hypot(x,y)*6371000;
}
/** Distance in metres from point p to segment a-b. */
export function toSegment(p:LatLon,a:LatLon,b:LatLon){
 const k=Math.PI/180,cos=Math.cos(p[0]*k),ax=(a[1]-p[1])*cos,ay=a[0]-p[0],bx=(b[1]-p[1])*cos,by=b[0]-p[0],dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
 const t=len?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len)):0;return Math.hypot(ax+t*dx,ay+t*dy)*k*6371000;
}
/** Ramer–Douglas–Peucker, loosened until the line fits the point budget. */
export function simplify(points:LatLon[],budget=180){
 if(points.length<=2)return points;
 for(let tolerance=15;;tolerance*=1.6){
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack:[number,number][]=[[0,points.length-1]];
  while(stack.length){const [i,j]=stack.pop()!;let far=-1,d=tolerance;for(let k=i+1;k<j;k++){const e=toSegment(points[k],points[i],points[j]);if(e>d){d=e;far=k}}if(far>0){keep[far]=1;stack.push([i,far],[far,j])}}
  const out=points.filter((_,i)=>keep[i]);if(out.length<=budget||tolerance>5000)return out;
 }
}
// Google's encoded polyline format, 5 decimals (about 1 m).
export function encode(points:LatLon[]){
 let out='',lat=0,lon=0;const put=(v:number)=>{let n=v<0?~(v<<1):v<<1;while(n>=32){out+=String.fromCharCode((32|(n&31))+63);n>>=5}out+=String.fromCharCode(n+63)};
 for(const [a,b] of points){const la=Math.round(a*1e5),lo=Math.round(b*1e5);put(la-lat);put(lo-lon);lat=la;lon=lo}
 return out;
}
export function decode(line:string):LatLon[]{
 const out:LatLon[]=[];let i=0,lat=0,lon=0;
 const take=()=>{let shift=0,result=0,b;do{b=line.charCodeAt(i++)-63;result|=(b&31)<<shift;shift+=5}while(b>=32&&i<=line.length);return result&1?~(result>>1):result>>1};
 while(i<line.length){lat+=take();lon+=take();out.push([lat/1e5,lon/1e5])}
 return out;
}
function positions(detail:Sampled){
 const lat=detail?.seriesSampled?.data?.positionLat,lon=detail?.seriesSampled?.data?.positionLong;
 if(!Array.isArray(lat)||!Array.isArray(lon))return [];
 const out:{index:number;point:LatLon}[]=[];
 for(let i=0;i<Math.min(lat.length,lon.length);i++){const a=lat[i],b=lon[i];if(finite(a)&&finite(b)&&Math.abs(a)<=85&&Math.abs(b)<=180&&(a||b))out.push({index:i,point:[a,b]})}
 return out;
}
export function routeSignature(detail:Sampled):RouteSignature|null{
 if(!outdoor.includes(sportFamily(detail)))return null;
 const points=positions(detail).map(p=>p.point);if(points.length<10)return null;
 let distance=0;for(let i=1;i<points.length;i++)distance+=metres(points[i-1],points[i]);
 if(distance<500)return null;
 const round=(p:LatLon):LatLon=>[Math.round(p[0]*1e5)/1e5,Math.round(p[1]*1e5)/1e5];
 return {line:encode(simplify(points)),distance:Math.round(distance),start:round(points[0]),end:round(points.at(-1)!)};
}
export function climbSignatures(detail:Sampled):ClimbSignature[]{
 const family=sportFamily(detail),step=detail?.seriesSampled?.sampleSize;
 if(!['running','cycling','walking','hiking'].includes(family)||!finite(step)||step<=0)return [];
 const located=positions(detail);if(!located.length)return [];
 const near=(seconds:number)=>{const index=Math.round(seconds/step);let best=located[0];for(const p of located)if(Math.abs(p.index-index)<Math.abs(best.index-index))best=p;return Math.abs(best.index-index)*step<=30?best.point:null};
 return activityClimbAnalysis(detail,family).climbs.flatMap(c=>{const start=near(c.start),end=near(c.end);return start&&end?[{at:Math.round(c.start),start,end,gain:Math.round(c.gain),seconds:Math.round(c.end-c.start),distance:Math.round(c.distance),grade:Math.round(c.grade*10)/10}]:[]});
}
