import {env} from 'cloudflare:workers';
import {privateJson} from '../../../../db/storage';
import {runDueSync,notificationJobs,delivered,deliveredBatch} from '../../../../db/background-sync';
import {runCorosBackfills} from '../../../../db/coros-backfill';
export const dynamic='force-dynamic';
export async function POST(request:Request){const secret=(env as unknown as {SYNC_BRIDGE_TOKEN?:string}).SYNC_BRIDGE_TOKEN;if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return privateJson({error:'Unauthorized'},401);
 try{const raw=await request.text();if(raw.length>4000)return privateJson({error:'Too large'},413);const b=JSON.parse(raw);
 if(b.op==='tick'){const result=await runDueSync(new URL(request.url).origin,4),backfills=await runCorosBackfills(2);return privateJson({ok:true,...result,backfills,notificationJobs:await notificationJobs()})}
 if(b.op==='delivered-many'&&Array.isArray(b.jobs)&&b.jobs.length>0&&b.jobs.length<=8&&b.jobs.every((job:any)=>typeof job?.id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(job.id)&&typeof job.claim==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(job.claim)&&Number.isInteger(job.statusCode)&&job.statusCode>=0&&job.statusCode<=599)){await deliveredBatch(b.jobs);return privateJson({ok:true})}
 if(b.op==='delivered'&&typeof b.id==='string'&&typeof b.claim==='string'&&Number.isInteger(b.statusCode)){await delivered(b.id,b.claim,b.statusCode);return privateJson({ok:true})}
 return privateJson({error:'Invalid operation'},400);
 }catch{return privateJson({error:'Background worker unavailable'},503)}}
