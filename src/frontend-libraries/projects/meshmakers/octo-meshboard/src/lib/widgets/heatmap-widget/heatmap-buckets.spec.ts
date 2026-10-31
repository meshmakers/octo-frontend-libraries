import {
  aggregateHeatmapEntries,
  heatmapBucketShiftMs,
  heatmapHourSlot,
  heatmapTimeWindowLabel,
  hourSlotIndex,
  hourSlotIndices,
  hourSlotLabel,
  isValidHeatmapTimeWindow,
  resolveHeatmapTimeWindow,
  toFiniteNumber
} from './heatmap-buckets';

describe('heatmap-buckets (AB#7956)', () => {
  describe('aggregateHeatmapEntries', () => {
    it('returns Σ value / Σ weight for weightedAvg', () => {
      expect(aggregateHeatmapEntries([{ value: 10, weight: 4 }, { value: 2, weight: 1 }], 'weightedAvg')).toBe(12 / 5);
    });

    it('returns null for weightedAvg without rows or without weight', () => {
      expect(aggregateHeatmapEntries([], 'weightedAvg')).toBeNull();
      expect(aggregateHeatmapEntries([{ value: 0, weight: 0 }], 'weightedAvg')).toBeNull();
    });

    it('keeps 0 for an empty cell of count / sum / avg', () => {
      expect(aggregateHeatmapEntries([], 'count')).toBe(0);
      expect(aggregateHeatmapEntries([], 'sum')).toBe(0);
      expect(aggregateHeatmapEntries([], 'avg')).toBe(0);
    });

    it('ignores the weight for count / sum / avg', () => {
      const entries = [{ value: 3, weight: 9 }, { value: 5, weight: 9 }];
      expect(aggregateHeatmapEntries(entries, 'count')).toBe(2);
      expect(aggregateHeatmapEntries(entries, 'sum')).toBe(8);
      expect(aggregateHeatmapEntries(entries, 'avg')).toBe(4);
    });
  });

  describe('heatmapHourSlot (board time zone, DST)', () => {
    it('flags the repeated 02:00 hour of the Vienna fall-back day 2026-10-25', () => {
      const first = heatmapHourSlot(new Date('2026-10-25T00:30:00Z'), 'Europe/Vienna');   // 02:30 CEST
      const second = heatmapHourSlot(new Date('2026-10-25T01:30:00Z'), 'Europe/Vienna');  // 02:30 CET
      expect(first).toEqual({ dateKey: '2026-10-25', hour: 2, minute: 30, repeat: false });
      expect(second).toEqual({ dateKey: '2026-10-25', hour: 2, minute: 30, repeat: true });
    });

    it('never flags a repeat in UTC', () => {
      expect(heatmapHourSlot(new Date('2026-10-25T01:30:00Z'), 'utc')?.repeat).toBe(false);
    });

    it('orders and labels the repeated hour right after its hour', () => {
      expect(hourSlotIndex({ hour: 2, repeat: false })).toBe(4);
      expect(hourSlotIndex({ hour: 2, repeat: true })).toBe(5);
      expect(hourSlotLabel(4)).toBe('02:00');
      expect(hourSlotLabel(5)).toBe('02:00 (2)');
      const slots = hourSlotIndices([5]);
      expect(slots).toHaveLength(25);
      expect(slots.slice(2, 5)).toEqual([4, 5, 6]);
      expect(hourSlotIndices([])).toHaveLength(24);
    });
  });

  describe('heatmapBucketShiftMs', () => {
    it('shifts by the bucket width when the date marks the bucket end', () => {
      expect(heatmapBucketShiftMs({ timestampIsBucketEnd: true, bucketWidthMinutes: 5 })).toBe(300_000);
    });

    it('does not shift without the flag, without a positive width or with an end field', () => {
      expect(heatmapBucketShiftMs({ bucketWidthMinutes: 5 })).toBe(0);
      expect(heatmapBucketShiftMs({ timestampIsBucketEnd: true })).toBe(0);
      expect(heatmapBucketShiftMs({ timestampIsBucketEnd: true, bucketWidthMinutes: 0 })).toBe(0);
      expect(heatmapBucketShiftMs({ timestampIsBucketEnd: true, bucketWidthMinutes: 5, dateEndField: 'window_end' })).toBe(0);
    });
  });

  describe('time window', () => {
    afterEach(() => vi.useRealTimers());

    it('accepts only positive integer values with a known unit', () => {
      expect(isValidHeatmapTimeWindow({ value: 30, unit: 'days' })).toBe(true);
      expect(isValidHeatmapTimeWindow({ value: 0, unit: 'days' })).toBe(false);
      expect(isValidHeatmapTimeWindow({ value: 1.5, unit: 'days' })).toBe(false);
      expect(isValidHeatmapTimeWindow({ value: 3, unit: 'years' as never })).toBe(false);
      expect(isValidHeatmapTimeWindow(undefined)).toBe(false);
    });

    it('resolves a rolling window ending now with from floored to the full hour', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-31T06:42:17Z'));
      const range = resolveHeatmapTimeWindow({ value: 12, unit: 'hours' });
      expect(range?.to.toISOString()).toBe('2026-10-31T06:42:17.000Z');
      expect(range?.from.toISOString()).toBe('2026-10-30T18:00:00.000Z');
    });

    it('resolves nothing without a window', () => {
      expect(resolveHeatmapTimeWindow(undefined)).toBeUndefined();
    });

    it('labels the window', () => {
      expect(heatmapTimeWindowLabel({ value: 30, unit: 'days' })).toBe('Last 30 days');
      expect(heatmapTimeWindowLabel({ value: 1, unit: 'weeks' })).toBe('Last 1 week');
      expect(heatmapTimeWindowLabel(undefined)).toBeNull();
    });
  });

  it('toFiniteNumber parses numbers and numeric strings only', () => {
    expect(toFiniteNumber(3)).toBe(3);
    expect(toFiniteNumber('2.5')).toBe(2.5);
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber('')).toBeNull();
    expect(toFiniteNumber('abc')).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
  });
});
