import ts from 'typescript';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const load=(p,names)=>new Function(ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replaceAll('export ','')+';return {'+names+'}')();
const {withPendingCorosSessions,combineProviders}=load('app/provider-data.ts','withPendingCorosSessions,combineProviders');
const {activityAlertBaseline,retrievedActivityAlerts}=load('app/activity-alerts.ts','activityAlertBaseline,retrievedActivityAlerts');
const now=Date.parse('2026-10-19T10:00:00Z'),at=m=>new Date(now-m*60000).toISOString();
const tredictOld={id:'t-old',date:at(60*24),sportType:'running',summary:{distance:8000}};
const corosRun={id:'coros_100_a',provider:'coros',date:at(20),sportType:'running',summary:{distance:10000,duration:3000}};
const corosOld={id:'coros_100_b',provider:'coros',date:at(60*24-2),sportType:'running'};
const corosAncient={id:'coros_100_c',provider:'coros',date:at(60*24*5),sportType:'running'};
// A run COROS already has but Tredict has not imported yet appears provisionally, newest first.
let list=withPendingCorosSessions([tredictOld],[corosRun,corosOld,corosAncient],now);
assert.deepEqual(list.map(a=>a.id),['coros_100_a','t-old'],'Matched and older-than-3-day COROS sessions are not duplicated');
assert.equal(list[0].provisional,'tredict');
assert.equal(list[1].fallbackId,'coros_100_b','The Tredict copy carries the COROS id as an alias');
// Once Tredict imports it (start within five minutes), the provisional copy goes away.
const tredictRun={id:'t-new',date:new Date(Date.parse(corosRun.date)+90000).toISOString(),sportType:'running',summary:{distance:10010}};
list=withPendingCorosSessions([tredictRun,tredictOld],[corosRun,corosOld],now);
assert.deepEqual(list.map(a=>a.id),['t-new','t-old']);assert.equal(list[0].fallbackId,'coros_100_a');assert.ok(!list.some(a=>a.provisional));
// Each COROS session matches at most one Tredict session; existing aliases are kept.
list=withPendingCorosSessions([{...tredictRun,fallbackId:'keep'},{...tredictRun,id:'t-dup'}],[corosRun],now);
assert.equal(list[0].fallbackId,'keep');assert.equal(list[1].fallbackId,undefined);
assert.equal(withPendingCorosSessions([tredictOld],[],now)[0],tredictOld);
// Alerts: the provisional session notifies once; the Tredict copy that replaces it does not notify again.
let state=activityAlertBaseline({activities:[tredictOld]},now-3600000);
let alert=retrievedActivityAlerts(state,{activities:withPendingCorosSessions([tredictOld],[corosRun],now)},now);
assert.deepEqual(alert.activities.map(a=>a.id),['coros_100_a']);
alert=retrievedActivityAlerts(alert.state,{activities:withPendingCorosSessions([tredictRun,tredictOld],[corosRun],now+600000)},now+600000);
assert.deepEqual(alert.activities,[],'No second notification when Tredict delivers the same run');
// combineProviders applies it to Tredict + COROS accounts.
const merged=combineProviders({activities:[tredictOld],sleep:{},hrv:{},extra:{}},{activities:[{...corosRun,date:new Date(Date.now()-60000).toISOString()}],sleep:{},hrv:{},extra:{coros:{}}});
assert.equal(merged.activities[0].provisional,'tredict');
console.log('Passed pending sessions: COROS sessions shown until Tredict imports them, five-minute matching, aliases, three-day window and single notifications.');
