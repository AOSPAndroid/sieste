import * as tredict from './tredict-saved';
import {getChatGPTUser,chatGPTSignOutPath} from '../../chatgpt-auth';
import {privateJson,sameOrigin,connection} from '../../../db/storage';
import {corosConnection,CorosError} from '../../../db/coros';
import {corosSnapshot,syncCoros,corosAction} from '../coros/sync';
import {combineProviders} from '../../provider-data';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();if(!user)return privateJson({signedIn:false,connected:false,corosConnected:false,data:null});try{const [row,saved]=await Promise.all([corosConnection(user.userId),tredict.GET().then(async r=>await r.json() as any)]);const health=row?await corosSnapshot(row):null;return privateJson({signedIn:true,name:user.displayName,connected:!!row||!!saved.connected,corosConnected:!!row,preferredProvider:saved.connected?'tredict':'coros',data:combineProviders(saved.data,health),signOutUrl:chatGPTSignOutPath('/')})}catch{return privateJson({error:'Your saved dashboard could not be loaded. Please retry.'},503)}}
export async function POST(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site request rejected.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{if(!request.headers.get('content-type')?.includes('application/json'))return privateJson({error:'Expected JSON.'},415);const raw=await request.text();if(raw.length>10000)return privateJson({error:'Request too large.'},413);const payload=JSON.parse(raw);if(!payload||typeof payload!=='object'||Array.isArray(payload))return privateJson({error:'Invalid request.'},400);const action=payload.action??'sync';if(!['sync','detail','preview','enrich','remove','restore','classify'].includes(action))return privateJson({error:'Invalid action.'},400);const legacy=(body:any)=>tredict.POST(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body)}));const [row,workouts]=await Promise.all([corosConnection(user.userId),connection(user.userId)]);const supplied=typeof payload.token==='string'&&payload.token!=='__saved__'&&payload.token.trim();const hybrid=!!workouts||!!supplied;
if(action==='sync'){
 if(!hybrid){if(!row)return privateJson({error:'Connect COROS or Tredict in account settings.'},409);return privateJson(await syncCoros(row))}
 if(payload.phase==='workouts'||payload.phase==='health'){
  const started=performance.now();let training:any,health:any;
  if(payload.phase==='workouts'){
   const [r,h]=await Promise.all([legacy(payload),row?corosSnapshot(row):Promise.resolve(null)]);if(!r.ok)return r;training=await r.json();health=h;
  }else{
   const [r,h]=await Promise.all([tredict.GET(),row?syncCoros(row,true):Promise.resolve(null)]);if(!r.ok)return r;training=(await r.json() as any).data;health=h;
  }
  const response=privateJson(combineProviders(training,health));response.headers.set('Server-Timing',`${payload.phase};dur=${Math.round(performance.now()-started)}`);return response;
 }
 const results=await Promise.allSettled([legacy(payload),row?syncCoros(row,true):Promise.resolve(null)]);const workoutResult=results[0],healthResult=results[1];let training:any=null,health:any=null;const warnings:string[]=[];
 if(workoutResult.status==='fulfilled'&&workoutResult.value.ok)training=await workoutResult.value.json();else{if(supplied&&workoutResult.status==='fulfilled')return workoutResult.value;training=(await (await tredict.GET()).json() as any).data;warnings.push('Tredict workouts could not refresh. Check your Tredict token or subscription; saved workouts remain.')}
 if(healthResult.status==='fulfilled')health=healthResult.value;else{health=row?await corosSnapshot(row):null;warnings.push('COROS health could not refresh; saved readings remain.')}
 if(!training&&!health)return privateJson({error:warnings.join(' ')||'No provider returned data.'},502);const data=combineProviders(training,health);data.warnings=[...(data.warnings??[]),...warnings];return privateJson(data);
}
if(action==='enrich'){if(!Array.isArray(payload.ids)||payload.ids.length<1||payload.ids.length>4)return privateJson({error:'Invalid activities.'},400);const native=payload.ids.filter((id:any)=>typeof id==='string'&&id.startsWith('coros_')),other=payload.ids.filter((id:any)=>!native.includes(id));const details=[];if(native.length){if(!row)return privateJson({error:'Reconnect COROS.'},409);details.push(...(await corosAction(row,{...payload,ids:native})).details!)}if(other.length){const result=await legacy({...payload,ids:other});if(!result.ok)return result;details.push(...(await result.json() as any).details)}return privateJson({details})}
if(typeof payload.id==='string'&&payload.id.startsWith('coros_')){if(!row)return privateJson({error:'Reconnect COROS.'},409);return privateJson(await corosAction(row,payload))}return legacy(payload);
}catch(e){return privateJson({error:e instanceof Error?e.message:'Sync could not finish. Saved data remains.'},e instanceof CorosError?e.status:502)}}
export const DELETE=tredict.DELETE;
