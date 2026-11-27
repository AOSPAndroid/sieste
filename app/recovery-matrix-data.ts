import { heatMatrix, type HeatMatrix } from './heat-matrix-data';

/** One calendar day: its training load, the sleep of the night that ended that morning, and the morning readings. */
export type RecoveryDay = { iso: string; effort: number | null; sleep: number | null; hrv: number | null; rhr: number | null };
export type RecoveryMetric = 'hrv' | 'rhr';
export const recoveryMetrics: Record<RecoveryMetric, { label: string; title: string; unit: string; digits: number; lowerIsBetter: boolean }> = {
  hrv: { label: 'HRV', title: 'Next-morning HRV', unit: 'ms', digits: 0, lowerIsBetter: false },
  rhr: { label: 'Resting HR', title: 'Next-morning resting heart rate', unit: 'bpm', digits: 1, lowerIsBetter: true },
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const sleepColumns = [{ label: '<6h' }, { label: '6–7' }, { label: '7–8' }, { label: '8–9' }, { label: '≥9h' }];
const sleepColumn = (hours: number) => hours < 6 ? 0 : hours >= 9 ? 4 : 1 + Math.floor(hours - 6);

/**
 * The morning reading by the previous day's training load and the night's sleep.
 * Load bands come from the athlete's own training days: rest, then the lower, middle and upper third.
 */
export function recoveryMatrix(days: readonly RecoveryDay[], metric: RecoveryMetric): HeatMatrix & { bounds: [number, number] | null } {
  const trained = days.map(day => day.effort).filter((value): value is number => finite(value) && value > 0).sort((a, b) => a - b);
  const rows = [{ label: 'Rest' }, { label: 'Light' }, { label: 'Moderate' }, { label: 'Hard' }];
  if (trained.length < 6) return { ...heatMatrix([], rows, sleepColumns), bounds: null };
  const bounds: [number, number] = [trained[Math.floor(trained.length / 3)], trained[Math.floor(trained.length * 2 / 3)]];
  const band = (effort: number) => effort <= 0 ? 0 : effort < bounds[0] ? 1 : effort < bounds[1] ? 2 : 3;
  const points = days.flatMap((day, i) => {
    const before = days[i - 1], value = day[metric];
    if (!before || !finite(before.effort) || !finite(day.sleep) || day.sleep <= 0 || !finite(value) || value <= 0) return [];
    return [{ row: band(before.effort), column: sleepColumn(day.sleep), value }];
  });
  return { ...heatMatrix(points, rows, sleepColumns, { minimum: points.length >= 200 ? 3 : 2, strong: recoveryMetrics[metric].lowerIsBetter ? 'low' : 'high' }), bounds };
}
