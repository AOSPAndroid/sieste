import type { WorkoutBlock, WorkoutBlockRep } from './workout-blocks-data';

type Mechanic = 'cadence' | 'stepLength' | 'groundContactTime';
type MetricPair = { first: number; last: number };
type LapBounds = { index: number; start: number; end: number };
type Interval = { start: number; end: number };
type Detail = {
  [key: string]: unknown;
  laps?: readonly unknown[];
  seriesSampled?: {
    sampleSize?: unknown;
    data?: Partial<Record<string, readonly unknown[]>>;
  };
};

export type WorkoutRepRecovery = {
  index: number | null;
  duration: number;
  startHr: number | null;
  endHr: number | null;
  hrDrop: number | null;
};

export type WorkoutRepAnalysis = WorkoutBlockRep & Record<Mechanic, number | null> & {
  recovery: WorkoutRepRecovery | null;
};

export type WorkoutBlockAnalysis = {
  reps: WorkoutRepAnalysis[];
  comparison: Record<Mechanic | 'pace' | 'heartrate' | 'power', MetricPair | null> & { repsPerSide: number };
  recovery: {
    count: number;
    averageDuration: number | null;
    measuredCount: number;
    averageHrDrop: number | null;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const validHeartRate = (value: unknown): value is number => positive(value) && value < 300;
const mechanicRange: Record<Mechanic, [number, number]> = {
  cadence: [40, 300],
  stepLength: [20, 350],
  groundContactTime: [50, 1000],
};

function lapValues(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return isRecord(value.summary) ? { ...value, ...value.summary } : value;
}

function seconds(bounds: Pick<LapBounds, 'start' | 'end'>): Interval | null {
  if (!finite(bounds.start) || !finite(bounds.end) || bounds.start < 0 || bounds.end <= bounds.start) return null;
  return { start: bounds.start * 60, end: bounds.end * 60 };
}

function validMechanic(value: unknown, key: Mechanic, family: string): value is number {
  const [min, max] = key === 'cadence' && family !== 'running' ? [1, 300] : mechanicRange[key];
  return finite(value) && value >= min && value <= max;
}

function sampledMean(samples: readonly unknown[] | undefined, step: number | null, interval: Interval | undefined, valid: (value: unknown) => value is number) {
  if (!Array.isArray(samples) || !step || !interval) return null;
  const duration = interval.end - interval.start;
  if (duration < step) return null;
  const first = Math.floor(interval.start / step);
  const end = Math.min(samples.length, Math.ceil(interval.end / step));
  let sum = 0;
  let weight = 0;
  for (let i = first; i < end; i++) {
    const value = samples[i];
    if (!valid(value)) continue;
    const overlap = Math.min(interval.end, (i + 1) * step) - Math.max(interval.start, i * step);
    sum += value * overlap;
    weight += overlap;
  }
  return weight >= duration * .8 ? sum / weight : null;
}

function mechanicReading(key: Mechanic, recorded: unknown, samples: readonly unknown[] | undefined, step: number | null, interval: Interval | undefined, family: string) {
  return validMechanic(recorded, key, family)
    ? recorded
    : sampledMean(samples, step, interval, (value): value is number => validMechanic(value, key, family));
}

function endingHeartRate(samples: readonly unknown[], step: number, interval: Interval) {
  const width = Math.max(10, step);
  if (interval.end - interval.start < width) return null;
  // Take readings inside this lap only, with support along its closing window.
  const epsilon = 1e-7;
  const first = Math.ceil((interval.end - width - epsilon) / step);
  const last = Math.ceil((interval.end - epsilon) / step) - 1;
  const before = samples[last];
  if (first > last || !validHeartRate(before)) return null;
  // A coarse sample can land several seconds from the boundary. If the
  // readings bracketing it disagree, one of them is not a sound endpoint.
  if (step > 5) {
    const after = samples[last + 1];
    if (!validHeartRate(after) || Math.abs(before - after) > 8) return null;
  }
  let sum = 0;
  let count = 0;
  for (let i = first; i <= last; i++) {
    const value = samples[i];
    if (!validHeartRate(value)) continue;
    sum += value;
    count++;
  }
  return count >= (last - first + 1) * .8 ? sum / count : null;
}

function recordedRecovery(rep: WorkoutBlockRep, next: WorkoutBlockRep, detail: Detail, bounds: Map<number, Interval>) {
  const indices = rep.recoveryLaps ?? (next.index === rep.index + 2 ? [rep.index + 1] : []);
  if (!indices.length || next.index !== rep.index + indices.length + 1 ||
    indices.some((index, i) => index !== rep.index + i + 1)) return null;
  let duration = 0;
  let interval = bounds.get(indices[0]);
  for (const [i, index] of indices.entries()) {
    const lap = lapValues(detail.laps?.[index - 1]);
    const time = positive(lap.duration) ? lap.duration : lap.durationTotal;
    if (!positive(time)) return null;
    duration += time;
    if (!i) continue;
    const span = bounds.get(index);
    interval = interval && span && Math.abs(interval.end - span.start) < 1e-6
      ? { start: interval.start, end: span.end }
      : undefined;
  }
  return { index: indices[0], duration, interval };
}

function recoveryAfter(rep: WorkoutBlockRep, next: WorkoutBlockRep | undefined, detail: Detail, bounds: Map<number, Interval>, step: number | null): WorkoutRepRecovery | null {
  if (!next) return null;
  const estimated = rep.recoverySpan && seconds(rep.recoverySpan);
  const rest = rep.bounds
    ? estimated && { index: null, duration: estimated.end - estimated.start, interval: estimated }
    : recordedRecovery(rep, next, detail, bounds);
  if (!rest) return null;
  const work = rep.bounds ? seconds(rep.bounds) : bounds.get(rep.index);
  const recovery = rest.interval;
  const samples = detail.seriesSampled?.data?.heartrate;
  let startHr: number | null = null;
  let endHr: number | null = null;
  if (work && recovery && Array.isArray(samples) && step && Math.abs(work.end - recovery.start) < 1e-6) {
    startHr = endingHeartRate(samples, step, work);
    endHr = endingHeartRate(samples, step, recovery);
  }
  return {
    index: rest.index,
    duration: rest.duration,
    startHr,
    endHr,
    hrDrop: startHr !== null && endHr !== null ? startHr - endHr : null,
  };
}

function average(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function summarizeRecovery(reps: readonly WorkoutRepAnalysis[]): WorkoutBlockAnalysis['recovery'] {
  const recoveries = reps.flatMap(rep => rep.recovery ? [rep.recovery] : []);
  const measuredDrops = recoveries.flatMap(recovery => recovery.hrDrop !== null ? [recovery.hrDrop] : []);
  return {
    count: recoveries.length,
    averageDuration: average(recoveries.map(recovery => recovery.duration)),
    measuredCount: measuredDrops.length,
    averageHrDrop: average(measuredDrops),
  };
}

/** Join analyzed reps in workout order, retaining recovery only within its original set. */
export function combineWorkoutBlockAnalyses(analyses: readonly WorkoutBlockAnalysis[]): Pick<WorkoutBlockAnalysis, 'reps' | 'recovery'> {
  const byIndex = new Map<number, WorkoutRepAnalysis>();
  for (const analysis of analyses) {
    for (const rep of analysis.reps) {
      if (!byIndex.has(rep.index)) byIndex.set(rep.index, rep);
    }
  }
  const reps = [...byIndex.values()].sort((a, b) => a.index - b.index);
  return { reps, recovery: summarizeRecovery(reps) };
}

function comparablePace(reps: readonly WorkoutRepAnalysis[]) {
  const distances = reps.map(rep => rep.distance);
  const distance = distances.every(positive) ? distances.reduce((sum, value) => sum + value, 0) : 0;
  return distance > 0 ? reps.reduce((sum, rep) => sum + rep.duration, 0) / distance * 1000 : null;
}

function comparableMetric(reps: readonly WorkoutRepAnalysis[], key: Mechanic | 'heartrate' | 'power') {
  const values = reps.map(rep => rep[key]);
  return values.every(finite) ? average(values) : null;
}

/** Use the same aligned lap bounds as the activity profile. Input bounds are in minutes. */
export function analyzeWorkoutBlock(block: WorkoutBlock, detail: Detail, alignedLaps: readonly LapBounds[], family = 'running'): WorkoutBlockAnalysis {
  const bounds = new Map<number, Interval>();
  for (const lap of alignedLaps) {
    const interval = seconds(lap);
    if (interval) bounds.set(lap.index, interval);
  }
  const step = detail.seriesSampled?.sampleSize;
  const sampleStep = positive(step) && step <= 15 ? step : null;
  const data = detail.seriesSampled?.data;
  const reps = block.reps.map((rep, i): WorkoutRepAnalysis => {
    const lap = lapValues(rep.bounds ? undefined : detail.laps?.[rep.index - 1]);
    const interval = (rep.bounds ? seconds(rep.bounds) : bounds.get(rep.index)) ?? undefined;
    return {
      ...rep,
      heartrate: validHeartRate(rep.heartrate) ? rep.heartrate : sampledMean(data?.heartrate, sampleStep, interval, validHeartRate),
      power: finite(rep.power) && rep.power >= 0 ? rep.power : sampledMean(data?.power, sampleStep, interval, (value): value is number => finite(value) && value >= 0),
      cadence: mechanicReading('cadence', lap.cadence, data?.cadence, sampleStep, interval, family),
      stepLength: family === 'running' ? mechanicReading('stepLength', lap.stepLength, data?.stepLength, sampleStep, interval, family) : null,
      groundContactTime: family === 'running' ? mechanicReading('groundContactTime', lap.groundContactTime, data?.groundContactTime, sampleStep, interval, family) : null,
      recovery: recoveryAfter(rep, block.reps[i + 1], detail, bounds, sampleStep),
    };
  });

  const repsPerSide = block.format === 'mixed' ? 0 : Math.min(2, Math.floor(reps.length / 2));
  const early = reps.slice(0, repsPerSide);
  const late = reps.slice(reps.length - repsPerSide);
  const compare = (key: Mechanic | 'pace' | 'heartrate' | 'power'): MetricPair | null => {
    if (!repsPerSide) return null;
    const read = (group: WorkoutRepAnalysis[]) => key === 'pace' ? comparablePace(group) : comparableMetric(group, key);
    const first = read(early);
    const last = read(late);
    return first !== null && last !== null ? { first, last } : null;
  };
  return {
    reps,
    comparison: {
      repsPerSide,
      pace: compare('pace'),
      heartrate: compare('heartrate'),
      power: compare('power'),
      cadence: compare('cadence'),
      stepLength: compare('stepLength'),
      groundContactTime: compare('groundContactTime'),
    },
    recovery: summarizeRecovery(reps),
  };
}
