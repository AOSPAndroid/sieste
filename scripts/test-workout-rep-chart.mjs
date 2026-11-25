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

const { repChartData } = await import(moduleUrl('workout-rep-chart-data'));
const rep = (index, values = {}) => ({
  index, duration: 240, distance: 1000, pace: 240, power: null, heartrate: null,
  ascent: null, descent: null, cadence: null, stepLength: null, groundContactTime: null, recovery: null, ...values,
});
const rows = [
  rep(2, { heartrate: 162, pace: 250, cadence: 180, groundContactTime: 220, recovery: { duration: 60, hrDrop: 14 } }),
  rep(5, { duration: 230, heartrate: null, pace: 230, cadence: null, recovery: { duration: 45, hrDrop: -3 } }),
  rep(8, { duration: 235, heartrate: 170, pace: 235, cadence: 184, stepLength: 119 }),
];
const threshold = {
  targetPace: 240,
  reps: [
    { index: 8, beatsPerKm: 666, gradeAdjustedPace: 236, lateHeartRate: 174, energyPerKm: null },
    { index: 2, beatsPerKm: 675, gradeAdjustedPace: 248, lateHeartRate: null, energyPerKm: 61.3 },
  ],
};
const repetitions = { kind: 'repeats', format: 'distance', reps: rows };
const lookup = chart => Object.fromEntries(chart.overlays.map(layer => [layer.key, layer]));

const running = repChartData(repetitions, { reps: rows, threshold }, 'running');
const runLayers = lookup(running);
assert.equal(running.base.key, 'speed');
assert.equal(running.base.unit, 'km/h');
assert.equal(running.base.readoutUnit, '/km');
assert.ok(running.base.values[1] > running.base.values[0], 'Faster reps have taller bars although their pace number is lower');
assert.equal(running.base.format(running.base.values[0]), '4:10');
assert.equal(running.base.axisFormat(running.base.values[0]), '14.4');
assert.equal(runLayers.speed, undefined);
assert.deepEqual(runLayers.heartrate.values, [162, null, 170], 'Unknown readings retain their rep slot');
assert.deepEqual(runLayers.recoveryDuration.values, [60, 45, null], 'Rest stays with the preceding rep and the final rep has no rest');
assert.equal(runLayers.recoveryDuration.format(60), '1:00');
assert.equal(runLayers.recoveryDuration.readoutUnit, '');
assert.deepEqual(runLayers.recoveryHeartRate.values, [-14, 3, null]);
assert.equal(runLayers.recoveryHeartRate.includeZero, true);
assert.equal(runLayers.recoveryHeartRate.format(-14), '−14');
assert.equal(runLayers.recoveryHeartRate.format(3), '+3');
assert.equal(runLayers.cadence.unit, 'steps/min');
assert.deepEqual(runLayers.groundContactTime.values, [220, null, null], 'A single observed value can still be read');
assert.deepEqual(runLayers.beatsPerKm.values, [675, null, 666], 'Economy readings join by source rep index, not list position');
assert.equal(runLayers.beatsPerKm.estimated, true);
assert.equal(runLayers.gradeAdjustedPace.format(236), '3:56');
assert.deepEqual(runLayers.lateHeartRate.values, [null, null, 174]);
assert.equal(runLayers.energyPerKm.format(61.3), '61.3');
assert.equal(runLayers.power, undefined, 'Metrics without any reported readings stay hidden');

const mixed = repChartData({ ...repetitions, format: 'mixed' }, { reps: rows }, 'running');
assert.equal(mixed.base.key, 'duration');
assert.deepEqual(mixed.base.values, [240, 230, 235]);
assert.ok(lookup(mixed).speed);
assert.equal(lookup(mixed).duration, undefined);

const hillReps = [rep(1, { ascent: 14 }), rep(3, { ascent: 0 }), rep(5, { ascent: 23, ascentSource: 'estimated' })];
const hill = repChartData({ kind: 'uphill', reps: hillReps }, { reps: hillReps }, 'running');
assert.equal(hill.base.key, 'ascent');
assert.deepEqual(hill.base.values, [14, 0, 23], 'A measured zero climb gain is valid');
assert.equal(hill.base.estimated, true);

