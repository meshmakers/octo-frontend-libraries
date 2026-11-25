import { TimeRange, TimeRangeUtils } from '@meshmakers/shared-ui';
import type { MeshBoardTimeShift, MeshBoardTimeZoneMode, TimeRangeSelection } from '../models/meshboard.models';
import { formatBoardDate, formatInstant, getZonedDateParts } from './meshboard-datetime';
import { DEFAULT_MESHBOARD_MESSAGES, MeshBoardMessages } from './meshboard-messages';

/** Caption under the title of a widget with an active time shift, and its tooltip. */
export interface TimeShiftCaption {
  caption: string;
  tooltip: string;
}

/**
 * Language of a caption (AB#9743): the shift names of {@link MeshBoardMessages} and the host locale of
 * `MESHBOARD_LANGUAGE` for month names and dates. Without them the English names and `de-AT` dates apply.
 */
export interface TimeShiftCaptionLanguage {
  messages?: Pick<MeshBoardMessages, 'timeShiftPreviousPeriod' | 'timeShiftSamePeriodLastYear' | 'timeShiftPeriodsBack' | 'timeShiftYearsBack'>;
  locale?: string | null;
}

/** The name of a shift as the editor offers it: "Previous period", "Same period last year", "3 periods back", "2 years back". */
export function timeShiftName(shift: MeshBoardTimeShift, messages?: TimeShiftCaptionLanguage['messages']): string {
  const back = -shift.count;
  if (shift.by === 'year') {
    return back === 1
      ? messages?.timeShiftSamePeriodLastYear || DEFAULT_MESHBOARD_MESSAGES.timeShiftSamePeriodLastYear
      : (messages?.timeShiftYearsBack || DEFAULT_MESHBOARD_MESSAGES.timeShiftYearsBack).replace('{count}', String(back));
  }
  return back === 1
    ? messages?.timeShiftPreviousPeriod || DEFAULT_MESHBOARD_MESSAGES.timeShiftPreviousPeriod
    : (messages?.timeShiftPeriodsBack || DEFAULT_MESHBOARD_MESSAGES.timeShiftPeriodsBack).replace('{count}', String(back));
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

/** `dd.MM.yyyy` (de-AT) of the first day and of the last day of the range (its end is exclusive); one date when both are equal. */
export function formatShiftedRange(range: TimeRange, zone: MeshBoardTimeZoneMode, locale?: string | null): string {
  const from = formatBoardDate(range.from, zone, locale) ?? '';
  const lastInstant = new Date(Math.max(range.from.getTime(), range.to.getTime() - 1));
  const to = formatBoardDate(lastInstant, zone, locale) ?? '';
  return from === to ? from : `${from} - ${to}`;
}

/**
 * The exact range for the tooltip: like {@link formatShiftedRange} while both bounds are local midnights,
 * otherwise each bound not at local midnight carries its time (`HH:mm`), e.g. `15.11.2026 09:17 - 16.11.2026 09:17`;
 * an end at local midnight stays the last day of the range.
 */
export function formatExactShiftedRange(range: TimeRange, zone: MeshBoardTimeZoneMode, locale?: string | null): string {
  const fromAtMidnight = isLocalMidnight(range.from, zone);
  const toAtMidnight = isLocalMidnight(range.to, zone);
  if (fromAtMidnight && toAtMidnight) {
    return formatShiftedRange(range, zone, locale);
  }
  const from = fromAtMidnight ? formatBoardDate(range.from, zone, locale) ?? '' : formatBoardDateMinutes(range.from, zone, locale);
  const to = toAtMidnight
    ? formatBoardDate(new Date(Math.max(range.from.getTime(), range.to.getTime() - 1)), zone, locale) ?? ''
    : formatBoardDateMinutes(range.to, zone, locale);
  return `${from} - ${to}`;
}

function isLocalMidnight(instant: Date, zone: MeshBoardTimeZoneMode): boolean {
  const parts = getZonedDateParts(instant, zone);
  return !!parts && parts.hour === 0 && parts.minute === 0 && instant.getUTCSeconds() === 0 && instant.getUTCMilliseconds() === 0;
}

function formatBoardDateMinutes(instant: Date, zone: MeshBoardTimeZoneMode, locale?: string | null): string {
  const date = formatBoardDate(instant, zone, locale) ?? '';
  const time = formatInstant(instant, zone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, locale) ?? '';
  return `${date} ${time}`;
}

function monthName(month: number, locale?: string | null): string | undefined {
  if (locale) {
    try {
      return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month, 1)));
    } catch {
      // an unknown locale falls back to the English names
    }
  }
  return TimeRangeUtils.generateMonthOptions().find(option => option.value === month)?.label;
}

/**
 * The visible period of a shifted widget: "September 2026" for a month (month name in `locale`, English without one),
 * "Q4 2025" for a quarter, "2025" for a year, the date for a day and the first and last date of any other range.
 * `selection` is the shifted calendar selection, `null` for a relative, custom or host-set range.
 */
export function formatShiftedPeriod(
  selection: TimeRangeSelection | null,
  range: TimeRange,
  zone: MeshBoardTimeZoneMode,
  locale?: string | null
): string {
  switch (selection?.type) {
    case 'year':
      return `${selection.year}`;
    case 'quarter':
      return `Q${selection.quarter} ${selection.year}`;
    case 'month': {
      const month = selection.month === undefined ? undefined : monthName(selection.month, locale);
      return month ? `${month} ${selection.year}` : formatShiftedRange(range, zone, locale);
    }
    case 'day':
      return formatBoardDate(range.from, zone, locale) ?? '';
    default:
      return formatShiftedRange(range, zone, locale);
  }
}

/**
 * Caption and tooltip of a shifted widget, e.g. "September 2026" / "Previous period: 01.09.2026 - 30.09.2026 (Europe/Vienna)".
 * The caption shows dates only; the tooltip shows the exact range ({@link formatExactShiftedRange}).
 */
export function timeShiftCaption(
  shift: MeshBoardTimeShift,
  period: { range: TimeRange; selection: TimeRangeSelection | null },
  zone: MeshBoardTimeZoneMode,
  language?: TimeShiftCaptionLanguage
): TimeShiftCaption {
  const locale = language?.locale;
  return {
    caption: formatShiftedPeriod(period.selection, period.range, zone, locale),
    tooltip: `${timeShiftName(shift, language?.messages)}: ${formatExactShiftedRange(period.range, zone, locale)} (${timeShiftZoneName(zone)})`
  };
}
