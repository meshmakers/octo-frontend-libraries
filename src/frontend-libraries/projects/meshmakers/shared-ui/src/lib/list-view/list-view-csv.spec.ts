import { buildCsv, CsvColumn, CsvValueFormatter, parseCsvDigitsInfo, quoteCsvField } from './list-view-csv';

const BOM = '\uFEFF';

const columns: CsvColumn[] = [
  { title: 'Name', value: (r) => (r as { name: unknown }).name },
  { title: 'Value', value: (r) => (r as { value: unknown }).value }
];

describe('quoteCsvField (AB#8123, RFC 4180)', () => {
  it('leaves plain fields alone', () => {
    expect(quoteCsvField('abc', ';')).toBe('abc');
    expect(quoteCsvField('a,b', ';')).toBe('a,b');
  });

  it('quotes fields with the separator, a quote or a line break and doubles quotes', () => {
    expect(quoteCsvField('a;b', ';')).toBe('"a;b"');
    expect(quoteCsvField('a,b', ',')).toBe('"a,b"');
    expect(quoteCsvField('say "hi"', ';')).toBe('"say ""hi"""');
    expect(quoteCsvField('line1\nline2', ';')).toBe('"line1\nline2"');
    expect(quoteCsvField('line1\r\nline2', ';')).toBe('"line1\r\nline2"');
  });
});

describe('buildCsv (AB#8123)', () => {
  it('writes a UTF-8 BOM, a header row and CRLF line ends', () => {
    const csv = buildCsv([{ name: 'a', value: 1 }, { name: 'b', value: 2 }], columns, { separator: ';', locale: null });

    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}Name;Value\r\na;1\r\nb;2\r\n`);
    expect(csv.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  it('writes only the header row for an empty list', () => {
    expect(buildCsv([], columns, { separator: ';', locale: null })).toBe(`${BOM}Name;Value\r\n`);
  });

  it('quotes header titles and values that need it', () => {
    const csv = buildCsv(
      [{ name: 'Müller; "Hans"', value: 'multi\nline' }],
      [{ title: 'Name; full', value: (r) => (r as { name: string }).name }, columns[1]],
      { separator: ';', locale: null });

    expect(csv).toBe(`${BOM}"Name; full";Value\r\n"Müller; ""Hans""";"multi\nline"\r\n`);
  });

  it('uses the configured separator', () => {
    const csv = buildCsv([{ name: 'a;b', value: 'c,d' }], columns, { separator: ',', locale: null });
    expect(csv).toBe(`${BOM}Name,Value\r\na;b,"c,d"\r\n`);
  });

  it('formats numbers and dates in the given locale (German Excel)', () => {
    const date = new Date(2025, 11, 31, 23, 45, 7);
    const csv = buildCsv([{ name: date, value: 1234.5 }], columns, { separator: ';', locale: 'de-AT' });
    expect(csv).toBe(`${BOM}Name;Value\r\n31.12.2025 23:45:07;1234,5\r\n`);
  });

  it('writes locale-neutral numbers and ISO dates without a locale', () => {
    const date = new Date(Date.UTC(2025, 0, 1, 0, 15));
    const csv = buildCsv([{ name: date, value: 1234.5 }], columns, { separator: ';', locale: null });
    expect(csv).toBe(`${BOM}Name;Value\r\n2025-01-01T00:15:00.000Z;1234.5\r\n`);
  });

  it('formats ISO strings of date columns as dates and leaves empty values empty', () => {
    const dateColumn: CsvColumn = { title: 'At', value: (r) => (r as { at: unknown }).at, isDate: true };
    const csv = buildCsv([{ at: '2025-06-01T10:00:00Z' }, { at: null }, { at: 'not a date' }], [dateColumn],
      { separator: ';', locale: null });
    expect(csv).toBe(`${BOM}At\r\n2025-06-01T10:00:00.000Z\r\n\r\nnot a date\r\n`);
  });

  it('writes date-only strings of date columns as the same calendar day, without a time', () => {
    const dateColumn: CsvColumn = { title: 'Day', value: (r) => (r as { day: unknown }).day, isDate: true };
    expect(buildCsv([{ day: '2025-06-01' }], [dateColumn], { separator: ';', locale: 'de-AT' }))
      .toBe(`${BOM}Day\r\n01.06.2025\r\n`);
    expect(buildCsv([{ day: '2025-06-01' }], [dateColumn], { separator: ';', locale: null }))
      .toBe(`${BOM}Day\r\n2025-06-01\r\n`);
  });

  it('keeps a date-only string that is no calendar day as text instead of rolling it over', () => {
    const dateColumn: CsvColumn = { title: 'Day', value: (r) => (r as { day: unknown }).day, isDate: true };
    expect(buildCsv([{ day: '2025-02-31' }, { day: '2025-13-01' }, { day: '2024-02-29' }], [dateColumn], { separator: ';', locale: 'de-AT' }))
      .toBe(`${BOM}Day\r\n2025-02-31\r\n2025-13-01\r\n29.02.2024\r\n`);
  });

  it('neutralizes formula text but keeps numbers, negative numbers and numeric formatter output', () => {
    const csv = buildCsv([
      { name: '=HYPERLINK("http://x")', value: -12.5 },
      { name: '+1+2', value: '-12,5' },
      { name: '@SUM(A1)', value: '-3' },
      { name: '-cmd', value: 'plain' }
    ], columns, { separator: ';', locale: 'de-AT' });

    expect(csv.split('\r\n').slice(1, 5)).toEqual([
      `"'=HYPERLINK(""http://x"")";-12,5`,
      `'+1+2;-12,5`,
      `'@SUM(A1);-3`,
      `'-cmd;plain`
    ]);
  });

  it('neutralizes formula text in date columns when it is no date', () => {
    const dateColumns: CsvColumn[] = [{ title: 'At', value: (r) => (r as { at: unknown }).at, isDate: true }];
    const csv = buildCsv([
      { at: '=HYPERLINK("http://x")' },
      { at: '+A1' },
      { at: '-1+2' },
      { at: '@SUM(A1)' },
      { at: 'no date' }
    ], dateColumns, { separator: ';', locale: 'de-AT' });

    expect(csv.split('\r\n').slice(1, 6)).toEqual([
      `"'=HYPERLINK(""http://x"")"`,
      `'+A1`,
      `'-1+2`,
      `'@SUM(A1)`,
      'no date'
    ]);
  });

  it('never writes a formula-like date-column value as it is, with or without a locale', () => {
    const dateColumns: CsvColumn[] = [{ title: 'At', value: (r) => (r as { at: unknown }).at, isDate: true }];
    for (const locale of ['de-AT', null]) {
      const lines = buildCsv([{ at: '=1+1' }, { at: '+1' }, { at: '-1' }, { at: '@x' }], dateColumns, { separator: ';', locale })
        .split('\r\n').slice(1, 5);
      // Either neutralized text or a parsed date; never the raw formula text.
      expect(lines.filter((line) => /^[=+@]/.test(line) || line === '-1')).toEqual([]);
    }
  });

  it('neutralizes formula text in header titles', () => {
    const csv = buildCsv([], [{ title: '=cmd', value: () => '' }], { separator: ';', locale: null });

    expect(csv).toBe(`${BOM}'=cmd\r\n`);
  });

  it('builds 35,040 rows (one year of quarter-hours) quickly', () => {
    const rows = Array.from({ length: 35040 }, (_, i) => ({
      name: new Date(Date.UTC(2025, 0, 1) + i * 900000),
      value: Math.round(i * 1.37 * 1000) / 1000
    }));
    const start = performance.now();
    const csv = buildCsv(rows, columns, { separator: ';', locale: 'de-AT' });
    const elapsed = performance.now() - start;

    expect(csv.split('\r\n').length).toBe(35040 + 2);
    expect(elapsed).toBeLessThan(3000);
  });
});

