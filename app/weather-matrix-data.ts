import { heatMatrix, type HeatMatrix } from './heat-matrix-data';
import { weatherDay, weatherTime, type WeatherHour } from './weather-recon-data';

export type WeatherMatrixMetric = 'temperature' | 'rainChance' | 'wind' | 'gust';
export const weatherMatrixMetrics: Record<WeatherMatrixMetric, { label: string; title: string; unit: string; hue: string }> = {
  temperature: { label: 'Temp', title: 'Temperature', unit: '°C', hue: '#f07b24' },
  rainChance: { label: 'Rain', title: 'Chance of rain', unit: '%', hue: '#2f6fed' },
  wind: { label: 'Wind', title: 'Wind', unit: 'km/h', hue: '#0f9f8f' },
  gust: { label: 'Gusts', title: 'Gusts', unit: 'km/h', hue: '#7c5cff' },
};

const FIRST_HOUR = 6, LAST_HOUR = 21;

/** The forecast as hours of the day against the coming days, in the forecast's own timezone. */
export function weatherMatrix(hours: readonly WeatherHour[], timezone: string, metric: WeatherMatrixMetric): HeatMatrix & { dates: string[] } {
  const dates = [...new Set(hours.map(hour => weatherDay(hour.time, timezone)))].sort();
  const rows = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => ({ label: `${String(FIRST_HOUR + i).padStart(2, '0')}:00` }));
  const columns = dates.map(date => {
    const day = new Date(`${date}T12:00:00Z`);
    return { label: day.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2), sub: String(day.getUTCDate()) };
  });
  const points = hours.flatMap(hour => {
    const value = hour[metric], clock = Number(weatherTime(hour.time, timezone).slice(0, 2));
    if (typeof value !== 'number' || !Number.isFinite(value) || clock < FIRST_HOUR || clock > LAST_HOUR) return [];
    return [{ row: clock - FIRST_HOUR, column: dates.indexOf(weatherDay(hour.time, timezone)), value }];
  });
  return { ...heatMatrix(points, rows, columns), dates };
}
