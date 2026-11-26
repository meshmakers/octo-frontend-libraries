import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { PieChartWidgetComponent } from './pie-chart-widget/pie-chart-widget.component';
import { BarChartWidgetComponent } from './bar-chart-widget/bar-chart-widget.component';
import { LineChartWidgetComponent } from './line-chart-widget/line-chart-widget.component';
import { QueryExecutorService, QueryResultRow } from '../services/query-executor.service';
import { MeshBoardDataService } from '../services/meshboard-data.service';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { MeshBoardVariableService } from '../services/meshboard-variable.service';
import { MESHBOARD_LANGUAGE } from '../utils/meshboard-language';
import { BarChartWidgetConfig, LineChartQuerySeries, LineChartWidgetConfig, PieChartWidgetConfig } from '../models/meshboard.models';

/**
 * Author texts of the pie, bar and line chart per UI language: category and series names, series
 * legend names, the data-label suffix, the value axis title and reference line labels. Each case
 * names the acceptance criterion it proves:
 * - AC 1: the text of the viewer's language is shown, and follows a language switch;
 * - AC 2: without a translation (no language, no entry for it) the single text is shown as before.
 */
describe('Chart widget texts per language', () => {
  const FEED_IN = '1-1:2.9.0 G.03';
  const SURPLUS = '1-1:2.9.0 P.01T';

  let language: WritableSignal<string | null>;

  function row(cells: Record<string, unknown>): QueryResultRow {
    return { __typename: 'StreamDataQueryRow', cells: Object.entries(cells).map(([attributePath, value]) => ({ attributePath, value })) } as QueryResultRow;
  }

  function providers(rowsByQuery: Record<string, QueryResultRow[]>, withLanguage: boolean, timeArgs?: { from: Date; to: Date }) {
    const execute = vi.fn((_family: string, queryRtId: string) => {
      const rows = rowsByQuery[queryRtId] ?? [];
      return of({ family: 'streamData' as const, queryRtId, associatedCkTypeId: null, columns: (rows[0]?.cells ?? []).map(c => ({ attributePath: c.attributePath })), rows, totalCount: rows.length, hasNextPage: false, endCursor: null });
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: QueryExecutorService, useValue: { execute } },
        { provide: MeshBoardDataService, useValue: {} },
        {
          provide: MeshBoardStateService,
          useValue: {
            resolveStreamDataScope: vi.fn().mockReturnValue({ kind: 'scoped', rtIds: ['rt-1'] }),
            resolveStreamDataRtIds: vi.fn().mockReturnValue(['rt-1']),
            resolveStreamDataTimeArgs: vi.fn().mockReturnValue(timeArgs),
            resolveStreamDataTimeZone: vi.fn().mockReturnValue('UTC'),
            timeZoneMode: vi.fn().mockReturnValue('utc'),
            getVariables: vi.fn().mockReturnValue([])
          }
        },
        { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined) } },
        ...(withLanguage ? [{ provide: MESHBOARD_LANGUAGE, useValue: language }] : [])
      ]
    });
    return execute;
  }

  beforeEach(() => {
    language = signal<string | null>('de-AT');
  });

  describe('pie chart category names', () => {
    const rows = [row({ obisCode: FEED_IN, energy_sum: 10 }), row({ obisCode: SURPLUS, energy_sum: 4 })];

    function pie(overrides: Partial<PieChartWidgetConfig>, withLanguage = true) {
      const execute = providers({ q1: rows }, withLanguage);
      const cmp = TestBed.createComponent(PieChartWidgetComponent).componentInstance;
      cmp.config = {
        id: 'w1', type: 'pieChart', title: 'Energy', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource: { type: 'persistentQuery', queryRtId: 'q1', queryFamily: 'streamData', entitySelectorId: 'mp' },
        chartType: 'pie', categoryField: 'obisCode', valueField: 'energy_sum',
        ...overrides
      };
      return { cmp, execute, load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData() };
    }

    it('AC 1: a per-language slice name is shown in the viewer language and follows a switch without a new query', async () => {
      const { cmp, execute, load } = pie({ categoryLabels: { [FEED_IN]: { 'de-AT': 'Einspeisung', 'en-GB': 'Feed-in' }, [SURPLUS]: 'Surplus' } });
      await load();
      expect(cmp.chartData().map(item => item.category)).toEqual(['Einspeisung', 'Surplus']);

      language.set('en-GB');
      expect(cmp.chartData().map(item => item.category)).toEqual(['Feed-in', 'Surplus']);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('AC 2: without an entry for the language the slice shows the raw value as without a name', async () => {
      language.set('fr-FR');
      const plain = pie({});
      await plain.load();
      const before = plain.cmp.chartData().map(item => item.category);
      TestBed.resetTestingModule();

      const { cmp, load } = pie({ categoryLabels: { [FEED_IN]: { 'de-AT': 'Einspeisung' } } });
      await load();
      expect(cmp.chartData().map(item => item.category)).toEqual(before);
    });
  });

  describe('bar chart', () => {
    function bar(overrides: Partial<BarChartWidgetConfig>, rowsByQuery: Record<string, QueryResultRow[]>, withLanguage = true) {
      const execute = providers(rowsByQuery, withLanguage);
      const fixture = TestBed.createComponent(BarChartWidgetComponent);
      const cmp = fixture.componentInstance;
      cmp.config = {
        id: 'w1', type: 'barChart', title: 'Energy', col: 1, row: 1, colSpan: 4, rowSpan: 2,
        dataSource: { type: 'persistentQuery', queryRtId: 'q-main', queryFamily: 'streamData' },
        chartType: 'column', categoryField: 'obisCode', series: [{ field: 'energy_sum', name: 'Energy' }],
        ...overrides
      };
      return { cmp, fixture, execute, load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData() };
    }

    const staticRows = [row({ obisCode: FEED_IN, energy_sum: 10 }), row({ obisCode: SURPLUS, energy_sum: 4 })];

    it('AC 1: category names, series name and data-label suffix appear in the viewer language', async () => {
      const { cmp, load } = bar({
        categoryLabels: { [FEED_IN]: { 'de-AT': 'Einspeisung', 'en-GB': 'Feed-in' } },
        series: [{ field: 'energy_sum', name: 'Energy', names: { 'de-AT': 'Energie' } }],
        dataLabelSuffix: ' kWh', dataLabelSuffixes: { 'de-AT': ' kWh (de)' }
      }, { 'q-main': staticRows });

      await load();

      expect(cmp.categories()).toEqual(['Einspeisung', SURPLUS]);
      expect(cmp.seriesData().map(s => s.name)).toEqual(['Energie']);
      expect(cmp.dataLabelFormat()).toBe('{0:n0} kWh (de)');
    });

    it('AC 1: a language switch shows the names of the new language', async () => {
      const { cmp, fixture, load } = bar({
        categoryLabels: { [FEED_IN]: { 'de-AT': 'Einspeisung', 'en-GB': 'Feed-in' } },
        series: [{ field: 'energy_sum', name: 'Energy', names: { 'de-AT': 'Energie', 'en-GB': 'Energy (GB)' } }]
      }, { 'q-main': staticRows });
      await load();
      fixture.detectChanges();

      language.set('en-GB');
      fixture.detectChanges();
      await vi.waitFor(() => expect(cmp.categories()).toEqual(['Feed-in', SURPLUS]));
      expect(cmp.seriesData().map(s => s.name)).toEqual(['Energy (GB)']);
    });

    it('AC 1: a language switch loads the data again, so the series names baked into the loaded series follow', async () => {
      const { cmp, fixture, execute } = bar({
        series: [{ field: 'energy_sum', name: 'Energy', names: { 'de-AT': 'Energie', 'en-GB': 'Energy (GB)' } }]
      }, { 'q-main': staticRows });
      fixture.detectChanges();
      await vi.waitFor(() => expect(cmp.seriesData().map(s => s.name)).toEqual(['Energie']));
      const queriesBefore = execute.mock.calls.length;

      language.set('en-GB');
      fixture.detectChanges();

      await vi.waitFor(() => expect(execute.mock.calls.length).toBe(queriesBefore + 1));
      await vi.waitFor(() => expect(cmp.seriesData().map(s => s.name)).toEqual(['Energy (GB)']));
    });

    it.each([
      ['one query', {}],
      ['additional series', { additionalSeries: [{
        kind: 'query' as const, key: 'pv', label: 'PV', categoryField: 'obisCode', valueField: 'energy_sum', visible: false,
        dataSource: { type: 'persistentQuery' as const, queryRtId: 'q-pv', queryFamily: 'streamData' as const }
      }] }]
    ])('AC 1: a load started before a language switch that answers last does not overwrite the newer chart (%s)', async (_mode, extra) => {
      const { cmp, execute, load } = bar({
        series: [{ field: 'energy_sum', name: 'Energy', names: { 'de-AT': 'Energie', 'en-GB': 'Energy (GB)' } }],
        ...extra
      }, { 'q-main': staticRows, 'q-pv': staticRows });
      const slow = new Subject<unknown>();
      execute.mockImplementationOnce(() => slow as never);

      const older = load();
      language.set('en-GB');
      await load();
      expect(cmp.seriesData().map(s => [s.name, s.data])).toEqual([['Energy (GB)', [10, 4]]]);

      slow.next({ family: 'streamData', queryRtId: 'q-main', associatedCkTypeId: null, columns: [], rows: [row({ obisCode: FEED_IN, energy_sum: 99 })], totalCount: 1, hasNextPage: false, endCursor: null });
      slow.complete();
      await older;

      expect(cmp.seriesData().map(s => [s.name, s.data])).toEqual([['Energy (GB)', [10, 4]]]);
    });

    it('AC 1 / AC 2: with additional series, their labels and the static series names follow the language, else the single texts', async () => {
      const additional = {
        kind: 'query' as const, key: 'pv', label: 'PV', labels: { 'de-AT': 'Photovoltaik' },
        categoryField: 'obisCode', valueField: 'energy_sum',
        dataSource: { type: 'persistentQuery' as const, queryRtId: 'q-pv', queryFamily: 'streamData' as const }
      };
      const german = bar({
        additionalSeries: [additional],
        series: [{ field: 'energy_sum', name: 'Energy', names: { 'de-AT': 'Energie' }, color: '#123456' }]
      }, { 'q-main': staticRows, 'q-pv': staticRows });
      await german.load();
      expect(german.cmp.seriesData().map(s => s.name)).toEqual(['Energie', 'Photovoltaik']);
      expect(german.cmp.seriesData()[0].color).toBe('#123456');

      TestBed.resetTestingModule();
      language.set('fr-FR');
      const fallback = bar({ additionalSeries: [additional] }, { 'q-main': staticRows, 'q-pv': staticRows });
      await fallback.load();
      expect(fallback.cmp.seriesData().map(s => s.name)).toEqual(['Energy', 'PV']);
    });

    it('AC 1: dynamic series names per language name the legend entries', async () => {
      const rows = [
        row({ day: 'Mon', obisCode: FEED_IN, energy: 1 }),
        row({ day: 'Mon', obisCode: SURPLUS, energy: 2 })
      ];
      const { cmp, load } = bar({
        categoryField: 'day', seriesGroupField: 'obisCode', valueField: 'energy', series: [],
        seriesLabels: { [FEED_IN]: { 'de-AT': 'Einspeisung' }, [SURPLUS]: 'Surplus' }
      }, { 'q-main': rows });

      await load();

      expect(cmp.seriesData().map(s => s.name)).toEqual(['Einspeisung', 'Surplus']);
    });

    it('AC 2: without a host language the single texts are shown exactly as before', async () => {
      const { cmp, load } = bar({
        categoryLabels: { [FEED_IN]: 'Feed-in' },
        series: [{ field: 'energy_sum', name: 'Energy', names: { 'de-AT': 'Energie' } }],
        dataLabelSuffix: ' kWh', dataLabelSuffixes: { 'de-AT': ' kWh (de)' }
      }, { 'q-main': staticRows }, false);

      await load();

      expect(cmp.categories()).toEqual(['Feed-in', SURPLUS]);
      expect(cmp.seriesData().map(s => s.name)).toEqual(['Energy']);
      expect(cmp.dataLabelFormat()).toBe('{0:n0} kWh');
    });
  });

  describe('line chart', () => {
    const HOURS = ['2026-10-20T10:00:00', '2026-10-20T11:00:00', '2026-10-20T12:00:00'];
    const rows = HOURS.flatMap((hour, i) => [
      row({ window_start: hour, obisCode: FEED_IN, energy: i + 1 }),
      row({ window_start: hour, obisCode: SURPLUS, energy: i + 4 })
    ]);

    function line(overrides: Partial<LineChartWidgetConfig>, rowsByQuery: Record<string, QueryResultRow[]>, withLanguage = true, timeArgs?: { from: Date; to: Date }) {
      const execute = providers(rowsByQuery, withLanguage, timeArgs);
      const fixture = TestBed.createComponent(LineChartWidgetComponent);
      const cmp = fixture.componentInstance;
      cmp.config = {
        id: 'w1', type: 'lineChart', title: 'Energy', col: 1, row: 1, colSpan: 4, rowSpan: 2,
        dataSource: { type: 'persistentQuery', queryRtId: 'q-main', queryFamily: 'streamData' },
        chartType: 'line', categoryField: 'window_start', seriesGroupField: 'obisCode', valueField: 'energy',
        ...overrides
      };
      return { cmp, fixture, execute, load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData() };
    }

    it('AC 1: a language switch loads the data again, so the series names baked into the loaded series follow', async () => {
      const { cmp, fixture, execute } = line({
        seriesLabels: { [FEED_IN]: { 'de-AT': 'Einspeisung', 'en-GB': 'Feed-in' } }
      }, { 'q-main': rows });
      fixture.detectChanges();
      await vi.waitFor(() => expect(cmp.seriesData().map(s => s.name)).toEqual(['Einspeisung', SURPLUS]));
      const queriesBefore = execute.mock.calls.length;

      language.set('en-GB');
      fixture.detectChanges();

      await vi.waitFor(() => expect(execute.mock.calls.length).toBe(queriesBefore + 1));
      await vi.waitFor(() => expect(cmp.seriesData().map(s => s.name)).toEqual(['Feed-in', SURPLUS]));
    });

    it('AC 1: series names, value axis title and reference line label appear in the viewer language', async () => {
      const { cmp, load } = line({
        seriesLabels: { [FEED_IN]: { 'de-AT': 'Einspeisung', 'en-GB': 'Feed-in' } },
        valueAxisTitle: 'Energy', valueAxisTitles: { 'de-AT': 'Energie' },
        referenceLines: [{ value: 5, label: 'Limit', labels: { 'de-AT': 'Grenze' } }]
      }, { 'q-main': rows });

      await load();

      expect(cmp.seriesData().map(s => s.name)).toEqual(['Einspeisung', SURPLUS]);
      expect(cmp.valueAxisTitle()).toBe('Energie');
      expect(cmp.plotBands()[0].label?.text).toBe('Grenze');
    });

    it('AC 1: the legend label of an additional query series appears in the viewer language', async () => {
      const second: LineChartQuerySeries = {
        kind: 'query', key: 'pv', label: 'PV', labels: { 'de-AT': 'Photovoltaik' }, valueField: 'power',
        dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData', entitySelectorId: 'pv' }
      };
      const dsRow = (timestamp: string, value: number, valueColumn: string, group?: string): QueryResultRow => {
        const cells = [{ attributePath: `${valueColumn}_avg`, value }] as { attributePath: string; value: unknown }[];
        if (group) cells.push({ attributePath: 'obiscode_max', value: group });
        return { __typename: 'StreamDataQueryRow', rtId: 'r', timestamp: timestamp as unknown as Date, cells } as QueryResultRow;
      };
      const { cmp, load } = line({ additionalSeries: [second], categoryField: 'timestamp' }, {
        'q-main': HOURS.map((hour, i) => dsRow(hour, i + 1, 'energy', FEED_IN)),
        'q-pv': HOURS.map((hour, i) => dsRow(hour, i + 10, 'power'))
      }, true, { from: new Date('2026-10-20T10:00:00Z'), to: new Date('2026-10-20T13:00:00Z') });

      await load();

      expect(cmp.seriesData().map(s => s.name)).toContain('Photovoltaik');
      expect(cmp.seriesData().map(s => s.name)).not.toContain('PV');
    });

    it('AC 2: without a host language the single title, label and raw series names are shown', async () => {
      const { cmp, load } = line({
        seriesLabels: { [FEED_IN]: { 'de-AT': 'Einspeisung' } },
        valueAxisTitle: 'Energy', valueAxisTitles: { 'de-AT': 'Energie' },
        referenceLines: [{ value: 5, label: 'Limit', labels: { 'de-AT': 'Grenze' } }]
      }, { 'q-main': rows }, false);

      await load();

      expect(cmp.seriesData().map(s => s.name)).toEqual([FEED_IN, SURPLUS]);
      expect(cmp.valueAxisTitle()).toBe('Energy');
      expect(cmp.plotBands()[0].label?.text).toBe('Limit');
    });
  });
});
