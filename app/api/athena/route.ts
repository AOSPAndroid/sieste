import {getChatGPTUser} from '../../chatgpt-auth';
import {storage,privateJson,sameOrigin,ownerPrefix} from '../../../db/storage';
import {updateQueue,visible,lifetime} from '../../../db/athena-queue';
import {GET as snapshot} from '../sync/route';
import {athenaContext} from '../../athena-context';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in to chat with Athena.'},401);try{const owner=await ownerPrefix(user.userId),r=await updateQueue(storage().bucket,q=>({body:{online:Date.now()-q.heartbeat<90000,model:q.model??null,messages:visible(q,owner)}}));return privateJson(r.body,r.status)}catch{return privateJson({error:'Chat is temporarily unavailable.'},503)}}
export async function POST(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site request rejected.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{
 if(!request.headers.get('content-type')?.includes('application/json'))return privateJson({error:'Expected JSON.'},415);
 const raw=await request.text();if(raw.length>5000)return privateJson({error:'Message too long.'},413);let b:any;try{b=JSON.parse(raw)}catch{return privateJson({error:'Invalid message.'},400)}
 if(!b||typeof b.message!=='string'||!b.message.trim()||b.message.length>2000||typeof b.thread!=='string'||!/^[-a-f0-9]{36}$/.test(b.thread)||typeof b.requestId!=='string'||!/^[-a-f0-9]{36}$/.test(b.requestId))return privateJson({error:'Invalid message.'},400);
 let zone='Europe/Paris';try{if(typeof b.timeZone==='string'){new Intl.DateTimeFormat('en',{timeZone:b.timeZone});zone=b.timeZone}}catch{}
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const saved:any=await (await snapshot()).json();if(!saved.data)return privateJson({error:'Connect and sync your training data first.'},409);
 const context=athenaContext(saved.data,day,typeof b.selectedId==='string'?b.selectedId:undefined,zone,b.message,b.compare===true),owner=await ownerPrefix(user.userId),now=Date.now();
 const result=await updateQueue(storage().bucket,q=>{if(q.jobs.some(j=>j.id===b.requestId&&j.owner===owner))return {body:{ok:true}};if(now-q.heartbeat>90000)return {status:503,body:{error:'Athena is offline. Keep your PC and Athena bridge running.'}};if(q.jobs.some(j=>j.owner===owner&&['queued','working'].includes(j.status)&&now-j.created<lifetime))return {status:409,body:{error:'Athena is answering your previous question.'}};if(q.jobs.filter(j=>j.owner===owner&&now-j.created<86400000).length>=40||q.jobs.filter(j=>now-j.created<86400000).length>=100)return {status:429,body:{error:'Daily chat limit reached. Try again tomorrow.'}};q.jobs.push({id:b.requestId,owner,thread:b.thread,message:b.message.trim(),context,created:now,status:'queued'});return {body:{ok:true}}});return privateJson(result.body,result.status);
 }catch{return privateJson({error:'Could not send your message. Please retry.'},503)}}
export async function DELETE(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site request rejected.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{const owner=await ownerPrefix(user.userId),r=await updateQueue(storage().bucket,q=>{q.jobs=q.jobs.filter(j=>j.owner!==owner);return {body:{ok:true}}});return privateJson(r.body,r.status)}catch{return privateJson({error:'Could not clear chats.'},503)}}
