import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {activityShareData}=await import(moduleUrl('activity-share-data'));
let r=activityShareData({sportType:'running',summary:{distance:5060,duration:1614,heartrate:137,cadence:180,altitude:{ascent:27},calories:316}});assert.equal(r.stats.find(s=>s.key==='distance').value,'5.06');assert.equal(r.stats.find(s=>s.key==='duration').value,'26:54');assert.equal(r.stats.find(s=>s.key==='pace').value,'5:19');assert.equal(r.stats.find(s=>s.key==='ascent').value,'27');
r=activityShareData({sportType:'misc',subSportType:'strength_training',summary:{duration:3661,distance:20,heartrate:87,calories:250}});assert.equal(r.sport,'Strength training');assert.equal(r.stats.find(s=>s.key==='duration').value,'1:01:01');assert.ok(!r.stats.some(s=>['pace','distance','speed'].includes(s.key)));
r=activityShareData({sportType:'cycling',summary:{distance:30000,duration:3600,power:220,cadence:90}});assert.equal(r.stats.find(s=>s.key==='speed').value,'30');assert.equal(r.stats.find(s=>s.key==='power').unit,'W');assert.equal(r.stats.find(s=>s.key==='cadence').unit,'rpm');
r=activityShareData({sportType:'running',summary:{duration:-1,distance:NaN,calories:null,heartrate:Infinity}});assert.equal(r.stats.length,0);assert.equal(activityShareData({sportType:'yoga',summary:{duration:1800}}).stats.length,1);
console.log('Passed: running pace/distance, exact duration, cycling power/speed units, strength labels, other sports and omitted missing values.');
