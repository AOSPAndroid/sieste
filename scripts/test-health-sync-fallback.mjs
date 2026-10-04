import ts from 'typescript';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync('app/api/sync/route.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
let signedIn=true,corosConnected=true,status=401,healthCalls=0;
const saved={provider:'tredict',activities:[{id:'saved'}],sleep:{},hrv:{}},healthy={provider:'coros',activities:[],sleep:{20300102:[27000]},hrv:{20300102:[73]}};
class CorosError extends Error{constructor(message,status=502){super(message);this.status=status}}
const create=new Function('getChatGPTUser','privateJson','sameOrigin','corosConnection','CorosError','connection','tredict','corosSnapshot','syncCoros','combineProviders',source+';return providerPOST');
const post=create(async()=>signedIn?{userId:'synthetic-owner'}:null,(value,status=200)=>Response.json(value,{status}),()=>true,async()=>corosConnected?{owner:'synthetic-owner'}:null,CorosError,async()=>({owner:'synthetic-owner'}),{POST:async()=>Response.json({error:'Tredict rejected this token.'},{status}),GET:async()=>Response.json({data:saved})},async()=>healthy,async()=>{healthCalls++;return healthy},(training,health)=>({...training,sleep:health.sleep,hrv:health.hrv}));
const request=body=>new Request('https://sieste.example/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
for(status of [401,403,429,502]){const response=await post(request({token:'__saved__',phase:'workouts'}));assert.equal(response.status,status);assert.equal((await response.json()).canSyncHealth,true);assert.equal(healthCalls,0,'Workout phase only advertises independent health; it does not duplicate it');}
status=401;const health=await post(request({token:'__saved__',phase:'health'}));assert.equal(health.status,200);assert.deepEqual((await health.json()).activities,saved.activities);assert.equal(healthCalls,1);
const supplied=await post(request({token:'new-invalid-token',phase:'workouts'}));assert.equal(supplied.status,401);assert.equal((await supplied.json()).canSyncHealth,undefined);
corosConnected=false;const disconnected=await post(request({token:'__saved__',phase:'workouts'}));assert.equal(disconnected.status,401);assert.equal((await disconnected.json()).canSyncHealth,undefined);
signedIn=false;const signedOut=await post(request({token:'__saved__',phase:'workouts'}));assert.equal(signedOut.status,401);assert.equal((await signedOut.json()).canSyncHealth,undefined);assert.equal(healthCalls,1);
console.log('Health fallback boundary passed: saved Tredict failures retain status and allow connected COROS, health preserves saved workouts, supplied-token/sign-out/disconnected cases cannot request fallback.');