describe('CsvValueFormatter', () => {
  it('writes booleans, objects and non-finite numbers predictably', () => {
    const formatter = new CsvValueFormatter('en-US');
    expect(formatter.format(true)).toBe('true');
    expect(formatter.format({ a: 1 })).toBe('{"a":1}');
    expect(formatter.format(Number.NaN)).toBe('');
    expect(formatter.format(1234567.891)).toBe('1234567.891');
    expect(formatter.format(undefined)).toBe('');
  });
});

describe('CSV export of formatted dates (AB#8836)', () => {
  const dayColumn = (isDate: boolean): CsvColumn => ({ title: 'Tag', value: (r) => (r as { day: unknown }).day, isDate });

  it('never re-parses formatter text in a date column: days 1-12 keep their order', () => {
    for (const locale of ['de-AT', 'en-GB', null]) {
      const csv = buildCsv([{ day: '01.11.2026' }, { day: '12.11.2026' }, { day: '13.11.2026' }, { day: '01/11/2026' }],
        [dayColumn(true)], { separator: ';', locale });

      expect(csv).toBe(`${BOM}Tag\r\n01.11.2026\r\n12.11.2026\r\n13.11.2026\r\n01/11/2026\r\n`);
    }
  });

  it('writes formatter text of an unmarked column as it is (the list view marks no formatted column as date)', () => {
    const csv = buildCsv([{ day: '01.11.2026' }, { day: '01/11/2026' }], [dayColumn(false)], { separator: ';', locale: 'de-AT' });

    expect(csv).toBe(`${BOM}Tag\r\n01.11.2026\r\n01/11/2026\r\n`);
  });

  it('formats real ISO 8601 strings of unformatted date columns in the locale (de-AT, en-GB) or as ISO without one', () => {
    const rows = [{ day: '2026-11-01T10:00:00' }, { day: '2026-11-12 10:30' }, { day: '2026-11-13T10:00:00.5' }, { day: '2026-11-01' }];

    expect(buildCsv(rows, [dayColumn(true)], { separator: ';', locale: 'de-AT' }))
      .toBe(`${BOM}Tag\r\n01.11.2026 10:00:00\r\n12.11.2026 10:30:00\r\n13.11.2026 10:00:00\r\n01.11.2026\r\n`);
    expect(buildCsv(rows, [dayColumn(true)], { separator: ';', locale: 'en-GB' }))
      .toBe(`${BOM}Tag\r\n01/11/2026 10:00:00\r\n12/11/2026 10:30:00\r\n13/11/2026 10:00:00\r\n01/11/2026\r\n`);
    expect(buildCsv([{ day: '2026-11-01T10:00:00Z' }, { day: '2026-11-01T11:00:00+01:00' }], [dayColumn(true)], { separator: ';', locale: null }))
      .toBe(`${BOM}Tag\r\n2026-11-01T10:00:00.000Z\r\n2026-11-01T10:00:00.000Z\r\n`);
  });

  it('keeps text that only looks like a date-time as text', () => {
    const csv = buildCsv([{ day: '2026-11-01T25:99' }, { day: 'Nov 1, 2026' }, { day: '1.11.2026 10:00' }], [dayColumn(true)],
      { separator: ';', locale: 'de-AT' });

    expect(csv).toBe(`${BOM}Tag\r\n2026-11-01T25:99\r\nNov 1, 2026\r\n1.11.2026 10:00\r\n`);
  });
});

