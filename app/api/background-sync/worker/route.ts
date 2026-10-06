import {env} from 'cloudflare:workers';
import {privateJson} from '../../../../db/storage';
import {runDueSync,notificationJobs,delivered} from '../../../../db/background-sync';
export const dynamic='force-dynamic';
export async function POST(request:Request){const secret=(env as unknown as {SYNC_BRIDGE_TOKEN?:string}).SYNC_BRIDGE_TOKEN;if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return privateJson({error:'Unauthorized'},401);
 try{const raw=await request.text();if(raw.length>1000)return privateJson({error:'Too large'},413);const b=JSON.parse(raw);
 if(b.op==='tick'){const result=await runDueSync(new URL(request.url).origin);return privateJson({ok:true,...result,notificationJobs:await notificationJobs()})}
 if(b.op==='delivered'&&typeof b.id==='string'&&typeof b.claim==='string'&&Number.isInteger(b.statusCode)){await delivered(b.id,b.claim,b.statusCode);return privateJson({ok:true})}
 return privateJson({error:'Invalid operation'},400);
 }catch{return privateJson({error:'Background worker unavailable'},503)}}
