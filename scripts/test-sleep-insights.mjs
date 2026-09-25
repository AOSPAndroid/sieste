import ts from 'typescript';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const src=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','');
const {sleepInsights,lateBedtime}=new Function(src('app/sleep-timing-data.ts')+src('app/sleep-insights-data.ts')+';return {sleepInsights,lateBedtime}')();
assert.equal(lateBedtime(1440),false);assert.equal(lateBedtime(1441),true);assert.equal(lateBedtime(1439),false);assert.equal(lateBedtime(null),false);
const data={sleep:{},extra:{coros:{sleepWindows:{}}}};
for(let i=1;i<=20;i++){const key='202609'+String(i).padStart(2,'0');data.sleep[key]=[(i<18?8:6)*3600];data.extra.coros.sleepWindows[key]={bedtime:i<18?'23:30':'00:30',wakeTime:'08:00'}}
let d=sleepInsights(data,'2026-09-20',7);assert.equal(d.recentStreak,3);assert.equal(d.late,3);assert.equal(d.comparisons[0].delta,0);assert.ok(d.weeklyDelta<0);assert.equal(d.year.delta,null);
delete data.sleep['20260919'];d=sleepInsights(data,'2026-09-20',7);assert.equal(d.recentStreak,1);assert.equal(d.comparisons[0].delta,null);assert.equal(d.longest,1);
assert.equal(sleepInsights({sleep:{}},'2026-09-20',7).weeklyDelta,null);console.log('Sleep insights: midnight cutoff, missing-night streaks, anchored comparisons and insufficient history passed.');
