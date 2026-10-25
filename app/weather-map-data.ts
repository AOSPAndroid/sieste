import {windBearing,type WeatherHour} from './weather-recon-data';

// The wind map around the chosen town: a small grid of forecast points over
// the visible area, interpolated into a colour layer, plus riding stops from
// OpenStreetMap and a direction to start the ride in.
export const mapView={width:800,height:420,zoom:11};
export type GridPoint={latitude:number;longitude:number;x:number;y:number};
export type GridHour={time:number;wind:number|null;direction:number|null;gust:number|null;rainChance:number|null;temperature:number|null};
export type Poi={id:string;kind:'water'|'cafe'|'bike'|'repair'|'toilets';name:string;latitude:number;longitude:number;x:number;y:number};
export type HeatLayer='wind'|'rain'|'temperature';
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
/** The map's top-left pixel and its edges in degrees, centred on the town. */
export function mapFrame(latitude:number,longitude:number,zoom=mapView.zoom){
 const c=project(latitude,longitude,zoom),left=c.x-mapView.width/2,top=c.y-mapView.height/2;
 const nw=unproject(left,top,zoom),se=unproject(left+mapView.width,top+mapView.height,zoom);
 return {left,top,zoom,south:se.latitude,west:nw.longitude,north:nw.latitude,east:se.longitude};
}
/** Evenly spaced forecast points across the frame, in map pixels. */
export function gridPoints(frame:ReturnType<typeof mapFrame>,columns=5,rows=4):GridPoint[]{
 const points:GridPoint[]=[];
 for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
  const x=(c+.5)/columns*mapView.width,y=(r+.5)/rows*mapView.height,{latitude,longitude}=unproject(frame.left+x,frame.top+y,frame.zoom);
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
  return time.flatMap((t,i)=>typeof t==='number'?[{time:t,wind:num(h.wind_speed_10m?.[i]),direction:num(h.wind_direction_10m?.[i]),gust:num(h.wind_gusts_10m?.[i]),rainChance:num(h.precipitation_probability?.[i]),temperature:num(h.temperature_2m?.[i])}]:[]);
 });
}
const field:Record<HeatLayer,keyof GridHour>={wind:'wind',rain:'rainChance',temperature:'temperature'};
/** Values at one hour across the grid, null where a point has no reading. */
export function gridValues(grid:GridHour[][],time:number,layer:HeatLayer){return grid.map(hours=>num(hours.find(h=>h.time===time)?.[field[layer]]))}
/** Bilinear interpolation of a columns×rows grid at map pixel (x,y). */
export function interpolate(values:(number|null)[],columns:number,rows:number,x:number,y:number){
 const gx=Math.min(columns-1,Math.max(0,x/mapView.width*columns-.5)),gy=Math.min(rows-1,Math.max(0,y/mapView.height*rows-.5));
 const c0=Math.floor(gx),r0=Math.floor(gy),c1=Math.min(columns-1,c0+1),r1=Math.min(rows-1,r0+1),fx=gx-c0,fy=gy-r0;
 const corners:[number,number][]=[[r0*columns+c0,(1-fx)*(1-fy)],[r0*columns+c1,fx*(1-fy)],[r1*columns+c0,(1-fx)*fy],[r1*columns+c1,fx*fy]];
 let sum=0,weight=0;for(const [i,w] of corners){const v=values[i];if(v!==null&&w>0){sum+=v*w;weight+=w}}
 return weight?sum/weight:null;
}
/** Colour ramps for the heat layer; each value maps onto a fixed, readable scale. */
export const heatScales:Record<HeatLayer,{stops:[number,string][];unit:string;label:string}>={
 wind:{label:'Wind',unit:'km/h',stops:[[0,'#e0f2fe'],[10,'#7dd3fc'],[20,'#34d399'],[30,'#facc15'],[40,'#f97316'],[55,'#dc2626']]},
 rain:{label:'Rain chance',unit:'%',stops:[[0,'#f8fafc'],[20,'#bfdbfe'],[50,'#60a5fa'],[80,'#2563eb'],[100,'#1e3a8a']]},
 temperature:{label:'Temperature',unit:'°C',stops:[[-5,'#6366f1'],[5,'#38bdf8'],[12,'#34d399'],[20,'#facc15'],[28,'#f97316'],[35,'#dc2626']]},
};
export function heatColor(layer:HeatLayer,value:number){
 const stops=heatScales[layer].stops;if(value<=stops[0][0])return stops[0][1];
 for(let i=1;i<stops.length;i++)if(value<=stops[i][0]){const [a,ca]=stops[i-1],[b,cb]=stops[i],t=(value-a)/(b-a);return mix(ca,cb,t)}
 return stops.at(-1)![1];
}
function mix(a:string,b:string,t:number){const p=(h:string)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),[x,y]=[p(a),p(b)];return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}

