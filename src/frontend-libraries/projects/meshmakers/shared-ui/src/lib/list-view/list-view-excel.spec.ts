import {
  angularToExcelDateFormat,
  applyExcelDisplayValues,
  ExcelColumn,
  ExcelDateFormats,
  ExcelWorkbookLike,
  excelNumberFormat,
  toExcelDate
} from './list-view-excel';

/** A workbook as Kendo builds it for the list: one header row, one data row per row, raw field values. */
function kendoWorkbook(rows: Record<string, unknown>[], fields: string[]): ExcelWorkbookLike {
  return {
    sheets: [{
      rows: [
        {type: 'header', cells: fields.map((field) => ({value: field}))},
        ...rows.map((row) => ({type: 'data', cells: fields.map((field) => ({value: row[field]}))}))
      ]
    }]
  };
}

const field = (name: string) => (row: unknown) => (row as Record<string, unknown>)[name];

describe('excelNumberFormat (AB#9857)', () => {
  it('maps Angular digits info to an Excel number format with grouping', () => {
    expect(excelNumberFormat('1.2-2')).toBe('#,##0.00');
    expect(excelNumberFormat('1.0-0')).toBe('#,##0');
    expect(excelNumberFormat('1.0-3')).toBe('#,##0.###');
    expect(excelNumberFormat('1.1-4')).toBe('#,##0.0###');
    expect(excelNumberFormat('3.1-1')).toBe('#,000.0');
    expect(excelNumberFormat('5.0-0')).toBe('00,000');
    expect(excelNumberFormat('.2')).toBe('#,##0.00#');
  });

  it('returns null for no or invalid digits info', () => {
    expect(excelNumberFormat(undefined)).toBeNull();
    expect(excelNumberFormat('')).toBeNull();
    expect(excelNumberFormat('0.2-2')).toBeNull();
    expect(excelNumberFormat('1.3-2')).toBeNull();
    expect(excelNumberFormat('currency')).toBeNull();
  });
});

describe('toExcelDate (AB#9857)', () => {
  it('reads ISO 8601 date-times as dates', () => {
    const value = toExcelDate('2026-11-12T10:00:00Z');
    expect(value?.dateOnly).toBe(false);
    expect(value?.date.toISOString()).toBe('2026-11-12T10:00:00.000Z');
  });

  it('reads a date-only string as the calendar day at local midnight', () => {
    const value = toExcelDate('2026-11-01');
    expect(value?.dateOnly).toBe(true);
    expect([value?.date.getFullYear(), value?.date.getMonth(), value?.date.getDate(), value?.date.getHours()]).toEqual([2026, 10, 1, 0]);
  });

  it('reads Date objects and epoch milliseconds', () => {
    const date = new Date(Date.UTC(2026, 0, 31, 23, 45));
    expect(toExcelDate(date)?.date).toBe(date);
    expect(toExcelDate(date.getTime())?.date.getTime()).toBe(date.getTime());
  });

  it('keeps formatted text, impossible days and empty values out', () => {
    expect(toExcelDate('01.11.2026')).toBeNull();
    expect(toExcelDate('2025-02-30T10:00:00Z')).toBeNull();
    expect(toExcelDate('2025-02-31')).toBeNull();
    expect(toExcelDate('')).toBeNull();
    expect(toExcelDate(null)).toBeNull();
    expect(toExcelDate(new Date('x'))).toBeNull();
    expect(toExcelDate(Number.NaN)).toBeNull();
  });
});

