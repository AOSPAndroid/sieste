import type { WorkoutRepAnalysis } from './workout-block-analysis-data';

type Rep = Pick<WorkoutRepAnalysis, 'index' | 'duration' | 'bounds' | 'recoverySpan'>;
type Bounds = { index: number; start: number; end: number };
type Streams = Partial<Record<string, readonly unknown[]>>;
type Series = { sampleSize?: unknown; data?: Streams };

export type RepTraceMetricKey = 'power' | 'speed' | 'heartrate' | 'cadence' | 'stepLength' | 'groundContactTime' | 'verticalOscillation' | 'verticalRatio';
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
  digits: number;
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
  stepLength: [20, 350],
  groundContactTime: [50, 1000],
  verticalOscillation: [1, 30],
  verticalRatio: [1, 30],
};
// Seconds of centred smoothing: power and GPS speed are noisy sample to sample.
const smoothing: Record<RepTraceMetricKey, number> = { power: 10, speed: 10, heartrate: 0, cadence: 5, stepLength: 10, groundContactTime: 10, verticalOscillation: 10, verticalRatio: 10 };

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
  const candidates: (Pick<RepTraceMetric, 'key' | 'label' | 'unit' | 'pace'> & { digits?: number })[] = [
    ...(family === 'cycling' ? [{ key: 'power' as const, label: 'Power', unit: 'W', pace: false }] : []),
    { key: 'speed', label: pace ? 'Pace' : 'Speed', unit: pace ? (family === 'swimming' ? '/100m' : '/km') : 'km/h', pace },
    { key: 'heartrate', label: 'Heart rate', unit: 'bpm', pace: false },
    { key: 'cadence', label: 'Cadence', unit: family === 'cycling' ? 'rpm' : 'spm', pace: false },
    ...(family !== 'cycling' ? [{ key: 'power' as const, label: 'Power', unit: 'W', pace: false }] : []),
    ...(family === 'running' ? [
      { key: 'stepLength' as const, label: 'Step length', unit: 'cm', pace: false },
      { key: 'groundContactTime' as const, label: 'Ground contact', unit: 'ms', pace: false },
      { key: 'verticalOscillation' as const, label: 'Vertical movement', unit: 'cm', pace: false, digits: 1 },
      { key: 'verticalRatio' as const, label: 'Vertical ratio', unit: '%', pace: false, digits: 1 },
    ] : []),
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
      digits: metric.digits ?? 0,
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
export function traceValueLabel(metric: Pick<RepTraceMetric, 'key' | 'pace' | 'unit'> & { digits?: number }, value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  if (metric.key !== 'speed') return value.toLocaleString('en-GB', { minimumFractionDigits: metric.digits ?? 0, maximumFractionDigits: metric.digits ?? 0 });
  if (!metric.pace) return (value * 3.6).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (value <= 0) return '—';
  const seconds = Math.round((metric.unit === '/100m' ? 100 : 1000) / value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export type RepMechanicRow = {
  key: RepTraceMetricKey;
  label: string;
  unit: string;
  digits: number;
  early: number;
  late: number;
  /** Late minus early, and the average second-half minus first-half change inside a rep. */
  across: number;
  within: number | null;
  /** The change runs the way tiring form does and is larger than rep-to-rep noise. */
  tiring: boolean;
};
export type RepMechanics = {
  rows: RepMechanicRow[];
  /** How many reps each side of the comparison averages. */
  side: number;
  /** Late pace relative to early; mechanics follow speed, so a verdict needs this near zero. */
  paceChange: number | null;
  verdict: 'tiring' | 'held' | 'mixed' | 'pace-changed';
};

// Which way each measure moves as form tires, and the share of its early value that counts as a real shift.
const tiringSigns: Partial<Record<RepTraceMetricKey, [direction: 1 | -1, share: number, floor: number]>> = {
  cadence: [-1, .02, 2],
  stepLength: [-1, .02, 2],
  groundContactTime: [1, .025, 5],
  verticalOscillation: [1, .05, .3],
  verticalRatio: [1, .05, .3],
};
const SAME_PACE = .03;

function meanOf(values: readonly (number | null)[]) {
  const known = values.filter(finite);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

/** Running mechanics from the early reps to the late ones, read only as far as pace allows. */
export function repMechanics(metrics: readonly RepTraceMetric[]): RepMechanics | null {
  const count = Math.min(...metrics.map(metric => metric.traces.length));
  if (!metrics.length || count < 2) return null;
  const side = count >= 4 ? 2 : 1;
  const ends = (metric: RepTraceMetric) => ({
    early: meanOf(metric.traces.slice(0, side).map(trace => trace.mean)),
    late: meanOf(metric.traces.slice(-side).map(trace => trace.mean)),
  });
  const rows = metrics.flatMap((metric): RepMechanicRow[] => {
    const sign = tiringSigns[metric.key];
    if (!sign) return [];
    const { early, late } = ends(metric);
    if (early === null || late === null || early <= 0) return [];
    const [direction, share, floor] = sign, across = late - early;
    const within = meanOf(metric.traces.map(trace => trace.firstHalf !== null && trace.secondHalf !== null ? trace.secondHalf - trace.firstHalf : null));
    return [{ key: metric.key, label: metric.label, unit: metric.unit, digits: metric.digits, early, late, across, within,
      tiring: across * direction >= Math.max(floor, early * share) }];
  });
  if (!rows.length) return null;
  const speed = metrics.find(metric => metric.key === 'speed');
  const pace = speed ? ends(speed) : null;
  const paceChange = pace && pace.early !== null && pace.late !== null && pace.early > 0 ? pace.late / pace.early - 1 : null;
  const tiring = rows.filter(row => row.tiring);
  // Step length and cadence trade against each other at one speed, so contact time or two signals are needed.
  const verdict = paceChange === null || Math.abs(paceChange) > SAME_PACE ? 'pace-changed'
    : tiring.length >= 2 || tiring.some(row => row.key === 'groundContactTime') ? 'tiring'
    : tiring.length === 0 ? 'held' : 'mixed';
  return { rows, side, paceChange, verdict };
}
