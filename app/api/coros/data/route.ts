import {getChatGPTUser} from '../../../chatgpt-auth';
import {storage,ownerPrefix,privateJson} from '../../../../db/storage';
import {COROS_LIBRARY} from '../../../coros-extended-data';
export const dynamic='force-dynamic';
export async function GET(request:Request){const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);const name=new URL(request.url).searchParams.get('source');if(!name||!Object.hasOwn(COROS_LIBRARY,name))return privateJson({error:'Unknown data source.'},400);const object=await storage().bucket.get((await ownerPrefix(user.userId))+'coros-library/'+name+'.json');if(!object)return privateJson({error:'This source has not been imported yet.'},404);return privateJson(await object.json())}
