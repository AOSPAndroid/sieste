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

const { repTraces, traceValueAt, traceValueLabel } = await import(moduleUrl('workout-rep-traces-data'));
const close = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

// Synthetic session: warm-up, then reps of `work` seconds separated by `rest` seconds of easy running.
function session({ count = 5, work = 180, rest = 90, warm = 300, step = 1, fade = 0 } = {}) {
  const total = warm + count * (work + rest) + 120, length = Math.floor(total / step);
  const speed = [], heartrate = [], cadence = [], power = [], reps = [];
  for (let i = 0; i < length; i++) {
    const t = i * step, cycle = (t - warm) / (work + rest), index = Math.floor(cycle), into = t - warm - index * (work + rest);
    const working = t >= warm && index < count && into < work;
    // Each rep is `fade` slower in its second half; heart rate climbs through the work and falls 30 bpm a minute after it.
    speed.push(working ? 4.5 * (into >= work / 2 ? 1 - fade : 1) : 2.5);
    heartrate.push(working ? 130 + 40 * into / work + index * 2 : t >= warm && index < count ? Math.max(130, 170 + index * 2 - 30 * (into - work) / 60) : 125);
    cadence.push(working ? 184 : 168);
    power.push(working ? 320 : 180);
  }
  for (let index = 0; index < count; index++) {
    const start = warm + index * (work + rest);
    reps.push({ index: index + 2, duration: work, bounds: { start: start / 60, end: (start + work) / 60 } });
  }
  return { reps, series: { sampleSize: step, data: { speed, heartrate, cadence, power } } };
}

{
  const { reps, series } = session({ fade: .04 });
  const metrics = repTraces(reps, [], series, 'running');
  assert.deepEqual(metrics.map(metric => metric.key), ['speed', 'heartrate', 'cadence', 'power'], 'Running leads with pace');
  const [pace, heart] = metrics;
  assert.equal(pace.label, 'Pace'); assert.equal(pace.unit, '/km'); assert.equal(pace.pace, true);
  assert.equal(pace.traces.length, 5); assert.deepEqual(pace.traces.map(trace => trace.ordinal), [1, 2, 3, 4, 5]);
  assert.deepEqual(pace.traces.map(trace => trace.index), [2, 3, 4, 5, 6], 'Traces keep the recorded rep index for selection');
  assert.equal(pace.work, 180); assert.equal(pace.extent, 180, 'Only heart rate keeps the recovery'); assert.equal(pace.uniform, true);
  for (const trace of pace.traces) {
    assert.equal(trace.work, 180); assert.equal(trace.points.length, 180); assert.equal(trace.points[0].t, 0);
    close(trace.secondHalf / trace.firstHalf - 1, -.04, .004); close(trace.mean, 4.5 * .98, .02);
    assert.equal(trace.endValue, null); assert.equal(trace.after60, null);
  }
  assert.ok(pace.domain[0] < 4.5 * .96 && pace.domain[1] > 4.5, 'The scale covers every drawn value');
  assert.ok(pace.domain[0] > 3.5, 'Recovery jogging is outside the pace scale');

  assert.equal(heart.extent, 270, 'Heart rate adds the 90 seconds after each rep');
  for (const [position, trace] of heart.traces.entries()) {
    assert.equal(trace.points.length, 270, 'The tail runs 90 seconds, up to the next rep');
    close(trace.endValue, 170 + position * 2, 1.5); close(trace.endValue - trace.after60, 30, 2.5);
    close(trace.peak, 170 + position * 2, 1);
  }
  close(traceValueAt(heart.traces[0], 90), 150, 1); assert.equal(traceValueAt(heart.traces[0], 400), null); assert.equal(traceValueAt(heart.traces[0], -1), null);
}

