import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const load=name=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const {pedalling,balanceWords}=await load('pedalling-data');
const {corosLoadSummary}=await load('coros-load-data');

// Pedalling: 30 min of a ride, power rising through the ride; the left leg leads more as power rises.
const n=1800,power=[],bal=[],lte=[],rte=[],ps=[];
for(let i=0;i<n;i++){const p=120+i/n*240;power.push(p);bal.push(49+(p-120)/240*6);lte.push(80);rte.push(70);ps.push(i%2?20:22)}
const ride={seriesSampled:{sampleSize:1,data:{power,leftRightBalance:bal,leftTorqueEffectiveness:lte,rightTorqueEffectiveness:rte,pedalSmoothness:ps}}};
const p=pedalling(ride);
assert.equal(p.rows.length,3,'Three power bands of this ride');assert.ok(p.rows[0].to<=p.rows[1].from+1);
assert.equal(Math.round(p.whole.torque),75,'Left and right torque effectiveness are averaged');assert.equal(Math.round(p.whole.smoothness),21);
assert.ok(p.shift>3&&p.shift<5,`Balance moves left as power rises (${p.shift})`);
assert.equal(balanceWords(51),'Balanced 51/49');assert.equal(balanceWords(53.4),'Left leg leads 53/47');assert.equal(balanceWords(46),'Right leg leads 46/54');
assert.equal(pedalling({seriesSampled:{sampleSize:1,data:{power}}}),null,'No pedalling metrics, no card');
assert.equal(pedalling({seriesSampled:{sampleSize:30,data:ride.seriesSampled.data}}),null,'Too coarse to split');
// Coasting (under 30 W) and out-of-range readings are ignored.
const coast=pedalling({seriesSampled:{sampleSize:1,data:{power:power.map((v,i)=>i<600?0:v),leftRightBalance:bal.map((v,i)=>i<600?99:v)}}});
assert.ok(coast.whole.balance<56);

// COROS load: latest ratio read in plain words, with the change over a week.
const list=[{date:'2026-10-10',short:300,long:300,ratio:1.0},{date:'2026-10-17',short:360,long:300,ratio:1.2},{date:'2026-10-24',short:420,long:300,ratio:1.4,comment:'Heavy load, rest well'}];
const c=corosLoadSummary(list);
assert.equal(c.zone.label,'Ramping up');assert.ok(Math.abs(c.change-.2)<1e-9);assert.equal(c.comment,'Heavy load, rest well');
assert.equal(corosLoadSummary([{date:'2026-10-24',ratio:.7}]).zone.label,'Easing off');assert.equal(corosLoadSummary([{date:'2026-10-24',ratio:1.6}]).zone.tone,'risk');
assert.equal(corosLoadSummary([{date:'2026-10-24',ratio:1}]).change,null,'No week-old reading');
assert.equal(corosLoadSummary(null),null);assert.equal(corosLoadSummary([{date:'2026-10-24',ratio:null}]),null);

// Training effect words on the 0–5 scale.
const metrics=readFileSync(new URL('../app/activity-metrics.ts',import.meta.url),'utf8');
const effectWord=new Function(ts.transpileModule(metrics.match(/export const effectWord=[^\n]+/)[0].replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return effectWord')();
assert.deepEqual([.5,1.5,2.5,3.4,4.2,5].map(effectWord),['none','minor','maintaining','improving','highly improving','overreaching']);assert.equal(effectWord(undefined),'not recorded');
console.log('Data use: pedalling by power, COROS load assessment and training effect words passed.');
