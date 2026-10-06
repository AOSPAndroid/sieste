import ts from 'typescript';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const code=ts.transpileModule(readFileSync('app/route-geometry.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('export ','');const {routeGeometry,selectedRouteSegments,fitRouteSegments,contextualSelectionFit,routeCursorPoint}=new Function(code+';return {routeGeometry,selectedRouteSegments,fitRouteSegments,contextualSelectionFit,routeCursorPoint}')();
const geometry=routeGeometry([48,48.001,null,48.003,48.004,48.005],[2,2.001,null,2.003,2.004,2.005]);
const selected=selectedRouteSegments(geometry.segments,60,{start:1,end:5,label:'Effort 1'});assert.deepEqual(selected.map(s=>s.map(p=>p.index)),[[1],[3,4]]);assert.equal(selectedRouteSegments(geometry.segments,60,null).length,0);assert.equal(selectedRouteSegments(geometry.segments,null,{start:1,end:5,label:'a'}).length,0);assert.equal(selectedRouteSegments(geometry.segments,60,{start:2,end:3,label:'GPS gap'}).length,0);
for(const selection of [{start:-1,end:2},{start:NaN,end:2},{start:1,end:Infinity},{start:2,end:2},{start:3,end:2}])assert.deepEqual(selectedRouteSegments(geometry.segments,60,{...selection,label:'Invalid'}),[]);
for(const step of [0,-1,NaN,Infinity])assert.deepEqual(selectedRouteSegments(geometry.segments,step,{start:0,end:5,label:'Invalid sample step'}),[]);
assert.equal(fitRouteSegments([]),null);assert.equal(fitRouteSegments([[]]),null);
assert.equal(fitRouteSegments([[geometry.points[0]]]),null,'One GPS point has no section to fit');
assert.equal(fitRouteSegments([[geometry.points[0],geometry.points[0]]]),null,'Stationary coordinates do not invent a section');
assert.equal(fitRouteSegments([[{x:NaN,y:0},{x:1,y:Infinity}]]),null,'Invalid projected coordinates cannot produce a viewport');
const before=JSON.stringify(selected),fit=fitRouteSegments(selected);assert.ok(fit);assert.equal(JSON.stringify(selected),before,'Fitting never changes, merges or downsamples selected GPS segments');
assert.deepEqual(fitRouteSegments(geometry.segments),{center:geometry.center,zoom:geometry.zoom},'Full-route reset retains its original fit');
function inside(fit,segments){const scale=256*2**fit.zoom;for(const segment of segments)for(const p of segment){const x=(p.x-fit.center.x)*scale+400,y=(p.y-fit.center.y)*scale+210;assert.ok(x>=50-1e-6&&x<=750+1e-6);assert.ok(y>=50-1e-6&&y<=370+1e-6)}}
inside(fit,selected);
const long=routeGeometry([48,48.01,48.011,48.05,48.1],[2,2.01,2.011,2.05,2.1]);const short=selectedRouteSegments(long.segments,60,{start:1,end:3,label:'Small climb'}),shortFit=fitRouteSegments(short);assert.ok(shortFit.zoom>long.zoom,'A small selected climb can be fitted closer than the whole route');inside(shortFit,short);
const dateline=routeGeometry([0,.01,null,.02,.03],[179.9,179.95,null,-179.98,-179.9]);assert.equal(dateline.segments.length,2);assert.ok(dateline.center.x>.999&&dateline.center.x<1.001,'Dateline route remains beside the seam');const datelineSelected=selectedRouteSegments(dateline.segments,60,{start:1,end:5,label:'Dateline climb'}),datelineFit=fitRouteSegments(datelineSelected);assert.equal(datelineSelected.length,2,'Fitting does not join dateline recording gaps');assert.ok(datelineFit.center.x>1,'Fit reuses the route’s unwrapped coordinates');inside(datelineFit,datelineSelected);
assert.ok(fitRouteSegments([[{x:0,y:0},{x:1,y:1}]]).zoom>=1);assert.ok(fitRouteSegments([[{x:1,y:.5},{x:1.000000001,y:.500000001}]]).zoom<=17,'Selected fit zoom remains bounded');
console.log('Route selection: source timing, gap/end boundaries, invalid and missing selections, explicit bounded fits, stationary/one-point handling, unchanged full-route fit and dateline continuity passed.');

const context=contextualSelectionFit(shortFit,'climb');assert.ok(context);inside(context,short);
assert.deepEqual(context.center,shortFit.center,'Automatic and explicit fits center the same recorded climb');
function span(view){return 800/(256*2**view.zoom)}
assert.equal(span(context),span(shortFit)*2,'Automatic climb framing covers twice the surrounding distance of an explicit fit');
assert.ok(context.zoom>long.zoom,'A small climb automatically zooms in from the whole-route view');
assert.equal(JSON.stringify(selected),before,'Context fitting preserves GPS gaps and original selected samples');
for(const kind of ['lap',undefined])assert.equal(contextualSelectionFit(shortFit,kind),null,'Other section types never request automatic camera changes');
assert.deepEqual(contextualSelectionFit(shortFit,'effort'),context,'Efforts and climbs use the same centered contextual camera');
for(const kind of ['climb','effort']){
for(const points of [[],[[]],[[geometry.points[0]]],[[geometry.points[0],geometry.points[0]]]])assert.equal(contextualSelectionFit(fitRouteSegments(points),kind),null,'Missing or stationary GPS never invents an automatic viewport');
const datelineContext=contextualSelectionFit(datelineFit,kind);inside(datelineContext,datelineSelected);assert.deepEqual(datelineContext.center,datelineFit.center,'Auto framing preserves unwrapped dateline coordinates');
const world=fitRouteSegments([[{x:0,y:0},{x:1,y:1}]]);assert.equal(contextualSelectionFit(world,kind).zoom,1,'Automatic framing remains inside map zoom limits');
const tightBefore=JSON.stringify(shortFit);contextualSelectionFit(shortFit,kind);assert.equal(JSON.stringify(shortFit),tightBefore,'Automatic framing leaves the tighter explicit fit unchanged');
}
console.log('Effort and climb auto framing: consistent broader span, centered recorded bounds, real zoom-in, lap/unspecified no-ops, missing/stationary GPS, dateline continuity and bounded zoom passed.');

const contiguous=routeGeometry(Array.from({length:10},(_,i)=>48+i*.001),Array.from({length:10},(_,i)=>2+i*.001));
const ranges={start:0,end:9,label:'Flat sections',kind:'terrain',ranges:[{start:6,end:9},{start:0,end:2},{start:1,end:3}]};
assert.deepEqual(selectedRouteSegments(contiguous.segments,60,ranges).map(s=>s.map(p=>p.index)),[[0,1,2],[6,7,8]],'Disjoint terrain/coasting selections never join the intervening route; overlaps merge');
assert.deepEqual(ranges.ranges,[{start:6,end:9},{start:0,end:2},{start:1,end:3}],'Selection input remains unchanged');
assert.deepEqual(selectedRouteSegments(contiguous.segments,60,{...ranges,ranges:[]}),[]);
assert.deepEqual(selectedRouteSegments(contiguous.segments,60,{...ranges,ranges:[{start:0,end:Infinity}]}),[]);
assert.equal(routeCursorPoint(geometry.points,2),null,'GPS gaps have no replay position');
assert.equal(routeCursorPoint(geometry.points,3).index,3,'Replay follows the original sensor index');
for(const index of [null,-1,Infinity,NaN,.5,100])assert.equal(routeCursorPoint(geometry.points,index),null);
console.log('Multi-range route highlighting and exact replay cursor gap handling passed.');
