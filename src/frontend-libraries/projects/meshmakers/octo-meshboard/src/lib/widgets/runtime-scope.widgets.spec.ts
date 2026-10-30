import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { CkModelService, FieldFilterDto, FieldFilterOperatorsDto } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { FetchDataOptions, ListViewComponent } from '@meshmakers/shared-ui';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../services/meshboard-grid.service';
import { MeshBoardVariableService } from '../services/meshboard-variable.service';
import { MeshBoardDataService } from '../services/meshboard-data.service';
import { QueryExecutionOptions, QueryExecutionResult, QueryExecutorService } from '../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { ExecuteRuntimeQueryDtoGQL } from '../graphQL/executeRuntimeQuery';
import { ExecuteStreamDataQueryDtoGQL } from '../graphQL/executeStreamDataQuery';
import { GetSystemPersistentQueriesDtoGQL } from '../graphQL/getSystemPersistentQueries';
import { ResolveSeriesQueryDtoGQL } from '../graphQL/resolveSeriesQuery';
import { GetStreamDataQueryArchiveDtoGQL } from '../graphQL/getStreamDataQueryArchive';
import { TransientDownsamplingDtoGQL } from '../graphQL/transientDownsampling';
import { BarChartWidgetComponent } from './bar-chart-widget/bar-chart-widget.component';
import { PieChartWidgetComponent } from './pie-chart-widget/pie-chart-widget.component';
import { KpiWidgetComponent } from './kpi-widget/kpi-widget.component';
import { GaugeWidgetComponent } from './gauge-widget/gauge-widget.component';
import { StatsGridWidgetComponent } from './stats-grid-widget/stats-grid-widget.component';
import { TableWidgetDataSourceDirective } from './table-widget/table-widget-data-source.directive';
import {
  BarChartWidgetConfig,
  GaugeWidgetConfig,
  KpiWidgetConfig,
  PersistentQueryCellSource,
  PersistentQueryDataSource,
  PieChartWidgetConfig,
  StatsGridWidgetConfig,
  TableWidgetConfig
} from '../models/meshboard.models';
import type { QueryFamily } from '../utils/query-family';

/**
 * Runtime and grouping queries follow the entity selector (AB#7725). A widget bound to a
 * selector restricts its query on the server to the rtIds the selector resolved to:
 * runtime queries (simple, aggregation, grouping) via `scopeRtIds` → `rtId IN (…)`,
 * stream-data grouping/aggregation queries via `streamDataArgs.rtIds` as before.
 * Pending → no query (loading); empty or failed → no query (no data); unbound → unchanged.
 * Neutral fixtures only (selector `site`, Test/Device rows).
 */
