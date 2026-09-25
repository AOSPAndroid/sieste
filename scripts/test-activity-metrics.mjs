import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {activityMetrics,paceLabel,durationLabel}=await import(moduleUrl('activity-metrics'));
const detail={sportType:'running',summary:{distance:11460,duration:3590,heartrate:147,altitude:{ascent:53,descent:0},steps:11127},seriesSampled:{sampleSize:5,data:{distance:[0,4000,8000,11400],speed:[2,4,0,null],heartrate:[120,160],verticalOscillation:[7,7.2],verticalRatio:[7],grade:[0,1],temperature:[0,0],unknownSensor:[10,20]}}};
let result=activityMetrics(detail),find=id=>result.cards.find(m=>m.id===id);
assert.equal(find('distance').value,'11.46');assert.equal(find('distance').unit,'km');assert.deepEqual(find('distance').values,[0,4,8,11.4]);assert.equal(find('distance').note,'Total distance');
assert.equal(find('speed').value,paceLabel(3590/11460*1000),'Pace uses workout totals, not average of inverse speed samples');assert.deepEqual(find('speed').values,[500,250,null,null]);assert.equal(find('heartrate').value,'147','Recorded average takes precedence over stream mean');
assert.equal(find('altitude').value,'↑ 53 · ↓ 0');assert.equal(find('steps').value,'11,127');assert.equal(find('verticalOscillation').unit,'cm');assert.equal(find('verticalRatio').unit,'%');assert.equal(find('temperature').value,'0');assert.deepEqual(result.other,['unknownSensor']);
result=activityMetrics({...detail,summary:{}});assert.equal(find('distance').value,'11.4','Fallback uses last cumulative reading, never mean');assert.equal(find('heartrate').value,'140');assert.ok(find('heartrate').note.startsWith('Sample avg'));assert.equal(find('speed').value,'—','No unsupported average pace without totals');
result=activityMetrics({sportType:'cycling',summary:{distance:30000,duration:3600,power:200},seriesSampled:{data:{speed:[5,10]}}});assert.equal(find('speed').value,'30');assert.equal(find('speed').unit,'km/h');assert.deepEqual(find('speed').values,[18,36]);assert.equal(find('power').value,'200');
result=activityMetrics({sportType:'misc',subSportType:'strength_training',summary:{duration:60,calories:0}});assert.equal(find('speed'),undefined);assert.equal(find('calories').value,'0');
assert.equal(durationLabel(3590),'59m 50s');assert.equal(durationLabel(3600),'1h 0m 0s');assert.equal(paceLabel(0),'—');
console.log('Activity metrics: correct distance totals, pace weighting, summary precedence, sport units, gaps, zero values and unknown sensors passed.');
