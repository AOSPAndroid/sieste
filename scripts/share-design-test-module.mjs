import {readFileSync} from 'node:fs';
import ts from 'typescript';
const modules=new Map();
function moduleUrl(name){
 if(modules.has(name))return modules.get(name);
 const json=name.endsWith('.json');
 let source=json?'export default '+readFileSync(new URL('../app/'+name,import.meta.url),'utf8'):ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 if(!json)source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dependency)=>`from "${moduleUrl(dependency)}"`);
 const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');modules.set(name,url);return url;
}
export const loadShareDesignModule=()=>import(moduleUrl('share-card-design'));
