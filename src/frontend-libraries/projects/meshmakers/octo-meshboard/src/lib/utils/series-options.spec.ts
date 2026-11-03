import { alignOnFixedGrid, fillMissingValues, fixedGridInstants, lastValue, snapWindowToBuckets } from './series-options';

const MIN = 60_000;

describe('series options (AB#8046)', () => {
  describe('fillMissingValues', () => {
    const data = [null, 5, null, null, 1, null];

    it('leaves the data unchanged for gap / no mode (a copy)', () => {
      const out = fillMissingValues(data, undefined);
      expect(out).toEqual(data);
      expect(out).not.toBe(data);
      expect(fillMissingValues(data, 'gap')).toEqual(data);
    });

    it('zero: every null becomes 0, real values stay', () => {
      expect(fillMissingValues(data, 'zero')).toEqual([0, 5, 0, 0, 1, 0]);
    });

    it('carryForward: the last value carries; before the first value null without a seed', () => {
      expect(fillMissingValues(data, 'carryForward')).toEqual([null, 5, 5, 5, 1, 1]);
    });

    it('carryForward: the seed (value before the window) fills the start', () => {
      expect(fillMissingValues(data, 'carryForward', { seed: 2 })).toEqual([2, 5, 5, 5, 1, 1]);
      // A real 0 is a value, not a gap.
      expect(fillMissingValues([null, 0, null], 'carryForward', { seed: 3 })).toEqual([3, 0, 0]);
    });

    it('on-change fixture: a long flat period and an overnight gap are carried, not gaps', () => {
      // PV writes 0 at sunset (bucket 1) and nothing until sunrise (bucket 7).
      const pv = [1.2, 0, null, null, null, null, null, 0.4];
      expect(fillMissingValues(pv, 'carryForward')).toEqual([1.2, 0, 0, 0, 0, 0, 0, 0.4]);
      // Battery idle at its SoC floor all night: no rows at all, the look-back seed is the value.
      expect(fillMissingValues(new Array(8).fill(null), 'carryForward', { seed: 0 })).toEqual(new Array(8).fill(0));
    });

    it('never fills buckets after now', () => {
      const instants = [0, 15, 30, 45].map(m => m * MIN);
      const now = 20 * MIN;
      expect(fillMissingValues([1, null, null, null], 'carryForward', { instants, now })).toEqual([1, 1, null, null]);
      expect(fillMissingValues([null, null, null, null], 'zero', { instants, now })).toEqual([0, 0, null, null]);
      // A real value after now (should not happen) is kept.
      expect(fillMissingValues([null, null, null, 7], 'zero', { instants, now })).toEqual([0, 0, null, 7]);
    });

    it('fills every entry when the instants are unknown (categories that are no date-time)', () => {
      expect(fillMissingValues([null, 2, null], 'zero', { instants: [null, null, null], now: 0 })).toEqual([0, 2, 0]);
    });
  });

  describe('snapWindowToBuckets', () => {
    it('snaps an unaligned window to whole quarter hours (UTC)', () => {
      const w = snapWindowToBuckets(new Date('2026-10-20T10:07:30Z'), new Date('2026-10-20T10:52:00Z'), 15, 'utc')!;
      expect(w.from.toISOString()).toBe('2026-10-20T10:00:00.000Z');
      expect(w.to.toISOString()).toBe('2026-10-20T11:00:00.000Z');
      expect(w.count).toBe(4);
      expect(w.bucketMs).toBe(15 * MIN);
    });

    it('keeps an aligned window: a 15-minute day has 96 buckets', () => {
      const w = snapWindowToBuckets(new Date('2026-10-20T22:00:00Z'), new Date('2026-10-21T22:00:00Z'), 15, 'Europe/Vienna')!;
      expect(w.from.toISOString()).toBe('2026-10-20T22:00:00.000Z');
      expect(w.count).toBe(96);
    });

    it('DST fall-back day 2026-10-25 in Europe/Vienna has 100 quarter hours, the doubled hour included', () => {
      // Local midnight 25.10. = 24.10. 22:00Z (CEST), local midnight 26.10. = 25.10. 23:00Z (CET).
      const w = snapWindowToBuckets(new Date('2026-10-24T22:00:00Z'), new Date('2026-10-25T23:00:00Z'), 15, 'Europe/Vienna')!;
      expect(w.count).toBe(100);
      const instants = fixedGridInstants(w);
      expect(new Set(instants).size).toBe(100);
      // Every bucket is 15 minutes apart, also across 03:00 CEST → 02:00 CET.
      for (let i = 1; i < instants.length; i++) expect(instants[i] - instants[i - 1]).toBe(15 * MIN);
    });

    it('DST spring-forward day 2026-03-29 in Europe/Vienna has 23 hours', () => {
      const w = snapWindowToBuckets(new Date('2026-03-28T23:00:00Z'), new Date('2026-03-29T22:00:00Z'), 60, 'Europe/Vienna')!;
      expect(w.count).toBe(23);
    });

    it('aligns hour buckets on the wall clock of a half-hour zone (Asia/Kolkata, UTC+05:30)', () => {
      const w = snapWindowToBuckets(new Date('2026-10-20T10:10:00Z'), new Date('2026-10-20T12:10:00Z'), 60, 'Asia/Kolkata')!;
      // 10:10Z = 15:40 IST → bucket start 15:00 IST = 09:30Z.
      expect(w.from.toISOString()).toBe('2026-10-20T09:30:00.000Z');
      expect(w.to.toISOString()).toBe('2026-10-20T12:30:00.000Z');
      expect(w.count).toBe(3);
    });

    it('rejects sizes that do not divide an hour, invalid windows and too many buckets', () => {
      const from = new Date('2026-10-20T00:00:00Z');
      expect(snapWindowToBuckets(from, new Date('2026-10-20T01:00:00Z'), 7, 'utc')).toBeNull();
      expect(snapWindowToBuckets(from, new Date('2026-10-20T01:00:00Z'), 0, 'utc')).toBeNull();
      expect(snapWindowToBuckets(from, from, 15, 'utc')).toBeNull();
      expect(snapWindowToBuckets(from, new Date('2027-10-20T00:00:00Z'), 1, 'utc')).toBeNull();
    });
  });

  describe('alignOnFixedGrid', () => {
    const window = snapWindowToBuckets(new Date('2026-10-20T10:00:00Z'), new Date('2026-10-20T11:00:00Z'), 15, 'utc')!;
    const t = (hhmm: string): number => new Date(`2026-10-20T${hhmm}:00Z`).getTime();

    it('places every point in its bucket, averages finer points, drops points outside the window', () => {
      const grid = alignOnFixedGrid([
        { sourceKey: 'a', sourceLabel: 'A', series: [{ name: 'A', points: new Map([[t('10:00'), 1], [t('10:05'), 3], [t('10:30'), 4], [t('11:00'), 9], [t('09:45'), 9]]) }] },
        // A coarse source (hour buckets) fills only the bucket its point starts in.
        { sourceKey: 'b', sourceLabel: 'B', series: [{ name: 'B', points: new Map([[t('10:00'), 6]]) }] }
      ], window);
      expect(grid.instants).toEqual([t('10:00'), t('10:15'), t('10:30'), t('10:45')]);
      expect(grid.gridStepMs).toBe(15 * MIN);
      expect(grid.misaligned).toEqual([]);
      expect(grid.series.find(s => s.sourceKey === 'a')!.data).toEqual([2, null, 4, null]);
      expect(grid.series.find(s => s.sourceKey === 'b')!.data).toEqual([6, null, null, null]);
    });

    it('keeps all buckets of the window although no source has data at the start or the end', () => {
      const grid = alignOnFixedGrid([
        { sourceKey: 'a', sourceLabel: 'A', series: [{ name: 'A', points: new Map([[t('10:15'), 2], [t('10:20'), null]]) }] }
      ], window);
      expect(grid.series[0].data).toEqual([null, 2, null, null]);
    });
  });

  it('lastValue: the non-null value with the latest instant', () => {
    expect(lastValue(new Map([[3, 1], [1, 9], [5, null]]))).toBe(1);
    expect(lastValue(new Map([[1, null]]))).toBeNull();
    expect(lastValue(new Map())).toBeNull();
  });
});
