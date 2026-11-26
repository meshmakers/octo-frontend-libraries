import {isCalendarDay, ISO_DATE_TIME, parseCsvDigitsInfo} from './list-view-csv';

/**
 * One column of the Excel export (AB#9857), in the order of the `<kendo-excelexport-column>`s.
 * Mirrors the CSV export's columns ({@link CsvColumn}, AB#8836): a column whose cell text comes
 * from a display `formatter` is written as that text; only raw values become dates or numbers.
 */
export interface ExcelColumn {
  /** Reads the cell value of a row: the formatter's text when {@link formatted}, else the raw field value. */
  value: (row: unknown) => unknown;
  /** The column has a display formatter: its text is written as it is shown in the list. */
  formatted?: boolean;
  /** Raw `date` / `iso8601` values: written as Excel dates. */
  isDate?: boolean;
  /** Angular date format of a date column (`column.format`, e.g. `dd.MM.yyyy HH:mm`); unset = locale default. */
  dateFormat?: string;
  /**
   * Without {@link dateFormat} the list shows the column's dates without a time (an `iso8601`
   * column goes through Angular's `DatePipe`, whose default is `mediumDate`): Excel then uses the
   * date-only format of the locale too.
   */
  dateOnlyByDefault?: boolean;
  /**
   * Display format of a numeric column as an Angular `DecimalPipe` digits info (`1.2-2`): the
   * number stays a number and gets the matching Excel number format. Unset or not parseable = raw.
   */
  numberFormat?: string;
}

/** The part of a Kendo workbook (`ExcelExportEvent.workbook`) the export rewrites. */
export interface ExcelWorkbookLike {
  sheets?: {
    rows?: {
      type?: string;
      cells?: ({value?: unknown; format?: string} | null | undefined)[];
    }[];
  }[];
}

/** A date read from a raw date column value; `dateOnly` for a calendar day (`2025-06-01`). */
export interface ExcelDateValue {
  date: Date;
  dateOnly: boolean;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Reads a raw date column value as a date (AB#9857): a `Date`, epoch milliseconds, a date-only
 * ISO string (a calendar day at local midnight, never shifted through UTC) or an ISO 8601
 * date-time on a real calendar day. `null` for empty values and for anything else (e.g. text a
 * formatter wrote, or `2025-02-30T10:00:00Z`, which `new Date()` would roll over to March).
 */
export function toExcelDate(value: unknown): ExcelDateValue | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : {date: value, dateOnly: false};
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(value) && !Number.isNaN(date.getTime()) ? {date, dateOnly: false} : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    return isCalendarDay(+dateOnly[1], +dateOnly[2], +dateOnly[3])
      ? {date: new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]), dateOnly: true}
      : null;
  }
  const iso = ISO_DATE_TIME.exec(value);
  if (!iso || !isCalendarDay(+iso[1], +iso[2], +iso[3])) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : {date, dateOnly: false};
}

/**
 * Excel number format of an Angular `DecimalPipe` digits info (AB#9857), as the list shows the
 * number: with grouping, at least `minIntegerDigits` integer digits, `minFractionDigits` fixed and
 * up to `maxFractionDigits` optional decimals. `1.2-2` is `#,##0.00`, `1.0-3` is `#,##0.###`,
 * `3.1-1` is `#,000.0`. Excel shows the grouping and decimal signs of the user's locale.
 * `null` when the text is no digits info.
 */
