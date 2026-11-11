import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError, toArray } from 'rxjs';
import { CkModelService, GraphQL } from '@meshmakers/octo-services';
import { SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { FetchAgainOptions, FetchDataOptions, ListViewComponent } from '@meshmakers/shared-ui';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardPersistenceService } from '../../services/meshboard-persistence.service';
import { MeshBoardGridService } from '../../services/meshboard-grid.service';
import { QueryExecutionResult, QueryExecutorService } from '../../services/query-executor.service';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { TableWidgetDataSourceDirective } from './table-widget-data-source.directive';
import { PersistentQueryDataSource, TableWidgetConfig } from '../../models/meshboard.models';

/**
 * AB#8801: the table widget returns to page 1 when a query input outside the grid state
 * changes (variable, widget filter, time filter, entity-selector scope), and an out-of-range
 * page (ASSET1002 / INCOMPLETE_SLICE) falls back to page 1 instead of "No records available".
 * Neutral fixtures only (variable `device`, selector `site`).
 */
describe('TableWidgetDataSourceDirective — paging (AB#8801)', () => {
  let state: MeshBoardStateService;
  let queryExecutor: { execute: ReturnType<typeof vi.fn> };
  let entitiesGql: { fetch: ReturnType<typeof vi.fn> };

  const RESULT: QueryExecutionResult = {
    family: 'streamData',
    queryRtId: 'q-1',
    associatedCkTypeId: null,
    columns: [{ attributePath: 'value' }],
    rows: [{ __typename: 'StreamDataQueryRow', rtId: 'dev-1', cells: [{ attributePath: 'value', value: 1 }] }],
    totalCount: 6,
    hasNextPage: false,
    endCursor: null
  };

  const QUERY: PersistentQueryDataSource = { type: 'persistentQuery', queryRtId: 'q-1', queryFamily: 'streamData' };

  /** Apollo 4 rejects a failed query with `CombinedGraphQLErrors` (entries in `errors`). */
  const OUT_OF_RANGE = Object.assign(new Error('An error occurred'), {
    errors: [{ message: 'An error occurred', extensions: { code: 'ASSET1002', codes: ['ASSET1002', 'INCOMPLETE_SLICE'] } }]
  });
  const OTHER_ERROR = Object.assign(new Error('An error occurred'), {
    errors: [{ message: 'An error occurred', extensions: { code: 'ASSET1001', codes: ['ASSET1001'] } }]
  });

  const page = (skip: number): FetchDataOptions => ({ state: { take: 10, skip } }) as FetchDataOptions;

  beforeEach(() => {
    queryExecutor = { execute: vi.fn().mockReturnValue(of(RESULT)) };
    entitiesGql = {
      fetch: vi.fn().mockReturnValue(of({ data: { runtime: { runtimeEntities: { items: [], totalCount: 0 } } } }))
    };
    TestBed.configureTestingModule({
      providers: [
        MeshBoardStateService,
        { provide: MeshBoardPersistenceService, useValue: {} },
        { provide: MeshBoardGridService, useValue: { resolveOverlaps: vi.fn().mockReturnValue([]) } },
        { provide: CkModelService, useValue: { isModelAvailableWithMinVersion: vi.fn() } },
        { provide: QueryExecutorService, useValue: queryExecutor },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: entitiesGql },
        { provide: SecretSafeAttributeNamesService, useValue: { forCkType: vi.fn().mockResolvedValue([]) } },
        { provide: ListViewComponent, useValue: {} }
      ]
    });
    state = TestBed.inject(MeshBoardStateService);
    state.addVariable({ name: 'device', type: 'string', source: 'static', value: 'dev-1' });
  });

  function create(config: Partial<TableWidgetConfig> = {}): { directive: TableWidgetDataSourceDirective; refetches: (FetchAgainOptions | undefined)[] } {
    const directive = TestBed.runInInjectionContext(() => new TableWidgetDataSourceDirective());
    directive.config = {
      id: 'table', type: 'table', title: 'Table', col: 1, row: 1, colSpan: 2, rowSpan: 2,
      dataSource: QUERY,
      columns: [],
      filters: [{ attributePath: 'device', operator: 'EQUALS', comparisonValue: '$device' }],
      ...config
    } as TableWidgetConfig;
    const refetches: (FetchAgainOptions | undefined)[] = [];
    directive.fetchAgainEvent.subscribe((options?: FetchAgainOptions) => refetches.push(options));
    return { directive, refetches };
  }

  describe('reset to page 1 before the new query', () => {
    it('resets the page when a MeshBoard variable used by a filter changes', async () => {
      const { directive, refetches } = create();
      await firstValueFrom(directive.fetchData(page(10)));

      state.setVariableValue('device', 'dev-2');
      directive.refetch();

      expect(refetches).toEqual([{ resetSkip: true }]);
    });

    it('resets the page when the time filter selection changes', async () => {
      const { directive, refetches } = create();
      await firstValueFrom(directive.fetchData(page(10)));

      state.updateTimeFilterSelection({ type: 'day', year: 2026, month: 11, day: 10 }, '2026-11-10T00:00:00Z', '2026-11-11T00:00:00Z');
      directive.refetch();

      expect(refetches).toEqual([{ resetSkip: true }]);
    });

    it('resets the page when the entity-selector scope changes', async () => {
      state.setEntitySelectorRtIds('site', ['dev-1']);
      const { directive, refetches } = create({ dataSource: { ...QUERY, entitySelectorId: 'site' } });
      await firstValueFrom(directive.fetchData(page(10)));

      state.setEntitySelectorRtIds('site', ['dev-2']);
      directive.refetch();

      expect(refetches).toEqual([{ resetSkip: true }]);
    });

    it('resets the page of a runtime-entity table when its filter variable changes', async () => {
      const { directive, refetches } = create({ dataSource: { type: 'runtimeEntity', ckTypeId: 'Test/Device' } });
      await firstValueFrom(directive.fetchData(page(10)));

      state.setVariableValue('device', 'dev-2');
      directive.refetch();

      expect(refetches).toEqual([{ resetSkip: true }]);
    });

    it('keeps the page on a plain refresh (auto-refresh) with unchanged inputs', async () => {
      const { directive, refetches } = create();
      await firstValueFrom(directive.fetchData(page(10)));

      directive.refetch();

      expect(refetches).toEqual([undefined]);
    });

    it('keeps the page of a widget that ignores the time filter when only the time filter changes', async () => {
      const { directive, refetches } = create({ dataSource: { ...QUERY, ignoreTimeFilter: true } });
      await firstValueFrom(directive.fetchData(page(10)));

      state.updateTimeFilterSelection({ type: 'day', year: 2026, month: 11, day: 10 }, '2026-11-10T00:00:00Z', '2026-11-11T00:00:00Z');
      directive.refetch();

      expect(refetches).toEqual([undefined]);
    });

    it('resets the page when the board time zone changes under an active selection', async () => {
      state.updateSettings({
        name: 'B', description: '', columns: 4, rowHeight: 150, gap: 8,
        timeFilter: { enabled: true, defaultSelection: { type: 'day', year: 2026, month: 11, day: 10 } }
      });
      const { directive, refetches } = create();
      await firstValueFrom(directive.fetchData(page(10)));

      state.updateSettings({ name: 'B', description: '', columns: 4, rowHeight: 150, gap: 8, timeZoneMode: 'utc' });
      directive.refetch();

      expect(refetches).toEqual([{ resetSkip: true }]);
    });

    it('keeps the page on a time zone change without an active time filter', async () => {
      const { directive, refetches } = create();
      await firstValueFrom(directive.fetchData(page(10)));

      state.updateSettings({ name: 'B', description: '', columns: 4, rowHeight: 150, gap: 8, timeZoneMode: 'utc' });
      directive.refetch();

      expect(refetches).toEqual([undefined]);
    });

    it('bypasses the Apollo cache for a persistent query only when the list forces a refresh', async () => {
      const { directive } = create();
      await firstValueFrom(directive.fetchData(page(10)));
      expect(queryExecutor.execute.mock.calls.at(-1)?.[2].forceRefresh).toBe(false);

      await firstValueFrom(directive.fetchData({ ...page(0), forceRefresh: true }));

      expect(queryExecutor.execute.mock.calls.at(-1)?.[2].forceRefresh).toBe(true);
    });

    it('sends the new query with OFFSET 0 once the list returned to page 1', async () => {
      const { directive } = create();
      await firstValueFrom(directive.fetchData(page(10)));
      expect(queryExecutor.execute.mock.calls.at(-1)?.[2].after).toBe(GraphQL.offsetToCursor(10));

      await firstValueFrom(directive.fetchData(page(0)));

      expect(queryExecutor.execute.mock.calls.at(-1)?.[2].after).toBe(GraphQL.offsetToCursor(0));
    });
  });

  describe('out-of-range page falls back to page 1', () => {
    it('detects INCOMPLETE_SLICE in an Apollo 4 CombinedGraphQLErrors and in the Apollo 3 shape', () => {
      const { directive } = create();
      expect(directive.isPageOutOfRangeError(OUT_OF_RANGE)).toBe(true);
      expect(directive.isPageOutOfRangeError({ graphQLErrors: [{ extensions: { code: 'INCOMPLETE_SLICE' } }] })).toBe(true);
      expect(directive.isPageOutOfRangeError(OTHER_ERROR)).toBe(false);
      expect(directive.isPageOutOfRangeError(new Error('network down'))).toBe(false);
      expect(directive.isPageOutOfRangeError(null)).toBe(false);
    });

    it('re-queries page 1 instead of emitting an empty result, without console.error (persistent query)', async () => {
      queryExecutor.execute.mockReturnValue(throwError(() => OUT_OF_RANGE));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { directive, refetches } = create();

      const emitted = await firstValueFrom(directive.fetchData(page(10)).pipe(toArray()));
      await Promise.resolve();

      expect(emitted).toEqual([]);
      expect(refetches).toEqual([{ resetSkip: true }]);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('re-queries page 1 for a runtime-entity table as well', async () => {
      entitiesGql.fetch.mockReturnValue(throwError(() => OUT_OF_RANGE));
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { directive, refetches } = create({ dataSource: { type: 'runtimeEntity', ckTypeId: 'Test/Device' } });

      const emitted = await firstValueFrom(directive.fetchData(page(10)).pipe(toArray()));
      await Promise.resolve();

      expect(emitted).toEqual([]);
      expect(refetches).toEqual([{ resetSkip: true }]);
    });

    it('does not loop on page 1: an out-of-range error at offset 0 yields no rows and no refetch', async () => {
      queryExecutor.execute.mockReturnValue(throwError(() => OUT_OF_RANGE));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { directive, refetches } = create();

      const emitted = await firstValueFrom(directive.fetchData(page(0)).pipe(toArray()));
      await Promise.resolve();

      expect(emitted).toEqual([expect.objectContaining({ data: [], totalCount: 0 })]);
      expect(refetches).toEqual([]);
    });

    it('keeps other errors unchanged: logged, no rows, no refetch', async () => {
      queryExecutor.execute.mockReturnValue(throwError(() => OTHER_ERROR));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { directive, refetches } = create();

      const emitted = await firstValueFrom(directive.fetchData(page(10)).pipe(toArray()));
      await Promise.resolve();

      expect(emitted).toEqual([expect.objectContaining({ data: [], totalCount: 0 })]);
      expect(refetches).toEqual([]);
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
