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
 * range's own length (Grafana's time shift), `year` moves both bounds by calendar years in `zone`; a
 * 29 February start lands on 28 February, a 29 February (exclusive) end on 1 March, unless the start lies
 * on that 29 February too (then both land on 28 February).
 */
export function shiftRange(range: TimeRange, shift: MeshBoardTimeShift, zone: MeshBoardTimeZoneMode): TimeRange {
  if (shift.by === 'period') {
    const offset = (range.to.getTime() - range.from.getTime()) * shift.count;
    return { from: new Date(range.from.getTime() + offset), to: new Date(range.to.getTime() + offset) };
  }
  const startOnMissingDay = landsOnMissingDay(range.from, shift.count, zone);
  return {
    from: shiftInstantByYears(range.from, shift.count, zone, false),
    to: shiftInstantByYears(range.to, shift.count, zone, !startOnMissingDay)
  };
}

/**
 * A range of whole local days (a custom selection without time) moved back by its own number of days: the
 * bounds stay local midnights in `zone`, also when the target window has a DST change. A `year` shift is left
 * to {@link shiftRange}, which keeps the wall-clock time anyway.
 */
export function shiftWholeDayRange(range: TimeRange, shift: MeshBoardTimeShift, zone: MeshBoardTimeZoneMode): TimeRange {
  if (shift.by === 'year') {
    return shiftRange(range, shift, zone);
  }
  const days = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);
  return { from: shiftLocalMidnight(range.from, days * shift.count, zone), to: shiftLocalMidnight(range.to, days * shift.count, zone) };
}

function shiftLocalMidnight(instant: Date, days: number, zone: MeshBoardTimeZoneMode): Date {
  const parts = getZonedDateParts(instant, zone);
  if (!parts) {
    return instant;
  }
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return TimeRangeUtils.getDayRange(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), undefined, undefined, zone).from;
}

/** True when the instant's day (29 February) does not exist `years` calendar years away in `zone`. */
function landsOnMissingDay(instant: Date, years: number, zone: MeshBoardTimeZoneMode): boolean {
  const parts = getZonedDateParts(instant, zone);
  return !!parts && parts.day > daysInMonth(parts.year + years, parts.month - 1);
}

/**
 * The instant with the same wall-clock time `years` calendar years away in `zone`. A day that does not exist
 * there (29 February) becomes the last day of its month, or the day after it when `forward` (an end bound).
 */
function shiftInstantByYears(instant: Date, years: number, zone: MeshBoardTimeZoneMode, forward: boolean): Date {
  const parts = getZonedDateParts(instant, zone);
  if (!parts) {
    return instant;
  }
  const lastDay = daysInMonth(parts.year + years, parts.month - 1);
  const day = parts.day > lastDay ? (forward ? lastDay + 1 : lastDay) : parts.day;
  const date = new Date(Date.UTC(parts.year + years, parts.month - 1, day));
  const hourStart = TimeRangeUtils.getDayRange(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), parts.hour, undefined, zone).from;
  return new Date(hourStart.getTime() + parts.minute * 60_000 + instant.getUTCSeconds() * 1000 + instant.getUTCMilliseconds());
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
