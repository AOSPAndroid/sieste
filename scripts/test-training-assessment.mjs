import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {trainingAssessment}=await import(moduleUrl('training-assessment'));
const now=new Date('2026-09-19T12:00:00Z'),data={historyStart:'2026-01-01',historyComplete:true,activities:[],sleep:{},hrv:{},extra:{efforts:{trainingEfforts:{}},bodyvalues:{bodyvalues:[]}}};
for(let i=0;i<60;i++){const d=new Date(now);d.setDate(d.getDate()-i);const iso=d.toISOString().slice(0,10),key=iso.replaceAll('-','');data.sleep[key]=[8*3600];data.hrv[key]=[80];data.extra.efforts.trainingEfforts[key]=[[10]];data.extra.bodyvalues.bodyvalues.push({timestamp:iso+'T08:00:00Z',hrRestDynamic:50});}
assert.equal(trainingAssessment(data,now).tone,'green');
data.sleep['20260919']=[6.5*3600];assert.equal(trainingAssessment(data,now).title,'Recovery needs attention');data.sleep['20260919']=[8*3600];
for(let i=0;i<7;i++){const d=new Date(now);d.setDate(d.getDate()-i);data.extra.efforts.trainingEfforts[d.toISOString().slice(0,10).replaceAll('-','')]=[[20]];}
assert.equal(trainingAssessment(data,now).change,100);assert.equal(trainingAssessment(data,now).title,'Training load has stepped up');
for(const key of ['20260919','20260918','20260917'])data.hrv[key]=[30];
assert.equal(trainingAssessment(data,now).tone,'red');assert.equal(trainingAssessment(data,now).title,'Training may be outpacing recovery');
assert.equal(trainingAssessment({...data,hrv:{},sleep:{},extra:{}},now).tone,'neutral');
console.log('Passed assessment: steady baseline, load increase, sustained adverse recovery, missing-data neutrality.');
