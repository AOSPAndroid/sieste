import {readFileSync,writeFileSync} from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
process.env.TZ='UTC';
const source=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const {metricStatus}=new Function(source('app/metric-status.ts')+';return {metricStatus}')();
const {recoveryTrend}=new Function(source('app/trend.ts')+';return {recoveryTrend}')();
const {corosHrv}=new Function(source('app/coros-data.ts')+';return {corosHrv}')();
assert.deepEqual(corosHrv('HRV Assessment\n2026-09-18:\n  HRV Avg: 88 ms — Normal\n  Normal Range: 79 - 101 ms\n  Baseline: 90 ms')['20260918'],[88,90,79,101]);
const now=new Date('2026-09-18T12:00:00Z'),family=a=>a.sportType;
const make=()=>{const d={activities:[],sleep:{},hrv:{},extra:{bodyvalues:{bodyvalues:[]}}};for(let i=0;i<35;i++){const date=new Date(now);date.setDate(date.getDate()-i);const key=date.toISOString().slice(0,10).replaceAll('-','');d.sleep[key]=[8*3600];d.hrv[key]=[90,90,79,101];d.extra.bodyvalues.bodyvalues.push({timestamp:date.toISOString(),hrRestDynamic:50})}return d};
let d=make();const get=key=>metricStatus(key,d,now,family),check=(key,tone)=>assert.equal(get(key).tone,tone,key);
for(const value of [79,80,89,90,100,101,120]){d.hrv['20260918'][0]=value;check('hrv',value>101?'green':'lightgreen');assert.equal(recoveryTrend(value,100,get('hrv')).tone,'neutral')}
d.hrv['20260918'][0]=78;check('hrv','orange');assert.equal(recoveryTrend(78,90,get('hrv')).tone,'watch');d.hrv['20260917'][0]=78;check('hrv','orange');d.hrv['20260916'][0]=78;check('hrv','red');delete d.hrv['20260917'];check('hrv','orange');
d=make();for(const value of [49,50,51,52,53,54]){d.extra.bodyvalues.bodyvalues[0].hrRestDynamic=value;check('rhr','lightgreen')}assert.deepEqual(get('rhr').range,[46,54]);
d.extra.bodyvalues.bodyvalues[0].hrRestDynamic=55;check('rhr','orange');d.extra.bodyvalues.bodyvalues[1].hrRestDynamic=55;check('rhr','orange');d.extra.bodyvalues.bodyvalues[2].hrRestDynamic=55;check('rhr','red');
d=make();for(const [hours,tone] of [[9,'green'],[8,'green'],[7.99,'lightgreen'],[7.5,'lightgreen'],[7.49,'yellow'],[7,'yellow'],[6.99,'orange'],[6,'orange'],[5.99,'red']]){d.sleep['20260918']=[hours*3600];check('sleep',tone)}
d=make();d.sleep['20260918']=[7.5*3600];assert.equal(recoveryTrend(7.5,10,get('sleep')).tone,'neutral');
d.hrv={'20260918':[80,90,79,101]};check('hrv','lightgreen');assert.deepEqual(get('hrv').range,[79,101]);d.hrv={'20260918':[59],'20260917':[60]};check('hrv','neutral');assert.equal(get('hrv').range,undefined);
d=make();for(const key of Object.keys(d.hrv))d.hrv[key]=[60];d.hrv['20260918']=[59];check('hrv','lightgreen');assert.match(get('hrv').reason,/estimated/);
d.hrv={'20260818':[40,60,50,70]};check('hrv','neutral');d.sleep={};check('sleep','neutral');
d=make();d.hrv['20260919']=[1,90,79,101];check('hrv','lightgreen');assert.equal(metricStatus('hrv',d,now,family,true).tone,'lightgreen');
console.log('Recovery ranges: COROS bounds, fallback baseline, inclusive limits, small changes, sustained deviations, missing days, sleep thresholds, stale/future data and neutral arrows passed.');
