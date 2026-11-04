import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LineChartWidgetComponent } from './line-chart-widget.component';
import { QueryExecutorService, QueryResultRow } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { LineChartQuerySeries, LineChartWidgetConfig } from '../../models/meshboard.models';

/**
 * Line chart `seriesLabels` (AB#7235). Fixture: energy per OBIS code over three hours, each code
 * one line; the plain (not resolution-aware) path of the single query chart and the multi-source
 * path with a second query.
 */
describe('LineChartWidgetComponent seriesLabels (AB#7235)', () => {
  const FEED_IN = '1-1:2.9.0 G.03';
  const SURPLUS = '1-1:2.9.0 P.01T';
  const HOURS = ['2026-10-20T10:00:00', '2026-10-20T11:00:00', '2026-10-20T12:00:00'];

  function plainRow(hour: string, code: string, value: number, unit: string): QueryResultRow {
    return {
      __typename: 'StreamDataQueryRow',
      cells: [
        { attributePath: 'window_start', value: hour },
        { attributePath: 'obisCode', value: code },
        { attributePath: 'energy', value },
        { attributePath: 'unit', value: unit }
      ]
    } as QueryResultRow;
  }

  const PLAIN_ROWS = [
    plainRow(HOURS[0], FEED_IN, 1, 'kWh'), plainRow(HOURS[1], FEED_IN, 2, 'kWh'), plainRow(HOURS[2], FEED_IN, 3, 'kWh'),
    plainRow(HOURS[0], SURPLUS, 4, 'kWh'), plainRow(HOURS[1], SURPLUS, 5, 'kWh'), plainRow(HOURS[2], SURPLUS, 6, 'kWh')
  ];

  function config(overrides: Partial<LineChartWidgetConfig> = {}): LineChartWidgetConfig {
    return {
      id: 'w1', type: 'lineChart', title: 'Energy', col: 1, row: 1, colSpan: 4, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q-main', queryFamily: 'streamData', entitySelectorId: 'mp' },
      chartType: 'line', categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'energy', unitField: 'unit',
      ...overrides
    };
  }

  function setup(cfg: LineChartWidgetConfig, rowsByQuery: Record<string, QueryResultRow[]>, timeArgs?: { from: Date; to: Date }) {
    const execute = vi.fn((_family: string, queryRtId: string) => {
      const rows = rowsByQuery[queryRtId] ?? [];
      return of({ family: 'streamData' as const, queryRtId, associatedCkTypeId: null, columns: [], rows, totalCount: rows.length, hasNextPage: false, endCursor: null });
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: QueryExecutorService, useValue: { execute } },
        {
          provide: MeshBoardStateService,
          useValue: {
            resolveStreamDataScope: vi.fn().mockReturnValue({ kind: 'unscoped' }),
            resolveStreamDataRtIds: vi.fn().mockReturnValue(undefined),
            resolveStreamDataTimeArgs: vi.fn().mockReturnValue(timeArgs),
            resolveStreamDataTimeZone: vi.fn().mockReturnValue('UTC'),
            timeZoneMode: vi.fn().mockReturnValue('utc'),
            getVariables: vi.fn().mockReturnValue([])
          }
        },
        { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined) } }
      ]
    });
    const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
    cmp.config = cfg;
    return { cmp, execute, load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData() };
  }

  const names = (cmp: LineChartWidgetComponent): string[] => cmp.seriesData().map(s => s.name);

  describe('single query chart', () => {
    it('names the lines, keeps one line per raw group value and its values', async () => {
      const { cmp, load } = setup(config({ seriesLabels: { [FEED_IN]: 'Feed-in' } }), { 'q-main': PLAIN_ROWS });

      await load();

      expect(names(cmp)).toEqual(['Feed-in', SURPLUS]);
      expect(cmp.seriesData().map(s => s.data)).toEqual([[1, 2, 3], [4, 5, 6]]);
    });

    it('shows the raw values without the key, with an empty map and for values without an entry', async () => {
      for (const seriesLabels of [undefined, {}, { other: 'X' }] as (Record<string, string> | undefined)[]) {
        TestBed.resetTestingModule();
        const { cmp, load } = setup(config({ seriesLabels }), { 'q-main': PLAIN_ROWS });

        await load();

        expect(names(cmp)).toEqual([FEED_IN, SURPLUS]);
      }
    });

    it('matches the exact raw value only', async () => {
      const { cmp, load } = setup(config({ seriesLabels: { '1-1:2.9.0 g.03': 'wrong case', [` ${FEED_IN}`]: 'leading blank' } }), { 'q-main': PLAIN_ROWS });

      await load();

      expect(names(cmp)).toEqual([FEED_IN, SURPLUS]);
    });

    it('two lines with the same name stay two lines, told apart by the raw value', async () => {
      const { cmp, load } = setup(config({ seriesLabels: { [FEED_IN]: 'Same', [SURPLUS]: 'Same' } }), { 'q-main': PLAIN_ROWS });

      await load();

      expect(names(cmp)).toEqual([`Same (${FEED_IN})`, `Same (${SURPLUS})`]);
      expect(cmp.seriesData().map(s => s.data)).toEqual([[1, 2, 3], [4, 5, 6]]);
    });

    it('looks the tooltip unit up under the shown name', async () => {
      const rows = PLAIN_ROWS.map(r => r.cells.some(c => c.value === SURPLUS)
        ? { ...r, cells: r.cells.map(c => (c.attributePath === 'unit' ? { ...c, value: 'kW' } : c)) }
        : r);
      const { cmp, load } = setup(config({ seriesLabels: { [FEED_IN]: 'Feed-in' } }), { 'q-main': rows });

      await load();

      expect(cmp.getUnitForSeries('Feed-in')).toBe(' kWh');
      expect(cmp.getUnitForSeries(SURPLUS)).toBe(' kW');
      expect(cmp.getUnitForSeries(FEED_IN)).toBe('');
    });

    it('excludes by the raw value, never by the name', async () => {
      const byRaw = setup(config({ seriesLabels: { [FEED_IN]: 'Feed-in' }, excludedSeriesGroupValues: [FEED_IN] }), { 'q-main': PLAIN_ROWS });
      await byRaw.load();
      expect(names(byRaw.cmp)).toEqual([SURPLUS]);
      TestBed.resetTestingModule();

      const byName = setup(config({ seriesLabels: { [FEED_IN]: 'Feed-in' }, excludedSeriesGroupValues: ['Feed-in'] }), { 'q-main': PLAIN_ROWS });
      await byName.load();
      expect(names(byName.cmp)).toEqual(['Feed-in', SURPLUS]);
    });

    it('sends the same query with and without names (display only)', async () => {
      const plain = setup(config(), { 'q-main': PLAIN_ROWS });
      await plain.load();
      const plainCalls = plain.execute.mock.calls;
      TestBed.resetTestingModule();

      const named = setup(config({ seriesLabels: { [FEED_IN]: 'Feed-in' } }), { 'q-main': PLAIN_ROWS });
      await named.load();

      expect(named.execute.mock.calls).toEqual(plainCalls);
    });
  });

  describe('series of several queries (multi-source)', () => {
    const PV: LineChartQuerySeries = {
      kind: 'query', key: 'pv', label: 'PV', valueField: 'power',
      dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData', entitySelectorId: 'pv' }
    };

    function dsRow(timestamp: string, value: number, valueColumn: string, group?: string): QueryResultRow {
      const cells = [{ attributePath: `${valueColumn}_avg`, value }] as { attributePath: string; value: unknown }[];
      if (group) cells.push({ attributePath: 'obiscode_max', value: group });
      return { __typename: 'StreamDataQueryRow', rtId: 'r', timestamp: timestamp as unknown as Date, cells } as QueryResultRow;
    }

    const WINDOW = { from: new Date('2026-10-20T10:00:00Z'), to: new Date('2026-10-20T13:00:00Z') };
    const grid = [
      ...HOURS.map((h, i) => dsRow(h, i + 1, 'energy', FEED_IN)),
      ...HOURS.map((h, i) => dsRow(h, i + 4, 'energy', SURPLUS))
    ];
    const pv = HOURS.map((h, i) => dsRow(h, i + 10, 'power'));

    function multi(overrides: Partial<LineChartWidgetConfig> = {}): LineChartWidgetConfig {
      return config({ additionalSeries: [PV], categoryField: 'timestamp', unitField: undefined, ...overrides });
    }

    it('names the primary query\'s lines and keeps the other series\' labels', async () => {
      const { cmp, load } = setup(multi({ seriesLabels: { [FEED_IN]: 'Feed-in', pv: 'must not apply', PV: 'must not apply' } }), { 'q-main': grid, 'q-pv': pv }, WINDOW);

      await load();

      expect(names(cmp)).toEqual(['Feed-in', SURPLUS, 'PV']);
      expect(cmp.seriesData().map(s => s.data)).toEqual([[1, 2, 3], [4, 5, 6], [10, 11, 12]]);
    });

    it('shows the raw values without names', async () => {
      const { cmp, load } = setup(multi(), { 'q-main': grid, 'q-pv': pv }, WINDOW);

      await load();

      expect(names(cmp)).toEqual([FEED_IN, SURPLUS, 'PV']);
    });
  });
});
