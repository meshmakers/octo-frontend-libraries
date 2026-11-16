import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { CkModelService } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { FetchDataOptions, ListViewComponent } from '@meshmakers/shared-ui';
import { CreateProcessDiagramDtoGQL, GetProcessDiagramDtoGQL, GetProcessDiagramsDtoGQL, UpdateProcessDiagramDtoGQL } from '@meshmakers/octo-process-diagrams';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../services/meshboard-grid.service';
import { MeshBoardVariableService } from '../services/meshboard-variable.service';
import { MeshBoardDataService } from '../services/meshboard-data.service';
import { QueryExecutionOptions, QueryExecutionResult, QueryExecutorService } from '../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { GetDashboardEntityDtoGQL } from '../graphQL/getDashboardEntity';
import { ExecuteRuntimeQueryDtoGQL } from '../graphQL/executeRuntimeQuery';
import { ExecuteStreamDataQueryDtoGQL } from '../graphQL/executeStreamDataQuery';
import { GetSystemPersistentQueriesDtoGQL } from '../graphQL/getSystemPersistentQueries';
import { ResolveSeriesQueryDtoGQL } from '../graphQL/resolveSeriesQuery';
import { GetStreamDataQueryArchiveDtoGQL } from '../graphQL/getStreamDataQueryArchive';
import { TransientDownsamplingDtoGQL } from '../graphQL/transientDownsampling';
import { KpiWidgetComponent } from './kpi-widget/kpi-widget.component';
import { GaugeWidgetComponent } from './gauge-widget/gauge-widget.component';
import { BarChartWidgetComponent } from './bar-chart-widget/bar-chart-widget.component';
import { PieChartWidgetComponent } from './pie-chart-widget/pie-chart-widget.component';
import { LineChartWidgetComponent } from './line-chart-widget/line-chart-widget.component';
import { HeatmapWidgetComponent } from './heatmap-widget/heatmap-widget.component';
import { StatsGridWidgetComponent } from './stats-grid-widget/stats-grid-widget.component';
import { SummaryCardWidgetComponent } from './summary-card-widget/summary-card-widget.component';
import { TableWidgetDataSourceDirective } from './table-widget/table-widget-data-source.directive';
import { ProcessDataService } from './process-widget/services/process-data.service';
import { ProcessWidgetConfig } from './process-widget/process-widget-config.model';
import {
  BarChartWidgetConfig,
  GaugeWidgetConfig,
  HeatmapWidgetConfig,
  KpiWidgetConfig,
  LineChartQuerySeries,
  LineChartWidgetConfig,
  MeshBoardTimeShift,
  PersistentQueryCellSource,
  PersistentQueryDataSource,
  PieChartWidgetConfig,
  StatsGridWidgetConfig,
  SummaryCardWidgetConfig,
  TableWidgetConfig
} from '../models/meshboard.models';

/**
 * AB#9094, AC8: every stream-data consumer takes the shifted window when its source has
 * `timeShift`, through the one state-service method. Board: October 2026, Europe/Vienna;
 * previous period = September 2026 (literal, AC3). AC7: the resolution-aware line chart passes
 * the shifted window into `resolveSeriesQuery`. AC2: a runtime query ignores the shift.
 */
const PREVIOUS_PERIOD: MeshBoardTimeShift = { by: 'period', count: -1 };
const SEPTEMBER_2026 = { from: new Date('2026-09-01T00:00:00+02:00'), to: new Date('2026-10-01T00:00:00+02:00') };
const OCTOBER_2026 = { from: new Date('2026-10-01T00:00:00+02:00'), to: new Date('2026-11-01T00:00:00+01:00') };

const SHIFTED: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-sd', queryFamily: 'streamData', timeShift: PREVIOUS_PERIOD };
const UNSHIFTED: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-sd', queryFamily: 'streamData' };

function emptyResult(family: 'runtime' | 'streamData'): QueryExecutionResult {
  return { family, queryRtId: 'q', associatedCkTypeId: null, columns: [], rows: [], totalCount: 0, hasNextPage: false, endCursor: null };
}

