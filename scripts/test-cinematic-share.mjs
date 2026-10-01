import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';
const {shareCardSvg}=await loadShareDesignModule();
const glyphs=JSON.parse(readFileSync(new URL('../app/share-display-glyphs.json',import.meta.url),'utf8'));
for(const face of Object.values(glyphs))for(const glyph of Object.values(face.glyphs)){
 assert.equal(glyph.length,6);
 assert.ok(glyph.slice(0,5).every(Number.isFinite));
 assert.ok(glyph[0]>0);
 assert.equal(typeof glyph[5],'string');
}
const points=[{x:0,y:0},{x:1,y:.2},{x:.7,y:1},{x:.2,y:.8},{x:0,y:0}];
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',title:"L'ÉTÉ À PARIS",sport:'Running',sportFamily:'running',weekday:'Thursday',date:'1 October 2026',brand:false,demo:false,
 stats:[{key:'distance',label:'Distance',value:'10.04',unit:'km'},{key:'pace',label:'Average pace',value:'5:12',unit:'/km'},{key:'duration',label:'Activity time',value:'52:15',unit:'min:sec'},{key:'ascent',label:'Elevation gain',value:'63',unit:'m'},{key:'calories',label:'Workout calories',value:'634',unit:'kcal'},{key:'hr',label:'Average heart rate',value:'140',unit:'bpm'}],
 route:{points,segments:[points],center:{x:.5,y:.5}},
};
const directory=process.env.SIESTE_TEST_ARTIFACTS??join(tmpdir(),'sieste-cinematic-share');mkdirSync(directory,{recursive:true});
const templates=['cinemabig','cinemaday','cinematitle','cinematrace','cinemaserif','cinemastack'];
for(const template of templates)for(const height of [1080,1350,1920]){
 const design={...base,template,height,route:template==='cinematrace'?base.route:null};
 const svg=shareCardSvg(design);
 assert.ok(svg.includes('data-cinematic-face='),'Headlines use self-contained outline glyphs');
 assert.ok(svg.includes(template==='cinemaserif'?'10.04 km':'10.04 KM'),'Recorded distance is preserved');
 assert.ok(svg.includes('5:12'),'Recorded pace is preserved');
 assert.ok(!/NaN|Infinity|undefined|<script>/.test(svg));
 const png=await sharp(Buffer.from(svg)).resize(2160,height*2).png().toBuffer();
 const metadata=await sharp(png).metadata();assert.equal(metadata.width,2160);assert.equal(metadata.height,height*2);assert.ok(metadata.hasAlpha);
 const raw=await sharp(png).ensureAlpha().raw().toBuffer();const w=metadata.width,h=metadata.height;
 for(let x=0;x<w;x++){assert.equal(raw[x*4+3],0,'Top edge has safe padding');assert.equal(raw[((h-1)*w+x)*4+3],0,'Bottom edge has safe padding');}
 for(let y=0;y<h;y++){assert.equal(raw[(y*w)*4+3],0,'Left edge has safe padding');assert.equal(raw[(y*w+w-1)*4+3],0,'Right edge has safe padding');}
 assert.ok(raw.some((value,index)=>index%4===3&&value>0),'PNG contains visible lettering');
 if(height===1080)await sharp(png).toFile(join(directory,template+'-2160.png'));
 for(const finish of ['chrome','iridescent']){
  const finished=shareCardSvg({...design,finish});
  assert.match(finished,/url\(#metalSoft\)/);
  await sharp(Buffer.from(finished)).resize(540).png().toBuffer();
 }
 const opaque=await sharp(Buffer.from(shareCardSvg({...design,transparent:false,ink:'black',accent:'#121826'}))).ensureAlpha().raw().toBuffer();assert.equal(opaque[3],255);
 const empty=shareCardSvg({...design,stats:[],title:'No recorded session'});assert.ok(!/NaN|Infinity|undefined/.test(empty));await sharp(Buffer.from(empty)).resize(540).png().toBuffer();
}
const escaped=shareCardSvg({...base,template:'cinematitle',title:'<script> & "long title" À PARIS WITH SIXTY CHARACTERS'});
assert.ok(!escaped.includes('<script>'));assert.match(escaped,/&lt;SCRIPT&gt;/);
const fallback=shareCardSvg({...base,template:'cinematitle',title:'東京 RUN'});assert.ok(fallback.includes('東京 RUN'),'Unsupported scripts remain readable rather than disappearing');
console.log('Cinematic PNGs: six layouts, three shapes, 2160px exports, vector headline glyphs, exact readings, accent/escaping support, unsupported-script fallback, transparency, safe edges, metallic finishes and missing stats passed.');
