import {storage} from './storage';
export async function dashboardVersion(owner:string){return (await storage().db.prepare('SELECT version FROM dashboard_revisions WHERE owner=?').bind(owner).first<{version:string}>())?.version??''}
export async function touchDashboard(owner:string){await storage().db.prepare('INSERT INTO dashboard_revisions(owner,version,updated_at) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET version=excluded.version,updated_at=excluded.updated_at').bind(owner,crypto.randomUUID(),new Date().toISOString()).run()}
export async function dashboardEtag(owner:string,training:any,coros:any){
 const revision=await dashboardVersion(owner);
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([owner,training?.revision,training?.snapshot_key,training?.updated_at,coros?.revision,coros?.snapshot_key,coros?.updated_at,revision])));
 return 'W/"'+Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')+'"';
}
