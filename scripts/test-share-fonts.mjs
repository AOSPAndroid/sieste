import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {loadShareDesignModule,readShareAsset} from './share-design-test-module.mjs';

const cinematicFaces={oswald:'reference-oswald',action:'reference-action',poster:'reference-poster',widescreen:'reference-widescreen',cinema:'reference-cinema',modern:'reference-modern'};
const faces={wide:'reference-wide',tall:'display-bold',condensed:'display-tall',editorial:'display-serif',slab:'display-slab',hand:'reference-hand',...cinematicFaces};
const cinematicNames={oswald:'Oswald SemiBold',action:'Barlow Condensed SemiBold Italic',poster:'Teko SemiBold',widescreen:'Syncopate Bold',cinema:'Bodoni Moda SemiBold',modern:'Space Grotesk Bold'};
const stats=[{key:'distance',label:'Distance',value:'10.01',unit:'km'},{key:'duration',label:'Activity time',value:'51:00',unit:'min:sec'},{key:'pace',label:'Average pace',value:'5:06',unit:'/km'},{key:'hr',label:'Average heart rate',value:'139',unit:'bpm'}];
const history=Array.from({length:7},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,sleep:i===3?null:7+i*.1,score:82+i,hrv:95+i}));
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',legibility:'none',finish:'solid',title:'Paris Tempo',sport:'Running',sportFamily:'running',date:'7 October 2026',stats,route:null,brand:true,demo:false,labelMode:'short',dayHealth:{sleep:28860,score:85,hrv:104,history},dayCards:[{title:'Recovery',stats:[]},{title:'Paris Tempo',sportFamily:'running',stats:stats.slice(0,3)}]};
const alphaArea=async svg=>{
 const {data,info}=await sharp(Buffer.from(svg)).resize({width:360}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,360);assert.equal(info.channels,4);assert.equal(data[3],0);assert.equal(data.at(-1),0);
 let area=0;for(let i=3;i<data.length;i+=4)if(data[i]>127)area++;
 assert.ok(area>150,'Export contains visible readings on a transparent canvas');return area;
};

for(const [fontFace,asset] of Object.entries(faces)){
 const requests=[];
 const module=await loadShareDesignModule({preload:false,reader:async path=>{requests.push(path);return readShareAsset(path);}});
 const svg=await module.renderShareCardSvg({...base,dayHealth:undefined,dayCards:undefined,template:'refrail',fontFace});
 assert.equal(requests.length,1,fontFace+': selecting a font fetches just one face');
 assert.match(requests[0],new RegExp('/fonts/'+asset+'\\.json\\?v=[\\da-f]+$'));
 assert.ok(svg.includes(`data-reference-face="${fontFace}"`),fontFace+': the selected outlines reach the hero and support readings');
 assert.ok(svg.includes('data-stat-value="10.01"')&&svg.includes('data-stat-value="5:06"'),'Font choice leaves exact source readings unchanged');
 assert.ok(!/<text\b|font-family=|href=|NaN|Infinity|undefined/.test(svg),fontFace+': known labels, titles, dates and numbers are self-contained paths');
 const scales=[...svg.matchAll(/scale\(([\d.]+) (-[\d.]+)\)/g)].map(match=>Number(match[1])/Math.abs(Number(match[2])));
 assert.ok(scales.length>3&&scales.every(ratio=>Math.abs(ratio-1)<.002),fontFace+': glyphs keep natural proportions without horizontal squeezing');
 const areas=[];
 for(const textThickness of [-2,0,12]){
  const rendered=await module.renderShareCardSvg({...base,dayHealth:undefined,dayCards:undefined,template:'refrail',fontFace,textThickness});
  areas.push(await alphaArea(rendered));
 }
 assert.ok(areas[0]<areas[1]&&areas[1]<areas[2],fontFace+': actual exported lettering obeys slim/original/bold settings');
 const finished=await module.renderShareCardSvg({...base,dayHealth:undefined,dayCards:undefined,template:'refrail',fontFace,finish:'chrome',textThickness:5,labelMode:'icons'});
 assert.match(finished,/fill="url\(#metal(?:Soft)?\)"/);assert.match(finished,/data-text-thickness="5"/);
 assert.ok(finished.includes('data-sport-icon="running"')&&finished.includes('data-share-cue-key="duration"'),'Typography retains metric and sport cues');
 await alphaArea(finished);
 const daily=await module.renderShareCardSvg({...base,template:'dayline',fontFace,labelMode:'icons',finish:'iridescent'});
 assert.ok(!/<text\b/.test(daily),fontFace+': daily recovery, activity readings and custom sport title use the selected outlines');
 assert.ok(/data-reference-text="(?:01  )?Paris Tempo"/.test(daily)&&daily.includes('data-sport-icon="running"'),'Authored workout title and sport icon both survive');
 assert.ok(daily.includes('data-reference-text="8h 01m"')&&daily.includes('data-reference-text="104 ms"'),'Recovery shares retain selected-day health readings');
 await alphaArea(daily);
 assert.equal(requests.length,1,fontFace+': colours, finishes, weight and daily layouts reuse the same face');
}

