import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='Europe/Paris';
function moduleUrl(name){let s=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,d)=>`from "${moduleUrl(d)}"`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
const {weeklyZones,zoneWeek}=await import(moduleUrl('weekly-zones-data'));
const now=new Date('2026-09-25T12:00:00+02:00'),bands=[{from:-1,to:139},{from:140,to:159},{from:160,to:-1}];
const a=(date,sportType='running',extra={})=>({id:date,date,sportType,summary:{duration:600},...extra});
let data={activities:[a('2026-09-21T00:00:00+02:00','running',{hrHistogram:{validSeconds:600,secondsByBpm:{139:100,140:200,160:300}}}),a('2026-09-22T12:00:00+02:00','running',{summary:{zonesDistribution:{heartrate:[60,120,180]}}}),a('2026-09-23T12:00:00+02:00'),a('2026-09-20T23:59:00+02:00'),a('2026-09-26T12:00:00+02:00'),a('2026-09-22T13:00:00+02:00','cycling')],extra:{zones:{zones:{running:{heartrate:{'2026-01-01':bands}}}}}};
let r=weeklyZones(data,now,0,'running');assert.equal(r.sessions,3);assert.equal(r.groups[0].covered,2);assert.deepEqual(r.groups[0].seconds,[160,320,480]);assert.equal(r.start.getDay(),1);
assert.equal(weeklyZones(data,now,-1,'running').sessions,1);
assert.equal(weeklyZones(data,now,0,'cycling').groups.length,0);
data={...data,extra:{}};r=weeklyZones(data,now,0,'running');assert.equal(r.groups[0].bands,null);assert.deepEqual(r.groups[0].seconds,[60,120,180]);
data.activities.push(a('2026-09-23T13:00:00+02:00','running',{provider:'coros',summary:{zonesDistribution:{heartrate:[10,20,30,40,50]}}}));assert.equal(weeklyZones(data,now,0,'running').groups.length,2);
data.activities.push(a('2026-09-23T14:00:00+02:00','running',{summary:{zonesDistribution:{heartrate:[NaN,20]}}}));assert.equal(weeklyZones(data,now,0,'running').groups.length,2);
const dst=zoneWeek(new Date('2026-10-25T12:00:00+01:00'),0);assert.equal((dst.end-dst.start)/3600000,169);
console.log('Passed: calendar weeks, DST, exact boundaries, sport separation, missing/invalid data, provider and zone-count separation, recorded totals and histogram reclassification.');
