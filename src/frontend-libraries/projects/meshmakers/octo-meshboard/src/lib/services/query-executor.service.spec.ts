import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { CkRollupFunctionDto, QueryModeDto, SeriesResolutionSignalDto } from '@meshmakers/octo-services';
import { QueryExecutorService } from './query-executor.service';
import { ExecuteRuntimeQueryDtoGQL } from '../graphQL/executeRuntimeQuery';
import { ExecuteStreamDataQueryDtoGQL } from '../graphQL/executeStreamDataQuery';
import { GetSystemPersistentQueriesDtoGQL } from '../graphQL/getSystemPersistentQueries';
import { ResolveSeriesQueryDtoGQL } from '../graphQL/resolveSeriesQuery';
import { GetStreamDataQueryArchiveDtoGQL } from '../graphQL/getStreamDataQueryArchive';
import { TransientDownsamplingDtoGQL } from '../graphQL/transientDownsampling';
import { GetEntitiesByCkTypeDtoGQL } from '../graphQL/getEntitiesByCkType';

/**
 * Specs for QueryExecutorService — covers the GraphQL-shape → flat result mapping
 * and the family-driven dispatch (incl. lazy family lookup for legacy widget configs).
 *
 * The raw Apollo response wraps `cells` in a Relay-style connection (`{ items: [...] }`);
 * the executor flattens it to `cells: QueryCell[]` before widgets ever see it.
 * These specs lock that contract in place.
 */
