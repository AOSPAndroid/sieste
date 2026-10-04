import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';

const {shareCardSvg,routeStatDesigns,routeStatTemplates,routeTemplates}=await loadShareDesignModule();
const folder=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-route-stats-review');mkdirSync(folder,{recursive:true});
const templates=['traceposter','tracesplit','traceheadline','tracefooter','tracescorecard','tracestamp'];
const stats=[
 {key:'distance',label:'Distance',value:'12.37',unit:'km'},
 {key:'duration',label:'Activity time',value:'1:02:43',unit:'h:mm:ss'},
 {key:'pace',label:'Average pace',value:'5:04',unit:'/km'},
 {key:'hr',label:'Average heart rate',value:'143',unit:'bpm'},
 {key:'ascent',label:'Elevation gain',value:'87',unit:'m'},
 {key:'calories',label:'Workout calories',value:'721',unit:'kcal'}
];
const segments=[[{x:0,y:0},{x:1,y:.18},{x:.92,y:.88},{x:.4,y:1},{x:.1,y:.72}],[{x:.35,y:.4},{x:.06,y:.2}]];
function geometry(segments){const points=segments.flat(),xs=points.map(p=>p.x),ys=points.map(p=>p.y);return {points,segments,center:{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2}};}
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',title:'RIVER LOOP WITH FRIENDS — EVENING TRAINING AFTER THE RAIN',sport:'Running',sportFamily:'running',date:'4 October 2026',brand:true,demo:true,showLabels:true,routeStroke:40,stats,route:geometry(segments)};
const failures=[],measurements=[],tiles=[];let checks=0;
async function check(label,work){try{await work();checks++;}catch(error){failures.push({label,message:error.message});console.error('FAIL '+label+': '+error.message);}}
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const compact=stat=>(stat.value+(stat.unit==='min:sec'||stat.unit==='h:mm:ss'?'':stat.unit==='/km'?'/km':' '+stat.unit)).toUpperCase();
function group(svg,attribute,value){
 const start=svg.indexOf(`<g ${attribute}="${escape(value)}"`);assert.notEqual(start,-1,`Missing ${attribute}=${value}`);
 const tags=/<g\b[^>]*>|<\/g>/g;tags.lastIndex=start;let depth=0,match;
 while((match=tags.exec(svg))){depth+=match[0].startsWith('</')?-1:1;if(depth===0)return svg.slice(start,tags.lastIndex);}
 throw Error('Unclosed SVG group');
}
function routePaths(svg){return [...group(svg,'data-share-route','true').matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\bstroke-width="([^"]+)"[^>]*>/g)].map(m=>({d:m[1],stroke:Number(m[2]),tag:m[0]}));}
function assertStats(svg,ordered){
 assert.deepEqual([...svg.matchAll(/data-share-stat-key="([^"]+)"/g)].map(m=>m[1]),ordered.map(s=>s.key),'Selected stat keys remain in order and occur once');
 for(const stat of ordered)assert.ok(group(svg,'data-share-stat-key',stat.key).includes(`data-cinematic-text="${escape(compact(stat))}"`),`Exact ${stat.key} value and unit`);
 assert.ok(!/NaN|Infinity|undefined/.test(svg));
}
function assertRoute(svg,source=base.route,stroke=40){
 const paths=routePaths(svg);assert.equal(paths.length,source.segments.length,'Recording gaps remain separate paths');
 paths.forEach((path,index)=>{
  assert.equal(path.stroke,stroke);assert.ok(path.tag.includes('stroke-linecap="round"'));assert.ok(path.tag.includes('stroke-linejoin="round"'));
  const projected=[...path.d.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
  assert.equal(projected.length,source.segments[index].length,'Every point is retained in this bounded fixture');
  const input=source.segments[index];
  if(index===0){
   const a=input[0],b=input[1],c=input[3],scaleX=(projected[1].x-projected[0].x)/(b.x-a.x),scaleY=(projected[3].y-projected[0].y)/(c.y-a.y);
   assert.ok(Math.abs(scaleX-scaleY)<.03,`Aspect ratio preserved (${scaleX}, ${scaleY})`);
   projected.forEach((point,i)=>{assert.ok(Math.abs(point.x-(projected[0].x+(input[i].x-a.x)*scaleX))<.03);assert.ok(Math.abs(point.y-(projected[0].y+(input[i].y-a.y)*scaleX))<.03);});
  }
 });
}
function safeEdges(data,info,label){
 for(let x=0;x<info.width;x++){assert.equal(data[x*4+3],0,label+' top padding');assert.equal(data[((info.height-1)*info.width+x)*4+3],0,label+' bottom padding');}
 for(let y=0;y<info.height;y++){assert.equal(data[y*info.width*4+3],0,label+' left padding');assert.equal(data[(y*info.width+info.width-1)*4+3],0,label+' right padding');}
 assert.ok(data.some((value,index)=>index%4===3&&value>0),'PNG contains visible content');
}
function bounds(data,info){let left=info.width,top=info.height,right=-1,bottom=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}assert.ok(right>=left,'Group has visible pixels');return {left,top,right,bottom};}
function wrap(svg,content,height){const defs=(svg.match(/<defs>[\s\S]*?<\/defs>/g)??[]).join('');return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}">${defs}${content}</svg>`;}
async function separated(svg,design,label){
 const route=await sharp(Buffer.from(wrap(svg,group(svg,'data-share-route','true'),design.height))).ensureAlpha().raw().toBuffer({resolveWithObject:true}),routeBox=bounds(route.data,route.info);
 for(const stat of design.stats){
  const isolated=await sharp(Buffer.from(wrap(svg,group(svg,'data-share-stat-key',stat.key),design.height))).ensureAlpha().raw().toBuffer({resolveWithObject:true}),statBox=bounds(isolated.data,isolated.info);
  assert.ok(routeBox.right<statBox.left||statBox.right<routeBox.left||routeBox.bottom<statBox.top||statBox.bottom<routeBox.top,`${label}: route bounds overlap ${stat.key}: ${JSON.stringify({routeBox,statBox})}`);
 }
 measurements.push({label,routeBox});
}

await check('registry',()=>{assert.deepEqual(routeStatTemplates,templates);for(const t of templates)assert.ok(routeTemplates.includes(t));assert.equal(routeStatDesigns.length,6);});
for(const template of templates)for(const height of [1080,1350,1920])await check(`${template} / ${height}`,async()=>{
 const design={...base,template,height},svg=shareCardSvg(design);assertStats(svg,stats);assertRoute(svg);
 const png=await sharp(Buffer.from(svg)).resize(2160,height*2).png().toBuffer(),metadata=await sharp(png).metadata();assert.equal(metadata.width,2160);assert.equal(metadata.height,height*2);assert.ok(metadata.hasAlpha);
 await separated(svg,design,`${template}/${height}`);
 if(height===1350){await sharp(png).toFile(`${folder}/${template}-2160.png`);const preview=shareCardSvg({...base,template,height,routeStroke:28,title:routeStatDesigns.find(d=>d.key===template).name+' · SYNTHETIC EXAMPLE',transparent:false});tiles.push({input:await sharp(Buffer.from(preview)).resize(360,450).png().toBuffer(),left:(templates.indexOf(template)%3)*360,top:Math.floor(templates.indexOf(template)/3)*450});}
 const raw=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});safeEdges(raw.data,raw.info,template);
});
if(tiles.length===6)await sharp({create:{width:1080,height:900,channels:4,background:'#181818'}}).composite(tiles).png().toFile(folder+'/six-route-stats.png');
for(const template of templates){
 for(let count=1;count<=6;count++)await check(`${template} / ${count} ordered stats`,()=>{const ordered=[stats[2],stats[1],stats[0],...stats.slice(3)].slice(0,count);assertStats(shareCardSvg({...base,template,stats:ordered}),ordered);});
 for(const stroke of [12,40,-100,100,NaN,undefined])await check(`${template} / stroke ${stroke}`,()=>{const expected=Number.isFinite(stroke)?Math.max(12,Math.min(40,stroke)):28;assertRoute(shareCardSvg({...base,template,routeStroke:stroke}),base.route,expected);});
 await check(`${template} / title escaping and no GPS`,()=>{const svg=shareCardSvg({...base,template,title:'<script> & "ÉTÉ" — 東京 RUN',route:null});assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;SCRIPT&gt;'));assert.equal(routePaths(svg).length,0,'Missing GPS does not invent route paths');assert.ok(group(svg,'data-share-route','true').includes('NO RECORDED ROUTE'));assertStats(svg,stats);});
 for(const accent of ['#0B1F5E','#F3E8D0'])await check(`${template} / colour ${accent}`,async()=>{const svg=shareCardSvg({...base,template,accent,transparent:false});assert.ok(routePaths(svg).every(path=>path.tag.includes(`stroke="${accent}"`)));assertStats(svg,stats);const raw=await sharp(Buffer.from(svg)).resize(270).ensureAlpha().raw().toBuffer();assert.equal(raw[3],255);});
 for(const finish of ['chrome','gold'])await check(`${template} / finish ${finish}`,async()=>{const svg=shareCardSvg({...base,template,finish,ink:'black',accent:'#121826',transparent:false});assert.ok(svg.includes('<rect width="1080" height="1080" fill="#181818"'));assert.ok(routePaths(svg).every(path=>path.tag.includes('stroke="url(#finishStroke)"')));assertStats(svg,stats);await sharp(Buffer.from(svg)).resize(270).png().toBuffer();});
}
const examples=[['wide','traceposter',4,1],['wide','tracesplit',4,1],['tall','tracestamp',1,4],['tall','traceheadline',1,4]],geometryTiles=[];
for(const [index,[shape,template,sx,sy]] of examples.entries())await check(`${template} / ${shape} geometry`,async()=>{
 const route=geometry(segments.map(segment=>segment.map(point=>({x:point.x*sx,y:point.y*sy})))),design={...base,template,height:1350,route,title:`${shape.toUpperCase()} GPS · SYNTHETIC EXAMPLE`},svg=shareCardSvg(design);
 assertRoute(svg,route);await separated(svg,design,`${template}/${shape}`);const png=await sharp(Buffer.from(svg)).resize(540).png().toBuffer();await sharp(png).toFile(`${folder}/${template}-${shape}.png`);
 geometryTiles.push({input:await sharp(Buffer.from(shareCardSvg({...design,transparent:false}))).resize(360,450).png().toBuffer(),left:(index%2)*360,top:Math.floor(index/2)*450});
});
if(geometryTiles.length===4)await sharp({create:{width:720,height:900,channels:4,background:'#181818'}}).composite(geometryTiles).png().toFile(folder+'/wide-tall-routes.png');
await check('legacy route-only default',()=>{const svg=shareCardSvg({...base,template:'routegiant',routeStroke:undefined,stats:[],brand:false,demo:false});assert.ok(svg.includes('stroke-width="16"'));assert.ok(!svg.includes('data-share-stat-key='));});
writeFileSync(folder+'/results.json',JSON.stringify({checks,failures,measurements},null,2)+'\n');
console.log(`Route stats: ${checks} checks passed, ${failures.length} failures. Artifacts: ${folder}`);
assert.equal(failures.length,0,'Focused route/stat verification failed; inspect results.json');
