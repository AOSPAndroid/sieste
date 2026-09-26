import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function mod(name){let s=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,d)=>`from "${mod(d)}"`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
const {validateMerge,mergedActivity,applyMerges,mergeDetails}=await import(mod('activity-merge-data'));
const {effortProfile}=await import(mod('effort-profile-data'));
const a={id:'a',date:'2026-09-26T08:00:00Z',sportType:'cycling',provider:'tredict',summary:{duration:60,durationTotal:60,distance:500,calories:20,power:100,heartrate:120,effort:{heartrate:5},altitude:{ascent:5,descent:2}},laps:[{duration:60,distance:500}],seriesSampled:{sampleSize:1,data:{power:Array(60).fill(100),positionLat:Array(60).fill(48),positionLong:Array(60).fill(2),distance:Array.from({length:60},(_,i)=>i*8)}}};
const b={...a,id:'b',date:'2026-09-26T08:02:00Z',summary:{...a.summary,duration:120,durationTotal:120,distance:1000,calories:40,power:200,heartrate:150},laps:[{duration:120,distance:1000}],seriesSampled:{sampleSize:2,data:{power:Array(60).fill(200),positionLat:Array(60).fill(49),positionLong:Array(60).fill(3),distance:Array.from({length:60},(_,i)=>i*16)}}};
assert.equal(validateMerge([b,a],'Europe/Paris')[0].id,'a');
for(const pair of [[a,{...b,sportType:'running'}],[a,{...b,date:'2026-09-27T08:00:00Z'}],[a,{...b,date:'2026-09-26T08:00:30Z'}],[a,a]])assert.throws(()=>validateMerge(pair,'Europe/Paris'));
let m=mergedActivity([a,b],'merged_test');assert.equal(m.summary.duration,180);assert.equal(m.summary.durationTotal,240);assert.equal(m.summary.distance,1500);assert.equal(m.summary.calories,60);assert.equal(m.summary.power,500/3);assert.equal(m.summary.effort.heartrate,10);
assert.equal(mergedActivity([a,{...b,summary:{duration:120}}],'x').summary.distance,undefined);
const data={activities:[a,b],sleep:{},hrv:{}},group={id:'merged_test',ids:['a','b'],timeZone:'Europe/Paris'};
assert.equal(applyMerges(data,[group]).activities.length,1);assert.equal(data.activities.length,2);assert.equal(applyMerges(data,[]).activities.length,2);assert.equal(applyMerges({activities:[a]},[group]).activities.length,1);
const detail=mergeDetails([a,b],'merged_test');assert.equal(detail.seriesSampled.sampleSize,2);assert.equal(detail.seriesSampled.data.power[40],null);assert.equal(detail.seriesSampled.data.positionLat[60],null);assert.equal(detail.seriesSampled.data.distance[61],516);assert.equal(detail.laps[1].mergedStartSeconds,120);assert.equal(effortProfile(detail).laps[1].start,2);
assert.deepEqual(data.activities,[a,b]);
console.log('Merge validation, weighted stats, gaps, lap alignment, refresh overlay and undo passed.');
