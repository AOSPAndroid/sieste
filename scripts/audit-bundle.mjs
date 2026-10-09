import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

const manifest=JSON.parse(readFileSync('dist/client/.vite/manifest.json','utf8'));
const initial=new Set();
function visit(key){
 if(initial.has(key))return;
 assert.ok(manifest[key],`Missing manifest entry: ${key}`);
 initial.add(key);
 for(const dependency of manifest[key].imports??[])visit(dependency);
}
visit('app/page.tsx');
for(const [key,value] of Object.entries(manifest))if(value.isEntry)visit(key);
const files=[...new Set([...initial].map(key=>manifest[key].file))];
const chunks=files.map(file=>{const content=readFileSync('dist/client/'+file);return {file,bytes:content.length,gzip:gzipSync(content).length}});
const total=field=>chunks.reduce((sum,chunk)=>sum+chunk[field],0);
for(const deferred of ['app/metric-trend.tsx','app/widget-comparisons.tsx','app/weekly-volume-detail.tsx','app/load-chart.tsx','app/workout-explorer.tsx','app/workout-replay.tsx','app/workout-route-compare.tsx','app/workout-lap-mosaic.tsx','app/athena-chat-panel.tsx','app/home-analysis-widgets.tsx']){
 assert.ok(manifest[deferred],`Deferred view missing: ${deferred}`);
 assert.ok(!initial.has(deferred),`${deferred} is eagerly loaded by the homepage`);
}
assert.ok(total('gzip')<=200000,`Initial JavaScript exceeds the 200 kB gzip budget: ${total('gzip')} bytes`);
console.log(JSON.stringify({scope:'Browser entry and homepage static JavaScript imports; excludes on-demand views, CSS, API payloads and HTML.',chunks:chunks.length,bytes:total('bytes'),gzipBytes:total('gzip'),budgetGzipBytes:200000},null,2));
