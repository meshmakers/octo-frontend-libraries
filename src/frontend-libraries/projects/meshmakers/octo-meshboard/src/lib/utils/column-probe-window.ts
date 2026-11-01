/**
 * Time window the widget config dialogs use to list the columns of a persisted
 * stream-data query (AB#7921, AB#7975).
 *
 * A query with an `Integral` (or TimeWeightedAverage / StateDuration) column over a
 * raw archive only runs with from/to, so {@link QueryExecutorService.fetchStreamDataColumns}
 * retries with this window: the board's time window when the board has a time filter,
 * otherwise the last 24 hours. The window only serves to surface the column metadata;
 * the widget itself always runs with the board window.
 */
export const COLUMN_PROBE_FALLBACK_MS = 24 * 60 * 60 * 1000;

export function columnProbeWindow(
  boardWindow: { from: Date; to: Date } | undefined | null,
  now: Date = new Date()
): { from: Date; to: Date } {
  if (boardWindow) {
    return boardWindow;
  }
  return { from: new Date(now.getTime() - COLUMN_PROBE_FALLBACK_MS), to: now };
}
