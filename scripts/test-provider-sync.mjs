import ts from 'typescript';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const load=(p,name)=>new Function(ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('export ','')+';return '+name)();
const merge=load('app/provider-data.ts','combineProviders'),refresh=load('app/api/coros/refresh-policy.ts','refreshHealth');
const training={activities:[{id:'t1'}],sleep:{old:1},extra:{efforts:{scale:'tredict'},bodyvalues:{old:1}}},health={activities:[{id:'c1'}],sleep:{today:8},hrv:{today:80},extra:{coros:{fitness:{vo2max:50}},efforts:{scale:'coros'},bodyvalues:{weight:70}}};
const merged=merge(training,health);assert.deepEqual(merged.activities,training.activities);assert.equal(merged.extra.efforts.scale,'tredict');assert.deepEqual(merged.sleep,health.sleep);assert.deepEqual(merged.extra.bodyvalues,health.extra.bodyvalues);assert.equal(merge(null,health),health);assert.equal(merge(training,null),training);
const now=new Date('2026-09-20T16:00:00Z'),old={retrievedAt:'2026-09-20T08:00:00Z'};
assert.equal(refresh('querySleepData',old,now,true),false);assert.equal(refresh('querySleepData',old,now,false),true);assert.equal(refresh('querySleepData',old,new Date('2026-09-21T08:00:00Z'),true),false);assert.equal(refresh('queryDailyHealthData',old,now,true),true);assert.equal(refresh('querySleepData',{attemptedAt:'2026-09-20T15:30:00Z'},now,false),false);assert.equal(refresh('queryFitnessAssessmentOverview',old,now,true),false);console.log('Hybrid provenance and health refresh policy passed.');

const day=load('app/api/coros/refresh-policy.ts','healthDay'),has=load('app/api/coros/refresh-policy.ts','hasDailyReading');
assert.equal(day(new Date('2026-09-24T22:30:00Z'),'Europe/Paris'),'20260925');
for(const name of ['querySleepData','querySleepHrv','queryRestingHeartRate']){
 const recent={retrievedAt:'2026-09-25T08:00:00Z'};const now=new Date('2026-09-25T08:01:00Z');
 assert.equal(refresh(name,recent,now,false,true),true,'Manual refresh retries missing readings');
 assert.equal(refresh(name,recent,now,false,false),false,'Automatic retry retains backoff');
 assert.equal(refresh(name,{},now,true,true),false,'Existing daily reading never refetches');
}
assert.equal(has('querySleepData','20260925',{20260925:[0]}, {},[]),false);
assert.equal(has('querySleepHrv','20260925',{}, {20260925:[null]},[]),false);
assert.equal(has('queryRestingHeartRate','20260925',{}, {},[{timestamp:'2026-09-25T00:00:00Z',hrRestDynamic:51}]),true);
assert.equal(has('querySleepData','20260925',{20260924:[28000]}, {},[]),false);
console.log('Daily completion, missing readings, explicit retries and local midnight passed.');
