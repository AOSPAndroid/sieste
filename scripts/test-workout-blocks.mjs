import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../app/workout-blocks-data.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { workoutBlocks, workoutBlockFormat } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const lap = (duration, distance, power, ascent = 0, descent = 0) => ({
  duration, distance, power, altitude: { ascent, descent },
});
const interleave = (reps, recovery) => reps.flatMap((rep, index) => index ? [recovery, rep] : [rep]);
const hills = interleave(
  [52, 53, 50, 53, 50, 51, 54, 51].map((duration, index) => ({
    lap: index * 2 + 10,
    summary: { ...lap(duration, 200 + index % 3, 300, 10, 1), heartrate: 150 },
  })),
  lap(100, 220, 140, 0, 8),
);
const kilometres = interleave(
  [245, 243, 240, 236, 238].map(duration => lap(duration, 1000, 275)),
  lap(55, 65, 100),
);
const mixed = [lap(930, 3000, 195), ...hills, lap(480, 1400, 185), ...kilometres, lap(240, 650, 175)];
const blocks = workoutBlocks(mixed);
assert.deepEqual(blocks.map(block => [block.kind, block.reps.length]), [['uphill', 8], ['repeats', 5]]);
assert.deepEqual(blocks[0].reps.map(rep => rep.index), [2, 4, 6, 8, 10, 12, 14, 16]);
assert.deepEqual(blocks[1].reps.map(rep => rep.index), [18, 20, 22, 24, 26]);
assert.deepEqual(blocks.map(block => [block.format, block.source]), [['distance', 'laps'], ['distance', 'laps']]);
assert.deepEqual(blocks[0].reps.map(rep => rep.recoveryLaps), [[3], [5], [7], [9], [11], [13], [15], undefined]);
assert.deepEqual(blocks[1].reps.map(rep => rep.recoveryLaps), [[19], [21], [23], [25], undefined]);
assert.equal(blocks[0].reps[0].pace, 260);
assert.equal(blocks[0].reps[0].heartrate, 150);
assert.equal(blocks[0].reps[0].ascent, 10);
assert.equal(blocks[1].reps[0].heartrate, null);

const autoKilometres = [242, 310, 238, 302, 237, 288, 232].map(duration => lap(duration, 1000, 225));
assert.deepEqual(workoutBlocks([...autoKilometres, lap(4, 18, 200)]), [], 'Equal distance splits are insufficient');
const steady = [294, 309, 295, 305, 294, 307, 296].map((duration, index) => lap(duration, 970 + index * 8, 204));
assert.deepEqual(workoutBlocks(steady), []);
const work = lap(90, 400, 255);
for (const gap of [lap(30, 0, 0), lap(40, 8, 45), lap(350, 500, 130), null, { duration: 60, distance: NaN }]) {
  assert.deepEqual(workoutBlocks([work, gap, work, gap, work]), [], 'Invalid or stopped laps break the pattern');
}
assert.deepEqual(workoutBlocks([work, lap(60, 120, 130), work]), [], 'Two unlabelled work laps alone are inconclusive');

const bookendedPair = [lap(908, 2870, 195), lap(200, 770, 275), lap(340, 1070, 195),
  lap(190, 780, 285), lap(480, 1520, 195), lap(12, 0, 0)];
const [pair] = workoutBlocks(bookendedPair);
assert.deepEqual(pair.reps.map(rep => rep.index), [2, 4], 'Two matching work laps with an observed recovery and longer easy bookends qualify');
assert.deepEqual(pair.reps.map(rep => rep.recoveryLaps), [[3], undefined]);
assert.deepEqual(workoutBlocks(bookendedPair.slice(1, -2)), [], 'Unlabelled short sets require warm-up and cool-down evidence');
assert.deepEqual(workoutBlocks(bookendedPair.map(value => ({ ...value, lapTrigger: 'distance' }))), [], 'Automatic distance splits cannot supply a two-rep pattern');

