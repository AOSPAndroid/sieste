"use client";

import { useId, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import type { WorkoutRepAnalysis } from './workout-block-analysis-data';
import { repMechanics, repTraces, traceValueAt, traceValueLabel, type RepMechanics, type RepTrace, type RepTraceMetric, type RepTraceMetricKey } from './workout-rep-traces-data';
import { mechanicBand, rateExecution } from './workout-execution-data';
import './workout-rep-traces.css';

type Props = {
  reps: readonly WorkoutRepAnalysis[];
  series: Parameters<typeof repTraces>[2];
  alignedLaps: Parameters<typeof repTraces>[1];
  family: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
};

const WIDTH = 320;
const HEIGHT = 150;

function clock(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function percent(change: number) {
  const size = Math.abs(change * 100);
  if (size < .05) return '0%';
  return `${change < 0 ? '−' : '+'}${size < 10 ? size.toFixed(1) : Math.round(size)}%`;
}

/** Work and recovery are separate paths so the recovery can be drawn dashed. */
function tracePaths(trace: RepTrace, metric: RepTraceMetric) {
  const [low, high] = metric.domain;
  let work = '', recovery = '', lastWork = '', drawing = false;
  for (const point of trace.points) {
    if (point.value === null) { drawing = false; continue; }
    const x = point.t / metric.extent * WIDTH;
    const y = (1 - Math.min(1, Math.max(0, (point.value - low) / (high - low)))) * HEIGHT;
    const at = `${x.toFixed(1)},${y.toFixed(1)}`;
    if (point.t < trace.work) {
      work += (drawing ? 'L' : 'M') + at;
      lastWork = at;
    } else {
      // The recovery starts where the work ended, so the line stays continuous.
      if (!recovery && drawing && lastWork) recovery = 'M' + lastWork;
      recovery += (drawing && recovery ? 'L' : 'M') + at;
    }
    drawing = true;
  }
  return { work, recovery };
}

function halves(trace: RepTrace) {
  return trace.firstHalf !== null && trace.secondHalf !== null && trace.firstHalf > 0
    ? trace.secondHalf / trace.firstHalf - 1 : null;
}

/** Pace is scaled as speed, so a rise there reads as quicker, not higher. */
function changeLabel(metric: RepTraceMetric, change: number) {
  const size = percent(Math.abs(change)).replace(/^[+−]/, '');
  if (metric.pace) return `${change > 0 ? 'quickened' : 'slowed'} ${size}`;
  return `${change > 0 ? 'rose' : 'fell'} ${size}`;
}

function mean(values: readonly (number | null)[]) {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

function list(ordinals: readonly number[]) {
  if (ordinals.length === 1) return `Rep ${ordinals[0]}`;
  return `Reps ${ordinals.slice(0, -1).join(', ')} and ${ordinals.at(-1)}`;
}

/** One sentence on what the overlaid shapes show, so the chart never stands without a reading. */
function summary(metric: RepTraceMetric) {
  const { traces } = metric;
  const first = traces[0], last = traces.at(-1)!;
  if (metric.key === 'heartrate') {
    const drops = traces.flatMap(trace => trace.endValue !== null && trace.after60 !== null
      ? [{ ordinal: trace.ordinal, drop: trace.endValue - trace.after60 }] : []);
    const ends = first.endValue !== null && last.endValue !== null
      ? `Heart rate ended rep ${first.ordinal} at ${Math.round(first.endValue)} bpm and rep ${last.ordinal} at ${Math.round(last.endValue)} bpm.` : '';
    if (!drops.length) return ends || 'Each line is one rep, from its start.';
    const early = drops[0], late = drops.at(-1)!;
    const recovery = drops.length > 1 && Math.abs(early.drop - late.drop) >= 3
      ? ` In the first minute of recovery it fell ${Math.round(early.drop)} bpm after rep ${early.ordinal} and ${Math.round(late.drop)} bpm after rep ${late.ordinal}.`
      : ` It fell about ${Math.round(mean(drops.map(item => item.drop))!)} bpm in the first minute of each recovery.`;
    return (ends + recovery).trim();
  }
  const changes = traces.flatMap(trace => {
    const change = halves(trace);
    return change === null ? [] : [{ ordinal: trace.ordinal, change }];
  });
  if (!changes.length) return 'Each line is one rep, from its start.';
  const name = metric.label.toLowerCase();
  // Two percent between halves is beyond what sample noise and terrain usually explain.
  const uneven = changes.filter(item => Math.abs(item.change) >= .02);
  if (!uneven.length) return `${metric.key === 'speed' || metric.key === 'power' ? 'Even pacing' : 'Steady'}: ${name} held within 2% from the first half of every rep to the second.`;
  const shared = uneven.every(item => item.change > 0 === uneven[0].change > 0);
  const size = mean(uneven.map(item => item.change))!;
  if (uneven.length === changes.length && shared) return `In every rep, ${name} ${changeLabel(metric, size)} from the first half to the second, on average.`;
  if (shared && uneven.length <= 4) {
    return `${list(uneven.map(item => item.ordinal))}: ${name} ${changeLabel(metric, size)} from the first half to the second; the other reps held within 2%.`;
  }
  return `${uneven.length} of ${changes.length} reps changed ${name} by 2% or more between their halves.`;
}

const levelLabels = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' } as const;

function amount(value: number, digits: number, signed = false) {
  const text = Math.abs(value).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (!signed) return text;
  return Number(text) === 0 ? '0' : `${value < 0 ? '−' : '+'}${text}`;
}

/** What the early-to-late shifts mean, said only as firmly as the pace allows. */
function mechanicsReading({ rows, verdict, paceChange, side }: RepMechanics) {
  const span = side > 1 ? `the first ${side} reps to the last ${side}` : 'the first rep to the last';
  if (verdict === 'pace-changed') {
    return paceChange === null
      ? 'Pace is unavailable, so these shifts cannot be separated from a change in speed.'
      : `Pace ${paceChange > 0 ? 'quickened' : 'slowed'} ${percent(Math.abs(paceChange)).replace(/^[+−]/, '')} from ${span}; mechanics follow speed, so read these shifts with that in mind.`;
  }
  const tiring = rows.filter(row => row.tiring);
  if (verdict === 'held') return `At the same pace, your mechanics held from ${span}.`;
  const parts = tiring.slice(0, 3).map(row => `${row.label.toLowerCase()} ${row.across > 0 ? 'rose' : 'fell'} ${amount(row.across, row.digits)}${row.unit === '%' ? '%' : ` ${row.unit}`}`);
  const changes = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return verdict === 'tiring'
    ? `At the same pace, ${changes} from ${span}: a sign your form was tiring.`
    : `At the same pace, ${changes} from ${span}; on its own that is not a clear sign of tiring.`;
}

export default function WorkoutRepTraces({ reps, series, alignedLaps, family, selectedIndex, onSelect }: Props) {
  const headingId = useId();
  const metrics = useMemo(() => repTraces(reps, alignedLaps, series, family), [reps, alignedLaps, series, family]);
  const [choice, setChoice] = useState<RepTraceMetricKey | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const mechanics = useMemo(() => family === 'running' ? repMechanics(metrics) : null, [metrics, family]);
  const execution = useMemo(() => rateExecution(metrics, mechanics, family), [metrics, mechanics, family]);
  if (!metrics.length) return null;
  const metric = metrics.find(item => item.key === choice) ?? metrics[0];
  const { traces, domain, extent, work } = metric;
  const selected = traces.find(trace => trace.index === selectedIndex) ?? null;
  const label = (value: number | null) => traceValueLabel(metric, value);
  const ticks = [domain[1], (domain[0] + domain[1]) / 2, domain[0]];
  const hasRecovery = extent > work + 1;
  const timeTicks = [0, ...(metric.uniform ? [work / 2, work] : [extent / 2]), ...(hasRecovery || !metric.uniform ? [extent] : [])];
  const shade = (position: number) => 28 + 72 * (traces.length > 1 ? position / (traces.length - 1) : 1);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    setCursor(Math.min(extent, Math.max(0, (event.clientX - box.left) / box.width * extent)));
  };
  const cursorValues = cursor === null ? [] : traces.flatMap(trace => {
    const value = traceValueAt(trace, cursor);
    return value === null ? [] : [{ trace, value }];
  });
  const cursorRange = cursorValues.length
    ? [Math.min(...cursorValues.map(item => item.value)), Math.max(...cursorValues.map(item => item.value))] : null;
  const cursorSelected = selected && cursor !== null ? traceValueAt(selected, cursor) : null;
  const change = selected ? halves(selected) : null;

  return (
    <section className="workout-rep-traces" aria-labelledby={headingId}>
      {execution && (
        <div className="workout-execution" data-level={execution.level}>
          <div className="workout-execution-score" role="img" aria-label={`Execution ${execution.score} out of 100`}>
            <strong>{execution.score}</strong><small>/100</small>
          </div>
          <div className="workout-execution-heading">
            <h5>Execution</h5>
            <p>{execution.headline}</p>
          </div>
          <ul>
            {execution.parts.map(part => (
              <li key={part.key} data-level={part.level}>
                <span><i aria-hidden="true" />{part.label}</span>
                <b>{levelLabels[part.level]}</b>
                <small>{part.detail}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      <header className="workout-rep-traces-header">
        <h5 id={headingId}>Inside each rep</h5>
        {metrics.length > 1 && (
          <div className="workout-rep-traces-metrics" role="group" aria-label="Measurement to overlay">
            {metrics.map(item => (
              <button key={item.key} type="button" aria-pressed={item.key === metric.key}
                onClick={() => { setChoice(item.key); setCursor(null); }}>{item.label}</button>
            ))}
          </div>
        )}
      </header>
      <p className="workout-rep-traces-summary">{summary(metric)}</p>
      <div className="workout-rep-traces-grid">
        <ol className="workout-rep-traces-axis" aria-hidden="true">
          {ticks.map((tick, index) => <li key={index}>{label(tick)}</li>)}
        </ol>
        <div className="workout-rep-traces-plot" data-selection={selected ? true : undefined}
          onPointerDown={move} onPointerMove={move}
          onPointerLeave={event => { if (event.pointerType === 'mouse') setCursor(null); }}
          role="img" aria-label={`${metric.label} through each of ${traces.length} reps, aligned at the start of the rep. ${summary(metric)}`}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            {hasRecovery && metric.uniform && <rect className="workout-rep-traces-rest" x={work / extent * WIDTH} y="0"
              width={WIDTH - work / extent * WIDTH} height={HEIGHT} />}
            {[.5].map(share => <line key={share} className="workout-rep-traces-rule" x1="0" x2={WIDTH}
              y1={HEIGHT * share} y2={HEIGHT * share} vectorEffect="non-scaling-stroke" />)}
            {traces.map((trace, position) => {
              const paths = tracePaths(trace, metric);
              const active = trace.index === selectedIndex;
              return (
                <g key={trace.index} className="workout-rep-traces-line" data-selected={active || undefined}
                  style={{ '--trace-shade': `${shade(position)}%` } as CSSProperties}>
                  <path d={paths.work} vectorEffect="non-scaling-stroke" />
                  {paths.recovery && <path className="workout-rep-traces-recovery" d={paths.recovery} vectorEffect="non-scaling-stroke" />}
                </g>
              );
            })}
            {/* Drawn again on top so the chosen rep is never hidden under later ones. */}
            {selected && (() => {
              const paths = tracePaths(selected, metric);
              return (
                <g className="workout-rep-traces-line workout-rep-traces-focus">
                  <path d={paths.work} vectorEffect="non-scaling-stroke" />
                  {paths.recovery && <path className="workout-rep-traces-recovery" d={paths.recovery} vectorEffect="non-scaling-stroke" />}
                </g>
              );
            })()}
            {cursor !== null && <line className="workout-rep-traces-cursor" x1={cursor / extent * WIDTH} x2={cursor / extent * WIDTH}
              y1="0" y2={HEIGHT} vectorEffect="non-scaling-stroke" />}
          </svg>
          {hasRecovery && metric.uniform && <span className="workout-rep-traces-rest-label" style={{ left: `${work / extent * 100}%` }}>Recovery</span>}
        </div>
        <ol className="workout-rep-traces-time" aria-hidden="true">
          {timeTicks.map(tick => <li key={tick} style={{ left: `${tick / extent * 100}%` }}>{clock(tick)}</li>)}
        </ol>
      </div>
      <ol className="workout-rep-traces-reps" aria-label="Highlight a rep">
        {traces.map((trace, position) => {
          const active = trace.index === selectedIndex;
          return (
            <li key={trace.index}>
              <button type="button" aria-pressed={active} aria-label={`Rep ${trace.ordinal}, average ${label(trace.mean)} ${metric.unit}`}
                style={{ '--trace-shade': `${shade(position)}%` } as CSSProperties}
                onClick={() => { setCursor(null); onSelect(active ? null : trace.index); }}>
                <i aria-hidden="true" />{trace.ordinal}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="workout-rep-traces-readout" aria-live="polite">
        {cursor !== null && cursorRange ? (
          <p>
            <strong>{clock(cursor)}{cursor > work && metric.uniform ? ' · recovery' : ''}</strong>
            {selected && cursorSelected !== null && <span>Rep {selected.ordinal}: {label(cursorSelected)} {metric.unit}</span>}
            <span>{cursorValues.length} reps: {label(metric.pace ? cursorRange[1] : cursorRange[0])}–{label(metric.pace ? cursorRange[0] : cursorRange[1])} {metric.unit}</span>
          </p>
        ) : selected ? (
          <dl>
            <div><dt>Rep {selected.ordinal} avg</dt><dd>{label(selected.mean)} <small>{metric.unit}</small></dd></div>
            {metric.key === 'heartrate' ? (
              <>
                <div><dt>End of rep</dt><dd>{label(selected.endValue)} <small>bpm</small></dd></div>
                <div><dt>After 60 s rest</dt><dd>{selected.endValue !== null && selected.after60 !== null
                  ? <>↓{Math.round(selected.endValue - selected.after60)} <small>bpm</small></> : '—'}</dd></div>
              </>
            ) : (
              <>
                <div><dt>First half → second</dt><dd>{label(selected.firstHalf)} → {label(selected.secondHalf)}</dd></div>
                <div><dt>Change</dt><dd>{change === null ? '—' : Math.abs(change) < .0005 ? 'Even' : changeLabel(metric, change)}</dd></div>
              </>
            )}
          </dl>
        ) : <p><span>Drag across the chart to read a moment; tap a rep number to highlight it.</span></p>}
      </div>
      {mechanics && (
        <div className="workout-rep-traces-mechanics">
          <h6>Mechanics through the set</h6>
          <p>{mechanicsReading(mechanics)}</p>
          <p className="workout-rep-traces-note">Ratings place the set&apos;s average among runners in general; step length depends on pace and height, so it is not rated.</p>
          <table>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">{mechanics.side > 1 ? `First ${mechanics.side}` : 'First rep'}</th>
                <th scope="col">{mechanics.side > 1 ? `Last ${mechanics.side}` : 'Last rep'}</th>
                <th scope="col">Change</th>
                <th scope="col" title="Where the set's average sits among runners in general">Rating</th>
              </tr>
            </thead>
            <tbody>
              {mechanics.rows.map(row => (
                <tr key={row.key} data-tiring={row.tiring && mechanics.verdict !== 'pace-changed' || undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={row.key === metric.key} aria-label={`Show ${row.label.toLowerCase()} on the chart`}
                      onClick={() => { setChoice(row.key); setCursor(null); }}>{row.label} <small>{row.unit}</small></button>
                  </th>
                  <td>{amount(row.early, row.digits)}</td>
                  <td>{amount(row.late, row.digits)}</td>
                  <td>{amount(row.across, row.digits, true)}</td>
                  <td>{(() => {
                    const band = mechanicBand(row.key, row.mean);
                    return band ? <span className="workout-mechanic-band" data-level={band.level} title={band.range}>{band.label}</span> : '—';
                  })()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
