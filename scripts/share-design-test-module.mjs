import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const modules=new Map();
const directory=mkdtempSync(join(tmpdir(),'sieste-share-modules-'));
process.once('exit',()=>rmSync(directory,{recursive:true,force:true}));
function moduleUrl(name){
 if(modules.has(name))return modules.get(name);
 const file=join(directory,name.replace(/[^\w.-]/g,'_')+'.mjs'),url=pathToFileURL(file).href;
 modules.set(name,url);
 const json=name.endsWith('.json');
 let source=json?'export default '+readFileSync(new URL('../app/'+name,import.meta.url),'utf8'):ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 if(!json)source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dependency)=>`from "${moduleUrl(dependency)}"`);
 writeFileSync(file,source);return url;
}
export const loadShareDesignModule=()=>import(moduleUrl('share-card-design'));
