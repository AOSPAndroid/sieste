"use client";
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {MessageCircle,Minus} from 'lucide-react';
import {Button} from '@/components/ui/button';
export type AthenaChatProps={selectedId?:string;screen?:string;canChat?:boolean};
// Warm only the panel code on intent; opening is still required for any data request.
const loadAthenaPanel=()=>import('./athena-chat-panel');
const AthenaChatPanel=lazy(loadAthenaPanel);
const warmAthenaPanel=()=>{void loadAthenaPanel().catch(()=>{})};
function AthenaOpening({screen,onMinimize}:{screen:string;onMinimize:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close()},[]);
 return <dialog ref={dialog} className="athena-chat" aria-labelledby="athena-opening-title" onCancel={onMinimize}><header><div><strong id="athena-opening-title">Athena</strong><small>Opening… · {screen}</small></div><Button variant="ghost" size="icon-sm" aria-label="Minimize Athena" title="Minimize chat" onClick={onMinimize}><Minus data-icon="inline-start"/></Button></header><div className="athena-opening" role="status">Opening your coach…</div></dialog>;
}
export default function AthenaChat({selectedId,screen='Home',canChat=true}:AthenaChatProps){
 const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false),[requested,setRequested]=useState(false),launcher=useRef<HTMLButtonElement>(null);
 useEffect(()=>setMounted(true),[]);
 if(!mounted)return null;
 const minimize=()=>setOpen(false);
 return createPortal(<><Button ref={launcher} variant="outline" className="athena-launcher" aria-label="Chat with Athena" aria-haspopup="dialog" aria-expanded={open} onPointerEnter={warmAthenaPanel} onFocus={warmAthenaPanel} onPointerDown={warmAthenaPanel} onClick={()=>{setRequested(true);setOpen(true)}}><MessageCircle data-icon="inline-start"/><span>Athena</span></Button>{requested&&<Suspense fallback={open?<AthenaOpening screen={screen} onMinimize={minimize}/>:null}><AthenaChatPanel selectedId={selectedId} screen={screen} canChat={canChat} open={open} onMinimize={minimize} launcher={launcher}/></Suspense>}</>,document.body);
}
