import {readFileSync} from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync('db/coros.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
let replies=[],calls=0,logged=[];
const fetch=async()=>{calls++;const next=replies.shift();if(next instanceof Error)throw next;return new Response(JSON.stringify(next.body??{}),{status:next.status})};
const console={error:(...a)=>logged.push(a)};
const {corosJson,CorosError}=new Function('fetch','console','storage','ownerPrefix','seal','unseal',source+';return {corosJson,CorosError}')(fetch,console,()=>{},()=>{},()=>{},()=>{});
const run=async(r,opts={delay:1})=>{replies=r;calls=0;logged=[];try{return {value:await corosJson('https://mcpeu.coros.test/oauth2/token',{method:'POST'},opts)}}catch(e){return {error:e}}};
let r=await run([{status:200,body:{access_token:'a'}}]);assert.equal(r.value.access_token,'a');assert.equal(calls,1);
// A rotated or revoked refresh token asks for a reconnect, without retrying.
r=await run([{status:400,body:{error:'invalid_grant',error_description:'secret detail'}}]);
assert.equal(r.error.status,401);assert.match(r.error.message,/Reconnect COROS/);assert.equal(calls,1);
assert.deepEqual(logged[0][1],{path:'/oauth2/token',status:400,error:'invalid_grant',attempt:0});
assert.ok(!JSON.stringify(logged).includes('secret detail'),'Error descriptions and tokens are never logged');
r=await run([{status:403}]);assert.equal(r.error.status,401);
// Temporary COROS failures retry once, then say so.
r=await run([{status:503},{status:200,body:{access_token:'b'}}]);assert.equal(r.value.access_token,'b');assert.equal(calls,2);
r=await run([{status:502},{status:500}]);assert.equal(r.error.status,503);assert.match(r.error.message,/temporarily unavailable/);assert.equal(calls,2);
r=await run([new TypeError('network'),new TypeError('network')]);assert.equal(r.error.status,503);assert.match(r.error.message,/did not respond/);assert.equal(calls,2);
r=await run([{status:429},{status:200}]);assert.equal(r.error.status,429);assert.equal(calls,1,'Rate limits are not hammered');
// Other client errors keep the generic message and do not retry.
r=await run([{status:400,body:{error:'invalid_request'}}]);assert.equal(r.error.status,502);assert.match(r.error.message,/Please retry/);assert.equal(calls,1);
r=await run([{status:503},{status:200}],{retries:0,delay:1});assert.equal(r.error.status,503);assert.equal(calls,1);
process.stdout.write('Passed COROS token errors: expired sign-in detected, transient failures retried once, rate limits respected, safe logging.\n');
