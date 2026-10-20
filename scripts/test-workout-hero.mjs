import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

function module(path,imports={}){
 const exports={},source=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 new Function('require','exports','React',source)(key=>{if(!(key in imports))throw new Error(`Unknown test import ${key}`);return imports[key]},exports,React);
 return exports;
}
const hero=module('app/workout-hero.tsx');
for(const [seconds,expected] of [[59.4,'0:59'],[59.6,'1:00'],[3599.6,'1:00:00'],[3601,'1:00:01']])assert.equal(hero.clock(seconds),expected);
for(const seconds of [undefined,null,'60',0,-1,NaN,Infinity,-Infinity])assert.equal(hero.clock(seconds),null,'Invalid activity time is not formatted as a clock');

for(const [duration,expected] of [[59.4,'0:59'],[59.6,'1:00'],[119.6,'2:00'],[3599.6,'60:00']]){
 const pace=hero.heroMetrics([],'swimming',{duration,distance:100}).primary[0];
 assert.equal(pace.value,expected,'Swim pace carries rounded seconds into the next minute');
 assert.equal(pace.unit,'/100m');
}
for(const summary of [{duration:Infinity,distance:100},{duration:120,distance:Infinity},{duration:NaN,distance:100},{duration:120,distance:NaN},{duration:120,distance:0},{duration:0,distance:100},{duration:120,distance:1e-320}]){
 assert.deepEqual(hero.heroMetrics([],'swimming',summary).primary,[],'Invalid or overflowing swim totals never create a pace');
}
const card=(id,value='1')=>({id,title:id,value,unit:'',note:'',color:'',values:[],group:'Session',explanation:''});
const cards=['effort','calories','normalizedPower','heartrate','speed','power','duration','distance','altitude'].map(id=>card(id));
const ride=hero.heroMetrics(cards,'cycling');
assert.deepEqual(ride.primary.map(m=>m.id),['distance','duration','power'],'Cycling prioritizes distance, activity time and recorded power');
assert.deepEqual(ride.secondary.map(m=>m.id),['speed','heartrate','altitude','normalizedPower']);
assert.deepEqual(hero.heroMetrics([card('distance','—'),card('duration'),card('heartrate')],'running').primary.map(m=>m.id),['duration','heartrate'],'Missing headline values do not displace available metrics');
assert.deepEqual(hero.heroMetrics([card('calories','0'),card('heartrate')],'other').primary.map(m=>m.id),['heartrate','calories'],'Fallback sport order preserves a recorded zero');

const sports=module('app/sports.ts'),native=module('app/coros-native.ts'),power=module('app/cycling-power-data.ts',{'./sports':sports});
const metrics=module('app/activity-metrics.ts',{'./sports':sports,'./coros-native':native,'./cycling-power-data':power});
const Silent=()=>null,silentModule={__esModule:true,default:Silent};
const imports=Object.fromEntries(['./deferred-panel','./workout-explorer.css','./activity-profile','./recorded-fields','./session-intelligence','./running-technique','./route-map','./activity-zones','./trend-badge'].map(key=>[key,silentModule]));
Object.assign(imports,{
 react:{useState:initial=>[initial,()=>{}],useMemo:fn=>fn(),lazy:()=>Silent},
 'lucide-react':{Compass:Silent},
 './workout-context':{...silentModule,StrengthSummary:Silent},
 './workout-hero':hero,'./sports':sports,'./activity-metrics':metrics,
 './trend':{sessionTrend:()=>null,vo2Trend:()=>null},
 './expansion':{ExpandButton:Silent},
 './widget-spark':{__esModule:true,default:({values})=>React.createElement('span',{'data-chart-values':JSON.stringify(values)})},
 recharts:Object.fromEntries(['ResponsiveContainer','ComposedChart','Line','Area','CartesianGrid','XAxis','YAxis','Tooltip'].map(key=>[key,Silent])),
});
const summary=module('app/activity-summary.tsx',imports).default;
const hike={id:'hike',sportType:'hiking',summary:{distance:5000,duration:3600,durationTotal:3900,altitude:{descent:300}},seriesSampled:{sampleSize:5,data:{altitude:[500,400,200]}}};
const html=renderToStaticMarkup(React.createElement(summary,{detail:hike,loading:false}));
assert.match(html,/Activity time/,'Activity time remains available as a detail card');
assert.match(html,/1h 5m 0s elapsed/,'The detail card preserves recorded elapsed time alongside the active-time hero');
assert.match(html,/↑ — · ↓ 300/,'A descent-only hike keeps its recorded descent even though the hero displays climbing');
assert.match(html,/data-chart-values="\[500,400,200\]"/,'The elevation detail card retains its sensor chart');
console.log('Workout hero: clock/pace boundaries, finite totals, sport priorities and retained elapsed/elevation details passed.');
