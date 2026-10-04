import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compiled=ts.transpileModule(readFileSync(new URL('../app/background-analysis.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/mg,'').replace('export function useBackgroundAnalysis','function useBackgroundAnalysis');
function scenario({enabled=true,isDemo=false,delayed=false,failure=false,fullHistory=false}={}){
 let effect,timer,cleanup,data={syncedAt:'2026-09-19T12:00:00Z',activities:Array.from({length:9},(_,i)=>({id:String(i),summary:{distance:1000},analyzed:i===8,evidence:i===8?{version:1,insightVersion:2}:undefined,hrHistogram:i===8?{}:undefined}))};
 const calls=[],writes=[],busy=[],previews=[];let release;const gate=new Promise(r=>release=r);
 const fetch=async(url,options)=>{calls.push(options);if(delayed)await gate;if(failure)return {ok:false};return {ok:true,json:async()=>({details:JSON.parse(options.body).ids.map(id=>({id,summary:{heartrate:145},hrHistogram:null,evidence:{version:1,insightVersion:2,best:{}},laps:[{duration:60}],elevationPreview:{version:1,min:10,max:20,segments:[]}}))})}};
 const hook=new Function('useEffect','useRef','useState','window','fetch','setTimeout','clearTimeout','startTransition','document','rememberWorkoutPreview',compiled+';return useBackgroundAnalysis;')(fn=>effect=fn,value=>({current:value}),()=>[false,v=>busy.push(v)],{setTimeout:fn=>(timer=fn,1)},fetch,fn=>{fn();return 2},()=>{},fn=>fn(),{visibilityState:'visible'},(token,id,detail)=>previews.push({token,id,detail}));
 hook({data,setData:update=>{data=update(data);writes.push(data)},token:'test-only',isDemo,enabled,fullHistory});cleanup=effect();
 return {calls,writes,busy,previews,run:()=>timer?.(),cancel:()=>cleanup?.(),release,read:()=>data};
}
let s=scenario();await s.run();assert.equal(s.calls.length,1,'Automatic analysis stays limited to four activities');assert.equal(s.writes.length,1);assert.equal(s.read().activities[0].summary.distance,1000);assert.equal(s.read().activities[0].summary.heartrate,145);assert.equal(s.read().activities[0].hrHistogram,null);assert.deepEqual(s.busy,[true,false]);assert.equal(s.previews.length,4,'Retrieved enrichment updates compact Home previews');assert.equal(s.previews[0].token,'test-only');assert.ok(s.previews[0].detail.elevationPreview);
s=scenario({fullHistory:true});await s.run();assert.equal(s.calls.length,2,'Explicit full analysis processes the remaining activities in batches');assert.equal(s.writes.length,2);assert.equal(s.previews.length,8);
s=scenario({enabled:false});await s.run();assert.equal(s.calls.length,0);
s=scenario({isDemo:true});await s.run();assert.equal(s.calls.length,0);
s=scenario({delayed:true});const pending=s.run();await Promise.resolve();s.cancel();s.release();await pending;assert.equal(s.writes.length,0,'Cancelled requests never write stale athlete data');assert.equal(s.previews.length,0,'Cancelled enrichment cannot populate another account’s cache');assert.equal(s.calls[0].signal.aborted,true);
s=scenario({failure:true});await s.run();assert.equal(s.writes.length,0);assert.equal(s.busy.at(-1),false);
console.log('Background analysis: batches, summary merge, disabled/demo guards, cancellation and failures passed.');
