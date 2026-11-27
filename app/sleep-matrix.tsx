'use client';
import './sleep-matrix.css';
import { useMemo, useState } from 'react';
import type { AthleteData } from './analytics';
import { sleepToolsData } from './sleep-tools-data';
import { dateLabel } from './date-label';
import { matrixHeadline, matrixMetrics, sleepMatrix, type MatrixCell, type MatrixMetric } from './sleep-matrix-data';

const HISTORY_DAYS = 730;
const order: MatrixMetric[] = ['rhr', 'hrv', 'score'];

/** Bedtime against hours asleep, coloured by the next-morning reading, from every recorded night. */
export default function SleepMatrix({ data, end }: { data: AthleteData; end: string }) {
  const nights = useMemo(() => sleepToolsData(data, end, HISTORY_DAYS, 8).rows, [data, end]);
  const tables = useMemo(() => Object.fromEntries(order.map(metric => [metric, sleepMatrix(nights, metric)])) as Record<MatrixMetric, ReturnType<typeof sleepMatrix>>, [nights]);
  const available = order.filter(metric => tables[metric].rows.length > 0);
  const [choice, setChoice] = useState<MatrixMetric | null>(null);
  const [focus, setFocus] = useState<MatrixCell | null>(null);
  if (!available.length) return null;
  const metric = choice && available.includes(choice) ? choice : available[0], matrix = tables[metric], meta = matrixMetrics[metric];
  const marked = new Set([matrix.finding?.early, matrix.finding?.late].filter(Boolean).map(cell => `${cell!.row}:${cell!.column}`));
  const value = (cell: MatrixCell) => cell.value === null ? '' : cell.value.toFixed(meta.digits);
  const shown = focus && focus.value !== null ? focus : null;
  return (
    <section className="sleep-matrix" aria-label={`${meta.title} by bedtime and hours asleep`}>
      <h2>{matrixHeadline(matrix)}</h2>
      <p className="sleep-matrix-lede">
        {meta.title} by bedtime and hours asleep. The bluer the cell, the {meta.lowerIsBetter ? 'lower' : 'higher'} the {meta.noun}.
      </p>
      <div className="sleep-matrix-card">
        <header>
          <h3>{meta.title} <small>({meta.unit})</small></h3>
          {available.length > 1 && (
            <div className="sleep-matrix-metrics" role="group" aria-label="Reading shown in the table">
              {available.map(key => (
                <button type="button" key={key} aria-pressed={key === metric} onClick={() => { setChoice(key); setFocus(null); }}>
                  {key === 'rhr' ? 'Resting HR' : key === 'hrv' ? 'HRV' : 'Score'}
                </button>
              ))}
            </div>
          )}
          <p className="sleep-matrix-legend" aria-hidden="true">
            <span>{meta.lowerIsBetter ? 'Lower' : 'Higher'}</span>
            <i>{[1, .8, .6, .4, .2, 0].map(level => <b key={level} style={{ '--level': level } as React.CSSProperties} />)}</i>
            <span>{meta.lowerIsBetter ? 'Higher' : 'Lower'}</span>
          </p>
        </header>
        <div className="sleep-matrix-grid" role="table" style={{ '--columns': matrix.columns.length } as React.CSSProperties} onPointerLeave={() => setFocus(null)}>
          {matrix.rows.map((row, r) => (
            <div role="row" key={row.start}>
              <span role="rowheader">{row.label}</span>
              {matrix.cells.filter(cell => cell.row === r).map(cell => cell.value === null ? (
                <span role="cell" key={cell.column} className="is-blank" aria-label={`${row.label}, ${matrix.columns[cell.column].label}: not enough nights`} />
              ) : (
                <button
                  type="button"
                  role="cell"
                  key={cell.column}
                  className={marked.has(`${cell.row}:${cell.column}`) ? 'is-marked' : undefined}
                  style={{ '--level': cell.level ?? 0 } as React.CSSProperties}
                  data-strong={cell.level !== null && cell.level > .62 ? '' : undefined}
                  aria-label={`${row.label} bedtime, ${matrix.columns[cell.column].label} asleep: ${value(cell)} ${meta.unit} over ${cell.nights} nights`}
                  onPointerEnter={() => setFocus(cell)}
                  onFocus={() => setFocus(cell)}
                  onClick={() => setFocus(cell)}
                >
                  {value(cell)}
                </button>
              ))}
            </div>
          ))}
          <div role="row" className="sleep-matrix-columns">
            <span />
            {matrix.columns.map(column => <span role="columnheader" key={column.label}>{column.label}</span>)}
          </div>
        </div>
        <p className="sleep-matrix-note" aria-live="polite">
          {shown
            ? <><strong>{matrix.rows[shown.row].label} bedtime · {matrix.columns[shown.column].label} asleep</strong> {value(shown)} {meta.unit} on average over {shown.nights} nights</>
            : <>Rows: bedtime. Columns: hours asleep. Blank: fewer than {matrix.minimum} nights. {matrix.nights} nights{matrix.first ? `, ${dateLabel(matrix.first, false)} ${matrix.first.slice(0, 4)} to ${dateLabel(matrix.last, false)} ${matrix.last!.slice(0, 4)}` : ''}.</>}
        </p>
      </div>
      <p className="sleep-matrix-caveat">A pattern in your own nights, not proof of cause: late nights often come with travel, alcohol or hard training.</p>
    </section>
  );
}
