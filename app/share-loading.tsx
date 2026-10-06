"use client";
import {useLayoutEffect,useState} from 'react';
import ShareCanvas from './share-canvas';
import {LoadingState} from './loading-state';
export default function ShareLoading({onClose}:{onClose:()=>void}){
 const [ready,setReady]=useState(false);
 useLayoutEffect(()=>setReady(true),[]);
 return ready?<ShareCanvas loading preview={<LoadingState label="Opening share editor…"/>} exports={null} colour={null} thickness={null} gallery={null} details={null} tool={null} onToolChange={()=>{}} onClose={onClose}/>:null;
}
