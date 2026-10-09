import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import sharp from 'sharp';
process.env.TZ='UTC';
const cache=new Map();
function moduleUrl(name){if(cache.has(name))return cache.get(name);const json=name.endsWith('.json');let s=json?'export default '+readFileSync(new URL('../app/'+name,import.meta.url),'utf8'):ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);const u='data:text/javascript;base64,'+Buffer.from(s).toString('base64');cache.set(name,u);return u}
const {monthlyBests,intervalConsistency}=await import(moduleUrl('training-coach-data'));
const {editRoute,routeGpx}=await import(moduleUrl('route-tools-data'));
const {monthRoutePoster}=await import(moduleUrl('month-route-poster-data'));
const workout=(id,date,speed,sportType='running')=>({id,date,sportType,evidence:{version:1,best:{speed:[{seconds:300,value:speed}]}}});
const months=monthlyBests({activities:[workout('a','2026-08-01',3),workout('b','2026-09-01',4),workout('c','2026-10-01',9),workout('bike','2026-09-01',20,'cycling')]},new Date('2026-09-28'),'running',300);
assert.equal(months.length,6);assert.equal(months[4].value,3);assert.equal(months[5].value,4);assert.equal(months[0].value,null);assert.equal(months[5].partial,true);
const laps=[200,198,190].map(power=>({duration:60,power}));assert.equal(intervalConsistency(laps,[0,1,2],'cycling').firstFade,2);
assert.equal(intervalConsistency([{duration:60,power:200},{duration:300,power:200},{duration:60,power:200}],[0,1,2],'cycling').valid,false);
const detail={title:'A < B & route',seriesSampled:{sampleSize:10,data:{positionLat:[48,48.001,48.002,null,48.004,48.005,48.006,48.007,48.008],positionLong:[2,2.001,2.002,null,2.004,2.005,2.006,2.007,2.008],altitude:[1,2,3,4,5,6,7,8,9]}}};
const before=JSON.stringify(detail),edit=editRoute(detail,10,80,[{start:50,end:50}]);assert.equal(JSON.stringify(detail),before);assert.deepEqual(edit.geometry.segments.map(s=>s.map(p=>p.index)),[[1,2],[4],[6,7,8]]);const gpx=routeGpx(detail,edit.geometry);assert.equal((gpx.match(/<trkseg>/g)||[]).length,2);assert.ok(gpx.includes('A &lt; B &amp; route'));assert.ok(!gpx.includes('<time>'));assert.equal(editRoute(detail,80,10),null);
const svg=monthRoutePoster([{id:'a',date:'1 Sep',distance:1000,geometry:edit.geometry}],'<September>','chrome','#fff');assert.ok(svg.includes('&lt;SEPTEMBER&gt;'));const png=await sharp(Buffer.from(svg)).png().toBuffer(),meta=await sharp(png).metadata();assert.equal(meta.width,1080);assert.equal(meta.height,1350);assert.ok(meta.hasAlpha);assert.equal((await sharp(png).ensureAlpha().raw().toBuffer())[3],0);
console.log('Passed: monthly evidence boundaries, missing values, repeat fading and comparability, non-destructive trimming and segment gaps, escaped GPX, transparent poster render.');
