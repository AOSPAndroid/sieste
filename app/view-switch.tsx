"use client";
import {Suspense,useId,useState,type ReactNode} from 'react';
import {FeatureBoundary} from './loading-state';

// One panel with a row of switches instead of a stack of folded panels: only
// the chosen view renders. The last choice per place is kept while the app is open.
export type View={id:string;label:string;hint?:string;render:()=>ReactNode};
const remembered=new Map<string,string>();
export default function ViewSwitch({views,initial,label,remember,className=''}:{views:View[];initial?:string;label:string;remember?:string;className?:string}){
 const baseId=useId();
 const [chosen,setChosen]=useState(()=>(remember&&remembered.get(remember))||initial||views[0]?.id);
 const view=views.find(v=>v.id===chosen)??views[0];
 if(!view)return null;
 const choose=(id:string)=>{setChosen(id);if(remember)remembered.set(remember,id)};
 return <div className={`view-switch ${className}`.trim()}>
  <div className="view-switch-tabs" role="tablist" aria-label={label}>{views.map((v,i)=><button key={v.id} type="button" role="tab" id={`${baseId}-tab-${i}`} aria-controls={`${baseId}-panel`} aria-selected={v.id===view.id} tabIndex={v.id===view.id?0:-1} onClick={()=>choose(v.id)} onKeyDown={event=>{
   const next=event.key==='ArrowRight'?(i+1)%views.length:event.key==='ArrowLeft'?(i+views.length-1)%views.length:event.key==='Home'?0:event.key==='End'?views.length-1:null;
   if(next===null)return;event.preventDefault();choose(views[next].id);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }}>{v.label}</button>)}</div>
  {view.hint&&<small className="view-switch-hint">{view.hint}</small>}
  <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${views.indexOf(view)}`} tabIndex={0} className="view-switch-panel"><FeatureBoundary key={view.id}><Suspense fallback={<p role="status">Loading {view.label.toLowerCase()}…</p>}>{view.render()}</Suspense></FeatureBoundary></div>
 </div>;
}
