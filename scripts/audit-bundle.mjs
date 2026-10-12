import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import assetManifest from '../dist/server/__vite_rsc_assets_manifest.js';

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
for(const deferred of ['app/metric-trend.tsx','app/widget-comparisons.tsx','app/weekly-volume-detail.tsx','app/load-chart.tsx','app/workout-explorer.tsx','app/workout-replay.tsx','app/workout-route-compare.tsx','app/workout-lap-mosaic.tsx','app/athena-chat-panel.tsx','app/home-analysis-widgets.tsx','app/demo-data.ts','app/home-insights-grid.tsx','app/workspace-tools.tsx','app/coros-connection.tsx','app/activity-notification-settings.tsx','app/activity-share.tsx','app/share-card-renderer.ts']){
 assert.ok(manifest[deferred],`Deferred view missing: ${deferred}`);
 assert.ok(!initial.has(deferred),`${deferred} is eagerly loaded by the homepage`);
}
assert.ok(total('gzip')<=200000,`Initial JavaScript exceeds the 200 kB gzip budget: ${total('gzip')} bytes`);
console.log(JSON.stringify({scope:'Browser entry and homepage static JavaScript imports; excludes on-demand views, CSS, API payloads and HTML.',chunks:chunks.length,bytes:total('bytes'),gzipBytes:total('gzip'),budgetGzipBytes:200000},null,2));

const css=[...new Set([...initial].flatMap(key=>manifest[key].css??[]).concat(assetManifest.serverResources['app/layout.tsx'].css.map(file=>file.replace(/^\//,''))))];
const cssSizes=css.map(file=>{const content=readFileSync('dist/client/'+file);return {file,bytes:content.length,gzip:gzipSync(content).length}});
const cssTotal=field=>cssSizes.reduce((sum,file)=>sum+file[field],0);
assert.ok(cssTotal('gzip')<=55000,`Render-blocking CSS exceeds the 55 kB gzip budget: ${cssTotal('gzip')} bytes`);
console.log(JSON.stringify({scope:'Homepage render-blocking CSS; view styles load on demand.',files:cssSizes,bytes:cssTotal('bytes'),gzipBytes:cssTotal('gzip'),budgetGzipBytes:55000},null,2));

const share=new Set();
function visitShare(key){if(share.has(key)||initial.has(key))return;share.add(key);for(const dependency of manifest[key].imports??[])visitShare(dependency)}
for(const key of ['app/activity-share.tsx','app/share-card-renderer.ts','app/reference-share.ts'])visitShare(key);
const shareBytes=[...share].reduce((sum,key)=>sum+gzipSync(readFileSync('dist/client/'+manifest[key].file)).length,0);
const fontBytes=gzipSync(readFileSync('public/share-assets/fonts/reference-wide.json')).length;
assert.ok(shareBytes+fontBytes<=90000,`First headline share exceeds the 90 kB gzip budget: ${shareBytes+fontBytes} bytes`);
for(const key of share)assert.ok(!readFileSync('dist/client/'+manifest[key].file,'utf8').includes('data:image/png;base64,'),'Original artwork must remain an on-demand asset');
console.log(JSON.stringify({scope:'Additional first headline share JavaScript and selected font; excludes already-loaded homepage chunks, CSS and unused designs.',javascriptGzipBytes:shareBytes,fontGzipBytes:fontBytes,totalGzipBytes:shareBytes+fontBytes,budgetGzipBytes:90000},null,2));

const workerClient=readFileSync('dist/client/'+manifest['app/import-fit-worker-client.ts'].file,'utf8');
assert.ok(!workerClient.includes('file://'),'FIT worker must use an HTTP asset URL in production');
const workerPath=workerClient.match(/\/_next\/static\/import-fit\.worker-[\w-]+\.js/)?.[0];
assert.ok(workerPath&&existsSync('dist/client'+workerPath),'Production FIT worker asset is missing');
console.log('FIT decoder is emitted as a separate worker with a valid HTTP asset URL.');
