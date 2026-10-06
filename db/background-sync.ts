import {env} from 'cloudflare:workers';
import {storage,connection} from './storage';
import {seal,unseal} from './token-crypto';
import {corosConnection} from './coros';
import {corosSnapshot,syncCoros} from '../app/api/coros/sync';
import {syncStoredAccount} from '../app/api/sync/tredict-saved';
import {combineProviders} from '../app/provider-data';
import {syncFingerprint} from '../app/background-sync-policy';

type Settings={owner:string;enabled:number;time_zone:string;interval_minutes:number;next_run:number;lease:string|null;lease_until:number;last_completed:string|null;last_status:string|null;last_error:string|null;last_fingerprint:string|null};
export const pushKey=()=>(env as unknown as {SYNC_VAPID_PUBLIC_KEY?:string}).SYNC_VAPID_PUBLIC_KEY??'';
export async function endpointId(endpoint:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')}
export async function settings(owner:string){return storage().db.prepare('SELECT * FROM background_sync WHERE owner=?').bind(owner).first<Settings>()}
export async function status(owner:string){const {db}=storage(),row=await settings(owner),subscriptions=await db.prepare('SELECT id FROM sync_push_subscriptions WHERE owner=?').bind(owner).all<{id:string}>(),heartbeat=await db.prepare("SELECT updated_at FROM sync_worker_health WHERE id='pc'").first<{updated_at:number}>();return {enabled:!!row?.enabled,timeZone:row?.time_zone??'Europe/Paris',intervalMinutes:row?.interval_minutes??30,lastCompletedAt:row?.last_completed??null,lastStatus:row?.last_status??null,lastError:row?.last_error??null,nextRunAt:row?.enabled?new Date(row.next_run).toISOString():null,workerOnline:!!heartbeat&&Date.now()-heartbeat.updated_at<240000,publicKey:pushKey(),subscriptions:subscriptions.results.length,subscriptionIds:subscriptions.results.map(r=>r.id)}}
export async function setSettings(owner:string,payload:any){const {db,key}=storage(),prior=await settings(owner),enabled=payload.enabled===undefined?!!prior?.enabled:payload.enabled;
 if(typeof enabled!=='boolean')throw Error('Invalid background sync setting.');
 const interval=payload.intervalMinutes??prior?.interval_minutes??30;if(![15,30,60].includes(interval))throw Error('Choose a 15, 30 or 60 minute interval.');
 const zone=payload.timeZone??prior?.time_zone??'Europe/Paris';try{new Intl.DateTimeFormat('en-GB',{timeZone:zone}).format()}catch{throw Error('Invalid time zone.')}
 if(enabled&&(payload.enabled===true||!prior?.enabled)){const [t,c]=await Promise.all([connection(owner),corosConnection(owner)]);if(!t&&!c)throw Error('Connect Tredict or COROS before enabling background sync.');}
 await db.prepare('INSERT INTO background_sync(owner,enabled,time_zone,interval_minutes,next_run,lease_until) VALUES(?,?,?,?,?,0) ON CONFLICT(owner) DO UPDATE SET enabled=excluded.enabled,time_zone=excluded.time_zone,interval_minutes=excluded.interval_minutes,next_run=CASE WHEN background_sync.enabled=0 AND excluded.enabled=1 THEN excluded.next_run ELSE background_sync.next_run END').bind(owner,Number(enabled),zone,interval,Date.now()).run();
 if(payload.subscription){const id=await endpointId(payload.subscription.endpoint),existing=await db.prepare('SELECT COUNT(*) AS n FROM sync_push_subscriptions WHERE owner=?').bind(owner).first<{n:number}>();if((existing?.n??0)>=10&&!await db.prepare('SELECT id FROM sync_push_subscriptions WHERE owner=? AND id=?').bind(owner,id).first())throw Error('Remove an older notification device first.');const encrypted=await seal(JSON.stringify(payload.subscription),key,owner+':push');await db.prepare('INSERT INTO sync_push_subscriptions(owner,id,subscription) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET subscription=excluded.subscription').bind(owner,id,encrypted).run();}
 if(payload.removeEndpoint)await db.prepare('DELETE FROM sync_push_subscriptions WHERE owner=? AND id=?').bind(owner,await endpointId(payload.removeEndpoint)).run();
 if(!enabled)await db.prepare("DELETE FROM sync_notification_jobs WHERE owner=? AND payload NOT LIKE '%sieste-sync-test%'").bind(owner).run();
 if(payload.test===true)await queuePush(owner,{type:'sieste-sync-test',status:'completed',syncedAt:new Date().toISOString()},true);
 return status(owner);
}
export async function queuePush(owner:string,payload:any,test=false){const {db}=storage();const rows=await db.prepare('SELECT id FROM sync_push_subscriptions WHERE owner=?').bind(owner).all<{id:string}>();if(test&&!rows.results.length)throw Error('Enable notifications on a device first.');
 for(const row of rows.results){const sql=test?'INSERT INTO sync_notification_jobs(id,owner,subscription_id,payload,created_at,attempts,lease_until) VALUES(?,?,?,?,?,0,0)':'INSERT INTO sync_notification_jobs(id,owner,subscription_id,payload,created_at,attempts,lease_until) SELECT ?,?,?,?,?,0,0 WHERE EXISTS(SELECT 1 FROM background_sync WHERE owner=? AND enabled=1)';const args=[crypto.randomUUID(),owner,row.id,JSON.stringify(payload),Date.now(),...test?[]:[owner]];await db.prepare(sql).bind(...args).run();}
}
async function storedTraining(owner:string){const row=await connection(owner);if(!row)return null;const o=await storage().bucket.get(row.snapshot_key);return o?await o.json():null}
export async function runDueSync(origin:string){const {db}=storage(),now=Date.now();await db.prepare("INSERT INTO sync_worker_health(id,updated_at) VALUES('pc',?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at").bind(now).run();
 const claim=crypto.randomUUID();const row=await db.prepare('UPDATE background_sync SET lease=?,lease_until=? WHERE owner=(SELECT owner FROM background_sync WHERE enabled=1 AND next_run<=? AND lease_until<? ORDER BY next_run LIMIT 1) AND enabled=1 AND lease_until<? RETURNING *').bind(claim,now+600000,now,now,now).first<Settings>();
 if(!row)return {synced:false};
 let resultStatus='failed',fingerprint=row.last_fingerprint??'',error:string|null=null,fresh=false;
 try{
  const [trainingBefore,coros]=await Promise.all([storedTraining(row.owner),corosConnection(row.owner)]),healthBefore=coros?await corosSnapshot(coros):null,before=combineProviders(trainingBefore,healthBefore);
  // Keep the initial baseline even if provider data saves but notification enqueue fails.
  const baseline=row.last_fingerprint??syncFingerprint(before);
  if(row.last_fingerprint===null)await db.prepare('UPDATE background_sync SET last_fingerprint=? WHERE owner=? AND lease=? AND last_fingerprint IS NULL').bind(baseline,row.owner,claim).run();
  let training=trainingBefore,health=healthBefore;const warnings:string[]=[];
  if(trainingBefore){try{const r=await syncStoredAccount(row.owner,origin,row.time_zone);if(!r.ok)throw Error('Tredict could not refresh.');training=await r.json();fresh=r.headers.get('X-Sync-Refreshed')==='true';}catch{warnings.push('Tredict could not refresh; saved data remains.');}}
  if(coros){try{health=await syncCoros(coros,!!trainingBefore,{timeZone:row.time_zone,primary:training});const savedAt=Date.parse(health?.syncedAt??''),priorAt=Date.parse(healthBefore?.syncedAt??'');fresh=fresh||(Number.isFinite(savedAt)&&savedAt>(Number.isFinite(priorAt)?priorAt:0));}catch{warnings.push('COROS could not refresh; saved data remains.');}}
  const merged=combineProviders(training,health);if(!merged)throw Error('No connected provider could refresh.');
  const pending=(merged.warnings??[]).filter((s:string)=>/could not|unavailable|failed|not available/i.test(s));resultStatus=warnings.length||pending.length?'partial':fresh?'completed':'unchanged';error=warnings.length?warnings.join(' '):pending.length?'Some readings are not available from the provider yet.':null;fingerprint=syncFingerprint(merged);
  const changed=fingerprint!==baseline,syncedAt=new Date().toISOString(),writes:D1PreparedStatement[]=[];
  // Queue delivery and advance the fingerprint atomically. Every write is lease-scoped,
  // so disabling sync or a successor claim cancels this run's notification.
  if(fresh&&changed){const subscriptions=await db.prepare('SELECT id FROM sync_push_subscriptions WHERE owner=?').bind(row.owner).all<{id:string}>();const payload=JSON.stringify({type:'sieste-sync-completed',status:resultStatus==='partial'?'partial':'completed',syncedAt});for(const subscription of subscriptions.results)writes.push(db.prepare('INSERT INTO sync_notification_jobs(id,owner,subscription_id,payload,created_at,attempts,lease_until) SELECT ?,?,?,?,?,0,0 WHERE EXISTS(SELECT 1 FROM background_sync WHERE owner=? AND lease=? AND enabled=1) AND EXISTS(SELECT 1 FROM sync_push_subscriptions WHERE owner=? AND id=?)').bind(crypto.randomUUID(),row.owner,subscription.id,payload,Date.now(),row.owner,claim,row.owner,subscription.id));}
  writes.push(db.prepare('UPDATE background_sync SET last_completed=?,last_status=?,last_error=?,last_fingerprint=?,next_run=?,lease=NULL,lease_until=0 WHERE owner=? AND lease=? AND enabled=1').bind(syncedAt,resultStatus,error,fingerprint,Date.now()+row.interval_minutes*60000,row.owner,claim));
  await db.batch(writes);
 }catch{resultStatus='failed';error='Background sync could not finish. Check your provider connection.';await db.prepare('UPDATE background_sync SET last_status=?,last_error=?,next_run=?,lease=NULL,lease_until=0 WHERE owner=? AND lease=?').bind('failed',error,Date.now()+row.interval_minutes*60000,row.owner,claim).run();}
 await db.prepare('UPDATE background_sync SET lease=NULL,lease_until=0 WHERE owner=? AND lease=?').bind(row.owner,claim).run();
 return {synced:fresh,status:resultStatus};
}
export async function notificationJobs(){const {db,key}=storage(),now=Date.now();await db.prepare('DELETE FROM sync_notification_jobs WHERE created_at<? OR attempts>=4').bind(now-86400000).run();const rows=await db.prepare('SELECT j.*,s.subscription FROM sync_notification_jobs j JOIN sync_push_subscriptions s ON s.owner=j.owner AND s.id=j.subscription_id WHERE j.lease_until<? ORDER BY j.created_at LIMIT 8').bind(now).all<any>();const jobs=[];
 for(const row of rows.results){const claim=crypto.randomUUID(),r=await db.prepare('UPDATE sync_notification_jobs SET claim=?,lease_until=?,attempts=attempts+1 WHERE id=? AND lease_until<?').bind(claim,now+180000,row.id,now).run();if(!r.meta.changes)continue;try{jobs.push({id:row.id,claim,subscription:JSON.parse(await unseal(row.subscription,key,row.owner+':push')),payload:JSON.parse(row.payload)})}catch{await db.prepare('DELETE FROM sync_notification_jobs WHERE id=?').bind(row.id).run();}}
 return jobs;
}
export async function delivered(id:string,claim:string,statusCode:number){const {db}=storage();const row=await db.prepare('SELECT owner,subscription_id FROM sync_notification_jobs WHERE id=? AND claim=?').bind(id,claim).first<{owner:string;subscription_id:string}>();if(!row)return;
 if(statusCode===404||statusCode===410)await db.prepare('DELETE FROM sync_push_subscriptions WHERE owner=? AND id=?').bind(row.owner,row.subscription_id).run();
 if(statusCode>=200&&statusCode<300||statusCode===404||statusCode===410)await db.prepare('DELETE FROM sync_notification_jobs WHERE id=? AND claim=?').bind(id,claim).run();else await db.prepare('UPDATE sync_notification_jobs SET lease_until=? WHERE id=? AND claim=?').bind(Date.now()+300000,id,claim).run();
}
