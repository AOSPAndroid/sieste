"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ChevronUp,MapPin} from 'lucide-react';
import RouteMap from './route-map';
import {ExpandButton} from './expansion';
import type {RouteSelection} from './route-geometry';

// The header map scrolls away once you read the analysis below it. A selection
// made after that pins a small copy under the tabs, so the climb or effort and
// its place on the route stay on screen together.
export function dockState(selection:RouteSelection|null,heroVisible:boolean,collapsed:boolean){
 if(!selection||heroVisible)return 'none';
 return collapsed?'collapsed':'open';
}

export default function WorkoutMapDock({detail,selection,anchor}:{detail:Record<string,unknown>;selection:RouteSelection|null;anchor:HTMLElement|null}){
 const [heroVisible,setHeroVisible]=useState(true),[foldedFor,setFoldedFor]=useState<string|null>(null),dock=useRef<HTMLDivElement>(null);
 // Folding remembers which section it was for, so a new one reopens the dock.
 const key=selection?`${selection.start}:${selection.end}:${selection.revision??''}`:null;
 useEffect(()=>{
  // The header map mounts once the route has loaded; without one there is nothing to pin.
  if(!anchor||typeof IntersectionObserver==='undefined')return;
  const io=new IntersectionObserver(([entry])=>setHeroVisible(entry.intersectionRatio>=.5),{threshold:[0,.5,1]});
  io.observe(anchor);return ()=>io.disconnect();
 },[anchor]);
 const state=dockState(selection,heroVisible,foldedFor===key);
 // Opening over the chart that was just tapped would hide it, so nudge the
 // chart down below the dock.
 useLayoutEffect(()=>{
  if(state!=='open')return;
  const card=dock.current?.querySelector('.workout-map-dock-card'),sheet=dock.current?.closest('.workout-sheet'),profile=sheet?.querySelector('.unified-profile');
  if(!card||!sheet||!profile)return;
  const covered=card.getBoundingClientRect().bottom+8-profile.getBoundingClientRect().top;
  if(covered>0&&profile.getBoundingClientRect().top>sheet.getBoundingClientRect().top)sheet.scrollBy({top:-covered,behavior:'smooth'});
 },[state]);
 if(state==='none')return null;
 return <div ref={dock} className={`workout-map-dock is-${state}`}>
  {state==='open'?<div className="workout-map-dock-card">
   <div className="workout-map-dock-map" aria-hidden="true" inert><RouteMap detail={detail} selection={selection} compact/></div>
   <p className="workout-map-dock-label"><MapPin size={13}/>{selection!.label||'Selected section'}</p>
   <div className="workout-map-dock-actions">
    <ExpandButton title="Recorded route"><RouteMap detail={detail} selection={selection}/></ExpandButton>
    <button type="button" aria-label="Hide map" onClick={()=>setFoldedFor(key)}><ChevronUp size={17}/></button>
   </div>
  </div>:<button type="button" className="workout-map-dock-pill" onClick={()=>setFoldedFor(null)}><MapPin size={14}/>Show on map</button>}
 </div>;
}
