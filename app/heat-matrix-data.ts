/** A two-way table of averages, totals or counts, with each filled cell placed on a 0–1 colour scale. */
export type HeatPoint = { row: number; column: number; value: number };
export type HeatCell = { row: number; column: number; value: number | null; count: number; level: number | null };
export type HeatAxis = { label: string; sub?: string };
export type HeatMatrix = {
  rows: HeatAxis[];
  columns: HeatAxis[];
  cells: HeatCell[];
  /** Readings that landed in the table. */
  count: number;
  /** Readings a cell needs before it shows a value. */
  minimum: number;
  /** The most strongly coloured cell; ties go to the cell with more readings. */
  best: HeatCell | null;
};
export type HeatOptions = {
  aggregate?: 'mean' | 'sum' | 'count';
  minimum?: number;
  /** Which end of the scale is coloured strongly. */
  strong?: 'high' | 'low';
  /** Drop empty rows before the first and after the last filled one. */
  trimRows?: boolean;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function heatMatrix(points: readonly HeatPoint[], rows: readonly HeatAxis[], columns: readonly HeatAxis[], { aggregate = 'mean', minimum = 1, strong = 'high', trimRows = false }: HeatOptions = {}): HeatMatrix {
  const sums = new Map<number, { total: number; count: number }>(), key = (row: number, column: number) => row * columns.length + column;
  let count = 0;
  for (const point of points) {
    if (!Number.isInteger(point.row) || !Number.isInteger(point.column) || point.row < 0 || point.row >= rows.length || point.column < 0 || point.column >= columns.length || !finite(point.value)) continue;
    const cell = sums.get(key(point.row, point.column)) ?? { total: 0, count: 0 };
    cell.total += point.value; cell.count += 1; sums.set(key(point.row, point.column), cell); count += 1;
  }
  const filledRows = [...sums].filter(([, cell]) => cell.count >= minimum).map(([index]) => Math.floor(index / columns.length));
  const first = trimRows && filledRows.length ? Math.min(...filledRows) : 0, last = trimRows ? filledRows.length ? Math.max(...filledRows) : -1 : rows.length - 1;
  const cells: HeatCell[] = [];
  for (let row = first; row <= last; row++) for (let column = 0; column < columns.length; column++) {
    const cell = sums.get(key(row, column)), known = !!cell && cell.count >= minimum;
    cells.push({ row: row - first, column, value: known ? aggregate === 'count' ? cell!.count : aggregate === 'sum' ? cell!.total : cell!.total / cell!.count : null, count: cell?.count ?? 0, level: null });
  }
  const values = cells.map(cell => cell.value).filter(finite), low = Math.min(...values), high = Math.max(...values);
  for (const cell of cells) if (cell.value !== null) cell.level = high === low ? .5 : strong === 'low' ? (high - cell.value) / (high - low) : (cell.value - low) / (high - low);
  const best = cells.reduce<HeatCell | null>((top, cell) => cell.level === null ? top : !top || cell.level > top.level! || cell.level === top.level && cell.count > top.count ? cell : top, null);
  return { rows: rows.slice(first, last + 1), columns: [...columns], cells, count, minimum, best };
}
