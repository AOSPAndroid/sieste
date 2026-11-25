import { measuredRecoveryBetween, type effortProfile } from './effort-profile-data';
import { profileSegmentStats } from './profile-segment-data';
import { workoutBlockFormat, type WorkoutBlock, type WorkoutBlockRep } from './workout-blocks-data';

type Profile = ReturnType<typeof effortProfile>;
type Streams = Record<string, readonly unknown[] | undefined>;

/** Use the chart's own effort bounds, requiring repeated measured recoveries between them. */
export function detectedWorkoutBlocks(profile: Profile, step: number, streams: Streams): WorkoutBlock[] {
  const { efforts, effortSource, effortMethod } = profile;
  if (efforts.length < 3 || !Number.isFinite(step) || step <= 0 || !['power', 'speed'].includes(effortSource)) return [];
  const readings = streams[effortSource];
  if (!Array.isArray(readings)) return [];
  const rows = profile.rows.map(({ time }, index) => ({ time, distance: streams.distance?.[index], speed: streams.speed?.[index] }));
  const blocks: WorkoutBlock[] = [];
  const isShort = ({ start, end }: Profile['efforts'][number]) => (end - start) * 60 < effortMethod.minSeconds - 1e-7;
  let first = 0;
  for (let end = 1; end <= efforts.length; end++) {
    const previous = efforts[end - 1], next = efforts[end];
    if (next && isShort(previous) === isShort(next) &&
      measuredRecoveryBetween(previous, next, step, readings, effortMethod.minContrast, streams.distance)) continue;
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
