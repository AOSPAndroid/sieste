import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function moduleUrl(name){let s=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,d)=>`from "${moduleUrl(d)}"`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
const {activityZoneTables,zoneDuration,workoutZoneTables}=await import(moduleUrl('activity-zones-data'));
let tables=activityZoneTables({power:[60,60],heartrate:[0,600,300,100,0]});assert.equal(tables[0].key,'heartrate');assert.equal(tables[0].total,1000);assert.equal(tables[0].rows[1].percent,60);assert.equal(tables[0].rows[0].percent,0);assert.equal(tables[0].rows.length,5);assert.equal(tables[1].total,120);
tables=activityZoneTables({heartrate:[60,null,-1,'120',NaN,Infinity]});assert.equal(tables[0].total,60);assert.equal(tables[0].partial,true);assert.equal(tables[0].rows[1].seconds,null);assert.equal(tables[0].rows[1].percent,null);assert.equal(tables[0].rows[0].percent,100);
assert.equal(activityZoneTables({heartrate:[0,0]})[0].rows[0].percent,null);assert.deepEqual(activityZoneTables(null),[]);assert.deepEqual(activityZoneTables({heartrate:[]}),[]);assert.equal(zoneDuration(3601),'1h 0m 1s');assert.equal(zoneDuration(0),'0m 0s');assert.equal(zoneDuration(null),'—');
console.log('Activity zones: sensor isolation, percentages, zero and missing data, zone order and duration passed.');
// The athlete's own zones: recorded times gain names and limits; a histogram is sorted into them when nothing was recorded.
{
 const own=[{name:'Easy',from:-1,to:140},{name:'Tempo',from:141,to:165},{name:'Hard',from:166,to:-1}];
 const named=workoutZoneTables({zonesDistribution:{heartrate:[600,300,100]}},null,own)[0];
 assert.deepEqual(named.names,['Easy','Tempo','Hard']);assert.deepEqual(named.ranges,['≤140','141–165','166+']);
 assert.equal(workoutZoneTables({zonesDistribution:{heartrate:[1,2,3,4,5]}},null,own)[0].names,undefined,'A different zone count is left unnamed');
 const sorted=workoutZoneTables({},{validSeconds:900,secondsByBpm:{130:600,150:200,170:100}},own)[0];
 assert.deepEqual(sorted.rows.map(r=>r.seconds),[600,200,100]);assert.equal(sorted.names[2],'Hard');
 assert.deepEqual(workoutZoneTables({},{validSeconds:900,secondsByBpm:{130:600}},null),[],'No zones, no histogram table');
 console.log('Workout zones named with the athlete\'s own zones passed.');
}
