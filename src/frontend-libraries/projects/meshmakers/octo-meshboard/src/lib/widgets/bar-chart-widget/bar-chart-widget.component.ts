import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarChartWidgetConfig, BarChartType, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { catchError, firstValueFrom } from 'rxjs';
import { FieldFilterDto } from '@meshmakers/octo-services';

/**
 * Series data for the bar chart
 */
interface SeriesData {
  name: string;
  data: number[];
  color?: string;
}

/**
 * Mapping from our chart types to Kendo chart configuration
 */
interface KendoChartConfig {
  type: 'column' | 'bar';
  stack: boolean | string;
}

const CHART_TYPE_MAPPING: Record<BarChartType, KendoChartConfig> = {
  column: { type: 'column', stack: false },
  bar: { type: 'bar', stack: false },
  stackedColumn: { type: 'column', stack: true },
  stackedBar: { type: 'bar', stack: true },
  stackedColumn100: { type: 'column', stack: '100%' },
  stackedBar100: { type: 'bar', stack: '100%' }
};

@Component({
  selector: 'mm-bar-chart-widget',
  standalone: true,
  imports: [
    CommonModule,
    ChartsModule,
    WidgetNotConfiguredComponent
  ],
  template: `
    <div class="bar-chart-widget" [class.loading]="isLoading()" [class.error]="error()">
      @if (isNotConfigured()) {
        <mm-widget-not-configured></mm-widget-not-configured>
      } @else if (isLoading()) {
        <div class="loading-indicator">
          <span>...</span>
        </div>
      } @else if (error()) {
        <div class="error-message">
          <span>{{ error() }}</span>
        </div>
      } @else {
        <kendo-chart class="chart-container">
          <kendo-chart-plot-area [margin]="plotAreaMargin()"></kendo-chart-plot-area>
          <kendo-chart-category-axis>
            <kendo-chart-category-axis-item [categories]="categories()">
              <kendo-chart-category-axis-item-labels
                [rotation]="labelRotation()"
                [content]="categoryLabelContent">
              </kendo-chart-category-axis-item-labels>
            </kendo-chart-category-axis-item>
          </kendo-chart-category-axis>

          <kendo-chart-series>
            @for (series of seriesData(); track series.name) {
              <kendo-chart-series-item
                [type]="kendoChartType()"
                [data]="series.data"
                [name]="series.name"
                [color]="series.color"
                [stack]="stackConfig()">
                @if (config.showDataLabels) {
                  <kendo-chart-series-item-labels
                    [visible]="true"
                    [format]="'{0:n0}'">
                  </kendo-chart-series-item-labels>
                }
              </kendo-chart-series-item>
            }
          </kendo-chart-series>

          <kendo-chart-legend
            [visible]="config.showLegend !== false"
            [position]="config.legendPosition ?? 'right'">
          </kendo-chart-legend>

          <kendo-chart-tooltip>
            <ng-template kendoChartSeriesTooltipTemplate let-value="value" let-category="category" let-series="series">
              <div class="chart-tooltip">
                <strong>{{ category }}</strong><br/>
                {{ series.name }}: {{ formatValue(value) }}
              </div>
            </ng-template>
          </kendo-chart-tooltip>
        </kendo-chart>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .bar-chart-widget {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 8px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .bar-chart-widget.loading,
    .bar-chart-widget.error {
      opacity: 0.7;
    }

    .loading-indicator,
    .error-message,
    .no-config-overlay {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
    }

    .loading-indicator span {
      font-size: 1.5rem;
      color: var(--kendo-color-subtle, #6c757d);
    }

    .error-message span {
      color: var(--kendo-color-error, #dc3545);
      font-size: 0.875rem;
    }

    .no-config-overlay span {
      color: var(--kendo-color-subtle, #6c757d);
      font-style: italic;
    }

    .chart-container {
      width: 100%;
      height: 100%;
    }

    kendo-chart {
      width: 100%;
      height: 100%;
    }

    .chart-tooltip {
      padding: 4px 8px;
    }
  `]
})
export class BarChartWidgetComponent implements DashboardWidget<BarChartWidgetConfig, SeriesData[]>, OnInit, OnChanges {
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() config!: BarChartWidgetConfig;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _categories = signal<string[]>([]);
  private readonly _seriesData = signal<SeriesData[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly isLoading = this._isLoading.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly seriesData = this._seriesData.asReadonly();
  readonly error = this._error.asReadonly();

  readonly data = computed(() => this._seriesData());

  /**
   * Check if widget is not configured (needs data source setup).
   * This is a method (not computed) to ensure it re-evaluates when config changes via @Input.
   */
  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;

    if (dataSource.type === 'persistentQuery') {
      const ds = dataSource as PersistentQueryDataSource;
      if (!ds.queryRtId || !this.config?.categoryField) return true;

      // Dynamic Series Mode: seriesGroupField + valueField
      if (this.config?.seriesGroupField && this.config?.valueField) {
        return false;
      }

      // Static Series Mode: series array with at least one entry
      return !(this.config?.series?.length > 0);
    }

    return true; // Unknown data source type
  }

