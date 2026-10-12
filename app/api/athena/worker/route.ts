import {env} from 'cloudflare:workers';
import {storage,privateJson} from '../../../../db/storage';
import {athenaWorker} from '../../../../db/athena-queue';
export const dynamic='force-dynamic';
export async function POST(request:Request){const secret=(env as unknown as {ATHENA_BRIDGE_TOKEN?:string}).ATHENA_BRIDGE_TOKEN;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return privateJson({error:'Unauthorized'},401);
 try{const raw=await request.text();if(raw.length>14000)return privateJson({error:'Too large'},413);const b=JSON.parse(raw);if(!['claim','finish','heartbeat'].includes(b?.op))return privateJson({error:'Invalid operation'},400);
 const r=await athenaWorker(storage().db,storage().bucket,b);return privateJson(r.body,r.status);
 }catch{return privateJson({error:'Worker unavailable'},503)}}
