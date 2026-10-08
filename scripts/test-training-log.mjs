import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {trainingLogMonth,trainingLogHeat}=await import(moduleUrl('training-log-data'));
const a=(id,date,sportType,summary,title)=>({id,date,sportType,summary,title});
const now=new Date('2026-09-19T12:00:00Z'),activities=[a('run','2026-09-19T08:00:00Z','running',{distance:10000,duration:3600},'Morning run'),a('lift','2026-09-18T08:00:00Z','strength_training',{duration:1800,distance:9999},'Gym'),a('old','2026-08-18T08:00:00Z','cycling',{distance:30000,duration:3600}),a('future','2026-09-19T20:00:00Z','running',{distance:99999,duration:9999})];
let r=trainingLogMonth(activities,'2026-09','all','',now);assert.equal(r.matches.length,2);assert.equal(r.matches[0].id,'run');assert.equal(r.distance,10);assert.equal(r.duration,5400);assert.equal(r.cells[0],null);assert.equal(r.cells[1].day,1);assert.equal(r.cells.filter(Boolean).length,30);assert.equal(r.cells.find(d=>d?.key==='2026-09-19').activities.length,1);
r=trainingLogMonth(activities,'2026-09','strength_training','gym',now);assert.equal(r.matches.length,1);assert.equal(r.distance,0);assert.equal(r.duration,1800);
r=trainingLogMonth([a('missing','2026-09-18T08:00:00Z','running',{})],'2026-09','all','',now);assert.equal(r.durationMissing,1);assert.equal(r.distanceMissing,1);
assert.equal(trainingLogMonth([],'2024-02','all','',now).cells.filter(Boolean).length,29);
assert.equal(trainingLogMonth(activities,'2026-08','all','',now).matches[0].id,'old');
console.log('Passed training log: month boundaries, Monday calendar, leap year, future filtering, sport/search filtering, totals and missing measurements.');

const run=a('run','2026-09-19T08:00:00Z','running',{distance:10000,duration:3600,calories:500});
const ride=a('ride','2026-09-19T10:00:00Z','cycling',{distance:40000,duration:5400,calories:1000});
const strength=a('lift','2026-09-19T12:00:00Z','strength_training',{distance:99999,duration:1800,calories:250});
let heat=trainingLogHeat([run,ride,strength],'distance');assert.equal(heat.total,50000);assert.equal(heat.level,5);assert.equal(heat.unavailable,false);
heat=trainingLogHeat([run,a('lift-no-distance','2026-09-19','strength_training',{})],'distance');assert.equal(heat.total,10000);assert.equal(heat.level,3);assert.equal(heat.missing,false);
heat=trainingLogHeat([strength],'distance');assert.equal(heat.total,0);assert.equal(heat.unavailable,true);assert.equal(heat.missing,false);assert.equal(heat.level,0);
for(const distance of [undefined,null,NaN,Infinity,-1,'10000']){heat=trainingLogHeat([run,a('unknown','2026-09-19','cycling',{distance})],'distance');assert.equal(heat.missing,true);assert.equal(heat.level,0);assert.equal(heat.total,10000);}
heat=trainingLogHeat([a('zero','2026-09-19','running',{distance:0})],'distance');assert.equal(heat.unavailable,false);assert.equal(heat.total,0);assert.equal(heat.level,0);
assert.deepEqual(trainingLogHeat([],'distance'),{total:0,level:0,missing:false,unavailable:false});
for(const [threshold,level] of [[5000,2],[10000,3],[25000,4],[50000,5]]){assert.equal(trainingLogHeat([a('boundary','2026-09-19','running',{distance:threshold})],'distance').level,level);assert.equal(trainingLogHeat([a('before','2026-09-19','running',{distance:threshold-1})],'distance').level,level-1);}
assert.equal(trainingLogHeat([run,ride,strength],'duration').total,10800);assert.equal(trainingLogHeat([run,ride,strength],'duration').level,5);
assert.equal(trainingLogHeat([run,ride,strength],'calories').total,1750);assert.equal(trainingLogHeat([run,ride,strength],'calories').level,5);
assert.equal(trainingLogHeat(trainingLogMonth([run,ride,strength],'2026-09','running','',now).matches,'distance').total,10000);
console.log('Passed calendar heatmap: recorded metres, distance thresholds, sport filtering, strength exclusions, missing/invalid readings, zero and existing measures.');
