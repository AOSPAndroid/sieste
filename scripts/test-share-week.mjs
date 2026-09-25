import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function mod(name){let s=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,d)=>`from "${mod(d)}"`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
const {shareWeek}=await import(mod('share-week'));
const run=(date,distance)=>({date,sportType:'running',summary:{distance,duration:1800,altitude:{ascent:20},calories:250}});
const a=run('2026-09-22T10:00:00Z',5000),history=[a,run('2026-09-21T10:00:00Z',10000),run('2026-09-20T10:00:00Z',99000),{...a,sportType:'cycling'}];
const r=shareWeek(a,history);assert.equal(r.count,2);assert.equal(r.stats.find(s=>s.key==='distance').value,'15');assert.equal(r.stats.find(s=>s.key==='duration').value,'1:00:00');assert.equal(r.stats.find(s=>s.key==='ascent').value,'40');assert.deepEqual(r.days.slice(0,2).map(d=>d.value),[10,5]);
const partial=shareWeek(a,[a,run('2026-09-23T10:00:00Z',undefined)]);assert.ok(!partial.stats.some(s=>s.key==='distance'));assert.equal(partial.days[2].value,null);assert.equal(shareWeek(a,[]).stats.length,0);
console.log('Passed: weekly sport/date filtering, aggregate time and elevation, daily distance and omitted incomplete totals.');
