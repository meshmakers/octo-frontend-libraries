import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LineChartWidgetConfig, PersistentQueryDataSource, WidgetFilterConfig } from '../../models/meshboard.models';
import { DashboardWidget } from '../widget.interface';
import { WidgetNotConfiguredComponent } from '../../components/widget-not-configured/widget-not-configured.component';
import { ChartsModule } from '@progress/kendo-angular-charts';
import { ExecuteRuntimeQueryDtoGQL } from '../../graphQL/executeRuntimeQuery';
import { MeshBoardStateService } from '../../services/meshboard-state.service';
import { MeshBoardVariableService } from '../../services/meshboard-variable.service';
import { catchError, firstValueFrom } from 'rxjs';
import { FieldFilterDto } from '@meshmakers/octo-services';

/**
 * Series data for the line chart
 */
interface LineSeriesData {
  name: string;
  data: (number | null)[];
  unit?: string;
  axisName?: string;
}

/**
 * Value axis configuration
 */
interface ValueAxisConfig {
  name: string;
  unit: string;
  position: 'left' | 'right';
}

@Component({
  selector: 'mm-line-chart-widget',
  standalone: true,
  imports: [
    CommonModule,
    ChartsModule,
    WidgetNotConfiguredComponent
  ],
  template: `
    <div class="line-chart-widget" [class.loading]="isLoading()" [class.error]="error()">
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
        <kendo-chart class="chart-container" [plotArea]="{ background: 'transparent', margin: { top: 0, right: 0, bottom: 0, left: 0 } }">
          <kendo-chart-area [background]="'transparent'"></kendo-chart-area>

          <kendo-chart-category-axis>
            <kendo-chart-category-axis-item
              [categories]="categories()"
              [line]="{ visible: false }"
              [majorGridLines]="{ visible: false }">
              <kendo-chart-category-axis-item-labels
                [rotation]="labelRotation()"
                [step]="labelStep()"
                [content]="categoryLabelContent">
              </kendo-chart-category-axis-item-labels>
            </kendo-chart-category-axis-item>
          </kendo-chart-category-axis>

          @if (valueAxes().length > 0) {
            <kendo-chart-value-axis>
              @for (axis of valueAxes(); track axis.name) {
                <kendo-chart-value-axis-item
                  [name]="axis.name"
                  [title]="{ text: axis.unit }"
                  [line]="{ visible: false }"
                  [majorGridLines]="{ color: 'rgba(255,255,255,0.06)' }"
                  [plotBands]="plotBands()">
                </kendo-chart-value-axis-item>
              }
            </kendo-chart-value-axis>
          }

          @if (valueAxes().length === 0) {
            <kendo-chart-value-axis>
              <kendo-chart-value-axis-item
                [name]="''"
                [title]="{ text: config.valueAxisTitle ?? '' }"
                [line]="{ visible: false }"
                [majorGridLines]="{ color: 'rgba(255,255,255,0.06)' }"
                [plotBands]="plotBands()">
              </kendo-chart-value-axis-item>
            </kendo-chart-value-axis>
          }

          <kendo-chart-series>
            @for (series of seriesData(); track series.name) {
              <kendo-chart-series-item
                [type]="chartType()"
                [style]="'smooth'"
                [data]="series.data"
                [name]="series.name"
                [axis]="series.axisName ?? ''"
                [opacity]="0.7"
                [markers]="{ visible: config.showMarkers ?? false }">
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
                {{ series.name }}: {{ formatValue(value) }}{{ getUnitForSeries(series.name) }}
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

    .line-chart-widget {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 8px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .line-chart-widget.loading,
    .line-chart-widget.error {
      opacity: 0.7;
    }

    .loading-indicator,
    .error-message {
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
export class LineChartWidgetComponent implements DashboardWidget<LineChartWidgetConfig, LineSeriesData[]>, OnInit, OnChanges {
  private readonly executeRuntimeQueryGQL = inject(ExecuteRuntimeQueryDtoGQL);
  private readonly stateService = inject(MeshBoardStateService);
  private readonly variableService = inject(MeshBoardVariableService);

  @Input() config!: LineChartWidgetConfig;

  // Widget state signals
  private readonly _isLoading = signal(false);
  private readonly _categories = signal<string[]>([]);
  private readonly _seriesData = signal<LineSeriesData[]>([]);
  private readonly _valueAxes = signal<ValueAxisConfig[]>([]);
  private readonly _error = signal<string | null>(null);
  private readonly _seriesUnitMap = signal<Map<string, string>>(new Map());

  readonly isLoading = this._isLoading.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly seriesData = this._seriesData.asReadonly();
  readonly valueAxes = this._valueAxes.asReadonly();
  readonly error = this._error.asReadonly();

  readonly data = computed(() => this._seriesData());

  readonly plotBands = computed(() => {
    if (!this.config?.referenceLines?.length) return [];
    return this.config.referenceLines.map(ref => {
      const lineColor = ref.color ?? '#ef4444';
      const bandWidth = ref.value * 0.002 || 1;
      return {
        from: ref.value - bandWidth,
        to: ref.value + bandWidth,
        color: lineColor,
        opacity: ref.opacity ?? 0.8,
        label: ref.label ? {
          text: ref.label,
          position: 'top' as const,
          align: 'right' as const,
          color: lineColor,
          font: '500 0.8rem sans-serif',
          padding: { top: 2, right: 4, bottom: 2, left: 4 }
        } : undefined
      };
    });
  });

  readonly chartType = computed((): 'line' | 'area' => {
    return this.config?.chartType ?? 'line';
  });

  readonly labelRotation = computed(() => {
    const categoryCount = this._categories().length;
    return categoryCount > 5 ? -45 : 0;
  });

  /**
   * Step for category axis labels to avoid overcrowding.
   * Shows every Nth label depending on total count.
   */
  readonly labelStep = computed(() => {
    const count = this._categories().length;
    if (count <= 10) return 1;
    if (count <= 30) return Math.ceil(count / 10);
    if (count <= 100) return Math.ceil(count / 15);
    return Math.ceil(count / 20);
  });

  isNotConfigured(): boolean {
    const dataSource = this.config?.dataSource;
    if (!dataSource) return true;

    if (dataSource.type === 'persistentQuery') {
      const ds = dataSource as PersistentQueryDataSource;
      return !ds.queryRtId || !this.config?.categoryField || !this.config?.seriesGroupField || !this.config?.valueField;
    }

    return true;
  }

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
      return !!(ds.queryRtId && this.config.categoryField && this.config.seriesGroupField && this.config.valueField);
    }
    return false;
  }

  formatValue(value: number): string {
    return value.toLocaleString('de-AT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  getUnitForSeries(seriesName: string): string {
    const unit = this._seriesUnitMap().get(seriesName);
    return unit ? ` ${unit}` : '';
  }

  private async loadData(): Promise<void> {
    if (this.isNotConfigured()) return;

    const queryDataSource = this.config.dataSource as PersistentQueryDataSource;

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const fieldFilter = this.convertFiltersToDto(this.config.filters);

      const result = await firstValueFrom(
        this.executeRuntimeQueryGQL.fetch({
          variables: {
            rtId: queryDataSource.queryRtId,
            fieldFilter
          }
        }).pipe(
          catchError(err => {
            console.error('Error loading Line Chart data:', err);
            throw err;
          })
        )
      );

      const queryItems = result.data?.runtime?.runtimeQuery?.items ?? [];

      if (queryItems.length === 0) {
        this._categories.set([]);
        this._seriesData.set([]);
        this._valueAxes.set([]);
        this._isLoading.set(false);
        return;
      }

      const queryResult = queryItems[0];
      if (!queryResult) {
        this._categories.set([]);
        this._seriesData.set([]);
        this._valueAxes.set([]);
        this._isLoading.set(false);
        return;
      }

      const rows = queryResult.rows?.items ?? [];
      const supportedRowTypes = ['RtSimpleQueryRow', 'RtAggregationQueryRow', 'RtGroupingAggregationQueryRow'];

      const filteredRows = rows
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .filter(row => supportedRowTypes.includes(row.__typename ?? ''));

      this.processData(filteredRows);
      this._isLoading.set(false);

    } catch (err) {
      console.error('Error loading Line Chart data:', err);
      this._error.set('Failed to load data');
      this._isLoading.set(false);
    }
  }

  /**
   * Processes query rows into line chart data.
   * Groups by seriesGroupField, orders by categoryField (date), supports multi-axis by unitField.
   */
  private processData(filteredRows: unknown[]): void {
    const categoryField = this.config.categoryField;
    const seriesGroupField = this.config.seriesGroupField;
    const valueField = this.config.valueField;
    const unitField = this.config.unitField;

    // Collect data: category -> seriesGroup -> value
    const dataMap = new Map<string, Map<string, number>>();
    const allCategories = new Map<string, Date>(); // label -> parsed date for sorting
    const allSeriesGroups = new Set<string>();
    const seriesUnitMap = new Map<string, string>(); // seriesGroup -> unit

    for (const row of filteredRows) {
      const queryRow = row as { cells?: { items?: ({ attributePath?: string; value?: unknown } | null)[] | null } | null };
      const cells = queryRow.cells?.items ?? [];

      let categoryValue = '';
      let seriesGroupValue = '';
      let numericValue = 0;
      let unitValue = '';

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
        } else if (unitField && sanitizedPath === this.sanitizeFieldName(unitField)) {
          unitValue = String(cell.value ?? '');
        }
      }

      if (categoryValue && seriesGroupValue) {
        // Parse date for sorting
        if (!allCategories.has(categoryValue)) {
          allCategories.set(categoryValue, new Date(categoryValue));
        }

        allSeriesGroups.add(seriesGroupValue);

        if (!dataMap.has(categoryValue)) {
          dataMap.set(categoryValue, new Map());
        }
        dataMap.get(categoryValue)!.set(seriesGroupValue, numericValue);

        // Track unit per series
        if (unitField && unitValue) {
          seriesUnitMap.set(seriesGroupValue, unitValue);
        }
      }
    }

    // Sort categories chronologically
    const sortedCategoryEntries = Array.from(allCategories.entries())
      .sort((a, b) => a[1].getTime() - b[1].getTime());

    // Detect if we need time precision (multiple data points per day)
    const dateOnlySet = new Set(sortedCategoryEntries.map(([, date]) => date.toLocaleDateString('de-AT')));
    const needsTime = dateOnlySet.size < sortedCategoryEntries.length;

    const categories = sortedCategoryEntries.map(([, date]) =>
      needsTime ? this.formatDateTime(date) : this.formatDate(date)
    );
    const categoryKeys = sortedCategoryEntries.map(([key]) => key);
    const seriesGroups = Array.from(allSeriesGroups);

    // Build value axes based on unique units
    const valueAxes: ValueAxisConfig[] = [];
    if (unitField && seriesUnitMap.size > 0) {
      const uniqueUnits = Array.from(new Set(seriesUnitMap.values()));
      uniqueUnits.forEach((unit, index) => {
        valueAxes.push({
          name: `unit_${this.sanitizeAxisName(unit)}`,
          unit,
          position: index === 0 ? 'left' : 'right'
        });
      });
    }

    // Build series data
    const seriesData: LineSeriesData[] = seriesGroups.map(seriesGroup => {
      const data = categoryKeys.map(categoryKey => {
        return dataMap.get(categoryKey)?.get(seriesGroup) ?? null;
      });

      const unit = seriesUnitMap.get(seriesGroup);
      const axisName = unit ? `unit_${this.sanitizeAxisName(unit)}` : undefined;

      return {
        name: seriesGroup,
        data,
        unit,
        axisName
      };
    });

    this._categories.set(categories);
    this._seriesData.set(seriesData);
    this._valueAxes.set(valueAxes);
    this._seriesUnitMap.set(seriesUnitMap);
  }

  /**
   * Formats a date for display on the category axis (date only).
   */
  private formatDate(date: Date): string {
    if (isNaN(date.getTime())) return '?';
    return date.toLocaleDateString('de-AT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Formats a date with time for display on the category axis.
   */
  private formatDateTime(date: Date): string {
    if (isNaN(date.getTime())) return '?';
    return date.toLocaleDateString('de-AT', {
      day: '2-digit',
      month: '2-digit'
    }) + ' ' + date.toLocaleTimeString('de-AT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private sanitizeFieldName(fieldName: string): string {
    return fieldName.replace(/\./g, '_');
  }

  private sanitizeAxisName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private convertFiltersToDto(filters?: WidgetFilterConfig[]): FieldFilterDto[] | undefined {
    const variables = this.stateService.getVariables();
    return this.variableService.convertToFieldFilterDto(filters, variables);
  }
}
