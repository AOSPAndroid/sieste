'use client';
import { useMemo } from 'react';
import HeatMatrixView, { type HeatMetric } from './heat-matrix';
import type { WeatherHour } from './weather-recon-data';
import { weatherMatrix, weatherMatrixMetrics, type WeatherMatrixMetric } from './weather-matrix-data';

/** The whole forecast at once: hours of the day against the coming days. */
export default function WeatherMatrix({ hours, timezone }: { hours: readonly WeatherHour[]; timezone: string }) {
  const metrics = useMemo(() => (Object.keys(weatherMatrixMetrics) as WeatherMatrixMetric[]).map((key): HeatMetric => {
    const meta = weatherMatrixMetrics[key];
    return {
      key, label: meta.label, title: meta.title, unit: meta.unit, hue: meta.hue, matrix: weatherMatrix(hours, timezone, key),
      format: value => String(Math.round(value)),
      strong: key === 'temperature' ? 'Warmest' : key === 'rainChance' ? 'Wettest' : 'Strongest', faint: key === 'temperature' ? 'Coldest' : key === 'rainChance' ? 'Driest' : 'Calmest',
      description: `${meta.title} for each hour from 06:00 to 21:00 across the forecast.`,
      note: 'Past hours are blank. Local time at this location.',
    };
  }), [hours, timezone]);
  return <HeatMatrixView className="weather-matrix" eyebrow="Forecast" title="The days ahead, hour by hour" metrics={metrics} rowNoun="" columnNoun="" />;
}