const compass=(degrees:number)=>['north','north-east','east','south-east','south','south-west','west','north-west'][Math.round((((degrees%360)+360)%360)/45)%8];
/**
 * Where to start the ride: into the wind while fresh, so the tailwind brings
 * you home. Reads the hours of the ride window at the town itself.
 */
export function windAdvice(hours:WeatherHour[],gustLimit:number){
 const windy=hours.filter(h=>h.wind!==null&&h.direction!==null);if(!windy.length)return null;
 // Mean direction on the circle, weighted by wind speed.
 const x=windy.reduce((a,h)=>a+Math.cos(h.direction!*Math.PI/180)*h.wind!,0),y=windy.reduce((a,h)=>a+Math.sin(h.direction!*Math.PI/180)*h.wind!,0);
 const from=(Math.atan2(y,x)*180/Math.PI+360)%360,first=windy[0].wind!,last=windy.at(-1)!.wind!,peakGust=Math.max(...windy.map(h=>h.gust??0)),mean=windy.reduce((a,h)=>a+h.wind!,0)/windy.length;
 const tips:string[]=[];
 if(mean<8)tips.push('Light wind: any direction works; pick your favourite loop.');
 else tips.push(`Start ${compass(from)}, into the ${windBearing(from)!.from} wind, while your legs are fresh; turn for home at half time with it behind you.`);
 if(mean>=8&&last-first>=5)tips.push(`Wind builds from ${Math.round(first)} to ${Math.round(last)} km/h, so do the upwind leg early.`);
 if(mean>=8&&first-last>=5)tips.push(`Wind eases from ${Math.round(first)} to ${Math.round(last)} km/h; a later headwind leg would be gentler.`);
 if(peakGust>gustLimit)tips.push(`Gusts up to ${Math.round(peakGust)} km/h: choose sheltered roads and take care on bridges and open plains.`);
 return {from,heading:from,mean,tips};
}

/** Overpass query for riding stops inside the map frame. */
export function poiQuery(frame:ReturnType<typeof mapFrame>){
 const box=`${frame.south.toFixed(4)},${frame.west.toFixed(4)},${frame.north.toFixed(4)},${frame.east.toFixed(4)}`;
 return `[out:json][timeout:20];(node["amenity"="drinking_water"](${box});node["amenity"="cafe"](${box});node["shop"="bicycle"](${box});node["amenity"="bicycle_repair_station"](${box});node["amenity"="toilets"](${box}););out 150;`;
}
export function parsePois(payload:unknown,frame:ReturnType<typeof mapFrame>):Poi[]{
 const elements=(payload as {elements?:unknown[]})?.elements;if(!Array.isArray(elements))return [];
 return elements.flatMap(raw=>{
  const e=raw as {id?:unknown;lat?:unknown;lon?:unknown;tags?:Record<string,string>},latitude=num(e.lat),longitude=num(e.lon),t=e.tags??{};
  if(latitude===null||longitude===null)return [];
  const kind:Poi['kind']|null=t.amenity==='drinking_water'?'water':t.amenity==='cafe'?'cafe':t.shop==='bicycle'?'bike':t.amenity==='bicycle_repair_station'?'repair':t.amenity==='toilets'?'toilets':null;
  if(!kind)return [];
  const p=project(latitude,longitude,frame.zoom);
  return [{id:String(e.id),kind,name:t.name??({water:'Drinking water',cafe:'Café',bike:'Bike shop',repair:'Repair station',toilets:'Toilets'} as const)[kind],latitude,longitude,x:p.x-frame.left,y:p.y-frame.top}];
 });
}
