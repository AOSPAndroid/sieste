import {useEffect,useRef,useState} from 'react';
import {cachedWorkout,loadWorkout,subscribeWorkoutPreviews} from './workout-detail-cache';
export function useCalendarDetails(signature:string,token:string,isDemo:boolean,syncKey?:string){
 const [snapshot,setSnapshot]=useState<{token:string;details:Record<string,any>}>({token:'',details:{}});
 const lastSync=useRef({token,key:syncKey});
 const ids=signature.split('|').filter(Boolean),immediate=Object.fromEntries(ids.map(id=>[id,cachedWorkout(token,id,'preview')]).filter(([,d])=>d));
 useEffect(()=>{if(isDemo||!token)return;return subscribeWorkoutPreviews((scope,id)=>{if(scope===null){setSnapshot({token,details:{}});return}if(scope!==token||!id||!signature.split('|').includes(id))return;const detail=cachedWorkout(token,id,'preview');if(detail)setSnapshot(s=>({token,details:{...(s.token===token?s.details:{}),[id]:detail}}))})},[signature,token,isDemo]);
 useEffect(()=>{if(isDemo||!token||!signature)return;let live=true;
 const refresh=lastSync.current.token===token&&lastSync.current.key!==syncKey;lastSync.current={token,key:syncKey};
 void Promise.all(signature.split('|').map(async id=>{try{const cached=cachedWorkout(token,id,'preview'),d=await loadWorkout(token,id,'preview',refresh&&!!cached&&!cached.elevationPreview);if(live)setSnapshot(s=>({token,details:{...(s.token===token?s.details:{}),[id]:d}}))}catch{if(live&&!cachedWorkout(token,id,'preview'))setSnapshot(s=>({token,details:{...(s.token===token?s.details:{}),[id]:{failed:true}}}))}}));return()=>{live=false};
 },[signature,token,isDemo,syncKey]);
 return isDemo?{}:{...(snapshot.token===token?snapshot.details:{}),...immediate};
}
