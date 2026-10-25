import ts from 'typescript';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const training=readFileSync('app/training-coach-data.ts','utf8'),sample=training.slice(training.indexOf('export function sampledBest'),training.indexOf('export function workoutEvidence'));
const sampledBest=new Function('const finite=v=>typeof v==="number"&&Number.isFinite(v);'+transpile(sample)+';return sampledBest')();
const activityClimbs=new Function(transpile(readFileSync('app/activity-terrain-data.ts','utf8'))+';return activityClimbs')();
const cyclingPowerStats=new Function('sportFamily',transpile(readFileSync('app/cycling-power-data.ts','utf8'))+';return cyclingPowerStats')(a=>a.sportType);
const thresholds=new Function(transpile(readFileSync('app/athlete-thresholds.ts','utf8'))+';return {capacityAt,zonesAt,zoneVersionAt,histogramInZones,bandRange,weightAt}')();
const funcs=new Function('sampledBest','sportFamily','activityClimbs','cyclingPowerStats','capacityAt','weightAt',transpile(readFileSync('app/cycling-advanced-data.ts','utf8'))+';return {cyclingAdvanced,cyclingReference,effortBadges}')(sampledBest,a=>a.sportType,activityClimbs,cyclingPowerStats,thresholds.capacityAt,thresholds.weightAt);
const {cyclingAdvanced:analyse,cyclingReference:ref,effortBadges:badges}=funcs;
const detail={id:'now',date:'2026-09-20T12:00:00Z',sportType:'cycling',summary:{durationTotal:3600},cyclingContext:{fitness:{ftp:300},fitnessHistory:{20260901:{ftp:250},20260921:{ftp:400}},profile:{weight:70}},seriesSampled:{sampleSize:5,data:{power:Array(720).fill(200),heartrate:Array(720).fill(140),cadence:Array(720).fill(85),altitude:Array.from({length:721},(_,i)=>i*5),distance:Array.from({length:721},(_,i)=>i*100)}}};
assert.equal(ref(detail).ftp,250);assert.ok(ref(detail).label.includes('2026-09-01'));assert.equal(ref({...detail,cyclingContext:{fitness:{ftp:300}}}).ftp,300);assert.equal(ref({}).ftp,null);assert.equal(ref({...detail,summary:{ftp:270}}).ftp,270);
let a=analyse(detail,[],[]);assert.equal(a.np,200);assert.equal(a.vi,1);assert.equal(a.ifactor,.8);assert.equal(a.averagePct,80);assert.equal(a.zones.find(z=>z.label==='Tempo').seconds,3600);assert.equal(a.validSeconds,3600);assert.ok(a.climbs.length>0);assert.equal(a.curve.find(b=>b.seconds===3600).current,200);assert.equal(a.repeatChange,null);
assert.equal(a.npSource,'estimated');
const recorded=analyse({...detail,summary:{...detail.summary,power:173,normalizedPower:245}},[],[]);assert.equal(recorded.np,245);assert.equal(recorded.npSource,'recorded');assert.equal(recorded.vi,245/173);assert.equal(recorded.ifactor,245/250);assert.equal(recorded.averagePct,173/250*100,'Power lab uses the same provider-first averages as compact stats');assert.deepEqual(recorded.curve,a.curve,'Recorded headline values do not change recorded power curves');assert.deepEqual(recorded.zones,a.zones,'Recorded headline values do not change sampled zones');assert.deepEqual(recorded.climbs,a.climbs,'Recorded headline values do not change terrain');
const truncated=analyse({...detail,seriesSampled:{...detail.seriesSampled,data:{...detail.seriesSampled.data,power:Array(60).fill(200)}}},[],[]);assert.equal(truncated.np,null,'Power lab rejects a truncated recording');assert.equal(truncated.npSource,null);assert.equal(truncated.vi,null);assert.equal(truncated.ifactor,null);
const zero=analyse({...detail,summary:{...detail.summary,power:0,normalizedPower:0}},[],[]);assert.equal(zero.np,0);assert.equal(zero.ifactor,0);assert.equal(zero.averagePct,0);assert.equal(zero.vi,null);
const efforts=[{start:0,end:2,mean:250},{start:5,end:7,mean:251},{start:10,end:12,mean:249}];a=analyse(detail,[{id:'old',sportType:'cycling',date:'2026-09-10',evidence:{best:{power:[{seconds:300,value:240}]}}}],efforts);assert.ok(Math.abs(a.repeatChange+.4)<1e-9);assert.equal(a.curve.find(b=>b.seconds===300).month.value,240);assert.ok(badges(efforts,1).includes('Highest avg'));assert.ok(badges(efforts,2).includes('Repeat matched'));
const gaps=structuredClone(detail);gaps.seriesSampled.data.power[50]=null;a=analyse(gaps,[],[]);assert.equal(a.np,null);assert.equal(a.vi,null);assert.equal(a.validSeconds,3595);assert.equal(a.curve.find(b=>b.seconds===3600).current,null);
assert.equal(analyse({summary:{},seriesSampled:{}},[],[]).np,null);console.log('Advanced cycling: dated FTP, NP/IF/VI, zones, history, climb, repeatability, gaps passed.');

