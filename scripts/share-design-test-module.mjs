import {readFileSync,writeFileSync,mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import sharp from 'sharp';
const modules=new Map();
const directory=mkdtempSync(join(tmpdir(),'sieste-share-modules-'));
process.once('exit',()=>rmSync(directory,{recursive:true,force:true}));
function moduleUrl(name){
 if(modules.has(name))return modules.get(name);
 const file=join(directory,name.replace(/[^\w.-]/g,'_')+'.mjs'),url=pathToFileURL(file).href;
 modules.set(name,url);
 const json=name.endsWith('.json');
 let source=json?'export default '+readFileSync(new URL('../app/'+name,import.meta.url),'utf8'):ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 if(!json)source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dependency)=>`from "${moduleUrl(dependency)}"`).replace(/import\(['"]\.\/([^'"]+)['"]\)/g,(_,dependency)=>`import("${moduleUrl(dependency)}")`);
 writeFileSync(file,source);return url;
}
const fixtureImages=new Map();
export async function readShareAsset(path){
 path=path.split('?')[0];
 const file=new URL('../public'+path,import.meta.url);
 if(path.endsWith('.json'))return JSON.parse(readFileSync(file,'utf8'));
 if(!fixtureImages.has(path))fixtureImages.set(path,sharp(readFileSync(file)).png().toBuffer().then(bytes=>'data:image/png;base64,'+bytes.toString('base64')));
 return fixtureImages.get(path);
}
export function shareFontFixtures(){
 return Object.fromEntries(readdirSync(new URL('../public/share-assets/fonts',import.meta.url)).filter(file=>file.startsWith('display-')).map(file=>[file.slice(8,-5),JSON.parse(readFileSync(new URL('../public/share-assets/fonts/'+file,import.meta.url),'utf8'))]));
}
export async function approvedArtFixtures(){
 const atlas=JSON.parse(readFileSync(new URL('../app/original-share-art.json',import.meta.url),'utf8'));
 for(const section of ['glyphs','groups','icons'])for(const items of Object.values(atlas[section]))for(const item of Object.values(items)){
  item.png=await readShareAsset(item.png);item.faceMask=await readShareAsset(item.faceMask);
 }
 return atlas;
}
export async function loadShareDesignModule({preload=true,reader=readShareAsset}={}){
 const assets=await import(moduleUrl('share-assets'));assets.setShareAssetReader(reader);
 const module=await import(moduleUrl('share-card-design'));
 if(preload){
  await Promise.all(readdirSync(new URL('../public/share-assets/fonts',import.meta.url)).map(file=>assets.loadShareAsset('/share-assets/fonts/'+file)));
  const atlas=JSON.parse(readFileSync(new URL('../app/original-share-art.json',import.meta.url),'utf8'));
  await Promise.all(['running','cycling','recovery'].map(kind=>assets.loadShareAsset('/share-assets/art/'+kind+'.json')));
  await Promise.all([...new Set(['glyphs','groups','icons'].flatMap(section=>Object.values(atlas[section]).flatMap(items=>Object.values(items).flatMap(item=>[item.png,item.faceMask]))))].map(assets.loadShareAsset));
  const base={height:1080,transparent:true,ink:'white',accent:'#fff',title:'Test',sport:'Running',stats:[],route:null,brand:false,demo:false};
  await Promise.all(['refhero','approvedrun','retrohero'].map(template=>module.renderShareCardSvg({...base,template})));
 }
 return module;
}
