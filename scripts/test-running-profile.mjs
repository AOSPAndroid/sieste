import ts from 'typescript';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const load=(path,names)=>new Function(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('export ','')+';return {'+names+'}')();
const {activityClimbs,activityClimbAnalysis,paceFromSpeed}=load('app/activity-terrain-data.ts','activityClimbs,activityClimbAnalysis,paceFromSpeed');
const {effortProfile}=load('app/effort-profile-data.ts','effortProfile');
assert.equal(paceFromSpeed(4), '4:10');assert.equal(paceFromSpeed(0),'—');assert.equal(paceFromSpeed(null),'—');assert.equal(paceFromSpeed(2,100),'0:50');
const detail={summary:{durationTotal:900},seriesSampled:{sampleSize:5,data:{speed:Array.from({length:181},(_,i)=>i>=50&&i<90?4.5:3),altitude:Array.from({length:181},(_,i)=>i*1.2),distance:Array.from({length:181},(_,i)=>i*15)}}};
const climbs=activityClimbs(detail);assert.ok(climbs.length>0,'Running climbs work without power');assert.ok(climbs[0].grade>2);
const effort=effortProfile(detail,'speed');assert.ok(effort.efforts.length>0);assert.ok(effort.efforts[0].mean>4);assert.equal(effortProfile({...detail,seriesSampled:{sampleSize:5,data:{speed:Array(181).fill(3)}}},'speed').efforts.length,0,'Steady easy run is not an interval');
assert.equal(activityClimbs({...detail,seriesSampled:{sampleSize:5,data:{...detail.seriesSampled.data,altitude:Array(181).fill(null)}}}).length,0);
assert.equal(activityClimbs({...detail,seriesSampled:{sampleSize:5,data:{...detail.seriesSampled.data,distance:[]}}}).length,0);
console.log('Running pace conversion, speed effort detection, power-free climbs and missing data passed.');
// Regression fixtures are synthetic; private COROS recordings stay outside Git.
const running={sportType:'running',summary:{durationTotal:240},seriesSampled:{sampleSize:1,data:{altitude:Array.from({length:241},(_,i)=>50+(i<100?i*.1:i<115?10:(i-15)*.1)),distance:Array.from({length:241},(_,i)=>i*3)}}};
assert.equal(activityClimbs(running).length,1,'A brief flat does not erase a running climb');
assert.equal(activityClimbs({...running,seriesSampled:{sampleSize:1,data:{...running.seriesSampled.data,altitude:Array.from({length:241},(_,i)=>50+Math.sin(i)*.8)}}}).length,0,'Flat elevation noise is not a climb');
assert.equal(activityClimbs({...running,seriesSampled:{sampleSize:1,data:{...running.seriesSampled.data,altitude:Array.from({length:241},(_,i)=>i===120?100:50)}}}).length,0,'Isolated elevation spike is rejected');
const gap={...running,seriesSampled:{sampleSize:1,data:{...running.seriesSampled.data,altitude:running.seriesSampled.data.altitude.map((a,i)=>i>=90&&i<130?null:a)}}};
assert.ok(activityClimbs(gap).every(c=>c.end<90||c.start>=130),'Missing elevation is never bridged');
const short=effortProfile({summary:{durationTotal:180},seriesSampled:{sampleSize:1,data:{speed:Array.from({length:181},(_,i)=>i>=60&&i<100?4.5:3)}}},'speed');assert.equal(short.efforts.length,1,'A sustained 40 second running surge survives smoothing');
console.log('Rolling climbs, flat sections, noise, gaps and short running efforts passed.');

