"use client";
import {useEffect,useMemo,useState} from 'react';
import {Navigation} from 'lucide-react';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '@/components/ui/card';
import {windBearing,weatherTime,type WeatherHour} from './weather-recon-data';
import {mapView,mapFrame,gridPoints,parseGrid,gridValues,interpolate,heatScales,heatColor,windAdvice,poiQuery,parsePois,type GridHour,type HeatLayer,type Poi} from './weather-map-data';

type Place={name:string;latitude:number;longitude:number};
const COLUMNS=5,ROWS=4,FRESH=15*60*1000;
const gridCache=new Map<string,{at:number;grid:GridHour[][]}>(),poiCache=new Map<string,Poi[]>();
const poiStyle:Record<Poi['kind'],{color:string;label:string;glyph:string}>={
 water:{color:'#0ea5e9',label:'Water',glyph:'W'},cafe:{color:'#a16207',label:'Café',glyph:'C'},bike:{color:'#16a34a',label:'Bike shop',glyph:'B'},repair:{color:'#7c3aed',label:'Repair stand',glyph:'R'},toilets:{color:'#64748b',label:'Toilets',glyph:'T'},
};

// Wind arrows, a colour layer, riding stops and the direction to start in,
// for the selected day's hours around the chosen town.
export default function WeatherMap({place,dayHours,best,gustLimit,timezone,active}:{place:Place;dayHours:WeatherHour[];best:{start:number;end:number}|null;gustLimit:number;timezone:string;active:boolean}){
 const {latitude,longitude}=place,key=`${latitude},${longitude}`;
 const frame=mapFrame(latitude,longitude),points=gridPoints(frame,COLUMNS,ROWS);
 // Results are kept per town; a change of town shows nothing stale while the new one loads.
 const [loaded,setLoaded]=useState<{key:string;grid?:GridHour[][];pois?:Poi[];gridError?:string;poiError?:string}>({key});
 const [showStops,setShowStops]=useState(true),[picked,setPicked]=useState<Poi|null>(null);
 const mine=loaded.key===key?loaded:{key},cachedGrid=gridCache.get(key),grid=mine.grid??cachedGrid?.grid??null,pois=mine.pois??poiCache.get(key)??null;
 const gridError=mine.gridError??'',poiError=mine.poiError??'';
 const [layer,setLayer]=useState<HeatLayer>('wind'),[time,setTime]=useState<number|null>(null);
 useEffect(()=>{
  const cached=gridCache.get(key);if(!active||cached&&Date.now()-cached.at<FRESH)return;
  const controller=new AbortController(),points=gridPoints(mapFrame(latitude,longitude),COLUMNS,ROWS);
  const params=new URLSearchParams({latitude:points.map(p=>p.latitude).join(','),longitude:points.map(p=>p.longitude).join(','),hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,temperature_2m',forecast_days:'10',timeformat:'unixtime',timezone:'auto',wind_speed_unit:'kmh'});
  fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(json=>{const parsed=parseGrid(json,points.length);gridCache.set(key,{at:Date.now(),grid:parsed});setLoaded(l=>({...(l.key===key?l:{key}),grid:parsed}))}).catch(()=>{if(!controller.signal.aborted)setLoaded(l=>({...(l.key===key?l:{key}),gridError:'The wind map could not load. The forecast above is unaffected.'}))});
  return()=>controller.abort();
 },[active,key,latitude,longitude]);
 useEffect(()=>{
  if(!active||!showStops||poiCache.has(key))return;
  const controller=new AbortController(),frame=mapFrame(latitude,longitude);
  fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:poiQuery(frame)}),signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(json=>{const parsed=parsePois(json,frame);poiCache.set(key,parsed);setLoaded(l=>({...(l.key===key?l:{key}),pois:parsed}))}).catch(()=>{if(!controller.signal.aborted)setLoaded(l=>({...(l.key===key?l:{key}),poiError:'Stops from OpenStreetMap are unavailable right now.'}))});
  return()=>controller.abort();
 },[active,showStops,key,latitude,longitude]);
 // The hour defaults to the start of the best ride, else the first daylight hour.
 const hours=useMemo(()=>{const light=dayHours.filter(h=>h.daylight===1);return light.length?light:dayHours},[dayHours]);
 const selected=hours.find(h=>h.time===time)??hours.find(h=>h.time===best?.start)??hours[0];
 const bestStart=best?.start,bestEnd=best?.end,advice=useMemo(()=>windAdvice(bestStart!==undefined&&bestEnd!==undefined?dayHours.filter(h=>h.time>=bestStart&&h.time<bestEnd):hours,gustLimit),[bestStart,bestEnd,dayHours,hours,gustLimit]);
 const shown=selected?.time,winds=grid&&shown!==undefined?grid.map(g=>g.find(h=>h.time===shown)??null):null;
 const cells=useMemo(()=>{const values=grid&&shown!==undefined?gridValues(grid,shown,layer):null;if(!values)return [];const size=20,out:{x:number;y:number;color:string}[]=[];for(let y=0;y<mapView.height;y+=size)for(let x=0;x<mapView.width;x+=size){const v=interpolate(values,COLUMNS,ROWS,x+size/2,y+size/2);if(v!==null)out.push({x,y,color:heatColor(layer,v)})}return out},[grid,shown,layer]);
 const tiles=[];const z=frame.zoom;for(let x=Math.floor(frame.left/256);x<=Math.floor((frame.left+mapView.width)/256);x++)for(let y=Math.floor(frame.top/256);y<=Math.floor((frame.top+mapView.height)/256);y++)tiles.push({x,y});
 const cx=mapView.width/2,cy=mapView.height/2,scale=heatScales[layer],bearing=selected?windBearing(selected.direction):null;
 const wedge=(heading:number,radius:number,spread:number)=>{const a=(heading-spread)*Math.PI/180,b=(heading+spread)*Math.PI/180;return `M${cx},${cy} L${cx+radius*Math.sin(a)},${cy-radius*Math.cos(a)} A${radius},${radius} 0 0 1 ${cx+radius*Math.sin(b)},${cy-radius*Math.cos(b)} Z`};
 return <Card size="sm" className="weather-map-card" role="region" aria-label="Wind and route map">
  <CardHeader><CardTitle><span className="weather-card-title"><Navigation aria-hidden="true"/>Wind & route</span></CardTitle><CardDescription>{place.name}{selected?` · ${weatherTime(selected.time,timezone)}`:''}{selected&&selected.wind!==null?` · ${Math.round(selected.wind)} km/h${bearing?` from ${bearing.from}`:''}`:''}</CardDescription></CardHeader>
  <CardContent>
   <div className="weather-map">
    <svg viewBox={`0 0 ${mapView.width} ${mapView.height}`} role="img" aria-label={`Map around ${place.name} with ${scale.label.toLowerCase()} and wind arrows`}>
     <defs><filter id="weather-heat-blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="9"/></filter><filter id="weather-tiles-mono"><feColorMatrix type="saturate" values=".15"/></filter></defs>
     <g filter="url(#weather-tiles-mono)">{tiles.map(t=><image key={`${t.x}/${t.y}`} href={`https://tile.openstreetmap.org/${z}/${((t.x%2**z)+2**z)%2**z}/${t.y}.png`} x={t.x*256-frame.left} y={t.y*256-frame.top} width="256" height="256"/>)}</g>
     <g filter="url(#weather-heat-blur)" opacity=".38">{cells.map(c=><rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width="21" height="21" fill={c.color}/>)}</g>
     {advice&&advice.mean>=8&&<g className="weather-map-heading" aria-label={`Start towards the ${bearing?.from??''} wind`}><path d={wedge(advice.heading,150,28)} fill="#4f46e5" fillOpacity=".14" stroke="#4f46e5" strokeOpacity=".5" strokeDasharray="4 4"/><text x={cx+118*Math.sin(advice.heading*Math.PI/180)} y={cy-118*Math.cos(advice.heading*Math.PI/180)} textAnchor="middle" dominantBaseline="middle">Out</text><text x={cx-70*Math.sin(advice.heading*Math.PI/180)} y={cy+70*Math.cos(advice.heading*Math.PI/180)} textAnchor="middle" dominantBaseline="middle">Home</text></g>}
     {winds&&points.map((p,i)=>{const w=winds[i];if(!w||w.wind===null||w.direction===null)return null;const len=14+Math.min(26,w.wind*.8);return <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${(w.direction+180)%360})`} className="weather-map-arrow"><line x1="0" y1={len/2} x2="0" y2={-len/2} stroke="#fff" strokeWidth="6" strokeLinecap="round"/><line x1="0" y1={len/2} x2="0" y2={-len/2} stroke="#0b1220" strokeWidth="2.4" strokeLinecap="round"/><path d={`M-6 ${-len/2+7} L0 ${-len/2} L6 ${-len/2+7}`} fill="none" stroke="#0b1220" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><g transform={`rotate(${-(w.direction+180)%360})`}><text y={len/2+14} textAnchor="middle">{Math.round(w.wind)}</text></g></g>})}
     {showStops&&pois?.map(p=>p.x>=0&&p.x<=mapView.width&&p.y>=0&&p.y<=mapView.height&&<g key={p.id} className="weather-map-poi" transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-label={`${poiStyle[p.kind].label}: ${p.name}`} onClick={()=>setPicked(p)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setPicked(p)}}><circle r="8" fill={poiStyle[p.kind].color} stroke="#fff" strokeWidth="2"/><text textAnchor="middle" dominantBaseline="central">{poiStyle[p.kind].glyph}</text></g>)}
     <circle cx={cx} cy={cy} r="6" fill="#4f46e5" stroke="#fff" strokeWidth="3"/>
    </svg>
    <a className="weather-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
    {picked&&<p className="weather-map-picked" role="status"><i style={{background:poiStyle[picked.kind].color}}/>{picked.name}<span>{poiStyle[picked.kind].label}</span><button type="button" aria-label="Close" onClick={()=>setPicked(null)}>×</button></p>}
   </div>
   <div className="weather-map-controls">
    <div className="weather-map-layers" role="group" aria-label="Colour layer">{(Object.keys(heatScales) as HeatLayer[]).map(l=><button key={l} type="button" aria-pressed={layer===l} onClick={()=>setLayer(l)}>{heatScales[l].label}</button>)}</div>
    <label className="weather-map-stops"><input type="checkbox" checked={showStops} onChange={e=>setShowStops(e.target.checked)}/>Stops</label>
   </div>
   {hours.length>1&&<label className="weather-map-hour"><span>{selected?weatherTime(selected.time,timezone):''}</span><input type="range" min={0} max={hours.length-1} step={1} value={Math.max(0,hours.indexOf(selected))} onChange={e=>setTime(hours[Number(e.target.value)].time)} aria-label="Hour shown on the map"/></label>}
   <div className="weather-map-scale" aria-label={`${scale.label} scale`}><span>{scale.stops[0][0]}</span><i style={{background:`linear-gradient(90deg,${scale.stops.map(s=>s[1]).join(',')})`}}/><span>{scale.stops.at(-1)![0]} {scale.unit}</span></div>
   {showStops&&<div className="weather-map-legend">{(Object.keys(poiStyle) as Poi['kind'][]).map(k=><span key={k}><i style={{background:poiStyle[k].color}}>{poiStyle[k].glyph}</i>{poiStyle[k].label}</span>)}</div>}
   {advice&&<div className="weather-map-advice"><strong>Route tips{best?` · ${weatherTime(best.start,timezone)}–${weatherTime(best.end,timezone)}`:''}</strong><ul>{advice.tips.map(t=><li key={t}>{t}</li>)}</ul></div>}
   {(gridError||poiError)&&<p className="weather-map-note">{gridError||poiError}</p>}
  </CardContent>
 </Card>;
}
