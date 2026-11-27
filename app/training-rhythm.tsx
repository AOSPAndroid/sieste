'use client';
import { useMemo } from 'react';
import HeatMatrixView, { type HeatMetric } from './heat-matrix';
import { rhythmMetrics, trainingRhythm, type RhythmActivity, type RhythmMetric } from './training-rhythm-data';

/** When the athlete trains: start time against weekday over the last year. */
export default function TrainingRhythm({ activities, now }: { activities: readonly RhythmActivity[]; now: Date }) {
  const day = now.toDateString();
  const metrics = useMemo(() => {
    const from = new Date(now); from.setFullYear(from.getFullYear() - 1);
    const year = activities.filter(activity => { const start = new Date(activity.date); return start >= from && start <= now; });
    return (Object.keys(rhythmMetrics) as RhythmMetric[]).map((key): HeatMetric => {
      const meta = rhythmMetrics[key];
      return {
        key, label: meta.label, title: meta.title, unit: meta.unit, matrix: trainingRhythm(year, key),
        format: value => value.toFixed(value >= 100 ? 0 : meta.digits),
        strong: 'Most', faint: 'Least',
        description: `${meta.title} by weekday and start time over the last 12 months.`,
        note: `${year.length} sessions. Start times use this device’s time zone.`,
      };
    });
    // Recomputed when the day changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, day]);
  return <HeatMatrixView className="training-rhythm" eyebrow="Training rhythm" title="When you train" metrics={metrics} rowNoun="" columnNoun="" />;
}
