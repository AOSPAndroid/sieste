// The wind map around the chosen town: a small grid of forecast points over
// the visible area, each drawn as a wind arrow.
export const mapView={width:800,height:420,zoom:11};
export type GridPoint={latitude:number;longitude:number;x:number;y:number};
export type GridHour={time:number;wind:number|null;direction:number|null;gust:number|null};
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;

/** Web Mercator pixel position at a zoom level. */
export function project(latitude:number,longitude:number,zoom=mapView.zoom){
 const scale=256*2**zoom,sine=Math.sin(latitude*Math.PI/180);
 return {x:(longitude+180)/360*scale,y:(.5-Math.log((1+sine)/(1-sine))/(4*Math.PI))*scale};
}
export function unproject(x:number,y:number,zoom=mapView.zoom){
 const scale=256*2**zoom,n=Math.PI-2*Math.PI*y/scale;
 return {latitude:180/Math.PI*Math.atan(Math.sinh(n)),longitude:x/scale*360-180};
}
/** The map's top-left pixel, size and edges in degrees, centred on a point. */
export function mapFrame(latitude:number,longitude:number,zoom=mapView.zoom,width=mapView.width,height=mapView.height){
 const c=project(latitude,longitude,zoom),left=c.x-width/2,top=c.y-height/2;
 const nw=unproject(left,top,zoom),se=unproject(left+width,top+height,zoom);
 return {left,top,zoom,width,height,south:se.latitude,west:nw.longitude,north:nw.latitude,east:se.longitude};
}
/** Move the centre by a drag of (dx,dy) pixels. */
export function panBy(latitude:number,longitude:number,zoom:number,dx:number,dy:number){
 const c=project(latitude,longitude,zoom);return unproject(c.x-dx,c.y-dy,zoom);
}
/** Evenly spaced forecast points across the frame, in map pixels. */
export function gridPoints(frame:ReturnType<typeof mapFrame>,columns=5,rows=4):GridPoint[]{
 const points:GridPoint[]=[];
 for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
  const x=(c+.5)/columns*frame.width,y=(r+.5)/rows*frame.height,{latitude,longitude}=unproject(frame.left+x,frame.top+y,frame.zoom);
  points.push({latitude:Math.round(latitude*1000)/1000,longitude:Math.round(longitude*1000)/1000,x,y});
 }
 return points;
}
/** Open-Meteo answers a multi-location request with one forecast per location, in order. */
export function parseGrid(payload:unknown,count:number):GridHour[][]{
 const list=Array.isArray(payload)?payload:[payload];
 if(list.length!==count)throw new Error('The wind map is unavailable.');
 return list.map((item:{hourly?:Record<string,unknown[]>})=>{
  const h=item?.hourly??{},time=Array.isArray(h.time)?h.time:[];
  return time.flatMap((t,i)=>typeof t==='number'?[{time:t,wind:num(h.wind_speed_10m?.[i]),direction:num(h.wind_direction_10m?.[i]),gust:num(h.wind_gusts_10m?.[i])}]:[]);
 });
}
