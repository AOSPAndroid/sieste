import {activityMerges,saveActivityMerge,undoActivityMerge} from '../../../db/activity-merges';
import {applyMerges,validateMerge,mergeDetails} from '../../activity-merge-data';
import * as tredict from './tredict-saved';
import {getChatGPTUser,chatGPTSignOutPath} from '../../chatgpt-auth';
import {privateJson,sameOrigin,connection} from '../../../db/storage';
import {corosConnection,CorosError} from '../../../db/coros';
import {corosSnapshot,syncCoros,corosAction} from '../coros/sync';
import {combineProviders} from '../../provider-data';
import {dashboardEtag,touchDashboard} from '../../../db/dashboard-revision';
import {selectedActivityRecords} from '../../../db/activity-records';
import {requestPool} from '../request-pool';
import {createSyncDelta} from '../../sync-delta';
import {dashboardHeaders,dashboardJson,matchesDashboardEtag} from './response';
export const dynamic='force-dynamic';
async function savedDashboard(user:NonNullable<Awaited<ReturnType<typeof getChatGPTUser>>>,workouts:Awaited<ReturnType<typeof connection>>,row:Awaited<ReturnType<typeof corosConnection>>){
 const [training,health]=await Promise.all([tredict.loadSavedTredictData(user.userId,workouts),row?corosSnapshot(row):Promise.resolve(null)]);
 return {signedIn:true,userId:user.userId,name:user.displayName,connected:!!row||!!workouts,corosConnected:!!row,preferredProvider:workouts?'tredict':'coros',data:combineProviders(training,health),signOutUrl:chatGPTSignOutPath('/')};
}
async function providerPOST(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site request rejected.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{if(!request.headers.get('content-type')?.includes('application/json'))return privateJson({error:'Expected JSON.'},415);const raw=await request.text();if(raw.length>10000)return privateJson({error:'Request too large.'},413);const payload=JSON.parse(raw);if(!payload||typeof payload!=='object'||Array.isArray(payload))return privateJson({error:'Invalid request.'},400);const action=payload.action??'sync';if(!['sync','detail','preview','enrich','remove','restore','classify'].includes(action))return privateJson({error:'Invalid action.'},400);const legacy=(body:any)=>tredict.POST(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body)}));const [row,workouts]=await Promise.all([corosConnection(user.userId),connection(user.userId)]);const supplied=typeof payload.token==='string'&&payload.token!=='__saved__'&&payload.token.trim();const hybrid=!!workouts||!!supplied;
if(action==='sync'){
 const options={manual:payload.manual===true,timeZone:typeof payload.timeZone==='string'?payload.timeZone:'UTC'};
 if(!hybrid){if(!row)return privateJson({error:'Connect COROS or Tredict in account settings.'},409);return privateJson(await syncCoros(row,false,options))}
 if(payload.phase==='workouts'||payload.phase==='health'){
  const started=performance.now();let training:any,health:any;
  if(payload.phase==='workouts'){
   const [r,h]=await Promise.all([legacy(payload),row?corosSnapshot(row):Promise.resolve(null)]);if(!r.ok){if(!row||supplied)return r;return privateJson({...await r.json() as any,canSyncHealth:true},r.status)}training=await r.json();health=h;
  }else{
   training=await tredict.loadSavedTredictData(user.userId,workouts);health=row?await syncCoros(row,true,{...options,primary:training}):null;
  }
  const response=privateJson(combineProviders(training,health));response.headers.set('Server-Timing',`${payload.phase};dur=${Math.round(performance.now()-started)}`);return response;
 }
 const results=await Promise.allSettled([legacy(payload),row?syncCoros(row,true,options):Promise.resolve(null)]);const workoutResult=results[0],healthResult=results[1];let training:any=null,health:any=null;const warnings:string[]=[];
 if(workoutResult.status==='fulfilled'&&workoutResult.value.ok)training=await workoutResult.value.json();else{if(supplied&&workoutResult.status==='fulfilled')return workoutResult.value;training=await tredict.loadSavedTredictData(user.userId,workouts);warnings.push('Tredict workouts could not refresh. Check your Tredict token or subscription; saved workouts remain.')}
 if(healthResult.status==='fulfilled')health=healthResult.value;else{health=row?await corosSnapshot(row):null;warnings.push('COROS health could not refresh; saved readings remain.')}
 if(!training&&!health)return privateJson({error:warnings.join(' ')||'No provider returned data.'},502);const data=combineProviders(training,health);data.warnings=[...(data.warnings??[]),...warnings];return privateJson(data);
}
if(action==='enrich'){if(!Array.isArray(payload.ids)||payload.ids.length<1||payload.ids.length>4)return privateJson({error:'Invalid activities.'},400);const native=payload.ids.filter((id:any)=>typeof id==='string'&&id.startsWith('coros_')),other=payload.ids.filter((id:any)=>!native.includes(id));const details=[];if(native.length){if(!row)return privateJson({error:'Reconnect COROS.'},409);details.push(...(await corosAction(row,{...payload,ids:native})).details!)}if(other.length){const result=await legacy({...payload,ids:other});if(!result.ok)return result;details.push(...(await result.json() as any).details)}return privateJson({details})}
if(typeof payload.id==='string'&&payload.id.startsWith('coros_')){if(!row)return privateJson({error:'Reconnect COROS.'},409);return privateJson(await corosAction(row,payload))}return legacy(payload);
}catch(e){return privateJson({error:e instanceof Error?e.message:'Sync could not finish. Saved data remains.'},e instanceof CorosError?e.status:502)}}
export const DELETE=tredict.DELETE;

