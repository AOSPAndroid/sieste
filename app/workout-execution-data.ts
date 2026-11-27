import type { RepMechanics, RepTraceMetric, RepTraceMetricKey } from './workout-rep-traces-data';

export type RatingLevel = 'excellent' | 'good' | 'fair' | 'poor';
export type ExecutionPart = {
  key: 'consistency' | 'pacing' | 'finish' | 'recovery' | 'form';
  label: string;
  level: RatingLevel;
  /** The measured figure behind the level, ready to show. */
  detail: string;
};
export type ExecutionRating = { score: number; level: RatingLevel; parts: ExecutionPart[]; headline: string };
export type MechanicBand = { level: RatingLevel; label: string; range: string };

const points: Record<RatingLevel, number> = { excellent: 100, good: 80, fair: 55, poor: 30 };
const weights: Record<ExecutionPart['key'], number> = { consistency: 30, finish: 25, pacing: 20, form: 15, recovery: 10 };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function mean(values: readonly (number | null)[]) {
  const known = values.filter(finite);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

function percent(share: number, signed = false) {
  const size = Math.abs(share * 100), text = size < 10 ? size.toFixed(1) : String(Math.round(size));
  return `${signed ? (share < 0 ? '−' : '+') : ''}${text}%`;
}

/** Lower is better: the first limit the value fits under names the level. */
function under(value: number, excellent: number, good: number, fair: number): RatingLevel {
  return value <= excellent ? 'excellent' : value <= good ? 'good' : value <= fair ? 'fair' : 'poor';
}

/**
 * How well a set of like reps was carried out: the same output every rep, even effort inside each rep,
 * no fade at the end, heart rate still recovering, and (for runs) form that held.
 * Sets of mixed rep lengths are not rated, since their outputs differ by design.
 */
export function rateExecution(metrics: readonly RepTraceMetric[], mechanics: RepMechanics | null, family: string): ExecutionRating | null {
  const output = metrics.find(metric => metric.key === (family === 'cycling' ? 'power' : 'speed')) ?? metrics.find(metric => metric.key === 'speed');
  if (!output || !output.uniform || output.traces.length < 3) return null;
  const means = output.traces.map(trace => trace.mean).filter(finite);
  const average = mean(means);
  if (means.length < 3 || average === null || average <= 0) return null;
  const name = output.key === 'power' ? 'power' : output.pace ? 'pace' : 'speed';
  const parts: ExecutionPart[] = [];

  // Largest distance of any rep from the set's average output.
  const spread = Math.max(...means.map(value => Math.abs(value / average - 1)));
  parts.push({ key: 'consistency', label: 'Rep-to-rep consistency', level: under(spread, .015, .03, .05),
    detail: `Every rep within ${percent(spread)} of the set's average ${name}` });

  const halves = output.traces.flatMap(trace => trace.firstHalf !== null && trace.secondHalf !== null && trace.firstHalf > 0
    ? [Math.abs(trace.secondHalf / trace.firstHalf - 1)] : []);
  if (halves.length) {
    const uneven = mean(halves)!;
    parts.push({ key: 'pacing', label: 'Pacing inside reps', level: under(uneven, .02, .04, .06),
      detail: `${percent(uneven)} average shift between the halves of a rep` });
  }

  const side = means.length >= 4 ? 2 : 1;
  const early = mean(means.slice(0, side))!, late = mean(means.slice(-side))!, finish = late / early - 1;
  parts.push({ key: 'finish', label: 'Finish', level: under(-finish, .01, .03, .05),
    detail: Math.abs(finish) < .005 ? `Held ${name} to the end` : `${finish > 0 ? 'Built' : 'Faded'} ${percent(Math.abs(finish))} from the first ${side > 1 ? `${side} reps to the last ${side}` : 'rep to the last'}` });

  const heart = metrics.find(metric => metric.key === 'heartrate');
  const drops = (heart?.traces ?? []).flatMap(trace => trace.endValue !== null && trace.after60 !== null ? [trace.endValue - trace.after60] : []);
  // The last rep often runs into the cool-down, so recovery needs at least three measured rests.
  if (drops.length >= 3 && drops[0] > 5) {
    const kept = drops.at(-1)! / drops[0];
    parts.push({ key: 'recovery', label: 'Recovery between reps', level: under(1 - kept, .1, .25, .4),
      detail: `Heart rate fell ${Math.round(drops[0])} bpm in the first minute after rep 1, ${Math.round(drops.at(-1)!)} after the last measured rest` });
  }

  if (family === 'running' && mechanics && mechanics.verdict !== 'pace-changed') {
    const shifted = mechanics.rows.filter(row => row.tiring).map(row => row.label.toLowerCase());
    parts.push({ key: 'form', label: 'Form under fatigue', level: mechanics.verdict === 'held' ? 'excellent' : mechanics.verdict === 'mixed' ? 'good' : 'fair',
      detail: shifted.length ? `Shifted late in the set: ${shifted.join(', ')}` : 'Mechanics held from the first reps to the last' });
  }

  const total = parts.reduce((sum, part) => sum + weights[part.key], 0);
  const score = Math.round(parts.reduce((sum, part) => sum + points[part.level] * weights[part.key], 0) / total);
  const level: RatingLevel = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 55 ? 'fair' : 'poor';
  const weakest = [...parts].sort((a, b) => points[a.level] - points[b.level] || weights[b.key] - weights[a.key])[0];
  const headline = weakest.level === 'excellent' ? 'Carried out as evenly as a set can be.'
    : `${level === 'excellent' || level === 'good' ? 'Well executed' : level === 'fair' ? 'Uneven execution' : 'The set came apart'}; ${weakest.label.toLowerCase()} cost the most.`;
  return { score, level, parts, headline };
}

// Reference bands for trained recreational runners at steady to hard paces, best first.
// They place a reading among runners in general; they are not a personal target.
const bands: Partial<Record<RepTraceMetricKey, { higherIsBetter: boolean; limits: [number, number, number]; unit: string }>> = {
  cadence: { higherIsBetter: true, limits: [183, 174, 164], unit: 'spm' },
  groundContactTime: { higherIsBetter: false, limits: [218, 248, 277], unit: 'ms' },
  verticalOscillation: { higherIsBetter: false, limits: [6.4, 8.1, 9.7], unit: 'cm' },
  verticalRatio: { higherIsBetter: false, limits: [6.1, 7.4, 8.6], unit: '%' },
};
const bandLabels: Record<RatingLevel, string> = { excellent: 'Excellent', good: 'Good', fair: 'Average', poor: 'Needs work' };

/** Where a mechanics reading sits among runners in general. Step length depends on pace and height, so it has no band. */
export function mechanicBand(key: RepTraceMetricKey, value: number | null): MechanicBand | null {
  const band = bands[key];
  if (!band || !finite(value)) return null;
  const [excellent, good, fair] = band.limits;
  const level: RatingLevel = band.higherIsBetter
    ? value >= excellent ? 'excellent' : value >= good ? 'good' : value >= fair ? 'fair' : 'poor'
    : under(value, excellent, good, fair);
  const sign = band.higherIsBetter ? '≥' : '≤';
  const range = level === 'excellent' ? `${sign} ${excellent} ${band.unit}`
    : level === 'poor' ? `${band.higherIsBetter ? '<' : '>'} ${fair} ${band.unit}`
    : `good is ${sign} ${good} ${band.unit}`;
  return { level, label: bandLabels[level], range };
}
