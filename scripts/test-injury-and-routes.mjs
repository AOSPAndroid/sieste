import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile=name=>ts.transpileModule(readFileSync(new URL(`../app/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const {routeGeometry}=await import(url(compile('route-geometry')));
assert.equal(routeGeometry([],[]),null);assert.equal(routeGeometry([48],[2]),null);assert.equal(routeGeometry([48,48],[2,2]),null);
const g=routeGeometry([48,48.001,null,48.003,48.004],[2,2.001,null,2.003,2.004]);assert.equal(g.segments.length,2);assert.equal(g.points.length,4);assert.ok(g.zoom>=1&&g.zoom<=17);
assert.equal(routeGeometry([91,92],[0,1]),null);assert.equal(routeGeometry([48,49],[181,182]),null);
const crossing=routeGeometry([0,0.001],[179.99,-179.99]);assert.ok(Math.abs(crossing.points[1].x-crossing.points[0].x)<.001);
assert.ok(routeGeometry(Array.from({length:150000},(_,i)=>48+i*.00000001),Array(150000).fill(2)));
const {trainingReview,symptomGuidance}=await import(url(compile('injury-signals').replace("'./sports'",JSON.stringify(url(compile('sports'))))));
const records=[];for(let i=0;i<35;i++){const d=new Date('2026-09-17');d.setUTCDate(d.getUTCDate()-i);records.push({date:d.toISOString(),sportType:'running',summary:{duration:i<7?7200:3600}})}
const result=trainingReview(records,'2026-09-17','2026-01-01');assert.equal(result[0].flag,true);assert.equal(result[0].available,true);assert.equal(result[1].available,false);
assert.equal(trainingReview(records,'2026-09-17','2026-09-10')[0].available,false);
assert.equal(trainingReview([...records,{date:'2026-09-17',sportType:'running',summary:{}}],'2026-09-17','2026-01-01')[0].available,false);
assert.equal(symptomGuidance({pain:0,urgent:false,emergency:true}).level,'emergency');assert.equal(symptomGuidance({pain:0,urgent:true,emergency:false}).level,'urgent');assert.equal(symptomGuidance({pain:3,urgent:false,emergency:false}).level,'review');assert.equal(symptomGuidance({pain:0,urgent:false,emergency:false}).level,'unknown');
console.log('Passed: GPS validation, gaps, dateline wrapping, large tracks, training-history coverage, volume-change rules and symptom priority without false clearance.');
