import ts from 'typescript';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const source=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const profile=new Function(source('app/effort-profile-data.ts')+';return effortProfile')();
const power=Array.from({length:180},(_,i)=>i>=50&&i<90?300:100),altitude=power.map((_,i)=>100+i/10);
const detail={seriesSampled:{sampleSize:5,data:{power,altitude}},summary:{durationTotal:900},laps:[{duration:450,power:180},{duration:450,power:120}]};
let result=profile(detail);assert.equal(result.laps.length,2);assert.equal(result.efforts.length,1);assert.ok(result.efforts[0].mean>250);assert.ok(result.efforts[0].gain>0);
assert.equal(profile({...detail,laps:[{duration:100}]}).laps.length,0);
assert.equal(profile({...detail,seriesSampled:{data:{power}}}).rows.length,0);
assert.equal(profile({...detail,seriesSampled:{sampleSize:5,data:{power:power.map(()=>100),altitude}}}).efforts.length,0);
const gaps=profile({...detail,seriesSampled:{sampleSize:5,data:{power:power.map((v,i)=>i>=60&&i<90?null:v),altitude}}});assert.ok(gaps.efforts.every(e=>e.end<=5||e.start>=7.5));
const metrics=new Function(source('app/sports.ts')+source('app/activity-metrics.ts')+';return activityMetrics')();
const summary={steps:9000,stepLength:100,groundContactTime:210,calories:400,cadence:80,power:150};
let cards=metrics({sportType:'cycling',summary}).cards;assert.ok(!cards.some(c=>['steps','stepLength','groundContactTime'].includes(c.id)));assert.equal(cards.find(c=>c.id==='cadence').unit,'rpm');assert.ok(cards.some(c=>c.id==='power'));
cards=metrics({sportType:'running',summary}).cards;assert.ok(cards.some(c=>c.id==='steps'));assert.ok(cards.some(c=>c.id==='stepLength'));console.log('Sport filtering, aligned laps, gaps and sustained effort detection passed.');

// Watch laps include timer rounding/pauses; sampled distance locates the boundary.
const watch={summary:{duration:4390,durationTotal:4522},seriesSampled:{sampleSize:5,data:{speed:Array(878).fill(3),altitude:Array(878).fill(50),distance:Array.from({length:878},(_,i)=>14011*(i+1)/878)}},laps:[{duration:3791.21,distance:11998.66},{duration:611.67,distance:2013.09}]};
const watchResult=profile(watch,'speed');
assert.equal(watchResult.laps.length,2);
assert.match(watchResult.reason,/recorded distance/);
assert.ok(watchResult.laps[0].end<3791.21/60);
assert.equal(watchResult.laps[0].end,watchResult.laps[1].start);
assert.equal(watchResult.laps[1].end,4390/60);
const badDistance=[...watch.seriesSampled.data.distance];badDistance[300]=0;
assert.match(profile({...watch,seriesSampled:{...watch.seriesSampled,data:{...watch.seriesSampled.data,distance:badDistance}}},'speed').reason,/approximate/);
assert.equal(profile({...watch,laps:[{duration:100,distance:100}]},'speed').laps.length,0);
assert.equal(profile({...watch,mergedIds:['a','b']},'speed').laps.length,0);
console.log('Watch pause mismatch aligns by complete distance; resets, incomplete laps and unaligned merges stay rejected.');

const noDistance={...watch,seriesSampled:{...watch.seriesSampled,data:{speed:watch.seriesSampled.data.speed,altitude:watch.seriesSampled.data.altitude}}};
const fitted=profile(noDistance,'speed');assert.equal(fitted.laps.length,2);assert.equal(fitted.laps[0].end,fitted.laps[1].start);assert.ok(Math.abs(fitted.laps[1].end-4390/60)<1e-9);assert.match(fitted.reason,/approximate/);
assert.equal(profile({...noDistance,laps:[{duration:3000},{duration:600}]},'speed').laps.length,0);
const shortDistance={...watch,seriesSampled:{...watch.seriesSampled,data:{...watch.seriesSampled.data,distance:watch.seriesSampled.data.distance.slice(1)}}};
assert.match(profile(shortDistance,'speed').reason,/recorded distance/);
console.log('Small timer mismatch and unequal stream lengths remain selectable; large mismatch stays unaligned.');

const leadingBlank={...watch,seriesSampled:{...watch.seriesSampled,data:{...watch.seriesSampled.data,distance:[null,...watch.seriesSampled.data.distance.slice(1)]}}};
assert.match(profile(leadingBlank,'speed').reason,/recorded distance/);
assert.equal(profile(leadingBlank,'speed').laps.length,2);
console.log('Tredict leading blank distance sample preserves distance-based lap selection.');
