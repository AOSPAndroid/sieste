import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

function moduleUrl(name){const extension=existsSync(new URL('../app/'+name+'.tsx',import.meta.url))?'.tsx':'.ts';let compiled=ts.transpileModule(readFileSync(new URL('../app/'+name+extension,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime'))).replace("'recharts'",JSON.stringify(import.meta.resolve('recharts'))).replace("'react'",JSON.stringify(import.meta.resolve('react')));compiled=compiled.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(compiled).toString('base64')}
const {default:Chart}=await import(moduleUrl('compact-load-chart'));
const rows=[
 {iso:'2026-09-01',label:'1 Sept',value:0,sessions:0},
 {iso:'2026-09-02',label:'2 Sept',value:null,sessions:1},
 {iso:'2026-09-03',label:'3 Sept',value:18,sessions:2},
];
const render=(list,baseline=null)=>renderToStaticMarkup(createElement(Chart,{model:{rows:list,baseline,today:list.at(-1),recent:[list[0]],unit:'points'},onHover:()=>{}}));
const html=render(rows,30);
assert.match(html,/1 Sept: 0 points/);
assert.match(html,/2 Sept: Missing reading/);
assert.match(html,/3 Sept: 18 points · training so far/);
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
const {default:ExpandedChart}=await import(moduleUrl('load-chart'));
let hovered;
const expanded=ExpandedChart({model:{rows,baseline:30,today:rows.at(-1),recent:[rows[0]]},large:true,layers:['value'],onHover:row=>{hovered=row}});
expanded.props.children.props.onMouseMove({activeTooltipIndex:'1'});
assert.equal(hovered,rows[1],'Expanded hover selects the actual daily row');
expanded.props.children.props.onMouseLeave();
assert.equal(hovered,null,'Leaving the chart restores the default readout');
console.log('Expanded chart: Recharts 3 hover index and readout reset passed.');

const {loadOverlays,formatLoadOverlay}=await import(moduleUrl('load-chart-series'));
const recoveryRows=rows.map((row,i)=>({...row,short:null,long:null,minutes:[300,null,0][i],sleep:[6.5,null,11][i],hrv:[180,170,null][i]}));
const model={rows:recoveryRows,baseline:30,today:recoveryRows.at(-1),recent:[recoveryRows[0]],unit:'points'};
const scales=loadOverlays(model);assert.deepEqual(scales.map(series=>[series.key,series.ceiling]),[['minutes',300],['sleep',12],['hrv',180]],'Independent scales expand to cover long rides and higher sleep/HRV readings');
const recoverySvg=renderToStaticMarkup(createElement(Chart,{model,onHover:()=>{}}));
assert.equal((recoverySvg.match(/data-series=/g)??[]).length,3,'All recovery and time lines are visible by default');
assert.match(recoverySvg,/Time 5h 0m/);assert.match(recoverySvg,/Sleep 6h30/);assert.match(recoverySvg,/HRV 180 ms/);
assert.match(recoverySvg,/data-series="sleep"><path d="M[^"L]+M/,'Missing sleep splits the line instead of connecting the gap');
assert.equal((recoverySvg.match(/<circle/g)??[]).length,6,'Isolated valid readings remain visible as dots');
const noSleep=renderToStaticMarkup(createElement(Chart,{model,layers:['value','hrv','minutes'],onHover:()=>{}}));assert.doesNotMatch(noSleep,/data-series="sleep"/);assert.match(noSleep,/data-series="hrv"/);
assert.deepEqual(loadOverlays({...model,unit:'min'}).map(series=>series.key),['sleep','hrv'],'Training time mode avoids a duplicate time overlay');
assert.equal(formatLoadOverlay('sleep',401/60),'6h41');assert.equal(formatLoadOverlay('hrv',null),'—');
const enriched=ExpandedChart({model,large:true,layers:['value','minutes','sleep','hrv'],onHover:()=>{}});
const children=enriched.props.children.props.children.flat(Infinity).filter(Boolean),overlayLines=children.filter(child=>['minutes','sleep','hrv'].includes(child.props?.dataKey));
assert.equal(overlayLines.length,3);for(const line of overlayLines){assert.equal(line.props.yAxisId,line.props.dataKey);assert.equal(line.props.connectNulls,false);const axis=children.find(child=>child.props?.yAxisId===line.props.dataKey&&Array.isArray(child.props.domain));assert.deepEqual(axis.props.domain,[0,scales.find(series=>series.key===line.props.dataKey).ceiling]);}
console.log('Overlay charts passed: separate expanding scales, real same-day values, independent gaps, isolated dots, toggles, time-mode deduplication and expanded axis assignment.');
