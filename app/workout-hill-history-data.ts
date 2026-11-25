import { decode, encode, metres, toSegment, type LatLon, type RouteSignature } from './route-signature';
import { sportFamily } from './sports';
import { hillRepMetrics } from './workout-hill-rep-data';
import type { WorkoutRepAnalysis } from './workout-block-analysis-data';

type Bounds = { start: number; end: number; distanceAligned?: boolean };
type Series = { sampleSize?: unknown; data?: Record<string, unknown> };

export type HillRepSignature = RouteSignature & {
  index: number;
  seconds: number;
  recordedDistance: number;
  gain: number;
  grade: number;
  estimated: boolean;
  cadence: number | null;
  stepLength: number | null;
  gpsSampleSeconds?: number;
  distanceAligned?: boolean;
};

type WorkoutIdentity = { id: string; date: string; sportType?: string; subSportType?: string };
export type HillRepHistoryWorkout = WorkoutIdentity & { title?: string; evidence?: { hillReps?: readonly HillRepSignature[] | null } | null };
export type HillRepHistoryMatch = { id: string; date: string; title?: string; rep: HillRepSignature; matchedReps: number };

const epsilon = 1e-7;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;

function validPoint(point: unknown): point is LatLon {
  if (!Array.isArray(point) || point.length !== 2) return false;
  const [lat, lon] = point;
  return finite(lat) && finite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0);
}

function interpolate(a: LatLon, b: LatLon, offset: number): LatLon {
  return [a[0] + (b[0] - a[0]) * offset, a[1] + (b[1] - a[1]) * offset];
}

function pathLengths(points: readonly LatLon[]) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + metres(points[i - 1], points[i]));
  return lengths;
}

function spaced(points: readonly LatLon[], count: number) {
  if (points.length < 2) return [];
  const lengths = pathLengths(points);
  const total = lengths.at(-1)!;
  if (total <= 0) return [];
  let cursor = 1;
  return Array.from({ length: count }, (_, i) => {
    const at = i * total / (count - 1);
    while (cursor < points.length - 1 && lengths[cursor] < at) cursor++;
    const length = lengths[cursor] - lengths[cursor - 1];
    const fraction = length > 0 ? (at - lengths[cursor - 1]) / length : 0;
    return interpolate(points[cursor - 1], points[cursor], fraction);
  });
}

