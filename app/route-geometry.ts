export type RoutePoint={lat:number;lon:number;index:number;x:number;y:number};
/** Fit existing projected points, retaining their unwrapped dateline coordinates. */
export function fitRouteSegments(segments:ReadonlyArray<ReadonlyArray<Pick<RoutePoint,'x'|'y'>>>){
 let count=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const segment of segments)for(const point of segment){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
  count++;minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
 }
 if(count<2||maxX-minX<1e-10&&maxY-minY<1e-10)return null;
 const zoom=Math.max(1,Math.min(17,Math.floor(Math.log2(Math.min(700/(Math.max(1e-9,maxX-minX)*256),320/(Math.max(1e-9,maxY-minY)*256))))));
 return {center:{x:(minX+maxX)/2,y:(minY+maxY)/2},zoom};
}
export function routeGeometry(latitudes:unknown[],longitudes:unknown[]){
 const segments:RoutePoint[][]=[];let current:RoutePoint[]=[];let previousX:number|undefined;
 for(let i=0;i<Math.min(latitudes.length,longitudes.length);i++){
  const lat=latitudes[i],lon=longitudes[i];
  if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85.05112878||Math.abs(lon)>180){if(current.length)segments.push(current);current=[];continue}
  let x=(lon+180)/360;if(previousX!==undefined){while(x-previousX>.5)x--;while(x-previousX<-.5)x++}previousX=x;
  const sine=Math.sin(lat*Math.PI/180),y=.5-Math.log((1+sine)/(1-sine))/(4*Math.PI);current.push({lat,lon,index:i,x,y});
 }
 if(current.length)segments.push(current);const points=segments.flat(),fit=fitRouteSegments(segments);if(!fit)return null;
 return {segments,points,...fit};
}

export type RouteSelection={start:number;end:number;label:string;kind?:'climb'|'effort'|'lap';revision?:number};
/** Automatic effort and climb framing shows twice the surrounding span of a manual fit. */
export function contextualSelectionFit(fit:ReturnType<typeof fitRouteSegments>,kind:RouteSelection['kind']){
 return fit&&(kind==='climb'||kind==='effort')?{center:fit.center,zoom:Math.max(1,fit.zoom-1)}:null;
}
// Selection uses elapsed minutes and original GPS sample indices, never compressed point counts.
export function selectedRouteSegments(segments:RoutePoint[][],step:unknown,selection:RouteSelection|null){
 if(!selection||typeof step!=='number'||!Number.isFinite(step)||step<=0||!Number.isFinite(selection.start)||selection.start<0||!Number.isFinite(selection.end)||selection.end<=selection.start)return [];
 return segments.map(segment=>segment.filter(p=>p.index*step>=selection.start*60&&p.index*step<selection.end*60)).filter(segment=>segment.length>0);
}
