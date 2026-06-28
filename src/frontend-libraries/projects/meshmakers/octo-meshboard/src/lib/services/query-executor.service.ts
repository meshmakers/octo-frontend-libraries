import { inject, Injectable } from '@angular/core';
import { Observable, firstValueFrom, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { FieldFilterDto, FieldFilterOperatorsDto, QueryModeDto, SortDto, StreamDataArgumentsDto } from '@meshmakers/octo-services';
import { ExecuteRuntimeQueryDtoGQL } from '../graphQL/executeRuntimeQuery';
import { ExecuteStreamDataQueryDtoGQL } from '../graphQL/executeStreamDataQuery';
import { GetSystemPersistentQueriesDtoGQL } from '../graphQL/getSystemPersistentQueries';
import { QueryFamily, queryFamily } from '../utils/query-family';

/**
 * Time-range and downsampling arguments for stream-data persistent queries.
 * Mirrors the GraphQL input `StreamDataArguments` so widgets can build it
 * without importing generated DTO types directly.
 *
 * Backend semantics (verified against StreamDataQueryDtoType.cs and
 * StreamDataVariantExecutor.cs; `queryMode` override added in AB#4233):
 * - `from` / `to` / `limit` override the persisted query's intrinsic values
 *   when set (`execOverride?.From ?? simple.From` pattern in the resolver).
 * - `interval` is currently ignored by every variant; the downsampling path
 *   derives `(to - from) / limit` itself.
 * - `queryMode: DOWNSAMPLING` on a `SimpleSdQuery` (persisted) or the transient
 *   `simple` sub-connection now drives the downsampling execution path: with a
 *   full from/to/limit contract the backend reduces to `limit` buckets per series
 *   (per-type reducers + group-by source rtId). Without all three it falls back
 *   to raw rows. For the other variants the execution shape still comes from the
 *   CK subtype / sub-connection; `queryMode` is a no-op there.
 */
export interface StreamDataExecutionArgs {
  from?: Date | null;
  to?: Date | null;
  interval?: number | null;
  limit?: number | null;
  /**
   * `DOWNSAMPLING` switches a SimpleSdQuery / transient `simple` query to the
   * downsampling path (with from/to/limit); a no-op for the other variants.
   * Defaults to `Default` (raw rows).
   */
  queryMode?: QueryModeDto;
  /**
   * Source runtime ids to scope the query to. When set, replaces the persisted
   * RtIds on the query at execution time — used to scope a stream-data widget to
   * the entities resolved from a selected asset (e.g. the EnergyMeasurement rtIds
   * under a picked MeteringPoint). An empty array is treated as "no scope".
   */
  rtIds?: string[] | null;
}

export interface QueryExecutionOptions {
  /** Page size — passed to the GraphQL `first` variable. */
  first?: number | null;
  /** Cursor — passed to the GraphQL `after` variable. */
  after?: string | null;
  /** Optional column / row sort definitions. */
  sortOrder?: SortDto[] | null;
  /** Field filters applied to the query rows. */
  fieldFilter?: FieldFilterDto[] | null;
  /** Stream-data-only: time-range, interval, limit, queryMode. Ignored for runtime queries. */
  streamDataArgs?: StreamDataExecutionArgs | null;
  /** Force a network round-trip instead of using the Apollo cache. */
  forceRefresh?: boolean;
}

export interface QueryColumnInfo {
  attributePath: string;
  attributeValueType?: string | null;
  aggregationType?: string | null;
}

export interface QueryCell {
  attributePath: string;
  value: unknown;
}

/**
 * Unified result-row shape across runtime and stream-data queries.
 * `__typename` lets callers distinguish row kinds when needed
 * (`RtSimpleQueryRow`, `RtAggregationQueryRow`, `RtGroupingAggregationQueryRow`,
 * `StreamDataQueryRow`).
 *
 * Stream-data rows surface `timestamp`, `rtWellKnownName`,
 * `rtCreationDateTime`, and `rtChangedDateTime` directly on the row — useful
 * for time-series x-axes. Runtime rows leave those fields undefined.
 */
export interface QueryResultRow {
  __typename?: string;
  rtId?: string | null;
  ckTypeId?: string | null;
  timestamp?: Date | null;
  rtWellKnownName?: string | null;
  rtCreationDateTime?: Date | null;
  rtChangedDateTime?: Date | null;
  cells: QueryCell[];
}

export interface QueryExecutionResult {
  family: QueryFamily;
  queryRtId?: string | null;
  associatedCkTypeId?: string | null;
  columns: QueryColumnInfo[];
  rows: QueryResultRow[];
  totalCount: number;
  hasNextPage: boolean;
  endCursor?: string | null;
}

const EMPTY_RESULT_BASE = Object.freeze({
  queryRtId: null,
  associatedCkTypeId: null,
  columns: [] as QueryColumnInfo[],
  rows: [] as QueryResultRow[],
  totalCount: 0,
  hasNextPage: false,
  endCursor: null
});

/**
 * Executes persistent queries by rtId and returns a unified result shape
 * regardless of whether the underlying query is runtime-data or stream-data.
 *
 * Widgets consume `QueryExecutionResult` and stay agnostic about which family
 * the saved query belongs to — switching a widget's data source between
 * runtime and stream-data is purely a configuration change.
 */
@Injectable({ providedIn: 'root' })
export class QueryExecutorService {
  private readonly runtimeGql = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly streamDataGql = inject(ExecuteStreamDataQueryDtoGQL);
  private readonly persistentQueriesGql = inject(GetSystemPersistentQueriesDtoGQL);

  /**
   * Cache of resolved query families, keyed by query rtId. Filled lazily for
   * legacy widget configs that pre-date the `queryFamily` field — saves a
   * round-trip on every refresh.
   */
  private readonly familyCache = new Map<string, QueryFamily>();

  execute(family: QueryFamily | undefined, queryRtId: string, options: QueryExecutionOptions = {}): Observable<QueryExecutionResult> {
    if (family) {
      return family === 'streamData'
        ? this.executeStreamData(queryRtId, options)
        : this.executeRuntime(queryRtId, options);
    }

    // Family unknown — look it up from the persistent-query entity once and
    // route accordingly. Legacy widget configs (saved before queryFamily was
    // persisted) hit this path; subsequent calls in the same session use the
    // cached family.
    return from(this.resolveFamily(queryRtId)).pipe(
      switchMap(resolved => resolved === 'streamData'
        ? this.executeStreamData(queryRtId, options)
        : this.executeRuntime(queryRtId, options))
    );
  }

  /**
   * Resolves the family of a persistent query by rtId. Falls back to
   * `'runtime'` when the query type cannot be classified — this matches the
   * pre-Phase-1 behavior.
   */
  async resolveFamily(queryRtId: string): Promise<QueryFamily> {
    const cached = this.familyCache.get(queryRtId);
    if (cached) return cached;

    try {
      const result = await firstValueFrom(this.persistentQueriesGql.fetch({
        variables: {
          first: 1,
          fieldFilters: [{ attributePath: 'rtId', operator: FieldFilterOperatorsDto.EqualsDto, comparisonValue: queryRtId }]
        }
      }));
      const item = result.data?.runtime?.systemPersistentQuery?.items?.[0];
      const resolved = queryFamily(item?.ckTypeId ?? null) ?? 'runtime';
      this.familyCache.set(queryRtId, resolved);
      return resolved;
    } catch (error) {
      console.warn('QueryExecutorService: family lookup failed for', queryRtId, '— defaulting to runtime', error);
      return 'runtime';
    }
  }

  executeRuntime(queryRtId: string, options: QueryExecutionOptions = {}): Observable<QueryExecutionResult> {
    return this.runtimeGql.fetch({
      variables: {
        rtId: queryRtId,
        first: options.first ?? undefined,
        after: options.after ?? undefined,
        fieldFilter: options.fieldFilter ?? undefined
      },
      fetchPolicy: options.forceRefresh ? 'network-only' : 'cache-first'
    }).pipe(
      map(result => {
        const queryItem = result.data?.runtime?.runtimeQuery?.items?.[0];
        if (!queryItem) {
          return { family: 'runtime', ...EMPTY_RESULT_BASE };
        }
        return {
          family: 'runtime' as const,
          queryRtId: queryItem.queryRtId ?? null,
          associatedCkTypeId: queryItem.associatedCkTypeId ?? null,
          columns: this.mapColumns(queryItem.columns),
          rows: this.mapRuntimeRows(queryItem.rows?.items),
          totalCount: queryItem.rows?.totalCount ?? 0,
          hasNextPage: queryItem.rows?.pageInfo?.hasNextPage ?? false,
          endCursor: queryItem.rows?.pageInfo?.endCursor ?? null
        };
      })
    );
  }

  executeStreamData(queryRtId: string, options: QueryExecutionOptions = {}): Observable<QueryExecutionResult> {
    const arg = options.streamDataArgs ? this.buildStreamDataArg(options.streamDataArgs) : undefined;
    return this.streamDataGql.fetch({
      variables: {
        rtId: queryRtId,
        first: options.first ?? undefined,
        after: options.after ?? undefined,
        sortOrder: options.sortOrder ?? undefined,
        fieldFilter: options.fieldFilter ?? undefined,
        arg
      },
      fetchPolicy: options.forceRefresh ? 'network-only' : 'cache-first'
    }).pipe(
      map(result => {
        const queryItem = result.data?.streamData?.streamDataQuery?.items?.[0];
        if (!queryItem) {
          return { family: 'streamData', ...EMPTY_RESULT_BASE };
        }
        return {
          family: 'streamData' as const,
          queryRtId: queryItem.queryRtId ?? null,
          associatedCkTypeId: queryItem.associatedCkTypeId ?? null,
          columns: this.mapColumns(queryItem.columns),
          rows: this.mapStreamDataRows(queryItem.rows?.items),
          totalCount: queryItem.rows?.totalCount ?? 0,
          hasNextPage: queryItem.rows?.pageInfo?.hasNextPage ?? false,
          endCursor: queryItem.rows?.pageInfo?.endCursor ?? null
        };
      })
    );
  }

  private buildStreamDataArg(args: StreamDataExecutionArgs): StreamDataArgumentsDto | undefined {
    // Skip the entire `arg` field when the caller has nothing to override —
    // the persisted query then runs with its intrinsic from/to/limit and the
    // GraphQL request stays minimal.
    const hasRtIds = args.rtIds != null && args.rtIds.length > 0;
    const hasOverride = args.from != null || args.to != null || args.interval != null || args.limit != null || args.queryMode != null || hasRtIds;
    if (!hasOverride) {
      return undefined;
    }
    // `queryMode` defaults to Default because the schema requires it. The
    // backend dispatcher ignores it (variant comes from the persisted entity's
    // CK subtype); see the type-level doc comment for the full story.
    return {
      from: args.from ?? undefined,
      to: args.to ?? undefined,
      interval: args.interval ?? undefined,
      limit: args.limit ?? undefined,
      rtIds: hasRtIds ? args.rtIds : undefined,
      queryMode: args.queryMode ?? QueryModeDto.DefaultDto
    };
  }

  private mapColumns(columns: readonly ({ attributePath?: string | null; attributeValueType?: string | null; aggregationType?: string | null } | null)[] | null | undefined): QueryColumnInfo[] {
    if (!columns) return [];
    const result: QueryColumnInfo[] = [];
    for (const col of columns) {
      if (!col?.attributePath) continue;
      result.push({
        attributePath: col.attributePath,
        attributeValueType: col.attributeValueType ?? null,
        aggregationType: col.aggregationType ?? null
      });
    }
    return result;
  }

  private mapRuntimeRows(rows: readonly unknown[] | null | undefined): QueryResultRow[] {
    if (!rows) return [];
    const result: QueryResultRow[] = [];
    for (const row of rows) {
      if (!row) continue;
      const r = row as { __typename?: string; rtId?: string; ckTypeId?: string; cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };
      result.push({
        __typename: r.__typename,
        rtId: r.rtId ?? null,
        ckTypeId: r.ckTypeId ?? null,
        cells: this.mapCells(r.cells?.items)
      });
    }
    return result;
  }

  private mapStreamDataRows(rows: readonly unknown[] | null | undefined): QueryResultRow[] {
    if (!rows) return [];
    const result: QueryResultRow[] = [];
    for (const row of rows) {
      if (!row) continue;
      const r = row as {
        __typename?: string;
        rtId?: string;
        ckTypeId?: { fullName?: string | null } | string | null;
        timestamp?: Date | null;
        rtWellKnownName?: string | null;
        rtCreationDateTime?: Date | null;
        rtChangedDateTime?: Date | null;
        cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null;
      };
      const ckTypeId = typeof r.ckTypeId === 'string' ? r.ckTypeId : (r.ckTypeId?.fullName ?? null);
      result.push({
        __typename: r.__typename ?? 'StreamDataQueryRow',
        rtId: r.rtId ?? null,
        ckTypeId,
        timestamp: r.timestamp ?? null,
        rtWellKnownName: r.rtWellKnownName ?? null,
        rtCreationDateTime: r.rtCreationDateTime ?? null,
        rtChangedDateTime: r.rtChangedDateTime ?? null,
        cells: this.mapCells(r.cells?.items)
      });
    }
    return result;
  }

  private mapCells(cells: readonly ({ attributePath?: string; value?: unknown } | null)[] | null | undefined): QueryCell[] {
    if (!cells) return [];
    const result: QueryCell[] = [];
    for (const cell of cells) {
      if (!cell?.attributePath) continue;
      result.push({ attributePath: cell.attributePath, value: cell.value });
    }
    return result;
  }
}
