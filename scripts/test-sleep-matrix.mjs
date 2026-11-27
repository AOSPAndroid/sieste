import ts from 'typescript';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=ts.transpileModule(readFileSync('app/sleep-matrix-data.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {sleepMatrix,matrixHeadline,bedtimeLabel}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

assert.equal(bedtimeLabel(4*60),'10pm');assert.equal(bedtimeLabel(4*60+30),'10:30');assert.equal(bedtimeLabel(6*60),'12am');assert.equal(bedtimeLabel(8*60),'2am');

// Two bedtimes, the same hours asleep: 22:00 nights rest at 50 bpm, 01:00 nights at 54.
const night=(i,bed,hours,rhr)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,bed,hours,rhr,hrv:null,score:null});
const nights=[...Array(4)].map((_,i)=>night(i,22*60,7.5,50)).concat([...Array(4)].map((_,i)=>night(i+4,60,7.4,54)));
const m=sleepMatrix(nights,'rhr');
assert.equal(m.rowMinutes,60,'Few nights use whole-hour rows');assert.equal(m.columnHours,1);assert.equal(m.minimum,2);
assert.deepEqual(m.rows.map(r=>r.label),['10pm','11pm','12am','1am'],'Rows run from the earliest to the latest filled bedtime, across midnight');
assert.deepEqual(m.columns.map(c=>c.label),['<6h','6–7','7–8','8–9','≥9h']);
const cell=(row,column)=>m.cells.find(c=>c.row===row&&c.column===column);
assert.equal(cell(0,2).value,50);assert.equal(cell(0,2).nights,4);assert.equal(cell(3,2).value,54);
assert.equal(cell(0,2).level,1,'The lowest resting heart rate is the bluest');assert.equal(cell(3,2).level,0);
assert.equal(cell(1,2).value,null,'Bedtimes with no nights stay blank');
assert.equal(m.best,cell(0,2));
assert.equal(m.finding.kind,'cost');assert.equal(m.finding.difference,4);
assert.equal(matrixHeadline(m),'You can’t cancel out a 1 am bedtime by sleeping 7 to 8 hours: it costs 4.0 bpm.');
assert.equal(m.first,'2026-01-01');assert.equal(m.last,'2026-01-08');

// One night is not a pattern: a single late night leaves its cell blank and makes no claim.
const thin=sleepMatrix([...nights.slice(0,4),night(9,60,7.4,60)],'rhr');
assert.equal(thin.finding,null);assert.equal(thin.rows.length,1);assert.equal(matrixHeadline(thin),'Your resting heart rate by bedtime and hours asleep.');

// A small difference is reported as no difference.
const flat=sleepMatrix(nights.map(n=>({...n,rhr:n.bed===60?50.4:50})),'rhr');
assert.equal(flat.finding.kind,'flat');assert.match(matrixHeadline(flat),/^Bedtime barely moves your resting heart rate/);

// Higher is better for HRV: the high cell is the blue one and a drop is the cost.
const hrv=sleepMatrix(nights.map(n=>({...n,hrv:n.bed===60?60:72})),'hrv');
assert.equal(hrv.cells.find(c=>c.value===72).level,1);assert.equal(hrv.finding.kind,'cost');assert.match(matrixHeadline(hrv),/costs 12 ms\.$/);

// Missing readings, zero values and daytime sleep are left out, never counted as zero.
const messy=sleepMatrix([...nights,night(10,null,8,50),night(11,22*60,null,50),night(12,22*60,7.5,null),night(13,22*60,7.5,0),night(14,13*60,7.5,40)],'rhr');
assert.equal(messy.nights,8);assert.equal(messy.cells.find(c=>c.row===0&&c.column===2).value,50);
assert.equal(sleepMatrix([],'rhr').rows.length,0);assert.equal(matrixHeadline(sleepMatrix([],'rhr')),'Not enough nights to compare bedtimes yet.');

// Plenty of nights switch to half-hour rows and half-hour columns.
const many=[...Array(260)].map((_,i)=>night(i%28,22*60+(i%4)*30,6.2+(i%6)*.5,50+(i%4)));
const fine=sleepMatrix(many,'rhr');
assert.equal(fine.rowMinutes,30);assert.equal(fine.columnHours,.5);assert.deepEqual(fine.rows.map(r=>r.label),['10pm','10:30','11pm','11:30']);
assert.deepEqual(fine.columns.map(c=>c.label),['<6h','6–6.5','6.5–7','7–7.5','7.5–8','8–8.5','8.5–9','≥9h']);
console.log('Sleep matrix: bedtime rows across midnight, blank thin cells, direction per metric, cautious headline passed.');