const personal=ref({cyclingContext:{manualReference:{ftp:247,weight:65.5,savedAt:'2026-09-20'},fitness:{ftp:240},profile:{weight:65.1}}});assert.equal(personal.ftp,247);assert.equal(personal.weight,65.5);assert.equal((personal.ftp/personal.weight).toFixed(2),'3.77');assert.equal(ref({cyclingContext:{fitness:{ftp:240},profile:{weight:65.1}}}).ftp,240);console.log('Personal references and W/kg conversion passed.');

// Terrain recognition uses the same elapsed-second bounds as the profile/map,
// independently of whether this recording contains power samples.
const terrain={sportType:'cycling',summary:{durationTotal:600},seriesSampled:{sampleSize:5,data:{altitude:Array.from({length:121},(_,i)=>200+i*.8),distance:Array.from({length:121},(_,i)=>i*15),heartrate:Array(121).fill(138),cadence:Array(121).fill(88)}}};
const geometry=climbs=>climbs.map(({start,end,gain,distance,grade})=>({start,end,gain,distance,grade}));
const canonical=activityClimbs(terrain,'cycling');
assert.ok(canonical.length>0);
let climbs=analyse(terrain,[],[]).climbs;
assert.deepEqual(geometry(climbs),canonical);
assert.ok(climbs.every(c=>c.power===null&&c.hr===138&&c.cadence===88));
assert.ok(canonical.every(c=>!('power' in c)&&!('hr' in c)&&!('cadence' in c)),'enrichment must not mutate cached terrain results');
const shortPower={...terrain,seriesSampled:{...terrain.seriesSampled,data:{...terrain.seriesSampled.data,power:Array(12).fill(240)}}};
climbs=analyse(shortPower,[],[]).climbs;
assert.deepEqual(geometry(climbs),canonical,'short power coverage must not truncate terrain bounds');
assert.ok(climbs.every(c=>c.power===240));
const noSensors={...terrain,seriesSampled:{...terrain.seriesSampled,data:{altitude:terrain.seriesSampled.data.altitude,distance:terrain.seriesSampled.data.distance}}};
climbs=analyse(noSensors,[],[]).climbs;
assert.deepEqual(geometry(climbs),canonical);
assert.ok(climbs.every(c=>c.power===null&&c.hr===null&&c.cadence===null));

