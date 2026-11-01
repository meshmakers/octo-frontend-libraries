import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LineChartWidgetComponent } from './line-chart-widget.component';
import { QueryExecutorService, QueryResultRow, SeriesResolutionResult } from '../../services/query-executor.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { LineChartQuerySeries, LineChartWidgetConfig } from '../../models/meshboard.models';
import { StreamDataScope } from '../../utils/stream-data-scope';
import { CkRollupFunctionDto, QueryModeDto, SeriesResolutionSignalDto } from '@meshmakers/octo-services';

/**
 * Multi-source line chart (AB#7951): grid import (primary), PV and battery from three archives,
 * each following its own entity selector, on one time grid.
 */

const FROM = new Date('2026-10-20T10:00:00Z');
const TO = new Date('2026-10-20T11:00:00Z');

/** A downsampled stream-data row as the backend returns it for a persisted query. */
function dsRow(timestamp: string, value: number | null, valueColumn: string, group?: string): QueryResultRow {
  const cells = [{ attributePath: `${valueColumn}_avg`, value }];
  if (group) cells.push({ attributePath: 'obiscode_max', value: group as unknown as number });
  return { __typename: 'StreamDataQueryRow', rtId: 'r', timestamp: timestamp as unknown as Date, cells };
}

function result(rows: QueryResultRow[]) {
  return of({ family: 'streamData' as const, queryRtId: 'q', associatedCkTypeId: null, columns: [], rows, totalCount: rows.length, hasNextPage: false, endCursor: null });
}

const PV: LineChartQuerySeries = {
  kind: 'query', key: 'pv', label: 'PV', valueField: 'power',
  dataSource: { type: 'persistentQuery', queryRtId: 'q-pv', queryFamily: 'streamData', entitySelectorId: 'pv' }
};
const BATTERY: LineChartQuerySeries = {
  kind: 'query', key: 'battery', label: 'Battery', valueField: 'dischargePower',
  dataSource: { type: 'persistentQuery', queryRtId: 'q-bat', queryFamily: 'streamData', entitySelectorId: 'batterie' }
};

function chartConfig(overrides: Partial<LineChartWidgetConfig> = {}): LineChartWidgetConfig {
  return {
    id: 'w1', type: 'lineChart', title: 'Profile', col: 1, row: 1, colSpan: 3, rowSpan: 2,
    dataSource: { type: 'persistentQuery', queryRtId: 'q-grid', queryName: 'Grid', queryFamily: 'streamData', entitySelectorId: 'netz' },
    chartType: 'area', categoryField: 'timestamp', seriesGroupField: 'obisCode', valueField: 'importPower',
    additionalSeries: [PV, BATTERY],
    ...overrides
  };
}

interface Setup {
  cmp: LineChartWidgetComponent;
  execute: ReturnType<typeof vi.fn>;
  downsampleByArchive: ReturnType<typeof vi.fn>;
  resolveSeriesQuery: ReturnType<typeof vi.fn>;
  state: { scopes: Record<string, StreamDataScope>; timeArgs: { from: Date; to: Date } | undefined; zone: string };
  load(): Promise<void>;
  /** Renders the widget the way a board does: the first change detection starts its own load. */
  render(): Promise<HTMLElement>;
}

