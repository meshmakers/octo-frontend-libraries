import type { HostTimeRangeState } from '../../services/meshboard-state.service';

/**
 * The period a host page sets on an embedded MeshBoard (`mm-meshboard-view [timeRange]`, AB#7582):
 * two exact instants, half-open `[from, to)`. A string must be an RFC 3339 date-time with an
 * explicit offset - see {@link parseHostTimeRange}.
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

/**
 * RFC 3339 date-time: `YYYY-MM-DDTHH:MM:SS`, optional 1-3 fraction digits, then `Z` or `±HH:MM`.
 * Uppercase `T`/`Z` only, seconds required, no compact offset (`+0100`): those forms parse
 * differently across browsers (Safari), and a string without an offset would be read in the
 * browser's own zone.
 */
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:(Z)|([+-])(\d{2}):(\d{2}))$/;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The instant of an RFC 3339 string, computed from its fields (never from `Date.parse`, so every
 * browser gets the same result), or `null` when the string is not RFC 3339 or names a date or time
 * that does not exist (`2026-02-30`, `24:00`, `23:60`, leap second `:60`, offset hour > 23).
 */
function parseRfc3339(value: string): Date | null {
  const m = RFC3339.exec(value);
  if (!m) {
    return null;
  }
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const millis = m[7] ? Number(m[7].padEnd(3, '0')) : 0;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  let offsetMinutes = 0;
  if (!m[8]) {
    const offsetHours = Number(m[10]);
    const offsetMins = Number(m[11]);
    if (offsetHours > 23 || offsetMins > 59) {
      return null;
    }
    offsetMinutes = (m[9] === '-' ? -1 : 1) * (offsetHours * 60 + offsetMins);
  }
  // setUTCFullYear (not Date.UTC, which maps years 0-99 to 1900-1999) for the wall-clock fields,
  // then the offset: local wall clock = UTC + offset.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millis);
  date.setTime(date.getTime() - offsetMinutes * 60_000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInstant(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  return typeof value === 'string' ? parseRfc3339(value) : null;
}

/**
 * Parses the host's `timeRange` input. `undefined`/`null` = the host sets no period.
 * Never snaps or converts: the instants are taken as given. `Date` objects are accepted as they
 * are; strings must be RFC 3339 with an offset, e.g. `2026-03-28T05:00:00Z` or
 * `2026-03-28T06:00:00+01:00` (see {@link RFC3339}).
 */
export function parseHostTimeRange(value: MeshBoardHostTimeRange | null | undefined): HostTimeRangeState | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const from = toInstant(value.from);
  const to = toInstant(value.to);
  if (!from || !to) {
    return {
      status: 'invalid',
      reason: 'from and to must be Date objects or RFC 3339 date-times with an offset '
        + '(YYYY-MM-DDTHH:MM:SS[.sss] followed by Z or ±HH:MM)'
    };
  }
  if (from.getTime() >= to.getTime()) {
    return { status: 'invalid', reason: 'from must be before to' };
  }
  return { status: 'valid', from, to };
}

/** True when two parsed ranges mean the same period (same instants, or both invalid for the same reason). */
export function sameHostTimeRange(a: HostTimeRangeState | undefined, b: HostTimeRangeState | undefined): boolean {
  if (!a || !b) {
    return a === b;
  }
  if (a.status === 'valid' && b.status === 'valid') {
    return a.from.getTime() === b.from.getTime() && a.to.getTime() === b.to.getTime();
  }
  return a.status === 'invalid' && b.status === 'invalid' && a.reason === b.reason;
}
