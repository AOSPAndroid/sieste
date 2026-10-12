import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import ts from 'typescript';

const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const helpers=new Function(compile('app/api/sync/response.ts')+';return {dashboardHeaders,dashboardJson,matchesDashboardEtag}')();
const {dashboardJson,matchesDashboardEtag}=helpers;
const request=(encoding,extra={})=>new Request('https://sieste.example/api/sync',{headers:{...(encoding===undefined?{}:{'Accept-Encoding':encoding}),...extra}});
const read=async response=>{
 const bytes=Buffer.from(await response.arrayBuffer());
 return {bytes,body:JSON.parse(response.headers.get('Content-Encoding')==='gzip'?gunzipSync(bytes).toString():bytes.toString())};
};

const payload={activities:Array.from({length:80},(_,index)=>({id:'workout-'+index,date:'2026-10-12',summary:{distance:index*100},evidence:'recorded sensor summary '.repeat(30)})),sleep:{20261012:[28800]},hrv:{20261012:[95]}};
let serialized=0;
let response=dashboardJson({toJSON(){serialized++;return payload}},request('gzip'),{'Vary':'Origin, cookie','Cache-Control':'private, no-cache','Content-Length':'999999','Content-Encoding':'br'});
assert.equal(serialized,1,'The dashboard is serialized only once');
assert.equal(response.headers.get('Content-Encoding'),'gzip');
assert.equal(response.headers.get('Content-Length'),null);
assert.equal(response.headers.get('Content-Type'),'application/json; charset=utf-8');
assert.equal(response.headers.get('Cache-Control'),'private, no-cache');
assert.equal(response.headers.get('Vary'),'Origin, cookie, Accept-Encoding');
let decoded=await read(response);
assert.deepEqual(decoded.body,payload);
assert.ok(decoded.bytes.length<JSON.stringify(payload).length/4,'Actual gzip wire bytes reduce a representative history');

for(const encoding of [undefined,'br','identity','gzip;q=0','*;q=1, gzip;q=0','gzip;q=bogus','gzip;q=1.1','gzip;q=0.1234','gzip;q=0.5, identity;q=1','gzip;q=1,gzip;q=0']){
 response=dashboardJson(payload,request(encoding));
 assert.equal(response.headers.get('Content-Encoding'),null,'Identity must be used for '+encoding);
 assert.deepEqual((await read(response)).body,payload);
 assert.equal(response.headers.get('Cache-Control'),'no-store, private');
 assert.equal(response.headers.get('Vary'),'Cookie, Accept-Encoding');
}
for(const encoding of ['GZIP; q=0.7, identity;q=0.5','br;q=1, gzip;q=0.5','*;q=0.8','gzip;q=1.000','gzip ;q=1']){
 response=dashboardJson(payload,request(encoding));
 assert.equal(response.headers.get('Content-Encoding'),'gzip','Gzip is acceptable for '+encoding);
 assert.deepEqual((await read(response)).body,payload);
}
response=dashboardJson({small:true},request('gzip'));
assert.equal(response.headers.get('Content-Encoding'),null,'Small metadata responses avoid gzip overhead');
assert.deepEqual((await read(response)).body,{small:true});
for(const encoding of ['gzip, identity;q=0','gzip, *;q=0']){
 response=dashboardJson({small:true},request(encoding));
 assert.equal(response.headers.get('Content-Encoding'),'gzip','An excluded identity representation is never preferred');
 assert.deepEqual((await read(response)).body,{small:true});
}
response=dashboardJson({text:'🌙'.repeat(1300)},request('gzip'));
assert.equal(response.headers.get('Content-Encoding'),'gzip','The threshold uses UTF-8 bytes, not JavaScript character count');
await response.arrayBuffer();
assert.equal(matchesDashboardEtag('"other", "revision"','W/"revision"'),true);
assert.equal(matchesDashboardEtag('W/"revision"','"revision"'),true);
assert.equal(matchesDashboardEtag('*','W/"revision"'),true);
assert.equal(matchesDashboardEtag('W/"other"','W/"revision"'),false);

