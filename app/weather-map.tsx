"use client";
import {useEffect,useRef,useState} from 'react';
import {Navigation,Plus,Minus,Maximize2,Minimize2,LocateFixed} from 'lucide-react';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '@/components/ui/card';
import {windBearing,weatherTime,type WeatherHour} from './weather-recon-data';
import {mapView,mapFrame,panBy,project,gridPoints,parseGrid,type GridHour} from './weather-map-data';

type Place={name:string;latitude:number;longitude:number};
type Frame=ReturnType<typeof mapFrame>;
const COLUMNS=5,ROWS=4,FRESH=15*60*1000,MIN_ZOOM=8,MAX_ZOOM=14;
const gridCache=new Map<string,{at:number;grid:GridHour[][];frame:Frame;points:ReturnType<typeof gridPoints>}>();
const isFresh=(key:string)=>{const cached=gridCache.get(key);return !!cached&&Date.now()-cached.at<FRESH};
// Cache keys round the view so small drags reuse the same forecast grid.
const viewKey=(f:Frame)=>`${f.zoom}:${(f.left/64|0)}:${(f.top/64|0)}:${f.width|0}x${f.height|0}`;

// Wind arrows over a map around the town, for one hour of the selected day.
// Drag to move, +/− to zoom, expand to fill the screen.
export default function WeatherMap({place,dayHours,best,timezone,active}:{place:Place;dayHours:WeatherHour[];best:{start:number;end:number}|null;timezone:string;active:boolean}){
 const placeKey=`${place.latitude},${place.longitude}`;
 const [view,setView]=useState({placeKey,latitude:place.latitude,longitude:place.longitude,zoom:mapView.zoom});
 const current=view.placeKey===placeKey?view:{placeKey,latitude:place.latitude,longitude:place.longitude,zoom:mapView.zoom};
 const [expanded,setExpanded]=useState(false),[width,setWidth]=useState(mapView.width),[height,setHeight]=useState(mapView.height),box=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number}|null>(null);
 // The map uses real screen pixels: crisp tiles, and the arrows keep their size.
 useEffect(()=>{const node=box.current;if(!node||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(([entry])=>{const w=Math.round(entry.contentRect.width);if(w>0){setWidth(w);setHeight(expanded?Math.max(240,Math.round(entry.contentRect.height)):Math.round(w*mapView.height/mapView.width))}});observer.observe(node);return()=>observer.disconnect()},[expanded]);
 const frame=mapFrame(current.latitude,current.longitude,current.zoom,width,height);
 // Forecasts load for the view once it has stopped moving.
 const [settled,setSettled]=useState<Frame|null>(null);const settleKey=viewKey(frame);
 useEffect(()=>{const timer=setTimeout(()=>setSettled(mapFrame(current.latitude,current.longitude,current.zoom,width,height)),450);return()=>clearTimeout(timer)},[settleKey,current.latitude,current.longitude,current.zoom,width,height]);
 const [loaded,setLoaded]=useState<{grid:Record<string,true>;error?:string}>({grid:{}});
 const gridKey=settled?viewKey(settled):'',gridEntry=gridCache.get(gridKey)??[...gridCache.values()].reverse().find(e=>e.frame.zoom===current.zoom&&Math.abs(e.frame.left-frame.left)<frame.width&&Math.abs(e.frame.top-frame.top)<frame.height)??null;
 useEffect(()=>{
  if(!active||!settled||isFresh(gridKey))return;
  const controller=new AbortController(),points=gridPoints(settled,COLUMNS,ROWS);
  const params=new URLSearchParams({latitude:points.map(p=>p.latitude).join(','),longitude:points.map(p=>p.longitude).join(','),hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m',forecast_days:'10',timeformat:'unixtime',timezone:'auto',wind_speed_unit:'kmh'});
  fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(json=>{gridCache.set(gridKey,{at:Date.now(),grid:parseGrid(json,points.length),frame:settled,points});setLoaded(l=>({grid:{...l.grid,[gridKey]:true}}))}).catch(()=>{if(!controller.signal.aborted)setLoaded(l=>({...l,error:'The wind map could not load. The forecast above is unaffected.'}))});
  return()=>controller.abort();
 },[active,settled,gridKey]);
 // The hour defaults to the start of the best ride, else the first daylight hour.
 const [time,setTime]=useState<number|null>(null);
 const light=dayHours.filter(h=>h.daylight===1),hours=light.length?light:dayHours;
 const selected=hours.find(h=>h.time===time)??hours.find(h=>h.time===best?.start)??hours[0];
 const shown=selected?.time,grid=gridEntry?.grid??null;
 const at=(latitude:number,longitude:number)=>{const p=project(latitude,longitude,frame.zoom);return {x:p.x-frame.left,y:p.y-frame.top}};
 const tiles=[];const z=frame.zoom;for(let x=Math.floor(frame.left/256);x<=Math.floor((frame.left+frame.width)/256);x++)for(let y=Math.floor(frame.top/256);y<=Math.floor((frame.top+frame.height)/256);y++)if(y>=0&&y<2**z)tiles.push({x,y});
 const town=at(place.latitude,place.longitude),bearing=selected?windBearing(selected.direction):null;
 const zoomBy=(d:number)=>setView({...current,zoom:Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current.zoom+d))});
 useEffect(()=>{if(!expanded)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[expanded]);
 return <Card size="sm" className={`weather-map-card${expanded?' is-expanded':''}`} role="region" aria-label="Wind map">
  <CardHeader><CardTitle><span className="weather-card-title"><Navigation aria-hidden="true"/>Wind map</span></CardTitle><CardDescription>{place.name}{selected?` · ${weatherTime(selected.time,timezone)}`:''}{selected&&selected.wind!==null?` · ${Math.round(selected.wind)} km/h${bearing?` from ${bearing.from}`:''}`:''}</CardDescription></CardHeader>
  <CardContent>
   <div ref={box} className="weather-map">
    <svg viewBox={`0 0 ${frame.width} ${frame.height}`} width={frame.width} height={frame.height} role="img" aria-label={`Map around ${place.name} with wind arrows pointing where the wind blows. Drag to move.`} onPointerDown={e=>{e.preventDefault();drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;drag.current={x:e.clientX,y:e.clientY};const c=panBy(current.latitude,current.longitude,current.zoom,dx,dy);setView({...current,latitude:c.latitude,longitude:c.longitude})}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
     <defs><filter id="weather-tiles-mono"><feColorMatrix type="saturate" values=".15"/></filter></defs>
     <g filter="url(#weather-tiles-mono)">{tiles.map(t=><image key={`${z}/${t.x}/${t.y}`} href={`https://tile.openstreetmap.org/${z}/${((t.x%2**z)+2**z)%2**z}/${t.y}.png`} x={t.x*256-frame.left} y={t.y*256-frame.top} width="256" height="256"/>)}</g>
     {grid&&gridEntry&&shown!==undefined&&gridEntry.points.map((p,i)=>{const w=grid[i]?.find(h=>h.time===shown);if(!w||w.wind===null||w.direction===null)return null;const {x,y}=at(p.latitude,p.longitude),len=12+Math.min(22,w.wind*.7);return <g key={i} transform={`translate(${x} ${y}) rotate(${(w.direction+180)%360})`} className="weather-map-arrow"><line x1="0" y1={len/2} x2="0" y2={-len/2} stroke="#fff" strokeWidth="5" strokeLinecap="round"/><line x1="0" y1={len/2} x2="0" y2={-len/2} stroke="#0b1220" strokeWidth="2" strokeLinecap="round"/><path d={`M-5 ${-len/2+6} L0 ${-len/2} L5 ${-len/2+6}`} fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><g transform={`rotate(${-(w.direction+180)%360})`}><text y={len/2+12} textAnchor="middle">{Math.round(w.wind)}</text></g></g>})}
     <circle cx={town.x} cy={town.y} r="6" fill="#4f46e5" stroke="#fff" strokeWidth="3"/>
    </svg>
    <div className="weather-map-tools">
     <button type="button" aria-label="Zoom in" disabled={current.zoom>=MAX_ZOOM} onClick={()=>zoomBy(1)}><Plus/></button>
     <button type="button" aria-label="Zoom out" disabled={current.zoom<=MIN_ZOOM} onClick={()=>zoomBy(-1)}><Minus/></button>
     <button type="button" aria-label="Back to town" onClick={()=>setView({placeKey,latitude:place.latitude,longitude:place.longitude,zoom:current.zoom})}><LocateFixed/></button>
     <button type="button" aria-label={expanded?'Exit full screen':'Full screen'} aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?<Minimize2/>:<Maximize2/>}</button>
    </div>
    <a className="weather-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
   </div>
   {hours.length>1&&<label className="weather-map-hour"><span>{selected?weatherTime(selected.time,timezone):''}</span><input type="range" min={0} max={hours.length-1} step={1} value={Math.max(0,hours.indexOf(selected))} onChange={e=>setTime(hours[Number(e.target.value)].time)} aria-label="Hour shown on the map"/></label>}
   <p className="weather-map-note">Arrows point where the wind blows; the number is its speed in km/h.</p>
   {loaded.error&&<p className="weather-map-note">{loaded.error}</p>}
  </CardContent>
 </Card>;
}