{
  // A short recovery ends the tail before the next rep begins, and no 60-second reading is claimed.
  const { reps, series } = session({ rest: 45 });
  const heart = repTraces(reps, [], series, 'running').find(metric => metric.key === 'heartrate');
  assert.equal(heart.traces[0].points.length, 225); assert.equal(heart.traces[0].after60, null);
  assert.ok(heart.traces[0].endValue !== null);
}

{
  const { reps, series } = session();
  assert.deepEqual(repTraces(reps, [], series, 'cycling').map(metric => [metric.key, metric.label, metric.unit]),
    [['power', 'Power', 'W'], ['speed', 'Speed', 'km/h'], ['heartrate', 'Heart rate', 'bpm'], ['cadence', 'Cadence', 'rpm']], 'Cycling leads with power');
  assert.deepEqual(repTraces(reps, [], { ...series, sampleSize: 15 }, 'running'), [], 'Coarse samples cannot show a shape');
  assert.deepEqual(repTraces(reps.slice(0, 1), [], series, 'running'), [], 'One rep has nothing to lay over');
  assert.deepEqual(repTraces(reps, [], null, 'running'), []);

  // Laps without their own bounds use the aligned lap; a timer that disagrees with the span is left out.
  const aligned = reps.map(rep => ({ index: rep.index, ...rep.bounds }));
  const unbounded = reps.map(({ index, duration }) => ({ index, duration }));
  assert.equal(repTraces(unbounded, aligned, series, 'running')[0].traces.length, 5);
  assert.deepEqual(repTraces(unbounded, [], series, 'running'), []);
  const paused = unbounded.map((rep, position) => position === 2 ? { ...rep, duration: 120 } : rep);
  assert.deepEqual(repTraces(paused, aligned, series, 'running')[0].traces.map(trace => trace.ordinal), [1, 2, 4, 5], 'Ordinals still follow workout order');
}

{
  // Gaps stay gaps, a mostly missing rep is dropped, and one spike cannot stretch the scale.
  const { reps, series } = session();
  const power = [...series.data.power], first = 300, third = 300 + 2 * 270;
  for (let i = first + 60; i < first + 70; i++) power[i] = null;
  for (let i = third; i < third + 120; i++) power[i] = null;
  power[300 + 270 + 90] = 2400;
  const metric = repTraces(reps, [], { ...series, data: { ...series.data, power } }, 'cycling')[0];
  assert.deepEqual(metric.traces.map(trace => trace.ordinal), [1, 2, 4, 5]);
  assert.equal(metric.traces[0].points[64].value, null); assert.ok(metric.traces[0].points[40].value !== null);
  assert.ok(metric.domain[1] < 700, `A lone spike set the scale to ${metric.domain[1]}`);
  const zeros = series.data.power.map((value, i) => i >= first + 30 && i < first + 40 ? 0 : value);
  assert.ok(repTraces(reps, [], { ...series, data: { ...series.data, power: zeros } }, 'cycling')[0].traces[0].points[35].value < 200, 'Coasting is a recorded value');
  const stopped = series.data.speed.map((value, i) => i >= first + 30 && i < first + 40 ? 0 : value);
  assert.equal(repTraces(reps, [], { ...series, data: { ...series.data, speed: stopped } }, 'running')[0].traces[0].points[35].value, null, 'A stop is a gap in pace');
}

{
  // Mixed rep lengths share the clock from the start but lose the single work/recovery divide.
  const { reps, series } = session();
  const mixed = reps.map((rep, position) => position === 4 ? { ...rep, duration: 90, bounds: { start: rep.bounds.start, end: rep.bounds.start + 1.5 } } : rep);
  const metric = repTraces(mixed, [], series, 'running')[0];
  assert.equal(metric.uniform, false); assert.equal(metric.work, 180); assert.equal(metric.traces[4].work, 90);
}

