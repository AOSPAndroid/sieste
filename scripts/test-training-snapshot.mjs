import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {trainingSnapshot}=await import(moduleUrl('training-snapshot-data'));
const now=new Date('2026-09-18T12:00:00Z');
const activity=(date,sportType,summary)=>({id:date+sportType,date,sportType,summary});
const data={historyStart:'2026-01-01',historyComplete:true,sleep:{},hrv:{},activities:[activity('2026-09-18T10:00:00Z','running',{distance:10000,duration:3600,zonesDistribution:{heartrate:[1800,1200,600]}}),activity('2026-09-17T10:00:00Z','cycling',{distance:30000,duration:3600,zonesDistribution:{heartrate:[1000,2000]}}),activity('2026-09-16T10:00:00Z','strength_training',{duration:1800}),activity('2026-09-11T10:00:00Z','running',{distance:5000,duration:1800}),activity('2026-09-18T20:00:00Z','running',{distance:99999,duration:99999})],extra:{efforts:{trainingEfforts:{20260918:[[50]],20260917:[[40]],20260916:[[20]],20260911:[[30]]}}}};
let r=trainingSnapshot(data,now,'running');assert.deepEqual(r.metrics.map(m=>m.value),[40,2.5,3,110]);assert.deepEqual(r.metrics.map(m=>m.change),[35,2,2,80]);assert.deepEqual(r.zones,[1800,1200,600]);assert.equal(r.covered,1);assert.equal(r.sessions,1);assert.deepEqual(trainingSnapshot(data,now,'cycling').zones,[1000,2000]);
r=trainingSnapshot({...data,historyComplete:false},now,'running');assert.ok(r.metrics.every(m=>m.change===null));
r=trainingSnapshot({...data,activities:[activity('2026-09-18T10:00:00Z','running',{zonesDistribution:{heartrate:[-1,100]}})]},now,'running');assert.equal(r.covered,0);assert.equal(r.total,0);assert.equal(r.metrics[0].value,null);assert.equal(r.metrics[0].change,null);
r=trainingSnapshot({...data,activities:[],extra:{}},now,'running');assert.equal(r.metrics[0].value,0);assert.equal(r.metrics[3].value,null);assert.equal(r.total,0);
console.log('Passed: rolling periods, all-sport totals, strength exclusion from distance, effort changes, sport-specific zones, future exclusion, missing metrics and incomplete history.');
