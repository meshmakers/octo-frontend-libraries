import { parseHostTimeRange, sameHostTimeRange } from './host-time-range';

describe('parseHostTimeRange (AB#7582)', () => {
  const TO = '2026-03-29T04:00:00Z';
  const UNPARSEABLE = expect.stringContaining('RFC 3339');

  it('returns undefined when the host sets no period', () => {
    expect(parseHostTimeRange(undefined)).toBeUndefined();
    expect(parseHostTimeRange(null)).toBeUndefined();
  });

  it.each([
    ['Z strings', '2026-03-28T05:00:00Z', '2026-03-29T04:00:00Z'],
    ['±HH:MM offsets (Vienna wall clock across the DST switch)', '2026-03-28T06:00:00+01:00', '2026-03-29T06:00:00+02:00'],
    ['milliseconds', '2026-03-28T05:00:00.000Z', '2026-03-29T04:00:00.0Z'],
    ['negative offsets', '2026-03-28T00:00:00-05:00', '2026-03-28T23:00:00-05:00']
  ])('takes %s as exact instants', (_label, from, to) => {
    const parsed = parseHostTimeRange({ from, to });
    expect(parsed?.status).toBe('valid');
    if (parsed?.status === 'valid') {
      expect(parsed.from.toISOString()).toBe(new Date(from).toISOString());
      expect(parsed.to.toISOString()).toBe(new Date(to).toISOString());
    }
  });

  it('computes the gas day exactly from Vienna offsets', () => {
    expect(parseHostTimeRange({ from: '2026-03-28T06:00:00+01:00', to: '2026-03-29T06:00:00+02:00' })).toEqual({
      status: 'valid', from: new Date('2026-03-28T05:00:00.000Z'), to: new Date('2026-03-29T04:00:00.000Z')
    });
  });

  it('handles leap days and years below 100 without Date.UTC remapping', () => {
    const leap = parseHostTimeRange({ from: '2028-02-29T00:00:00Z', to: '2028-03-01T00:00:00Z' });
    expect(leap?.status).toBe('valid');
    const early = parseHostTimeRange({ from: '0050-01-01T00:00:00Z', to: '0050-01-02T00:00:00Z' });
    expect(early?.status === 'valid' && early.from.getUTCFullYear()).toBe(50);
  });

  it('copies Date objects, so a later mutation by the host does not leak in', () => {
    const from = new Date('2026-03-28T05:00:00Z');
    const parsed = parseHostTimeRange({ from, to: new Date(TO) });
    from.setUTCHours(0);
    expect(parsed?.status === 'valid' && parsed.from.toISOString()).toBe('2026-03-28T05:00:00.000Z');
  });

  it.each([
    ['no offset', '2026-03-28T05:00:00'],
    ['a date only', '2026-03-28'],
    ['no seconds', '2026-03-28T05:00Z'],
    ['a compact offset', '2026-03-28T06:00:00+0100'],
    ['a lowercase t', '2026-03-28t05:00:00Z'],
    ['a lowercase z', '2026-03-28T05:00:00z'],
    ['a space instead of T', '2026-03-28 05:00:00Z'],
    ['more than 3 fraction digits', '2026-03-28T05:00:00.0000Z'],
    ['a calendar-invalid day (Feb 30)', '2026-02-30T00:00:00Z'],
    ['Feb 29 in a common year', '2026-02-29T00:00:00Z'],
    ['month 13', '2026-13-01T00:00:00Z'],
    ['day 0', '2026-03-00T00:00:00Z'],
    ['hour 24', '2026-03-28T24:00:00Z'],
    ['24:01', '2026-03-28T24:01:00Z'],
    ['minute 60', '2026-03-28T23:60:00Z'],
    ['a leap second', '2026-03-28T23:59:60Z'],
    ['offset hour 24', '2026-03-28T00:00:00+24:00'],
    ['offset minute 60', '2026-03-28T00:00:00+01:60'],
    ['garbage', 'yesterday'],
    ['a number', 1774674000000 as unknown as string],
    ['an invalid Date', new Date(Number.NaN)]
  ])('rejects %s', (_label, from) => {
    expect(parseHostTimeRange({ from, to: TO })).toEqual({ status: 'invalid', reason: UNPARSEABLE });
  });

  it('rejects an empty or reversed range', () => {
    const at = '2026-03-28T05:00:00Z';
    expect(parseHostTimeRange({ from: at, to: at })).toEqual({ status: 'invalid', reason: 'from must be before to' });
    expect(parseHostTimeRange({ from: '2026-03-29T00:00:00Z', to: at })).toEqual({ status: 'invalid', reason: 'from must be before to' });
  });

  it('compares periods by their instants', () => {
    const a = parseHostTimeRange({ from: '2026-03-28T05:00:00Z', to: TO });
    const b = parseHostTimeRange({ from: new Date('2026-03-28T05:00:00Z'), to: new Date(TO) });
    const c = parseHostTimeRange({ from: '2026-03-28T05:00:00Z', to: '2026-03-29T05:00:00Z' });
    expect(sameHostTimeRange(a, b)).toBe(true);
    expect(sameHostTimeRange(a, c)).toBe(false);
    expect(sameHostTimeRange(a, undefined)).toBe(false);
    expect(sameHostTimeRange(undefined, undefined)).toBe(true);
  });
});
