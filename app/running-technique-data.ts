import { sportFamily } from "./sports";
import { corosNativeActivity } from "./coros-native";

export const techniqueMetrics = [
  {
    key: "cadence",
    label: "Cadence",
    unit: "steps/min",
    digits: 1,
    min: 40,
    max: 300,
  },
  {
    key: "stepLength",
    label: "Step length",
    unit: "cm",
    digits: 1,
    min: 20,
    max: 350,
  },
  {
    key: "groundContactTime",
    label: "Ground contact",
    unit: "ms",
    digits: 0,
    min: 50,
    max: 1000,
  },
  {
    key: "verticalOscillation",
    label: "Vertical movement",
    unit: "cm",
    digits: 1,
    min: 0.1,
    max: 50,
  },
  {
    key: "verticalRatio",
    label: "Vertical ratio",
    unit: "%",
    digits: 1,
    min: 0.1,
    max: 40,
  },
  {
    key: "flightTime",
    label: "Flight time",
    unit: "ms",
    digits: 0,
    min: 1,
    max: 1000,
  },
  {
    key: "groundContactTimeBalance",
    label: "Left contact balance",
    unit: "%",
    digits: 1,
    min: 1,
    max: 99,
  },
] as const;
export type TechniqueKey = (typeof techniqueMetrics)[number]["key"];
export type TechniqueActivity = {
  id?: string;
  date?: string;
  sportType?: string;
  subSportType?: string;
  provider?: string;
  mergedIds?: string[];
  demo?: boolean;
  summary?: Partial<
    Record<
      | TechniqueKey
      | "duration"
      | "durationTotal"
      | "speed"
      | "distance"
      | "pace",
      unknown
    >
  >;
  seriesSampled?: {
    sampleSize?: unknown;
    data?: Partial<Record<TechniqueKey, unknown[]>>;
  };
};
type Run = TechniqueActivity;
export const techniqueWindows = [
  { label: "7d avg", days: 7 },
  { label: "30d avg", days: 30 },
  { label: "90d avg", days: 90 },
  { label: "1y avg", days: 365 },
] as const;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const normalized = (a: Run): Run =>
  a.provider === "coros" ? corosNativeActivity(a) : a;
const day = 86400000;
function speed(a: Run) {
  const s = a.summary ?? {};
  return finite(s.speed) && s.speed > 0
    ? s.speed
    : finite(s.distance) &&
        s.distance > 0 &&
        finite(s.duration) &&
        s.duration > 0
      ? s.distance / s.duration
      : finite(s.pace) && s.pace > 0
        ? 1000 / s.pace
        : null;
}
function reading(a: Run, key: TechniqueKey) {
  const spec = techniqueMetrics.find((m) => m.key === key)!;
  const valid = (v: unknown): v is number =>
    finite(v) && v >= spec.min && v <= spec.max;
  const s = a.summary ?? {};
  if (valid(s[key])) return s[key];
  const values = a.seriesSampled?.data?.[key],
    step = a.seriesSampled?.sampleSize;
  if (!Array.isArray(values) || !finite(step) || step <= 0 || step > 30)
    return null;
  const cap =
    finite(s.durationTotal) && s.durationTotal > 0
      ? s.durationTotal
      : values.length * step;
  let total = 0,
    seconds = 0;
  values.forEach((v: unknown, i: number) => {
    const dt = Math.max(0, Math.min(step, cap - i * step));
    if (dt && valid(v)) {
      total += v * dt;
      seconds += dt;
    }
  });
  return seconds > 0 && seconds / cap >= 0.8 ? total / seconds : null;
}
function record(a: Run) {
  const s = a.summary ?? {};
  return {
    id: a.id,
    date: a.date,
    at: Date.parse(a.date ?? ""),
    duration: finite(s.duration) && s.duration > 0 ? s.duration : null,
    speed: speed(a),
    values: Object.fromEntries(
      techniqueMetrics.map((m) => [m.key, reading(a, m.key)]),
    ) as Record<TechniqueKey, number | null>,
  };
}
type RecordRun = ReturnType<typeof record>;
function aggregate(runs: RecordRun[], key: TechniqueKey) {
  const known = runs.filter(
      (r) => r.duration !== null && r.values[key] !== null,
    ),
    seconds = known.reduce((n, r) => n + r.duration!, 0);
  return {
    value: seconds
      ? known.reduce((n, r) => n + r.values[key]! * r.duration!, 0) / seconds
      : null,
    count: known.length,
    total: runs.length,
    seconds,
  };
}

