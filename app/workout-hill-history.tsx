"use client";

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { finite, numberLabel, paceLabel, repDistance } from './activity-metrics';
import type { hillRepHistory, HillRepSignature } from './workout-hill-history-data';
import './workout-hill-history.css';

type History = ReturnType<typeof hillRepHistory>;
type Status = 'idle' | 'loading' | 'unavailable' | 'error' | 'ready';
type Props = {
  current: HillRepSignature | null;
  date: string;
  history: History | null;
  targetLabel?: string;
  status?: Status;
  onOpenChange?: (open: boolean) => void;
  onSearch?: () => void;
  searchRemaining?: number;
  searchError?: string | null;
};

type Row = { id: string; date: string; title?: string; rep: HillRepSignature; selected?: boolean };

const metrics = {
  time: { label: 'Time', unit: '', changeUnit: 's', read: (rep: HillRepSignature) => rep.seconds, format: paceLabel, step: 5, digits: 0 },
  pace: { label: 'Pace', unit: '/km', changeUnit: 's/km', read: (rep: HillRepSignature) => rep.seconds / rep.recordedDistance * 1000, format: paceLabel, step: 10, digits: 0 },
  stepLength: { label: 'Step length', unit: 'cm', changeUnit: 'cm', read: (rep: HillRepSignature) => rep.stepLength, format: (value: number) => numberLabel(value, 1), step: 5, digits: 1 },
  cadence: { label: 'Cadence', unit: 'spm', changeUnit: 'spm', read: (rep: HillRepSignature) => rep.cadence, format: (value: number) => numberLabel(value, 0), step: 5, digits: 0 },
};

type MetricKey = keyof typeof metrics;
type Metric = (typeof metrics)[MetricKey];
const keys = Object.keys(metrics) as MetricKey[];
const plotWidth = 300;
const plotHeight = 52;
const pointInset = 5;
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function day(date: string, full = false) {
  const time = Date.parse(date);
  return finite(time) ? (full ? fullDate : shortDate).format(time) : 'Unknown date';
}

function reading(rep: HillRepSignature | undefined, metric: Metric) {
  const value = rep && metric.read(rep);
  return finite(value) && value > 0 ? value : null;
}

function changeLabel(current: number, prior: number, metric: Metric) {
  const scale = 10 ** metric.digits;
  const delta = (Math.round(current * scale) - Math.round(prior * scale)) / scale;
  if (!delta) return 'No change';
  const amount = numberLabel(Math.abs(delta), metric.digits);
  return metric === metrics.time || metric === metrics.pace
    ? `${amount} ${metric.changeUnit} ${delta < 0 ? 'faster' : 'slower'}`
    : `${delta < 0 ? '−' : '+'}${amount} ${metric.changeUnit}`;
}

function Missing() {
  return <><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></>;
}

function Value({ value, metric, unit = false }: { value: number | null; metric: Metric; unit?: boolean }) {
  if (value === null) return <Missing />;
  return <>{metric.format(value)}{unit && metric.unit && <small> {metric.unit}</small>}</>;
}

function HistoryTrend({ rows, metric }: { rows: Row[]; metric: Metric }) {
  const values = rows.map(row => reading(row.rep, metric));
  const available = values.filter(finite);
  if (available.length < 2) return null;
  const low = Math.max(0, Math.floor((Math.min(...available) - metric.step / 3) / metric.step) * metric.step);
  const high = Math.max(low + metric.step, Math.ceil((Math.max(...available) + metric.step / 3) / metric.step) * metric.step);
  const firstDate = day(rows[0].date, true);
  const lastDate = day(rows[rows.length - 1].date, true);
  const dates = rows.map(row => Date.parse(row.date));
  const start = dates[0];
  const end = dates[dates.length - 1];
  const points = values.map((value, index) => {
    if (value === null) return null;
    const offset = end > start && finite(dates[index]) ? (dates[index] - start) / (end - start) : index / (values.length - 1);
    return {
      x: pointInset + offset * (plotWidth - pointInset * 2),
      y: pointInset + (high - value) / (high - low) * (plotHeight - pointInset * 2),
      value,
    };
  });
  const path = points.map((point, index) => point ? `${points[index - 1] ? 'L' : 'M'}${point.x},${point.y}` : '').join(' ');
  return (
    <figure className="workout-hill-history-trend">
      <div className="workout-hill-history-plot">
        <span className="workout-hill-history-axis" aria-hidden="true"><span>{metric.format(high)}</span><span>{metric.format(low)}</span></span>
        <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} preserveAspectRatio="none" role="img"
          aria-label={`${metric.label} by date, ${available.length} readings from ${firstDate} to ${lastDate}`}>
          <path d={path} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => point && (
            <circle key={rows[index].id} cx={point.x} cy={point.y} r={rows[index].selected ? 3.5 : 2.25}
              data-selected={rows[index].selected || undefined} vectorEffect="non-scaling-stroke">
              <title>{`${rows[index].selected ? 'Selected rep, ' : ''}${day(rows[index].date, true)}: ${metric.format(point.value)} ${metric.unit}`.trim()}</title>
            </circle>
          ))}
        </svg>
      </div>
      <figcaption><span>{firstDate}</span><span>{lastDate}</span></figcaption>
    </figure>
  );
}

