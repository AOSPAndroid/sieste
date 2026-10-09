import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import sharp from 'sharp';

const cache=new Map();
function moduleUrl(name){
 if(cache.has(name))return cache.get(name);
 let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dependency)=>{
  if(dependency.endsWith('.json'))return `from "data:text/javascript;base64,${Buffer.from('export default '+readFileSync(new URL('../app/'+dependency,import.meta.url),'utf8')).toString('base64')}"`;
  return `from "${moduleUrl(dependency)}"`;
 });
 const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(name,url);return url;
}
const {monthRoutePoster,MONTH_POSTER_ROUTES_PER_PAGE}=await import(moduleUrl('month-route-poster-data'));
const {routeGeometry}=await import(moduleUrl('route-geometry'));
const geometry=routeGeometry([48,48.001,48.004,null,48.003,48.002,48],[2,2.003,2.001,null,2.004,2.007,2.009]);
assert.ok(geometry);assert.equal(geometry.segments.length,2);
const routes=Array.from({length:13},(_,index)=>({id:'route-'+index,date:`${index+1} Oct`,distance:10000+index*100,geometry}));
const before=JSON.stringify(routes);
const svg=monthRoutePoster(routes,'October <2026> & running','solid','#ffffff',1,2);
assert.equal(MONTH_POSTER_ROUTES_PER_PAGE,12);
assert.match(svg,/12 OF 13 ROUTES SHOWN/);
assert.match(svg,/126.6 KM/);assert.doesNotMatch(svg,/137.8 KM/);
assert.match(svg,/01 \/ 02/);
assert.match(svg,/OCTOBER &lt;2026&gt; &amp; RUNNING/);
assert.equal((svg.match(/data-month-route=/g)||[]).length,24,'Both real segments must remain separate for each of twelve shown routes.');
assert.doesNotMatch(svg,/route-12"/);
assert.ok([...svg.matchAll(/font-size="([\d.]+)"/g)].every(match=>Number(match[1])>=28),'Metadata remains legible at phone size.');
assert.equal((svg.match(/stroke-width="6\.5"/g)||[]).length,24);
assert.match(svg,/data-share-legibility="auto"/);assert.match(svg,/data-share-edge="dark"/);
assert.equal(JSON.stringify(routes),before,'Rendering must preserve source geometry and measurements.');
const unknown=monthRoutePoster([{...routes[0],distance:null}],'Missing distance','solid','#111111');
assert.match(unknown,/1 ROUTE/);assert.doesNotMatch(unknown,/1 ROUTES/);assert.doesNotMatch(unknown,/0\.0 KM/);assert.match(unknown,/data-share-edge="light"/);
assert.match(monthRoutePoster([routes[0]],'A "quote"','solid','" onload="bad'),/A &quot;QUOTE&quot;/);
assert.doesNotMatch(monthRoutePoster([routes[0]],'Title','solid','" onload="bad'),/onload=/);
const output='/workspace/scratch/sieste-month-poster-review';mkdirSync(output,{recursive:true});
for(const count of [1,6,12])for(const finish of ['solid','chrome']){
 const result=monthRoutePoster(routes.slice(0,count),'October 2026 · Running',finish,'#ffffff',1,count===12?3:1);
 const png=await sharp(Buffer.from(result)).png().toBuffer(),meta=await sharp(png).metadata();
 assert.equal(meta.width,1080);assert.equal(meta.height,1350);assert.ok(meta.hasAlpha);
 const raw=await sharp(png).ensureAlpha().raw().toBuffer();assert.equal(raw[3],0,'Canvas corners remain transparent.');
 let protectedPixels=0;for(let index=0;index<raw.length;index+=4)if(raw[index+3]>100&&raw[index]<80&&raw[index+1]<80&&raw[index+2]<80)protectedPixels++;
 assert.ok(protectedPixels>1000,'A white overlay retains enough dark edge to remain visible on bright photos.');
 writeFileSync(`${output}/${count}-${finish}.png`,png);
}
console.log('Monthly poster: twelve-route cap, honest totals, independent real GPS segments, readable labels, safe XML, and alpha/contrast exports passed.');
