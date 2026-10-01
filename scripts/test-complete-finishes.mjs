import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdirSync as ensureDirectory} from 'node:fs';
const artifactDirectory=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-design-review');
ensureDirectory(artifactDirectory,{recursive:true});
import {readFileSync} from 'node:fs';import ts from 'typescript';import sharp from 'sharp';import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync('app/share-card-design.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {shareCardSvg}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const stats=[{key:'distance',label:'Distance',value:'10.01',unit:'km'},{key:'duration',label:'Time',value:'51:00',unit:'min:sec'}];
const base={height:1080,transparent:true,ink:'white',accent:'#f472b6',title:'Today',sport:'Running',sportFamily:'running',date:'29 September',stats,route:null,brand:true,demo:false,dayCards:[{title:'Recovery',stats:[]},{title:'Running',sportFamily:'running',stats}],dayHealth:{sleep:28000,score:83,hrv:106,history:Array.from({length:7},(_,i)=>({date:'2026-09-'+(23+i),sleep:7+i/10,score:80+i,hrv:90+i*2}))}};
const templates=['daytrends','daybars','daymatrix','dayrings','scorecard','weekchart','metroen','sweatreceipten'];const tiles=[];
for(const [i,template] of templates.entries()){
 const svg=shareCardSvg({...base,template,finish:'iridescent'});
 for(const tag of svg.match(/<text[^>]*>/g)??[])assert.match(tag,/fill="url\(#metal(?:Soft)?\)"/);
 for(const tag of svg.match(/<(?:path|circle|rect|g)[^>]*stroke="[^>]*>/g)??[])assert.match(tag,/stroke="(?:none|url\(#(?:finishStroke|iconFinish)\))"/);
 assert.ok(svg.includes('gradientUnits="userSpaceOnUse"'));assert.ok(!svg.includes('#f472b6'));
 const png=await sharp(Buffer.from(svg)).resize(480,480).flatten({background:'#202631'}).png().toBuffer();tiles.push({input:png,left:i%2*490,top:Math.floor(i/2)*490});
}
await sharp({create:{width:970,height:1950,channels:3,background:'#eee'}}).composite(tiles).png().toFile(artifactDirectory+'/complete-finishes.png');
console.log('Passed: all text, chart strokes and icons finished; stroke gradients support zero-height paths.');

for(const finish of ['solid','chrome','gold','rose','copper','titanium','midnight','iridescent','rainbow']){
 const svg=shareCardSvg({...base,template:'daytrends',showLabels:false,finish});
 for(const key of ['sleep','score','hrv'])assert.ok(svg.includes('data-health-icon="'+key+'"'));
 assert.ok(svg.includes('data-sport-icon="running"'));assert.ok(!/>Running<|>SLEEP<|>OVERNIGHT HRV</.test(svg));
 if(finish!=='solid')for(const tag of svg.match(/<g data-(?:health|sport)-icon[^>]*>/g)??[])assert.ok(tag.includes('stroke="url(#iconFinish)"'));
 await sharp(Buffer.from(svg)).png().toBuffer();
}
console.log('Passed: icon-only sport and health labels in all nine finishes.');
