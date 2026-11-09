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
  /** Treat string values as dates (ISO 8601 strings of `date` / `iso8601` columns). */
  isDate?: boolean;
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

/** Formats cell values for one export; the Intl formatters are created once. */
export class CsvValueFormatter {
  private readonly numberFormat: Intl.NumberFormat | null;
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

  public format(value: unknown, isDate = false): string {
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
      return this.numberFormat ? this.numberFormat.format(value) : String(value);
    }
    if (typeof value === 'string') {
      if (isDate && value) {
        // A date-only value is a calendar day: never shift it through UTC or add a time.
        const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (dateOnly) {
          const day = new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]);
          // No calendar day (e.g. 2025-02-31 would roll over to March): keep the text as it is.
          const isCalendarDay = day.getFullYear() === +dateOnly[1] && day.getMonth() === +dateOnly[2] - 1 && day.getDate() === +dateOnly[3];
          return this.dateFormat && isCalendarDay ? this.dateFormat.format(day) : value;
        }
        const date = new Date(value);
        // Text that is no date is still text: neutralize it like any other string.
        return Number.isNaN(date.getTime()) ? neutralizeCsvFormula(value) : this.formatDate(date);
      }
      return neutralizeCsvFormula(value);
    }
    if (typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
    return JSON.stringify(value);
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
      line += quoteCsvField(formatter.format(column.value(row), column.isDate), separator);
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
