import { capacityAt } from './athlete-thresholds';
import { gradeFactor, terrainSamples, type AnalysisRow } from './section-analysis-data';
import { sportFamily } from './sports';
import type { WorkoutBlock, WorkoutBlockRep } from './workout-blocks-data';

type Span = { start: number; end: number };
type AlignedLap = Span & { index: number };
type Streams = Partial<Record<string, readonly unknown[]>>;
type Detail = {
  date?: string;
  sportType?: string;
  subSportType?: string;
  sessionLabel?: string | null;
  title?: string;
  cyclingContext?: {
    tredictCapacity?: unknown;
    fitness?: unknown;
    fitnessHistory?: unknown;
  } | null;
  laps?: readonly unknown[];
  seriesSampled?: { sampleSize?: unknown; data?: Streams };
};

type EconomyRep = {
  index: number;
  beatsPerKm: number | null;
  gradeAdjustedPace: number | null;
  lateHeartRate: number | null;
  energyPerKm: number | null;
};

export type ThresholdBlockEconomy = {
  targetPace: number | null;
  targetHeartRate?: number;
  reps: EconomyRep[];
};

const MIN_REP_SECONDS = 120;
const MIN_COVERAGE = .8;
const STEEP_GRADE = .05;
const PACE_TOLERANCE = .07;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const between = (value: unknown, min: number, max: number): value is number => finite(value) && value >= min && value <= max;
const validPace = (value: unknown): value is number => between(value, 120, 900);
const validSpeed = (value: unknown): value is number => between(value, 1.6, 8.5);
const validHr = (value: unknown): value is number => between(value, 40, 250);
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const thresholdTag = (value: unknown) => typeof value === 'string' && value.trim().toLowerCase() === 'threshold';

function corosReference(value: unknown, since: number, workoutTime: number) {
  const row = record(value);
  const pace = row?.thresholdPace;
  const observedAt = typeof row?.observedAt === 'string' ? Date.parse(row.observedAt) : since;
  return validPace(pace) && Number.isFinite(observedAt) && observedAt <= workoutTime ? { pace, observedAt } : null;
}

function thresholdReference(detail: Detail) {
  const workoutTime = Date.parse(detail.date ?? '');
  if (!Number.isFinite(workoutTime)) return { pace: null, heartrate: null };
  const { cyclingContext } = detail;
  const tredict = capacityAt(cyclingContext?.tredictCapacity, 'running', workoutTime);
  const heartrate = validHr(tredict?.lthr) ? tredict.lthr : null;
  if (validPace(tredict?.ftpa)) return { pace: tredict.ftpa, heartrate };
  let latest = corosReference(cyclingContext?.fitness, NaN, workoutTime);
  for (const [day, value] of Object.entries(record(cyclingContext?.fitnessHistory) ?? {})) {
    if (!/^\d{8}$/.test(day)) continue;
    const dayKey = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
    const since = Date.parse(`${dayKey}T00:00:00Z`);
    if (!Number.isFinite(since) || new Date(since).toISOString().slice(0, 10) !== dayKey) continue;
    const entry = corosReference(value, since, workoutTime);
    if (entry && (!latest || entry.observedAt > latest.observedAt)) latest = entry;
  }
  return { pace: latest?.pace ?? null, heartrate };
}

function sampleWindow(rep: WorkoutBlockRep, aligned: Span | undefined, step: number): Span | null {
  const span = rep.bounds ?? aligned;
  if (!span || !finite(span.start) || !finite(span.end) || span.start < 0 || span.end <= span.start) return null;
  const start = span.start * 60;
  const end = span.end * 60;
  // A lap with markedly different wall-clock and active durations may straddle a pause.
  return Math.abs(end - start - rep.duration) <= Math.max(step, rep.duration * .1) ? { start, end } : null;
}

function seriesMean(length: number, step: number, span: Span, read: (index: number) => number | null, coverageSeconds = (span.end - span.start) * MIN_COVERAGE) {
  let weight = 0;
  let total = 0;
  for (let index = Math.floor(span.start / step); index < Math.min(length, Math.ceil(span.end / step)); index++) {
    const seconds = Math.min(span.end, (index + 1) * step) - Math.max(span.start, index * step);
    if (seconds <= 0) continue;
    const value = read(index);
    if (value === null) continue;
    weight += seconds;
    total += value * seconds;
  }
  return weight >= coverageSeconds - 1e-7 ? total / weight : null;
}

