import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';

const {shareCardSvg,shareFinishes}=await loadShareDesignModule();
const templates=['refrail','refduet','refledger','refcompactroute','refsplitline','refcorner'];
const faces=['wide','tall','condensed','editorial','slab','hand'];
const directory=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-home-share');
mkdirSync(directory,{recursive:true});
const history=Array.from({length:7},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,sleep:i===3?null:7.5+i*.1,hrv:i===3?null:97+i,score:i===3?null:79+i}));
const families=['running','cycling','strength_training','swimming','walking','hiking'];
const workouts=families.map((sportFamily,i)=>({title:`Recorded ${sportFamily} ${i+1}`,sportFamily,stats:[
 {key:'duration',label:'Activity time',value:`${31+i}:17`,unit:'min:sec'},
 {key:'hr',label:'Average heart rate',value:String(118+i),unit:'bpm'},
 {key:'calories',label:'Workout calories',value:String(240+i),unit:'kcal'}
]}));
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',legibility:'none',finish:'solid',title:'Selected day',sport:'Other',sportFamily:'misc',date:'7 October 2026',stats:[{key:'distance',label:'Wrong aggregate',value:'987.65',unit:'km'}],route:{points:[{x:0,y:0},{x:1,y:1}],segments:[[{x:0,y:0},{x:1,y:1}]],center:{x:.5,y:.5}},laps:[{index:1,value:99,pace:99}],brand:true,demo:true,labelMode:'icons',dayHealth:{sleep:28860,hrv:104,score:85,history},dayCards:[{title:'Sleep & recovery',stats:[]},...workouts]};
const clean=svg=>assert.ok(!/NaN|Infinity|undefined|<script|\son\w+=/.test(svg),'Export contains only finite, escaped source data');
const readings=svg=>Object.fromEntries([...svg.matchAll(/data-stat-key="(sleep|hrv|score)" data-stat-value="([^"]*)" data-stat-unit="([^"]*)"/g)].map(([,key,value,unit])=>[key,{value,unit}]));
const actualRecovery={sleep:{value:'8h01',unit:''},hrv:{value:'104',unit:'ms'},score:{value:'85',unit:'/100'}};
async function raster(svg,height,width=360){
 clean(svg);
 const {data,info}=await sharp(Buffer.from(svg)).resize(width).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,width);assert.equal(info.height,Math.round(height*width/1080));assert.equal(info.channels,4);
 let visible=0,minX=info.width,minY=info.height,maxX=0,maxY=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const alpha=data[(y*info.width+x)*4+3];
  if(x===0||y===0||x===info.width-1||y===info.height-1)assert.equal(alpha,0,'PNG has transparent padding along every canvas edge');
  if(alpha>96){visible++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 }
 assert.ok(visible>300,'Actual PNG contains visible recovery and activity readings');
 assert.ok(minX>2&&minY>2&&maxX<info.width-3&&maxY<info.height-3,'Artwork and footer stay bounded');
 return {visible,data,info};
}

