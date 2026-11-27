/** One night as the sleep tools already describe it: bedtime in clock minutes, hours asleep and the next-morning readings. */
export type MatrixNight = { date: string; bed: number | null; hours: number | null; rhr: number | null; hrv: number | null; score: number | null };
export type MatrixMetric = 'rhr' | 'hrv' | 'score';
export type MatrixCell = { row: number; column: number; value: number | null; nights: number; level: number | null };
export type MatrixFinding = {
  kind: 'cost' | 'flat';
  early: MatrixCell;
  late: MatrixCell;
  /** Late minus early, in the metric's own unit. */
  difference: number;
};
export type SleepMatrix = {
  metric: MatrixMetric;
  /** Minutes per bedtime row and hours per sleep column: half steps with plenty of nights, whole steps otherwise. */
  rowMinutes: number;
  columnHours: number;
  rows: { start: number; label: string }[];
  columns: { label: string }[];
  cells: MatrixCell[];
  nights: number;
  minimum: number;
  first: string | null;
  last: string | null;
  best: MatrixCell | null;
  finding: MatrixFinding | null;
};

export const matrixMetrics: Record<MatrixMetric, { title: string; unit: string; lowerIsBetter: boolean; digits: number; noun: string }> = {
  rhr: { title: 'Resting heart rate', unit: 'bpm', lowerIsBetter: true, digits: 1, noun: 'resting heart rate' },
  hrv: { title: 'Overnight HRV', unit: 'ms', lowerIsBetter: false, digits: 0, noun: 'HRV' },
  score: { title: 'Sleep score', unit: 'pts', lowerIsBetter: false, digits: 0, noun: 'sleep score' },
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

function columnsFor(step: number) {
  const edges: number[] = [];
  for (let hours = 6; hours <= 9 + 1e-9; hours += step) edges.push(hours);
  const label = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
  return {
    edges,
    labels: [`<${label(edges[0])}h`, ...edges.slice(0, -1).map((from, i) => `${label(from)}–${label(edges[i + 1])}`), `≥${label(edges[edges.length - 1])}h`],
    index: (hours: number) => hours < edges[0] ? 0 : hours >= edges[edges.length - 1] ? edges.length : 1 + Math.floor((hours - edges[0]) / step + 1e-9),
  };
}

/**
 * The metric averaged over nights that share a bedtime and a sleep length.
 * A cell needs at least `minimum` nights; fewer stay blank instead of showing one night as a pattern.
 */
export function sleepMatrix(nights: readonly MatrixNight[], metric: MatrixMetric): SleepMatrix {
  const usable = nights.filter(night => finite(night.bed) && finite(night.hours) && night.hours! > 0 && finite(night[metric]) && night[metric]! > 0 && eveningMinutes(night.bed!) < WINDOW);
  const fine = usable.length >= 240, rowMinutes = fine ? 30 : 60, columnHours = fine ? .5 : 1, minimum = usable.length >= 400 ? 3 : 2;
  const columns = columnsFor(columnHours), sums = new Map<string, { total: number; nights: number }>();
  for (const night of usable) {
    const row = Math.floor(eveningMinutes(night.bed!) / rowMinutes), column = columns.index(night.hours!), key = `${row}:${column}`, cell = sums.get(key) ?? { total: 0, nights: 0 };
    cell.total += night[metric]!; cell.nights += 1; sums.set(key, cell);
  }
  const filled = [...sums].filter(([, cell]) => cell.nights >= minimum).map(([key]) => Number(key.split(':')[0]));
  const dates = usable.map(night => night.date).sort();
  const empty: SleepMatrix = { metric, rowMinutes, columnHours, rows: [], columns: columns.labels.map(label => ({ label })), cells: [], nights: usable.length, minimum, first: dates[0] ?? null, last: dates.at(-1) ?? null, best: null, finding: null };
  if (!filled.length) return empty;
  const firstRow = Math.min(...filled), lastRow = Math.max(...filled), cells: MatrixCell[] = [];
  for (let row = firstRow; row <= lastRow; row++) for (let column = 0; column < columns.labels.length; column++) {
    const cell = sums.get(`${row}:${column}`), known = cell && cell.nights >= minimum;
    cells.push({ row: row - firstRow, column, value: known ? cell!.total / cell!.nights : null, nights: cell?.nights ?? 0, level: null });
  }
  const values = cells.map(cell => cell.value).filter(finite), low = Math.min(...values), high = Math.max(...values), better = matrixMetrics[metric].lowerIsBetter;
  // Level 1 is the best reading in the table, 0 the worst, whichever direction is better for this metric.
  for (const cell of cells) if (cell.value !== null) cell.level = high === low ? .5 : better ? (high - cell.value) / (high - low) : (cell.value - low) / (high - low);
  const known = cells.filter(cell => cell.value !== null);
  const best = known.reduce<MatrixCell | null>((top, cell) => !top || cell.level! > top.level! || cell.level === top.level && cell.nights > top.nights ? cell : top, null);

  // Same hours asleep, later bedtime: the widest bedtime gap inside one column, at least two hours apart.
  let finding: MatrixFinding | null = null;
  for (let column = 0; column < columns.labels.length; column++) {
    const inColumn = known.filter(cell => cell.column === column).sort((a, b) => a.row - b.row);
    for (const early of inColumn) for (const late of inColumn) {
      if ((late.row - early.row) * rowMinutes < 120) continue;
      const difference = late.value! - early.value!, weight = Math.min(early.nights, late.nights);
      const current = finding ? Math.min(finding.early.nights, finding.late.nights) : -1;
      const gap = (late.row - early.row) * rowMinutes, held = finding ? (finding.late.row - finding.early.row) * rowMinutes : -1;
      if (gap > held || gap === held && weight > current) finding = { kind: 'flat', early, late, difference };
    }
  }
  if (finding) {
    const threshold = metric === 'rhr' ? 1 : metric === 'hrv' ? 3 : 3, worse = better ? finding.difference : -finding.difference;
    finding.kind = worse >= threshold ? 'cost' : 'flat';
  }
  const rows = Array.from({ length: lastRow - firstRow + 1 }, (_, i) => ({ start: (firstRow + i) * rowMinutes, label: bedtimeLabel((firstRow + i) * rowMinutes) }));
  return { ...empty, rows, cells, best, finding };
}

/** The headline the table earns, stated only as strongly as the nights behind it allow. */
export function matrixHeadline(matrix: SleepMatrix) {
  const meta = matrixMetrics[matrix.metric], finding = matrix.finding;
  if (!matrix.rows.length) return 'Not enough nights to compare bedtimes yet.';
  if (!finding) return `Your ${meta.noun} by bedtime and hours asleep.`;
  const clock = (EVENING + matrix.rows[finding.late.row].start) % 1440, late = `${Math.floor(clock / 60) % 12 || 12}${clock % 60 ? ':' + String(clock % 60).padStart(2, '0') : ''} ${clock < 720 ? 'am' : 'pm'}`, hours = matrix.columns[finding.late.column].label.replace(/^<(.+)h$/, 'under $1').replace(/^≥(.+)h$/, '$1 or more').replace('–', ' to ');
  if (finding.kind === 'flat') return `Bedtime barely moves your ${meta.noun} when you sleep ${hours} hours.`;
  const size = Math.abs(finding.difference).toFixed(meta.digits === 0 ? 0 : 1);
  return `You can’t cancel out a ${late} bedtime by sleeping ${hours} hours: it costs ${size} ${meta.unit === 'pts' ? 'points' : meta.unit}.`;
}