function prepareBoard(state: MeshBoardStateService): void {
  state.updateSettings({ name: 'B', description: '', columns: 4, rowHeight: 150, gap: 8, timeZoneMode: 'Europe/Vienna' });
  state.updateTimeFilterConfig({ enabled: true, selection: { type: 'month', year: 2026, month: 9 } });
}

const BASE_PROVIDERS = [
  MeshBoardStateService,
  ProcessDataService,
  { provide: MeshBoardPersistenceService, useValue: {} },
  { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
  { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
  { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined), resolveVariables: vi.fn((s: string) => s) } },
  { provide: MeshBoardDataService, useValue: { fetchAggregations: vi.fn().mockResolvedValue(new Map()) } },
  { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
  { provide: GetDashboardEntityDtoGQL, useValue: {} },
  { provide: SecretSafeAttributeNamesService, useValue: {} },
  { provide: ListViewComponent, useValue: {} },
  { provide: GetProcessDiagramDtoGQL, useValue: {} },
  { provide: GetProcessDiagramsDtoGQL, useValue: {} },
  { provide: CreateProcessDiagramDtoGQL, useValue: {} },
  { provide: UpdateProcessDiagramDtoGQL, useValue: {} }
];

describe('stream-data consumers take the shifted window (AB#9094 AC8)', () => {
  let state: MeshBoardStateService;
  let queryExecutor: {
    execute: ReturnType<typeof vi.fn>;
    fetchQueryArchive: ReturnType<typeof vi.fn>;
    resolveSeriesQuery: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    queryExecutor = {
      execute: vi.fn().mockReturnValue(of(emptyResult('streamData'))),
      fetchQueryArchive: vi.fn().mockResolvedValue({ archiveRtId: 'archive-raw', ckTypeId: 'Test/Device', rtIds: null }),
      resolveSeriesQuery: vi.fn().mockResolvedValue(null)
    };
    TestBed.configureTestingModule({
      providers: [...BASE_PROVIDERS, { provide: QueryExecutorService, useValue: queryExecutor }]
    });
    state = TestBed.inject(MeshBoardStateService);
    prepareBoard(state);
  });

  function lastWindow(): { from?: Date; to?: Date } | undefined {
    const options = queryExecutor.execute.mock.calls.at(-1)?.[2] as QueryExecutionOptions | undefined;
    const args = options?.streamDataArgs;
    return args ? { from: args.from ?? undefined, to: args.to ?? undefined } : undefined;
  }

  it('KPI', async () => {
    const cmp = TestBed.createComponent(KpiWidgetComponent).componentInstance;
    cmp.config = { id: 'kpi', type: 'kpi', title: 'KPI', col: 1, row: 1, colSpan: 1, rowSpan: 1, dataSource: SHIFTED, queryMode: 'simpleCount' } as KpiWidgetConfig;

    await (cmp as unknown as { loadPersistentQueryData(): Promise<void> }).loadPersistentQueryData();

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  it('KPI without timeShift keeps the board window (AC1)', async () => {
    const cmp = TestBed.createComponent(KpiWidgetComponent).componentInstance;
    cmp.config = { id: 'kpi', type: 'kpi', title: 'KPI', col: 1, row: 1, colSpan: 1, rowSpan: 1, dataSource: UNSHIFTED, queryMode: 'simpleCount' } as KpiWidgetConfig;

    await (cmp as unknown as { loadPersistentQueryData(): Promise<void> }).loadPersistentQueryData();

    expect(lastWindow()).toEqual(OCTOBER_2026);
  });

  it('gauge', async () => {
    const cmp = TestBed.createComponent(GaugeWidgetComponent).componentInstance;
    cmp.config = {
      id: 'gauge', type: 'gauge', title: 'Gauge', col: 1, row: 1, colSpan: 1, rowSpan: 1,
      dataSource: SHIFTED, gaugeType: 'arc', min: 0, max: 100, queryMode: 'simpleCount'
    } as GaugeWidgetConfig;

    await (cmp as unknown as { loadPersistentQueryData(): Promise<void> }).loadPersistentQueryData();

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  it('bar chart', async () => {
    const cmp = TestBed.createComponent(BarChartWidgetComponent).componentInstance;
    cmp.config = {
      id: 'bar', type: 'barChart', title: 'Bar', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: SHIFTED, chartType: 'column', categoryField: 'name', series: [{ field: 'value', name: 'Value' }]
    } as BarChartWidgetConfig;

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  it('pie chart', async () => {
    const cmp = TestBed.createComponent(PieChartWidgetComponent).componentInstance;
    cmp.config = {
      id: 'pie', type: 'pieChart', title: 'Pie', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: SHIFTED, chartType: 'pie', categoryField: 'name', valueField: 'value'
    } as PieChartWidgetConfig;

    await (cmp as unknown as { loadPersistentQueryData(ds: PersistentQueryDataSource): Promise<void> }).loadPersistentQueryData(SHIFTED);

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  it('line chart', async () => {
    const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
    cmp.config = {
      id: 'line', type: 'lineChart', title: 'Line', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: SHIFTED, categoryField: 'timestamp', seriesGroupField: 'device', valueField: 'value'
    } as LineChartWidgetConfig;

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  it('table', async () => {
    const directive = TestBed.runInInjectionContext(() => new TableWidgetDataSourceDirective());
    directive.config = {
      id: 'table', type: 'table', title: 'Table', col: 1, row: 1, colSpan: 2, rowSpan: 2, dataSource: SHIFTED, columns: []
    } as TableWidgetConfig;

    await firstValueFrom(directive.fetchData({ state: { take: 10, skip: 0 } } as FetchDataOptions));

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  it('heatmap', async () => {
    const cmp = TestBed.createComponent(HeatmapWidgetComponent).componentInstance;
    cmp.config = {
      id: 'heat', type: 'heatmap', title: 'Heat', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: SHIFTED, dateField: 'timestamp', aggregation: 'count', colorScheme: 'green'
    } as unknown as HeatmapWidgetConfig;

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  it('stats grid cell', async () => {
    const cmp = TestBed.createComponent(StatsGridWidgetComponent).componentInstance;
    cmp.config = {
      id: 'stats', type: 'statsGrid', title: 'Stats', col: 1, row: 1, colSpan: 3, rowSpan: 1,
      dataSource: { type: 'aggregation', queries: [] }, stats: [], columns: 3
    } as StatsGridWidgetConfig;
    const cell: PersistentQueryCellSource = { queryRtId: 'q-sd', queryFamily: 'streamData', queryMode: 'simpleCount', timeShift: PREVIOUS_PERIOD };

    await (cmp as unknown as { loadPersistentQueryValue(s: PersistentQueryCellSource): Promise<unknown> }).loadPersistentQueryValue(cell);

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  it('summary card tile', async () => {
    const cmp = TestBed.createComponent(SummaryCardWidgetComponent).componentInstance;
    cmp.config = {
      id: 'summary', type: 'summaryCard', title: 'Summary', col: 1, row: 1, colSpan: 2, rowSpan: 1,
      dataSource: { type: 'static' }, tiles: []
    } as unknown as SummaryCardWidgetConfig;
    const tile: PersistentQueryCellSource = { queryRtId: 'q-sd', queryFamily: 'streamData', queryMode: 'simpleCount', timeShift: PREVIOUS_PERIOD };

    await (cmp as unknown as { fetchPersistentQueryValue(s: PersistentQueryCellSource): Promise<unknown> }).fetchPersistentQueryValue(tile);

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  it('process binding', async () => {
    const service = TestBed.inject(ProcessDataService);
    const config = {
      id: 'flow', type: 'process', title: 'Flow', col: 1, row: 1, colSpan: 4, rowSpan: 3,
      dataSource: { type: 'static', data: null },
      bindings: [{ name: 'pv', mode: 'persistentQuery', queryRtId: 'q-sd', queryFamily: 'streamData', timeShift: PREVIOUS_PERIOD }],
      propertyMappings: []
    } as unknown as ProcessWidgetConfig;

    await service.loadBindings(config);

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
  });

  describe('multi-source charts shift each query series by its own timeShift', () => {
    const LAST_PERIOD_SERIES: LineChartQuerySeries = {
      kind: 'query', key: 'lastPeriod', label: 'Last period', valueField: 'value', categoryField: 'timestamp',
      dataSource: { type: 'persistentQuery', queryRtId: 'q-last', queryFamily: 'streamData', timeShift: PREVIOUS_PERIOD }
    };

    function windowOf(queryRtId: string): { from?: Date; to?: Date } | undefined {
      const call = queryExecutor.execute.mock.calls.find(c => c[1] === queryRtId);
      const args = (call?.[2] as QueryExecutionOptions | undefined)?.streamDataArgs;
      return args ? { from: args.from ?? undefined, to: args.to ?? undefined } : undefined;
    }

    it('bar chart: the shifted query series reads September, the unshifted primary October', async () => {
      const cmp = TestBed.createComponent(BarChartWidgetComponent).componentInstance;
      cmp.config = {
        id: 'bar', type: 'barChart', title: 'Bar', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource: UNSHIFTED, chartType: 'column', categoryField: 'timestamp', series: [{ field: 'value', name: 'Value' }],
        additionalSeries: [LAST_PERIOD_SERIES]
      } as BarChartWidgetConfig;

      await (cmp as unknown as { loadData(): Promise<void> }).loadData();

      expect(cmp.isMultiSource()).toBe(true);
      expect(windowOf('q-sd')).toEqual(OCTOBER_2026);
      expect(windowOf('q-last')).toEqual(SEPTEMBER_2026);
    });

    it('line chart: the shifted query series reads September, the unshifted primary October', async () => {
      const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
      cmp.config = {
        id: 'line', type: 'lineChart', title: 'Line', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource: UNSHIFTED, categoryField: 'timestamp', seriesGroupField: 'device', valueField: 'value',
        additionalSeries: [LAST_PERIOD_SERIES]
      } as LineChartWidgetConfig;

      await (cmp as unknown as { loadData(): Promise<void> }).loadData();

      expect(cmp.hasAdditionalSeries()).toBe(true);
      expect(windowOf('q-sd')).toEqual(OCTOBER_2026);
      expect(windowOf('q-last')).toEqual(SEPTEMBER_2026);
    });
  });

  it('line chart with a fixed bucket size reads the shifted window in whole buckets', async () => {
    const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
    cmp.config = {
      id: 'line', type: 'lineChart', title: 'Line', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: SHIFTED, categoryField: 'timestamp', seriesGroupField: 'device', valueField: 'value', bucketMinutes: 15
    } as LineChartWidgetConfig;

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    expect(lastWindow()).toEqual(SEPTEMBER_2026);
    // September 2026 in Europe/Vienna has 30 days without a DST change: 30 × 24 × 4 quarter hours.
    expect((queryExecutor.execute.mock.calls.at(-1)?.[2] as QueryExecutionOptions).streamDataArgs?.limit).toBe(2880);
  });

  it('multi-source line chart with a fixed bucket size puts the shifted day on its own hour grid', async () => {
    // Board day 2026-10-25 (25 hours, end of summer time) → previous period 2026-10-24 (24 hours).
    state.updateTimeFilterConfig({ enabled: true, selection: { type: 'day', year: 2026, month: 9, day: 25 } });
    const OCTOBER_24 = { from: new Date('2026-10-24T00:00:00+02:00'), to: new Date('2026-10-25T00:00:00+02:00') };
    queryExecutor.execute.mockImplementation((_family: string, queryRtId: string) => of({
      ...emptyResult('streamData'),
      rows: queryRtId === 'q-last'
        ? [{ __typename: 'StreamDataQueryRow', timestamp: new Date('2026-10-24T12:00:00+02:00'), cells: [{ attributePath: 'value', value: 7 }] }]
        : []
    }));
    const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
    cmp.config = {
      id: 'line', type: 'lineChart', title: 'Line', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: SHIFTED, categoryField: 'timestamp', seriesGroupField: 'device', valueField: 'value', bucketMinutes: 60,
      additionalSeries: [{
        kind: 'query', key: 'lastPeriod', label: 'Last period', valueField: 'value',
        dataSource: { type: 'persistentQuery', queryRtId: 'q-last', queryFamily: 'streamData', timeShift: PREVIOUS_PERIOD }
      }]
    } as LineChartWidgetConfig;

    await (cmp as unknown as { loadData(): Promise<void> }).loadData();

    for (const call of queryExecutor.execute.mock.calls) {
      const args = (call[2] as QueryExecutionOptions).streamDataArgs;
      expect({ from: args?.from, to: args?.to, limit: args?.limit }).toEqual({ ...OCTOBER_24, limit: 24 });
    }
    expect(cmp.categories().length).toBe(24);
    expect(cmp.seriesData().find(s => s.name === 'Last period')?.data[12]).toBe(7);
  });

  describe('AC7 resolution-aware line chart', () => {
    function lineChart(dataSource: PersistentQueryDataSource): LineChartWidgetComponent {
      const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
      cmp.config = {
        id: 'line', type: 'lineChart', title: 'Line', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource: { ...dataSource, resolutionAware: true, requiredAggregation: 'SUM' },
        categoryField: 'timestamp', seriesGroupField: 'device', valueField: 'value'
      } as LineChartWidgetConfig;
      return cmp;
    }

    it('passes the shifted window with the same zone, aggregation and point count into resolveSeriesQuery', async () => {
      await (lineChart(UNSHIFTED) as unknown as { loadData(): Promise<void> }).loadData();
      await (lineChart(SHIFTED) as unknown as { loadData(): Promise<void> }).loadData();

      expect(queryExecutor.resolveSeriesQuery).toHaveBeenCalledTimes(2);
      const [unshifted, shifted] = queryExecutor.resolveSeriesQuery.mock.calls.map(call => call[0]);
      expect({ from: unshifted.from, to: unshifted.to }).toEqual(OCTOBER_2026);
      expect({ from: shifted.from, to: shifted.to }).toEqual(SEPTEMBER_2026);
      expect(shifted.timeZone).toBe('Europe/Vienna');
      expect({ ...shifted, from: undefined, to: undefined }).toEqual({ ...unshifted, from: undefined, to: undefined });
    });
  });
});

describe('a runtime query ignores timeShift (AB#9094 AC2)', () => {
  let runtimeFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    runtimeFetch = vi.fn().mockReturnValue(of({ data: { runtime: { runtimeQuery: { items: [] } } }, loading: false, networkStatus: 7 }));
    TestBed.configureTestingModule({
      providers: [
        ...BASE_PROVIDERS,
        QueryExecutorService,
        { provide: ExecuteRuntimeQueryDtoGQL, useValue: { fetch: runtimeFetch } },
        { provide: ExecuteStreamDataQueryDtoGQL, useValue: { fetch: vi.fn() } },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn() } },
        { provide: ResolveSeriesQueryDtoGQL, useValue: { fetch: vi.fn() } },
        { provide: GetStreamDataQueryArchiveDtoGQL, useValue: { fetch: vi.fn() } },
        { provide: TransientDownsamplingDtoGQL, useValue: { fetch: vi.fn() } }
      ]
    });
    prepareBoard(TestBed.inject(MeshBoardStateService));
  });

  async function loadKpi(dataSource: PersistentQueryDataSource): Promise<unknown> {
    const cmp = TestBed.createComponent(KpiWidgetComponent).componentInstance;
    cmp.config = { id: 'kpi', type: 'kpi', title: 'KPI', col: 1, row: 1, colSpan: 1, rowSpan: 1, dataSource, queryMode: 'simpleCount' } as KpiWidgetConfig;
    await (cmp as unknown as { loadPersistentQueryData(): Promise<void> }).loadPersistentQueryData();
    return runtimeFetch.mock.calls.at(-1)?.[0];
  }

  it('sends the same runtime request with and without a shift', async () => {
    const runtime: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-rt', queryFamily: 'runtime' };

    const plain = await loadKpi(runtime);
    const withShift = await loadKpi({ ...runtime, timeShift: PREVIOUS_PERIOD });

    expect(runtimeFetch).toHaveBeenCalledTimes(2);
    expect(withShift).toEqual(plain);
  });
});
