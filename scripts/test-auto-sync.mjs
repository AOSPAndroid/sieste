import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8'),source=page.slice(page.indexOf('async function restoreAccount()'),page.indexOf('useEffect(()=>{if(restored.current)'));
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const saved={activities:[{id:'saved'}],sleep:{},hrv:{},historyVersion:2},fresh={activities:[{id:'fresh'}],sleep:{},hrv:{}};
async function scenario(state,result){const calls=[],events=[];let release;const gate=new Promise(r=>release=r);const fetch=async(url,options)=>{calls.push(options);if(calls.length===1)return {ok:true,json:async()=>state};await gate;return result};const setters=['setAccountLoading','setAccount','setToken','setBusy','setError','setData','setIsDemo'];const run=new Function('fetch',...setters,compiled+';return restoreAccount();')(fetch,...setters.map(k=>v=>events.push([k,v])));await new Promise(r=>setImmediate(r));return {calls,events,finish:async()=>{release();await run}}}
let s=await scenario({signedIn:true,connected:true,data:saved},{ok:true,json:async()=>fresh});assert.equal(s.calls.length,2);assert.equal(JSON.parse(s.calls[1].body).token,'__saved__');assert.ok(s.events.some(([k,v])=>k==='setData'&&v===saved));assert.ok(s.events.some(([k,v])=>k==='setAccountLoading'&&v===false));await s.finish();assert.ok(s.events.some(([k,v])=>k==='setData'&&v===fresh));
s=await scenario({signedIn:true,connected:true,data:saved},{ok:false,json:async()=>({error:'Offline'})});await s.finish();assert.equal(s.events.filter(([k])=>k==='setData').length,1);assert.ok(s.events.some(([k,v])=>k==='setError'&&v.includes('saved dashboard')));
s=await scenario({signedIn:false,connected:false},null);await s.finish();assert.equal(s.calls.length,1);
s=await scenario({signedIn:true,connected:true,data:null},{ok:true,json:async()=>fresh});await s.finish();assert.ok(s.events.some(([k,v])=>k==='setData'&&v===fresh));
console.log('Passed: auto-sync even with current history, cached dashboard before refresh finishes, saved-token use, failure keeps snapshot, anonymous visits skip sync, empty snapshots recover.');