describe('runtime and grouping widgets — entity-selector scope (AB#7725)', () => {
  let state: MeshBoardStateService;
  let queryExecutor: { execute: ReturnType<typeof vi.fn> };

  const WIDGET_FILTER: FieldFilterDto = { attributePath: 'state', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: 'ON' };

  function result(family: QueryFamily, typename: string): QueryExecutionResult {
    return {
      family,
      queryRtId: 'q-1',
      associatedCkTypeId: 'Test/Device',
      columns: [{ attributePath: 'name' }, { attributePath: 'value' }],
      rows: [{
        __typename: typename,
        rtId: 'dev-1',
        cells: [{ attributePath: 'name', value: 'Device 1' }, { attributePath: 'value', value: 7 }]
      }],
      totalCount: 1,
      hasNextPage: false,
      endCursor: null
    };
  }

  const RUNTIME: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-rt', queryFamily: 'runtime', entitySelectorId: 'site' };
  const STREAM: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-sd', queryFamily: 'streamData', entitySelectorId: 'site' };

  beforeEach(() => {
    queryExecutor = { execute: vi.fn().mockReturnValue(of(result('runtime', 'RtSimpleQueryRow'))) };
    TestBed.configureTestingModule({
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue([WIDGET_FILTER]) } },
        { provide: MeshBoardDataService, useValue: { fetchAggregations: vi.fn().mockResolvedValue(new Map()) } },
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: SecretSafeAttributeNamesService, useValue: {} },
        { provide: ListViewComponent, useValue: {} }
      ]
    });
    state = TestBed.inject(MeshBoardStateService);
  });

  function lastOptions(): QueryExecutionOptions {
    return queryExecutor.execute.mock.calls.at(-1)?.[2] as QueryExecutionOptions;
  }

  // --------------------------------------------------------------------------
  // Table + SimpleRtQuery
  // --------------------------------------------------------------------------

  describe('table with a SimpleRtQuery', () => {
    function create(dataSource: PersistentQueryDataSource = RUNTIME): TableWidgetDataSourceDirective {
      const directive = TestBed.runInInjectionContext(() => new TableWidgetDataSourceDirective());
      directive.config = {
        id: 'table', type: 'table', title: 'Table', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource,
        columns: []
      } as TableWidgetConfig;
      return directive;
    }

    const OPTIONS = { state: { take: 10, skip: 0 } } as FetchDataOptions;

    it('restricts the query to the resolved rtIds together with its existing filters', () => {
      state.setEntitySelectorRtIds('site', ['dev-1', 'dev-2']);
      const emitted: { data: unknown[] }[] = [];

      create().fetchData(OPTIONS).subscribe(r => emitted.push(r as { data: unknown[] }));

      expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
      expect(queryExecutor.execute.mock.calls[0][0]).toBe('runtime');
      expect(lastOptions().fieldFilter).toEqual([WIDGET_FILTER]);
      expect(lastOptions().scopeRtIds).toEqual(['dev-1', 'dev-2']);
      expect(emitted[0].data.length).toBe(1);
    });

    it('returns no rows and sends no query for an empty scope', () => {
      state.setEntitySelectorRtIds('site', []);
      const emitted: unknown[] = [];

      create().fetchData(OPTIONS).subscribe(r => emitted.push(r));

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(emitted).toEqual([expect.objectContaining({ data: [], totalCount: 0 })]);
    });

    it('returns no rows and sends no query when the scope resolution failed', () => {
      state.setEntitySelectorScopeFailed('site');
      const emitted: unknown[] = [];

      create().fetchData(OPTIONS).subscribe(r => emitted.push(r));

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(emitted).toEqual([expect.objectContaining({ data: [], totalCount: 0 })]);
    });

    it('stays loading (no emission) and sends no query while the scope is pending', () => {
      state.setEntitySelectorScopePending('site');
      const emitted: unknown[] = [];

      const sub = create().fetchData(OPTIONS).subscribe(r => emitted.push(r));

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(emitted).toEqual([]);
      sub.unsubscribe();
    });

    it('leaves an unbound runtime query unchanged', () => {
      state.setEntitySelectorRtIds('site', []);

      create({ ...RUNTIME, entitySelectorId: undefined }).fetchData(OPTIONS).subscribe();

      expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
      expect(lastOptions().fieldFilter).toEqual([WIDGET_FILTER]);
      expect(lastOptions().scopeRtIds).toBeUndefined();
    });

    it('leaves a bound runtime query unchanged while the selector has no pick', () => {
      create().fetchData(OPTIONS).subscribe();

      expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
      expect(lastOptions().scopeRtIds).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Table → real executor → GraphQL variables (server-side restriction)
  // --------------------------------------------------------------------------

  describe('table with a SimpleRtQuery through the real executor', () => {
    it('sends `rtId IN (resolved rtIds)` AND-combined with the widget filter in the GraphQL variables', async () => {
      const runtimeFetch = vi.fn().mockReturnValue(of({ data: { runtime: { runtimeQuery: { items: [] } } } }));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          MeshBoardStateService,
          QueryExecutorService,
          { provide: MeshBoardPersistenceService, useValue: {} },
          { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
          { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
          { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue([WIDGET_FILTER]) } },
          { provide: ExecuteRuntimeQueryDtoGQL, useValue: { fetch: runtimeFetch } },
          { provide: ExecuteStreamDataQueryDtoGQL, useValue: { fetch: vi.fn() } },
          { provide: GetSystemPersistentQueriesDtoGQL, useValue: { fetch: vi.fn() } },
          { provide: ResolveSeriesQueryDtoGQL, useValue: { fetch: vi.fn() } },
          { provide: GetStreamDataQueryArchiveDtoGQL, useValue: { fetch: vi.fn() } },
          { provide: TransientDownsamplingDtoGQL, useValue: { fetch: vi.fn() } },
          { provide: GetEntitiesByCkTypeDtoGQL, useValue: { fetch: vi.fn() } },
          { provide: SecretSafeAttributeNamesService, useValue: {} },
          { provide: ListViewComponent, useValue: {} }
        ]
      });
      state = TestBed.inject(MeshBoardStateService);
      state.setEntitySelectorRtIds('site', ['dev-1', 'dev-2']);

      const directive = TestBed.runInInjectionContext(() => new TableWidgetDataSourceDirective());
      directive.config = {
        id: 'table', type: 'table', title: 'Table', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource: RUNTIME,
        columns: []
      } as TableWidgetConfig;
      await firstValueFrom(directive.fetchData({ state: { take: 10, skip: 0 } } as FetchDataOptions));

      const variables = (runtimeFetch.mock.calls[0][0] as { variables: Record<string, unknown> }).variables;
      expect(variables['fieldFilter']).toEqual([
        WIDGET_FILTER,
        { attributePath: 'rtId', operator: FieldFilterOperatorsDto.InDto, comparisonValue: ['dev-1', 'dev-2'] }
      ]);
    });
  });

  // --------------------------------------------------------------------------
  // Bar chart: runtime grouping and stream-data grouping
  // --------------------------------------------------------------------------

  describe('bar chart', () => {
    function create(dataSource: PersistentQueryDataSource): BarChartWidgetComponent {
      const cmp = TestBed.createComponent(BarChartWidgetComponent).componentInstance;
      cmp.config = {
        id: 'bar', type: 'barChart', title: 'Bar', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource,
        chartType: 'column',
        categoryField: 'name',
        series: [{ field: 'value', name: 'Value' }]
      } as BarChartWidgetConfig;
      return cmp;
    }

    const load = (cmp: BarChartWidgetComponent): Promise<void> =>
      (cmp as unknown as { loadData(): Promise<void> }).loadData();

    it('runs a runtime grouping query over the resolved rtIds only', async () => {
      queryExecutor.execute.mockReturnValue(of(result('runtime', 'RtGroupingAggregationQueryRow')));
      state.setEntitySelectorRtIds('site', ['dev-1', 'dev-2']);
      const cmp = create(RUNTIME);

      await load(cmp);

      expect(queryExecutor.execute.mock.calls[0][0]).toBe('runtime');
      expect(lastOptions().scopeRtIds).toEqual(['dev-1', 'dev-2']);
      expect(lastOptions().fieldFilter).toEqual([WIDGET_FILTER]);
      expect(cmp.categories()).toEqual(['Device 1']);
    });

    it('passes the resolved rtIds to a stream-data grouping query', async () => {
      queryExecutor.execute.mockReturnValue(of(result('streamData', 'StreamDataQueryRow')));
      state.setEntitySelectorRtIds('site', ['dev-1']);

      await load(create(STREAM));

      expect(lastOptions().streamDataArgs?.rtIds).toEqual(['dev-1']);
      expect(lastOptions().scopeRtIds).toEqual(['dev-1']);
    });

    it('shows no data and sends no query for an empty or failed scope', async () => {
      for (const prepare of [() => state.setEntitySelectorRtIds('site', []), () => state.setEntitySelectorScopeFailed('site')]) {
        prepare();
        const cmp = create(RUNTIME);

        await load(cmp);

        expect(queryExecutor.execute).not.toHaveBeenCalled();
        expect(cmp.categories()).toEqual([]);
        expect(cmp.error()).toBeNull();
      }
    });

    it('stays loading and sends no query while the scope is pending', async () => {
      state.setEntitySelectorScopePending('site');
      const cmp = create(RUNTIME);

      await load(cmp);

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(cmp.isLoading()).toBe(true);
    });

    it('leaves an unbound runtime grouping query unchanged', async () => {
      queryExecutor.execute.mockReturnValue(of(result('runtime', 'RtGroupingAggregationQueryRow')));
      state.setEntitySelectorRtIds('site', ['dev-1']);

      await load(create({ ...RUNTIME, entitySelectorId: undefined }));

      expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
      expect(lastOptions().scopeRtIds).toBeUndefined();
      expect(lastOptions().fieldFilter).toEqual([WIDGET_FILTER]);
    });
  });

  // --------------------------------------------------------------------------
  // Pie chart
  // --------------------------------------------------------------------------

  describe('pie chart', () => {
    function create(dataSource: PersistentQueryDataSource): PieChartWidgetComponent {
      const cmp = TestBed.createComponent(PieChartWidgetComponent).componentInstance;
      cmp.config = {
        id: 'pie', type: 'pieChart', title: 'Pie', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource,
        chartType: 'pie',
        categoryField: 'name',
        valueField: 'value'
      } as PieChartWidgetConfig;
      return cmp;
    }

    const load = (cmp: PieChartWidgetComponent, ds: PersistentQueryDataSource): Promise<void> =>
      (cmp as unknown as { loadPersistentQueryData(ds: PersistentQueryDataSource): Promise<void> }).loadPersistentQueryData(ds);

    it('restricts a runtime grouping query to the resolved rtIds', async () => {
      queryExecutor.execute.mockReturnValue(of(result('runtime', 'RtGroupingAggregationQueryRow')));
      state.setEntitySelectorRtIds('site', ['dev-1', 'dev-2']);

      await load(create(RUNTIME), RUNTIME);

      expect(lastOptions().scopeRtIds).toEqual(['dev-1', 'dev-2']);
    });

    it('passes the resolved rtIds to a stream-data grouping query', async () => {
      queryExecutor.execute.mockReturnValue(of(result('streamData', 'StreamDataQueryRow')));
      state.setEntitySelectorRtIds('site', ['dev-1']);

      await load(create(STREAM), STREAM);

      expect(lastOptions().streamDataArgs?.rtIds).toEqual(['dev-1']);
    });

    it('sends no query for an empty scope', async () => {
      state.setEntitySelectorRtIds('site', []);

      await load(create(RUNTIME), RUNTIME);

      expect(queryExecutor.execute).not.toHaveBeenCalled();
    });

    it('leaves an unbound query unchanged', async () => {
      queryExecutor.execute.mockReturnValue(of(result('runtime', 'RtGroupingAggregationQueryRow')));
      const unbound = { ...RUNTIME, entitySelectorId: undefined };

      await load(create(unbound), unbound);

      expect(lastOptions().scopeRtIds).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // KPI and gauge (aggregation)
  // --------------------------------------------------------------------------

  describe('KPI', () => {
    function create(dataSource: PersistentQueryDataSource): KpiWidgetComponent {
      const cmp = TestBed.createComponent(KpiWidgetComponent).componentInstance;
      cmp.config = {
        id: 'kpi', type: 'kpi', title: 'KPI', col: 1, row: 1, colSpan: 1, rowSpan: 1,
        dataSource,
        queryMode: 'simpleCount'
      } as KpiWidgetConfig;
      return cmp;
    }

    const load = (cmp: KpiWidgetComponent): Promise<void> =>
      (cmp as unknown as { loadPersistentQueryData(): Promise<void> }).loadPersistentQueryData();

    it('restricts a runtime aggregation query to the resolved rtIds', async () => {
      state.setEntitySelectorRtIds('site', ['dev-1', 'dev-2']);

      await load(create(RUNTIME));

      expect(lastOptions().scopeRtIds).toEqual(['dev-1', 'dev-2']);
    });

    it('passes the resolved rtIds to a stream-data aggregation query', async () => {
      queryExecutor.execute.mockReturnValue(of(result('streamData', 'StreamDataQueryRow')));
      state.setEntitySelectorRtIds('site', ['dev-1']);

      await load(create(STREAM));

      expect(lastOptions().streamDataArgs?.rtIds).toEqual(['dev-1']);
    });

    it('shows no value and sends no query for an empty scope; no query while pending', async () => {
      state.setEntitySelectorRtIds('site', []);
      const cmp = create(RUNTIME);
      await load(cmp);
      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(cmp.value()).toBe('-');

      state.setEntitySelectorScopePending('site');
      await load(create(RUNTIME));
      expect(queryExecutor.execute).not.toHaveBeenCalled();
    });

    it('leaves an unbound query unchanged', async () => {
      await load(create({ ...RUNTIME, entitySelectorId: undefined }));

      expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
      expect(lastOptions().scopeRtIds).toBeUndefined();
    });
  });

  describe('gauge', () => {
    function create(dataSource: PersistentQueryDataSource): GaugeWidgetComponent {
      const cmp = TestBed.createComponent(GaugeWidgetComponent).componentInstance;
      cmp.config = {
        id: 'gauge', type: 'gauge', title: 'Gauge', col: 1, row: 1, colSpan: 1, rowSpan: 1,
        dataSource,
        gaugeType: 'arc',
        min: 0,
        max: 100,
        queryMode: 'simpleCount'
      } as GaugeWidgetConfig;
      return cmp;
    }

    const load = (cmp: GaugeWidgetComponent): Promise<void> =>
      (cmp as unknown as { loadPersistentQueryData(): Promise<void> }).loadPersistentQueryData();

    it('restricts a runtime query to the resolved rtIds', async () => {
      state.setEntitySelectorRtIds('site', ['dev-1']);

      await load(create(RUNTIME));

      expect(lastOptions().scopeRtIds).toEqual(['dev-1']);
    });

    it('sends no query for an empty scope', async () => {
      state.setEntitySelectorScopeFailed('site');

      await load(create(RUNTIME));

      expect(queryExecutor.execute).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Stats grid (persistent-query cells)
  // --------------------------------------------------------------------------

  describe('stats grid', () => {
    function create(): StatsGridWidgetComponent {
      const cmp = TestBed.createComponent(StatsGridWidgetComponent).componentInstance;
      cmp.config = {
        id: 'stats', type: 'statsGrid', title: 'Stats', col: 1, row: 1, colSpan: 3, rowSpan: 1,
        dataSource: { type: 'aggregation', queries: [] },
        stats: [],
        columns: 3
      } as StatsGridWidgetConfig;
      return cmp;
    }

    const cell = (family: QueryFamily, bound = true): PersistentQueryCellSource =>
      ({ queryRtId: 'q-1', queryFamily: family, queryMode: 'simpleCount', entitySelectorId: bound ? 'site' : undefined } as PersistentQueryCellSource);

    const loadCell = (cmp: StatsGridWidgetComponent, source: PersistentQueryCellSource): Promise<number | null> =>
      (cmp as unknown as { loadPersistentQueryValue(s: PersistentQueryCellSource): Promise<number | null> }).loadPersistentQueryValue(source);

    it('restricts a runtime cell to the resolved rtIds', async () => {
      state.setEntitySelectorRtIds('site', ['dev-1', 'dev-2']);

      await loadCell(create(), cell('runtime'));

      expect(lastOptions().scopeRtIds).toEqual(['dev-1', 'dev-2']);
    });

    it('passes the resolved rtIds to a stream-data aggregation cell', async () => {
      queryExecutor.execute.mockReturnValue(of(result('streamData', 'StreamDataQueryRow')));
      state.setEntitySelectorRtIds('site', ['dev-1']);

      await loadCell(create(), cell('streamData'));

      expect(lastOptions().streamDataArgs?.rtIds).toEqual(['dev-1']);
    });

    it('shows no value and sends no query for a pending, empty or failed scope', async () => {
      for (const prepare of [
        () => state.setEntitySelectorScopePending('site'),
        () => state.setEntitySelectorRtIds('site', []),
        () => state.setEntitySelectorScopeFailed('site')
      ]) {
        prepare();
        expect(await loadCell(create(), cell('runtime'))).toBeNull();
      }
      expect(queryExecutor.execute).not.toHaveBeenCalled();
    });

    it('leaves an unbound cell unchanged', async () => {
      state.setEntitySelectorRtIds('site', []);

      await loadCell(create(), cell('runtime', false));

      expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
      expect(lastOptions().scopeRtIds).toBeUndefined();
    });
  });
});
