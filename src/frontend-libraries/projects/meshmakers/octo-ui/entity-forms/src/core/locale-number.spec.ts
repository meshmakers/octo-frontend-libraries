import { formatLocaleNumber, formatLocaleNumberInput, LocaleNumberSymbols, parseLocaleNumber } from './locale-number';

const DE_DE: LocaleNumberSymbols = { decimal: ',', group: '.' };
const DE_AT: LocaleNumberSymbols = { decimal: ',', group: '\u00a0' };
const EN_US: LocaleNumberSymbols = { decimal: '.', group: ',' };

function valueOf(text: string, integer = false): number | null {
  const parse = parseLocaleNumber(text, { integer });
  return parse.kind === 'number' ? parse.value : null;
}

describe('parseLocaleNumber (AB#8734)', () => {
  it('reads "77.5" and "77,5" as 77.5 — never 775', () => {
    expect(valueOf('77.5')).toBe(77.5);
    expect(valueOf('77,5')).toBe(77.5);
    expect(parseLocaleNumber('77.5')).toEqual({ kind: 'number', value: 77.5, ambiguous: false });
  });

  it('reads plain digits, signs, a leading or trailing separator and surrounding spaces', () => {
    expect(valueOf('775')).toBe(775);
    expect(valueOf(' -12,25 ')).toBe(-12.25);
    expect(valueOf('+3')).toBe(3);
    expect(valueOf('\u22124.5')).toBe(-4.5);
    expect(valueOf(',5')).toBe(0.5);
    expect(valueOf('5.')).toBe(5);
    expect(valueOf('-0')).toBe(0);
  });

  it('takes the last separator as the decimal one when both are used (de and en grouping)', () => {
    expect(valueOf('1.234,5')).toBe(1234.5);
    expect(valueOf('1,234.5')).toBe(1234.5);
    expect(valueOf('1.234.567,89')).toBe(1234567.89);
    expect(valueOf('1,234,567.89')).toBe(1234567.89);
  });

  it('reads one separator used several times as grouping', () => {
    expect(valueOf('1.234.567')).toBe(1234567);
    expect(valueOf('1,234,567')).toBe(1234567);
  });

  it('reads spaces, non-breaking spaces and apostrophes as grouping (de-AT, de-CH)', () => {
    expect(valueOf('1 234,5')).toBe(1234.5);
    expect(valueOf('1\u00a0234,5')).toBe(1234.5);
    expect(valueOf('1\u202f234.5')).toBe(1234.5);
    expect(valueOf("1'234.5")).toBe(1234.5);
    expect(valueOf('1\u2019234.5')).toBe(1234.5);
  });

  it('refuses a grouping in the wrong place instead of guessing a magnitude', () => {
    for (const text of ['1.23,4', '12.34.5', '1,2.345', '77.5.3', '1.234,5,6', '1.234 567', '12 34', '1,23.4,5']) {
      expect(parseLocaleNumber(text), text).toEqual({ kind: 'invalid', reason: 'grouping' });
    }
  });

  it('refuses text that is no number', () => {
    for (const text of ['abc', '1e5', '-', '.', '12a', '--1', '0x10']) {
      expect(parseLocaleNumber(text).kind, text).toBe('invalid');
    }
  });

  it('flags a single separator before exactly three digits as ambiguous, but reads it as decimal', () => {
    expect(parseLocaleNumber('1.234')).toEqual({ kind: 'number', value: 1.234, ambiguous: true });
    expect(parseLocaleNumber('1,234')).toEqual({ kind: 'number', value: 1.234, ambiguous: true });
    expect(parseLocaleNumber('0.125')).toEqual({ kind: 'number', value: 0.125, ambiguous: false });
    expect(parseLocaleNumber('12.5')).toEqual({ kind: 'number', value: 12.5, ambiguous: false });
    expect(parseLocaleNumber('1.234,5')).toEqual({ kind: 'number', value: 1234.5, ambiguous: false });
  });

  it('decides a single separator before three digits by the locale (de-DE, en-US, de-AT)', () => {
    expect(parseLocaleNumber('1.234', { symbols: DE_DE })).toEqual({ kind: 'invalid', reason: 'ambiguous' });
    expect(parseLocaleNumber('1,234', { symbols: DE_DE })).toEqual({ kind: 'number', value: 1.234, ambiguous: false });
    expect(parseLocaleNumber('1,234', { symbols: EN_US })).toEqual({ kind: 'invalid', reason: 'ambiguous' });
    expect(parseLocaleNumber('1.234', { symbols: EN_US })).toEqual({ kind: 'number', value: 1.234, ambiguous: false });
    // de-AT groups with a space: "." is neither its decimal nor its group symbol, so it is read as decimal and flagged.
    expect(parseLocaleNumber('1.234', { symbols: DE_AT })).toEqual({ kind: 'number', value: 1.234, ambiguous: true });
    // "77.5" is never ambiguous, whatever the locale.
    expect(parseLocaleNumber('77.5', { symbols: DE_DE })).toEqual({ kind: 'number', value: 77.5, ambiguous: false });
  });

  it('reads the locale group symbol before three digits as thousands in a whole-number field', () => {
    expect(parseLocaleNumber('1.234', { integer: true, symbols: DE_DE })).toEqual({ kind: 'number', value: 1234, ambiguous: false });
    expect(parseLocaleNumber('-1,234', { integer: true, symbols: EN_US })).toEqual({ kind: 'number', value: -1234, ambiguous: false });
    expect(parseLocaleNumber('1.234', { integer: true, symbols: EN_US })).toEqual({ kind: 'invalid', reason: 'integer' });
  });

  it('returns empty for blank text', () => {
    expect(parseLocaleNumber('')).toEqual({ kind: 'empty' });
    expect(parseLocaleNumber('   ')).toEqual({ kind: 'empty' });
    expect(parseLocaleNumber(null)).toEqual({ kind: 'empty' });
  });

  it('refuses a non-zero fraction in a whole-number field', () => {
    expect(parseLocaleNumber('7,5', { integer: true })).toEqual({ kind: 'invalid', reason: 'integer' });
    expect(valueOf('7,0', true)).toBe(7);
    expect(valueOf('1.234.567', true)).toBe(1234567);
  });
});

