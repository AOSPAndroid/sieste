import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=name=>readFileSync(new URL('../app/'+name,import.meta.url),'utf8');
const url=text=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const exclusions=url(source('workout-exclusions.ts'));
const {weekOverview,localDate}=await import(url(source('week-overview.ts').replace("'./workout-exclusions'",JSON.stringify(exclusions))));
const now=new Date(2026,8,28,12),today=localDate(now),stamp=today.replaceAll('-','');
const activity=(date,summary,sportType='running')=>({date:date.toISOString(),summary,sportType});
const data={activities:[activity(new Date(2026,8,28,10),{duration:1800,distance:5000,calories:300,vo2max:60}),activity(new Date(2026,8,28,11),{duration:3600,distance:20000},'cycling'),activity(new Date(2026,8,28,13),{duration:99999}),activity(new Date(2026,8,15,0),{duration:600}),activity(new Date(2026,8,14,23),{duration:99999})],sleep:{[stamp]:[28800]},hrv:{[stamp]:[90]},extra:{bodyvalues:{bodyvalues:[{timestamp:new Date(2026,8,28,9).toISOString(),hrRestDynamic:51},{timestamp:new Date(2026,8,28,8).toISOString(),hrRestDynamic:53},{timestamp:new Date(2026,8,28,13).toISOString(),hrRestDynamic:99}]},efforts:{trainingEfforts:{[stamp]:[[10],[20]]}}},excludedWorkouts:[]};
const family=a=>a.sportType;
const result=weekOverview(data,now,family),day=result.rows.at(-1);
assert.equal(day.sessions.length,2);assert.equal(day.minutes,90);assert.equal(day.calories,300);assert.equal(day.rhr,51);assert.equal(day.sleep,8);assert.equal(day.hrv,90);assert.equal(day.effort,30);assert.equal(day.runKm,5);assert.equal(day.rideKm,20);assert.equal(result.previous.minutes,10);
data.excludedWorkouts=[{id:'removed',date:new Date(2026,8,28,10).toISOString()}];assert.equal(weekOverview(data,now,family).rows.at(-1).effort,null);
const {loadWorkout,clearWorkoutCache,cachedWorkout}=await import(url(source('workout-detail-cache.ts')));
const originalFetch=globalThis.fetch,calls=[];
globalThis.fetch=async(_url,options)=>{const request=JSON.parse(options.body);return new Promise(resolve=>calls.push({request,finish:()=>resolve({ok:true,json:async()=>({details:[{id:request.id,summary:{duration:60},laps:[]}]})})}));};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
try{
 const previews=['p1','p2','p3'].map(id=>loadWorkout('account-a',id,'preview'));await tick();assert.equal(calls.length,2);
 const detail=loadWorkout('account-a','ride');await tick();assert.equal(calls.length,3);assert.equal(calls[2].request.id,'ride');
 const duplicate=loadWorkout('account-a','ride','preview');await tick();assert.equal(calls.length,3);
 calls[2].finish();await detail;await duplicate;assert.ok(cachedWorkout('account-a','ride'));assert.equal(cachedWorkout('account-b','ride'),null);
 await loadWorkout('account-a','ride');assert.equal(calls.length,3);
 calls[0].finish();await tick();assert.equal(calls.length,4);calls[1].finish();calls[3].finish();await Promise.all(previews);
 const stale=loadWorkout('account-a','stale');const rejection=assert.rejects(stale,/Connection changed/);await tick();clearWorkoutCache();calls.at(-1).finish();await rejection;assert.equal(cachedWorkout('account-a','ride'),null);assert.equal(cachedWorkout('account-a','stale'),null);
 const forced=loadWorkout('account-b','ride','detail',true);await tick();calls.at(-1).finish();await forced;
}finally{globalThis.fetch=originalFetch;clearWorkoutCache();}
console.log('Passed: date boundaries, future readings, daily totals, exclusions, interactive request priority, deduplication, cache reuse and account isolation.');
