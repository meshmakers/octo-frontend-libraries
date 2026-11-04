import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BarChartWidgetComponent } from './bar-chart-widget.component';
import { QueryExecutorService, QueryResultRow } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { BarChartWidgetConfig, LineChartQuerySeries } from '../../models/meshboard.models';

/**
 * Bar chart `categoryLabels` / `seriesLabels` (AB#7235). Fixture: energy readings per OBIS code
 * (category) and per metering region (series group).
 */
describe('BarChartWidgetComponent value labels (AB#7235)', () => {
  const FEED_IN = '1-1:2.9.0 G.03';
  const SURPLUS = '1-1:2.9.0 P.01T';

  function row(cells: Record<string, unknown>, extra: Partial<QueryResultRow> = {}): QueryResultRow {
    return { __typename: 'StreamDataQueryRow', ...extra, cells: Object.entries(cells).map(([attributePath, value]) => ({ attributePath, value })) } as QueryResultRow;
  }

  function config(overrides: Partial<BarChartWidgetConfig> = {}): BarChartWidgetConfig {
    return {
      id: 'w1', type: 'barChart', title: 'Energy', col: 1, row: 1, colSpan: 4, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q-main', queryFamily: 'streamData', entitySelectorId: 'mp' },
      chartType: 'column', categoryField: 'obisCode', series: [{ field: 'energy_sum', name: 'Energy' }],
      ...overrides
    };
  }

  function setup(cfg: BarChartWidgetConfig, rowsByQuery: Record<string, QueryResultRow[]>) {
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
            resolveStreamDataTimeArgs: vi.fn().mockReturnValue(undefined),
            timeZoneMode: vi.fn().mockReturnValue('utc'),
            getVariables: vi.fn().mockReturnValue([])
          }
        },
        { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined) } }
      ]
    });
    const cmp = TestBed.createComponent(BarChartWidgetComponent).componentInstance;
    cmp.config = cfg;
    return { cmp, execute, load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData() };
  }

  describe('static series (one value field per series)', () => {
    const rows = [row({ obisCode: FEED_IN, energy_sum: 10 }), row({ obisCode: SURPLUS, energy_sum: 4 })];

    it('names the categories and leaves the values and the series name', async () => {
      const { cmp, load } = setup(config({ categoryLabels: { [FEED_IN]: 'Feed-in' } }), { 'q-main': rows });

      await load();

      expect(cmp.categories()).toEqual(['Feed-in', SURPLUS]);
      expect(cmp.seriesData()).toEqual([{ name: 'Energy', data: [10, 4], color: undefined }]);
    });

    it('shows the raw categories without the key, with an empty map and for values without an entry', async () => {
      for (const categoryLabels of [undefined, {}, { other: 'X' }] as (Record<string, string> | undefined)[]) {
        TestBed.resetTestingModule();
        const { cmp, load } = setup(config({ categoryLabels }), { 'q-main': rows });

        await load();

        expect(cmp.categories()).toEqual([FEED_IN, SURPLUS]);
      }
    });

    it('matches a date category by its raw value and formats the others as before', async () => {
      const dated = [row({ obisCode: '2026-10-01T10:00:00Z', energy_sum: 1 }), row({ obisCode: '2026-10-01T11:00:00Z', energy_sum: 2 })];
      const plain = setup(config(), { 'q-main': dated });
      await plain.load();
      const [firstFormatted, secondFormatted] = plain.cmp.categories();
      TestBed.resetTestingModule();

      const named = setup(config({ categoryLabels: { '2026-10-01T10:00:00Z': 'Morning' } }), { 'q-main': dated });
      await named.load();

      expect(named.cmp.categories()).toEqual(['Morning', secondFormatted]);
      expect(firstFormatted).not.toBe('Morning');
    });

    it('does not rename a static series with seriesLabels', async () => {
      const { cmp, load } = setup(config({ seriesLabels: { energy_sum: 'Renamed', Energy: 'Renamed' } }), { 'q-main': rows });

      await load();

      expect(cmp.seriesData().map(s => s.name)).toEqual(['Energy']);
    });

    it('sends the same query with and without names (display only)', async () => {
      const plain = setup(config(), { 'q-main': rows });
      await plain.load();
      const plainCall = plain.execute.mock.calls;
      TestBed.resetTestingModule();

      const named = setup(config({ categoryLabels: { [FEED_IN]: 'Feed-in' } }), { 'q-main': rows });
      await named.load();

      expect(named.execute.mock.calls).toEqual(plainCall);
    });
  });

  describe('dynamic series (seriesGroupField)', () => {
    const rows = [
      row({ region: 'N', obisCode: FEED_IN, energy_sum: 1 }),
      row({ region: 'N', obisCode: SURPLUS, energy_sum: 2 }),
      row({ region: 'S', obisCode: FEED_IN, energy_sum: 3 })
    ];

    function dynamic(overrides: Partial<BarChartWidgetConfig> = {}): BarChartWidgetConfig {
      return config({ categoryField: 'obisCode', series: [], seriesGroupField: 'region', valueField: 'energy_sum', ...overrides });
    }

    it('names categories and series and groups on the raw values', async () => {
      const { cmp, load } = setup(dynamic({ categoryLabels: { [FEED_IN]: 'Feed-in' }, seriesLabels: { N: 'North' } }), { 'q-main': rows });

      await load();

      expect(cmp.categories()).toEqual(['Feed-in', SURPLUS]);
      expect(cmp.seriesData()).toEqual([{ name: 'North', data: [1, 2] }, { name: 'S', data: [3, 0] }]);
    });

    it('shows raw categories and series without names, and with an empty map', async () => {
      for (const labels of [{}, undefined]) {
        TestBed.resetTestingModule();
        const { cmp, load } = setup(dynamic({ categoryLabels: labels, seriesLabels: labels }), { 'q-main': rows });

        await load();

        expect(cmp.categories()).toEqual([FEED_IN, SURPLUS]);
        expect(cmp.seriesData().map(s => s.name)).toEqual(['N', 'S']);
      }
    });

    it('two categories with the same name stay two categories with their own values', async () => {
      const { cmp, load } = setup(dynamic({ categoryLabels: { [FEED_IN]: 'Same', [SURPLUS]: 'Same' } }), { 'q-main': rows });

      await load();

      expect(cmp.categories()).toEqual(['Same', 'Same']);
      expect(cmp.seriesData()).toEqual([{ name: 'N', data: [1, 2] }, { name: 'S', data: [3, 0] }]);
    });

    it('two series with the same name stay two series, told apart by the raw value', async () => {
      const { cmp, load } = setup(dynamic({ seriesLabels: { N: 'Region', S: 'Region' } }), { 'q-main': rows });

      await load();

      expect(cmp.seriesData().map(s => s.name)).toEqual(['Region (N)', 'Region (S)']);
      expect(cmp.seriesData().map(s => s.data)).toEqual([[1, 2], [3, 0]]);
    });

    it('applies colour thresholds to the values, not to the names', async () => {
      const { cmp, load } = setup(dynamic({ seriesLabels: { N: 'North' }, colorThresholds: [{ value: 2, color: '#111111' }], defaultBarColor: '#222222' }), { 'q-main': rows });

      await load();

      expect(cmp.seriesData()[0].name).toBe('North');
      expect(cmp.seriesData()[0].data).toEqual([{ value: 1, _color: '#111111' }, { value: 2, _color: '#111111' }]);
    });
  });

  describe('series of several queries (multi-source)', () => {
    const D1 = '2026-10-01T00:00:00Z';
    const D2 = '2026-10-02T00:00:00Z';
    const PV: LineChartQuerySeries = {
      kind: 'query', key: 'pv', label: 'PV', valueField: 'energy', categoryField: 'timestamp',
      dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData', entitySelectorId: 'pv' }
    };
    const grid = [
      row({ day: D1, region: 'N', importEnergy: 3 }),
      row({ day: D1, region: 'S', importEnergy: 4 }),
      row({ day: D2, region: 'N', importEnergy: 5 })
    ];
    const pv = [row({ energy: 7 }, { timestamp: D1 as unknown as Date }), row({ energy: 8 }, { timestamp: D2 as unknown as Date })];

    function multi(overrides: Partial<BarChartWidgetConfig> = {}): BarChartWidgetConfig {
      return config({ categoryField: 'day', series: [], seriesGroupField: 'region', valueField: 'importEnergy', additionalSeries: [PV], ...overrides });
    }

    it('names the categories and the dynamic series of the primary query and keeps the other series\' labels', async () => {
      const { cmp, load } = setup(multi({ categoryLabels: { [D1]: 'First day' }, seriesLabels: { N: 'North', PV: 'must not apply', pv: 'must not apply' } }), { 'q-main': grid, 'q-pv': pv });

      await load();

      expect(cmp.isMultiSource()).toBe(true);
      expect(cmp.categories()[0]).toBe('First day');
      expect(cmp.categories()[1]).not.toBe('First day');
      expect(cmp.seriesData().map(s => s.name)).toEqual(['North', 'S', 'PV']);
      expect(cmp.seriesData().map(s => s.data)).toEqual([[3, 5], [4, 0], [7, 8]]);
    });

    it('shows the raw values without names', async () => {
      const { cmp, load } = setup(multi(), { 'q-main': grid, 'q-pv': pv });

      await load();

      expect(cmp.seriesData().map(s => s.name)).toEqual(['N', 'S', 'PV']);
      expect(cmp.categories()[0]).not.toBe(D1);
      expect(cmp.categories().length).toBe(2);
    });

    it('two raw categories with one name stay two categories and the tooltip of the second shows its own values', async () => {
      const { cmp, load } = setup(multi({ categoryLabels: { [D1]: 'Same', [D2]: 'Same' } }), { 'q-main': grid, 'q-pv': pv });

      await load();

      const [first, second] = cmp.categories();
      expect(first).toBe('Same');
      expect(second).toBe('Same (2)');
      expect(cmp.tooltipRows(first).map(r => r.text)).toEqual(['3', '4', '7']);
      expect(cmp.tooltipRows(second).map(r => r.text)).toEqual(['5', '0', '8']);
    });

    it('does not rename the static value fields of a multi-source chart', async () => {
      const { cmp, load } = setup(multi({ seriesGroupField: undefined, valueField: undefined, series: [{ field: 'importEnergy', name: 'Grid import' }], seriesLabels: { 'Grid import': 'Renamed', importEnergy: 'Renamed' } }), { 'q-main': grid, 'q-pv': pv });

      await load();

      expect(cmp.seriesData().map(s => s.name)).toEqual(['Grid import', 'PV']);
    });
  });
});
