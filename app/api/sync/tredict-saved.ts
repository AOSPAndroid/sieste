import {healthDay,hasDailyReading} from '../coros/refresh-policy';
import {mergeRecentSnapshot} from './recent-snapshot';
import {sessionLabels} from '../../session-intelligence-data';
import {analysisIdentity,analysisSignature,restoreAnalyses,saveAnalysis} from '../../../db/activity-analysis';
import {workoutExclusions,filteredSnapshot,setWorkoutExclusions} from '../../../db/workout-exclusions';
import {activityRecords,saveActivityRecords,removeActivityRecords} from '../../../db/activity-records';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '../../chatgpt-auth';
import {connection,storage,privateJson,sameOrigin,ownerPrefix,removeObjects} from '../../../db/storage';
import {seal,unseal} from '../../../db/token-crypto';
import {POST as tredict} from './tredict';
import {corosConnection} from '../../../db/coros';
import {savedSnapshot} from '../../../db/snapshot-data';
export const dynamic='force-dynamic';
export async function loadSavedTredictData(owner:string,savedRow?:Awaited<ReturnType<typeof connection>>){const row=savedRow===undefined?await connection(owner):savedRow;if(!row)return null;const {key}=storage();const [data,identity]=await Promise.all([savedSnapshot(owner,row.snapshot_key),unseal(row.token_ciphertext,key,owner).then(analysisIdentity)]);return data?filteredSnapshot(owner,await restoreAnalyses(owner,identity,data)):null;}
export async function GET(){const user=await getChatGPTUser();if(!user)return privateJson({signedIn:false,connected:false,signInUrl:chatGPTSignInPath('/')});try{const [row,coros]=await Promise.all([connection(user.userId),corosConnection(user.userId)]);return privateJson({signedIn:true,name:user.displayName,connected:!!row,corosConnected:!!coros,preferredProvider:'coros',activeProvider:row?'tredict':null,data:await loadSavedTredictData(user.userId,row),signOutUrl:chatGPTSignOutPath('/')})}catch{return privateJson({error:'Your saved account could not be loaded. Please retry.'},503)}}
export async function POST(request:Request){
 const signedIn=await getChatGPTUser();if(!signedIn)return privateJson({error:'Sign in first.'},401);return savedAccountPOST(request,signedIn.userId);
}
export async function syncStoredAccount(owner:string,origin:string,timeZone:string){return savedAccountPOST(new Request(origin+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify({action:'sync',timeZone})}),owner)}
async function savedAccountPOST(request:Request,owner:string){
 if(!sameOrigin(request))return privateJson({error:'Cross-site requests are not allowed.'},403);
 const user={userId:owner};
 if(!request.headers.get('content-type')?.includes('application/json'))return privateJson({error:'Expected JSON.'},415);
 const raw=await request.text();if(raw.length>10000)return privateJson({error:'Request too large.'},413);
 let payload:any;try{payload=JSON.parse(raw)}catch{return privateJson({error:'Invalid request.'},400)}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return privateJson({error:'Invalid request.'},400);
 const action=payload.action??'sync';if(!['sync','detail','preview','enrich','remove','restore','classify'].includes(action))return privateJson({error:'Invalid action.'},400);
 try{
  const previous=await connection(user.userId),{db,bucket,key}=storage(),prefix=await ownerPrefix(user.userId);
  if(action==='remove'||action==='restore'){
   if(!previous)return privateJson({error:'Connect your account first.'},409);
   const id=payload.id;if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(id))return privateJson({error:'Invalid workout.'},400);
   const [activity]=await activityRecords(user.userId,previous.snapshot_key,[id]);if(!activity)return privateJson({error:'Workout not found in your account.'},404);
   await setWorkoutExclusions(user.userId,[{id,date:activity.date}],action==='remove');
   return privateJson({excludedWorkouts:await workoutExclusions(user.userId)});
  }
  const supplied=typeof payload.token==='string'&&payload.token!=='__saved__'?payload.token.trim().replace(/^Bearer\s+/i,''):'';
  if(supplied&&action!=='sync')return privateJson({error:'Connect the account before loading workouts.'},400);
  if(!supplied&&!previous)return privateJson({error:'Connect your Tredict account first.'},409);
  const token=supplied||await unseal(previous!.token_ciphertext,key,user.userId);
  const identity=await analysisIdentity(token);
  const upstream=async(body:any)=>tredict(new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json','Origin':new URL(request.url).origin},body:JSON.stringify({...body,token})}));
  if(action==='sync'){
   if(!payload.manual&&!supplied&&previous&&Date.now()-Date.parse(previous.updated_at)<300000){const cached=await savedSnapshot(user.userId,previous.snapshot_key);if(cached)return privateJson(await filteredSnapshot(user.userId,await restoreAnalyses(user.userId,identity,cached)))}
   const prior:any=!supplied&&previous?await savedSnapshot(user.userId,previous.snapshot_key):null;
   const recentOnly=!!prior?.historyComplete&&Date.now()-Date.parse(prior.fullSyncedAt??'')<7*86400000;
   const today=healthDay(new Date(),typeof payload.timeZone==='string'?payload.timeZone:'UTC');
   const result=await upstream({recentOnly,skipSleep:hasDailyReading('querySleepData',today,prior?.sleep,prior?.hrv,[]),skipHrv:hasDailyReading('querySleepHrv',today,prior?.sleep,prior?.hrv,[])});if(!result.ok)return result;const fresh:any=await result.json();const data=recentOnly?mergeRecentSnapshot(prior,fresh):{...fresh,sleep:{...prior?.sleep,...fresh.sleep},hrv:{...prior?.hrv,...fresh.hrv},fullSyncedAt:fresh.syncedAt};const revision=crypto.randomUUID(),snapshotKey=prefix+revision+'/snapshot.json';
   await Promise.all([bucket.put(snapshotKey,JSON.stringify(data),{httpMetadata:{contentType:'application/json'}}),saveActivityRecords(user.userId,snapshotKey,data.activities)]);
   const encrypted=await seal(token,key,user.userId),updated=new Date().toISOString();
   const write=previous?await db.prepare('UPDATE athlete_connections SET revision = ?, token_ciphertext = ?, snapshot_key = ?, updated_at = ? WHERE owner = ? AND revision = ?').bind(revision,encrypted,snapshotKey,updated,user.userId,previous.revision).run():await db.prepare('INSERT INTO athlete_connections (owner,revision,token_ciphertext,snapshot_key,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(owner) DO NOTHING').bind(user.userId,revision,encrypted,snapshotKey,updated).run();
   if(!write.meta.changes){await Promise.all([bucket.delete(snapshotKey),removeActivityRecords(user.userId,snapshotKey)]);return privateJson({error:'Your connection changed during sync. Reload and try again.'},409)}
   // Clean up the previous generation only; another athlete or a newer sync is never touched.
   if(previous)try{await Promise.all([removeObjects(prefix+previous.revision+'/'),removeActivityRecords(user.userId,previous.snapshot_key)])}catch{/* Unreferenced old cache can be cleaned on account deletion. */}
   if(supplied&&previous){const oldIdentity=await analysisIdentity(await unseal(previous.token_ciphertext,key,user.userId));if(oldIdentity!==identity)await removeObjects(prefix+'workout-cache-v1/'+oldIdentity+'/')}
   if(supplied){await db.prepare("DELETE FROM athlete_analyses WHERE owner = ? AND identity NOT LIKE 'coros:%' AND identity != ?").bind(user.userId,identity).run();await db.prepare("DELETE FROM athlete_session_labels WHERE owner = ? AND identity NOT LIKE 'coros:%' AND identity != ?").bind(user.userId,identity).run();}
   const response=privateJson(await filteredSnapshot(user.userId,await restoreAnalyses(user.userId,identity,data)));response.headers.set('X-Sync-Refreshed','true');return response;
  }
  const ids=action!=='enrich'?[payload.id]:payload.ids;
  if(!Array.isArray(ids)||ids.length<1||ids.length>4||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(id)))return privateJson({error:'Invalid activity selection.'},400);
  const excluded=await workoutExclusions(user.userId);if(ids.some((id:string)=>excluded.some(e=>e.id===id)))return privateJson({error:'This workout was removed from sieste.'},404);
  const requested=await activityRecords(user.userId,previous!.snapshot_key,ids);
  if(requested.length!==ids.length||requested.some(a=>!a))return privateJson({error:'Workout not found in your account.'},404);
  const activities=new Map<string,any>(requested.map(a=>[a.id,a]));
  if(action==='classify'){
   if(payload.label!==null&&!sessionLabels.includes(payload.label))return privateJson({error:'Invalid session label.'},400);
   if(payload.label===null)await db.prepare('DELETE FROM athlete_session_labels WHERE owner = ? AND identity = ? AND activity_id = ?').bind(user.userId,identity,ids[0]).run();
   else {const result=await db.prepare('INSERT INTO athlete_session_labels (owner,identity,activity_id,label) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM athlete_connections WHERE owner = ? AND revision = ?) ON CONFLICT(owner,identity,activity_id) DO UPDATE SET label = excluded.label').bind(user.userId,identity,ids[0],payload.label,user.userId,previous!.revision).run();if(!result.meta.changes)return privateJson({error:'Connection changed. Please retry.'},409)}
   return privateJson({label:payload.label});
  }
  const labels=await db.prepare(`SELECT activity_id,label FROM athlete_session_labels WHERE owner = ? AND identity = ? AND activity_id IN (${ids.map(()=>'?').join(',')})`).bind(user.userId,identity,...ids).all<{activity_id:string;label:string}>();
  const labelMap=new Map(labels.results.map(r=>[r.activity_id,r.label]));
  const selected=await Promise.all(ids.map(async(id:string)=>{const cacheKey=prefix+'workout-cache-v1/'+identity+'/'+(action==='preview'?'preview-elevation-v1':action==='enrich'?'enrich-preview-v2':action)+'/'+id+'.json',signature=analysisSignature(activities.get(id));const cached=await bucket.get(cacheKey);if(cached){const entry:any=await cached.json();if(entry.signature===signature&&Date.now()-entry.savedAt<(['preview','detail'].includes(action)&&!entry.detail?.elevationPreview?60000:86400000)&&entry.detail)return {id,detail:entry.detail,cacheKey,signature,cached:true};}return {id,cacheKey,signature,cached:false,detail:null};}));
  const missing=selected.filter(item=>!item.cached);
  const fetched=action==='enrich'&&missing.length?[await upstream({action,ids:missing.map(item=>item.id)})]:await Promise.all(missing.map(item=>upstream({action,id:item.id})));
  for(const response of fetched)if(!response.ok)return response;
  const bodies:any[]=await Promise.all(fetched.map(response=>response.json()));const fresh=new Map<string,any>(bodies.flatMap(body=>body.details??[]).map(detail=>[detail.id,detail]));
  if(missing.some(item=>!fresh.has(item.id)))return privateJson({error:'Tredict returned incomplete workout data.'},502);
  if(missing.length){const current=await connection(user.userId);if(current?.revision!==previous!.revision)return privateJson({error:'Your connection changed. Reload the page.'},409);}
  const details=await Promise.all(selected.map(async item=>{if(item.cached)return action==='detail'?{...activities.get(item.id),...item.detail,id:item.id}:item.detail;const detail=action==='detail'?{...activities.get(item.id),...fresh.get(item.id),id:item.id}:fresh.get(item.id);await Promise.all([action!=='preview'?saveAnalysis(user.userId,identity,activities.get(item.id),detail,previous!.revision):Promise.resolve(),bucket.put(item.cacheKey,JSON.stringify({signature:item.signature,savedAt:Date.now(),detail}),{httpMetadata:{contentType:'application/json'}})]);return detail;}));
  return privateJson({details:details.map(d=>({...d,sessionLabel:labelMap.get(d.id)??null}))});
 }catch{return privateJson({error:'Your saved connection could not be used. Please retry or reconnect Tredict.'},503)}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site requests are not allowed.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{const row=await connection(user.userId);if(row){await storage().db.prepare('DELETE FROM athlete_connections WHERE owner = ? AND revision = ?').bind(user.userId,row.revision).run();await Promise.all([removeObjects((await ownerPrefix(user.userId))+row.revision+'/'),removeActivityRecords(user.userId,row.snapshot_key)]);await removeObjects((await ownerPrefix(user.userId))+'workout-cache-v1/')}await storage().db.prepare("DELETE FROM athlete_analyses WHERE owner = ? AND identity NOT LIKE 'coros:%'").bind(user.userId).run();await storage().db.prepare("DELETE FROM athlete_session_labels WHERE owner = ? AND identity NOT LIKE 'coros:%'").bind(user.userId).run();return privateJson({disconnected:true})}catch{return privateJson({error:'The saved connection could not be removed. Please retry.'},503)}}