describe('CSV export of numbers in the column display format (AB#8836)', () => {
  const amountColumn = (numberFormat?: string): CsvColumn => ({ title: 'Menge', value: (r) => (r as { v: unknown }).v, numberFormat });
  const lines = (csv: string) => csv.replace(BOM, '').split('\r\n').slice(1, -1);

  it('writes the digits of the format with the locale decimal sign and no grouping', () => {
    const rows = [{ v: 1199364 }, { v: 12.345 }, { v: 1234567.891 }, { v: -3.5 }];

    expect(lines(buildCsv(rows, [amountColumn('1.2-2')], { separator: ';', locale: 'de-AT' })))
      .toEqual(['1199364,00', '12,35', '1234567,89', '-3,50']);
    expect(lines(buildCsv(rows, [amountColumn('1.2-2')], { separator: ';', locale: 'en-GB' })))
      .toEqual(['1199364.00', '12.35', '1234567.89', '-3.50']);
    expect(lines(buildCsv(rows, [amountColumn('1.2-2')], { separator: ';', locale: null })))
      .toEqual(['1199364.00', '12.35', '1234567.89', '-3.50']);
  });

  it('writes a negative residue that rounds to zero without a minus', () => {
    const rows = [{ v: -1.8701e-11 }, { v: -0.004 }, { v: -0 }];

    expect(lines(buildCsv(rows, [amountColumn('1.2-2')], { separator: ';', locale: 'de-AT' }))).toEqual(['0,00', '0,00', '0,00']);
    expect(lines(buildCsv(rows, [amountColumn('1.0-0')], { separator: ';', locale: 'en-GB' }))).toEqual(['0', '0', '0']);
  });

  it('keeps the raw value without a format or with a format that is no digits info', () => {
    const rows = [{ v: -1.8701e-11 }, { v: 1199364 }];

    for (const format of [undefined, '', 'n2', '1.3-2']) {
      expect(lines(buildCsv(rows, [amountColumn(format)], { separator: ';', locale: 'de-AT' })))
        .toEqual(['-0,000000000018701', '1199364']);
    }
  });

  it('leaves non-number values of a formatted numeric column alone', () => {
    const rows = [{ v: null }, { v: '12,5 kWh' }, { v: Number.NaN }];

    expect(lines(buildCsv(rows, [amountColumn('1.2-2')], { separator: ';', locale: 'de-AT' }))).toEqual(['', '12,5 kWh', '']);
  });
});

describe('parseCsvDigitsInfo (AB#8836)', () => {
  it('reads Angular DecimalPipe digits info with its defaults', () => {
    expect(parseCsvDigitsInfo('1.2-2')).toEqual({ minIntegerDigits: 1, minFractionDigits: 2, maxFractionDigits: 2 });
    expect(parseCsvDigitsInfo('3.1-5')).toEqual({ minIntegerDigits: 3, minFractionDigits: 1, maxFractionDigits: 5 });
    expect(parseCsvDigitsInfo('.0-0')).toEqual({ minIntegerDigits: 1, minFractionDigits: 0, maxFractionDigits: 0 });
    expect(parseCsvDigitsInfo('1.')).toEqual({ minIntegerDigits: 1, minFractionDigits: 0, maxFractionDigits: 3 });
    expect(parseCsvDigitsInfo('1.5')).toEqual({ minIntegerDigits: 1, minFractionDigits: 5, maxFractionDigits: 5 });
  });

  it('refuses anything else', () => {
    for (const text of [null, undefined, '', 'n2', '1.3-2', '0.2-2', '1-2', 'abc']) {
      expect(parseCsvDigitsInfo(text)).toBeNull();
    }
  });
});
