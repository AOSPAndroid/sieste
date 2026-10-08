import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';

const {shareCardSvg}=await loadShareDesignModule();
const templates=['retrohero','retroride','retroswoop','retrostack','retrolaps','retroseal','retrorecovery','retrotriptych'];
const recoveryTemplates=new Set(['retrorecovery','retrotriptych']);
const artifactDirectory=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-retro-share');
mkdirSync(artifactDirectory,{recursive:true});

const stats=[
 {key:'distance',label:'Distance',value:'13.47',unit:'km'},
 {key:'pace',label:'Average pace',value:'4:37',unit:'/km'},
 {key:'duration',label:'Activity time',value:'1:02:18',unit:'h:mm:ss'},
 {key:'ascent',label:'Elevation gain',value:'189',unit:'m'},
 {key:'calories',label:'Workout calories',value:'783',unit:'kcal'},
 {key:'hr',label:'Average heart rate',value:'147',unit:'bpm'}
];
const points=[{x:0,y:0},{x:.3,y:.15},{x:.8,y:.1},{x:1,y:.65},{x:.65,y:1},{x:.15,y:.8},{x:0,y:0}];
const route={points,segments:[points.slice(0,4),points.slice(4)],center:{x:.5,y:.5}};
const base={height:1080,transparent:true,showLabels:true,finish:'solid',ink:'white',accent:'#f4d35e',title:"L'ÉTÉ À PARIS",sport:'Running',sportFamily:'running',weekday:'Thursday',date:'8 October 2026',stats,route:null,brand:false,demo:false};
const history=[
 {date:'2026-10-02',sleep:7.2,score:77,hrv:104},
 {date:'2026-10-03',sleep:8.1,score:91,hrv:120},
 {date:'2026-10-04',sleep:null,score:null,hrv:null},
 {date:'2026-10-05',sleep:6.9,score:73,hrv:156},
 {date:'2026-10-06',sleep:7.5,score:84,hrv:164},
 {date:'2026-10-07',sleep:null,score:null,hrv:null},
 {date:'2026-10-08',sleep:8.2,score:88,hrv:203}
];
const dayHealth={sleep:29520,score:88,hrv:203,hrvRange:[104,203],history};
const dayCards=[
 {title:'Sleep & recovery',stats:[{key:'sleep',label:'Sleep',value:'8h 12m',unit:''},{key:'hrv',label:'Overnight HRV',value:'203',unit:'ms'}]},
 {title:'Morning run',sportFamily:'running',stats:stats.slice(0,3)},
 {title:'Lunch ride',sportFamily:'cycling',stats:[{key:'distance',label:'Distance',value:'42.68',unit:'km'},{key:'speed',label:'Average speed',value:'28.8',unit:'km/h'}]},
 {title:'Evening strength',sportFamily:'strength_training',stats:[{key:'duration',label:'Activity time',value:'37:24',unit:'min:sec'},{key:'calories',label:'Workout calories',value:'281',unit:'kcal'}]}
];

