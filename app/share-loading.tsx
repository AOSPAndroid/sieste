"use client";
import {lazy,Suspense,useLayoutEffect,useState} from 'react';
import {LoadingState} from './loading-state';
// The placeholder stays in the small entry bundle; editor CSS and controls load on opening.
const ShareCanvas=lazy(()=>import('./share-canvas'));
export default function ShareLoading({onClose}:{onClose:()=>void}){
 const [ready,setReady]=useState(false);
 useLayoutEffect(()=>setReady(true),[]);
 return ready?<Suspense fallback={<div className="overlay" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label="Opening share editor" onClick={event=>event.stopPropagation()}><button className="modal-close" type="button" aria-label="Close share editor" onClick={onClose}>×</button><LoadingState label="Opening share editor…"/></section></div>}><ShareCanvas loading preview={<LoadingState label="Opening share editor…"/>} exports={null} colour={null} thickness={null} gallery={null} details={null} tool={null} onToolChange={()=>{}} onClose={onClose}/></Suspense>:null;
}
