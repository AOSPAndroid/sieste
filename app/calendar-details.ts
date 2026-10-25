import {useEffect,useRef,useState} from 'react';
import {cachedWorkout,loadWorkout,subscribeWorkoutPreviews} from './workout-detail-cache';
/** "id=twinId|…" for sessions COROS also recorded, whose laps can stand in when the primary preview fails. */
export const previewFallbacks=(activities:{id:string;fallbackId?:string}[])=>activities.flatMap(a=>a.fallbackId?.startsWith('coros_')?[`${a.id}=${a.fallbackId}`]:[]).sort().join('|');
const RETRY_MS=30000;
export function useCalendarDetails(signature:string,token:string,isDemo:boolean,syncKey?:string,fallbacks=''){
 const [snapshot,setSnapshot]=useState<{token:string;details:Record<string,any>}>({token:'',details:{}});
 const [attempt,setAttempt]=useState(0);
 const lastSync=useRef({token,key:syncKey});
 const twins=new Map(fallbacks.split('|').filter(Boolean).map(pair=>pair.split('=') as [string,string]));
 const cached=(id:string)=>{const twin=twins.get(id);return cachedWorkout(token,id,'preview')??(twin?cachedWorkout(token,twin,'preview'):null)};
 const ids=signature.split('|').filter(Boolean),immediate=Object.fromEntries(ids.map(id=>[id,cached(id)]).filter(([,d])=>d));
 useEffect(()=>{if(isDemo||!token)return;const twinOf=new Map(fallbacks.split('|').filter(Boolean).map(pair=>pair.split('=').reverse() as [string,string]));return subscribeWorkoutPreviews((scope,changed)=>{if(scope===null){setSnapshot({token,details:{}});return}const id=changed&&(twinOf.get(changed)??changed);if(scope!==token||!id||!signature.split('|').includes(id))return;const detail=cachedWorkout(token,id,'preview')??cachedWorkout(token,changed!,'preview');if(detail)setSnapshot(s=>({token,details:{...(s.token===token?s.details:{}),[id]:detail}}))})},[signature,token,isDemo,fallbacks]);
 useEffect(()=>{if(isDemo||!token||!signature)return;let live=true,retry:ReturnType<typeof setTimeout>|undefined;
 const refresh=lastSync.current.token===token&&lastSync.current.key!==syncKey;lastSync.current={token,key:syncKey};
 const twinOf=new Map(fallbacks.split('|').filter(Boolean).map(pair=>pair.split('=') as [string,string]));
 const put=(id:string,d:unknown)=>{if(live)setSnapshot(s=>({token,details:{...(s.token===token?s.details:{}),[id]:d}}))};
 void Promise.all(signature.split('|').map(async id=>{const prior=cachedWorkout(token,id,'preview');try{put(id,await loadWorkout(token,id,'preview',refresh&&!!prior&&!prior.elevationPreview));return true}catch{
  // Tredict can fail on a session it is still processing; the COROS copy of the same session has the same laps.
  const twin=twinOf.get(id);if(twin)try{put(id,await loadWorkout(token,twin,'preview'));return true}catch{}
  if(!cachedWorkout(token,id,'preview'))put(id,{failed:true});return false}})).then(results=>{
  // A failure is not remembered by the cache, so one more pass later picks up a provider that has caught up.
  if(live&&attempt<2&&results.includes(false))retry=setTimeout(()=>setAttempt(n=>n+1),RETRY_MS*(attempt+1));
 });return()=>{live=false;clearTimeout(retry)};
 },[signature,token,isDemo,syncKey,fallbacks,attempt]);
 return isDemo?{}:{...(snapshot.token===token?snapshot.details:{}),...immediate};
}
