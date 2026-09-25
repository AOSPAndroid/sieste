import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {loadRecoveryTrends}=await import(moduleUrl('fatigue-recovery-data'));
const now=new Date('2026-09-19T12:00:00Z'),data={historyStart:'2026-01-01',historyComplete:true,activities:[],sleep:{},hrv:{},extra:{efforts:{trainingEfforts:{}}}};
for(let i=0;i<100;i++){const d=new Date(now);d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10).replaceAll('-','');data.hrv[key]=[80];data.extra.efforts.trainingEfforts[key]=[[10]];}
let rows=loadRecoveryTrends(data,now);assert.equal(rows.length,28);assert.equal(rows.at(-1).iso,'2026-09-19');assert.equal(rows.at(-1).loadIndex,100);assert.equal(rows.at(-1).recoveryIndex,100);
for(let i=0;i<7;i++){const d=new Date(now);d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10).replaceAll('-','');data.hrv[key]=[60];data.extra.efforts.trainingEfforts[key]=[[20]];}
let r=loadRecoveryTrends(data,now).at(-1);assert.equal(r.loadIndex,200);assert.equal(r.recoveryIndex,75);
delete data.hrv['20260919'];delete data.hrv['20260918'];assert.equal(loadRecoveryTrends(data,now).at(-1).recoveryIndex,null);
assert.equal(loadRecoveryTrends({...data,historyComplete:false,extra:{}},now).at(-1).loadIndex,null);
assert.equal(loadRecoveryTrends({...data,excludedWorkouts:[{id:'x',date:'2026-09-18T08:00:00Z'}]},now).at(-1).loadIndex,null);
data.extra.efforts.trainingEfforts['20260919']=[[300]];assert.ok(loadRecoveryTrends(data,now).at(-1).loadIndex>200,'Today’s ride changes the load line immediately');
console.log('Passed indexed trends: independent non-overlapping baselines, complete days, diverging trends, missing and stale signals, exclusions.');
