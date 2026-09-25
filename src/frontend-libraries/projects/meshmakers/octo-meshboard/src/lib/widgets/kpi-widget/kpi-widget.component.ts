import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, inject, signal, computed, effect, untracked, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiWidgetConfig, RuntimeEntityData, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardDataService } from '../../services/meshboard-data.service';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { QueryExecutionResult, QueryExecutorService, StreamDataExecutionArgs } from '../../services/query-executor.service';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { SVGIconModule } from '@progress/kendo-angular-icons';
import { arrowUpIcon, arrowDownIcon, minusIcon } from '@progress/kendo-svg-icons';
import { catchError, of, firstValueFrom } from 'rxjs';
import { FieldFilterDto } from '@meshmakers/octo-services';
import { applyValueMultiplier, matchesAttributePath } from '../../utils/widget-data-utils';
import { evaluateFormula, findVariableCycles, FormulaEvaluationResult } from '../../utils/meshboard-formula';
import { ExpressionEvaluatorService } from '@meshmakers/octo-process-diagrams';

@Component({
  selector: 'mm-kpi-widget',
  standalone: true,
  imports: [CommonModule, SVGIconModule, WidgetNotConfiguredComponent],
  templateUrl: './kpi-widget.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './kpi-widget.component.scss'
})
export class KpiWidgetComponent implements DashboardWidget<KpiWidgetConfig, RuntimeEntityData>, OnInit, OnChanges, OnDestroy {
  private readonly dataService = inject(DashboardDataService);
  private readonly queryExecutor = inject(QueryExecutorService);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);
  private readonly expressionEvaluator = inject(ExpressionEvaluatorService);

  /**
   * Row __typenames KPI extraction recognises.
   * Runtime queries discriminate; stream-data queries collapse all kinds
   * (simple / aggregation / grouped / downsampling) into `StreamDataQueryRow`.
   */
  private static readonly SUPPORTED_ROW_TYPES: ReadonlySet<string> = new Set([
    'RtAggregationQueryRow',
    'RtGroupingAggregationQueryRow',
    'StreamDataQueryRow'
  ]);

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
   * Signal mirror of the `config` input, so computeds re-run when the config
   * changes (the input itself is a plain property). Falls back to the input
   * before the first lifecycle hook.
   */
  private readonly _config = signal<KpiWidgetConfig | undefined>(undefined);

  private currentConfig(): KpiWidgetConfig | undefined {
    return this._config() ?? this.config;
  }

  constructor() {
    // Publishes the raw value as runtime MeshBoard variable (AB#5364).
    effect(() => {
      const config = this.currentConfig();
      if (!config) return;
      const name = config.outputVariableName?.trim();
      const value = name ? this.publishedValue() : null;
      untracked(() => {
        if (name && value !== null) {
          this.stateService.setWidgetVariable(config.id, name, value);
        } else {
          this.stateService.clearWidgetVariable(config.id);
        }
      });
    });
  }

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
      if (this.isFormulaMode()) {
        return !this.config.formula?.trim();
      }
      return false;
    }
    return false;
  }

  /** True when the value is computed from a formula (AB#5364). */
  isFormulaMode(): boolean {
    return this.currentConfig()?.valueMode === 'formula';
  }

  /**
   * Formula evaluation result, live over the MeshBoard variables.
   * `null` outside formula mode. A widget in a circular reference is not evaluated,
   * otherwise publishing would ping-pong between the widgets of the cycle.
   */
  private readonly formulaResult = computed<FormulaEvaluationResult | null>(() => {
    const config = this.currentConfig();
    if (config?.valueMode !== 'formula') return null;
    if (findVariableCycles(this.stateService.widgets()).has(config.id)) {
      return { status: 'error', error: 'Circular variable reference' };
    }
    return evaluateFormula(config.formula, this.stateService.getVariables(), this.expressionEvaluator);
  });

  /** Error message of the formula (syntax, evaluation or circular reference). */
  readonly formulaError = computed(() => {
    const result = this.formulaResult();
    return result?.status === 'error' ? result.error : null;
  });

  /**
   * Unformatted value: the formula result, or the value taken from the loaded data
   * (query values already scaled by `valueMultiplier`).
   */
  readonly rawValue = computed<unknown>(() => {
    const formulaResult = this.formulaResult();
    if (formulaResult) {
      return formulaResult.status === 'ok' ? formulaResult.value : null;
    }

    const data = this._data();
    if (!data) return null;
    const config = this.currentConfig();

    // Determine attribute name based on data source type
    let attributeName: string | undefined;
    if (config?.dataSource?.type === 'persistentQuery') {
      attributeName = '_queryValue';
    } else if (config?.dataSource?.type === 'static') {
      attributeName = '_staticValue';
    } else {
      attributeName = config?.valueAttribute;
    }

    // First check for system properties (direct properties on RuntimeEntityData)
    const systemValue = this.getSystemPropertyValue(data, attributeName);
    if (systemValue !== undefined) {
      return systemValue;
    }

    // Then check in the attributes array
    return data.attributes?.find(a => a.attributeName === attributeName)?.value ?? null;
  });

  readonly value = computed(() => this.formatDisplayValue(this.rawValue()));

  /**
   * Value published as output variable: the raw value as string, or `null` while
   * there is none (nothing loaded, pending formula, unresolved placeholder).
   */
  private readonly publishedValue = computed<string | null>(() => {
    const raw = this.rawValue();
    if (raw === null || raw === undefined) return null;
    const str = String(raw);
    if (str === '' || str === 'null' || this.variableService.hasUnresolvedVariables(str)) {
      return null;
    }
    return str;
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
    const comparisonText = this.currentConfig()?.comparisonText;
    if (!comparisonText) return null;
    const variables = this.stateService.getVariables();
    return this.variableService.resolveVariables(comparisonText, variables);
  });

  ngOnInit(): void {
    this._config.set(this.config);
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      const previous = changes['config'].previousValue as KpiWidgetConfig | undefined;
      if (previous && previous.id !== this.config?.id) {
        this.stateService.clearWidgetVariable(previous.id);
      }
      this._config.set(this.config);
      if (!changes['config'].firstChange) {
        this.loadData();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.config?.id) {
      this.stateService.clearWidgetVariable(this.config.id);
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

    if (this.isFormulaMode()) {
      // Formula values are computed live from the variables (see formulaResult)
      this._data.set(null);
      this._error.set(null);
      return;
    }

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
      const fieldFilter = this.convertFiltersToDto(this.config.filters);
      // queryFamily may be undefined for legacy widget configs — the executor
      // falls back to a one-time lookup by rtId. streamDataArgs is sent
      // unconditionally because the runtime path ignores it.
      const streamDataArgs = this.buildStreamDataArgs();

      const result = await firstValueFrom(
        this.queryExecutor.execute(dataSource.queryFamily, dataSource.queryRtId, {
          fieldFilter: fieldFilter ?? undefined,
          streamDataArgs
        }).pipe(
          catchError(err => {
            console.error('Error loading KPI query data:', err);
            throw err;
          })
        )
      );

      let value: number | string = 0;
      const queryMode = this.config.queryMode ?? 'simpleCount';

      switch (queryMode) {
        case 'simpleCount':
          value = result.totalCount;
          break;

        case 'aggregation':
          value = this.extractAggregationValue(result);
          break;

        case 'groupedAggregation':
          value = this.extractGroupedAggregationValue(result);
          break;
      }

      // Optional scale factor (e.g. Σ(kW samples) × sampleInterval → kWh).
      // Applied to numeric values only; strings pass through unchanged.
      value = applyValueMultiplier(value, this.config.valueMultiplier);

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

  private buildStreamDataArgs(): StreamDataExecutionArgs | undefined {
    const ds = this.config.dataSource as PersistentQueryDataSource;
    const timeArgs = this.stateService.resolveStreamDataTimeArgs(ds.ignoreTimeFilter);
    const rtIds = this.stateService.resolveStreamDataRtIds(ds.entitySelectorId);
    if (!timeArgs && !rtIds) {
      return undefined;
    }
    return { ...timeArgs, rtIds };
  }

  private extractAggregationValue(queryResult: QueryExecutionResult): number | string {
    const firstRow = queryResult.rows.find(row =>
      KpiWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? '')
    );
    if (!firstRow) return 0;

    const valueField = this.config.queryValueField;
    for (const cell of firstRow.cells) {
      if (valueField && matchesAttributePath(cell.attributePath, valueField)) {
        return this.extractCellValue(cell.value);
      }
    }

    // Fallback: return first cell value if no specific field configured
    return firstRow.cells.length > 0 ? this.extractCellValue(firstRow.cells[0].value) : 0;
  }

  private extractGroupedAggregationValue(queryResult: QueryExecutionResult): number | string {
    const categoryField = this.config.queryCategoryField;
    const categoryValue = this.config.queryCategoryValue;
    const valueField = this.config.queryValueField;

    if (!categoryField || !categoryValue || !valueField) {
      return 0;
    }

    for (const row of queryResult.rows) {
      if (!KpiWidgetComponent.SUPPORTED_ROW_TYPES.has(row.__typename ?? '')) continue;

      let categoryMatch = false;
      let value: number | string = 0;

      for (const cell of row.cells) {
        if (matchesAttributePath(cell.attributePath, categoryField) && String(cell.value) === categoryValue) {
          categoryMatch = true;
        }
        if (matchesAttributePath(cell.attributePath, valueField)) {
          value = this.extractCellValue(cell.value);
        }
      }

      if (categoryMatch) {
        return value;
      }
    }

    return 0;
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

  /**
   * Converts widget filter configuration to GraphQL FieldFilterDto format.
   * Resolves MeshBoard variables in filter values before conversion.
   */
  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables);
  }
}
