import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const source=readFileSync(new URL('../app/compact-load-chart.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const {default:Chart}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const rows=[
 {iso:'2026-09-01',label:'1 Sept',value:0,sessions:0},
 {iso:'2026-09-02',label:'2 Sept',value:null,sessions:1},
 {iso:'2026-09-03',label:'3 Sept',value:18,sessions:2},
];
const render=(list,baseline=null)=>renderToStaticMarkup(createElement(Chart,{model:{rows:list,baseline,today:list.at(-1),recent:[list[0]],unit:'points'},onHover:()=>{}}));
const html=render(rows,30);
assert.match(html,/1 Sept: 0 points/);
assert.match(html,/2 Sept: Missing reading/);
assert.match(html,/3 Sept: 18 points · so far/);
assert.equal((html.match(/tabindex="0"/g)??[]).length,3,'Every day remains keyboard accessible');
assert.equal((html.match(/rx="3"/g)??[]).length,2,'Unknown readings are gaps; zero remains recorded');
assert.match(html,/stroke-dasharray="4 4"/,'Usual level is retained even above all bars');
assert.match(html,/stroke-dasharray="3 2"/,'Today keeps a partial outline');
for(const list of [rows.map(r=>({...r,value:0})),rows.map(r=>({...r,value:null})),rows.map(r=>({...r,value:.1}))]){
 const svg=render(list);
 assert.ok(!/NaN|Infinity/.test(svg),'Empty and fractional data produce finite coordinates');
 for(const height of svg.matchAll(/height="(-?[\d.]+)"/g))assert.ok(Number(height[1])>=0);
}
console.log('Compact overview chart: known zero, missing gaps, partial today, baseline scale, keyboard access and finite geometry passed.');

// Recharts 3 exposes an active index, rather than the old activePayload field.
const expandedSource=readFileSync(new URL('../app/load-chart.tsx',import.meta.url),'utf8');
const expandedCompiled=ts.transpileModule(expandedSource,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace("'recharts'",JSON.stringify(import.meta.resolve('recharts')));
const {default:ExpandedChart}=await import('data:text/javascript;base64,'+Buffer.from(expandedCompiled).toString('base64'));
let hovered;
const expanded=ExpandedChart({model:{rows,baseline:30,today:rows.at(-1),recent:[rows[0]]},large:true,layers:['value'],onHover:row=>{hovered=row}});
expanded.props.children.props.onMouseMove({activeTooltipIndex:'1'});
assert.equal(hovered,rows[1],'Expanded hover selects the actual daily row');
expanded.props.children.props.onMouseLeave();
assert.equal(hovered,null,'Leaving the chart restores the default readout');
console.log('Expanded chart: Recharts 3 hover index and readout reset passed.');
