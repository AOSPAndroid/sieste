import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function moduleUrl(name){
 let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);
 return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
}
const sig=await import(moduleUrl('route-signature'));
const h=await import(moduleUrl('route-history'));
const path=(points,start=[48.85,2.35])=>{let d=0;for(let i=1;i<points.length;i++)d+=sig.metres(points[i-1],points[i]);return {line:sig.encode(points),distance:Math.round(d),start:points[0],end:points.at(-1)}};
// An out-and-back to the west, a jittered copy of it, and one to the north.
const west=[...Array(60)].map((_,i)=>[48.85+.0001*Math.sin(i),2.35-.004*(i<30?i:59-i)]);
const westAgain=west.map(([a,b],i)=>[a+.0003*Math.cos(i),b+.0002]);
const north=[...Array(60)].map((_,i)=>[48.85+.004*(i<30?i:59-i),2.35]);
assert.equal(h.sameRoute(path(west),path(westAgain)),true,'A slightly different GPS trace of the same route matches');
assert.equal(h.sameRoute(path(west),path(north)),false,'Same start and length, different direction, no match');
assert.equal(h.sameRoute(path(west),path(west.slice(0,40))),false,'A much shorter route does not match');
const loop=Array.from({length:81},(_,i)=>[48.85+.02*Math.sin(i*Math.PI/40),2.35+.03*(1-Math.cos(i*Math.PI/40))]);
assert.equal(h.sameRoute(path(loop),path([...loop].reverse())),false,'Opposite directions around a closed loop are different timed routes');
assert.equal(h.sameRoute(path(loop),path(loop.map(([lat,lon])=>[lat+.0001,lon+.0001]))),true,'A loop still matches with small GPS differences');

const ride=(id,date,points,duration,extra={})=>({id,date,sportType:'cycling',title:id,summary:{duration,distance:path(points).distance,...extra.summary},evidence:{route:path(points),climbs:extra.climbs??[],best:extra.best}});
const history=[ride('a','2026-09-01T08:00:00Z',west,3600),ride('b','2026-09-08T08:00:00Z',westAgain,3500),ride('c','2026-09-10T08:00:00Z',north,3000),ride('later','2026-10-30T08:00:00Z',west,3000)];
const today=ride('today','2026-10-01T08:00:00Z',west,3550);
const attempts=h.routeAttempts(today,history);
assert.equal(attempts.count,3,'Two earlier rides of the route, never later ones or other routes');
assert.equal(attempts.rank,2);assert.equal(attempts.behind,50);assert.equal(attempts.best.id,'b');
assert.equal(h.routeAttempts(ride('x','2026-10-01T08:00:00Z',north.map(([a,b])=>[a,b+.5]),1000),history),null,'A new route has nothing to compare');

const climb=(seconds,shift=0)=>({at:600,start:[48.86+shift,2.36],end:[48.865+shift,2.36],gain:80,seconds,distance:900,grade:8.9});
const withClimbs=[ride('c1','2026-09-01T08:00:00Z',west,3600,{climbs:[climb(300)]}),ride('c2','2026-09-05T08:00:00Z',west,3600,{climbs:[climb(280)]}),ride('c3','2026-09-06T08:00:00Z',west,3600,{climbs:[climb(200,.01)]})];
const up=h.climbAttempts(climb(290),today,withClimbs);
assert.deepEqual([up.rank,up.count,up.behind],[2,3,10],'2nd of 3, 10 s off the best; a climb 1 km away is a different climb');

const best=(power)=>({power:[{seconds:60,value:power},{seconds:300,value:power-40}]});
const analysed=[1,2,3].map(i=>ride('p'+i,`2026-09-0${i}T08:00:00Z`,west,3600,{best:best(400+i),climbs:[{...climb(300),gain:60+i}]}));
const records=h.workoutRecords(ride('now','2026-10-01T08:00:00Z',west.concat(west),7200,{best:{power:[{seconds:60,value:420},{seconds:300,value:350}]},climbs:[{...climb(300),gain:90}]}),analysed);
assert.deepEqual(records.map(r=>r.id),['power-60','distance','climb'],'1 min power, longest distance and biggest climb; 5 min power is not a record');
assert.equal(records[0].previous,403);
assert.deepEqual(h.workoutRecords(today,analysed.slice(0,2)),[],'Fewer than three analysed sessions: no records claimed');

console.log('Route history: route matching, earlier attempts, climb attempts and records passed.');
