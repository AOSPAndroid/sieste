"use client";
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,Palette,SlidersHorizontal,LayoutGrid,Settings2,X} from 'lucide-react';

export type ShareTool='colour'|'thickness'|'design'|'details';
const tools=[{key:'colour',name:'Colour',icon:Palette},{key:'thickness',name:'Thickness',icon:SlidersHorizontal},{key:'design',name:'Design',icon:LayoutGrid},{key:'details',name:'Details',icon:Settings2}] as const;

export default function ShareCanvas({preview,exports,colour,thickness,gallery,details,tool,onToolChange,onClose}:{preview:ReactNode;exports:ReactNode;colour:ReactNode;thickness:ReactNode|null;gallery:ReactNode;details:ReactNode;tool:ShareTool|null;onToolChange:(tool:ShareTool|null)=>void;onClose:()=>void}){
 const dialogRef=useRef<HTMLDialogElement>(null),trayRef=useRef<HTMLElement>(null),previousTool=useRef(tool),panelId=useId();
 useEffect(()=>{
  const dialog=dialogRef.current;if(!dialog)return;
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';dialog.showModal();dialog.querySelector<HTMLButtonElement>('.share-canvas-back')?.focus({preventScroll:true});
  const measure=()=>{const viewport=window.visualViewport,height=viewport?.height??window.innerHeight;dialog.style.setProperty('--share-canvas-height',height+'px');dialog.style.setProperty('--share-canvas-top',(viewport?.offsetTop??0)+'px');dialog.dataset.compact=String(height<=460)};
  measure();window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);window.visualViewport?.addEventListener('scroll',measure);
  return()=>{window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('scroll',measure);dialog.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true})};
 },[]);
 useEffect(()=>{
  const dialog=dialogRef.current,tray=trayRef.current;if(!dialog)return;
  const measure=()=>dialog.style.setProperty('--share-tray-height',(tray?.getBoundingClientRect().height??0)+'px');
  measure();const observer=new ResizeObserver(measure);if(tray)observer.observe(tray);
  if(previousTool.current&&!tool)dialog.querySelector<HTMLButtonElement>(`[data-tool="${previousTool.current}"]`)?.focus({preventScroll:true});
  previousTool.current=tool;
  return()=>observer.disconnect();
 },[tool]);
 const active=tool==='thickness'&&!thickness?null:tool,content=active==='colour'?colour:active==='thickness'?thickness:active==='design'?gallery:details;
 return createPortal(<dialog ref={dialogRef} className="share-canvas" aria-label="Full-screen share editor" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter(item=>item.getClientRects().length>0);
  if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus({preventScroll:true})}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus({preventScroll:true})}
 }} onCancel={e=>{e.preventDefault();if(tool)onToolChange(null);else onClose()}}>
  <header className="share-canvas-header"><button type="button" className="share-canvas-back" aria-label="Back to share options" onClick={onClose}><ArrowLeft size={20}/></button>{exports}</header>
  <div className="share-canvas-stage">{preview}</div>
  {active&&<section ref={trayRef} id={panelId} className={`share-canvas-tray tool-${active}`} aria-labelledby={panelId+'-title'}><header><h2 id={panelId+'-title'}>{tools.find(t=>t.key===active)?.name}</h2><button type="button" aria-label="Close editing controls" onClick={()=>onToolChange(null)}><X size={18}/></button></header><div className="share-canvas-tool-content">{content}</div></section>}
  <div className="share-canvas-tools" role="toolbar" aria-label="Edit share image">{tools.filter(t=>t.key!=='thickness'||!!thickness).map(({key,name,icon:Icon})=><button type="button" key={key} data-tool={key} aria-pressed={active===key} aria-expanded={active===key} aria-controls={active===key?panelId:undefined} onClick={()=>onToolChange(active===key?null:key)}><Icon size={19}/><span>{name}</span></button>)}</div>
 </dialog>,document.body);
}
