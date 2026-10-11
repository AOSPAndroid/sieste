import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {Decoder,Stream,Encoder,Profile} from '@garmin/fitsdk';
const compile=name=>ts.transpileModule(readFileSync(name,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const {sportFamily}=new Function(compile('app/sports.ts')+';return {sportFamily}')();
const {cyclingPowerStats}=new Function('sportFamily',compile('app/cycling-power-data.ts')+';return {cyclingPowerStats}')(sportFamily);
const ride=(power=Array(60).fill(200),step=5,duration=power.length*step)=>({sportType:'cycling',summary:{durationTotal:duration},seriesSampled:{sampleSize:step,data:{power}}});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} should match ${expected}`);
let data=ride(),result=cyclingPowerStats(data);
assert.deepEqual(result,{average:200,normalized:200,averageSource:'estimated',normalizedSource:'estimated'});
const unchanged=structuredClone(data);cyclingPowerStats(data);assert.deepEqual(data,unchanged,'Analysis must not mutate summaries or samples');
assert.deepEqual(cyclingPowerStats({...data,summary:{...data.summary,power:173,normalizedPower:245}}),{average:173,normalized:245,averageSource:'recorded',normalizedSource:'recorded'},'Recorded metrics beat sampled estimates');
assert.deepEqual(cyclingPowerStats({...data,summary:{...data.summary,power:0,normalizedPower:0}}),{average:0,normalized:0,averageSource:'recorded',normalizedSource:'recorded'},'Recorded zeros are authoritative');
assert.equal(cyclingPowerStats({...data,summary:{normalizedPower:211,powerNormalized:299}}).normalized,211,'Canonical FIT field beats alias');
assert.equal(cyclingPowerStats({...data,summary:{normalizedPower:NaN,powerNormalized:212}}).normalized,212);
assert.equal(cyclingPowerStats({...data,summary:{normalizedPower:213,normalizedPowerSource:'estimated'}}).normalizedSource,'estimated');
result=cyclingPowerStats(ride(Array(60).fill(0)));assert.equal(result.average,0);assert.equal(result.normalized,0);
result=cyclingPowerStats(ride(Array.from({length:60},(_,i)=>i<30?100:300)));assert.equal(result.average,200);assert.ok(result.normalized>result.average,'NP is not a plain average');
result=cyclingPowerStats(ride([100,200],5,8));assert.equal(result.average,137.5,'Average weights the final partial cell');assert.equal(result.normalized,null);
result=cyclingPowerStats(ride([0,-1,null,100],5,20));assert.equal(result.average,50,'Zero included, invalid/missing readings excluded from sampled average');
for(const missing of [null,undefined,NaN,Infinity,-1]){
 const power=Array(60).fill(200);power[20]=missing;assert.equal(cyclingPowerStats(ride(power)).normalized,null,'Any missing/invalid wattage invalidates NP');
}
for(const step of [0,-1,NaN,Infinity,6,30])assert.equal(cyclingPowerStats(ride(Array(60).fill(200),step,360)).normalized,null);
assert.equal(cyclingPowerStats(ride(Array(60).fill(200),5,299)).normalized,null,'NP needs at least five minutes');
result=cyclingPowerStats(ride(Array(60).fill(200),5,1200));assert.equal(result.normalized,null,'Truncated power must not shorten the recorded ride');assert.equal(result.average,200);
const paused=ride(Array(120).fill(200));delete paused.summary.durationTotal;paused.summary.duration=300;paused.seriesSampled.data.power[80]=null;assert.equal(cyclingPowerStats(paused).normalized,null,'Active duration cannot clip a pause/gap in the later sample timeline');
const activeBeyondSamples=ride(Array(60).fill(200));delete activeBeyondSamples.summary.durationTotal;activeBeyondSamples.summary.duration=600;result=cyclingPowerStats(activeBeyondSamples);assert.equal(result.normalized,null,'Active duration is a lower bound for elapsed coverage, never a clipping cap');assert.equal(result.average,200,'Available sample average remains usable despite incomplete whole-ride NP coverage');
assert.equal(cyclingPowerStats(ride([...Array(60).fill(200),null,-1,NaN],5,300)).normalized,200,'Readings after the elapsed cap are ignored');
assert.equal(cyclingPowerStats(ride([...Array(60).fill(200),null],5,301)).normalized,null,'A partial final cell must still have a valid reading');
assert.equal(cyclingPowerStats(ride(Array(60).fill(Number.MAX_VALUE))).average,null,'Arithmetic overflow stays unavailable');
assert.equal(cyclingPowerStats(ride(Array(604801).fill(200),1)).normalized,null,'Oversized computations are bounded');
// Independent overlap oracle: exact 30-second windows, even when step does not divide 30.
function overlapNP(power,step,span){let fourth=0,weights=0;for(let i=0;i<Math.ceil(span/step);i++){const end=Math.min(span,(i+1)*step);if(end<30)continue;let sum=0;for(let j=0;j<=i;j++)sum+=power[j]*Math.max(0,Math.min(end,(j+1)*step)-Math.max(end-30,j*step));const weight=end-i*step;fourth+=(sum/30)**4*weight;weights+=weight}return (fourth/weights)**.25}
for(const step of [4,1.5,2.3]){const span=301.3,power=Array.from({length:Math.ceil(span/step)},(_,i)=>i%10<4?0:270);result=cyclingPowerStats(ride(power,step,span));near(result.normalized,overlapNP(power,step,span));}
const preview={average:181,normalized:229,averageSource:'recorded',normalizedSource:'estimated'};
assert.deepEqual(cyclingPowerStats({sportType:'cycling',summary:{},powerStats:preview}),preview,'Validated compact metadata preserves provenance');
assert.equal(cyclingPowerStats({sportType:'cycling',summary:{power:0,normalizedPower:0},powerStats:preview}).normalized,0);
assert.equal(cyclingPowerStats({...data,powerStats:preview}).normalized,200,'Raw recording takes precedence over cached preview');
assert.equal(cyclingPowerStats({...ride(Array(60).fill(null)),powerStats:preview}).normalized,null,'Invalid current raw data cannot restore stale preview');
assert.deepEqual(cyclingPowerStats({sportType:'cycling',powerStats:{...preview,averageSource:'unknown',normalizedSource:null}}),{average:null,normalized:null,averageSource:null,normalizedSource:null});
assert.deepEqual(cyclingPowerStats({...data,sportType:'running',powerStats:preview}),{average:null,normalized:null,averageSource:null,normalizedSource:null},'Cycling-only behavior');

// Decode a real FIT fixture to verify session and lap normalizedPower survive the provider boundary.
const encoder=new Encoder(),start=new Date('2026-10-11T07:00:00Z'),at=n=>new Date(+start+n*1000);
encoder.onMesg(Profile.MesgNum.FILE_ID,{manufacturer:'garmin',type:'activity',product:1,timeCreated:start});
for(let i=0;i<300;i++)encoder.onMesg(Profile.MesgNum.RECORD,{timestamp:at(i),power:200});
encoder.onMesg(Profile.MesgNum.LAP,{messageIndex:0,startTime:start,timestamp:at(300),totalTimerTime:300,totalElapsedTime:300,avgPower:196,normalizedPower:251});
encoder.onMesg(Profile.MesgNum.SESSION,{messageIndex:0,sport:'cycling',startTime:start,timestamp:at(300),totalTimerTime:300,totalElapsedTime:300,avgPower:197,normalizedPower:249});
const decoder=new Decoder(Stream.fromByteArray(encoder.close()));assert.ok(decoder.isFIT());assert.ok(decoder.checkIntegrity());const {messages,errors}=decoder.read();assert.equal(errors.length,0);
const native=compile('app/coros-native.ts'),fit=new Function('sportFamily','workoutEvidence',native+compile('app/api/coros/fit.ts')+';return {decodedFit,corosNativeActivity}')(sportFamily,()=>({}));
const detail=fit.decodedFit(messages,{id:'fit',provider:'coros',sportType:'cycling',summary:{}});
assert.equal(detail.summary.power,197);assert.equal(detail.summary.normalizedPower,249);assert.equal(detail.laps[0].normalizedPower,251);assert.equal(fit.corosNativeActivity(detail).summary.normalizedPower,249);
assert.equal(fit.corosNativeActivity({...detail,nativeVersion:undefined}).summary.normalizedPower,undefined,'Unverified archived fields are not trusted');
result=cyclingPowerStats(detail);assert.equal(result.normalized,249);assert.equal(result.normalizedSource,'recorded');
const zero=fit.decodedFit({sessionMesgs:[{startTime:start,timestamp:at(300),totalTimerTime:300,normalizedPower:0}],lapMesgs:[{normalizedPower:0}],recordMesgs:[]},{id:'zero',sportType:'cycling',summary:{}});assert.equal(zero.summary.normalizedPower,0);assert.equal(zero.laps[0].normalizedPower,0);
console.log('Cycling power: provider/preview precedence, zero watts, partial-cell weighting, exact 30-second NP, source labels, gaps/coarse/short/truncated recordings and FIT session/lap mapping passed.');
