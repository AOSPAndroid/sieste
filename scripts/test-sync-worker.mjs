// Regression: exercise the actual Workers fetch implementation, not Node's fetch.
import {Miniflare,createFetchMock} from 'miniflare';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),modules=new Map();
function include(file){
 const absolute=path.resolve(root,file),modulePath=absolute.replace(/\.ts$/,'.mjs');
 if(modules.has(absolute))return modulePath;
 const module={type:'ESModule',path:modulePath,contents:''};modules.set(absolute,module);
 module.contents=ts.transpileModule(readFileSync(absolute,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,specifier)=>{
  assert.ok(specifier.startsWith('.'),'Runtime test only needs repository modules: '+specifier);
  const dependency=include(path.resolve(path.dirname(absolute),specifier+'.ts'));
  let relative=path.relative(path.dirname(modulePath),dependency).replaceAll('\\','/');if(!relative.startsWith('.'))relative='./'+relative;
  return 'from '+JSON.stringify(relative);
 });
 return modulePath;
}
include('app/api/sync/tredict.ts');modules.values().next().value.contents+='\nexport default {fetch:POST};';
const mock=createFetchMock();mock.disableNetConnect();
const pool=mock.get('https://www.tredict.com');
const stamp=new Date().toISOString();const day=stamp.slice(0,10).replaceAll('-','');
pool.intercept({path:/^\/api\/oauth\/v2\/activityList\?/}).reply(200,{_embedded:{activityList:[{id:'fixture',date:stamp,sportType:'misc',subSportType:'strength_training',summary:{duration:2614,heartrate:87}}]}});
pool.intercept({path:/^\/api\/oauth\/v2\/sleep\?/}).reply(200,{sleep:{[day]:[28800,28000]}});
pool.intercept({path:/^\/api\/oauth\/v2\/hrv\?/}).reply(200,{hrv:{[day]:[65,60]}});
for(const endpoint of ['efforts','bodyvalues','capacity','zones','equipmentList','plannedTrainingList'])pool.intercept({path:new RegExp('^/api/oauth/v2/'+endpoint+'(?:\\?|$)')}).reply(200,{});
const worker=new Miniflare({modules:[...modules.values()],modulesRoot:root,compatibilityDate:'2026-05-15',fetchMock:mock});
try{
const request=()=>worker.dispatchFetch('https://flemme.test/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-test-token'})});
assert.equal((await worker.dispatchFetch('https://flemme.test/api/sync',{method:'POST',headers:{Origin:'https://untrusted.test','Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-test-token'})})).status,403);
assert.equal((await worker.dispatchFetch('https://flemme.test/api/sync',{method:'POST',headers:{'Content-Type':'text/plain'},body:'synthetic-test-token'})).status,415);
assert.equal((await worker.dispatchFetch('https://flemme.test/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'contains spaces'})})).status,400);
const response=await request();const data=await response.json();assert.equal(response.status,200);assert.equal(data.activities[0].summary.duration,2614);assert.equal(data.activities[0].sportType,'misc');assert.equal(data.activities[0].subSportType,'strength_training');assert.equal(data.sleep[day][0],28800);assert.equal(data.hrv[day][0],65);assert.deepEqual(data.warnings,[]);
pool.intercept({path:/^\/api\/oauth\/v2\/activityList\?/}).reply(302,'',{headers:{location:'https://untrusted.test/'}});
pool.intercept({path:/^\/api\/oauth\/v2\/sleep\?/}).reply(200,{sleep:{}});
pool.intercept({path:/^\/api\/oauth\/v2\/hrv\?/}).reply(200,{hrv:{}});
assert.equal((await request()).status,502);
console.log('Workers runtime: training, sleep and HRV sync succeeds; redirects are rejected without forwarding credentials.');
}finally{await worker.dispose()}
