import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
process.env.TZ='UTC';
function moduleUrl(name){let source=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;source=source.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${moduleUrl(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64')}
const {trainingFatigue,fatigueStatus}=await import(moduleUrl('training-fatigue-data'));
const {loadAnalysis}=await import(moduleUrl('load-analysis-data'));
const makeDays=n=>Array.from({length:n},(_,i)=>({iso:new Date(Date.UTC(2026,7,1+i)).toISOString().slice(0,10),effort:50,fatigueCovered:true}));
let rows=makeDays(40),result=trainingFatigue(rows,rows.at(-1).iso);
assert.ok(result.slice(0,27).every(row=>row.fatigue===null));assert.equal(result[27].fatigue,50);assert.equal(result.at(-1).fatigue,50);assert.equal(result.at(-1).fatigueProvisional,true);assert.equal(result.at(-2).fatigueProvisional,false);
for(const count of [7,27,28]){rows=makeDays(count);assert.equal(trainingFatigue(rows,rows.at(-1).iso).at(-1).fatigue,null,'Warm-up needs 28 finished days, not today’s partial day');}
rows=makeDays(29);assert.equal(trainingFatigue(rows,rows.at(-1).iso).at(-1).fatigue,50);
rows=makeDays(40);rows[38].effort=350;rows[39].effort=0;result=trainingFatigue(rows,rows.at(-1).iso);
const expected=50*Math.exp(-1/7)+350*(1-Math.exp(-1/7));assert.ok(Math.abs(result[38].fatigue-expected)<1e-10);assert.ok(Math.abs(result[39].fatigue-expected*Math.exp(-1/7))<1e-10,'Confirmed rest decays the estimate');
for(const invalid of [null,-1,NaN]){rows=makeDays(60);rows[20].effort=invalid;result=trainingFatigue(rows,rows.at(-1).iso);assert.ok(result.slice(20,48).every(row=>row.fatigue===null));assert.equal(result[48].fatigue,50,'A gap requires a new seed and completed-day warm-up');}
rows=makeDays(60);rows[20].fatigueCovered=false;assert.equal(trainingFatigue(rows,rows.at(-1).iso)[21].fatigue,null,'A workout sum cannot certify complete day coverage');

const now=new Date('2026-10-03T12:00:00Z'),data={provider:'tredict',activities:[],historyStart:'2026-01-01',historyComplete:true,syncedAt:now.toISOString(),sleep:{},hrv:{},extra:{efforts:{trainingEfforts:{}}}};
for(let i=0;i<100;i++){const date=new Date(now);date.setUTCDate(date.getUTCDate()-i);data.activities.push({id:String(i),provider:'tredict',date:date.toISOString(),summary:{duration:3600,effort:{heartrate:i===0?200:50}}});}
const models=[14,28,90].map(days=>loadAnalysis(data,now,days));for(const model of models){assert.equal(model.today.fatigue,models[0].today.fatigue);for(const row of models[0].rows)assert.equal(model.rows.find(other=>other.iso===row.iso).fatigue,row.fatigue,'Display period cannot change the estimate');}
assert.equal(loadAnalysis(data,now,90,'time').today.fatigue,models[0].today.fatigue,'Time mode retains the same load-based fatigue');
assert.equal(loadAnalysis({...data,historyComplete:false},now,14).today.fatigue,null);assert.equal(loadAnalysis({...data,syncedAt:undefined},now,14).today.fatigue,null);
const stale={...data,syncedAt:'2026-10-02T12:00:00Z'};assert.equal(loadAnalysis(stale,now,14).today.fatigue,null);assert.equal(loadAnalysis(stale,now,14).rows.at(-2).fatigue,null,'Yesterday’s midday sync cannot certify its whole day');assert.notEqual(loadAnalysis(stale,now,14).rows.at(-3).fatigue,null);
const excluded={...data,excludedWorkouts:[{id:'2',date:data.activities[2].date}]};assert.equal(loadAnalysis(excluded,now,14).today.fatigue,null);
const future={...data,activities:[...data.activities,{id:'future',date:'2026-10-04T12:00:00Z',summary:{effort:{heartrate:9999}}}]};assert.equal(loadAnalysis(future,now,14).today.fatigue,models[0].today.fatigue);
const coros={...data,provider:'coros',activities:data.activities.map(activity=>({...activity,provider:'coros',summary:{...activity.summary,trainingLoad:activity.summary.effort.heartrate/5}}))};
assert.ok(Math.abs(loadAnalysis(coros,now,14).today.fatigue-models[0].today.fatigue/5)<1e-10,'COROS uses its load instead of archived effort');
const foreign=structuredClone(data);foreign.activities[2].provider='coros';assert.equal(loadAnalysis(foreign,now,14).today.fatigue,null,'Mixed provider days break the estimate');

const rested={...data,extra:{},activities:data.activities.filter((_,i)=>i%7!==6)};
const withFeed=loadAnalysis({...rested,extra:{efforts:{trainingEfforts:{}}}},now,14);
assert.equal(loadAnalysis(rested,now,14).today.fatigue,withFeed.today.fatigue,'Confirmed rest does not depend on the daily effort endpoint');
assert.ok(withFeed.today.fatigue>0);
const missingToday={...rested,activities:rested.activities.map((a,i)=>i===0?{...a,summary:{duration:3600}}:a)};
let model=loadAnalysis(missingToday,now,14);
assert.equal(model.today.fatigue,null);assert.notEqual(model.rows.at(-2).fatigue,null);
assert.equal(fatigueStatus(model.today),'missing load · 3 Oct','Missing current load is not insufficient years of history');
const olderGap={...rested,activities:rested.activities.map(a=>a.id==='21'?{...a,summary:{duration:3600}}:a)};
model=loadAnalysis(olderGap,now,14);
assert.equal(model.today.fatigueDays,20);assert.equal(model.today.fatigueGap.iso,'2026-09-12');
assert.equal(fatigueStatus(model.today),'20/28 completed days · missing load · 12 Sept','The diagnosis includes a gap outside the visible chart');
assert.equal(loadAnalysis(olderGap,now,90).today.fatigueDays,model.today.fatigueDays);
assert.equal(fatigueStatus(loadAnalysis(stale,now,14).today),'sync needed');
assert.equal(fatigueStatus(loadAnalysis({...data,syncedAt:undefined},now,14).today),'sync needed');
assert.equal(fatigueStatus(loadAnalysis({...data,historyComplete:false},now,14).today),'history import incomplete');
assert.equal(fatigueStatus(loadAnalysis(excluded,now,14).today),'1/28 completed days · removed workout · 1 Oct');
assert.equal(fatigueStatus(models[0].today),'provisional');assert.equal(fatigueStatus(models[0].rows.at(-2)),'');
assert.equal(fatigueStatus(loadAnalysis({...data,historyStart:'2026-09-21'},now,14).today),'12/28 completed days');
console.log('Training fatigue passed: seven-day decay, seed/warm-up, constant load, spikes/rest, coverage/gap resets, exclusions, source separation, fixed chart periods, time-mode stability and provisional today.');
