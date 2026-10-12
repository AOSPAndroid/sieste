import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('db/coros-backfill.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','').replace("await import('../app/api/coros/sync')",'{syncCoros:refresh}');
const database=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())database.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
const db={prepare:sql=>{const bound=(args=[])=>({sql,args,all:async()=>({results:database.prepare(sql).all(...args)}),run:async()=>({meta:{changes:database.prepare(sql).run(...args).changes}})});return {...bound(),bind:(...args)=>bound(args)};},batch:async statements=>statements.map(({sql,args=[]})=>({meta:{changes:database.prepare(sql).run(...args).changes}}))};
let now=Date.parse('2026-10-12T10:00:00Z');class Clock extends Date{static now(){return now;}}
const corosConnection=async owner=>database.prepare('SELECT * FROM coros_connections WHERE owner=?').get(owner)??null;
let refreshHandler,calls=[];
const api=new Function('storage','connection','corosConnection','savedSnapshot','Date','refresh',source+';return {scheduleCorosBackfill,runCorosBackfills}')(()=>({db}),async()=>null,corosConnection,async()=>null,Clock,async(...args)=>{calls.push(args);return refreshHandler(...args);});
const row=owner=>({owner,revision:'rev-'+owner,credentials:'test-encrypted',region:'eu',snapshot_key:null,updated_at:'old'});
const connect=owner=>{const r=row(owner);database.prepare('INSERT INTO coros_connections(owner,revision,credentials,region,snapshot_key,updated_at) VALUES(?,?,?,?,?,?)').run(r.owner,r.revision,r.credentials,r.region,r.snapshot_key,r.updated_at);return r;};
const pending={extra:{coros:{history:{complete:false},recoveryHistory:{complete:false}}}};
const complete={extra:{coros:{history:{complete:true},recoveryHistory:{complete:true}}}};
const alice=connect('alice');await api.scheduleCorosBackfill(alice,pending,'Europe/Paris');assert.equal(database.prepare('SELECT count(*) AS n FROM background_sync').get().n,0,'Backfill does not opt an athlete into notifications');
assert.deepEqual(await api.runCorosBackfills(),{processed:0,completed:0});now+=76000;
refreshHandler=async(r,wellness,options)=>{assert.equal(wellness,false);assert.equal(options.backfill,true);assert.equal(options.timeZone,'Europe/Paris');await api.scheduleCorosBackfill(r,complete,options.timeZone);};
assert.deepEqual(await api.runCorosBackfills(),{processed:1,completed:1});assert.equal(database.prepare('SELECT count(*) AS n FROM coros_backfill_jobs').get().n,0,'Completed history removes its continuation');
const bob=connect('bob');await api.scheduleCorosBackfill(bob,pending);database.prepare('UPDATE coros_connections SET revision=? WHERE owner=?').run('new-bob','bob');now+=76000;const before=calls.length;assert.deepEqual(await api.runCorosBackfills(),{processed:1,completed:0});assert.equal(calls.length,before,'A stale connection revision cannot refresh');
await api.scheduleCorosBackfill(alice,pending);now+=76000;refreshHandler=async()=>{throw Error('private provider failure');};assert.deepEqual(await api.runCorosBackfills(),{processed:1,completed:0});const failed=database.prepare('SELECT * FROM coros_backfill_jobs WHERE owner=?').get('alice');assert.equal(failed.attempts,1);assert.equal(failed.lease_until,0);assert.equal(failed.next_run,now+300000,'Failures back off instead of hot polling');
database.prepare('UPDATE coros_backfill_jobs SET next_run=0 WHERE owner=?').run('alice');let release,started;const gate=new Promise(resolve=>{release=resolve;});const running=new Promise(resolve=>{started=resolve;});refreshHandler=async r=>{started();await gate;await api.scheduleCorosBackfill(r,pending);};const first=api.runCorosBackfills();await running;assert.deepEqual(await api.runCorosBackfills(),{processed:0,completed:0},'Concurrent ticks cannot refresh an active backfill twice');release();await first;assert.equal(database.prepare('SELECT lease_until FROM coros_backfill_jobs WHERE owner=?').get('alice').lease_until,0);
// Hybrid accounts use Tredict history; incomplete COROS workout metadata must not
// keep an otherwise completed recovery-only backfill looping forever.
await api.scheduleCorosBackfill(alice,{extra:{coros:{history:{complete:false},recoveryHistory:{complete:true}}}},'UTC',true);assert.equal(database.prepare('SELECT count(*) AS n FROM coros_backfill_jobs WHERE owner=?').get('alice').n,0);
assert.equal(database.prepare('SELECT count(*) AS n FROM sync_notification_jobs').get().n,0,'Backfill completion itself sends no notifications');database.close();
console.log('COROS backfill: server continuation, completion, bounded leases, reauthentication fence, failure backoff and notification opt-in isolation passed.');
