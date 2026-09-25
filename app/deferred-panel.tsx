"use client";
import {useEffect,useRef,useState,Suspense,type ReactNode} from 'react';
import {FeatureBoundary,LoadingState} from './loading-state';
export const PANEL_CACHE_MS=5*60*1000;
/** Per-instance retention only: no athlete data is persisted or shared between accounts. */
export function RetainedPanel({active,children}:{active:boolean;children:ReactNode|(()=>ReactNode)}){
 const [retained,setRetained]=useState(active),content=useRef<ReactNode>(null);
 useEffect(()=>{if(active){setRetained(true);return}const timer=setTimeout(()=>{content.current=null;setRetained(false)},PANEL_CACHE_MS);return()=>clearTimeout(timer)},[active]);
 if(active)content.current=typeof children==='function'?children():children;
 return <div hidden={!active}>{(active||retained)?content.current:null}</div>;
}
export default function DeferredPanel({summary,className,children}:{summary:ReactNode;className?:string;children:ReactNode|(()=>ReactNode)}){
 const [open,setOpen]=useState(false);
 return <details className={className} onToggle={e=>{if(e.target===e.currentTarget)setOpen(e.currentTarget.open)}}><summary>{summary}</summary><RetainedPanel active={open}>{()=> <FeatureBoundary><Suspense fallback={<LoadingState label="Loading details…"/>}>{typeof children==='function'?children():children}</Suspense></FeatureBoundary>}</RetainedPanel></details>;
}
