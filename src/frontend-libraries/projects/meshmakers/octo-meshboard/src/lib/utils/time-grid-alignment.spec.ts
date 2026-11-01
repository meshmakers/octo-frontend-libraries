import { alignOnTimeGrid, bucketStepMs, TimeGridSourceInput } from './time-grid-alignment';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const t = (iso: string): number => Date.parse(iso);

function source(key: string, points: [string, number | null][], name = key): TimeGridSourceInput {
  return { sourceKey: key, sourceLabel: key.toUpperCase(), series: [{ name, points: new Map(points.map(([iso, v]) => [t(iso), v])) }] };
}

/** Points every `stepMin` minutes from `startIso`, `count` of them, value = index. */
function regular(key: string, startIso: string, stepMin: number, count: number): TimeGridSourceInput {
  const start = t(startIso);
  const points = new Map<number, number>();
  for (let i = 0; i < count; i++) points.set(start + i * stepMin * MIN, i);
  return { sourceKey: key, sourceLabel: key, series: [{ name: key, points }] };
}

describe('bucketStepMs', () => {
  it('is the smallest positive distance, null for fewer than two instants', () => {
    expect(bucketStepMs([])).toBeNull();
    expect(bucketStepMs([5])).toBeNull();
    expect(bucketStepMs([0, 30, 45, 105])).toBe(15);
  });
});

