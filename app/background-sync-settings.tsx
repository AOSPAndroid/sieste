"use client";
import {useEffect,useState} from 'react';
import {Bell,Check,Cloud,RefreshCw} from 'lucide-react';
import './background-sync.css';

type Settings={enabled:boolean;timeZone:string;intervalMinutes:15|30|60;lastCompletedAt:string|number|null;lastStatus:string|null;lastError:string|null;nextRunAt:string|number|null;workerOnline:boolean;publicKey:string|null;subscriptions:number;subscriptionIds?:string[]};
type Support='loading'|'supported'|'homescreen'|'unsupported';
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isInstalled=()=>matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
function dateLabel(value:string|number|null|undefined){if(value===null||value===undefined)return null;const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):null}
async function endpointId(endpoint:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('')}
function serverKey(value:string){const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'='));const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}
async function syncWorker(){
 const registration=await navigator.serviceWorker.register('/sieste-sw.js',{scope:'/',updateViaCache:'none'});
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Notifications could not start. Please try again.')),12000)})]);return registration}
 finally{clearTimeout(timer)}
}
async function readSettings(signal?:AbortSignal){const response=await fetch('/api/background-sync',{cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});const body=await response.json() as Settings&{error?:string};if(!response.ok)throw Error(body.error||'Background sync settings could not load.');return body}

