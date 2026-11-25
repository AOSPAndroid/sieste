"use client";

import { useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { durationLabel, finite, numberLabel, paceLabel, repDistance } from './activity-metrics';
import { cadenceUnit } from './sports';
import type { WorkoutRepAnalysis } from './workout-block-analysis-data';
import { hillRepMetrics, type HillRepMetrics } from './workout-hill-rep-data';
import './workout-rep-compare.css';

type Props = {
  reps: readonly WorkoutRepAnalysis[];
  family: string;
  selectedIndex: number | null;
};

type RepChoice = {
  rep: WorkoutRepAnalysis;
  ordinal: number;
  hill: HillRepMetrics | null;
  grade: number | null;
};
type Pair = [RepChoice, RepChoice];
type Reading = { value: number | null; estimated?: boolean };
type Row = {
  label: string;
  unit: string;
  readings: [Reading, Reading];
  digits: number;
  deltaUnit: string;
  format?: (value: number) => string;
};

function netGrade(rep: WorkoutRepAnalysis) {
  if (!finite(rep.distance) || rep.distance <= 0 || !finite(rep.ascent) || !finite(rep.descent)) return null;
  return (rep.ascent - rep.descent) / rep.distance * 100;
}

function near(a: number | null, b: number | null, tolerance: number) {
  return finite(a) && finite(b) && a > 0 && b > 0 && Math.abs(a - b) <= Math.min(a, b) * tolerance;
}

function similarLength(a: RepChoice, b: RepChoice) {
  return near(a.rep.distance, b.rep.distance, .1) || near(a.rep.duration, b.rep.duration, .15);
}

function differentGrade(a: RepChoice, b: RepChoice) {
  return finite(a.grade) && finite(b.grade) && Math.abs(a.grade - b.grade) >= 1;
}

function similarRep(a: RepChoice, b: RepChoice) {
  return Boolean(a.hill) === Boolean(b.hill) && similarLength(a, b) && !differentGrade(a, b);
}

function defaultPair(choices: RepChoice[], selectedIndex: number | null): Pair | null {
  if (choices.length < 2) return null;
  const first = choices[0];
  const last = choices[choices.length - 1];
  const selected = choices.find(choice => choice.rep.index === selectedIndex);
  if (selected) {
    const earlier = choices.find(choice => choice.ordinal < selected.ordinal && similarRep(choice, selected));
    if (earlier) return [earlier, selected];
    const later = choices.findLast(choice => choice.ordinal > selected.ordinal && similarRep(selected, choice));
    if (later) return [selected, later];
    return selected === first ? [first, last] : [first, selected];
  }
  const firstHill = choices.find(choice => choice.hill && choices.some(peer => peer.ordinal > choice.ordinal && similarRep(choice, peer)));
  const lastHill = firstHill && choices.findLast(choice => choice.ordinal > firstHill.ordinal && similarRep(firstHill, choice));
  if (firstHill && lastHill) return [firstHill, lastHill];
  return [first, choices.findLast(choice => choice !== first && similarRep(first, choice)) ?? last];
}

function comparisonRows(pair: Pair, family: string) {
  const cycling = family === 'cycling';
  const swimming = family === 'swimming';
  const running = family === 'running';
  const hillPair = pair.some(choice => choice.hill);
  const from = (read: (choice: RepChoice) => Reading): [Reading, Reading] => [read(pair[0]), read(pair[1])];
  function row(label: string, unit: string, read: (choice: RepChoice) => Reading, options: Partial<Pick<Row, 'digits' | 'deltaUnit' | 'format'>> = {}): Row {
    return { label, unit, readings: from(read), digits: options.digits ?? 0, deltaUnit: options.deltaUnit ?? unit, format: options.format };
  }
  const pace = (paceSeconds: number | null) => !finite(paceSeconds) || paceSeconds <= 0 ? null
    : cycling ? 3600 / paceSeconds : swimming ? paceSeconds / 10 : paceSeconds;

  const rows = [
    row(cycling ? 'Speed' : 'Pace', cycling ? 'km/h' : swimming ? '/100m' : '/km',
      ({ rep }) => ({ value: pace(rep.pace) }),
      cycling ? { digits: 1 } : { format: paceLabel, deltaUnit: 's' }),
    ...(hillPair ? [
      row('Climb gain', 'm', ({ rep }) => ({ value: rep.ascent, estimated: rep.ascentSource === 'estimated' })),
      row('Climb rate', 'm/min', ({ rep, hill }) => ({
        value: hill?.climbRate ?? (finite(rep.ascent) && rep.duration > 0 ? rep.ascent / rep.duration * 60 : null),
        estimated: rep.ascentSource === 'estimated',
      }), { digits: 1 }),
      row('Net grade', '%', ({ rep, grade }) => ({
        value: grade,
        estimated: rep.ascentSource === 'estimated' || rep.descentSource === 'estimated',
      }), { digits: 1, deltaUnit: 'pp' }),
    ] : []),
    ...(running ? [row('Step length', 'cm', ({ rep }) => ({ value: rep.stepLength }), { digits: 1 })] : []),
    row('Cadence', running ? 'spm' : cadenceUnit(family), ({ rep }) => ({ value: rep.cadence })),
    ...(running ? [row('Ground contact', 'ms', ({ rep }) => ({ value: rep.groundContactTime }))] : []),
    row('Avg HR', 'bpm', ({ rep }) => ({ value: rep.heartrate })),
    row('Avg power', 'W', ({ rep }) => ({ value: rep.power })),
    row('Rest after', '', ({ rep }) => ({ value: rep.recovery?.duration ?? null }), { format: durationLabel, deltaUnit: 's' }),
    row('Recovery HR change', 'bpm', ({ rep }) => ({
      value: finite(rep.recovery?.hrDrop) ? -rep.recovery.hrDrop : null, estimated: true,
    }), { format: value => signedValue(Math.round(value), 0) }),
    row('Work time', '', ({ rep }) => ({ value: rep.duration }), { format: durationLabel, deltaUnit: 's' }),
    row('Distance', 'm', ({ rep }) => ({ value: rep.distance })),
  ];
  return rows.filter(metric => metric.readings.some(reading => finite(reading.value)));
}

function MissingReading() {
  return <><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></>;
}

function EstimateMark() {
  return <><span aria-hidden="true">~</span><span className="sr-only">Estimated </span></>;
}

function signedValue(value: number, digits: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${numberLabel(Math.abs(value), digits)}`;
}

function displayTicks(value: number, digits: number) {
  return Math.round(value * 10 ** digits);
}

function ReadingValue({ reading, metric }: { reading: Reading; metric: Row }) {
  if (!finite(reading.value)) return <MissingReading />;
  const value = metric.format ? metric.format(reading.value)
    : numberLabel(displayTicks(reading.value, metric.digits) / 10 ** metric.digits, metric.digits).replace('-', '−');
  return reading.estimated ? <><EstimateMark />{value}</> : value;
}

function Difference({ metric }: { metric: Row }) {
  const [first, second] = metric.readings;
  if (!finite(first.value) || !finite(second.value)) return <MissingReading />;
  const diff = (displayTicks(second.value, metric.digits) - displayTicks(first.value, metric.digits)) / 10 ** metric.digits;
  return (
    <>
      {(first.estimated || second.estimated) && <EstimateMark />}
      {signedValue(diff, metric.digits)}
      {metric.deltaUnit && <small> {metric.deltaUnit}</small>}
    </>
  );
}

export default function WorkoutRepCompare({ reps, family, selectedIndex }: Props) {
  const id = useId();
  const [choice, setChoice] = useState<[number, number] | null>(null);
  const options = useMemo(() => reps.map((rep, index): RepChoice => {
    const hill = family === 'swimming' ? null : hillRepMetrics(rep);
    return { rep, ordinal: index + 1, hill, grade: family === 'swimming' ? null : hill?.grade ?? netGrade(rep) };
  }), [family, reps]);
  const defaults = defaultPair(options, selectedIndex);
  if (!defaults) return null;

  const first = options.find(option => option.rep.index === choice?.[0]) ?? defaults[0];
  const second = options.find(option => option.rep.index === choice?.[1] && option !== first)
    ?? defaults.find(option => option !== first) ?? defaults[1];
  const rows = comparisonRows([first, second], family);
  const context = [
    differentGrade(first, second) && 'Different grades',
    finite(first.rep.distance) && finite(second.rep.distance) && !near(first.rep.distance, second.rep.distance, .1) && 'Different distances',
    !near(first.rep.duration, second.rep.duration, .15) && 'Different work times',
  ].filter(Boolean).join(' · ');

  function change(side: 0 | 1, next: number) {
    const current: [number, number] = [first.rep.index, second.rep.index];
    if (next === current[1 - side]) setChoice([current[1], current[0]]);
    else {
      current[side] = next;
      setChoice(current);
    }
  }

  return (
    <details className="workout-rep-compare">
      <summary>Compare reps <ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="workout-rep-compare-body">
        <div className="workout-rep-compare-controls">
          {([first, second] as const).map((rep, side) => (
            <div key={side}>
              <label htmlFor={`${id}-${side}`}>{side === 0 ? 'First rep' : 'Second rep'}</label>
              <NativeSelect className="workout-rep-compare-select" size="sm" id={`${id}-${side}`} value={String(rep.rep.index)}
                onChange={event => change(side === 0 ? 0 : 1, Number(event.target.value))}>
                {options.map(option => (
                  <NativeSelectOption key={option.rep.index} value={String(option.rep.index)}>
                    {[
                      `Rep ${option.ordinal}`,
                      option.rep.distance !== null && option.rep.distance > 0 ? repDistance(option.rep.distance, family) : durationLabel(option.rep.duration),
                      option.hill && 'Uphill',
                    ].filter(Boolean).join(' · ')}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
        {context && <p className="workout-rep-compare-context">{context}</p>}
        <table className="workout-rep-compare-table" aria-label="Selected rep measurements">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Rep {first.ordinal}</th>
              <th scope="col">Rep {second.ordinal}</th>
              <th scope="col">Change <span className="sr-only">(second rep minus first)</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(metric => (
              <tr key={metric.label}>
                <th scope="row">{metric.label}{metric.unit && <small> {metric.unit}</small>}</th>
                <td><ReadingValue reading={metric.readings[0]} metric={metric} /></td>
                <td><ReadingValue reading={metric.readings[1]} metric={metric} /></td>
                <td><Difference metric={metric} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
