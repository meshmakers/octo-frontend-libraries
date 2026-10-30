import { parseHostTimeRange, sameHostTimeRange, toHostTimeRangeState } from './host-time-range';

describe('parseHostTimeRange (AB#7582)', () => {
  it('returns undefined when the host sets no period', () => {
    expect(parseHostTimeRange(undefined)).toBeUndefined();
    expect(parseHostTimeRange(null)).toBeUndefined();
  });

  it.each([
    ['Z strings', '2026-03-28T05:00:00Z', '2026-03-29T04:00:00Z'],
    ['offset strings', '2026-03-28T06:00:00+01:00', '2026-03-29T06:00:00+02:00'],
    ['compact offsets and milliseconds', '2026-03-28T06:00:00.000+0100', '2026-03-29T06:00:00.000+0200']
  ])('takes %s as exact instants', (_label, from, to) => {
    const parsed = parseHostTimeRange({ from, to });
    expect(parsed).toEqual({ status: 'valid', from: new Date('2026-03-28T05:00:00Z'), to: new Date('2026-03-29T04:00:00Z') });
  });

  it('copies Date objects, so a later mutation by the host does not leak in', () => {
    const from = new Date('2026-03-28T05:00:00Z');
    const parsed = parseHostTimeRange({ from, to: new Date('2026-03-29T04:00:00Z') });
    from.setUTCHours(0);
    expect(parsed?.status === 'valid' && parsed.from.toISOString()).toBe('2026-03-28T05:00:00.000Z');
  });

  it.each([
    ['no zone designator', { from: '2026-03-28T05:00:00', to: '2026-03-29T04:00:00Z' }],
    ['a date only', { from: '2026-03-28', to: '2026-03-29T04:00:00Z' }],
    ['garbage', { from: 'yesterday', to: '2026-03-29T04:00:00Z' }],
    ['a number', { from: 1774674000000 as unknown as string, to: '2026-03-29T04:00:00Z' }],
    ['an invalid Date', { from: new Date(Number.NaN), to: new Date() }]
  ])('rejects %s as unparseable', (_label, range) => {
    expect(parseHostTimeRange(range)).toEqual({ status: 'invalid', reason: expect.stringContaining('zone designator') });
  });

  it('rejects an empty or reversed range', () => {
    const at = '2026-03-28T05:00:00Z';
    expect(parseHostTimeRange({ from: at, to: at })).toEqual({ status: 'invalid', reason: 'from must be before to' });
    expect(parseHostTimeRange({ from: '2026-03-29T00:00:00Z', to: at })).toEqual({ status: 'invalid', reason: 'from must be before to' });
  });

  it('compares periods by their instants', () => {
    const a = parseHostTimeRange({ from: '2026-03-28T05:00:00Z', to: '2026-03-29T04:00:00Z' });
    const b = parseHostTimeRange({ from: new Date('2026-03-28T05:00:00Z'), to: new Date('2026-03-29T04:00:00Z') });
    const c = parseHostTimeRange({ from: '2026-03-28T05:00:00Z', to: '2026-03-29T05:00:00Z' });
    expect(sameHostTimeRange(a, b)).toBe(true);
    expect(sameHostTimeRange(a, c)).toBe(false);
    expect(sameHostTimeRange(a, undefined)).toBe(false);
    expect(sameHostTimeRange(undefined, undefined)).toBe(true);
  });

  it('maps to the state-service form without the reason', () => {
    expect(toHostTimeRangeState(undefined)).toBeNull();
    expect(toHostTimeRangeState({ status: 'invalid', reason: 'x' })).toEqual({ status: 'invalid' });
  });
});