describe('formatLocaleNumber / formatLocaleNumberInput (AB#8734)', () => {
  it('formats in German (de-DE, de-AT)', () => {
    expect(formatLocaleNumber(77.5, DE_DE)).toBe('77,5');
    expect(formatLocaleNumber(1234567.25, DE_DE)).toBe('1.234.567,25');
    expect(formatLocaleNumber(1234.5, DE_AT)).toBe('1\u00a0234,5');
    expect(formatLocaleNumber(-0.5, DE_DE)).toBe('-0,5');
    expect(formatLocaleNumber(1e-7, DE_DE)).toBe('0,0000001');
    expect(formatLocaleNumber(1.5e21, DE_DE)).toBe('1.500.000.000.000.000.000.000');
    expect(formatLocaleNumberInput(1234.5, DE_DE)).toBe('1234,5');
  });

  it('formats in English (en-US)', () => {
    expect(formatLocaleNumber(77.5, EN_US)).toBe('77.5');
    expect(formatLocaleNumber(1234567.25, EN_US)).toBe('1,234,567.25');
    expect(formatLocaleNumberInput(1234.5, EN_US)).toBe('1234.5');
  });

  it('writes edit text without exponent that parses back to the same value', () => {
    for (const value of [0.000001, 1e-25, 1e21, 1.5e300, -42.125, 0.1 + 0.2, 0.1, 775, -0.5]) {
      for (const symbols of [DE_DE, EN_US]) {
        const text = formatLocaleNumberInput(value, symbols);
        expect(text).not.toMatch(/e/i);
        expect(valueOf(text), text).toBe(value);
      }
    }
  });
});
