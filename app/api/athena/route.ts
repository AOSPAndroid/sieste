import {getChatGPTUser} from '../../chatgpt-auth';
import {storage,privateJson,sameOrigin,ownerPrefix} from '../../../db/storage';
import {athenaMessages,enqueueAthena,clearAthena} from '../../../db/athena-queue';
import {GET as snapshot} from '../sync/route';
import {athenaContext} from '../../athena-context';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in to chat with Athena.'},401);try{const owner=await ownerPrefix(user.userId),r=await athenaMessages(storage().db,storage().bucket,owner);return privateJson(r.body,r.status)}catch{return privateJson({error:'Chat is temporarily unavailable.'},503)}}
export async function POST(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site request rejected.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{
 if(!request.headers.get('content-type')?.includes('application/json'))return privateJson({error:'Expected JSON.'},415);
 const raw=await request.text();if(raw.length>5000)return privateJson({error:'Message too long.'},413);let b:any;try{b=JSON.parse(raw)}catch{return privateJson({error:'Invalid message.'},400)}
 if(!b||typeof b.message!=='string'||!b.message.trim()||b.message.length>2000||typeof b.thread!=='string'||!/^[-a-f0-9]{36}$/.test(b.thread)||typeof b.requestId!=='string'||!/^[-a-f0-9]{36}$/.test(b.requestId))return privateJson({error:'Invalid message.'},400);
 let zone='Europe/Paris';try{if(typeof b.timeZone==='string'){new Intl.DateTimeFormat('en',{timeZone:b.timeZone});zone=b.timeZone}}catch{}
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const snapshotHeaders=new Headers(request.headers);snapshotHeaders.set('Accept-Encoding','identity');snapshotHeaders.delete('If-None-Match');snapshotHeaders.delete('Content-Type');snapshotHeaders.delete('Content-Length');
 const snapshotRequest=new Request(new URL('/api/sync',request.url),{method:'GET',headers:snapshotHeaders});
 const saved:any=await (await snapshot(snapshotRequest)).json();if(!saved.data)return privateJson({error:'Connect and sync your training data first.'},409);
 const context=athenaContext(saved.data,day,typeof b.selectedId==='string'?b.selectedId:undefined,zone,b.message,b.compare===true);const screen=typeof b.screen==='string'?b.screen.replace(/[\x00-\x1f]/g,'').slice(0,180):'Unknown';const contextual={...context,currentScreen:screen,screenNote:'Screen label only; not a screenshot. Only use supplied metrics. Never assume access to credentials, screen contents or weather data.'};const owner=await ownerPrefix(user.userId),now=Date.now();
 const result=await enqueueAthena(storage().db,storage().bucket,{id:b.requestId,owner,thread:b.thread,message:b.message.trim(),context:contextual,scope:context.activitySelection.target?context.activitySelection.target.sport+' · '+context.activitySelection.target.date.slice(0,10):screen,created:now,status:'queued'});return privateJson(result.body,result.status);
 }catch{return privateJson({error:'Could not send your message. Please retry.'},503)}}
export async function DELETE(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site request rejected.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{const owner=await ownerPrefix(user.userId),r=await clearAthena(storage().db,storage().bucket,owner);return privateJson(r.body,r.status)}catch{return privateJson({error:'Could not clear chats.'},503)}}
