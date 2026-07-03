import { TimeRangeUtils } from './time-range-picker.models';

describe('TimeRangeUtils timezone basis', () => {
  describe('getYearRange', () => {
    it('defaults to local-time boundaries', () => {
      const range = TimeRangeUtils.getYearRange(2026);
      // Local wall-clock: Jan 1 00:00 local .. Jan 1 next year 00:00 local
      expect(range.from.getFullYear()).toBe(2026);
      expect(range.from.getMonth()).toBe(0);
      expect(range.from.getDate()).toBe(1);
      expect(range.from.getHours()).toBe(0);
      expect(range.to.getFullYear()).toBe(2027);
    });

    it('produces exact UTC boundaries in utc mode', () => {
      const range = TimeRangeUtils.getYearRange(2026, 'utc');
      expect(range.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(range.to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
  });

  describe('getMonthRange', () => {
    it('produces exact UTC boundaries in utc mode (exclusive end)', () => {
      const range = TimeRangeUtils.getMonthRange(2026, 5, 'utc'); // June
      expect(range.from.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(range.to.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    });
  });

  describe('getQuarterRange', () => {
    it('produces exact UTC boundaries in utc mode', () => {
      const range = TimeRangeUtils.getQuarterRange(2026, 2, 'utc'); // Q2 = Apr-Jun
      expect(range.from.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(range.to.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    });
  });

  describe('getDayRange', () => {
    it('defaults to local-time boundaries (consistent with year/month)', () => {
      const range = TimeRangeUtils.getDayRange(2026, 0, 15);
      expect(range.from.getFullYear()).toBe(2026);
      expect(range.from.getMonth()).toBe(0);
      expect(range.from.getDate()).toBe(15);
      expect(range.from.getHours()).toBe(0);
      // Exclusive end = next local day 00:00
      expect(range.to.getDate()).toBe(16);
    });

    it('produces exact UTC boundaries in utc mode', () => {
      const range = TimeRangeUtils.getDayRange(2026, 0, 15, undefined, undefined, 'utc');
      expect(range.from.toISOString()).toBe('2026-01-15T00:00:00.000Z');
      expect(range.to.toISOString()).toBe('2026-01-16T00:00:00.000Z');
    });

    it('honors an explicit hour window in utc mode', () => {
      const range = TimeRangeUtils.getDayRange(2026, 0, 15, 6, 18, 'utc');
      expect(range.from.toISOString()).toBe('2026-01-15T06:00:00.000Z');
      expect(range.to.toISOString()).toBe('2026-01-15T18:00:00.000Z');
    });
  });

  describe('getTimeRangeFromSelection', () => {
    it('threads the zone through to the year range', () => {
      const range = TimeRangeUtils.getTimeRangeFromSelection({ type: 'year', year: 2026 }, false, 'utc');
      expect(range).not.toBeNull();
      expect(range!.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(range!.to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('defaults to local when no zone is supplied', () => {
      const range = TimeRangeUtils.getTimeRangeFromSelection({ type: 'year', year: 2026 });
      expect(range).not.toBeNull();
      expect(range!.from.getFullYear()).toBe(2026);
      expect(range!.from.getHours()).toBe(0);
    });

    it('normalizes a custom range to full-day UTC boundaries in utc mode', () => {
      const range = TimeRangeUtils.getTimeRangeFromSelection(
        { type: 'custom', customFrom: new Date('2026-06-10T08:30:00Z'), customTo: new Date('2026-06-12T17:00:00Z') },
        false,
        'utc'
      );
      expect(range).not.toBeNull();
      expect(range!.from.toISOString()).toBe('2026-06-10T00:00:00.000Z');
      // Exclusive end = day after customTo at 00:00 UTC
      expect(range!.to.toISOString()).toBe('2026-06-13T00:00:00.000Z');
    });
  });

  // AB#4190: IANA time-zone boundaries — DST-correct and independent of the browser's own zone.
  describe('IANA time zone (AB#4190)', () => {
    it('getYearRange resolves civil year in Europe/Vienna (CET, UTC+1)', () => {
      const range = TimeRangeUtils.getYearRange(2026, 'Europe/Vienna');
      // Jan 1 00:00 CET = Dec 31 23:00 UTC (prior year); same at both ends (both in winter).
      expect(range.from.toISOString()).toBe('2025-12-31T23:00:00.000Z');
      expect(range.to.toISOString()).toBe('2026-12-31T23:00:00.000Z');
    });

    it('getMonthRange resolves civil month in Europe/Vienna (June, CEST, UTC+2)', () => {
      const range = TimeRangeUtils.getMonthRange(2026, 5, 'Europe/Vienna'); // June
      expect(range.from.toISOString()).toBe('2026-05-31T22:00:00.000Z');
      expect(range.to.toISOString()).toBe('2026-06-30T22:00:00.000Z');
    });

    it('getDayRange yields a 24h civil day away from DST (Vienna, June)', () => {
      const range = TimeRangeUtils.getDayRange(2026, 5, 15, undefined, undefined, 'Europe/Vienna');
      expect(range.from.toISOString()).toBe('2026-06-14T22:00:00.000Z');
      expect(range.to.toISOString()).toBe('2026-06-15T22:00:00.000Z');
      expect(range.to.getTime() - range.from.getTime()).toBe(24 * 3600_000);
    });

    it('DST spring-forward day is 23h (Vienna, 2026-03-29)', () => {
      const range = TimeRangeUtils.getDayRange(2026, 2, 29, undefined, undefined, 'Europe/Vienna');
      expect(range.from.toISOString()).toBe('2026-03-28T23:00:00.000Z'); // 00:00 CET
      expect(range.to.toISOString()).toBe('2026-03-29T22:00:00.000Z'); // next 00:00 CEST
      expect(range.to.getTime() - range.from.getTime()).toBe(23 * 3600_000);
    });

    it('DST fall-back day is 25h (Vienna, 2026-10-25)', () => {
      const range = TimeRangeUtils.getDayRange(2026, 9, 25, undefined, undefined, 'Europe/Vienna');
      expect(range.from.toISOString()).toBe('2026-10-24T22:00:00.000Z'); // 00:00 CEST
      expect(range.to.toISOString()).toBe('2026-10-25T23:00:00.000Z'); // next 00:00 CET
      expect(range.to.getTime() - range.from.getTime()).toBe(25 * 3600_000);
    });

    it('"yesterday" differs across zones — Vienna vs Lisbon are one hour apart (off-by-hours fix)', () => {
      const vienna = TimeRangeUtils.getDayRange(2026, 5, 15, undefined, undefined, 'Europe/Vienna');
      const lisbon = TimeRangeUtils.getDayRange(2026, 5, 15, undefined, undefined, 'Europe/Lisbon');
      // Same civil day, different UTC windows: Vienna CEST (UTC+2), Lisbon WEST (UTC+1).
      expect(vienna.from.toISOString()).toBe('2026-06-14T22:00:00.000Z');
      expect(lisbon.from.toISOString()).toBe('2026-06-14T23:00:00.000Z');
      expect(lisbon.from.getTime() - vienna.from.getTime()).toBe(3600_000);
    });

    it('getYearRange resolves civil year in Europe/Lisbon (WET, UTC+0 in winter)', () => {
      const range = TimeRangeUtils.getYearRange(2026, 'Europe/Lisbon');
      expect(range.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(range.to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('normalizes a custom range to full civil-day boundaries in an IANA zone', () => {
      const range = TimeRangeUtils.getTimeRangeFromSelection(
        { type: 'custom', customFrom: new Date('2026-06-10T08:30:00Z'), customTo: new Date('2026-06-12T17:00:00Z') },
        false,
        'Europe/Vienna'
      );
      expect(range).not.toBeNull();
      // Vienna civil days: 2026-06-10 00:00 CEST .. 2026-06-13 00:00 CEST (exclusive).
      expect(range!.from.toISOString()).toBe('2026-06-09T22:00:00.000Z');
      expect(range!.to.toISOString()).toBe('2026-06-12T22:00:00.000Z');
    });
  });
});
