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

const { thresholdBlockEconomy } = await import(moduleUrl('workout-block-economy'));
const rep = (index, duration, distance, overrides = {}) => ({
  index, duration, distance, pace: duration / distance * 1000, power: 240,
  heartrate: 162, ascent: 0, descent: 0, ...overrides,
});
const reps = [
  rep(1, 240, 1000),
  rep(3, 243, 1000, { heartrate: 167, power: 254 }),
  rep(5, 48, 200),
  rep(7, 240, 1000, { ascent: 65 }),
  rep(9, 270, 1000),
];
const block = { kind: 'repeats', format: 'mixed', reps };
const detail = {
  date: '2026-11-05T10:30:00Z',
  sportType: 'running',
  cyclingContext: {
    tredictCapacity: { running: [
      { timestamp: '2026-09-03T12:00:00Z', ftpa: 240, hrLth: 171 },
      { timestamp: '2026-11-05T15:30:00Z', ftpa: 270, hrLth: 182 },
    ] },
    fitnessHistory: { 20261102: { thresholdPace: 265 } },
  },
};

const recordedOnly = thresholdBlockEconomy(block, detail, reps, []);
assert.equal(recordedOnly.targetPace, 240, 'Use dated running capacity, never a later value');
assert.deepEqual(recordedOnly.reps.map(row => row.index), [1, 3], 'Mixed blocks omit sprints, steep reps and work off threshold pace');
assert.deepEqual(recordedOnly.reps[0], { index: 1, beatsPerKm: 648, gradeAdjustedPace: null, lateHeartRate: null, energyPerKm: 57.6 });
assert.equal(recordedOnly.reps[1].beatsPerKm, 167 * 243 / 60);
assert.equal(thresholdBlockEconomy({ ...block, kind: 'uphill' }, detail, reps, []), null);
assert.equal(thresholdBlockEconomy(block, { ...detail, sportType: 'cycling' }, reps, []), null);
assert.equal(thresholdBlockEconomy(block, detail, [reps[0]], []), null, 'Two qualifying reps are needed');

const aligned = [
  { index: 1, start: 0, end: 4 },
  { index: 3, start: 5, end: 9.05 },
];
const seriesSampled = {
  sampleSize: 15,
  data: {
    speed: Array(37).fill(1000 / 243),
    speedGradeAdjusted: Array(37).fill(1000 / 236),
    grade: Array(37).fill(1.5),
    heartrate: Array(37).fill(169),
  },
};
seriesSampled.data.heartrate.fill(159, 0, 12);
const sampled = thresholdBlockEconomy(block, { ...detail, seriesSampled }, reps, aligned);
assert.equal(sampled.reps[0].lateHeartRate, 169, 'Uses the last 60 seconds, not the lap mean or first seconds');
assert.ok(Math.abs(sampled.reps[0].gradeAdjustedPace - 236) < 1e-8, 'Provider GAP takes priority over modeled grade');
assert.equal(sampled.reps[0].beatsPerKm, 648, 'Heartbeat cost stays on recorded distance and whole-rep HR');

const modeledData = { speed: seriesSampled.data.speed, grade: seriesSampled.data.grade };
const modeled = thresholdBlockEconomy(block, { ...detail, seriesSampled: { ...seriesSampled, data: modeledData } }, reps, aligned);
assert.ok(Math.abs(modeled.reps[0].gradeAdjustedPace - 243 / (1 + .0302 * 1.5 + .00099 * 1.5 ** 2)) < 1e-8);
const gapped = {
  ...seriesSampled.data,
  speedGradeAdjusted: [4, 4, 4],
  grade: Array(37).fill(null),
  heartrate: seriesSampled.data.heartrate.map((value, index) => index >= 12 && index < 15 ? null : value),
};
const missing = thresholdBlockEconomy(block, { ...detail, seriesSampled: { ...seriesSampled, data: gapped } }, reps, aligned);
assert.equal(missing.reps[0].gradeAdjustedPace, null, 'Missing grade remains unknown instead of assuming flat ground');
assert.equal(missing.reps[0].lateHeartRate, null, 'Low late HR coverage leaves the result unknown');
const paused = thresholdBlockEconomy(block, { ...detail, seriesSampled }, reps, [{ index: 1, start: 0, end: 4.75 }, aligned[1]]);
assert.equal(paused.reps[0].lateHeartRate, null, 'Mismatched wall and timer duration blocks sampled metrics');

const coros = {
  ...detail,
  cyclingContext: {
    fitness: { thresholdPace: 268, observedAt: '2026-11-05T15:00:00Z' },
    fitnessHistory: {
      20261103: { thresholdPace: 240, observedAt: '2026-11-03T10:00:00Z' },
      20261105: { thresholdPace: 290, observedAt: '2026-11-05T11:00:00Z' },
    },
  },
};
assert.equal(thresholdBlockEconomy(block, coros, reps, []).targetPace, 240, 'COROS fallback must have existed at workout time');
assert.equal(thresholdBlockEconomy(block, { ...detail, cyclingContext: null, sessionLabel: 'Tempo' }, reps, []), null);
assert.equal(thresholdBlockEconomy(block, { ...detail, cyclingContext: null, title: 'Threshold intervals' }, reps.slice(0, 2), []).targetPace, null);
const outsidePace = { ...detail, cyclingContext: { tredictCapacity: { running: [{ timestamp: '2026-08-01T00:00:00Z', ftpa: 300 }] } } };
assert.equal(thresholdBlockEconomy(block, outsidePace, reps, []), null, 'Pace alone cannot qualify work away from target');
const labelled = thresholdBlockEconomy(block, { ...outsidePace, sessionLabel: 'Threshold' }, reps, []);
assert.equal(labelled.targetPace, null, 'Labelled work does not claim a match to the saved pace');
assert.deepEqual(labelled.reps.map(row => row.index), [1, 3], 'Explicit threshold label supports sustained comparable reps when pace differs');
const labelledLaps = [{ intensity: 'threshold' }, {}, { summary: { intensity: 'Threshold' } }];
assert.deepEqual(thresholdBlockEconomy(block, { ...outsidePace, laps: labelledLaps }, reps, []).reps.map(row => row.index), [1, 3]);
const lthr = { tredictCapacity: { running: [{ timestamp: '2026-08-01T00:00:00Z', hrLth: 171 }] } };
const byHr = thresholdBlockEconomy(block, { ...detail, cyclingContext: lthr, seriesSampled }, reps, aligned);
assert.equal(byHr.targetPace, null);
assert.equal(byHr.targetHeartRate, 171);
assert.deepEqual(byHr.reps.map(row => row.index), [1, 3]);
assert.equal(thresholdBlockEconomy(block, { ...detail, cyclingContext: lthr }, reps, []), null, 'A recorded average alone cannot establish late threshold HR');
const detected = [
  { ...reps[0], bounds: { start: 0, end: 4 } },
  { ...reps[1], bounds: { start: 5, end: 9.05 } },
];
assert.equal(thresholdBlockEconomy(block, { ...detail, seriesSampled }, detected, []).reps[0].lateHeartRate, 169, 'Detected work uses its own bounds and never needs a recorded lap');

console.log('Threshold reps: dated anchors, mixed work, sampled grade and late heart rate, and coverage limits passed.');
