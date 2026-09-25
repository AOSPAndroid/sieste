import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

function compile(file){return ts.transpileModule(readFileSync(new URL('../app/'+file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/^import .*;\s*$/mg,'').replace(/export default /g,'').replace(/export function /g,'function ')}
function hooks(){
 const slots=[];let cursor=0,pending=[];
 return {
  useState(value){const index=cursor++;slots[index]??={value};return [slots[index].value,update=>{slots[index].value=typeof update==='function'?update(slots[index].value):update}]},
  useRef(value){const index=cursor++;return slots[index]??=( {current:value} )},
  useEffect(effect,deps){const index=cursor++,old=slots[index];if(!old||deps.some((d,i)=>!Object.is(d,old.deps[i])))pending.push(()=>{old?.cleanup?.();slots[index]={deps,cleanup:effect()}})},
  render(fn){cursor=0;const output=fn();const effects=pending;pending=[];effects.forEach(fn=>fn());return output},
  unmount(){slots.forEach(s=>s?.cleanup?.())}
 };
}
const h=hooks(),calls=[];let fail=false,release=null;
const fetch=async(_url,options)=>{calls.push(options);if(release)await release.promise;return {ok:!fail,json:async()=>({details:[{laps:[{duration:60}],generation:calls.length}]})}};
const hook=new Function('useState','useRef','useEffect','fetch',compile('calendar-details.ts')+';return useCalendarDetails;')(h.useState,h.useRef,h.useEffect,fetch);
const render=(ids='run',token='athlete-a',version='sync-1')=>h.render(()=>hook(ids,token,false,version));
const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve()};
assert.deepEqual(render(),{});await settle();const first=render().run;assert.ok(first.laps);
render();await settle();assert.equal(calls.length,1,'Unrelated renders do not refetch');
render('ride');await settle();assert.ok(render('ride').ride);
assert.equal(render().run,first,'Returning to a calendar range keeps its laps');await settle();assert.equal(calls.length,2);
let resolve;release={promise:new Promise(r=>resolve=r)};
assert.equal(render('run','athlete-a','sync-2').run,first,'Sync retains bars while refreshing');
fail=true;resolve();await settle();release=null;
assert.equal(render('run','athlete-a','sync-2').run,first,'Refresh failures preserve the last successful preview');
fail=false;
assert.deepEqual(render('run','athlete-b','sync-2'),{},'A different connection never sees prior previews');await settle();assert.notEqual(render('run','athlete-b','sync-2').run,first);
release={promise:new Promise(r=>resolve=r)};render('old','athlete-b','sync-3');render('new','athlete-c','sync-3');resolve();await settle();release=null;
assert.equal(render('new','athlete-c','sync-3').old,undefined,'Cancelled requests cannot write old athlete data');h.unmount();

const p=hooks(),jsx=(type,props)=>({type,props});
const Page=new Function('useState','useEffect','_jsx',compile('retained-page.tsx')+';return RetainedPage;')(p.useState,p.useEffect,jsx);
const child={type:'expensive-workout-preview'},page=active=>p.render(()=>Page({active,children:child}));
assert.equal(page(false).props.children,false,'Unvisited pages remain lazy');
assert.equal(page(true).props.children,child);
assert.equal(page(false).props.children,child,'Visited pages retain the same subtree while hidden');
assert.equal(page(false).props.style.display,'none');assert.equal(page(true).props.children,child);
console.log('Tab retention: lazy first visit, retained subtrees, preview reuse, background refresh, failures and athlete isolation passed.');
