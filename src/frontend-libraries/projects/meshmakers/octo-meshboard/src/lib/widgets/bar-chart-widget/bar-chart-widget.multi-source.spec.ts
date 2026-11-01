import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BarChartWidgetComponent } from './bar-chart-widget.component';
import { QueryExecutorService, QueryResultRow } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { BarChartWidgetConfig, LineChartFormulaSeries, LineChartQuerySeries } from '../../models/meshboard.models';
import { StreamDataScope } from '../../utils/stream-data-scope';

/**
 * Multi-source bar chart (AB#7953): the EnergyIQ daily values (AB#7945). Primary query = grid
 * (import / export per day, category cell `day`); query series PV, battery charge / discharge
 * (category = row timestamp); formula consumption = pv + gridImport - gridExport + batteryDischarge
 * - batteryCharge. Grid operands are hidden query series (primary series are no operands, as in the
 * line chart).
 */

const D = ['2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', '2026-10-03T00:00:00Z'];

function gridRow(day: string, imp: number | null, exp: number | null): QueryResultRow {
  return { __typename: 'StreamDataQueryRow', cells: [{ attributePath: 'day', value: day as unknown as number }, { attributePath: 'importEnergy', value: imp }, { attributePath: 'exportEnergy', value: exp }] };
}

function sdRow(timestamp: string, value: number | null, column = 'energy'): QueryResultRow {
  return { __typename: 'StreamDataQueryRow', timestamp: timestamp as unknown as Date, cells: [{ attributePath: column, value }] };
}

function result(rows: QueryResultRow[]) {
  return of({ family: 'streamData' as const, queryRtId: 'q', associatedCkTypeId: null, columns: [], rows, totalCount: rows.length, hasNextPage: false, endCursor: null });
}

function query(key: string, extra: Partial<LineChartQuerySeries> = {}): LineChartQuerySeries {
  return {
    kind: 'query', key, valueField: 'energy', categoryField: 'timestamp',
    dataSource: { type: 'persistentQuery', queryRtId: `q-${key}`, queryName: key, queryFamily: 'streamData', entitySelectorId: key },
    ...extra
  };
}

function formula(key: string, f: string, extra: Partial<LineChartFormulaSeries> = {}): LineChartFormulaSeries {
  return { kind: 'formula', key, formula: f, ...extra };
}

// Grid has day 1 and 3, PV days 1–3, battery days 1–2.
const GRID = [gridRow(D[2], 4, 2), gridRow(D[0], 3, 0)];
const PV = [sdRow(D[0], 5), sdRow(D[1], 8), sdRow(D[2], 6)];
const BAT_CHARGE = [sdRow(D[0], 1), sdRow(D[1], 2)];
const BAT_DISCHARGE = [sdRow(D[0], 0.5), sdRow(D[1], 0)];

const CONSUMPTION = formula('consumption', '${pv} + ${gridImport} - ${gridExport} + ${batteryDischarge} - ${batteryCharge}', { label: 'Consumption' });

function dailyConfig(overrides: Partial<BarChartWidgetConfig> = {}): BarChartWidgetConfig {
  return {
    id: 'w1', type: 'barChart', title: 'Daily values', col: 1, row: 1, colSpan: 4, rowSpan: 2,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-grid', queryName: 'Grid', queryFamily: 'streamData', entitySelectorId: 'netz' },
    chartType: 'column', categoryField: 'day',
    series: [{ field: 'importEnergy', name: 'Grid import' }, { field: 'exportEnergy', name: 'Grid export', color: '#123456' }],
    additionalSeries: [
      query('pv', { label: 'PV' }),
      query('gridImport', { valueField: 'importEnergy', categoryField: 'day', visible: false, dataSource: { type: 'persistentQuery', queryRtId: 'q-grid', queryFamily: 'streamData', entitySelectorId: 'netz' } }),
      query('gridExport', { valueField: 'exportEnergy', categoryField: 'day', visible: false, dataSource: { type: 'persistentQuery', queryRtId: 'q-grid', queryFamily: 'streamData', entitySelectorId: 'netz' } }),
      query('batteryCharge', { visible: false }),
      query('batteryDischarge', { visible: false }),
      CONSUMPTION
    ],
    ...overrides
  };
}

const ROWS: Record<string, QueryResultRow[] | Error> = {
  'q-grid': GRID, 'q-pv': PV, 'q-batteryCharge': BAT_CHARGE, 'q-batteryDischarge': BAT_DISCHARGE
};