describe('angularToExcelDateFormat (AB#9857)', () => {
  it('translates custom Angular date formats', () => {
    expect(angularToExcelDateFormat('dd.MM.yyyy')).toBe('dd.mm.yyyy');
    expect(angularToExcelDateFormat('dd.MM.yyyy HH:mm:ss')).toBe('dd.mm.yyyy hh:mm:ss');
    expect(angularToExcelDateFormat('yyyy-MM-dd HH:mm:ss.SSS')).toBe('yyyy-mm-dd hh:mm:ss.000');
    expect(angularToExcelDateFormat('MM/dd/yy h:mm a')).toBe('mm/dd/yy h:mm AM/PM');
    expect(angularToExcelDateFormat('EEEE, d. MMMM y')).toBe('dddd, d. mmmm yyyy');
    expect(angularToExcelDateFormat("dd.MM.yyyy 'um' HH:mm")).toBe('dd.mm.yyyy "um" hh:mm');
  });

  it("keeps an escaped quote ('') inside and outside a quoted literal", () => {
    expect(angularToExcelDateFormat("h 'o''clock' a")).toBe('h "o\'clock" AM/PM');
    expect(angularToExcelDateFormat("HH''mm")).toBe('hh"\'"mm');
  });

  it('returns null for what Excel cannot show the same way', () => {
    expect(angularToExcelDateFormat('short')).toBeNull();
    expect(angularToExcelDateFormat('mediumDate')).toBeNull();
    expect(angularToExcelDateFormat('dd.MM.yyyy HH:mm z')).toBeNull();
    expect(angularToExcelDateFormat('h:mm')).toBeNull();
    expect(angularToExcelDateFormat('HH:mm a')).toBeNull();
    expect(angularToExcelDateFormat(undefined)).toBeNull();
  });
});

describe('ExcelDateFormats (AB#9857)', () => {
  it('uses the locale default of the list without a column format', () => {
    const formats = new ExcelDateFormats('de-AT');
    expect(formats.get(undefined, false)).toBe('dd.mm.yyyy hh:mm:ss');
    expect(formats.get(undefined, true)).toBe('dd.mm.yyyy');
    expect(new ExcelDateFormats('en-GB').get(undefined, true)).toBe('dd/mm/yyyy');
  });

  it('uses the translated column format, and the default for untranslatable ones', () => {
    const formats = new ExcelDateFormats('de-AT');
    expect(formats.get('dd.MM.yyyy HH:mm', false)).toBe('dd.mm.yyyy hh:mm');
    expect(formats.get('short', false)).toBe('dd.mm.yyyy hh:mm:ss');
  });

  it('shows named date-only formats without the time', () => {
    const formats = new ExcelDateFormats('de-AT');
    expect(formats.get('mediumDate', false)).toBe('dd.mm.yyyy');
    expect(formats.get('shortDate', false)).toBe('dd.mm.yyyy');
    expect(formats.get('fullDate', false)).toBe('dd.mm.yyyy');
  });
});

