import {env} from 'cloudflare:workers';
import {storage,privateJson} from '../../../../db/storage';
import {updateQueue} from '../../../../db/athena-queue';
export const dynamic='force-dynamic';
export async function POST(request:Request){const secret=(env as unknown as {ATHENA_BRIDGE_TOKEN?:string}).ATHENA_BRIDGE_TOKEN;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return privateJson({error:'Unauthorized'},401);
 try{const raw=await request.text();if(raw.length>14000)return privateJson({error:'Too large'},413);const b=JSON.parse(raw);if(!['claim','finish','heartbeat'].includes(b?.op))return privateJson({error:'Invalid operation'},400);
 const r=await updateQueue(storage().bucket,q=>{q.heartbeat=Date.now();if(typeof b.model==='string')q.model=b.model.slice(0,80);if(b.op==='claim'){const job=q.jobs.find(j=>j.status==='queued');if(!job)return {body:{ok:true,job:null}};job.status='working';job.claim=crypto.randomUUID();return {body:{ok:true,job:{id:job.id,claim:job.claim,message:job.message,context:job.context,history:q.jobs.filter(j=>j.owner===job.owner&&j.thread===job.thread&&j.status==='done'&&j.created<job.created).slice(-2).map(j=>({scope:j.scope,question:j.message.slice(0,500),answer:j.answer?.slice(0,1200)}))}}}}
 if(b.op==='finish'){const j=q.jobs.find(j=>j.id===b.id&&j.claim===b.claim&&j.status==='working');if(!j)return {status:409,body:{error:'Job expired or cancelled'}};if(typeof b.answer!=='string'||!b.answer.trim()||b.answer.length>10000)return {status:400,body:{error:'Invalid answer'}};j.answer=b.answer;j.status=b.failed?'failed':'done';j.model=q.model;delete j.context;delete j.claim}return {body:{ok:true}}});return privateJson(r.body,r.status);
 }catch{return privateJson({error:'Worker unavailable'},503)}}
