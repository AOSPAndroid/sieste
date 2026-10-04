"use client";
import {useEffect,useState,useRef} from 'react';
import {activityAlertBaseline,activityAlertSeen,retrievedActivityAlerts,sleepAlertBaseline,retrievedSleepAlert,validSleepAlertState,type ActivityAlertState,type AlertSnapshot} from './activity-alerts';
import {sportFamily,sportName} from './sports';
const memory=new Map<string,ActivityAlertState>();
const volatile=new Set<string>();
const prefix='sieste-activity-alerts-v1:';
function read(scope:string){
 if(volatile.has(scope))return memory.get(scope)??null;
 try{const value=JSON.parse(localStorage.getItem(prefix+scope)??'null');if(value?.version===1&&typeof value.enabled==='boolean'&&Number.isFinite(value.notBefore)&&Array.isArray(value.seen)&&value.seen.length<=6000&&value.seen.every((id:unknown)=>typeof id==='string'))return {...value,sleep:validSleepAlertState(value.sleep)?value.sleep:undefined} as ActivityAlertState;}catch{/* Device storage can be blocked. */}
 return memory.get(scope)??null;
}
function save(scope:string,state:ActivityAlertState){memory.set(scope,state);try{localStorage.setItem(prefix+scope,JSON.stringify(state));volatile.delete(scope);return true}catch{volatile.add(scope);return false}}
function locked<T>(scope:string,task:()=>T):Promise<T>{return navigator.locks?navigator.locks.request(prefix+scope,task):Promise.resolve(task())}
const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
async function worker(){
 await navigator.serviceWorker.register('/activity-notifications-sw.js',{scope:'/',updateViaCache:'none'});
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Notifications could not start. Please try again.')),10000)})]);}
 finally{clearTimeout(timer)}
}
export function useActivityNotifications(scope:string|null,data:AlertSnapshot|null,ready:boolean){
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[notice,setNotice]=useState(''),[support,setSupport]=useState<'loading'|'supported'|'homescreen'|'unsupported'>('loading');
 const current=useRef(scope),generation=useRef(0),latestData=useRef(data),pending=useRef(0);current.current=scope;latestData.current=data;
 useEffect(()=>{
  generation.current++;setBusy(false);setNotice('');setMessage('');setEnabled(scope?!!read(scope)?.enabled:false);
  setSupport(ios()&&!standalone()?'homescreen':'Notification' in window&&'serviceWorker' in navigator&&isSecureContext?'supported':'unsupported');
  const change=(event:StorageEvent)=>{if(scope&&event.key===prefix+scope){volatile.delete(scope);memory.delete(scope);setEnabled(!!read(scope)?.enabled)}};window.addEventListener('storage',change);return()=>window.removeEventListener('storage',change);
 },[scope]);
 useEffect(()=>{
  if(!scope||!data||!ready||pending.current)return;const epoch=generation.current;
  void locked(scope,()=>{if(current.current!==scope||epoch!==generation.current||latestData.current!==data||pending.current)return;const state=read(scope);if(state)save(scope,{...state,seen:activityAlertSeen(state.seen,data),sleep:sleepAlertBaseline(data,state.sleep)})}).catch(()=>{});
 },[scope,data,ready]);
 async function enable(){
  if(!scope||!data||!ready||busy)return;const selectedScope=scope,epoch=++generation.current,valid=()=>current.current===selectedScope&&generation.current===epoch;setBusy(true);setMessage('');
  try{
   // Request synchronously from the button gesture, including installed iOS apps.
   const permission=await Notification.requestPermission();if(!valid())return;
   if(permission!=='granted'){setMessage(permission==='denied'?'Notifications are blocked. Allow them in your browser or device settings.':'Notifications were not enabled.');return;}
   await worker();if(!valid()||!latestData.current)return;
   const persisted=await locked(selectedScope,()=>{if(!valid()||!latestData.current)return null;const baseline=activityAlertBaseline(latestData.current),previous=read(selectedScope);baseline.sleep=sleepAlertBaseline(latestData.current,previous?.sleep);return save(selectedScope,baseline)});
   if(persisted===null||!valid())return;setEnabled(true);setMessage(persisted?'Activity and daily sleep notifications enabled on this device.':'Notifications enabled for this visit. This browser is blocking saved preferences.');
  }catch(e){if(valid())setMessage(e instanceof Error?e.message:'Notifications could not be enabled.');}
  finally{if(valid())setBusy(false)}
 }
 function disable(){if(!scope)return;generation.current++;void locked(scope,()=>{const state=read(scope);if(state)save(scope,{...state,enabled:false})}).catch(()=>{});setEnabled(false);setNotice('');setMessage('Activity and sleep notifications disabled on this device.')}
 async function retrieved(activeScope:string|null,snapshot:AlertSnapshot){
  if(!activeScope||activeScope!==current.current)return;
  const epoch=generation.current,baselineData=ready?latestData.current??snapshot:snapshot;pending.current++;
  try{
   const reserve=()=>{
    if(current.current!==activeScope||epoch!==generation.current)return null;
    const stored=read(activeScope);if(!stored?.enabled)return null;
    const state={...stored,sleep:stored.sleep??sleepAlertBaseline(baselineData)};
    const activity=retrievedActivityAlerts(state,snapshot),sleep=retrievedSleepAlert(state.sleep,snapshot);
    // Reserve before delivery; successful sync phases and other tabs share the daily cap.
    save(activeScope,{...activity.state,sleep:sleep.state});return {activities:activity.activities,sleep:sleep.sleep};
   };
   const result=await locked(activeScope,reserve);
   if(!result||current.current!==activeScope||epoch!==generation.current)return;
   const events:{label:string;body:string;tag:string}[]=[];
   if(result.activities.length){
    const latest=result.activities[0],sport=sportName(sportFamily(latest)),count=result.activities.length;
    const label=count>1?`${count} new activities retrieved`:`${sport} retrieved`,distance=latest.summary?.distance;
    const detail=latest.title?.trim()||sport,body=count>1?`${detail} and ${count-1} more.`:detail+(typeof distance==='number'&&Number.isFinite(distance)&&distance>0?` · ${(distance/1000).toLocaleString('en-GB',{maximumFractionDigits:2})} km`:'');
    events.push({label,body,tag:'sieste-activity-'+activeScope+'-'+latest.id});
   }
   if(result.sleep){const minutes=Math.round(result.sleep.seconds/60),duration=`${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`;events.push({label:'Sleep retrieved',body:`${duration} of main sleep.`,tag:'sieste-sleep-'+activeScope+'-'+result.sleep.date})}
   if(!events.length)return;setNotice(events.map(event=>event.label+' · '+event.body).join(' · '));
   if(!('Notification' in window)||Notification.permission!=='granted')return;
   const registration=await worker();if(current.current!==activeScope||epoch!==generation.current||!read(activeScope)?.enabled)return;
   for(const event of events){if(current.current!==activeScope||epoch!==generation.current||!read(activeScope)?.enabled)return;try{await registration.showNotification(event.label,{body:event.body,icon:'/sieste-icon-180.png',badge:'/sieste-icon-32.png',tag:event.tag,data:{url:'/'}})}catch{/* The in-app alert remains usable if the device notification fails. */}}
  }catch{/* A device notification failure leaves the reserved event and in-app notice intact. */}
  finally{pending.current--}
 }
 return {enabled,busy,message,notice,support,enable,disable,retrieved,dismiss:()=>setNotice('')};
}
