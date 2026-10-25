import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function moduleUrl(name){let s=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;s=s.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,d)=>`from "${moduleUrl(d)}"`);return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
const e=await import(moduleUrl('running-economy-data'));

// A 50-minute run, 1 s samples: 10 min warm-up, 30 min steady at 3.3 m/s, a 2-min surge, then a 6% hill.
const streams=()=>{const speed=[],heartrate=[],altitude=[],distance=[],cadence=[],groundContactTime=[];let d=0,a=50;
 for(let i=0;i<3000;i++){const phase=i<600?'warm':i<2400?'steady':i<2520?'surge':'hill';const v=phase==='warm'?2.6:phase==='surge'?4.6:phase==='hill'?2.8:3.3;
  speed.push(v);heartrate.push(phase==='warm'?130:phase==='surge'?172:phase==='hill'?168:150);distance.push(d);altitude.push(a);cadence.push(176);groundContactTime.push(230);d+=v;if(phase==='hill')a+=v*.06}
 return {speed,heartrate,altitude,distance,cadence,groundContactTime}};
const detail={id:'today',date:'2026-10-20T08:00:00Z',sportType:'running',summary:{duration:3000},seriesSampled:{sampleSize:1,data:streams()}};
const b=e.steadyBlock(detail);
assert.ok(b.seconds>=1700&&b.seconds<=1800,`Steady block keeps the 30 steady minutes (${b.seconds}s)`);
assert.ok(Math.abs(b.hr-150)<.5&&Math.abs(b.gap-3.3)<.01,'Warm-up, surge and hill are left out');
assert.ok(Math.abs(b.dutyFactor-.230/(60/176))<1e-9,'Time on the ground per step');
assert.equal(e.steadyBlock({...detail,seriesSampled:{sampleSize:1,data:{speed:streams().speed.slice(0,900),heartrate:streams().heartrate.slice(0,900)}}}),null,'Too short');

// Oxygen cost: 150 bpm with rest 50 and max 190 is 71.4% of reserve; VO₂max 55 → 40.3 ml/kg/min at 3.3 m/s.
const c=e.economyOf({hr:150,gap:3.3,power:null},50,190,55);
assert.ok(Math.abs(c.reserve-100/140)<1e-9);assert.ok(Math.abs(c.oxygen-(3.5+100/140*51.5)*(1000/3.3/60))<1e-9);assert.ok(c.oxygen>200&&c.oxygen<206);
assert.ok(Math.abs(c.netBeats-100*1000/3.3/60)<1e-9);assert.equal(e.economyOf({hr:150,gap:3.3,power:null},null,190,55).oxygen,null,'No resting HR, no oxygen estimate');
assert.ok(Math.abs(e.economyOf({hr:150,gap:3.3,power:250},50,190,55,70).energy-250/70/3.3)<1e-9);

// Reference: resting HR from the fortnight before, Tredict max HR first, VO₂max held as the year's median.
const day=(d)=>`2026-10-${String(d).padStart(2,'0')}T07:00:00Z`;
const athlete={tredictCapacity:{running:[{timestamp:'2026-01-01T00:00:00Z',hrMax:192}]},bodyvalues:[{timestamp:day(10),hrRestDynamic:48},{timestamp:day(12),hrRestDynamic:50},{timestamp:day(14),hrRestDynamic:52},{timestamp:'2026-08-01T07:00:00Z',hrRestDynamic:70}]};
const run=(id,date,gap,hr,mech={})=>({id,date,sportType:'running',summary:{vo2max:54},evidence:{steady:{seconds:1800,share:1,hr,speed:gap,gap,variation:.02,power:null,...mech}}});
const ref=e.economyReference(athlete,[run('v1',day(1),3,140),run('v2',day(2),3,140),run('v3',day(3),3,140)],day(20));
assert.equal(ref.max,192);assert.equal(ref.maxSource,'Tredict max HR');assert.equal(ref.vo2max,54);assert.equal(ref.restAt(Date.parse(day(20))),50);

// Your usual line: cost falls a little with pace; this run is cheaper than the line predicts.
const history=[];for(let i=0;i<16;i++){const gap=2.8+i*.05,hr=130+i*3+(i%2?3:-3);history.push(run('h'+i,`2026-09-${String(1+i).padStart(2,'0')}T08:00:00Z`,gap,hr,{cadence:170+(i%2?-4:4)+i*.5,groundContactTime:240-i}))}
const today={...detail,date:day(20),evidence:null};
const m=e.runningEconomy(today,history,athlete);
assert.equal(m.measure,'oxygen');assert.equal(m.history,16);assert.ok(m.expected>0);
assert.ok(m.vsUsual<0,`150 bpm at 3.3 m/s is cheaper than the line predicts (${m.vsUsual})`);
assert.equal(m.year.runs,16);assert.equal(m.month,null,'No run in the last 30 days, no monthly figure');
// Higher cadence for the pace went with lower cost in this history (odd runs: lower cadence, higher HR).
const cadence=m.links.find(l=>l.key==='cadence');assert.ok(cadence&&cadence.r<-.3,'More cadence for the pace goes with cheaper runs');
assert.equal(cadence.today,176);
// Too little history: the estimate stands alone, no verdict.
const alone=e.runningEconomy(today,history.slice(0,5),athlete);assert.equal(alone.vsUsual,null);assert.ok(alone.today.oxygen>0);
// Without max HR or VO₂max it falls back to heartbeats above resting per km.
const beats=e.runningEconomy(today,[],{bodyvalues:athlete.bodyvalues});assert.equal(beats.measure,'netBeats');assert.ok(Math.abs(beats.today.netBeats-100*1000/3.3/60)<1);
// Runs without a stored block use whole-run averages only against other whole-run averages.
const rough=e.runningEconomy({id:'r',date:day(20),sportType:'running',summary:{duration:3000,distance:9900,heartrate:150,altitude:{ascent:20}}},history,athlete);
assert.equal(rough.steady,false);assert.equal(rough.history,0,'Steady blocks are not mixed with whole-run averages');
console.log('Running economy: steady block, oxygen cost, reference values, pace-matched comparison, mechanics links and fallbacks passed.');
