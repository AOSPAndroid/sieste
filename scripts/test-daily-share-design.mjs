import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';import sharp from 'sharp';import assert from 'node:assert/strict';
const src=ts.transpileModule(readFileSync('app/share-card-design.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {shareCardSvg}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const stats=[{key:'duration',label:'Activity time',value:'1:45:00',unit:'h:mm:ss'},{key:'calories',label:'Workout calories',value:'860',unit:'kcal'},{key:'sleep',label:'Sleep today',value:'8h 12m',unit:''},{key:'hrv',label:'Overnight HRV',value:'94',unit:'ms'}];
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',title:'Today · 29 Sept',sport:'Other',date:'',stats,route:null,brand:false,demo:false,dayCards:[{title:'Sleep & recovery',stats:stats.slice(2)},{title:'Morning run',stats:[{key:'distance',label:'Distance',value:'10.2',unit:'km'},{key:'duration',label:'Time',value:'55:00',unit:'min:sec'}]},{title:'Lunch ride',stats:[{key:'distance',label:'Distance',value:'22.6',unit:'km'}]},{title:'Strength',stats:[{key:'duration',label:'Time',value:'20:00',unit:'min:sec'}]}],dayMix:[{label:'Running',seconds:3300,color:'#818cf8'},{label:'Cycling',seconds:1800,color:'#38bdf8'},{label:'Strength',seconds:1200,color:'#fb923c'}],dayHealth:{sleep:29520,score:86,hrv:94,hrvRange:[72,113]},dayCoverage:{covered:3,total:3}};
const tiles=[];
for(const [i,template] of ['dayorbit','dayposter','dayticket','dayrings'].entries()){
 for(const height of [1080,1350,1920])for(const finish of ['solid','chrome','iridescent','rainbow']){
  const svg=shareCardSvg({...base,template,height,finish});assert.ok(svg.includes(template==='dayrings'?'8h12':'8h 12m'));assert.ok(svg.includes(template==='dayrings'?'>94<':'94 ms'));assert.ok(svg.includes('Morning run'));assert.ok(svg.includes('Lunch ride'));assert.ok(svg.includes('Strength'));assert.ok(!/NaN|Infinity/.test(svg));const png=await sharp(Buffer.from(svg)).png().toBuffer();const metadata=await sharp(png).metadata();assert.equal(metadata.height,height);assert.ok(metadata.hasAlpha);const corner=await sharp(png).extract({left:0,top:0,width:1,height:1}).raw().toBuffer();assert.equal(corner[3],0);
  if(height===1080&&finish==='solid')tiles.push({input:await sharp(png).resize(480,480).flatten({background:'#202631'}).png().toBuffer(),left:i*490,top:0});
 }
 const empty=shareCardSvg({...base,template,dayHealth:{},dayMix:[],dayCards:[{title:'Recovery',stats:[]}],stats:[]});assert.ok(!/NaN|Infinity/.test(empty));assert.ok(empty.includes(template==='dayrings'?'Not recorded':'Unavailable'));assert.ok(empty.includes('REST DAY'));
}
await sharp({create:{width:1950,height:480,channels:3,background:'#edf0f4'}}).composite(tiles).png().toFile('C:/Users/adell/Projects/sieste-design-review/daily-templates.png');
console.log('Passed: four daily templates, three sizes, four finishes, transparency, complete activity lists and missing-data/rest-day states.');
