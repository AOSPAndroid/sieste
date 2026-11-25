export type WorkoutBlockRep = {
  index: number;
  duration: number;
  distance: number | null;
  pace: number | null;
  power: number | null;
  heartrate: number | null;
  ascent: number | null;
  descent: number | null;
  ascentSource?: 'estimated';
  descentSource?: 'estimated';
  recoveryLaps?: number[];
  bounds?: { start: number; end: number };
  recoverySpan?: { start: number; end: number };
};

export type WorkoutBlock = {
  kind: 'uphill' | 'repeats';
  format?: 'distance' | 'time' | 'mixed';
  source?: 'laps' | 'detected';
  reps: WorkoutBlockRep[];
};

type LapRole = 'interval' | 'active' | 'recovery' | 'boundary' | null;
type Lap = {
  rep: WorkoutBlockRep;
  speed: number | null;
  role: LapRole;
  trigger: 'manual' | 'auto' | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => isFiniteNumber(value) && value > 0;
const nonnegative = (value: unknown) => isFiniteNumber(value) && value >= 0 ? value : null;

// FIT intensity `active` is the default for ordinary laps. It is treated
// as recorded work only beside an explicitly marked recovery.
function intensityRole(value: unknown): LapRole {
  if (value === 'interval' || value === 5) return 'interval';
  if (value === 'active' || value === 0) return 'active';
  if (value === 'rest' || value === 'recovery' || value === 1 || value === 4) return 'recovery';
  if (value === 'warmup' || value === 'cooldown' || value === 2 || value === 3) return 'boundary';
  return null;
}

function lapTrigger(value: unknown): Lap['trigger'] {
  if (value === 'manual' || value === 0) return 'manual';
  if (value === 'time' || value === 'distance' || value === 1 || value === 2) return 'auto';
  return null;
}

function readLap(raw: unknown, offset: number): Lap | null {
  if (!isRecord(raw)) return null;
  const values = isRecord(raw.summary) ? { ...raw, ...raw.summary } : raw;
  const duration = values.duration ?? values.durationTotal;
  if (!positive(duration)) return null;
  const distance = nonnegative(values.distance);
  const speed = distance !== null ? distance / duration : nonnegative(values.speed);
  const { altitude } = values;
  return {
    rep: {
      index: offset + 1,
      duration,
      distance,
      pace: positive(speed) ? 1000 / speed : null,
      power: nonnegative(values.power),
      heartrate: positive(values.heartrate) ? values.heartrate : null,
      ascent: isRecord(altitude) ? nonnegative(altitude.ascent) : null,
      descent: isRecord(altitude) && isFiniteNumber(altitude.descent) ? Math.abs(altitude.descent) : null,
    },
    speed,
    role: intensityRole(values.intensity),
    trigger: lapTrigger(values.lapTrigger),
  };
}

export function isUphillRep(rep: WorkoutBlockRep) {
  if (!positive(rep.distance) || rep.ascent === null || rep.descent === null) return false;
  return rep.ascent - rep.descent >= Math.max(4, rep.distance * .02);
}

export function hasHillReps(block: WorkoutBlock) {
  return block.kind === 'uphill' || block.reps.filter(isUphillRep).length >= 2;
}

function uniform(values: readonly (number | null)[], ratio: number) {
  if (!values.length || !values.every(positive)) return false;
  return Math.max(...values) <= Math.min(...values) * ratio;
}

export function workoutBlockFormat(reps: readonly WorkoutBlockRep[]): NonNullable<WorkoutBlock['format']> {
  const durations = reps.map(rep => rep.duration);
  const distances = reps.map(rep => rep.distance);
  if (uniform(durations, 1.03) && !uniform(distances, 1.06)) return 'time';
  if (uniform(distances, 1.15)) return 'distance';
  return uniform(durations, 1.2) ? 'time' : 'mixed';
}

const markedWork = (lap: Lap) => lap.role === 'interval' || lap.role === 'active';

function workCandidate(lap: Lap, family: string) {
  if (lap.role === 'boundary' || lap.role === 'recovery') return false;
  if (lap.rep.duration < 8 || lap.rep.duration > 1800) return false;
  return markedWork(lap) || positive(lap.speed) || (family === 'cycling' && positive(lap.rep.power));
}

function strongerThanRecovery(work: Lap, recovery: Lap, family: string) {
  if (work.role === 'interval' && recovery.role === 'recovery') return true;
  const { power } = work.rep;
  const restPower = recovery.rep.power;
  const powerContrast = power !== null && restPower !== null &&
    power >= Math.max(restPower + 25, restPower * 1.25);
  if (family === 'cycling' && power !== null && restPower !== null) return powerContrast;

  if (!positive(work.speed) || !positive(recovery.speed)) return false;
  const minimum = family === 'swimming' ? .12 : family === 'cycling' ? .8 : .3;
  const ratio = family === 'cycling' ? 1.25 : 1.18;
  if (work.speed >= Math.max(recovery.speed + minimum, recovery.speed * ratio)) return true;
  return family === 'running' && isUphillRep(work.rep) && work.speed >= recovery.speed * .85 && powerContrast;
}

function recoveryCandidate(lap: Lap, work: Lap, family: string) {
  if (lap.role === 'recovery') return true;
  if (lap.role === 'interval' || lap.role === 'boundary' || lap.trigger === 'auto' || lap.rep.duration < 5) return false;
  // Unlabelled stationary laps need a recorded pedalling signal to establish recovery.
  if (lap.speed !== null && lap.speed < .35 && !(family === 'cycling' && positive(lap.rep.power))) return false;
  return strongerThanRecovery(work, lap, family);
}

function similarIntensity(a: Lap, b: Lap, family: string) {
  const [first, last] = family === 'cycling' && positive(a.rep.power) && positive(b.rep.power)
    ? [a.rep.power, b.rep.power] : [a.speed, b.speed];
  return positive(first) && positive(last) && Math.min(first, last) >= Math.max(first, last) * .65;
}

function clearWorkPair(laps: readonly (Lap | null)[], first: number, last: number, family: string) {
  const work = laps[first], next = laps[last], before = laps[first - 1], after = laps[last + 1];
  if (!work || !next || !before || !after || before.trigger === 'auto' || after.trigger === 'auto') return false;
  const matches = uniform([work.rep.duration, next.rep.duration], 1.08) ||
    uniform([work.rep.distance, next.rep.distance], 1.08);
  // Ordinary alternating laps can have the same two lower-output neighbours.
  // Require a separate warm-up and cool-down, marked or clearly longer.
  const warmedUp = before.role === 'boundary' ||
    (before.rep.duration >= work.rep.duration * 2 && strongerThanRecovery(work, before, family));
  const cooledDown = after.role === 'boundary' ||
    (after.rep.duration >= next.rep.duration * 2 && strongerThanRecovery(next, after, family));
  return matches && warmedUp && cooledDown;
}

type NextRep = { offset: number; recovery: Lap[]; explicit: boolean; manual: boolean };

function followingRep(laps: readonly (Lap | null)[], offset: number, work: Lap, family: string): NextRep | null {
  const recovery: Lap[] = [];
  let recoveryTime = 0;
  for (let i = offset + 1; i < Math.min(laps.length, offset + 5); i++) {
    const candidate = laps[i];
    if (!candidate) return null;
    if (recovery.length && workCandidate(candidate, family)) {
      const explicit = markedWork(work) && markedWork(candidate) && recovery.every(lap => lap.role === 'recovery');
      const restLimit = recoveryTime > 300 && clearWorkPair(laps, offset, i, family) ? 480 : 300;
      const limit = Math.min(restLimit, work.rep.duration * 4, candidate.rep.duration * 4);
      const contrasted = work.trigger !== 'auto' && candidate.trigger !== 'auto' &&
        recoveryTime <= limit && similarIntensity(work, candidate, family) &&
        recovery.every(lap => strongerThanRecovery(candidate, lap, family));
      if ((explicit && recoveryTime <= 1800) || contrasted) {
        return { offset: i, recovery, explicit, manual: [work, candidate, ...recovery].every(lap => lap.trigger === 'manual') };
      }
    }
    if (!recoveryCandidate(candidate, work, family)) return null;
    recovery.push(candidate);
    recoveryTime += candidate.rep.duration;
  }
  return null;
}

/** Recoveries are observed laps, never elapsed gaps or inferred stationary time. */
export function workoutBlocks(laps: readonly unknown[], family = 'running'): WorkoutBlock[] {
  const recorded = laps.map(readLap);
  const blocks: WorkoutBlock[] = [];
  for (let start = 0; start + 2 < recorded.length; start++) {
    const first = recorded[start];
    if (!first || !workCandidate(first, family)) continue;

    const reps = [{ ...first.rep }];
    const included = [first];
    let end = start;
    let explicit = true;
    let manual = true;
    let next = followingRep(recorded, end, first, family);
    while (next) {
      const work = recorded[next.offset]!;
      reps[reps.length - 1].recoveryLaps = next.recovery.map(lap => lap.rep.index);
      reps.push({ ...work.rep });
      included.push(...next.recovery, work);
      end = next.offset;
      explicit &&= next.explicit;
      manual &&= next.manual;
      next = followingRep(recorded, end, work, family);
    }
    if (reps.length < 2) continue;

    const format = workoutBlockFormat(reps);
    const uniformDistance = uniform(included.map(lap => lap.rep.distance), 1.04);
    const sufficient = explicit || (manual && (reps.length >= 3 || format !== 'mixed')) ||
      (!uniformDistance && (reps.length >= 3 || clearWorkPair(recorded, start, end, family)));
    if (sufficient) {
      const kind = family === 'running' && reps.every(isUphillRep) ? 'uphill' : 'repeats';
      blocks.push({ kind, format, source: 'laps', reps });
    }
    // A suffix of uniform auto splits has the same insufficient evidence.
    if (sufficient || uniformDistance) start = end;
  }
  return blocks;
}