describe('applyExcelDisplayValues (AB#9857)', () => {
  // A MeshBoard table column with a display formatter, a numeric column with format 1.2-2 and a
  // raw ISO date column - the three cases of AB#9857.
  const rows = [
    {day: '2026-11-01T00:00:00Z', amount: 1199364, at: '2026-11-12T10:00:00Z', note: 'a'},
    {day: '2026-11-12T00:00:00Z', amount: -1.8701e-11, at: '2026-11-01', note: 'b'},
    {day: null, amount: null, at: '01.11.2026', note: 'c'},
    {day: '2026-11-13T00:00:00Z', amount: '12', at: null, note: 'd'}
  ];
  const dayText = (value: unknown) => typeof value === 'string'
    ? new Intl.DateTimeFormat('de-AT', {day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'}).format(new Date(value))
    : '';
  const columns: ExcelColumn[] = [
    {formatted: true, value: (row) => dayText(field('day')(row))},
    {numberFormat: '1.2-2', value: field('amount')},
    {isDate: true, value: field('at')},
    {value: field('note')}
  ];
  const fields = ['day', 'amount', 'at', 'note'];
  const dataCells = (workbook: ExcelWorkbookLike) =>
    workbook.sheets![0].rows!.filter((row) => row.type === 'data').map((row) => row.cells!);

  it('writes formatter text as shown (AC1)', () => {
    const workbook = kendoWorkbook(rows, fields);
    expect(applyExcelDisplayValues(workbook, rows, columns, 'de-AT')).toBe(true);
    const cells = dataCells(workbook);
    expect(cells.map((row) => row[0]?.value)).toEqual(['01.11.2026', '12.11.2026', '', '13.11.2026']);
    expect(cells[0][0]?.format).toBeUndefined();
  });

  it('keeps numbers of format columns as numbers with the Excel number format (AC2)', () => {
    const workbook = kendoWorkbook(rows, fields);
    applyExcelDisplayValues(workbook, rows, columns, 'de-AT');
    const cells = dataCells(workbook);
    expect(cells[0][1]).toEqual({value: 1199364, format: '#,##0.00'});
    expect(cells[1][1]).toEqual({value: -1.8701e-11, format: '#,##0.00'});
    // No number: left as Kendo wrote it.
    expect(cells[2][1]).toEqual({value: null});
    expect(cells[3][1]).toEqual({value: '12'});
  });

  it('writes raw ISO values as Excel dates with a date format, other text as text (AC3)', () => {
    const workbook = kendoWorkbook(rows, fields);
    applyExcelDisplayValues(workbook, rows, columns, 'de-AT');
    const cells = dataCells(workbook);
    expect(cells[0][2]?.value).toBeInstanceOf(Date);
    expect((cells[0][2]?.value as Date).toISOString()).toBe('2026-11-12T10:00:00.000Z');
    expect(cells[0][2]?.format).toBe('dd.mm.yyyy hh:mm:ss');
    expect(cells[1][2]?.value).toBeInstanceOf(Date);
    expect(cells[1][2]?.format).toBe('dd.mm.yyyy');
    expect(cells[2][2]).toEqual({value: '01.11.2026'});
    expect(cells[3][2]).toEqual({value: null});
  });

  it('uses the column date format and leaves other columns and the header alone', () => {
    const workbook = kendoWorkbook(rows, fields);
    applyExcelDisplayValues(workbook, rows, [columns[0], columns[1], {...columns[2], dateFormat: 'dd.MM.yyyy HH:mm'}, columns[3]], 'de-AT');
    const cells = dataCells(workbook);
    expect(cells[0][2]?.format).toBe('dd.mm.yyyy hh:mm');
    expect(cells.map((row) => row[3])).toEqual([{value: 'a'}, {value: 'b'}, {value: 'c'}, {value: 'd'}]);
    expect(workbook.sheets![0].rows![0].cells).toEqual(fields.map((name) => ({value: name})));
  });

  it('uses the date-only format for columns the list shows without a time, unless they have a format', () => {
    const workbook = kendoWorkbook(rows, fields);
    applyExcelDisplayValues(workbook, rows, [columns[0], columns[1], {...columns[2], dateOnlyByDefault: true}, columns[3]], 'de-AT');
    expect(dataCells(workbook)[0][2]?.format).toBe('dd.mm.yyyy');

    const withFormat = kendoWorkbook(rows, fields);
    applyExcelDisplayValues(withFormat, rows,
      [columns[0], columns[1], {...columns[2], dateOnlyByDefault: true, dateFormat: 'dd.MM.yyyy HH:mm'}, columns[3]], 'de-AT');
    expect(dataCells(withFormat)[0][2]?.format).toBe('dd.mm.yyyy hh:mm');
  });

  it('changes nothing when the data rows do not match the rows', () => {
    const workbook = kendoWorkbook(rows.slice(0, 2), fields);
    const before = JSON.stringify(workbook);
    expect(applyExcelDisplayValues(workbook, rows, columns, 'de-AT')).toBe(false);
    expect(JSON.stringify(workbook)).toBe(before);
    expect(applyExcelDisplayValues(null, rows, columns, 'de-AT')).toBe(false);
    expect(applyExcelDisplayValues({sheets: []}, rows, columns, 'de-AT')).toBe(false);
  });
});
