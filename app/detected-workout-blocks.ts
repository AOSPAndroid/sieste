import type { effortProfile } from './effort-profile-data';
import { profileSegmentStats } from './profile-segment-data';
import { workoutBlockFormat, type WorkoutBlock, type WorkoutBlockRep } from './workout-blocks-data';

type Profile = ReturnType<typeof effortProfile>;
type Effort = Profile['efforts'][number];
type Streams = Record<string, readonly unknown[] | undefined>;

function recoveryBetween(previous: Effort, next: Effort, step: number, readings: readonly unknown[], minContrast: number) {
  const start = previous.end * 60;
  const end = next.start * 60;
  const duration = end - start;
  const shorterRep = Math.min(previous.end - previous.start, next.end - next.start) * 60;
  if (duration < Math.max(6, step * 2 - 1e-6) || duration > Math.min(480, Math.max(90, shorterRep * 3))) return false;
  let total = 0;
  let covered = 0;
  for (let index = Math.floor((start + 1e-7) / step); index * step < end - 1e-7; index++) {
    const value = readings[index];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
    const overlap = Math.min(end, (index + 1) * step) - Math.max(start, index * step);
    total += value * overlap;
    covered += overlap;
  }
  // A missing signal between two sections does not establish a recovery.
  return covered >= duration * .8 && Math.min(previous.mean, next.mean) - total / covered >= minContrast;
}

/** Use the chart's own effort bounds, requiring repeated measured recoveries between them. */
export function detectedWorkoutBlocks(profile: Profile, step: number, streams: Streams): WorkoutBlock[] {
  const { efforts, effortSource, effortMethod } = profile;
  if (efforts.length < 3 || !Number.isFinite(step) || step <= 0 || !['power', 'speed'].includes(effortSource)) return [];
  const readings = streams[effortSource];
  if (!Array.isArray(readings)) return [];
  const rows = profile.rows.map(({ time }, index) => ({ time, distance: streams.distance?.[index], speed: streams.speed?.[index] }));
  const blocks: WorkoutBlock[] = [];
  let first = 0;
  for (let end = 1; end <= efforts.length; end++) {
    if (end < efforts.length && recoveryBetween(efforts[end - 1], efforts[end], step, readings, effortMethod.minContrast)) continue;
    if (end - first >= 3) {
      const reps: WorkoutBlockRep[] = efforts.slice(first, end).map((effort, index) => {
        const { durationSeconds: duration, distance } = profileSegmentStats(rows, step, effort);
        const next = efforts[first + index + 1];
        return {
          index: first + index + 1,
          duration,
          distance: distance && distance > 0 ? distance : null,
          pace: distance && distance > 0 ? duration / distance * 1000 : null,
          heartrate: null,
          power: effortSource === 'power' ? effort.mean : null,
          ascent: null,
          descent: null,
          bounds: { start: effort.start, end: effort.end },
          ...(first + index + 1 < end ? { recoverySpan: { start: effort.end, end: next.start } } : {}),
        };
      });
      blocks.push({ kind: 'repeats', source: 'detected', format: workoutBlockFormat(reps), reps });
    }
    first = end;
  }
  return blocks;
}
