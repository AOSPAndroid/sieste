import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function mod(name){let s=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,d)=>`from "${mod(d)}"`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
const {loadAnalysis}=await import(mod('load-analysis-data'));
const now=new Date('2026-09-26T12:00:00Z'),activities=Array.from({length:65},(_,i)=>{const d=new Date(now);d.setUTCDate(d.getUTCDate()-i);return {id:String(i),date:d.toISOString(),sportType:'cycling',provider:'tredict',summary:{effort:{heartrate:i===0?999:i<=7?20:10},duration:3600}}});
const data={activities,historyStart:'2026-01-01',historyComplete:true,syncedAt:now.toISOString(),sleep:{},hrv:{},extra:{efforts:{trainingEfforts:{}}}};
let r=loadAnalysis(data,now,28);assert.equal(r.total,140);assert.equal(r.previous,70);assert.equal(r.change,100);assert.equal(r.today.value,999);assert.equal(r.baseline,12.5);assert.equal(r.rows.length,28);
const bad=structuredClone(data);delete bad.activities[2].summary.effort;r=loadAnalysis(bad,now,28);assert.equal(r.coverage,6);assert.equal(r.change,null);assert.equal(r.baseline,null);assert.equal(r.today.short,null);assert.equal(r.missing.length,1);
r=loadAnalysis(bad,now,28,'time');assert.equal(r.total,420);assert.equal(r.change,0);
const foreign=structuredClone(data);foreign.activities[1].provider='coros';assert.equal(loadAnalysis(foreign,now,28).coverage,6);
console.log('Passed: excludes partial today from comparisons, daily values preserved, 28d baseline, missing-day gaps, time fallback, and provider separation.');