const user={userId:'owner-a',displayName:'Athlete'},before={provider:'tredict',...payload,syncedAt:'2026-10-12T10:00:00Z'};
const after={...before,activities:[{...before.activities[0],evidence:'new sensor summary '.repeat(600)},...before.activities.slice(1)],hrv:{20261012:[97]},syncedAt:'2026-10-12T10:01:00Z'};
let snapshot=before,snapshotReads=0,version='before';
const row={owner:user.userId,revision:'connection',snapshot_key:'private-snapshot',updated_at:'2026-10-12T10:00:00Z'};
const revision=new Function('storage',compile('db/dashboard-revision.ts')+';return {dashboardEtag}')(()=>({db:{prepare:()=>({bind:owner=>({first:async()=>{assert.equal(owner,user.userId);return {version}}})})}}));
const {createSyncDelta}=new Function(compile('app/sync-delta.ts')+';return {createSyncDelta}')();
const deps={
 ...helpers,...revision,createSyncDelta,getChatGPTUser:async()=>user,connection:async owner=>{assert.equal(owner,user.userId);return row},corosConnection:async()=>null,
 tredict:{DELETE:()=>{},loadSavedTredictData:async owner=>{assert.equal(owner,user.userId);snapshotReads++;return snapshot},POST:async()=>{snapshot=after;version='after';return Response.json(after,{headers:{'X-Sync-Refreshed':'1'}})}},
 corosSnapshot:async()=>null,combineProviders:training=>training,chatGPTSignOutPath:()=>'/signout-with-chatgpt',activityMerges:async()=>[],applyMerges:data=>data,
 privateJson:(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','Vary':'Cookie'}}),sameOrigin:req=>req.headers.get('Origin')===new URL(req.url).origin,
};
const route=new Function(...Object.keys(deps),compile('app/api/sync/route.ts')+';return {GET,POST}')(...Object.values(deps));
response=await route.GET(request('gzip'));
assert.equal(response.status,200);assert.equal(response.headers.get('Content-Encoding'),'gzip');
assert.equal(response.headers.get('Vary'),'Cookie, Accept-Encoding');assert.equal(response.headers.get('Cache-Control'),'private, no-cache');
const etag=response.headers.get('ETag');assert.match(etag,/^W\/"[a-f0-9]{64}"$/);
decoded=await read(response);assert.deepEqual(decoded.body.data,before);assert.equal(decoded.body.userId,user.userId);
response=await route.GET(request('gzip;q=0'));
assert.equal(response.headers.get('Content-Encoding'),null);assert.equal(response.headers.get('ETag'),etag,'Encoded variants share one weak semantic ETag');
assert.deepEqual((await read(response)).body.data,before);
const count=snapshotReads;
for(const conditional of [etag,etag.slice(2),'"foreign", '+etag,'*']){
 response=await route.GET(request('gzip',{'If-None-Match':conditional}));
 assert.equal(response.status,304);assert.equal(await response.text(),'');assert.equal(response.headers.get('Content-Encoding'),null);
 assert.equal(response.headers.get('Vary'),'Cookie, Accept-Encoding');assert.equal(response.headers.get('Cache-Control'),'private, no-cache');
 assert.equal(snapshotReads,count,'A conditional unchanged request does no snapshot work');
}
response=await route.GET(new Request('https://sieste.example/api/sync?changed=1',{headers:{'Accept-Encoding':'gzip'}}));
assert.equal(response.headers.get('Content-Encoding'),null);assert.equal((await read(response)).body.revision,etag);assert.equal(snapshotReads,count);
const post=body=>new Request('https://sieste.example/api/sync',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://sieste.example','Accept-Encoding':'gzip'},body:JSON.stringify(body)});
response=await route.POST(post({action:'sync',token:'__saved__',phase:'workouts',sinceRevision:etag,sinceSyncedAt:before.syncedAt}));
assert.equal(response.status,200);assert.equal(response.headers.get('Content-Encoding'),'gzip');assert.equal(response.headers.get('Cache-Control'),'no-store, private');
assert.equal(response.headers.get('Vary'),'Cookie, Accept-Encoding');assert.match(response.headers.get('Server-Timing'),/^workouts;dur=\d+$/);assert.notEqual(response.headers.get('ETag'),etag);
decoded=await read(response);assert.equal(decoded.body.format,'sieste-delta-v1');assert.equal(decoded.body.upserts.length,1);assert.deepEqual(decoded.body,createSyncDelta(before,after));
response=await route.POST(post({action:'sync',token:'__saved__',phase:'workouts'}));
assert.equal(response.headers.get('Content-Encoding'),'gzip');assert.deepEqual((await read(response)).body,after,'Full sync replies use the same compression boundary');
console.log('Passed sync compression: streamed wire gzip, q/identity negotiation, single serialization, private Vary headers, UTF-8 thresholds, semantic ETags, body-free 304s and compressed full/sparse route replies.');
