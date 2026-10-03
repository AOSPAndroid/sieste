import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';
const {shareCardSvg,shareSolidColours,shareColourContrast}=await loadShareDesignModule();
const templates=['cinemamonolith','cinemaepic','cinemawide','cinemamission','cinemalens','cinemawave'];
const base={height:1350,transparent:true,ink:'white',accent:'#ffffff',title:'Paris Run',sport:'Running',sportFamily:'running',date:'',brand:false,demo:false,route:null,stats:[
 {key:'distance',label:'Distance',value:'10.07',unit:'km'},
 {key:'pace',label:'Average pace',value:'5:01',unit:'/km'},
 {key:'duration',label:'Activity time',value:'51:00',unit:'min:sec'},
 {key:'hr',label:'Average heart rate',value:'147',unit:'bpm'},
 {key:'ascent',label:'Elevation gain',value:'69',unit:'m'},
 {key:'calories',label:'Workout calories',value:'654',unit:'kcal'}
]};
const folder=process.env.SIESTE_TEST_ARTIFACTS??'/tmp/sieste-cinematic-concepts';mkdirSync(folder,{recursive:true});
const previews=[];
for(const template of templates)for(const height of [1080,1350,1920]){
 const design={...base,template,height,showLabels:true,brand:true,date:'3 October 2026'},svg=shareCardSvg(design);
 for(const stat of base.stats)assert.ok(svg.includes(stat.value),`${template}: exact selected ${stat.key}`);
 assert.ok(svg.includes('10.07 KM')||svg.includes('data-cinematic-text="10.07"')&&svg.includes('data-cinematic-text="KM"'));
 assert.ok(!/NaN|Infinity|undefined/.test(svg));
 if(template==='cinemalens'||template==='cinemawave')assert.ok(svg.includes(`data-cinematic-warp="${template==='cinemalens'?'lens':'wave'}"`),'Warp is applied to actual outline coordinates');
 const png=await sharp(Buffer.from(svg)).resize(2160,height*2).png().toBuffer(),metadata=await sharp(png).metadata();
 assert.equal(metadata.width,2160);assert.equal(metadata.height,height*2);assert.ok(metadata.hasAlpha);
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let x=0;x<info.width;x++){assert.equal(data[x*4+3],0,'Top padding');assert.equal(data[((info.height-1)*info.width+x)*4+3],0,'Bottom padding');}
 for(let y=0;y<info.height;y++){assert.equal(data[y*info.width*4+3],0,'Left padding');assert.equal(data[(y*info.width+info.width-1)*4+3],0,'Right padding');}
 assert.ok(data.some((v,i)=>i%4===3&&v>0),'Nonempty vector lettering');
 if(height===1350){
  await sharp(png).toFile(folder+'/'+template+'.png');
  previews.push({input:await sharp(Buffer.from(shareCardSvg({...base,template,transparent:false}))).resize(360,450).png().toBuffer(),left:(previews.length%3)*360,top:Math.floor(previews.length/3)*450});
 }
}
await sharp({create:{width:1080,height:900,channels:4,background:'#181818'}}).composite(previews).png().toFile(folder+'/six-concepts.png');
for(const template of templates){
 for(const featured of [base.stats[1],base.stats[2],{key:'sleep',label:'Sleep today',value:'6h41m',unit:''}]){
  const svg=shareCardSvg({...base,template,stats:[featured,...base.stats.filter(s=>s.key!==featured.key).slice(0,5)]});
  assert.ok(svg.includes(featured.value.toUpperCase()),'Featured values retained exactly');await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
 }
 for(const colour of shareSolidColours.filter(c=>['Blood red','Deep blue','Royal blue','Dark green'].includes(c.name))){
  const svg=shareCardSvg({...base,template,accent:colour.color});assert.ok(svg.includes(`fill="${colour.color}"`));
  assert.equal(shareColourContrast(colour.color),'#ffffff','Dark swatches use a visible white check');
  const opaque=shareCardSvg({...base,template,accent:colour.color,transparent:false});assert.ok(opaque.includes('fill="#fafafa"'),'Dark coloured exports use a light backdrop');
  await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
 }
 for(const finish of ['chrome','iridescent']){const svg=shareCardSvg({...base,template,finish});assert.ok(svg.includes('url(#metalSoft)'));await sharp(Buffer.from(svg)).resize(540).png().toBuffer();const opaque=shareCardSvg({...base,template,finish,transparent:false,ink:'black',accent:'#121826'});assert.ok(opaque.includes('fill="#181818"'),'Metallic lettering retains a dark contrasting backdrop even after choosing black');}
 for(const title of ['A VERY LONG RUN TITLE WITH ACCENTS ÉTÉ À PARIS & FRIENDS','東京 RUN','<script> & "ÉTÉ"']){
  const svg=shareCardSvg({...base,template,title});assert.ok(!svg.includes('<script>'));await sharp(Buffer.from(svg)).resize(540).png().toBuffer();
 }
 const empty=shareCardSvg({...base,template,stats:[]});assert.ok(empty.includes('NO STATS'));await sharp(Buffer.from(empty)).resize(540).png().toBuffer();
}
console.log('Six approved concepts passed: real values, featured pace/time/sleep, all selected stats, three large PNG shapes, alpha and safe edges, dark colours and contrast, metallic finishes, long/escaped/unsupported titles and missing readings.');
