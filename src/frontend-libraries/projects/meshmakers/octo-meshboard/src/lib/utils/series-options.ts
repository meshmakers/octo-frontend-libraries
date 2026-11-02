import { MeshBoardTimeZoneMode, SeriesMissingValues } from '../models/meshboard.models';
import { getZonedDateParts } from './meshboard-datetime';
import { AlignedTimeGrid, TimeGridSourceInput } from './time-grid-alignment';

/**
 * Per-series options of the line and bar chart (AB#8046): filling of missing values and the fixed
 * bucket grid of the line chart. Pure functions, shared by both widgets.
 */

const MINUTE_MS = 60_000;

/** Upper bound of buckets of a fixed grid (guards a 1-minute grid over a long window). */
export const MAX_FIXED_GRID_BUCKETS = 20000;

/**
 * Fills the `null` entries of a series (AB#8046).
 *
 * - `gap` (or no mode): unchanged.
 * - `zero`: `null` → 0.
 * - `carryForward`: `null` → the last value before it; before the first value the `seed` (the
 *   last value before the window), else it stays `null`.
 *
 * Entries whose instant lies after `now` stay `null` (no values are invented for the future), when
 * `instants` and `now` are given. Returns a new array.
 */
export function fillMissingValues(
  data: readonly (number | null)[],
  mode: SeriesMissingValues | undefined,
  options?: { instants?: readonly (number | null)[]; now?: number; seed?: number | null }
): (number | null)[] {
  if (!mode || mode === 'gap') return [...data];
  const instants = options?.instants;
  const now = options?.now;
  const inFuture = (i: number): boolean => {
    if (now === undefined || !instants) return false;
    const t = instants[i];
    return t !== null && t !== undefined && t > now;
  };
  let last: number | null = options?.seed ?? null;
  return data.map((value, i) => {
    if (value !== null && value !== undefined) {
      last = value;
      return value;
    }
    if (inFuture(i)) return null;
    if (mode === 'zero') return 0;
    return last;
  });
}

/** A line chart window snapped to whole buckets: `count` buckets of `bucketMs` from `from`. */
export interface FixedBucketWindow {
  from: Date;
  to: Date;
  bucketMs: number;
  count: number;
}

/** Start of the bucket that contains `t`, on the wall-clock grid of the board's time zone. */
function bucketFloor(t: number, bucketMinutes: number, mode: MeshBoardTimeZoneMode): number {
  const parts = getZonedDateParts(new Date(t), mode);
  // Zone offsets are whole minutes, so the sub-minute part is the same in every zone.
  const subMinute = ((t % MINUTE_MS) + MINUTE_MS) % MINUTE_MS;
  const minuteInHour = parts ? parts.minute : new Date(t).getUTCMinutes();
  return t - subMinute - (minuteInHour % bucketMinutes) * MINUTE_MS;
}

/**
 * Snaps a window to whole buckets of `bucketMinutes` in the board's time zone (AB#8046): `from`
 * down, `to` up to the next bucket start. The sizes divide one hour, so every bucket start is a
 * wall-clock multiple of the size on both sides of a DST change; a DST day simply has more or fewer
 * buckets (2026-10-25 in Europe/Vienna: 100 quarter hours). `null` for an invalid size or window,
 * or when the window would hold more than {@link MAX_FIXED_GRID_BUCKETS} buckets.
 */
export function snapWindowToBuckets(
  from: Date,
  to: Date,
  bucketMinutes: number,
  mode: MeshBoardTimeZoneMode
): FixedBucketWindow | null {
  if (!Number.isFinite(bucketMinutes) || bucketMinutes <= 0 || 60 % bucketMinutes !== 0) return null;
  const bucketMs = bucketMinutes * MINUTE_MS;
  const start = bucketFloor(from.getTime(), bucketMinutes, mode);
  let end = bucketFloor(to.getTime(), bucketMinutes, mode);
  if (end < to.getTime()) end += bucketMs;
  const count = Math.round((end - start) / bucketMs);
  if (count <= 0 || count > MAX_FIXED_GRID_BUCKETS) return null;
  return { from: new Date(start), to: new Date(end), bucketMs, count };
}

/** Bucket start instants of a fixed window. */
export function fixedGridInstants(window: FixedBucketWindow): number[] {
  const out: number[] = [];
  for (let i = 0; i < window.count; i++) out.push(window.from.getTime() + i * window.bucketMs);
  return out;
}

/**
 * Aligns sources on a fixed bucket grid (AB#8046), instead of deriving the grid from the data
 * ({@link alignOnTimeGrid}). Every point goes into the bucket that contains its instant; several
 * points in one bucket (a source delivered finer buckets) are averaged; points outside the window
 * are dropped. No source is misaligned: a source the backend delivered coarser than the grid
 * (a coarse rollup, or a raw archive with fewer distinct timestamps than buckets) fills only the
 * buckets its points start in — the others stay gaps, or are filled by the series' `missingValues`.
 */
export function alignOnFixedGrid(sources: readonly TimeGridSourceInput[], window: FixedBucketWindow): AlignedTimeGrid {
  const instants = fixedGridInstants(window);
  const start = window.from.getTime();
  const series = [];
  for (const source of sources) {
    for (const s of source.series) {
      const sums = new Array<number>(window.count).fill(0);
      const counts = new Array<number>(window.count).fill(0);
      for (const [t, value] of s.points) {
        if (value === null || value === undefined || !Number.isFinite(t)) continue;
        const index = Math.floor((t - start) / window.bucketMs);
        if (index < 0 || index >= window.count) continue;
        sums[index] += value;
        counts[index] += 1;
      }
      series.push({
        name: s.name,
        sourceKey: source.sourceKey,
        unit: s.unit,
        data: counts.map((n, i) => (n > 0 ? sums[i] / n : null))
      });
    }
  }
  return { instants, gridStepMs: window.bucketMs, series, misaligned: [] };
}

/** The last non-null value of a series by instant (the look-back seed of `carryForward`), `null` when there is none. */
export function lastValue(points: ReadonlyMap<number, number | null>): number | null {
  let bestT = -Infinity;
  let best: number | null = null;
  for (const [t, v] of points) {
    if (v !== null && v !== undefined && t > bestT) {
      bestT = t;
      best = v;
    }
  }
  return best;
}
