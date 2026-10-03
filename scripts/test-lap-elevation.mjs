import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {lapElevation,lapElevationPaths}=await import('data:text/javascript;base64,'+Buffer.from(compile('app/lap-elevation.ts')).toString('base64'));
const fixture={summary:{duration:30,durationTotal:30},laps:[{duration:20,durationTotal:20},{duration:10,durationTotal:10}],seriesSampled:{sampleSize:5,data:{altitude:[0,5,20,15,10,0]}}};
const elevation=lapElevation(fixture);
assert.equal(elevation.min,0);assert.equal(elevation.max,20);
assert.ok(elevation.segments[0].some(p=>p.x===.666667&&p.metres===10),'Second lap begins at its recorded boundary');
assert.ok(lapElevationPaths(elevation)[0].includes(',8.00'),'Highest elevation is above lower elevation');
const paused=structuredClone(fixture);paused.laps[0].duration=10;paused.summary.duration=20;
assert.ok(lapElevation(paused).segments[0].some(p=>p.x===.5&&p.metres===10),'Elapsed altitude aligns with active-width lap bars despite a pause');
const gapped=structuredClone(fixture);gapped.seriesSampled.data.altitude[2]=null;
assert.equal(lapElevation(gapped).segments.length,2,'Missing samples break the line');
const isolated={laps:[{duration:10}],seriesSampled:{sampleSize:1,data:{altitude:[100,101,null,999,null,100,101,102,103,104]}}};
assert.equal(lapElevation(isolated).max,104,'An isolated unplottable sample does not distort the visible range');
const flat=structuredClone(fixture);flat.seriesSampled.data.altitude.fill(-12);
assert.equal(lapElevation(flat).min,-12);assert.ok(lapElevationPaths(lapElevation(flat))[0].split(' ').every(p=>p.endsWith(',50.00')),'Flat below-sea-level elevation remains flat');
const misaligned=structuredClone(fixture);misaligned.laps[0].duration=100;misaligned.laps[0].durationTotal=100;
assert.equal(lapElevation(misaligned),null,'Never stretch unmatched timing');
assert.equal(lapElevation({...fixture,mergedIds:['a','b']}),null,'Do not compress gaps between merged recordings');
assert.equal(lapElevation({...fixture,seriesSampled:undefined}),null,'No invented elevation from lap ascent/descent');
const distanceAligned={laps:[{duration:100,durationTotal:110,distance:10},{duration:100,durationTotal:110,distance:20}],seriesSampled:{sampleSize:5,data:{altitude:[10,20,30,40,50,60],distance:[0,3,6,9,15,30]}}};
assert.ok(lapElevation(distanceAligned),'Recorded distance can locate compressed lap boundaries');
distanceAligned.seriesSampled.data.distance[4]=1;assert.equal(lapElevation(distanceAligned),null,'Reject backward cumulative distance');
const large={laps:[{duration:60000}],seriesSampled:{sampleSize:1,data:{altitude:Array.from({length:60000},(_,i)=>i===31000?500:30+Math.sin(i/100))}}};
const compact=lapElevation(large);assert.ok(compact.segments.flat().length<=384);assert.ok(compact.segments.flat().some(p=>p.metres===500),'Compact preview retains the summit');

// Exercise the real provider preview branch: request samples upstream, return
// only the compact profile rather than the athlete's full sensor/GPS arrays.
const route=compile('app/api/sync/tredict.ts').replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const {POST}=new Function('lapElevation','workoutEvidence',route+';return {POST}') (lapElevation,()=>({version:1}));
const originalFetch=globalThis.fetch;
try{
 globalThis.fetch=async url=>{assert.equal(new URL(url).searchParams.get('allSeries'),'1');return Response.json({...fixture,seriesSampled:{...fixture.seriesSampled,data:{...fixture.seriesSampled.data,positionLat:[48,49]}}})};
 const result=await POST(new Request('https://sieste.test/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-only',action:'preview',id:'run'})}));
 assert.equal(result.status,200);const preview=(await result.json()).details[0];assert.equal(preview.previewVersion,1);assert.ok(preview.elevationPreview);assert.equal(preview.seriesSampled,undefined);assert.ok(!JSON.stringify(preview).includes('positionLat'));
}finally{globalThis.fetch=originalFetch}
console.log('Lap elevation: recorded boundaries, paused timing, gaps, flat/negative altitude, missing data, distance reconciliation, bounded extrema and compact Tredict preview passed.');
