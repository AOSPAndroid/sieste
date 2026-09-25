import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function url(name){let code=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;code=code.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${url(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64')}
const {valueTrend,sessionTrend,vo2Trend}=await import(url('trend'));
assert.equal(valueTrend(70,65,'higher').tone,'good');assert.equal(valueTrend(50,52,'lower').tone,'good');assert.equal(valueTrend(60,70,'higher').tone,'bad');assert.equal(valueTrend(65,66,'higher').tone,'watch');assert.equal(valueTrend(100,90,'neutral').tone,'neutral');assert.equal(valueTrend(1,1).tone,'steady');assert.equal(valueTrend(null,1).tone,'missing');assert.equal(valueTrend(1,0).tone,'neutral');
const run=(id,date,duration,hr=140)=>({id,date,sportType:'running',title:'Easy run',summary:{duration,distance:10000,heartrate:hr,vo2max:55,altitude:{ascent:40},temperature:20}});
const a=run('a','2026-09-19',3000),b=run('b','2026-09-12',3100);
assert.equal(sessionTrend(a,[a,b]).trend.tone,'good');assert.equal(sessionTrend(a,[a,b]).metric,'speed');assert.equal(sessionTrend(a,[a,{...b,title:'Track intervals'}]),null);assert.equal(sessionTrend(a,[a,run('future','2026-09-20',3100)]),null);assert.equal(sessionTrend(a,[run('older','2025-09-12',3100)]),null);assert.equal(sessionTrend(a,[run('hard','2026-09-12',3100,170)]),null);assert.equal(sessionTrend(a,[{...b,summary:{...b.summary,temperature:35}}]),null);assert.equal(sessionTrend(a,[{...b,summary:{...b.summary,altitude:{ascent:400}}}]),null);
assert.equal(vo2Trend({...a,summary:{...a.summary,vo2max:52}},[b]).trend.tone,'bad');assert.equal(vo2Trend(a,[]),null);
console.log('Trends: favourable directions, adverse changes, unchanged/missing, neutral volume, comparable sessions and dated VO2 estimates passed.');
