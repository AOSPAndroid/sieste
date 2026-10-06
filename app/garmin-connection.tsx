"use client";

import {useEffect,useRef,useState} from 'react';
import './coros-connection.css';

type GarminStatus={configured:boolean;connected:boolean;permissions:string[];dataSyncReady:boolean};
const permissionLabels:Record<string,string>={ACTIVITY_EXPORT:'Workouts',HEALTH_EXPORT:'Health & recovery'};

export default function GarminConnection({busy=false}:{busy?:boolean}){
 const [status,setStatus]=useState<GarminStatus|null>(null);
 const [working,setWorking]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const actionRef=useRef<AbortController|null>(null);
 useEffect(()=>()=>actionRef.current?.abort(),[]);

 useEffect(()=>{
  const controller=new AbortController();let active=true;
  setStatus(null);setError('');
  fetch('/api/garmin',{cache:'no-store',signal:controller.signal}).then(async response=>{
   const result:any=await response.json();
   if(!response.ok)throw new Error(result.error||'Could not check your Garmin connection.');
   if(typeof result.configured!=='boolean'||typeof result.connected!=='boolean'||typeof result.dataSyncReady!=='boolean'||!Array.isArray(result.permissions)||result.permissions.some((p:unknown)=>typeof p!=='string'))throw new Error('Could not check your Garmin connection.');
   if(active)setStatus(result);
  }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not check your Garmin connection.');});
  return()=>{active=false;controller.abort();};
 },[attempt]);

 async function connect(){
  const controller=new AbortController();actionRef.current=controller;
  setWorking(true);setError('');
  try{
   const response=await fetch('/api/garmin/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal});
   const result:any=await response.json();
   if(!response.ok)throw new Error(result.error||'Could not start Garmin sign-in.');
   const target=new URL(result.url);
   if(target.origin!=='https://connect.garmin.com'||target.pathname!=='/oauth2Confirm')throw new Error('Unexpected Garmin sign-in address.');
   if(!controller.signal.aborted)window.location.assign(target.href);
  }catch(reason){if(!controller.signal.aborted){setError(reason instanceof Error?reason.message:'Could not start Garmin sign-in.');setWorking(false);}}
 }

 async function disconnect(){
  setWorking(true);setError('');
  try{
   const response=await fetch('/api/garmin',{method:'DELETE'}),result:any=await response.json();
   if(!response.ok||result.disconnected!==true)throw new Error(result.error||'Could not disconnect Garmin.');
   setAttempt(value=>value+1);
  }catch(reason){setError(reason instanceof Error?reason.message:'Could not disconnect Garmin.');}
  finally{setWorking(false);}
 }

 const pending=status&&!status.configured;
 const permissions=status?.permissions.filter(value=>permissionLabels[value])??[];
 return <section className="coros-connection garmin-connection" aria-label="Garmin connection">
  <div className="provider-heading"><strong>Garmin</strong><span>{status?.connected?'Connected':pending?'Setup pending':'Workouts & health'}</span></div>
  {status?.connected?<>
   <p>Garmin sign-in is connected. {status.dataSyncReady?'Your Garmin data is available to sync.':'Automatic data syncing is awaiting Garmin’s data-feed setup.'}</p>
   <small>{permissions.length?'Access granted: '+permissions.map(value=>permissionLabels[value]).join(' · '):'No workout or health access was granted.'}</small>
  </>:<p>{pending?'Garmin sign-in is being prepared. Activity FIT import is available now.':status?'Sign in with Garmin to authorize your workouts and health data. Automatic syncing will follow once setup is complete.':error?'Garmin connection status is unavailable.':'Checking Garmin connection…'}</p>}
  <button type="button" className="primary-button" onClick={connect} disabled={busy||working||!status?.configured}>{working?'Please wait…':pending?'Garmin setup pending':status?.connected?'Reconnect Garmin':'Connect Garmin'}</button>
  {status?.connected&&<button type="button" className="disconnect" disabled={busy||working} onClick={disconnect}>Disconnect Garmin</button>}
  {error&&<div role="alert"><p className="error">{error}</p>{!status&&<button type="button" className="lab-button" disabled={busy||working} onClick={()=>setAttempt(value=>value+1)}>Retry Garmin connection</button>}</div>}
  <small>Sign in on Garmin’s website. sieste never asks for your Garmin password.</small>
 </section>;
}
