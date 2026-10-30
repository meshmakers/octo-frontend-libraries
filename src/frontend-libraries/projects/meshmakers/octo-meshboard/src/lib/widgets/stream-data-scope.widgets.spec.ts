import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CkModelService } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { FetchDataOptions, ListViewComponent } from '@meshmakers/shared-ui';
import { MeshBoardStateService } from '../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../services/meshboard-grid.service';
import { MeshBoardVariableService } from '../services/meshboard-variable.service';
import { QueryExecutionResult, QueryExecutorService } from '../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';
import { LineChartWidgetComponent } from './line-chart-widget/line-chart-widget.component';
import { BarChartWidgetComponent } from './bar-chart-widget/bar-chart-widget.component';
import { TableWidgetDataSourceDirective } from './table-widget/table-widget-data-source.directive';
import { BarChartWidgetConfig, LineChartWidgetConfig, PersistentQueryDataSource, TableWidgetConfig } from '../models/meshboard.models';

/**
 * Empty entity-selector scope (AB#7721) across the stream-data widgets: a widget bound to a
 * selector whose pick resolved to zero rtIds, or whose resolution failed, renders its no-data
 * state and sends NO query; a pending scope sends no query either. Never the persisted scope.
 * Neutral fixtures only (selector `site`, Test/Device rows).
 */
