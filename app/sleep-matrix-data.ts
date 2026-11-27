import { heatMatrix, type HeatAxis, type HeatMatrix } from './heat-matrix-data';

/** One night as the sleep tools describe it: bedtime in clock minutes, hours asleep and the next-morning readings. */
export type MatrixNight = { date: string; bed: number | null; hours: number | null; rhr: number | null; hrv: number | null; score: number | null };
export type MatrixMetric = 'rhr' | 'hrv' | 'score';
export type SleepMatrix = HeatMatrix & { metric: MatrixMetric; rowMinutes: number; columnHours: number; first: string | null; last: string | null };

export const matrixMetrics: Record<MatrixMetric, { label: string; title: string; unit: string; lowerIsBetter: boolean; digits: number }> = {
  rhr: { label: 'Resting HR', title: 'Resting heart rate', unit: 'bpm', lowerIsBetter: true, digits: 1 },
  hrv: { label: 'HRV', title: 'Overnight HRV', unit: 'ms', lowerIsBetter: false, digits: 0 },
  score: { label: 'Score', title: 'Sleep score', unit: 'pts', lowerIsBetter: false, digits: 0 },
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
// The evening starts at 18:00, so a 23:30 and a 00:30 bedtime are an hour apart, not 23.
const EVENING = 18 * 60;
const WINDOW = 12 * 60;
const eveningMinutes = (bed: number) => ((bed - EVENING) % 1440 + 1440) % 1440;

/** "10pm", "10:30", "1am": the hour carries am/pm, the half hour does not. */
export function bedtimeLabel(minutesAfterSix: number) {
  const clock = (EVENING + minutesAfterSix) % 1440, hour = Math.floor(clock / 60), minute = clock % 60, twelve = hour % 12 || 12;
  return minute ? `${twelve}:${String(minute).padStart(2, '0')}` : `${twelve}${hour < 12 ? 'am' : 'pm'}`;
}

function sleepColumns(step: number) {
  const edges: number[] = [];
  for (let hours = 6; hours <= 9 + 1e-9; hours += step) edges.push(hours);
  const label = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
  return {
    axis: [`<${label(edges[0])}h`, ...edges.slice(0, -1).map((from, i) => `${label(from)}–${label(edges[i + 1])}`), `≥${label(edges[edges.length - 1])}h`].map(text => ({ label: text })) as HeatAxis[],
    index: (hours: number) => hours < edges[0] ? 0 : hours >= edges[edges.length - 1] ? edges.length : 1 + Math.floor((hours - edges[0]) / step + 1e-9),
  };
}

/**
 * The metric averaged over nights that share a bedtime and a sleep length.
 * A cell needs two nights (three with a long history); fewer stay blank instead of showing one night as a pattern.
 */
export function sleepMatrix(nights: readonly MatrixNight[], metric: MatrixMetric): SleepMatrix {
  const usable = nights.filter(night => finite(night.bed) && finite(night.hours) && night.hours! > 0 && finite(night[metric]) && night[metric]! > 0 && eveningMinutes(night.bed!) < WINDOW);
  const fine = usable.length >= 240, rowMinutes = fine ? 30 : 60, columnHours = fine ? .5 : 1, minimum = usable.length >= 400 ? 3 : 2;
  const columns = sleepColumns(columnHours), rows = Array.from({ length: WINDOW / rowMinutes }, (_, i) => ({ label: bedtimeLabel(i * rowMinutes) }));
  const matrix = heatMatrix(usable.map(night => ({ row: Math.floor(eveningMinutes(night.bed!) / rowMinutes), column: columns.index(night.hours!), value: night[metric]! })), rows, columns.axis, { minimum, strong: matrixMetrics[metric].lowerIsBetter ? 'low' : 'high', trimRows: true });
  const dates = usable.map(night => night.date).sort();
  return { ...matrix, metric, rowMinutes, columnHours, first: dates[0] ?? null, last: dates.at(-1) ?? null };
}
