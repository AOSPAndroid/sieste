import {readFileSync} from 'node:fs';

import assert from 'node:assert/strict';

import ts from 'typescript';

const cache=new Map();

function moduleUrl(name){if(cache.has(name))return cache.get(name);let s=ts.transpileModule(readFileSync(new URL('../'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(name.slice(0,name.lastIndexOf('/')+1)+dep)}"`);const u='data:text/javascript;base64,'+Buffer.from(s).toString('base64');cache.set(name,u);return u}

const {athenaContext}=await import(moduleUrl('app/athena-context'));

const {prune,visible,updateQueue}=await import(moduleUrl('db/athena-queue'));

const data={activities:[{id:'a',date:'2026-09-27T23:30:00Z',sportType:'cycling',title:'SECRET ROUTE',summary:{duration:3600,distance:25000,power:150,positionLat:[48],token:'SECRET'}},{id:'old',date:'2020-01-01',sportType:'running'}],sleep:{20260928:[28800]},hrv:{20260928:[99]},extra:{bodyvalues:{bodyvalues:[{timestamp:'2026-09-27T23:30:00Z',hrRestDynamic:50}]},coros:{fitness:{ftp:247,observedAt:'2026-09-28'},token:'SECRET'}},syncedAt:'2026-09-28T10:00:00Z'};

const c=athenaContext(data,'2026-09-28','a','Europe/Paris');assert.equal(c.daily.length,7);assert.equal(c.daily.at(-1).sleepHours,8);assert.equal(c.daily.at(-1).restingHrBpm,50);assert.equal(c.daily[0].hrvMs,null);assert.equal(c.workouts.length,0);assert.equal(c.fitness.ftpWatts,247);assert.ok(!JSON.stringify(c).includes('SECRET'));assert.ok(!JSON.stringify(c).includes('positionLat'));assert.equal(c.selectedWorkout.summary.duration,3600);

const now=Date.now(),q={heartbeat:now,jobs:[{id:'old',created:now-8*86400000,owner:'a',status:'done'},{id:'pending',created:now-190000,owner:'a',status:'working',context:{private:1},claim:'secret'},{id:'other',owner:'b',created:now,status:'done',answer:'private'}]};prune(q,now);assert.equal(q.jobs.length,2);assert.equal(q.jobs[0].status,'failed');assert.equal(q.jobs[0].context,undefined);assert.equal(q.jobs[0].claim,undefined);assert.equal(visible(q,'a').length,1);assert.ok(!JSON.stringify(visible(q,'a')).includes('private'));

let value=null,revision=0,conflict=true;

const bucket={async get(){return value?{etag:String(revision),async json(){return structuredClone(value)}}:null},async put(key,body,options){if(conflict){conflict=false;return null}assert.ok(options.onlyIf);value=JSON.parse(body);revision++;return {etag:String(revision)}}};

await updateQueue(bucket,q=>{q.jobs.push({id:'once'});return {body:{ok:true}}});assert.equal(value.jobs.length,1);

console.log('Athena: private context, units, dates, account isolation, expiry and CAS retry passed');

globalThis.athenaTest={user:null,bucket,snapshot:data,env:{ATHENA_BRIDGE_TOKEN:'test-secret'}};

const stub=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');

const modules={

 '../../chatgpt-auth':stub('export async function getChatGPTUser(){return globalThis.athenaTest.user}'),

 '../../../db/storage':stub('export const storage=()=>({bucket:globalThis.athenaTest.bucket});export const privateJson=(b,s=200)=>Response.json(b,{status:s});export const sameOrigin=r=>r.headers.get("origin")===new URL(r.url).origin;export const ownerPrefix=async id=>"athletes/"+id+"/";'),

 '../../../db/athena-queue':moduleUrl('db/athena-queue'),

 '../sync/route':stub('export async function GET(){return Response.json({data:globalThis.athenaTest.snapshot})}'),

 '../../athena-context':moduleUrl('app/athena-context'),

 'cloudflare:workers':stub('export const env=globalThis.athenaTest.env;'),

};modules['../../../../db/storage']=modules['../../../db/storage'];modules['../../../../db/athena-queue']=modules['../../../db/athena-queue'];

async function route(name){const s=ts.transpileModule(readFileSync(new URL('../app/api/athena/'+name,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,dep)=>{assert.ok(modules[dep],dep);return `from "${modules[dep]}"`});return import(stub(s))}

const userApi=await route('route.ts'),workerApi=await route('worker/route.ts');

assert.equal((await userApi.GET()).status,401);

const worker=(b,token='test-secret')=>workerApi.POST(new Request('https://test/api/athena/worker',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(b)}));

assert.equal((await worker({op:'claim'},'wrong')).status,401);await worker({op:'heartbeat',model:'test'});

globalThis.athenaTest.user={userId:'a'};

const body={message:'Review my sleep',screen:'Sleep · Widget / Overnight HRV',thread:crypto.randomUUID(),requestId:crypto.randomUUID(),timeZone:'Europe/Paris'};

const post=(b=body,origin='https://test')=>userApi.POST(new Request('https://test/api/athena',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(b)}));

assert.equal((await post(body,'https://evil')).status,403);assert.equal((await post()).status,200);assert.equal((await post()).status,200);

let messages=(await (await userApi.GET()).json()).messages;assert.equal(messages.length,1);assert.equal(messages[0].context,undefined);

const job=(await (await worker({op:'claim'})).json()).job;assert.ok(job.context.daily);assert.equal(job.context.currentScreen,'Sleep · Widget / Overnight HRV');assert.ok(job.context.screenNote.includes('not a screenshot'));assert.equal((await worker({op:'finish',id:job.id,claim:'wrong',answer:'bad'})).status,409);

assert.equal((await worker({op:'finish',id:job.id,claim:job.claim,answer:'Test answer'})).status,200);

globalThis.athenaTest.user={userId:'b'};assert.equal((await (await userApi.GET()).json()).messages.length,0);

globalThis.athenaTest.user={userId:'a'};assert.equal((await (await userApi.GET()).json()).messages[0].answer,'Test answer');

console.log('Athena API: auth, origin, idempotency, worker claims and account isolation passed');



assert.equal(c.activityComparison,null);

const past=(id,date,sportType='cycling',duration=3600)=>({id,date,sportType,summary:{duration,distance:25000,heartrate:125,power:160,cadence:88}});

const many={...data,activities:[data.activities[0],...Array.from({length:12},(_,i)=>past('prior'+i,'2026-09-'+String(26-i).padStart(2,'0')+'T10:00:00Z')),past('wrong-sport','2026-09-26','running'),past('too-short','2026-09-26','cycling',300),past('future','2026-09-29')]};

const comparison=athenaContext(many,'2026-09-28','a','Europe/Paris','Compare cadence and efficiency');

assert.equal(comparison.activityComparison.sessions.length,5);assert.equal(comparison.activityComparison.eligibleCount,12);assert.equal(comparison.activityComparison.sessions[0].recorded.cadence,88);assert.equal(comparison.activityComparison.sessions[0].derived.wattsPerBpm,1.28);

assert.equal(athenaContext(many,'2026-09-28','a','Europe/Paris','hello').activityComparison,null);

assert.ok(athenaContext(many,'2026-09-28','a','Europe/Paris','tell me more',true).activityComparison);

assert.equal(athenaContext(many,'2026-09-28',undefined,'Europe/Paris','sleep over the last month').daily.length,28);

assert.equal(athenaContext(many,'2026-09-28').workouts.length,6);

assert.ok(JSON.stringify(comparison).length<9000);

console.log('Athena cost controls: opt-in comparisons, matching exclusions, metric units and bounded context passed');


const {trainingBrief,recoveryBrief}=await import(moduleUrl('app/athena-brief'));
const complete={activities:[past('recent','2026-09-27T10:00:00Z','cycling',7200),...['2026-09-20','2026-09-13','2026-09-06','2026-08-30'].map((d,i)=>past('base'+i,d+'T10:00:00Z','cycling',3600)),past('today','2026-09-28T09:00:00Z','cycling',10800)],sleep:{},hrv:{},historyStart:'2026-01-01',historyComplete:true,syncedAt:'2026-09-28T10:00:00Z'};
const brief=trainingBrief(complete,'2026-09-28','Europe/Paris');assert.equal(brief.weeks[0].recordedMinutes,120);assert.equal(brief.today.recordedMinutes,180);assert.equal(brief.recentWeekVsPriorFourWeeksPercent,100);assert.equal(brief.weeks[0].end,'2026-09-27');
assert.equal(trainingBrief({...complete,historyComplete:false},'2026-09-28','Europe/Paris').recentWeekVsPriorFourWeeksPercent,null);
assert.equal(trainingBrief({...complete,activities:[...complete.activities,{id:'missing',date:'2026-09-26',sportType:'running'}]},'2026-09-28','Europe/Paris').recentWeekVsPriorFourWeeksPercent,null);
const recovery=recoveryBrief([{date:'a',sleepHours:8,hrvMs:null,restingHrBpm:50},{date:'b',sleepHours:6,hrvMs:90,restingHrBpm:52}]);assert.equal(recovery.lastThreeNights.sleepHours.mean,7);assert.equal(recovery.lastThreeNights.hrvMs.count,1);assert.equal(recovery.prior28Nights.sleepHours.mean,null);
console.log('Athena briefs: prior history retained, today excluded, incomplete baseline withheld, missing readings counted');

const run={id:'run',date:'2026-09-27T10:00:00Z',sportType:'running',analyzed:true,summary:{duration:3600,distance:11000,cadence:186,stepLength:103,groundContactTime:205,verticalOscillation:8.2}};
const mechanicsData={...data,activities:[run,data.activities[0]]};
const mechanics=athenaContext(mechanicsData,'2026-09-28','run','Europe/Paris','How are my run mechanics?');
assert.equal(mechanics.mechanics.metrics.recorded.groundContactTime,205);assert.equal(mechanics.mechanics.metrics.recorded.verticalOscillation,8.2);assert.equal(mechanics.mechanics.units.stepLength,'cm');assert.equal(mechanics.questionIntent,'mechanics');assert.equal(mechanics.fitness,null);assert.equal(mechanics.trainingSummary,null);assert.equal(mechanics.daily.length,0);assert.ok(mechanics.activityComparison);
const mismatch=athenaContext(mechanicsData,'2026-09-28','a','Europe/Paris','How are my run mechanics?');assert.equal(mismatch.activitySelection.needsClarification,true);assert.equal(mismatch.selectedWorkout,null);assert.equal(mismatch.mechanics,null);assert.equal(mismatch.workouts.length,0);
const latest=athenaContext(mechanicsData,'2026-09-28','a','Europe/Paris','How are my latest run mechanics?');assert.equal(latest.activitySelection.target.sport,'running');assert.equal(latest.activitySelection.needsClarification,false);
console.log('Athena mechanics: requested fields/units included, unrelated recovery omitted, sport conflicts clarified');
