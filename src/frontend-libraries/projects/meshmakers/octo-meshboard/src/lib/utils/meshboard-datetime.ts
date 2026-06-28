import { MeshBoardTimeZoneMode } from '../models/meshboard.models';

/**
 * Centralized, timezone-aware datetime formatting for MeshBoard widgets.
 *
 * Every widget that renders a timestamp routes through here so the board's
 * {@link MeshBoardTimeZoneMode} governs display consistently — matching the
 * basis the time-filter boundaries are computed on. In `'local'` mode values
 * render in the browser's timezone; in `'utc'` mode they render in UTC.
 */

/** Locale used for all MeshBoard datetime rendering (matches the app's LOCALE_ID family). */
const MESHBOARD_LOCALE = 'de-AT';

/**
 * Strict ISO-8601 *date-time* matcher (date + time, optional fractional seconds
 * and `Z`/offset). Plain dates (`2026-01-01`) are intentionally excluded so they
 * are not reinterpreted across a timezone boundary.
 */
const ISO_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/** True when the value is a string in strict ISO-8601 date-time form. */
export function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_TIME_RE.test(value);
}

/** Parses a value into a valid `Date`, or returns `null` when it is not a usable instant. */
export function toInstant(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** Maps the board mode to the `Intl` `timeZone` option (`undefined` = browser local). */
function timeZoneOption(mode: MeshBoardTimeZoneMode): string | undefined {
  return mode === 'utc' ? 'UTC' : undefined;
}

/**
 * Formats an instant honoring the board's timezone mode, with caller-supplied
 * `Intl.DateTimeFormatOptions`. The `timeZone` option is injected from `mode`
 * and overrides any passed in. Returns `null` when the value is not a valid
 * instant, so callers can fall back to their own rendering.
 */
export function formatInstant(
  value: unknown,
  mode: MeshBoardTimeZoneMode,
  options: Intl.DateTimeFormatOptions
): string | null {
  const date = toInstant(value);
  if (!date) {
    return null;
  }
  return date.toLocaleString(MESHBOARD_LOCALE, { ...options, timeZone: timeZoneOption(mode) });
}

/** Full date with `dd.MM.yyyy` in the board's timezone, or `null`. */
export function formatBoardDate(value: unknown, mode: MeshBoardTimeZoneMode): string | null {
  return formatInstant(value, mode, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Full date + time with seconds (`dd.MM.yyyy HH:mm:ss`) in the board's timezone.
 * This is the table-widget cell format. Returns `null` for non-instants.
 *
 * Date and time parts are formatted separately and joined with a single space so
 * the output is exactly `dd.MM.yyyy HH:mm:ss` — the locale's combined format
 * would otherwise insert a comma (`dd.MM.yyyy, HH:mm:ss`).
 */
export function formatBoardDateTime(value: unknown, mode: MeshBoardTimeZoneMode): string | null {
  const datePart = formatInstant(value, mode, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timePart = formatInstant(value, mode, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (datePart === null || timePart === null) {
    return null;
  }
  return `${datePart} ${timePart}`;
}

/**
 * Table-cell formatter: ISO-8601 date-time strings are rendered in the board's
 * timezone (`dd.MM.yyyy HH:mm:ss`); every other value passes through unchanged.
 * Safe to attach to all columns — non-datetime cells are returned via `String`.
 */
export function formatTableCellValue(value: unknown, mode: MeshBoardTimeZoneMode): string {
  if (isIsoDateTime(value)) {
    return formatBoardDateTime(value, mode) ?? String(value);
  }
  return value === null || value === undefined ? '' : String(value);
}