function setup(config: LineChartWidgetConfig, rowsByQuery: Record<string, QueryResultRow[] | Error>): Setup {
  const state = {
    scopes: {
      netz: { kind: 'scoped', rtIds: ['grid-1'] },
      pv: { kind: 'scoped', rtIds: ['pv-1'] },
      batterie: { kind: 'scoped', rtIds: ['bat-1'] }
    } as Record<string, StreamDataScope>,
    timeArgs: { from: FROM, to: TO } as { from: Date; to: Date } | undefined,
    zone: 'utc'
  };
  const execute = vi.fn((_family: string, queryRtId: string) => {
    const rows = rowsByQuery[queryRtId];
    return rows instanceof Error ? throwError(() => rows) : result(rows ?? []);
  });
  const downsampleByArchive = vi.fn().mockResolvedValue([]);
  const resolveSeriesQuery = vi.fn();
  const queryExecutor = {
    execute,
    downsampleByArchive,
    resolveSeriesQuery,
    fetchQueryArchive: vi.fn(async (rtId: string) => ({ archiveRtId: `archive-${rtId}`, ckTypeId: null, rtIds: null })),
    fetchSeriesLabels: vi.fn().mockResolvedValue(new Map()),
    fetchEntityGroups: vi.fn().mockResolvedValue(new Map())
  };
  const stateService = {
    resolveStreamDataScope: vi.fn((id?: string) => (id ? state.scopes[id] : undefined) ?? { kind: 'unscoped' }),
    resolveStreamDataRtIds: vi.fn((id?: string) => {
      const scope = id ? state.scopes[id] : undefined;
      return scope?.kind === 'scoped' ? scope.rtIds : undefined;
    }),
    resolveStreamDataTimeArgs: vi.fn(() => state.timeArgs),
    resolveStreamDataTimeZone: vi.fn(() => 'UTC'),
    timeZoneMode: vi.fn(() => state.zone),
    getVariables: vi.fn(() => [])
  };
  TestBed.configureTestingModule({
    imports: [LineChartWidgetComponent],
    providers: [
      { provide: QueryExecutorService, useValue: queryExecutor },
      { provide: MeshBoardStateService, useValue: stateService },
      { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn(() => undefined) } }
    ]
  });
  const fixture = TestBed.createComponent(LineChartWidgetComponent);
  const cmp = fixture.componentInstance;
  cmp.config = config;
  return {
    cmp, execute, downsampleByArchive, resolveSeriesQuery, state,
    load: () => (cmp as unknown as { loadData(): Promise<void> }).loadData(),
    render: async () => {
      fixture.detectChanges();
      await vi.waitFor(() => expect(cmp.isLoading()).toBe(false));
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }
  };
}

const GRID_ROWS = [
  dsRow('2026-10-20T10:00:00', 4, 'importpower', 'grid'),
  dsRow('2026-10-20T10:15:00', 5, 'importpower', 'grid'),
  dsRow('2026-10-20T10:30:00', 6, 'importpower', 'grid')
];
const PV_ROWS = [
  dsRow('2026-10-20T10:00:00', 1, 'power'),
  dsRow('2026-10-20T10:30:00', 3, 'power')
];
const BATTERY_ROWS = [
  dsRow('2026-10-20T10:00:00', 0.5, 'dischargepower'),
  dsRow('2026-10-20T10:15:00', 0.6, 'dischargepower'),
  dsRow('2026-10-20T10:30:00', 0.7, 'dischargepower')
];

