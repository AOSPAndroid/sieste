import {routeGeometry} from './route-geometry';
export type Cut={start:number;end:number};
export function editRoute(detail:any,start:number,end:number,cuts:Cut[]=[]){
 const source=detail.seriesSampled?.data??{},lat=source.positionLat??[],lon=source.positionLong??[],step=detail.seriesSampled?.sampleSize;
 if(!Number.isFinite(step)||step<=0||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;
 const keep=(i:number)=>i*step>=start&&i*step<=end&&!cuts.some(c=>i*step>=c.start&&i*step<=c.end);
 const data={...source,positionLat:lat.map((v:any,i:number)=>keep(i)?v:null),positionLong:lon.map((v:any,i:number)=>keep(i)?v:null)};
 const geometry=routeGeometry(data.positionLat,data.positionLong);
 return {detail:{...detail,seriesSampled:{...detail.seriesSampled,data}},geometry};
}
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function routeGpx(detail:any,geometry:NonNullable<ReturnType<typeof routeGeometry>>){
 const series=detail.seriesSampled?.data??{},step=detail.seriesSampled?.sampleSize;
 return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="sieste" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${xml(detail.title||'Edited route')}</name>${geometry.segments.filter(s=>s.length>1).map(segment=>'<trkseg>'+segment.map(p=>{const altitude=series.altitude?.[p.index];return `<trkpt lat="${p.lat}" lon="${p.lon}">${Number.isFinite(altitude)?`<ele>${altitude}</ele>`:''}</trkpt>`}).join('')+'</trkseg>').join('')}</trk></gpx>`;
}
