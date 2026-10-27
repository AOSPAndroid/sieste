import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function moduleUrl(name){return 'data:text/javascript;base64,'+Buffer.from(compile(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8')).replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`)).toString('base64')}
const {applyWorkoutExclusions,applyWorkoutChanges,workoutChangeConfirmed}=await import(moduleUrl('workout-exclusions'));
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function handler(name){let found;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node.getText(tree);else ts.forEachChild(node,visit)}visit(tree);assert.ok(found,'Production handler exists: '+name);return found}
const run={id:'run',date:'2026-10-27T08:00:00Z',sportType:'running'},other={id:'other',date:'2026-10-26T08:00:00Z',sportType:'running'};
const initial={activities:[run,other],sleep:{},hrv:{}};
let data=initial,removed=null,selected=run,calls=0,undoError='',undoBusy=false;
const changes={current:[]};
let response={ok:true,body:{excludedWorkouts:[{id:run.id,date:run.date}]}};
let pending;
function render(name,isDemo=false,extra={}){const dependencies={busy:true,data,isDemo,removedWorkout:removed,undoBusy,workoutChanges:changes,applyWorkoutChanges,workoutChangeConfirmed,
 fetch:async(_url,options)=>{calls++;assert.ok(options.signal instanceof AbortSignal,'The request has a bounded wait');const body=JSON.parse(options.body);assert.ok(['remove','restore'].includes(body.action));assert.equal(body.id,'run');if(pending)await pending;return {ok:response.ok,json:async()=>response.body}},
 setData:update=>{data=typeof update==='function'?update(data):update},setRemovedWorkout:update=>{removed=typeof update==='function'?update(removed):update},setUndoError:value=>{undoError=value},setUndoBusy:value=>{undoBusy=value},setSelected:update=>{selected=typeof update==='function'?update(selected):update},
 ...extra};return new Function(...Object.keys(dependencies),compile(handler(name))+';return '+name)(...Object.values(dependencies));}
await render('removeWorkout')(run);
assert.equal(calls,1,'Background sync must not block removal');assert.deepEqual(data.activities,[other]);assert.equal(removed,run);assert.equal(selected,null);
assert.deepEqual(applyWorkoutChanges(initial,changes.current).activities,[other],'A sync started before removal cannot resurrect the workout');
const afterRemoval=data,start=changes.current.length;
response={ok:true,body:{excludedWorkouts:[]}};
await render('undoRemoval')();
assert.deepEqual(data.activities,[run,other]);assert.equal(removed,null);assert.equal(undoBusy,false);
assert.deepEqual(applyWorkoutChanges(afterRemoval,changes.current.slice(start)).activities,[run,other],'A sync started before Undo cannot hide the restored workout');
assert.deepEqual(applyWorkoutChanges(initial,changes.current).activities,[run,other],'Removal and Undo replay in acknowledgement order');
assert.equal(applyWorkoutChanges(initial,[]),initial,'Unrelated future refreshes remain authoritative');
const alias={...run,id:'tredict-run',fallbackId:'coros_100_run'};
assert.deepEqual(applyWorkoutExclusions({...initial,activities:[alias,other]},[{id:'coros_100_run',date:run.date}]).activities,[other],'An excluded source alias stays hidden');
assert.deepEqual(initial.activities,[run,other],'Source snapshots stay unchanged');
const beforeFailure=data,changeCount=changes.current.length;
response={ok:false,body:{error:'Storage temporarily unavailable'}};
await assert.rejects(render('removeWorkout')(run),/Storage temporarily unavailable/);
assert.equal(data,beforeFailure);assert.equal(changes.current.length,changeCount,'Failed requests cannot hide workouts or add replay entries');
response={ok:true,body:{}};
await assert.rejects(render('removeWorkout')(run),/not confirmed/);assert.equal(data,beforeFailure);
for(const excludedWorkouts of [[],[{}],[null],[{id:run.id}],[{id:other.id,date:other.date}]]){response={ok:true,body:{excludedWorkouts}};await assert.rejects(render('removeWorkout')(run),/not confirmed/);assert.equal(data,beforeFailure);}
// Changing connections while a request runs must not alter the new dashboard.
response={ok:true,body:{excludedWorkouts:[{id:run.id,date:run.date}]}};
let release;pending=new Promise(resolve=>{release=resolve});
const changing=render('removeWorkout')(run);changes.current=[];release();await assert.rejects(changing,/connection changed/);pending=null;
assert.equal(data,beforeFailure);assert.equal(removed,null);
// A slow removal must not close another session opened in the meantime.
selected=other;await render('removeWorkout')(run);assert.equal(selected,other);
response={ok:false,body:{error:'Restore failed'}};
const beforeUndoFailure=data;await render('undoRemoval')();assert.equal(data,beforeUndoFailure);assert.equal(removed,run);assert.equal(undoError,'Restore failed');assert.equal(undoBusy,false);
// Demo removal and undo use the same state transitions without any saved-data writes.
const previousCalls=calls;data=initial;removed=null;selected=run;changes.current=[];
await render('removeWorkout',true)(run);assert.deepEqual(data.activities,[other]);await render('undoRemoval',true)();assert.deepEqual(data.activities,[run,other]);assert.equal(calls,previousCalls);
// Account restore changes scope before showing its cache, then can deliver a
// slow sync. Exercise the actual callbacks rather than only the replay helper.
const scope={current:'previous-athlete'};
changes.current=[{activity:other,excluded:[{id:other.id,date:other.date}],removed:true}];
data=initial;removed=null;selected=run;
response={ok:true,body:{excludedWorkouts:[{id:run.id,date:run.date}]}};
let retrieved;
await render('restoreAccount',false,{
 restoreRevision:{current:0},deviceScope:scope,lastPersisted:{current:null},demoPending:{current:null},
 setAccountLoading:()=>{},setConnectionRevision:()=>{},clearWorkoutCache:()=>{},setCachedAt:()=>{},setIsDemo:()=>{},
 notifications:{retrieved:async(_scope,fresh)=>{retrieved=fresh}},
 restoreDashboard:async options=>{options.onScope('current-athlete');options.onData(initial,1);assert.deepEqual(data.activities,[run,other],'A new connection never inherits prior removals');await render('removeWorkout')(run);options.onData(initial,null);options.onRetrieved(initial)},
})();
assert.deepEqual(data.activities,[other],'The startup sync cannot undo a removal made after the cache opens');
assert.deepEqual(retrieved.activities,[other],'A stale refresh cannot issue a new-workout notification for a removed workout');
// The manual/automatic progressive sync has a separate callback and must replay
// the same edits, including an Undo that finished while the sync was running.
const stale=data;removed=run;response={ok:true,body:{excludedWorkouts:[]}};
await render('sync',false,{
 busy:false,account:{signedIn:true},token:'__saved__',tokenDraft:'',deviceScope:scope,syncLock:{current:false},syncAttempt:{current:0},
 setBusy:()=>{},setManualSync:()=>{},setError:()=>{},setSyncPhase:()=>{},setToken:()=>{},setIsDemo:()=>{},setCachedAt:()=>{},
 startTransition:fn=>fn(),notifications:{retrieved:async()=>{}},
 progressiveSync:async(_options,onData)=>{await render('undoRemoval')();onData(stale)},
})(true);
assert.deepEqual(data.activities,[run,other],'Progressive sync cannot overwrite an Undo made while it was running');
console.log('Workout removal passed: background sync, stale refreshes, Undo, aliases, failures, response validation, connection changes, selection safety and demo isolation.');
