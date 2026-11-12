import { Directive, forwardRef, inject, Input, signal, Signal, Output, EventEmitter } from '@angular/core';
import { EMPTY, NEVER, Observable, from, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { OctoGraphQlDataSource, SecretSafeAttributeNamesService } from '@meshmakers/octo-ui';
import { DataSourceBase, FetchDataOptions, FetchResultTyped, ListViewComponent } from '@meshmakers/shared-ui';
import { GraphQL, FieldFilterDto } from '@meshmakers/octo-services';
import { TableWidgetConfig, TableColumn, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { QueryExecutorService, QueryResultRow, StreamDataExecutionArgs } from '../../services/query-executor.service';
import { matchesAttributePath } from '../../utils/widget-data-utils';

/**
 * Column info derived from a persistent query response
 */
export interface QueryColumn {
  attributePath: string;
  attributeValueType: string;
}

/**
 * DataSource directive for the Table Widget.
 * Fetches entities based on the widget configuration (ckTypeId, filters, sorting).
 * Supports both RuntimeEntity and PersistentQuery data sources.
 */
@Directive({
  selector: '[mmTableWidgetDataSource]',
  exportAs: 'mmTableWidgetDataSource',
  providers: [
    {
      provide: DataSourceBase,
      useExisting: forwardRef(() => TableWidgetDataSourceDirective)
    }
  ]
})
export class TableWidgetDataSourceDirective extends OctoGraphQlDataSource<Record<string, unknown>> {
  private readonly getEntitiesByCkTypeGQL = inject(GetEntitiesByCkTypeDtoGQL);
  private readonly secretSafeNames = inject(SecretSafeAttributeNamesService);
  private readonly queryExecutor = inject(QueryExecutorService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  private _config: TableWidgetConfig | null = null;

  /**
   * Signature of the query inputs outside the grid state (data source, resolved
   * widget filters, time filter, entity-selector scope) of the last fetch.
   * `null` until the first fetch. See {@link refetch}.
   */
  private _lastQueryInputs: string | null = null;

  /** Signal for dynamically derived columns from persistent query */
  private readonly _queryColumns = signal<QueryColumn[]>([]);

  /** Exposed signal for reading derived columns */
  readonly queryColumns: Signal<QueryColumn[]> = this._queryColumns.asReadonly();

  /** Derived TableColumn array from persistent query columns */
  readonly derivedColumns: Signal<TableColumn[]> = signal([]);

  /** Event emitted when query columns are loaded from a persistent query */
  @Output() queryColumnsLoaded = new EventEmitter<QueryColumn[]>();

  @Input() set config(value: TableWidgetConfig | null) {
    this._config = value;
    if (value) {
      // Set search filter attribute paths based on columns (for runtimeEntity)
      if (value.dataSource.type === 'runtimeEntity') {
        this.searchFilterAttributePaths = value.columns.map(c => c.field);
      }
    }
  }

  get config(): TableWidgetConfig | null {
    return this._config;
  }

  constructor() {
    const listViewComponent = inject(ListViewComponent);
    super(listViewComponent);
  }

  /**
   * Refetches the widget data (board refresh, auto-refresh, config change).
   *
   * When a query input outside the grid state changed since the last fetch — a
   * MeshBoard variable or widget filter, the time filter, the entity-selector
   * scope or the data source itself — the result set is a different one, so the
   * list returns to page 1 before the query is sent (AB#8801). Otherwise the old
   * page offset could point past the end of the new result (asset repository:
   * ASSET1002 / INCOMPLETE_SLICE). A plain refresh with unchanged inputs keeps
   * the current page.
   */
  public refetch(): void {
    const previous = this._lastQueryInputs;
    const resetSkip = previous !== null && previous !== this.queryInputsSignature();
    this.fetchAgain(resetSkip ? { resetSkip: true } : undefined);
  }

  public override fetchData(queryOptions: FetchDataOptions): Observable<FetchResultTyped<Record<string, unknown>> | null> {
    this._lastQueryInputs = this.queryInputsSignature();

    if (!this._config) {
      return of(new FetchResultTyped<Record<string, unknown>>([], 0));
    }

    const dataSource = this._config.dataSource;

    // Handle persistent query data source
    if (dataSource.type === 'persistentQuery') {
      return this.fetchPersistentQueryData(dataSource, queryOptions);
    }

    // Handle runtime entity data source
    if (dataSource.type !== 'runtimeEntity' || !dataSource.ckTypeId) {
      return of(new FetchResultTyped<Record<string, unknown>>([], 0));
    }

    // Get sort, filter definitions from query options (from grid state)
    const sort = this.getSortDefinitions(queryOptions.state);
    const searchFilterDto = this.getSearchFilterDefinitions(queryOptions.textSearch);
    const gridFieldFilters = this.getFieldFilterDefinitions(queryOptions.state);

    // Merge widget-configured filters with grid filters
    let allFilters: FieldFilterDto[] = [];

    // Add widget-configured filters (with variable resolution)
    if (this._config.filters && this._config.filters.length > 0) {
      const resolvedFilters = this.convertFiltersToDto(this._config.filters);
      if (resolvedFilters) {
        allFilters = [...resolvedFilters];
      }
    }

    // Add grid filters (from row filter or other grid interactions)
    if (gridFieldFilters && gridFieldFilters.length > 0) {
      allFilters = [...allFilters, ...gridFieldFilters];
    }

    // All non-secret attributes of the type, incl. record sub-attributes (SECRET-safe, AB#5542).
    const ckTypeId = dataSource.ckTypeId;
    const first = queryOptions.state.take ?? this._config.pageSize ?? 10;
    return from(this.secretSafeNames.forCkType(ckTypeId)).pipe(
      switchMap(attributeNames => this.getEntitiesByCkTypeGQL.fetch({
        variables: {
          ckTypeId,
          attributeNames,
          first,
          after: GraphQL.offsetToCursor(queryOptions.state.skip ?? 0),
          sort: sort,
          fieldFilters: allFilters.length > 0 ? allFilters : undefined,
          searchFilter: searchFilterDto
        },
        fetchPolicy: queryOptions.forceRefresh ? 'network-only' : 'cache-first',
        context: this.pageOutOfRangeContext
      })),
      map(result => {
        const items = result.data?.runtime?.runtimeEntities?.items ?? [];
        const totalCount = result.data?.runtime?.runtimeEntities?.totalCount ?? 0;

        // Transform items to flat records for the grid
        const data = items
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map(item => {
            const record: Record<string, unknown> = {
              rtId: item.rtId,
              ckTypeId: item.ckTypeId,
              rtWellKnownName: item.rtWellKnownName
            };

            // Flatten attributes into the record (including nested record attributes)
            if (item.attributes?.items) {
              this.flattenAttributes(item.attributes.items, record, '');
            }

            return record;
          });

        return new FetchResultTyped<Record<string, unknown>>(data, totalCount);
      }),
      catchError(err => this.handleFetchError(err, queryOptions, 'Error fetching table data:'))
    );
  }

  /**
   * Error path of both fetch paths. A page offset beyond the result set
   * (ASSET1002 / INCOMPLETE_SLICE, e.g. the data shrank since the last load)
   * is not shown as an empty list: the list returns to page 1 and refetches
   * once (AB#8801). The refetch runs on a microtask so the list binding's
   * current subscription has ended first; skip 0 cannot be out of range, so
   * this cannot loop. Any other error keeps today's behaviour (logged, no rows).
   */
  private handleFetchError(
    err: unknown,
    queryOptions: FetchDataOptions,
    logMessage: string
  ): Observable<FetchResultTyped<Record<string, unknown>>> {
    const skip = queryOptions.state.skip ?? 0;
    if (skip > 0 && this.isPageOutOfRangeError(err)) {
      console.warn(`octo-meshboard: table widget page offset ${skip} lies beyond the result; returning to page 1`);
      queueMicrotask(() => this.fetchAgain({ resetSkip: true }));
      return EMPTY;
    }
    console.error(logMessage, err);
    return of(new FetchResultTyped<Record<string, unknown>>([], 0));
  }

  /**
   * Signature of every query input outside the grid state (paging, sort, grid
   * filter): the data source, the widget filters with MeshBoard variables
   * resolved, the time filter selection and the entity-selector scope. The time
   * filter enters as its selection, not as resolved instants, so a relative
   * range ("last 24 hours") does not look changed on every auto-refresh. The
   * board's time-zone mode enters with an active selection (no host period),
   * because the selection's window is resolved in that zone.
   */
  private queryInputsSignature(): string {
    const config = this._config;
    if (!config) {
      return 'none';
    }
    const dataSource = config.dataSource;
    const filters = this.convertFiltersToDto(config.filters) ?? null;
    if (dataSource.type !== 'persistentQuery') {
      return JSON.stringify({ dataSource, filters });
    }
    const timeFilter = dataSource.ignoreTimeFilter ? null : (this.stateService.getConfig().timeFilter ?? null);
    const host = dataSource.ignoreTimeFilter ? null : this.stateService.hostTimeRange();
    // Host periods are absolute instants (no zone conversion), so the zone only
    // matters for the board's own selection.
    const timeZone = timeFilter?.enabled && timeFilter.selection && !host ? this.stateService.timeZoneMode() : null;
    const scope = this.stateService.resolveStreamDataScope(dataSource.entitySelectorId, dataSource.queryFamily, dataSource.ignoreTimeFilter);
    return JSON.stringify({ dataSource, filters, timeFilter, timeZone, host, scope });
  }

  /**
   * Recursively flattens attributes into the record using dot notation for nested attributes.
   * Handles nested CkRecord attributes by extracting their inner attributes.
   */
  private flattenAttributes(
    attributes: ({ attributeName?: string | null; value?: unknown } | null)[] | null | undefined,
    record: Record<string, unknown>,
    prefix: string
  ): void {
    if (!attributes) return;

    for (const attr of attributes) {
      if (!attr?.attributeName) continue;

      const key = prefix ? `${prefix}.${attr.attributeName}` : attr.attributeName;
      const value = attr.value;

      // Check if the value is a nested CkRecord (has ckRecordId and attributes)
      if (value && typeof value === 'object' && 'ckRecordId' in value) {
        const nestedRecord = value as {
          ckRecordId?: string;
          attributes?: ({ attributeName?: string | null; value?: unknown } | null)[] |
                       { items?: ({ attributeName?: string | null; value?: unknown } | null)[] }
        };

        // Store the ckRecordId as well
        record[`${key}.ckRecordId`] = nestedRecord.ckRecordId;

        // Recursively flatten nested attributes
        // Handle both direct array and { items: [] } structure
        if (nestedRecord.attributes) {
          if (Array.isArray(nestedRecord.attributes)) {
            // Direct array of attributes
            this.flattenAttributes(nestedRecord.attributes, record, key);
          } else if ('items' in nestedRecord.attributes && nestedRecord.attributes.items) {
            // Connection type with items
            this.flattenAttributes(nestedRecord.attributes.items, record, key);
          }
        }
      } else {
        // Simple attribute - store directly
        record[key] = value;
      }
    }
  }

  /**
   * Row __typenames the table widget knows how to flatten. Runtime queries
   * use three discriminated variants; stream-data queries collapse all
   * kinds (simple / aggregation / grouped / downsampling) into a single
   * `StreamDataQueryRow` type.
   */
  private static readonly SUPPORTED_ROW_TYPES: ReadonlySet<string> = new Set([
    'RtSimpleQueryRow',
    'RtAggregationQueryRow',
    'RtGroupingAggregationQueryRow',
    'StreamDataQueryRow'
  ]);

  /**
   * Fetches data from a persistent query (runtime or stream-data).
   * Family is determined from the cached `queryFamily` on the data source
   * (set by the config dialog when the user picks a query) and defaults to
   * `'runtime'` for legacy configs that predate stream-data support.
   */
  private fetchPersistentQueryData(
    dataSource: PersistentQueryDataSource,
    queryOptions: FetchDataOptions
  ): Observable<FetchResultTyped<Record<string, unknown>>> {
    // Entity-selector scope (AB#7721): pending → keep the list in its loading
    // state (an observable that never emits; the next refresh after the scope
    // resolves cancels it) and send no query; empty → no rows, no query — never
    // the persisted (unscoped) scope.
    const scope = this.stateService.resolveStreamDataScope(dataSource.entitySelectorId, dataSource.queryFamily, dataSource.ignoreTimeFilter);
    if (scope.kind === 'pending') {
      return NEVER;
    }
    if (scope.kind === 'empty') {
      return of(new FetchResultTyped<Record<string, unknown>>([], 0));
    }

    const fieldFilter = this.convertFiltersToDto(this._config?.filters);

    // queryFamily may be undefined for legacy widget configs — the executor
    // falls back to a one-time lookup by rtId. streamDataArgs is sent
    // unconditionally because the runtime path ignores it.
    //
    // Precedence: MeshBoard time filter > query's intrinsic time bounds.
    // When no time filter is active, the persistent query uses its own bounds.
    const streamDataArgs = this.buildStreamDataArgs();

    return this.queryExecutor.execute(dataSource.queryFamily, dataSource.queryRtId, {
      first: queryOptions.state.take ?? this._config?.pageSize ?? 10,
      after: GraphQL.offsetToCursor(queryOptions.state.skip ?? 0),
      fieldFilter: fieldFilter ?? undefined,
      streamDataArgs,
      // Runtime queries: `rtId IN` field filter (AB#7725); stream data: arg.rtIds.
      scopeRtIds: scope.kind === 'scoped' ? scope.rtIds : undefined,
      // A refetch (board refresh, changed inputs, page-1 recovery) bypasses the
      // Apollo cache like the runtime-entity path does, so a cached page with a
      // stale total count is never shown again (AB#8801).
      forceRefresh: queryOptions.forceRefresh ?? false,
      // handleFetchError returns to page 1 on INCOMPLETE_SLICE, so the error link must not toast it (AB#8805).
      handlesPageOutOfRange: true
    }).pipe(
      map(result => {
        // Extract columns from query response and update signal.
        // Replace dots with underscores for grid compatibility (Kendo treats dots as nested paths).
        const columns: QueryColumn[] = result.columns.map(c => ({
          attributePath: this.sanitizeFieldName(c.attributePath),
          attributeValueType: c.attributeValueType ?? ''
        }));
        this._queryColumns.set(columns);
        this.queryColumnsLoaded.emit(columns);

        const columnPaths = new Set(columns.map(c => c.attributePath));
        const hasRtIdColumn = columnPaths.has('rtId');
        const hasCkTypeIdColumn = columnPaths.has('ckTypeId');

        const data = result.rows
          .filter(row => TableWidgetDataSourceDirective.SUPPORTED_ROW_TYPES.has(row.__typename ?? ''))
          .map((row, index) => this.queryRowToRecord(row, columns, hasRtIdColumn, hasCkTypeIdColumn, index));

        return new FetchResultTyped<Record<string, unknown>>(data, result.totalCount);
      }),
      catchError(err => this.handleFetchError(err, queryOptions, 'Error fetching query data:'))
    );
  }

  /**
   * Flattens a unified `QueryResultRow` into a Kendo-grid-friendly record.
   * Cells are stored under their matching column's `attributePath` rather than
   * the cell's own — the engine emits cell paths in wire-form with a function
   * suffix (e.g. cell path `meterreading_count` for column path `meterReading`).
   * `matchesAttributePath` reconciles both forms.
   */
  private queryRowToRecord(
    row: QueryResultRow,
    columns: QueryColumn[],
    hasRtIdColumn: boolean,
    hasCkTypeIdColumn: boolean,
    index: number
  ): Record<string, unknown> {
    const record: Record<string, unknown> = {};

    if (hasRtIdColumn) {
      record['rtId'] = row.rtId ?? `agg-${index}`;
    }
    if (hasCkTypeIdColumn) {
      record['ckTypeId'] = row.ckTypeId ?? '';
    }

    for (const cell of row.cells) {
      const matchingColumn = columns.find(col => matchesAttributePath(cell.attributePath, col.attributePath));
      if (matchingColumn) {
        record[matchingColumn.attributePath] = cell.value;
      }
    }

    return record;
  }

  /**
   * Converts query columns to TableColumn format for display.
   */
  getTableColumnsFromQuery(): TableColumn[] {
    return this._queryColumns().map(col => ({
      field: col.attributePath,
      title: this.formatColumnTitle(col.attributePath),
      width: undefined
    }));
  }

  /**
   * Clears the cached query columns. Call this before fetching new data
   * when the query configuration changes.
   */
  clearQueryColumns(): void {
    this._queryColumns.set([]);
  }

  private formatColumnTitle(field: string): string {
    // Convert camelCase/PascalCase to Title Case
    // Also handle underscore-separated paths (e.g., "contact_firstName" -> "Contact First Name")
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Sanitizes field names for Kendo Grid compatibility.
   * Kendo interprets dots as nested object paths, so we replace them with underscores.
   */
  private sanitizeFieldName(fieldName: string): string {
    return fieldName.replace(/\./g, '_');
  }

  /**
   * Converts widget filter configuration to GraphQL FieldFilterDto format.
   * Resolves MeshBoard variables in filter values before conversion.
   */
  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables);
  }

  /**
   * Builds `StreamDataExecutionArgs` from the MeshBoard's current time filter.
   * Returns `undefined` when no filter is active, or when the widget opted out
   * via `ignoreTimeFilter`, so the persistent query's own bounds apply.
   */
  private buildStreamDataArgs(): StreamDataExecutionArgs | undefined {
    const ds = this._config?.dataSource;
    const isPersistentQuery = ds?.type === 'persistentQuery';
    const timeArgs = this.stateService.resolveStreamDataTimeArgs(isPersistentQuery ? ds.ignoreTimeFilter : undefined);
    const rtIds = this.stateService.resolveStreamDataRtIds(isPersistentQuery ? ds.entitySelectorId : undefined);
    if (!timeArgs && !rtIds) {
      return undefined;
    }
    return { ...timeArgs, rtIds };
  }
}