export function excelNumberFormat(digitsInfo: string | null | undefined): string | null {
  const digits = parseCsvDigitsInfo(digitsInfo);
  if (!digits) {
    return null;
  }
  const integer = '#'.repeat(Math.max(0, 4 - digits.minIntegerDigits)) + '0'.repeat(digits.minIntegerDigits);
  const grouped = `${integer.slice(0, -3)},${integer.slice(-3)}`;
  const fraction = '0'.repeat(digits.minFractionDigits) + '#'.repeat(digits.maxFractionDigits - digits.minFractionDigits);
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** Separators Excel shows as they are in a number format; other literal text is quoted. */
const PLAIN_LITERAL = /^[ .,:/\-()]*$/;

function excelLiteral(text: string): string {
  const normalized = text.replace(/[\u00a0\u202f]/g, ' ');
  return PLAIN_LITERAL.test(normalized) ? normalized : `"${normalized.split('"').join('')}"`;
}

/** Excel tokens of the Angular date format letters the export can translate. */
const ANGULAR_DATE_TOKENS: Record<string, string> = {
  y: 'yyyy', yy: 'yy', yyyy: 'yyyy',
  M: 'm', MM: 'mm', MMM: 'mmm', MMMM: 'mmmm',
  L: 'm', LL: 'mm', LLL: 'mmm', LLLL: 'mmmm',
  d: 'd', dd: 'dd',
  E: 'ddd', EE: 'ddd', EEE: 'ddd', EEEE: 'dddd',
  H: 'h', HH: 'hh', h: 'h', hh: 'hh',
  m: 'm', mm: 'mm', s: 's', ss: 'ss',
  a: 'AM/PM'
};

/**
 * Translates an Angular date format such as `dd.MM.yyyy HH:mm` into an Excel date format
 * (`dd.mm.yyyy hh:mm`) for the export (AB#9857). `null` for named formats (`short`), time zone
 * and other letters Excel has no token for, and for a 12-hour clock without `a` or a 24-hour
 * clock with it (Excel decides the clock by `AM/PM`), and for a minute or month Excel would read
 * as the other (see {@link minutesWhereExcelReadsThem}): the caller then uses the locale default.
 */
export function angularToExcelDateFormat(format: string | null | undefined): string | null {
  if (!format) {
    return null;
  }
  let result = '';
  let hours12 = false;
  let hours24 = false;
  let amPm = false;
  /** Angular letter runs of the date tokens in order, to check the context Excel reads `m` in. */
  const runs: string[] = [];
  let i = 0;
  while (i < format.length) {
    const char = format[i];
    if (char === "'") {
      // Quoted literal ('o''clock'); '' is a single quote, inside and outside a literal.
      if (format[i + 1] === "'") {
        result += excelLiteral("'");
        i += 2;
        continue;
      }
      let text = '';
      let end = i + 1;
      while (end < format.length) {
        if (format[end] === "'") {
          if (format[end + 1] !== "'") {
            break;
          }
          end++;
        }
        text += format[end];
        end++;
      }
      result += excelLiteral(text);
      i = end + 1;
      continue;
    }
    if (/[A-Za-z]/.test(char)) {
      let end = i;
      while (end < format.length && format[end] === char) {
        end++;
      }
      const run = format.slice(i, end);
      i = end;
      if (char === 'S') {
        result += '0'.repeat(Math.min(run.length, 3));
        continue;
      }
      const token = ANGULAR_DATE_TOKENS[run];
      if (!token) {
        return null;
      }
      hours12 ||= char === 'h';
      hours24 ||= char === 'H';
      amPm ||= char === 'a';
      runs.push(run);
      result += token;
      continue;
    }
    let end = i;
    while (end < format.length && format[end] !== "'" && !/[A-Za-z]/.test(format[end])) {
      end++;
    }
    result += excelLiteral(format.slice(i, end));
    i = end;
  }
  if ((hours12 && !amPm) || (hours24 && amPm) || !minutesWhereExcelReadsThem(runs)) {
    return null;
  }
  return result;
}

/**
 * Excel reads `m` / `mm` as minutes only right after an hour token or right before a seconds
 * token (separators in between do not count), and as the month anywhere else. `true` when every
 * Angular minute (`m`, `mm`) stands in such a place and no one- or two-letter month (`M`, `MM`,
 * `L`, `LL`) does: `mm` alone would show the month, `HH MM` the minutes.
 */
function minutesWhereExcelReadsThem(runs: readonly string[]): boolean {
  return runs.every((run, index) => {
    const minute = run === 'm' || run === 'mm';
    const shortMonth = /^[ML]{1,2}$/.test(run);
    if (!minute && !shortMonth) {
      return true;
    }
    const minuteContext = /^[hH]{1,2}$/.test(runs[index - 1] ?? '') || /^s{1,2}$/.test(runs[index + 1] ?? '');
    return minute ? minuteContext : !minuteContext;
  });
}

function createDateTimeFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    // An invalid locale tag must not break the export.
    return new Intl.DateTimeFormat(undefined, options);
  }
}

/** Excel tokens of the `Intl` date parts of the locale default (2-digit day, month, hour, minute, second). */
const INTL_PART_TOKENS: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {
  year: 'yyyy', month: 'mm', day: 'dd', hour: 'hh', minute: 'mm', second: 'ss', dayPeriod: 'AM/PM'
};

