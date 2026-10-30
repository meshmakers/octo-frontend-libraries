import type { HostTimeRangeState } from '../../services/meshboard-state.service';

/**
 * The period a host page sets on an embedded MeshBoard (`mm-meshboard-view [timeRange]`, AB#7582):
 * two exact instants, half-open `[from, to)`. A string must be ISO 8601 with a zone designator
 * (`Z` or `±hh:mm`) — a string without one would be read in the browser's zone, which is exactly
 * what the host wants to avoid.
 */
export interface MeshBoardHostTimeRange {
  from: Date | string;
  to: Date | string;
}

/**
 * Who controls the board's period: `board` (default) shows the board's own time-range picker;
 * `host` hides the picker and its reset button because the host page owns the period.
 */
export type MeshBoardTimeFilterControl = 'board' | 'host';

/** Result of {@link parseHostTimeRange}: the state for the state service plus, when invalid, why. */
export type ParsedHostTimeRange =
  | { status: 'valid'; from: Date; to: Date }
  | { status: 'invalid'; reason: string };

/** ISO 8601 date-time with an explicit zone designator (`Z`, `+01:00`, `+0100`). */
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;

function toInstant(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value === 'string' && ISO_WITH_ZONE.test(value.trim())) {
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Parses the host's `timeRange` input. `undefined`/`null` = the host does not set a period.
 * Never snaps or converts: the instants are taken as given.
 */
export function parseHostTimeRange(value: MeshBoardHostTimeRange | null | undefined): ParsedHostTimeRange | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const from = toInstant(value.from);
  const to = toInstant(value.to);
  if (!from || !to) {
    return {
      status: 'invalid',
      reason: 'from and to must be Date objects or ISO 8601 strings with a zone designator (Z or ±hh:mm)'
    };
  }
  if (from.getTime() >= to.getTime()) {
    return { status: 'invalid', reason: 'from must be before to' };
  }
  return { status: 'valid', from, to };
}

/** Maps a parsed range to the state-service form (drops the reason). */
export function toHostTimeRangeState(parsed: ParsedHostTimeRange | undefined): HostTimeRangeState | null {
  if (!parsed) {
    return null;
  }
  return parsed.status === 'valid' ? { status: 'valid', from: parsed.from, to: parsed.to } : { status: 'invalid' };
}

/** True when two parsed ranges mean the same period (same instants, or both invalid for the same reason). */
export function sameHostTimeRange(a: ParsedHostTimeRange | undefined, b: ParsedHostTimeRange | undefined): boolean {
  if (!a || !b) {
    return a === b;
  }
  if (a.status === 'valid' && b.status === 'valid') {
    return a.from.getTime() === b.from.getTime() && a.to.getTime() === b.to.getTime();
  }
  return a.status === 'invalid' && b.status === 'invalid' && a.reason === b.reason;
}
