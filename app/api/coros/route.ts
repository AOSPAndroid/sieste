import {getChatGPTUser} from '../../chatgpt-auth';
import {privateJson,sameOrigin,storage} from '../../../db/storage';
import {corosConnection} from '../../../db/coros';
export const dynamic='force-dynamic';
export async function DELETE(request:Request){if(!sameOrigin(request))return privateJson({error:'Cross-site request rejected.'},403);const user=await getChatGPTUser();if(!user)return privateJson({error:'Sign in first.'},401);try{const row=await corosConnection(user.userId);if(row)await storage().db.prepare('DELETE FROM coros_connections WHERE owner = ? AND revision = ?').bind(user.userId,row.revision).run();return privateJson({disconnected:true})}catch{return privateJson({error:'Could not disconnect COROS. Please retry.'},503)}}
