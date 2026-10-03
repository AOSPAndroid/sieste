import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {jsx,jsxs} from 'react/jsx-runtime';
import {BatteryLow,ChevronRight} from 'lucide-react';

process.env.TZ='UTC';
const modules=new Map();
function moduleUrl(name){
 if(modules.has(name))return modules.get(name);
 let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);
 const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');modules.set(name,url);return url;
}
const {dailyRecoveryAlert}=await import(moduleUrl('daily-recovery-alert'));
const now=new Date('2026-10-03T12:00:00Z');
const stamp=date=>`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
function make(end=now){
 const data={activities:[],sleep:{},hrv:{},extra:{bodyvalues:{bodyvalues:[]}}};
 for(let i=0;i<35;i++){
  const date=new Date(end);date.setDate(date.getDate()-i);date.setMinutes(date.getMinutes()-1);
  const key=stamp(date);data.sleep[key]=[8*3600];data.hrv[key]=[90,90,79,101];data.extra.bodyvalues.bodyvalues.push({timestamp:date.toISOString(),hrRestDynamic:50});
 }
 const key=stamp(end);data.sleep[key]=[6*3600+41*60];data.hrv[key][0]=68;data.extra.bodyvalues.bodyvalues[0].hrRestDynamic=55;
 return data;
}
let data=make(),alert=dailyRecoveryAlert(data,now);
assert.equal(alert.tone,'orange');assert.equal(alert.date,'2026-10-03');
assert.deepEqual(alert.signals.map(signal=>[signal.key,signal.value,signal.status.tone]),[['sleep',401/60,'orange'],['hrv',68,'orange'],['rhr',55,'orange']]);
assert.match(alert.advice,/easy or take a rest day/);
assert.equal(dailyRecoveryAlert(data,now,1),null,'Historical periods must not carry today’s advice');

for(const key of ['sleep','hrv','rhr']){
 data=make();if(key==='rhr')data.extra.bodyvalues.bodyvalues.shift();else delete data[key]['20261003'];
 assert.equal(dailyRecoveryAlert(data,now),null,'An older '+key+' reading must not substitute for today');
 data=make();if(key==='rhr')data.extra.bodyvalues.bodyvalues[0].hrRestDynamic=0;else data[key]['20261003'][0]=0;
 assert.equal(dailyRecoveryAlert(data,now),null,'Invalid '+key+' suppresses the alert');
}
data=make();data.hrv['20261003'][0]=80;assert.equal(dailyRecoveryAlert(data,now),null,'Within-range HRV decline is not adverse');
data=make();data.sleep['20261003'][0]=7*3600;assert.equal(dailyRecoveryAlert(data,now),null,'Yellow sleep is not an amber/red flag');
data=make();data.hrv={'20261003':[68]};assert.equal(dailyRecoveryAlert(data,now),null,'An insufficient HRV baseline remains neutral');
data=make();data.extra.bodyvalues.bodyvalues=data.extra.bodyvalues.bodyvalues.slice(0,2);assert.equal(dailyRecoveryAlert(data,now),null,'An insufficient RHR baseline remains neutral');

data=make();data.extra.bodyvalues.bodyvalues[0].timestamp='2026-10-03T13:00:00Z';assert.equal(dailyRecoveryAlert(data,now),null,'A future RHR does not count as today’s reading');
data=make();data.extra.bodyvalues.bodyvalues.push({timestamp:'2026-10-03T13:00:00Z',hrRestDynamic:100});data.hrv['20261004']=[1,90,79,101];data.sleep['20261004']=[1];
assert.equal(dailyRecoveryAlert(data,now).signals[2].value,55,'Future readings cannot change the current alert');
data=make();data.extra.bodyvalues.bodyvalues.push({timestamp:'2026-10-03T11:59:30Z',hrRestDynamic:0});assert.equal(dailyRecoveryAlert(data,now),null,'A latest invalid displayed RHR cannot be replaced silently');

data=make();for(const key of ['20261003','20261002','20261001'])data.hrv[key][0]=68;
for(const row of data.extra.bodyvalues.bodyvalues.slice(0,3))row.hrRestDynamic=55;
data.sleep['20261003'][0]=5.5*3600;alert=dailyRecoveryAlert(data,now);
assert.equal(alert.tone,'red');assert.ok(alert.signals.every(signal=>signal.status.tone==='red'));assert.match(alert.advice,/rest or a very easy session/);
data=make();data.sleep['20261003'][0]=5.5*3600;assert.equal(dailyRecoveryAlert(data,now).tone,'red','One red flag strengthens an alert only when all three are adverse');
globalThis.window={localStorage:{getItem:key=>key==='sieste-rhr-range'?'47-52':null}};
data=make();data.extra.bodyvalues.bodyvalues=data.extra.bodyvalues.bodyvalues.slice(0,1);
assert.equal(dailyRecoveryAlert(data,now).tone,'orange','The selected RHR range can trigger a combined amber alert');
delete globalThis.window;

process.env.TZ='Europe/Paris';const midnight=new Date('2026-10-02T22:30:00Z');
alert=dailyRecoveryAlert(make(midnight),midnight);assert.equal(alert.date,'2026-10-03');assert.equal(alert.signals[2].value,55,'RHR uses the same local calendar date as Home');process.env.TZ='UTC';

const elements=[],opened=[],widgets=[];
const record=fn=>(type,props,...rest)=>{elements.push({type,props});return fn(type,props,...rest)};
const componentSource=ts.transpileModule(readFileSync(new URL('../app/recovery-alert.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/^import .*;\s*$/gm,'').replace('export default ','');
const Component=new Function('_jsx','_jsxs','BatteryLow','ChevronRight','dailyRecoveryAlert','useExpand',componentSource+';return RecoveryAlert')(record(jsx),record(jsxs),BatteryLow,ChevronRight,dailyRecoveryAlert,()=>({metric:title=>opened.push(title),widget:(title,content)=>widgets.push({title,content})}));
const html=renderToStaticMarkup(React.createElement(Component,{data:make(),now}));
assert.match(html,/Recovery · Easy or rest day/);assert.doesNotMatch(html,/6h41/,'Home keeps the detailed readings inside the expansion');
const ribbon=elements.find(element=>element.type==='button'&&element.props.className==='recovery-alert-ribbon');
ribbon.props.onClick();assert.equal(widgets[0].title,"Today's recovery");
const detailHtml=renderToStaticMarkup(widgets[0].content);assert.match(detailHtml,/6h41/);assert.match(detailHtml,/68 ms/);assert.match(detailHtml,/55 bpm/);
for(const element of elements.filter(element=>element.type==='button'&&element.props['data-tone']))element.props.onClick();
assert.deepEqual(opened,['Latest sleep','Average HRV','Resting HR'],'Every signal opens its existing metric analysis');
assert.equal(renderToStaticMarkup(React.createElement(Component,{data:make(),now,offset:1})), '');
console.log('Daily recovery alert passed: concurrent flags, personalised ranges, missing/invalid/stale/future readings, local dates, sustained severity, historical views and metric actions.');
