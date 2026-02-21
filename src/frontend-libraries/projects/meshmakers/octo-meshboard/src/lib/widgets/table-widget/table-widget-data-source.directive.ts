import { Directive, forwardRef, inject, Input, signal, Signal, Output, EventEmitter } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { OctoGraphQlDataSource } from '@meshmakers/octo-ui';
import { DataSourceBase, FetchDataOptions, FetchResultTyped, ListViewComponent } from '@meshmakers/shared-ui';
import { GraphQL, FieldFilterDto } from '@meshmakers/octo-services';
import { TableWidgetConfig, TableColumn, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { GetEntitiesByCkTypeDtoGQL } from '../../graphQL/getEntitiesByCkType';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';

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
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  private _config: TableWidgetConfig | null = null;

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

  public override fetchData(queryOptions: FetchDataOptions): Observable<FetchResultTyped<Record<string, unknown>> | null> {
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

    return this.getEntitiesByCkTypeGQL.fetch({
      variables: {
        ckTypeId: dataSource.ckTypeId,
        first: queryOptions.state.take ?? this._config.pageSize ?? 10,
        after: GraphQL.offsetToCursor(queryOptions.state.skip ?? 0),
        sort: sort,
        fieldFilters: allFilters.length > 0 ? allFilters : undefined,
        searchFilter: searchFilterDto
      },
      fetchPolicy: queryOptions.forceRefresh ? 'network-only' : 'cache-first'
    }).pipe(
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
      catchError(err => {
        console.error('Error fetching table data:', err);
        return of(new FetchResultTyped<Record<string, unknown>>([], 0));
      })
    );
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
   * Fetches data from a persistent query.
   * Extracts columns from the query response and transforms cells to flat records.
   */
  private fetchPersistentQueryData(
    dataSource: PersistentQueryDataSource,
    queryOptions: FetchDataOptions
  ): Observable<FetchResultTyped<Record<string, unknown>>> {
    // Convert widget-configured filters to GraphQL format (with variable resolution)
    const fieldFilter = this.convertFiltersToDto(this._config?.filters);

    return this.executeRuntimeQueryGQL.fetch({
      variables: {
        rtId: dataSource.queryRtId,
        first: queryOptions.state.take ?? this._config?.pageSize ?? 10,
        after: GraphQL.offsetToCursor(queryOptions.state.skip ?? 0),
        fieldFilter
      }
    }).pipe(
      map(result => {
        const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];

        if (queryItems.length === 0) {
          return new FetchResultTyped<Record<string, unknown>>([], 0);
        }

        const queryResult = queryItems[0];
        if (!queryResult) {
          return new FetchResultTyped<Record<string, unknown>>([], 0);
        }

        // Extract columns from query response and update signal
        // Replace dots with underscores for grid compatibility (Kendo treats dots as nested paths)
        const columns: QueryColumn[] = (queryResult.columns ?? [])
          .filter((c): c is NonNullable<typeof c> => c !== null)
          .map(c => ({
            attributePath: this.sanitizeFieldName(c.attributePath ?? ''),
            attributeValueType: c.attributeValueType ?? ''
          }));
        this._queryColumns.set(columns);
        // Emit event to notify component that columns have been loaded
        this.queryColumnsLoaded.emit(columns);

        // Extract rows
        const rows = queryResult.rows?.items ?? [];
        const totalCount = queryResult.rows?.totalCount ?? 0;

        // Check which standard fields are in the query columns
        const columnPaths = new Set(columns.map(c => c.attributePath));
        const hasRtIdColumn = columnPaths.has('rtId');
        const hasCkTypeIdColumn = columnPaths.has('ckTypeId');

        // Transform rows to flat records (handle union type by checking __typename)
        // Support RtSimpleQueryRow, RtAggregationQueryRow, and RtGroupingAggregationQueryRow
        const supportedRowTypes = ['RtSimpleQueryRow', 'RtAggregationQueryRow', 'RtGroupingAggregationQueryRow'];
        const data = rows
          .filter((row): row is NonNullable<typeof row> => row !== null)
          .filter(row => supportedRowTypes.includes(row.__typename ?? ''))
          .map((row, index) => {
            // Both row types have ckTypeId and cells, but only RtSimpleQueryRow has rtId
            const queryRow = row as { rtId?: string; ckTypeId?: string; cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };

            const record: Record<string, unknown> = {};

            // Only add rtId/ckTypeId if they're explicitly in the query columns
            if (hasRtIdColumn) {
              record['rtId'] = queryRow.rtId ?? `agg-${index}`;
            }
            if (hasCkTypeIdColumn) {
              record['ckTypeId'] = queryRow.ckTypeId ?? '';
            }

            // Flatten cells into the record (sanitize field names for grid compatibility)
            // Only add fields that are in the query columns
            const cells = queryRow.cells?.items ?? [];
            for (const cell of cells) {
              if (cell?.attributePath) {
                const sanitizedPath = this.sanitizeFieldName(cell.attributePath);
                if (columnPaths.has(sanitizedPath)) {
                  record[sanitizedPath] = cell.value;
                }
              }
            }

            return record;
          });

        return new FetchResultTyped<Record<string, unknown>>(data, totalCount);
      }),
      catchError(err => {
        console.error('Error fetching query data:', err);
        return of(new FetchResultTyped<Record<string, unknown>>([], 0));
      })
    );
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
}
