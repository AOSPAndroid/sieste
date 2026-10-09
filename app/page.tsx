"use client";
import {Button} from '@/components/ui/button';
import AthenaChat from './athena-chat';
import SiesteWordmark from './sieste-wordmark';
import {createPortal} from 'react-dom';

import {progressiveSync} from './progressive-sync';
import {useActivityNotifications} from './use-activity-notifications';
import ActivityNotificationSettings from './activity-notification-settings';
import {restoreDashboard} from './restore-dashboard';
import {clearDeviceSnapshot,writeDeviceSnapshot} from './device-snapshot-cache';
import {clearWorkoutCache} from './workout-detail-cache';
import {loadWorkoutView} from './activity-loader';
import {useScrollChrome} from './use-scroll-chrome';
const CorosHub=lazy(()=>import('./coros-hub'));
const BackgroundSyncSettings=lazy(()=>import('./background-sync-settings'));
import CorosFitness from './coros-fitness';
import {applyWorkoutExclusions} from './workout-exclusions';
import {useEffect,useState,useRef,lazy,Suspense,useDeferredValue,startTransition} from 'react';
import {Home as HomeIcon,CloudSun,ArrowUpRight,CalendarDays,Moon,Link2,RefreshCw,X,ShieldCheck} from 'lucide-react';
import type {Workout,AthleteData as Data} from './analytics';
import {DashboardLoading,LoadingState,WorkoutLoading,FeatureBoundary} from './loading-state';
import {useBackgroundAnalysis} from './background-analysis';
import ExpansionProvider from './expansion';
import Today from './today';
import HomeInsightsGrid from './home-insights-grid';
import ActivityDailyPeek from './activity-daily-peek';
const TrainingCoach=lazy(()=>import('./training-coach'));
import CorosConnection from './coros-connection';
const GarminConnection=lazy(()=>import('./garmin-connection'));
import RetainedPage from './retained-page';
const loadSleep=()=>import('./sleep-page'),loadWeather=()=>import('./weather-recon'),loadLog=()=>import('./training-log');
const SleepPage=lazy(loadSleep);
const WeatherRecon=lazy(loadWeather);
const WorkoutDetails=lazy(loadWorkoutView);
const TrainingLog=lazy(loadLog);
import WorkspaceTools from './workspace-tools';
const end=new Date('2026-09-17T12:00:00Z');
const tag=(d:Date)=>d.toISOString().slice(0,10).replaceAll('-','');
const demo:Data={activities:[],sleep:{},hrv:{},historyStart:'2024-09-18T00:00:00Z',historyComplete:true,syncedAt:end.toISOString()};
for(let i=729;i>=0;i--){const d=new Date(end);d.setUTCDate(d.getUTCDate()-i);demo.sleep[tag(d)]=[(7.1+[.8,.3,1.1,-.4,.5,1.3,.9][i%7])*3600,28800];demo.hrv[tag(d)]=[64+[8,3,12,-4,7,10,5][i%7],69];if(i%7!==3)demo.activities.push({id:'demo-'+i,date:d.toISOString(),sportType:i%3===0?'running':i%3===1?'cycling':'swimming',title:i%3===0?'Aerobic endurance run':i%3===1?'Threshold intervals':'Technique & aerobic swim',summary:{duration:(i%3===1?100:i%3===0?65:45)*60,distance:i%3===1?52000:i%3===0?13400:2600,heartrate:135+i%18,power:i%3===1?242:undefined}})}demo.activities.reverse();
// Clearly illustrative data for every advanced view; never derived from an athlete token.
demo.extra={efforts:{trainingEfforts:{}},bodyvalues:{bodyvalues:[]},capacity:{capacity:{running:[{timestamp:'2025-09-01T00:00:00Z',hrMax:190,hrLth:171,ftpa:260}],cycling:[{timestamp:'2025-09-01T00:00:00Z',ftp:285,hrMax:186,hrLth:165}]}},zones:{zones:{running:{heartrate:{'2025-09-01T00:00:00Z':[{name:'Aerobic',from:-1,to:145,intensity:0},{name:'Tempo',from:146,to:168,intensity:1},{name:'High intensity',from:169,to:-1,intensity:2}]}}}},equipmentList:{equipment:[{id:'demo-bike',name:'Race bike',type:'bikes',count:91,notes:'Illustrative equipment record'},{id:'demo-shoe',name:'Daily trainers',type:'shoes',count:104,notes:'Illustrative equipment record'}]},plannedTrainingList:{_embedded:{plannedWorkoutList:[{id:'demo-plan-1',date:'2026-09-18T07:00:00Z',sportType:'running',title:'Aerobic progression',duration:4200,notes:'Start easy, finish with 15 minutes at a controlled steady effort.'},{id:'demo-plan-2',date:'2026-09-19T08:00:00Z',sportType:'cycling',title:'Long endurance ride',duration:10800}]}}};
demo.sources=Object.fromEntries(Object.keys(demo.extra).map(k=>[k,{status:'synced'}]));
demo.activities.forEach((a,i)=>{a.analyzed=true;const s=a.summary!;a.hrHistogram={secondsByBpm:{125:s.duration*.45,140:s.duration*.3,155:s.duration*.15,170:s.duration*.08,185:s.duration*.02},validSeconds:s.duration,missingSeconds:0,sampleSeconds:5};s.heartrateMax=(s.heartrate??140)+22;s.calories=Math.round(s.duration/60*8);s.effort={heartrate:45+i%60};s.intensityDistribution={heartrate:{0:s.duration*.78,1:s.duration*.17,2:s.duration*.05}};s.zonesDistribution={heartrate:[s.duration*.78,s.duration*.17,s.duration*.05]};if(i%9===0){a.sportType='misc';a.subSportType='strength_training';a.title='Strength & conditioning';s.sets=14+i%8;s.aerobicTrainingEffect=1.2;s.anaerobicTrainingEffect=2.3;delete s.distance;delete s.power}else if(a.sportType==='running'){s.vo2max=57.2+Math.sin(i*.2)*2-i*.008;s.groundContactTime=214+i%13;s.flightTime=118+i%8;s.stepLength=110+i%12;s.cadence=176+i%9;s.runningEffectiveness=.99+i%4*.01;s.speedAerobicFactor=44+i%5;s.pace=280+i%30}s.powerMax=s.power?s.power+160:undefined;demo.extra!.efforts.trainingEfforts[tag(new Date(a.date))]=[[45+i%60]]});
for(let i=364;i>=0;i-=3){const d=new Date(end);d.setUTCDate(d.getUTCDate()-i);demo.extra.bodyvalues.bodyvalues.push({timestamp:d.toISOString(),weightInKilograms:72+Math.sin(i*.13)*.6,hrRestDynamic:46+i%7,bodyFatInPercent:11.5+i%4*.2})}
export default function Home(){
// Page chunks load on intent; avoid competing with account restore and initial charts.
const warmPage=(key:string)=>{const load=key==='Sleep'?loadSleep:key==='Weather recon'?loadWeather:key==='Training log'?loadLog:null;if(load)void load().catch(()=>{});};
const setSyncVisible=useScrollChrome();
const restored=useRef(false),syncAttempt=useRef(Date.now()),syncLock=useRef(false);
const restoreRevision=useRef(0),deviceScope=useRef<string|null>(null),lastPersisted=useRef<Data|null>(null);
const [cachedAt,setCachedAt]=useState<number|null>(null);
const [data,setData]=useState<Data>(demo),[isDemo,setIsDemo]=useState(true),[tab,setTab]=useState<'Overview'|'Training log'|'Weather recon'|'Sleep'>('Overview'),[modal,setModal]=useState(false),[token,setToken]=useState(''),[tokenDraft,setTokenDraft]=useState(''),[account,setAccount]=useState<{signedIn:boolean;name?:string}>({signedIn:false}),[accountLoading,setAccountLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<Workout|null>(null);
const contentTab=useDeferredValue(tab);
const [syncPhase,setSyncPhase]=useState('Syncing workouts…');
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
 await restoreDashboard({current,
  onAccount:state=>{if(!current())return;setAccount({signedIn:state.signedIn,name:state.name});setCorosConnected(state.corosConnected);setToken(state.connected?'__saved__':'');},
  onScope:scope=>{if(!current())return;if(deviceScope.current!==scope){clearWorkoutCache();setConnectionRevision(r=>r+1);lastPersisted.current=null;}deviceScope.current=scope;},
  onData:(snapshot,savedAt)=>{if(!current())return;lastPersisted.current=savedAt?snapshot:null;setCachedAt(savedAt);setData(snapshot??demo);setIsDemo(!snapshot);if(!snapshot)setSelected(null);},
  onReady:()=>{if(current())setAccountLoading(false)},
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
 const timer=window.setTimeout(()=>{if(deviceScope.current!==scope)return;void writeDeviceSnapshot(scope,data).then(saved=>{if(saved&&deviceScope.current===scope)lastPersisted.current=data})},800);
 return()=>window.clearTimeout(timer);
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
async function sync(automatic=false,provider?:'tredict'){if(busy||syncLock.current)return;if(!account.signedIn){setModal(true);return}const clean=automatic?'__saved__':tokenDraft.trim().replace(/^Bearer\s+/i,'')||(token==='__saved__'?'__saved__':'');if(!clean){setError('Connect COROS in your account settings.');setModal(true);return}if(/\s/.test(clean)){setError('The token contains spaces. Reconnect COROS.');setModal(true);return}const retrievalScope=deviceScope.current;syncLock.current=true;syncAttempt.current=Date.now();setBusy(true);setError('');try{if(!automatic&&tokenDraft.trim())await discardDeviceData();await progressiveSync({token:clean,provider,manual:!automatic},fresh=>{if(automatic||!tokenDraft.trim())void notifications.retrieved(retrievalScope,fresh).catch(()=>{});startTransition(()=>{setCachedAt(null);setData(fresh);setIsDemo(false)})},setSyncPhase);if(!automatic&&tokenDraft.trim()){setConnectionRevision(r=>r+1);await restoreAccount();}setToken('__saved__');if(!automatic)setTokenDraft('');setIsDemo(false);if(!automatic)closeAccount()}catch(e){setError(e instanceof Error?e.message:'Unable to sync.')}finally{syncLock.current=false;setBusy(false)}}
// Poll only while visible and online. A failed attempt also waits five minutes.
useEffect(()=>{
 if(accountLoading||!account.signedIn||isDemo||token!=='__saved__')return;
 const check=()=>{if(document.visibilityState!=='visible'||!navigator.onLine||busy||modal||selected||syncLock.current)return;const lastSuccess=Date.parse(data.syncedAt??'')||0;if(Date.now()-Math.max(lastSuccess,syncAttempt.current)>=(data.provider==='coros'&&(!data.extra?.coros?.history?.complete||!data.extra?.coros?.recoveryHistory?.complete)?75000:300000))void sync(true)};
 const timer=window.setInterval(check,30000);document.addEventListener('visibilitychange',check);window.addEventListener('online',check);check();
 return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('online',check)};
},[accountLoading,account.signedIn,isDemo,token,busy,modal,selected,data.syncedAt]);
useEffect(()=>{if(!modal||accountLoading)return;const previous=document.activeElement as HTMLElement;const dialog=document.querySelector<HTMLElement>('.account-modal');const focusables=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],select:not(:disabled),summary')??[]);dialog?.querySelector<HTMLButtonElement>('.account-modal-header button')?.focus({preventScroll:true});const handle=(e:KeyboardEvent)=>{if(document.querySelector('.athena-chat[open]'))return;if(e.key!=='Tab')return;const items=focusables(),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}};document.addEventListener('keydown',handle);return()=>{document.removeEventListener('keydown',handle);previous?.focus()}},[modal,selected,accountLoading]);
const analyzing=useBackgroundAnalysis({data,setData,token,isDemo,fullHistory:historyAnalysis,onError:setAnalysisError,enabled:!accountLoading&&!busy&&!modal&&!selected&&tab==='Overview'});
if(accountLoading)return <><DashboardLoading/><AthenaChat screen="Loading dashboard" canChat={false}/></>;
const isWeather=tab==='Weather recon';
return <ExpansionProvider data={data} isDemo={isDemo}><div data-activity-open={selected?true:undefined} className={tab==='Overview'?'shell dashboard-theme sieste-v2 sieste-v3 today-shell':'shell dashboard-theme sieste-v2 sieste-v3'}><header className="sieste-topbar"><button className="sieste-brand-home" aria-label="sieste home" onClick={()=>{setTab('Overview');window.scrollTo({top:0,behavior:'instant'})}}><strong><SiesteWordmark/></strong><span>Training & recovery</span></button><span className="v2-current-page">{tab==='Overview'?'Overview':tab==='Training log'?'Training':tab==='Weather recon'?'Ride outlook':'Sleep'}</span><Button variant="outline" size="icon" className="sieste-account" aria-label="Manage your account and connections" title="Account & connection" onClick={()=>setModal(true)}><ShieldCheck data-icon="inline-start"/></Button></header>
<Button variant="outline" size="icon-lg" className="floating-sync" hidden={modal||!!selected||isWeather}   onClick={()=>isDemo?setModal(true):sync()} disabled={busy} aria-label={busy?'Syncing your training':isDemo?'Connect COROS':'Sync now'} title={busy?syncPhase:isDemo?'Connect COROS':'Sync now'}><RefreshCw data-icon="inline-start" className={busy?'spinning':''}/></Button><nav className="mini-dock" aria-label="Quick navigation" hidden={modal||!!selected} >{[{key:'Overview',label:'Home',Icon:HomeIcon},{key:'Training log',label:'Training log',Icon:CalendarDays},{key:'Sleep',label:'Sleep',Icon:Moon},{key:'Weather recon',label:'Weather recon',Icon:CloudSun}].map(({key,label,Icon})=><Button variant={tab===key?'secondary':'ghost'} size="sm" className="sieste-nav-item" key={key} onPointerEnter={()=>warmPage(key)} onFocus={()=>warmPage(key)} onPointerDown={()=>warmPage(key)} aria-label={label} title={label} aria-current={tab===key?'page':undefined}  onClick={()=>{setTab(key as 'Overview'|'Training log'|'Weather recon'|'Sleep');window.scrollTo({top:0,behavior:'instant'});setSyncVisible(true)}}><Icon data-icon="inline-start"/><small>{key==='Overview'?'Home':key==='Training log'?'Log':key==='Sleep'?'Sleep':'Weather'}</small></Button>)}</nav><div className="content"><main aria-busy={contentTab!==tab}>{contentTab!==tab&&<div className="v2-page-pending" role="status">Opening {tab==='Overview'?'Home':tab}…</div>}{cachedAt&&!isWeather&&<p className="device-cache-note" role="status">Saved dashboard · synced {new Date(data.syncedAt??cachedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>}{busy&&<div className="sync-progress" role="status" aria-label={syncPhase}><i/><span className="sync-phase">{syncPhase}</span></div>}{notifications.notice&&<div className="activity-retrieved-notice" role="status"><span>{notifications.notice}</span><button aria-label="Dismiss retrieved data notification" onClick={notifications.dismiss}>×</button></div>}{removedWorkout&&<div className="workout-undo" role="status"><span>Workout removed from sieste.</span><button onClick={undoRemoval} disabled={undoBusy}>{undoBusy?'Restoring…':'Undo'}</button><button aria-label="Dismiss removal notice" onClick={()=>setRemovedWorkout(null)}>×</button>{undoError&&<span role="alert">{undoError}</span>}</div>}<section hidden={!isDemo||isWeather} className={isDemo?'connect-banner':'connect-banner connected'} aria-label="COROS connection"><Link2 size={22}/><div><strong>{isDemo?'Make this dashboard yours':'Connected to your COROS account'}</strong><p>{isDemo?'Connect COROS to use your own training and recovery data.':`Your saved data · last synced ${new Date(data.syncedAt!).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`}</p></div><button onClick={()=>{setError('');setModal(true)}}>{isDemo?'Connect COROS':'Manage connection'}<ArrowUpRight size={16}/></button></section>
{error&&!modal&&!isWeather&&<div role="alert" className="notice">{error}</div>}
<RetainedPage key={`home-${isDemo}-${connectionRevision}`} active={contentTab==='Overview'}><Today data={data} isDemo={isDemo} token={token} onSelect={setSelected}/></RetainedPage>
{!isWeather&&data.warnings?.filter(w=>!/^Some sessions have no duration\./i.test(w)).map(w=><div className="notice" key={w}>{w}</div>)}
<RetainedPage key={`sleep-${isDemo}-${connectionRevision}`} active={contentTab==='Sleep'}><FeatureBoundary><Suspense fallback={<LoadingState label="Loading sleep regularity…"/>}><SleepPage data={data} isDemo={isDemo}/></Suspense></FeatureBoundary></RetainedPage>
<RetainedPage updateHidden active={contentTab==='Weather recon'}><FeatureBoundary><Suspense fallback={<LoadingState label="Loading weather recon…"/>}><WeatherRecon active={isWeather}/></Suspense></FeatureBoundary></RetainedPage>
{(['Overview','Training log'] as const).map(page=><RetainedPage key={`${page}-${isDemo}-${connectionRevision}`} active={contentTab===page}>{page==='Training log'&&<WorkspaceTools page={page} data={data} setData={setData} token={token} isDemo={isDemo} syncing={busy||analyzing} onSelect={setSelected} onAccount={()=>setModal(true)}/>} {page==='Overview'&&<><HomeInsightsGrid data={data} setData={setData} token={token} isDemo={isDemo} syncing={busy||analyzing} onSelect={setSelected} onAccount={()=>setModal(true)} coach={<TrainingCoach analysisError={analysisError} data={data} now={isDemo?new Date('2026-09-17T23:59:59'):new Date()} onSelect={setSelected} isDemo={isDemo} analyzing={analyzing} historyAnalysis={historyAnalysis} onAnalyze={()=>setHistoryAnalysis(v=>!v)}/>} connected={<CorosHub data={data}/>}/><CorosFitness data={data}/></>} {page==='Training log'&&<FeatureBoundary><Suspense fallback={<LoadingState label="Loading training log…"/>}><TrainingLog data={data} isDemo={isDemo} token={token} onSelect={setSelected} onData={setData}/></Suspense></FeatureBoundary>}</RetainedPage>)}<footer><span>{!isDemo&&data.provider==='coros'?'COROS · ':''}<b>s</b> Sommeil, Intensité, Endurance, Suivi, Travail & Énergie</span><span>{isDemo?'Illustrative demo · connect your account to see your stats':`Last synced ${new Date(data.syncedAt!).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · Dashboard dates in your local time`}</span></footer></main></div>
{modal&&<div className="overlay account-overlay" onClick={()=>closeAccount()}><section className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="connect-heading" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')closeAccount()}}><header className="account-modal-header"><h2 id="connect-heading">Your sieste account</h2><Button variant="ghost" size="icon" aria-label="Close account settings" onClick={()=>closeAccount()}><X data-icon="inline-start"/></Button></header><div className="account-modal-content">{connectionMessage&&<p role="alert" className="error">{connectionMessage}</p>}{!account.signedIn?<div className="account-signin"><p>Sign in to save your connections, dashboard and measurements privately across visits.</p><a className="primary-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a>{error&&<p role="alert" className="error">{error}</p>}</div>:<><p>Signed in as {account.name}.</p><CorosConnection connected={corosConnected} active={!!data.extra?.coros} busy={busy} onDisconnect={disconnectCoros}/><Suspense fallback={<p role="status">Loading Garmin connection…</p>}><GarminConnection busy={busy}/></Suspense>{corosConnected&&<p className="help">Tredict is the primary source for workouts, sleep, HRV and available body measurements. COROS fills missing readings and adds sleep timing, daily activity and fitness estimates.</p>}<details className="tredict-fallback"><summary>Tredict workouts</summary><label>Tredict personal token<input type="password" autoComplete="off" value={tokenDraft} onChange={e=>setTokenDraft(e.target.value)} placeholder="Paste token to connect workouts"/></label><button className="primary-button" disabled={busy||!tokenDraft.trim()} onClick={()=>sync(false,'tredict')}>Connect Tredict workouts</button><small>{data.provider==='tredict'?'Tredict workouts connected':'Without Tredict, workouts continue through COROS.'}</small></details>{error&&<p className="error" role="alert">{error}</p>}<ActivityNotificationSettings notifications={notifications} connected={!isDemo&&!accountLoading&&!!deviceScope.current}/><Suspense fallback={<p>Loading background sync…</p>}><BackgroundSyncSettings connected={!isDemo&&!accountLoading}/></Suspense><a className="docs-link" href="/signout-with-chatgpt?return_to=%2F" target="_top" onClick={signOut}>Sign out of sieste</a></>}</div></section></div>}
{selected&&createPortal(<div className="sieste-v3 activity-layer"><div className="overlay activity-card-stack" onClick={()=>setSelected(null)}><ActivityDailyPeek data={data} isDemo={isDemo}/><FeatureBoundary key={selected.id}><Suspense fallback={<WorkoutLoading onClose={()=>setSelected(null)}/>}><WorkoutDetails onClassify={(id,label)=>{setData(current=>({...current,activities:current.activities.map(a=>a.id===id?{...a,sessionLabel:label}:a)}));setSelected(current=>current?.id===id?{...current,sessionLabel:label}:current)}} cyclingContext={data.extra?.coros} healthData={data} storageScope={isDemo?'demo':deviceScope.current??''} onSelect={setSelected} activity={selected} history={data.activities} token={token} isDemo={isDemo} onClose={()=>setSelected(null)} onRemove={removeWorkout}/></Suspense></FeatureBoundary></div></div>,document.body)}
<AthenaChat key={`athena-${connectionRevision}-${isDemo}`} selectedId={selected?.id} screen={modal?"Account & connections":selected?"Activity":contentTab==='Overview'?"Home":contentTab} canChat={!isDemo&&account.signedIn}/></div></ExpansionProvider>}