export default function BackgroundSyncSettings({connected=true}:{connected?:boolean}){
 const [settings,setSettings]=useState<Settings|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [support,setSupport]=useState<Support>('loading'),[permission,setPermission]=useState<NotificationPermission>('default'),[subscription,setSubscription]=useState<PushSubscription|null>(null),[deviceId,setDeviceId]=useState('');
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  const capable='Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window&&isSecureContext;
  const currentSupport=isIOS()&&!isInstalled()?'homescreen':capable?'supported':'unsupported';setSupport(currentSupport);if('Notification' in window)setPermission(Notification.permission);
  void readSettings(controller.signal).then(value=>{if(active)setSettings(value)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Settings could not load.')}).finally(()=>{if(active)setLoading(false)});
  if(currentSupport==='supported')void syncWorker().then(async registration=>{const saved=await registration.pushManager.getSubscription();const id=saved?await endpointId(saved.endpoint):'';if(active){setSubscription(saved);setDeviceId(id)}}).catch(()=>{/* Enabling notifications offers an actionable retry. */});
  return()=>{active=false;controller.abort()};
 },[]);
 async function save(body:Record<string,unknown>){
  const response=await fetch('/api/background-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)}),result=await response.json() as Partial<Settings>&{error?:string};
  if(!response.ok)throw Error(result.error||'Your settings could not be saved.');
  const next=typeof result.enabled==='boolean'?result as Settings:await readSettings();setSettings(next);return next;
 }
 async function change(body:Record<string,unknown>,success:string){if(busy)return;setBusy('settings');setError('');setMessage('');try{await save(body);setMessage(success)}catch(reason){setError(reason instanceof Error?reason.message:'Your settings could not be saved.')}finally{setBusy('')}}
 async function enableNotifications(){
  if(busy||support!=='supported'||!settings?.publicKey)return;setBusy('notifications');setError('');setMessage('');
  try{
   // Keep the permission prompt directly inside the button's user gesture.
   const allowed=Notification.permission==='granted'?'granted':await Notification.requestPermission();setPermission(allowed);
   if(allowed!=='granted'){setMessage(allowed==='denied'?'Notifications are blocked. Allow them in your browser or device settings, then try again.':'Notifications were not enabled.');return}
   const registration=await syncWorker();let existing=await registration.pushManager.getSubscription();const expectedKey=serverKey(settings.publicKey);
   if(existing?.options.applicationServerKey){const previousKey=new Uint8Array(existing.options.applicationServerKey);if(previousKey.length!==expectedKey.length||previousKey.some((value,index)=>value!==expectedKey[index])){await existing.unsubscribe();existing=null}}
   const selected=existing??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:expectedKey});
   setSubscription(selected);setDeviceId(await endpointId(selected.endpoint));
   await save({subscription:selected.toJSON()});setMessage('Sync notifications enabled on this device.');
  }catch(reason){setError(reason instanceof Error?reason.message:'Notifications could not be enabled.')}finally{setBusy('')}
 }
 async function disableNotifications(){if(busy||!subscription)return;setBusy('notifications');setError('');setMessage('');try{await save({removeEndpoint:subscription.endpoint});await subscription.unsubscribe();setSubscription(null);setDeviceId('');setMessage('Sync notifications disabled on this device.')}catch(reason){setError(reason instanceof Error?reason.message:'Notifications could not be disabled.')}finally{setBusy('')}}
 async function testNotifications(){if(busy)return;setBusy('test');setError('');setMessage('');try{await save({test:true});setMessage('Test queued for your linked devices.')}catch(reason){setError(reason instanceof Error?reason.message:'The test could not be sent.')}finally{setBusy('')}}
 const deviceSubscribed=!!deviceId&&!!settings?.subscriptionIds?.includes(deviceId),lastCompleted=dateLabel(settings?.lastCompletedAt),nextRun=dateLabel(settings?.nextRunAt);
 const localZone=typeof Intl==='undefined'?'UTC':Intl.DateTimeFormat().resolvedOptions().timeZone;
 const lastStatus=settings?.lastStatus==='partial'?'Partly synced':settings?.lastStatus==='failed'?'Last check failed':settings?.lastStatus==='unchanged'?'No new data':lastCompleted?'Synced':'Waiting for first check';
 return <section className="background-sync-settings" aria-labelledby="background-sync-heading">
  <header><h3 id="background-sync-heading"><Cloud size={16}/>Background sync</h3>{settings&&<span className={settings.enabled?'background-sync-pill is-enabled':'background-sync-pill'}>{settings.enabled?'On':'Off'}</span>}</header>
  <p>Keep your dashboard up to date while Sieste is closed. Get a notification when new data has synced.</p>
  {loading?<p className="background-sync-note" role="status">Loading settings…</p>:settings?<>
   <div className="background-sync-controls"><button className="background-sync-toggle" role="switch" aria-checked={settings.enabled} disabled={!!busy||(!connected&&!settings.enabled)} onClick={()=>void change({enabled:!settings.enabled,timeZone:localZone},settings.enabled?'Background sync turned off.':'Background sync turned on.')}><span>{settings.enabled&&<Check size={13}/>}</span>{settings.enabled?'Background sync enabled':'Enable background sync'}</button><label>Check every<select aria-label="Background sync interval" value={settings.intervalMinutes} disabled={!!busy} onChange={event=>void change({intervalMinutes:Number(event.target.value)},'Check interval saved.')}><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 hour</option></select></label></div>
   {!connected&&<p className="background-sync-note">Connect and sync an account first.</p>}
   <div className="background-sync-status"><span><i className={settings.workerOnline?'is-online':''}/>{settings.workerOnline?'Sync PC online':'Sync PC offline'}</span><span>{lastStatus}</span>{lastCompleted&&<span>Last check · <time>{lastCompleted}</time></span>}{settings.enabled&&nextRun&&<span>Next check · <time>{nextRun}</time></span>}</div>
   <p className="background-sync-note">The sync PC needs to stay on and online.{!settings.workerOnline&&settings.enabled?' Checks resume when it reconnects.':''}</p>
   {settings.lastError&&['partial','failed'].includes(settings.lastStatus??'')&&<p className="background-sync-note">{settings.lastError}</p>}
   <div className="background-sync-notifications"><h4><Bell size={14}/>Sync notifications<span>{deviceSubscribed?'This device enabled':settings.subscriptions?`${settings.subscriptions} ${settings.subscriptions===1?'device':'devices'} linked`:'Off'}</span></h4>
    {support==='homescreen'?<p>On iPhone or iPad, open Sieste in Safari, choose Share → Add to Home Screen, then enable notifications from that app.</p>:support==='unsupported'?<p>This browser does not support push notifications. Background sync can still run.</p>:<>
     {permission==='denied'&&<p>Notifications are blocked. Allow them in your browser or device settings to receive alerts.</p>}
     {!settings.publicKey&&<p>Notification delivery is being set up. Background sync can still run.</p>}
     <div className="background-sync-actions"><button disabled={!!busy||support==='loading'||(!deviceSubscribed&&!settings.publicKey)} onClick={()=>void (deviceSubscribed?disableNotifications():enableNotifications())}>{busy==='notifications'?'Saving…':deviceSubscribed?'Disable on this device':'Enable on this device'}</button>{settings.subscriptions>0&&<button disabled={!!busy} onClick={()=>void testNotifications()}><RefreshCw size={12}/>{busy==='test'?'Queuing…':'Send test'}</button>}</div>
    </>}
    <p className="background-sync-note">Alerts arrive when new data is saved. Repeated checks stay quiet.</p>
   </div>
  </>:<button className="background-sync-retry" disabled={!!busy} onClick={()=>void (async()=>{setBusy('settings');setError('');try{setSettings(await readSettings())}catch(reason){setError(reason instanceof Error?reason.message:'Settings could not load.')}finally{setBusy('')}})()}>Retry loading settings</button>}
  {error&&<p className="background-sync-error" role="alert">{error}</p>}{message&&<p className="background-sync-message" role="status">{message}</p>}
 </section>;
}
