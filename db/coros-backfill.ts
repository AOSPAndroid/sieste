import {storage,connection} from './storage';
import {corosConnection,type CorosConnection} from './coros';
import {savedSnapshot} from './snapshot-data';
export async function scheduleCorosBackfill(row:CorosConnection,data:any,timeZone='UTC',recoveryOnly=false){
 const {db}=storage();const pending=(!recoveryOnly&&data?.extra?.coros?.history?.complete===false)||data?.extra?.coros?.recoveryHistory?.complete===false;
 if(!pending){await db.prepare('DELETE FROM coros_backfill_jobs WHERE owner=? AND revision=?').bind(row.owner,row.revision).run();return;}
 await db.prepare('INSERT INTO coros_backfill_jobs(owner,revision,time_zone,next_run,lease_until,attempts) SELECT ?,?,?,?,0,0 WHERE EXISTS(SELECT 1 FROM coros_connections WHERE owner=? AND revision=?) ON CONFLICT(owner) DO UPDATE SET revision=excluded.revision,time_zone=excluded.time_zone,next_run=excluded.next_run,lease=CASE WHEN coros_backfill_jobs.revision=excluded.revision THEN coros_backfill_jobs.lease ELSE NULL END,lease_until=CASE WHEN coros_backfill_jobs.revision=excluded.revision THEN coros_backfill_jobs.lease_until ELSE 0 END,attempts=0').bind(row.owner,row.revision,timeZone,Date.now()+75000,row.owner,row.revision).run();
}
type Job={owner:string;revision:string;time_zone:string;lease:string;attempts:number};
export async function runCorosBackfills(limit=2){
 const {db}=storage();const now=Date.now(),claim=crypto.randomUUID(),count=Math.max(1,Math.min(2,Math.floor(limit)||1));
 const claimed=await db.prepare('UPDATE coros_backfill_jobs SET lease=?,lease_until=? WHERE owner IN(SELECT owner FROM coros_backfill_jobs WHERE next_run<=? AND lease_until<? ORDER BY next_run LIMIT ?) AND lease_until<? RETURNING *').bind(claim,now+600000,now,now,count,now).all<Job>();
 const results=await Promise.all(claimed.results.map(async job=>{try{
  const [row,training]=await Promise.all([corosConnection(job.owner),connection(job.owner)]);
  if(!row||row.revision!==job.revision){await db.prepare('DELETE FROM coros_backfill_jobs WHERE owner=? AND revision=? AND lease=?').bind(job.owner,job.revision,claim).run();return {completed:false,disconnected:true};}
  const primary=training?await savedSnapshot(job.owner,training.snapshot_key):null;
  const {syncCoros}=await import('../app/api/coros/sync');await syncCoros(row,!!primary,{timeZone:job.time_zone,primary,backfill:true});
  await db.prepare('UPDATE coros_backfill_jobs SET lease=NULL,lease_until=0 WHERE owner=? AND revision=? AND lease=?').bind(job.owner,job.revision,claim).run();return {completed:true};
 }catch{await db.prepare('UPDATE coros_backfill_jobs SET lease=NULL,lease_until=0,attempts=attempts+1,next_run=? WHERE owner=? AND revision=? AND lease=?').bind(Date.now()+(job.attempts>=4?6*3600000:300000),job.owner,job.revision,claim).run();return {completed:false};}}));
 return {processed:results.length,completed:results.filter(result=>result.completed).length};
}
