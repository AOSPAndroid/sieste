import type { WorkoutRepAnalysis } from './workout-block-analysis-data';

type Rep = Pick<WorkoutRepAnalysis, 'index' | 'duration' | 'bounds'>;
type Bounds = { start: number; end: number };
type Streams = Partial<Record<string, readonly unknown[]>>;
type Series = { sampleSize?: unknown; data?: Streams };

const sensorRanges = {
  speed: [.25, 15],
  heartrate: [30, 250],
  cadence: [40, 300],
  stepLength: [20, 350],
  groundContactTime: [50, 1000],
  power: [0, 2000],
} as const;

type Sensor = keyof typeof sensorRanges;
const sensors = Object.keys(sensorRanges) as Sensor[];
export type WorkoutRepPhase = Record<Sensor, number | null> & { startSeconds: number; endSeconds: number };

const epsilon = 1e-7;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const samples = (value: readonly unknown[] | undefined) => Array.isArray(value) ? value : [];

function timing(rep: Rep, alignedLap: Bounds | null | undefined, step: number) {
  const bounds = rep.bounds ?? alignedLap;
  if (!bounds || !finite(bounds.start) || !finite(bounds.end) || !finite(rep.duration) || rep.duration <= 0) return null;
  const start = bounds.start * 60;
  const end = bounds.end * 60;
  if (!finite(start) || !finite(end) || start < 0 || end <= start) return null;
  // A significant mismatch with the recorded timer can mix movement with pauses.
  const tolerance = Math.max(1, Math.min(step, rep.duration * .05));
  return Math.abs(end - start - rep.duration) <= tolerance ? { start, end } : null;
}

function hasPause(data: Streams, step: number, first: number, end: number) {
  const speed = samples(data.speed);
  const distance = samples(data.distance);
  let stoppedSeconds = 0;
  for (let i = first; i < end; i++) {
    const motion = speed[i];
    const before = distance[i];
    const after = i + 1 < end ? distance[i + 1] : null;
    const stopped = finite(motion) && motion >= 0
      ? motion < .25
      : finite(before) && finite(after) && after >= before && after - before <= .15 * step;
    stoppedSeconds = stopped ? stoppedSeconds + step : 0;
    if (stoppedSeconds >= 3) return true;
  }
  return false;
}

function phaseAverage(stream: readonly unknown[], key: Sensor, step: number, phase: Bounds, first: number, end: number) {
  const [min, max] = sensorRanges[key];
  const from = Math.max(first, Math.floor(phase.start / step));
  const to = Math.min(end, stream.length, Math.ceil(phase.end / step));
  let count = 0;
  let observedSeconds = 0;
  let weightedTotal = 0;
  for (let i = from; i < to; i++) {
    const value = stream[i];
    if (!finite(value) || value < min || value > max) continue;
    const seconds = Math.min(phase.end, (i + 1) * step) - Math.max(phase.start, i * step);
    if (seconds <= epsilon) continue;
    count++;
    observedSeconds += seconds;
    weightedTotal += value * seconds;
  }
  return count >= 2 && observedSeconds >= (phase.end - phase.start) * .8 - epsilon ? weightedTotal / observedSeconds : null;
}

/** Compare equal portions of one running rep using already aligned, timed samples. */
export function workoutRepPhases(rep: Rep, alignedLap: Bounds | null | undefined, series: Series | null | undefined): { phases: WorkoutRepPhase[] } | null {
  const step = series?.sampleSize;
  const data = series?.data;
  if (!finite(step) || step < .1 || step > 15 || !data) return null;
  const span = timing(rep, alignedLap, step);
  if (!span) return null;

  const duration = span.end - span.start;
  const first = Math.ceil(span.start / step - epsilon);
  const stream = (key: Sensor) => samples(data[key]);
  const end = Math.min(Math.floor(span.end / step + epsilon), Math.max(...sensors.map(key => stream(key).length)));
  // Exclude boundary samples whose buckets extend into an adjacent lap or recovery.
  if (end - first < 4 || hasPause(data, step, first, end)) return null;

  for (const phaseCount of [3, 2]) {
    const phaseSeconds = duration / phaseCount;
    if (phaseSeconds < 2 * step - epsilon) continue;
    const phases = Array.from({ length: phaseCount }, (_, index): WorkoutRepPhase => {
      const startSeconds = index * phaseSeconds;
      const endSeconds = index + 1 === phaseCount ? duration : (index + 1) * phaseSeconds;
      const phase = { start: span.start + startSeconds, end: span.start + endSeconds };
      const average = (key: Sensor) => phaseAverage(stream(key), key, step, phase, first, end);
      return {
        startSeconds,
        endSeconds,
        speed: average('speed'),
        heartrate: average('heartrate'),
        cadence: average('cadence'),
        stepLength: average('stepLength'),
        groundContactTime: average('groundContactTime'),
        power: average('power'),
      };
    });
    if (sensors.some(key => phases.every(phase => phase[key] !== null))) return { phases };
  }
  return null;
}
