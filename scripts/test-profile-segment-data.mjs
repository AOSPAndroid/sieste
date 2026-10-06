import ts from 'typescript';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const transpile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const segmentStatistics=new Function(transpile('app/segment-statistics.ts').replaceAll('export ','')+';return segmentStatistics')();
const code=transpile('app/profile-segment-data.ts').replace(/import \{ segmentStatistics \} from ['"]\.\/segment-statistics['"];\s*/,'').replaceAll('export ','');
const calculate=new Function('segmentStatistics',code+';return profileSegmentStats')(segmentStatistics);
const segment=(start,end)=>({start:start/60,end:end/60});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} should equal ${expected}`);
const rows=(values,step=10)=>values.map((value,index)=>({time:index*step/60,...value}));

// Boundary samples contribute only their overlap, including the preceding sample.
const partial=rows([{power:100,speed:2,heartrate:100,cadence:70,stepLength:60},{power:300,speed:4,heartrate:150,cadence:90,stepLength:80},{power:500,speed:8,heartrate:200,cadence:110,stepLength:100}]);
let result=calculate(partial,10,segment(5,22));
near(result.durationSeconds,17);
near(result.mean.power,(100*5+300*10+500*2)/17);
near(result.mean.speed,(2*5+4*10+8*2)/17);
near(result.mean.heartrate,(100*5+150*10+200*2)/17);
near(result.mean.cadence,(70*5+90*10+110*2)/17);
near(result.mean.stepLength,(60*5+80*10+100*2)/17);
near(result.distance,66);
assert.equal(result.samples[0],partial[0]);
assert.equal(result.samples[2].time,20/60);

// Complete cumulative distances take precedence over a conflicting speed stream.
const cumulative=rows([{distance:100,speed:20},{distance:130,speed:20},{distance:170,speed:20},{distance:210,speed:20}]);
result=calculate(cumulative,10,segment(5,25));
near(result.distance,75);
assert.equal(result.samples.length,3);
assert.equal(calculate(cumulative,10,segment(0,30)).distance,110);
assert.equal(calculate(rows([{distance:30},{distance:30},{distance:30}]),10,segment(2,18)).distance,0);

// Neither missing cumulative points nor source-time gaps may be bridged.
const missingDistance=rows([{distance:0},{distance:null},{distance:50},{distance:75}]);
assert.equal(calculate(missingDistance,10,segment(0,25)).distance,null);
assert.equal(calculate(rows([{distance:0},{distance:20},{distance:5},{distance:30}]),10,segment(0,30)).distance,null);
assert.equal(calculate([{time:0,distance:0,speed:2},{time:20/60,distance:40,speed:2},{time:30/60,distance:60,speed:2}],10,segment(0,30)).distance,null);
assert.equal(calculate(rows([{speed:2},{speed:null},{speed:4}]),10,segment(0,30)).distance,null);
assert.equal(calculate(rows([{distance:0},{distance:20}]),10,segment(0,20)).distance,null,'A final cumulative point is not extrapolated');
const speedFallback=rows([{distance:0,speed:2},{distance:null,speed:0},{distance:50,speed:4}]);
assert.equal(calculate(speedFallback,10,segment(0,30)).distance,60,'Complete speed evidence can replace incomplete cumulative distance');
assert.equal(calculate(rows([{distance:20,speed:2},{distance:5,speed:2},{distance:25,speed:2}]),10,segment(0,20)).distance,40,'A reset is not used, but a complete independent speed stream is valid');

// Missing and invalid physiological signals stay null; coasting remains evidence.
result=calculate(rows([{power:0,speed:0,heartrate:0,cadence:0,stepLength:0},{power:200,speed:4,heartrate:140,cadence:80,stepLength:90}]),10,segment(0,20));
assert.equal(result.mean.power,100);
assert.equal(result.mean.speed,2);
assert.equal(result.mean.heartrate,140);
assert.equal(result.mean.cadence,80);
assert.equal(result.mean.stepLength,90);
assert.equal(result.distance,40);
result=calculate(rows([{power:null,speed:NaN,heartrate:0,cadence:-2,stepLength:null}]),10,segment(0,10));
assert.deepEqual(result.mean,{power:null,speed:null,heartrate:null,cadence:null,stepLength:null});
assert.deepEqual(result.stats,{normalized:null,maxPower:null,maxHR:null,maxCadence:null,maxSpeed:null});
assert.equal(result.distance,null);
assert.equal(calculate(rows([{power:0,speed:0}]),10,segment(0,10)).distance,0);

// Valid recorded lap fields override the sampled estimates without fabrication.
const lap={duration:23,distance:500,power:0,speed:0,heartrate:170,cadence:95,stepLength:110,powerMax:700,speedMax:12,heartrateMax:190,cadenceMax:120};
result=calculate(partial,10,segment(5,22),lap);
assert.equal(result.durationSeconds,23);
assert.equal(result.distance,500);
assert.deepEqual(result.mean,{power:0,speed:0,heartrate:170,cadence:95,stepLength:110});
assert.deepEqual(result.stats,{normalized:null,maxPower:700,maxHR:190,maxCadence:120,maxSpeed:12});
result=calculate(partial,10,segment(5,22),{duration:NaN,distance:-1,power:-1,speed:Infinity,heartrate:0,cadence:0,stepLength:-1,powerMax:-1});
near(result.durationSeconds,17);
near(result.distance,66);
near(result.mean.power,(100*5+300*10+500*2)/17);
assert.equal(result.stats.maxPower,500);
assert.equal(calculate([],10,segment(0,10),{durationTotal:12,distance:0,heartrate:155}).durationSeconds,12);
assert.equal(calculate([],10,segment(0,10),{distance:0}).distance,0);
assert.equal(calculate(partial,null,segment(0,20)).mean.power,null);

// NP remains a 30s rolling-window fourth-power estimate, with the existing gates.
const steady=rows(Array.from({length:60},()=>({power:200})),5);
result=calculate(steady,5,segment(0,300));
near(result.stats.normalized,200);
assert.equal(calculate(steady,5,segment(0,299)).stats.normalized,null);
assert.equal(calculate(steady,5,segment(0,300),{duration:200}).stats.normalized,null);
assert.equal(calculate(steady,5,segment(0,299),{duration:350}).stats.normalized,null,'A recorded duration cannot create a five-minute sampled interval');
assert.equal(calculate(steady.map((row,index)=>index===10?{...row,power:null}:row),5,segment(0,300)).stats.normalized,null);
assert.equal(calculate(steady.filter((_,index)=>index!==10),5,segment(0,300)).stats.normalized,null,'Dropping a row must not compress a gap');
assert.equal(calculate(rows(Array.from({length:20},()=>({power:200})),15),15,segment(0,300)).stats.normalized,null);
assert.equal(calculate(rows(Array.from({length:60},()=>({power:0})),5),5,segment(0,300)).stats.normalized,0);
const varying=rows(Array.from({length:60},(_,index)=>({power:index<30?100:300})),5);
result=calculate(varying,5,segment(0,300));
near(result.stats.normalized,segmentStatistics(varying,5,300).normalized);
assert.ok(result.stats.normalized>result.mean.power,'NP must not become a plain average');

// Large source streams use bounded scans instead of argument-list expansion.
const long=rows(Array.from({length:150000},()=>({power:220,speed:4,heartrate:150,cadence:85})),1);
result=calculate(long,1,segment(0,long.length));
assert.equal(result.stats.maxPower,220);
near(result.stats.normalized,220);
assert.equal(result.distance,long.length*4);
console.log('Profile weighted means, cumulative/speed distance completeness, lap precedence, NP and long-stream bounds passed.');
