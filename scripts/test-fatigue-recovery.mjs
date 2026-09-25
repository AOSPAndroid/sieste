import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {fatigueRecovery}=await import(moduleUrl('fatigue-recovery-data'));
const now=new Date('2026-09-19T12:00:00Z');
const data={historyStart:'2026-01-01',historyComplete:true,activities:[],sleep:{20260919:[28800]},hrv:{20260919:[80]},extra:{efforts:{trainingEfforts:{20260919:[[70],[14]]}},bodyvalues:{bodyvalues:[{timestamp:'2026-09-19T08:00:00Z',hrRestDynamic:50},{timestamp:'2026-09-19T22:00:00Z',hrRestDynamic:99}]}}};
let rows=fatigueRecovery(data,now,28),r=rows.at(-1);
assert.equal(rows.length,28);assert.equal(rows[0].iso,'2026-08-23');assert.equal(r.effort,84);assert.equal(r.load7,12);assert.equal(r.load28,3);assert.equal(r.sleep,8);assert.equal(r.hrv,80);assert.equal(r.rhr,50);assert.equal(rows[0].sleep,null);
r=fatigueRecovery({...data,excludedWorkouts:[{id:'x',date:'2026-09-19T08:00:00Z'}]},now).at(-1);assert.equal(r.effort,null);assert.equal(r.load7,null);
r=fatigueRecovery({...data,historyComplete:false},now).at(-1);assert.equal(r.effort,84);assert.equal(r.load7,null);
r=fatigueRecovery({...data,activities:[{id:'x',date:'2026-09-18T08:00:00Z'}]},now).at(-1);assert.equal(r.load7,null);assert.equal(r.load28,null);
rows=fatigueRecovery({...data,extra:{}},now);assert.ok(rows.every(r=>r.effort===null));
rows=fatigueRecovery({...data,syncedAt:'2026-09-17T12:00:00Z'},now);assert.equal(rows.at(-2).effort,null);
assert.equal(fatigueRecovery(data,new Date('2026-01-02T12:00:00Z'),7)[0].iso,'2025-12-27');
console.log('Passed fatigue/recovery: rolling means, coverage, missing signals, exclusions, stale sync, future body readings and year boundary.');
