import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync('app/stable-data.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {stableMerge,onlySyncMetadataChanged}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const before={provider:'coros',activities:[{id:'b',summary:{distance:5}},{id:'a',summary:{distance:10}}],sleep:{20261017:[28000]},hrv:{20261017:[80]},extra:{coros:{daily:{20261017:{steps:9000},20261018:{steps:2000}},fitness:{vo2max:55}}},sources:{q:{retrievedAt:'t1'}},syncedAt:'t1'};
const copy=v=>JSON.parse(JSON.stringify(v));
// Nothing but sync metadata changed: every data branch keeps its identity.
let next={...copy(before),sources:{q:{retrievedAt:'t2'}},syncedAt:'t2'},merged=stableMerge(before,next);
assert.equal(merged.syncedAt,'t2');
for(const key of ['activities','sleep','hrv','extra'])assert.equal(merged[key],before[key],key+' is reused');
assert.ok(onlySyncMetadataChanged(before,merged),'Metadata-only refresh needs no device write');
// Steps move during the day: only that branch is new.
next=copy(before);next.extra.coros.daily['20261018'].steps=6500;next.syncedAt='t3';merged=stableMerge(before,next);
assert.equal(merged.extra.coros.daily['20261018'].steps,6500);
assert.notEqual(merged.extra,before.extra);
assert.equal(merged.extra.coros.daily['20261017'],before.extra.coros.daily['20261017'],'Settled days are reused');
assert.equal(merged.extra.coros.fitness,before.extra.coros.fitness);
assert.equal(merged.sleep,before.sleep);
assert.equal(merged.activities,before.activities);
assert.equal(onlySyncMetadataChanged(before,merged),false);
// A new workout at the top keeps existing rows.
next=copy(before);next.activities.unshift({id:'c',summary:{distance:3}});merged=stableMerge(before,next);
assert.equal(merged.activities.length,3);
assert.equal(merged.activities[1],before.activities[0]);
assert.equal(merged.activities[2],before.activities[1]);
assert.equal(merged.activities[0].id,'c');
// Removed keys and changed types are not kept from the previous version.
next=copy(before);delete next.hrv;next.sleep=[];merged=stableMerge(before,next);
assert.ok(!('hrv' in merged));assert.deepEqual(merged.sleep,[]);
assert.equal(stableMerge(null,before),before);
assert.equal(onlySyncMetadataChanged(null,before),false);
console.log('Passed stable data: unchanged branches reused, live totals and new workouts isolated, metadata-only refreshes detected, removals respected.');
