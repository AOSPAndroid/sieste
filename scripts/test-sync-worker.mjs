// Regression: exercise the actual Workers fetch implementation, not Node's fetch.
import {Miniflare,createFetchMock} from 'miniflare';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const route=ts.transpileModule(readFileSync(new URL('../app/api/sync/tredict.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const mock=createFetchMock();mock.disableNetConnect();
const pool=mock.get('https://www.tredict.com');
const stamp=new Date().toISOString();const day=stamp.slice(0,10).replaceAll('-','');
pool.intercept({path:/^\/api\/oauth\/v2\/activityList\?/}).reply(200,{_embedded:{activityList:[{id:'fixture',date:stamp,sportType:'misc',subSportType:'strength_training',summary:{duration:2614,heartrate:87}}]}});
pool.intercept({path:/^\/api\/oauth\/v2\/sleep\?/}).reply(200,{sleep:{[day]:[28800,28000]}});
pool.intercept({path:/^\/api\/oauth\/v2\/hrv\?/}).reply(200,{hrv:{[day]:[65,60]}});
for(const endpoint of ['efforts','bodyvalues','capacity','zones','equipmentList','plannedTrainingList'])pool.intercept({path:new RegExp('^/api/oauth/v2/'+endpoint+'(?:\\?|$)')}).reply(200,{});
const worker=new Miniflare({modules:true,compatibilityDate:'2026-05-15',fetchMock:mock,script:route+'\nexport default {fetch:POST};'});
try{
const request=()=>worker.dispatchFetch('https://flemme.test/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-test-token'})});
const response=await request();const data=await response.json();assert.equal(response.status,200);assert.equal(data.activities[0].summary.duration,2614);assert.equal(data.activities[0].sportType,'misc');assert.equal(data.activities[0].subSportType,'strength_training');assert.equal(data.sleep[day][0],28800);assert.equal(data.hrv[day][0],65);assert.deepEqual(data.warnings,[]);
pool.intercept({path:/^\/api\/oauth\/v2\/activityList\?/}).reply(302,'',{headers:{location:'https://untrusted.test/'}});
pool.intercept({path:/^\/api\/oauth\/v2\/sleep\?/}).reply(200,{sleep:{}});
pool.intercept({path:/^\/api\/oauth\/v2\/hrv\?/}).reply(200,{hrv:{}});
assert.equal((await request()).status,502);
console.log('Workers runtime: training, sleep and HRV sync succeeds; redirects are rejected without forwarding credentials.');
}finally{await worker.dispose()}
