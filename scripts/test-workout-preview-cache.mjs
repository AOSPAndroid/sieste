// Exercises the saved Tredict POST boundary with synthetic storage and identity.
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const compile=path=>ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const savedSource=compile('app/api/sync/tredict-saved.ts');
const clock=Date.parse('2026-10-04T19:00:00Z');
const activity={id:'run',date:'2026-10-04T16:09:00Z',sportType:'running',summary:{duration:3000,durationTotal:3300,distance:10000}};
const signature=value=>JSON.stringify([value.date,value.sportType,value.subSportType??null,value.summary??null]);
const cacheKey='owner/workout-cache-v1/account-identity/preview-elevation-v1/run.json';
const ready={id:'run',summary:activity.summary,laps:[{duration:1500,distance:5000},{duration:1500,distance:5000}],previewVersion:1,elevationPreview:{version:1,min:40,max:70,segments:[[{x:0,metres:40},{x:.5,metres:70},{x:1,metres:45}]]}};
const fullReady={...ready,evidence:{version:1},seriesSampled:{sampleSize:1000,data:{altitude:[40,70,45],heartrate:[130,145,138]}}};
async function scenario({age,detail,entrySignature=signature(activity),action='preview',legacyCache=false}){
 const key=action==='preview'?cacheKey:cacheKey.replace('preview-elevation-v1',action==='enrich'?'enrich-preview-v2':action);
 const seededKey=legacyCache?key.replace('enrich-preview-v2','enrich'):key;
 const objects=new Map([['snapshot.json',{activities:[activity],sleep:{},hrv:{}}],[seededKey,{signature:entrySignature,savedAt:clock-age,detail}]]);
 const writes=[],calls=[],analyses=[];
 const row={owner:'athlete',revision:'connection-1',snapshot_key:'snapshot.json',token_ciphertext:'sealed-synthetic',updated_at:new Date(clock).toISOString()};
 const bucket={get:async k=>objects.has(k)?{json:async()=>structuredClone(objects.get(k))}:null,put:async(k,v)=>{objects.set(k,JSON.parse(v));writes.push(k)},delete:async k=>objects.delete(k)};
 const db={prepare:sql=>({bind:()=>({all:async()=>({results:[]})})})};
 const dependencies={
  healthDay:()=> '20261004',hasDailyReading:()=>false,mergeRecentSnapshot:(a,b)=>({...a,...b}),sessionLabels:[],
  analysisIdentity:async()=> 'account-identity',analysisSignature:signature,restoreAnalyses:async(_,__,data)=>data,
  saveAnalysis:async(...args)=>analyses.push(args),workoutExclusions:async()=>[],filteredSnapshot:async(_,data)=>data,
  getChatGPTUser:async()=>({userId:'athlete',displayName:'Synthetic athlete'}),chatGPTSignInPath:()=>'/signin',chatGPTSignOutPath:()=>'/signout',
  connection:async()=>row,storage:()=>({bucket,db,key:'unused-synthetic'}),privateJson:(body,status=200)=>Response.json(body,{status}),
  sameOrigin:()=>true,ownerPrefix:async()=> 'owner/',removeObjects:async()=>{},seal:async()=> 'sealed-synthetic',unseal:async()=> 'synthetic-provider-token',
  tredict:async request=>{const body=await request.json();calls.push(body);return Response.json({details:[structuredClone(action==='detail'?fullReady:ready)]})},corosConnection:async()=>null
 };
 const {POST}=new Function(...Object.keys(dependencies),savedSource+';return {POST}')(...Object.values(dependencies));
 const request=new Request('https://sieste.test/api/sync',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://sieste.test'},body:JSON.stringify({action,id:'run',...(action==='enrich'?{ids:['run']}:{}),token:'__saved__'})});
 const response=await POST(request);assert.equal(response.status,200);const body=await response.json();
 assert.ok(!JSON.stringify(body).includes('synthetic-provider-token'),'Provider token never appears in response');
 return {body,calls,writes,objects,analyses,key};
}
let failures=0;
const originalNow=Date.now;Date.now=()=>clock;
async function test(name,run){try{await run();console.log('PASS',name)}catch(error){failures++;console.log('FAIL',name,error.message)}}
try{
 await test('Missing elevation older than 60s refetches despite an unchanged activity summary',async()=>{
  const result=await scenario({age:60001,detail:{...ready,elevationPreview:null}});
  assert.equal(result.calls.length,1,'Do not retain a temporary absence for24h');
  assert.deepEqual(result.body.details[0].elevationPreview,ready.elevationPreview);
  assert.equal(result.writes.length,1);assert.equal(result.objects.get(result.key).savedAt,clock);
  assert.equal(result.analyses.length,0,'Home preview refresh does not write full activity analysis');
 });
 await test('Legacy preview without an elevation field also retries after60s',async()=>{
  const {elevationPreview,...legacy}=ready;
  const result=await scenario({age:90000,detail:legacy});assert.equal(result.calls.length,1);assert.ok(result.body.details[0].elevationPreview);
 });
 await test('Negative preview is reused briefly to avoid repeated provider calls',async()=>{
  const result=await scenario({age:59999,detail:{...ready,elevationPreview:null}});assert.equal(result.calls.length,0);assert.equal(result.body.details[0].elevationPreview,null);assert.equal(result.writes.length,0);
 });
 await test('Exactly60s is the negative preview expiry boundary',async()=>{
  const result=await scenario({age:60000,detail:{...ready,elevationPreview:null}});assert.equal(result.calls.length,1);
 });
 await test('A ready elevation preview remains cached for24h',async()=>{
  const result=await scenario({age:86400000-1,detail:ready});assert.equal(result.calls.length,0);assert.deepEqual(result.body.details[0].elevationPreview,ready.elevationPreview);assert.equal(result.writes.length,0);
 });
 await test('Ready preview expires at24h',async()=>{
  const result=await scenario({age:86400000,detail:ready});assert.equal(result.calls.length,1);
 });
 await test('Changed activity summary invalidates even a ready preview',async()=>{
  const result=await scenario({age:1000,detail:ready,entrySignature:'old-summary'});assert.equal(result.calls.length,1);
 });
 await test('Incomplete full details older than60s refetch their recorded sensors',async()=>{
  const result=await scenario({age:60001,detail:{...ready,elevationPreview:null},action:'detail'});
  assert.equal(result.calls.length,1);assert.deepEqual(result.body.details[0].elevationPreview,ready.elevationPreview);
  assert.deepEqual(result.body.details[0].seriesSampled,fullReady.seriesSampled);assert.equal(result.analyses.length,1);
 });
 await test('Legacy full details without the compact elevation field also retry after60s',async()=>{
  const {elevationPreview,...legacy}=fullReady;
  const result=await scenario({age:90000,detail:legacy,action:'detail'});assert.equal(result.calls.length,1);assert.ok(result.body.details[0].elevationPreview);
 });
 await test('Recently incomplete full details are briefly cached',async()=>{
  const result=await scenario({age:59999,detail:{...ready,elevationPreview:null},action:'detail'});
  assert.equal(result.calls.length,0);assert.equal(result.body.details[0].elevationPreview,null);assert.equal(result.writes.length,0);
 });
 await test('Incomplete full details expire exactly at60s',async()=>{
  const result=await scenario({age:60000,detail:{...ready,elevationPreview:null},action:'detail'});assert.equal(result.calls.length,1);
 });
 await test('Ready full details retain the24h cache policy',async()=>{
  const result=await scenario({age:86400000-1,detail:fullReady,action:'detail'});
  assert.equal(result.calls.length,0);assert.deepEqual(result.body.details[0].seriesSampled,fullReady.seriesSampled);assert.equal(result.writes.length,0);
 });
 await test('Summary-only enrichment keeps its24h cache policy',async()=>{
  const result=await scenario({age:3600000,detail:{id:'run',summary:activity.summary,evidence:{version:1}},action:'enrich'});assert.equal(result.calls.length,0);
 });
 await test('Legacy summary-only enrichment cache is skipped to retrieve laps and elevation',async()=>{
  const result=await scenario({age:1000,detail:{id:'run',summary:activity.summary,evidence:{version:1}},action:'enrich',legacyCache:true});
  assert.equal(result.calls.length,1);assert.deepEqual(result.calls[0].ids,['run']);
  assert.deepEqual(result.body.details[0].laps,ready.laps);assert.deepEqual(result.body.details[0].elevationPreview,ready.elevationPreview);
  assert.ok(result.objects.has('owner/workout-cache-v1/account-identity/enrich-preview-v2/run.json'));
 });
}finally{Date.now=originalNow}
if(failures)process.exitCode=1;