function sampledTerrain(data: Streams, step: number, span: Span) {
  const speed = data.speed ?? [];
  const recordedGrade = data.grade ?? [];
  const first = Math.ceil(span.start / step - 1e-7);
  const end = Math.min(speed.length, Math.floor(span.end / step + 1e-7));
  const coverageSeconds = (span.end - span.start) * MIN_COVERAGE;
  if ((end - first) * step < coverageSeconds - 1e-7) return { gradeAdjustedPace: null, steep: false };
  let inferredGrade: (number | null)[] = [];
  if (Array.isArray(data.altitude)) {
    const rows = Array.from({ length: end - first }, (_, offset): AnalysisRow => {
      const index = first + offset;
      const altitude = data.altitude?.[index];
      const distance = data.distance?.[index];
      const value = speed[index];
      return {
        time: offset * step / 60,
        altitude: finite(altitude) ? altitude : null,
        distance: finite(distance) && distance >= 0 ? distance : null,
        speed: validSpeed(value) ? value : null,
      };
    });
    // Fit the terrain within this rep so recoveries and climbs outside it do not affect the grade.
    inferredGrade = terrainSamples(rows, step).grade;
  }
  const interior = { start: first * step, end: end * step };
  // Only whole sample intervals that lie inside the rep. Coverage is against full rep time.
  const mean = (read: (index: number) => number | null) => seriesMean(end, step, interior, read, coverageSeconds);
  const grade = (index: number) => {
    const value = recordedGrade[index];
    if (between(value, -30, 30)) return value / 100;
    const inferred = inferredGrade[index - first];
    return between(inferred, -.30, .30) ? inferred : null;
  };
  const steepShare = mean(index => {
    const g = grade(index);
    return validSpeed(speed[index]) && g !== null ? Number(Math.abs(g) >= STEEP_GRADE) : null;
  });
  const providerGap = mean(index => {
    const raw = speed[index];
    const adjusted = data.speedGradeAdjusted?.[index];
    return validSpeed(raw) && validSpeed(adjusted) && between(adjusted / raw, .7, 1.4) ? adjusted : null;
  });
  const gap = providerGap ?? mean(index => {
    const raw = speed[index];
    const g = grade(index);
    return validSpeed(raw) && g !== null ? raw * gradeFactor(g) : null;
  });
  const pace = gap === null ? null : 1000 / gap;
  return { gradeAdjustedPace: validPace(pace) ? pace : null, steep: steepShare !== null && steepShare >= .5 };
}

function steepLap(rep: WorkoutBlockRep) {
  if (!finite(rep.distance) || rep.distance <= 0 || !finite(rep.ascent) || !finite(rep.descent)) return false;
  return Math.abs(rep.ascent - rep.descent) / rep.distance >= STEEP_GRADE;
}

/** Within-session cost per kilometre for sustained work close to the athlete's dated threshold pace. */
export function thresholdBlockEconomy(
  block: WorkoutBlock,
  detail: Detail,
  reps: readonly WorkoutBlockRep[],
  alignedLaps: readonly AlignedLap[],
): ThresholdBlockEconomy | null {
  if (block.kind === 'uphill' || (detail.sportType && sportFamily(detail) !== 'running')) return null;
  const { pace: targetPace, heartrate: datedThresholdHr } = thresholdReference(detail);
  const taggedWorkout = thresholdTag(detail.sessionLabel) || /^threshold(?:$|\s*(?:[·:–—-]|\s+(?:run|intervals?|repeats?|workout)\b))/i.test(detail.title?.trim() ?? '');
  const step = detail.seriesSampled?.sampleSize;
  const sampleStep = between(step, .1, 15) ? step : null;
  const data = detail.seriesSampled?.data;
  const windows = new Map(alignedLaps.map(lap => [lap.index, lap]));
  const candidates: { row: EconomyRep; pace: number; byPace: boolean; byHr: boolean }[] = [];

  for (const rep of reps) {
    if (!finite(rep.duration) || rep.duration < MIN_REP_SECONDS || steepLap(rep)) continue;
    const pace = finite(rep.distance) && rep.distance > 0 ? rep.duration / rep.distance * 1000 : rep.pace;
    if (!validPace(pace)) continue;
    const lap = rep.bounds || taggedWorkout ? null : record(detail.laps?.[rep.index - 1]);
    const lapTag = record(lap?.summary)?.intensity ?? lap?.intensity;
    const declared = taggedWorkout || thresholdTag(lapTag);
    if (targetPace === null && !declared && (datedThresholdHr === null || rep.duration < 180)) continue;
    const span = sampleStep === null ? null : sampleWindow(rep, windows.get(rep.index), sampleStep);
    const terrain = data && span && sampleStep ? sampledTerrain(data, sampleStep, span) : null;
    if (terrain?.steep) continue;
    const gradeAdjustedPace = terrain?.gradeAdjustedPace ?? null;
    const comparablePace = gradeAdjustedPace ?? pace;
    const byPace = targetPace !== null && Math.abs(comparablePace / targetPace - 1) <= PACE_TOLERANCE;
    const hr = data?.heartrate;
    const lateHeartRate = Array.isArray(hr) && span && sampleStep
      ? seriesMean(hr.length, sampleStep, { start: span.end - 60, end: span.end }, index => validHr(hr[index]) ? hr[index] : null)
      : null;
    const byHr = !declared && targetPace === null && datedThresholdHr !== null && rep.duration >= 180 &&
      between(lateHeartRate, datedThresholdHr - 5, datedThresholdHr + 3);
    if (!byPace && !declared && !byHr) continue;
    candidates.push({
      pace: comparablePace, byPace, byHr,
      row: {
        index: rep.index,
        beatsPerKm: validHr(rep.heartrate) ? rep.heartrate * pace / 60 : null,
        gradeAdjustedPace,
        lateHeartRate,
        energyPerKm: between(rep.power, 1, 1200) ? rep.power * pace / 1000 : null,
      },
    });
  }

  // A workout title can cover other kinds of work as well. Require a second
  // rep at a similar pace when the only threshold signal is an explicit label.
  const included = candidates.filter(candidate => candidate.byPace || candidate.byHr || candidates.some(other =>
    other !== candidate && Math.max(candidate.pace, other.pace) / Math.min(candidate.pace, other.pace) - 1 <= PACE_TOLERANCE,
  ));
  const economy = included.map(candidate => candidate.row);
  if (economy.length < 2 || !economy.some(rep => rep.beatsPerKm !== null || rep.gradeAdjustedPace !== null || rep.lateHeartRate !== null || rep.energyPerKm !== null)) return null;
  return {
    targetPace: included.every(candidate => candidate.byPace) ? targetPace : null,
    ...(datedThresholdHr !== null && included.some(candidate => candidate.byHr) ? { targetHeartRate: datedThresholdHr } : {}),
    reps: economy,
  };
}
