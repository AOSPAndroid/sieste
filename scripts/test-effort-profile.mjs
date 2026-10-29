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
const metrics=new Function(source('app/sports.ts')+source('app/cycling-power-data.ts')+source('app/activity-metrics.ts')+';return activityMetrics')();
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

// Some watches append a timed final lap beyond the sampled active recording.
// Its missing distance must not hide earlier laps with complete route evidence.
const partial={sportType:'running',summary:{duration:600,durationTotal:720,distance:2100},seriesSampled:{sampleSize:5,data:{speed:Array(120).fill(3.5),altitude:Array(120).fill(50),distance:Array.from({length:120},(_,i)=>(i+1)*17.5)}},laps:[{duration:180.5,distance:630,heartrate:130},{summary:{duration:119.8,distance:420,heartrate:155}},{duration:300.2,distance:1050,heartrate:140},{duration:110,heartrate:135}]};
const original=JSON.stringify(partial),mapped=profile(partial,'speed');
assert.deepEqual(mapped.laps.map(lap=>lap.index),[1,2,3]);
assert.equal(mapped.laps[0].start,0);
assert.equal(mapped.laps[0].end,mapped.laps[1].start);
assert.equal(mapped.laps[1].end,mapped.laps[2].start);
assert.equal(mapped.laps.at(-1).end,10,'Final mapped lap ends at the active recording, never the unmatched timer');
assert.deepEqual(mapped.laps.map(lap=>lap.hr),[130,155,140],'Original lap numbers and recorded summary means stay intact');
assert.match(mapped.reason,/3 of 4 laps/);assert.match(mapped.reason,/Lap 4 has no matching route data/);
assert.equal(JSON.stringify(partial),original,'Alignment never edits the recorded lap metrics');
const mapPartial=patch=>profile({...partial,...patch},'speed');
assert.equal(mapPartial({laps:[partial.laps[0],partial.laps[3],partial.laps[1],partial.laps[2]]}).laps.length,0,'Unknown distance in a middle lap never shifts later boundaries');
assert.equal(mapPartial({laps:[...partial.laps.slice(0,3),{duration:110,distance:100}]}).laps.length,0,'Incomplete distance totals cannot become a partial match');
assert.equal(mapPartial({laps:[...partial.laps.slice(0,3),{duration:110,distance:-1}]}).laps.length,0,'Invalid negative distance is not a missing trailing lap');
const reset=[...partial.seriesSampled.data.distance];reset[40]=0;
assert.equal(mapPartial({seriesSampled:{...partial.seriesSampled,data:{...partial.seriesSampled.data,distance:reset}}}).laps.length,0,'Partial alignment cannot bridge a distance reset');
const missing=[...partial.seriesSampled.data.distance];missing.fill(null,40,50);
assert.equal(mapPartial({seriesSampled:{...partial.seriesSampled,data:{...partial.seriesSampled.data,distance:missing}}}).laps.length,0,'Partial alignment cannot bridge missing distance samples');
assert.equal(mapPartial({summary:{duration:690,durationTotal:720}}).laps.length,0,'A prefix must account for the sampled active timeline');
assert.equal(mapPartial({laps:[{duration:60,distance:630},{duration:60,distance:420},{duration:60,distance:1050},partial.laps[3]]}).laps.length,0,'Partial alignment cannot consume unexplained sensor time');
assert.equal(mapPartial({mergedIds:['a','b']}).laps.length,0,'Partial alignment never bridges merged recordings');
const zeroDistance=mapPartial({laps:[...partial.laps.slice(0,3),{duration:110,distance:0}]});
assert.equal(zeroDistance.laps.length,3);
const timed=mapPartial({laps:[{duration:500,distance:2100},{duration:100,distance:0}]});
assert.equal(timed.laps.length,2,'A zero-distance lap with valid timing still keeps its sensor range');
assert.equal(timed.laps[1].start,500/60);
console.log('Complete lap prefixes stay selectable despite unmatched trailing timers; ambiguous distances, gaps, resets and merged timelines stay rejected.');
