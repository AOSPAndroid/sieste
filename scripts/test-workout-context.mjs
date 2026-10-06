import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
process.env.TZ='Europe/Paris';
function module(path,imports={}){const exports={};const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;new Function('require','exports','React',source)(key=>{if(!(key in imports))throw new Error(`Unknown test import ${key}`);return imports[key]},exports,React);return exports}
const sports=module('app/sports.ts'),native=module('app/coros-native.ts'),data=module('app/workout-context-data.ts',{'./sports':sports,'./coros-native':native});
const now=new Date('2026-10-06T12:00:00Z');
const workout=(id,date,duration=3600,sportType='running',summary={})=>({id,date,sportType,summary:{duration,...summary}});
const current=workout('current','2026-10-02T23:45:00Z',3600),prior=workout('prior','2026-10-02T20:00:00Z',3600,'cycling',{durationTotal:5400}),next=workout('next','2026-10-03T12:00:00Z',1800),future=workout('future','2026-10-07T12:00:00Z');
assert.equal(data.workoutDay(current),'2026-10-03','Late UTC activity must use the local training day');
assert.equal(data.workoutDay({...current,localDay:'2026-10-02'}),'2026-10-02','Explicit provider-local day takes precedence');
const context=data.workoutContext(current,[next,current,prior,future,prior],now);
assert.equal(context.previous.id,'prior');assert.equal(context.next.id,'next');assert.equal(context.before.hours,2.25,'Break uses total elapsed completion, not moving duration');assert.equal(context.after.hours,11.25);assert.equal(data.workoutContext(next,[future,current],now).next,null,'Future records are not a planned next session');
assert.equal(data.workoutContext(current,[{...prior,summary:{}}],now).before.hours,null,'Unknown duration leaves the gap unknown');
assert.equal(data.workoutContext(current,[{...prior,summary:{durationTotal:36000}}],now).before.overlap,true,'Overlapping recordings do not create a negative recovery gap');

const health={activities:[],sleep:{},hrv:{},extra:{bodyvalues:{bodyvalues:[]}}};
for(let i=1;i<=28;i++){const d=new Date('2026-10-03T12:00:00');d.setDate(d.getDate()-i);const day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,key=day.replaceAll('-','');health.sleep[key]=[(7.5+i%3*.25)*3600];health.hrv[key]=[90+i%5];health.extra.bodyvalues.bodyvalues.push({timestamp:day+'T08:00:00Z',hrRestDynamic:50+i%2})}
health.sleep['20261003']=[18*3600];health.hrv['20261003']=[900]; // The training morning is not part of the prior baseline.
health.sleep['20261004']=[8*3600];health.hrv['20261004']=[88];health.extra.bodyvalues.bodyvalues.push({timestamp:'2026-10-04T07:00:00Z',hrRestDynamic:53});
health.sleep['20261005']=[7*3600];health.extra.bodyvalues.bodyvalues.push({timestamp:'2026-10-05T07:00:00Z',hrRestDynamic:49});
health.sleep['20261006']=[8.5*3600];health.hrv['20261006']=[94];health.extra.bodyvalues.bodyvalues.push({timestamp:'2026-10-06T07:00:00Z',hrRestDynamic:50},{timestamp:'2026-10-06T20:00:00Z',hrRestDynamic:99});
health.sleep['20261007']=[20*3600];health.hrv['20261007']=[999];
const following=workout('following','2026-10-04T08:00:00Z',7200,'cycling'),response=data.recoveryAfterWorkout(current,[current,next,following,future],health,now);
assert.equal(response.date,'2026-10-03');assert.equal(response.sessions.length,2,'Whole-day attribution includes the other session');assert.deepEqual(response.rows.map(r=>r.date),['2026-10-04','2026-10-05','2026-10-06']);assert.equal(response.rows[0].sessions.length,1);assert.equal(response.rows[1].hrv,null,'Missing HRV does not carry forward');assert.equal(response.rows[2].rhr,50,'A future same-day body reading must not leak into the view');
assert.equal(response.ranges.hrv.count,28);assert.ok(response.ranges.hrv.mean<100,'Prior range excludes the training day and later mornings');assert.ok(response.ranges.sleep.mean<8.1);assert.equal(response.ranges.rhr.count,28);
assert.equal(data.recoveryAfterWorkout(workout('today','2026-10-06T08:00:00Z'),[],health,now).rows.length,0,'Today has no fabricated following morning');
assert.equal(data.recoveryAfterWorkout(current,[],undefined,now).available,false);
const blanks=data.recoveryAfterWorkout(current,[],{activities:[],sleep:{},hrv:{}},now);assert.equal(blanks.ranges.hrv,null);assert.ok(blanks.rows.every(r=>r.sleep===null&&r.hrv===null&&r.rhr===null));
const partial={activities:[],sleep:Object.fromEntries(Object.entries(health.sleep).slice(0,6)),hrv:Object.fromEntries(Object.entries(health.hrv).slice(0,13)),extra:{bodyvalues:{bodyvalues:health.extra.bodyvalues.bodyvalues.slice(0,13)}}};
assert.deepEqual(data.recoveryAfterWorkout(current,[],partial,now).ranges,{sleep:null,hrv:null,rhr:null},'Minimum baseline coverage is enforced separately per metric');

