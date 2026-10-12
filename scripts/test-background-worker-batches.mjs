import {readFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Run the real bridge tick with filesystem/network/Web Push ports in memory.
// No local configuration, credentials, notification endpoint or process is touched.
const source=readFileSync(new URL('./sieste-background-worker.mjs',import.meta.url),'utf8').split('\nfunction stop()')[0].replace(/^import .*;\r?\n/gm,'');
const origin='https://sieste.daaalil.chatgpt.site';
const config={base:origin,token:'synthetic-worker-token-1234567890',runtimePath:path.resolve('synthetic-push-runtime'),vapidPublicKey:'A'.repeat(87),vapidPrivateKey:'B'.repeat(43)};
const files=new Map(),requests=[],pushes=[];
const fs={readFile:async file=>file.endsWith('config.json')?JSON.stringify(config):files.get(file)??'{}',writeFile:async(file,value)=>{files.set(file,value);},rename:async(from,to)=>{files.set(to,files.get(from));files.delete(from);}};
const jobs=Array.from({length:20},(_,index)=>({id:'job'+index,claim:'claim'+index,subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/synthetic'+index,keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}},payload:{type:'sieste-sync-completed',status:'completed',syncedAt:'2026-10-12T10:00:00Z'}}));
const fetch=async(url,options)=>{assert.equal(url,origin+'/api/background-sync/worker');const body=JSON.parse(options.body);requests.push(body);return Response.json(body.op==='tick'?{ok:true,synced:true,processed:4,results:[{synced:true},{synced:false},{synced:true},{synced:false}],notificationJobs:jobs}:{ok:true});};
const createRequire=()=>()=>({sendNotification:async(subscription)=>{pushes.push(subscription.endpoint);return {statusCode:201};}});
const processPort={argv:['node','bridge.mjs','--once'],platform:'linux',cwd:()=>path.resolve('synthetic-worker'),env:{},pid:123};
const bridge=new Function('fs','path','createRequire','delay','process','fetch',source+';return {tick,state};')(fs,path,createRequire,()=>{},processPort,fetch);
await bridge.tick();
assert.equal(bridge.state.syncs,2,'Status counts each changed user rather than one tick');
assert.equal(pushes.length,20);
const acks=requests.filter(request=>request.op==='delivered-many');
assert.deepEqual(acks.map(request=>request.jobs.length),[8,8,4],'Delivery acknowledgements are bounded and batched');
assert.deepEqual(acks.flatMap(request=>request.jobs.map(job=>job.id)),jobs.map(job=>job.id));
assert.ok(acks.every(request=>request.jobs.every(job=>job.statusCode===201)));
assert.ok(!requests.some(request=>request.op==='delivered'),'One HTTP acknowledgement per notification is avoided');
await bridge.tick();
assert.equal(pushes.length,20,'Saved receipts prevent duplicate pushes when the server returns a job again');
assert.equal(requests.filter(request=>request.op==='delivered-many').length,6,'Receipts are re-acknowledged safely');
for(const [file,content] of files){if(!file.endsWith('delivery-receipts.json'))continue;assert.ok(!content.includes('endpoint')&&!content.includes('claim')&&!content.includes('token'),'Receipts contain no endpoints or credentials');}
console.log('PC worker passed: per-user sync counters, bounded batch acknowledgements, persisted receipts and safe retry without duplicate notification sends.');
