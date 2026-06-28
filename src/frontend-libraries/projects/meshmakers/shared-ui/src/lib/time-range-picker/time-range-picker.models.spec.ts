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
});
