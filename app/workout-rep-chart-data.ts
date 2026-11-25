import { cadenceUnit } from './sports';
import { hillRepMetrics } from './workout-hill-rep-data';
import { hasHillReps, type WorkoutBlock } from './workout-blocks-data';
import type { WorkoutBlockAnalysis } from './workout-block-analysis-data';
import type { ThresholdBlockEconomy } from './workout-block-economy';
import type { intervalOxygenCost } from './running-economy-data';

export type RepChartSeries = {
  key: string;
  label: string;
  unit: string;
  values: (number | null)[];
  format: (value: number) => string;
  axisFormat?: (value: number) => string;
  readoutUnit?: string;
  estimated?: boolean;
  includeZero?: boolean;
};

export type RepChartAnalysis = Pick<WorkoutBlockAnalysis, 'reps'> & {
  threshold?: ThresholdBlockEconomy | null;
  oxygen?: ReturnType<typeof intervalOxygenCost>;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const integer = (value: number) => Math.round(value).toLocaleString('en-GB');
const decimal = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const signed = (value: number) => {
  const rounded = Math.round(value);
  return rounded < 0 ? `−${Math.abs(rounded)}` : rounded > 0 ? `+${rounded}` : '0';
};

function clock(value: number) {
  if (!finite(value) || value < 0) return '—';
  const seconds = Math.round(value);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const pad = (part: number) => String(part).padStart(2, '0');
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
}

function series(key: string, label: string, unit: string, values: readonly (number | null | undefined)[], options: Partial<Pick<RepChartSeries, 'format' | 'axisFormat' | 'readoutUnit' | 'estimated' | 'includeZero'>> = {}): RepChartSeries {
  return { key, label, unit, values: values.map(value => finite(value) ? value : null), format: integer, ...options };
}

function rateSeries(reps: RepChartAnalysis['reps'], family: string) {
  const swimming = family === 'swimming';
  // Store a speed so taller bars consistently represent faster reps. Keep the
  // athlete's usual pace units in the selected-rep reading.
  const scale = swimming ? 1000 : 3600;
  const values = reps.map(rep => positive(rep.pace) ? scale / rep.pace : null);
  return series('speed', 'Speed', swimming ? 'm/s' : 'km/h', values, {
    axisFormat: decimal,
    format: family === 'cycling' ? decimal : value => clock((swimming ? 100 : 3600) / value),
    ...(family !== 'cycling' ? { readoutUnit: swimming ? '/100m' : '/km' } : {}),
  });
}

function usefulBase(readings: RepChartSeries) {
  return readings.values.some(positive) && readings.values.filter(finite).length >= 2;
}

/** Chart values keep an x slot for every rep, including missing readings. */
export function repChartData(block: WorkoutBlock, analysis: RepChartAnalysis, family: string): { base: RepChartSeries; overlays: RepChartSeries[] } {
  const { reps, threshold, oxygen } = analysis;
  const thresholdByRep = new Map(threshold?.reps.map(rep => [rep.index, rep]));
  const oxygenByRep = new Map(oxygen?.map(rep => [rep.index, rep]));
  const duration = series('duration', 'Work time', '', reps.map(rep => rep.duration), { format: clock, axisFormat: clock });
  const speed = rateSeries(reps, family);
  const power = series('power', 'Power', 'W', reps.map(rep => rep.power));
  const ascent = series('ascent', 'Climb gain', 'm', reps.map(rep => rep.ascent), { estimated: reps.some(rep => rep.ascentSource === 'estimated') });
  const base = block.format === 'mixed' ? duration
    : family !== 'swimming' && hasHillReps(block) && usefulBase(ascent) ? ascent
    : family === 'cycling' && usefulBase(power) ? power
    : usefulBase(speed) ? speed : duration;

  const heartRate = series('heartrate', 'Avg HR', 'bpm', reps.map(rep => rep.heartrate));
  const rest = series('recoveryDuration', 'Rest after', 's', reps.map(rep => rep.recovery?.duration), { format: clock, axisFormat: integer, readoutUnit: '' });
  const recovery = series('recoveryHeartRate', 'Recovery HR change', 'bpm', reps.map(rep => {
    const drop = rep.recovery?.hrDrop;
    return finite(drop) ? -drop || 0 : null;
  }), { format: signed, estimated: true, includeZero: true });
  const cadence = series('cadence', 'Cadence', cadenceUnit(family), reps.map(rep => rep.cadence));
  const mechanics = family === 'running' ? [
    series('stepLength', 'Step length', 'cm', reps.map(rep => rep.stepLength)),
    series('groundContactTime', 'Ground contact', 'ms', reps.map(rep => rep.groundContactTime)),
  ] : [];
  const hills = family === 'running' ? reps.map(hillRepMetrics) : [];
  const hillLayers = hills.some(Boolean) ? [
    series('climbRate', 'Climb rate', 'm/min', hills.map(hill => hill?.climbRate), {
      format: decimal, axisFormat: decimal, estimated: hills.some(hill => hill?.gainEstimated),
    }),
    series('netGrade', 'Net grade', '%', hills.map(hill => hill?.grade), {
      format: decimal, axisFormat: decimal, estimated: hills.some(hill => hill?.estimated),
    }),
  ] : [];
  const oxygenCosts = family === 'running' && oxygenByRep.size ? [
    series('oxygenPerRep', 'O₂ per rep', 'mL/kg', reps.map(rep => oxygenByRep.get(rep.index)?.oxygenPerRep), { estimated: true }),
    series('oxygenPerKm', 'O₂ per km', 'mL/kg/km', reps.map(rep => oxygenByRep.get(rep.index)?.oxygenPerKm), { estimated: true }),
  ] : [];
  const economy = threshold ? [
    series('beatsPerKm', 'Heartbeats per km', 'beats/km', reps.map(rep => thresholdByRep.get(rep.index)?.beatsPerKm), { estimated: true }),
    series('gradeAdjustedPace', 'Grade-adjusted pace', '/km', reps.map(rep => thresholdByRep.get(rep.index)?.gradeAdjustedPace), { format: clock, axisFormat: clock, estimated: true }),
    series('lateHeartRate', 'Final-minute HR', 'bpm', reps.map(rep => thresholdByRep.get(rep.index)?.lateHeartRate)),
    series('energyPerKm', 'Energy per km', 'kJ/km', reps.map(rep => thresholdByRep.get(rep.index)?.energyPerKm), { format: decimal, estimated: true }),
  ] : [];
  const hasVariedDuration = new Set(duration.values.filter(finite).map(Math.round)).size > 1;
  const candidates = [heartRate, power, cadence, ...mechanics, rest, recovery,
    ...(family !== 'swimming' && ascent.values.some(positive) ? [ascent] : []),
    ...hillLayers, ...oxygenCosts, ...economy, speed, ...(hasVariedDuration ? [duration] : []),
  ];

  return { base, overlays: candidates.filter(readings => readings !== base && readings.values.some(finite)) };
}
