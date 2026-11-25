import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const modules = new Map();
function moduleUrl(name) {
  if (modules.has(name)) return modules.get(name);
  const source = readFileSync(new URL(`../app/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  const compiled = outputText.replace(/from ['"]\.\/([^'"]+)['"]/g, (_, path) => `from '${moduleUrl(path)}'`);
  const url = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  modules.set(name, url);
  return url;
}

const { hillRepSignature, sameHillRep, hillRepHistory, hillRouteMayContain } = await import(moduleUrl('workout-hill-history-data'));
const { decode, encode } = await import(moduleUrl('route-signature'));

const k = 180 / Math.PI / 6371000;
const origin = [48.5, 2.5];
const gps = (north, east = 0) => [origin[0] + north * k, origin[1] + east * k / Math.cos(origin[0] * Math.PI / 180)];
const coords = (duration, at, sampleSize = 1) => {
  const points = Array.from({ length: Math.floor((duration + 30) / sampleSize) + 1 }, (_, i) => at((i * sampleSize - 15) / duration));
  return { sampleSize, data: { positionLat: points.map(point => point[0]), positionLong: points.map(point => point[1]) } };
};
const straight = progress => gps(200 * progress);
const align = seconds => ({ start: .25, end: (15 + seconds) / 60 });
const rep = (seconds = 60, fields = {}) => ({
  index: 3, duration: seconds, distance: 200, pace: seconds * 5, power: 250, heartrate: 165,
  ascent: 9, descent: 1, stepLength: 115, cadence: 183, groundContactTime: 220, recovery: null, ...fields,
});

const main = hillRepSignature(rep(), align(60), coords(60, straight));
assert.ok(main && Math.abs(main.distance - 200) < 1e-6);
assert.deepEqual(main.start, gps(0));
assert.deepEqual(main.end, gps(200));
assert.equal(main.seconds, 60);
assert.equal(main.grade, 4);
assert.equal(main.stepLength, 115);
assert.ok(decode(main.line).length <= 24, 'Stored traces stay compact');
const coarse = hillRepSignature(rep(), align(60), coords(60, straight, 15));
assert.ok(coarse, 'Good 15-second GPS samples still trace a typical minute-long hill');
assert.ok(sameHillRep(main, coarse), 'Compare different sampling resolutions');

const trustedDistance = { ...align(60), distanceAligned: true };
const reconciled = hillRepSignature(rep(54), trustedDistance, coords(60, straight, 15));
assert.equal(reconciled.seconds, 54, 'A coarse distance-reconciled GPS span preserves the active timer');
assert.equal(reconciled.gpsSampleSeconds, 15);
assert.equal(reconciled.distanceAligned, true);
assert.equal(hillRepSignature(rep(54), align(60), coords(60, straight, 15)), null, 'Clock-aligned GPS retains its strict duration check');
assert.equal(hillRepSignature(rep(54, { bounds: align(60) }), trustedDistance, coords(60, straight, 15)), null, 'An automatic effort cannot inherit distance reconciliation');
assert.equal(hillRepSignature(rep(52), trustedDistance, coords(60, straight, 15)), null, 'Do not accept larger discrepancies even when distance-aligned');

const shiftedStart = hillRepSignature(rep(), trustedDistance, coords(60, progress => gps(18 + 186 * progress), 15));
assert.ok(shiftedStart);
assert.ok(sameHillRep(main, shiftedStart), 'Bounded along-course uncertainty at one endpoint supports coarse GPS');
const fineStart = { ...main, line: encode([gps(0), gps(7), gps(50), gps(100), gps(150), gps(200)]) };
assert.ok(sameHillRep(fineStart, shiftedStart), 'An endpoint tangent is not limited by the other trace’s first sample spacing');
assert.equal(sameHillRep(main, { ...shiftedStart, distanceAligned: false }), false, 'Only distance-aligned evidence merits extra endpoint tolerance');
const differentEntrance = hillRepSignature(rep(), trustedDistance, coords(60, progress => gps(200 * progress, Math.max(0, 18 - progress * 90)), 15));
assert.ok(differentEntrance);
assert.equal(sameHillRep(main, differentEntrance), false, 'A sideways approach cannot use the along-route endpoint allowance');
const translated = hillRepSignature(rep(), trustedDistance, coords(60, progress => gps(18 + 200 * progress), 15));
assert.ok(translated);
assert.equal(sameHillRep(main, translated), false, 'A segment translated along the same path is not the same course');

const faster = hillRepSignature(rep(52, { index: 7, stepLength: null, cadence: null }), align(52), coords(52, progress => gps(200 * progress + 2, 2 + Math.sin(progress * Math.PI * 2))));
assert.ok(sameHillRep(main, faster), 'Allow modest boundary uncertainty and watch GPS jitter on the same hill');
const adjacent = hillRepSignature(rep(), align(60), coords(60, progress => gps(200 * progress, Math.max(0, Math.min(16, progress * 80, (1 - progress) * 80)))));
assert.ok(adjacent);
assert.equal(sameHillRep(main, adjacent), false, 'Nearby parallel paths can have the same start and finish');
const reversed = hillRepSignature(rep(), align(60), coords(60, progress => gps(200 * (1 - progress))));
assert.ok(reversed);
assert.equal(sameHillRep(main, reversed), false, 'Direction must match');
const shorter = hillRepSignature(rep(52, { distance: 174 }), align(52), coords(52, progress => gps(174 * progress + 13)));
assert.ok(shorter);
assert.equal(sameHillRep(main, shorter), false, 'A shorter connected hill segment does not match');
assert.equal(sameHillRep(main, { ...main, line: encode([main.start, main.end]) }), false, 'Endpoint-only evidence cannot confirm route overlap');

const gap = coords(60, straight);
gap.data.positionLat.fill(null, 39, 43);
assert.equal(hillRepSignature(rep(), align(60), gap), null, 'Missing central GPS cannot be bridged across a long gap');
const wrongStart = coords(60, straight);
wrongStart.data.positionLat[15] = null;
assert.equal(hillRepSignature(rep(), align(60), wrongStart), null, 'Start must have measured or narrowly interpolated coordinates');
assert.equal(hillRepSignature(rep(), align(55), coords(60, straight)), null, 'GPS interval must line up with the active duration');
assert.equal(hillRepSignature(rep(), align(60), coords(60, straight, 30)), null, 'Reject telemetry too coarse to trace a short hill');
assert.equal(hillRepSignature(rep(), null, coords(60, straight)), null);
assert.deepEqual(hillRepSignature(rep(60, { bounds: align(60) }), null, coords(60, straight)), main, 'Detected work uses its own span');

const whole = { distance: 1800, start: gps(-600), end: gps(900), line: encode([gps(-600), gps(0, 12), gps(200, 12), gps(900)]) };
assert.ok(hillRouteMayContain(main, whole), 'Shortlisting allows simplification and does not require whole-run endpoints at the hill');
const elsewhere = { distance: 1800, start: gps(-600, 100), end: gps(900, 100), line: encode([gps(-600, 100), gps(900, 100)]) };
assert.equal(hillRouteMayContain(main, elsewhere), false);

const current = { id: 'reference', date: '2026-11-15T11:00:00Z', sportType: 'running' };
const workout = (id, date, hillReps, sportType = 'running') => ({ id, date, sportType, evidence: { hillReps } });
const older = workout('before', '2026-11-13T07:00:00Z', [{ ...main, seconds: 62 }, faster, adjacent]);
const later = workout('after', '2026-11-16T07:00:00Z', [{ ...coarse, seconds: 58 }]);
const other = hillRepHistory(main, current, [
  older, older, later,
  workout('reference', current.date, [main]),
  workout('bike', later.date, [main], 'cycling'),
  workout('nearby', later.date, [adjacent]),
  workout('invalid-date', '?', [main]),
]);
assert.equal(other.matchedReps, 3, 'Deduplicate the same rep index inside the same workout');
assert.deepEqual(other.attempts.map(x => [x.id, x.rep.seconds, x.matchedReps]), [['after', 58, 1], ['before', 52, 2]]);
assert.equal(other.attempts[1].rep.stepLength, null, 'Fastest match retains missing mechanics');
assert.equal(other.attempts[1].rep.cadence, null);

console.log('Hill history: compact boundaries, GPS resolution, route direction and overlap, and unique workout attempts passed.');