export function runningTechnique(
  activity: Run,
  history: Run[],
  similarPace = false,
) {
  const current = record(normalized(activity)),
    until = current.at,
    from = until - 365 * day;
  const omitted = new Set([activity.id, ...(activity.mergedIds ?? [])]);
  const unique = new Map<string, Run>();
  for (const raw of history) {
    if (
      !raw.id ||
      omitted.has(raw.id) ||
      (raw.mergedIds ?? []).some((id: string) => omitted.has(id))
    )
      continue;
    const a = normalized(raw),
      at = Date.parse(a.date ?? "");
    if (
      sportFamily(a) !== "running" ||
      !Number.isFinite(until) ||
      !Number.isFinite(at) ||
      at >= until ||
      at < from
    )
      continue;
    if (!a.id) continue;
    const previous = unique.get(a.id);
    if (
      !previous ||
      techniqueMetrics.filter((m) => reading(a, m.key) !== null).length >
        techniqueMetrics.filter((m) => reading(previous, m.key) !== null).length
    )
      unique.set(a.id, a);
  }
  let runs = [...unique.values()].map(record).sort((a, b) => a.at - b.at);
  if (similarPace)
    runs = runs.filter(
      (r) =>
        current.speed !== null &&
        r.speed !== null &&
        Math.abs(r.speed / current.speed - 1) <= 0.1,
    );
  const windows = techniqueWindows.map((w) => {
    const eligible = runs.filter((r) => r.at >= until - w.days * day);
    const paceRuns = eligible.filter(
        (r) => r.duration !== null && r.speed !== null,
      ),
      seconds = paceRuns.reduce((n, r) => n + r.duration!, 0),
      meanSpeed = seconds
        ? paceRuns.reduce((n, r) => n + r.speed! * r.duration!, 0) / seconds
        : null;
    return {
      ...w,
      runs: eligible,
      pace: meanSpeed === null ? null : 1000 / meanSpeed,
    };
  });
  const rows = techniqueMetrics
    .filter(
      (m, i) =>
        i < 5 ||
        current.values[m.key] !== null ||
        runs.some((r) => r.values[m.key] !== null),
    )
    .map((m) => ({
      ...m,
      value: current.values[m.key],
      baselines: windows.map((w) => {
        const base = aggregate(w.runs, m.key);
        return {
          ...base,
          delta:
            base.value !== null && current.values[m.key] !== null
              ? current.values[m.key]! - base.value
              : null,
          change:
            base.value !== null && current.values[m.key] !== null
              ? (current.values[m.key]! / base.value - 1) * 100
              : null,
        };
      }),
    }));
  const months = [];
  if (Number.isFinite(until)) {
    const cursor = new Date(from);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    while (+cursor < until) {
      const start = +cursor,
        next = new Date(cursor);
      next.setUTCMonth(next.getUTCMonth() + 1);
      const eligible = runs.filter((r) => r.at >= start && r.at < +next);
      months.push({
        date: cursor.toISOString().slice(0, 7),
        at: start,
        label: cursor.toLocaleDateString("en-GB", {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        }),
        metrics: Object.fromEntries(
          techniqueMetrics.map((m) => [m.key, aggregate(eligible, m.key)]),
        ) as Record<TechniqueKey, ReturnType<typeof aggregate>>,
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return {
    current,
    windows,
    rows,
    months,
    similarPace,
    canMatchPace: current.speed !== null,
    total: runs.length,
  };
}
