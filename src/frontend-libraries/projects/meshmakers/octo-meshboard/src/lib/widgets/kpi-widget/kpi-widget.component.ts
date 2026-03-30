import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiWidgetConfig, RuntimeEntityData, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { arrowUpIcon, arrowDownIcon, minusIcon } from '@progress/kendo-svg-icons';
import { catchError, of, firstValueFrom } from 'rxjs';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { FieldFilterDto } from '@meshmakers/octo-services';

@Component({
  selector: 'mm-kpi-widget',
  standalone: true,
  imports: [CommonModule, SVGIconModule, WidgetNotConfiguredComponent],
  templateUrl: './kpi-widget.component.html',
  styleUrl: './kpi-widget.component.scss'
})
export class KpiWidgetComponent implements DashboardWidget<KpiWidgetConfig, RuntimeEntityData>, OnInit, OnChanges {
  private readonly dataService = inject(DashboardDataService);
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() config!: KpiWidgetConfig;

  protected readonly arrowUpIcon = arrowUpIcon;
  protected readonly arrowDownIcon = arrowDownIcon;
  protected readonly minusIcon = minusIcon;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _data = signal<RuntimeEntityData | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly data = this._data.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Check if widget is not configured (needs data source setup).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;
    if (dataSource.type === 'runtimeEntity') {
      // For _count aggregation, only need ckTypeId
      if (this.config?.valueAttribute === '_count') {
        return !dataSource.ckTypeId;
      }
      return !dataSource.rtId && !dataSource.ckTypeId;
    }
    if (dataSource.type === 'persistentQuery') {
      return !dataSource.queryRtId;
    }
    if (dataSource.type === 'static') {
      return false;
    }
    return false;
  }

  readonly value = computed(() => {
    const data = this._data();
    if (!data) return '-';

    // Determine attribute name based on data source type
    let attributeName: string | undefined;
    if (this.config?.dataSource?.type === 'persistentQuery') {
      attributeName = '_queryValue';
    } else if (this.config?.dataSource?.type === 'static') {
      attributeName = '_staticValue';
    } else {
      attributeName = this.config?.valueAttribute;
    }

    // First check for system properties (direct properties on RuntimeEntityData)
    const systemValue = this.getSystemPropertyValue(data, attributeName);
    if (systemValue !== undefined) {
      return this.formatDisplayValue(systemValue);
    }

    // Then check in the attributes array
    if (!data.attributes) return '-';
    const attr = data.attributes.find(a => a.attributeName === attributeName);
    if (!attr) return '-';

    return this.formatDisplayValue(attr.value);
  });

  /**
   * Gets a system property value from RuntimeEntityData.
   * System properties are top-level properties like rtId, ckTypeId, rtWellKnownName.
   */
  private getSystemPropertyValue(data: RuntimeEntityData, propertyName?: string): unknown | undefined {
    if (!propertyName) return undefined;

    // Support both with and without underscore prefix for system properties
    const normalizedName = propertyName.startsWith('_') ? propertyName.substring(1) : propertyName;

    switch (normalizedName) {
      case 'rtId':
        return data.rtId;
      case 'ckTypeId':
        return data.ckTypeId;
      case 'rtWellKnownName':
        return data.rtWellKnownName;
      case 'rtCreationDateTime':
        return data.rtCreationDateTime;
      case 'rtChangedDateTime':
        return data.rtChangedDateTime;
      default:
        return undefined;
    }
  }

  /**
   * Formats a value for display in the KPI widget.
   * Numbers are formatted with locale, strings are displayed as-is.
   * Unresolved variable placeholders (e.g. ${variableName}) are shown as '-'.
   */
  private formatDisplayValue(value: unknown): string {
    // Handle null/undefined/string "null"
    if (value === null || value === undefined || value === 'null') {
      return '-';
    }

    // Handle unresolved variable placeholders
    const strValue = String(value);
    if (this.variableService.hasUnresolvedVariables(strValue)) {
      return '-';
    }

    // Handle empty string
    if (strValue === '') {
      return '-';
    }

    const numValue = typeof value === 'number' ? value : parseFloat(strValue);

    if (isNaN(numValue)) {
      // Not a number, return as string
      return strValue;
    }

    return numValue.toLocaleString('de-AT', {
      minimumFractionDigits: numValue % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    });
  }

  readonly label = computed(() => {
    const data = this._data();
    if (!this.config?.labelAttribute || !data) return '';

    // First check for system properties
    const systemValue = this.getSystemPropertyValue(data, this.config.labelAttribute);
    if (systemValue !== null && systemValue !== undefined && systemValue !== 'null') {
      return String(systemValue);
    }

    // Then check in the attributes array
    if (data.attributes) {
      const attr = data.attributes.find(a => a.attributeName === this.config.labelAttribute);
      if (attr && attr.value !== null && attr.value !== undefined && attr.value !== 'null') {
        return String(attr.value);
      }
    }
    return '';
  });

  readonly trendIcon = computed(() => {
    switch (this.config?.trend) {
      case 'up': return this.arrowUpIcon;
      case 'down': return this.arrowDownIcon;
      default: return this.minusIcon;
    }
  });

  readonly trendClass = computed(() => {
    switch (this.config?.trend) {
      case 'up': return 'trend-up';
      case 'down': return 'trend-down';
      default: return 'trend-neutral';
    }
  });

  readonly comparisonText = computed(() => {
    if (!this.config?.comparisonText) return null;
    const variables = this.stateService.getVariables();
    return this.variableService.resolveVariables(this.config.comparisonText, variables);
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].firstChange) {
      this.loadData();
    }
  }

  refresh(): void {
    this.loadData();
  }

  private loadData(): void {
    // Skip loading if widget is not configured - isNotConfigured() handles the display
    if (this.isNotConfigured()) {
      return;
    }

    const dataSource = this.config?.dataSource;

    if (dataSource.type === 'static') {
      // Resolve static value with variable substitution
      const staticValue = this.config.staticValue ?? '';
      const variables = this.stateService.getVariables();
      const resolvedValue = this.variableService.resolveVariables(staticValue, variables);

      const staticEntity: RuntimeEntityData = {
        rtId: 'static-entity',
        ckTypeId: 'system.static',
        attributes: [{ attributeName: '_staticValue', value: resolvedValue }],
        associations: []
      };
      this._data.set(staticEntity);
      this._error.set(null);
      return;
    }

    if (dataSource.type === 'persistentQuery') {
      this.loadPersistentQueryData();
      return;
    }

    if (dataSource.type === 'runtimeEntity') {
      // Special case: _count needs to fetch multiple entities and count them
      if (this.config.valueAttribute === '_count') {
        this.loadCountData();
        return;
      }

      // Normal case: fetch single entity and display attribute
      // Note: isNotConfigured() check at top of loadData() ensures rtId and ckTypeId are set
      this._isLoading.set(true);
      this._error.set(null);

      this.dataService.fetchEntityWithAssociations(dataSource.rtId!, dataSource.ckTypeId!)
        .pipe(
          catchError(err => {
            console.error('Error loading KPI data:', err);
            this._error.set('Failed to load data');
            return of(null);
          })
        )
        .subscribe(entityData => {
          this._data.set(entityData);
          this._isLoading.set(false);
        });
    }
  }

  private async loadCountData(): Promise<void> {
    // Note: isNotConfigured() check in loadData() ensures ckTypeId is set
    const dataSource = this.config.dataSource;
    if (dataSource.type !== 'runtimeEntity') return;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Use aggregation queries for count, passing any configured filters
      const queries = [{
        id: 'count',
        aggregation: 'count' as const,
        ckTypeId: dataSource.ckTypeId!,
        filters: this.config.filters
      }];

      const results = await this.dataService.fetchAggregations(queries);
      const count = results.get('count') ?? 0;

      // Create a synthetic entity with the count as an attribute
      const countEntity: RuntimeEntityData = {
        rtId: 'count-entity',
        ckTypeId: 'system.count',
        attributes: [{ attributeName: '_count', value: count }],
        associations: []
      };
      this._data.set(countEntity);
    } catch (err) {
      console.error('Error loading count data:', err);
      this._error.set('Failed to load count');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async loadPersistentQueryData(): Promise<void> {
    // Note: isNotConfigured() check in loadData() ensures queryRtId is set
    const dataSource = this.config.dataSource as PersistentQueryDataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Convert widget filters to GraphQL format
      const fieldFilter = this.convertFiltersToDto(this.config.filters);

      const result = await firstValueFrom(
        this.executeRuntimeQueryGQL.fetch({
          variables: {
            rtId: dataSource.queryRtId,
            fieldFilter
          }
        }).pipe(
          catchError(err => {
            console.error('Error loading KPI query data:', err);
            throw err;
          })
        )
      );

      const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];
      if (queryItems.length === 0) {
        this._error.set('Query returned no results');
        this._isLoading.set(false);
        return;
      }

      const queryResult = queryItems[0];
      if (!queryResult) {
        this._error.set('Query returned no results');
        this._isLoading.set(false);
        return;
      }

      let value: number | string = 0;
      const queryMode = this.config.queryMode ?? 'simpleCount';

      switch (queryMode) {
        case 'simpleCount':
          // Use totalCount from the query
          value = queryResult.rows?.totalCount ?? 0;
          break;

        case 'aggregation':
          // Get the single value from aggregation query (1 row, 1 column)
          value = this.extractAggregationValue(queryResult);
          break;

        case 'groupedAggregation':
          // Find the row matching the selected category and get its value
          value = this.extractGroupedAggregationValue(queryResult);
          break;
      }

      // Create a synthetic entity with the value
      const kpiEntity: RuntimeEntityData = {
        rtId: 'query-entity',
        ckTypeId: 'system.query',
        attributes: [{ attributeName: '_queryValue', value }],
        associations: []
      };
      this._data.set(kpiEntity);
      this._isLoading.set(false);

    } catch (err) {
      console.error('Error loading KPI query data:', err);
      this._error.set('Failed to load data');
      this._isLoading.set(false);
    }
  }

  private extractAggregationValue(queryResult: {
    rows?: { items?: ({ __typename?: string; cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null } | null)[] | null } | null
  }): number | string {
    const rows = queryResult.rows?.items ?? [];
    const supportedRowTypes = ['RtAggregationQueryRow', 'RtGroupingAggregationQueryRow'];

    // Get the first row
    const firstRow = rows.find(row => row && supportedRowTypes.includes(row.__typename ?? ''));
    if (!firstRow) return 0;

    const queryRow = firstRow as { cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };
    const cells = queryRow.cells?.items ?? [];

    // Find the value field or use the first cell
    const valueField = this.config.queryValueField;
    for (const cell of cells) {
      if (!cell?.attributePath) continue;

      const sanitizedPath = this.sanitizeFieldName(cell.attributePath);
      if (valueField && sanitizedPath === valueField) {
        return this.extractCellValue(cell.value);
      }
    }

    // Fallback: return first cell value if no specific field configured
    const firstCell = cells.find(c => c !== null);
    return firstCell ? this.extractCellValue(firstCell.value) : 0;
  }

  private extractGroupedAggregationValue(queryResult: {
    rows?: { items?: ({ __typename?: string; cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null } | null)[] | null } | null
  }): number | string {
    const rows = queryResult.rows?.items ?? [];
    const supportedRowTypes = ['RtGroupingAggregationQueryRow', 'RtAggregationQueryRow'];

    const categoryField = this.config.queryCategoryField;
    const categoryValue = this.config.queryCategoryValue;
    const valueField = this.config.queryValueField;

    if (!categoryField || !categoryValue || !valueField) {
      return 0;
    }

    // Find the row where category matches
    for (const row of rows) {
      if (!row || !supportedRowTypes.includes(row.__typename ?? '')) continue;

      const queryRow = row as { cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };
      const cells = queryRow.cells?.items ?? [];

      let categoryMatch = false;
      let value: number | string = 0;

      for (const cell of cells) {
        if (!cell?.attributePath) continue;

        const sanitizedPath = this.sanitizeFieldName(cell.attributePath);

        if (sanitizedPath === categoryField && String(cell.value) === categoryValue) {
          categoryMatch = true;
        }

        if (sanitizedPath === valueField) {
          value = this.extractCellValue(cell.value);
        }
      }

      if (categoryMatch) {
        return value;
      }
    }

    return 0;
  }

  private parseNumericValue(value: unknown): number {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Extracts a cell value, preserving strings and converting numbers.
   * Returns the value as-is if it's a string, or parses it as a number.
   */
  private extractCellValue(value: unknown): number | string {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Try to parse as number first
      const parsed = parseFloat(value);
      // If it's a valid number, return as number; otherwise return the string
      return isNaN(parsed) ? value : parsed;
    }
    // For other types (boolean, object), convert to string
    return String(value);
  }

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