describe('QueryExecutorService', () => {
  let service: QueryExecutorService;
  let runtimeGqlSpy: jasmine.SpyObj<ExecuteRuntimeQueryDtoGQL>;
  let streamDataGqlSpy: jasmine.SpyObj<ExecuteStreamDataQueryDtoGQL>;
  let persistentQueriesGqlSpy: jasmine.SpyObj<GetSystemPersistentQueriesDtoGQL>;
  let resolveSeriesGqlSpy: jasmine.SpyObj<ResolveSeriesQueryDtoGQL>;
  let queryArchiveGqlSpy: jasmine.SpyObj<GetStreamDataQueryArchiveDtoGQL>;
  let downsampleGqlSpy: jasmine.SpyObj<TransientDownsamplingDtoGQL>;
  let entitiesGqlSpy: jasmine.SpyObj<GetEntitiesByCkTypeDtoGQL>;

  function makeApolloResult(data: unknown): { data: unknown; loading: false; networkStatus: 7 } {
    return { data, loading: false, networkStatus: 7 };
  }

  beforeEach(() => {
    runtimeGqlSpy = jasmine.createSpyObj('ExecuteRuntimeQueryDtoGQL', ['fetch']);
    streamDataGqlSpy = jasmine.createSpyObj('ExecuteStreamDataQueryDtoGQL', ['fetch']);
    persistentQueriesGqlSpy = jasmine.createSpyObj('GetSystemPersistentQueriesDtoGQL', ['fetch']);
    resolveSeriesGqlSpy = jasmine.createSpyObj('ResolveSeriesQueryDtoGQL', ['fetch']);
    queryArchiveGqlSpy = jasmine.createSpyObj('GetStreamDataQueryArchiveDtoGQL', ['fetch']);
    downsampleGqlSpy = jasmine.createSpyObj('TransientDownsamplingDtoGQL', ['fetch']);
    entitiesGqlSpy = jasmine.createSpyObj('GetEntitiesByCkTypeDtoGQL', ['fetch']);

    TestBed.configureTestingModule({
      providers: [
        QueryExecutorService,
        { provide: ExecuteRuntimeQueryDtoGQL, useValue: runtimeGqlSpy },
        { provide: ExecuteStreamDataQueryDtoGQL, useValue: streamDataGqlSpy },
        { provide: GetSystemPersistentQueriesDtoGQL, useValue: persistentQueriesGqlSpy },
        { provide: ResolveSeriesQueryDtoGQL, useValue: resolveSeriesGqlSpy },
        { provide: GetStreamDataQueryArchiveDtoGQL, useValue: queryArchiveGqlSpy },
        { provide: TransientDownsamplingDtoGQL, useValue: downsampleGqlSpy },
        { provide: GetEntitiesByCkTypeDtoGQL, useValue: entitiesGqlSpy }
      ]
    });

    service = TestBed.inject(QueryExecutorService);
  });

  // ==========================================================================
  // executeRuntime
  // ==========================================================================

  describe('executeRuntime', () => {
    it('flattens cells.items into a flat QueryCell[] on the row', async () => {
      runtimeGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: {
          runtimeQuery: {
            items: [{
              queryRtId: 'q1',
              associatedCkTypeId: 'OctoSdk/Customer',
              columns: [
                { attributePath: 'name', attributeValueType: 'String', aggregationType: null }
              ],
              rows: {
                totalCount: 1,
                pageInfo: { hasNextPage: false, endCursor: 'cursor-end' },
                items: [{
                  __typename: 'RtSimpleQueryRow',
                  rtId: 'rt-1',
                  ckTypeId: 'OctoSdk/Customer',
                  cells: { items: [{ attributePath: 'name', value: 'Acme' }] }
                }]
              }
            }]
          }
        }
      })) as never);

      const result = await firstValueFrom(service.executeRuntime('q1'));

      expect(result.family).toBe('runtime');
      expect(result.totalCount).toBe(1);
      expect(result.hasNextPage).toBeFalse();
      expect(result.endCursor).toBe('cursor-end');
      expect(result.columns).toEqual([
        { attributePath: 'name', attributeValueType: 'String', aggregationType: null }
      ]);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].__typename).toBe('RtSimpleQueryRow');
      expect(result.rows[0].rtId).toBe('rt-1');
      // The key invariant: cells is a flat array, not a connection
      expect(result.rows[0].cells).toEqual([{ attributePath: 'name', value: 'Acme' }]);
    });

    it('returns an empty result when the query item is missing', async () => {
      runtimeGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: { runtimeQuery: { items: [] } }
      })) as never);

      const result = await firstValueFrom(service.executeRuntime('q-missing'));

      expect(result.family).toBe('runtime');
      expect(result.rows).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.hasNextPage).toBeFalse();
    });

    it('uses cache-first by default and network-only on forceRefresh', async () => {
      runtimeGqlSpy.fetch.and.returnValue(of(makeApolloResult({ runtime: { runtimeQuery: { items: [] } } })) as never);

      await firstValueFrom(service.executeRuntime('q1'));
      const firstOpts = runtimeGqlSpy.fetch.calls.mostRecent().args[0] as Record<string, unknown>;
      expect(firstOpts['fetchPolicy']).toBe('cache-first');

      await firstValueFrom(service.executeRuntime('q1', { forceRefresh: true }));
      const secondOpts = runtimeGqlSpy.fetch.calls.mostRecent().args[0] as Record<string, unknown>;
      expect(secondOpts['fetchPolicy']).toBe('network-only');
    });
  });

  // ==========================================================================
  // executeStreamData
  // ==========================================================================

  describe('executeStreamData', () => {
    it('lifts timestamp / rtWellKnownName / change dates onto the row', async () => {
      const ts = new Date('2026-06-24T12:00:00Z');
      streamDataGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: {
          streamDataQuery: {
            items: [{
              queryRtId: 'sd-q-1',
              associatedCkTypeId: 'Basic.Energy/EnergyMeasurement',
              columns: [
                { attributePath: 'amount_value', attributeValueType: 'Double', aggregationType: null }
              ],
              rows: {
                totalCount: 1,
                pageInfo: { hasNextPage: false, endCursor: null },
                items: [{
                  __typename: 'StreamDataQueryRow',
                  rtId: 'rt-sd-1',
                  ckTypeId: { fullName: 'Basic.Energy/EnergyMeasurement' },
                  timestamp: ts,
                  rtWellKnownName: 'meter-A',
                  rtCreationDateTime: ts,
                  rtChangedDateTime: ts,
                  cells: { items: [{ attributePath: 'amount_value', value: 42.5 }] }
                }]
              }
            }]
          }
        }
      })) as never);

      const result = await firstValueFrom(service.executeStreamData('sd-q-1'));

      expect(result.family).toBe('streamData');
      expect(result.rows.length).toBe(1);
      const row = result.rows[0];
      expect(row.timestamp).toBe(ts);
      expect(row.rtWellKnownName).toBe('meter-A');
      expect(row.rtCreationDateTime).toBe(ts);
      expect(row.rtChangedDateTime).toBe(ts);
      // ckTypeId comes through as the unwrapped string regardless of nested DTO
      expect(row.ckTypeId).toBe('Basic.Energy/EnergyMeasurement');
      expect(row.cells).toEqual([{ attributePath: 'amount_value', value: 42.5 }]);
    });

    it('defaults __typename to StreamDataQueryRow when the backend omits it', async () => {
      streamDataGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: {
          streamDataQuery: {
            items: [{
              queryRtId: 'q', associatedCkTypeId: null, columns: [],
              rows: {
                totalCount: 1, pageInfo: { hasNextPage: false, endCursor: null },
                items: [{ rtId: 'r', ckTypeId: null, timestamp: null, cells: { items: [] } }]
              }
            }]
          }
        }
      })) as never);

      const result = await firstValueFrom(service.executeStreamData('q'));
      expect(result.rows[0].__typename).toBe('StreamDataQueryRow');
    });

    it('omits the `arg` GraphQL variable when no streamDataArgs are supplied', async () => {
      streamDataGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { streamDataQuery: { items: [] } }
      })) as never);

      await firstValueFrom(service.executeStreamData('q'));

      const opts = streamDataGqlSpy.fetch.calls.mostRecent().args[0] as { variables: Record<string, unknown> };
      expect(opts.variables['arg']).toBeUndefined();
    });

    it('sends the `arg` with caller-provided from/to/limit + default queryMode', async () => {
      streamDataGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { streamDataQuery: { items: [] } }
      })) as never);

      const from = new Date('2026-01-01T00:00:00Z');
      const to = new Date('2026-12-31T23:59:59Z');
      await firstValueFrom(service.executeStreamData('q', {
        streamDataArgs: { from, to, limit: 100 }
      }));

      const opts = streamDataGqlSpy.fetch.calls.mostRecent().args[0] as { variables: Record<string, unknown> };
      const arg = opts.variables['arg'] as Record<string, unknown>;
      expect(arg).toBeDefined();
      expect(arg['from']).toBe(from);
      expect(arg['to']).toBe(to);
      expect(arg['limit']).toBe(100);
      // queryMode defaults to Default because the GraphQL schema marks it NonNull —
      // the backend ignores it on dispatch (see AB#4235), but we still must send it.
      expect(arg['queryMode']).toBe(QueryModeDto.DefaultDto);
    });

    it('preserves a caller-provided queryMode override on the arg', async () => {
      streamDataGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { streamDataQuery: { items: [] } }
      })) as never);

      await firstValueFrom(service.executeStreamData('q', {
        streamDataArgs: { limit: 50, queryMode: QueryModeDto.DownsamplingDto }
      }));

      const opts = streamDataGqlSpy.fetch.calls.mostRecent().args[0] as { variables: Record<string, unknown> };
      const arg = opts.variables['arg'] as Record<string, unknown>;
      expect(arg['queryMode']).toBe(QueryModeDto.DownsamplingDto);
    });
  });

  // ==========================================================================
  // execute() — family dispatch
  // ==========================================================================

  describe('execute', () => {
    it('dispatches to the runtime path when family is "runtime"', async () => {
      runtimeGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: { runtimeQuery: { items: [] } }
      })) as never);

      await firstValueFrom(service.execute('runtime', 'q'));

      expect(runtimeGqlSpy.fetch).toHaveBeenCalledTimes(1);
      expect(streamDataGqlSpy.fetch).not.toHaveBeenCalled();
    });

    it('dispatches to the streamData path when family is "streamData"', async () => {
      streamDataGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { streamDataQuery: { items: [] } }
      })) as never);

      await firstValueFrom(service.execute('streamData', 'q'));

      expect(streamDataGqlSpy.fetch).toHaveBeenCalledTimes(1);
      expect(runtimeGqlSpy.fetch).not.toHaveBeenCalled();
    });

    it('looks up the family from systemPersistentQuery when family is undefined', async () => {
      persistentQueriesGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: {
          systemPersistentQuery: {
            items: [{ ckTypeId: 'System.Query/SimpleSdQuery' }]
          }
        }
      })) as never);
      streamDataGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { streamDataQuery: { items: [] } }
      })) as never);

      await firstValueFrom(service.execute(undefined, 'q-legacy'));

      expect(persistentQueriesGqlSpy.fetch).toHaveBeenCalledTimes(1);
      expect(streamDataGqlSpy.fetch).toHaveBeenCalledTimes(1);
      expect(runtimeGqlSpy.fetch).not.toHaveBeenCalled();
    });

    it('caches the resolved family per queryRtId — second call skips the lookup', async () => {
      persistentQueriesGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: { systemPersistentQuery: { items: [{ ckTypeId: 'System.Query/SimpleSdQuery' }] } }
      })) as never);
      streamDataGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { streamDataQuery: { items: [] } }
      })) as never);

      await firstValueFrom(service.execute(undefined, 'q-cached'));
      await firstValueFrom(service.execute(undefined, 'q-cached'));

      expect(persistentQueriesGqlSpy.fetch).toHaveBeenCalledTimes(1);
      expect(streamDataGqlSpy.fetch).toHaveBeenCalledTimes(2);
    });

    it('falls back to "runtime" when the family lookup throws', async () => {
      persistentQueriesGqlSpy.fetch.and.returnValue(throwError(() => new Error('network')) as never);
      runtimeGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: { runtimeQuery: { items: [] } }
      })) as never);

      await firstValueFrom(service.execute(undefined, 'q-unknown'));

      expect(runtimeGqlSpy.fetch).toHaveBeenCalledTimes(1);
      expect(streamDataGqlSpy.fetch).not.toHaveBeenCalled();
    });

    it('falls back to "runtime" when the lookup returns an unclassifiable type', async () => {
      persistentQueriesGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: { systemPersistentQuery: { items: [{ ckTypeId: 'System.Query/Legacy' }] } }
      })) as never);
      runtimeGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: { runtimeQuery: { items: [] } }
      })) as never);

      await firstValueFrom(service.execute(undefined, 'q-legacy'));

      expect(runtimeGqlSpy.fetch).toHaveBeenCalledTimes(1);
      expect(streamDataGqlSpy.fetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // resolveSeriesQuery (AB#4290)
  // ==========================================================================
  describe('resolveSeriesQuery', () => {
    const input = {
      baseArchiveRtId: 'base-1',
      from: new Date('2025-01-01T00:00:00Z'),
      to: new Date('2026-01-01T00:00:00Z'),
      targetPoints: 600,
      requiredAggregation: CkRollupFunctionDto.SumDto,
      sourcePath: 'Amount.Value'
    };

    it('maps the backend routing decision to a flat result', async () => {
      resolveSeriesGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: {
          resolveSeriesQuery: {
            archiveRtId: 'rollup-1h',
            effectiveBucketMs: 52_560_000,
            points: 600,
            reducingFunction: CkRollupFunctionDto.SumDto,
            signal: SeriesResolutionSignalDto.OkDto,
            actualPoints: null,
            diagnostic: null
          }
        }
      })) as ReturnType<typeof resolveSeriesGqlSpy.fetch>);

      const result = await service.resolveSeriesQuery(input);

      expect(result).not.toBeNull();
      expect(result!.archiveRtId).toBe('rollup-1h');
      expect(result!.points).toBe(600);
      expect(result!.reducingFunction).toBe(CkRollupFunctionDto.SumDto);
      expect(result!.signal).toBe(SeriesResolutionSignalDto.OkDto);
    });

    it('returns null when StreamData is not enabled (no decision)', async () => {
      resolveSeriesGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { resolveSeriesQuery: null }
      })) as ReturnType<typeof resolveSeriesGqlSpy.fetch>);

      const result = await service.resolveSeriesQuery(input);

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Resolution-aware routing (AB#4290): archive lookup, transient downsample, labels
  // ==========================================================================
  describe('resolution-aware routing (AB#4290)', () => {
    it('fetchQueryArchive returns the base archive rtId and ck type without executing the query', async () => {
      queryArchiveGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { streamDataQuery: { items: [{ queryRtId: 'q1', associatedCkTypeId: 'Basic.Energy/EnergyMeasurement', archiveRtId: 'base-1' }] } }
      })) as ReturnType<typeof queryArchiveGqlSpy.fetch>);

      const info = await service.fetchQueryArchive('q1');

      expect(info).toEqual({ archiveRtId: 'base-1', ckTypeId: 'Basic.Energy/EnergyMeasurement' });
    });

    it('fetchQueryArchive returns null when the query has no archive', async () => {
      queryArchiveGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { streamDataQuery: { items: [] } }
      })) as ReturnType<typeof queryArchiveGqlSpy.fetch>);

      expect(await service.fetchQueryArchive('missing')).toBeNull();
    });

    it('downsampleByArchive sends one column path with the reducer + scope and flattens the rows', async () => {
      downsampleGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        streamData: { transientStreamDataQuery: { downsampling: { items: [{ rows: { totalCount: 1, items: [
          { rtId: '0', timestamp: '2026-01-01T00:00:00Z', cells: { items: [{ attributePath: 'amountvalue_sum', value: 42 }] } }
        ] } }] } } }
      })) as ReturnType<typeof downsampleGqlSpy.fetch>);

      const rows = await service.downsampleByArchive({
        archiveRtId: 'rollup-1', from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-12-31T00:00:00Z'),
        limit: 600, sourcePath: 'Amount.Value', aggregation: 'SUM', rtIds: ['em-1']
      });

      const options = downsampleGqlSpy.fetch.calls.mostRecent().args[0] as { variables: Record<string, unknown> };
      expect(options.variables['columnPaths']).toEqual([{ attributePath: 'Amount.Value', aggregationType: 'SUM' }]);
      expect(options.variables['rtIds']).toEqual(['em-1']);
      expect(rows.length).toBe(1);
      expect(rows[0].cells).toEqual([{ attributePath: 'amountvalue_sum', value: 42 }]);
    });

    it('fetchSeriesLabels maps the archive-column series field to the CK attribute (obis_code → obisCode)', async () => {
      entitiesGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: { runtimeEntities: { items: [{ attributes: { items: [
          { attributeName: 'obisCode', value: '1-1:1.9.0 P.01' },
          { attributeName: 'amount', value: 5 }
        ] } }] } }
      })) as ReturnType<typeof entitiesGqlSpy.fetch>);

      const labels = await service.fetchSeriesLabels('Basic.Energy/EnergyMeasurement', ['em-1'], 'obis_code');

      expect(labels.get('em-1')).toBe('1-1:1.9.0 P.01');
    });
  });

  describe('fetchEntityGroups (AB#4714)', () => {
    // Domain-neutral fixtures: the mechanism buckets by whatever `groupField` is configured.
    const entities = (rows: { rtId: string; group: string | null }[]) => makeApolloResult({
      runtime: { runtimeEntities: { totalCount: rows.length, items: rows.map(r => ({
        rtId: r.rtId,
        attributes: { items: r.group == null ? [] : [{ attributeName: 'category', value: r.group }] }
      })) } }
    });

    it('buckets source rtIds by the group attribute (many sources → few groups)', async () => {
      entitiesGqlSpy.fetch.and.returnValue(of(entities([
        { rtId: 's1', group: 'A' },
        { rtId: 's2', group: 'A' },
        { rtId: 's3', group: 'B' }
      ])) as ReturnType<typeof entitiesGqlSpy.fetch>);

      const groups = await service.fetchEntityGroups('Test/Type', 'category', undefined);

      expect(groups.size).toBe(2);
      expect(groups.get('A')).toEqual(['s1', 's2']);
      expect(groups.get('B')).toEqual(['s3']);
    });

    it('matches the group field canonically (case / non-alphanumerics ignored)', async () => {
      entitiesGqlSpy.fetch.and.returnValue(of(entities([{ rtId: 's1', group: 'A' }])) as ReturnType<typeof entitiesGqlSpy.fetch>);

      // Configured field 'cate_gory' resolves to the CK attribute 'category'.
      const groups = await service.fetchEntityGroups('Test/Type', 'Cate_Gory');

      expect(groups.get('A')).toEqual(['s1']);
    });

    it('restricts to a caller scope and drops entities with no group value', async () => {
      entitiesGqlSpy.fetch.and.returnValue(of(entities([
        { rtId: 's1', group: 'A' },
        { rtId: 's2', group: 'A' },
        { rtId: 's3', group: null }
      ])) as ReturnType<typeof entitiesGqlSpy.fetch>);

      const groups = await service.fetchEntityGroups('Test/Type', 'category', ['s1']);

      expect(groups.size).toBe(1);
      expect(groups.get('A')).toEqual(['s1']);
    });

    it('warns when the population exceeds the fetched page', async () => {
      const warn = spyOn(console, 'warn');
      entitiesGqlSpy.fetch.and.returnValue(of(makeApolloResult({
        runtime: { runtimeEntities: { totalCount: 9000, items: [{ rtId: 's1', attributes: { items: [
          { attributeName: 'category', value: 'A' }
        ] } }] } }
      })) as ReturnType<typeof entitiesGqlSpy.fetch>);

      await service.fetchEntityGroups('Test/Type', 'category');

      expect(warn).toHaveBeenCalled();
    });
  });
});