function setup(config: BarChartWidgetConfig, rowsByQuery: Record<string, QueryResultRow[] | Error> = ROWS, scopes: Record<string, StreamDataScope> = {}) {
  const execute = vi.fn((_family: string, queryRtId: string) => {
    const r = rowsByQuery[queryRtId];
    return r instanceof Error ? throwError(() => r) : result(r ?? []);
  });
  TestBed.configureTestingModule({
    imports: [BarChartWidgetComponent],
    providers: [
      { provide: QueryExecutorService, useValue: { execute } },
      {
        provide: MeshBoardStateService,
        useValue: {
          resolveStreamDataScope: vi.fn((id?: string): StreamDataScope => (id && scopes[id]) || { kind: 'unscoped' }),
          resolveStreamDataRtIds: vi.fn(() => undefined),
          resolveStreamDataTimeArgs: vi.fn(() => ({ from: new Date(D[0]), to: new Date('2026-10-04T00:00:00Z') })),
          timeZoneMode: vi.fn(() => 'utc'),
          getVariables: vi.fn(() => [])
        }
      },
      { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn(() => undefined) } }
    ]
  });
  const fixture = TestBed.createComponent(BarChartWidgetComponent);
  const cmp = fixture.componentInstance;
  cmp.config = config;
  return {
    cmp, execute,
    load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData(),
    render: async (): Promise<HTMLElement> => {
      fixture.detectChanges();
      await vi.waitFor(() => expect(cmp.isLoading()).toBe(false));
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }
  };
}

function data(cmp: BarChartWidgetComponent, name: string): unknown[] | undefined {
  return cmp.seriesData().find(s => s.name === name)?.data;
}

describe('BarChartWidgetComponent multi-source (AB#7953)', () => {
  it('matches bars of all sources per day; a day a source lacks has no bar, never a 0 bar', async () => {
    const s = setup(dailyConfig());
    await s.load();

    expect(s.cmp.isMultiSource()).toBe(true);
    // Union of days, chronological; daily categories shown as dates.
    expect(s.cmp.categories()).toEqual(['01.10.2026', '02.10.2026', '03.10.2026']);
    expect(s.cmp.seriesData().map(x => x.name)).toEqual(['Grid import', 'Grid export', 'PV', 'Consumption']);
    expect(data(s.cmp, 'Grid import')).toEqual([3, null, 4]);
    expect(data(s.cmp, 'Grid export')).toEqual([0, null, 2]);
    expect(data(s.cmp, 'PV')).toEqual([5, 8, 6]);
    // Static series colour is kept; other series use the Kendo palette.
    expect(s.cmp.seriesData().find(x => x.name === 'Grid export')?.color).toBe('#123456');
    expect(s.cmp.seriesData().find(x => x.name === 'PV')?.color).toBeUndefined();
  });

  it('evaluates the formula per category; a missing operand is no bar and "–" in the tooltip', async () => {
    const s = setup(dailyConfig());
    await s.load();

    // Day 1: 5 + 3 - 0 + 0.5 - 1 = 7.5; day 2: grid missing → null; day 3: battery missing → null.
    expect(data(s.cmp, 'Consumption')).toEqual([7.5, null, null]);
    const rows = s.cmp.tooltipRows('02.10.2026');
    expect(rows.find(r => r.name === 'Consumption')?.text).toBe('–');
    expect(rows.find(r => r.name === 'Grid import')?.text).toBe('–');
    expect(rows.find(r => r.name === 'PV')?.text).toBe('8');
  });

  it('hidden operands are used by formulas but absent from chart and legend; hidden primary too', async () => {
    const s = setup(dailyConfig({ primarySeries: { visible: false } }));
    await s.load();
    expect(s.cmp.seriesData().map(x => x.name)).toEqual(['PV', 'Consumption']);
    expect(data(s.cmp, 'Consumption')).toEqual([7.5, null, null]);
  });

  it('valueScale is applied to source values before formulas see them', async () => {
    const s = setup(dailyConfig({ valueScale: 2 }));
    await s.load();
    expect(data(s.cmp, 'PV')).toEqual([10, 16, 12]);
    expect(data(s.cmp, 'Grid import')).toEqual([6, null, 8]);
    expect(data(s.cmp, 'Consumption')).toEqual([15, null, null]);
  });

  it.each(['column', 'bar', 'stackedColumn', 'stackedBar', 'stackedColumn100', 'stackedBar100'] as const)(
    'works with chart type %s (same series, Kendo type and stack from the chart type)', async chartType => {
      const s = setup(dailyConfig({ chartType }));
      await s.load();
      expect(data(s.cmp, 'Consumption')).toEqual([7.5, null, null]);
      expect(s.cmp.kendoChartType()).toBe(chartType.toLowerCase().includes('bar') ? 'bar' : 'column');
      expect(s.cmp.stackConfig()).toBe(chartType.endsWith('100') ? '100%' : chartType.startsWith('stacked'));
    });

  it('one failing source: the others render, a per-source error hint, dependent formulas say so', async () => {
    const s = setup(dailyConfig(), { ...ROWS, 'q-batteryCharge': new Error('timeout') });
    await s.load();

    const texts = s.cmp.sourceHints().map(h => h.text);
    expect(texts).toContain('batteryCharge: Failed to load data (timeout)');
    expect(texts).toContain('Consumption: depends on batteryCharge, which failed');
    expect(data(s.cmp, 'PV')).toEqual([5, 8, 6]);
    expect(s.cmp.seriesData().map(x => x.name)).toContain('Consumption (no data)');

    const el = await s.render();
    const rendered = Array.from(el.querySelectorAll('.source-hint')).map(h => h.textContent?.trim());
    expect(rendered).toContain('⚠ Consumption: depends on batteryCharge, which failed');
    expect(el.querySelector('.source-hint.error')?.textContent).toContain('batteryCharge: Failed to load data');
  });

  it('a failing primary query: the query series still render', async () => {
    const s = setup(dailyConfig({ additionalSeries: [query('pv', { label: 'PV' })] }), { ...ROWS, 'q-grid': new Error('boom') });
    await s.load();
    expect(s.cmp.error()).toBeNull();
    expect(s.cmp.seriesData().map(x => x.name)).toEqual(['PV']);
    expect(s.cmp.sourceHints().map(h => h.text)).toContain('Grid: Failed to load data (boom)');
  });

  it('each source follows its own selector; a pending scope sends no query, an empty one says "No data"', async () => {
    const pending = setup(dailyConfig(), ROWS, { pv: { kind: 'pending' } });
    await pending.load();
    expect(pending.execute).not.toHaveBeenCalled();
    expect(pending.cmp.isLoading()).toBe(true);

    TestBed.resetTestingModule();
    const empty = setup(dailyConfig(), ROWS, { pv: { kind: 'empty', reason: 'noTargets' } });
    await empty.load();
    expect(empty.execute.mock.calls.map(c => c[1])).not.toContain('q-pv');
    expect(empty.cmp.sourceHints().map(h => h.text)).toContain('No data for PV');
    // An empty scope is no data, not a failure: the formula has no operand values, no dependency hint.
    expect(empty.cmp.sourceHints().some(h => h.kind === 'dependency')).toBe(false);
    expect(empty.cmp.seriesData().map(x => x.name)).toContain('Consumption (no data)');
  });

  it('passes the scope rtIds of each source to its own query', async () => {
    const s = setup(dailyConfig({ additionalSeries: [query('pv')] }), ROWS, { pv: { kind: 'scoped', rtIds: ['pv-1', 'pv-2'] } });
    await s.load();
    const pvCall = s.execute.mock.calls.find(c => c[1] === 'q-pv') as unknown as [string, string, { scopeRtIds?: string[] }];
    expect(pvCall[2].scopeRtIds).toEqual(['pv-1', 'pv-2']);
  });

  it('an incomplete query series (no category field) does not switch to the multi-source path', () => {
    const s = setup(dailyConfig({ additionalSeries: [query('pv', { categoryField: '' })] }));
    expect(s.cmp.hasAdditionalSeries()).toBe(false);
  });
});

