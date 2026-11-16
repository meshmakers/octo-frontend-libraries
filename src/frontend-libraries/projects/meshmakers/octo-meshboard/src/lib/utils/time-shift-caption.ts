import { TimeRange, TimeRangeUtils } from '@meshmakers/shared-ui';
import type { MeshBoardTimeShift, MeshBoardTimeZoneMode, TimeRangeSelection } from '../models/meshboard.models';
import { formatBoardDate } from './meshboard-datetime';

/** Caption under the title of a widget with an active time shift, and its tooltip. */
export interface TimeShiftCaption {
  caption: string;
  tooltip: string;
}

/** The name of a shift as the editor offers it: "Previous period", "Same period last year", "3 periods back", "2 years back". */
export function timeShiftName(shift: MeshBoardTimeShift): string {
  const back = -shift.count;
  if (shift.by === 'year') {
    return back === 1 ? 'Same period last year' : `${back} years back`;
  }
  return back === 1 ? 'Previous period' : `${back} periods back`;
}

/** The zone shown in the tooltip: the IANA zone of the browser for `local`, `UTC` for `utc`, else the board's IANA zone. */
export function timeShiftZoneName(zone: MeshBoardTimeZoneMode): string {
  if (zone === 'utc') {
    return 'UTC';
  }
  if (zone === 'local') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return zone;
}

/** `dd.MM.yyyy` of the first day and of the last day of the range (its end is exclusive); one date when both are equal. */
export function formatShiftedRange(range: TimeRange, zone: MeshBoardTimeZoneMode): string {
  const from = formatBoardDate(range.from, zone) ?? '';
  const lastInstant = new Date(Math.max(range.from.getTime(), range.to.getTime() - 1));
  const to = formatBoardDate(lastInstant, zone) ?? '';
  return from === to ? from : `${from} - ${to}`;
}

/**
 * The visible period of a shifted widget: "September 2026" for a month, "Q4 2025" for a quarter,
 * "2025" for a year, the date for a day and the first and last date of any other range.
 * `selection` is the shifted calendar selection, `null` for a relative, custom or host-set range.
 */
export function formatShiftedPeriod(selection: TimeRangeSelection | null, range: TimeRange, zone: MeshBoardTimeZoneMode): string {
  switch (selection?.type) {
    case 'year':
      return `${selection.year}`;
    case 'quarter':
      return `Q${selection.quarter} ${selection.year}`;
    case 'month': {
      const month = TimeRangeUtils.generateMonthOptions().find(option => option.value === selection.month);
      return month ? `${month.label} ${selection.year}` : formatShiftedRange(range, zone);
    }
    case 'day':
      return formatBoardDate(range.from, zone) ?? '';
    default:
      return formatShiftedRange(range, zone);
  }
}

/** Caption and tooltip of a shifted widget, e.g. "September 2026" / "Previous period: 01.09.2026 - 30.09.2026 (Europe/Vienna)". */
export function timeShiftCaption(
  shift: MeshBoardTimeShift,
  period: { range: TimeRange; selection: TimeRangeSelection | null },
  zone: MeshBoardTimeZoneMode
): TimeShiftCaption {
  return {
    caption: formatShiftedPeriod(period.selection, period.range, zone),
    tooltip: `${timeShiftName(shift)}: ${formatShiftedRange(period.range, zone)} (${timeShiftZoneName(zone)})`
  };
}