  readonly kendoChartType = computed(() => {
    const chartType = this.config?.chartType ?? 'column';
    return CHART_TYPE_MAPPING[chartType]?.type ?? 'column';
  });

  readonly stackConfig = computed(() => {
    const chartType = this.config?.chartType ?? 'column';
    return CHART_TYPE_MAPPING[chartType]?.stack ?? false;
  });

  readonly labelRotation = computed(() => {
    // Rotate labels for column charts if many categories
    const isColumn = this.kendoChartType() === 'column';
    const categoryCount = this._categories().length;
    return isColumn && categoryCount > 5 ? -45 : 0;
  });

  /** Extra margin so long category axis labels are not clipped. */
  readonly plotAreaMargin = computed(() => {
    const isBar = this.kendoChartType() === 'bar';
    // Horizontal bar charts need more left margin for category labels on the Y-axis
    return isBar ? { top: 0, right: 0, bottom: 0, left: 10 } : { top: 0, right: 0, bottom: 0, left: 0 };
  });

  /** Truncates long category axis labels to prevent overflow. */
  categoryLabelContent = (e: { value: string }): string => {
    const maxLen = 18;
    return e.value.length > maxLen ? e.value.substring(0, maxLen) + '...' : e.value;
  };

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

  hasValidConfig(): boolean {
    if (!this.config?.dataSource) return false;

    if (this.config.dataSource.type === 'persistentQuery') {
      const ds = this.config.dataSource as PersistentQueryDataSource;
      if (!ds.queryRtId || !this.config.categoryField) return false;

      // Dynamic Series Mode: seriesGroupField + valueField
      if (this.config.seriesGroupField && this.config.valueField) {
        return true;
      }

      // Static Series Mode: series array with at least one entry
      return !!(this.config.series?.length > 0);
    }

    return false;
  }

  /**
   * Checks if using dynamic series mode (seriesGroupField + valueField)
   */
  private isDynamicSeriesMode(): boolean {
    return !!(this.config.seriesGroupField && this.config.valueField);
  }

