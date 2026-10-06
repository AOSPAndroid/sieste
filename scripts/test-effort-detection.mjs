import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const load=(path,names)=>new Function(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('export ','')+';return {'+names+'}')();
const {effortProfile}=load('app/effort-profile-data.ts','effortProfile');
const {activityClimbs,activityClimbAnalysis}=load('app/activity-terrain-data.ts','activityClimbs,activityClimbAnalysis');
const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} is not within ${tolerance} of ${expected}`);
const recording=(sportType,step,data,summary={})=>({sportType,summary,seriesSampled:{sampleSize:step,data}});

// Work occupies 80% of these sessions. Session-median cutoffs previously rose
// above the work plateau and lost all three repeats.
for(const step of [1,5])for(const [sport,sensor,low,high] of [['cycling','power',100,300],['running','speed',3,4.5],['cycling','heartrate',120,160]]){
 const values=Array.from({length:900/step},(_,i)=>i*step%300<240?high:low),profile=effortProfile(recording(sport,step,{[sensor]:values}),sensor,sport);
 assert.equal(profile.efforts.length,3,`${sport} ${sensor} majority-work repeats at ${step}s`);
 assert.equal(profile.effortStatus,'detected');assert.equal(profile.effortReason,null);
 assert.equal(profile.effortMethod.smoothingSeconds,sensor==='speed'?(step===5?10:6):15,'Reported smoothing duration matches the sample-aligned window');
 profile.efforts.forEach((effort,i)=>{close(effort.start*60,i*300);close(effort.end*60,i*300+240);close(effort.mean,high)});
}
const run=recording('running',1,{speed:Array.from({length:140},(_,i)=>i>=60&&i<90?4.5:3)});
const short=effortProfile(run,'speed');assert.equal(short.efforts.length,1);close(short.efforts[0].start*60,60);close(short.efforts[0].end*60,90);
for(const [sport,sensor,low,high] of [['cycling','power',100,300],['running','speed',3,4.5]]){
 const rare=recording(sport,1,{[sensor]:Array.from({length:3600},(_,i)=>i>=1800&&i<1830?high:low)}),found=effortProfile(rare,sensor);
 assert.equal(found.efforts.length,1,'A rare sustained 30s surge survives a long steady recording');close(found.efforts[0].start*60,1800);close(found.efforts[0].end*60,1830);
 const workHeavy=recording(sport,1,{[sensor]:Array.from({length:1800},(_,i)=>i%900<855?high:low)});
 assert.equal(effortProfile(workHeavy,sensor).efforts.length,2,'95% work still exposes a sustained recovery contrast');
 const zeroRecovery=recording(sport,1,{[sensor]:Array.from({length:600},(_,i)=>i%120<60?high:0)});
 assert.equal(effortProfile(zeroRecovery,sensor).efforts.length,5,'Sustained recorded zero recovery separates repeated work');
 const shortRest=recording(sport,1,{[sensor]:Array.from({length:450},(_,i)=>i%45<30?high:0)});
 assert.equal(effortProfile(shortRest,sensor).efforts.length,10,'Recovery can be shorter than the minimum work duration');
 const spike=recording(sport,1,{[sensor]:Array.from({length:3600},(_,i)=>i>=1800&&i<1815?high*2:low)});
 assert.equal(effortProfile(spike,sensor).efforts.length,0,'Brief isolated spikes do not define sustained session extrema');
 const noisyRare=structuredClone(rare);noisyRare.seriesSampled.data[sensor][1815]=low;
 assert.equal(effortProfile(noisyRare,sensor).efforts.length,1,'A single positive noisy dip does not erase otherwise sustained work');
}
assert.equal(effortProfile(recording('running',1,{speed:Array.from({length:180},(_,i)=>i>=60&&i<75?4.5:3)}),'speed').efforts.length,0,'A 15s spike is not a sustained run section');
for(const gap of [0,null]){
 const power=Array.from({length:500},(_,i)=>i>=60&&i<140?(i>=90&&i<100?gap:300):100),profile=effortProfile(recording('cycling',1,{power}));
 assert.equal(profile.efforts.length,2,'Recorded zeros and missing values separate work');
 assert.deepEqual(profile.efforts.map(e=>[e.start*60,e.end*60]),[[60,90],[100,140]]);
 assert.ok(profile.efforts.every(e=>e.mean===300),'Recovery and gaps do not dilute work averages');
}
const stopHR=recording('running',1,{heartrate:Array.from({length:600},(_,i)=>i>=60&&i<240?160:120),speed:Array.from({length:600},(_,i)=>i>=140&&i<150?0:3)});
assert.ok(effortProfile(stopHR,'heartrate').efforts.every(e=>e.end*60<=140||e.start*60>=150),'HR lag does not bridge recorded stops');
const distanceStopHR=structuredClone(stopHR);delete distanceStopHR.seriesSampled.data.speed;distanceStopHR.seriesSampled.data.distance=Array.from({length:600},(_,i)=>i<140?i*3:i<150?420:(i-10)*3);
assert.ok(effortProfile(distanceStopHR,'heartrate').efforts.every(e=>e.end*60<=140||e.start*60>=150),'A distance plateau exposes a stop despite HR lag and unavailable speed');
const indoorPower=recording('cycling',1,{power:Array.from({length:600},(_,i)=>i>=60&&i<240?300:100),speed:Array(600).fill(0),distance:Array(600).fill(0)});
assert.equal(effortProfile(indoorPower).efforts.length,1,'Positive indoor cycling power remains usable with zero speed/distance');
const flatRun=effortProfile(recording('running',1,{speed:Array.from({length:600},(_,i)=>3+Math.sin(i)*.05)}),'speed');
assert.equal(flatRun.efforts.length,0);assert.equal(flatRun.effortStatus,'none');assert.match(flatRun.effortReason,/steady/);
const unavailable=effortProfile(recording('cycling',30,{power:Array(40).fill(300)}));assert.equal(unavailable.effortStatus,'unavailable');assert.match(unavailable.effortReason,/10 seconds/);
assert.equal(effortProfile(recording('running',1,{altitude:Array(100).fill(50)}),'speed').effortStatus,'unavailable');
const longRecording=effortProfile(recording('cycling',1,{power:Array.from({length:180000},(_,i)=>i<120000?300:100)}));
assert.equal(longRecording.efforts.length,1);close(longRecording.efforts[0].mean,300);close(longRecording.efforts[0].end*60,120000);
assert.equal(effortProfile(recording('cycling',1,{power:Array(604801).fill(200)})).effortStatus,'unavailable','Oversized recordings are bounded before analysis');
const capped=effortProfile(recording('running',1,{speed:Array.from({length:300},(_,i)=>i>=60&&i<180?4.5:3)},{duration:100,durationTotal:120}),'speed');
assert.ok(capped.efforts.every(e=>e.end*60<=120));close(capped.efforts[0].end*60,120);assert.ok(capped.efforts[0].end*60>100,'Elapsed cap, rather than active time, bounds samples');

// Gentle long climbs and small undulations should retain one usable section.
const hill=(sport,seconds,altitude,distance,speed)=>recording(sport,1,{altitude:Array.from({length:seconds+1},(_,i)=>altitude(i)),distance:Array.from({length:seconds+1},(_,i)=>distance(i)),...(speed?{speed:Array.from({length:seconds+1},(_,i)=>speed(i))}:{})});
const gentle=hill('cycling',1000,i=>i*.1,i=>i*6);
const gentleClimbs=activityClimbs(gentle);assert.equal(gentleClimbs.length,1);assert.ok(gentleClimbs[0].gain>95);close(gentleClimbs[0].grade,100/60);
const rolling=hill('cycling',1000,i=>i*.05+3.5*Math.sin(i/30),i=>i*2);
assert.equal(activityClimbs(rolling).length,1,'Small rolling dips retain a sustained road climb');
const flatter=hill('running',240,i=>50+Math.sin(i)*.8,i=>i*3);assert.equal(activityClimbs(flatter).length,0);
const spike=hill('running',240,i=>i===120?100:50,i=>i*3);assert.equal(activityClimbs(spike).length,0);
const terminalSpike=hill('running',240,i=>i===240?100:50,i=>i*3);assert.equal(activityClimbs(terminalSpike).length,0,'Unsmoothed endpoints cannot create a summit');
for(const index of [0,48]){
 const endpoint=recording('running',5,{altitude:Array.from({length:49},(_,i)=>i===index?(index===0?0:100):50),distance:Array.from({length:49},(_,i)=>i*15)});
 assert.equal(activityClimbs(endpoint).length,0,'A low first sample or high last sample cannot invent a climb');
}
const plateauSpike=hill('cycling',600,i=>i>=300&&i<310?100:50,i=>i*5);assert.equal(activityClimbs(plateauSpike).length,0,'A brief multi-sample altitude jump is not a climb');
const stopped=hill('running',180,i=>i<20?50+i*.5:i<140?60+(i-20)*.1:72+(i-140)*.25,i=>i<20?i*3:i<140?60:60+(i-140)*3,i=>i>=20&&i<140?0:3);
assert.ok(activityClimbs(stopped).every(c=>c.end<20||c.start>=140),'No climb bridges a stop or uses barometer drift as gain');
const noSpeedStop=structuredClone(stopped);delete noSpeedStop.seriesSampled.data.speed;
assert.ok(activityClimbs(noSpeedStop).every(c=>c.end<25||c.start>=135),'Stationary distance also breaks climbing without speed');
const stationary=hill('cycling',600,i=>50+i*.1,()=>0);assert.equal(activityClimbs(stationary).length,0);
const gaps=hill('cycling',600,i=>i*.16,i=>i*5);gaps.seriesSampled.data.altitude[300]=null;
const gapClimbs=activityClimbs(gaps);assert.equal(gapClimbs.length,2);assert.ok(gapClimbs.every(c=>c.end<300||c.start>300),'Even a single missing elevation sample remains a break');
const reset=hill('cycling',600,i=>i*.16,i=>i<300?i*5:(i-300)*5);
assert.equal(activityClimbs(reset).length,2);assert.ok(activityClimbs(reset).every(c=>c.end<300||c.start>=300),'Distance resets separate climbs');
const flatSection=hill('cycling',600,i=>i<240?i*.1:i<300?24:24+(i-300)*.1,i=>i*5);
assert.equal(activityClimbs(flatSection).length,1,'A short flat does not split a climb');
const descent=hill('cycling',600,i=>i<240?i*.2:i<300?48-(i-240)*.3:30+(i-300)*.2,i=>i*5);
assert.equal(activityClimbs(descent).length,2,'Substantial descents separate climbs');
assert.equal(activityClimbAnalysis(gentle).status,'detected');assert.equal(activityClimbAnalysis(flatter).status,'none');
assert.equal(activityClimbAnalysis(recording('cycling',1,{altitude:Array(100).fill(50)})).status,'unavailable');
assert.equal(activityClimbAnalysis(recording('cycling',30,{altitude:Array(100).fill(50),distance:Array.from({length:100},(_,i)=>i*100)})).status,'unavailable');
console.log('Automatic sections: majority-work repeats, original boundaries, stops/gaps, sample reliability, sustained rolling/shallow climbs, spikes, stationary drift and distance resets passed.');
