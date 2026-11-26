/** Default CSV field separator; `;` makes the file open in columns in German Excel (AB#8123). */
export const DEFAULT_CSV_SEPARATOR = ';';
/** Default CSV file name (AB#8123). */
export const DEFAULT_CSV_EXPORT_FILE_NAME = 'Export.csv';

/** UTF-8 byte order mark: Excel reads the file as UTF-8 only with it. */
const UTF8_BOM = '\uFEFF';
const CRLF = '\r\n';

/** One CSV column: header text and how to read a cell from a row. */
export interface CsvColumn {
  title: string;
  /** Reads the cell value of a row. A string result is written as it is (e.g. a column formatter's output). */
  value: (row: unknown) => unknown;
  /**
   * Treat string values as dates (ISO 8601 strings of `date` / `iso8601` columns). Only for raw
   * values: a column whose cell text comes from a display formatter is never marked (AB#8836).
   */
  isDate?: boolean;
  /**
   * Display format of a numeric column as an Angular `DecimalPipe` digits info
   * (`{minIntegerDigits}.{minFractionDigits}-{maxFractionDigits}`, e.g. `1.2-2`): numbers are
   * written with these digits instead of the raw value (AB#8836). Unset or not parseable = raw value.
   */
  numberFormat?: string;
}

/** How values are written into the CSV (AB#8123). */
export interface CsvFormatOptions {
  /** Field separator. Default `;`. */
  separator: string;
  /**
   * Locale for numbers and dates (`de-AT`: `1234,5` and `31.12.2025 23:45:00`). `null` writes them
   * locale-neutral: numbers with `.` as decimal sign, dates as ISO 8601.
   */
  locale: string | null;
}

/**
 * Quotes one field as RFC 4180 requires: a field that contains the separator, a quote, a carriage
 * return or a line feed is enclosed in quotes, and every quote inside it is doubled.
 */
export function quoteCsvField(text: string, separator: string): string {
  const needsQuotes = text.includes('"') || text.includes('\r') || text.includes('\n') || (separator !== '' && text.includes(separator));
  return needsQuotes ? `"${text.split('"').join('""')}"` : text;
}

/** A text value that is just a (signed) number, e.g. a formatter's "-12,5" or "+3". */
const NUMERIC_TEXT = /^[+-]?\d[\d\s.,']*$/;
/** Characters that make a spreadsheet read a cell as a formula (OWASP "CSV injection"). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Neutralizes spreadsheet formulas in text (AB#8123): a text value that starts with `=`, `+`,
 * `-`, `@`, a tab or a carriage return gets a leading `'`, so Excel and LibreOffice show it as
 * text instead of running it. Plain numbers written as text (`-12,5`) stay unchanged.
 */
export function neutralizeCsvFormula(text: string): string {
  return FORMULA_START.test(text) && !NUMERIC_TEXT.test(text) ? `'${text}` : text;
}

/** Digits of an Angular `DecimalPipe` digits info, e.g. `1.2-2`. */
export interface CsvDigitsInfo {
  minIntegerDigits: number;
  minFractionDigits: number;
  maxFractionDigits: number;
}

/** Same grammar as Angular's `DecimalPipe` digits info (`{min int}.{min frac}-{max frac}`). */
const DIGITS_INFO = /^(\d+)?\.((\d+)(-(\d+))?)?$/;

/**
 * Reads an Angular `DecimalPipe` digits info (AB#8836). Missing parts take Angular's defaults
 * (1 integer digit, 0 to 3 fraction digits); `null` when the text is no valid digits info.
 */
export function parseCsvDigitsInfo(digitsInfo: string | null | undefined): CsvDigitsInfo | null {
  if (!digitsInfo) {
    return null;
  }
  const parts = DIGITS_INFO.exec(digitsInfo.trim());
  if (!parts) {
    return null;
  }
  const minIntegerDigits = parts[1] !== undefined ? +parts[1] : 1;
  const minFractionDigits = parts[3] !== undefined ? +parts[3] : 0;
  const maxFractionDigits = parts[5] !== undefined ? +parts[5] : Math.max(minFractionDigits, 3);
  if (minIntegerDigits < 1 || minIntegerDigits > 21 || maxFractionDigits > 100 || minFractionDigits > maxFractionDigits) {
    return null;
  }
  return {minIntegerDigits, minFractionDigits, maxFractionDigits};
}

/**
 * An ISO 8601 date-time as date columns deliver it (`2025-06-01T10:00:00Z`,
 * `2025-06-01T10:00:00.123+02:00`, `2025-06-01 10:00`). Anything else in a date column, e.g. text a
 * formatter already wrote (`01.11.2026`), is never handed to `new Date()` (AB#8836).
 */
export const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}(:?\d{2})?)?$/i;

/** The year, month and day name a real calendar day (`2025-02-30` does not; `new Date()` would roll it to March). */
export function isCalendarDay(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** `Intl.NumberFormat` `signDisplay: 'negative'`: a minus only for values below zero after rounding (ES2023). */
const SIGN_DISPLAY_NEGATIVE = 'negative' as unknown as Intl.NumberFormatOptions['signDisplay'];

/** The number format of a column display format, or `null` when the engine refuses the options (AB#8836). */
function createDisplayNumberFormat(locale: string, digits: CsvDigitsInfo): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat(locale, {
      useGrouping: false,
      minimumIntegerDigits: digits.minIntegerDigits,
      minimumFractionDigits: digits.minFractionDigits,
      maximumFractionDigits: digits.maxFractionDigits,
      // ES2023 value; the workspace compiles against the ES2022 lib, whose typings lack it.
      signDisplay: SIGN_DISPLAY_NEGATIVE
    });
  } catch {
    return null;
  }
}