describe('stream-data widgets — entity-selector scope (AB#7721)', () => {
  let state: MeshBoardStateService;
  let queryExecutor: { execute: ReturnType<typeof vi.fn> };

  const RESULT: QueryExecutionResult = {
    family: 'streamData',
    queryRtId: 'q-1',
    associatedCkTypeId: null,
    columns: [{ attributePath: 'timestamp' }, { attributePath: 'device' }, { attributePath: 'value' }],
    rows: [{
      __typename: 'StreamDataQueryRow',
      rtId: 'dev-foreign',
      cells: [
        { attributePath: 'timestamp', value: '2026-10-01T00:00:00Z' },
        { attributePath: 'device', value: 'Foreign device' },
        { attributePath: 'value', value: 42 }
      ]
    }],
    totalCount: 1,
    hasNextPage: false,
    endCursor: null
  };

  const BOUND: PersistentQueryDataSource = {
    type: 'persistentQuery',
    queryRtId: 'q-1',
    queryFamily: 'streamData',
    entitySelectorId: 'site'
  };

  beforeEach(() => {
    queryExecutor = { execute: vi.fn().mockReturnValue(of(RESULT)) };
    TestBed.configureTestingModule({
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: MeshBoardVariableService, useValue: { convertToFieldFilterDto: vi.fn().mockReturnValue(undefined) } },
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: {} },
        { provide: SecretSafeAttributeNamesService, useValue: {} },
        { provide: ListViewComponent, useValue: {} }
      ]
    });
    state = TestBed.inject(MeshBoardStateService);
  });

  function lastRtIds(): string[] | undefined {
    const options = queryExecutor.execute.mock.calls.at(-1)?.[2] as { streamDataArgs?: { rtIds?: string[] } } | undefined;
    return options?.streamDataArgs?.rtIds;
  }

  describe('line chart', () => {
    function create(dataSource: PersistentQueryDataSource = BOUND): LineChartWidgetComponent {
      const cmp = TestBed.createComponent(LineChartWidgetComponent).componentInstance;
      cmp.config = {
        id: 'line', type: 'lineChart', title: 'Line', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource,
        categoryField: 'timestamp', seriesGroupField: 'device', valueField: 'value'
      } as LineChartWidgetConfig;
      return cmp;
    }

    const load = (cmp: LineChartWidgetComponent): Promise<void> =>
      (cmp as unknown as { loadData(): Promise<void> }).loadData();

    it('shows no data and sends no query for an empty scope', async () => {
      state.setEntitySelectorRtIds('site', []);
      const cmp = create();

      await load(cmp);

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(cmp.isLoading()).toBe(false);
      expect(cmp.error()).toBeNull();
      expect(cmp.dataInfo()).toEqual({ rows: 0, points: 0, total: 0 });
    });

    it('shows no data and sends no query when the scope resolution failed', async () => {
      state.setEntitySelectorScopeFailed('site');
      const cmp = create();

      await load(cmp);

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(cmp.dataInfo()).toEqual({ rows: 0, points: 0, total: 0 });
    });

    it('stays loading and sends no query while the scope is pending', async () => {
      state.setEntitySelectorScopePending('site');
      const cmp = create();

      await load(cmp);

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(cmp.isLoading()).toBe(true);
    });

    it('also skips the resolution-aware path for an empty scope', async () => {
      state.setEntitySelectorRtIds('site', []);
      const cmp = create({ ...BOUND, resolutionAware: true, requiredAggregation: 'AVG' as PersistentQueryDataSource['requiredAggregation'] });

      await load(cmp);

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(cmp.dataInfo()).toEqual({ rows: 0, points: 0, total: 0 });
    });

    it('queries the resolved rtIds for a non-empty scope (unchanged)', async () => {
      state.setEntitySelectorRtIds('site', ['dev-1']);
      const cmp = create();

      await load(cmp);

      expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
      expect(lastRtIds()).toEqual(['dev-1']);
    });

    it('keeps the persisted scope for an unbound widget (unchanged)', async () => {
      state.setEntitySelectorRtIds('site', []);
      const cmp = create({ ...BOUND, entitySelectorId: undefined });

      await load(cmp);

      expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
      expect(lastRtIds()).toBeUndefined();
    });
  });

  describe('bar chart', () => {
    function create(): BarChartWidgetComponent {
      const cmp = TestBed.createComponent(BarChartWidgetComponent).componentInstance;
      cmp.config = {
        id: 'bar', type: 'barChart', title: 'Bar', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource: BOUND,
        chartType: 'column',
        categoryField: 'device',
        series: [{ field: 'value', name: 'Value' }]
      } as BarChartWidgetConfig;
      return cmp;
    }

    const load = (cmp: BarChartWidgetComponent): Promise<void> =>
      (cmp as unknown as { loadData(): Promise<void> }).loadData();

    it('shows no data and sends no query for an empty scope', async () => {
      state.setEntitySelectorRtIds('site', []);
      const cmp = create();

      await load(cmp);

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(cmp.isLoading()).toBe(false);
      expect(cmp.error()).toBeNull();
      expect(cmp.categories()).toEqual([]);
    });

    it('stays loading and sends no query while the scope is pending', async () => {
      state.setEntitySelectorScopePending('site');
      const cmp = create();

      await load(cmp);

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(cmp.isLoading()).toBe(true);
    });

    it('queries the resolved rtIds for a non-empty scope (unchanged)', async () => {
      state.setEntitySelectorRtIds('site', ['dev-1', 'dev-2']);
      const cmp = create();

      await load(cmp);

      expect(lastRtIds()).toEqual(['dev-1', 'dev-2']);
      expect(cmp.categories()).toEqual(['Foreign device']);
    });
  });

  describe('table', () => {
    function create(dataSource: PersistentQueryDataSource = BOUND): TableWidgetDataSourceDirective {
      const directive = TestBed.runInInjectionContext(() => new TableWidgetDataSourceDirective());
      directive.config = {
        id: 'table', type: 'table', title: 'Table', col: 1, row: 1, colSpan: 2, rowSpan: 2,
        dataSource,
        columns: []
      } as TableWidgetConfig;
      return directive;
    }

    const OPTIONS = { state: { take: 10, skip: 0 } } as FetchDataOptions;

    it('returns no rows and sends no query for an empty scope', () => {
      state.setEntitySelectorScopeFailed('site');
      const emitted: unknown[] = [];

      create().fetchData(OPTIONS).subscribe(result => emitted.push(result));

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(emitted).toEqual([expect.objectContaining({ data: [], totalCount: 0 })]);
    });

    it('keeps the list loading (no emission) and sends no query while the scope is pending', () => {
      state.setEntitySelectorScopePending('site');
      const emitted: unknown[] = [];

      const subscription = create().fetchData(OPTIONS).subscribe(result => emitted.push(result));

      expect(queryExecutor.execute).not.toHaveBeenCalled();
      expect(emitted).toEqual([]);
      subscription.unsubscribe();
    });

    it('queries the resolved rtIds for a non-empty scope (unchanged)', () => {
      state.setEntitySelectorRtIds('site', ['dev-1']);
      const emitted: { data: unknown[] }[] = [];

      create().fetchData(OPTIONS).subscribe(result => emitted.push(result as { data: unknown[] }));

      expect(lastRtIds()).toEqual(['dev-1']);
      expect(emitted[0].data.length).toBe(1);
    });

    it('ignores the binding for a runtime query', () => {
      state.setEntitySelectorRtIds('site', []);

      create({ ...BOUND, queryFamily: 'runtime' }).fetchData(OPTIONS).subscribe();

      expect(queryExecutor.execute).toHaveBeenCalledTimes(1);
    });
  });
});
