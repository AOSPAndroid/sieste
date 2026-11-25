import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../app/workout-rep-elevation.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { sampledRepElevation } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const series = (altitude, sampleSize = 1, distance) => ({ sampleSize, data: { altitude, distance } });
const span = (start, end) => ({ start: start / 60, end: end / 60 });

const hill = series([100, 102, 104, 106, 106, 106, 104, 102, 100]);
assert.deepEqual(sampledRepElevation(hill, span(0, 8)), { ascent: 6, descent: 6 }, 'Cumulative ascent survives a return to the starting elevation');
assert.deepEqual(sampledRepElevation(hill, span(1, 4)), { ascent: 4, descent: 0 }, 'Short reps keep their local rise');
assert.deepEqual(sampledRepElevation(hill, span(3, 5)), { ascent: 0, descent: 0 }, 'Outside hills stay outside the rep');

const ramp = series(Array.from({ length: 22 }, (_, i) => 90 + i));
assert.deepEqual(sampledRepElevation(ramp, span(2.25, 8.75)), { ascent: 7, descent: 0 }, 'Fractional bounds use adjacent observed samples');
assert.deepEqual(sampledRepElevation(ramp, span(12, 22)), { ascent: 9, descent: 0 }, 'The final sample interval is never extrapolated');
assert.equal(sampledRepElevation(ramp, span(16, 23)), null, 'More than one sample interval beyond the stream has insufficient coverage');
assert.equal(sampledRepElevation(ramp, span(19, 22)), null, 'A file-tail truncation needs strong coverage');

assert.equal(sampledRepElevation(series([100, 101, null, 105, 106]), span(0, 4)), null, 'The method never crosses a missing sample');
assert.equal(sampledRepElevation(series([null, 100, 102, 104, 106]), span(.5, 4)), null, 'A clipped boundary needs both adjacent readings');
assert.equal(sampledRepElevation(series([100, 110, 111, 112]), span(0, 3)), null, 'An isolated source jump is not attributed to climbing');
assert.equal(sampledRepElevation(series([100, 101, 102, 103], 1, [50, 55, 0, 5]), span(0, 3)), null, 'A recorded distance reset invalidates the span');
assert.equal(sampledRepElevation(hill, span(3, 4)), null, 'Two readings alone do not establish a rep elevation estimate');

assert.deepEqual(sampledRepElevation(series([-5, 2, 9], 15), span(0, 30)), { ascent: 14, descent: 0 }, 'Dense-enough coarse readings and elevations below sea level are valid');
assert.equal(sampledRepElevation(series([0, 5, 10], 30), span(0, 60)), null, 'Coarse streams are omitted');
assert.equal(sampledRepElevation(undefined, span(0, 30)), null, 'Missing source stays unknown');
assert.equal(sampledRepElevation(hill, span(5, 4)), null, 'Invalid bounds stay unknown');

console.log('Workout rep elevation passed: short and fractional spans, cumulative ascent, source coverage, discontinuities, and no extrapolation.');
