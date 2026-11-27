'use client';
import { useMemo } from 'react';
import type { AthleteData } from './analytics';
import { fatigueRecovery } from './fatigue-recovery-data';
import HeatMatrixView, { type HeatMetric } from './heat-matrix';
import { recoveryMatrix, recoveryMetrics, type RecoveryMetric } from './recovery-matrix-data';

/** The morning reading by yesterday's training load and last night's sleep, over the last year. */
export default function RecoveryMatrix({ data, now }: { data: AthleteData; now: Date }) {
  const day = now.toDateString();
  const metrics = useMemo(() => {
    const days = fatigueRecovery(data, now, 365);
    return (Object.keys(recoveryMetrics) as RecoveryMetric[]).map((key): HeatMetric => {
      const matrix = recoveryMatrix(days, key), meta = recoveryMetrics[key];
      return {
        key, label: meta.label, title: meta.title, unit: meta.unit, matrix,
        format: value => value.toFixed(meta.digits),
        strong: meta.lowerIsBetter ? 'Lowest' : 'Highest', faint: meta.lowerIsBetter ? 'Highest' : 'Lowest',
        countNoun: ['day', 'days'],
        description: `Average ${key === 'hrv' ? 'next-morning HRV' : 'next-morning resting heart rate'} by the previous day’s training load and the night’s sleep.`,
        note: `Blank: fewer than ${matrix.minimum} days. ${matrix.count} days in the last 12 months.${matrix.bounds ? ` Light is under ${Math.round(matrix.bounds[0])} load points, hard is ${Math.round(matrix.bounds[1])} or more.` : ''}`,
      };
    });
    // Recomputed when the day changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, day]);
  return <HeatMatrixView className="recovery-matrix" eyebrow="Recovery" title="Training load and sleep" metrics={metrics} rowNoun="day before" columnNoun="asleep" caveat="Load bands are thirds of your own training days. An association, not a cause." />;
}