// Synthetic small road hills: cumulative ascent can be meaningful even when
// no individual rise reaches the old ten-metre minimum. No athlete data here.
const sampleSeconds=8,smallAltitudes=[],smallDistances=[],smallSpeeds=[];
let smallDistance=0;
function smallPoint(altitude,speed=3.2){smallAltitudes.push(altitude);smallDistances.push(smallDistance);smallSpeeds.push(speed);smallDistance+=speed*sampleSeconds}
for(const {gain,count,speed} of [{gain:6.3,count:22,speed:3.2},{gain:7.1,count:28,speed:4},{gain:6.5,count:36,speed:3.6},{gain:8.2,count:26,speed:3.4}]){
 for(let i=0;i<12;i++)smallPoint(50,speed);
 for(let i=1;i<=count;i++)smallPoint(50+gain*i/count,speed);
 for(let i=0;i<5;i++)smallPoint(50+gain,speed);
 for(let i=1;i<=16;i++)smallPoint(50+gain*(1-i/16),speed);
}
const smallHills={sportType:'running',seriesSampled:{sampleSize:sampleSeconds,data:{altitude:smallAltitudes,distance:smallDistances,speed:smallSpeeds}}};
const smallResult=activityClimbAnalysis(smallHills);
assert.equal(smallResult.climbs.length,4,'Sustained small running hills are detected individually');
assert.ok(smallResult.climbs.some(c=>c.grade<1),'A long gentle rise is still a running hill');
assert.ok(smallResult.climbs.every(c=>c.gain>=5&&c.end-c.start>=30&&c.distance>=60));
assert.equal(smallResult.thresholds.minGainMetres,5);assert.equal(smallResult.thresholds.minGradePercent,.5);assert.equal(smallResult.gradeCutoffPercent,.5);
for(const sportType of ['walking','hiking','trail_running'])assert.equal(activityClimbs({...smallHills,sportType}).length,4,'Foot sports use the same small-hill rules');
const cyclingSmall=activityClimbAnalysis({...smallHills,sportType:'cycling'});
assert.equal(cyclingSmall.climbs.length,0);assert.equal(cyclingSmall.thresholds.minGainMetres,20);assert.equal(cyclingSmall.gradeCutoffPercent,1,'Cycling whole-climb thresholds stay unchanged');

for(const step of [1,5,8,15]){
 const fixture=altitude=>({sportType:'running',seriesSampled:{sampleSize:step,data:{altitude:Array.from({length:81},(_,i)=>altitude(i)),distance:Array.from({length:81},(_,i)=>i*step*3),speed:Array(81).fill(3)}}});
 for(const [name,altitude] of [['terminal spike',i=>i===80?56:50],['initial dip',i=>i===0?44:50],['short plateau',i=>i>=40&&i<=41?56:50],['flat noise',i=>50+1.5*Math.sin(i)],['sub-five-metre hill',i=>50+4.8*Math.sin(Math.PI*i/80)]])assert.equal(activityClimbs(fixture(altitude)).length,0,`${name} at ${step}s does not become a small climb`);
}
const approach={sportType:'running',seriesSampled:{sampleSize:1,data:{altitude:Array.from({length:201},(_,i)=>50+(i<=120?0:(i-120)*.075)),distance:Array.from({length:201},(_,i)=>i*3),speed:Array(201).fill(3)}}};
const approachClimb=activityClimbs(approach)[0];assert.ok(approachClimb);assert.ok(approachClimb.start>=110,'The preceding flat does not inflate climb duration or distance');
for(const broken of ['gap','reset','stop']){
 const detail=structuredClone(approach),s=detail.seriesSampled.data;
 if(broken==='gap')s.altitude[160]=null;
 if(broken==='reset')s.distance=s.distance.map((v,i)=>i>=160?v-s.distance[160]:v);
 if(broken==='stop')s.speed[160]=0;
 assert.ok(activityClimbs(detail).every(c=>c.end<160||c.start>160),`${broken} still separates small hills`);
}
assert.match(activityClimbAnalysis({...smallHills,seriesSampled:{sampleSize:16,data:smallHills.seriesSampled.data}}).reason,/15 seconds/,'Coarse samples are not made reliable by the lower running cutoff');
console.log('Small running hills passed: gentle rises, foot-sport defaults, flat approaches, source gaps/stops/resets, lower-amplitude spikes/noise and unchanged cycling limits.');