describe('BarChartWidgetComponent single source unchanged (AB#7953 regression)', () => {
  function single(config: Partial<BarChartWidgetConfig>, rows: QueryResultRow[]) {
    return setup({
      id: 'w', type: 'barChart', title: 't', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: { type: 'persistentQuery', queryRtId: 'q-x', queryFamily: 'runtime' },
      chartType: 'column', categoryField: 'cat', series: [],
      ...config
    } as BarChartWidgetConfig, { 'q-x': rows });
  }

  function rtRow(cells: Record<string, unknown>): QueryResultRow {
    return { __typename: 'RtGroupingAggregationQueryRow', cells: Object.entries(cells).map(([attributePath, value]) => ({ attributePath, value: value as number })) };
  }

  it('static mode: categories in row order (no sorting, duplicates kept), missing cell 0, null cell no bar, no valueScale', async () => {
    const s = single({ series: [{ field: 'a', name: 'A' }, { field: 'b' }], valueScale: 10 }, [
      rtRow({ cat: 'Z', a: 1, b: null }),
      rtRow({ cat: 'A', a: 2 }),
      rtRow({ cat: 'Z', a: 3, b: 4 })
    ]);
    await s.load();
    expect(s.cmp.isMultiSource()).toBe(false);
    expect(s.cmp.categories()).toEqual(['Z', 'A', 'Z']);
    expect(s.cmp.seriesData()).toEqual([
      { name: 'A', data: [1, 2, 3], color: undefined },
      { name: 'b', data: [null, 0, 4], color: undefined }
    ]);
    expect(s.cmp.sourceHints()).toEqual([]);
  });

  it('dynamic mode: series per group, missing combination 0, valueScale applied', async () => {
    const s = single({ seriesGroupField: 'g', valueField: 'v', valueScale: 2 }, [
      rtRow({ cat: 'Company', g: 'Credit', v: 10 }),
      rtRow({ cat: 'Company', g: 'Debit', v: 5 }),
      rtRow({ cat: 'Person', g: 'Credit', v: 1 })
    ]);
    await s.load();
    expect(s.cmp.categories()).toEqual(['Company', 'Person']);
    expect(s.cmp.seriesData()).toEqual([
      { name: 'Credit', data: [20, 2] },
      { name: 'Debit', data: [10, 0] }
    ]);
  });

  it('sends exactly one query, as before', async () => {
    const s = single({ series: [{ field: 'a' }] }, [rtRow({ cat: 'x', a: 1 })]);
    await s.load();
    expect(s.execute).toHaveBeenCalledTimes(1);
  });
});