// Apply saved groups only at the API boundary. Provider snapshots remain intact.
export async function GET(request:Request){try{
 const user=await getChatGPTUser();if(!user)return privateJson({signedIn:false,connected:false,corosConnected:false,data:null});
 const [workouts,row]=await Promise.all([connection(user.userId),corosConnection(user.userId)]),etag=await dashboardEtag(user.userId,workouts,row);
 const headers=dashboardHeaders({'ETag':etag,'Cache-Control':'private, no-cache','X-Sieste-User':user.userId});
 if(matchesDashboardEtag(request.headers.get('If-None-Match'),etag))return new Response(null,{status:304,headers});
 if(new URL(request.url).searchParams.get('changed')==='1')return dashboardJson({signedIn:true,userId:user.userId,connected:!!workouts||!!row,corosConnected:!!row,revision:etag},request,headers);
 const body=await savedDashboard(user,workouts,row);
 if(body.data)body.data=applyMerges(body.data,await activityMerges(user.userId));
 return dashboardJson(body,request,headers);
 }catch{return privateJson({error:'Your saved dashboard could not load. Please retry.'},503)}}
export async function POST(request:Request){
 if(!sameOrigin(request))return privateJson({error:'Cross-site request rejected.'},403);
 const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);
 try{
  if(!request.headers.get('content-type')?.includes('application/json'))return privateJson({error:'Expected JSON.'},415);
  const text=await request.clone().text();if(text.length>10000)return privateJson({error:'Request too large.'},413);
  let payload:any;try{payload=JSON.parse(text)}catch{return privateJson({error:'Invalid request.'},400)}if(!payload||typeof payload!=='object'||Array.isArray(payload))return privateJson({error:'Invalid request.'},400);const action=payload.action??'sync';
  const groups=await activityMerges(user.userId);
  const connections=()=>Promise.all([connection(user.userId),corosConnection(user.userId)]);
  const rawData=async()=>{const [workouts,row]=await connections();return (await savedDashboard(user,workouts,row)).data};
  let baseline:any=null;
  if(action==='sync'&&typeof payload.sinceRevision==='string'&&typeof payload.sinceSyncedAt==='string'){
   const [workouts,row]=await connections();
   if(payload.sinceRevision===await dashboardEtag(user.userId,workouts,row)){
    const data=(await savedDashboard(user,workouts,row)).data,saved=data?applyMerges(data,groups):null;
    if(saved?.syncedAt===payload.sinceSyncedAt)baseline=saved;
   }
  }
  const reply=async(data:any,source?:Response)=>{
   if(['detail','enrich','remove','restore','classify','merge','unmerge'].includes(action))await touchDashboard(user.userId);
   const response=dashboardJson(baseline&&data?.activities?createSyncDelta(baseline,data):data,request);
   if(data?.activities){const [workouts,row]=await connections();response.headers.set('ETag',await dashboardEtag(user.userId,workouts,row))}
   for(const key of ['Server-Timing','X-Sync-Refreshed']){const value=source?.headers.get(key);if(value)response.headers.set(key,value)}
   return response;
  };
  if(action==='merge'||action==='unmerge'){
   const data=await rawData();if(!data)return privateJson({error:'Sync activities first.'},409);
   if(action==='unmerge'){if(typeof payload.id!=='string'||!groups.some(g=>g.id===payload.id))return privateJson({error:'Merged activity not found.'},404);await undoActivityMerge(user.userId,payload.id);}
   else {
    if(!Array.isArray(payload.ids)||payload.ids.length<2||payload.ids.length>10||payload.ids.some((id:any)=>typeof id!=='string'))return privateJson({error:'Choose 2–10 activities.'},400);
    const parts=payload.ids.map((id:string)=>data.activities.find((a:any)=>a.id===id));if(parts.some((a:any)=>!a))return privateJson({error:'Activity not found in your account.'},404);
    if(groups.some(g=>g.ids.some(id=>payload.ids.includes(id))))return privateJson({error:'Undo the existing merge before merging these activities again.'},409);
    const timeZone=typeof payload.timeZone==='string'?payload.timeZone:'UTC';try{validateMerge(parts,timeZone)}catch(e){return privateJson({error:(e as Error).message},400)}
    await saveActivityMerge(user.userId,{id:'merged_'+crypto.randomUUID(),ids:payload.ids,timeZone});
   }
   return reply(applyMerges(data,await activityMerges(user.userId)));
  }
  const group=groups.find(g=>g.id===payload.id);
  if(group){
   if(!['detail','preview'].includes(action))return privateJson({error:'Undo this merge in the training log before editing individual recordings.'},400);
   const [workouts,row]=await connections(),parts=await selectedActivityRecords(user.userId,group.ids,{tredict:workouts?.snapshot_key,coros:row?.snapshot_key});if(parts.some(a=>!a))return privateJson({error:'An original recording is unavailable. Undo the merge in the training log.'},409);
   const pool=requestPool(4),results=await Promise.all(parts.map(part=>pool(async()=>{const r=await providerPOST(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({...payload,action,id:part!.id})}));return {response:r,body:await r.json() as any,part}})));
   const failed=results.find(result=>!result.response.ok);if(failed)return privateJson(failed.body,failed.response.status);
   if(action==='detail')await touchDashboard(user.userId);
   return dashboardJson({details:[mergeDetails(results.map(result=>({...result.part,...result.body.details[0]})),group.id)]},request);
  }
  if(action==='enrich'&&Array.isArray(payload.ids)&&payload.ids.some((id:string)=>id.startsWith('merged_')))return privateJson({details:[]});
  const response=await providerPOST(request);if(!response.ok)return response;
  const body:any=await response.json();return reply(body.activities?applyMerges(body,groups):body,response);
 }catch{return privateJson({error:'Could not save or load the merge. Your original recordings are unchanged. Please retry.'},503)}
}
