"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {Navigation,Plus,Minus,Maximize2,Minimize2,LocateFixed} from 'lucide-react';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '@/components/ui/card';
import {windBearing,weatherTime,type WeatherHour} from './weather-recon-data';
import {routePoints,suggestLoops,type HistoryWorkout} from './route-history';
import {sportFamily} from './sports';
import {mapView,mapFrame,panBy,project,gridPoints,parseGrid,gridValues,interpolate,heatScales,heatColor,windAdvice,poiQuery,parsePois,type GridHour,type HeatLayer,type Poi} from './weather-map-data';

type Place={name:string;latitude:number;longitude:number};
type Frame=ReturnType<typeof mapFrame>;
const COLUMNS=5,ROWS=4,FRESH=15*60*1000,MIN_ZOOM=8,MAX_ZOOM=14;
const gridCache=new Map<string,{at:number;grid:GridHour[][];frame:Frame;points:ReturnType<typeof gridPoints>}>(),poiCache=new Map<string,Poi[]>();
const poiStyle:Record<Poi['kind'],{color:string;label:string;glyph:string}>={
 water:{color:'#0ea5e9',label:'Water',glyph:'W'},cafe:{color:'#a16207',label:'Café',glyph:'C'},bike:{color:'#16a34a',label:'Bike shop',glyph:'B'},repair:{color:'#7c3aed',label:'Repair stand',glyph:'R'},toilets:{color:'#64748b',label:'Toilets',glyph:'T'},
};
// Cache keys round the view so small drags reuse the same forecast grid.
const viewKey=(f:Frame)=>`${f.zoom}:${(f.left/64|0)}:${(f.top/64|0)}:${f.width|0}x${f.height|0}`;