const terrainGap=structuredClone(terrain);
terrainGap.seriesSampled.data.altitude[60]=null;
terrainGap.seriesSampled.data.distance[60]=null;
climbs=analyse(terrainGap,[],[]).climbs;
assert.deepEqual(geometry(climbs),activityClimbs(terrainGap,'cycling'));
assert.equal(climbs.length,2);
assert.ok(climbs.every(c=>c.end<300||c.start>300),'missing terrain must split climbs');
const reset=structuredClone(terrain);
reset.seriesSampled.data.distance=reset.seriesSampled.data.distance.map((d,i)=>i>=60?d-900:d);
climbs=analyse(reset,[],[]).climbs;
assert.deepEqual(geometry(climbs),activityClimbs(reset,'cycling'));
assert.equal(climbs.length,2);
assert.ok(climbs.every(c=>c.end<300||c.start>=300),'distance resets must split climbs');
assert.deepEqual(analyse({...terrain,seriesSampled:{...terrain.seriesSampled,data:{altitude:terrain.seriesSampled.data.altitude}}},[],[]).climbs,[]);
assert.deepEqual(analyse({...terrain,seriesSampled:{...terrain.seriesSampled,sampleSize:0}},[],[]).climbs,[]);
console.log('Canonical climb bounds, optional sensor metadata, power-independent terrain, gaps and distance resets passed.');
// Tredict thresholds: the version that held on the workout's day, used for FTP when COROS has no dated value.
{
 const capacity={cycling:[{timestamp:'2026-01-01T00:00:00Z',ftp:250,hrLth:160},{timestamp:'2026-06-01T00:00:00Z',ftp:270,hrLth:162}]};
 assert.equal(thresholds.capacityAt(capacity,'cycling','2026-03-01').ftp,250);assert.equal(thresholds.capacityAt(capacity,'cycling','2026-07-01').lthr,162);
 assert.equal(thresholds.capacityAt(capacity,'cycling','2025-12-01'),null,'Nothing set yet on that day');assert.equal(thresholds.capacityAt(capacity,'running','2026-07-01'),null);
 const r=ref({date:'2026-07-01T08:00:00Z',summary:{},cyclingContext:{tredictCapacity:capacity,fitness:{ftp:300}}});
 assert.equal(r.ftp,270);assert.match(r.label,/^Tredict FTP set 2026-06-01/);
 const zones={running:{heartrate:{'2026-01-01T00:00:00Z':[{name:'Easy',from:-1,to:140},{name:'Tempo',from:141,to:165},{name:'Hard',from:166,to:-1}]}}};
 const bands=thresholds.zonesAt(zones,'running','2026-02-01');assert.deepEqual(bands.map(b=>b.name),['Easy','Tempo','Hard']);
 assert.deepEqual(thresholds.histogramInZones({130:600,150:300,170:60,0:5},bands).seconds,[600,300,60]);
 assert.deepEqual(bands.map(b=>thresholds.bandRange(b)),['≤140 bpm','141–165 bpm','166+ bpm']);
 assert.equal(thresholds.zonesAt(zones,'running','2025-06-01'),null);
 const body=[{timestamp:'2026-05-01T07:00:00Z',weightInKilograms:72},{timestamp:'2026-06-25T07:00:00Z',weightInKilograms:70.5},{timestamp:'2026-08-01T07:00:00Z',weightInKilograms:69}];
 assert.deepEqual(thresholds.weightAt(body,'2026-07-01T08:00:00Z'),{weight:70.5,on:'2026-06-25'},'The latest weight before the ride, never a later one');
 assert.equal(thresholds.weightAt(body,'2026-12-01'),null,'Older than 60 days is too stale');
 const w=ref({date:'2026-07-01T08:00:00Z',summary:{},cyclingContext:{bodyvalues:body,profile:{weight:80}}});assert.equal(w.weight,70.5);assert.equal(w.weightLabel,'weight logged 2026-06-25');
 assert.equal(ref({date:'2026-07-01T08:00:00Z',summary:{},cyclingContext:{bodyvalues:body,manualReference:{weight:68},profile:{weight:80}}}).weight,68,'A weight you entered yourself still wins');
 console.log('Tredict thresholds and zones: dated versions, FTP fallback, logged weight and histogram zones passed.');
}