const hillsThenRepeats = [...hillReps.map((row, index) => ({ ...row, duration: 28 + index, index: index + 1 })), ...rows.map(row => ({ ...row, index: row.index + 5 }))];
const combined = repChartData({ kind: 'repeats', format: 'mixed', reps: hillsThenRepeats }, { reps: hillsThenRepeats }, 'running');
assert.equal(combined.base.key, 'duration', 'Mixed work has one bar metric across hills and other reps');
assert.deepEqual(combined.base.values, [28, 29, 30, 240, 230, 235]);
assert.deepEqual(lookup(combined).ascent.values, [14, 0, 23, null, null, null]);
assert.deepEqual(lookup(combined).recoveryDuration.values, [null, null, null, 60, 45, null]);

const gradeExample = [
  rep(2, { duration: 30, distance: 100, ascent: 10, descent: 2, stepLength: 127 }),
  rep(4, { duration: 40, distance: 150, ascent: 15, descent: 0, descentSource: 'estimated', stepLength: 119 }),
  rep(6, { ascent: 0, descent: 0, stepLength: 123 }),
];
const gradeBlock = { kind: 'repeats', format: 'mixed', reps: gradeExample };
const gradeLayers = lookup(repChartData(gradeBlock, { reps: gradeExample }, 'running'));
assert.deepEqual(gradeLayers.climbRate.values, [20, 22.5, null]);
assert.equal(gradeLayers.climbRate.estimated, false, 'Climb rate only uses gain provenance');
assert.deepEqual(gradeLayers.netGrade.values, [8, 10, null]);
assert.equal(gradeLayers.netGrade.estimated, true, 'Slope uses both elevation sources');
assert.deepEqual(gradeLayers.stepLength.values, [127, 119, 123], 'Step length still spans both uphill and level reps');
assert.equal(lookup(repChartData(gradeBlock, { reps: gradeExample }, 'cycling')).climbRate, undefined);

const oxygen = [
  { index: 13, oxygenPerRep: 185, oxygenPerKm: null },
  { index: 7, oxygenPerRep: 190, oxygenPerKm: 192 },
];
const combinedBlock = { kind: 'repeats', format: 'mixed', reps: hillsThenRepeats };
const oxygenLayers = lookup(repChartData(combinedBlock, { reps: hillsThenRepeats, oxygen }, 'running'));
assert.deepEqual(oxygenLayers.oxygenPerRep.values, [null, null, null, 190, null, 185]);
assert.deepEqual(oxygenLayers.oxygenPerKm.values, [null, null, null, 192, null, null]);
assert.equal(oxygenLayers.oxygenPerRep.unit, 'mL/kg');
assert.equal(oxygenLayers.oxygenPerKm.unit, 'mL/kg/km');
assert.equal(oxygenLayers.oxygenPerRep.estimated, true);
assert.equal(lookup(repChartData(combinedBlock, { reps: hillsThenRepeats, oxygen }, 'cycling')).oxygenPerRep, undefined);
assert.equal(lookup(repChartData(combinedBlock, { reps: hillsThenRepeats, oxygen: [] }, 'running')).oxygenPerRep, undefined);

const bikeReps = [rep(1, { power: 240, cadence: 94, pace: null }), rep(3, { power: 0, pace: null }), rep(5, { pace: null })];
const bikeBlock = { kind: 'repeats', format: 'time', reps: bikeReps };
const cycling = repChartData(bikeBlock, { reps: bikeReps }, 'cycling');
assert.equal(cycling.base.key, 'power');
assert.deepEqual(cycling.base.values, [240, 0, null], 'Measured zero watts and unavailable watts stay distinct');
assert.equal(lookup(cycling).cadence.unit, 'rpm');
assert.equal(lookup(cycling).stepLength, undefined);
assert.equal(lookup(cycling).speed, undefined);
assert.equal(repChartData(bikeBlock, { reps: [bikeReps[0], bikeReps[2]] }, 'cycling').base.key, 'duration', 'A baseline needs two valid nonempty bars');

const swimReps = [rep(1, { pace: 1000, cadence: 35 }), rep(3, { pace: 950 })];
const swimming = repChartData({ kind: 'repeats', reps: swimReps }, { reps: swimReps }, 'swimming');
assert.equal(swimming.base.unit, 'm/s');
assert.equal(swimming.base.readoutUnit, '/100m');
assert.equal(swimming.base.format(swimming.base.values[0]), '1:40');
assert.equal(lookup(swimming).cadence.unit, 'strokes/min');

console.log('Rep chart data: sport-specific bars, unit formatting, real zeros, recoveries, and economy gaps passed.');
