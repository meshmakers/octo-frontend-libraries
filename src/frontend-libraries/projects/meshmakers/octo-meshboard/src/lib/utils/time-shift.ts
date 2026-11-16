import { TimeRange, TimeRangeUtils } from '@meshmakers/shared-ui';
import type { MeshBoardTimeShift, MeshBoardTimeZoneMode, Quarter, TimeRangeSelection } from '../models/meshboard.models';
import { getZonedDateParts } from './meshboard-datetime';

/**
 * Calendar time shift of a stream-data query (AB#9094). Pure helpers used by
 * `MeshBoardStateService.resolveStreamDataTimeArgs`; see {@link MeshBoardTimeShift} for the rules.
 */

/** The shift when `value` is a valid {@link MeshBoardTimeShift} (known unit, negative integer count), else `undefined`. */
export function normalizeTimeShift(value: unknown): MeshBoardTimeShift | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const { by, count } = value as { by?: unknown; count?: unknown };
  if ((by !== 'period' && by !== 'year') || typeof count !== 'number' || !Number.isInteger(count) || count >= 0) {
    return undefined;
  }
  return { by, count };
}

/** True for the selection types that move by whole calendar periods. */
export function isCalendarSelection(selection: TimeRangeSelection): boolean {
  return selection.type === 'year' || selection.type === 'quarter' || selection.type === 'month' || selection.type === 'day';
}

/**
 * The year, quarter, month or day selection moved by the shift, or `null` for a relative or
 * custom selection (those move on their resolved range, {@link shiftRange}). Hour limits of a
 * day selection are kept.
 */
export function shiftCalendarSelection(selection: TimeRangeSelection, shift: MeshBoardTimeShift): TimeRangeSelection | null {
  if (!isCalendarSelection(selection) || selection.year === undefined) {
    return null;
  }
  const year = selection.year;
  if (shift.by === 'year') {
    const shiftedYear = year + shift.count;
    if (selection.type === 'day' && selection.month !== undefined && selection.day !== undefined) {
      return { ...selection, year: shiftedYear, day: Math.min(selection.day, daysInMonth(shiftedYear, selection.month)) };
    }
    return { ...selection, year: shiftedYear };
  }
  switch (selection.type) {
    case 'year':
      return { ...selection, year: year + shift.count };
    case 'quarter': {
      if (selection.quarter === undefined) {
        return null;
      }
      const index = year * 4 + (selection.quarter - 1) + shift.count;
      return { ...selection, year: Math.floor(index / 4), quarter: ((index % 4) + 1) as Quarter };
    }
    case 'month': {
      if (selection.month === undefined) {
        return null;
      }
      const index = year * 12 + selection.month + shift.count;
      return { ...selection, year: Math.floor(index / 12), month: index % 12 };
    }
    default: {
      if (selection.month === undefined || selection.day === undefined) {
        return null;
      }
      const date = new Date(Date.UTC(year, selection.month, selection.day + shift.count));
      return { ...selection, year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
    }
  }
}

/**
 * A relative, custom or host-set range moved by the shift: `period` moves both bounds back by the
 * range's own length (Grafana's time shift), `year` moves both bounds by calendar years in `zone`.
 */
export function shiftRange(range: TimeRange, shift: MeshBoardTimeShift, zone: MeshBoardTimeZoneMode): TimeRange {
  if (shift.by === 'period') {
    const offset = (range.to.getTime() - range.from.getTime()) * shift.count;
    return { from: new Date(range.from.getTime() + offset), to: new Date(range.to.getTime() + offset) };
  }
  return { from: shiftInstantByYears(range.from, shift.count, zone), to: shiftInstantByYears(range.to, shift.count, zone) };
}

/** The instant with the same wall-clock time `years` calendar years away in `zone` (29 February → 28 February). */
function shiftInstantByYears(instant: Date, years: number, zone: MeshBoardTimeZoneMode): Date {
  const parts = getZonedDateParts(instant, zone);
  if (!parts) {
    return instant;
  }
  const year = parts.year + years;
  const day = Math.min(parts.day, daysInMonth(year, parts.month - 1));
  const hourStart = TimeRangeUtils.getDayRange(year, parts.month - 1, day, parts.hour, undefined, zone).from;
  return new Date(hourStart.getTime() + parts.minute * 60_000 + instant.getUTCSeconds() * 1000 + instant.getUTCMilliseconds());
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
