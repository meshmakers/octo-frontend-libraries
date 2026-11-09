import {formatDate} from '@angular/common';

/** A date-only value (`2025-01-31`): a calendar day, never shifted through UTC. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats the values of `date` columns for the grid and the PDF export in one line, locale-aware
 * (AB#8630) — instead of the raw `Date.toString()` ("Wed Jan 01 2025 01:00:00 GMT+0100 (…)").
 *
 * - `Date` objects, ISO 8601 strings and epoch milliseconds are dates.
 * - A date-only string (`2025-01-31`) is a calendar day and prints without a time.
 * - Without a column `format` a date prints as `31.12.2025 23:45:00` (`de-AT`), the same as the
 *   CSV export. A column `format` is an Angular date format (`'short'`, `'dd.MM.yyyy HH:mm'`), as
 *   for `iso8601` columns in the grid.
 * - A value that is no date prints as text; `null`/`undefined`/invalid dates print empty.
 *
 * The Intl formatters are created once per instance; create one per locale and reuse it.
 */
export class ListViewDateFormatter {
  private readonly dateFormat: Intl.DateTimeFormat;
  private readonly timeFormat: Intl.DateTimeFormat;

  constructor(private readonly locale: string) {
    this.dateFormat = createFormat(locale, {year: 'numeric', month: '2-digit', day: '2-digit'});
    this.timeFormat = createFormat(locale, {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  }

  public format(value: unknown, format?: string): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (typeof value === 'string') {
      const dateOnly = DATE_ONLY.exec(value);
      if (dateOnly) {
        const day = new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]);
        // No calendar day (e.g. 2025-02-31 would roll over to March): keep the text as it is.
        const isCalendarDay = day.getFullYear() === +dateOnly[1] && day.getMonth() === +dateOnly[2] - 1 && day.getDate() === +dateOnly[3];
        return isCalendarDay ? this.formatWith(day, format, true) : value;
      }
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : this.formatWith(date, format, false);
    }
    if (value instanceof Date || typeof value === 'number') {
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? '' : this.formatWith(date, format, false);
    }
    return String(value);
  }

  private formatWith(date: Date, format: string | undefined, dateOnly: boolean): string {
    if (format) {
      try {
        return formatDate(date, format, this.locale);
      } catch {
        // Unknown locale data or an invalid format: fall back to the default below.
      }
    }
    const day = this.dateFormat.format(date);
    return dateOnly ? day : `${day} ${this.timeFormat.format(date)}`;
  }
}

function createFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    // An invalid locale tag must not break the list.
    return new Intl.DateTimeFormat(undefined, options);
  }
}
