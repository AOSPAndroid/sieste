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

const { repFormTrend } = await import(moduleUrl('workout-rep-trend-data'));
const { analyzeWorkoutBlock } = await import(moduleUrl('workout-block-analysis-data'));

const recorded = [
  { cadence: 183, stepLength: 136, groundContactTime: 224, heartrate: 159 },
  { cadence: 181, stepLength: 138, groundContactTime: 225, heartrate: 161 },
  { cadence: 177, stepLength: 141, groundContactTime: 237, heartrate: 164 },
  { cadence: 173, stepLength: 144, groundContactTime: 248, heartrate: 169 },
  { cadence: 174, stepLength: 143, groundContactTime: 250, heartrate: 171 },
];

function fixture(records = recorded, overrides = {}) {
  const reps = records.map((item, i) => ({
    duration: 240, distance: 1000, pace: 240, power: 230, ascent: 2, descent: 1,
    ...item, index: i + 1,
  }));
  const block = { kind: 'repeats', format: 'distance', reps, ...overrides };
  return { block, analysis: analyzeWorkoutBlock(block, { laps: reps }, []) };
}

const run = fixture();
const result = repFormTrend(run.block, run.analysis, 'running');
assert.equal(result.form, 'possible-fade', 'Longer contact and lower cadence supported by both later reps at matched pace');
assert.deepEqual(result.metrics.cadence, { first: 182, last: 173.5, delta: -8.5, direction: 'down', unit: 'steps/min' });
assert.equal(result.metrics.stepLength.direction, 'up', 'A longer step can accompany lower cadence at the same pace');
assert.equal(result.metrics.groundContactTime.direction, 'up');
assert.equal(result.metrics.groundContactTime.unit, 'ms');
assert.equal(result.metrics.heartrate.direction, 'up');
assert.equal(result.metrics.pace.direction, 'steady');

const smallPaceChange = fixture(recorded.map((item, i) => i < 3 ? item : { ...item, duration: 235, pace: 235 }));
const quicker = repFormTrend(smallPaceChange.block, smallPaceChange.analysis, 'running');
assert.equal(quicker.metrics.pace.direction, 'down', 'A readable 5 s/km change gets an arrow');
assert.equal(quicker.form, 'possible-fade', 'Similar pace still allows a comparison of mechanics');

const paceChange = fixture(recorded.map((item, i) => i < 3 ? item : { ...item, duration: 260, pace: 260 }));
const slower = repFormTrend(paceChange.block, paceChange.analysis, 'running');
assert.equal(slower.form, null, 'Slower reps can change gait without indicating form fade');
assert.deepEqual(slower.metrics.pace, { first: 240, last: 260, delta: 20, direction: 'up', unit: 's/km' });

const heterogeneous = fixture(recorded.map((item, i) => i === 0 ? { ...item, duration: 220 } : i === 1 ? { ...item, duration: 260 } : item));
assert.equal(repFormTrend(heterogeneous.block, heterogeneous.analysis, 'running').form, null, 'Matching means do not hide materially different individual paces');
const differentTerrain = fixture(recorded.map((item, i) => i < 3 ? item : { ...item, ascent: 16, descent: 15 }));
assert.equal(repFormTrend(differentTerrain.block, differentTerrain.analysis, 'running').form, null, 'Same net gain can hide more climbing and descending');
const unknownTerrain = fixture(recorded.map((item, i) => i === 0 ? { ...item, ascent: null } : item));
assert.equal(repFormTrend(unknownTerrain.block, unknownTerrain.analysis, 'running').form, null, 'Unknown terrain is not assumed flat');
const estimatedTerrain = fixture(recorded.map((item, i) => i === 0 ? { ...item, ascentSource: 'estimated' } : item));
assert.equal(repFormTrend(estimatedTerrain.block, estimatedTerrain.analysis, 'running').form, null);
const estimatedLoss = fixture(recorded.map((item, i) => i === 0 ? { ...item, descentSource: 'estimated' } : item));
assert.equal(repFormTrend(estimatedLoss.block, estimatedLoss.analysis, 'running').form, null);

const steady = fixture(recorded.map((item, i) => ({ ...item, cadence: 181 + i % 2, stepLength: 137 + i % 2, groundContactTime: 229 + i % 2 })));
const stable = repFormTrend(steady.block, steady.analysis, 'running');
assert.equal(stable.form, 'stable');
assert.equal(stable.metrics.cadence.direction, 'steady');
assert.equal(stable.metrics.heartrate.direction, 'up', 'HR rising is independent of the form readout');
const variable = fixture(recorded.map((item, i) => ({ ...item, cadence: i % 2 ? 175 : 187, stepLength: 137, groundContactTime: 229 })));
assert.equal(repFormTrend(variable.block, variable.analysis, 'running').form, null, 'The same average cadence cannot establish stability with widely variable reps');

const noContact = fixture(recorded.map(item => ({ ...item, groundContactTime: null })));
assert.equal(repFormTrend(noContact.block, noContact.analysis, 'running').form, null, 'Cadence and step length are linked, not two independent signals');
const two = fixture(recorded.slice(0, 2));
assert.equal(repFormTrend(two.block, two.analysis, 'running').form, null, 'One rep per side supplies arrows only');
assert.ok(repFormTrend(two.block, two.analysis, 'running').metrics.cadence);
const mixed = fixture(recorded, { format: 'mixed' });
assert.deepEqual(repFormTrend(mixed.block, mixed.analysis, 'running'), { metrics: {}, form: null });

const bike = repFormTrend(paceChange.block, paceChange.analysis, 'cycling');
assert.equal(bike.metrics.pace.unit, 'km/h');
assert.equal(bike.metrics.pace.direction, 'down');
assert.equal(bike.metrics.cadence.unit, 'rpm');
assert.equal(bike.metrics.stepLength, undefined);
assert.equal(bike.form, null);
const swimming = repFormTrend(paceChange.block, paceChange.analysis, 'swimming');
assert.deepEqual(swimming.metrics.pace, { first: 24, last: 26, delta: 2, direction: 'up', unit: 's/100m' });
assert.equal(swimming.form, null);

console.log('Rep trends: signed sport-specific changes, stable measurements, corroborated fades and comparison safeguards passed.');