const module=await loadShareDesignModule();
const layouts=['refrail','refduet','refledger','refcompactroute','refsplitline','refcorner'];
const workouts=[
 {title:'Paris Tempo',sportFamily:'running',stats:stats.slice(0,3)},
 {title:'Road ride',sportFamily:'cycling',stats:[{key:'distance',label:'Distance',value:'32.58',unit:'km'},{key:'duration',label:'Activity time',value:'1:20:00',unit:'h:mm:ss'},{key:'speed',label:'Average speed',value:'24.4',unit:'km/h'}]},
 {title:'Strength session',sportFamily:'strength_training',stats:[{key:'duration',label:'Activity time',value:'39:00',unit:'min:sec'},{key:'hr',label:'Average heart rate',value:'98',unit:'bpm'},{key:'calories',label:'Calories',value:'194',unit:'kcal'}]}
];
const fullDay={...base,labelMode:'icons',dayCards:[{title:'Recovery',stats:[]},...workouts]};
const variants={activity:{...base,dayHealth:undefined,dayCards:undefined,labelMode:'icons'},health:{...fullDay,recoveryOnly:true},day:{...fullDay,recoveryOnly:false}};
const artifactDirectory=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-cinematic-fonts');
mkdirSync(artifactDirectory,{recursive:true});
const sheets={activity:[],health:[],day:[]};
const xml=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const exactStat=(svg,stat,message)=>assert.ok(svg.includes(`data-stat-key="${stat.key}" data-stat-value="${stat.value}" data-stat-unit="${stat.unit}"`),message);
async function boundedPng(svg,height,width=270){
 const png=await sharp(Buffer.from(svg)).resize({width}).png().toBuffer();
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,width);assert.equal(info.height,Math.round(height*width/1080));assert.equal(info.channels,4);
 let visible=0,minX=info.width,minY=info.height,maxX=-1,maxY=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const alpha=data[(y*info.width+x)*4+3];
  if(x===0||y===0||x===info.width-1||y===info.height-1)assert.equal(alpha,0,'Export retains transparent padding on every edge');
  if(alpha>96){visible++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 }
 assert.ok(visible>150,'Actual PNG includes visible source readings');
 assert.ok(minX>1&&minY>1&&maxX<info.width-2&&maxY<info.height-2,'Lettering, icons and footer stay inside the canvas');
 return png;
}
const fingerprints=new Set();
for(const [index,fontFace] of Object.keys(cinematicFaces).entries()){
 for(const [variant,design] of Object.entries(variants)){
  for(const template of layouts){
   const svg=module.shareCardSvg({...design,template,fontFace});
   assert.ok(!/<text\b|font-family=|href=|NaN|Infinity|undefined/.test(svg),`${fontFace}/${variant}/${template}: all type and units use self-contained paths`);
   assert.ok(svg.includes(`data-reference-face="${fontFace}"`),'Chosen cinematic face reaches the layout');
   if(variant==='activity')[stats[0],stats[2],stats[1],stats[3]].slice(0,template==='refduet'?2:template==='refrail'?4:3).forEach(stat=>exactStat(svg,stat,'Activity readings retain the exact recorded values'));
   else{
    exactStat(svg,{key:'sleep',value:'8h01',unit:''},'Selected-day sleep is preserved');
    exactStat(svg,{key:'hrv',value:'104',unit:'ms'},'Selected-day HRV is preserved');
    exactStat(svg,{key:'score',value:'85',unit:'/100'},'Selected-day score is preserved');
    assert.equal((svg.match(/data-share-day-activity=/g)??[]).length,variant==='day'?workouts.length:0,'Health-only excludes workouts; full-day includes every recording');
    if(variant==='day')for(const workout of workouts){
     assert.ok(svg.includes(`data-sport-icon="${workout.sportFamily}"`),'Each workout retains its sport cue');
     workout.stats.forEach(stat=>exactStat(svg,stat,'Full-day typography leaves workout values intact'));
    }
   }
   await boundedPng(svg,1080);
  }
  const exported=module.shareCardSvg({...design,template:'refrail',fontFace});
  await boundedPng(exported,1080,2160);
  const tile=await sharp(Buffer.from(exported)).resize(420).flatten({background:'#202631'}).png().toBuffer();
  sheets[variant].push({input:tile,left:index%3*430,top:Math.floor(index/3)*465+39});
  const heading=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="32"><text x="12" y="23" fill="#17212f" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700">${xml(cinematicNames[fontFace])}</text></svg>`);
  sheets[variant].push({input:heading,left:index%3*430,top:Math.floor(index/3)*465+4});
  if(variant==='activity')fingerprints.add(exported.match(/data-reference-face="[^\"]*"[^>]*data-reference-text="10.01[^\"]*"[^>]*>[\s\S]*?<\/g>/)?.[0]);
 }
 for(const height of [1350,1920])await boundedPng(module.shareCardSvg({...fullDay,template:'refrail',fontFace,height,finish:'chrome',textThickness:6}),height,540);
 for(const {key:finish} of module.shareFinishes){
  const svg=module.shareCardSvg({...fullDay,template:'refrail',fontFace,finish,textThickness:6});
  assert.match(svg,/data-text-thickness="6"/);assert.match(svg,/fill="url\(#metal(?:Soft)?\)"/,'Selected finish reaches the cinematic outlines');
  await boundedPng(svg,1080);
 }
 const labelled=module.shareCardSvg({...base,dayHealth:undefined,dayCards:undefined,template:'refcard',fontFace,title:'Paris Tempo',date:'7 October 2026',brand:true});
 assert.ok(labelled.includes('data-reference-text="Paris Tempo"')&&labelled.includes('data-reference-text="7 October 2026"'),'Custom titles and dates use selected cinematic outlines');
 assert.ok(!/<text\b|font-family=/.test(labelled),'Known title and unit glyphs never fall back to installed fonts');
 await boundedPng(labelled,1080);
}
assert.equal(fingerprints.size,Object.keys(cinematicFaces).length,'Every new choice has distinct headline outlines');
for(const [variant,tiles] of Object.entries(sheets))await sharp({create:{width:1280,height:924,channels:3,background:'#edf0f4'}}).composite(tiles).png().toFile(join(artifactDirectory,`cinematic-fonts-${variant}.png`));
for(const template of ['dayline','daycolumns','dayrings','daystack','dayposter'])for(const labelMode of ['none','icons','short','full']){
 const svg=module.shareCardSvg({...base,template,fontFace:'editorial',labelMode});
 assert.ok(!/<text\b/.test(svg),template+'/'+labelMode+': no native label branch escapes selected typography');
 assert.ok(!/NaN|Infinity|undefined/.test(svg));
 if(labelMode==='icons')assert.ok(svg.includes('data-sport-icon="running"'));
}
for(const showLabels of [undefined,true,false]){
 const svg=module.shareCardSvg({...base,template:'dayline',fontFace:'editorial',labelMode:undefined,showLabels});
 assert.ok(!/<text\b/.test(svg),'Legacy label settings also use the selected outlined type');
 assert.ok(svg.includes('data-reference-text="8h 01m"')&&svg.includes('data-reference-text="104 ms"'),'Legacy settings preserve the actual recovery readings');
}
const standard=module.shareCardSvg({...base,template:'refhero',dayCards:undefined});
assert.match(standard,/data-reference-face="wide"/,'No selection keeps original headline type');
assert.ok(/<text\b/.test(standard),'Default metadata keeps its existing native type pairing');
const legacy=module.shareCardSvg({...base,template:'scorecard',fontFace:'editorial',dayCards:undefined});
assert.ok(!legacy.includes('data-reference-face="editorial"'),'Original artwork/cinematic layouts keep their own designed typography');
const missing=module.shareCardSvg({...base,template:'refcard',fontFace:'editorial',title:'東京 <script>'});
assert.ok(missing.includes('&lt;script&gt;')&&!missing.includes('<script>'),'Unsupported scripts remain visible through escaped fallback');
console.log('Share fonts passed: six cinematic and six legacy on-demand faces, every minimal activity/health/full-day layout, exact readings, natural proportions, transparent 2160 PNGs, bounded canvases, captions, finishes and thickness controls.');
console.log('Cinematic comparison sheets: '+artifactDirectory);
