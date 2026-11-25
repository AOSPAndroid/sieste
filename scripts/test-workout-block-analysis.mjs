import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function moduleUrl(name) {
  const source = readFileSync(new URL(`../app/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  const compiled = outputText.replace(/from ['"]\.\/([^'"]+)['"]/g, (_, path) => `from '${moduleUrl(path)}'`);
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
}

const { analyzeWorkoutBlock, combineWorkoutBlockAnalyses } = await import(moduleUrl('workout-block-analysis-data'));
const { hillRepMetrics } = await import(moduleUrl('workout-hill-rep-data'));
const { workoutRepPhases } = await import(moduleUrl('workout-rep-phases-data'));

const laps = [
  { duration: 60, cadence: 180, stepLength: 107, groundContactTime: 206 },
  { summary: { duration: 40 }, heartrate: 120 },
  { duration: 60, cadence: 182, stepLength: 109, groundContactTime: 208 },
  { durationTotal: 30 },
  { duration: 56, cadence: 181, stepLength: 111, groundContactTime: 204 },
  { duration: 20 },
  { duration: 54, cadence: 183, stepLength: 113 },
];
const block = {
  kind: 'repeats',
  reps: [1, 3, 5, 7].map((index, i) => ({
    index, duration: laps[index - 1].duration, distance: 200, pace: laps[index - 1].duration * 5,
    heartrate: [150, 160, 165, 167][i], power: 230, ascent: 0, descent: 0,
  })),
};
let cursor = 0;
const aligned = laps.map((lap, i) => {
  const start = cursor;
  cursor += lap.summary?.duration ?? lap.duration ?? lap.durationTotal;
  return { index: i + 1, start: start / 60, end: cursor / 60 };
});
const hr = Array(cursor).fill(100);
const end = (i) => Math.round(aligned[i - 1].end * 60);
[160, 135, 170, 171, 165, 145, 175].forEach((value, i) => hr.fill(value, end(i + 1) - 10, end(i + 1)));
const detail = {
  laps,
  seriesSampled: { sampleSize: 1, data: { heartrate: hr, cadence: Array(cursor).fill(200), groundContactTime: Array(cursor).fill(202) } },
};

const result = analyzeWorkoutBlock(block, detail, aligned);
assert.equal(result.comparison.repsPerSide, 2);
assert.deepEqual(result.comparison.pace, { first: 300, last: 275 });
assert.deepEqual(result.comparison.heartrate, { first: 155, last: 166 });
assert.deepEqual(result.comparison.cadence, { first: 181, last: 182 }, 'Native lap cadence takes priority');
assert.deepEqual(result.comparison.stepLength, { first: 108, last: 112 });
assert.deepEqual(result.comparison.groundContactTime, { first: 207, last: 203 }, 'Missing lap reading uses supported sensor samples');
assert.deepEqual(result.reps.map(rep => rep.recovery?.duration), [40, 30, 20, undefined]);
assert.deepEqual(result.reps.map(rep => rep.recovery?.hrDrop), [25, -1, 20, undefined]);
assert.equal(result.recovery.averageDuration, 30);
assert.equal(result.recovery.averageHrDrop, 44 / 3);
assert.equal(result.recovery.measuredCount, 3);
assert.equal(result.reps[0].recovery.startHr, 160);
assert.equal(result.reps[0].recovery.endHr, 135);

const withoutLapHR = { ...block, reps: block.reps.map((rep, index) => index ? rep : { ...rep, heartrate: null }) };
assert.equal(analyzeWorkoutBlock(withoutLapHR, detail, aligned).reps[0].heartrate, 110, 'Use well-covered timed samples for a missing rep average');
assert.equal(analyzeWorkoutBlock(withoutLapHR, detail, []).reps[0].heartrate, null, 'A missing rep average requires aligned samples');

const missing = [...hr];
missing[end(2) - 1] = null;
const withGap = analyzeWorkoutBlock(block, { laps, seriesSampled: { sampleSize: 1, data: { heartrate: missing } } }, aligned);
assert.equal(withGap.reps[0].recovery.hrDrop, null, 'A missing last sample does not get estimated from lap averages');
assert.equal(withGap.recovery.measuredCount, 2);
assert.equal(withGap.recovery.averageHrDrop, 9.5);
assert.equal(withGap.comparison.groundContactTime, null, 'One missing late rep blocks the pair');

const coarseHr = Array(Math.ceil(cursor / 15)).fill(150);
const coarseDetail = { laps, seriesSampled: { sampleSize: 15, data: { heartrate: coarseHr } } };
assert.equal(analyzeWorkoutBlock(block, coarseDetail, aligned).recovery.measuredCount, 3, 'Stable aligned 15-second recordings retain sampled endpoints');
coarseHr[Math.ceil(end(1) / 15)] = 130;
assert.equal(analyzeWorkoutBlock(block, coarseDetail, aligned).reps[0].recovery.hrDrop, null, 'Rapid changes between coarse readings cannot establish the endpoint');
const detached = aligned.map(lap => lap.index === 2 ? { ...lap, start: lap.start + 1 / 60 } : lap);
assert.equal(analyzeWorkoutBlock(block, detail, detached).reps[0].recovery.hrDrop, null, 'Do not cross a timing gap');
const unaligned = analyzeWorkoutBlock(block, detail, []);
assert.deepEqual(unaligned.recovery, { count: 3, averageDuration: 30, measuredCount: 0, averageHrDrop: null });
assert.equal(unaligned.comparison.groundContactTime, null);
const beyondSampling = analyzeWorkoutBlock(block, { laps, seriesSampled: { sampleSize: 30, data: { heartrate: hr } } }, aligned);
assert.equal(beyondSampling.recovery.measuredCount, 0);

const multiRest = {
  ...block,
  reps: [{ ...block.reps[0], recoveryLaps: [2, 3] }, { ...block.reps[1], index: 4 }],
};
const combined = analyzeWorkoutBlock(multiRest, detail, aligned);
assert.equal(combined.reps[0].recovery.duration, 100);
assert.equal(combined.recovery.count, 1, 'Adjacent recorded rest laps are one recovery');
const mixed = analyzeWorkoutBlock({ ...block, format: 'mixed' }, detail, aligned);
assert.equal(mixed.comparison.repsPerSide, 0);
assert.equal(mixed.comparison.pace, null);
assert.equal(mixed.recovery.count, 3, 'Mixed lengths keep exact recoveries');

const detected = {
  kind: 'repeats',
  source: 'detected',
  format: 'time',
  reps: [
    { ...block.reps[0], distance: null, pace: null, heartrate: null, bounds: { start: 0, end: 1 }, recoverySpan: { start: 1, end: 100 / 60 } },
    { ...block.reps[1], distance: null, pace: null, bounds: { start: 100 / 60, end: 160 / 60 }, power: 250 },
  ],
};
const indoor = analyzeWorkoutBlock(detected, { laps, seriesSampled: { sampleSize: 1, data: { heartrate: hr, cadence: Array(cursor).fill(32) } } }, [], 'cycling');
assert.equal(indoor.comparison.pace, null, 'Power intervals need no speed estimate');
assert.deepEqual(indoor.comparison.power, { first: 230, last: 250 });
assert.deepEqual(indoor.comparison.cadence, { first: 32, last: 32 });
assert.equal(indoor.comparison.stepLength, null);
assert.deepEqual(indoor.reps[0].recovery, { index: null, duration: 40, startHr: 160, endHr: 135, hrDrop: 25 });

const hills = analyzeWorkoutBlock({ kind: 'uphill', reps: block.reps.slice(0, 2).map(rep => ({
  ...rep, ascent: 9, ascentSource: 'estimated',
})) }, detail, aligned);
const repeats = analyzeWorkoutBlock({ ...block, reps: block.reps.slice(2) }, detail, aligned);
const allReps = combineWorkoutBlockAnalyses([repeats, hills]);
assert.deepEqual(allReps.reps.map(rep => rep.index), [1, 3, 5, 7], 'Sort across sets by original lap index');
assert.deepEqual(allReps.reps.map(rep => rep.recovery?.index), [2, undefined, 6, undefined], 'An intervening lap between two sets remains outside the recovery stats');
assert.strictEqual(allReps.reps[0], hills.reps[0], 'Retain the original rep, including elevation and its provenance');
assert.deepEqual(allReps.recovery, { count: 2, averageDuration: 30, measuredCount: 2, averageHrDrop: 22.5 });
assert.deepEqual(combineWorkoutBlockAnalyses([hills, repeats, hills]).recovery, allReps.recovery, 'Repeated source indices are counted once');

const moreReps = { ...repeats, reps: [
  { ...repeats.reps[0], index: 10, recovery: { index: 11, duration: 80, startHr: 145, endHr: 145, hrDrop: 0 } },
  { ...repeats.reps[1], index: 12, recovery: { index: 13, duration: 40, startHr: null, endHr: null, hrDrop: null } },
  { ...repeats.reps[1], index: 14 },
] };
const allRecoveries = combineWorkoutBlockAnalyses([result, moreReps]).recovery;
assert.deepEqual(allRecoveries, { count: 5, averageDuration: 42, measuredCount: 4, averageHrDrop: 11 }, 'Weight recovery averages by recorded reps, retaining zero readings and excluding missing HR');
assert.deepEqual(combineWorkoutBlockAnalyses([]), { reps: [], recovery: { count: 0, averageDuration: null, measuredCount: 0, averageHrDrop: null } });

const uphillRep = { ...result.reps[0], ascent: 12, descent: 2 };
assert.deepEqual(hillRepMetrics(uphillRep), {
  gain: 12, grade: 5, climbRate: 12, stepLength: 107, cadence: 180, groundContactTime: 206, estimated: false, gainEstimated: false,
}, 'Grade uses net elevation, climb rate uses gross gain, and mechanics are recorded or sampled');
const estimatedHill = hillRepMetrics({ ...uphillRep, duration: 30, ascentSource: 'estimated', stepLength: null, groundContactTime: null });
assert.equal(estimatedHill.climbRate, 24);
assert.equal(estimatedHill.estimated, true);
assert.equal(estimatedHill.gainEstimated, true);
const estimatedDescent = hillRepMetrics({ ...uphillRep, descentSource: 'estimated' });
assert.equal(estimatedDescent.estimated, true, 'An estimated descent makes grade an estimate');
assert.equal(estimatedDescent.gainEstimated, false, 'Recorded ascent keeps gain and climb rate on observed terrain');
assert.equal(estimatedHill.stepLength, null, 'Missing step length is not inferred from cadence or pace');
assert.equal(estimatedHill.groundContactTime, null);
assert.equal(hillRepMetrics({ ...uphillRep, duration: 0 }).climbRate, null);
assert.equal(hillRepMetrics({ ...uphillRep, descent: null }), null, 'Incomplete terrain does not identify an uphill rep');
assert.equal(hillRepMetrics({ ...uphillRep, distance: null }), null);
assert.equal(hillRepMetrics({ ...uphillRep, ascent: Infinity }), null);
assert.equal(hillRepMetrics({ ...uphillRep, descent: 10 }), null, 'A rolling rep may contain climbing without being uphill');

const phaseRep = { index: 7, duration: 60 };
const phaseBounds = { start: 10 / 60, end: 70 / 60 };
const phaseSeries = {
  sampleSize: 1,
  data: {
    speed: [...Array(10).fill(12), ...Array(20).fill(4), ...Array(20).fill(4.5), ...Array(20).fill(5), ...Array(10).fill(12)],
    heartrate: [...Array(10).fill(210), ...Array(20).fill(157), ...Array(20).fill(169), ...Array(20).fill(176), ...Array(10).fill(210)],
    cadence: Array(80).fill(182),
    stepLength: [...Array(10).fill(250), ...Array(20).fill(104), ...Array(20).fill(null), ...Array(20).fill(115), ...Array(10).fill(250)],
    groundContactTime: [...Array(10).fill(500), ...Array(60).fill(240), ...Array(10).fill(500)],
    power: Array(80).fill(0),
  },
};
const phases = workoutRepPhases(phaseRep, phaseBounds, phaseSeries).phases;
assert.deepEqual(phases.map(phase => [phase.startSeconds, phase.endSeconds]), [[0, 20], [20, 40], [40, 60]]);
assert.deepEqual(phases.map(phase => phase.speed), [4, 4.5, 5], 'Within-rep pace comes from timed speed samples');
assert.deepEqual(phases.map(phase => phase.heartrate), [157, 169, 176]);
assert.deepEqual(phases.map(phase => phase.stepLength), [104, null, 115], 'Cadence and speed never fill an unrecorded step length');
assert.deepEqual(phases.map(phase => phase.groundContactTime), [240, 240, 240]);
assert.deepEqual(phases.map(phase => phase.power), [0, 0, 0], 'Measured zero power remains a value');
assert.deepEqual(workoutRepPhases({ ...phaseRep, bounds: phaseBounds }, null, phaseSeries).phases, phases, 'Detected reps use their own timeline bounds');

const boundarySpeed = Array(80).fill(4);
boundarySpeed[10] = 13;
boundarySpeed[70] = 13;
const partialBounds = { start: 10.4 / 60, end: 70.4 / 60 };
const edge = workoutRepPhases(phaseRep, partialBounds, { sampleSize: 1, data: { speed: boundarySpeed } });
assert.deepEqual(edge.phases.map(phase => phase.speed), [4, 4, 4], 'A sample bucket crossing either edge is never borrowed from the adjacent effort');

const coarse = { sampleSize: 15, data: { speed: [2, 2, 3, 4, 4, 5, 1, 1] } };
const halves = workoutRepPhases(phaseRep, { start: .5, end: 1.5 }, coarse).phases;
assert.deepEqual(halves.map(phase => [phase.startSeconds, phase.endSeconds, phase.speed]), [[0, 30, 3.5], [30, 60, 4.5]], 'Keep two supported halves where coarse samples cannot support thirds');
assert.equal(workoutRepPhases({ ...phaseRep, duration: 40 }, { start: .5, end: 1.5 }, coarse), null, 'Reject the elapsed span if active duration is materially shorter');
assert.equal(workoutRepPhases(phaseRep, phaseBounds, { ...phaseSeries, sampleSize: 30 }), null, 'Reject coarse samples outside the supported resolution');
assert.equal(workoutRepPhases(phaseRep, null, phaseSeries), null, 'No alignment means no within-rep data');
assert.equal(workoutRepPhases({ ...phaseRep, duration: 3 }, { start: 0, end: 3 / 60 }, phaseSeries), null, 'A couple of readings cannot describe multiple phases');

const stopped = [...phaseSeries.data.speed];
stopped.fill(0, 32, 36);
assert.equal(workoutRepPhases(phaseRep, phaseBounds, { ...phaseSeries, data: { ...phaseSeries.data, speed: stopped } }), null, 'A recorded pause can be found even when timer duration matches');
const stoppedDistance = Array.from({ length: 80 }, (_, i) => Math.min(i, 35) * 4);
assert.equal(workoutRepPhases(phaseRep, phaseBounds, { sampleSize: 1, data: { distance: stoppedDistance, heartrate: phaseSeries.data.heartrate } }), null, 'Stationary cumulative distance also detects a pause when there is no speed stream');
const hrOnly = workoutRepPhases(phaseRep, phaseBounds, { sampleSize: 1, data: { heartrate: phaseSeries.data.heartrate } });
assert.deepEqual(hrOnly.phases.map(phase => phase.heartrate), [157, 169, 176]);
assert.deepEqual(hrOnly.phases.map(phase => phase.speed), [null, null, null]);
const fragmented = { sampleSize: 1, data: { heartrate: Array.from({ length: 80 }, (_, i) => i % 2 ? 170 : null) } };
assert.equal(workoutRepPhases(phaseRep, phaseBounds, fragmented), null, 'Sparse samples cannot establish any comparable early and late measure');

console.log('Workout block analysis: aligned phase samples, measured mechanics, per-set and combined recovery, and missing coverage passed.');