function intlToExcelFormat(format: Intl.DateTimeFormat): string {
  return format.formatToParts(new Date(2026, 10, 26, 10, 5, 7))
    .map((part) => part.type === 'literal' ? excelLiteral(part.value) : (INTL_PART_TOKENS[part.type] ?? ''))
    .join('');
}

/** Angular's named date formats that show no time: Excel shows the locale's date-only format for them. */
const DATE_ONLY_NAMED_FORMATS = new Set(['shortDate', 'mediumDate', 'longDate', 'fullDate']);

/**
 * Excel date formats for one export (AB#9857): the column's Angular date format when it can be
 * translated, otherwise the locale default the list and the CSV export use (`dd.mm.yyyy hh:mm:ss`
 * for `de-AT`; a calendar day, a named date-only format such as `mediumDate`, or a column the list
 * shows without a time, without the time).
 */
export class ExcelDateFormats {
  private readonly dateFormat: string;
  private readonly dateTimeFormat: string;
  private readonly translated = new Map<string, string | null>();

  constructor(locale: string) {
    this.dateFormat = intlToExcelFormat(createDateTimeFormat(locale, {year: 'numeric', month: '2-digit', day: '2-digit'}));
    const time = intlToExcelFormat(createDateTimeFormat(locale, {hour: '2-digit', minute: '2-digit', second: '2-digit'}));
    this.dateTimeFormat = `${this.dateFormat} ${time}`;
  }

  public get(angularFormat: string | undefined, dateOnly: boolean): string {
    if (angularFormat) {
      let excel = this.translated.get(angularFormat);
      if (excel === undefined) {
        excel = angularToExcelDateFormat(angularFormat);
        this.translated.set(angularFormat, excel);
      }
      if (excel) {
        return excel;
      }
      if (DATE_ONLY_NAMED_FORMATS.has(angularFormat)) {
        return this.dateFormat;
      }
    }
    return dateOnly ? this.dateFormat : this.dateTimeFormat;
  }
}

/**
 * Writes the list's display values into the workbook Kendo built for the Excel export (AB#9857),
 * from the same rows `fetchData` returned, one data row per row in the same order:
 *
 * - a column with a `formatter` gets the formatter's text, as the list shows it;
 * - a `numeric` column with a display `format` keeps the number and gets the matching Excel number
 *   format (still calculable);
 * - raw `date` / `iso8601` values become Excel dates (real date cells) with a date format; text that
 *   is no date stays text;
 * - every other column keeps what Kendo wrote (the raw field value).
 *
 * Returns `false` and changes nothing when the workbook's data rows do not match the rows (e.g.
 * a grouped export), so a mismatch can never shift values between rows.
 */
export function applyExcelDisplayValues(
  workbook: ExcelWorkbookLike | null | undefined,
  rows: readonly unknown[],
  columns: readonly ExcelColumn[],
  locale: string
): boolean {
  const sheetRows = workbook?.sheets?.[0]?.rows;
  if (!sheetRows) {
    return false;
  }
  const dataRows = sheetRows.filter((row) => row.type === 'data');
  if (dataRows.length !== rows.length) {
    return false;
  }
  const dateFormats = new ExcelDateFormats(locale);
  const numberFormats = columns.map((column) => column.formatted ? null : excelNumberFormat(column.numberFormat));
  for (let r = 0; r < rows.length; r++) {
    const cells = dataRows[r].cells;
    if (!cells) {
      continue;
    }
    for (let c = 0; c < columns.length && c < cells.length; c++) {
      const column = columns[c];
      const cell = cells[c];
      if (!cell) {
        continue;
      }
      if (column.formatted) {
        const text = column.value(rows[r]);
        cell.value = text === null || text === undefined ? null : String(text);
        continue;
      }
      if (column.isDate) {
        const value = column.value(rows[r]);
        const date = toExcelDate(value);
        if (date) {
          cell.value = date.date;
          cell.format = dateFormats.get(column.dateFormat, date.dateOnly || (!column.dateFormat && !!column.dateOnlyByDefault));
        } else if (value === null || value === undefined || value === '') {
          cell.value = null;
        } else if (typeof value === 'string') {
          // Text that is no ISO date (e.g. "01.11.2026") stays text, never a guessed date.
          cell.value = value;
        }
        continue;
      }
      const numberFormat = numberFormats[c];
      if (numberFormat) {
        const value = column.value(rows[r]);
        if (typeof value === 'number' && Number.isFinite(value)) {
          cell.value = value;
          cell.format = numberFormat;
        }
      }
    }
  }
  return true;
}
