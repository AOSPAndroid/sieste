import { isUphillRep } from './workout-blocks-data';
import type { WorkoutRepAnalysis } from './workout-block-analysis-data';

export type HillRepMetrics = {
  gain: number;
  grade: number | null;
  climbRate: number | null;
  stepLength: number | null;
  cadence: number | null;
  groundContactTime: number | null;
  estimated: boolean;
  gainEstimated: boolean;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const reading = (value: number | null) => positive(value) ? value : null;

/** Summarize one uphill rep from its aligned terrain and running mechanics. */
export function hillRepMetrics(rep: WorkoutRepAnalysis): HillRepMetrics | null {
  const { ascent, descent, distance, duration, stepLength, cadence, groundContactTime } = rep;
  if (!positive(ascent) || !finite(descent) || descent < 0 || !isUphillRep(rep)) return null;
  const grade = positive(distance) ? (ascent - descent) / distance * 100 : null;
  const climbRate = positive(duration) ? ascent / duration * 60 : null;
  const gainEstimated = rep.ascentSource === 'estimated';
  return {
    gain: ascent,
    grade: finite(grade) ? grade : null,
    climbRate: finite(climbRate) ? climbRate : null,
    stepLength: reading(stepLength),
    cadence: reading(cadence),
    groundContactTime: reading(groundContactTime),
    estimated: gainEstimated || rep.descentSource === 'estimated',
    gainEstimated,
  };
}