  formatValue(value: number): string {
    return value.toLocaleString('de-AT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  private async loadData(): Promise<void> {
    // Skip loading if widget is not configured - isNotConfigured() handles the display
    if (this.isNotConfigured()) {
      return;
    }

    // Note: isNotConfigured() check ensures dataSource and queryRtId are set
    const queryDataSource = this.config.dataSource as PersistentQueryDataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      // Convert widget filters to GraphQL format
      const fieldFilter = this.convertFiltersToDto(this.config.filters);

      const result = await firstValueFrom(
        this.executeRuntimeQueryGQL.fetch({
          variables: {
            rtId: queryDataSource.queryRtId,
            fieldFilter
          }
        }).pipe(
          catchError(err => {
            console.error('Error loading Bar Chart data:', err);
            throw err;
          })
        )
      );

      const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];

      if (queryItems.length === 0) {
        this._categories.set([]);
        this._seriesData.set([]);
        this._isLoading.set(false);
        return;
      }

      const queryResult = queryItems[0];
      if (!queryResult) {
        this._categories.set([]);
        this._seriesData.set([]);
        this._isLoading.set(false);
        return;
      }

      // Extract rows
      const rows = queryResult.rows?.items ?? [];
      const supportedRowTypes = ['RtSimpleQueryRow', 'RtAggregationQueryRow', 'RtGroupingAggregationQueryRow'];

      const filteredRows = rows
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .filter(row => supportedRowTypes.includes(row.__typename ?? ''));

      // Process data based on mode
      if (this.isDynamicSeriesMode()) {
        this.processDynamicSeriesData(filteredRows);
      } else {
        this.processStaticSeriesData(filteredRows);
      }

      this._isLoading.set(false);

    } catch (err) {
      console.error('Error loading Bar Chart data:', err);
      this._error.set('Failed to load data');
      this._isLoading.set(false);
    }
  }

  /**
   * Processes data in Static Series Mode.
   * Each series in config.series corresponds to a separate numeric field.
   */
  private processStaticSeriesData(filteredRows: unknown[]): void {
    const categories: string[] = [];
    const seriesMap = new Map<string, number[]>();

    // Initialize series map from config
    for (const seriesConfig of (this.config.series ?? [])) {
      seriesMap.set(seriesConfig.field, []);
    }

    for (const row of filteredRows) {
      const queryRow = row as { cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };
      const cells = queryRow.cells?.items ?? [];

      let categoryValue = '';
      const rowValues = new Map<string, number>();

      for (const cell of cells) {
        if (!cell?.attributePath) continue;

        const sanitizedPath = this.sanitizeFieldName(cell.attributePath);

        if (sanitizedPath === this.sanitizeFieldName(this.config.categoryField)) {
          categoryValue = String(cell.value ?? '');
        }

        // Check if this cell is one of our series fields
        for (const seriesConfig of (this.config.series ?? [])) {
          if (sanitizedPath === this.sanitizeFieldName(seriesConfig.field)) {
            const numValue = typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value));
            rowValues.set(seriesConfig.field, isNaN(numValue) ? 0 : numValue);
          }
        }
      }

      if (categoryValue !== '') {
        categories.push(categoryValue);

        // Add values for each series
        for (const seriesConfig of (this.config.series ?? [])) {
          const value = rowValues.get(seriesConfig.field) ?? 0;
          seriesMap.get(seriesConfig.field)?.push(value);
        }
      }
    }

    // Convert to series data array
    const seriesData: SeriesData[] = (this.config.series ?? []).map(seriesConfig => ({
      name: seriesConfig.name ?? seriesConfig.field,
      data: seriesMap.get(seriesConfig.field) ?? [],
      color: seriesConfig.color
    }));

    this._categories.set(categories);
    this._seriesData.set(seriesData);
  }

  /**
   * Processes data in Dynamic Series Mode.
   * Series are created dynamically from unique values of seriesGroupField.
   * Each row represents a combination of category + series group + value.
   *
   * Example data structure:
   * - Row 1: { legalEntityType: 'Company', billingType: 'Credit', quantity: 261721 }
   * - Row 2: { legalEntityType: 'Company', billingType: 'Debit', quantity: 65263 }
   * - ...
   *
   * Results in:
   * - Categories: ['Company', 'LegalPerson', 'LocalAuthority', 'NaturalPerson']
   * - Series 'Credit': [261721, 70343, 23140, 189794]
   * - Series 'Debit': [65263, 60153, 159636, 108225]
   */
  private processDynamicSeriesData(filteredRows: unknown[]): void {
    const categoryField = this.config.categoryField;
    const seriesGroupField = this.config.seriesGroupField!;
    const valueField = this.config.valueField!;

    // Build a map: category -> seriesGroup -> value
    const dataMap = new Map<string, Map<string, number>>();
    const allCategories = new Set<string>();
    const allSeriesGroups = new Set<string>();

    for (const row of filteredRows) {
      const queryRow = row as { cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };
      const cells = queryRow.cells?.items ?? [];

      let categoryValue = '';
      let seriesGroupValue = '';
      let numericValue = 0;

      for (const cell of cells) {
        if (!cell?.attributePath) continue;

        const sanitizedPath = this.sanitizeFieldName(cell.attributePath);

        if (sanitizedPath === this.sanitizeFieldName(categoryField)) {
          categoryValue = String(cell.value ?? '');
        } else if (sanitizedPath === this.sanitizeFieldName(seriesGroupField)) {
          seriesGroupValue = String(cell.value ?? '');
        } else if (sanitizedPath === this.sanitizeFieldName(valueField)) {
          const val = cell.value;
          numericValue = typeof val === 'number' ? val : parseFloat(String(val));
          if (isNaN(numericValue)) numericValue = 0;
        }
      }

      if (categoryValue && seriesGroupValue) {
        allCategories.add(categoryValue);
        allSeriesGroups.add(seriesGroupValue);

        if (!dataMap.has(categoryValue)) {
          dataMap.set(categoryValue, new Map());
        }
        dataMap.get(categoryValue)!.set(seriesGroupValue, numericValue);
      }
    }

    // Convert to arrays (maintain insertion order)
    const categories = Array.from(allCategories);
    const seriesGroups = Array.from(allSeriesGroups);

    // Build series data
    const seriesData: SeriesData[] = seriesGroups.map(seriesGroup => {
      const data = categories.map(category => {
        return dataMap.get(category)?.get(seriesGroup) ?? 0;
      });

      return {
        name: seriesGroup,
        data
      };
    });

    this._categories.set(categories);
    this._seriesData.set(seriesData);
  }

  /**
   * Sanitizes field names for comparison.
   * Replaces dots with underscores (same as table widget).
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
