"use client";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  runningTechnique,
  type TechniqueKey,
  type TechniqueActivity,
} from "./running-technique-data";
import { paceLabel } from "./activity-metrics";
import "./running-technique.css";

const number = (v: number | null, digits = 1) =>
  v === null
    ? "—"
    : v.toLocaleString("en-GB", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
export default function RunningTechnique({
  detail,
  history,
  loading,
}: {
  detail: TechniqueActivity;
  history: TechniqueActivity[];
  loading: boolean;
}) {
  const [similar, setSimilar] = useState(false),
    [chosen, setChosen] = useState<TechniqueKey>("stepLength");
  const model = useMemo(
    () => runningTechnique(detail, history, similar),
    [detail, history, similar],
  );
  const available = model.rows.filter(
      (r) => r.value !== null || r.baselines.some((b) => b.value !== null),
    ),
    metric = available.find((r) => r.key === chosen) ?? available[0];
  const points = metric
    ? model.months.map((m) => ({
        label: m.label,
        value: m.metrics[metric.key].value,
        count: m.metrics[metric.key].count,
        total: m.metrics[metric.key].total,
      }))
    : [];
  const hasTrend = points.some((p) => p.value !== null),
    today = metric?.value ?? null;
  return (
    <section
      className="running-technique"
      aria-label="Running technique over time"
      aria-busy={loading}
    >
      <header>
        <div>
          <h3>Running technique · over time</h3>
          <p>This run against your earlier running averages</p>
        </div>
        <div
          className="technique-scope"
          role="group"
          aria-label="Technique comparison runs"
        >
          <button aria-pressed={!similar} onClick={() => setSimilar(false)}>
            All runs
          </button>
          <button
            aria-pressed={similar}
            disabled={!model.canMatchPace}
            title={
              model.canMatchPace
                ? "Runs within 10% of this run’s average speed"
                : "Average pace is unavailable for this run"
            }
            onClick={() => setSimilar(true)}
          >
            Similar pace
          </button>
        </div>
      </header>
      <div
        className="technique-table-scroll"
        role="region"
        aria-label="Running technique averages"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col" className="technique-current">
                This run
              </th>
              {model.windows.map((w) => (
                <th scope="col" key={w.days}>
                  {w.label}
                  <small>
                    {w.runs.length} {w.runs.length === 1 ? "run" : "runs"}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="technique-pace">
              <th scope="row">
                Pace <small>/km</small>
              </th>
              <td className="technique-current">
                {paceLabel(
                  model.current.speed === null
                    ? null
                    : 1000 / model.current.speed,
                )}
              </td>
              {model.windows.map((w) => (
                <td key={w.days}>{paceLabel(w.pace)}</td>
              ))}
            </tr>
            {model.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  {row.label}
                  <small>{row.unit}</small>
                </th>
                <td className="technique-current">
                  <strong>{number(row.value, row.digits)}</strong>
                </td>
                {row.baselines.map((b, i) => (
                  <td key={i}>
                    <strong>{number(b.value, row.digits)}</strong>
                    {b.change !== null && (
                      <span
                        className="technique-change"
                        title={`This run minus average: ${number(b.delta, row.digits)} ${row.unit}`}
                      >
                        {b.change > 0 ? "↑" : b.change < 0 ? "↓" : "→"}{" "}
                        {number(Math.abs(b.change))}% <span>this run</span>
                      </span>
                    )}
                    <small>
                      {b.count}/{b.total} {b.total === 1 ? "run" : "runs"}
                    </small>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {available.length > 0 && metric && (
        <div className="technique-history">
          <header>
            <h4>Monthly averages · past year</h4>
            <label>
              <span className="sr-only">Technique trend metric</span>
              <select
                aria-label="Technique trend metric"
                value={metric.key}
                onChange={(e) => setChosen(e.target.value as TechniqueKey)}
              >
                {available.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label} · {r.unit}
                  </option>
                ))}
              </select>
            </label>
          </header>
          {hasTrend ? (
            <>
              <div
                className="technique-chart"
                role="img"
                aria-label={`${metric.label}: duration-weighted monthly averages in ${metric.unit}; this run ${number(today, metric.digits)} ${metric.unit}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={points}
                    margin={{ left: 0, right: 10, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="#e7e6ef"
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                      minTickGap={24}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => number(v, metric.digits)}
                      width={52}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        const p = payload?.[0]?.payload;
                        return active && p ? (
                          <div className="technique-tooltip">
                            <b>{label}</b>
                            <span>
                              {number(p.value, metric.digits)} {metric.unit}
                            </span>
                            <small>
                              {p.count}/{p.total} runs with readings
                            </small>
                          </div>
                        ) : null;
                      }}
                    />
                    <Line
                      type="linear"
                      dataKey="value"
                      stroke="#7060bd"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#7060bd" }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    {today !== null && (
                      <ReferenceLine
                        y={today}
                        stroke="#298a83"
                        strokeDasharray="5 4"
                        ifOverflow="extendDomain"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="technique-chart-key">
                <i /> Monthly average
                {today !== null && (
                  <>
                    <i className="technique-run-line" /> This run ·{" "}
                    {number(today, metric.digits)} {metric.unit}
                  </>
                )}
              </p>
              <details className="technique-month-values">
                <summary>Monthly values</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>
                        {metric.label} · {metric.unit}
                      </th>
                      <th>Runs with readings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.label}>
                        <th scope="row">{p.label}</th>
                        <td>{number(p.value, metric.digits)}</td>
                        <td>
                          {p.count}/{p.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <p className="technique-empty">
              No earlier readings{similar ? " at a similar pace" : ""} yet. This
              run will become a reference for future runs.
            </p>
          )}
        </div>
      )}
      {!available.length && (
        <p className="technique-empty">
          {loading
            ? "Loading this run’s technique readings…"
            : "No recorded technique readings yet. Comparisons appear when your synced runs include them."}
        </p>
      )}
      <details className="technique-method">
        <summary>How to read the comparison</summary>
        <p>
          Averages are weighted by recorded activity time. The 7-, 30-, 90- and
          365-day windows end at this run’s start; this run and later runs are
          excluded. Averages use available synced history; a full year of data
          is not assumed. Months at either end of the past year may be partial.
          Each cell shows runs with a valid reading and activity time / eligible
          runs. Missing readings and rest days are excluded, and sensor gaps
          remain gaps on the chart.
        </p>
        <p>
          Arrows show how this run differs from that average, rather than
          whether it is better or worse.{" "}
          {similar
            ? "Similar pace includes runs whose average speed is within 10% of this run."
            : "All runs can mix easy, fast, road, trail and treadmill sessions."}{" "}
          Pace, terrain, shoes and device changes can affect technique readings.
        </p>
        <p>
          Step length is the distance from one footfall to the next; a full
          stride spans two steps. Values come from recorded workout averages, or
          sensor samples covering at least 80% of the recorded timeline. Step
          length is never estimated from pace or cadence.
        </p>
        {detail.demo && <p>Illustrative demo data.</p>}
      </details>
    </section>
  );
}
