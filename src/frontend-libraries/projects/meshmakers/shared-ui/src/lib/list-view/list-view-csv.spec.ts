import { buildCsv, CsvColumn, CsvValueFormatter, quoteCsvField } from './list-view-csv';

const BOM = '﻿';

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