describe('LineChartWidgetComponent multi-source (AB#7951)', () => {
  it('three sources on three archives share one category axis; a missing bucket is null', async () => {
    const s = setup(chartConfig(), { 'q-grid': GRID_ROWS, 'q-pv': PV_ROWS, 'q-bat': BATTERY_ROWS });

    await s.load();

    expect(s.cmp.categories().length).toBe(3);
    expect(s.cmp.seriesData().map(x => ({ name: x.name, data: x.data }))).toEqual([
      { name: 'grid', data: [4, 5, 6] },
      { name: 'PV', data: [1, null, 3] },
      { name: 'Battery', data: [0.5, 0.6, 0.7] }
    ]);
    expect(s.cmp.sourceHints()).toEqual([]);
    expect(s.cmp.isLoading()).toBe(false);
  });

  it('every source is downsampled over the same window with the same bucket count and its own selector scope', async () => {
    const s = setup(chartConfig(), { 'q-grid': GRID_ROWS, 'q-pv': PV_ROWS, 'q-bat': BATTERY_ROWS });

    await s.load();

    expect(s.execute).toHaveBeenCalledTimes(3);
    const args = s.execute.mock.calls.map(c => ({ rtId: c[1], ...c[2].streamDataArgs }));
    const limits = new Set(args.map(a => a.limit));
    expect(limits.size).toBe(1);
    expect(args).toEqual([
      expect.objectContaining({ rtId: 'q-grid', from: FROM, to: TO, rtIds: ['grid-1'], queryMode: QueryModeDto.DownsamplingDto }),
      expect.objectContaining({ rtId: 'q-pv', from: FROM, to: TO, rtIds: ['pv-1'], queryMode: QueryModeDto.DownsamplingDto }),
      expect.objectContaining({ rtId: 'q-bat', from: FROM, to: TO, rtIds: ['bat-1'], queryMode: QueryModeDto.DownsamplingDto })
    ]);
  });

  it('one failing source: the others render and the hint names the source and the message', async () => {
    const s = setup(chartConfig(), { 'q-grid': GRID_ROWS, 'q-pv': new Error('timeout'), 'q-bat': BATTERY_ROWS });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await s.load();

    expect(s.cmp.error()).toBeNull();
    expect(s.cmp.seriesData().map(x => x.name)).toEqual(['grid', 'Battery']);
    expect(s.cmp.sourceHints()).toEqual([{ kind: 'error', sourceLabel: 'PV', text: 'PV: Failed to load data (timeout)' }]);

    const el = await s.render();
    const hints = Array.from(el.querySelectorAll('.source-hint')).map(h => h.textContent?.trim());
    expect(hints).toEqual(['⚠ PV: Failed to load data (timeout)']);
    expect(el.querySelector('.source-hint')?.classList).toContain('error');
  });

  it('a source scoped to an empty selection: absent from the series, "No data for" hint, no query', async () => {
    const s = setup(chartConfig(), { 'q-grid': GRID_ROWS, 'q-pv': PV_ROWS, 'q-bat': BATTERY_ROWS });
    s.state.scopes['batterie'] = { kind: 'empty', reason: 'noTargets' };

    await s.load();

    expect(s.cmp.seriesData().map(x => x.name)).toEqual(['grid', 'PV']);
    expect(s.cmp.sourceHints()).toEqual([{ kind: 'noData', sourceLabel: 'Battery', text: 'No data for Battery' }]);
    expect(s.execute.mock.calls.map(c => c[1])).toEqual(['q-grid', 'q-pv']);
    const hint = (await s.render()).querySelector('.source-hint');
    expect(hint?.textContent?.trim()).toBe('No data for Battery');
  });

  it('a source that returns no rows gets the "No data for" hint too', async () => {
    const s = setup(chartConfig(), { 'q-grid': GRID_ROWS, 'q-pv': [], 'q-bat': BATTERY_ROWS });
    await s.load();
    expect(s.cmp.sourceHints()).toEqual([{ kind: 'noData', sourceLabel: 'PV', text: 'No data for PV' }]);
  });

  it('stays loading and sends no query while any source scope is pending', async () => {
    const s = setup(chartConfig(), { 'q-grid': GRID_ROWS, 'q-pv': PV_ROWS, 'q-bat': BATTERY_ROWS });
    s.state.scopes['pv'] = { kind: 'pending' };

    await s.load();

    expect(s.cmp.isLoading()).toBe(true);
    expect(s.execute).not.toHaveBeenCalled();
  });

  it('a source on a different grid is named in a hint and not plotted', async () => {
    const shifted = [dsRow('2026-10-20T10:05:00', 1, 'power'), dsRow('2026-10-20T10:20:00', 2, 'power'), dsRow('2026-10-20T10:35:00', 3, 'power')];
    const s = setup(chartConfig(), { 'q-grid': GRID_ROWS, 'q-pv': shifted, 'q-bat': BATTERY_ROWS });

    await s.load();

    expect(s.cmp.seriesData().map(x => x.name)).toEqual(['grid', 'Battery']);
    expect(s.cmp.sourceHints()).toEqual([{
      kind: 'misaligned', sourceLabel: 'PV', text: "PV: its buckets do not match the chart's time grid and are not shown"
    }]);
  });

  it('time filter and selector changes reload every source with the new window and scope', async () => {
    const s = setup(chartConfig(), { 'q-grid': GRID_ROWS, 'q-pv': PV_ROWS, 'q-bat': BATTERY_ROWS });
    await s.load();
    s.execute.mockClear();

    const from = new Date('2026-10-21T00:00:00Z');
    const to = new Date('2026-10-22T00:00:00Z');
    s.state.timeArgs = { from, to };
    s.state.scopes['pv'] = { kind: 'scoped', rtIds: ['pv-2'] };
    s.cmp.refresh();
    await vi.waitFor(() => expect(s.execute).toHaveBeenCalledTimes(3));

    expect(s.execute.mock.calls.map(c => [c[1], c[2].streamDataArgs.from, c[2].streamDataArgs.rtIds])).toEqual([
      ['q-grid', from, ['grid-1']], ['q-pv', from, ['pv-2']], ['q-bat', from, ['bat-1']]
    ]);
  });

  it('resolution-aware sources share the coarsest resolved bucket count', async () => {
    const ra = (s: LineChartQuerySeries): LineChartQuerySeries =>
      ({ ...s, dataSource: { ...s.dataSource, resolutionAware: true, requiredAggregation: 'AVG' } });
    const s = setup(chartConfig({ additionalSeries: [ra(PV), ra(BATTERY)] }), { 'q-grid': GRID_ROWS });
    const resolution = (points: number): SeriesResolutionResult => ({
      archiveRtId: `rollup-${points}`, effectiveBucketMs: 0, points, reducingFunction: CkRollupFunctionDto.AvgDto,
      signal: SeriesResolutionSignalDto.OkDto, actualPoints: null, diagnostic: null
    });
    s.resolveSeriesQuery.mockImplementation(async (input: { baseArchiveRtId: string }) =>
      input.baseArchiveRtId === 'archive-q-pv' ? resolution(288) : resolution(96));

    await s.load();

    // Grid (plain downsampling) and both resolution-aware sources use 96 buckets.
    expect(s.execute.mock.calls[0][2].streamDataArgs.limit).toBe(96);
    expect(s.downsampleByArchive.mock.calls.map(c => [c[0].archiveRtId, c[0].limit, c[0].rtIds, c[0].sourcePath])).toEqual([
      ['rollup-288', 96, ['pv-1'], 'power'],
      ['rollup-96', 96, ['bat-1'], 'dischargePower']
    ]);
  });

  it('a resolution-aware MIN / MAX query series reads its reducer column (not mistaken for a band)', async () => {
    const pvMax: LineChartQuerySeries = { ...PV, dataSource: { ...PV.dataSource, resolutionAware: true, requiredAggregation: 'MAX' } };
    const s = setup(chartConfig({ additionalSeries: [pvMax] }), { 'q-grid': GRID_ROWS });
    s.resolveSeriesQuery.mockResolvedValue({
      archiveRtId: 'rollup', effectiveBucketMs: 0, points: 4, reducingFunction: CkRollupFunctionDto.MaxDto,
      signal: SeriesResolutionSignalDto.OkDto, actualPoints: null, diagnostic: null
    });
    s.downsampleByArchive.mockResolvedValue([
      { __typename: 'StreamDataQueryRow', timestamp: '2026-10-20T10:00:00', cells: [{ attributePath: 'power_max', value: 7 }] },
      { __typename: 'StreamDataQueryRow', timestamp: '2026-10-20T10:15:00', cells: [{ attributePath: 'power_max', value: 8 }] }
    ]);

    await s.load();

    expect(s.cmp.seriesData().find(x => x.name === 'PV')?.data).toEqual([7, 8, null]);
  });

  it('DST day 2026-10-25 (Europe/Vienna): 100 quarter-hour categories, the repeated hour labelled apart', async () => {
    const start = Date.parse('2026-10-24T22:00:00Z');
    const rows = (column: string) => Array.from({ length: 100 }, (_, i) =>
      dsRow(new Date(start + i * 15 * 60000).toISOString(), i, column, column === 'importpower' ? 'grid' : undefined));
    const s = setup(chartConfig({ additionalSeries: [PV] }), { 'q-grid': rows('importpower'), 'q-pv': rows('power') });
    s.state.zone = 'Europe/Vienna';

    await s.load();

    const categories = s.cmp.categories();
    expect(categories.length).toBe(100);
    expect(new Set(categories).size).toBe(100);
    expect(categories.filter(c => c.includes('02:00'))).toEqual(['25.10. 02:00', '25.10. 02:00 (2)']);
    expect(s.cmp.seriesData().every(x => x.data.every(v => v !== null))).toBe(true);
  });

  it('stacked area: series stack in order and gaps stay gaps (missingValues "gap")', async () => {
    const s = setup(chartConfig({ stacked: true }), { 'q-grid': GRID_ROWS, 'q-pv': PV_ROWS, 'q-bat': BATTERY_ROWS });
    await s.load();

    expect(s.cmp.stackSeries()).toBe(true);
    expect(s.cmp.missingValues()).toBe('gap');
    expect(s.cmp.seriesData().map(x => x.name)).toEqual(['grid', 'PV', 'Battery']);
  });

  it('a multi-source line chart does not stack but still renders gaps', () => {
    const s = setup(chartConfig({ chartType: 'line', stacked: true }), {});
    expect(s.cmp.stackSeries()).toBe(false);
    expect(s.cmp.missingValues()).toBe('gap');
  });

  it('an incomplete query series is ignored (single-query path)', async () => {
    const incomplete: LineChartQuerySeries = { ...PV, valueField: '' };
    const s = setup(chartConfig({ additionalSeries: [incomplete] }), { 'q-grid': GRID_ROWS });

    await s.load();

    expect(s.cmp.hasAdditionalSeries()).toBe(false);
    expect(s.execute).toHaveBeenCalledTimes(1);
  });
});

