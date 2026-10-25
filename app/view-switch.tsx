"use client";
import {useState,type ReactNode} from 'react';

// One panel with a row of switches instead of a stack of folded panels: only
// the chosen view renders. The last choice per place is kept while the app is open.
export type View={id:string;label:string;hint?:string;render:()=>ReactNode};
const remembered=new Map<string,string>();
export default function ViewSwitch({views,initial,label,remember,className=''}:{views:View[];initial?:string;label:string;remember?:string;className?:string}){
 const [chosen,setChosen]=useState(()=>(remember&&remembered.get(remember))||initial||views[0]?.id);
 const view=views.find(v=>v.id===chosen)??views[0];
 if(!view)return null;
 const choose=(id:string)=>{setChosen(id);if(remember)remembered.set(remember,id)};
 return <div className={`view-switch ${className}`.trim()}>
  <div className="view-switch-tabs" role="tablist" aria-label={label}>{views.map(v=><button key={v.id} type="button" role="tab" aria-selected={v.id===view.id} onClick={()=>choose(v.id)}>{v.label}</button>)}</div>
  {view.hint&&<small className="view-switch-hint">{view.hint}</small>}
  <div role="tabpanel" aria-label={view.label} className="view-switch-panel">{view.render()}</div>
 </div>;
}
