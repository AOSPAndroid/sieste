import {readFileSync} from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function url(name){let code=ts.transpileModule(readFileSync(new URL('../app/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;code=code.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dep)=>`from "${url(dep)}"`);return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64')}
const {median,vo2Points,windowMedian,vo2Trendline,vo2Summary,vo2Baseline,corosVo2History}=await import(url('vo2-tracking'));
const {vo2Trend}=await import(url('trend'));
const DAY=86400000,now=Date.parse('2026-10-18T12:00:00Z');
const run=(id,daysAgo,vo2,extra={})=>({id,date:new Date(now-daysAgo*DAY).toISOString(),sportType:'running',title:'Run',summary:{vo2max:vo2},...extra});
assert.equal(median([3,1,2]),2);assert.equal(median([4,1,3,2]),2.5);assert.equal(median([]),null);
// Only plausible running estimates, oldest first.
const acts=[run('r5',2,54),run('r4',6,53),run('r3',12,60),run('r2',20,52),run('r1',26,53),run('old3',33,50),run('old2',40,51),run('old1',50,49),
 {...run('ride',3,70),sportType:'cycling'},run('bad',4,140),run('none',5,undefined)];
const points=vo2Points(acts);
assert.deepEqual(points.map(p=>p.id),['old1','old2','old3','r1','r2','r3','r4','r5']);
// The 28-day median ignores a single outlier run (60) that a mean would chase.
assert.equal(windowMedian(points,now).median,53);assert.equal(windowMedian(points,now).count,5);
assert.equal(windowMedian(points,now-28*DAY).median,50,'Previous window: 49, 50, 51');
const s=vo2Summary(points,now);
assert.equal(s.change,3);assert.equal(s.latest.id,'r5');assert.equal(s.best.value,60);assert.equal(s.runs,8);
assert.equal(windowMedian(points.slice(-2),now).median,null,'Fewer than three runs gives no median');
const line=vo2Trendline(points);assert.equal(line[0].trend,null);assert.equal(line.at(-1).trend,53);
// A run is compared with the median of the prior 28 days, or the previous run when there are too few.
assert.deepEqual(vo2Baseline(points,'r5',now-2*DAY),{value:53,kind:'median',count:4});
assert.equal(vo2Baseline(points,'old2',now-40*DAY).kind,'previous');
assert.equal(vo2Baseline([],'x',now),null);
const t=vo2Trend(acts[0],acts);assert.equal(t.label,'Run VO₂ · Tredict');assert.ok(t.comparison.startsWith('median of 4 runs'));assert.equal(t.trend.tone,'good');
// COROS history keyed by day.
assert.deepEqual(corosVo2History({'20261017':{vo2max:55},'20261001':{vo2max:54},bad:{vo2max:1},'20261002':{}}).map(r=>r.value),[54,55]);
assert.deepEqual(corosVo2History(undefined),[]);
console.log('Passed VO2 tracking: plausible Tredict run estimates, outlier-resistant 28-day median, month-over-month change, run baselines and COROS history.');
