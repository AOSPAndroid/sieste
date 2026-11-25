import { cadenceUnit } from './sports';
import type { WorkoutBlockAnalysis, WorkoutRepAnalysis } from './workout-block-analysis-data';
import type { WorkoutBlock } from './workout-blocks-data';

export type RepTrendMetric = 'pace' | 'heartrate' | 'cadence' | 'stepLength' | 'groundContactTime' | 'power';
export type RepMetricTrend = {
  first: number;
  last: number;
  delta: number;
  direction: 'up' | 'down' | 'steady';
  unit: string;
};

type Trends = Partial<Record<RepTrendMetric, RepMetricTrend>>;
type Form = 'possible-fade' | 'stable' | null;
type Mechanic = 'cadence' | 'stepLength' | 'groundContactTime';

const matchingPace = .03;
const matchingGrade = .005;
const mechanics: readonly Mechanic[] = ['cadence', 'stepLength', 'groundContactTime'];
const mechanicLimits: Record<Mechanic, number> = { cadence: .02, stepLength: .03, groundContactTime: .04 };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

// Direction shows a readable change in the measurement. The form verdict
// applies the wider tolerances separately.
function trend(first: number, last: number, unit: string, minimum = .5): RepMetricTrend {
  const delta = last - first;
  const direction = delta > minimum ? 'up' : delta < -minimum ? 'down' : 'steady';
  return { first, last, delta, direction, unit };
}

function mechanicLimit(key: Mechanic, first: number) {
  return Math.max(key === 'groundContactTime' ? 5 : 0, first * mechanicLimits[key]);
}

function paceTrend(pair: WorkoutBlockAnalysis['comparison']['pace'], family: string) {
  if (!pair || !positive(pair.first) || !positive(pair.last)) return null;
  if (family === 'cycling') {
    const first = 3600 / pair.first;
    return trend(first, 3600 / pair.last, 'km/h', .05);
  }
  const per100 = family === 'swimming';
  const first = per100 ? pair.first / 10 : pair.first;
  return trend(first, per100 ? pair.last / 10 : pair.last, per100 ? 's/100m' : 's/km');
}

function comparableConditions(reps: readonly WorkoutRepAnalysis[]) {
  const measured = reps.flatMap(rep => {
    const { distance, duration, ascent, descent } = rep;
    if (!positive(distance) || !positive(duration) || !nonnegative(ascent) || !nonnegative(descent) ||
      rep.ascentSource === 'estimated' || rep.descentSource === 'estimated') return [];
    return [{ duration, pace: duration / distance * 1000, gain: ascent / distance, loss: descent / distance }];
  });
  if (measured.length !== reps.length) return false;
  const paces = measured.map(rep => rep.pace);
  const durations = measured.map(rep => rep.duration);
  // Opposite slopes can share the same net grade. Compare gain and loss per
  // distance separately, and check individual reps for big pace changes.
  return spread(paces) <= Math.min(...paces) * matchingPace &&
    spread(durations) <= Math.min(...durations) * .15 &&
    spread(measured.map(rep => rep.gain)) <= matchingGrade &&
    spread(measured.map(rep => rep.loss)) <= matchingGrade;
}

function agreedChange(key: Mechanic, expected: 'up' | 'down', metrics: Trends, early: readonly WorkoutRepAnalysis[], late: readonly WorkoutRepAnalysis[]) {
  const metric = metrics[key];
  if (!metric || metric.direction !== expected || Math.abs(metric.delta) <= mechanicLimit(key, metric.first)) return false;
  const first = early.map(rep => rep[key]);
  const last = late.map(rep => rep[key]);
  if (!first.every(positive) || !last.every(positive)) return false;
  return expected === 'up' ? Math.max(...first) < Math.min(...last) : Math.min(...first) > Math.max(...last);
}

function assessForm(metrics: Trends, analysis: WorkoutBlockAnalysis): Form {
  const count = analysis.comparison.repsPerSide;
  const pace = metrics.pace;
  if (count < 2 || analysis.reps.length < count * 2 || !pace || Math.abs(pace.delta) > pace.first * matchingPace) return null;
  const early = analysis.reps.slice(0, count);
  const late = analysis.reps.slice(-count);
  const reps = [...early, ...late];
  if (!comparableConditions(reps)) return null;
  // Cadence and step length are mechanically linked at the same speed.
  // Longer contact and one corroborating signal are stronger than those two alone.
  if (agreedChange('groundContactTime', 'up', metrics, early, late) &&
    (agreedChange('cadence', 'down', metrics, early, late) || agreedChange('stepLength', 'down', metrics, early, late))) return 'possible-fade';

  const measured = mechanics.filter(key => metrics[key]);
  if (!metrics.groundContactTime || measured.length < 2) return null;
  const consistent = measured.every(key => {
    const metric = metrics[key]!;
    const values = reps.map(rep => rep[key]);
    return values.every(positive) && spread(values) <= mechanicLimit(key, metric.first);
  });
  return consistent ? 'stable' : null;
}

/** A first-to-last readout of measured changes, assessed only within one comparable block. */
export function repFormTrend(block: WorkoutBlock, analysis: WorkoutBlockAnalysis, family: string): { metrics: Trends; form: Form } {
  const { comparison } = analysis;
  const metrics: Trends = {};
  if (block.format === 'mixed' || !comparison.repsPerSide) return { metrics, form: null };

  const pace = paceTrend(comparison.pace, family);
  if (pace) metrics.pace = pace;
  const heartrate = comparison.heartrate;
  if (heartrate && positive(heartrate.first) && positive(heartrate.last)) metrics.heartrate = trend(heartrate.first, heartrate.last, 'bpm');
  const cadence = comparison.cadence;
  if (cadence && positive(cadence.first) && positive(cadence.last)) metrics.cadence = trend(cadence.first, cadence.last, cadenceUnit(family));
  const power = comparison.power;
  if (power && nonnegative(power.first) && nonnegative(power.last)) metrics.power = trend(power.first, power.last, 'W');
  if (family !== 'running') return { metrics, form: null };

  const stepLength = comparison.stepLength;
  if (stepLength && positive(stepLength.first) && positive(stepLength.last)) metrics.stepLength = trend(stepLength.first, stepLength.last, 'cm', .05);
  const contact = comparison.groundContactTime;
  if (contact && positive(contact.first) && positive(contact.last)) metrics.groundContactTime = trend(contact.first, contact.last, 'ms');
  return { metrics, form: assessForm(metrics, analysis) };
}
