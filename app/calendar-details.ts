import {useEffect,useState} from 'react';
import {cachedWorkout,loadWorkout} from './workout-detail-cache';
export function useCalendarDetails(signature:string,token:string,isDemo:boolean,syncKey?:string){
 const [snapshot,setSnapshot]=useState<{token:string;details:Record<string,any>}>({token:'',details:{}});
 const ids=signature.split('|').filter(Boolean),immediate=Object.fromEntries(ids.map(id=>[id,cachedWorkout(token,id,'preview')]).filter(([,d])=>d));
 useEffect(()=>{if(isDemo||!token||!signature)return;let live=true;
 void Promise.all(signature.split('|').map(async id=>{try{const d=await loadWorkout(token,id,'preview');if(live)setSnapshot(s=>({token,details:{...(s.token===token?s.details:{}),[id]:d}}))}catch{if(live&&!cachedWorkout(token,id,'preview'))setSnapshot(s=>({token,details:{...(s.token===token?s.details:{}),[id]:{failed:true}}}))}}));return()=>{live=false};
 },[signature,token,isDemo,syncKey]);
 return isDemo?{}:{...(snapshot.token===token?snapshot.details:{}),...immediate};
}
