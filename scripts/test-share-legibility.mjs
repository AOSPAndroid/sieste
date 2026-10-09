import assert from 'node:assert/strict';
import sharp from 'sharp';
import {loadShareDesignModule} from './share-design-test-module.mjs';
const {shareCardSvg}=await loadShareDesignModule();
const points=[{x:0,y:0},{x:1,y:.2},{x:.6,y:1},{x:0,y:0}];
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',title:'Paris after hours',sport:'Running',sportFamily:'running',date:'',brand:false,demo:false,route:{points,segments:[points],center:{x:.5,y:.5},zoom:1},stats:[{key:'distance',label:'Distance',value:'13.47',unit:'km'},{key:'duration',label:'Activity time',value:'1:02:18',unit:'h:mm:ss'},{key:'pace',label:'Average pace',value:'4:37',unit:'/km'}]};
async function render(design){const png=await sharp(Buffer.from(shareCardSvg(design))).ensureAlpha().raw().toBuffer({resolveWithObject:true});return png;}
// librsvg rounds dark channels when contrast edges cross filter colour spaces;
// allow that small raster quantization while rejecting a recoloured foreground.
function colouredPixel({data,info},colour){let matches=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>200&&colour.every((value,j)=>Math.abs(data[i+j]-value)<8))matches++;assert.ok(matches>100,'Actual PNG preserves foreground palette');assert.equal(info.channels,4);}
for(const height of [1080,1350,1920]){
 const result=await render({...base,template:'traceheadline',height});assert.equal(result.info.height,height);assert.equal(result.info.width,1080);assert.equal(result.data[3],0,'Top-left remains transparent');assert.equal(result.data.at(-1),0,'Bottom-right remains transparent');colouredPixel(result,[255,255,255]);
}
const clean=await render({...base,template:'routegiant',legibility:'none'}),protectedRoute=await render({...base,template:'routegiant',legibility:'auto'});
let protectedOnly=0;for(let i=3;i<clean.data.length;i+=4)if(clean.data[i]===0&&protectedRoute.data[i]>100)protectedOnly++;
assert.ok(protectedOnly>100,'Export adds real contrast pixels outside route strokes');
for(const accent of ['#990F16','#0B1F5E','#064E3B','#F4D35E']){
 const svg=shareCardSvg({...base,template:'traceheadline',accent});assert.match(svg,/data-share-legibility="auto"/);assert.ok(svg.includes(accent),'Source palette stays unchanged');colouredPixel(await render({...base,template:'traceheadline',accent}),[1,3,5].map(i=>parseInt(accent.slice(i,i+2),16)));
}
for(const template of ['editorial','scorecard','cinematitle','traceposter'])for(const labelMode of ['icons','short','full','none']){
 const svg=shareCardSvg({...base,template,labelMode});assert.ok(svg.toUpperCase().includes('PARIS AFTER HOURS'),template+'/'+labelMode+': authored title survives label settings');assert.ok(!svg.includes('lengthAdjust="spacingAndGlyphs"'),template+': no squeezed native lettering');assert.ok(!/NaN|Infinity/.test(svg));
}
for(const [legibility,edge] of [['dark','dark'],['light','light']])assert.ok(shareCardSvg({...base,template:'route',legibility}).includes('data-share-edge="'+edge+'"'));
assert.ok(!shareCardSvg({...base,template:'route',legibility:'none'}).includes('sharePhotoContrast'));
const opaque=await render({...base,template:'route',transparent:false,legibility:'auto'});assert.equal(opaque.data[3],255,'Opaque mode remains opaque');
const unusual=shareCardSvg({...base,template:'cinematitle',title:'مرحبا 世界 <script>'});assert.ok(!unusual.includes('<script>'));assert.ok(!unusual.includes('lengthAdjust="spacingAndGlyphs"'));
console.log('Passed: exported contrast pixels, foreground palette, three canvas alpha/sizes, clean/manual contrast, authored titles across label modes, natural fallback lettering and opaque mode.');
