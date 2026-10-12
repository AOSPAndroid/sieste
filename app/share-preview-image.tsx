"use client";
import {useEffect,useRef,useState} from 'react';
import {renderShareCardSvg,type ShareDesign} from './share-card-design';

export function useShareSvg(design:ShareDesign,enabled=true){
 const [result,setResult]=useState<{design:ShareDesign;svg:string;error:string}|null>(null);
 useEffect(()=>{
  if(!enabled)return;let current=true;
  renderShareCardSvg(design).then(svg=>{if(current)setResult({design,svg,error:''});},error=>{if(current)setResult({design,svg:'',error:error instanceof Error?error.message:'Could not prepare the design.'});});
  return()=>{current=false;};
 },[design,enabled]);
 return result?.design===design?result:{svg:'',error:''};
}
/** Gallery artwork and fonts load only when a thumbnail reaches the viewport. */
export default function SharePreviewImage({design}:{design:ShareDesign}){
 const element=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false);
 useEffect(()=>{
  if(!element.current)return;
  if(typeof IntersectionObserver==='undefined'){setVisible(true);return;}
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'120px'});
  observer.observe(element.current.parentElement??element.current);return()=>observer.disconnect();
 },[]);
 const {svg,error}=useShareSvg(design,visible);
 return <span ref={element} aria-busy={visible&&!svg&&!error} style={{display:'contents'}}>{svg?<img src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)} alt=""/>:error?<small role="status">Preview unavailable</small>:<img alt="" width="1080" height={design.height}/>}</span>;
}
