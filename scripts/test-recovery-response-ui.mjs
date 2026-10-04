import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync(new URL('../app/recovery-response.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/^import .*;\s*$/mg,'').replace(/export default /g,'').replace(/^export /gm,'');
const jsx=(type,props)=>({type,props}),dialogs=[];
const Component=new Function('useMemo','useExpand','recoveryResponse','clockLabel','ArrowUpRight','_jsx','_jsxs','_Fragment',source+';return RecoveryResponse;')(fn=>fn(),()=>({widget:(title,body)=>dialogs.push({title,body})}),data=>data,n=>String(n),()=>null,jsx,jsx,Symbol.for('fragment'));
const text=node=>node===null||node===undefined||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);
const child=(node,type)=>[].concat(node.props.children).find(v=>v?.type===type);
const render=data=>Component({data,end:'2026-10-04'}).props.children;
const morning=(normal,date)=>({date,normal,hrv:normal===null?null:normal?90:65,rhr:normal===null?null:normal?50:60,sleep:8,trainingBefore:false});
const hard=(date,normals,observed)=>({date,load:200,mornings:normals.map((v,i)=>morning(v,`${date}-${i}`)),observed});
const group=(late,count,hoursCount,value)=>({late,count,hours:{count:hoursCount,value},bed:{count,value:1380},hrv:{count,value:90}});
const groups=()=>[group(true,9,3,7.2),group(false,8,4,7.5)];

// One observed return, one fully observed day that remains outside range, and
// one incomplete day: unknown follow-up must not inflate the denominator.
let buttons=render({hard:[hard('2026-09-28',[false,true,null],2),hard('2026-09-29',[false,false,false],null),hard('2026-09-30',[false,null,true],null)],groups:groups()});
assert.equal(text(child(buttons[0],'strong')),'1/2 in range by +3');
assert.equal(text(buttons[0].props.children.at(-1)),'HRV + RHR · 1 incomplete');
assert.equal(text(buttons[1].props.children.at(-1)),'3 late / 4 earlier nights','Sleep comparison reports sleep-reading counts, not broader cohort totals');
assert.equal(text(child(buttons[1],'strong')),'−18 min sleep');

// No known follow-up is unknown; no qualifying high-load history is distinct.
buttons=render({hard:[hard('2026-10-03',[null,null,null],null)],groups:groups()});
assert.equal(text(child(buttons[0],'strong')),'Awaiting readings');
assert.equal(text(buttons[0].props.children.at(-1)),'HRV + RHR · 1 incomplete');
buttons=render({hard:[],groups:groups()});
assert.equal(text(child(buttons[0],'strong')),'Building history');
assert.equal(text(buttons[0].props.children.at(-1)),'HRV + RHR');

// Fully observed mornings outside range remain an assessed failure, not an
// awaiting-data state, even when there are zero observed returns.
buttons=render({hard:[hard('2026-09-29',[false,false,false],null)],groups:groups()});
assert.equal(text(child(buttons[0],'strong')),'0/1 in range by +3');
assert.doesNotMatch(text(buttons[0]),/Awaiting|incomplete/);

// A small negative difference rounds to negative zero in JS. Display zero
// without a minus sign or direction marker.
const tiny=[group(true,9,3,7.499),group(false,8,4,7.5)];
buttons=render({hard:[],groups:tiny});
assert.equal(text(child(buttons[1],'strong')),'0 min sleep');
assert.doesNotMatch(text(child(buttons[1],'strong')),/[+−\-↑↓]/);

// Missing group means retain the insufficient-data state and actual samples.
buttons=render({hard:[],groups:[group(true,5,2,null),group(false,8,4,7.5)]});
assert.equal(text(child(buttons[1],'strong')),'Building comparison');
assert.equal(text(buttons[1].props.children.at(-1)),'2 late / 4 earlier nights');

// Existing dialog callbacks remain connected and explain the observation
// denominator and the unadjusted sleep comparison.
buttons[0].props.onClick();buttons[1].props.onClick();
assert.deepEqual(dialogs.map(d=>d.title),['After high-load days','Late training → sleep']);
assert.match(text(dialogs[0].body),/three known mornings/);
assert.match(text(dialogs[1].body),/unadjusted association/);
console.log('Recovery response UI passed: assessed denominator, incomplete/history states, sleep sample counts, negative-zero formatting, missing means and drilldowns.');