// These tests inspect semantic SVG markers and inherited paint, not layout coordinates.
const unescapeXml=value=>value.replace(/&(amp|lt|gt|quot|apos);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[entity]);
function svgTree(svg){
 const root={tag:'root',attrs:{},children:[],parent:null,text:''},stack=[root];
 for(const token of svg.match(/<[^>]*>|[^<]+/g)??[]){
  if(token.startsWith('</')){assert.ok(stack.length>1,'SVG closing tag has an opening tag');stack.pop();continue;}
  if(token.startsWith('<?')||token.startsWith('<!'))continue;
  if(token.startsWith('<')){
   const tag=token.match(/^<([\w:-]+)/)?.[1];assert.ok(tag,'SVG has valid element names');
   const attrs=Object.fromEntries([...token.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,key,value])=>[key,unescapeXml(value)]));
   const node={tag,attrs,children:[],parent:stack.at(-1),text:''};node.parent.children.push(node);
   if(!token.endsWith('/>'))stack.push(node);
  }else stack.at(-1).text+=unescapeXml(token);
 }
 assert.equal(stack.length,1,'SVG tags are balanced');return root;
}
function descendants(node){return [node,...node.children.flatMap(descendants)];}
function inside(node,attribute){for(let current=node;current;current=current.parent)if(attribute in current.attrs)return true;return false;}
function visibleNodes(node){return descendants(node).filter(child=>!inside(child,'data-retro-shadow'));}
function marked(node,attribute,value){return visibleNodes(node).filter(child=>attribute in child.attrs&&(value===undefined||child.attrs[attribute]===value));}
function reading(node){
 return visibleNodes(node).flatMap(child=>child.attrs['data-cinematic-text']!==undefined?[child.attrs['data-cinematic-text']]:child.tag==='text'?[child.text]:[]).join(' ').replace(/\s+/g,' ').trim();
}
function compact(stat){return stat.value+(['min:sec','h:mm:ss'].includes(stat.unit)?'':stat.unit==='/km'?'/km':stat.unit?' '+stat.unit:'');}
function assertStat(tree,stat,context){
 const groups=marked(tree,'data-share-stat-key',stat.key);assert.ok(groups.length,`${context}: recorded ${stat.key} has a semantic group`);
 const value=groups.map(reading).join(' ').toUpperCase();
 assert.ok(value.includes(compact(stat).toUpperCase()),`${context}: ${stat.key} preserves ${compact(stat)}; got ${value}`);
}
function assertHealth(tree,key,expected,context){
 const groups=marked(tree,'data-retro-health-key',key);assert.ok(groups.length,`${context}: ${key} has a semantic reading`);
 const value=groups.map(reading).join(' ');assert.ok(value.toUpperCase().includes(expected.toUpperCase()),`${context}: ${key} preserves ${expected}; got ${value}`);return groups;
}
function assertSafe(svg,context){assert.ok(!/NaN|Infinity|undefined|<script(?:\s|>)/i.test(svg),`${context}: SVG has no invalid numeric values or injected markup`);}
function assertAlphaPadding(raw,width,height,context){
 let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(raw[(y*width+x)*4+3]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 assert.ok(maxX>=minX&&maxY>=minY,`${context}: export contains visible artwork`);
 const padding=16; // Eight logical pixels remain clear on every side at 2x export.
 assert.ok(minX>=padding&&minY>=padding&&maxX<width-padding&&maxY<height-padding,`${context}: transparent padding surrounds the full artwork (${minX},${minY})–(${maxX},${maxY})`);
}
function inherited(node,key,fallback){for(let current=node;current;current=current.parent)if(key in current.attrs)return current.attrs[key];return fallback;}
function shadowPaints(tree){
 const groups=descendants(tree).filter(node=>'data-retro-shadow' in node.attrs);
 assert.ok(groups.length,'Retro lettering retains a distinct extrusion/shadow');
 const paints=groups.flatMap(group=>descendants(group).flatMap(node=>['fill','stroke'].flatMap(key=>node.attrs[key]&&!['none','transparent'].includes(node.attrs[key])?[`${key}:${node.attrs[key]}`]:[])));
 assert.ok(paints.length,'Retro shadows have visible paint');assert.ok(paints.every(paint=>!paint.includes('url(')),'Retro shadows retain their solid paint');return paints;
}
function assertFinished(tree,context){
 const shapes=new Set(['text','path','circle','rect','line','polyline','polygon','ellipse']);let painted=0;
 for(const node of visibleNodes(tree)){
  if(!shapes.has(node.tag)||node.attrs.width==='1080')continue;
  let inDefinitions=false;for(let current=node;current;current=current.parent)if(current.tag==='defs')inDefinitions=true;if(inDefinitions)continue;
  const fill=inherited(node,'fill','black'),stroke=inherited(node,'stroke','none');
  for(const [kind,paint] of [['fill',fill],['stroke',stroke]])if(!['none','transparent'].includes(paint)){
   assert.match(paint,/^url\(#[\w-]+\)$/,`${context}: foreground ${node.tag} ${kind} uses the selected finish`);painted++;
  }
 }
 assert.ok(painted,`${context}: selected finish paints visible foreground`);
 for(const icon of marked(tree,'data-sport-icon'))assert.match(inherited(icon,'stroke','none'),/^url\(#[\w-]+\)$/,`${context}: sport icon receives the selected finish`);
}
function designFor(template,height=1080){return {...base,template,height,...(recoveryTemplates.has(template)?{title:'Today',dayHealth,dayCards,recoveryOnly:false}:{})};}

const faces=JSON.parse(readFileSync(new URL('../app/share-display-glyphs.json',import.meta.url),'utf8'));
assert.ok(faces.retro,'Retro exports include their own outline glyphs');assert.ok(Number.isFinite(faces.retro.units)&&faces.retro.units>0);
for(const [character,glyph] of Object.entries(faces.retro.glyphs)){
 assert.equal(glyph.length,6,`Retro glyph ${character} has complete metrics`);assert.ok(glyph.slice(0,5).every(Number.isFinite));assert.ok(glyph[0]>0);assert.equal(typeof glyph[5],'string');
}
for(const character of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÀÉÈÊÔÙÇ')assert.ok(faces.retro.glyphs[character],`Retro face includes ${character}`);

for(const template of templates)for(const height of [1080,1350,1920]){
 const context=`${template}/${height}`,design=designFor(template,height),svg=shareCardSvg(design),tree=svgTree(svg);assertSafe(svg,context);
 const canvas=tree.children.find(node=>node.tag==='svg');assert.equal(Number(canvas.attrs.width),1080);assert.equal(Number(canvas.attrs.height),height);assert.equal(canvas.attrs.viewBox,`0 0 1080 ${height}`);
 assert.ok(marked(tree,'data-cinematic-face','retro').length,`${context}: main lettering uses self-contained retro vectors`);shadowPaints(tree);
 if(recoveryTemplates.has(template)){
  assertHealth(tree,'sleep','8h 12m',context);assertHealth(tree,'score','88',context);assertHealth(tree,'hrv','203 ms',context);
 }else for(const stat of stats)assertStat(tree,stat,context);
 const png=await sharp(Buffer.from(svg)).resize(2160,height*2).png().toBuffer(),metadata=await sharp(png).metadata();
 assert.equal(metadata.width,2160,`${context}: full-resolution export width`);assert.equal(metadata.height,height*2,`${context}: export keeps its aspect ratio`);assert.ok(metadata.hasAlpha,`${context}: export has an alpha channel`);
 assertAlphaPadding(await sharp(png).ensureAlpha().raw().toBuffer(),metadata.width,metadata.height,context);
 if(height===1080)await sharp(png).toFile(join(artifactDirectory,`${template}-2160.png`));
 const opaque=await sharp(Buffer.from(shareCardSvg({...design,transparent:false}))).extract({left:0,top:0,width:1,height:1}).ensureAlpha().raw().toBuffer();
 assert.equal(opaque[3],255,`${context}: opaque exports paint their background`);
}
console.log('Passed: eight retro layouts, three shapes, real readings, vector glyphs, full 2160px PNG exports and transparent padding.');

for(const template of templates){
 const design=designFor(template),solidTree=svgTree(shareCardSvg(design)),expectedShadows=shadowPaints(solidTree);
 for(const finish of ['chrome','rainbow','iridescent']){
  const context=`${template}/${finish}`,svg=shareCardSvg({...design,finish}),tree=svgTree(svg);assertSafe(svg,context);assertFinished(tree,context);
  assert.deepEqual(shadowPaints(tree),expectedShadows,`${context}: selected finish preserves the extrusion paint`);
  await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
 }
}
console.log('Passed: chrome, rainbow and iridescent cover text, icons and charts while preserving retro shadows.');

for(const template of recoveryTemplates){
 const context=`${template}/day`,tree=svgTree(shareCardSvg({...designFor(template),recoveryOnly:false}));
 const workouts=marked(tree,'data-retro-workout');assert.equal(workouts.length,3,`${context}: each recorded sport has a workout row`);
 for(const card of dayCards.filter(card=>card.sportFamily)){
  const rows=workouts.filter(group=>reading(group).toUpperCase().includes(card.title.toUpperCase()));assert.equal(rows.length,1,`${context}: ${card.title} appears once`);
  for(const stat of card.stats)assertStat(rows[0],stat,`${context}/${card.title}`);
  assert.ok(marked(rows[0],'data-sport-icon',card.sportFamily).length,`${context}: ${card.title} uses its actual sport`);
 }
 const recoveryTree=svgTree(shareCardSvg({...designFor(template),recoveryOnly:true}));
 assert.equal(marked(recoveryTree,'data-retro-workout').length,0,`${template}: recovery-only export has no workout rows`);assert.equal(marked(recoveryTree,'data-sport-icon').length,0);
 for(const card of dayCards.filter(card=>card.sportFamily))assert.ok(!reading(recoveryTree).toUpperCase().includes(card.title.toUpperCase()),`${template}: recovery-only excludes ${card.title}`);
 assertHealth(recoveryTree,'hrv','203 ms',template);

 for(const key of ['sleep','score','hrv']){
  const charts=marked(recoveryTree,'data-retro-history-key',key);assert.ok(charts.length,`${template}: ${key} history is inspectable`);
  const samples=charts.flatMap(chart=>marked(chart,'data-history-value')),expected=history.map((row,index)=>({...row,index})).filter(row=>row[key]!==null);
  assert.equal(samples.length,expected.length,`${template}: ${key} gaps remain absent`);
  for(const row of expected){
   const sample=samples.find(node=>node.attrs['data-history-date']===row.date);assert.ok(sample,`${template}: ${key} keeps ${row.date}`);
   assert.equal(Number(sample.attrs['data-history-value']),row[key],`${template}: ${key} preserves raw history values`);
   assert.equal(Number(sample.attrs['data-history-index']),row.index,`${template}: ${key} retains the gaps' original position`);
  }
  const xPosition=sample=>sample.tag==='rect'?Number(sample.attrs.x)+Number(sample.attrs.width)/2:Number(sample.attrs.cx);
  const orderedSamples=expected.map(row=>samples.find(node=>node.attrs['data-history-date']===row.date));
  let dayWidth=null;
  for(let index=1;index<orderedSamples.length;index++){
   const width=(xPosition(orderedSamples[index])-xPosition(orderedSamples[index-1]))/(expected[index].index-expected[index-1].index);
   assert.ok(Number.isFinite(width)&&width>0,`${template}: ${key} history positions progress through recorded days`);
   if(dayWidth!==null)assert.ok(Math.abs(width-dayWidth)<dayWidth*.01,`${template}: ${key} chart spacing preserves missing days`);dayWidth=width;
  }
  const low=Math.min(...expected.map(row=>row[key])),high=Math.max(...expected.map(row=>row[key]));
  const rangeValue=value=>key==='sleep'?value.toFixed(1)+'h':String(Math.round(value))+(key==='hrv'?' ms':'');
  for(const chart of charts){
   assert.equal(Number(chart.attrs['data-history-min']),low,`${template}: ${key} range retains its raw minimum`);assert.equal(Number(chart.attrs['data-history-max']),high,`${template}: ${key} range retains its raw maximum`);
   assert.ok(reading(chart).includes(rangeValue(low))&&reading(chart).includes(rangeValue(high)),`${template}: ${key} range uses the correct reading units`);
  }
  let connected=0;
  for(const path of charts.flatMap(chart=>marked(chart,'data-history-segment'))){
   let previous=null;const commands=[...path.attrs.d.matchAll(/([ML])\s*([-\d.e+]+)[,\s]+([-\d.e+]+)/gi)];assert.ok(commands.length,`${template}: ${key} history segments have geometry`);
   for(const [,command,x,y] of commands){
    const sample=samples.find(node=>Math.abs(Number(node.attrs.cx)-Number(x))<.06&&Math.abs(Number(node.attrs.cy)-Number(y))<.06);assert.ok(sample,`${template}: ${key} line passes through a recorded sample`);
    if(command.toUpperCase()==='L'){assert.ok(previous,`${template}: ${key} segment starts at a recorded sample`);assert.equal(Number(sample.attrs['data-history-index']),Number(previous.attrs['data-history-index'])+1,`${template}: ${key} lines never bridge a missing day`);connected++;}
    previous=sample;
   }
  }
  if(samples.some(sample=>sample.tag==='circle'))assert.ok(connected>=2,`${template}: ${key} consecutive readings are connected`);
  else assert.equal(connected,0,`${template}: ${key} bars do not interpolate missing days`);
  if(key==='hrv'){
   for(let index=1;index<orderedSamples.length;index++)assert.ok(Number(orderedSamples[index].attrs.cy)<Number(orderedSamples[index-1].attrs.cy),`${template}: HRV readings above 100 ms remain distinct, without an arbitrary percentage cap`);
  }
 }
 const highHrv=svgTree(shareCardSvg({...designFor(template),recoveryOnly:true,dayHealth:{...dayHealth,hrv:254,hrvRange:[40,120]}}));
 const hrvReading=assertHealth(highHrv,'hrv','254 ms',`${template}/high-HRV`).map(reading).join(' ');
 assert.ok(!/%|\/100|out of 100/i.test(hrvReading),`${template}: HRV is a raw millisecond reading`);

 for(const invalidHealth of [{},{sleep:NaN,score:101,hrv:-12},{sleep:-1,score:-1,hrv:Infinity}]){
  const svg=shareCardSvg({...designFor(template),stats:[],dayCards:[],recoveryOnly:true,dayHealth:invalidHealth}),missing=svgTree(svg);assertSafe(svg,`${template}/missing`);
  for(const key of ['sleep','score','hrv']){
   const groups=assertHealth(missing,key,'—',`${template}/missing`);
   assert.ok(groups.every(group=>!group.attrs['data-health-value']),`${template}: unknown ${key} has no fabricated numeric reading`);
  }
  assert.equal(marked(missing,'data-history-value').length,0,`${template}: absent history has no invented samples`);await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
 }
 const zeroScore=svgTree(shareCardSvg({...designFor(template),recoveryOnly:true,dayHealth:{...dayHealth,score:0}}));
 const zeroGroups=assertHealth(zeroScore,'score','0',`${template}/recorded-zero-score`);assert.ok(zeroGroups.every(group=>group.attrs['data-health-value']==='0'),'A recorded score of zero stays distinguishable from missing data');
}
console.log('Passed: recovery/day workout scope, unknown readings, raw HRV units and preserved history gaps.');

const strengthStats=[{key:'duration',label:'Activity time',value:'37:24',unit:'min:sec'},{key:'calories',label:'Workout calories',value:'281',unit:'kcal'},{key:'hr',label:'Average heart rate',value:'112',unit:'bpm'}];
for(const template of templates.filter(template=>!recoveryTemplates.has(template))){
 const svg=shareCardSvg({...base,template,title:'Evening strength',sport:'Strength',sportFamily:'strength_training',stats:strengthStats,route:null,laps:[]}),tree=svgTree(svg);assertSafe(svg,`${template}/strength`);
 for(const stat of strengthStats)assertStat(tree,stat,`${template}/strength`);assert.equal(marked(tree,'data-share-stat-key','distance').length,0,`${template}: strength does not invent a running distance`);
 await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
 const empty=shareCardSvg({...base,template,title:'No recorded session',stats:[],route:null,laps:[]});assertSafe(empty,`${template}/empty`);
 assert.ok(/—|NO RECORDED|UNAVAILABLE|NOT RECORDED/i.test(reading(svgTree(empty))),`${template}: missing activity stats have an explicit unknown state`);await sharp(Buffer.from(empty)).resize(540).png().toBuffer();
}

const cyclingStats=[{key:'distance',label:'Distance',value:'42.68',unit:'km'},{key:'speed',label:'Average speed',value:'28.8',unit:'km/h'},...stats.slice(2)];
const laps=[{index:1,value:8,pace:null},{index:2,value:null,pace:null},{index:3,value:9.5,pace:null}];
const cycling={...base,title:'Lunch ride',sport:'Cycling',sportFamily:'cycling',cycling:true,stats:cyclingStats,route,laps};
for(const template of ['retroride','retrolaps']){
 const svg=shareCardSvg({...cycling,template}),tree=svgTree(svg);assertSafe(svg,`${template}/cycling`);for(const stat of cyclingStats)assertStat(tree,stat,`${template}/cycling`);
 await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
}
const rideTree=svgTree(shareCardSvg({...cycling,template:'retroride'}));
const routePaths=marked(rideTree,'data-share-route').flatMap(group=>visibleNodes(group).filter(node=>node.tag==='path'));
assert.equal(routePaths.length,route.segments.length,'Recorded route preserves separate GPS segments');
for(const path of routePaths)assert.equal((path.attrs.d.match(/M/g)??[]).length,1,'Each route segment starts independently');
const noRouteTree=svgTree(shareCardSvg({...cycling,template:'retroride',route:null}));
assert.equal(marked(noRouteTree,'data-share-route').flatMap(group=>visibleNodes(group).filter(node=>node.tag==='path')).length,0,'Missing route produces no invented trace');
const lapTree=svgTree(shareCardSvg({...cycling,template:'retrolaps'}));
for(const lap of laps){
 const groups=marked(lapTree,'data-retro-lap-index',String(lap.index));assert.equal(groups.length,1,`Recorded lap ${lap.index} appears once`);
 if(lap.value===null){assert.ok(!('data-retro-lap-value' in groups[0].attrs),'Missing lap speed has no fabricated raw value');assert.ok(reading(groups[0]).includes('—'),'Missing lap speed remains unknown');}
 else{assert.equal(Number(groups[0].attrs['data-retro-lap-value']),lap.value,'Recorded lap retains the raw speed');assert.ok(reading(groups[0]).includes((lap.value*3.6).toFixed(1)),'Cycling lap uses km/h rather than a running pace');}
}
for(const finish of ['chrome','rainbow','iridescent']){
 const svg=shareCardSvg({...cycling,template:'retrolaps',finish});assertFinished(svgTree(svg),`retrolaps/cycling/${finish}`);await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
}
const runningLaps=[{index:1,value:3.5,pace:277},{index:2,value:null,pace:null},{index:3,value:3.2,pace:313}];
const runningLapTree=svgTree(shareCardSvg({...base,template:'retrolaps',laps:runningLaps}));
for(const lap of runningLaps){
 const groups=marked(runningLapTree,'data-retro-lap-index',String(lap.index));assert.equal(groups.length,1);
 if(lap.pace===null)assert.ok(reading(groups[0]).includes('—'));else{assert.equal(Number(groups[0].attrs['data-retro-lap-pace']),lap.pace);assert.ok(reading(groups[0]).includes(`${Math.floor(lap.pace/60)}:${String(lap.pace%60).padStart(2,'0')}`),'Running lap preserves the recorded pace');}
}
console.log('Passed: strength fallback, recorded cycling routes and speeds, running laps and unknown lap values.');

const unsafeTitle='<script> & "été" \'run\'';
const escaped=shareCardSvg({...base,template:'retrohero',title:unsafeTitle});assertSafe(escaped,'Escaped title');assert.match(escaped,/&lt;script&gt;/i);
assert.ok(reading(svgTree(escaped)).toUpperCase().includes(unsafeTitle.toUpperCase()),'Escaping preserves the readable title');
await sharp(Buffer.from(escaped)).resize(540).png().toBuffer();
console.log(`Passed: title escaping. Retro review PNGs: ${artifactDirectory}`);