/** Formats cell values for one export; the Intl formatters are created once. */
export class CsvValueFormatter {
  private readonly numberFormat: Intl.NumberFormat | null;
  /** Number formats per column display format (digits info), created on first use (AB#8836). */
  private readonly displayNumberFormats = new Map<string, Intl.NumberFormat | null>();
  private readonly dateFormat: Intl.DateTimeFormat | null;
  private readonly timeFormat: Intl.DateTimeFormat | null;

  constructor(private readonly locale: string | null) {
    if (locale) {
      this.numberFormat = new Intl.NumberFormat(locale, {useGrouping: false, maximumFractionDigits: 15});
      this.dateFormat = new Intl.DateTimeFormat(locale, {year: 'numeric', month: '2-digit', day: '2-digit'});
      this.timeFormat = new Intl.DateTimeFormat(locale, {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    } else {
      this.numberFormat = null;
      this.dateFormat = null;
      this.timeFormat = null;
    }
  }

  /**
   * @param isDate the column holds raw ISO 8601 date strings (see {@link CsvColumn.isDate}).
   * @param numberFormat display format of a numeric column (see {@link CsvColumn.numberFormat}).
   */
  public format(value: unknown, isDate = false, numberFormat?: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return this.formatDate(value);
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return '';
      }
      const display = numberFormat ? this.displayNumberFormat(numberFormat) : null;
      if (display) {
        return display.format(value);
      }
      return this.numberFormat ? this.numberFormat.format(value) : String(value);
    }
    if (typeof value === 'string') {
      if (isDate && value) {
        // A date-only value is a calendar day: never shift it through UTC or add a time.
        const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (dateOnly) {
          // No calendar day (e.g. 2025-02-31 would roll over to March): keep the text as it is.
          if (!this.dateFormat || !isCalendarDay(+dateOnly[1], +dateOnly[2], +dateOnly[3])) {
            return value;
          }
          return this.dateFormat.format(new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]));
        }
        // Only a real ISO 8601 date-time on a real calendar day is parsed; other text (e.g.
        // "01.11.2026", which `new Date()` would read as 11 January, or "2025-02-30T10:00:00Z",
        // which it would roll over to March) is written as it is (AB#8836).
        const isoParts = ISO_DATE_TIME.exec(value);
        const date = isoParts && isCalendarDay(+isoParts[1], +isoParts[2], +isoParts[3]) ? new Date(value) : null;
        if (date && !Number.isNaN(date.getTime())) {
          return this.formatDate(date);
        }
        // Text that is no date is still text. A date column holds no numbers, so any text that
        // starts like a formula (also "-1") gets the leading quote.
        return FORMULA_START.test(value) ? `'${value}` : value;
      }
      return neutralizeCsvFormula(value);
    }
    if (typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    return JSON.stringify(value);
  }

  /**
   * Number format of a column display format (AB#8836): the digits of the format, the decimal
   * sign of the locale (`.` without a locale), no grouping, and no minus for a value that rounds
   * to zero (`-1.87e-11` with `1.2-2` is `0,00`, not `-0,00`). `null` (raw value) when the
   * format is no digits info, or when the engine refuses the options (`signDisplay: 'negative'`
   * before Chrome 106 / Firefox 116 / Safari 15.4, more than 20 fraction digits before ES2023):
   * one column then falls back to the raw number instead of aborting the whole export.
   */
  private displayNumberFormat(numberFormat: string): Intl.NumberFormat | null {
    let format = this.displayNumberFormats.get(numberFormat);
    if (format === undefined) {
      const digits = parseCsvDigitsInfo(numberFormat);
      format = digits ? createDisplayNumberFormat(this.locale ?? 'en-US', digits) : null;
      this.displayNumberFormats.set(numberFormat, format);
    }
    return format;
  }

  private formatDate(date: Date): string {
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    if (!this.dateFormat || !this.timeFormat) {
      return date.toISOString();
    }
    return `${this.dateFormat.format(date)} ${this.timeFormat.format(date)}`;
  }
}

/**
 * Builds a CSV document (AB#8123): UTF-8 byte order mark, a header row with the column titles,
 * one line per row, RFC 4180 quoting and CRLF line ends.
 */
export function buildCsv(rows: readonly unknown[], columns: readonly CsvColumn[], options: CsvFormatOptions): string {
  const separator = options.separator || DEFAULT_CSV_SEPARATOR;
  const formatter = new CsvValueFormatter(options.locale);
  const lines: string[] = new Array(rows.length + 1);
  lines[0] = columns.map((column) => quoteCsvField(neutralizeCsvFormula(column.title), separator)).join(separator);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let line = '';
    for (let c = 0; c < columns.length; c++) {
      if (c > 0) {
        line += separator;
      }
      const column = columns[c];
      line += quoteCsvField(formatter.format(column.value(row), column.isDate, column.numberFormat), separator);
    }
    lines[i + 1] = line;
  }
  return UTF8_BOM + lines.join(CRLF) + CRLF;
}

/** Offers a CSV document to the user as a download. */
export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || DEFAULT_CSV_EXPORT_FILE_NAME;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
