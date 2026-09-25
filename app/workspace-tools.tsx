"use client";
import {RetainedPanel} from './deferred-panel';
import {useState,useId,lazy,Suspense} from 'react';
import {Activity,BarChart3,HeartPulse,Moon,UserRound,Database,CalendarDays,SlidersHorizontal,List,ChevronDown,X} from 'lucide-react';
import type {AthleteData,Workout} from './analytics';
import {LoadingState,FeatureBoundary} from './loading-state';
const Analytics=lazy(()=>import('./analytics').then(m=>({default:m.Analytics})));
const sections={
 Overview:[{key:'Performance lab',label:'Performance',Icon:BarChart3},{key:'Recovery lab',label:'Sleep & recovery',Icon:Moon},{key:'Injury check',label:'Injury check',Icon:HeartPulse},{key:'Athlete & zones',label:'Body & zones',Icon:UserRound},{key:'Data coverage',label:'Data & account',Icon:Database}],
 'Training log':[{key:'Training load',label:'Training mix',Icon:Activity},{key:'Performance studio',label:'Compare & plan',Icon:SlidersHorizontal},{key:'Planning & gear',label:'Plans & equipment',Icon:CalendarDays},{key:'Session explorer',label:'Session table & export',Icon:List}]
};
export default function WorkspaceTools({page,data,setData,token,isDemo,syncing,onSelect,onAccount}:{page:'Overview'|'Training log';data:AthleteData;setData:React.Dispatch<React.SetStateAction<AthleteData>>;token:string;isDemo:boolean;syncing:boolean;onSelect:(a:Workout)=>void;onAccount:()=>void}){
 const panelId=useId(),[toolsOpen,setToolsOpen]=useState(false);
 const [open,setOpen]=useState<Record<string,string|null>>({}),[days,setDays]=useState(28);
 const active=sections[page].find(s=>s.key===open[page]);
 return <section className={`workspace-tools ${page==='Training log'?'journal-tools':''}`} aria-label={page==='Overview'?'Health and performance tools':'Training tools'}>
  {page==='Training log'&&<button className="log-advanced-toggle" aria-expanded={toolsOpen} onClick={()=>{setToolsOpen(v=>!v);if(toolsOpen)setOpen(v=>({...v,[page]:null}))}}><SlidersHorizontal size={12}/> Tools</button>}<div className="workspace-tool-buttons" hidden={page==='Training log'&&!toolsOpen}>{sections[page].map(({key,label,Icon})=><button key={key} aria-label={label} title={label} aria-expanded={active?.key===key} aria-controls={panelId} onClick={()=>setOpen(v=>({...v,[page]:v[page]===key?null:key}))}><Icon size={15}/><span>{page==='Training log'?({'Training load':'Mix','Performance studio':'Compare','Planning & gear':'Plans','Session explorer':'Sessions'} as Record<string,string>)[key]:label}</span><ChevronDown size={13}/></button>)}</div>
  <div id={panelId} className="workspace-tool-panel" hidden={!active}>
   {active&&<header className="workspace-tool-heading"><h2>{active.label}</h2><div>{!['Performance studio','Injury check','Data coverage'].includes(active.key)&&<select aria-label={`${active.label} period`} value={days} onChange={e=>setDays(+e.target.value)}>{[7,28,90,180,365].map(n=><option key={n} value={n}>{n===365?'1 year':`${n} days`}</option>)}</select>}{active.key==='Data coverage'&&<button onClick={onAccount}>Manage account</button>}<button aria-label="Collapse section" onClick={()=>setOpen(v=>({...v,[page]:null}))}><X size={17}/></button></div></header>}
   {sections[page].map(section=><RetainedPanel key={token+section.key} active={active?.key===section.key}>{()=> <FeatureBoundary><Suspense fallback={<LoadingState label={`Loading ${section.label.toLowerCase()}…`}/>}><Analytics data={data} setData={setData} token={token} isDemo={isDemo} syncing={syncing} tab={section.key} days={days} onSelect={onSelect} embedded/></Suspense></FeatureBoundary>}</RetainedPanel>)}
  </div>
 </section>
}
