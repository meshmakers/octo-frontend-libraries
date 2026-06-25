/**
 * A half-open UTC time window `[fromUtc, toUtc)` used to scope an archive-data export to a slice
 * of the archive (AB#4230, concept §3.1 `metadata.window`). Both bounds are ISO-8601 UTC strings.
 *
 * `fromUtc` is inclusive, `toUtc` is exclusive. When the whole archive is exported no window is
 * passed at all (the caller sends `undefined`), which the bot job records as `window: null` in the
 * export metadata.
 */
export interface TimeWindowDto {
  /** Inclusive lower bound, ISO-8601 UTC (e.g. `2026-06-01T00:00:00Z`). */
  fromUtc: string;
  /** Exclusive upper bound, ISO-8601 UTC (e.g. `2026-07-01T00:00:00Z`). */
  toUtc: string;
}