assert.equal(traceValueLabel({ key: 'speed', pace: true, unit: '/km' }, 4), '4:10');
assert.equal(traceValueLabel({ key: 'speed', pace: true, unit: '/100m' }, 1.25), '1:20');
assert.equal(traceValueLabel({ key: 'speed', pace: false, unit: 'km/h' }, 10), '36.0');
assert.equal(traceValueLabel({ key: 'power', pace: false, unit: 'W' }, 251.6), '252');
assert.equal(traceValueLabel({ key: 'heartrate', pace: false, unit: 'bpm' }, null), '—');
console.log('Rep traces: shared rep clock, heart-rate recovery tail, gaps, pauses, spikes, mixed lengths and labels passed.');

{
  // Running mechanics join the chart, and the set is read early to late only when pace is comparable.
  const { repMechanics } = await import(moduleUrl('workout-rep-traces-data'));
  const { reps, series } = session({ count: 6 });
  const repOf = i => Math.floor((i - 300) / 270);
  const working = i => i >= 300 && repOf(i) < 6 && (i - 300) % 270 < 180;
  const stream = (base, perRep) => series.data.speed.map((_, i) => working(i) ? base + perRep * repOf(i) : null);
  const data = { ...series.data, cadence: stream(186, -1), stepLength: stream(146, 0), groundContactTime: stream(212, 2), verticalOscillation: stream(8.2, .02), verticalRatio: stream(5.6, 0) };
  const metrics = repTraces(reps, [], { ...series, data }, 'running');
  assert.deepEqual(metrics.map(metric => metric.key), ['speed', 'heartrate', 'cadence', 'power', 'stepLength', 'groundContactTime', 'verticalOscillation', 'verticalRatio']);
  assert.equal(metrics.find(metric => metric.key === 'verticalOscillation').digits, 1);
  assert.ok(!repTraces(reps, [], { ...series, data }, 'cycling').some(metric => metric.key === 'stepLength'), 'Mechanics are for running');
  const tired = repMechanics(metrics);
  assert.equal(tired.side, 2); close(tired.paceChange, 0, 1e-6); assert.equal(tired.verdict, 'tiring');
  const row = key => tired.rows.find(item => item.key === key);
  close(row('groundContactTime').across, 8, .01); assert.equal(row('groundContactTime').tiring, true);
  close(row('cadence').across, -4, .01); assert.equal(row('cadence').tiring, true);
  assert.equal(row('stepLength').tiring, false); assert.equal(row('verticalOscillation').tiring, false, 'A shift under 5% is noise');
  close(row('cadence').within, 0, 1e-6); assert.ok(!tired.rows.some(item => item.key === 'speed' || item.key === 'heartrate'));

  const steady = repMechanics(repTraces(reps, [], { ...series, data: { ...data, cadence: stream(186, 0), groundContactTime: stream(212, .5) } }, 'running'));
  assert.equal(steady.verdict, 'held');
  const lone = repMechanics(repTraces(reps, [], { ...series, data: { ...data, groundContactTime: stream(212, 0) } }, 'running'));
  assert.equal(lone.verdict, 'mixed', 'Cadence alone trades against step length');
  const slower = series.data.speed.map((value, i) => working(i) && repOf(i) >= 4 ? value * .94 : value);
  assert.equal(repMechanics(repTraces(reps, [], { ...series, data: { ...data, speed: slower } }, 'running')).verdict, 'pace-changed', 'Slower late reps explain the mechanics');
  assert.equal(repMechanics(repTraces(reps.slice(0, 3), [], { ...series, data }, 'running')).side, 1);
  assert.equal(repMechanics([]), null); assert.equal(repMechanics(repTraces(reps, [], series, 'running').filter(metric => metric.key === 'heartrate')), null, 'No mechanics measure, no reading');
  assert.equal(traceValueLabel({ key: 'verticalOscillation', pace: false, unit: 'cm', digits: 1 }, 8.26), '8.3');
  console.log('Rep mechanics: running streams, early-to-late shifts, same-pace verdicts and noise limits passed.');
}
