import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function moduleUrl(name){
 let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);
 return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
}
const sig=await import(moduleUrl('route-signature'));

// Encoding round-trips to 1e-5 degrees and matches Google's reference example.
assert.equal(sig.encode([[38.5,-120.2],[40.7,-120.95],[43.252,-126.453]]),'_p~iF~ps|U_ulLnnqC_mqNvxq`@');
const loop=[...Array(400)].map((_,i)=>[48.85+.02*Math.sin(i/400*2*Math.PI),2.35+.03*Math.cos(i/400*2*Math.PI)]);
const back=sig.decode(sig.encode(loop));
assert.equal(back.length,loop.length);assert.ok(back.every((p,i)=>Math.abs(p[0]-loop[i][0])<1e-5&&Math.abs(p[1]-loop[i][1])<1e-5));

// Simplification keeps the shape within budget and the ends exactly.
const lean=sig.simplify(loop,60);
assert.ok(lean.length<=60&&lean.length>=8);assert.deepEqual(lean[0],loop[0]);assert.deepEqual(lean.at(-1),loop.at(-1));
assert.ok(loop.every(p=>Math.min(...lean.slice(1).map((q,i)=>sig.toSegment(p,lean[i],q)))<200),'Every original point stays near the simplified line');
assert.ok(Math.abs(sig.metres([48.85,2.35],[48.86,2.35])-1112)<5,'0.01° of latitude is about 1.1 km');

// Signatures from sampled detail: outdoor only, starts/ends kept, indoor and tiny routes skipped.
const detail=(sportType,lat=loop.map(p=>p[0]),lon=loop.map(p=>p[1]),extra={})=>({sportType,seriesSampled:{sampleSize:10,data:{positionLat:lat,positionLong:lon,...extra}},summary:{}});
const route=sig.routeSignature(detail('cycling'));
assert.ok(route&&route.line.length<1500,'A loop stores in well under 1.5 KB');
assert.deepEqual(route.start,[48.85,2.38]);assert.ok(Math.abs(route.distance-13850)<100,'Distance follows the loop');
assert.equal(sig.routeSignature(detail('strength_training')),null);
assert.equal(sig.routeSignature(detail('running',[48.85,48.85],[2.35,2.35])),null,'Too few points');
assert.equal(sig.routeSignature(detail('running',loop.map(()=>0),loop.map(()=>0))),null,'Null-island samples are not a route');

// Climbs carry where they start and end, matched to the nearest located sample.
const hill=[...Array(400)].map((_,i)=>i<100?50:i<200?50+(i-100)*0.8:i<300?130-(i-200)*0.8:50);
const climbs=sig.climbSignatures(detail('running',undefined,undefined,{altitude:hill,distance:loop.map((_,i)=>i*40)}));
assert.ok(climbs.length>=1,'The hill is found');assert.ok(climbs[0].gain>=60);assert.equal(climbs[0].start.length,2);
console.log('Route signature: polyline encoding, simplification budget, outdoor-only signatures and located climbs passed.');