export default function WorkoutHillHistory({ current, date, history, targetLabel, status, onOpenChange, onSearch, searchRemaining, searchError }: Props) {
  const [choice, setChoice] = useState<MetricKey>('time');
  const attempts = history?.attempts ?? [];
  const loading = status === 'loading';
  const canSearch = current && onSearch && (loading || searchRemaining === undefined || searchRemaining > 0);
  const selected = current ? { id: 'selected-rep', date, rep: current, selected: true } : null;
  const rows: Row[] = selected ? [...attempts, selected].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)) : [];
  const available = keys.filter(key => rows.some(row => reading(row.rep, metrics[key]) !== null));
  const metric = metrics[available.includes(choice) ? choice : 'time'];
  const selectedPosition = rows.findIndex(row => row.selected);
  const previous = rows.slice(0, Math.max(0, selectedPosition)).findLast(row => reading(row.rep, metric) !== null);
  const reference = previous ?? rows.slice(selectedPosition + 1).find(row => reading(row.rep, metric) !== null && !row.selected);
  const value = reading(current ?? undefined, metric);
  const referenceValue = reading(reference?.rep, metric);
  const emptyLabel = loading ? 'Checking saved workouts…'
    : status === 'unavailable' ? 'Saved workout routes are unavailable for this hill.'
    : status === 'error' ? searchError ? null : 'Workout history could not be checked.'
    : 'No same-hill matches in loaded workouts.';

  return (
    <details className="workout-hill-history" onToggle={onOpenChange ? event => onOpenChange(event.currentTarget.open) : undefined}>
      <summary>
        <span>Hill history {attempts.length > 0 && <small>{attempts.length} {attempts.length === 1 ? 'matched workout' : 'matched workouts'}</small>}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="workout-hill-history-body" aria-busy={loading}>
        {!current ? (
          status !== 'idle' && <p className="workout-hill-history-note">This rep needs an aligned GPS trace to match the same hill.</p>
        ) : attempts.length === 0 ? (
          emptyLabel && <p className="workout-hill-history-note">{emptyLabel}</p>
        ) : (
          <>
            <header className="workout-hill-history-heading">
              <div>{targetLabel && <strong>{targetLabel}</strong>}<p>Fastest match from each other workout</p></div>
              <NativeSelect aria-label="Hill history metric" size="sm" className="workout-hill-history-select"
                value={available.includes(choice) ? choice : 'time'} onChange={event => setChoice(event.target.value as MetricKey)}>
                {available.map(key => <NativeSelectOption key={key} value={key}>{metrics[key].label}</NativeSelectOption>)}
              </NativeSelect>
            </header>
            <dl className="workout-hill-history-readout" aria-live="polite">
              <div><dt>Selected rep</dt><dd><Value value={value} metric={metric} unit /></dd></div>
              {reference && <div><dt>{day(reference.date)}</dt><dd><Value value={referenceValue} metric={metric} unit /></dd></div>}
              {value !== null && referenceValue !== null && <div><dt>Change</dt><dd>{changeLabel(value, referenceValue, metric)}</dd></div>}
            </dl>
            <HistoryTrend rows={rows} metric={metric} />
            <table className="workout-hill-history-table" aria-label="Matched hill reps by workout">
              <thead>
                <tr>
                  <th scope="col">Workout</th>
                  <th scope="col">Time</th>
                  <th scope="col">Pace <small>/km</small></th>
                  <th scope="col">Step <small>cm</small></th>
                  <th scope="col">Cadence <small>spm</small></th>
                </tr>
              </thead>
              <tbody>
                {rows.slice().reverse().map(row => (
                  <tr key={row.id} data-selected={row.selected || undefined}>
                    <th scope="row" title={row.title}>{row.selected ? 'Selected rep' : day(row.date, true)}
                      <small>{row.selected ? `${day(row.date)} · ` : ''}{repDistance(row.rep.recordedDistance, 'running')}</small>
                    </th>
                    {keys.map(key => <td key={key}><Value value={reading(row.rep, metrics[key])} metric={metrics[key]} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {current && searchError && <p className="workout-hill-history-note" role="status">{searchError}</p>}
        {canSearch && (
          <Button type="button" size="sm" variant="outline" className="workout-hill-history-search" onClick={onSearch} disabled={loading}>
            {loading ? 'Checking workouts…' : 'Search past workouts'}
          </Button>
        )}
      </div>
    </details>
  );
}
