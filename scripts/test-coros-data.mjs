import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {Decoder,Stream} from '@garmin/fitsdk';
const source=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const sportFamily=a=>a.subSportType==='strength_training'?'strength':a.sportType;
const p=new Function(source('app/coros-data.ts')+';return {corosRecords,corosSleep,corosHrv,corosLaps,corosSport}')();
const records=p.corosRecords('Sport Records — range (1 records)\n======\n1. Strength — 2026-09-19\n   Time Window: startTimestamp=1789811736 | endTimestamp=1789815349\n   Duration: 1:06:09 | Sets: 15\n | Avg HR: 104 bpm | Calories: 308 kcal\n   LabelId: 123 | SportType: 402');
assert.equal(sportFamily(records[0]),'strength');assert.equal(records[0].localDay,'2026-09-19');assert.equal(records[0].summary.duration,3969);
assert.throws(()=>p.corosRecords('Sport Records (2 records)\n1. broken'));
const sleep=p.corosSleep('Sleep Data\n2026-09-19\nSleep Score: 69\nMain Sleep: 8h 9min\nAwake Time: 22 min\nMain Sleep Window: 2026-09-19 00:02 - 2026-09-19 08:33\n');
assert.equal(sleep.sleep['20260919'][0],29340);assert.equal(sleep.windows['20260919'].wakeTime,'2026-09-19 08:33');
const native={id:'coros_100_1',sportType:'running',date:'2026-09-19T10:00:00Z',summary:{duration:600,distance:2000,calories:0}};
assert.equal(p.corosLaps({lapGroups:[{type:2,laps:[{distance:100000,time:300,avgCadence:180}]}]})[0].distance,1000);
const f=new Function('Decoder','Stream','workoutEvidence','sportFamily',source('app/coros-native.ts')+source('app/api/coros/fit.ts')+';return {decodedFit,fitDetail}')(Decoder,Stream,()=>({}),sportFamily);
const sample={sessionMesgs:[{startTime:'2026-09-19T10:00:00Z',timestamp:'2026-09-19T10:00:02Z',totalDistance:10,totalTimerTime:2,avgCadence:90,avgStepLength:1000,avgVerticalOscillation:70}],recordMesgs:[{timestamp:'2026-09-19T10:00:01Z',positionLat:536870912,positionLong:0,cadence:90,heartRate:140,stepLength:1000,verticalOscillation:70}]};
let detail=f.decodedFit(sample,native);assert.equal(detail.summary.cadence,180);assert.equal(detail.summary.stepLength,100);assert.equal(detail.summary.verticalOscillation,7);assert.equal(detail.seriesSampled.data.positionLat[1],45);assert.equal(detail.summary.distance,10);assert.equal(detail.hrHistogram.validSeconds,1);
assert.equal(f.decodedFit(sample,{...native,sportType:'cycling'}).summary.cadence,90);
// Pedalling: FIT balance is a bitfield (0x80 = right leg's share), stored as the left leg's share; unknown sides are dropped.
const ride=f.decodedFit({sessionMesgs:[{startTime:'2026-09-19T10:00:00Z',timestamp:'2026-09-19T10:00:03Z',totalTimerTime:3,leftRightBalance:0x8000|4900,avgLeftTorqueEffectiveness:70,avgRightTorqueEffectiveness:80,avgLeftPedalSmoothness:20,avgRightPedalSmoothness:24,totalTrainingEffect:3.4,totalAnaerobicTrainingEffect:1.2,enhancedAvgRespirationRate:31.5,avgStanceTimeBalance:49.6}],recordMesgs:[{timestamp:'2026-09-19T10:00:01Z',power:200,leftRightBalance:0x80|48,leftTorqueEffectiveness:72,rightTorqueEffectiveness:78,combinedPedalSmoothness:21,respirationRate:30,grade:4.5},{timestamp:'2026-09-19T10:00:02Z',power:210,leftRightBalance:47}]},{...native,sportType:'cycling'});
const rd=ride.seriesSampled.data;
assert.equal(rd.leftRightBalance[1],52,'Right leg 48% means left 52%');assert.equal(rd.leftRightBalance[2],null,'Unknown side is not guessed');
assert.equal(rd.torqueEffectiveness[1],75);assert.equal(rd.pedalSmoothness[1],21);assert.equal(rd.respirationRate[1],30);assert.equal(rd.grade[1],4.5);
assert.equal(ride.summary.leftRightBalance,51);assert.equal(ride.summary.torqueEffectiveness,75);assert.equal(ride.summary.pedalSmoothness,22);
assert.equal(ride.summary.aerobicTrainingEffect,3.4);assert.equal(ride.summary.anaerobicTrainingEffect,1.2);assert.equal(ride.summary.respirationRate,31.5);assert.equal(ride.summary.groundContactTimeBalance,49.6);
if(process.argv.includes('--private-fixtures')){const read=n=>JSON.parse(readFileSync('.sites-runtime/'+n+'.json','utf8'));const actual=p.corosRecords(read('querySportRecords'));assert.ok(actual.length>1000);assert.ok(actual.every(a=>a.localDay));assert.ok(p.corosSleep(read('querySleepData')).sleep['20260919']);assert.ok(p.corosHrv(read('querySleepHrv'))['20260919']);const raw=read('downloadActivityFitFiles');const blob=raw.content.find(c=>c.type==='resource').resource.blob;const fit=f.fitDetail(blob,native);assert.ok(Math.abs(fit.summary.distance-11458.82)<.1);assert.equal(fit.summary.cadence,186);assert.ok(fit.seriesSampled.data.positionLat.some(v=>v>48&&v<49));console.log('Private real-response checks passed (no personal fixture committed).');}
console.log('COROS parsing, local dates, asleep duration, lap units and FIT units passed.');