describe('alignOnTimeGrid', () => {
  it('puts every bucket of every source on the same category', () => {
    const grid = alignOnTimeGrid([
      source('grid', [['2026-10-20T10:00:00Z', 1], ['2026-10-20T10:15:00Z', 2], ['2026-10-20T10:30:00Z', 3]]),
      source('pv', [['2026-10-20T10:00:00Z', 10], ['2026-10-20T10:15:00Z', 20], ['2026-10-20T10:30:00Z', 30]]),
      source('battery', [['2026-10-20T10:00:00Z', 100], ['2026-10-20T10:15:00Z', 200], ['2026-10-20T10:30:00Z', 300]])
    ]);

    expect(grid.instants).toEqual([t('2026-10-20T10:00:00Z'), t('2026-10-20T10:15:00Z'), t('2026-10-20T10:30:00Z')]);
    expect(grid.gridStepMs).toBe(15 * MIN);
    expect(grid.series.map(s => s.data)).toEqual([[1, 2, 3], [10, 20, 30], [100, 200, 300]]);
    expect(grid.misaligned).toEqual([]);
  });

  it('a bucket a source has no data for is null, never 0', () => {
    const grid = alignOnTimeGrid([
      source('grid', [['2026-10-20T10:00:00Z', 1], ['2026-10-20T10:15:00Z', 2], ['2026-10-20T10:30:00Z', 3]]),
      source('pv', [['2026-10-20T10:00:00Z', 10], ['2026-10-20T10:30:00Z', 30]])
    ]);

    expect(grid.series[1].data).toEqual([10, null, 30]);
  });

  it('keeps a real 0 and a null value as delivered', () => {
    const grid = alignOnTimeGrid([
      source('a', [['2026-10-20T10:00:00Z', 0], ['2026-10-20T10:15:00Z', null]])
    ]);
    expect(grid.series[0].data).toEqual([0, null]);
  });

  it('fills a bucket no source has data for as a gap (fixed step up to one hour)', () => {
    const grid = alignOnTimeGrid([
      source('a', [['2026-10-20T10:00:00Z', 1], ['2026-10-20T10:15:00Z', 2], ['2026-10-20T11:00:00Z', 5]]),
      source('b', [['2026-10-20T10:00:00Z', 7], ['2026-10-20T11:00:00Z', 8]])
    ]);

    expect(grid.instants.length).toBe(5);
    expect(grid.series[0].data).toEqual([1, 2, null, null, 5]);
    expect(grid.series[1].data).toEqual([7, null, null, null, 8]);
  });

  it('reports a source on a different rung (5-min buckets inside a 15-min grid) instead of plotting it shifted', () => {
    const grid = alignOnTimeGrid([
      regular('grid', '2026-10-20T10:00:00Z', 15, 4),
      regular('battery', '2026-10-20T10:00:00Z', 5, 12)
    ]);

    expect(grid.misaligned).toEqual([{ sourceKey: 'battery', sourceLabel: 'battery', stepMs: 5 * MIN, gridStepMs: 15 * MIN }]);
    expect(grid.series.map(s => s.sourceKey)).toEqual(['grid']);
    expect(grid.instants.length).toBe(4);
  });

  it('the coarsest source is the reference, whatever its position', () => {
    const grid = alignOnTimeGrid([
      regular('fine', '2026-10-20T10:00:00Z', 5, 12),
      regular('coarse', '2026-10-20T10:00:00Z', 15, 4)
    ]);
    expect(grid.gridStepMs).toBe(15 * MIN);
    expect(grid.misaligned.map(m => m.sourceKey)).toEqual(['fine']);
  });

  it('reports a source with the same width but a shifted anchor', () => {
    const grid = alignOnTimeGrid([
      regular('grid', '2026-10-20T10:00:00Z', 15, 4),
      regular('pv', '2026-10-20T10:05:00Z', 15, 4)
    ]);
    expect(grid.misaligned.map(m => m.sourceKey)).toEqual(['pv']);
  });

  it('accepts a source with a single point on the grid and one outside the reference range', () => {
    const grid = alignOnTimeGrid([
      regular('grid', '2026-10-20T10:00:00Z', 15, 4),
      source('pv', [['2026-10-20T10:15:00Z', 5], ['2026-10-20T11:30:00Z', 9]])
    ]);
    expect(grid.misaligned).toEqual([]);
    // 10:00 … 10:45 from the reference, 11:00 and 11:15 filled, 11:30 from pv.
    expect(grid.instants.length).toBe(7);
    expect(grid.series[1].data).toEqual([null, 5, null, null, null, null, 9]);
  });

  it('DST day 2026-10-25 (Europe/Vienna): 15-min buckets give 100 categories, none doubled or missing', () => {
    // Civil day 2026-10-25 in Vienna = 2026-10-24T22:00Z … 2026-10-25T23:00Z (25 hours).
    const grid = alignOnTimeGrid([
      regular('grid', '2026-10-24T22:00:00Z', 15, 100),
      regular('pv', '2026-10-24T22:00:00Z', 15, 100)
    ]);

    expect(grid.instants.length).toBe(100);
    expect(new Set(grid.instants).size).toBe(100);
    expect(grid.instants[99] - grid.instants[0]).toBe(25 * HOUR - 15 * MIN);
    expect(grid.series.every(s => s.data.every(v => v !== null))).toBe(true);
  });

  it('daily (calendar) buckets across the DST change align and are not filled', () => {
    // Vienna midnights: 23:00Z in winter time, 22:00Z in summer time.
    const days = ['2026-10-23T22:00:00Z', '2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z', '2026-10-27T23:00:00Z'];
    const grid = alignOnTimeGrid([
      source('grid', days.map(d => [d, 1] as [string, number])),
      source('pv', days.slice(0, 3).map(d => [d, 2] as [string, number]))
    ]);

    expect(grid.misaligned).toEqual([]);
    expect(grid.instants).toEqual(days.map(t));
    expect(grid.series[1].data).toEqual([2, 2, 2, null]);
  });

  it('several series of one source keep their order and share the grid', () => {
    const grid = alignOnTimeGrid([{
      sourceKey: 'primary', sourceLabel: 'Primary', series: [
        { name: 'import', points: new Map([[t('2026-10-20T10:00:00Z'), 1]]), unit: 'kW' },
        { name: 'export', points: new Map([[t('2026-10-20T10:15:00Z'), 2]]) }
      ]
    }]);
    expect(grid.series).toEqual([
      { name: 'import', sourceKey: 'primary', data: [1, null], unit: 'kW' },
      { name: 'export', sourceKey: 'primary', data: [null, 2], unit: undefined }
    ]);
  });

  it('no data at all gives an empty grid', () => {
    const grid = alignOnTimeGrid([source('a', []), source('b', [])]);
    expect(grid).toEqual({ instants: [], gridStepMs: null, series: [
      { name: 'a', sourceKey: 'a', data: [], unit: undefined },
      { name: 'b', sourceKey: 'b', data: [], unit: undefined }
    ], misaligned: [] });
  });
});