const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
// Route lines as world pixels at one zoom; panning only shifts them.
function worldPath(points:[number,number][],zoom:number){return points.map(([a,b],i)=>{const p=project(a,b,zoom);return `${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join('')}
const loopNames=['1','2','3'];

// Wind arrows, a colour layer, riding stops and the direction to start in,
// for the selected day's hours. Drag to move, +/− to zoom, expand to fill the screen.
export default function WeatherMap({place,dayHours,best,gustLimit,timezone,active,activities=[]}:{place:Place;dayHours:WeatherHour[];best:{start:number;end:number}|null;gustLimit:number;timezone:string;active:boolean;activities?:HistoryWorkout[]}){
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
 const [loaded,setLoaded]=useState<{grid:Record<string,true>;pois:Record<string,true>;error?:string;poiError?:string}>({grid:{},pois:{}});
 const gridKey=settled?viewKey(settled):'',gridEntry=gridCache.get(gridKey)??[...gridCache.values()].reverse().find(e=>e.frame.zoom===current.zoom&&Math.abs(e.frame.left-frame.left)<frame.width&&Math.abs(e.frame.top-frame.top)<frame.height)??null;
 useEffect(()=>{
  if(!active||!settled)return;const cached=gridCache.get(gridKey);if(cached&&Date.now()-cached.at<FRESH)return;
  const controller=new AbortController(),points=gridPoints(settled,COLUMNS,ROWS);
  const params=new URLSearchParams({latitude:points.map(p=>p.latitude).join(','),longitude:points.map(p=>p.longitude).join(','),hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,temperature_2m',forecast_days:'10',timeformat:'unixtime',timezone:'auto',wind_speed_unit:'kmh'});
  fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(json=>{gridCache.set(gridKey,{at:Date.now(),grid:parseGrid(json,points.length),frame:settled,points});setLoaded(l=>({...l,grid:{...l.grid,[gridKey]:true},error:undefined}))}).catch(()=>{if(!controller.signal.aborted)setLoaded(l=>({...l,error:'The wind map could not load. The forecast above is unaffected.'}))});
  return()=>controller.abort();
 },[active,settled,gridKey]);
 const [showStops,setShowStops]=useState(true),[picked,setPicked]=useState<Poi|null>(null);
 // Stops only at street-level zooms, where they are readable and the query stays small.
 const stopsKey=settled&&settled.zoom>=11?viewKey(settled):'';
 useEffect(()=>{
  if(!active||!showStops||!stopsKey||poiCache.has(stopsKey)||!settled)return;
  const controller=new AbortController();
  fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:poiQuery(settled)}),signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(json=>{poiCache.set(stopsKey,parsePois(json,settled));setLoaded(l=>({...l,pois:{...l.pois,[stopsKey]:true},poiError:undefined}))}).catch(()=>{if(!controller.signal.aborted)setLoaded(l=>({...l,poiError:'Stops from OpenStreetMap are unavailable right now.'}))});
  return()=>controller.abort();
 },[active,showStops,stopsKey,settled]);
 const pois=useMemo(()=>{const seen=new Map<string,Poi>();for(const [k,list] of poiCache)if(k.startsWith(`${current.zoom}:`)||k===stopsKey)for(const p of list)seen.set(p.id,p);return [...seen.values()]},[current.zoom,stopsKey,loaded.pois]);// eslint-disable-line react-hooks/exhaustive-deps
 const [layer,setLayer]=useState<HeatLayer>('wind'),[time,setTime]=useState<number|null>(null);
 // The hour defaults to the start of the best ride, else the first daylight hour.
 const hours=useMemo(()=>{const light=dayHours.filter(h=>h.daylight===1);return light.length?light:dayHours},[dayHours]);
 const selected=hours.find(h=>h.time===time)??hours.find(h=>h.time===best?.start)??hours[0];
 const bestStart=best?.start,bestEnd=best?.end,advice=useMemo(()=>windAdvice(bestStart!==undefined&&bestEnd!==undefined?dayHours.filter(h=>h.time>=bestStart&&h.time<bestEnd):hours,gustLimit),[bestStart,bestEnd,dayHours,hours,gustLimit]);
 // Your own routes: where you usually go (a light heat of every stored route), and up
 // to three rides from near here ranked for this forecast.
 const [routesShown,setRoutesShown]=useState<'off'|'rides'|'runs'|'all'>('rides'),[pickedLoop,setPickedLoop]=useState<string|null>(null);
 const stored=useMemo(()=>activities.filter(w=>w.evidence?.route),[activities]);
 const heatPaths=useMemo(()=>routesShown==='off'?[]:stored.filter(w=>routesShown==='all'||sportFamily(w)===(routesShown==='rides'?'cycling':'running')).slice(0,600).map(w=>worldPath(routePoints(w.evidence!.route!),current.zoom)),[stored,routesShown,current.zoom]);
 const target=useMemo(()=>{if(bestStart===undefined||bestEnd===undefined)return null;const recent=stored.filter(w=>sportFamily(w)==='cycling'&&finite(w.summary?.distance)&&finite(w.summary?.duration)&&(w.summary!.duration as number)>0).slice(-60).map(w=>(w.summary!.distance as number)/(w.summary!.duration as number)).sort((a,b)=>a-b);return recent.length?recent[Math.floor(recent.length/2)]*(bestEnd-bestStart):null},[stored,bestStart,bestEnd]);
 const loops=useMemo(()=>suggestLoops(stored,[place.latitude,place.longitude],advice?{from:advice.from,mean:advice.mean}:null,target),[stored,place.latitude,place.longitude,advice,target]);
 const loopPaths=useMemo(()=>loops.map(l=>({id:l.workout.id,d:worldPath(l.line,current.zoom),far:(()=>{let far=l.line[0],d=0;for(const p of l.line){const m=Math.hypot(p[0]-l.line[0][0],(p[1]-l.line[0][1])*Math.cos(p[0]*Math.PI/180));if(m>d){d=m;far=p}}return project(far[0],far[1],current.zoom)})()})),[loops,current.zoom]);
 const shown=selected?.time,grid=gridEntry?.grid??null;
 const cells=useMemo(()=>{const values=grid&&shown!==undefined&&gridEntry?gridValues(grid,shown,layer):null;if(!values||!gridEntry)return [];const size=20,g=gridEntry.frame,out:{x:number;y:number;color:string}[]=[];for(let y=0;y<g.height;y+=size)for(let x=0;x<g.width;x+=size){const v=interpolate(values,COLUMNS,ROWS,x+size/2,y+size/2,g.width,g.height);if(v!==null)out.push({x,y,color:heatColor(layer,v)})}return out},[grid,gridEntry,shown,layer]);
 const at=(latitude:number,longitude:number)=>{const p=project(latitude,longitude,frame.zoom);return {x:p.x-frame.left,y:p.y-frame.top}};
 const tiles=[];const z=frame.zoom;for(let x=Math.floor(frame.left/256);x<=Math.floor((frame.left+frame.width)/256);x++)for(let y=Math.floor(frame.top/256);y<=Math.floor((frame.top+frame.height)/256);y++)if(y>=0&&y<2**z)tiles.push({x,y});
 const town=at(place.latitude,place.longitude),scale=heatScales[layer],bearing=selected?windBearing(selected.direction):null,reach=Math.min(frame.width,frame.height)*.36;
 const wedge=(heading:number,radius:number,spread:number)=>{const a=(heading-spread)*Math.PI/180,b=(heading+spread)*Math.PI/180;return `M${town.x},${town.y} L${town.x+radius*Math.sin(a)},${town.y-radius*Math.cos(a)} A${radius},${radius} 0 0 1 ${town.x+radius*Math.sin(b)},${town.y-radius*Math.cos(b)} Z`};
 const zoomBy=(d:number)=>setView({...current,zoom:Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current.zoom+d))});
 const offset=gridEntry&&gridEntry.frame.zoom===frame.zoom?{x:gridEntry.frame.left-frame.left,y:gridEntry.frame.top-frame.top}:null;
 useEffect(()=>{if(!expanded)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpanded(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[expanded]);
 return <Card size="sm" className={`weather-map-card${expanded?' is-expanded':''}`} role="region" aria-label="Wind and route map">
  <CardHeader><CardTitle><span className="weather-card-title"><Navigation aria-hidden="true"/>Wind & route</span></CardTitle><CardDescription>{place.name}{selected?` · ${weatherTime(selected.time,timezone)}`:''}{selected&&selected.wind!==null?` · ${Math.round(selected.wind)} km/h${bearing?` from ${bearing.from}`:''}`:''}</CardDescription></CardHeader>
  <CardContent>
   <div ref={box} className="weather-map">
    <svg viewBox={`0 0 ${frame.width} ${frame.height}`} width={frame.width} height={frame.height} role="img" aria-label={`Map around ${place.name} with ${scale.label.toLowerCase()} and wind arrows. Drag to move.`} onPointerDown={e=>{if((e.target as Element).closest('.weather-map-poi'))return;e.preventDefault();drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;drag.current={x:e.clientX,y:e.clientY};const c=panBy(current.latitude,current.longitude,current.zoom,dx,dy);setView({...current,latitude:c.latitude,longitude:c.longitude})}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
     <defs><filter id="weather-heat-blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="9"/></filter><filter id="weather-tiles-mono"><feColorMatrix type="saturate" values=".15"/></filter></defs>
     <g filter="url(#weather-tiles-mono)">{tiles.map(t=><image key={`${z}/${t.x}/${t.y}`} href={`https://tile.openstreetmap.org/${z}/${((t.x%2**z)+2**z)%2**z}/${t.y}.png`} x={t.x*256-frame.left} y={t.y*256-frame.top} width="256" height="256"/>)}</g>
     {offset&&<g transform={`translate(${offset.x} ${offset.y})`} filter="url(#weather-heat-blur)" opacity=".38">{cells.map(c=><rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width="21" height="21" fill={c.color}/>)}</g>}
     {heatPaths.length>0&&<g transform={`translate(${-frame.left} ${-frame.top})`} className="weather-map-heat-routes" aria-label="Where you usually go">{heatPaths.map((d,i)=><path key={i} d={d}/>)}</g>}
     {loopPaths.length>0&&<g transform={`translate(${-frame.left} ${-frame.top})`} className="weather-map-loops">{loopPaths.map((l,i)=><g key={l.id} className={pickedLoop===l.id?'is-picked':pickedLoop?'is-dim':''} onClick={()=>setPickedLoop(v=>v===l.id?null:l.id)}><path d={l.d} className="weather-map-loop-casing"/><path d={l.d} className="weather-map-loop"/><g transform={`translate(${l.far.x} ${l.far.y})`}><circle r="9"/><text textAnchor="middle" dominantBaseline="central">{loopNames[i]}</text></g></g>)}</g>}
     {advice&&advice.mean>=8&&<g className="weather-map-heading" aria-label="Start into the wind"><path d={wedge(advice.heading,reach,28)} fill="#4f46e5" fillOpacity=".12" stroke="#4f46e5" strokeOpacity=".5" strokeDasharray="4 4"/><text x={town.x+reach*.8*Math.sin(advice.heading*Math.PI/180)} y={town.y-reach*.8*Math.cos(advice.heading*Math.PI/180)} textAnchor="middle" dominantBaseline="middle">Out</text><text x={town.x-reach*.45*Math.sin(advice.heading*Math.PI/180)} y={town.y+reach*.45*Math.cos(advice.heading*Math.PI/180)} textAnchor="middle" dominantBaseline="middle">Home</text></g>}
     {grid&&gridEntry&&shown!==undefined&&gridEntry.points.map((p,i)=>{const w=grid[i]?.find(h=>h.time===shown);if(!w||w.wind===null||w.direction===null)return null;const {x,y}=at(p.latitude,p.longitude),len=12+Math.min(22,w.wind*.7);return <g key={i} transform={`translate(${x} ${y}) rotate(${(w.direction+180)%360})`} className="weather-map-arrow"><line x1="0" y1={len/2} x2="0" y2={-len/2} stroke="#fff" strokeWidth="5" strokeLinecap="round"/><line x1="0" y1={len/2} x2="0" y2={-len/2} stroke="#0b1220" strokeWidth="2" strokeLinecap="round"/><path d={`M-5 ${-len/2+6} L0 ${-len/2} L5 ${-len/2+6}`} fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><g transform={`rotate(${-(w.direction+180)%360})`}><text y={len/2+12} textAnchor="middle">{Math.round(w.wind)}</text></g></g>})}
     {showStops&&pois.map(p=>{const {x,y}=at(p.latitude,p.longitude);return x>=-10&&x<=frame.width+10&&y>=-10&&y<=frame.height+10&&<g key={p.id} className="weather-map-poi" transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={`${poiStyle[p.kind].label}: ${p.name}`} onClick={()=>setPicked(p)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setPicked(p)}}><circle r="8" fill={poiStyle[p.kind].color} stroke="#fff" strokeWidth="2"/><text textAnchor="middle" dominantBaseline="central">{poiStyle[p.kind].glyph}</text></g>})}
     <circle cx={town.x} cy={town.y} r="6" fill="#4f46e5" stroke="#fff" strokeWidth="3"/>
    </svg>
    <div className="weather-map-tools">
     <button type="button" aria-label="Zoom in" disabled={current.zoom>=MAX_ZOOM} onClick={()=>zoomBy(1)}><Plus/></button>
     <button type="button" aria-label="Zoom out" disabled={current.zoom<=MIN_ZOOM} onClick={()=>zoomBy(-1)}><Minus/></button>
     <button type="button" aria-label="Back to town" onClick={()=>setView({placeKey,latitude:place.latitude,longitude:place.longitude,zoom:current.zoom})}><LocateFixed/></button>
     <button type="button" aria-label={expanded?'Exit full screen':'Full screen'} aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?<Minimize2/>:<Maximize2/>}</button>
    </div>
    <a className="weather-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
    {picked&&<p className="weather-map-picked" role="status"><i style={{background:poiStyle[picked.kind].color}}/>{picked.name}<span>{poiStyle[picked.kind].label}</span><button type="button" aria-label="Close" onClick={()=>setPicked(null)}>×</button></p>}
   </div>
   <div className="weather-map-controls">
    <div className="weather-map-layers" role="group" aria-label="Colour layer">{(Object.keys(heatScales) as HeatLayer[]).map(l=><button key={l} type="button" aria-pressed={layer===l} onClick={()=>setLayer(l)}>{heatScales[l].label}</button>)}</div>
    <label className="weather-map-stops"><input type="checkbox" checked={showStops} onChange={e=>setShowStops(e.target.checked)}/>Stops</label>
   </div>
   {hours.length>1&&<label className="weather-map-hour"><span>{selected?weatherTime(selected.time,timezone):''}</span><input type="range" min={0} max={hours.length-1} step={1} value={Math.max(0,hours.indexOf(selected))} onChange={e=>setTime(hours[Number(e.target.value)].time)} aria-label="Hour shown on the map"/></label>}
   <div className="weather-map-scale" aria-label={`${scale.label} scale`}><span>{scale.stops[0][0]}</span><i style={{background:`linear-gradient(90deg,${scale.stops.map(s=>s[1]).join(',')})`}}/><span>{scale.stops.at(-1)![0]} {scale.unit}</span></div>
   {showStops&&<div className="weather-map-legend">{(Object.keys(poiStyle) as Poi['kind'][]).map(k=><span key={k}><i style={{background:poiStyle[k].color}}>{poiStyle[k].glyph}</i>{poiStyle[k].label}</span>)}{current.zoom<11&&<span className="weather-map-hint">Zoom in to see stops</span>}</div>}
   <div className="weather-map-routes"><span>Your routes</span><div className="weather-map-layers" role="group" aria-label="Your routes on the map">{(['off','rides','runs','all'] as const).map(v=><button key={v} type="button" aria-pressed={routesShown===v} onClick={()=>setRoutesShown(v)}>{v==='off'?'Hide':v[0].toUpperCase()+v.slice(1)}</button>)}</div></div>
   {loops.length>0?<div className="weather-map-loop-list"><strong>Loops from your rides</strong><ol>{loops.map((l,i)=>{const into=advice&&advice.mean>=8?l.into>.5?'Out into the wind, home with it':l.into<-.5?'Tailwind out, headwind home':'Crosswind most of the way':'Light wind';return <li key={l.workout.id}><button type="button" aria-pressed={pickedLoop===l.workout.id} onClick={()=>setPickedLoop(v=>v===l.workout.id?null:l.workout.id)}><b>{loopNames[i]}</b><span><strong>{l.workout.title||'Ride'} · {(l.route.distance/1000).toFixed(0)} km</strong><small>{into} · last ridden {new Date(l.workout.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></span></button></li>})}</ol></div>:stored.length===0&&<p className="weather-map-note">Your own routes and loops appear here once Sieste has analysed your rides; it does a few after each sync.</p>}
   {advice&&<div className="weather-map-advice"><strong>Route tips{best?` · ${weatherTime(best.start,timezone)}–${weatherTime(best.end,timezone)}`:''}</strong><ul>{advice.tips.map(t=><li key={t}>{t}</li>)}</ul></div>}
   {(loaded.error||loaded.poiError)&&<p className="weather-map-note">{loaded.error||loaded.poiError}</p>}
  </CardContent>
 </Card>;
}
