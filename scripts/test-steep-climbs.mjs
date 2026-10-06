import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const code=ts.transpileModule(readFileSync('app/activity-terrain-data.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('export ','');
const {activityClimbs,activityClimbAnalysis}=new Function(code+';return {activityClimbs,activityClimbAnalysis}')();
const steep={mode:'steep',minGradePercent:3},close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
function route(sections,step=1,noise=()=>0){
 const seconds=sections.reduce((n,[duration])=>n+duration,0),at=t=>{
  let time=0,elevation=50;
  for(const [duration,grade] of sections){const part=Math.max(0,Math.min(duration,t-time));elevation+=part*5*grade/100;time+=duration}
  return elevation+noise(t);
 };
 const times=Array.from({length:Math.floor(seconds/step)+1},(_,i)=>i*step);
 return {sportType:'cycling',summary:{durationTotal:seconds},seriesSampled:{sampleSize:step,data:{altitude:times.map(at),distance:times.map(t=>t*5),speed:times.map(()=>5)}}};
}
// This used to produce one valley-to-peak selection containing long gentle
// approaches and tails. Local steep mode must select the actual core instead.
for(const step of [1,5,10]){
 const activity=route([[300,1],[120,6],[300,1]],step),whole=activityClimbs(activity,'cycling'),analysis=activityClimbAnalysis(activity,'cycling',steep),core=analysis.climbs[0];
 assert.equal(whole.length,1);assert.ok(whole[0].end-whole[0].start>700);assert.equal(analysis.climbs.length,1);
 const tolerance=Math.max(5,step*2);
 assert.ok(core.start>=300-tolerance&&core.start<=300+tolerance);assert.ok(core.end>=420-tolerance&&core.end<=420+tolerance);
 assert.ok(core.end-core.start<150);assert.ok(core.grade>5);assert.ok(core.distance>=100);close(core.grade,core.gain/core.distance*100);
 assert.equal(analysis.mode,'steep');assert.equal(analysis.gradeCutoffPercent,3);assert.equal(analysis.localGradeWindowMetres,50);assert.match(analysis.method,/local gradient/);assert.match(analysis.method,/average gradient/);
 assert.equal(analysis.thresholds.minSeconds,Math.max(30,step*3));
 // Settings never alter the legacy whole route or foot-based interpretation.
 assert.strictEqual(activityClimbAnalysis(activity,'cycling'),activityClimbAnalysis(activity,'cycling',{mode:'whole',minGradePercent:8}));
 assert.strictEqual(activityClimbAnalysis(activity,'running'),activityClimbAnalysis(activity,'running',steep));
}
const split=route([[120,1],[120,6],[180,0],[120,6],[120,1]]),splitClimbs=activityClimbs(split,'cycling',steep);
assert.equal(splitClimbs.length,2);assert.ok(splitClimbs[0].start>=115&&splitClimbs[0].end<=245);assert.ok(splitClimbs[1].start>=415&&splitClimbs[1].end<=545);
assert.ok(splitClimbs.every(c=>c.end<=245||c.start>=415),'Long flats separate steep cores');
const noisy=route([[300,1],[120,6],[300,1]],1,t=>.2*Math.sin(t/4));assert.equal(activityClimbs(noisy,'cycling',steep).length,1,'Minor altitude noise retains a sustained steep core');
const flat=route([[600,0]],1,t=>.8*Math.sin(t));assert.equal(activityClimbs(flat,'cycling',steep).length,0,'Flat elevation noise is not steep terrain');
for(const step of [1,5,10])for(const position of ['first','middle','last']){
 const spike=route([[600,0]],step),samples=spike.seriesSampled.data.altitude,index=position==='first'?0:position==='last'?samples.length-1:Math.floor(samples.length/2);
 samples[index]+=50;assert.equal(activityClimbs(spike,'cycling',steep).length,0,'A GPS/barometer spike cannot create a steep selection');
}
const plateauSpike=route([[600,0]]);plateauSpike.seriesSampled.data.altitude=plateauSpike.seriesSampled.data.altitude.map((a,i)=>i>=300&&i<310?a+50:a);
assert.equal(activityClimbs(plateauSpike,'cycling',steep).length,0,'A brief multi-sample altitude jump cannot create a steep selection');
const continuous=route([[600,6]]),missing=structuredClone(continuous);missing.seriesSampled.data.altitude[300]=null;
const missingClimbs=activityClimbs(missing,'cycling',steep);assert.equal(missingClimbs.length,2);assert.ok(missingClimbs.every(c=>c.end<300||c.start>300));
const reset=structuredClone(continuous);reset.seriesSampled.data.distance=reset.seriesSampled.data.distance.map((d,i)=>i>=300?d-1500:d);
const resetClimbs=activityClimbs(reset,'cycling',steep);assert.equal(resetClimbs.length,2);assert.ok(resetClimbs.every(c=>c.end<300||c.start>=300));
const paused=structuredClone(continuous);
for(let i=0;i<=600;i++){
 const stopped=Math.max(0,Math.min(60,i-240)),distance=(i-stopped)*5;
 paused.seriesSampled.data.distance[i]=distance;paused.seriesSampled.data.altitude[i]=50+distance*.06+stopped*.2;paused.seriesSampled.data.speed[i]=i>=240&&i<300?0:5;
}
const pausedClimbs=activityClimbs(paused,'cycling',steep);assert.equal(pausedClimbs.length,2);assert.ok(pausedClimbs.every(c=>c.end<240||c.start>=300),'Elapsed stops and altitude drift remain outside steep selections');
const noSpeed=structuredClone(paused);delete noSpeed.seriesSampled.data.speed;
assert.ok(activityClimbs(noSpeed,'cycling',steep).every(c=>c.end<=240||c.start>=300),'Stationary distance remains a break with no speed sensor');
const stationary=route([[600,6]]);stationary.seriesSampled.data.distance.fill(0);delete stationary.seriesSampled.data.speed;
assert.equal(activityClimbs(stationary,'cycling',steep).length,0,'Stationary altitude drift supplies no moving grade');
const variable=route([[120,1],[80,2],[100,3],[100,4],[100,6],[120,8],[100,5],[100,3],[120,1]]);
let previous=activityClimbs(variable,'cycling',{mode:'steep',minGradePercent:2});assert.ok(previous.length);
for(const cutoff of [3,4,5,6,8]){
 const current=activityClimbs(variable,'cycling',{mode:'steep',minGradePercent:cutoff});assert.ok(current.length,`Meaningful ${cutoff}% core is present`);
 assert.ok(current.every(c=>previous.some(p=>c.start>=p.start&&c.end<=p.end)),`Raising cutoff to ${cutoff}% only trims or splits prior selections`);previous=current;
}
const canonical=activityClimbAnalysis(variable,'cycling',steep);
assert.strictEqual(canonical,activityClimbAnalysis(variable,'cycling',{mode:'steep'}));
for(const invalid of [NaN,Infinity,-1,0,'4'])assert.strictEqual(canonical,activityClimbAnalysis(variable,'cycling',{mode:'steep',minGradePercent:invalid}));
assert.strictEqual(activityClimbAnalysis(variable,'cycling',{mode:'steep',minGradePercent:100}),activityClimbAnalysis(variable,'cycling',{mode:'steep',minGradePercent:8}));
assert.strictEqual(activityClimbAnalysis(variable,'cycling',{mode:'steep',minGradePercent:3.9}),activityClimbAnalysis(variable,'cycling',{mode:'steep',minGradePercent:4}));
assert.strictEqual(activityClimbAnalysis(variable,'cycling',{mode:'unknown'}),activityClimbAnalysis(variable,'cycling'));
assert.equal(activityClimbAnalysis(route([[600,1]]),'cycling',steep).status,'none');
assert.equal(activityClimbAnalysis({sportType:'cycling',seriesSampled:{sampleSize:1,data:{}}},'cycling',steep).status,'unavailable');
assert.equal(activityClimbAnalysis(route([[600,6]],30),'cycling',steep).status,'unavailable');
console.log('Steep cycling selections: gentle boundary trimming, local grade, separate cores, noise/spikes, gaps/stops/resets, stricter subsets, sample timing and normalized/cache-compatible settings passed.');