/** Compact GPS trace between the same timeline boundaries as this hill rep. */
export function hillRepSignature(rep: WorkoutRepAnalysis, alignedLap: Bounds | null | undefined, series: Series | null | undefined): HillRepSignature | null {
  const terrain = hillRepMetrics(rep);
  const step = series?.sampleSize;
  const lat = series?.data?.positionLat;
  const lon = series?.data?.positionLong;
  const bounds = rep.bounds ?? alignedLap;
  const distanceAligned = !rep.bounds && alignedLap?.distanceAligned === true;
  const recordedDistance = rep.distance;
  if (!terrain || terrain.grade === null || !positive(recordedDistance) || recordedDistance < 40 || !positive(rep.duration) ||
    !finite(step) || step < .1 || step > 15 || !Array.isArray(lat) || !Array.isArray(lon) || !bounds) return null;

  const start = bounds.start * 60;
  const end = bounds.end * 60;
  const endOfStream = (Math.min(lat.length, lon.length) - 1) * step;
  // At coarse sampling, a distance-interpolated boundary can move several
  // seconds within a GPS sample. The saved timer still determines the rep time.
  const tolerance = Math.max(1, Math.min(step, rep.duration * .06), distanceAligned ? Math.min(step / 2, rep.duration * .15) : 0);
  if (!finite(start) || !finite(end) || start < 0 || end <= start || end > endOfStream + epsilon ||
    Math.abs(end - start - rep.duration) > tolerance) return null;

  const maxGpsGap = Math.min(65, recordedDistance * .4);
  const pointAtIndex = (index: number) => {
    const point = [lat[index], lon[index]];
    return validPoint(point) ? point : null;
  };
  const pointAtTime = (seconds: number) => {
    const index = seconds / step;
    const rounded = Math.round(index);
    if (Math.abs(index - rounded) < epsilon) return pointAtIndex(rounded);
    const before = pointAtIndex(Math.floor(index));
    const after = pointAtIndex(Math.ceil(index));
    if (!before || !after || metres(before, after) > maxGpsGap) return null;
    return interpolate(before, after, index % 1);
  };
  const first = pointAtTime(start);
  const last = pointAtTime(end);
  if (!first || !last || metres(first, last) < 20) return null;

  const observations = [{ at: start, point: first }];
  const inside = { total: 0, valid: 0 };
  for (let index = Math.floor(start / step) + 1; index * step < end - epsilon; index++) {
    const time = index * step;
    if (time <= start + epsilon) continue;
    const point = pointAtIndex(index);
    inside.total++;
    if (!point) continue;
    inside.valid++;
    observations.push({ at: time, point });
  }
  if (inside.valid < 2 || inside.valid < inside.total * .8) return null;
  observations.push({ at: end, point: last });

  let distance = 0;
  for (let i = 1; i < observations.length; i++) {
    const seconds = observations[i].at - observations[i - 1].at;
    const moved = metres(observations[i - 1].point, observations[i].point);
    if (seconds > Math.min(step * 2, 20) + epsilon || moved > Math.min(maxGpsGap, seconds * 12)) return null;
    distance += moved;
  }
  if (distance < 35 || Math.abs(distance / recordedDistance - 1) > .2) return null;

  const points = observations.map(item => item.point);
  const count = Math.min(24, Math.max(8, Math.ceil(distance / 12) + 1));
  const trace = points.length > count ? spaced(points, count) : points;
  return {
    index: rep.index, seconds: rep.duration, recordedDistance, gain: terrain.gain, grade: terrain.grade,
    estimated: terrain.estimated, cadence: terrain.cadence, stepLength: terrain.stepLength,
    line: encode(trace), distance, start: first, end: last,
    gpsSampleSeconds: step, ...(distanceAligned ? { distanceAligned: true } : {}),
  };
}

function pointsOf(route: RouteSignature) {
  if (typeof route.line !== 'string' || route.line.length > 10_000 || !/^[?-~]+$/.test(route.line)) return [];
  const points = decode(route.line);
  return points.every(validPoint) ? points : [];
}

function nearLine(point: LatLon, line: readonly LatLon[]) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, toSegment(point, line[i - 1], line[i]));
  return best;
}

/** Shortlist a whole workout route. A positive result does not identify a matched rep. */
export function hillRouteMayContain(target: HillRepSignature, route: RouteSignature) {
  if (!positive(route.distance) || !positive(target.distance) || route.distance < target.distance * .75 ||
    !validPoint(target.start) || !validPoint(target.end)) return false;
  const trace = pointsOf(route);
  return nearLine(target.start, trace) <= 60 && nearLine(target.end, trace) <= 60;
}

function usable(signature: HillRepSignature) {
  return Number.isInteger(signature.index) && signature.index > 0 && positive(signature.seconds) && positive(signature.distance) &&
    positive(signature.recordedDistance) && validPoint(signature.start) && validPoint(signature.end);
}

function overlap(samples: LatLon[], path: LatLon[]) {
  const errors = samples.map(point => nearLine(point, path)).sort((a, b) => a - b);
  return errors[Math.floor(errors.length * .5)] <= 6 && errors[Math.floor(errors.length * .85)] <= 11;
}

function coarseDistanceAligned(signature: HillRepSignature) {
  const step = signature.gpsSampleSeconds;
  return signature.distanceAligned === true && finite(step) && step >= 10 && step <= 15;
}

function nearEndpointDirection(point: LatLon, path: LatLon[], start: boolean, allowance: number) {
  const endpoint = start ? path[0] : path.at(-1)!;
  for (let offset = 1; offset < path.length; offset++) {
    const inside = path[start ? offset : path.length - 1 - offset];
    const length = metres(endpoint, inside);
    if (length >= 5) {
      const scale = allowance / length;
      return toSegment(point, interpolate(endpoint, inside, -scale), interpolate(endpoint, inside, scale)) <= 6;
    }
  }
  return false;
}

