"use client";
import {lazy,Suspense,useMemo,useState} from 'react';
import {Play,Gauge,Mountain,Bike,GitCompareArrows,Layers,Moon,Maximize2} from 'lucide-react';
import type {AthleteData,Workout} from './analytics';
import type {RouteSelection} from './route-geometry';
import {sportFamily} from './sports';
import {LoadingState,FeatureBoundary} from './loading-state';
import RouteMap from './route-map';
import {ExpandButton} from './expansion';
import './workout-explorer.css';
const Replay=lazy(()=>import('./workout-replay'));
const Compare=lazy(()=>import('./workout-route-compare'));
const Mosaic=lazy(()=>import('./workout-lap-mosaic'));
const Afterwards=lazy(()=>import('./workout-context').then(m=>({default:m.RecoveryAfterWorkout})));
type Mode='replay'|'fingerprint'|'terrain'|'coasting'|'compare'|'laps'|'afterwards';
type Props={detail:Workout&Record<string,any>;history:Workout[];healthData?:AthleteData;token:string;storageScope?:string;isDemo?:boolean;initialMode?:Mode};
export default function WorkoutExplorer({detail,history,healthData,token,storageScope='',isDemo=false,initialMode='replay'}:Props){
 const family=sportFamily(detail),endurance=['running','cycling'].includes(family),hasRoute=['running','cycling','walking','hiking'].includes(family);
 const modes=useMemo(()=>[
  {id:'replay' as Mode,label:'Replay',Icon:Play,show:hasRoute&&!!detail.seriesSampled?.data},
  {id:'fingerprint' as Mode,label:'Fingerprint',Icon:Gauge,show:endurance},
  {id:'terrain' as Mode,label:'Terrain',Icon:Mountain,show:hasRoute},
  {id:'coasting' as Mode,label:'Coasting',Icon:Bike,show:family==='cycling'},
  {id:'compare' as Mode,label:'Compare',Icon:GitCompareArrows,show:endurance},
  {id:'laps' as Mode,label:'Laps',Icon:Layers,show:true},
  {id:'afterwards' as Mode,label:'Afterwards',Icon:Moon,show:!!healthData},
 ].filter(m=>m.show),[detail.seriesSampled?.data,endurance,hasRoute,family,healthData]);
 const [chosen,setChosen]=useState<Mode>(initialMode),mode=modes.some(m=>m.id===chosen)?chosen:modes[0].id;
 const [selection,setSelection]=useState<RouteSelection|null>(null),[cursor,setCursor]=useState<number|null>(null);
 const showMap=hasRoute&&mode!=='afterwards';
 function choose(next:Mode){setSelection(null);setCursor(null);setChosen(next)}
 const mapProps={detail,selection,cursorIndex:mode==='replay'||mode==='fingerprint'?cursor:null};
 return <section className="workout-explorer" aria-label="Explore this workout"><nav className="workout-explorer-nav" aria-label="Workout analysis views">{modes.map(({id,label,Icon})=><button type="button" key={id} aria-pressed={mode===id} onClick={()=>choose(id)}><Icon size={13}/><span>{label}</span></button>)}</nav>
 {showMap&&<div className="workout-explorer-map"><RouteMap {...mapProps} compact/><ExpandButton title="Workout route"><RouteMap {...mapProps}/></ExpandButton></div>}
 <FeatureBoundary key={mode}><Suspense fallback={<LoadingState compact label="Preparing workout analysis…"/>}>
 {(['replay','fingerprint','terrain','coasting'] as Mode[]).includes(mode)&&<Replay detail={detail} mode={mode as 'replay'|'fingerprint'|'terrain'|'coasting'} onSelection={setSelection} onCursor={setCursor}/>}
 {mode==='compare'&&<Compare detail={detail} history={history} token={token} isDemo={isDemo} onSelection={setSelection}/>}
 {mode==='laps'&&<Mosaic detail={detail} history={history} token={token} isDemo={isDemo} storageScope={storageScope} onSelection={setSelection}/>}
 {mode==='afterwards'&&<Afterwards detail={detail} history={history} healthData={healthData} now={isDemo?new Date('2026-09-17T23:59:59'):undefined}/>}
 </Suspense></FeatureBoundary>
 <small className="workout-explorer-foot"><Maximize2 size={10}/> Recorded data · tap sections to inspect · missing measurements stay blank</small></section>;
}
