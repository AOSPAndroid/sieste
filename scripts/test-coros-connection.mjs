import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const source=file=>ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const {seal,unseal}=new Function(source('db/token-crypto.ts')+';return {seal,unseal}')();
const secret=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
const encrypted=await seal('test-access',secret,'alice:coros');assert.equal(await unseal(encrypted,secret,'alice:coros'),'test-access');await assert.rejects(unseal(encrypted,secret,'bob:coros'));
const db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
const storage=()=>({db:{prepare:sql=>({bind:(...args)=>({first:async()=>db.prepare(sql).get(...args),run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}})})})}});
let exchangeCount=0;
const callback=new Function('getChatGPTUser','storage','decodeCredentials','encodeCredentials','issuer','corosJson','tokenCredentials',source('app/api/coros/callback/route.ts')+';return GET')(
 async()=>({userId:'alice'}),storage,async()=>({clientId:'test-client',verifier:'test-verifier',redirectUri:'https://sieste.test/api/coros/callback',region:'eu'}),async()=>encrypted,()=> 'https://mcpeu.coros.com',async()=>{exchangeCount++;return {access_token:'test-access'}},p=>p);
const insert=(state,owner='alice',expires='2099-01-01')=>db.prepare('INSERT INTO coros_oauth_states VALUES (?,?,?,?)').run(state,owner,'encrypted-pending',expires);
const req=(state,cookie=state)=>new Request('https://sieste.test/api/coros/callback?code=test-code&state='+state,{headers:{Cookie:'sieste_coros_state='+cookie}});
insert('valid');assert.equal((await callback(req('valid','wrong'))).headers.get('location'),'/?coros=expired');assert.equal(exchangeCount,0);
insert('other','bob');assert.equal((await callback(req('other'))).headers.get('location'),'/?coros=expired');assert.equal(exchangeCount,0);
insert('expired','alice','2000-01-01');assert.equal((await callback(req('expired'))).headers.get('location'),'/?coros=expired');assert.equal(exchangeCount,0);
assert.equal((await callback(req('valid'))).headers.get('location'),'/?coros=connected');assert.equal(exchangeCount,1);assert.equal((await callback(req('valid'))).headers.get('location'),'/?coros=expired');assert.equal(exchangeCount,1);assert.equal(db.prepare('SELECT count(*) n FROM coros_connections WHERE owner = ?').get('bob').n,0);
class CorosError extends Error{constructor(message,status){super(message);this.status=status}}
let requests=[];const fetch=async(url,opts)=>{requests.push({url,opts});const request=JSON.parse(opts.body);if(request.method==='notifications/initialized')return new Response(null,{status:202});const result=request.method==='initialize'?{protocolVersion:'2025-03-26'}:request.method==='tools/list'?{tools:[{name:'querySleepData'}]}:{content:[{type:'text',text:'{"sleepDurationSeconds":28800}'}]};const text='event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\n\n';return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(text.slice(0,20)));c.enqueue(new TextEncoder().encode(text.slice(20)));c.close()}}),{headers:{'Content-Type':'text/event-stream','mcp-session-id':'test-session'}})};
const {createCorosClient,unwrapTool}=new Function('accessCredentials','issuer','CorosError','fetch',source('app/api/coros/mcp.ts')+';return {createCorosClient,unwrapTool}')(async()=>({accessToken:'test-only'}),()=> 'https://mcpeu.coros.com',CorosError,fetch);
const client=await createCorosClient({region:'eu'});assert.equal((await client.call('querySleepData')).sleepDurationSeconds,28800);assert.equal(requests[3].opts.headers['Mcp-Session-Id'],'test-session');assert.ok(requests.every(r=>r.url==='https://mcpeu.coros.com/mcp'&&r.opts.redirect==='manual'));await assert.rejects(client.call('nonexistent'));assert.throws(()=>unwrapTool({isError:true}));assert.deepEqual(unwrapTool({structuredContent:{a:1}}),{a:1});assert.deepEqual(unwrapTool({content:[{type:'text',text:'not structured'}]}),{text:'not structured'});
console.log('COROS: encryption isolation, migrations, OAuth owner/state/expiry/replay checks, persisted connection, MCP streamed responses and fail-closed errors passed.');
