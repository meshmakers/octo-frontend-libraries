import {
  isCompleteQuerySeries,
  primaryRowsToSeries,
  queryRowsToSeries,
  querySeriesErrors,
  uniqueCategoryLabels
} from './line-chart-multi-source';
import { LineChartQuerySeries } from '../../models/meshboard.models';
import { QueryResultRow } from '../../services/query-executor.service';

const t = (iso: string): number => Date.parse(iso);

function row(timestamp: string | null, cells: Record<string, unknown>): QueryResultRow {
  return {
    __typename: 'StreamDataQueryRow',
    timestamp: timestamp as unknown as Date,
    cells: Object.entries(cells).map(([attributePath, value]) => ({ attributePath, value }))
  } as QueryResultRow;
}

function series(overrides: Partial<LineChartQuerySeries> = {}): LineChartQuerySeries {
  return {
    kind: 'query', key: 'pv', valueField: 'power',
    dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData' },
    ...overrides
  };
}

describe('line chart multi-source helpers (AB#7951)', () => {
  describe('primaryRowsToSeries', () => {
    const fields = { categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'amount.value', unitField: 'unit' };

    it('downsampled rows: bucket = row timestamp (naive = UTC), value = the _avg cell, one series per group', () => {
      const out = primaryRowsToSeries([
        row('2026-10-20T10:00:00', { obiscode_max: 'A', amountvalue_avg: 1, amountvalue_min: 0, amountvalue_max: 9 }),
        row('2026-10-20T10:15:00', { obiscode_max: 'A', amountvalue_avg: null }),
        row('2026-10-20T10:00:00', { obiscode_max: 'B', amountvalue_avg: 2 })
      ], fields, true);

      expect(out.map(s => [s.name, Array.from(s.points.entries())])).toEqual([
        ['A', [[t('2026-10-20T10:00:00Z'), 1], [t('2026-10-20T10:15:00Z'), null]]],
        ['B', [[t('2026-10-20T10:00:00Z'), 2]]]
      ]);
    });

    it('raw rows: bucket = category cell, exact value cell, unit per series', () => {
      const out = primaryRowsToSeries([
        row(null, { window_start: '2026-10-20T10:00:00Z', obisCode: 'A', 'amount.value': '3.5', unit: 'kW' })
      ], fields, false);
      expect(out).toEqual([{ name: 'A', points: new Map([[t('2026-10-20T10:00:00Z'), 3.5]]), unit: 'kW' }]);
    });

    it('skips rows without a bucket or a group value', () => {
      const out = primaryRowsToSeries([
        row(null, { obisCode: 'A', 'amount.value': 1 }),
        row(null, { window_start: '2026-10-20T10:00:00Z', 'amount.value': 1 })
      ], fields, false);
      expect(out).toEqual([]);
    });
  });

  describe('queryRowsToSeries', () => {
    it('sums the rows of one bucket (several source entities); all-null stays null', () => {
      const out = queryRowsToSeries([
        row('2026-10-20T10:00:00Z', { power_avg: 1 }),
        row('2026-10-20T10:00:00Z', { power_avg: 2 }),
        row('2026-10-20T10:15:00Z', { power_avg: null }),
        row('2026-10-20T10:15:00Z', { power_avg: null }),
        row('2026-10-20T10:30:00Z', { power_avg: null }),
        row('2026-10-20T10:30:00Z', { power_avg: 4 })
      ], 'PV', 'power', true);

      expect(out.name).toBe('PV');
      expect(Array.from(out.points.values())).toEqual([3, null, 4]);
    });

    it('a real 0 stays 0', () => {
      const out = queryRowsToSeries([row('2026-10-20T10:00:00Z', { power: 0 })], 'PV', 'power', false);
      expect(Array.from(out.points.values())).toEqual([0]);
    });
  });

  it('uniqueCategoryLabels suffixes a repeated label', () => {
    expect(uniqueCategoryLabels([1, 2, 3, 4], d => (d.getTime() % 2 ? 'odd' : 'even'))).toEqual(['odd', 'even', 'odd (2)', 'even (2)']);
  });

  it('isCompleteQuerySeries needs a valid key, a query and a value field', () => {
    expect(isCompleteQuerySeries(series())).toBe(true);
    expect(isCompleteQuerySeries(series({ key: '' }))).toBe(false);
    expect(isCompleteQuerySeries(series({ key: '1pv' }))).toBe(false);
    expect(isCompleteQuerySeries(series({ key: '__primary' }))).toBe(false);
    expect(isCompleteQuerySeries(series({ valueField: '' }))).toBe(false);
    expect(isCompleteQuerySeries(series({ dataSource: { type: 'persistentQuery', queryRtId: '' } }))).toBe(false);
  });

  it('querySeriesErrors explains every invalid row', () => {
    expect(querySeriesErrors([
      series(),
      series({ key: '' }),
      series({ key: 'a-b' }),
      series({ key: 'dup' }),
      series({ key: 'dup' }),
      series({ key: 'noQuery', dataSource: { type: 'persistentQuery', queryRtId: '' } }),
      series({ key: 'noValue', valueField: '' }),
      series({ key: 'noAgg', dataSource: { type: 'persistentQuery', queryRtId: 'q', resolutionAware: true } })
    ])).toEqual([
      null,
      'Enter a key.',
      'The key may contain letters, digits and _ and must not start with a digit.',
      'The key "dup" is used by another series.',
      'The key "dup" is used by another series.',
      'Select a stream-data query.',
      'Select a value field.',
      'Select the aggregation.'
    ]);
  });
});