const tiles=[];
for(const [index,template] of templates.entries()){
 for(const height of [1080,1350,1920])for(const recoveryOnly of [true,false]){
  const svg=shareCardSvg({...base,template,height,recoveryOnly,fontFace:'editorial'});
  assert.deepEqual(readings(svg),actualRecovery,`${template}: all three real current health readings remain present`);
  assert.ok(!svg.includes('987.65')&&!svg.includes('data-share-route=')&&!svg.includes('data-share-lap='),'Health layouts never substitute aggregate distance, GPS or watch laps for recovery');
  assert.ok(!/<text\b|font-family=/.test(svg),'Selected typography covers every visible label, reading and footer');
  assert.match(svg,/data-reference-font="DM Serif Display"/);
  if(recoveryOnly){assert.ok(!/data-share-day-activity=|data-sport-icon=|Recorded running/.test(svg),'Health-only exports exclude every workout');}
  else{
   assert.equal((svg.match(/data-share-day-activity=/g)??[]).length,workouts.length,'All selected-day workouts are exported');
   workouts.forEach(workout=>{assert.ok(svg.includes(`data-sport-icon="${workout.sportFamily}"`));assert.ok(svg.includes(`data-share-activity-title="${workout.title}"`));workout.stats.forEach(stat=>assert.ok(svg.includes(`data-stat-key="${stat.key}" data-stat-value="${stat.value}" data-stat-unit="${stat.unit}"`),'Actual workout reading is preserved'));});
  }
  await raster(svg,height);
 }
 for(const labelMode of ['icons','short','full','none']){
  const svg=shareCardSvg({...base,template,recoveryOnly:true,labelMode,fontFace:'slab'});
  assert.deepEqual(readings(svg),actualRecovery,'Caption settings never replace health readings');
  assert.ok(!/<text\b/.test(svg),'All annotation modes use selected font outlines');
  if(labelMode==='none')assert.ok(!/data-share-caption=|data-share-cue-key=/.test(svg),'Numbers-only removes metric cues');
  else if(labelMode==='icons')for(const key of ['sleep','hrv','score'])assert.ok(svg.includes(`data-health-icon="${key}"`),'Icons mode explains all three health metrics');
  else for(const key of ['sleep','hrv','score'])assert.ok(svg.includes(`data-share-caption="${key}"`),'Written modes explain all three health metrics');
  await raster(svg,1080,270);
 }
 for(const [faceIndex,fontFace] of faces.entries()){
  const finish=shareFinishes[faceIndex].key,svg=shareCardSvg({...base,template,fontFace,finish,textThickness:6});
  assert.deepEqual(readings(svg),actualRecovery);assert.ok(!/<text\b/.test(svg));assert.match(svg,/fill="url\(#metal(?:Soft)?\)"/);assert.match(svg,/data-text-thickness="6"/);
  await raster(svg,1080,270);
 }
 for(const {key:finish} of shareFinishes){
  const svg=shareCardSvg({...base,template,finish,fontFace:'condensed',textThickness:12,recoveryOnly:true});
  assert.deepEqual(readings(svg),actualRecovery);assert.match(svg,/stroke="url\(#(?:finishStroke|iconFinish)\)"/);await raster(svg,1080,270);
 }
 const unavailable=shareCardSvg({...base,template,recoveryOnly:true,dayHealth:{history}});
 assert.deepEqual(readings(unavailable),{sleep:{value:'—',unit:''},hrv:{value:'—',unit:'ms'},score:{value:'—',unit:'/100'}},'History never fills missing current readings');
 const invalid=shareCardSvg({...base,template,recoveryOnly:true,dayHealth:{sleep:NaN,hrv:0,score:101,history:[]}});
 assert.deepEqual(readings(invalid),readings(unavailable));clean(invalid);
 const zero=shareCardSvg({...base,template,recoveryOnly:true,dayHealth:{sleep:0,hrv:104,score:0,history:[]}});
 assert.deepEqual(readings(zero),{sleep:{value:'0h00',unit:''},hrv:{value:'104',unit:'ms'},score:{value:'0',unit:'/100'}},'Recorded zero sleep/score remain valid readings');
 const withoutHealth=shareCardSvg({...base,template,dayHealth:{},recoveryOnly:false,fontFace:'wide'});
 assert.equal((withoutHealth.match(/data-share-day-activity=/g)??[]).length,workouts.length,'Missing health never hides synced workouts');await raster(withoutHealth,1080);
 for(const height of [1080,1350,1920]){
  const many=shareCardSvg({...base,template,height,fontFace:'condensed',dayCards:[{title:'Recovery',stats:[]},...Array.from({length:30},(_,i)=>({...workouts[i%workouts.length],title:`Workout ${i+1}`}))]});
  assert.equal((many.match(/data-share-day-activity=/g)??[]).length,30,'Dense days scale all workouts instead of truncating');await raster(many,height);
 }
 const tile=await sharp(Buffer.from(shareCardSvg({...base,template,fontFace:'editorial',recoveryOnly:true,brand:false,demo:false,date:''}))).resize(440).flatten({background:'#202631'}).png().toBuffer();
 tiles.push({input:tile,left:index%3*450,top:Math.floor(index/3)*450});
}

for(const template of ['refcompactroute','refcorner'])for(const key of ['sleep','hrv','score']){
 const svg=shareCardSvg({...base,template,recoveryOnly:true}),chart=svg.match(new RegExp(`<g data-share-history="${key}"[^>]*>([\\s\\S]*?)<\\/g>`))?.[1];
 assert.ok(chart,'Real recorded history is drawn');assert.equal((chart.match(/data-history-date=/g)??[]).length,6,'Unknown middle night has no invented point');assert.equal((chart.match(/\bM[\d.-]/g)??[]).length,2,'Line breaks across missing nights');assert.ok(!chart.includes('2026-10-04'));
 const sourceValues=history.filter(row=>row[key]!==null).map(row=>row[key]);for(const value of sourceValues)assert.ok(chart.includes(`data-history-value="${value}"`),'History uses recorded hours/HRV/score, preserving source units');
}
for(const key of ['sleep','hrv','score']){
 const svg=shareCardSvg({...base,template:'refsplitline',recoveryOnly:true});
 const chart=svg.match(new RegExp(`<g data-share-history="${key}" data-history-kind="bars"[^>]*>([\\s\\S]*?)<\\/g><\\/g>`))?.[1];
 assert.ok(chart,'Each recovery metric has a recorded seven-night bar strip');assert.equal((chart.match(/data-history-slot=/g)??[]).length,7,'Bars retain all seven date slots');assert.equal((chart.match(/<rect\b/g)??[]).length,6,'Missing middle night has no bar');assert.ok(chart.includes('data-history-slot="3" data-history-date="2026-10-04" data-history-value="missing"'));
}
const escaped=shareCardSvg({...base,template:'refrail',fontFace:'wide',dayCards:[{title:'Run <script> & "ride"',sportFamily:'running',stats:workouts[0].stats}]});assert.ok(escaped.includes('data-share-activity-title="Run &lt;script&gt; &amp; &quot;ride&quot;"')&&!escaped.includes('<script>'));
const otherSport=shareCardSvg({...base,template:'refrail',dayCards:[{title:'Unknown sport',sportFamily:'other',stats:workouts[0].stats}]});assert.ok(otherSport.includes('data-sport-icon="other"'),'Unlisted sports receive a portable generic sport cue');
await sharp({create:{width:1340,height:890,channels:3,background:'#edf0f4'}}).composite(tiles).png().toFile(join(directory,'home-share-designs.png'));
console.log('Homepage share layouts passed: six common designs, exact health and every workout, all fonts/finishes/caption modes, missing-history gaps, transparent PNGs and bounded dense-day layouts.');
