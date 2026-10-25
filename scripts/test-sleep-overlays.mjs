import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='Europe/Paris';
function moduleUrl(name){let s=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,d)=>`from "${moduleUrl(d)}"`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
const {sleepPeriod}=await import(moduleUrl('sleep-overlays-data'));

// 28 nights: steady sleep and HRV, then two short nights with HRV well below the usual range.
const data={provider:'tredict',activities:[],sleep:{},hrv:{},extra:{coros:{sleepWindows:{}},bodyvalues:{bodyvalues:[]},efforts:{trainingEfforts:{}}}};
const key=d=>d.replaceAll('-','');
for(let i=0;i<28;i++){const d=new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),short=i>=26;
 data.sleep[key(d)]=[short?5.5*3600:8*3600];data.hrv[key(d)]=[short?48:70+(i%3),70];
 data.extra.coros.sleepWindows[key(d)]={bedtime:`${d} 23:${10+i%20}`,wakeTime:`${d} 07:30`,score:short?55:80+(i%5),deepPercent:short?12:20,awakeMinutes:15}}
const p=sleepPeriod(data,'2026-09-28',7);
assert.equal(p.rows.length,7);assert.deepEqual(p.overlays.map(o=>o.key),['hrv','score','deep'],'Only readings with data are offered; no resting HR or training here');
const hrv=p.overlays.find(o=>o.key==='hrv');assert.equal(hrv.dates.at(-1),'2026-09-28');assert.equal(hrv.values.at(-1),48);
assert.equal(p.pick.key,'hrv','Opens on HRV when mornings fall outside the normal range');assert.match(p.pick.reason,/outside your normal HRV range/);
assert.ok(p.findings.some(f=>f.id==='streak'&&/2 nights in a row under 7 hours/.test(f.text)),'Short-night streak stands out');
assert.ok(p.findings.length<=4);assert.ok(p.findings.every((f,i,a)=>!i||a[i-1].priority>=f.priority),'Most important first');

// A steady week: no streak, regular bedtime, sleep score opens.
const steady=JSON.parse(JSON.stringify(data));for(const d of ['20260927','20260928']){steady.sleep[d]=[8*3600];steady.hrv[d]=[70,70];steady.extra.coros.sleepWindows[d].score=82}
const s=sleepPeriod(steady,'2026-09-28',7);
assert.equal(s.pick.key,'score');assert.ok(!s.findings.some(f=>f.id==='streak'));assert.ok(s.findings.some(f=>f.id==='bed'&&/regular/.test(f.text)),'Regular bedtime is a good finding');

// Training is offered as an overlay once loads are recorded.
const trained=JSON.parse(JSON.stringify(steady));for(let i=0;i<28;i++){const d=new Date(Date.UTC(2026,8,1+i));trained.extra.efforts.trainingEfforts[`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`]=[[i%4===0?120:40]]}
const t=sleepPeriod(trained,'2026-09-28',7);assert.ok(t.overlays.some(o=>o.key==='load'),'Training load overlay');
const sparse={activities:[],sleep:{20260928:[8*3600]},hrv:{20260927:[70],20260928:[71]},extra:{}};
const partial=sleepPeriod(sparse,'2026-09-28',7);
assert.equal(partial.pick.key,'hrv');assert.doesNotMatch(partial.pick.reason,/all within your normal range/,'Two readings without a baseline cannot establish normal recovery');
assert.ok(partial.findings.every(f=>!/recovery dips/.test(f.text)),'Sparse sleep-only data cannot rule out recovery dips');
console.log('Sleep overlays: overlays with data, the opening pick and its reason, findings by priority passed.');
