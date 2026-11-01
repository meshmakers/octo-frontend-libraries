/**
 * Aligns the series of several stream-data sources on one time grid (AB#7951).
 *
 * Every source delivers its points keyed by the bucket start instant (epoch ms). Each source's
 * bucket step is its most frequent distance between consecutive instants (gaps in the data do not
 * change it). The grid step is the COARSEST source step; the source that has it (the first one on a
 * tie, i.e. the primary source when it is passed first) is the reference and gives the anchor.
 *
 * - Fixed-size grid (step up to one hour): a source is aligned when every instant is a whole number
 *   of grid steps away from the reference anchor. A finer rung (5-min buckets on a 15-min grid) or
 *   a shifted anchor puts instants between grid points: that source is reported as misaligned and
 *   left out instead of being plotted shifted. Missing grid instants between the first and the last
 *   instant are filled in, so a bucket no source has data for is still a gap.
 * - Calendar grid (longer steps: days, months, whose real length changes with DST and month
 *   length): a source is aligned when none of its instants lies strictly inside a reference bucket
 *   (0 < distance to the nearest reference instant < step). Instants only, no wall-clock
 *   arithmetic, so days across a DST change (23 h / 25 h) align when the sources share them. No
 *   fill-in.
 *
 * Gaps: a grid instant a series has no point for is `null` (rendered as a gap, never 0).
 */

/** Largest fixed-size grid step: modular alignment check and fill-in up to here, calendar rule above. */
export const MAX_FILLED_GRID_STEP_MS = 60 * 60 * 1000;

/** Instants a source needs for its step to count when the reference is chosen. */
const MIN_REFERENCE_INSTANTS = 3;

/** Upper bound of filled grid instants, guarding against a degenerate step over a long window. */
const MAX_FILLED_GRID_POINTS = 20000;

/** One series of a source: its values per bucket start instant. */
export interface TimeGridSeriesInput {
  name: string;
  points: ReadonlyMap<number, number | null>;
  unit?: string;
}

/** The series one source delivered. */
export interface TimeGridSourceInput {
  /** Stable source key (the series key; the primary source uses a reserved key). */
  sourceKey: string;
  /** Display name used in hints. */
  sourceLabel: string;
  series: TimeGridSeriesInput[];
}

/** One aligned series: `data[i]` belongs to `instants[i]`. */
export interface AlignedTimeSeries {
  name: string;
  sourceKey: string;
  data: (number | null)[];
  unit?: string;
}

/** A source left out because its buckets do not sit on the grid. */
export interface MisalignedTimeSource {
  sourceKey: string;
  sourceLabel: string;
  /** The source's own bucket step (ms), `null` when it has fewer than two instants. */
  stepMs: number | null;
  /** The grid step (ms) its points did not match. */
  gridStepMs: number;
}

export interface AlignedTimeGrid {
  /** Bucket start instants (epoch ms), ascending. */
  instants: number[];
  /** Grid step (ms), `null` when no source has two instants. */
  gridStepMs: number | null;
  series: AlignedTimeSeries[];
  misaligned: MisalignedTimeSource[];
}

