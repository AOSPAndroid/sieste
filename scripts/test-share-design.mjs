import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const src=ts.transpileModule(readFileSync(new URL('../app/share-card-design.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {shareCardSvg}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const points=[{x:0,y:0},{x:1,y:.2},{x:.7,y:1},{x:.2,y:.8},{x:0,y:0}];
const options={height:1080,transparent:true,ink:'white',accent:'#ffffff',title:'Paris after hours',sport:'Running',date:'18 September 2026',stats:[{key:'distance',label:'Distance',value:'5.06',unit:'km'},{key:'duration',label:'Activity time',value:'26:54',unit:'min:sec'},{key:'pace',label:'Average pace',value:'5:19',unit:'/km'},{key:'hr',label:'Average heart rate',value:'137',unit:'bpm'},{key:'ascent',label:'Elevation gain',value:'27',unit:'m'},{key:'calories',label:'Workout calories',value:'316',unit:'kcal'}],route:{points,segments:[points],center:{x:.5,y:.5},zoom:1},laps:Array.from({length:12},(_,i)=>({index:i+1,value:3+i/20,pace:1000/(3+i/20)})),dayCards:[{title:'Morning ride',stats:[{key:'distance',label:'Distance',value:'32.58',unit:'km'}]},{title:'Strength',stats:[{key:'duration',label:'Activity time',value:'38:35',unit:'min:sec'}]}],weekday:'Friday',time:'16:13',weekDays:[{label:'Mon',value:10},{label:'Tue',value:0},{label:'Wed',value:5},{label:'Thu',value:0},{label:'Fri',value:10},{label:'Sat',value:null},{label:'Sun',value:null}],brand:true,demo:true};
const dir=new URL('../../sieste-design-review/',import.meta.url);mkdirSync(dir,{recursive:true});
const tiles=[];
for(const [i,template] of ['editorial','route','split','signature','serif','laps','bib','strip','outline','receipt','chrono','hollow','scorecard','margin','caption','routebadge','panorama','bubble','wide','weekday','glass','weekbold','weekchart','daystack'].entries()){
 for(const height of [1080,1350,1920]){const svg=shareCardSvg({...options,template,height});assert.ok(!svg.includes('<rect width="1080"'));const png=await sharp(Buffer.from(svg)).png().toBuffer();const meta=await sharp(png).metadata();assert.equal(meta.width,1080);assert.equal(meta.height,height);assert.equal(meta.hasAlpha,true);const raw=await sharp(png).ensureAlpha().raw().toBuffer();assert.equal(raw[3],0);assert.ok(raw.some((v,i)=>i%4===3&&v>0));writeFileSync(new URL(template+'-'+height+'.png',dir),png);if(height===1080)tiles.push({input:await sharp(png).resize(480,480).flatten({background:'#26313e'}).png().toBuffer(),left:(i%2)*500,top:Math.floor(i/2)*500});}
}
const evil=shareCardSvg({...options,template:'editorial',title:'<script>&"Bad"'});assert.ok(!evil.includes('<script>'));assert.ok(evil.toLowerCase().includes('&lt;script&gt;'));
const opaque=await sharp(Buffer.from(shareCardSvg({...options,template:'split',transparent:false}))).ensureAlpha().raw().toBuffer();assert.equal(opaque[3],255);
await sharp({create:{width:980,height:5980,channels:3,background:'#dfe5ec'}}).composite(tiles).png().toFile(new URL('contact-sheet.png',dir).pathname.replace(/^\/(\w:)/,'$1'));
console.log('Passed: twenty-four designs at three sizes, transparent pixel alpha, opaque toggle, real rendered content, XML escaping. Rendered contact sheet for review.');
