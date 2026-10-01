import { readFileSync } from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";

function moduleUrl(name) {
  let source = ts.transpileModule(
    readFileSync(new URL("../app/" + name + ".ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText;
  source = source.replace(
    /from ['"]\.\/([^'"]+)['"]/g,
    (_, dep) => `from "${moduleUrl(dep)}"`,
  );
  return (
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
}
const { runningTechnique } = await import(moduleUrl("running-technique-data"));
const run = (id, date, summary = {}, extra = {}) => ({
  id,
  date,
  sportType: "running",
  summary: { duration: 3600, speed: 3, ...summary },
  ...extra,
});
const current = run("current", "2026-10-01T12:00:00Z", {
  cadence: 180,
  stepLength: 110,
  groundContactTime: 250,
});
const older = run("older", "2026-09-30T12:00:00Z", {
  cadence: 160,
  stepLength: 100,
});
const short = run("short", "2026-09-29T12:00:00Z", {
  duration: 1800,
  cadence: 190,
  stepLength: 130,
});
const history = [
  current,
  older,
  short,
  run("same-time", current.date, { cadence: 200 }),
  run("future", "2026-10-02T12:00:00Z", { cadence: 200 }),
  run("cycle", older.date, { cadence: 80 }, { sportType: "cycling" }),
  run("missing", "2026-09-28T12:00:00Z"),
  run("bad", "not-a-date", { cadence: 200 }),
  run("too-old", "2025-09-30T12:00:00Z", { cadence: 200 }),
];
let model = runningTechnique(current, history),
  cadence = model.rows.find((r) => r.key === "cadence"),
  steps = model.rows.find((r) => r.key === "stepLength");
assert.equal(model.total, 3);
assert.equal(
  cadence.baselines[0].value,
  170,
  "Averages are weighted by activity time",
);
assert.equal(steps.baselines[0].value, 110);
assert.equal(cadence.baselines[0].count, 2);
assert.equal(cadence.baselines[0].total, 3);
assert.equal(cadence.baselines[0].change, (180 / 170 - 1) * 100);
assert.equal(
  model.rows.find((r) => r.key === "groundContactTime").baselines[0].value,
  null,
  "Missing history is not zero",
);
assert.equal(
  model.months.find((m) => m.date === "2026-09").metrics.cadence.value,
  170,
);
assert.equal(
  model.months.find((m) => m.date === "2026-10").metrics.cadence.value,
  null,
  "The current run is excluded from monthly history",
);
assert.ok(
  model.months.some((m) => m.metrics.cadence.value === null),
  "Empty months preserve chart gaps",
);

const until = Date.parse(current.date),
  day = 86400000,
  boundaries = [7, 30, 90, 365].map((days) =>
    run("boundary-" + days, new Date(until - days * day).toISOString(), {
      cadence: 160,
    }),
  );
model = runningTechnique(current, boundaries);
assert.deepEqual(
  model.windows.map((w) => w.runs.length),
  [1, 2, 3, 4],
  "Start boundaries are inclusive",
);
assert.equal(
  runningTechnique(current, [
    run("outside", new Date(until - 7 * day - 1).toISOString(), {
      cadence: 160,
    }),
  ]).windows[0].runs.length,
  0,
);
assert.equal(
  runningTechnique(current, [older, older]).total,
  1,
  "Duplicate sessions are counted once",
);
assert.equal(
  runningTechnique(current, [run("older", older.date), older]).rows.find(
    (r) => r.key === "cadence",
  ).baselines[0].value,
  160,
  "Richer duplicate wins",
);

model = runningTechnique(
  current,
  [
    older,
    run("fast", older.date, { speed: 4, cadence: 200 }),
    run("unknown-pace", older.date, {
      speed: null,
      distance: null,
      cadence: 180,
    }),
  ],
  true,
);
assert.equal(
  model.total,
  1,
  "Similar pace excludes mismatched and missing speed",
);
assert.equal(
  runningTechnique(run("no-pace", current.date, { speed: null }), [older], true)
    .total,
  0,
  "Unknown current pace cannot match",
);
assert.equal(
  runningTechnique({ ...current, mergedIds: ["older"] }, [older]).total,
  0,
  "Original recordings of the current merged run are excluded",
);
assert.equal(
  runningTechnique(current, [
    { ...older, id: "merged", mergedIds: ["current"] },
  ]).total,
  0,
  "Overlapping merged recordings are excluded",
);

const streamed = run(
  "stream",
  older.date,
  { duration: 5, durationTotal: 5 },
  {
    seriesSampled: {
      sampleSize: 1,
      data: {
        cadence: [160, 170, null, 180, 190],
        stepLength: [100, 120, null, null, null],
      },
    },
  },
);
model = runningTechnique(current, [streamed]);
assert.equal(
  model.rows.find((r) => r.key === "cadence").baselines[0].value,
  175,
  "80% coverage accepts samples and skips gaps",
);
assert.equal(
  model.rows.find((r) => r.key === "stepLength").baselines[0].value,
  null,
  "Sparse samples do not become a workout average",
);
model = runningTechnique(current, [
  { ...streamed, summary: { ...streamed.summary, cadence: 185 } },
]);
assert.equal(
  model.rows.find((r) => r.key === "cadence").baselines[0].value,
  185,
  "Recorded summary takes precedence",
);
model = runningTechnique(current, [
  run("invalid", older.date, {
    cadence: 0,
    stepLength: NaN,
    groundContactTime: Infinity,
    verticalOscillation: -1,
  }),
  run("no-duration", older.date, { duration: null, cadence: 160 }),
]);
assert.equal(
  model.rows.find((r) => r.key === "cadence").baselines[0].value,
  null,
  "Invalid readings and missing weights are excluded",
);

const rawCoros = run(
  "native",
  older.date,
  { cadence: 180, stepLength: 110 },
  { provider: "coros" },
);
assert.equal(
  runningTechnique(current, [rawCoros]).rows.find((r) => r.key === "cadence")
    .baselines[0].value,
  null,
  "Unverified archived COROS technique is excluded",
);
assert.equal(
  runningTechnique(current, [{ ...rawCoros, nativeVersion: 3 }]).rows.find(
    (r) => r.key === "cadence",
  ).baselines[0].value,
  180,
  "Verified COROS technique is included",
);
const empty = runningTechnique(run("empty", current.date), []);
assert.ok(
  empty.rows.every(
    (r) => r.value === null && r.baselines.every((b) => b.value === null),
  ),
);
assert.ok(
  !empty.rows.some((r) => r.key === "flightTime"),
  "Optional unrecorded sensors stay hidden",
);
assert.equal(
  runningTechnique({ ...current, date: "invalid" }, history).total,
  0,
  "Invalid current date suppresses historical comparisons",
);
console.log(
  "Passed running technique: time-weighted windows, dates, duplicates, merged runs, pace matching, monthly gaps, sensor coverage, provider normalization and missing data.",
);
