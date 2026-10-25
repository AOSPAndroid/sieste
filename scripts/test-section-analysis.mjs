import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=ts.transpileModule(readFileSync(new URL('../app/section-analysis-data.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const a=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

// Gradient cost: flat is 1, uphill costs more, gentle downhill less, steep grades clamp.
assert.equal(a.gradeFactor(0),1);
assert.ok(a.gradeFactor(.06)>1.18&&a.gradeFactor(.06)<1.26);assert.ok(Math.abs(a.gradeFactor(-.024)-.933)<.005);
assert.ok(a.gradeFactor(-.05)<1);
assert.equal(a.gradeFactor(.5),a.gradeFactor(.3));

// A run: 10 min flat, 5 min up a steady 6% climb, 5 min down, 1 s samples at 3 m/s.
const step=1,rows=[];let alt=50,dist=0;
for(let i=0;i<1200;i++){const phase=i<600?'flat':i<900?'up':'down',speed=phase==='up'?2.6:phase==='down'?3.4:3;const g=phase==='up'?.06:phase==='down'?-.06:0;rows.push({time:i/60,altitude:alt,distance:dist,speed,heartrate:phase==='up'?165:150,cadence:170,power:null});dist+=speed;alt+=speed*g}
const terrain=a.terrainSamples(rows,step);
assert.ok(Math.abs(terrain.grade[750]-.06)<.005,'Local gradient on the climb');
assert.ok(Math.abs(terrain.grade[300])<.002,'Flat stays flat');
const climb=a.spanTerrain(terrain,step,{start:10,end:15});
assert.ok(Math.abs(climb.ascent-47)<=2,`Climbing on the uphill section, got ${climb.ascent}`);
assert.equal(climb.descent,0);
assert.ok(Math.abs(climb.grade-6)<.3);
const flat=a.spanTerrain(terrain,step,{start:0,end:10});assert.equal(flat.ascent,0);assert.equal(flat.descent,0);
// Noise of ±0.5 m does not add up to climbing.
const noisy=rows.slice(0,600).map((r,i)=>({...r,altitude:50+(i%2?.5:-.5)}));assert.equal(a.spanTerrain(a.terrainSamples(noisy,1),1,{start:0,end:10}).ascent,0);

// Grade-adjusted pace: 2.6 m/s up 6% is worth more than 3 m/s on the flat.
const gap=a.spanGap(rows,terrain,step,{start:10.5,end:14.5});assert.ok(gap>3.05&&gap<3.3,`GAP uphill ${gap}`);

// Hills: pushed the climb by grade-adjusted pace, with higher heart rate.
const hills=a.hillSplit(rows,terrain,step);
assert.ok(hills.up.seconds>=250&&hills.flat.seconds>=550&&hills.down.seconds>=250);
const verdict=a.hillVerdict(hills,'running');
assert.equal(verdict.kind,'pushed');assert.equal(verdict.metric,'gap');assert.ok(verdict.hrUp>verdict.hrFlat);
// The bike uses power when there is a meter.
const bike=rows.map((r,i)=>({...r,power:i>=600&&i<900?280:i<600?200:120}));
const bikeVerdict=a.hillVerdict(a.hillSplit(bike,terrain,step),'cycling');assert.equal(bikeVerdict.metric,'power');assert.equal(bikeVerdict.kind,'pushed');assert.ok(Math.abs(bikeVerdict.change-.4)<.02);
// Too little climbing to compare.
assert.equal(a.hillVerdict(a.hillSplit(rows.slice(0,700),a.terrainSamples(rows.slice(0,700),1),1),'running'),null);

// Trends: a fading run, with a short final lap left out.
const lap=(speed,hr,cadence,durationSeconds=300,gap)=>({durationSeconds,mean:{speed,heartrate:hr,cadence,stepLength:speed/cadence*6000},gap});
const fading=[lap(3.3,150,174,300,3.3),lap(3.25,152,173,300,3.25),lap(3.2,154,172,300,3.2),lap(3.1,157,170,300,3.1),lap(3.05,159,168,300,3.05),lap(3,160,167,300,3),lap(4,140,180,40,4)];
const trend=a.sectionTrend(fading,'running');
assert.equal(trend.count,6,'Short last lap excluded');assert.equal(trend.compared,2);
const at=key=>trend.items.find(i=>i.key===key);
assert.equal(at('gap').verdict,'down');assert.equal(at('speed'),undefined,'GAP replaces raw pace on foot');
assert.equal(at('heartrate').verdict,'up');assert.ok(Math.abs(at('heartrate').change-8.5)<.01);
assert.equal(at('cadence').verdict,'down');
assert.match(a.trendSummary(trend,'running','laps'),/^Pace slowed 8% from the first to the last laps while heart rate rose 9 bpm: tiring\. Cadence dropped 3%\.$/);
// Steady laps read as well paced; a negative split as finishing stronger.
const steady=a.sectionTrend([1,2,3,4].map(()=>lap(3.2,150,172,300,3.2)),'running');
assert.ok(steady.items.every(i=>i.verdict==='held'));assert.match(a.trendSummary(steady,'running','laps'),/held steady across the laps: well paced/);
const negative=a.sectionTrend([3,3.05,3.15,3.25].map(s=>lap(s,150,172,300,s)),'running');assert.match(a.trendSummary(negative,'running','laps'),/^You finished stronger: 8% faster from the first to the last laps\./);
// Cycling trends follow power.
const rides=[250,248,240,225].map(p=>({durationSeconds:600,mean:{power:p,speed:9,heartrate:150,cadence:88}}));
const rideTrend=a.sectionTrend(rides,'cycling');assert.equal(rideTrend.items[0].key,'power');assert.match(a.trendSummary(rideTrend,'cycling','efforts'),/^Power faded 10% from the first to the last efforts at the same heart rate\./);
assert.equal(a.sectionTrend(rides.slice(0,2),'cycling'),null,'Needs three sections');

// Decoupling: same pace with heart rate drifting 8% higher in the second half.
const drift=Array.from({length:2400},(_,i)=>({time:i/60,altitude:50,distance:i*3,speed:3,heartrate:i<1200?150:162}));
const d=a.decoupling(drift,a.terrainSamples(drift,1),1,'running');assert.equal(d.basis,'pace');assert.ok(Math.abs(d.drift-7.4)<.1,`drift ${d.drift}`);
assert.equal(a.decoupling(drift.slice(0,1000),a.terrainSamples(drift.slice(0,1000),1),1,'running'),null,'Needs 20 minutes');
console.log('Section analysis: terrain, grade-adjusted pace, hills, trends and drift.');
