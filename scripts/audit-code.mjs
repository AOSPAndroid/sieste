import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const roots=['app','components','hooks','lib','db'];
const applicationSources=roots.flatMap(root=>{
 try{return readdirSync(root,{recursive:true}).filter(p=>/\.(tsx?|css)$/.test(p)).map(p=>root+'/'+p)}catch{return []}
});
// These are deliberate build/database/example entries rather than web routes.
const toolingEntries=['drizzle.config.ts','vite.config.ts','next.config.ts','postcss.config.mjs','eslint.config.mjs','examples/d1/app/api/notes/route.ts'].filter(file=>{try{readFileSync(file);return true}catch{return false}});
const toolingSources=['build/sites-vite-plugin.ts','examples/d1/db/schema.ts'].filter(file=>{try{readFileSync(file);return true}catch{return false}});
const files=[...new Set([...applicationSources,...toolingEntries,...toolingSources])];
const available=new Set(files),edges=new Map();
function resolve(from,specifier){
 const base=specifier.startsWith('@/')?specifier.slice(2):specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(from),specifier)):null;
 if(!base)return null;
 return [base,...['.ts','.tsx','.css','/index.ts','/index.tsx'].map(extension=>base+extension)].find(p=>available.has(p));
}
for(const file of files){
 const source=readFileSync(file,'utf8'),imports=[];
 if(file.endsWith('.css')){
  for(const match of source.matchAll(/@import\s+["']([^"']+)/g))imports.push(match[1]);
 }else{
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  function walk(node){
   if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
   if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(node.arguments[0]))imports.push(node.arguments[0].text);
   ts.forEachChild(node,walk);
  }
  walk(ast);
 }
 edges.set(file,imports.map(specifier=>resolve(file,specifier)).filter(Boolean));
}
const entries=files.filter(p=>/^app\/(?:.*\/)?(?:page|layout|route|loading|error|not-found|global-error)\.tsx?$/.test(p));
function reachableFrom(entries){
 const reachable=new Set();
 function visit(file){if(reachable.has(file))return;reachable.add(file);for(const dependency of edges.get(file)??[])visit(dependency)}
 entries.forEach(visit);return reachable;
}
const reachable=reachableFrom(entries),tooling=reachableFrom(toolingEntries);
console.log(JSON.stringify({
 note:'Static reachability, including type imports and literal dynamic imports. Build/database/example entries are reported separately. Review candidates against tests, migrations and external tooling before deletion.',
 entries:entries.length,sourceFiles:files.length,reachable:reachable.size,
 toolingOnly:files.filter(file=>!reachable.has(file)&&tooling.has(file)),
 reviewCandidates:files.filter(file=>!reachable.has(file)&&!tooling.has(file)),
},null,2));
