export type Job={id:string;owner:string;thread:string;message:string;created:number;status:'queued'|'working'|'done'|'failed';claim?:string;answer?:string;context?:unknown;model?:string;scope?:string};
export type Queue={jobs:Job[];heartbeat:number;model?:string};
export const lifetime=180000;
export function prune(q:Queue,now:number){q.jobs=q.jobs.filter(j=>j.created>now-7*86400000);for(const j of q.jobs){if(['queued','working'].includes(j.status)&&now-j.created>lifetime){j.status='failed';j.answer='Athena did not respond in time. Please try again.';delete j.context;delete j.claim}}}
export function visible(q:Queue,owner:string){return q.jobs.filter(j=>j.owner===owner).slice(-60).map(({id,thread,message,answer,status,created,model,scope})=>({id,thread,message,answer,status,created,model,scope}))}
type Result={body:any;status?:number};
type Row=Omit<Job,'context'> & {context:string|null};
const ready=new WeakMap<D1Database,Promise<void>>();
const timeoutMessage='Athena did not respond in time. Please try again.';
/** Idempotent one-time import into the deployment-migrated D1 queue. */
export function ensureAthenaQueue(db:D1Database,bucket:R2Bucket){
 const prior=ready.get(db);if(prior)return prior;
 const task=(async()=>{
  await db.prepare("INSERT OR IGNORE INTO athena_queue_state (id,heartbeat,legacy_migrated) VALUES ('main',0,0)").run();
  const state=await db.prepare("SELECT legacy_migrated FROM athena_queue_state WHERE id='main'").first<{legacy_migrated:number}>();
  if(state?.legacy_migrated){await bucket.delete('athena/queue-v1');return;}
  const object=await bucket.get('athena/queue-v1'),legacy:Queue=object?await object.json():{jobs:[],heartbeat:0};prune(legacy,Date.now());
  const jobs=(Array.isArray(legacy.jobs)?legacy.jobs:[]).filter(job=>typeof job.id==='string'&&typeof job.owner==='string'&&typeof job.thread==='string'&&typeof job.message==='string'&&Number.isFinite(job.created));
  // Concurrent migration attempts can only insert missing rows. They cannot
  // overwrite a claimed/completed/cancelled job already imported by another request.
  for(let offset=0;offset<jobs.length;offset+=64)await db.batch(jobs.slice(offset,offset+64).map(job=>db.prepare('INSERT OR IGNORE INTO athena_jobs (id,owner,thread,message,created,status,claim,answer,context,model,scope) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM athena_queue_state WHERE id=? AND legacy_migrated=0)').bind(job.id,job.owner,job.thread,job.message,job.created,job.status,job.claim??null,job.answer??null,job.context===undefined?null:JSON.stringify(job.context),job.model??null,job.scope??null,'main')));
  await db.prepare("UPDATE athena_queue_state SET model=CASE WHEN heartbeat<=? THEN ? ELSE model END,heartbeat=MAX(heartbeat,?),legacy_migrated=1 WHERE id='main'").bind(Number.isFinite(legacy.heartbeat)?legacy.heartbeat:0,legacy.model??null,Number.isFinite(legacy.heartbeat)?legacy.heartbeat:0).run();
  // Only remove the legacy object after its retained jobs and durable marker
  // have been saved. A failed cleanup retries the marker path, never reimports.
  await bucket.delete('athena/queue-v1');
 })().catch(error=>{ready.delete(db);throw error;});ready.set(db,task);return task;
}
async function expire(db:D1Database,now=Date.now()){
 await db.batch([
  db.prepare("DELETE FROM athena_jobs WHERE created<=?").bind(now-7*86400000),
  db.prepare("UPDATE athena_jobs SET status='failed',answer=?,context=NULL,claim=NULL WHERE status IN ('queued','working') AND created<?").bind(timeoutMessage,now-lifetime)
 ]);
}
export async function athenaMessages(db:D1Database,bucket:R2Bucket,owner:string):Promise<Result>{
 await ensureAthenaQueue(db,bucket);await expire(db);
 const [state,rows]=await db.batch([
  db.prepare("SELECT heartbeat,model FROM athena_queue_state WHERE id='main'"),
  db.prepare('SELECT id,thread,message,answer,status,created,model,scope FROM athena_jobs WHERE owner=? ORDER BY created DESC,id DESC LIMIT 60').bind(owner)
 ]);
 const health=state.results[0] as {heartbeat:number;model?:string}|undefined;
 return {body:{online:Date.now()-(health?.heartbeat??0)<90000,model:health?.model??null,messages:rows.results.reverse()}};
}
export async function enqueueAthena(db:D1Database,bucket:R2Bucket,job:Job):Promise<Result>{
 await ensureAthenaQueue(db,bucket);await expire(db);
 const now=Date.now();
 const inserted=await db.prepare("INSERT OR IGNORE INTO athena_jobs (id,owner,thread,message,created,status,context,scope) SELECT ?,?,?,?,?, 'queued',?,? WHERE EXISTS (SELECT 1 FROM athena_queue_state WHERE id='main' AND heartbeat>=?) AND NOT EXISTS (SELECT 1 FROM athena_jobs WHERE owner=? AND status IN ('queued','working') AND created>?) AND (SELECT COUNT(*) FROM athena_jobs WHERE owner=? AND created>?)<40 AND (SELECT COUNT(*) FROM athena_jobs WHERE created>?)<100 RETURNING id").bind(job.id,job.owner,job.thread,job.message,job.created,job.context===undefined?null:JSON.stringify(job.context),job.scope??null,now-90000,job.owner,now-lifetime,job.owner,now-86400000,now-86400000).first();
 if(inserted)return {body:{ok:true}};
 const [existing,state,active,counts]=await db.batch<{id?:string;heartbeat?:number;owned?:number;total?:number}>([
  db.prepare('SELECT id FROM athena_jobs WHERE id=? AND owner=?').bind(job.id,job.owner),
  db.prepare("SELECT heartbeat FROM athena_queue_state WHERE id='main'"),
  db.prepare("SELECT id FROM athena_jobs WHERE owner=? AND status IN ('queued','working') AND created>? LIMIT 1").bind(job.owner,now-lifetime),
  db.prepare('SELECT (SELECT COUNT(*) FROM athena_jobs WHERE owner=? AND created>?) AS owned,(SELECT COUNT(*) FROM athena_jobs WHERE created>?) AS total').bind(job.owner,now-86400000,now-86400000)
 ]);
 if(existing.results.length)return {body:{ok:true}};
 if(now-Number(state.results[0]?.heartbeat??0)>90000)return {status:503,body:{error:'Athena is offline. Keep your PC and Athena bridge running.'}};
 if(active.results.length)return {status:409,body:{error:'Athena is answering your previous question.'}};
 const count=counts.results[0];if(Number(count?.owned)>=40||Number(count?.total)>=100)return {status:429,body:{error:'Daily chat limit reached. Try again tomorrow.'}};
 return {status:409,body:{error:'Athena is busy. Try again.'}};
}
export async function clearAthena(db:D1Database,bucket:R2Bucket,owner:string):Promise<Result>{
 await ensureAthenaQueue(db,bucket);await db.prepare('DELETE FROM athena_jobs WHERE owner=?').bind(owner).run();return {body:{ok:true}};
}
export async function athenaWorker(db:D1Database,bucket:R2Bucket,operation:any):Promise<Result>{
 await ensureAthenaQueue(db,bucket);const now=Date.now();await expire(db,now);
 await db.prepare("UPDATE athena_queue_state SET heartbeat=?,model=COALESCE(?,model) WHERE id='main'").bind(now,typeof operation.model==='string'?operation.model.slice(0,80):null).run();
 if(operation.op==='claim'){
  const job=await db.prepare("UPDATE athena_jobs SET status='working',claim=? WHERE id=(SELECT id FROM athena_jobs WHERE status='queued' ORDER BY created,id LIMIT 1) AND status='queued' RETURNING *").bind(crypto.randomUUID()).first<Row>();
  if(!job)return {body:{ok:true,job:null}};
  const history=await db.prepare("SELECT scope,message,answer FROM athena_jobs WHERE owner=? AND thread=? AND status='done' AND created<? ORDER BY created DESC,id DESC LIMIT 2").bind(job.owner,job.thread,job.created).all<{scope:string;message:string;answer:string}>();
  return {body:{ok:true,job:{id:job.id,claim:job.claim,message:job.message,context:job.context?JSON.parse(job.context):undefined,history:history.results.reverse().map(row=>({scope:row.scope,question:row.message.slice(0,500),answer:row.answer?.slice(0,1200)}))}}};
 }
 if(operation.op==='finish'){
  if(typeof operation.answer!=='string'||!operation.answer.trim()||operation.answer.length>10000)return {status:400,body:{error:'Invalid answer'}};
  const completed=await db.prepare("UPDATE athena_jobs SET answer=?,status=?,model=(SELECT model FROM athena_queue_state WHERE id='main'),context=NULL,claim=NULL WHERE id=? AND claim=? AND status='working' RETURNING id").bind(operation.answer,operation.failed?'failed':'done',typeof operation.id==='string'?operation.id:'',typeof operation.claim==='string'?operation.claim:'').first();
  if(!completed)return {status:409,body:{error:'Job expired or cancelled'}};
 }
 return {body:{ok:true}};
}
