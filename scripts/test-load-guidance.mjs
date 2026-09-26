import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function mod(name){let s=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,d)=>`from "${mod(d)}"`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
const {loadGuidance}=await import(mod('load-guidance-data'));
const now=new Date('2026-09-26T12:00:00Z');
function fixture(){const data={provider:'tredict',activities:[],sleep:{},hrv:{},extra:{bodyvalues:{bodyvalues:[]},efforts:{trainingEfforts:{}}},historyStart:'2026-01-01',historyComplete:true,syncedAt:now.toISOString()};for(let i=0;i<65;i++){const d=new Date(now);d.setDate(d.getDate()-i);const day=d.toISOString().slice(0,10),k=day.replaceAll('-','');data.activities.push({id:String(i),date:d.toISOString(),summary:{duration:3600,effort:{heartrate:40}}});data.sleep[k]=[28800];data.hrv[k]=[90,90,80,100];data.extra.bodyvalues.bodyvalues.push({timestamp:d.toISOString(),hrRestDynamic:50});}return data;}
let d=fixture();assert.equal(loadGuidance(d,now).tone,'steady');
d.hrv['20260926']=[89,90,80,100];assert.equal(loadGuidance(d,now).tone,'steady');
d.hrv['20260926']=[79,90,80,100];assert.equal(loadGuidance(d,now).tone,'easy');
d.sleep['20260926']=[6*3600];d.hrv['20260925']=[79,90,80,100];d.sleep['20260925']=[6*3600];assert.equal(loadGuidance(d,now).tone,'rest');
d=fixture();delete d.hrv['20260926'];assert.equal(loadGuidance(d,now).tone,'neutral');assert.equal(loadGuidance(d,now).coverage,2);
d=fixture();d.activities.slice(1,8).forEach(a=>a.summary.effort.heartrate=80);let r=loadGuidance(d,now);assert.equal(r.ramp,true);assert.equal(r.tone,'easy');
d=fixture();d.activities[0].summary.effort.heartrate=200;r=loadGuidance(d,now);assert.equal(r.bigToday,true);assert.equal(r.tone,'easy');
d=fixture();d.activities[8].summary.effort={};r=loadGuidance(d,now);assert.equal(r.timeOnly,true);assert.equal(r.ramp,false);
d=fixture();d.syncedAt='2026-09-25T12:00:00Z';assert.equal(loadGuidance(d,now).tone,'neutral');
d=fixture();assert.equal(loadGuidance(d,now,'tired').tone,'easy');assert.equal(loadGuidance(d,now,'unwell').tone,'rest');
d={activities:[],sleep:{},hrv:{}};assert.equal(loadGuidance(d,now).tone,'neutral');
console.log('Passed: stable ranges, small changes, persistent recovery flags, rapid ramp, big ride today, stale/missing readings, time fallback and subjective check.');
