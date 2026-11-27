import type { WorkoutRepAnalysis } from './workout-block-analysis-data';

type Rep = Pick<WorkoutRepAnalysis, 'index' | 'duration' | 'bounds' | 'recoverySpan'>;
type Bounds = { index: number; start: number; end: number };
type Streams = Partial<Record<string, readonly unknown[]>>;
type Series = { sampleSize?: unknown; data?: Streams };

export type RepTraceMetricKey = 'power' | 'speed' | 'heartrate' | 'cadence';
export type RepTracePoint = { t: number; value: number | null };
export type RepTrace = {
  index: number;
  ordinal: number;
  /** Seconds of work; samples after it belong to the recovery. */
  work: number;
  points: RepTracePoint[];
  mean: number | null;
  firstHalf: number | null;
  secondHalf: number | null;
  peak: number | null;
  /** Heart rate only: the last work reading and the reading 60 seconds into the recovery. */
  endValue: number | null;
  after60: number | null;
};
export type RepTraceMetric = {
  key: RepTraceMetricKey;
  label: string;
  unit: string;
  /** Running and swimming speed is read as pace; the scale stays in speed so faster is higher. */
  pace: boolean;
  traces: RepTrace[];
  domain: [number, number];
  /** Longest work duration and the furthest sample drawn, in seconds. */
  work: number;
  extent: number;
  uniform: boolean;
};

const MAX_STEP = 10;
const RECOVERY_TAIL = 90;
const ranges: Record<RepTraceMetricKey, [number, number]> = {
  power: [0, 2500],
  speed: [.3, 30],
  heartrate: [30, 250],
  cadence: [20, 300],
};
// Seconds of centred smoothing: power and GPS speed are noisy sample to sample.
const smoothing: Record<RepTraceMetricKey, number> = { power: 10, speed: 10, heartrate: 0, cadence: 5 };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function reading(stream: readonly unknown[], key: RepTraceMetricKey, index: number) {
  const value = stream[index];
  const [min, max] = ranges[key];
  // Recorded zero power is coasting, a real value; zero speed, heart rate or cadence is a gap.
  return finite(value) && value >= min && value <= max ? value : null;
}

function smoothed(stream: readonly unknown[], key: RepTraceMetricKey, index: number, radius: number, from: number, to: number) {
  if (reading(stream, key, index) === null) return null;
  let total = 0, count = 0;
  for (let i = Math.max(from, index - radius); i <= Math.min(to - 1, index + radius); i++) {
    const value = reading(stream, key, i);
    if (value !== null) { total += value; count++; }
  }
  return count ? total / count : null;
}

function average(points: readonly RepTracePoint[], from: number, to: number) {
  let total = 0, count = 0;
  for (const point of points) if (point.value !== null && point.t >= from && point.t < to) { total += point.value; count++; }
  return count ? total / count : null;
}

function percentile(sorted: readonly number[], share: number) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * share)))];
}

function repSeconds(rep: Rep, aligned: Map<number, Bounds>, step: number) {
  const bounds = rep.bounds ?? aligned.get(rep.index);
  if (!bounds || !finite(bounds.start) || !finite(bounds.end) || !finite(rep.duration) || rep.duration <= 0) return null;
  const start = bounds.start * 60, end = bounds.end * 60;
  if (start < 0 || end <= start) return null;
  // A lap placed by distance can sit a sample or two off its timer; a larger gap means pauses were mixed in.
  return Math.abs(end - start - rep.duration) <= Math.max(2 * step, rep.duration * .1) ? { start, end } : null;
}

/**
 * Every rep's samples on a shared clock that starts with the rep, so their shapes can be laid over each other.
 * Heart rate keeps up to 90 seconds of the recovery that follows, stopping before the next rep.
 */
