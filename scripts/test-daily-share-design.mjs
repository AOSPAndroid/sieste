import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdirSync as ensureDirectory} from 'node:fs';
const artifactDirectory=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-design-review');
ensureDirectory(artifactDirectory,{recursive:true});
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';import sharp from 'sharp';import assert from 'node:assert/strict';
const src=ts.transpileModule(readFileSync('app/share-card-design.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {shareCardSvg}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const stats=[{key:'duration',label:'Activity time',value:'1:45:00',unit:'h:mm:ss'},{key:'calories',label:'Workout calories',value:'860',unit:'kcal'},{key:'sleep',label:'Sleep today',value:'8h 12m',unit:''},{key:'hrv',label:'Overnight HRV',value:'94',unit:'ms'}];
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',title:'Today · 29 Sept',sport:'Other',date:'',stats,route:null,brand:false,demo:false,dayCards:[{title:'Sleep & recovery',stats:stats.slice(2)},{title:'Morning run',sportFamily:'running',stats:[{key:'distance',label:'Distance',value:'10.2',unit:'km'},{key:'duration',label:'Time',value:'55:00',unit:'min:sec'}]},{title:'Lunch ride',sportFamily:'cycling',stats:[{key:'distance',label:'Distance',value:'22.6',unit:'km'}]},{title:'Strength',sportFamily:'strength_training',stats:[{key:'duration',label:'Time',value:'20:00',unit:'min:sec'}]}],dayMix:[{label:'Running',seconds:3300,color:'#818cf8'},{label:'Cycling',seconds:1800,color:'#38bdf8'},{label:'Strength',seconds:1200,color:'#fb923c'}],dayHealth:{sleep:29520,score:86,hrv:94,hrvRange:[72,113],history:Array.from({length:7},(_,i)=>({date:'2026-09-'+(23+i),sleep:i===3?null:[7.2,8.1,7.8,0,6.9,7.4,8.2][i],score:i===3?null:[80,91,88,0,74,82,86][i],hrv:i===3?null:[87,95,91,0,80,88,94][i]}))},dayCoverage:{covered:3,total:3}};
const tiles=[];
for(const [i,template] of ['daytrends','daycolumns','daybars','daypanels','dayline','daytype','daytiles','dayledger','daybalance','daypulse','dayribbon','dayposter','daymatrix','dayrings'].entries()){
 for(const height of [1080,1350,1920])for(const finish of ['solid','chrome','iridescent','rainbow']){
  const svg=shareCardSvg({...base,template,height,finish});assert.ok(svg.includes(template==='dayrings'?'8h12':'8h 12m'));assert.ok(svg.includes(template==='dayrings'?'>94<':'94 ms'));assert.ok(svg.includes('Morning run'));assert.ok(svg.includes('Lunch ride'));assert.ok(svg.includes('Strength'));for(const family of ['running','cycling','strength_training'])assert.ok(svg.includes('data-sport-icon="'+family+'"'));assert.ok(!/REST\. THEN GO|TRAIN\.|RECOVER\.|SHOW UP|WIND DOWN|MOVE \+ REST/.test(svg));assert.ok(!/NaN|Infinity/.test(svg));const png=await sharp(Buffer.from(svg)).png().toBuffer();const metadata=await sharp(png).metadata();assert.equal(metadata.height,height);assert.ok(metadata.hasAlpha);const corner=await sharp(png).extract({left:0,top:0,width:1,height:1}).raw().toBuffer();assert.equal(corner[3],0);
  if(height===1080&&finish==='solid')tiles.push({input:await sharp(png).resize(480,480).flatten({background:'#202631'}).png().toBuffer(),left:(i%3)*490,top:Math.floor(i/3)*490});
 }
 const empty=shareCardSvg({...base,template,dayHealth:{},dayMix:[],dayCards:[{title:'Recovery',stats:[]}],stats:[]});assert.ok(!/NaN|Infinity/.test(empty));assert.ok(empty.includes(template==='dayrings'?'Not recorded':'Unavailable'));assert.ok(empty.includes('REST DAY'));
}
await sharp({create:{width:1460,height:2440,channels:3,background:'#edf0f4'}}).composite(tiles).png().toFile(artifactDirectory+'/daily-templates.png');
console.log('Passed: fourteen daily templates, three sizes, four finishes, transparency, complete activity lists and missing-data/rest-day states.');

function moduleUrl(name){let source=ts.transpileModule(readFileSync('app/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {dailyShareHistory}=await import(moduleUrl('daily-share-history'));
const history=dailyShareHistory({sleep:{20260102:[28800],20260103:[99999]},hrv:{20260101:[90],20260102:[0]},extra:{coros:{sleepWindows:{20260102:{score:101}}}}},new Date(2026,0,2,12));
assert.equal(history.length,7);assert.equal(history[0].date,'2025-12-27');assert.equal(history[6].date,'2026-01-02');assert.equal(history[6].sleep,8);assert.equal(history[6].hrv,null);assert.equal(history[6].score,null);assert.equal(history[5].hrv,90);assert.equal(history[0].sleep,null);
console.log('Passed: local seven-day window, year boundary, missing values, invalid score/HRV and no future data.');

for(const template of ['daytrends','daycolumns','daybars','daypanels','dayledger','daybalance','dayribbon','daymatrix','daypulse']){const svg=shareCardSvg({...base,template,recoveryOnly:true});assert.ok(svg.includes('94 ms'));assert.ok(!/Morning run|Lunch ride|Strength|REST DAY|data-sport-icon/.test(svg));await sharp(Buffer.from(svg)).png().toFile(artifactDirectory+'/recovery-only-'+template+'.png');}
console.log('Passed: recovery-only exports exclude all activities and rest-day labels.');

for(const family of ['running','cycling','strength_training','swimming','walking','hiking','other'])for(const finish of ['solid','chrome']){
 const svg=shareCardSvg({...base,template:'routebadge',dayCards:undefined,dayHealth:undefined,sport:family,sportFamily:family,title:'Session',finish});
 assert.ok(svg.includes('data-sport-icon="'+family+'"'));assert.ok(!/NaN|Infinity/.test(svg));await sharp(Buffer.from(svg)).png().toBuffer();
}
console.log('Passed: individual activity sport icons, fallback, solid and chrome PNG rendering.');

for(const template of ['daytrends','daycolumns','daybars','daypanels','dayledger','daybalance','dayribbon','daymatrix','daypulse']){
 const svg=shareCardSvg({...base,template,recoveryOnly:true,showLabels:false});
 assert.ok(!/Morning run|Lunch ride|Strength|REST DAY|>SLEEP<|>SLEEP SCORE<|>OVERNIGHT HRV<|7d range|gaps = missing/.test(svg));assert.ok(svg.includes('8h 12m')&&svg.includes('86/100')&&svg.includes('94 ms'));
 if(template==='daycolumns')await sharp(Buffer.from(svg)).flatten({background:'#202631'}).png().toFile(artifactDirectory+'/minimal-health.png');
}
console.log('Passed: minimal health-only exports retain readings and units without workouts or metric captions.');
