import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const ts=createRequire(resolve('package.json'))('typescript');

const source=ts.transpileModule(readFileSync('app/activity-alerts.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};new Function('exports',source)(exports);
const {activityAlertBaseline,sleepAlertBaseline,retrievedSleepAlert,validSleepAlertState}=exports;
assert.equal(typeof sleepAlertBaseline,'function');
assert.equal(typeof retrievedSleepAlert,'function');
const fixture=(sleep={},extra={})=>({activities:[],sleep,...extra});
const day='20261004',nextDay='20261005',seconds=28260;
const now=Date.parse('2026-10-04T12:00:00Z'),next=Date.parse('2026-10-05T12:00:00Z');
let checks=0;
function check(label,body){try{body();checks++}catch(error){error.message=label+": "+error.message;throw error}}
const originalZone=process.env.TZ;
process.env.TZ='UTC';
try{
 check('Enabling quietly baselines current and historical main sleep',()=>{
  const data=fixture({20261003:[28000],20261004:[seconds]}),baseline=activityAlertBaseline(data,now);
  assert.ok(baseline.sleep,'The initial opt-in must baseline sleep');
  assert.deepEqual(retrievedSleepAlert(baseline.sleep,data,now).sleep,null);
  assert.ok(sleepAlertBaseline(data).seen.includes(day));
 });
 check('Today first becomes available after enable and supplies recorded duration',()=>{
  const state=sleepAlertBaseline(fixture({20261003:[28000]}));
  const result=retrievedSleepAlert(state,fixture({20261003:[28000],20261004:[seconds,28800]}),now);
  assert.deepEqual(result.sleep,{date:day,seconds});
  assert.ok(result.state.seen.includes(day));
  assert.equal(result.state.lastNotifiedDay,day);
 });
 check('Workout phase, health phase, reload and repeated sync stay quiet',()=>{
  const data=fixture({20261004:[seconds]});
  const first=retrievedSleepAlert(sleepAlertBaseline(fixture()),data,now);
  assert.ok(first.sleep);
  assert.equal(retrievedSleepAlert(first.state,data,now+1000).sleep,null);
  assert.equal(retrievedSleepAlert(JSON.parse(JSON.stringify(first.state)),data,now+300000).sleep,null);
 });
 check('Revised duration and changed primary provider cannot repeat the same wake day',()=>{
  const first=retrievedSleepAlert(sleepAlertBaseline(fixture()),fixture({20261004:[seconds]}),now);
  assert.equal(retrievedSleepAlert(first.state,fixture({20261004:[31000,28800]},{provider:'tredict'}),now+3600000).sleep,null);
 });
 check('Naps, sleep windows, scores and HRV alone never announce main sleep',()=>{
  const state=sleepAlertBaseline(fixture());
  const napOnly=fixture({}, {hrv:{20261004:[90]},extra:{coros:{sleepWindows:{20261004:{napMinutes:40,score:88,bedtime:'2026-10-04 13:00',wakeTime:'2026-10-04 13:40'}}}}});
  assert.equal(retrievedSleepAlert(state,napOnly,now).sleep,null);
  const first=retrievedSleepAlert(state,fixture({20261004:[seconds]}),now);
  assert.equal(retrievedSleepAlert(first.state,fixture({20261004:[seconds]},{hrv:napOnly.hrv,extra:napOnly.extra}),now+3600000).sleep,null);
 });
 check('Historical backfill, future dates and absent today stay quiet',()=>{
  const state=sleepAlertBaseline(fixture());
  const result=retrievedSleepAlert(state,fixture({20261001:[28000],20261003:[28000],20261005:[28000],20991231:[28000]}),now);
  assert.equal(result.sleep,null);
 });
 check('Only finite positive main duration up to 24 hours is eligible',()=>{
  for(const value of [0,-1,NaN,Infinity,-Infinity,'28260',null,undefined,86401]){
   assert.equal(retrievedSleepAlert(sleepAlertBaseline(fixture()),fixture({20261004:[value,28800]}),now).sleep,null,String(value));
  }
  assert.equal(retrievedSleepAlert(sleepAlertBaseline(fixture()),fixture({20261004:[86400]}),now).sleep?.seconds,86400);
  assert.equal(retrievedSleepAlert(sleepAlertBaseline(fixture()),fixture({20261004:[1]}),now).sleep?.seconds,1);
 });
 check('Tomorrow can notify exactly once with retained prior identity',()=>{
  const first=retrievedSleepAlert(sleepAlertBaseline(fixture()),fixture({20261004:[seconds]}),now);
  const nextData=fixture({20261004:[seconds],20261005:[30000]});
  const second=retrievedSleepAlert(first.state,nextData,next);
  assert.deepEqual(second.sleep,{date:nextDay,seconds:30000});
  assert.equal(retrievedSleepAlert(second.state,nextData,next+3600000).sleep,null);
 });
 check('Lost or temporarily omitted record does not re-alert on restoration',()=>{
  const data=fixture({20261004:[seconds]});
  const first=retrievedSleepAlert(sleepAlertBaseline(fixture()),data,now);
  const absent=retrievedSleepAlert(first.state,fixture(),now+1000);
  assert.equal(retrievedSleepAlert(absent.state,data,now+2000).sleep,null);
 });
 check('Daily cap prevents second alert even if today is absent from seen array',()=>{
  const state={seen:[],lastNotifiedDay:day};
  assert.equal(retrievedSleepAlert(state,fixture({20261004:[seconds]}),now).sleep,null);
 });
 check('Render/cache baseline remains quiet and retains earlier reservations',()=>{
  const first=retrievedSleepAlert(sleepAlertBaseline(fixture()),fixture({20261004:[seconds]}),now);
  const shown=sleepAlertBaseline(fixture({20261003:[27000]}),first.state);
  assert.equal(shown.lastNotifiedDay,day);
  assert.ok(shown.seen.includes(day));
  assert.equal(retrievedSleepAlert(shown,fixture({20261004:[seconds]}),now+1000).sleep,null);
 });
 check('Legacy migration with displayed yesterday allows newly retrieved today',()=>{
  const legacy={version:1,enabled:true,notBefore:now-86400000,seen:['saved-workout']};
  const displayed=fixture({20261003:[27000]});
  const migrated={...legacy,sleep:sleepAlertBaseline(displayed)};
  assert.equal(retrievedSleepAlert(migrated.sleep,fixture({20261003:[27000],20261004:[seconds]}),now).sleep?.date,day);
  assert.deepEqual(migrated.seen,['saved-workout']);
  assert.equal(migrated.enabled,true);
 });
 check('Legacy migration with already displayed today does not replay sleep',()=>{
  const displayed=fixture({20261004:[seconds]});
  const migrated=sleepAlertBaseline(displayed);
  assert.equal(retrievedSleepAlert(migrated,displayed,now).sleep,null);
 });
 check('Stored sleep state rejects corrupt records and impossible calendar dates',()=>{
  assert.equal(validSleepAlertState({seen:[day],lastNotifiedDay:day}),true);
  assert.equal(validSleepAlertState({seen:[]}),true);
  for(const value of [null,{}, {seen:'today'}, {seen:[42]}, {seen:['20260230']}, {seen:['20261301']}, {seen:['18991231']}, {seen:[],lastNotifiedDay:'garbage'}, {seen:Array(731).fill(day)}])assert.equal(validSleepAlertState(value),false);
 });
 check('Baseline excludes invalid or future dates and zero-duration readings',()=>{
  const baseline=sleepAlertBaseline(fixture({'20260230':[seconds],'20261301':[seconds],'bad':[seconds],'20261005':[seconds],'20261004':[0,28800],'20261003':[seconds]}),undefined,now);
  assert.deepEqual(baseline.seen,['20261003']);
 });
 check('Long histories bound saved identities and retain the daily reservation',()=>{
  const sleep={};for(let offset=0;offset<900;offset++){const date=new Date(now-offset*86400000);sleep[date.toISOString().slice(0,10).replaceAll('-','')]=[seconds]}
  const baseline=sleepAlertBaseline(fixture(sleep),{seen:[],lastNotifiedDay:day},now);
  assert.equal(baseline.seen.length,730);
  assert.equal(baseline.seen[0],day);
  assert.equal(baseline.lastNotifiedDay,day);
  assert.equal(validSleepAlertState(baseline),true);
 });
 check('Paris local midnight differs from UTC date',()=>{
  process.env.TZ='Europe/Paris';
  const stamp=Date.parse('2026-10-04T22:30:00Z');
  assert.equal(new Date(stamp).getDate(),5);
  const result=retrievedSleepAlert(sleepAlertBaseline(fixture()),fixture({20261004:[seconds],20261005:[30000]}),stamp);
  assert.deepEqual(result.sleep,{date:nextDay,seconds:30000});
 });
 check('Los Angeles local day differs from UTC after midnight',()=>{
  process.env.TZ='America/Los_Angeles';
  const stamp=Date.parse('2026-10-05T01:00:00Z');
  assert.equal(new Date(stamp).getDate(),4);
  assert.equal(retrievedSleepAlert(sleepAlertBaseline(fixture()),fixture({20261004:[seconds],20261005:[30000]}),stamp).sleep?.date,day);
 });
 check('DST repeated hour and skipped hour retain one local wake day',()=>{
  process.env.TZ='Europe/Paris';
  const fallA=Date.parse('2026-10-25T00:30:00Z'),fallB=Date.parse('2026-10-25T01:30:00Z');
  assert.equal(new Date(fallA).getHours(),new Date(fallB).getHours());
  const fallData=fixture({20261025:[seconds]}),fall=retrievedSleepAlert(sleepAlertBaseline(fixture()),fallData,fallA);
  assert.equal(fall.sleep?.date,'20261025');
  assert.equal(retrievedSleepAlert(fall.state,fallData,fallB).sleep,null);
  const springA=Date.parse('2026-03-29T00:30:00Z'),springB=Date.parse('2026-03-29T01:30:00Z');
  assert.equal(new Date(springA).getHours(),1);
  assert.equal(new Date(springB).getHours(),3);
  const springData=fixture({20260329:[seconds]}),spring=retrievedSleepAlert(sleepAlertBaseline(fixture()),springData,springA);
  assert.equal(spring.sleep?.date,'20260329');
  assert.equal(retrievedSleepAlert(spring.state,springData,springB).sleep,null);
 });
 check('Invalid calendar dates and malformed saved sleep preferences are rejected',()=>{
  assert.equal(validSleepAlertState({seen:['20260230']}),false);
  assert.equal(validSleepAlertState({seen:['20261004'],lastNotifiedDay:'invalid'}),false);
  assert.equal(validSleepAlertState({seen:[],lastNotifiedDay:'20261004'}),true);
  assert.equal(validSleepAlertState({seen:Array(731).fill('20261004')}),false);
  assert.deepEqual(sleepAlertBaseline(fixture({20260230:[28000],20261005:[30000]}),undefined,now).seen,[]);
 });
 check('Travel back across midnight does not replay a previous wake date',()=>{
  process.env.TZ='Europe/Paris';
  const first=retrievedSleepAlert(sleepAlertBaseline(fixture()),fixture({20261004:[seconds]}),now);
  const second=retrievedSleepAlert(first.state,fixture({20261004:[seconds],20261005:[30000]}),Date.parse('2026-10-04T22:30:00Z'));
  process.env.TZ='America/Los_Angeles';
  assert.equal(retrievedSleepAlert(second.state,fixture({20261004:[seconds],20261005:[30000]}),Date.parse('2026-10-05T01:00:00Z')).sleep,null);
 });
 console.log(`Sleep alerts passed ${checks} scenario groups.`);
}finally{
 if(originalZone===undefined)delete process.env.TZ;else process.env.TZ=originalZone;
}
