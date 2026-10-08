import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';

const {shareCardSvg,approvedActivityDesigns,approvedRecoveryDesigns}=await loadShareDesignModule();
const templates=['approvedrun','approvedride','approvedrecovery'];
const artifactDirectory=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-approved-share');
mkdirSync(artifactDirectory,{recursive:true});
const runStats=[
 {key:'distance',label:'Distance',value:'13.47',unit:'km'},
 {key:'duration',label:'Activity time',value:'1:02:18',unit:'h:mm:ss'},
 {key:'pace',label:'Average pace',value:'4:37',unit:'/km'},
 {key:'ascent',label:'Elevation gain',value:'189',unit:'m'},
 {key:'calories',label:'Workout calories',value:'783',unit:'kcal'},
 {key:'hr',label:'Average heart rate',value:'147',unit:'bpm'}
];
const rideStats=[{...runStats[0],value:'42.68'},runStats[1],{key:'speed',label:'Average speed',value:'28.8',unit:'km/h'},...runStats.slice(3)];
const points=[{x:0,y:0},{x:.3,y:.15},{x:.8,y:.1},{x:1,y:.65},{x:.65,y:1},{x:.15,y:.8},{x:0,y:0}];
const route={points,segments:[points.slice(0,4),points.slice(4)],center:{x:.5,y:.5}};
const history=[
 {date:'2026-10-02',sleep:7.2,score:77,hrv:104},
 {date:'2026-10-03',sleep:8.1,score:91,hrv:120},
 {date:'2026-10-04',sleep:null,score:null,hrv:null},
 {date:'2026-10-05',sleep:6.9,score:73,hrv:156},
 {date:'2026-10-06',sleep:7.5,score:84,hrv:164},
 {date:'2026-10-07',sleep:null,score:null,hrv:null},
 {date:'2026-10-08',sleep:8+1/60,score:88,hrv:203}
];
const dayHealth={sleep:28860,score:88,hrv:203,hrvRange:[104,203],history};
const base={height:1080,transparent:true,showLabels:true,finish:'solid',ink:'white',accent:'#b7ddf2',title:'THIS ACTIVITY TITLE MUST BE OMITTED',sport:'Running',sportFamily:'running',weekday:'Thursday',date:'',stats:runStats,route,brand:true,demo:false};
function designFor(template,height=1080){
 const accent=[...approvedActivityDesigns,...approvedRecoveryDesigns].find(design=>design.key===template).color;
 return {...base,template,height,accent,...(template==='approvedride'?{sport:'Cycling',sportFamily:'cycling',cycling:true,stats:rideStats}:template==='approvedrecovery'?{title:'THIS RECOVERY TITLE MUST BE OMITTED',recoveryOnly:false,dayHealth,dayCards:[{title:'THIS WORKOUT MUST BE OMITTED',sportFamily:'running',stats:runStats}]}:{})};
}

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
function inside(node,predicate){for(let current=node;current;current=current.parent)if(predicate(current))return true;return false;}
function visible(node){return descendants(node).filter(child=>!inside(child,current=>'data-approved-shadow' in current.attrs||current.tag==='defs'));}
function marked(node,attribute,value){return visible(node).filter(child=>attribute in child.attrs&&(value===undefined||child.attrs[attribute]===value));}
function reading(node){return visible(node).flatMap(child=>child.attrs['data-cinematic-text']!==undefined?[child.attrs['data-cinematic-text']]:child.tag==='text'?[child.text]:[]).join(' ').replace(/\s+/g,' ').trim();}
function inherited(node,key,fallback){for(let current=node;current;current=current.parent)if(key in current.attrs)return current.attrs[key];return fallback;}
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function matrix(node){
 const ancestors=[];for(let current=node;current;current=current.parent)ancestors.unshift(current);
 let result=[1,0,0,1,0,0];
 for(const ancestor of ancestors)for(const [,kind,args] of (ancestor.attrs.transform??'').matchAll(/(matrix|translate|scale)\(([^)]*)\)/g)){
  const n=args.trim().split(/[\s,]+/).map(Number),local=kind==='matrix'?n:kind==='translate'?[1,0,0,1,n[0],n[1]??0]:[n[0],0,0,n[1]??n[0],0,0];result=multiply(result,local);
 }
 return result;
}
function glyphBounds(tree,value){
 const groups=marked(tree,'data-cinematic-text',value);assert.equal(groups.length,1,`${value}: one readable outline group permits layout inspection`);
 const group=groups[0],glyphs=[...value].map(character=>faces[group.attrs['data-cinematic-face']].glyphs[character]).filter(glyph=>glyph[5]),seen=new Set();
 const paths=visible(group).filter(node=>{
  if(node.tag!=='path'||inside(node,current=>Number(current.attrs.opacity??1)<1))return false;
  const key=JSON.stringify([node.attrs.d,matrix(node)]);if(seen.has(key))return false;seen.add(key);return true;
 });
 assert.equal(paths.length,glyphs.length,`${value}: glyph geometry is self-contained`);
 const points=paths.flatMap((node,index)=>{
  const m=matrix(node),glyph=glyphs[index];return [[glyph[1],glyph[2]],[glyph[1],glyph[4]],[glyph[3],glyph[2]],[glyph[3],glyph[4]]].map(([x,y])=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]}));
 });
 const left=Math.min(...points.map(point=>point.x)),right=Math.max(...points.map(point=>point.x)),top=Math.min(...points.map(point=>point.y)),bottom=Math.max(...points.map(point=>point.y));return {left,right,top,bottom,width:right-left,height:bottom-top,centerX:(left+right)/2};
}
function assertSafe(svg,context){assert.ok(!/NaN|Infinity|undefined|<script(?:\s|>)/i.test(svg),`${context}: SVG contains only valid numbers and safe markup`);}
function assertStat(tree,stat,expected,context){
 const groups=marked(tree,'data-share-stat-key',stat.key);assert.equal(groups.length,1,`${context}: ${stat.key} appears once`);
 assert.equal(groups[0].attrs['data-stat-value'],stat.value,`${context}: ${stat.key} preserves its recorded source value`);
 assert.equal(groups[0].attrs['data-stat-unit'],stat.unit,`${context}: ${stat.key} preserves its source unit`);
 assert.ok(reading(groups[0]).replace(/\s/g,'').toLowerCase().includes(expected.replace(/\s/g,'').toLowerCase()),`${context}: ${stat.key} displays ${expected}; got ${reading(groups[0])}`);
}
function assertHealth(tree,key,value,expected,context){
 const groups=marked(tree,'data-approved-health-key',key);assert.equal(groups.length,1,`${context}: ${key} has one current reading`);
 assert.equal(groups[0].attrs['data-health-value'],String(value),`${context}: ${key} keeps its raw source value`);
 assert.ok(reading(groups[0]).replace(/\s/g,'').toLowerCase().includes(expected.replace(/\s/g,'').toLowerCase()),`${context}: ${key} displays ${expected}; got ${reading(groups[0])}`);return groups[0];
}
function assertFilledIcon(tree,attribute,key,context){
 const icons=marked(tree,attribute,key);assert.equal(icons.length,1,`${context}: ${key} has one vector icon`);
 assert.equal(icons[0].attrs['data-approved-filled-icon'],'true',`${context}: ${key} identifies its filled sticker artwork`);
 const shapes=visible(icons[0]).filter(node=>['path','circle','ellipse','polygon','rect'].includes(node.tag)&&!inside(node,current=>Number(current.attrs.opacity??1)<1));assert.ok(shapes.length,`${context}: ${key} icon has vector artwork`);
 for(const shape of shapes){
  const filled=!['none','transparent'].includes(inherited(shape,'fill','black'));
  const thick=!['none','transparent'].includes(inherited(shape,'stroke','none'))&&Number(inherited(shape,'stroke-width','0'))>=7;
  assert.ok(filled||thick,`${context}: ${key} uses a filled shape or a solid, thick silhouette`);
 }
}
function assertAlphaPadding(raw,width,height,context){
 let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(raw[(y*width+x)*4+3]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 assert.ok(maxX>=minX&&maxY>=minY,`${context}: export contains visible artwork`);
 assert.ok(minX>=16&&minY>=16&&maxX<width-16&&maxY<height-16,`${context}: full artwork retains transparent padding (${minX},${minY})–(${maxX},${maxY})`);
}
function shadowPaints(tree){
 const shadows=descendants(tree).filter(node=>'data-approved-shadow' in node.attrs);assert.ok(shadows.length,'Approved lettering has protected shadows');
 const paints=shadows.flatMap(group=>descendants(group).flatMap(node=>['fill','stroke'].flatMap(key=>node.attrs[key]&&!['none','transparent'].includes(node.attrs[key])?[`${key}:${node.attrs[key]}`]:[])));
 assert.ok(paints.length,'Approved shadows have visible paint');assert.ok(paints.every(paint=>!paint.includes('url(')),'Approved shadows keep solid paint');return paints;
}
function assertFinished(tree,context){
 let count=0;
 for(const node of visible(tree)){
  if(!['text','path','circle','rect','line','polyline','polygon','ellipse'].includes(node.tag))continue;
  for(const [kind,paint] of [['fill',inherited(node,'fill','black')],['stroke',inherited(node,'stroke','none')]])if(!['none','transparent'].includes(paint)){
   assert.match(paint,/^url\(#[\w-]+\)$/,`${context}: foreground ${node.tag} ${kind} receives the selected finish`);count++;
  }
 }
 assert.ok(count,`${context}: finish paints visible foreground`);
}
function assertMinimalScope(tree,template,context){
 const text=reading(tree);assert.ok(!/THIS (?:ACTIVITY TITLE|RECOVERY TITLE|WORKOUT) MUST BE OMITTED/.test(text),`${context}: sticker omits activity and day titles`);
 assert.ok(!/THURSDAY|2026-10|RECOVERY CLUB|ILLUSTRATIVE DATA|7D RANGE|GAPS =|NO RECORDED ROUTE/i.test(text),`${context}: sticker has no unsolicited date, range, title or route caption`);
 assert.equal(marked(tree,'data-retro-workout').length,0,`${context}: sticker contains no day workout rows`);
 if(template==='approvedrecovery'){
  assert.equal(marked(tree,'data-share-stat-key').length,0,`${context}: recovery contains no activity stat grid`);
  assert.equal(marked(tree,'data-share-route').length,0,`${context}: recovery contains no corner route`);
  assert.equal(marked(tree,'data-sport-icon').length,0,`${context}: recovery contains no sport icon`);
  assert.deepEqual(marked(tree,'data-approved-history-key').map(node=>node.attrs['data-approved-history-key']).sort(),['hrv','score'],`${context}: only HRV and score have histories`);
 }else{
  const keys=template==='approvedrun'?['distance','duration','pace']:['distance','duration','speed'];
  assert.deepEqual(marked(tree,'data-share-stat-key').map(node=>node.attrs['data-share-stat-key']).sort(),keys.sort(),`${context}: only the three approved activity metrics appear`);
  assert.equal(marked(tree,'data-approved-history-key').length,0,`${context}: activity has no recovery charts`);
  if(template==='approvedrun')assert.equal(marked(tree,'data-share-route').length,0,`${context}: running sticker omits route artwork`);
 }
}

assert.deepEqual(approvedActivityDesigns.map(design=>design.key),['approvedrun','approvedride'],'The activity catalog has exactly the approved run and ride layouts');
assert.deepEqual(approvedRecoveryDesigns.map(design=>design.key),['approvedrecovery'],'The recovery catalog has exactly the approved recovery layout');
const faces=JSON.parse(readFileSync(new URL('../app/share-display-glyphs.json',import.meta.url),'utf8'));
assert.ok(faces.approved,'Approved exports bundle their own outline glyphs');
for(const character of '0123456789kmh/:sieste')assert.ok(faces.approved.glyphs[character],`Approved face includes ${character}`);

for(const template of templates)for(const height of [1080,1350,1920]){
 const context=`${template}/${height}`,design=designFor(template,height),svg=shareCardSvg(design),tree=svgTree(svg);assertSafe(svg,context);
 const canvas=tree.children.find(node=>node.tag==='svg');assert.equal(Number(canvas.attrs.width),1080);assert.equal(Number(canvas.attrs.height),height);assert.equal(canvas.attrs.viewBox,`0 0 1080 ${height}`);
 assert.ok(marked(tree,'data-cinematic-face','approved').length,`${context}: headline uses self-contained approved vectors`);shadowPaints(tree);assertMinimalScope(tree,template,context);
 assert.equal((reading(tree).match(/sieste/gi)??[]).length,1,`${context}: enabled brand appears once`);
 assert.equal(marked(tree,'data-approved-brand').length,1,`${context}: enabled brand has one centered signature group`);
 assert.ok(Math.abs(glyphBounds(tree,'sieste').centerX-540)<=24,`${context}: signature is centered on the canvas`);
 if(template==='approvedrecovery'){
  assertHealth(tree,'sleep',28860,'8h01',context);assertHealth(tree,'hrv',203,'203ms',context);assertHealth(tree,'score',88,'88/100',context);
  for(const key of ['sleep','hrv','score'])assertFilledIcon(tree,'data-health-icon',key,context);
  assert.ok(marked(tree,'data-approved-material').length,`${context}: default recovery has glossy material`);
 }else{
  const stats=template==='approvedrun'?runStats:rideStats;
  assertStat(tree,stats[0],`${stats[0].value}km`,context);assertStat(tree,stats[1],'1h02',context);assertStat(tree,stats[2],template==='approvedrun'?'4:37/km':'28.8km/h',context);
  assertFilledIcon(tree,'data-sport-icon',template==='approvedrun'?'running':'cycling',context);
  const number=glyphBounds(tree,stats[0].value),unit=glyphBounds(marked(tree,'data-share-stat-key','distance')[0],'km');
  assert.ok(number.width>unit.width*2&&number.height>unit.height*1.8,`${context}: distance dominates the smaller km unit`);
  assert.ok(unit.centerX>number.centerX,`${context}: km sits to the right of the distance`);
  if(template==='approvedrun')assert.ok(Math.abs(unit.bottom-number.bottom)<40,`${context}: running km stays inline with the hero baseline`);
  else assert.ok(unit.top>=number.bottom-24,`${context}: cycling km sits below the hero on the right`);
 }
 const png=await sharp(Buffer.from(svg)).resize(2160,height*2).png().toBuffer(),metadata=await sharp(png).metadata();
 assert.equal(metadata.width,2160,`${context}: full-resolution PNG width`);assert.equal(metadata.height,height*2,`${context}: PNG keeps its aspect ratio`);assert.ok(metadata.hasAlpha,`${context}: PNG has alpha`);
 assertAlphaPadding(await sharp(png).ensureAlpha().raw().toBuffer(),metadata.width,metadata.height,context);
 if(height===1080)await sharp(png).toFile(join(artifactDirectory,`${template}-2160.png`));
 const opaque=await sharp(Buffer.from(shareCardSvg({...design,transparent:false}))).extract({left:0,top:0,width:1,height:1}).ensureAlpha().raw().toBuffer();assert.equal(opaque[3],255,`${context}: opaque export paints its background`);
}
console.log('Passed: three approved layouts, three shapes, exact source readings, filled icons, brand and 2160px PNG alpha padding.');

for(const template of templates){
 const design=designFor(template),baseline=shadowPaints(svgTree(shareCardSvg(design)));
 for(const finish of ['chrome','gold','rose','copper','titanium','midnight','rainbow','iridescent']){
  const context=`${template}/${finish}`,svg=shareCardSvg({...design,finish}),tree=svgTree(svg);assertSafe(svg,context);assertFinished(tree,context);assertMinimalScope(tree,template,context);
  assert.deepEqual(shadowPaints(tree),baseline,`${context}: finish preserves the approved shadow paint`);await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
 }
 const unbranded=svgTree(shareCardSvg({...design,brand:false}));assert.ok(!/sieste/i.test(reading(unbranded)),`${template}: brand can be disabled`);
 assert.equal(marked(unbranded,'data-approved-brand').length,0,`${template}: disabled brand removes its artwork`);
 const dated=svgTree(shareCardSvg({...design,date:'8 October 2026'}));assert.ok(!reading(dated).includes('8 October 2026'),`${template}: the approved sticker composition omits date text`);
}
console.log('Passed: all eight decorative finishes cover lettering, icons and charts while preserving shadows; optional brand and no date captions.');

const recovery=svgTree(shareCardSvg(designFor('approvedrecovery')));
for(const key of ['hrv','score']){
 const chart=marked(recovery,'data-approved-history-key',key)[0],samples=marked(chart,'data-history-value');
 const expected=history.map((row,index)=>({...row,index})).filter(row=>row[key]!==null);assert.equal(samples.length,expected.length,`${key}: missing days do not invent samples`);
 const ordered=expected.map(row=>{
  const sample=samples.find(node=>node.attrs['data-history-date']===row.date);assert.ok(sample,`${key}: ${row.date} is preserved`);
  const dot=visible(sample).find(node=>node.tag==='circle');assert.ok(dot,`${key}: history uses recorded dots`);
  assert.equal(Number(sample.attrs['data-history-value']),row[key],`${key}: raw sample value is unchanged`);assert.equal(Number(sample.attrs['data-history-index']),row.index,`${key}: sample index preserves gaps`);return {sample,dot};
 });
 let dayWidth=null;
 for(let index=1;index<ordered.length;index++){
  const width=(Number(ordered[index].dot.attrs.cx)-Number(ordered[index-1].dot.attrs.cx))/(expected[index].index-expected[index-1].index);assert.ok(Number.isFinite(width)&&width>0,`${key}: dots advance through recorded days`);
  if(dayWidth!==null)assert.ok(Math.abs(width-dayWidth)<dayWidth*.01,`${key}: blank days keep their chart spacing`);dayWidth=width;
 }
 let connections=0;
 for(const path of marked(chart,'data-history-segment')){
  let previous=null;
  for(const [,command,x,y] of path.attrs.d.matchAll(/([ML])\s*([-\d.e+]+)[,\s]+([-\d.e+]+)/gi)){
   const sample=ordered.find(({dot})=>Math.abs(Number(dot.attrs.cx)-Number(x))<.06&&Math.abs(Number(dot.attrs.cy)-Number(y))<.06)?.sample;assert.ok(sample,`${key}: history line visits a recorded dot`);
   if(command.toUpperCase()==='L'){assert.ok(previous,`${key}: each line starts at a sample`);assert.equal(Number(sample.attrs['data-history-index']),Number(previous.attrs['data-history-index'])+1,`${key}: lines never bridge a missing day`);connections++;}previous=sample;
  }
 }
 assert.ok(connections>=2,`${key}: consecutive dots remain connected`);
 if(key==='hrv')for(let index=1;index<ordered.length;index++)assert.ok(Number(ordered[index].dot.attrs.cy)<Number(ordered[index-1].dot.attrs.cy),'HRV values above 100 ms remain distinct');
}
assertHealth(svgTree(shareCardSvg({...designFor('approvedrecovery'),dayHealth:{...dayHealth,hrv:254,hrvRange:[40,120]}})),'hrv',254,'254ms','High HRV');
for(const health of [{},{sleep:NaN,score:101,hrv:-12},{sleep:-1,score:-1,hrv:Infinity}]){
 const svg=shareCardSvg({...designFor('approvedrecovery'),stats:[],dayCards:[],dayHealth:health}),tree=svgTree(svg);assertSafe(svg,'Missing recovery');
 for(const key of ['sleep','score','hrv']){
  const groups=marked(tree,'data-approved-health-key',key);assert.equal(groups.length,1,`Missing ${key} keeps an explicit reading`);assert.ok(reading(groups[0]).includes('—'),`Missing ${key} displays an unknown state`);assert.ok(!groups[0].attrs['data-health-value'],`Missing ${key} has no fabricated source value`);
 }
 assert.equal(marked(tree,'data-history-value').length,0,'Missing history has no sample values');await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
}
assertHealth(svgTree(shareCardSvg({...designFor('approvedrecovery'),dayHealth:{...dayHealth,score:0}})),'score',0,'0/100','Recorded zero score');
console.log('Passed: current sleep seconds, raw HRV, score units, two histories, missing readings and unbridged history gaps.');

for(const template of ['approvedrun','approvedride']){
 const design=designFor(template),wanted=template==='approvedrun'?['distance','duration','pace']:['distance','duration','speed'];
 const reordered=svgTree(shareCardSvg({...design,stats:[...design.stats].reverse()}));for(const key of wanted)assert.equal(marked(reordered,'data-share-stat-key',key).length,1,`${template}: metric lookup uses keys rather than stat order`);
 for(const omitted of wanted.slice(1)){
  const svg=shareCardSvg({...design,stats:design.stats.filter(stat=>stat.key!==omitted)}),tree=svgTree(svg);assertSafe(svg,`${template}/missing-${omitted}`);assert.equal(marked(tree,'data-share-stat-key',omitted).length,0,`${template}: missing ${omitted} is omitted`);await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
 }
 const emptySvg=shareCardSvg({...design,stats:[],route:null}),empty=svgTree(emptySvg);assertSafe(emptySvg,`${template}/empty`);assert.ok(reading(empty).includes('—'),`${template}: absent distance is explicit`);assert.equal(marked(empty,'data-share-stat-key').length,0,`${template}: empty activity has no fabricated metrics`);await sharp(Buffer.from(emptySvg)).resize(540).png().toBuffer();
}
const ride=svgTree(shareCardSvg(designFor('approvedride'))),routeGroups=marked(ride,'data-share-route');assert.equal(routeGroups.length,1,'Cycling has one recorded route inset');
const routePaths=visible(routeGroups[0]).filter(node=>node.tag==='path');assert.equal(routePaths.length,route.segments.length,'Cycling inset keeps distinct recorded GPS segments');
for(const path of routePaths)assert.equal((path.attrs.d.match(/M/g)??[]).length,1,'GPS segments start independently');
const noRoute=svgTree(shareCardSvg({...designFor('approvedride'),route:null}));assert.equal(marked(noRoute,'data-share-route').length,0,'Missing cycling route has no fabricated trace');
console.log(`Passed: stat order, missing support metrics, empty activities and optional recorded cycling routes. Review PNGs: ${artifactDirectory}`);
