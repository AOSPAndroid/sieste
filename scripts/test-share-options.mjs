import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';

const {shareCardSvg,shareFinishes}=await loadShareDesignModule();
const directory=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-share-options');
mkdirSync(directory,{recursive:true});
const stats=[
 {key:'distance',label:'Distance',value:'13.47',unit:'km'},
 {key:'duration',label:'Activity time',value:'1:02:18',unit:'h:mm:ss'},
 {key:'pace',label:'Average pace',value:'4:37',unit:'/km'},
 {key:'hr',label:'Average heart rate',value:'147',unit:'bpm'},
 {key:'ascent',label:'Elevation gain',value:'189',unit:'m'},
 {key:'calories',label:'Workout calories',value:'783',unit:'kcal'}
];
const rideStats=[{...stats[0],value:'42.68'},stats[1],{key:'speed',label:'Average speed',value:'28.8',unit:'km/h'},...stats.slice(3)];
const points=[{x:0,y:0},{x:.32,y:.19},{x:1,y:.31},{x:.75,y:1},{x:.2,y:.69},{x:0,y:0}];
const route={points,segments:[points],center:{x:.5,y:.5}};
const history=Array.from({length:7},(_,index)=>({date:`2026-10-0${index+1}`,sleep:index===3?null:7+index*.13,score:index===3?null:74+index*2,hrv:index===3?null:97+index*3}));
const dayHealth={sleep:28860,score:88,hrv:203,history};
const base={height:1080,transparent:true,showLabels:false,finish:'solid',ink:'white',accent:'#ffffff',title:'River loop',sport:'Running',sportFamily:'running',date:'',stats,route,brand:false,demo:false,dayHealth,recoveryOnly:true};
const activityBase={...base,recoveryOnly:false};
const samples=[
 ['scorecard',activityBase],
 ['tracescorecard',activityBase],
 ['daytrends',base],
 ['retrohero',activityBase],
 ['retrorecovery',base],
 ['approvedrun',{...activityBase,accent:'#ffdf00'}],
 ['approvedride',{...activityBase,accent:'#fff4d5',sport:'Cycling',sportFamily:'cycling',stats:rideStats}],
 ['approvedrecovery',{...base,accent:'#b7ddf2'}]
];
const decode=value=>value.replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function tree(svg){
 const root={tag:'document',attrs:{},children:[],start:0,end:svg.length},stack=[root],tokens=/<\/?([\w:-]+)\b[^>]*>/g;let match;
 while((match=tokens.exec(svg))){
  const raw=match[0];
  if(raw.startsWith('</')){const node=stack.pop();assert.equal(node.tag,match[1],'SVG tags remain balanced');node.end=tokens.lastIndex;node.inner=svg.slice(node.openEnd,match.index);continue;}
  const attrs=Object.fromEntries([...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,key,value])=>[key,decode(value)]));
  const node={tag:match[1],attrs,children:[],parent:stack.at(-1),start:match.index,openEnd:tokens.lastIndex,end:tokens.lastIndex,inner:''};
  node.parent.children.push(node);if(!raw.endsWith('/>'))stack.push(node);
 }
 assert.equal(stack.length,1,'SVG tags close');return root;
}
function all(node){return node.children.flatMap(child=>[child,...all(child)]);}
function within(node,predicate){for(let cursor=node;cursor;cursor=cursor.parent)if(predicate(cursor))return true;return false;}
function visible(node){return all(node).filter(item=>!within(item,parent=>parent.tag==='defs'||parent.tag==='title'||parent.attrs['aria-hidden']==='true'||parent.attrs['data-retro-shadow']==='true'||parent.attrs['data-approved-shadow']==='true'));}
function cue(node){return within(node,parent=>'data-share-label-key' in parent.attrs);}
function textReadings(node){
 return visible(node).flatMap(item=>item.tag==='text'?[decode(item.inner.replace(/<[^>]*>/g,''))]:item.attrs['data-cinematic-text']!==undefined?[item.attrs['data-cinematic-text']]:item.attrs['data-original-reading']!==undefined?[item.attrs['data-original-reading']]:[]);
}
function numberReadings(node){
 const readings=visible(node).filter(item=>!cue(item)).flatMap(item=>item.tag==='text'?[decode(item.inner.replace(/<[^>]*>/g,''))]:item.attrs['data-cinematic-text']!==undefined?[item.attrs['data-cinematic-text']]:item.attrs['data-original-reading']!==undefined?[item.attrs['data-original-reading']]:[]);
 return [...new Set(readings.filter(value=>/\d/.test(value)).map(value=>value.toUpperCase()))].sort();
}
function annotations(node){return visible(node).filter(item=>'data-share-label-key' in item.attrs&&item.attrs['data-share-label-mode']!=='icons');}
function icons(node){return visible(node).filter(item=>['data-health-icon','data-sport-icon','data-stat-icon','data-metric-icon'].some(attribute=>attribute in item.attrs));}
function paint(node,attribute){for(let cursor=node;cursor;cursor=cursor.parent)if(attribute in cursor.attrs)return cursor.attrs[attribute];return undefined;}
function safe(svg,context){
 assert.ok(!/<script|\son\w+=|(?:https?:|file:)\/\//i.test(svg.replace('http://www.w3.org/2000/svg','')),`${context}: export has no external or executable resources`);
 for(const item of all(tree(svg))){
  for(const [key,value] of Object.entries(item.attrs))if(key!=='href'&&key!=='xlink:href')assert.ok(!/NaN|Infinity|undefined/.test(value),`${context}: finite ${key}`);
 }
}
function rawNode(svg,node){return svg.slice(node.start,node.end);}
function marked(svg,attribute){return visible(tree(svg)).filter(node=>attribute in node.attrs).map(node=>rawNode(svg,node));}
function alphaPadding(data,info,context){
 for(let x=0;x<info.width;x++){assert.equal(data[x*4+3],0,`${context}: top alpha padding`);assert.equal(data[((info.height-1)*info.width+x)*4+3],0,`${context}: bottom alpha padding`);}
 for(let y=0;y<info.height;y++){assert.equal(data[y*info.width*4+3],0,`${context}: left alpha padding`);assert.equal(data[(y*info.width+info.width-1)*4+3],0,`${context}: right alpha padding`);}
}
function assertFinish(node,finish,context){
 const colours=shareFinishes.find(option=>option.key===finish).colors;
 const gradients=new Map(all(node).filter(item=>item.tag==='linearGradient').map(item=>[item.attrs.id,item.children.filter(child=>child.tag==='stop').map(child=>child.attrs['stop-color'])]));
 let count=0;
 for(const label of annotations(node))for(const shape of visible(label).concat(label).filter(item=>['text','path','circle','rect','line','ellipse','polygon','polyline'].includes(item.tag))){
  for(const attribute of ['fill','stroke']){
   const colour=paint(shape,attribute);if(!colour||colour==='none'||colour==='transparent')continue;
   const gradient=colour.match(/^url\(#([\w-]+)\)$/)?.[1];assert.ok(gradient,`${context}: visible ${attribute} on annotation ${shape.tag} receives a finish`);
   const stops=gradients.get(gradient);assert.ok(stops?.length,`${context}: finished annotation uses a self-contained gradient`);assert.ok(stops.every(stop=>colours.includes(stop)),`${context}: annotation uses selected ${finish} colours`);count++;
  }
 }
 assert.ok(count,`${context}: selected finish paints visible annotation geometry`);
}

let checks=0;
for(const [template,sample] of samples){
 const design={...sample,template},baseline=shareCardSvg(design);
 assert.equal(shareCardSvg({...design,textThickness:0}),baseline,`${template}: nominal writing preserves existing export exactly`);
 assert.equal(shareCardSvg({...design,textThickness:undefined}),baseline,`${template}: absent writing option preserves existing export exactly`);
 const expected=numberReadings(tree(shareCardSvg({...design,labelMode:'icons'})));assert.ok(expected.length,`${template}: fixture contains actual readings`);
 for(const labelMode of ['icons','short','full','none']){
  const context=`${template}/${labelMode}`,svg=shareCardSvg({...design,labelMode}),parsed=tree(svg);safe(svg,context);
  assert.deepEqual(numberReadings(parsed),expected,`${context}: actual visible readings and units stay unchanged across annotation choices`);
  const labels=annotations(parsed),pictures=icons(parsed);
  if(labelMode==='none'){
   assert.equal(labels.length,0,`${context}: no visible metric or sport text cues`);
   assert.equal(pictures.length,0,`${context}: no visible metric or sport icons`);
  }else if(labelMode==='icons'){
   assert.ok(pictures.length,`${context}: real pictogram geometry is present`);
   assert.equal(labels.length,0,`${context}: icons replace annotation text`);
   assert.ok(pictures.some(item=>visible(item).some(shape=>['path','circle','ellipse','image','rect'].includes(shape.tag))),`${context}: pictogram is visibly drawn`);
  }else{
   assert.ok(labels.length,`${context}: annotation text is present`);
   assert.equal(pictures.length,0,`${context}: text cues replace pictograms`);
   for(const label of labels){assert.equal(label.attrs['data-share-label-mode'],labelMode,`${context}: every cue uses the requested mode`);assert.ok(textReadings(label).length||label.tag==='text'&&label.inner.trim(),`${context}: annotation has visible letters rather than metadata alone`);}
  }
  assert.equal(shareCardSvg({...design,labelMode,showLabels:true}),shareCardSvg({...design,labelMode,showLabels:false}),`${context}: explicit option supersedes old checkbox`);
  await sharp(Buffer.from(svg)).resize(270).png().toBuffer();checks++;
 }
}
const short=tree(shareCardSvg({...base,template:'scorecard',labelMode:'short'})),full=tree(shareCardSvg({...base,template:'scorecard',labelMode:'full'}));
assert.ok(textReadings(short).some(value=>value.toUpperCase()==='HR'),'Heart rate has readable HR abbreviation');
assert.ok(textReadings(full).some(value=>value.toUpperCase()==='AVERAGE HEART RATE'),'Heart rate has readable full name');
assert.ok(!textReadings(short).some(value=>value.toUpperCase()==='AVERAGE HEART RATE'),'Short annotations omit full metric name');
for(const template of ['scorecard','retrohero','approvedrun']){
 const sample=samples.find(([key])=>key===template)[1];
 assert.ok(icons(tree(shareCardSvg({...sample,template,labelMode:'icons'}))).some(node=>node.attrs['data-sport-icon']==='running'),`${template}: activity cue displays actual running pictogram`);
 assert.ok(annotations(tree(shareCardSvg({...sample,template,labelMode:'short'}))).some(node=>node.attrs['data-share-label-key']==='running'),`${template}: activity cue supports short sport names`);
}
console.log(`Passed: ${checks} annotation cases across regular, route/stat, daily, retro and original artwork exports; exact readings and units retained.`);

for(const template of ['scorecard','tracescorecard','retrohero','approvedrun','approvedride','approvedrecovery']){
 const sample=samples.find(([key])=>key===template)[1],design={...sample,template,labelMode:'none'},defaultSvg=shareCardSvg(design);
 const measures=[];
 for(const textThickness of [-2,0,4,12]){
  const svg=shareCardSvg({...design,textThickness});safe(svg,`${template}/${textThickness}`);
  const {data,info}=await sharp(Buffer.from(svg)).resize(540).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let alpha=0;for(let index=3;index<data.length;index+=4)alpha+=data[index];measures.push(alpha/255);
  alphaPadding(data,info,`${template}/${textThickness}`);
  assert.deepEqual(numberReadings(tree(svg)),numberReadings(tree(defaultSvg)),`${template}: changing thickness preserves actual letters, measurements and units`);
  assert.deepEqual(marked(svg,'data-share-route'),marked(defaultSvg,'data-share-route'),`${template}: writing thickness preserves actual GPS paths and stroke widths`);
  assert.deepEqual(marked(svg,'data-approved-history-key'),marked(defaultSvg,'data-approved-history-key'),`${template}: writing thickness preserves source charts, gaps and dots`);
  if(textThickness!==0)await sharp(Buffer.from(svg)).resize(540).png().toFile(join(directory,`${template}-${textThickness<0?'thin':textThickness===12?'extra-bold':'bold'}.png`));
 }
 assert.ok(measures[0]<measures[1]-25,`${template}: thin writing actually reduces visible raster area (${measures.join(', ')})`);
 assert.ok(measures[2]>measures[1]+25,`${template}: bold writing actually increases visible raster area (${measures.join(', ')})`);
 assert.ok(measures[3]>measures[2]+25,`${template}: new maximum writing is visibly thicker than the former maximum (${measures.join(', ')})`);
 for(const [input,expected] of [[-999,-2],[999,12],[NaN,0],[Infinity,0],[-Infinity,0],[undefined,0]])assert.equal(shareCardSvg({...design,textThickness:input}),shareCardSvg({...design,textThickness:expected}),`${template}: thickness ${input} normalizes safely`);
}
console.log('Passed: extra-bold 12 increases rendered pixel area beyond former maximum 4 across native text, route/stat designs, outlined retro letters and all original PNG artwork; thickness clamps safely without changing charts or routes.');

for(const template of ['scorecard','retrohero','approvedrecovery'])for(const finish of shareFinishes.map(option=>option.key))for(const labelMode of ['icons','short','full','none']){
 const sample=samples.find(([key])=>key===template)[1],design={...sample,template,labelMode,finish,textThickness:12},svg=shareCardSvg(design);safe(svg,`${template}/${finish}/${labelMode}/12`);
 if(labelMode==='short'||labelMode==='full')assertFinish(tree(svg),finish,`${template}/${finish}/${labelMode}/12`);
 await sharp(Buffer.from(svg)).resize(270).png().toBuffer();checks++;
}
const exported=await sharp(Buffer.from(shareCardSvg({...base,template:'approvedrecovery',accent:'#b7ddf2',labelMode:'full',finish:'iridescent',textThickness:12,height:1920}))).resize(2160,3840).png().toBuffer();
const metadata=await sharp(exported).metadata();assert.equal(metadata.width,2160);assert.equal(metadata.height,3840);assert.ok(metadata.hasAlpha);
const fullSize=await sharp(exported).ensureAlpha().raw().toBuffer({resolveWithObject:true});alphaPadding(fullSize.data,fullSize.info,'extra-bold iridescent recovery at 2160px');
await sharp(exported).toFile(join(directory,'recovery-story-2160.png'));
console.log('Passed: all eight finishes support every annotation option at extra-bold 12; transparent 2160px story exports retain alpha padding and remain self-contained.');
