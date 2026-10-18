import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const code=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const {refreshHealth,dailyHealthDays}=new Function(code('app/api/coros/refresh-policy.ts')+';return {refreshHealth,dailyHealthDays}')();
const now=new Date('2026-10-18T14:00:00Z'),ago=ms=>({retrievedAt:new Date(now.getTime()-ms).toISOString()});
// Live daily totals refresh every 15 minutes; settled sources keep the hourly cadence.
assert.equal(refreshHealth('queryDailyHealthData',ago(10*60000),now,true),false);
assert.equal(refreshHealth('queryDailyHealthData',ago(16*60000),now,true),true);
assert.equal(refreshHealth('queryRecoveryStatus',ago(16*60000),now,true),true);
assert.equal(refreshHealth('queryTrainingLoadAssessment',ago(16*60000),now,true),false);
assert.equal(refreshHealth('queryTrainingLoadAssessment',ago(61*60000),now,true),true);
// Overnight readings are fetched once: a dated reading for today ends refreshes.
assert.equal(refreshHealth('querySleepData',ago(5*3600000),now,true),false);
assert.equal(refreshHealth('querySleepData',ago(5*3600000),now,true,true),false);
// Daily totals request only the days since the newest stored total.
assert.equal(dailyHealthDays({},'20261018'),28);
assert.equal(dailyHealthDays(undefined,'20261018'),28);
assert.equal(dailyHealthDays({'20261018':{steps:4000}},'20261018'),7,'Same-day refresh re-reads the last week for late watch uploads');
assert.equal(dailyHealthDays({'20261017':{},'20261001':{}},'20261018'),7);
assert.equal(dailyHealthDays({'20261008':{}},'20261018'),11,'Ten days away fills the gap');
assert.equal(dailyHealthDays({'20260101':{}},'20261018'),28,'Long gaps are capped');
assert.equal(dailyHealthDays({'20261020':{}},'20261101'),13,'Month boundaries count calendar days');
console.log('Passed live refresh: 15-minute daily totals, hourly settled sources, once-a-day overnight readings and incremental daily-health ranges.');
