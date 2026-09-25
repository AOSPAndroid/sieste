import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {trainingLogMonth}=await import(moduleUrl('training-log-data'));
const a=(id,date,sportType,summary,title)=>({id,date,sportType,summary,title});
const now=new Date('2026-09-19T12:00:00Z'),activities=[a('run','2026-09-19T08:00:00Z','running',{distance:10000,duration:3600},'Morning run'),a('lift','2026-09-18T08:00:00Z','strength_training',{duration:1800,distance:9999},'Gym'),a('old','2026-08-18T08:00:00Z','cycling',{distance:30000,duration:3600}),a('future','2026-09-19T20:00:00Z','running',{distance:99999,duration:9999})];
let r=trainingLogMonth(activities,'2026-09','all','',now);assert.equal(r.matches.length,2);assert.equal(r.matches[0].id,'run');assert.equal(r.distance,10);assert.equal(r.duration,5400);assert.equal(r.cells[0],null);assert.equal(r.cells[1].day,1);assert.equal(r.cells.filter(Boolean).length,30);assert.equal(r.cells.find(d=>d?.key==='2026-09-19').activities.length,1);
r=trainingLogMonth(activities,'2026-09','strength_training','gym',now);assert.equal(r.matches.length,1);assert.equal(r.distance,0);assert.equal(r.duration,1800);
r=trainingLogMonth([a('missing','2026-09-18T08:00:00Z','running',{})],'2026-09','all','',now);assert.equal(r.durationMissing,1);assert.equal(r.distanceMissing,1);
assert.equal(trainingLogMonth([],'2024-02','all','',now).cells.filter(Boolean).length,29);
assert.equal(trainingLogMonth(activities,'2026-08','all','',now).matches[0].id,'old');
console.log('Passed training log: month boundaries, Monday calendar, leap year, future filtering, sport/search filtering, totals and missing measurements.');
