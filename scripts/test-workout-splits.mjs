import {readFileSync} from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const src=ts.transpileModule(readFileSync('app/workout-splits-data.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {distanceSplits,splitLength,splitPace}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
// 3.5 km at 4 m/s sampled every 5 s: three full 250 s splits and a 0.5 km partial.
const step=5,dist=Array.from({length:176},(_,i)=>Math.min(3500,i*step*4)),hr=dist.map((_,i)=>i<50?140:160);
const s=distanceSplits(dist,step,1000,hr);
assert.deepEqual(s.map(x=>[x.index,Math.round(x.seconds),x.partial]),[[1,250,false],[2,250,false],[3,250,false],[4,125,true]]);
assert.equal(Math.round(splitPace(s[3],1000)),250,'Partial splits are compared per kilometre');
assert.equal(Math.round(s[0].heartrate),140);assert.ok(s[1].heartrate>140);
// Gaps and stalls: missing samples are skipped, a stop adds time to its split.
const gap=[0,null,800,1000,1000,1000,1500,2000];const g=distanceSplits(gap,10,1000);
assert.equal(g[0].seconds,30);assert.equal(g[1].seconds,40);
// Too little distance or bad input gives no splits.
assert.deepEqual(distanceSplits([0,50,100],5,1000),[]);assert.deepEqual(distanceSplits(null,5,1000),[]);assert.deepEqual(distanceSplits([0,1000,2000],0,1000),[]);
assert.equal(splitLength('cycling'),5000);assert.equal(splitLength('running'),1000);assert.equal(splitLength('swimming'),100);
console.log('Passed workout splits: interpolated boundaries, partial last split, heart rate per split, gaps and stops.');
