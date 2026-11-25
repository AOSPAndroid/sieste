type TimedElevation = {
  sampleSize?: unknown;
  data?: {
    altitude?: readonly unknown[];
    distance?: readonly unknown[];
  };
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Cumulative gain and loss within profile bounds (minutes), using observed altitude in metres. */
export function sampledRepElevation(seriesSampled: TimedElevation | undefined, span: { start: number; end: number }): { ascent: number; descent: number } | null {
  const step = seriesSampled?.sampleSize;
  const altitude = seriesSampled?.data?.altitude;
  if (!finite(step) || step <= 0 || step > 15 || !Array.isArray(altitude) || altitude.length < 3) return null;

  const start = span.start * 60;
  const end = span.end * 60;
  if (!finite(start) || !finite(end) || start < 0 || end <= start) return null;

  const epsilon = Math.min(1e-7, step * 1e-6);
  const observedEnd = Math.min(end, (altitude.length - 1) * step);
  const observed = observedEnd - start;
  // A file can close one sample after its last reading. Count only observed time.
  if (end - observedEnd > step + epsilon || observed + epsilon < Math.max(2 * step, (end - start) * .9)) return null;

  const first = Math.floor((start + epsilon) / step);
  const last = Math.min(altitude.length - 1, Math.ceil((observedEnd - epsilon) / step));
  const distance = seriesSampled?.data?.distance;
  const maxJump = Math.max(6, step * 1.5);
  const elevations: number[] = [];
  for (let i = first; i <= last; i++) {
    const value = altitude[i];
    if (!finite(value)) return null;
    const previous = elevations.at(-1);
    if (previous !== undefined && Math.abs(value - previous) > maxJump) return null;
    if (i > first) {
      const from = distance?.[i - 1];
      const to = distance?.[i];
      if (finite(from) && finite(to) && to < from) return null;
    }
    elevations.push(value);
  }

  // Only adjacent readings support fractional boundaries. A missing one has already rejected the span.
  const tail = elevations.length - 1;
  const startFraction = (start - first * step) / step;
  const endFraction = (last * step - observedEnd) / step;
  if (startFraction > 0) elevations[0] += (elevations[1] - elevations[0]) * startFraction;
  if (endFraction > 0) elevations[tail] += (elevations[tail - 1] - elevations[tail]) * endFraction;

  let ascent = 0;
  let descent = 0;
  let anchor = elevations[0];
  let extreme = anchor;
  let direction = 0;
  const finishSlope = () => {
    if (direction > 0) ascent += extreme - anchor;
    if (direction < 0) descent += anchor - extreme;
  };
  for (let i = 1; i <= tail; i++) {
    let value = elevations[i];
    // Median-filter dense samples over at most four seconds, preserving slopes and boundaries.
    if (step <= 2 && i < tail) {
      const before = elevations[i - 1];
      const after = elevations[i + 1];
      value = Math.max(Math.min(before, after), Math.min(Math.max(before, after), value));
    }
    // A metre of reversal confirms a summit or valley without rounding each rise.
    if (direction === 0) {
      if (Math.abs(value - anchor) >= 1) {
        direction = Math.sign(value - anchor);
        extreme = value;
      }
    } else if ((value - extreme) * direction >= 0) {
      extreme = value;
    } else if ((extreme - value) * direction >= 1) {
      finishSlope();
      anchor = extreme;
      extreme = value;
      direction = -direction;
    }
  }
  finishSlope();
  return { ascent: Math.round(ascent), descent: Math.round(descent) };
}
