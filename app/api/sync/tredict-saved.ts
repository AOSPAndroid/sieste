import {sessionLabels} from '../../session-intelligence-data';
import {analysisIdentity,analysisSignature,restoreAnalyses,saveAnalysis} from '../../../db/activity-analysis';
import {workoutExclusions,filteredSnapshot} from '../../../db/workout-exclusions';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from '../../chatgpt-auth';
import {connection,storage,privateJson,sameOrigin,ownerPrefix,removeObjects} from '../../../db/storage';
import {seal,unseal} from '../../../db/token-crypto';
import {POST as tredict} from './tredict';
import {corosConnection} from '../../../db/coros';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();if(!user)return privateJson({signedIn:false,connected:false,signInUrl:chatGPTSignInPath('/')});try{const row=await connection(user.userId);const coros=await corosConnection(user.userId);const object=row?await storage().bucket.get(row.snapshot_key):null;return privateJson({signedIn:true,name:user.displayName,connected:!!row,corosConnected:!!coros,preferredProvider:'coros',activeProvider:row?'tredict':null,data:object?await filteredSnapshot(user.userId,await restoreAnalyses(user.userId,await analysisIdentity(await unseal(row!.token_ciphertext,storage().key,user.userId)),await object.json())):null,signOutUrl:chatGPTSignOutPath('/')})}catch{return privateJson({error:'Your saved account could not be loaded. Please retry.'},503)}}
export async function POST(request:Request){
 if(!sameOrigin(request))return privateJson({error:'Cross-site requests are not allowed.'},403);
 const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in with ChatGPT to save your own Tredict connection.'},401);
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
   const snapshot=await bucket.get(previous.snapshot_key),data:any=snapshot?await snapshot.json():null;
   const activity=data?.activities?.find((a:any)=>a.id===id);if(!activity)return privateJson({error:'Workout not found in your account.'},404);
   const objectKey=prefix+'excluded/'+id+'.json';
   if(action==='remove')await bucket.put(objectKey,JSON.stringify({id,date:activity.date}),{customMetadata:{date:activity.date},httpMetadata:{contentType:'application/json'}});
   else await bucket.delete(objectKey);
   return privateJson({excludedWorkouts:await workoutExclusions(user.userId)});
  }
  const supplied=typeof payload.token==='string'&&payload.token!=='__saved__'?payload.token.trim().replace(/^Bearer\s+/i,''):'';
  if(supplied&&action!=='sync')return privateJson({error:'Connect the account before loading workouts.'},400);
  if(!supplied&&!previous)return privateJson({error:'Connect your Tredict account first.'},409);
  const token=supplied||await unseal(previous!.token_ciphertext,key,user.userId);
  const identity=await analysisIdentity(token);
  const upstream=async(body:any)=>tredict(new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json','Origin':new URL(request.url).origin},body:JSON.stringify({...body,token})}));
  if(action==='sync'){
   if(!supplied&&previous&&Date.now()-Date.parse(previous.updated_at)<300000){const cached=await bucket.get(previous.snapshot_key);if(cached)return privateJson(await filteredSnapshot(user.userId,await restoreAnalyses(user.userId,identity,await cached.json())))}
   const result=await upstream({});if(!result.ok)return result;const data=await result.json();const revision=crypto.randomUUID(),snapshotKey=prefix+revision+'/snapshot.json';
   await bucket.put(snapshotKey,JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});
   const encrypted=await seal(token,key,user.userId),updated=new Date().toISOString();
   const write=previous?await db.prepare('UPDATE athlete_connections SET revision = ?, token_ciphertext = ?, snapshot_key = ?, updated_at = ? WHERE owner = ? AND revision = ?').bind(revision,encrypted,snapshotKey,updated,user.userId,previous.revision).run():await db.prepare('INSERT INTO athlete_connections (owner,revision,token_ciphertext,snapshot_key,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(owner) DO NOTHING').bind(user.userId,revision,encrypted,snapshotKey,updated).run();
   if(!write.meta.changes){await bucket.delete(snapshotKey);return privateJson({error:'Your connection changed during sync. Reload and try again.'},409)}
   // Clean up the previous generation only; another athlete or a newer sync is never touched.
   if(previous)try{await removeObjects(prefix+previous.revision+'/')}catch{/* Unreferenced old cache can be cleaned on account deletion. */}
   if(supplied&&previous){const oldIdentity=await analysisIdentity(await unseal(previous.token_ciphertext,key,user.userId));if(oldIdentity!==identity)await removeObjects(prefix+'workout-cache-v1/'+oldIdentity+'/')}
   if(supplied){await db.prepare("DELETE FROM athlete_analyses WHERE owner = ? AND identity NOT LIKE 'coros:%' AND identity != ?").bind(user.userId,identity).run();await db.prepare("DELETE FROM athlete_session_labels WHERE owner = ? AND identity NOT LIKE 'coros:%' AND identity != ?").bind(user.userId,identity).run();}
   return privateJson(await filteredSnapshot(user.userId,await restoreAnalyses(user.userId,identity,data)));
  }
  const ids=action!=='enrich'?[payload.id]:payload.ids;
  if(!Array.isArray(ids)||ids.length<1||ids.length>4||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(id)))return privateJson({error:'Invalid activity selection.'},400);
  const excluded=await workoutExclusions(user.userId);if(ids.some((id:string)=>excluded.some(e=>e.id===id)))return privateJson({error:'This workout was removed from sieste.'},404);
  const snapshot=await bucket.get(previous!.snapshot_key),snapshotData:any=snapshot?await snapshot.json():null;
  const activities=new Map<string,any>((snapshotData?.activities??[]).map((a:any)=>[a.id,a]));
  if(ids.some((id:string)=>!activities.has(id)))return privateJson({error:'Workout not found in your account.'},404);
  if(action==='classify'){
   if(payload.label!==null&&!sessionLabels.includes(payload.label))return privateJson({error:'Invalid session label.'},400);
   if(payload.label===null)await db.prepare('DELETE FROM athlete_session_labels WHERE owner = ? AND identity = ? AND activity_id = ?').bind(user.userId,identity,ids[0]).run();
   else {const result=await db.prepare('INSERT INTO athlete_session_labels (owner,identity,activity_id,label) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM athlete_connections WHERE owner = ? AND revision = ?) ON CONFLICT(owner,identity,activity_id) DO UPDATE SET label = excluded.label').bind(user.userId,identity,ids[0],payload.label,user.userId,previous!.revision).run();if(!result.meta.changes)return privateJson({error:'Connection changed. Please retry.'},409)}
   return privateJson({label:payload.label});
  }
  const labels=await db.prepare('SELECT activity_id,label FROM athlete_session_labels WHERE owner = ? AND identity = ?').bind(user.userId,identity).all<{activity_id:string;label:string}>();
  const labelMap=new Map(labels.results.map(r=>[r.activity_id,r.label]));
  const details:any[]=[];
  for(const id of ids){const cacheKey=prefix+'workout-cache-v1/'+identity+'/'+action+'/'+id+'.json',signature=analysisSignature(activities.get(id));const cached=await bucket.get(cacheKey);if(cached){const entry:any=await cached.json();if(entry.signature===signature&&Date.now()-entry.savedAt<86400000&&entry.detail){details.push(entry.detail);continue}}

   const result=await upstream(action!=='enrich'?{action,id}:{action,ids:[id]});if(!result.ok)return result;const body:any=await result.json();const detail=body.details?.[0];if(!detail)return privateJson({error:'Tredict returned incomplete workout data.'},502);
   const current=await connection(user.userId);if(current?.revision!==previous!.revision)return privateJson({error:'Your connection changed. Reload the page.'},409);
   if(action!=='preview')await saveAnalysis(user.userId,identity,activities.get(id),detail,previous!.revision);
   await bucket.put(cacheKey,JSON.stringify({signature,savedAt:Date.now(),detail}),{httpMetadata:{contentType:'application/json'}});details.push(detail);
  }
  return privateJson({details:details.map(d=>({...d,sessionLabel:labelMap.get(d.id)??null}))});
 }catch{return privateJson({error:'Your saved connection could not be used. Please retry or reconnect Tredict.'},503)}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site requests are not allowed.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{const row=await connection(user.userId);if(row){await storage().db.prepare('DELETE FROM athlete_connections WHERE owner = ? AND revision = ?').bind(user.userId,row.revision).run();await removeObjects((await ownerPrefix(user.userId))+row.revision+'/');await removeObjects((await ownerPrefix(user.userId))+'workout-cache-v1/')}await storage().db.prepare("DELETE FROM athlete_analyses WHERE owner = ? AND identity NOT LIKE 'coros:%'").bind(user.userId).run();await storage().db.prepare("DELETE FROM athlete_session_labels WHERE owner = ? AND identity NOT LIKE 'coros:%'").bind(user.userId).run();return privateJson({disconnected:true})}catch{return privateJson({error:'The saved connection could not be removed. Please retry.'},503)}}
