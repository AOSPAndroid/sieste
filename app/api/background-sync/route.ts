import {getChatGPTUser} from '../../chatgpt-auth';
import {privateJson,sameOrigin} from '../../../db/storage';
import {status,setSettings} from '../../../db/background-sync';
import {allowedPushEndpoint,validPushSubscription} from '../../background-sync-policy';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{return privateJson(await status(user.userId))}catch{return privateJson({error:'Background sync settings are unavailable.'},503)}}
export async function POST(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site request rejected.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{const raw=await request.text();if(raw.length>6000)return privateJson({error:'Request too large.'},413);const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b)||b.subscription&&!validPushSubscription(b.subscription)||b.removeEndpoint&&!allowedPushEndpoint(b.removeEndpoint))return privateJson({error:'Invalid notification settings.'},400);return privateJson(await setSettings(user.userId,b))}catch(e){return privateJson({error:e instanceof Error?e.message:'Settings could not be saved.'},400)}}