const uphillByPower = lap(53, 200, 315, 12, 1);
const downhill = lap(56, 220, 160, 1, 12);
assert.equal(workoutBlocks([uphillByPower, downhill, uphillByPower, downhill, uphillByPower])[0].kind, 'uphill');
const noElevation = { ...uphillByPower, altitude: undefined };
assert.deepEqual(workoutBlocks([noElevation, downhill, noElevation, downhill, noElevation]), [], 'Power alone does not assert a hill');

const timed = interleave([240, 285, 250, 296].map(distance => lap(60, distance, 280)), lap(45, 80, 140));
const [timedBlock] = workoutBlocks(timed);
assert.equal(timedBlock.format, 'time');
assert.deepEqual(timedBlock.reps.map(rep => rep.index), [1, 3, 5, 7]);
assert.deepEqual(workoutBlocks(timed.map(value => ({ ...value, lapTrigger: 'time' }))), [], 'Unlabelled automatic time laps are not workout steps');

const pyramid = interleave([200, 400, 800, 400, 200].map(distance => lap(distance / 4.1, distance, 275)), lap(45, 85, 130));
const [pyramidBlock] = workoutBlocks(pyramid);
assert.equal(pyramidBlock.format, 'mixed');
assert.deepEqual(pyramidBlock.reps.map(rep => rep.distance), [200, 400, 800, 400, 200]);
assert.equal(workoutBlockFormat(pyramidBlock.reps), 'mixed');

const alternating = interleave([200, 600, 200, 600, 200, 600].map(distance => lap(distance / 4.1, distance, 275)), lap(30, 55, 125));
assert.deepEqual(workoutBlocks(alternating).map(block => [block.format, block.reps.length]), [['mixed', 6]]);

const swimWork = { duration: 72, distance: 100, intensity: 'interval', lapTrigger: 'distance' };
const rest = { duration: 20, distance: 0, intensity: 1, lapTrigger: 1 };
const transition = { duration: 10, intensity: 'recovery' };
const [swim] = workoutBlocks([swimWork, rest, transition, swimWork], 'swimming');
assert.equal(swim.format, 'distance');
assert.deepEqual(swim.reps.map(rep => rep.distance), [100, 100]);
assert.deepEqual(swim.reps.map(rep => rep.recoveryLaps), [[2, 3], undefined], 'Explicit stationary recovery and multiple laps retain source indices');
const active = { ...swimWork, intensity: 'active' };
assert.equal(workoutBlocks([active, rest, active], 'swimming')[0].reps.length, 2, 'Active alone is default; explicit recovery confirms structured work');

const short = { ...lap(10, 45, 290), lapTrigger: 'manual' };
const jog = { ...lap(30, 43, 110), lapTrigger: 'manual' };
assert.equal(workoutBlocks([short, jog, short])[0].reps.length, 2, 'Two short, similarly timed and manually marked repeats can qualify');
assert.deepEqual(workoutBlocks([short, jog, { ...lap(60, 250, 275), lapTrigger: 'manual' }]), [], 'Two differently shaped manual laps are inconclusive');

const ride = interleave([310, 290, 305].map(power => ({ duration: 120, power })), { duration: 75, power: 100 });
const [trainer] = workoutBlocks(ride, 'cycling');
assert.equal(trainer.format, 'time');
assert.deepEqual(trainer.reps.map(rep => [rep.index, rep.pace, rep.distance]), [[1, null, null], [3, null, null], [5, null, null]]);
const fastDownhills = interleave([120, 120, 120].map(duration => lap(duration, 1500, 175)), lap(75, 510, 225));
assert.deepEqual(workoutBlocks(fastDownhills, 'cycling'), [], 'Cycling speed cannot override contrary power');

const variedRecovery = [work, lap(40, 65, 120), lap(20, 30, 120), work, lap(60, 120, 120), work];
assert.deepEqual(workoutBlocks(variedRecovery)[0].reps.map(rep => rep.recoveryLaps), [[2, 3], [5], undefined]);

console.log('Workout blocks: timed, mixed and sport-specific reps, original lap indices, explicit and grouped recoveries, automatic splits and stops passed.');