export function repTraces(reps: readonly Rep[], alignedLaps: readonly Bounds[], series: Series | null | undefined, family: string): RepTraceMetric[] {
  const step = series?.sampleSize, data = series?.data;
  if (!finite(step) || step <= 0 || step > MAX_STEP || !data || reps.length < 2) return [];
  const aligned = new Map(alignedLaps.map(lap => [lap.index, lap]));
  const spans = reps.map(rep => repSeconds(rep, aligned, step));
  const pace = family !== 'cycling';
  const candidates: Pick<RepTraceMetric, 'key' | 'label' | 'unit' | 'pace'>[] = [
    ...(family === 'cycling' ? [{ key: 'power' as const, label: 'Power', unit: 'W', pace: false }] : []),
    { key: 'speed', label: pace ? 'Pace' : 'Speed', unit: pace ? (family === 'swimming' ? '/100m' : '/km') : 'km/h', pace },
    { key: 'heartrate', label: 'Heart rate', unit: 'bpm', pace: false },
    { key: 'cadence', label: 'Cadence', unit: family === 'cycling' ? 'rpm' : 'spm', pace: false },
    ...(family !== 'cycling' ? [{ key: 'power' as const, label: 'Power', unit: 'W', pace: false }] : []),
  ];

  return candidates.flatMap(metric => {
    const stream = data[metric.key];
    if (!Array.isArray(stream)) return [];
    const radius = Math.floor(smoothing[metric.key] / step / 2);
    const traces: RepTrace[] = [];
    reps.forEach((rep, position) => {
      const span = spans[position];
      if (!span) return;
      const first = Math.round(span.start / step), last = Math.min(stream.length, Math.round(span.end / step));
      if (last - first < 3) return;
      const next = spans.slice(position + 1).find(Boolean);
      const recovery = metric.key === 'heartrate'
        ? Math.max(0, Math.min(RECOVERY_TAIL, (next ? next.start : stream.length * step) - span.end)) : 0;
      const stop = Math.min(stream.length, last + Math.floor(recovery / step));
      const points: RepTracePoint[] = [];
      for (let i = first; i < stop; i++) {
        // Smoothing never reaches across the end of the work into the recovery, or back.
        const value = i < last ? smoothed(stream, metric.key, i, radius, first, last) : smoothed(stream, metric.key, i, radius, last, stop);
        points.push({ t: (i - first) * step, value });
      }
      const work = (last - first) * step;
      const valid = points.filter(point => point.value !== null && point.t < work);
      // A rep that is mostly gaps would draw a misleading shape.
      if (valid.length < (last - first) * .6) return;
      const tail = average(points, work - Math.max(5, step), work);
      const later = average(points, work + 60 - Math.max(3, step), work + 60 + Math.max(3, step));
      traces.push({
        index: rep.index,
        ordinal: position + 1,
        work,
        points,
        mean: average(points, 0, work),
        firstHalf: average(points, 0, work / 2),
        secondHalf: average(points, work / 2, work),
        peak: Math.max(...valid.map(point => point.value!)),
        endValue: metric.key === 'heartrate' ? tail : null,
        after60: metric.key === 'heartrate' && recovery >= 60 ? later : null,
      });
    });
    if (traces.length < 2) return [];
    const values = traces.flatMap(trace => trace.points.flatMap(point => point.value === null ? [] : [point.value])).sort((a, b) => a - b);
    // Trim the extreme one percent each side so a single spike cannot flatten every line.
    const low = percentile(values, .01), high = percentile(values, .99), pad = Math.max((high - low) * .08, high * .01, 1e-6);
    const work = Math.max(...traces.map(trace => trace.work));
    return [{
      ...metric,
      traces,
      domain: [Math.max(0, low - pad), high + pad],
      work,
      extent: Math.max(...traces.map(trace => trace.points.at(-1)!.t + step)),
      uniform: Math.min(...traces.map(trace => trace.work)) >= work * .9,
    }];
  });
}

/** The value of one trace at a time on the rep clock, or null in a gap or past its end. */
export function traceValueAt(trace: RepTrace, seconds: number) {
  const { points } = trace;
  if (!points.length || seconds < 0) return null;
  const step = points.length > 1 ? points[1].t - points[0].t : 1;
  const point = points[Math.round(seconds / step)];
  return point && Math.abs(point.t - seconds) <= step ? point.value : null;
}

/** Speed in m/s as a label: pace per km or 100 m for foot and swim, km/h for cycling. */
export function traceValueLabel(metric: Pick<RepTraceMetric, 'key' | 'pace' | 'unit'>, value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  if (metric.key !== 'speed') return Math.round(value).toLocaleString('en-GB');
  if (!metric.pace) return (value * 3.6).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (value <= 0) return '—';
  const seconds = Math.round((metric.unit === '/100m' ? 100 : 1000) / value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
