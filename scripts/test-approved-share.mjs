import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';

const {shareCardSvg,approvedActivityDesigns,approvedRecoveryDesigns,shareFinishes}=await loadShareDesignModule();
const atlas=JSON.parse(readFileSync(new URL('../app/original-share-art.json',import.meta.url),'utf8'));
const artEntries=['glyphs','icons','groups'].flatMap(section=>Object.entries(atlas[section]).flatMap(([kind,items])=>Object.entries(items).map(([key,item])=>({section,kind,key,item}))));
const artByPng=new Map();
for(const entry of artEntries){const entries=artByPng.get(entry.item.png)??[];entries.push(entry);artByPng.set(entry.item.png,entries);}
const fingerprint=value=>createHash('sha256').update(value).digest('hex');
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
 const groups=marked(tree,'data-cinematic-text',value);assert.equal(groups.length,1,`${value}: one readable artwork group permits layout inspection`);
 const pictures=marked(groups[0],'data-original-art');assert.ok(pictures.length,`${value}: geometry comes from original PNG artwork`);
 const points=pictures.flatMap(picture=>{
  const {image,item}=sourceArtwork(picture,value),bounds=imageFrontBounds(image,item),m=matrix(image),[x,y,w,h]=bounds;
  return [[x,y],[x,y+h],[x+w,y],[x+w,y+h]].map(([xx,yy])=>({x:m[0]*xx+m[2]*yy+m[4],y:m[1]*xx+m[3]*yy+m[5]}));
 });
 const left=Math.min(...points.map(point=>point.x)),right=Math.max(...points.map(point=>point.x)),top=Math.min(...points.map(point=>point.y)),bottom=Math.max(...points.map(point=>point.y));return {left,right,top,bottom,width:right-left,height:bottom-top,centerX:(left+right)/2};
}
function designKind(node){
 for(let current=node;current;current=current.parent)if('data-approved-design' in current.attrs)return {approvedrun:'running',approvedride:'cycling',approvedrecovery:'recovery'}[current.attrs['data-approved-design']];
 assert.fail('Original artwork belongs to a declared approved design');
}
function sourceArtwork(picture,context){
 const images=descendants(picture).filter(node=>node.tag==='image'),sourceImages=images.filter(node=>artByPng.has(imagePayload(node,context)));
 assert.equal(sourceImages.length,1,`${context}: original artwork has one full source PNG`);
 const image=sourceImages[0],kind=designKind(picture),character=picture.attrs['data-original-char'],group=picture.attrs['data-original-group'],icon=picture.attrs['data-original-icon'];
 const candidates=artByPng.get(imagePayload(image,context)).filter(entry=>entry.kind===kind);
 const entry=candidates.find(candidate=>character!==undefined?candidate.section==='glyphs'&&candidate.key===character:group!==undefined?candidate.key===group||group==='sieste'&&candidate.section==='icons'&&candidate.key==='signature':icon!==undefined?candidate.section==='icons'&&candidate.key===icon:true);
 assert.ok(entry,`${context}: actual PNG payload matches its original ${character!==undefined?'glyph '+character:group!==undefined?'group '+group:'artwork'} entry`);
 const {item}=entry,provenance=picture.attrs['data-original-source'];
 assert.ok([JSON.stringify(item.source),`${item.source.kind}:${item.source.components.join(',')}`].includes(provenance),`${context}: original provenance identifies the PNG's actual source components`);
 for(const node of images)assert.ok([item.png,item.faceMask].includes(imagePayload(node,context)),`${context}: artwork uses only its exact source PNG and front mask`);
 return {...entry,image};
}
function imageFrontBounds(image,item){
 const x=Number(image.attrs.x??0),y=Number(image.attrs.y??0),w=Number(image.attrs.width),h=Number(image.attrs.height);
 assert.ok([x,y,w,h].every(Number.isFinite)&&w>0&&h>0,'Original image has finite, positive dimensions');
 let sx=w/item.width,sy=h/item.height,dx=x,dy=y;
 if((image.attrs.preserveAspectRatio??'xMidYMid meet')!=='none'){
  const mode=image.attrs.preserveAspectRatio??'xMidYMid meet',s=mode.includes('slice')?Math.max(sx,sy):Math.min(sx,sy);sx=sy=s;
  dx+=mode.includes('xMin')?0:mode.includes('xMax')?w-item.width*s:(w-item.width*s)/2;dy+=mode.includes('YMin')?0:mode.includes('YMax')?h-item.height*s:(h-item.height*s)/2;
 }
 const [fx,fy,fw,fh]=item.frontBBox;return [dx+fx*sx,dy+fy*sy,fw*sx,fh*sy];
}
function assertOriginalArtwork(tree,context){
 const pictures=marked(tree,'data-original-art');assert.ok(pictures.length,`${context}: approved sticker contains its original PNG artwork`);
 for(const picture of pictures){
  const {image,item}=sourceArtwork(picture,context),declared=(picture.attrs['data-original-bounds']??'').trim().split(/\s+/).map(Number),actual=imageFrontBounds(image,item);
  assert.ok(declared.length===4&&declared.every(Number.isFinite),`${context}: artwork declares finite front bounds`);
  for(let index=0;index<4;index++)assert.ok(Math.abs(actual[index]-declared[index])<.06,`${context}: front bounds come from the rendered source image`);
 }
 for(const group of marked(tree,'data-original-reading')){
  const value=group.attrs['data-original-reading'];assert.equal(group.attrs['data-cinematic-text'],value,`${context}: artwork and accessible reading agree`);
  if(value==='—'){assert.equal(marked(group,'data-original-art').length,0,`${context}: unknown reading has no fabricated source artwork`);continue;}
  const pieces=marked(group,'data-original-art').map(picture=>sourceArtwork(picture,context));
  assert.ok(pieces.length,`${context}: ${value} has actual source artwork`);
  const actual=pieces.map(piece=>piece.section==='glyphs'?piece.key:piece.section==='groups'?piece.key:piece.key==='signature'?'sieste':'').join('');
  assert.equal(actual.replace(/\s/g,''),value.replace(/\s/g,''),`${context}: actual PNG glyph sequence displays ${value}`);
  const exact=atlas.groups[designKind(group)][value];if(exact){assert.equal(pieces.length,1,`${context}: ${value} preserves its original whole reading`);assert.equal(fingerprint(pieces[0].item.png),fingerprint(exact.png),`${context}: ${value} uses the exact original source artwork`);}
 }
 for(const group of marked(tree,'data-cinematic-text'))if(group.attrs['data-cinematic-text']!=='—')assert.equal(group.attrs['data-original-reading'],group.attrs['data-cinematic-text'],`${context}: each readable value is backed by original artwork`);
}
function imagePayload(node,context){
 const href=node.attrs.href??node.attrs['xlink:href'];assert.match(href??'',/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/,`${context}: artwork embeds a self-contained PNG`);
 const payload=href.slice('data:image/png;base64,'.length),bytes=Buffer.from(payload,'base64');assert.equal(bytes.toString('base64'),payload,`${context}: PNG payload has valid base64`);
 assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10],`${context}: image contains PNG bytes`);return href;
}
function assertSafe(svg,context){
 const markup=svg.replace(/\b(?:href|xlink:href)="(data:image\/png;base64,[^"]*)"/g,(_,href)=>{imagePayload({attrs:{href}},context);return 'href="embedded-png"';});
 assert.ok(!/NaN|Infinity|undefined|<script(?:\s|>)/i.test(markup),`${context}: SVG contains only valid numbers and safe markup`);
 const tree=svgTree(svg);for(const node of descendants(tree).filter(node=>node.tag==='image'))imagePayload(node,context);assertOriginalArtwork(tree,context);
}
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
 const icons=marked(tree,attribute,key);assert.equal(icons.length,1,`${context}: ${key} has one original icon`);
 assert.equal(icons[0].attrs['data-approved-filled-icon'],'true',`${context}: ${key} identifies its filled sticker artwork`);
 const pictures=marked(icons[0],'data-original-art');assert.equal(pictures.length,1,`${context}: ${key} icon uses one original source asset`);
 const entry=sourceArtwork(pictures[0],context),expected={running:'runner',cycling:'bicycle',sleep:'moon',hrv:'pulse',score:'star'}[key];
 assert.equal(entry.section,'icons',`${context}: ${key} uses original icon artwork`);assert.equal(entry.key,expected,`${context}: ${key} displays its actual original icon`);
}
function assertAlphaPadding(raw,width,height,context){
 let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(raw[(y*width+x)*4+3]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 assert.ok(maxX>=minX&&maxY>=minY,`${context}: export contains visible artwork`);
 assert.ok(minX>=16&&minY>=16&&maxX<width-16&&maxY<height-16,`${context}: full artwork retains transparent padding (${minX},${minY})–(${maxX},${maxY})`);
}
function shadowPaints(tree){
 const shapes=descendants(tree).filter(node=>['path','circle','ellipse','polygon','rect'].includes(node.tag)&&inside(node,ancestor=>'data-approved-shadow' in ancestor.attrs));
 const paints=shapes.flatMap(node=>['fill','stroke'].flatMap(key=>{const paint=inherited(node,key,key==='fill'?'black':'none');return !['none','transparent'].includes(paint)?[`${key}:${paint}`]:[];}));
 assert.ok(paints.every(paint=>!paint.includes('url(')),'Approved vector shadows keep solid paint');
 const raster=marked(tree,'data-original-art').map(picture=>`png:${fingerprint(sourceArtwork(picture,'Approved shadow').item.png)}`);
 assert.ok(paints.length+raster.length,'Approved artwork preserves visible original shadows');return [...paints,...raster];
}
function assertFinished(tree,context,finish){
 const colours=shareFinishes.find(palette=>palette.key===finish)?.colors;assert.ok(colours,`${context}: finish has its selected palette`);
 const expected={metal:colours,metalSoft:[colours[0],colours[1],colours[6],colours[7]],rim:[colours[0],colours[3],colours[7],colours[4]],finishStroke:colours,iconFinish:colours};
 let count=0;
 for(const node of visible(tree)){
  assert.notEqual(node.tag,'image',`${context}: PNG foregrounds receive the selected finish through their masks`);
  if(!['text','path','circle','rect','line','polyline','polygon','ellipse'].includes(node.tag))continue;
  for(const [kind,paint] of [['fill',inherited(node,'fill','black')],['stroke',inherited(node,'stroke','none')]])if(!['none','transparent'].includes(paint)){
   assert.match(paint,/^url\(#[\w-]+\)$/,`${context}: foreground ${node.tag} ${kind} receives the selected finish`);
   const id=paint.slice(5,-1),gradients=descendants(tree).filter(node=>node.tag==='linearGradient'&&node.attrs.id===id);assert.equal(gradients.length,1,`${context}: foreground finish references one declared gradient`);
   assert.ok(expected[id],`${context}: foreground uses a selected finish gradient`);assert.deepEqual(gradients[0].children.filter(node=>node.tag==='stop').map(node=>node.attrs['stop-color']),expected[id],`${context}: visible finish uses the selected ${finish} palette`);count++;
  }
 }
 for(const picture of marked(tree,'data-original-art')){
  const {item,image}=sourceArtwork(picture,context);assert.ok(inside(image,node=>'data-approved-shadow' in node.attrs),`${context}: selected finish protects the original PNG shadow`);
  const fronts=visible(picture).filter(node=>node.tag==='rect'&&node.attrs.mask);assert.equal(fronts.length,1,`${context}: original PNG face has one finished front layer`);
  const id=fronts[0].attrs.mask.match(/^url\(#([\w-]+)\)$/)?.[1];assert.ok(id,`${context}: finished face references a local mask`);
  const masks=descendants(tree).filter(node=>node.tag==='mask'&&node.attrs.id===id);assert.equal(masks.length,1,`${context}: finished face has one self-contained mask`);
  assert.equal(masks[0].attrs.maskUnits,'userSpaceOnUse',`${context}: finished face mask follows artwork coordinates`);
  const images=descendants(masks[0]).filter(node=>node.tag==='image');assert.equal(images.length,1,`${context}: face mask contains original alpha artwork`);
  assert.equal(fingerprint(imagePayload(images[0],context)),fingerprint(item.faceMask),`${context}: finish follows the exact original front face`);
  assert.equal(images[0].attrs.preserveAspectRatio??'xMidYMid meet',image.attrs.preserveAspectRatio??'xMidYMid meet',`${context}: face mask preserves the original image's stretching`);
  assert.deepEqual(matrix(images[0]),matrix(image),`${context}: face mask and original artwork share their effective transform`);
  assert.deepEqual(matrix(fronts[0]),matrix(image),`${context}: finished paint and original artwork share their effective transform`);
  for(const key of ['x','y','width','height']){
   assert.equal(Number(images[0].attrs[key]??0),Number(image.attrs[key]??0),`${context}: face mask ${key} aligns with original artwork`);
   assert.equal(Number(masks[0].attrs[key]??0),Number(image.attrs[key]??0),`${context}: face mask boundary ${key} covers original artwork`);
   assert.equal(Number(fronts[0].attrs[key]??0),Number(image.attrs[key]??0),`${context}: finished front ${key} covers original artwork`);
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
const pngAnalysis=new Map();
async function analyzePng(uri){
 if(!pngAnalysis.has(uri))pngAnalysis.set(uri,(async()=>{
  imagePayload({attrs:{href:uri}},'Original atlas');const input=Buffer.from(uri.slice('data:image/png;base64,'.length),'base64'),metadata=await sharp(input).metadata(),{data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  assert.ok(right>=left&&bottom>=top,'Original atlas PNG contains visible artwork');return {metadata,bounds:[left,top,right-left+1,bottom-top+1]};
 })());return pngAnalysis.get(uri);
}
for(const kind of ['running','cycling','recovery']){
 for(const character of '0123456789kmh/:s.')assert.ok(atlas.glyphs[kind][character],`${kind}: original atlas includes ${character}`);
 assert.ok(atlas.icons[kind].signature,`${kind}: original atlas includes its actual signature`);
}
for(const {section,kind,key,item} of artEntries){
 const context=`Atlas ${section}/${kind}/${key}`,full=await analyzePng(item.png),mask=await analyzePng(item.faceMask);
 for(const image of [full,mask]){assert.equal(image.metadata.width,item.width,`${context}: recorded PNG width matches artwork`);assert.equal(image.metadata.height,item.height,`${context}: recorded PNG height matches artwork`);assert.ok(image.metadata.hasAlpha,`${context}: source PNG has transparent alpha`);}
 assert.deepEqual(mask.bounds,item.frontBBox,`${context}: front bounds match the actual face mask alpha`);
}

for(const template of templates)for(const height of [1080,1350,1920]){
 const context=`${template}/${height}`,design=designFor(template,height),svg=shareCardSvg(design),tree=svgTree(svg);assertSafe(svg,context);
 const canvas=tree.children.find(node=>node.tag==='svg');assert.equal(Number(canvas.attrs.width),1080);assert.equal(Number(canvas.attrs.height),height);assert.equal(canvas.attrs.viewBox,`0 0 1080 ${height}`);
 assert.ok(marked(tree,'data-cinematic-face','approved').length,`${context}: headline uses self-contained approved artwork`);shadowPaints(tree);assertMinimalScope(tree,template,context);
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

const originalFixtures=[
 {template:'approvedrun',kind:'running',stats:[{...runStats[0],value:'10.01'},{...runStats[1],value:'51:00',unit:'min:sec'},{...runStats[2],value:'5:06'}],readings:['10.01','km','51:00','5:06/km']},
 {template:'approvedride',kind:'cycling',stats:[{...rideStats[0],value:'77.53'},{...rideStats[1],value:'3:22:00'},{...rideStats[2],value:'23'}],readings:['77.53','km','3h22','23km/h']},
 {template:'approvedrecovery',kind:'recovery',dayHealth:{...dayHealth,sleep:28860,hrv:104,score:85},readings:['8h01','104ms','85/100']}
];
for(const fixture of originalFixtures){
 const context=`${fixture.template}/original-readings`,design={...designFor(fixture.template),...(fixture.stats?{stats:fixture.stats}:{dayHealth:fixture.dayHealth})},svg=shareCardSvg(design),tree=svgTree(svg);assertSafe(svg,context);
 for(const value of fixture.readings){
  const groups=marked(tree,'data-original-reading',value);assert.equal(groups.length,1,`${context}: original ${value} appears once`);
  const pictures=marked(groups[0],'data-original-art');assert.equal(pictures.length,1,`${context}: original ${value} retains its entire source group`);
  const {item}=sourceArtwork(pictures[0],context);assert.equal(fingerprint(item.png),fingerprint(atlas.groups[fixture.kind][value].png),`${context}: actual image payload matches original ${value}`);
 }
 await sharp(Buffer.from(svg)).resize(2160).png().toFile(join(artifactDirectory,`${fixture.template}-source-2160.png`));
}
for(const template of ['approvedrun','approvedride']){
 const design=designFor(template),stats=design.stats.map(stat=>stat.key==='distance'?{...stat,value:'90.25'}:stat),svg=shareCardSvg({...design,stats}),tree=svgTree(svg);assertSafe(svg,`${template}/new-numerals`);assertStat(tree,stats[0],'90.25km',`${template}/new-numerals`);await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
}
console.log('Passed: exact original example PNG groups and dynamic numerals use their actual atlas artwork.');

for(const template of templates){
 const design=designFor(template),baseline=shadowPaints(svgTree(shareCardSvg(design)));
 for(const finish of ['chrome','gold','rose','copper','titanium','midnight','rainbow','iridescent']){
  const context=`${template}/${finish}`,svg=shareCardSvg({...design,finish}),tree=svgTree(svg);assertSafe(svg,context);assertFinished(tree,context,finish);assertMinimalScope(tree,template,context);
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
  let dot=visible(sample).find(node=>node.tag==='circle');
  if(!dot){
   const pictures=marked(sample,'data-original-art');assert.equal(pictures.length,1,`${key}: history sample uses one actual source dot`);
   const entry=sourceArtwork(pictures[0],`${key} history`);assert.equal(entry.section,'icons',`${key}: history uses original icon artwork`);assert.equal(entry.key,'dot',`${key}: history displays the actual source dot`);
   assert.deepEqual(matrix(entry.image),matrix(chart),`${key}: PNG dot positions use the chart's coordinate plane`);
   dot={attrs:{cx:String(Number(entry.image.attrs.x??0)+Number(entry.image.attrs.width)/2),cy:String(Number(entry.image.attrs.y??0)+Number(entry.image.attrs.height)/2)}};
  }
  assert.ok(dot,`${key}: history uses recorded dots`);
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
for(const recordedRoute of [route,null]){
 const ride=svgTree(shareCardSvg({...designFor('approvedride'),route:recordedRoute})),ornaments=marked(ride,'data-approved-ornament');assert.equal(ornaments.length,1,'Cycling always displays one original decorative flourish');
 assert.equal(marked(ride,'data-share-route').length,0,'Cycling decoration does not claim to display recorded GPS');
 const pictures=marked(ornaments[0],'data-original-art');assert.equal(pictures.length,1,'Cycling flourish contains one actual source bitmap');
 const entry=sourceArtwork(pictures[0],'Cycling decorative flourish');assert.equal(entry.section,'icons');assert.equal(entry.kind,'cycling');assert.equal(entry.key,'route');
 assert.equal(fingerprint(entry.item.png),fingerprint(atlas.icons.cycling.route.png),'Cycling flourish preserves the exact original artwork with or without GPS data');
}
console.log(`Passed: stat order, missing support metrics, empty activities and exact decorative cycling flourish. Review PNGs: ${artifactDirectory}`);
