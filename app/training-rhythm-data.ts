import { heatMatrix, type HeatMatrix } from './heat-matrix-data';

export type RhythmMetric = 'sessions' | 'hours' | 'distance';
export type RhythmActivity = { date: string; summary?: { duration?: number | null; distance?: number | null } | null };
export const rhythmMetrics: Record<RhythmMetric, { label: string; title: string; unit: string; digits: number }> = {
  sessions: { label: 'Sessions', title: 'Sessions', unit: 'sessions', digits: 0 },
  hours: { label: 'Time', title: 'Training time', unit: 'h', digits: 1 },
  distance: { label: 'Distance', title: 'Distance', unit: 'km', digits: 0 },
};

const BAND = 2;
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const bands = Array.from({ length: 24 / BAND }, (_, i) => ({ label: `${String(i * BAND).padStart(2, '0')}–${String(i * BAND + BAND).padStart(2, '0')}` }));

/** When training happens: start time in two-hour bands against the weekday, in the device's local time. */
export function trainingRhythm(activities: readonly RhythmActivity[], metric: RhythmMetric): HeatMatrix {
  const points = activities.flatMap(activity => {
    const start = new Date(activity.date);
    if (Number.isNaN(start.getTime())) return [];
    const value = metric === 'sessions' ? 1 : metric === 'hours' ? (activity.summary?.duration ?? NaN) / 3600 : (activity.summary?.distance ?? NaN) / 1000;
    if (!Number.isFinite(value) || value < 0 || metric !== 'sessions' && value === 0) return [];
    return [{ row: Math.floor(start.getHours() / BAND), column: (start.getDay() + 6) % 7, value }];
  });
  return heatMatrix(points, bands, weekdays.map(label => ({ label })), { aggregate: metric === 'sessions' ? 'count' : 'sum', trimRows: true });
}