/** Sorted distinct instants of all series of a source. */
function sourceInstants(source: TimeGridSourceInput): number[] {
  const set = new Set<number>();
  for (const s of source.series) {
    for (const t of s.points.keys()) {
      if (Number.isFinite(t)) set.add(t);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Typical bucket step of sorted instants: the most frequent positive distance between consecutive
 * instants (the smaller one on a tie), `null` for fewer than two instants.
 */
export function bucketStepMs(instants: readonly number[]): number | null {
  const counts = new Map<number, number>();
  for (let i = 1; i < instants.length; i++) {
    const d = instants[i] - instants[i - 1];
    if (d > 0) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let step: number | null = null;
  let best = 0;
  for (const [d, n] of counts) {
    if (n > best || (n === best && step !== null && d < step)) {
      step = d;
      best = n;
    }
  }
  return step;
}

/** Distance from `t` to the nearest value in the sorted array `sorted` (Infinity when empty). */
function distanceToNearest(sorted: readonly number[], t: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  if (hi < 0) return Infinity;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < t) lo = mid + 1; else hi = mid;
  }
  let best = Math.abs(sorted[lo] - t);
  if (lo > 0) best = Math.min(best, Math.abs(sorted[lo - 1] - t));
  return best;
}

/**
 * Aligns the sources on one grid. Source order is kept for the series; the first source wins a
 * tie for the coarsest step (the primary source when it is passed first).
 */
export function alignOnTimeGrid(sources: readonly TimeGridSourceInput[]): AlignedTimeGrid {
  const perSource = sources.map(source => {
    const instants = sourceInstants(source);
    return { source, instants, step: bucketStepMs(instants) };
  });

  // Reference = coarsest step; the first source wins a tie.
  // Reference = coarsest step; the first source wins a tie. A source with fewer than
  // MIN_REFERENCE_INSTANTS instants has no reliable step (two sparse points look like a coarse
  // rung) and is the reference only when no source has enough instants.
  const eligible = perSource.some(e => e.instants.length >= MIN_REFERENCE_INSTANTS)
    ? perSource.filter(e => e.instants.length >= MIN_REFERENCE_INSTANTS)
    : perSource;
  let reference: (typeof perSource)[number] | null = null;
  for (const entry of eligible) {
    if (entry.step !== null && (reference === null || entry.step > (reference.step ?? 0))) {
      reference = entry;
    }
  }
  const gridStepMs = reference?.step ?? null;

  const misaligned: MisalignedTimeSource[] = [];
  const aligned: typeof perSource = [];
  for (const entry of perSource) {
    if (reference && gridStepMs !== null && entry !== reference) {
      const anchor = reference.instants[0];
      const off = gridStepMs <= MAX_FILLED_GRID_STEP_MS
        ? entry.instants.some(t => (t - anchor) % gridStepMs !== 0)
        : entry.instants.some(t => {
          const d = distanceToNearest(reference!.instants, t);
          return d > 0 && d < gridStepMs;
        });
      if (off) {
        misaligned.push({
          sourceKey: entry.source.sourceKey,
          sourceLabel: entry.source.sourceLabel,
          stepMs: entry.step,
          gridStepMs
        });
        continue;
      }
    }
    aligned.push(entry);
  }

  const instantSet = new Set<number>();
  for (const entry of aligned) {
    for (const t of entry.instants) instantSet.add(t);
  }
  let instants = Array.from(instantSet).sort((a, b) => a - b);

  if (gridStepMs !== null && gridStepMs <= MAX_FILLED_GRID_STEP_MS && instants.length > 1) {
    instants = fillGrid(instants, gridStepMs);
  }

  const series: AlignedTimeSeries[] = [];
  for (const entry of aligned) {
    for (const s of entry.source.series) {
      series.push({
        name: s.name,
        sourceKey: entry.source.sourceKey,
        data: instants.map(t => s.points.get(t) ?? null),
        unit: s.unit
      });
    }
  }

  return { instants, gridStepMs, series, misaligned };
}

/**
 * Adds the missing multiples of `step` between consecutive instants whose distance is a whole
 * multiple of it. Distances that are not a multiple (a source-own instant inside a reference gap)
 * are left as they are.
 */
function fillGrid(instants: number[], step: number): number[] {
  const span = instants[instants.length - 1] - instants[0];
  if (span / step > MAX_FILLED_GRID_POINTS) return instants;
  const out: number[] = [instants[0]];
  for (let i = 1; i < instants.length; i++) {
    const prev = instants[i - 1];
    const d = instants[i] - prev;
    if (d > step && d % step === 0) {
      for (let t = prev + step; t < instants[i]; t += step) out.push(t);
    }
    out.push(instants[i]);
  }
  return out;
}
