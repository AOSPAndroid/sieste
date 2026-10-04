import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

function compile(file){return ts.transpileModule(readFileSync(new URL('../app/'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/mg,'').replace(/^export /gm,'')}
const cacheSource=compile('workout-detail-cache.ts'),hookSource=compile('calendar-details.ts');
const settle=async()=>{for(let i=0;i<60;i++)await Promise.resolve()};
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:(v)=>resolve(v)}};
const profile=(id,tag)=>({id,summary:{duration:600,tag},laps:[{duration:300},{duration:300}],elevationPreview:{version:1,min:10,max:30,segments:[[{x:0,metres:10},{x:1,metres:30}]],tag},previewVersion:1});
const incomplete=(id,tag)=>({id,summary:{duration:600,tag},laps:[{duration:300},{duration:300}],previewVersion:1});

function hooks(){
 const slots=[];let cursor=0,pending=[],renderFn,output,scheduled=false,closed=false,renderCount=0;
 const api={
  useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,update=>{const next=typeof update==='function'?update(slots[i].value):update;if(Object.is(next,slots[i].value)||closed)return;slots[i].value=next;if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;if(!closed&&renderFn)api.render(renderFn)})}}]},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial}},
  useEffect(effect,deps){const i=cursor++,old=slots[i];if(!old||deps.length!==old.deps.length||deps.some((v,j)=>!Object.is(v,old.deps[j])))pending.push(()=>{old?.cleanup?.();slots[i]={deps:[...deps],cleanup:effect()}})},
  render(fn){renderFn=fn;cursor=0;renderCount++;output=fn();const effects=pending;pending=[];effects.forEach(effect=>effect());return output},
  unmount(){closed=true;slots.forEach(slot=>slot?.cleanup?.())},
  get output(){return output},get renderCount(){return renderCount}
 };
 return api;
}
function scenario(handler){
 const calls=[];let clock=1_780_000_000_000;
 const fetch=async(url,options)=>{const request=JSON.parse(options.body);calls.push(request);const data=await handler(request,calls.length);return {ok:true,status:200,json:async()=>({details:[data]})}};
 const Clock=class extends Date{static now(){return clock}};
 const cache=new Function('fetch','Date',cacheSource+';return {cachedWorkout,loadWorkout,subscribeWorkoutPreviews,rememberWorkoutPreview,clearWorkoutCache};')(fetch,Clock);
 const h=hooks();
 const hook=new Function('useState','useRef','useEffect','cachedWorkout','loadWorkout','subscribeWorkoutPreviews',hookSource+';return useCalendarDetails;')(h.useState,h.useRef,h.useEffect,cache.cachedWorkout,cache.loadWorkout,cache.subscribeWorkoutPreviews);
 const render=(ids='run',token='athlete-a',sync='sync-1')=>h.render(()=>hook(ids,token,false,sync));
 return {cache,h,render,calls,advance:ms=>clock+=ms};
}

// An external enrichment publish must schedule the hook's own render. Merely
// manually rendering again would mask a missing subscription implementation.
{
 const s=scenario(({id})=>incomplete(id,'initial'));
 s.render();await settle();assert.equal(s.calls.length,1);
 const count=s.h.renderCount,full=profile('run','enrichment');
 s.cache.rememberWorkoutPreview('athlete-a','run',full);await settle();
 assert.ok(s.h.renderCount>count,'Background cache publish schedules a hook render');
 assert.equal(s.h.output.run.elevationPreview,full.elevationPreview);
 assert.equal(s.calls.length,1,'Background profile publish requires no duplicate fetch');s.h.unmount();
}

// A sync revision retries incomplete sensors despite their still-valid short
// TTL. Complete profiles retain their ten-minute cache and are not forced.
{
 let upgraded=false;const s=scenario(({id})=>upgraded?profile(id,'recovered'):incomplete(id,'old'));
 const complete=profile('complete','already-complete');s.cache.rememberWorkoutPreview('athlete-a','complete',complete);
 s.render('incomplete|complete');await settle();assert.equal(s.calls.length,1);assert.equal(s.calls[0].id,'incomplete');
 upgraded=true;s.render('incomplete|complete','athlete-a','sync-2');await settle();
 assert.equal(s.calls.length,2,'Sync retry bypasses incomplete profile TTL');assert.equal(s.calls[1].id,'incomplete');
 assert.equal(s.h.output.complete.elevationPreview,complete.elevationPreview,'Complete profile retained');
 assert.equal(s.h.output.incomplete.elevationPreview.tag,'recovered');
 s.render('incomplete|complete','athlete-a','sync-3');await settle();assert.equal(s.calls.length,2,'Next sync does not force complete previews');s.h.unmount();
}

