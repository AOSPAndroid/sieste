"use client";
import {useEffect,useState,useRef} from 'react';
import {cachedWorkout,loadWorkout} from './workout-detail-cache';
import {routeGeometry} from './route-geometry';
export default function RouteThumbnail({id,token,isDemo}:{id:string;token:string;isDemo:boolean}){
 const cached=cachedWorkout(token,id),initial=cached?.seriesSampled?.data;
 const host=useRef<HTMLSpanElement>(null),[geometry,setGeometry]=useState<ReturnType<typeof routeGeometry>>(()=>initial?routeGeometry(initial.positionLat??[],initial.positionLong??[]):null),[status,setStatus]=useState(cached?'No GPS recorded':'Loading route…');
 useEffect(()=>{if(isDemo){setStatus('No demo GPS track');return}if(!token){setStatus('Connect to load route');return}let live=true;const hit=cachedWorkout(token,id);if(hit){const d=hit.seriesSampled?.data??{};setGeometry(routeGeometry(d.positionLat??[],d.positionLong??[]));setStatus('No GPS recorded')}
 const load=()=>{void loadWorkout(token,id).then(d=>{if(!live)return;const s=d.seriesSampled?.data??{};setGeometry(routeGeometry(s.positionLat??[],s.positionLong??[]));setStatus('No GPS recorded')}).catch(()=>{if(live&&!hit)setStatus('Route unavailable · open session')})};
 const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load()}},{rootMargin:'200px'});if(host.current)observer.observe(host.current);return()=>{live=false;observer.disconnect()};},[id,token,isDemo]);

 if(!geometry)return <span ref={host} role={status==='Loading route…'?'status':undefined} className={`route-thumbnail route-thumbnail-empty${status==='Loading route…'?' is-loading':''}`}>{status}</span>;
 const points=geometry.points,minX=points.reduce((n,p)=>Math.min(n,p.x),Infinity),maxX=points.reduce((n,p)=>Math.max(n,p.x),-Infinity),minY=points.reduce((n,p)=>Math.min(n,p.y),Infinity),maxY=points.reduce((n,p)=>Math.max(n,p.y),-Infinity),scale=Math.min(200/Math.max(maxX-minX,1e-9),106/Math.max(maxY-minY,1e-9)),xy=(p:{x:number;y:number})=>({x:120+(p.x-geometry.center.x)*scale,y:65+(p.y-geometry.center.y)*scale}),first=xy(points[0]),last=xy(points.at(-1)!);
 return <span ref={host} className="route-thumbnail"><svg viewBox="0 0 240 140" role="img" aria-label="Recorded activity route thumbnail; open session for the full map"><rect width="240" height="140" rx="8" fill="#f5f5f5"/>{geometry.segments.filter(s=>s.length>1).map((segment,i)=><polyline key={i} points={segment.filter((_,i)=>i%Math.max(1,Math.ceil(segment.length/600))===0||i===segment.length-1).map(p=>{const q=xy(p);return `${q.x},${q.y}`}).join(' ')} stroke="#e13742" fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>)}<circle cx={first.x} cy={first.y} r="4" fill="white" stroke="#222" strokeWidth="2"/><rect x={last.x-3} y={last.y-3} width="6" height="6" fill="#e13742"/></svg><small>Recorded route ↗</small></span>
}