/** Same measured course in the same direction, within short-route GPS tolerance. */
export function sameHillRep(a: HillRepSignature, b: HillRepSignature) {
  if (!usable(a) || !usable(b)) return false;
  const shorter = Math.min(a.recordedDistance, b.recordedDistance);
  if (Math.abs(a.recordedDistance - b.recordedDistance) > Math.max(6, shorter * .1) ||
    Math.abs(a.distance - b.distance) > Math.max(6, Math.min(a.distance, b.distance) * .12)) return false;
  const endpointTolerance = Math.max(8, Math.min(15, shorter * .075));
  const startGap = metres(a.start, b.start);
  const endGap = metres(a.end, b.end);
  const relaxedStart = startGap > endpointTolerance;
  const relaxedEnd = endGap > endpointTolerance;
  const extraAllowance = shorter >= 150 && (coarseDistanceAligned(a) || coarseDistanceAligned(b))
    ? Math.min(20, shorter * .12) : endpointTolerance;
  if (Math.max(startGap, endGap) > extraAllowance || (relaxedStart && relaxedEnd) ||
    startGap + endGap >= metres(a.start, b.end) + metres(a.end, b.start)) return false;

  const aPath = pointsOf(a);
  const bPath = pointsOf(b);
  if (aPath.length < 4 || bPath.length < 4) return false;
  // Sampling uncertainty can shift an endpoint along a route. It cannot
  // justify an approach or finish on an adjacent path.
  if ((relaxedStart || relaxedEnd) &&
    (!nearEndpointDirection(relaxedStart ? a.start : a.end, bPath, relaxedStart, extraAllowance) ||
      !nearEndpointDirection(relaxedStart ? b.start : b.end, aPath, relaxedStart, extraAllowance))) return false;
  const aSamples = spaced(aPath, 20);
  const bSamples = spaced(bPath, 20);
  if (aSamples.length !== bSamples.length || aSamples.length !== 20) return false;
  const orderedTolerance = Math.max(12, Math.min(22, shorter * .11));
  const ordered = aSamples.filter((point, i) => metres(point, bSamples[i]) <= orderedTolerance).length;
  return ordered >= 17 && overlap(aSamples, bPath) && overlap(bSamples, aPath);
}

/** Select the fastest matching rep in each other saved workout, preserving sensor gaps. */
export function hillRepHistory(current: HillRepSignature, workout: WorkoutIdentity, history: readonly HillRepHistoryWorkout[]): { attempts: HillRepHistoryMatch[]; matchedReps: number } {
  const matches = new Map<string, { workout: HillRepHistoryWorkout; reps: Map<number, HillRepSignature> }>();
  if (!Number.isFinite(Date.parse(workout.date))) return { attempts: [], matchedReps: 0 };
  const family = sportFamily(workout);
  for (const other of history) {
    if (!other.id || other.id === workout.id || !Number.isFinite(Date.parse(other.date)) ||
      (workout.sportType && other.sportType && sportFamily(other) !== family)) continue;
    for (const rep of other.evidence?.hillReps ?? []) {
      if (!rep || !sameHillRep(current, rep)) continue;
      const session = matches.get(other.id) ?? { workout: other, reps: new Map<number, HillRepSignature>() };
      if (!session.reps.has(rep.index)) session.reps.set(rep.index, rep);
      matches.set(other.id, session);
    }
  }
  const attempts = [...matches.values()].map(({ workout: source, reps }): HillRepHistoryMatch => {
    const fastest = [...reps.values()].sort((a, b) => a.seconds - b.seconds || a.index - b.index)[0];
    return { id: source.id, date: source.date, title: source.title, rep: fastest, matchedReps: reps.size };
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { attempts, matchedReps: attempts.reduce((count, attempt) => count + attempt.matchedReps, 0) };
}
