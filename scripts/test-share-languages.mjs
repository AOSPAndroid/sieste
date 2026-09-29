import {readFileSync} from 'node:fs';
import ts from 'typescript';import sharp from 'sharp';import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync('app/share-card-design.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {shareCardSvg}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const base={height:1080,transparent:true,ink:'white',accent:'#ffffff',title:'Morning ride',sport:'Cycling',sportFamily:'cycling',date:'',stats:[{key:'distance',label:'Distance',value:'32.58',unit:'km'},{key:'duration',label:'Time',value:'1h 20m',unit:''}],route:null,brand:false,demo:false};
const tiles=[];
for(const [i,[key,fr,en]] of [['metro','VALIDÉ PAR VOS JAMBES','VALIDATED BY YOUR LEGS'],['sweatreceipt','REMBOURSEMENT : UNE SIESTE','REFUND: ONE NAP'],['excuse','ABSENCE JUSTIFIÉE','EXCUSED ABSENCE']].entries()){
 for(const finish of ['solid','chrome','rainbow'])for(const height of [1080,1350,1920])for(const english of [false,true]){
  const svg=shareCardSvg({...base,template:key+(english?'en':''),finish,height});assert.ok(svg.includes(english?en:fr));assert.ok(!svg.includes(english?fr:en));assert.ok(svg.includes('32.58'));assert.ok(!/NaN|Infinity/.test(svg));
  const png=await sharp(Buffer.from(svg)).png().toBuffer();assert.equal((await sharp(png).metadata()).height,height);assert.equal((await sharp(png).extract({left:0,top:0,width:1,height:1}).raw().toBuffer())[3],0);
  if(finish==='solid'&&height===1080)tiles.push({input:await sharp(png).resize(480,480).flatten({background:'#202631'}).png().toBuffer(),left:english?490:0,top:i*490});
 }
}
await sharp({create:{width:970,height:1460,channels:3,background:'#edf0f4'}}).composite(tiles).png().toFile('C:/Users/adell/Projects/sieste-design-review/language-pairs.png');
console.log('Passed: three French/English pairs, three sizes, three finishes, transparency and unchanged stats.');