describe('LineChartWidgetComponent single-query regression (AB#7951)', () => {
  it('an existing single-query config loads exactly as before: one query, no hints, Kendo defaults', async () => {
    const config = chartConfig({ additionalSeries: undefined, chartType: 'line' });
    const s = setup(config, { 'q-grid': GRID_ROWS });

    await s.load();

    expect(s.execute).toHaveBeenCalledTimes(1);
    expect(s.execute.mock.calls[0][2]).toEqual({
      fieldFilter: undefined,
      streamDataArgs: { from: FROM, to: TO, rtIds: ['grid-1'], limit: 750, queryMode: QueryModeDto.DownsamplingDto },
      scopeRtIds: ['grid-1']
    });
    expect(s.cmp.sourceHints()).toEqual([]);
    expect(s.cmp.seriesData().map(x => ({ name: x.name, data: x.data }))).toEqual([{ name: 'grid', data: [4, 5, 6] }]);
    expect(s.cmp.stackSeries()).toBe(false);
    expect(s.cmp.missingValues()).toBe('interpolate');
    expect((await s.render()).querySelector('.source-hints')).toBeNull();
  });

  it('a single-query area chart keeps Kendo\'s area default ("zero")', () => {
    const s = setup(chartConfig({ additionalSeries: undefined, chartType: 'area' }), {});
    expect(s.cmp.missingValues()).toBe('zero');
    expect(s.cmp.stackSeries()).toBe(false);
  });
});
