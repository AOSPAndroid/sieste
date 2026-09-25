import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync(new URL('../app/activity-zones-data.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {activityZoneTables,zoneDuration}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let tables=activityZoneTables({power:[60,60],heartrate:[0,600,300,100,0]});assert.equal(tables[0].key,'heartrate');assert.equal(tables[0].total,1000);assert.equal(tables[0].rows[1].percent,60);assert.equal(tables[0].rows[0].percent,0);assert.equal(tables[0].rows.length,5);assert.equal(tables[1].total,120);
tables=activityZoneTables({heartrate:[60,null,-1,'120',NaN,Infinity]});assert.equal(tables[0].total,60);assert.equal(tables[0].partial,true);assert.equal(tables[0].rows[1].seconds,null);assert.equal(tables[0].rows[1].percent,null);assert.equal(tables[0].rows[0].percent,100);
assert.equal(activityZoneTables({heartrate:[0,0]})[0].rows[0].percent,null);assert.deepEqual(activityZoneTables(null),[]);assert.deepEqual(activityZoneTables({heartrate:[]}),[]);assert.equal(zoneDuration(3601),'1h 0m 1s');assert.equal(zoneDuration(0),'0m 0s');assert.equal(zoneDuration(null),'—');
console.log('Activity zones: sensor isolation, percentages, zero and missing data, zone order and duration passed.');
