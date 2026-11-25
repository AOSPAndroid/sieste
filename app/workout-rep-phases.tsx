"use client";

import { useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { durationLabel, numberLabel, paceLabel } from './activity-metrics';
import type { WorkoutRepAnalysis } from './workout-block-analysis-data';
import { isUphillRep } from './workout-blocks-data';
import { workoutRepPhases, type WorkoutRepPhase } from './workout-rep-phases-data';
import './workout-rep-phases.css';

type Props = {
  reps: readonly WorkoutRepAnalysis[];
  selectedIndex: number | null;
  alignedLaps: readonly { index: number; start: number; end: number }[];
  series: Parameters<typeof workoutRepPhases>[2];
};

const metrics = [
  { key: 'speed', label: 'Pace', unit: '/km', format: (value: number) => paceLabel(1000 / value) },
  { key: 'stepLength', label: 'Step length', unit: 'cm', format: (value: number) => numberLabel(value, 1) },
  { key: 'cadence', label: 'Cadence', unit: 'spm', format: (value: number) => numberLabel(value, 0) },
  { key: 'groundContactTime', label: 'Ground contact', unit: 'ms', format: (value: number) => numberLabel(value, 0) },
  { key: 'heartrate', label: 'Heart rate', unit: 'bpm', format: (value: number) => numberLabel(value, 0) },
  { key: 'power', label: 'Power', unit: 'W', format: (value: number) => numberLabel(value, 0) },
] as const satisfies readonly {
  key: Exclude<keyof WorkoutRepPhase, 'startSeconds' | 'endSeconds'>;
  label: string;
  unit: string;
  format: (value: number) => string;
}[];

function phaseTime(value: number) {
  const seconds = Math.round(value);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

export default function WorkoutRepPhases({ reps, selectedIndex, alignedLaps, series }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const rep = reps.find(item => item.index === (choice ?? selectedIndex)) ?? reps[0];
  const result = useMemo(() => open && rep
    ? workoutRepPhases(rep, alignedLaps.find(lap => lap.index === rep.index), series)
    : null, [open, rep, alignedLaps, series]);
  if (!reps.length || !series?.data) return null;
  const phases = result?.phases ?? [];
  const phaseNames = phases.length === 3 ? ['Start', 'Middle', 'Finish'] : ['Start', 'Finish'];

  return (
    <details className="workout-analysis-details workout-rep-phases" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>Inside a rep <ChevronDown size={14} aria-hidden="true" /></summary>
      {open && (
        <div className="workout-rep-phases-body">
          <div className="workout-rep-phases-control">
            <label htmlFor={id}>Rep to inspect</label>
            <NativeSelect id={id} value={String(rep.index)} onChange={event => setChoice(Number(event.target.value))}>
              {reps.map((item, index) => (
                <NativeSelectOption key={item.index} value={String(item.index)}>
                  {['Rep ' + (index + 1), isUphillRep(item) ? 'Hill' : null, durationLabel(item.duration)].filter(Boolean).join(' · ')}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {phases.length ? (
            <table className="workout-analysis-table workout-rep-phases-table" aria-label="Sensor averages through the selected rep">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  {phases.map((phase, index) => (
                    <th scope="col" key={phaseNames[index]}>
                      {phaseNames[index]}
                      <small>{phaseTime(phase.startSeconds)}–{phaseTime(phase.endSeconds)}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.filter(metric => phases.some(phase => phase[metric.key] !== null)).map(metric => (
                  <tr key={metric.key}>
                    <th scope="row">{metric.label} <small>{metric.unit}</small></th>
                    {phases.map((phase, index) => {
                      const value = phase[metric.key];
                      return <td key={phaseNames[index]}>{value === null ? <span aria-label="Unavailable">—</span> : metric.format(value)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="workout-analysis-note">This rep needs more aligned sensor readings for a start-to-finish breakdown.</p>
          )}
        </div>
      )}
    </details>
  );
}
