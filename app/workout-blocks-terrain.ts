import { isUphillRep, type WorkoutBlock } from './workout-blocks-data';
import { sampledRepElevation } from './workout-rep-elevation';

type Span = { start: number; end: number };

/** Keep device-measured totals, and use only aligned samples for missing totals. */
export function withRepElevation(
  blocks: readonly WorkoutBlock[],
  series: Parameters<typeof sampledRepElevation>[0],
  alignedLaps: readonly (Span & { index: number })[],
): WorkoutBlock[] {
  const bounds = new Map(alignedLaps.map(lap => [lap.index, lap]));
  return blocks.map(block => {
    const reps = block.reps.map(rep => {
      if (rep.ascent !== null && rep.descent !== null) return rep;
      const span = rep.bounds ?? bounds.get(rep.index);
      const measured = span && sampledRepElevation(series, span);
      if (!measured) return rep;
      return {
        ...rep,
        ascent: rep.ascent ?? measured.ascent,
        descent: rep.descent ?? measured.descent,
        ...(rep.ascent === null ? { ascentSource: 'estimated' as const } : {}),
        ...(rep.descent === null ? { descentSource: 'estimated' as const } : {}),
      };
    });
    const hills = reps.filter(isUphillRep).length;
    const kind = hills >= Math.max(2, Math.ceil(reps.length * .75)) ? 'uphill' : block.kind;
    return { ...block, kind, reps };
  });
}