const lift=workout('lift','2026-10-03T15:00:00Z',2400,'misc',{sets:14,aerobicTrainingEffect:1.7,anaerobicTrainingEffect:.5,exerciseTonnage:20000});lift.subSportType='strength_training';lift.provider='coros';
const oldLift=workout('old-lift','2026-10-01T15:00:00Z',1800,'strength_training',{sets:12}),oldLift2=workout('old-lift-2','2026-09-30T15:00:00Z',2000,'strength_training',{sets:10});
const strength=data.strengthSummary(lift,[next,oldLift2,future,oldLift],now);assert.equal(strength.current.sets,14);assert.equal(strength.current.aerobic,1.7);assert.equal(strength.current.anaerobic,.5);assert.equal(strength.durationChange,600);assert.equal(strength.setsChange,2);assert.equal(strength.previous[0].activity.id,'old-lift');assert.equal(strength.previous.length,2);assert.ok(!('exerciseTonnage' in strength.current));assert.equal(data.strengthSummary(current,[],now),null);
assert.equal(data.strengthSummary({...lift,summary:{duration:2400,sets:2.5}},[],now).current.sets,null,'Malformed fractional sets are not displayed');
assert.equal(data.strengthSummary({...lift,summary:{duration:2400,sets:0}},[],now).current.sets,0,'Recorded zero is distinct from missing');

const Icon=()=>React.createElement('svg',{'aria-hidden':true});const component=module('app/workout-context.tsx',{'react':{useMemo:fn=>fn()},'lucide-react':Object.fromEntries(['Activity','ArrowRight','Clock','Dumbbell','Heart','Moon','Wind'].map(k=>[k,Icon])),'./dashboard-calendar':{SportIcon:Icon,clockDuration:s=>s===null?'—':`${Math.round(s/60)} min`},'./sports':sports,'./workout-context-data':data,'./workout-context.css':{}});
const html=renderToStaticMarkup(React.createElement(component.RecoveryAfterWorkout,{detail:current,history:[current,next,following],healthData:health,now}));assert.match(html,/After the whole training day/);assert.match(html,/includes your other sessions/);assert.match(html,/Baseline &amp; coverage/);assert.match(html,/Resting HR/);assert.doesNotMatch(html,/999/);
const strip=renderToStaticMarkup(React.createElement(component.default,{detail:current,history:[prior,next],onSelect:()=>{},now}));assert.match(strip,/Open previous workout/);assert.match(strip,/Open next recorded workout/);assert.doesNotMatch(strip,/Strength session/,'Context must not duplicate the separately mounted strength summary');
console.log('Workout context: local dates, elapsed gaps, observed sequence, whole-day recovery attribution, baseline coverage, missing/future readings and recorded strength fields passed.');
