import {startTransition,useEffect,useRef,useState} from 'react';
import type {AthleteData} from './analytics';
// Keep progressive enrichment independent of the heavy, on-demand analysis UI.
export function useBackgroundAnalysis({data,setData,token,isDemo,enabled,fullHistory=false,onError}:{data:AthleteData;setData:React.Dispatch<React.SetStateAction<AthleteData>>;token:string;isDemo:boolean;enabled:boolean;fullHistory?:boolean;onError?:(message:string)=>void}){
 const latest=useRef(data);latest.current=data;const quotaDay=useRef('');const completed=useRef('');const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(isDemo){completed.current='';return}if(data.provider==='coros'&&quotaDay.current===new Date().toISOString().slice(0,10))return;if(!enabled||!token||!data.syncedAt)return;
  const autoKey=token+':'+data.syncedAt+':false',key=token+':'+data.syncedAt+':'+fullHistory;if(completed.current===key)return;
  if(fullHistory)completed.current=autoKey; // Pausing a full pass must not start another automatic batch.
  const controller=new AbortController();let cancelled=false;
  const timer=window.setTimeout(async()=>{
   const pending=latest.current.activities.filter(a=>data.provider==='coros'?(a.provider==='coros'&&(a.analysisSource!=='COROS FIT'||a.nativeVersion!==3)):(!a.analyzed||a.hrHistogram===undefined||a.evidence?.insightVersion!==2)).slice(0,fullHistory?10000:4);
   if(!pending.length){completed.current=key;return}setBusy(true);onError?.('');
   try{for(let i=0;i<pending.length;i+=4){
    if(cancelled)return;
    while(document.visibilityState!=='visible'){await new Promise(resolve=>setTimeout(resolve,1000));if(cancelled)return;}
    const response=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action:'enrich',background:true,ids:pending.slice(i,i+4).map(a=>a.id)}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])});
    if(!response.ok){if(response.status===429&&data.provider==='coros')quotaDay.current=new Date().toISOString().slice(0,10);const failure=await response.json().catch(()=>({})) as {error?:string};throw new Error(failure.error||'Analysis could not finish. Sync to retry.')} const result=await response.json() as {details:any[]};if(cancelled)return;
    if(!Array.isArray(result.details))throw new Error('Incomplete analysis');
    const details=new Map(result.details.map(d=>[d.id,d]));
    startTransition(()=>setData(current=>({...current,activities:current.activities.map(a=>{const d=details.get(a.id);return d?{...a,nativeVersion:d.nativeVersion,summary:a.provider==='coros'?d.summary:{...a.summary,...d.summary},hrHistogram:d.hrHistogram,evidence:d.evidence,analysisSource:d.analysisSource,analyzed:true}:a})})));
    await new Promise(resolve=>setTimeout(resolve,250));
   }completed.current=key}catch(error){if(!cancelled){completed.current=key;onError?.(error instanceof Error?error.message:'Analysis could not finish. Sync to retry.')}}finally{if(!cancelled)setBusy(false)}
  },2500);
  return()=>{cancelled=true;controller.abort();clearTimeout(timer);setBusy(false)};
 },[enabled,token,isDemo,data.syncedAt,setData,fullHistory,onError]);
 return busy;
}
