import { QueryResultRow } from '../../services/query-executor.service';
import {
  alignOnCategories,
  categoryOf,
  primaryRowsToCategorySeries,
  queryRowsToCategorySeries,
  rowCategory,
  uniqueLabels
} from './bar-chart-multi-source';

/** Category alignment of the multi-source bar chart (AB#7953). */

function row(cells: Record<string, unknown>, timestamp?: string): QueryResultRow {
  return {
    __typename: 'StreamDataQueryRow',
    timestamp: timestamp as unknown as Date,
    cells: Object.entries(cells).map(([attributePath, value]) => ({ attributePath, value: value as number }))
  };
}

describe('bar-chart-multi-source (AB#7953)', () => {
  describe('categoryOf / rowCategory', () => {
    it('matches the same instant in different ISO spellings, and Date objects', () => {
      const a = categoryOf('2026-10-01T00:00:00Z');
      const b = categoryOf('2026-10-01T00:00:00.000Z');
      const c = categoryOf(new Date('2026-10-01T00:00:00Z'));
      expect(a?.key).toBe(b?.key);
      expect(a?.key).toBe(c?.key);
      expect(a?.instant).toBe(Date.parse('2026-10-01T00:00:00Z'));
    });

    it('pins naive wire timestamps to UTC (AB#4818)', () => {
      expect(categoryOf('2026-10-01T00:00:00')?.instant).toBe(Date.parse('2026-10-01T00:00:00Z'));
    });

    it('keeps text categories as text and skips empty values', () => {
      expect(categoryOf('Company')).toEqual({ key: 's:Company', instant: null, raw: 'Company' });
      expect(categoryOf(42)?.key).toBe('s:42');
      expect(categoryOf('')).toBeNull();
      expect(categoryOf(null)).toBeNull();
    });

    it('reads `timestamp` from the row of a stream-data query when no cell carries it', () => {
      expect(rowCategory(row({ power: 1 }, '2026-10-02T00:00:00Z'), 'timestamp')?.instant).toBe(Date.parse('2026-10-02T00:00:00Z'));
      expect(rowCategory(row({ day: '2026-10-03T00:00:00Z' }, '2026-10-02T00:00:00Z'), 'day')?.instant).toBe(Date.parse('2026-10-03T00:00:00Z'));
      expect(rowCategory(row({ power: 1 }, '2026-10-02T00:00:00Z'), 'day')).toBeNull();
    });
  });

  describe('primaryRowsToCategorySeries', () => {
    it('static mode: one series per value field; a missing cell is 0, a null cell stays null (as today)', () => {
      const r = primaryRowsToCategorySeries([
        row({ day: 'Mon', importEnergy: 3, exportEnergy: null }),
        row({ day: 'Tue', importEnergy: '2.5' })
      ], { categoryField: 'day', series: [{ field: 'importEnergy', name: 'Import' }, { field: 'exportEnergy' }] }, 1);

      expect(r.categories.map(c => c.raw)).toEqual(['Mon', 'Tue']);
      expect(r.series.map(s => s.name)).toEqual(['Import', 'exportEnergy']);
      expect([...r.series[0].values.values()]).toEqual([3, 2.5]);
      expect([...r.series[1].values.values()]).toEqual([null, 0]);
    });

    it('dynamic mode: one series per group value; a combination missing in a category of this source is 0', () => {
      const r = primaryRowsToCategorySeries([
        row({ day: 'Mon', dir: 'import', energy: 3 }),
        row({ day: 'Mon', dir: 'export', energy: 1 }),
        row({ day: 'Tue', dir: 'import', energy: 2 })
      ], { categoryField: 'day', seriesGroupField: 'dir', valueField: 'energy' }, 1);

      expect(r.series.map(s => s.name)).toEqual(['import', 'export']);
      expect(r.series[1].values.get('s:Tue')).toBe(0);
    });

    it('applies valueScale to every value (static and dynamic)', () => {
      const s = primaryRowsToCategorySeries([row({ day: 'Mon', e: 2000, n: null })],
        { categoryField: 'day', series: [{ field: 'e' }, { field: 'n' }] }, 0.001);
      expect(s.series[0].values.get('s:Mon')).toBeCloseTo(2, 10);
      expect(s.series[1].values.get('s:Mon')).toBeNull();

      const d = primaryRowsToCategorySeries([row({ day: 'Mon', g: 'a', e: 4000 })],
        { categoryField: 'day', seriesGroupField: 'g', valueField: 'e' }, 0.001);
      expect(d.series[0].values.get('s:Mon')).toBeCloseTo(4, 10);
    });
  });

  describe('queryRowsToCategorySeries', () => {
    it('sums several rows of one category (one per source entity); all-null stays null; scaled after summing', () => {
      const r = queryRowsToCategorySeries([
        row({ power: 1000 }, '2026-10-01T00:00:00Z'),
        row({ power: 500 }, '2026-10-01T00:00:00Z'),
        row({ power: null }, '2026-10-02T00:00:00Z'),
        row({ power: null }, '2026-10-02T00:00:00Z')
      ], 'PV', 'timestamp', 'power', 0.001);

      expect(r.series.name).toBe('PV');
      expect(r.categories.length).toBe(2);
      expect([...r.series.values.values()]).toEqual([1.5, null]);
    });
  });

  describe('alignOnCategories', () => {
    const day = (d: number): string => `2026-10-0${d}T00:00:00Z`;

    it('matches per category: union of all sources, chronological when all are date-times; a missing category is null, never 0', () => {
      const grid = primaryRowsToCategorySeries([
        row({ day: day(3), imp: 3, exp: 1 }),
        row({ day: day(1), imp: 5, exp: 0 })
      ], { categoryField: 'day', series: [{ field: 'imp' }, { field: 'exp' }] }, 1);
      const pv = queryRowsToCategorySeries([
        row({ power: 4 }, day(2)),
        row({ power: 6 }, day(3))
      ], 'PV', 'timestamp', 'power', 1);

      const aligned = alignOnCategories([
        { sourceKey: '__primary', sourceLabel: 'Grid', ...grid },
        { sourceKey: 'pv', sourceLabel: 'PV', categories: pv.categories, series: [pv.series] }
      ]);

      expect(aligned.categories.map(c => c.instant)).toEqual([day(1), day(2), day(3)].map(d => Date.parse(d)));
      expect(aligned.series).toEqual([
        { sourceKey: '__primary', name: 'imp', data: [5, null, 3] },
        { sourceKey: '__primary', name: 'exp', data: [0, null, 1] },
        { sourceKey: 'pv', name: 'PV', data: [null, 4, 6] }
      ]);
    });

    it('text categories keep the order of first appearance (primary first)', () => {
      const a = queryRowsToCategorySeries([row({ c: 'B', v: 1 }), row({ c: 'A', v: 2 })], 'a', 'c', 'v', 1);
      const b = queryRowsToCategorySeries([row({ c: 'C', v: 3 }), row({ c: 'A', v: 4 })], 'b', 'c', 'v', 1);
      const aligned = alignOnCategories([
        { sourceKey: 'a', sourceLabel: 'a', categories: a.categories, series: [a.series] },
        { sourceKey: 'b', sourceLabel: 'b', categories: b.categories, series: [b.series] }
      ]);
      expect(aligned.categories.map(c => c.raw)).toEqual(['B', 'A', 'C']);
      expect(aligned.series.map(s => s.data)).toEqual([[1, 2, null], [null, 4, 3]]);
    });

    it('mixed categories (date-time and text) are not sorted', () => {
      const a = queryRowsToCategorySeries([row({ c: 'later', v: 1 }), row({ c: day(1), v: 2 })], 'a', 'c', 'v', 1);
      const aligned = alignOnCategories([{ sourceKey: 'a', sourceLabel: 'a', categories: a.categories, series: [a.series] }]);
      expect(aligned.categories.map(c => c.raw)).toEqual(['later', day(1)]);
    });
  });

  it('uniqueLabels suffixes repeated labels', () => {
    expect(uniqueLabels(['a', 'b', 'a', 'a'])).toEqual(['a', 'b', 'a (2)', 'a (3)']);
  });
});
