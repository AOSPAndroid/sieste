'use client';
import { useMemo } from 'react';
import type { AthleteData } from './analytics';
import { sleepToolsData } from './sleep-tools-data';
import { dateLabel } from './date-label';
import HeatMatrixView, { type HeatMetric } from './heat-matrix';
import { matrixMetrics, sleepMatrix, type MatrixMetric } from './sleep-matrix-data';

const HISTORY_DAYS = 730;

/** Bedtime against hours asleep, coloured by the next-morning reading, from every recorded night. */
export default function SleepMatrix({ data, end }: { data: AthleteData; end: string }) {
  const nights = useMemo(() => sleepToolsData(data, end, HISTORY_DAYS, 8).rows, [data, end]);
  const metrics = useMemo(() => (Object.keys(matrixMetrics) as MatrixMetric[]).map((key): HeatMetric => {
    const matrix = sleepMatrix(nights, key), meta = matrixMetrics[key];
    return {
      key, label: meta.label, title: meta.title, unit: meta.unit, matrix,
      format: value => value.toFixed(meta.digits),
      strong: meta.lowerIsBetter ? 'Lowest' : 'Highest', faint: meta.lowerIsBetter ? 'Highest' : 'Lowest',
      countNoun: ['night', 'nights'],
      description: `Average ${meta.title.toLowerCase()} the next morning, by bedtime and hours asleep.`,
      note: `Blank: fewer than ${matrix.minimum} nights. ${matrix.count} nights${matrix.first ? `, ${dateLabel(matrix.first, false)} ${matrix.first.slice(0, 4)} to ${dateLabel(matrix.last, false)} ${matrix.last!.slice(0, 4)}` : ''}.`,
    };
  }), [nights]);
  return <HeatMatrixView className="sleep-matrix" eyebrow="Sleep timing" title="Bedtime and sleep duration" metrics={metrics} rowNoun="bedtime" columnNoun="asleep" caveat="An association in your own nights, not a cause: late nights often coincide with travel, alcohol or hard training." />;
}
