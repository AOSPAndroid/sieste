import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';
const {shareCardSvg,routeTemplates}=await loadShareDesignModule();
assert.ok(routeTemplates.includes('routegiant'));
const segments=[[{x:0,y:0},{x:1,y:.2},{x:.9,y:1}],[{x:.4,y:.8},{x:.1,y:.4}]],points=segments.flat();
const base={template:'routegiant',height:1080,transparent:true,ink:'white',accent:'#fb923c',title:'A route with no summary readings',sport:'Running',brand:false,demo:false,stats:[],date:'',route:{points,segments,center:{x:.5,y:.5}}};
const directory=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-route-giant');mkdirSync(directory,{recursive:true});
for(const height of [1080,1350,1920]){
 const svg=shareCardSvg({...base,height});
 const paths=[...svg.matchAll(/<path d="([^"]+)" fill="none" stroke="([^"]+)" stroke-width="([^"]+)"/g)];
 assert.equal(paths.length,2,'Recording gaps remain separate paths');assert.ok(paths.every(p=>p[2]==='#fb923c'&&Number(p[3])===16));
 const projected=paths[0][1].split(' ').map(p=>p.slice(1).split(',').map(Number));
 assert.ok(Math.abs((projected[1][1]-projected[0][1])/(projected[1][0]-projected[0][0])-.2)<.001,'Projection preserves the recorded aspect ratio');
 assert.ok(Math.max(...projected.map(p=>p[0]))-Math.min(...projected.map(p=>p[0]))>980,'Route is genuinely oversized');
 assert.ok(!svg.includes('<text'),'Trace-only exports have no stat clutter');assert.ok(!/NaN|Infinity|undefined/.test(svg));
 const png=await sharp(Buffer.from(svg)).resize(2160,height*2).png().toBuffer(),metadata=await sharp(png).metadata();assert.equal(metadata.width,2160);assert.equal(metadata.height,height*2);assert.ok(metadata.hasAlpha);
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let x=0;x<info.width;x++){assert.equal(data[x*4+3],0);assert.equal(data[((info.height-1)*info.width+x)*4+3],0)}
 for(let y=0;y<info.height;y++){assert.equal(data[(y*info.width)*4+3],0);assert.equal(data[(y*info.width+info.width-1)*4+3],0)}
 assert.ok(data.some((value,index)=>index%4===3&&value>0),'The PNG contains a route even without stats');
 if(height===1080)await sharp(png).toFile(join(directory,'oversized-trace-2160.png'));
 for(const finish of ['chrome','rainbow']){const finished=shareCardSvg({...base,height,finish});assert.match(finished,/stroke="url\(#finishStroke\)"/);await sharp(Buffer.from(finished)).resize(540).png().toBuffer()}
}
for(const routeStroke of [4,28,-100,100,NaN]){const svg=shareCardSvg({...base,routeStroke});assert.ok(!/NaN|Infinity/.test(svg));assert.ok([...svg.matchAll(/stroke-width="([^"]+)"/g)].every(p=>Number(p[1])>=4&&Number(p[1])<=28))}
const opaque=await sharp(Buffer.from(shareCardSvg({...base,transparent:false}))).ensureAlpha().raw().toBuffer();assert.equal(opaque[3],255);
assert.ok(!shareCardSvg({...base,route:null}).includes('<path'),'Missing GPS does not invent a trace');
console.log('Oversized traces: three PNG formats, aspect ratio, GPS gaps, route-only export without stats, safe transparent edges, colour, finishes, stroke bounds and missing GPS passed.');
