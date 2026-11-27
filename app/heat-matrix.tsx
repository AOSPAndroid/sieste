'use client';
import './heat-matrix.css';
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { HeatCell, HeatMatrix } from './heat-matrix-data';

export type HeatMetric = {
  key: string;
  /** Short name on the switch. */
  label: string;
  title: string;
  unit: string;
  matrix: HeatMatrix;
  format: (value: number) => string;
  /** Legend words for the strongly coloured end and the faint end. */
  strong: string;
  faint: string;
  hue?: string;
  /** What one reading is, for "over 12 nights". */
  countNoun?: [string, string];
  description: string;
  note: string;
};

/** A titled heat table with a metric switch, a legend and a readout for the cell under the pointer. */
export default function HeatMatrixView({ title, eyebrow, metrics, rowNoun, columnNoun, caveat, className }: { title: string; eyebrow?: string; metrics: HeatMetric[]; rowNoun: string; columnNoun: string; caveat?: ReactNode; className?: string }) {
  const available = metrics.filter(metric => metric.matrix.cells.some(cell => cell.value !== null));
  const [choice, setChoice] = useState<string | null>(null);
  const [focus, setFocus] = useState<HeatCell | null>(null);
  if (!available.length) return null;
  const metric = available.find(item => item.key === choice) ?? available[0], matrix = metric.matrix;
  const counted = (cell: HeatCell) => metric.countNoun && cell.count > 1 ? ` over ${cell.count} ${metric.countNoun[1]}` : '';
  const place = (cell: HeatCell) => `${matrix.rows[cell.row].label}${rowNoun ? ' ' + rowNoun : ''} · ${[matrix.columns[cell.column].label, matrix.columns[cell.column].sub].filter(Boolean).join(' ')}${columnNoun ? ' ' + columnNoun : ''}`;
  const shown = focus && focus.value !== null && focus.row < matrix.rows.length && focus.column < matrix.columns.length ? focus : null;
  return (
    <section className={`heat-matrix${className ? ' ' + className : ''}`} aria-label={`${title}: ${metric.title}`} style={metric.hue ? { '--matrix-blue': metric.hue } as CSSProperties : undefined}>
      {eyebrow && <p className="heat-matrix-eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      <p className="heat-matrix-lede">{metric.description}</p>
      <div className="heat-matrix-card">
        <header>
          <h3>{metric.title}{metric.unit.toLowerCase() !== metric.title.toLowerCase() && <> <small>({metric.unit})</small></>}</h3>
          {available.length > 1 && (
            <div className="heat-matrix-metrics" role="group" aria-label="Reading shown in the table">
              {available.map(item => <button type="button" key={item.key} aria-pressed={item.key === metric.key} onClick={() => { setChoice(item.key); setFocus(null); }}>{item.label}</button>)}
            </div>
          )}
          <p className="heat-matrix-legend" aria-hidden="true">
            <span>{metric.strong}</span>
            <i>{[1, .8, .6, .4, .2, 0].map(level => <b key={level} style={{ '--level': level } as CSSProperties} />)}</i>
            <span>{metric.faint}</span>
          </p>
        </header>
        <div className="heat-matrix-grid" role="table" style={{ '--columns': matrix.columns.length, '--head': `${Math.max(...matrix.rows.map(row => row.label.length)) * .62 + .6}em` } as CSSProperties} onPointerLeave={() => setFocus(null)}>
          {matrix.rows.map((row, r) => (
            <div role="row" key={row.label}>
              <span role="rowheader">{row.label}</span>
              {matrix.cells.filter(cell => cell.row === r).map(cell => cell.value === null ? (
                <span role="cell" key={cell.column} className="is-blank" aria-label={`${place(cell)}: no value`} />
              ) : (
                <button
                  type="button"
                  role="cell"
                  key={cell.column}
                  className={cell === matrix.best ? 'is-marked' : undefined}
                  style={{ '--level': cell.level ?? 0 } as CSSProperties}
                  data-strong={cell.level !== null && cell.level > .62 ? '' : undefined}
                  aria-label={`${place(cell)}: ${metric.format(cell.value)} ${metric.unit}${counted(cell)}`}
                  onPointerEnter={() => setFocus(cell)}
                  onFocus={() => setFocus(cell)}
                  onClick={() => setFocus(cell)}
                >
                  {metric.format(cell.value)}
                </button>
              ))}
            </div>
          ))}
          <div role="row" className="heat-matrix-columns">
            <span />
            {matrix.columns.map(column => <span role="columnheader" key={column.label + (column.sub ?? '')}>{column.label}{column.sub && <small>{column.sub}</small>}</span>)}
          </div>
        </div>
        <p className="heat-matrix-note" aria-live="polite">
          {shown
            ? <><strong>{place(shown)}</strong> {metric.format(shown.value!)} {metric.unit}{counted(shown)}</>
            : <>{matrix.best && <><strong>{metric.strong}: {place(matrix.best)}</strong> {metric.format(matrix.best.value!)} {metric.unit}{counted(matrix.best)}. </>}{metric.note}</>}
        </p>
      </div>
      {caveat && <p className="heat-matrix-caveat">{caveat}</p>}
    </section>
  );
}
