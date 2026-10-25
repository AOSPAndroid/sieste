"use client";
import {LiveSyncContext} from './live-sync';

import {Button} from '@/components/ui/button';
import AthenaChat from './athena-chat';
import SiesteWordmark from './sieste-wordmark';
import {createPortal} from 'react-dom';

import {progressiveSync} from './progressive-sync';
import {useActivityNotifications} from './use-activity-notifications';
const ActivityNotificationSettings=lazy(()=>import('./activity-notification-settings'));
import {restoreDashboard} from './restore-dashboard';
import {clearDeviceSnapshot,writeDeviceSnapshot} from './device-snapshot-cache';
import {clearWorkoutCache} from './workout-detail-cache';
import {loadWorkoutView} from './activity-loader';
import {useScrollChrome} from './use-scroll-chrome';
const CorosHub=lazy(()=>import('./coros-hub'));
const BackgroundSyncSettings=lazy(()=>import('./background-sync-settings'));
import CorosFitness from './coros-fitness';
import {applyWorkoutExclusions} from './workout-exclusions';
import {useEffect,useState,useRef,lazy,Suspense,useDeferredValue,startTransition,useCallback,useMemo} from 'react';
import {Home as HomeIcon,CloudSun,ArrowUpRight,CalendarDays,Moon,Link2,RefreshCw,X,ShieldCheck,ChevronDown} from 'lucide-react';
import type {Workout,AthleteData as Data} from './analytics';
import {DashboardLoading,LoadingState,WorkoutLoading,FeatureBoundary} from './loading-state';
import {useBackgroundAnalysis} from './background-analysis';
import ExpansionProvider from './expansion';
import Today from './today';
const HomeInsightsGrid=lazy(()=>import('./home-insights-grid'));
import ActivityDailyPeek from './activity-daily-peek';
const TrainingCoach=lazy(()=>import('./training-coach'));
const CorosConnection=lazy(()=>import('./coros-connection'));
const GarminConnection=lazy(()=>import('./garmin-connection'));
import RetainedPage from './retained-page';
import DeferredPanel from './deferred-panel';
const loadSleep=()=>import('./sleep-page'),loadWeather=()=>import('./weather-recon'),loadLog=()=>import('./training-log');
const SleepPage=lazy(loadSleep);
const WeatherRecon=lazy(loadWeather);
const WorkoutDetails=lazy(loadWorkoutView);
const TrainingLog=lazy(loadLog);
const WorkspaceTools=lazy(()=>import('./workspace-tools'));
const emptyDashboard:Data={activities:[],sleep:{},hrv:{}};
export default function Home(){
// Page chunks load on intent; avoid competing with account restore and initial charts.
const warmPage=(key:string)=>{const load=key==='Sleep'?loadSleep:key==='Weather recon'?loadWeather:key==='Training log'?loadLog:null;if(load)void load().catch(()=>{});};
const setSyncVisible=useScrollChrome();
const restored=useRef(false),syncAttempt=useRef(Date.now()),syncLock=useRef(false);
const restoreRevision=useRef(0),deviceScope=useRef<string|null>(null),lastPersisted=useRef<Data|null>(null),demoPending=useRef<number|null>(null),changedAttempt=useRef(0);
const [cachedAt,setCachedAt]=useState<number|null>(null);
const [data,setData]=useState<Data>(emptyDashboard),[isDemo,setIsDemo]=useState(true),[tab,setTab]=useState<'Overview'|'Training log'|'Weather recon'|'Sleep'>('Overview'),[modal,setModal]=useState(false),[token,setToken]=useState(''),[tokenDraft,setTokenDraft]=useState(''),[account,setAccount]=useState<{signedIn:boolean;name?:string}>({signedIn:false}),[accountLoading,setAccountLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<Workout|null>(null);
const contentTab=useDeferredValue(tab);
const [syncPhase,setSyncPhase]=useState('Syncing workouts…'),[manualSync,setManualSync]=useState(false);
const [historyAnalysis,setHistoryAnalysis]=useState(false),[analysisError,setAnalysisError]=useState('');
const [connectionRevision,setConnectionRevision]=useState(0);
const [corosConnected,setCorosConnected]=useState(false);
const [connectionMessage,setConnectionMessage]=useState('');
function closeAccount(){setModal(false);setConnectionMessage('')}
const notifications=useActivityNotifications(deviceScope.current,isDemo?null:data,!accountLoading&&account.signedIn&&!isDemo);
async function disconnectCoros(){setBusy(true);try{const r=await fetch('/api/coros',{method:'DELETE'});if(!r.ok)throw new Error('Could not disconnect COROS.');setCorosConnected(false);await discardDeviceData();await restoreAccount()}catch(e){setError(e instanceof Error?e.message:'Could not disconnect COROS.')}finally{setBusy(false)}}
const [removedWorkout,setRemovedWorkout]=useState<Workout|null>(null),[undoBusy,setUndoBusy]=useState(false),[undoError,setUndoError]=useState('');
async function removeWorkout(activity:Workout){if(busy)throw new Error('Please wait for the current sync to finish.');let excluded=[...(data.excludedWorkouts??[]),{id:activity.id,date:activity.date}];if(!isDemo){const response=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove',id:activity.id})});const result=await response.json() as {error?:string;excludedWorkouts:{id:string;date:string}[]};if(!response.ok)throw new Error(result.error||'Could not remove workout.');excluded=result.excludedWorkouts}setData(current=>applyWorkoutExclusions(current,excluded));setRemovedWorkout(activity);setUndoError('');setSelected(null)}
async function undoRemoval(){if(!removedWorkout)return;setUndoBusy(true);setUndoError('');try{let excluded=(data.excludedWorkouts??[]).filter(e=>e.id!==removedWorkout.id);if(!isDemo){const response=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restore',id:removedWorkout.id})});const result=await response.json() as {error?:string;excludedWorkouts:{id:string;date:string}[]};if(!response.ok)throw new Error(result.error||'Could not restore workout.');excluded=result.excludedWorkouts}const restored=removedWorkout;setData(current=>applyWorkoutExclusions({...current,activities:[...current.activities.filter(a=>a.id!==restored.id),restored].sort((a,b)=>b.date.localeCompare(a.date))},excluded));setRemovedWorkout(null)}catch(e){setUndoError(e instanceof Error?e.message:'Could not undo removal.')}finally{setUndoBusy(false)}}
async function restoreAccount(){
 const revision=++restoreRevision.current,current=()=>restoreRevision.current===revision;
 setAccountLoading(true);
 await restoreDashboard({current,previous:deviceScope.current&&!isDemo?{scope:deviceScope.current,data}:undefined,
  onAccount:state=>{if(!current())return;setAccount({signedIn:state.signedIn,name:state.name});setCorosConnected(state.corosConnected);setToken(state.connected?'__saved__':'');},
  onScope:scope=>{if(!current())return;if(deviceScope.current!==scope){clearWorkoutCache();setConnectionRevision(r=>r+1);lastPersisted.current=null;}deviceScope.current=scope;},
  onData:(snapshot,savedAt)=>{if(!current())return;lastPersisted.current=savedAt?snapshot:null;setCachedAt(savedAt);if(snapshot){demoPending.current=null;setData(snapshot);setIsDemo(false)}else{setSelected(null);setData(emptyDashboard);setIsDemo(true);demoPending.current=revision;setAccountLoading(true);void import('./demo-data').then(({demoData})=>{if(current()){setData(demoData());setIsDemo(true)}}).catch(()=>{if(current())setError('The demo could not load. Refresh to try again.')}).finally(()=>{if(current()){demoPending.current=null;setAccountLoading(false)}})}},
  onReady:()=>{if(current()&&demoPending.current!==revision)setAccountLoading(false)},
  onBusy:value=>{if(current())setBusy(value)},
  onError:message=>{if(current())setError(message)},
  onPhase:phase=>{if(current())setSyncPhase(phase)},
  onRetrieved:fresh=>{if(current())void notifications.retrieved(deviceScope.current,fresh).catch(()=>{})},
 });
}
// Persist changed snapshots after rendering; opening a cache does not renew its TTL.
useEffect(()=>{
 const scope=deviceScope.current;
 if(isDemo||!scope||data===lastPersisted.current)return;
 const persist=()=>{if(deviceScope.current!==scope)return;void writeDeviceSnapshot(scope,data).then(saved=>{if(saved&&deviceScope.current===scope)lastPersisted.current=data})};
 if('requestIdleCallback' in window){const task=window.requestIdleCallback(persist,{timeout:2000});return()=>window.cancelIdleCallback(task)}
 const timer=setTimeout(persist,200);return()=>clearTimeout(timer);
},[data,isDemo]);
useEffect(()=>{if(!account.signedIn||isDemo)return;const refresh=(event:MessageEvent)=>{if(event.data?.type==='sieste-sync-completed'&&!busy)void restoreAccount()};navigator.serviceWorker?.addEventListener('message',refresh);return()=>navigator.serviceWorker?.removeEventListener('message',refresh)},[account.signedIn,isDemo,busy]);
async function discardDeviceData(){
 restoreRevision.current++;deviceScope.current=null;lastPersisted.current=null;setCachedAt(null);clearWorkoutCache();await clearDeviceSnapshot();
}
async function signOut(event:React.MouseEvent<HTMLAnchorElement>){
 event.preventDefault();const link=document.createElement('a');link.href=event.currentTarget.href;link.target='_top';
 await discardDeviceData();link.click();
}
useEffect(()=>{
 if(restored.current)return;restored.current=true;
 const params=new URLSearchParams(window.location.search),provider=params.has('garmin')?'Garmin':'COROS',status=params.get('garmin')??params.get('coros');
 if(status){
  setModal(true);
  if(status!=='connected'){
   const messages:Record<string,string>={
    cancelled:`${provider} connection cancelled.`,
    signin:`Sign in to sieste, then connect ${provider} again.`,
    expired:`${provider} sign-in expired. Please connect again.`,
    unconfigured:'Garmin connection setup is pending.',
    'disconnect-first':'Disconnect your current Garmin account before connecting a different one.',
    'cleanup-required':'Garmin sign-in could not finish. Remove sieste from Garmin’s connected apps, then try again.'
   };
   setConnectionMessage(messages[status]??`${provider} sign-in did not finish. Please try again.`);
  }
  params.delete('garmin');params.delete('coros');
  window.history.replaceState(null,'',window.location.pathname+(params.size?'?'+params.toString():'')+window.location.hash);
 }
 void restoreAccount();
},[]);
async function sync(automatic=false,provider?:'tredict'){if(busy||syncLock.current)return;if(!account.signedIn){setModal(true);return}const clean=automatic?'__saved__':tokenDraft.trim().replace(/^Bearer\s+/i,'')||(token==='__saved__'?'__saved__':'');if(!clean){setError('Connect COROS in your account settings.');setModal(true);return}if(/\s/.test(clean)){setError('The token contains spaces. Reconnect COROS.');setModal(true);return}const retrievalScope=deviceScope.current;syncLock.current=true;syncAttempt.current=Date.now();setBusy(true);setManualSync(!automatic);setError('');try{if(!automatic&&tokenDraft.trim())await discardDeviceData();await progressiveSync({token:clean,provider,manual:!automatic},fresh=>{if(automatic||!tokenDraft.trim())void notifications.retrieved(retrievalScope,fresh).catch(()=>{});startTransition(()=>{setCachedAt(null);setData(fresh);setIsDemo(false)})},setSyncPhase,fetch,!isDemo&&!tokenDraft.trim()?data:undefined);if(!automatic&&tokenDraft.trim()){setConnectionRevision(r=>r+1);await restoreAccount();}setToken('__saved__');if(!automatic)setTokenDraft('');setIsDemo(false);if(!automatic)closeAccount()}catch(e){setError(e instanceof Error?e.message:'Unable to sync.')}finally{syncLock.current=false;setBusy(false);setManualSync(false)}}
// Poll only while visible and online. Coming back to the app (e.g. after a run)
// refreshes after one minute; while it stays open, every two. Failures wait too.
useEffect(()=>{
 if(accountLoading||!account.signedIn||isDemo||token!=='__saved__')return;
 const pollingScope=deviceScope.current,pollingRevision=restoreRevision.current;
 const check=(resumed=false)=>{if(document.visibilityState!=='visible'||!navigator.onLine||busy||modal||selected||syncLock.current)return;const pending=!!data.extra?.coros&&((data.provider==='coros'&&data.extra.coros.history?.complete===false)||data.extra.coros.recoveryHistory?.complete===false);if(pending){if(Date.now()-changedAttempt.current<30000)return;changedAttempt.current=Date.now();void fetch('/api/sync?changed=1',{cache:'no-cache',headers:data.syncRevision?{'If-None-Match':data.syncRevision}:{},signal:AbortSignal.timeout(15000)}).then(async response=>{if(response.status===304)return;if(!response.ok)return;const state=await response.json() as {signedIn?:boolean};if(deviceScope.current===pollingScope&&restoreRevision.current===pollingRevision&&state.signedIn&&response.headers.get('ETag')!==data.syncRevision&&!syncLock.current)await restoreAccount()}).catch(()=>{});return}const lastSuccess=Date.parse(data.syncedAt??'')||0;if(Date.now()-Math.max(lastSuccess,syncAttempt.current)>=(resumed?60000:120000))void sync(true)};
 const resume=()=>check(true),tick=()=>check();
 const timer=window.setInterval(tick,30000);document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);window.addEventListener('focus',resume);check(true);
 return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);window.removeEventListener('focus',resume)};
},[accountLoading,account.signedIn,isDemo,token,busy,modal,selected,data.syncedAt,data.syncRevision]);
useEffect(()=>{if(!modal||accountLoading)return;const previous=document.activeElement as HTMLElement;const dialog=document.querySelector<HTMLElement>('.account-modal');const focusables=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],select:not(:disabled),summary')??[]);dialog?.querySelector<HTMLButtonElement>('.account-modal-header button')?.focus({preventScroll:true});const handle=(e:KeyboardEvent)=>{if(document.querySelector('.athena-chat[open]'))return;if(e.key!=='Tab')return;const items=focusables(),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}};document.addEventListener('keydown',handle);return()=>{document.removeEventListener('keydown',handle);previous?.focus()}},[modal,selected,accountLoading]);
const openAccount=useCallback(()=>setModal(true),[]),toggleHistoryAnalysis=useCallback(()=>setHistoryAnalysis(v=>!v),[]);
const analyzing=useBackgroundAnalysis({data,setData,token,isDemo,fullHistory:historyAnalysis,onError:setAnalysisError,enabled:!accountLoading&&!busy&&!modal&&!selected&&tab==='Overview'});
const coach=useMemo(()=><TrainingCoach analysisError={analysisError} data={data} now={isDemo?new Date('2026-09-17T23:59:59'):new Date()} onSelect={setSelected} isDemo={isDemo} analyzing={analyzing} historyAnalysis={historyAnalysis} onAnalyze={toggleHistoryAnalysis}/>,[analysisError,data,isDemo,analyzing,historyAnalysis,toggleHistoryAnalysis]);
const connected=useMemo(()=><CorosHub data={data}/>,[data]);
if(accountLoading)return <><DashboardLoading/><AthenaChat screen="Loading dashboard" canChat={false}/></>;
const isWeather=tab==='Weather recon';
// Arrival highlights only fire when a sync changes the dashboard, not on navigation.
const liveSync={syncing:busy&&!isDemo,epoch:isDemo?'':data.syncedAt??''};
return <ExpansionProvider data={data} isDemo={isDemo}><div data-activity-open={selected?true:undefined} className={tab==='Overview'?'shell dashboard-theme sieste-v2 sieste-v3 today-shell':'shell dashboard-theme sieste-v2 sieste-v3'}><header className="sieste-topbar"><button className="sieste-brand-home" aria-label="sieste home" onClick={()=>{setTab('Overview');window.scrollTo({top:0,behavior:'instant'})}}><strong><SiesteWordmark/></strong><span>Training & recovery</span></button><span className="v2-current-page">{tab==='Overview'?'Overview':tab==='Training log'?'Training':tab==='Weather recon'?'Ride outlook':'Sleep'}</span><Button variant="outline" size="icon" className="sieste-account" aria-label="Manage your account and connections" title="Account & connection" onClick={()=>setModal(true)}><ShieldCheck data-icon="inline-start"/></Button></header>
<Button variant="outline" size="icon-lg" className="floating-sync" hidden={modal||!!selected||isWeather}   onClick={()=>isDemo?setModal(true):sync()} disabled={busy} aria-label={busy?'Syncing your training':isDemo?'Connect COROS':'Sync now'} title={busy?syncPhase:isDemo?'Connect COROS':'Sync now'}><RefreshCw data-icon="inline-start" className={busy?'spinning':''}/></Button><nav className="mini-dock" aria-label="Quick navigation" hidden={modal||!!selected} >{[{key:'Overview',label:'Home',Icon:HomeIcon},{key:'Training log',label:'Training log',Icon:CalendarDays},{key:'Sleep',label:'Sleep',Icon:Moon},{key:'Weather recon',label:'Weather recon',Icon:CloudSun}].map(({key,label,Icon})=><Button variant={tab===key?'secondary':'ghost'} size="sm" className="sieste-nav-item" key={key} onPointerEnter={()=>warmPage(key)} onFocus={()=>warmPage(key)} onPointerDown={()=>warmPage(key)} aria-label={label} title={label} aria-current={tab===key?'page':undefined}  onClick={()=>{setTab(key as 'Overview'|'Training log'|'Weather recon'|'Sleep');window.scrollTo({top:0,behavior:'instant'});setSyncVisible(true)}}><Icon data-icon="inline-start"/><small>{key==='Overview'?'Home':key==='Training log'?'Log':key==='Sleep'?'Sleep':'Weather'}</small></Button>)}</nav><LiveSyncContext.Provider value={liveSync}><div className="content"><main aria-busy={contentTab!==tab}>{contentTab!==tab&&<div className="v2-page-pending" role="status">Opening {tab==='Overview'?'Home':tab}…</div>}{cachedAt&&!isWeather&&<p className="device-cache-note" role="status">Saved dashboard · synced {new Date(data.syncedAt??cachedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>}{busy&&(manualSync||isDemo)&&<div className="sync-progress" role="status" aria-label={syncPhase}><i/><span className="sync-phase">{syncPhase}</span></div>}{notifications.notice&&<div className="activity-retrieved-notice" role="status"><span>{notifications.notice}</span><button aria-label="Dismiss retrieved data notification" onClick={notifications.dismiss}>×</button></div>}{removedWorkout&&<div className="workout-undo" role="status"><span>Workout removed from sieste.</span><button onClick={undoRemoval} disabled={undoBusy}>{undoBusy?'Restoring…':'Undo'}</button><button aria-label="Dismiss removal notice" onClick={()=>setRemovedWorkout(null)}>×</button>{undoError&&<span role="alert">{undoError}</span>}</div>}<section hidden={!isDemo||isWeather} className={isDemo?'connect-banner':'connect-banner connected'} aria-label="COROS connection"><Link2 size={22}/><div><strong>{isDemo?'Make this dashboard yours':'Connected to your COROS account'}</strong><p>{isDemo?'Connect COROS to use your own training and recovery data.':`Your saved data · last synced ${new Date(data.syncedAt!).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`}</p></div><button onClick={()=>{setError('');setModal(true)}}>{isDemo?'Connect COROS':'Manage connection'}<ArrowUpRight size={16}/></button></section>
{error&&!modal&&!isWeather&&<div role="alert" className="notice">{error}</div>}
<RetainedPage key={`home-${isDemo}-${connectionRevision}`} active={contentTab==='Overview'}><Today data={data} isDemo={isDemo} token={token} onSelect={setSelected}/></RetainedPage>
{!isWeather&&data.warnings?.filter(w=>!/^Some sessions have no duration\./i.test(w)).map(w=><div className="notice" key={w}>{w}</div>)}
<RetainedPage key={`sleep-${isDemo}-${connectionRevision}`} active={contentTab==='Sleep'}><FeatureBoundary><Suspense fallback={<LoadingState label="Loading sleep regularity…"/>}><SleepPage data={data} isDemo={isDemo}/></Suspense></FeatureBoundary></RetainedPage>
<RetainedPage updateHidden active={contentTab==='Weather recon'}><FeatureBoundary><Suspense fallback={<LoadingState label="Loading weather recon…"/>}><WeatherRecon active={isWeather} activities={data.activities}/></Suspense></FeatureBoundary></RetainedPage>
{(['Overview','Training log'] as const).map(page=><RetainedPage key={`${page}-${isDemo}-${connectionRevision}`} active={contentTab===page}>{page==='Overview'&&<DeferredPanel className="home-data-fold" summary={<><span><strong>Your data</strong><small>Insights, trends & account</small></span><ChevronDown aria-hidden="true"/></>}>{()=> <><HomeInsightsGrid data={data} setData={setData} token={token} isDemo={isDemo} syncing={busy||analyzing} onSelect={setSelected} onAccount={openAccount} coach={coach} connected={connected}/><CorosFitness data={data}/></>}</DeferredPanel>} {page==='Training log'&&<><FeatureBoundary><Suspense fallback={<LoadingState label="Loading training log…"/>}><TrainingLog data={data} isDemo={isDemo} token={token} onSelect={setSelected} onData={setData}/></Suspense></FeatureBoundary><Suspense fallback={<LoadingState compact label="Loading training tools…"/>}><WorkspaceTools page={page} data={data} setData={setData} token={token} isDemo={isDemo} syncing={busy||analyzing} onSelect={setSelected} onAccount={openAccount}/></Suspense></>}</RetainedPage>)}<footer><span>{!isDemo&&data.provider==='coros'?'COROS · ':''}<b>s</b> Sommeil, Intensité, Endurance, Suivi, Travail & Énergie</span><span>{isDemo?'Illustrative demo · connect your account to see your stats':`Last synced ${new Date(data.syncedAt!).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · Dashboard dates in your local time`}</span></footer></main></div></LiveSyncContext.Provider>
{modal&&<div className="overlay account-overlay" onClick={()=>closeAccount()}><section className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="connect-heading" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')closeAccount()}}><header className="account-modal-header"><div><h2 id="connect-heading">Your sieste account</h2><p>{account.signedIn?`Signed in as ${account.name}`:'Private to you · this device'}</p></div><Button variant="ghost" size="icon" aria-label="Close account settings" onClick={()=>closeAccount()}><X data-icon="inline-start"/></Button></header><div className="account-modal-content">{connectionMessage&&<p role="alert" className="error">{connectionMessage}</p>}{!account.signedIn?<div className="account-signin"><p>Sign in to save your connections, dashboard and measurements privately across visits.</p><a className="primary-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a>{error&&<p role="alert" className="error">{error}</p>}</div>:<><Suspense fallback={<LoadingState compact label="Loading COROS settings…"/>}><CorosConnection connected={corosConnected} active={!!data.extra?.coros} busy={busy} onDisconnect={disconnectCoros}/></Suspense><Suspense fallback={<p role="status">Loading Garmin connection…</p>}><GarminConnection busy={busy}/></Suspense>{corosConnected&&<p className="help">Tredict is the primary source for workouts, sleep, HRV and available body measurements. COROS fills missing readings and adds sleep timing, daily activity and fitness estimates.</p>}<details className="tredict-fallback"><summary>Tredict workouts</summary><label>Tredict personal token<input type="password" autoComplete="off" value={tokenDraft} onChange={e=>setTokenDraft(e.target.value)} placeholder="Paste token to connect workouts"/></label><button className="primary-button" disabled={busy||!tokenDraft.trim()} onClick={()=>sync(false,'tredict')}>Connect Tredict workouts</button><small>{data.provider==='tredict'?'Tredict workouts connected':'Without Tredict, workouts continue through COROS.'}</small></details>{error&&<p className="error" role="alert">{error}</p>}<Suspense fallback={<LoadingState compact label="Loading notification settings…"/>}><ActivityNotificationSettings notifications={notifications} connected={!isDemo&&!accountLoading&&!!deviceScope.current}/></Suspense><Suspense fallback={<p>Loading background sync…</p>}><BackgroundSyncSettings connected={!isDemo&&!accountLoading}/></Suspense><a className="docs-link" href="/signout-with-chatgpt?return_to=%2F" target="_top" onClick={signOut}>Sign out of sieste</a></>}</div></section></div>}
{selected&&createPortal(<div className="sieste-v3 activity-layer"><div className="overlay activity-card-stack" onClick={()=>setSelected(null)}><ActivityDailyPeek data={data} isDemo={isDemo}/><FeatureBoundary key={selected.id}><Suspense fallback={<WorkoutLoading onClose={()=>setSelected(null)}/>}><WorkoutDetails onClassify={(id,label)=>{setData(current=>({...current,activities:current.activities.map(a=>a.id===id?{...a,sessionLabel:label}:a)}));setSelected(current=>current?.id===id?{...current,sessionLabel:label}:current)}} cyclingContext={data.extra?.coros} healthData={data} storageScope={isDemo?'demo':deviceScope.current??''} onSelect={setSelected} activity={selected} history={data.activities} token={token} isDemo={isDemo} onClose={()=>setSelected(null)} onRemove={removeWorkout}/></Suspense></FeatureBoundary></div></div>,document.body)}
<AthenaChat key={`athena-${connectionRevision}-${isDemo}`} selectedId={selected?.id} screen={modal?"Account & connections":selected?"Activity":contentTab==='Overview'?"Home":contentTab} canChat={!isDemo&&account.signedIn}/></div></ExpansionProvider>}
