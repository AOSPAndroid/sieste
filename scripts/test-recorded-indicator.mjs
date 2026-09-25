import ts from 'typescript';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync('app/recorded-indicator.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export default ','').replaceAll('export ','');
const fn=new Function(source+';return recordedTrend')(),now=new Date('2026-09-20T12:00:00');
const rows=[{date:'20260918',value:100},{date:'20260919',value:101},{date:'20260920',value:1}];
assert.equal(fn(rows,'higher',true,now).tone,'steady');assert.equal(fn(rows,'higher',false,now).tone,'watch');assert.equal(fn(rows,'neutral',false,now).tone,'neutral');
assert.equal(fn([{date:'20260918',value:100},{date:'20260919',value:90}],'lower',false,now).tone,'good');
assert.equal(fn([{date:'20250918',value:100},{date:'20250919',value:90}],'higher',false,now).tone,'missing');assert.equal(fn([{date:'20260919',value:0},{date:'20260920',value:5}],'neutral',false,now).text,'5.0');assert.equal(fn([{date:'20260919',value:null}],'higher',false,now).tone,'missing');console.log('Indicators: partial-day exclusion, small variation, direction, stale data and zero baseline passed.');