// Incomplete previews and full details retry after one minute; complete ones
// keep the existing ten-minute client cache.
{
 const s=scenario(({id})=>id==='complete'?profile(id,'ready'):incomplete(id,'waiting'));
 for(const action of ['preview','detail']){
  await s.cache.loadWorkout('athlete-a','missing-'+action,action);
  const count=s.calls.length;s.advance(59999);
  await s.cache.loadWorkout('athlete-a','missing-'+action,action);assert.equal(s.calls.length,count);
  s.advance(1);await s.cache.loadWorkout('athlete-a','missing-'+action,action);assert.equal(s.calls.length,count+1);
 }
 await s.cache.loadWorkout('athlete-a','complete','preview');const count=s.calls.length;
 s.advance(600000-1);await s.cache.loadWorkout('athlete-a','complete','preview');assert.equal(s.calls.length,count);
 s.advance(1);await s.cache.loadWorkout('athlete-a','complete','preview');assert.equal(s.calls.length,count+1);s.h.unmount();
}

// Neither stale enrichment nor a details response missing sensors can remove
// a previously published complete Home profile.
{
 const s=scenario(({id,action})=>incomplete(id,'stale-'+action));
 const full=profile('run','complete');s.cache.rememberWorkoutPreview('athlete-a','run',full);
 s.render();await settle();assert.equal(s.calls.length,0);
 const cached=s.cache.cachedWorkout('athlete-a','run','preview');
 s.cache.rememberWorkoutPreview('athlete-a','run',incomplete('run','stale-enrich'));
 assert.equal(s.cache.cachedWorkout('athlete-a','run','preview'),cached);
 await s.cache.loadWorkout('athlete-a','run','detail',true);await settle();
 assert.equal(s.cache.cachedWorkout('athlete-a','run','preview'),cached,'Stale detail cannot erase complete preview');
 assert.equal(s.h.output.run.elevationPreview,full.elevationPreview);
 await s.cache.loadWorkout('athlete-a','run','enrich',true);await settle();
 assert.equal(s.cache.cachedWorkout('athlete-a','run','preview'),cached,'Enrich cache entry is isolated from preview');s.h.unmount();
}

// The request starts first; enrichment finishes first. Its fresh profile wins
// both the cache and the promise consumed by the calendar hook.
{
 const gate=deferred(),s=scenario(({id})=>gate.promise.then(()=>incomplete(id,'late-preview')));
 s.render();await settle();assert.equal(s.calls.length,1);
 const full=profile('run','fresh-enrich');s.cache.rememberWorkoutPreview('athlete-a','run',full);await settle();
 assert.equal(s.h.output.run.elevationPreview,full.elevationPreview);
 gate.resolve();await settle();assert.equal(s.h.output.run.elevationPreview,full.elevationPreview,'Late incomplete preview cannot replace fresh render');
 assert.equal(s.cache.cachedWorkout('athlete-a','run','preview').elevationPreview,full.elevationPreview);s.h.unmount();
}

// Even an older response carrying its own profile cannot replace a profile
// published after that request began.
{
 const gate=deferred(),s=scenario(({id})=>gate.promise.then(()=>profile(id,'older-response')));
 s.cache.rememberWorkoutPreview('athlete-a','run',profile('run','first'));s.render();await settle();
 const task=s.cache.loadWorkout('athlete-a','run','preview',true);await settle();assert.equal(s.calls.length,1);
 const newest=profile('run','newest-published');s.cache.rememberWorkoutPreview('athlete-a','run',newest);await settle();gate.resolve();
 const result=await task;await settle();assert.equal(result.elevationPreview,newest.elevationPreview);assert.equal(s.h.output.run.elevationPreview,newest.elevationPreview);s.h.unmount();
}

// A cache clear must remove both the immediate cache and the hook snapshot.
// Account changes and other accounts' cache notifications remain isolated.
{
 const s=scenario(({id,token})=>profile(id,token));s.render();await settle();
 const previous=s.h.output.run;s.cache.clearWorkoutCache();await settle();
 assert.deepEqual(s.h.output,{},'Cache clear removes the rendered snapshot');assert.equal(s.cache.cachedWorkout('athlete-a','run','preview'),null);
 s.render('run','athlete-b');await settle();assert.equal(s.h.output.run.elevationPreview.tag,'athlete-b');assert.notEqual(s.h.output.run,previous);
 const count=s.h.renderCount;s.cache.rememberWorkoutPreview('athlete-a','run',profile('run','old-account'));
 await settle();assert.equal(s.h.renderCount,count,'Another account publish cannot rerender the active hook');assert.equal(s.h.output.run.elevationPreview.tag,'athlete-b');s.h.unmount();
}

// Epoch checks reject an old response after clear; a switched account can load
// independently without the old callback populating its snapshot.
{
 const gate=deferred(),s=scenario(({id,token})=>token==='athlete-a'?gate.promise.then(()=>profile(id,'stale-a')):profile(id,'current-b'));
 s.render();await settle();s.cache.clearWorkoutCache();s.render('run','athlete-b');await settle();
 assert.equal(s.h.output.run.elevationPreview.tag,'current-b');gate.resolve();await settle();
 assert.equal(s.cache.cachedWorkout('athlete-a','run','preview'),null,'Cleared generation rejects old network response');assert.equal(s.h.output.run.elevationPreview.tag,'current-b');s.h.unmount();
}
console.log('Live preview regressions passed: subscribed renders, sync retry/TTL, complete-profile preservation, both response races, cache clear and athlete isolation.');
